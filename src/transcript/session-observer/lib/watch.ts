/**
 * watch.mjs — foreground polling watcher for debounced catch-up events.
 */

import { appendFile, lstat, mkdir, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

import { scanCursorTranscript } from '../../core/cursor-frames.js';
import { type Runtime, readRecords } from '../../core/runtimes.js';
import * as cursorStateLib from './cursor-state.js';
import { renderMarkdown } from './digest.js';
import {
  ClassificationCache,
  findNewerSameCwdCandidates,
  findSessionCandidate,
  resolveCursorIdentity,
} from './locate.js';
import { observeCatchUp } from './observe.js';
import * as stateLib from './state.js';
import type {
  CursorObserveSuccess,
  CursorSessionStateEntry,
  DuplicateWatchTargetError,
  EngagementStatus,
  ObservationStatus,
  ObserveSuccess,
  NewerSessionCandidateEvent,
  SessionDigest,
  SessionObserverState,
  TranscriptCandidate,
  TranscriptContinuityCheckpoint,
  TranscriptIdentityEvidence,
  WatchLoopArgs,
  WatchLoopDeps,
  WatchLoopError,
} from './types.js';
import * as watchStateLib from './watch-state.js';

const DEFAULT_POLL_SEC = 2;
const DEFAULT_DEBOUNCE_SEC = 2;
const DEFAULT_MAX_PENDING_SEC = 30;
const DEFAULT_HEARTBEAT_SEC = 120;
const BOTH_RUNTIMES: Runtime[] = ['claude-code', 'codex'];
const RESERVED_EVENT_LOG_NAMES = new Set([
  'state.json',
  'watch.json',
  'watch.control.json',
]);

interface FileSignature {
  mtimeMs: number;
  size: number;
}

interface WatchTarget {
  key: string;
  runtime: Runtime;
  sessionId: string;
  transcriptPath: string;
  recordedCwd: string | null;
  signature: FileSignature;
  recordCount: number;
  baselineRecordIndex: number;
  candidateMtime: number;
  engagementStatus: EngagementStatus;
  lockedAt: string;
  indexBase?: 'zero-based-jsonl-record-index' | 'zero-based-jsonl-frame-index';
  canonicalTranscriptPath?: string;
  observationCursor?: number;
  bufferedFromFrame?: number | null;
  continuity?: TranscriptContinuityCheckpoint;
  pendingCandidateDeadline?: number | null;
  lastStatus?: ObservationStatus;
  continuityState?: 'verified' | 'blocked';
}

interface PendingEntry {
  key: string;
  runtime: Runtime;
  sessionId: string;
  firstChangedAt: number;
  lastChangedAt: number;
  readyAt?: number | null;
}

interface WatchEventState {
  pid: number;
  debounceMs: number;
  maxPendingMs: number;
  eventCount: number;
  lastHeartbeatAt: number;
  heartbeatMs: number | null;
  paused: boolean;
  stopRequested: boolean;
  stopReason: string;
}

interface ResolvedWatchDeps {
  now: () => number;
  sleep: (ms: number) => Promise<unknown>;
  stat: (path: string) => Promise<FileSignature>;
  writeStdout: (
    chunk: string,
    complete?: (error?: Error | null) => void,
  ) => boolean | number | void | Promise<unknown>;
  onCursorScan?: () => void;
}

interface EventRanges {
  indexBase?: 'zero-based-jsonl-record-index' | 'zero-based-jsonl-frame-index';
  fromIndex: number;
  toIndex: number | null;
  nextIndex: number;
  totalRecords: number;
  renderedFromIndex: number | null;
  renderedToIndex: number | null;
}

function toPositiveMs(value: unknown, fallbackSec: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallbackSec * 1000;
  return Math.max(1, numeric * 1000);
}

function maxRuntimeMs(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric * 60_000;
}

function maxPendingMs(value: unknown): number {
  return toPositiveMs(value, DEFAULT_MAX_PENDING_SEC);
}

function heartbeatMs(value: unknown): number | null {
  if (value === undefined || value === null)
    return DEFAULT_HEARTBEAT_SEC * 1000;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.max(1, numeric * 1000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((complete) => setTimeout(complete, ms));
}

function stateDir(): string {
  return (
    process.env.STATE_DIR ??
    join(homedir(), '.local', 'state', 'session-observer')
  );
}

function watchRuntimes(runtime: WatchLoopArgs['runtime']): Runtime[] {
  if (runtime === 'both') return BOTH_RUNTIMES;
  return [runtime as Runtime];
}

function targetKey(runtime: Runtime, sessionId: string): string {
  return `${runtime}:${sessionId}`;
}

function hasTargetForRuntime(
  targets: Map<string, WatchTarget>,
  runtime: string,
): boolean {
  for (const target of targets.values()) {
    if (target.runtime === runtime) return true;
  }
  return false;
}

function signatureChanged(
  previous: FileSignature | null | undefined,
  next: FileSignature,
): boolean {
  if (!previous) return false;
  return previous.mtimeMs !== next.mtimeMs || previous.size !== next.size;
}

async function fileSignature(
  transcriptPath: string,
  statFn: ResolvedWatchDeps['stat'],
): Promise<FileSignature> {
  const fileStat = await statFn(transcriptPath);
  return {
    mtimeMs: fileStat.mtimeMs,
    size: fileStat.size,
  };
}

function isCursorDigest(
  digest: SessionDigest,
): digest is Extract<SessionDigest, { schemaVersion: 2 }> {
  return digest.schemaVersion === 2;
}

function eventRanges(digest: SessionDigest): EventRanges {
  if (isCursorDigest(digest)) {
    return {
      indexBase: digest.range.indexBase,
      fromIndex: digest.range.fromIndex,
      toIndex: digest.range.toIndex,
      nextIndex: digest.range.nextIndex,
      totalRecords: digest.range.totalFrames,
      renderedFromIndex: digest.range.renderedFromIndex,
      renderedToIndex: digest.range.renderedToIndex,
    };
  }
  return {
    fromIndex: digest.range.fromIndex,
    toIndex: digest.range.toIndex,
    nextIndex: digest.range.nextIndex,
    totalRecords: digest.range.totalRecords,
    renderedFromIndex: digest.range.renderedFromIndex,
    renderedToIndex: digest.range.renderedToIndex,
  };
}

function digestNewRecords(digest: SessionDigest): number {
  return isCursorDigest(digest)
    ? digest.range.newFrames
    : digest.range.newRecords;
}

function eventMetadata(ts: string, digest: SessionDigest, rendered: string) {
  return {
    type: 'delta',
    ts,
    runtime: digest.runtime,
    sessionId: digest.sessionId,
    newRecords: digestNewRecords(digest),
    digestChars: rendered.length,
    ranges: eventRanges(digest),
  };
}

function stdoutEvent(ts: string, digest: SessionDigest, rendered: string) {
  return {
    type: 'delta',
    ts,
    runtime: digest.runtime,
    sessionId: digest.sessionId,
    newRecords: digestNewRecords(digest),
    digestChars: rendered.length,
    ranges: eventRanges(digest),
    digest,
  };
}

async function writeProcessStdout(chunk: string): Promise<void> {
  await new Promise<void>((fulfill, reject) => {
    process.stdout.write(chunk, (error) => {
      if (error) reject(error);
      else fulfill();
    });
  });
}

async function writeStdoutChunk(
  deps: ResolvedWatchDeps,
  chunk: string,
): Promise<void> {
  const callbackExpected = deps.writeStdout.length >= 2;
  let completeCallback: ((error?: Error | null) => void) | undefined;
  const callbackCompletion = callbackExpected
    ? new Promise<void>((fulfill, reject) => {
        completeCallback = (error) => {
          if (error) reject(error);
          else fulfill();
        };
      })
    : null;
  const result = deps.writeStdout(chunk, completeCallback);
  if (result && typeof result === 'object' && 'then' in result) {
    await result;
  } else if (callbackCompletion) {
    await callbackCompletion;
  }
}

function lockedTargetEvent(target: WatchTarget) {
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

function lockedTargetLine(target: WatchTarget): string {
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
  args: WatchLoopArgs,
  deps: ResolvedWatchDeps,
  target: WatchTarget,
): Promise<void> {
  if (args.json) {
    await writeStdoutChunk(
      deps,
      JSON.stringify(lockedTargetEvent(target)) + '\n',
    );
    return;
  }
  await writeStdoutChunk(deps, lockedTargetLine(target));
}

function baselineGapEvent(
  target: WatchTarget,
  skippedFromIndex: number,
  skippedToIndex: number,
) {
  return {
    type: 'baseline-gap',
    level: 'warning',
    runtime: target.runtime,
    sessionId: target.sessionId,
    skippedFromIndex,
    skippedToIndex,
    nextIndex: target.baselineRecordIndex,
    message: `standalone watch skipped unread range ${skippedFromIndex}-${skippedToIndex} for ${target.key}`,
  };
}

function targetIdentityEvidence(
  target: WatchTarget,
): TranscriptIdentityEvidence {
  return {
    runtime: target.runtime,
    sessionId: target.sessionId,
    transcriptPath: target.transcriptPath,
    recordedCwd: target.recordedCwd,
    mtime: target.candidateMtime,
    size: target.signature.size,
  };
}

function candidateIdentityEvidence(
  candidate: TranscriptCandidate,
): TranscriptIdentityEvidence {
  return {
    runtime: candidate.runtime,
    sessionId: candidate.sessionId,
    transcriptPath: candidate.transcriptPath,
    recordedCwd: candidate.recordedCwd,
    mtime: candidate.mtime,
    size: candidate.size,
  };
}

function newerSessionCandidateEvent(
  target: WatchTarget,
  candidate: TranscriptCandidate,
): NewerSessionCandidateEvent {
  return {
    type: 'newer-session-candidate',
    watched: targetIdentityEvidence(target),
    candidate: candidateIdentityEvidence(candidate),
    message:
      'A newer same-cwd transcript candidate was observed; the watcher remains pinned.',
  };
}

async function emitNewerSessionCandidate(
  args: WatchLoopArgs,
  deps: ResolvedWatchDeps,
  target: WatchTarget,
  candidate: TranscriptCandidate,
): Promise<void> {
  const event = newerSessionCandidateEvent(target, candidate);
  if (args.json) {
    await writeStdoutChunk(deps, JSON.stringify(event) + '\n');
  } else {
    await writeStdoutChunk(
      deps,
      `[session-observer] newer-session-candidate watched=${target.key} ` +
        `candidate=${candidate.runtime}:${candidate.sessionId} ` +
        'watcher-remains-pinned\n',
    );
  }
  await appendEventLog(args.eventLog, event);
}

async function emitBaselineGap(
  args: WatchLoopArgs,
  deps: ResolvedWatchDeps,
  target: WatchTarget,
  skippedFromIndex: number,
  skippedToIndex: number,
): Promise<void> {
  const event = baselineGapEvent(target, skippedFromIndex, skippedToIndex);
  if (args.json) {
    await writeStdoutChunk(deps, JSON.stringify(event) + '\n');
  } else {
    await writeStdoutChunk(
      deps,
      `[session-observer] warning baseline-gap ${target.key} skippedRange=${skippedFromIndex}-${skippedToIndex}\n`,
    );
  }
  await appendEventLog(args.eventLog, event);
}

async function emitWatchPosture(
  args: WatchLoopArgs,
  deps: ResolvedWatchDeps,
): Promise<void> {
  if (args.json) return;
  await writeStdoutChunk(
    deps,
    '[session-observer] Watcher is now active. Keep this process open and continue reading stdout. Do not treat baseline setup as a completed watch.\n',
  );
}

function stoppedEvent(ts: string, reason: string, eventState: WatchEventState) {
  return {
    type: 'stopped',
    ts,
    reason,
    eventCount: eventState.eventCount,
  };
}

function stoppedLine(reason: string, eventState: WatchEventState): string {
  return `[session-observer] watch stopped reason=${reason} deltaEvents=${eventState.eventCount}\n`;
}

async function emitStopped(
  args: WatchLoopArgs,
  deps: ResolvedWatchDeps,
  reason: string,
  eventState: WatchEventState,
): Promise<void> {
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

function errorEvent(ts: string, err: Error) {
  return {
    type: 'error',
    ts,
    message: err.message,
  };
}

async function emitErrorEvent(
  args: WatchLoopArgs,
  deps: ResolvedWatchDeps,
  err: Error,
): Promise<void> {
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

function consumedThrough(lastRecordIndex: unknown): number | null {
  const numeric = Number(lastRecordIndex);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric - 1;
}

export function cursorTargetHealthReasons(
  status: ObservationStatus,
  continuityState: WatchTarget['continuityState'],
): string[] {
  const reasons: string[] = [];
  if (continuityState === 'blocked' || status.health === 'blocked') {
    reasons.push('cursor-continuity-blocked');
  } else if (status.health === 'stale') {
    reasons.push('cursor-health-stale');
  } else if (status.health === 'error') {
    reasons.push('cursor-health-error');
  } else if (status.health === 'unknown') {
    reasons.push('cursor-health-unknown');
  }
  if (status.delivery === 'uncertain') {
    reasons.push('cursor-delivery-uncertain');
  }
  return reasons;
}

async function targetHeartbeatStatus(
  target: WatchTarget,
  sessionState: SessionObserverState,
) {
  if (target.runtime === 'cursor') {
    const status = target.lastStatus ?? emptyCursorStatus();
    const healthReasons = cursorTargetHealthReasons(
      status,
      target.continuityState,
    );
    return {
      runtime: target.runtime,
      sessionId: target.sessionId,
      transcriptPath: target.transcriptPath,
      indexBase: 'zero-based-jsonl-frame-index',
      transcriptRecords: target.recordCount,
      lastRecordIndex: target.observationCursor ?? 0,
      consumedThrough: consumedThrough(target.observationCursor ?? 0),
      recordsBehind:
        target.bufferedFromFrame === null ||
        target.bufferedFromFrame === undefined
          ? 0
          : Math.max(0, target.recordCount - target.bufferedFromFrame),
      healthy: healthReasons.length === 0,
      error: healthReasons[0] ?? null,
      healthReasons,
      status,
      continuityState: target.continuityState,
      bufferedFromFrame: target.bufferedFromFrame ?? null,
      pendingCandidateDeadline:
        target.pendingCandidateDeadline === null ||
        target.pendingCandidateDeadline === undefined
          ? null
          : new Date(target.pendingCandidateDeadline).toISOString(),
    };
  }
  const stored = sessionState.sessions?.[target.key] ?? null;
  const lastRecordIndex = Number.isFinite(Number(stored?.lastRecordIndex))
    ? Number(stored.lastRecordIndex)
    : Number(target.baselineRecordIndex ?? 0);
  let transcriptRecords = null;
  let error = null;
  try {
    transcriptRecords = (await readRecords(target.transcriptPath)).length;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
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
  targets: Map<string, WatchTarget>,
  deps: ResolvedWatchDeps,
  eventState: WatchEventState,
) {
  const sessionState = await stateLib
    .load()
    .catch(() => ({ schemaVersion: 1, sessions: {} }));
  const targetStatuses = [];
  for (const target of targets.values()) {
    targetStatuses.push(await targetHeartbeatStatus(target, sessionState));
  }
  const totalRecordsBehind = targetStatuses.reduce((sum, target) => {
    if (target.recordsBehind === null || !Number.isFinite(target.recordsBehind))
      return sum;
    return sum + target.recordsBehind;
  }, 0);
  const healthy = targetStatuses.every((target) => target.healthy);
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

function heartbeatLine(
  payload: Awaited<ReturnType<typeof heartbeatPayload>>,
): string {
  const status =
    payload.recordsBehind === 0 ? 'no new records' : 'records pending';
  return (
    `[session-observer] still watching, ${status}, ` +
    `recordsBehind=${payload.recordsBehind} healthy=${payload.healthy} targets=${payload.targetCount}\n`
  );
}

async function emitHeartbeat(
  args: WatchLoopArgs,
  targets: Map<string, WatchTarget>,
  deps: ResolvedWatchDeps,
  eventState: WatchEventState,
): Promise<void> {
  const payload = await heartbeatPayload(targets, deps, eventState);
  if (args.json) {
    await writeStdoutChunk(deps, JSON.stringify(payload) + '\n');
    return;
  }
  await writeStdoutChunk(deps, heartbeatLine(payload));
}

function isWithinDir(dir: string, path: string): boolean {
  const rel = relative(dir, path);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function eventLogBoundaryError(dir: string): Error {
  return new Error(
    `--event-log must stay under the session-observer state directory: ${dir}`,
  );
}

function eventLogReservedError(): Error {
  return new Error(
    '--event-log cannot use session-observer state, lock, temp, or backup files',
  );
}

function isReservedEventLogSegment(segment: string): boolean {
  return (
    RESERVED_EVENT_LOG_NAMES.has(segment) ||
    segment.endsWith('.lock') ||
    segment.endsWith('.tmp') ||
    segment.endsWith('.bak') ||
    segment.startsWith('watch.control.') ||
    [...RESERVED_EVENT_LOG_NAMES].some((name) => segment.startsWith(`${name}.`))
  );
}

function eventLogSegments(dir: string, resolved: string): string[] {
  const rel = relative(dir, resolved);
  if (rel === '') return [];
  return rel.split(/[\\/]+/u).filter(Boolean);
}

async function lstatIfExists(path: string) {
  try {
    return await lstat(path);
  } catch (err) {
    if (
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    )
      return null;
    throw err;
  }
}

async function assertRealPathWithinState(
  dir: string,
  realDir: string,
  candidate: string,
): Promise<void> {
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

async function assertEventLogPathSafe(
  dir: string,
  resolved: string,
): Promise<void> {
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

async function resolveEventLogPath(
  eventLog: unknown,
): Promise<string | undefined> {
  if (!eventLog) return undefined;
  const dir = resolve(stateDir());
  const eventLogPath = String(eventLog);
  const resolved = isAbsolute(eventLogPath)
    ? resolve(eventLogPath)
    : resolve(dir, eventLogPath);
  await assertEventLogPathSafe(dir, resolved);
  return resolved;
}

async function appendEventLog(
  eventLog: string | undefined,
  event: unknown,
): Promise<void> {
  if (!eventLog) return;
  await assertEventLogPathSafe(resolve(stateDir()), eventLog);
  await mkdir(dirname(eventLog), { recursive: true });
  await assertEventLogPathSafe(resolve(stateDir()), eventLog);
  await appendFile(eventLog, JSON.stringify(event) + '\n', 'utf8');
}

async function restoreConsumedBaseline(result: ObserveSuccess): Promise<void> {
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
      .catch(() => null);
  }
}

function duplicateTargetError(
  conflictPid: number | undefined,
  key: string,
): Error {
  return new Error(
    `watcher pid ${conflictPid} is already watching ${key}; ` +
      `stop it with watch-ctl stop --pid ${conflictPid} or pin a different --session`,
  );
}

const EMPTY_SHA256 =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function emptyCursorStatus(): ObservationStatus {
  return {
    engagement: 'unknown',
    activity: 'none',
    content: 'none',
    lifecycle: 'none',
    delivery: 'none',
    health: 'unknown',
  };
}

function cursorBufferedFromFrame(
  target: WatchTarget,
  result?: CursorObserveSuccess,
): number | null {
  const bufferedFromFrame = result?.digest.cursorEvidence.bufferedFromFrame;
  return bufferedFromFrame === undefined
    ? (target.bufferedFromFrame ?? null)
    : bufferedFromFrame;
}

function applyCursorTargetState(
  target: WatchTarget,
  state: CursorSessionStateEntry,
  result?: CursorObserveSuccess,
): void {
  target.observationCursor = state.continuity.nextFrameIndex;
  target.baselineRecordIndex = state.continuity.nextFrameIndex;
  target.continuity = structuredClone(state.continuity);
  target.pendingCandidateDeadline = state.stabilityCandidate
    ? Date.parse(state.stabilityCandidate.confirmAfter)
    : null;
  target.lastStatus = structuredClone(state.lastStatus);
  target.bufferedFromFrame = cursorBufferedFromFrame(target, result);
  target.continuityState =
    target.lastStatus.health === 'blocked' ? 'blocked' : 'verified';
  if (result) target.recordCount = result.digest.range.totalFrames;
}

async function persistCursorTarget(
  target: WatchTarget,
  pid: number,
  state: CursorSessionStateEntry,
  result?: CursorObserveSuccess,
): Promise<void> {
  const expectedObservationCursor = target.observationCursor ?? 0;
  const nextStatus = state.lastStatus;
  const updated = await watchStateLib.compareAndSetCursorWatchTarget({
    pid,
    key: target.key,
    expectedObservationCursor,
    next: {
      observationCursor: state.continuity.nextFrameIndex,
      recordCount: result?.digest.range.totalFrames,
      bufferedFromFrame: cursorBufferedFromFrame(target, result),
      continuity: state.continuity,
      pendingCandidateDeadline: state.stabilityCandidate?.confirmAfter ?? null,
      lastStatus: nextStatus,
      continuityState: nextStatus.health === 'blocked' ? 'blocked' : 'verified',
    },
  });
  if (updated.status !== 'updated') {
    throw new Error(
      `Cursor watch target CAS ${updated.status} for ${target.key}`,
    );
  }
  applyCursorTargetState(target, state, result);
}

async function cursorBaselineTarget(
  args: WatchLoopArgs & { cwd: string },
  targets: Map<string, WatchTarget>,
  deps: ResolvedWatchDeps,
  eventState: WatchEventState,
): Promise<WatchTarget> {
  const pinned = args.session?.startsWith('cursor:')
    ? args.session.slice('cursor:'.length)
    : '';
  if (!pinned) {
    throw new Error('Cursor watch requires --session cursor:<sessionId>');
  }
  const candidate = await findSessionCandidate('cursor', args.cwd, pinned);
  if (!candidate) throw new Error(`Pinned Cursor session not found: ${pinned}`);
  const identity = await resolveCursorIdentity(candidate, args.cwd, pinned);
  if (identity.strength !== 'exact') {
    throw new Error(
      `Cursor watch requires exact session identity: ${identity.reasons.join(', ') || identity.strength}`,
    );
  }
  const prior = await cursorStateLib.getCursorSession(pinned);
  const scan = await scanCursorTranscript(identity.canonicalTranscriptPath, {
    verifyPrefixBytes: prior?.continuity.prefixBytes,
    onFrame() {},
  });
  deps.onCursorScan?.();
  const continuity: TranscriptContinuityCheckpoint = prior?.continuity ?? {
    indexBase: 'zero-based-jsonl-frame-index',
    nextFrameIndex: 0,
    prefixBytes: 0,
    prefixSha256: EMPTY_SHA256,
    observedSize: scan.file.size,
    device: scan.file.device,
    inode: scan.file.inode,
  };
  if (continuity.device === null || continuity.inode === null) {
    throw new Error('Cursor watch requires stable device and inode identity');
  }
  const key = targetKey('cursor', pinned);
  const target: WatchTarget = {
    key,
    runtime: 'cursor',
    sessionId: pinned,
    transcriptPath: identity.canonicalTranscriptPath,
    recordedCwd: identity.canonicalCwd,
    signature: { mtimeMs: scan.file.mtimeMs, size: scan.file.size },
    recordCount: scan.totalFrames,
    baselineRecordIndex: continuity.nextFrameIndex,
    candidateMtime: candidate.mtime,
    engagementStatus:
      prior?.lastStatus.engagement ?? candidate.engagementStatus,
    lockedAt: new Date(deps.now()).toISOString(),
    indexBase: 'zero-based-jsonl-frame-index',
    canonicalTranscriptPath: identity.canonicalTranscriptPath,
    observationCursor: continuity.nextFrameIndex,
    bufferedFromFrame: null,
    continuity,
    pendingCandidateDeadline: prior?.stabilityCandidate
      ? Date.parse(prior.stabilityCandidate.confirmAfter)
      : null,
    lastStatus: prior?.lastStatus ?? emptyCursorStatus(),
    continuityState:
      prior?.lastStatus.health === 'blocked' ? 'blocked' : 'verified',
  };
  await watchStateLib.recordWatcherTarget({
    pid: eventState.pid,
    target: {
      ...target,
      indexBase: 'zero-based-jsonl-frame-index',
      canonicalTranscriptPath: identity.canonicalTranscriptPath,
      observationCursor: continuity.nextFrameIndex,
      continuity,
      pendingCandidateDeadline:
        target.pendingCandidateDeadline === null ||
        target.pendingCandidateDeadline === undefined
          ? null
          : new Date(target.pendingCandidateDeadline).toISOString(),
      lastStatus: target.lastStatus,
      continuityState: target.continuityState,
    },
  });
  targets.set(key, target);
  return target;
}

async function finalizeCursorOutput(
  result: CursorObserveSuccess,
  chunk: string,
  deps: ResolvedWatchDeps,
): Promise<void> {
  let asynchronous = false;
  try {
    const callbackExpected = deps.writeStdout.length >= 2;
    let completeCallback: ((error?: Error | null) => void) | undefined;
    const callbackCompletion = callbackExpected
      ? new Promise<void>((fulfill, reject) => {
          completeCallback = (error) => {
            if (error) reject(error);
            else fulfill();
          };
        })
      : null;
    const output = deps.writeStdout(chunk, completeCallback);
    if (output && typeof output === 'object' && 'then' in output) {
      asynchronous = true;
      await output;
    } else if (callbackCompletion) {
      asynchronous = true;
      await callbackCompletion;
    }
  } catch (error) {
    if (result.delivery) {
      await result.delivery.abandon({
        deliveryUncertain: asynchronous,
      });
    }
    throw error;
  }
  if (result.delivery) {
    const committed = await result.delivery.commit();
    if (committed !== 'committed') {
      throw new Error(`Cursor delivery commit ${committed}`);
    }
  }
}

async function emitCursorDelta(
  result: CursorObserveSuccess,
  target: WatchTarget,
  args: WatchLoopArgs,
  deps: ResolvedWatchDeps,
  eventState: WatchEventState,
): Promise<boolean> {
  const newFrames = result.digest.range.newFrames;
  const shouldRender =
    newFrames > 0 &&
    !(args.quietEmpty && result.digest.accounting.rendered.count === 0);
  if (shouldRender) {
    const rendered = renderMarkdown(result.digest);
    const ts = new Date(deps.now()).toISOString();
    await finalizeCursorOutput(
      result,
      args.json
        ? JSON.stringify(stdoutEvent(ts, result.digest, rendered)) + '\n'
        : rendered + '\n',
      deps,
    );
    const committedState = await cursorStateLib.getCursorSession(
      result.digest.sessionId,
    );
    if (committedState) {
      await persistCursorTarget(target, eventState.pid, committedState, result);
    }
    await appendEventLog(
      args.eventLog,
      eventMetadata(ts, result.digest, rendered),
    );
    eventState.eventCount++;
    eventState.lastHeartbeatAt = deps.now();
    await watchStateLib.recordWatcherEvent({
      pid: eventState.pid,
      lastEventAt: ts,
    });
    return true;
  }

  if (result.delivery) {
    const committed = await result.delivery.commit();
    if (committed !== 'committed') {
      throw new Error(`Cursor delivery commit ${committed}`);
    }
  }
  const current = await cursorStateLib.getCursorSession(
    result.digest.sessionId,
  );
  if (current) {
    await persistCursorTarget(target, eventState.pid, current, result);
  }
  return false;
}

async function establishCursorBaseline(
  args: WatchLoopArgs & { cwd: string },
  targets: Map<string, WatchTarget>,
  deps: ResolvedWatchDeps,
  eventState: WatchEventState,
): Promise<WatchTarget> {
  const target = await cursorBaselineTarget(args, targets, deps, eventState);
  const result = await observeCatchUp(
    { ...args, runtime: 'cursor' },
    {
      now: deps.now,
      sleep: deps.sleep,
      ownerPid: eventState.pid,
      onCursorScan: deps.onCursorScan,
    },
  );
  if (!result.ok) {
    if (result.kind === 'continuityBlocked') {
      const state = await cursorStateLib.getCursorSession(target.sessionId);
      if (state) {
        const blockedState = {
          ...state,
          lastStatus: {
            ...state.lastStatus,
            health: 'blocked' as const,
          },
        };
        await persistCursorTarget(target, eventState.pid, blockedState);
      }
      await emitLockedTarget(args, deps, target);
      return target;
    }
    throw new Error(result.message);
  }
  await persistCursorTarget(target, eventState.pid, result.cursorState, result);
  const skippedFromIndex = result.fromIndex;
  const skippedToIndex = result.digest.range.nextIndex - 1;
  const hasStandaloneGap =
    !args.catchUpFirst && skippedToIndex >= skippedFromIndex;
  if (hasStandaloneGap && args.strictBaseline) {
    await result.delivery?.abandon();
    throw new Error(
      `strict baseline refused unread range ${skippedFromIndex}-${skippedToIndex} for ${target.key}`,
    );
  }
  try {
    if (hasStandaloneGap) {
      await emitBaselineGap(
        args,
        deps,
        target,
        skippedFromIndex,
        skippedToIndex,
      );
    }
    await emitLockedTarget(args, deps, target);
  } catch (error) {
    await result.delivery?.abandon({ deliveryUncertain: true });
    throw error;
  }
  if (args.catchUpFirst) {
    await emitCursorDelta(result, target, args, deps, eventState);
  } else {
    if (result.delivery) {
      const committed = await result.delivery.commit();
      if (committed !== 'committed') {
        throw new Error(`Cursor baseline delivery commit ${committed}`);
      }
    }
    const current = await cursorStateLib.getCursorSession(target.sessionId);
    if (current) {
      await persistCursorTarget(target, eventState.pid, current, result);
    }
  }
  target.signature = await fileSignature(target.transcriptPath, deps.stat);
  return target;
}

async function establishBaseline(
  runtime: Runtime | 'auto',
  args: WatchLoopArgs & { cwd: string },
  targets: Map<string, WatchTarget>,
  deps: ResolvedWatchDeps,
  eventState: WatchEventState,
): Promise<WatchTarget | null> {
  if (runtime === 'cursor') {
    return establishCursorBaseline(args, targets, deps, eventState);
  }
  const result = await observeCatchUp({ ...args, runtime });
  if (!result.ok) {
    if (result.kind === 'noMatch') return null;
    throw new Error(result.message);
  }

  const key = targetKey(result.runtime, result.digest.sessionId);
  if (targets.has(key)) return targets.get(key) ?? null;

  const conflict = await watchStateLib
    .findLiveWatcherForTarget({
      runtime: result.runtime,
      sessionId: result.digest.sessionId,
      excludePid: eventState.pid,
    })
    .catch(() => null);
  if (conflict) {
    await restoreConsumedBaseline(result);
    throw duplicateTargetError(conflict.pid, key);
  }

  const signature = await fileSignature(
    result.digest.transcriptPath,
    deps.stat,
  );
  const target: WatchTarget = {
    key,
    runtime: result.runtime,
    sessionId: result.digest.sessionId,
    transcriptPath: result.digest.transcriptPath,
    recordedCwd: result.digest.recordedCwd,
    signature,
    recordCount: result.digest.range.totalRecords,
    baselineRecordIndex: result.digest.range.nextIndex,
    candidateMtime: result.candidate.mtime,
    engagementStatus:
      result.digest.engagement?.status ??
      result.candidate.engagementStatus ??
      'unknown',
    lockedAt: new Date(deps.now()).toISOString(),
  };
  const skippedFromIndex = result.fromIndex;
  const skippedToIndex = target.baselineRecordIndex - 1;
  const hasStandaloneGap =
    !args.catchUpFirst &&
    result.sessionState !== null &&
    skippedToIndex >= skippedFromIndex;
  if (hasStandaloneGap && args.strictBaseline) {
    await restoreConsumedBaseline(result);
    throw new Error(
      `strict baseline refused unread range ${skippedFromIndex}-${skippedToIndex} for ${key}`,
    );
  }
  try {
    await watchStateLib.recordWatcherTarget({
      pid: eventState.pid,
      target: {
        runtime: target.runtime,
        sessionId: target.sessionId,
        transcriptPath: target.transcriptPath,
        recordedCwd: target.recordedCwd,
        recordCount: target.recordCount,
        baselineRecordIndex: target.baselineRecordIndex,
        engagementStatus: target.engagementStatus,
        lockedAt: target.lockedAt,
      },
    });
  } catch (err) {
    const duplicate = err as DuplicateWatchTargetError;
    if (duplicate?.code === 'DUPLICATE_WATCH_TARGET') {
      // Lost the startup race: another watcher recorded this target between
      // the pre-check above and the locked write. Same recovery as above.
      await restoreConsumedBaseline(result);
      throw duplicateTargetError(duplicate.conflictPid, key);
    }
    // Best-effort metadata write; the loop still functions without it.
  }
  targets.set(key, target);
  if (hasStandaloneGap) {
    await emitBaselineGap(args, deps, target, skippedFromIndex, skippedToIndex);
  }
  await emitLockedTarget(args, deps, target);
  await stateLib
    .setWatchedByPid(target.runtime, target.sessionId, eventState.pid)
    .catch(() => false);
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
        firstChangedAt: deps.now(),
        lastChangedAt: deps.now(),
      },
      targets,
      args,
      deps,
      eventState,
    );
  }
  return target;
}

async function enqueueRecordsAppendedDuringBaseline(
  target: WatchTarget,
  pending: Map<string, PendingEntry>,
  deps: ResolvedWatchDeps,
): Promise<void> {
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
  args: WatchLoopArgs & { cwd: string },
  targets: Map<string, WatchTarget>,
  pending: Map<string, PendingEntry>,
  deps: ResolvedWatchDeps,
  eventState: WatchEventState,
): Promise<void> {
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
  targets: Map<string, WatchTarget>,
  pending: Map<string, PendingEntry>,
  nowMs: number,
  statFn: ResolvedWatchDeps['stat'],
  watcherPid: number,
): Promise<void> {
  for (const target of targets.values()) {
    let signature;
    try {
      signature = await fileSignature(target.transcriptPath, statFn);
    } catch {
      if (target.runtime === 'cursor') {
        const state = await cursorStateLib.getCursorSession(target.sessionId);
        if (state) {
          await persistCursorTarget(target, watcherPid, {
            ...state,
            lastStatus: {
              ...(target.lastStatus ?? state.lastStatus),
              health: 'error',
            },
          });
        }
      }
      continue;
    }

    const deadlineReady =
      target.runtime === 'cursor' &&
      target.pendingCandidateDeadline !== null &&
      target.pendingCandidateDeadline !== undefined &&
      nowMs >= target.pendingCandidateDeadline;
    const recoveryVerificationNeeded =
      target.runtime === 'cursor' &&
      (target.lastStatus?.health === 'error' ||
        target.lastStatus?.health === 'stale');
    if (
      !signatureChanged(target.signature, signature) &&
      !deadlineReady &&
      !recoveryVerificationNeeded
    )
      continue;
    target.signature = signature;
    const existing = pending.get(target.key);
    pending.set(target.key, {
      key: target.key,
      runtime: target.runtime,
      sessionId: target.sessionId,
      firstChangedAt: existing?.firstChangedAt ?? nowMs,
      lastChangedAt: nowMs,
      readyAt: recoveryVerificationNeeded
        ? nowMs
        : deadlineReady
          ? target.pendingCandidateDeadline
          : null,
    });
  }
}

function newerCandidateKey(candidate: TranscriptCandidate): string {
  return `${candidate.runtime}:${candidate.sessionId}:${candidate.transcriptPath}`;
}

async function emitNewerSessionCandidates(
  args: WatchLoopArgs & { cwd: string },
  targets: Map<string, WatchTarget>,
  emittedCandidates: Set<string>,
  deps: ResolvedWatchDeps,
  classificationCache: ClassificationCache,
): Promise<void> {
  for (const target of targets.values()) {
    const candidates = await findNewerSameCwdCandidates(
      target.runtime,
      args.cwd,
      {
        sessionId: target.sessionId,
        transcriptPath: target.transcriptPath,
        mtime: target.candidateMtime,
      },
      classificationCache,
    );
    for (const candidate of candidates) {
      const key = newerCandidateKey(candidate);
      if (emittedCandidates.has(key)) continue;
      await emitNewerSessionCandidate(args, deps, target, candidate);
      emittedCandidates.add(key);
    }
  }
}

async function emitPending(
  entry: PendingEntry,
  targets: Map<string, WatchTarget>,
  args: WatchLoopArgs & { cwd: string },
  deps: ResolvedWatchDeps,
  eventState: WatchEventState,
): Promise<boolean> {
  const result =
    entry.runtime === 'cursor'
      ? await observeCatchUp(
          {
            ...args,
            runtime: 'cursor',
            session: `cursor:${entry.sessionId}`,
            suppressWatchedWarningPid: eventState.pid,
          },
          {
            now: deps.now,
            sleep: deps.sleep,
            ownerPid: eventState.pid,
            onCursorScan: deps.onCursorScan,
          },
        )
      : await observeCatchUp({
          ...args,
          runtime: entry.runtime,
          session: `${entry.runtime}:${entry.sessionId}`,
          suppressWatchedWarningPid: eventState.pid,
        });
  if (!result.ok) {
    if (result.kind === 'noMatch') return false;
    if (
      entry.runtime === 'cursor' &&
      (result.kind === 'continuityBlocked' || result.kind === 'ownerConflict')
    ) {
      const target = targets.get(entry.key);
      const state = await cursorStateLib.getCursorSession(entry.sessionId);
      if (target && state) {
        const blockedState: CursorSessionStateEntry = {
          ...state,
          lastStatus: {
            ...state.lastStatus,
            delivery:
              result.kind === 'ownerConflict'
                ? 'uncertain'
                : state.lastStatus.delivery,
            health: result.kind === 'continuityBlocked' ? 'blocked' : 'error',
          },
        };
        await persistCursorTarget(target, eventState.pid, blockedState);
      }
      return false;
    }
    throw new Error(result.message);
  }

  if (result.runtime === 'cursor') {
    const target = targets.get(entry.key);
    if (!target) return false;
    await persistCursorTarget(
      target,
      eventState.pid,
      result.cursorState,
      result,
    );
    target.signature = await fileSignature(target.transcriptPath, deps.stat);
    if (result.deliveryUncertain) return false;
    return emitCursorDelta(result, target, args, deps, eventState);
  }

  const newRecords = result.digest.range.newRecords ?? 0;
  if (newRecords <= 0) return false;
  if (args.quietEmpty && result.digest.accounting.rendered.count === 0) {
    return false;
  }

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
    .catch(() => false);
  return true;
}

async function emitObservedDelta(
  result: ObserveSuccess,
  args: WatchLoopArgs,
  deps: ResolvedWatchDeps,
  eventState: WatchEventState,
): Promise<boolean> {
  const newRecords = result.digest.range.newRecords ?? 0;
  if (newRecords <= 0) return false;
  if (args.quietEmpty && result.digest.accounting.rendered.count === 0) {
    return false;
  }

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
    .catch(() => false);
  return true;
}

async function emitReadyPending(
  args: WatchLoopArgs & { cwd: string },
  targets: Map<string, WatchTarget>,
  pending: Map<string, PendingEntry>,
  deps: ResolvedWatchDeps,
  eventState: WatchEventState,
  { force = false }: { force?: boolean } = {},
): Promise<void> {
  const nowMs = deps.now();
  // oxlint-disable-next-line unicorn/no-useless-spread -- snapshot before pending.delete() mutates the Map during iteration
  for (const entry of [...pending.values()]) {
    const quietForMs = nowMs - entry.lastChangedAt;
    const pendingForMs = nowMs - (entry.firstChangedAt ?? entry.lastChangedAt);
    const ready =
      quietForMs >= eventState.debounceMs ||
      pendingForMs >= eventState.maxPendingMs ||
      (entry.readyAt !== null &&
        entry.readyAt !== undefined &&
        nowMs >= entry.readyAt);
    if (!force && !ready) continue;
    await emitPending(entry, targets, args, deps, eventState);
    pending.delete(entry.key);
  }
}

async function flushPendingBeforeMaxRuntime(
  args: WatchLoopArgs & { cwd: string },
  targets: Map<string, WatchTarget>,
  pending: Map<string, PendingEntry>,
  deps: ResolvedWatchDeps,
  eventState: WatchEventState,
): Promise<void> {
  if (eventState.paused || targets.size === 0) return;
  await pollTargets(targets, pending, deps.now(), deps.stat, eventState.pid);
  await emitReadyPending(args, targets, pending, deps, eventState, {
    force: true,
  });
}

async function applyControlDirective(
  args: WatchLoopArgs & { cwd: string },
  targets: Map<string, WatchTarget>,
  pending: Map<string, PendingEntry>,
  deps: ResolvedWatchDeps,
  eventState: WatchEventState,
): Promise<void> {
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
      await emitReadyPending(args, targets, pending, deps, eventState, {
        force: true,
      });
      return;
    case 'stop':
      eventState.stopRequested = true;
      eventState.stopReason = 'control-stop';
      return;
    default:
      return;
  }
}

function installSignalHandlers(eventState: WatchEventState): () => void {
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
export async function runWatchLoop(
  args: WatchLoopArgs,
  deps: WatchLoopDeps = {},
): Promise<{ reason: string; eventCount: number }> {
  const runtime = args.runtime ?? 'auto';
  const cwd = args.cwd ?? process.cwd();
  const eventLog = args.eventLog
    ? await resolveEventLogPath(args.eventLog)
    : undefined;
  const resolvedMaxPendingMs = maxPendingMs(args.maxPendingSec);
  const resolvedHeartbeatMs = heartbeatMs(args.heartbeatSec);
  const normalizedArgs: WatchLoopArgs & { cwd: string } = {
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
  // startWatcher returns the record for the pid it is given, so the watcher's
  // pid is known before it is announced.
  const watcherPid = deps.pid ?? process.pid;

  const resolvedDeps: ResolvedWatchDeps = {
    now: deps.now ?? Date.now,
    sleep: deps.sleep ?? sleep,
    stat: deps.stat ?? stat,
    writeStdout: deps.writeStdout ?? writeProcessStdout,
    onCursorScan: deps.onCursorScan,
  };
  const targets = new Map<string, WatchTarget>();
  const pending = new Map<string, PendingEntry>();
  const emittedNewerCandidates = new Set<string>();
  // One classification cache per watch process, threaded through every poll
  // tick's newer-candidate discovery. See locate.ts's ClassificationCache:
  // unchanged past-session transcripts are classified once instead of on
  // every tick for the life of the watch.
  const classificationCache = new ClassificationCache();
  const eventState: WatchEventState = {
    pid: watcherPid,
    debounceMs,
    maxPendingMs: resolvedMaxPendingMs,
    eventCount: 0,
    lastHeartbeatAt: startedAtMs,
    heartbeatMs: resolvedHeartbeatMs,
    paused: false,
    stopRequested: false,
    stopReason: 'stopped',
  };
  // Install signal handlers before announcing the watcher active. startWatcher
  // writes watch.json.active, which is the moment a SIGTERM/SIGINT can target
  // this process; installing handlers first guarantees such a signal is handled
  // as a clean shutdown instead of hitting Node's default terminate during the
  // startup window.
  const removeSignalHandlers =
    deps.handleSignals === false ? () => {} : installSignalHandlers(eventState);

  let active: Awaited<ReturnType<typeof watchStateLib.startWatcher>>;
  try {
    active = await watchStateLib.startWatcher({
      runtime,
      cwd,
      pid: watcherPid,
      startedAt: new Date(startedAtMs).toISOString(),
      session: args.session ?? null,
      pollSec: pollMs / 1000,
      debounceSec: debounceMs / 1000,
      maxPendingSec: resolvedMaxPendingMs / 1000,
      heartbeatSec:
        resolvedHeartbeatMs === null ? 0 : resolvedHeartbeatMs / 1000,
      staleAfterSec: (pollMs + debounceMs + resolvedMaxPendingMs) / 1000,
    });
  } catch (err) {
    // startWatcher rejects (e.g. a duplicate target) before the main loop's
    // finally can run, so remove the handlers we just installed to avoid a leak.
    removeSignalHandlers();
    throw err;
  }
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
      await pollTargets(
        targets,
        pending,
        nowMs,
        resolvedDeps.stat,
        eventState.pid,
      );
      await emitNewerSessionCandidates(
        normalizedArgs,
        targets,
        emittedNewerCandidates,
        resolvedDeps,
        classificationCache,
      );
      await applyControlDirective(
        normalizedArgs,
        targets,
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
          targets,
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
        .catch(() => null);

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
  } catch (err) {
    const error: WatchLoopError =
      err instanceof Error ? err : new Error(String(err));
    await watchStateLib
      .recordWatcherError({
        pid: eventState.pid,
        error,
        at: new Date(resolvedDeps.now()).toISOString(),
      })
      .catch(() => null);
    await emitErrorEvent(normalizedArgs, resolvedDeps, error);
    // Setup failures before this try block never reach emitErrorEvent; the
    // CLI uses this marker to emit a stable JSON error event exactly once.
    error.watchErrorEventEmitted = true;
    throw error;
  } finally {
    removeSignalHandlers();
    for (const target of targets.values()) {
      if (target.runtime === 'cursor') continue;
      await stateLib
        .clearWatchedByPid(target.runtime, target.sessionId, active.pid)
        .catch(() => false);
    }
    await watchStateLib
      .clearControlDirective({ pid: active.pid })
      .catch(() => false);
    await watchStateLib.clearWatcher({ pid: active.pid });
  }
}
