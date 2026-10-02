/**
 * Content scanner: an optional `rg -l` prefilter plus streaming Node
 * verification.
 *
 * The prefilter only narrows candidate files and must be a provable superset
 * of what the Node scan can match, so results are identical with or without
 * `rg`. Raw JSONL stores `"`, `\`, tab, and newline as two-byte escapes, so a
 * single-character wildcard over raw bytes can miss text that Node matches
 * after decoding. The prefilter therefore runs only when every pattern is
 * prefilter-safe (see `isPrefilterSafe`).
 *
 * The superset argument holds only when Node matches the record's decoded
 * strings once. Deep-tier text breaks that: Codex tool output is often a
 * JSON-encoded string decoded a second time, and Claude tool input is
 * re-serialized, so the raw bytes may hold escapes such as `\/` or `\u003c`
 * that no safe pattern matches. The prefilter is therefore skipped on the deep
 * tier (`includeTools`).
 *
 * Verification streams each file with an LF-only splitter, skips oversize
 * lines before `JSON.parse`, and lets the runtime adapter classify each record
 * into role-tagged units. On the deep tier, oversize lines that are known
 * tool-output carriers are still matched raw, so large tool dumps stay
 * searchable without surfacing injected context.
 */
import { spawnSync } from 'node:child_process';

import { isInheritedRecord } from './adapters/codex.js';
import { parseJsonObject, readLines } from './jsonl.js';
import type {
  Hit,
  Matcher,
  RecordClassifier,
  Runtime,
  SessionFile,
  SourceAdapter,
  Tier,
} from './types.js';

/** Maximum bytes of file arguments passed to one `rg` invocation. */
export const RG_ARG_CHUNK_BYTES = 100 * 1024;
const RG_MAX_OUTPUT = 64 * 1024 * 1024;

/**
 * True when `pattern` can be handed to `rg` over raw JSONL without losing a
 * match the decoded Node scan would find.
 *
 * Allowed: printable ASCII literal text without quotes or backslashes, the
 * wildcards `.*` and `.+`, alternation `|`, and groups (`(…)`, `(?:…)`).
 * Rejected: any backslash, a `.` not followed by `*` or `+`, any character
 * class, other quantifiers (`?`, `{n}`, `*`/`+` after a literal), anchors,
 * lookaround and other `(?` constructs, control and non-ASCII characters.
 * With `literal`, the text is matched with `--fixed-strings` and only
 * printable ASCII without quotes or backslashes qualifies.
 */
export function isPrefilterSafe(pattern: string, literal: boolean): boolean {
  if (pattern === '') return false;
  for (const char of pattern) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 || code > 0x7e || char === '"' || char === '\\') {
      return false;
    }
  }
  if (literal) return true;
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === '.') {
      const next = pattern[i + 1];
      if (next !== '*' && next !== '+') return false;
      i += 1;
      // A trailing lazy `?` or another quantifier changes nothing safe; reject.
      if ('?*+{'.includes(pattern[i + 1] ?? '')) return false;
      continue;
    }
    if (char === '(') {
      if (pattern[i + 1] === '?') {
        if (pattern[i + 2] !== ':') return false;
        i += 2;
      }
      continue;
    }
    if ('[]{}*+?^$'.includes(char)) return false;
  }
  return true;
}

export interface PrefilterResult {
  /** Candidate paths that may match, or `null` to scan everything in Node. */
  files: Set<string> | null;
  note: string | null;
  /** True when the deadline stopped `rg`; no Node fallback should run. */
  timedOut: boolean;
}

/**
 * Narrow `files` to those `rg` reports as containing any pattern. Returns
 * `files: null` with a note when a pattern is not prefilter-safe or `rg`
 * fails; the caller then scans every candidate in Node. Each `rg` call gets
 * the remaining time to `deadline` as its timeout; when the deadline stops it,
 * the result is `timedOut` and the caller must not fall back to Node.
 */
export function prefilterWithRg(
  rgPath: string,
  patterns: readonly string[],
  files: readonly string[],
  { literal, deadline = null }: { literal: boolean; deadline?: number | null },
): PrefilterResult {
  const unsafe = patterns.filter(
    (pattern) => !isPrefilterSafe(pattern, literal),
  );
  if (unsafe.length > 0) {
    return {
      files: null,
      note: `rg prefilter skipped: pattern ${JSON.stringify(unsafe[0])} is not prefilter-safe; scanning all candidates in Node`,
      timedOut: false,
    };
  }
  const base = [
    '--no-config',
    '-l',
    '-i',
    '-a',
    '--no-messages',
    ...(literal ? ['-F'] : []),
    ...patterns.flatMap((pattern) => ['-e', pattern]),
    '--',
  ];
  const matched = new Set<string>();
  let chunk: string[] = [];
  let chunkBytes = 0;
  const TIMED_OUT = 'timed-out';
  const run = (): string | null => {
    if (chunk.length === 0) return null;
    let timeout: number | undefined;
    if (deadline !== null) {
      timeout = deadline - Date.now();
      if (timeout <= 0) return TIMED_OUT;
    }
    const result = spawnSync(rgPath, [...base, ...chunk], {
      encoding: 'utf8',
      maxBuffer: RG_MAX_OUTPUT,
      windowsHide: true,
      ...(timeout === undefined ? {} : { timeout }),
    });
    chunk = [];
    chunkBytes = 0;
    if (result.error) {
      const code = (result.error as NodeJS.ErrnoException).code;
      if (code === 'ETIMEDOUT') return TIMED_OUT;
      return `rg prefilter failed (${result.error.message})`;
    }
    if (result.status === 1) return null;
    if (result.status !== 0) {
      return `rg prefilter exited with status ${result.status ?? 'signal'}`;
    }
    for (const line of (result.stdout ?? '').split('\n')) {
      if (line !== '') matched.add(line);
    }
    return null;
  };
  const failed = (failure: string): PrefilterResult =>
    failure === TIMED_OUT
      ? {
          files: matched,
          note: 'rg prefilter stopped at the deadline; results are incomplete',
          timedOut: true,
        }
      : {
          files: null,
          note: `${failure}; scanning all candidates in Node`,
          timedOut: false,
        };
  for (const file of files) {
    const bytes = Buffer.byteLength(file) + 1;
    if (chunk.length > 0 && chunkBytes + bytes > RG_ARG_CHUNK_BYTES) {
      const failure = run();
      if (failure) return failed(failure);
    }
    chunk.push(file);
    chunkBytes += bytes;
  }
  const failure = run();
  if (failure) return failed(failure);
  return { files: matched, note: null, timedOut: false };
}

const RAW_SKIP_TYPES =
  /"type"\s*:\s*"(?:world_state|session_meta|turn_context|compacted)"/u;
const RAW_CODEX_OUTPUT =
  /"type"\s*:\s*"response_item"[\s\S]*?"payload"\s*:\s*\{\s*"type"\s*:\s*"(?:function_call_output|custom_tool_call_output)"/u;
const RAW_CODEX_ITEM =
  /"type"\s*:\s*"item_completed"[\s\S]*?"item"\s*:\s*\{\s*"type"\s*:\s*"(?:CommandExecution|McpToolCall|CollabAgentToolCall|Extension|FileChange)"/u;
const RAW_CLAUDE_RESULT = /"type"\s*:\s*"tool_result"/u;
const RAW_ORDINAL = /"ordinal"\s*:\s*(\d+)/u;

/**
 * True when an oversize line's prefix identifies a known tool-output carrier.
 * Injected-context records (`world_state`, `session_meta`, `turn_context`,
 * `compacted`) are never raw-matched.
 */
export function isRawToolCarrier(prefix: string): boolean {
  if (RAW_SKIP_TYPES.test(prefix)) return false;
  return (
    RAW_CODEX_OUTPUT.test(prefix) ||
    RAW_CODEX_ITEM.test(prefix) ||
    RAW_CLAUDE_RESULT.test(prefix)
  );
}

export interface ScanOptions {
  maxLineBytes: number;
  includeTools: boolean;
  maxHitsPerSession: number;
  /** Absolute epoch-ms deadline. */
  deadline?: number | null;
}

export interface ScanStats {
  filesScanned: number;
  bytesScanned: number;
  linesSkippedOversize: number;
  parseErrors: number;
  timedOut: boolean;
}

export function emptyScanStats(): ScanStats {
  return {
    filesScanned: 0,
    bytesScanned: 0,
    linesSkippedOversize: 0,
    parseErrors: 0,
    timedOut: false,
  };
}

function timestampOf(record: Record<string, unknown>): number | null {
  const value = record.timestamp;
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Stream one transcript and return its verified hits. */
export async function scanFile(
  file: SessionFile,
  adapter: SourceAdapter,
  matcher: Matcher,
  options: ScanOptions,
): Promise<{ hits: Hit[]; stats: ScanStats }> {
  const tier: Tier = options.includeTools ? 'deep' : 'content';
  // Per-file state (e.g. ask-user call ids) lives in the file classifier.
  const classify: RecordClassifier = adapter.fileClassifier
    ? adapter.fileClassifier()
    : (record, includeTools) => adapter.classifyRecord(record, includeTools);
  const stats = emptyScanStats();
  const hits: Hit[] = [];
  const base = {
    runtime: file.runtime,
    sessionId: file.sessionId,
    tier,
    transcriptPath: file.path,
    cwd: file.cwd ?? null,
    fromSubagent: file.isSubagent,
    parentSessionId: file.parentSessionId,
  };
  // Past the per-file cap, a hit is kept only when it credits a pattern not
  // yet seen in this file; streaming stops once every pattern is credited.
  const seen = new Set<string>();
  const accept = (patterns: readonly string[]): boolean =>
    hits.length < options.maxHitsPerSession ||
    patterns.some((pattern) => !seen.has(pattern));
  const keep = (hit: Hit) => {
    hits.push(hit);
    for (const pattern of hit.patterns) seen.add(pattern);
  };
  const done = () =>
    hits.length >= options.maxHitsPerSession &&
    seen.size >= matcher.patterns.length;

  try {
    const result = await readLines(
      file.path,
      {
        maxLineBytes: options.maxLineBytes,
        keepOversize: options.includeTools ? isRawToolCarrier : undefined,
        deadline: options.deadline ?? null,
      },
      (event) => {
        if (event.kind === 'oversize') {
          stats.linesSkippedOversize += 1;
          if (event.text === null) return;
          const ordinal = RAW_ORDINAL.exec(event.prefix);
          if (
            ordinal &&
            isInheritedRecord(file, { ordinal: Number(ordinal[1]) })
          ) {
            return;
          }
          const match = matcher.match(event.text);
          if (!match || !accept(match.patterns)) return;
          keep({
            ...base,
            role: 'tool',
            userTyped: false,
            patterns: match.patterns,
            text: event.text,
            firstIndex: match.firstIndex,
            firstLength: match.firstLength,
            timestampMs: null,
          });
          return !done();
        }
        const parsed = parseJsonObject(event.text);
        if (!parsed) {
          stats.parseErrors += 1;
          return;
        }
        if (isInheritedRecord(file, parsed)) return;
        let units;
        try {
          units = classify(parsed, options.includeTools);
        } catch {
          stats.parseErrors += 1;
          return;
        }
        for (const unit of units) {
          const match = matcher.match(unit.text);
          if (!match || !accept(match.patterns)) continue;
          keep({
            ...base,
            role: unit.role,
            userTyped:
              unit.role === 'user' &&
              !file.isSubagent &&
              file.agentAuthored !== true,
            patterns: match.patterns,
            text: unit.text,
            firstIndex: match.firstIndex,
            firstLength: match.firstLength,
            timestampMs: timestampOf(parsed),
          });
          if (done()) return false;
        }
      },
    );
    stats.filesScanned = 1;
    stats.bytesScanned = result.bytesRead;
    stats.timedOut = result.timedOut;
  } catch {
    stats.parseErrors += 1;
  }
  return { hits, stats };
}

export interface ScanFilesOptions extends ScanOptions {
  /** Resolved `rg` path, or `null` to scan every candidate in Node. */
  rg: string | null;
}

/** Prefilter (when possible) and verify a candidate set across runtimes. */
export async function scanFiles(
  files: readonly SessionFile[],
  adapterFor: (runtime: Runtime) => SourceAdapter,
  matcher: Matcher,
  options: ScanFilesOptions,
): Promise<{ hits: Hit[]; stats: ScanStats; notes: string[] }> {
  const stats = emptyScanStats();
  const notes: string[] = [];
  const hits: Hit[] = [];
  let candidates = files;
  // Deep-tier text is decoded twice or re-serialized; see the module comment.
  if (options.rg && files.length > 0 && !options.includeTools) {
    const prefilter = prefilterWithRg(
      options.rg,
      matcher.patterns,
      files.map((file) => file.path),
      { literal: matcher.literal, deadline: options.deadline ?? null },
    );
    if (prefilter.timedOut) {
      // Never fall back to a full Node scan past the deadline.
      if (prefilter.note) notes.push(prefilter.note);
      stats.timedOut = true;
      return { hits, stats, notes };
    }
    if (prefilter.files) {
      const keep = prefilter.files;
      candidates = files.filter((file) => keep.has(file.path));
    } else if (prefilter.note) {
      notes.push(prefilter.note);
    }
  }
  for (const file of candidates) {
    if (options.deadline != null && Date.now() >= options.deadline) {
      stats.timedOut = true;
      break;
    }
    const result = await scanFile(
      file,
      adapterFor(file.runtime),
      matcher,
      options,
    );
    hits.push(...result.hits);
    stats.filesScanned += result.stats.filesScanned;
    stats.bytesScanned += result.stats.bytesScanned;
    stats.linesSkippedOversize += result.stats.linesSkippedOversize;
    stats.parseErrors += result.stats.parseErrors;
    if (result.stats.timedOut) {
      stats.timedOut = true;
      break;
    }
  }
  return { hits, stats, notes };
}
