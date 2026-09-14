// GENERATED skill payload for session-observer.

// src/skills/session-observer/src/lib/locate.ts
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  opendir,
  stat,
  mkdir,
  readFile as readFile2,
  realpath,
  rename,
  open as open2,
  unlink
} from "node:fs/promises";
import { homedir as homedir2 } from "node:os";
import { join as join2, basename as basename2, isAbsolute as isAbsolute2, relative, resolve } from "node:path";
import { promisify } from "node:util";

// src/shared/transcript/runtimes.ts
import { open, readFile } from "node:fs/promises";
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
    handle = await open(transcriptPath, "r");
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
function codexLineageMetadata(records) {
  const sessionMetadata = records.filter(
    (record) => record.type === "session_meta" && isObject(record.payload)
  );
  const payloads = sessionMetadata.map(
    (record) => record.payload
  );
  const nativeValues = payloads.filter((payload) => Object.hasOwn(payload, "id")).map((payload) => payload.id);
  const rootValues = payloads.filter((payload) => Object.hasOwn(payload, "session_id")).map((payload) => payload.session_id);
  const forkValues = payloads.filter((payload) => Object.hasOwn(payload, "forked_from_id")).map((payload) => payload.forked_from_id);
  const nativeSessionId = consistentNonEmptyString(nativeValues);
  const rootSessionId = consistentNonEmptyString(rootValues);
  const forkedFromSessionId = consistentNonEmptyString(forkValues);
  return {
    ...nativeSessionId === void 0 ? {} : { nativeSessionId },
    ...rootSessionId === void 0 ? {} : { rootSessionId },
    ...forkedFromSessionId === void 0 ? {} : { forkedFromSessionId }
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
    let sessionId;
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
    return { sessionId, recordedCwd, ...codexLineageMetadata(records) };
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

// src/skills/session-observer/src/lib/locate.ts
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
function configureCursorDiscoveryForTest(options) {
  cursorDiscoveryTestOptions = options;
}
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
  const stateDir = process.env.STATE_DIR ?? join2(homedir2(), ".local", "state", "session-observer");
  return join2(stateDir, "codex-cwd-cache.json");
}
async function loadCwdCache() {
  try {
    const raw = await readFile2(cwdCachePath(), "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
async function saveCwdCache(cache) {
  try {
    const path = cwdCachePath();
    const dir = path.replace(/\/[^/]+$/, "");
    await mkdir(dir, { recursive: true });
    const tmp = join2(
      dir,
      `codex-cwd-cache.${process.pid}.${Date.now()}.${randomUUID()}.tmp`
    );
    let fh;
    try {
      fh = await open2(tmp, "w");
      await fh.write(JSON.stringify(cache, null, 2));
      await fh.datasync();
      await fh.close();
      fh = null;
      await rename(tmp, path);
    } finally {
      if (fh) {
        try {
          await fh.close();
        } catch {
        }
      }
      try {
        await unlink(tmp);
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
    const encodedDir = join2(projectsRoot, encoded);
    try {
      const entries = await opendir(encodedDir);
      for await (const entry of entries) {
        budget?.consumeEntry();
        if (!entry.name.endsWith(".jsonl")) continue;
        const transcriptPath = join2(encodedDir, entry.name);
        if (seenTranscripts.has(transcriptPath)) continue;
        seenTranscripts.add(transcriptPath);
        let fileStat;
        try {
          fileStat = await stat(transcriptPath);
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
      const projectDir = join2(projectsRoot, dirName);
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
        const transcriptPath = join2(projectDir, entry.name);
        if (seenTranscripts.has(transcriptPath)) continue;
        seenTranscripts.add(transcriptPath);
        let fileStat;
        try {
          fileStat = await stat(transcriptPath);
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
async function claudeCodeLookupDiagnostics(targetCwd) {
  const [projectsRoot] = discoverPaths("claude-code");
  const diagnostics = [];
  for (const encoded of encodeCwdVariants("claude-code", targetCwd)) {
    const path = join2(projectsRoot, encoded);
    let exists = false;
    try {
      const s = await stat(path);
      exists = s.isDirectory();
    } catch {
      exists = false;
    }
    diagnostics.push({ encoded, path, exists });
  }
  return diagnostics;
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
      const fullPath = join2(dir, entry.name);
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
      fileStat = await stat(transcriptPath);
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
      const sessionPath = join2(transcriptsRoot, sessionDir.name);
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
          const transcriptPath = join2(sessionPath, entry.name);
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
      resolvedStat = await stat(transcriptPath);
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
    const transcriptsRoot = join2(projectsRoot, encoded, "agent-transcripts");
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
      const transcriptsRoot = join2(
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
          fileStat = await stat(transcriptPath);
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
      const transcriptsRoot = join2(
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
          fileStat = await stat(transcriptPath);
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
  return transcriptBase && !["transcript", "conversation", "messages"].includes(transcriptBase) ? transcriptBase : basename2(join2(transcriptPath, ".."));
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
          join2(projectsRoot, projectDir.name, "agent-transcripts")
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
            join2(
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
          const transcriptPath = join2(
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
  const storeRoot = join2(homedir2(), ".cursor", "projects");
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
export {
  ClassificationCache,
  CursorDiscoveryError,
  SessionDiscoveryError,
  claudeCodeLookupDiagnostics,
  configureCursorDiscoveryForTest,
  discover,
  findNewerSameCwdCandidates,
  findSessionCandidate,
  gitWorktrees,
  resolveCursorIdentity
};
