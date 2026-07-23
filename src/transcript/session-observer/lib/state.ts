/**
 * state.mjs — Atomic, lock-protected persistence of per-session read offsets.
 *
 * Storage: STATE_DIR/state.json  (default: ~/.local/state/session-observer/state.json)
 * Key format: `${runtime}:${sessionId}`
 *
 * Write protocol (same as Stoa's session-capture.sh.tpl):
 *   1. open(lockPath, 'wx')  — exclusive-create; retry up to LOCK_RETRIES × LOCK_INTERVAL_MS
 *   2. read + parse state.json  (treat missing / corrupt as empty)
 *   3. apply mutation fn
 *   4. write to state.json.<pid>.tmp
 *   5. fsync the tmp file
 *   6. rename(tmp, state.json)
 *   7. release lock in finally
 *
 * Backup writes (corrupt-state + migration) are performed while holding the lock,
 * including the public load() path, to avoid concurrent writers observing a
 * partial backup. Backup filenames include a timestamp and PID to be unique
 * across retries.
 */

import {
  access,
  open,
  rename,
  mkdir,
  readFile,
  unlink,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import type { Runtime } from '../../core/runtimes.js';
import {
  clearCursorState,
  CursorStateRecoveryRequiredError,
  cursorSessionKey,
  loadCursorState,
  mutateCursorState,
  resetAllCursorState,
  resetCursorSessionState,
} from './cursor-state.js';
import type {
  LegacyCursorStateMarker,
  MarkReadInput,
  SessionObserverState,
  SessionStateEntry,
  StateMutator,
} from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCHEMA_VERSION = 1;
const LOCK_RETRIES = 100;
const LOCK_INTERVAL_MS = 50;
const CURSOR_COMPATIBILITY = 'pre-integration-record-index';
let migrationBackupSequence = 0;

interface CursorCompatibilityEntry extends SessionStateEntry {
  runtime: 'cursor';
  cursorCompatibility: typeof CURSOR_COMPATIBILITY;
}

// ---------------------------------------------------------------------------
// State dir resolution
// ---------------------------------------------------------------------------

function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}

function stateDir(): string {
  return (
    process.env.STATE_DIR ??
    join(homedir(), '.local', 'state', 'session-observer')
  );
}

function statePath(dir: string): string {
  return join(dir, 'state.json');
}

function lockPath(dir: string): string {
  return join(dir, 'state.json.lock');
}

function cursorTransitionLockPath(dir: string): string {
  return join(dir, 'cursor-state-transition.lock');
}

function tmpPath(dir: string): string {
  return join(dir, `state.json.${process.pid}.tmp`);
}

/**
 * Generate a unique backup path using timestamp + pid.
 * @param {string} dir
 * @param {string} label  — e.g. 'corrupt' or 'v0'
 * @returns {string}
 */
function bakPath(dir: string, label: string): string {
  return join(dir, `state.json.${label}-${Date.now()}-${process.pid}.bak`);
}

// ---------------------------------------------------------------------------
// Lock helpers
// ---------------------------------------------------------------------------

async function acquireLock(lock: string): Promise<void> {
  for (let i = 0; i < LOCK_RETRIES; i++) {
    try {
      const fh = await open(lock, 'wx');
      await fh.close();
      return;
    } catch (err) {
      if (!isErrnoException(err) || err.code !== 'EEXIST') throw err;
      await sleep(LOCK_INTERVAL_MS);
    }
  }
  throw new Error(
    `state.mjs: could not acquire lock after ${LOCK_RETRIES} retries`,
  );
}

async function releaseLock(lock: string): Promise<void> {
  try {
    await unlink(lock);
  } catch {
    // best-effort; ignore ENOENT
  }
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !isErrnoException(error) || error.code !== 'ESRCH';
  }
}

async function acquireCursorTransitionLock(lock: string): Promise<void> {
  for (let attempt = 0; attempt < LOCK_RETRIES; attempt += 1) {
    let handle;
    try {
      handle = await open(lock, 'wx', 0o600);
      await handle.writeFile(String(process.pid), 'utf8');
      await handle.close();
      handle = undefined;
      return;
    } catch (error) {
      if (handle) {
        await handle.close();
        await unlink(lock).catch(() => undefined);
      }
      if (!isErrnoException(error) || error.code !== 'EEXIST') throw error;
      try {
        const ownerPid = Number(await readFile(lock, 'utf8'));
        if (
          Number.isSafeInteger(ownerPid) &&
          ownerPid > 0 &&
          !processIsAlive(ownerPid)
        ) {
          await unlink(lock);
          continue;
        }
      } catch (lockError) {
        if (!isErrnoException(lockError) || lockError.code !== 'ENOENT') {
          throw lockError;
        }
        continue;
      }
      await sleep(LOCK_INTERVAL_MS);
    }
  }
  throw new Error(
    `state.mjs: could not acquire Cursor transition lock after ${LOCK_RETRIES} retries`,
  );
}

async function withCursorTransitionLock<T>(
  transition: () => Promise<T>,
): Promise<T> {
  const dir = stateDir();
  await mkdir(dir, { recursive: true });
  const lock = cursorTransitionLockPath(dir);
  await acquireCursorTransitionLock(lock);
  try {
    return await transition();
  } finally {
    await releaseLock(lock);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Serialization / deserialization
// ---------------------------------------------------------------------------

function emptyState(): SessionObserverState {
  return { schemaVersion: SCHEMA_VERSION, sessions: {} };
}

/**
 * Write content to a backup file atomically (tmp → rename), with a unique name.
 * Called while holding the mutate lock, so no additional locking is needed.
 * @param {string} dir
 * @param {string} label — used in the backup filename (e.g. 'corrupt', 'v0')
 * @param {string} content — raw content to write
 */
async function writeBackup(
  dir: string,
  label: string,
  content: string,
): Promise<void> {
  const bak = bakPath(dir, label);
  const tmp = bak + '.tmp';
  let fh;
  try {
    fh = await open(tmp, 'w');
    await fh.write(content);
    await fh.datasync();
    await fh.close();
    fh = null;
    await rename(tmp, bak);
  } catch {
    // Backup is best-effort; ignore errors.
  } finally {
    if (fh) {
      try {
        await fh.close();
      } catch {
        /* ignore */
      }
    }
    try {
      await unlink(tmp);
    } catch {
      /* ignore ENOENT */
    }
  }
}

/**
 * Read and parse state, handling:
 *   - missing file → empty state (no backup needed)
 *   - corrupt JSON → back up (atomic, unique name), return empty
 *   - older schema (missing schemaVersion) → back up, migrate in-memory
 *
 * NOTE: caller MUST hold the lock before calling readState because corrupt JSON
 * and v0 migration reads can write backup files.
 */
async function readState(dir: string): Promise<SessionObserverState> {
  const file = statePath(dir);
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch (err) {
    if (isErrnoException(err) && err.code === 'ENOENT') return emptyState();
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Corrupt JSON — write backup atomically with a unique name, return empty.
    await writeBackup(dir, 'corrupt', raw);
    return emptyState();
  }

  return migrateIfNeeded(parsed, dir, raw);
}

/**
 * If the parsed state has no schemaVersion (v0), back up and upgrade in memory.
 * Migration backup is written here; persist-to-disk is handled by the caller.
 * mutate() writes the upgraded state; load() callers get the in-memory upgrade
 * but do not persist it because load() remains read-only for state.json itself.
 *
 * @param {object} parsed
 * @param {string} dir
 * @param {string} rawBackup
 * @returns {object}
 */
async function migrateIfNeeded(
  parsed: unknown,
  dir: string,
  rawBackup: string,
): Promise<SessionObserverState> {
  const state = parsed as Partial<SessionObserverState>;
  if (
    typeof state.schemaVersion === 'number' &&
    state.schemaVersion >= SCHEMA_VERSION
  ) {
    return state as SessionObserverState;
  }
  // v0 or unknown — write backup atomically, then return upgraded in-memory state.
  // The backup write is lock-safe when called from readState() inside mutate().
  await writeBackup(dir, 'v0', rawBackup ?? JSON.stringify(parsed));

  return {
    schemaVersion: SCHEMA_VERSION,
    sessions: state.sessions ?? {},
  };
}

/**
 * Write state atomically: write to tmp, fsync, rename.
 */
async function writeState(
  dir: string,
  state: SessionObserverState,
): Promise<void> {
  await mkdir(dir, { recursive: true });
  const tmp = tmpPath(dir);
  const dest = statePath(dir);
  let fh;
  try {
    fh = await open(tmp, 'w');
    await fh.write(JSON.stringify(state, null, 2));
    await fh.datasync(); // fsync data
    await fh.close();
    fh = null;
    await rename(tmp, dest);
  } finally {
    if (fh) {
      try {
        await fh.close();
      } catch {
        /* ignore */
      }
    }
    // Clean up tmp if rename failed
    try {
      await unlink(tmp);
    } catch {
      /* ignore ENOENT */
    }
  }
}

// ---------------------------------------------------------------------------
// Key helper
// ---------------------------------------------------------------------------

function sessionKey(runtime: Runtime, sessionId: string): string {
  return `${runtime}:${sessionId}`;
}

function isCursorCompatibilityEntry(
  entry: SessionStateEntry | undefined,
): entry is CursorCompatibilityEntry {
  return (
    entry?.runtime === 'cursor' &&
    entry.cursorCompatibility === CURSOR_COMPATIBILITY
  );
}

function zeroSession(entry: SessionStateEntry): SessionStateEntry {
  return {
    ...entry,
    lastRecordIndex: 0,
    lastTotalRecords: 0,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load and return the current state without any mutation.
 * Acquires the lock because reading can create corrupt/v0 backup files.
 */
async function loadLegacyState(): Promise<SessionObserverState> {
  const dir = stateDir();
  await mkdir(dir, { recursive: true });
  const lock = lockPath(dir);
  await acquireLock(lock);
  try {
    return await readState(dir);
  } finally {
    await releaseLock(lock);
  }
}

export type LegacyCursorMigrationBoundary =
  | 'marker-written'
  | 'backup-written'
  | 'legacy-removed'
  | 'marker-legacy-removed'
  | 'complete';

export interface LegacyCursorMigrationOptions {
  onBoundary?(boundary: LegacyCursorMigrationBoundary): void | Promise<void>;
}

export type CursorCompatibilityWriteBoundary =
  | 'prechecked'
  | 'legacy-written'
  | 'cursor-updated';

export interface CursorCompatibilityWriteOptions {
  onCompatibilityBoundary?(
    boundary: CursorCompatibilityWriteBoundary,
  ): void | Promise<void>;
}

async function notifyMigrationBoundary(
  options: LegacyCursorMigrationOptions,
  boundary: LegacyCursorMigrationBoundary,
): Promise<void> {
  await options.onBoundary?.(boundary);
}

function nextMigrationBackupPath(dir: string): string {
  migrationBackupSequence += 1;
  return join(
    dir,
    `state.json.cursor-legacy-${Date.now()}-${process.pid}-${migrationBackupSequence}.bak`,
  );
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function writeMigrationBackup(
  dir: string,
  destination: string,
  raw: string,
): Promise<void> {
  if (dirname(destination) !== dir) {
    throw new Error('LEGACY_BACKUP_PATH_INVALID');
  }
  if (await pathExists(destination)) return;

  const temporary = `${destination}.${process.pid}.tmp`;
  let handle;
  try {
    handle = await open(temporary, 'w', 0o600);
    await handle.writeFile(raw, 'utf8');
    await handle.datasync();
    await handle.close();
    handle = undefined;
    await rename(temporary, destination);
  } finally {
    if (handle) await handle.close();
    try {
      await unlink(temporary);
    } catch {
      // Best-effort cleanup; preserve the original write/rename result.
    }
  }
}

async function removeLegacyCursorForMigration(
  marker: LegacyCursorStateMarker,
  options: LegacyCursorMigrationOptions,
): Promise<void> {
  const dir = stateDir();
  if (dirname(marker.backupPath) !== dir) {
    throw new Error('LEGACY_BACKUP_PATH_INVALID');
  }

  await mkdir(dir, { recursive: true });
  const lock = lockPath(dir);
  await acquireLock(lock);
  try {
    const state = await readState(dir);
    const key = sessionKey('cursor', marker.sessionId);
    const entry = state.sessions[key];
    if (!entry) {
      if (!(await pathExists(marker.backupPath))) {
        throw new Error('LEGACY_BACKUP_MISSING');
      }
      return;
    }
    if (
      entry.runtime !== 'cursor' ||
      !Number.isSafeInteger(entry.lastRecordIndex) ||
      entry.lastRecordIndex < 0 ||
      entry.lastRecordIndex !== marker.legacyLastRecordIndex
    ) {
      throw new Error('LEGACY_CURSOR_CHANGED');
    }

    const raw = await readFile(statePath(dir), 'utf8');
    await writeMigrationBackup(dir, marker.backupPath, raw);
    await notifyMigrationBoundary(options, 'backup-written');

    delete state.sessions[key];
    await writeState(dir, state);
    await notifyMigrationBoundary(options, 'legacy-removed');
  } finally {
    await releaseLock(lock);
  }
}

/**
 * Move one legacy Cursor record-index entry into a durable, non-consumable v2
 * marker. Each store is independently locked and every cross-store boundary is
 * replay-safe, so interruption can be retried without trusting either offset.
 */
async function migrateLegacyCursorStateUnderTransition(
  sessionId: string,
  options: LegacyCursorMigrationOptions = {},
): Promise<LegacyCursorStateMarker | null> {
  const key = cursorSessionKey(sessionId);
  let cursorState = await loadCursorState();
  let marker = cursorState.legacyUnverified[key];

  if (!marker) {
    const legacy = await loadLegacyState();
    const entry = legacy.sessions[sessionKey('cursor', sessionId)];
    if (!entry) return null;
    if (isCursorCompatibilityEntry(entry)) return null;
    if (
      entry.runtime !== 'cursor' ||
      !Number.isSafeInteger(entry.lastRecordIndex) ||
      entry.lastRecordIndex < 0
    ) {
      throw new Error('LEGACY_CURSOR_INVALID');
    }

    const proposed: LegacyCursorStateMarker = {
      runtime: 'cursor',
      sessionId,
      legacyLastRecordIndex: entry.lastRecordIndex,
      ...(typeof entry.transcriptPath === 'string'
        ? { transcriptPath: entry.transcriptPath }
        : {}),
      ...(entry.recordedCwd === null || typeof entry.recordedCwd === 'string'
        ? { recordedCwd: entry.recordedCwd }
        : {}),
      ...(typeof entry.lastReadAt === 'string' &&
      Number.isFinite(Date.parse(entry.lastReadAt))
        ? { lastReadAt: entry.lastReadAt }
        : {}),
      backupPath: nextMigrationBackupPath(stateDir()),
      migrationStatus: 'marker-written',
      createdAt: new Date().toISOString(),
    };
    cursorState = await mutateCursorState((state) => {
      state.legacyUnverified[key] ??= proposed;
    });
    marker = cursorState.legacyUnverified[key];
    await notifyMigrationBoundary(options, 'marker-written');
  }

  await removeLegacyCursorForMigration(marker, options);

  cursorState = await mutateCursorState((state) => {
    const current = state.legacyUnverified[key];
    if (!current) throw new Error('LEGACY_CURSOR_MARKER_MISSING');
    if (current.migrationStatus === 'marker-written') {
      current.migrationStatus = 'legacy-removed';
    }
  });
  marker = cursorState.legacyUnverified[key];
  await notifyMigrationBoundary(options, 'marker-legacy-removed');

  cursorState = await mutateCursorState((state) => {
    const current = state.legacyUnverified[key];
    if (!current) throw new Error('LEGACY_CURSOR_MARKER_MISSING');
    if (current.migrationStatus !== 'complete') {
      current.migrationStatus = 'complete';
    }
  });
  marker = cursorState.legacyUnverified[key];
  await notifyMigrationBoundary(options, 'complete');
  return marker;
}

export async function migrateLegacyCursorState(
  sessionId: string,
  options: LegacyCursorMigrationOptions = {},
): Promise<LegacyCursorStateMarker | null> {
  return withCursorTransitionLock(() =>
    migrateLegacyCursorStateUnderTransition(sessionId, options),
  );
}

function cursorRecoveryEntry(
  marker: LegacyCursorStateMarker,
): SessionStateEntry {
  return {
    runtime: 'cursor',
    sessionId: marker.sessionId,
    lastRecordIndex: 0,
    lastTotalRecords: marker.legacyLastRecordIndex,
    recoveryRequired: true,
    recoveryCode: 'LEGACY_CURSOR_UNVERIFIED',
    legacyLastRecordIndex: marker.legacyLastRecordIndex,
    migrationStatus: marker.migrationStatus,
    backupPath: marker.backupPath,
    ...(marker.transcriptPath ? { transcriptPath: marker.transcriptPath } : {}),
    ...(marker.recordedCwd !== undefined
      ? { recordedCwd: marker.recordedCwd }
      : {}),
    ...(marker.lastReadAt ? { lastReadAt: marker.lastReadAt } : {}),
  };
}

/**
 * Load a display-compatible composition of legacy Claude/Codex state and the
 * isolated Cursor v2 store. Legacy Cursor entries are migrated before they can
 * be exposed as consumable offsets.
 */
export async function load(): Promise<SessionObserverState> {
  let legacy = await loadLegacyState();
  const legacyCursorIds = Object.values(legacy.sessions)
    .filter(
      (entry) =>
        entry.runtime === 'cursor' && !isCursorCompatibilityEntry(entry),
    )
    .map((entry) => entry.sessionId);
  for (const sessionId of legacyCursorIds) {
    await migrateLegacyCursorState(sessionId);
  }

  legacy = await loadLegacyState();
  const cursor = await loadCursorState();
  const sessions = { ...legacy.sessions };
  for (const entry of Object.values(cursor.sessions)) {
    sessions[cursorSessionKey(entry.sessionId)] = {
      runtime: 'cursor',
      sessionId: entry.sessionId,
      lastRecordIndex: entry.lastRecordIndex,
      lastTotalRecords: entry.lastRecordIndex,
      transcriptPath: entry.transcriptPath,
      recordedCwd: entry.canonicalCwd,
      indexBase: entry.indexBase,
      continuity: entry.continuity,
      lastStatus: entry.lastStatus,
      recoveryRequired: false,
    };
  }
  for (const marker of Object.values(cursor.legacyUnverified)) {
    sessions[cursorSessionKey(marker.sessionId)] = cursorRecoveryEntry(marker);
  }
  return { schemaVersion: SCHEMA_VERSION, sessions };
}

/**
 * Atomically apply fn(state) => state and persist the result.
 * Acquires the exclusive lock, reads, mutates, writes, releases.
 * All backup writes (corrupt/migration) happen inside this lock.
 * migrateIfNeeded upgrades are persisted via the normal writeState path.
 *
 * @param {(state: object) => object} fn
 */
export async function mutate(fn: StateMutator): Promise<SessionObserverState> {
  const dir = stateDir();
  await mkdir(dir, { recursive: true });
  const lock = lockPath(dir);
  await acquireLock(lock);
  try {
    const current = await readState(dir);
    const next = fn(current) ?? current;
    await writeState(dir, next);
    return next;
  } finally {
    await releaseLock(lock);
  }
}

/**
 * Return the SessionState for (runtime, sessionId), or null if not found.
 */
export async function getSession(
  runtime: Runtime,
  sessionId: string,
): Promise<SessionStateEntry | null> {
  if (runtime === 'cursor') {
    const legacy = await loadLegacyState();
    const compatibility = legacy.sessions[sessionKey(runtime, sessionId)];
    const cursor = await loadCursorState();
    if (cursor.sessions[cursorSessionKey(sessionId)]) {
      throw new Error(
        'CURSOR_STATE_V2_REQUIRES_OBSERVATION_PROJECTION: legacy record-index reads are disabled',
      );
    }
    const existingMarker = cursor.legacyUnverified[cursorSessionKey(sessionId)];
    if (existingMarker?.legacyLastRecordIndex !== undefined) {
      if (existingMarker.legacyLastRecordIndex === 0) return null;
      throw new Error(
        `LEGACY_CURSOR_UNVERIFIED: reset cursor:${sessionId} to replay from frame zero`,
      );
    }
    if (isCursorCompatibilityEntry(compatibility)) return compatibility;

    const marker = await migrateLegacyCursorState(sessionId);
    if (marker) {
      if (marker.legacyLastRecordIndex === 0) return null;
      throw new Error(
        `LEGACY_CURSOR_UNVERIFIED: reset cursor:${sessionId} to replay from frame zero`,
      );
    }
    return null;
  }
  const state = await loadLegacyState();
  const key = sessionKey(runtime, sessionId);
  return state.sessions[key] ?? null;
}

/**
 * Record the exclusive next unread zero-based JSONL record index for a session.
 * The field name is retained as lastRecordIndex for state-file compatibility.
 */
export async function markRead(
  runtime: Runtime,
  sessionId: string,
  {
    lastRecordIndex,
    lastTotalRecords,
    transcriptPath,
    recordedCwd,
  }: MarkReadInput,
  options: CursorCompatibilityWriteOptions = {},
): Promise<void> {
  if (runtime === 'cursor') {
    return withCursorTransitionLock(async () => {
      const key = cursorSessionKey(sessionId);
      const cursor = await loadCursorState();
      if (cursor.sessions[key]) {
        throw new Error(
          'CURSOR_STATE_V2_REQUIRED: legacy record-index Cursor writes are disabled',
        );
      }
      const marker = cursor.legacyUnverified[key];
      if (marker && marker.legacyLastRecordIndex !== 0) {
        throw new Error(
          `LEGACY_CURSOR_UNVERIFIED: reset cursor:${sessionId} to replay from frame zero`,
        );
      }
      await options.onCompatibilityBoundary?.('prechecked');

      const writeId = `${process.pid}:${Date.now()}:${++migrationBackupSequence}`;
      let preimage: SessionStateEntry | undefined;
      await mutate((state) => {
        const existing = state.sessions[key];
        preimage = existing ? structuredClone(existing) : undefined;
        state.sessions[key] = {
          ...existing,
          runtime,
          sessionId,
          lastRecordIndex,
          lastTotalRecords,
          lastReadAt: new Date().toISOString(),
          transcriptPath,
          recordedCwd,
          watchedByPid: existing?.watchedByPid ?? null,
          cursorCompatibility: CURSOR_COMPATIBILITY,
          cursorCompatibilityWriteId: writeId,
        };
      });
      await options.onCompatibilityBoundary?.('legacy-written');

      try {
        await mutateCursorState((state) => {
          if (state.sessions[key]) {
            throw new Error(
              'CURSOR_STATE_V2_REQUIRED: legacy record-index Cursor writes are disabled',
            );
          }
          const current = state.legacyUnverified[key];
          if (current && current.legacyLastRecordIndex !== 0) {
            throw new Error(
              `LEGACY_CURSOR_UNVERIFIED: reset cursor:${sessionId} to replay from frame zero`,
            );
          }
          delete state.legacyUnverified[key];
        });
      } catch (error) {
        let restored = false;
        await mutate((state) => {
          const current = state.sessions[key];
          if (
            isCursorCompatibilityEntry(current) &&
            current.cursorCompatibilityWriteId === writeId
          ) {
            if (preimage) state.sessions[key] = preimage;
            else delete state.sessions[key];
            restored = true;
          }
        });
        if (!restored) {
          throw new Error('CURSOR_COMPATIBILITY_ROLLBACK_CONFLICT', {
            cause: error,
          });
        }
        throw error;
      }
      await options.onCompatibilityBoundary?.('cursor-updated');
    });
  }
  const key = sessionKey(runtime, sessionId);
  await mutate((state) => {
    const existing = state.sessions[key] ?? {};
    state.sessions[key] = {
      ...existing,
      runtime,
      sessionId,
      lastRecordIndex,
      lastTotalRecords,
      lastReadAt: new Date().toISOString(),
      transcriptPath,
      recordedCwd,
      watchedByPid: existing.watchedByPid ?? null,
    };
    return state;
  });
}

/**
 * Set watcher ownership metadata for an existing session without changing
 * read offsets or lastReadAt. Returns true when the session existed.
 */
export async function setWatchedByPid(
  runtime: Runtime,
  sessionId: string,
  pid: number,
): Promise<boolean> {
  if (runtime === 'cursor') {
    const key = sessionKey(runtime, sessionId);
    let updated = false;
    await mutate((state) => {
      const existing = state.sessions[key];
      if (!isCursorCompatibilityEntry(existing)) return;
      state.sessions[key] = { ...existing, watchedByPid: pid };
      updated = true;
    });
    return updated;
  }
  const key = sessionKey(runtime, sessionId);
  let updated = false;
  await mutate((state) => {
    const existing = state.sessions[key];
    if (!existing) return state;
    state.sessions[key] = {
      ...existing,
      watchedByPid: pid,
    };
    updated = true;
    return state;
  });
  return updated;
}

/**
 * Clear watcher ownership metadata for an existing session without changing
 * read offsets or lastReadAt. If pid is provided, only clear matching owners.
 */
export async function clearWatchedByPid(
  runtime: Runtime,
  sessionId: string,
  pid?: number,
): Promise<boolean> {
  if (runtime === 'cursor') {
    const key = sessionKey(runtime, sessionId);
    let updated = false;
    await mutate((state) => {
      const existing = state.sessions[key];
      if (!isCursorCompatibilityEntry(existing)) return;
      if (pid !== undefined && existing.watchedByPid !== pid) return;
      state.sessions[key] = { ...existing, watchedByPid: null };
      updated = true;
    });
    return updated;
  }
  const key = sessionKey(runtime, sessionId);
  let updated = false;
  await mutate((state) => {
    const existing = state.sessions[key];
    if (!existing) return state;
    if (pid !== undefined && existing.watchedByPid !== pid) return state;
    state.sessions[key] = {
      ...existing,
      watchedByPid: null,
    };
    updated = true;
    return state;
  });
  return updated;
}

/**
 * Zero all entries for a given runtime. Returns the count of entries zeroed.
 */
export async function resetByRuntime(runtime: Runtime): Promise<number> {
  if (runtime === 'cursor') {
    return withCursorTransitionLock(async () => {
      const sessionIds = new Set<string>();
      try {
        const cursor = await loadCursorState();
        for (const entry of Object.values(cursor.sessions)) {
          sessionIds.add(entry.sessionId);
        }
        for (const marker of Object.values(cursor.legacyUnverified)) {
          sessionIds.add(marker.sessionId);
        }
      } catch (error) {
        if (!(error instanceof CursorStateRecoveryRequiredError)) throw error;
      }
      await mutate((state) => {
        for (const [key, entry] of Object.entries(state.sessions)) {
          if (entry.runtime === 'cursor') {
            delete state.sessions[key];
            sessionIds.add(entry.sessionId);
          }
        }
      });
      await resetAllCursorState();
      return sessionIds.size;
    });
  }
  let count = 0;
  await mutate((state) => {
    for (const [key, entry] of Object.entries(state.sessions)) {
      if (entry.runtime === runtime) {
        state.sessions[key] = zeroSession(entry);
        count++;
      }
    }
    return state;
  });
  return count;
}

/**
 * Zero a single session entry identified by (runtime, sessionId).
 */
export async function resetBySession(
  runtime: Runtime,
  sessionId: string,
): Promise<void> {
  if (runtime === 'cursor') {
    return withCursorTransitionLock(async () => {
      await resetCursorSessionState(sessionId);
      const key = sessionKey(runtime, sessionId);
      await mutate((state) => {
        delete state.sessions[key];
      });
    });
  }
  const key = sessionKey(runtime, sessionId);
  await mutate((state) => {
    if (state.sessions[key]) {
      state.sessions[key] = zeroSession(state.sessions[key]);
    }
    return state;
  });
}

/**
 * Empty the sessions map while preserving schemaVersion.
 */
export async function clear(): Promise<void> {
  await withCursorTransitionLock(async () => {
    await clearCursorState();
    await mutate((state) => {
      state.sessions = {};
      return state;
    });
  });
}
