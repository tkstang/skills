/**
 * watch.mjs — foreground polling watcher for debounced catch-up events.
 */

import { appendFile, lstat, mkdir, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { renderMarkdown } from './digest.mjs';
import { observeCatchUp } from './observe.mjs';
import * as stateLib from './state.mjs';
import * as watchStateLib from './watch-state.mjs';

const DEFAULT_POLL_SEC = 2;
const DEFAULT_DEBOUNCE_SEC = 2;
const BOTH_RUNTIMES = ['claude-code', 'codex'];
const RESERVED_EVENT_LOG_NAMES = new Set([
  'state.json',
  'watch.json',
  'watch.control.json',
]);

function toPositiveMs(value, fallbackSec) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallbackSec * 1000;
  return Math.max(1, numeric * 1000);
}

function maxRuntimeMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric * 60_000;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function stateDir() {
  return process.env.STATE_DIR ?? join(homedir(), '.local', 'state', 'session-observer');
}

function watchRuntimes(runtime) {
  if (runtime === 'both') return BOTH_RUNTIMES;
  return [runtime];
}

function targetKey(runtime, sessionId) {
  return `${runtime}:${sessionId}`;
}

function hasTargetForRuntime(targets, runtime) {
  for (const target of targets.values()) {
    if (target.runtime === runtime) return true;
  }
  return false;
}

function signatureChanged(previous, next) {
  if (!previous) return false;
  return previous.mtimeMs !== next.mtimeMs || previous.size !== next.size;
}

async function fileSignature(transcriptPath, statFn) {
  const fileStat = await statFn(transcriptPath);
  return {
    mtimeMs: fileStat.mtimeMs,
    size: fileStat.size,
  };
}

function eventRanges(digest) {
  return {
    fromIndex: digest.range.fromIndex,
    toIndex: digest.range.toIndex,
    nextIndex: digest.range.nextIndex,
    totalRecords: digest.range.totalRecords,
    renderedFromIndex: digest.range.renderedFromIndex,
    renderedToIndex: digest.range.renderedToIndex,
  };
}

function eventMetadata(ts, digest, rendered) {
  return {
    ts,
    runtime: digest.runtime,
    sessionId: digest.sessionId,
    newRecords: digest.range.newRecords,
    digestChars: rendered.length,
    ranges: eventRanges(digest),
  };
}

function stdoutEvent(ts, digest, rendered) {
  return {
    type: 'catch-up',
    ts,
    runtime: digest.runtime,
    sessionId: digest.sessionId,
    newRecords: digest.range.newRecords,
    digestChars: rendered.length,
    ranges: eventRanges(digest),
    digest,
  };
}

function isWithinDir(dir, path) {
  const rel = relative(dir, path);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function eventLogBoundaryError(dir) {
  return new Error(`--event-log must stay under the session-observer state directory: ${dir}`);
}

function eventLogReservedError() {
  return new Error('--event-log cannot use session-observer state, lock, temp, or backup files');
}

function isReservedEventLogSegment(segment) {
  return RESERVED_EVENT_LOG_NAMES.has(segment)
    || segment.endsWith('.lock')
    || segment.endsWith('.tmp')
    || segment.endsWith('.bak')
    || [...RESERVED_EVENT_LOG_NAMES].some(name => segment.startsWith(`${name}.`));
}

function eventLogSegments(dir, resolved) {
  const rel = relative(dir, resolved);
  if (rel === '') return [];
  return rel.split(/[\\/]+/u).filter(Boolean);
}

async function lstatIfExists(path) {
  try {
    return await lstat(path);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function assertRealPathWithinState(dir, realDir, candidate) {
  let realCandidate;
  try {
    realCandidate = await realpath(candidate);
  } catch {
    throw eventLogBoundaryError(dir);
  }

  if (!isWithinDir(realDir, realCandidate)) {
    throw eventLogBoundaryError(dir);
  }
}

async function assertEventLogPathSafe(dir, resolved) {
  if (!isWithinDir(dir, resolved)) {
    throw eventLogBoundaryError(dir);
  }

  const segments = eventLogSegments(dir, resolved);
  if (segments.some(isReservedEventLogSegment)) {
    throw eventLogReservedError();
  }

  await mkdir(dir, { recursive: true });
  const realDir = await realpath(dir);
  const parent = dirname(resolved);
  const parentSegments = eventLogSegments(dir, parent);
  let current = dir;

  for (const segment of parentSegments) {
    current = join(current, segment);
    const currentStat = await lstatIfExists(current);
    if (!currentStat) break;

    if (currentStat.isSymbolicLink()) {
      await assertRealPathWithinState(dir, realDir, current);
    } else if (!currentStat.isDirectory()) {
      throw new Error(`--event-log parent path must be a directory: ${current}`);
    }
  }

  const targetStat = await lstatIfExists(resolved);
  if (!targetStat) return;
  if (targetStat.isSymbolicLink()) {
    await assertRealPathWithinState(dir, realDir, resolved);
    return;
  }
  if (targetStat.isDirectory()) {
    throw new Error(`--event-log must be a file path, not a directory: ${resolved}`);
  }
}

async function resolveEventLogPath(eventLog) {
  if (!eventLog) return undefined;
  const dir = resolve(stateDir());
  const resolved = isAbsolute(eventLog)
    ? resolve(eventLog)
    : resolve(dir, eventLog);
  await assertEventLogPathSafe(dir, resolved);
  return resolved;
}

async function appendEventLog(eventLog, event) {
  if (!eventLog) return;
  await assertEventLogPathSafe(resolve(stateDir()), eventLog);
  await mkdir(dirname(eventLog), { recursive: true });
  await assertEventLogPathSafe(resolve(stateDir()), eventLog);
  await appendFile(eventLog, JSON.stringify(event) + '\n', 'utf8');
}

async function establishBaseline(runtime, args, targets, statFn, eventState) {
  const result = await observeCatchUp({ ...args, runtime });
  if (!result.ok) {
    if (result.kind === 'noMatch') return null;
    throw new Error(result.message);
  }

  const key = targetKey(result.runtime, result.digest.sessionId);
  if (targets.has(key)) return targets.get(key);

  const signature = await fileSignature(result.digest.transcriptPath, statFn);
  const target = {
    key,
    runtime: result.runtime,
    sessionId: result.digest.sessionId,
    transcriptPath: result.digest.transcriptPath,
    signature,
  };
  targets.set(key, target);
  await stateLib.setWatchedByPid(target.runtime, target.sessionId, eventState.pid).catch(() => false);
  return target;
}

async function establishBaselines(args, targets, statFn, eventState) {
  if (args.runtime === 'auto') {
    await establishBaseline('auto', args, targets, statFn, eventState);
    return;
  }

  for (const runtime of watchRuntimes(args.runtime)) {
    if (args.runtime === 'both' && hasTargetForRuntime(targets, runtime)) continue;
    await establishBaseline(runtime, args, targets, statFn, eventState);
  }
}

async function pollTargets(targets, pending, nowMs, statFn) {
  for (const target of targets.values()) {
    let signature;
    try {
      signature = await fileSignature(target.transcriptPath, statFn);
    } catch {
      continue;
    }

    if (!signatureChanged(target.signature, signature)) continue;
    target.signature = signature;
    pending.set(target.key, {
      key: target.key,
      runtime: target.runtime,
      sessionId: target.sessionId,
      lastChangedAt: nowMs,
    });
  }
}

async function emitPending(entry, args, deps, eventState) {
  const result = await observeCatchUp({
    ...args,
    runtime: entry.runtime,
    session: `${entry.runtime}:${entry.sessionId}`,
    suppressWatchedWarningPid: eventState.pid,
  });
  if (!result.ok) {
    if (result.kind === 'noMatch') return false;
    throw new Error(result.message);
  }

  const newRecords = result.digest.range.newRecords ?? 0;
  if (newRecords <= 0) return false;

  const rendered = renderMarkdown(result.digest);
  const ts = new Date(deps.now()).toISOString();
  const metadata = eventMetadata(ts, result.digest, rendered);

  if (args.json) {
    deps.writeStdout(JSON.stringify(stdoutEvent(ts, result.digest, rendered)) + '\n');
  } else {
    deps.writeStdout(rendered + '\n');
  }
  await appendEventLog(args.eventLog, metadata);
  eventState.eventCount++;
  await watchStateLib.recordWatcherEvent({ pid: eventState.pid, lastEventAt: ts });
  await stateLib.setWatchedByPid(result.runtime, result.digest.sessionId, eventState.pid).catch(() => false);
  return true;
}

async function emitReadyPending(args, pending, deps, eventState, { force = false } = {}) {
  const nowMs = deps.now();
  for (const entry of [...pending.values()]) {
    if (!force && nowMs - entry.lastChangedAt < eventState.debounceMs) continue;
    await emitPending(entry, args, deps, eventState);
    pending.delete(entry.key);
  }
}

async function applyControlDirective(args, pending, deps, eventState) {
  const control = await watchStateLib.readControlDirective();
  if (!control?.directive) return;

  await watchStateLib.clearControlDirective();
  switch (control.directive) {
    case 'pause':
      eventState.paused = true;
      return;
    case 'resume':
      eventState.paused = false;
      return;
    case 'flush':
      await emitReadyPending(args, pending, deps, eventState, { force: true });
      return;
    case 'stop':
      eventState.stopRequested = true;
      eventState.stopReason = 'control-stop';
      return;
    default:
      return;
  }
}

function installSignalHandlers(eventState) {
  const handler = () => {
    eventState.stopRequested = true;
    eventState.stopReason = 'signal';
  };
  process.once('SIGINT', handler);
  process.once('SIGTERM', handler);
  return () => {
    process.removeListener('SIGINT', handler);
    process.removeListener('SIGTERM', handler);
  };
}

/**
 * Run the foreground polling loop.
 *
 * @param {object} args CLI-like watch options.
 * @param {object} [deps] Test hooks.
 * @returns {Promise<{reason: string, eventCount: number}>}
 */
export async function runWatchLoop(args, deps = {}) {
  const runtime = args.runtime ?? 'auto';
  const cwd = args.cwd ?? process.cwd();
  const eventLog = args.eventLog ? await resolveEventLogPath(args.eventLog) : undefined;
  const normalizedArgs = {
    ...args,
    runtime,
    cwd,
    eventLog,
  };
  const pollMs = toPositiveMs(args.pollSec, DEFAULT_POLL_SEC);
  const debounceMs = toPositiveMs(args.debounceSec, DEFAULT_DEBOUNCE_SEC);
  const limitMs = maxRuntimeMs(args.maxRuntimeMin);
  const startedAtMs = (deps.now ?? Date.now)();
  const deadlineMs = limitMs === null ? null : startedAtMs + limitMs;
  const active = await watchStateLib.startWatcher({
    runtime,
    cwd,
    pid: deps.pid ?? process.pid,
    startedAt: new Date(startedAtMs).toISOString(),
  });

  const resolvedDeps = {
    now: deps.now ?? Date.now,
    sleep: deps.sleep ?? sleep,
    stat: deps.stat ?? stat,
    writeStdout: deps.writeStdout ?? (chunk => process.stdout.write(chunk)),
  };
  const targets = new Map();
  const pending = new Map();
  const eventState = {
    pid: active.pid,
    debounceMs,
    eventCount: 0,
    paused: false,
    stopRequested: false,
    stopReason: 'stopped',
  };
  const removeSignalHandlers = deps.handleSignals === false
    ? () => {}
    : installSignalHandlers(eventState);
  let reason = 'stopped';

  try {
    while (true) {
      if (eventState.stopRequested) {
        reason = eventState.stopReason;
        break;
      }

      const nowMs = resolvedDeps.now();
      if (deadlineMs !== null && nowMs >= deadlineMs) {
        reason = 'max-runtime';
        break;
      }

      if (targets.size === 0 || args.runtime === 'both') {
        await establishBaselines(normalizedArgs, targets, resolvedDeps.stat, eventState);
      }
      await pollTargets(targets, pending, nowMs, resolvedDeps.stat);
      await applyControlDirective(normalizedArgs, pending, resolvedDeps, eventState);
      if (eventState.stopRequested) {
        reason = eventState.stopReason;
        break;
      }
      if (!eventState.paused) {
        await emitReadyPending(normalizedArgs, pending, resolvedDeps, eventState);
      }

      const afterTickMs = resolvedDeps.now();
      if (deadlineMs !== null && afterTickMs >= deadlineMs) {
        reason = 'max-runtime';
        break;
      }
      const delayMs = deadlineMs === null
        ? pollMs
        : Math.max(0, Math.min(pollMs, deadlineMs - afterTickMs));
      if (delayMs > 0) await resolvedDeps.sleep(delayMs);
    }

    return { reason, eventCount: eventState.eventCount };
  } finally {
    removeSignalHandlers();
    for (const target of targets.values()) {
      await stateLib.clearWatchedByPid(target.runtime, target.sessionId, active.pid).catch(() => false);
    }
    await watchStateLib.clearControlDirective().catch(() => false);
    await watchStateLib.clearWatcher({ pid: active.pid });
  }
}
