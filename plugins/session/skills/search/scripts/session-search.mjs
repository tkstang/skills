// GENERATED skill payload for session-search.

// src/skills/session-search/src/session-search.ts
import { realpathSync } from "node:fs";
import os3 from "node:os";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// src/skills/session-search/src/lib/options.ts
import os from "node:os";
import path from "node:path";
var DEFAULT_LIMIT = 15;
var DEFAULT_MAX_LINE_BYTES = 64 * 1024;
var DEFAULT_LARGE_SCAN_BYTES = 2 * 1024 * 1024 * 1024;
var ALL_RUNTIMES = [
  "claude-code",
  "codex",
  "cursor"
];
var SELECTABLE_TIERS = ["history", "meta", "content"];
var UsageError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "UsageError";
  }
};
var HOUR_MS = 60 * 60 * 1e3;
var UNIT_MS = {
  h: HOUR_MS,
  d: 24 * HOUR_MS,
  w: 7 * 24 * HOUR_MS
};
function startOfLocalDay(ms, dayOffset = 0) {
  const date = new Date(ms);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + dayOffset
  ).getTime();
}
function isValidCalendarDate(year, month, day) {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
function parseTimeSpec(spec, now, bound = "since") {
  const value = spec.trim();
  const invalid = () => new UsageError(
    `Invalid time value "${spec}". Use Nh, Nd, Nw, today, yesterday, YYYY-MM-DD, or an ISO date-time.`
  );
  if (value === "") throw invalid();
  const relative = /^(\d+)([hdw])$/i.exec(value);
  if (relative) {
    const amount = Number(relative[1]);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw invalid();
    return now - amount * UNIT_MS[relative[2].toLowerCase()];
  }
  const keyword = value.toLowerCase();
  const untilOffset = bound === "until" ? 1 : 0;
  if (keyword === "today") return startOfLocalDay(now, untilOffset);
  if (keyword === "yesterday") return startOfLocalDay(now, -1 + untilOffset);
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [year, month, day] = dateOnly.slice(1).map(Number);
    if (!isValidCalendarDate(year, month, day)) throw invalid();
    return new Date(year, month - 1, day + untilOffset).getTime();
  }
  const dateTime = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (dateTime) {
    const [year, month, day, hour, minute] = dateTime.slice(1).map(Number);
    if (!isValidCalendarDate(year, month, day) || hour > 23 || minute > 59) {
      throw invalid();
    }
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  throw invalid();
}
function valueList(raw, key) {
  const value = raw[key];
  if (value === void 0) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map((item) => {
    if (typeof item !== "string") {
      throw new UsageError(`--${key} requires a value.`);
    }
    return item;
  });
}
function lastValue(raw, key) {
  const list = valueList(raw, key);
  return list.length > 0 ? list[list.length - 1] : void 0;
}
function flag(raw, key) {
  const value = raw[key];
  const last = Array.isArray(value) ? value[value.length - 1] : value;
  return last === true || last === "true";
}
function positiveInteger(raw, key, fallback) {
  const value = lastValue(raw, key);
  if (value === void 0) return fallback;
  if (!/^\d+$/.test(value.trim())) {
    throw new UsageError(
      `--${key} must be a positive integer, got "${value}".`
    );
  }
  const parsed = Number(value.trim());
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new UsageError(
      `--${key} must be a positive integer, got "${value}".`
    );
  }
  return parsed;
}
function commaList(raw, key) {
  return valueList(raw, key).flatMap((value) => value.split(",")).map((value) => value.trim()).filter((value) => value !== "");
}
function pickList(raw, key, allowed) {
  const requested = commaList(raw, key);
  if (requested.length === 0) return [...allowed];
  const selected = /* @__PURE__ */ new Set();
  for (const value of requested) {
    if (!allowed.includes(value)) {
      throw new UsageError(
        `Unknown --${key} value "${value}". Expected one of ${allowed.join(", ")}.`
      );
    }
    selected.add(value);
  }
  return allowed.filter((value) => selected.has(value));
}
function normalizeCwd(hint, home, base) {
  let value = hint.trim();
  if (value === "~") value = home;
  else if (value.startsWith("~/")) value = path.join(home, value.slice(2));
  return path.resolve(base, value);
}
function resolveOptions(raw, context = {}) {
  const now = context.now ?? Date.now();
  const home = context.home ?? os.homedir();
  const base = context.cwd ?? process.cwd();
  const patterns = [...new Set(valueList(raw, "pattern"))];
  if (patterns.some((pattern) => pattern === "")) {
    throw new UsageError("A --pattern value must not be empty.");
  }
  const sinceSpec = lastValue(raw, "since");
  const untilSpec = lastValue(raw, "until");
  const since = sinceSpec === void 0 ? null : parseTimeSpec(sinceSpec, now, "since");
  const until = untilSpec === void 0 ? null : parseTimeSpec(untilSpec, now, "until");
  if (since !== null && until !== null && until < since) {
    throw new UsageError(
      `--until (${untilSpec}) is earlier than --since (${sinceSpec}).`
    );
  }
  const cwdHints = [];
  for (const hint of valueList(raw, "cwd")) {
    if (hint.trim() === "") throw new UsageError("--cwd requires a value.");
    const normalized = normalizeCwd(hint, home, base);
    if (!cwdHints.includes(normalized)) cwdHints.push(normalized);
  }
  const deadline = lastValue(raw, "deadline-ms");
  return {
    patterns,
    literal: flag(raw, "literal"),
    since,
    until,
    cwdHints,
    runtimes: pickList(raw, "runtime", ALL_RUNTIMES),
    tiers: pickList(raw, "tiers", SELECTABLE_TIERS),
    deep: !flag(raw, "no-deep"),
    includeTools: flag(raw, "include-tools"),
    allowLargeScan: flag(raw, "allow-large-scan"),
    largeScanBytes: positiveInteger(
      raw,
      "large-scan-bytes",
      DEFAULT_LARGE_SCAN_BYTES
    ),
    maxLineBytes: positiveInteger(
      raw,
      "max-line-bytes",
      DEFAULT_MAX_LINE_BYTES
    ),
    limit: positiveInteger(raw, "limit", DEFAULT_LIMIT),
    deadlineMs: deadline === void 0 ? null : positiveInteger(raw, "deadline-ms", 0),
    json: flag(raw, "json")
  };
}

// src/skills/session-search/src/lib/pipeline.ts
import os2 from "node:os";

// src/skills/session-search/src/lib/adapters/claude-code.ts
import { statSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path2 from "node:path";

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
    const full = path2.join(dir, entry.name);
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
      const root = path2.join(home, ".claude", "projects");
      const history = path2.join(home, ".claude", "history.jsonl");
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
        const projectDir = path2.join(ctx.roots.root, project.name);
        for (const entry of await listDir(projectDir)) {
          const full = path2.join(projectDir, entry.name);
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
            await collectAgentFiles(path2.join(full, "subagents"), agentFiles);
            for (const agentFile of agentFiles.toSorted()) {
              const file = await statSession(agentFile, {
                runtime: RUNTIME,
                sessionId: path2.basename(agentFile, ".jsonl"),
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
            if (cwd === null && recordCwd && path2.isAbsolute(recordCwd)) {
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

// src/skills/session-search/src/lib/adapters/codex.ts
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { statSync as statSync2 } from "node:fs";
import { readdir as readdir2, stat as stat2 } from "node:fs/promises";
import path3 from "node:path";

// src/skills/session-search/src/lib/window.ts
function inTimeWindow(file, since, until) {
  const end = file.mtimeMs;
  const start = Math.min(file.createdAtMs ?? end, end);
  if (since !== null && end < since) return false;
  if (until !== null && start > until) return false;
  return true;
}
function timeInWindow(ms, since, until) {
  if (since !== null && ms < since) return false;
  if (until !== null && ms > until) return false;
  return true;
}

// src/skills/session-search/src/lib/adapters/codex.ts
var RUNTIME2 = "codex";
var ASK_USER_TOOL2 = "request_user_input";
var ROLLOUT_NAME = /^rollout-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(.+)\.jsonl$/u;
var HEADER_FIRST_BYTES = 64 * 1024;
var HEADER_MAX_BYTES = 1024 * 1024;
var INFO_READ_BYTES2 = 1024 * 1024;
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
var noDiagnostic2 = () => {
};
function isObject3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function asString3(value) {
  return typeof value === "string" ? value : void 0;
}
function nonEmpty(value) {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}
function existsAs2(target, kind) {
  try {
    const stats = statSync2(target);
    return kind === "file" ? stats.isFile() : stats.isDirectory();
  } catch {
    return false;
  }
}
async function listDir2(dir) {
  try {
    return await readdir2(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}
async function collectRollouts(dir, out) {
  for (const entry of await listDir2(dir)) {
    const full = path3.join(dir, entry.name);
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
  const match = ROLLOUT_NAME.exec(path3.basename(file));
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
  return isObject3(value) && Object.hasOwn(value, "subagent");
}
function headerFrom(records) {
  const meta = records.find(
    (record) => record.type === "session_meta" && isObject3(record.payload)
  );
  if (!meta || !isObject3(meta.payload)) return null;
  const payload = meta.payload;
  const start = payload.subagent_history_start_ordinal;
  const cwd = nonEmpty(payload.cwd);
  return {
    id: nonEmpty(payload.id),
    rootId: nonEmpty(payload.session_id),
    cwd: cwd && path3.isAbsolute(cwd) ? cwd : null,
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
      diagnostic: noDiagnostic2
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
  const blocks = Array.isArray(value) ? value : isObject3(value) && Array.isArray(value.content) ? value.content : null;
  return blocks !== null && blocks.length > 0 && blocks.every((block) => isObject3(block) && block.type === "input_image");
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
      if (isObject3(block)) {
        const text = asString3(block.text);
        if (text !== void 0) return text;
        if (block.type === "input_image") return "";
      }
      return block === null || block === void 0 ? "" : JSON.stringify(block);
    }).filter((text) => text !== "").join("\n");
  }
  if (isObject3(output)) {
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
      return [asString3(item.aggregated_output) ?? asString3(item.stdout) ?? ""];
    case "McpToolCall": {
      const name = [asString3(item.server), asString3(item.tool)].filter((part) => part !== void 0).join(".");
      const result = item.result;
      const texts = [toolArgumentsText(name || "mcp", item.arguments)];
      if (isObject3(result)) {
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
    case "Extension":
      return [
        asString3(item.query) ?? "",
        ...["results", "result", "output", "content"].map(
          (key) => optionalOutputText(item[key])
        )
      ];
    case "FileChange":
      return [asString3(item.summary) ?? asString3(item.stdout) ?? ""];
    default:
      return [];
  }
}
function codexToolUnits(record) {
  const payload = isObject3(record.payload) ? record.payload : null;
  if (!payload) return [];
  const texts = [];
  if (record.type === "response_item") {
    const name = asString3(payload.name) ?? asString3(payload.type) ?? "tool";
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
        texts.push(`[${name}] ${asString3(payload.input) ?? ""}`);
        break;
      default:
        break;
    }
  } else if (record.type === "event_msg") {
    if (payload.type === "item_completed" && isObject3(payload.item)) {
      texts.push(...itemCompletedToolTexts(payload.item));
    } else if (payload.type === "exec_command_end") {
      texts.push(
        asString3(payload.aggregated_output) ?? asString3(payload.stdout) ?? asString3(payload.formatted_output) ?? ""
      );
    }
  }
  return texts.filter((text) => text.trim() !== "").map((text) => ({ role: "tool", text }));
}
function classifyCodexRecord(record, includeTools) {
  const payload = isObject3(record.payload) ? record.payload : null;
  const isAskCall = record.type === "response_item" && payload?.type === "function_call" && payload.name === ASK_USER_TOOL2;
  const conversational = record.type === "response_item" && (payload?.type === "message" || isAskCall);
  const units = conversational ? unitsFromEntries(normalizeEntries(RUNTIME2, [record]), RUNTIME2) : [];
  if (!includeTools || isAskCall && units.length > 0) return units;
  return [...units, ...codexToolUnits(record)];
}
function askAnswerValues2(value) {
  if (typeof value === "string") return value.trim() === "" ? [] : [value];
  if (Array.isArray(value)) return value.flatMap(askAnswerValues2);
  if (isObject3(value)) return askAnswerValues2(value.answers);
  return [];
}
function codexAnswerTexts(call, record) {
  const callPayload = isObject3(call.payload) ? call.payload : {};
  const payload = isObject3(record.payload) ? record.payload : {};
  const args = typeof callPayload.arguments === "string" ? parseJsonObject(callPayload.arguments) : isObject3(callPayload.arguments) ? callPayload.arguments : null;
  const labels = /* @__PURE__ */ new Map();
  for (const question of Array.isArray(args?.questions) ? args.questions : []) {
    if (!isObject3(question)) continue;
    const id = asString3(question.id);
    const label = asString3(question.header) ?? asString3(question.question) ?? asString3(question.prompt);
    if (id && label) labels.set(id, label);
  }
  const output = typeof payload.output === "string" ? parseJsonObject(payload.output) : isObject3(payload.output) ? payload.output : null;
  if (output && isObject3(output.answers)) {
    const texts = Object.entries(output.answers).flatMap(([id, value]) => {
      const answers = askAnswerValues2(value);
      return answers.length === 0 ? [] : [labels.get(id) ?? id, ...answers];
    });
    if (texts.length > 0) return texts;
  }
  return [codexOutputText(payload.output)];
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
    const payload = isObject3(record.payload) ? record.payload : null;
    const callId = asString3(payload?.call_id);
    if (record.type === "response_item" && payload && callId) {
      if (payload.type === "function_call" && payload.name === ASK_USER_TOOL2) {
        askCalls.set(callId, record);
      } else if (payload.type === "function_call_output") {
        const call = askCalls.get(callId);
        if (call) {
          const [answer] = unitsFromEntries(
            normalizeEntries(RUNTIME2, [call, record]).filter(
              (entry) => entry.recordIndex === 1
            ),
            RUNTIME2
          );
          if (answer) {
            const texts = codexAnswerTexts(call, record).filter(
              (text) => text.trim() !== ""
            );
            return [...new Set(texts)].map((text) => ({
              role: answer.role,
              text
            }));
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
    return Array.isArray(parsed) ? { rows: parsed.filter(isObject3) } : { error: "unexpected JSON output" };
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
      const spawn = parsed && isObject3(parsed.subagent) && isObject3(parsed.subagent.thread_spawn) ? parsed.subagent.thread_spawn : null;
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
    cwd: cwd && path3.isAbsolute(cwd) ? cwd : null,
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
        probe.rows.map((row) => asString3(row.name)).filter((name) => name !== void 0)
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
    runtime: RUNTIME2,
    threads: loadThreads,
    roots(home) {
      const base = path3.join(home, ".codex");
      const root = path3.join(base, "sessions");
      const archived = path3.join(base, "archived_sessions");
      const file = (name) => {
        const full = path3.join(base, name);
        return existsAs2(full, "file") ? full : null;
      };
      const archivedExists = existsAs2(archived, "dir");
      return {
        runtime: RUNTIME2,
        root,
        exists: existsAs2(root, "dir") || archivedExists,
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
          threadByPath.set(path3.resolve(thread.rolloutPath), thread);
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
          stats = await stat2(entry.file);
        } catch {
          continue;
        }
        if (!stats.isFile()) continue;
        const thread = threadByPath.get(path3.resolve(entry.file)) ?? threadById.get(name.sessionId);
        const file = {
          runtime: RUNTIME2,
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
          const text = asString3(record?.text);
          const sessionId = nonEmpty(record?.session_id);
          if (!record || !text || !sessionId) return;
          const match = matcher.match(text);
          if (!match) return;
          hits.push({
            runtime: RUNTIME2,
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
          runtime: RUNTIME2,
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
          const role = demoteRole("user", thread.firstUserMessage, RUNTIME2);
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
          runtime: RUNTIME2,
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
          let firstPrompt = thread?.firstUserMessage && !isInjectedUserText(thread.firstUserMessage, RUNTIME2) ? thread.firstUserMessage : null;
          if (firstPrompt === null) {
            const { records } = await readMetadataRecordsBounded(file.path, {
              maxBytes: INFO_READ_BYTES2,
              maxRecords: 64,
              diagnostic: noDiagnostic2
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

// src/skills/session-search/src/lib/adapters/cursor.ts
import { statSync as statSync3 } from "node:fs";
import { readdir as readdir3, stat as stat3 } from "node:fs/promises";
import path4 from "node:path";
var RUNTIME3 = "cursor";
var INFO_READ_BYTES3 = 256 * 1024;
var noDiagnostic3 = () => {
};
function isObject4(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function asString4(value) {
  return typeof value === "string" ? value : void 0;
}
async function listDir3(dir) {
  try {
    return await readdir3(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}
function blockText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter(isObject4).map((part) => asString4(part.text) ?? "").filter((part) => part !== "").join("\n");
}
function classifyCursorRecord(record, includeTools) {
  const role = asString4(record.role);
  if (role !== "user" && role !== "assistant") return [];
  const message = isObject4(record.message) ? record.message : record;
  const content = message.content;
  const unit = (text) => ({
    role: demoteRole(role, text, RUNTIME3),
    text
  });
  if (typeof content === "string") {
    return content.trim() === "" ? [] : [unit(content)];
  }
  if (!Array.isArray(content)) return [];
  const units = [];
  for (const block of content) {
    if (!isObject4(block)) continue;
    if (block.type === "tool_use") {
      if (role === "assistant") {
        const question = cursorAskUserQuestionText(block);
        if (question) {
          units.push({ role: "assistant", text: question });
          continue;
        }
      }
      if (!includeTools) continue;
      const name = asString4(block.name) ?? "tool_use";
      const input = typeof block.input === "string" ? block.input : JSON.stringify(block.input ?? {});
      units.push({ role: "tool", text: `[${name}] ${input}` });
      continue;
    }
    if (block.type === "tool_result") {
      const text2 = blockText(block.content);
      if (includeTools && text2.trim() !== "") {
        units.push({ role: "tool", text: text2 });
      }
      continue;
    }
    const text = asString4(block.text) ?? asString4(block.content);
    if (text && text.trim() !== "") units.push(unit(text));
  }
  return units;
}
function cursorSlugMatchesCwd(slug, hint) {
  const [encoded] = encodeCwdVariants(RUNTIME3, hint);
  if (!encoded) return true;
  return slug === encoded || slug.startsWith(`${encoded}-`);
}
function unwrapQuery(text) {
  const match = /^\s*<user_query>\s*([\s\S]*?)\s*<\/user_query>\s*$/u.exec(
    text
  );
  return match ? match[1] : text;
}
function createCursorAdapter() {
  const infos = /* @__PURE__ */ new Map();
  const statSession2 = async (file, base) => {
    try {
      const stats = await stat3(file);
      if (!stats.isFile()) return null;
      return {
        runtime: RUNTIME3,
        path: file,
        archived: false,
        mtimeMs: stats.mtimeMs,
        size: stats.size,
        createdAtMs: stats.birthtimeMs > 0 && stats.birthtimeMs <= stats.mtimeMs ? stats.birthtimeMs : null,
        ...base
      };
    } catch {
      return null;
    }
  };
  return {
    runtime: RUNTIME3,
    roots(home) {
      const root = path4.join(home, ".cursor", "projects");
      let exists = false;
      try {
        exists = statSync3(root).isDirectory();
      } catch {
        exists = false;
      }
      return { runtime: RUNTIME3, root, exists, paths: {} };
    },
    async enumerate(ctx) {
      if (!ctx.roots.exists) return [];
      const files = [];
      for (const project of await listDir3(ctx.roots.root)) {
        if (!project.isDirectory()) continue;
        const transcripts = path4.join(
          ctx.roots.root,
          project.name,
          "agent-transcripts"
        );
        for (const session of await listDir3(transcripts)) {
          if (!session.isDirectory()) continue;
          const dir = path4.join(transcripts, session.name);
          const parent = await statSession2(
            path4.join(dir, `${session.name}.jsonl`),
            {
              sessionId: session.name,
              parentSessionId: null,
              isSubagent: false,
              projectSlug: project.name
            }
          );
          if (parent) files.push(parent);
          const children = (await listDir3(path4.join(dir, "subagents"))).filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl")).map((entry) => entry.name).toSorted();
          for (const name of children) {
            const child = await statSession2(path4.join(dir, "subagents", name), {
              sessionId: name.slice(0, -".jsonl".length),
              parentSessionId: session.name,
              isSubagent: true,
              projectSlug: project.name
            });
            if (child) files.push(child);
          }
        }
      }
      return files;
    },
    async historyHits() {
      return [];
    },
    async metadataHits() {
      return [];
    },
    sessionInfo(file) {
      let cached = infos.get(file.path);
      if (!cached) {
        cached = (async () => {
          const { records } = await readMetadataRecordsBounded(file.path, {
            maxBytes: INFO_READ_BYTES3,
            maxRecords: 128,
            diagnostic: noDiagnostic3
          });
          let firstPrompt = null;
          for (const record of records) {
            const unit = classifyCursorRecord(record, false).find(
              (candidate) => candidate.role === "user"
            );
            if (unit) {
              firstPrompt = unwrapQuery(unit.text);
              break;
            }
          }
          return { cwd: null, title: null, firstPrompt, startedAt: null };
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
    classifyRecord: classifyCursorRecord,
    openHint(_sessionId, _info, transcriptPath) {
      return {
        command: null,
        hint: transcriptPath ? `open in Cursor (transcript: ${transcriptPath})` : "open in Cursor"
      };
    }
  };
}

// src/skills/session-search/src/lib/redact.ts
var REDACTED = "[REDACTED]";
var CREDENTIAL_WORD = "password|passwd|secret|token|api[_-]?key|access[_-]?key|client[_-]?secret|private[_-]?key";
var IDENT = "[A-Za-z0-9_.-]";
var KEY = `(?:(?<!\\\\)\\\\*["'])?(?<!${IDENT})(?=${IDENT}*?(?:${CREDENTIAL_WORD}))(?=(?<ident>${IDENT}+))\\k<ident>(?:\\\\*["'])?`;
var SEPARATOR = String.raw`\s*[:=]\s*`;
var QUOTED_VALUE = [
  // One level of escaping: \"...\" where the body may hold escaped-escaped
  // quotes (\\\") and backslashes (\\\\).
  String.raw`\\"(?:\\\\\\"|\\\\\\\\|\\\\[^"\\]|[^"\\])*\\"`,
  // Double-quoted string honoring escapes and spaces.
  String.raw`"(?:[^"\\\n]|\\.)*"`,
  // Single-quoted string.
  String.raw`'(?:[^'\\\n]|\\.)*'`,
  // Two or more levels of escaping: the value opens with a backslash run plus
  // a quote and closes at the next occurrence of that same delimiter that is
  // not itself preceded by a backslash (deeper-escaped quotes are skipped).
  String.raw`(?<vq>\\{2,}["'])(?:(?!(?<!\\)\k<vq>)[^\n])*(?<!\\)\k<vq>`,
  // Unterminated quote at any escaping level: mask to the end of the line.
  String.raw`\\*["'][^\n]*`
];
var VALUE = [
  ...QUOTED_VALUE,
  // Bare value up to whitespace or a delimiter.
  String.raw`[^\s,}&]+`
].join("|");
var KEY_VALUE_RE = new RegExp(
  `(?<key>${KEY})(?<sep>${SEPARATOR})(?:${VALUE})`,
  "gi"
);
var FLAG_RE = new RegExp(
  `(?<![A-Za-z0-9_.-])(?<flag>--?(?=${IDENT}*?(?:${CREDENTIAL_WORD}))(?=(?<ident>${IDENT}+))\\k<ident>)(?<gap>[ \\t]+)(?:${[...QUOTED_VALUE, String.raw`(?!-)\S+`].join("|")})`,
  "gi"
);
var USERINFO_RE = /(?<![A-Za-z0-9+.-])([a-z][a-z0-9+.-]*:\/\/[^\s/:@]*:)\S{0,256}@/gi;
var TOKEN_USERINFO_RE = /(?<![A-Za-z0-9+.-])([a-z][a-z0-9+.-]*:\/\/)[^\s/:@]{20,256}@/gi;
var AUTH_HEADER_RE = /\b(Authorization(?:\\*["'])?\s*[:=]\s*(?:\\*["'])?(?:Basic|Bearer|Token)\s+)[^\s"'\\,;]+/gi;
var TOKEN_RULES = [
  // OpenAI / Anthropic style keys (sk-..., sk-ant-...).
  /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{16,}/g,
  // GitHub tokens.
  /(?<![A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{20,}/g,
  /(?<![A-Za-z0-9])github_pat_[A-Za-z0-9_]{20,}/g,
  // Slack tokens.
  /(?<![A-Za-z0-9])xox[abprs]-[A-Za-z0-9-]{10,}/g,
  // AWS access key ids: long-term (AKIA) and temporary STS (ASIA).
  /(?<![A-Za-z0-9])(?:AKIA|ASIA)[0-9A-Z]{16}(?![A-Za-z0-9])/g,
  // Google API keys.
  /(?<![A-Za-z0-9])AIza[0-9A-Za-z_-]{35}/g,
  // GitLab personal access tokens.
  /(?<![A-Za-z0-9])glpat-[0-9A-Za-z_-]{20,}/g,
  // Stripe secret, restricted, and publishable keys, short forms included.
  /(?<![A-Za-z0-9])[srp]k_(?:live|test)_[0-9A-Za-z]{16,}/g,
  // Hugging Face tokens.
  /(?<![A-Za-z0-9])hf_[A-Za-z0-9]{30,}/g
  // Bare 32-hex values are deliberately NOT masked: they would blank MD5
  // hashes and other ids people search for. Keyed hex secrets are caught by
  // the key-value rule.
];
var BEARER_RE = /\b(Bearer\s+)([A-Za-z0-9._~+/-]+=*)/gi;
var HEX_RE = /(?<![A-Za-z0-9])[0-9a-fA-F]{40,}(?![A-Za-z0-9])/g;
var BASE64_RE = /(?<![A-Za-z0-9+/_-])[A-Za-z0-9+/_-]{40,}={0,2}/g;
var WORD_SEGMENT_RE = /^[A-Za-z]?[a-z0-9]*$/;
var LOWERCASE_SEGMENT_RE = /^[a-z0-9]*$/;
function isSegmentedWords(run) {
  if (!/[/_-]/.test(run)) return false;
  const segments = run.split(/[/_-]/);
  return LOWERCASE_SEGMENT_RE.test(segments[0]) && segments.every((segment) => WORD_SEGMENT_RE.test(segment));
}
var CAMEL_PIECE_RE = /[A-Z]?[a-z]+|[A-Z]?\d+|[A-Z]+(?![a-z])/g;
var MAX_UPPERCASE_PIECES = 2;
var MAX_DIGIT_PIECES = 2;
function isCamelIdentifier(run) {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(run)) return false;
  const pieces = run.match(CAMEL_PIECE_RE) ?? [];
  if (pieces.join("") !== run) return false;
  let uppercasePieces = 0;
  let digitPieces = 0;
  for (let index = 0; index < pieces.length; index++) {
    const piece = pieces[index];
    if (/\d/.test(piece)) {
      digitPieces += 1;
      if (digitPieces > MAX_DIGIT_PIECES || piece.replace(/\D/g, "").length > 3 || /\d/.test(pieces[index - 1] ?? "")) {
        return false;
      }
    } else if (/[a-z]/.test(piece)) {
      if (piece.length < (index === 0 ? 2 : 3)) return false;
    } else {
      uppercasePieces += 1;
      if (uppercasePieces > MAX_UPPERCASE_PIECES || piece.length > 5) {
        return false;
      }
      if (piece.length === 1 && /^[A-Z][a-z]/.test(pieces[index + 1] ?? "")) {
        return false;
      }
    }
  }
  return true;
}
function looksLikeEncodedSecret(run) {
  return /\d/.test(run) && /[a-z]/.test(run) && /[A-Z]/.test(run) && !isSegmentedWords(run) && !isCamelIdentifier(run);
}
function redact(text) {
  let out = text.replace(KEY_VALUE_RE, (...args) => {
    const groups = args[args.length - 1];
    return `${groups.key}${groups.sep}${REDACTED}`;
  });
  out = out.replace(FLAG_RE, (...args) => {
    const groups = args[args.length - 1];
    return `${groups.flag}${groups.gap}${REDACTED}`;
  });
  out = out.replace(
    USERINFO_RE,
    (_match, prefix) => `${prefix}${REDACTED}@`
  );
  out = out.replace(
    TOKEN_USERINFO_RE,
    (_match, prefix) => `${prefix}${REDACTED}@`
  );
  out = out.replace(
    AUTH_HEADER_RE,
    (_match, prefix) => `${prefix}${REDACTED}`
  );
  out = out.replace(
    BEARER_RE,
    (match, prefix, token) => token.length >= 16 || token.length >= 8 && /\d/.test(token) ? `${prefix}${REDACTED}` : match
  );
  for (const rule of TOKEN_RULES) out = out.replace(rule, REDACTED);
  out = out.replace(HEX_RE, REDACTED);
  out = out.replace(
    BASE64_RE,
    (run) => looksLikeEncodedSecret(run) ? REDACTED : run
  );
  return out;
}

// src/skills/session-search/src/lib/matcher.ts
var SNIPPET_CONTEXT_CHARS = 80;
var SNIPPET_MAX_CHARS = 240;
var ELLIPSIS = "\u2026";
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&");
}
function compileMatcher(patterns, { literal }) {
  if (patterns.length === 0) {
    throw new UsageError("At least one --pattern is required.");
  }
  const compiled = patterns.map((pattern) => {
    let regex;
    try {
      regex = new RegExp(literal ? escapeRegExp(pattern) : pattern, "is");
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new UsageError(
        `Invalid regex pattern "${pattern}" (${reason}). Pass --literal to match it as plain text.`
      );
    }
    if (regex.test("")) {
      throw new UsageError(`pattern matches empty text: "${pattern}"`);
    }
    return regex;
  });
  return {
    patterns: [...patterns],
    literal,
    match(text) {
      const matched = [];
      let firstIndex = -1;
      let firstLength = 0;
      compiled.forEach((regex, i) => {
        const found = regex.exec(text);
        if (!found) return;
        matched.push(patterns[i]);
        if (firstIndex === -1 || found.index < firstIndex) {
          firstIndex = found.index;
          firstLength = found[0].length;
        }
      });
      return matched.length === 0 ? null : { patterns: matched, firstIndex, firstLength };
    }
  };
}
function buildSnippet(text, index, length) {
  const safeIndex = Math.min(Math.max(0, index), text.length);
  let start = Math.max(0, safeIndex - SNIPPET_CONTEXT_CHARS);
  let end = Math.min(
    text.length,
    safeIndex + Math.max(0, length) + SNIPPET_CONTEXT_CHARS
  );
  if (splitsSurrogatePair(text, start)) start += 1;
  if (splitsSurrogatePair(text, end)) end -= 1;
  const prefix = start > 0 ? ELLIPSIS : "";
  let suffix = end < text.length ? ELLIPSIS : "";
  let body = text.slice(start, end).replace(/\s+/g, " ").trim();
  if (prefix.length + body.length + suffix.length > SNIPPET_MAX_CHARS) {
    suffix = ELLIPSIS;
    let cut = SNIPPET_MAX_CHARS - prefix.length - suffix.length;
    if (splitsSurrogatePair(body, cut)) cut -= 1;
    body = body.slice(0, cut);
  }
  return `${prefix}${body}${suffix}`;
}
function splitsSurrogatePair(text, position) {
  if (position <= 0 || position >= text.length) return false;
  const before = text.charCodeAt(position - 1);
  const after = text.charCodeAt(position);
  return before >= 55296 && before <= 56319 && after >= 56320 && after <= 57343;
}
function snippetFor(text, matcher, preHit) {
  const redacted = redact(text);
  const markers = [];
  for (let at = redacted.indexOf(REDACTED); at !== -1; at = redacted.indexOf(REDACTED, at + REDACTED.length)) {
    markers.push(at);
  }
  let segmentStart = 0;
  for (const segmentEnd of [...markers, redacted.length]) {
    const hit = matcher.match(redacted.slice(segmentStart, segmentEnd));
    if (hit) {
      return buildSnippet(
        redacted,
        segmentStart + hit.firstIndex,
        hit.firstLength
      );
    }
    segmentStart = segmentEnd + REDACTED.length;
  }
  if (markers.length === 0) return buildSnippet(redacted, 0, 0);
  let marker = markers[0];
  if (preHit) {
    const target = redact(text.slice(0, Math.max(0, preHit.firstIndex))).length;
    const distance = (at) => target < at ? at - target : Math.max(0, target - (at + REDACTED.length));
    marker = markers.reduce(
      (best, at) => distance(at) < distance(best) ? at : best
    );
  }
  return buildSnippet(redacted, marker, REDACTED.length);
}

// src/skills/session-search/src/lib/rank.ts
import path5 from "node:path";
var MAX_SNIPPETS = 3;
var FIRST_PROMPT_MAX_CHARS = 160;
var TITLE_MAX_CHARS = 200;
var SUBAGENT_WEIGHT = 0.5;
var TIER_ORDER = ["history", "meta", "content", "deep"];
var ROLE_ORDER = [
  "user",
  "title",
  "assistant",
  "context",
  "tool"
];
var keyOf = (runtime, sessionId) => `${runtime}\0${sessionId}`;
function cwdMatchesHint(cwd, hints) {
  if (!cwd) return false;
  const normalized = cwd.length > 1 ? cwd.replace(/\/+$/u, "") : cwd;
  return hints.some((hint) => {
    if (normalized === hint) return true;
    const prefix = hint.endsWith(path5.sep) ? hint : `${hint}${path5.sep}`;
    return normalized.startsWith(prefix);
  });
}
function splitsSurrogate(text, at) {
  if (at <= 0 || at >= text.length) return false;
  const before = text.charCodeAt(at - 1);
  return before >= 55296 && before <= 56319;
}
function presentText(value, max) {
  if (value === null) return null;
  const text = redact(value).replace(/\s+/gu, " ").trim();
  if (text === "") return null;
  if (text.length <= max) return text;
  let cut = max - 1;
  if (splitsSurrogate(text, cut)) cut -= 1;
  return `${text.slice(0, cut)}\u2026`;
}
function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
function hitText(hit) {
  return hit.snippet ?? hit.text;
}
function precedesInFile(a, b) {
  const role = ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
  if (role !== 0) return role < 0;
  const time = (a.timestampMs ?? Number.MAX_SAFE_INTEGER) - (b.timestampMs ?? Number.MAX_SAFE_INTEGER);
  if (time !== 0) return time < 0;
  return (a.seq ?? 0) < (b.seq ?? 0);
}
function snippetOrder(a, b) {
  return ROLE_ORDER.indexOf(a.hit.role) - ROLE_ORDER.indexOf(b.hit.role) || TIER_ORDER.indexOf(a.hit.tier) - TIER_ORDER.indexOf(b.hit.tier) || b.weight - a.weight || (a.hit.timestampMs ?? Number.MAX_SAFE_INTEGER) - (b.hit.timestampMs ?? Number.MAX_SAFE_INTEGER) || compareText(a.hit.sessionId, b.hit.sessionId) || compareText(a.hit.transcriptPath ?? "", b.hit.transcriptPath ?? "") || (a.hit.seq ?? 0) - (b.hit.seq ?? 0) || compareText(hitText(a.hit), hitText(b.hit));
}
function fallbackSession(hit) {
  return {
    runtime: hit.runtime,
    sessionId: hit.sessionId,
    archived: false,
    isSubagent: hit.fromSubagent === true,
    parentSessionId: hit.parentSessionId ?? null,
    cwd: hit.cwd,
    title: null,
    firstPrompt: null,
    startedAt: null,
    lastActivityMs: hit.timestampMs ?? 0,
    transcriptPath: hit.transcriptPath,
    open: { command: null, hint: "transcript not found on this machine" }
  };
}
function rankSessions(hits, sessions, options) {
  const { matcher } = options;
  const known = /* @__PURE__ */ new Map();
  for (const session of sessions) {
    known.set(keyOf(session.runtime, session.sessionId), session);
  }
  const groups = /* @__PURE__ */ new Map();
  const synthesized = /* @__PURE__ */ new Set();
  const groupFor = (key, session) => {
    let group = groups.get(key);
    if (!group) {
      group = { session, hits: [] };
      groups.set(key, group);
    }
    return group;
  };
  for (const hit of hits) {
    const ownKey = keyOf(hit.runtime, hit.sessionId);
    const own = known.get(ownKey);
    const isSubagent = hit.fromSubagent === true || own?.isSubagent === true;
    const parentId = hit.parentSessionId ?? own?.parentSessionId ?? null;
    const parentKey = parentId ? keyOf(hit.runtime, parentId) : null;
    const parent = parentKey ? known.get(parentKey) : void 0;
    if (isSubagent && parentKey && parent && parentKey !== ownKey) {
      groupFor(parentKey, parent).hits.push({
        hit,
        weight: SUBAGENT_WEIGHT,
        viaSubagent: true
      });
      continue;
    }
    const session = own ?? fallbackSession(hit);
    if (!own) {
      known.set(ownKey, session);
      synthesized.add(ownKey);
    }
    groupFor(ownKey, session).hits.push({ hit, weight: 1, viaSubagent: false });
  }
  for (const key of synthesized) {
    const group = groups.get(key);
    if (!group) continue;
    const ordered = group.hits.toSorted(snippetOrder);
    group.session = {
      ...group.session,
      cwd: ordered.find((entry) => entry.hit.cwd)?.hit.cwd ?? null,
      transcriptPath: ordered.find((entry) => entry.hit.transcriptPath)?.hit.transcriptPath ?? null,
      lastActivityMs: Math.max(
        0,
        ...ordered.map((entry) => entry.hit.timestampMs ?? 0)
      )
    };
  }
  const all = [...groups.values()];
  if (all.length === 0) return [];
  const activity = all.map((group) => group.session.lastActivityMs);
  const newest = Math.max(...activity);
  const oldest = Math.min(...activity);
  const patternCount = Math.max(1, matcher.patterns.length);
  const scored = all.map((group) => {
    const { session } = group;
    const maxWeight = (predicate) => group.hits.reduce(
      (best, entry) => predicate(entry) && entry.weight > best ? entry.weight : best,
      0
    );
    const patternWeights = matcher.patterns.map(
      (pattern) => maxWeight((entry) => entry.hit.patterns.includes(pattern))
    );
    const distinct = patternWeights.reduce((sum, weight) => sum + weight, 0);
    const userTyped = maxWeight((entry) => entry.hit.userTyped);
    const presentationHit = session.title !== null && matcher.match(session.title) !== null || session.firstPrompt !== null && matcher.match(session.firstPrompt) !== null;
    const titleWeight = Math.max(
      maxWeight(
        (entry) => entry.hit.role === "title" || entry.hit.tier === "meta"
      ),
      presentationHit ? 1 : 0
    );
    const cwdMatch = session.cwdMatch ?? cwdMatchesHint(session.cwd, options.cwdHints);
    const hitCount = group.hits.reduce((sum, entry) => sum + entry.weight, 0);
    const recency = newest === oldest ? 1 : (session.lastActivityMs - oldest) / (newest - oldest);
    const raw = 40 * distinct / patternCount + 25 * userTyped + 15 * titleWeight + 10 * (cwdMatch ? 1 : 0) + 6 * Math.min(hitCount, 5) / 5 + 4 * recency;
    return {
      group,
      score: Math.round(raw * 100) / 100,
      matchedPatterns: matcher.patterns.filter((_, i) => patternWeights[i] > 0)
    };
  });
  const ranked = scored.toSorted(
    (a, b) => b.score - a.score || b.group.session.lastActivityMs - a.group.session.lastActivityMs || compareText(a.group.session.runtime, b.group.session.runtime) || compareText(a.group.session.sessionId, b.group.session.sessionId)
  );
  return ranked.slice(0, Math.max(0, options.limit)).map((entry, index) => {
    const { session, hits: groupHits } = entry.group;
    const snippets = [];
    const seen = /* @__PURE__ */ new Set();
    for (const candidate of groupHits.toSorted(snippetOrder)) {
      if (snippets.length >= MAX_SNIPPETS) break;
      const text = candidate.hit.snippet ?? snippetFor(candidate.hit.text, matcher, candidate.hit);
      if (seen.has(text)) continue;
      seen.add(text);
      snippets.push({
        role: candidate.hit.role,
        tier: candidate.hit.tier,
        text,
        ...candidate.viaSubagent ? { via: "subagent" } : {}
      });
    }
    const tiers = new Set(groupHits.map((candidate) => candidate.hit.tier));
    return {
      rank: index + 1,
      score: entry.score,
      runtime: session.runtime,
      sessionId: session.sessionId,
      archived: session.archived,
      isSubagent: session.isSubagent,
      cwd: session.cwd,
      title: presentText(session.title, TITLE_MAX_CHARS),
      firstPrompt: presentText(session.firstPrompt, FIRST_PROMPT_MAX_CHARS),
      startedAt: session.startedAt,
      lastActivity: new Date(session.lastActivityMs).toISOString(),
      matchedPatterns: entry.matchedPatterns,
      matchedTiers: TIER_ORDER.filter((tier) => tiers.has(tier)),
      snippets,
      transcriptPath: session.transcriptPath,
      open: session.open
    };
  });
}

// src/skills/session-search/src/lib/scan.ts
import { spawnSync as spawnSync2 } from "node:child_process";
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
var RAW_CODEX_ITEM = /"type"\s*:\s*"item_completed"[\s\S]*?"item"\s*:\s*\{\s*"type"\s*:\s*"(?:CommandExecution|McpToolCall|Extension|FileChange)"/u;
var RAW_CLAUDE_RESULT = /"type"\s*:\s*"tool_result"/u;
var RAW_ORDINAL = /"ordinal"\s*:\s*(\d+)/u;
var RAW_ENVELOPE_FIELD = /"(?:parentUuid|logicalParentUuid|leafUuid|isSidechain|userType|cwd|sessionId|version|gitBranch|slug|agentId|uuid|timestamp|requestId|promptId|messageId|sourceToolAssistantUUID|sourceToolUseID|toolUseID|tool_use_id|type|role|is_error|isMeta|isApiErrorMessage|entrypoint|permissionMode|ordinal|call_id|thread_id|turn_id|client_authored|id|status|source|process_id|exit_code|started_at_ms|completed_at_ms|duration_ms|duration|secs|nanos|readOnlyHint)"\s*:\s*(?:"(?:[^"\\]|\\[\s\S]){0,1024}"|-?\d[\d.eE+-]{0,64}|true|false|null|\{\s*"secs"\s*:\s*\d{1,20}\s*,\s*"nanos"\s*:\s*\d{1,20}\s*\})/gu;
function rawToolText(line) {
  return line.replace(RAW_ENVELOPE_FIELD, " ");
}
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
  const withSnippets = [];
  const reachable = (hit) => {
    const better = /* @__PURE__ */ new Set();
    for (const prior of withSnippets) {
      if (!precedesInFile(prior, hit)) continue;
      better.add(prior.snippet ?? "");
      if (better.size >= MAX_SNIPPETS) return false;
    }
    return true;
  };
  const keep = (hit, unitText, match) => {
    const kept = { ...hit, text: "", seq: hits.length };
    if (reachable(kept)) {
      kept.snippet = snippetFor(unitText, matcher, match);
      withSnippets.push(kept);
    }
    hits.push(kept);
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
          const text = rawToolText(event.text);
          const match = matcher.match(text);
          if (!match || !accept(match.patterns)) return;
          keep(
            {
              ...base,
              role: "tool",
              userTyped: false,
              patterns: match.patterns,
              firstIndex: match.firstIndex,
              firstLength: match.firstLength,
              timestampMs: null
            },
            text,
            match
          );
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
          keep(
            {
              ...base,
              role: unit.role,
              userTyped: unit.role === "user" && !file.isSubagent && file.agentAuthored !== true,
              patterns: match.patterns,
              firstIndex: match.firstIndex,
              firstLength: match.firstLength,
              timestampMs: timestampOf(parsed)
            },
            unit.text,
            match
          );
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

// src/skills/session-search/src/lib/tools.ts
import { spawnSync as spawnSync3 } from "node:child_process";
import { statSync as statSync4 } from "node:fs";
import path6 from "node:path";
var ABSOLUTE_TOOL_DIRS = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin"
];
var DEFAULT_PROBE_TIMEOUT_MS = 3e3;
var MIN_PROBE_TIMEOUT_MS = 500;
var MAX_PROBE_TIMEOUT_MS = 6e4;
var PROBE_TIMEOUT_VAR = "SESSION_SEARCH_PROBE_TIMEOUT_MS";
var TOOLS = [
  {
    name: "rg",
    overrideVar: "SESSION_SEARCH_RG",
    disableVar: "SESSION_SEARCH_NO_RG"
  },
  {
    name: "sqlite3",
    overrideVar: "SESSION_SEARCH_SQLITE3",
    disableVar: "SESSION_SEARCH_NO_SQLITE3"
  }
];
function isFile(candidate) {
  try {
    return statSync4(candidate).isFile();
  } catch {
    return false;
  }
}
function probeTimeoutMs(env, notes) {
  const raw = env[PROBE_TIMEOUT_VAR]?.trim();
  if (!raw) return DEFAULT_PROBE_TIMEOUT_MS;
  const value = /^\d+$/u.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isSafeInteger(value) || value <= 0) {
    notes?.push(
      `${PROBE_TIMEOUT_VAR}=${raw} is not a positive integer; using ${DEFAULT_PROBE_TIMEOUT_MS} ms.`
    );
    return DEFAULT_PROBE_TIMEOUT_MS;
  }
  return Math.min(MAX_PROBE_TIMEOUT_MS, Math.max(MIN_PROBE_TIMEOUT_MS, value));
}
function verifyExecutable(candidate, timeoutMs = DEFAULT_PROBE_TIMEOUT_MS) {
  if (!path6.isAbsolute(candidate) || !isFile(candidate)) return false;
  try {
    const result = spawnSync3(candidate, ["--version"], {
      timeout: timeoutMs,
      stdio: "ignore",
      windowsHide: true
    });
    return result.error === void 0 && result.status === 0;
  } catch {
    return false;
  }
}
function executableNames(name) {
  return process.platform === "win32" ? [`${name}.exe`, name] : [name];
}
function isEnabled(value) {
  return value === "1" || value?.toLowerCase() === "true";
}
function resolveTool(spec, env, notes, timeoutMs) {
  const override = env[spec.overrideVar]?.trim();
  if (override) {
    const candidate = path6.resolve(override);
    if (verifyExecutable(candidate, timeoutMs)) return candidate;
    notes.push(
      `${spec.overrideVar}=${override} is not a usable ${spec.name} executable; continuing without ${spec.name}.`
    );
    return null;
  }
  if (isEnabled(env[spec.disableVar])) return null;
  const pathDirs = (env.PATH ?? "").split(path6.delimiter).filter((dir) => dir !== "" && path6.isAbsolute(dir));
  const seen = /* @__PURE__ */ new Set();
  for (const dir of [...pathDirs, ...ABSOLUTE_TOOL_DIRS]) {
    for (const name of executableNames(spec.name)) {
      const candidate = path6.join(dir, name);
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      if (verifyExecutable(candidate, timeoutMs)) return candidate;
    }
  }
  return null;
}
function probeTools(env = process.env) {
  const notes = [];
  const timeoutMs = probeTimeoutMs(env, notes);
  const [rg, sqlite3] = TOOLS.map(
    (spec) => resolveTool(spec, env, notes, timeoutMs)
  );
  return { rg, sqlite3, notes };
}

// src/skills/session-search/src/lib/pipeline.ts
var SEARCH_SCHEMA = "session-search/v1";
var ESTIMATE_SCHEMA = "session-search-estimate/v1";
var MAX_HITS_PER_SESSION = 25;
var TIER_ORDER2 = ["history", "meta", "content", "deep"];
var ADAPTERS = {
  "claude-code": createClaudeCodeAdapter,
  codex: createCodexAdapter,
  cursor: createCursorAdapter
};
var keyOf2 = (runtime, sessionId) => `${runtime}\0${sessionId}`;
var sumBytes = (files) => files.reduce((total, file) => total + file.size, 0);
function hasStore(roots) {
  return roots.exists || Object.values(roots.paths).some((value) => value !== null);
}
function sourceStatus(state) {
  if (!hasStore(state.roots)) return "absent";
  return state.notes.length > 0 ? "degraded" : "ok";
}
function isoOrNull(ms) {
  return ms === null ? null : new Date(ms).toISOString();
}
async function prepare(options, context, tools, deadline = null) {
  const states = [];
  for (const runtime of options.runtimes) {
    const adapter = ADAPTERS[runtime]();
    const roots = adapter.roots(context.home);
    const state = {
      runtime,
      adapter,
      roots,
      notes: [],
      files: [],
      windowFiles: []
    };
    state.files = await adapter.enumerate({
      home: context.home,
      env: context.env,
      options,
      tools,
      roots,
      degrade: (note) => state.notes.push(note),
      deadline
    });
    state.windowFiles = state.files.filter(
      (file) => inTimeWindow(file, options.since, options.until)
    );
    states.push(state);
  }
  return states;
}
async function inScope(file, adapter, hints, onRead = () => {
}) {
  if (file.runtime === "cursor") {
    return hints.some(
      (hint) => cursorSlugMatchesCwd(file.projectSlug ?? "", hint)
    );
  }
  if (file.runtime === "claude-code") {
    if (!hints.some((hint) => claudeSlugMatchesCwd(file.projectSlug ?? "", hint))) {
      return false;
    }
    onRead();
    const info = await adapter.sessionInfo(file);
    return info.cwd === null ? true : cwdMatchesHint(info.cwd, hints);
  }
  if (file.cwd != null) return cwdMatchesHint(file.cwd, hints);
  onRead();
  return cwdMatchesHint((await adapter.sessionInfo(file)).cwd, hints);
}
function applyGuard(options, candidates, cheapHits) {
  const total = sumBytes(candidates);
  if (options.allowLargeScan || total <= options.largeScanBytes) {
    return {
      files: [...candidates],
      needsConfirmation: null,
      skip: false,
      restricted: false
    };
  }
  const needsConfirmation = {
    reason: "large-scan",
    estimatedBytes: total,
    fileCount: candidates.length,
    rerunFlag: "--allow-large-scan"
  };
  const hitKeys = new Set(
    cheapHits.map((hit) => keyOf2(hit.runtime, hit.sessionId))
  );
  const restricted = candidates.filter(
    (file) => hitKeys.has(keyOf2(file.runtime, file.sessionId))
  );
  if (sumBytes(restricted) > options.largeScanBytes) {
    return { files: [], needsConfirmation, skip: true, restricted: true };
  }
  return {
    files: restricted,
    needsConfirmation,
    skip: false,
    restricted: true
  };
}
async function runSearch(options, context) {
  const started = Date.now();
  const deadline = options.deadlineMs === null ? null : started + options.deadlineMs;
  const expired = () => deadline !== null && Date.now() >= deadline;
  const probe = probeTools(context.env);
  for (const note of probe.notes) context.onNote?.(note);
  const tools = { rg: probe.rg, sqlite3: probe.sqlite3 };
  const matcher = compileMatcher(options.patterns, {
    literal: options.literal
  });
  const states = await prepare(options, context, tools, deadline);
  const stateFor = new Map(states.map((state) => [state.runtime, state]));
  const adapterFor = (runtime) => {
    const state = stateFor.get(runtime);
    if (!state) throw new Error(`runtime not prepared: ${runtime}`);
    return state.adapter;
  };
  const fileIndex = /* @__PURE__ */ new Map();
  for (const state of states) {
    for (const file of state.files)
      fileIndex.set(keyOf2(file.runtime, file.sessionId), file);
  }
  const windowFiles = states.flatMap((state) => state.windowFiles);
  const tiersRun = /* @__PURE__ */ new Set();
  const stats = {
    filesScanned: 0,
    bytesScanned: 0,
    linesSkippedOversize: 0,
    parseErrors: 0,
    timedOut: false
  };
  let needsConfirmation = null;
  let incomplete = expired();
  const contextFor = (state, files) => ({
    home: context.home,
    env: context.env,
    options,
    tools,
    roots: state.roots,
    files: files.filter((file) => file.runtime === state.runtime),
    degrade: (note) => state.notes.push(note),
    deadline
  });
  const acceptHit = (hit, candidateKeys, scoped) => {
    const key = keyOf2(hit.runtime, hit.sessionId);
    if (fileIndex.has(key)) return candidateKeys.has(key);
    if (hit.timestampMs === null) {
      if (options.since !== null || options.until !== null) return false;
    } else if (!timeInWindow(hit.timestampMs, options.since, options.until)) {
      return false;
    }
    return scoped ? cwdMatchesHint(hit.cwd, options.cwdHints) : true;
  };
  const runScan = async (candidates2, cheapHits, includeTools) => {
    const guard = applyGuard(options, candidates2, cheapHits);
    if (guard.needsConfirmation) needsConfirmation = guard.needsConfirmation;
    if (guard.skip || guard.restricted && guard.files.length === 0) return [];
    const scan = await scanFiles(guard.files, adapterFor, matcher, {
      maxLineBytes: options.maxLineBytes,
      includeTools,
      maxHitsPerSession: MAX_HITS_PER_SESSION,
      deadline,
      rg: tools.rg
    });
    for (const note of scan.notes) context.onNote?.(note);
    stats.filesScanned += scan.stats.filesScanned;
    stats.bytesScanned += scan.stats.bytesScanned;
    stats.linesSkippedOversize += scan.stats.linesSkippedOversize;
    stats.parseErrors += scan.stats.parseErrors;
    if (scan.stats.timedOut) incomplete = true;
    tiersRun.add(includeTools ? "deep" : "content");
    return scan.hits;
  };
  const runPass = async (candidates2, scoped) => {
    const candidateKeys = new Set(
      candidates2.map((file) => keyOf2(file.runtime, file.sessionId))
    );
    const cheap = [];
    for (const tier of ["history", "meta"]) {
      if (!options.tiers.includes(tier)) continue;
      if (expired()) {
        incomplete = true;
        return { hits: [...cheap], cheap };
      }
      for (const state of states) {
        const ctx = contextFor(state, candidates2);
        const found = tier === "history" ? await state.adapter.historyHits(ctx, matcher) : await state.adapter.metadataHits(ctx, matcher);
        cheap.push(
          ...found.filter((hit) => acceptHit(hit, candidateKeys, scoped))
        );
      }
      tiersRun.add(tier);
      if (expired()) incomplete = true;
    }
    const hits2 = [...cheap];
    if (options.tiers.includes("content")) {
      if (expired()) {
        incomplete = true;
        return { hits: hits2, cheap };
      }
      hits2.push(...await runScan(candidates2, cheap, options.includeTools));
    }
    return { hits: hits2, cheap };
  };
  let candidates = windowFiles;
  let widened = false;
  let scopeReads = 0;
  if (options.cwdHints.length > 0) {
    const scoped = [];
    for (const file of windowFiles) {
      if (expired()) {
        incomplete = true;
        break;
      }
      const matches = await inScope(
        file,
        adapterFor(file.runtime),
        options.cwdHints,
        () => {
          scopeReads += 1;
        }
      );
      if (matches) scoped.push(file);
    }
    candidates = scoped;
  }
  let pass = await runPass(candidates, options.cwdHints.length > 0);
  if (options.cwdHints.length > 0 && pass.hits.length === 0 && !incomplete) {
    widened = true;
    candidates = windowFiles;
    pass = await runPass(candidates, false);
  }
  const hits = [...pass.hits];
  if (hits.length === 0 && options.deep && !options.includeTools && options.tiers.includes("content") && !incomplete) {
    if (expired()) incomplete = true;
    else hits.push(...await runScan(candidates, pass.cheap, true));
  }
  const sessions = await sessionsFor(hits, fileIndex, adapterFor, options);
  const results = rankSessions(hits, sessions, {
    matcher,
    cwdHints: options.cwdHints,
    limit: options.limit
  });
  const sources = states.map((state) => {
    const note = state.notes.join("; ");
    return {
      runtime: state.runtime,
      root: state.roots.root,
      status: sourceStatus(state),
      sessions: state.windowFiles.filter((file) => !file.isSubagent).length,
      ...note ? { note } : {}
    };
  });
  return {
    schema: SEARCH_SCHEMA,
    query: {
      patterns: [...options.patterns],
      literal: options.literal,
      since: isoOrNull(options.since),
      until: isoOrNull(options.until),
      cwdHints: [...options.cwdHints],
      runtimes: [...options.runtimes]
    },
    host: { hostname: os2.hostname(), platform: process.platform },
    tools,
    tiersRun: TIER_ORDER2.filter((tier) => tiersRun.has(tier)),
    widened,
    needsConfirmation,
    incomplete,
    sources,
    results,
    diagnostics: {
      filesScanned: stats.filesScanned,
      bytesScanned: stats.bytesScanned,
      linesSkippedOversize: stats.linesSkippedOversize,
      parseErrors: stats.parseErrors,
      elapsedMs: Date.now() - started,
      scopeReads
    }
  };
}
async function sessionsFor(hits, fileIndex, adapterFor, options) {
  const keys = /* @__PURE__ */ new Set();
  const orphanHits = /* @__PURE__ */ new Map();
  for (const hit of hits) {
    const key = keyOf2(hit.runtime, hit.sessionId);
    const file = fileIndex.get(key);
    if (file) {
      keys.add(key);
      if (file.parentSessionId) {
        const parentKey = keyOf2(file.runtime, file.parentSessionId);
        if (fileIndex.has(parentKey)) keys.add(parentKey);
      }
    } else {
      orphanHits.set(key, [...orphanHits.get(key) ?? [], hit]);
    }
  }
  const sessions = [];
  for (const key of [...keys].toSorted()) {
    const file = fileIndex.get(key);
    if (!file) continue;
    const adapter = adapterFor(file.runtime);
    const info = await adapter.sessionInfo(file);
    const openId = file.isSubagent && file.parentSessionId ? file.parentSessionId : file.sessionId;
    sessions.push({
      runtime: file.runtime,
      sessionId: file.sessionId,
      archived: file.archived,
      isSubagent: file.isSubagent,
      parentSessionId: file.parentSessionId,
      cwd: info.cwd ?? file.cwd ?? null,
      title: info.title,
      firstPrompt: info.firstPrompt,
      startedAt: info.startedAt ?? (file.createdAtMs != null ? new Date(file.createdAtMs).toISOString() : null),
      lastActivityMs: file.mtimeMs,
      transcriptPath: file.path,
      open: adapter.openHint(openId, info, file.path),
      ...file.runtime === "cursor" && options.cwdHints.length > 0 ? {
        cwdMatch: options.cwdHints.some(
          (hint) => cursorSlugMatchesCwd(file.projectSlug ?? "", hint)
        )
      } : {}
    });
  }
  for (const [, group] of [...orphanHits].toSorted(
    ([a], [b]) => a < b ? -1 : 1
  )) {
    const ordered = group.toSorted(
      (a, b) => TIER_ORDER2.indexOf(a.tier) - TIER_ORDER2.indexOf(b.tier) || (hitText(a) < hitText(b) ? -1 : hitText(a) > hitText(b) ? 1 : 0)
    );
    const first = ordered[0];
    const cwd = ordered.find((hit) => hit.cwd)?.cwd ?? null;
    const transcriptPath = ordered.find((hit) => hit.transcriptPath)?.transcriptPath ?? null;
    const info = { cwd, title: null, firstPrompt: null, startedAt: null };
    sessions.push({
      runtime: first.runtime,
      sessionId: first.sessionId,
      archived: false,
      isSubagent: false,
      parentSessionId: null,
      cwd,
      title: null,
      firstPrompt: null,
      startedAt: null,
      lastActivityMs: Math.max(
        0,
        ...ordered.map((hit) => hit.timestampMs ?? 0)
      ),
      transcriptPath,
      open: adapterFor(first.runtime).openHint(
        first.sessionId,
        info,
        transcriptPath
      )
    });
  }
  return sessions;
}
async function estimate(options, context) {
  const probe = probeTools(context.env);
  const tools = { rg: probe.rg, sqlite3: probe.sqlite3 };
  const states = await prepare(options, context, tools);
  const runtimes = [];
  for (const state of states) {
    let files = state.windowFiles;
    if (options.cwdHints.length > 0) {
      const scoped = [];
      for (const file of files) {
        if (await inScope(file, state.adapter, options.cwdHints))
          scoped.push(file);
      }
      files = scoped;
    }
    const note = state.notes.join("; ");
    runtimes.push({
      runtime: state.runtime,
      root: state.roots.root,
      status: sourceStatus(state),
      files: files.length,
      sessions: files.filter((file) => !file.isSubagent).length,
      bytes: sumBytes(files),
      ...note ? { note } : {}
    });
  }
  const totalBytes = runtimes.reduce((total, entry) => total + entry.bytes, 0);
  return {
    schema: ESTIMATE_SCHEMA,
    query: {
      since: isoOrNull(options.since),
      until: isoOrNull(options.until),
      cwdHints: [...options.cwdHints],
      runtimes: [...options.runtimes]
    },
    host: { hostname: os2.hostname(), platform: process.platform },
    runtimes,
    totalFiles: runtimes.reduce((total, entry) => total + entry.files, 0),
    totalBytes,
    largeScanBytes: options.largeScanBytes,
    exceedsLargeScan: totalBytes > options.largeScanBytes
  };
}

// src/skills/session-search/src/session-search.ts
var PREFIX = "[session-search]";
var OPTIONS = {
  pattern: { type: "string", short: "p", multiple: true },
  literal: { type: "boolean" },
  since: { type: "string" },
  until: { type: "string" },
  cwd: { type: "string", multiple: true },
  runtime: { type: "string", multiple: true },
  tiers: { type: "string", multiple: true },
  "no-deep": { type: "boolean" },
  "include-tools": { type: "boolean" },
  "allow-large-scan": { type: "boolean" },
  "large-scan-bytes": { type: "string" },
  "max-line-bytes": { type: "string" },
  limit: { type: "string" },
  "deadline-ms": { type: "string" },
  json: { type: "boolean" },
  help: { type: "boolean", short: "h" }
};
var HELP = `session-search \u2014 find a past Claude Code, Codex, or Cursor session on this machine

Usage:
  node session-search.mjs [search] -p <pattern> [-p <pattern> \u2026] [flags]
  node session-search.mjs estimate [--since \u2026] [--until \u2026] [--cwd \u2026] [--runtime \u2026] [--json]

Search flags:
  -p, --pattern <regex>     case-insensitive pattern; repeatable; required for search.
                            Regexes are dotAll: \`.\` also matches newlines.
  --literal                 match patterns as plain text
  --since <spec>            24h | 7d | 2w | today | yesterday | YYYY-MM-DD | ISO date-time
  --until <spec>            same forms; must not be earlier than --since
  --cwd <path>              search this directory (and below) first; widens when empty.
                            Repeatable.
  --runtime <list>          claude-code,codex,cursor (default: all)
  --tiers <list>            history,meta,content (default: all)
  --no-deep                 never run the deep (tool-output) rung
  --include-tools           include tool output in the content tier
  --allow-large-scan        scan past the large-scan threshold
  --large-scan-bytes <n>    large-scan threshold in bytes (default: 2 GiB)
  --max-line-bytes <n>      skip transcript lines longer than this (default: 65536)
  --limit <n>               maximum results (default: 15)
  --deadline-ms <n>         return partial results after this many milliseconds
  --json                    emit session-search/v1 JSON
  -h, --help                this message

estimate prints per-runtime file counts and bytes inside the window (and cwd scope).

Environment:
  SESSION_SEARCH_RG, SESSION_SEARCH_SQLITE3        explicit tool paths
  SESSION_SEARCH_NO_RG=1, SESSION_SEARCH_NO_SQLITE3=1  force the fallbacks
  SESSION_SEARCH_PROBE_TIMEOUT_MS                  tool-probe timeout in ms (default 3000)

Exit codes: 0 results \xB7 2 no sessions matched \xB7 3 needs confirmation (large scan) \xB7 1 usage or hard error`;
var defaultIo = () => ({
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  env: process.env,
  cwd: process.cwd()
});
function formatBytes(bytes) {
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return unit === 0 ? `${bytes} B` : `${value.toFixed(1)} ${units[unit]}`;
}
function formatWhen(iso) {
  const date = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}
function renderSearchText(result) {
  const lines = [];
  const count = result.results.length;
  lines.push(
    `session-search: ${count} result${count === 1 ? "" : "s"} (tiers: ${result.tiersRun.join(", ") || "none"})`
  );
  if (result.widened) {
    lines.push(
      "note: nothing matched inside the --cwd hint; widened to all locations."
    );
  }
  if (result.needsConfirmation) {
    const { estimatedBytes, fileCount } = result.needsConfirmation;
    lines.push(
      `note: a full content scan covers ${formatBytes(estimatedBytes)} across ${fileCount} files; re-run with --allow-large-scan to include it.`
    );
  }
  if (result.incomplete)
    lines.push("note: results are incomplete (deadline reached).");
  for (const source of result.sources) {
    if (source.status === "degraded") {
      lines.push(
        `note: ${source.runtime} source degraded: ${source.note ?? "unknown reason"}`
      );
    }
  }
  for (const hit of result.results) {
    const labels = [
      hit.archived ? "archived" : null,
      hit.isSubagent ? "subagent" : null
    ].filter((label) => label !== null).join(", ");
    lines.push("");
    lines.push(
      `${hit.rank}. [${hit.runtime}] ${formatWhen(hit.lastActivity)}  ${hit.cwd ?? "(cwd unknown)"}${labels ? `  (${labels})` : ""}`
    );
    if (hit.title) lines.push(`   title: ${hit.title}`);
    else if (hit.firstPrompt) lines.push(`   first prompt: ${hit.firstPrompt}`);
    const best = hit.snippets[0];
    if (best) lines.push(`   > [${best.role}/${best.tier}] ${best.text}`);
    lines.push(
      `   open: ${hit.open.command ? `${hit.open.command} \u2014 ` : ""}${hit.open.hint}`
    );
  }
  return `${lines.join("\n")}
`;
}
function renderEstimateText(result) {
  const lines = [
    `session-search estimate (since ${result.query.since ?? "the beginning"}, until ${result.query.until ?? "now"})`
  ];
  for (const entry of result.runtimes) {
    lines.push(
      `${entry.runtime.padEnd(12)} ${entry.status.padEnd(9)} ${String(entry.files).padStart(6)} files  ${formatBytes(
        entry.bytes
      ).padStart(10)}  ${entry.root}${entry.note ? `  (${entry.note})` : ""}`
    );
  }
  lines.push(
    `${"total".padEnd(22)} ${String(result.totalFiles).padStart(6)} files  ${formatBytes(
      result.totalBytes
    ).padStart(
      10
    )}  (large-scan threshold ${formatBytes(result.largeScanBytes)}: ${result.exceedsLargeScan ? "over" : "under"})`
  );
  return `${lines.join("\n")}
`;
}
function parse(argv) {
  const { values, positionals } = parseArgs({
    args: [...argv],
    options: OPTIONS,
    allowPositionals: true,
    strict: false
  });
  const unknown = Object.keys(values).filter((key) => !(key in OPTIONS));
  if (unknown.length > 0) {
    throw new UsageError(`Unknown option --${unknown[0]}.`);
  }
  if (positionals.length > 1) {
    throw new UsageError(`Unexpected argument "${positionals[1]}".`);
  }
  const command = positionals[0] ?? "search";
  if (command !== "search" && command !== "estimate") {
    throw new UsageError(
      `Unknown command "${command}". Use search or estimate.`
    );
  }
  const raw = {};
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string" || typeof value === "boolean" || Array.isArray(value)) {
      raw[key] = value;
    }
  }
  return { command, raw, help: values.help === true };
}
async function main(argv = process.argv.slice(2), io = defaultIo()) {
  try {
    const { command, raw, help } = parse(argv);
    if (help) {
      io.stdout(`${HELP}
`);
      return 0;
    }
    const home = io.env.HOME?.trim() || os3.homedir();
    const options = resolveOptions(raw, { home, cwd: io.cwd });
    if (command === "estimate") {
      const result2 = await estimate(options, { home, env: io.env });
      io.stdout(
        options.json ? `${JSON.stringify(result2, null, 2)}
` : renderEstimateText(result2)
      );
      return 0;
    }
    if (options.patterns.length === 0) {
      throw new UsageError(
        "At least one --pattern (-p) is required for search."
      );
    }
    const result = await runSearch(options, {
      home,
      env: io.env,
      // Notes go to stderr in every mode, so --json stdout stays pure JSON.
      onNote: (note) => io.stderr(`${PREFIX} note: ${note}
`)
    });
    io.stdout(
      options.json ? `${JSON.stringify(result, null, 2)}
` : renderSearchText(result)
    );
    if (result.needsConfirmation) return 3;
    return result.results.length > 0 ? 0 : 2;
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr(`${PREFIX} ${error.message}
Run with --help for usage.
`);
      return 1;
    }
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`${PREFIX} error: ${message}
`);
    return 1;
  }
}
function isEntrypointPath(argvPath) {
  try {
    return realpathSync(argvPath) === realpathSync(fileURLToPath(import.meta.url));
  } catch (error) {
    const code = error.code;
    if (code === "ENOENT" || code === "ENOTDIR") return false;
    throw error;
  }
}
if (process.argv[1] && isEntrypointPath(process.argv[1])) {
  process.exitCode = await main();
}
export {
  HELP,
  main,
  renderEstimateText,
  renderSearchText
};
