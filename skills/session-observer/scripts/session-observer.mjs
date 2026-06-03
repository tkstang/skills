#!/usr/bin/env node
/**
 * session-observer.mjs — CLI entrypoint for the session-observer skill.
 *
 * Usage:
 *   node session-observer.mjs <subcommand> [options]
 *
 * Subcommands: review, catch-up, locate, state, watch, watch-ctl
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

import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';

// ---------------------------------------------------------------------------
// Lib imports (resolved relative to this file)
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB = join(__dirname, 'lib');

const { discover, gitWorktrees, claudeCodeLookupDiagnostics } = await import(join(LIB, 'locate.mjs'));
const { rank } = await import(join(LIB, 'rank.mjs'));
const { buildDigest, renderMarkdown, renderJson } = await import(join(LIB, 'digest.mjs'));
const { observeCatchUp } = await import(join(LIB, 'observe.mjs'));
const { runWatchLoop } = await import(join(LIB, 'watch.mjs'));
const stateLib = await import(join(LIB, 'state.mjs'));
const watchStateLib = await import(join(LIB, 'watch-state.mjs'));

// ---------------------------------------------------------------------------
// argv parsing
// ---------------------------------------------------------------------------

/**
 * Parse process.argv[2...] into { subcommand, stateOp, ...flags }.
 * Uses node:util parseArgs.
 */
function parseCliArgs(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: false,
    options: {
      runtime:              { type: 'string',  default: 'auto' },
      cwd:                  { type: 'string',  default: process.cwd() },
      json:                 { type: 'boolean', default: false },
      'include-tools':      { type: 'boolean', default: false },
      'include-tool-results': { type: 'boolean', default: false },
      'include-command-messages': { type: 'boolean', default: false },
      debug:                { type: 'boolean', default: false },
      'max-turns':          { type: 'string',  default: undefined },
      'max-bytes':          { type: 'string',  default: undefined },
      session:              { type: 'string',  default: undefined },
      snippet:              { type: 'string',  default: undefined },
      'mark-read':          { type: 'boolean', default: false },
      watch:                { type: 'boolean', default: false },
      'debounce-sec':       { type: 'string',  default: undefined },
      'poll-sec':           { type: 'string',  default: undefined },
      'max-runtime-min':    { type: 'string',  default: undefined },
      'event-log':          { type: 'string',  default: undefined },
      help:                 { type: 'boolean', default: false },
    },
  });

  let [subcommand, ...rest] = positionals;
  if (values.watch && !subcommand) {
    subcommand = 'watch';
    rest = [];
  }

  // --debug is shorthand for --include-tools --include-tool-results
  const includeTools = values['include-tools'] || values.debug || false;
  const includeToolResults = values['include-tool-results'] || values.debug || false;

  const maxTurns = values['max-turns'] ? parseInt(values['max-turns'], 10) : undefined;
  const maxBytes = values['max-bytes'] ? parseInt(values['max-bytes'], 10) : undefined;
  const debounceSec = values['debounce-sec'] ? parseFloat(values['debounce-sec']) : 2;
  const pollSec = values['poll-sec'] ? parseFloat(values['poll-sec']) : 2;
  const maxRuntimeMin = values['max-runtime-min'] ? parseFloat(values['max-runtime-min']) : 0;

  // For 'state' subcommand, the op is in rest[0]: get, reset, clear
  const stateOp = subcommand === 'state' ? rest[0] : undefined;
  const watchCtlOp = subcommand === 'watch-ctl' ? rest[0] : undefined;

  return {
    subcommand,
    stateOp,
    watchCtlOp,
    runtime: values.runtime,
    cwd: values.cwd,
    json: values.json,
    includeTools,
    includeToolResults,
    includeCommandMessages: values['include-command-messages'] || false,
    debug: values.debug,
    maxTurns,
    maxBytes,
    session: values.session,
    snippet: values.snippet,
    markRead: values['mark-read'],
    watch: values.watch,
    debounceSec,
    pollSec,
    maxRuntimeMin,
    eventLog: values['event-log'],
    help: values.help,
  };
}

// ---------------------------------------------------------------------------
// Runtime resolution
// ---------------------------------------------------------------------------

const VALID_RUNTIMES = ['claude-code', 'codex', 'cursor'];
const VALID_RUNTIME_LABEL = VALID_RUNTIMES.join(', ');
const VALID_WATCH_RUNTIMES = [...VALID_RUNTIMES, 'auto', 'both'];
const VALID_WATCH_RUNTIME_LABEL = VALID_WATCH_RUNTIMES.join('|');

async function preferredRuntimeFromState(withCandidates, targetCwd) {
  let state;
  try {
    state = await stateLib.load();
  } catch {
    return null;
  }

  const runtimeSet = new Set(withCandidates.map(r => r.runtime));
  const sessionIdsByRuntime = new Map(
    withCandidates.map(r => [r.runtime, new Set(r.candidates.map(c => c.sessionId))])
  );

  const matches = Object.values(state.sessions ?? {})
    .filter(s => runtimeSet.has(s.runtime))
    .filter(s => s.recordedCwd === targetCwd)
    .filter(s => sessionIdsByRuntime.get(s.runtime)?.has(s.sessionId))
    .sort((a, b) => String(b.lastReadAt ?? '').localeCompare(String(a.lastReadAt ?? '')));

  const runtimes = [...new Set(matches.map(s => s.runtime))];
  if (runtimes.length !== 1) return null;
  return { runtime: runtimes[0], reason: 'state-cwd-prior-session', sessionId: matches[0]?.sessionId };
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
async function resolveAutoRuntime(targetCwd) {
  const self = process.env.SESSION_OBSERVER_SELF;
  const results = await Promise.all(
    VALID_RUNTIMES.map(async (rt) => {
      try {
        const candidates = await discover(rt, targetCwd);
        return { runtime: rt, candidates };
      } catch {
        return { runtime: rt, candidates: [] };
      }
    })
  );

  const withCandidates = results.filter(r => r.candidates.length > 0);
  const considered = VALID_RUNTIMES.includes(self)
    ? withCandidates.filter(r => r.runtime !== self)
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
    runtimes: considered.map(r => r.runtime),
    candidates: Object.fromEntries(considered.map(r => [r.runtime, r.candidates])),
  };
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

function emit(content, exitCode = 0) {
  process.stdout.write(content + '\n');
  process.exit(exitCode);
}

function emitJson(obj, exitCode = 0) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
  process.exit(exitCode);
}

function emitError(message, exitCode = 1) {
  process.stderr.write(`[session-observer] ${message}\n`);
  process.exit(exitCode);
}

function parsePinnedSession(session) {
  if (!session) return null;
  const colonIndex = session.indexOf(':');
  if (colonIndex === -1) {
    return { error: '--session must be in <runtime>:<sessionId> format (e.g. codex:abc123)' };
  }
  const runtime = session.slice(0, colonIndex);
  const sessionId = session.slice(colonIndex + 1);
  if (!VALID_RUNTIMES.includes(runtime)) {
    return {
      error: `Unknown runtime in --session: ${runtime}. Use one of: ${VALID_RUNTIME_LABEL}.`,
    };
  }
  return { runtime, sessionId };
}

function shouldMarkCatchUpRead(sessionState, digest) {
  if (digest.range.newRecords > 0) return true;
  if (!sessionState) return true;
  return (
    sessionState.lastRecordIndex !== digest.range.nextIndex ||
    sessionState.lastTotalRecords !== digest.range.totalRecords
  );
}

async function applySnippetFilter(candidates, snippet) {
  if (!snippet) return { candidates, matches: [] };
  const needle = snippet.toLowerCase();
  const matches = [];
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

function printUsage() {
  process.stdout.write([
    'Usage: session-observer <subcommand> [options]',
    '',
    'Subcommands:',
    '  review     One-shot full digest of the most relevant peer session',
    '  catch-up   Incremental: only records added since the last read',
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
    '  --max-runtime-min <N>               Auto-exit after N minutes (0 = unlimited)',
    '  --event-log <path>                  Metadata-only JSONL event log',
    '',
  ].join('\n'));
  process.exit(0);
}

function printWatchUsage() {
  process.stdout.write([
    'Usage: session-observer watch [options]',
    '',
    'Options:',
    '  --runtime <claude-code|codex|cursor|auto|both>  (default: auto)',
    '  --cwd <path>                        (default: process.cwd())',
    '  --debounce-sec <N>                  Seconds of quiet before emitting (default: 2)',
    '  --poll-sec <N>                      Poll interval in seconds (default: 2)',
    '  --max-runtime-min <N>               Auto-exit after N minutes (0 = unlimited)',
    '  --event-log <path>                  Metadata-only JSONL event log',
    '  --json                              Emit JSON-line events instead of markdown',
    '  --session <runtime:id>              Pin to a specific session',
    '  --snippet <text>                    Prefer candidates containing this transcript excerpt',
    '',
  ].join('\n'));
  process.exit(0);
}

function printWatchCtlUsage() {
  process.stdout.write([
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
    '  --json     Output JSON instead of text',
    '',
  ].join('\n'));
  process.exit(0);
}

// ---------------------------------------------------------------------------
// runReview
// ---------------------------------------------------------------------------

async function runReview(args) {
  const { cwd, includeTools, includeToolResults, includeCommandMessages, maxTurns, maxBytes, json, markRead, session, snippet } = args;
  let { runtime } = args;
  const pinnedSession = parsePinnedSession(session);
  if (pinnedSession?.error) return emitError(pinnedSession.error, 1);
  if (pinnedSession) runtime = pinnedSession.runtime;

  // Resolve auto runtime
  if (runtime === 'auto') {
    const resolved = await resolveAutoRuntime(cwd);
    if (resolved.noMatch) {
      const payload = { noMatch: true, cwd, message: 'No candidates found in any runtime for this cwd.' };
      if (json) return emitJson(payload, 2);
      return emit(`No peer-session candidates found for cwd: ${cwd}`, 2);
    }
    if (resolved.ambiguous) {
      const payload = {
        ambiguousRuntime: true,
        runtimes: resolved.runtimes,
        message: 'Candidates found in multiple runtimes. Use --runtime to specify.',
      };
      if (json) return emitJson(payload, 3);
      return emit(
        `Ambiguous runtime: candidates found in both ${resolved.runtimes.join(', ')}. ` +
        `Specify --runtime <runtime>.`,
        3
      );
    }
    runtime = resolved.runtime;
  }

  // Discover candidates
  let candidates;
  try {
    candidates = await discover(runtime, cwd);
  } catch (err) {
    return emitError(`Failed to discover transcripts: ${err.message}`, 1);
  }

  if (candidates.length === 0) {
    const payload = { noMatch: true, runtime, cwd, message: 'No candidates found.' };
    if (json) return emitJson(payload, 2);
    return emit(`No ${runtime} transcripts found for cwd: ${cwd}`, 2);
  }

  // Resolve pinned session override BEFORE tie/no-match checks.
  // When --session <runtime:id> is provided and the candidate exists, select it directly
  // and skip ranking/tie/no-match branches entirely.
  if (pinnedSession) {
    const pinnedRuntime = pinnedSession.runtime;
    const pinnedId = pinnedSession.sessionId;
    const pinned = candidates.find(c => c.runtime === pinnedRuntime && c.sessionId === pinnedId);
    if (!pinned) {
      return emitError(
        `Pinned session not found: ${session}. Run locate to see available sessions.`,
        1
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
      return emitError(`Failed to build digest: ${err.message}`, 1);
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
      return emit(`No ${runtime} candidate transcripts contained the provided snippet.`, 2);
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

  // Check for ties
  if (rankResult.ties && rankResult.ties.length > 0) {
    const payload = {
      ties: true,
      candidates: [rankResult.winner, ...rankResult.ties],
      message: 'Multiple sessions tied. Use --session <runtime:id> to pick one.',
    };
    if (json) return emitJson(payload, 3);
    return emit(
      `Multiple sessions tied. Specify --session to disambiguate:\n` +
      [rankResult.winner, ...rankResult.ties].map(c => `  ${c.runtime}:${c.sessionId}  (${c.transcriptPath})`).join('\n'),
      3
    );
  }

  let winner = rankResult.winner;

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
        ? [`Selected session by snippet match: ${winner.sessionId} (${winner.recordedCwd ?? 'unknown cwd'})`]
        : [],
      fallbacks: rankResult.fallbacks,
    });
  } catch (err) {
    return emitError(`Failed to build digest: ${err.message}`, 1);
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

async function runCatchUp(args) {
  const result = await observeCatchUp(args);
  if (!result.ok) {
    if (result.kind === 'error') return emitError(result.message, result.exitCode);
    if (args.json) return emitJson(result.payload, result.exitCode);
    return emit(result.message, result.exitCode);
  }

  if (args.json) return emitJson(result.digest, 0);
  return emit(renderMarkdown(result.digest), 0);
}

// ---------------------------------------------------------------------------
// runLocate
// ---------------------------------------------------------------------------

async function runLocate(args) {
  const { cwd, json, debug, snippet } = args;
  let { runtime } = args;

  if (runtime === 'auto') {
    // For locate, try both runtimes and show all
    const allCandidates = [];
    for (const rt of VALID_RUNTIMES) {
      try {
        const candidates = await discover(rt, cwd);
        allCandidates.push(...candidates);
      } catch {
        // continue
      }
    }

    let snippetMatches = [];
    if (snippet) {
      const filtered = await applySnippetFilter(allCandidates, snippet);
      snippetMatches = filtered.matches;
      allCandidates.splice(0, allCandidates.length, ...filtered.candidates);
      if (allCandidates.length === 0) {
        const payload = {
          noMatch: true,
          cwd,
          snippet,
          message: 'No candidate transcripts contained the provided snippet.',
        };
        if (debug) payload.lookupDiagnostics = {
          claudeCode: await claudeCodeLookupDiagnostics(cwd),
        };
        if (json) return emitJson(payload, 2);
        return emit(`No transcripts contained the provided snippet.`, 2);
      }
    }

    const worktrees = await gitWorktrees(cwd).catch(() => []);
    const rankResult = rank(allCandidates, cwd, { gitWorktrees: worktrees });

    if (rankResult.noMatch) {
      const payload = { noMatch: true, cwd, sisters: rankResult.sisters, globalRecent: rankResult.globalRecent };
      if (debug) payload.lookupDiagnostics = {
        claudeCode: await claudeCodeLookupDiagnostics(cwd),
      };
      if (json) return emitJson(payload, 2);
      return emit(`No transcripts found for cwd: ${cwd}`, 2);
    }

    const payload = {
      winner: rankResult.winner,
      tier: rankResult.tier,
      ties: rankResult.ties,
      fallbacks: rankResult.fallbacks,
    };
    if (snippet) payload.snippet = { query: snippet, matches: snippetMatches };
    if (debug) payload.lookupDiagnostics = {
      claudeCode: await claudeCodeLookupDiagnostics(cwd),
    };
    if (json) return emitJson(payload, 0);
    return emit(
      `Winner: ${rankResult.winner.runtime}:${rankResult.winner.sessionId}\n` +
      `  Tier: ${rankResult.tier}\n` +
      `  Transcript: ${rankResult.winner.transcriptPath}\n` +
      `  Fallbacks: ${rankResult.fallbacks.length}`,
      0
    );
  }

  // Single runtime
  let candidates;
  try {
    candidates = await discover(runtime, cwd);
  } catch (err) {
    return emitError(`Failed to discover transcripts: ${err.message}`, 1);
  }

  if (candidates.length === 0) {
    const payload = { noMatch: true, runtime, cwd };
    if (debug && runtime === 'claude-code') {
      payload.lookupDiagnostics = {
        claudeCode: await claudeCodeLookupDiagnostics(cwd),
      };
    }
    if (json) return emitJson(payload, 2);
    return emit(`No ${runtime} transcripts found for cwd: ${cwd}`, 2);
  }

  let snippetMatches = [];
  if (snippet) {
    const filtered = await applySnippetFilter(candidates, snippet);
    snippetMatches = filtered.matches;
    candidates = filtered.candidates;
    if (candidates.length === 0) {
      const payload = {
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
      return emit(`No ${runtime} candidate transcripts contained the provided snippet.`, 2);
    }
  }

  const worktrees = await gitWorktrees(cwd).catch(() => []);
  const rankResult = rank(candidates, cwd, { gitWorktrees: worktrees });

  if (rankResult.noMatch) {
    const payload = { noMatch: true, runtime, cwd, sisters: rankResult.sisters, globalRecent: rankResult.globalRecent };
    if (debug && runtime === 'claude-code') {
      payload.lookupDiagnostics = {
        claudeCode: await claudeCodeLookupDiagnostics(cwd),
      };
    }
    if (json) return emitJson(payload, 2);
    return emit(`No ${runtime} transcripts matched cwd: ${cwd}`, 2);
  }

  const payload = {
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
    0
  );
}

// ---------------------------------------------------------------------------
// runState
// ---------------------------------------------------------------------------

async function runState(args) {
  const { stateOp, json } = args;
  let { runtime } = args;

  switch (stateOp) {
    case 'get': {
      try {
        const state = await stateLib.load();
        if (json) return emitJson(state, 0);
        const sessions = Object.values(state.sessions);
        if (sessions.length === 0) {
          return emit('No sessions tracked yet.', 0);
        }
        const lines = sessions.map(s =>
          `${s.runtime}:${s.sessionId}  offset=${s.lastRecordIndex}/${s.lastTotalRecords}  ` +
          `lastReadAt=${s.lastReadAt}`
        );
        return emit(lines.join('\n'), 0);
      } catch (err) {
        return emitError(`Failed to load state: ${err.message}`, 1);
      }
    }

    case 'reset': {
      // --session <runtime>:<sessionId> takes priority over --runtime
      if (args.session) {
        const sep = args.session.indexOf(':');
        if (sep === -1) {
          return emitError(
            '--session must be in <runtime>:<sessionId> format (e.g. codex:abc123)',
            1
          );
        }
        const sessionRuntime = args.session.slice(0, sep);
        const sessionId = args.session.slice(sep + 1);
        if (!VALID_RUNTIMES.includes(sessionRuntime)) {
          return emitError(
            `Unknown runtime in --session: ${sessionRuntime}. Use one of: ${VALID_RUNTIME_LABEL}.`,
            1
          );
        }
        try {
          await stateLib.resetBySession(sessionRuntime, sessionId);
          if (json) return emitJson({ reset: true, runtime: sessionRuntime, sessionId }, 0);
          return emit(`Reset session: ${sessionRuntime}:${sessionId}`, 0);
        } catch (err) {
          return emitError(`Failed to reset state: ${err.message}`, 1);
        }
      }

      if (!runtime || runtime === 'auto') {
        return emitError(
          `--runtime is required for state reset (use one of: ${VALID_RUNTIME_LABEL}), or use --session <runtime>:<sessionId>`,
          1
        );
      }
      if (!VALID_RUNTIMES.includes(runtime)) {
        return emitError(`Unknown runtime: ${runtime}. Use one of: ${VALID_RUNTIME_LABEL}.`, 1);
      }
      try {
        const count = await stateLib.resetByRuntime(runtime);
        if (json) return emitJson({ reset: true, runtime, count }, 0);
        return emit(`Reset ${count} session(s) for runtime: ${runtime}`, 0);
      } catch (err) {
        return emitError(`Failed to reset state: ${err.message}`, 1);
      }
    }

    case 'clear': {
      try {
        await stateLib.clear();
        if (json) return emitJson({ cleared: true }, 0);
        return emit('State cleared.', 0);
      } catch (err) {
        return emitError(`Failed to clear state: ${err.message}`, 1);
      }
    }

    default: {
      emitError(
        `Unknown state operation: ${stateOp ?? '(none)'}. ` +
        `Valid operations: get, reset, clear`,
        1
      );
    }
  }
}

// ---------------------------------------------------------------------------
// runWatch / runWatchCtl
// ---------------------------------------------------------------------------

async function runWatch(args) {
  if (args.help) return printWatchUsage();

  if (!VALID_WATCH_RUNTIMES.includes(args.runtime)) {
    return emitError(
      `Unknown watch runtime: ${args.runtime}. Use one of: ${VALID_WATCH_RUNTIME_LABEL}.`,
      1
    );
  }

  try {
    await runWatchLoop(args, {
      writeStdout: chunk => process.stdout.write(chunk),
    });
  } catch (err) {
    return emitError(`Watch failed: ${err.message}`, 1);
  }
}

async function emitNoActiveWatcher(args) {
  await watchStateLib.clearControlDirective().catch(() => false);
  const payload = {
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

async function runWatchCtl(args) {
  if (args.help || !args.watchCtlOp) return printWatchCtlUsage();

  switch (args.watchCtlOp) {
    case 'status': {
      const state = await watchStateLib.loadWatchState();
      const payload = state.active
        ? {
            active: true,
            noActiveWatcher: false,
            watcher: state.active,
          }
        : {
            active: false,
            noActiveWatcher: true,
            watcher: null,
            message: 'No active watcher.',
          };
      if (args.json) return emitJson(payload, 0);
      return emit(state.active
        ? `Watcher active: ${state.active.runtime} ${state.active.cwd} (pid ${state.active.pid})`
        : 'No active watcher.', 0);
    }

    case 'pause':
    case 'resume':
    case 'flush': {
      const state = await watchStateLib.loadWatchState();
      if (!state.active) return emitNoActiveWatcher(args);

      const control = await watchStateLib.writeControlDirective(args.watchCtlOp);
      const payload = {
        directive: args.watchCtlOp,
        control,
      };
      if (args.json) return emitJson(payload, 0);
      return emit(`Watcher directive written: ${args.watchCtlOp}`, 0);
    }

    case 'stop': {
      const state = await watchStateLib.loadWatchState();
      if (!state.active) return emitNoActiveWatcher(args);

      const control = await watchStateLib.writeControlDirective('stop');
      let signaled = false;
      if (state.active?.pid) {
        try {
          process.kill(state.active.pid, 'SIGTERM');
          signaled = true;
        } catch {
          signaled = false;
        }
      }
      const payload = {
        directive: 'stop',
        control,
        watcher: state.active ?? null,
        signaled,
      };
      if (args.json) return emitJson(payload, 0);
      return emit(signaled
        ? `Watcher stop requested for pid ${state.active.pid}`
        : 'Watcher stop directive written.', 0);
    }

    default:
      return emitError(
        `Unknown watch-ctl operation: ${args.watchCtlOp}. Valid operations: status, pause, resume, flush, stop`,
        1
      );
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(argv) {
  const args = parseCliArgs(argv);

  if (args.help && !args.subcommand) {
    return printUsage();
  }

  switch (args.subcommand) {
    case 'review':   return runReview(args);
    case 'catch-up': return runCatchUp(args);
    case 'locate':   return runLocate(args);
    case 'state':    return runState(args);
    case 'watch':    return runWatch(args);
    case 'watch-ctl': return runWatchCtl(args);
    default:
      return emitError(
        args.subcommand
          ? `Unknown subcommand: ${args.subcommand}. Use review, catch-up, locate, state, watch, or watch-ctl.`
          : 'No subcommand specified. Use review, catch-up, locate, state, watch, or watch-ctl.',
        1
      );
  }
}

main(process.argv.slice(2)).catch((err) => {
  process.stderr.write(`[session-observer] Unexpected error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
});
