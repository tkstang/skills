// GENERATED skill payload for session-observer.

// src/skills/session-observer/src/lib/watch.ts
import { appendFile, lstat, mkdir as mkdir5, realpath as realpath2, stat as stat5 } from "node:fs/promises";
import { homedir as homedir6 } from "node:os";
import { dirname as dirname3, isAbsolute as isAbsolute4, join as join6, relative as relative2, resolve as resolve2 } from "node:path";

// src/shared/transcript/cursor-frames.ts
import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
function isJsonObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseClosedFrame(frameBytes) {
  if (frameBytes.length === 0) {
    return { parseState: "blank", record: null };
  }
  try {
    const value = JSON.parse(frameBytes.toString("utf8"));
    if (!isJsonObject(value)) {
      return { parseState: "malformed", record: null };
    }
    return { parseState: "parsed", record: value };
  } catch {
    return { parseState: "malformed", record: null };
  }
}
function optionalFileIdentity(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function validateVerifyPrefixBytes(value) {
  if (value !== void 0 && (!Number.isSafeInteger(value) || value < 0)) {
    throw new TypeError("verifyPrefixBytes must be a non-negative integer");
  }
}
async function scanCursorTranscript(transcriptPath, options) {
  validateVerifyPrefixBytes(options.verifyPrefixBytes);
  const handle = await open(transcriptPath, "r");
  try {
    const file = await handle.stat();
    const safePrefixHash = createHash("sha256");
    const verifiedPrefixHash = options.verifyPrefixBytes === void 0 ? null : createHash("sha256");
    let verifiedBytes = 0;
    let verifiedPrefixSha256 = options.verifyPrefixBytes === 0 ? createHash("sha256").digest("hex") : null;
    let carrySegments = [];
    let carryLength = 0;
    let carryByteStart = 0;
    let frameIndex = 0;
    let safeThroughFrame = null;
    let safePrefixBytes = 0;
    let blockingFrame = null;
    const updateVerifiedHash = (chunk) => {
      if (verifiedPrefixHash === null || options.verifyPrefixBytes === void 0 || verifiedBytes >= options.verifyPrefixBytes) {
        return;
      }
      const remaining = options.verifyPrefixBytes - verifiedBytes;
      const bytes = chunk.subarray(0, Math.min(chunk.length, remaining));
      verifiedPrefixHash.update(bytes);
      verifiedBytes += bytes.length;
    };
    const emitClosedFrame = async (frameSegments, contentBytes, byteStart) => {
      const parsed = parseClosedFrame(contentBytes);
      const byteEnd = byteStart + contentBytes.length + 1;
      const frame = {
        frameIndex,
        byteStart,
        byteEnd,
        closed: true,
        ...parsed
      };
      if (blockingFrame === null && (frame.parseState === "parsed" || frame.parseState === "blank")) {
        for (const segment of frameSegments) {
          safePrefixHash.update(segment);
        }
        safePrefixHash.update("\n");
        safeThroughFrame = frame.frameIndex;
        safePrefixBytes = frame.byteEnd;
      } else if (blockingFrame === null) {
        blockingFrame = {
          frameIndex: frame.frameIndex,
          byteStart: frame.byteStart,
          byteEnd: frame.byteEnd,
          parseState: "malformed"
        };
      }
      await options.onFrame(frame);
      frameIndex += 1;
    };
    if (file.size > 0) {
      const stream = handle.createReadStream({
        autoClose: false,
        start: 0,
        end: file.size - 1
      });
      for await (const streamChunk of stream) {
        const chunk = Buffer.isBuffer(streamChunk) ? streamChunk : Buffer.from(streamChunk);
        updateVerifiedHash(chunk);
        let chunkOffset = 0;
        while (chunkOffset < chunk.length) {
          const newlineOffset = chunk.indexOf(10, chunkOffset);
          if (newlineOffset === -1) {
            const suffix = chunk.subarray(chunkOffset);
            if (suffix.length > 0) {
              carrySegments.push(suffix);
              carryLength += suffix.length;
            }
            break;
          }
          const segment = chunk.subarray(chunkOffset, newlineOffset);
          if (segment.length > 0) {
            carrySegments.push(segment);
            carryLength += segment.length;
          }
          const contentBytes = carrySegments.length === 0 ? Buffer.alloc(0) : carrySegments.length === 1 ? carrySegments[0] : Buffer.concat(carrySegments, carryLength);
          const frameByteLength = carryLength + 1;
          await emitClosedFrame(carrySegments, contentBytes, carryByteStart);
          carrySegments = [];
          carryLength = 0;
          chunkOffset = newlineOffset + 1;
          carryByteStart += frameByteLength;
        }
      }
    }
    if (carryLength > 0) {
      const frame = {
        frameIndex,
        byteStart: carryByteStart,
        byteEnd: carryByteStart + carryLength,
        closed: false,
        parseState: "partial",
        record: null
      };
      if (blockingFrame === null) {
        blockingFrame = {
          frameIndex: frame.frameIndex,
          byteStart: frame.byteStart,
          byteEnd: frame.byteEnd,
          parseState: "partial"
        };
      }
      await options.onFrame(frame);
      frameIndex += 1;
    }
    if (verifiedPrefixHash !== null && options.verifyPrefixBytes !== void 0 && options.verifyPrefixBytes > 0 && verifiedBytes === options.verifyPrefixBytes) {
      verifiedPrefixSha256 = verifiedPrefixHash.digest("hex");
    }
    return {
      indexBase: "zero-based-jsonl-frame-index",
      totalFrames: frameIndex,
      safeThroughFrame,
      safePrefixBytes,
      safePrefixSha256: safePrefixHash.digest("hex"),
      verifiedPrefixSha256,
      file: {
        size: file.size,
        mtimeMs: file.mtimeMs,
        device: optionalFileIdentity(file.dev),
        inode: optionalFileIdentity(file.ino)
      },
      blockingFrame
    };
  } finally {
    await handle.close();
  }
}

// src/shared/transcript/runtimes.ts
import { open as open2, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join } from "node:path";
var TOOL_INPUT_LIMIT = 200;
var TOOL_RESULT_LIMIT = 500;
var ASK_USER_PROMPT_LIMIT = 500;
var ASK_USER_OPTION_LIMIT = 120;
var ASK_USER_DESCRIPTION_LIMIT = 300;
var ASK_USER_ANSWER_LIMIT = 500;
var ASK_USER_TOOL_NAMES = {
  "claude-code": "AskUserQuestion",
  codex: "request_user_input",
  cursor: "AskQuestion"
};
var COMMAND_MESSAGE_RE = /<(command-message|command-name|command-args)>[\s\S]*?<\/\1>/u;
var NO_OP_PREFIX = /^\s*\[no-op\](?:\s|$)/iu;
var AUTOMATIC_ACKNOWLEDGMENT = /^\s*(?:ack(?:nowledged)?|got it|understood|noted|received|ok(?:ay)?|thanks|thank you)[.!]*\s*$/iu;
var AUTOMATIC_STATUS_ECHO = /^\s*(?:status:\s*)?(?:(?:still\s+)?(?:waiting|holding|idle|armed|monitoring)(?:\s+(?:for|on|until)\s+[^.!?;:]+)?|no (?:new )?(?:input|updates?|messages?|changes?))[.!]*\s*$/iu;
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function asString(value) {
  return typeof value === "string" ? value : void 0;
}
function automaticControlVersion(schemaVersion, indexBase) {
  if (schemaVersion === void 0 && indexBase === void 0) {
    return {
      schemaVersion: 1,
      indexBase: "zero-based-jsonl-record-index"
    };
  }
  if (schemaVersion === 2 && (indexBase === "zero-based-jsonl-record-index" || indexBase === "zero-based-jsonl-frame-index")) {
    return { schemaVersion, indexBase };
  }
  return null;
}
function parseAutomaticControlJsonEnvelope(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(parsed) || !isObject(parsed.session_observer_wake)) return null;
  const wake = parsed.session_observer_wake;
  const version = automaticControlVersion(wake.schemaVersion, wake.indexBase);
  const range = wake.range;
  if (version === null || wake.automatic !== true || !asString(wake.runtime) || !asString(wake.leaseId) || !isObject(wake.pinnedPeer) && !asString(wake.pinnedPeer) || !isObject(range) || !Number.isInteger(range.fromIndex) || !Number.isInteger(range.toIndex) || range.fromIndex < 0 || range.toIndex < range.fromIndex) {
    return null;
  }
  return {
    ...wake,
    automatic: true,
    schemaVersion: version.schemaVersion,
    runtime: wake.runtime,
    leaseId: wake.leaseId,
    pinnedPeer: wake.pinnedPeer,
    indexBase: version.indexBase,
    range
  };
}
function decodeXmlAttribute(value) {
  if (/[<>]|&(?!amp;|quot;|lt;|gt;|apos;)/u.test(value)) return null;
  return value.replace(
    /&(amp|quot|lt|gt|apos);/gu,
    (_match, entity) => {
      if (entity === "amp") return "&";
      if (entity === "quot") return '"';
      if (entity === "lt") return "<";
      if (entity === "gt") return ">";
      return "'";
    }
  );
}
function parseXmlAttributes(source) {
  const attributes = /* @__PURE__ */ new Map();
  const pattern = /([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*"([^"]*)"/gu;
  let cursor = 0;
  let match;
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
function parseAutomaticControlXmlEnvelope(text) {
  const match = /^\s*<session_observer_wake\b([^<>]*)>([\s\S]*?)<\/session_observer_wake>\s*$/u.exec(
    text
  );
  if (!match) return null;
  const attributes = parseXmlAttributes(match[1]);
  if (!attributes || attributes.get("automatic") !== "true") return null;
  const schemaVersionAttribute = attributes.get("schema_version");
  const version = automaticControlVersion(
    schemaVersionAttribute === void 0 ? void 0 : schemaVersionAttribute === "2" ? 2 : null,
    attributes.get("index_base")
  );
  const runtime = attributes.get("runtime");
  const leaseId = attributes.get("lease_id");
  const pinnedPeer = attributes.get("peer");
  const records = attributes.get("records");
  const rangeMatch = /^(\d+)-(\d+)$/u.exec(records ?? "");
  if (version === null || !runtime?.trim() || !leaseId?.trim() || !pinnedPeer?.trim() || !rangeMatch)
    return null;
  const fromIndex = Number(rangeMatch[1]);
  const toIndex = Number(rangeMatch[2]);
  if (!Number.isSafeInteger(fromIndex) || !Number.isSafeInteger(toIndex) || toIndex < fromIndex) {
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
    wireFormat: "xml",
    body: match[2].trim()
  };
}
function parseAutomaticControlEnvelope(text) {
  return parseAutomaticControlXmlEnvelope(text) ?? parseAutomaticControlJsonEnvelope(text);
}
function isNoOpText(text) {
  return NO_OP_PREFIX.test(text);
}
function isAutomaticControlAcknowledgement(text) {
  return AUTOMATIC_ACKNOWLEDGMENT.test(text) || AUTOMATIC_STATUS_ECHO.test(text);
}
function messageEntry(role, text, recordIndex, displayRole) {
  if (role === "user") {
    const automaticControl = parseAutomaticControlEnvelope(text);
    if (automaticControl) {
      return {
        role,
        text,
        recordIndex,
        kind: "message",
        displayRole: "automatic-control",
        origin: "automatic-control",
        automaticControl
      };
    }
  }
  return {
    role,
    text,
    recordIndex,
    kind: "message",
    ...displayRole ? { displayRole } : {}
  };
}
function truncate(str, limit) {
  if (str.length <= limit) return str;
  return str.slice(0, limit) + "...";
}
function isClaudeCommandMessageText(text) {
  return COMMAND_MESSAGE_RE.test(text);
}
function stringifyArgs(value, limit) {
  if (typeof value === "string") return truncate(value, limit);
  return truncate(JSON.stringify(value ?? {}) ?? "{}", limit);
}
var ASK_USER_ANSWER_PROMPT_LIMIT = 200;
function parseAskUserQuestions(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!isObject(raw)) return [];
    const prompt = asString(raw.question) ?? asString(raw.prompt);
    if (!prompt) return [];
    const header = asString(raw.header) ?? asString(raw.title);
    const options = Array.isArray(raw.options) ? raw.options.flatMap((option) => {
      if (typeof option === "string") return [{ label: option }];
      if (!isObject(option)) return [];
      const label = asString(option.label) ?? asString(option.id);
      if (!label) return [];
      const description = asString(option.description);
      return [{ label, ...description ? { description } : {} }];
    }) : [];
    return [{ ...header ? { header } : {}, prompt, options }];
  });
}
function formatAskUserQuestions(toolName, questions, opts) {
  const numbered = questions.length > 1;
  const lines = [];
  const questionHead = (question) => {
    const header = question.header ?? (numbered ? void 0 : opts.title);
    const head = header ? `${header} \u2014 ${question.prompt}` : question.prompt;
    return truncate(head, ASK_USER_PROMPT_LIMIT);
  };
  if (numbered) {
    const title = opts.title ? `${opts.title} \u2014 ` : "";
    lines.push(`[${toolName}] ${title}${questions.length} questions:`);
  }
  questions.forEach((question, index) => {
    const head = questionHead(question);
    lines.push(numbered ? `${index + 1}. ${head}` : `[${toolName}] ${head}`);
    if (question.options.length === 0) return;
    if (opts.includeDescriptions) {
      for (const option of question.options) {
        const description = option.description ? ` \u2014 ${truncate(option.description, ASK_USER_DESCRIPTION_LIMIT)}` : "";
        lines.push(
          `   - ${truncate(option.label, ASK_USER_OPTION_LIMIT)}${description}`
        );
      }
    } else {
      const labels = question.options.map((option) => truncate(option.label, ASK_USER_OPTION_LIMIT)).join(" | ");
      lines.push(`   options: ${labels}`);
    }
  });
  for (const note of opts.notes ?? []) lines.push(`   (${note})`);
  return lines.join("\n");
}
function formatAskUserAnswers(toolName, answers) {
  const numbered = answers.length > 1;
  const lines = [];
  if (numbered) {
    lines.push(`[${toolName} \u2192 answered]`);
  }
  answers.forEach(({ label, answer, note }, index) => {
    const body = `${truncate(label, ASK_USER_ANSWER_PROMPT_LIMIT)}: "${truncate(
      answer,
      ASK_USER_ANSWER_LIMIT
    )}"`;
    lines.push(
      numbered ? `${index + 1}. ${body}` : `[${toolName} \u2192 answered] ${body}`
    );
    if (note) {
      lines.push(`   note: ${truncate(note, ASK_USER_ANSWER_LIMIT)}`);
    }
  });
  return lines.join("\n");
}
function askUserAnswerText(value) {
  if (typeof value === "string") return value || void 0;
  if (Array.isArray(value)) {
    const labels = value.map(asString).filter((label) => Boolean(label));
    return labels.length > 0 ? labels.join(", ") : void 0;
  }
  if (isObject(value)) return askUserAnswerText(value.answers);
  return void 0;
}
function safeParseLine(line) {
  try {
    const parsed = JSON.parse(line);
    if (!isObject(parsed)) return { ok: false, reason: "not a JSON object" };
    return { ok: true, value: parsed };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err)
    };
  }
}
function discoverPaths(runtime) {
  const home = homedir();
  if (runtime === "claude-code") {
    return [join(home, ".claude", "projects")];
  }
  if (runtime === "codex") {
    return [join(home, ".codex", "sessions")];
  }
  if (runtime === "cursor") {
    return [join(home, ".cursor", "projects")];
  }
  throw new Error(`Unknown runtime: ${runtime}`);
}
function encodeCwdVariants(runtime, cwd) {
  if (runtime === "codex") return [];
  if (runtime === "cursor") {
    return [cwd.split(/[/.]/u).filter(Boolean).join("-")];
  }
  const variants = [cwd.replace(/[/.]/g, "-"), cwd.replace(/\//g, "-")];
  return [...new Set(variants)];
}
function validateBoundedReadOptions(options) {
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0) {
    throw new TypeError("maxBytes must be a positive safe integer");
  }
  if (!Number.isSafeInteger(options.maxRecords) || options.maxRecords <= 0) {
    throw new TypeError("maxRecords must be a positive safe integer");
  }
  if (options.maxInspectedRecords !== void 0 && (!Number.isSafeInteger(options.maxInspectedRecords) || options.maxInspectedRecords <= 0)) {
    throw new TypeError("maxInspectedRecords must be a positive safe integer");
  }
  if (options.deadlineMs !== void 0 && (!Number.isFinite(options.deadlineMs) || options.deadlineMs < 0)) {
    throw new TypeError("deadlineMs must be a non-negative finite number");
  }
}
function safeDiagnostic(options, code) {
  options.diagnostic({ code });
}
function deadlineAt(options) {
  return options.deadlineMs === void 0 ? null : Date.now() + options.deadlineMs;
}
function deadlineExpired(deadline) {
  return deadline !== null && Date.now() >= deadline;
}
async function readBoundedWindow(transcriptPath, options, direction, deadline) {
  if (deadlineExpired(deadline)) {
    safeDiagnostic(options, "deadline-exceeded");
    return null;
  }
  let handle;
  try {
    handle = await open2(transcriptPath, "r");
    if (deadlineExpired(deadline)) {
      safeDiagnostic(options, "deadline-exceeded");
      return null;
    }
    const { size } = await handle.stat();
    const length = Math.min(size, options.maxBytes);
    const offset = direction === "tail" ? Math.max(0, size - length) : 0;
    const buffer = Buffer.allocUnsafe(length);
    let bytesRead = 0;
    while (bytesRead < length) {
      if (deadlineExpired(deadline)) {
        safeDiagnostic(options, "deadline-exceeded");
        return null;
      }
      const result = await handle.read(
        buffer,
        bytesRead,
        length - bytesRead,
        offset + bytesRead
      );
      if (result.bytesRead === 0) break;
      bytesRead += result.bytesRead;
    }
    if (deadlineExpired(deadline)) {
      safeDiagnostic(options, "deadline-exceeded");
      return null;
    }
    return { buffer: buffer.subarray(0, bytesRead), offset, fileSize: size };
  } catch {
    safeDiagnostic(options, "read-failed");
    return null;
  } finally {
    await handle?.close().catch(() => {
    });
  }
}
function parseBoundedLines(buffer, options, deadline, mode, dropLeadingFragment, dropTrailingFragment) {
  let start = 0;
  let incomplete = false;
  let recordsInspected = 0;
  const records = [];
  if (dropLeadingFragment) {
    const newline = buffer.indexOf(10);
    if (newline === -1 || newline === buffer.length - 1) {
      safeDiagnostic(options, "oversized-record");
      return {
        records: [],
        incomplete: true,
        deadlineExceeded: false,
        recordsInspected,
        recordLimitExceeded: false
      };
    }
    start = newline + 1;
    incomplete = true;
  }
  while (start < buffer.length) {
    if (deadlineExpired(deadline)) {
      safeDiagnostic(options, "deadline-exceeded");
      return {
        records: [],
        incomplete: true,
        deadlineExceeded: true,
        recordsInspected,
        recordLimitExceeded: false
      };
    }
    const newline = buffer.indexOf(10, start);
    const isFinalFragment = newline === -1;
    const end = isFinalFragment ? buffer.length : newline;
    if (isFinalFragment && dropTrailingFragment) {
      if (mode === "tail") safeDiagnostic(options, "oversized-record");
      incomplete = true;
      break;
    }
    let line = buffer.subarray(start, end);
    if (line.at(-1) === 13) line = line.subarray(0, -1);
    const text = line.toString("utf8").trim();
    if (text) {
      if (options.maxInspectedRecords !== void 0 && recordsInspected >= options.maxInspectedRecords) {
        return {
          records,
          incomplete: true,
          deadlineExceeded: false,
          recordsInspected,
          recordLimitExceeded: true
        };
      }
      recordsInspected += 1;
      const parsed = safeParseLine(text);
      if (parsed.ok) {
        if (mode === "prefix") {
          if (records.length < options.maxRecords) records.push(parsed.value);
        } else {
          records.push(parsed.value);
          if (records.length > options.maxRecords) {
            records.shift();
            incomplete = true;
          }
        }
      } else {
        safeDiagnostic(options, "malformed-record");
        incomplete = true;
      }
    }
    if (mode === "prefix" && records.length >= options.maxRecords) {
      if (newline !== -1 && newline + 1 < buffer.length) incomplete = true;
      break;
    }
    if (isFinalFragment) break;
    start = newline + 1;
  }
  return {
    records,
    incomplete,
    deadlineExceeded: false,
    recordsInspected,
    recordLimitExceeded: false
  };
}
async function readMetadataRecordsBounded(transcriptPath, options) {
  validateBoundedReadOptions(options);
  const deadline = deadlineAt(options);
  const window = await readBoundedWindow(
    transcriptPath,
    options,
    "prefix",
    deadline
  );
  if (window === null) {
    return {
      records: [],
      incomplete: true,
      bytesRead: 0,
      recordsInspected: 0
    };
  }
  const parsed = parseBoundedLines(
    window.buffer,
    options,
    deadline,
    "prefix",
    false,
    window.fileSize > window.buffer.length && window.buffer.at(-1) !== 10
  );
  return {
    records: parsed.records,
    incomplete: window.fileSize > window.buffer.length || parsed.incomplete,
    bytesRead: window.buffer.length,
    recordsInspected: parsed.recordsInspected
  };
}
async function readRecords(transcriptPath) {
  const raw = await readFile(transcriptPath, "utf8");
  if (!raw) return [];
  const lines = raw.split(/\r?\n/);
  const records = [];
  const fileEndsWithNewline = raw.endsWith("\n") || raw.endsWith("\r\n");
  const lastIndex = lines.length - 1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const result = safeParseLine(line);
    if (result.ok) {
      records.push(result.value);
      continue;
    }
    const isLastToken = i === lastIndex;
    if (isLastToken && !fileEndsWithNewline) {
      console.warn(
        `[runtimes] Partial trailing line dropped from ${transcriptPath} (line ${i + 1}): ${result.reason}`
      );
    } else {
      console.warn(
        `[runtimes] Malformed JSONL line ${i + 1} in ${transcriptPath} skipped: ${result.reason}`
      );
    }
  }
  return records;
}
function claudeSessionIdFromRecord(record) {
  const message = isObject(record.message) ? record.message : record;
  return asString(record.sessionId) ?? asString(record.session_id) ?? asString(record.sessionID) ?? asString(message.sessionId) ?? asString(message.session_id);
}
function decodeCwdDirName(dirName) {
  if (!dirName.startsWith("-")) return null;
  return dirName.replace(/-/g, "/");
}
function codexSessionIdFromRecord(record) {
  const payload = isObject(record.payload) ? record.payload : record;
  return asString(record.sessionId) ?? asString(record.session_id) ?? asString(payload.sessionId) ?? asString(payload.session_id);
}
function consistentNonEmptyString(values) {
  let observed;
  for (const value of values) {
    if (typeof value !== "string" || value.length === 0) return void 0;
    if (observed !== void 0 && observed !== value) return void 0;
    observed = value;
  }
  return observed;
}
var CODEX_ROLLOUT_FILENAME_PATTERN = /^rollout-.+-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/iu;
function codexRolloutFilenameSessionId(transcriptPath) {
  return CODEX_ROLLOUT_FILENAME_PATTERN.exec(basename(transcriptPath))?.[1];
}
function firstCodexSessionHeader(records) {
  return records.find(
    (record) => record.type === "session_meta" && isObject(record.payload)
  );
}
function codexDirectParentValues(payload) {
  const values = [];
  if (Object.hasOwn(payload, "parent_thread_id")) {
    values.push(payload.parent_thread_id);
  }
  const source = isObject(payload.source) ? payload.source : void 0;
  const subagent = source && isObject(source.subagent) ? source.subagent : void 0;
  const threadSpawn = subagent && isObject(subagent.thread_spawn) ? subagent.thread_spawn : void 0;
  if (threadSpawn && Object.hasOwn(threadSpawn, "parent_thread_id")) {
    values.push(threadSpawn.parent_thread_id);
  }
  return values;
}
function codexLineageMetadata(firstHeader) {
  const payload = firstHeader.payload;
  if (!Object.hasOwn(payload, "id")) return {};
  const nativeSessionId = consistentNonEmptyString([payload.id]);
  if (nativeSessionId === void 0) return null;
  const rootSessionId = Object.hasOwn(payload, "session_id") ? consistentNonEmptyString([payload.session_id]) : void 0;
  const parentValues = codexDirectParentValues(payload);
  const parentSessionId = consistentNonEmptyString(parentValues);
  if (parentValues.length > 0 && parentSessionId === void 0) return null;
  const forkedFromSessionId = Object.hasOwn(payload, "forked_from_id") ? consistentNonEmptyString([payload.forked_from_id]) : void 0;
  const historyBoundary = payload.subagent_history_start_ordinal;
  const subagentHistoryStartOrdinal = Number.isSafeInteger(historyBoundary) && Number(historyBoundary) >= 0 ? Number(historyBoundary) : void 0;
  return {
    nativeSessionId,
    ...rootSessionId === void 0 ? {} : { rootSessionId },
    ...parentSessionId === void 0 ? {} : { parentSessionId },
    ...forkedFromSessionId === void 0 ? {} : { forkedFromSessionId },
    ...subagentHistoryStartOrdinal === void 0 ? {} : { subagentHistoryStartOrdinal }
  };
}
function claudeRecordLineage(records) {
  const result = [];
  for (const record of records) {
    if (!Object.hasOwn(record, "uuid")) continue;
    if (typeof record.uuid !== "string" || record.uuid.length === 0) {
      return void 0;
    }
    if (Object.hasOwn(record, "parentUuid") && record.parentUuid !== null && (typeof record.parentUuid !== "string" || record.parentUuid.length === 0)) {
      return void 0;
    }
    result.push({
      uuid: record.uuid,
      parentUuid: typeof record.parentUuid === "string" ? record.parentUuid : null
    });
  }
  return result.length === 0 ? void 0 : result;
}
async function extractMeta(runtime, transcriptPath) {
  const records = await readRecords(transcriptPath);
  return extractMetaFromRecords(runtime, records, transcriptPath);
}
function extractClaudeRecordedCwdFromRecords(records) {
  let recordedCwd = null;
  for (const record of records) {
    if (!Object.hasOwn(record, "cwd")) continue;
    const cwd = record.cwd;
    if (typeof cwd !== "string" || cwd.length === 0 || !isAbsolute(cwd)) {
      return null;
    }
    if (recordedCwd !== null && cwd !== recordedCwd) return null;
    recordedCwd = cwd;
  }
  return recordedCwd;
}
function extractCodexRecordedCwdFromRecords(records) {
  let recordedCwd = null;
  for (const record of records) {
    const values = [];
    if (Object.hasOwn(record, "cwd")) values.push(record.cwd);
    if (isObject(record.payload) && Object.hasOwn(record.payload, "cwd")) {
      values.push(record.payload.cwd);
    }
    for (const cwd of values) {
      if (typeof cwd !== "string" || cwd.length === 0 || !isAbsolute(cwd)) {
        return null;
      }
      if (recordedCwd !== null && cwd !== recordedCwd) return null;
      recordedCwd = cwd;
    }
  }
  return recordedCwd;
}
function extractMetaFromRecords(runtime, records, transcriptPath) {
  if (runtime === "claude-code") {
    let sessionId;
    for (const record of records) {
      const id = claudeSessionIdFromRecord(record);
      if (id) {
        sessionId = id;
        break;
      }
    }
    if (!sessionId) {
      sessionId = basename(transcriptPath).replace(/\.jsonl$/u, "");
    }
    const nativeSessionId = consistentNonEmptyString(
      records.filter((record) => Object.hasOwn(record, "sessionId")).map((record) => record.sessionId)
    );
    const exactRecordedCwd = extractClaudeRecordedCwdFromRecords(records);
    const recordLineage = claudeRecordLineage(records);
    const parentDirName = basename(dirname(transcriptPath));
    const recordedCwd = exactRecordedCwd ?? decodeCwdDirName(parentDirName);
    return {
      sessionId,
      recordedCwd,
      ...nativeSessionId === void 0 ? {} : { nativeSessionId },
      ...recordLineage === void 0 ? {} : { recordLineage }
    };
  }
  if (runtime === "codex") {
    const firstHeader = firstCodexSessionHeader(records);
    const lineage = firstHeader ? codexLineageMetadata(firstHeader) : {};
    if (lineage === null) return null;
    const nativeSessionId = lineage.nativeSessionId;
    const filenameSessionId = codexRolloutFilenameSessionId(transcriptPath);
    if (nativeSessionId !== void 0 && filenameSessionId !== void 0 && nativeSessionId.toLowerCase() !== filenameSessionId.toLowerCase()) {
      return null;
    }
    let sessionId = nativeSessionId;
    let recordedCwd = null;
    for (const record of records) {
      if (!sessionId) {
        const id = codexSessionIdFromRecord(record);
        if (id) sessionId = id;
      }
      if (recordedCwd === null) {
        const topLevelCwd = asString(record.cwd);
        const payloadCwd = isObject(record.payload) ? asString(record.payload.cwd) : void 0;
        const cwd = topLevelCwd ?? payloadCwd;
        if (cwd) recordedCwd = cwd;
      }
      if (sessionId && recordedCwd !== null) break;
    }
    if (!sessionId) {
      sessionId = basename(transcriptPath).replace(/\.jsonl$/u, "");
    }
    return { sessionId, recordedCwd, ...lineage };
  }
  if (runtime === "cursor") {
    const transcriptBase = basename(transcriptPath).replace(/\.jsonl$/u, "");
    const parentDirName = basename(dirname(transcriptPath));
    const sessionId = transcriptBase && !["transcript", "conversation", "messages"].includes(transcriptBase) ? transcriptBase : parentDirName;
    return { sessionId, recordedCwd: null };
  }
  throw new Error(`Unknown runtime: ${runtime}`);
}
function claudeAskUserQuestionEntry(role, block, recordIndex, opts) {
  const input = isObject(block.input) ? block.input : {};
  const questions = parseAskUserQuestions(input.questions);
  if (questions.length === 0) return null;
  return {
    role,
    text: formatAskUserQuestions(
      ASK_USER_TOOL_NAMES["claude-code"],
      questions,
      { includeDescriptions: opts.includeToolCalls }
    ),
    recordIndex,
    kind: "ask_user",
    toolName: ASK_USER_TOOL_NAMES["claude-code"]
  };
}
function claudeAskUserAnswerEntry(role, block, recordIndex, opts) {
  const toolName = ASK_USER_TOOL_NAMES["claude-code"];
  const result = isObject(opts.toolUseResult) ? opts.toolUseResult : null;
  const rawAnswers = result && isObject(result.answers) ? result.answers : null;
  if (result && rawAnswers) {
    const headerByPrompt = /* @__PURE__ */ new Map();
    for (const question of parseAskUserQuestions(result.questions)) {
      if (question.header) headerByPrompt.set(question.prompt, question.header);
    }
    const annotations = isObject(result.annotations) ? result.annotations : {};
    const answers = Object.entries(rawAnswers).flatMap(([prompt, value]) => {
      const answer = askUserAnswerText(value);
      if (!answer) return [];
      const annotation = annotations[prompt];
      const note = isObject(annotation) ? asString(annotation.notes) : void 0;
      return [
        {
          label: headerByPrompt.get(prompt) ?? prompt,
          answer,
          ...note ? { note } : {}
        }
      ];
    });
    if (answers.length > 0) {
      return {
        role,
        text: formatAskUserAnswers(toolName, answers),
        recordIndex,
        kind: "ask_user",
        toolName,
        // Claude has no auto-resolution: a recorded answer is the operator's.
        origin: "human"
      };
    }
  }
  const fallback = typeof block.content === "string" ? block.content : Array.isArray(block.content) ? block.content.filter(isObject).map((part) => asString(part.text) ?? "").filter(Boolean).join("\n") : "";
  if (!fallback) return null;
  return {
    role,
    text: `[${toolName} \u2192 answered] ${truncate(fallback, ASK_USER_ANSWER_LIMIT)}`,
    recordIndex,
    kind: "ask_user",
    toolName,
    origin: "human"
  };
}
function claudeEntriesFromContent(role, content, recordIndex, opts) {
  if (typeof content === "string") {
    if (!content) return [];
    if (isClaudeCommandMessageText(content)) {
      if (!opts.includeCommandMessages) return [];
      return [{ role, text: content, recordIndex, kind: "command_message" }];
    }
    return [messageEntry(role, content, recordIndex)];
  }
  if (!Array.isArray(content)) return [];
  return content.flatMap((block) => {
    if (!isObject(block)) return [];
    if (block.type === "tool_use") {
      if (asString(block.name) === ASK_USER_TOOL_NAMES["claude-code"]) {
        const entry = claudeAskUserQuestionEntry(
          role,
          block,
          recordIndex,
          opts
        );
        if (entry) return [entry];
      }
      if (!opts.includeToolCalls) return [];
      const name = asString(block.name) ?? "tool_use";
      const argsStr = stringifyArgs(block.input, TOOL_INPUT_LIMIT);
      return [
        {
          role,
          text: `[${name}] ${argsStr}`,
          recordIndex,
          kind: "tool_call",
          toolName: name
        }
      ];
    }
    if (block.type === "tool_result") {
      const toolUseId = asString(block.tool_use_id);
      const name = (toolUseId && opts.toolNameById?.get(toolUseId)) ?? "tool_result";
      if (name === ASK_USER_TOOL_NAMES["claude-code"]) {
        const entry = claudeAskUserAnswerEntry(role, block, recordIndex, opts);
        if (entry) return [entry];
      }
      if (!opts.includeToolResults) return [];
      let resultText = "";
      if (typeof block.content === "string") {
        resultText = truncate(block.content, TOOL_RESULT_LIMIT);
      } else if (Array.isArray(block.content)) {
        const parts = block.content.filter(isObject).map((b) => asString(b.text) ?? "").filter(Boolean);
        resultText = truncate(parts.join("\n"), TOOL_RESULT_LIMIT);
      }
      return [
        {
          role,
          text: `[${name} \u2192 result] ${resultText}`,
          recordIndex,
          kind: "tool_result",
          toolName: name
        }
      ];
    }
    const text = asString(block.text) ?? asString(block.content);
    if (text && isClaudeCommandMessageText(text)) {
      if (!opts.includeCommandMessages) return [];
      return [{ role, text, recordIndex, kind: "command_message" }];
    }
    return text ? [messageEntry(role, text, recordIndex)] : [];
  });
}
function normalizeClaudeCode(records, opts) {
  const includeToolCalls = opts.includeToolCalls ?? false;
  const includeToolResults = opts.includeToolResults ?? false;
  const includeCommandMessages = opts.includeCommandMessages ?? false;
  const toolNameById = /* @__PURE__ */ new Map();
  for (const record of records) {
    const message = isObject(record.message) ? record.message : record;
    const content = message.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (isObject(block) && block.type === "tool_use") {
        const id = asString(block.id);
        const name = asString(block.name);
        if (id && name) toolNameById.set(id, name);
      }
    }
  }
  const queuedContents = [];
  const deliveredQueuedContents = [];
  return records.flatMap((record, recordIndex) => {
    if (asString(record.type) === "queue-operation") {
      const operation = asString(record.operation);
      if (operation === "enqueue") {
        const content = asString(record.content);
        if (!content) return [];
        queuedContents.push(content);
        return [messageEntry("user", content, recordIndex, "queued-user")];
      }
      if (operation === "remove") {
        const content = asString(record.content);
        const queuedIndex = content ? queuedContents.indexOf(content) : queuedContents.length > 0 ? 0 : -1;
        if (queuedIndex !== -1) {
          const [deliveredContent] = queuedContents.splice(queuedIndex, 1);
          deliveredQueuedContents.push(deliveredContent);
        }
        return [];
      }
    }
    const attachment = record.attachment;
    if (isObject(attachment) && asString(attachment.type) === "queued_command") {
      const prompt = asString(attachment.prompt);
      if (!prompt) return [];
      const deliveredIndex = deliveredQueuedContents.indexOf(prompt);
      if (deliveredIndex !== -1) {
        deliveredQueuedContents.splice(deliveredIndex, 1);
        return [];
      }
      return [messageEntry("user", prompt, recordIndex, "queued-user")];
    }
    const message = isObject(record.message) ? record.message : record;
    const role = asString(message.role) ?? asString(record.role) ?? asString(record.type);
    if (role !== "assistant" && role !== "user") return [];
    return claudeEntriesFromContent(role, message.content, recordIndex, {
      includeToolCalls,
      includeToolResults,
      includeCommandMessages,
      toolNameById,
      toolUseResult: record.toolUseResult
    });
  });
}
function parseCodexFunctionArguments(value) {
  if (isObject(value)) return value;
  const raw = asString(value);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
function codexAskUserAnswerEntry(payload, recordIndex, labelById, autoResolvable) {
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
    role: "user",
    text: formatAskUserAnswers(toolName, answers),
    recordIndex,
    kind: "ask_user",
    toolName,
    // Only attribute the answer to the operator when the call could not have
    // been resolved by Codex's own timer. The recorded output is identical
    // either way, so an auto-resolvable call leaves origin unset.
    ...autoResolvable ? {} : { origin: "human" }
  };
}
function normalizeCodex(records, opts) {
  const includeToolCalls = opts.includeToolCalls ?? false;
  const askUserToolName = ASK_USER_TOOL_NAMES.codex;
  const askUserQuestionsByCallId = /* @__PURE__ */ new Map();
  const askUserLabelById = /* @__PURE__ */ new Map();
  const askUserAutoResolvableCallIds = /* @__PURE__ */ new Set();
  for (const record of records) {
    const payload = isObject(record.payload) ? record.payload : record;
    if (asString(payload.type) !== "function_call") continue;
    if ((asString(payload.name) ?? asString(record.name)) !== askUserToolName)
      continue;
    const callId = asString(payload.call_id) ?? asString(record.call_id);
    if (!callId) continue;
    const args = parseCodexFunctionArguments(
      payload.arguments ?? record.arguments
    );
    const questions = parseAskUserQuestions(args?.questions);
    if (questions.length === 0) continue;
    askUserQuestionsByCallId.set(callId, questions);
    const rawQuestions = Array.isArray(args?.questions) ? args.questions : [];
    const labelById = /* @__PURE__ */ new Map();
    for (const rawQuestion of rawQuestions) {
      if (!isObject(rawQuestion)) continue;
      const id = asString(rawQuestion.id);
      const label = asString(rawQuestion.header) ?? asString(rawQuestion.question) ?? asString(rawQuestion.prompt);
      if (id && label) labelById.set(id, label);
    }
    askUserLabelById.set(callId, labelById);
    const autoResolutionMs = args?.autoResolutionMs;
    if (typeof autoResolutionMs === "number" && autoResolutionMs > 0) {
      askUserAutoResolvableCallIds.add(callId);
    }
  }
  return records.flatMap((record, recordIndex) => {
    const payload = isObject(record.payload) ? record.payload : record;
    const payloadType = asString(payload.type) ?? asString(record.type);
    if (payloadType === "function_call_output") {
      const callId = asString(payload.call_id) ?? asString(record.call_id);
      if (!callId || !askUserQuestionsByCallId.has(callId)) return [];
      const entry = codexAskUserAnswerEntry(
        payload,
        recordIndex,
        askUserLabelById.get(callId) ?? /* @__PURE__ */ new Map(),
        askUserAutoResolvableCallIds.has(callId)
      );
      return entry ? [entry] : [];
    }
    if (payloadType === "function_call") {
      const name = asString(payload.name) ?? asString(record.name) ?? "function_call";
      const args = payload.arguments ?? record.arguments;
      if (name === askUserToolName) {
        const callId = asString(payload.call_id) ?? asString(record.call_id);
        const parsedArgs = parseCodexFunctionArguments(args);
        const questions = (callId ? askUserQuestionsByCallId.get(callId) : void 0) ?? parseAskUserQuestions(parsedArgs?.questions);
        if (questions.length > 0) {
          const autoResolutionMs = parsedArgs?.autoResolutionMs;
          const notes = typeof autoResolutionMs === "number" && autoResolutionMs > 0 ? [
            `auto-resolves after ${Math.round(autoResolutionMs / 1e3)}s; a recorded answer may be the default rather than an operator choice`
          ] : void 0;
          return [
            {
              role: "assistant",
              text: formatAskUserQuestions(askUserToolName, questions, {
                includeDescriptions: includeToolCalls,
                notes
              }),
              recordIndex,
              kind: "ask_user",
              toolName: askUserToolName
            }
          ];
        }
      }
      if (!includeToolCalls) return [];
      const argsStr = stringifyArgs(args, TOOL_INPUT_LIMIT);
      return [
        {
          role: "assistant",
          text: `[${name}] ${argsStr}`,
          recordIndex,
          kind: "tool_call",
          toolName: name
        }
      ];
    }
    if (payloadType !== "message") return [];
    const role = asString(payload.role);
    if (role !== "assistant" && role !== "user") return [];
    const content = payload.content;
    if (typeof content === "string") {
      return content ? [messageEntry(role, content, recordIndex)] : [];
    }
    if (!Array.isArray(content)) return [];
    return content.flatMap((block) => {
      if (!isObject(block)) return [];
      const text = asString(block.text) ?? asString(block.content);
      return text ? [messageEntry(role, text, recordIndex)] : [];
    });
  });
}
function cursorAskUserQuestionText(block, opts = {}) {
  if (asString(block.name) !== ASK_USER_TOOL_NAMES.cursor) return null;
  const input = isObject(block.input) ? block.input : {};
  const questions = parseAskUserQuestions(input.questions);
  if (questions.length === 0) return null;
  const title = asString(input.title);
  return formatAskUserQuestions(ASK_USER_TOOL_NAMES.cursor, questions, {
    includeDescriptions: opts.includeDescriptions ?? false,
    notes: ["selected option not recorded in Cursor transcripts"],
    ...title ? { title } : {}
  });
}
function cursorAskUserQuestionEntry(role, block, recordIndex, opts) {
  const text = cursorAskUserQuestionText(block, {
    includeDescriptions: opts.includeDescriptions
  });
  if (!text) return null;
  return {
    role,
    text,
    recordIndex,
    kind: "ask_user",
    toolName: ASK_USER_TOOL_NAMES.cursor
  };
}
function normalizeCursor(records, opts) {
  const includeToolCalls = opts.includeToolCalls ?? false;
  const entries = [];
  let turnStart = 0;
  const normalizeRecord = (record, recordIndex) => {
    const role = asString(record.role);
    if (role !== "assistant" && role !== "user") return [];
    const message = isObject(record.message) ? record.message : record;
    const content = message.content;
    if (typeof content === "string") {
      return content ? [messageEntry(role, content, recordIndex)] : [];
    }
    if (!Array.isArray(content)) return [];
    return content.flatMap((block) => {
      if (!isObject(block)) return [];
      if (block.type === "tool_use") {
        if (role === "assistant" && asString(block.name) === ASK_USER_TOOL_NAMES.cursor) {
          const entry = cursorAskUserQuestionEntry(role, block, recordIndex, {
            includeDescriptions: includeToolCalls
          });
          if (entry) return [entry];
        }
        if (!includeToolCalls) return [];
        const name = asString(block.name) ?? "tool_use";
        const argsStr = stringifyArgs(block.input, TOOL_INPUT_LIMIT);
        return [
          {
            role,
            text: `[${name}] ${argsStr}`,
            recordIndex,
            kind: "tool_call",
            toolName: name
          }
        ];
      }
      const text = asString(block.text) ?? asString(block.content);
      return text ? [messageEntry(role, text, recordIndex)] : [];
    });
  };
  records.forEach((record, recordIndex) => {
    if (record.type !== "turn_ended") return;
    const status = asString(record.status);
    const buffered = records.slice(turnStart, recordIndex).flatMap(
      (turnRecord, offset) => normalizeRecord(turnRecord, turnStart + offset)
    );
    const consumeAtTerminal = (entry) => ({
      ...entry,
      sourceRecordIndex: entry.sourceRecordIndex ?? entry.recordIndex,
      recordIndex
    });
    const userEntries = buffered.filter((entry) => entry.role === "user" && entry.kind !== "ask_user").map(consumeAtTerminal);
    const askUserEntries = buffered.filter((entry) => entry.kind === "ask_user").map(consumeAtTerminal);
    if (status === "success") {
      const toolEntries = includeToolCalls ? buffered.filter((entry) => entry.kind === "tool_call").map(consumeAtTerminal) : [];
      const finalAssistant = buffered.findLast(
        (entry) => entry.role === "assistant" && entry.kind === "message"
      );
      entries.push(...userEntries, ...toolEntries, ...askUserEntries);
      if (finalAssistant) {
        entries.push(consumeAtTerminal(finalAssistant));
      }
    } else {
      const label = status ?? "unknown";
      entries.push(...userEntries, ...askUserEntries, {
        role: "assistant",
        text: `[Cursor turn ended with status: ${label}]`,
        recordIndex,
        kind: "message",
        origin: "runtime-diagnostic"
      });
    }
    turnStart = recordIndex + 1;
  });
  if (turnStart < records.length) {
    const trailing = records.slice(turnStart).flatMap((record, offset) => normalizeRecord(record, turnStart + offset));
    if (trailing.some((entry) => entry.kind === "ask_user")) {
      entries.push(
        ...trailing.filter((entry) => {
          if (entry.kind === "ask_user") return true;
          if (entry.role !== "user") return false;
          return entry.origin !== "automatic-control" && entry.displayRole !== "automatic-control";
        })
      );
    }
  }
  return entries;
}
function normalizeEntries(runtime, records, opts = {}) {
  if (runtime === "claude-code") return normalizeClaudeCode(records, opts);
  if (runtime === "codex") return normalizeCodex(records, opts);
  if (runtime === "cursor") return normalizeCursor(records, opts);
  throw new Error(`Unknown runtime: ${runtime}`);
}

// src/skills/session-observer/src/lib/cursor-state.ts
import {
  chmod,
  link,
  mkdir,
  open as open3,
  readFile as readFile2,
  readdir,
  rename,
  stat,
  unlink
} from "node:fs/promises";
import { homedir as homedir2 } from "node:os";
import { join as join2 } from "node:path";
var SCHEMA_VERSION = 2;
var LOCK_RETRIES = 100;
var LOCK_INTERVAL_MS = 50;
var backupSequence = 0;
var lockSequence = 0;
var CursorStateRecoveryRequiredError = class extends Error {
  constructor(reason) {
    super(
      `cursor-state: ${reason} shared state requires destructive whole-store reset and replay; run session-observer state reset --runtime cursor; sibling Cursor sessions cannot be preserved`
    );
    this.reason = reason;
    this.name = "CursorStateRecoveryRequiredError";
  }
  reason;
  code = "CURSOR_STATE_RECOVERY_REQUIRED";
  recoveryScope = "cursor-store";
  recoveryOperation = "state reset --runtime cursor";
  recoveryCommand = "session-observer state reset --runtime cursor";
  destructive = true;
  preservesSiblingSessions = false;
};
function blockedContinuity(code, message, checkpoint) {
  return { status: "blocked", code, message, checkpoint };
}
function validateCursorContinuity(identity, scan, prior) {
  if (identity.runtime !== "cursor" || identity.strength !== "exact") {
    throw new TypeError("Cursor continuity requires an exact Cursor identity");
  }
  if (scan.file.device === null || scan.file.inode === null) {
    return blockedContinuity(
      "FILE_IDENTITY_UNAVAILABLE",
      "The transcript filesystem did not provide stable device and inode identity.",
      prior?.continuity ?? null
    );
  }
  if (prior === null) {
    return { status: "new", fromFrameIndex: 0 };
  }
  const checkpoint = prior.continuity;
  if (prior.indexBase !== "zero-based-jsonl-frame-index" || checkpoint.indexBase !== "zero-based-jsonl-frame-index" || prior.lastRecordIndex < checkpoint.nextFrameIndex) {
    return blockedContinuity(
      "INDEX_BASE_MISMATCH",
      "The saved Cursor position is not a consistent physical-frame checkpoint.",
      checkpoint
    );
  }
  if (prior.sessionId !== identity.sessionId || prior.canonicalCwd !== identity.canonicalCwd || prior.transcriptPath !== identity.canonicalTranscriptPath) {
    return blockedContinuity(
      "ROTATION_UNSUPPORTED",
      "The exact Cursor session, cwd, or canonical transcript path changed.",
      checkpoint
    );
  }
  if (checkpoint.device === null || checkpoint.inode === null) {
    return blockedContinuity(
      "FILE_IDENTITY_UNAVAILABLE",
      "The saved checkpoint lacks stable device or inode identity.",
      checkpoint
    );
  }
  if (scan.file.size < checkpoint.prefixBytes || scan.totalFrames < checkpoint.nextFrameIndex) {
    return blockedContinuity(
      "TRANSCRIPT_SHRANK",
      "The transcript is smaller than the previously observed checkpoint.",
      checkpoint
    );
  }
  if (scan.file.device !== checkpoint.device || scan.file.inode !== checkpoint.inode) {
    return blockedContinuity(
      "TRANSCRIPT_REPLACED",
      "The transcript file identity changed at the same canonical path.",
      checkpoint
    );
  }
  if (scan.safePrefixBytes < checkpoint.prefixBytes || scan.verifiedPrefixSha256 === null || scan.verifiedPrefixSha256 !== checkpoint.prefixSha256) {
    return blockedContinuity(
      "PREFIX_MISMATCH",
      "The previously verified transcript prefix no longer matches.",
      checkpoint
    );
  }
  return {
    status: "verified",
    fromFrameIndex: prior.lastRecordIndex
  };
}
function isErrnoException(error) {
  return error instanceof Error && "code" in error;
}
function isObject2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}
function isNullableNonNegativeInteger(value) {
  return value === null || isNonNegativeInteger(value);
}
function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
function isIntegerArray(value) {
  return Array.isArray(value) && value.every(isNonNegativeInteger);
}
function hasOnlyKeys(value, keys) {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}
function isCheckpoint(value) {
  return isObject2(value) && hasOnlyKeys(value, [
    "indexBase",
    "nextFrameIndex",
    "prefixBytes",
    "prefixSha256",
    "observedSize",
    "device",
    "inode"
  ]) && value.indexBase === "zero-based-jsonl-frame-index" && isNonNegativeInteger(value.nextFrameIndex) && isNonNegativeInteger(value.prefixBytes) && typeof value.prefixSha256 === "string" && /^[a-f0-9]{64}$/u.test(value.prefixSha256) && isNonNegativeInteger(value.observedSize) && value.prefixBytes <= value.observedSize && isNullableNonNegativeInteger(value.device) && isNullableNonNegativeInteger(value.inode);
}
function isDeliveryCheckpoint(expected, intended, reservedThroughFrameIndex, expectedNextFrameIndex) {
  return expected.device !== null && expected.inode !== null && intended.device === expected.device && intended.inode === expected.inode && intended.indexBase === expected.indexBase && reservedThroughFrameIndex >= expectedNextFrameIndex && intended.nextFrameIndex >= expected.nextFrameIndex && intended.nextFrameIndex <= reservedThroughFrameIndex + 1 && intended.prefixBytes >= expected.prefixBytes && (intended.prefixBytes > expected.prefixBytes || intended.prefixSha256 === expected.prefixSha256);
}
function isHashRecord(value) {
  return isObject2(value) && Object.values(value).every(
    (entry) => typeof entry === "string" && /^[a-f0-9]{64}$/u.test(entry)
  );
}
function isObservationStatus(value) {
  return isObject2(value) && hasOnlyKeys(value, [
    "engagement",
    "activity",
    "content",
    "lifecycle",
    "delivery",
    "health"
  ]) && ["engaged", "unengaged", "unknown"].includes(String(value.engagement)) && ["none", "human-input", "assistant-progress", "tool-activity"].includes(
    String(value.activity)
  ) && ["none", "buffered", "available", "suppressed"].includes(
    String(value.content)
  ) && [
    "none",
    "pending",
    "success",
    "aborted",
    "error",
    "cancelled",
    "unknown"
  ].includes(String(value.lifecycle)) && ["none", "reserved", "committed", "uncertain"].includes(
    String(value.delivery)
  ) && ["healthy", "blocked", "stale", "error", "unknown"].includes(
    String(value.health)
  );
}
function isOpenTurn(value) {
  return isObject2(value) && hasOnlyKeys(value, [
    "turnId",
    "fromFrameIndex",
    "observedThroughFrame",
    "deliveredEntryKeys",
    "deliveredEntryHashes",
    "assistantEntryKeys",
    "humanRecordIndexes",
    "toolRecordIndexes",
    "hasHumanInput",
    "hasAutomaticControlInput",
    "lifecycle"
  ]) && typeof value.turnId === "string" && isNonNegativeInteger(value.fromFrameIndex) && isNonNegativeInteger(value.observedThroughFrame) && isStringArray(value.deliveredEntryKeys) && (value.deliveredEntryHashes === void 0 || isHashRecord(value.deliveredEntryHashes) && Object.keys(value.deliveredEntryHashes).every(
    (entryKey) => value.deliveredEntryKeys.includes(entryKey)
  )) && isStringArray(value.assistantEntryKeys) && isIntegerArray(value.humanRecordIndexes) && isIntegerArray(value.toolRecordIndexes) && typeof value.hasHumanInput === "boolean" && typeof value.hasAutomaticControlInput === "boolean" && ["pending", "success", "aborted", "error", "cancelled", "unknown"].includes(
    String(value.lifecycle)
  );
}
function isStabilityCandidate(value) {
  return isObject2(value) && hasOnlyKeys(value, [
    "turnId",
    "fromFrameIndex",
    "throughFrameIndex",
    "entryKeys",
    "prefixBytes",
    "prefixSha256",
    "firstObservedAt",
    "confirmAfter",
    "confirmedAt"
  ]) && typeof value.turnId === "string" && isNonNegativeInteger(value.fromFrameIndex) && isNonNegativeInteger(value.throughFrameIndex) && isStringArray(value.entryKeys) && isNonNegativeInteger(value.prefixBytes) && typeof value.prefixSha256 === "string" && /^[a-f0-9]{64}$/u.test(value.prefixSha256) && typeof value.firstObservedAt === "string" && Number.isFinite(Date.parse(value.firstObservedAt)) && typeof value.confirmAfter === "string" && Number.isFinite(Date.parse(value.confirmAfter)) && (value.confirmedAt === null || typeof value.confirmedAt === "string" && Number.isFinite(Date.parse(value.confirmedAt)));
}
function isCandidateObservation(value) {
  return isObject2(value) && hasOnlyKeys(value, [
    "turnId",
    "fromFrameIndex",
    "throughFrameIndex",
    "entryKeys",
    "prefixBytes",
    "prefixSha256",
    "observedAt"
  ]) && typeof value.turnId === "string" && isNonNegativeInteger(value.fromFrameIndex) && isNonNegativeInteger(value.throughFrameIndex) && isStringArray(value.entryKeys) && isNonNegativeInteger(value.prefixBytes) && typeof value.prefixSha256 === "string" && /^[a-f0-9]{64}$/u.test(value.prefixSha256) && typeof value.observedAt === "string" && Number.isFinite(Date.parse(value.observedAt));
}
function isPendingDelivery(value) {
  return isObject2(value) && hasOnlyKeys(value, [
    "deliveryId",
    "canonicalCwd",
    "transcriptPath",
    "expectedNextFrameIndex",
    "expectedCheckpoint",
    "reservedThroughFrameIndex",
    "entryKeys",
    "entryHashes",
    "intendedCheckpoint",
    "reservedByPid",
    "reservedAt"
  ]) && typeof value.deliveryId === "string" && value.deliveryId.length > 0 && typeof value.canonicalCwd === "string" && value.canonicalCwd.length > 0 && typeof value.transcriptPath === "string" && value.transcriptPath.length > 0 && isNonNegativeInteger(value.expectedNextFrameIndex) && isCheckpoint(value.expectedCheckpoint) && value.expectedNextFrameIndex >= value.expectedCheckpoint.nextFrameIndex && isNonNegativeInteger(value.reservedThroughFrameIndex) && isStringArray(value.entryKeys) && (value.entryHashes === void 0 || isHashRecord(value.entryHashes) && Object.keys(value.entryHashes).every(
    (entryKey) => value.entryKeys.includes(entryKey)
  )) && isCheckpoint(value.intendedCheckpoint) && isDeliveryCheckpoint(
    value.expectedCheckpoint,
    value.intendedCheckpoint,
    value.reservedThroughFrameIndex,
    value.expectedNextFrameIndex
  ) && isNonNegativeInteger(value.reservedByPid) && value.reservedByPid > 0 && typeof value.reservedAt === "string" && Number.isFinite(Date.parse(value.reservedAt));
}
function isSessionEntry(value) {
  return isObject2(value) && hasOnlyKeys(value, [
    "runtime",
    "sessionId",
    "indexBase",
    "lastRecordIndex",
    "canonicalCwd",
    "transcriptPath",
    "continuity",
    "lastStatus",
    "openTurn",
    "stabilityCandidate",
    "pendingDelivery"
  ]) && value.runtime === "cursor" && typeof value.sessionId === "string" && value.sessionId.length > 0 && value.indexBase === "zero-based-jsonl-frame-index" && isNonNegativeInteger(value.lastRecordIndex) && typeof value.canonicalCwd === "string" && value.canonicalCwd.length > 0 && typeof value.transcriptPath === "string" && value.transcriptPath.length > 0 && isCheckpoint(value.continuity) && value.lastRecordIndex >= value.continuity.nextFrameIndex && isObservationStatus(value.lastStatus) && (value.openTurn === null || isOpenTurn(value.openTurn)) && (value.stabilityCandidate === null || isStabilityCandidate(value.stabilityCandidate)) && (value.pendingDelivery === null || isPendingDelivery(value.pendingDelivery) && value.pendingDelivery.canonicalCwd === value.canonicalCwd && value.pendingDelivery.transcriptPath === value.transcriptPath && value.pendingDelivery.expectedNextFrameIndex === value.lastRecordIndex && checkpointsEqual(
    value.pendingDelivery.expectedCheckpoint,
    value.continuity
  ));
}
function isLegacyMarker(value) {
  return isObject2(value) && hasOnlyKeys(value, [
    "runtime",
    "sessionId",
    "legacyLastRecordIndex",
    "transcriptPath",
    "recordedCwd",
    "lastReadAt",
    "backupPath",
    "migrationStatus",
    "createdAt"
  ]) && value.runtime === "cursor" && typeof value.sessionId === "string" && value.sessionId.length > 0 && isNonNegativeInteger(value.legacyLastRecordIndex) && (value.transcriptPath === void 0 || typeof value.transcriptPath === "string") && (value.recordedCwd === void 0 || value.recordedCwd === null || typeof value.recordedCwd === "string") && (value.lastReadAt === void 0 || typeof value.lastReadAt === "string" && Number.isFinite(Date.parse(value.lastReadAt))) && typeof value.backupPath === "string" && ["marker-written", "legacy-removed", "complete"].includes(
    String(value.migrationStatus)
  ) && typeof value.createdAt === "string";
}
function isCursorState(value) {
  if (!isObject2(value) || !hasOnlyKeys(value, ["schemaVersion", "sessions", "legacyUnverified"]) || value.schemaVersion !== SCHEMA_VERSION || !isObject2(value.sessions) || !isObject2(value.legacyUnverified)) {
    return false;
  }
  return Object.entries(value.sessions).every(
    ([key, entry]) => isSessionEntry(entry) && key === cursorSessionKey(entry.sessionId)
  ) && Object.entries(value.legacyUnverified).every(
    ([key, marker]) => isLegacyMarker(marker) && key === cursorSessionKey(marker.sessionId)
  );
}
function emptyCursorState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    sessions: {},
    legacyUnverified: {}
  };
}
function stateDir() {
  return process.env.STATE_DIR ?? join2(homedir2(), ".local", "state", "session-observer");
}
function statePath(dir) {
  return join2(dir, "cursor-state.json");
}
function lockPath(dir) {
  return join2(dir, "cursor-state.json.lock");
}
function tempPath(dir) {
  return join2(dir, `cursor-state.json.${process.pid}.tmp`);
}
function backupPath(dir, label) {
  backupSequence += 1;
  return join2(
    dir,
    `cursor-state.json.${label}-${Date.now()}-${process.pid}-${backupSequence}.bak`
  );
}
async function ensurePrivateDirectory(dir) {
  await mkdir(dir, { recursive: true, mode: 448 });
  await chmod(dir, 448);
}
function sleep(ms) {
  return new Promise((resolve3) => setTimeout(resolve3, ms));
}
function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !isErrnoException(error) || error.code !== "ESRCH";
  }
}
function lockOwnerPid(owner) {
  if (!/^[1-9]\d*$/u.test(owner) && !/^[1-9]\d*:\d+:[1-9]\d*$/u.test(owner)) {
    return null;
  }
  const pid = Number(owner.split(":", 1)[0]);
  return Number.isSafeInteger(pid) && pid > 0 ? pid : null;
}
function lockOwnersPath(path) {
  return `${path}.owners`;
}
function lockOwnerTokensPath(path) {
  return `${path}.owner-tokens`;
}
function contenderTicket(name) {
  const match = /^(\d{20})\.owner$/u.exec(name);
  if (!match) return null;
  const ticket = Number(match[1]);
  return Number.isSafeInteger(ticket) ? ticket : null;
}
function privateTokenPid(name) {
  const match = /^([1-9]\d*)-\d+-[1-9]\d*\.token$/u.exec(name);
  if (!match) return null;
  const pid = Number(match[1]);
  return Number.isSafeInteger(pid) ? pid : null;
}
async function cleanupAbandonedPrivateTokens(path) {
  const tokens = lockOwnerTokensPath(path);
  let names;
  try {
    names = await readdir(tokens);
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") return;
    throw error;
  }
  for (const name of names) {
    const pid = privateTokenPid(name);
    if (pid === null || processIsAlive(pid)) continue;
    await unlink(join2(tokens, name)).catch((error) => {
      if (!isErrnoException(error) || error.code !== "ENOENT") throw error;
    });
  }
}
async function createLockContender(path, owner, options = {}) {
  const owners = lockOwnersPath(path);
  const tokens = lockOwnerTokensPath(path);
  await mkdir(owners, { recursive: true, mode: 448 });
  await mkdir(tokens, { recursive: true, mode: 448 });
  await cleanupAbandonedPrivateTokens(path);
  const privatePath = join2(tokens, `${owner.replaceAll(":", "-")}.token`);
  let handle;
  try {
    handle = await open3(privatePath, "wx", 384);
    await options.onLockPublicationBoundary?.("private-created");
    await handle.writeFile(owner, "utf8");
    await options.onLockPublicationBoundary?.("token-written");
    await handle.datasync();
    await options.onLockPublicationBoundary?.("token-synced");
    await handle.close();
    handle = void 0;
    for (let attempt = 0; attempt < LOCK_RETRIES; attempt += 1) {
      const names = await readdir(owners);
      let maximum = 0;
      for (const name of names) {
        const ticket = contenderTicket(name);
        if (ticket === null) {
          throw new Error(`cursor-state: invalid lock contender ${name}`);
        }
        maximum = Math.max(maximum, ticket);
      }
      const next = maximum + 1;
      if (!Number.isSafeInteger(next)) {
        throw new Error("cursor-state: lock contender sequence exhausted");
      }
      const ownerPath = join2(owners, `${String(next).padStart(20, "0")}.owner`);
      try {
        await link(privatePath, ownerPath);
        await unlink(privatePath).catch(() => void 0);
        return ownerPath;
      } catch (error) {
        if (!isErrnoException(error) || error.code !== "EEXIST") throw error;
      }
    }
    throw new Error("cursor-state: could not allocate lock contender");
  } finally {
    if (handle) await handle.close();
    await unlink(privatePath).catch(() => void 0);
  }
}
async function contenderOwnsTurn(path, ownerPath, owner) {
  const owners = lockOwnersPath(path);
  const live = [];
  for (const name of (await readdir(owners)).toSorted()) {
    if (contenderTicket(name) === null) return false;
    const contenderPath = join2(owners, name);
    let contenderOwner;
    try {
      contenderOwner = await readFile2(contenderPath, "utf8");
    } catch (error) {
      if (isErrnoException(error) && error.code === "ENOENT") continue;
      throw error;
    }
    const pid = lockOwnerPid(contenderOwner);
    if (pid === null) return false;
    if (!processIsAlive(pid)) {
      await unlink(contenderPath).catch((error) => {
        if (!isErrnoException(error) || error.code !== "ENOENT") throw error;
      });
      continue;
    }
    if (contenderPath === ownerPath && contenderOwner !== owner) return false;
    live.push(contenderPath);
  }
  return live[0] === ownerPath;
}
async function readLockGeneration(path) {
  try {
    const rawOwner = await readFile2(path, "utf8");
    const current = await stat(path);
    return { rawOwner, device: current.dev, inode: current.ino };
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") return null;
    throw error;
  }
}
function sameLockGeneration(left, right) {
  return right !== null && left.rawOwner === right.rawOwner && left.device === right.device && left.inode === right.inode;
}
async function acquireLock(path, options = {}) {
  const owner = `${process.pid}:${Date.now()}:${++lockSequence}`;
  const ownerPath = await createLockContender(path, owner, options);
  try {
    for (let attempt = 0; attempt < LOCK_RETRIES; attempt += 1) {
      if (!await contenderOwnsTurn(path, ownerPath, owner)) {
        await sleep(LOCK_INTERVAL_MS);
        continue;
      }
      try {
        await link(ownerPath, path);
        return { owner, ownerPath };
      } catch (error) {
        if (!isErrnoException(error) || error.code !== "EEXIST") throw error;
      }
      const observed = await readLockGeneration(path);
      if (observed === null) continue;
      const ownerPid = lockOwnerPid(observed.rawOwner);
      if (ownerPid === null || processIsAlive(ownerPid)) {
        await sleep(LOCK_INTERVAL_MS);
        continue;
      }
      const current = await readLockGeneration(path);
      if (!sameLockGeneration(observed, current)) continue;
      try {
        await unlink(path);
      } catch (error) {
        if (!isErrnoException(error) || error.code !== "ENOENT") throw error;
      }
    }
  } catch (error) {
    await unlink(ownerPath).catch(() => void 0);
    throw error;
  }
  await unlink(ownerPath).catch(() => void 0);
  throw new Error(
    `cursor-state: could not acquire lock after ${LOCK_RETRIES} retries`
  );
}
async function releaseLock(path, ownership) {
  try {
    if (await readFile2(path, "utf8") === ownership.owner) {
      await unlink(path);
    }
  } catch (error) {
    if (!isErrnoException(error) || error.code !== "ENOENT") throw error;
  }
  try {
    await unlink(ownership.ownerPath);
  } catch (error) {
    if (!isErrnoException(error) || error.code !== "ENOENT") throw error;
  }
}
async function writePrivateAtomic(path, temporaryPath, content) {
  let handle;
  try {
    handle = await open3(temporaryPath, "w", 384);
    await handle.writeFile(content, "utf8");
    await handle.datasync();
    await handle.close();
    handle = void 0;
    await rename(temporaryPath, path);
    await chmod(path, 384);
  } finally {
    if (handle) await handle.close();
    try {
      await unlink(temporaryPath);
    } catch {
    }
  }
}
async function writeBackup(dir, label, raw) {
  const destination = backupPath(dir, label);
  await writePrivateAtomic(destination, `${destination}.tmp`, raw);
}
async function readCursorState(dir) {
  let raw;
  try {
    raw = await readFile2(statePath(dir), "utf8");
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return emptyCursorState();
    }
    throw error;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await writeBackup(dir, "corrupt", raw);
    throw new CursorStateRecoveryRequiredError("corrupt");
  }
  if (!isCursorState(parsed)) {
    await writeBackup(dir, "schema", raw);
    throw new CursorStateRecoveryRequiredError("schema");
  }
  return parsed;
}
async function writeCursorState(dir, state) {
  if (!isCursorState(state)) {
    throw new TypeError("cursor-state: invalid schema v2 state");
  }
  await writePrivateAtomic(
    statePath(dir),
    tempPath(dir),
    JSON.stringify(state, null, 2)
  );
}
async function transactCursorState(transaction) {
  const dir = stateDir();
  await ensurePrivateDirectory(dir);
  const lock = lockPath(dir);
  const owner = await acquireLock(lock);
  try {
    const state = await readCursorState(dir);
    const result = transaction(state);
    if (result.write) await writeCursorState(dir, state);
    return result.value;
  } finally {
    await releaseLock(lock, owner);
  }
}
function checkpointsEqual(left, right) {
  return left.indexBase === right.indexBase && left.nextFrameIndex === right.nextFrameIndex && left.prefixBytes === right.prefixBytes && left.prefixSha256 === right.prefixSha256 && left.observedSize === right.observedSize && left.device === right.device && left.inode === right.inode;
}
function sameStringArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
function pendingDeliveriesEqual(left, right) {
  return left.deliveryId === right.deliveryId && left.canonicalCwd === right.canonicalCwd && left.transcriptPath === right.transcriptPath && left.expectedNextFrameIndex === right.expectedNextFrameIndex && checkpointsEqual(left.expectedCheckpoint, right.expectedCheckpoint) && left.reservedThroughFrameIndex === right.reservedThroughFrameIndex && sameStringArray(left.entryKeys, right.entryKeys) && JSON.stringify(left.entryHashes ?? {}) === JSON.stringify(right.entryHashes ?? {}) && checkpointsEqual(left.intendedCheckpoint, right.intendedCheckpoint) && left.reservedByPid === right.reservedByPid && left.reservedAt === right.reservedAt;
}
function sameStabilityBoundary(candidate, observation) {
  return candidate.turnId === observation.turnId && candidate.fromFrameIndex === observation.fromFrameIndex && candidate.throughFrameIndex === observation.throughFrameIndex && candidate.prefixBytes === observation.prefixBytes && candidate.prefixSha256 === observation.prefixSha256 && sameStringArray(candidate.entryKeys, observation.entryKeys);
}
function cursorSessionKey(sessionId) {
  return `cursor:${sessionId}`;
}
async function loadCursorState() {
  const dir = stateDir();
  await ensurePrivateDirectory(dir);
  const lock = lockPath(dir);
  const owner = await acquireLock(lock);
  try {
    return await readCursorState(dir);
  } finally {
    await releaseLock(lock, owner);
  }
}
async function mutateCursorState(mutate2, options = {}) {
  const dir = stateDir();
  await ensurePrivateDirectory(dir);
  const lock = lockPath(dir);
  const owner = await acquireLock(lock, options);
  try {
    const current = await readCursorState(dir);
    await options.onMutationBoundary?.("locked");
    const next = mutate2(current) ?? current;
    await writeCursorState(dir, next);
    await options.onMutationBoundary?.("written");
    return next;
  } finally {
    await releaseLock(lock, owner);
  }
}
async function getCursorSession(sessionId) {
  const state = await loadCursorState();
  return state.sessions[cursorSessionKey(sessionId)] ?? null;
}
async function setCursorSession(entry) {
  if (!isSessionEntry(entry)) {
    throw new TypeError("cursor-state: invalid Cursor session entry");
  }
  await mutateCursorState((state) => {
    const key = cursorSessionKey(entry.sessionId);
    if (state.sessions[key]) {
      throw new Error(
        "CURSOR_SESSION_ALREADY_EXISTS: use delivery checkpoint CAS or explicit reset/replay"
      );
    }
    state.sessions[key] = structuredClone(entry);
  });
}
async function reanchorCursorSession(input) {
  if (!input.sessionId || !isCheckpoint(input.expectedCheckpoint) || !isNonNegativeInteger(input.expectedLastRecordIndex) || !isCheckpoint(input.continuity) || input.continuity.nextFrameIndex > input.expectedLastRecordIndex) {
    throw new TypeError("cursor-state: invalid scoped continuity re-anchor");
  }
  return transactCursorState((state) => {
    const entry = state.sessions[cursorSessionKey(input.sessionId)];
    if (!entry || entry.pendingDelivery !== null || entry.lastRecordIndex !== input.expectedLastRecordIndex || !checkpointsEqual(entry.continuity, input.expectedCheckpoint) || entry.continuity.device !== input.continuity.device || entry.continuity.inode !== input.continuity.inode) {
      return { write: false, value: "stale" };
    }
    entry.continuity = structuredClone(input.continuity);
    entry.stabilityCandidate = null;
    entry.lastStatus = { ...entry.lastStatus, health: "healthy" };
    return { write: true, value: "reanchored" };
  });
}
async function checkpointCursorCandidate(input) {
  if (!Number.isSafeInteger(input.stabilityMs) || input.stabilityMs < 0 || !isCandidateObservation(input.observation)) {
    throw new TypeError("cursor-state: invalid stability observation");
  }
  return transactCursorState((state) => {
    const entry = state.sessions[cursorSessionKey(input.sessionId)];
    if (!entry) throw new Error("CURSOR_SESSION_NOT_FOUND");
    if (entry.pendingDelivery) throw new Error("DELIVERY_RESERVATION_ACTIVE");
    const observedAtMs = Date.parse(input.observation.observedAt);
    const existing = entry.stabilityCandidate;
    if (existing && sameStabilityBoundary(existing, input.observation)) {
      if (existing.confirmedAt !== null) {
        return {
          write: false,
          value: {
            status: "confirmed",
            entryKeys: [...existing.entryKeys]
          }
        };
      }
      if (observedAtMs < Date.parse(existing.confirmAfter)) {
        return {
          write: false,
          value: {
            status: "waiting",
            entryKeys: [...existing.entryKeys]
          }
        };
      }
      existing.confirmedAt = input.observation.observedAt;
      return {
        write: true,
        value: {
          status: "confirmed",
          entryKeys: [...existing.entryKeys]
        }
      };
    }
    const next = {
      turnId: input.observation.turnId,
      fromFrameIndex: input.observation.fromFrameIndex,
      throughFrameIndex: input.observation.throughFrameIndex,
      entryKeys: [...input.observation.entryKeys],
      prefixBytes: input.observation.prefixBytes,
      prefixSha256: input.observation.prefixSha256,
      firstObservedAt: input.observation.observedAt,
      confirmAfter: new Date(observedAtMs + input.stabilityMs).toISOString(),
      confirmedAt: null
    };
    entry.stabilityCandidate = next;
    return {
      write: true,
      value: {
        status: existing === null ? "staged" : "replaced",
        entryKeys: [...next.entryKeys]
      }
    };
  });
}
async function reserveCursorDelivery(input) {
  if (!isNonNegativeInteger(input.ownerPid) || input.ownerPid === 0 || !isCheckpoint(input.expected) || !isPendingDelivery(input.pending) || input.pending.reservedByPid !== input.ownerPid || !checkpointsEqual(input.pending.expectedCheckpoint, input.expected) || !isDeliveryCheckpoint(
    input.expected,
    input.pending.intendedCheckpoint,
    input.pending.reservedThroughFrameIndex,
    input.pending.expectedNextFrameIndex
  )) {
    throw new TypeError("cursor-state: invalid delivery reservation");
  }
  return transactCursorState((state) => {
    const entry = state.sessions[cursorSessionKey(input.sessionId)];
    if (!entry) return { write: false, value: "stale" };
    const existing = entry.pendingDelivery;
    if (existing) {
      if (existing.reservedByPid !== input.ownerPid) {
        return { write: false, value: "owner-conflict" };
      }
      const idempotent = pendingDeliveriesEqual(existing, input.pending) && checkpointsEqual(entry.continuity, input.expected);
      return {
        write: false,
        value: idempotent ? "reserved" : "owner-conflict"
      };
    }
    if (!checkpointsEqual(entry.continuity, input.expected)) {
      return { write: false, value: "stale" };
    }
    if (entry.lastRecordIndex !== input.pending.expectedNextFrameIndex) {
      return { write: false, value: "stale" };
    }
    if (input.pending.canonicalCwd !== entry.canonicalCwd || input.pending.transcriptPath !== entry.transcriptPath) {
      return { write: false, value: "stale" };
    }
    entry.pendingDelivery = structuredClone(input.pending);
    entry.lastStatus = { ...entry.lastStatus, delivery: "reserved" };
    return { write: true, value: "reserved" };
  });
}
async function commitCursorDelivery(input) {
  if (!input.deliveryId || !isSessionEntry(input.nextState) || input.nextState.sessionId !== input.sessionId || input.nextState.pendingDelivery !== null || input.nextState.stabilityCandidate !== null || input.nextState.lastStatus.delivery !== "committed") {
    throw new TypeError("cursor-state: invalid delivery commit");
  }
  return transactCursorState((state) => {
    const key = cursorSessionKey(input.sessionId);
    const current = state.sessions[key];
    const pending = current?.pendingDelivery;
    if (!current || !pending || pending.deliveryId !== input.deliveryId) {
      return { write: false, value: "stale" };
    }
    if (!checkpointsEqual(current.continuity, pending.expectedCheckpoint) || current.lastRecordIndex !== pending.expectedNextFrameIndex || current.canonicalCwd !== pending.canonicalCwd || current.transcriptPath !== pending.transcriptPath || input.nextState.canonicalCwd !== current.canonicalCwd || input.nextState.transcriptPath !== current.transcriptPath || !checkpointsEqual(
      pending.intendedCheckpoint,
      input.nextState.continuity
    ) || input.nextState.lastRecordIndex !== pending.reservedThroughFrameIndex + 1 || !isDeliveryCheckpoint(
      pending.expectedCheckpoint,
      pending.intendedCheckpoint,
      pending.reservedThroughFrameIndex,
      pending.expectedNextFrameIndex
    )) {
      return { write: false, value: "stale" };
    }
    state.sessions[key] = structuredClone(input.nextState);
    return { write: true, value: "committed" };
  });
}
async function abandonCursorDelivery(input) {
  if (!input.sessionId || !input.deliveryId || !isNonNegativeInteger(input.ownerPid) || input.ownerPid === 0) {
    throw new TypeError("cursor-state: invalid delivery abandonment");
  }
  return transactCursorState((state) => {
    const entry = state.sessions[cursorSessionKey(input.sessionId)];
    const pending = entry?.pendingDelivery;
    if (!entry || !pending || pending.deliveryId !== input.deliveryId) {
      return { write: false, value: "stale" };
    }
    if (pending.reservedByPid !== input.ownerPid) {
      return { write: false, value: "owner-conflict" };
    }
    if (entry.lastStatus.delivery === "uncertain") {
      return { write: false, value: "delivery-uncertain" };
    }
    entry.pendingDelivery = null;
    entry.lastStatus = { ...entry.lastStatus, delivery: "none" };
    return { write: true, value: "abandoned" };
  });
}
async function recoverCursorDelivery(sessionId) {
  return transactCursorState((state) => {
    const entry = state.sessions[cursorSessionKey(sessionId)];
    const pending = entry?.pendingDelivery;
    if (!entry || !pending) {
      return { write: false, value: { status: "none" } };
    }
    const value = {
      status: "delivery-uncertain",
      deliveryId: pending.deliveryId,
      entryKeys: [...pending.entryKeys],
      expectedNextFrameIndex: pending.expectedNextFrameIndex,
      reservedThroughFrameIndex: pending.reservedThroughFrameIndex
    };
    if (entry.lastStatus.delivery === "uncertain") {
      return { write: false, value };
    }
    entry.lastStatus = { ...entry.lastStatus, delivery: "uncertain" };
    return { write: true, value };
  });
}

// src/skills/session-observer/src/lib/digest.ts
import { createHash as createHash3 } from "node:crypto";

// src/shared/transcript/cursor-analysis.ts
import { createHash as createHash2 } from "node:crypto";
function cursorRenderTurnId(turn, sourceFrameIndex) {
  const humanFrameIndex = turn.humanRecordIndexes.findLast(
    (frameIndex) => frameIndex <= sourceFrameIndex
  );
  return `${turn.turnId}:render:${humanFrameIndex ?? turn.fromFrameIndex}`;
}
function isJsonObject2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function stringValue(value) {
  return typeof value === "string" ? value : null;
}
function identityScope(identity) {
  return createHash2("sha256").update(
    JSON.stringify([
      identity.runtime,
      identity.projectCwd,
      identity.sessionId,
      identity.canonicalTranscriptPath
    ])
  ).digest("hex");
}
function validateIdentity(identity) {
  if (identity.runtime !== "cursor") {
    throw new TypeError("runtime must be cursor");
  }
  for (const field of [
    "projectCwd",
    "sessionId",
    "canonicalTranscriptPath"
  ]) {
    if (!identity[field]?.trim()) {
      throw new TypeError(`${field} must be a non-empty string`);
    }
  }
}
function contentBlocks(record) {
  if (!isJsonObject2(record.message)) {
    return [{ blockIndex: 0, kind: "unsupported", text: "" }];
  }
  const message = record.message;
  const content = message.content;
  if (typeof content === "string") {
    return [{ blockIndex: 0, kind: "text", text: content }];
  }
  if (!Array.isArray(content)) {
    return [{ blockIndex: 0, kind: "unsupported", text: "" }];
  }
  return content.map((block, blockIndex) => {
    if (!isJsonObject2(block)) {
      return { blockIndex, kind: "unsupported", text: "" };
    }
    const type = stringValue(block.type);
    if (type === "tool_use") {
      const askUserText = cursorAskUserQuestionText(block);
      if (askUserText !== null) {
        return { blockIndex, kind: "ask-user", text: askUserText };
      }
      return { blockIndex, kind: "tool", text: "" };
    }
    const text = stringValue(block.text) ?? stringValue(block.content) ?? "";
    if (type === "runtime_diagnostic" || type === "diagnostic") {
      return { blockIndex, kind: "runtime-diagnostic", text };
    }
    if (type === "text") {
      return { blockIndex, kind: "text", text };
    }
    return { blockIndex, kind: "unsupported", text };
  });
}
function lifecycleState(status) {
  return status === "success" || status === "aborted" || status === "error" || status === "cancelled" ? status : "unknown";
}
function classifyAssistantText(block, hasAutomaticControlInput, hasHumanInput) {
  if (block.kind === "runtime-diagnostic") return "runtime-diagnostic";
  if (block.kind === "unsupported") return "unsupported";
  if (block.text.trim().length === 0) return "empty";
  if (isNoOpText(block.text)) return "no-op";
  if (parseAutomaticControlEnvelope(block.text) !== null || hasAutomaticControlInput && !hasHumanInput && isAutomaticControlAcknowledgement(block.text)) {
    return "automatic-control";
  }
  return "substantive";
}
function createCursorTurnAccumulator(identity, fromFrameIndex) {
  validateIdentity(identity);
  if (!Number.isSafeInteger(fromFrameIndex) || fromFrameIndex < 0) {
    throw new TypeError("fromFrameIndex must be a non-negative safe integer");
  }
  const scope = identityScope(identity);
  const turns = [];
  const metadataFrameIndexes = [];
  let nextTurnStart = fromFrameIndex;
  let current = null;
  let lastFrameIndex = -1;
  let blocked = false;
  let finished = false;
  const ensureTurn = (observedFrameIndex) => {
    if (current !== null) return current;
    const turnId = `cursor:${scope}:turn:${nextTurnStart}`;
    current = {
      turnId,
      fromFrameIndex: nextTurnStart,
      observedThroughFrame: observedFrameIndex,
      assistantRecords: [],
      humanRecordIndexes: [],
      toolRecordIndexes: [],
      hasAutomaticControlInput: false,
      hasHumanInput: false
    };
    return current;
  };
  const finishCurrentTurn = (lifecycle, terminalFrameIndex) => {
    if (current === null) return;
    const finalSubstantive = lifecycle === "success" ? current.assistantRecords.findLast(
      (record) => record.classification === "substantive"
    ) : void 0;
    turns.push({
      turnId: current.turnId,
      fromFrameIndex: current.fromFrameIndex,
      observedThroughFrame: current.observedThroughFrame,
      assistantRecords: current.assistantRecords,
      humanRecordIndexes: current.humanRecordIndexes,
      toolRecordIndexes: current.toolRecordIndexes,
      lifecycle,
      terminalFrameIndex,
      finalSubstantiveEntryKey: finalSubstantive?.entryKey ?? null
    });
    current = null;
  };
  return {
    onFrame(frame) {
      if (finished) {
        throw new Error("cannot add frames after analysis is finished");
      }
      if (!Number.isSafeInteger(frame.frameIndex) || frame.frameIndex <= lastFrameIndex) {
        throw new TypeError(
          "Cursor frames must have strictly increasing non-negative indexes"
        );
      }
      lastFrameIndex = frame.frameIndex;
      if (frame.parseState === "malformed" || frame.parseState === "partial") {
        blocked = true;
        return;
      }
      if (blocked || frame.frameIndex < fromFrameIndex) return;
      if (frame.parseState === "blank" || frame.record === null) {
        if (current !== null) {
          current.observedThroughFrame = frame.frameIndex;
        }
        return;
      }
      const record = frame.record;
      if (record.type === "turn_ended") {
        const turn2 = ensureTurn(frame.frameIndex);
        turn2.observedThroughFrame = frame.frameIndex;
        const lifecycle = lifecycleState(record.status);
        finishCurrentTurn(lifecycle, frame.frameIndex);
        nextTurnStart = frame.frameIndex + 1;
        return;
      }
      const role = stringValue(record.role);
      if (role !== "user" && role !== "assistant") {
        metadataFrameIndexes.push(frame.frameIndex);
        if (current !== null) {
          current.observedThroughFrame = frame.frameIndex;
        }
        return;
      }
      const turn = ensureTurn(frame.frameIndex);
      turn.observedThroughFrame = frame.frameIndex;
      const blocks = contentBlocks(record);
      if (blocks.some((block) => block.kind === "tool")) {
        turn.toolRecordIndexes.push(frame.frameIndex);
      }
      if (role === "user") {
        let automaticControl = false;
        let humanInput = false;
        for (const block of blocks) {
          if (block.kind !== "text" || block.text.trim().length === 0) {
            continue;
          }
          if (parseAutomaticControlEnvelope(block.text) !== null) {
            automaticControl = true;
          } else {
            humanInput = true;
          }
        }
        if (automaticControl) {
          turn.hasAutomaticControlInput = true;
        }
        if (humanInput) {
          turn.hasHumanInput = true;
          turn.humanRecordIndexes.push(frame.frameIndex);
        }
        return;
      }
      for (const block of blocks) {
        if (block.kind === "tool") continue;
        const classification = classifyAssistantText(
          block,
          turn.hasAutomaticControlInput,
          turn.hasHumanInput
        );
        turn.assistantRecords.push({
          entryKey: `${turn.turnId}:frame:${frame.frameIndex}:block:${block.blockIndex}`,
          turnId: turn.turnId,
          sourceFrameIndex: frame.frameIndex,
          blockIndex: block.blockIndex,
          role: "assistant",
          text: block.text,
          classification,
          ...block.kind === "ask-user" ? { askUser: true } : {}
        });
      }
    },
    finish(scan) {
      if (finished) {
        throw new Error("Cursor analysis can only be finished once");
      }
      finished = true;
      if (current !== null && scan.safeThroughFrame !== null && scan.safeThroughFrame >= current.fromFrameIndex) {
        current.observedThroughFrame = Math.max(
          current.observedThroughFrame,
          scan.safeThroughFrame
        );
        finishCurrentTurn("pending", null);
      }
      return {
        turns,
        metadataFrameIndexes,
        blockingFrame: scan.blockingFrame
      };
    }
  };
}

// src/skills/session-observer/src/lib/session-classifier.ts
function textStart(text) {
  return String(text ?? "").trimStart();
}
function isTitlePrompt(text) {
  return textStart(text).startsWith(
    "Generate a concise tab title for this coding chat.\nRules:"
  );
}
function isHiddenBootstrapUserText(text) {
  const normalized = textStart(text);
  return normalized.startsWith("# AGENTS.md instructions for ") || normalized.startsWith("<environment_context>") || normalized.startsWith("<skill>\n<name>") || normalized.startsWith("<permissions instructions>") || normalized.startsWith("<apps_instructions>") || normalized.startsWith("<stoa-profile ") || isTitlePrompt(normalized);
}
function isSyntheticForEngagement(entry) {
  if (entry.role !== "user") return false;
  return entry.kind === "command_message" || entry.origin === "automatic-control" || isHiddenBootstrapUserText(entry.text);
}
function publicBootstrapIndexes(indexes) {
  return [...indexes].toSorted((a, b) => a - b);
}
function entriesByRecordIndex(entries) {
  const byRecord = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    const existing = byRecord.get(entry.recordIndex) ?? [];
    existing.push(entry);
    byRecord.set(entry.recordIndex, existing);
  }
  return byRecord;
}
function visibleConversationEntries(entries) {
  return entries.filter(
    (entry) => entry.kind === "message" || entry.kind === "command_message" || entry.kind === "ask_user"
  );
}
function isOperatorAskUserAnswer(entry) {
  return entry.kind === "ask_user" && entry.role === "user" && entry.origin === "human";
}
function classifyTranscriptRecords(runtime, records) {
  const allEntries = normalizeEntries(runtime, records, {
    includeToolCalls: false,
    includeToolResults: false,
    includeCommandMessages: true
  });
  const byRecord = entriesByRecordIndex(allEntries);
  const bootstrapRecordIndexes = /* @__PURE__ */ new Set();
  let genuineUserMessages = 0;
  let syntheticUserMessages = 0;
  let assistantMessages = 0;
  let realMessageCount = 0;
  let operatorAskUserAnswers = 0;
  let pendingTitleAssistant = false;
  for (let recordIndex = 0; recordIndex < records.length; recordIndex++) {
    const entries = visibleConversationEntries(byRecord.get(recordIndex) ?? []);
    if (entries.length === 0) continue;
    if (pendingTitleAssistant && entries.every(
      (entry) => entry.role === "assistant" && entry.kind === "message"
    )) {
      bootstrapRecordIndexes.add(recordIndex);
      pendingTitleAssistant = false;
      continue;
    }
    pendingTitleAssistant = false;
    const userEntries = entries.filter((entry) => entry.role === "user");
    const hiddenBootstrapUserRecord = userEntries.length > 0 && entries.every((entry) => entry.role === "user") && userEntries.every((entry) => isHiddenBootstrapUserText(entry.text));
    if (hiddenBootstrapUserRecord) {
      bootstrapRecordIndexes.add(recordIndex);
      syntheticUserMessages += userEntries.length;
      if (userEntries.some((entry) => isTitlePrompt(entry.text))) {
        pendingTitleAssistant = true;
      }
      continue;
    }
    for (const entry of entries) {
      if (entry.role === "user") {
        if (isOperatorAskUserAnswer(entry)) {
          operatorAskUserAnswers++;
          realMessageCount++;
          continue;
        }
        if (isSyntheticForEngagement(entry)) {
          syntheticUserMessages++;
          continue;
        }
        if (entry.kind === "message") {
          genuineUserMessages++;
          realMessageCount++;
        }
      } else if (entry.role === "assistant" && (entry.kind === "message" || entry.kind === "ask_user")) {
        assistantMessages++;
        realMessageCount++;
      }
    }
  }
  const humanInputs = genuineUserMessages + operatorAskUserAnswers;
  const status = humanInputs > 0 ? "engaged" : "unengaged";
  return {
    status,
    engaged: status === "engaged",
    recordCount: records.length,
    genuineUserMessages,
    operatorAskUserAnswers,
    syntheticUserMessages,
    assistantMessages,
    realMessageCount,
    hasAssistantAndUser: humanInputs > 0 && assistantMessages > 0,
    bootstrapRecordIndexes: publicBootstrapIndexes(bootstrapRecordIndexes),
    bootstrapRecordCount: bootstrapRecordIndexes.size
  };
}
function engagementCandidateFields(classification) {
  return {
    engagement: classification,
    engagementStatus: classification.status,
    engaged: classification.engaged,
    recordCount: classification.recordCount,
    genuineUserMessages: classification.genuineUserMessages,
    assistantMessages: classification.assistantMessages,
    realMessageCount: classification.realMessageCount,
    hasAssistantAndUser: classification.hasAssistantAndUser,
    bootstrapRecordCount: classification.bootstrapRecordCount
  };
}

// src/skills/session-observer/src/lib/digest.ts
var SCHEMA_VERSION2 = 1;
var LARGE_OUTPUT_THRESHOLD = 2e4;
var AUTO_LARGE_DIGEST_TURNS = 8;
function applyTailSlice(entries, opts) {
  const { maxTurns, maxBytes } = opts;
  if (maxBytes && maxBytes > 0) {
    let cumBytes = 0;
    const result = [];
    for (let i = entries.length - 1; i >= 0; i--) {
      const entryBytes = Buffer.byteLength(entries[i].text || "", "utf8");
      if (cumBytes + entryBytes > maxBytes && result.length > 0) break;
      cumBytes += entryBytes;
      result.unshift(entries[i]);
    }
    return result;
  }
  if (maxTurns && maxTurns > 0) {
    const groups = entries.every(
      (entry) => typeof entry.renderTurnId === "string"
    ) ? groupByEntryKey(entries, "renderTurnId") : entries.every(
      (entry) => typeof entry.turnId === "string"
    ) ? groupByEntryKey(entries, "turnId") : groupByRole(entries);
    const tailGroups = groups.slice(-maxTurns);
    return tailGroups.flat();
  }
  return entries;
}
function renderedCharCount(entries) {
  return entries.reduce((sum, entry) => sum + (entry.text?.length ?? 0), 0);
}
function omittedUserMessageRecoveryPointers(entriesBeforeTailSlice, retainedEntries, transcriptPath) {
  const retained = new Set(retainedEntries);
  const seenRecordIndexes = /* @__PURE__ */ new Set();
  const pointers = [];
  for (const entry of entriesBeforeTailSlice) {
    const recoveryRecordIndex = entry.sourceRecordIndex ?? entry.recordIndex;
    if (retained.has(entry) || entry.role !== "user" || entry.origin === "automatic-control" || seenRecordIndexes.has(recoveryRecordIndex)) {
      continue;
    }
    seenRecordIndexes.add(recoveryRecordIndex);
    pointers.push({
      transcriptPath,
      indexBase: "zero-based-jsonl-record-index",
      recordIndex: recoveryRecordIndex
    });
  }
  return pointers;
}
function groupByRole(entries) {
  if (entries.length === 0) return [];
  const groups = [];
  let currentGroup = [entries[0]];
  for (let i = 1; i < entries.length; i++) {
    if ((entries[i].displayRole ?? entries[i].role) === (currentGroup[0].displayRole ?? currentGroup[0].role)) {
      currentGroup.push(entries[i]);
    } else {
      groups.push(currentGroup);
      currentGroup = [entries[i]];
    }
  }
  groups.push(currentGroup);
  return groups;
}
function groupByEntryKey(entries, key) {
  if (entries.length === 0) return [];
  const groupId = (entry) => entry[key];
  const groups = [];
  let currentGroup = [entries[0]];
  for (let i = 1; i < entries.length; i++) {
    if (groupId(entries[i]) === groupId(currentGroup[0])) {
      currentGroup.push(entries[i]);
    } else {
      groups.push(currentGroup);
      currentGroup = [entries[i]];
    }
  }
  groups.push(currentGroup);
  return groups;
}
function formatHeader(digest) {
  const {
    runtime,
    transcriptPath,
    recordedCwd,
    mode,
    range,
    accounting,
    filters,
    active,
    warnings
  } = digest;
  const lines = [];
  lines.push(`## session-observer digest`);
  lines.push("");
  lines.push(`**runtime:** ${runtime}`);
  lines.push(`**mode:** ${mode}`);
  if (recordedCwd) lines.push(`**cwd:** ${recordedCwd}`);
  lines.push(`**transcript:** ${transcriptPath}`);
  if (active) lines.push(`**status:** ACTIVE (modified < 60s ago)`);
  if (range.newRecords > 0) {
    lines.push(
      `**raw range (zero-based JSONL indices):** records ${range.fromIndex}\u2013${range.toIndex} of ${range.totalRecords}`
    );
  } else {
    lines.push(
      `**raw range (zero-based JSONL indices):** no new records at offset ${range.fromIndex} of ${range.totalRecords}`
    );
  }
  if (mode === "catch-up" && range.newRecords !== void 0) {
    lines.push(`**raw records consumed:** ${range.newRecords}`);
  }
  if (accounting?.rendered) {
    const { count, fromIndex, toIndex, askUserEntries } = accounting.rendered;
    const renderedRange = count > 0 ? `zero-based records ${fromIndex}\u2013${toIndex}` : "none";
    const askUserNote = askUserEntries > 0 ? `, including ${askUserEntries} ask-user` : "";
    lines.push(
      `**rendered messages:** ${count}${askUserNote} (${renderedRange})`
    );
  }
  if (accounting?.filtered) {
    const filtered = accounting.filtered;
    const filterParts2 = [];
    if (filtered.toolCalls > 0)
      filterParts2.push(`tool calls: ${filtered.toolCalls}`);
    if (filtered.toolResults > 0)
      filterParts2.push(`tool results: ${filtered.toolResults}`);
    if (filtered.commandMessages > 0)
      filterParts2.push(`command messages: ${filtered.commandMessages}`);
    if (filtered.bootstrapRecords > 0)
      filterParts2.push(`bootstrap records: ${filtered.bootstrapRecords}`);
    if (filtered.metadataRecords > 0)
      filterParts2.push(
        `metadata/non-message records: ${filtered.metadataRecords}`
      );
    if (filtered.tailSliceEntries > 0)
      filterParts2.push(`tail-sliced entries: ${filtered.tailSliceEntries}`);
    if (filterParts2.length > 0) {
      lines.push(`**filtered out:** ${filterParts2.join(" \xB7 ")}`);
    }
  }
  if (accounting.recovery.omittedUserMessages.length > 0) {
    const { transcriptPath: recoveryTranscriptPath, indexBase } = accounting.recovery.omittedUserMessages[0];
    const recordIndexes = accounting.recovery.omittedUserMessages.map(
      (pointer) => pointer.recordIndex
    );
    const indexDescription = indexBase === "zero-based-jsonl-record-index" ? "zero-based JSONL indices" : indexBase;
    lines.push(
      `**User-message recovery:** ${recoveryTranscriptPath} records ${recordIndexes.join(", ")} (${indexDescription}).`
    );
  }
  const filterParts = [];
  if (!filters.includeToolCalls) filterParts.push("tool calls excluded");
  if (!filters.includeToolResults) filterParts.push("tool results excluded");
  if (!filters.includeCommandMessages)
    filterParts.push("command messages excluded");
  if (filterParts.length > 0) {
    lines.push(`**filters:** ${filterParts.join(" \xB7 ")}`);
  }
  if (warnings && warnings.length > 0) {
    for (const w of warnings) {
      lines.push(`**warning:** ${w}`);
    }
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  return lines.join("\n");
}
function recoveryPointerKey(pointer) {
  return `${pointer.frameIndex}:${pointer.entryKey}`;
}
function addCursorRecoveryPointer(pointers, seen, pointer) {
  const key = recoveryPointerKey(pointer);
  if (seen.has(key)) return;
  seen.add(key);
  pointers.push(pointer);
}
function cursorRecoveryPointer(transcriptPath, frameIndex, entryKey) {
  return {
    transcriptPath,
    indexBase: "zero-based-jsonl-frame-index",
    frameIndex,
    entryKey
  };
}
function cursorEntry(record, renderTurnId, deliveryFrameIndex, availability) {
  return {
    role: "assistant",
    text: record.text,
    recordIndex: deliveryFrameIndex,
    sourceFrameIndex: record.sourceFrameIndex,
    // Questions are tagged structurally so JSON consumers can tell them from
    // assistant prose, matching how the v1 normalizer and the public docs
    // describe Cursor ask-user content.
    kind: record.askUser === true ? "ask_user" : "message",
    entryKey: record.entryKey,
    turnId: record.turnId,
    renderTurnId,
    availability
  };
}
function cursorEntryHash(text) {
  return createHash3("sha256").update(text).digest("hex");
}
function cursorRecordWasDelivered(record, stateTurn) {
  if (!stateTurn) return false;
  if (!stateTurn.deliveredEntryKeys.includes(record.entryKey)) return false;
  const deliveredHash = stateTurn.deliveredEntryHashes?.[record.entryKey];
  return deliveredHash === void 0 || deliveredHash === cursorEntryHash(record.text);
}
function finalRecordsByRenderTurn(turn, records) {
  const finalByGroup = /* @__PURE__ */ new Map();
  for (const record of records) {
    finalByGroup.set(cursorRenderTurnId(turn, record.sourceFrameIndex), record);
  }
  return [...finalByGroup.values()];
}
function isCursorBuildDigestOptions(opts) {
  return "cursorProjection" in opts && "cursorScan" in opts && "cursorAnalysis" in opts && "cursorIdentity" in opts && "cursorContinuity" in opts;
}
function cursorStateTurn(turn, opts) {
  const openTurn = opts.cursorState?.openTurn ?? null;
  if (openTurn === null) return null;
  if (openTurn.turnId === turn.turnId) return openTurn;
  if (turn.lifecycle !== "pending" && turn.assistantRecords.length === 0 && turn.terminalFrameIndex !== null && opts.cursorAnalysis.turns.find(
    (candidate) => candidate.terminalFrameIndex !== null
  ) === turn) {
    return openTurn;
  }
  return null;
}
function cursorEngagement(opts) {
  const humanFrames = /* @__PURE__ */ new Set();
  let assistantMessages = 0;
  let hasAutomaticControlInput = false;
  for (const turn of opts.cursorAnalysis.turns) {
    const stateTurn = cursorStateTurn(turn, opts);
    for (const frameIndex of turn.humanRecordIndexes) {
      humanFrames.add(frameIndex);
    }
    assistantMessages += Math.max(
      turn.assistantRecords.length,
      stateTurn?.assistantEntryKeys.length ?? 0
    );
    if (stateTurn) {
      for (const frameIndex of stateTurn.humanRecordIndexes) {
        humanFrames.add(frameIndex);
      }
      hasAutomaticControlInput ||= stateTurn.hasAutomaticControlInput;
    }
  }
  const genuineUserMessages = humanFrames.size;
  const syntheticUserMessages = hasAutomaticControlInput ? 1 : 0;
  const engaged = genuineUserMessages > 0 && assistantMessages > 0;
  return {
    status: engaged ? "engaged" : genuineUserMessages > 0 || assistantMessages > 0 || syntheticUserMessages > 0 ? "unengaged" : "unknown",
    engaged,
    recordCount: opts.cursorScan.totalFrames,
    genuineUserMessages,
    // Cursor records no ask-user answer at all, so there is never an
    // operator-attributable one to count here.
    operatorAskUserAnswers: 0,
    syntheticUserMessages,
    assistantMessages,
    realMessageCount: genuineUserMessages + assistantMessages,
    hasAssistantAndUser: engaged,
    bootstrapRecordIndexes: [],
    bootstrapRecordCount: 0
  };
}
function formatCursorHeader(digest) {
  const { status } = digest.cursorEvidence;
  const lines = [
    "## session-observer digest",
    "",
    `**runtime:** ${digest.runtime}`,
    `**mode:** ${digest.mode}`
  ];
  if (digest.recordedCwd) lines.push(`**cwd:** ${digest.recordedCwd}`);
  lines.push(`**transcript:** ${digest.transcriptPath}`);
  if (digest.active) lines.push("**status:** ACTIVE (modified < 60s ago)");
  const { range, accounting } = digest;
  if (range.newFrames > 0) {
    lines.push(
      `**raw range (zero-based JSONL frame indices):** frames ${range.fromIndex}\u2013${range.toIndex} of ${range.totalFrames}`
    );
  } else {
    lines.push(
      `**raw range (zero-based JSONL frame indices):** no consumed frames at offset ${range.fromIndex} of ${range.totalFrames}`
    );
  }
  lines.push(`**raw frames consumed:** ${range.newFrames}`);
  lines.push(`**rendered messages:** ${accounting.rendered.count}`);
  lines.push(`**engagement:** ${status.engagement}`);
  lines.push(`**activity:** ${status.activity}`);
  lines.push(`**content:** ${status.content}`);
  lines.push(`**lifecycle:** ${status.lifecycle}`);
  lines.push(`**delivery:** ${status.delivery}`);
  lines.push(`**health:** ${status.health}`);
  lines.push(`**projection:** ${digest.cursorEvidence.projection}`);
  lines.push(`**continuity:** ${digest.cursorEvidence.continuity}`);
  if (accounting.buffered.count > 0) {
    lines.push(
      `**buffered:** ${accounting.buffered.count} frame(s) from ${accounting.buffered.fromIndex} (${accounting.buffered.reason})`
    );
  }
  if (digest.cursorEvidence.blockingFrame) {
    const blocking = digest.cursorEvidence.blockingFrame;
    lines.push(
      `**blocking frame:** ${blocking.frameIndex} (${blocking.parseState}, bytes ${blocking.byteStart}\u2013${blocking.byteEnd})`
    );
  }
  for (const event of digest.cursorEvidence.lifecycleEvents) {
    lines.push(
      `**lifecycle event:** ${event.lifecycle} at frame ${event.terminalFrameIndex} (turn ${event.turnId}, final entry ${event.finalEntryKey ?? "none"}, previously observable ${event.contentPreviouslyObservable})`
    );
  }
  const recoveryPointers = [
    ...accounting.recovery.omittedUserMessages,
    ...accounting.recovery.omittedAssistantEntries
  ];
  if (recoveryPointers.length > 0) {
    lines.push(
      `**recovery pointers:** ${recoveryPointers.map((pointer) => `frame ${pointer.frameIndex} (${pointer.entryKey})`).join(" \xB7 ")}`
    );
  }
  for (const warning of digest.warnings) {
    lines.push(`**warning:** ${warning}`);
  }
  lines.push("", "---", "");
  return lines.join("\n");
}
function buildCursorDigest(transcriptPath, opts) {
  const { cursorScan: scan, cursorAnalysis: analysis } = opts;
  if (scan.indexBase !== "zero-based-jsonl-frame-index" || opts.cursorIdentity.runtime !== "cursor") {
    throw new TypeError("Cursor digest requires frame-index Cursor evidence");
  }
  const fromIndex = opts.fromIndex ?? opts.cursorState?.continuity.nextFrameIndex ?? 0;
  if (!Number.isSafeInteger(fromIndex) || fromIndex < 0) {
    throw new TypeError("Cursor digest fromIndex must be non-negative");
  }
  const safeNextIndex = Math.max(
    fromIndex,
    Math.min(
      scan.totalFrames,
      scan.safeThroughFrame === null ? 0 : scan.safeThroughFrame + 1
    )
  );
  let nextIndex = safeNextIndex;
  let stabilityWaitFrom = null;
  let latestLifecycle = "none";
  let hasAssistantActivity = false;
  let hasToolActivity = false;
  let hasHumanActivity = false;
  let suppressedContent = false;
  let unstableContent = 0;
  const entriesBeforeTailSlice = [];
  const lifecycleEvents = [];
  const omittedUserMessages = [];
  const omittedAssistantEntries = [];
  const seenUserPointers = /* @__PURE__ */ new Set();
  const seenAssistantPointers = /* @__PURE__ */ new Set();
  const renderGroups = /* @__PURE__ */ new Map();
  for (const turn of analysis.turns) {
    const stateTurn = cursorStateTurn(turn, opts);
    const turnId = stateTurn?.turnId ?? turn.turnId;
    const effectiveTurn = {
      ...turn,
      humanRecordIndexes: [
        .../* @__PURE__ */ new Set([
          ...turn.humanRecordIndexes,
          ...stateTurn?.humanRecordIndexes ?? []
        ])
      ].toSorted((left, right) => left - right)
    };
    const substantiveRecords = effectiveTurn.assistantRecords.filter(
      (record) => record.classification === "substantive"
    );
    for (const record of substantiveRecords) {
      const renderTurnId = cursorRenderTurnId(
        effectiveTurn,
        record.sourceFrameIndex
      );
      const userFrameIndex = effectiveTurn.humanRecordIndexes.findLast(
        (frameIndex) => frameIndex <= record.sourceFrameIndex
      );
      const group = renderGroups.get(renderTurnId) ?? {
        userFrameIndex: userFrameIndex ?? null,
        assistantRecords: []
      };
      group.assistantRecords.push(record);
      renderGroups.set(renderTurnId, group);
    }
    hasAssistantActivity ||= turn.assistantRecords.length > 0 || (stateTurn?.assistantEntryKeys.length ?? 0) > 0;
    hasToolActivity ||= turn.toolRecordIndexes.length > 0 || (stateTurn?.toolRecordIndexes.length ?? 0) > 0;
    hasHumanActivity ||= turn.humanRecordIndexes.length > 0 || (stateTurn?.humanRecordIndexes.length ?? 0) > 0;
    latestLifecycle = turn.lifecycle;
    if (turn.lifecycle === "pending") {
      if (opts.cursorProjection === "confirmed-completion") {
        stabilityWaitFrom = stabilityWaitFrom === null ? turn.fromFrameIndex : Math.min(stabilityWaitFrom, turn.fromFrameIndex);
        continue;
      }
      const candidate = opts.cursorState?.stabilityCandidate;
      const stableEntryKeys = candidate?.turnId === turnId && candidate.confirmedAt !== null ? new Set(candidate.entryKeys) : /* @__PURE__ */ new Set();
      for (const record of substantiveRecords) {
        if (cursorRecordWasDelivered(record, stateTurn)) continue;
        if (!stableEntryKeys.has(record.entryKey)) {
          unstableContent += 1;
          stabilityWaitFrom = stabilityWaitFrom === null ? record.sourceFrameIndex : Math.min(stabilityWaitFrom, record.sourceFrameIndex);
          continue;
        }
        entriesBeforeTailSlice.push(
          cursorEntry(
            record,
            cursorRenderTurnId(effectiveTurn, record.sourceFrameIndex),
            record.sourceFrameIndex,
            "pending-lifecycle"
          )
        );
      }
      continue;
    }
    const finalEntryKey = turn.finalSubstantiveEntryKey ?? (turn.lifecycle === "success" ? stateTurn?.assistantEntryKeys.at(-1) ?? null : null);
    lifecycleEvents.push({
      turnId,
      terminalFrameIndex: turn.terminalFrameIndex,
      lifecycle: turn.lifecycle,
      finalEntryKey,
      contentPreviouslyObservable: finalEntryKey !== null && (substantiveRecords.some(
        (record) => record.entryKey === finalEntryKey && cursorRecordWasDelivered(record, stateTurn)
      ) || substantiveRecords.length === 0 && (stateTurn?.deliveredEntryKeys.includes(finalEntryKey) ?? false))
    });
    const emitsAskUser = opts.cursorProjection === "observation";
    const emitAskUserRecords = (availability, alreadyRendered = /* @__PURE__ */ new Set()) => {
      if (!emitsAskUser) return;
      for (const record of substantiveRecords) {
        if (record.askUser !== true) continue;
        if (alreadyRendered.has(record.entryKey)) continue;
        if (cursorRecordWasDelivered(record, stateTurn)) continue;
        entriesBeforeTailSlice.push(
          cursorEntry(
            record,
            cursorRenderTurnId(effectiveTurn, record.sourceFrameIndex),
            record.sourceFrameIndex,
            availability
          )
        );
      }
    };
    if (turn.lifecycle !== "success") {
      emitAskUserRecords("terminal-incomplete");
      if (!emitsAskUser) {
        for (const record of substantiveRecords) {
          if (record.askUser !== true) continue;
          addCursorRecoveryPointer(
            omittedAssistantEntries,
            seenAssistantPointers,
            cursorRecoveryPointer(
              transcriptPath,
              record.sourceFrameIndex,
              record.entryKey
            )
          );
        }
      }
      suppressedContent ||= substantiveRecords.some(
        (record) => !emitsAskUser || record.askUser !== true
      ) || (stateTurn?.assistantEntryKeys.length ?? 0) > 0;
      continue;
    }
    const completedRecords = opts.cursorProjection === "confirmed-completion" ? substantiveRecords.filter(
      (record) => record.entryKey === finalEntryKey
    ) : finalRecordsByRenderTurn(effectiveTurn, substantiveRecords);
    const completedKeys = new Set(
      completedRecords.map((record) => record.entryKey)
    );
    emitAskUserRecords("completed", completedKeys);
    for (const record of completedRecords) {
      if (!emitsAskUser && record.askUser === true) {
        addCursorRecoveryPointer(
          omittedAssistantEntries,
          seenAssistantPointers,
          cursorRecoveryPointer(
            transcriptPath,
            record.sourceFrameIndex,
            record.entryKey
          )
        );
        continue;
      }
      const wasDelivered = cursorRecordWasDelivered(record, stateTurn);
      const deliveredHash = stateTurn?.deliveredEntryHashes?.[record.entryKey];
      const changedSinceDelivery = deliveredHash !== void 0 && deliveredHash !== cursorEntryHash(record.text);
      if (opts.cursorProjection === "observation" && (wasDelivered || record.sourceFrameIndex < fromIndex && !changedSinceDelivery)) {
        continue;
      }
      entriesBeforeTailSlice.push(
        cursorEntry(
          record,
          cursorRenderTurnId(effectiveTurn, record.sourceFrameIndex),
          turn.terminalFrameIndex,
          "completed"
        )
      );
    }
  }
  if (stabilityWaitFrom !== null) {
    nextIndex = Math.min(nextIndex, stabilityWaitFrom);
  }
  let entries = applyTailSlice(entriesBeforeTailSlice, {
    maxTurns: opts.maxTurns,
    maxBytes: opts.maxBytes
  });
  const explicitTailSlice = Boolean(
    opts.maxTurns && opts.maxTurns > 0 || opts.maxBytes && opts.maxBytes > 0
  );
  let usedLargeDigestFallback = false;
  if (!explicitTailSlice && renderedCharCount(entries) > LARGE_OUTPUT_THRESHOLD) {
    entries = applyTailSlice(entries, { maxTurns: AUTO_LARGE_DIGEST_TURNS });
    usedLargeDigestFallback = true;
  }
  const retainedEntriesByGroup = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    const renderTurnId = entry.renderTurnId ?? entry.turnId;
    const entryKeys = retainedEntriesByGroup.get(renderTurnId) ?? /* @__PURE__ */ new Set();
    entryKeys.add(entry.entryKey);
    retainedEntriesByGroup.set(renderTurnId, entryKeys);
  }
  for (const [renderTurnId, retainedEntryKeys] of retainedEntriesByGroup) {
    const group = renderGroups.get(renderTurnId);
    if (!group) continue;
    if (group.userFrameIndex !== null) {
      addCursorRecoveryPointer(
        omittedUserMessages,
        seenUserPointers,
        cursorRecoveryPointer(
          transcriptPath,
          group.userFrameIndex,
          `${renderTurnId.replace(/:render:\d+$/u, "")}:frame:${group.userFrameIndex}:user`
        )
      );
    }
    const omittedAssistant = group.assistantRecords.findLast(
      (record) => !retainedEntryKeys.has(record.entryKey)
    );
    if (omittedAssistant) {
      addCursorRecoveryPointer(
        omittedAssistantEntries,
        seenAssistantPointers,
        cursorRecoveryPointer(
          transcriptPath,
          omittedAssistant.sourceFrameIndex,
          omittedAssistant.entryKey
        )
      );
    }
  }
  const blockingFrame = scan.blockingFrame ?? analysis.blockingFrame;
  const blockingReason = blockingFrame !== null && blockingFrame.frameIndex <= nextIndex ? blockingFrame.parseState : null;
  const bufferedReason = stabilityWaitFrom !== null && (blockingFrame === null || stabilityWaitFrom < blockingFrame.frameIndex) ? "stability-wait" : blockingReason;
  const bufferedCount = Math.max(0, scan.totalFrames - nextIndex);
  const bufferedFromIndex = bufferedCount > 0 ? nextIndex : null;
  const renderedFromIndex = entries.length > 0 ? Math.min(...entries.map((entry) => entry.recordIndex)) : null;
  const renderedToIndex = entries.length > 0 ? Math.max(...entries.map((entry) => entry.recordIndex)) : null;
  const rawCount = Math.max(0, nextIndex - fromIndex);
  const rawToIndex = rawCount > 0 ? nextIndex - 1 : null;
  const inRawRange = (frameIndex) => frameIndex >= fromIndex && frameIndex < nextIndex;
  const toolFrames = /* @__PURE__ */ new Set();
  let automaticControls = 0;
  let emptyOrNoOp = 0;
  for (const turn of analysis.turns) {
    for (const frameIndex of turn.toolRecordIndexes) {
      if (inRawRange(frameIndex)) toolFrames.add(frameIndex);
    }
    for (const record of turn.assistantRecords) {
      if (!inRawRange(record.sourceFrameIndex)) continue;
      if (record.classification === "automatic-control") {
        automaticControls += 1;
      } else if (record.classification === "empty" || record.classification === "no-op") {
        emptyOrNoOp += 1;
      }
    }
  }
  const accounting = {
    indexBase: "zero-based-jsonl-frame-index",
    raw: {
      fromIndex,
      toIndex: rawToIndex,
      count: rawCount,
      nextIndex,
      totalFrames: scan.totalFrames
    },
    rendered: {
      count: entries.length,
      fromIndex: renderedFromIndex,
      toIndex: renderedToIndex
    },
    filtered: {
      toolCalls: toolFrames.size,
      automaticControls,
      emptyOrNoOp,
      metadataFrames: analysis.metadataFrameIndexes.filter(inRawRange).length,
      unstableContent
    },
    buffered: {
      fromIndex: bufferedFromIndex,
      count: bufferedCount,
      reason: bufferedCount > 0 ? bufferedReason : null
    },
    recovery: {
      omittedUserMessages,
      omittedAssistantEntries
    }
  };
  const warnings = [...opts.warnings ?? []];
  if (usedLargeDigestFallback) {
    warnings.push(
      `Large digest fallback: rendered content exceeded ${LARGE_OUTPUT_THRESHOLD.toLocaleString()} chars; showing the last ${AUTO_LARGE_DIGEST_TURNS} user-delimited Cursor turn groups. Use --max-turns or --max-bytes for a different view.`
    );
  }
  for (const event of lifecycleEvents) {
    if (event.lifecycle !== "success") {
      warnings.push(
        `Cursor lifecycle ${event.lifecycle} at frame ${event.terminalFrameIndex}; observed content did not become a successful completion.`
      );
    }
  }
  if (blockingFrame) {
    warnings.push(
      blockingFrame.parseState === "malformed" ? `Cursor transcript is blocked by malformed frame ${blockingFrame.frameIndex}.` : `Cursor transcript has a partial frame at ${blockingFrame.frameIndex}.`
    );
  }
  const engagement = cursorEngagement(opts);
  const content = entries.length ? "available" : suppressedContent ? "suppressed" : bufferedCount > 0 ? "buffered" : "none";
  const status = {
    engagement: engagement.status,
    activity: hasAssistantActivity ? "assistant-progress" : hasToolActivity ? "tool-activity" : hasHumanActivity ? "human-input" : "none",
    content,
    lifecycle: latestLifecycle,
    delivery: opts.cursorState?.pendingDelivery !== null && opts.cursorState?.pendingDelivery !== void 0 ? "uncertain" : opts.cursorState?.lastStatus.delivery === "uncertain" ? "uncertain" : "none",
    health: blockingFrame?.parseState === "malformed" ? "blocked" : "healthy"
  };
  const filters = {
    includeToolCalls: opts.includeToolCalls ?? false,
    includeToolResults: opts.includeToolResults ?? false,
    includeCommandMessages: opts.includeCommandMessages ?? false
  };
  return {
    schemaVersion: 2,
    runtime: "cursor",
    sessionId: opts.sessionId ?? opts.cursorIdentity.sessionId,
    transcriptPath,
    recordedCwd: opts.recordedCwd ?? opts.cursorIdentity.canonicalCwd,
    matchedTier: opts.matchedTier ?? null,
    widenedFrom: opts.widenedFrom ?? null,
    active: opts.active ?? false,
    engagement,
    mode: opts.mode ?? "review",
    range: {
      indexBase: "zero-based-jsonl-frame-index",
      fromIndex,
      toIndex: rawToIndex,
      nextIndex,
      totalFrames: scan.totalFrames,
      renderedFromIndex,
      renderedToIndex,
      newFrames: rawCount
    },
    accounting,
    entries,
    filters,
    warnings,
    fallbacks: opts.fallbacks ?? [],
    cursorEvidence: {
      projection: opts.cursorProjection,
      continuity: opts.cursorContinuity,
      status,
      lifecycleEvents,
      bufferedFromFrame: bufferedFromIndex,
      blockingFrame
    }
  };
}
async function buildDigest(runtime, transcriptPath, opts = {}) {
  if (runtime === "cursor" && isCursorBuildDigestOptions(opts)) {
    return buildCursorDigest(transcriptPath, opts);
  }
  const {
    fromIndex = 0,
    mode = "review",
    includeToolCalls = false,
    includeToolResults = false,
    includeCommandMessages = false,
    maxTurns,
    maxBytes,
    fallbacks = []
  } = opts;
  const warnings = [...opts.warnings ?? []];
  const records = await readRecords(transcriptPath);
  const totalRecords = records.length;
  const engagement = classifyTranscriptRecords(runtime, records);
  const bootstrapRecordIndexes = new Set(engagement.bootstrapRecordIndexes);
  let sessionId = opts.sessionId;
  let recordedCwd = opts.recordedCwd ?? null;
  if (!sessionId || recordedCwd === void 0) {
    try {
      const meta = await extractMeta(runtime, transcriptPath);
      if (!sessionId) sessionId = meta?.sessionId ?? "unknown";
      if (recordedCwd === null && meta?.recordedCwd)
        recordedCwd = meta.recordedCwd;
    } catch {
      if (!sessionId) sessionId = "unknown";
    }
  }
  sessionId ??= "unknown";
  const effectiveFromIndex = fromIndex > totalRecords ? 0 : fromIndex;
  if (fromIndex > totalRecords && totalRecords > 0) {
    warnings.push(
      `Transcript shrank (stored offset ${fromIndex} > totalRecords ${totalRecords}); reset to 0.`
    );
  }
  const rawFromIndex = effectiveFromIndex;
  const rawToIndex = totalRecords > rawFromIndex ? totalRecords - 1 : rawFromIndex;
  const rawCount = Math.max(0, totalRecords - rawFromIndex);
  const allEntriesWithToolsBeforeBootstrap = normalizeEntries(
    runtime,
    records,
    {
      includeToolCalls: true,
      includeToolResults: true,
      includeCommandMessages: true
    }
  );
  const allEntriesBeforeBootstrap = normalizeEntries(runtime, records, {
    includeToolCalls,
    includeToolResults,
    includeCommandMessages
  });
  const allEntriesWithTools = allEntriesWithToolsBeforeBootstrap.filter(
    (e) => !bootstrapRecordIndexes.has(e.recordIndex)
  );
  const allEntries = allEntriesBeforeBootstrap.filter(
    (e) => !bootstrapRecordIndexes.has(e.recordIndex)
  );
  const entriesBeforeTailSlice = allEntries.filter(
    (e) => e.recordIndex >= effectiveFromIndex
  );
  let filteredEntries = entriesBeforeTailSlice;
  filteredEntries = applyTailSlice(filteredEntries, { maxTurns, maxBytes });
  let autoLargeDigest = null;
  const explicitTailSlice = Boolean(
    maxTurns && maxTurns > 0 || maxBytes && maxBytes > 0
  );
  if (!explicitTailSlice && renderedCharCount(filteredEntries) > LARGE_OUTPUT_THRESHOLD) {
    const beforeCount = filteredEntries.length;
    filteredEntries = applyTailSlice(filteredEntries, {
      maxTurns: AUTO_LARGE_DIGEST_TURNS
    });
    autoLargeDigest = {
      thresholdChars: LARGE_OUTPUT_THRESHOLD,
      retainedTurnGroups: AUTO_LARGE_DIGEST_TURNS,
      originalRenderedMessages: beforeCount,
      retainedRenderedMessages: filteredEntries.length,
      omittedRenderedMessages: Math.max(
        0,
        beforeCount - filteredEntries.length
      )
    };
    warnings.push(
      `Large digest fallback: rendered content exceeded ${LARGE_OUTPUT_THRESHOLD.toLocaleString()} chars; showing the last ${AUTO_LARGE_DIGEST_TURNS} user/assistant turn groups. Use --max-turns, --max-bytes, or --include-command-messages for a different view.`
    );
  }
  const renderedFromIndex = filteredEntries.length > 0 ? Math.min(...filteredEntries.map((e) => e.recordIndex)) : null;
  const renderedToIndex = filteredEntries.length > 0 ? Math.max(...filteredEntries.map((e) => e.recordIndex)) : null;
  const range = {
    indexBase: "zero-based-jsonl-record-index",
    fromIndex: rawFromIndex,
    toIndex: rawToIndex,
    nextIndex: totalRecords,
    totalRecords,
    renderedFromIndex,
    renderedToIndex,
    newRecords: rawCount
  };
  const filters = {
    includeToolCalls,
    includeToolResults,
    includeCommandMessages
  };
  const fullEntriesInRawRange = allEntriesWithTools.filter(
    (e) => e.recordIndex >= rawFromIndex
  );
  const fullEntriesInRawRangeBeforeBootstrap = allEntriesWithToolsBeforeBootstrap.filter(
    (e) => e.recordIndex >= rawFromIndex
  );
  const rawRecordIndexesWithAnyEntry = new Set(
    fullEntriesInRawRangeBeforeBootstrap.map((e) => e.recordIndex)
  );
  const rawRecordIndexes = /* @__PURE__ */ new Set();
  for (let i = rawFromIndex; i < totalRecords; i++) rawRecordIndexes.add(i);
  const accounting = {
    indexBase: "zero-based-jsonl-record-index",
    raw: {
      fromIndex: rawFromIndex,
      toIndex: rawToIndex,
      count: rawCount,
      nextIndex: totalRecords,
      totalRecords
    },
    rendered: {
      count: filteredEntries.length,
      fromIndex: renderedFromIndex,
      toIndex: renderedToIndex,
      askUserEntries: filteredEntries.filter((e) => e.kind === "ask_user").length
    },
    filtered: {
      toolCalls: includeToolCalls ? 0 : fullEntriesInRawRange.filter((e) => e.kind === "tool_call").length,
      toolResults: includeToolResults ? 0 : fullEntriesInRawRange.filter((e) => e.kind === "tool_result").length,
      commandMessages: includeCommandMessages ? 0 : fullEntriesInRawRange.filter((e) => e.kind === "command_message").length,
      bootstrapRecords: [...bootstrapRecordIndexes].filter(
        (index) => index >= rawFromIndex
      ).length,
      bootstrapMessages: fullEntriesInRawRangeBeforeBootstrap.filter(
        (e) => bootstrapRecordIndexes.has(e.recordIndex)
      ).length,
      metadataRecords: [...rawRecordIndexes].filter(
        (index) => !rawRecordIndexesWithAnyEntry.has(index)
      ).length,
      tailSliceEntries: Math.max(
        0,
        entriesBeforeTailSlice.length - filteredEntries.length
      )
    },
    recovery: {
      omittedUserMessages: omittedUserMessageRecoveryPointers(
        entriesBeforeTailSlice,
        filteredEntries,
        transcriptPath
      )
    },
    autoLargeDigest
  };
  return {
    schemaVersion: SCHEMA_VERSION2,
    runtime,
    sessionId,
    transcriptPath,
    recordedCwd,
    matchedTier: opts.matchedTier ?? null,
    widenedFrom: opts.widenedFrom ?? null,
    active: opts.active ?? false,
    engagement,
    mode,
    range,
    accounting,
    entries: filteredEntries,
    filters,
    warnings,
    fallbacks
  };
}
function renderMarkdown(digest) {
  const parts = [];
  parts.push(
    digest.schemaVersion === 2 ? formatCursorHeader(digest) : formatHeader(digest)
  );
  const groups = groupByRole(digest.entries);
  if (groups.length === 0) {
    parts.push("*No messages in range.*\n");
  } else {
    for (const group of groups) {
      const role = group[0].role;
      const header = group[0].displayRole === "queued-user" ? "### User (queued mid-turn)" : group[0].displayRole === "automatic-control" ? "### Hook/control (automatic)" : role === "user" ? "### User" : "### Assistant";
      parts.push(header);
      parts.push("");
      for (const entry of group) {
        if (digest.schemaVersion === 2) {
          const cursorDigestEntry = entry;
          parts.push(
            `*${cursorDigestEntry.availability}; source frame ${cursorDigestEntry.sourceFrameIndex}; entry ${cursorDigestEntry.entryKey}*`
          );
          parts.push("");
        }
        parts.push(entry.text);
        parts.push("");
      }
    }
  }
  const output = parts.join("\n");
  if (output.length > LARGE_OUTPUT_THRESHOLD) {
    const warning = `> **Warning:** This digest is large (${output.length.toLocaleString()} chars). Consider using \`--max-turns\` or \`--max-bytes\` to limit output.

`;
    return warning + output;
  }
  return output;
}

// src/skills/session-observer/src/lib/locate.ts
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  opendir,
  stat as stat2,
  mkdir as mkdir2,
  readFile as readFile3,
  realpath,
  rename as rename2,
  open as open4,
  unlink as unlink2
} from "node:fs/promises";
import { homedir as homedir3 } from "node:os";
import { join as join3, basename as basename2, isAbsolute as isAbsolute2, relative, resolve } from "node:path";
import { promisify } from "node:util";
var execFileAsync = promisify(execFile);
var LOOKBACK_DAYS = 7;
var EXACT_ALL_DISCOVERY_BUDGET = {
  maxEntries: 5e4,
  maxAggregateBytes: 512 * 1024 * 1024,
  maxMetadataBytesPerEntry: 256 * 1024,
  deadlineMs: 3e4
};
var EXACT_ALL_METADATA_MAX_RECORDS = 128;
var CURSOR_IDENTITY_INDEX_MAX_ENTRIES = 2e4;
var CURSOR_IDENTITY_INDEX_MAX_ELAPSED_MS = 2e3;
var CURSOR_DISCOVERY_MAX_ENTRIES = 2e4;
var CURSOR_DISCOVERY_MAX_ELAPSED_MS = 2e3;
var CURSOR_DISCOVERY_MAX_BYTES = 64 * 1024 * 1024;
var CURSOR_DISCOVERY_MAX_RETAINED_CANDIDATES = 5e3;
var SessionDiscoveryError = class extends Error {
  code;
  constructor(code) {
    super(code);
    this.name = "SessionDiscoveryError";
    this.code = code;
  }
};
var ExactAllDiscoveryBudget = class {
  constructor(limits, runtime, diagnostic) {
    this.limits = limits;
    this.runtime = runtime;
    this.diagnostic = diagnostic;
  }
  limits;
  runtime;
  diagnostic;
  startedAt = Date.now();
  entries = 0;
  aggregateBytes = 0;
  emit(code) {
    this.diagnostic?.({ code, runtime: this.runtime });
  }
  checkDeadline() {
    if (Date.now() - this.startedAt >= this.limits.deadlineMs) {
      this.emit("deadline-exceeded");
      throw new SessionDiscoveryError("DISCOVERY_DEADLINE_EXCEEDED");
    }
  }
  consumeEntry() {
    this.checkDeadline();
    this.entries += 1;
    if (this.entries > this.limits.maxEntries) {
      this.emit("budget-exceeded");
      throw new SessionDiscoveryError("DISCOVERY_ENTRY_BUDGET_EXCEEDED");
    }
  }
  consumeBytes(bytes) {
    this.checkDeadline();
    this.aggregateBytes += bytes;
    if (this.aggregateBytes > this.limits.maxAggregateBytes) {
      this.emit("budget-exceeded");
      throw new SessionDiscoveryError("DISCOVERY_BYTE_BUDGET_EXCEEDED");
    }
  }
  remainingMs() {
    this.checkDeadline();
    return Math.max(1, this.limits.deadlineMs - (Date.now() - this.startedAt));
  }
};
function exactAllBudget(runtime, options) {
  if (options?.recency !== "exact-all") return null;
  return new ExactAllDiscoveryBudget(
    options.budget ?? EXACT_ALL_DISCOVERY_BUDGET,
    runtime,
    options.diagnostic
  );
}
var CursorDiscoveryError = class extends Error {
  code;
  constructor(code) {
    super(code);
    this.name = "CursorDiscoveryError";
    this.code = code;
  }
};
var cursorDiscoveryTestOptions;
var CursorDiscoveryBudget = class {
  maxEntries;
  maxElapsedMs;
  maxBytes;
  maxRetainedCandidates;
  now;
  startedAt;
  entries = 0;
  bytes = 0;
  retainedCandidates = 0;
  constructor(options = {}) {
    this.maxEntries = options.maxEntries ?? CURSOR_DISCOVERY_MAX_ENTRIES;
    this.maxElapsedMs = options.maxElapsedMs ?? CURSOR_DISCOVERY_MAX_ELAPSED_MS;
    this.maxBytes = options.maxBytes ?? CURSOR_DISCOVERY_MAX_BYTES;
    this.maxRetainedCandidates = options.maxRetainedCandidates ?? CURSOR_DISCOVERY_MAX_RETAINED_CANDIDATES;
    this.now = options.now ?? Date.now;
    this.startedAt = this.now();
  }
  checkTime() {
    if (this.now() - this.startedAt > this.maxElapsedMs) {
      throw new CursorDiscoveryError("CURSOR_DISCOVERY_TIME_BUDGET_EXCEEDED");
    }
  }
  consumeEntry() {
    this.checkTime();
    this.entries += 1;
    if (this.entries > this.maxEntries) {
      throw new CursorDiscoveryError("CURSOR_DISCOVERY_ENTRY_BUDGET_EXCEEDED");
    }
  }
  retainCandidate() {
    this.checkTime();
    this.retainedCandidates += 1;
    if (this.retainedCandidates > this.maxRetainedCandidates) {
      throw new CursorDiscoveryError(
        "CURSOR_DISCOVERY_RETAINED_CANDIDATE_BUDGET_EXCEEDED"
      );
    }
  }
  reserveBytes(bytes) {
    this.checkTime();
    this.bytes += bytes;
    if (this.bytes > this.maxBytes) {
      throw new CursorDiscoveryError("CURSOR_DISCOVERY_BYTE_BUDGET_EXCEEDED");
    }
  }
};
var DEFAULT_CLASSIFICATION_CACHE_MAX_ENTRIES = 5e3;
var ClassificationCache = class {
  maxEntries;
  entries = /* @__PURE__ */ new Map();
  constructor(maxEntries = DEFAULT_CLASSIFICATION_CACHE_MAX_ENTRIES) {
    this.maxEntries = maxEntries;
  }
  get(transcriptPath, mtimeMs, size, derivation = "default") {
    const key = JSON.stringify([derivation, transcriptPath]);
    const entry = this.entries.get(key);
    if (!entry) return void 0;
    if (entry.mtimeMs !== mtimeMs || entry.size !== size) {
      this.entries.delete(key);
      return void 0;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.result;
  }
  set(transcriptPath, mtimeMs, size, result, derivation = "default") {
    const key = JSON.stringify([derivation, transcriptPath]);
    this.entries.delete(key);
    this.entries.set(key, { mtimeMs, size, result });
    if (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== void 0) this.entries.delete(oldestKey);
    }
  }
  get size() {
    return this.entries.size;
  }
};
var UNKNOWN_CLASSIFICATION = {
  status: "unknown",
  engaged: true,
  recordCount: null,
  genuineUserMessages: 0,
  operatorAskUserAnswers: 0,
  syntheticUserMessages: 0,
  assistantMessages: 0,
  realMessageCount: 0,
  hasAssistantAndUser: false,
  bootstrapRecordIndexes: [],
  bootstrapRecordCount: 0
};
function compactClassificationForCache(classification) {
  if (classification.bootstrapRecordIndexes.length === 0) return classification;
  return { ...classification, bootstrapRecordIndexes: [] };
}
async function candidateDerivedFields(runtime, transcriptPath, signature, cache) {
  const cached = cache.get(transcriptPath, signature.mtimeMs, signature.size);
  if (cached) return cached;
  try {
    const records = await readRecords(transcriptPath);
    const classification = compactClassificationForCache(
      classifyTranscriptRecords(runtime, records)
    );
    const meta = extractMetaFromRecords(runtime, records, transcriptPath);
    const result = { meta, classification };
    cache.set(transcriptPath, signature.mtimeMs, signature.size, result);
    return result;
  } catch {
    return { meta: null, classification: UNKNOWN_CLASSIFICATION };
  }
}
async function candidateDerivedFieldsBounded(runtime, transcriptPath, signature, cache, budget, diagnostic, unattributablePolicy = "fail", unattributable) {
  const derivation = `bounded-prefix:${budget.limits.maxMetadataBytesPerEntry}:${EXACT_ALL_METADATA_MAX_RECORDS}:${unattributablePolicy}`;
  const cached = cache.get(
    transcriptPath,
    signature.mtimeMs,
    signature.size,
    derivation
  );
  if (cached) return cached;
  let deadlineExceeded = false;
  let transcriptIssue = null;
  const read = await readMetadataRecordsBounded(transcriptPath, {
    maxBytes: budget.limits.maxMetadataBytesPerEntry,
    maxRecords: EXACT_ALL_METADATA_MAX_RECORDS,
    deadlineMs: budget.remainingMs(),
    diagnostic: ({ code }) => {
      deadlineExceeded = code === "deadline-exceeded";
      if (transcriptIssue === null && ["malformed-record", "oversized-record", "read-failed"].includes(code)) {
        transcriptIssue = code;
      }
      diagnostic?.({ code, runtime });
    }
  });
  budget.checkDeadline();
  if (deadlineExceeded) {
    throw new SessionDiscoveryError("DISCOVERY_DEADLINE_EXCEEDED");
  }
  if (read.incomplete && unattributablePolicy !== "summarize") {
    throw new SessionDiscoveryError("DISCOVERY_TRANSCRIPT_INCOMPLETE");
  }
  if (transcriptIssue !== null && unattributablePolicy === "summarize") {
    unattributable?.({ reason: transcriptIssue, runtime });
    return null;
  }
  const records = read.records;
  const classification = compactClassificationForCache(
    classifyTranscriptRecords(runtime, records)
  );
  let meta = extractMetaFromRecords(runtime, records, transcriptPath);
  if (runtime === "claude-code") {
    const recordedCwd = extractClaudeRecordedCwdFromRecords(records);
    if (recordedCwd === null && unattributablePolicy === "summarize") {
      diagnostic?.({ code: "cwd-missing", runtime });
      unattributable?.({ reason: "cwd-missing", runtime });
      return null;
    }
    if (!meta && unattributablePolicy === "summarize") {
      diagnostic?.({ code: "metadata-prefix-incomplete", runtime });
      unattributable?.({ reason: "metadata-prefix-incomplete", runtime });
      return null;
    }
    if (!meta || recordedCwd === null) {
      throw new SessionDiscoveryError("DISCOVERY_TRANSCRIPT_INCOMPLETE");
    }
    meta = { ...meta, recordedCwd };
  }
  if (runtime === "codex") {
    const recordedCwd = extractCodexRecordedCwdFromRecords(records);
    if (recordedCwd === null && unattributablePolicy === "summarize") {
      diagnostic?.({ code: "cwd-missing", runtime });
      unattributable?.({ reason: "cwd-missing", runtime });
      return null;
    }
    if (!meta && unattributablePolicy === "summarize") {
      diagnostic?.({ code: "metadata-prefix-incomplete", runtime });
      unattributable?.({ reason: "metadata-prefix-incomplete", runtime });
      return null;
    }
    if (!meta || recordedCwd === null) {
      throw new SessionDiscoveryError("DISCOVERY_TRANSCRIPT_INCOMPLETE");
    }
    meta = { ...meta, recordedCwd };
  }
  const result = { meta, classification };
  cache.set(
    transcriptPath,
    signature.mtimeMs,
    signature.size,
    result,
    derivation
  );
  return result;
}
async function candidateEngagementFields(runtime, transcriptPath, signature, cache) {
  const { classification } = await candidateDerivedFields(
    runtime,
    transcriptPath,
    signature,
    cache
  );
  return engagementCandidateFields(classification);
}
function cwdCachePath() {
  const stateDir5 = process.env.STATE_DIR ?? join3(homedir3(), ".local", "state", "session-observer");
  return join3(stateDir5, "codex-cwd-cache.json");
}
async function loadCwdCache() {
  try {
    const raw = await readFile3(cwdCachePath(), "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
async function saveCwdCache(cache) {
  try {
    const path = cwdCachePath();
    const dir = path.replace(/\/[^/]+$/, "");
    await mkdir2(dir, { recursive: true });
    const tmp = join3(
      dir,
      `codex-cwd-cache.${process.pid}.${Date.now()}.${randomUUID()}.tmp`
    );
    let fh;
    try {
      fh = await open4(tmp, "w");
      await fh.write(JSON.stringify(cache, null, 2));
      await fh.datasync();
      await fh.close();
      fh = null;
      await rename2(tmp, path);
    } finally {
      if (fh) {
        try {
          await fh.close();
        } catch {
        }
      }
      try {
        await unlink2(tmp);
      } catch {
      }
    }
  } catch {
  }
}
function cwdCacheKey(transcriptPath, mtimeSec) {
  return `${transcriptPath}:${mtimeSec}`;
}
async function discoverClaudeCode(targetCwd, cache, options) {
  const [projectsRoot] = discoverPaths("claude-code");
  const budget = exactAllBudget("claude-code", options);
  const encodedVariants = encodeCwdVariants("claude-code", targetCwd);
  const now = Date.now() / 1e3;
  const candidates = [];
  const seenTranscripts = /* @__PURE__ */ new Set();
  let directHit = false;
  for (const encoded of encodedVariants) {
    budget?.checkDeadline();
    const encodedDir = join3(projectsRoot, encoded);
    try {
      const entries = await opendir(encodedDir);
      for await (const entry of entries) {
        budget?.consumeEntry();
        if (!entry.name.endsWith(".jsonl")) continue;
        const transcriptPath = join3(encodedDir, entry.name);
        if (seenTranscripts.has(transcriptPath)) continue;
        seenTranscripts.add(transcriptPath);
        let fileStat;
        try {
          fileStat = await stat2(transcriptPath);
        } catch {
          if (budget) {
            throw new SessionDiscoveryError("DISCOVERY_ENUMERATION_INCOMPLETE");
          }
          continue;
        }
        budget?.consumeBytes(fileStat.size);
        const mtime = Math.floor(fileStat.mtime.getTime() / 1e3);
        const ageSec = now - mtime;
        const derived = budget ? await candidateDerivedFieldsBounded(
          "claude-code",
          transcriptPath,
          fileStat,
          cache,
          budget,
          options?.diagnostic,
          options?.unattributablePolicy,
          options?.unattributable
        ) : await candidateDerivedFields(
          "claude-code",
          transcriptPath,
          fileStat,
          cache
        );
        if (derived === null) continue;
        const sessionId = derived.meta?.sessionId ?? basename2(transcriptPath).replace(/\.jsonl$/, "");
        candidates.push({
          runtime: "claude-code",
          transcriptPath,
          sessionId,
          recordedCwd: budget ? derived.meta?.recordedCwd ?? null : targetCwd,
          cwdSlug: encoded,
          cwdEvidence: budget ? "transcript-record" : "direct-parent-dir",
          mtime,
          size: fileStat.size,
          ageSec,
          ...engagementCandidateFields(derived.classification)
        });
      }
      directHit = true;
    } catch (error) {
      if (error instanceof SessionDiscoveryError) throw error;
      if (budget && !isMissingPathError(error)) {
        throw new SessionDiscoveryError("DISCOVERY_ENUMERATION_INCOMPLETE");
      }
    }
  }
  if (!directHit || budget !== null) {
    let projectDirs;
    try {
      projectDirs = await opendir(projectsRoot);
    } catch (error) {
      if (budget && !isMissingPathError(error)) {
        throw new SessionDiscoveryError("DISCOVERY_ENUMERATION_INCOMPLETE");
      }
      return candidates;
    }
    for await (const projectEntry of projectDirs) {
      budget?.consumeEntry();
      if (!projectEntry.isDirectory()) continue;
      const dirName = projectEntry.name;
      if (encodedVariants.includes(dirName)) continue;
      const projectDir = join3(projectsRoot, dirName);
      let dirEntries;
      try {
        dirEntries = await opendir(projectDir);
      } catch {
        if (budget) {
          throw new SessionDiscoveryError("DISCOVERY_ENUMERATION_INCOMPLETE");
        }
        continue;
      }
      for await (const entry of dirEntries) {
        budget?.consumeEntry();
        if (!entry.name.endsWith(".jsonl")) continue;
        const transcriptPath = join3(projectDir, entry.name);
        if (seenTranscripts.has(transcriptPath)) continue;
        seenTranscripts.add(transcriptPath);
        let fileStat;
        try {
          fileStat = await stat2(transcriptPath);
        } catch {
          if (budget) {
            throw new SessionDiscoveryError("DISCOVERY_ENUMERATION_INCOMPLETE");
          }
          continue;
        }
        budget?.consumeBytes(fileStat.size);
        const mtime = Math.floor(fileStat.mtime.getTime() / 1e3);
        const ageSec = now - mtime;
        const derived = budget ? await candidateDerivedFieldsBounded(
          "claude-code",
          transcriptPath,
          fileStat,
          cache,
          budget,
          options?.diagnostic,
          options?.unattributablePolicy,
          options?.unattributable
        ) : await candidateDerivedFields(
          "claude-code",
          transcriptPath,
          fileStat,
          cache
        );
        if (derived === null) continue;
        const sessionId = derived.meta?.sessionId ?? basename2(transcriptPath).replace(/\.jsonl$/, "");
        const recordedCwd = derived.meta?.recordedCwd ?? null;
        candidates.push({
          runtime: "claude-code",
          transcriptPath,
          sessionId,
          recordedCwd,
          cwdSlug: dirName,
          cwdEvidence: budget ? "transcript-record" : "decoded-parent-dir",
          mtime,
          size: fileStat.size,
          ageSec,
          ...engagementCandidateFields(derived.classification)
        });
      }
    }
  }
  return candidates;
}
async function collectJsonlFiles(dir, budget = null) {
  const results = [];
  let entries;
  try {
    entries = await opendir(dir);
  } catch (error) {
    if (budget && !isMissingPathError(error)) {
      throw new SessionDiscoveryError("DISCOVERY_ENUMERATION_INCOMPLETE");
    }
    return results;
  }
  try {
    for await (const entry of entries) {
      budget?.consumeEntry();
      const fullPath = join3(dir, entry.name);
      if (entry.isDirectory()) {
        const nested = await collectJsonlFiles(fullPath, budget);
        results.push(...nested);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        results.push(fullPath);
      }
    }
  } catch (error) {
    if (error instanceof SessionDiscoveryError) throw error;
    if (budget) {
      throw new SessionDiscoveryError("DISCOVERY_ENUMERATION_INCOMPLETE");
    }
  }
  return results;
}
async function discoverCodex(_targetCwd, classificationCache, options) {
  const [sessionsRoot] = discoverPaths("codex");
  const budget = exactAllBudget("codex", options);
  const now = Date.now() / 1e3;
  const cutoffSec = now - LOOKBACK_DAYS * 86400;
  const allFiles = await collectJsonlFiles(sessionsRoot, budget);
  if (budget) allFiles.sort((left, right) => left.localeCompare(right));
  const persistentCacheAllowed = options?.persistence !== "forbid";
  const cwdCache = persistentCacheAllowed ? await loadCwdCache() : {};
  let cacheModified = false;
  const candidates = [];
  for (const transcriptPath of allFiles) {
    budget?.checkDeadline();
    let fileStat;
    try {
      fileStat = await stat2(transcriptPath);
    } catch {
      if (budget) {
        throw new SessionDiscoveryError("DISCOVERY_ENUMERATION_INCOMPLETE");
      }
      continue;
    }
    budget?.consumeBytes(
      Math.min(fileStat.size, budget.limits.maxMetadataBytesPerEntry)
    );
    const mtime = Math.floor(fileStat.mtime.getTime() / 1e3);
    if (options?.recency !== "exact-all" && mtime < cutoffSec) continue;
    const ageSec = now - mtime;
    const key = cwdCacheKey(transcriptPath, mtime);
    let recordedCwd;
    let sessionId;
    let boundedDerived = null;
    if (budget) {
      boundedDerived = await candidateDerivedFieldsBounded(
        "codex",
        transcriptPath,
        fileStat,
        classificationCache,
        budget,
        options?.diagnostic,
        options?.unattributablePolicy,
        options?.unattributable
      );
      if (boundedDerived === null) continue;
    }
    if (persistentCacheAllowed && cwdCache[key] && cwdCache[key].sessionId !== void 0) {
      recordedCwd = cwdCache[key].recordedCwd;
      sessionId = cwdCache[key].sessionId;
    } else {
      let meta = boundedDerived?.meta;
      if (!budget) {
        try {
          meta = await extractMeta("codex", transcriptPath);
        } catch {
          meta = null;
        }
      }
      recordedCwd = meta?.recordedCwd ?? null;
      sessionId = meta?.sessionId ?? basename2(transcriptPath).replace(/\.jsonl$/, "");
      if (persistentCacheAllowed) {
        cwdCache[key] = { recordedCwd, sessionId };
        cacheModified = true;
      }
    }
    candidates.push({
      runtime: "codex",
      transcriptPath,
      sessionId,
      recordedCwd,
      mtime,
      size: fileStat.size,
      ageSec,
      ...boundedDerived ? engagementCandidateFields(boundedDerived.classification) : await candidateEngagementFields(
        "codex",
        transcriptPath,
        fileStat,
        classificationCache
      )
    });
  }
  if (persistentCacheAllowed && cacheModified) {
    await saveCwdCache(cwdCache);
  }
  return candidates;
}
async function* collectCursorAgentTranscripts(transcriptsRoot, budget, expectedSessionId, failOnIncomplete = false) {
  let sessionDirs;
  try {
    sessionDirs = await opendir(transcriptsRoot);
  } catch (error) {
    if (failOnIncomplete && !isMissingPathError(error)) {
      throw new CursorDiscoveryError("IDENTITY_INDEX_INCOMPLETE");
    }
    return;
  }
  try {
    for await (const sessionDir of sessionDirs) {
      budget.consumeEntry();
      if (!sessionDir.isDirectory()) continue;
      const sessionPath = join3(transcriptsRoot, sessionDir.name);
      let entries;
      try {
        entries = await opendir(sessionPath);
      } catch (error) {
        if (failOnIncomplete && !isMissingPathError(error)) {
          throw new CursorDiscoveryError("IDENTITY_INDEX_INCOMPLETE");
        }
        continue;
      }
      for await (const entry of entries) {
        budget.consumeEntry();
        if (entry.isFile() && entry.name.endsWith(".jsonl")) {
          const transcriptPath = join3(sessionPath, entry.name);
          if (expectedSessionId === void 0 || cursorSessionIdFromTranscriptPath(transcriptPath) === expectedSessionId) {
            yield transcriptPath;
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof CursorDiscoveryError) throw error;
    if (failOnIncomplete) {
      throw new CursorDiscoveryError("IDENTITY_INDEX_INCOMPLETE");
    }
  }
}
async function cursorCandidate(transcriptPath, now, evidence, fileStat, cache, budget, exactBudget = null, diagnostic) {
  let resolvedStat = fileStat;
  if (!resolvedStat) {
    try {
      resolvedStat = await stat2(transcriptPath);
    } catch {
      if (exactBudget) {
        throw new CursorDiscoveryError("IDENTITY_INDEX_INCOMPLETE");
      }
      return null;
    }
  }
  const mtime = Math.floor(resolvedStat.mtime.getTime() / 1e3);
  const ageSec = now - mtime;
  budget.reserveBytes(resolvedStat.size);
  const derived = exactBudget ? await candidateDerivedFieldsBounded(
    "cursor",
    transcriptPath,
    resolvedStat,
    cache,
    exactBudget,
    diagnostic
  ) : await candidateDerivedFields(
    "cursor",
    transcriptPath,
    resolvedStat,
    cache
  );
  if (derived === null) {
    throw new SessionDiscoveryError("DISCOVERY_TRANSCRIPT_INCOMPLETE");
  }
  budget.checkTime();
  return {
    runtime: "cursor",
    transcriptPath,
    sessionId: derived.meta?.sessionId ?? basename2(transcriptPath).replace(/\.jsonl$/, ""),
    recordedCwd: evidence.recordedCwd,
    cwdSlug: evidence.cwdSlug,
    cwdEvidence: evidence.cwdEvidence,
    cwdEvidenceQuality: evidence.cwdEvidenceQuality,
    mtime,
    size: resolvedStat.size,
    ageSec,
    ...engagementCandidateFields(derived.classification)
  };
}
async function discoverCursor(targetCwd, cache, options) {
  const [projectsRoot] = discoverPaths("cursor");
  const normalizedTargetCwd = resolve(targetCwd);
  const canonicalTargetCwd = await canonicalPath(normalizedTargetCwd) ?? normalizedTargetCwd;
  const canonicalEncodedVariants = new Set(
    encodeCwdVariants("cursor", canonicalTargetCwd)
  );
  const rawEncodedVariants = new Set(
    encodeCwdVariants("cursor", normalizedTargetCwd)
  );
  const suppliedCwdIsAlias = normalizedTargetCwd !== canonicalTargetCwd;
  const directVariants = [
    ...[...canonicalEncodedVariants].map((encoded) => ({
      encoded,
      cwdEvidence: "direct-parent-dir"
    })),
    ...[...rawEncodedVariants].filter((encoded) => !canonicalEncodedVariants.has(encoded)).map((encoded) => ({
      encoded,
      cwdEvidence: suppliedCwdIsAlias ? "raw-cwd-alias" : "direct-parent-dir"
    }))
  ];
  const encodedVariants = directVariants.map(({ encoded }) => encoded);
  const now = Date.now() / 1e3;
  const cutoffSec = now - LOOKBACK_DAYS * 86400;
  const candidates = [];
  const seenTranscripts = /* @__PURE__ */ new Set();
  const exactBudget = exactAllBudget("cursor", options);
  const budget = new CursorDiscoveryBudget(
    exactBudget ? {
      maxEntries: exactBudget.limits.maxEntries,
      maxElapsedMs: exactBudget.limits.deadlineMs,
      maxBytes: exactBudget.limits.maxAggregateBytes,
      maxRetainedCandidates: exactBudget.limits.maxEntries
    } : cursorDiscoveryTestOptions
  );
  for (const { encoded, cwdEvidence } of directVariants) {
    const transcriptsRoot = join3(projectsRoot, encoded, "agent-transcripts");
    for await (const transcriptPath of collectCursorAgentTranscripts(
      transcriptsRoot,
      budget,
      void 0,
      exactBudget !== null
    )) {
      const canonicalTranscriptPath = await canonicalPath(transcriptPath) ?? transcriptPath;
      if (seenTranscripts.has(canonicalTranscriptPath)) continue;
      budget.retainCandidate();
      seenTranscripts.add(canonicalTranscriptPath);
      const candidate = await cursorCandidate(
        transcriptPath,
        now,
        {
          recordedCwd: targetCwd,
          cwdSlug: encoded,
          cwdEvidence,
          cwdEvidenceQuality: "caller-derived-lossy"
        },
        null,
        cache,
        budget,
        exactBudget,
        options?.diagnostic
      );
      if (candidate) candidates.push(candidate);
    }
  }
  let projectDirs;
  try {
    projectDirs = await opendir(projectsRoot);
  } catch (error) {
    if (exactBudget && !isMissingPathError(error)) {
      throw new CursorDiscoveryError("IDENTITY_INDEX_INCOMPLETE");
    }
    return candidates;
  }
  try {
    for await (const projectDir of projectDirs) {
      budget.consumeEntry();
      if (!projectDir.isDirectory()) continue;
      if (encodedVariants.includes(projectDir.name)) continue;
      const transcriptsRoot = join3(
        projectsRoot,
        projectDir.name,
        "agent-transcripts"
      );
      for await (const transcriptPath of collectCursorAgentTranscripts(
        transcriptsRoot,
        budget,
        void 0,
        exactBudget !== null
      )) {
        const canonicalTranscriptPath = await canonicalPath(transcriptPath) ?? transcriptPath;
        if (seenTranscripts.has(canonicalTranscriptPath)) continue;
        budget.retainCandidate();
        seenTranscripts.add(canonicalTranscriptPath);
        let fileStat;
        try {
          fileStat = await stat2(transcriptPath);
        } catch {
          if (exactBudget) {
            throw new CursorDiscoveryError("IDENTITY_INDEX_INCOMPLETE");
          }
          continue;
        }
        const mtime = Math.floor(fileStat.mtime.getTime() / 1e3);
        if (options?.recency !== "exact-all" && mtime < cutoffSec) continue;
        const candidate = await cursorCandidate(
          transcriptPath,
          now,
          {
            recordedCwd: null,
            cwdSlug: projectDir.name,
            cwdEvidence: "project-dir-slug",
            cwdEvidenceQuality: "diagnostic"
          },
          fileStat,
          cache,
          budget,
          exactBudget,
          options?.diagnostic
        );
        if (candidate) candidates.push(candidate);
      }
    }
  } catch (error) {
    if (error instanceof CursorDiscoveryError || error instanceof SessionDiscoveryError) {
      throw error;
    }
    if (exactBudget) {
      throw new CursorDiscoveryError("IDENTITY_INDEX_INCOMPLETE");
    }
    throw error;
  }
  return candidates;
}
async function findCursorSessionCandidates(targetCwd, sessionId, cache) {
  const [projectsRoot] = discoverPaths("cursor");
  const normalizedTargetCwd = resolve(targetCwd);
  const canonicalTargetCwd = await canonicalPath(normalizedTargetCwd) ?? normalizedTargetCwd;
  const canonicalEncodedVariants = new Set(
    encodeCwdVariants("cursor", canonicalTargetCwd)
  );
  const rawEncodedVariants = new Set(
    encodeCwdVariants("cursor", normalizedTargetCwd)
  );
  const suppliedCwdIsAlias = normalizedTargetCwd !== canonicalTargetCwd;
  const directVariants = [
    ...[...canonicalEncodedVariants].map((encoded) => ({
      encoded,
      cwdEvidence: "direct-parent-dir"
    })),
    ...[...rawEncodedVariants].filter((encoded) => !canonicalEncodedVariants.has(encoded)).map((encoded) => ({
      encoded,
      cwdEvidence: suppliedCwdIsAlias ? "raw-cwd-alias" : "direct-parent-dir"
    }))
  ];
  const directEvidence = new Map(
    directVariants.map(({ encoded, cwdEvidence }) => [encoded, cwdEvidence])
  );
  const now = Date.now() / 1e3;
  const cutoffSec = now - LOOKBACK_DAYS * 86400;
  const candidates = [];
  const seenTranscripts = /* @__PURE__ */ new Set();
  const pinnedBudget = new CursorDiscoveryBudget({
    maxEntries: cursorDiscoveryTestOptions?.maxEntries ?? CURSOR_IDENTITY_INDEX_MAX_ENTRIES,
    maxElapsedMs: cursorDiscoveryTestOptions?.maxElapsedMs ?? CURSOR_IDENTITY_INDEX_MAX_ELAPSED_MS,
    maxBytes: Number.MAX_SAFE_INTEGER,
    maxRetainedCandidates: Number.MAX_SAFE_INTEGER,
    now: cursorDiscoveryTestOptions?.now
  });
  let projectDirs;
  try {
    projectDirs = await opendir(projectsRoot);
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw new CursorDiscoveryError("IDENTITY_INDEX_INCOMPLETE");
    }
    return candidates;
  }
  try {
    for await (const projectDir of projectDirs) {
      pinnedBudget.consumeEntry();
      if (!projectDir.isDirectory()) continue;
      const cwdEvidence = directEvidence.get(projectDir.name);
      const transcriptsRoot = join3(
        projectsRoot,
        projectDir.name,
        "agent-transcripts"
      );
      for await (const transcriptPath of collectCursorAgentTranscripts(
        transcriptsRoot,
        // Pinned lookup filters by path before classification. Its aggregate
        // metadata walk is finite and fails visibly if uniqueness cannot be
        // established within the same entry/time envelope as identity indexing.
        pinnedBudget,
        sessionId,
        true
      )) {
        const canonicalTranscriptPath = await canonicalPath(transcriptPath) ?? transcriptPath;
        if (seenTranscripts.has(canonicalTranscriptPath)) continue;
        seenTranscripts.add(canonicalTranscriptPath);
        let fileStat;
        try {
          fileStat = await stat2(transcriptPath);
        } catch (error) {
          if (isMissingPathError(error)) continue;
          throw new CursorDiscoveryError("IDENTITY_INDEX_INCOMPLETE");
        }
        const mtime = Math.floor(fileStat.mtime.getTime() / 1e3);
        if (cwdEvidence === void 0 && mtime < cutoffSec) continue;
        const candidate = await cursorCandidate(
          transcriptPath,
          now,
          {
            recordedCwd: cwdEvidence === void 0 ? null : targetCwd,
            cwdSlug: projectDir.name,
            cwdEvidence: cwdEvidence ?? "project-dir-slug",
            cwdEvidenceQuality: cwdEvidence === void 0 ? "diagnostic" : "caller-derived-lossy"
          },
          fileStat,
          cache,
          pinnedBudget
        );
        if (candidate?.sessionId === sessionId) candidates.push(candidate);
      }
    }
  } catch (error) {
    if (error instanceof CursorDiscoveryError) throw error;
    throw new CursorDiscoveryError("IDENTITY_INDEX_INCOMPLETE");
  }
  return candidates;
}
function cursorCwdEvidence(candidate) {
  if (candidate.cwdEvidence === "store-metadata") return "store-metadata";
  if (candidate.cwdEvidence === "harness-environment") {
    return "harness-environment";
  }
  if (candidate.cwdEvidence === "direct-parent-dir") {
    return "direct-project-root";
  }
  return "fallback-slug";
}
function pathIsWithin(root, candidate) {
  const relativePath = relative(root, candidate);
  return relativePath === "" || !relativePath.startsWith(
    `..${process.platform === "win32" ? "\\" : "/"}`
  ) && relativePath !== ".." && !isAbsolute2(relativePath);
}
async function canonicalPath(path) {
  try {
    return await realpath(path);
  } catch {
    return null;
  }
}
function isMissingPathError(error) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
function cursorSessionIdFromTranscriptPath(transcriptPath) {
  const transcriptBase = basename2(transcriptPath).replace(/\.jsonl$/u, "");
  return transcriptBase && !["transcript", "conversation", "messages"].includes(transcriptBase) ? transcriptBase : basename2(join3(transcriptPath, ".."));
}
async function cursorSessionCanonicalPaths(sessionId, options = {}) {
  const [projectsRoot] = discoverPaths("cursor");
  const canonicalPaths = /* @__PURE__ */ new Set();
  const maxEntries = options.maxEntries ?? CURSOR_IDENTITY_INDEX_MAX_ENTRIES;
  const maxElapsedMs = options.maxElapsedMs ?? CURSOR_IDENTITY_INDEX_MAX_ELAPSED_MS;
  const now = options.now ?? Date.now;
  const startedAt = now();
  let entryCount = 0;
  const budgetFailure = (consumeEntry = false) => {
    if (now() - startedAt > maxElapsedMs) {
      return "IDENTITY_INDEX_TIME_BUDGET_EXCEEDED";
    }
    if (consumeEntry) {
      entryCount += 1;
      if (entryCount > maxEntries) {
        return "IDENTITY_INDEX_ENTRY_BUDGET_EXCEEDED";
      }
    }
    return null;
  };
  let projects;
  try {
    projects = await opendir(projectsRoot);
  } catch (error) {
    return {
      canonicalPaths,
      failure: isMissingPathError(error) ? null : "IDENTITY_INDEX_INCOMPLETE"
    };
  }
  try {
    for await (const projectDir of projects) {
      let failure = budgetFailure(true);
      if (failure) return { canonicalPaths, failure };
      if (!projectDir.isDirectory()) continue;
      let sessions;
      try {
        sessions = await opendir(
          join3(projectsRoot, projectDir.name, "agent-transcripts")
        );
      } catch (error) {
        if (isMissingPathError(error)) continue;
        return {
          canonicalPaths,
          failure: "IDENTITY_INDEX_INCOMPLETE"
        };
      }
      failure = budgetFailure();
      if (failure) return { canonicalPaths, failure };
      for await (const sessionDir of sessions) {
        failure = budgetFailure(true);
        if (failure) return { canonicalPaths, failure };
        if (!sessionDir.isDirectory()) continue;
        let transcripts;
        try {
          transcripts = await opendir(
            join3(
              projectsRoot,
              projectDir.name,
              "agent-transcripts",
              sessionDir.name
            )
          );
        } catch (error) {
          if (isMissingPathError(error)) continue;
          return {
            canonicalPaths,
            failure: "IDENTITY_INDEX_INCOMPLETE"
          };
        }
        failure = budgetFailure();
        if (failure) return { canonicalPaths, failure };
        for await (const entry of transcripts) {
          failure = budgetFailure(true);
          if (failure) return { canonicalPaths, failure };
          if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
          const transcriptPath = join3(
            projectsRoot,
            projectDir.name,
            "agent-transcripts",
            sessionDir.name,
            entry.name
          );
          if (cursorSessionIdFromTranscriptPath(transcriptPath) !== sessionId) {
            continue;
          }
          let canonicalTranscriptPath;
          try {
            canonicalTranscriptPath = await realpath(transcriptPath);
          } catch (error) {
            if (isMissingPathError(error)) continue;
            return {
              canonicalPaths,
              failure: "IDENTITY_INDEX_INCOMPLETE"
            };
          }
          canonicalPaths.add(canonicalTranscriptPath);
          failure = budgetFailure();
          if (failure) return { canonicalPaths, failure };
        }
      }
    }
  } catch {
    return { canonicalPaths, failure: "IDENTITY_INDEX_INCOMPLETE" };
  }
  return { canonicalPaths, failure: null };
}
async function resolveCursorIdentity(candidate, requestedCwd, expectedSessionId, indexOptions) {
  if (candidate.runtime !== "cursor") {
    throw new TypeError("resolveCursorIdentity requires a Cursor candidate");
  }
  const cwdEvidence = [cursorCwdEvidence(candidate)];
  const sessionEvidence = ["transcript-path"];
  const reasons = [];
  const requestedCanonicalCwd = await canonicalPath(requestedCwd);
  const resolvedTranscriptPath = await canonicalPath(candidate.transcriptPath);
  const storeRoot = join3(homedir3(), ".cursor", "projects");
  const resolvedStoreRoot = await canonicalPath(storeRoot);
  const canonicalCwd = requestedCanonicalCwd ?? requestedCwd.replace(/\/+$/u, "");
  const canonicalTranscriptPath = resolvedTranscriptPath ?? candidate.transcriptPath;
  const canonicalStoreRoot = resolvedStoreRoot ?? storeRoot;
  if (requestedCanonicalCwd === null) {
    reasons.push("CWD_CANONICALIZATION_FAILED");
  }
  if (resolvedTranscriptPath === null) {
    reasons.push("TRANSCRIPT_CANONICALIZATION_FAILED");
  }
  if (resolvedStoreRoot === null) {
    reasons.push("STORE_ROOT_CANONICALIZATION_FAILED");
  }
  if (resolvedStoreRoot !== null && resolvedTranscriptPath !== null && !pathIsWithin(canonicalStoreRoot, canonicalTranscriptPath)) {
    reasons.push("PATH_OUTSIDE_SUPPORTED_ROOT");
  }
  const canonicalRecordedCwd = candidate.recordedCwd ? await canonicalPath(candidate.recordedCwd) : null;
  if (candidate.recordedCwd && canonicalRecordedCwd === null) {
    reasons.push("RECORDED_CWD_CANONICALIZATION_FAILED");
  }
  if (candidate.cwdEvidence === "raw-cwd-alias") {
    reasons.push("RAW_CWD_ALIAS_DIAGNOSTIC_ONLY");
  }
  if (canonicalRecordedCwd !== null && canonicalRecordedCwd !== canonicalCwd) {
    reasons.push("CANDIDATE_CWD_MISMATCH");
  }
  if (expectedSessionId !== void 0) {
    sessionEvidence.unshift("explicit-pin");
    if (expectedSessionId !== candidate.sessionId) {
      reasons.push("IDENTITY_MISMATCH");
    }
  }
  const harnessSessionId = process.env.CURSOR_SESSION_ID?.trim();
  if (harnessSessionId) {
    sessionEvidence.splice(
      expectedSessionId === void 0 ? 0 : 1,
      0,
      "harness-environment"
    );
    cwdEvidence.push("harness-environment");
    if (harnessSessionId !== candidate.sessionId) {
      reasons.push("HARNESS_SESSION_MISMATCH");
    }
  }
  const identityIndex = await cursorSessionCanonicalPaths(
    candidate.sessionId,
    indexOptions
  );
  const distinctPaths = identityIndex.canonicalPaths;
  distinctPaths.add(canonicalTranscriptPath);
  if (identityIndex.failure) reasons.push(identityIndex.failure);
  if (distinctPaths.size > 1) {
    reasons.push("DUPLICATE_SESSION_CANDIDATES");
  }
  const cwdSource = cwdEvidence[0];
  const cwdMatches = canonicalRecordedCwd === canonicalCwd && cwdSource !== "fallback-slug";
  const independentStoreCwd = cwdSource === "store-metadata";
  const exactSessionSignal = expectedSessionId !== void 0 && expectedSessionId === candidate.sessionId || harnessSessionId === candidate.sessionId || independentStoreCwd;
  const hardFailure = reasons.some(
    (reason) => [
      "PATH_OUTSIDE_SUPPORTED_ROOT",
      "CANDIDATE_CWD_MISMATCH",
      "IDENTITY_MISMATCH",
      "HARNESS_SESSION_MISMATCH",
      "DUPLICATE_SESSION_CANDIDATES",
      "IDENTITY_INDEX_ENTRY_BUDGET_EXCEEDED",
      "IDENTITY_INDEX_TIME_BUDGET_EXCEEDED",
      "IDENTITY_INDEX_INCOMPLETE"
    ].includes(reason)
  );
  const canonicalIdentityReady = requestedCanonicalCwd !== null && resolvedTranscriptPath !== null && resolvedStoreRoot !== null && (candidate.recordedCwd === null || canonicalRecordedCwd !== null);
  let strength;
  if (hardFailure) {
    strength = "ambiguous";
  } else if (canonicalIdentityReady && cwdMatches && exactSessionSignal) {
    strength = "exact";
  } else {
    strength = "diagnostic";
    if (!cwdMatches) reasons.push("WEAK_CWD_EVIDENCE");
    if (!exactSessionSignal) reasons.push("SESSION_SIGNAL_REQUIRED");
  }
  return {
    runtime: "cursor",
    sessionId: candidate.sessionId,
    projectCwd: canonicalCwd,
    canonicalCwd,
    canonicalTranscriptPath,
    cwdEvidence,
    sessionEvidence,
    strength,
    reasons
  };
}
async function discover(runtime, targetCwd, cache = new ClassificationCache(), options) {
  if (runtime === "claude-code") {
    return discoverClaudeCode(targetCwd, cache, options);
  }
  if (runtime === "codex") return discoverCodex(targetCwd, cache, options);
  if (runtime === "cursor") return discoverCursor(targetCwd, cache, options);
  throw new Error(`Unknown runtime: ${runtime}`);
}
async function findSessionCandidate(runtime, targetCwd, sessionId, options) {
  const cache = new ClassificationCache();
  const candidates = runtime === "cursor" ? await findCursorSessionCandidates(targetCwd, sessionId, cache) : await discover(runtime, targetCwd, cache, options);
  const matches = candidates.filter(
    (candidate) => candidate.recordedCwd === targetCwd && candidate.sessionId === sessionId
  );
  return matches.length === 1 ? matches[0] : null;
}
async function findNewerSameCwdCandidates(runtime, targetCwd, watched, cache = new ClassificationCache()) {
  const candidates = await discover(runtime, targetCwd, cache);
  return candidates.filter(
    (candidate) => candidate.recordedCwd === targetCwd && candidate.sessionId !== watched.sessionId && candidate.transcriptPath !== watched.transcriptPath && candidate.mtime > watched.mtime
  ).toSorted(
    (left, right) => right.mtime - left.mtime || left.transcriptPath.localeCompare(right.transcriptPath)
  );
}
async function gitWorktrees(cwd) {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", cwd, "worktree", "list", "--porcelain"],
      {
        timeout: 5e3
      }
    );
    const paths = [];
    for (const line of stdout.split("\n")) {
      if (line.startsWith("worktree ")) {
        paths.push(line.slice("worktree ".length).trim());
      }
    }
    return paths;
  } catch {
    return [];
  }
}

// src/skills/session-observer/src/lib/observe.ts
import { createHash as createHash4, randomUUID as randomUUID2 } from "node:crypto";
import { open as open6, readFile as readFile5 } from "node:fs/promises";

// src/skills/session-observer/src/lib/rank.ts
import { realpathSync } from "node:fs";
var TIE_WINDOW_SEC = 5;
var ACTIVE_THRESHOLD_SEC = 60;
var CLOSE_REAL_MESSAGE_DELTA = 2;
var CLOSE_SIZE_RATIO = 0.9;
var CLOSE_SIZE_ABS = 4096;
function stripTrailingSlashes(path) {
  if (path === "/") return path;
  return path.replace(/\/+$/u, "");
}
function realpathSafe(path) {
  try {
    return realpathSync.native(path);
  } catch {
    return path;
  }
}
function normalizeCwdPath(path) {
  return stripTrailingSlashes(realpathSafe(path));
}
function tierOf(candidate, targetCwd) {
  const { recordedCwd } = candidate;
  if (!recordedCwd) return "C";
  const normalizedRecordedCwd = normalizeCwdPath(recordedCwd);
  const normalizedTargetCwd = normalizeCwdPath(targetCwd);
  if (normalizedRecordedCwd === normalizedTargetCwd) return "A";
  if (normalizedRecordedCwd.startsWith(normalizedTargetCwd + "/")) return "B";
  if (normalizedTargetCwd.startsWith(normalizedRecordedCwd + "/")) return "B";
  return "C";
}
function cwdSlugVariants(cwd) {
  return [
    .../* @__PURE__ */ new Set([
      cwd.split(/[/.]/u).filter(Boolean).join("-"),
      cwd.replace(/[/.]/g, "-"),
      cwd.replace(/\//g, "-")
    ])
  ];
}
function slugFromTranscriptPath(transcriptPath) {
  const marker = "/.claude/projects/";
  const index = transcriptPath.indexOf(marker);
  if (index === -1) return null;
  const rest = transcriptPath.slice(index + marker.length);
  const slash = rest.indexOf("/");
  return slash === -1 ? rest : rest.slice(0, slash);
}
function parentSlugMatches(candidate, targetCwd) {
  const slug = candidate.cwdSlug ?? slugFromTranscriptPath(candidate.transcriptPath ?? "");
  if (!slug) return false;
  return cwdSlugVariants(targetCwd).includes(slug);
}
function engagementStatus(candidate) {
  const status = candidate.engagementStatus ?? candidate.engagement?.status;
  return status === "unengaged" ? "unengaged" : "engaged";
}
function isEngaged(candidate) {
  return engagementStatus(candidate) !== "unengaged";
}
function metric(candidate, key) {
  const value = candidate[key] ?? candidate.engagement?.[key];
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}
function hasAssistantAndUser(candidate) {
  return Boolean(
    candidate.hasAssistantAndUser ?? candidate.engagement?.hasAssistantAndUser
  );
}
function compareCandidatePreference(a, b) {
  if (isEngaged(a) !== isEngaged(b)) return isEngaged(a) ? -1 : 1;
  if (hasAssistantAndUser(a) !== hasAssistantAndUser(b)) {
    return hasAssistantAndUser(a) ? -1 : 1;
  }
  const realMessageDelta = metric(b, "realMessageCount") - metric(a, "realMessageCount");
  if (realMessageDelta !== 0) return realMessageDelta;
  const userDelta = metric(b, "genuineUserMessages") - metric(a, "genuineUserMessages");
  if (userDelta !== 0) return userDelta;
  const assistantDelta = metric(b, "assistantMessages") - metric(a, "assistantMessages");
  if (assistantDelta !== 0) return assistantDelta;
  const sizeDelta = (b.size ?? 0) - (a.size ?? 0);
  if (sizeDelta !== 0) return sizeDelta;
  return (b.mtime ?? 0) - (a.mtime ?? 0);
}
function sizesClose(a, b) {
  const aSize = Number(a.size ?? 0);
  const bSize = Number(b.size ?? 0);
  const diff = Math.abs(aSize - bSize);
  if (diff <= CLOSE_SIZE_ABS) return true;
  const larger = Math.max(aSize, bSize);
  const smaller = Math.min(aSize, bSize);
  if (larger === 0) return true;
  return smaller / larger >= CLOSE_SIZE_RATIO;
}
function closeEngagedTie(winner, candidate, tieWindowSec) {
  if (!isEngaged(winner) || !isEngaged(candidate)) return false;
  if (hasAssistantAndUser(winner) !== hasAssistantAndUser(candidate))
    return false;
  if (Math.abs(
    metric(winner, "realMessageCount") - metric(candidate, "realMessageCount")
  ) > CLOSE_REAL_MESSAGE_DELTA)
    return false;
  if (!sizesClose(winner, candidate)) return false;
  return Math.abs((winner.mtime ?? 0) - (candidate.mtime ?? 0)) <= tieWindowSec;
}
function rank(candidates, targetCwd, opts = {}) {
  const {
    tieWindowSec = TIE_WINDOW_SEC,
    gitWorktrees: gitWorktrees2 = [],
    globalRecentProvider
  } = opts;
  const byTier = {
    A: [],
    B: [],
    C: []
  };
  for (const c of candidates) {
    const tier = tierOf(c, targetCwd);
    if (tier === "A" || tier === "B") {
      byTier[tier].push(c);
    } else if (parentSlugMatches(c, targetCwd)) {
      byTier.C.push(c);
    }
  }
  let winningTier = null;
  let winningPool = null;
  if (byTier.A.length > 0) {
    winningTier = "A";
    winningPool = byTier.A;
  } else if (byTier.B.length > 0) {
    winningTier = "B";
    winningPool = byTier.B;
  } else if (byTier.C.length > 0) {
    winningTier = "C";
    winningPool = byTier.C;
  }
  if (!winningTier) {
    const allByMtime = [...candidates].toSorted((a, b) => b.mtime - a.mtime);
    const globalRecent = globalRecentProvider ? globalRecentProvider() : allByMtime.slice(0, 5);
    return {
      winner: null,
      noMatch: true,
      sisters: Array.isArray(gitWorktrees2) ? gitWorktrees2 : [],
      globalRecent
    };
  }
  const pool = winningPool ?? [];
  const engagedPool = pool.filter(isEngaged);
  const unengagedPool = pool.filter((candidate) => !isEngaged(candidate));
  if (engagedPool.length === 0) {
    return {
      winner: null,
      unengagedOnly: true,
      tier: winningTier,
      candidates: [...pool].toSorted(compareCandidatePreference),
      message: "Only unengaged sessions matched this cwd."
    };
  }
  const sorted = [...engagedPool].toSorted(compareCandidatePreference);
  const winner = sorted[0];
  const annotatedWinner = {
    ...winner,
    active: winner.ageSec < ACTIVE_THRESHOLD_SEC
  };
  const ties = sorted.slice(1).filter((c) => closeEngagedTie(winner, c, tieWindowSec));
  const fallbacks = [
    ...sorted.slice(1),
    ...unengagedPool.toSorted(compareCandidatePreference)
  ];
  return {
    winner: annotatedWinner,
    tier: winningTier,
    ties,
    fallbacks
  };
}

// src/skills/session-observer/src/lib/state.ts
import {
  access,
  link as link2,
  mkdir as mkdir3,
  open as open5,
  readFile as readFile4,
  readdir as readdir2,
  rename as rename3,
  stat as stat3,
  unlink as unlink3
} from "node:fs/promises";
import { homedir as homedir4 } from "node:os";
import { dirname as dirname2, join as join4 } from "node:path";
var SCHEMA_VERSION3 = 1;
var LOCK_RETRIES2 = 100;
var LOCK_INTERVAL_MS2 = 50;
var CURSOR_COMPATIBILITY = "pre-integration-record-index";
var migrationBackupSequence = 0;
var lockSequence2 = 0;
function isErrnoException2(err) {
  return err instanceof Error && "code" in err;
}
function stateDir2() {
  return process.env.STATE_DIR ?? join4(homedir4(), ".local", "state", "session-observer");
}
function statePath2(dir) {
  return join4(dir, "state.json");
}
function lockPath2(dir) {
  return join4(dir, "state.json.lock");
}
function cursorTransitionLockPath(dir) {
  return join4(dir, "cursor-state-transition.lock");
}
function tmpPath(dir) {
  return join4(dir, `state.json.${process.pid}.tmp`);
}
function bakPath(dir, label) {
  return join4(dir, `state.json.${label}-${Date.now()}-${process.pid}.bak`);
}
function isPidLive(pid) {
  if (typeof pid !== "number" || !Number.isInteger(pid) || pid <= 0)
    return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if (isErrnoException2(err) && err.code === "ESRCH") return false;
    if (isErrnoException2(err) && err.code === "EPERM") return true;
    throw err;
  }
}
function lockOwnerPid2(owner) {
  if (!/^[1-9]\d*$/u.test(owner) && !/^[1-9]\d*:\d+:[1-9]\d*$/u.test(owner)) {
    return null;
  }
  const pid = Number(owner.split(":", 1)[0]);
  return Number.isSafeInteger(pid) && pid > 0 ? pid : null;
}
function lockOwnersPath2(lock) {
  return `${lock}.owners`;
}
function lockOwnerTokensPath2(lock) {
  return `${lock}.owner-tokens`;
}
function contenderTicket2(name) {
  const match = /^(\d{20})\.owner$/u.exec(name);
  if (!match) return null;
  const ticket = Number(match[1]);
  return Number.isSafeInteger(ticket) ? ticket : null;
}
function privateTokenPid2(name) {
  const match = /^([1-9]\d*)-\d+-[1-9]\d*\.token$/u.exec(name);
  if (!match) return null;
  const pid = Number(match[1]);
  return Number.isSafeInteger(pid) ? pid : null;
}
async function cleanupAbandonedPrivateTokens2(lock) {
  const tokens = lockOwnerTokensPath2(lock);
  let names;
  try {
    names = await readdir2(tokens);
  } catch (error) {
    if (isErrnoException2(error) && error.code === "ENOENT") return;
    throw error;
  }
  for (const name of names) {
    const pid = privateTokenPid2(name);
    if (pid === null || isPidLive(pid)) continue;
    await unlink3(join4(tokens, name)).catch((error) => {
      if (!isErrnoException2(error) || error.code !== "ENOENT") throw error;
    });
  }
}
async function createLockContender2(lock, owner, options = {}) {
  const owners = lockOwnersPath2(lock);
  const tokens = lockOwnerTokensPath2(lock);
  await mkdir3(owners, { recursive: true, mode: 448 });
  await mkdir3(tokens, { recursive: true, mode: 448 });
  await cleanupAbandonedPrivateTokens2(lock);
  const privatePath = join4(tokens, `${owner.replaceAll(":", "-")}.token`);
  let handle;
  try {
    handle = await open5(privatePath, "wx", 384);
    await options.onLockPublicationBoundary?.("private-created");
    await handle.writeFile(owner, "utf8");
    await options.onLockPublicationBoundary?.("token-written");
    await handle.datasync();
    await options.onLockPublicationBoundary?.("token-synced");
    await handle.close();
    handle = void 0;
    for (let attempt = 0; attempt < LOCK_RETRIES2; attempt += 1) {
      const names = await readdir2(owners);
      let maximum = 0;
      for (const name of names) {
        const ticket = contenderTicket2(name);
        if (ticket === null) {
          throw new Error(`state.mjs: invalid lock contender ${name}`);
        }
        maximum = Math.max(maximum, ticket);
      }
      const next = maximum + 1;
      if (!Number.isSafeInteger(next)) {
        throw new Error("state.mjs: lock contender sequence exhausted");
      }
      const ownerPath = join4(owners, `${String(next).padStart(20, "0")}.owner`);
      try {
        await link2(privatePath, ownerPath);
        await unlink3(privatePath).catch(() => void 0);
        return ownerPath;
      } catch (error) {
        if (!isErrnoException2(error) || error.code !== "EEXIST") throw error;
      }
    }
    throw new Error("state.mjs: could not allocate lock contender");
  } finally {
    if (handle) await handle.close();
    await unlink3(privatePath).catch(() => void 0);
  }
}
async function contenderOwnsTurn2(lock, ownerPath, owner) {
  const owners = lockOwnersPath2(lock);
  const live = [];
  for (const name of (await readdir2(owners)).toSorted()) {
    if (contenderTicket2(name) === null) return false;
    const path = join4(owners, name);
    let contenderOwner;
    try {
      contenderOwner = await readFile4(path, "utf8");
    } catch (error) {
      if (isErrnoException2(error) && error.code === "ENOENT") continue;
      throw error;
    }
    const pid = lockOwnerPid2(contenderOwner);
    if (pid === null) return false;
    if (!isPidLive(pid)) {
      await unlink3(path).catch((error) => {
        if (!isErrnoException2(error) || error.code !== "ENOENT") throw error;
      });
      continue;
    }
    if (path === ownerPath && contenderOwner !== owner) return false;
    live.push(path);
  }
  return live[0] === ownerPath;
}
async function readLockGeneration2(lock) {
  try {
    const rawOwner = await readFile4(lock, "utf8");
    const current = await stat3(lock);
    return { rawOwner, device: current.dev, inode: current.ino };
  } catch (error) {
    if (isErrnoException2(error) && error.code === "ENOENT") return null;
    throw error;
  }
}
function sameLockGeneration2(left, right) {
  return right !== null && left.rawOwner === right.rawOwner && left.device === right.device && left.inode === right.inode;
}
async function acquireLock2(lock, options = {}) {
  const owner = `${process.pid}:${Date.now()}:${++lockSequence2}`;
  const ownerPath = await createLockContender2(lock, owner, options);
  try {
    for (let attempt = 0; attempt < LOCK_RETRIES2; attempt += 1) {
      if (!await contenderOwnsTurn2(lock, ownerPath, owner)) {
        await sleep2(LOCK_INTERVAL_MS2);
        continue;
      }
      try {
        await link2(ownerPath, lock);
        return { owner, ownerPath };
      } catch (error) {
        if (!isErrnoException2(error) || error.code !== "EEXIST") throw error;
      }
      const observed = await readLockGeneration2(lock);
      if (observed === null) continue;
      const ownerPid = lockOwnerPid2(observed.rawOwner);
      if (ownerPid === null || isPidLive(ownerPid)) {
        await sleep2(LOCK_INTERVAL_MS2);
        continue;
      }
      const current = await readLockGeneration2(lock);
      if (!sameLockGeneration2(observed, current)) continue;
      try {
        await unlink3(lock);
      } catch (error) {
        if (!isErrnoException2(error) || error.code !== "ENOENT") throw error;
      }
    }
  } catch (error) {
    await unlink3(ownerPath).catch(() => void 0);
    throw error;
  }
  await unlink3(ownerPath).catch(() => void 0);
  throw new Error(
    `state.mjs: could not acquire lock after ${LOCK_RETRIES2} retries`
  );
}
async function releaseLock2(lock, ownership) {
  try {
    if (await readFile4(lock, "utf8") === ownership.owner) {
      await unlink3(lock);
    }
  } catch (error) {
    if (!isErrnoException2(error) || error.code !== "ENOENT") throw error;
  }
  try {
    await unlink3(ownership.ownerPath);
  } catch (error) {
    if (!isErrnoException2(error) || error.code !== "ENOENT") throw error;
  }
}
async function withCursorTransitionLock(transition, options = {}) {
  const dir = stateDir2();
  await mkdir3(dir, { recursive: true });
  const lock = cursorTransitionLockPath(dir);
  const ownership = await acquireLock2(lock, options);
  try {
    return await transition();
  } finally {
    await releaseLock2(lock, ownership);
  }
}
function sleep2(ms) {
  return new Promise((resolve3) => setTimeout(resolve3, ms));
}
function emptyState() {
  return { schemaVersion: SCHEMA_VERSION3, sessions: {} };
}
async function writeBackup2(dir, label, content) {
  const bak = bakPath(dir, label);
  const tmp = bak + ".tmp";
  let fh;
  try {
    fh = await open5(tmp, "w");
    await fh.write(content);
    await fh.datasync();
    await fh.close();
    fh = null;
    await rename3(tmp, bak);
  } catch {
  } finally {
    if (fh) {
      try {
        await fh.close();
      } catch {
      }
    }
    try {
      await unlink3(tmp);
    } catch {
    }
  }
}
async function readState(dir) {
  const file = statePath2(dir);
  let raw;
  try {
    raw = await readFile4(file, "utf8");
  } catch (err) {
    if (isErrnoException2(err) && err.code === "ENOENT") return emptyState();
    throw err;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await writeBackup2(dir, "corrupt", raw);
    return emptyState();
  }
  return migrateIfNeeded(parsed, dir, raw);
}
async function migrateIfNeeded(parsed, dir, rawBackup) {
  const state = parsed;
  if (typeof state.schemaVersion === "number" && state.schemaVersion >= SCHEMA_VERSION3) {
    return state;
  }
  await writeBackup2(dir, "v0", rawBackup ?? JSON.stringify(parsed));
  return {
    schemaVersion: SCHEMA_VERSION3,
    sessions: state.sessions ?? {}
  };
}
async function writeState(dir, state) {
  await mkdir3(dir, { recursive: true });
  const tmp = tmpPath(dir);
  const dest = statePath2(dir);
  let fh;
  try {
    fh = await open5(tmp, "w");
    await fh.write(JSON.stringify(state, null, 2));
    await fh.datasync();
    await fh.close();
    fh = null;
    await rename3(tmp, dest);
  } finally {
    if (fh) {
      try {
        await fh.close();
      } catch {
      }
    }
    try {
      await unlink3(tmp);
    } catch {
    }
  }
}
function sessionKey(runtime, sessionId) {
  return `${runtime}:${sessionId}`;
}
function isCursorCompatibilityEntry(entry) {
  return entry?.runtime === "cursor" && entry.cursorCompatibility === CURSOR_COMPATIBILITY;
}
async function loadLegacyState() {
  const dir = stateDir2();
  await mkdir3(dir, { recursive: true });
  const lock = lockPath2(dir);
  const owner = await acquireLock2(lock);
  try {
    return await readState(dir);
  } finally {
    await releaseLock2(lock, owner);
  }
}
async function notifyMigrationBoundary(options, boundary) {
  await options.onBoundary?.(boundary);
}
function nextMigrationBackupPath(dir) {
  migrationBackupSequence += 1;
  return join4(
    dir,
    `state.json.cursor-legacy-${Date.now()}-${process.pid}-${migrationBackupSequence}.bak`
  );
}
async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
async function writeMigrationBackup(dir, destination, raw) {
  if (dirname2(destination) !== dir) {
    throw new Error("LEGACY_BACKUP_PATH_INVALID");
  }
  if (await pathExists(destination)) return;
  const temporary = `${destination}.${process.pid}.tmp`;
  let handle;
  try {
    handle = await open5(temporary, "w", 384);
    await handle.writeFile(raw, "utf8");
    await handle.datasync();
    await handle.close();
    handle = void 0;
    await rename3(temporary, destination);
  } finally {
    if (handle) await handle.close();
    try {
      await unlink3(temporary);
    } catch {
    }
  }
}
async function removeLegacyCursorForMigration(marker, options) {
  const dir = stateDir2();
  if (dirname2(marker.backupPath) !== dir) {
    throw new Error("LEGACY_BACKUP_PATH_INVALID");
  }
  await mkdir3(dir, { recursive: true });
  const lock = lockPath2(dir);
  const owner = await acquireLock2(lock);
  try {
    const state = await readState(dir);
    const key = sessionKey("cursor", marker.sessionId);
    const entry = state.sessions[key];
    if (!entry) {
      if (!await pathExists(marker.backupPath)) {
        throw new Error("LEGACY_BACKUP_MISSING");
      }
      return;
    }
    if (entry.runtime !== "cursor" || !Number.isSafeInteger(entry.lastRecordIndex) || entry.lastRecordIndex < 0 || entry.lastRecordIndex !== marker.legacyLastRecordIndex) {
      throw new Error("LEGACY_CURSOR_CHANGED");
    }
    const raw = await readFile4(statePath2(dir), "utf8");
    await writeMigrationBackup(dir, marker.backupPath, raw);
    await notifyMigrationBoundary(options, "backup-written");
    delete state.sessions[key];
    await writeState(dir, state);
    await notifyMigrationBoundary(options, "legacy-removed");
  } finally {
    await releaseLock2(lock, owner);
  }
}
async function migrateLegacyCursorStateUnderTransition(sessionId, options = {}) {
  const key = cursorSessionKey(sessionId);
  let cursorState = await loadCursorState();
  let marker = cursorState.legacyUnverified[key];
  if (!marker) {
    const legacy = await loadLegacyState();
    const entry = legacy.sessions[sessionKey("cursor", sessionId)];
    if (!entry) return null;
    if (isCursorCompatibilityEntry(entry)) return null;
    if (entry.runtime !== "cursor" || !Number.isSafeInteger(entry.lastRecordIndex) || entry.lastRecordIndex < 0) {
      throw new Error("LEGACY_CURSOR_INVALID");
    }
    const proposed = {
      runtime: "cursor",
      sessionId,
      legacyLastRecordIndex: entry.lastRecordIndex,
      ...typeof entry.transcriptPath === "string" ? { transcriptPath: entry.transcriptPath } : {},
      ...entry.recordedCwd === null || typeof entry.recordedCwd === "string" ? { recordedCwd: entry.recordedCwd } : {},
      ...typeof entry.lastReadAt === "string" && Number.isFinite(Date.parse(entry.lastReadAt)) ? { lastReadAt: entry.lastReadAt } : {},
      backupPath: nextMigrationBackupPath(stateDir2()),
      migrationStatus: "marker-written",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    cursorState = await mutateCursorState((state) => {
      state.legacyUnverified[key] ??= proposed;
    });
    marker = cursorState.legacyUnverified[key];
    await notifyMigrationBoundary(options, "marker-written");
  }
  await removeLegacyCursorForMigration(marker, options);
  cursorState = await mutateCursorState((state) => {
    const current = state.legacyUnverified[key];
    if (!current) throw new Error("LEGACY_CURSOR_MARKER_MISSING");
    if (current.migrationStatus === "marker-written") {
      current.migrationStatus = "legacy-removed";
    }
  });
  marker = cursorState.legacyUnverified[key];
  await notifyMigrationBoundary(options, "marker-legacy-removed");
  cursorState = await mutateCursorState((state) => {
    const current = state.legacyUnverified[key];
    if (!current) throw new Error("LEGACY_CURSOR_MARKER_MISSING");
    if (current.migrationStatus !== "complete") {
      current.migrationStatus = "complete";
    }
  });
  marker = cursorState.legacyUnverified[key];
  await notifyMigrationBoundary(options, "complete");
  return marker;
}
async function migrateLegacyCursorState(sessionId, options = {}) {
  return withCursorTransitionLock(
    () => migrateLegacyCursorStateUnderTransition(sessionId, options)
  );
}
function cursorRecoveryEntry(marker) {
  return {
    runtime: "cursor",
    sessionId: marker.sessionId,
    lastRecordIndex: 0,
    lastTotalRecords: marker.legacyLastRecordIndex,
    recoveryRequired: true,
    recoveryCode: "LEGACY_CURSOR_UNVERIFIED",
    legacyLastRecordIndex: marker.legacyLastRecordIndex,
    migrationStatus: marker.migrationStatus,
    backupPath: marker.backupPath,
    ...marker.transcriptPath ? { transcriptPath: marker.transcriptPath } : {},
    ...marker.recordedCwd !== void 0 ? { recordedCwd: marker.recordedCwd } : {},
    ...marker.lastReadAt ? { lastReadAt: marker.lastReadAt } : {}
  };
}
async function load() {
  let legacy = await loadLegacyState();
  const legacyCursorIds = Object.values(legacy.sessions).filter(
    (entry) => entry.runtime === "cursor" && !isCursorCompatibilityEntry(entry)
  ).map((entry) => entry.sessionId);
  for (const sessionId of legacyCursorIds) {
    await migrateLegacyCursorState(sessionId);
  }
  legacy = await loadLegacyState();
  const cursor = await loadCursorState();
  const sessions = { ...legacy.sessions };
  for (const entry of Object.values(cursor.sessions)) {
    sessions[cursorSessionKey(entry.sessionId)] = {
      runtime: "cursor",
      sessionId: entry.sessionId,
      lastRecordIndex: entry.lastRecordIndex,
      lastTotalRecords: entry.lastRecordIndex,
      transcriptPath: entry.transcriptPath,
      recordedCwd: entry.canonicalCwd,
      indexBase: entry.indexBase,
      continuity: entry.continuity,
      lastStatus: entry.lastStatus,
      recoveryRequired: false
    };
  }
  for (const marker of Object.values(cursor.legacyUnverified)) {
    sessions[cursorSessionKey(marker.sessionId)] = cursorRecoveryEntry(marker);
  }
  return { schemaVersion: SCHEMA_VERSION3, sessions };
}
async function mutate(fn, options = {}) {
  const dir = stateDir2();
  await mkdir3(dir, { recursive: true });
  const lock = lockPath2(dir);
  const owner = await acquireLock2(lock, options);
  try {
    const current = await readState(dir);
    const next = fn(current) ?? current;
    await writeState(dir, next);
    return next;
  } finally {
    await releaseLock2(lock, owner);
  }
}
async function getSession(runtime, sessionId) {
  if (runtime === "cursor") {
    const legacy = await loadLegacyState();
    const compatibility = legacy.sessions[sessionKey(runtime, sessionId)];
    const cursor = await loadCursorState();
    if (cursor.sessions[cursorSessionKey(sessionId)]) {
      throw new Error(
        "CURSOR_STATE_V2_REQUIRES_OBSERVATION_PROJECTION: legacy record-index reads are disabled"
      );
    }
    const existingMarker = cursor.legacyUnverified[cursorSessionKey(sessionId)];
    if (existingMarker?.legacyLastRecordIndex !== void 0) {
      if (existingMarker.legacyLastRecordIndex === 0) return null;
      throw new Error(
        `LEGACY_CURSOR_UNVERIFIED: reset cursor:${sessionId} to replay from frame zero`
      );
    }
    if (isCursorCompatibilityEntry(compatibility)) return compatibility;
    const marker = await migrateLegacyCursorState(sessionId);
    if (marker) {
      if (marker.legacyLastRecordIndex === 0) return null;
      throw new Error(
        `LEGACY_CURSOR_UNVERIFIED: reset cursor:${sessionId} to replay from frame zero`
      );
    }
    return null;
  }
  const state = await loadLegacyState();
  const key = sessionKey(runtime, sessionId);
  return state.sessions[key] ?? null;
}
async function markRead(runtime, sessionId, {
  lastRecordIndex,
  lastTotalRecords,
  transcriptPath,
  recordedCwd
}, options = {}) {
  if (runtime === "cursor") {
    return withCursorTransitionLock(async () => {
      const key2 = cursorSessionKey(sessionId);
      const cursor = await loadCursorState();
      if (cursor.sessions[key2]) {
        throw new Error(
          "CURSOR_STATE_V2_REQUIRED: legacy record-index Cursor writes are disabled"
        );
      }
      const marker = cursor.legacyUnverified[key2];
      if (marker && marker.legacyLastRecordIndex !== 0) {
        throw new Error(
          `LEGACY_CURSOR_UNVERIFIED: reset cursor:${sessionId} to replay from frame zero`
        );
      }
      await options.onCompatibilityBoundary?.("prechecked");
      const writeId = `${process.pid}:${Date.now()}:${++migrationBackupSequence}`;
      let preimage;
      await mutate((state) => {
        const existing = state.sessions[key2];
        preimage = existing ? structuredClone(existing) : void 0;
        state.sessions[key2] = {
          ...existing,
          runtime,
          sessionId,
          lastRecordIndex,
          lastTotalRecords,
          lastReadAt: (/* @__PURE__ */ new Date()).toISOString(),
          transcriptPath,
          recordedCwd,
          watchedByPid: existing?.watchedByPid ?? null,
          cursorCompatibility: CURSOR_COMPATIBILITY,
          cursorCompatibilityWriteId: writeId
        };
      });
      await options.onCompatibilityBoundary?.("legacy-written");
      try {
        await mutateCursorState((state) => {
          if (state.sessions[key2]) {
            throw new Error(
              "CURSOR_STATE_V2_REQUIRED: legacy record-index Cursor writes are disabled"
            );
          }
          const current = state.legacyUnverified[key2];
          if (current && current.legacyLastRecordIndex !== 0) {
            throw new Error(
              `LEGACY_CURSOR_UNVERIFIED: reset cursor:${sessionId} to replay from frame zero`
            );
          }
          delete state.legacyUnverified[key2];
        });
      } catch (error) {
        let restored = false;
        await mutate((state) => {
          const current = state.sessions[key2];
          if (isCursorCompatibilityEntry(current) && current.cursorCompatibilityWriteId === writeId) {
            if (preimage) state.sessions[key2] = preimage;
            else delete state.sessions[key2];
            restored = true;
          }
        });
        if (!restored) {
          throw new Error("CURSOR_COMPATIBILITY_ROLLBACK_CONFLICT", {
            cause: error
          });
        }
        throw error;
      }
      await options.onCompatibilityBoundary?.("cursor-updated");
    }, options);
  }
  const key = sessionKey(runtime, sessionId);
  await mutate((state) => {
    const existing = state.sessions[key] ?? {};
    state.sessions[key] = {
      ...existing,
      runtime,
      sessionId,
      lastRecordIndex,
      lastTotalRecords,
      lastReadAt: (/* @__PURE__ */ new Date()).toISOString(),
      transcriptPath,
      recordedCwd,
      watchedByPid: existing.watchedByPid ?? null
    };
    return state;
  });
}
async function setWatchedByPid(runtime, sessionId, pid) {
  if (runtime === "cursor") {
    const key2 = sessionKey(runtime, sessionId);
    let updated2 = false;
    await mutate((state) => {
      const existing = state.sessions[key2];
      if (!isCursorCompatibilityEntry(existing)) return;
      state.sessions[key2] = { ...existing, watchedByPid: pid };
      updated2 = true;
    });
    return updated2;
  }
  const key = sessionKey(runtime, sessionId);
  let updated = false;
  await mutate((state) => {
    const existing = state.sessions[key];
    if (!existing) return state;
    state.sessions[key] = {
      ...existing,
      watchedByPid: pid
    };
    updated = true;
    return state;
  });
  return updated;
}
async function clearWatchedByPid(runtime, sessionId, pid) {
  if (runtime === "cursor") {
    const key2 = sessionKey(runtime, sessionId);
    let updated2 = false;
    await mutate((state) => {
      const existing = state.sessions[key2];
      if (!isCursorCompatibilityEntry(existing)) return;
      if (pid !== void 0 && existing.watchedByPid !== pid) return;
      state.sessions[key2] = { ...existing, watchedByPid: null };
      updated2 = true;
    });
    return updated2;
  }
  const key = sessionKey(runtime, sessionId);
  let updated = false;
  await mutate((state) => {
    const existing = state.sessions[key];
    if (!existing) return state;
    if (pid !== void 0 && existing.watchedByPid !== pid) return state;
    state.sessions[key] = {
      ...existing,
      watchedByPid: null
    };
    updated = true;
    return state;
  });
  return updated;
}

// src/skills/session-observer/src/lib/observe.ts
var VALID_RUNTIMES = ["claude-code", "codex", "cursor"];
var VALID_RUNTIME_LABEL = VALID_RUNTIMES.join(", ");
function isRuntime(value) {
  return typeof value === "string" && VALID_RUNTIMES.includes(value);
}
function parsePinnedSession(session) {
  if (!session) return null;
  const colonIndex = session.indexOf(":");
  if (colonIndex === -1) {
    return {
      error: "--session must be in <runtime>:<sessionId> format (e.g. codex:abc123)"
    };
  }
  const runtime = session.slice(0, colonIndex);
  const sessionId = session.slice(colonIndex + 1);
  if (!isRuntime(runtime)) {
    return {
      error: `Unknown runtime in --session: ${runtime}. Use one of: ${VALID_RUNTIME_LABEL}.`
    };
  }
  return { runtime, sessionId };
}
function shouldMarkCatchUpRead(sessionState, digest) {
  if (digest.range.newRecords > 0) return true;
  if (!sessionState) return true;
  return sessionState.lastRecordIndex !== digest.range.nextIndex || sessionState.lastTotalRecords !== digest.range.totalRecords;
}
async function preferredRuntimeFromState(withCandidates, targetCwd) {
  let state;
  try {
    state = await load();
  } catch {
    return null;
  }
  const runtimeSet = new Set(withCandidates.map((r) => r.runtime));
  const sessionIdsByRuntime = new Map(
    withCandidates.map((r) => [
      r.runtime,
      new Set(r.candidates.map((c) => c.sessionId))
    ])
  );
  const matches = Object.values(state.sessions ?? {}).filter((s) => runtimeSet.has(s.runtime)).filter((s) => s.recordedCwd === targetCwd).filter((s) => sessionIdsByRuntime.get(s.runtime)?.has(s.sessionId)).toSorted(
    (a, b) => String(b.lastReadAt ?? "").localeCompare(String(a.lastReadAt ?? ""))
  );
  const runtimes = [...new Set(matches.map((s) => s.runtime))];
  if (runtimes.length !== 1) return null;
  return {
    runtime: runtimes[0],
    reason: "state-cwd-prior-session",
    sessionId: matches[0]?.sessionId
  };
}
async function resolveAutoRuntime(targetCwd, { self = process.env.SESSION_OBSERVER_SELF } = {}) {
  const results = await Promise.all(
    VALID_RUNTIMES.map(async (rt) => {
      try {
        const candidates = await discover(rt, targetCwd);
        return { runtime: rt, candidates };
      } catch {
        return { runtime: rt, candidates: [] };
      }
    })
  );
  const withCandidates = results.filter((r) => r.candidates.length > 0);
  const considered = isRuntime(self) ? withCandidates.filter((r) => r.runtime !== self) : withCandidates;
  if (considered.length === 1) return { runtime: considered[0].runtime };
  if (considered.length === 0) return { noMatch: true };
  const preferred = await preferredRuntimeFromState(considered, targetCwd);
  if (preferred) return preferred;
  return {
    ambiguous: true,
    runtimes: considered.map((r) => r.runtime),
    candidates: Object.fromEntries(
      considered.map((r) => [r.runtime, r.candidates])
    )
  };
}
async function applySnippetFilter(candidates, snippet) {
  if (!snippet) return { candidates, matches: [] };
  const needle = snippet.toLowerCase();
  const matches = [];
  for (const candidate of candidates) {
    let raw;
    try {
      raw = await readFile5(candidate.transcriptPath, "utf8");
    } catch {
      continue;
    }
    const index = raw.toLowerCase().indexOf(needle);
    if (index === -1) continue;
    const start = Math.max(0, index - 80);
    const end = Math.min(raw.length, index + snippet.length + 80);
    const snippetMatch = {
      excerpt: snippet,
      context: raw.slice(start, end).replace(/\s+/g, " ").trim()
    };
    matches.push({ ...candidate, snippetMatch });
  }
  return { candidates: matches, matches };
}
function noMatchOutcome(payload, message) {
  return { ok: false, kind: "noMatch", exitCode: 2, payload, message };
}
function inputNeededOutcome(kind, payload, message) {
  return { ok: false, kind, exitCode: 3, payload, message };
}
function errorOutcome(message) {
  return { ok: false, kind: "error", exitCode: 1, payload: {}, message };
}
function unengagedOnlyMessage(runtime, cwd) {
  return `The only ${runtime} session for this cwd has no user conversation yet: ${cwd}. It looks like a freshly spawned/bootstrap session you have not engaged with. Did you mean a different session (another runtime, a sister worktree, or a specific session id)?`;
}
async function sessionStateFor(runtime, sessionId) {
  try {
    return await getSession(runtime, sessionId);
  } catch {
    return null;
  }
}
async function markReadIfNeeded(runtime, candidate, sessionState, digest) {
  if (!shouldMarkCatchUpRead(sessionState, digest)) return false;
  try {
    await markRead(runtime, candidate.sessionId, {
      lastRecordIndex: digest.range.nextIndex,
      lastTotalRecords: digest.range.totalRecords,
      transcriptPath: candidate.transcriptPath,
      recordedCwd: candidate.recordedCwd
    });
    return true;
  } catch {
    return false;
  }
}
function watchedByPidWarnings(sessionState, suppressWatchedWarningPid) {
  const watchedByPid = sessionState?.watchedByPid;
  if (!watchedByPid || watchedByPid === suppressWatchedWarningPid) return [];
  return [
    `watcher pid ${watchedByPid} is also reading this session; offsets may interleave (benign)`
  ];
}
async function buildCatchUpDigest(runtime, candidate, {
  fromIndex,
  includeTools,
  includeToolResults,
  includeCommandMessages,
  maxTurns,
  maxBytes,
  matchedTier = null,
  active = false,
  warnings = [],
  fallbacks = []
}) {
  return buildDigest(runtime, candidate.transcriptPath, {
    fromIndex,
    mode: "catch-up",
    includeToolCalls: includeTools,
    includeToolResults,
    includeCommandMessages,
    maxTurns,
    maxBytes,
    sessionId: candidate.sessionId,
    recordedCwd: candidate.recordedCwd,
    matchedTier,
    active,
    warnings,
    fallbacks
  });
}
var EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
function initialCursorStatus() {
  return {
    engagement: "unknown",
    activity: "none",
    content: "none",
    lifecycle: "none",
    delivery: "none",
    health: "unknown"
  };
}
function initialCursorSession(identity, scan) {
  return {
    runtime: "cursor",
    sessionId: identity.sessionId,
    indexBase: "zero-based-jsonl-frame-index",
    lastRecordIndex: 0,
    canonicalCwd: identity.canonicalCwd,
    transcriptPath: identity.canonicalTranscriptPath,
    continuity: {
      indexBase: "zero-based-jsonl-frame-index",
      nextFrameIndex: 0,
      prefixBytes: 0,
      prefixSha256: EMPTY_SHA256,
      observedSize: scan.file.size,
      device: scan.file.device,
      inode: scan.file.inode
    },
    lastStatus: initialCursorStatus(),
    openTurn: null,
    stabilityCandidate: null,
    pendingDelivery: null
  };
}
async function scanCursor(identity, fromFrameIndex, verifyPrefixBytes, deps) {
  const accumulator = createCursorTurnAccumulator(identity, fromFrameIndex);
  const frameEnds = [];
  const frameStarts = [];
  const scan = await scanCursorTranscript(identity.canonicalTranscriptPath, {
    verifyPrefixBytes,
    onFrame(frame) {
      accumulator.onFrame(frame);
      frameStarts[frame.frameIndex] = frame.byteStart;
      frameEnds[frame.frameIndex] = frame.closed && (frame.parseState === "parsed" || frame.parseState === "blank") ? frame.byteEnd : null;
    }
  });
  deps.onCursorScan?.();
  return {
    scan,
    analysis: accumulator.finish(scan),
    frameEnds,
    frameStarts
  };
}
function cursorCandidateObservation(result, observedAt, fromFrameIndex = 0) {
  const turn = result.analysis.turns.findLast(
    (candidate) => candidate.lifecycle === "pending" && candidate.assistantRecords.some(
      (record) => record.classification === "substantive" && record.sourceFrameIndex >= fromFrameIndex
    )
  );
  if (turn === void 0 || result.scan.safeThroughFrame === null) return null;
  return {
    turnId: turn.turnId,
    fromFrameIndex: Math.max(turn.fromFrameIndex, fromFrameIndex),
    throughFrameIndex: result.scan.safeThroughFrame,
    entryKeys: turn.assistantRecords.filter(
      (record) => record.classification === "substantive" && record.sourceFrameIndex >= fromFrameIndex
    ).map((record) => record.entryKey),
    prefixBytes: result.scan.safePrefixBytes,
    prefixSha256: result.scan.safePrefixSha256,
    observedAt
  };
}
function sameEntryKeys(left, right) {
  return left.length === right.length && left.every((entryKey, index) => entryKey === right[index]);
}
function cursorObservationAtBoundary(result, boundary, observedAt) {
  if (result.scan.safeThroughFrame === null || result.scan.safeThroughFrame < boundary.throughFrameIndex || result.frameEnds[boundary.throughFrameIndex] !== boundary.prefixBytes) {
    return null;
  }
  const turn = result.analysis.turns.find(
    (candidate) => candidate.turnId === boundary.turnId
  );
  if (turn === void 0 || boundary.fromFrameIndex < turn.fromFrameIndex || boundary.fromFrameIndex > boundary.throughFrameIndex) {
    return null;
  }
  const entryKeys = turn.assistantRecords.filter(
    (record) => record.classification === "substantive" && record.sourceFrameIndex >= boundary.fromFrameIndex && record.sourceFrameIndex <= boundary.throughFrameIndex
  ).map((record) => record.entryKey);
  if (!sameEntryKeys(entryKeys, boundary.entryKeys)) return null;
  return {
    turnId: boundary.turnId,
    fromFrameIndex: boundary.fromFrameIndex,
    throughFrameIndex: boundary.throughFrameIndex,
    entryKeys,
    prefixBytes: boundary.prefixBytes,
    prefixSha256: boundary.prefixSha256,
    observedAt
  };
}
async function captureCursorCheckpoint(transcriptPath, result, nextFrameIndex) {
  const prefixBytes = nextFrameIndex === 0 ? 0 : result.frameEnds[nextFrameIndex - 1];
  if (!Number.isSafeInteger(nextFrameIndex) || nextFrameIndex < 0 || prefixBytes === null || prefixBytes === void 0 || result.scan.file.device === null || result.scan.file.inode === null || prefixBytes > result.scan.safePrefixBytes) {
    return null;
  }
  const selectedHash = createHash4("sha256");
  const safeHash = createHash4("sha256");
  const handle = await open6(transcriptPath, "r");
  try {
    const before = await handle.stat();
    if (before.dev !== result.scan.file.device || before.ino !== result.scan.file.inode || before.size < result.scan.safePrefixBytes) {
      return null;
    }
    let bytesRead = 0;
    if (result.scan.safePrefixBytes > 0) {
      const stream = handle.createReadStream({
        autoClose: false,
        start: 0,
        end: result.scan.safePrefixBytes - 1
      });
      for await (const chunk of stream) {
        const selectedRemaining = prefixBytes - bytesRead;
        if (selectedRemaining > 0) {
          selectedHash.update(
            chunk.subarray(0, Math.min(selectedRemaining, chunk.byteLength))
          );
        }
        safeHash.update(chunk);
        bytesRead += chunk.byteLength;
      }
    }
    const after = await handle.stat();
    if (bytesRead !== result.scan.safePrefixBytes || after.dev !== before.dev || after.ino !== before.ino || after.size < result.scan.safePrefixBytes || safeHash.digest("hex") !== result.scan.safePrefixSha256) {
      return null;
    }
    return {
      indexBase: "zero-based-jsonl-frame-index",
      nextFrameIndex,
      prefixBytes,
      prefixSha256: selectedHash.digest("hex"),
      observedSize: prefixBytes,
      device: before.dev,
      inode: before.ino
    };
  } finally {
    await handle.close();
  }
}
function settledNextFrameIndex(result, throughFrameIndex, minimumNextFrameIndex) {
  let nextFrameIndex = minimumNextFrameIndex;
  for (const turn of result.analysis.turns) {
    if (turn.terminalFrameIndex !== null && turn.terminalFrameIndex < throughFrameIndex) {
      nextFrameIndex = Math.max(nextFrameIndex, turn.terminalFrameIndex + 1);
    }
  }
  return nextFrameIndex;
}
function isLegacyMutableTailCheckpoint(state, result) {
  if (state.pendingDelivery !== null || state.lastRecordIndex === 0 || result.scan.file.device !== state.continuity.device || result.scan.file.inode !== state.continuity.inode || result.scan.file.size < state.continuity.prefixBytes || result.scan.totalFrames < state.lastRecordIndex) {
    return false;
  }
  const finalConsumedFrame = state.lastRecordIndex - 1;
  const byteStart = result.frameStarts[finalConsumedFrame];
  const byteEnd = result.frameEnds[finalConsumedFrame];
  return byteStart !== void 0 && byteEnd !== null && byteEnd !== void 0 && state.continuity.prefixBytes > byteStart && state.continuity.prefixBytes < byteEnd;
}
function reconstructUncertainReplay(pending, result) {
  const { intendedCheckpoint } = pending;
  if (intendedCheckpoint.nextFrameIndex > pending.reservedThroughFrameIndex + 1 || intendedCheckpoint.nextFrameIndex < pending.expectedCheckpoint.nextFrameIndex || result.scan.file.device !== intendedCheckpoint.device || result.scan.file.inode !== intendedCheckpoint.inode || result.scan.file.size < intendedCheckpoint.prefixBytes || result.scan.totalFrames < intendedCheckpoint.nextFrameIndex || result.scan.verifiedPrefixSha256 !== intendedCheckpoint.prefixSha256 || new Set(pending.entryKeys).size !== pending.entryKeys.length) {
    return null;
  }
  const records = new Map(
    result.analysis.turns.flatMap(
      (turn) => turn.assistantRecords.filter(
        (record) => record.classification === "substantive" && record.sourceFrameIndex >= pending.expectedNextFrameIndex && record.sourceFrameIndex <= pending.reservedThroughFrameIndex
      ).map((record) => [record.entryKey, { record, turn }])
    )
  );
  const replay = pending.entryKeys.map((entryKey) => {
    const matched = records.get(entryKey);
    if (!matched) return null;
    const expectedHash = pending.entryHashes?.[entryKey];
    if (expectedHash !== void 0 && expectedHash !== createHash4("sha256").update(matched.record.text).digest("hex")) {
      return null;
    }
    const terminalFrameIndex = matched.turn.terminalFrameIndex;
    const completedWithinReservation = matched.turn.lifecycle === "success" && terminalFrameIndex !== null && terminalFrameIndex <= pending.reservedThroughFrameIndex;
    return {
      role: "assistant",
      text: matched.record.text,
      recordIndex: completedWithinReservation ? terminalFrameIndex : matched.record.sourceFrameIndex,
      sourceFrameIndex: matched.record.sourceFrameIndex,
      kind: "message",
      entryKey: matched.record.entryKey,
      turnId: matched.record.turnId,
      renderTurnId: cursorRenderTurnId(
        matched.turn,
        matched.record.sourceFrameIndex
      ),
      availability: completedWithinReservation ? "completed" : "pending-lifecycle"
    };
  });
  if (replay.some((entry) => entry === null) || replay.some(
    (entry, index) => index > 0 && entry.sourceFrameIndex < replay[index - 1].sourceFrameIndex
  )) {
    return null;
  }
  return replay;
}
function cursorOpenTurn(state, scanResult, digest) {
  const turn = scanResult.analysis.turns.findLast(
    (candidate) => candidate.lifecycle === "pending"
  );
  if (turn === void 0) return null;
  const prior = state.openTurn?.turnId === turn.turnId ? state.openTurn : void 0;
  const deliveredEntryHashes = {
    ...prior?.deliveredEntryHashes,
    ...Object.fromEntries(
      digest.entries.map((entry) => [
        entry.entryKey,
        createHash4("sha256").update(entry.text).digest("hex")
      ])
    )
  };
  return {
    turnId: turn.turnId,
    fromFrameIndex: turn.fromFrameIndex,
    observedThroughFrame: turn.observedThroughFrame,
    deliveredEntryKeys: [
      .../* @__PURE__ */ new Set([
        ...prior?.deliveredEntryKeys ?? [],
        ...digest.entries.map((entry) => entry.entryKey)
      ])
    ],
    deliveredEntryHashes,
    assistantEntryKeys: [
      .../* @__PURE__ */ new Set([
        ...prior?.assistantEntryKeys ?? [],
        ...turn.assistantRecords.map((record) => record.entryKey)
      ])
    ],
    humanRecordIndexes: [
      .../* @__PURE__ */ new Set([
        ...prior?.humanRecordIndexes ?? [],
        ...turn.humanRecordIndexes
      ])
    ],
    toolRecordIndexes: [
      .../* @__PURE__ */ new Set([
        ...prior?.toolRecordIndexes ?? [],
        ...turn.toolRecordIndexes
      ])
    ],
    hasHumanInput: (prior?.hasHumanInput ?? false) || turn.humanRecordIndexes.length > 0,
    hasAutomaticControlInput: prior?.hasAutomaticControlInput ?? false,
    lifecycle: "pending"
  };
}
function createDeliveryHandle(input) {
  let finalized = false;
  const finalize = () => {
    if (finalized) {
      throw new Error("CURSOR_DELIVERY_ALREADY_FINALIZED");
    }
    finalized = true;
  };
  return {
    deliveryId: input.deliveryId,
    sessionId: input.sessionId,
    ownerPid: input.ownerPid,
    entryKeys: [...input.entryKeys],
    async commit() {
      finalize();
      const committed = await commitCursorDelivery({
        sessionId: input.sessionId,
        deliveryId: input.deliveryId,
        nextState: input.nextState
      });
      if (committed === "committed" && input.nextCandidateObservation !== null) {
        await checkpointCursorCandidate({
          sessionId: input.sessionId,
          stabilityMs: input.stabilityMs,
          observation: input.nextCandidateObservation
        });
      }
      return committed;
    },
    async abandon(options) {
      finalize();
      if (options?.deliveryUncertain) {
        const current = await getCursorSession(input.sessionId);
        if (current?.pendingDelivery?.deliveryId !== input.deliveryId) {
          return "stale";
        }
        if (current.pendingDelivery.reservedByPid !== input.ownerPid) {
          return "owner-conflict";
        }
        const recovery = await recoverCursorDelivery(
          input.sessionId
        );
        return recovery.status === "none" ? "stale" : recovery.status;
      }
      return abandonCursorDelivery({
        sessionId: input.sessionId,
        deliveryId: input.deliveryId,
        ownerPid: input.ownerPid
      });
    }
  };
}
async function observeCursorSession(cwd, candidate, args, deps, rankResult) {
  const expectedSessionId = args.session ? parsePinnedSession(args.session) : null;
  const identity = await resolveCursorIdentity(
    candidate,
    cwd,
    expectedSessionId && !("error" in expectedSessionId) ? expectedSessionId.sessionId : void 0
  );
  if (identity.strength !== "exact") {
    return inputNeededOutcome(
      "identityBlocked",
      {
        identityBlocked: true,
        runtime: "cursor",
        cwd,
        reasons: identity.reasons
      },
      `Cursor observation requires exact session identity: ${identity.reasons.join(", ") || identity.strength}`
    );
  }
  let state = await getCursorSession(identity.sessionId);
  const analysisFromFrame = state?.openTurn?.fromFrameIndex ?? state?.continuity.nextFrameIndex ?? 0;
  let first = await scanCursor(
    identity,
    analysisFromFrame,
    state?.continuity.prefixBytes,
    deps
  );
  let continuity = validateCursorContinuity(
    identity,
    first.scan,
    state
  );
  const warnings = [];
  if (continuity.status === "blocked" && continuity.code === "PREFIX_MISMATCH" && state !== null && isLegacyMutableTailCheckpoint(state, first)) {
    const full = analysisFromFrame === 0 ? first : await scanCursor(identity, 0, void 0, deps);
    const settledNext = settledNextFrameIndex(full, state.lastRecordIndex, 0);
    const settledCheckpoint = await captureCursorCheckpoint(
      identity.canonicalTranscriptPath,
      full,
      settledNext
    );
    if (settledCheckpoint !== null) {
      const reanchored = await reanchorCursorSession({
        sessionId: identity.sessionId,
        expectedCheckpoint: state.continuity,
        expectedLastRecordIndex: state.lastRecordIndex,
        continuity: settledCheckpoint
      });
      if (reanchored === "reanchored") {
        state = await getCursorSession(identity.sessionId) ?? state;
        first = full;
        continuity = {
          status: "verified",
          fromFrameIndex: state.lastRecordIndex
        };
        warnings.push(
          `Recovered a legacy Cursor checkpoint that ended inside a grow-in-place frame; re-anchored this session at terminal-settled frame ${settledNext} without changing sibling sessions.`
        );
      }
    }
  }
  if (continuity.status === "blocked") {
    return inputNeededOutcome(
      "continuityBlocked",
      {
        continuityBlocked: true,
        runtime: "cursor",
        cwd,
        code: continuity.code,
        message: continuity.message
      },
      continuity.message
    );
  }
  if (first.scan.blockingFrame?.parseState === "malformed") {
    return inputNeededOutcome(
      "continuityBlocked",
      {
        continuityBlocked: true,
        runtime: "cursor",
        cwd,
        code: "MALFORMED_FRAME"
      },
      `Cursor transcript is blocked by malformed frame ${first.scan.blockingFrame.frameIndex}.`
    );
  }
  if (state === null) {
    state = initialCursorSession(identity, first.scan);
    await setCursorSession(state);
  }
  let deliveryUncertain = null;
  if (state.pendingDelivery !== null) {
    const recovery = await recoverCursorDelivery(
      identity.sessionId
    );
    if (recovery.status === "delivery-uncertain") {
      deliveryUncertain = recovery;
      state = await getCursorSession(identity.sessionId) ?? state;
    }
  }
  let selected = first;
  let selectedObservedAt = new Date(deps.now?.() ?? Date.now()).toISOString();
  let confirmedObservation = null;
  const stabilityMs = Math.max(0, (args.debounceSec ?? 1) * 1e3);
  const deadlineMs = deps.deadlineMs ?? null;
  let uncertainReplay = null;
  if (deliveryUncertain === null) {
    const storedCandidate = state.stabilityCandidate;
    const deliveredEntryKeys = new Set(
      state.openTurn?.deliveredEntryKeys ?? []
    );
    const storedCandidateHasUndeliveredEntry = storedCandidate !== null && storedCandidate.entryKeys.some(
      (entryKey) => !deliveredEntryKeys.has(entryKey)
    );
    let firstObservation = null;
    if (storedCandidate !== null && storedCandidateHasUndeliveredEntry) {
      const storedCheckpoint = await captureCursorCheckpoint(
        identity.canonicalTranscriptPath,
        first,
        storedCandidate.throughFrameIndex + 1
      );
      if (storedCheckpoint?.prefixBytes === storedCandidate.prefixBytes && storedCheckpoint.prefixSha256 === storedCandidate.prefixSha256) {
        firstObservation = cursorObservationAtBoundary(
          first,
          storedCandidate,
          selectedObservedAt
        );
      }
    }
    firstObservation ??= cursorCandidateObservation(
      first,
      selectedObservedAt,
      state.continuity.nextFrameIndex
    );
    if (firstObservation !== null) {
      const checkpoint = await checkpointCursorCandidate({
        sessionId: identity.sessionId,
        stabilityMs,
        observation: firstObservation
      });
      if (checkpoint.status === "confirmed") {
        const verifiedBoundary = await captureCursorCheckpoint(
          identity.canonicalTranscriptPath,
          first,
          firstObservation.throughFrameIndex + 1
        );
        if (verifiedBoundary?.prefixBytes === firstObservation.prefixBytes && verifiedBoundary.prefixSha256 === firstObservation.prefixSha256) {
          confirmedObservation = cursorObservationAtBoundary(
            first,
            firstObservation,
            selectedObservedAt
          );
        }
      } else {
        const nowMs = deps.now?.() ?? Date.now();
        const remainingMs = deadlineMs === null ? null : Math.max(0, deadlineMs - nowMs);
        if (remainingMs === null || stabilityMs <= remainingMs) {
          const waitMs = remainingMs === null ? stabilityMs : Math.min(stabilityMs, remainingMs);
          await (deps.sleep?.(waitMs) ?? new Promise((resolve3) => setTimeout(resolve3, waitMs)));
          selectedObservedAt = new Date(
            Math.max(
              deps.now?.() ?? Date.now(),
              Date.parse(firstObservation.observedAt) + stabilityMs
            )
          ).toISOString();
          const second = await scanCursor(
            identity,
            analysisFromFrame,
            firstObservation.prefixBytes,
            deps
          );
          const confirmedBoundary = cursorObservationAtBoundary(
            second,
            firstObservation,
            selectedObservedAt
          );
          if (confirmedBoundary !== null) {
            const verifiedBoundary = await captureCursorCheckpoint(
              identity.canonicalTranscriptPath,
              second,
              firstObservation.throughFrameIndex + 1
            );
            if (verifiedBoundary?.prefixBytes === firstObservation.prefixBytes && verifiedBoundary.prefixSha256 === second.scan.verifiedPrefixSha256 && verifiedBoundary.prefixSha256 === firstObservation.prefixSha256) {
              const confirmation = await checkpointCursorCandidate({
                sessionId: identity.sessionId,
                stabilityMs,
                observation: confirmedBoundary
              });
              if (confirmation.status === "confirmed") {
                confirmedObservation = confirmedBoundary;
              }
            }
          }
          selected = second;
        }
      }
      state = await getCursorSession(identity.sessionId) ?? state;
    }
  } else {
    const pending = state.pendingDelivery;
    if (pending === null) {
      return inputNeededOutcome(
        "continuityBlocked",
        {
          continuityBlocked: true,
          runtime: "cursor",
          cwd,
          code: "DELIVERY_REPLAY_RECONSTRUCTION_FAILED"
        },
        "Cursor uncertain delivery reservation is unavailable for exact replay."
      );
    }
    selected = await scanCursor(
      identity,
      analysisFromFrame,
      pending.intendedCheckpoint.prefixBytes,
      deps
    );
    uncertainReplay = reconstructUncertainReplay(pending, selected);
    if (uncertainReplay === null) {
      return inputNeededOutcome(
        "continuityBlocked",
        {
          continuityBlocked: true,
          runtime: "cursor",
          cwd,
          code: "DELIVERY_REPLAY_RECONSTRUCTION_FAILED"
        },
        "Cursor uncertain delivery cannot be reconstructed from the exact reserved prefix."
      );
    }
  }
  const digest = await buildDigest("cursor", candidate.transcriptPath, {
    ...args,
    fromIndex: continuity.fromFrameIndex,
    mode: "catch-up",
    includeToolCalls: args.includeTools,
    includeToolResults: args.includeToolResults,
    includeCommandMessages: args.includeCommandMessages,
    sessionId: candidate.sessionId,
    recordedCwd: candidate.recordedCwd,
    matchedTier: rankResult && "tier" in rankResult ? rankResult.tier : void 0,
    active: candidate.active ?? false,
    warnings,
    fallbacks: rankResult && "fallbacks" in rankResult ? rankResult.fallbacks : [],
    cursorProjection: "observation",
    cursorIdentity: identity,
    cursorScan: selected.scan,
    cursorAnalysis: selected.analysis,
    cursorState: deliveryUncertain === null && confirmedObservation === null ? { ...state, stabilityCandidate: null } : state,
    cursorContinuity: continuity.status
  });
  if (deliveryUncertain !== null) {
    const pending = state.pendingDelivery;
    digest.entries = uncertainReplay;
    digest.range.fromIndex = pending.expectedNextFrameIndex;
    digest.range.toIndex = pending.reservedThroughFrameIndex;
    digest.range.nextIndex = pending.intendedCheckpoint.nextFrameIndex;
    digest.range.newFrames = pending.intendedCheckpoint.nextFrameIndex - pending.expectedNextFrameIndex;
    digest.accounting.raw = {
      fromIndex: pending.expectedNextFrameIndex,
      toIndex: pending.reservedThroughFrameIndex,
      count: pending.intendedCheckpoint.nextFrameIndex - pending.expectedNextFrameIndex,
      nextIndex: pending.intendedCheckpoint.nextFrameIndex,
      totalFrames: selected.scan.totalFrames
    };
    digest.accounting.rendered = {
      count: digest.entries.length,
      fromIndex: digest.entries.length === 0 ? null : Math.min(...digest.entries.map((entry) => entry.recordIndex)),
      toIndex: digest.entries.length === 0 ? null : Math.max(...digest.entries.map((entry) => entry.recordIndex))
    };
    digest.range.renderedFromIndex = digest.accounting.rendered.fromIndex;
    digest.range.renderedToIndex = digest.accounting.rendered.toIndex;
    digest.cursorEvidence.status.delivery = "uncertain";
    return {
      ok: true,
      runtime: "cursor",
      candidate,
      rankResult,
      digest,
      sessionState: null,
      cursorState: state,
      fromIndex: continuity.fromFrameIndex,
      markedRead: false,
      delivery: null,
      deliveryUncertain
    };
  }
  let delivery = null;
  const intendedSettledNextFrameIndex = settledNextFrameIndex(
    selected,
    digest.range.nextIndex,
    state.continuity.nextFrameIndex
  );
  const intendedCheckpoint = await captureCursorCheckpoint(
    identity.canonicalTranscriptPath,
    selected,
    intendedSettledNextFrameIndex
  );
  if (digest.range.nextIndex > continuity.fromFrameIndex && intendedCheckpoint !== null) {
    const ownerPid = deps.ownerPid ?? process.pid;
    const deliveryId = randomUUID2();
    const entryKeys = digest.entries.map((entry) => entry.entryKey);
    const entryHashes = Object.fromEntries(
      digest.entries.map((entry) => [
        entry.entryKey,
        createHash4("sha256").update(entry.text).digest("hex")
      ])
    );
    const reservation = await reserveCursorDelivery({
      sessionId: identity.sessionId,
      ownerPid,
      expected: state.continuity,
      pending: {
        deliveryId,
        canonicalCwd: state.canonicalCwd,
        transcriptPath: state.transcriptPath,
        expectedNextFrameIndex: state.lastRecordIndex,
        expectedCheckpoint: state.continuity,
        reservedThroughFrameIndex: digest.range.nextIndex - 1,
        entryKeys,
        entryHashes,
        intendedCheckpoint,
        reservedByPid: ownerPid,
        reservedAt: new Date(deps.now?.() ?? Date.now()).toISOString()
      }
    });
    if (reservation === "owner-conflict") {
      return inputNeededOutcome(
        "ownerConflict",
        { ownerConflict: true, runtime: "cursor", cwd },
        "Cursor delivery is reserved by another owner."
      );
    }
    if (reservation === "stale") {
      return inputNeededOutcome(
        "continuityBlocked",
        {
          continuityBlocked: true,
          runtime: "cursor",
          cwd,
          code: "STALE_RESERVATION"
        },
        "Cursor delivery reservation lost its expected checkpoint."
      );
    }
    digest.cursorEvidence.status.delivery = "reserved";
    const safeNextIndex = (selected.scan.safeThroughFrame ?? -1) + 1;
    const nextObservation = digest.range.nextIndex < safeNextIndex ? cursorCandidateObservation(
      selected,
      selectedObservedAt,
      digest.range.nextIndex
    ) : null;
    const nextState = {
      ...state,
      lastRecordIndex: digest.range.nextIndex,
      continuity: intendedCheckpoint,
      lastStatus: {
        ...digest.cursorEvidence.status,
        delivery: "committed"
      },
      openTurn: cursorOpenTurn(state, selected, digest),
      stabilityCandidate: null,
      pendingDelivery: null
    };
    const nextCandidateObservation = nextObservation !== null && (confirmedObservation === null || nextObservation.throughFrameIndex !== confirmedObservation.throughFrameIndex || !sameEntryKeys(
      nextObservation.entryKeys,
      confirmedObservation.entryKeys
    )) ? nextObservation : null;
    delivery = createDeliveryHandle({
      sessionId: identity.sessionId,
      deliveryId,
      ownerPid,
      entryKeys,
      nextState,
      nextCandidateObservation,
      stabilityMs
    });
  }
  const currentState = await getCursorSession(identity.sessionId) ?? state;
  return {
    ok: true,
    runtime: "cursor",
    candidate,
    rankResult,
    digest,
    sessionState: null,
    cursorState: currentState,
    fromIndex: continuity.fromFrameIndex,
    markedRead: false,
    delivery,
    deliveryUncertain: null
  };
}
async function observePinnedSession(runtime, cwd, pinnedSession, args, deps) {
  let candidates;
  try {
    candidates = await discover(runtime, cwd);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorOutcome(`Failed to discover transcripts: ${message}`);
  }
  if (candidates.length === 0) {
    return noMatchOutcome(
      { noMatch: true, runtime, cwd },
      `No ${runtime} transcripts found for cwd: ${cwd}`
    );
  }
  const pinned = candidates.find(
    (c) => c.runtime === pinnedSession.runtime && c.sessionId === pinnedSession.sessionId
  );
  if (!pinned) {
    return errorOutcome(
      `Pinned session not found: ${args.session}. Run locate to see available sessions.`
    );
  }
  if (runtime === "cursor") {
    return observeCursorSession(cwd, pinned, args, deps);
  }
  const sessionState = await sessionStateFor(
    pinnedSession.runtime,
    pinned.sessionId
  );
  const fromIndex = sessionState?.lastRecordIndex ?? 0;
  const warnings = watchedByPidWarnings(
    sessionState,
    args.suppressWatchedWarningPid
  );
  let digest;
  try {
    digest = await buildCatchUpDigest(pinnedSession.runtime, pinned, {
      ...args,
      fromIndex,
      active: pinned.active ?? false,
      warnings,
      fallbacks: []
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorOutcome(`Failed to build digest: ${message}`);
  }
  const markedRead = await markReadIfNeeded(
    pinnedSession.runtime,
    pinned,
    sessionState,
    digest
  );
  return {
    ok: true,
    runtime: pinnedSession.runtime,
    candidate: pinned,
    digest,
    sessionState,
    fromIndex,
    markedRead
  };
}
async function observeCatchUp(args, deps = {}) {
  const { cwd, session, snippet } = args;
  let { runtime } = args;
  const pinnedSession = parsePinnedSession(session);
  if (pinnedSession && "error" in pinnedSession)
    return errorOutcome(pinnedSession.error);
  if (pinnedSession) runtime = pinnedSession.runtime;
  if (runtime === "auto") {
    const resolved = await resolveAutoRuntime(cwd);
    if (resolved.noMatch) {
      return noMatchOutcome(
        {
          noMatch: true,
          cwd,
          message: "No candidates found in any runtime for this cwd."
        },
        `No peer-session candidates found for cwd: ${cwd}`
      );
    }
    if (resolved.ambiguous) {
      return inputNeededOutcome(
        "ambiguousRuntime",
        {
          ambiguousRuntime: true,
          runtimes: resolved.runtimes,
          message: "Candidates found in multiple runtimes. Use --runtime to specify."
        },
        `Ambiguous runtime: candidates found in both ${resolved.runtimes?.join(", ")}. Specify --runtime <runtime>.`
      );
    }
    runtime = resolved.runtime;
  }
  if (pinnedSession) {
    if (!isRuntime(runtime)) {
      return errorOutcome(`Unknown runtime: ${runtime}`);
    }
    return observePinnedSession(runtime, cwd, pinnedSession, args, deps);
  }
  if (!isRuntime(runtime)) {
    return errorOutcome(`Unknown runtime: ${runtime}`);
  }
  let candidates;
  try {
    candidates = await discover(runtime, cwd);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorOutcome(`Failed to discover transcripts: ${message}`);
  }
  if (candidates.length === 0) {
    return noMatchOutcome(
      { noMatch: true, runtime, cwd },
      `No ${runtime} transcripts found for cwd: ${cwd}`
    );
  }
  if (snippet) {
    const filtered = await applySnippetFilter(candidates, snippet);
    candidates = filtered.candidates;
    if (candidates.length === 0) {
      return noMatchOutcome(
        {
          noMatch: true,
          runtime,
          cwd,
          snippet,
          message: "No candidate transcripts contained the provided snippet."
        },
        `No ${runtime} candidate transcripts contained the provided snippet.`
      );
    }
  }
  const worktrees = await gitWorktrees(cwd).catch(() => []);
  const rankResult = rank(candidates, cwd, { gitWorktrees: worktrees });
  if (rankResult.noMatch) {
    return noMatchOutcome(
      {
        noMatch: true,
        runtime,
        cwd,
        sisters: rankResult.sisters,
        globalRecent: rankResult.globalRecent
      },
      `No ${runtime} transcripts matched cwd: ${cwd}`
    );
  }
  if (rankResult.unengagedOnly) {
    return inputNeededOutcome(
      "unengagedOnly",
      {
        unengagedOnly: true,
        runtime,
        cwd,
        tier: rankResult.tier,
        candidates: rankResult.candidates,
        message: "Only bootstrap/unengaged sessions matched this cwd. Use --session to confirm one or specify a different runtime/cwd."
      },
      unengagedOnlyMessage(runtime, cwd)
    );
  }
  if (rankResult.ties && rankResult.ties.length > 0) {
    return inputNeededOutcome(
      "ties",
      { ties: true, candidates: [rankResult.winner, ...rankResult.ties] },
      "Multiple sessions tied. Use --session to disambiguate."
    );
  }
  const winner = rankResult.winner;
  if (runtime === "cursor") {
    return observeCursorSession(cwd, winner, args, deps, rankResult);
  }
  const sessionState = await sessionStateFor(runtime, winner.sessionId);
  const fromIndex = sessionState?.lastRecordIndex ?? 0;
  const warnings = [
    ...watchedByPidWarnings(sessionState, args.suppressWatchedWarningPid),
    ...winner.snippetMatch ? [
      `Selected session by snippet match: ${winner.sessionId} (${winner.recordedCwd ?? "unknown cwd"})`
    ] : []
  ];
  let digest;
  try {
    digest = await buildCatchUpDigest(runtime, winner, {
      ...args,
      fromIndex,
      matchedTier: rankResult.tier,
      active: winner.active,
      warnings,
      fallbacks: rankResult.fallbacks
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorOutcome(`Failed to build digest: ${message}`);
  }
  const markedRead = await markReadIfNeeded(
    runtime,
    winner,
    sessionState,
    digest
  );
  return {
    ok: true,
    runtime,
    candidate: winner,
    rankResult,
    digest,
    sessionState,
    fromIndex,
    markedRead
  };
}

// src/skills/session-observer/src/lib/watch-state.ts
import {
  chmod as chmod2,
  open as open7,
  rename as rename4,
  mkdir as mkdir4,
  readdir as readdir3,
  readFile as readFile6,
  stat as stat4,
  unlink as unlink4
} from "node:fs/promises";
import { homedir as homedir5 } from "node:os";
import { isAbsolute as isAbsolute3, join as join5 } from "node:path";
var SCHEMA_VERSION4 = 2;
var LOCK_RETRIES3 = 100;
var LOCK_INTERVAL_MS3 = 50;
var LOCK_STALE_MS = LOCK_RETRIES3 * LOCK_INTERVAL_MS3;
function isErrnoException3(err) {
  return err instanceof Error && "code" in err;
}
function stateDir3() {
  return process.env.STATE_DIR ?? join5(homedir5(), ".local", "state", "session-observer");
}
function watchPath(dir) {
  return join5(dir, "watch.json");
}
function lockPath3(dir) {
  return join5(dir, "watch.json.lock");
}
function controlPath(dir, pid = void 0) {
  return pid === void 0 ? join5(dir, "watch.control.json") : join5(dir, `watch.control.${pid}.json`);
}
var PID_CONTROL_FILE_RE = /^watch\.control\.(\d+)\.json$/;
function tmpPath2(dir, basename3) {
  return join5(dir, `${basename3}.${process.pid}.${Date.now()}.tmp`);
}
function emptyWatchState() {
  return { schemaVersion: SCHEMA_VERSION4, active: null, watchers: [] };
}
function toIsoTimestamp(value = void 0) {
  if (!value) return (/* @__PURE__ */ new Date()).toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
function sleep3(ms) {
  return new Promise((resolve3) => setTimeout(resolve3, ms));
}
async function ensurePrivateDirectory2(dir) {
  await mkdir4(dir, { recursive: true, mode: 448 });
  await chmod2(dir, 448);
}
async function isLockStale(lock) {
  let pid = null;
  try {
    const raw = (await readFile6(lock, "utf8")).trim();
    const parsed = Number.parseInt(raw, 10);
    if (Number.isInteger(parsed) && parsed > 0) pid = parsed;
  } catch {
  }
  if (pid !== null) return !isPidLive2(pid);
  try {
    const st = await stat4(lock);
    return Date.now() - st.mtimeMs > LOCK_STALE_MS;
  } catch {
    return false;
  }
}
async function tryReclaim(lock) {
  const claim = `${lock}.reclaim.${process.pid}.${Date.now()}`;
  try {
    await rename4(lock, claim);
  } catch (err) {
    if (isErrnoException3(err) && err.code === "ENOENT") return false;
    throw err;
  }
  let claimedPid = null;
  try {
    const raw = (await readFile6(claim, "utf8")).trim();
    const parsed = Number.parseInt(raw, 10);
    if (Number.isInteger(parsed) && parsed > 0) claimedPid = parsed;
  } catch {
  }
  if (claimedPid !== null && isPidLive2(claimedPid)) {
    try {
      await rename4(claim, lock);
    } catch {
    }
    return false;
  }
  try {
    await unlink4(claim);
  } catch {
  }
  return true;
}
async function acquireLock3(lock) {
  let reclaimAttempted = false;
  for (let i = 0; i < LOCK_RETRIES3; i++) {
    try {
      const fh = await open7(lock, "wx", 384);
      await fh.write(String(process.pid));
      await fh.close();
      return;
    } catch (err) {
      if (!isErrnoException3(err) || err.code !== "EEXIST") throw err;
      if (!reclaimAttempted) {
        reclaimAttempted = true;
        if (await isLockStale(lock) && await tryReclaim(lock)) {
          continue;
        }
      }
      await sleep3(LOCK_INTERVAL_MS3);
    }
  }
  throw new Error(
    `watch-state.mjs: could not acquire lock after ${LOCK_RETRIES3} retries`
  );
}
async function releaseLock3(lock) {
  try {
    await unlink4(lock);
  } catch {
  }
}
async function readWatchState(dir) {
  let raw;
  try {
    raw = await readFile6(watchPath(dir), "utf8");
    await chmod2(watchPath(dir), 384);
  } catch (err) {
    if (isErrnoException3(err) && err.code === "ENOENT")
      return { state: emptyWatchState(), migrationRequired: false };
    throw err;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { state: emptyWatchState(), migrationRequired: true };
  }
  const watchers = Array.isArray(parsed.watchers) ? parsed.watchers.filter(Boolean) : parsed.active ? [parsed.active] : [];
  return {
    state: {
      schemaVersion: SCHEMA_VERSION4,
      active: watchers[0] ?? parsed.active ?? null,
      watchers
    },
    migrationRequired: parsed.schemaVersion !== SCHEMA_VERSION4
  };
}
async function writeJsonAtomic(dir, basename3, payload) {
  await mkdir4(dir, { recursive: true });
  const tmp = tmpPath2(dir, basename3);
  const dest = join5(dir, basename3);
  let fh;
  try {
    fh = await open7(tmp, "w", 384);
    await fh.write(JSON.stringify(payload, null, 2));
    await fh.datasync();
    await fh.close();
    fh = null;
    await rename4(tmp, dest);
    await chmod2(dest, 384);
  } finally {
    if (fh) {
      try {
        await fh.close();
      } catch {
      }
    }
    try {
      await unlink4(tmp);
    } catch {
    }
  }
}
async function writeWatchState(dir, state) {
  await writeJsonAtomic(dir, "watch.json", state);
}
function isPidLive2(pid) {
  if (typeof pid !== "number" || !Number.isInteger(pid) || pid <= 0)
    return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if (isErrnoException3(err) && err.code === "ESRCH") return false;
    if (isErrnoException3(err) && err.code === "EPERM") return true;
    throw err;
  }
}
function syncPrimaryActive(state) {
  state.watchers = Array.isArray(state.watchers) ? state.watchers.filter(Boolean) : [];
  state.active = state.watchers[0] ?? null;
}
function clearStaleWatchers(state) {
  const before = JSON.stringify({
    active: state.active ?? null,
    watchers: state.watchers ?? []
  });
  const watchers = Array.isArray(state.watchers) ? state.watchers : state.active ? [state.active] : [];
  state.watchers = watchers.filter((watcher) => isPidLive2(watcher.pid));
  syncPrimaryActive(state);
  const after = JSON.stringify({
    active: state.active ?? null,
    watchers: state.watchers ?? []
  });
  return before !== after;
}
async function mutateWatchState(fn) {
  const dir = stateDir3();
  await ensurePrivateDirectory2(dir);
  const lock = lockPath3(dir);
  await acquireLock3(lock);
  try {
    const { state, migrationRequired } = await readWatchState(dir);
    const before = JSON.stringify(state);
    const result = await fn(state);
    if (migrationRequired || JSON.stringify(state) !== before) {
      await writeWatchState(dir, state);
    }
    return result ?? state;
  } finally {
    await releaseLock3(lock);
  }
}
async function loadWatchState() {
  const dir = stateDir3();
  await ensurePrivateDirectory2(dir);
  const lock = lockPath3(dir);
  await acquireLock3(lock);
  try {
    const { state, migrationRequired } = await readWatchState(dir);
    const staleWatchersCleared = clearStaleWatchers(state);
    if (migrationRequired || staleWatchersCleared) {
      await writeWatchState(dir, state);
    }
    await clearStaleControlDirectives().catch(() => 0);
    return state;
  } finally {
    await releaseLock3(lock);
  }
}
async function startWatcher({
  runtime,
  cwd,
  pid = process.pid,
  startedAt,
  session = null,
  pollSec = null,
  debounceSec = null,
  maxPendingSec = null,
  heartbeatSec = null,
  staleAfterSec = null
} = {}) {
  if (!runtime) throw new Error("runtime is required to start a watcher");
  if (!cwd) throw new Error("cwd is required to start a watcher");
  return mutateWatchState((state) => {
    clearStaleWatchers(state);
    const existingForPid = state.watchers.find(
      (watcher) => watcher.pid === pid && isPidLive2(watcher.pid)
    );
    if (existingForPid) {
      throw new Error(
        `watcher already active for ${existingForPid.runtime} at ${existingForPid.cwd} (pid ${existingForPid.pid})`
      );
    }
    const active = {
      pid,
      runtime,
      requestedRuntime: runtime,
      cwd,
      session,
      startedAt: toIsoTimestamp(startedAt),
      pollSec,
      debounceSec,
      maxPendingSec,
      heartbeatSec,
      staleAfterSec,
      lastPollAt: null,
      lastEventAt: null,
      eventCount: 0,
      resolvedRuntime: null,
      sessionId: null,
      transcriptPath: null,
      targets: [],
      lastError: null
    };
    state.watchers.push(active);
    syncPrimaryActive(state);
    return active;
  });
}
async function clearWatcher({
  pid
} = {}) {
  return mutateWatchState((state) => {
    clearStaleWatchers(state);
    const beforeCount = state.watchers.length;
    state.watchers = pid === void 0 ? [] : state.watchers.filter((watcher) => watcher.pid !== pid);
    syncPrimaryActive(state);
    return state.watchers.length !== beforeCount;
  });
}
function mutateWatcherByPid(state, pid, update) {
  clearStaleWatchers(state);
  const index = state.watchers.findIndex(
    (watcher) => pid === void 0 || watcher.pid === pid
  );
  if (index === -1) return null;
  const updated = update(state.watchers[index]);
  state.watchers[index] = updated;
  syncPrimaryActive(state);
  return updated;
}
async function recordWatcherEvent({
  pid,
  lastEventAt
} = {}) {
  return mutateWatchState((state) => {
    return mutateWatcherByPid(state, pid, (watcher) => ({
      ...watcher,
      lastEventAt: toIsoTimestamp(lastEventAt),
      eventCount: (watcher.eventCount ?? 0) + 1
    })) ?? state;
  });
}
async function recordWatcherPoll({
  pid,
  lastPollAt
} = {}) {
  return mutateWatchState((state) => {
    return mutateWatcherByPid(state, pid, (watcher) => ({
      ...watcher,
      lastPollAt: toIsoTimestamp(lastPollAt)
    })) ?? state;
  });
}
function watcherHasTarget(watcher, key) {
  const targets = Array.isArray(watcher.targets) ? watcher.targets : [];
  if (targets.length > 0) {
    return targets.some(
      (target) => (target.key ?? `${target.runtime}:${target.sessionId}`) === key
    );
  }
  if (!watcher.sessionId) return false;
  return `${watcher.resolvedRuntime ?? watcher.runtime}:${watcher.sessionId}` === key;
}
function isNonNegativeInteger2(value) {
  return Number.isSafeInteger(value) && value >= 0;
}
function isObject3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isCursorContinuity(value, observationCursor) {
  if (!isObject3(value)) return false;
  return value.indexBase === "zero-based-jsonl-frame-index" && isNonNegativeInteger2(observationCursor) && isNonNegativeInteger2(value.nextFrameIndex) && value.nextFrameIndex <= observationCursor && isNonNegativeInteger2(value.prefixBytes) && typeof value.prefixSha256 === "string" && /^[a-f0-9]{64}$/u.test(value.prefixSha256) && isNonNegativeInteger2(value.observedSize) && value.prefixBytes <= value.observedSize && isNonNegativeInteger2(value.device) && isNonNegativeInteger2(value.inode);
}
function isObservationStatus2(value) {
  if (!isObject3(value)) return false;
  return ["engaged", "unengaged", "unknown"].includes(String(value.engagement)) && ["none", "human-input", "assistant-progress", "tool-activity"].includes(
    String(value.activity)
  ) && ["none", "buffered", "available", "suppressed"].includes(
    String(value.content)
  ) && [
    "none",
    "pending",
    "success",
    "aborted",
    "error",
    "cancelled",
    "unknown"
  ].includes(String(value.lifecycle)) && ["none", "reserved", "committed", "uncertain"].includes(
    String(value.delivery)
  ) && ["healthy", "blocked", "stale", "error", "unknown"].includes(
    String(value.health)
  );
}
function cursorTargetDeadline(value) {
  if (value === null || value === void 0) return null;
  const timestamp = toIsoTimestamp(value);
  if (!Number.isFinite(Date.parse(timestamp))) {
    throw new TypeError(
      "Cursor pending candidate deadline must be a timestamp"
    );
  }
  return timestamp;
}
function cursorTargetRecord(target, base, ownerPid) {
  const continuity = target.continuity;
  if (target.indexBase !== "zero-based-jsonl-frame-index" || !target.canonicalTranscriptPath || !isAbsolute3(target.canonicalTranscriptPath) || !isNonNegativeInteger2(target.observationCursor) || target.bufferedFromFrame !== null && target.bufferedFromFrame !== void 0 && !isNonNegativeInteger2(target.bufferedFromFrame) || !isCursorContinuity(continuity, target.observationCursor) || !isObservationStatus2(target.lastStatus) || target.continuityState !== "verified" && target.continuityState !== "blocked" || !Number.isSafeInteger(ownerPid) || ownerPid <= 0) {
    throw new TypeError(
      "Cursor watch targets require exact frame-index continuity, status, and ownership"
    );
  }
  return {
    ...base,
    runtime: "cursor",
    indexBase: "zero-based-jsonl-frame-index",
    canonicalTranscriptPath: target.canonicalTranscriptPath,
    observationCursor: target.observationCursor,
    bufferedFromFrame: target.bufferedFromFrame ?? null,
    continuity: structuredClone(continuity),
    pendingCandidateDeadline: cursorTargetDeadline(
      target.pendingCandidateDeadline
    ),
    lastStatus: structuredClone(target.lastStatus),
    continuityState: target.continuityState,
    ownerPid
  };
}
function isCursorWatchTarget(target) {
  return target.runtime === "cursor" && "indexBase" in target && target.indexBase === "zero-based-jsonl-frame-index" && "ownerPid" in target && Number.isSafeInteger(target.ownerPid);
}
async function recordWatcherTarget({
  pid,
  target
} = {}) {
  if (!target?.runtime || !target?.sessionId || !target?.transcriptPath) {
    throw new Error(
      "runtime, sessionId, and transcriptPath are required to record a watcher target"
    );
  }
  return mutateWatchState((state) => {
    clearStaleWatchers(state);
    const acquireKey = `${target.runtime}:${target.sessionId}`;
    const conflict = state.watchers.find(
      (watcher) => watcher.pid !== pid && watcherHasTarget(watcher, acquireKey)
    );
    if (conflict) {
      const err = new Error(
        `watcher pid ${conflict.pid} is already watching ${acquireKey}`
      );
      err.code = "DUPLICATE_WATCH_TARGET";
      err.conflictPid = conflict.pid;
      throw err;
    }
    return mutateWatcherByPid(state, pid, (watcher) => {
      const targets = Array.isArray(watcher.targets) ? [...watcher.targets] : [];
      const key = `${target.runtime}:${target.sessionId}`;
      const existingIndex = targets.findIndex(
        (existing) => existing.key === key
      );
      const baseTargetRecord = {
        key,
        runtime: target.runtime,
        sessionId: target.sessionId,
        transcriptPath: target.transcriptPath,
        cwd: target.recordedCwd ?? null,
        recordCount: target.recordCount ?? null,
        baselineRecordIndex: target.baselineRecordIndex ?? null,
        engagementStatus: target.engagementStatus ?? null,
        lockedAt: toIsoTimestamp(target.lockedAt)
      };
      const targetRecord = target.runtime === "cursor" ? cursorTargetRecord(target, baseTargetRecord, watcher.pid) : baseTargetRecord;
      if (existingIndex === -1) targets.push(targetRecord);
      else
        targets[existingIndex] = {
          ...targets[existingIndex],
          ...targetRecord
        };
      return {
        ...watcher,
        targets,
        resolvedRuntime: targets.length === 1 ? targets[0].runtime : watcher.resolvedRuntime,
        sessionId: targets.length === 1 ? targets[0].sessionId : watcher.sessionId,
        transcriptPath: targets.length === 1 ? targets[0].transcriptPath : watcher.transcriptPath
      };
    }) ?? state;
  });
}
async function compareAndSetCursorWatchTarget({
  pid,
  key,
  expectedObservationCursor,
  next
}) {
  if (!Number.isSafeInteger(pid) || pid <= 0 || !key || !isNonNegativeInteger2(expectedObservationCursor)) {
    throw new TypeError("invalid Cursor watch target CAS request");
  }
  return mutateWatchState((state) => {
    clearStaleWatchers(state);
    const owningWatcher = state.watchers.find(
      (watcher) => (watcher.targets ?? []).some((target) => target.key === key)
    );
    if (owningWatcher === void 0) return { status: "not-found" };
    if (owningWatcher.pid !== pid) return { status: "not-owner" };
    const targetIndex = owningWatcher.targets.findIndex(
      (target) => target.key === key
    );
    const current = owningWatcher.targets[targetIndex];
    if (!isCursorWatchTarget(current)) {
      return { status: "not-found" };
    }
    if (current.ownerPid !== pid) {
      return { status: "not-owner" };
    }
    if (current.observationCursor !== expectedObservationCursor) {
      return { status: "stale", target: structuredClone(current) };
    }
    if (next.recordCount !== void 0 && (!isNonNegativeInteger2(next.recordCount) || next.recordCount < next.observationCursor || current.recordCount !== null && next.recordCount < current.recordCount)) {
      throw new TypeError(
        "Cursor watch target frame count must be safe and monotonic"
      );
    }
    const recordCount = next.recordCount === void 0 ? current.recordCount : next.recordCount;
    const candidate = cursorTargetRecord(
      {
        runtime: "cursor",
        sessionId: current.sessionId,
        transcriptPath: current.transcriptPath,
        recordedCwd: current.cwd,
        baselineRecordIndex: current.baselineRecordIndex,
        engagementStatus: current.engagementStatus,
        lockedAt: current.lockedAt,
        indexBase: "zero-based-jsonl-frame-index",
        canonicalTranscriptPath: current.canonicalTranscriptPath,
        ...next,
        recordCount
      },
      { ...current, recordCount },
      pid
    );
    if (candidate.continuity.device !== current.continuity.device || candidate.continuity.inode !== current.continuity.inode || candidate.observationCursor < current.observationCursor || candidate.continuity.prefixBytes < current.continuity.prefixBytes || candidate.continuity.prefixBytes === current.continuity.prefixBytes && candidate.continuity.prefixSha256 !== current.continuity.prefixSha256) {
      throw new TypeError(
        "Cursor watch target CAS cannot change identity or move backward"
      );
    }
    owningWatcher.targets[targetIndex] = candidate;
    syncPrimaryActive(state);
    return { status: "updated", target: structuredClone(candidate) };
  });
}
async function findLiveWatcherForTarget({
  runtime,
  sessionId,
  excludePid
} = {}) {
  if (!runtime || !sessionId) return null;
  const state = await loadWatchState();
  const key = `${runtime}:${sessionId}`;
  return state.watchers.find(
    (watcher) => watcher.pid !== excludePid && watcherHasTarget(watcher, key)
  ) ?? null;
}
async function recordWatcherError({
  pid,
  error,
  at
} = {}) {
  return mutateWatchState((state) => {
    return mutateWatcherByPid(state, pid, (watcher) => ({
      ...watcher,
      lastError: {
        at: toIsoTimestamp(at),
        message: error instanceof Error ? error.message : String(error ?? "unknown error")
      }
    })) ?? state;
  });
}
async function readControlFile(path) {
  try {
    return JSON.parse(await readFile6(path, "utf8"));
  } catch (err) {
    if (isErrnoException3(err) && err.code === "ENOENT") return null;
    throw err;
  }
}
async function unlinkIfExists(path) {
  try {
    await unlink4(path);
    return true;
  } catch (err) {
    if (isErrnoException3(err) && err.code === "ENOENT") return false;
    throw err;
  }
}
async function readControlDirective({
  pid
} = {}) {
  const dir = stateDir3();
  if (pid !== void 0) {
    const own = await readControlFile(controlPath(dir, pid));
    if (own) return own;
  }
  return readControlFile(controlPath(dir));
}
async function clearControlDirective({
  pid
} = {}) {
  const dir = stateDir3();
  if (pid === void 0) {
    return unlinkIfExists(controlPath(dir));
  }
  let cleared = await unlinkIfExists(controlPath(dir, pid));
  const legacy = await readControlFile(controlPath(dir));
  if (legacy && (legacy.pid === void 0 || legacy.pid === pid)) {
    cleared = await unlinkIfExists(controlPath(dir)) || cleared;
  }
  return cleared;
}
async function clearStaleControlDirectives() {
  const dir = stateDir3();
  let entries;
  try {
    entries = await readdir3(dir);
  } catch (err) {
    if (isErrnoException3(err) && err.code === "ENOENT") return 0;
    throw err;
  }
  let cleared = 0;
  for (const entry of entries) {
    const match = PID_CONTROL_FILE_RE.exec(entry);
    if (match) {
      if (!isPidLive2(Number(match[1])) && await unlinkIfExists(join5(dir, entry)))
        cleared++;
      continue;
    }
    if (entry === "watch.control.json") {
      const legacy = await readControlFile(join5(dir, entry)).catch(() => null);
      if (legacy?.pid !== void 0 && !isPidLive2(legacy.pid) && await unlinkIfExists(join5(dir, entry))) {
        cleared++;
      }
    }
  }
  return cleared;
}

// src/skills/session-observer/src/lib/watch.ts
var DEFAULT_POLL_SEC = 2;
var DEFAULT_DEBOUNCE_SEC = 2;
var DEFAULT_MAX_PENDING_SEC = 30;
var DEFAULT_HEARTBEAT_SEC = 120;
var BOTH_RUNTIMES = ["claude-code", "codex"];
var RESERVED_EVENT_LOG_NAMES = /* @__PURE__ */ new Set([
  "state.json",
  "watch.json",
  "watch.control.json"
]);
function toPositiveMs(value, fallbackSec) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallbackSec * 1e3;
  return Math.max(1, numeric * 1e3);
}
function maxRuntimeMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric * 6e4;
}
function maxPendingMs(value) {
  return toPositiveMs(value, DEFAULT_MAX_PENDING_SEC);
}
function heartbeatMs(value) {
  if (value === void 0 || value === null)
    return DEFAULT_HEARTBEAT_SEC * 1e3;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.max(1, numeric * 1e3);
}
function sleep4(ms) {
  return new Promise((complete) => setTimeout(complete, ms));
}
function cursorObserveDeps(deps, ownerPid) {
  return {
    now: deps.now,
    sleep: deps.sleep,
    ownerPid,
    onCursorScan: deps.onCursorScan,
    deadlineMs: deps.deadlineMs
  };
}
function stateDir4() {
  return process.env.STATE_DIR ?? join6(homedir6(), ".local", "state", "session-observer");
}
function watchRuntimes(runtime) {
  if (runtime === "both") return BOTH_RUNTIMES;
  return [runtime];
}
function targetKey(runtime, sessionId) {
  return `${runtime}:${sessionId}`;
}
function hasTargetForRuntime(targets, runtime) {
  for (const target of targets.values()) {
    if (target.runtime === runtime) return true;
  }
  return false;
}
function signatureChanged(previous, next) {
  if (!previous) return false;
  return previous.mtimeMs !== next.mtimeMs || previous.size !== next.size;
}
async function fileSignature(transcriptPath, statFn) {
  const fileStat = await statFn(transcriptPath);
  return {
    mtimeMs: fileStat.mtimeMs,
    size: fileStat.size
  };
}
function isCursorDigest(digest) {
  return digest.schemaVersion === 2;
}
function eventRanges(digest) {
  if (isCursorDigest(digest)) {
    return {
      indexBase: digest.range.indexBase,
      fromIndex: digest.range.fromIndex,
      toIndex: digest.range.toIndex,
      nextIndex: digest.range.nextIndex,
      totalRecords: digest.range.totalFrames,
      renderedFromIndex: digest.range.renderedFromIndex,
      renderedToIndex: digest.range.renderedToIndex
    };
  }
  return {
    fromIndex: digest.range.fromIndex,
    toIndex: digest.range.toIndex,
    nextIndex: digest.range.nextIndex,
    totalRecords: digest.range.totalRecords,
    renderedFromIndex: digest.range.renderedFromIndex,
    renderedToIndex: digest.range.renderedToIndex
  };
}
function digestNewRecords(digest) {
  return isCursorDigest(digest) ? digest.range.newFrames : digest.range.newRecords;
}
function eventMetadata(ts, digest, rendered) {
  return {
    type: "delta",
    ts,
    runtime: digest.runtime,
    sessionId: digest.sessionId,
    newRecords: digestNewRecords(digest),
    digestChars: rendered.length,
    ranges: eventRanges(digest)
  };
}
function stdoutEvent(ts, digest, rendered) {
  return {
    type: "delta",
    ts,
    runtime: digest.runtime,
    sessionId: digest.sessionId,
    newRecords: digestNewRecords(digest),
    digestChars: rendered.length,
    ranges: eventRanges(digest),
    digest
  };
}
async function writeProcessStdout(chunk) {
  await new Promise((fulfill, reject) => {
    process.stdout.write(chunk, (error) => {
      if (error) reject(error);
      else fulfill();
    });
  });
}
async function writeStdoutChunk(deps, chunk) {
  const callbackExpected = deps.writeStdout.length >= 2;
  let completeCallback;
  const callbackCompletion = callbackExpected ? new Promise((fulfill, reject) => {
    completeCallback = (error) => {
      if (error) reject(error);
      else fulfill();
    };
  }) : null;
  const result = deps.writeStdout(chunk, completeCallback);
  if (result && typeof result === "object" && "then" in result) {
    await result;
  } else if (callbackCompletion) {
    await callbackCompletion;
  }
}
function lockedTargetEvent(target) {
  return {
    type: "baseline",
    message: "Watcher is now active. Keep this process open and continue reading stdout. Do not treat baseline setup as a completed watch.",
    runtime: target.runtime,
    sessionId: target.sessionId,
    transcriptPath: target.transcriptPath,
    cwd: target.recordedCwd ?? null,
    size: target.signature.size,
    recordCount: target.recordCount,
    baselineRecordIndex: target.baselineRecordIndex,
    engagementStatus: target.engagementStatus
  };
}
function lockedTargetLine(target) {
  return `[session-observer] baseline ${target.runtime}:${target.sessionId} transcript=${target.transcriptPath} cwd=${target.recordedCwd ?? "(unknown)"} size=${target.signature.size} records=${target.recordCount} baselineRecordIndex=${target.baselineRecordIndex} engagement=${target.engagementStatus}
`;
}
async function emitLockedTarget(args, deps, target) {
  if (args.json) {
    await writeStdoutChunk(
      deps,
      JSON.stringify(lockedTargetEvent(target)) + "\n"
    );
    return;
  }
  await writeStdoutChunk(deps, lockedTargetLine(target));
}
function baselineGapEvent(target, skippedFromIndex, skippedToIndex) {
  return {
    type: "baseline-gap",
    level: "warning",
    runtime: target.runtime,
    sessionId: target.sessionId,
    skippedFromIndex,
    skippedToIndex,
    nextIndex: target.baselineRecordIndex,
    message: `standalone watch skipped unread range ${skippedFromIndex}-${skippedToIndex} for ${target.key}`
  };
}
function targetIdentityEvidence(target) {
  return {
    runtime: target.runtime,
    sessionId: target.sessionId,
    transcriptPath: target.transcriptPath,
    recordedCwd: target.recordedCwd,
    mtime: target.candidateMtime,
    size: target.signature.size
  };
}
function candidateIdentityEvidence(candidate) {
  return {
    runtime: candidate.runtime,
    sessionId: candidate.sessionId,
    transcriptPath: candidate.transcriptPath,
    recordedCwd: candidate.recordedCwd,
    mtime: candidate.mtime,
    size: candidate.size
  };
}
function newerSessionCandidateEvent(target, candidate) {
  return {
    type: "newer-session-candidate",
    watched: targetIdentityEvidence(target),
    candidate: candidateIdentityEvidence(candidate),
    message: "A newer same-cwd transcript candidate was observed; the watcher remains pinned."
  };
}
async function emitNewerSessionCandidate(args, deps, target, candidate) {
  const event = newerSessionCandidateEvent(target, candidate);
  if (args.json) {
    await writeStdoutChunk(deps, JSON.stringify(event) + "\n");
  } else {
    await writeStdoutChunk(
      deps,
      `[session-observer] newer-session-candidate watched=${target.key} candidate=${candidate.runtime}:${candidate.sessionId} watcher-remains-pinned
`
    );
  }
  await appendEventLog(args.eventLog, event);
}
async function emitBaselineGap(args, deps, target, skippedFromIndex, skippedToIndex) {
  const event = baselineGapEvent(target, skippedFromIndex, skippedToIndex);
  if (args.json) {
    await writeStdoutChunk(deps, JSON.stringify(event) + "\n");
  } else {
    await writeStdoutChunk(
      deps,
      `[session-observer] warning baseline-gap ${target.key} skippedRange=${skippedFromIndex}-${skippedToIndex}
`
    );
  }
  await appendEventLog(args.eventLog, event);
}
async function emitWatchPosture(args, deps) {
  if (args.json) return;
  await writeStdoutChunk(
    deps,
    "[session-observer] Watcher is now active. Keep this process open and continue reading stdout. Do not treat baseline setup as a completed watch.\n"
  );
}
function stoppedEvent(ts, reason, eventState) {
  return {
    type: "stopped",
    ts,
    reason,
    eventCount: eventState.eventCount
  };
}
function stoppedLine(reason, eventState) {
  return `[session-observer] watch stopped reason=${reason} deltaEvents=${eventState.eventCount}
`;
}
async function emitStopped(args, deps, reason, eventState) {
  const ts = new Date(deps.now()).toISOString();
  if (args.json) {
    await writeStdoutChunk(
      deps,
      JSON.stringify(stoppedEvent(ts, reason, eventState)) + "\n"
    );
    return;
  }
  await writeStdoutChunk(deps, stoppedLine(reason, eventState));
}
function errorEvent(ts, err) {
  return {
    type: "error",
    ts,
    message: err.message
  };
}
async function emitErrorEvent(args, deps, err) {
  const ts = new Date(deps.now()).toISOString();
  if (args.json) {
    await writeStdoutChunk(deps, JSON.stringify(errorEvent(ts, err)) + "\n");
    return;
  }
  await writeStdoutChunk(
    deps,
    `[session-observer] watch error: ${err.message}
`
  );
}
function consumedThrough(lastRecordIndex) {
  const numeric = Number(lastRecordIndex);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric - 1;
}
function cursorTargetHealthReasons(status, continuityState) {
  const reasons = [];
  if (continuityState === "blocked" || status.health === "blocked") {
    reasons.push("cursor-continuity-blocked");
  } else if (status.health === "stale") {
    reasons.push("cursor-health-stale");
  } else if (status.health === "error") {
    reasons.push("cursor-health-error");
  } else if (status.health === "unknown") {
    reasons.push("cursor-health-unknown");
  }
  if (status.delivery === "uncertain") {
    reasons.push("cursor-delivery-uncertain");
  }
  return reasons;
}
async function targetHeartbeatStatus(target, sessionState) {
  if (target.runtime === "cursor") {
    const status = target.lastStatus ?? emptyCursorStatus();
    const healthReasons = cursorTargetHealthReasons(
      status,
      target.continuityState
    );
    return {
      runtime: target.runtime,
      sessionId: target.sessionId,
      transcriptPath: target.transcriptPath,
      indexBase: "zero-based-jsonl-frame-index",
      transcriptRecords: target.recordCount,
      lastRecordIndex: target.observationCursor ?? 0,
      consumedThrough: consumedThrough(target.observationCursor ?? 0),
      recordsBehind: target.bufferedFromFrame === null || target.bufferedFromFrame === void 0 ? 0 : Math.max(0, target.recordCount - target.bufferedFromFrame),
      healthy: healthReasons.length === 0,
      error: healthReasons[0] ?? null,
      healthReasons,
      status,
      continuityState: target.continuityState,
      bufferedFromFrame: target.bufferedFromFrame ?? null,
      pendingCandidateDeadline: target.pendingCandidateDeadline === null || target.pendingCandidateDeadline === void 0 ? null : new Date(target.pendingCandidateDeadline).toISOString()
    };
  }
  const stored = sessionState.sessions?.[target.key] ?? null;
  const lastRecordIndex = Number.isFinite(Number(stored?.lastRecordIndex)) ? Number(stored.lastRecordIndex) : Number(target.baselineRecordIndex ?? 0);
  let transcriptRecords = null;
  let error = null;
  try {
    transcriptRecords = (await readRecords(target.transcriptPath)).length;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  const recordsBehind = transcriptRecords === null ? null : Math.max(0, transcriptRecords - lastRecordIndex);
  return {
    runtime: target.runtime,
    sessionId: target.sessionId,
    transcriptPath: target.transcriptPath,
    transcriptRecords,
    lastRecordIndex,
    consumedThrough: consumedThrough(lastRecordIndex),
    recordsBehind,
    healthy: !error,
    error
  };
}
async function heartbeatPayload(targets, deps, eventState) {
  const sessionState = await load().catch(() => ({ schemaVersion: 1, sessions: {} }));
  const targetStatuses = [];
  for (const target of targets.values()) {
    targetStatuses.push(await targetHeartbeatStatus(target, sessionState));
  }
  const totalRecordsBehind = targetStatuses.reduce((sum, target) => {
    if (target.recordsBehind === null || !Number.isFinite(target.recordsBehind))
      return sum;
    return sum + target.recordsBehind;
  }, 0);
  const healthy = targetStatuses.every((target) => target.healthy);
  return {
    type: "heartbeat",
    ts: new Date(deps.now()).toISOString(),
    message: "still watching",
    targetCount: targetStatuses.length,
    recordsBehind: totalRecordsBehind,
    healthy,
    eventCount: eventState.eventCount,
    targets: targetStatuses
  };
}
function heartbeatLine(payload) {
  const status = payload.recordsBehind === 0 ? "no new records" : "records pending";
  return `[session-observer] still watching, ${status}, recordsBehind=${payload.recordsBehind} healthy=${payload.healthy} targets=${payload.targetCount}
`;
}
async function emitHeartbeat(args, targets, deps, eventState) {
  const payload = await heartbeatPayload(targets, deps, eventState);
  if (args.json) {
    await writeStdoutChunk(deps, JSON.stringify(payload) + "\n");
    return;
  }
  await writeStdoutChunk(deps, heartbeatLine(payload));
}
function isWithinDir(dir, path) {
  const rel = relative2(dir, path);
  return rel === "" || !rel.startsWith("..") && !isAbsolute4(rel);
}
function eventLogBoundaryError(dir) {
  return new Error(
    `--event-log must stay under the session-observer state directory: ${dir}`
  );
}
function eventLogReservedError() {
  return new Error(
    "--event-log cannot use session-observer state, lock, temp, or backup files"
  );
}
function isReservedEventLogSegment(segment) {
  return RESERVED_EVENT_LOG_NAMES.has(segment) || segment.endsWith(".lock") || segment.endsWith(".tmp") || segment.endsWith(".bak") || segment.startsWith("watch.control.") || [...RESERVED_EVENT_LOG_NAMES].some((name) => segment.startsWith(`${name}.`));
}
function eventLogSegments(dir, resolved) {
  const rel = relative2(dir, resolved);
  if (rel === "") return [];
  return rel.split(/[\\/]+/u).filter(Boolean);
}
async function lstatIfExists(path) {
  try {
    return await lstat(path);
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT")
      return null;
    throw err;
  }
}
async function assertRealPathWithinState(dir, realDir, candidate) {
  let realCandidate;
  try {
    realCandidate = await realpath2(candidate);
  } catch {
    throw eventLogBoundaryError(dir);
  }
  if (!isWithinDir(realDir, realCandidate)) {
    throw eventLogBoundaryError(dir);
  }
}
async function assertEventLogPathSafe(dir, resolved) {
  if (!isWithinDir(dir, resolved)) {
    throw eventLogBoundaryError(dir);
  }
  const segments = eventLogSegments(dir, resolved);
  if (segments.some(isReservedEventLogSegment)) {
    throw eventLogReservedError();
  }
  await mkdir5(dir, { recursive: true });
  const realDir = await realpath2(dir);
  const parent = dirname3(resolved);
  const parentSegments = eventLogSegments(dir, parent);
  let current = dir;
  for (const segment of parentSegments) {
    current = join6(current, segment);
    const currentStat = await lstatIfExists(current);
    if (!currentStat) break;
    if (currentStat.isSymbolicLink()) {
      await assertRealPathWithinState(dir, realDir, current);
    } else if (!currentStat.isDirectory()) {
      throw new Error(
        `--event-log parent path must be a directory: ${current}`
      );
    }
  }
  const targetStat = await lstatIfExists(resolved);
  if (!targetStat) return;
  if (targetStat.isSymbolicLink()) {
    await assertRealPathWithinState(dir, realDir, resolved);
    return;
  }
  if (targetStat.isDirectory()) {
    throw new Error(
      `--event-log must be a file path, not a directory: ${resolved}`
    );
  }
}
async function resolveEventLogPath(eventLog) {
  if (!eventLog) return void 0;
  const dir = resolve2(stateDir4());
  const eventLogPath = String(eventLog);
  const resolved = isAbsolute4(eventLogPath) ? resolve2(eventLogPath) : resolve2(dir, eventLogPath);
  await assertEventLogPathSafe(dir, resolved);
  return resolved;
}
async function appendEventLog(eventLog, event) {
  if (!eventLog) return;
  await assertEventLogPathSafe(resolve2(stateDir4()), eventLog);
  await mkdir5(dirname3(eventLog), { recursive: true });
  await assertEventLogPathSafe(resolve2(stateDir4()), eventLog);
  await appendFile(eventLog, JSON.stringify(event) + "\n", "utf8");
}
async function restoreConsumedBaseline(result) {
  const range = result.digest.range;
  if ((range.newRecords ?? 0) > 0) {
    await markRead(result.runtime, result.digest.sessionId, {
      lastRecordIndex: Math.max(0, (range.nextIndex ?? 0) - range.newRecords),
      lastTotalRecords: range.totalRecords,
      transcriptPath: result.digest.transcriptPath,
      recordedCwd: result.digest.recordedCwd
    }).catch(() => null);
  }
}
function duplicateTargetError(conflictPid, key) {
  return new Error(
    `watcher pid ${conflictPid} is already watching ${key}; stop it with watch-ctl stop --pid ${conflictPid} or pin a different --session`
  );
}
var EMPTY_SHA2562 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
function emptyCursorStatus() {
  return {
    engagement: "unknown",
    activity: "none",
    content: "none",
    lifecycle: "none",
    delivery: "none",
    health: "unknown"
  };
}
function cursorBufferedFromFrame(target, result) {
  const bufferedFromFrame = result?.digest.cursorEvidence.bufferedFromFrame;
  return bufferedFromFrame === void 0 ? target.bufferedFromFrame ?? null : bufferedFromFrame;
}
function applyCursorTargetState(target, state, result) {
  target.observationCursor = state.lastRecordIndex;
  target.baselineRecordIndex = state.lastRecordIndex;
  target.continuity = structuredClone(state.continuity);
  target.pendingCandidateDeadline = state.stabilityCandidate ? Date.parse(state.stabilityCandidate.confirmAfter) : null;
  target.lastStatus = structuredClone(state.lastStatus);
  target.bufferedFromFrame = cursorBufferedFromFrame(target, result);
  target.continuityState = target.lastStatus.health === "blocked" ? "blocked" : "verified";
  if (result) target.recordCount = result.digest.range.totalFrames;
}
async function persistCursorTarget(target, pid, state, result) {
  const expectedObservationCursor = target.observationCursor ?? 0;
  const nextStatus = state.lastStatus;
  const updated = await compareAndSetCursorWatchTarget({
    pid,
    key: target.key,
    expectedObservationCursor,
    next: {
      observationCursor: state.lastRecordIndex,
      recordCount: result?.digest.range.totalFrames,
      bufferedFromFrame: cursorBufferedFromFrame(target, result),
      continuity: state.continuity,
      pendingCandidateDeadline: state.stabilityCandidate?.confirmAfter ?? null,
      lastStatus: nextStatus,
      continuityState: nextStatus.health === "blocked" ? "blocked" : "verified"
    }
  });
  if (updated.status !== "updated") {
    throw new Error(
      `Cursor watch target CAS ${updated.status} for ${target.key}`
    );
  }
  applyCursorTargetState(target, state, result);
}
async function cursorBaselineTarget(args, targets, deps, eventState) {
  const pinned = args.session?.startsWith("cursor:") ? args.session.slice("cursor:".length) : "";
  if (!pinned) {
    throw new Error("Cursor watch requires --session cursor:<sessionId>");
  }
  const candidate = await findSessionCandidate("cursor", args.cwd, pinned);
  if (!candidate) throw new Error(`Pinned Cursor session not found: ${pinned}`);
  const identity = await resolveCursorIdentity(candidate, args.cwd, pinned);
  if (identity.strength !== "exact") {
    throw new Error(
      `Cursor watch requires exact session identity: ${identity.reasons.join(", ") || identity.strength}`
    );
  }
  const prior = await getCursorSession(pinned);
  const scan = await scanCursorTranscript(identity.canonicalTranscriptPath, {
    verifyPrefixBytes: prior?.continuity.prefixBytes,
    onFrame() {
    }
  });
  deps.onCursorScan?.();
  const continuity = prior?.continuity ?? {
    indexBase: "zero-based-jsonl-frame-index",
    nextFrameIndex: 0,
    prefixBytes: 0,
    prefixSha256: EMPTY_SHA2562,
    observedSize: scan.file.size,
    device: scan.file.device,
    inode: scan.file.inode
  };
  if (continuity.device === null || continuity.inode === null) {
    throw new Error("Cursor watch requires stable device and inode identity");
  }
  const key = targetKey("cursor", pinned);
  const target = {
    key,
    runtime: "cursor",
    sessionId: pinned,
    transcriptPath: identity.canonicalTranscriptPath,
    recordedCwd: identity.canonicalCwd,
    signature: { mtimeMs: scan.file.mtimeMs, size: scan.file.size },
    recordCount: scan.totalFrames,
    baselineRecordIndex: prior?.lastRecordIndex ?? continuity.nextFrameIndex,
    candidateMtime: candidate.mtime,
    engagementStatus: prior?.lastStatus.engagement ?? candidate.engagementStatus,
    lockedAt: new Date(deps.now()).toISOString(),
    indexBase: "zero-based-jsonl-frame-index",
    canonicalTranscriptPath: identity.canonicalTranscriptPath,
    observationCursor: prior?.lastRecordIndex ?? continuity.nextFrameIndex,
    bufferedFromFrame: null,
    continuity,
    pendingCandidateDeadline: prior?.stabilityCandidate ? Date.parse(prior.stabilityCandidate.confirmAfter) : null,
    lastStatus: prior?.lastStatus ?? emptyCursorStatus(),
    continuityState: prior?.lastStatus.health === "blocked" ? "blocked" : "verified"
  };
  await recordWatcherTarget({
    pid: eventState.pid,
    target: {
      ...target,
      indexBase: "zero-based-jsonl-frame-index",
      canonicalTranscriptPath: identity.canonicalTranscriptPath,
      observationCursor: prior?.lastRecordIndex ?? continuity.nextFrameIndex,
      continuity,
      pendingCandidateDeadline: target.pendingCandidateDeadline === null || target.pendingCandidateDeadline === void 0 ? null : new Date(target.pendingCandidateDeadline).toISOString(),
      lastStatus: target.lastStatus,
      continuityState: target.continuityState
    }
  });
  targets.set(key, target);
  return target;
}
async function finalizeCursorOutput(result, chunk, deps) {
  let asynchronous = false;
  try {
    const callbackExpected = deps.writeStdout.length >= 2;
    let completeCallback;
    const callbackCompletion = callbackExpected ? new Promise((fulfill, reject) => {
      completeCallback = (error) => {
        if (error) reject(error);
        else fulfill();
      };
    }) : null;
    const output = deps.writeStdout(chunk, completeCallback);
    if (output && typeof output === "object" && "then" in output) {
      asynchronous = true;
      await output;
    } else if (callbackCompletion) {
      asynchronous = true;
      await callbackCompletion;
    }
  } catch (error) {
    if (result.delivery) {
      await result.delivery.abandon({
        deliveryUncertain: asynchronous
      });
    }
    throw error;
  }
  if (result.delivery) {
    const committed = await result.delivery.commit();
    if (committed !== "committed") {
      throw new Error(`Cursor delivery commit ${committed}`);
    }
  }
}
async function emitCursorDelta(result, target, args, deps, eventState) {
  const newFrames = result.digest.range.newFrames;
  const shouldRender = newFrames > 0 && !(args.quietEmpty && result.digest.accounting.rendered.count === 0);
  if (shouldRender) {
    const rendered = renderMarkdown(result.digest);
    const ts = new Date(deps.now()).toISOString();
    await finalizeCursorOutput(
      result,
      args.json ? JSON.stringify(stdoutEvent(ts, result.digest, rendered)) + "\n" : rendered + "\n",
      deps
    );
    const committedState = await getCursorSession(
      result.digest.sessionId
    );
    if (committedState) {
      await persistCursorTarget(target, eventState.pid, committedState, result);
    }
    await appendEventLog(
      args.eventLog,
      eventMetadata(ts, result.digest, rendered)
    );
    eventState.eventCount++;
    eventState.lastHeartbeatAt = deps.now();
    await recordWatcherEvent({
      pid: eventState.pid,
      lastEventAt: ts
    });
    return true;
  }
  if (result.delivery) {
    const committed = await result.delivery.commit();
    if (committed !== "committed") {
      throw new Error(`Cursor delivery commit ${committed}`);
    }
  }
  const current = await getCursorSession(
    result.digest.sessionId
  );
  if (current) {
    await persistCursorTarget(target, eventState.pid, current, result);
  }
  return false;
}
async function establishCursorBaseline(args, targets, deps, eventState) {
  const target = await cursorBaselineTarget(args, targets, deps, eventState);
  const result = await observeCatchUp(
    { ...args, runtime: "cursor" },
    cursorObserveDeps(deps, eventState.pid)
  );
  if (!result.ok) {
    if (result.kind === "continuityBlocked") {
      const state = await getCursorSession(target.sessionId);
      if (state) {
        const blockedState = {
          ...state,
          lastStatus: {
            ...state.lastStatus,
            health: "blocked"
          }
        };
        await persistCursorTarget(target, eventState.pid, blockedState);
      }
      await emitLockedTarget(args, deps, target);
      return target;
    }
    throw new Error(result.message);
  }
  await persistCursorTarget(target, eventState.pid, result.cursorState, result);
  const skippedFromIndex = result.fromIndex;
  const skippedToIndex = result.digest.range.nextIndex - 1;
  const hasStandaloneGap = !args.catchUpFirst && skippedToIndex >= skippedFromIndex;
  if (hasStandaloneGap && args.strictBaseline) {
    await result.delivery?.abandon();
    throw new Error(
      `strict baseline refused unread range ${skippedFromIndex}-${skippedToIndex} for ${target.key}`
    );
  }
  try {
    if (hasStandaloneGap) {
      await emitBaselineGap(
        args,
        deps,
        target,
        skippedFromIndex,
        skippedToIndex
      );
    }
    await emitLockedTarget(args, deps, target);
  } catch (error) {
    await result.delivery?.abandon({ deliveryUncertain: true });
    throw error;
  }
  if (args.catchUpFirst) {
    await emitCursorDelta(result, target, args, deps, eventState);
  } else {
    if (result.delivery) {
      const committed = await result.delivery.commit();
      if (committed !== "committed") {
        throw new Error(`Cursor baseline delivery commit ${committed}`);
      }
    }
    const current = await getCursorSession(target.sessionId);
    if (current) {
      await persistCursorTarget(target, eventState.pid, current, result);
    }
  }
  target.signature = await fileSignature(target.transcriptPath, deps.stat);
  return target;
}
async function establishBaseline(runtime, args, targets, deps, eventState) {
  if (runtime === "cursor") {
    return establishCursorBaseline(args, targets, deps, eventState);
  }
  const result = await observeCatchUp({ ...args, runtime });
  if (!result.ok) {
    if (result.kind === "noMatch") return null;
    throw new Error(result.message);
  }
  const key = targetKey(result.runtime, result.digest.sessionId);
  if (targets.has(key)) return targets.get(key) ?? null;
  const conflict = await findLiveWatcherForTarget({
    runtime: result.runtime,
    sessionId: result.digest.sessionId,
    excludePid: eventState.pid
  }).catch(() => null);
  if (conflict) {
    await restoreConsumedBaseline(result);
    throw duplicateTargetError(conflict.pid, key);
  }
  const signature = await fileSignature(
    result.digest.transcriptPath,
    deps.stat
  );
  const target = {
    key,
    runtime: result.runtime,
    sessionId: result.digest.sessionId,
    transcriptPath: result.digest.transcriptPath,
    recordedCwd: result.digest.recordedCwd,
    signature,
    recordCount: result.digest.range.totalRecords,
    baselineRecordIndex: result.digest.range.nextIndex,
    candidateMtime: result.candidate.mtime,
    engagementStatus: result.digest.engagement?.status ?? result.candidate.engagementStatus ?? "unknown",
    lockedAt: new Date(deps.now()).toISOString()
  };
  const skippedFromIndex = result.fromIndex;
  const skippedToIndex = target.baselineRecordIndex - 1;
  const hasStandaloneGap = !args.catchUpFirst && result.sessionState !== null && skippedToIndex >= skippedFromIndex;
  if (hasStandaloneGap && args.strictBaseline) {
    await restoreConsumedBaseline(result);
    throw new Error(
      `strict baseline refused unread range ${skippedFromIndex}-${skippedToIndex} for ${key}`
    );
  }
  try {
    await recordWatcherTarget({
      pid: eventState.pid,
      target: {
        runtime: target.runtime,
        sessionId: target.sessionId,
        transcriptPath: target.transcriptPath,
        recordedCwd: target.recordedCwd,
        recordCount: target.recordCount,
        baselineRecordIndex: target.baselineRecordIndex,
        engagementStatus: target.engagementStatus,
        lockedAt: target.lockedAt
      }
    });
  } catch (err) {
    const duplicate = err;
    if (duplicate?.code === "DUPLICATE_WATCH_TARGET") {
      await restoreConsumedBaseline(result);
      throw duplicateTargetError(duplicate.conflictPid, key);
    }
  }
  targets.set(key, target);
  if (hasStandaloneGap) {
    await emitBaselineGap(args, deps, target, skippedFromIndex, skippedToIndex);
  }
  await emitLockedTarget(args, deps, target);
  await setWatchedByPid(target.runtime, target.sessionId, eventState.pid).catch(() => false);
  if (args.catchUpFirst) {
    await emitObservedDelta(result, args, deps, eventState);
    target.signature = await fileSignature(target.transcriptPath, deps.stat);
    await emitPending(
      {
        key,
        runtime: target.runtime,
        sessionId: target.sessionId,
        firstChangedAt: deps.now(),
        lastChangedAt: deps.now()
      },
      targets,
      args,
      deps,
      eventState
    );
  }
  return target;
}
async function enqueueRecordsAppendedDuringBaseline(target, pending, deps) {
  let recordCount;
  try {
    recordCount = (await readRecords(target.transcriptPath)).length;
  } catch {
    return;
  }
  const baselineRecordIndex = Number(target.baselineRecordIndex ?? 0);
  if (recordCount <= baselineRecordIndex) return;
  target.recordCount = recordCount;
  const nowMs = deps.now();
  pending.set(target.key, {
    key: target.key,
    runtime: target.runtime,
    sessionId: target.sessionId,
    firstChangedAt: nowMs,
    lastChangedAt: nowMs
  });
}
async function establishBaselines(args, targets, pending, deps, eventState) {
  if (args.runtime === "auto") {
    const target = await establishBaseline(
      "auto",
      args,
      targets,
      deps,
      eventState
    );
    if (target)
      await enqueueRecordsAppendedDuringBaseline(target, pending, deps);
    return;
  }
  for (const runtime of watchRuntimes(args.runtime)) {
    if (args.runtime === "both" && hasTargetForRuntime(targets, runtime))
      continue;
    const target = await establishBaseline(
      runtime,
      args,
      targets,
      deps,
      eventState
    );
    if (target)
      await enqueueRecordsAppendedDuringBaseline(target, pending, deps);
  }
}
async function pollTargets(targets, pending, nowMs, statFn, watcherPid) {
  for (const target of targets.values()) {
    let signature;
    try {
      signature = await fileSignature(target.transcriptPath, statFn);
    } catch {
      if (target.runtime === "cursor") {
        const state = await getCursorSession(target.sessionId);
        if (state) {
          await persistCursorTarget(target, watcherPid, {
            ...state,
            lastStatus: {
              ...target.lastStatus ?? state.lastStatus,
              health: "error"
            }
          });
        }
      }
      continue;
    }
    const deadlineReady = target.runtime === "cursor" && target.pendingCandidateDeadline !== null && target.pendingCandidateDeadline !== void 0 && nowMs >= target.pendingCandidateDeadline;
    const recoveryVerificationNeeded = target.runtime === "cursor" && (target.lastStatus?.health === "error" || target.lastStatus?.health === "stale");
    if (!signatureChanged(target.signature, signature) && !deadlineReady && !recoveryVerificationNeeded)
      continue;
    target.signature = signature;
    const existing = pending.get(target.key);
    pending.set(target.key, {
      key: target.key,
      runtime: target.runtime,
      sessionId: target.sessionId,
      firstChangedAt: existing?.firstChangedAt ?? nowMs,
      lastChangedAt: nowMs,
      readyAt: recoveryVerificationNeeded ? nowMs : deadlineReady ? target.pendingCandidateDeadline : null
    });
  }
}
function newerCandidateKey(candidate) {
  return `${candidate.runtime}:${candidate.sessionId}:${candidate.transcriptPath}`;
}
async function emitNewerSessionCandidates(args, targets, emittedCandidates, deps, classificationCache) {
  for (const target of targets.values()) {
    const candidates = await findNewerSameCwdCandidates(
      target.runtime,
      args.cwd,
      {
        sessionId: target.sessionId,
        transcriptPath: target.transcriptPath,
        mtime: target.candidateMtime
      },
      classificationCache
    );
    for (const candidate of candidates) {
      const key = newerCandidateKey(candidate);
      if (emittedCandidates.has(key)) continue;
      await emitNewerSessionCandidate(args, deps, target, candidate);
      emittedCandidates.add(key);
    }
  }
}
async function emitPending(entry, targets, args, deps, eventState) {
  const result = entry.runtime === "cursor" ? await observeCatchUp(
    {
      ...args,
      runtime: "cursor",
      session: `cursor:${entry.sessionId}`,
      suppressWatchedWarningPid: eventState.pid
    },
    cursorObserveDeps(deps, eventState.pid)
  ) : await observeCatchUp({
    ...args,
    runtime: entry.runtime,
    session: `${entry.runtime}:${entry.sessionId}`,
    suppressWatchedWarningPid: eventState.pid
  });
  if (!result.ok) {
    if (result.kind === "noMatch") return false;
    if (entry.runtime === "cursor" && (result.kind === "continuityBlocked" || result.kind === "ownerConflict")) {
      const target = targets.get(entry.key);
      const state = await getCursorSession(entry.sessionId);
      if (target && state) {
        const blockedState = {
          ...state,
          lastStatus: {
            ...state.lastStatus,
            delivery: result.kind === "ownerConflict" ? "uncertain" : state.lastStatus.delivery,
            health: result.kind === "continuityBlocked" ? "blocked" : "error"
          }
        };
        await persistCursorTarget(target, eventState.pid, blockedState);
      }
      return false;
    }
    throw new Error(result.message);
  }
  if (result.runtime === "cursor") {
    const target = targets.get(entry.key);
    if (!target) return false;
    await persistCursorTarget(
      target,
      eventState.pid,
      result.cursorState,
      result
    );
    target.signature = await fileSignature(target.transcriptPath, deps.stat);
    if (result.deliveryUncertain) return false;
    return emitCursorDelta(result, target, args, deps, eventState);
  }
  const newRecords = result.digest.range.newRecords ?? 0;
  if (newRecords <= 0) return false;
  if (args.quietEmpty && result.digest.accounting.rendered.count === 0) {
    return false;
  }
  const rendered = renderMarkdown(result.digest);
  const ts = new Date(deps.now()).toISOString();
  const metadata = eventMetadata(ts, result.digest, rendered);
  if (args.json) {
    await writeStdoutChunk(
      deps,
      JSON.stringify(stdoutEvent(ts, result.digest, rendered)) + "\n"
    );
  } else {
    await writeStdoutChunk(deps, rendered + "\n");
  }
  await appendEventLog(args.eventLog, metadata);
  eventState.eventCount++;
  eventState.lastHeartbeatAt = deps.now();
  await recordWatcherEvent({
    pid: eventState.pid,
    lastEventAt: ts
  });
  await setWatchedByPid(result.runtime, result.digest.sessionId, eventState.pid).catch(() => false);
  return true;
}
async function emitObservedDelta(result, args, deps, eventState) {
  const newRecords = result.digest.range.newRecords ?? 0;
  if (newRecords <= 0) return false;
  if (args.quietEmpty && result.digest.accounting.rendered.count === 0) {
    return false;
  }
  const rendered = renderMarkdown(result.digest);
  const ts = new Date(deps.now()).toISOString();
  const metadata = eventMetadata(ts, result.digest, rendered);
  if (args.json) {
    await writeStdoutChunk(
      deps,
      JSON.stringify(stdoutEvent(ts, result.digest, rendered)) + "\n"
    );
  } else {
    await writeStdoutChunk(deps, rendered + "\n");
  }
  await appendEventLog(args.eventLog, metadata);
  eventState.eventCount++;
  eventState.lastHeartbeatAt = deps.now();
  await recordWatcherEvent({
    pid: eventState.pid,
    lastEventAt: ts
  });
  await setWatchedByPid(result.runtime, result.digest.sessionId, eventState.pid).catch(() => false);
  return true;
}
async function emitReadyPending(args, targets, pending, deps, eventState, { force = false } = {}) {
  const nowMs = deps.now();
  for (const entry of [...pending.values()]) {
    const quietForMs = nowMs - entry.lastChangedAt;
    const pendingForMs = nowMs - (entry.firstChangedAt ?? entry.lastChangedAt);
    const ready = quietForMs >= eventState.debounceMs || pendingForMs >= eventState.maxPendingMs || entry.readyAt !== null && entry.readyAt !== void 0 && nowMs >= entry.readyAt;
    if (!force && !ready) continue;
    await emitPending(entry, targets, args, deps, eventState);
    pending.delete(entry.key);
  }
}
async function flushPendingBeforeMaxRuntime(args, targets, pending, deps, eventState) {
  if (eventState.paused || targets.size === 0) return;
  await pollTargets(targets, pending, deps.now(), deps.stat, eventState.pid);
  await emitReadyPending(args, targets, pending, deps, eventState, {
    force: true
  });
}
async function applyControlDirective(args, targets, pending, deps, eventState) {
  const control = await readControlDirective({
    pid: eventState.pid
  });
  if (!control?.directive) return;
  if (control.pid !== void 0 && control.pid !== eventState.pid) return;
  await clearControlDirective({ pid: eventState.pid });
  switch (control.directive) {
    case "pause":
      eventState.paused = true;
      return;
    case "resume":
      eventState.paused = false;
      return;
    case "flush":
      await emitReadyPending(args, targets, pending, deps, eventState, {
        force: true
      });
      return;
    case "stop":
      eventState.stopRequested = true;
      eventState.stopReason = "control-stop";
      return;
    default:
      return;
  }
}
function installSignalHandlers(eventState) {
  const handler = () => {
    eventState.stopRequested = true;
    eventState.stopReason = "signal";
  };
  process.once("SIGINT", handler);
  process.once("SIGTERM", handler);
  return () => {
    process.removeListener("SIGINT", handler);
    process.removeListener("SIGTERM", handler);
  };
}
async function runWatchLoop(args, deps = {}) {
  const runtime = args.runtime ?? "auto";
  const cwd = args.cwd ?? process.cwd();
  const eventLog = args.eventLog ? await resolveEventLogPath(args.eventLog) : void 0;
  const resolvedMaxPendingMs = maxPendingMs(args.maxPendingSec);
  const resolvedHeartbeatMs = heartbeatMs(args.heartbeatSec);
  const normalizedArgs = {
    ...args,
    runtime,
    cwd,
    eventLog,
    maxPendingSec: resolvedMaxPendingMs / 1e3,
    heartbeatSec: resolvedHeartbeatMs === null ? 0 : resolvedHeartbeatMs / 1e3
  };
  const pollMs = toPositiveMs(args.pollSec, DEFAULT_POLL_SEC);
  const debounceMs = toPositiveMs(args.debounceSec, DEFAULT_DEBOUNCE_SEC);
  const limitMs = maxRuntimeMs(args.maxRuntimeMin);
  const startedAtMs = (deps.now ?? Date.now)();
  const deadlineMs = limitMs === null ? null : startedAtMs + limitMs;
  const watcherPid = deps.pid ?? process.pid;
  const resolvedDeps = {
    now: deps.now ?? Date.now,
    sleep: deps.sleep ?? sleep4,
    stat: deps.stat ?? stat5,
    writeStdout: deps.writeStdout ?? writeProcessStdout,
    onCursorScan: deps.onCursorScan,
    deadlineMs
  };
  const targets = /* @__PURE__ */ new Map();
  const pending = /* @__PURE__ */ new Map();
  const emittedNewerCandidates = /* @__PURE__ */ new Set();
  const classificationCache = new ClassificationCache();
  const eventState = {
    pid: watcherPid,
    debounceMs,
    maxPendingMs: resolvedMaxPendingMs,
    eventCount: 0,
    lastHeartbeatAt: startedAtMs,
    heartbeatMs: resolvedHeartbeatMs,
    paused: false,
    stopRequested: false,
    stopReason: "stopped"
  };
  const removeSignalHandlers = deps.handleSignals === false ? () => {
  } : installSignalHandlers(eventState);
  let active;
  try {
    active = await startWatcher({
      runtime,
      cwd,
      pid: watcherPid,
      startedAt: new Date(startedAtMs).toISOString(),
      session: args.session ?? null,
      pollSec: pollMs / 1e3,
      debounceSec: debounceMs / 1e3,
      maxPendingSec: resolvedMaxPendingMs / 1e3,
      heartbeatSec: resolvedHeartbeatMs === null ? 0 : resolvedHeartbeatMs / 1e3,
      staleAfterSec: (pollMs + debounceMs + resolvedMaxPendingMs) / 1e3
    });
  } catch (err) {
    removeSignalHandlers();
    throw err;
  }
  let reason = "stopped";
  try {
    await emitWatchPosture(normalizedArgs, resolvedDeps);
    while (true) {
      if (eventState.stopRequested) {
        reason = eventState.stopReason;
        break;
      }
      const nowMs = resolvedDeps.now();
      if (deadlineMs !== null && nowMs >= deadlineMs) {
        reason = "max-runtime";
        await flushPendingBeforeMaxRuntime(
          normalizedArgs,
          targets,
          pending,
          resolvedDeps,
          eventState
        );
        break;
      }
      if (targets.size === 0 || args.runtime === "both") {
        await establishBaselines(
          normalizedArgs,
          targets,
          pending,
          resolvedDeps,
          eventState
        );
      }
      await pollTargets(
        targets,
        pending,
        nowMs,
        resolvedDeps.stat,
        eventState.pid
      );
      await emitNewerSessionCandidates(
        normalizedArgs,
        targets,
        emittedNewerCandidates,
        resolvedDeps,
        classificationCache
      );
      await applyControlDirective(
        normalizedArgs,
        targets,
        pending,
        resolvedDeps,
        eventState
      );
      if (eventState.stopRequested) {
        reason = eventState.stopReason;
        break;
      }
      if (!eventState.paused) {
        await emitReadyPending(
          normalizedArgs,
          targets,
          pending,
          resolvedDeps,
          eventState
        );
      }
      if (eventState.heartbeatMs !== null && targets.size > 0 && resolvedDeps.now() - eventState.lastHeartbeatAt >= eventState.heartbeatMs) {
        await emitHeartbeat(normalizedArgs, targets, resolvedDeps, eventState);
        eventState.lastHeartbeatAt = resolvedDeps.now();
      }
      await recordWatcherPoll({
        pid: eventState.pid,
        lastPollAt: new Date(resolvedDeps.now()).toISOString()
      }).catch(() => null);
      const afterTickMs = resolvedDeps.now();
      if (deadlineMs !== null && afterTickMs >= deadlineMs) {
        reason = "max-runtime";
        await flushPendingBeforeMaxRuntime(
          normalizedArgs,
          targets,
          pending,
          resolvedDeps,
          eventState
        );
        break;
      }
      const delayMs = deadlineMs === null ? pollMs : Math.max(0, Math.min(pollMs, deadlineMs - afterTickMs));
      if (delayMs > 0) await resolvedDeps.sleep(delayMs);
    }
    await emitStopped(normalizedArgs, resolvedDeps, reason, eventState);
    return { reason, eventCount: eventState.eventCount };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    await recordWatcherError({
      pid: eventState.pid,
      error,
      at: new Date(resolvedDeps.now()).toISOString()
    }).catch(() => null);
    await emitErrorEvent(normalizedArgs, resolvedDeps, error);
    error.watchErrorEventEmitted = true;
    throw error;
  } finally {
    removeSignalHandlers();
    for (const target of targets.values()) {
      if (target.runtime === "cursor") continue;
      await clearWatchedByPid(target.runtime, target.sessionId, active.pid).catch(() => false);
    }
    await clearControlDirective({ pid: active.pid }).catch(() => false);
    await clearWatcher({ pid: active.pid });
  }
}
export {
  cursorTargetHealthReasons,
  runWatchLoop
};
