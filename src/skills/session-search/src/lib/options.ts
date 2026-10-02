/**
 * Option resolution and time-window parsing for session-search.
 *
 * `resolveOptions` accepts the loosely typed values produced by
 * `node:util` `parseArgs({ strict: false })` and narrows them into a
 * `SearchOptions`. Every rejection is a `UsageError` (CLI exit 1).
 */
import os from 'node:os';
import path from 'node:path';

import type { Runtime, SearchOptions, Tier } from './types.js';

export const DEFAULT_LIMIT = 15;
export const DEFAULT_MAX_LINE_BYTES = 64 * 1024;
export const DEFAULT_LARGE_SCAN_BYTES = 2 * 1024 * 1024 * 1024;
export const ALL_RUNTIMES: readonly Runtime[] = [
  'claude-code',
  'codex',
  'cursor',
];
/** Tiers selectable with `--tiers`; the deep rung is controlled by `--no-deep`. */
export const SELECTABLE_TIERS: readonly Tier[] = ['history', 'meta', 'content'];

/** A user-facing argument error. The CLI reports it and exits 1. */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

/** Which end of the time window a spec describes. */
export type TimeBound = 'since' | 'until';

const HOUR_MS = 60 * 60 * 1000;
const UNIT_MS: Record<string, number> = {
  h: HOUR_MS,
  d: 24 * HOUR_MS,
  w: 7 * 24 * HOUR_MS,
};

function startOfLocalDay(ms: number, dayOffset = 0): number {
  const date = new Date(ms);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + dayOffset,
  ).getTime();
}

function isValidCalendarDate(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * Parse a `--since`/`--until` value into epoch milliseconds.
 *
 * - `Nh`, `Nd`, `Nw`: `now` minus N hours/days/weeks (either bound).
 * - `today`/`yesterday`: local midnight boundaries. As `since` they mean the
 *   start of that day; as `until` they mean the end of that day (the start of
 *   the following day), so `--since yesterday --until yesterday` covers
 *   exactly yesterday.
 * - `YYYY-MM-DD`: a whole local day, with the same since/until convention.
 * - ISO date-times: the exact instant (local time when no offset is given).
 */
export function parseTimeSpec(
  spec: string,
  now: number,
  bound: TimeBound = 'since',
): number {
  const value = spec.trim();
  const invalid = () =>
    new UsageError(
      `Invalid time value "${spec}". Use Nh, Nd, Nw, today, yesterday, YYYY-MM-DD, or an ISO date-time.`,
    );
  if (value === '') throw invalid();

  const relative = /^(\d+)([hdw])$/i.exec(value);
  if (relative) {
    const amount = Number(relative[1]);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw invalid();
    return now - amount * UNIT_MS[relative[2].toLowerCase()];
  }

  const keyword = value.toLowerCase();
  const untilOffset = bound === 'until' ? 1 : 0;
  if (keyword === 'today') return startOfLocalDay(now, untilOffset);
  if (keyword === 'yesterday') return startOfLocalDay(now, -1 + untilOffset);

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

/** Values as produced by `parseArgs({ strict: false })`. */
export type RawOptionValue =
  | string
  | boolean
  | Array<string | boolean>
  | undefined;
export type RawOptionValues = Record<string, RawOptionValue>;

export interface ResolveOptionsContext {
  /** Clock for relative and keyword time specs (default `Date.now()`). */
  now?: number;
  /** Home directory for `~` expansion (default `os.homedir()`). */
  home?: string;
  /** Base directory for relative `--cwd` hints (default `process.cwd()`). */
  cwd?: string;
}

function valueList(raw: RawOptionValues, key: string): string[] {
  const value = raw[key];
  if (value === undefined) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map((item) => {
    if (typeof item !== 'string') {
      throw new UsageError(`--${key} requires a value.`);
    }
    return item;
  });
}

function lastValue(raw: RawOptionValues, key: string): string | undefined {
  const list = valueList(raw, key);
  return list.length > 0 ? list[list.length - 1] : undefined;
}

function flag(raw: RawOptionValues, key: string): boolean {
  const value = raw[key];
  const last = Array.isArray(value) ? value[value.length - 1] : value;
  return last === true || last === 'true';
}

function positiveInteger(
  raw: RawOptionValues,
  key: string,
  fallback: number,
): number {
  const value = lastValue(raw, key);
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value.trim())) {
    throw new UsageError(
      `--${key} must be a positive integer, got "${value}".`,
    );
  }
  const parsed = Number(value.trim());
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new UsageError(
      `--${key} must be a positive integer, got "${value}".`,
    );
  }
  return parsed;
}

function commaList(raw: RawOptionValues, key: string): string[] {
  return valueList(raw, key)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value) => value !== '');
}

function pickList<T extends string>(
  raw: RawOptionValues,
  key: string,
  allowed: readonly T[],
): T[] {
  const requested = commaList(raw, key);
  if (requested.length === 0) return [...allowed];
  const selected = new Set<T>();
  for (const value of requested) {
    if (!(allowed as readonly string[]).includes(value)) {
      throw new UsageError(
        `Unknown --${key} value "${value}". Expected one of ${allowed.join(', ')}.`,
      );
    }
    selected.add(value as T);
  }
  // Keep the canonical order regardless of how the user listed them.
  return allowed.filter((value) => selected.has(value));
}

/**
 * Normalize a cwd hint: expand `~` against `home`, resolve relative paths
 * against `base`, and strip trailing slashes (the root stays `/`).
 */
export function normalizeCwd(hint: string, home: string, base: string) {
  let value = hint.trim();
  if (value === '~') value = home;
  else if (value.startsWith('~/')) value = path.join(home, value.slice(2));
  return path.resolve(base, value);
}

/** Narrow raw parsed flags into fully defaulted `SearchOptions`. */
export function resolveOptions(
  raw: RawOptionValues,
  context: ResolveOptionsContext = {},
): SearchOptions {
  const now = context.now ?? Date.now();
  const home = context.home ?? os.homedir();
  const base = context.cwd ?? process.cwd();

  // Repeated patterns add nothing to matching or scoring; keeping them would
  // stop the scanner's "every pattern credited" early stop from firing.
  const patterns = [...new Set(valueList(raw, 'pattern'))];
  if (patterns.some((pattern) => pattern === '')) {
    throw new UsageError('A --pattern value must not be empty.');
  }

  const sinceSpec = lastValue(raw, 'since');
  const untilSpec = lastValue(raw, 'until');
  const since =
    sinceSpec === undefined ? null : parseTimeSpec(sinceSpec, now, 'since');
  const until =
    untilSpec === undefined ? null : parseTimeSpec(untilSpec, now, 'until');
  if (since !== null && until !== null && until < since) {
    throw new UsageError(
      `--until (${untilSpec}) is earlier than --since (${sinceSpec}).`,
    );
  }

  const cwdHints: string[] = [];
  for (const hint of valueList(raw, 'cwd')) {
    if (hint.trim() === '') throw new UsageError('--cwd requires a value.');
    const normalized = normalizeCwd(hint, home, base);
    if (!cwdHints.includes(normalized)) cwdHints.push(normalized);
  }

  const deadline = lastValue(raw, 'deadline-ms');

  return {
    patterns,
    literal: flag(raw, 'literal'),
    since,
    until,
    cwdHints,
    runtimes: pickList(raw, 'runtime', ALL_RUNTIMES),
    tiers: pickList(raw, 'tiers', SELECTABLE_TIERS),
    deep: !flag(raw, 'no-deep'),
    includeTools: flag(raw, 'include-tools'),
    allowLargeScan: flag(raw, 'allow-large-scan'),
    largeScanBytes: positiveInteger(
      raw,
      'large-scan-bytes',
      DEFAULT_LARGE_SCAN_BYTES,
    ),
    maxLineBytes: positiveInteger(
      raw,
      'max-line-bytes',
      DEFAULT_MAX_LINE_BYTES,
    ),
    limit: positiveInteger(raw, 'limit', DEFAULT_LIMIT),
    deadlineMs:
      deadline === undefined ? null : positiveInteger(raw, 'deadline-ms', 0),
    json: flag(raw, 'json'),
  };
}
