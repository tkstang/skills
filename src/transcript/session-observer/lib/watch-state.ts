/**
 * watch-state.mjs — Atomic, lock-protected persistence for watch mode metadata.
 *
 * Storage:
 *   STATE_DIR/watch.json                (default: ~/.local/state/session-observer/watch.json)
 *   STATE_DIR/watch.json.lock
 *   STATE_DIR/watch.control.<pid>.json  (pid-targeted control directives)
 *   STATE_DIR/watch.control.json        (legacy pid-less directives, still honored)
 */

import {
  open,
  rename,
  mkdir,
  readdir,
  readFile,
  unlink,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Version 1 covers both the legacy single-`active` shape and the current
// `watchers[]` shape: readWatchState lifts a lone `active` into `watchers`,
// and `active` is maintained as a mirror of `watchers[0]` for old readers.
const SCHEMA_VERSION = 1;
const LOCK_RETRIES = 100;
const LOCK_INTERVAL_MS = 50;
const CONTROL_DIRECTIVES = new Set(['flush', 'pause', 'resume', 'stop']);

function stateDir(): any {
  return (
    process.env.STATE_DIR ??
    join(homedir(), '.local', 'state', 'session-observer')
  );
}

function watchPath(dir: any): any {
  return join(dir, 'watch.json');
}

function lockPath(dir: any): any {
  return join(dir, 'watch.json.lock');
}

function controlPath(dir: any, pid: any = undefined): any {
  return pid === undefined
    ? join(dir, 'watch.control.json')
    : join(dir, `watch.control.${pid}.json`);
}

const PID_CONTROL_FILE_RE = /^watch\.control\.(\d+)\.json$/;

function tmpPath(dir: any, basename: any): any {
  return join(dir, `${basename}.${process.pid}.${Date.now()}.tmp`);
}

function emptyWatchState(): any {
  return { schemaVersion: SCHEMA_VERSION, active: null, watchers: [] };
}

function toIsoTimestamp(value: any = undefined): any {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function sleep(ms: any): any {
  return new Promise((resolve: any): any => setTimeout(resolve, ms));
}

async function acquireLock(lock: any): Promise<any> {
  for (let i = 0; i < LOCK_RETRIES; i++) {
    try {
      const fh = await open(lock, 'wx');
      await fh.close();
      return;
    } catch (err: any) {
      if (err.code !== 'EEXIST') throw err;
      await sleep(LOCK_INTERVAL_MS);
    }
  }
  throw new Error(
    `watch-state.mjs: could not acquire lock after ${LOCK_RETRIES} retries`,
  );
}

async function releaseLock(lock: any): Promise<any> {
  try {
    await unlink(lock);
  } catch {
    // best-effort; ignore ENOENT
  }
}

async function readWatchState(dir: any): Promise<any> {
  let raw;
  try {
    raw = await readFile(watchPath(dir), 'utf8');
  } catch (err: any) {
    if (err.code === 'ENOENT') return emptyWatchState();
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyWatchState();
  }

  const watchers = Array.isArray(parsed.watchers)
    ? parsed.watchers.filter(Boolean)
    : parsed.active
      ? [parsed.active]
      : [];

  return {
    schemaVersion: SCHEMA_VERSION,
    active: watchers[0] ?? parsed.active ?? null,
    watchers,
  };
}

async function writeJsonAtomic(
  dir: any,
  basename: any,
  payload: any,
): Promise<any> {
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

async function writeWatchState(dir: any, state: any): Promise<any> {
  await writeJsonAtomic(dir, 'watch.json', state);
}

function isPidLive(pid: any): any {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: any) {
    if (err.code === 'ESRCH') return false;
    if (err.code === 'EPERM') return true;
    throw err;
  }
}

function syncPrimaryActive(state: any): any {
  state.watchers = Array.isArray(state.watchers)
    ? state.watchers.filter(Boolean)
    : [];
  state.active = state.watchers[0] ?? null;
}

function clearStaleWatchers(state: any): any {
  const before = JSON.stringify({
    active: state.active ?? null,
    watchers: state.watchers ?? [],
  });
  const watchers = Array.isArray(state.watchers)
    ? state.watchers
    : state.active
      ? [state.active]
      : [];
  state.watchers = watchers.filter((watcher: any): any =>
    isPidLive(watcher.pid),
  );
  syncPrimaryActive(state);
  const after = JSON.stringify({
    active: state.active ?? null,
    watchers: state.watchers ?? [],
  });
  return before !== after;
}

async function mutateWatchState(fn: any): Promise<any> {
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

export async function loadWatchState(): Promise<any> {
  const dir = stateDir();
  await mkdir(dir, { recursive: true });
  const lock = lockPath(dir);
  await acquireLock(lock);
  try {
    const state = await readWatchState(dir);
    if (clearStaleWatchers(state)) {
      await writeWatchState(dir, state);
    }
    await clearStaleControlDirectives().catch((): any => 0);
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
  heartbeatSec = null,
  staleAfterSec = null,
}: any = {}): Promise<any> {
  if (!runtime) throw new Error('runtime is required to start a watcher');
  if (!cwd) throw new Error('cwd is required to start a watcher');

  return mutateWatchState((state: any): any => {
    clearStaleWatchers(state);
    const existingForPid = state.watchers.find(
      (watcher: any): any => watcher.pid === pid && isPidLive(watcher.pid),
    );
    if (existingForPid) {
      throw new Error(
        `watcher already active for ${existingForPid.runtime} at ${existingForPid.cwd} (pid ${existingForPid.pid})`,
      );
    }

    const active: any = {
      pid,
      runtime,
      requestedRuntime: runtime,
      cwd,
      session,
      startedAt: toIsoTimestamp(startedAt),
      pollSec,
      debounceSec,
      maxPendingSec,
      heartbeatSec,
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
    state.watchers.push(active);
    syncPrimaryActive(state);
    return active;
  });
}

export async function clearWatcher({ pid }: any = {}): Promise<any> {
  return mutateWatchState((state: any): any => {
    clearStaleWatchers(state);
    const beforeCount = state.watchers.length;
    state.watchers =
      pid === undefined
        ? []
        : state.watchers.filter((watcher: any): any => watcher.pid !== pid);
    syncPrimaryActive(state);
    return state.watchers.length !== beforeCount;
  });
}

function mutateWatcherByPid(state: any, pid: any, update: any): any {
  clearStaleWatchers(state);
  const index = state.watchers.findIndex(
    (watcher: any): any => pid === undefined || watcher.pid === pid,
  );
  if (index === -1) return null;
  const updated = update(state.watchers[index]);
  state.watchers[index] = updated;
  syncPrimaryActive(state);
  return updated;
}

export async function recordWatcherEvent({
  pid,
  lastEventAt,
}: any = {}): Promise<any> {
  return mutateWatchState((state: any): any => {
    return mutateWatcherByPid(state, pid, (watcher: any): any => ({
      ...watcher,
      lastEventAt: toIsoTimestamp(lastEventAt),
      eventCount: (watcher.eventCount ?? 0) + 1,
    }));
  });
}

export async function recordWatcherPoll({
  pid,
  lastPollAt,
}: any = {}): Promise<any> {
  return mutateWatchState((state: any): any => {
    return mutateWatcherByPid(state, pid, (watcher: any): any => ({
      ...watcher,
      lastPollAt: toIsoTimestamp(lastPollAt),
    }));
  });
}

function watcherHasTarget(watcher: any, key: any): any {
  const targets = Array.isArray(watcher.targets) ? watcher.targets : [];
  if (targets.length > 0) {
    return targets.some(
      (target: any): any =>
        (target.key ?? `${target.runtime}:${target.sessionId}`) === key,
    );
  }
  // Legacy single-`active` records lifted into watchers[] carry the resolved
  // target at the top level instead of in targets[].
  if (!watcher.sessionId) return false;
  return (
    `${watcher.resolvedRuntime ?? watcher.runtime}:${watcher.sessionId}` === key
  );
}

export async function recordWatcherTarget({
  pid,
  target,
}: any = {}): Promise<any> {
  if (!target?.runtime || !target?.sessionId || !target?.transcriptPath) {
    throw new Error(
      'runtime, sessionId, and transcriptPath are required to record a watcher target',
    );
  }

  return mutateWatchState((state: any): any => {
    // Authoritative duplicate-target gate: the pre-check in watch.mjs runs
    // outside this lock, so two watchers starting concurrently can both pass
    // it before either has recorded its target. Re-check under the lock.
    clearStaleWatchers(state);
    const acquireKey = `${target.runtime}:${target.sessionId}`;
    const conflict = state.watchers.find(
      (watcher: any): any =>
        watcher.pid !== pid && watcherHasTarget(watcher, acquireKey),
    );
    if (conflict) {
      const err: any = new Error(
        `watcher pid ${conflict.pid} is already watching ${acquireKey}`,
      );
      err.code = 'DUPLICATE_WATCH_TARGET';
      err.conflictPid = conflict.pid;
      throw err;
    }

    return mutateWatcherByPid(state, pid, (watcher: any): any => {
      const targets = Array.isArray(watcher.targets)
        ? [...watcher.targets]
        : [];
      const key = `${target.runtime}:${target.sessionId}`;
      const existingIndex = targets.findIndex(
        (existing: any): any => existing.key === key,
      );
      const targetRecord: any = {
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
      else
        targets[existingIndex] = { ...targets[existingIndex], ...targetRecord };

      return {
        ...watcher,
        targets,
        resolvedRuntime:
          targets.length === 1 ? targets[0].runtime : watcher.resolvedRuntime,
        sessionId:
          targets.length === 1 ? targets[0].sessionId : watcher.sessionId,
        transcriptPath:
          targets.length === 1
            ? targets[0].transcriptPath
            : watcher.transcriptPath,
      };
    });
  });
}

/**
 * Find a live watcher (other than excludePid) that has already locked onto the
 * given target session. Used to refuse duplicate watchers that would otherwise
 * race over the shared per-session read offset.
 */
export async function findLiveWatcherForTarget({
  runtime,
  sessionId,
  excludePid,
}: any = {}): Promise<any> {
  if (!runtime || !sessionId) return null;
  const state = await loadWatchState();
  const key = `${runtime}:${sessionId}`;
  return (
    state.watchers.find(
      (watcher: any): any =>
        watcher.pid !== excludePid && watcherHasTarget(watcher, key),
    ) ?? null
  );
}

export async function recordWatcherError({
  pid,
  error,
  at,
}: any = {}): Promise<any> {
  return mutateWatchState((state: any): any => {
    return mutateWatcherByPid(state, pid, (watcher: any): any => ({
      ...watcher,
      lastError: {
        at: toIsoTimestamp(at),
        message: error?.message
          ? String(error.message)
          : String(error ?? 'unknown error'),
      },
    }));
  });
}

async function readControlFile(path: any): Promise<any> {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (err: any) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function unlinkIfExists(path: any): Promise<any> {
  try {
    await unlink(path);
    return true;
  } catch (err: any) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

/**
 * Pid-targeted directives get their own file (watch.control.<pid>.json) so
 * controls aimed at different watchers cannot overwrite each other within one
 * poll interval. Pid-less directives use the legacy watch.control.json.
 */
export async function writeControlDirective(
  directive: any,
  { issuedAt, pid }: any = {},
): Promise<any> {
  if (!CONTROL_DIRECTIVES.has(directive)) {
    throw new Error(`unknown watch control directive: ${directive}`);
  }
  const dir = stateDir();
  const payload: any = { directive, issuedAt: toIsoTimestamp(issuedAt) };
  if (pid !== undefined) payload.pid = pid;
  const basename =
    pid === undefined ? 'watch.control.json' : `watch.control.${pid}.json`;
  await writeJsonAtomic(dir, basename, payload);
  return payload;
}

export async function readControlDirective({ pid }: any = {}): Promise<any> {
  const dir = stateDir();
  if (pid !== undefined) {
    const own = await readControlFile(controlPath(dir, pid));
    if (own) return own;
  }
  return readControlFile(controlPath(dir));
}

export async function clearControlDirective({ pid }: any = {}): Promise<any> {
  const dir = stateDir();
  if (pid === undefined) {
    return unlinkIfExists(controlPath(dir));
  }

  let cleared = await unlinkIfExists(controlPath(dir, pid));
  const legacy = await readControlFile(controlPath(dir));
  if (legacy && (legacy.pid === undefined || legacy.pid === pid)) {
    cleared = (await unlinkIfExists(controlPath(dir))) || cleared;
  }
  return cleared;
}

/**
 * Remove control directives addressed to pids that are no longer alive, so a
 * directive written for a watcher that died before consuming it cannot linger.
 */
export async function clearStaleControlDirectives(): Promise<any> {
  const dir = stateDir();
  let entries;
  try {
    entries = await readdir(dir);
  } catch (err: any) {
    if (err.code === 'ENOENT') return 0;
    throw err;
  }

  let cleared = 0;
  for (const entry of entries) {
    const match = PID_CONTROL_FILE_RE.exec(entry);
    if (match) {
      if (
        !isPidLive(Number(match[1])) &&
        (await unlinkIfExists(join(dir, entry)))
      )
        cleared++;
      continue;
    }
    if (entry === 'watch.control.json') {
      const legacy = await readControlFile(join(dir, entry)).catch(
        (): any => null,
      );
      if (
        legacy?.pid !== undefined &&
        !isPidLive(legacy.pid) &&
        (await unlinkIfExists(join(dir, entry)))
      ) {
        cleared++;
      }
    }
  }
  return cleared;
}
