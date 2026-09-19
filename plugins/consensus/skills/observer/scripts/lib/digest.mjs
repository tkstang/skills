// GENERATED skill payload for session-observer.

// src/skills/session-observer/src/lib/digest.ts
import { createHash as createHash2 } from "node:crypto";

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
  const coverage = [];
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
        coverage.push({
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
  coverage.push(...topLevelResult.coverage);
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
  return { events, coverage, diagnostics: [] };
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
  const nativeType = stringValue(payload.type);
  if (nativeType !== "task_started" && nativeType !== "task_complete" && nativeType !== "turn_aborted") {
    return void 0;
  }
  const locator = recordLocator(detailed, "/payload");
  const turnId = stringValue(payload.turn_id);
  const nativeStatus = stringValue(payload.status);
  const error = isJsonObject(payload.error) ? payload.error : void 0;
  const outcome = nativeType === "task_started" ? "pending" : nativeType === "turn_aborted" ? "cancelled" : error ? "error" : "success";
  const errorInfo = error ? stringValue(error.codex_error_info) : void 0;
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
  const coverage = childReference2 ? [
    {
      dataClass: "child-trajectory",
      status: "not-read",
      captured: 1,
      locator
    }
  ] : [];
  const diagnostics = outputCapDiagnostics(detailed, item, "/payload/item");
  if (diagnostics.length > 0) {
    coverage.push(
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
    coverage,
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
  const coverage = [];
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
    coverage.push({
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
    coverage.push(...extracted.coverage);
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
    coverage: [...baseCoverage(events), ...coverage],
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
  return stableActivityStringify(value).replaceAll("&", "\\u0026").replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("`", "\\u0060");
}
function locatorText(locator) {
  if (!locator) return "source-wide";
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
  return `- ${counts.scope}: calls ${counts.calls}; counted invocations ${counts.countedInvocations}; results ${counts.results}; items ${counts.items}; failures ${counts.failures}`;
}
function renderActivityMarkdown(report) {
  const lines = [
    "## Activity",
    "",
    `- Schema: ${report.activitySchemaVersion}`,
    `- Mode: ${report.mode}`,
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
    for (const coverage of report.coverage) {
      lines.push(
        `- ${coverage.dataClass}: ${coverage.status}; captured ${coverage.captured}; ${locatorText(coverage.locator)}`
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
    const rendered = finalized.mode === "export" ? renderActivityMarkdown(finalized) : renderActivityReport(finalized);
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

// src/shared/transcript/cursor-analysis.ts
import { createHash } from "node:crypto";
function cursorRenderTurnId(turn, sourceFrameIndex) {
  const humanFrameIndex = turn.humanRecordIndexes.findLast(
    (frameIndex) => frameIndex <= sourceFrameIndex
  );
  return `${turn.turnId}:render:${humanFrameIndex ?? turn.fromFrameIndex}`;
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
  lines.push(`**session:** ${digest.sessionId}`);
  if (digest.nativeSessionId)
    lines.push(`**native session:** ${digest.nativeSessionId}`);
  if (digest.rootSessionId)
    lines.push(`**root session:** ${digest.rootSessionId}`);
  if (digest.parentSessionId)
    lines.push(`**parent session:** ${digest.parentSessionId}`);
  if (digest.forkedFromSessionId)
    lines.push(`**forked from:** ${digest.forkedFromSessionId}`);
  if (digest.subagentHistoryStartOrdinal !== void 0) {
    lines.push(
      `**inherited history ends before ordinal:** ${digest.subagentHistoryStartOrdinal}`
    );
  }
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
    includeActivity = false,
    maxTurns,
    maxBytes,
    fallbacks = []
  } = opts;
  const warnings = [...opts.warnings ?? []];
  const capturedRead = includeActivity ? opts.capturedRead ?? await readRecordsDetailed(transcriptPath) : void 0;
  const records = capturedRead ? capturedRead.records.map(({ record }) => record) : await readRecords(transcriptPath);
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
    // The activity projection owns tool calls/results in activity mode. Ask
    // user exchanges survive these filters in the legacy normalizer.
    includeToolCalls: includeActivity ? false : includeToolCalls,
    includeToolResults: includeActivity ? false : includeToolResults,
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
  let activity;
  if (includeActivity && capturedRead && runtime !== "cursor") {
    const activityMode = mode === "catch-up" ? "catch-up" : "review";
    const source = {
      runtime,
      sessionId,
      nativeSessionId: identity?.nativeSessionId ?? sessionId,
      transcriptPath
    };
    try {
      activity = projectActivity(
        correlateActivity(extractActivity({ source, read: capturedRead })),
        {
          mode: activityMode,
          deliveryRange: {
            indexBase: "zero-based-decoded-record-index",
            start: rawFromIndex,
            end: totalRecords
          }
        }
      );
    } catch {
      activity = projectActivity(
        {
          activitySchemaVersion: 1,
          source,
          sourceSnapshot: {
            capturedAt: capturedRead.capturedAt,
            sourceBytes: capturedRead.sourceBytes
          },
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
          mode: activityMode,
          deliveryRange: {
            indexBase: "zero-based-decoded-record-index",
            start: rawFromIndex,
            end: totalRecords
          }
        }
      );
    }
  }
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
    ...activity ? { activity } : {},
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
      const header = group[0].displayRole === "queued-user" ? "### User (queued mid-turn)" : group[0].displayRole === "automatic-control" ? "### Hook/control (automatic)" : group[0].displayRole === "runtime-notification" ? "### Runtime notification" : role === "user" ? "### User" : "### Assistant";
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
  if (digest.activity) {
    parts.push(renderActivityMarkdown(digest.activity));
  }
  const output = parts.join("\n");
  if (output.length > LARGE_OUTPUT_THRESHOLD) {
    const warning = `> **Warning:** This digest is large (${output.length.toLocaleString()} chars). Consider using \`--max-turns\` or \`--max-bytes\` to limit output.

`;
    return warning + output;
  }
  return output;
}
function renderJson(digest) {
  return JSON.stringify(digest, null, 2);
}
export {
  buildDigest,
  renderJson,
  renderMarkdown
};
