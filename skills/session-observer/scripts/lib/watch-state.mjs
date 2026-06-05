/**
 * watch-state.mjs — Atomic, lock-protected persistence for watch mode metadata.
 *
 * Storage:
 *   STATE_DIR/watch.json          (default: ~/.local/state/session-observer/watch.json)
 *   STATE_DIR/watch.json.lock
 *   STATE_DIR/watch.control.json
 */

import { open, rename, mkdir, readFile, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SCHEMA_VERSION = 1;
const LOCK_RETRIES = 100;
const LOCK_INTERVAL_MS = 50;
const CONTROL_DIRECTIVES = new Set(['flush', 'pause', 'resume', 'stop']);

function stateDir() {
  return process.env.STATE_DIR ?? join(homedir(), '.local', 'state', 'session-observer');
}

function watchPath(dir) {
  return join(dir, 'watch.json');
}

function lockPath(dir) {
  return join(dir, 'watch.json.lock');
}

function controlPath(dir) {
  return join(dir, 'watch.control.json');
}

function tmpPath(dir, basename) {
  return join(dir, `${basename}.${process.pid}.${Date.now()}.tmp`);
}

function emptyWatchState() {
  return { schemaVersion: SCHEMA_VERSION, active: null };
}

function toIsoTimestamp(value) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  throw new Error(`watch-state.mjs: could not acquire lock after ${LOCK_RETRIES} retries`);
}

async function releaseLock(lock) {
  try {
    await unlink(lock);
  } catch {
    // best-effort; ignore ENOENT
  }
}

async function readWatchState(dir) {
  let raw;
  try {
    raw = await readFile(watchPath(dir), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return emptyWatchState();
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyWatchState();
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    active: parsed.active ?? null,
  };
}

async function writeJsonAtomic(dir, basename, payload) {
  await mkdir(dir, { recursive: true });
  const tmp = tmpPath(dir, basename);
  const dest = join(dir, basename);
  let fh;
  try {
    fh = await open(tmp, 'w');
    await fh.write(JSON.stringify(payload, null, 2));
    await fh.datasync();
    await fh.close();
    fh = null;
    await rename(tmp, dest);
  } finally {
    if (fh) {
      try { await fh.close(); } catch { /* ignore */ }
    }
    try { await unlink(tmp); } catch { /* ignore ENOENT */ }
  }
}

async function writeWatchState(dir, state) {
  await writeJsonAtomic(dir, 'watch.json', state);
}

function isPidLive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if (err.code === 'ESRCH') return false;
    if (err.code === 'EPERM') return true;
    throw err;
  }
}

function clearStaleActive(state) {
  if (!state.active) return false;
  if (isPidLive(state.active.pid)) return false;
  state.active = null;
  return true;
}

async function mutateWatchState(fn) {
  const dir = stateDir();
  await mkdir(dir, { recursive: true });
  const lock = lockPath(dir);
  await acquireLock(lock);
  try {
    const state = await readWatchState(dir);
    const result = await fn(state);
    await writeWatchState(dir, state);
    return result ?? state;
  } finally {
    await releaseLock(lock);
  }
}

export async function loadWatchState() {
  const dir = stateDir();
  await mkdir(dir, { recursive: true });
  const lock = lockPath(dir);
  await acquireLock(lock);
  try {
    const state = await readWatchState(dir);
    if (clearStaleActive(state)) {
      await writeWatchState(dir, state);
    }
    return state;
  } finally {
    await releaseLock(lock);
  }
}

export async function startWatcher({
  runtime,
  cwd,
  pid = process.pid,
  startedAt,
  session = null,
  pollSec = null,
  debounceSec = null,
  maxPendingSec = null,
  staleAfterSec = null,
} = {}) {
  if (!runtime) throw new Error('runtime is required to start a watcher');
  if (!cwd) throw new Error('cwd is required to start a watcher');

  return mutateWatchState((state) => {
    if (state.active && isPidLive(state.active.pid)) {
      throw new Error(
        `watcher already active for ${state.active.runtime} at ${state.active.cwd} (pid ${state.active.pid})`
      );
    }

    const active = {
      pid,
      runtime,
      requestedRuntime: runtime,
      cwd,
      session,
      startedAt: toIsoTimestamp(startedAt),
      pollSec,
      debounceSec,
      maxPendingSec,
      staleAfterSec,
      lastPollAt: null,
      lastEventAt: null,
      eventCount: 0,
      resolvedRuntime: null,
      sessionId: null,
      transcriptPath: null,
      targets: [],
      lastError: null,
    };
    state.active = active;
    return active;
  });
}

export async function clearWatcher({ pid } = {}) {
  return mutateWatchState((state) => {
    if (!state.active) return false;
    if (pid !== undefined && state.active.pid !== pid) return false;
    state.active = null;
    return true;
  });
}

export async function recordWatcherEvent({ pid, lastEventAt } = {}) {
  return mutateWatchState((state) => {
    if (!state.active) return null;
    if (pid !== undefined && state.active.pid !== pid) return null;
    state.active = {
      ...state.active,
      lastEventAt: toIsoTimestamp(lastEventAt),
      eventCount: (state.active.eventCount ?? 0) + 1,
    };
    return state.active;
  });
}

export async function recordWatcherPoll({ pid, lastPollAt } = {}) {
  return mutateWatchState((state) => {
    if (!state.active) return null;
    if (pid !== undefined && state.active.pid !== pid) return null;
    state.active = {
      ...state.active,
      lastPollAt: toIsoTimestamp(lastPollAt),
    };
    return state.active;
  });
}

export async function recordWatcherTarget({ pid, target } = {}) {
  if (!target?.runtime || !target?.sessionId || !target?.transcriptPath) {
    throw new Error('runtime, sessionId, and transcriptPath are required to record a watcher target');
  }

  return mutateWatchState((state) => {
    if (!state.active) return null;
    if (pid !== undefined && state.active.pid !== pid) return null;
    const targets = Array.isArray(state.active.targets) ? [...state.active.targets] : [];
    const key = `${target.runtime}:${target.sessionId}`;
    const existingIndex = targets.findIndex(existing => existing.key === key);
    const targetRecord = {
      key,
      runtime: target.runtime,
      sessionId: target.sessionId,
      transcriptPath: target.transcriptPath,
      cwd: target.recordedCwd ?? null,
      recordCount: target.recordCount ?? null,
      baselineRecordIndex: target.baselineRecordIndex ?? null,
      engagementStatus: target.engagementStatus ?? null,
      lockedAt: target.lockedAt ?? toIsoTimestamp(),
    };

    if (existingIndex === -1) targets.push(targetRecord);
    else targets[existingIndex] = { ...targets[existingIndex], ...targetRecord };

    state.active = {
      ...state.active,
      targets,
      resolvedRuntime: targets.length === 1 ? targets[0].runtime : state.active.resolvedRuntime,
      sessionId: targets.length === 1 ? targets[0].sessionId : state.active.sessionId,
      transcriptPath: targets.length === 1 ? targets[0].transcriptPath : state.active.transcriptPath,
    };
    return state.active;
  });
}

export async function recordWatcherError({ pid, error, at } = {}) {
  return mutateWatchState((state) => {
    if (!state.active) return null;
    if (pid !== undefined && state.active.pid !== pid) return null;
    state.active = {
      ...state.active,
      lastError: {
        at: toIsoTimestamp(at),
        message: error?.message ? String(error.message) : String(error ?? 'unknown error'),
      },
    };
    return state.active;
  });
}

export async function writeControlDirective(directive, { issuedAt } = {}) {
  if (!CONTROL_DIRECTIVES.has(directive)) {
    throw new Error(`unknown watch control directive: ${directive}`);
  }
  const dir = stateDir();
  const payload = { directive, issuedAt: toIsoTimestamp(issuedAt) };
  await writeJsonAtomic(dir, 'watch.control.json', payload);
  return payload;
}

export async function readControlDirective() {
  const dir = stateDir();
  try {
    return JSON.parse(await readFile(controlPath(dir), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function clearControlDirective() {
  const dir = stateDir();
  try {
    await unlink(controlPath(dir));
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}
