/**
 * observe.mjs — reusable catch-up observation pipeline.
 *
 * This module deliberately owns no output or process-exit behavior. Callers get
 * exit-style outcomes they can render for CLI, watch, or future integrations.
 */

import { readFile } from 'node:fs/promises';

import type { Runtime } from '../../core/runtimes.js';
import { buildDigest } from './digest.js';
import { discover, findSessionCandidate, gitWorktrees } from './locate.js';
import { rank } from './rank.js';
import * as stateLib from './state.js';
import type {
  BuildDigestOptions,
  Digest,
  ObserveArgs,
  ObserveFailure,
  ObserveFailureKind,
  ObserveFailurePayload,
  ObserveOutcome,
  ObservedRuntimeResolution,
  PinnedSession,
  PinnedSessionParseResult,
  RankTier,
  RuntimeCandidateSet,
  SelfIdentityResolution,
  SessionStateEntry,
  TranscriptCandidate,
} from './types.js';

export const VALID_RUNTIMES: Runtime[] = ['claude-code', 'codex', 'cursor'];
export const VALID_RUNTIME_LABEL = VALID_RUNTIMES.join(', ');

type IdentitySignal = { runtime: Runtime; sessionId?: string };

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
): IdentitySignal | null {
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

  if (matches.length !== 1 || matches[0].sessionIds.length > 1) return null;
  return {
    runtime: matches[0].runtime,
    sessionId: matches[0].sessionIds[0],
  };
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
  const signal = explicit?.sessionId
    ? explicit
    : harness?.sessionId
      ? harness
      : (explicit ?? harness);

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

  const candidates = await discover(signal.runtime, targetCwd);
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
    return { ambiguous: true, runtime: signal.runtime, candidates };
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

async function observePinnedSession(
  runtime: Runtime,
  cwd: string,
  pinnedSession: PinnedSession,
  args: ObserveArgs,
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
    runtime: pinnedSession.runtime,
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
export async function observeCatchUp(
  args: ObserveArgs,
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
    return observePinnedSession(runtime, cwd, pinnedSession, args);
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
