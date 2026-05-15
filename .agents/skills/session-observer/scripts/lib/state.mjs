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
 */

import { open, rename, mkdir, readFile, writeFile, access, unlink } from 'node:fs/promises';
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
 * Read and parse state, handling:
 *   - missing file → empty state
 *   - corrupt JSON → back up to state.json.corrupt-<ts>.bak, return empty
 *   - older schema (missing schemaVersion) → back up to state.v0.json.bak, migrate
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
    // Corrupt JSON — back up and return empty
    const bakPath = join(dir, `state.json.corrupt-${Date.now()}.bak`);
    await writeFile(bakPath, raw, 'utf8');
    return emptyState();
  }

  return migrateIfNeeded(parsed, dir, raw);
}

/**
 * If the parsed state has no schemaVersion (v0), back up and upgrade.
 */
async function migrateIfNeeded(parsed, dir, rawBackup) {
  if (typeof parsed.schemaVersion === 'number' && parsed.schemaVersion >= SCHEMA_VERSION) {
    return parsed;
  }
  // v0 or unknown — write backup then upgrade
  const bakPath = join(dir, 'state.v0.json.bak');
  await writeFile(bakPath, rawBackup ?? JSON.stringify(parsed), 'utf8');

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
 * Does NOT acquire the lock (read-only path).
 */
export async function load() {
  const dir = stateDir();
  return readState(dir);
}

/**
 * Atomically apply fn(state) => state and persist the result.
 * Acquires the exclusive lock, reads, mutates, writes, releases.
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
 * Record that we have read up to lastRecordIndex in the given session.
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
