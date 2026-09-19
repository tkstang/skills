#!/usr/bin/env node
// GENERATED skill payload for session-fork-to-destination.

// src/skills/session-fork-to-destination/src/guidance-cli.ts
import { realpath as realpath4 } from "node:fs/promises";

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
function messageEntry(role, text, recordIndex, displayRole, origin, allowAutomaticControl = true) {
  if (role === "user" && allowAutomaticControl) {
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
    ...displayRole ? { displayRole } : {},
    ...origin ? { origin } : {}
  };
}
function claudeUserRecordProvenance(record) {
  const origin = isObject(record.origin) ? asString(record.origin.kind) : null;
  if (origin === null || origin === void 0) return "legacy-absent";
  if (origin === "human") return "human";
  if (origin === "task-notification") return "runtime-notification";
  return "unmarked";
}
function claudeEntryProvenance(provenance) {
  if (provenance === "human") return { origin: "human" };
  if (provenance === "runtime-notification") {
    return {
      displayRole: "runtime-notification",
      origin: "runtime-notification"
    };
  }
  return {};
}
function claudeAskUserAnswerProvenance(provenance) {
  if (provenance === "legacy-absent" || provenance === "human") {
    return { origin: "human" };
  }
  return claudeEntryProvenance(provenance);
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
    if (!isObject(parsed)) {
      return {
        ok: false,
        kind: "not-object",
        reason: "not a JSON object"
      };
    }
    return { ok: true, value: parsed };
  } catch (err) {
    return {
      ok: false,
      kind: "malformed",
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
async function readTailRecordsBounded(transcriptPath, options) {
  validateBoundedReadOptions(options);
  const deadline = deadlineAt(options);
  const window = await readBoundedWindow(
    transcriptPath,
    options,
    "tail",
    deadline
  );
  if (window === null) {
    return {
      records: [],
      truncated: false,
      bytesRead: 0,
      recordsInspected: 0
    };
  }
  const parsed = parseBoundedLines(
    window.buffer,
    options,
    deadline,
    "tail",
    window.offset > 0,
    false
  );
  return {
    records: parsed.records,
    truncated: window.offset > 0 || parsed.incomplete,
    bytesRead: window.buffer.length,
    recordsInspected: parsed.recordsInspected,
    ...parsed.recordLimitExceeded ? { recordLimitExceeded: true } : {}
  };
}
async function readRecordsDetailedInternal(transcriptPath) {
  const raw = await readFile(transcriptPath, "utf8");
  if (!raw) return { records: [], diagnostics: [], legacyWarnings: [] };
  const lines = raw.split("\n");
  const records = [];
  const diagnostics = [];
  const legacyWarnings = [];
  const fileEndsWithNewline = raw.endsWith("\n");
  const lastIndex = lines.length - 1;
  for (let i = 0; i < lines.length; i++) {
    const carrier = lines[i];
    const line = carrier.trim();
    if (!line) continue;
    const result = safeParseLine(line);
    if (result.ok) {
      records.push({
        record: result.value,
        recordIndex: records.length,
        physicalLine: i + 1
      });
      continue;
    }
    const isLastToken = i === lastIndex;
    if (isLastToken && !fileEndsWithNewline) {
      diagnostics.push({
        kind: "partial-tail",
        physicalLine: i + 1
      });
      legacyWarnings.push(
        `[runtimes] Partial trailing line dropped from ${transcriptPath} (line ${i + 1}): ${result.reason}`
      );
    } else {
      diagnostics.push({
        kind: result.kind,
        physicalLine: i + 1
      });
      legacyWarnings.push(
        `[runtimes] Malformed JSONL line ${i + 1} in ${transcriptPath} skipped: ${result.reason}`
      );
    }
  }
  return { records, diagnostics, legacyWarnings };
}
async function readRecords(transcriptPath) {
  const detailed = await readRecordsDetailedInternal(transcriptPath);
  for (const warning of detailed.legacyWarnings) {
    console.warn(warning);
  }
  const records = detailed.records.map(({ record }) => record);
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
  return records.find((record) => record.type === "session_meta");
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
  if (!isObject(firstHeader.payload)) return null;
  const payload = firstHeader.payload;
  if (!Object.hasOwn(payload, "id")) return {};
  const nativeSessionId = consistentNonEmptyString([payload.id]);
  if (nativeSessionId === void 0) return null;
  const rootSessionId = Object.hasOwn(payload, "session_id") ? consistentNonEmptyString([payload.session_id]) : void 0;
  if (Object.hasOwn(payload, "session_id") && rootSessionId === void 0) {
    return null;
  }
  const parentValues = codexDirectParentValues(payload);
  const parentSessionId = consistentNonEmptyString(parentValues);
  if (parentValues.length > 0 && parentSessionId === void 0) return null;
  const forkedFromSessionId = Object.hasOwn(payload, "forked_from_id") ? consistentNonEmptyString([payload.forked_from_id]) : void 0;
  if (Object.hasOwn(payload, "forked_from_id") && forkedFromSessionId === void 0) {
    return null;
  }
  const historyBoundary = payload.subagent_history_start_ordinal;
  const subagentHistoryStartOrdinal = Number.isSafeInteger(historyBoundary) && Number(historyBoundary) >= 0 ? Number(historyBoundary) : void 0;
  if (Object.hasOwn(payload, "subagent_history_start_ordinal") && subagentHistoryStartOrdinal === void 0) {
    return null;
  }
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
    const firstLegacySessionId = firstHeader ? codexSessionIdFromRecord(firstHeader) : void 0;
    const firstHeaderIndex = firstHeader ? records.indexOf(firstHeader) : -1;
    const laterNativeHeaderPresent = records.slice(firstHeaderIndex + 1).some(
      (record) => record.type === "session_meta" && isObject(record.payload) && Object.hasOwn(record.payload, "id")
    );
    if (firstHeader && nativeSessionId === void 0 && firstLegacySessionId === void 0 && (filenameSessionId !== void 0 || laterNativeHeaderPresent)) {
      return null;
    }
    if (nativeSessionId !== void 0 && filenameSessionId !== void 0 && nativeSessionId.toLowerCase() !== filenameSessionId.toLowerCase()) {
      return null;
    }
    let sessionId = nativeSessionId ?? firstLegacySessionId;
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
        ...claudeAskUserAnswerProvenance(opts.userProvenance)
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
    ...claudeAskUserAnswerProvenance(opts.userProvenance)
  };
}
function claudeEntriesFromContent(role, content, recordIndex, opts) {
  const provenance = claudeEntryProvenance(opts.userProvenance);
  if (typeof content === "string") {
    if (!content) return [];
    if (isClaudeCommandMessageText(content)) {
      if (!opts.includeCommandMessages) return [];
      return [{ role, text: content, recordIndex, kind: "command_message" }];
    }
    return [
      messageEntry(
        role,
        content,
        recordIndex,
        provenance.displayRole,
        provenance.origin,
        opts.userProvenance === "legacy-absent"
      )
    ];
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
    return text ? [
      messageEntry(
        role,
        text,
        recordIndex,
        provenance.displayRole,
        provenance.origin,
        opts.userProvenance === "legacy-absent"
      )
    ] : [];
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
      toolUseResult: record.toolUseResult,
      userProvenance: role === "user" ? claudeUserRecordProvenance(record) : "legacy-absent"
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
  return entry.kind === "command_message" || entry.origin === "automatic-control" || entry.origin === "runtime-notification" || isHiddenBootstrapUserText(entry.text);
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
var CODEX_ROLLOUT_FILENAME_PATTERN2 = /^rollout-.+-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/iu;
function codexFilenameSessionId(transcriptPath) {
  return CODEX_ROLLOUT_FILENAME_PATTERN2.exec(basename2(transcriptPath))?.[1];
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
    let meta;
    let identityStatus;
    const filenameSessionId = codexFilenameSessionId(transcriptPath);
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
    const cached = persistentCacheAllowed ? cwdCache[key] : void 0;
    if (cached?.identityVersion === 2 && cached.fileSize === fileStat.size && cached.fileMtimeMs === fileStat.mtimeMs && cached.fileDev === fileStat.dev && cached.fileIno === fileStat.ino && cached.sessionId !== void 0 && cached.meta !== void 0 && cached.identityStatus !== void 0) {
      recordedCwd = cached.recordedCwd;
      sessionId = cached.sessionId;
      meta = cached.meta;
      identityStatus = cached.identityStatus;
    } else {
      meta = boundedDerived?.meta ?? null;
      if (!budget) {
        try {
          meta = await extractMeta("codex", transcriptPath);
        } catch {
          meta = null;
        }
      }
      recordedCwd = meta?.recordedCwd ?? null;
      sessionId = meta?.sessionId ?? filenameSessionId ?? basename2(transcriptPath).replace(/\.jsonl$/, "");
      identityStatus = meta ? meta.nativeSessionId ? "native" : "legacy" : "invalid";
      if (persistentCacheAllowed) {
        cwdCache[key] = {
          recordedCwd,
          sessionId,
          identityVersion: 2,
          fileSize: fileStat.size,
          fileMtimeMs: fileStat.mtimeMs,
          fileDev: fileStat.dev,
          fileIno: fileStat.ino,
          meta,
          identityStatus,
          ...filenameSessionId ? { filenameSessionId } : {}
        };
        cacheModified = true;
      }
    }
    candidates.push({
      runtime: "codex",
      transcriptPath,
      sessionId,
      recordedCwd,
      identityStatus,
      ...filenameSessionId ? { filenameSessionId } : {},
      ...meta?.nativeSessionId ? { nativeSessionId: meta.nativeSessionId } : {},
      ...meta?.rootSessionId ? { rootSessionId: meta.rootSessionId } : {},
      ...meta?.parentSessionId ? { parentSessionId: meta.parentSessionId } : {},
      ...meta?.forkedFromSessionId ? { forkedFromSessionId: meta.forkedFromSessionId } : {},
      ...meta?.subagentHistoryStartOrdinal === void 0 ? {} : {
        subagentHistoryStartOrdinal: meta.subagentHistoryStartOrdinal
      },
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
async function discover(runtime, targetCwd, cache = new ClassificationCache(), options) {
  if (runtime === "claude-code") {
    return discoverClaudeCode(targetCwd, cache, options);
  }
  if (runtime === "codex") return discoverCodex(targetCwd, cache, options);
  if (runtime === "cursor") return discoverCursor(targetCwd, cache, options);
  throw new Error(`Unknown runtime: ${runtime}`);
}

// src/skills/session-fork-to-destination/src/guidance-discovery.ts
import { realpath as realpath2 } from "node:fs/promises";
var GUIDANCE_DISCOVERY_OPTIONS = Object.freeze({
  persistence: "forbid",
  recency: "exact-all",
  budget: Object.freeze({
    maxEntries: 5e4,
    maxAggregateBytes: 512 * 1024 * 1024,
    maxMetadataBytesPerEntry: 256 * 1024,
    deadlineMs: 3e4
  })
});
var GuidanceDiscoveryError = class extends Error {
  constructor(code, provider2, reason) {
    super(code);
    this.code = code;
    this.provider = provider2;
    this.reason = reason;
    this.name = "GuidanceDiscoveryError";
  }
  code;
  provider;
  reason;
};
var RUNTIME_BY_PROVIDER = {
  claude: "claude-code",
  codex: "codex",
  cursor: "cursor"
};
var LOCATOR_FAILURE_REASONS = /* @__PURE__ */ new Set([
  "CURSOR_DISCOVERY_ENTRY_BUDGET_EXCEEDED",
  "CURSOR_DISCOVERY_TIME_BUDGET_EXCEEDED",
  "CURSOR_DISCOVERY_BYTE_BUDGET_EXCEEDED",
  "CURSOR_DISCOVERY_RETAINED_CANDIDATE_BUDGET_EXCEEDED",
  "IDENTITY_INDEX_INCOMPLETE",
  "DISCOVERY_ENTRY_BUDGET_EXCEEDED",
  "DISCOVERY_BYTE_BUDGET_EXCEEDED",
  "DISCOVERY_DEADLINE_EXCEEDED",
  "DISCOVERY_ENUMERATION_INCOMPLETE",
  "DISCOVERY_TRANSCRIPT_INCOMPLETE"
]);
function locatorFailureReason(error) {
  if (error !== null && typeof error === "object") {
    const code = error.code;
    if (typeof code === "string" && LOCATOR_FAILURE_REASONS.has(code)) {
      return code;
    }
  }
  return "provider-discovery-failed";
}
var DEFAULT_DEPENDENCIES = {
  discover,
  canonicalize: async (path) => realpath2(path).catch(() => null),
  readCodexNativeId: readGuidanceCodexNativeId
};
async function readGuidanceCodexNativeId(candidate) {
  let sourceIssue = false;
  const bounded = await readMetadataRecordsBounded(candidate.transcriptPath, {
    maxBytes: GUIDANCE_DISCOVERY_OPTIONS.budget.maxMetadataBytesPerEntry,
    maxRecords: 128,
    diagnostic: () => {
      sourceIssue = true;
    }
  });
  if (sourceIssue) return null;
  const meta = extractMetaFromRecords(
    "codex",
    bounded.records,
    candidate.transcriptPath
  );
  if (meta === null || meta.sessionId !== candidate.sessionId || meta.nativeSessionId === void 0 || meta.nativeSessionId.length === 0) {
    return null;
  }
  return meta.nativeSessionId;
}
function surfaceForCandidate(provider2) {
  return provider2 === "cursor" ? { surface: "ambiguous", originEvidence: "store-origin-ambiguous" } : { surface: "cli", originEvidence: "cli-transcript" };
}
function compareKeys(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
async function discoverGuidance(sourcePath, options = {}) {
  const deps = options.deps ?? DEFAULT_DEPENDENCIES;
  const sourceCanonical = await deps.canonicalize(sourcePath).catch(() => null);
  if (sourceCanonical === null)
    throw new GuidanceDiscoveryError("source-unavailable");
  const providers = [...options.providers ?? ["claude", "codex", "cursor"]];
  if (providers.length === 0 || new Set(providers).size !== providers.length || providers.some((provider2) => !(provider2 in RUNTIME_BY_PROVIDER))) {
    throw new GuidanceDiscoveryError(
      "discovery-incomplete",
      void 0,
      "invalid-provider-selection"
    );
  }
  const projected = [];
  const unattributable = /* @__PURE__ */ new Map();
  for (const provider2 of providers.toSorted()) {
    let transcripts;
    try {
      transcripts = await deps.discover(
        RUNTIME_BY_PROVIDER[provider2],
        sourceCanonical,
        new ClassificationCache(),
        provider2 === "cursor" ? GUIDANCE_DISCOVERY_OPTIONS : {
          ...GUIDANCE_DISCOVERY_OPTIONS,
          unattributablePolicy: "summarize",
          unattributable: ({ reason }) => {
            const reasons = unattributable.get(provider2) ?? /* @__PURE__ */ new Map();
            reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
            unattributable.set(provider2, reasons);
          }
        }
      );
    } catch (error) {
      throw new GuidanceDiscoveryError(
        "discovery-incomplete",
        provider2,
        locatorFailureReason(error)
      );
    }
    for (const transcript of transcripts) {
      if (provider2 === "cursor" && transcript.cwdEvidenceQuality !== "independent-exact") {
        throw new GuidanceDiscoveryError(
          "discovery-incomplete",
          provider2,
          "cwd-evidence-incomplete"
        );
      }
      if (transcript.runtime !== RUNTIME_BY_PROVIDER[provider2])
        throw new GuidanceDiscoveryError(
          "discovery-incomplete",
          provider2,
          "candidate-invalid"
        );
      if (transcript.recordedCwd === null)
        throw new GuidanceDiscoveryError(
          "discovery-incomplete",
          provider2,
          "cwd-missing"
        );
      const recordedCwd = await deps.canonicalize(transcript.recordedCwd).catch(() => null);
      if (recordedCwd === null && provider2 !== "cursor") {
        const reasons = unattributable.get(provider2) ?? /* @__PURE__ */ new Map();
        reasons.set(
          "cwd-unresolvable",
          (reasons.get("cwd-unresolvable") ?? 0) + 1
        );
        unattributable.set(provider2, reasons);
        continue;
      }
      if (recordedCwd === null)
        throw new GuidanceDiscoveryError(
          "discovery-incomplete",
          provider2,
          "cwd-unresolvable"
        );
      if (recordedCwd !== sourceCanonical) continue;
      const nativeId = provider2 === "codex" ? await deps.readCodexNativeId(transcript).catch(() => null) : transcript.sessionId;
      if (nativeId === null || nativeId.length === 0) {
        throw new GuidanceDiscoveryError(
          "discovery-incomplete",
          provider2,
          "native-id-missing"
        );
      }
      const surface = surfaceForCandidate(provider2);
      projected.push({
        key: `${provider2}:${surface.surface}:${nativeId}`,
        provider: provider2,
        surface: surface.surface,
        nativeId,
        recordedCwd,
        modifiedAtMs: transcript.mtime * 1e3,
        size: transcript.size,
        engagement: transcript.engagementStatus,
        originEvidence: surface.originEvidence
      });
    }
  }
  const byKey = /* @__PURE__ */ new Map();
  for (const candidate of projected) {
    const existing = byKey.get(candidate.key);
    if (existing !== void 0 && JSON.stringify(existing) !== JSON.stringify(candidate)) {
      throw new GuidanceDiscoveryError(
        "discovery-incomplete",
        candidate.provider,
        "candidate-conflict"
      );
    }
    byKey.set(candidate.key, candidate);
  }
  return {
    candidates: [...byKey.values()].toSorted(
      (left, right) => compareKeys(left.key, right.key)
    ),
    unattributable: [...unattributable.entries()].toSorted(([left], [right]) => compareKeys(left, right)).map(([provider2, reasons]) => ({
      provider: provider2,
      reasons: [...reasons.entries()].toSorted(([left], [right]) => compareKeys(left, right)).map(([code, count]) => ({ code, count }))
    }))
  };
}
async function discoverGuidanceCandidates(sourcePath, options = {}) {
  return (await discoverGuidance(sourcePath, options)).candidates;
}
function selectGuidanceCandidate(candidates, key) {
  const matches = candidates.filter((candidate) => candidate.key === key);
  if (matches.length !== 1)
    throw new GuidanceDiscoveryError("invalid-selection");
  return matches[0];
}

// src/skills/session-fork-to-destination/src/git-target.ts
import { execFile as nodeExecFile } from "node:child_process";
import { createHash } from "node:crypto";
import { realpath as nodeRealpath } from "node:fs/promises";
import { promisify as promisify2 } from "node:util";
var execFileAsync2 = promisify2(nodeExecFile);
var DEFAULT_TIMEOUT_MS = 5e3;
var DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024;
var GitTargetError = class extends Error {
  code;
  role;
  constructor(code, role) {
    super(code);
    this.name = "GitTargetError";
    this.code = code;
    this.role = role;
  }
};
var DEFAULT_DEPENDENCIES2 = {
  realpath: nodeRealpath,
  execFile: async (executable, argv, options) => {
    const result = await execFileAsync2(executable, [...argv], options);
    return { stdout: result.stdout, stderr: result.stderr };
  }
};
function errorProperty(error, key) {
  if (error === null || typeof error !== "object") return void 0;
  return error[key];
}
function mapGitError(error, operation) {
  const code = errorProperty(error, "code");
  if (code === "ETIMEDOUT" || errorProperty(error, "killed") === true || errorProperty(error, "signal") === "SIGTERM") {
    throw new GitTargetError("git-timeout");
  }
  if (code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
    throw new GitTargetError(
      operation === "status" ? "status-oversized" : "git-output-oversized"
    );
  }
  throw new GitTargetError("not-worktree");
}
function resolveOptions(options) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("timeoutMs must be a positive safe integer");
  }
  if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes <= 0) {
    throw new TypeError("maxOutputBytes must be a positive safe integer");
  }
  return {
    timeoutMs,
    maxOutputBytes,
    deps: options.deps ?? DEFAULT_DEPENDENCIES2
  };
}
async function git(cwd, argv, options, operation = "other") {
  try {
    const result = await options.deps.execFile("git", ["-C", cwd, ...argv], {
      timeout: options.timeoutMs,
      maxBuffer: options.maxOutputBytes,
      encoding: "utf8",
      shell: false,
      windowsHide: true
    });
    return result.stdout;
  } catch (error) {
    mapGitError(error, operation);
  }
}
async function canonicalize(path, deps, failure) {
  try {
    return await deps.realpath(path);
  } catch {
    throw new GitTargetError(failure);
  }
}
function oneLine(output) {
  const value = output.trim();
  if (value.length === 0 || value.includes("\n") || value.includes("\0")) {
    throw new GitTargetError("not-worktree");
  }
  return value;
}
function pathOutputValue(output) {
  if (!output.endsWith("\n") || output.includes("\0")) {
    throw new GitTargetError("not-worktree");
  }
  const value = output.slice(0, -1);
  if (value.length === 0) throw new GitTargetError("not-worktree");
  return value;
}
function registeredWorktreePaths(output) {
  return output.split("\0").filter((field) => field.startsWith("worktree ")).map((field) => field.slice("worktree ".length));
}
async function inspectWorktree(requestedPath, targetOptions = {}) {
  const options = resolveOptions(targetOptions);
  const canonicalPath2 = await canonicalize(
    requestedPath,
    options.deps,
    "path-missing"
  );
  const rawWorktreeRoot = pathOutputValue(
    await git(canonicalPath2, ["rev-parse", "--show-toplevel"], options)
  );
  const worktreeRoot = await canonicalize(
    rawWorktreeRoot,
    options.deps,
    "not-worktree"
  );
  if (canonicalPath2 !== worktreeRoot) {
    throw new GitTargetError("not-registered-worktree");
  }
  const rawCommonGitDir = pathOutputValue(
    await git(
      canonicalPath2,
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      options
    )
  );
  const commonGitDir = await canonicalize(
    rawCommonGitDir,
    options.deps,
    "not-worktree"
  );
  const worktreeList = await git(
    canonicalPath2,
    ["worktree", "list", "--porcelain", "-z"],
    options
  );
  let matchingRegistrations = 0;
  for (const registeredPath of registeredWorktreePaths(worktreeList)) {
    let registeredRoot;
    try {
      registeredRoot = await options.deps.realpath(registeredPath);
    } catch {
      continue;
    }
    if (registeredRoot === worktreeRoot) matchingRegistrations += 1;
  }
  if (matchingRegistrations !== 1) {
    throw new GitTargetError("not-registered-worktree");
  }
  const head = oneLine(
    await git(canonicalPath2, ["rev-parse", "HEAD"], options)
  );
  if (!/^[0-9a-f]{40,64}$/u.test(head)) {
    throw new GitTargetError("not-worktree");
  }
  const branchOutput = oneLine(
    await git(canonicalPath2, ["rev-parse", "--abbrev-ref", "HEAD"], options)
  );
  const status = await git(
    canonicalPath2,
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    options,
    "status"
  );
  return {
    requestedPath,
    canonicalPath: canonicalPath2,
    worktreeRoot,
    commonGitDir,
    branch: branchOutput === "HEAD" ? null : branchOutput,
    head,
    dirty: status.length > 0,
    statusFingerprint: createHash("sha256").update(status).digest("hex")
  };
}
async function validateHandoffTarget(sourcePath, targetPath, options = {}) {
  let source;
  let target;
  try {
    source = await inspectWorktree(sourcePath, options);
  } catch (error) {
    if (error instanceof GitTargetError) {
      throw new GitTargetError(error.code, "source");
    }
    throw error;
  }
  try {
    target = await inspectWorktree(targetPath, options);
  } catch (error) {
    if (error instanceof GitTargetError) {
      throw new GitTargetError(error.code, "target");
    }
    throw error;
  }
  if (source.worktreeRoot === target.worktreeRoot) {
    throw new GitTargetError("same-worktree", "target");
  }
  if (source.commonGitDir !== target.commonGitDir) {
    throw new GitTargetError("repository-mismatch", "target");
  }
  if (source.dirty) throw new GitTargetError("source-dirty", "source");
  return { source, target };
}
var validateGuidanceTarget = validateHandoffTarget;

// src/skills/session-fork-to-destination/src/guidance-capabilities.ts
var RETRIEVED_ON = "2026-09-12";
var GUIDANCE_CAPABILITIES = Object.freeze([
  {
    provider: "claude",
    surface: "cli",
    origin: "cli-transcript",
    interactiveLaunch: {
      status: "documented",
      kind: "terminal",
      argv: ["claude"],
      preservesOriginal: true,
      semantics: "Starts an interactive Claude Code session."
    },
    resume: {
      status: "documented",
      kind: "terminal",
      argv: ["claude", "--resume", "{sessionId}"],
      preservesOriginal: false,
      semantics: "Continues the selected session under its existing identity."
    },
    fork: {
      status: "documented",
      kind: "terminal",
      argv: ["claude", "--resume", "{sessionId}", "--fork-session"],
      preservesOriginal: true,
      semantics: "Resumes the selected history under a new session ID."
    },
    inProviderFork: {
      status: "unsupported",
      reason: "The cited Claude Code reference documents the CLI flag but no slash command that forks an arbitrary selected session."
    },
    destinationSwitch: {
      status: "unsupported",
      reason: "The cited Claude Code reference does not document replacing an already-open session with an arbitrary new fork."
    },
    crossWorktree: "unverified",
    evidence: [
      {
        url: "https://code.claude.com/docs/en/cli-usage",
        retrievedOn: RETRIEVED_ON,
        context: "Public CLI reference retrieved without executing Claude Code; documents interactive launch, --resume, and --fork-session."
      }
    ],
    limitations: [
      "The public reference documents syntax but does not prove behavior in this repository or an ADE tab.",
      "Cross-worktree fork behavior has no live proof in this project."
    ]
  },
  {
    provider: "codex",
    surface: "cli",
    origin: "cli-transcript",
    interactiveLaunch: {
      status: "documented",
      kind: "terminal",
      argv: ["codex"],
      preservesOriginal: true,
      semantics: "Starts an interactive Codex session."
    },
    resume: {
      status: "documented",
      kind: "terminal",
      argv: ["codex", "resume", "{sessionId}"],
      preservesOriginal: false,
      semantics: "Continues the selected session."
    },
    fork: {
      status: "documented",
      kind: "terminal",
      argv: ["codex", "fork", "{sessionId}"],
      preservesOriginal: true,
      semantics: "Forks the selected interactive session and opens the new branch."
    },
    inProviderFork: {
      status: "documented",
      kind: "slash-command",
      command: "/fork",
      preservesOriginal: true,
      semantics: "Branches the currently open chat into a new thread."
    },
    destinationSwitch: {
      status: "unsupported",
      reason: "The cited Codex source documents current-chat /fork, not replacing a fresh destination chat with a fork of another selected session."
    },
    crossWorktree: "unverified",
    evidence: [
      {
        url: "https://github.com/openai/codex/blob/main/codex-rs/cli/src/main.rs",
        retrievedOn: RETRIEVED_ON,
        context: "Official public source retrieved without executing Codex; ForkCommand accepts an explicit session UUID and launches the interactive TUI."
      },
      {
        url: "https://github.com/openai/codex/blob/main/codex-rs/tui/tooltips.txt",
        retrievedOn: RETRIEVED_ON,
        context: "Official public source describes /fork as branching the current chat into a new thread."
      }
    ],
    limitations: [
      "The cited main-branch source is dated evidence rather than a promise for every installed version.",
      "Cross-worktree and ADE visibility behavior has no live proof in this project."
    ]
  },
  {
    provider: "cursor",
    surface: "cli",
    origin: "cli-transcript",
    interactiveLaunch: {
      status: "documented",
      kind: "terminal",
      argv: ["cursor-agent"],
      preservesOriginal: true,
      semantics: "Starts an interactive Cursor CLI session."
    },
    resume: {
      status: "documented",
      kind: "terminal",
      argv: ["cursor-agent", "--resume={sessionId}"],
      preservesOriginal: false,
      semantics: "Continues a specific Cursor CLI chat."
    },
    fork: {
      status: "unsupported",
      reason: "The official Cursor CLI overview documents resume but no documented Cursor CLI fork command."
    },
    inProviderFork: {
      status: "unsupported",
      reason: "No official Cursor CLI source cited by this matrix documents an interactive fork command."
    },
    destinationSwitch: {
      status: "unsupported",
      reason: "No official Cursor CLI source cited by this matrix documents switching a fresh session to an arbitrary fork."
    },
    crossWorktree: "unsupported",
    evidence: [
      {
        url: "https://docs.cursor.com/en/cli/overview",
        retrievedOn: RETRIEVED_ON,
        context: "Public Cursor CLI overview retrieved without executing Cursor; documents interactive launch and explicit resume only."
      }
    ],
    limitations: [
      "CLI resume is not fork semantics and must never be substituted for a fork.",
      "IDE transcript discovery does not establish Cursor CLI interoperability."
    ]
  },
  {
    provider: "cursor",
    surface: "ide",
    origin: "ide-transcript",
    interactiveLaunch: {
      status: "documented-manual",
      kind: "manual",
      steps: ["Open Cursor Agent in the IDE side pane."],
      preservesOriginal: true,
      semantics: "Opens the Cursor IDE Agent surface."
    },
    resume: {
      status: "documented-manual",
      kind: "manual",
      steps: ["Open chat history.", "Select the conversation to review."],
      preservesOriginal: false,
      semantics: "Opens an existing chat from Cursor IDE history."
    },
    fork: {
      status: "documented-manual",
      kind: "manual",
      steps: [
        "Open the source chat.",
        "Open the message menu at the desired branch point.",
        "Select Duplicate Chat."
      ],
      preservesOriginal: true,
      semantics: "Duplicates context through the selected point into a separate chat."
    },
    inProviderFork: {
      status: "documented-manual",
      kind: "manual",
      steps: ["Use Duplicate Chat from the source message menu."],
      preservesOriginal: true,
      semantics: "Creates a separate IDE chat from the current chat history."
    },
    destinationSwitch: {
      status: "unsupported",
      reason: "Cursor documentation does not establish cross-worktree switching or destination-tab placement for a duplicated chat."
    },
    crossWorktree: "unsupported",
    evidence: [
      {
        url: "https://docs.cursor.com/en/agent/chat/duplicate",
        retrievedOn: RETRIEVED_ON,
        context: "Public Cursor IDE documentation retrieved without executing Cursor; describes Duplicate Chat and preservation of the original."
      },
      {
        url: "https://docs.cursor.com/en/agent/chat/history",
        retrievedOn: RETRIEVED_ON,
        context: "Public Cursor IDE documentation describes opening locally stored chat history."
      }
    ],
    limitations: [
      "Cursor IDE duplication is a manual UI flow with no documented destination-worktree guarantee.",
      "IDE-origin identity must not be treated as a Cursor CLI session ID."
    ]
  }
]);
function getGuidanceCapability(provider2, surface) {
  const capability = GUIDANCE_CAPABILITIES.find(
    (candidate) => candidate.provider === provider2 && candidate.surface === surface
  );
  if (capability === void 0) throw new Error("unsupported-guidance-surface");
  return capability;
}

// src/skills/session-fork-to-destination/src/guidance.ts
var GuidancePreparationError = class extends Error {
  constructor(code) {
    super(code);
    this.code = code;
    this.name = "GuidancePreparationError";
  }
  code;
};
var DEFAULT_DEPENDENCIES3 = {
  validateTarget: validateGuidanceTarget
};
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
function quoteShellWord(value) {
  if (value.length === 0) return "''";
  if (value.includes("\0") || value.includes("\n") || value.includes("\r")) {
    throw new GuidancePreparationError("invalid-path");
  }
  if (/^[A-Za-z0-9_./:=+@%-]+$/u.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}
function validateCandidate(candidate) {
  if (candidate.provider !== "cursor" && !UUID.test(candidate.nativeId)) {
    throw new GuidancePreparationError("invalid-session-id");
  }
  if (candidate.key !== `${candidate.provider}:${candidate.surface}:${candidate.nativeId}`) {
    throw new GuidancePreparationError("invalid-source-candidate");
  }
}
function destinationCommand(operation, destination, nativeId) {
  const argv = operation.argv.map(
    (argument) => quoteShellWord(argument.replace("{sessionId}", nativeId))
  );
  const expected = quoteShellWord(destination);
  return `if test "$(pwd -P)" = ${expected}; then exec ${argv.join(" ")}; else printf '%s\\n' 'Refusing: open the canonical destination worktree first.' >&2; fi`;
}
async function prepareForkGuidance(input, deps = DEFAULT_DEPENDENCIES3) {
  validateCandidate(input.candidate);
  const evidence = await deps.validateTarget(
    input.sourcePath,
    input.destinationPath
  );
  if (input.candidate.recordedCwd !== evidence.source.canonicalPath) {
    throw new GuidancePreparationError("invalid-source-candidate");
  }
  if (input.candidate.surface === "ambiguous") {
    return {
      status: "experimental-not-released",
      source: evidence.source.canonicalPath,
      destination: evidence.target.canonicalPath,
      destinationDirty: evidence.target.dirty,
      selectedSource: input.candidate.key,
      provider: input.candidate.provider,
      surface: input.candidate.surface,
      entryPoint: input.entryPoint,
      instructions: [
        {
          kind: "manual",
          action: "unsupported",
          explanation: "Cursor transcript origin is ambiguous between IDE and CLI, so no fork or resume command is safe to suggest. Select corroborated source evidence or use Cursor documented UI manually without assuming destination placement."
        }
      ],
      expectedEffect: "No fork is created by this guidance.",
      evidenceStatus: "unsupported",
      limitations: [
        "Cursor IDE/CLI identity interoperability is not established.",
        "Cross-worktree destination placement is unsupported."
      ]
    };
  }
  const capability = getGuidanceCapability(
    input.candidate.provider,
    input.candidate.surface
  );
  if (capability.fork.status !== "documented" || capability.fork.kind !== "terminal") {
    return {
      status: "experimental-not-released",
      source: evidence.source.canonicalPath,
      destination: evidence.target.canonicalPath,
      destinationDirty: evidence.target.dirty,
      selectedSource: input.candidate.key,
      provider: input.candidate.provider,
      surface: input.candidate.surface,
      entryPoint: input.entryPoint,
      instructions: [
        {
          kind: "manual",
          action: "unsupported",
          explanation: "No documented destination-safe terminal fork is available for this provider surface."
        }
      ],
      expectedEffect: "No fork is created by this guidance.",
      evidenceStatus: "unsupported",
      limitations: [...capability.limitations]
    };
  }
  const terminal = {
    kind: "terminal",
    runIn: evidence.target.canonicalPath,
    command: destinationCommand(
      capability.fork,
      evidence.target.canonicalPath,
      input.candidate.nativeId
    )
  };
  const instructions = input.entryPoint === "destination-fresh" && capability.destinationSwitch.status !== "documented" ? [
    {
      kind: "manual",
      action: "exit-current-session",
      explanation: "Exit the fresh provider session, remain in this destination tab, then run the terminal command below."
    },
    terminal
  ] : [terminal];
  return {
    status: "experimental-not-released",
    source: evidence.source.canonicalPath,
    destination: evidence.target.canonicalPath,
    destinationDirty: evidence.target.dirty,
    selectedSource: input.candidate.key,
    provider: input.candidate.provider,
    surface: input.candidate.surface,
    entryPoint: input.entryPoint,
    instructions,
    expectedEffect: "Running the terminal command from the canonical destination should create and open a new fork while preserving the selected original session.",
    evidenceStatus: "documented-not-live-verified",
    limitations: [
      ...capability.limitations,
      "Preparing these instructions did not run a provider or create a fork.",
      "Destination dirty state is reported; Git changes are not transferred."
    ]
  };
}

// src/skills/session-export-transcript/src/sanitize.ts
function lead(text) {
  return typeof text === "string" ? text.trimStart() : "";
}
var HIDDEN_PAYLOAD_MATCHERS = [
  {
    // Role-tagged system/developer records are never emitted.
    id: "system-or-developer-role",
    test: (_text, role) => role === "system" || role === "developer"
  },
  {
    // Text-form system/developer instruction records.
    id: "system-or-developer-text",
    test: (text) => {
      const l = lead(text);
      if (/^(System|Developer)\b\s*[:-]/.test(l)) return true;
      return /^(System|Developer)\s+(prompt|note|notes|message|instruction|instructions|directive|directives|guidelines?)\b\s*[:-]/i.test(
        l
      );
    }
  },
  {
    id: "environment-context",
    test: (text) => lead(text).startsWith("<environment_context>")
  },
  {
    id: "subagent-notification",
    test: (text) => lead(text).startsWith("<subagent_notification>")
  },
  {
    id: "turn-aborted",
    test: (text) => lead(text).startsWith("<turn_aborted>")
  },
  {
    // XML-style skill wrappers injected as ordinary text.
    id: "skill-wrapper",
    test: (text) => /^<skill(\s[^>]*)?>/.test(lead(text))
  },
  {
    // Claude Code's primary injected-context wrapper.
    id: "system-reminder",
    test: (text) => lead(text).startsWith("<system-reminder>")
  },
  {
    id: "task-notification",
    test: (text) => lead(text).startsWith("<task-notification>")
  },
  {
    id: "local-command-output",
    test: (text) => /^<local-command-(stdout|stderr|caveat)>/.test(lead(text))
  },
  {
    id: "command-message",
    test: (text) => /^<(command-message|command-name|command-args)>/.test(lead(text))
  },
  {
    id: "agents-or-skill-md-heading",
    test: (text) => /^#{1,6}\s+(AGENTS|SKILL)(\.md)?\b/i.test(lead(text))
  },
  {
    id: "skill-frontmatter",
    test: (text) => {
      const l = lead(text);
      if (!l.startsWith("---")) return false;
      const firstKey = l.split(/\r?\n/, 2)[1] ?? "";
      return /^(name|description|license|compatibility|allowed-tools|argument-hint):/.test(
        firstKey.trim()
      );
    }
  }
];
function sanitizeEntries(entries, { runtime } = {}) {
  if (!Array.isArray(entries)) return [];
  return entries.filter((entry) => {
    if (entry?.origin === "automatic-control" || entry?.displayRole === "automatic-control" || entry?.origin === "runtime-notification" || entry?.displayRole === "runtime-notification") {
      return false;
    }
    const text = entry?.text ?? "";
    const role = entry?.role ?? "";
    for (const matcher of HIDDEN_PAYLOAD_MATCHERS) {
      if (matcher.test(text, role, runtime)) return false;
    }
    return true;
  });
}

// src/skills/session-fork-to-destination/src/discovery.ts
import { realpath as realpath3 } from "node:fs/promises";

// src/skills/session-fork-to-destination/src/types.ts
var EXACT_PROVIDER_NATIVE_ID_PATTERNS = Object.freeze({
  codex: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
  claude: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
});
var DEFAULT_PREVIEW_BATCH_LIMITS = Object.freeze({
  maxCandidates: 20,
  maxAggregateInputBytes: 33554432,
  maxAggregateInputRecords: 1e5,
  deadlineMs: 1e4,
  maxAggregateRenderedCharacters: 131072
});
var DEFAULT_SESSION_PREVIEW_LIMITS = Object.freeze({
  maxRounds: 3,
  maxCharacters: 4e3
});
var MAX_SESSION_PREVIEW_LIMITS = Object.freeze({
  maxRounds: 20,
  maxCharacters: 32 * 1024
});

// src/skills/session-fork-to-destination/src/discovery.ts
var HANDOFF_DISCOVERY_OPTIONS = Object.freeze({
  persistence: "forbid",
  recency: "exact-all",
  budget: Object.freeze({
    maxEntries: 5e4,
    maxAggregateBytes: 512 * 1024 * 1024,
    maxMetadataBytesPerEntry: 256 * 1024,
    deadlineMs: 3e4
  })
});

// src/skills/session-fork-to-destination/src/preview.ts
var PER_TRANSCRIPT_MAX_BYTES = 2 * 1024 * 1024;
var DEFAULT_DEPENDENCIES4 = {
  now: Date.now,
  readTailRecordsBounded,
  normalizeEntries
};
function sanitizePreviewConversationEntries(runtime, entries) {
  const structurallySafe = entries.filter(
    (entry) => entry.kind === "message" && (entry.role === "user" || entry.role === "assistant") && entry.origin !== "automatic-control" && entry.displayRole !== "automatic-control" && entry.origin !== "runtime-notification" && entry.displayRole !== "runtime-notification"
  );
  return sanitizeEntries(structurallySafe, { runtime }).map((entry) => ({ role: entry.role, text: entry.text.trim() })).filter((entry) => entry.text.length > 0);
}

// src/skills/session-fork-to-destination/src/guidance-cli.ts
var HELP = `session-fork-to-destination \u2014 EXPERIMENTAL / NOT RELEASED

Read-only discovery and destination-tab fork guidance. Preparing guidance does not
run a provider, create a fork, authenticate, or modify provider session stores.

Usage:
  session-fork-to-destination discover --source PATH [--provider claude|codex|cursor|all] [--json]
  session-fork-to-destination preview --source PATH --session PROVIDER:SURFACE:ID [--json]
  session-fork-to-destination prepare --source PATH --target PATH --session PROVIDER:SURFACE:ID \\
    --entry-point source-current|source-other|destination-fresh [--json]
`;
var GuidanceCliArgumentError = class extends Error {
  code = "invalid-arguments";
};
var VALUE_FLAGS = /* @__PURE__ */ new Set([
  "--source",
  "--target",
  "--session",
  "--provider",
  "--entry-point"
]);
function parse(argv) {
  const command = argv[0];
  if (!["discover", "preview", "prepare"].includes(command)) {
    throw new GuidanceCliArgumentError();
  }
  const values = /* @__PURE__ */ new Map();
  let json = false;
  for (let index = 1; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--json") {
      if (json) throw new GuidanceCliArgumentError();
      json = true;
      continue;
    }
    if (!VALUE_FLAGS.has(flag) || values.has(flag)) {
      throw new GuidanceCliArgumentError();
    }
    const flagValue = argv[index + 1];
    if (flagValue === void 0 || flagValue.startsWith("--") || flagValue.length === 0) {
      throw new GuidanceCliArgumentError();
    }
    values.set(flag, flagValue);
    index += 1;
  }
  return { command, values, json };
}
function required(flags, name) {
  const result = flags.values.get(name);
  if (result === void 0) throw new GuidanceCliArgumentError();
  return result;
}
function allowOnly(flags, allowed) {
  if ([...flags.values.keys()].some((key) => !allowed.includes(key))) {
    throw new GuidanceCliArgumentError();
  }
}
function provider(flags) {
  const result = flags.values.get("--provider") ?? "all";
  if (!["claude", "codex", "cursor", "all"].includes(result)) {
    throw new GuidanceCliArgumentError();
  }
  return result;
}
function session(flags) {
  const result = required(flags, "--session");
  if (!/^(?:claude|codex|cursor):(?:cli|ide|ambiguous):[^:\s]+$/u.test(result) || [...result].some((character) => character.codePointAt(0) < 32)) {
    throw new GuidanceCliArgumentError();
  }
  return result;
}
function entryPoint(flags) {
  const result = required(flags, "--entry-point");
  if (!["source-current", "source-other", "destination-fresh"].includes(result)) {
    throw new GuidanceCliArgumentError();
  }
  return result;
}
function errorCode(error) {
  if (error instanceof GuidanceCliArgumentError) return error.code;
  if (error !== null && typeof error === "object") {
    const code = error.code;
    if (typeof code === "string" && /^[a-z][a-z0-9-]*$/u.test(code))
      return code;
  }
  return "unexpected-failure";
}
function errorProvenance(error) {
  return error instanceof GuidanceDiscoveryError && error.provider !== void 0 && error.reason !== void 0 ? { provider: error.provider, reason: error.reason } : {};
}
function render(io, command, data, json) {
  const envelope = {
    ok: true,
    command,
    status: "experimental-not-released",
    currentSelection: "explicit-required",
    noForkCreated: true,
    data
  };
  io.stdout(`${JSON.stringify(envelope, null, json ? 0 : 2)}
`);
}
async function runGuidanceCli(argv, dependencies = DEFAULT_DEPENDENCIES5, io = {
  stdout: (value) => process.stdout.write(value),
  stderr: (value) => process.stderr.write(value)
}) {
  if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) {
    io.stdout(HELP);
    return 0;
  }
  let flags;
  try {
    flags = parse(argv);
    let data;
    if (flags.command === "discover") {
      allowOnly(flags, ["--source", "--provider"]);
      data = await dependencies.discover(
        required(flags, "--source"),
        provider(flags)
      );
    } else if (flags.command === "preview") {
      allowOnly(flags, ["--source", "--session"]);
      data = await dependencies.preview(
        required(flags, "--source"),
        session(flags)
      );
    } else {
      allowOnly(flags, ["--source", "--target", "--session", "--entry-point"]);
      data = await dependencies.prepare(
        required(flags, "--source"),
        required(flags, "--target"),
        session(flags),
        entryPoint(flags)
      );
    }
    render(io, flags.command, data, flags.json);
    return 0;
  } catch (error) {
    const code = errorCode(error);
    const failure = {
      ok: false,
      ...flags ? { command: flags.command } : {},
      error: {
        code,
        ...errorProvenance(error),
        message: "The read-only guidance request could not be completed safely."
      }
    };
    if (flags?.json ?? argv.includes("--json"))
      io.stdout(`${JSON.stringify(failure)}
`);
    else io.stderr(`error: ${code}
`);
    return code === "unexpected-failure" ? 4 : 2;
  }
}
function runtimeFor(candidate) {
  if (candidate.provider === "claude") return "claude-code";
  return candidate.provider;
}
function providerForKey(key) {
  return key.slice(0, key.indexOf(":"));
}
async function rawMatch(source, selected) {
  const runtime = runtimeFor(selected);
  let raw;
  try {
    raw = await discover(
      runtime,
      source,
      new ClassificationCache(),
      runtime === "cursor" ? GUIDANCE_DISCOVERY_OPTIONS : {
        ...GUIDANCE_DISCOVERY_OPTIONS,
        unattributablePolicy: "summarize"
      }
    );
  } catch {
    throw Object.assign(new Error("preview-incomplete"), {
      code: "preview-incomplete"
    });
  }
  const matches = [];
  for (const candidate of raw) {
    if (candidate.recordedCwd === null) continue;
    const recorded = await realpath4(candidate.recordedCwd).catch(() => null);
    if (recorded !== selected.recordedCwd) continue;
    const nativeId = selected.provider === "codex" ? await readGuidanceCodexNativeId(candidate) : candidate.sessionId;
    if (nativeId === selected.nativeId) matches.push(candidate);
  }
  if (matches.length !== 1) {
    throw Object.assign(new Error("preview-incomplete"), {
      code: "preview-incomplete"
    });
  }
  return matches[0];
}
async function defaultPreview(source, key) {
  const candidates = await discoverGuidanceCandidates(source, {
    providers: [providerForKey(key)]
  });
  const selected = selectGuidanceCandidate(candidates, key);
  const raw = await rawMatch(selected.recordedCwd, selected);
  const diagnostics = [];
  const bounded = await readTailRecordsBounded(raw.transcriptPath, {
    maxBytes: 2 * 1024 * 1024,
    maxRecords: 1e4,
    maxInspectedRecords: 1e4,
    deadlineMs: 1e4,
    diagnostic: ({ code }) => diagnostics.push(code)
  });
  if (diagnostics.length > 0 || bounded.recordLimitExceeded === true) {
    throw Object.assign(new Error("preview-incomplete"), {
      code: "preview-incomplete"
    });
  }
  const entries = sanitizePreviewConversationEntries(
    runtimeFor(selected),
    normalizeEntries(runtimeFor(selected), bounded.records, {
      includeToolCalls: false,
      includeToolResults: false,
      includeCommandMessages: false
    })
  );
  const retained = entries.slice(-8);
  let remaining = 4e3;
  let entryTextTrimmed = false;
  const limited = retained.toReversed().flatMap((entry) => {
    if (remaining === 0) return [];
    const text = entry.text.slice(-remaining);
    if (text.length < entry.text.length) entryTextTrimmed = true;
    remaining -= text.length;
    return [{ ...entry, text }];
  }).toReversed();
  return {
    key,
    entries: limited,
    truncated: bounded.truncated || limited.length < entries.length || entryTextTrimmed,
    warning: "hidden-payload-sanitized-not-secret-free"
  };
}
var DEFAULT_DEPENDENCIES5 = {
  discover: async (source, selectedProvider) => discoverGuidance(source, {
    providers: selectedProvider === "all" ? void 0 : [selectedProvider]
  }),
  preview: defaultPreview,
  prepare: async (source, target, key, selectedEntryPoint) => {
    const candidates = await discoverGuidanceCandidates(source, {
      providers: [providerForKey(key)]
    });
    const candidate = selectGuidanceCandidate(candidates, key);
    return prepareForkGuidance({
      sourcePath: source,
      destinationPath: target,
      entryPoint: selectedEntryPoint,
      candidate
    });
  }
};

// src/skills/session-fork-to-destination/src/session-fork-to-destination.ts
process.exitCode = await runGuidanceCli(process.argv.slice(2));
