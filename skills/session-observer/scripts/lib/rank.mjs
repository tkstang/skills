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
 *   TIE_WINDOW_SEC      = 5   — candidates within this many seconds of the winner are "ties"
 *   ACTIVE_THRESHOLD_SEC = 60  — winners younger than this are marked active: true
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIE_WINDOW_SEC = 5;
const ACTIVE_THRESHOLD_SEC = 60;

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
export function tierOf(candidate, targetCwd) {
  const { recordedCwd } = candidate;
  if (!recordedCwd) return 'C';
  if (recordedCwd === targetCwd) return 'A';
  // Tier B: bidirectional path-prefix check (path-boundary-safe)
  if (recordedCwd.startsWith(targetCwd + '/')) return 'B';
  if (targetCwd.startsWith(recordedCwd + '/')) return 'B';
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

function cwdSlugVariants(cwd) {
  return [...new Set([
    cwd.split(/[/.]/u).filter(Boolean).join('-'),
    cwd.replace(/[/.]/g, '-'),
    cwd.replace(/\//g, '-'),
  ])];
}

function slugFromTranscriptPath(transcriptPath) {
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
function parentSlugMatches(candidate, targetCwd) {
  const slug = candidate.cwdSlug ?? slugFromTranscriptPath(candidate.transcriptPath ?? '');
  if (!slug) return false;
  return cwdSlugVariants(targetCwd).includes(slug);
}
export function rank(candidates, targetCwd, opts = {}) {
  const {
    tieWindowSec = TIE_WINDOW_SEC,
    gitWorktrees = [],
    globalRecentProvider,
  } = opts;

  // Classify all candidates into tiers. Tier C is weak Claude slug evidence,
  // not "any no-match candidate"; global recency remains diagnostic only.
  const byTier = { A: [], B: [], C: [] };
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
    const allByMtime = [...candidates].sort((a, b) => b.mtime - a.mtime);
    const globalRecent = globalRecentProvider ? globalRecentProvider() : allByMtime.slice(0, 5);
    return {
      winner: null,
      noMatch: true,
      sisters: Array.isArray(gitWorktrees) ? gitWorktrees : [],
      globalRecent,
    };
  }

  // Sort winning pool by mtime DESC
  const sorted = [...winningPool].sort((a, b) => b.mtime - a.mtime);
  const winner = sorted[0];

  // Annotate winner with active flag
  const annotatedWinner = {
    ...winner,
    active: winner.ageSec < ACTIVE_THRESHOLD_SEC,
  };

  // Detect ties: all other candidates in the winning tier within tieWindowSec of winner
  const ties = sorted
    .slice(1)
    .filter(c => winner.mtime - c.mtime <= tieWindowSec);

  // Fallbacks: remaining sorted candidates in the winning tier after winner
  const fallbacks = sorted.slice(1);

  return {
    winner: annotatedWinner,
    tier: winningTier,
    ties,
    fallbacks,
  };
}
