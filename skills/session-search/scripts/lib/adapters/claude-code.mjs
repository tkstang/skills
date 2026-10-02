// GENERATED skill payload for session-search.

// src/skills/session-search/src/lib/adapters/claude-code.ts
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

// src/skills/session-search/src/lib/adapters/claude-code.ts
var RUNTIME = "claude-code";
var TITLE_READ_BYTES = 256 * 1024;
var INFO_READ_BYTES = 512 * 1024;
var HISTORY_MAX_LINE_BYTES = 1024 * 1024;
var ASK_USER_TOOL = "AskUserQuestion";
var noDiagnostic = () => {
};
function isObject2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function asString2(value) {
  return typeof value === "string" ? value : void 0;
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
function birthStart(birthtimeMs, mtimeMs) {
  return birthtimeMs > 0 && birthtimeMs <= mtimeMs ? birthtimeMs : null;
}
async function statSession(file, base) {
  try {
    const stats = await stat(file);
    if (!stats.isFile()) return null;
    return {
      ...base,
      path: file,
      mtimeMs: stats.mtimeMs,
      size: stats.size,
      createdAtMs: birthStart(stats.birthtimeMs, stats.mtimeMs)
    };
  } catch {
    return null;
  }
}
async function collectAgentFiles(dir, out) {
  for (const entry of await listDir(dir)) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await collectAgentFiles(full, out);
    else if (entry.isFile() && entry.name.startsWith("agent-") && entry.name.endsWith(".jsonl")) {
      out.push(full);
    }
  }
}
function pickTitle(records) {
  let custom = null;
  let generated = null;
  for (const record of records) {
    if (record.type === "custom-title") {
      const title = asString2(record.customTitle)?.trim();
      if (title) custom = title;
    } else if (record.type === "ai-title") {
      const title = asString2(record.aiTitle)?.trim();
      if (title) generated = title;
    }
  }
  return custom ?? generated;
}
function toolUnits(record, skipResults = /* @__PURE__ */ new Set()) {
  const message = isObject2(record.message) ? record.message : null;
  const content = message?.content;
  if (!Array.isArray(content)) return [];
  const units = [];
  for (const block of content) {
    if (!isObject2(block)) continue;
    if (block.type === "tool_result") {
      if (skipResults.has(asString2(block.tool_use_id) ?? "")) continue;
      let text = "";
      if (typeof block.content === "string") text = block.content;
      else if (Array.isArray(block.content)) {
        text = block.content.filter(isObject2).map((part) => asString2(part.text) ?? "").filter((part) => part !== "").join("\n");
      }
      if (text.trim() !== "") units.push({ role: "tool", text });
    } else if (block.type === "tool_use") {
      const name = asString2(block.name) ?? "tool_use";
      if (name === ASK_USER_TOOL) continue;
      const input = typeof block.input === "string" ? block.input : JSON.stringify(block.input ?? {});
      units.push({ role: "tool", text: `[${name}] ${input}` });
    }
  }
  return units;
}
function classifyClaudeRecord(record, includeTools) {
  let units = unitsFromEntries(normalizeEntries(RUNTIME, [record]), RUNTIME);
  if (record.isCompactSummary === true || record.isMeta === true) {
    units = units.map(
      (unit) => unit.role === "user" ? { ...unit, role: "context" } : unit
    );
  }
  return includeTools ? [...units, ...toolUnits(record)] : units;
}
function createClaudeFileClassifier() {
  const askCalls = /* @__PURE__ */ new Map();
  return (record, includeTools) => {
    const message = isObject2(record.message) ? record.message : null;
    const content = Array.isArray(message?.content) ? message.content : [];
    const pairedCalls = [];
    const answerBlocks = [];
    for (const block of content) {
      if (!isObject2(block)) continue;
      const id = asString2(block.id);
      if (block.type === "tool_use" && block.name === ASK_USER_TOOL && id) {
        askCalls.set(id, block);
      }
      const answerOf = asString2(block.tool_use_id);
      const call = answerOf ? askCalls.get(answerOf) : void 0;
      if (block.type === "tool_result" && answerOf && call) {
        pairedCalls.push(call);
        answerBlocks.push(block);
      }
    }
    if (pairedCalls.length === 0) {
      return classifyClaudeRecord(record, includeTools);
    }
    const question = {
      type: "assistant",
      message: { role: "assistant", content: pairedCalls }
    };
    const entries = normalizeEntries(RUNTIME, [question, record]).filter(
      (entry) => entry.recordIndex === 1
    );
    const askEntries = entries.filter((entry) => entry.kind === "ask_user");
    const units = unitsFromEntries(
      entries.filter((entry) => entry.kind !== "ask_user"),
      RUNTIME
    );
    const [askUnit] = unitsFromEntries(askEntries, RUNTIME);
    const answered = /* @__PURE__ */ new Set();
    if (askUnit) {
      const seen = /* @__PURE__ */ new Set();
      for (const block of answerBlocks) {
        answered.add(asString2(block.tool_use_id) ?? "");
        for (const text of claudeAnswerTexts(record, block)) {
          if (text.trim() === "" || seen.has(text)) continue;
          seen.add(text);
          units.push({ role: askUnit.role, text });
        }
      }
    }
    return includeTools ? [...units, ...toolUnits(record, answered)] : units;
  };
}
function askAnswerValues(value) {
  if (typeof value === "string") return value.trim() === "" ? [] : [value];
  if (Array.isArray(value)) return value.flatMap(askAnswerValues);
  if (isObject2(value)) return askAnswerValues(value.answers);
  return [];
}
function claudeAnswerTexts(record, block) {
  const result = isObject2(record.toolUseResult) ? record.toolUseResult : null;
  if (result && isObject2(result.answers)) {
    const annotations = isObject2(result.annotations) ? result.annotations : {};
    const texts = Object.entries(result.answers).flatMap(([prompt, value]) => {
      const answers = askAnswerValues(value);
      if (answers.length === 0) return [];
      const annotation = annotations[prompt];
      const note = isObject2(annotation) ? asString2(annotation.notes) : void 0;
      return [prompt, ...answers, ...note ? [note] : []];
    });
    if (texts.length > 0) return texts;
  }
  if (typeof block.content === "string") return [block.content];
  if (!Array.isArray(block.content)) return [];
  return block.content.filter(isObject2).map((part) => asString2(part.text) ?? "").filter((part) => part !== "");
}
function claudeSlugMatchesCwd(slug, hint) {
  return encodeCwdVariants(RUNTIME, hint).some(
    (variant) => slug === variant || slug.startsWith(`${variant}-`)
  );
}
function createClaudeCodeAdapter() {
  const titles = /* @__PURE__ */ new Map();
  const infos = /* @__PURE__ */ new Map();
  const titleFor = (file) => {
    let cached = titles.get(file);
    if (!cached) {
      cached = (async () => {
        const tail = await readTailRecordsBounded(file, {
          maxBytes: TITLE_READ_BYTES,
          maxRecords: 4096,
          diagnostic: noDiagnostic
        });
        const fromTail = pickTitle(tail.records);
        if (fromTail !== null || !tail.truncated) return fromTail;
        const prefix = await readMetadataRecordsBounded(file, {
          maxBytes: TITLE_READ_BYTES,
          maxRecords: 4096,
          diagnostic: noDiagnostic
        });
        return pickTitle(prefix.records);
      })().catch(() => null);
      titles.set(file, cached);
    }
    return cached;
  };
  const adapter = {
    runtime: RUNTIME,
    titleFor,
    roots(home) {
      const root = path.join(home, ".claude", "projects");
      const history = path.join(home, ".claude", "history.jsonl");
      return {
        runtime: RUNTIME,
        root,
        exists: existsAs(root, "dir"),
        paths: { history: existsAs(history, "file") ? history : null }
      };
    },
    async enumerate(ctx) {
      if (!ctx.roots.exists) return [];
      const files = [];
      for (const project of await listDir(ctx.roots.root)) {
        if (!project.isDirectory()) continue;
        const projectDir = path.join(ctx.roots.root, project.name);
        for (const entry of await listDir(projectDir)) {
          const full = path.join(projectDir, entry.name);
          if (entry.isFile() && entry.name.endsWith(".jsonl")) {
            const sessionId = entry.name.slice(0, -".jsonl".length);
            const file = await statSession(full, {
              runtime: RUNTIME,
              sessionId,
              parentSessionId: null,
              isSubagent: false,
              archived: false,
              projectSlug: project.name
            });
            if (file) files.push(file);
          } else if (entry.isDirectory()) {
            const agentFiles = [];
            await collectAgentFiles(path.join(full, "subagents"), agentFiles);
            for (const agentFile of agentFiles.toSorted()) {
              const file = await statSession(agentFile, {
                runtime: RUNTIME,
                sessionId: path.basename(agentFile, ".jsonl"),
                parentSessionId: entry.name,
                isSubagent: true,
                archived: false,
                projectSlug: project.name
              });
              if (file) files.push(file);
            }
          }
        }
      }
      return files;
    },
    async historyHits(ctx, matcher) {
      const history = ctx.roots.paths.history;
      if (!history) return [];
      const hits = [];
      try {
        await readLines(
          history,
          { maxLineBytes: HISTORY_MAX_LINE_BYTES },
          (event) => {
            if (event.kind !== "line") return;
            const record = parseJsonObject(event.text);
            const display = asString2(record?.display);
            const sessionId = asString2(record?.sessionId);
            if (!record || !display || !sessionId) return;
            const match = matcher.match(display);
            if (!match) return;
            const timestamp = record.timestamp;
            hits.push({
              runtime: RUNTIME,
              sessionId,
              tier: "history",
              role: "user",
              userTyped: true,
              patterns: match.patterns,
              text: display,
              firstIndex: match.firstIndex,
              firstLength: match.firstLength,
              transcriptPath: null,
              cwd: asString2(record.project) ?? null,
              timestampMs: typeof timestamp === "number" && Number.isFinite(timestamp) ? timestamp : null
            });
          }
        );
      } catch {
        ctx.degrade("history.jsonl could not be read");
      }
      return hits;
    },
    async metadataHits(ctx, matcher) {
      const hits = [];
      for (const file of ctx.files) {
        if (ctx.deadline != null && Date.now() >= ctx.deadline) break;
        if (file.runtime !== RUNTIME || file.isSubagent) continue;
        const title = await titleFor(file.path);
        if (!title) continue;
        const match = matcher.match(title);
        if (!match) continue;
        hits.push({
          runtime: RUNTIME,
          sessionId: file.sessionId,
          tier: "meta",
          role: "title",
          userTyped: false,
          patterns: match.patterns,
          text: title,
          firstIndex: match.firstIndex,
          firstLength: match.firstLength,
          transcriptPath: file.path,
          cwd: file.cwd ?? null,
          timestampMs: file.mtimeMs
        });
      }
      return hits;
    },
    sessionInfo(file) {
      let cached = infos.get(file.path);
      if (!cached) {
        cached = (async () => {
          const { records } = await readMetadataRecordsBounded(file.path, {
            maxBytes: INFO_READ_BYTES,
            maxRecords: 256,
            diagnostic: noDiagnostic
          });
          let cwd = null;
          let startedAt = null;
          let firstPrompt = null;
          for (const record of records) {
            const recordCwd = asString2(record.cwd);
            if (cwd === null && recordCwd && path.isAbsolute(recordCwd)) {
              cwd = recordCwd;
            }
            const timestamp = asString2(record.timestamp);
            if (startedAt === null && timestamp && !Number.isNaN(Date.parse(timestamp))) {
              startedAt = new Date(timestamp).toISOString();
            }
            if (firstPrompt === null) {
              const unit = classifyClaudeRecord(record, false).find(
                (candidate) => candidate.role === "user"
              );
              if (unit) firstPrompt = unit.text;
            }
            if (cwd !== null && startedAt !== null && firstPrompt !== null)
              break;
          }
          const title = file.isSubagent ? null : await titleFor(file.path);
          return { cwd, title, firstPrompt, startedAt };
        })().catch(() => ({
          cwd: null,
          title: null,
          firstPrompt: null,
          startedAt: null
        }));
        infos.set(file.path, cached);
      }
      return cached;
    },
    classifyRecord: classifyClaudeRecord,
    fileClassifier: createClaudeFileClassifier,
    openHint(sessionId, info) {
      return {
        command: `claude --resume ${sessionId}`,
        hint: info.cwd ? `run from ${info.cwd}` : "run from the session's project directory"
      };
    }
  };
  return adapter;
}
export {
  classifyClaudeRecord,
  claudeSlugMatchesCwd,
  createClaudeCodeAdapter,
  createClaudeFileClassifier
};
