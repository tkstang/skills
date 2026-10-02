// GENERATED skill payload for session-search.

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
export {
  REDACTED,
  redact
};
