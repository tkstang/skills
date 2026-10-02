// GENERATED skill payload for session-search.

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
export {
  ALL_RUNTIMES,
  DEFAULT_LARGE_SCAN_BYTES,
  DEFAULT_LIMIT,
  DEFAULT_MAX_LINE_BYTES,
  SELECTABLE_TIERS,
  UsageError,
  normalizeCwd,
  parseTimeSpec,
  resolveOptions
};
