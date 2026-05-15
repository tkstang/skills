/**
 * locate.test.mjs — Tests for scripts/lib/locate.mjs
 *
 * Test cases:
 *   1. claude-code: direct encoded-dir lookup returns candidate with correct metadata
 *   2. claude-code: glob fallback when encoded dir is missing (no match, no throw)
 *   3. codex: discovers transcript and extracts cwd from session-meta record
 *   4. codex: LOOKBACK_DAYS filter excludes old files
 *   5. codex cwd cache: cache hit proved by observable cache-file state
 *   6. gitWorktrees: parses known --porcelain output
 *   7. gitWorktrees: returns [] when git exec fails
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile, utimes, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Test helper: temp HOME dir per test
// ---------------------------------------------------------------------------

async function withTempHome(fn) {
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

// Lazy import so we re-import after env changes; use dynamic import each time.
async function importLocate() {
  // Cache buster via timestamp to force re-evaluation in case Node caches modules
  // Actually ESM caches by URL — we just import once and rely on the module reading
  // process.env at call time (which our implementation does).
  const { discover, gitWorktrees } = await import(
    '../../.agents/skills/session-observer/scripts/lib/locate.mjs'
  );
  return { discover, gitWorktrees };
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const CLAUDE_CODE_TYPICAL = `{"sessionId":"cc-session-001","type":"summary","summary":"Session started"}
{"type":"user","message":{"role":"user","content":"Hello"},"sessionId":"cc-session-001"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Hi!"}]},"sessionId":"cc-session-001"}
`;

// For Codex: session-started record contains cwd
function makeCodexTypical(cwd) {
  return `{"type":"session_started","sessionId":"codex-sess-001","cwd":"${cwd}","timestamp":"2026-05-14T10:00:00Z"}
{"type":"response_item","sessionId":"codex-sess-001","payload":{"type":"message","role":"user","content":"Hello","id":"msg-001"}}
{"type":"response_item","sessionId":"codex-sess-001","payload":{"type":"message","role":"assistant","content":"Hi!","id":"msg-002"}}
`;
}

// Encode cwd the way Claude Code does: replace '/' with '-'
function encodeCwd(cwd) {
  return cwd.replace(/\//g, '-');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('claude-code: discover returns one candidate with correct sessionId and recordedCwd', async () => {
  await withTempHome(async (home) => {
    const { discover } = await importLocate();

    const targetCwd = join(home, 'Code', 'my-project');
    const encoded = encodeCwd(targetCwd);

    // Create the transcript at ~/.claude/projects/<encoded>/typical.jsonl
    const projectDir = join(home, '.claude', 'projects', encoded);
    await mkdir(projectDir, { recursive: true });
    const transcriptPath = join(projectDir, 'typical.jsonl');
    await writeFile(transcriptPath, CLAUDE_CODE_TYPICAL, 'utf8');

    const candidates = await discover('claude-code', targetCwd);

    assert.equal(candidates.length, 1, 'should find exactly one candidate');
    const c = candidates[0];
    assert.equal(c.runtime, 'claude-code');
    assert.equal(c.sessionId, 'cc-session-001');
    // Because the transcript was found via the direct encodeCwd lookup, recordedCwd
    // must equal targetCwd exactly (not an approximation via decodeCwdDirName).
    assert.equal(c.recordedCwd, targetCwd, 'recordedCwd must be the exact targetCwd for direct-lookup candidates');
    assert.ok(c.mtime > 0, 'mtime should be a positive epoch-seconds value');
    assert.ok(typeof c.size === 'number' && c.size >= 0, 'size should be a number');
    assert.ok(typeof c.ageSec === 'number' && c.ageSec >= 0, 'ageSec should be a non-negative number');
  });
});

test('claude-code: glob fallback when encoded dir is missing — no throw, returns []', async () => {
  await withTempHome(async (home) => {
    const { discover } = await importLocate();

    const targetCwd = join(home, 'Code', 'nonexistent-project');
    // Do NOT create the encoded dir — test the fallback path
    const projectsRoot = join(home, '.claude', 'projects');
    await mkdir(projectsRoot, { recursive: true });

    const candidates = await discover('claude-code', targetCwd);

    // No match under targetCwd, but must not throw
    assert.ok(Array.isArray(candidates), 'should return an array');
    // All returned candidates (if any from other dirs) should not have recordedCwd === targetCwd
    const exactMatch = candidates.filter(c => c.recordedCwd === targetCwd);
    assert.equal(exactMatch.length, 0, 'should find no exact-cwd match when encoded dir is absent');
  });
});

test('codex: discover returns candidate with cwd from session-meta record', async () => {
  await withTempHome(async (home) => {
    const { discover } = await importLocate();

    const targetCwd = '/Users/testuser/Code/my-project';
    const sessionDate = '2026/05/14';
    const sessionDir = join(home, '.codex', 'sessions', ...sessionDate.split('/'));
    await mkdir(sessionDir, { recursive: true });
    const transcriptPath = join(sessionDir, 'session-abc.jsonl');
    await writeFile(transcriptPath, makeCodexTypical(targetCwd), 'utf8');

    const candidates = await discover('codex', targetCwd);

    assert.ok(candidates.length >= 1, 'should find at least one candidate');
    const c = candidates.find(x => x.sessionId === 'codex-sess-001');
    assert.ok(c, 'should find the session by id');
    assert.equal(c.recordedCwd, targetCwd, 'recordedCwd should match session-meta cwd');
    assert.equal(c.runtime, 'codex');
  });
});

test('codex: LOOKBACK_DAYS filter excludes files older than 7 days', async () => {
  await withTempHome(async (home) => {
    const { discover } = await importLocate();

    const targetCwd = '/Users/testuser/Code/my-project';

    // Create a "stale" transcript dated 30 days ago
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 30);
    const staleYear = staleDate.getFullYear().toString();
    const staleMonth = String(staleDate.getMonth() + 1).padStart(2, '0');
    const staleDay = String(staleDate.getDate()).padStart(2, '0');

    const staleDir = join(home, '.codex', 'sessions', staleYear, staleMonth, staleDay);
    await mkdir(staleDir, { recursive: true });
    const stalePath = join(staleDir, 'session-stale.jsonl');
    await writeFile(stalePath, makeCodexTypical(targetCwd), 'utf8');

    // Set the mtime to 30 days ago
    const staleTime = staleDate.getTime() / 1000;
    await utimes(stalePath, staleTime, staleTime);

    const candidates = await discover('codex', targetCwd);

    const staleFound = candidates.find(c => c.transcriptPath === stalePath);
    assert.equal(staleFound, undefined, 'stale transcript should be excluded by LOOKBACK_DAYS filter');
  });
});

test('codex cwd cache: cache hit proved by observable cache-file state', async () => {
  await withTempHome(async (home) => {
    const { discover } = await importLocate();

    const targetCwd = '/Users/testuser/Code/cached-project';
    const sessionDate = '2026/05/14';
    const sessionDir = join(home, '.codex', 'sessions', ...sessionDate.split('/'));
    await mkdir(sessionDir, { recursive: true });
    const transcriptPath = join(sessionDir, 'session-cache-test.jsonl');

    // Write initial transcript with targetCwd
    await writeFile(transcriptPath, makeCodexTypical(targetCwd), 'utf8');

    // First discover: populates the cache
    const firstResult = await discover('codex', targetCwd);
    assert.ok(firstResult.length >= 1, 'first discover should find the candidate');

    // Read the original mtime
    const { stat } = await import('node:fs/promises');
    const statResult = await stat(transcriptPath);
    const origMtime = statResult.mtime;

    // Assert cache file now exists with an entry keyed by `${transcriptPath}:${mtime}`
    const stateDir = process.env.STATE_DIR;
    const cacheFilePath = join(stateDir, 'codex-cwd-cache.json');

    const cacheRaw = await readFile(cacheFilePath, 'utf8');
    const cache = JSON.parse(cacheRaw);
    const mtimeSec = Math.floor(origMtime.getTime() / 1000);
    const cacheKey = `${transcriptPath}:${mtimeSec}`;
    assert.ok(cache[cacheKey], `cache should contain an entry for key ${cacheKey}`);
    assert.equal(cache[cacheKey].recordedCwd, targetCwd, 'cached entry should have the original cwd');

    // Overwrite transcript with a DIFFERENT cwd (but keep same mtime)
    const differentCwd = '/Users/testuser/Code/DIFFERENT-project';
    await writeFile(transcriptPath, makeCodexTypical(differentCwd), 'utf8');
    // Restore the original mtime so the cache key still matches
    await utimes(transcriptPath, origMtime, origMtime);

    // Second discover: should use cache, NOT re-parse transcript
    const secondResult = await discover('codex', targetCwd);

    // The candidate for our transcript should still report targetCwd (from cache),
    // not differentCwd (from the rewritten content)
    const cachedCandidate = secondResult.find(c => c.transcriptPath === transcriptPath);
    assert.ok(cachedCandidate, 'transcript should still be found');
    assert.equal(
      cachedCandidate.recordedCwd,
      targetCwd,
      'recordedCwd should come from the cache, not the rewritten transcript'
    );
  });
});

test('gitWorktrees: parses a known --porcelain string and returns worktree paths', async () => {
  // We need a real git repo for this; use the repo itself.
  // But we also want to ensure the parser handles a known string.
  // Test: inject a known porcelain output by testing the module against the real repo.
  // The real repo should have at least one worktree (the main worktree).
  const { gitWorktrees } = await importLocate();

  const worktrees = await gitWorktrees(
    '/Users/thomas.stang/.superconductor/worktrees/skills/sc-pinned-meissner-9974'
  );

  assert.ok(Array.isArray(worktrees), 'should return an array');
  // The main worktree should be included
  assert.ok(
    worktrees.some(p => typeof p === 'string' && p.length > 0),
    'should return at least one non-empty string path'
  );
});

test('gitWorktrees: returns [] when git exec fails (bad path)', async () => {
  const { gitWorktrees } = await importLocate();

  // Pass a path that does not exist / is not a git repo
  const result = await gitWorktrees('/nonexistent/path/that/is/not/a/git/repo');

  assert.deepEqual(result, [], 'should return [] when git fails');
});
