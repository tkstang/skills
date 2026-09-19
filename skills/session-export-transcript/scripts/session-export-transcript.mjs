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
  session
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
  lines.push("");
  if (entries.length === 0) {
    lines.push("*No visible messages.*");
    lines.push("");
    return lines.join("\n");
  }
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
  return lines.join("\n");
}
async function exportSession(opts, runtime, branch, branchFromGit, session, multi) {
  const records = await readRecords(session.transcriptPath);
  const normalized = normalizeEntries(runtime, records, {});
  const sanitized = sanitizeEntries(normalized, { runtime });
  const entries = stripMarkerAndEmpty(sanitized);
  const md = renderMarkdown({
    branch: branch ?? basename2(opts.cwd),
    branchFromGit,
    source: session.transcriptPath,
    runtime,
    session,
    entries
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
