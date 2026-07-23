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
 *   9. classification cache: an unchanged transcript is read+parsed once
 *      across two discover() passes sharing a cache instance (proved by an
 *      fs-read call-count seam below the runtimes.js module boundary, so it
 *      also covers meta extraction, not just classification)
 *  10. classification cache: appending to a transcript (mtime/size change)
 *      invalidates the cache and re-classifies
 *  11. ClassificationCache: signature mismatch (mtime or size) never returns
 *      a stale result
 *  12. ClassificationCache: evicts the least-recently-used entry once its
 *      bound is exceeded
 *  13. ClassificationCache: a small cap thrashes under a full-directory scan
 *      exceeding it (pins the inherent limit any bounded cache has)
 *  14. ClassificationCache: the default capacity survives a realistic
 *      long-lived project directory scan (regression for the 300→5000 fix)
 */

import {
  mkdtemp,
  rm,
  mkdir,
  writeFile,
  utimes,
  readFile,
  readdir,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Deterministic cache-write-failure harness: a one-shot `rename`
// interceptor, used by the cwd-cache atomicity regression test below to
// force saveCwdCache's publish step to fail (mirrors state.test.ts's
// identical harness for state.ts/watch-state.ts's lock-race tests).
//
// vi.hoisted is required because vi.mock factories are hoisted above normal
// module-scope declarations; without it, the mutable interceptor state
// referenced inside the factory would be in the temporal dead zone.
// ---------------------------------------------------------------------------
type RenameInterceptor = (
  src: string,
  dest: string,
  real: (src: string, dest: string) => Promise<void>,
) => Promise<void>;

const cacheRaceHarness = vi.hoisted(() => {
  let renameInterceptor: RenameInterceptor | null = null;
  return {
    setRenameInterceptor: (fn: RenameInterceptor | null) => {
      renameInterceptor = fn;
    },
    takeRenameInterceptor: (): RenameInterceptor | null => {
      const fn = renameInterceptor;
      renameInterceptor = null; // one-shot
      return fn;
    },
  };
});

// ---------------------------------------------------------------------------
// Classification call-count seam: counts real transcript reads at the
// node:fs/promises readFile boundary — the physical read that BOTH
// candidateDerivedFields()'s direct readRecords() call and any (re)introduced
// extractMeta() call inside core/runtimes.js funnel through. Counting here,
// below the runtimes.js module boundary, is deliberate: a wrapper around the
// exported readRecords cannot observe an intra-module extractMeta() re-read
// (ESM intra-module calls bypass an export mock), so a reintroduced double
// read would have stayed uncounted while these assertions still passed — the
// exact gap this seam exists to catch. An earlier version of this cache only
// wrapped classification while extractMeta() independently re-read every
// candidate; counting the fs read makes that class of regression observable.
// Counts are keyed by path so tests can assert "read exactly once" across
// multiple discover() calls sharing one ClassificationCache instance.
// Non-transcript reads (fixtures, state files) are recorded too but never
// asserted, since assertions key by the specific transcript path.
// ---------------------------------------------------------------------------
const classifyCountHarness = vi.hoisted(() => {
  let counts = new Map<string, number>();
  return {
    reset: () => {
      counts = new Map();
    },
    record: (path: string) => {
      counts.set(path, (counts.get(path) ?? 0) + 1);
    },
    countFor: (path: string) => counts.get(path) ?? 0,
  };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    rename: (async (src: string, dest: string) => {
      const interceptor = cacheRaceHarness.takeRenameInterceptor();
      if (interceptor) return interceptor(src, dest, actual.rename);
      return actual.rename(src, dest);
    }) as typeof actual.rename,
    readFile: (async (...args: unknown[]) => {
      if (typeof args[0] === 'string') classifyCountHarness.record(args[0]);
      return (actual.readFile as (...a: unknown[]) => unknown)(...args);
    }) as typeof actual.readFile,
  };
});

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
  ClassificationCache,
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

// A transcript with hidden bootstrap user records (environment_context) plus a
// genuine exchange. Used to prove the classification cache stores a compact
// projection that drops the uncapped bootstrapRecordIndexes array while keeping
// the scalar bootstrapRecordCount the discovery path actually consumes.
const CLAUDE_CODE_WITH_BOOTSTRAP = `{"sessionId":"cc-bootstrap-001","type":"summary","summary":"Session started"}
{"type":"user","message":{"role":"user","content":"<environment_context> cwd=/x </environment_context>"},"sessionId":"cc-bootstrap-001"}
{"type":"user","message":{"role":"user","content":"<environment_context> platform=darwin </environment_context>"},"sessionId":"cc-bootstrap-001"}
{"type":"user","message":{"role":"user","content":"Real question"},"sessionId":"cc-bootstrap-001"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Real answer"}]},"sessionId":"cc-bootstrap-001"}
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
    expect(
      await findSessionCandidate('claude-code', targetCwd, 'cc-session-001'),
    ).toMatchObject({
      runtime: 'claude-code',
      sessionId: 'cc-session-001',
      recordedCwd: targetCwd,
    });
    expect(
      await findSessionCandidate('claude-code', targetCwd, 'missing'),
    ).toBeNull();
  });
});

test('findSessionCandidate rejects a matching alias from another cwd', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(home, 'Code', 'identity-project');
    const otherCwd = join(home, 'Code', 'other-project');
    const transcriptPath = join(
      home,
      '.codex',
      'sessions',
      '2026',
      '07',
      'identity-other.jsonl',
    );
    await mkdir(dirname(transcriptPath), { recursive: true });
    await writeFile(transcriptPath, makeCodexTypical(otherCwd), 'utf8');

    expect(
      await findSessionCandidate('codex', targetCwd, 'codex-sess-001'),
    ).toBeNull();
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

test('codex cwd cache: saveCwdCache writes atomically — no tmp residue, parseable JSON', async () => {
  await withTempHome(async (home) => {
    const targetCwd = '/Users/testuser/Code/atomic-cache-project';
    const sessionDate = '2026/05/15';
    const sessionDir = join(
      home,
      '.codex',
      'sessions',
      ...sessionDate.split('/'),
    );
    await mkdir(sessionDir, { recursive: true });
    const transcriptPath = join(sessionDir, 'session-atomic-test.jsonl');
    await writeFile(transcriptPath, makeCodexTypical(targetCwd), 'utf8');

    // Cache miss on first discover — exercises the saveCwdCache write path.
    await discover('codex', targetCwd);

    const stateDir = process.env.STATE_DIR!;
    const entries = await readdir(stateDir);
    const tmpFiles = entries.filter(
      (f) => f.includes('codex-cwd-cache') && f.endsWith('.tmp'),
    );
    expect(
      tmpFiles,
      'no codex-cwd-cache tmp files should remain after a successful save',
    ).toEqual([]);

    const cacheFilePath = join(stateDir, 'codex-cwd-cache.json');
    const raw = await readFile(cacheFilePath, 'utf8');
    expect(() => JSON.parse(raw)).not.toThrow();
    const parsed = JSON.parse(raw);
    expect(Object.keys(parsed).length).toBeGreaterThan(0);
  });
});

test('codex cwd cache: concurrent discover calls both save without leaving tmp residue or corrupt JSON', async () => {
  await withTempHome(async (home) => {
    const cwdA = '/Users/testuser/Code/concurrent-project-a';
    const cwdB = '/Users/testuser/Code/concurrent-project-b';
    const sessionDir = join(home, '.codex', 'sessions', '2026', '05', '16');
    await mkdir(sessionDir, { recursive: true });
    const transcriptA = join(sessionDir, 'session-concurrent-a.jsonl');
    const transcriptB = join(sessionDir, 'session-concurrent-b.jsonl');
    await writeFile(transcriptA, makeCodexTypical(cwdA), 'utf8');
    await writeFile(transcriptB, makeCodexTypical(cwdB), 'utf8');

    // Both are cache misses — two discover() calls racing to save the cache
    // concurrently in the same process (regression for the tmp-name
    // collision risk when two saves land in the same pid+millisecond).
    await Promise.all([discover('codex', cwdA), discover('codex', cwdB)]);

    const stateDir = process.env.STATE_DIR!;
    const entries = await readdir(stateDir);
    const tmpFiles = entries.filter(
      (f) => f.includes('codex-cwd-cache') && f.endsWith('.tmp'),
    );
    expect(
      tmpFiles,
      'no codex-cwd-cache tmp files should remain after concurrent saves',
    ).toEqual([]);

    const cacheFilePath = join(stateDir, 'codex-cwd-cache.json');
    const raw = await readFile(cacheFilePath, 'utf8');
    expect(() => JSON.parse(raw)).not.toThrow();
    const parsed = JSON.parse(raw);
    expect(Object.keys(parsed).length).toBeGreaterThan(0);
  });
});

// The two tests above only assert no-tmp-residue + valid nonempty JSON —
// conditions a direct (non-atomic) `writeFile(path, content)` implementation
// would *also* satisfy, since it never creates a tmp file at all and always
// leaves well-formed JSON behind on success. Neither test discriminates
// "temp file + rename" from "write straight to the destination". This test
// does, by forcing the *publish* step (the rename) to fail and checking a
// property only an atomic implementation can guarantee: an interrupted
// write never mutates the pre-existing destination at all.
test('codex cwd cache: a failed rename leaves the pre-existing cache byte-identical, no tmp residue, and stays best-effort non-fatal', async () => {
  await withTempHome(async (home) => {
    const sessionDir = join(home, '.codex', 'sessions', '2026', '05', '17');
    await mkdir(sessionDir, { recursive: true });
    const transcriptPath = join(sessionDir, 'session-rename-fail-test.jsonl');
    const targetCwd = '/Users/testuser/Code/rename-fail-project';
    await writeFile(transcriptPath, makeCodexTypical(targetCwd), 'utf8');

    const stateDir = process.env.STATE_DIR!;
    await mkdir(stateDir, { recursive: true });
    const cacheFilePath = join(stateDir, 'codex-cwd-cache.json');
    // Seed a pre-existing, valid cache file with content unrelated to the
    // transcript above ("byte-identical afterward" is only a meaningful
    // assertion if a successful save would have visibly changed it).
    const seeded = JSON.stringify(
      {
        'preexisting-transcript.jsonl:100': {
          recordedCwd: '/seeded/project',
          sessionId: 'seeded-session',
        },
      },
      null,
      2,
    );
    await writeFile(cacheFilePath, seeded, 'utf8');

    // Force the *next* rename whose destination is the cache file to fail —
    // simulating a crash/error between the tmp write and the atomic
    // publish. Matches on the destination path (stable), not the source
    // (which includes a random per-save tmp filename), and fires exactly
    // once for saveCwdCache's rename(tmp, codex-cwd-cache.json) call.
    cacheRaceHarness.setRenameInterceptor(async (src, dest) => {
      expect(dest).toBe(cacheFilePath);
      expect(src).toContain('codex-cwd-cache.');
      expect(src).toContain('.tmp');
      const err = new Error('simulated rename failure') as NodeJS.ErrnoException;
      err.code = 'EIO';
      throw err;
    });

    // This transcript is a cache miss, so it triggers saveCwdCache. The call
    // must not throw to the caller — saveCwdCache's catch{} is best-effort,
    // non-fatal by design.
    let discoverError: unknown = null;
    let result: unknown;
    try {
      result = await discover('codex', targetCwd);
    } catch (err) {
      discoverError = err;
    }
    expect(
      discoverError,
      'discover() must not throw when saveCwdCache fails to publish (best-effort, non-fatal)',
    ).toBe(null);
    expect(Array.isArray(result)).toBe(true);

    // The pre-existing cache file must be untouched. An atomic
    // temp-file+rename implementation only ever mutates the destination via
    // the rename step, so a rename failure leaves whatever was already
    // there completely unchanged — this is the property this test exists to
    // prove. A direct-writeFile implementation has no such protection: it
    // truncates/overwrites the destination as part of the write itself,
    // before any rename is even attempted, so there would be no rename call
    // for this interceptor to intercept, the write would proceed normally,
    // and this assertion would fail (the seeded content would already be
    // gone, replaced by the freshly computed cache).
    const afterRaw = await readFile(cacheFilePath, 'utf8');
    expect(
      afterRaw,
      'a failed rename must leave the pre-existing cache file byte-identical',
    ).toBe(seeded);

    // No tmp residue from the failed attempt: saveCwdCache's finally block
    // unlinks the tmp file it wrote regardless of whether the rename
    // succeeded.
    const entries = await readdir(stateDir);
    const tmpFiles = entries.filter(
      (f) => f.includes('codex-cwd-cache') && f.endsWith('.tmp'),
    );
    expect(
      tmpFiles,
      'no codex-cwd-cache tmp files should remain after a failed rename',
    ).toEqual([]);
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

// ---------------------------------------------------------------------------
// Classification cache
// ---------------------------------------------------------------------------

test('classification cache: unchanged transcript is classified once across two discover() passes', async () => {
  await withTempHome(async (home) => {
    classifyCountHarness.reset();
    const targetCwd = join(home, 'Code', 'cache-hit-project');
    const projectDir = join(home, '.claude', 'projects', encodeCwd(targetCwd));
    await mkdir(projectDir, { recursive: true });
    const transcriptPath = join(projectDir, 'typical.jsonl');
    await writeFile(transcriptPath, CLAUDE_CODE_TYPICAL, 'utf8');

    const cache = new ClassificationCache();

    const first = await discover('claude-code', targetCwd, cache);
    expect(
      classifyCountHarness.countFor(transcriptPath),
      'first discover should classify the transcript once',
    ).toBe(1);
    const firstCandidate: any = first.find(
      (c: any) => c.transcriptPath === transcriptPath,
    );
    expect(firstCandidate).toMatchObject({
      engagementStatus: 'engaged',
      genuineUserMessages: 1,
    });

    const second = await discover('claude-code', targetCwd, cache);
    expect(
      classifyCountHarness.countFor(transcriptPath),
      'second discover with the same cache and an unchanged file must not re-classify',
    ).toBe(1);
    const secondCandidate: any = second.find(
      (c: any) => c.transcriptPath === transcriptPath,
    );
    // Compare only the classification-derived fields byte-for-byte; ageSec
    // is intentionally recomputed against wall-clock `now` on every call
    // (it is not part of the classification cache's signature) and is
    // expected to differ slightly between the two passes.
    expect(
      {
        engagement: secondCandidate.engagement,
        engagementStatus: secondCandidate.engagementStatus,
        engaged: secondCandidate.engaged,
        recordCount: secondCandidate.recordCount,
        genuineUserMessages: secondCandidate.genuineUserMessages,
        assistantMessages: secondCandidate.assistantMessages,
        realMessageCount: secondCandidate.realMessageCount,
        hasAssistantAndUser: secondCandidate.hasAssistantAndUser,
        bootstrapRecordCount: secondCandidate.bootstrapRecordCount,
      },
      'cached classification fields must equal the freshly-parsed result',
    ).toEqual({
      engagement: firstCandidate.engagement,
      engagementStatus: firstCandidate.engagementStatus,
      engaged: firstCandidate.engaged,
      recordCount: firstCandidate.recordCount,
      genuineUserMessages: firstCandidate.genuineUserMessages,
      assistantMessages: firstCandidate.assistantMessages,
      realMessageCount: firstCandidate.realMessageCount,
      hasAssistantAndUser: firstCandidate.hasAssistantAndUser,
      bootstrapRecordCount: firstCandidate.bootstrapRecordCount,
    });
  });
});

test('classification cache: stores a compact projection that drops the uncapped bootstrapRecordIndexes array', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(home, 'Code', 'bootstrap-compact-project');
    const projectDir = join(home, '.claude', 'projects', encodeCwd(targetCwd));
    await mkdir(projectDir, { recursive: true });
    const transcriptPath = join(projectDir, 'with-bootstrap.jsonl');
    await writeFile(transcriptPath, CLAUDE_CODE_WITH_BOOTSTRAP, 'utf8');

    const cache = new ClassificationCache();
    const candidates = await discover('claude-code', targetCwd, cache);
    const candidate: any = candidates.find(
      (c: any) => c.transcriptPath === transcriptPath,
    );
    expect(candidate).toBeDefined();

    // The classifier detected the two environment_context bootstrap records, so
    // the scalar count the discovery path consumes is preserved...
    expect(candidate.bootstrapRecordCount).toBeGreaterThan(0);
    // ...but the uncapped index array is dropped from the cached/derived
    // classification, so a cache entry cannot pin per-transcript-length memory.
    expect(candidate.engagement.bootstrapRecordIndexes).toEqual([]);
    // Engagement is otherwise unchanged: the genuine user turn is still counted.
    expect(candidate.engagementStatus).toBe('engaged');

    // A second pass (cache hit) must return the same compact shape.
    const second = await discover('claude-code', targetCwd, cache);
    const secondCandidate: any = second.find(
      (c: any) => c.transcriptPath === transcriptPath,
    );
    expect(secondCandidate.engagement.bootstrapRecordIndexes).toEqual([]);
    expect(secondCandidate.bootstrapRecordCount).toBe(
      candidate.bootstrapRecordCount,
    );
  });
});

test('classification cache: appending to a transcript invalidates the cache and re-classifies', async () => {
  await withTempHome(async (home) => {
    classifyCountHarness.reset();
    const targetCwd = join(home, 'Code', 'cache-invalidate-project');
    const projectDir = join(home, '.claude', 'projects', encodeCwd(targetCwd));
    await mkdir(projectDir, { recursive: true });
    const transcriptPath = join(projectDir, 'typical.jsonl');
    await writeFile(transcriptPath, CLAUDE_CODE_TYPICAL, 'utf8');

    const cache = new ClassificationCache();

    const first = await discover('claude-code', targetCwd, cache);
    expect(classifyCountHarness.countFor(transcriptPath)).toBe(1);
    const firstCandidate: any = first.find(
      (c: any) => c.transcriptPath === transcriptPath,
    );
    expect(firstCandidate.genuineUserMessages).toBe(1);

    // Append another genuine user message: this changes both size and
    // mtime, which must invalidate the cached entry.
    await writeFile(
      transcriptPath,
      CLAUDE_CODE_TYPICAL +
        `{"type":"user","message":{"role":"user","content":"Second message"},"sessionId":"cc-session-001"}\n`,
      'utf8',
    );

    const second = await discover('claude-code', targetCwd, cache);
    expect(
      classifyCountHarness.countFor(transcriptPath),
      'a changed (mtime, size) signature must trigger re-classification',
    ).toBe(2);
    const secondCandidate: any = second.find(
      (c: any) => c.transcriptPath === transcriptPath,
    );
    expect(
      secondCandidate.genuineUserMessages,
      'the re-classified result must reflect the appended content',
    ).toBe(2);
  });
});

// A cache entry now holds both the classification and the transcript's meta
// (sessionId/recordedCwd), derived from the same parsed-record pass — see
// locate.ts's TranscriptDerivedFields. This helper builds a fixture entry
// for the two unit tests below.
function derivedFields(recordCount: number, sessionId = 'sess') {
  return {
    meta: { sessionId, recordedCwd: null },
    classification: {
      status: 'engaged' as const,
      engaged: true,
      recordCount,
      genuineUserMessages: 1,
      syntheticUserMessages: 0,
      assistantMessages: 1,
      realMessageCount: 2,
      hasAssistantAndUser: true,
      bootstrapRecordIndexes: [],
      bootstrapRecordCount: 0,
    },
  };
}

test('ClassificationCache: a signature mismatch (mtime or size) never returns a stale result', () => {
  const entry = derivedFields(3);

  // Size-mismatch and mtime-mismatch are checked against independent cache
  // instances (each seeded fresh) so a lazy-delete-on-miss in one assertion
  // cannot mask the other guard: each get() below exercises exactly one
  // signature component in isolation.
  const sizeMismatchCache = new ClassificationCache();
  sizeMismatchCache.set('/a/transcript.jsonl', 1_000, 50, entry);
  expect(
    sizeMismatchCache.get('/a/transcript.jsonl', 1_000, 50),
  ).toEqual(entry);
  expect(
    sizeMismatchCache.get('/a/transcript.jsonl', 1_000, 51),
    'a size mismatch must be treated as a cache miss',
  ).toBeUndefined();

  const mtimeMismatchCache = new ClassificationCache();
  mtimeMismatchCache.set('/a/transcript.jsonl', 1_000, 50, entry);
  expect(
    mtimeMismatchCache.get('/a/transcript.jsonl', 1_000, 50),
  ).toEqual(entry);
  expect(
    mtimeMismatchCache.get('/a/transcript.jsonl', 1_001, 50),
    'an mtime mismatch must be treated as a cache miss',
  ).toBeUndefined();
});

test('ClassificationCache: evicts the least-recently-used entry once its bound is exceeded', () => {
  const cache = new ClassificationCache(2);

  cache.set('/a', 1, 10, derivedFields(1));
  cache.set('/b', 1, 10, derivedFields(2));
  expect(cache.size).toBe(2);

  // Touch '/a' so it becomes the most-recently-used, leaving '/b' as the LRU.
  expect(cache.get('/a', 1, 10)).toBeDefined();

  cache.set('/c', 1, 10, derivedFields(3));
  expect(
    cache.size,
    'the cache must stay within its configured bound',
  ).toBe(2);
  expect(
    cache.get('/b', 1, 10),
    'the least-recently-used entry should have been evicted',
  ).toBeUndefined();
  expect(cache.get('/a', 1, 10), 'recently-touched entries survive').toBeDefined();
  expect(cache.get('/c', 1, 10), 'the newest entry survives').toBeDefined();
});

/**
 * Simulate one discover()-style full directory pass over `keys` in a fixed
 * cyclic order: for each key, consult the cache first (mirroring
 * candidateDerivedFields's cache.get()) and only populate it on a miss
 * (mirroring its cache.set() on miss). Returns the hit count for the pass.
 * This — not a single blind populate-then-read — is the actual watch-loop
 * workload: every poll tick re-runs this exact get-or-populate pass over
 * the same candidate set.
 */
function simulateScan(cache: ClassificationCache, keys: string[]): number {
  let hits = 0;
  for (const key of keys) {
    if (cache.get(key, 1, 10)) {
      hits++;
    } else {
      cache.set(key, 1, 10, derivedFields(0));
    }
  }
  return hits;
}

test('ClassificationCache: a small cap thrashes under repeated full-directory scans exceeding it (documents the inherent limit)', () => {
  // With a cap strictly below the number of unique keys touched per pass, NO
  // eviction policy can help: each pass's populate-on-miss evictions land
  // exactly on the keys the very next pass is about to ask for again, since
  // every pass walks the same cyclic order. This is what the default was
  // raised from 300 to 5000 to avoid for realistic candidate counts — see
  // the ClassificationCache doc comment in locate.ts. This test pins the
  // underlying property itself, at a small scale, so it stays fast and
  // deterministic. It takes a second full pass for the cascade to reach
  // steady state (the first pass is populating an empty cache, so it can
  // only ever be all misses regardless of cap), so three passes are run and
  // only the third's hit count is asserted on.
  const cap = 100;
  const passSize = 101; // one more unique key than the cache can hold
  const keys = Array.from({ length: passSize }, (_, i) => `/scan/${i}`);
  const cache = new ClassificationCache(cap);

  simulateScan(cache, keys); // pass 1: populates an empty cache (all misses)
  simulateScan(cache, keys); // pass 2: cascade begins
  const thirdPassHits = simulateScan(cache, keys); // pass 3: steady-state thrash

  expect(
    thirdPassHits,
    'once a scan exceeds the cap, repeated identical scans settle into zero hits — this is the workload property the 5000 default is sized to avoid, not something an eviction policy can fix',
  ).toBe(0);
});

test('ClassificationCache: the default capacity comfortably survives repeated realistic long-lived project directory scans', () => {
  // Regression for a cross-model review finding: the original 300-entry
  // default thrashed completely once a project directory's candidate count
  // exceeded it (proved above at a small scale, at steady state). 2000
  // candidates is a generous stand-in for "a repo actively used for years"
  // — comfortably under the 5000 default — so repeated full-directory scans
  // (exactly what the watch loop does on every poll tick) must retain every
  // entry from the second pass onward, with zero re-derivation.
  const cache = new ClassificationCache();
  const candidateCount = 2000;
  const keys = Array.from(
    { length: candidateCount },
    (_, i) => `/long-lived-project/${i}.jsonl`,
  );

  const firstPassHits = simulateScan(cache, keys);
  expect(firstPassHits, 'the first scan populates an empty cache').toBe(0);
  expect(cache.size).toBe(candidateCount);

  const secondPassHits = simulateScan(cache, keys);
  expect(
    secondPassHits,
    'every candidate from the first scan must still be cached on the next poll tick\'s scan',
  ).toBe(candidateCount);

  // A third pass proves this is a stable steady state, not a one-tick
  // coincidence.
  const thirdPassHits = simulateScan(cache, keys);
  expect(thirdPassHits).toBe(candidateCount);
});
