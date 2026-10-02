/**
 * Pattern compilation and snippet windowing for session-search.
 *
 * Patterns are supplied by the calling agent. They are case-insensitive,
 * dotAll (`.` matches newlines) regexes by default; `--literal` escapes them. Emitted snippets go through
 * `snippetFor`, which redacts the whole unit before windowing. Text passed
 * directly to `buildSnippet` must already be redacted as a whole unit.
 */
import { UsageError } from './options.js';
import { REDACTED, redact } from './redact.js';
import type { MatchResult, Matcher } from './types.js';

/** Characters kept on each side of the first hit. */
export const SNIPPET_CONTEXT_CHARS = 80;
/** Maximum emitted snippet length, ellipses included. */
export const SNIPPET_MAX_CHARS = 240;
const ELLIPSIS = '…';

export interface CompileMatcherOptions {
  literal: boolean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
}

/** Compile agent-supplied patterns into a reusable matcher. */
export function compileMatcher(
  patterns: string[],
  { literal }: CompileMatcherOptions,
): Matcher {
  if (patterns.length === 0) {
    throw new UsageError('At least one --pattern is required.');
  }
  const compiled = patterns.map((pattern) => {
    let regex: RegExp;
    try {
      // `i`: case-insensitive. `s` (dotAll): `.` also matches newlines, so
      // `perceive.*now` spans lines inside one text unit.
      regex = new RegExp(literal ? escapeRegExp(pattern) : pattern, 'is');
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new UsageError(
        `Invalid regex pattern "${pattern}" (${reason}). Pass --literal to match it as plain text.`,
      );
    }
    // A pattern that matches empty text would hit every text unit.
    if (regex.test('')) {
      throw new UsageError(`pattern matches empty text: "${pattern}"`);
    }
    return regex;
  });

  return {
    patterns: [...patterns],
    literal,
    match(text: string): MatchResult | null {
      const matched: string[] = [];
      let firstIndex = -1;
      let firstLength = 0;
      compiled.forEach((regex, i) => {
        // Non-global regexes keep no lastIndex state between calls.
        const found = regex.exec(text);
        if (!found) return;
        matched.push(patterns[i]);
        if (firstIndex === -1 || found.index < firstIndex) {
          firstIndex = found.index;
          firstLength = found[0].length;
        }
      });
      return matched.length === 0
        ? null
        : { patterns: matched, firstIndex, firstLength };
    },
  };
}

/**
 * Cut a bounded, single-line snippet around a hit: up to 80 characters on
 * each side, whitespace collapsed, at most 240 characters, with ellipses
 * marking truncated edges.
 */
export function buildSnippet(
  text: string,
  index: number,
  length: number,
): string {
  const safeIndex = Math.min(Math.max(0, index), text.length);
  let start = Math.max(0, safeIndex - SNIPPET_CONTEXT_CHARS);
  let end = Math.min(
    text.length,
    safeIndex + Math.max(0, length) + SNIPPET_CONTEXT_CHARS,
  );
  // Keep window edges off the middle of a surrogate pair (e.g. an emoji):
  // drop the orphaned half instead of emitting a lone surrogate.
  if (splitsSurrogatePair(text, start)) start += 1;
  if (splitsSurrogatePair(text, end)) end -= 1;
  const prefix = start > 0 ? ELLIPSIS : '';
  let suffix = end < text.length ? ELLIPSIS : '';
  let body = text.slice(start, end).replace(/\s+/g, ' ').trim();

  if (prefix.length + body.length + suffix.length > SNIPPET_MAX_CHARS) {
    suffix = ELLIPSIS;
    let cut = SNIPPET_MAX_CHARS - prefix.length - suffix.length;
    if (splitsSurrogatePair(body, cut)) cut -= 1;
    body = body.slice(0, cut);
  }
  return `${prefix}${body}${suffix}`;
}

/** True when `position` falls between the two halves of a surrogate pair. */
function splitsSurrogatePair(text: string, position: number): boolean {
  if (position <= 0 || position >= text.length) return false;
  const before = text.charCodeAt(position - 1);
  const after = text.charCodeAt(position);
  return (
    before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff
  );
}

/**
 * Build an emitted snippet for one text unit: redact the FULL unit first,
 * then re-run the matcher on the redacted text and window at that hit.
 * Indices from a pre-redaction match are never reused, because redaction
 * changes string length. When redaction removed the hit itself, the window
 * falls back to the first redaction marker, else the start of the text.
 */
export function snippetFor(text: string, matcher: Matcher): string {
  const redacted = redact(text);
  const hit = matcher.match(redacted);
  if (hit) return buildSnippet(redacted, hit.firstIndex, hit.firstLength);
  const marker = redacted.indexOf(REDACTED);
  return marker === -1
    ? buildSnippet(redacted, 0, 0)
    : buildSnippet(redacted, marker, REDACTED.length);
}
