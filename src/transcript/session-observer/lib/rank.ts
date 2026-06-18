/**
 * rank.mjs — Tier-based deterministic ranking of transcript candidates.
 *
 * Exports:
 *   rank(candidates, targetCwd, opts)  → RankResult
 *   tierOf(candidate, targetCwd)       → 'A' | 'B' | 'C'
 *
 * Tier definitions:
 *   A — candidate.recordedCwd === targetCwd         (exact match)
 *   B — either cwd is a path-prefix of the other       (subdir/root match)
 *   C — Claude parent-dir slug matches target cwd      (weak recovery)
 *
 * No dependency on locate.mjs. The CLI injects gitWorktrees results and the
 * globalRecentProvider via opts so rank is a pure, independently-testable function.
 *
 * Constants:
 *   TIE_WINDOW_SEC       = 5   — close candidates within this many seconds are "ties"
 *   ACTIVE_THRESHOLD_SEC = 60  — winners younger than this are marked active: true
 */

import { realpathSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIE_WINDOW_SEC = 5;
const ACTIVE_THRESHOLD_SEC = 60;
const CLOSE_REAL_MESSAGE_DELTA = 2;
const CLOSE_SIZE_RATIO = 0.9;
const CLOSE_SIZE_ABS = 4096;

// ---------------------------------------------------------------------------
// Path normalization
// ---------------------------------------------------------------------------

function stripTrailingSlashes(path: any): any {
  if (path === '/') return path;
  return path.replace(/\/+$/u, '');
}

export function realpathSafe(path: any): any {
  try {
    return realpathSync.native(path);
  } catch {
    return path;
  }
}

function normalizeCwdPath(path: any): any {
  return stripTrailingSlashes(realpathSafe(path));
}

// ---------------------------------------------------------------------------
// tierOf
// ---------------------------------------------------------------------------

/**
 * Classify a candidate against a target cwd.
 *
 * Tier A: recordedCwd matches targetCwd exactly.
 * Tier B: either side is a path-prefix of the other (bidirectional), using a
 *         path-boundary-safe check (append '/' sentinel to avoid false matches
 *         like /foo/bar matching /foo/barbaz). This covers two cases:
 *           (a) recordedCwd starts with targetCwd + '/' — session started in a subdir
 *           (b) targetCwd starts with recordedCwd + '/' — agent invoked in a subdir,
 *               session was started at the repo root
 * Tier C: no relationship.
 *
 * Null recordedCwd → Tier C.
 *
 * @param {{ recordedCwd: string | null }} candidate
 * @param {string} targetCwd
 * @returns {'A' | 'B' | 'C'}
 */
export function tierOf(candidate: any, targetCwd: any): any {
  const { recordedCwd } = candidate;
  if (!recordedCwd) return 'C';
  const normalizedRecordedCwd = normalizeCwdPath(recordedCwd);
  const normalizedTargetCwd = normalizeCwdPath(targetCwd);
  if (normalizedRecordedCwd === normalizedTargetCwd) return 'A';
  // Tier B: bidirectional path-prefix check (path-boundary-safe)
  if (normalizedRecordedCwd.startsWith(normalizedTargetCwd + '/')) return 'B';
  if (normalizedTargetCwd.startsWith(normalizedRecordedCwd + '/')) return 'B';
  return 'C';
}

// ---------------------------------------------------------------------------
// rank
// ---------------------------------------------------------------------------

/**
 * Rank candidates for a target cwd and return the best match.
 *
 * @param {object[]} candidates   — Candidate[] from locate.discover
 * @param {string} targetCwd
 * @param {object} [opts]
 * @param {number} [opts.tieWindowSec=5]       — seconds within which two candidates are "tied"
 * @param {string[]} [opts.gitWorktrees=[]]    — sister worktree paths for noMatch widening
 * @param {(() => object[]) | undefined} [opts.globalRecentProvider]
 *   — optional function returning all candidates sorted by mtime DESC for globalRecent (top-5)
 *
 * @returns {RankResult}
 *
 * RankResult (match):
 *   { winner, tier, ties: Candidate[], fallbacks: Candidate[] }
 *
 * RankResult (noMatch):
 *   { winner: null, noMatch: true, sisters: string[], globalRecent: Candidate[] }
 */

function cwdSlugVariants(cwd: any): any {
  return [
    ...new Set([
      cwd.split(/[/.]/u).filter(Boolean).join('-'),
      cwd.replace(/[/.]/g, '-'),
      cwd.replace(/\//g, '-'),
    ]),
  ];
}

function slugFromTranscriptPath(transcriptPath: any): any {
  const marker = '/.claude/projects/';
  const index = transcriptPath.indexOf(marker);
  if (index === -1) return null;
  const rest = transcriptPath.slice(index + marker.length);
  const slash = rest.indexOf('/');
  return slash === -1 ? rest : rest.slice(0, slash);
}

/**
 * Weak recovery for Claude fallback candidates whose parent directory slug
 * matches the requested cwd even though the lossy decoded cwd does not.
 *
 * @param {object} candidate
 * @param {string} targetCwd
 * @returns {boolean}
 */
function parentSlugMatches(candidate: any, targetCwd: any): any {
  const slug =
    candidate.cwdSlug ?? slugFromTranscriptPath(candidate.transcriptPath ?? '');
  if (!slug) return false;
  return cwdSlugVariants(targetCwd).includes(slug);
}

function engagementStatus(candidate: any): any {
  const status = candidate.engagementStatus ?? candidate.engagement?.status;
  return status === 'unengaged' ? 'unengaged' : 'engaged';
}

function isEngaged(candidate: any): any {
  return engagementStatus(candidate) !== 'unengaged';
}

function metric(candidate: any, key: any): any {
  const value = candidate[key] ?? candidate.engagement?.[key];
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function hasAssistantAndUser(candidate: any): any {
  return Boolean(
    candidate.hasAssistantAndUser ?? candidate.engagement?.hasAssistantAndUser,
  );
}

function compareCandidatePreference(a: any, b: any): any {
  if (isEngaged(a) !== isEngaged(b)) return isEngaged(a) ? -1 : 1;
  if (hasAssistantAndUser(a) !== hasAssistantAndUser(b)) {
    return hasAssistantAndUser(a) ? -1 : 1;
  }

  const realMessageDelta =
    metric(b, 'realMessageCount') - metric(a, 'realMessageCount');
  if (realMessageDelta !== 0) return realMessageDelta;

  const userDelta =
    metric(b, 'genuineUserMessages') - metric(a, 'genuineUserMessages');
  if (userDelta !== 0) return userDelta;

  const assistantDelta =
    metric(b, 'assistantMessages') - metric(a, 'assistantMessages');
  if (assistantDelta !== 0) return assistantDelta;

  const sizeDelta = (b.size ?? 0) - (a.size ?? 0);
  if (sizeDelta !== 0) return sizeDelta;

  return (b.mtime ?? 0) - (a.mtime ?? 0);
}

function sizesClose(a: any, b: any): any {
  const aSize = Number(a.size ?? 0);
  const bSize = Number(b.size ?? 0);
  const diff = Math.abs(aSize - bSize);
  if (diff <= CLOSE_SIZE_ABS) return true;
  const larger = Math.max(aSize, bSize);
  const smaller = Math.min(aSize, bSize);
  if (larger === 0) return true;
  return smaller / larger >= CLOSE_SIZE_RATIO;
}

function closeEngagedTie(winner: any, candidate: any, tieWindowSec: any): any {
  if (!isEngaged(winner) || !isEngaged(candidate)) return false;
  if (hasAssistantAndUser(winner) !== hasAssistantAndUser(candidate))
    return false;
  if (
    Math.abs(
      metric(winner, 'realMessageCount') -
        metric(candidate, 'realMessageCount'),
    ) > CLOSE_REAL_MESSAGE_DELTA
  )
    return false;
  if (!sizesClose(winner, candidate)) return false;
  return Math.abs((winner.mtime ?? 0) - (candidate.mtime ?? 0)) <= tieWindowSec;
}

export function rank(candidates: any, targetCwd: any, opts: any = {}): any {
  const {
    tieWindowSec = TIE_WINDOW_SEC,
    gitWorktrees = [],
    globalRecentProvider,
  } = opts;

  // Classify all candidates into tiers. Tier C is weak Claude slug evidence,
  // not "any no-match candidate"; global recency remains diagnostic only.
  const byTier: any = { A: [], B: [], C: [] };
  for (const c of candidates) {
    const tier = tierOf(c, targetCwd);
    if (tier === 'A' || tier === 'B') {
      byTier[tier].push(c);
    } else if (parentSlugMatches(c, targetCwd)) {
      byTier.C.push(c);
    }
  }

  // Find the best non-empty tier (A > B > C)
  let winningTier = null;
  let winningPool = null;
  if (byTier.A.length > 0) {
    winningTier = 'A';
    winningPool = byTier.A;
  } else if (byTier.B.length > 0) {
    winningTier = 'B';
    winningPool = byTier.B;
  } else if (byTier.C.length > 0) {
    winningTier = 'C';
    winningPool = byTier.C;
  }

  // No match case
  if (!winningTier) {
    const allByMtime = [...candidates].toSorted(
      (a: any, b: any): any => b.mtime - a.mtime,
    );
    const globalRecent = globalRecentProvider
      ? globalRecentProvider()
      : allByMtime.slice(0, 5);
    return {
      winner: null,
      noMatch: true,
      sisters: Array.isArray(gitWorktrees) ? gitWorktrees : [],
      globalRecent,
    };
  }

  const engagedPool = winningPool.filter(isEngaged);
  const unengagedPool = winningPool.filter(
    (candidate: any): any => !isEngaged(candidate),
  );
  if (engagedPool.length === 0) {
    return {
      winner: null,
      unengagedOnly: true,
      tier: winningTier,
      candidates: [...unengagedPool].toSorted(compareCandidatePreference),
      message: 'Only unengaged sessions matched this cwd.',
    };
  }

  // Sort winning pool by engagement signals first, then transcript weight, then
  // mtime. This prevents freshly spawned bootstrap sessions from beating an
  // idle but substantive human conversation.
  const sorted = [...engagedPool].toSorted(compareCandidatePreference);
  const winner = sorted[0];

  // Annotate winner with active flag
  const annotatedWinner: any = {
    ...winner,
    active: winner.ageSec < ACTIVE_THRESHOLD_SEC,
  };

  // Detect ties: other engaged candidates with effectively equivalent
  // engagement/size signals and close mtimes.
  const ties = sorted
    .slice(1)
    .filter((c: any): any => closeEngagedTie(winner, c, tieWindowSec));

  // Fallbacks: remaining sorted candidates in the winning tier after winner
  const fallbacks = [
    ...sorted.slice(1),
    ...unengagedPool.toSorted(compareCandidatePreference),
  ];

  return {
    winner: annotatedWinner,
    tier: winningTier,
    ties,
    fallbacks,
  };
}
