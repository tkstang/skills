// GENERATED skill payload for session-search.

// src/skills/session-search/src/lib/rank.ts
import path2 from "node:path";

// src/skills/session-search/src/lib/options.ts
import os from "node:os";
import path from "node:path";
var DEFAULT_MAX_LINE_BYTES = 64 * 1024;
var DEFAULT_LARGE_SCAN_BYTES = 2 * 1024 * 1024 * 1024;
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
    const prefix = hint.endsWith(path2.sep) ? hint : `${hint}${path2.sep}`;
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
function snippetOrder(a, b) {
  return ROLE_ORDER.indexOf(a.hit.role) - ROLE_ORDER.indexOf(b.hit.role) || TIER_ORDER.indexOf(a.hit.tier) - TIER_ORDER.indexOf(b.hit.tier) || b.weight - a.weight || (a.hit.timestampMs ?? Number.MAX_SAFE_INTEGER) - (b.hit.timestampMs ?? Number.MAX_SAFE_INTEGER) || compareText(a.hit.sessionId, b.hit.sessionId) || compareText(a.hit.text, b.hit.text);
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
      const text = snippetFor(candidate.hit.text, matcher, candidate.hit);
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
export {
  FIRST_PROMPT_MAX_CHARS,
  MAX_SNIPPETS,
  TITLE_MAX_CHARS,
  cwdMatchesHint,
  presentText,
  rankSessions
};
