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
  realpath,
  symlink,
  readdir,
  stat,
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

const opendirFailureHarness = vi.hoisted(() => {
  let failedPath: string | null = null;
  return {
    failOnceAt: (path: string) => {
      failedPath = path;
    },
    consume: (path: string) => {
      if (failedPath !== path) return false;
      failedPath = null;
      return true;
    },
    reset: () => {
      failedPath = null;
    },
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
    opendir: (async (...args: Parameters<typeof actual.opendir>) => {
      if (
        typeof args[0] === 'string' &&
        opendirFailureHarness.consume(args[0])
      ) {
        throw Object.assign(new Error('permission denied by test'), {
          code: 'EACCES',
        });
      }
      return actual.opendir(...args);
    }) as typeof actual.opendir,
  };
});

// ---------------------------------------------------------------------------
// Test helper: temp HOME dir per test
// ---------------------------------------------------------------------------

async function withTempHome(fn: (dir: string) => Promise<void>): Promise<void> {
  const createdDir = await mkdtemp(join(tmpdir(), 'locate-test-'));
  // macOS exposes /var as a symlink to /private/var. Hand tests the canonical
  // temp path so ordinary cwd fixtures do not accidentally exercise the raw
  // alias branch; alias tests below create their own explicit path aliases.
  const dir = await realpath(createdDir);
  const prevHome = process.env.HOME;
  const prevStateDir = process.env.STATE_DIR;
  process.env.HOME = dir;
  process.env.STATE_DIR = join(dir, '.local', 'state', 'session-observer');
  opendirFailureHarness.reset();
  try {
    await fn(dir);
  } finally {
    configureCursorDiscoveryForTest();
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevStateDir === undefined) delete process.env.STATE_DIR;
    else process.env.STATE_DIR = prevStateDir;
    await rm(dir, { recursive: true, force: true });
  }
}

import {
  ClassificationCache,
  configureCursorDiscoveryForTest,
  discover,
  findSessionCandidate,
  gitWorktrees,
  resolveCursorIdentity,
} from '../../src/transcript/session-observer/lib/locate.js';
import { resolveSelfIdentity } from '../../src/transcript/session-observer/lib/observe.js';
import type { DiscoveryOptions } from '../../src/transcript/session-observer/lib/types.js';
import { runWatchLoop } from '../../src/transcript/session-observer/lib/watch.js';

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

function makeClaudeTypical(cwd: string, sessionId = 'cc-session-001'): string {
  return `${JSON.stringify({ sessionId, type: 'summary', cwd })}\n${JSON.stringify({ type: 'user', cwd, message: { role: 'user', content: 'Hello' }, sessionId })}\n${JSON.stringify({ type: 'assistant', cwd, message: { role: 'assistant', content: [{ type: 'text', text: 'Hi!' }] }, sessionId })}\n`;
}

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

const exactReadOnlyDiscovery: DiscoveryOptions = {
  persistence: 'forbid',
  recency: 'exact-all',
};

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

type CursorAliasPlacement = 'leaf' | 'ancestor';

async function createCursorAliasPaths(
  home: string,
  placement: CursorAliasPlacement,
): Promise<{ aliasCwd: string; canonicalCwd: string }> {
  if (placement === 'leaf') {
    const canonicalCwd = join(home, 'Code', 'physical-leaf-project');
    const aliasCwd = join(home, 'Code', 'alias-leaf-project');
    await mkdir(canonicalCwd, { recursive: true });
    await symlink(canonicalCwd, aliasCwd, 'dir');
    return { aliasCwd, canonicalCwd: await realpath(canonicalCwd) };
  }

  const canonicalParent = join(home, 'Code', 'physical-ancestor');
  const aliasParent = join(home, 'Code', 'alias-ancestor');
  const canonicalCwd = join(canonicalParent, 'project');
  await mkdir(canonicalCwd, { recursive: true });
  await symlink(canonicalParent, aliasParent, 'dir');
  return {
    aliasCwd: join(aliasParent, 'project'),
    canonicalCwd: await realpath(canonicalCwd),
  };
}

async function writeCursorTranscriptForCwd(
  home: string,
  cwd: string,
  sessionId: string,
): Promise<string> {
  const transcriptDir = join(
    home,
    '.cursor',
    'projects',
    encodeCursorCwd(cwd),
    'agent-transcripts',
    sessionId,
  );
  await mkdir(transcriptDir, { recursive: true });
  const transcriptPath = join(transcriptDir, 'transcript.jsonl');
  await writeFile(transcriptPath, CURSOR_TYPICAL, 'utf8');
  return transcriptPath;
}

async function writeAccumulatedCursorPinStore(home: string): Promise<{
  targetCwd: string;
  targetSession: string;
  targetTranscript: string;
  unrelatedTranscripts: string[];
}> {
  const targetCwd = join(home, 'Code', 'bounded-explicit-pin');
  await mkdir(targetCwd, { recursive: true });
  const targetSession = 'session-explicit-target';
  const targetTranscript = await writeCursorTranscriptForCwd(
    home,
    targetCwd,
    targetSession,
  );
  const unrelatedTranscripts = await Promise.all(
    Array.from({ length: 24 }, (_, index) =>
      writeCursorTranscriptForCwd(
        home,
        targetCwd,
        `unrelated-session-${index}`,
      ),
    ),
  );
  return {
    targetCwd,
    targetSession,
    targetTranscript,
    unrelatedTranscripts,
  };
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
          operatorAskUserAnswers: 0,
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

test.each([
  ['missing', CLAUDE_CODE_TYPICAL],
  [
    'conflicting',
    `${JSON.stringify({ sessionId: 'cc-conflict', cwd: '/private/one' })}\n${JSON.stringify({ type: 'user', sessionId: 'cc-conflict', cwd: '/private/two', message: { role: 'user', content: 'Hello' } })}\n`,
  ],
] as const)(
  'claude-code exact-all rejects %s exact cwd evidence path-free',
  async (_kind, transcript) => {
    await withTempHome(async (home) => {
      const targetCwd = join(home, 'Code', 'secret-project');
      const projectDir = join(
        home,
        '.claude',
        'projects',
        encodeCwd(targetCwd),
      );
      await mkdir(projectDir, { recursive: true });
      const transcriptPath = join(projectDir, 'secret-session.jsonl');
      await writeFile(transcriptPath, transcript, 'utf8');

      let thrown: unknown;
      try {
        await discover(
          'claude-code',
          targetCwd,
          new ClassificationCache(),
          exactReadOnlyDiscovery,
        );
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toMatchObject({ code: 'DISCOVERY_TRANSCRIPT_INCOMPLETE' });
      expect(String(thrown)).not.toContain(targetCwd);
      expect(String(thrown)).not.toContain(transcriptPath);
    });
  },
);

test.each([
  [
    'late top-level conflict',
    (targetCwd: string) => ({ cwd: `${targetCwd}-conflict` }),
  ],
  [
    'late payload conflict',
    (targetCwd: string) => ({ payload: { cwd: `${targetCwd}-conflict` } }),
  ],
  ['empty payload cwd', () => ({ payload: { cwd: '' } })],
  ['relative top-level cwd', () => ({ cwd: 'relative/project' })],
  ['malformed payload cwd', () => ({ payload: { cwd: 42 } })],
] as const)(
  'codex exact-all rejects %s path-free',
  async (_name, lateEvidence) => {
    await withTempHome(async (home) => {
      const targetCwd = join(home, 'Code', 'codex-cwd-evidence');
      const sessionDir = join(home, '.codex', 'sessions', '2026', '08', '31');
      await mkdir(sessionDir, { recursive: true });
      const transcriptPath = join(sessionDir, 'secret-cwd-evidence.jsonl');
      await writeFile(
        transcriptPath,
        [
          {
            type: 'session_started',
            sessionId: 'codex-cwd-evidence',
            cwd: targetCwd,
          },
          { type: 'response_item', ...lateEvidence(targetCwd) },
        ]
          .map((record) => JSON.stringify(record))
          .join('\n') + '\n',
        'utf8',
      );

      let thrown: unknown;
      try {
        await discover(
          'codex',
          targetCwd,
          new ClassificationCache(),
          exactReadOnlyDiscovery,
        );
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toMatchObject({
        code: 'DISCOVERY_TRANSCRIPT_INCOMPLETE',
      });
      expect(String(thrown)).not.toContain(targetCwd);
      expect(String(thrown)).not.toContain(transcriptPath);
    });
  },
);

test('codex exact-all accepts repeated agreeing top-level and payload cwd evidence', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(home, 'Code', 'codex-agreeing-cwd');
    const sessionDir = join(home, '.codex', 'sessions', '2026', '08', '31');
    await mkdir(sessionDir, { recursive: true });
    await writeFile(
      join(sessionDir, 'agreeing-cwd.jsonl'),
      [
        {
          type: 'session_started',
          sessionId: 'codex-agreeing-cwd',
          cwd: targetCwd,
        },
        { type: 'session_meta', payload: { cwd: targetCwd } },
        { type: 'response_item', cwd: targetCwd },
      ]
        .map((record) => JSON.stringify(record))
        .join('\n') + '\n',
      'utf8',
    );

    await expect(
      discover(
        'codex',
        targetCwd,
        new ClassificationCache(),
        exactReadOnlyDiscovery,
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        sessionId: 'codex-agreeing-cwd',
        recordedCwd: targetCwd,
      }),
    ]);
  });
});

test('claude-code exact-all uses exact transcript cwd evidence', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(home, 'Code', 'exact-project');
    const projectDir = join(home, '.claude', 'projects', encodeCwd(targetCwd));
    await mkdir(projectDir, { recursive: true });
    await writeFile(
      join(projectDir, 'exact.jsonl'),
      makeClaudeTypical(targetCwd, 'cc-exact'),
      'utf8',
    );

    await expect(
      discover(
        'claude-code',
        targetCwd,
        new ClassificationCache(),
        exactReadOnlyDiscovery,
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        sessionId: 'cc-exact',
        recordedCwd: targetCwd,
        cwdEvidence: 'transcript-record',
      }),
    ]);
  });
});

test('claude-code exact-all enumerates unexpected project slugs after a direct hit', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(home, 'Code', 'exact-project');
    const directDir = join(home, '.claude', 'projects', encodeCwd(targetCwd));
    const unexpectedDir = join(
      home,
      '.claude',
      'projects',
      'unexpected-alias-slug',
    );
    await mkdir(directDir, { recursive: true });
    await mkdir(unexpectedDir, { recursive: true });
    await writeFile(
      join(directDir, 'direct.jsonl'),
      makeClaudeTypical(targetCwd, 'cc-direct'),
      'utf8',
    );
    await writeFile(
      join(unexpectedDir, 'unexpected.jsonl'),
      makeClaudeTypical(targetCwd, 'cc-unexpected'),
      'utf8',
    );

    const candidates = await discover(
      'claude-code',
      targetCwd,
      new ClassificationCache(),
      exactReadOnlyDiscovery,
    );

    expect(candidates.map(({ sessionId }) => sessionId).toSorted()).toEqual([
      'cc-direct',
      'cc-unexpected',
    ]);
    expect(
      candidates.every(
        ({ cwdEvidence }) => cwdEvidence === 'transcript-record',
      ),
    ).toBe(true);
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

test('codex exact-all includes old sessions while default discovery remains recent-only', async () => {
  await withTempHome(async (home) => {
    const targetCwd = '/Users/testuser/Code/exact-all-project';
    const staleDir = join(home, '.codex', 'sessions', '2025', '01', '01');
    await mkdir(staleDir, { recursive: true });
    const stalePath = join(staleDir, 'session-exact-all.jsonl');
    await writeFile(stalePath, makeCodexTypical(targetCwd), 'utf8');
    const staleTime = Date.now() / 1000 - 30 * 86400;
    await utimes(stalePath, staleTime, staleTime);

    expect(
      (await discover('codex', targetCwd)).some(
        (candidate) => candidate.transcriptPath === stalePath,
      ),
    ).toBe(false);
    expect(
      (
        await discover(
          'codex',
          targetCwd,
          new ClassificationCache(),
          exactReadOnlyDiscovery,
        )
      ).some((candidate) => candidate.transcriptPath === stalePath),
    ).toBe(true);
  });
});

test('codex persistence=forbid ignores stale cache reads and leaves the cache byte-identical', async () => {
  await withTempHome(async (home) => {
    const targetCwd = '/Users/testuser/Code/read-only-cache-project';
    const sessionDir = join(home, '.codex', 'sessions', '2026', '05', '20');
    await mkdir(sessionDir, { recursive: true });
    const transcriptPath = join(sessionDir, 'session-read-only.jsonl');
    await writeFile(transcriptPath, makeCodexTypical(targetCwd), 'utf8');
    const transcriptStat = await stat(transcriptPath);
    const cachePath = join(process.env.STATE_DIR!, 'codex-cwd-cache.json');
    await mkdir(dirname(cachePath), { recursive: true });
    const seeded = JSON.stringify({
      [`${transcriptPath}:${Math.floor(transcriptStat.mtimeMs / 1000)}`]: {
        recordedCwd: '/stale/cache/value',
        sessionId: 'stale-cache-id',
      },
    });
    await writeFile(cachePath, seeded, 'utf8');

    const candidates = await discover(
      'codex',
      targetCwd,
      new ClassificationCache(),
      exactReadOnlyDiscovery,
    );

    expect(candidates).toEqual([
      expect.objectContaining({
        sessionId: 'codex-sess-001',
        recordedCwd: targetCwd,
      }),
    ]);
    expect(await readFile(cachePath, 'utf8')).toBe(seeded);
  });
});

test('codex persistence=forbid does not create an absent state directory', async () => {
  await withTempHome(async (home) => {
    const targetCwd = '/Users/testuser/Code/no-cache-write-project';
    const sessionDir = join(home, '.codex', 'sessions', '2026', '05', '21');
    await mkdir(sessionDir, { recursive: true });
    await writeFile(
      join(sessionDir, 'session-no-cache-write.jsonl'),
      makeCodexTypical(targetCwd),
      'utf8',
    );

    await discover(
      'codex',
      targetCwd,
      new ClassificationCache(),
      exactReadOnlyDiscovery,
    );

    await expect(readdir(process.env.STATE_DIR!)).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});

test('exact-all rejects the complete discovery when aggregate entry or byte budgets are crossed', async () => {
  await withTempHome(async (home) => {
    const targetCwd = '/Users/testuser/Code/budget-project';
    const sessionDir = join(home, '.codex', 'sessions', '2026', '05', '22');
    await mkdir(sessionDir, { recursive: true });
    await writeFile(join(sessionDir, 'one.jsonl'), makeCodexTypical(targetCwd));
    await writeFile(join(sessionDir, 'two.jsonl'), makeCodexTypical(targetCwd));

    const options: DiscoveryOptions = {
      ...exactReadOnlyDiscovery,
      budget: {
        maxEntries: 1,
        maxAggregateBytes: 1_000_000,
        maxMetadataBytesPerEntry: 256 * 1024,
        deadlineMs: 30_000,
      },
    };
    await expect(
      discover('codex', targetCwd, new ClassificationCache(), options),
    ).rejects.toMatchObject({ code: 'DISCOVERY_ENTRY_BUDGET_EXCEEDED' });

    options.budget = {
      ...options.budget!,
      maxEntries: 10,
      maxAggregateBytes: 1,
    };
    await expect(
      discover('codex', targetCwd, new ClassificationCache(), options),
    ).rejects.toMatchObject({ code: 'DISCOVERY_BYTE_BUDGET_EXCEEDED' });
  });
});

test.each(['codex', 'claude-code'] as const)(
  '%s exact-all counts non-JSONL and nested directory entries against maxEntries',
  async (runtime) => {
    await withTempHome(async (home) => {
      const targetCwd = join(home, 'Code', `${runtime}-entry-budget`);
      const scanDir =
        runtime === 'codex'
          ? join(home, '.codex', 'sessions')
          : join(home, '.claude', 'projects', encodeCwd(targetCwd));
      await mkdir(join(scanDir, 'nested-directory'), { recursive: true });
      await writeFile(join(scanDir, 'ignored-one.txt'), 'one', 'utf8');
      await writeFile(join(scanDir, 'ignored-two.log'), 'two', 'utf8');
      const diagnostics: unknown[] = [];

      await expect(
        discover(runtime, targetCwd, new ClassificationCache(), {
          ...exactReadOnlyDiscovery,
          budget: {
            maxEntries: 1,
            maxAggregateBytes: 1_000_000,
            maxMetadataBytesPerEntry: 256 * 1024,
            deadlineMs: 30_000,
          },
          diagnostic: (event) => diagnostics.push(event),
        }),
      ).rejects.toMatchObject({ code: 'DISCOVERY_ENTRY_BUDGET_EXCEEDED' });
      expect(diagnostics).toContainEqual({
        code: 'budget-exceeded',
        runtime,
      });
    });
  },
);

test('exact-all rejects an unclassifiable oversized metadata prefix with path-free diagnostics', async () => {
  await withTempHome(async (home) => {
    const targetCwd = '/Users/testuser/Code/per-entry-project';
    const sessionDir = join(home, '.codex', 'sessions', '2026', '05', '23');
    await mkdir(sessionDir, { recursive: true });
    const transcriptPath = join(sessionDir, 'secret-transcript-name.jsonl');
    await writeFile(
      transcriptPath,
      `${JSON.stringify({ padding: 'x'.repeat(512) })}\n${makeCodexTypical(targetCwd)}`,
    );
    const diagnostics: unknown[] = [];

    await expect(
      discover('codex', targetCwd, new ClassificationCache(), {
        ...exactReadOnlyDiscovery,
        budget: {
          maxEntries: 10,
          maxAggregateBytes: 1_000_000,
          maxMetadataBytesPerEntry: 64,
          deadlineMs: 30_000,
        },
        diagnostic: (event) => diagnostics.push(event),
      }),
    ).rejects.toMatchObject({ code: 'DISCOVERY_TRANSCRIPT_INCOMPLETE' });
    expect(diagnostics).toEqual([
      { code: 'oversized-record', runtime: 'codex' },
    ]);
    expect(JSON.stringify(diagnostics)).not.toContain(transcriptPath);
    expect(JSON.stringify(diagnostics)).not.toContain('secret-transcript-name');
  });
});

test.each([
  [
    'clean 129th metadata record',
    'codex' as const,
    (targetCwd: string) =>
      [
        {
          type: 'session_started',
          sessionId: 'record-cap',
          cwd: targetCwd,
        },
        ...Array.from({ length: 128 }, (_, index) => ({ index })),
      ]
        .map((record) => JSON.stringify(record))
        .join('\n') + '\n',
    256 * 1024,
  ],
  [
    'late contradictory cwd',
    'claude-code' as const,
    (targetCwd: string) =>
      [
        ...Array.from({ length: 128 }, (_, index) => ({
          type: index === 0 ? 'summary' : 'progress',
          sessionId: 'late-conflict',
          cwd: targetCwd,
          index,
        })),
        {
          type: 'user',
          sessionId: 'late-conflict',
          cwd: '/private/contradictory-cwd',
          message: { role: 'user', content: 'late conflict' },
        },
      ]
        .map((record) => JSON.stringify(record))
        .join('\n') + '\n',
    256 * 1024,
  ],
  [
    'newline-aligned byte boundary',
    'codex' as const,
    (targetCwd: string) =>
      `${JSON.stringify({ type: 'session_started', sessionId: 'byte-cap', cwd: targetCwd })}\n${JSON.stringify({ later: true })}\n`,
    0,
  ],
] as const)(
  'exact-all rejects %s metadata-prefix truncation path-free',
  async (_name, runtime, makeTranscript, configuredMaxBytes) => {
    await withTempHome(async (home) => {
      const targetCwd = join(home, 'Code', 'metadata-prefix-project');
      const transcript = makeTranscript(targetCwd);
      const firstLineBytes = Buffer.byteLength(
        transcript.slice(0, transcript.indexOf('\n') + 1),
      );
      const scanDir =
        runtime === 'codex'
          ? join(home, '.codex', 'sessions', '2026', '08', '31')
          : join(home, '.claude', 'projects', encodeCwd(targetCwd));
      await mkdir(scanDir, { recursive: true });
      const transcriptPath = join(scanDir, 'secret-metadata-prefix.jsonl');
      await writeFile(transcriptPath, transcript, 'utf8');

      let thrown: unknown;
      try {
        await discover(runtime, targetCwd, new ClassificationCache(), {
          ...exactReadOnlyDiscovery,
          budget: {
            maxEntries: 10,
            maxAggregateBytes: 1_000_000,
            maxMetadataBytesPerEntry:
              configuredMaxBytes === 0 ? firstLineBytes : configuredMaxBytes,
            deadlineMs: 30_000,
          },
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toMatchObject({
        code: 'DISCOVERY_TRANSCRIPT_INCOMPLETE',
      });
      expect(String(thrown)).not.toContain(targetCwd);
      expect(String(thrown)).not.toContain(transcriptPath);
    });
  },
);

test('exact-all rejects an expired aggregate deadline without returning partial candidates', async () => {
  await withTempHome(async (home) => {
    const targetCwd = '/Users/testuser/Code/deadline-project';
    const sessionDir = join(home, '.codex', 'sessions', '2026', '05', '24');
    await mkdir(sessionDir, { recursive: true });
    await writeFile(
      join(sessionDir, 'deadline.jsonl'),
      makeCodexTypical(targetCwd),
    );
    const diagnostics: unknown[] = [];

    await expect(
      discover('codex', targetCwd, new ClassificationCache(), {
        ...exactReadOnlyDiscovery,
        budget: {
          maxEntries: 10,
          maxAggregateBytes: 1_000_000,
          maxMetadataBytesPerEntry: 256 * 1024,
          deadlineMs: 0,
        },
        diagnostic: (event) => diagnostics.push(event),
      }),
    ).rejects.toMatchObject({ code: 'DISCOVERY_DEADLINE_EXCEEDED' });
    expect(diagnostics).toContainEqual({
      code: 'deadline-exceeded',
      runtime: 'codex',
    });
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
      const err = new Error(
        'simulated rename failure',
      ) as NodeJS.ErrnoException;
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

test('cursor: explicit session lookup does not read large sibling transcript bodies', async () => {
  await withTempHome(async (home) => {
    classifyCountHarness.reset();
    const targetCwd = join(home, 'Code', 'bounded-pin-project');
    const targetTranscript = await writeCursorTranscriptForCwd(
      home,
      targetCwd,
      'session-target',
    );
    const siblingTranscript = await writeCursorTranscriptForCwd(
      home,
      targetCwd,
      'session-large-sibling',
    );
    await writeFile(siblingTranscript, 'x'.repeat(4 * 1024 * 1024), 'utf8');

    await expect(
      findSessionCandidate('cursor', targetCwd, 'session-target'),
    ).resolves.toMatchObject({
      runtime: 'cursor',
      sessionId: 'session-target',
      transcriptPath: targetTranscript,
    });
    expect(classifyCountHarness.countFor(targetTranscript)).toBe(1);
    expect(classifyCountHarness.countFor(siblingTranscript)).toBe(0);
  });
});

test('cursor: explicit locate pin resolves the exact canonical candidate through a finite metadata scan without unrelated body reads', async () => {
  await withTempHome(async (home) => {
    const fixture = await writeAccumulatedCursorPinStore(home);
    classifyCountHarness.reset();
    configureCursorDiscoveryForTest({
      maxEntries: 1_000,
      maxElapsedMs: 5_000,
      now: () => 1,
    });

    await expect(
      findSessionCandidate('cursor', fixture.targetCwd, fixture.targetSession),
    ).resolves.toMatchObject({
      runtime: 'cursor',
      sessionId: fixture.targetSession,
      transcriptPath: await realpath(fixture.targetTranscript),
      recordedCwd: fixture.targetCwd,
    });
    expect(classifyCountHarness.countFor(fixture.targetTranscript)).toBe(1);
    expect(
      fixture.unrelatedTranscripts.every(
        (transcriptPath) => classifyCountHarness.countFor(transcriptPath) === 0,
      ),
    ).toBe(true);
  });
});

test('cursor: explicit locate pin surfaces aggregate metadata-entry exhaustion instead of a missing session', async () => {
  await withTempHome(async (home) => {
    const fixture = await writeAccumulatedCursorPinStore(home);
    classifyCountHarness.reset();
    configureCursorDiscoveryForTest({
      maxEntries: 4,
      maxElapsedMs: 5_000,
      now: () => 1,
    });

    await expect(
      findSessionCandidate('cursor', fixture.targetCwd, fixture.targetSession),
    ).rejects.toMatchObject({
      name: 'CursorDiscoveryError',
      code: 'CURSOR_DISCOVERY_ENTRY_BUDGET_EXCEEDED',
    });
    expect(
      fixture.unrelatedTranscripts.every(
        (transcriptPath) => classifyCountHarness.countFor(transcriptPath) === 0,
      ),
    ).toBe(true);
  });
});

test('cursor: public pinned observe identity surfaces elapsed-time exhaustion without unrelated body reads', async () => {
  await withTempHome(async (home) => {
    const fixture = await writeAccumulatedCursorPinStore(home);
    classifyCountHarness.reset();
    let now = 0;
    configureCursorDiscoveryForTest({
      maxEntries: 1_000,
      maxElapsedMs: 1,
      now: () => {
        now += 2;
        return now;
      },
    });

    await expect(
      resolveSelfIdentity(fixture.targetCwd, {
        SESSION_OBSERVER_SELF: `cursor:${fixture.targetSession}`,
      } as NodeJS.ProcessEnv),
    ).rejects.toMatchObject({
      name: 'CursorDiscoveryError',
      code: 'CURSOR_DISCOVERY_TIME_BUDGET_EXCEEDED',
    });
    expect(classifyCountHarness.countFor(fixture.targetTranscript)).toBe(0);
    expect(
      fixture.unrelatedTranscripts.every(
        (transcriptPath) => classifyCountHarness.countFor(transcriptPath) === 0,
      ),
    ).toBe(true);
  });
});

test('cursor: public pinned watch surfaces metadata-entry exhaustion before unrelated body reads', async () => {
  await withTempHome(async (home) => {
    const fixture = await writeAccumulatedCursorPinStore(home);
    classifyCountHarness.reset();
    configureCursorDiscoveryForTest({
      maxEntries: 4,
      maxElapsedMs: 5_000,
      now: () => 1,
    });

    await expect(
      runWatchLoop(
        {
          runtime: 'cursor',
          cwd: fixture.targetCwd,
          session: `cursor:${fixture.targetSession}`,
          pollSec: 0.01,
          debounceSec: 0.01,
          maxRuntimeMin: 0.001,
          heartbeatSec: 0,
        },
        {
          handleSignals: false,
          pid: process.pid,
          now: () => 1_700_000_000_000,
          sleep: async () => undefined,
          writeStdout: async () => undefined,
        },
      ),
    ).rejects.toMatchObject({
      name: 'CursorDiscoveryError',
      code: 'CURSOR_DISCOVERY_ENTRY_BUDGET_EXCEEDED',
      watchErrorEventEmitted: true,
    });
    expect(
      fixture.unrelatedTranscripts.every(
        (transcriptPath) => classifyCountHarness.countFor(transcriptPath) === 0,
      ),
    ).toBe(true);
  });
});

test('cursor: explicit pin preserves incomplete-index failure semantics', async () => {
  await withTempHome(async (home) => {
    const fixture = await writeAccumulatedCursorPinStore(home);
    classifyCountHarness.reset();
    opendirFailureHarness.failOnceAt(
      join(
        home,
        '.cursor',
        'projects',
        encodeCursorCwd(fixture.targetCwd),
        'agent-transcripts',
      ),
    );

    await expect(
      findSessionCandidate('cursor', fixture.targetCwd, fixture.targetSession),
    ).rejects.toMatchObject({
      name: 'CursorDiscoveryError',
      code: 'IDENTITY_INDEX_INCOMPLETE',
    });
    expect(classifyCountHarness.countFor(fixture.targetTranscript)).toBe(0);
  });
});

test.each([
  {
    name: 'entry',
    options: { maxEntries: 3 },
    code: 'CURSOR_DISCOVERY_ENTRY_BUDGET_EXCEEDED',
    maximumBodyReads: 1,
    transcriptBytes: 1024 * 1024,
  },
  {
    name: 'elapsed time',
    options: {
      maxElapsedMs: 0,
      now: (() => {
        let tick = 0;
        return () => {
          tick += 1;
          return tick;
        };
      })(),
    },
    code: 'CURSOR_DISCOVERY_TIME_BUDGET_EXCEEDED',
    maximumBodyReads: 0,
    transcriptBytes: 1024 * 1024,
  },
  {
    name: 'byte',
    options: { maxBytes: 1024 },
    code: 'CURSOR_DISCOVERY_BYTE_BUDGET_EXCEEDED',
    maximumBodyReads: 0,
    transcriptBytes: 1024 * 1024,
  },
  {
    name: 'retained candidate',
    options: { maxRetainedCandidates: 2, maxBytes: 10 * 1024 * 1024 },
    code: 'CURSOR_DISCOVERY_RETAINED_CANDIDATE_BUDGET_EXCEEDED',
    maximumBodyReads: 2,
    transcriptBytes: 1024 * 1024,
  },
])(
  'cursor: generic unpinned discovery fails visibly at the aggregate $name budget before unbounded body reads or retention',
  async ({ options, code, maximumBodyReads, transcriptBytes }) => {
    await withTempHome(async (home) => {
      classifyCountHarness.reset();
      const targetCwd = join(home, 'Code', 'bounded-generic-discovery');
      const transcripts = await Promise.all(
        Array.from({ length: 6 }, async (_, index) => {
          const transcriptPath = await writeCursorTranscriptForCwd(
            home,
            targetCwd,
            `large-session-${index}`,
          );
          await writeFile(transcriptPath, 'x'.repeat(transcriptBytes), 'utf8');
          return transcriptPath;
        }),
      );

      configureCursorDiscoveryForTest(options);
      await expect(discover('cursor', targetCwd)).rejects.toMatchObject({
        name: 'CursorDiscoveryError',
        code,
      });

      const bodyReads = transcripts.reduce(
        (count, transcriptPath) =>
          count + classifyCountHarness.countFor(transcriptPath),
        0,
      );
      expect(bodyReads).toBeLessThanOrEqual(maximumBodyReads);
      expect(bodyReads).toBeLessThan(transcripts.length);
    });
  },
);

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

test('cursor identity: direct and fallback evidence remain diagnostic without an exact session signal', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(home, 'Code', 'identity-project');
    const directDir = join(
      home,
      '.cursor',
      'projects',
      encodeCursorCwd(targetCwd),
      'agent-transcripts',
      'session-direct',
    );
    await mkdir(directDir, { recursive: true });
    await writeFile(
      join(directDir, 'transcript.jsonl'),
      CURSOR_TYPICAL,
      'utf8',
    );

    const [direct] = await discover('cursor', targetCwd);
    expect(await resolveCursorIdentity(direct, targetCwd)).toMatchObject({
      runtime: 'cursor',
      sessionId: 'session-direct',
      canonicalCwd: targetCwd,
      cwdEvidence: ['direct-project-root'],
      sessionEvidence: ['transcript-path'],
      strength: 'diagnostic',
    });

    const fallbackCwd = join(home, 'Code', 'missing-project');
    const [fallback] = await discover('cursor', fallbackCwd);
    expect(await resolveCursorIdentity(fallback, fallbackCwd)).toMatchObject({
      cwdEvidence: ['fallback-slug'],
      sessionEvidence: ['transcript-path'],
      strength: 'diagnostic',
    });
  });
});

test('cursor identity: store metadata or matching harness evidence can establish exact identity', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(home, 'Code', 'identity-project');
    await mkdir(targetCwd, { recursive: true });
    const transcriptDir = join(
      home,
      '.cursor',
      'projects',
      encodeCursorCwd(targetCwd),
      'agent-transcripts',
      'session-exact',
    );
    await mkdir(transcriptDir, { recursive: true });
    await writeFile(
      join(transcriptDir, 'transcript.jsonl'),
      CURSOR_TYPICAL,
      'utf8',
    );

    const [candidate] = await discover('cursor', targetCwd);
    expect(
      await resolveCursorIdentity(
        { ...candidate, cwdEvidence: 'store-metadata' },
        targetCwd,
      ),
    ).toMatchObject({
      cwdEvidence: ['store-metadata'],
      sessionEvidence: ['transcript-path'],
      strength: 'exact',
    });

    const previous = process.env.CURSOR_SESSION_ID;
    process.env.CURSOR_SESSION_ID = 'session-exact';
    try {
      expect(await resolveCursorIdentity(candidate, targetCwd)).toMatchObject({
        cwdEvidence: ['direct-project-root', 'harness-environment'],
        sessionEvidence: ['harness-environment', 'transcript-path'],
        strength: 'exact',
      });
    } finally {
      if (previous === undefined) delete process.env.CURSOR_SESSION_ID;
      else process.env.CURSOR_SESSION_ID = previous;
    }
  });
});

test('cursor identity: transcript disappearance blocks exact ownership', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(home, 'Code', 'identity-disappeared');
    await mkdir(targetCwd, { recursive: true });
    const transcriptPath = await writeCursorTranscriptForCwd(
      home,
      targetCwd,
      'session-disappeared',
    );
    const [candidate] = await discover('cursor', targetCwd);
    await rm(transcriptPath);

    expect(
      await resolveCursorIdentity(candidate, targetCwd, 'session-disappeared'),
    ).toMatchObject({
      strength: 'diagnostic',
      reasons: expect.arrayContaining(['TRANSCRIPT_CANONICALIZATION_FAILED']),
    });
  });
});

test('cursor identity: a transcript symlink swap cannot retain exact ownership', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(home, 'Code', 'identity-symlink-swap');
    await mkdir(targetCwd, { recursive: true });
    const transcriptPath = await writeCursorTranscriptForCwd(
      home,
      targetCwd,
      'session-symlink-swap',
    );
    const [candidate] = await discover('cursor', targetCwd);
    const aliasPath = join(
      dirname(transcriptPath),
      'session-symlink-swap-alias.jsonl',
    );
    await symlink(transcriptPath, aliasPath);
    const aliasedCandidate = { ...candidate, transcriptPath: aliasPath };
    expect(
      await resolveCursorIdentity(
        aliasedCandidate,
        targetCwd,
        'session-symlink-swap',
      ),
    ).toMatchObject({ strength: 'exact' });

    const outsidePath = join(home, 'outside-cursor-transcript.jsonl');
    await writeFile(outsidePath, CURSOR_TYPICAL, 'utf8');
    await rm(aliasPath);
    await symlink(outsidePath, aliasPath);

    expect(
      await resolveCursorIdentity(
        aliasedCandidate,
        targetCwd,
        'session-symlink-swap',
      ),
    ).toMatchObject({
      strength: 'ambiguous',
      reasons: expect.arrayContaining(['PATH_OUTSIDE_SUPPORTED_ROOT']),
    });
  });
});

test('cursor identity: duplicate exact-session candidates are ambiguous', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(home, 'Code', 'duplicate-project');
    const transcriptDir = join(
      home,
      '.cursor',
      'projects',
      encodeCursorCwd(targetCwd),
      'agent-transcripts',
      'session-duplicate',
    );
    await mkdir(transcriptDir, { recursive: true });
    await writeFile(
      join(transcriptDir, 'transcript.jsonl'),
      CURSOR_TYPICAL,
      'utf8',
    );
    await writeFile(
      join(transcriptDir, 'conversation.jsonl'),
      CURSOR_TYPICAL,
      'utf8',
    );

    const candidates = await discover('cursor', targetCwd);
    expect(candidates).toHaveLength(2);
    expect(
      await resolveCursorIdentity(
        candidates[0],
        targetCwd,
        'session-duplicate',
      ),
    ).toMatchObject({
      strength: 'ambiguous',
      reasons: expect.arrayContaining(['DUPLICATE_SESSION_CANDIDATES']),
    });
  });
});

test('cursor identity: direct hit still detects same-session duplicates in another slug', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(home, 'Code', 'cross-slug-project');
    const directDir = join(
      home,
      '.cursor',
      'projects',
      encodeCursorCwd(targetCwd),
      'agent-transcripts',
      'session-cross-slug',
    );
    const duplicateDir = join(
      home,
      '.cursor',
      'projects',
      'other-project-slug',
      'agent-transcripts',
      'session-cross-slug',
    );
    await mkdir(directDir, { recursive: true });
    await mkdir(duplicateDir, { recursive: true });
    await writeFile(
      join(directDir, 'transcript.jsonl'),
      CURSOR_TYPICAL,
      'utf8',
    );
    await writeFile(
      join(duplicateDir, 'transcript.jsonl'),
      CURSOR_TYPICAL,
      'utf8',
    );

    const candidates = await discover('cursor', targetCwd);
    expect(
      candidates.filter(
        (candidate) => candidate.sessionId === 'session-cross-slug',
      ),
    ).toHaveLength(2);
    const direct = candidates.find(
      (candidate) => candidate.cwdEvidence === 'direct-parent-dir',
    )!;
    expect(
      await resolveCursorIdentity(direct, targetCwd, 'session-cross-slug'),
    ).toMatchObject({
      strength: 'ambiguous',
      reasons: expect.arrayContaining(['DUPLICATE_SESSION_CANDIDATES']),
    });
  });
});

test('cursor identity: duplicate indexing is path-only across many and large transcripts', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(home, 'Code', 'path-only-identity-project');
    await mkdir(targetCwd, { recursive: true });
    const targetTranscript = await writeCursorTranscriptForCwd(
      home,
      targetCwd,
      'session-path-only',
    );
    const [candidate] = await discover('cursor', targetCwd);
    const accumulatedTranscripts: string[] = [];

    for (let index = 0; index < 24; index += 1) {
      const transcriptDir = join(
        home,
        '.cursor',
        'projects',
        `accumulated-project-${index}`,
        'agent-transcripts',
        `accumulated-session-${index}`,
      );
      await mkdir(transcriptDir, { recursive: true });
      const transcriptPath = join(transcriptDir, 'transcript.jsonl');
      await writeFile(
        transcriptPath,
        index === 0
          ? `${JSON.stringify({
              role: 'assistant',
              message: { content: 'x'.repeat(2_000_000) },
            })}\n`
          : CURSOR_TYPICAL,
        'utf8',
      );
      accumulatedTranscripts.push(transcriptPath);
    }

    classifyCountHarness.reset();
    await expect(
      resolveCursorIdentity(candidate, targetCwd, 'session-path-only', {
        maxEntries: 1_000,
        maxElapsedMs: 5_000,
      }),
    ).resolves.toMatchObject({
      strength: 'exact',
      reasons: [],
    });
    expect(classifyCountHarness.countFor(targetTranscript)).toBe(0);
    expect(
      accumulatedTranscripts.every(
        (transcriptPath) => classifyCountHarness.countFor(transcriptPath) === 0,
      ),
    ).toBe(true);
  });
});

test('cursor identity: duplicate indexing fails closed on an unreadable store branch', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(home, 'Code', 'incomplete-index-project');
    await mkdir(targetCwd, { recursive: true });
    await writeCursorTranscriptForCwd(
      home,
      targetCwd,
      'session-incomplete-index',
    );
    const [candidate] = await discover('cursor', targetCwd);
    const unreadableRoot = join(
      home,
      '.cursor',
      'projects',
      'unreadable-project',
      'agent-transcripts',
    );
    await mkdir(join(unreadableRoot, 'unrelated-session'), { recursive: true });
    opendirFailureHarness.failOnceAt(unreadableRoot);

    await expect(
      resolveCursorIdentity(candidate, targetCwd, 'session-incomplete-index'),
    ).resolves.toMatchObject({
      strength: 'ambiguous',
      reasons: expect.arrayContaining(['IDENTITY_INDEX_INCOMPLETE']),
    });
  });
});

test('cursor identity: duplicate indexing fails visibly at its aggregate entry budget', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(home, 'Code', 'entry-budget-project');
    await mkdir(targetCwd, { recursive: true });
    await writeCursorTranscriptForCwd(home, targetCwd, 'session-entry-budget');
    const [candidate] = await discover('cursor', targetCwd);

    await expect(
      resolveCursorIdentity(candidate, targetCwd, 'session-entry-budget', {
        maxEntries: 1,
        maxElapsedMs: 5_000,
      }),
    ).resolves.toMatchObject({
      strength: 'ambiguous',
      reasons: expect.arrayContaining(['IDENTITY_INDEX_ENTRY_BUDGET_EXCEEDED']),
    });
  });
});

test('cursor identity: duplicate indexing fails visibly at its elapsed-time budget', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(home, 'Code', 'time-budget-project');
    await mkdir(targetCwd, { recursive: true });
    await writeCursorTranscriptForCwd(home, targetCwd, 'session-time-budget');
    const [candidate] = await discover('cursor', targetCwd);
    let now = 0;

    await expect(
      resolveCursorIdentity(candidate, targetCwd, 'session-time-budget', {
        maxEntries: 100,
        maxElapsedMs: 1,
        now: () => {
          now += 2;
          return now;
        },
      }),
    ).resolves.toMatchObject({
      strength: 'ambiguous',
      reasons: expect.arrayContaining(['IDENTITY_INDEX_TIME_BUDGET_EXCEEDED']),
    });
  });
});

test.each<CursorAliasPlacement>(['leaf', 'ancestor'])(
  'cursor identity: canonical store candidate stays exact through a %s cwd alias',
  async (placement) => {
    await withTempHome(async (home) => {
      const { aliasCwd, canonicalCwd } = await createCursorAliasPaths(
        home,
        placement,
      );
      const sessionId = `session-canonical-${placement}`;
      const transcriptPath = await writeCursorTranscriptForCwd(
        home,
        canonicalCwd,
        sessionId,
      );
      const [candidate] = await discover('cursor', aliasCwd);

      expect(candidate.cwdEvidence).toBe('direct-parent-dir');
      expect(
        await resolveCursorIdentity(candidate, aliasCwd, sessionId),
      ).toMatchObject({
        canonicalCwd,
        canonicalTranscriptPath: await realpath(transcriptPath),
        strength: 'exact',
      });
    });
  },
);

test.each<CursorAliasPlacement>(['leaf', 'ancestor'])(
  'cursor identity: %s raw cwd alias-only store remains diagnostic with an explicit pin',
  async (placement) => {
    await withTempHome(async (home) => {
      const { aliasCwd, canonicalCwd } = await createCursorAliasPaths(
        home,
        placement,
      );
      const sessionId = `session-raw-alias-${placement}`;
      const transcriptPath = await writeCursorTranscriptForCwd(
        home,
        aliasCwd,
        sessionId,
      );

      const [candidate] = await discover('cursor', aliasCwd);
      expect(candidate.cwdEvidence).toBe('raw-cwd-alias');
      expect(
        await resolveCursorIdentity(candidate, aliasCwd, sessionId),
      ).toMatchObject({
        canonicalCwd,
        canonicalTranscriptPath: await realpath(transcriptPath),
        sessionEvidence: expect.arrayContaining(['explicit-pin']),
        strength: 'diagnostic',
        reasons: expect.arrayContaining([
          'RAW_CWD_ALIAS_DIAGNOSTIC_ONLY',
          'WEAK_CWD_EVIDENCE',
        ]),
      });
    });
  },
);

test.each<CursorAliasPlacement>(['leaf', 'ancestor'])(
  'cursor identity: canonical/raw %s alias duplicates reject an explicit pin as ambiguous',
  async (placement) => {
    await withTempHome(async (home) => {
      const { aliasCwd, canonicalCwd } = await createCursorAliasPaths(
        home,
        placement,
      );
      const sessionId = `session-alias-duplicate-${placement}`;
      await writeCursorTranscriptForCwd(home, canonicalCwd, sessionId);
      await writeCursorTranscriptForCwd(home, aliasCwd, sessionId);

      const candidates = await discover('cursor', aliasCwd);
      expect(candidates).toHaveLength(2);
      const canonical = candidates.find(
        (candidate) => candidate.cwdEvidence === 'direct-parent-dir',
      )!;
      const rawAlias = candidates.find(
        (candidate) => candidate.cwdEvidence === 'raw-cwd-alias',
      )!;

      expect(
        await resolveCursorIdentity(canonical, aliasCwd, sessionId),
      ).toMatchObject({
        strength: 'ambiguous',
        reasons: expect.arrayContaining(['DUPLICATE_SESSION_CANDIDATES']),
      });
      expect(
        await resolveCursorIdentity(rawAlias, aliasCwd, sessionId),
      ).toMatchObject({
        strength: 'ambiguous',
        reasons: expect.arrayContaining([
          'DUPLICATE_SESSION_CANDIDATES',
          'RAW_CWD_ALIAS_DIAGNOSTIC_ONLY',
        ]),
      });
    });
  },
);

test('cursor identity: transcript symlinks escaping the supported store are rejected', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(home, 'Code', 'escape-project');
    const transcriptDir = join(
      home,
      '.cursor',
      'projects',
      encodeCursorCwd(targetCwd),
      'agent-transcripts',
      'session-escape',
    );
    await mkdir(transcriptDir, { recursive: true });
    const directPath = join(transcriptDir, 'transcript.jsonl');
    await writeFile(directPath, CURSOR_TYPICAL, 'utf8');
    const [candidate] = await discover('cursor', targetCwd);

    const outsidePath = join(home, 'outside.jsonl');
    const escapedPath = join(transcriptDir, 'escaped.jsonl');
    await writeFile(outsidePath, CURSOR_TYPICAL, 'utf8');
    await symlink(outsidePath, escapedPath);

    expect(
      await resolveCursorIdentity(
        { ...candidate, transcriptPath: escapedPath },
        targetCwd,
        'session-escape',
      ),
    ).toMatchObject({
      strength: 'ambiguous',
      reasons: expect.arrayContaining(['PATH_OUTSIDE_SUPPORTED_ROOT']),
    });
  });
});

test('cursor identity: an explicit pin mismatch cannot switch to a changed candidate', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(home, 'Code', 'pin-project');
    await mkdir(targetCwd, { recursive: true });
    const transcriptsRoot = join(
      home,
      '.cursor',
      'projects',
      encodeCursorCwd(targetCwd),
      'agent-transcripts',
    );
    const pinnedDir = join(transcriptsRoot, 'session-pinned');
    const newerDir = join(transcriptsRoot, 'session-newer');
    await mkdir(pinnedDir, { recursive: true });
    await mkdir(newerDir, { recursive: true });
    await writeFile(
      join(pinnedDir, 'transcript.jsonl'),
      CURSOR_TYPICAL,
      'utf8',
    );
    await writeFile(join(newerDir, 'transcript.jsonl'), CURSOR_TYPICAL, 'utf8');

    const candidates = await discover('cursor', targetCwd);
    const pinned = candidates.find(
      (candidate) => candidate.sessionId === 'session-pinned',
    )!;
    const changed = candidates.find(
      (candidate) => candidate.sessionId === 'session-newer',
    )!;

    expect(
      await resolveCursorIdentity(pinned, targetCwd, 'session-pinned'),
    ).toMatchObject({ strength: 'exact' });
    expect(
      await resolveCursorIdentity(changed, targetCwd, 'session-pinned'),
    ).toMatchObject({
      strength: 'ambiguous',
      reasons: expect.arrayContaining(['IDENTITY_MISMATCH']),
    });
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

test('classification cache: default results cannot bypass exact-all per-entry bounds', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(home, 'Code', 'cache-default-to-bounded');
    const transcriptDir = join(home, '.codex', 'sessions', '2026', '08', '30');
    const transcriptPath = join(transcriptDir, 'default-to-bounded.jsonl');
    await mkdir(transcriptDir, { recursive: true });
    await writeFile(
      transcriptPath,
      `${JSON.stringify({ padding: 'x'.repeat(512) })}\n${makeCodexTypical(targetCwd)}`,
      'utf8',
    );
    const cache = new ClassificationCache();

    expect(await discover('codex', targetCwd, cache)).toEqual([
      expect.objectContaining({ recordedCwd: targetCwd }),
    ]);
    await expect(
      discover('codex', targetCwd, cache, {
        ...exactReadOnlyDiscovery,
        budget: {
          maxEntries: 10,
          maxAggregateBytes: 1_000_000,
          maxMetadataBytesPerEntry: 64,
          deadlineMs: 30_000,
        },
      }),
    ).rejects.toMatchObject({ code: 'DISCOVERY_TRANSCRIPT_INCOMPLETE' });
  });
});

test('classification cache: rejected exact-all prefixes cannot change default classification', async () => {
  await withTempHome(async (home) => {
    const targetCwd = join(home, 'Code', 'cache-bounded-to-default');
    const transcriptDir = join(home, '.codex', 'sessions', '2026', '08', '30');
    const transcriptPath = join(transcriptDir, 'bounded-to-default.jsonl');
    await mkdir(transcriptDir, { recursive: true });
    const prefixRecords = [
      JSON.stringify({
        type: 'session_started',
        sessionId: 'bounded-to-default',
        cwd: targetCwd,
      }),
      ...Array.from({ length: 127 }, (_, index) =>
        JSON.stringify({ type: 'summary', index }),
      ),
    ];
    await writeFile(
      transcriptPath,
      [
        ...prefixRecords,
        JSON.stringify({
          type: 'response_item',
          sessionId: 'bounded-to-default',
          payload: { type: 'message', role: 'user', content: 'Hello' },
        }),
        JSON.stringify({
          type: 'response_item',
          sessionId: 'bounded-to-default',
          payload: { type: 'message', role: 'assistant', content: 'Hi' },
        }),
        '',
      ].join('\n'),
      'utf8',
    );
    const cache = new ClassificationCache();

    await expect(
      discover('codex', targetCwd, cache, exactReadOnlyDiscovery),
    ).rejects.toMatchObject({ code: 'DISCOVERY_TRANSCRIPT_INCOMPLETE' });

    const legacy = await discover('codex', targetCwd, cache);
    expect(legacy[0]).toMatchObject({
      engagementStatus: 'engaged',
      genuineUserMessages: 1,
      assistantMessages: 1,
      realMessageCount: 2,
    });
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
      operatorAskUserAnswers: 0,
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
  expect(sizeMismatchCache.get('/a/transcript.jsonl', 1_000, 50)).toEqual(
    entry,
  );
  expect(
    sizeMismatchCache.get('/a/transcript.jsonl', 1_000, 51),
    'a size mismatch must be treated as a cache miss',
  ).toBeUndefined();

  const mtimeMismatchCache = new ClassificationCache();
  mtimeMismatchCache.set('/a/transcript.jsonl', 1_000, 50, entry);
  expect(mtimeMismatchCache.get('/a/transcript.jsonl', 1_000, 50)).toEqual(
    entry,
  );
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
  expect(cache.size, 'the cache must stay within its configured bound').toBe(2);
  expect(
    cache.get('/b', 1, 10),
    'the least-recently-used entry should have been evicted',
  ).toBeUndefined();
  expect(
    cache.get('/a', 1, 10),
    'recently-touched entries survive',
  ).toBeDefined();
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
    "every candidate from the first scan must still be cached on the next poll tick's scan",
  ).toBe(candidateCount);

  // A third pass proves this is a stable steady state, not a one-tick
  // coincidence.
  const thirdPassHits = simulateScan(cache, keys);
  expect(thirdPassHits).toBe(candidateCount);
});
