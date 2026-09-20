#!/usr/bin/env node
// GENERATED skill payload for session-export-transcript.

// src/skills/session-export-transcript/src/session-export-transcript.ts
import { execFile } from "node:child_process";
import {
  readdir,
  stat,
  mkdir,
  writeFile,
  readFile as readFile2,
  realpath
} from "node:fs/promises";
import { homedir as homedir2 } from "node:os";
import { dirname as dirname2, join as join2, basename as basename2 } from "node:path";
import { parseArgs } from "node:util";
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
async function readRecordsDetailedInternal(transcriptPath) {
  const rawBytes = await readFile(transcriptPath);
  const capturedAt = (/* @__PURE__ */ new Date()).toISOString();
  const sourceBytes = rawBytes.byteLength;
  const raw = rawBytes.toString("utf8");
  if (!raw) {
    return {
      records: [],
      diagnostics: [],
      legacyWarnings: [],
      capturedAt,
      sourceBytes
    };
  }
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
        sourceCarrier: carrier,
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
  return { records, diagnostics, legacyWarnings, capturedAt, sourceBytes };
}
async function readRecordsDetailed(transcriptPath) {
  const { records, diagnostics, capturedAt, sourceBytes } = await readRecordsDetailedInternal(transcriptPath);
  return { records, diagnostics, capturedAt, sourceBytes };
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

// src/shared/transcript/activity/classify.ts
var CATEGORY_BY_NATIVE_NAME = /* @__PURE__ */ new Map([
  ["Bash", "shell"],
  ["Shell", "shell"],
  ["exec_command", "shell"],
  ["shell_command", "shell"],
  ["write_stdin", "shell"],
  ["Read", "read"],
  ["read_file", "read"],
  ["Write", "write"],
  ["write_file", "write"],
  ["Edit", "edit"],
  ["MultiEdit", "edit"],
  ["ApplyPatch", "edit"],
  ["apply_patch", "edit"],
  ["Grep", "grep"],
  ["grep", "grep"],
  ["Glob", "glob"],
  ["glob", "glob"],
  ["WebSearch", "search"],
  ["search_query", "search"],
  ["web_search", "search"],
  ["WebFetch", "fetch"],
  ["fetch", "fetch"],
  ["web_fetch", "fetch"],
  ["Agent", "task"],
  ["Subagent", "task"],
  ["Task", "task"],
  ["close_agent", "task"],
  ["followup_task", "task"],
  ["interrupt_agent", "task"],
  ["list_agents", "task"],
  ["multi_agent_v1__spawn_agent", "task"],
  ["send_message", "task"],
  ["send_input", "task"],
  ["spawn_agent", "task"],
  ["wait", "task"],
  ["wait_agent", "task"],
  ["AskQuestion", "ask"],
  ["AskUserQuestion", "ask"],
  ["request_user_input", "ask"],
  ["request_user_input_async", "ask"]
]);
var CATEGORY_BY_ITEM_TYPE = /* @__PURE__ */ new Map([
  ["CollabAgentToolCall", "task"],
  ["CommandExecution", "shell"],
  ["FileChange", "edit"],
  ["McpToolCall", "mcp"],
  ["SubAgentActivity", "task"],
  ["WebSearch", "search"]
]);
function classifyNativeName(nativeName) {
  if (nativeName === void 0) return "other";
  const exact = CATEGORY_BY_NATIVE_NAME.get(nativeName);
  if (exact !== void 0) return exact;
  return /^mcp__.+__.+$/.test(nativeName) ? "mcp" : "other";
}
function classifyStandaloneItem(event) {
  if (event.kind !== "item") return void 0;
  return CATEGORY_BY_ITEM_TYPE.get(event.nativeType) ?? "other";
}

// src/shared/transcript/activity/correlate.ts
function metadataObject(event) {
  return event.metadata;
}
function headerOwnershipEvidence(event) {
  const metadata = metadataObject(event);
  const directParentThreadId = metadata?.directParentThreadId;
  const nestedParentThreadId = metadata?.nestedParentThreadId;
  const directParent = typeof directParentThreadId === "string" ? directParentThreadId : void 0;
  const nestedParent = typeof nestedParentThreadId === "string" ? nestedParentThreadId : void 0;
  if (metadata?.directParentMarkerPresent === true && directParent === void 0 || metadata?.nestedParentMarkerPresent === true && nestedParent === void 0) {
    return { kind: "unknown" };
  }
  if (directParent !== void 0 && nestedParent !== void 0 && directParent !== nestedParent) {
    return { kind: "unknown" };
  }
  const parentThreadId = directParent ?? nestedParent;
  const lineageMarkerPresent = metadata?.directParentMarkerPresent === true || metadata?.nestedParentMarkerPresent === true || metadata?.subagentMarkerPresent === true || metadata?.subagentHistoryStartOrdinalPresent === true;
  if (parentThreadId === void 0) {
    return lineageMarkerPresent ? { kind: "unknown" } : { kind: "root" };
  }
  const boundary = metadata?.subagentHistoryStartOrdinal;
  if (typeof boundary !== "number" || !Number.isSafeInteger(boundary) || boundary < 0) {
    return { kind: "unknown" };
  }
  return { kind: "bounded-child", boundary, parentThreadId };
}
function ownershipContext(activity) {
  if (activity.source.runtime !== "codex") return { kind: "root" };
  const headers = activity.events.filter((event) => {
    if (event.kind !== "metadata" || event.nativeType !== "session_meta") {
      return false;
    }
    return metadataObject(event)?.nativeSessionId === activity.source.nativeSessionId;
  });
  if (headers.length === 0) return { kind: "unknown" };
  const evidence = headers.map(headerOwnershipEvidence);
  if (evidence.every((entry) => entry.kind === "root")) return { kind: "root" };
  if (evidence.some((entry) => entry.kind !== "bounded-child")) {
    return { kind: "unknown" };
  }
  const parentThreadIds = new Set(
    evidence.map((entry) => entry.parentThreadId)
  );
  const boundaries = new Set(evidence.map((entry) => entry.boundary));
  if (parentThreadIds.size !== 1 || boundaries.size !== 1) {
    return { kind: "unknown" };
  }
  return {
    kind: "bounded-child",
    boundary: evidence[0].boundary
  };
}
function ownershipFor(event, context) {
  if (context.kind === "root") return "owned";
  if (context.kind === "unknown" || typeof event.locator.ordinal !== "number" || !Number.isSafeInteger(event.locator.ordinal)) {
    return "unknown";
  }
  return event.locator.ordinal < context.boundary ? "inherited" : "owned";
}
function callsBy(calls, field) {
  const lookup = /* @__PURE__ */ new Map();
  for (const call of calls) {
    const value = call[field];
    if (!value) continue;
    const matches = lookup.get(value) ?? [];
    matches.push(call);
    lookup.set(value, matches);
  }
  return lookup;
}
function uniqueCall(lookup, nativeId) {
  if (!nativeId) return void 0;
  const matches = lookup.get(nativeId);
  return matches?.length === 1 ? matches[0] : void 0;
}
function relatedCall(event, byCallId, byNativeId) {
  if (event.kind === "result") {
    return uniqueCall(byCallId, event.nativeCallId);
  }
  if (event.kind !== "item") return void 0;
  const candidates = /* @__PURE__ */ new Map();
  const byCall = uniqueCall(byCallId, event.nativeCallId);
  const byItem = uniqueCall(byNativeId, event.nativeId);
  if (byCall) candidates.set(byCall.eventKey, byCall);
  if (byItem) candidates.set(byItem.eventKey, byItem);
  return candidates.size === 1 ? [...candidates.values()][0] : void 0;
}
function ambiguousDiagnostics(lookup, field) {
  return [...lookup.entries()].flatMap(([nativeId, calls]) => {
    if (calls.length < 2) return [];
    return [
      {
        code: "AMBIGUOUS_NATIVE_CORRELATION",
        locator: calls[0].locator,
        field,
        nativeId
      }
    ];
  });
}
function conflictingItemDiagnostics(events, byCallId, byNativeId) {
  return events.flatMap((event) => {
    if (event.kind !== "item") return [];
    const byCall = uniqueCall(byCallId, event.nativeCallId);
    const byItem = uniqueCall(byNativeId, event.nativeId);
    if (!byCall || !byItem || byCall.eventKey === byItem.eventKey) return [];
    return [
      {
        code: "AMBIGUOUS_NATIVE_CORRELATION",
        locator: event.locator,
        field: "nativeCallId+nativeId"
      }
    ];
  });
}
function categoryFor(event, related) {
  if (event.kind === "call") return classifyNativeName(event.nativeName);
  if (related) return classifyNativeName(related.nativeName);
  if (event.kind === "result") return "other";
  return classifyStandaloneItem(event);
}
function correlationCounts(events) {
  const calls = events.filter((event) => event.kind === "call");
  const results = events.filter((event) => event.kind === "result");
  const items = events.filter((event) => event.kind === "item");
  const countOwnership = (ownership) => calls.filter((event) => event.ownership === ownership).length;
  const owned = countOwnership("owned");
  return {
    responseStreamCalls: {
      captured: calls.length,
      counted: owned,
      owned,
      inherited: countOwnership("inherited"),
      unknown: countOwnership("unknown")
    },
    results: {
      matched: results.filter((event) => event.relatedCallKey !== void 0).length,
      unmatched: results.filter((event) => event.relatedCallKey === void 0).length
    },
    itemEvidence: {
      linked: items.filter((event) => event.relatedCallKey !== void 0).length,
      standalone: items.filter((event) => event.relatedCallKey === void 0).length
    }
  };
}
function correlateActivity(activity) {
  const context = ownershipContext(activity);
  const calls = activity.events.filter((event) => event.kind === "call");
  const byCallId = callsBy(calls, "nativeCallId");
  const byNativeId = callsBy(calls, "nativeId");
  const events = activity.events.map((event) => {
    const related = relatedCall(event, byCallId, byNativeId);
    const category = categoryFor(event, related);
    return {
      ...event,
      ownership: ownershipFor(event, context),
      ...category === void 0 ? {} : { category },
      ...related === void 0 ? {} : { relatedCallKey: related.eventKey }
    };
  });
  return {
    ...activity,
    events,
    correlationCounts: correlationCounts(events),
    diagnostics: [
      ...activity.diagnostics,
      ...ambiguousDiagnostics(byCallId, "nativeCallId"),
      ...ambiguousDiagnostics(byNativeId, "nativeId"),
      ...conflictingItemDiagnostics(activity.events, byCallId, byNativeId)
    ]
  };
}

// src/shared/transcript/activity/types.ts
var ACTIVITY_SCHEMA_VERSION = 1;
function isJsonObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function stringValue(value) {
  return typeof value === "string" ? value : void 0;
}
function numberValue(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function recordLocator(detailed, jsonPointer) {
  const ordinal = numberValue(detailed.record.ordinal);
  return {
    recordIndex: detailed.recordIndex,
    physicalLine: detailed.physicalLine,
    jsonPointer,
    ...ordinal === void 0 ? {} : { ordinal }
  };
}
function eventKey(source, locator) {
  return `${source.runtime}:${source.nativeSessionId}:${locator.recordIndex}:${locator.jsonPointer}`;
}
function outcomeFromStatus(status) {
  if (typeof status !== "string") return "unknown";
  switch (status.toLowerCase()) {
    case "success":
    case "succeeded":
    case "completed":
      return "success";
    case "error":
    case "failed":
      return "error";
    case "aborted":
    case "cancelled":
    case "canceled":
    case "interrupted":
      return "cancelled";
    case "pending":
    case "started":
    case "running":
    case "in_progress":
    case "async_launched":
      return "pending";
    default:
      return "unknown";
  }
}

// src/shared/transcript/activity/claude-code.ts
function claudeResultOutcome(block) {
  if (block.is_error === true) return "error";
  if (block.is_error === false) return "success";
  return "unknown";
}
function topLevelResultOutcome(toolUseResult) {
  if (!isJsonObject(toolUseResult)) return "unknown";
  if (toolUseResult.interrupted === true) return "cancelled";
  return outcomeFromStatus(toolUseResult.status);
}
function externalReference(toolUseResult) {
  if (!isJsonObject(toolUseResult)) return void 0;
  const path = stringValue(toolUseResult.persistedOutputPath);
  const size = numberValue(toolUseResult.persistedOutputSize);
  if (path === void 0 && size === void 0) return void 0;
  return {
    kind: "persisted-output",
    availability: "not-read",
    ...path === void 0 ? {} : { path },
    ...size === void 0 ? {} : { size }
  };
}
function childReference(toolUseResult) {
  if (!isJsonObject(toolUseResult)) return void 0;
  const nativeId = stringValue(toolUseResult.agentId);
  if (!nativeId) return void 0;
  const nickname = stringValue(toolUseResult.description);
  const status = stringValue(toolUseResult.status);
  return {
    nativeId,
    ...nickname === void 0 ? {} : { nickname },
    ...status === void 0 ? {} : { status },
    trajectoryAvailability: "not-read"
  };
}
function topLevelToolUseResultActivity(source, detailed, origin) {
  const { record } = detailed;
  if (!Object.hasOwn(record, "toolUseResult")) {
    return { events: [], coverage: [], diagnostics: [] };
  }
  const toolUseResult = record.toolUseResult;
  const locator = recordLocator(detailed, "/toolUseResult");
  const persisted = externalReference(toolUseResult);
  const child = childReference(toolUseResult);
  const status = isJsonObject(toolUseResult) ? toolUseResult.interrupted === true ? "interrupted" : stringValue(toolUseResult.status) : void 0;
  return {
    events: [
      {
        eventKey: eventKey(source, locator),
        kind: "item",
        nativeType: "toolUseResult",
        locator,
        outcome: topLevelResultOutcome(toolUseResult),
        ...status === void 0 ? {} : { nativeStatus: status },
        ...origin === void 0 ? {} : { origin },
        result: toolUseResult,
        ...persisted === void 0 ? {} : { externalReference: persisted },
        ...child === void 0 ? {} : { childReference: child }
      }
    ],
    coverage: [
      ...persisted ? [
        {
          dataClass: "persisted-output",
          status: "not-read",
          captured: 1,
          locator
        }
      ] : [],
      ...child ? [
        {
          dataClass: "child-trajectory",
          status: "not-read",
          captured: 1,
          locator
        }
      ] : []
    ],
    diagnostics: []
  };
}
function selectedClaudeMetadata(record) {
  const message = isJsonObject(record.message) ? record.message : void 0;
  const model = message ? stringValue(message.model) : void 0;
  const effort = stringValue(record.effort);
  const perTurnEffort = stringValue(record.perTurnEffort);
  const timestamp = stringValue(record.timestamp);
  if (model === void 0 && effort === void 0 && perTurnEffort === void 0 && timestamp === void 0) {
    return void 0;
  }
  return {
    ...model === void 0 ? {} : { model },
    ...effort === void 0 ? {} : { effort },
    ...perTurnEffort === void 0 ? {} : { perTurnEffort },
    ...timestamp === void 0 ? {} : { timestamp }
  };
}
function claudeSystemActivity(source, detailed) {
  const { record } = detailed;
  if (record.type !== "system") return void 0;
  const subtype = stringValue(record.subtype);
  if (subtype === "turn_duration") {
    const locator = recordLocator(detailed, "");
    const durationMs = numberValue(record.durationMs);
    const messageCount = numberValue(record.messageCount);
    const pendingBackgroundAgentCount = numberValue(
      record.pendingBackgroundAgentCount
    );
    return {
      eventKey: eventKey(source, locator),
      kind: "lifecycle",
      nativeType: subtype,
      locator,
      outcome: "unknown",
      metadata: {
        ...durationMs === void 0 ? {} : { durationMs },
        ...messageCount === void 0 ? {} : { messageCount },
        ...pendingBackgroundAgentCount === void 0 ? {} : { pendingBackgroundAgentCount }
      }
    };
  }
  if (subtype === "compact_boundary") {
    const locator = recordLocator(detailed, "");
    const compactMetadata = isJsonObject(record.compactMetadata) ? record.compactMetadata : void 0;
    const trigger = compactMetadata ? stringValue(compactMetadata.trigger) : void 0;
    const durationMs = compactMetadata ? numberValue(compactMetadata.durationMs) : void 0;
    return {
      eventKey: eventKey(source, locator),
      kind: "compaction",
      nativeType: subtype,
      locator,
      outcome: "unknown",
      metadata: {
        ...trigger === void 0 ? {} : { trigger },
        ...durationMs === void 0 ? {} : { durationMs }
      }
    };
  }
  return void 0;
}
function extractClaudeRecord(source, detailed) {
  const { record } = detailed;
  const events = [];
  const coverage2 = [];
  const message = isJsonObject(record.message) ? record.message : void 0;
  const content = message?.content;
  const provenance = claudeUserRecordProvenance(record);
  const systemActivity = claudeSystemActivity(source, detailed);
  if (systemActivity) events.push(systemActivity);
  if (record.type === "assistant") {
    const metadata = selectedClaudeMetadata(record);
    if (metadata) {
      const locator = recordLocator(detailed, "/message");
      events.push({
        eventKey: eventKey(source, locator),
        kind: "metadata",
        nativeType: "assistant-metadata",
        locator,
        outcome: "unknown",
        metadata
      });
    }
  }
  if (Array.isArray(content)) {
    content.forEach((candidate, blockIndex) => {
      if (!isJsonObject(candidate)) return;
      const blockType = stringValue(candidate.type);
      const locator = recordLocator(detailed, `/message/content/${blockIndex}`);
      if (blockType === "tool_use") {
        const nativeCallId = stringValue(candidate.id);
        const nativeName = stringValue(candidate.name);
        events.push({
          eventKey: eventKey(source, locator),
          kind: "call",
          nativeType: blockType,
          locator,
          outcome: "pending",
          ...nativeCallId === void 0 ? {} : { nativeCallId },
          ...nativeName === void 0 ? {} : { nativeName },
          ...Object.hasOwn(candidate, "input") ? { arguments: candidate.input } : {}
        });
        return;
      }
      if (blockType === "tool_result") {
        const nativeCallId = stringValue(candidate.tool_use_id);
        const result = Object.hasOwn(candidate, "content") ? { content: candidate.content } : {};
        events.push({
          eventKey: eventKey(source, locator),
          kind: "result",
          nativeType: blockType,
          locator,
          outcome: claudeResultOutcome(candidate),
          ...nativeCallId === void 0 ? {} : { nativeCallId },
          result,
          ...provenance === "legacy-absent" ? {} : { origin: provenance }
        });
        return;
      }
      if (blockType?.includes("tool")) {
        coverage2.push({
          dataClass: "record-activity",
          status: "unsupported",
          captured: 0,
          locator
        });
      }
    });
  }
  const topLevelResult = topLevelToolUseResultActivity(
    source,
    detailed,
    provenance === "legacy-absent" ? void 0 : provenance
  );
  events.push(...topLevelResult.events);
  coverage2.push(...topLevelResult.coverage);
  if (provenance === "runtime-notification") {
    const locator = recordLocator(detailed, "/origin/kind");
    events.push({
      eventKey: eventKey(source, locator),
      kind: "notification",
      nativeType: "task-notification",
      locator,
      outcome: "unknown",
      origin: provenance
    });
  }
  return { events, coverage: coverage2, diagnostics: [] };
}

// src/shared/transcript/terminal-events.ts
var MONTH_INDEX = new Map(
  [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ].map((month, index) => [month.toLowerCase(), index])
);
function isJsonObject2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function stringValue2(value) {
  return typeof value === "string" ? value : void 0;
}
function decodeCodexLifecycleRecord(detailed) {
  const { record } = detailed;
  if (record.type !== "event_msg" || !isJsonObject2(record.payload)) return null;
  const payload = record.payload;
  const nativeType = stringValue2(payload.type);
  if (nativeType !== "task_started" && nativeType !== "task_complete" && nativeType !== "turn_aborted") {
    return null;
  }
  const error = isJsonObject2(payload.error) ? payload.error : void 0;
  const outcome = nativeType === "task_started" ? "pending" : nativeType === "turn_aborted" ? "cancelled" : error ? "error" : "success";
  return {
    nativeType,
    outcome,
    ...stringValue2(payload.turn_id) === void 0 ? {} : { turnId: stringValue2(payload.turn_id) },
    ...stringValue2(payload.status) === void 0 ? {} : { nativeStatus: stringValue2(payload.status) },
    ...error && stringValue2(error.codex_error_info) !== void 0 ? { errorInfo: stringValue2(error.codex_error_info) } : {},
    ...error && stringValue2(error.message) !== void 0 ? { errorMessage: stringValue2(error.message) } : {}
  };
}

// src/shared/transcript/activity/codex.ts
var ITEM_ACTIVITY_TYPES = /* @__PURE__ */ new Set([
  "CollabAgentToolCall",
  "CommandExecution",
  "FileChange",
  "McpToolCall",
  "SubAgentActivity",
  "WebSearch"
]);
var ITEM_NON_ACTIVITY_TYPES = /* @__PURE__ */ new Set([
  "AgentMessage",
  "Extension",
  "ImageView",
  "Reasoning",
  "UserMessage"
]);
var CODEX_OUTPUT_CAPS = {
  stdout: 1048608,
  aggregated_output: 1048608,
  formatted_output: 40109
};
function codexCallArguments(nativeType, payload, locator) {
  const field = nativeType === "function_call" ? "arguments" : "input";
  if (!Object.hasOwn(payload, field)) {
    return { fields: {}, diagnostics: [] };
  }
  const originalArguments = payload[field];
  if (nativeType !== "function_call" || typeof originalArguments !== "string") {
    return {
      fields: { arguments: originalArguments, originalArguments },
      diagnostics: []
    };
  }
  try {
    const parsed = JSON.parse(originalArguments);
    if (!isJsonObject(parsed)) throw new Error("arguments are not an object");
    return {
      fields: { arguments: parsed, originalArguments },
      diagnostics: []
    };
  } catch {
    return {
      fields: { originalArguments },
      diagnostics: [
        {
          code: "ARGUMENT_PARSE_ERROR",
          locator,
          field
        }
      ]
    };
  }
}
function codexItemOutcome(item) {
  const statusOutcome = outcomeFromStatus(item.status);
  if (statusOutcome !== "unknown") return statusOutcome;
  const exitCode = numberValue(item.exit_code);
  if (exitCode === void 0) return "unknown";
  return exitCode === 0 ? "success" : "error";
}
function selectedCompactionMetadata(payload) {
  const fields = [
    "first_window_id",
    "previous_window_id",
    "window_id",
    "window_number"
  ];
  return Object.fromEntries(
    fields.flatMap(
      (field) => Object.hasOwn(payload, field) ? [[field, payload[field]]] : []
    )
  );
}
function selectedSessionMetadata(payload) {
  const cliVersion = stringValue(payload.cli_version);
  const modelProvider = stringValue(payload.model_provider);
  const nativeSessionId = stringValue(payload.id);
  const directParentMarkerPresent = Object.hasOwn(payload, "parent_thread_id");
  const directParentThreadId = stringValue(payload.parent_thread_id);
  const source = isJsonObject(payload.source) ? payload.source : void 0;
  const subagent = source && isJsonObject(source.subagent) ? source.subagent : void 0;
  const threadSpawn = subagent && isJsonObject(subagent.thread_spawn) ? subagent.thread_spawn : void 0;
  const nestedParentThreadId = threadSpawn ? stringValue(threadSpawn.parent_thread_id) : void 0;
  const nestedParentMarkerPresent = threadSpawn !== void 0 && Object.hasOwn(threadSpawn, "parent_thread_id");
  const subagentMarkerPresent = subagent !== void 0;
  const subagentHistoryStartOrdinalPresent = Object.hasOwn(
    payload,
    "subagent_history_start_ordinal"
  );
  const subagentHistoryStartOrdinal = numberValue(
    payload.subagent_history_start_ordinal
  );
  return {
    ...cliVersion === void 0 ? {} : { cliVersion },
    ...modelProvider === void 0 ? {} : { modelProvider },
    ...nativeSessionId === void 0 ? {} : { nativeSessionId },
    ...directParentThreadId === void 0 ? {} : { directParentThreadId },
    ...nestedParentThreadId === void 0 ? {} : { nestedParentThreadId },
    ...directParentMarkerPresent ? { directParentMarkerPresent: true } : {},
    ...nestedParentMarkerPresent ? { nestedParentMarkerPresent: true } : {},
    ...subagentMarkerPresent ? { subagentMarkerPresent: true } : {},
    ...subagentHistoryStartOrdinalPresent ? { subagentHistoryStartOrdinalPresent: true } : {},
    ...subagentHistoryStartOrdinal === void 0 ? {} : { subagentHistoryStartOrdinal }
  };
}
function selectedTurnMetadata(payload) {
  const model = stringValue(payload.model);
  const effort = stringValue(payload.effort);
  return {
    ...model === void 0 ? {} : { model },
    ...effort === void 0 ? {} : { effort }
  };
}
function selectedLifecycleMetadata(payload) {
  const fields = [
    "started_at",
    "completed_at",
    "duration_ms",
    "time_to_first_token_ms"
  ];
  return Object.fromEntries(
    fields.flatMap((field) => {
      const value = numberValue(payload[field]);
      return value === void 0 ? [] : [[field, value]];
    })
  );
}
function codexLifecycleActivity(source, detailed, payload) {
  const lifecycle = decodeCodexLifecycleRecord(detailed);
  if (!lifecycle) return void 0;
  const { nativeType, outcome, turnId, nativeStatus, errorInfo } = lifecycle;
  const locator = recordLocator(detailed, "/payload");
  const metadata = selectedLifecycleMetadata(payload);
  if (errorInfo !== void 0) metadata.errorInfo = errorInfo;
  return {
    events: [
      {
        eventKey: eventKey(source, locator),
        kind: "lifecycle",
        nativeType,
        locator,
        outcome,
        ...turnId === void 0 ? {} : { turnId },
        ...nativeStatus === void 0 ? {} : { nativeStatus },
        ...Object.keys(metadata).length === 0 ? {} : { metadata }
      }
    ],
    coverage: [],
    diagnostics: []
  };
}
function outputCapDiagnostics(detailed, item, itemPointer) {
  return Object.entries(CODEX_OUTPUT_CAPS).flatMap(([field, cap]) => {
    const value = item[field];
    if (typeof value !== "string") return [];
    const bytes = Buffer.byteLength(value, "utf8");
    if (bytes !== cap) return [];
    return [
      {
        code: "POSSIBLE_SOURCE_TRUNCATION",
        locator: recordLocator(detailed, `${itemPointer}/${field}`),
        field,
        bytes
      }
    ];
  });
}
function responseItemActivity(source, detailed, payload) {
  const nativeType = stringValue(payload.type);
  const locator = recordLocator(detailed, "/payload");
  if (nativeType === "function_call" || nativeType === "custom_tool_call") {
    const nativeCallId = stringValue(payload.call_id);
    const nativeId = stringValue(payload.id);
    const nativeName = stringValue(payload.name);
    const nativeStatus = stringValue(payload.status);
    const argumentEvidence = codexCallArguments(nativeType, payload, locator);
    return {
      events: [
        {
          eventKey: eventKey(source, locator),
          kind: "call",
          nativeType,
          locator,
          // custom_tool_call.status is a constant carrier value, not outcome.
          outcome: "pending",
          ...nativeId === void 0 ? {} : { nativeId },
          ...nativeCallId === void 0 ? {} : { nativeCallId },
          ...nativeName === void 0 ? {} : { nativeName },
          ...nativeStatus === void 0 ? {} : { nativeStatus },
          ...Object.hasOwn(payload, "namespace") ? { metadata: { namespace: payload.namespace } } : {},
          ...argumentEvidence.fields
        }
      ],
      coverage: [],
      diagnostics: argumentEvidence.diagnostics
    };
  }
  if (nativeType === "function_call_output" || nativeType === "custom_tool_call_output") {
    const nativeCallId = stringValue(payload.call_id);
    return {
      events: [
        {
          eventKey: eventKey(source, locator),
          kind: "result",
          nativeType,
          locator,
          outcome: "unknown",
          ...nativeCallId === void 0 ? {} : { nativeCallId },
          ...Object.hasOwn(payload, "output") ? { result: payload.output } : {}
        }
      ],
      coverage: [],
      diagnostics: []
    };
  }
  if (nativeType === "web_search_call") {
    const nativeId = stringValue(payload.id);
    return {
      events: [
        {
          eventKey: eventKey(source, locator),
          kind: "call",
          nativeType,
          locator,
          outcome: "pending",
          nativeName: "web_search",
          ...nativeId === void 0 ? {} : { nativeId },
          ...Object.hasOwn(payload, "query") ? { arguments: payload.query } : {}
        }
      ],
      coverage: [],
      diagnostics: []
    };
  }
  if (nativeType === "message" || nativeType === "reasoning") {
    return { events: [], coverage: [], diagnostics: [] };
  }
  return {
    events: [],
    coverage: [
      {
        dataClass: "record-activity",
        status: "unsupported",
        captured: 0,
        locator
      }
    ],
    diagnostics: []
  };
}
function itemCompletedActivity(source, detailed, payload) {
  const item = isJsonObject(payload.item) ? payload.item : void 0;
  const locator = recordLocator(detailed, "/payload/item");
  if (!item) {
    return {
      events: [],
      coverage: [
        {
          dataClass: "items",
          status: "unsupported",
          captured: 0,
          locator
        }
      ],
      diagnostics: []
    };
  }
  const nativeType = stringValue(item.type);
  if (nativeType === "ContextCompaction") {
    return {
      events: [
        {
          eventKey: eventKey(source, locator),
          kind: "compaction",
          nativeType,
          locator,
          outcome: "unknown",
          metadata: selectedCompactionMetadata(item)
        }
      ],
      coverage: [],
      diagnostics: []
    };
  }
  if (!nativeType || ITEM_NON_ACTIVITY_TYPES.has(nativeType)) {
    return { events: [], coverage: [], diagnostics: [] };
  }
  if (!ITEM_ACTIVITY_TYPES.has(nativeType)) {
    return {
      events: [],
      coverage: [
        {
          dataClass: "items",
          status: "unsupported",
          captured: 0,
          locator
        }
      ],
      diagnostics: []
    };
  }
  const nativeId = stringValue(item.id);
  const nativeCallId = stringValue(item.call_id);
  const nativeStatus = stringValue(item.status);
  const turnId = stringValue(payload.turn_id);
  const childNativeId = stringValue(item.agent_thread_id);
  const childNickname = stringValue(item.agent_nickname);
  const childReference2 = childNativeId ? {
    nativeId: childNativeId,
    ...childNickname === void 0 ? {} : { nickname: childNickname },
    ...nativeStatus === void 0 ? {} : { status: nativeStatus },
    trajectoryAvailability: "not-read"
  } : void 0;
  const coverage2 = childReference2 ? [
    {
      dataClass: "child-trajectory",
      status: "not-read",
      captured: 1,
      locator
    }
  ] : [];
  const diagnostics = outputCapDiagnostics(detailed, item, "/payload/item");
  if (diagnostics.length > 0) {
    coverage2.push(
      ...diagnostics.map((diagnostic) => ({
        dataClass: "items",
        status: "truncated",
        captured: 1,
        locator: diagnostic.locator
      }))
    );
  }
  return {
    events: [
      {
        eventKey: eventKey(source, locator),
        kind: "item",
        nativeType,
        locator,
        outcome: codexItemOutcome(item),
        ...nativeId === void 0 ? {} : { nativeId },
        ...nativeCallId === void 0 ? {} : { nativeCallId },
        ...nativeStatus === void 0 ? {} : { nativeStatus },
        ...turnId === void 0 ? {} : { turnId },
        nativeValue: item,
        ...childReference2 === void 0 ? {} : { childReference: childReference2 }
      }
    ],
    coverage: coverage2,
    diagnostics
  };
}
function extractCodexRecord(source, detailed) {
  const { record } = detailed;
  const payload = isJsonObject(record.payload) ? record.payload : void 0;
  if (record.type === "response_item" && payload) {
    return responseItemActivity(source, detailed, payload);
  }
  if (record.type === "event_msg" && payload) {
    if (payload.type === "item_completed") {
      return itemCompletedActivity(source, detailed, payload);
    }
    if (payload.type === "web_search_call") {
      return responseItemActivity(source, detailed, payload);
    }
    const lifecycle = codexLifecycleActivity(source, detailed, payload);
    if (lifecycle) return lifecycle;
    return { events: [], coverage: [], diagnostics: [] };
  }
  if (record.type === "session_meta" && payload) {
    const locator = recordLocator(detailed, "/payload");
    return {
      events: [
        {
          eventKey: eventKey(source, locator),
          kind: "metadata",
          nativeType: "session_meta",
          locator,
          outcome: "unknown",
          metadata: selectedSessionMetadata(payload)
        }
      ],
      coverage: [],
      diagnostics: []
    };
  }
  if (record.type === "turn_context" && payload) {
    const locator = recordLocator(detailed, "/payload");
    const turnId = stringValue(payload.turn_id);
    return {
      events: [
        {
          eventKey: eventKey(source, locator),
          kind: "metadata",
          nativeType: "turn_context",
          locator,
          outcome: "unknown",
          ...turnId === void 0 ? {} : { turnId },
          metadata: selectedTurnMetadata(payload)
        }
      ],
      coverage: [],
      diagnostics: []
    };
  }
  if (record.type === "compacted" && payload) {
    const locator = recordLocator(detailed, "/payload");
    return {
      events: [
        {
          eventKey: eventKey(source, locator),
          kind: "compaction",
          nativeType: "compacted",
          locator,
          outcome: "unknown",
          metadata: selectedCompactionMetadata(payload)
        }
      ],
      coverage: [],
      diagnostics: []
    };
  }
  return { events: [], coverage: [], diagnostics: [] };
}

// src/shared/transcript/activity/extract.ts
function validateInput(input) {
  const { source } = input;
  if (!source.sessionId || !source.nativeSessionId || !source.transcriptPath) {
    throw new Error("Activity extraction requires an exact selected source");
  }
  if (source.runtime !== "claude-code" && source.runtime !== "codex") {
    throw new Error(`Unsupported activity runtime: ${String(source.runtime)}`);
  }
}
function sourceDiagnosticCode(kind) {
  switch (kind) {
    case "malformed":
      return "SOURCE_MALFORMED_RECORD";
    case "not-object":
      return "SOURCE_NOT_OBJECT";
    case "partial-tail":
      return "SOURCE_PARTIAL_TAIL";
  }
}
function baseCoverage(events) {
  const count = (dataClass) => {
    switch (dataClass) {
      case "calls":
        return events.filter((event) => event.kind === "call").length;
      case "results":
        return events.filter((event) => event.kind === "result").length;
      case "items":
        return events.filter((event) => event.kind === "item").length;
      case "metadata":
        return events.filter(
          (event) => ["metadata", "notification", "lifecycle", "compaction"].includes(
            event.kind
          )
        ).length;
      default:
        return 0;
    }
  };
  return ["calls", "results", "items", "metadata"].map(
    (dataClass) => ({
      dataClass,
      status: "available",
      captured: count(dataClass)
    })
  );
}
function extractionFailure(locator) {
  return {
    events: [],
    diagnostics: [{ code: "ACTIVITY_EXTRACTION_ERROR", locator }],
    coverage: [
      {
        dataClass: "record-activity",
        status: "not-read",
        captured: 0,
        locator
      }
    ]
  };
}
function extractActivity(input) {
  validateInput(input);
  const events = [];
  const coverage2 = [];
  const diagnostics = [];
  for (const sourceDiagnostic of input.read.diagnostics) {
    const locator = {
      physicalLine: sourceDiagnostic.physicalLine,
      jsonPointer: ""
    };
    diagnostics.push({
      code: sourceDiagnosticCode(sourceDiagnostic.kind),
      locator
    });
    coverage2.push({
      dataClass: "record-activity",
      status: "malformed",
      captured: 0,
      locator
    });
  }
  for (const detailed of input.read.records) {
    let extracted;
    try {
      extracted = input.source.runtime === "claude-code" ? extractClaudeRecord(input.source, detailed) : extractCodexRecord(input.source, detailed);
    } catch {
      extracted = extractionFailure({
        recordIndex: detailed.recordIndex,
        physicalLine: detailed.physicalLine,
        jsonPointer: ""
      });
    }
    events.push(...extracted.events);
    coverage2.push(...extracted.coverage);
    diagnostics.push(...extracted.diagnostics);
  }
  return {
    activitySchemaVersion: ACTIVITY_SCHEMA_VERSION,
    source: input.source,
    sourceSnapshot: {
      capturedAt: input.read.capturedAt,
      sourceBytes: input.read.sourceBytes
    },
    events,
    coverage: [...baseCoverage(events), ...coverage2],
    diagnostics
  };
}

// src/shared/transcript/activity/render.ts
function stableJsonValue(value, seen) {
  if (Array.isArray(value)) {
    return value.map((item) => stableJsonValue(item, seen));
  }
  if (typeof value !== "object" || value === null) return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  const result = Object.fromEntries(
    Object.entries(value).toSorted(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableJsonValue(item, seen)])
  );
  seen.delete(value);
  return result;
}
function stableActivityStringify(value) {
  if (value === void 0) return "undefined";
  return JSON.stringify(stableJsonValue(value, /* @__PURE__ */ new Set()));
}
function renderActivityReport(report) {
  return stableActivityStringify(report);
}
function markdownData(value) {
  return stableActivityStringify(value).replaceAll("&", "\\u0026").replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("`", "\\u0060").replaceAll("[", "\\u005b").replaceAll("]", "\\u005d").replaceAll("(", "\\u0028").replaceAll(")", "\\u0029").replaceAll("*", "\\u002a").replace(/(?<![\p{L}\p{N}])_|_(?![\p{L}\p{N}])/gu, "\\u005f").replaceAll("~", "\\u007e");
}
function locatorText(locator) {
  if (!locator) return "source-wide";
  if (locator.sourceFrameIndex !== void 0) {
    const delivery = locator.deliveryFrameIndex === void 0 ? "" : `, delivery frame ${locator.deliveryFrameIndex}`;
    return `source frame ${locator.sourceFrameIndex}${delivery}, line ${locator.physicalLine}, pointer ${locator.jsonPointer || "/"}`;
  }
  const record = locator.recordIndex === void 0 ? "" : `, record ${locator.recordIndex}`;
  return `line ${locator.physicalLine}${record}, pointer ${locator.jsonPointer || "/"}`;
}
function previewLine(label, preview2) {
  if (!preview2) return [];
  const clipped = preview2.truncated ? `; clipped ${preview2.displayedBytes}/${preview2.sourceBytes} bytes` : `; ${preview2.displayedBytes} bytes`;
  return [`  - ${label}${clipped}: ${markdownData(preview2.text)}`];
}
function eventLines(event) {
  const identity = event.nativeName ?? event.nativeType;
  const source = locatorText(event.locator);
  const relation = event.relatedCallKey ? `; related call ${markdownData(event.relatedCallKey)}` : "";
  const evidence = Object.fromEntries(
    Object.entries({
      nativeType: event.nativeName === void 0 ? void 0 : event.nativeType,
      category: event.category,
      nativeId: event.nativeId,
      nativeCallId: event.nativeCallId,
      nativeStatus: event.nativeStatus,
      origin: event.origin,
      turnId: event.turnId,
      lifecycleAvailability: event.lifecycleAvailability,
      turnOutcome: event.turnOutcome,
      externalReference: event.externalReference,
      childReference: event.childReference
    }).filter(([, value]) => value !== void 0)
  );
  return [
    `- ${event.kind} ${markdownData(identity)}; ${event.outcome}; ${event.ownership}; ${source}${relation}`,
    ...Object.keys(evidence).length === 0 ? [] : [`  - native evidence: ${markdownData(evidence)}`],
    ...previewLine("input", event.inputPreview),
    ...previewLine("original input", event.originalInputPreview),
    ...previewLine("output", event.outputPreview),
    ...previewLine("metadata", event.metadataPreview),
    ...event.outputPreviewOmitted ? [`  - output preview: ${event.outputPreviewOmitted}`] : []
  ];
}
function countLine(counts) {
  return `- ${counts.scope}: calls ${counts.calls}; counted invocations ${counts.countedInvocations}; pending lifecycle ${counts.pendingLifecycleCalls}; results ${counts.results}; items ${counts.items}; failures ${counts.failures}`;
}
function renderActivityMarkdown(report) {
  const lines = [
    "## Activity",
    "",
    `- Schema: ${report.activitySchemaVersion}`,
    `- Mode: ${report.mode}`,
    `- Budgeted format: ${report.renderedFormat}`,
    `- Runtime: ${report.source.runtime}`,
    `- Native session: ${markdownData(report.source.nativeSessionId)}`,
    `- Source: ${markdownData(report.source.transcriptPath)}`,
    `- Source snapshot: ${report.sourceSnapshot.sourceBytes} bytes captured at ${report.sourceSnapshot.capturedAt}`,
    `- Delivery range: [${report.deliveryRange.start}, ${report.deliveryRange.end}) ${report.deliveryRange.indexBase}`,
    `- Activity bytes: ${report.renderedBytes}/${report.limits.maxBytes}; preview cap: ${report.limits.previewBytes}; late context cap: ${report.limits.lateContextBytes}`,
    countLine(report.counts.capturedSource),
    countLine(report.counts.deliveredRange),
    countLine(report.counts.displayed),
    `- Omitted evidence: calls ${report.omitted.calls}; results ${report.omitted.results}; failures ${report.omitted.failures}`,
    `- Omitted groups: invocation limit ${report.omitted.invocationLimitGroups}; byte limit ${report.omitted.byteLimitGroups}`,
    `- Omitted metadata: coverage ${report.omitted.coverageEntries}; diagnostics ${report.omitted.diagnostics}`,
    "",
    "### Events",
    "",
    ...report.events.length === 0 ? ["- None in the displayed range."] : report.events.flatMap(eventLines)
  ];
  if (report.callContexts.length > 0) {
    lines.push("", "### Earlier call context", "");
    for (const context of report.callContexts) {
      lines.push(
        `- ${markdownData(context.nativeName ?? context.callKey)}; ${context.availability}; ${locatorText(context.locator)}`,
        ...previewLine("input context", context.inputPreview),
        ...previewLine("original input context", context.originalInputPreview)
      );
    }
  }
  if (report.coverage.length > 0) {
    lines.push("", "### Coverage", "");
    for (const coverage2 of report.coverage) {
      lines.push(
        `- ${coverage2.dataClass}: ${coverage2.status}; captured ${coverage2.captured}; ${locatorText(coverage2.locator)}`
      );
    }
  }
  if (report.diagnostics.length > 0) {
    lines.push("", "### Diagnostics", "");
    for (const diagnostic of report.diagnostics) {
      const details = Object.fromEntries(
        Object.entries({
          field: diagnostic.field,
          bytes: diagnostic.bytes,
          nativeId: diagnostic.nativeId
        }).filter(([, value]) => value !== void 0)
      );
      lines.push(
        `- ${diagnostic.code}; ${locatorText(diagnostic.locator)}${Object.keys(details).length === 0 ? "" : `; ${markdownData(details)}`}`
      );
    }
  }
  return `${lines.join("\n")}
`;
}

// src/shared/transcript/activity/project.ts
var KIB = 1024;
var MIB = 1024 * KIB;
var ACTIVITY_PROJECTION_LIMITS = {
  watch: {
    maxBytes: 32 * KIB,
    maxInvocations: 80,
    previewBytes: 2 * KIB,
    lateContextBytes: 256
  },
  "catch-up": {
    maxBytes: 32 * KIB,
    maxInvocations: 80,
    previewBytes: 2 * KIB,
    lateContextBytes: 256
  },
  review: {
    maxBytes: 128 * KIB,
    maxInvocations: 1024,
    previewBytes: 2 * KIB,
    lateContextBytes: 256
  },
  export: {
    maxBytes: 64 * MIB,
    maxInvocations: null,
    previewBytes: 2 * KIB,
    lateContextBytes: 256
  }
};
function inRange(event, range) {
  return event.locator.recordIndex >= range.start && event.locator.recordIndex < range.end;
}
function validateRange(range) {
  if (!Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end) || range.start < 0 || range.end < range.start) {
    throw new Error("Activity delivery range must be a valid half-open range");
  }
}
function validateLimits(limits) {
  if (!Number.isSafeInteger(limits.maxBytes) || limits.maxBytes <= 0 || limits.maxInvocations !== null && (!Number.isSafeInteger(limits.maxInvocations) || limits.maxInvocations < 0) || !Number.isSafeInteger(limits.previewBytes) || limits.previewBytes <= 0 || !Number.isSafeInteger(limits.lateContextBytes) || limits.lateContextBytes <= 0) {
    throw new Error("Activity projection limits must be positive integers");
  }
}
function clipUtf8(text, maxBytes) {
  const sourceBytes = Buffer.byteLength(text, "utf8");
  if (sourceBytes <= maxBytes) {
    return {
      text,
      sourceBytes,
      displayedBytes: sourceBytes,
      truncated: false
    };
  }
  let displayed = "";
  let displayedBytes = 0;
  for (const character of text) {
    const characterBytes = Buffer.byteLength(character, "utf8");
    if (displayedBytes + characterBytes > maxBytes) break;
    displayed += character;
    displayedBytes += characterBytes;
  }
  return {
    text: displayed,
    sourceBytes,
    displayedBytes,
    truncated: true
  };
}
function preview(value, maxBytes) {
  return clipUtf8(stableActivityStringify(value), maxBytes);
}
function compareChronology(left, right) {
  return left.locator.recordIndex - right.locator.recordIndex || left.locator.jsonPointer.localeCompare(right.locator.jsonPointer) || left.eventKey.localeCompare(right.eventKey);
}
function compareHighPriority(left, right) {
  return Number(right.failure) - Number(left.failure) || right.recency - left.recency || left.key.localeCompare(right.key);
}
function compareLowPriority(left, right) {
  return Number(left.failure) - Number(right.failure) || left.recency - right.recency || right.key.localeCompare(left.key);
}
function buildGroups(activity) {
  const calls = new Map(
    activity.events.filter((event) => event.kind === "call").map((event) => [event.eventKey, event])
  );
  const grouped = /* @__PURE__ */ new Map();
  for (const event of activity.events) {
    const key = event.kind === "call" ? event.eventKey : event.relatedCallKey ?? event.eventKey;
    const events = grouped.get(key) ?? [];
    events.push(event);
    grouped.set(key, events);
  }
  return [...grouped.entries()].map(([key, events]) => {
    const call = calls.get(key);
    return {
      key,
      events: events.toSorted(compareChronology),
      ...call === void 0 ? {} : { call },
      displayedInvocation: call !== void 0,
      failure: events.some(
        (event) => event.outcome === "error" || event.outcome === "cancelled"
      ),
      recency: Math.max(...events.map((event) => event.locator.recordIndex))
    };
  });
}
function deliveredGroups(activity, range) {
  return buildGroups(activity).flatMap((group) => {
    const events = group.events.filter((event) => inRange(event, range));
    if (events.length === 0) return [];
    const deliveredCall = events.find((event) => event.kind === "call");
    return [
      {
        ...group,
        events,
        displayedInvocation: deliveredCall !== void 0,
        failure: events.some(
          (event) => event.outcome === "error" || event.outcome === "cancelled"
        ),
        recency: Math.max(...events.map((event) => event.locator.recordIndex))
      }
    ];
  });
}
function deliveredMetadata(activity, range) {
  const locatorInRange = (locator) => {
    const index = locator?.recordIndex;
    return index === void 0 || index >= range.start && index < range.end;
  };
  return {
    coverage: activity.coverage.filter(
      (entry) => locatorInRange(entry.locator)
    ),
    diagnostics: activity.diagnostics.filter(
      (entry) => locatorInRange(entry.locator)
    )
  };
}
function compareMetadataPriority(left, right) {
  return (right.locator?.recordIndex ?? -1) - (left.locator?.recordIndex ?? -1) || (right.locator?.physicalLine ?? -1) - (left.locator?.physicalLine ?? -1) || Number(right.kind === "diagnostics") - Number(left.kind === "diagnostics") || left.index - right.index;
}
function retainMetadata(metadata, retainedCount) {
  const priority = [
    ...metadata.coverage.map(
      (entry, index) => ({
        kind: "coverage",
        index,
        locator: entry.locator
      })
    ),
    ...metadata.diagnostics.map(
      (entry, index) => ({
        kind: "diagnostics",
        index,
        locator: entry.locator
      })
    )
  ].toSorted(compareMetadataPriority);
  const retainedCoverage = /* @__PURE__ */ new Set();
  const retainedDiagnostics = /* @__PURE__ */ new Set();
  for (const candidate of priority.slice(0, retainedCount)) {
    (candidate.kind === "coverage" ? retainedCoverage : retainedDiagnostics).add(candidate.index);
  }
  return {
    coverage: metadata.coverage.filter(
      (_, index) => retainedCoverage.has(index)
    ),
    diagnostics: metadata.diagnostics.filter(
      (_, index) => retainedDiagnostics.has(index)
    )
  };
}
function projectEvent(event, limits, suppressLinkedItemOutput) {
  return {
    eventKey: event.eventKey,
    kind: event.kind,
    nativeType: event.nativeType,
    locator: event.locator,
    outcome: event.outcome,
    ownership: event.ownership,
    ...event.category === void 0 ? {} : { category: event.category },
    ...event.relatedCallKey === void 0 ? {} : { relatedCallKey: event.relatedCallKey },
    ...event.nativeId === void 0 ? {} : { nativeId: event.nativeId },
    ...event.nativeCallId === void 0 ? {} : { nativeCallId: event.nativeCallId },
    ...event.nativeName === void 0 ? {} : { nativeName: event.nativeName },
    ...event.nativeStatus === void 0 ? {} : { nativeStatus: event.nativeStatus },
    ...event.origin === void 0 ? {} : { origin: event.origin },
    ...event.turnId === void 0 ? {} : { turnId: event.turnId },
    ...event.lifecycleAvailability === void 0 ? {} : { lifecycleAvailability: event.lifecycleAvailability },
    ...event.turnOutcome === void 0 ? {} : { turnOutcome: event.turnOutcome },
    ...Object.hasOwn(event, "arguments") ? { inputPreview: preview(event.arguments, limits.previewBytes) } : {},
    ...Object.hasOwn(event, "originalArguments") ? {
      originalInputPreview: preview(
        event.originalArguments,
        limits.previewBytes
      )
    } : {},
    ...event.kind === "result" && Object.hasOwn(event, "result") ? { outputPreview: preview(event.result, limits.previewBytes) } : {},
    ...event.kind === "item" && suppressLinkedItemOutput ? { outputPreviewOmitted: "exact-linked-duplicate-carrier" } : event.kind === "item" && Object.hasOwn(event, "nativeValue") ? { outputPreview: preview(event.nativeValue, limits.previewBytes) } : event.kind === "item" && Object.hasOwn(event, "result") ? { outputPreview: preview(event.result, limits.previewBytes) } : {},
    ...event.metadata === void 0 ? {} : { metadataPreview: preview(event.metadata, limits.previewBytes) },
    ...event.externalReference === void 0 ? {} : { externalReference: event.externalReference },
    ...event.childReference === void 0 ? {} : { childReference: event.childReference }
  };
}
function countEvents(scope, events) {
  return {
    scope,
    calls: events.filter((event) => event.kind === "call").length,
    countedInvocations: events.filter(
      (event) => event.kind === "call" && event.ownership === "owned"
    ).length,
    pendingLifecycleCalls: events.filter(
      (event) => event.kind === "call" && event.lifecycleAvailability === "pending-lifecycle"
    ).length,
    results: events.filter((event) => event.kind === "result").length,
    items: events.filter((event) => event.kind === "item").length,
    failures: events.filter(
      (event) => event.outcome === "error" || event.outcome === "cancelled"
    ).length
  };
}
function finalizeRenderedBytes(report) {
  let finalized = report;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const rendered = finalized.renderedFormat === "markdown" ? renderActivityMarkdown(finalized) : renderActivityReport(finalized);
    const renderedBytes = Buffer.byteLength(rendered, "utf8");
    if (renderedBytes === finalized.renderedBytes) return finalized;
    finalized = { ...finalized, renderedBytes };
  }
  throw new Error("Activity report byte size did not stabilize");
}
function buildReport(activity, options, limits, groups, retainedKeys, metadata, reasons) {
  const deliveredEvents = groups.flatMap((group) => group.events);
  const retainedGroups = groups.filter((group) => retainedKeys.has(group.key));
  const displayedRaw = retainedGroups.flatMap((group) => group.events).toSorted(compareChronology);
  const groupWithOutputResult = new Set(
    retainedGroups.filter(
      (group) => group.events.some(
        (event) => event.kind === "result" && Object.hasOwn(event, "result")
      )
    ).map((group) => group.key)
  );
  const eventGroup = new Map(
    retainedGroups.flatMap(
      (group) => group.events.map((event) => [event.eventKey, group.key])
    )
  );
  const events = displayedRaw.map(
    (event) => projectEvent(
      event,
      limits,
      event.kind === "item" && event.relatedCallKey !== void 0 && groupWithOutputResult.has(eventGroup.get(event.eventKey) ?? "")
    )
  );
  const callContexts = retainedGroups.flatMap((group) => {
    if (!group.call || inRange(group.call, options.deliveryRange)) return [];
    return [
      {
        callKey: group.call.eventKey,
        availability: "outside-delivered-range",
        locator: group.call.locator,
        ...group.call.nativeCallId === void 0 ? {} : { nativeCallId: group.call.nativeCallId },
        ...group.call.nativeName === void 0 ? {} : { nativeName: group.call.nativeName },
        ...group.call.category === void 0 ? {} : { category: group.call.category },
        ...Object.hasOwn(group.call, "arguments") ? {
          inputPreview: preview(
            group.call.arguments,
            limits.lateContextBytes
          )
        } : {},
        ...Object.hasOwn(group.call, "originalArguments") ? {
          originalInputPreview: preview(
            group.call.originalArguments,
            limits.lateContextBytes
          )
        } : {}
      }
    ];
  }).toSorted(
    (left, right) => left.locator.recordIndex - right.locator.recordIndex || left.callKey.localeCompare(right.callKey)
  );
  const captured = countEvents("captured-source", activity.events);
  const delivered = countEvents("delivered-range", deliveredEvents);
  const displayed = countEvents("displayed", displayedRaw);
  const report = {
    activitySchemaVersion: activity.activitySchemaVersion,
    mode: options.mode,
    renderedFormat: options.renderFormat,
    source: activity.source,
    sourceSnapshot: activity.sourceSnapshot,
    deliveryRange: options.deliveryRange,
    limits,
    renderedBytes: 0,
    counts: {
      capturedSource: captured,
      deliveredRange: delivered,
      displayed
    },
    omitted: {
      calls: delivered.calls - displayed.calls,
      results: delivered.results - displayed.results,
      failures: delivered.failures - displayed.failures,
      ...reasons
    },
    events,
    callContexts,
    coverage: metadata.coverage,
    diagnostics: metadata.diagnostics
  };
  return finalizeRenderedBytes(report);
}
function projectActivityWithLimits(activity, options, limits) {
  validateRange(options.deliveryRange);
  validateLimits(limits);
  const groups = deliveredGroups(activity, options.deliveryRange);
  const displayedInvocations = groups.filter((group) => group.displayedInvocation).toSorted(compareHighPriority);
  const invocationOmitted = limits.maxInvocations === null ? [] : displayedInvocations.slice(limits.maxInvocations);
  const retained = new Set(groups.map((group) => group.key));
  for (const group of invocationOmitted) retained.delete(group.key);
  const metadata = deliveredMetadata(activity, options.deliveryRange);
  const initialReasons = {
    invocationLimitGroups: invocationOmitted.length,
    byteLimitGroups: 0,
    coverageEntries: 0,
    diagnostics: 0
  };
  const initial = buildReport(
    activity,
    options,
    limits,
    groups,
    retained,
    metadata,
    initialReasons
  );
  if (initial.renderedBytes <= limits.maxBytes) return initial;
  const removable = groups.filter((group) => retained.has(group.key)).toSorted(compareLowPriority);
  let low = 1;
  let high = removable.length;
  let best;
  while (low <= high) {
    const removedCount = Math.floor((low + high) / 2);
    const candidateKeys = new Set(retained);
    for (const group of removable.slice(0, removedCount)) {
      candidateKeys.delete(group.key);
    }
    const candidate = buildReport(
      activity,
      options,
      limits,
      groups,
      candidateKeys,
      metadata,
      {
        ...initialReasons,
        byteLimitGroups: removedCount
      }
    );
    if (candidate.renderedBytes <= limits.maxBytes) {
      best = candidate;
      high = removedCount - 1;
    } else {
      low = removedCount + 1;
    }
  }
  if (best) return best;
  const metadataCount = metadata.coverage.length + metadata.diagnostics.length;
  let metadataLow = 0;
  let metadataHigh = metadataCount;
  while (metadataLow <= metadataHigh) {
    const retainedCount = Math.floor((metadataLow + metadataHigh) / 2);
    const retainedMetadata = retainMetadata(metadata, retainedCount);
    const candidate = buildReport(
      activity,
      options,
      limits,
      groups,
      /* @__PURE__ */ new Set(),
      retainedMetadata,
      {
        ...initialReasons,
        byteLimitGroups: removable.length,
        coverageEntries: metadata.coverage.length - retainedMetadata.coverage.length,
        diagnostics: metadata.diagnostics.length - retainedMetadata.diagnostics.length
      }
    );
    if (candidate.renderedBytes <= limits.maxBytes) {
      best = candidate;
      metadataLow = retainedCount + 1;
    } else {
      metadataHigh = retainedCount - 1;
    }
  }
  if (best) return best;
  throw new RangeError("Activity report envelope exceeds the byte limit");
}
function projectActivity(activity, options) {
  return projectActivityWithLimits(
    activity,
    options,
    ACTIVITY_PROJECTION_LIMITS[options.mode]
  );
}

// src/shared/transcript/activity/cursor.ts
function validateInput2(input) {
  if (input.source.runtime !== "cursor" || !input.source.sessionId.trim() || !input.source.nativeSessionId.trim() || !input.source.transcriptPath.trim()) {
    throw new Error("Cursor activity extraction requires an exact source");
  }
  if (!input.capturedAt.trim()) {
    throw new Error("Cursor activity extraction requires a capture time");
  }
  if (input.scan.indexBase !== "zero-based-jsonl-frame-index") {
    throw new Error("Cursor activity extraction requires frame-indexed input");
  }
}
function isSettled(turn) {
  return turn.terminalFrameIndex !== null;
}
function eventLocator(sourceFrameIndex, blockIndex, terminalFrameIndex) {
  const deliveryFrameIndex = terminalFrameIndex ?? sourceFrameIndex;
  return {
    // Cursor JSONL frames retain a one-to-one physical-line coordinate even
    // though delivery is selected by terminal frame rather than source line.
    physicalLine: sourceFrameIndex + 1,
    recordIndex: deliveryFrameIndex,
    sourceFrameIndex,
    ...terminalFrameIndex === null ? {} : { deliveryFrameIndex: terminalFrameIndex },
    jsonPointer: `/message/content/${blockIndex}`
  };
}
function eventKey2(turn, sourceFrameIndex, blockIndex, scan) {
  const positional = `${turn.turnId}:frame:${sourceFrameIndex}:block:${blockIndex}`;
  return isSettled(turn) ? positional : `${positional}:snapshot:${scan.safePrefixSha256}`;
}
function callEvents(input) {
  return input.analysis.turns.flatMap((turn) => {
    const settled = isSettled(turn);
    if (input.mode === "stateful-delivery" && !settled) return [];
    return (turn.toolRecords ?? []).map(
      (tool) => ({
        eventKey: eventKey2(
          turn,
          tool.sourceFrameIndex,
          tool.blockIndex,
          input.scan
        ),
        kind: "call",
        nativeType: tool.nativeType,
        locator: eventLocator(
          tool.sourceFrameIndex,
          tool.blockIndex,
          turn.terminalFrameIndex
        ),
        // Cursor records only turn-level terminal evidence. A successful,
        // errored, or aborted turn never proves an individual call's outcome.
        outcome: "unknown",
        turnId: turn.turnId,
        lifecycleAvailability: settled ? "settled" : "pending-lifecycle",
        turnOutcome: turn.lifecycle,
        ...tool.nativeName === void 0 ? {} : { nativeName: tool.nativeName },
        ...Object.hasOwn(tool, "arguments") ? { arguments: tool.arguments } : {}
      })
    );
  });
}
function lifecycleCounts(analysis, emittedCalls, mode) {
  let settledCalls = 0;
  let pendingLifecycleCalls = 0;
  for (const turn of analysis.turns) {
    const count = turn.toolRecords?.length ?? 0;
    if (isSettled(turn)) settledCalls += count;
    else pendingLifecycleCalls += count;
  }
  return {
    capturedCalls: settledCalls + pendingLifecycleCalls,
    settledCalls,
    pendingLifecycleCalls,
    emittedCalls,
    deferredPendingCalls: mode === "stateful-delivery" ? pendingLifecycleCalls : 0
  };
}
function coverage(events, scan, mode) {
  const entries = [
    {
      dataClass: "calls",
      status: "available",
      captured: events.length
    },
    ...events.length > 0 || mode === "stateless-snapshot" ? [
      {
        dataClass: "results",
        status: "not-recorded",
        captured: 0
      }
    ] : []
  ];
  if (scan.blockingFrame) {
    entries.push({
      dataClass: "record-activity",
      status: "malformed",
      captured: 0,
      locator: {
        physicalLine: scan.blockingFrame.frameIndex + 1,
        recordIndex: scan.blockingFrame.frameIndex,
        sourceFrameIndex: scan.blockingFrame.frameIndex,
        jsonPointer: ""
      }
    });
  }
  return entries;
}
function extractCursorActivity(input) {
  validateInput2(input);
  const events = callEvents(input);
  const counts = lifecycleCounts(input.analysis, events.length, input.mode);
  return {
    activitySchemaVersion: ACTIVITY_SCHEMA_VERSION,
    source: input.source,
    sourceSnapshot: {
      capturedAt: input.capturedAt,
      sourceBytes: input.scan.file.size
    },
    events,
    coverage: coverage(events, input.scan, input.mode),
    diagnostics: input.scan.blockingFrame ? [
      {
        code: input.scan.blockingFrame.parseState === "partial" ? "SOURCE_PARTIAL_TAIL" : "SOURCE_MALFORMED_RECORD",
        locator: {
          physicalLine: input.scan.blockingFrame.frameIndex + 1,
          recordIndex: input.scan.blockingFrame.frameIndex,
          sourceFrameIndex: input.scan.blockingFrame.frameIndex,
          jsonPointer: ""
        }
      }
    ] : [],
    cursor: {
      indexBase: input.scan.indexBase,
      mode: input.mode,
      counts
    }
  };
}

// src/shared/transcript/cursor-analysis.ts
import { createHash } from "node:crypto";
function isJsonObject3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function stringValue3(value) {
  return typeof value === "string" ? value : null;
}
function identityScope(identity) {
  return createHash("sha256").update(
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
  if (!isJsonObject3(record.message)) {
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
    if (!isJsonObject3(block)) {
      return { blockIndex, kind: "unsupported", text: "" };
    }
    const type = stringValue3(block.type);
    if (type === "tool_use") {
      const nativeName = stringValue3(block.name);
      const toolRecord = {
        nativeType: "tool_use",
        ...nativeName === null ? {} : { nativeName },
        ...Object.hasOwn(block, "input") ? { arguments: block.input } : {}
      };
      const askUserText = cursorAskUserQuestionText(block);
      if (askUserText !== null) {
        return {
          blockIndex,
          kind: "ask-user",
          text: askUserText,
          toolRecord
        };
      }
      return { blockIndex, kind: "tool", text: "", toolRecord };
    }
    const text = stringValue3(block.text) ?? stringValue3(block.content) ?? "";
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
      toolRecords: [],
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
      toolRecords: current.toolRecords,
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
      const role = stringValue3(record.role);
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
        if (block.toolRecord === void 0) continue;
        turn.toolRecords.push({
          sourceFrameIndex: frame.frameIndex,
          blockIndex: block.blockIndex,
          ...block.toolRecord
        });
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

// src/shared/transcript/cursor-frames.ts
import { createHash as createHash2 } from "node:crypto";
import { open as open2 } from "node:fs/promises";
function isJsonObject4(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseClosedFrame(frameBytes) {
  if (frameBytes.length === 0) {
    return { parseState: "blank", record: null };
  }
  try {
    const value = JSON.parse(frameBytes.toString("utf8"));
    if (!isJsonObject4(value)) {
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
  const handle = await open2(transcriptPath, "r");
  try {
    const file = await handle.stat();
    const safePrefixHash = createHash2("sha256");
    const verifiedPrefixHash = options.verifyPrefixBytes === void 0 ? null : createHash2("sha256");
    let verifiedBytes = 0;
    let verifiedPrefixSha256 = options.verifyPrefixBytes === 0 ? createHash2("sha256").digest("hex") : null;
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

// src/skills/session-export-transcript/src/session-export-transcript.ts
var execFileAsync = promisify(execFile);
var VALID_RUNTIMES = ["claude-code", "codex", "cursor"];
var LOOKBACK_DAYS = 30;
var MARKER_LINE_RE = /EXPORT_SESSION_MARKER\s*=\s*\S+/;
var CODEX_ROLLOUT_FILENAME_PATTERN2 = /^rollout-.+-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/iu;
function codexFilenameSessionId(transcriptPath) {
  return CODEX_ROLLOUT_FILENAME_PATTERN2.exec(basename2(transcriptPath))?.[1];
}
function codexIdentityFields(meta) {
  return {
    ...meta?.nativeSessionId ? { nativeSessionId: meta.nativeSessionId } : {},
    ...meta?.rootSessionId ? { rootSessionId: meta.rootSessionId } : {},
    ...meta?.parentSessionId ? { parentSessionId: meta.parentSessionId } : {},
    ...meta?.forkedFromSessionId ? { forkedFromSessionId: meta.forkedFromSessionId } : {},
    ...meta?.subagentHistoryStartOrdinal === void 0 ? {} : {
      subagentHistoryStartOrdinal: meta.subagentHistoryStartOrdinal
    }
  };
}
function isCodexChild(candidate) {
  return candidate.runtime === "codex" && typeof candidate.nativeSessionId === "string" && (typeof candidate.parentSessionId === "string" || typeof candidate.rootSessionId === "string" && candidate.rootSessionId !== candidate.nativeSessionId);
}
function inheritedContextWarning(candidate) {
  if (!isCodexChild(candidate)) return null;
  const boundary = candidate.subagentHistoryStartOrdinal;
  return boundary === void 0 ? `Codex child session ${candidate.nativeSessionId} may include inherited parent context; ownership boundary is unknown.` : `Codex child session ${candidate.nativeSessionId} includes inherited parent context before ordinal ${boundary}.`;
}
function isRuntime(value) {
  return typeof value === "string" && VALID_RUNTIMES.includes(value);
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function errorStackOrMessage(error) {
  return error instanceof Error ? error.stack ?? error.message : String(error);
}
function parseCliArgs(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: false,
    options: {
      runtime: { type: "string", default: "auto" },
      match: { type: "string", default: void 0 },
      session: { type: "string", default: void 0 },
      all: { type: "boolean", default: false },
      "include-activity": { type: "boolean", default: false },
      cwd: { type: "string", default: process.cwd() },
      out: { type: "string", default: void 0 },
      help: { type: "boolean", default: false }
    }
  });
  return {
    runtime: typeof values.runtime === "string" ? values.runtime : "auto",
    match: typeof values.match === "string" ? values.match : void 0,
    session: typeof values.session === "string" ? values.session : void 0,
    all: values.all === true,
    includeActivity: values["include-activity"] === true,
    cwd: typeof values.cwd === "string" ? values.cwd : process.cwd(),
    out: typeof values.out === "string" ? values.out : positionals[0] ?? void 0,
    help: values.help === true
  };
}
var HELP = `session-export-transcript \u2014 export the current conversation to sanitized Markdown

Usage:
  node session-export-transcript.mjs [output-path] [flags]

Flags:
  --runtime <claude-code|codex|cursor|auto>  default: auto
  --match <marker>      select the current session by an announced marker
  --session <id>        export a specific session id
  --all                 export every session for the cwd (one file each)
  --include-activity    append bounded source-attributed tool activity
  --cwd <path>          project dir to match against (default: process.cwd())
  --out <path>          output file or directory (also accepted positionally)
  --help                this message

Exit codes: 0 ok \xB7 1 hard error \xB7 2 no candidates \xB7 3 ambiguous`;
function resolveRuntime(requested) {
  if (requested && requested !== "auto") {
    if (!isRuntime(requested)) {
      throw new Error(
        `Unknown runtime: ${requested}. Expected one of ${VALID_RUNTIMES.join(", ")}.`
      );
    }
    return requested;
  }
  const hint = process.env.EXPORT_SESSION_SELF ?? process.env.SESSION_OBSERVER_SELF;
  if (isRuntime(hint)) return hint;
  if (process.env.CLAUDECODE || process.env.CLAUDE_CODE) return "claude-code";
  if (process.env.CODEX_SANDBOX || process.env.CODEX_HOME) return "codex";
  if (process.env.CURSOR_TRACE_ID || process.env.CURSOR) return "cursor";
  return null;
}
async function collectJsonlFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = join2(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await collectJsonlFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      results.push(full);
    }
  }
  return results;
}
async function statCandidate(transcriptPath) {
  try {
    const s = await stat(transcriptPath);
    return { mtime: Math.floor(s.mtime.getTime() / 1e3), size: s.size };
  } catch {
    return null;
  }
}
async function enumerateClaudeCode(targetCwd) {
  const [root] = discoverPaths("claude-code");
  const variants = encodeCwdVariants("claude-code", targetCwd);
  const candidates = [];
  const seen = /* @__PURE__ */ new Set();
  for (const encoded of variants) {
    const dir = join2(root, encoded);
    let files;
    try {
      files = (await readdir(dir)).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }
    for (const file of files) {
      const p = join2(dir, file);
      if (seen.has(p)) continue;
      seen.add(p);
      const st = await statCandidate(p);
      if (!st) continue;
      let meta;
      try {
        meta = await extractMeta("claude-code", p);
      } catch {
        meta = null;
      }
      candidates.push({
        runtime: "claude-code",
        transcriptPath: p,
        sessionId: meta?.sessionId ?? basename2(p).replace(/\.jsonl$/u, ""),
        ...st
      });
    }
  }
  return candidates;
}
async function enumerateCodex(targetCwd, { requireCwd = false } = {}) {
  const [root] = discoverPaths("codex");
  const now = Date.now() / 1e3;
  const cutoff = now - LOOKBACK_DAYS * 86400;
  const files = await collectJsonlFiles(root);
  const candidates = [];
  for (const p of files) {
    const st = await statCandidate(p);
    if (!st) continue;
    if (st.mtime < cutoff) continue;
    let meta;
    try {
      meta = await extractMeta("codex", p);
    } catch {
      meta = null;
    }
    if (meta?.recordedCwd && meta.recordedCwd !== targetCwd) continue;
    if (requireCwd && !meta?.recordedCwd) continue;
    const filenameSessionId = codexFilenameSessionId(p);
    candidates.push({
      runtime: "codex",
      transcriptPath: p,
      sessionId: meta?.sessionId ?? filenameSessionId ?? basename2(p).replace(/\.jsonl$/u, ""),
      identityStatus: meta ? meta.nativeSessionId ? "native" : "legacy" : "invalid",
      ...filenameSessionId ? { filenameSessionId } : {},
      ...codexIdentityFields(meta),
      ...st
    });
  }
  return candidates;
}
async function enumerateCursor(targetCwd) {
  const [root] = discoverPaths("cursor");
  const variants = encodeCwdVariants("cursor", targetCwd);
  const candidates = [];
  const seen = /* @__PURE__ */ new Set();
  for (const encoded of variants) {
    const transcriptsRoot = join2(root, encoded, "agent-transcripts");
    let sessionDirs;
    try {
      sessionDirs = await readdir(transcriptsRoot, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const sd of sessionDirs) {
      if (!sd.isDirectory()) continue;
      const sessionPath = join2(transcriptsRoot, sd.name);
      let files;
      try {
        files = (await readdir(sessionPath)).filter(
          (f) => f.endsWith(".jsonl")
        );
      } catch {
        continue;
      }
      for (const file of files) {
        const p = join2(sessionPath, file);
        if (seen.has(p)) continue;
        seen.add(p);
        const st = await statCandidate(p);
        if (!st) continue;
        let meta;
        try {
          meta = await extractMeta("cursor", p);
        } catch {
          meta = null;
        }
        candidates.push({
          runtime: "cursor",
          transcriptPath: p,
          sessionId: meta?.sessionId ?? basename2(p).replace(/\.jsonl$/u, ""),
          ...st
        });
      }
    }
  }
  return candidates;
}
async function enumerateCandidates(runtime, targetCwd, { requireCwd = false } = {}) {
  if (runtime === "claude-code") return enumerateClaudeCode(targetCwd);
  if (runtime === "codex") return enumerateCodex(targetCwd, { requireCwd });
  if (runtime === "cursor") return enumerateCursor(targetCwd);
  throw new Error(`Unknown runtime: ${runtime}`);
}
async function candidateContainsMarker(transcriptPath, marker) {
  try {
    const raw = await readFile2(transcriptPath, "utf8");
    return raw.includes(marker);
  } catch {
    return false;
  }
}
function preferredNewest(candidates) {
  return [...candidates].toSorted(
    (a, b) => Number(isCodexChild(a)) - Number(isCodexChild(b)) || b.mtime - a.mtime
  )[0];
}
async function selectSessions(opts, candidates) {
  const warnings = [];
  if (opts.all) {
    for (const candidate of candidates) {
      const warning = inheritedContextWarning(candidate);
      if (warning) warnings.push(warning);
    }
    return { selected: candidates, warnings };
  }
  if (opts.session) {
    const invalid = candidates.filter(
      (candidate) => candidate.identityStatus === "invalid" && candidate.filenameSessionId === opts.session
    );
    if (invalid.length > 0) {
      return {
        exit: 1,
        message: `SESSION_IDENTITY_INVALID: recognized rollout source for "${opts.session}" contradicts or lacks a valid native header.`
      };
    }
    const matches = candidates.filter((c) => c.sessionId === opts.session);
    const canonical = /* @__PURE__ */ new Map();
    for (const candidate of matches) {
      let canonicalPath = candidate.transcriptPath;
      try {
        canonicalPath = await realpath(candidate.transcriptPath);
      } catch {
      }
      if (!canonical.has(canonicalPath)) {
        canonical.set(canonicalPath, {
          ...candidate,
          transcriptPath: canonicalPath
        });
      }
    }
    const distinct = [...canonical.values()];
    if (distinct.length > 1) {
      return {
        exit: 3,
        message: `SESSION_IDENTITY_AMBIGUOUS: multiple canonical transcripts claim "${opts.session}".
` + distinct.map((c) => `  - ${c.transcriptPath}`).join("\n")
      };
    }
    const hit = distinct[0];
    if (!hit) {
      return {
        exit: 2,
        message: `No transcript found for session id "${opts.session}" in this cwd.`
      };
    }
    const warning = inheritedContextWarning(hit);
    if (warning) warnings.push(warning);
    return { selected: [hit], warnings };
  }
  if (opts.match) {
    const markerMatches = [];
    for (const candidate of candidates) {
      if (await candidateContainsMarker(candidate.transcriptPath, opts.match)) {
        markerMatches.push(candidate);
      }
    }
    const markerMatch = preferredNewest(markerMatches);
    if (markerMatch) {
      const warning2 = inheritedContextWarning(markerMatch);
      if (warning2) warnings.push(warning2);
      return { selected: [markerMatch], warnings };
    }
    const fallback = preferredNewest(candidates);
    if (!fallback) {
      return {
        exit: 2,
        message: `No transcript found for marker "${opts.match}" in this cwd.`
      };
    }
    warnings.push(
      `marker "${opts.match}" not found in any candidate; falling back to newest-for-cwd transcript (${fallback.sessionId}). Re-run with --session <id> if this is the wrong session.`
    );
    const warning = inheritedContextWarning(fallback);
    if (warning) warnings.push(warning);
    return { selected: [fallback], warnings };
  }
  if (candidates.length === 1) {
    const warning = inheritedContextWarning(candidates[0]);
    if (warning) warnings.push(warning);
    return { selected: [candidates[0]], warnings };
  }
  return {
    exit: 3,
    message: `Multiple candidate sessions for this cwd and no --match/--session/--all.
` + candidates.map((c) => `  - ${c.sessionId} (${c.transcriptPath})`).join("\n") + `
Re-run with --match <marker>, --session <id>, or --all.`
  };
}
async function gitBranch(cwd) {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", cwd, "symbolic-ref", "--short", "HEAD"],
      {
        timeout: 5e3
      }
    );
    const branch = stdout.trim();
    return branch || null;
  } catch {
    return null;
  }
}
function utcStamp() {
  return (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
}
function sanitizeBranchForFilename(branch) {
  return branch.replace(/\//g, "-");
}
async function isDirectory(p) {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}
async function resolveOutputPath(opts, branch, session, multi) {
  const base = branch ? sanitizeBranchForFilename(branch) : `${basename2(opts.cwd)}-${utcStamp()}`;
  const fileName = multi ? `${base}-${session.sessionId}.md` : `${base}.md`;
  if (opts.out) {
    if (opts.out.endsWith("/") || await isDirectory(opts.out)) {
      return join2(opts.out, fileName);
    }
    if (multi) return join2(opts.out, fileName);
    return opts.out;
  }
  return join2(homedir2(), "Downloads", fileName);
}
var SANITIZE_NOTE = "Note: Only visible conversation. Ordinary tool calls, tool outputs, developer/system instructions, environment/AGENTS.md/skill payloads, and subagent notifications are excluded. Ask-user exchanges \u2014 the questions put to you and any answers the runtime recorded \u2014 are preserved as visible conversation.";
function stripMarkerAndEmpty(entries) {
  const out = [];
  for (const entry of entries) {
    let text = entry.text ?? "";
    text = text.split(/\r?\n/).filter((line) => !MARKER_LINE_RE.test(line)).join("\n").trim();
    if (!text) continue;
    out.push({ ...entry, text });
  }
  return out;
}
function renderMarkdown({
  branch,
  source,
  runtime,
  entries,
  branchFromGit,
  session,
  activity
}) {
  const lines = [];
  const title = branchFromGit ? branch : `${branch} (no git branch)`;
  lines.push(`# Conversation History: ${title}`);
  lines.push("");
  lines.push(`Exported: ${(/* @__PURE__ */ new Date()).toISOString()}`);
  lines.push(`Source: ${source}`);
  lines.push(`Runtime: ${runtime}`);
  lines.push(`Session: ${session.sessionId}`);
  if (session.nativeSessionId)
    lines.push(`Native session: ${session.nativeSessionId}`);
  if (session.rootSessionId)
    lines.push(`Root session: ${session.rootSessionId}`);
  if (session.parentSessionId)
    lines.push(`Parent session: ${session.parentSessionId}`);
  if (session.forkedFromSessionId)
    lines.push(`Forked from: ${session.forkedFromSessionId}`);
  const warning = inheritedContextWarning(session);
  if (warning) lines.push(`Warning: ${warning}`);
  lines.push(SANITIZE_NOTE);
  if (activity) {
    lines.push(
      "Activity export: Sensitive activity/debug data is included below as recorded data. Tool inputs, outputs, paths, and identifiers may be present in bounded previews; external output files and child trajectories are not read."
    );
  }
  lines.push("");
  if (entries.length === 0) {
    lines.push("*No visible messages.*");
    lines.push("");
  } else {
    let i = 0;
    while (i < entries.length) {
      const role = entries[i].role;
      const header = role === "user" ? "## User" : "## Assistant";
      lines.push(header);
      lines.push("");
      while (i < entries.length && entries[i].role === role) {
        lines.push(entries[i].text);
        lines.push("");
        i++;
      }
    }
  }
  if (activity) lines.push(renderActivityMarkdown(activity));
  return lines.join("\n");
}
function unavailableActivityReport(source, sourceBytes, capturedAt, deliveryRange) {
  return projectActivity(
    {
      activitySchemaVersion: 1,
      source,
      sourceSnapshot: { capturedAt, sourceBytes },
      events: [],
      coverage: [
        {
          dataClass: "record-activity",
          status: "not-read",
          captured: 0
        }
      ],
      diagnostics: [
        {
          code: "ACTIVITY_EXTRACTION_ERROR",
          locator: { physicalLine: 1, jsonPointer: "" }
        }
      ],
      correlationCounts: {
        responseStreamCalls: {
          captured: 0,
          counted: 0,
          owned: 0,
          inherited: 0,
          unknown: 0
        },
        results: { matched: 0, unmatched: 0 },
        itemEvidence: { linked: 0, standalone: 0 }
      }
    },
    {
      mode: "export",
      renderFormat: "markdown",
      deliveryRange: {
        ...deliveryRange
      }
    }
  );
}
async function exportSession(opts, runtime, branch, branchFromGit, session, multi) {
  const cursorCapture = opts.includeActivity && runtime === "cursor" ? await (async () => {
    const capturedAt = (/* @__PURE__ */ new Date()).toISOString();
    const accumulator = createCursorTurnAccumulator(
      {
        runtime: "cursor",
        projectCwd: opts.cwd,
        sessionId: session.sessionId,
        canonicalTranscriptPath: session.transcriptPath
      },
      0
    );
    const records2 = [];
    const scan = await scanCursorTranscript(session.transcriptPath, {
      onFrame(frame) {
        accumulator.onFrame(frame);
        if (frame.parseState === "parsed" && frame.record !== null) {
          records2.push(frame.record);
        }
      }
    });
    return {
      capturedAt,
      scan,
      analysis: accumulator.finish(scan),
      records: records2
    };
  })() : void 0;
  const capturedRead = opts.includeActivity && runtime !== "cursor" ? await readRecordsDetailed(session.transcriptPath) : void 0;
  const records = cursorCapture ? cursorCapture.records : capturedRead ? capturedRead.records.map(({ record }) => record) : await readRecords(session.transcriptPath);
  const normalized = normalizeEntries(runtime, records, {});
  const sanitized = sanitizeEntries(normalized, { runtime });
  const entries = stripMarkerAndEmpty(sanitized);
  let activity;
  if (opts.includeActivity && cursorCapture && runtime === "cursor") {
    const source = {
      runtime: "cursor",
      sessionId: session.sessionId,
      nativeSessionId: session.sessionId,
      transcriptPath: session.transcriptPath
    };
    const deliveryRange = {
      indexBase: "zero-based-jsonl-frame-index",
      start: 0,
      end: cursorCapture.scan.totalFrames
    };
    try {
      activity = projectActivity(
        correlateActivity(
          extractCursorActivity({
            source,
            scan: cursorCapture.scan,
            analysis: cursorCapture.analysis,
            capturedAt: cursorCapture.capturedAt,
            mode: "stateless-snapshot"
          })
        ),
        {
          mode: "export",
          renderFormat: "markdown",
          deliveryRange
        }
      );
    } catch {
      activity = unavailableActivityReport(
        source,
        cursorCapture.scan.file.size,
        cursorCapture.capturedAt,
        deliveryRange
      );
    }
  } else if (opts.includeActivity && capturedRead) {
    const identity = extractMetaFromRecords(
      runtime,
      records,
      session.transcriptPath
    );
    const source = {
      runtime,
      sessionId: session.sessionId,
      nativeSessionId: identity?.nativeSessionId ?? session.nativeSessionId ?? session.sessionId,
      transcriptPath: session.transcriptPath
    };
    try {
      activity = projectActivity(
        correlateActivity(extractActivity({ source, read: capturedRead })),
        {
          mode: "export",
          renderFormat: "markdown",
          deliveryRange: {
            indexBase: "zero-based-decoded-record-index",
            start: 0,
            end: records.length
          }
        }
      );
    } catch {
      activity = unavailableActivityReport(
        source,
        capturedRead.sourceBytes,
        capturedRead.capturedAt,
        {
          indexBase: "zero-based-decoded-record-index",
          start: 0,
          end: records.length
        }
      );
    }
  }
  const md = renderMarkdown({
    branch: branch ?? basename2(opts.cwd),
    branchFromGit,
    source: session.transcriptPath,
    runtime,
    session,
    entries,
    activity
  });
  const outPath = await resolveOutputPath(opts, branch, session, multi);
  await mkdir(dirname2(outPath), { recursive: true });
  await writeFile(outPath, md, "utf8");
  return outPath;
}
async function main() {
  const opts = parseCliArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(HELP);
    return 0;
  }
  let runtime;
  try {
    runtime = resolveRuntime(opts.runtime);
  } catch (err) {
    console.error(`[session-export-transcript] ${errorMessage(err)}`);
    return 1;
  }
  if (!runtime) {
    console.error(
      "[session-export-transcript] Could not resolve runtime. Pass --runtime <claude-code|codex|cursor>."
    );
    return 1;
  }
  const requireCwd = !opts.match && !opts.session;
  let candidates;
  try {
    candidates = await enumerateCandidates(runtime, opts.cwd, { requireCwd });
  } catch (err) {
    console.error(`[session-export-transcript] ${errorMessage(err)}`);
    return 1;
  }
  if (candidates.length === 0) {
    const [root] = discoverPaths(runtime);
    console.error(
      `[session-export-transcript] No ${runtime} transcripts found for cwd ${opts.cwd}.
Looked under: ${root}
Try --cwd <path> or confirm ${runtime} has run in this project.`
    );
    return 2;
  }
  const selection = await selectSessions(opts, candidates);
  if ("exit" in selection) {
    console.error(`[session-export-transcript] ${selection.message}`);
    return selection.exit;
  }
  const invalidSelected = selection.selected.filter(
    (candidate) => candidate.identityStatus === "invalid"
  );
  if (invalidSelected.length > 0) {
    console.error(
      "[session-export-transcript] SESSION_IDENTITY_INVALID: selected Codex transcript source contradicts or lacks a valid native header.\n" + invalidSelected.map((candidate) => `  - ${candidate.transcriptPath}`).join("\n")
    );
    return 1;
  }
  for (const warning of selection.warnings) {
    console.error(`[session-export-transcript] warning: ${warning}`);
  }
  const branch = await gitBranch(opts.cwd);
  const branchFromGit = branch !== null;
  const multi = opts.all;
  const written = [];
  try {
    for (const session of selection.selected) {
      written.push(
        await exportSession(
          opts,
          runtime,
          branch,
          branchFromGit,
          session,
          multi
        )
      );
    }
  } catch (err) {
    console.error(
      `[session-export-transcript] Failed to write output: ${errorMessage(err)}`
    );
    return 1;
  }
  for (const p of written) {
    console.log(`[session-export-transcript] wrote ${p}`);
  }
  return 0;
}
main().then((code) => {
  process.exit(code ?? 0);
}).catch((err) => {
  console.error(`[session-export-transcript] ${errorStackOrMessage(err)}`);
  process.exit(1);
});
