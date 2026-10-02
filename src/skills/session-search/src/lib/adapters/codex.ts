/**
 * Codex source adapter.
 *
 * Store layout (session-schemas/codex.md):
 * - Rollouts: `~/.codex/sessions/YYYY/MM/DD/rollout-<local-ts>-<uuid>.jsonl`
 *   and `~/.codex/archived_sessions/rollout-*.jsonl` (labeled archived).
 * - The first `session_meta` header carries `id` (this thread) and
 *   `session_id` (root thread). `id !== session_id` marks a child rollout.
 *   Children may begin with inherited parent history: records whose
 *   `ordinal` is below `subagent_history_start_ordinal`.
 * - History: `~/.codex/history.jsonl` `{session_id, ts (seconds), text}`.
 * - Index: `~/.codex/session_index.jsonl` `{id, thread_name, updated_at}`.
 * - Threads: `~/.codex/state_5.sqlite` `threads`, read through the optional
 *   `sqlite3` CLI with `-readonly -json` after probing the columns. Any
 *   failure degrades the source with a note and never throws.
 *
 * Only `response_item` messages feed the shared normalizer; `event_msg`
 * user/agent messages duplicate them and are ignored. The normalizer drops
 * tool output, so with `includeTools` the adapter emits tool text directly,
 * including `event_msg` `item_completed` tool items (`CommandExecution`,
 * `McpToolCall`, `Extension`, `FileChange`). `CollabAgentToolCall` items carry
 * only agent-routing metadata and are not searched.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { statSync, type Dirent } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import {
  demoteRole,
  isInjectedUserText,
  unitsFromEntries,
} from '../classify.js';
import { parseJsonObject, readLines } from '../jsonl.js';
import { normalizeEntries, readMetadataRecordsBounded } from '../runtimes.js';
import type {
  AdapterContext,
  EnumerateContext,
  Hit,
  JsonObject,
  Matcher,
  RecordClassifier,
  SessionFile,
  SessionInfo,
  SourceAdapter,
  StoreRoots,
  TextUnit,
} from '../types.js';
import { inTimeWindow } from '../window.js';

const RUNTIME = 'codex' as const;
/** Codex's ask-user tool; its questions and answers are conversation. */
const ASK_USER_TOOL = 'request_user_input';
const ROLLOUT_NAME =
  /^rollout-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(.+)\.jsonl$/u;
/** First header read; a `session_meta` with large base instructions retries. */
const HEADER_FIRST_BYTES = 64 * 1024;
const HEADER_MAX_BYTES = 1024 * 1024;
const INFO_READ_BYTES = 1024 * 1024;
const LINE_MAX_BYTES = 1024 * 1024;
const SQLITE_TIMEOUT_MS = 15_000;
const SQLITE_MAX_OUTPUT = 256 * 1024 * 1024;
/** Thread columns read when present; `id` and `rollout_path` are required. */
const THREAD_COLUMNS = [
  'id',
  'rollout_path',
  'title',
  'first_user_message',
  'cwd',
  'created_at',
  'updated_at',
  'archived',
  'git_origin_url',
  'source',
] as const;
const noDiagnostic = () => {};

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function existsAs(target: string, kind: 'file' | 'dir'): boolean {
  try {
    const stats = statSync(target);
    return kind === 'file' ? stats.isFile() : stats.isDirectory();
  } catch {
    return false;
  }
}

async function listDir(dir: string): Promise<Dirent[]> {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function collectRollouts(dir: string, out: string[]): Promise<void> {
  for (const entry of await listDir(dir)) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await collectRollouts(full, out);
    else if (entry.isFile() && ROLLOUT_NAME.test(entry.name)) out.push(full);
  }
}

/** Epoch ms from seconds, milliseconds, or an ISO string. */
function toEpochMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    if (/^\d+$/u.test(value.trim())) return toEpochMs(Number(value.trim()));
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Session id and local start time encoded in a rollout filename. */
export function parseRolloutName(
  file: string,
): { sessionId: string; startedAtMs: number } | null {
  const match = ROLLOUT_NAME.exec(path.basename(file));
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match
    .slice(1, 7)
    .map(Number);
  const startedAtMs = new Date(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
  ).getTime();
  return { sessionId: match[7], startedAtMs };
}

export interface CodexHeader {
  id: string | null;
  rootId: string | null;
  cwd: string | null;
  timestamp: string | null;
  subagentHistoryStartOrdinal: number | null;
  /** The header `source` carries a `subagent` key. */
  agentAuthored: boolean;
}

/**
 * True for a `source` value (object or JSON string) carrying a `subagent`
 * key: `thread_spawn`, `review`, `memory_consolidation`, `{other: …}`, and any
 * future agent-started kind.
 */
export function isAgentSource(source: unknown): boolean {
  const value =
    typeof source === 'string' && source.trim().startsWith('{')
      ? parseJsonObject(source.trim())
      : source;
  return isObject(value) && Object.hasOwn(value, 'subagent');
}

function headerFrom(records: readonly JsonObject[]): CodexHeader | null {
  const meta = records.find(
    (record) => record.type === 'session_meta' && isObject(record.payload),
  );
  if (!meta || !isObject(meta.payload)) return null;
  const payload = meta.payload;
  const start = payload.subagent_history_start_ordinal;
  const cwd = nonEmpty(payload.cwd);
  return {
    id: nonEmpty(payload.id),
    rootId: nonEmpty(payload.session_id),
    cwd: cwd && path.isAbsolute(cwd) ? cwd : null,
    timestamp: nonEmpty(payload.timestamp) ?? nonEmpty(meta.timestamp),
    subagentHistoryStartOrdinal:
      typeof start === 'number' && Number.isInteger(start) && start >= 0
        ? start
        : null,
    agentAuthored: isAgentSource(payload.source),
  };
}

/** Read the `session_meta` header with a bounded prefix read. */
export async function readCodexHeader(
  file: string,
  size: number,
): Promise<CodexHeader | null> {
  for (const maxBytes of [HEADER_FIRST_BYTES, HEADER_MAX_BYTES]) {
    const { records } = await readMetadataRecordsBounded(file, {
      maxBytes,
      maxRecords: 2,
      diagnostic: noDiagnostic,
    });
    const header = headerFrom(records);
    if (header || size <= maxBytes) return header;
  }
  return null;
}

/** True for a child record that is inherited parent history. */
export function isInheritedRecord(
  file: Pick<SessionFile, 'subagentHistoryStartOrdinal'>,
  record: JsonObject,
): boolean {
  const start = file.subagentHistoryStartOrdinal;
  return (
    typeof start === 'number' &&
    typeof record.ordinal === 'number' &&
    record.ordinal < start
  );
}

/** True for decoded output made only of `input_image` blocks. */
function isImageOnly(value: unknown): boolean {
  const blocks = Array.isArray(value)
    ? value
    : isObject(value) && Array.isArray(value.content)
      ? value.content
      : null;
  return (
    blocks !== null &&
    blocks.length > 0 &&
    blocks.every((block) => isObject(block) && block.type === 'input_image')
  );
}

/**
 * Text of a tool output in any documented shape: a bare string, an array of
 * `input_text` blocks, or a JSON-encoded string of either. Decoding never
 * loses text: blocks without a `.text` field are serialized, and when a
 * decoded string yields no text the raw string is used instead.
 */
export function codexOutputText(output: unknown, depth = 0): string {
  if (typeof output === 'string') {
    const trimmed = output.trimStart();
    if (depth === 0 && /^[[{"]/u.test(trimmed)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(output);
      } catch {
        return output;
      }
      const decoded = codexOutputText(parsed, depth + 1);
      if (decoded.trim() !== '') return decoded;
      // Intentionally empty (only skipped image blocks) is not lost text, so
      // the raw string (base64 included) is not searched.
      return isImageOnly(parsed) ? '' : output;
    }
    return output;
  }
  if (Array.isArray(output)) {
    return output
      .map((block): string => {
        if (typeof block === 'string') return block;
        if (isObject(block)) {
          const text = asString(block.text);
          if (text !== undefined) return text;
          // Image payloads are opaque data, not searchable text.
          if (block.type === 'input_image') return '';
        }
        return block === null || block === undefined
          ? ''
          : JSON.stringify(block);
      })
      .filter((text) => text !== '')
      .join('\n');
  }
  if (isObject(output)) {
    if (typeof output.output === 'string') return output.output;
    if (Array.isArray(output.content)) {
      return codexOutputText(output.content, 1);
    }
    return JSON.stringify(output);
  }
  return output === null || output === undefined ? '' : JSON.stringify(output);
}

/** McpToolCall `result` keys read explicitly; any others are serialized. */
const MCP_RESULT_KNOWN_KEYS = new Set([
  'content',
  'structuredContent',
  'isError',
]);

/** Text of an optional tool field: absent fields contribute nothing. */
function optionalOutputText(value: unknown): string {
  return value === undefined || value === null ? '' : codexOutputText(value);
}

/** Tool arguments as one searchable line, labeled with the tool name. */
function toolArgumentsText(name: string, args: unknown): string {
  if (args === undefined || args === null) return '';
  return `[${name}] ${typeof args === 'string' ? args : JSON.stringify(args)}`;
}

/**
 * Tool text carried by an `event_msg` `item_completed` item. Only tool-like
 * items are read: `Reasoning` is never emitted, and `AgentMessage` /
 * `UserMessage` duplicate `response_item` messages, so they are skipped.
 */
function itemCompletedToolTexts(item: JsonObject): string[] {
  switch (item.type) {
    case 'CommandExecution':
      return [asString(item.aggregated_output) ?? asString(item.stdout) ?? ''];
    case 'McpToolCall': {
      const name = [asString(item.server), asString(item.tool)]
        .filter((part) => part !== undefined)
        .join('.');
      const result = item.result;
      const texts = [toolArgumentsText(name || 'mcp', item.arguments)];
      if (isObject(result)) {
        // `content` blocks decode like any tool output (never losing text);
        // structured content and any other result fields are serialized.
        texts.push(optionalOutputText(result.content));
        if (result.structuredContent !== undefined) {
          texts.push(JSON.stringify(result.structuredContent));
        }
        const rest = Object.entries(result).filter(
          ([key]) => !MCP_RESULT_KNOWN_KEYS.has(key),
        );
        if (rest.length > 0) {
          texts.push(JSON.stringify(Object.fromEntries(rest)));
        }
      } else {
        texts.push(optionalOutputText(result));
      }
      texts.push(optionalOutputText(item.error));
      return texts;
    }
    case 'Extension':
      // Observed web searches carry `query` and `results[{title, snippet}]`;
      // `result`/`output`/`content` are read defensively.
      return [
        asString(item.query) ?? '',
        ...['results', 'result', 'output', 'content'].map((key) =>
          optionalOutputText(item[key]),
        ),
      ];
    case 'FileChange':
      return [asString(item.summary) ?? asString(item.stdout) ?? ''];
    default:
      return [];
  }
}

function codexToolUnits(record: JsonObject): TextUnit[] {
  const payload = isObject(record.payload) ? record.payload : null;
  if (!payload) return [];
  const texts: string[] = [];
  if (record.type === 'response_item') {
    const name = asString(payload.name) ?? asString(payload.type) ?? 'tool';
    switch (payload.type) {
      case 'function_call_output':
      case 'custom_tool_call_output':
        texts.push(codexOutputText(payload.output));
        break;
      case 'function_call': {
        const args = payload.arguments;
        texts.push(
          `[${name}] ${typeof args === 'string' ? args : JSON.stringify(args ?? {})}`,
        );
        break;
      }
      case 'custom_tool_call':
        texts.push(`[${name}] ${asString(payload.input) ?? ''}`);
        break;
      default:
        break;
    }
  } else if (record.type === 'event_msg') {
    if (payload.type === 'item_completed' && isObject(payload.item)) {
      texts.push(...itemCompletedToolTexts(payload.item));
    } else if (payload.type === 'exec_command_end') {
      texts.push(
        asString(payload.aggregated_output) ??
          asString(payload.stdout) ??
          asString(payload.formatted_output) ??
          '',
      );
    }
  }
  return texts
    .filter((text) => text.trim() !== '')
    .map((text) => ({ role: 'tool', text }));
}

/** Classify one raw Codex record into role-tagged search units. */
export function classifyCodexRecord(
  record: JsonObject,
  includeTools: boolean,
): TextUnit[] {
  const payload = isObject(record.payload) ? record.payload : null;
  const isAskCall =
    record.type === 'response_item' &&
    payload?.type === 'function_call' &&
    payload.name === ASK_USER_TOOL;
  // Messages, plus ask-user questions (human decision content, not tools).
  const conversational =
    record.type === 'response_item' &&
    (payload?.type === 'message' || isAskCall);
  const units = conversational
    ? unitsFromEntries(normalizeEntries(RUNTIME, [record]), RUNTIME)
    : [];
  // A recognized ask-user question is conversation only, never also tool text.
  if (!includeTools || (isAskCall && units.length > 0)) return units;
  return [...units, ...codexToolUnits(record)];
}

/** Answer values from an ask-user payload, at full length. */
function askAnswerValues(value: unknown): string[] {
  if (typeof value === 'string') return value.trim() === '' ? [] : [value];
  if (Array.isArray(value)) return value.flatMap(askAnswerValues);
  if (isObject(value)) return askAnswerValues(value.answers);
  return [];
}

/** Untruncated text of a `request_user_input` answer, labeled by question. */
function codexAnswerText(call: JsonObject, record: JsonObject): string {
  const callPayload = isObject(call.payload) ? call.payload : {};
  const payload = isObject(record.payload) ? record.payload : {};
  const args =
    typeof callPayload.arguments === 'string'
      ? parseJsonObject(callPayload.arguments)
      : isObject(callPayload.arguments)
        ? callPayload.arguments
        : null;
  const labels = new Map<string, string>();
  for (const question of Array.isArray(args?.questions) ? args.questions : []) {
    if (!isObject(question)) continue;
    const id = asString(question.id);
    const label =
      asString(question.header) ??
      asString(question.question) ??
      asString(question.prompt);
    if (id && label) labels.set(id, label);
  }
  const output =
    typeof payload.output === 'string'
      ? parseJsonObject(payload.output)
      : isObject(payload.output)
        ? payload.output
        : null;
  if (output && isObject(output.answers)) {
    const lines = Object.entries(output.answers).flatMap(([id, value]) => {
      const answers = askAnswerValues(value);
      return answers.length === 0
        ? []
        : [`${labels.get(id) ?? id}: ${answers.join(', ')}`];
    });
    if (lines.length > 0) return lines.join('\n');
  }
  return codexOutputText(payload.output);
}

/** Distinct tool texts remembered per file for de-duplication. */
export const MAX_TOOL_TEXT_HASHES = 4096;

/**
 * Per-file Codex classifier. It remembers `request_user_input` calls by
 * `call_id` so the matching `function_call_output` answers route through the
 * shared normalizer as user decision content instead of tool output, and it
 * drops tool text already emitted earlier in the same file.
 */
export function createCodexFileClassifier(): RecordClassifier {
  const askCalls = new Map<string, JsonObject>();
  // Codex often records one tool result twice (a `function_call_output` or
  // `custom_tool_call_output` plus an `item_completed` item). Identical tool
  // text is kept once per file; past the cap, new texts are no longer
  // remembered, so later repeats are kept rather than dropped.
  const toolHashes = new Set<string>();
  const firstToolSighting = (unit: TextUnit): boolean => {
    if (unit.role !== 'tool') return true;
    const hash = createHash('sha256').update(unit.text).digest('base64');
    if (toolHashes.has(hash)) return false;
    if (toolHashes.size < MAX_TOOL_TEXT_HASHES) toolHashes.add(hash);
    return true;
  };
  return (record, includeTools) => {
    const payload = isObject(record.payload) ? record.payload : null;
    const callId = asString(payload?.call_id);
    if (record.type === 'response_item' && payload && callId) {
      if (payload.type === 'function_call' && payload.name === ASK_USER_TOOL) {
        askCalls.set(callId, record);
      } else if (payload.type === 'function_call_output') {
        const call = askCalls.get(callId);
        if (call) {
          // The normalizer settles whether this is an answer and its role;
          // the matched text is taken untruncated from the raw output.
          const [answer] = unitsFromEntries(
            normalizeEntries(RUNTIME, [call, record]).filter(
              (entry) => entry.recordIndex === 1,
            ),
            RUNTIME,
          );
          if (answer) {
            const text = codexAnswerText(call, record);
            // Answered ask-user records are conversation only.
            return text.trim() === '' ? [] : [{ role: answer.role, text }];
          }
        }
      }
    }
    return classifyCodexRecord(record, includeTools).filter(firstToolSighting);
  };
}

export interface CodexThread {
  id: string;
  rolloutPath: string | null;
  title: string | null;
  firstUserMessage: string | null;
  cwd: string | null;
  createdAtMs: number | null;
  updatedAtMs: number | null;
  archived: boolean;
  gitOriginUrl: string | null;
  /** Root thread for a subagent thread, from the `source` column. */
  parentId: string | null;
  /** True when `source` shows an ordinary (non-subagent) thread. */
  plainSource: boolean;
  /** True when `source` shows an agent- or automation-started thread. */
  agentAuthored: boolean;
}

function sqliteJson(
  sqlite3: string,
  db: string,
  sql: string,
): { rows: JsonObject[] } | { error: string } {
  const result = spawnSync(sqlite3, ['-readonly', '-json', db, sql], {
    encoding: 'utf8',
    timeout: SQLITE_TIMEOUT_MS,
    maxBuffer: SQLITE_MAX_OUTPUT,
    windowsHide: true,
  });
  if (result.error) return { error: result.error.message };
  if (result.status !== 0) {
    const detail = (result.stderr ?? '').trim().split('\n')[0] ?? '';
    return {
      error: `exit ${result.status ?? 'signal'}${detail ? `: ${detail}` : ''}`,
    };
  }
  const out = (result.stdout ?? '').trim();
  if (out === '') return { rows: [] };
  try {
    const parsed: unknown = JSON.parse(out);
    return Array.isArray(parsed)
      ? { rows: parsed.filter(isObject) }
      : { error: 'unexpected JSON output' };
  } catch {
    return { error: 'unparseable JSON output' };
  }
}

function threadFromRow(row: JsonObject): CodexThread | null {
  const id = nonEmpty(row.id);
  if (!id) return null;
  const source = row.source;
  let parentId: string | null = null;
  let plainSource = false;
  if (typeof source === 'string') {
    const trimmed = source.trim();
    if (trimmed.startsWith('{')) {
      const parsed = parseJsonObject(trimmed);
      const spawn =
        parsed &&
        isObject(parsed.subagent) &&
        isObject(parsed.subagent.thread_spawn)
          ? parsed.subagent.thread_spawn
          : null;
      parentId = nonEmpty(spawn?.parent_thread_id);
    } else if (trimmed !== '') {
      plainSource = true;
    }
  }
  const cwd = nonEmpty(row.cwd);
  return {
    id,
    rolloutPath: nonEmpty(row.rollout_path),
    title: nonEmpty(row.title),
    firstUserMessage: nonEmpty(row.first_user_message),
    cwd: cwd && path.isAbsolute(cwd) ? cwd : null,
    createdAtMs: toEpochMs(row.created_at),
    updatedAtMs: toEpochMs(row.updated_at),
    archived:
      row.archived === 1 || row.archived === true || row.archived === '1',
    gitOriginUrl: nonEmpty(row.git_origin_url),
    parentId,
    plainSource,
    agentAuthored: isAgentSource(source),
  };
}

export interface CodexAdapter extends SourceAdapter {
  /** Threads from `state_5.sqlite`, or `null` when the tier is unavailable. */
  threads(ctx: EnumerateContext): Promise<CodexThread[] | null>;
}

export function createCodexAdapter(): CodexAdapter {
  let threadsPromise: Promise<CodexThread[] | null> | null = null;
  let threadById = new Map<string, CodexThread>();
  let indexPromise: Promise<
    Map<string, { title: string; updatedAtMs: number | null }>
  > | null = null;
  let lastRoots: StoreRoots | null = null;
  const headers = new Map<string, Promise<CodexHeader | null>>();
  const infos = new Map<string, Promise<SessionInfo>>();

  const headerFor = (file: SessionFile): Promise<CodexHeader | null> => {
    let cached = headers.get(file.path);
    if (!cached) {
      cached = readCodexHeader(file.path, file.size).catch(() => null);
      headers.set(file.path, cached);
    }
    return cached;
  };

  const loadThreads = (
    ctx: EnumerateContext,
  ): Promise<CodexThread[] | null> => {
    if (threadsPromise) return threadsPromise;
    threadsPromise = (async () => {
      const sqlite3 = ctx.tools.sqlite3;
      const db = ctx.roots.paths.sqlite;
      if (!sqlite3 || !db) return null;
      const probe = sqliteJson(sqlite3, db, 'PRAGMA table_info(threads)');
      if ('error' in probe) {
        ctx.degrade(
          `state_5.sqlite threads probe failed (${probe.error}); skipping the sqlite tier`,
        );
        return null;
      }
      const available = new Set(
        probe.rows
          .map((row) => asString(row.name))
          .filter((name) => name !== undefined),
      );
      if (!available.has('id') || !available.has('rollout_path')) {
        ctx.degrade(
          'state_5.sqlite threads table lacks id/rollout_path columns; skipping the sqlite tier',
        );
        return null;
      }
      const columns = THREAD_COLUMNS.filter((column) => available.has(column));
      const select = sqliteJson(
        sqlite3,
        db,
        `SELECT ${columns.map((column) => `"${column}"`).join(', ')} FROM threads`,
      );
      if ('error' in select) {
        ctx.degrade(
          `state_5.sqlite threads query failed (${select.error}); skipping the sqlite tier`,
        );
        return null;
      }
      const threads = select.rows
        .map(threadFromRow)
        .filter((thread): thread is CodexThread => thread !== null);
      threadById = new Map(threads.map((thread) => [thread.id, thread]));
      return threads;
    })();
    return threadsPromise;
  };

  const loadIndex = (roots: StoreRoots) => {
    if (indexPromise) return indexPromise;
    indexPromise = (async () => {
      const index = new Map<
        string,
        { title: string; updatedAtMs: number | null }
      >();
      const file = roots.paths.sessionIndex;
      if (!file) return index;
      await readLines(file, { maxLineBytes: LINE_MAX_BYTES }, (event) => {
        if (event.kind !== 'line') return;
        const record = parseJsonObject(event.text);
        const id = nonEmpty(record?.id);
        const title = nonEmpty(record?.thread_name);
        if (!record || !id || !title) return;
        index.set(id, { title, updatedAtMs: toEpochMs(record.updated_at) });
      }).catch(() => {});
      return index;
    })();
    return indexPromise;
  };

  const adapter: CodexAdapter = {
    runtime: RUNTIME,
    threads: loadThreads,

    roots(home: string): StoreRoots {
      const base = path.join(home, '.codex');
      const root = path.join(base, 'sessions');
      const archived = path.join(base, 'archived_sessions');
      const file = (name: string) => {
        const full = path.join(base, name);
        return existsAs(full, 'file') ? full : null;
      };
      const archivedExists = existsAs(archived, 'dir');
      return {
        runtime: RUNTIME,
        root,
        exists: existsAs(root, 'dir') || archivedExists,
        paths: {
          archived: archivedExists ? archived : null,
          history: file('history.jsonl'),
          sessionIndex: file('session_index.jsonl'),
          sqlite: file('state_5.sqlite'),
        },
      };
    },

    async enumerate(ctx: EnumerateContext): Promise<SessionFile[]> {
      lastRoots = ctx.roots;
      if (!ctx.roots.exists) return [];
      const live: string[] = [];
      const archived: string[] = [];
      await collectRollouts(ctx.roots.root, live);
      if (ctx.roots.paths.archived) {
        await collectRollouts(ctx.roots.paths.archived, archived);
      }
      const threads = await loadThreads(ctx);
      const threadByPath = new Map<string, CodexThread>();
      for (const thread of threads ?? []) {
        if (thread.rolloutPath)
          threadByPath.set(path.resolve(thread.rolloutPath), thread);
      }

      const files: SessionFile[] = [];
      const entries = [
        ...live.toSorted().map((file) => ({ file, archived: false })),
        ...archived.toSorted().map((file) => ({ file, archived: true })),
      ];
      for (const entry of entries) {
        const name = parseRolloutName(entry.file);
        if (!name) continue;
        let stats;
        try {
          stats = await stat(entry.file);
        } catch {
          continue;
        }
        if (!stats.isFile()) continue;
        const thread =
          threadByPath.get(path.resolve(entry.file)) ??
          threadById.get(name.sessionId);
        const file: SessionFile = {
          runtime: RUNTIME,
          path: entry.file,
          sessionId: name.sessionId,
          parentSessionId: thread?.parentId ?? null,
          isSubagent: thread?.parentId != null,
          archived: entry.archived || thread?.archived === true,
          mtimeMs: stats.mtimeMs,
          size: stats.size,
          createdAtMs: thread?.createdAtMs ?? name.startedAtMs,
          cwd: thread?.cwd ?? undefined,
          agentAuthored: thread?.agentAuthored === true,
        };
        // Headers are read lazily, and only for files inside the time window.
        // A thread row with an ordinary source already settles cwd and lineage.
        const needsHeader = !(thread?.plainSource && thread.cwd);
        // Past the deadline the file is listed without its header.
        const expired = ctx.deadline != null && Date.now() >= ctx.deadline;
        if (
          needsHeader &&
          !expired &&
          inTimeWindow(file, ctx.options.since, ctx.options.until)
        ) {
          const header = await headerFor(file);
          if (header) {
            if (header.rootId && header.id && header.rootId !== header.id) {
              file.isSubagent = true;
              file.parentSessionId = header.rootId;
            }
            file.subagentHistoryStartOrdinal =
              header.subagentHistoryStartOrdinal;
            file.cwd ??= header.cwd;
            if (header.agentAuthored) file.agentAuthored = true;
          }
        }
        files.push(file);
      }
      return files;
    },

    async historyHits(ctx: AdapterContext, matcher: Matcher): Promise<Hit[]> {
      const history = ctx.roots.paths.history;
      if (!history) return [];
      const hits: Hit[] = [];
      try {
        await readLines(history, { maxLineBytes: LINE_MAX_BYTES }, (event) => {
          if (event.kind !== 'line') return;
          const record = parseJsonObject(event.text);
          const text = asString(record?.text);
          const sessionId = nonEmpty(record?.session_id);
          if (!record || !text || !sessionId) return;
          const match = matcher.match(text);
          if (!match) return;
          hits.push({
            runtime: RUNTIME,
            sessionId,
            tier: 'history',
            role: 'user',
            userTyped: true,
            patterns: match.patterns,
            text,
            firstIndex: match.firstIndex,
            firstLength: match.firstLength,
            transcriptPath: null,
            cwd: null,
            timestampMs: toEpochMs(record.ts),
          });
        });
      } catch {
        ctx.degrade('history.jsonl could not be read');
      }
      return hits;
    },

    async metadataHits(ctx: AdapterContext, matcher: Matcher): Promise<Hit[]> {
      lastRoots = ctx.roots;
      const hits: Hit[] = [];
      const seen = new Set<string>();
      const push = (
        hit: Omit<Hit, 'patterns' | 'firstIndex' | 'firstLength'>,
      ) => {
        const key = `${hit.sessionId}\u0000${hit.role}\u0000${hit.text}`;
        if (seen.has(key)) return;
        const match = matcher.match(hit.text);
        if (!match) return;
        seen.add(key);
        hits.push({
          ...hit,
          patterns: match.patterns,
          firstIndex: match.firstIndex,
          firstLength: match.firstLength,
        });
      };

      for (const thread of (await loadThreads(ctx)) ?? []) {
        const base = {
          runtime: RUNTIME,
          sessionId: thread.id,
          tier: 'meta' as const,
          transcriptPath: thread.rolloutPath,
          cwd: thread.cwd,
          timestampMs: thread.updatedAtMs ?? thread.createdAtMs,
        };
        if (thread.title) {
          push({
            ...base,
            role: 'title',
            userTyped: false,
            text: thread.title,
          });
        }
        if (thread.firstUserMessage) {
          const role = demoteRole('user', thread.firstUserMessage, RUNTIME);
          push({
            ...base,
            role,
            userTyped: role === 'user' && !thread.agentAuthored,
            text: thread.firstUserMessage,
          });
        }
      }

      for (const [id, entry] of await loadIndex(ctx.roots)) {
        push({
          runtime: RUNTIME,
          sessionId: id,
          tier: 'meta',
          role: 'title',
          userTyped: false,
          text: entry.title,
          transcriptPath: null,
          cwd: null,
          timestampMs: entry.updatedAtMs,
        });
      }
      return hits;
    },

    sessionInfo(file: SessionFile): Promise<SessionInfo> {
      let cached = infos.get(file.path);
      if (!cached) {
        cached = (async (): Promise<SessionInfo> => {
          const thread = threadById.get(file.sessionId);
          const header = await headerFor(file);
          const index = lastRoots ? await loadIndex(lastRoots) : null;
          let firstPrompt =
            thread?.firstUserMessage &&
            !isInjectedUserText(thread.firstUserMessage, RUNTIME)
              ? thread.firstUserMessage
              : null;
          if (firstPrompt === null) {
            const { records } = await readMetadataRecordsBounded(file.path, {
              maxBytes: INFO_READ_BYTES,
              maxRecords: 64,
              diagnostic: noDiagnostic,
            });
            const startOrdinal = header?.subagentHistoryStartOrdinal ?? null;
            for (const record of records) {
              if (
                isInheritedRecord(
                  { subagentHistoryStartOrdinal: startOrdinal },
                  record,
                )
              ) {
                continue;
              }
              const unit = classifyCodexRecord(record, false).find(
                (candidate) => candidate.role === 'user',
              );
              if (unit) {
                firstPrompt = unit.text;
                break;
              }
            }
          }
          const startMs =
            toEpochMs(header?.timestamp) ?? thread?.createdAtMs ?? null;
          return {
            cwd: file.cwd ?? thread?.cwd ?? header?.cwd ?? null,
            title: thread?.title ?? index?.get(file.sessionId)?.title ?? null,
            firstPrompt,
            startedAt:
              startMs === null ? null : new Date(startMs).toISOString(),
          };
        })().catch(() => ({
          cwd: file.cwd ?? null,
          title: null,
          firstPrompt: null,
          startedAt: null,
        }));
        infos.set(file.path, cached);
      }
      return cached;
    },

    classifyRecord: classifyCodexRecord,
    fileClassifier: createCodexFileClassifier,

    openHint(sessionId: string, info: SessionInfo) {
      return {
        command: `codex resume ${sessionId}`,
        hint: info.cwd
          ? `run from ${info.cwd}`
          : 'resume from the session directory',
      };
    },
  };
  return adapter;
}
