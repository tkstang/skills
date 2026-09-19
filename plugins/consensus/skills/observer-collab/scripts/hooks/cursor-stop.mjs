#!/usr/bin/env node
// GENERATED skill payload for session-observer-collab.

// src/skills/session-observer-collab/src/hooks/cursor-stop.mjs
import { readFile as readFile3 } from "node:fs/promises";

// src/skills/session-observer/src/lib/digest.ts
import { createHash as createHash2 } from "node:crypto";

// src/shared/transcript/cursor-analysis.ts
import { createHash } from "node:crypto";

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

// src/shared/transcript/cursor-analysis.ts
function cursorRenderTurnId(turn, sourceFrameIndex) {
  const humanFrameIndex = turn.humanRecordIndexes.findLast(
    (frameIndex) => frameIndex <= sourceFrameIndex
  );
  return `${turn.turnId}:render:${humanFrameIndex ?? turn.fromFrameIndex}`;
}
function isJsonObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function stringValue(value) {
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
  if (!isJsonObject(record.message)) {
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
    if (!isJsonObject(block)) {
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

// src/skills/session-observer/src/lib/digest.ts
var SCHEMA_VERSION = 1;
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
    if (retained.has(entry) || entry.role !== "user" || entry.origin === "automatic-control" || entry.origin === "runtime-notification" || seenRecordIndexes.has(recoveryRecordIndex)) {
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
  return createHash2("sha256").update(text).digest("hex");
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
  const identity = opts.identity ?? extractMetaFromRecords(runtime, records, transcriptPath);
  let sessionId = opts.sessionId ?? identity?.sessionId;
  const recordedCwd = opts.recordedCwd ?? identity?.recordedCwd ?? null;
  sessionId ??= "unknown";
  if (runtime === "codex" && identity?.nativeSessionId && (identity.parentSessionId || identity.rootSessionId && identity.nativeSessionId !== identity.rootSessionId)) {
    const boundary = identity.subagentHistoryStartOrdinal;
    const warning = boundary === void 0 ? `Codex child session ${identity.nativeSessionId} may include inherited parent context; ownership boundary is unknown.` : `Codex child session ${identity.nativeSessionId} includes inherited parent context before ordinal ${boundary}.`;
    if (!warnings.includes(warning)) warnings.push(warning);
  }
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
    schemaVersion: SCHEMA_VERSION,
    runtime,
    sessionId,
    ...identity?.nativeSessionId ? { nativeSessionId: identity.nativeSessionId } : {},
    ...identity?.rootSessionId ? { rootSessionId: identity.rootSessionId } : {},
    ...identity?.parentSessionId ? { parentSessionId: identity.parentSessionId } : {},
    ...identity?.forkedFromSessionId ? { forkedFromSessionId: identity.forkedFromSessionId } : {},
    ...identity?.subagentHistoryStartOrdinal === void 0 ? {} : {
      subagentHistoryStartOrdinal: identity.subagentHistoryStartOrdinal
    },
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

// src/skills/session-observer-collab/src/lib/completion-selection.mjs
var RECORD_INDEX_BASE = "zero-based-jsonl-record-index";
var FRAME_INDEX_BASE = "zero-based-jsonl-frame-index";
var NO_OP_PREFIX2 = /^\s*\[no-op\](?:\s|$)/iu;
var ACKNOWLEDGMENT = /^\s*(?:ack(?:nowledged)?|got it|understood|noted|received|ok(?:ay)?|thanks|thank you)[.!]*\s*$/iu;
var STATUS_ECHO = /^\s*(?:status:\s*)?(?:(?:still\s+)?(?:waiting|holding|idle|armed|monitoring)(?:\s+(?:for|on|until)\s+[^.!?;:]+)?|no (?:new )?(?:input|updates?|messages?|changes?))[.!]*\s*$/iu;
function integer(value, label) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new TypeError(`${label} must be a non-negative safe integer`);
  return value;
}
function requireObserverResult(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new TypeError("observer result must be an object");
  if (!Array.isArray(input.entries))
    throw new TypeError("observer result entries must be an array");
  return input;
}
function validateV1Digest(input) {
  const range = input.range;
  const raw = input.accounting?.raw;
  if (!range || range.indexBase !== RECORD_INDEX_BASE || input.accounting?.indexBase !== RECORD_INDEX_BASE || !raw) {
    throw new TypeError("observer result must include raw range accounting");
  }
  const fromIndex = integer(range.fromIndex, "range.fromIndex");
  const nextIndex = integer(range.nextIndex, "range.nextIndex");
  const totalRecords = integer(range.totalRecords, "range.totalRecords");
  if (nextIndex !== totalRecords || raw.fromIndex !== fromIndex || raw.nextIndex !== nextIndex || raw.totalRecords !== totalRecords || raw.count !== Math.max(0, nextIndex - fromIndex) || range.newRecords !== raw.count) {
    throw new TypeError("observer range and accounting must agree exactly");
  }
  if (input.accounting.rendered?.count !== input.entries.length || input.accounting.filtered?.tailSliceEntries > 0 || input.accounting.autoLargeDigest) {
    throw new TypeError(
      "observer result must contain the complete normalized range"
    );
  }
  const entries = input.entries.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new TypeError(`entries[${index}] must be an object`);
    integer(entry.recordIndex, `entries[${index}].recordIndex`);
    if (entry.recordIndex < fromIndex || entry.recordIndex >= nextIndex || entry.role !== "user" && entry.role !== "assistant" || typeof entry.text !== "string" || typeof entry.kind !== "string") {
      throw new TypeError(
        `entries[${index}] is outside the normalized contract`
      );
    }
    return entry;
  });
  entries.sort((left, right) => left.recordIndex - right.recordIndex);
  return {
    entries,
    fromIndex,
    indexBase: RECORD_INDEX_BASE,
    nextIndex,
    selectedPrefix: null
  };
}
function nullableIndex(value, label) {
  if (value === null) return null;
  return integer(value, label);
}
function validateSelectedPrefix(value, selectedNextIndex) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.indexBase !== FRAME_INDEX_BASE || integer(value.nextFrameIndex, "selectedPrefix.nextFrameIndex") !== selectedNextIndex || !Number.isSafeInteger(value.prefixBytes) || value.prefixBytes < 0 || value.observedSize !== value.prefixBytes || !/^[a-f0-9]{64}$/u.test(value.prefixSha256) || !Number.isSafeInteger(value.device) || value.device < 0 || !Number.isSafeInteger(value.inode) || value.inode < 0) {
    throw new TypeError(
      "observer result must bind the selected Cursor prefix snapshot"
    );
  }
  return Object.freeze({ ...value });
}
function validateV2Digest(input) {
  if (input.runtime !== "cursor") {
    throw new TypeError("observer result schemaVersion 2 must use Cursor");
  }
  if (input.cursorEvidence?.projection !== "confirmed-completion") {
    throw new TypeError(
      "observer result schemaVersion 2 must use confirmed-completion projection"
    );
  }
  const range = input.range;
  const accounting = input.accounting;
  const raw = accounting?.raw;
  if (!range || range.indexBase !== FRAME_INDEX_BASE || accounting?.indexBase !== FRAME_INDEX_BASE || !raw) {
    throw new TypeError(
      "observer result schemaVersion 2 must use the frame index base"
    );
  }
  const fromIndex = integer(range.fromIndex, "range.fromIndex");
  const nextIndex = integer(range.nextIndex, "range.nextIndex");
  const totalFrames = integer(range.totalFrames, "range.totalFrames");
  const rawCount = Math.max(0, nextIndex - fromIndex);
  const expectedToIndex = rawCount > 0 ? nextIndex - 1 : null;
  if (fromIndex > nextIndex || nextIndex > totalFrames || nullableIndex(range.toIndex, "range.toIndex") !== expectedToIndex || range.newFrames !== rawCount || raw.fromIndex !== fromIndex || raw.toIndex !== expectedToIndex || raw.count !== rawCount || raw.nextIndex !== nextIndex || raw.totalFrames !== totalFrames) {
    throw new TypeError(
      "observer result must contain complete frame range accounting"
    );
  }
  const rendered = accounting.rendered;
  const buffered = accounting.buffered;
  const bufferedCount = totalFrames - nextIndex;
  const hasPendingSuffix = bufferedCount > 0;
  const completeBufferedSuffix = buffered && (hasPendingSuffix ? buffered.fromIndex === nextIndex && buffered.count === bufferedCount && buffered.reason === "stability-wait" && input.cursorEvidence.bufferedFromFrame === nextIndex && input.cursorEvidence.status?.lifecycle === "pending" : buffered.fromIndex === null && buffered.count === 0 && buffered.reason === null && input.cursorEvidence.bufferedFromFrame === null);
  if (!rendered || rendered.count !== input.entries.length || !buffered || !completeBufferedSuffix || accounting.filtered?.unstableContent !== 0 || input.cursorEvidence.blockingFrame !== null || input.cursorEvidence.status?.health !== "healthy") {
    throw new TypeError(
      "observer result must contain the complete confirmed-completion range"
    );
  }
  const lifecycleEvents = input.cursorEvidence.lifecycleEvents;
  if (!Array.isArray(lifecycleEvents)) {
    throw new TypeError(
      "observer result must include confirmed completion lifecycle events"
    );
  }
  const entries = input.entries.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new TypeError(`entries[${index}] must be an object`);
    }
    const deliveryIndex = integer(
      entry.recordIndex,
      `entries[${index}].recordIndex`
    );
    const sourceFrameIndex = integer(
      entry.sourceFrameIndex,
      `entries[${index}].sourceFrameIndex`
    );
    const matchingLifecycle = lifecycleEvents.some(
      (event) => event?.turnId === entry.turnId && event.terminalFrameIndex === deliveryIndex && event.lifecycle === "success" && event.finalEntryKey === entry.entryKey
    );
    if (deliveryIndex < fromIndex || deliveryIndex >= nextIndex || sourceFrameIndex < fromIndex || sourceFrameIndex > deliveryIndex || entry.role !== "assistant" || entry.kind !== "message" || typeof entry.text !== "string" || typeof entry.entryKey !== "string" || entry.entryKey.length === 0 || typeof entry.turnId !== "string" || entry.turnId.length === 0 || entry.availability !== "completed" || !matchingLifecycle) {
      throw new TypeError(
        `entries[${index}] is outside the confirmed-completion contract`
      );
    }
    return entry;
  });
  entries.sort((left, right) => left.recordIndex - right.recordIndex);
  const renderedFromIndex = entries.length > 0 ? entries[0].recordIndex : null;
  const renderedToIndex = entries.length > 0 ? entries.at(-1).recordIndex : null;
  if (range.renderedFromIndex !== renderedFromIndex || range.renderedToIndex !== renderedToIndex || rendered.fromIndex !== renderedFromIndex || rendered.toIndex !== renderedToIndex) {
    throw new TypeError(
      "observer result must contain complete rendered frame accounting"
    );
  }
  return {
    entries,
    fromIndex,
    indexBase: FRAME_INDEX_BASE,
    nextIndex,
    selectedPrefix: validateSelectedPrefix(
      input.cursorEvidence.selectedPrefix,
      entries.at(-1)?.recordIndex + 1 || nextIndex
    )
  };
}
function validateDigest(input) {
  const result = requireObserverResult(input);
  if (result.schemaVersion === 1) return validateV1Digest(result);
  if (result.schemaVersion === 2) return validateV2Digest(result);
  throw new TypeError("observer result schemaVersion must be 1 or 2");
}
function isAutomatic(entry) {
  return entry.origin === "automatic-control" || entry.displayRole === "automatic-control" || entry.automaticControl?.automatic === true;
}
function isRuntimeNotification(entry) {
  return entry.origin === "runtime-notification" || entry.displayRole === "runtime-notification";
}
function completedTurns(entries, fromIndex) {
  const turns = [];
  let start = fromIndex;
  let current = [];
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    current.push(entry);
    if (entry.role !== "assistant" || entry.kind !== "message" || entry.origin === "runtime-diagnostic") {
      continue;
    }
    const next = entries[index + 1];
    if (next?.role === "assistant" && next.kind === "message" && next.origin !== "runtime-diagnostic") {
      continue;
    }
    const assistantEntries = current.filter(
      (candidate) => candidate.role === "assistant" && candidate.kind === "message" && candidate.origin !== "runtime-diagnostic" && !isAutomatic(candidate)
    );
    const text = assistantEntries.map((candidate) => candidate.text).join("\n");
    const automaticWake = current.some(isAutomatic);
    const classification = text.trim().length === 0 ? "empty-turn" : NO_OP_PREFIX2.test(text) ? "no-op-turn" : automaticWake && (ACKNOWLEDGMENT.test(text) || STATUS_ECHO.test(text)) ? "automatic-control-turn" : "substantive-turn";
    turns.push({
      fromIndex: start,
      toIndex: entry.recordIndex,
      classification
    });
    start = entry.recordIndex + 1;
    current = [];
  }
  const incompleteFrom = current.some(
    (entry) => entry.role === "user" && !isAutomatic(entry) && !isRuntimeNotification(entry)
  ) ? start : null;
  return { turns, incompleteFrom };
}
function mergeSkipped(turns, fromIndex, nextIndex) {
  const skipped = [];
  let cursor = fromIndex;
  for (const turn of turns) {
    if (turn.fromIndex > cursor) {
      skipped.push({
        fromIndex: cursor,
        toIndex: turn.fromIndex - 1,
        classification: "metadata-only"
      });
    }
    skipped.push(turn);
    cursor = turn.toIndex + 1;
  }
  if (cursor < nextIndex) {
    skipped.push({
      fromIndex: cursor,
      toIndex: nextIndex - 1,
      classification: "metadata-only"
    });
  }
  return skipped;
}
function selectCompletedContinuation(observerResult) {
  const { entries, fromIndex, indexBase, nextIndex, selectedPrefix } = validateDigest(observerResult);
  if (indexBase === FRAME_INDEX_BASE) {
    const selected2 = entries.at(-1);
    if (!selected2) {
      return Object.freeze({
        status: "no-continuation",
        continuation: false,
        indexBase,
        fromIndex,
        completedIndex: null,
        completedRecord: null,
        nextCursor: nextIndex,
        peerCursor: nextIndex,
        budgetCost: 0,
        range: null,
        reviewEntries: Object.freeze([]),
        skipped: Object.freeze(mergeSkipped([], fromIndex, nextIndex)),
        selectedPrefix
      });
    }
    const completedIndex = selected2.recordIndex;
    const cursor2 = completedIndex + 1;
    return Object.freeze({
      status: "continuation",
      continuation: true,
      indexBase,
      fromIndex,
      completedIndex,
      completedRecord: completedIndex,
      nextCursor: cursor2,
      peerCursor: cursor2,
      budgetCost: 1,
      range: Object.freeze({
        indexBase,
        fromIndex,
        toIndex: completedIndex
      }),
      reviewEntries: Object.freeze(
        entries.filter((entry) => entry.recordIndex <= completedIndex)
      ),
      skipped: Object.freeze([]),
      selectedPrefix
    });
  }
  const { turns, incompleteFrom } = completedTurns(entries, fromIndex);
  const selected = turns.findLast(
    (turn) => turn.classification === "substantive-turn"
  );
  if (!selected) {
    const safeCursor = incompleteFrom ?? nextIndex;
    return Object.freeze({
      status: "no-continuation",
      continuation: false,
      indexBase,
      fromIndex,
      completedIndex: null,
      completedRecord: null,
      nextCursor: safeCursor,
      peerCursor: safeCursor,
      budgetCost: 0,
      range: null,
      reviewEntries: Object.freeze([]),
      skipped: Object.freeze(mergeSkipped(turns, fromIndex, safeCursor)),
      selectedPrefix
    });
  }
  const completedRecord = selected.toIndex;
  const cursor = completedRecord + 1;
  return Object.freeze({
    status: "continuation",
    continuation: true,
    indexBase,
    fromIndex,
    completedIndex: completedRecord,
    completedRecord,
    nextCursor: cursor,
    peerCursor: cursor,
    budgetCost: 1,
    range: Object.freeze({
      indexBase,
      fromIndex,
      toIndex: completedRecord
    }),
    reviewEntries: Object.freeze(
      entries.filter((entry) => entry.recordIndex <= completedRecord)
    ),
    skipped: Object.freeze([]),
    selectedPrefix
  });
}

// src/skills/session-observer-collab/src/lib/lease-state.mjs
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  chmod,
  lstat,
  mkdir,
  open as open2,
  readFile as readFile2,
  readdir,
  realpath,
  rename,
  rm
} from "node:fs/promises";
import { homedir as homedir2 } from "node:os";
import { basename as basename2, dirname as dirname2, isAbsolute as isAbsolute2, join as join2, resolve, sep } from "node:path";
var LEASE_SCHEMA_VERSION = 6;
var LEASE_STATES = Object.freeze([
  "armed",
  "waiting",
  "idle",
  "triggered",
  "disarmed"
]);
var MAX_WAIT_MS = 6e4;
var MAX_LEASE_MS = 24 * 60 * 60 * 1e3;
var MAX_CONTINUATIONS = 100;
var MAX_LOOPS = 1e3;
var ID = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,127})$/;
var OWNER_RUNTIMES = /* @__PURE__ */ new Set(["codex", "cursor"]);
var PEER_RUNTIMES = /* @__PURE__ */ new Set(["claude-code", "codex", "cursor"]);
var RECORD_INDEX_BASE2 = "zero-based-jsonl-record-index";
var FRAME_INDEX_BASE2 = "zero-based-jsonl-frame-index";
var CURSOR_TRANSCRIPT_STORE = "agent-transcripts";
var LeaseError = class extends Error {
  constructor(code, message) {
    super(message);
    this.name = "LeaseError";
    this.code = code;
  }
};
function stateRoot(env = process.env) {
  if (env.SESSION_OBSERVER_STATE_DIR) {
    if (!isAbsolute2(env.SESSION_OBSERVER_STATE_DIR))
      throw new LeaseError(
        "invalid-state-root",
        "SESSION_OBSERVER_STATE_DIR must be absolute"
      );
    return resolve(env.SESSION_OBSERVER_STATE_DIR);
  }
  const base = env.XDG_STATE_HOME || join2(env.HOME || homedir2(), ".local", "state");
  if (!isAbsolute2(base))
    throw new LeaseError(
      "invalid-state-root",
      "XDG_STATE_HOME must be absolute"
    );
  return join2(resolve(base), "session-observer", "collab");
}
function validateId(value, label = "session") {
  if (typeof value !== "string" || !ID.test(value) || value === "." || value === "..") {
    throw new LeaseError(
      `invalid-${label}`,
      `${label} must be a safe non-empty identifier`
    );
  }
  return value;
}
function validateOwnerRuntime(value) {
  if (!OWNER_RUNTIMES.has(value))
    throw new LeaseError(
      "invalid-owner-runtime",
      "owner runtime must be codex or cursor"
    );
  return value;
}
function validatePeerRuntime(value) {
  if (!PEER_RUNTIMES.has(value))
    throw new LeaseError(
      "invalid-peer-runtime",
      "peer runtime must be claude-code, codex, or cursor"
    );
  return value;
}
function validateAbsolutePath(value, label) {
  if (typeof value !== "string" || !isAbsolute2(value) || value.includes("\0")) {
    throw new LeaseError(
      `invalid-${label}`,
      `${label} must be an absolute path`
    );
  }
  return resolve(value);
}
function peerIndexBase(peerRuntime) {
  validatePeerRuntime(peerRuntime);
  return peerRuntime === "cursor" ? FRAME_INDEX_BASE2 : RECORD_INDEX_BASE2;
}
function validatePeerIndexBase(value, peerRuntime) {
  const expected = peerIndexBase(peerRuntime);
  if (value !== expected) {
    throw new LeaseError(
      "invalid-peer-index-base",
      `${peerRuntime} peer index base must be ${expected}`
    );
  }
  return value;
}
function cursorTranscriptStore(transcriptPath) {
  let current = dirname2(transcriptPath);
  while (dirname2(current) !== current) {
    if (basename2(current) === CURSOR_TRANSCRIPT_STORE) {
      const projectsRoot = dirname2(dirname2(current));
      const cursorRoot = dirname2(projectsRoot);
      if (basename2(projectsRoot) !== "projects" || basename2(cursorRoot) !== ".cursor") {
        throw new LeaseError(
          "unsupported-peer-transcript-store",
          "Cursor peer transcript must use the supported .cursor/projects store"
        );
      }
      return current;
    }
    current = dirname2(current);
  }
  throw new LeaseError(
    "unsupported-peer-transcript-store",
    "Cursor peer transcript must be inside a supported agent-transcripts store"
  );
}
async function canonicalizePeerTranscript(peerRuntime, peerTranscript) {
  validatePeerRuntime(peerRuntime);
  const requested = validateAbsolutePath(peerTranscript, "peer-transcript");
  let canonicalTranscript;
  try {
    canonicalTranscript = await realpath(requested);
  } catch (error) {
    throw new LeaseError(
      "peer-transcript-unavailable",
      `peer transcript cannot be canonicalized: ${error.message}`
    );
  }
  if (peerRuntime === "cursor") {
    const requestedStore = cursorTranscriptStore(requested);
    let canonicalStore;
    try {
      canonicalStore = await realpath(requestedStore);
    } catch (error) {
      throw new LeaseError(
        "unsupported-peer-transcript-store",
        `Cursor transcript store cannot be canonicalized: ${error.message}`
      );
    }
    if (!canonicalTranscript.startsWith(`${canonicalStore}${sep}`)) {
      throw new LeaseError(
        "peer-transcript-outside-store",
        "canonical Cursor peer transcript escapes its supported store"
      );
    }
  }
  return Object.freeze({
    peerTranscript: canonicalTranscript,
    peerCanonicalTranscriptPath: canonicalTranscript,
    peerIndexBase: peerIndexBase(peerRuntime)
  });
}
function leasePath(root, ownerSession) {
  validateId(ownerSession, "owner-session");
  const leases = join2(resolve(root), "leases");
  const candidate = join2(leases, `${ownerSession}.json`);
  if (!candidate.startsWith(`${leases}${sep}`))
    throw new LeaseError("invalid-owner-session", "unsafe lease path");
  return candidate;
}
function integer2(value, name, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new LeaseError(
      "malformed-lease",
      `${name} must be an integer from ${min} to ${max}`
    );
  }
  return value;
}
function timestamp(value, name) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new LeaseError("malformed-lease", `${name} must be an ISO timestamp`);
  }
  return new Date(value).toISOString();
}
function migrateLease(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new LeaseError("malformed-lease", "lease must be an object");
  if (input.schemaVersion === 1) {
    input = {
      ...input,
      schemaVersion: 2,
      continuationCount: input.triggerCount ?? input.continuationCount ?? 0,
      continuationCap: input.triggerCap ?? input.continuationCap ?? 1,
      loopCount: input.loopCount ?? 0,
      loopCap: input.loopCap ?? 1,
      diagnostic: input.diagnostic ?? null
    };
    delete input.triggerCount;
    delete input.triggerCap;
  }
  if (input.schemaVersion === 2) {
    if (input.peerRuntime === void 0) {
      throw new LeaseError(
        "peer-runtime-rearm-required",
        "legacy lease is missing peerRuntime; re-arm required"
      );
    }
    input = {
      ...input,
      schemaVersion: 3,
      leaseMs: input.leaseMs ?? Date.parse(input.expiresAt) - Date.parse(input.armedAt)
    };
  }
  if (input.schemaVersion === 3) {
    if (input.peerRuntime === void 0) {
      throw new LeaseError(
        "peer-runtime-rearm-required",
        "legacy lease is missing peerRuntime; re-arm required"
      );
    }
    input = {
      ...input,
      schemaVersion: 4,
      waitStartedAt: input.waitStartedAt ?? null,
      waitDeadlineAt: input.waitDeadlineAt ?? null
    };
  }
  if (input.schemaVersion === 4) {
    input = {
      ...input,
      schemaVersion: 5,
      waitToken: null,
      waitPid: null
    };
  }
  if (input.schemaVersion === 5) {
    if (input.peerRuntime === "cursor") {
      throw new LeaseError(
        "cursor-lease-rearm-required",
        "legacy Cursor lease uses an unverified record cursor; explicit re-arm required"
      );
    }
    input = {
      ...input,
      schemaVersion: 6,
      peerTranscript: validateAbsolutePath(
        input.peerTranscript,
        "peer-transcript"
      ),
      peerCanonicalTranscriptPath: validateAbsolutePath(
        input.peerTranscript,
        "peer-transcript"
      ),
      peerIndexBase: RECORD_INDEX_BASE2,
      peerContinuity: null
    };
  }
  if (input.schemaVersion !== LEASE_SCHEMA_VERSION) {
    throw new LeaseError(
      "unsupported-schema",
      `unsupported lease schema: ${String(input.schemaVersion)}`
    );
  }
  return input;
}
function validateLease(raw) {
  const value = migrateLease(structuredClone(raw));
  validateId(value.leaseId, "lease-id");
  validateOwnerRuntime(value.runtime);
  validatePeerRuntime(value.peerRuntime);
  validateId(value.ownerSession, "owner-session");
  validateId(value.peerSession, "peer-session");
  value.ownerCwd = validateAbsolutePath(value.ownerCwd, "owner-cwd");
  value.peerTranscript = validateAbsolutePath(
    value.peerTranscript,
    "peer-transcript"
  );
  value.peerCanonicalTranscriptPath = validateAbsolutePath(
    value.peerCanonicalTranscriptPath,
    "peer-canonical-transcript-path"
  );
  if (value.peerTranscript !== value.peerCanonicalTranscriptPath) {
    throw new LeaseError(
      "malformed-lease",
      "peer transcript must contain only its canonical path"
    );
  }
  validatePeerIndexBase(value.peerIndexBase, value.peerRuntime);
  if (!LEASE_STATES.includes(value.state))
    throw new LeaseError("malformed-lease", "invalid lease state");
  value.armedAt = timestamp(value.armedAt, "armedAt");
  value.expiresAt = timestamp(value.expiresAt, "expiresAt");
  value.updatedAt = timestamp(value.updatedAt, "updatedAt");
  if (value.waitStartedAt === null !== (value.waitDeadlineAt === null)) {
    throw new LeaseError(
      "malformed-lease",
      "wait timing fields must both be timestamps or both be null"
    );
  }
  if (value.waitStartedAt !== null) {
    value.waitStartedAt = timestamp(value.waitStartedAt, "waitStartedAt");
    value.waitDeadlineAt = timestamp(value.waitDeadlineAt, "waitDeadlineAt");
  }
  const waiterFields = [value.waitToken, value.waitPid];
  const nullWaiterFields = waiterFields.filter(
    (field) => field === null
  ).length;
  if (nullWaiterFields !== 0 && nullWaiterFields !== waiterFields.length) {
    throw new LeaseError(
      "malformed-lease",
      "waiter identity fields must all be populated or all be null"
    );
  }
  if (nullWaiterFields === 0) {
    validateId(value.waitToken, "wait-token");
    integer2(value.waitPid, "waitPid", 1, Number.MAX_SAFE_INTEGER);
  }
  integer2(value.waitMs, "waitMs", 0, MAX_WAIT_MS);
  integer2(value.leaseMs, "leaseMs", 1, MAX_LEASE_MS);
  integer2(value.peerCursor, "peerCursor", 0, Number.MAX_SAFE_INTEGER);
  if (value.peerRuntime === "cursor" && value.peerContinuity === null) {
    throw new LeaseError(
      "cursor-lease-rearm-required",
      "Cursor lease is missing a continuity checkpoint; explicit re-arm required"
    );
  }
  if (value.peerContinuity !== null) {
    const checkpoint = value.peerContinuity;
    if (!checkpoint || typeof checkpoint !== "object" || Array.isArray(checkpoint) || value.peerRuntime !== "cursor" || value.peerIndexBase !== FRAME_INDEX_BASE2) {
      throw new LeaseError(
        "malformed-lease",
        "peer continuity is allowed only for Cursor frame-index leases"
      );
    }
    if (checkpoint.indexBase !== FRAME_INDEX_BASE2) {
      throw new LeaseError(
        "malformed-lease",
        "peer continuity index base must match the lease index base"
      );
    }
    integer2(
      checkpoint.nextFrameIndex,
      "peerContinuity.nextFrameIndex",
      0,
      Number.MAX_SAFE_INTEGER
    );
    integer2(
      checkpoint.prefixBytes,
      "peerContinuity.prefixBytes",
      0,
      Number.MAX_SAFE_INTEGER
    );
    integer2(
      checkpoint.observedSize,
      "peerContinuity.observedSize",
      0,
      Number.MAX_SAFE_INTEGER
    );
    if (checkpoint.nextFrameIndex !== value.peerCursor || checkpoint.prefixBytes > checkpoint.observedSize) {
      throw new LeaseError(
        "malformed-lease",
        "peer cursor must match its bounded continuity checkpoint"
      );
    }
    if (typeof checkpoint.prefixSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(checkpoint.prefixSha256)) {
      throw new LeaseError(
        "malformed-lease",
        "peer continuity prefixSha256 must be a lowercase SHA-256 digest"
      );
    }
    for (const field of ["device", "inode"]) {
      if (checkpoint[field] !== null) {
        integer2(
          checkpoint[field],
          `peerContinuity.${field}`,
          0,
          Number.MAX_SAFE_INTEGER
        );
      }
    }
  }
  integer2(value.continuationCount, "continuationCount", 0, MAX_CONTINUATIONS);
  integer2(value.continuationCap, "continuationCap", 1, MAX_CONTINUATIONS);
  integer2(value.loopCount, "loopCount", 0, MAX_LOOPS);
  integer2(value.loopCap, "loopCap", 1, MAX_LOOPS);
  if (value.continuationCount > value.continuationCap || value.loopCount > value.loopCap) {
    throw new LeaseError("malformed-lease", "lease counters exceed their caps");
  }
  if (value.state !== "waiting" && value.waitStartedAt !== null) {
    throw new LeaseError(
      "malformed-lease",
      "only waiting leases may retain wait timing fields"
    );
  }
  if (value.state !== "waiting" && nullWaiterFields !== waiterFields.length) {
    throw new LeaseError(
      "malformed-lease",
      "only waiting leases may retain waiter identity"
    );
  }
  if (value.waitStartedAt !== null) {
    const waitStarted = Date.parse(value.waitStartedAt);
    const waitDeadline = Date.parse(value.waitDeadlineAt);
    if (waitDeadline < waitStarted || waitDeadline - waitStarted > value.waitMs || waitDeadline > Date.parse(value.expiresAt)) {
      throw new LeaseError(
        "malformed-lease",
        "wait deadline must be bounded by waitMs and lease expiry"
      );
    }
  }
  if (Date.parse(value.expiresAt) < Date.parse(value.armedAt) || Date.parse(value.expiresAt) - Date.parse(value.armedAt) !== value.leaseMs) {
    throw new LeaseError(
      "malformed-lease",
      "lease expiry must match its finite lease duration"
    );
  }
  if (value.diagnostic !== null && typeof value.diagnostic !== "string")
    throw new LeaseError(
      "malformed-lease",
      "diagnostic must be a string or null"
    );
  return value;
}
function effectiveLease(lease, now = Date.now()) {
  const value = validateLease(lease);
  if ((value.state === "armed" || value.state === "waiting") && now >= Date.parse(value.expiresAt)) {
    value.state = "idle";
    value.diagnostic = "lease-expired";
    value.waitStartedAt = null;
    value.waitDeadlineAt = null;
    value.waitToken = null;
    value.waitPid = null;
  }
  if ((value.state === "armed" || value.state === "waiting") && (value.continuationCount >= value.continuationCap || value.loopCount >= value.loopCap)) {
    value.state = "idle";
    value.diagnostic = "cap-reached";
    value.waitStartedAt = null;
    value.waitDeadlineAt = null;
    value.waitToken = null;
    value.waitPid = null;
  }
  if (value.state === "waiting" && (value.waitDeadlineAt === null || now >= Date.parse(value.waitDeadlineAt))) {
    value.state = "idle";
    value.diagnostic = value.waitDeadlineAt === null ? "wait-timing-rearm-required" : "wait-timeout";
    value.waitStartedAt = null;
    value.waitDeadlineAt = null;
    value.waitToken = null;
    value.waitPid = null;
  }
  return value;
}
async function createWaiterIdentity(pid = process.pid) {
  integer2(pid, "waitPid", 1, Number.MAX_SAFE_INTEGER);
  return Object.freeze({
    token: randomUUID(),
    pid
  });
}
async function atomicWriteJson(file, value) {
  await mkdir(dirname2(file), { recursive: true, mode: 448 });
  await chmod(dirname2(file), 448);
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await open2(temp, "wx", 384);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}
`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temp, file);
  await chmod(file, 384);
}
async function readLease(root, ownerSession, { persistMigration = true } = {}) {
  const file = leasePath(root, ownerSession);
  let raw;
  try {
    const metadata = await lstat(file);
    const wrongOwner = typeof process.getuid === "function" && metadata.uid !== process.getuid();
    if (!metadata.isFile() || metadata.isSymbolicLink() || wrongOwner || (metadata.mode & 63) !== 0) {
      throw new LeaseError(
        "unsafe-lease",
        "lease must be a regular owner-only file owned by this user"
      );
    }
    raw = JSON.parse(await readFile2(file, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    if (error instanceof LeaseError) throw error;
    throw new LeaseError(
      "malformed-lease",
      `cannot read lease safely: ${error.message}`
    );
  }
  const migrated = validateLease(raw);
  if (persistMigration && raw.schemaVersion !== migrated.schemaVersion) {
    return withLeaseLock(file, async () => {
      const latest = await readLease(root, ownerSession, {
        persistMigration: false
      });
      if (latest) await atomicWriteJson(file, latest);
      return latest;
    });
  }
  return migrated;
}
async function withLeaseLock(file, fn) {
  const lock = `${file}.lock`;
  let handle;
  await mkdir(dirname2(file), { recursive: true, mode: 448 });
  await chmod(dirname2(file), 448);
  for (let attempt = 0; ; attempt += 1) {
    try {
      handle = await open2(lock, "wx", 384);
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      if (attempt >= 199)
        throw new LeaseError(
          "lease-lock-timeout",
          "lease mutation lock timed out"
        );
      await new Promise((resolveWait) => setTimeout(resolveWait, 5));
    }
  }
  try {
    return await fn();
  } finally {
    await handle.close();
    await rm(lock, { force: true });
  }
}
async function compareAndSwapTrigger(root, ownerSession, expected, update, clock = Date.now) {
  const file = leasePath(root, ownerSession);
  return withLeaseLock(file, async () => {
    const current = await readLease(root, ownerSession, {
      persistMigration: false
    });
    if (!current) return { ok: false, reason: "missing" };
    if (current.leaseId !== expected.leaseId || current.peerCursor !== expected.peerCursor || current.continuationCount !== expected.continuationCount || current.loopCount !== expected.loopCount) {
      return { ok: false, reason: "stale", lease: current };
    }
    const now = typeof clock === "function" ? clock() : clock;
    const effective = effectiveLease(current, now);
    if (!["armed", "waiting"].includes(effective.state))
      return {
        ok: false,
        reason: effective.diagnostic || effective.state,
        lease: effective
      };
    const nextCursor = integer2(
      update.peerCursor,
      "peerCursor",
      current.peerCursor,
      Number.MAX_SAFE_INTEGER
    );
    const loopIncrement = integer2(
      update.loopIncrement ?? 1,
      "loopIncrement",
      0,
      current.loopCap - current.loopCount
    );
    const next = validateLease({
      ...current,
      peerCursor: nextCursor,
      ...Object.hasOwn(update, "peerContinuity") ? { peerContinuity: update.peerContinuity } : {},
      continuationCount: current.continuationCount + 1,
      loopCount: current.loopCount + loopIncrement,
      state: update.terminal === false ? "armed" : "triggered",
      waitStartedAt: null,
      waitDeadlineAt: null,
      waitToken: null,
      waitPid: null,
      diagnostic: update.diagnostic ?? null,
      updatedAt: new Date(now).toISOString()
    });
    await atomicWriteJson(file, next);
    return { ok: true, lease: next };
  });
}
async function compareAndSwapCursor(root, ownerSession, expected, cursorUpdate2, now = Date.now()) {
  const file = leasePath(root, ownerSession);
  return withLeaseLock(file, async () => {
    const current = await readLease(root, ownerSession, {
      persistMigration: false
    });
    if (!current) return { ok: false, reason: "missing" };
    if (current.leaseId !== expected.leaseId || current.peerCursor !== expected.peerCursor || current.continuationCount !== expected.continuationCount || current.loopCount !== expected.loopCount) {
      return { ok: false, reason: "stale", lease: current };
    }
    const effective = effectiveLease(current, now);
    if (effective.state !== "waiting") {
      return {
        ok: false,
        reason: effective.diagnostic || effective.state,
        lease: effective
      };
    }
    const update = cursorUpdate2 && typeof cursorUpdate2 === "object" && !Array.isArray(cursorUpdate2) ? cursorUpdate2 : { peerCursor: cursorUpdate2 };
    const nextCursor = integer2(
      update.peerCursor,
      "peerCursor",
      current.peerCursor + 1,
      Number.MAX_SAFE_INTEGER
    );
    const next = validateLease({
      ...current,
      peerCursor: nextCursor,
      ...Object.hasOwn(update, "peerContinuity") ? { peerContinuity: update.peerContinuity } : {},
      updatedAt: new Date(now).toISOString()
    });
    await atomicWriteJson(file, next);
    return { ok: true, lease: next };
  });
}
async function beginLeaseWait(root, ownerSession, identity, now = Date.now(), waiter) {
  const file = leasePath(root, ownerSession);
  return withLeaseLock(file, async () => {
    const current = await readLease(root, ownerSession, {
      persistMigration: false
    });
    if (!current) return { ok: false, reason: "missing" };
    if (current.runtime !== identity.runtime || current.peerRuntime !== identity.peerRuntime || current.peerSession !== identity.peerSession || current.ownerCwd !== identity.ownerCwd || current.peerTranscript !== identity.peerTranscript) {
      return { ok: false, reason: "identity-mismatch", lease: current };
    }
    const effective = effectiveLease(current, now);
    if (!["armed", "waiting"].includes(effective.state)) {
      return {
        ok: false,
        reason: effective.diagnostic || effective.state,
        lease: effective
      };
    }
    if (effective.state === "waiting") {
      if (waiter && effective.waitToken === waiter.token)
        return { ok: true, changed: false, lease: effective };
      return { ok: false, reason: "waiter-active", lease: effective };
    }
    if (!waiter)
      throw new LeaseError(
        "waiter-identity-required",
        "a generation-bound waiter identity is required"
      );
    const waiting = validateLease({
      ...effective,
      state: "waiting",
      waitStartedAt: new Date(now).toISOString(),
      waitDeadlineAt: new Date(
        Math.min(now + effective.waitMs, Date.parse(effective.expiresAt))
      ).toISOString(),
      waitToken: waiter.token,
      waitPid: waiter.pid,
      updatedAt: new Date(now).toISOString(),
      diagnostic: null
    });
    await atomicWriteJson(file, waiting);
    return { ok: true, changed: true, lease: waiting };
  });
}
async function finishLeaseWait(root, ownerSession, expected, diagnostic = "wait-timeout", now = Date.now()) {
  const file = leasePath(root, ownerSession);
  return withLeaseLock(file, async () => {
    const current = await readLease(root, ownerSession, {
      persistMigration: false
    });
    if (!current) return { ok: false, reason: "missing" };
    if (current.leaseId !== expected.leaseId || current.peerCursor !== expected.peerCursor || current.continuationCount !== expected.continuationCount || current.loopCount !== expected.loopCount) {
      return { ok: false, reason: "stale", lease: current };
    }
    if (current.state !== "waiting")
      return { ok: false, reason: current.state, lease: current };
    const idle = validateLease({
      ...current,
      state: "idle",
      waitStartedAt: null,
      waitDeadlineAt: null,
      waitToken: null,
      waitPid: null,
      diagnostic,
      updatedAt: new Date(now).toISOString()
    });
    await atomicWriteJson(file, idle);
    return { ok: true, lease: idle };
  });
}
async function resourceExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// src/skills/session-observer-collab/src/lib/runtime-adapter.mjs
import { createHash as createHash3 } from "node:crypto";
import { open as open3 } from "node:fs/promises";
var RUNTIME_ADAPTER_VERSION = 2;
function fileIdentity(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
async function hashPrefix(handle, prefixBytes) {
  const hash = createHash3("sha256");
  if (prefixBytes === 0) return hash.digest("hex");
  let bytesRead = 0;
  const stream = handle.createReadStream({
    start: 0,
    end: prefixBytes - 1,
    autoClose: false
  });
  for await (const chunk of stream) {
    bytesRead += chunk.byteLength;
    hash.update(chunk);
  }
  if (bytesRead !== prefixBytes) return null;
  return hash.digest("hex");
}
async function verifyAdapterPeerContinuity(lease, transcript) {
  if (lease.peerRuntime !== "cursor") {
    const requested = validateAbsolutePath(transcript, "transcript");
    return Object.freeze({
      verified: requested === lease.peerTranscript,
      reason: requested === lease.peerTranscript ? "verified" : "identity-mismatch",
      canonicalTranscriptPath: requested === lease.peerTranscript ? requested : null
    });
  }
  let requestedPath;
  let leasedPath;
  try {
    requestedPath = await canonicalizePeerTranscript("cursor", transcript);
    leasedPath = await canonicalizePeerTranscript(
      "cursor",
      lease.peerTranscript
    );
  } catch (error) {
    return Object.freeze({
      verified: false,
      reason: error?.code ?? "continuity-path-mismatch",
      canonicalTranscriptPath: null
    });
  }
  if (requestedPath.peerCanonicalTranscriptPath !== lease.peerCanonicalTranscriptPath || leasedPath.peerCanonicalTranscriptPath !== lease.peerCanonicalTranscriptPath || requestedPath.peerCanonicalTranscriptPath !== leasedPath.peerCanonicalTranscriptPath) {
    return Object.freeze({
      verified: false,
      reason: "continuity-path-mismatch",
      canonicalTranscriptPath: null
    });
  }
  const checkpoint = lease.peerContinuity;
  if (checkpoint === null) {
    return Object.freeze({
      verified: false,
      reason: "cursor-lease-rearm-required",
      canonicalTranscriptPath: null
    });
  }
  let handle;
  try {
    handle = await open3(lease.peerCanonicalTranscriptPath, "r");
    const metadata = await handle.stat();
    if (metadata.size < checkpoint.observedSize || metadata.size < checkpoint.prefixBytes) {
      return Object.freeze({
        verified: false,
        reason: "continuity-size-mismatch",
        canonicalTranscriptPath: lease.peerCanonicalTranscriptPath
      });
    }
    if (checkpoint.device !== null && fileIdentity(metadata.dev) !== checkpoint.device) {
      return Object.freeze({
        verified: false,
        reason: "continuity-device-mismatch",
        canonicalTranscriptPath: lease.peerCanonicalTranscriptPath
      });
    }
    if (checkpoint.inode !== null && fileIdentity(metadata.ino) !== checkpoint.inode) {
      return Object.freeze({
        verified: false,
        reason: "continuity-inode-mismatch",
        canonicalTranscriptPath: lease.peerCanonicalTranscriptPath
      });
    }
    if (await hashPrefix(handle, checkpoint.prefixBytes) !== checkpoint.prefixSha256) {
      return Object.freeze({
        verified: false,
        reason: "continuity-prefix-mismatch",
        canonicalTranscriptPath: lease.peerCanonicalTranscriptPath
      });
    }
  } catch (error) {
    return Object.freeze({
      verified: false,
      reason: error?.code ?? "continuity-read-failed",
      canonicalTranscriptPath: lease.peerCanonicalTranscriptPath
    });
  } finally {
    await handle?.close();
  }
  return Object.freeze({
    verified: true,
    reason: "verified",
    canonicalTranscriptPath: lease.peerCanonicalTranscriptPath
  });
}
async function validateCursorUpdate(lease, transcript, update) {
  if (lease.peerRuntime !== "cursor") {
    if (update && typeof update === "object" && Object.hasOwn(update, "peerContinuity") && update.peerContinuity !== null) {
      return { ok: false, reason: "continuity-not-applicable" };
    }
    return { ok: true, update };
  }
  if (!update || typeof update !== "object" || !Object.hasOwn(update, "peerContinuity") || update.peerContinuity === null) {
    return { ok: false, reason: "continuity-required" };
  }
  if (update.peerContinuity.nextFrameIndex !== update.peerCursor)
    return { ok: false, reason: "continuity-required" };
  const proposed = await verifyAdapterPeerContinuity(
    {
      ...lease,
      peerCursor: update.peerCursor,
      peerContinuity: update.peerContinuity
    },
    transcript
  );
  return proposed.verified ? { ok: true, update } : { ok: false, reason: proposed.reason };
}
function defineRuntimeAdapter(adapter) {
  if (!adapter || typeof adapter !== "object")
    throw new TypeError("adapter must be an object");
  validateOwnerRuntime(adapter.runtime);
  for (const method of ["identify", "emit"])
    if (typeof adapter[method] !== "function")
      throw new TypeError(`adapter.${method} must be a function`);
  return Object.freeze({ version: RUNTIME_ADAPTER_VERSION, ...adapter });
}
function validateAdapterInvocation(input) {
  if (!input || typeof input !== "object")
    throw new TypeError("invocation must be an object");
  return Object.freeze({
    runtime: validateOwnerRuntime(input.runtime),
    peerRuntime: validatePeerRuntime(input.peerRuntime),
    peerSession: validateId(input.peerSession, "peer-session"),
    ownerSession: validateId(input.ownerSession, "owner-session"),
    cwd: validateAbsolutePath(input.cwd, "cwd"),
    transcript: validateAbsolutePath(input.transcript, "transcript"),
    now: input.now === void 0 ? Date.now() : input.now,
    waiter: input.waiter
  });
}
async function inspectAdapterLease(root, invocation) {
  const input = validateAdapterInvocation(invocation);
  const lease = await readLease(root, input.ownerSession);
  if (!lease) return { eligible: false, reason: "missing", lease: null };
  if (lease.runtime !== input.runtime || lease.peerRuntime !== input.peerRuntime || lease.peerSession !== input.peerSession || lease.ownerCwd !== input.cwd) {
    return { eligible: false, reason: "identity-mismatch", lease };
  }
  const continuity = await verifyAdapterPeerContinuity(lease, input.transcript);
  if (!continuity.verified) {
    return { eligible: false, reason: continuity.reason, lease };
  }
  const effective = effectiveLease(lease, input.now);
  return {
    eligible: ["armed", "waiting"].includes(effective.state),
    reason: effective.diagnostic || effective.state,
    lease: effective
  };
}
async function beginAdapterWait(root, invocation) {
  const input = validateAdapterInvocation(invocation);
  const inspected = await inspectAdapterLease(root, input);
  if (!inspected.eligible || !inspected.lease) {
    return {
      ok: false,
      waiting: false,
      changed: false,
      reason: inspected.reason,
      lease: inspected.lease
    };
  }
  const waiter = input.waiter ?? await createWaiterIdentity();
  const result = await beginLeaseWait(
    root,
    input.ownerSession,
    {
      runtime: input.runtime,
      peerRuntime: input.peerRuntime,
      peerSession: input.peerSession,
      ownerCwd: input.cwd,
      peerTranscript: inspected.lease.peerTranscript
    },
    input.now,
    waiter
  );
  return {
    waiting: result.ok,
    changed: result.ok && result.changed,
    reason: result.ok ? "waiting" : result.reason,
    lease: result.lease ?? null
  };
}
async function advanceAdapterCursor(root, invocation, expected, cursorUpdate2) {
  const inspected = await inspectAdapterLease(root, invocation);
  if (!inspected.eligible)
    return {
      advanced: false,
      reason: inspected.reason,
      lease: inspected.lease
    };
  const checked = await validateCursorUpdate(
    inspected.lease,
    invocation.transcript,
    cursorUpdate2
  );
  if (!checked.ok)
    return {
      advanced: false,
      reason: checked.reason,
      lease: inspected.lease
    };
  const result = await compareAndSwapCursor(
    root,
    invocation.ownerSession,
    expected,
    checked.update,
    invocation.now
  );
  return {
    advanced: result.ok,
    reason: result.ok ? "advanced" : result.reason,
    lease: result.lease ?? null
  };
}
async function finishAdapterWait(root, invocation, expected, diagnostic = "wait-timeout") {
  const input = validateAdapterInvocation(invocation);
  const lease = await readLease(root, input.ownerSession);
  if (!lease)
    return {
      finished: false,
      reason: "missing",
      lease: null
    };
  if (lease.runtime !== input.runtime || lease.peerRuntime !== input.peerRuntime || lease.peerSession !== input.peerSession || lease.ownerCwd !== input.cwd || lease.peerTranscript !== input.transcript)
    return { finished: false, reason: "identity-mismatch", lease };
  const result = await finishLeaseWait(
    root,
    input.ownerSession,
    expected,
    diagnostic,
    input.now
  );
  return {
    finished: result.ok,
    reason: result.ok ? diagnostic : result.reason,
    lease: result.lease ?? null
  };
}
async function claimAdapterTrigger(root, invocation, expected, completion, clock = () => invocation.now) {
  const inspected = await inspectAdapterLease(root, invocation);
  if (!inspected.eligible)
    return {
      triggered: false,
      reason: inspected.reason,
      lease: inspected.lease
    };
  if (!completion || !Number.isSafeInteger(completion.peerCursor) || completion.peerCursor <= expected.peerCursor) {
    return { triggered: false, reason: "no-advance", lease: inspected.lease };
  }
  const checked = await validateCursorUpdate(
    inspected.lease,
    invocation.transcript,
    completion
  );
  if (!checked.ok)
    return {
      triggered: false,
      reason: checked.reason,
      lease: inspected.lease
    };
  const result = await compareAndSwapTrigger(
    root,
    invocation.ownerSession,
    expected,
    checked.update,
    clock
  );
  return {
    triggered: result.ok,
    reason: result.ok ? "triggered" : result.reason,
    lease: result.lease ?? null
  };
}

// src/skills/session-observer-collab/src/lib/selected-prefix.mjs
import { createHash as createHash5 } from "node:crypto";
import { open as open5 } from "node:fs/promises";

// src/shared/transcript/cursor-frames.ts
import { createHash as createHash4 } from "node:crypto";
import { open as open4 } from "node:fs/promises";
function isJsonObject2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseClosedFrame(frameBytes) {
  if (frameBytes.length === 0) {
    return { parseState: "blank", record: null };
  }
  try {
    const value = JSON.parse(frameBytes.toString("utf8"));
    if (!isJsonObject2(value)) {
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
  const handle = await open4(transcriptPath, "r");
  try {
    const file = await handle.stat();
    const safePrefixHash = createHash4("sha256");
    const verifiedPrefixHash = options.verifyPrefixBytes === void 0 ? null : createHash4("sha256");
    let verifiedBytes = 0;
    let verifiedPrefixSha256 = options.verifyPrefixBytes === 0 ? createHash4("sha256").digest("hex") : null;
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

// src/skills/session-observer-collab/src/lib/selected-prefix.mjs
var SHA256 = /^[a-f0-9]{64}$/u;
function selectedPrefixError() {
  const error = new Error("cursor selected prefix changed after observation");
  error.code = "cursor-selected-prefix-mismatch";
  return error;
}
function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}
function validSelectedPrefix(snapshot) {
  return snapshot !== null && typeof snapshot === "object" && !Array.isArray(snapshot) && snapshot.indexBase === "zero-based-jsonl-frame-index" && nonNegativeInteger(snapshot.nextFrameIndex) && nonNegativeInteger(snapshot.prefixBytes) && SHA256.test(snapshot.prefixSha256) && snapshot.observedSize === snapshot.prefixBytes && nonNegativeInteger(snapshot.device) && nonNegativeInteger(snapshot.inode);
}
async function readBoundedHashes(transcript, selectedPrefixBytes, verificationPrefixBytes) {
  if (!nonNegativeInteger(selectedPrefixBytes) || !nonNegativeInteger(verificationPrefixBytes) || selectedPrefixBytes > verificationPrefixBytes) {
    throw selectedPrefixError();
  }
  const selectedHash = createHash5("sha256");
  const verificationHash = createHash5("sha256");
  const handle = await open5(transcript, "r");
  try {
    const before = await handle.stat();
    if (!nonNegativeInteger(before.dev) || !nonNegativeInteger(before.ino) || before.size < verificationPrefixBytes) {
      throw selectedPrefixError();
    }
    let bytesRead = 0;
    if (verificationPrefixBytes > 0) {
      const stream = handle.createReadStream({
        start: 0,
        end: verificationPrefixBytes - 1,
        autoClose: false
      });
      for await (const chunk of stream) {
        const selectedRemaining = selectedPrefixBytes - bytesRead;
        if (selectedRemaining > 0) {
          selectedHash.update(
            chunk.subarray(0, Math.min(selectedRemaining, chunk.byteLength))
          );
        }
        verificationHash.update(chunk);
        bytesRead += chunk.byteLength;
      }
    }
    const after = await handle.stat();
    if (bytesRead !== verificationPrefixBytes || after.dev !== before.dev || after.ino !== before.ino || after.size < verificationPrefixBytes) {
      throw selectedPrefixError();
    }
    return Object.freeze({
      device: before.dev,
      inode: before.ino,
      selectedSha256: selectedHash.digest("hex"),
      verificationSha256: verificationHash.digest("hex")
    });
  } finally {
    await handle.close();
  }
}
async function captureSelectedPrefix(transcript, scan, frameEnds, nextFrameIndex) {
  const prefixBytes = nextFrameIndex === 0 ? 0 : frameEnds[nextFrameIndex - 1];
  if (!nonNegativeInteger(nextFrameIndex) || !nonNegativeInteger(prefixBytes) || !nonNegativeInteger(scan.file.device) || !nonNegativeInteger(scan.file.inode) || prefixBytes > scan.safePrefixBytes || !SHA256.test(scan.safePrefixSha256)) {
    throw selectedPrefixError();
  }
  const bounded = await readBoundedHashes(
    transcript,
    prefixBytes,
    scan.safePrefixBytes
  );
  if (bounded.device !== scan.file.device || bounded.inode !== scan.file.inode || bounded.verificationSha256 !== scan.safePrefixSha256) {
    throw selectedPrefixError();
  }
  return Object.freeze({
    indexBase: "zero-based-jsonl-frame-index",
    nextFrameIndex,
    prefixBytes,
    prefixSha256: bounded.selectedSha256,
    observedSize: prefixBytes,
    device: bounded.device,
    inode: bounded.inode
  });
}
async function observeCursorCompletion(lease) {
  const identity = {
    runtime: "cursor",
    sessionId: lease.peerSession,
    projectCwd: lease.ownerCwd,
    canonicalCwd: lease.ownerCwd,
    canonicalTranscriptPath: lease.peerCanonicalTranscriptPath,
    cwdEvidence: ["direct-project-root"],
    sessionEvidence: ["explicit-pin"],
    strength: "exact",
    reasons: []
  };
  const accumulator = createCursorTurnAccumulator(identity, lease.peerCursor);
  const frameEnds = [];
  const scan = await scanCursorTranscript(lease.peerTranscript, {
    verifyPrefixBytes: lease.peerContinuity?.prefixBytes,
    onFrame(frame) {
      accumulator.onFrame(frame);
      frameEnds[frame.frameIndex] = frame.closed && (frame.parseState === "parsed" || frame.parseState === "blank") ? frame.byteEnd : null;
    }
  });
  const prior = lease.peerContinuity;
  if (prior !== null && (scan.file.size < prior.observedSize || scan.file.size < prior.prefixBytes || scan.file.device !== prior.device || scan.file.inode !== prior.inode || scan.verifiedPrefixSha256 !== prior.prefixSha256)) {
    throw new Error("cursor continuity changed during completion read");
  }
  const digest = await buildDigest("cursor", lease.peerTranscript, {
    fromIndex: lease.peerCursor,
    mode: "review",
    sessionId: lease.peerSession,
    recordedCwd: lease.ownerCwd,
    cursorProjection: "confirmed-completion",
    cursorIdentity: identity,
    cursorScan: scan,
    cursorAnalysis: accumulator.finish(scan),
    cursorState: null,
    cursorContinuity: prior === null ? "new" : "verified"
  });
  digest.cursorEvidence.selectedPrefix = await captureSelectedPrefix(
    lease.peerTranscript,
    scan,
    frameEnds,
    digest.entries.at(-1)?.recordIndex + 1 || digest.range.nextIndex
  );
  return digest;
}
async function verifySelectedPrefix(transcript, snapshot) {
  if (!validSelectedPrefix(snapshot)) throw selectedPrefixError();
  const bounded = await readBoundedHashes(
    transcript,
    snapshot.prefixBytes,
    snapshot.prefixBytes
  );
  if (bounded.device !== snapshot.device || bounded.inode !== snapshot.inode || bounded.selectedSha256 !== snapshot.prefixSha256) {
    throw selectedPrefixError();
  }
  return Object.freeze({ ...snapshot });
}

// src/skills/session-observer-collab/src/hooks/cursor-stop.mjs
var DEFAULT_CURSOR_LOOP_LIMIT = 5;
var POLL_MS = 250;
function integer3(value, label) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new TypeError(`${label} must be a non-negative safe integer`);
  return value;
}
function loopLimit(value) {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new TypeError("loopLimit must be a positive safe integer");
  return value;
}
function counters(lease) {
  return {
    leaseId: lease.leaseId,
    peerCursor: lease.peerCursor,
    continuationCount: lease.continuationCount,
    loopCount: lease.loopCount
  };
}
function refreshWakeAuthorization(now, lease, deadline) {
  const currentNow = now();
  if (currentNow >= Date.parse(lease.expiresAt)) {
    return { authorized: false, currentNow, diagnostic: "lease-expired" };
  }
  if (currentNow >= deadline) {
    return { authorized: false, currentNow, diagnostic: "wait-timeout" };
  }
  return { authorized: true, currentNow, diagnostic: null };
}
function escapeAttribute(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function completionIndexBase(value) {
  if (value !== "zero-based-jsonl-record-index" && value !== "zero-based-jsonl-frame-index") {
    throw new TypeError("range.indexBase must be a supported index base");
  }
  return value;
}
function cursorWakeEnvelope(lease, range) {
  const peer = `${lease.peerRuntime}:${lease.peerSession}`;
  const indexBase = completionIndexBase(range.indexBase);
  return [
    '<session_observer_wake automatic="true" schema_version="2"',
    `  runtime="cursor" lease_id="${escapeAttribute(lease.leaseId)}"`,
    `  peer="${escapeAttribute(peer)}" index_base="${indexBase}"`,
    `  records="${range.fromIndex}-${range.toIndex}">`,
    "Review the pinned peer range and respond only if it contains substantive new information.",
    "</session_observer_wake>"
  ].join("\n");
}
var CURSOR_STOP_ADAPTER = defineRuntimeAdapter({
  runtime: "cursor",
  identify(event) {
    if (!event || typeof event !== "object" || event.status !== "success")
      return null;
    try {
      return Object.freeze({
        ownerSession: validateId(event.conversation_id, "conversation-id"),
        generationId: validateId(event.generation_id, "generation-id"),
        loopCount: integer3(event.loop_count, "loop_count")
      });
    } catch {
      return null;
    }
  },
  emit(lease, range) {
    return Object.freeze({
      followup_message: cursorWakeEnvelope(lease, range)
    });
  }
});
async function defaultObserve(lease) {
  if (lease.peerRuntime === "cursor") {
    return observeCursorCompletion(lease);
  }
  return buildDigest(lease.peerRuntime, lease.peerTranscript, {
    fromIndex: lease.peerCursor,
    mode: "review",
    sessionId: lease.peerSession
  });
}
function validSelection(selection, expected, lease) {
  return selection.continuation === true && selection.indexBase === lease.peerIndexBase && selection.range !== null && selection.range.fromIndex === expected.peerCursor && selection.range.toIndex === selection.completedRecord && selection.peerCursor === selection.completedRecord + 1;
}
function isPendingCursorCompletion(digest, lease) {
  return lease.peerRuntime === "cursor" && digest?.schemaVersion === 2 && digest.runtime === "cursor" && digest.range?.indexBase === "zero-based-jsonl-frame-index" && digest.accounting?.indexBase === "zero-based-jsonl-frame-index" && digest.cursorEvidence?.projection === "confirmed-completion" && digest.cursorEvidence?.status?.lifecycle === "pending" && digest.cursorEvidence?.blockingFrame === null && digest.accounting?.buffered?.reason === "stability-wait" && digest.range.fromIndex === lease.peerCursor && digest.range.nextIndex === lease.peerCursor;
}
function validDigestForLease(digest, lease) {
  if (lease.peerRuntime !== "cursor") return digest?.schemaVersion === 1;
  return digest?.schemaVersion === 2 && digest.runtime === "cursor" && digest.range?.indexBase === lease.peerIndexBase && digest.accounting?.indexBase === lease.peerIndexBase && digest.cursorEvidence?.projection === "confirmed-completion";
}
async function cursorUpdate(lease, selection) {
  if (lease.peerRuntime !== "cursor") {
    return Object.freeze({ peerCursor: selection.peerCursor });
  }
  return Object.freeze({
    peerCursor: selection.peerCursor,
    peerContinuity: await verifySelectedPrefix(
      lease.peerTranscript,
      selection.selectedPrefix
    )
  });
}
async function runCursorStopHook(event, options = {}) {
  const identity = CURSOR_STOP_ADAPTER.identify(event);
  if (!identity) return null;
  let configuredLoopLimit;
  try {
    configuredLoopLimit = loopLimit(
      options.loopLimit ?? DEFAULT_CURSOR_LOOP_LIMIT
    );
  } catch {
    return null;
  }
  if (identity.loopCount >= configuredLoopLimit) return null;
  const root = options.root ?? stateRoot(options.env ?? process.env);
  const observe = options.observe ?? defaultObserve;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve2) => setTimeout(resolve2, ms)));
  const now = options.now ?? Date.now;
  let currentNow = now();
  let lease;
  try {
    lease = await readLease(root, identity.ownerSession);
  } catch {
    return null;
  }
  if (!lease || lease.ownerSession !== identity.ownerSession) return null;
  const invocation = {
    runtime: "cursor",
    peerRuntime: lease.peerRuntime,
    peerSession: lease.peerSession,
    ownerSession: identity.ownerSession,
    cwd: lease.ownerCwd,
    transcript: lease.peerTranscript,
    now: currentNow
  };
  const inspected = await inspectAdapterLease(root, invocation).catch(() => ({
    eligible: false,
    lease: null
  }));
  if (!inspected.eligible || !inspected.lease) return null;
  if (!await resourceExists(inspected.lease.ownerCwd) || !await resourceExists(inspected.lease.peerTranscript)) {
    return null;
  }
  const waiting = await beginAdapterWait(root, invocation).catch(() => ({
    waiting: false,
    lease: null
  }));
  if (!waiting.waiting || !waiting.lease) return null;
  let activeLease = waiting.lease;
  let expected = counters(activeLease);
  const deadline = Date.parse(activeLease.waitDeadlineAt);
  if (!Number.isFinite(deadline)) return null;
  let diagnostic = "wait-timeout";
  try {
    while ((currentNow = now()) < deadline) {
      let selection;
      try {
        const digest = await observe(activeLease);
        if (!validDigestForLease(digest, activeLease)) {
          diagnostic = "observer-invalid";
          return null;
        }
        if (isPendingCursorCompletion(digest, activeLease)) {
          const remaining2 = deadline - now();
          if (remaining2 > 0) await sleep(Math.min(POLL_MS, remaining2));
          continue;
        }
        selection = selectCompletedContinuation(digest);
      } catch {
        diagnostic = "observer-invalid";
        return null;
      }
      if (validSelection(selection, expected, activeLease)) {
        const terminal = activeLease.continuationCount + selection.budgetCost >= activeLease.continuationCap || activeLease.loopCount + 1 >= activeLease.loopCap || identity.loopCount + 1 >= configuredLoopLimit;
        await options.beforeCursorUpdate?.();
        const update = await cursorUpdate(activeLease, selection);
        const authorization = refreshWakeAuthorization(
          now,
          activeLease,
          deadline
        );
        currentNow = authorization.currentNow;
        if (!authorization.authorized) {
          diagnostic = authorization.diagnostic;
          return null;
        }
        const claimed = await claimAdapterTrigger(
          root,
          { ...invocation, now: currentNow },
          expected,
          {
            ...update,
            loopIncrement: 1,
            terminal,
            diagnostic: null
          },
          now
        ).catch(() => ({ triggered: false, lease: null }));
        if (!claimed.triggered) {
          diagnostic = claimed.reason;
          return null;
        }
        return CURSOR_STOP_ADAPTER.emit(activeLease, selection.range);
      }
      if (selection.continuation === false && selection.peerCursor > expected.peerCursor) {
        if (selection.fromIndex !== expected.peerCursor) {
          diagnostic = "noncontiguous-selection";
          return null;
        }
        const update = await cursorUpdate(activeLease, selection);
        const authorization = refreshWakeAuthorization(
          now,
          activeLease,
          deadline
        );
        currentNow = authorization.currentNow;
        if (!authorization.authorized) {
          diagnostic = authorization.diagnostic;
          return null;
        }
        const advanced = await advanceAdapterCursor(
          root,
          { ...invocation, now: currentNow },
          expected,
          update
        ).catch(() => ({ advanced: false, lease: null }));
        if (!advanced.advanced || !advanced.lease) return null;
        activeLease = advanced.lease;
        expected = counters(activeLease);
        continue;
      }
      const remaining = deadline - now();
      if (remaining > 0) await sleep(Math.min(POLL_MS, remaining));
    }
    return null;
  } catch {
    diagnostic = "observer-invalid";
    return null;
  } finally {
    await finishAdapterWait(
      root,
      { ...invocation, now: currentNow },
      expected,
      diagnostic
    ).catch(() => {
    });
  }
}
async function readStdin() {
  const input = await readFile3("/dev/stdin", "utf8");
  return JSON.parse(input || "{}");
}
async function runCursorStopMain() {
  let event;
  try {
    event = await readStdin();
  } catch {
    return;
  }
  const result = await runCursorStopHook(event);
  if (result?.followup_message)
    process.stdout.write(`${JSON.stringify(result)}
`);
}
if (import.meta.url === `file://${process.argv[1]}`) {
  runCursorStopMain().catch(() => {
  });
}
export {
  CURSOR_STOP_ADAPTER,
  DEFAULT_CURSOR_LOOP_LIMIT,
  cursorWakeEnvelope,
  runCursorStopHook,
  runCursorStopMain
};
