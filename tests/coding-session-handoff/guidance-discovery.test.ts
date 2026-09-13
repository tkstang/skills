import { describe, expect, it, vi } from 'vitest';

import {
  discoverGuidanceCandidates,
  selectCurrentGuidanceCandidate,
  selectGuidanceCandidate,
  type GuidanceDiscoveryDependencies,
} from '../../src/transcript/coding-session-handoff/guidance-discovery.js';
import { sanitizePreviewConversationEntries } from '../../src/transcript/coding-session-handoff/preview.js';
import type { TranscriptCandidate } from '../../src/transcript/session-observer/lib/types.js';

function transcript(
  runtime: 'claude-code' | 'codex' | 'cursor',
  sessionId: string,
  overrides: Partial<TranscriptCandidate> = {},
): TranscriptCandidate {
  return {
    runtime,
    transcriptPath: `/private/${runtime}/${sessionId}.jsonl`,
    sessionId,
    recordedCwd: '/repo/source',
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
  byRuntime: Partial<
    Record<'claude-code' | 'codex' | 'cursor', TranscriptCandidate[]>
  >,
): GuidanceDiscoveryDependencies {
  return {
    canonicalize: async (path) =>
      ({ '/alias/source': '/repo/source', '/repo/source': '/repo/source' })[
        path
      ] ?? null,
    discover: vi.fn(async (runtime, _cwd, _cache, options) => {
      expect(options).toMatchObject({
        persistence: 'forbid',
        recency: 'exact-all',
      });
      return byRuntime[runtime as 'claude-code' | 'codex' | 'cursor'] ?? [];
    }),
    readCodexNativeId: async (candidate) => `native-${candidate.sessionId}`,
  };
}

describe('guidance discovery', () => {
  it('discovers all three providers without widening the old executor types', async () => {
    const deps = dependencies({
      'claude-code': [transcript('claude-code', 'same-id')],
      codex: [transcript('codex', 'same-id')],
      cursor: [
        transcript('cursor', 'same-id', {
          cwdEvidence: 'store-metadata',
          cwdEvidenceQuality: 'independent-exact',
        }),
      ],
    });

    const result = await discoverGuidanceCandidates('/alias/source', { deps });

    expect(result.map(({ key }) => key)).toEqual([
      'claude:cli:same-id',
      'codex:cli:native-same-id',
      'cursor:ambiguous:same-id',
    ]);
    expect(result.at(-1)).toMatchObject({
      provider: 'cursor',
      surface: 'ambiguous',
      originEvidence: 'store-origin-ambiguous',
    });
    expect(JSON.stringify(result)).not.toContain('/private/');
  });

  it('selects current only when direct identity is corroborated by one exact candidate', async () => {
    const candidates = await discoverGuidanceCandidates('/repo/source', {
      deps: dependencies({ codex: [transcript('codex', 'one')] }),
    });

    expect(
      selectCurrentGuidanceCandidate(candidates, {
        provider: 'codex',
        surface: 'cli',
        nativeId: 'native-one',
        evidence: 'direct-environment',
      }),
    ).toMatchObject({ key: 'codex:cli:native-one' });
    expect(
      selectCurrentGuidanceCandidate(candidates, {
        provider: 'codex',
        surface: 'cli',
        nativeId: 'missing',
        evidence: 'direct-environment',
      }),
    ).toBeNull();
  });

  it('requires explicit selection for absent, ambiguous, and IDE/CLI-ambiguous identity', async () => {
    const candidates = await discoverGuidanceCandidates('/repo/source', {
      deps: dependencies({
        cursor: [
          transcript('cursor', 'cursor-one', {
            cwdEvidence: 'store-metadata',
            cwdEvidenceQuality: 'independent-exact',
          }),
        ],
      }),
    });

    expect(selectCurrentGuidanceCandidate(candidates)).toBeNull();
    expect(
      selectCurrentGuidanceCandidate(candidates, {
        provider: 'cursor',
        surface: 'cli',
        nativeId: 'cursor-one',
        evidence: 'explicit-self',
      }),
    ).toBeNull();
    expect(
      selectGuidanceCandidate(candidates, 'cursor:ambiguous:cursor-one'),
    ).toMatchObject({
      nativeId: 'cursor-one',
    });
  });

  it('rejects caller-derived Cursor cwd association before returning candidates', async () => {
    const deps = dependencies({
      cursor: [
        transcript('cursor', 'lossy-source', {
          cwdEvidence: 'direct-parent-dir',
          cwdEvidenceQuality: 'caller-derived-lossy',
        }),
      ],
    });

    await expect(
      discoverGuidanceCandidates('/repo/source', {
        providers: ['cursor'],
        deps,
      }),
    ).rejects.toMatchObject({
      name: 'GuidanceDiscoveryError',
      code: 'discovery-incomplete',
      provider: 'cursor',
    });
  });

  it('sanitizes Cursor preview records through the shared preview seam', () => {
    expect(
      sanitizePreviewConversationEntries('cursor', [
        {
          role: 'user',
          text: '<environment_context>hidden</environment_context>',
          kind: 'message',
        },
        {
          role: 'assistant',
          text: 'tool',
          kind: 'tool_call',
          toolName: 'shell',
        },
        { role: 'user', text: 'hello', kind: 'message' },
        { role: 'assistant', text: 'hi', kind: 'message' },
      ] as never),
    ).toEqual([
      { role: 'user', text: 'hello' },
      { role: 'assistant', text: 'hi' },
    ]);
  });

  it('returns discovery-incomplete without exposing candidates collected before a Cursor failure', async () => {
    const deps = dependencies({
      codex: [transcript('codex', 'would-be-partial')],
    });
    vi.mocked(deps.discover).mockImplementation(
      async (runtime, _cwd, _cache, options) => {
        expect(options).toMatchObject({
          persistence: 'forbid',
          recency: 'exact-all',
        });
        if (runtime === 'cursor') {
          throw Object.assign(new Error('incomplete Cursor store'), {
            code: 'IDENTITY_INDEX_INCOMPLETE',
          });
        }
        return runtime === 'codex'
          ? [transcript('codex', 'would-be-partial')]
          : [];
      },
    );

    await expect(
      discoverGuidanceCandidates('/repo/source', { deps }),
    ).rejects.toMatchObject({
      name: 'GuidanceDiscoveryError',
      code: 'discovery-incomplete',
      provider: 'cursor',
    });
  });
});
