// GENERATED skill payload for session-search.

// src/skills/session-search/src/lib/options.ts
import os from "node:os";
import path from "node:path";
var DEFAULT_MAX_LINE_BYTES = 64 * 1024;
var DEFAULT_LARGE_SCAN_BYTES = 2 * 1024 * 1024 * 1024;
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
  // AWS access key ids.
  /(?<![A-Za-z0-9])AKIA[0-9A-Z]{16}(?![A-Za-z0-9])/g
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
export {
  SNIPPET_CONTEXT_CHARS,
  SNIPPET_MAX_CHARS,
  buildSnippet,
  compileMatcher,
  snippetFor
};
