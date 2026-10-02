// GENERATED skill payload for session-search.

// src/skills/session-search/src/lib/scan.ts
import { spawnSync as spawnSync2 } from "node:child_process";

// src/skills/session-search/src/lib/adapters/codex.ts
import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

// src/skills/session-search/src/lib/jsonl.ts
import { open } from "node:fs/promises";
var OVERSIZE_PREFIX_BYTES = 512;
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

// src/skills/session-search/src/lib/scan.ts
var RG_ARG_CHUNK_BYTES = 100 * 1024;
var RG_MAX_OUTPUT = 64 * 1024 * 1024;
function isPrefilterSafe(pattern, literal) {
  if (pattern === "") return false;
  for (const char of pattern) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 32 || code > 126 || char === '"' || char === "\\") {
      return false;
    }
  }
  if (literal) return true;
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
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
    if ("[]{}*+?^$".includes(char)) return false;
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
var RAW_CODEX_ITEM = /"type"\s*:\s*"item_completed"[\s\S]*?"item"\s*:\s*\{\s*"type"\s*:\s*"(?:CommandExecution|McpToolCall|FileChange)"/u;
var RAW_CLAUDE_RESULT = /"type"\s*:\s*"tool_result"/u;
var RAW_ORDINAL = /"ordinal"\s*:\s*(\d+)/u;
function isRawToolCarrier(prefix) {
  if (RAW_SKIP_TYPES.test(prefix)) return false;
  return RAW_CODEX_OUTPUT.test(prefix) || RAW_CODEX_ITEM.test(prefix) || RAW_CLAUDE_RESULT.test(prefix);
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
  const keep = (hit) => {
    hits.push(hit);
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
          const ordinal = RAW_ORDINAL.exec(event.prefix);
          if (ordinal && isInheritedRecord(file, { ordinal: Number(ordinal[1]) })) {
            return;
          }
          const match = matcher.match(event.text);
          if (!match || !accept(match.patterns)) return;
          keep({
            ...base,
            role: "tool",
            userTyped: false,
            patterns: match.patterns,
            text: event.text,
            firstIndex: match.firstIndex,
            firstLength: match.firstLength,
            timestampMs: null
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
            userTyped: unit.role === "user" && !file.isSubagent && file.agentAuthored !== true,
            patterns: match.patterns,
            text: unit.text,
            firstIndex: match.firstIndex,
            firstLength: match.firstLength,
            timestampMs: timestampOf(parsed)
          });
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
  scanFile,
  scanFiles
};
