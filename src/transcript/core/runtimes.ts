/**
 * runtimes.mjs — Per-runtime transcript adapters for Claude Code, Codex, and Cursor.
 *
 * This is the only file with structural knowledge of how each runtime's JSONL
 * transcripts are shaped. Logic is ported from Stoa's shipped adapters at:
 *   apps/server/src/client/adapters/claude-code.ts
 *   apps/server/src/client/adapters/codex.ts
 *
 * Exports:
 *   discoverPaths(runtime)                         → string[]
 *   encodeCwd(runtime, cwd)                        → string | null
 *   encodeCwdVariants(runtime, cwd)                → string[]
 *   extractMeta(runtime, transcriptPath)           → Promise<{ sessionId, recordedCwd } | null>
 *   extractMetaFromRecords(runtime, records, path) → { sessionId, recordedCwd } | null
 *   readRecords(transcriptPath)                    → Promise<JsonObject[]>
 *   normalizeEntries(runtime, records, opts)       → DigestEntry[]
 */

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';

export type Runtime = 'claude-code' | 'codex' | 'cursor';
export type JsonObject = Record<string, unknown>;

export interface TranscriptMeta {
  sessionId: string;
  recordedCwd: string | null;
}

export interface CursorIdentityEvidence {
  runtime: 'cursor';
  projectCwd: string;
  sessionId: string;
  canonicalTranscriptPath: string;
}

export type DigestEntryRole = 'user' | 'assistant';
export type DigestEntryDisplayRole = 'queued-user' | 'automatic-control';
export type DigestEntryOrigin =
  | 'human'
  | 'automatic-control'
  | 'runtime-diagnostic';
export type AutomaticControlIndexBase =
  | 'zero-based-jsonl-record-index'
  | 'zero-based-jsonl-frame-index';
export type CursorTerminalStatus =
  | 'success'
  | 'aborted'
  | 'error'
  | 'cancelled';
export type DigestEntryKind =
  | 'message'
  | 'tool_call'
  | 'tool_result'
  | 'command_message'
  | 'ask_user';

export interface AutomaticControlProvenance {
  automatic: true;
  schemaVersion: 1 | 2;
  runtime: string;
  leaseId: string;
  pinnedPeer: JsonObject | string;
  indexBase: AutomaticControlIndexBase;
  range: {
    fromIndex: number;
    toIndex: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface DigestEntry {
  role: DigestEntryRole;
  text: string;
  /** Zero-based record index at which this entry becomes consumable. */
  recordIndex: number;
  /** Exact source record when consumption is gated by a later terminal record. */
  sourceRecordIndex?: number;
  kind: DigestEntryKind;
  displayRole?: DigestEntryDisplayRole;
  origin?: DigestEntryOrigin;
  automaticControl?: AutomaticControlProvenance;
  toolName?: string;
}

export interface NormalizeEntriesOptions {
  includeToolCalls?: boolean;
  includeToolResults?: boolean;
  includeCommandMessages?: boolean;
}

interface ClaudeContentOptions {
  includeToolCalls: boolean;
  includeToolResults: boolean;
  includeCommandMessages: boolean;
  toolNameById: Map<string, string>;
  /**
   * Claude records the structured answer payload on the record, not on the
   * tool_result block. Threaded through so the ask-user branch can read it.
   */
  toolUseResult?: unknown;
}

/** One question as asked by a runtime's ask-user tool. */
interface AskUserQuestion {
  /** Short chip/label, when the runtime records one. */
  header?: string;
  prompt: string;
  options: { label: string; description?: string }[];
}

type SafeParseResult =
  | { ok: true; value: JsonObject }
  | { ok: false; reason: string };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOOL_INPUT_LIMIT = 200;
const TOOL_RESULT_LIMIT = 500;
// Ask-user content renders by default, so it needs its own headroom: a
// question plus its option labels routinely exceeds the tool-call limit.
const ASK_USER_PROMPT_LIMIT = 500;
const ASK_USER_OPTION_LIMIT = 120;
const ASK_USER_DESCRIPTION_LIMIT = 300;
const ASK_USER_ANSWER_LIMIT = 500;
/**
 * Per-runtime name of the tool that puts a question to the human operator.
 * These are the only tool calls whose payload is human decision content rather
 * than tool mechanics, so the digest keeps them even when tools are filtered.
 */
const ASK_USER_TOOL_NAMES: Record<Runtime, string> = {
  'claude-code': 'AskUserQuestion',
  codex: 'request_user_input',
  cursor: 'AskQuestion',
};
const COMMAND_MESSAGE_RE =
  /<(command-message|command-name|command-args)>[\s\S]*?<\/\1>/u;
const NO_OP_PREFIX = /^\s*\[no-op\](?:\s|$)/iu;
const AUTOMATIC_ACKNOWLEDGMENT =
  /^\s*(?:ack(?:nowledged)?|got it|understood|noted|received|ok(?:ay)?|thanks|thank you)[.!]*\s*$/iu;
const AUTOMATIC_STATUS_ECHO =
  /^\s*(?:status:\s*)?(?:(?:still\s+)?(?:waiting|holding|idle|armed|monitoring)(?:\s+(?:for|on|until)\s+[^.!?;:]+)?|no (?:new )?(?:input|updates?|messages?|changes?))[.!]*\s*$/iu;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when value is a non-null, non-array plain object.
 * @param {unknown} value
 * @returns {boolean}
 */
function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Returns value if it is a string, otherwise undefined.
 * @param {unknown} value
 * @returns {string | undefined}
 */
function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function automaticControlVersion(
  schemaVersion: unknown,
  indexBase: unknown,
): Pick<AutomaticControlProvenance, 'schemaVersion' | 'indexBase'> | null {
  if (schemaVersion === undefined && indexBase === undefined) {
    return {
      schemaVersion: 1,
      indexBase: 'zero-based-jsonl-record-index',
    };
  }
  if (
    schemaVersion === 2 &&
    (indexBase === 'zero-based-jsonl-record-index' ||
      indexBase === 'zero-based-jsonl-frame-index')
  ) {
    return { schemaVersion, indexBase };
  }
  return null;
}

function parseAutomaticControlJsonEnvelope(
  text: string,
): AutomaticControlProvenance | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(parsed) || !isObject(parsed.session_observer_wake)) return null;

  const wake = parsed.session_observer_wake;
  const version = automaticControlVersion(wake.schemaVersion, wake.indexBase);
  const range = wake.range;
  if (
    version === null ||
    wake.automatic !== true ||
    !asString(wake.runtime) ||
    !asString(wake.leaseId) ||
    (!isObject(wake.pinnedPeer) && !asString(wake.pinnedPeer)) ||
    !isObject(range) ||
    !Number.isInteger(range.fromIndex) ||
    !Number.isInteger(range.toIndex) ||
    (range.fromIndex as number) < 0 ||
    (range.toIndex as number) < (range.fromIndex as number)
  ) {
    return null;
  }

  return {
    ...wake,
    automatic: true,
    schemaVersion: version.schemaVersion,
    runtime: wake.runtime as string,
    leaseId: wake.leaseId as string,
    pinnedPeer: wake.pinnedPeer as JsonObject | string,
    indexBase: version.indexBase,
    range: range as AutomaticControlProvenance['range'],
  };
}

function decodeXmlAttribute(value: string): string | null {
  if (/[<>]|&(?!amp;|quot;|lt;|gt;|apos;)/u.test(value)) return null;
  return value.replace(
    /&(amp|quot|lt|gt|apos);/gu,
    (_match, entity: string) => {
      if (entity === 'amp') return '&';
      if (entity === 'quot') return '"';
      if (entity === 'lt') return '<';
      if (entity === 'gt') return '>';
      return "'";
    },
  );
}

function parseXmlAttributes(source: string): Map<string, string> | null {
  const attributes = new Map<string, string>();
  const pattern = /([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*"([^"]*)"/gu;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    if (source.slice(cursor, match.index).trim()) return null;
    const [, name, encodedValue] = match;
    const value = decodeXmlAttribute(encodedValue);
    if (value === null || attributes.has(name)) return null;
    attributes.set(name, value);
    cursor = pattern.lastIndex;
  }

  if (source.slice(cursor).trim() || attributes.size === 0) return null;
  return attributes;
}

function parseAutomaticControlXmlEnvelope(
  text: string,
): AutomaticControlProvenance | null {
  const match =
    /^\s*<session_observer_wake\b([^<>]*)>([\s\S]*?)<\/session_observer_wake>\s*$/u.exec(
      text,
    );
  if (!match) return null;

  const attributes = parseXmlAttributes(match[1]);
  if (!attributes || attributes.get('automatic') !== 'true') return null;

  const schemaVersionAttribute = attributes.get('schema_version');
  const version = automaticControlVersion(
    schemaVersionAttribute === undefined
      ? undefined
      : schemaVersionAttribute === '2'
        ? 2
        : null,
    attributes.get('index_base'),
  );
  const runtime = attributes.get('runtime');
  const leaseId = attributes.get('lease_id');
  const pinnedPeer = attributes.get('peer');
  const records = attributes.get('records');
  const rangeMatch = /^(\d+)-(\d+)$/u.exec(records ?? '');
  if (
    version === null ||
    !runtime?.trim() ||
    !leaseId?.trim() ||
    !pinnedPeer?.trim() ||
    !rangeMatch
  )
    return null;

  const fromIndex = Number(rangeMatch[1]);
  const toIndex = Number(rangeMatch[2]);
  if (
    !Number.isSafeInteger(fromIndex) ||
    !Number.isSafeInteger(toIndex) ||
    toIndex < fromIndex
  ) {
    return null;
  }

  return {
    automatic: true,
    schemaVersion: version.schemaVersion,
    runtime,
    leaseId,
    pinnedPeer,
    indexBase: version.indexBase,
    range: { fromIndex, toIndex },
    wireFormat: 'xml',
    body: match[2].trim(),
  };
}

export function parseAutomaticControlEnvelope(
  text: string,
): AutomaticControlProvenance | null {
  return (
    parseAutomaticControlXmlEnvelope(text) ??
    parseAutomaticControlJsonEnvelope(text)
  );
}

export function isNoOpText(text: string): boolean {
  return NO_OP_PREFIX.test(text);
}

export function isAutomaticControlAcknowledgement(text: string): boolean {
  return (
    AUTOMATIC_ACKNOWLEDGMENT.test(text) || AUTOMATIC_STATUS_ECHO.test(text)
  );
}

function messageEntry(
  role: DigestEntryRole,
  text: string,
  recordIndex: number,
  displayRole?: DigestEntryDisplayRole,
): DigestEntry {
  if (role === 'user') {
    const automaticControl = parseAutomaticControlEnvelope(text);
    if (automaticControl) {
      return {
        role,
        text,
        recordIndex,
        kind: 'message',
        displayRole: 'automatic-control',
        origin: 'automatic-control',
        automaticControl,
      };
    }
  }
  return {
    role,
    text,
    recordIndex,
    kind: 'message',
    ...(displayRole ? { displayRole } : {}),
  };
}

/**
 * Truncates a string to `limit` chars, appending '...' when truncated.
 * @param {string} str
 * @param {number} limit
 * @returns {string}
 */
function truncate(str: string, limit: number): string {
  if (str.length <= limit) return str;
  return str.slice(0, limit) + '...';
}

/**
 * Claude Code records slash-command payloads as user-visible XML-ish text.
 * Those payloads can include full skill bodies and usually drown out the
 * natural-language conversation, so the digest excludes them by default.
 *
 * @param {string} text
 * @returns {boolean}
 */
function isClaudeCommandMessageText(text: string): boolean {
  return COMMAND_MESSAGE_RE.test(text);
}

/**
 * Stringify a tool/function argument value and truncate to limit.
 * @param {unknown} value
 * @param {number} limit
 * @returns {string}
 */
function stringifyArgs(value: unknown, limit: number): string {
  if (typeof value === 'string') return truncate(value, limit);
  return truncate(JSON.stringify(value ?? {}) ?? '{}', limit);
}

// ---------------------------------------------------------------------------
// Ask-user helpers
//
// Every runtime routes operator questions through a tool call, so the default
// tool filters would drop both the question and the human's answer. These
// helpers render that exchange as conversation instead: option labels always,
// option descriptions only when tool detail is requested.
// ---------------------------------------------------------------------------

/** Short prompt restatement used to label an answer line. */
const ASK_USER_ANSWER_PROMPT_LIMIT = 200;

/**
 * Parse one runtime's recorded question list into the shared shape.
 * Accepts Claude's `{ question, header, options: [{ label, description }] }`,
 * Codex's `{ question, header, options: [{ label, description }] }`, and
 * Cursor's `{ prompt, options: [{ label }] }`.
 */
function parseAskUserQuestions(value: unknown): AskUserQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): AskUserQuestion[] => {
    if (!isObject(raw)) return [];
    const prompt = asString(raw.question) ?? asString(raw.prompt);
    if (!prompt) return [];
    const header = asString(raw.header) ?? asString(raw.title);
    const options = Array.isArray(raw.options)
      ? raw.options.flatMap((option): AskUserQuestion['options'] => {
          if (typeof option === 'string') return [{ label: option }];
          if (!isObject(option)) return [];
          const label = asString(option.label) ?? asString(option.id);
          if (!label) return [];
          const description = asString(option.description);
          return [{ label, ...(description ? { description } : {}) }];
        })
      : [];
    return [{ ...(header ? { header } : {}), prompt, options }];
  });
}

/**
 * Render the assistant side of an ask-user exchange: the questions put to the
 * operator and the options offered.
 */
function formatAskUserQuestions(
  toolName: string,
  questions: AskUserQuestion[],
  opts: { includeDescriptions: boolean; notes?: string[]; title?: string },
): string {
  const numbered = questions.length > 1;
  const lines: string[] = [];

  const questionHead = (question: AskUserQuestion): string => {
    // A single question absorbs the call-level title as its header; with
    // several, the title labels the group instead.
    const header = question.header ?? (numbered ? undefined : opts.title);
    const head = header ? `${header} — ${question.prompt}` : question.prompt;
    return truncate(head, ASK_USER_PROMPT_LIMIT);
  };

  if (numbered) {
    const title = opts.title ? `${opts.title} — ` : '';
    lines.push(`[${toolName}] ${title}${questions.length} questions:`);
  }

  questions.forEach((question, index) => {
    const head = questionHead(question);
    lines.push(numbered ? `${index + 1}. ${head}` : `[${toolName}] ${head}`);
    if (question.options.length === 0) return;
    if (opts.includeDescriptions) {
      for (const option of question.options) {
        const description = option.description
          ? ` — ${truncate(option.description, ASK_USER_DESCRIPTION_LIMIT)}`
          : '';
        lines.push(
          `   - ${truncate(option.label, ASK_USER_OPTION_LIMIT)}${description}`,
        );
      }
    } else {
      const labels = question.options
        .map((option) => truncate(option.label, ASK_USER_OPTION_LIMIT))
        .join(' | ');
      lines.push(`   options: ${labels}`);
    }
  });

  for (const note of opts.notes ?? []) lines.push(`   (${note})`);

  return lines.join('\n');
}

/**
 * Render the human side of an ask-user exchange. `note` carries operator-authored
 * annotations when the runtime records them.
 */
function formatAskUserAnswers(
  toolName: string,
  answers: { label: string; answer: string; note?: string }[],
): string {
  const numbered = answers.length > 1;
  const lines: string[] = [];

  if (numbered) {
    lines.push(`[${toolName} → answered]`);
  }

  answers.forEach(({ label, answer, note }, index) => {
    const body = `${truncate(label, ASK_USER_ANSWER_PROMPT_LIMIT)}: "${truncate(
      answer,
      ASK_USER_ANSWER_LIMIT,
    )}"`;
    lines.push(
      numbered ? `${index + 1}. ${body}` : `[${toolName} → answered] ${body}`,
    );
    if (note) {
      lines.push(`   note: ${truncate(note, ASK_USER_ANSWER_LIMIT)}`);
    }
  });

  return lines.join('\n');
}

/**
 * Normalize a recorded answer value to display text. Runtimes record either a
 * plain string (Claude single-select and free text), an array of labels
 * (multi-select), or Codex's `{ answers: [label] }` wrapper.
 */
function askUserAnswerText(value: unknown): string | undefined {
  if (typeof value === 'string') return value || undefined;
  if (Array.isArray(value)) {
    const labels = value.map(asString).filter((label) => Boolean(label));
    return labels.length > 0 ? labels.join(', ') : undefined;
  }
  if (isObject(value)) return askUserAnswerText(value.answers);
  return undefined;
}

/**
 * Attempt to JSON.parse a single line.
 * Returns { ok: true, value } or { ok: false, reason }.
 * @param {string} line
 * @returns {{ ok: boolean, value?: object, reason?: unknown }}
 */
function safeParseLine(line: string): SafeParseResult {
  try {
    const parsed = JSON.parse(line);
    if (!isObject(parsed)) return { ok: false, reason: 'not a JSON object' };
    return { ok: true, value: parsed };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// discoverPaths
// ---------------------------------------------------------------------------

/**
 * Returns the discovery root directories for the given runtime.
 *
 * @param {'claude-code' | 'codex' | 'cursor'} runtime
 * @returns {string[]}
 */
export function discoverPaths(runtime: Runtime): string[] {
  const home = homedir();
  if (runtime === 'claude-code') {
    return [join(home, '.claude', 'projects')];
  }
  if (runtime === 'codex') {
    return [join(home, '.codex', 'sessions')];
  }
  if (runtime === 'cursor') {
    return [join(home, '.cursor', 'projects')];
  }
  throw new Error(`Unknown runtime: ${runtime}`);
}

// ---------------------------------------------------------------------------
// encodeCwd
// ---------------------------------------------------------------------------

/**
 * Encode a cwd path for Claude Code's directory-name scheme.
 * Current Claude Code project dirs replace both '/' and '.' with '-'. For
 * example, '/Users/thomas.stang/.superconductor' becomes
 * '-Users-thomas-stang--superconductor'. Codex has no path encoding.
 * Cursor uses slash/dot-separated non-empty path segments joined by '-'.
 *
 * @param {'claude-code' | 'codex' | 'cursor'} runtime
 * @param {string} cwd
 * @returns {string | null}
 */
export function encodeCwd(runtime: Runtime, cwd: string): string | null {
  if (runtime === 'codex') return null;
  return encodeCwdVariants(runtime, cwd)[0];
}

/**
 * Return all known cwd slug variants for a runtime, ordered by preference.
 * Claude Code has used at least two observable schemes: the current scheme
 * sanitizes '/' and '.', while older docs/tests assumed slash-only encoding.
 *
 * @param {'claude-code' | 'codex' | 'cursor'} runtime
 * @param {string} cwd
 * @returns {string[]}
 */
export function encodeCwdVariants(runtime: Runtime, cwd: string): string[] {
  if (runtime === 'codex') return [];
  if (runtime === 'cursor') {
    return [cwd.split(/[/.]/u).filter(Boolean).join('-')];
  }
  const variants = [cwd.replace(/[/.]/g, '-'), cwd.replace(/\//g, '-')];
  return [...new Set(variants)];
}

// ---------------------------------------------------------------------------
// readRecords
// ---------------------------------------------------------------------------

/**
 * Read a JSONL transcript file tolerantly:
 * - Blank/whitespace-only lines are silently dropped.
 * - A line that is invalid JSON emits a console.warn and is skipped.
 * - The last line is checked: if it is non-empty but fails to parse AND the
 *   file did not end with a newline (i.e., it is a partial write), it is
 *   dropped with a warning.
 *
 * @param {string} transcriptPath
 * @returns {Promise<object[]>}
 */
export async function readRecords(
  transcriptPath: string,
): Promise<JsonObject[]> {
  const raw = await readFile(transcriptPath, 'utf8');
  if (!raw) return [];

  const lines = raw.split(/\r?\n/);
  const records = [];

  // Detect whether the file ends with a newline.
  // If the last character is a newline, the final split token is an empty string
  // and that token represents the trailing newline (not a partial line).
  // If the last character is NOT a newline, the last token is potentially partial.
  const fileEndsWithNewline = raw.endsWith('\n') || raw.endsWith('\r\n');
  const lastIndex = lines.length - 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip blank lines silently
    if (!line) continue;

    const result = safeParseLine(line);

    if (result.ok) {
      records.push(result.value);
      continue;
    }

    // Parse failed — is this the last non-empty line of a file that doesn't end in \n?
    const isLastToken = i === lastIndex;
    if (isLastToken && !fileEndsWithNewline) {
      console.warn(
        `[runtimes] Partial trailing line dropped from ${transcriptPath} (line ${i + 1}): ${result.reason}`,
      );
    } else {
      console.warn(
        `[runtimes] Malformed JSONL line ${i + 1} in ${transcriptPath} skipped: ${result.reason}`,
      );
    }
  }

  return records;
}

// ---------------------------------------------------------------------------
// extractMeta — Claude Code helpers
// ---------------------------------------------------------------------------

/**
 * Extract the session ID from a Claude Code record.
 * Checks multiple placement variants used in the wild.
 *
 * @param {object} record
 * @returns {string | undefined}
 */
function claudeSessionIdFromRecord(record: JsonObject): string | undefined {
  const message = isObject(record.message) ? record.message : record;
  return (
    asString(record.sessionId) ??
    asString(record.session_id) ??
    asString(record.sessionID) ??
    asString(message.sessionId) ??
    asString(message.session_id)
  );
}

/**
 * Decode a Claude Code encoded directory name back to a cwd path.
 *
 * This is weak/display-only evidence. Claude project dir slugs are not
 * reversible because '-' can represent a slash, a dot, or a literal hyphen in
 * the original path. Direct lookup must set recordedCwd from the requested cwd;
 * fallback ranking should prefer slug evidence over this lossy decode.
 *
 * @param {string} dirName
 * @returns {string | null}
 */
function decodeCwdDirName(dirName: string): string | null {
  if (!dirName.startsWith('-')) return null;
  // Replace all '-' with '/' to get back the path
  return dirName.replace(/-/g, '/');
}

// ---------------------------------------------------------------------------
// extractMeta — Codex helpers
// ---------------------------------------------------------------------------

/**
 * Extract the session ID from a Codex record (payload or top-level).
 *
 * We check `record.sessionId` / `record.session_id` first (the top-level
 * session identifier present on every record in a session), then fall back
 * to `payload.sessionId` / `payload.session_id` (present on session-meta
 * payload objects). We intentionally skip `payload.id` because in Codex
 * message records that field holds a per-message ID (e.g. "msg-001"), not
 * the session ID.
 *
 * @param {object} record
 * @returns {string | undefined}
 */
function codexSessionIdFromRecord(record: JsonObject): string | undefined {
  const payload = isObject(record.payload) ? record.payload : record;
  return (
    asString(record.sessionId) ??
    asString(record.session_id) ??
    asString(payload.sessionId) ??
    asString(payload.session_id)
  );
}

// ---------------------------------------------------------------------------
// extractMeta
// ---------------------------------------------------------------------------

/**
 * Extract (sessionId, recordedCwd) metadata from a transcript file.
 *
 * Claude Code:
 *   - sessionId: first record with a sessionId field.
 *   - recordedCwd: decoded from the parent directory name.
 *
 * Codex:
 *   - sessionId: from `payload.id` / `sessionId` on any record.
 *   - recordedCwd: from a session_started record's `cwd` field.
 *
 * Cursor:
 *   - sessionId: from the transcript basename, or parent directory when the
 *     basename is a generic transcript filename.
 *   - recordedCwd: null; Cursor project slugs are not reversible.
 *
 * Falls back to basename (without .jsonl) for sessionId when no record has one.
 *
 * @param {'claude-code' | 'codex' | 'cursor'} runtime
 * @param {string} transcriptPath
 * @returns {Promise<{ sessionId: string, recordedCwd: string | null } | null>}
 */
export async function extractMeta(
  runtime: Runtime,
  transcriptPath: string,
): Promise<TranscriptMeta | null> {
  const records = await readRecords(transcriptPath);
  return extractMetaFromRecords(runtime, records, transcriptPath);
}

/**
 * Same extraction as `extractMeta`, but synchronous over an already-parsed
 * record array instead of reading the file. Split out so callers that also
 * need other record-derived data (e.g. session-observer's discovery, which
 * additionally classifies engagement) can read a transcript once and derive
 * both from the same parse, instead of each caller independently re-reading
 * and re-parsing the file.
 *
 * @param {'claude-code' | 'codex' | 'cursor'} runtime
 * @param {object[]} records
 * @param {string} transcriptPath
 * @returns {{ sessionId: string, recordedCwd: string | null } | null}
 */
export function extractMetaFromRecords(
  runtime: Runtime,
  records: JsonObject[],
  transcriptPath: string,
): TranscriptMeta | null {
  if (runtime === 'claude-code') {
    let sessionId: string | undefined;
    for (const record of records) {
      const id = claudeSessionIdFromRecord(record);
      if (id) {
        sessionId = id;
        break;
      }
    }
    if (!sessionId) {
      sessionId = basename(transcriptPath).replace(/\.jsonl$/u, '');
    }

    // Decode cwd from the parent directory name
    const parentDirName = basename(dirname(transcriptPath));
    const recordedCwd = decodeCwdDirName(parentDirName);

    return { sessionId, recordedCwd };
  }

  if (runtime === 'codex') {
    let sessionId: string | undefined;
    let recordedCwd: string | null = null;

    for (const record of records) {
      if (!sessionId) {
        const id = codexSessionIdFromRecord(record);
        if (id) sessionId = id;
      }
      if (recordedCwd === null) {
        // Check top-level cwd first, then fall back to payload.cwd
        // (current Codex session_meta records store cwd under payload.cwd)
        const topLevelCwd = asString(record.cwd);
        const payloadCwd = isObject(record.payload)
          ? asString(record.payload.cwd)
          : undefined;
        const cwd = topLevelCwd ?? payloadCwd;
        if (cwd) recordedCwd = cwd;
      }
      if (sessionId && recordedCwd !== null) break;
    }

    if (!sessionId) {
      sessionId = basename(transcriptPath).replace(/\.jsonl$/u, '');
    }

    return { sessionId, recordedCwd };
  }

  if (runtime === 'cursor') {
    const transcriptBase = basename(transcriptPath).replace(/\.jsonl$/u, '');
    const parentDirName = basename(dirname(transcriptPath));
    const sessionId =
      transcriptBase &&
      !['transcript', 'conversation', 'messages'].includes(transcriptBase)
        ? transcriptBase
        : parentDirName;

    return { sessionId, recordedCwd: null };
  }

  throw new Error(`Unknown runtime: ${runtime}`);
}

// ---------------------------------------------------------------------------
// normalizeEntries — Claude Code adapter
// ---------------------------------------------------------------------------

/**
 * Build the ask_user entry for a Claude `AskUserQuestion` tool_use block.
 * Returns null when the block carries no parseable questions, so the caller can
 * fall back to ordinary tool_call handling.
 */
function claudeAskUserQuestionEntry(
  role: DigestEntryRole,
  block: JsonObject,
  recordIndex: number,
  opts: ClaudeContentOptions,
): DigestEntry | null {
  const input = isObject(block.input) ? block.input : {};
  const questions = parseAskUserQuestions(input.questions);
  if (questions.length === 0) return null;
  return {
    role,
    text: formatAskUserQuestions(
      ASK_USER_TOOL_NAMES['claude-code'],
      questions,
      { includeDescriptions: opts.includeToolCalls },
    ),
    recordIndex,
    kind: 'ask_user',
    toolName: ASK_USER_TOOL_NAMES['claude-code'],
  };
}

/**
 * Build the ask_user entry for a Claude `AskUserQuestion` tool_result block.
 *
 * The structured answers live on the record's `toolUseResult`, keyed by the
 * full question text, with operator annotations alongside. When that payload is
 * absent the block's own prose summary already names each question and answer,
 * so it is used verbatim rather than dropping the operator's decision.
 */
function claudeAskUserAnswerEntry(
  role: DigestEntryRole,
  block: JsonObject,
  recordIndex: number,
  opts: ClaudeContentOptions,
): DigestEntry | null {
  const toolName = ASK_USER_TOOL_NAMES['claude-code'];
  const result = isObject(opts.toolUseResult) ? opts.toolUseResult : null;
  const rawAnswers = result && isObject(result.answers) ? result.answers : null;

  if (result && rawAnswers) {
    // Prefer the short header over restating the whole question.
    const headerByPrompt = new Map<string, string>();
    for (const question of parseAskUserQuestions(result.questions)) {
      if (question.header) headerByPrompt.set(question.prompt, question.header);
    }
    const annotations = isObject(result.annotations) ? result.annotations : {};

    const answers = Object.entries(rawAnswers).flatMap(([prompt, value]) => {
      const answer = askUserAnswerText(value);
      if (!answer) return [];
      const annotation = annotations[prompt];
      const note = isObject(annotation)
        ? asString(annotation.notes)
        : undefined;
      return [
        {
          label: headerByPrompt.get(prompt) ?? prompt,
          answer,
          ...(note ? { note } : {}),
        },
      ];
    });

    if (answers.length > 0) {
      return {
        role,
        text: formatAskUserAnswers(toolName, answers),
        recordIndex,
        kind: 'ask_user',
        toolName,
        // Claude has no auto-resolution: a recorded answer is the operator's.
        origin: 'human',
      };
    }
  }

  const fallback =
    typeof block.content === 'string'
      ? block.content
      : Array.isArray(block.content)
        ? block.content
            .filter(isObject)
            .map((part) => asString(part.text) ?? '')
            .filter(Boolean)
            .join('\n')
        : '';
  if (!fallback) return null;
  return {
    role,
    text: `[${toolName} → answered] ${truncate(fallback, ASK_USER_ANSWER_LIMIT)}`,
    recordIndex,
    kind: 'ask_user',
    toolName,
    origin: 'human',
  };
}

/**
 * Extract DigestEntry objects from a single Claude Code content block.
 *
 * @param {'assistant' | 'user'} role
 * @param {unknown} content
 * @param {number} recordIndex
 * @param {{ includeToolCalls: boolean, includeToolResults: boolean, includeCommandMessages: boolean, toolNameById: Map<string,string> }} opts
 * @returns {object[]}
 */
function claudeEntriesFromContent(
  role: DigestEntryRole,
  content: unknown,
  recordIndex: number,
  opts: ClaudeContentOptions,
): DigestEntry[] {
  if (typeof content === 'string') {
    if (!content) return [];
    if (isClaudeCommandMessageText(content)) {
      if (!opts.includeCommandMessages) return [];
      return [{ role, text: content, recordIndex, kind: 'command_message' }];
    }
    return [messageEntry(role, content, recordIndex)];
  }
  if (!Array.isArray(content)) return [];

  return content.flatMap((block): DigestEntry[] => {
    if (!isObject(block)) return [];

    if (block.type === 'tool_use') {
      if (asString(block.name) === ASK_USER_TOOL_NAMES['claude-code']) {
        const entry = claudeAskUserQuestionEntry(
          role,
          block,
          recordIndex,
          opts,
        );
        if (entry) return [entry];
      }
      if (!opts.includeToolCalls) return [];
      const name = asString(block.name) ?? 'tool_use';
      const argsStr = stringifyArgs(block.input, TOOL_INPUT_LIMIT);
      return [
        {
          role,
          text: `[${name}] ${argsStr}`,
          recordIndex,
          kind: 'tool_call',
          toolName: name,
        },
      ];
    }

    if (block.type === 'tool_result') {
      // Resolve the tool name by correlating tool_use_id → tool name
      const toolUseId = asString(block.tool_use_id);
      const name =
        (toolUseId && opts.toolNameById?.get(toolUseId)) ?? 'tool_result';
      if (name === ASK_USER_TOOL_NAMES['claude-code']) {
        const entry = claudeAskUserAnswerEntry(role, block, recordIndex, opts);
        if (entry) return [entry];
      }
      if (!opts.includeToolResults) return [];
      // Content of tool_result can be string or array
      let resultText = '';
      if (typeof block.content === 'string') {
        resultText = truncate(block.content, TOOL_RESULT_LIMIT);
      } else if (Array.isArray(block.content)) {
        const parts = block.content
          .filter(isObject)
          .map((b) => asString(b.text) ?? '')
          .filter(Boolean);
        resultText = truncate(parts.join('\n'), TOOL_RESULT_LIMIT);
      }
      return [
        {
          role,
          text: `[${name} → result] ${resultText}`,
          recordIndex,
          kind: 'tool_result',
          toolName: name,
        },
      ];
    }

    // text / content blocks
    const text = asString(block.text) ?? asString(block.content);
    if (text && isClaudeCommandMessageText(text)) {
      if (!opts.includeCommandMessages) return [];
      return [{ role, text, recordIndex, kind: 'command_message' }];
    }
    return text ? [messageEntry(role, text, recordIndex)] : [];
  });
}

/**
 * Normalize Claude Code records into DigestEntry[].
 *
 * Builds a first-pass correlation map from tool_use id → tool name so that
 * tool_result entries (which carry tool_use_id, not the tool name) can be
 * rendered as `[ToolName → result] output` with toolName set.
 *
 * @param {object[]} records
 * @param {{ includeToolCalls?: boolean, includeToolResults?: boolean, includeCommandMessages?: boolean }} opts
 * @returns {object[]}
 */
function normalizeClaudeCode(
  records: JsonObject[],
  opts: NormalizeEntriesOptions,
): DigestEntry[] {
  const includeToolCalls = opts.includeToolCalls ?? false;
  const includeToolResults = opts.includeToolResults ?? false;
  const includeCommandMessages = opts.includeCommandMessages ?? false;

  // First pass: build tool_use_id → tool name correlation map
  const toolNameById = new Map<string, string>();
  for (const record of records) {
    const message = isObject(record.message) ? record.message : record;
    const content = message.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (isObject(block) && block.type === 'tool_use') {
        const id = asString(block.id);
        const name = asString(block.name);
        if (id && name) toolNameById.set(id, name);
      }
    }
  }

  // Queue-operation records capture input when it is enqueued. Claude later
  // repeats a delivered queue item in a queued_command attachment. Correlate
  // those representations by their ordered enqueue/remove transaction rather
  // than by prompt text globally: identical human messages are distinct input.
  const queuedContents: string[] = [];
  const deliveredQueuedContents: string[] = [];

  return records.flatMap((record, recordIndex): DigestEntry[] => {
    if (asString(record.type) === 'queue-operation') {
      const operation = asString(record.operation);
      if (operation === 'enqueue') {
        const content = asString(record.content);
        if (!content) return [];
        queuedContents.push(content);
        return [messageEntry('user', content, recordIndex, 'queued-user')];
      }

      if (operation === 'remove') {
        const content = asString(record.content);
        const queuedIndex = content
          ? queuedContents.indexOf(content)
          : queuedContents.length > 0
            ? 0
            : -1;
        if (queuedIndex !== -1) {
          const [deliveredContent] = queuedContents.splice(queuedIndex, 1);
          deliveredQueuedContents.push(deliveredContent);
        }
        return [];
      }
    }

    const attachment = record.attachment;
    if (
      isObject(attachment) &&
      asString(attachment.type) === 'queued_command'
    ) {
      const prompt = asString(attachment.prompt);
      if (!prompt) return [];

      const deliveredIndex = deliveredQueuedContents.indexOf(prompt);
      if (deliveredIndex !== -1) {
        deliveredQueuedContents.splice(deliveredIndex, 1);
        return [];
      }
      return [messageEntry('user', prompt, recordIndex, 'queued-user')];
    }

    // Determine role
    const message = isObject(record.message) ? record.message : record;
    const role =
      asString(message.role) ?? asString(record.role) ?? asString(record.type);

    if (role !== 'assistant' && role !== 'user') return [];

    return claudeEntriesFromContent(role, message.content, recordIndex, {
      includeToolCalls,
      includeToolResults,
      includeCommandMessages,
      toolNameById,
      toolUseResult: record.toolUseResult,
    });
  });
}

// ---------------------------------------------------------------------------
// normalizeEntries — Codex adapter
// ---------------------------------------------------------------------------

/**
 * Codex serializes function call arguments and outputs as JSON strings.
 * Returns null when the payload is absent or not a JSON object.
 */
function parseCodexFunctionArguments(value: unknown): JsonObject | null {
  if (isObject(value)) return value;
  const raw = asString(value);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Build the ask_user entry for a Codex `request_user_input` function_call_output.
 * `labelById` maps the call's question ids to their headers so answers read as
 * conversation rather than as opaque id/label pairs.
 */
function codexAskUserAnswerEntry(
  payload: JsonObject,
  recordIndex: number,
  labelById: Map<string, string>,
  autoResolvable: boolean,
): DigestEntry | null {
  const toolName = ASK_USER_TOOL_NAMES.codex;
  const output = parseCodexFunctionArguments(payload.output);
  const rawAnswers = output && isObject(output.answers) ? output.answers : null;
  if (!rawAnswers) return null;

  const answers = Object.entries(rawAnswers).flatMap(([id, value]) => {
    const answer = askUserAnswerText(value);
    if (!answer) return [];
    return [{ label: labelById.get(id) ?? id, answer }];
  });
  if (answers.length === 0) return null;

  return {
    role: 'user',
    text: formatAskUserAnswers(toolName, answers),
    recordIndex,
    kind: 'ask_user',
    toolName,
    // Only attribute the answer to the operator when the call could not have
    // been resolved by Codex's own timer. The recorded output is identical
    // either way, so an auto-resolvable call leaves origin unset.
    ...(autoResolvable ? {} : { origin: 'human' as const }),
  };
}

/**
 * Normalize Codex records into DigestEntry[].
 *
 * @param {object[]} records
 * @param {{ includeToolCalls?: boolean, includeToolResults?: boolean, includeCommandMessages?: boolean }} opts
 * @returns {object[]}
 */
function normalizeCodex(
  records: JsonObject[],
  opts: NormalizeEntriesOptions,
): DigestEntry[] {
  const includeToolCalls = opts.includeToolCalls ?? false;
  const askUserToolName = ASK_USER_TOOL_NAMES.codex;

  // Codex keys its answers by question id, not question text, so the questions
  // asked in the function_call must be correlated to the function_call_output
  // by call_id before an answer can be labeled.
  const askUserQuestionsByCallId = new Map<string, AskUserQuestion[]>();
  const askUserLabelById = new Map<string, Map<string, string>>();
  const askUserAutoResolvableCallIds = new Set<string>();
  for (const record of records) {
    const payload = isObject(record.payload) ? record.payload : record;
    if (asString(payload.type) !== 'function_call') continue;
    if ((asString(payload.name) ?? asString(record.name)) !== askUserToolName)
      continue;
    const callId = asString(payload.call_id) ?? asString(record.call_id);
    if (!callId) continue;
    const args = parseCodexFunctionArguments(
      payload.arguments ?? record.arguments,
    );
    const questions = parseAskUserQuestions(args?.questions);
    if (questions.length === 0) continue;
    askUserQuestionsByCallId.set(callId, questions);

    const rawQuestions = Array.isArray(args?.questions) ? args.questions : [];
    const labelById = new Map<string, string>();
    for (const rawQuestion of rawQuestions) {
      if (!isObject(rawQuestion)) continue;
      const id = asString(rawQuestion.id);
      const label =
        asString(rawQuestion.header) ??
        asString(rawQuestion.question) ??
        asString(rawQuestion.prompt);
      if (id && label) labelById.set(id, label);
    }
    askUserLabelById.set(callId, labelById);

    const autoResolutionMs = args?.autoResolutionMs;
    if (typeof autoResolutionMs === 'number' && autoResolutionMs > 0) {
      askUserAutoResolvableCallIds.add(callId);
    }
  }

  return records.flatMap((record, recordIndex): DigestEntry[] => {
    const payload = isObject(record.payload) ? record.payload : record;
    const payloadType = asString(payload.type) ?? asString(record.type);

    // function_call_output records are tool mechanics except when they carry
    // the operator's answer to an ask-user call.
    if (payloadType === 'function_call_output') {
      const callId = asString(payload.call_id) ?? asString(record.call_id);
      if (!callId || !askUserQuestionsByCallId.has(callId)) return [];
      const entry = codexAskUserAnswerEntry(
        payload,
        recordIndex,
        askUserLabelById.get(callId) ?? new Map(),
        askUserAutoResolvableCallIds.has(callId),
      );
      return entry ? [entry] : [];
    }

    // function_call records
    if (payloadType === 'function_call') {
      const name =
        asString(payload.name) ?? asString(record.name) ?? 'function_call';
      const args = payload.arguments ?? record.arguments;

      if (name === askUserToolName) {
        const callId = asString(payload.call_id) ?? asString(record.call_id);
        const parsedArgs = parseCodexFunctionArguments(args);
        const questions =
          (callId ? askUserQuestionsByCallId.get(callId) : undefined) ??
          parseAskUserQuestions(parsedArgs?.questions);
        if (questions.length > 0) {
          const autoResolutionMs = parsedArgs?.autoResolutionMs;
          const notes =
            typeof autoResolutionMs === 'number' && autoResolutionMs > 0
              ? [
                  `auto-resolves after ${Math.round(autoResolutionMs / 1000)}s; ` +
                    `a recorded answer may be the default rather than an operator choice`,
                ]
              : undefined;
          return [
            {
              role: 'assistant',
              text: formatAskUserQuestions(askUserToolName, questions, {
                includeDescriptions: includeToolCalls,
                notes,
              }),
              recordIndex,
              kind: 'ask_user',
              toolName: askUserToolName,
            },
          ];
        }
      }

      if (!includeToolCalls) return [];
      const argsStr = stringifyArgs(args, TOOL_INPUT_LIMIT);
      return [
        {
          role: 'assistant',
          text: `[${name}] ${argsStr}`,
          recordIndex,
          kind: 'tool_call',
          toolName: name,
        },
      ];
    }

    // message records
    if (payloadType !== 'message') return [];

    const role = asString(payload.role);
    if (role !== 'assistant' && role !== 'user') return [];

    const content = payload.content;
    if (typeof content === 'string') {
      return content ? [messageEntry(role, content, recordIndex)] : [];
    }
    if (!Array.isArray(content)) return [];

    return content.flatMap((block): DigestEntry[] => {
      if (!isObject(block)) return [];
      const text = asString(block.text) ?? asString(block.content);
      return text ? [messageEntry(role, text, recordIndex)] : [];
    });
  });
}

// ---------------------------------------------------------------------------
// normalizeEntries — Cursor adapter
// ---------------------------------------------------------------------------

/**
 * Render a Cursor `AskQuestion` tool_use block as digest text, or null when the
 * block is a different tool or carries no parseable questions.
 *
 * Cursor transcripts contain no tool-result records at all, so a selected
 * option is never written to disk. The rendered text says so explicitly: an
 * observer must be able to tell "Cursor did not record the answer" apart from
 * "the operator did not answer". A typed reply lands as an ordinary user
 * message and is already visible.
 *
 * Exported because Cursor's v2 digest is built from frame analysis rather than
 * from `normalizeEntries`, and both paths must render questions identically.
 */
export function cursorAskUserQuestionText(
  block: JsonObject,
  opts: { includeDescriptions?: boolean } = {},
): string | null {
  if (asString(block.name) !== ASK_USER_TOOL_NAMES.cursor) return null;
  const input = isObject(block.input) ? block.input : {};
  const questions = parseAskUserQuestions(input.questions);
  if (questions.length === 0) return null;

  const title = asString(input.title);
  return formatAskUserQuestions(ASK_USER_TOOL_NAMES.cursor, questions, {
    includeDescriptions: opts.includeDescriptions ?? false,
    notes: ['selected option not recorded in Cursor transcripts'],
    ...(title ? { title } : {}),
  });
}

function cursorAskUserQuestionEntry(
  role: DigestEntryRole,
  block: JsonObject,
  recordIndex: number,
  opts: { includeDescriptions: boolean },
): DigestEntry | null {
  const text = cursorAskUserQuestionText(block, {
    includeDescriptions: opts.includeDescriptions,
  });
  if (!text) return null;
  return {
    role,
    text,
    recordIndex,
    kind: 'ask_user',
    toolName: ASK_USER_TOOL_NAMES.cursor,
  };
}

/**
 * Normalize Cursor agent JSONL records into DigestEntry[].
 *
 * Cursor records observed in ~/.cursor/projects use top-level role and nested
 * message.content blocks. Text blocks become message entries. Tool-use blocks
 * become compact marker entries only when explicitly requested.
 *
 * @param {object[]} records
 * @param {{ includeToolCalls?: boolean }} opts
 * @returns {object[]}
 */
function normalizeCursor(
  records: JsonObject[],
  opts: NormalizeEntriesOptions,
): DigestEntry[] {
  const includeToolCalls = opts.includeToolCalls ?? false;
  const entries: DigestEntry[] = [];
  let turnStart = 0;

  const normalizeRecord = (
    record: JsonObject,
    recordIndex: number,
  ): DigestEntry[] => {
    const role = asString(record.role);
    if (role !== 'assistant' && role !== 'user') return [];

    const message = isObject(record.message) ? record.message : record;
    const content = message.content;
    if (typeof content === 'string') {
      return content ? [messageEntry(role, content, recordIndex)] : [];
    }
    if (!Array.isArray(content)) return [];

    return content.flatMap((block): DigestEntry[] => {
      if (!isObject(block)) return [];

      if (block.type === 'tool_use') {
        // Only the assistant asks. A user-role record carrying an AskQuestion
        // block is malformed or synthesized, and treating it as a question
        // would open the trailing-tail exception on input the question-free
        // contract is supposed to keep hidden. The v2 frame analysis already
        // recognizes questions from assistant records only; this keeps the two
        // Cursor projections agreeing on what counts as a question.
        if (
          role === 'assistant' &&
          asString(block.name) === ASK_USER_TOOL_NAMES.cursor
        ) {
          const entry = cursorAskUserQuestionEntry(role, block, recordIndex, {
            includeDescriptions: includeToolCalls,
          });
          if (entry) return [entry];
        }
        if (!includeToolCalls) return [];
        const name = asString(block.name) ?? 'tool_use';
        const argsStr = stringifyArgs(block.input, TOOL_INPUT_LIMIT);
        return [
          {
            role,
            text: `[${name}] ${argsStr}`,
            recordIndex,
            kind: 'tool_call',
            toolName: name,
          },
        ];
      }

      const text = asString(block.text) ?? asString(block.content);
      return text ? [messageEntry(role, text, recordIndex)] : [];
    });
  };

  records.forEach((record, recordIndex) => {
    if (record.type !== 'turn_ended') return;

    const status = asString(record.status) as CursorTerminalStatus | undefined;
    const buffered = records
      .slice(turnStart, recordIndex)
      .flatMap((turnRecord, offset) =>
        normalizeRecord(turnRecord, turnStart + offset),
      );
    const consumeAtTerminal = (entry: DigestEntry): DigestEntry => ({
      ...entry,
      sourceRecordIndex: entry.sourceRecordIndex ?? entry.recordIndex,
      recordIndex,
    });
    const userEntries = buffered
      .filter((entry) => entry.role === 'user' && entry.kind !== 'ask_user')
      .map(consumeAtTerminal);
    // Questions put to the operator are conversation, not tool traffic: they
    // survive the turn-terminal collapse on every status, including aborted
    // turns where the rest of the assistant's work is discarded.
    const askUserEntries = buffered
      .filter((entry) => entry.kind === 'ask_user')
      .map(consumeAtTerminal);

    if (status === 'success') {
      const toolEntries = includeToolCalls
        ? buffered
            .filter((entry) => entry.kind === 'tool_call')
            .map(consumeAtTerminal)
        : [];
      const finalAssistant = buffered.findLast(
        (entry) => entry.role === 'assistant' && entry.kind === 'message',
      );
      entries.push(...userEntries, ...toolEntries, ...askUserEntries);
      if (finalAssistant) {
        entries.push(consumeAtTerminal(finalAssistant));
      }
    } else {
      const label = status ?? 'unknown';
      entries.push(...userEntries, ...askUserEntries, {
        role: 'assistant',
        text: `[Cursor turn ended with status: ${label}]`,
        recordIndex,
        kind: 'message',
        origin: 'runtime-diagnostic',
      });
    }

    turnStart = recordIndex + 1;
  });

  // A transcript that is still open — or that ended mid-turn — leaves records
  // after the last `turn_ended`. That provisional tail is normally hidden
  // whole, because Cursor can still rewrite it.
  //
  // A question already put to the operator is the exception: it is recorded
  // fact, not provisional progress. When the tail contains one, the operator's
  // typed reply comes with it — Cursor records that as an ordinary user
  // message, and it is the answer the question was asking for. Unfinished
  // assistant progress stays hidden either way, and a tail with no question
  // keeps the existing hide-it-all behavior.
  if (turnStart < records.length) {
    const trailing = records
      .slice(turnStart)
      .flatMap((record, offset) => normalizeRecord(record, turnStart + offset));
    if (trailing.some((entry) => entry.kind === 'ask_user')) {
      entries.push(
        ...trailing.filter((entry) => {
          if (entry.kind === 'ask_user') return true;
          if (entry.role !== 'user') return false;
          // Not every user-role record is a person. Automatic-control wake
          // envelopes carry lease and pinned-peer identity; they are machine
          // coordination, not the operator's reply, and must not ride this
          // branch into a shared export.
          return (
            entry.origin !== 'automatic-control' &&
            entry.displayRole !== 'automatic-control'
          );
        }),
      );
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// normalizeEntries — public API
// ---------------------------------------------------------------------------

/**
 * Normalize raw JSONL records for a given runtime into DigestEntry[].
 *
 * @param {'claude-code' | 'codex' | 'cursor'} runtime
 * @param {object[]} records
 * @param {{ includeToolCalls?: boolean, includeToolResults?: boolean }} opts
 * @returns {object[]}
 *
 * Each DigestEntry:
 *   { role: 'user' | 'assistant', text: string, recordIndex: number,
 *     kind: 'message' | 'tool_call' | 'tool_result' | 'command_message', toolName?: string }
 */
export function normalizeEntries(
  runtime: Runtime,
  records: JsonObject[],
  opts: NormalizeEntriesOptions = {},
): DigestEntry[] {
  if (runtime === 'claude-code') return normalizeClaudeCode(records, opts);
  if (runtime === 'codex') return normalizeCodex(records, opts);
  if (runtime === 'cursor') return normalizeCursor(records, opts);
  throw new Error(`Unknown runtime: ${runtime}`);
}
