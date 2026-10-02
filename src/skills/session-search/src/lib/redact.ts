/**
 * Credential redaction for session-search output.
 *
 * Contract: callers redact the FULL text unit (or the full raw line on the
 * deep raw fallback) before snippet windowing. A secret cut at a window edge
 * could otherwise survive as a fragment too short to match any rule here.
 * Every emitted string (snippet, title, firstPrompt) goes through `redact`.
 *
 * The rules favor over-masking: a false positive costs a few characters of a
 * snippet, a false negative echoes a secret.
 */

export const REDACTED = '[REDACTED]';

const CREDENTIAL_WORD =
  'password|passwd|secret|token|api[_-]?key|access[_-]?key|client[_-]?secret|private[_-]?key';

// Key: an identifier containing a credential word (identifier prefixes and
// suffixes allowed, e.g. AWS_SECRET_ACCESS_KEY), optionally wrapped in ", ',
// or an escaped \" as found in raw serialized records.
// The lookbehind anchors the identifier at the start of its run; the
// lookahead pair then requires a credential word inside the run and consumes
// the whole run atomically. Together they keep a long identifier run linear
// rather than quadratic to scan.
const IDENT = '[A-Za-z0-9_.-]';
const KEY = `(?:\\\\"|["'])?(?<!${IDENT})(?=${IDENT}*?(?:${CREDENTIAL_WORD}))(?=(?<ident>${IDENT}+))\\k<ident>(?:\\\\"|["'])?`;
const SEPARATOR = String.raw`\s*[:=]\s*`;
// Value alternatives, most specific first. Every quoted form is masked whole,
// quotes included.
const VALUE = [
  // Escaped-quoted string inside a serialized record: \"...\" where the body
  // may hold escaped-escaped quotes (\\\") and backslashes (\\\\).
  String.raw`\\"(?:\\\\\\"|\\\\\\\\|\\\\[^"\\]|[^"\\])*\\"`,
  // Double-quoted string honoring escapes and spaces.
  String.raw`"(?:[^"\\\n]|\\.)*"`,
  // Single-quoted string.
  String.raw`'(?:[^'\\\n]|\\.)*'`,
  // Unterminated quote: mask to the end of the line.
  String.raw`(?:\\"|["'])[^\n]*`,
  // Bare value up to whitespace or a delimiter.
  String.raw`[^\s,}&]+`,
].join('|');

const KEY_VALUE_RE = new RegExp(
  `(?<key>${KEY})(?<sep>${SEPARATOR})(?:${VALUE})`,
  'gi',
);

const TOKEN_RULES: RegExp[] = [
  // OpenAI / Anthropic style keys (sk-..., sk-ant-...).
  /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{16,}/g,
  // GitHub tokens.
  /(?<![A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{20,}/g,
  /(?<![A-Za-z0-9])github_pat_[A-Za-z0-9_]{20,}/g,
  // Slack tokens.
  /(?<![A-Za-z0-9])xox[abprs]-[A-Za-z0-9-]{10,}/g,
  // AWS access key ids.
  /(?<![A-Za-z0-9])AKIA[0-9A-Z]{16}(?![A-Za-z0-9])/g,
];

// Bearer tokens: mask long tokens, or shorter ones that contain a digit, so
// prose such as "Bearer of bad news" survives.
const BEARER_RE = /\b(Bearer\s+)([A-Za-z0-9._~+/-]+=*)/gi;

const HEX_RE = /(?<![A-Za-z0-9])[0-9a-fA-F]{40,}(?![A-Za-z0-9])/g;

const BASE64_RE = /(?<![A-Za-z0-9+/_-])[A-Za-z0-9+/_-]{40,}={0,2}/g;

// A path segment that reads as a word: lowercase letters, digits, `_`, `-`,
// optionally with one leading capital (e.g. `Users`).
const WORD_SEGMENT_RE = /^[A-Za-z]?[a-z0-9_-]*$/;

function isPathLike(run: string): boolean {
  return (
    run.includes('/') &&
    run.split('/').every((segment) => WORD_SEGMENT_RE.test(segment))
  );
}

function looksLikeEncodedSecret(run: string): boolean {
  return (
    /\d/.test(run) && /[a-z]/.test(run) && /[A-Z]/.test(run) && !isPathLike(run)
  );
}

/** Mask credential-shaped substrings with `[REDACTED]`. */
export function redact(text: string): string {
  let out = text.replace(KEY_VALUE_RE, (...args: unknown[]) => {
    const groups = args[args.length - 1] as { key: string; sep: string };
    return `${groups.key}${groups.sep}${REDACTED}`;
  });
  out = out.replace(BEARER_RE, (match, prefix: string, token: string) =>
    token.length >= 16 || (token.length >= 8 && /\d/.test(token))
      ? `${prefix}${REDACTED}`
      : match,
  );
  for (const rule of TOKEN_RULES) out = out.replace(rule, REDACTED);
  out = out.replace(HEX_RE, REDACTED);
  out = out.replace(BASE64_RE, (run) =>
    looksLikeEncodedSecret(run) ? REDACTED : run,
  );
  return out;
}
