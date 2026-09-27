/**
 * digest.test.ts — Tests for src/skills/session-observer/src/lib/digest.ts
 */

import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, 'fixtures');
const typicalClaude = join(FIXTURES, 'claude-code', 'typical.jsonl');
const withToolBurst = join(FIXTURES, 'claude-code', 'with-tool-burst.jsonl');
const queuedMidTurnClaude = join(
  FIXTURES,
  'claude-code',
  'queued-mid-turn.jsonl',
);
const queuedAttachmentOnlyClaude = join(
  FIXTURES,
  'claude-code',
  'queued-attachment-only.jsonl',
);
const typicalCursor = join(FIXTURES, 'cursor', 'typical.jsonl');

import { createCursorTurnAccumulator } from '../../../shared/transcript/cursor-analysis.js';
import { scanCursorTranscript } from '../../../shared/transcript/cursor-frames.js';
import { readRecordsDetailed } from '../../../shared/transcript/runtimes.js';
import { buildDigest, renderMarkdown } from './lib/digest.js';
import type {
  CursorIdentityEvidence,
  CursorSessionStateEntry,
} from './lib/types.js';

async function cursorDigestAnalysis(
  transcriptPath: string,
  fromFrameIndex = 0,
) {
  const identity = {
    runtime: 'cursor',
    sessionId: 'cursor-digest-behavior',
    projectCwd: '/synthetic/project',
    canonicalCwd: '/synthetic/project',
    canonicalTranscriptPath: transcriptPath,
    cwdEvidence: ['direct-project-root'],
    sessionEvidence: ['explicit-pin'],
    strength: 'exact',
    reasons: [],
  } satisfies CursorIdentityEvidence;
  const accumulator = createCursorTurnAccumulator(identity, fromFrameIndex);
  const scan = await scanCursorTranscript(transcriptPath, {
    onFrame(frame) {
      accumulator.onFrame(frame);
    },
  });

  return {
    identity,
    scan,
    analysis: accumulator.finish(scan),
  };
}

function cursorDigestState(
  transcriptPath: string,
  context: Awaited<ReturnType<typeof cursorDigestAnalysis>>,
  overrides: Partial<CursorSessionStateEntry> = {},
): CursorSessionStateEntry {
  return {
    runtime: 'cursor',
    sessionId: context.identity.sessionId,
    indexBase: 'zero-based-jsonl-frame-index',
    lastRecordIndex: 0,
    canonicalCwd: context.identity.canonicalCwd,
    transcriptPath,
    continuity: {
      indexBase: 'zero-based-jsonl-frame-index',
      nextFrameIndex: 0,
      prefixBytes: 0,
      prefixSha256:
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      observedSize: context.scan.file.size,
      device: context.scan.file.device,
      inode: context.scan.file.inode,
    },
    lastStatus: {
      engagement: 'unknown',
      activity: 'none',
      content: 'none',
      lifecycle: 'none',
      delivery: 'none',
      health: 'healthy',
    },
    openTurn: null,
    stabilityCandidate: null,
    pendingDelivery: null,
    ...overrides,
  };
}

function cursorDigestOptions(
  context: Awaited<ReturnType<typeof cursorDigestAnalysis>>,
  projection: 'observation' | 'confirmed-completion',
  state: CursorSessionStateEntry | null = null,
) {
  return {
    fromIndex: 0,
    mode: 'catch-up' as const,
    cursorProjection: projection,
    cursorIdentity: context.identity,
    cursorScan: context.scan,
    cursorAnalysis: context.analysis,
    cursorState: state,
    cursorContinuity: 'new' as const,
  };
}

// ---------------------------------------------------------------------------
// Cursor digest v2 behavior
// ---------------------------------------------------------------------------

describe('Cursor digest v2 behavior', () => {
  test('includes open-frame calls only in stateless review activity', async () => {
    const transcriptPath = join(FIXTURES, 'cursor', 'unterminated.jsonl');
    const context = await cursorDigestAnalysis(transcriptPath);
    const digest = await buildDigest('cursor', transcriptPath, {
      ...cursorDigestOptions(context, 'observation'),
      mode: 'review',
      includeActivity: true,
      activityRenderFormat: 'markdown',
      cursorCapturedAt: '2026-09-19T12:00:00.000Z',
    });

    expect(digest.activity).toMatchObject({
      mode: 'review',
      deliveryRange: {
        indexBase: 'zero-based-jsonl-frame-index',
        start: 0,
        end: 3,
      },
      counts: {
        capturedSource: { calls: 1, pendingLifecycleCalls: 1 },
        deliveredRange: { calls: 1, pendingLifecycleCalls: 1 },
        displayed: { calls: 1, pendingLifecycleCalls: 1 },
      },
      events: [
        {
          nativeName: 'shell',
          outcome: 'unknown',
          lifecycleAvailability: 'pending-lifecycle',
          turnOutcome: 'pending',
          locator: {
            sourceFrameIndex: 2,
            recordIndex: 2,
          },
        },
      ],
    });
    expect(renderMarkdown(digest)).toContain('pending lifecycle 1');
  });

  test('delivers settled calls at the terminal checkpoint without replay', async () => {
    const transcriptPath = join(FIXTURES, 'cursor', 'terminal-success.jsonl');
    const context = await cursorDigestAnalysis(transcriptPath);
    const turn = context.analysis.turns[0]!;
    const observedState = cursorDigestState(transcriptPath, context, {
      lastRecordIndex: 5,
      openTurn: {
        turnId: turn.turnId,
        fromFrameIndex: 0,
        observedThroughFrame: 4,
        deliveredEntryKeys: turn.assistantRecords.map(
          (record) => record.entryKey,
        ),
        assistantEntryKeys: turn.assistantRecords.map(
          (record) => record.entryKey,
        ),
        humanRecordIndexes: turn.humanRecordIndexes,
        toolRecordIndexes: turn.toolRecordIndexes,
        hasHumanInput: true,
        hasAutomaticControlInput: false,
        lifecycle: 'pending',
      },
    });
    const first = await buildDigest('cursor', transcriptPath, {
      ...cursorDigestOptions(context, 'observation', observedState),
      fromIndex: 5,
      includeActivity: true,
      cursorActivityDeliveryRange: {
        indexBase: 'zero-based-jsonl-frame-index',
        start: 0,
        end: 6,
      },
    });
    const repeat = await buildDigest('cursor', transcriptPath, {
      ...cursorDigestOptions(context, 'observation', observedState),
      fromIndex: 6,
      includeActivity: true,
      cursorActivityDeliveryRange: {
        indexBase: 'zero-based-jsonl-frame-index',
        start: 6,
        end: 6,
      },
    });

    expect(first.entries).toEqual([]);
    expect(first.activity).toMatchObject({
      deliveryRange: { start: 0, end: 6 },
      counts: { deliveredRange: { calls: 1, pendingLifecycleCalls: 0 } },
      events: [
        {
          nativeName: 'read_file',
          outcome: 'unknown',
          lifecycleAvailability: 'settled',
          turnOutcome: 'success',
          locator: {
            sourceFrameIndex: 2,
            deliveryFrameIndex: 5,
            recordIndex: 5,
          },
        },
      ],
    });
    expect(repeat.activity?.events).toEqual([]);
    expect(repeat.activity?.counts.deliveredRange.calls).toBe(0);
  });

  test('bounds maxTurns by structural Cursor turn identity', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cursor-digest-max-turns-'));
    try {
      const transcriptPath = join(tmpDir, 'max-turns.jsonl');
      await writeFile(
        transcriptPath,
        [
          { role: 'user', message: { content: 'Synthetic first direction.' } },
          {
            role: 'assistant',
            message: { content: 'Synthetic first answer.' },
          },
          { type: 'turn_ended', status: 'success' },
          { role: 'user', message: { content: 'Synthetic second direction.' } },
          {
            role: 'assistant',
            message: { content: 'Synthetic second answer.' },
          },
          { type: 'turn_ended', status: 'success' },
        ]
          .map((record) => JSON.stringify(record))
          .join('\n') + '\n',
      );
      const context = await cursorDigestAnalysis(transcriptPath);

      const digest = await buildDigest('cursor', transcriptPath, {
        ...cursorDigestOptions(context, 'confirmed-completion'),
        maxTurns: 1,
      });

      expect(digest.entries.map((entry) => entry.text)).toEqual([
        'Synthetic second answer.',
      ]);
      expect(new Set(digest.entries.map((entry) => entry.turnId))).toEqual(
        new Set([context.analysis.turns[1]!.turnId]),
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('bounds a long terminal-delimited Cursor run by user render groups', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cursor-digest-user-groups-'));
    try {
      const transcriptPath = join(tmpDir, 'user-groups.jsonl');
      const exchanges = Array.from({ length: 20 }, (_, index) => [
        {
          role: 'user',
          message: { content: `Synthetic direction ${index}.` },
        },
        {
          role: 'assistant',
          message: {
            content: `Synthetic answer ${index}. ${'x'.repeat(200)}`,
          },
        },
      ]).flat();
      await writeFile(
        transcriptPath,
        [...exchanges, { type: 'turn_ended', status: 'success' }]
          .map((record) => JSON.stringify(record))
          .join('\n') + '\n',
      );
      const context = await cursorDigestAnalysis(transcriptPath);

      const digest = await buildDigest('cursor', transcriptPath, {
        ...cursorDigestOptions(context, 'observation'),
        maxTurns: 4,
      });
      const markdown = renderMarkdown(digest);

      expect(digest.entries.map((entry) => entry.text)).toEqual(
        [16, 17, 18, 19].map(
          (index) => `Synthetic answer ${index}. ${'x'.repeat(200)}`,
        ),
      );
      expect(
        new Set(digest.entries.map((entry) => entry.turnId)),
      ).toHaveProperty('size', 1);
      expect(
        new Set(digest.entries.map((entry) => entry.renderTurnId)),
      ).toHaveProperty('size', 4);
      expect(digest.accounting.recovery.omittedUserMessages).toHaveLength(4);
      expect(digest.accounting.recovery.omittedAssistantEntries).toHaveLength(
        0,
      );
      expect(markdown).not.toContain('Synthetic answer 15.');
      expect(markdown.length).toBeLessThan(6_000);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('projects confirmed open-turn content with frame accounting and truthful pending status', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cursor-digest-pending-'));
    try {
      const transcriptPath = join(tmpDir, 'pending.jsonl');
      await writeFile(
        transcriptPath,
        [
          { role: 'user', message: { content: 'Synthetic direction.' } },
          {
            role: 'assistant',
            message: {
              content: [
                { type: 'text', text: 'Synthetic stable observation.' },
              ],
            },
          },
          { type: 'tool_metadata', tool: 'synthetic-tool' },
        ]
          .map((record) => JSON.stringify(record))
          .join('\n') + '\n',
      );
      const context = await cursorDigestAnalysis(transcriptPath);
      const turn = context.analysis.turns[0]!;
      const entryKey = turn.assistantRecords[0]!.entryKey;
      const state = cursorDigestState(transcriptPath, context, {
        stabilityCandidate: {
          turnId: turn.turnId,
          fromFrameIndex: 1,
          throughFrameIndex: 1,
          entryKeys: [entryKey],
          prefixBytes: context.scan.safePrefixBytes,
          prefixSha256: context.scan.safePrefixSha256,
          firstObservedAt: '2026-07-23T00:00:00.000Z',
          confirmAfter: '2026-07-23T00:00:01.000Z',
          confirmedAt: '2026-07-23T00:00:01.000Z',
        },
      });

      const digest = await buildDigest(
        'cursor',
        transcriptPath,
        cursorDigestOptions(context, 'observation', state),
      );

      expect(digest).toMatchObject({
        schemaVersion: 2,
        runtime: 'cursor',
        range: {
          indexBase: 'zero-based-jsonl-frame-index',
          fromIndex: 0,
          toIndex: 2,
          nextIndex: 3,
          totalFrames: 3,
          newFrames: 3,
        },
        accounting: {
          indexBase: 'zero-based-jsonl-frame-index',
          raw: { count: 3, nextIndex: 3, totalFrames: 3 },
          rendered: { count: 1, fromIndex: 1, toIndex: 1 },
          filtered: { metadataFrames: 1, unstableContent: 0 },
          buffered: { fromIndex: null, count: 0, reason: null },
        },
        cursorEvidence: {
          projection: 'observation',
          continuity: 'new',
          status: {
            engagement: 'engaged',
            activity: 'assistant-progress',
            content: 'available',
            lifecycle: 'pending',
            delivery: 'none',
            health: 'healthy',
          },
          lifecycleEvents: [],
          bufferedFromFrame: null,
          blockingFrame: null,
        },
      });
      expect(digest.entries).toEqual([
        expect.objectContaining({
          role: 'assistant',
          text: 'Synthetic stable observation.',
          recordIndex: 1,
          sourceFrameIndex: 1,
          entryKey,
          turnId: turn.turnId,
          availability: 'pending-lifecycle',
        }),
      ]);
      expect(digest.accounting.recovery.omittedUserMessages).toEqual([
        {
          transcriptPath,
          indexBase: 'zero-based-jsonl-frame-index',
          frameIndex: 0,
          entryKey: `${turn.turnId}:frame:0:user`,
        },
      ]);

      const markdown = renderMarkdown(digest);
      expect(markdown).toContain('**content:** available');
      expect(markdown).toContain('**lifecycle:** pending');
      expect(markdown).toContain('**health:** healthy');
      expect(markdown.match(/Synthetic stable observation\./g)).toHaveLength(1);
      expect(JSON.parse(JSON.stringify(digest, null, 2))).toEqual(digest);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('retains an open turn for completion while observation waits for stability', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cursor-digest-buffered-'));
    try {
      const transcriptPath = join(tmpDir, 'buffered.jsonl');
      await writeFile(
        transcriptPath,
        [
          { role: 'user', message: { content: 'Synthetic direction.' } },
          {
            role: 'assistant',
            message: {
              content: [
                { type: 'text', text: 'Synthetic unconfirmed observation.' },
              ],
            },
          },
        ]
          .map((record) => JSON.stringify(record))
          .join('\n') + '\n',
      );
      const context = await cursorDigestAnalysis(transcriptPath);

      const observation = await buildDigest(
        'cursor',
        transcriptPath,
        cursorDigestOptions(context, 'observation'),
      );
      const completion = await buildDigest(
        'cursor',
        transcriptPath,
        cursorDigestOptions(context, 'confirmed-completion'),
      );

      for (const digest of [observation, completion]) {
        expect(digest.schemaVersion).toBe(2);
        expect(digest.entries).toEqual([]);
        expect(digest.cursorEvidence.status).toMatchObject({
          content: 'buffered',
          lifecycle: 'pending',
          health: 'healthy',
        });
      }
      expect(observation.range.nextIndex).toBe(1);
      expect(observation.accounting.buffered).toEqual({
        fromIndex: 1,
        count: 1,
        reason: 'stability-wait',
      });
      expect(observation.accounting.filtered.unstableContent).toBe(1);
      expect(completion.range.nextIndex).toBe(0);
      expect(completion.accounting.buffered).toEqual({
        fromIndex: 0,
        count: 2,
        reason: 'stability-wait',
      });
      expect(completion.cursorEvidence.projection).toBe('confirmed-completion');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('separates terminal reconciliation from completion projection and retains recovery pointers', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cursor-digest-success-'));
    try {
      const transcriptPath = join(tmpDir, 'success.jsonl');
      await writeFile(
        transcriptPath,
        [
          { role: 'user', message: { content: 'Synthetic direction.' } },
          {
            role: 'assistant',
            message: {
              content: [{ type: 'text', text: 'Synthetic earlier result.' }],
            },
          },
          {
            role: 'assistant',
            message: {
              content: [{ type: 'text', text: 'Synthetic final result.' }],
            },
          },
          { type: 'turn_ended', status: 'success' },
        ]
          .map((record) => JSON.stringify(record))
          .join('\n') + '\n',
      );
      const context = await cursorDigestAnalysis(transcriptPath);
      const turn = context.analysis.turns[0]!;
      const [earlier, final] = turn.assistantRecords;
      const observedState = cursorDigestState(transcriptPath, context, {
        openTurn: {
          turnId: turn.turnId,
          fromFrameIndex: 0,
          observedThroughFrame: 2,
          deliveredEntryKeys: [earlier!.entryKey, final!.entryKey],
          assistantEntryKeys: [earlier!.entryKey, final!.entryKey],
          humanRecordIndexes: [0],
          toolRecordIndexes: [],
          hasHumanInput: true,
          hasAutomaticControlInput: false,
          lifecycle: 'pending',
        },
      });

      const observation = await buildDigest(
        'cursor',
        transcriptPath,
        cursorDigestOptions(context, 'observation', observedState),
      );
      const completion = await buildDigest(
        'cursor',
        transcriptPath,
        cursorDigestOptions(context, 'confirmed-completion', observedState),
      );

      expect(observation.entries).toEqual([]);
      expect(observation.cursorEvidence.lifecycleEvents).toEqual([
        {
          turnId: turn.turnId,
          terminalFrameIndex: 3,
          lifecycle: 'success',
          finalEntryKey: final!.entryKey,
          contentPreviouslyObservable: true,
        },
      ]);
      expect(observation.cursorEvidence.status).toMatchObject({
        content: 'none',
        lifecycle: 'success',
      });

      expect(completion.entries).toEqual([
        expect.objectContaining({
          text: 'Synthetic final result.',
          recordIndex: 3,
          sourceFrameIndex: 2,
          entryKey: final!.entryKey,
          availability: 'completed',
        }),
      ]);
      expect(completion.accounting.recovery.omittedAssistantEntries).toEqual([
        {
          transcriptPath,
          indexBase: 'zero-based-jsonl-frame-index',
          frameIndex: 1,
          entryKey: earlier!.entryKey,
        },
      ]);
      expect(completion.range.nextIndex).toBe(4);

      const terminalOnlyContext = await cursorDigestAnalysis(transcriptPath, 3);
      const reconciliation = await buildDigest('cursor', transcriptPath, {
        ...cursorDigestOptions(
          terminalOnlyContext,
          'observation',
          observedState,
        ),
        fromIndex: 3,
      });
      expect(reconciliation.entries).toEqual([]);
      expect(reconciliation.range).toMatchObject({
        fromIndex: 3,
        toIndex: 3,
        nextIndex: 4,
        newFrames: 1,
      });
      expect(reconciliation.cursorEvidence.status).toMatchObject({
        engagement: 'engaged',
        activity: 'assistant-progress',
        lifecycle: 'success',
      });
      expect(reconciliation.cursorEvidence.lifecycleEvents).toEqual([
        {
          turnId: turn.turnId,
          terminalFrameIndex: 3,
          lifecycle: 'success',
          finalEntryKey: final!.entryKey,
          contentPreviouslyObservable: true,
        },
      ]);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('suppresses non-success prose and reports malformed blocking frames structurally', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cursor-digest-blocked-'));
    try {
      const failedPath = join(tmpDir, 'failed.jsonl');
      await writeFile(
        failedPath,
        [
          { role: 'user', message: { content: 'Synthetic direction.' } },
          {
            role: 'assistant',
            message: {
              content: [{ type: 'text', text: 'Synthetic aborted result.' }],
            },
          },
          { type: 'turn_ended', status: 'aborted' },
        ]
          .map((record) => JSON.stringify(record))
          .join('\n') + '\n',
      );
      const failedContext = await cursorDigestAnalysis(failedPath);
      const failed = await buildDigest(
        'cursor',
        failedPath,
        cursorDigestOptions(failedContext, 'observation'),
      );

      expect(failed.entries).toEqual([]);
      expect(failed.cursorEvidence.status).toMatchObject({
        content: 'suppressed',
        lifecycle: 'aborted',
        health: 'healthy',
      });
      expect(failed.cursorEvidence.lifecycleEvents).toEqual([
        expect.objectContaining({
          terminalFrameIndex: 2,
          lifecycle: 'aborted',
          finalEntryKey: null,
          contentPreviouslyObservable: false,
        }),
      ]);
      expect(failed.warnings.join('\n')).toContain('aborted');
      expect(failed.warnings.join('\n')).not.toContain(
        'Synthetic aborted result.',
      );

      const blockedPath = join(tmpDir, 'blocked.jsonl');
      await writeFile(
        blockedPath,
        `${JSON.stringify({
          role: 'user',
          message: { content: 'Synthetic direction.' },
        })}\n{"malformed":\n${JSON.stringify({
          role: 'assistant',
          message: { content: 'Synthetic unreachable result.' },
        })}\n`,
      );
      const blockedContext = await cursorDigestAnalysis(blockedPath);
      const blocked = await buildDigest(
        'cursor',
        blockedPath,
        cursorDigestOptions(blockedContext, 'observation'),
      );

      expect(blocked.entries).toEqual([]);
      expect(blocked.range).toMatchObject({
        fromIndex: 0,
        toIndex: 0,
        nextIndex: 1,
        totalFrames: 3,
        newFrames: 1,
      });
      expect(blocked.accounting.buffered).toEqual({
        fromIndex: 1,
        count: 2,
        reason: 'malformed',
      });
      expect(blocked.cursorEvidence).toMatchObject({
        status: { content: 'buffered', health: 'blocked' },
        bufferedFromFrame: 1,
        blockingFrame: {
          frameIndex: 1,
          parseState: 'malformed',
        },
      });
      expect(blocked.warnings.join('\n')).not.toContain(
        'Synthetic unreachable result.',
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// buildDigest
// ---------------------------------------------------------------------------

describe('buildDigest', () => {
  test('carries Codex child identity and warns about inherited parent context', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'codex-child-digest-'));
    try {
      const childId = '77777777-aaaa-4777-8777-777777777777';
      const rootId = '88888888-aaaa-4888-8888-888888888888';
      const transcriptPath = join(tmpDir, 'child.jsonl');
      await writeFile(
        transcriptPath,
        [
          {
            type: 'session_meta',
            payload: {
              id: childId,
              session_id: rootId,
              parent_thread_id: rootId,
              cwd: '/workspace/child',
              subagent_history_start_ordinal: 9,
            },
          },
          {
            type: 'response_item',
            ordinal: 9,
            payload: {
              type: 'message',
              role: 'assistant',
              content: 'Child reply',
            },
          },
        ]
          .map((record) => JSON.stringify(record))
          .join('\n') + '\n',
        'utf8',
      );

      const digest = await buildDigest('codex', transcriptPath);
      expect(digest).toMatchObject({
        sessionId: childId,
        nativeSessionId: childId,
        rootSessionId: rootId,
        parentSessionId: rootId,
        subagentHistoryStartOrdinal: 9,
      });
      expect(digest.warnings.join('\n')).toContain(
        'inherited parent context before ordinal 9',
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('labels native Claude task notifications without treating them as human input', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'digest-claude-origin-'));
    try {
      const transcriptPath = join(tmpDir, 'notification.jsonl');
      await writeFile(
        transcriptPath,
        [
          {
            type: 'user',
            sessionId: 'claude-notification',
            origin: { kind: 'task-notification' },
            message: {
              role: 'user',
              content: 'Background task completed with status success.',
            },
          },
          {
            type: 'assistant',
            sessionId: 'claude-notification',
            message: { role: 'assistant', content: 'Result reviewed.' },
          },
        ]
          .map((record) => JSON.stringify(record))
          .join('\n') + '\n',
      );

      const digest = await buildDigest('claude-code', transcriptPath);
      expect(digest.entries[0]).toMatchObject({
        role: 'user',
        kind: 'message',
        origin: 'runtime-notification',
        displayRole: 'runtime-notification',
      });
      expect(digest.engagement).toMatchObject({
        status: 'unengaged',
        genuineUserMessages: 0,
        syntheticUserMessages: 1,
      });
      expect(renderMarkdown(digest)).toContain('### Runtime notification');
      expect(
        JSON.parse(JSON.stringify(digest, null, 2)).entries[0],
      ).toMatchObject({
        origin: 'runtime-notification',
      });
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('keeps default Claude API-error content but accounts watch-only omission once', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'digest-claude-api-error-'));
    try {
      const transcriptPath = join(tmpDir, 'api-error.jsonl');
      await writeFile(
        transcriptPath,
        [
          {
            type: 'assistant',
            sessionId: 'claude-api-error',
            isApiErrorMessage: true,
            message: {
              id: 'api-error-with-body',
              role: 'assistant',
              content: 'private provider body',
            },
          },
          {
            type: 'assistant',
            sessionId: 'claude-api-error',
            isApiErrorMessage: true,
            message: {
              id: 'api-error-empty',
              role: 'assistant',
              content: [],
            },
          },
        ]
          .map((record) => JSON.stringify(record))
          .join('\n') + '\n',
      );

      const defaultDigest = await buildDigest('claude-code', transcriptPath);
      expect(defaultDigest.entries).toContainEqual(
        expect.objectContaining({ text: 'private provider body' }),
      );
      expect(defaultDigest).not.toHaveProperty('terminalEvents');
      expect(defaultDigest.accounting.filtered).not.toHaveProperty(
        'apiErrorRecords',
      );

      const watchDigest = await buildDigest('claude-code', transcriptPath, {
        includeTerminalEvents: true,
      });
      expect(watchDigest.entries).toEqual([]);
      expect(watchDigest.terminalEvents).toHaveLength(2);
      expect(watchDigest.accounting).toMatchObject({
        raw: { count: 2 },
        rendered: { count: 0 },
        filtered: { apiErrorRecords: 2, metadataRecords: 0 },
      });
      expect(renderMarkdown(watchDigest)).toContain(
        'provider API-error records: 2',
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('renders queued Claude input once across review and catch-up digests', async () => {
    for (const mode of ['review', 'catch-up'] as const) {
      const digest = await buildDigest('claude-code', queuedMidTurnClaude, {
        fromIndex: 0,
        mode,
      });
      const queuedEntries = digest.entries.filter(
        (entry: any) => entry.displayRole === 'queued-user',
      );

      expect(queuedEntries).toHaveLength(1);
      expect(queuedEntries[0]).toMatchObject({
        role: 'user',
        text: 'Yes, include the migration guide.',
        recordIndex: 2,
      });

      const markdown = renderMarkdown(digest);
      expect(markdown).toContain('### User (queued mid-turn)');
      expect(
        markdown.match(/Yes, include the migration guide\./g),
      ).toHaveLength(1);

      const json = JSON.parse(JSON.stringify(digest, null, 2));
      expect(json.entries).toContainEqual(
        expect.objectContaining({
          displayRole: 'queued-user',
          text: 'Yes, include the migration guide.',
        }),
      );
    }
  });

  test('renders queued-command attachments when no enqueue record is present', async () => {
    const digest = await buildDigest(
      'claude-code',
      queuedAttachmentOnlyClaude,
      {
        fromIndex: 0,
        mode: 'review',
      },
    );

    expect(digest.entries).toContainEqual(
      expect.objectContaining({
        role: 'user',
        displayRole: 'queued-user',
        text: 'Use the conservative migration path.',
        recordIndex: 1,
      }),
    );
  });

  test('catch-up separates raw records consumed from rendered messages', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'digest-filter-test-'));
    try {
      const transcriptPath = join(tmpDir, 'filtered.jsonl');
      const records = [
        {
          sessionId: 'sess-filtered',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-1',
                name: 'Read',
                input: { file: 'a' },
              },
            ],
          },
        },
        {
          sessionId: 'sess-filtered',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-1',
                content: 'result a',
              },
            ],
          },
        },
        {
          sessionId: 'sess-filtered',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-2',
                name: 'Bash',
                input: { cmd: 'npm test' },
              },
            ],
          },
        },
        {
          sessionId: 'sess-filtered',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-2',
                content: 'result b',
              },
            ],
          },
        },
        {
          sessionId: 'sess-filtered',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'One rendered assistant message.' },
            ],
          },
        },
        {
          sessionId: 'sess-filtered',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-3',
                name: 'Edit',
                input: { file: 'b' },
              },
            ],
          },
        },
        {
          sessionId: 'sess-filtered',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-3',
                content: 'result c',
              },
            ],
          },
        },
        {
          sessionId: 'sess-filtered',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-4',
                content: 'result d',
              },
            ],
          },
        },
      ];
      await writeFile(
        transcriptPath,
        records.map((record) => JSON.stringify(record)).join('\n') + '\n',
        'utf8',
      );

      const digest = await buildDigest('claude-code', transcriptPath, {
        fromIndex: 0,
        mode: 'catch-up',
      });

      expect(digest.range.fromIndex).toBe(0);
      expect(digest.range.indexBase).toBe('zero-based-jsonl-record-index');
      expect(digest.accounting.indexBase).toBe('zero-based-jsonl-record-index');
      expect(
        digest.range.toIndex,
        'raw toIndex should be the last consumed raw record',
      ).toBe(7);
      expect(
        digest.range.nextIndex,
        'nextIndex should advance past all raw consumed records',
      ).toBe(8);
      expect(digest.range.newRecords).toBe(8);
      expect(digest.accounting.rendered.count).toBe(1);
      expect(digest.accounting.rendered.fromIndex).toBe(4);
      expect(digest.accounting.rendered.toIndex).toBe(4);
      expect(digest.accounting.filtered.toolCalls).toBe(3);
      expect(digest.accounting.filtered.toolResults).toBe(4);

      const md = renderMarkdown(digest);
      expect(
        md.includes('raw range (zero-based JSONL indices):** records 0–7 of 8'),
        'header should show raw range',
      ).toBeTruthy();
      expect(
        md.includes('raw records consumed:** 8'),
        'header should show raw consumed count',
      ).toBeTruthy();
      expect(
        md.includes('rendered messages:** 1 (zero-based records 4–4)'),
        'header should show rendered range separately',
      ).toBeTruthy();
      expect(
        md.includes('tool calls: 3'),
        'header should explain filtered tool calls',
      ).toBeTruthy();
      expect(
        md.includes('tool results: 4'),
        'header should explain filtered tool results',
      ).toBeTruthy();
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('catch-up accounts for default command-message filtering', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'digest-command-test-'));
    try {
      const transcriptPath = join(tmpDir, 'command.jsonl');
      const records = [
        {
          sessionId: 'sess-command',
          message: {
            role: 'user',
            content:
              '<command-message>skill body</command-message>\n<command-name>/oat-project-open</command-name>',
          },
        },
        {
          sessionId: 'sess-command',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Visible response.' }],
          },
        },
      ];
      await writeFile(
        transcriptPath,
        records.map((record) => JSON.stringify(record)).join('\n') + '\n',
        'utf8',
      );

      const digest = await buildDigest('claude-code', transcriptPath, {
        fromIndex: 0,
        mode: 'catch-up',
      });

      expect(digest.entries.length).toBe(1);
      expect(digest.entries[0].text).toBe('Visible response.');
      expect(digest.accounting.filtered.commandMessages).toBe(1);
      expect(digest.filters.includeCommandMessages).toBe(false);

      const md = renderMarkdown(digest);
      expect(
        md.includes('command messages: 1'),
        'header should explain command-message filtering',
      ).toBeTruthy();
      expect(
        md.includes('command messages excluded'),
        'filters should include command messages excluded',
      ).toBeTruthy();

      const debugDigest = await buildDigest('claude-code', transcriptPath, {
        fromIndex: 0,
        mode: 'catch-up',
        includeCommandMessages: true,
      });
      expect(debugDigest.entries.length).toBe(2);
      expect(debugDigest.entries[0].kind).toBe('command_message');
      expect(debugDigest.accounting.filtered.commandMessages).toBe(0);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('filters Codex bootstrap records out of rendered digests and engagement', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'digest-codex-bootstrap-'));
    try {
      const transcriptPath = join(tmpDir, 'codex-bootstrap.jsonl');
      const records = [
        {
          sessionId: 'codex-bootstrap',
          type: 'session_meta',
          payload: { id: 'codex-bootstrap', cwd: '/test/codex-bootstrap' },
        },
        {
          sessionId: 'codex-bootstrap',
          type: 'event_msg',
          payload: { type: 'task_started' },
        },
        {
          sessionId: 'codex-bootstrap',
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'developer',
            content: '<permissions instructions>\nFilesystem sandboxing...',
          },
        },
        {
          sessionId: 'codex-bootstrap',
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'user',
            content: [
              {
                type: 'text',
                text: '# AGENTS.md instructions for /test/codex-bootstrap\n\n<INSTRUCTIONS>\nRepo rules\n</INSTRUCTIONS>',
              },
              {
                type: 'text',
                text: '<environment_context>\n  <cwd>/test/codex-bootstrap</cwd>\n</environment_context>',
              },
            ],
          },
        },
        {
          sessionId: 'codex-bootstrap',
          type: 'turn_context',
          cwd: '/test/codex-bootstrap',
        },
        {
          sessionId: 'codex-bootstrap',
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'user',
            content:
              'Generate a concise tab title for this coding chat.\nRules:\n- 2 to 5 words.',
          },
        },
        {
          sessionId: 'codex-bootstrap',
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'assistant',
            content: 'Bootstrap Title',
          },
        },
        {
          sessionId: 'codex-bootstrap',
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'user',
            content: 'Please inspect the actual design conversation.',
          },
        },
        {
          sessionId: 'codex-bootstrap',
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'user',
            content:
              '<skill>\n<name>oat-project-open</name>\n<body>synthetic skill body</body>\n</skill>',
          },
        },
        {
          sessionId: 'codex-bootstrap',
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'assistant',
            content: 'Actual assistant response.',
          },
        },
      ];
      await writeFile(
        transcriptPath,
        records.map((record) => JSON.stringify(record)).join('\n') + '\n',
        'utf8',
      );

      const digest = await buildDigest('codex', transcriptPath, {
        fromIndex: 0,
        mode: 'catch-up',
      });
      const renderedText = digest.entries
        .map((entry: any) => entry.text)
        .join('\n');
      const md = renderMarkdown(digest);

      expect(digest.engagement.status).toBe('engaged');
      expect(digest.engagement.genuineUserMessages).toBe(1);
      expect(digest.engagement.bootstrapRecordCount).toBe(4);
      expect(digest.accounting.filtered.bootstrapRecords).toBe(4);
      expect(
        renderedText.includes('Please inspect the actual design conversation.'),
      ).toBeTruthy();
      expect(renderedText.includes('Actual assistant response.')).toBeTruthy();
      expect(!renderedText.includes('AGENTS.md instructions')).toBeTruthy();
      expect(!renderedText.includes('Bootstrap Title')).toBeTruthy();
      expect(!renderedText.includes('<skill>')).toBeTruthy();
      expect(md.includes('bootstrap records: 4')).toBeTruthy();
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('large digest fallback keeps the last turn groups automatically', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'digest-large-fallback-'));
    try {
      const transcriptPath = join(tmpDir, 'large.jsonl');
      const longText = 'A'.repeat(3000);
      const records = [];
      for (let i = 0; i < 12; i++) {
        records.push({
          sessionId: 'sess-large-fallback',
          ...(i === 0 ? { origin: { kind: 'task-notification' } } : {}),
          message: {
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `${i}:${longText}`,
          },
        });
      }
      await writeFile(
        transcriptPath,
        records.map((record) => JSON.stringify(record)).join('\n') + '\n',
        'utf8',
      );

      const digest = await buildDigest('claude-code', transcriptPath, {
        fromIndex: 0,
        mode: 'catch-up',
      });

      expect(digest.range.newRecords).toBe(12);
      expect(
        digest.accounting.autoLargeDigest,
        'autoLargeDigest accounting should be present',
      ).toBeTruthy();
      expect(
        (digest.accounting.autoLargeDigest as any).retainedTurnGroups,
      ).toBe(8);
      expect(digest.entries.length).toBe(8);
      expect(digest.entries[0].recordIndex).toBe(4);
      expect(digest.accounting.filtered.tailSliceEntries).toBe(4);
      expect(digest.accounting.recovery.omittedUserMessages).toEqual([
        {
          transcriptPath,
          indexBase: 'zero-based-jsonl-record-index',
          recordIndex: 2,
        },
      ]);
      expect(digest.entries[0].text).toBe(`4:${longText}`);
      expect(renderMarkdown(digest)).toContain('User-message recovery');
      expect(renderMarkdown(digest)).toContain(
        `${transcriptPath} records 2 (zero-based JSONL indices).`,
      );
      expect(
        JSON.parse(JSON.stringify(digest, null, 2)).accounting.recovery,
      ).toEqual(digest.accounting.recovery);
      expect(
        digest.warnings.some((w: string) =>
          w.includes('Large digest fallback'),
        ),
      ).toBeTruthy();
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('buildDigest works for cursor runtime', async () => {
    const digest = await buildDigest('cursor', typicalCursor, {
      fromIndex: 0,
      mode: 'review',
    });

    expect(
      digest.range.totalRecords > 0,
      'should parse cursor fixture',
    ).toBeTruthy();
    expect(digest.runtime).toBe('cursor');
    expect(
      digest.entries.some((entry: any) => entry.role === 'assistant'),
      'should include assistant messages',
    ).toBeTruthy();
  });

  test('cursor digest hides an unterminated provisional tail', async () => {
    const digest = await buildDigest(
      'cursor',
      join(FIXTURES, 'cursor', 'unterminated.jsonl'),
      { fromIndex: 0, mode: 'review', includeToolCalls: true },
    );

    expect(digest.entries).toEqual([]);
    expect(digest.range.nextIndex).toBe(3);
  });

  test('cursor recovery pointers use the buffered user source record', async () => {
    const transcriptPath = join(FIXTURES, 'cursor', 'terminal-success.jsonl');
    const digest = await buildDigest('cursor', transcriptPath, {
      fromIndex: 0,
      mode: 'review',
      maxTurns: 1,
    });

    expect(digest.accounting.recovery.omittedUserMessages).toEqual([
      {
        transcriptPath,
        indexBase: 'zero-based-jsonl-record-index',
        recordIndex: 0,
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// renderMarkdown
// ---------------------------------------------------------------------------

describe('renderMarkdown', () => {
  test('groups consecutive same-role entries under single ### header', async () => {
    const digest = await buildDigest('claude-code', typicalClaude, {
      fromIndex: 0,
      mode: 'review',
    });

    const md = renderMarkdown(digest);
    expect(
      typeof md === 'string',
      'renderMarkdown returns a string',
    ).toBeTruthy();

    // Should contain ### User and ### Assistant headers
    expect(
      md.includes('### User'),
      'should contain ### User header',
    ).toBeTruthy();
    expect(
      md.includes('### Assistant'),
      'should contain ### Assistant header',
    ).toBeTruthy();

    // Headers should NOT repeat consecutively for the same role
    // (i.e., we don't see "### User\n...\n### User\n..." without an assistant in between)
    const lines = md.split('\n');
    let prevHeader: string | null = null;
    for (const line of lines) {
      if (line.startsWith('### User') || line.startsWith('### Assistant')) {
        expect(line, `Consecutive duplicate header found: ${line}`).not.toBe(
          prevHeader,
        );
        prevHeader = line;
      }
    }
  });

  test('header contains filter line', async () => {
    const digest = await buildDigest('claude-code', typicalClaude, {
      fromIndex: 0,
      mode: 'review',
      includeToolCalls: false,
      includeToolResults: false,
    });

    expect(renderMarkdown(digest)).toContain(
      '**filters:** tool calls excluded · tool results excluded · command messages excluded',
    );
  });

  test('header contains active flag when digest.active is true', async () => {
    // Build a digest with active=true by patching after build
    const digest = await buildDigest('claude-code', typicalClaude, {
      fromIndex: 0,
      mode: 'review',
    });
    digest.active = true;

    const md = renderMarkdown(digest);
    expect(
      md.includes('active') || md.includes('ACTIVE'),
      'header should include active flag',
    ).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 20K warning
// ---------------------------------------------------------------------------

describe('20K warning', () => {
  test('prepends 20K-char warning when rendered output exceeds threshold', async () => {
    // Build a large fixture by writing a temp file with many long records
    const tmpDir = await mkdtemp(join(tmpdir(), 'digest-test-'));
    try {
      const largePath = join(tmpDir, 'large.jsonl');
      const longText = 'A'.repeat(2000);
      const lines = [];
      for (let i = 0; i < 20; i++) {
        lines.push(
          JSON.stringify({
            sessionId: 'sess-large',
            type: 'user',
            message: { role: 'user', content: longText },
          }),
        );
        lines.push(
          JSON.stringify({
            sessionId: 'sess-large',
            type: 'assistant',
            message: {
              role: 'assistant',
              content: [{ type: 'text', text: longText }],
            },
          }),
        );
      }
      await writeFile(largePath, lines.join('\n') + '\n', 'utf8');

      // An explicit tail slice bypasses the automatic large-digest fallback, so
      // the rendered markdown really exceeds the 20K-char threshold.
      const digest = await buildDigest('claude-code', largePath, {
        fromIndex: 0,
        mode: 'review',
        maxTurns: 40,
      });

      expect(renderMarkdown(digest)).toMatch(
        /^> \*\*Warning:\*\* This digest is large \(/u,
      );
      const small = await buildDigest('claude-code', typicalClaude, {
        fromIndex: 0,
        mode: 'review',
      });
      expect(renderMarkdown(small)).not.toMatch(/^> \*\*Warning:\*\*/u);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Ask-user exchanges in the digest
// ---------------------------------------------------------------------------

describe('ask-user exchanges', () => {
  const askUserClaude = join(
    FIXTURES,
    'claude-code',
    'ask-user-question.jsonl',
  );
  const askQuestionCursor = join(FIXTURES, 'cursor', 'ask-question.jsonl');
  const askQuestionFinalCursor = join(
    FIXTURES,
    'cursor',
    'ask-question-final.jsonl',
  );

  test('counts ask-user entries as rendered rather than filtered', async () => {
    const digest = await buildDigest('claude-code', askUserClaude, {
      fromIndex: 0,
      mode: 'review',
    });

    expect(digest.accounting.rendered.askUserEntries).toBe(4);
    // The Read call/result pair is still reported as filtered tool traffic.
    expect(digest.accounting.filtered.toolCalls).toBe(1);
    expect(digest.accounting.filtered.toolResults).toBe(1);
  });

  test('surfaces Cursor questions through the v2 digest path', async () => {
    const context = await cursorDigestAnalysis(askQuestionCursor);
    const digest = await buildDigest(
      'cursor',
      askQuestionCursor,
      cursorDigestOptions(
        context,
        'observation',
        cursorDigestState(askQuestionCursor, context),
      ),
    );
    const md = renderMarkdown(digest);

    expect(md).toContain('[AskQuestion] Discovery convergence — 2 questions:');
    expect(md).toContain('Proceed as one cohesive project?');
    expect(md).toContain(
      '(selected option not recorded in Cursor transcripts)',
    );
    // Tagged structurally so JSON consumers can tell a question from prose.
    expect(
      digest.entries.find((entry) => entry.text.startsWith('[AskQuestion]'))
        ?.kind,
    ).toBe('ask_user');
  });

  test('the confirmed-completion projection excludes questions but keeps them recoverable', async () => {
    // That projection is consumed only by the collaboration skill, whose
    // selector requires every entry to be the final message of a
    // terminal-success turn. Context entries there strand a continuation.
    const context = await cursorDigestAnalysis(askQuestionCursor);
    const digest = await buildDigest(
      'cursor',
      askQuestionCursor,
      cursorDigestOptions(context, 'confirmed-completion'),
    );

    expect(renderMarkdown(digest)).not.toContain('[AskQuestion]');
    expect(digest.entries).toHaveLength(1);
    expect(digest.entries[0]!.text).toBe(
      'Discovery is complete and committed.',
    );

    const askRecord = context.analysis.turns[0]!.assistantRecords.find(
      (record) => record.text.startsWith('[AskQuestion]'),
    );
    expect(
      digest.accounting.recovery.omittedAssistantEntries.some(
        (pointer) => pointer.entryKey === askRecord!.entryKey,
      ),
      'the excluded question must stay reachable through recovery',
    ).toBe(true);
  });

  // A question is not assistant progress the completion contract withholds:
  // it is the context explaining what the turn was waiting on. Cover every
  // non-success terminal status, matching the v1 normalizer.
  for (const status of ['aborted', 'error', 'cancelled'] as const) {
    test(`preserves the Cursor question when a turn ends ${status}`, async () => {
      const tmpDir = await mkdtemp(join(tmpdir(), `cursor-ask-${status}-`));
      try {
        const transcriptPath = join(tmpDir, `${status}.jsonl`);
        const source = await readFile(askQuestionCursor, 'utf8');
        await writeFile(
          transcriptPath,
          source.replace('"status":"success"', `"status":"${status}"`),
        );
        const context = await cursorDigestAnalysis(transcriptPath);
        const digest = await buildDigest(
          'cursor',
          transcriptPath,
          cursorDigestOptions(
            context,
            'observation',
            cursorDigestState(transcriptPath, context),
          ),
        );
        const md = renderMarkdown(digest);

        expect(md).toContain('[AskQuestion] Discovery convergence');
        // Marked distinctly from a genuine terminal success.
        expect(
          digest.entries.every(
            (entry) => entry.availability === 'terminal-incomplete',
          ),
        ).toBe(true);
        // Ordinary assistant content from the failed turn stays withheld...
        expect(md).not.toContain('Discovery is complete and committed.');
        // ...but the digest now carries content, so the facet reports it
        // rather than claiming the turn produced nothing observable.
        expect(digest.cursorEvidence.status.content).toBe('available');
        expect(digest.cursorEvidence.status.lifecycle).toBe(status);
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });
  }

  // A turn can end *on* the question. The confirmed projection must refuse it
  // there too, or the stranded-continuation failure returns.
  test('a turn ending on the question keeps it out of confirmed completion', async () => {
    const context = await cursorDigestAnalysis(askQuestionFinalCursor);
    const digest = await buildDigest(
      'cursor',
      askQuestionFinalCursor,
      cursorDigestOptions(context, 'confirmed-completion'),
    );

    expect(digest.entries).toHaveLength(0);
    const askRecord = context.analysis.turns[0]!.assistantRecords.find(
      (record) => record.text.startsWith('[AskQuestion]'),
    );
    expect(
      digest.accounting.recovery.omittedAssistantEntries.some(
        (pointer) => pointer.entryKey === askRecord!.entryKey,
      ),
      'a final question must stay recoverable',
    ).toBe(true);
  });

  test('observation still renders a turn that ends on the question', async () => {
    const context = await cursorDigestAnalysis(askQuestionFinalCursor);
    const digest = await buildDigest(
      'cursor',
      askQuestionFinalCursor,
      cursorDigestOptions(
        context,
        'observation',
        cursorDigestState(askQuestionFinalCursor, context),
      ),
    );

    const md = renderMarkdown(digest);
    expect(md).toContain('[AskQuestion] Migration gate');
    // The question is its render group's final record, so both the completed
    // loop and the ask-user carve-out could emit it; it must render once.
    expect(md.split('[AskQuestion] Migration gate').length - 1).toBe(1);
    expect(digest.entries[0]!.kind).toBe('ask_user');
  });

  for (const status of ['aborted', 'error', 'cancelled'] as const) {
    test(`confirmed completion pointers the excluded question on a ${status} turn`, async () => {
      const tmpDir = await mkdtemp(join(tmpdir(), `cursor-ptr-${status}-`));
      try {
        const transcriptPath = join(tmpDir, `${status}.jsonl`);
        const source = await readFile(askQuestionFinalCursor, 'utf8');
        await writeFile(
          transcriptPath,
          source.replace('"status":"success"', `"status":"${status}"`),
        );
        const context = await cursorDigestAnalysis(transcriptPath);
        const digest = await buildDigest(
          'cursor',
          transcriptPath,
          cursorDigestOptions(context, 'confirmed-completion'),
        );

        expect(digest.entries).toHaveLength(0);
        // The documented promise is that an excluded question stays reachable.
        expect(
          digest.accounting.recovery.omittedAssistantEntries,
        ).not.toHaveLength(0);
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });
  }

  test('does not re-emit an already-delivered question from a failed turn', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cursor-ask-abort-dedup-'));
    try {
      const transcriptPath = join(tmpDir, 'aborted.jsonl');
      const source = await readFile(askQuestionCursor, 'utf8');
      await writeFile(
        transcriptPath,
        source.replace('"status":"success"', '"status":"aborted"'),
      );
      const context = await cursorDigestAnalysis(transcriptPath);
      const turn = context.analysis.turns[0]!;
      const askRecord = turn.assistantRecords.find((record) =>
        record.text.startsWith('[AskQuestion]'),
      );
      expect(askRecord, 'fixture must produce an ask-user record').toBeTruthy();

      const digest = await buildDigest(
        'cursor',
        transcriptPath,
        cursorDigestOptions(
          context,
          'observation',
          cursorDigestState(transcriptPath, context, {
            openTurn: {
              turnId: turn.turnId,
              fromFrameIndex: turn.fromFrameIndex,
              observedThroughFrame: turn.observedThroughFrame,
              deliveredEntryKeys: [askRecord!.entryKey],
              assistantEntryKeys: turn.assistantRecords.map((r) => r.entryKey),
              humanRecordIndexes: turn.humanRecordIndexes,
              toolRecordIndexes: turn.toolRecordIndexes,
              hasHumanInput: true,
              hasAutomaticControlInput: false,
              lifecycle: turn.lifecycle,
            },
          }),
        ),
      );

      expect(renderMarkdown(digest)).not.toContain('[AskQuestion]');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('suppresses an already-delivered Cursor question under observation', async () => {
    const context = await cursorDigestAnalysis(askQuestionCursor);
    const turn = context.analysis.turns[0]!;
    const askRecord = turn.assistantRecords.find((record) =>
      record.text.startsWith('[AskQuestion]'),
    );
    expect(askRecord, 'fixture must produce an ask-user record').toBeTruthy();

    const digest = await buildDigest(
      'cursor',
      askQuestionCursor,
      cursorDigestOptions(
        context,
        'observation',
        cursorDigestState(askQuestionCursor, context, {
          openTurn: {
            turnId: turn.turnId,
            fromFrameIndex: turn.fromFrameIndex,
            observedThroughFrame: turn.observedThroughFrame,
            deliveredEntryKeys: [askRecord!.entryKey],
            assistantEntryKeys: turn.assistantRecords.map((r) => r.entryKey),
            humanRecordIndexes: turn.humanRecordIndexes,
            toolRecordIndexes: turn.toolRecordIndexes,
            hasHumanInput: true,
            hasAutomaticControlInput: false,
            lifecycle: turn.lifecycle,
          },
        }),
      ),
    );
    const md = renderMarkdown(digest);

    // Delivered means the consumer already received it, so it is not rendered
    // a second time.
    expect(md).not.toContain('[AskQuestion] Discovery convergence');
    // It is still reported as omitted: the render-group recovery pass points at
    // the last unrendered record in any group that rendered something, whether
    // or not it was previously delivered. Ask-user records follow the same rule
    // as ordinary content here.
    expect(
      digest.accounting.recovery.omittedAssistantEntries.some(
        (pointer) => pointer.entryKey === askRecord!.entryKey,
      ),
    ).toBe(true);
    // The turn's other content is unaffected by the ask-user carve-out.
    expect(md).toContain('Discovery is complete and committed.');
  });
});

describe('optional activity projection', () => {
  test('keeps the legacy tool-inclusive digest when activity is off', async () => {
    const explicitOff = await buildDigest('claude-code', withToolBurst, {
      fromIndex: 0,
      mode: 'review',
      includeToolCalls: true,
      includeToolResults: true,
      includeActivity: false,
    });

    expect(explicitOff.filters).toMatchObject({
      includeToolCalls: true,
      includeToolResults: true,
    });
    expect(explicitOff.accounting.filtered).toMatchObject({
      toolCalls: 0,
      toolResults: 0,
    });
    expect(explicitOff).not.toHaveProperty('activity');
    const markdown = renderMarkdown(explicitOff);
    expect(markdown).not.toContain('## Activity');
    expect(markdown).toContain('[Bash]');
    expect(markdown).toContain('[Read → result]');
  });

  test('attaches independently budgeted activity and suppresses duplicate legacy markers', async () => {
    const digest = await buildDigest('claude-code', withToolBurst, {
      fromIndex: 0,
      mode: 'review',
      includeToolCalls: true,
      includeToolResults: true,
      includeActivity: true,
      activityRenderFormat: 'markdown',
      maxTurns: 1,
      maxBytes: 80,
    });
    const markdown = renderMarkdown(digest);

    expect(digest.schemaVersion).toBe(1);
    expect(digest.activity).toMatchObject({
      activitySchemaVersion: 1,
      mode: 'review',
      renderedFormat: 'markdown',
      deliveryRange: { start: 0, end: 11 },
      counts: {
        capturedSource: { countedInvocations: 3 },
        deliveredRange: { countedInvocations: 3 },
      },
    });
    expect(digest.entries).toHaveLength(2);
    expect(digest.entries.at(-1)?.text).toContain("You're welcome");
    expect(digest.filters).toMatchObject({
      includeToolCalls: false,
      includeToolResults: false,
    });
    expect(digest.accounting.filtered).toMatchObject({
      toolCalls: 3,
      toolResults: 3,
    });
    expect(digest.activity!.events.length).toBeGreaterThan(0);
    expect(digest.activity!.renderedBytes).toBeLessThanOrEqual(
      digest.activity!.limits.maxBytes!,
    );
    expect(markdown).toContain('## Activity');
    expect(markdown).not.toContain('[Bash]');
    expect(markdown).not.toContain('[Read → result]');
  });

  test('budgets final review activity Markdown after hostile punctuation is escaped', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'observer-review-activity-budget-'),
    );
    const transcriptPath = join(directory, 'hostile.jsonl');
    try {
      const sessionId = 'hostile-review-activity';
      const hostilePayload =
        '[link](javascript:synthetic) **bold** ~~strike~~ __underline__'.repeat(
          36,
        );
      const records = [
        {
          sessionId,
          message: { role: 'user', content: 'Review the recorded activity.' },
        },
        ...Array.from({ length: 60 }, (_, index) => ({
          sessionId,
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: `hostile-review-${index}`,
                name: `hostile-review-${index}`,
                input: { payload: hostilePayload },
              },
            ],
          },
        })),
      ];
      await writeFile(
        transcriptPath,
        `${records.map((record) => JSON.stringify(record)).join('\n')}\n`,
      );

      const digest = await buildDigest('claude-code', transcriptPath, {
        mode: 'review',
        includeActivity: true,
        activityRenderFormat: 'markdown',
      });
      const rendered = renderMarkdown(digest);
      const activityStart = rendered.indexOf('## Activity');
      const activityText = rendered.slice(activityStart);

      expect(activityStart).toBeGreaterThanOrEqual(0);
      expect(digest.activity?.renderedFormat).toBe('markdown');
      expect(Buffer.byteLength(activityText, 'utf8')).toBe(
        digest.activity?.renderedBytes,
      );
      expect(digest.activity!.renderedBytes).toBeLessThanOrEqual(
        digest.activity!.limits.maxBytes!,
      );
      expect(digest.activity!.omitted.byteLimitGroups).toBeGreaterThan(0);
      expect(digest.activity!.omitted.calls).toBe(
        digest.activity!.counts.deliveredRange.calls -
          digest.activity!.counts.displayed.calls,
      );
      expect(activityText).not.toContain('[link](javascript:synthetic)');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test('uses the raw delivered range for catch-up activity', async () => {
    const digest = await buildDigest('claude-code', withToolBurst, {
      fromIndex: 4,
      mode: 'catch-up',
      includeActivity: true,
    });

    expect(digest.activity).toMatchObject({
      mode: 'catch-up',
      deliveryRange: { start: 4, end: 11 },
      counts: {
        capturedSource: { countedInvocations: 3 },
        deliveredRange: { countedInvocations: 2 },
      },
    });
  });

  test('preserves conversation with explicit unavailable coverage when the optional pass fails', async () => {
    const capturedRead = await readRecordsDetailed(typicalClaude);
    Object.defineProperty(capturedRead, 'diagnostics', {
      get() {
        throw new Error('injected optional extraction failure');
      },
    });

    const digest = await buildDigest('claude-code', typicalClaude, {
      includeActivity: true,
      capturedRead,
    });

    expect(digest.entries.length).toBeGreaterThan(0);
    expect(digest.activity).toMatchObject({
      coverage: [
        {
          dataClass: 'record-activity',
          status: 'not-read',
          captured: 0,
        },
      ],
      diagnostics: [{ code: 'ACTIVITY_EXTRACTION_ERROR' }],
    });
  });

  test('retains ask-user human and automatic-resolution caveats in activity mode', async () => {
    const claude = await buildDigest(
      'claude-code',
      join(FIXTURES, 'claude-code', 'ask-user-question.jsonl'),
      {
        includeActivity: true,
        includeToolCalls: true,
        includeToolResults: true,
      },
    );
    const codex = await buildDigest(
      'codex',
      join(FIXTURES, 'codex', 'request-user-input.jsonl'),
      {
        includeActivity: true,
        includeToolCalls: true,
        includeToolResults: true,
      },
    );

    expect(renderMarkdown(claude)).toContain(
      'Design depth: "Actually, show me the tradeoffs first."',
    );
    expect(
      claude.entries.filter((entry) => entry.kind === 'ask_user'),
    ).toHaveLength(4);
    expect(renderMarkdown(codex)).toContain('auto-resolves after 120s');
  });
});
