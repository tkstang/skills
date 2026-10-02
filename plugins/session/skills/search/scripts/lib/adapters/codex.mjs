// GENERATED skill payload for session-search.

// src/skills/session-search/src/lib/adapters/codex.ts
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

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

// src/skills/session-search/src/lib/classify.ts
var CONTEXT_PROVENANCE = /* @__PURE__ */ new Set([
  "automatic-control",
  "runtime-notification",
  "runtime-diagnostic"
]);
function isInjectedUserText(text, runtime) {
  if (text.trimStart().startsWith("<user_instructions>")) return true;
  return HIDDEN_PAYLOAD_MATCHERS.some(
    (matcher) => matcher.test(text, "user", runtime)
  );
}
function demoteRole(role, text, runtime) {
  return role === "user" && isInjectedUserText(text, runtime) ? "context" : role;
}
function roleForEntry(entry, runtime) {
  if (entry.kind === "tool_call" || entry.kind === "tool_result") return "tool";
  if (entry.origin !== void 0 && CONTEXT_PROVENANCE.has(entry.origin) || entry.displayRole !== void 0 && CONTEXT_PROVENANCE.has(entry.displayRole)) {
    return "context";
  }
  return demoteRole(entry.role, entry.text, runtime);
}
function unitsFromEntries(entries, runtime) {
  const units = [];
  for (const entry of entries) {
    if (typeof entry.text !== "string" || entry.text.trim() === "") continue;
    units.push({ role: roleForEntry(entry, runtime), text: entry.text });
  }
  return units;
}

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

// src/skills/session-search/src/lib/window.ts
function inTimeWindow(file, since, until) {
  const end = file.mtimeMs;
  const start = Math.min(file.createdAtMs ?? end, end);
  if (since !== null && end < since) return false;
  if (until !== null && start > until) return false;
  return true;
}

// src/skills/session-search/src/lib/adapters/codex.ts
var RUNTIME = "codex";
var ASK_USER_TOOL = "request_user_input";
var ROLLOUT_NAME = /^rollout-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(.+)\.jsonl$/u;
var HEADER_FIRST_BYTES = 64 * 1024;
var HEADER_MAX_BYTES = 1024 * 1024;
var INFO_READ_BYTES = 1024 * 1024;
var LINE_MAX_BYTES = 1024 * 1024;
var SQLITE_TIMEOUT_MS = 15e3;
var SQLITE_MAX_OUTPUT = 256 * 1024 * 1024;
var THREAD_COLUMNS = [
  "id",
  "rollout_path",
  "title",
  "first_user_message",
  "cwd",
  "created_at",
  "updated_at",
  "archived",
  "git_origin_url",
  "source"
];
var noDiagnostic = () => {
};
function isObject2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function asString2(value) {
  return typeof value === "string" ? value : void 0;
}
function nonEmpty(value) {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}
function existsAs(target, kind) {
  try {
    const stats = statSync(target);
    return kind === "file" ? stats.isFile() : stats.isDirectory();
  } catch {
    return false;
  }
}
async function listDir(dir) {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}
async function collectRollouts(dir, out) {
  for (const entry of await listDir(dir)) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await collectRollouts(full, out);
    else if (entry.isFile() && ROLLOUT_NAME.test(entry.name)) out.push(full);
  }
}
function toEpochMs(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value < 1e12 ? value * 1e3 : value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    if (/^\d+$/u.test(value.trim())) return toEpochMs(Number(value.trim()));
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
function parseRolloutName(file) {
  const match = ROLLOUT_NAME.exec(path.basename(file));
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const startedAtMs = new Date(
    year,
    month - 1,
    day,
    hour,
    minute,
    second
  ).getTime();
  return { sessionId: match[7], startedAtMs };
}
function isAgentSource(source) {
  const value = typeof source === "string" && source.trim().startsWith("{") ? parseJsonObject(source.trim()) : source;
  return isObject2(value) && Object.hasOwn(value, "subagent");
}
function headerFrom(records) {
  const meta = records.find(
    (record) => record.type === "session_meta" && isObject2(record.payload)
  );
  if (!meta || !isObject2(meta.payload)) return null;
  const payload = meta.payload;
  const start = payload.subagent_history_start_ordinal;
  const cwd = nonEmpty(payload.cwd);
  return {
    id: nonEmpty(payload.id),
    rootId: nonEmpty(payload.session_id),
    cwd: cwd && path.isAbsolute(cwd) ? cwd : null,
    timestamp: nonEmpty(payload.timestamp) ?? nonEmpty(meta.timestamp),
    subagentHistoryStartOrdinal: typeof start === "number" && Number.isInteger(start) && start >= 0 ? start : null,
    agentAuthored: isAgentSource(payload.source)
  };
}
async function readCodexHeader(file, size) {
  for (const maxBytes of [HEADER_FIRST_BYTES, HEADER_MAX_BYTES]) {
    const { records } = await readMetadataRecordsBounded(file, {
      maxBytes,
      maxRecords: 2,
      diagnostic: noDiagnostic
    });
    const header = headerFrom(records);
    if (header || size <= maxBytes) return header;
  }
  return null;
}
function isInheritedRecord(file, record) {
  const start = file.subagentHistoryStartOrdinal;
  return typeof start === "number" && typeof record.ordinal === "number" && record.ordinal < start;
}
function isImageOnly(value) {
  const blocks = Array.isArray(value) ? value : isObject2(value) && Array.isArray(value.content) ? value.content : null;
  return blocks !== null && blocks.length > 0 && blocks.every((block) => isObject2(block) && block.type === "input_image");
}
function codexOutputText(output, depth = 0) {
  if (typeof output === "string") {
    const trimmed = output.trimStart();
    if (depth === 0 && /^[[{"]/u.test(trimmed)) {
      let parsed;
      try {
        parsed = JSON.parse(output);
      } catch {
        return output;
      }
      const decoded = codexOutputText(parsed, depth + 1);
      if (decoded.trim() !== "") return decoded;
      return isImageOnly(parsed) ? "" : output;
    }
    return output;
  }
  if (Array.isArray(output)) {
    return output.map((block) => {
      if (typeof block === "string") return block;
      if (isObject2(block)) {
        const text = asString2(block.text);
        if (text !== void 0) return text;
        if (block.type === "input_image") return "";
      }
      return block === null || block === void 0 ? "" : JSON.stringify(block);
    }).filter((text) => text !== "").join("\n");
  }
  if (isObject2(output)) {
    if (typeof output.output === "string") return output.output;
    if (Array.isArray(output.content)) {
      return codexOutputText(output.content, 1);
    }
    return JSON.stringify(output);
  }
  return output === null || output === void 0 ? "" : JSON.stringify(output);
}
var MCP_RESULT_KNOWN_KEYS = /* @__PURE__ */ new Set([
  "content",
  "structuredContent",
  "isError"
]);
function optionalOutputText(value) {
  return value === void 0 || value === null ? "" : codexOutputText(value);
}
function toolArgumentsText(name, args) {
  if (args === void 0 || args === null) return "";
  return `[${name}] ${typeof args === "string" ? args : JSON.stringify(args)}`;
}
function itemCompletedToolTexts(item) {
  switch (item.type) {
    case "CommandExecution":
      return [asString2(item.aggregated_output) ?? asString2(item.stdout) ?? ""];
    case "McpToolCall": {
      const name = [asString2(item.server), asString2(item.tool)].filter((part) => part !== void 0).join(".");
      const result = item.result;
      const texts = [toolArgumentsText(name || "mcp", item.arguments)];
      if (isObject2(result)) {
        texts.push(optionalOutputText(result.content));
        if (result.structuredContent !== void 0) {
          texts.push(JSON.stringify(result.structuredContent));
        }
        const rest = Object.entries(result).filter(
          ([key]) => !MCP_RESULT_KNOWN_KEYS.has(key)
        );
        if (rest.length > 0) {
          texts.push(JSON.stringify(Object.fromEntries(rest)));
        }
      } else {
        texts.push(optionalOutputText(result));
      }
      texts.push(optionalOutputText(item.error));
      return texts;
    }
    case "CollabAgentToolCall":
    case "Extension":
      return ["result", "results", "output", "content"].map(
        (key) => optionalOutputText(item[key])
      );
    case "FileChange":
      return [asString2(item.summary) ?? asString2(item.stdout) ?? ""];
    default:
      return [];
  }
}
function codexToolUnits(record) {
  const payload = isObject2(record.payload) ? record.payload : null;
  if (!payload) return [];
  const texts = [];
  if (record.type === "response_item") {
    const name = asString2(payload.name) ?? asString2(payload.type) ?? "tool";
    switch (payload.type) {
      case "function_call_output":
      case "custom_tool_call_output":
        texts.push(codexOutputText(payload.output));
        break;
      case "function_call": {
        const args = payload.arguments;
        texts.push(
          `[${name}] ${typeof args === "string" ? args : JSON.stringify(args ?? {})}`
        );
        break;
      }
      case "custom_tool_call":
        texts.push(`[${name}] ${asString2(payload.input) ?? ""}`);
        break;
      default:
        break;
    }
  } else if (record.type === "event_msg") {
    if (payload.type === "item_completed" && isObject2(payload.item)) {
      texts.push(...itemCompletedToolTexts(payload.item));
    } else if (payload.type === "exec_command_end") {
      texts.push(
        asString2(payload.aggregated_output) ?? asString2(payload.stdout) ?? asString2(payload.formatted_output) ?? ""
      );
    }
  }
  return texts.filter((text) => text.trim() !== "").map((text) => ({ role: "tool", text }));
}
function classifyCodexRecord(record, includeTools) {
  const payload = isObject2(record.payload) ? record.payload : null;
  const isAskCall = record.type === "response_item" && payload?.type === "function_call" && payload.name === ASK_USER_TOOL;
  const conversational = record.type === "response_item" && (payload?.type === "message" || isAskCall);
  const units = conversational ? unitsFromEntries(normalizeEntries(RUNTIME, [record]), RUNTIME) : [];
  if (!includeTools || isAskCall && units.length > 0) return units;
  return [...units, ...codexToolUnits(record)];
}
function askAnswerValues(value) {
  if (typeof value === "string") return value.trim() === "" ? [] : [value];
  if (Array.isArray(value)) return value.flatMap(askAnswerValues);
  if (isObject2(value)) return askAnswerValues(value.answers);
  return [];
}
function codexAnswerText(call, record) {
  const callPayload = isObject2(call.payload) ? call.payload : {};
  const payload = isObject2(record.payload) ? record.payload : {};
  const args = typeof callPayload.arguments === "string" ? parseJsonObject(callPayload.arguments) : isObject2(callPayload.arguments) ? callPayload.arguments : null;
  const labels = /* @__PURE__ */ new Map();
  for (const question of Array.isArray(args?.questions) ? args.questions : []) {
    if (!isObject2(question)) continue;
    const id = asString2(question.id);
    const label = asString2(question.header) ?? asString2(question.question) ?? asString2(question.prompt);
    if (id && label) labels.set(id, label);
  }
  const output = typeof payload.output === "string" ? parseJsonObject(payload.output) : isObject2(payload.output) ? payload.output : null;
  if (output && isObject2(output.answers)) {
    const lines = Object.entries(output.answers).flatMap(([id, value]) => {
      const answers = askAnswerValues(value);
      return answers.length === 0 ? [] : [`${labels.get(id) ?? id}: ${answers.join(", ")}`];
    });
    if (lines.length > 0) return lines.join("\n");
  }
  return codexOutputText(payload.output);
}
var MAX_TOOL_TEXT_HASHES = 4096;
function createCodexFileClassifier() {
  const askCalls = /* @__PURE__ */ new Map();
  const toolHashes = /* @__PURE__ */ new Set();
  const firstToolSighting = (unit) => {
    if (unit.role !== "tool") return true;
    const hash = createHash("sha256").update(unit.text).digest("base64");
    if (toolHashes.has(hash)) return false;
    if (toolHashes.size < MAX_TOOL_TEXT_HASHES) toolHashes.add(hash);
    return true;
  };
  return (record, includeTools) => {
    const payload = isObject2(record.payload) ? record.payload : null;
    const callId = asString2(payload?.call_id);
    if (record.type === "response_item" && payload && callId) {
      if (payload.type === "function_call" && payload.name === ASK_USER_TOOL) {
        askCalls.set(callId, record);
      } else if (payload.type === "function_call_output") {
        const call = askCalls.get(callId);
        if (call) {
          const [answer] = unitsFromEntries(
            normalizeEntries(RUNTIME, [call, record]).filter(
              (entry) => entry.recordIndex === 1
            ),
            RUNTIME
          );
          if (answer) {
            const text = codexAnswerText(call, record);
            return text.trim() === "" ? [] : [{ role: answer.role, text }];
          }
        }
      }
    }
    return classifyCodexRecord(record, includeTools).filter(firstToolSighting);
  };
}
function sqliteJson(sqlite3, db, sql) {
  const result = spawnSync(sqlite3, ["-readonly", "-json", db, sql], {
    encoding: "utf8",
    timeout: SQLITE_TIMEOUT_MS,
    maxBuffer: SQLITE_MAX_OUTPUT,
    windowsHide: true
  });
  if (result.error) return { error: result.error.message };
  if (result.status !== 0) {
    const detail = (result.stderr ?? "").trim().split("\n")[0] ?? "";
    return {
      error: `exit ${result.status ?? "signal"}${detail ? `: ${detail}` : ""}`
    };
  }
  const out = (result.stdout ?? "").trim();
  if (out === "") return { rows: [] };
  try {
    const parsed = JSON.parse(out);
    return Array.isArray(parsed) ? { rows: parsed.filter(isObject2) } : { error: "unexpected JSON output" };
  } catch {
    return { error: "unparseable JSON output" };
  }
}
function threadFromRow(row) {
  const id = nonEmpty(row.id);
  if (!id) return null;
  const source = row.source;
  let parentId = null;
  let plainSource = false;
  if (typeof source === "string") {
    const trimmed = source.trim();
    if (trimmed.startsWith("{")) {
      const parsed = parseJsonObject(trimmed);
      const spawn = parsed && isObject2(parsed.subagent) && isObject2(parsed.subagent.thread_spawn) ? parsed.subagent.thread_spawn : null;
      parentId = nonEmpty(spawn?.parent_thread_id);
    } else if (trimmed !== "") {
      plainSource = true;
    }
  }
  const cwd = nonEmpty(row.cwd);
  return {
    id,
    rolloutPath: nonEmpty(row.rollout_path),
    title: nonEmpty(row.title),
    firstUserMessage: nonEmpty(row.first_user_message),
    cwd: cwd && path.isAbsolute(cwd) ? cwd : null,
    createdAtMs: toEpochMs(row.created_at),
    updatedAtMs: toEpochMs(row.updated_at),
    archived: row.archived === 1 || row.archived === true || row.archived === "1",
    gitOriginUrl: nonEmpty(row.git_origin_url),
    parentId,
    plainSource,
    agentAuthored: isAgentSource(source)
  };
}
function createCodexAdapter() {
  let threadsPromise = null;
  let threadById = /* @__PURE__ */ new Map();
  let indexPromise = null;
  let lastRoots = null;
  const headers = /* @__PURE__ */ new Map();
  const infos = /* @__PURE__ */ new Map();
  const headerFor = (file) => {
    let cached = headers.get(file.path);
    if (!cached) {
      cached = readCodexHeader(file.path, file.size).catch(() => null);
      headers.set(file.path, cached);
    }
    return cached;
  };
  const loadThreads = (ctx) => {
    if (threadsPromise) return threadsPromise;
    threadsPromise = (async () => {
      const sqlite3 = ctx.tools.sqlite3;
      const db = ctx.roots.paths.sqlite;
      if (!sqlite3 || !db) return null;
      const probe = sqliteJson(sqlite3, db, "PRAGMA table_info(threads)");
      if ("error" in probe) {
        ctx.degrade(
          `state_5.sqlite threads probe failed (${probe.error}); skipping the sqlite tier`
        );
        return null;
      }
      const available = new Set(
        probe.rows.map((row) => asString2(row.name)).filter((name) => name !== void 0)
      );
      if (!available.has("id") || !available.has("rollout_path")) {
        ctx.degrade(
          "state_5.sqlite threads table lacks id/rollout_path columns; skipping the sqlite tier"
        );
        return null;
      }
      const columns = THREAD_COLUMNS.filter((column) => available.has(column));
      const select = sqliteJson(
        sqlite3,
        db,
        `SELECT ${columns.map((column) => `"${column}"`).join(", ")} FROM threads`
      );
      if ("error" in select) {
        ctx.degrade(
          `state_5.sqlite threads query failed (${select.error}); skipping the sqlite tier`
        );
        return null;
      }
      const threads = select.rows.map(threadFromRow).filter((thread) => thread !== null);
      threadById = new Map(threads.map((thread) => [thread.id, thread]));
      return threads;
    })();
    return threadsPromise;
  };
  const loadIndex = (roots) => {
    if (indexPromise) return indexPromise;
    indexPromise = (async () => {
      const index = /* @__PURE__ */ new Map();
      const file = roots.paths.sessionIndex;
      if (!file) return index;
      await readLines(file, { maxLineBytes: LINE_MAX_BYTES }, (event) => {
        if (event.kind !== "line") return;
        const record = parseJsonObject(event.text);
        const id = nonEmpty(record?.id);
        const title = nonEmpty(record?.thread_name);
        if (!record || !id || !title) return;
        index.set(id, { title, updatedAtMs: toEpochMs(record.updated_at) });
      }).catch(() => {
      });
      return index;
    })();
    return indexPromise;
  };
  const adapter = {
    runtime: RUNTIME,
    threads: loadThreads,
    roots(home) {
      const base = path.join(home, ".codex");
      const root = path.join(base, "sessions");
      const archived = path.join(base, "archived_sessions");
      const file = (name) => {
        const full = path.join(base, name);
        return existsAs(full, "file") ? full : null;
      };
      const archivedExists = existsAs(archived, "dir");
      return {
        runtime: RUNTIME,
        root,
        exists: existsAs(root, "dir") || archivedExists,
        paths: {
          archived: archivedExists ? archived : null,
          history: file("history.jsonl"),
          sessionIndex: file("session_index.jsonl"),
          sqlite: file("state_5.sqlite")
        }
      };
    },
    async enumerate(ctx) {
      lastRoots = ctx.roots;
      if (!ctx.roots.exists) return [];
      const live = [];
      const archived = [];
      await collectRollouts(ctx.roots.root, live);
      if (ctx.roots.paths.archived) {
        await collectRollouts(ctx.roots.paths.archived, archived);
      }
      const threads = await loadThreads(ctx);
      const threadByPath = /* @__PURE__ */ new Map();
      for (const thread of threads ?? []) {
        if (thread.rolloutPath)
          threadByPath.set(path.resolve(thread.rolloutPath), thread);
      }
      const files = [];
      const entries = [
        ...live.toSorted().map((file) => ({ file, archived: false })),
        ...archived.toSorted().map((file) => ({ file, archived: true }))
      ];
      for (const entry of entries) {
        const name = parseRolloutName(entry.file);
        if (!name) continue;
        let stats;
        try {
          stats = await stat(entry.file);
        } catch {
          continue;
        }
        if (!stats.isFile()) continue;
        const thread = threadByPath.get(path.resolve(entry.file)) ?? threadById.get(name.sessionId);
        const file = {
          runtime: RUNTIME,
          path: entry.file,
          sessionId: name.sessionId,
          parentSessionId: thread?.parentId ?? null,
          isSubagent: thread?.parentId != null,
          archived: entry.archived || thread?.archived === true,
          mtimeMs: stats.mtimeMs,
          size: stats.size,
          createdAtMs: thread?.createdAtMs ?? name.startedAtMs,
          cwd: thread?.cwd ?? void 0,
          agentAuthored: thread?.agentAuthored === true
        };
        const needsHeader = !(thread?.plainSource && thread.cwd);
        const expired = ctx.deadline != null && Date.now() >= ctx.deadline;
        if (needsHeader && !expired && inTimeWindow(file, ctx.options.since, ctx.options.until)) {
          const header = await headerFor(file);
          if (header) {
            if (header.rootId && header.id && header.rootId !== header.id) {
              file.isSubagent = true;
              file.parentSessionId = header.rootId;
            }
            file.subagentHistoryStartOrdinal = header.subagentHistoryStartOrdinal;
            file.cwd ??= header.cwd;
            if (header.agentAuthored) file.agentAuthored = true;
          }
        }
        files.push(file);
      }
      return files;
    },
    async historyHits(ctx, matcher) {
      const history = ctx.roots.paths.history;
      if (!history) return [];
      const hits = [];
      try {
        await readLines(history, { maxLineBytes: LINE_MAX_BYTES }, (event) => {
          if (event.kind !== "line") return;
          const record = parseJsonObject(event.text);
          const text = asString2(record?.text);
          const sessionId = nonEmpty(record?.session_id);
          if (!record || !text || !sessionId) return;
          const match = matcher.match(text);
          if (!match) return;
          hits.push({
            runtime: RUNTIME,
            sessionId,
            tier: "history",
            role: "user",
            userTyped: true,
            patterns: match.patterns,
            text,
            firstIndex: match.firstIndex,
            firstLength: match.firstLength,
            transcriptPath: null,
            cwd: null,
            timestampMs: toEpochMs(record.ts)
          });
        });
      } catch {
        ctx.degrade("history.jsonl could not be read");
      }
      return hits;
    },
    async metadataHits(ctx, matcher) {
      lastRoots = ctx.roots;
      const hits = [];
      const seen = /* @__PURE__ */ new Set();
      const push = (hit) => {
        const key = `${hit.sessionId}\0${hit.role}\0${hit.text}`;
        if (seen.has(key)) return;
        const match = matcher.match(hit.text);
        if (!match) return;
        seen.add(key);
        hits.push({
          ...hit,
          patterns: match.patterns,
          firstIndex: match.firstIndex,
          firstLength: match.firstLength
        });
      };
      for (const thread of await loadThreads(ctx) ?? []) {
        const base = {
          runtime: RUNTIME,
          sessionId: thread.id,
          tier: "meta",
          transcriptPath: thread.rolloutPath,
          cwd: thread.cwd,
          timestampMs: thread.updatedAtMs ?? thread.createdAtMs
        };
        if (thread.title) {
          push({
            ...base,
            role: "title",
            userTyped: false,
            text: thread.title
          });
        }
        if (thread.firstUserMessage) {
          const role = demoteRole("user", thread.firstUserMessage, RUNTIME);
          push({
            ...base,
            role,
            userTyped: role === "user" && !thread.agentAuthored,
            text: thread.firstUserMessage
          });
        }
      }
      for (const [id, entry] of await loadIndex(ctx.roots)) {
        push({
          runtime: RUNTIME,
          sessionId: id,
          tier: "meta",
          role: "title",
          userTyped: false,
          text: entry.title,
          transcriptPath: null,
          cwd: null,
          timestampMs: entry.updatedAtMs
        });
      }
      return hits;
    },
    sessionInfo(file) {
      let cached = infos.get(file.path);
      if (!cached) {
        cached = (async () => {
          const thread = threadById.get(file.sessionId);
          const header = await headerFor(file);
          const index = lastRoots ? await loadIndex(lastRoots) : null;
          let firstPrompt = thread?.firstUserMessage && !isInjectedUserText(thread.firstUserMessage, RUNTIME) ? thread.firstUserMessage : null;
          if (firstPrompt === null) {
            const { records } = await readMetadataRecordsBounded(file.path, {
              maxBytes: INFO_READ_BYTES,
              maxRecords: 64,
              diagnostic: noDiagnostic
            });
            const startOrdinal = header?.subagentHistoryStartOrdinal ?? null;
            for (const record of records) {
              if (isInheritedRecord(
                { subagentHistoryStartOrdinal: startOrdinal },
                record
              )) {
                continue;
              }
              const unit = classifyCodexRecord(record, false).find(
                (candidate) => candidate.role === "user"
              );
              if (unit) {
                firstPrompt = unit.text;
                break;
              }
            }
          }
          const startMs = toEpochMs(header?.timestamp) ?? thread?.createdAtMs ?? null;
          return {
            cwd: file.cwd ?? thread?.cwd ?? header?.cwd ?? null,
            title: thread?.title ?? index?.get(file.sessionId)?.title ?? null,
            firstPrompt,
            startedAt: startMs === null ? null : new Date(startMs).toISOString()
          };
        })().catch(() => ({
          cwd: file.cwd ?? null,
          title: null,
          firstPrompt: null,
          startedAt: null
        }));
        infos.set(file.path, cached);
      }
      return cached;
    },
    classifyRecord: classifyCodexRecord,
    fileClassifier: createCodexFileClassifier,
    openHint(sessionId, info) {
      return {
        command: `codex resume ${sessionId}`,
        hint: info.cwd ? `run from ${info.cwd}` : "resume from the session directory"
      };
    }
  };
  return adapter;
}
export {
  MAX_TOOL_TEXT_HASHES,
  classifyCodexRecord,
  codexOutputText,
  createCodexAdapter,
  createCodexFileClassifier,
  isAgentSource,
  isInheritedRecord,
  parseRolloutName,
  readCodexHeader
};
