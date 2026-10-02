/**
 * Pattern compilation and snippet windowing for session-search.
 *
 * Patterns are supplied by the calling agent. They are case-insensitive
 * regexes by default; `--literal` escapes them. Emitted snippets go through
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
    try {
      return new RegExp(literal ? escapeRegExp(pattern) : pattern, 'i');
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new UsageError(
        `Invalid regex pattern "${pattern}" (${reason}). Pass --literal to match it as plain text.`,
      );
    }
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
  const start = Math.max(0, safeIndex - SNIPPET_CONTEXT_CHARS);
  const end = Math.min(
    text.length,
    safeIndex + Math.max(0, length) + SNIPPET_CONTEXT_CHARS,
  );
  const prefix = start > 0 ? ELLIPSIS : '';
  let suffix = end < text.length ? ELLIPSIS : '';
  let body = text.slice(start, end).replace(/\s+/g, ' ').trim();

  if (prefix.length + body.length + suffix.length > SNIPPET_MAX_CHARS) {
    suffix = ELLIPSIS;
    body = body.slice(0, SNIPPET_MAX_CHARS - prefix.length - suffix.length);
  }
  return `${prefix}${body}${suffix}`;
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
