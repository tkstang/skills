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

import { open, rename, mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCHEMA_VERSION = 1;
const LOCK_RETRIES = 100;
const LOCK_INTERVAL_MS = 50;

// ---------------------------------------------------------------------------
// State dir resolution
// ---------------------------------------------------------------------------

function stateDir() {
  return process.env.STATE_DIR ?? join(homedir(), '.local', 'state', 'session-observer');
}

function statePath(dir) {
  return join(dir, 'state.json');
}

function lockPath(dir) {
  return join(dir, 'state.json.lock');
}

function tmpPath(dir) {
  return join(dir, `state.json.${process.pid}.tmp`);
}

/**
 * Generate a unique backup path using timestamp + pid.
 * @param {string} dir
 * @param {string} label  — e.g. 'corrupt' or 'v0'
 * @returns {string}
 */
function bakPath(dir, label) {
  return join(dir, `state.json.${label}-${Date.now()}-${process.pid}.bak`);
}

// ---------------------------------------------------------------------------
// Lock helpers
// ---------------------------------------------------------------------------

async function acquireLock(lock) {
  for (let i = 0; i < LOCK_RETRIES; i++) {
    try {
      const fh = await open(lock, 'wx');
      await fh.close();
      return;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      await sleep(LOCK_INTERVAL_MS);
    }
  }
  throw new Error(`state.mjs: could not acquire lock after ${LOCK_RETRIES} retries`);
}

async function releaseLock(lock) {
  try {
    await unlink(lock);
  } catch {
    // best-effort; ignore ENOENT
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Serialization / deserialization
// ---------------------------------------------------------------------------

function emptyState() {
  return { schemaVersion: SCHEMA_VERSION, sessions: {} };
}

/**
 * Write content to a backup file atomically (tmp → rename), with a unique name.
 * Called while holding the mutate lock, so no additional locking is needed.
 * @param {string} dir
 * @param {string} label — used in the backup filename (e.g. 'corrupt', 'v0')
 * @param {string} content — raw content to write
 */
async function writeBackup(dir, label, content) {
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
      try { await fh.close(); } catch { /* ignore */ }
    }
    try { await unlink(tmp); } catch { /* ignore ENOENT */ }
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
async function readState(dir) {
  const file = statePath(dir);
  let raw;
  try {
    raw = await readFile(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return emptyState();
    throw err;
  }

  let parsed;
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
async function migrateIfNeeded(parsed, dir, rawBackup) {
  if (typeof parsed.schemaVersion === 'number' && parsed.schemaVersion >= SCHEMA_VERSION) {
    return parsed;
  }
  // v0 or unknown — write backup atomically, then return upgraded in-memory state.
  // The backup write is lock-safe when called from readState() inside mutate().
  await writeBackup(dir, 'v0', rawBackup ?? JSON.stringify(parsed));

  return {
    schemaVersion: SCHEMA_VERSION,
    sessions: parsed.sessions ?? {},
  };
}

/**
 * Write state atomically: write to tmp, fsync, rename.
 */
async function writeState(dir, state) {
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
      try { await fh.close(); } catch { /* ignore */ }
    }
    // Clean up tmp if rename failed
    try { await unlink(tmp); } catch { /* ignore ENOENT */ }
  }
}

// ---------------------------------------------------------------------------
// Key helper
// ---------------------------------------------------------------------------

function sessionKey(runtime, sessionId) {
  return `${runtime}:${sessionId}`;
}

function zeroSession(entry) {
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
export async function load() {
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
export async function mutate(fn) {
  const dir = stateDir();
  await mkdir(dir, { recursive: true });
  const lock = lockPath(dir);
  await acquireLock(lock);
  try {
    const current = await readState(dir);
    const next = fn(current);
    await writeState(dir, next);
    return next;
  } finally {
    await releaseLock(lock);
  }
}

/**
 * Return the SessionState for (runtime, sessionId), or null if not found.
 */
export async function getSession(runtime, sessionId) {
  const state = await load();
  const key = sessionKey(runtime, sessionId);
  return state.sessions[key] ?? null;
}

/**
 * Record the exclusive next unread zero-based JSONL record index for a session.
 * The field name is retained as lastRecordIndex for state-file compatibility.
 */
export async function markRead(runtime, sessionId, { lastRecordIndex, lastTotalRecords, transcriptPath, recordedCwd }) {
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
export async function setWatchedByPid(runtime, sessionId, pid) {
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
export async function clearWatchedByPid(runtime, sessionId, pid) {
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
export async function resetByRuntime(runtime) {
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
export async function resetBySession(runtime, sessionId) {
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
export async function clear() {
  await mutate((state) => {
    state.sessions = {};
    return state;
  });
}
