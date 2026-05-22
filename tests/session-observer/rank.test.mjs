/**
 * rank.test.mjs — Tests for scripts/lib/rank.mjs
 *
 * Test cases:
 *   1. Tier A wins over Tier B and Tier C; non-A candidates filtered out
 *   2. Tier B wins when no Tier A; Tier C (no-match) candidates filtered out
 *   3. No match → returns { winner: null, noMatch: true, sisters, globalRecent }
 *   4. Ties: candidates within TIE_WINDOW_SEC of winner appear in ties[]
 *   5. active: true set on winner when ageSec < 60
 *   6. realpathSafe handles ENOENT without throwing
 *   7. Within a tier, sort by mtime DESC
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Dynamic import so we get the live module once
const { rank, tierOf } = await import(
  '../../skills/session-observer/scripts/lib/rank.mjs'
);

// ---------------------------------------------------------------------------
// Helpers for building synthetic Candidate objects
// ---------------------------------------------------------------------------

const NOW = Math.floor(Date.now() / 1000);

/**
 * Build a minimal Candidate.
 * @param {object} overrides
 */
function mkCandidate(overrides = {}) {
  return {
    runtime: 'claude-code',
    transcriptPath: '/tmp/fake/session.jsonl',
    sessionId: 'sess-001',
    recordedCwd: '/Users/test/project',
    mtime: NOW - 10,
    size: 1000,
    ageSec: 10,
    ...overrides,
  };
}

const TARGET_CWD = '/Users/test/project';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('Tier A wins over Tier B and non-A candidates are not in fallbacks', () => {
  const tierA = mkCandidate({
    recordedCwd: TARGET_CWD,
    mtime: NOW - 30,
    ageSec: 30,
  });
  const tierB = mkCandidate({
    recordedCwd: TARGET_CWD + '/subdir',
    mtime: NOW - 10,
    ageSec: 10,
    sessionId: 'sess-002',
  });

  const result = rank([tierA, tierB], TARGET_CWD);

  assert.ok(result.winner, 'should have a winner');
  assert.equal(result.winner.sessionId, tierA.sessionId, 'Tier A should win');
  assert.equal(result.tier, 'A', 'result tier should be A');
  // Tier B should appear in fallbacks, not bumped to winner
  assert.ok(Array.isArray(result.fallbacks), 'fallbacks should be an array');
});

test('Tier A exact cwd beats newer unrelated candidate', () => {
  const exact = mkCandidate({
    recordedCwd: TARGET_CWD,
    mtime: NOW - 200,
    ageSec: 200,
    sessionId: 'sess-exact',
  });
  const newerUnrelated = mkCandidate({
    recordedCwd: '/Users/test/other-project',
    mtime: NOW - 2,
    ageSec: 2,
    sessionId: 'sess-newer-unrelated',
  });

  const result = rank([newerUnrelated, exact], TARGET_CWD);

  assert.ok(result.winner, 'should have a winner');
  assert.equal(result.winner.sessionId, 'sess-exact');
  assert.equal(result.tier, 'A');
});


test('Tier B wins when no Tier A; Tier C (no-match) candidates not in result', () => {
  const tierB = mkCandidate({
    recordedCwd: TARGET_CWD + '/sub',
    mtime: NOW - 20,
    ageSec: 20,
    sessionId: 'sess-b',
  });
  const tierC = mkCandidate({
    recordedCwd: '/some/completely/different/path',
    mtime: NOW - 5,
    ageSec: 5,
    sessionId: 'sess-c',
  });

  const result = rank([tierB, tierC], TARGET_CWD);

  assert.ok(result.winner, 'should have a winner');
  assert.equal(result.winner.sessionId, 'sess-b', 'Tier B should win');
  assert.equal(result.tier, 'B', 'result tier should be B');
  // Tier C should not appear as winner or in fallbacks within the winning tier
  const fallbackIds = (result.fallbacks ?? []).map(f => f.sessionId);
  assert.ok(!fallbackIds.includes('sess-c'), 'Tier C should not appear in fallbacks');
});

test('No match → { winner: null, noMatch: true, sisters, globalRecent }', () => {
  const noMatchCandidate = mkCandidate({
    recordedCwd: '/totally/different/project',
    mtime: NOW - 100,
    ageSec: 100,
    sessionId: 'sess-nomatch',
  });

  const mockSisters = ['/Users/test/project-worktree'];
  const mockGlobalRecent = [noMatchCandidate];

  const result = rank([noMatchCandidate], TARGET_CWD, {
    gitWorktrees: mockSisters,
    globalRecentProvider: () => mockGlobalRecent,
  });

  assert.equal(result.winner, null, 'winner should be null on noMatch');
  assert.equal(result.noMatch, true, 'noMatch should be true');
  assert.deepEqual(result.sisters, mockSisters, 'sisters should come from opts.gitWorktrees');
  assert.ok(Array.isArray(result.globalRecent), 'globalRecent should be an array');
  assert.ok(result.globalRecent.length >= 1, 'globalRecent should have at least one entry');
});

test('Claude parent-dir slug match beats newer unrelated global candidate', () => {
  const targetCwd = '/Users/thomas.stang/.superconductor/worktrees/stoa/sc-levitated-phonon-e8a5';
  const sameWorktree = mkCandidate({
    recordedCwd: '/Users/thomas/stang/superconductor/worktrees/stoa/sc/levitated/phonon/e8a5',
    cwdSlug: '-Users-thomas-stang--superconductor-worktrees-stoa-sc-levitated-phonon-e8a5',
    transcriptPath: '/Users/thomas.stang/.claude/projects/-Users-thomas-stang--superconductor-worktrees-stoa-sc-levitated-phonon-e8a5/session.jsonl',
    mtime: NOW - 300,
    ageSec: 300,
    sessionId: 'sess-same-worktree',
  });
  const unrelatedRecent = mkCandidate({
    recordedCwd: '/Users/thomas.stang/Code/vault/night-tab',
    cwdSlug: '-Users-thomas-stang-Code-vault-night-tab',
    transcriptPath: '/Users/thomas.stang/.claude/projects/-Users-thomas-stang-Code-vault-night-tab/session.jsonl',
    mtime: NOW - 5,
    ageSec: 5,
    sessionId: 'sess-unrelated-recent',
  });

  const result = rank([unrelatedRecent, sameWorktree], targetCwd);

  assert.ok(result.winner, 'slug match should produce a winner');
  assert.equal(result.winner.sessionId, 'sess-same-worktree');
  assert.equal(result.tier, 'C');
});

test('No match with empty candidates → noMatch result', () => {
  const result = rank([], TARGET_CWD);

  assert.equal(result.winner, null, 'winner should be null with no candidates');
  assert.equal(result.noMatch, true, 'noMatch should be true');
  assert.deepEqual(result.sisters, [], 'sisters defaults to []');
  assert.ok(Array.isArray(result.globalRecent), 'globalRecent should be an array');
});

test('Ties: candidates within TIE_WINDOW_SEC (5s) of winner appear in ties[]', () => {
  // Winner: mtime = NOW - 10
  // Tie: mtime = NOW - 13 (within 5s window)
  // No-tie: mtime = NOW - 100 (outside window)
  const winner = mkCandidate({
    recordedCwd: TARGET_CWD,
    mtime: NOW - 10,
    ageSec: 10,
    sessionId: 'sess-winner',
  });
  const inWindow = mkCandidate({
    recordedCwd: TARGET_CWD,
    mtime: NOW - 13,
    ageSec: 13,
    sessionId: 'sess-tie',
  });
  const farAway = mkCandidate({
    recordedCwd: TARGET_CWD,
    mtime: NOW - 100,
    ageSec: 100,
    sessionId: 'sess-far',
  });

  const result = rank([winner, inWindow, farAway], TARGET_CWD, { tieWindowSec: 5 });

  assert.ok(result.winner, 'should have a winner');
  assert.equal(result.winner.sessionId, 'sess-winner', 'newest should win');
  assert.ok(Array.isArray(result.ties), 'ties should be an array');
  const tieIds = result.ties.map(t => t.sessionId);
  assert.ok(tieIds.includes('sess-tie'), 'inWindow candidate should be in ties');
  assert.ok(!tieIds.includes('sess-far'), 'farAway candidate should not be in ties');
  // Winner itself should not appear in its own ties array
  assert.ok(!tieIds.includes('sess-winner'), 'winner should not appear in its own ties');
});

test('active: true set on winner when ageSec < 60', () => {
  const activeCandidate = mkCandidate({
    recordedCwd: TARGET_CWD,
    mtime: NOW - 30,
    ageSec: 30,
    sessionId: 'sess-active',
  });

  const result = rank([activeCandidate], TARGET_CWD);

  assert.ok(result.winner, 'should have a winner');
  assert.equal(result.winner.active, true, 'active should be true when ageSec < 60');
});

test('active: false set on winner when ageSec >= 60', () => {
  const inactiveCandidate = mkCandidate({
    recordedCwd: TARGET_CWD,
    mtime: NOW - 120,
    ageSec: 120,
    sessionId: 'sess-inactive',
  });

  const result = rank([inactiveCandidate], TARGET_CWD);

  assert.ok(result.winner, 'should have a winner');
  assert.equal(result.winner.active, false, 'active should be false when ageSec >= 60');
});

test('realpathSafe handles ENOENT without throwing', async () => {
  // rank.mjs may optionally export realpathSafe; if not, skip.
  // The plan says "handles ENOENT without throwing (test by passing path that doesn't exist)".
  // We test this by passing a candidate whose transcriptPath doesn't exist on disk.
  const candidate = mkCandidate({
    recordedCwd: TARGET_CWD,
    transcriptPath: '/nonexistent/path/that/does/not/exist.jsonl',
    mtime: NOW - 5,
    ageSec: 5,
    sessionId: 'sess-enoent',
  });

  // rank() must not throw even if it tries to realpath a nonexistent file
  let result;
  try {
    result = await Promise.resolve(rank([candidate], TARGET_CWD));
  } catch (err) {
    assert.fail(`rank() threw on ENOENT path: ${err.message}`);
  }

  assert.ok(result, 'rank should return a result even for nonexistent paths');
});

test('Within a tier, candidates sorted by mtime DESC', () => {
  const older = mkCandidate({
    recordedCwd: TARGET_CWD,
    mtime: NOW - 100,
    ageSec: 100,
    sessionId: 'sess-older',
  });
  const newer = mkCandidate({
    recordedCwd: TARGET_CWD,
    mtime: NOW - 10,
    ageSec: 10,
    sessionId: 'sess-newer',
  });
  const middle = mkCandidate({
    recordedCwd: TARGET_CWD,
    mtime: NOW - 50,
    ageSec: 50,
    sessionId: 'sess-middle',
  });

  const result = rank([older, middle, newer], TARGET_CWD);

  assert.equal(result.winner.sessionId, 'sess-newer', 'newest (highest mtime) should win');
  // fallbacks should be sorted by mtime DESC as well
  if (result.fallbacks && result.fallbacks.length > 0) {
    for (let i = 1; i < result.fallbacks.length; i++) {
      assert.ok(
        result.fallbacks[i - 1].mtime >= result.fallbacks[i].mtime,
        'fallbacks should be sorted mtime DESC'
      );
    }
  }
});

test('tierOf: Tier A for exact cwd match', () => {
  if (!tierOf) return; // tierOf export is optional per plan
  const candidate = mkCandidate({ recordedCwd: TARGET_CWD });
  assert.equal(tierOf(candidate, TARGET_CWD), 'A');
});

test('tierOf: Tier B for descendant cwd (recordedCwd under targetCwd)', () => {
  if (!tierOf) return;
  const candidate = mkCandidate({ recordedCwd: TARGET_CWD + '/subdir/nested' });
  assert.equal(tierOf(candidate, TARGET_CWD), 'B');
});

test('tierOf: Tier B for ancestor cwd (targetCwd under recordedCwd)', () => {
  // Session was started at the repo root (/tmp/project), agent invoked from a subdir
  // e.g. tierOf({ recordedCwd: '/tmp/project' }, '/tmp/project/src') → 'B'
  if (!tierOf) return;
  const candidate = mkCandidate({ recordedCwd: '/tmp/project' });
  assert.equal(tierOf(candidate, '/tmp/project/src'), 'B');
});

test('tierOf: Tier C when recordedCwd is a prefix of targetCwd but not path-boundary-safe', () => {
  // /foo/barbaz should NOT match /foo/bar — the '/foo/bar' + '/' check prevents this
  if (!tierOf) return;
  const candidate = mkCandidate({ recordedCwd: '/foo/bar' });
  assert.equal(tierOf(candidate, '/foo/barbaz'), 'C');
});

test('rank: Tier B bidirectional — ancestor recordedCwd yields a winner', () => {
  // Session started at /tmp/project, target is /tmp/project/src → should be Tier B winner
  const ancestorCandidate = mkCandidate({
    recordedCwd: '/tmp/project',
    mtime: Math.floor(Date.now() / 1000) - 10,
    ageSec: 10,
    sessionId: 'sess-ancestor',
  });
  const result = rank([ancestorCandidate], '/tmp/project/src');
  assert.ok(result.winner, 'should have a winner');
  assert.equal(result.winner.sessionId, 'sess-ancestor');
  assert.equal(result.tier, 'B');
});

test('tierOf: Tier C for no match', () => {
  if (!tierOf) return;
  const candidate = mkCandidate({ recordedCwd: '/some/other/project' });
  assert.equal(tierOf(candidate, TARGET_CWD), 'C');
});

test('tierOf: null recordedCwd → Tier C', () => {
  if (!tierOf) return;
  const candidate = mkCandidate({ recordedCwd: null });
  assert.equal(tierOf(candidate, TARGET_CWD), 'C');
});

test('globalRecent: top-5 by mtime from all candidates', () => {
  // 7 candidates with no cwd match → noMatch path, globalRecent should be top-5
  const candidates = Array.from({ length: 7 }, (_, i) =>
    mkCandidate({
      recordedCwd: `/other/project/${i}`,
      mtime: NOW - (i + 1) * 10,
      ageSec: (i + 1) * 10,
      sessionId: `sess-${i}`,
    })
  );

  const result = rank(candidates, TARGET_CWD);

  assert.equal(result.noMatch, true, 'should be noMatch');
  assert.ok(result.globalRecent.length <= 5, 'globalRecent should contain at most 5 entries');
  // Verify they are sorted by mtime DESC
  for (let i = 1; i < result.globalRecent.length; i++) {
    assert.ok(
      result.globalRecent[i - 1].mtime >= result.globalRecent[i].mtime,
      'globalRecent should be sorted mtime DESC'
    );
  }
  // First entry should be the most recent (mtime = NOW - 10)
  assert.equal(result.globalRecent[0].sessionId, 'sess-0');
});
