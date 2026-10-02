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
}

/**
 * Narrow `files` to those `rg` reports as containing any pattern. Returns
 * `files: null` with a note when a pattern is not prefilter-safe or `rg`
 * fails; the caller then scans every candidate in Node.
 */
export function prefilterWithRg(
  rgPath: string,
  patterns: readonly string[],
  files: readonly string[],
  { literal }: { literal: boolean },
): PrefilterResult {
  const unsafe = patterns.filter(
    (pattern) => !isPrefilterSafe(pattern, literal),
  );
  if (unsafe.length > 0) {
    return {
      files: null,
      note: `rg prefilter skipped: pattern ${JSON.stringify(unsafe[0])} is not prefilter-safe; scanning all candidates in Node`,
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
  const run = (): string | null => {
    if (chunk.length === 0) return null;
    const result = spawnSync(rgPath, [...base, ...chunk], {
      encoding: 'utf8',
      maxBuffer: RG_MAX_OUTPUT,
      windowsHide: true,
    });
    chunk = [];
    chunkBytes = 0;
    if (result.error) return `rg prefilter failed (${result.error.message})`;
    if (result.status === 1) return null;
    if (result.status !== 0) {
      return `rg prefilter exited with status ${result.status ?? 'signal'}`;
    }
    for (const line of (result.stdout ?? '').split('\n')) {
      if (line !== '') matched.add(line);
    }
    return null;
  };
  for (const file of files) {
    const bytes = Buffer.byteLength(file) + 1;
    if (chunk.length > 0 && chunkBytes + bytes > RG_ARG_CHUNK_BYTES) {
      const failure = run();
      if (failure)
        return {
          files: null,
          note: `${failure}; scanning all candidates in Node`,
        };
    }
    chunk.push(file);
    chunkBytes += bytes;
  }
  const failure = run();
  if (failure)
    return { files: null, note: `${failure}; scanning all candidates in Node` };
  return { files: matched, note: null };
}

const RAW_SKIP_TYPES =
  /"type"\s*:\s*"(?:world_state|session_meta|turn_context|compacted)"/u;
const RAW_CODEX_OUTPUT =
  /"type"\s*:\s*"response_item"[\s\S]*?"payload"\s*:\s*\{\s*"type"\s*:\s*"(?:function_call_output|custom_tool_call_output)"/u;
const RAW_CODEX_ITEM =
  /"type"\s*:\s*"item_completed"[\s\S]*?"item"\s*:\s*\{\s*"type"\s*:\s*"(?:CommandExecution|McpToolCall|FileChange)"/u;
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
  const full = () => hits.length >= options.maxHitsPerSession;

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
          if (!match) return;
          hits.push({
            ...base,
            role: 'tool',
            userTyped: false,
            patterns: match.patterns,
            text: event.text,
            firstIndex: match.firstIndex,
            firstLength: match.firstLength,
            timestampMs: null,
          });
          return !full();
        }
        const record = parseJsonObject(event.text);
        if (!record) {
          stats.parseErrors += 1;
          return;
        }
        if (isInheritedRecord(file, record)) return;
        let units;
        try {
          units = adapter.classifyRecord(record, options.includeTools);
        } catch {
          stats.parseErrors += 1;
          return;
        }
        for (const unit of units) {
          const match = matcher.match(unit.text);
          if (!match) continue;
          hits.push({
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
            timestampMs: timestampOf(record),
          });
          if (full()) return false;
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
  if (options.rg && files.length > 0) {
    const prefilter = prefilterWithRg(
      options.rg,
      matcher.patterns,
      files.map((file) => file.path),
      { literal: matcher.literal },
    );
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
