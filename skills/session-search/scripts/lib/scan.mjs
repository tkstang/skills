// GENERATED skill payload for session-search.

// src/skills/session-search/src/lib/scan.ts
import { spawnSync as spawnSync2 } from "node:child_process";

// src/skills/session-search/src/lib/adapters/codex.ts
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

// src/skills/session-search/src/lib/jsonl.ts
import { open } from "node:fs/promises";
var OVERSIZE_PREFIX_BYTES = 8 * 1024;
var DEFAULT_MAX_OVERSIZE_BYTES = 32 * 1024 * 1024;
var CHUNK_BYTES = 256 * 1024;
async function readLines(file, options, onLine) {
  const maxOversize = options.maxOversizeBytes ?? DEFAULT_MAX_OVERSIZE_BYTES;
  const handle = await open(file, "r");
  const chunk = Buffer.allocUnsafe(CHUNK_BYTES);
  let parts = [];
  let lineBytes = 0;
  let mode = "normal";
  let prefix = "";
  let bytesRead = 0;
  let stopped = false;
  let timedOut = false;
  const append = (slice) => {
    if (slice.length === 0) return;
    lineBytes += slice.length;
    if (mode === "normal") {
      parts.push(Buffer.from(slice));
      if (lineBytes > options.maxLineBytes) {
        const head = Buffer.concat(parts).subarray(0, OVERSIZE_PREFIX_BYTES);
        prefix = head.toString("utf8");
        mode = options.keepOversize?.(prefix) ? "keep" : "drop";
        if (mode === "drop") parts = [];
      }
      return;
    }
    if (mode === "keep") {
      if (lineBytes > maxOversize) {
        mode = "drop";
        parts = [];
        return;
      }
      parts.push(Buffer.from(slice));
    }
  };
  const decode = (buffer) => {
    const end = buffer.length > 0 && buffer[buffer.length - 1] === 13 ? buffer.length - 1 : buffer.length;
    return buffer.toString("utf8", 0, end);
  };
  const finish = () => {
    if (lineBytes === 0) return true;
    let event;
    if (mode === "normal") {
      const text = decode(parts.length === 1 ? parts[0] : Buffer.concat(parts));
      event = text.trim() === "" ? null : { kind: "line", text };
    } else {
      event = {
        kind: "oversize",
        text: mode === "keep" ? decode(Buffer.concat(parts)) : null,
        prefix,
        bytes: lineBytes
      };
    }
    parts = [];
    lineBytes = 0;
    mode = "normal";
    prefix = "";
    return event === null ? true : onLine(event) !== false;
  };
  try {
    outer: for (; ; ) {
      if (options.deadline != null && Date.now() >= options.deadline) {
        timedOut = true;
        break;
      }
      const { bytesRead: count } = await handle.read(
        chunk,
        0,
        CHUNK_BYTES,
        null
      );
      if (count === 0) break;
      bytesRead += count;
      const view = chunk.subarray(0, count);
      let position = 0;
      while (position < count) {
        const newline = view.indexOf(10, position);
        if (newline === -1) {
          append(view.subarray(position));
          break;
        }
        if (lineBytes === 0 && newline - position <= options.maxLineBytes) {
          const text = decode(view.subarray(position, newline));
          position = newline + 1;
          if (text.trim() === "") continue;
          if (onLine({ kind: "line", text }) === false) {
            stopped = true;
            break outer;
          }
          continue;
        }
        append(view.subarray(position, newline));
        position = newline + 1;
        if (!finish()) {
          stopped = true;
          break outer;
        }
      }
    }
    if (!stopped && !timedOut && !finish()) stopped = true;
  } finally {
    await handle.close().catch(() => {
    });
  }
  return { bytesRead, stopped, timedOut };
}
function parseJsonObject(text) {
  try {
    const value = JSON.parse(text);
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

// src/shared/transcript/runtimes.ts
import { open as open2, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join } from "node:path";

// src/skills/session-search/src/lib/adapters/codex.ts
var HEADER_FIRST_BYTES = 64 * 1024;
var HEADER_MAX_BYTES = 1024 * 1024;
var INFO_READ_BYTES = 1024 * 1024;
var LINE_MAX_BYTES = 1024 * 1024;
var SQLITE_MAX_OUTPUT = 256 * 1024 * 1024;
function isInheritedRecord(file, record) {
  const start = file.subagentHistoryStartOrdinal;
  return typeof start === "number" && typeof record.ordinal === "number" && record.ordinal < start;
}

// src/skills/session-search/src/lib/options.ts
import os from "node:os";
import path2 from "node:path";
var DEFAULT_MAX_LINE_BYTES = 64 * 1024;
var DEFAULT_LARGE_SCAN_BYTES = 2 * 1024 * 1024 * 1024;
var HOUR_MS = 60 * 60 * 1e3;
var UNIT_MS = {
  h: HOUR_MS,
  d: 24 * HOUR_MS,
  w: 7 * 24 * HOUR_MS
};

// src/skills/session-search/src/lib/redact.ts
var REDACTED = "[REDACTED]";
var CREDENTIAL_WORD = "password|passwd|secret|token|api[_-]?key|access[_-]?key|client[_-]?secret|private[_-]?key";
var IDENT = "[A-Za-z0-9_.-]";
var KEY = `(?:(?<!\\\\)\\\\*["'])?(?<!${IDENT})(?=${IDENT}*?(?:${CREDENTIAL_WORD}))(?=(?<ident>${IDENT}+))\\k<ident>(?:\\\\*["'])?`;
var SEPARATOR = String.raw`\s*[:=]\s*`;
var QUOTED_VALUE = [
  // One level of escaping: \"...\" where the body may hold escaped-escaped
  // quotes (\\\") and backslashes (\\\\).
  String.raw`\\"(?:\\\\\\"|\\\\\\\\|\\\\[^"\\]|[^"\\])*\\"`,
  // Double-quoted string honoring escapes and spaces.
  String.raw`"(?:[^"\\\n]|\\.)*"`,
  // Single-quoted string.
  String.raw`'(?:[^'\\\n]|\\.)*'`,
  // Two or more levels of escaping: the value opens with a backslash run plus
  // a quote and closes at the next occurrence of that same delimiter that is
  // not itself preceded by a backslash (deeper-escaped quotes are skipped).
  String.raw`(?<vq>\\{2,}["'])(?:(?!(?<!\\)\k<vq>)[^\n])*(?<!\\)\k<vq>`,
  // Unterminated quote at any escaping level: mask to the end of the line.
  String.raw`\\*["'][^\n]*`
];
var VALUE = [
  ...QUOTED_VALUE,
  // Bare value up to whitespace or a delimiter.
  String.raw`[^\s,}&]+`
].join("|");
var KEY_VALUE_RE = new RegExp(
  `(?<key>${KEY})(?<sep>${SEPARATOR})(?:${VALUE})`,
  "gi"
);
var FLAG_RE = new RegExp(
  `(?<![A-Za-z0-9_.-])(?<flag>--?(?=${IDENT}*?(?:${CREDENTIAL_WORD}))(?=(?<ident>${IDENT}+))\\k<ident>)(?<gap>[ \\t]+)(?:${[...QUOTED_VALUE, String.raw`(?!-)\S+`].join("|")})`,
  "gi"
);
var USERINFO_RE = /(?<![A-Za-z0-9+.-])([a-z][a-z0-9+.-]*:\/\/[^\s/:@]*:)\S{0,256}@/gi;
var TOKEN_USERINFO_RE = /(?<![A-Za-z0-9+.-])([a-z][a-z0-9+.-]*:\/\/)[^\s/:@]{20,256}@/gi;
var AUTH_HEADER_RE = /\b(Authorization(?:\\*["'])?\s*[:=]\s*(?:\\*["'])?(?:Basic|Bearer|Token)\s+)[^\s"'\\,;]+/gi;
var TOKEN_RULES = [
  // OpenAI / Anthropic style keys (sk-..., sk-ant-...).
  /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{16,}/g,
  // GitHub tokens.
  /(?<![A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{20,}/g,
  /(?<![A-Za-z0-9])github_pat_[A-Za-z0-9_]{20,}/g,
  // Slack tokens.
  /(?<![A-Za-z0-9])xox[abprs]-[A-Za-z0-9-]{10,}/g,
  // AWS access key ids: long-term (AKIA) and temporary STS (ASIA).
  /(?<![A-Za-z0-9])(?:AKIA|ASIA)[0-9A-Z]{16}(?![A-Za-z0-9])/g,
  // Google API keys.
  /(?<![A-Za-z0-9])AIza[0-9A-Za-z_-]{35}/g,
  // GitLab personal access tokens.
  /(?<![A-Za-z0-9])glpat-[0-9A-Za-z_-]{20,}/g,
  // Stripe secret, restricted, and publishable keys, short forms included.
  /(?<![A-Za-z0-9])[srp]k_(?:live|test)_[0-9A-Za-z]{16,}/g,
  // Hugging Face tokens.
  /(?<![A-Za-z0-9])hf_[A-Za-z0-9]{30,}/g,
  // npm access tokens.
  /(?<![A-Za-z0-9])npm_[A-Za-z0-9]{36}/g
  // Bare 32-hex values are deliberately NOT masked: they would blank MD5
  // hashes and other ids people search for. Keyed hex secrets are caught by
  // the key-value rule.
];
var BEARER_RE = /\b(Bearer\s+)([A-Za-z0-9._~+/-]+=*)/gi;
var HEX_RE = /(?<![A-Za-z0-9])[0-9a-fA-F]{40,}(?![A-Za-z0-9])/g;
var BASE64_RE = /(?<![A-Za-z0-9+/_-])[A-Za-z0-9+/_-]{40,}={0,2}/g;
var WORD_SEGMENT_RE = /^[A-Za-z]?[a-z0-9]*$/;
var LOWERCASE_SEGMENT_RE = /^[a-z0-9]*$/;
function isSegmentedWords(run) {
  if (!/[/_-]/.test(run)) return false;
  const segments = run.split(/[/_-]/);
  return LOWERCASE_SEGMENT_RE.test(segments[0]) && segments.every((segment) => WORD_SEGMENT_RE.test(segment));
}
var CAMEL_PIECE_RE = /[A-Z]?[a-z]+|[A-Z]?\d+|[A-Z]+(?![a-z])/g;
var MAX_UPPERCASE_PIECES = 2;
var MAX_DIGIT_PIECES = 2;
function isCamelIdentifier(run) {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(run)) return false;
  const pieces = run.match(CAMEL_PIECE_RE) ?? [];
  if (pieces.join("") !== run) return false;
  let uppercasePieces = 0;
  let digitPieces = 0;
  for (let index = 0; index < pieces.length; index++) {
    const piece = pieces[index];
    if (/\d/.test(piece)) {
      digitPieces += 1;
      if (digitPieces > MAX_DIGIT_PIECES || piece.replace(/\D/g, "").length > 3 || /\d/.test(pieces[index - 1] ?? "")) {
        return false;
      }
    } else if (/[a-z]/.test(piece)) {
      if (piece.length < (index === 0 ? 2 : 3)) return false;
    } else {
      uppercasePieces += 1;
      if (uppercasePieces > MAX_UPPERCASE_PIECES || piece.length > 5) {
        return false;
      }
      if (piece.length === 1 && /^[A-Z][a-z]/.test(pieces[index + 1] ?? "")) {
        return false;
      }
    }
  }
  return true;
}
function looksLikeEncodedSecret(run) {
  return /\d/.test(run) && /[a-z]/.test(run) && /[A-Z]/.test(run) && !isSegmentedWords(run) && !isCamelIdentifier(run);
}
function redact(text) {
  let out = text.replace(KEY_VALUE_RE, (...args) => {
    const groups = args[args.length - 1];
    return `${groups.key}${groups.sep}${REDACTED}`;
  });
  out = out.replace(FLAG_RE, (...args) => {
    const groups = args[args.length - 1];
    return `${groups.flag}${groups.gap}${REDACTED}`;
  });
  out = out.replace(
    USERINFO_RE,
    (_match, prefix) => `${prefix}${REDACTED}@`
  );
  out = out.replace(
    TOKEN_USERINFO_RE,
    (_match, prefix) => `${prefix}${REDACTED}@`
  );
  out = out.replace(
    AUTH_HEADER_RE,
    (_match, prefix) => `${prefix}${REDACTED}`
  );
  out = out.replace(
    BEARER_RE,
    (match, prefix, token) => token.length >= 16 || token.length >= 8 && /\d/.test(token) ? `${prefix}${REDACTED}` : match
  );
  for (const rule of TOKEN_RULES) out = out.replace(rule, REDACTED);
  out = out.replace(HEX_RE, REDACTED);
  out = out.replace(
    BASE64_RE,
    (run) => looksLikeEncodedSecret(run) ? REDACTED : run
  );
  return out;
}

// src/skills/session-search/src/lib/matcher.ts
var SNIPPET_CONTEXT_CHARS = 80;
var SNIPPET_MAX_CHARS = 240;
var ELLIPSIS = "\u2026";
function buildSnippet(text, index, length) {
  const safeIndex = Math.min(Math.max(0, index), text.length);
  let start = Math.max(0, safeIndex - SNIPPET_CONTEXT_CHARS);
  let end = Math.min(
    text.length,
    safeIndex + Math.max(0, length) + SNIPPET_CONTEXT_CHARS
  );
  if (splitsSurrogatePair(text, start)) start += 1;
  if (splitsSurrogatePair(text, end)) end -= 1;
  const prefix = start > 0 ? ELLIPSIS : "";
  let suffix = end < text.length ? ELLIPSIS : "";
  let body = text.slice(start, end).replace(/\s+/g, " ").trim();
  if (prefix.length + body.length + suffix.length > SNIPPET_MAX_CHARS) {
    suffix = ELLIPSIS;
    let cut = SNIPPET_MAX_CHARS - prefix.length - suffix.length;
    if (splitsSurrogatePair(body, cut)) cut -= 1;
    body = body.slice(0, cut);
  }
  return `${prefix}${body}${suffix}`;
}
function splitsSurrogatePair(text, position) {
  if (position <= 0 || position >= text.length) return false;
  const before = text.charCodeAt(position - 1);
  const after = text.charCodeAt(position);
  return before >= 55296 && before <= 56319 && after >= 56320 && after <= 57343;
}
function snippetFor(text, matcher, preHit) {
  const redacted = redact(text);
  const markers = [];
  for (let at = redacted.indexOf(REDACTED); at !== -1; at = redacted.indexOf(REDACTED, at + REDACTED.length)) {
    markers.push(at);
  }
  let segmentStart = 0;
  for (const segmentEnd of [...markers, redacted.length]) {
    const hit = matcher.match(redacted.slice(segmentStart, segmentEnd));
    if (hit) {
      return buildSnippet(
        redacted,
        segmentStart + hit.firstIndex,
        hit.firstLength
      );
    }
    segmentStart = segmentEnd + REDACTED.length;
  }
  if (markers.length === 0) return buildSnippet(redacted, 0, 0);
  let marker = markers[0];
  if (preHit) {
    const target = redact(text.slice(0, Math.max(0, preHit.firstIndex))).length;
    const distance = (at) => target < at ? at - target : Math.max(0, target - (at + REDACTED.length));
    marker = markers.reduce(
      (best, at) => distance(at) < distance(best) ? at : best
    );
  }
  return buildSnippet(redacted, marker, REDACTED.length);
}

// src/skills/session-search/src/lib/rank.ts
import path3 from "node:path";
var MAX_SNIPPETS = 3;
var ROLE_ORDER = [
  "user",
  "title",
  "assistant",
  "context",
  "tool"
];
function precedesInFile(a, b) {
  const role = ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
  if (role !== 0) return role < 0;
  const time = (a.timestampMs ?? Number.MAX_SAFE_INTEGER) - (b.timestampMs ?? Number.MAX_SAFE_INTEGER);
  if (time !== 0) return time < 0;
  return (a.seq ?? 0) < (b.seq ?? 0);
}

// src/skills/session-search/src/lib/scan.ts
var RG_ARG_CHUNK_BYTES = 100 * 1024;
var RG_MAX_OUTPUT = 64 * 1024 * 1024;
var NEVER_ESCAPED = /^[A-Za-z0-9 _-]$/u;
function isPrefilterSafe(pattern, literal) {
  if (pattern === "") return false;
  if (literal) return [...pattern].every((char) => NEVER_ESCAPED.test(char));
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (NEVER_ESCAPED.test(char)) continue;
    if (char === ".") {
      const next = pattern[i + 1];
      if (next !== "*" && next !== "+") return false;
      i += 1;
      if ("?*+{".includes(pattern[i + 1] ?? "")) return false;
      continue;
    }
    if (char === "(") {
      if (pattern[i + 1] === "?") {
        if (pattern[i + 2] !== ":") return false;
        i += 2;
      }
      continue;
    }
    if (char === ")" || char === "|") continue;
    return false;
  }
  return true;
}
function prefilterWithRg(rgPath, patterns, files, { literal, deadline = null }) {
  const unsafe = patterns.filter(
    (pattern) => !isPrefilterSafe(pattern, literal)
  );
  if (unsafe.length > 0) {
    return {
      files: null,
      note: `rg prefilter skipped: pattern ${JSON.stringify(unsafe[0])} is not prefilter-safe; scanning all candidates in Node`,
      timedOut: false
    };
  }
  const base = [
    "--no-config",
    "-l",
    "-i",
    "-a",
    "--no-messages",
    ...literal ? ["-F"] : [],
    ...patterns.flatMap((pattern) => ["-e", pattern]),
    "--"
  ];
  const matched = /* @__PURE__ */ new Set();
  let chunk = [];
  let chunkBytes = 0;
  const TIMED_OUT = "timed-out";
  const run = () => {
    if (chunk.length === 0) return null;
    let timeout;
    if (deadline !== null) {
      timeout = deadline - Date.now();
      if (timeout <= 0) return TIMED_OUT;
    }
    const result = spawnSync2(rgPath, [...base, ...chunk], {
      encoding: "utf8",
      maxBuffer: RG_MAX_OUTPUT,
      windowsHide: true,
      ...timeout === void 0 ? {} : { timeout }
    });
    chunk = [];
    chunkBytes = 0;
    if (result.error) {
      const code = result.error.code;
      if (code === "ETIMEDOUT") return TIMED_OUT;
      return `rg prefilter failed (${result.error.message})`;
    }
    if (result.status === 1) return null;
    if (result.status !== 0) {
      return `rg prefilter exited with status ${result.status ?? "signal"}`;
    }
    for (const line of (result.stdout ?? "").split("\n")) {
      if (line !== "") matched.add(line);
    }
    return null;
  };
  const failed = (failure2) => failure2 === TIMED_OUT ? {
    files: matched,
    note: "rg prefilter stopped at the deadline; results are incomplete",
    timedOut: true
  } : {
    files: null,
    note: `${failure2}; scanning all candidates in Node`,
    timedOut: false
  };
  for (const file of files) {
    const bytes = Buffer.byteLength(file) + 1;
    if (chunk.length > 0 && chunkBytes + bytes > RG_ARG_CHUNK_BYTES) {
      const failure2 = run();
      if (failure2) return failed(failure2);
    }
    chunk.push(file);
    chunkBytes += bytes;
  }
  const failure = run();
  if (failure) return failed(failure);
  return { files: matched, note: null, timedOut: false };
}
var RAW_SKIP_TYPES = /"type"\s*:\s*"(?:world_state|session_meta|turn_context|compacted)"/u;
var RAW_CODEX_OUTPUT = /"type"\s*:\s*"response_item"[\s\S]*?"payload"\s*:\s*\{\s*"type"\s*:\s*"(?:function_call_output|custom_tool_call_output)"/u;
var RAW_CODEX_ITEM = /"type"\s*:\s*"item_completed"[\s\S]*?"item"\s*:\s*\{\s*"type"\s*:\s*"(?:CommandExecution|McpToolCall|Extension|FileChange)"/u;
var RAW_CLAUDE_RESULT = /"type"\s*:\s*"tool_result"/u;
var RAW_CLAUDE_RECORD = /"parentUuid"\s*:/u;
var RAW_ORDINAL = /"ordinal"\s*:\s*(\d+)/u;
var RAW_HEAD_CHARS = 512;
var RAW_ENVELOPE_FIELD = /"(?:parentUuid|logicalParentUuid|leafUuid|isSidechain|userType|cwd|sessionId|version|gitBranch|slug|agentId|uuid|timestamp|requestId|promptId|messageId|sourceToolAssistantUUID|sourceToolUseID|toolUseID|tool_use_id|type|role|is_error|isMeta|isApiErrorMessage|entrypoint|permissionMode|ordinal|call_id|thread_id|turn_id|client_authored)"\s*:\s*(?:"(?:[^"\\]|\\[\s\S]){0,1024}"|-?\d[\d.eE+-]{0,64}|true|false|null)/gu;
var CODEX_HEADER_KEYS = /* @__PURE__ */ new Set([
  "id",
  "status",
  "source",
  "process_id",
  "exit_code",
  "started_at_ms",
  "completed_at_ms",
  "duration_ms",
  "duration",
  "readOnlyHint"
]);
var CODEX_HEADER_KEY_MAX = 16;
var CODEX_HEADER_VALUE = /\s*:\s*(?:"(?:[^"\\]|\\[\s\S]){0,1024}"|-?\d[\d.eE+-]{0,64}|true|false|null|\{\s*"secs"\s*:\s*\d{1,20}\s*,\s*"nanos"\s*:\s*\d{1,20}\s*\})/y;
function stringEnd(line, start) {
  let from = start + 1;
  for (; ; ) {
    const quote = line.indexOf('"', from);
    if (quote === -1) return -1;
    let slashes = 0;
    while (line.charCodeAt(quote - 1 - slashes) === 92) slashes += 1;
    if (slashes % 2 === 0) return quote;
    from = quote + 1;
  }
}
function blankCodexHeaders(line) {
  const parts = [];
  let kept = 0;
  let depth = 0;
  let at = 0;
  while (at < line.length) {
    const code = line.charCodeAt(at);
    if (code === 34) {
      const end = stringEnd(line, at);
      if (end === -1) break;
      if ((depth === 2 || depth === 3) && end - at - 1 <= CODEX_HEADER_KEY_MAX && CODEX_HEADER_KEYS.has(line.slice(at + 1, end))) {
        CODEX_HEADER_VALUE.lastIndex = end + 1;
        const value = CODEX_HEADER_VALUE.exec(line);
        if (value) {
          parts.push(line.slice(kept, at), " ");
          at = end + 1 + value[0].length;
          kept = at;
          continue;
        }
      }
      at = end + 1;
      continue;
    }
    if (code === 123 || code === 91) depth += 1;
    else if (code === 125 || code === 93) depth -= 1;
    at += 1;
  }
  if (parts.length === 0) return line;
  parts.push(line.slice(kept));
  return parts.join("");
}
function rawToolText(line) {
  const head = line.slice(0, RAW_HEAD_CHARS);
  const codex = RAW_CODEX_OUTPUT.test(head) || RAW_CODEX_ITEM.test(head);
  return (codex ? blankCodexHeaders(line) : line).replace(
    RAW_ENVELOPE_FIELD,
    " "
  );
}
function isRawToolCarrier(prefix) {
  const head = prefix.slice(0, RAW_HEAD_CHARS);
  if (RAW_SKIP_TYPES.test(head)) return false;
  if (RAW_CODEX_OUTPUT.test(head) || RAW_CODEX_ITEM.test(head) || RAW_CLAUDE_RESULT.test(head)) {
    return true;
  }
  return RAW_CLAUDE_RECORD.test(head) && RAW_CLAUDE_RESULT.test(prefix.slice(0, OVERSIZE_PREFIX_BYTES));
}
function emptyScanStats() {
  return {
    filesScanned: 0,
    bytesScanned: 0,
    linesSkippedOversize: 0,
    parseErrors: 0,
    timedOut: false
  };
}
function timestampOf(record) {
  const value = record.timestamp;
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
async function scanFile(file, adapter, matcher, options) {
  const tier = options.includeTools ? "deep" : "content";
  const classify = adapter.fileClassifier ? adapter.fileClassifier() : (record, includeTools) => adapter.classifyRecord(record, includeTools);
  const stats = emptyScanStats();
  const hits = [];
  const base = {
    runtime: file.runtime,
    sessionId: file.sessionId,
    tier,
    transcriptPath: file.path,
    cwd: file.cwd ?? null,
    fromSubagent: file.isSubagent,
    parentSessionId: file.parentSessionId
  };
  const seen = /* @__PURE__ */ new Set();
  const accept = (patterns) => hits.length < options.maxHitsPerSession || patterns.some((pattern) => !seen.has(pattern));
  const withSnippets = [];
  const reachable = (hit) => {
    const better = /* @__PURE__ */ new Set();
    for (const prior of withSnippets) {
      if (!precedesInFile(prior, hit)) continue;
      better.add(prior.snippet ?? "");
      if (better.size >= MAX_SNIPPETS) return false;
    }
    return true;
  };
  const keep = (hit, unitText, match) => {
    const kept = { ...hit, text: "", seq: hits.length };
    if (reachable(kept)) {
      kept.snippet = snippetFor(unitText, matcher, match);
      withSnippets.push(kept);
    }
    hits.push(kept);
    for (const pattern of hit.patterns) seen.add(pattern);
  };
  const done = () => hits.length >= options.maxHitsPerSession && seen.size >= matcher.patterns.length;
  try {
    const result = await readLines(
      file.path,
      {
        maxLineBytes: options.maxLineBytes,
        keepOversize: options.includeTools ? isRawToolCarrier : void 0,
        deadline: options.deadline ?? null
      },
      (event) => {
        if (event.kind === "oversize") {
          stats.linesSkippedOversize += 1;
          if (event.text === null) return;
          const ordinal = RAW_ORDINAL.exec(
            event.prefix.slice(0, RAW_HEAD_CHARS)
          );
          if (ordinal && isInheritedRecord(file, { ordinal: Number(ordinal[1]) })) {
            return;
          }
          const text = rawToolText(event.text);
          const match = matcher.match(text);
          if (!match || !accept(match.patterns)) return;
          keep(
            {
              ...base,
              role: "tool",
              userTyped: false,
              patterns: match.patterns,
              firstIndex: match.firstIndex,
              firstLength: match.firstLength,
              timestampMs: null
            },
            text,
            match
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
              userTyped: unit.role === "user" && !file.isSubagent && file.agentAuthored !== true,
              patterns: match.patterns,
              firstIndex: match.firstIndex,
              firstLength: match.firstLength,
              timestampMs: timestampOf(parsed)
            },
            unit.text,
            match
          );
          if (done()) return false;
        }
      }
    );
    stats.filesScanned = 1;
    stats.bytesScanned = result.bytesRead;
    stats.timedOut = result.timedOut;
  } catch {
    stats.parseErrors += 1;
  }
  return { hits, stats };
}
async function scanFiles(files, adapterFor, matcher, options) {
  const stats = emptyScanStats();
  const notes = [];
  const hits = [];
  let candidates = files;
  if (options.rg && files.length > 0 && !options.includeTools) {
    const prefilter = prefilterWithRg(
      options.rg,
      matcher.patterns,
      files.map((file) => file.path),
      { literal: matcher.literal, deadline: options.deadline ?? null }
    );
    if (prefilter.timedOut) {
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
      options
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
export {
  RG_ARG_CHUNK_BYTES,
  emptyScanStats,
  isPrefilterSafe,
  isRawToolCarrier,
  prefilterWithRg,
  rawToolText,
  scanFile,
  scanFiles
};
