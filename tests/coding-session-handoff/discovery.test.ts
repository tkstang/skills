import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test, vi } from 'vitest';

import {
  HandoffDiscoveryError,
  discoverHandoffCandidates,
  type HandoffDiscoveryDependencies,
} from '../../src/transcript/coding-session-handoff/discovery.js';
import type { TranscriptCandidate } from '../../src/transcript/session-observer/lib/types.js';

function transcriptCandidate(
  runtime: 'codex' | 'claude-code',
  sessionId: string,
  recordedCwd: string,
  overrides: Partial<TranscriptCandidate> = {},
): TranscriptCandidate {
  return {
    runtime,
    transcriptPath: `/private/provider/${runtime}/${sessionId}.jsonl`,
    sessionId,
    recordedCwd,
    mtime: 1,
    size: 100,
    ageSec: 999_999,
    engagement: {
      status: 'engaged',
      engaged: true,
      recordCount: 2,
      genuineUserMessages: 1,
      operatorAskUserAnswers: 0,
      syntheticUserMessages: 0,
      assistantMessages: 1,
      realMessageCount: 2,
      hasAssistantAndUser: true,
      bootstrapRecordIndexes: [],
      bootstrapRecordCount: 0,
    },
    engagementStatus: 'engaged',
    engaged: true,
    recordCount: 2,
    genuineUserMessages: 1,
    assistantMessages: 1,
    realMessageCount: 2,
    hasAssistantAndUser: true,
    bootstrapRecordCount: 0,
    ...overrides,
  };
}

function dependencies(
  byRuntime: Partial<Record<'codex' | 'claude-code', TranscriptCandidate[]>>,
): HandoffDiscoveryDependencies {
  return {
    canonicalize: async (path) =>
      ({
        '/alias/source': '/repo/source',
        '/repo/source': '/repo/source',
        '/repo/sister': '/repo/sister',
        '/other/global': '/other/global',
      })[path] ?? null,
    discover: vi.fn(async (runtime, _cwd, _cache, options) => {
      expect(options).toMatchObject({
        persistence: 'forbid',
        recency: 'exact-all',
      });
      return byRuntime[runtime as 'codex' | 'claude-code'] ?? [];
    }),
  };
}

describe('exact handoff candidate discovery', () => {
  test.sequential('returns exact Claude sessions from direct and unexpected slugs only', async () => {
    const createdHome = await mkdtemp(
      join(tmpdir(), 'handoff-claude-complete-'),
    );
    const home = await realpath(createdHome);
    const previousHome = process.env.HOME;
    const previousStateDir = process.env.STATE_DIR;
    process.env.HOME = home;
    process.env.STATE_DIR = join(home, '.local', 'state', 'session-observer');

    try {
      const sourceRoot = join(home, 'roots', 'source');
      const aliasRoot = join(home, 'roots', 'source-alias');
      const unrelatedRoot = join(home, 'roots', 'unrelated');
      await mkdir(sourceRoot, { recursive: true });
      await mkdir(unrelatedRoot, { recursive: true });
      await symlink(sourceRoot, aliasRoot, 'dir');
      const canonicalSource = await realpath(sourceRoot);
      const canonicalUnrelated = await realpath(unrelatedRoot);
      const directDir = join(
        home,
        '.claude',
        'projects',
        canonicalSource.replace(/[/.]/gu, '-'),
      );
      const unexpectedDir = join(
        home,
        '.claude',
        'projects',
        'unexpected-alias-slug',
      );
      await mkdir(directDir, { recursive: true });
      await mkdir(unexpectedDir, { recursive: true });

      const transcript = (cwd: string, sessionId: string) =>
        [
          { type: 'summary', sessionId, cwd },
          {
            type: 'user',
            sessionId,
            cwd,
            message: { role: 'user', content: 'Hello' },
          },
          {
            type: 'assistant',
            sessionId,
            cwd,
            message: {
              role: 'assistant',
              content: [{ type: 'text', text: 'Hi' }],
            },
          },
        ]
          .map((record) => JSON.stringify(record))
          .join('\n') + '\n';
      await writeFile(
        join(directDir, 'direct.jsonl'),
        transcript(canonicalSource, 'claude-direct'),
        'utf8',
      );
      await writeFile(
        join(unexpectedDir, 'alias.jsonl'),
        transcript(aliasRoot, 'claude-alias'),
        'utf8',
      );
      await writeFile(
        join(unexpectedDir, 'unrelated.jsonl'),
        transcript(canonicalUnrelated, 'claude-unrelated'),
        'utf8',
      );

      await expect(discoverHandoffCandidates(canonicalSource)).resolves.toEqual(
        [
          expect.objectContaining({ key: 'claude:claude-alias' }),
          expect.objectContaining({ key: 'claude:claude-direct' }),
        ],
      );
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      if (previousStateDir === undefined) delete process.env.STATE_DIR;
      else process.env.STATE_DIR = previousStateDir;
      await rm(home, { recursive: true, force: true });
    }
  });

  test.sequential('separates colliding Claude slugs using exact transcript cwd evidence', async () => {
    const createdHome = await mkdtemp(
      join(tmpdir(), 'handoff-claude-collision-'),
    );
    const home = await realpath(createdHome);
    const previousHome = process.env.HOME;
    const previousStateDir = process.env.STATE_DIR;
    process.env.HOME = home;
    process.env.STATE_DIR = join(home, '.local', 'state', 'session-observer');

    try {
      const hyphenRoot = join(home, 'roots', 'a-b');
      const nestedRoot = join(home, 'roots', 'a', 'b');
      await mkdir(hyphenRoot, { recursive: true });
      await mkdir(nestedRoot, { recursive: true });
      const canonicalHyphenRoot = await realpath(hyphenRoot);
      const canonicalNestedRoot = await realpath(nestedRoot);
      const sharedSlug = canonicalHyphenRoot.replace(/[/.]/gu, '-');
      expect(canonicalNestedRoot.replace(/[/.]/gu, '-')).toBe(sharedSlug);
      const projectDir = join(home, '.claude', 'projects', sharedSlug);
      await mkdir(projectDir, { recursive: true });

      const transcript = (cwd: string, sessionId: string) =>
        [
          { type: 'summary', sessionId, cwd },
          {
            type: 'user',
            sessionId,
            cwd,
            message: { role: 'user', content: 'Hello' },
          },
          {
            type: 'assistant',
            sessionId,
            cwd,
            message: {
              role: 'assistant',
              content: [{ type: 'text', text: 'Hi' }],
            },
          },
        ]
          .map((record) => JSON.stringify(record))
          .join('\n') + '\n';
      await writeFile(
        join(projectDir, 'hyphen.jsonl'),
        transcript(canonicalHyphenRoot, 'claude-hyphen'),
        'utf8',
      );
      await writeFile(
        join(projectDir, 'nested.jsonl'),
        transcript(canonicalNestedRoot, 'claude-nested'),
        'utf8',
      );

      await expect(
        discoverHandoffCandidates(canonicalHyphenRoot),
      ).resolves.toEqual([
        expect.objectContaining({ key: 'claude:claude-hyphen' }),
      ]);
      await expect(
        discoverHandoffCandidates(canonicalNestedRoot),
      ).resolves.toEqual([
        expect.objectContaining({ key: 'claude:claude-nested' }),
      ]);
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      if (previousStateDir === undefined) delete process.env.STATE_DIR;
      else process.env.STATE_DIR = previousStateDir;
      await rm(home, { recursive: true, force: true });
    }
  });

  test('returns only exact canonical cwd candidates from both providers', async () => {
    const deps = dependencies({
      codex: [
        transcriptCandidate('codex', 'exact', '/repo/source'),
        transcriptCandidate('codex', 'sister', '/repo/sister'),
        transcriptCandidate('codex', 'global', '/other/global'),
      ],
      'claude-code': [
        transcriptCandidate('claude-code', 'claude-exact', '/alias/source'),
      ],
    });

    const result = await discoverHandoffCandidates('/alias/source', { deps });

    expect(result).toEqual([
      expect.objectContaining({
        key: 'claude:claude-exact',
        recordedCwd: '/repo/source',
      }),
      expect.objectContaining({
        key: 'codex:exact',
        recordedCwd: '/repo/source',
      }),
    ]);
    expect(result.map((candidate) => JSON.stringify(candidate))).not.toContain(
      expect.stringContaining('/private/provider/'),
    );
  });

  test('keeps provider-native ID collisions distinct and sorts by provider then native ID', async () => {
    const deps = dependencies({
      codex: [
        transcriptCandidate('codex', 'same', '/repo/source', { mtime: 999 }),
        transcriptCandidate('codex', 'aaa', '/repo/source', { mtime: 1 }),
      ],
      'claude-code': [
        transcriptCandidate('claude-code', 'same', '/repo/source', {
          mtime: 2,
        }),
      ],
    });

    const result = await discoverHandoffCandidates('/repo/source', { deps });

    expect(result.map(({ key }) => key)).toEqual([
      'claude:same',
      'codex:aaa',
      'codex:same',
    ]);
  });

  test('orders mixed-case, punctuation, and non-ASCII qualified IDs by code unit', async () => {
    const deps = dependencies({
      codex: [
        transcriptCandidate('codex', 'é', '/repo/source'),
        transcriptCandidate('codex', 'a', '/repo/source'),
        transcriptCandidate('codex', '_', '/repo/source'),
        transcriptCandidate('codex', 'Z', '/repo/source'),
      ],
    });

    const result = await discoverHandoffCandidates('/repo/source', { deps });

    expect(result.map(({ key }) => key)).toEqual([
      'codex:Z',
      'codex:_',
      'codex:a',
      'codex:é',
    ]);
  });

  test('includes old Codex sessions and never marks current from candidate active/recency fields', async () => {
    const deps = dependencies({
      codex: [
        transcriptCandidate('codex', 'old', '/repo/source', {
          ageSec: 365 * 24 * 60 * 60,
          active: true,
          mtime: 1,
        }),
        transcriptCandidate('codex', 'new', '/repo/source', { mtime: 10_000 }),
      ],
    });

    const result = await discoverHandoffCandidates('/repo/source', { deps });

    expect(result.map(({ key }) => key)).toEqual(['codex:new', 'codex:old']);
    expect(
      result.every(({ currentEvidence }) => currentEvidence === 'none'),
    ).toBe(true);
  });

  test('marks current only from exact direct identity and ignores unrelated signals', async () => {
    const deps = dependencies({
      codex: [transcriptCandidate('codex', 'one', '/repo/source')],
      'claude-code': [
        transcriptCandidate('claude-code', 'two', '/repo/source'),
      ],
    });

    const result = await discoverHandoffCandidates('/repo/source', {
      deps,
      currentIdentities: [
        { provider: 'codex', nativeId: 'one', evidence: 'direct-environment' },
        { provider: 'claude', nativeId: 'missing', evidence: 'explicit-self' },
      ],
    });

    expect(result).toEqual([
      expect.objectContaining({ key: 'claude:two', currentEvidence: 'none' }),
      expect.objectContaining({
        key: 'codex:one',
        currentEvidence: 'direct-environment',
      }),
    ]);
  });

  test('deduplicates identical provider records without selecting the most recent copy', async () => {
    const duplicate = transcriptCandidate('codex', 'same', '/repo/source', {
      mtime: 7,
    });
    const deps = dependencies({ codex: [duplicate, { ...duplicate }] });

    const result = await discoverHandoffCandidates('/repo/source', { deps });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ key: 'codex:same', modifiedAtMs: 7_000 });
  });

  test('projects shared epoch-second mtimes to the millisecond schema contract', async () => {
    const deps = dependencies({
      codex: [
        transcriptCandidate('codex', 'timestamp', '/repo/source', {
          mtime: 1_700_000_123,
        }),
      ],
    });

    const [candidate] = await discoverHandoffCandidates('/repo/source', {
      deps,
    });

    expect(candidate.modifiedAtMs).toBe(1_700_000_123_000);
  });

  test('refuses conflicting duplicates and incomplete provider discovery', async () => {
    const conflictDeps = dependencies({
      codex: [
        transcriptCandidate('codex', 'same', '/repo/source', { size: 10 }),
        transcriptCandidate('codex', 'same', '/repo/source', { size: 11 }),
      ],
    });
    await expect(
      discoverHandoffCandidates('/repo/source', { deps: conflictDeps }),
    ).rejects.toMatchObject({
      code: 'discovery-incomplete',
      provider: 'codex',
    });

    const incompleteDeps = dependencies({});
    incompleteDeps.discover = vi.fn(async () => {
      throw new Error(
        'DISCOVERY_ENTRY_BUDGET_EXCEEDED /private/provider/secret.jsonl',
      );
    });
    await expect(
      discoverHandoffCandidates('/repo/source', { deps: incompleteDeps }),
    ).rejects.toEqual(
      new HandoffDiscoveryError('discovery-incomplete', 'claude'),
    );
  });

  test.each(['null', 'throw'] as const)(
    'refuses the complete set when discovered cwd canonicalization returns %s',
    async (failureMode) => {
      const deps = dependencies({
        codex: [
          transcriptCandidate('codex', 'valid', '/repo/source'),
          transcriptCandidate('codex', 'unclassifiable', '/repo/vanished'),
        ],
      });
      deps.canonicalize = vi.fn(async (path) => {
        if (path === '/repo/source') return '/repo/source';
        if (failureMode === 'throw') {
          throw new Error('/private/provider/secret.jsonl');
        }
        return null;
      });

      await expect(
        discoverHandoffCandidates('/repo/source', { deps }),
      ).rejects.toMatchObject({
        code: 'discovery-incomplete',
        provider: 'codex',
      });
    },
  );

  test('refuses the complete set when a discovered candidate has no recorded cwd', async () => {
    const deps = dependencies({
      codex: [
        transcriptCandidate('codex', 'valid', '/repo/source'),
        transcriptCandidate('codex', 'unclassifiable', '/repo/source', {
          recordedCwd: null,
        }),
      ],
    });

    await expect(
      discoverHandoffCandidates('/repo/source', { deps }),
    ).rejects.toMatchObject({
      code: 'discovery-incomplete',
      provider: 'codex',
    });
  });

  test('refuses invalid projected candidate fields instead of returning a partial set', async () => {
    const deps = dependencies({
      codex: [
        transcriptCandidate('codex', 'valid', '/repo/source'),
        transcriptCandidate('codex', '', '/repo/source'),
      ],
    });

    await expect(
      discoverHandoffCandidates('/repo/source', { deps }),
    ).rejects.toMatchObject({
      code: 'discovery-incomplete',
      provider: 'codex',
    });
  });
});
