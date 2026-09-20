#!/usr/bin/env node
/**
 * session-export-transcript.mjs — CLI entrypoint for the session-export-transcript skill.
 *
 * Exports the CURRENT agent conversation to a sanitized Markdown transcript,
 * named after the current git branch, written by default to ~/Downloads.
 *
 * Usage:
 *   node session-export-transcript.mjs [output-path] [flags]
 *
 *   --runtime <claude-code|codex|cursor|auto>  default: auto (env hint → auto-detect)
 *   --match <marker>      grep cwd candidates for this marker (current session)
 *   --session <id>        export a specific session id (bypasses --match)
 *   --all                 export every session for the cwd (one file each)
 *   --include-activity    append bounded source-attributed tool activity
 *   --activity-output <path>  write complete sensitive activity JSON for one exact session
 *   --cwd <path>          project dir to match against (default: process.cwd())
 *   --out <path>          output file or directory (also accepted positionally)
 *   --help
 *
 * Exit codes:
 *   0 — success
 *   1 — hard error
 *   2 — no candidates for cwd/runtime
 *   3 — ambiguous (multiple candidates, no --match/--session/--all)
 *
 * Pipeline: enumerate cwd candidates → select session → readRecords →
 * normalizeEntries (STRUCTURAL) → sanitizeEntries (CONTENT) → strip marker +
 * empties → render Markdown → write.
 *
 * Dependency-free: Node standard library only.
 *
 * Script resolution: invoked by absolute path; tests resolve it via
 * fileURLToPath(new URL('./session-export-transcript.mjs', import.meta.url)).
 */

import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  lstat,
  readdir,
  stat,
  mkdir,
  open,
  rename,
  unlink,
  writeFile,
  readFile,
  realpath,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { promisify } from 'node:util';

import {
  correlateActivity,
  extractActivity,
  extractCursorActivity,
  projectActivity,
  renderActivityMarkdown,
} from '../../../shared/transcript/activity/index.js';
import type {
  ActivityReport,
  ActivitySource,
  ActivityDeliveryRange,
} from '../../../shared/transcript/activity/types.js';
import { createCursorTurnAccumulator } from '../../../shared/transcript/cursor-analysis.js';
import { scanCursorTranscript } from '../../../shared/transcript/cursor-frames.js';
import type {
  DigestEntry,
  JsonObject,
  Runtime,
  TranscriptMeta,
  DetailedTranscriptRead,
} from '../../../shared/transcript/runtimes.js';
import {
  discoverPaths,
  encodeCwdVariants,
  extractMeta,
  extractMetaFromRecords,
  normalizeEntries,
  readRecords,
  readRecordsDetailed,
} from '../../../shared/transcript/runtimes.js';
import { sanitizeEntries } from './sanitize.js';

const execFileAsync = promisify(execFile);

const VALID_RUNTIMES = ['claude-code', 'codex', 'cursor'] as const;
const LOOKBACK_DAYS = 30;
const MARKER_LINE_RE = /EXPORT_SESSION_MARKER\s*=\s*\S+/;
const STRUCTURED_ACTIVITY_FORMAT_VERSION = 1 as const;

interface CliOptions {
  runtime: string;
  match: string | undefined;
  session: string | undefined;
  all: boolean;
  includeActivity: boolean;
  activityOutput: string | undefined;
  cwd: string;
  out: string | undefined;
  help: boolean;
}

interface Candidate {
  runtime: Runtime;
  transcriptPath: string;
  sessionId: string;
  mtime: number;
  size: number;
  nativeSessionId?: string;
  rootSessionId?: string;
  parentSessionId?: string;
  forkedFromSessionId?: string;
  subagentHistoryStartOrdinal?: number;
  identityStatus?: 'native' | 'legacy' | 'invalid';
  filenameSessionId?: string;
}

interface CandidateStat {
  mtime: number;
  size: number;
}

type SelectionResult =
  | { selected: Candidate[]; warnings: string[] }
  | { exit: number; message: string };

interface RenderMarkdownOptions {
  branch: string;
  source: string;
  runtime: Runtime;
  entries: DigestEntry[];
  branchFromGit: boolean;
  session: Candidate;
  activity?: ActivityReport;
  completeActivity?: ActivityReport;
  capturedAt?: string;
  exactNativeSessionId?: string;
  narrativeEvidence?: NarrativeEntryEvidence[];
}

interface NativeNarrativeLocator {
  indexBase: 'zero-based-decoded-record-index' | 'zero-based-jsonl-frame-index';
  index: number;
  physicalLine: number;
}

interface NarrativeEntryEvidence {
  entryKey: string;
  role: DigestEntry['role'];
  kind: DigestEntry['kind'];
  origin: DigestEntry['origin'] | 'unknown';
  displayRole: DigestEntry['displayRole'] | 'unknown';
  sourceLocator: NativeNarrativeLocator;
  consumptionLocator: NativeNarrativeLocator;
}

interface CaptureIdentityEvidence {
  kind:
    | 'claude-record-session-id'
    | 'codex-session-meta-id'
    | 'codex-token-usage-thread-id'
    | 'cursor-native-path';
  locator:
    | {
        physicalLine: number;
        recordIndex: number;
        jsonPointer: string;
      }
    | { canonicalTranscriptPath: string };
}

interface StructuredActivityCapture {
  formatVersion: typeof STRUCTURED_ACTIVITY_FORMAT_VERSION;
  activitySchemaVersion: ActivityReport['activitySchemaVersion'];
  sensitive: 'not-publish-safe';
  runtime: Runtime;
  nativeSessionId: string;
  capturedAt: string;
  identityEvidence: CaptureIdentityEvidence;
  recordCounts: {
    source: number;
    decoded: number;
  };
  narrativeEntries: NarrativeEntryEvidence[];
  activity: ActivityReport;
}

interface DestinationInfo {
  path: string;
  canonicalPath: string;
  inodeKey?: string;
}

const CODEX_ROLLOUT_FILENAME_PATTERN =
  /^rollout-.+-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/iu;

function codexFilenameSessionId(transcriptPath: string): string | undefined {
  return CODEX_ROLLOUT_FILENAME_PATTERN.exec(basename(transcriptPath))?.[1];
}

function codexIdentityFields(meta: TranscriptMeta | null) {
  return {
    ...(meta?.nativeSessionId ? { nativeSessionId: meta.nativeSessionId } : {}),
    ...(meta?.rootSessionId ? { rootSessionId: meta.rootSessionId } : {}),
    ...(meta?.parentSessionId ? { parentSessionId: meta.parentSessionId } : {}),
    ...(meta?.forkedFromSessionId
      ? { forkedFromSessionId: meta.forkedFromSessionId }
      : {}),
    ...(meta?.subagentHistoryStartOrdinal === undefined
      ? {}
      : {
          subagentHistoryStartOrdinal: meta.subagentHistoryStartOrdinal,
        }),
  };
}

function isCodexChild(candidate: Candidate): boolean {
  return (
    candidate.runtime === 'codex' &&
    typeof candidate.nativeSessionId === 'string' &&
    (typeof candidate.parentSessionId === 'string' ||
      (typeof candidate.rootSessionId === 'string' &&
        candidate.rootSessionId !== candidate.nativeSessionId))
  );
}

function inheritedContextWarning(candidate: Candidate): string | null {
  if (!isCodexChild(candidate)) return null;
  const boundary = candidate.subagentHistoryStartOrdinal;
  return boundary === undefined
    ? `Codex child session ${candidate.nativeSessionId} may include inherited parent context; ownership boundary is unknown.`
    : `Codex child session ${candidate.nativeSessionId} includes inherited parent context before ordinal ${boundary}.`;
}

function isRuntime(value: unknown): value is Runtime {
  return (
    typeof value === 'string' &&
    VALID_RUNTIMES.includes(value as (typeof VALID_RUNTIMES)[number])
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorStackOrMessage(error: unknown): string {
  return error instanceof Error
    ? (error.stack ?? error.message)
    : String(error);
}

// ---------------------------------------------------------------------------
// arg parsing
// ---------------------------------------------------------------------------

function parseCliArgs(argv: string[]): CliOptions {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: false,
    options: {
      runtime: { type: 'string', default: 'auto' },
      match: { type: 'string', default: undefined },
      session: { type: 'string', default: undefined },
      all: { type: 'boolean', default: false },
      'include-activity': { type: 'boolean', default: false },
      'activity-output': { type: 'string', default: undefined },
      cwd: { type: 'string', default: process.cwd() },
      out: { type: 'string', default: undefined },
      help: { type: 'boolean', default: false },
    },
  });
  return {
    runtime: typeof values.runtime === 'string' ? values.runtime : 'auto',
    match: typeof values.match === 'string' ? values.match : undefined,
    session: typeof values.session === 'string' ? values.session : undefined,
    all: values.all === true,
    includeActivity: values['include-activity'] === true,
    activityOutput:
      typeof values['activity-output'] === 'string'
        ? values['activity-output']
        : undefined,
    cwd: typeof values.cwd === 'string' ? values.cwd : process.cwd(),
    out:
      typeof values.out === 'string'
        ? values.out
        : (positionals[0] ?? undefined),
    help: values.help === true,
  };
}

const HELP = `session-export-transcript — export the current conversation to sanitized Markdown

Usage:
  node session-export-transcript.mjs [output-path] [flags]

Flags:
  --runtime <claude-code|codex|cursor|auto>  default: auto
  --match <marker>      select the current session by an announced marker
  --session <id>        export a specific session id
  --all                 export every session for the cwd (one file each)
  --include-activity    append bounded source-attributed tool activity
  --activity-output <path>
                        write complete sensitive activity JSON for one exact --session
  --cwd <path>          project dir to match against (default: process.cwd())
  --out <path>          output file or directory (also accepted positionally)
  --help                this message

Exit codes: 0 ok · 1 hard error · 2 no candidates · 3 ambiguous`;

// ---------------------------------------------------------------------------
// runtime resolution
// ---------------------------------------------------------------------------

function resolveRuntime(requested: string | undefined): Runtime | null {
  if (requested && requested !== 'auto') {
    if (!isRuntime(requested)) {
      throw new Error(
        `Unknown runtime: ${requested}. Expected one of ${VALID_RUNTIMES.join(', ')}.`,
      );
    }
    return requested;
  }
  // env hint (SESSION_OBSERVER_SELF-style), then best-effort auto-detect.
  const hint =
    process.env.EXPORT_SESSION_SELF ?? process.env.SESSION_OBSERVER_SELF;
  if (isRuntime(hint)) return hint;
  if (process.env.CLAUDECODE || process.env.CLAUDE_CODE) return 'claude-code';
  if (process.env.CODEX_SANDBOX || process.env.CODEX_HOME) return 'codex';
  if (process.env.CURSOR_TRACE_ID || process.env.CURSOR) return 'cursor';
  return null; // unresolved — caller decides
}

// ---------------------------------------------------------------------------
// candidate enumeration (via synced runtimes primitives)
// ---------------------------------------------------------------------------

async function collectJsonlFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectJsonlFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      results.push(full);
    }
  }
  return results;
}

async function statCandidate(
  transcriptPath: string,
): Promise<CandidateStat | null> {
  try {
    const s = await stat(transcriptPath);
    return { mtime: Math.floor(s.mtime.getTime() / 1000), size: s.size };
  } catch {
    return null;
  }
}

async function enumerateClaudeCode(targetCwd: string): Promise<Candidate[]> {
  const [root] = discoverPaths('claude-code');
  const variants = encodeCwdVariants('claude-code', targetCwd);
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  for (const encoded of variants) {
    const dir = join(root, encoded);
    let files;
    try {
      files = (await readdir(dir)).filter((f) => f.endsWith('.jsonl'));
    } catch {
      continue;
    }
    for (const file of files) {
      const p = join(dir, file);
      if (seen.has(p)) continue;
      seen.add(p);
      const st = await statCandidate(p);
      if (!st) continue;
      let meta;
      try {
        meta = await extractMeta('claude-code', p);
      } catch {
        meta = null;
      }
      candidates.push({
        runtime: 'claude-code',
        transcriptPath: p,
        sessionId: meta?.sessionId ?? basename(p).replace(/\.jsonl$/u, ''),
        ...st,
      });
    }
  }
  return candidates;
}

async function enumerateCodex(
  targetCwd: string,
  { requireCwd = false }: { requireCwd?: boolean } = {},
): Promise<Candidate[]> {
  const [root] = discoverPaths('codex');
  const now = Date.now() / 1000;
  const cutoff = now - LOOKBACK_DAYS * 86400;
  const files = await collectJsonlFiles(root);
  const candidates: Candidate[] = [];
  for (const p of files) {
    const st = await statCandidate(p);
    if (!st) continue;
    if (st.mtime < cutoff) continue;
    let meta;
    try {
      meta = await extractMeta('codex', p);
    } catch {
      meta = null;
    }
    // A resolved recordedCwd that differs from the target is always a non-match.
    if (meta?.recordedCwd && meta.recordedCwd !== targetCwd) continue;
    // When enumerating without an authoritative selector (--all / no-selector),
    // an unresolved (null/empty) recordedCwd cannot be tied to this cwd, so it
    // is excluded. Marker/id selectors are authoritative and keep these.
    if (requireCwd && !meta?.recordedCwd) continue;
    const filenameSessionId = codexFilenameSessionId(p);
    candidates.push({
      runtime: 'codex',
      transcriptPath: p,
      sessionId:
        meta?.sessionId ??
        filenameSessionId ??
        basename(p).replace(/\.jsonl$/u, ''),
      identityStatus: meta
        ? meta.nativeSessionId
          ? 'native'
          : 'legacy'
        : 'invalid',
      ...(filenameSessionId ? { filenameSessionId } : {}),
      ...codexIdentityFields(meta),
      ...st,
    });
  }
  return candidates;
}

async function enumerateCursor(targetCwd: string): Promise<Candidate[]> {
  const [root] = discoverPaths('cursor');
  const variants = encodeCwdVariants('cursor', targetCwd);
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  for (const encoded of variants) {
    const transcriptsRoot = join(root, encoded, 'agent-transcripts');
    let sessionDirs;
    try {
      sessionDirs = await readdir(transcriptsRoot, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const sd of sessionDirs) {
      if (!sd.isDirectory()) continue;
      const sessionPath = join(transcriptsRoot, sd.name);
      let files;
      try {
        files = (await readdir(sessionPath)).filter((f) =>
          f.endsWith('.jsonl'),
        );
      } catch {
        continue;
      }
      for (const file of files) {
        const p = join(sessionPath, file);
        if (seen.has(p)) continue;
        seen.add(p);
        const st = await statCandidate(p);
        if (!st) continue;
        let meta;
        try {
          meta = await extractMeta('cursor', p);
        } catch {
          meta = null;
        }
        candidates.push({
          runtime: 'cursor',
          transcriptPath: p,
          sessionId: meta?.sessionId ?? basename(p).replace(/\.jsonl$/u, ''),
          ...st,
        });
      }
    }
  }
  return candidates;
}

async function enumerateCandidates(
  runtime: Runtime,
  targetCwd: string,
  { requireCwd = false }: { requireCwd?: boolean } = {},
): Promise<Candidate[]> {
  if (runtime === 'claude-code') return enumerateClaudeCode(targetCwd);
  if (runtime === 'codex') return enumerateCodex(targetCwd, { requireCwd });
  if (runtime === 'cursor') return enumerateCursor(targetCwd);
  throw new Error(`Unknown runtime: ${runtime}`);
}

// ---------------------------------------------------------------------------
// session selection
// ---------------------------------------------------------------------------

async function candidateContainsMarker(
  transcriptPath: string,
  marker: string,
): Promise<boolean> {
  try {
    const raw = await readFile(transcriptPath, 'utf8');
    return raw.includes(marker);
  } catch {
    return false;
  }
}

function preferredNewest(candidates: Candidate[]): Candidate | undefined {
  return [...candidates].toSorted(
    (a, b) =>
      Number(isCodexChild(a)) - Number(isCodexChild(b)) || b.mtime - a.mtime,
  )[0];
}

/**
 * Select the target candidate(s) per mode.
 * @returns {{ selected: object[], warnings: string[] } | { exit: number, message: string }}
 */
async function selectSessions(
  opts: CliOptions,
  candidates: Candidate[],
): Promise<SelectionResult> {
  const warnings: string[] = [];

  if (opts.all) {
    for (const candidate of candidates) {
      const warning = inheritedContextWarning(candidate);
      if (warning) warnings.push(warning);
    }
    return { selected: candidates, warnings };
  }

  if (opts.session) {
    const invalid = candidates.filter(
      (candidate) =>
        candidate.identityStatus === 'invalid' &&
        candidate.filenameSessionId === opts.session,
    );
    if (invalid.length > 0) {
      return {
        exit: 1,
        message: `SESSION_IDENTITY_INVALID: recognized rollout source for "${opts.session}" contradicts or lacks a valid native header.`,
      };
    }
    const matches = candidates.filter((c) => c.sessionId === opts.session);
    const canonical = new Map<string, Candidate>();
    for (const candidate of matches) {
      let canonicalPath = candidate.transcriptPath;
      try {
        canonicalPath = await realpath(candidate.transcriptPath);
      } catch {
        // Keep the discovered path if it disappears during selection.
      }
      if (!canonical.has(canonicalPath)) {
        canonical.set(canonicalPath, {
          ...candidate,
          transcriptPath: canonicalPath,
        });
      }
    }
    const distinct = [...canonical.values()];
    if (distinct.length > 1) {
      return {
        exit: 3,
        message:
          `SESSION_IDENTITY_AMBIGUOUS: multiple canonical transcripts claim "${opts.session}".\n` +
          distinct.map((c) => `  - ${c.transcriptPath}`).join('\n'),
      };
    }
    const hit = distinct[0];
    if (!hit) {
      return {
        exit: 2,
        message: `No transcript found for session id "${opts.session}" in this cwd.`,
      };
    }
    const warning = inheritedContextWarning(hit);
    if (warning) warnings.push(warning);
    return { selected: [hit], warnings };
  }

  if (opts.match) {
    const markerMatches: Candidate[] = [];
    for (const candidate of candidates) {
      if (await candidateContainsMarker(candidate.transcriptPath, opts.match)) {
        markerMatches.push(candidate);
      }
    }
    const markerMatch = preferredNewest(markerMatches);
    if (markerMatch) {
      const warning = inheritedContextWarning(markerMatch);
      if (warning) warnings.push(warning);
      return { selected: [markerMatch], warnings };
    }
    // marker miss → newest-for-cwd fallback + warning (not fatal)
    const fallback = preferredNewest(candidates);
    if (!fallback) {
      return {
        exit: 2,
        message: `No transcript found for marker "${opts.match}" in this cwd.`,
      };
    }
    warnings.push(
      `marker "${opts.match}" not found in any candidate; falling back to newest-for-cwd transcript (${fallback.sessionId}). Re-run with --session <id> if this is the wrong session.`,
    );
    const warning = inheritedContextWarning(fallback);
    if (warning) warnings.push(warning);
    return { selected: [fallback], warnings };
  }

  // No selector: only auto-pick if there is exactly one candidate.
  if (candidates.length === 1) {
    const warning = inheritedContextWarning(candidates[0]);
    if (warning) warnings.push(warning);
    return { selected: [candidates[0]], warnings };
  }
  return {
    exit: 3,
    message:
      `Multiple candidate sessions for this cwd and no --match/--session/--all.\n` +
      candidates
        .map((c) => `  - ${c.sessionId} (${c.transcriptPath})`)
        .join('\n') +
      `\nRe-run with --match <marker>, --session <id>, or --all.`,
  };
}

// ---------------------------------------------------------------------------
// git branch / output-path resolution
// ---------------------------------------------------------------------------

async function gitBranch(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', cwd, 'symbolic-ref', '--short', 'HEAD'],
      {
        timeout: 5000,
      },
    );
    const branch = stdout.trim();
    return branch || null;
  } catch {
    return null; // not a git repo or detached HEAD
  }
}

function utcStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function sanitizeBranchForFilename(branch: string): string {
  return branch.replace(/\//g, '-');
}

async function isDirectory(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Resolve the output file path for a single selected session.
 *
 * @param {object} opts
 * @param {string | null} branch
 * @param {object} session selected candidate
 * @param {boolean} multi true when --all (forces per-session naming)
 * @returns {Promise<string>}
 */
async function resolveOutputPath(
  opts: CliOptions,
  branch: string | null,
  session: Candidate,
  multi: boolean,
): Promise<string> {
  const base = branch
    ? sanitizeBranchForFilename(branch)
    : `${basename(opts.cwd)}-${utcStamp()}`;

  const fileName = multi ? `${base}-${session.sessionId}.md` : `${base}.md`;

  if (opts.out) {
    // Directory (existing or trailing slash) → auto-name inside it.
    if (opts.out.endsWith('/') || (await isDirectory(opts.out))) {
      return join(opts.out, fileName);
    }
    // For --all an explicit file path is ambiguous; treat --out as a directory.
    if (multi) return join(opts.out, fileName);
    // Single mode: explicit file path → verbatim.
    return opts.out;
  }

  // Default: ~/Downloads/<name>.md
  return join(homedir(), 'Downloads', fileName);
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

async function canonicalPotentialPath(path: string): Promise<string> {
  let cursor = resolve(path);
  const suffix: string[] = [];
  while (true) {
    try {
      const canonical = await realpath(cursor);
      return join(canonical, ...suffix);
    } catch (error) {
      if (!isErrnoException(error) || error.code !== 'ENOENT') throw error;
      const parent = dirname(cursor);
      if (parent === cursor) throw error;
      suffix.unshift(basename(cursor));
      cursor = parent;
    }
  }
}

async function inspectDestination(
  path: string,
  label: string,
): Promise<DestinationInfo> {
  const canonicalPath = await canonicalPotentialPath(path);
  try {
    const info = await lstat(path);
    if (info.isSymbolicLink()) {
      throw new Error(`${label} must not be a symbolic link: ${path}`);
    }
    if (!info.isFile()) {
      throw new Error(`${label} must be absent or an ordinary file: ${path}`);
    }
    return {
      path,
      canonicalPath,
      inodeKey: `${info.dev}:${info.ino}`,
    };
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return { path, canonicalPath };
    }
    throw error;
  }
}

function pathIsInside(path: string, root: string): boolean {
  const child = relative(root, path);
  return child === '' || (!child.startsWith(`..${sep}`) && child !== '..');
}

function observerStateRoots(): string[] {
  const defaultRoot = join(homedir(), '.local', 'state', 'session-observer');
  return [...new Set([process.env.STATE_DIR ?? defaultRoot, defaultRoot])];
}

async function inodeKeyIfOrdinaryFile(path: string): Promise<string | null> {
  try {
    const info = await lstat(path);
    return info.isFile() && !info.isSymbolicLink()
      ? `${info.dev}:${info.ino}`
      : null;
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function observerStateFileNames(root: string): Promise<string[]> {
  const names = [
    'state.json',
    'state.json.lock',
    'cursor-state-transition.lock',
  ];
  try {
    const entries = await readdir(root);
    for (const entry of entries) {
      if (
        /^state\.json\.\d+\.tmp$/u.test(entry) ||
        /^state\.json\..+\.bak$/u.test(entry)
      ) {
        names.push(entry);
      }
    }
  } catch (error) {
    if (!isErrnoException(error) || error.code !== 'ENOENT') throw error;
  }
  return [...new Set(names)];
}

async function validateStructuredDestinations(
  narrativePath: string,
  activityPath: string,
  transcriptPath: string,
): Promise<void> {
  const [narrative, activity, canonicalSource] = await Promise.all([
    inspectDestination(narrativePath, 'Narrative output'),
    inspectDestination(activityPath, 'Activity output'),
    realpath(transcriptPath),
  ]);
  const sourceInfo = await stat(canonicalSource);
  const sourceInode = `${sourceInfo.dev}:${sourceInfo.ino}`;

  if (
    narrative.canonicalPath === activity.canonicalPath ||
    (narrative.inodeKey !== undefined &&
      narrative.inodeKey === activity.inodeKey)
  ) {
    throw new Error(
      'OUTPUT_COLLISION: narrative and activity outputs must be distinct files',
    );
  }
  for (const destination of [narrative, activity]) {
    if (
      destination.canonicalPath === canonicalSource ||
      destination.inodeKey === sourceInode
    ) {
      throw new Error(
        `OUTPUT_COLLISION: ${destination.path} aliases the source transcript`,
      );
    }
  }

  const canonicalStateRoots = await Promise.all(
    observerStateRoots().map((root) => canonicalPotentialPath(root)),
  );
  for (const destination of [narrative, activity]) {
    if (
      canonicalStateRoots.some((root) =>
        pathIsInside(destination.canonicalPath, root),
      )
    ) {
      throw new Error(
        `OUTPUT_COLLISION: ${destination.path} is inside a Session Observer state root`,
      );
    }
  }

  const rootsWithStateFiles = await Promise.all(
    observerStateRoots().map(async (root) => ({
      root,
      names: await observerStateFileNames(root),
    })),
  );
  const stateInodes = new Set(
    (
      await Promise.all(
        rootsWithStateFiles.flatMap(({ root, names }) =>
          names.map((name) => inodeKeyIfOrdinaryFile(join(root, name))),
        ),
      )
    ).filter((value): value is string => value !== null),
  );
  for (const destination of [narrative, activity]) {
    if (
      destination.inodeKey !== undefined &&
      stateInodes.has(destination.inodeKey)
    ) {
      throw new Error(
        `OUTPUT_COLLISION: ${destination.path} aliases Session Observer state`,
      );
    }
  }
}

async function writeAtomicActivityJson(
  outputPath: string,
  contents: string,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  const temporaryPath = join(
    dirname(outputPath),
    `.${basename(outputPath)}.session-export-${process.pid}-${randomUUID()}.tmp`,
  );
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(temporaryPath, 'wx', 0o600);
    await handle.writeFile(contents, 'utf8');
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, outputPath);
  } catch (error) {
    if (handle) await handle.close().catch(() => undefined);
    await unlink(temporaryPath).catch((cleanupError: unknown) => {
      if (!isErrnoException(cleanupError) || cleanupError.code !== 'ENOENT') {
        throw cleanupError;
      }
    });
    throw error;
  }
}

function stringProperty(record: JsonObject, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function capturedIdentity(
  runtime: Exclude<Runtime, 'cursor'>,
  requestedSessionId: string,
  read: DetailedTranscriptRead,
  transcriptPath: string,
): { nativeSessionId: string; evidence: CaptureIdentityEvidence } {
  const records = read.records.map(({ record }) => record);
  const meta = extractMetaFromRecords(runtime, records, transcriptPath);
  if (meta === null) {
    throw new Error(
      `SESSION_IDENTITY_INVALID: captured ${runtime} records contain contradictory native identity`,
    );
  }

  if (runtime === 'claude-code') {
    const carriers = read.records.flatMap((detailed) => {
      if (!Object.hasOwn(detailed.record, 'sessionId')) return [];
      const value = stringProperty(detailed.record, 'sessionId');
      if (value === undefined) {
        throw new Error(
          'SESSION_IDENTITY_INVALID: captured Claude record has a malformed native sessionId',
        );
      }
      return [{ value, detailed }];
    });
    const identities = new Set(carriers.map(({ value }) => value));
    if (identities.size === 0) {
      throw new Error(
        'SESSION_IDENTITY_MISSING: captured Claude records provide no native sessionId',
      );
    }
    if (identities.size !== 1) {
      throw new Error(
        'SESSION_IDENTITY_INVALID: captured Claude records contradict one another',
      );
    }
    const nativeSessionId = carriers[0].value;
    if (nativeSessionId !== requestedSessionId) {
      throw new Error(
        `SESSION_IDENTITY_MISMATCH: captured Claude identity ${nativeSessionId} does not match requested ${requestedSessionId}`,
      );
    }
    return {
      nativeSessionId,
      evidence: {
        kind: 'claude-record-session-id',
        locator: {
          physicalLine: carriers[0].detailed.physicalLine,
          recordIndex: carriers[0].detailed.recordIndex,
          jsonPointer: '/sessionId',
        },
      },
    };
  }

  const header = read.records.find(
    ({ record }) => record.type === 'session_meta',
  );
  const headerPayload =
    header &&
    typeof header.record.payload === 'object' &&
    header.record.payload !== null &&
    !Array.isArray(header.record.payload)
      ? (header.record.payload as JsonObject)
      : undefined;
  if (header && headerPayload && Object.hasOwn(headerPayload, 'id')) {
    const nativeSessionId = stringProperty(headerPayload, 'id');
    if (
      nativeSessionId === undefined ||
      meta.nativeSessionId !== nativeSessionId
    ) {
      throw new Error(
        'SESSION_IDENTITY_INVALID: captured Codex session_meta identity is malformed or contradictory',
      );
    }
    if (nativeSessionId !== requestedSessionId) {
      throw new Error(
        `SESSION_IDENTITY_MISMATCH: captured Codex identity ${nativeSessionId} does not match requested ${requestedSessionId}`,
      );
    }
    return {
      nativeSessionId,
      evidence: {
        kind: 'codex-session-meta-id',
        locator: {
          physicalLine: header.physicalLine,
          recordIndex: header.recordIndex,
          jsonPointer: '/payload/id',
        },
      },
    };
  }

  const responseUsageCarriers = read.records.flatMap((detailed) => {
    if (detailed.record.type !== 'token_usage_record') return [];
    const payload =
      typeof detailed.record.payload === 'object' &&
      detailed.record.payload !== null &&
      !Array.isArray(detailed.record.payload)
        ? (detailed.record.payload as JsonObject)
        : undefined;
    if (!payload || !Object.hasOwn(payload, 'thread_id')) return [];
    const value = payload.thread_id;
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(
        'SESSION_IDENTITY_INVALID: captured Codex token usage record has malformed native thread identity',
      );
    }
    return [{ value, detailed }];
  });

  const responseUsageIdentities = new Set(
    responseUsageCarriers.map(({ value }) => value),
  );
  if (responseUsageIdentities.size === 0) {
    throw new Error(
      'SESSION_IDENTITY_MISSING: captured Codex records provide no native session identity',
    );
  }
  if (responseUsageIdentities.size !== 1) {
    throw new Error(
      'SESSION_IDENTITY_INVALID: captured Codex records contradict one another',
    );
  }
  const nativeSessionId = responseUsageCarriers[0].value;
  if (nativeSessionId !== requestedSessionId) {
    throw new Error(
      `SESSION_IDENTITY_MISMATCH: captured Codex identity ${nativeSessionId} does not match requested ${requestedSessionId}`,
    );
  }
  return {
    nativeSessionId,
    evidence: {
      kind: 'codex-token-usage-thread-id',
      locator: {
        physicalLine: responseUsageCarriers[0].detailed.physicalLine,
        recordIndex: responseUsageCarriers[0].detailed.recordIndex,
        jsonPointer: '/payload/thread_id',
      },
    },
  };
}

async function cursorCapturedIdentity(
  requestedSessionId: string,
  transcriptPath: string,
): Promise<{ nativeSessionId: string; evidence: CaptureIdentityEvidence }> {
  const canonicalTranscriptPath = await realpath(transcriptPath);
  const transcriptBase = basename(canonicalTranscriptPath).replace(
    /\.jsonl$/u,
    '',
  );
  const directorySessionId = basename(dirname(canonicalTranscriptPath));
  const genericTranscriptName = [
    'transcript',
    'conversation',
    'messages',
  ].includes(transcriptBase);
  const nativeSessionId = genericTranscriptName
    ? directorySessionId
    : transcriptBase;
  if (
    nativeSessionId !== requestedSessionId ||
    (!genericTranscriptName && directorySessionId !== requestedSessionId)
  ) {
    throw new Error(
      `SESSION_IDENTITY_MISMATCH: Cursor native path does not corroborate requested ${requestedSessionId}`,
    );
  }
  return {
    nativeSessionId,
    evidence: {
      kind: 'cursor-native-path',
      locator: { canonicalTranscriptPath },
    },
  };
}

function narrativeEvidence(
  runtime: Runtime,
  entries: readonly DigestEntry[],
  nativeLocators: readonly NativeNarrativeLocator[],
): NarrativeEntryEvidence[] {
  const ordinals = new Map<string, number>();
  return entries.map((entry) => {
    const sourceDenseIndex = entry.sourceRecordIndex ?? entry.recordIndex;
    const sourceLocator = nativeLocators[sourceDenseIndex];
    const consumptionLocator = nativeLocators[entry.recordIndex];
    if (!sourceLocator || !consumptionLocator) {
      throw new Error(
        `NARRATIVE_LOCATOR_INVALID: ${runtime} entry references an uncaptured record`,
      );
    }
    const coordinateKey = `${sourceLocator.index}:${consumptionLocator.index}`;
    const ordinal = (ordinals.get(coordinateKey) ?? 0) + 1;
    ordinals.set(coordinateKey, ordinal);
    return {
      entryKey: `entry-${runtime}-${sourceLocator.index}-${consumptionLocator.index}-${ordinal}`,
      role: entry.role,
      kind: entry.kind,
      origin: entry.origin ?? 'unknown',
      displayRole: entry.displayRole ?? 'unknown',
      sourceLocator,
      consumptionLocator,
    };
  });
}

// ---------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------

const SANITIZE_NOTE =
  'Note: Only visible conversation. Ordinary tool calls, tool outputs, ' +
  'developer/system instructions, environment/AGENTS.md/skill payloads, and ' +
  'subagent notifications are excluded. Ask-user exchanges — the questions ' +
  'put to you and any answers the runtime recorded — are preserved as ' +
  'visible conversation.';

function stripMarkerAndEmpty(entries: readonly DigestEntry[]): DigestEntry[] {
  const out: DigestEntry[] = [];
  for (const entry of entries) {
    let text = entry.text ?? '';
    // Remove any marker line(s) from the message body.
    text = text
      .split(/\r?\n/)
      .filter((line) => !MARKER_LINE_RE.test(line))
      .join('\n')
      .trim();
    if (!text) continue;
    out.push({ ...entry, text });
  }
  return out;
}

function renderMarkdown({
  branch,
  source,
  runtime,
  entries,
  branchFromGit,
  session,
  activity,
  completeActivity,
  capturedAt,
  exactNativeSessionId,
  narrativeEvidence: entryEvidence,
}: RenderMarkdownOptions): string {
  const lines: string[] = [];
  const title = branchFromGit ? branch : `${branch} (no git branch)`;
  lines.push(`# Conversation History: ${title}`);
  lines.push('');
  lines.push(`Exported: ${capturedAt ?? new Date().toISOString()}`);
  lines.push(`Source: ${source}`);
  lines.push(`Runtime: ${runtime}`);
  lines.push(`Session: ${session.sessionId}`);
  const nativeSessionId = exactNativeSessionId ?? session.nativeSessionId;
  if (nativeSessionId) lines.push(`Native session: ${nativeSessionId}`);
  if (session.rootSessionId)
    lines.push(`Root session: ${session.rootSessionId}`);
  if (session.parentSessionId)
    lines.push(`Parent session: ${session.parentSessionId}`);
  if (session.forkedFromSessionId)
    lines.push(`Forked from: ${session.forkedFromSessionId}`);
  const warning = inheritedContextWarning(session);
  if (warning) lines.push(`Warning: ${warning}`);
  lines.push(SANITIZE_NOTE);
  if (activity) {
    lines.push(
      'Activity export: Sensitive activity/debug data is included below as recorded data. Tool inputs, outputs, paths, and identifiers may be present in bounded previews; external output files and child trajectories are not read.',
    );
  }
  if (entryEvidence) {
    lines.push(
      'Structured activity capture: Sensitive, not publish-safe JSON was paired from this exact source snapshot. Narrative provenance below records native coordinates without adding message bodies to the JSON artifact.',
    );
  }
  lines.push('');

  if (entries.length === 0) {
    lines.push('*No visible messages.*');
    lines.push('');
  } else {
    // Group consecutive same-role entries under one header.
    let i = 0;
    while (i < entries.length) {
      const role = entries[i].role;
      const header = role === 'user' ? '## User' : '## Assistant';
      lines.push(header);
      lines.push('');
      while (i < entries.length && entries[i].role === role) {
        const evidence = entryEvidence?.[i];
        if (evidence) {
          lines.push(`<a id="${evidence.entryKey}"></a>`);
          lines.push(
            `Entry: \`${evidence.entryKey}\`; source: ${evidence.sourceLocator.indexBase} ${evidence.sourceLocator.index}, physical line ${evidence.sourceLocator.physicalLine}; consumption: ${evidence.consumptionLocator.indexBase} ${evidence.consumptionLocator.index}, physical line ${evidence.consumptionLocator.physicalLine}; role: ${evidence.role}; display role: ${evidence.displayRole}; origin: ${evidence.origin}`,
          );
          lines.push('');
        }
        lines.push(entries[i].text);
        lines.push('');
        i++;
      }
    }
  }

  if (activity) lines.push(renderActivityMarkdown(activity));
  if (completeActivity) {
    lines.push('## Structured Activity Capture Index', '');
    const invocationKeys = completeActivity.events
      .filter((event) => event.kind === 'call')
      .map((event) => event.eventKey);
    if (invocationKeys.length === 0) {
      lines.push('- No captured invocation keys.', '');
    } else {
      for (const invocationKey of invocationKeys) {
        lines.push(`- Invocation key: ${JSON.stringify(invocationKey)}`);
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

function unavailableActivityReport(
  source: ActivitySource,
  sourceBytes: number,
  capturedAt: string,
  deliveryRange: ActivityDeliveryRange,
): ActivityReport {
  return projectActivity(
    {
      activitySchemaVersion: 1,
      source,
      sourceSnapshot: { capturedAt, sourceBytes },
      events: [],
      coverage: [
        {
          dataClass: 'record-activity',
          status: 'not-read',
          captured: 0,
        },
      ],
      diagnostics: [
        {
          code: 'ACTIVITY_EXTRACTION_ERROR',
          locator: { physicalLine: 1, jsonPointer: '' },
        },
      ],
      correlationCounts: {
        responseStreamCalls: {
          captured: 0,
          counted: 0,
          owned: 0,
          inherited: 0,
          unknown: 0,
        },
        results: { matched: 0, unmatched: 0 },
        itemEvidence: { linked: 0, standalone: 0 },
      },
    },
    {
      mode: 'export',
      renderFormat: 'markdown',
      deliveryRange: {
        ...deliveryRange,
      },
    },
  );
}

// ---------------------------------------------------------------------------
// export one session → write file
// ---------------------------------------------------------------------------

async function exportSession(
  opts: CliOptions,
  runtime: Runtime,
  branch: string | null,
  branchFromGit: boolean,
  session: Candidate,
  multi: boolean,
): Promise<{ narrativePath: string; activityPath?: string }> {
  const outPath = await resolveOutputPath(opts, branch, session, multi);
  const structuredCapture = opts.activityOutput !== undefined;
  if (structuredCapture) {
    await validateStructuredDestinations(
      outPath,
      opts.activityOutput!,
      session.transcriptPath,
    );
  }

  const captureActivity = opts.includeActivity || structuredCapture;
  const cursorCapture =
    captureActivity && runtime === 'cursor'
      ? await (async () => {
          const capturedAt = new Date().toISOString();
          const accumulator = createCursorTurnAccumulator(
            {
              runtime: 'cursor',
              projectCwd: opts.cwd,
              sessionId: session.sessionId,
              canonicalTranscriptPath: session.transcriptPath,
            },
            0,
          );
          const records: Array<{ record: JsonObject; frameIndex: number }> = [];
          const scan = await scanCursorTranscript(session.transcriptPath, {
            onFrame(frame) {
              accumulator.onFrame(frame);
              if (frame.parseState === 'parsed' && frame.record !== null) {
                records.push({
                  record: frame.record,
                  frameIndex: frame.frameIndex,
                });
              }
            },
          });
          return {
            capturedAt,
            scan,
            analysis: accumulator.finish(scan),
            records,
          };
        })()
      : undefined;
  const capturedRead =
    captureActivity && runtime !== 'cursor'
      ? await readRecordsDetailed(session.transcriptPath)
      : undefined;
  const records = cursorCapture
    ? cursorCapture.records.map(({ record }) => record)
    : capturedRead
      ? capturedRead.records.map(({ record }) => record)
      : await readRecords(session.transcriptPath);
  const normalized = normalizeEntries(runtime, records, {});
  const sanitized = sanitizeEntries(normalized, { runtime });
  const entries = stripMarkerAndEmpty(sanitized);
  const nativeLocators: NativeNarrativeLocator[] | undefined = structuredCapture
    ? cursorCapture
      ? cursorCapture.records.map(({ frameIndex }) => ({
          indexBase: 'zero-based-jsonl-frame-index' as const,
          index: frameIndex,
          physicalLine: frameIndex + 1,
        }))
      : capturedRead?.records.map(({ recordIndex, physicalLine }) => ({
          indexBase: 'zero-based-decoded-record-index' as const,
          index: recordIndex,
          physicalLine,
        }))
    : undefined;
  const entryEvidence = nativeLocators
    ? narrativeEvidence(runtime, entries, nativeLocators)
    : undefined;

  let exactIdentity:
    | { nativeSessionId: string; evidence: CaptureIdentityEvidence }
    | undefined;
  if (structuredCapture) {
    if (!opts.session) {
      throw new Error(
        'ACTIVITY_OUTPUT_REQUIRES_EXACT_SESSION: pass exactly one --session <id>',
      );
    }
    exactIdentity =
      runtime === 'cursor'
        ? await cursorCapturedIdentity(opts.session, session.transcriptPath)
        : capturedIdentity(
            runtime,
            opts.session,
            capturedRead!,
            session.transcriptPath,
          );
  }

  let activity: ActivityReport | undefined;
  let completeActivity: ActivityReport | undefined;
  let capturedAt: string | undefined;
  let sourceBytes: number | undefined;
  if (captureActivity && cursorCapture && runtime === 'cursor') {
    const cursorSource: ActivitySource & { runtime: 'cursor' } = {
      runtime: 'cursor',
      sessionId: exactIdentity?.nativeSessionId ?? session.sessionId,
      nativeSessionId: exactIdentity?.nativeSessionId ?? session.sessionId,
      transcriptPath: session.transcriptPath,
    };
    const cursorDeliveryRange: ActivityDeliveryRange = {
      indexBase: 'zero-based-jsonl-frame-index',
      start: 0,
      end: cursorCapture.scan.totalFrames,
    };
    capturedAt = cursorCapture.capturedAt;
    sourceBytes = cursorCapture.scan.file.size;
    try {
      const correlated = correlateActivity(
        extractCursorActivity({
          source: cursorSource,
          scan: cursorCapture.scan,
          analysis: cursorCapture.analysis,
          capturedAt: cursorCapture.capturedAt,
          mode: 'stateless-snapshot',
        }),
      );
      if (opts.includeActivity) {
        activity = projectActivity(correlated, {
          mode: 'export',
          renderFormat: 'markdown',
          deliveryRange: cursorDeliveryRange,
        });
      }
      if (structuredCapture) {
        completeActivity = projectActivity(correlated, {
          mode: 'complete-capture',
          renderFormat: 'compact-json',
          deliveryRange: cursorDeliveryRange,
        });
      }
    } catch (error) {
      if (structuredCapture) {
        throw new Error(
          'ACTIVITY_CAPTURE_FAILED: complete structured activity extraction failed',
          { cause: error },
        );
      }
      if (opts.includeActivity) {
        activity = unavailableActivityReport(
          cursorSource,
          sourceBytes,
          capturedAt,
          cursorDeliveryRange,
        );
      }
    }
  } else if (captureActivity && capturedRead) {
    const identity = extractMetaFromRecords(
      runtime,
      records,
      session.transcriptPath,
    );
    const detailedSource: ActivitySource = {
      runtime,
      sessionId: exactIdentity?.nativeSessionId ?? session.sessionId,
      nativeSessionId:
        exactIdentity?.nativeSessionId ??
        identity?.nativeSessionId ??
        session.nativeSessionId ??
        session.sessionId,
      transcriptPath: session.transcriptPath,
    };
    const detailedDeliveryRange: ActivityDeliveryRange = {
      indexBase: 'zero-based-decoded-record-index',
      start: 0,
      end: records.length,
    };
    capturedAt = capturedRead.capturedAt;
    sourceBytes = capturedRead.sourceBytes;
    try {
      const correlated = correlateActivity(
        extractActivity({ source: detailedSource, read: capturedRead }),
      );
      if (opts.includeActivity) {
        activity = projectActivity(correlated, {
          mode: 'export',
          renderFormat: 'markdown',
          deliveryRange: detailedDeliveryRange,
        });
      }
      if (structuredCapture) {
        completeActivity = projectActivity(correlated, {
          mode: 'complete-capture',
          renderFormat: 'compact-json',
          deliveryRange: detailedDeliveryRange,
        });
      }
    } catch (error) {
      if (structuredCapture) {
        throw new Error(
          'ACTIVITY_CAPTURE_FAILED: complete structured activity extraction failed',
          { cause: error },
        );
      }
      if (opts.includeActivity) {
        activity = unavailableActivityReport(
          detailedSource,
          sourceBytes,
          capturedAt,
          detailedDeliveryRange,
        );
      }
    }
  }

  const md = renderMarkdown({
    branch: branch ?? basename(opts.cwd),
    branchFromGit,
    source: session.transcriptPath,
    runtime,
    session,
    entries,
    activity,
    completeActivity,
    ...(structuredCapture
      ? {
          capturedAt,
          exactNativeSessionId: exactIdentity!.nativeSessionId,
          narrativeEvidence: entryEvidence,
        }
      : {}),
  });

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, md, 'utf8');
  if (structuredCapture) {
    const recordCounts = cursorCapture
      ? {
          source: cursorCapture.scan.totalFrames,
          decoded: cursorCapture.records.length,
        }
      : {
          source:
            (capturedRead?.records.length ?? 0) +
            (capturedRead?.diagnostics.length ?? 0),
          decoded: capturedRead?.records.length ?? 0,
        };
    const envelope: StructuredActivityCapture = {
      formatVersion: STRUCTURED_ACTIVITY_FORMAT_VERSION,
      activitySchemaVersion: completeActivity!.activitySchemaVersion,
      sensitive: 'not-publish-safe',
      runtime,
      nativeSessionId: exactIdentity!.nativeSessionId,
      capturedAt: capturedAt!,
      identityEvidence: exactIdentity!.evidence,
      recordCounts,
      narrativeEntries: entryEvidence!,
      activity: completeActivity!,
    };
    try {
      await writeAtomicActivityJson(
        opts.activityOutput!,
        `${JSON.stringify(envelope, null, 2)}\n`,
      );
    } catch (error) {
      throw new Error(
        `ACTIVITY_OUTPUT_WRITE_FAILED after narrative output was written to ${outPath}: ${errorMessage(error)}`,
        { cause: error },
      );
    }
  }
  return {
    narrativePath: outPath,
    ...(structuredCapture ? { activityPath: opts.activityOutput } : {}),
  };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  const opts = parseCliArgs(process.argv.slice(2));

  if (opts.help) {
    console.log(HELP);
    return 0;
  }

  if (
    opts.activityOutput !== undefined &&
    (!opts.session || opts.all || opts.match !== undefined)
  ) {
    console.error(
      '[session-export-transcript] ACTIVITY_OUTPUT_REQUIRES_EXACT_SESSION: --activity-output requires exactly one --session <id> and cannot be combined with --all or --match.',
    );
    return 1;
  }

  let runtime: Runtime | null;
  try {
    runtime = resolveRuntime(opts.runtime);
  } catch (err) {
    console.error(`[session-export-transcript] ${errorMessage(err)}`);
    return 1;
  }
  if (!runtime) {
    console.error(
      '[session-export-transcript] Could not resolve runtime. Pass --runtime <claude-code|codex|cursor>.',
    );
    return 1;
  }
  // When no authoritative selector (--match/--session) is active, enumeration
  // must be able to tie each candidate to the cwd. In that mode (--all or the
  // no-selector "newest"/single path) a candidate with an unresolved cwd is
  // excluded. With --match/--session the marker/id is authoritative, so a
  // missing cwd meta must not drop the session.
  const requireCwd = !opts.match && !opts.session;

  let candidates: Candidate[];
  try {
    candidates = await enumerateCandidates(runtime, opts.cwd, { requireCwd });
  } catch (err) {
    console.error(`[session-export-transcript] ${errorMessage(err)}`);
    return 1;
  }

  if (candidates.length === 0) {
    const [root] = discoverPaths(runtime);
    console.error(
      `[session-export-transcript] No ${runtime} transcripts found for cwd ${opts.cwd}.\n` +
        `Looked under: ${root}\nTry --cwd <path> or confirm ${runtime} has run in this project.`,
    );
    return 2;
  }

  const selection = await selectSessions(opts, candidates);
  if ('exit' in selection) {
    console.error(`[session-export-transcript] ${selection.message}`);
    return selection.exit;
  }

  const invalidSelected = selection.selected.filter(
    (candidate) => candidate.identityStatus === 'invalid',
  );
  if (invalidSelected.length > 0) {
    console.error(
      '[session-export-transcript] SESSION_IDENTITY_INVALID: selected Codex transcript source contradicts or lacks a valid native header.\n' +
        invalidSelected
          .map((candidate) => `  - ${candidate.transcriptPath}`)
          .join('\n'),
    );
    return 1;
  }

  for (const warning of selection.warnings) {
    console.error(`[session-export-transcript] warning: ${warning}`);
  }

  const branch = await gitBranch(opts.cwd);
  const branchFromGit = branch !== null;
  const multi = opts.all;

  const written: Array<{ narrativePath: string; activityPath?: string }> = [];
  try {
    for (const session of selection.selected) {
      written.push(
        await exportSession(
          opts,
          runtime,
          branch,
          branchFromGit,
          session,
          multi,
        ),
      );
    }
  } catch (err) {
    console.error(
      `[session-export-transcript] Failed to write output: ${errorMessage(err)}`,
    );
    return 1;
  }

  for (const output of written) {
    console.log(`[session-export-transcript] wrote ${output.narrativePath}`);
    if (output.activityPath) {
      console.log(
        `[session-export-transcript] wrote sensitive activity ${output.activityPath}`,
      );
    }
  }
  return 0;
}

main()
  .then((code) => {
    process.exit(code ?? 0);
  })
  .catch((err) => {
    console.error(`[session-export-transcript] ${errorStackOrMessage(err)}`);
    process.exit(1);
  });
