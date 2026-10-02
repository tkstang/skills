/**
 * Content scanner: an optional `rg -l` prefilter plus streaming Node
 * verification.
 *
 * The prefilter only narrows candidate files and must be a provable superset
 * of what the Node scan can match, so results are identical with or without
 * `rg`. Raw JSONL stores `"`, `\`, tab, and newline as two-byte escapes, and
 * real stores also escape `/` as `\/` and HTML-sensitive characters as
 * `\u003c`, `\u003e`, `\u0026`, and `\u0027`. A pattern character or a
 * single-character wildcard can therefore miss raw bytes that Node matches
 * after decoding. The prefilter runs only when every pattern is
 * prefilter-safe: built only from characters no JSON writer used by these
 * stores escapes (ASCII letters, digits, space, `-`, `_`) plus `.*`, `.+`,
 * `|`, and groups (see `isPrefilterSafe`).
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
 * searchable without surfacing injected context. Their record-envelope fields
 * (cwd, branch, ids, timestamps, record types) are blanked first, so only tool
 * content can match.
 */
import { spawnSync } from 'node:child_process';

import { isInheritedRecord } from './adapters/codex.js';
import { OVERSIZE_PREFIX_BYTES, parseJsonObject, readLines } from './jsonl.js';
import { snippetFor } from './matcher.js';
import { MAX_SNIPPETS, precedesInFile } from './rank.js';
import type {
  Hit,
  Matcher,
  MatchResult,
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
 * Characters no JSON writer used by these stores escapes: ASCII letters,
 * digits, space, `-`, and `_`. Writers do escape `"`, `\`, and control
 * characters, and some also escape `/` (`\/`) and HTML-sensitive characters
 * (`\u003c`, `\u003e`, `\u0026`, `\u0027`), so any other character may be
 * stored differently from the decoded text Node matches.
 */
const NEVER_ESCAPED = /^[A-Za-z0-9 _-]$/u;

/**
 * True when `pattern` can be handed to `rg` over raw JSONL without losing a
 * match the decoded Node scan would find.
 *
 * Allowed: literal text made only of never-escaped characters (ASCII letters,
 * digits, space, `-`, `_`), the wildcards `.*` and `.+`, alternation `|`, and
 * groups (`(…)`, `(?:…)`). Every other character (including `/`, `<`, `>`,
 * `&`, `'`, `:`, a lone `.`, character classes, other quantifiers, anchors,
 * lookaround, backslashes, and non-ASCII) makes the pattern unsafe, so the
 * file set is scanned in Node. With `literal`, the text is matched with
 * `--fixed-strings` and only never-escaped characters qualify.
 */
export function isPrefilterSafe(pattern: string, literal: boolean): boolean {
  if (pattern === '') return false;
  if (literal) return [...pattern].every((char) => NEVER_ESCAPED.test(char));
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (NEVER_ESCAPED.test(char)) continue;
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
    if (char === ')' || char === '|') continue;
    return false;
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
  /"type"\s*:\s*"item_completed"[\s\S]*?"item"\s*:\s*\{\s*"type"\s*:\s*"(?:CommandExecution|McpToolCall|Extension|FileChange)"/u;
const RAW_CLAUDE_RESULT = /"type"\s*:\s*"tool_result"/u;
const RAW_ORDINAL = /"ordinal"\s*:\s*(\d+)/u;
/**
 * Record-envelope fields of Claude and Codex tool carriers, with a scalar
 * value. They are blanked anywhere on an oversize line before it is
 * raw-matched, so a pattern that names only a repo path, branch, session id,
 * record type, or timestamp never becomes a tool hit. Values are
 * length-bounded (envelope values are short), which keeps each attempt O(1)
 * and avoids the regex engine's recursion limit on a multi-megabyte string,
 * so the replace stays linear. Escaped keys inside a tool-output string
 * (`\"cwd\"`) are tool content and are kept.
 */
const RAW_ENVELOPE_FIELD =
  /"(?:parentUuid|logicalParentUuid|leafUuid|isSidechain|userType|cwd|sessionId|version|gitBranch|slug|agentId|uuid|timestamp|requestId|promptId|messageId|sourceToolAssistantUUID|sourceToolUseID|toolUseID|tool_use_id|type|role|is_error|isMeta|isApiErrorMessage|entrypoint|permissionMode|ordinal|call_id|thread_id|turn_id|client_authored)"\s*:\s*(?:"(?:[^"\\]|\\[\s\S]){0,1024}"|-?\d[\d.eE+-]{0,64}|true|false|null)/gu;

/**
 * Codex structural fields (item ids, status, source, process id, exit code,
 * timing). Unlike `RAW_ENVELOPE_FIELD` they are common keys inside tool
 * content too (MCP `arguments` and `structuredContent` carry entity `id`s),
 * so they are blanked only as keys of the payload (depth 2) and the item's
 * own top-level header (depth 3), never deeper.
 */
const CODEX_HEADER_KEYS: ReadonlySet<string> = new Set([
  'id',
  'status',
  'source',
  'process_id',
  'exit_code',
  'started_at_ms',
  'completed_at_ms',
  'duration_ms',
  'duration',
  'readOnlyHint',
]);
const CODEX_HEADER_KEY_MAX = 16;
/** The `: value` after a header key: a bounded scalar or `{secs, nanos}`. */
const CODEX_HEADER_VALUE =
  /\s*:\s*(?:"(?:[^"\\]|\\[\s\S]){0,1024}"|-?\d[\d.eE+-]{0,64}|true|false|null|\{\s*"secs"\s*:\s*\d{1,20}\s*,\s*"nanos"\s*:\s*\d{1,20}\s*\})/y;

/** Index of the quote closing the JSON string opened at `start`, or -1. */
function stringEnd(line: string, start: number): number {
  let from = start + 1;
  for (;;) {
    const quote = line.indexOf('"', from);
    if (quote === -1) return -1;
    let slashes = 0;
    while (line.charCodeAt(quote - 1 - slashes) === 0x5c) slashes += 1;
    if (slashes % 2 === 0) return quote;
    from = quote + 1;
  }
}

/**
 * Blank `CODEX_HEADER_KEYS` fields at JSON depth 2 and 3 of a Codex line.
 * One linear pass: strings are skipped with `indexOf`, and only bytes
 * outside strings are inspected for nesting.
 */
function blankCodexHeaders(line: string): string {
  const parts: string[] = [];
  let kept = 0;
  let depth = 0;
  let at = 0;
  while (at < line.length) {
    const code = line.charCodeAt(at);
    if (code === 0x22) {
      const end = stringEnd(line, at);
      if (end === -1) break;
      if (
        (depth === 2 || depth === 3) &&
        end - at - 1 <= CODEX_HEADER_KEY_MAX &&
        CODEX_HEADER_KEYS.has(line.slice(at + 1, end))
      ) {
        CODEX_HEADER_VALUE.lastIndex = end + 1;
        const value = CODEX_HEADER_VALUE.exec(line);
        if (value) {
          parts.push(line.slice(kept, at), ' ');
          at = end + 1 + value[0].length;
          kept = at;
          continue;
        }
      }
      at = end + 1;
      continue;
    }
    if (code === 0x7b || code === 0x5b) depth += 1;
    else if (code === 0x7d || code === 0x5d) depth -= 1;
    at += 1;
  }
  if (parts.length === 0) return line;
  parts.push(line.slice(kept));
  return parts.join('');
}

/**
 * The raw text of an oversize tool-carrier line with its envelope fields
 * blanked (see `RAW_ENVELOPE_FIELD`), plus Codex payload and item header
 * fields (see `CODEX_HEADER_KEYS`), so only tool content can match.
 */
export function rawToolText(line: string): string {
  const prefix = line.slice(0, OVERSIZE_PREFIX_BYTES);
  const codex = RAW_CODEX_OUTPUT.test(prefix) || RAW_CODEX_ITEM.test(prefix);
  return (codex ? blankCodexHeaders(line) : line).replace(
    RAW_ENVELOPE_FIELD,
    ' ',
  );
}

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

/**
 * Stream one transcript and return its verified hits. A hit never keeps its
 * unit, so memory per hit is bounded however large the unit or raw tool line
 * was. It keeps the emitted snippet (built with `snippetFor`, which redacts
 * the full unit first) while ranking could still emit it: within one file,
 * ranking orders hits by role, then timestamp, then scan order
 * (`precedesInFile`), and stops after `MAX_SNIPPETS` distinct snippets. A hit
 * preceded in this file by that many distinct snippets is never reached, so
 * it is kept for scoring only, without text or snippet, and its unit is
 * never redacted.
 */
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
  const withSnippets: Hit[] = [];
  const reachable = (hit: Hit): boolean => {
    const better = new Set<string>();
    for (const prior of withSnippets) {
      if (!precedesInFile(prior, hit)) continue;
      better.add(prior.snippet ?? '');
      if (better.size >= MAX_SNIPPETS) return false;
    }
    return true;
  };
  const keep = (
    hit: Omit<Hit, 'text' | 'snippet'>,
    unitText: string,
    match: MatchResult,
  ) => {
    const kept: Hit = { ...hit, text: '', seq: hits.length };
    if (reachable(kept)) {
      kept.snippet = snippetFor(unitText, matcher, match);
      withSnippets.push(kept);
    }
    hits.push(kept);
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
          // Match tool content only, never the record envelope.
          const text = rawToolText(event.text);
          const match = matcher.match(text);
          if (!match || !accept(match.patterns)) return;
          keep(
            {
              ...base,
              role: 'tool',
              userTyped: false,
              patterns: match.patterns,
              firstIndex: match.firstIndex,
              firstLength: match.firstLength,
              timestampMs: null,
            },
            text,
            match,
          );
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
          keep(
            {
              ...base,
              role: unit.role,
              userTyped:
                unit.role === 'user' &&
                !file.isSubagent &&
                file.agentAuthored !== true,
              patterns: match.patterns,
              firstIndex: match.firstIndex,
              firstLength: match.firstLength,
              timestampMs: timestampOf(parsed),
            },
            unit.text,
            match,
          );
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
