/**
 * locate.test.ts — Tests for src/transcript/session-observer/lib/locate.ts
 *
 * Test cases:
 *   1. claude-code: direct encoded-dir lookup returns candidate with correct metadata
 *   2. claude-code: glob fallback when encoded dir is missing (no match, no throw)
 *   3. codex: discovers transcript and extracts cwd from session-meta record
 *   4. codex: LOOKBACK_DAYS filter excludes old files
 *   5. codex cwd cache: cache hit proved by observable cache-file state
 *   6. cursor: empty direct transcript dirs do not suppress fallback scans
 *   7. gitWorktrees: parses real repo --porcelain output
 *   8. gitWorktrees: returns [] when git exec fails
 */

import {
  mkdtemp,
  rm,
  mkdir,
  writeFile,
  utimes,
  readFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from 'vitest';

// ---------------------------------------------------------------------------
// Test helper: temp HOME dir per test
// ---------------------------------------------------------------------------

async function withTempHome(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'locate-test-'));
  const prevHome = process.env.HOME;
  const prevStateDir = process.env.STATE_DIR;
  process.env.HOME = dir;
  process.env.STATE_DIR = join(dir, '.local', 'state', 'session-observer');
  try {
    await fn(dir);
  } finally {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevStateDir === undefined) delete process.env.STATE_DIR;
    else process.env.STATE_DIR = prevStateDir;
    await rm(dir, { recursive: true, force: true });
  }
}

import {
  discover,
  findSessionCandidate,
  gitWorktrees,
} from '../../src/transcript/session-observer/lib/locate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, 'fixtures');
const automaticWakeFixtures = [
  ['claude-code', join(FIXTURES, 'claude-code', 'automatic-wake.jsonl')],
  ['codex', join(FIXTURES, 'codex', 'automatic-wake.jsonl')],
  ['cursor', join(FIXTURES, 'cursor', 'automatic-wake.jsonl')],
] as const;

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const CLAUDE_CODE_TYPICAL = `{"sessionId":"cc-session-001","type":"summary","summary":"Session started"}
{"type":"user","message":{"role":"user","content":"Hello"},"sessionId":"cc-session-001"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Hi!"}]},"sessionId":"cc-session-001"}
`;

// For Codex: session-started record contains cwd
function makeCodexTypical(cwd: string): string {
  return `{"type":"session_started","sessionId":"codex-sess-001","cwd":"${cwd}","timestamp":"2026-05-14T10:00:00Z"}
{"type":"response_item","sessionId":"codex-sess-001","payload":{"type":"message","role":"user","content":"Hello","id":"msg-001"}}
{"type":"response_item","sessionId":"codex-sess-001","payload":{"type":"message","role":"assistant","content":"Hi!","id":"msg-002"}}
`;
}

const CURSOR_TYPICAL = `{"role":"user","message":{"content":"Hello"}}
{"role":"assistant","message":{"content":[{"type":"text","text":"Hi!"}]}}
`;

// Encode cwd the way Claude Code currently does: replace '/' and '.' with '-'
function encodeCwd(cwd: string): string {
  return cwd.replace(/[/.]/g, '-');
}

// Encode cwd the way Cursor project dirs do: slash/dot path segments joined by '-'
function encodeCursorCwd(cwd: string): string {
  return cwd.split(/[/.]/u).filter(Boolean).join('-');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.each(automaticWakeFixtures)(
  'automatic %s wakes are not treated as engaged candidates',
  async (runtime, fixturePath) => {
    await withTempHome(async (home) => {
      const fixture = await readFile(fixturePath, 'utf8');
      const targetCwd = join(home, 'Code', 'automatic-wake-project');
      let transcriptPath: string;

      if (runtime === 'claude-code') {
        transcriptPath = join(
          home,
          '.claude',
          'projects',
          encodeCwd(targetCwd),
          'automatic-wake.jsonl',
        );
      } else if (runtime === 'codex') {
        const now = new Date();
        transcriptPath = join(
          home,
          '.codex',
          'sessions',
          String(now.getFullYear()),
          String(now.getMonth() + 1).padStart(2, '0'),
          String(now.getDate()).padStart(2, '0'),
          'automatic-wake.jsonl',
        );
      } else {
        transcriptPath = join(
          home,
          '.cursor',
          'projects',
          encodeCursorCwd(targetCwd),
          'agent-transcripts',
          'automatic-wake',
          'transcript.jsonl',
        );
      }

      await mkdir(dirname(transcriptPath), { recursive: true });
      await writeFile(transcriptPath, fixture, 'utf8');

      const candidates = await discover(runtime, targetCwd);
      const candidate = candidates.find(
        (entry: any) => entry.transcriptPath === transcriptPath,
      );

      expect(candidate).toMatchObject({
        engagementStatus: 'unengaged',
        engaged: false,
        genuineUserMessages: 0,
        hasAssistantAndUser: false,
        engagement: expect.objectContaining({
          status: 'unengaged',
          genuineUserMessages: 0,
          syntheticUserMessages: 1,
        }),
      });
    });
  },
);

test('claude-code: discover returns one candidate with correct sessionId and recordedCwd', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(home, 'Code', 'my-project');
    const encoded = encodeCwd(targetCwd);

    // Create the transcript at ~/.claude/projects/<encoded>/typical.jsonl
    const projectDir = join(home, '.claude', 'projects', encoded);
    await mkdir(projectDir, { recursive: true });
    const transcriptPath = join(projectDir, 'typical.jsonl');
    await writeFile(transcriptPath, CLAUDE_CODE_TYPICAL, 'utf8');

    const candidates = await discover('claude-code', targetCwd);

    expect(candidates.length, 'should find exactly one candidate').toBe(1);
    const c = candidates[0];
    expect(c.runtime).toBe('claude-code');
    expect(c.sessionId).toBe('cc-session-001');
    // Because the transcript was found via the direct encodeCwd lookup, recordedCwd
    // must equal targetCwd exactly (not an approximation via decodeCwdDirName).
    expect(
      c.recordedCwd,
      'recordedCwd must be the exact targetCwd for direct-lookup candidates',
    ).toBe(targetCwd);
    expect(
      c.mtime > 0,
      'mtime should be a positive epoch-seconds value',
    ).toBeTruthy();
    expect(
      typeof c.size === 'number' && c.size >= 0,
      'size should be a number',
    ).toBeTruthy();
    expect(
      typeof c.ageSec === 'number' && c.ageSec >= 0,
      'ageSec should be a non-negative number',
    ).toBeTruthy();
  });
});

test('findSessionCandidate returns only an exact same-cwd session match', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(home, 'Code', 'identity-project');
    const projectDir = join(home, '.claude', 'projects', encodeCwd(targetCwd));
    await mkdir(projectDir, { recursive: true });
    await writeFile(join(projectDir, 'one.jsonl'), CLAUDE_CODE_TYPICAL, 'utf8');
    expect(await findSessionCandidate('claude-code', targetCwd, 'cc-session-001')).toMatchObject({
      runtime: 'claude-code', sessionId: 'cc-session-001', recordedCwd: targetCwd,
    });
    expect(await findSessionCandidate('claude-code', targetCwd, 'missing')).toBeNull();
  });
});

test('claude-code: glob fallback when encoded dir is missing — no throw, returns []', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(home, 'Code', 'nonexistent-project');
    // Do NOT create the encoded dir — test the fallback path
    const projectsRoot = join(home, '.claude', 'projects');
    await mkdir(projectsRoot, { recursive: true });

    const candidates = await discover('claude-code', targetCwd);

    // No match under targetCwd, but must not throw
    expect(Array.isArray(candidates), 'should return an array').toBeTruthy();
    // All returned candidates (if any from other dirs) should not have recordedCwd === targetCwd
    const exactMatch = candidates.filter((c) => c.recordedCwd === targetCwd);
    expect(
      exactMatch.length,
      'should find no exact-cwd match when encoded dir is absent',
    ).toBe(0);
  });
});

test('claude-code: direct lookup uses dot-sanitized project dir slug', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(
      home,
      'thomas.stang',
      '.superconductor',
      'worktrees',
      'stoa',
      'sc-levitated-phonon-e8a5',
    );
    const encoded = encodeCwd(targetCwd);

    const projectDir = join(home, '.claude', 'projects', encoded);
    await mkdir(projectDir, { recursive: true });
    const transcriptPath = join(projectDir, 'typical.jsonl');
    await writeFile(transcriptPath, CLAUDE_CODE_TYPICAL, 'utf8');

    const candidates = await discover('claude-code', targetCwd);
    const c: any = candidates.find(
      (candidate: any) => candidate.transcriptPath === transcriptPath,
    );

    expect(
      c,
      'should find the transcript via dot-sanitized direct lookup',
    ).toBeTruthy();
    expect(c.recordedCwd).toBe(targetCwd);
    expect(c.cwdSlug).toBe(encoded);
    expect(c.cwdEvidence).toBe('direct-parent-dir');
  });
});

test('claude-code: fallback candidates preserve parent cwdSlug as weak evidence', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(home, 'Code', 'missing-project');
    const otherSlug =
      '-Users-thomas-stang--superconductor-worktrees-stoa-sc-levitated-phonon-e8a5';
    const projectDir = join(home, '.claude', 'projects', otherSlug);
    await mkdir(projectDir, { recursive: true });
    const transcriptPath = join(projectDir, 'typical.jsonl');
    await writeFile(transcriptPath, CLAUDE_CODE_TYPICAL, 'utf8');

    const candidates = await discover('claude-code', targetCwd);
    const c: any = candidates.find(
      (candidate: any) => candidate.transcriptPath === transcriptPath,
    );

    expect(
      c,
      'fallback scan should include non-direct project dirs',
    ).toBeTruthy();
    expect(c.cwdSlug).toBe(otherSlug);
    expect(c.cwdEvidence).toBe('decoded-parent-dir');
    expect(c.recordedCwd).not.toBe(targetCwd);
  });
});

test('codex: discover returns candidate with cwd from session-meta record', async () => {
  await withTempHome(async (home) => {
    const targetCwd = '/Users/testuser/Code/my-project';
    const sessionDate = '2026/05/14';
    const sessionDir = join(
      home,
      '.codex',
      'sessions',
      ...sessionDate.split('/'),
    );
    await mkdir(sessionDir, { recursive: true });
    const transcriptPath = join(sessionDir, 'session-abc.jsonl');
    await writeFile(transcriptPath, makeCodexTypical(targetCwd), 'utf8');

    const candidates = await discover('codex', targetCwd);

    expect(
      candidates.length >= 1,
      'should find at least one candidate',
    ).toBeTruthy();
    const c: any = candidates.find(
      (x: any) => x.sessionId === 'codex-sess-001',
    );
    expect(c, 'should find the session by id').toBeTruthy();
    expect(c.recordedCwd, 'recordedCwd should match session-meta cwd').toBe(
      targetCwd,
    );
    expect(c.runtime).toBe('codex');
  });
});

test('codex: LOOKBACK_DAYS filter excludes files older than 7 days', async () => {
  await withTempHome(async (home) => {
    const targetCwd = '/Users/testuser/Code/my-project';

    // Create a "stale" transcript dated 30 days ago
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 30);
    const staleYear = staleDate.getFullYear().toString();
    const staleMonth = String(staleDate.getMonth() + 1).padStart(2, '0');
    const staleDay = String(staleDate.getDate()).padStart(2, '0');

    const staleDir = join(
      home,
      '.codex',
      'sessions',
      staleYear,
      staleMonth,
      staleDay,
    );
    await mkdir(staleDir, { recursive: true });
    const stalePath = join(staleDir, 'session-stale.jsonl');
    await writeFile(stalePath, makeCodexTypical(targetCwd), 'utf8');

    // Set the mtime to 30 days ago
    const staleTime = staleDate.getTime() / 1000;
    await utimes(stalePath, staleTime, staleTime);

    const candidates = await discover('codex', targetCwd);

    const staleFound = candidates.find(
      (c: any) => c.transcriptPath === stalePath,
    );
    expect(
      staleFound,
      'stale transcript should be excluded by LOOKBACK_DAYS filter',
    ).toBe(undefined);
  });
});

test('codex cwd cache: cache hit proved by observable cache-file state', async () => {
  await withTempHome(async (home) => {
    const targetCwd = '/Users/testuser/Code/cached-project';
    const sessionDate = '2026/05/14';
    const sessionDir = join(
      home,
      '.codex',
      'sessions',
      ...sessionDate.split('/'),
    );
    await mkdir(sessionDir, { recursive: true });
    const transcriptPath = join(sessionDir, 'session-cache-test.jsonl');

    // Write initial transcript with targetCwd
    await writeFile(transcriptPath, makeCodexTypical(targetCwd), 'utf8');

    // First discover: populates the cache
    const firstResult = await discover('codex', targetCwd);
    expect(
      firstResult.length >= 1,
      'first discover should find the candidate',
    ).toBeTruthy();

    // Read the original mtime
    const { stat } = await import('node:fs/promises');
    const statResult = await stat(transcriptPath);
    const origMtime = statResult.mtime;

    // Assert cache file now exists with an entry keyed by `${transcriptPath}:${mtime}`
    const stateDir = process.env.STATE_DIR!;
    const cacheFilePath = join(stateDir, 'codex-cwd-cache.json');

    const cacheRaw = await readFile(cacheFilePath, 'utf8');
    const cache = JSON.parse(cacheRaw);
    const mtimeSec = Math.floor(origMtime.getTime() / 1000);
    const cacheKey = `${transcriptPath}:${mtimeSec}`;
    expect(
      cache[cacheKey],
      `cache should contain an entry for key ${cacheKey}`,
    ).toBeTruthy();
    expect(
      cache[cacheKey].recordedCwd,
      'cached entry should have the original cwd',
    ).toBe(targetCwd);

    // Overwrite transcript with a DIFFERENT cwd (but keep same mtime)
    const differentCwd = '/Users/testuser/Code/DIFFERENT-project';
    await writeFile(transcriptPath, makeCodexTypical(differentCwd), 'utf8');
    // Restore the original mtime so the cache key still matches
    await utimes(transcriptPath, origMtime, origMtime);

    // Second discover: should use cache, NOT re-parse transcript
    const secondResult = await discover('codex', targetCwd);

    // The candidate for our transcript should still report targetCwd (from cache),
    // not differentCwd (from the rewritten content)
    const cachedCandidate: any = secondResult.find(
      (c: any) => c.transcriptPath === transcriptPath,
    );
    expect(cachedCandidate, 'transcript should still be found').toBeTruthy();
    expect(
      cachedCandidate.recordedCwd,
      'recordedCwd should come from the cache, not the rewritten transcript',
    ).toBe(targetCwd);
  });
});

test('cursor: direct lookup discovers agent transcript with exact cwd evidence', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(home, 'Code', 'my.cursor-project');
    const encoded = encodeCursorCwd(targetCwd);
    const transcriptDir = join(
      home,
      '.cursor',
      'projects',
      encoded,
      'agent-transcripts',
      'session-123',
    );
    await mkdir(transcriptDir, { recursive: true });
    const transcriptPath = join(transcriptDir, 'transcript.jsonl');
    await writeFile(transcriptPath, CURSOR_TYPICAL, 'utf8');

    const candidates = await discover('cursor', targetCwd);
    const c: any = candidates.find(
      (candidate: any) => candidate.transcriptPath === transcriptPath,
    );

    expect(c, 'should find the direct Cursor transcript').toBeTruthy();
    expect(c.runtime).toBe('cursor');
    expect(c.sessionId).toBe('session-123');
    expect(c.recordedCwd).toBe(targetCwd);
    expect(c.cwdSlug).toBe(encoded);
    expect(c.cwdEvidence).toBe('direct-parent-dir');
  });
});

test('cursor: fallback scan preserves project cwdSlug evidence', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(home, 'Code', 'missing-project');
    const fallbackSlug = 'Users-test-Code-real-project';
    const transcriptDir = join(
      home,
      '.cursor',
      'projects',
      fallbackSlug,
      'agent-transcripts',
      'session-abc',
    );
    await mkdir(transcriptDir, { recursive: true });
    const transcriptPath = join(transcriptDir, 'conversation.jsonl');
    await writeFile(transcriptPath, CURSOR_TYPICAL, 'utf8');

    const candidates = await discover('cursor', targetCwd);
    const c: any = candidates.find(
      (candidate: any) => candidate.transcriptPath === transcriptPath,
    );

    expect(c, 'fallback scan should include Cursor project dirs').toBeTruthy();
    expect(c.runtime).toBe('cursor');
    expect(c.sessionId).toBe('session-abc');
    expect(c.recordedCwd).toBe(null);
    expect(c.cwdSlug).toBe(fallbackSlug);
    expect(c.cwdEvidence).toBe('project-dir-slug');
  });
});

test('cursor: empty direct transcript dir still allows fallback scan', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(home, 'Code', 'my.cursor-project');
    const encoded = encodeCursorCwd(targetCwd);
    const directRoot = join(
      home,
      '.cursor',
      'projects',
      encoded,
      'agent-transcripts',
    );
    await mkdir(directRoot, { recursive: true });

    const fallbackSlug = 'Users-test-Code-other-cursor-project';
    const transcriptDir = join(
      home,
      '.cursor',
      'projects',
      fallbackSlug,
      'agent-transcripts',
      'session-fallback',
    );
    await mkdir(transcriptDir, { recursive: true });
    const transcriptPath = join(transcriptDir, 'conversation.jsonl');
    await writeFile(transcriptPath, CURSOR_TYPICAL, 'utf8');

    const candidates = await discover('cursor', targetCwd);
    const c: any = candidates.find(
      (candidate: any) => candidate.transcriptPath === transcriptPath,
    );

    expect(
      c,
      'empty direct Cursor dirs should not suppress fallback candidates',
    ).toBeTruthy();
    expect(c.recordedCwd).toBe(null);
    expect(c.cwdSlug).toBe(fallbackSlug);
    expect(c.cwdEvidence).toBe('project-dir-slug');
  });
});

test('cursor: fallback scan excludes transcripts older than 7 days', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(home, 'Code', 'missing-project');
    const fallbackSlug = 'Users-test-Code-real-project';
    const transcriptDir = join(
      home,
      '.cursor',
      'projects',
      fallbackSlug,
      'agent-transcripts',
      'session-old',
    );
    await mkdir(transcriptDir, { recursive: true });
    const transcriptPath = join(transcriptDir, 'conversation.jsonl');
    await writeFile(transcriptPath, CURSOR_TYPICAL, 'utf8');

    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 30);
    const staleTime = staleDate.getTime() / 1000;
    await utimes(transcriptPath, staleTime, staleTime);

    const candidates = await discover('cursor', targetCwd);
    const staleFound = candidates.find(
      (candidate: any) => candidate.transcriptPath === transcriptPath,
    );

    expect(
      staleFound,
      'stale Cursor fallback transcript should be excluded',
    ).toBe(undefined);
  });
});

test('gitWorktrees: parses real repo --porcelain output and returns worktree paths', async () => {
  // We need a real git repo for this; use the repo itself.
  // The real repo should have at least one worktree (the current checkout).
  const worktrees = await gitWorktrees(process.cwd());

  expect(Array.isArray(worktrees), 'should return an array').toBeTruthy();
  // The main worktree should be included
  expect(
    worktrees.some((p) => typeof p === 'string' && p.length > 0),
    'should return at least one non-empty string path',
  ).toBeTruthy();
});

test('gitWorktrees: returns [] when git exec fails (bad path)', async () => {
  // Pass a path that does not exist / is not a git repo
  const result = await gitWorktrees('/nonexistent/path/that/is/not/a/git/repo');

  expect(result, 'should return [] when git fails').toEqual([]);
});
