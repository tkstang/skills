/**
 * Tiered search pipeline (design.md Data Flow).
 *
 * 1. Probe the optional accelerators (`rg`, `sqlite3`).
 * 2. Enumerate sessions per selected runtime (stat only) and apply the time
 *    window (activity-interval overlap).
 * 3. Pass 1 is scoped to sessions whose cwd matches a `--cwd` hint (equal or
 *    descendant; Cursor by project slug).
 * 4. Tiers run cheapest first: history, metadata, then content. Before the
 *    content tier a large-scan guard measures the candidate bytes; over the
 *    threshold (without `allowLargeScan`) content is restricted to sessions
 *    already hit by the cheap tiers and `needsConfirmation` is set. If even
 *    that restricted set is over the threshold, content scanning is skipped.
 * 5. A scoped pass with zero sessions re-runs unscoped (`widened: true`).
 * 6. Still zero and the deep rung enabled: the content scan re-runs with tool
 *    output included, under the same guard.
 * 7. Rank, redact, and assemble the `session-search/v1` result.
 */
import os from 'node:os';

import {
  claudeSlugMatchesCwd,
  createClaudeCodeAdapter,
} from './adapters/claude-code.js';
import { createCodexAdapter } from './adapters/codex.js';
import {
  createCursorAdapter,
  cursorSlugMatchesCwd,
} from './adapters/cursor.js';
import { compileMatcher } from './matcher.js';
import { cwdMatchesHint, rankSessions, type RankSession } from './rank.js';
import { scanFiles, type ScanStats } from './scan.js';
import { probeTools } from './tools.js';
import type {
  AdapterContext,
  Hit,
  NeedsConfirmation,
  Runtime,
  SearchOptions,
  SearchResult,
  SessionFile,
  SourceAdapter,
  SourceReport,
  SourceStatus,
  StoreRoots,
  Tier,
  ToolPaths,
} from './types.js';
import { inTimeWindow, timeInWindow } from './window.js';

export const SEARCH_SCHEMA = 'session-search/v1';
export const ESTIMATE_SCHEMA = 'session-search-estimate/v1';
/** Hits kept per transcript file before the scanner moves on. */
export const MAX_HITS_PER_SESSION = 25;
const TIER_ORDER: readonly Tier[] = ['history', 'meta', 'content', 'deep'];

const ADAPTERS: Record<Runtime, () => SourceAdapter> = {
  'claude-code': createClaudeCodeAdapter,
  codex: createCodexAdapter,
  cursor: createCursorAdapter,
};

export interface SearchContext {
  home: string;
  env: Readonly<Record<string, string | undefined>>;
  /** Receives diagnostic notes that have no slot in the JSON result. */
  onNote?: (note: string) => void;
}

interface RuntimeState {
  runtime: Runtime;
  adapter: SourceAdapter;
  roots: StoreRoots;
  notes: string[];
  files: SessionFile[];
  windowFiles: SessionFile[];
}

const keyOf = (runtime: Runtime, sessionId: string) =>
  `${runtime}\u0000${sessionId}`;
const sumBytes = (files: readonly SessionFile[]) =>
  files.reduce((total, file) => total + file.size, 0);

function hasStore(roots: StoreRoots): boolean {
  return (
    roots.exists || Object.values(roots.paths).some((value) => value !== null)
  );
}

function sourceStatus(state: RuntimeState): SourceStatus {
  if (!hasStore(state.roots)) return 'absent';
  return state.notes.length > 0 ? 'degraded' : 'ok';
}

function isoOrNull(ms: number | null): string | null {
  return ms === null ? null : new Date(ms).toISOString();
}

/** Resolve roots, enumerate, and apply the time window for every runtime. */
async function prepare(
  options: SearchOptions,
  context: SearchContext,
  tools: ToolPaths,
  deadline: number | null = null,
): Promise<RuntimeState[]> {
  const states: RuntimeState[] = [];
  for (const runtime of options.runtimes) {
    const adapter = ADAPTERS[runtime]();
    const roots = adapter.roots(context.home);
    const state: RuntimeState = {
      runtime,
      adapter,
      roots,
      notes: [],
      files: [],
      windowFiles: [],
    };
    state.files = await adapter.enumerate({
      home: context.home,
      env: context.env,
      options,
      tools,
      roots,
      degrade: (note) => state.notes.push(note),
      deadline,
    });
    state.windowFiles = state.files.filter((file) =>
      inTimeWindow(file, options.since, options.until),
    );
    states.push(state);
  }
  return states;
}

/** True when a session file lies inside one of the cwd hints. */
async function inScope(
  file: SessionFile,
  adapter: SourceAdapter,
  hints: readonly string[],
): Promise<boolean> {
  if (file.runtime === 'cursor') {
    return hints.some((hint) =>
      cursorSlugMatchesCwd(file.projectSlug ?? '', hint),
    );
  }
  if (file.runtime === 'claude-code') {
    if (
      !hints.some((hint) => claudeSlugMatchesCwd(file.projectSlug ?? '', hint))
    ) {
      return false;
    }
    const info = await adapter.sessionInfo(file);
    return info.cwd === null ? true : cwdMatchesHint(info.cwd, hints);
  }
  const cwd = file.cwd ?? (await adapter.sessionInfo(file)).cwd;
  return cwdMatchesHint(cwd, hints);
}

interface GuardResult {
  files: SessionFile[];
  needsConfirmation: NeedsConfirmation | null;
  /** True when even the restricted set is over the threshold. */
  skip: boolean;
  restricted: boolean;
}

/** Large-scan guard, measured on the already window- and scope-narrowed set. */
function applyGuard(
  options: SearchOptions,
  candidates: readonly SessionFile[],
  cheapHits: readonly Hit[],
): GuardResult {
  const total = sumBytes(candidates);
  if (options.allowLargeScan || total <= options.largeScanBytes) {
    return {
      files: [...candidates],
      needsConfirmation: null,
      skip: false,
      restricted: false,
    };
  }
  const needsConfirmation: NeedsConfirmation = {
    reason: 'large-scan',
    estimatedBytes: total,
    fileCount: candidates.length,
    rerunFlag: '--allow-large-scan',
  };
  const hitKeys = new Set(
    cheapHits.map((hit) => keyOf(hit.runtime, hit.sessionId)),
  );
  const restricted = candidates.filter((file) =>
    hitKeys.has(keyOf(file.runtime, file.sessionId)),
  );
  if (sumBytes(restricted) > options.largeScanBytes) {
    return { files: [], needsConfirmation, skip: true, restricted: true };
  }
  return {
    files: restricted,
    needsConfirmation,
    skip: false,
    restricted: true,
  };
}

/** Run one search over a fixed candidate set. */
export async function runSearch(
  options: SearchOptions,
  context: SearchContext,
): Promise<SearchResult> {
  const started = Date.now();
  const deadline =
    options.deadlineMs === null ? null : started + options.deadlineMs;
  const expired = () => deadline !== null && Date.now() >= deadline;
  const probe = probeTools(context.env);
  for (const note of probe.notes) context.onNote?.(note);
  const tools: ToolPaths = { rg: probe.rg, sqlite3: probe.sqlite3 };
  const matcher = compileMatcher(options.patterns, {
    literal: options.literal,
  });

  const states = await prepare(options, context, tools, deadline);
  const stateFor = new Map(states.map((state) => [state.runtime, state]));
  const adapterFor = (runtime: Runtime) => {
    const state = stateFor.get(runtime);
    if (!state) throw new Error(`runtime not prepared: ${runtime}`);
    return state.adapter;
  };
  const fileIndex = new Map<string, SessionFile>();
  for (const state of states) {
    for (const file of state.files)
      fileIndex.set(keyOf(file.runtime, file.sessionId), file);
  }
  const windowFiles = states.flatMap((state) => state.windowFiles);

  const tiersRun = new Set<Tier>();
  const stats: ScanStats = {
    filesScanned: 0,
    bytesScanned: 0,
    linesSkippedOversize: 0,
    parseErrors: 0,
    timedOut: false,
  };
  let needsConfirmation: NeedsConfirmation | null = null;
  // Enumeration skips header reads once the deadline passes.
  let incomplete = expired();

  const contextFor = (
    state: RuntimeState,
    files: SessionFile[],
  ): AdapterContext => ({
    home: context.home,
    env: context.env,
    options,
    tools,
    roots: state.roots,
    files: files.filter((file) => file.runtime === state.runtime),
    degrade: (note) => state.notes.push(note),
    deadline,
  });

  const acceptHit = (
    hit: Hit,
    candidateKeys: Set<string>,
    scoped: boolean,
  ): boolean => {
    const key = keyOf(hit.runtime, hit.sessionId);
    if (fileIndex.has(key)) return candidateKeys.has(key);
    // No transcript on this machine: judge the hit by its own facts.
    if (hit.timestampMs === null) {
      if (options.since !== null || options.until !== null) return false;
    } else if (!timeInWindow(hit.timestampMs, options.since, options.until)) {
      return false;
    }
    return scoped ? cwdMatchesHint(hit.cwd, options.cwdHints) : true;
  };

  const runScan = async (
    candidates: SessionFile[],
    cheapHits: Hit[],
    includeTools: boolean,
  ): Promise<Hit[]> => {
    const guard = applyGuard(options, candidates, cheapHits);
    if (guard.needsConfirmation) needsConfirmation = guard.needsConfirmation;
    if (guard.skip || (guard.restricted && guard.files.length === 0)) return [];
    const scan = await scanFiles(guard.files, adapterFor, matcher, {
      maxLineBytes: options.maxLineBytes,
      includeTools,
      maxHitsPerSession: MAX_HITS_PER_SESSION,
      deadline,
      rg: tools.rg,
    });
    for (const note of scan.notes) context.onNote?.(note);
    stats.filesScanned += scan.stats.filesScanned;
    stats.bytesScanned += scan.stats.bytesScanned;
    stats.linesSkippedOversize += scan.stats.linesSkippedOversize;
    stats.parseErrors += scan.stats.parseErrors;
    if (scan.stats.timedOut) incomplete = true;
    tiersRun.add(includeTools ? 'deep' : 'content');
    return scan.hits;
  };

  const runPass = async (candidates: SessionFile[], scoped: boolean) => {
    const candidateKeys = new Set(
      candidates.map((file) => keyOf(file.runtime, file.sessionId)),
    );
    const cheap: Hit[] = [];
    for (const tier of ['history', 'meta'] as const) {
      if (!options.tiers.includes(tier)) continue;
      if (expired()) {
        incomplete = true;
        return { hits: [...cheap], cheap };
      }
      for (const state of states) {
        const ctx = contextFor(state, candidates);
        const found =
          tier === 'history'
            ? await state.adapter.historyHits(ctx, matcher)
            : await state.adapter.metadataHits(ctx, matcher);
        cheap.push(
          ...found.filter((hit) => acceptHit(hit, candidateKeys, scoped)),
        );
      }
      tiersRun.add(tier);
      // Per-file title reads stop at the deadline.
      if (expired()) incomplete = true;
    }
    const hits = [...cheap];
    if (options.tiers.includes('content')) {
      if (expired()) {
        incomplete = true;
        return { hits, cheap };
      }
      hits.push(...(await runScan(candidates, cheap, options.includeTools)));
    }
    return { hits, cheap };
  };

  let candidates = windowFiles;
  let widened = false;
  if (options.cwdHints.length > 0) {
    const scoped: SessionFile[] = [];
    for (const file of windowFiles) {
      if (expired()) {
        // Unchecked files stay out of scope; the run is partial.
        incomplete = true;
        break;
      }
      if (await inScope(file, adapterFor(file.runtime), options.cwdHints))
        scoped.push(file);
    }
    candidates = scoped;
  }
  let pass = await runPass(candidates, options.cwdHints.length > 0);
  if (options.cwdHints.length > 0 && pass.hits.length === 0 && !incomplete) {
    widened = true;
    candidates = windowFiles;
    pass = await runPass(candidates, false);
  }
  const hits = [...pass.hits];
  if (
    hits.length === 0 &&
    options.deep &&
    !options.includeTools &&
    options.tiers.includes('content') &&
    !incomplete
  ) {
    if (expired()) incomplete = true;
    else hits.push(...(await runScan(candidates, pass.cheap, true)));
  }

  const sessions = await sessionsFor(hits, fileIndex, adapterFor, options);
  const results = rankSessions(hits, sessions, {
    matcher,
    cwdHints: options.cwdHints,
    limit: options.limit,
  });

  const sources: SourceReport[] = states.map((state) => {
    const note = state.notes.join('; ');
    return {
      runtime: state.runtime,
      root: state.roots.root,
      status: sourceStatus(state),
      sessions: state.windowFiles.filter((file) => !file.isSubagent).length,
      ...(note ? { note } : {}),
    };
  });

  return {
    schema: SEARCH_SCHEMA,
    query: {
      patterns: [...options.patterns],
      literal: options.literal,
      since: isoOrNull(options.since),
      until: isoOrNull(options.until),
      cwdHints: [...options.cwdHints],
      runtimes: [...options.runtimes],
    },
    host: { hostname: os.hostname(), platform: process.platform },
    tools,
    tiersRun: TIER_ORDER.filter((tier) => tiersRun.has(tier)),
    widened,
    needsConfirmation,
    incomplete,
    sources,
    results,
    diagnostics: {
      filesScanned: stats.filesScanned,
      bytesScanned: stats.bytesScanned,
      linesSkippedOversize: stats.linesSkippedOversize,
      parseErrors: stats.parseErrors,
      elapsedMs: Date.now() - started,
    },
  };
}

/** Presentation facts for every session a hit touches (and its parent). */
async function sessionsFor(
  hits: readonly Hit[],
  fileIndex: Map<string, SessionFile>,
  adapterFor: (runtime: Runtime) => SourceAdapter,
  options: SearchOptions,
): Promise<RankSession[]> {
  const keys = new Set<string>();
  const orphanHits = new Map<string, Hit[]>();
  for (const hit of hits) {
    const key = keyOf(hit.runtime, hit.sessionId);
    const file = fileIndex.get(key);
    if (file) {
      keys.add(key);
      if (file.parentSessionId) {
        const parentKey = keyOf(file.runtime, file.parentSessionId);
        if (fileIndex.has(parentKey)) keys.add(parentKey);
      }
    } else {
      orphanHits.set(key, [...(orphanHits.get(key) ?? []), hit]);
    }
  }

  const sessions: RankSession[] = [];
  for (const key of [...keys].toSorted()) {
    const file = fileIndex.get(key);
    if (!file) continue;
    const adapter = adapterFor(file.runtime);
    const info = await adapter.sessionInfo(file);
    const openId =
      file.isSubagent && file.parentSessionId
        ? file.parentSessionId
        : file.sessionId;
    sessions.push({
      runtime: file.runtime,
      sessionId: file.sessionId,
      archived: file.archived,
      isSubagent: file.isSubagent,
      parentSessionId: file.parentSessionId,
      cwd: info.cwd ?? file.cwd ?? null,
      title: info.title,
      firstPrompt: info.firstPrompt,
      startedAt:
        info.startedAt ??
        (file.createdAtMs != null
          ? new Date(file.createdAtMs).toISOString()
          : null),
      lastActivityMs: file.mtimeMs,
      transcriptPath: file.path,
      open: adapter.openHint(openId, info, file.path),
      ...(file.runtime === 'cursor' && options.cwdHints.length > 0
        ? {
            cwdMatch: options.cwdHints.some((hint) =>
              cursorSlugMatchesCwd(file.projectSlug ?? '', hint),
            ),
          }
        : {}),
    });
  }

  // Hits whose transcript is not on disk (for example history entries of a
  // pruned session): facts come from the hits, chosen order-independently.
  for (const [, group] of [...orphanHits].toSorted(([a], [b]) =>
    a < b ? -1 : 1,
  )) {
    const ordered = group.toSorted(
      (a, b) =>
        TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) ||
        (a.text < b.text ? -1 : a.text > b.text ? 1 : 0),
    );
    const first = ordered[0];
    const cwd = ordered.find((hit) => hit.cwd)?.cwd ?? null;
    const transcriptPath =
      ordered.find((hit) => hit.transcriptPath)?.transcriptPath ?? null;
    const info = { cwd, title: null, firstPrompt: null, startedAt: null };
    sessions.push({
      runtime: first.runtime,
      sessionId: first.sessionId,
      archived: false,
      isSubagent: false,
      parentSessionId: null,
      cwd,
      title: null,
      firstPrompt: null,
      startedAt: null,
      lastActivityMs: Math.max(
        0,
        ...ordered.map((hit) => hit.timestampMs ?? 0),
      ),
      transcriptPath,
      open: adapterFor(first.runtime).openHint(
        first.sessionId,
        info,
        transcriptPath,
      ),
    });
  }
  return sessions;
}

export interface EstimateRuntime {
  runtime: Runtime;
  root: string;
  status: SourceStatus;
  files: number;
  sessions: number;
  bytes: number;
  note?: string;
}

export interface EstimateResult {
  schema: typeof ESTIMATE_SCHEMA;
  query: {
    since: string | null;
    until: string | null;
    cwdHints: string[];
    runtimes: Runtime[];
  };
  host: { hostname: string; platform: string };
  runtimes: EstimateRuntime[];
  totalFiles: number;
  totalBytes: number;
  largeScanBytes: number;
  exceedsLargeScan: boolean;
}

/** Per-runtime file counts and bytes inside the window (and cwd scope). */
export async function estimate(
  options: SearchOptions,
  context: SearchContext,
): Promise<EstimateResult> {
  const probe = probeTools(context.env);
  const tools: ToolPaths = { rg: probe.rg, sqlite3: probe.sqlite3 };
  const states = await prepare(options, context, tools);
  const runtimes: EstimateRuntime[] = [];
  for (const state of states) {
    let files = state.windowFiles;
    if (options.cwdHints.length > 0) {
      const scoped: SessionFile[] = [];
      for (const file of files) {
        if (await inScope(file, state.adapter, options.cwdHints))
          scoped.push(file);
      }
      files = scoped;
    }
    const note = state.notes.join('; ');
    runtimes.push({
      runtime: state.runtime,
      root: state.roots.root,
      status: sourceStatus(state),
      files: files.length,
      sessions: files.filter((file) => !file.isSubagent).length,
      bytes: sumBytes(files),
      ...(note ? { note } : {}),
    });
  }
  const totalBytes = runtimes.reduce((total, entry) => total + entry.bytes, 0);
  return {
    schema: ESTIMATE_SCHEMA,
    query: {
      since: isoOrNull(options.since),
      until: isoOrNull(options.until),
      cwdHints: [...options.cwdHints],
      runtimes: [...options.runtimes],
    },
    host: { hostname: os.hostname(), platform: process.platform },
    runtimes,
    totalFiles: runtimes.reduce((total, entry) => total + entry.files, 0),
    totalBytes,
    largeScanBytes: options.largeScanBytes,
    exceedsLargeScan: totalBytes > options.largeScanBytes,
  };
}
