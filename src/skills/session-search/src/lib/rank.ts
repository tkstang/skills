/**
 * Deterministic, explainable session ranking.
 *
 * Hits are grouped by session. Subagent/child hits roll up to their parent
 * when the parent session is known (`via: 'subagent'`, half weight); orphan
 * subagents are listed on their own with `isSubagent: true`.
 *
 * score = 40 * distinctPatternsMatched / patternCount
 *       + 25 * (any user-typed hit)
 *       + 15 * (title / first-prompt hit)
 *       + 10 * cwdHintMatch
 *       +  6 * min(hitCount, 5) / 5
 *       +  4 * recency (1.0 newest in the result set → 0.0 oldest)
 *
 * Ties break by last activity (newest first), then runtime, then session id.
 * Every emitted string is redacted; snippets go through `snippetFor`, which
 * redacts the full unit before windowing.
 */
import path from 'node:path';

import { snippetFor } from './matcher.js';
import { redact } from './redact.js';
import type {
  Hit,
  Matcher,
  Runtime,
  SessionHit,
  Snippet,
  SnippetRole,
  Tier,
} from './types.js';

export const MAX_SNIPPETS = 3;
export const FIRST_PROMPT_MAX_CHARS = 160;
export const TITLE_MAX_CHARS = 200;
const SUBAGENT_WEIGHT = 0.5;
const TIER_ORDER: readonly Tier[] = ['history', 'meta', 'content', 'deep'];
const ROLE_ORDER: readonly SnippetRole[] = [
  'user',
  'title',
  'assistant',
  'context',
  'tool',
];

/** Presentation facts for one session, supplied by the pipeline. */
export interface RankSession {
  runtime: Runtime;
  sessionId: string;
  archived: boolean;
  isSubagent: boolean;
  parentSessionId: string | null;
  cwd: string | null;
  title: string | null;
  firstPrompt: string | null;
  startedAt: string | null;
  lastActivityMs: number;
  transcriptPath: string | null;
  open: { command: string | null; hint: string };
  /** Precomputed cwd-hint match (e.g. a Cursor slug match). */
  cwdMatch?: boolean;
}

export interface RankOptions {
  matcher: Matcher;
  cwdHints: readonly string[];
  limit: number;
}

interface WeightedHit {
  hit: Hit;
  weight: number;
  viaSubagent: boolean;
}

interface Group {
  session: RankSession;
  hits: WeightedHit[];
}

const keyOf = (runtime: Runtime, sessionId: string) =>
  `${runtime}\u0000${sessionId}`;

/** True when `cwd` equals a hint or lies below it. */
export function cwdMatchesHint(cwd: string | null, hints: readonly string[]) {
  if (!cwd) return false;
  const normalized = cwd.length > 1 ? cwd.replace(/\/+$/u, '') : cwd;
  return hints.some((hint) => {
    if (normalized === hint) return true;
    const prefix = hint.endsWith(path.sep) ? hint : `${hint}${path.sep}`;
    return normalized.startsWith(prefix);
  });
}

function splitsSurrogate(text: string, at: number): boolean {
  if (at <= 0 || at >= text.length) return false;
  const before = text.charCodeAt(at - 1);
  return before >= 0xd800 && before <= 0xdbff;
}

/** Redact, collapse whitespace, and cap a presentation string. */
export function presentText(value: string | null, max: number): string | null {
  if (value === null) return null;
  const text = redact(value).replace(/\s+/gu, ' ').trim();
  if (text === '') return null;
  if (text.length <= max) return text;
  let cut = max - 1;
  if (splitsSurrogate(text, cut)) cut -= 1;
  return `${text.slice(0, cut)}…`;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function snippetOrder(a: WeightedHit, b: WeightedHit): number {
  return (
    ROLE_ORDER.indexOf(a.hit.role) - ROLE_ORDER.indexOf(b.hit.role) ||
    TIER_ORDER.indexOf(a.hit.tier) - TIER_ORDER.indexOf(b.hit.tier) ||
    b.weight - a.weight ||
    (a.hit.timestampMs ?? Number.MAX_SAFE_INTEGER) -
      (b.hit.timestampMs ?? Number.MAX_SAFE_INTEGER) ||
    compareText(a.hit.sessionId, b.hit.sessionId) ||
    compareText(a.hit.text, b.hit.text)
  );
}

function fallbackSession(hit: Hit): RankSession {
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
    open: { command: null, hint: 'transcript not found on this machine' },
  };
}

/** Group, score, and order sessions; returns at most `limit` results. */
export function rankSessions(
  hits: readonly Hit[],
  sessions: readonly RankSession[],
  options: RankOptions,
): SessionHit[] {
  const { matcher } = options;
  const known = new Map<string, RankSession>();
  for (const session of sessions) {
    known.set(keyOf(session.runtime, session.sessionId), session);
  }
  const groups = new Map<string, Group>();
  const synthesized = new Set<string>();
  const groupFor = (key: string, session: RankSession): Group => {
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
    const parent = parentKey ? known.get(parentKey) : undefined;
    if (isSubagent && parentKey && parent && parentKey !== ownKey) {
      groupFor(parentKey, parent).hits.push({
        hit,
        weight: SUBAGENT_WEIGHT,
        viaSubagent: true,
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

  // Sessions without a transcript take their facts from their hits, chosen
  // independently of input order.
  for (const key of synthesized) {
    const group = groups.get(key);
    if (!group) continue;
    const ordered = group.hits.toSorted(snippetOrder);
    group.session = {
      ...group.session,
      cwd: ordered.find((entry) => entry.hit.cwd)?.hit.cwd ?? null,
      transcriptPath:
        ordered.find((entry) => entry.hit.transcriptPath)?.hit.transcriptPath ??
        null,
      lastActivityMs: Math.max(
        0,
        ...ordered.map((entry) => entry.hit.timestampMs ?? 0),
      ),
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
    const maxWeight = (predicate: (entry: WeightedHit) => boolean) =>
      group.hits.reduce(
        (best, entry) =>
          predicate(entry) && entry.weight > best ? entry.weight : best,
        0,
      );
    const patternWeights = matcher.patterns.map((pattern) =>
      maxWeight((entry) => entry.hit.patterns.includes(pattern)),
    );
    const distinct = patternWeights.reduce((sum, weight) => sum + weight, 0);
    const userTyped = maxWeight((entry) => entry.hit.userTyped);
    const presentationHit =
      (session.title !== null && matcher.match(session.title) !== null) ||
      (session.firstPrompt !== null &&
        matcher.match(session.firstPrompt) !== null);
    const titleWeight = Math.max(
      maxWeight(
        (entry) => entry.hit.role === 'title' || entry.hit.tier === 'meta',
      ),
      presentationHit ? 1 : 0,
    );
    const cwdMatch =
      session.cwdMatch ?? cwdMatchesHint(session.cwd, options.cwdHints);
    const hitCount = group.hits.reduce((sum, entry) => sum + entry.weight, 0);
    const recency =
      newest === oldest
        ? 1
        : (session.lastActivityMs - oldest) / (newest - oldest);
    const raw =
      (40 * distinct) / patternCount +
      25 * userTyped +
      15 * titleWeight +
      10 * (cwdMatch ? 1 : 0) +
      (6 * Math.min(hitCount, 5)) / 5 +
      4 * recency;
    return {
      group,
      score: Math.round(raw * 100) / 100,
      matchedPatterns: matcher.patterns.filter((_, i) => patternWeights[i] > 0),
    };
  });

  const ranked = scored.toSorted(
    (a, b) =>
      b.score - a.score ||
      b.group.session.lastActivityMs - a.group.session.lastActivityMs ||
      compareText(a.group.session.runtime, b.group.session.runtime) ||
      compareText(a.group.session.sessionId, b.group.session.sessionId),
  );

  return ranked.slice(0, Math.max(0, options.limit)).map((entry, index) => {
    const { session, hits: groupHits } = entry.group;
    const snippets: Snippet[] = [];
    const seen = new Set<string>();
    for (const candidate of groupHits.toSorted(snippetOrder)) {
      if (snippets.length >= MAX_SNIPPETS) break;
      const text = snippetFor(candidate.hit.text, matcher, candidate.hit);
      if (seen.has(text)) continue;
      seen.add(text);
      snippets.push({
        role: candidate.hit.role,
        tier: candidate.hit.tier,
        text,
        ...(candidate.viaSubagent ? { via: 'subagent' as const } : {}),
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
      open: session.open,
    };
  });
}
