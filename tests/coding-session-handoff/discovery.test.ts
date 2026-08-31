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
    expect(result[0]).toMatchObject({ key: 'codex:same', modifiedAtMs: 7 });
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
