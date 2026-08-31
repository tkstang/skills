import { describe, expect, test, vi } from 'vitest';

import {
  HandoffPreviewError,
  previewHandoffCandidates,
  type HandoffPreviewDependencies,
  type PreviewSource,
} from '../../src/transcript/coding-session-handoff/preview.js';
import type {
  DigestEntry,
  JsonObject,
} from '../../src/transcript/core/runtimes.js';

function entry(
  role: 'user' | 'assistant',
  text: string,
  overrides: Partial<DigestEntry> = {},
): JsonObject {
  return {
    role,
    text,
    recordIndex: 0,
    kind: 'message',
    ...overrides,
  };
}

function source(
  key: `codex:${string}` | `claude:${string}`,
  entries: JsonObject[],
  size = 100,
): PreviewSource & { fixtureEntries: JsonObject[] } {
  const [provider, nativeId] = key.split(':', 2) as [
    'codex' | 'claude',
    string,
  ];
  return {
    candidate: {
      key,
      provider,
      nativeId,
      recordedCwd: '/repo/source',
      modifiedAtMs: 1,
      size,
      engagement: 'engaged',
      currentEvidence: 'none',
    },
    runtime: provider === 'codex' ? 'codex' : 'claude-code',
    transcriptPath: `/private/transcripts/${nativeId}.jsonl`,
    fixtureEntries: entries,
  };
}

function dependencies(
  options: {
    now?: () => number;
    diagnosticCode?: string;
    bytesRead?: number;
    recordsInspected?: number;
    onNormalize?: () => void;
  } = {},
) {
  const byPath = new Map<string, JsonObject[]>();
  const deps: HandoffPreviewDependencies = {
    now: options.now ?? (() => 0),
    readTailRecordsBounded: vi.fn(async (path, readOptions) => {
      if (options.diagnosticCode) {
        readOptions.diagnostic({
          code: options.diagnosticCode as 'malformed-record',
        });
      }
      const records = byPath.get(path) ?? [];
      return {
        records,
        truncated: false,
        bytesRead: options.bytesRead ?? 1,
        recordsInspected: options.recordsInspected ?? records.length,
      };
    }),
    normalizeEntries: (_runtime, records) => {
      options.onNormalize?.();
      return records as unknown as DigestEntry[];
    },
  };
  return {
    deps,
    register(sources: (PreviewSource & { fixtureEntries: JsonObject[] })[]) {
      for (const item of sources)
        byPath.set(item.transcriptPath, item.fixtureEntries);
    },
  };
}

describe('bounded sanitized session preview', () => {
  test('filters tool/control/hidden entries and emits only user/assistant conversation', async () => {
    const sources = [
      source('codex:one', [
        entry(
          'user',
          '<environment_context>secret system path</environment_context>',
        ),
        entry('assistant', 'tool call', {
          kind: 'tool_call',
          toolName: 'shell',
        }),
        entry('user', 'automatic metadata', { origin: 'automatic-control' }),
        entry('user', 'hello'),
        entry('assistant', 'hi'),
      ]),
    ];
    const fixture = dependencies();
    fixture.register(sources);

    const result = await previewHandoffCandidates(sources, {
      deps: fixture.deps,
    });

    expect(result).toEqual([
      {
        key: 'codex:one',
        rounds: [
          [
            { role: 'user', text: 'hello' },
            { role: 'assistant', text: 'hi' },
          ],
        ],
        truncated: false,
        omittedEntries: 0,
        warning: 'hidden-payload-sanitized-not-secret-free',
      },
    ]);
  });

  test('orders candidates by qualified key and keeps only the newest configured rounds', async () => {
    const sources = [
      source('codex:z', [
        entry('user', 'old'),
        entry('assistant', 'old answer'),
        entry('user', 'new'),
      ]),
      source('claude:a', [entry('user', 'claude')]),
    ];
    const fixture = dependencies();
    fixture.register(sources);

    const result = await previewHandoffCandidates(sources, {
      deps: fixture.deps,
      sessionLimits: { maxRounds: 1, maxCharacters: 100 },
    });

    expect(result.map(({ key }) => key)).toEqual(['claude:a', 'codex:z']);
    expect(result[1]).toMatchObject({
      rounds: [[{ role: 'user', text: 'new' }]],
      truncated: true,
      omittedEntries: 2,
    });
  });

  test('enforces per-candidate character bounds before returning preview text', async () => {
    const sources = [
      source('codex:one', [
        entry('user', '12345'),
        entry('assistant', '67890'),
      ]),
    ];
    const fixture = dependencies();
    fixture.register(sources);

    const [result] = await previewHandoffCandidates(sources, {
      deps: fixture.deps,
      sessionLimits: { maxRounds: 3, maxCharacters: 6 },
    });

    expect(
      result.rounds.flat().reduce((sum, item) => sum + item.text.length, 0),
    ).toBe(6);
    expect(result.truncated).toBe(true);
  });

  test('rejects 21 candidates before reading any transcript', async () => {
    const sources = Array.from({ length: 21 }, (_, index) =>
      source(`codex:${String(index).padStart(2, '0')}`, [
        entry('user', 'hello'),
      ]),
    );
    const fixture = dependencies();
    fixture.register(sources);

    await expect(
      previewHandoffCandidates(sources, { deps: fixture.deps }),
    ).rejects.toMatchObject({
      code: 'preview-incomplete',
      reason: 'candidate-limit',
    });
    expect(fixture.deps.readTailRecordsBounded).not.toHaveBeenCalled();
  });

  test.each([
    ['aggregate-input-bytes', { maxAggregateInputBytes: 1 }],
    ['aggregate-input-records', { maxAggregateInputRecords: 1 }],
    ['aggregate-rendered-characters', { maxAggregateRenderedCharacters: 3 }],
  ] as const)(
    'fails the complete batch on %s crossing',
    async (reason, batchOverride) => {
      const sources = [
        source('codex:a', [entry('user', 'one')], 1),
        source('codex:b', [entry('user', 'two')], 1),
      ];
      const fixture = dependencies();
      fixture.register(sources);

      await expect(
        previewHandoffCandidates(sources, {
          deps: fixture.deps,
          batchLimits: {
            maxCandidates: 20,
            maxAggregateInputBytes: 33_554_432,
            maxAggregateInputRecords: 100_000,
            deadlineMs: 10_000,
            maxAggregateRenderedCharacters: 131_072,
            ...batchOverride,
          },
        }),
      ).rejects.toMatchObject({ code: 'preview-incomplete', reason });
    },
  );

  test('debits current read bytes rather than stale discovery size', async () => {
    const sources = [source('codex:a', [entry('user', 'one')], 0)];
    const fixture = dependencies({ bytesRead: 2 });
    fixture.register(sources);

    await expect(
      previewHandoffCandidates(sources, {
        deps: fixture.deps,
        batchLimits: {
          maxCandidates: 20,
          maxAggregateInputBytes: 1,
          maxAggregateInputRecords: 100_000,
          deadlineMs: 10_000,
          maxAggregateRenderedCharacters: 131_072,
        },
      }),
    ).rejects.toMatchObject({
      code: 'preview-incomplete',
      reason: 'aggregate-input-bytes',
    });
  });

  test('debits every inspected record including records not retained by the reader', async () => {
    const sources = [source('codex:a', [entry('user', 'retained')])];
    const fixture = dependencies({ recordsInspected: 2 });
    fixture.register(sources);

    await expect(
      previewHandoffCandidates(sources, {
        deps: fixture.deps,
        batchLimits: {
          maxCandidates: 20,
          maxAggregateInputBytes: 33_554_432,
          maxAggregateInputRecords: 1,
          deadlineMs: 10_000,
          maxAggregateRenderedCharacters: 131_072,
        },
      }),
    ).rejects.toMatchObject({
      code: 'preview-incomplete',
      reason: 'aggregate-input-records',
    });
  });

  test('fails the complete batch when the aggregate deadline crosses', async () => {
    const clock = [0, 0, 10_000];
    const sources = [source('codex:a', [entry('user', 'one')])];
    const fixture = dependencies({ now: () => clock.shift() ?? 10_000 });
    fixture.register(sources);

    await expect(
      previewHandoffCandidates(sources, { deps: fixture.deps }),
    ).rejects.toMatchObject({
      code: 'preview-incomplete',
      reason: 'deadline',
    });
  });

  test('fails when normalization or rendering crosses the deadline', async () => {
    let time = 0;
    const sources = [source('codex:a', [entry('user', 'one')])];
    const fixture = dependencies({
      now: () => time,
      onNormalize: () => {
        time = 10_000;
      },
    });
    fixture.register(sources);

    await expect(
      previewHandoffCandidates(sources, { deps: fixture.deps }),
    ).rejects.toMatchObject({
      code: 'preview-incomplete',
      reason: 'deadline',
    });
  });

  test('checks the aggregate deadline once more before returning', async () => {
    const clock = [0, 0, 0, 0, 10_000];
    const sources = [source('codex:a', [entry('user', 'one')])];
    const fixture = dependencies({
      now: () => clock.shift() ?? 10_000,
    });
    fixture.register(sources);

    await expect(
      previewHandoffCandidates(sources, { deps: fixture.deps }),
    ).rejects.toMatchObject({
      code: 'preview-incomplete',
      reason: 'deadline',
    });
  });

  test.each(['malformed-record', 'oversized-record', 'read-failed'] as const)(
    'returns a path-free failure for %s diagnostics',
    async (diagnosticCode) => {
      const sources = [source('codex:one', [entry('user', 'hello')])];
      const fixture = dependencies({ diagnosticCode });
      fixture.register(sources);

      let caught: unknown;
      try {
        await previewHandoffCandidates(sources, { deps: fixture.deps });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(HandoffPreviewError);
      expect(caught).toMatchObject({
        code: 'preview-incomplete',
        key: 'codex:one',
        reason: `transcript-${diagnosticCode.replace('-record', '')}`,
      });
      expect(JSON.stringify(caught)).not.toContain('/private/transcripts/');
    },
  );
});
