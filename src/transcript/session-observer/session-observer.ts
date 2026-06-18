#!/usr/bin/env node
/**
 * session-observer.mjs — CLI entrypoint for the session-observer skill.
 *
 * Usage:
 *   node session-observer.mjs <subcommand> [options]
 *
 * Subcommands: review, catch-up, catch-up-then-watch, locate, state, watch, watch-ctl
 *
 * Exit codes:
 *   0 — success
 *   1 — hard error
 *   2 — no candidates (noMatch)
 *   3 — needs user input (ties, ambiguousRuntime)
 *   4 — schema mismatch
 *
 * Script resolution: this file is always invoked by its absolute path;
 * test files resolve it via fileURLToPath(new URL('./session-observer.mjs', import.meta.url)).
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { type Runtime, readRecords } from '../core/runtimes.js';
import { buildDigest, renderMarkdown } from './lib/digest.js';
import {
  discover,
  gitWorktrees,
  claudeCodeLookupDiagnostics,
} from './lib/locate.js';
import { observeCatchUp } from './lib/observe.js';
import { rank } from './lib/rank.js';
import * as stateLib from './lib/state.js';
import * as watchStateLib from './lib/watch-state.js';
import { runWatchLoop } from './lib/watch.js';
import type {
  CliArgs,
  ObservedRuntimeResolution,
  PinnedSessionParseResult,
  RuntimeCandidateSet,
  SnippetMatch,
  TranscriptCandidate,
  WatcherRecord,
  WatchState,
} from './lib/types.js';

// ---------------------------------------------------------------------------
// argv parsing
// ---------------------------------------------------------------------------

/**
 * Parse process.argv[2...] into { subcommand, stateOp, ...flags }.
 * Uses node:util parseArgs.
 */
function parseCliArgs(argv: string[]): CliArgs {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: false,
    options: {
      runtime: { type: 'string', default: 'auto' },
      cwd: { type: 'string', default: undefined },
      json: { type: 'boolean', default: false },
      'include-tools': { type: 'boolean', default: false },
      'include-tool-results': { type: 'boolean', default: false },
      'include-command-messages': { type: 'boolean', default: false },
      debug: { type: 'boolean', default: false },
      'max-turns': { type: 'string', default: undefined },
      'max-bytes': { type: 'string', default: undefined },
      session: { type: 'string', default: undefined },
      snippet: { type: 'string', default: undefined },
      'mark-read': { type: 'boolean', default: false },
      watch: { type: 'boolean', default: false },
      'debounce-sec': { type: 'string', default: undefined },
      'poll-sec': { type: 'string', default: undefined },
      'max-pending-sec': { type: 'string', default: undefined },
      'max-runtime-min': { type: 'string', default: undefined },
      'heartbeat-sec': { type: 'string', default: undefined },
      'event-log': { type: 'string', default: undefined },
      'until-stopped': { type: 'boolean', default: false },
      interactive: { type: 'boolean', default: false },
      pid: { type: 'string', default: undefined },
      help: { type: 'boolean', default: false },
    },
  });
  const values = parsed.values as {
    runtime?: string;
    cwd?: string;
    json?: boolean;
    'include-tools'?: boolean;
    'include-tool-results'?: boolean;
    'include-command-messages'?: boolean;
    debug?: boolean;
    'max-turns'?: string;
    'max-bytes'?: string;
    session?: string;
    snippet?: string;
    'mark-read'?: boolean;
    watch?: boolean;
    'debounce-sec'?: string;
    'poll-sec'?: string;
    'max-pending-sec'?: string;
    'max-runtime-min'?: string;
    'heartbeat-sec'?: string;
    'event-log'?: string;
    'until-stopped'?: boolean;
    interactive?: boolean;
    pid?: string;
    help?: boolean;
  };
  const positionals = parsed.positionals;

  let [subcommand, ...rest] = positionals;
  if (values.watch && !subcommand) {
    subcommand = 'watch';
    rest = [];
  }

  // --debug is shorthand for --include-tools --include-tool-results
  const includeTools = values['include-tools'] || values.debug || false;
  const includeToolResults =
    values['include-tool-results'] || values.debug || false;

  const maxTurns = values['max-turns']
    ? parseInt(values['max-turns'], 10)
    : undefined;
  const maxBytes = values['max-bytes']
    ? parseInt(values['max-bytes'], 10)
    : undefined;
  const debounceSec = values['debounce-sec']
    ? parseFloat(values['debounce-sec'])
    : 2;
  const pollSec = values['poll-sec'] ? parseFloat(values['poll-sec']) : 2;
  const maxPendingSec = values['max-pending-sec']
    ? parseFloat(values['max-pending-sec'])
    : undefined;
  const maxRuntimeMin =
    values['until-stopped'] || values.interactive
      ? 0
      : values['max-runtime-min']
        ? parseFloat(values['max-runtime-min'])
        : 0;
  const heartbeatSec = values['heartbeat-sec']
    ? parseFloat(values['heartbeat-sec'])
    : undefined;

  // For 'state' subcommand, the op is in rest[0]: get, reset, clear
  const stateOp = subcommand === 'state' ? rest[0] : undefined;
  const watchCtlOp = subcommand === 'watch-ctl' ? rest[0] : undefined;

  return {
    subcommand,
    stateOp,
    watchCtlOp,
    runtime: values.runtime ?? 'auto',
    cwd: values.cwd ?? process.cwd(),
    cwdProvided: values.cwd !== undefined,
    json: values.json ?? false,
    includeTools,
    includeToolResults,
    includeCommandMessages: values['include-command-messages'] || false,
    debug: values.debug ?? false,
    maxTurns,
    maxBytes,
    session: values.session,
    snippet: values.snippet,
    markRead: values['mark-read'] ?? false,
    watch: values.watch ?? false,
    debounceSec,
    pollSec,
    maxPendingSec,
    maxRuntimeMin,
    heartbeatSec,
    eventLog: values['event-log'],
    untilStopped: values['until-stopped'] ?? false,
    interactive: values.interactive ?? false,
    pid: values.pid ? parseInt(values.pid, 10) : undefined,
    help: values.help ?? false,
  };
}

// ---------------------------------------------------------------------------
// Runtime resolution
// ---------------------------------------------------------------------------

const VALID_RUNTIMES: Runtime[] = ['claude-code', 'codex', 'cursor'];
const VALID_RUNTIME_LABEL = VALID_RUNTIMES.join(', ');
const VALID_WATCH_RUNTIMES = [...VALID_RUNTIMES, 'auto', 'both'];
const VALID_WATCH_RUNTIME_LABEL = VALID_WATCH_RUNTIMES.join('|');

function isRuntime(value: unknown): value is Runtime {
  return typeof value === 'string' && VALID_RUNTIMES.includes(value as Runtime);
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
    .filter((s) =>
      sessionIdsByRuntime.get(s.runtime)?.has(s.sessionId),
    )
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

/**
 * Resolve --runtime auto:
 *   1. Discover matching candidates in all runtimes.
 *   2. If SESSION_OBSERVER_SELF is a known runtime, consider only other runtimes.
 *   3. If exactly one considered runtime has candidates, return it.
 *   4. If state identifies exactly one previously read same-cwd runtime, return it.
 *   5. Otherwise return noMatch or ambiguousRuntime.
 *
 * @param {string} targetCwd
 * @returns {Promise<{ runtime: string } | { ambiguous: true, candidates: object } | { noMatch: true }>}
 */
async function resolveAutoRuntime(
  targetCwd: string,
): Promise<ObservedRuntimeResolution> {
  const self = process.env.SESSION_OBSERVER_SELF;
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

  const withCandidates = results.filter(
    (r) => r.candidates.length > 0,
  );
  const considered = isRuntime(self)
    ? withCandidates.filter((r) => r.runtime !== self)
    : withCandidates;

  if (considered.length === 1) {
    // Unambiguous
    return { runtime: considered[0].runtime };
  }

  if (considered.length === 0) {
    // No candidates in any runtime
    return { noMatch: true };
  }

  const preferred = await preferredRuntimeFromState(considered, targetCwd);
  if (preferred) return preferred;

  // Multiple runtimes have candidates → ambiguous
  return {
    ambiguous: true,
    runtimes: considered.map((r) => r.runtime),
    candidates: Object.fromEntries(
      considered.map((r) => [r.runtime, r.candidates]),
    ),
  };
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

function emit(content: string, exitCode = 0): never {
  process.stdout.write(content + '\n');
  process.exit(exitCode);
}

function emitJson(obj: unknown, exitCode = 0): never {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
  process.exit(exitCode);
}

function emitError(message: string, exitCode = 1): never {
  process.stderr.write(`[session-observer] ${message}\n`);
  process.exit(exitCode);
}

function unengagedOnlyMessage(runtime: string, cwd: string): string {
  return (
    `The only ${runtime} session for this cwd has no user conversation yet: ${cwd}. ` +
    'It looks like a freshly spawned/bootstrap session you have not engaged with. ' +
    'Did you mean a different session (another runtime, a sister worktree, or a specific session id)?'
  );
}

function renderCandidateList(candidates: TranscriptCandidate[]): string {
  return candidates
    .map(
      (c) =>
        `  ${c.runtime}:${c.sessionId}  ${c.engagementStatus ?? 'unknown'}  records=${c.recordCount ?? '?'}  ${c.transcriptPath}`,
    )
    .join('\n');
}

function parsePinnedSession(session?: string): PinnedSessionParseResult {
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

async function applySnippetFilter(
  candidates: TranscriptCandidate[],
  snippet?: string,
): Promise<{ candidates: TranscriptCandidate[]; matches: TranscriptCandidate[] }> {
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
    const snippetMatch: SnippetMatch = {
      excerpt: snippet,
      context: raw.slice(start, end).replace(/\s+/g, ' ').trim(),
    };
    matches.push({ ...candidate, snippetMatch });
  }
  return { candidates: matches, matches };
}

function printUsage(): never {
  process.stdout.write(
    [
      'Usage: session-observer <subcommand> [options]',
      '',
      'Subcommands:',
      '  review     One-shot full digest of the most relevant peer session',
      '  catch-up   Incremental: only records added since the last read',
      '  catch-up-then-watch  Emit unread backlog, then keep foreground watch active',
      '  locate     Diagnostic: ranked candidate list',
      '  state      Manage high-water marks: get, reset, clear',
      '  watch      Foreground watcher for debounced catch-up updates',
      '  watch-ctl  Inspect or control active watch state',
      '',
      'Options:',
      '  --runtime <claude-code|codex|cursor|auto>  (default: auto)',
      '  --cwd <path>                        (default: process.cwd())',
      '  --include-tools                     Include tool call markers',
      '  --include-command-messages          Include Claude slash-command payloads',
      '  --debug                             Include tool calls and results',
      '  --json                              Output JSON instead of markdown',
      '  --max-turns <N>                     Limit to last N turn groups',
      '  --max-bytes <N>                     Limit to last N bytes of content',
      '  --session <runtime:id>              Pin to a specific session',
      '  --snippet <text>                    Prefer candidates containing this transcript excerpt',
      '  --mark-read                         Advance offset after review',
      '  --watch                             Alias for the watch subcommand',
      '',
      'Watch options:',
      '  --runtime <claude-code|codex|cursor|auto|both>  (default: auto)',
      '  --debounce-sec <N>                  Seconds of quiet before emitting',
      '  --poll-sec <N>                      Poll interval in seconds',
      '  --max-pending-sec <N>               Max seconds to hold continuous changes before emitting',
      '  --max-runtime-min <N>               Auto-exit after N minutes (0 = unlimited)',
      '  --heartbeat-sec <N>                 Quiet status heartbeat interval in seconds (0 = disabled)',
      '  --until-stopped                     Alias posture: run until explicitly stopped',
      '  --interactive                       Alias posture: foreground collaboration watch',
      '  --event-log <path>                  Metadata-only JSONL event log',
      '',
    ].join('\n'),
  );
  process.exit(0);
}

function printWatchUsage(command = 'watch'): never {
  process.stdout.write(
    [
      `Usage: session-observer ${command} [options]`,
      '',
      'Options:',
      '  --runtime <claude-code|codex|cursor|auto|both>  (default: auto)',
      '  --cwd <path>                        (default: process.cwd())',
      '  --debounce-sec <N>                  Seconds of quiet before emitting (default: 2)',
      '  --poll-sec <N>                      Poll interval in seconds (default: 2)',
      '  --max-pending-sec <N>               Max seconds to hold continuous changes before emitting (default: 30)',
      '  --max-runtime-min <N>               Auto-exit after N minutes (0 = unlimited)',
      '  --heartbeat-sec <N>                 Quiet status heartbeat interval in seconds (default: 120; 0 = disabled)',
      '  --until-stopped                     Alias posture: run until explicitly stopped',
      '  --interactive                       Alias posture: foreground collaboration watch',
      '  --event-log <path>                  Metadata-only JSONL event log',
      '  --json                              Emit JSON-line events instead of markdown',
      '  --session <runtime:id>              Pin to a specific session',
      '  --snippet <text>                    Prefer candidates containing this transcript excerpt',
      '',
    ].join('\n'),
  );
  process.exit(0);
}

function printWatchCtlUsage(): never {
  process.stdout.write(
    [
      'Usage: session-observer watch-ctl <operation> [options]',
      '',
      'Operations:',
      '  status     Print active watcher state',
      '  pause      Pause event emission while polling continues',
      '  resume     Resume event emission',
      '  flush      Emit any pending debounced update immediately',
      '  stop       Stop the active watcher',
      '',
      'Options:',
      '  --json             Output JSON instead of text',
      '  --cwd <path>       Select watcher for cwd when controlling',
      '  --runtime <r>      Select watcher by requested/resolved/target runtime',
      '  --session <r:id>   Select watcher by target session',
      '  --pid <pid>        Select watcher by process id',
      '',
    ].join('\n'),
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// runReview
// ---------------------------------------------------------------------------

async function runReview(args: CliArgs): Promise<void> {
  const {
    cwd,
    includeTools,
    includeToolResults,
    includeCommandMessages,
    maxTurns,
    maxBytes,
    json,
    markRead,
    session,
    snippet,
  } = args;
  let { runtime } = args;
  const pinnedSession = parsePinnedSession(session);
  if (pinnedSession && 'error' in pinnedSession)
    return emitError(pinnedSession.error, 1);
  if (pinnedSession) runtime = pinnedSession.runtime;

  // Resolve auto runtime
  if (runtime === 'auto') {
    const resolved = await resolveAutoRuntime(cwd);
    if (resolved.noMatch) {
      const payload = {
        noMatch: true,
        cwd,
        message: 'No candidates found in any runtime for this cwd.',
      };
      if (json) return emitJson(payload, 2);
      return emit(`No peer-session candidates found for cwd: ${cwd}`, 2);
    }
    if (resolved.ambiguous) {
      const payload = {
        ambiguousRuntime: true,
        runtimes: resolved.runtimes,
        message:
          'Candidates found in multiple runtimes. Use --runtime to specify.',
      };
      if (json) return emitJson(payload, 3);
      return emit(
        `Ambiguous runtime: candidates found in both ${resolved.runtimes?.join(', ')}. ` +
          `Specify --runtime <runtime>.`,
        3,
      );
    }
    runtime = resolved.runtime ?? runtime;
  }

  if (!isRuntime(runtime)) {
    return emitError(
      `Unknown runtime: ${runtime}. Use one of: ${VALID_RUNTIME_LABEL}.`,
      1,
    );
  }

  // Discover candidates
  let candidates: TranscriptCandidate[];
  try {
    candidates = await discover(runtime, cwd);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return emitError(`Failed to discover transcripts: ${message}`, 1);
  }

  if (candidates.length === 0) {
    const payload = {
      noMatch: true,
      runtime,
      cwd,
      message: 'No candidates found.',
    };
    if (json) return emitJson(payload, 2);
    return emit(`No ${runtime} transcripts found for cwd: ${cwd}`, 2);
  }

  // Resolve pinned session override BEFORE tie/no-match checks.
  // When --session <runtime:id> is provided and the candidate exists, select it directly
  // and skip ranking/tie/no-match branches entirely.
  if (pinnedSession) {
    const pinnedRuntime = pinnedSession.runtime;
    const pinnedId = pinnedSession.sessionId;
    const pinned = candidates.find(
      (c) => c.runtime === pinnedRuntime && c.sessionId === pinnedId,
    );
    if (!pinned) {
      return emitError(
        `Pinned session not found: ${session}. Run locate to see available sessions.`,
        1,
      );
    }
    // Build digest directly from the pinned candidate
    let digest;
    try {
      digest = await buildDigest(pinnedRuntime, pinned.transcriptPath, {
        fromIndex: 0,
        mode: 'review',
        includeToolCalls: includeTools,
        includeToolResults,
        includeCommandMessages,
        maxTurns,
        maxBytes,
        sessionId: pinned.sessionId,
        recordedCwd: pinned.recordedCwd,
        matchedTier: null,
        widenedFrom: null,
        active: pinned.active ?? false,
        fallbacks: [],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return emitError(`Failed to build digest: ${message}`, 1);
    }
    if (markRead) {
      try {
        await stateLib.markRead(pinnedRuntime, pinned.sessionId, {
          lastRecordIndex: digest.range.nextIndex,
          lastTotalRecords: digest.range.totalRecords,
          transcriptPath: pinned.transcriptPath,
          recordedCwd: pinned.recordedCwd,
        });
      } catch {
        // Non-fatal
      }
    }
    if (json) return emitJson(digest, 0);
    return emit(renderMarkdown(digest), 0);
  }

  if (snippet) {
    const filtered = await applySnippetFilter(candidates, snippet);
    candidates = filtered.candidates;
    if (candidates.length === 0) {
      const payload = {
        noMatch: true,
        runtime,
        cwd,
        snippet,
        message: 'No candidate transcripts contained the provided snippet.',
      };
      if (json) return emitJson(payload, 2);
      return emit(
        `No ${runtime} candidate transcripts contained the provided snippet.`,
        2,
      );
    }
  }

  // Rank candidates
  const worktrees = await gitWorktrees(cwd).catch(() => []);
  const rankResult = rank(candidates, cwd, { gitWorktrees: worktrees });

  if (rankResult.noMatch) {
    const payload = {
      noMatch: true,
      runtime,
      cwd,
      sisters: rankResult.sisters,
      globalRecent: rankResult.globalRecent,
      message: 'No candidates match this cwd.',
    };
    if (json) return emitJson(payload, 2);
    return emit(`No ${runtime} transcripts matched cwd: ${cwd}`, 2);
  }

  if (rankResult.unengagedOnly) {
    const payload = {
      unengagedOnly: true,
      runtime,
      cwd,
      tier: rankResult.tier,
      candidates: rankResult.candidates,
      message:
        'Only bootstrap/unengaged sessions matched this cwd. Use --session to confirm one or specify a different runtime/cwd.',
    };
    if (json) return emitJson(payload, 3);
    return emit(
      `${unengagedOnlyMessage(runtime, cwd)}\n` +
        renderCandidateList(rankResult.candidates),
      3,
    );
  }

  // Check for ties
  if (rankResult.ties && rankResult.ties.length > 0) {
    const payload = {
      ties: true,
      candidates: [rankResult.winner, ...rankResult.ties],
      message:
        'Multiple sessions tied. Use --session <runtime:id> to pick one.',
    };
    if (json) return emitJson(payload, 3);
    return emit(
      `Multiple sessions tied. Specify --session to disambiguate:\n` +
        [rankResult.winner, ...rankResult.ties]
          .map(
            (c) =>
              `  ${c.runtime}:${c.sessionId}  (${c.transcriptPath})`,
          )
          .join('\n'),
      3,
    );
  }

  const winner = rankResult.winner;

  // Get prior offset (review uses fromIndex=0 unless --mark-read was used before)
  const fromIndex = 0; // review always starts from 0

  // Build digest
  let digest;
  try {
    digest = await buildDigest(runtime, winner.transcriptPath, {
      fromIndex,
      mode: 'review',
      includeToolCalls: includeTools,
      includeToolResults,
      includeCommandMessages,
      maxTurns,
      maxBytes,
      sessionId: winner.sessionId,
      recordedCwd: winner.recordedCwd,
      matchedTier: rankResult.tier,
      widenedFrom: null,
      active: winner.active,
      warnings: winner.snippetMatch
        ? [
            `Selected session by snippet match: ${winner.sessionId} (${winner.recordedCwd ?? 'unknown cwd'})`,
          ]
        : [],
      fallbacks: rankResult.fallbacks,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return emitError(`Failed to build digest: ${message}`, 1);
  }

  // Optionally mark read
  if (markRead) {
    try {
      await stateLib.markRead(runtime, winner.sessionId, {
        lastRecordIndex: digest.range.nextIndex,
        lastTotalRecords: digest.range.totalRecords,
        transcriptPath: winner.transcriptPath,
        recordedCwd: winner.recordedCwd,
      });
    } catch {
      // Non-fatal; continue
    }
  }

  if (json) return emitJson(digest, 0);
  return emit(renderMarkdown(digest), 0);
}

// ---------------------------------------------------------------------------
// runCatchUp
// ---------------------------------------------------------------------------

async function runCatchUp(args: CliArgs): Promise<void> {
  const result = await observeCatchUp(args);
  if (!result.ok) {
    if (result.kind === 'error')
      return emitError(result.message, result.exitCode);
    if (args.json) return emitJson(result.payload, result.exitCode);
    return emit(result.message, result.exitCode);
  }

  if (args.json) return emitJson(result.digest, 0);
  return emit(renderMarkdown(result.digest), 0);
}

// ---------------------------------------------------------------------------
// runLocate
// ---------------------------------------------------------------------------

async function runLocate(args: CliArgs): Promise<void> {
  const { cwd, json, debug, snippet } = args;
  const { runtime } = args;

  if (runtime === 'auto') {
    // For locate, try both runtimes and show all
    const allCandidates: TranscriptCandidate[] = [];
    for (const rt of VALID_RUNTIMES) {
      try {
        const candidates = await discover(rt, cwd);
        allCandidates.push(...candidates);
      } catch {
        // continue
      }
    }

    let snippetMatches: TranscriptCandidate[] = [];
    if (snippet) {
      const filtered = await applySnippetFilter(allCandidates, snippet);
      snippetMatches = filtered.matches;
      allCandidates.splice(0, allCandidates.length, ...filtered.candidates);
      if (allCandidates.length === 0) {
        const payload: Record<string, unknown> = {
          noMatch: true,
          cwd,
          snippet,
          message: 'No candidate transcripts contained the provided snippet.',
        };
        if (debug)
          payload.lookupDiagnostics = {
            claudeCode: await claudeCodeLookupDiagnostics(cwd),
          };
        if (json) return emitJson(payload, 2);
        return emit(`No transcripts contained the provided snippet.`, 2);
      }
    }

    const worktrees = await gitWorktrees(cwd).catch(() => []);
    const rankResult = rank(allCandidates, cwd, { gitWorktrees: worktrees });

    if (rankResult.noMatch) {
      const payload: Record<string, unknown> = {
        noMatch: true,
        cwd,
        sisters: rankResult.sisters,
        globalRecent: rankResult.globalRecent,
      };
      if (debug)
        payload.lookupDiagnostics = {
          claudeCode: await claudeCodeLookupDiagnostics(cwd),
        };
      if (json) return emitJson(payload, 2);
      return emit(`No transcripts found for cwd: ${cwd}`, 2);
    }

    if (rankResult.unengagedOnly) {
      const payload: Record<string, unknown> = {
        unengagedOnly: true,
        cwd,
        tier: rankResult.tier,
        candidates: rankResult.candidates,
        message:
          'Only bootstrap/unengaged sessions matched this cwd. Use --session to confirm one or specify a runtime/cwd.',
      };
      if (debug)
        payload.lookupDiagnostics = {
          claudeCode: await claudeCodeLookupDiagnostics(cwd),
        };
      if (json) return emitJson(payload, 3);
      return emit(
        `${unengagedOnlyMessage('auto', cwd)}\n` +
          renderCandidateList(rankResult.candidates),
        3,
      );
    }

    const payload: Record<string, unknown> = {
      winner: rankResult.winner,
      tier: rankResult.tier,
      ties: rankResult.ties,
      fallbacks: rankResult.fallbacks,
    };
    if (snippet) payload.snippet = { query: snippet, matches: snippetMatches };
    if (debug)
      payload.lookupDiagnostics = {
        claudeCode: await claudeCodeLookupDiagnostics(cwd),
      };
    if (json) return emitJson(payload, 0);
    return emit(
      `Winner: ${rankResult.winner.runtime}:${rankResult.winner.sessionId}\n` +
        `  Tier: ${rankResult.tier}\n` +
        `  Transcript: ${rankResult.winner.transcriptPath}\n` +
        `  Fallbacks: ${rankResult.fallbacks.length}`,
      0,
    );
  }

  // Single runtime
  if (!isRuntime(runtime)) {
    return emitError(
      `Unknown runtime: ${runtime}. Use one of: ${VALID_RUNTIME_LABEL}.`,
      1,
    );
  }

  let candidates: TranscriptCandidate[];
  try {
    candidates = await discover(runtime, cwd);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return emitError(`Failed to discover transcripts: ${message}`, 1);
  }

  if (candidates.length === 0) {
    const payload: Record<string, unknown> = { noMatch: true, runtime, cwd };
    if (debug && runtime === 'claude-code') {
      payload.lookupDiagnostics = {
        claudeCode: await claudeCodeLookupDiagnostics(cwd),
      };
    }
    if (json) return emitJson(payload, 2);
    return emit(`No ${runtime} transcripts found for cwd: ${cwd}`, 2);
  }

  let snippetMatches: TranscriptCandidate[] = [];
  if (snippet) {
    const filtered = await applySnippetFilter(candidates, snippet);
    snippetMatches = filtered.matches;
    candidates = filtered.candidates;
    if (candidates.length === 0) {
      const payload: Record<string, unknown> = {
        noMatch: true,
        runtime,
        cwd,
        snippet,
        message: 'No candidate transcripts contained the provided snippet.',
      };
      if (debug && runtime === 'claude-code') {
        payload.lookupDiagnostics = {
          claudeCode: await claudeCodeLookupDiagnostics(cwd),
        };
      }
      if (json) return emitJson(payload, 2);
      return emit(
        `No ${runtime} candidate transcripts contained the provided snippet.`,
        2,
      );
    }
  }

  const worktrees = await gitWorktrees(cwd).catch(() => []);
  const rankResult = rank(candidates, cwd, { gitWorktrees: worktrees });

  if (rankResult.noMatch) {
    const payload: Record<string, unknown> = {
      noMatch: true,
      runtime,
      cwd,
      sisters: rankResult.sisters,
      globalRecent: rankResult.globalRecent,
    };
    if (debug && runtime === 'claude-code') {
      payload.lookupDiagnostics = {
        claudeCode: await claudeCodeLookupDiagnostics(cwd),
      };
    }
    if (json) return emitJson(payload, 2);
    return emit(`No ${runtime} transcripts matched cwd: ${cwd}`, 2);
  }

  if (rankResult.unengagedOnly) {
    const payload: Record<string, unknown> = {
      unengagedOnly: true,
      runtime,
      cwd,
      tier: rankResult.tier,
      candidates: rankResult.candidates,
      message:
        'Only bootstrap/unengaged sessions matched this cwd. Use --session to confirm one or specify a different runtime/cwd.',
    };
    if (debug && runtime === 'claude-code') {
      payload.lookupDiagnostics = {
        claudeCode: await claudeCodeLookupDiagnostics(cwd),
      };
    }
    if (json) return emitJson(payload, 3);
    return emit(
      `${unengagedOnlyMessage(runtime, cwd)}\n` +
        renderCandidateList(rankResult.candidates),
      3,
    );
  }

  const payload: Record<string, unknown> = {
    winner: rankResult.winner,
    tier: rankResult.tier,
    ties: rankResult.ties,
    fallbacks: rankResult.fallbacks,
  };
  if (snippet) payload.snippet = { query: snippet, matches: snippetMatches };
  if (debug && runtime === 'claude-code') {
    payload.lookupDiagnostics = {
      claudeCode: await claudeCodeLookupDiagnostics(cwd),
    };
  }
  if (json) return emitJson(payload, 0);
  return emit(
    `Winner: ${rankResult.winner.runtime}:${rankResult.winner.sessionId}\n` +
      `  Tier: ${rankResult.tier}\n` +
      `  Transcript: ${rankResult.winner.transcriptPath}\n` +
      `  Fallbacks: ${rankResult.fallbacks.length}`,
    0,
  );
}

// ---------------------------------------------------------------------------
// runState
// ---------------------------------------------------------------------------

async function runState(args: CliArgs): Promise<void> {
  const { stateOp, json } = args;
  const { runtime } = args;

  switch (stateOp) {
    case 'get': {
      try {
        const state = await stateLib.load();
        if (json) return emitJson(state, 0);
        const sessions = Object.values(state.sessions);
        if (sessions.length === 0) {
          return emit('No sessions tracked yet.', 0);
        }
        const lines = sessions.map(
          (s) =>
            `${s.runtime}:${s.sessionId}  offset=${s.lastRecordIndex}/${s.lastTotalRecords}  ` +
            `lastReadAt=${s.lastReadAt}`,
        );
        return emit(lines.join('\n'), 0);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return emitError(`Failed to load state: ${message}`, 1);
      }
    }

    case 'reset': {
      // --session <runtime>:<sessionId> takes priority over --runtime
      if (args.session) {
        const sep = args.session.indexOf(':');
        if (sep === -1) {
          return emitError(
            '--session must be in <runtime>:<sessionId> format (e.g. codex:abc123)',
            1,
          );
        }
        const sessionRuntime = args.session.slice(0, sep);
        const sessionId = args.session.slice(sep + 1);
        if (!isRuntime(sessionRuntime)) {
          return emitError(
            `Unknown runtime in --session: ${sessionRuntime}. Use one of: ${VALID_RUNTIME_LABEL}.`,
            1,
          );
        }
        try {
          await stateLib.resetBySession(sessionRuntime, sessionId);
          if (json)
            return emitJson(
              { reset: true, runtime: sessionRuntime, sessionId },
              0,
            );
          return emit(`Reset session: ${sessionRuntime}:${sessionId}`, 0);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return emitError(`Failed to reset state: ${message}`, 1);
        }
      }

      if (!runtime || runtime === 'auto') {
        return emitError(
          `--runtime is required for state reset (use one of: ${VALID_RUNTIME_LABEL}), or use --session <runtime>:<sessionId>`,
          1,
        );
      }
      if (!isRuntime(runtime)) {
        return emitError(
          `Unknown runtime: ${runtime}. Use one of: ${VALID_RUNTIME_LABEL}.`,
          1,
        );
      }
      try {
        const count = await stateLib.resetByRuntime(runtime);
        if (json) return emitJson({ reset: true, runtime, count }, 0);
        return emit(`Reset ${count} session(s) for runtime: ${runtime}`, 0);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return emitError(`Failed to reset state: ${message}`, 1);
      }
    }

    case 'clear': {
      try {
        await stateLib.clear();
        if (json) return emitJson({ cleared: true }, 0);
        return emit('State cleared.', 0);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return emitError(`Failed to clear state: ${message}`, 1);
      }
    }

    default: {
      emitError(
        `Unknown state operation: ${stateOp ?? '(none)'}. ` +
          `Valid operations: get, reset, clear`,
        1,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// runWatch / runWatchCtl
// ---------------------------------------------------------------------------

async function runWatch(args: CliArgs): Promise<void> {
  if (args.help) return printWatchUsage(args.subcommand);

  if (!VALID_WATCH_RUNTIMES.includes(args.runtime)) {
    return emitWatchSetupError(
      args,
      `Unknown watch runtime: ${args.runtime}. Use one of: ${VALID_WATCH_RUNTIME_LABEL}.`,
    );
  }

  try {
    await runWatchLoop({
      ...args,
      catchUpFirst: args.subcommand === 'catch-up-then-watch',
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    // Loop-phase failures already emitted a JSON error event; setup failures
    // (event-log validation, startWatcher refusal) have not, so render them
    // on the stable stdout event stream when --json was requested.
    if (args.json && !('watchErrorEventEmitted' in error)) {
      return emitWatchSetupError(args, error.message);
    }
    return emitError(`Watch failed: ${error.message}`, 1);
  }
}

function emitWatchSetupError(args: CliArgs, message: string): never {
  if (args.json) {
    process.stdout.write(
      JSON.stringify({
        type: 'error',
        ts: new Date().toISOString(),
        message,
      }) + '\n',
    );
    process.exit(1);
  }
  return emitError(message, 1);
}

async function emitNoActiveWatcher(args: any): Promise<any> {
  await watchStateLib.clearControlDirective().catch((): any => false);
  const payload: any = {
    active: false,
    noActiveWatcher: true,
    watcher: null,
    message: 'No active watcher.',
  };
  if (args.watchCtlOp && args.watchCtlOp !== 'status') {
    payload.directive = args.watchCtlOp;
    payload.control = null;
  }
  if (args.json) return emitJson(payload, 0);
  return emit('No active watcher.', 0);
}

function secondsSince(value: any, now: any = Date.now()): any {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor((now - parsed) / 1000));
}

function consumedThrough(lastRecordIndex: any): any {
  if (!Number.isFinite(lastRecordIndex) || lastRecordIndex <= 0) return null;
  return lastRecordIndex - 1;
}

async function transcriptRecordCount(transcriptPath: any): Promise<any> {
  return (await readRecords(transcriptPath)).length;
}

function activeWatchersFromState(state: any): any {
  if (Array.isArray(state.watchers) && state.watchers.length > 0) {
    return state.watchers.filter(Boolean);
  }
  return state.active ? [state.active] : [];
}

async function singleWatcherStatusPayload(active: any): Promise<any> {
  const now = Date.now();
  const sessionState = await stateLib
    .load()
    .catch((): any => ({ sessions: {} }));
  const staleAfterSec = Number.isFinite(Number(active.staleAfterSec))
    ? Number(active.staleAfterSec)
    : 30;
  const secondsSinceLastEmit = secondsSince(active.lastEventAt, now);
  const secondsSinceLastPoll = secondsSince(active.lastPollAt, now);
  const secondsSinceStarted = secondsSince(active.startedAt, now);
  const targets: any[] = [];

  for (const target of active.targets ?? []) {
    const stateKey = `${target.runtime}:${target.sessionId}`;
    const stored = sessionState.sessions?.[stateKey] ?? null;
    const lastRecordIndex = Number.isFinite(Number(stored?.lastRecordIndex))
      ? Number(stored.lastRecordIndex)
      : Number(target.baselineRecordIndex ?? 0);
    let transcriptRecords = null;
    let recordError = null;
    try {
      transcriptRecords = await transcriptRecordCount(target.transcriptPath);
    } catch (err: any) {
      recordError = err.message;
    }

    const recordsBehind =
      transcriptRecords === null
        ? null
        : Math.max(0, transcriptRecords - lastRecordIndex);
    const staleClockSec = secondsSinceLastEmit ?? secondsSinceStarted ?? 0;
    const reasons: any[] = [];
    if (
      recordsBehind !== null &&
      recordsBehind > 0 &&
      staleClockSec > staleAfterSec
    ) {
      reasons.push('records-behind-stale');
    }
    if (
      secondsSinceLastPoll !== null &&
      secondsSinceLastPoll > Math.max(staleAfterSec, (active.pollSec ?? 2) * 3)
    ) {
      reasons.push('poll-heartbeat-stale');
    }
    if (recordError) reasons.push('transcript-read-error');

    targets.push({
      ...target,
      transcriptRecords,
      lastRecordIndex,
      consumedThrough: consumedThrough(lastRecordIndex),
      recordsBehind,
      secondsSinceLastEmit,
      secondsSinceLastPoll,
      staleAfterSec,
      healthy: reasons.length === 0,
      healthReasons: reasons,
      error: recordError,
    });
  }

  const activeWithStatus: any = {
    ...active,
    targets,
  };
  const targetReasons = targets.flatMap(
    (target: any): any => target.healthReasons ?? [],
  );
  const processReasons: any[] = [];
  if (active.lastError?.message) processReasons.push('watcher-error');
  const reasons = [...new Set([...targetReasons, ...processReasons])];
  const healthy = reasons.length === 0;

  return {
    active: true,
    noActiveWatcher: false,
    healthy,
    health: { healthy, reasons },
    watcher: activeWithStatus,
    targets,
    requestedRuntime: active.requestedRuntime ?? active.runtime,
    resolvedRuntime: active.resolvedRuntime ?? targets[0]?.runtime ?? null,
    sessionId: active.sessionId ?? targets[0]?.sessionId ?? null,
    transcriptPath: active.transcriptPath ?? targets[0]?.transcriptPath ?? null,
    secondsSinceLastEmit,
    secondsSinceLastPoll,
  };
}

async function watcherStatusPayload(state: any): Promise<any> {
  const watchers = activeWatchersFromState(state);
  if (watchers.length === 0) {
    return {
      active: false,
      noActiveWatcher: true,
      watcher: null,
      message: 'No active watcher.',
    };
  }

  const statuses: any[] = [];
  for (const watcher of watchers) {
    statuses.push(await singleWatcherStatusPayload(watcher));
  }
  const reasons = [
    ...new Set(
      statuses.flatMap((status: any): any => status.health?.reasons ?? []),
    ),
  ];
  const healthy = reasons.length === 0;
  const primary = statuses[0];
  const watchersWithHealth = statuses.map((status: any): any => ({
    ...status.watcher,
    healthy: status.healthy,
    healthReasons: status.health?.reasons ?? [],
  }));

  return {
    active: true,
    noActiveWatcher: false,
    healthy,
    health: { healthy, reasons },
    watcher: watchersWithHealth[0],
    watchers: watchersWithHealth,
    watcherCount: statuses.length,
    targets: statuses.flatMap((status: any): any => status.targets),
    requestedRuntime: primary.requestedRuntime,
    resolvedRuntime: primary.resolvedRuntime,
    sessionId: primary.sessionId,
    transcriptPath: primary.transcriptPath,
    secondsSinceLastEmit: primary.secondsSinceLastEmit,
    secondsSinceLastPoll: primary.secondsSinceLastPoll,
  };
}

function formatWatcherStatus(payload: any): any {
  if (!payload.active) return 'No active watcher.';
  const watcherLines = (payload.watchers ?? [payload.watcher])
    .filter(Boolean)
    .flatMap((watcher: any): any => {
      const header = `Watcher active: ${watcher.runtime} ${watcher.cwd} (pid ${watcher.pid}) healthy=${watcher.healthy ?? payload.healthy}`;
      const targets = (watcher.targets ?? []).map((target: any): any => {
        const behind =
          target.recordsBehind === null ? '?' : target.recordsBehind;
        return `  ${target.runtime}:${target.sessionId} recordsBehind=${behind} transcript=${target.transcriptPath}`;
      });
      return [header, ...targets];
    });
  return watcherLines.join('\n');
}

function watcherSummary(watcher: any): any {
  return {
    pid: watcher.pid,
    runtime: watcher.runtime,
    requestedRuntime: watcher.requestedRuntime ?? watcher.runtime,
    resolvedRuntime: watcher.resolvedRuntime ?? null,
    cwd: watcher.cwd,
    session: watcher.session ?? null,
    targets: watcher.targets ?? [],
  };
}

function watcherMatchesRuntime(watcher: any, runtime: any): any {
  if (!runtime || runtime === 'auto') return true;
  if (
    watcher.runtime === runtime ||
    watcher.requestedRuntime === runtime ||
    watcher.resolvedRuntime === runtime
  ) {
    return true;
  }
  return (watcher.targets ?? []).some(
    (target: any): any => target.runtime === runtime,
  );
}

function watcherMatchesSession(watcher: any, session: any): any {
  if (!session) return true;
  if (watcher.session === session) return true;
  return (watcher.targets ?? []).some(
    (target: any): any => `${target.runtime}:${target.sessionId}` === session,
  );
}

function sameCwd(a: any, b: any): any {
  if (!a || !b) return false;
  return resolve(String(a)) === resolve(String(b));
}

function selectWatcherForControl(state: any, args: any): any {
  const watchers = activeWatchersFromState(state);
  if (watchers.length === 0) return { none: true, watchers };
  if (args.pid !== undefined && !Number.isInteger(args.pid)) {
    return { error: `Invalid --pid value: ${args.pid}` };
  }

  let candidates = watchers;
  if (args.pid !== undefined) {
    candidates = candidates.filter(
      (watcher: any): any => watcher.pid === args.pid,
    );
  } else {
    candidates = candidates
      .filter((watcher: any): any =>
        watcherMatchesRuntime(watcher, args.runtime),
      )
      .filter((watcher: any): any =>
        watcherMatchesSession(watcher, args.session),
      );
    const cwdMatches = candidates.filter((watcher: any): any =>
      sameCwd(watcher.cwd, args.cwd),
    );
    // An explicit --cwd is a hard filter. The implicit process.cwd() default is
    // only a disambiguator: when it matches nothing, fall back to the
    // runtime/session matches so a lone watcher stays controllable from any cwd.
    if (args.cwdProvided || cwdMatches.length > 0) {
      candidates = cwdMatches;
    }
  }

  if (candidates.length === 0) return { none: true, watchers };
  if (candidates.length > 1) return { ambiguous: true, watchers: candidates };
  return { watcher: candidates[0], watchers };
}

function emitNoMatchingWatcher(args: any, watchers: any): any {
  const payload: any = {
    active: true,
    noMatchingWatcher: true,
    watcher: null,
    message:
      'No watcher matched the given filters. Select one with --runtime, --session, or --pid.',
    watchers: watchers.map(watcherSummary),
  };
  if (args.json) return emitJson(payload, 3);
  return emit(
    [
      payload.message,
      ...payload.watchers.map(
        (watcher: any): any =>
          `  pid=${watcher.pid} runtime=${watcher.runtime} cwd=${watcher.cwd}`,
      ),
    ].join('\n'),
    3,
  );
}

function emitUnmatchedWatcherControl(args: any, selected: any): any {
  return selected.watchers.length > 0
    ? emitNoMatchingWatcher(args, selected.watchers)
    : emitNoActiveWatcher(args);
}

function emitAmbiguousWatcher(args: any, candidates: any): any {
  const payload: any = {
    ambiguousWatcher: true,
    message:
      'Multiple active watchers match. Select one with --runtime, --session, or --pid.',
    watchers: candidates.map(watcherSummary),
  };
  if (args.json) return emitJson(payload, 3);
  return emit(
    [
      payload.message,
      ...payload.watchers.map(
        (watcher: any): any =>
          `  pid=${watcher.pid} runtime=${watcher.runtime} cwd=${watcher.cwd}`,
      ),
    ].join('\n'),
    3,
  );
}

async function runWatchCtl(args: any): Promise<any> {
  if (args.help || !args.watchCtlOp) return printWatchCtlUsage();

  switch (args.watchCtlOp) {
    case 'status': {
      const state = await watchStateLib.loadWatchState();
      const payload = await watcherStatusPayload(state);
      if (args.json) return emitJson(payload, 0);
      return emit(formatWatcherStatus(payload), 0);
    }

    case 'pause':
    case 'resume':
    case 'flush': {
      const state = await watchStateLib.loadWatchState();
      const selected = selectWatcherForControl(state, args);
      if (selected.error) return emitError(selected.error, 1);
      if (selected.none) return emitUnmatchedWatcherControl(args, selected);
      if (selected.ambiguous)
        return emitAmbiguousWatcher(args, selected.watchers);

      const control = await watchStateLib.writeControlDirective(
        args.watchCtlOp,
        { pid: selected.watcher.pid },
      );
      const payload: any = {
        directive: args.watchCtlOp,
        watcher: watcherSummary(selected.watcher),
        control,
      };
      if (args.json) return emitJson(payload, 0);
      return emit(`Watcher directive written: ${args.watchCtlOp}`, 0);
    }

    case 'stop': {
      const state = await watchStateLib.loadWatchState();
      const selected = selectWatcherForControl(state, args);
      if (selected.error) return emitError(selected.error, 1);
      if (selected.none) return emitUnmatchedWatcherControl(args, selected);
      if (selected.ambiguous)
        return emitAmbiguousWatcher(args, selected.watchers);

      const control = await watchStateLib.writeControlDirective('stop', {
        pid: selected.watcher.pid,
      });
      let signaled = false;
      if (selected.watcher?.pid) {
        try {
          process.kill(selected.watcher.pid, 'SIGTERM');
          signaled = true;
        } catch {
          signaled = false;
        }
      }
      const payload: any = {
        directive: 'stop',
        control,
        watcher: watcherSummary(selected.watcher),
        signaled,
        message:
          'Watcher stop requested. If continued monitoring is desired, restart catch-up-then-watch after your response.',
      };
      if (args.json) return emitJson(payload, 0);
      return emit(
        signaled
          ? `Watcher stop requested for pid ${selected.watcher.pid}\nIf continued monitoring is desired, restart catch-up-then-watch after your response.`
          : 'Watcher stop directive written.\nIf continued monitoring is desired, restart catch-up-then-watch after your response.',
        0,
      );
    }

    default:
      return emitError(
        `Unknown watch-ctl operation: ${args.watchCtlOp}. Valid operations: status, pause, resume, flush, stop`,
        1,
      );
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(argv: string[]): Promise<void> {
  const args = parseCliArgs(argv);

  if (args.help && !args.subcommand) {
    return printUsage();
  }

  switch (args.subcommand) {
    case 'review':
      return runReview(args);
    case 'catch-up':
      return runCatchUp(args);
    case 'locate':
      return runLocate(args);
    case 'state':
      return runState(args);
    case 'watch':
    case 'catch-up-then-watch':
      return runWatch(args);
    case 'watch-ctl':
      return runWatchCtl(args);
    default:
      return emitError(
        args.subcommand
          ? `Unknown subcommand: ${args.subcommand}. Use review, catch-up, catch-up-then-watch, locate, state, watch, or watch-ctl.`
          : 'No subcommand specified. Use review, catch-up, catch-up-then-watch, locate, state, watch, or watch-ctl.',
        1,
      );
  }
}

main(process.argv.slice(2)).catch((err) => {
  process.stderr.write(
    `[session-observer] Unexpected error: ${err.message}\n${err.stack}\n`,
  );
  process.exit(1);
});
