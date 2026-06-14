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
 *   readRecords(transcriptPath)                    → Promise<JsonObject[]>
 *   normalizeEntries(runtime, records, opts)       → DigestEntry[]
 */

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname, basename } from 'node:path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOOL_INPUT_LIMIT = 200;
const TOOL_RESULT_LIMIT = 500;
const COMMAND_MESSAGE_RE =
  /<(command-message|command-name|command-args)>[\s\S]*?<\/\1>/u;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when value is a non-null, non-array plain object.
 * @param {unknown} value
 * @returns {boolean}
 */
function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Returns value if it is a string, otherwise undefined.
 * @param {unknown} value
 * @returns {string | undefined}
 */
function asString(value) {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Truncates a string to `limit` chars, appending '...' when truncated.
 * @param {string} str
 * @param {number} limit
 * @returns {string}
 */
function truncate(str, limit) {
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
function isClaudeCommandMessageText(text) {
  return COMMAND_MESSAGE_RE.test(text);
}

/**
 * Stringify a tool/function argument value and truncate to limit.
 * @param {unknown} value
 * @param {number} limit
 * @returns {string}
 */
function stringifyArgs(value, limit) {
  if (typeof value === 'string') return truncate(value, limit);
  return truncate(JSON.stringify(value ?? {}) ?? '{}', limit);
}

/**
 * Attempt to JSON.parse a single line.
 * Returns { ok: true, value } or { ok: false, reason }.
 * @param {string} line
 * @returns {{ ok: boolean, value?: object, reason?: unknown }}
 */
function safeParseLine(line) {
  try {
    const parsed = JSON.parse(line);
    if (!isObject(parsed)) return { ok: false, reason: 'not a JSON object' };
    return { ok: true, value: parsed };
  } catch (err) {
    return { ok: false, reason: err.message };
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
export function discoverPaths(runtime) {
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
export function encodeCwd(runtime, cwd) {
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
export function encodeCwdVariants(runtime, cwd) {
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
export async function readRecords(transcriptPath) {
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
function claudeSessionIdFromRecord(record) {
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
function decodeCwdDirName(dirName) {
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
function codexSessionIdFromRecord(record) {
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
export async function extractMeta(runtime, transcriptPath) {
  const records = await readRecords(transcriptPath);

  if (runtime === 'claude-code') {
    let sessionId;
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
    let sessionId;
    let recordedCwd = null;

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
 * Extract DigestEntry objects from a single Claude Code content block.
 *
 * @param {'assistant' | 'user'} role
 * @param {unknown} content
 * @param {number} recordIndex
 * @param {{ includeToolCalls: boolean, includeToolResults: boolean, includeCommandMessages: boolean, toolNameById: Map<string,string> }} opts
 * @returns {object[]}
 */
function claudeEntriesFromContent(role, content, recordIndex, opts) {
  if (typeof content === 'string') {
    if (!content) return [];
    if (isClaudeCommandMessageText(content)) {
      if (!opts.includeCommandMessages) return [];
      return [{ role, text: content, recordIndex, kind: 'command_message' }];
    }
    return [{ role, text: content, recordIndex, kind: 'message' }];
  }
  if (!Array.isArray(content)) return [];

  return content.flatMap((block) => {
    if (!isObject(block)) return [];

    if (block.type === 'tool_use') {
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
      if (!opts.includeToolResults) return [];
      // Resolve the tool name by correlating tool_use_id → tool name
      const toolUseId = asString(block.tool_use_id);
      const name =
        (toolUseId && opts.toolNameById?.get(toolUseId)) ?? 'tool_result';
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
    return text ? [{ role, text, recordIndex, kind: 'message' }] : [];
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
function normalizeClaudeCode(records, opts) {
  const includeToolCalls = opts.includeToolCalls ?? false;
  const includeToolResults = opts.includeToolResults ?? false;
  const includeCommandMessages = opts.includeCommandMessages ?? false;

  // First pass: build tool_use_id → tool name correlation map
  /** @type {Map<string, string>} */
  const toolNameById = new Map();
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

  return records.flatMap((record, recordIndex) => {
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
    });
  });
}

// ---------------------------------------------------------------------------
// normalizeEntries — Codex adapter
// ---------------------------------------------------------------------------

/**
 * Normalize Codex records into DigestEntry[].
 *
 * @param {object[]} records
 * @param {{ includeToolCalls?: boolean, includeToolResults?: boolean, includeCommandMessages?: boolean }} opts
 * @returns {object[]}
 */
function normalizeCodex(records, opts) {
  const includeToolCalls = opts.includeToolCalls ?? false;

  return records.flatMap((record, recordIndex) => {
    const payload = isObject(record.payload) ? record.payload : record;
    const payloadType = asString(payload.type) ?? asString(record.type);

    // function_call records
    if (payloadType === 'function_call') {
      if (!includeToolCalls) return [];
      const name =
        asString(payload.name) ?? asString(record.name) ?? 'function_call';
      const args = payload.arguments ?? record.arguments;
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
      return content
        ? [{ role, text: content, recordIndex, kind: 'message' }]
        : [];
    }
    if (!Array.isArray(content)) return [];

    return content.flatMap((block) => {
      if (!isObject(block)) return [];
      const text = asString(block.text) ?? asString(block.content);
      return text ? [{ role, text, recordIndex, kind: 'message' }] : [];
    });
  });
}

// ---------------------------------------------------------------------------
// normalizeEntries — Cursor adapter
// ---------------------------------------------------------------------------

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
function normalizeCursor(records, opts) {
  const includeToolCalls = opts.includeToolCalls ?? false;

  return records.flatMap((record, recordIndex) => {
    const role = asString(record.role);
    if (role !== 'assistant' && role !== 'user') return [];

    const message = isObject(record.message) ? record.message : record;
    const content = message.content;
    if (typeof content === 'string') {
      return content
        ? [{ role, text: content, recordIndex, kind: 'message' }]
        : [];
    }
    if (!Array.isArray(content)) return [];

    return content.flatMap((block) => {
      if (!isObject(block)) return [];

      if (block.type === 'tool_use') {
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
      return text ? [{ role, text, recordIndex, kind: 'message' }] : [];
    });
  });
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
export function normalizeEntries(runtime, records, opts = {}) {
  if (runtime === 'claude-code') return normalizeClaudeCode(records, opts);
  if (runtime === 'codex') return normalizeCodex(records, opts);
  if (runtime === 'cursor') return normalizeCursor(records, opts);
  throw new Error(`Unknown runtime: ${runtime}`);
}
