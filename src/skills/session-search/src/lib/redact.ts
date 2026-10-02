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
// suffixes allowed, e.g. AWS_SECRET_ACCESS_KEY), optionally wrapped in a
// quote preceded by any backslash run: ", ', \" (one level of escaping, as in
// raw serialized records), \\\" (two levels), and so on.
// Linear-time anchoring: the wrapper may start only at the beginning of a
// backslash run, and the identifier only at the start of its run; the
// lookahead pair then requires a credential word inside the run and consumes
// the whole run atomically.
const IDENT = '[A-Za-z0-9_.-]';
const KEY = `(?:(?<!\\\\)\\\\*["'])?(?<!${IDENT})(?=${IDENT}*?(?:${CREDENTIAL_WORD}))(?=(?<ident>${IDENT}+))\\k<ident>(?:\\\\*["'])?`;
const SEPARATOR = String.raw`\s*[:=]\s*`;
// Quoted value alternatives, most specific first. Every quoted form is masked
// whole, quotes included.
const QUOTED_VALUE = [
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
  String.raw`\\*["'][^\n]*`,
];
const VALUE = [
  ...QUOTED_VALUE,
  // Bare value up to whitespace or a delimiter.
  String.raw`[^\s,}&]+`,
].join('|');

const KEY_VALUE_RE = new RegExp(
  `(?<key>${KEY})(?<sep>${SEPARATOR})(?:${VALUE})`,
  'gi',
);

// Space-separated CLI flags such as `--password X` or `-token X`. The leading
// dash is required, so prose like "the token is" stays intact. A bare value
// that itself starts with a dash is the next flag and is left alone.
const FLAG_RE = new RegExp(
  `(?<![A-Za-z0-9_.-])(?<flag>--?(?=${IDENT}*?(?:${CREDENTIAL_WORD}))(?=(?<ident>${IDENT}+))\\k<ident>)(?<gap>[ \\t]+)(?:${[...QUOTED_VALUE, String.raw`(?!-)\S+`].join('|')})`,
  'gi',
);

// URL userinfo passwords: mask only the password in scheme://user:pass@host.
// The scheme may start only at the beginning of its run (linear time).
const USERINFO_RE =
  /(?<![A-Za-z0-9+.-])([a-z][a-z0-9+.-]*:\/\/[^\s/:@]*:)[^\s/@]+@/gi;

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

// A segment that reads as a word: lowercase letters and digits, optionally
// with one leading capital (e.g. `Users`, `ae6a`, `V2`).
const WORD_SEGMENT_RE = /^[A-Za-z]?[a-z0-9]*$/;

/**
 * Paths and slugs: runs split by `/`, `-`, or `_` into word segments, e.g.
 * `Users/Shared/Vault` or the Claude project slug `-Users-name-code-repo`.
 * Random encodings almost never split into segments without an internal
 * capital, and `+`/`=` never appear in a word segment.
 */
function isSegmentedWords(run: string): boolean {
  return (
    /[/_-]/.test(run) &&
    run.split(/[/_-]/).every((segment) => WORD_SEGMENT_RE.test(segment))
  );
}

const CAMEL_PIECE_RE = /[A-Z]?[a-z]+|[A-Z]?\d+|[A-Z]+(?![a-z])/g;

/**
 * Long camelCase identifiers such as `compileMatcherWithLiteralEscaping`:
 * every lowercase word is at least three letters (two for the first),
 * acronyms are short, and digit groups are short and never adjacent (no
 * digit-dense segment). Random base64 fails these almost surely.
 */
function isCamelIdentifier(run: string): boolean {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(run)) return false;
  const pieces = run.match(CAMEL_PIECE_RE) ?? [];
  if (pieces.join('') !== run) return false;
  let previousHadDigits = false;
  return pieces.every((piece, index) => {
    const digits = piece.replace(/\D/g, '').length;
    if (digits > 0) {
      const ok = !previousHadDigits && digits <= 3;
      previousHadDigits = true;
      return ok;
    }
    previousHadDigits = false;
    if (/[a-z]/.test(piece)) return piece.length >= (index === 0 ? 2 : 3);
    return piece.length <= 5;
  });
}

function looksLikeEncodedSecret(run: string): boolean {
  return (
    /\d/.test(run) &&
    /[a-z]/.test(run) &&
    /[A-Z]/.test(run) &&
    !isSegmentedWords(run) &&
    !isCamelIdentifier(run)
  );
}

/** Mask credential-shaped substrings with `[REDACTED]`. */
export function redact(text: string): string {
  let out = text.replace(KEY_VALUE_RE, (...args: unknown[]) => {
    const groups = args[args.length - 1] as { key: string; sep: string };
    return `${groups.key}${groups.sep}${REDACTED}`;
  });
  out = out.replace(FLAG_RE, (...args: unknown[]) => {
    const groups = args[args.length - 1] as { flag: string; gap: string };
    return `${groups.flag}${groups.gap}${REDACTED}`;
  });
  out = out.replace(
    USERINFO_RE,
    (_match, prefix: string) => `${prefix}${REDACTED}@`,
  );
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
