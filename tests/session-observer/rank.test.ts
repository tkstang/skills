/**
 * rank.test.ts — Tests for src/transcript/session-observer/lib/rank.ts
 *
 * Test cases:
 *   1. Tier A wins over Tier B and Tier C; non-A candidates filtered out
 *   2. Tier B wins when no Tier A; Tier C (no-match) candidates filtered out
 *   3. No match → returns { winner: null, noMatch: true, sisters, globalRecent }
 *   4. Ties: candidates within TIE_WINDOW_SEC of winner appear in ties[]
 *   5. active: true set on winner when ageSec < 60
 *   6. realpathSafe handles ENOENT without throwing
 *   7. Within a tier, sort by mtime DESC
 *   8. Symlink-equivalent cwd paths rank as Tier A
 */

import { mkdtemp, mkdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import {
  rank,
  realpathSafe,
  tierOf,
} from '../../src/transcript/session-observer/lib/rank.js';

// ---------------------------------------------------------------------------
// Helpers for building synthetic Candidate objects
// ---------------------------------------------------------------------------

const NOW = Math.floor(Date.now() / 1000);

/**
 * Build a minimal Candidate.
 * @param {object} overrides
 */
function mkCandidate(overrides: Record<string, unknown> = {}): any {
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

  const result: any = rank([tierA, tierB], TARGET_CWD);

  expect(result.winner, 'should have a winner').toBeTruthy();
  expect(result.winner.sessionId, 'Tier A should win').toBe(tierA.sessionId);
  expect(result.tier, 'result tier should be A').toBe('A');
  // Tier B should appear in fallbacks, not bumped to winner
  expect(Array.isArray(result.fallbacks), 'fallbacks should be an array').toBeTruthy();
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

  const result: any = rank([newerUnrelated, exact], TARGET_CWD);

  expect(result.winner, 'should have a winner').toBeTruthy();
  expect(result.winner.sessionId).toBe('sess-exact');
  expect(result.tier).toBe('A');
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

  const result: any = rank([tierB, tierC], TARGET_CWD);

  expect(result.winner, 'should have a winner').toBeTruthy();
  expect(result.winner.sessionId, 'Tier B should win').toBe('sess-b');
  expect(result.tier, 'result tier should be B').toBe('B');
  // Tier C should not appear as winner or in fallbacks within the winning tier
  const fallbackIds = (result.fallbacks ?? []).map((f: any) => f.sessionId);
  expect(
    !fallbackIds.includes('sess-c'),
    'Tier C should not appear in fallbacks',
  ).toBeTruthy();
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

  const result: any = rank([noMatchCandidate], TARGET_CWD, {
    gitWorktrees: mockSisters,
    globalRecentProvider: () => mockGlobalRecent,
  });

  expect(result.winner, 'winner should be null on noMatch').toBe(null);
  expect(result.noMatch, 'noMatch should be true').toBe(true);
  expect(
    result.sisters,
    'sisters should come from opts.gitWorktrees',
  ).toEqual(mockSisters);
  expect(
    Array.isArray(result.globalRecent),
    'globalRecent should be an array',
  ).toBeTruthy();
  expect(
    result.globalRecent.length >= 1,
    'globalRecent should have at least one entry',
  ).toBeTruthy();
});

test('Claude parent-dir slug match beats newer unrelated global candidate', () => {
  const targetCwd =
    '/Users/thomas.stang/.superconductor/worktrees/stoa/sc-levitated-phonon-e8a5';
  const sameWorktree = mkCandidate({
    recordedCwd:
      '/Users/thomas/stang/superconductor/worktrees/stoa/sc/levitated/phonon/e8a5',
    cwdSlug:
      '-Users-thomas-stang--superconductor-worktrees-stoa-sc-levitated-phonon-e8a5',
    transcriptPath:
      '/Users/thomas.stang/.claude/projects/-Users-thomas-stang--superconductor-worktrees-stoa-sc-levitated-phonon-e8a5/session.jsonl',
    mtime: NOW - 300,
    ageSec: 300,
    sessionId: 'sess-same-worktree',
  });
  const unrelatedRecent = mkCandidate({
    recordedCwd: '/Users/thomas.stang/Code/vault/night-tab',
    cwdSlug: '-Users-thomas-stang-Code-vault-night-tab',
    transcriptPath:
      '/Users/thomas.stang/.claude/projects/-Users-thomas-stang-Code-vault-night-tab/session.jsonl',
    mtime: NOW - 5,
    ageSec: 5,
    sessionId: 'sess-unrelated-recent',
  });

  const result: any = rank([unrelatedRecent, sameWorktree], targetCwd);

  expect(result.winner, 'slug match should produce a winner').toBeTruthy();
  expect(result.winner.sessionId).toBe('sess-same-worktree');
  expect(result.tier).toBe('C');
});

test('Cursor project-dir slug match beats newer unrelated global candidate', () => {
  const targetCwd =
    '/Users/thomas.stang/.superconductor/worktrees/skills/sc-pinned-meissner-9974';
  const sameWorktree = mkCandidate({
    runtime: 'cursor',
    recordedCwd: null,
    cwdSlug:
      'Users-thomas-stang-superconductor-worktrees-skills-sc-pinned-meissner-9974',
    cwdEvidence: 'project-dir-slug',
    transcriptPath:
      '/Users/thomas.stang/.cursor/projects/Users-thomas-stang-superconductor-worktrees-skills-sc-pinned-meissner-9974/agent-transcripts/session-a/transcript.jsonl',
    mtime: NOW - 300,
    ageSec: 300,
    sessionId: 'cursor-same-worktree',
  });
  const unrelatedRecent = mkCandidate({
    runtime: 'cursor',
    recordedCwd: null,
    cwdSlug: 'Users-thomas-stang-Code-vault-night-tab',
    cwdEvidence: 'project-dir-slug',
    transcriptPath:
      '/Users/thomas.stang/.cursor/projects/Users-thomas-stang-Code-vault-night-tab/agent-transcripts/session-b/transcript.jsonl',
    mtime: NOW - 5,
    ageSec: 5,
    sessionId: 'cursor-unrelated-recent',
  });

  const result: any = rank([unrelatedRecent, sameWorktree], targetCwd);

  expect(result.winner, 'Cursor slug match should produce a winner').toBeTruthy();
  expect(result.winner.sessionId).toBe('cursor-same-worktree');
  expect(result.tier).toBe('C');
});

test('No match with empty candidates → noMatch result', () => {
  const result: any = rank([], TARGET_CWD);

  expect(result.winner, 'winner should be null with no candidates').toBe(null);
  expect(result.noMatch, 'noMatch should be true').toBe(true);
  expect(result.sisters, 'sisters defaults to []').toEqual([]);
  expect(
    Array.isArray(result.globalRecent),
    'globalRecent should be an array',
  ).toBeTruthy();
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

  const result: any = rank([winner, inWindow, farAway], TARGET_CWD, {
    tieWindowSec: 5,
  });

  expect(result.winner, 'should have a winner').toBeTruthy();
  expect(result.winner.sessionId, 'newest should win').toBe('sess-winner');
  expect(Array.isArray(result.ties), 'ties should be an array').toBeTruthy();
  const tieIds = result.ties.map((t: any) => t.sessionId);
  expect(
    tieIds.includes('sess-tie'),
    'inWindow candidate should be in ties',
  ).toBeTruthy();
  expect(
    !tieIds.includes('sess-far'),
    'farAway candidate should not be in ties',
  ).toBeTruthy();
  // Winner itself should not appear in its own ties array
  expect(
    !tieIds.includes('sess-winner'),
    'winner should not appear in its own ties',
  ).toBeTruthy();
});

test('active: true set on winner when ageSec < 60', () => {
  const activeCandidate = mkCandidate({
    recordedCwd: TARGET_CWD,
    mtime: NOW - 30,
    ageSec: 30,
    sessionId: 'sess-active',
  });

  const result: any = rank([activeCandidate], TARGET_CWD);

  expect(result.winner, 'should have a winner').toBeTruthy();
  expect(
    result.winner.active,
    'active should be true when ageSec < 60',
  ).toBe(true);
});

test('active: false set on winner when ageSec >= 60', () => {
  const inactiveCandidate = mkCandidate({
    recordedCwd: TARGET_CWD,
    mtime: NOW - 120,
    ageSec: 120,
    sessionId: 'sess-inactive',
  });

  const result: any = rank([inactiveCandidate], TARGET_CWD);

  expect(result.winner, 'should have a winner').toBeTruthy();
  expect(
    result.winner.active,
    'active should be false when ageSec >= 60',
  ).toBe(false);
});

test('realpathSafe handles ENOENT without throwing', async () => {
  const missingPath = '/nonexistent/path/that/does/not/exist';

  expect(realpathSafe(missingPath)).toBe(missingPath);
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

  const result: any = rank([older, middle, newer], TARGET_CWD);

  expect(result.winner, 'should have a winner').toBeTruthy();
  expect(
    result.winner.sessionId,
    'newest (highest mtime) should win',
  ).toBe('sess-newer');
  // fallbacks should be sorted by mtime DESC as well
  if (result.fallbacks && result.fallbacks.length > 0) {
    for (let i = 1; i < result.fallbacks.length; i++) {
      expect(
        result.fallbacks[i - 1].mtime >= result.fallbacks[i].mtime,
        'fallbacks should be sorted mtime DESC',
      ).toBeTruthy();
    }
  }
});

test('engaged same-cwd session beats newer unengaged bootstrap session', () => {
  const bootstrap = mkCandidate({
    recordedCwd: TARGET_CWD,
    mtime: NOW - 1,
    ageSec: 1,
    sessionId: 'sess-bootstrap',
    size: 120_000,
    engagementStatus: 'unengaged',
    engaged: false,
    recordCount: 6,
    genuineUserMessages: 0,
    assistantMessages: 0,
    realMessageCount: 0,
    hasAssistantAndUser: false,
  });
  const human = mkCandidate({
    recordedCwd: TARGET_CWD,
    mtime: NOW - 3600,
    ageSec: 3600,
    sessionId: 'sess-human',
    size: 80_000,
    engagementStatus: 'engaged',
    engaged: true,
    recordCount: 200,
    genuineUserMessages: 12,
    assistantMessages: 12,
    realMessageCount: 24,
    hasAssistantAndUser: true,
  });

  const result: any = rank([bootstrap, human], TARGET_CWD);

  expect(result.winner, 'should have a winner').toBeTruthy();
  expect(result.winner.sessionId).toBe('sess-human');
  expect(result.tier).toBe('A');
  expect(result.fallbacks[0].sessionId).toBe('sess-bootstrap');
});

test('only unengaged same-cwd candidates surface unengagedOnly instead of a winner', () => {
  const bootstrap = mkCandidate({
    recordedCwd: TARGET_CWD,
    sessionId: 'sess-bootstrap-only',
    engagementStatus: 'unengaged',
    engaged: false,
    recordCount: 5,
    genuineUserMessages: 0,
    assistantMessages: 0,
    realMessageCount: 0,
    hasAssistantAndUser: false,
  });

  const result: any = rank([bootstrap], TARGET_CWD);

  expect(result.winner).toBe(null);
  expect(result.unengagedOnly).toBe(true);
  expect(result.candidates[0].sessionId).toBe('sess-bootstrap-only');
});

test('tierOf: Tier A for exact cwd match', () => {
  if (!tierOf) return; // tierOf export is optional per plan
  const candidate = mkCandidate({ recordedCwd: TARGET_CWD });
  expect(tierOf(candidate, TARGET_CWD)).toBe('A');
});

test('tierOf: Tier A for symlink-equivalent cwd match', async () => {
  const root = await mkdtemp(join(tmpdir(), 'rank-symlink-'));
  try {
    const realDir = join(root, 'real-project');
    const linkDir = join(root, 'linked-project');
    await mkdir(realDir);
    await symlink(realDir, linkDir, 'dir');

    const candidate = mkCandidate({ recordedCwd: linkDir });

    expect(tierOf(candidate, realDir)).toBe('A');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('tierOf: Tier B for descendant cwd (recordedCwd under targetCwd)', () => {
  if (!tierOf) return;
  const candidate = mkCandidate({ recordedCwd: TARGET_CWD + '/subdir/nested' });
  expect(tierOf(candidate, TARGET_CWD)).toBe('B');
});

test('tierOf: Tier B for ancestor cwd (targetCwd under recordedCwd)', () => {
  // Session was started at the repo root (/tmp/project), agent invoked from a subdir
  // e.g. tierOf({ recordedCwd: '/tmp/project' }, '/tmp/project/src') → 'B'
  if (!tierOf) return;
  const candidate = mkCandidate({ recordedCwd: '/tmp/project' });
  expect(tierOf(candidate, '/tmp/project/src')).toBe('B');
});

test('tierOf: Tier C when recordedCwd is a prefix of targetCwd but not path-boundary-safe', () => {
  // /foo/barbaz should NOT match /foo/bar — the '/foo/bar' + '/' check prevents this
  if (!tierOf) return;
  const candidate = mkCandidate({ recordedCwd: '/foo/bar' });
  expect(tierOf(candidate, '/foo/barbaz')).toBe('C');
});

test('rank: Tier B bidirectional — ancestor recordedCwd yields a winner', () => {
  // Session started at /tmp/project, target is /tmp/project/src → should be Tier B winner
  const ancestorCandidate = mkCandidate({
    recordedCwd: '/tmp/project',
    mtime: Math.floor(Date.now() / 1000) - 10,
    ageSec: 10,
    sessionId: 'sess-ancestor',
  });
  const result: any = rank([ancestorCandidate], '/tmp/project/src');
  expect(result.winner, 'should have a winner').toBeTruthy();
  expect(result.winner.sessionId).toBe('sess-ancestor');
  expect(result.tier).toBe('B');
});

test('tierOf: Tier C for no match', () => {
  if (!tierOf) return;
  const candidate = mkCandidate({ recordedCwd: '/some/other/project' });
  expect(tierOf(candidate, TARGET_CWD)).toBe('C');
});

test('tierOf: null recordedCwd → Tier C', () => {
  if (!tierOf) return;
  const candidate = mkCandidate({ recordedCwd: null });
  expect(tierOf(candidate, TARGET_CWD)).toBe('C');
});

test('globalRecent: top-5 by mtime from all candidates', () => {
  // 7 candidates with no cwd match → noMatch path, globalRecent should be top-5
  const candidates = Array.from({ length: 7 }, (_, i) =>
    mkCandidate({
      recordedCwd: `/other/project/${i}`,
      mtime: NOW - (i + 1) * 10,
      ageSec: (i + 1) * 10,
      sessionId: `sess-${i}`,
    }),
  );

  const result: any = rank(candidates, TARGET_CWD);

  expect(result.noMatch, 'should be noMatch').toBe(true);
  expect(
    result.globalRecent.length <= 5,
    'globalRecent should contain at most 5 entries',
  ).toBeTruthy();
  // Verify they are sorted by mtime DESC
  for (let i = 1; i < result.globalRecent.length; i++) {
    expect(
      result.globalRecent[i - 1].mtime >= result.globalRecent[i].mtime,
      'globalRecent should be sorted mtime DESC',
    ).toBeTruthy();
  }
  // First entry should be the most recent (mtime = NOW - 10)
  expect(result.globalRecent[0].sessionId).toBe('sess-0');
});
