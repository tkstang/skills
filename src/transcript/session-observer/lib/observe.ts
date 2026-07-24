/**
 * observe.mjs — reusable catch-up observation pipeline.
 *
 * This module deliberately owns no output or process-exit behavior. Callers get
 * exit-style outcomes they can render for CLI, watch, or future integrations.
 */

import { createHash, randomUUID } from 'node:crypto';
import { open, readFile } from 'node:fs/promises';

import { createCursorTurnAccumulator } from '../../core/cursor-analysis.js';
import {
  scanCursorTranscript,
  type CursorTranscriptScan,
} from '../../core/cursor-frames.js';
import type { Runtime } from '../../core/runtimes.js';
import * as cursorStateLib from './cursor-state.js';
import { buildDigest } from './digest.js';
import {
  discover,
  findSessionCandidate,
  gitWorktrees,
  resolveCursorIdentity,
} from './locate.js';
import { rank } from './rank.js';
import * as stateLib from './state.js';
import type {
  BuildDigestOptions,
  CursorDeliveryHandle,
  CursorDeliveryUncertain,
  CursorCandidateObservation,
  CursorDigestV2,
  CursorDigestEntryV2,
  CursorIdentityEvidence,
  CursorObserveSuccess,
  CursorObserveOutcome,
  CursorSessionStateEntry,
  CursorTurnReconciliation,
  Digest,
  ObserveArgs,
  ObserveDeps,
  ObserveFailure,
  ObserveFailureKind,
  ObserveFailurePayload,
  LegacyObserveOutcome,
  ObserveOutcome,
  ObservedRuntimeResolution,
  PendingCursorDelivery,
  PinnedSession,
  PinnedSessionParseResult,
  RankTier,
  RuntimeCandidateSet,
  SelfIdentityResolution,
  SelfIdentitySignal,
  SessionStateEntry,
  TranscriptContinuityCheckpoint,
  TranscriptCandidate,
} from './types.js';

export const VALID_RUNTIMES: Runtime[] = ['claude-code', 'codex', 'cursor'];
export const VALID_RUNTIME_LABEL = VALID_RUNTIMES.join(', ');

type IdentitySignal = SelfIdentitySignal;
type HarnessIdentityResolution =
  | IdentitySignal
  | { ambiguous: true; signals: IdentitySignal[] }
  | null;

type BudgetedObserveDeps = ObserveDeps & {
  deadlineMs?: number | null;
};

function isRuntime(value: unknown): value is Runtime {
  return typeof value === 'string' && VALID_RUNTIMES.includes(value as Runtime);
}

function parseExplicitSelf(
  value?: string,
  sessionId?: string,
): IdentitySignal | null {
  if (!value) return null;
  const [runtime, ...sessionParts] = value.split(':');
  if (!isRuntime(runtime)) return null;
  return { runtime, sessionId: sessionParts.join(':') || sessionId };
}

function harnessIdentity(
  env: NodeJS.ProcessEnv,
  runtime?: Runtime,
): HarnessIdentityResolution {
  const signals: Array<{
    runtime: Runtime;
    sessionIds: Array<string | undefined>;
    runtimeIndicators: Array<string | undefined>;
  }> = [
    {
      runtime: 'claude-code',
      sessionIds: [env.CLAUDE_CODE_SESSION_ID, env.CLAUDE_SESSION_ID],
      runtimeIndicators: [env.CLAUDECODE, env.CLAUDE_CODE_ENTRYPOINT],
    },
    {
      runtime: 'codex',
      sessionIds: [
        env.CODEX_THREAD_ID,
        env.CODEX_SESSION_ID,
        env.OPENAI_CODEX_SESSION_ID,
      ],
      runtimeIndicators: [env.CODEX_SANDBOX],
    },
    {
      runtime: 'cursor',
      sessionIds: [env.CURSOR_SESSION_ID],
      runtimeIndicators: [env.CURSOR_TRACE_ID, env.CURSOR_AGENT],
    },
  ];
  const matches = signals
    .filter((signal) => !runtime || signal.runtime === runtime)
    .map((signal) => ({
      runtime: signal.runtime,
      sessionIds: [...new Set(signal.sessionIds.filter(Boolean))] as string[],
      hasRuntimeIndicator: signal.runtimeIndicators.some(Boolean),
    }))
    .filter(
      (signal) => signal.sessionIds.length > 0 || signal.hasRuntimeIndicator,
    );

  if (matches.length !== 1 || matches[0].sessionIds.length > 1) {
    const identitySignals = matches.flatMap((match) =>
      match.sessionIds.length > 0
        ? match.sessionIds.map((sessionId) => ({
            runtime: match.runtime,
            sessionId,
          }))
        : [{ runtime: match.runtime }],
    );
    return identitySignals.length > 0
      ? { ambiguous: true, signals: identitySignals }
      : null;
  }
  return {
    runtime: matches[0].runtime,
    sessionId: matches[0].sessionIds[0],
  };
}

async function candidatesForIdentitySignals(
  signals: IdentitySignal[],
  targetCwd: string,
): Promise<TranscriptCandidate[]> {
  const candidateGroups = await Promise.all(
    signals.map(async (signal) => {
      if (signal.sessionId) {
        const candidate = await findSessionCandidate(
          signal.runtime,
          targetCwd,
          signal.sessionId,
        );
        return candidate ? [candidate] : [];
      }
      return (await discover(signal.runtime, targetCwd)).filter(
        (candidate) => candidate.recordedCwd === targetCwd,
      );
    }),
  );
  const seen = new Set<string>();
  return candidateGroups.flat().filter((candidate) => {
    if (seen.has(candidate.transcriptPath)) return false;
    seen.add(candidate.transcriptPath);
    return true;
  });
}

export async function resolveSelfIdentity(
  targetCwd: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<SelfIdentityResolution> {
  const explicit = parseExplicitSelf(
    env.SESSION_OBSERVER_SELF,
    env.SESSION_OBSERVER_SESSION_ID,
  );
  const harness = harnessIdentity(env, explicit?.runtime);
  if (!explicit?.sessionId && harness && 'ambiguous' in harness) {
    const signals = harness.signals;
    const runtimes = [...new Set(signals.map((signal) => signal.runtime))];
    return {
      ambiguous: true,
      runtime: runtimes.length === 1 ? runtimes[0] : undefined,
      signals,
      candidates: await candidatesForIdentitySignals(signals, targetCwd),
    };
  }
  const harnessSignal =
    harness && !('ambiguous' in harness) ? harness : undefined;
  const signal = explicit?.sessionId
    ? explicit
    : harnessSignal?.sessionId
      ? harnessSignal
      : (explicit ?? harnessSignal);

  if (!signal) return { noMatch: true };

  if (signal.sessionId) {
    const candidate = await findSessionCandidate(
      signal.runtime,
      targetCwd,
      signal.sessionId,
    );
    if (!candidate) return { noMatch: true, runtime: signal.runtime };
    return {
      identity: {
        runtime: signal.runtime,
        session: candidate.sessionId,
        transcript: candidate.transcriptPath,
        source: explicit?.sessionId ? 'explicit-self' : 'harness-environment',
      },
    };
  }

  const candidates = (await discover(signal.runtime, targetCwd)).filter(
    (candidate) => candidate.recordedCwd === targetCwd,
  );
  if (candidates.length === 1) {
    return {
      identity: {
        runtime: signal.runtime,
        session: candidates[0].sessionId,
        transcript: candidates[0].transcriptPath,
        source: 'same-cwd-transcript',
      },
    };
  }
  if (candidates.length > 1) {
    return {
      ambiguous: true,
      runtime: signal.runtime,
      signals: [{ runtime: signal.runtime }],
      candidates,
    };
  }
  return { noMatch: true, runtime: signal.runtime, candidates };
}

export function parsePinnedSession(session?: string): PinnedSessionParseResult {
  if (!session) return null;
  const colonIndex = session.indexOf(':');
  if (colonIndex === -1) {
    return {
      error:
        '--session must be in <runtime>:<sessionId> format (e.g. codex:abc123)',
    };
  }
  const runtime = session.slice(0, colonIndex);
  const sessionId = session.slice(colonIndex + 1);
  if (!isRuntime(runtime)) {
    return {
      error: `Unknown runtime in --session: ${runtime}. Use one of: ${VALID_RUNTIME_LABEL}.`,
    };
  }
  return { runtime, sessionId };
}

export function shouldMarkCatchUpRead(
  sessionState: SessionStateEntry | null,
  digest: Digest,
): boolean {
  if (digest.range.newRecords > 0) return true;
  if (!sessionState) return true;
  return (
    sessionState.lastRecordIndex !== digest.range.nextIndex ||
    sessionState.lastTotalRecords !== digest.range.totalRecords
  );
}

async function preferredRuntimeFromState(
  withCandidates: RuntimeCandidateSet[],
  targetCwd: string,
): Promise<ObservedRuntimeResolution | null> {
  let state;
  try {
    state = await stateLib.load();
  } catch {
    return null;
  }

  const runtimeSet = new Set(withCandidates.map((r) => r.runtime));
  const sessionIdsByRuntime = new Map(
    withCandidates.map((r) => [
      r.runtime,
      new Set(r.candidates.map((c) => c.sessionId)),
    ]),
  );

  const matches = Object.values(state.sessions ?? {})
    .filter((s) => runtimeSet.has(s.runtime))
    .filter((s) => s.recordedCwd === targetCwd)
    .filter((s) => sessionIdsByRuntime.get(s.runtime)?.has(s.sessionId))
    .toSorted((a, b) =>
      String(b.lastReadAt ?? '').localeCompare(String(a.lastReadAt ?? '')),
    );

  const runtimes = [...new Set(matches.map((s) => s.runtime))];
  if (runtimes.length !== 1) return null;
  return {
    runtime: runtimes[0],
    reason: 'state-cwd-prior-session',
    sessionId: matches[0]?.sessionId,
  };
}

export async function resolveAutoRuntime(
  targetCwd: string,
  { self = process.env.SESSION_OBSERVER_SELF }: { self?: string } = {},
): Promise<ObservedRuntimeResolution> {
  const results = await Promise.all(
    VALID_RUNTIMES.map(async (rt): Promise<RuntimeCandidateSet> => {
      try {
        const candidates = await discover(rt, targetCwd);
        return { runtime: rt, candidates };
      } catch {
        return { runtime: rt, candidates: [] };
      }
    }),
  );

  const withCandidates = results.filter((r) => r.candidates.length > 0);
  const considered = isRuntime(self)
    ? withCandidates.filter((r) => r.runtime !== self)
    : withCandidates;

  if (considered.length === 1) return { runtime: considered[0].runtime };
  if (considered.length === 0) return { noMatch: true };

  const preferred = await preferredRuntimeFromState(considered, targetCwd);
  if (preferred) return preferred;

  return {
    ambiguous: true,
    runtimes: considered.map((r) => r.runtime),
    candidates: Object.fromEntries(
      considered.map((r) => [r.runtime, r.candidates]),
    ),
  };
}

export async function applySnippetFilter(
  candidates: TranscriptCandidate[],
  snippet?: string,
): Promise<{
  candidates: TranscriptCandidate[];
  matches: TranscriptCandidate[];
}> {
  if (!snippet) return { candidates, matches: [] };
  const needle = snippet.toLowerCase();
  const matches: TranscriptCandidate[] = [];
  for (const candidate of candidates) {
    let raw;
    try {
      raw = await readFile(candidate.transcriptPath, 'utf8');
    } catch {
      continue;
    }
    const index = raw.toLowerCase().indexOf(needle);
    if (index === -1) continue;
    const start = Math.max(0, index - 80);
    const end = Math.min(raw.length, index + snippet.length + 80);
    const snippetMatch = {
      excerpt: snippet,
      context: raw.slice(start, end).replace(/\s+/g, ' ').trim(),
    };
    matches.push({ ...candidate, snippetMatch });
  }
  return { candidates: matches, matches };
}

function noMatchOutcome(
  payload: ObserveFailurePayload,
  message: string,
): ObserveFailure {
  return { ok: false, kind: 'noMatch', exitCode: 2, payload, message };
}

function inputNeededOutcome(
  kind: Exclude<ObserveFailureKind, 'noMatch' | 'error'>,
  payload: ObserveFailurePayload,
  message: string,
): ObserveFailure {
  return { ok: false, kind, exitCode: 3, payload, message };
}

function errorOutcome(message: string): ObserveFailure {
  return { ok: false, kind: 'error', exitCode: 1, payload: {}, message };
}

function unengagedOnlyMessage(runtime: string, cwd: string): string {
  return (
    `The only ${runtime} session for this cwd has no user conversation yet: ${cwd}. ` +
    'It looks like a freshly spawned/bootstrap session you have not engaged with. ' +
    'Did you mean a different session (another runtime, a sister worktree, or a specific session id)?'
  );
}

async function sessionStateFor(
  runtime: Runtime,
  sessionId: string,
): Promise<SessionStateEntry | null> {
  try {
    return await stateLib.getSession(runtime, sessionId);
  } catch {
    return null;
  }
}

async function markReadIfNeeded(
  runtime: Runtime,
  candidate: TranscriptCandidate,
  sessionState: SessionStateEntry | null,
  digest: Digest,
): Promise<boolean> {
  if (!shouldMarkCatchUpRead(sessionState, digest)) return false;
  try {
    await stateLib.markRead(runtime, candidate.sessionId, {
      lastRecordIndex: digest.range.nextIndex,
      lastTotalRecords: digest.range.totalRecords,
      transcriptPath: candidate.transcriptPath,
      recordedCwd: candidate.recordedCwd,
    });
    return true;
  } catch {
    return false;
  }
}

function watchedByPidWarnings(
  sessionState: SessionStateEntry | null,
  suppressWatchedWarningPid?: number,
): string[] {
  const watchedByPid = sessionState?.watchedByPid;
  if (!watchedByPid || watchedByPid === suppressWatchedWarningPid) return [];
  return [
    `watcher pid ${watchedByPid} is also reading this session; offsets may interleave (benign)`,
  ];
}

async function buildCatchUpDigest(
  runtime: Runtime,
  candidate: TranscriptCandidate,
  {
    fromIndex,
    includeTools,
    includeToolResults,
    includeCommandMessages,
    maxTurns,
    maxBytes,
    matchedTier = null,
    active = false,
    warnings = [],
    fallbacks = [],
  }: BuildDigestOptions & {
    includeTools?: boolean;
    matchedTier?: RankTier | null;
  },
): Promise<Digest> {
  return buildDigest(runtime, candidate.transcriptPath, {
    fromIndex,
    mode: 'catch-up',
    includeToolCalls: includeTools,
    includeToolResults,
    includeCommandMessages,
    maxTurns,
    maxBytes,
    sessionId: candidate.sessionId,
    recordedCwd: candidate.recordedCwd,
    matchedTier,
    active,
    warnings,
    fallbacks,
  });
}

const EMPTY_SHA256 =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

interface CursorScanResult {
  scan: CursorTranscriptScan;
  analysis: ReturnType<
    ReturnType<typeof createCursorTurnAccumulator>['finish']
  >;
  frameEnds: Array<number | null>;
}

function initialCursorStatus(): CursorSessionStateEntry['lastStatus'] {
  return {
    engagement: 'unknown',
    activity: 'none',
    content: 'none',
    lifecycle: 'none',
    delivery: 'none',
    health: 'unknown',
  };
}

function initialCursorSession(
  identity: CursorIdentityEvidence,
  scan: CursorTranscriptScan,
): CursorSessionStateEntry {
  return {
    runtime: 'cursor',
    sessionId: identity.sessionId,
    indexBase: 'zero-based-jsonl-frame-index',
    lastRecordIndex: 0,
    canonicalCwd: identity.canonicalCwd,
    transcriptPath: identity.canonicalTranscriptPath,
    continuity: {
      indexBase: 'zero-based-jsonl-frame-index',
      nextFrameIndex: 0,
      prefixBytes: 0,
      prefixSha256: EMPTY_SHA256,
      observedSize: scan.file.size,
      device: scan.file.device,
      inode: scan.file.inode,
    },
    lastStatus: initialCursorStatus(),
    openTurn: null,
    stabilityCandidate: null,
    pendingDelivery: null,
  };
}

async function scanCursor(
  identity: CursorIdentityEvidence,
  fromFrameIndex: number,
  verifyPrefixBytes: number | undefined,
  deps: ObserveDeps,
): Promise<CursorScanResult> {
  const accumulator = createCursorTurnAccumulator(identity, fromFrameIndex);
  const frameEnds: Array<number | null> = [];
  const scan = await scanCursorTranscript(identity.canonicalTranscriptPath, {
    verifyPrefixBytes,
    onFrame(frame) {
      accumulator.onFrame(frame);
      frameEnds[frame.frameIndex] =
        frame.closed &&
        (frame.parseState === 'parsed' || frame.parseState === 'blank')
          ? frame.byteEnd
          : null;
    },
  });
  deps.onCursorScan?.();
  return { scan, analysis: accumulator.finish(scan), frameEnds };
}

function cursorCandidateObservation(
  result: CursorScanResult,
  observedAt: string,
  fromFrameIndex = 0,
): CursorCandidateObservation | null {
  const turn = result.analysis.turns.findLast(
    (candidate) =>
      candidate.lifecycle === 'pending' &&
      candidate.assistantRecords.some(
        (record) =>
          record.classification === 'substantive' &&
          record.sourceFrameIndex >= fromFrameIndex,
      ),
  );
  if (turn === undefined || result.scan.safeThroughFrame === null) return null;
  return {
    turnId: turn.turnId,
    fromFrameIndex: Math.max(turn.fromFrameIndex, fromFrameIndex),
    throughFrameIndex: result.scan.safeThroughFrame,
    entryKeys: turn.assistantRecords
      .filter(
        (record) =>
          record.classification === 'substantive' &&
          record.sourceFrameIndex >= fromFrameIndex,
      )
      .map((record) => record.entryKey),
    prefixBytes: result.scan.safePrefixBytes,
    prefixSha256: result.scan.safePrefixSha256,
    observedAt,
  };
}

function sameEntryKeys(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((entryKey, index) => entryKey === right[index])
  );
}

function cursorObservationAtBoundary(
  result: CursorScanResult,
  boundary: Omit<CursorCandidateObservation, 'observedAt'>,
  observedAt: string,
): CursorCandidateObservation | null {
  if (
    result.scan.safeThroughFrame === null ||
    result.scan.safeThroughFrame < boundary.throughFrameIndex ||
    result.frameEnds[boundary.throughFrameIndex] !== boundary.prefixBytes
  ) {
    return null;
  }
  const turn = result.analysis.turns.find(
    (candidate) => candidate.turnId === boundary.turnId,
  );
  if (
    turn === undefined ||
    boundary.fromFrameIndex < turn.fromFrameIndex ||
    boundary.fromFrameIndex > boundary.throughFrameIndex
  ) {
    return null;
  }
  const entryKeys = turn.assistantRecords
    .filter(
      (record) =>
        record.classification === 'substantive' &&
        record.sourceFrameIndex >= boundary.fromFrameIndex &&
        record.sourceFrameIndex <= boundary.throughFrameIndex,
    )
    .map((record) => record.entryKey);
  if (!sameEntryKeys(entryKeys, boundary.entryKeys)) return null;
  return {
    turnId: boundary.turnId,
    fromFrameIndex: boundary.fromFrameIndex,
    throughFrameIndex: boundary.throughFrameIndex,
    entryKeys,
    prefixBytes: boundary.prefixBytes,
    prefixSha256: boundary.prefixSha256,
    observedAt,
  };
}

async function captureCursorCheckpoint(
  transcriptPath: string,
  result: CursorScanResult,
  nextFrameIndex: number,
): Promise<TranscriptContinuityCheckpoint | null> {
  const prefixBytes =
    nextFrameIndex === 0 ? 0 : result.frameEnds[nextFrameIndex - 1];
  if (
    !Number.isSafeInteger(nextFrameIndex) ||
    nextFrameIndex < 0 ||
    prefixBytes === null ||
    prefixBytes === undefined ||
    result.scan.file.device === null ||
    result.scan.file.inode === null ||
    prefixBytes > result.scan.safePrefixBytes
  ) {
    return null;
  }

  const selectedHash = createHash('sha256');
  const safeHash = createHash('sha256');
  const handle = await open(transcriptPath, 'r');
  try {
    const before = await handle.stat();
    if (
      before.dev !== result.scan.file.device ||
      before.ino !== result.scan.file.inode ||
      before.size < result.scan.safePrefixBytes
    ) {
      return null;
    }
    let bytesRead = 0;
    if (result.scan.safePrefixBytes > 0) {
      const stream = handle.createReadStream({
        autoClose: false,
        start: 0,
        end: result.scan.safePrefixBytes - 1,
      });
      for await (const chunk of stream) {
        const selectedRemaining = prefixBytes - bytesRead;
        if (selectedRemaining > 0) {
          selectedHash.update(
            chunk.subarray(0, Math.min(selectedRemaining, chunk.byteLength)),
          );
        }
        safeHash.update(chunk);
        bytesRead += chunk.byteLength;
      }
    }
    const after = await handle.stat();
    if (
      bytesRead !== result.scan.safePrefixBytes ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size < result.scan.safePrefixBytes ||
      safeHash.digest('hex') !== result.scan.safePrefixSha256
    ) {
      return null;
    }
    return {
      indexBase: 'zero-based-jsonl-frame-index',
      nextFrameIndex,
      prefixBytes,
      prefixSha256: selectedHash.digest('hex'),
      observedSize: prefixBytes,
      device: before.dev,
      inode: before.ino,
    };
  } finally {
    await handle.close();
  }
}

function reconstructUncertainReplay(
  pending: PendingCursorDelivery,
  result: CursorScanResult,
): CursorDigestEntryV2[] | null {
  const { intendedCheckpoint } = pending;
  if (
    intendedCheckpoint.nextFrameIndex !==
      pending.reservedThroughFrameIndex + 1 ||
    intendedCheckpoint.nextFrameIndex < pending.expectedNextFrameIndex ||
    result.scan.file.device !== intendedCheckpoint.device ||
    result.scan.file.inode !== intendedCheckpoint.inode ||
    result.scan.file.size < intendedCheckpoint.prefixBytes ||
    result.scan.totalFrames < intendedCheckpoint.nextFrameIndex ||
    result.scan.verifiedPrefixSha256 !== intendedCheckpoint.prefixSha256 ||
    new Set(pending.entryKeys).size !== pending.entryKeys.length
  ) {
    return null;
  }

  const records = new Map(
    result.analysis.turns.flatMap((turn) =>
      turn.assistantRecords
        .filter(
          (record) =>
            record.classification === 'substantive' &&
            record.sourceFrameIndex >= pending.expectedNextFrameIndex &&
            record.sourceFrameIndex <= pending.reservedThroughFrameIndex,
        )
        .map((record) => [record.entryKey, { record, turn }] as const),
    ),
  );
  const replay = pending.entryKeys.map((entryKey) => {
    const matched = records.get(entryKey);
    if (!matched) return null;
    const terminalFrameIndex = matched.turn.terminalFrameIndex;
    const completedWithinReservation =
      matched.turn.lifecycle === 'success' &&
      terminalFrameIndex !== null &&
      terminalFrameIndex <= pending.reservedThroughFrameIndex;
    return {
      role: 'assistant' as const,
      text: matched.record.text,
      recordIndex: completedWithinReservation
        ? terminalFrameIndex
        : matched.record.sourceFrameIndex,
      sourceFrameIndex: matched.record.sourceFrameIndex,
      kind: 'message' as const,
      entryKey: matched.record.entryKey,
      turnId: matched.record.turnId,
      availability: completedWithinReservation
        ? ('completed' as const)
        : ('pending-lifecycle' as const),
    };
  });
  if (
    replay.some((entry) => entry === null) ||
    replay.some(
      (entry, index) =>
        index > 0 &&
        entry!.sourceFrameIndex < replay[index - 1]!.sourceFrameIndex,
    )
  ) {
    return null;
  }
  return replay as CursorDigestEntryV2[];
}

function cursorOpenTurn(
  state: CursorSessionStateEntry,
  scanResult: CursorScanResult,
  digest: CursorDigestV2,
): CursorTurnReconciliation | null {
  const turn = scanResult.analysis.turns.findLast(
    (candidate) => candidate.lifecycle === 'pending',
  );
  if (turn === undefined) return null;
  const prior =
    state.openTurn?.turnId === turn.turnId ? state.openTurn : undefined;
  return {
    turnId: turn.turnId,
    fromFrameIndex: turn.fromFrameIndex,
    observedThroughFrame: turn.observedThroughFrame,
    deliveredEntryKeys: [
      ...new Set([
        ...(prior?.deliveredEntryKeys ?? []),
        ...digest.entries.map((entry) => entry.entryKey),
      ]),
    ],
    assistantEntryKeys: [
      ...new Set([
        ...(prior?.assistantEntryKeys ?? []),
        ...turn.assistantRecords.map((record) => record.entryKey),
      ]),
    ],
    humanRecordIndexes: [
      ...new Set([
        ...(prior?.humanRecordIndexes ?? []),
        ...turn.humanRecordIndexes,
      ]),
    ],
    toolRecordIndexes: [
      ...new Set([
        ...(prior?.toolRecordIndexes ?? []),
        ...turn.toolRecordIndexes,
      ]),
    ],
    hasHumanInput:
      (prior?.hasHumanInput ?? false) || turn.humanRecordIndexes.length > 0,
    hasAutomaticControlInput: prior?.hasAutomaticControlInput ?? false,
    lifecycle: 'pending',
  };
}

function createDeliveryHandle(input: {
  sessionId: string;
  deliveryId: string;
  ownerPid: number;
  entryKeys: string[];
  nextState: CursorSessionStateEntry;
  nextCandidateObservation: CursorCandidateObservation | null;
  stabilityMs: number;
}): CursorDeliveryHandle {
  let finalized = false;
  const finalize = (): void => {
    if (finalized) {
      throw new Error('CURSOR_DELIVERY_ALREADY_FINALIZED');
    }
    finalized = true;
  };
  return {
    deliveryId: input.deliveryId,
    sessionId: input.sessionId,
    ownerPid: input.ownerPid,
    entryKeys: [...input.entryKeys],
    async commit() {
      finalize();
      const committed = await cursorStateLib.commitCursorDelivery({
        sessionId: input.sessionId,
        deliveryId: input.deliveryId,
        nextState: input.nextState,
      });
      if (
        committed === 'committed' &&
        input.nextCandidateObservation !== null
      ) {
        await cursorStateLib.checkpointCursorCandidate({
          sessionId: input.sessionId,
          stabilityMs: input.stabilityMs,
          observation: input.nextCandidateObservation,
        });
      }
      return committed;
    },
    async abandon(options) {
      finalize();
      if (options?.deliveryUncertain) {
        const current = await cursorStateLib.getCursorSession(input.sessionId);
        if (current?.pendingDelivery?.deliveryId !== input.deliveryId) {
          return 'stale';
        }
        if (current.pendingDelivery.reservedByPid !== input.ownerPid) {
          return 'owner-conflict';
        }
        const recovery = await cursorStateLib.recoverCursorDelivery(
          input.sessionId,
        );
        return recovery.status === 'none' ? 'stale' : recovery.status;
      }
      return cursorStateLib.abandonCursorDelivery({
        sessionId: input.sessionId,
        deliveryId: input.deliveryId,
        ownerPid: input.ownerPid,
      });
    },
  };
}

async function observeCursorSession(
  cwd: string,
  candidate: TranscriptCandidate,
  args: ObserveArgs,
  deps: ObserveDeps,
  rankResult?: ReturnType<typeof rank>,
): Promise<ObserveOutcome> {
  const expectedSessionId = args.session
    ? parsePinnedSession(args.session)
    : null;
  const identity = await resolveCursorIdentity(
    candidate,
    cwd,
    expectedSessionId && !('error' in expectedSessionId)
      ? expectedSessionId.sessionId
      : undefined,
  );
  if (identity.strength !== 'exact') {
    return inputNeededOutcome(
      'identityBlocked',
      {
        identityBlocked: true,
        runtime: 'cursor',
        cwd,
        reasons: identity.reasons,
      },
      `Cursor observation requires exact session identity: ${identity.reasons.join(', ') || identity.strength}`,
    );
  }

  let state = await cursorStateLib.getCursorSession(identity.sessionId);
  const analysisFromFrame =
    state?.openTurn?.fromFrameIndex ?? state?.continuity.nextFrameIndex ?? 0;
  const first = await scanCursor(
    identity,
    analysisFromFrame,
    state?.continuity.prefixBytes,
    deps,
  );
  const continuity = cursorStateLib.validateCursorContinuity(
    identity,
    first.scan,
    state,
  );
  if (continuity.status === 'blocked') {
    return inputNeededOutcome(
      'continuityBlocked',
      {
        continuityBlocked: true,
        runtime: 'cursor',
        cwd,
        code: continuity.code,
        message: continuity.message,
      },
      continuity.message,
    );
  }
  if (first.scan.blockingFrame?.parseState === 'malformed') {
    return inputNeededOutcome(
      'continuityBlocked',
      {
        continuityBlocked: true,
        runtime: 'cursor',
        cwd,
        code: 'MALFORMED_FRAME',
      },
      `Cursor transcript is blocked by malformed frame ${first.scan.blockingFrame.frameIndex}.`,
    );
  }

  if (state === null) {
    state = initialCursorSession(identity, first.scan);
    await cursorStateLib.setCursorSession(state);
  }

  let deliveryUncertain: CursorDeliveryUncertain | null = null;
  if (state.pendingDelivery !== null) {
    const recovery = await cursorStateLib.recoverCursorDelivery(
      identity.sessionId,
    );
    if (recovery.status === 'delivery-uncertain') {
      deliveryUncertain = recovery;
      state =
        (await cursorStateLib.getCursorSession(identity.sessionId)) ?? state;
    }
  }

  let selected = first;
  let selectedObservedAt = new Date(deps.now?.() ?? Date.now()).toISOString();
  let confirmedObservation: CursorCandidateObservation | null = null;
  const stabilityMs = Math.max(0, (args.debounceSec ?? 1) * 1000);
  const deadlineMs = (deps as BudgetedObserveDeps).deadlineMs ?? null;
  let uncertainReplay: CursorDigestEntryV2[] | null = null;
  if (deliveryUncertain === null) {
    const storedCandidate = state.stabilityCandidate;
    const deliveredEntryKeys = new Set(
      state.openTurn?.deliveredEntryKeys ?? [],
    );
    const storedCandidateHasUndeliveredEntry =
      storedCandidate !== null &&
      storedCandidate.entryKeys.some(
        (entryKey) => !deliveredEntryKeys.has(entryKey),
      );
    let firstObservation: CursorCandidateObservation | null = null;
    if (storedCandidate !== null && storedCandidateHasUndeliveredEntry) {
      const storedCheckpoint = await captureCursorCheckpoint(
        identity.canonicalTranscriptPath,
        first,
        storedCandidate.throughFrameIndex + 1,
      );
      if (
        storedCheckpoint?.prefixBytes === storedCandidate.prefixBytes &&
        storedCheckpoint.prefixSha256 === storedCandidate.prefixSha256
      ) {
        firstObservation = cursorObservationAtBoundary(
          first,
          storedCandidate,
          selectedObservedAt,
        );
      }
    }
    firstObservation ??= cursorCandidateObservation(
      first,
      selectedObservedAt,
      state.continuity.nextFrameIndex,
    );
    if (firstObservation !== null) {
      const checkpoint = await cursorStateLib.checkpointCursorCandidate({
        sessionId: identity.sessionId,
        stabilityMs,
        observation: firstObservation,
      });
      if (checkpoint.status === 'confirmed') {
        const verifiedBoundary = await captureCursorCheckpoint(
          identity.canonicalTranscriptPath,
          first,
          firstObservation.throughFrameIndex + 1,
        );
        if (
          verifiedBoundary?.prefixBytes === firstObservation.prefixBytes &&
          verifiedBoundary.prefixSha256 === firstObservation.prefixSha256
        ) {
          confirmedObservation = cursorObservationAtBoundary(
            first,
            firstObservation,
            selectedObservedAt,
          );
        }
      } else {
        const nowMs = deps.now?.() ?? Date.now();
        const remainingMs =
          deadlineMs === null ? null : Math.max(0, deadlineMs - nowMs);
        if (remainingMs === null || stabilityMs <= remainingMs) {
          const waitMs =
            remainingMs === null
              ? stabilityMs
              : Math.min(stabilityMs, remainingMs);
          await (deps.sleep?.(waitMs) ??
            new Promise((resolve) => setTimeout(resolve, waitMs)));
          selectedObservedAt = new Date(
            Math.max(
              deps.now?.() ?? Date.now(),
              Date.parse(firstObservation.observedAt) + stabilityMs,
            ),
          ).toISOString();
          const second = await scanCursor(
            identity,
            analysisFromFrame,
            firstObservation.prefixBytes,
            deps,
          );
          const confirmedBoundary = cursorObservationAtBoundary(
            second,
            firstObservation,
            selectedObservedAt,
          );
          if (confirmedBoundary !== null) {
            const verifiedBoundary = await captureCursorCheckpoint(
              identity.canonicalTranscriptPath,
              second,
              firstObservation.throughFrameIndex + 1,
            );
            if (
              verifiedBoundary?.prefixBytes === firstObservation.prefixBytes &&
              verifiedBoundary.prefixSha256 ===
                second.scan.verifiedPrefixSha256 &&
              verifiedBoundary.prefixSha256 === firstObservation.prefixSha256
            ) {
              const confirmation =
                await cursorStateLib.checkpointCursorCandidate({
                  sessionId: identity.sessionId,
                  stabilityMs,
                  observation: confirmedBoundary,
                });
              if (confirmation.status === 'confirmed') {
                confirmedObservation = confirmedBoundary;
              }
            }
          }
          selected = second;
        }
      }
      state =
        (await cursorStateLib.getCursorSession(identity.sessionId)) ?? state;
    }
  } else {
    const pending = state.pendingDelivery;
    if (pending === null) {
      return inputNeededOutcome(
        'continuityBlocked',
        {
          continuityBlocked: true,
          runtime: 'cursor',
          cwd,
          code: 'DELIVERY_REPLAY_RECONSTRUCTION_FAILED',
        },
        'Cursor uncertain delivery reservation is unavailable for exact replay.',
      );
    }
    selected = await scanCursor(
      identity,
      analysisFromFrame,
      pending.intendedCheckpoint.prefixBytes,
      deps,
    );
    uncertainReplay = reconstructUncertainReplay(pending, selected);
    if (uncertainReplay === null) {
      return inputNeededOutcome(
        'continuityBlocked',
        {
          continuityBlocked: true,
          runtime: 'cursor',
          cwd,
          code: 'DELIVERY_REPLAY_RECONSTRUCTION_FAILED',
        },
        'Cursor uncertain delivery cannot be reconstructed from the exact reserved prefix.',
      );
    }
  }

  const digest = (await buildDigest('cursor', candidate.transcriptPath, {
    ...args,
    fromIndex: continuity.fromFrameIndex,
    mode: 'catch-up',
    includeToolCalls: args.includeTools,
    includeToolResults: args.includeToolResults,
    includeCommandMessages: args.includeCommandMessages,
    sessionId: candidate.sessionId,
    recordedCwd: candidate.recordedCwd,
    matchedTier:
      rankResult && 'tier' in rankResult ? rankResult.tier : undefined,
    active: candidate.active ?? false,
    warnings: [],
    fallbacks:
      rankResult && 'fallbacks' in rankResult ? rankResult.fallbacks : [],
    cursorProjection: 'observation',
    cursorIdentity: identity,
    cursorScan: selected.scan,
    cursorAnalysis: selected.analysis,
    cursorState:
      deliveryUncertain === null && confirmedObservation === null
        ? { ...state, stabilityCandidate: null }
        : state,
    cursorContinuity: continuity.status,
  })) as CursorDigestV2;

  if (deliveryUncertain !== null) {
    const pending = state.pendingDelivery!;
    digest.entries = uncertainReplay!;
    digest.range.fromIndex = pending.expectedNextFrameIndex;
    digest.range.toIndex = pending.reservedThroughFrameIndex;
    digest.range.nextIndex = pending.intendedCheckpoint.nextFrameIndex;
    digest.range.newFrames =
      pending.intendedCheckpoint.nextFrameIndex -
      pending.expectedNextFrameIndex;
    digest.accounting.raw = {
      fromIndex: pending.expectedNextFrameIndex,
      toIndex: pending.reservedThroughFrameIndex,
      count:
        pending.intendedCheckpoint.nextFrameIndex -
        pending.expectedNextFrameIndex,
      nextIndex: pending.intendedCheckpoint.nextFrameIndex,
      totalFrames: selected.scan.totalFrames,
    };
    digest.accounting.rendered = {
      count: digest.entries.length,
      fromIndex:
        digest.entries.length === 0
          ? null
          : Math.min(...digest.entries.map((entry) => entry.recordIndex)),
      toIndex:
        digest.entries.length === 0
          ? null
          : Math.max(...digest.entries.map((entry) => entry.recordIndex)),
    };
    digest.range.renderedFromIndex = digest.accounting.rendered.fromIndex;
    digest.range.renderedToIndex = digest.accounting.rendered.toIndex;
    digest.cursorEvidence.status.delivery = 'uncertain';
    return {
      ok: true,
      runtime: 'cursor',
      candidate,
      rankResult,
      digest: digest as CursorObserveSuccess['digest'],
      sessionState: null,
      cursorState: state,
      fromIndex: continuity.fromFrameIndex,
      markedRead: false,
      delivery: null,
      deliveryUncertain,
    };
  }

  let delivery: CursorDeliveryHandle | null = null;
  const intendedCheckpoint = await captureCursorCheckpoint(
    identity.canonicalTranscriptPath,
    selected,
    digest.range.nextIndex,
  );
  if (
    digest.range.nextIndex > continuity.fromFrameIndex &&
    intendedCheckpoint !== null
  ) {
    const ownerPid = deps.ownerPid ?? process.pid;
    const deliveryId = randomUUID();
    const entryKeys = digest.entries.map((entry) => entry.entryKey);
    const reservation = await cursorStateLib.reserveCursorDelivery({
      sessionId: identity.sessionId,
      ownerPid,
      expected: state.continuity,
      pending: {
        deliveryId,
        canonicalCwd: state.canonicalCwd,
        transcriptPath: state.transcriptPath,
        expectedNextFrameIndex: state.continuity.nextFrameIndex,
        expectedCheckpoint: state.continuity,
        reservedThroughFrameIndex: digest.range.nextIndex - 1,
        entryKeys,
        intendedCheckpoint,
        reservedByPid: ownerPid,
        reservedAt: new Date(deps.now?.() ?? Date.now()).toISOString(),
      },
    });
    if (reservation === 'owner-conflict') {
      return inputNeededOutcome(
        'ownerConflict',
        { ownerConflict: true, runtime: 'cursor', cwd },
        'Cursor delivery is reserved by another owner.',
      );
    }
    if (reservation === 'stale') {
      return inputNeededOutcome(
        'continuityBlocked',
        {
          continuityBlocked: true,
          runtime: 'cursor',
          cwd,
          code: 'STALE_RESERVATION',
        },
        'Cursor delivery reservation lost its expected checkpoint.',
      );
    }
    digest.cursorEvidence.status.delivery = 'reserved';
    const safeNextIndex = (selected.scan.safeThroughFrame ?? -1) + 1;
    const nextObservation =
      digest.range.nextIndex < safeNextIndex
        ? cursorCandidateObservation(
            selected,
            selectedObservedAt,
            digest.range.nextIndex,
          )
        : null;
    const nextState: CursorSessionStateEntry = {
      ...state,
      lastRecordIndex: digest.range.nextIndex,
      continuity: intendedCheckpoint,
      lastStatus: {
        ...digest.cursorEvidence.status,
        delivery: 'committed',
      },
      openTurn: cursorOpenTurn(state, selected, digest),
      stabilityCandidate: null,
      pendingDelivery: null,
    };
    const nextCandidateObservation =
      nextObservation !== null &&
      (confirmedObservation === null ||
        nextObservation.throughFrameIndex !==
          confirmedObservation.throughFrameIndex ||
        !sameEntryKeys(
          nextObservation.entryKeys,
          confirmedObservation.entryKeys,
        ))
        ? nextObservation
        : null;
    delivery = createDeliveryHandle({
      sessionId: identity.sessionId,
      deliveryId,
      ownerPid,
      entryKeys,
      nextState,
      nextCandidateObservation,
      stabilityMs,
    });
  }

  const currentState =
    (await cursorStateLib.getCursorSession(identity.sessionId)) ?? state;
  return {
    ok: true,
    runtime: 'cursor',
    candidate,
    rankResult,
    digest: digest as CursorObserveSuccess['digest'],
    sessionState: null,
    cursorState: currentState,
    fromIndex: continuity.fromFrameIndex,
    markedRead: false,
    delivery,
    deliveryUncertain: null,
  };
}

async function observePinnedSession(
  runtime: Runtime,
  cwd: string,
  pinnedSession: PinnedSession,
  args: ObserveArgs,
  deps: ObserveDeps,
): Promise<ObserveOutcome> {
  let candidates;
  try {
    candidates = await discover(runtime, cwd);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorOutcome(`Failed to discover transcripts: ${message}`);
  }

  if (candidates.length === 0) {
    return noMatchOutcome(
      { noMatch: true, runtime, cwd },
      `No ${runtime} transcripts found for cwd: ${cwd}`,
    );
  }

  const pinned = candidates.find(
    (c) =>
      c.runtime === pinnedSession.runtime &&
      c.sessionId === pinnedSession.sessionId,
  );
  if (!pinned) {
    return errorOutcome(
      `Pinned session not found: ${args.session}. Run locate to see available sessions.`,
    );
  }

  if (runtime === 'cursor') {
    return observeCursorSession(cwd, pinned, args, deps);
  }

  const sessionState = await sessionStateFor(
    pinnedSession.runtime,
    pinned.sessionId,
  );
  const fromIndex = sessionState?.lastRecordIndex ?? 0;
  const warnings = watchedByPidWarnings(
    sessionState,
    args.suppressWatchedWarningPid,
  );

  let digest;
  try {
    digest = await buildCatchUpDigest(pinnedSession.runtime, pinned, {
      ...args,
      fromIndex,
      active: pinned.active ?? false,
      warnings,
      fallbacks: [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorOutcome(`Failed to build digest: ${message}`);
  }

  const markedRead = await markReadIfNeeded(
    pinnedSession.runtime,
    pinned,
    sessionState,
    digest,
  );
  return {
    ok: true,
    runtime: pinnedSession.runtime as Exclude<Runtime, 'cursor'>,
    candidate: pinned,
    digest,
    sessionState,
    fromIndex,
    markedRead,
  };
}

/**
 * Run the catch-up locate/rank/digest/state pipeline and return an outcome.
 *
 * @param {object} args CLI-like options.
 * @returns {Promise<object>}
 */
export function observeCatchUp(
  args: ObserveArgs & { runtime: 'cursor' },
  deps?: ObserveDeps,
): Promise<CursorObserveOutcome>;
export function observeCatchUp(
  args: ObserveArgs,
  deps?: ObserveDeps,
): Promise<LegacyObserveOutcome>;
export async function observeCatchUp(
  args: ObserveArgs,
  deps: ObserveDeps = {},
): Promise<ObserveOutcome> {
  const { cwd, session, snippet } = args;
  let { runtime } = args;
  const pinnedSession = parsePinnedSession(session);
  if (pinnedSession && 'error' in pinnedSession)
    return errorOutcome(pinnedSession.error);
  if (pinnedSession) runtime = pinnedSession.runtime;

  if (runtime === 'auto') {
    const resolved = await resolveAutoRuntime(cwd);
    if (resolved.noMatch) {
      return noMatchOutcome(
        {
          noMatch: true,
          cwd,
          message: 'No candidates found in any runtime for this cwd.',
        },
        `No peer-session candidates found for cwd: ${cwd}`,
      );
    }
    if (resolved.ambiguous) {
      return inputNeededOutcome(
        'ambiguousRuntime',
        {
          ambiguousRuntime: true,
          runtimes: resolved.runtimes,
          message:
            'Candidates found in multiple runtimes. Use --runtime to specify.',
        },
        `Ambiguous runtime: candidates found in both ${resolved.runtimes?.join(', ')}. ` +
          `Specify --runtime <runtime>.`,
      );
    }
    runtime = resolved.runtime;
  }

  if (pinnedSession) {
    if (!isRuntime(runtime)) {
      return errorOutcome(`Unknown runtime: ${runtime}`);
    }
    return observePinnedSession(runtime, cwd, pinnedSession, args, deps);
  }

  if (!isRuntime(runtime)) {
    return errorOutcome(`Unknown runtime: ${runtime}`);
  }

  let candidates: TranscriptCandidate[];
  try {
    candidates = await discover(runtime, cwd);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorOutcome(`Failed to discover transcripts: ${message}`);
  }

  if (candidates.length === 0) {
    return noMatchOutcome(
      { noMatch: true, runtime, cwd },
      `No ${runtime} transcripts found for cwd: ${cwd}`,
    );
  }

  if (snippet) {
    const filtered = await applySnippetFilter(candidates, snippet);
    candidates = filtered.candidates;
    if (candidates.length === 0) {
      return noMatchOutcome(
        {
          noMatch: true,
          runtime,
          cwd,
          snippet,
          message: 'No candidate transcripts contained the provided snippet.',
        },
        `No ${runtime} candidate transcripts contained the provided snippet.`,
      );
    }
  }

  const worktrees = await gitWorktrees(cwd).catch(() => []);
  const rankResult = rank(candidates, cwd, { gitWorktrees: worktrees });

  if (rankResult.noMatch) {
    return noMatchOutcome(
      {
        noMatch: true,
        runtime,
        cwd,
        sisters: rankResult.sisters,
        globalRecent: rankResult.globalRecent,
      },
      `No ${runtime} transcripts matched cwd: ${cwd}`,
    );
  }

  if (rankResult.unengagedOnly) {
    return inputNeededOutcome(
      'unengagedOnly',
      {
        unengagedOnly: true,
        runtime,
        cwd,
        tier: rankResult.tier,
        candidates: rankResult.candidates,
        message:
          'Only bootstrap/unengaged sessions matched this cwd. Use --session to confirm one or specify a different runtime/cwd.',
      },
      unengagedOnlyMessage(runtime, cwd),
    );
  }

  if (rankResult.ties && rankResult.ties.length > 0) {
    return inputNeededOutcome(
      'ties',
      { ties: true, candidates: [rankResult.winner, ...rankResult.ties] },
      'Multiple sessions tied. Use --session to disambiguate.',
    );
  }

  const winner = rankResult.winner;
  if (runtime === 'cursor') {
    return observeCursorSession(cwd, winner, args, deps, rankResult);
  }
  const sessionState = await sessionStateFor(runtime, winner.sessionId);
  const fromIndex = sessionState?.lastRecordIndex ?? 0;
  const warnings = [
    ...watchedByPidWarnings(sessionState, args.suppressWatchedWarningPid),
    ...(winner.snippetMatch
      ? [
          `Selected session by snippet match: ${winner.sessionId} (${winner.recordedCwd ?? 'unknown cwd'})`,
        ]
      : []),
  ];

  let digest;
  try {
    digest = await buildCatchUpDigest(runtime, winner, {
      ...args,
      fromIndex,
      matchedTier: rankResult.tier,
      active: winner.active,
      warnings,
      fallbacks: rankResult.fallbacks,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorOutcome(`Failed to build digest: ${message}`);
  }

  const markedRead = await markReadIfNeeded(
    runtime,
    winner,
    sessionState,
    digest,
  );
  return {
    ok: true,
    runtime,
    candidate: winner,
    rankResult,
    digest,
    sessionState,
    fromIndex,
    markedRead,
  };
}
