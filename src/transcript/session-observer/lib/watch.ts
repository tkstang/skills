/**
 * watch.mjs — foreground polling watcher for debounced catch-up events.
 */

import { once } from 'node:events';
import { appendFile, lstat, mkdir, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

import { readRecords } from '../../core/runtimes.js';
import { renderMarkdown } from './digest.js';
import { observeCatchUp } from './observe.js';
import * as stateLib from './state.js';
import * as watchStateLib from './watch-state.js';

const DEFAULT_POLL_SEC = 2;
const DEFAULT_DEBOUNCE_SEC = 2;
const DEFAULT_MAX_PENDING_SEC = 30;
const DEFAULT_HEARTBEAT_SEC = 120;
const BOTH_RUNTIMES = ['claude-code', 'codex'];
const RESERVED_EVENT_LOG_NAMES = new Set([
  'state.json',
  'watch.json',
  'watch.control.json',
]);

function toPositiveMs(value: any, fallbackSec: any): any {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallbackSec * 1000;
  return Math.max(1, numeric * 1000);
}

function maxRuntimeMs(value: any): any {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric * 60_000;
}

function maxPendingMs(value: any): any {
  return toPositiveMs(value, DEFAULT_MAX_PENDING_SEC);
}

function heartbeatMs(value: any): any {
  if (value === undefined || value === null)
    return DEFAULT_HEARTBEAT_SEC * 1000;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.max(1, numeric * 1000);
}

function sleep(ms: any): any {
  return new Promise((resolve: any): any => setTimeout(resolve, ms));
}

function stateDir(): any {
  return (
    process.env.STATE_DIR ??
    join(homedir(), '.local', 'state', 'session-observer')
  );
}

function watchRuntimes(runtime: any): any {
  if (runtime === 'both') return BOTH_RUNTIMES;
  return [runtime];
}

function targetKey(runtime: any, sessionId: any): any {
  return `${runtime}:${sessionId}`;
}

function hasTargetForRuntime(targets: any, runtime: any): any {
  for (const target of targets.values()) {
    if (target.runtime === runtime) return true;
  }
  return false;
}

function signatureChanged(previous: any, next: any): any {
  if (!previous) return false;
  return previous.mtimeMs !== next.mtimeMs || previous.size !== next.size;
}

async function fileSignature(transcriptPath: any, statFn: any): Promise<any> {
  const fileStat = await statFn(transcriptPath);
  return {
    mtimeMs: fileStat.mtimeMs,
    size: fileStat.size,
  };
}

function eventRanges(digest: any): any {
  return {
    fromIndex: digest.range.fromIndex,
    toIndex: digest.range.toIndex,
    nextIndex: digest.range.nextIndex,
    totalRecords: digest.range.totalRecords,
    renderedFromIndex: digest.range.renderedFromIndex,
    renderedToIndex: digest.range.renderedToIndex,
  };
}

function eventMetadata(ts: any, digest: any, rendered: any): any {
  return {
    type: 'delta',
    ts,
    runtime: digest.runtime,
    sessionId: digest.sessionId,
    newRecords: digest.range.newRecords,
    digestChars: rendered.length,
    ranges: eventRanges(digest),
  };
}

function stdoutEvent(ts: any, digest: any, rendered: any): any {
  return {
    type: 'delta',
    ts,
    runtime: digest.runtime,
    sessionId: digest.sessionId,
    newRecords: digest.range.newRecords,
    digestChars: rendered.length,
    ranges: eventRanges(digest),
    digest,
  };
}

async function writeProcessStdout(chunk: any): Promise<any> {
  if (process.stdout.write(chunk)) return;
  await once(process.stdout, 'drain');
}

async function writeStdoutChunk(deps: any, chunk: any): Promise<any> {
  const result = deps.writeStdout(chunk);
  if (result && typeof result.then === 'function') await result;
}

function lockedTargetEvent(target: any): any {
  return {
    type: 'baseline',
    message:
      'Watcher is now active. Keep this process open and continue reading stdout. Do not treat baseline setup as a completed watch.',
    runtime: target.runtime,
    sessionId: target.sessionId,
    transcriptPath: target.transcriptPath,
    cwd: target.recordedCwd ?? null,
    size: target.signature.size,
    recordCount: target.recordCount,
    baselineRecordIndex: target.baselineRecordIndex,
    engagementStatus: target.engagementStatus,
  };
}

function lockedTargetLine(target: any): any {
  return (
    `[session-observer] baseline ${target.runtime}:${target.sessionId} ` +
    `transcript=${target.transcriptPath} ` +
    `cwd=${target.recordedCwd ?? '(unknown)'} ` +
    `size=${target.signature.size} ` +
    `records=${target.recordCount} ` +
    `baselineRecordIndex=${target.baselineRecordIndex} ` +
    `engagement=${target.engagementStatus}\n`
  );
}

async function emitLockedTarget(
  args: any,
  deps: any,
  target: any,
): Promise<any> {
  if (args.json) {
    await writeStdoutChunk(
      deps,
      JSON.stringify(lockedTargetEvent(target)) + '\n',
    );
    return;
  }
  await writeStdoutChunk(deps, lockedTargetLine(target));
}

async function emitWatchPosture(args: any, deps: any): Promise<any> {
  if (args.json) return;
  await writeStdoutChunk(
    deps,
    '[session-observer] Watcher is now active. Keep this process open and continue reading stdout. Do not treat baseline setup as a completed watch.\n',
  );
}

function stoppedEvent(ts: any, reason: any, eventState: any): any {
  return {
    type: 'stopped',
    ts,
    reason,
    eventCount: eventState.eventCount,
  };
}

function stoppedLine(reason: any, eventState: any): any {
  return `[session-observer] watch stopped reason=${reason} deltaEvents=${eventState.eventCount}\n`;
}

async function emitStopped(
  args: any,
  deps: any,
  reason: any,
  eventState: any,
): Promise<any> {
  const ts = new Date(deps.now()).toISOString();
  if (args.json) {
    await writeStdoutChunk(
      deps,
      JSON.stringify(stoppedEvent(ts, reason, eventState)) + '\n',
    );
    return;
  }
  await writeStdoutChunk(deps, stoppedLine(reason, eventState));
}

function errorEvent(ts: any, err: any): any {
  return {
    type: 'error',
    ts,
    message: err.message,
  };
}

async function emitErrorEvent(args: any, deps: any, err: any): Promise<any> {
  const ts = new Date(deps.now()).toISOString();
  if (args.json) {
    await writeStdoutChunk(deps, JSON.stringify(errorEvent(ts, err)) + '\n');
    return;
  }
  await writeStdoutChunk(
    deps,
    `[session-observer] watch error: ${err.message}\n`,
  );
}

function consumedThrough(lastRecordIndex: any): any {
  if (!Number.isFinite(lastRecordIndex) || lastRecordIndex <= 0) return null;
  return lastRecordIndex - 1;
}

async function targetHeartbeatStatus(
  target: any,
  sessionState: any,
): Promise<any> {
  const stored = sessionState.sessions?.[target.key] ?? null;
  const lastRecordIndex = Number.isFinite(Number(stored?.lastRecordIndex))
    ? Number(stored.lastRecordIndex)
    : Number(target.baselineRecordIndex ?? 0);
  let transcriptRecords = null;
  let error = null;
  try {
    transcriptRecords = (await readRecords(target.transcriptPath)).length;
  } catch (err: any) {
    error = err.message;
  }

  const recordsBehind =
    transcriptRecords === null
      ? null
      : Math.max(0, transcriptRecords - lastRecordIndex);

  return {
    runtime: target.runtime,
    sessionId: target.sessionId,
    transcriptPath: target.transcriptPath,
    transcriptRecords,
    lastRecordIndex,
    consumedThrough: consumedThrough(lastRecordIndex),
    recordsBehind,
    healthy: !error,
    error,
  };
}

async function heartbeatPayload(
  targets: any,
  deps: any,
  eventState: any,
): Promise<any> {
  const sessionState = await stateLib
    .load()
    .catch((): any => ({ sessions: {} }));
  const targetStatuses: any[] = [];
  for (const target of targets.values()) {
    targetStatuses.push(await targetHeartbeatStatus(target, sessionState));
  }
  const totalRecordsBehind = targetStatuses.reduce(
    (sum: any, target: any): any => {
      if (!Number.isFinite(target.recordsBehind)) return sum;
      return sum + target.recordsBehind;
    },
    0,
  );
  const healthy = targetStatuses.every((target: any): any => target.healthy);
  return {
    type: 'heartbeat',
    ts: new Date(deps.now()).toISOString(),
    message: 'still watching',
    targetCount: targetStatuses.length,
    recordsBehind: totalRecordsBehind,
    healthy,
    eventCount: eventState.eventCount,
    targets: targetStatuses,
  };
}

function heartbeatLine(payload: any): any {
  const status =
    payload.recordsBehind === 0 ? 'no new records' : 'records pending';
  return (
    `[session-observer] still watching, ${status}, ` +
    `recordsBehind=${payload.recordsBehind} healthy=${payload.healthy} targets=${payload.targetCount}\n`
  );
}

async function emitHeartbeat(
  args: any,
  targets: any,
  deps: any,
  eventState: any,
): Promise<any> {
  const payload = await heartbeatPayload(targets, deps, eventState);
  if (args.json) {
    await writeStdoutChunk(deps, JSON.stringify(payload) + '\n');
    return;
  }
  await writeStdoutChunk(deps, heartbeatLine(payload));
}

function isWithinDir(dir: any, path: any): any {
  const rel = relative(dir, path);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function eventLogBoundaryError(dir: any): any {
  return new Error(
    `--event-log must stay under the session-observer state directory: ${dir}`,
  );
}

function eventLogReservedError(): any {
  return new Error(
    '--event-log cannot use session-observer state, lock, temp, or backup files',
  );
}

function isReservedEventLogSegment(segment: any): any {
  return (
    RESERVED_EVENT_LOG_NAMES.has(segment) ||
    segment.endsWith('.lock') ||
    segment.endsWith('.tmp') ||
    segment.endsWith('.bak') ||
    segment.startsWith('watch.control.') ||
    [...RESERVED_EVENT_LOG_NAMES].some((name: any): any =>
      segment.startsWith(`${name}.`),
    )
  );
}

function eventLogSegments(dir: any, resolved: any): any {
  const rel = relative(dir, resolved);
  if (rel === '') return [];
  return rel.split(/[\\/]+/u).filter(Boolean);
}

async function lstatIfExists(path: any): Promise<any> {
  try {
    return await lstat(path);
  } catch (err: any) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function assertRealPathWithinState(
  dir: any,
  realDir: any,
  candidate: any,
): Promise<any> {
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

async function assertEventLogPathSafe(dir: any, resolved: any): Promise<any> {
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
      throw new Error(
        `--event-log parent path must be a directory: ${current}`,
      );
    }
  }

  const targetStat = await lstatIfExists(resolved);
  if (!targetStat) return;
  if (targetStat.isSymbolicLink()) {
    await assertRealPathWithinState(dir, realDir, resolved);
    return;
  }
  if (targetStat.isDirectory()) {
    throw new Error(
      `--event-log must be a file path, not a directory: ${resolved}`,
    );
  }
}

async function resolveEventLogPath(eventLog: any): Promise<any> {
  if (!eventLog) return undefined;
  const dir = resolve(stateDir());
  const resolved = isAbsolute(eventLog)
    ? resolve(eventLog)
    : resolve(dir, eventLog);
  await assertEventLogPathSafe(dir, resolved);
  return resolved;
}

async function appendEventLog(eventLog: any, event: any): Promise<any> {
  if (!eventLog) return;
  await assertEventLogPathSafe(resolve(stateDir()), eventLog);
  await mkdir(dirname(eventLog), { recursive: true });
  await assertEventLogPathSafe(resolve(stateDir()), eventLog);
  await appendFile(eventLog, JSON.stringify(event) + '\n', 'utf8');
}

async function restoreConsumedBaseline(result: any): Promise<any> {
  // The baseline observe already advanced the shared read offset; put it back
  // so the watcher that owns this target does not silently lose those records.
  const range = result.digest.range;
  if ((range.newRecords ?? 0) > 0) {
    await stateLib
      .markRead(result.runtime, result.digest.sessionId, {
        lastRecordIndex: Math.max(0, (range.nextIndex ?? 0) - range.newRecords),
        lastTotalRecords: range.totalRecords,
        transcriptPath: result.digest.transcriptPath,
        recordedCwd: result.digest.recordedCwd,
      })
      .catch((): any => null);
  }
}

function duplicateTargetError(conflictPid: any, key: any): any {
  return new Error(
    `watcher pid ${conflictPid} is already watching ${key}; ` +
      `stop it with watch-ctl stop --pid ${conflictPid} or pin a different --session`,
  );
}

async function establishBaseline(
  runtime: any,
  args: any,
  targets: any,
  deps: any,
  eventState: any,
): Promise<any> {
  const result = await observeCatchUp({ ...args, runtime });
  if (!result.ok) {
    if (result.kind === 'noMatch') return null;
    throw new Error(result.message);
  }

  const key = targetKey(result.runtime, result.digest.sessionId);
  if (targets.has(key)) return targets.get(key);

  const conflict = await watchStateLib
    .findLiveWatcherForTarget({
      runtime: result.runtime,
      sessionId: result.digest.sessionId,
      excludePid: eventState.pid,
    })
    .catch((): any => null);
  if (conflict) {
    await restoreConsumedBaseline(result);
    throw duplicateTargetError(conflict.pid, key);
  }

  const signature = await fileSignature(
    result.digest.transcriptPath,
    deps.stat,
  );
  const target: any = {
    key,
    runtime: result.runtime,
    sessionId: result.digest.sessionId,
    transcriptPath: result.digest.transcriptPath,
    recordedCwd: result.digest.recordedCwd,
    signature,
    recordCount: result.digest.range.totalRecords,
    baselineRecordIndex: result.digest.range.nextIndex,
    engagementStatus:
      result.digest.engagement?.status ??
      result.candidate.engagementStatus ??
      'unknown',
    lockedAt: new Date(deps.now()).toISOString(),
  };
  try {
    await watchStateLib.recordWatcherTarget({ pid: eventState.pid, target });
  } catch (err: any) {
    if (err?.code === 'DUPLICATE_WATCH_TARGET') {
      // Lost the startup race: another watcher recorded this target between
      // the pre-check above and the locked write. Same recovery as above.
      await restoreConsumedBaseline(result);
      throw duplicateTargetError(err.conflictPid, key);
    }
    // Best-effort metadata write; the loop still functions without it.
  }
  targets.set(key, target);
  await emitLockedTarget(args, deps, target);
  await stateLib
    .setWatchedByPid(target.runtime, target.sessionId, eventState.pid)
    .catch((): any => false);
  if (args.catchUpFirst) {
    await emitObservedDelta(result, args, deps, eventState);
    // Detect-then-consume: take the signature before the flush below so any
    // record appended after it is still seen as a change by the poll loop
    // (a zero-record re-observe is benign; a missed record is not).
    target.signature = await fileSignature(target.transcriptPath, deps.stat);
    await emitPending(
      {
        key,
        runtime: target.runtime,
        sessionId: target.sessionId,
      },
      args,
      deps,
      eventState,
    );
  }
  return target;
}

async function enqueueRecordsAppendedDuringBaseline(
  target: any,
  pending: any,
  deps: any,
): Promise<any> {
  let recordCount;
  try {
    recordCount = (await readRecords(target.transcriptPath)).length;
  } catch {
    return;
  }

  const baselineRecordIndex = Number(target.baselineRecordIndex ?? 0);
  if (recordCount <= baselineRecordIndex) return;

  target.recordCount = recordCount;
  const nowMs = deps.now();
  pending.set(target.key, {
    key: target.key,
    runtime: target.runtime,
    sessionId: target.sessionId,
    firstChangedAt: nowMs,
    lastChangedAt: nowMs,
  });
}

async function establishBaselines(
  args: any,
  targets: any,
  pending: any,
  deps: any,
  eventState: any,
): Promise<any> {
  if (args.runtime === 'auto') {
    const target = await establishBaseline(
      'auto',
      args,
      targets,
      deps,
      eventState,
    );
    if (target)
      await enqueueRecordsAppendedDuringBaseline(target, pending, deps);
    return;
  }

  for (const runtime of watchRuntimes(args.runtime)) {
    if (args.runtime === 'both' && hasTargetForRuntime(targets, runtime))
      continue;
    const target = await establishBaseline(
      runtime,
      args,
      targets,
      deps,
      eventState,
    );
    if (target)
      await enqueueRecordsAppendedDuringBaseline(target, pending, deps);
  }
}

async function pollTargets(
  targets: any,
  pending: any,
  nowMs: any,
  statFn: any,
): Promise<any> {
  for (const target of targets.values()) {
    let signature;
    try {
      signature = await fileSignature(target.transcriptPath, statFn);
    } catch {
      continue;
    }

    if (!signatureChanged(target.signature, signature)) continue;
    target.signature = signature;
    const existing = pending.get(target.key);
    pending.set(target.key, {
      key: target.key,
      runtime: target.runtime,
      sessionId: target.sessionId,
      firstChangedAt: existing?.firstChangedAt ?? nowMs,
      lastChangedAt: nowMs,
    });
  }
}

async function emitPending(
  entry: any,
  args: any,
  deps: any,
  eventState: any,
): Promise<any> {
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
    await writeStdoutChunk(
      deps,
      JSON.stringify(stdoutEvent(ts, result.digest, rendered)) + '\n',
    );
  } else {
    await writeStdoutChunk(deps, rendered + '\n');
  }
  await appendEventLog(args.eventLog, metadata);
  eventState.eventCount++;
  eventState.lastHeartbeatAt = deps.now();
  await watchStateLib.recordWatcherEvent({
    pid: eventState.pid,
    lastEventAt: ts,
  });
  await stateLib
    .setWatchedByPid(result.runtime, result.digest.sessionId, eventState.pid)
    .catch((): any => false);
  return true;
}

async function emitObservedDelta(
  result: any,
  args: any,
  deps: any,
  eventState: any,
): Promise<any> {
  const newRecords = result.digest.range.newRecords ?? 0;
  if (newRecords <= 0) return false;

  const rendered = renderMarkdown(result.digest);
  const ts = new Date(deps.now()).toISOString();
  const metadata = eventMetadata(ts, result.digest, rendered);

  if (args.json) {
    await writeStdoutChunk(
      deps,
      JSON.stringify(stdoutEvent(ts, result.digest, rendered)) + '\n',
    );
  } else {
    await writeStdoutChunk(deps, rendered + '\n');
  }
  await appendEventLog(args.eventLog, metadata);
  eventState.eventCount++;
  eventState.lastHeartbeatAt = deps.now();
  await watchStateLib.recordWatcherEvent({
    pid: eventState.pid,
    lastEventAt: ts,
  });
  await stateLib
    .setWatchedByPid(result.runtime, result.digest.sessionId, eventState.pid)
    .catch((): any => false);
  return true;
}

async function emitReadyPending(
  args: any,
  pending: any,
  deps: any,
  eventState: any,
  { force = false }: any = {},
): Promise<any> {
  const nowMs = deps.now();
  // oxlint-disable-next-line unicorn/no-useless-spread -- snapshot before pending.delete() mutates the Map during iteration
  for (const entry of [...pending.values()]) {
    const quietForMs = nowMs - entry.lastChangedAt;
    const pendingForMs = nowMs - (entry.firstChangedAt ?? entry.lastChangedAt);
    const ready =
      quietForMs >= eventState.debounceMs ||
      pendingForMs >= eventState.maxPendingMs;
    if (!force && !ready) continue;
    await emitPending(entry, args, deps, eventState);
    pending.delete(entry.key);
  }
}

async function flushPendingBeforeMaxRuntime(
  args: any,
  targets: any,
  pending: any,
  deps: any,
  eventState: any,
): Promise<any> {
  if (eventState.paused || targets.size === 0) return;
  await pollTargets(targets, pending, deps.now(), deps.stat);
  await emitReadyPending(args, pending, deps, eventState, { force: true });
}

async function applyControlDirective(
  args: any,
  pending: any,
  deps: any,
  eventState: any,
): Promise<any> {
  const control = await watchStateLib.readControlDirective({
    pid: eventState.pid,
  });
  if (!control?.directive) return;
  if (control.pid !== undefined && control.pid !== eventState.pid) return;

  await watchStateLib.clearControlDirective({ pid: eventState.pid });
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

function installSignalHandlers(eventState: any): any {
  const handler = (): any => {
    eventState.stopRequested = true;
    eventState.stopReason = 'signal';
  };
  process.once('SIGINT', handler);
  process.once('SIGTERM', handler);
  return (): any => {
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
export async function runWatchLoop(args: any, deps: any = {}): Promise<any> {
  const runtime = args.runtime ?? 'auto';
  const cwd = args.cwd ?? process.cwd();
  const eventLog = args.eventLog
    ? await resolveEventLogPath(args.eventLog)
    : undefined;
  const resolvedMaxPendingMs = maxPendingMs(args.maxPendingSec);
  const resolvedHeartbeatMs = heartbeatMs(args.heartbeatSec);
  const normalizedArgs: any = {
    ...args,
    runtime,
    cwd,
    eventLog,
    maxPendingSec: resolvedMaxPendingMs / 1000,
    heartbeatSec: resolvedHeartbeatMs === null ? 0 : resolvedHeartbeatMs / 1000,
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
    session: args.session ?? null,
    pollSec: pollMs / 1000,
    debounceSec: debounceMs / 1000,
    maxPendingSec: resolvedMaxPendingMs / 1000,
    heartbeatSec: resolvedHeartbeatMs === null ? 0 : resolvedHeartbeatMs / 1000,
    staleAfterSec: (pollMs + debounceMs + resolvedMaxPendingMs) / 1000,
  });

  const resolvedDeps: any = {
    now: deps.now ?? Date.now,
    sleep: deps.sleep ?? sleep,
    stat: deps.stat ?? stat,
    writeStdout: deps.writeStdout ?? writeProcessStdout,
  };
  const targets = new Map();
  const pending = new Map();
  const eventState: any = {
    pid: active.pid,
    debounceMs,
    maxPendingMs: resolvedMaxPendingMs,
    eventCount: 0,
    lastHeartbeatAt: startedAtMs,
    heartbeatMs: resolvedHeartbeatMs,
    paused: false,
    stopRequested: false,
    stopReason: 'stopped',
  };
  const removeSignalHandlers =
    deps.handleSignals === false
      ? (): any => {}
      : installSignalHandlers(eventState);
  let reason = 'stopped';

  try {
    await emitWatchPosture(normalizedArgs, resolvedDeps);
    while (true) {
      if (eventState.stopRequested) {
        reason = eventState.stopReason;
        break;
      }

      const nowMs = resolvedDeps.now();
      if (deadlineMs !== null && nowMs >= deadlineMs) {
        reason = 'max-runtime';
        await flushPendingBeforeMaxRuntime(
          normalizedArgs,
          targets,
          pending,
          resolvedDeps,
          eventState,
        );
        break;
      }

      if (targets.size === 0 || args.runtime === 'both') {
        await establishBaselines(
          normalizedArgs,
          targets,
          pending,
          resolvedDeps,
          eventState,
        );
      }
      await pollTargets(targets, pending, nowMs, resolvedDeps.stat);
      await applyControlDirective(
        normalizedArgs,
        pending,
        resolvedDeps,
        eventState,
      );
      if (eventState.stopRequested) {
        reason = eventState.stopReason;
        break;
      }
      if (!eventState.paused) {
        await emitReadyPending(
          normalizedArgs,
          pending,
          resolvedDeps,
          eventState,
        );
      }
      if (
        eventState.heartbeatMs !== null &&
        targets.size > 0 &&
        resolvedDeps.now() - eventState.lastHeartbeatAt >=
          eventState.heartbeatMs
      ) {
        await emitHeartbeat(normalizedArgs, targets, resolvedDeps, eventState);
        eventState.lastHeartbeatAt = resolvedDeps.now();
      }
      await watchStateLib
        .recordWatcherPoll({
          pid: eventState.pid,
          lastPollAt: new Date(resolvedDeps.now()).toISOString(),
        })
        .catch((): any => null);

      const afterTickMs = resolvedDeps.now();
      if (deadlineMs !== null && afterTickMs >= deadlineMs) {
        reason = 'max-runtime';
        await flushPendingBeforeMaxRuntime(
          normalizedArgs,
          targets,
          pending,
          resolvedDeps,
          eventState,
        );
        break;
      }
      const delayMs =
        deadlineMs === null
          ? pollMs
          : Math.max(0, Math.min(pollMs, deadlineMs - afterTickMs));
      if (delayMs > 0) await resolvedDeps.sleep(delayMs);
    }

    await emitStopped(normalizedArgs, resolvedDeps, reason, eventState);
    return { reason, eventCount: eventState.eventCount };
  } catch (err: any) {
    await watchStateLib
      .recordWatcherError({
        pid: eventState.pid,
        error: err,
        at: new Date(resolvedDeps.now()).toISOString(),
      })
      .catch((): any => null);
    await emitErrorEvent(normalizedArgs, resolvedDeps, err);
    // Setup failures before this try block never reach emitErrorEvent; the
    // CLI uses this marker to emit a stable JSON error event exactly once.
    err.watchErrorEventEmitted = true;
    throw err;
  } finally {
    removeSignalHandlers();
    for (const target of targets.values()) {
      await stateLib
        .clearWatchedByPid(target.runtime, target.sessionId, active.pid)
        .catch((): any => false);
    }
    await watchStateLib
      .clearControlDirective({ pid: active.pid })
      .catch((): any => false);
    await watchStateLib.clearWatcher({ pid: active.pid });
  }
}
