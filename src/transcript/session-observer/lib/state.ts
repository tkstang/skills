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

import { open, rename, mkdir, readFile, stat, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { Runtime } from '../../core/runtimes.js';
import type {
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
// A healthy acquire+mutate+release cycle never holds the lock this long, so a
// lock older than the entire retry window cannot belong to a live writer.
const LOCK_STALE_MS = LOCK_RETRIES * LOCK_INTERVAL_MS;

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

// Mirrors watch-state.ts's isPidLive. Duplicated deliberately: state.ts and
// watch-state.ts are separate build-generated bundles (scripts/build-generated.mjs),
// and extracting a shared lock helper would require new bundle mappings and
// cascading import-rewrite config for both — the plan this module implements
// prefers this explicit duplication over that churn.
function isPidLive(pid: unknown): boolean {
  if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0)
    return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if (isErrnoException(err) && err.code === 'ESRCH') return false;
    if (isErrnoException(err) && err.code === 'EPERM') return true;
    throw err;
  }
}

/**
 * Decide whether an existing lock file is stale enough to reclaim.
 *
 * A parseable, recorded PID is trusted unconditionally: dead means abandoned
 * (reclaim); live means someone still legitimately owns it, and that is
 * never aged out — even an unusually slow writer (fs stall, GC pause,
 * suspended process) must never have its lock stolen. Only when we cannot
 * establish an owner identity at all (empty/garbage/unreadable content) do
 * we fall back to age: a lock that old with no readable owner cannot belong
 * to a healthy writer (a normal acquire+mutate+release cycle finishes in
 * milliseconds), so it is treated as abandoned.
 */
async function isLockStale(lock: string): Promise<boolean> {
  let pid: number | null = null;
  try {
    const raw = (await readFile(lock, 'utf8')).trim();
    const parsed = Number.parseInt(raw, 10);
    if (Number.isInteger(parsed) && parsed > 0) pid = parsed;
  } catch {
    // Unreadable (including ENOENT — the owner may have just released it) —
    // fall through to the age check below.
  }
  if (pid !== null) return !isPidLive(pid);

  try {
    const st = await stat(lock);
    return Date.now() - st.mtimeMs > LOCK_STALE_MS;
  } catch {
    // Lock disappeared between the read above and this stat — nothing left
    // to reclaim; the caller's next open('wx') resolves the race on its own.
    return false;
  }
}

/**
 * Exclusively claim a lock file already judged stale, for removal.
 *
 * A plain `unlink(lock)` is not itself exclusive: it operates on whatever
 * currently occupies the path, not the specific stale instance a caller
 * observed. If two contenders both judge the same stale lock L reclaimable,
 * both calling unlink(lock) unconditionally, the following interleaving lets
 * both end up believing they hold the lock:
 *   1. A unlinks L, then wins open('wx') and creates its own live lock.
 *   2. B's (already-decided) unlink call fires next and deletes A's new
 *      lock — unlink does not check what it is deleting.
 *   3. B wins its own open('wx'). A and B now both think they own the lock.
 *
 * `rename(lock, <unique>)` closes this: rename requires its source to
 * exist, so at most one contender's rename can ever succeed against a given
 * stale instance — the loser gets ENOENT and backs off instead of deleting
 * whatever now occupies the path. Returns true only for the contender that
 * actually detached the stale file.
 */
async function tryReclaim(lock: string): Promise<boolean> {
  const claim = `${lock}.reclaim.${process.pid}.${Date.now()}`;
  try {
    await rename(lock, claim);
  } catch (err) {
    // ENOENT: another contender already claimed it, or the owner released
    // it normally — either way, we reclaimed nothing.
    if (isErrnoException(err) && err.code === 'ENOENT') return false;
    throw err;
  }
  try {
    await unlink(claim);
  } catch {
    // Best-effort cleanup of our claimed copy; the exclusive removal from
    // the original path (via rename) already happened regardless.
  }
  return true;
}

async function acquireLock(lock: string): Promise<void> {
  // Reclaim at most once per acquisition attempt: on EEXIST, a stale lock is
  // exclusively claimed (see tryReclaim) and open('wx') is retried
  // immediately. If the claim loses the race, this attempt does not retry
  // reclaim again — it falls back to the normal sleep/retry path.
  let reclaimAttempted = false;
  for (let i = 0; i < LOCK_RETRIES; i++) {
    try {
      const fh = await open(lock, 'wx');
      await fh.write(String(process.pid));
      await fh.close();
      return;
    } catch (err) {
      if (!isErrnoException(err) || err.code !== 'EEXIST') throw err;
      if (!reclaimAttempted) {
        reclaimAttempted = true;
        if ((await isLockStale(lock)) && (await tryReclaim(lock))) {
          continue;
        }
      }
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
export async function load(): Promise<SessionObserverState> {
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
  const state = await load();
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
  { lastRecordIndex, lastTotalRecords, transcriptPath, recordedCwd }: MarkReadInput,
): Promise<void> {
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
  await mutate((state) => {
    state.sessions = {};
    return state;
  });
}
