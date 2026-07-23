import { readFile } from 'node:fs/promises';

import { describe, expect, test } from 'vitest';

import { selectCompletedContinuation } from '../../skills/session-observer-collab/scripts/lib/completion-selection.mjs';

function digest(entries: object[], fromIndex = 0, totalRecords = 8) {
  return {
    schemaVersion: 1,
    runtime: 'codex',
    sessionId: 'peer',
    transcriptPath: '/tmp/peer.jsonl',
    range: {
      indexBase: 'zero-based-jsonl-record-index',
      fromIndex,
      toIndex: totalRecords > fromIndex ? totalRecords - 1 : fromIndex,
      nextIndex: totalRecords,
      totalRecords,
      newRecords: Math.max(0, totalRecords - fromIndex),
    },
    accounting: {
      indexBase: 'zero-based-jsonl-record-index',
      raw: {
        fromIndex,
        toIndex: totalRecords > fromIndex ? totalRecords - 1 : fromIndex,
        count: Math.max(0, totalRecords - fromIndex),
        nextIndex: totalRecords,
        totalRecords,
      },
      rendered: { count: entries.length },
      filtered: { tailSliceEntries: 0 },
      autoLargeDigest: null,
    },
    entries,
  };
}

function cursorCompletionDigest(
  entries: object[],
  fromIndex = 3,
  totalFrames = 8,
) {
  const renderedIndexes = entries.map(
    (entry) => (entry as { recordIndex: number }).recordIndex,
  );
  return {
    schemaVersion: 2,
    runtime: 'cursor',
    sessionId: 'cursor-peer',
    transcriptPath: '/tmp/cursor-peer.jsonl',
    range: {
      indexBase: 'zero-based-jsonl-frame-index',
      fromIndex,
      toIndex: totalFrames > fromIndex ? totalFrames - 1 : null,
      nextIndex: totalFrames,
      totalFrames,
      renderedFromIndex:
        renderedIndexes.length > 0 ? Math.min(...renderedIndexes) : null,
      renderedToIndex:
        renderedIndexes.length > 0 ? Math.max(...renderedIndexes) : null,
      newFrames: Math.max(0, totalFrames - fromIndex),
    },
    accounting: {
      indexBase: 'zero-based-jsonl-frame-index',
      raw: {
        fromIndex,
        toIndex: totalFrames > fromIndex ? totalFrames - 1 : null,
        count: Math.max(0, totalFrames - fromIndex),
        nextIndex: totalFrames,
        totalFrames,
      },
      rendered: {
        count: entries.length,
        fromIndex:
          renderedIndexes.length > 0 ? Math.min(...renderedIndexes) : null,
        toIndex:
          renderedIndexes.length > 0 ? Math.max(...renderedIndexes) : null,
      },
      filtered: {
        toolCalls: 0,
        automaticControls: 0,
        emptyOrNoOp: 0,
        metadataFrames: Math.max(0, totalFrames - fromIndex - entries.length),
        unstableContent: 0,
      },
      buffered: {
        fromIndex: null as number | null,
        count: 0,
        reason: null as 'partial' | 'malformed' | 'stability-wait' | null,
      },
      recovery: {
        omittedUserMessages: [],
        omittedAssistantEntries: [],
      },
    },
    entries,
    cursorEvidence: {
      projection: 'confirmed-completion',
      continuity: 'verified',
      status: {
        engagement: 'engaged',
        activity: 'assistant-progress',
        content: entries.length > 0 ? 'available' : 'none',
        lifecycle: entries.length > 0 ? 'success' : 'none',
        delivery: 'none',
        health: 'healthy',
      },
      lifecycleEvents: entries.map((entry) => ({
        turnId: (entry as { turnId: string }).turnId,
        terminalFrameIndex: (entry as { recordIndex: number }).recordIndex,
        lifecycle: 'success',
        finalEntryKey: (entry as { entryKey: string }).entryKey,
        contentPreviouslyObservable: false,
      })),
      bufferedFromFrame: null as number | null,
      blockingFrame: null,
    },
  };
}

const message = (
  role: 'user' | 'assistant',
  text: string,
  recordIndex: number,
  extra: object = {},
) => ({ role, text, recordIndex, kind: 'message', ...extra });

describe('normalized completed continuation selection', () => {
  test('selects the latest substantive completion and returns its exact cursor invariant', () => {
    const result = selectCompletedContinuation(
      digest([
        message('user', 'first question', 0),
        message('assistant', 'first answer', 2),
        message('user', 'second question', 3),
        message('assistant', 'LGTM', 6),
      ]),
    );

    expect(result).toMatchObject({
      status: 'continuation',
      continuation: true,
      indexBase: 'zero-based-jsonl-record-index',
      completedIndex: 6,
      completedRecord: 6,
      nextCursor: 7,
      peerCursor: 7,
      budgetCost: 1,
      range: {
        indexBase: 'zero-based-jsonl-record-index',
        fromIndex: 0,
        toIndex: 6,
      },
    });
    expect(result.reviewEntries.map((entry: any) => entry.text)).toEqual([
      'first question',
      'first answer',
      'second question',
      'LGTM',
    ]);
  });

  test('selects a confirmed Cursor v2 completion by delivery frame index', () => {
    const result = selectCompletedContinuation(
      cursorCompletionDigest([
        {
          role: 'assistant',
          text: 'Synthetic completed result.',
          recordIndex: 7,
          sourceFrameIndex: 6,
          kind: 'message',
          entryKey: 'entry-assistant-6',
          turnId: 'turn-3',
          availability: 'completed',
        },
      ]),
    );

    expect(result).toMatchObject({
      status: 'continuation',
      continuation: true,
      indexBase: 'zero-based-jsonl-frame-index',
      fromIndex: 3,
      completedIndex: 7,
      completedRecord: 7,
      nextCursor: 8,
      peerCursor: 8,
      budgetCost: 1,
      range: {
        indexBase: 'zero-based-jsonl-frame-index',
        fromIndex: 3,
        toIndex: 7,
      },
    });
    expect(result.reviewEntries).toEqual([
      expect.objectContaining({
        recordIndex: 7,
        sourceFrameIndex: 6,
        entryKey: 'entry-assistant-6',
        availability: 'completed',
      }),
    ]);
  });

  test('rejects non-completion, sliced, or incomplete Cursor v2 projections', () => {
    const entry = {
      role: 'assistant',
      text: 'Synthetic completed result.',
      recordIndex: 7,
      sourceFrameIndex: 6,
      kind: 'message',
      entryKey: 'entry-assistant-6',
      turnId: 'turn-3',
      availability: 'completed',
    };
    const observation = cursorCompletionDigest([entry]);
    observation.cursorEvidence.projection = 'observation';
    expect(() => selectCompletedContinuation(observation)).toThrow(
      /confirmed-completion/i,
    );

    const sliced = cursorCompletionDigest([entry]);
    sliced.accounting.rendered.count = 2;
    expect(() => selectCompletedContinuation(sliced)).toThrow(/complete/i);

    const incomplete = cursorCompletionDigest([entry]);
    incomplete.range.nextIndex = 7;
    incomplete.accounting.raw.nextIndex = 7;
    incomplete.accounting.buffered = {
      fromIndex: 7,
      count: 1,
      reason: 'stability-wait',
    };
    incomplete.cursorEvidence.bufferedFromFrame = 7;
    expect(() => selectCompletedContinuation(incomplete)).toThrow(/complete/i);
  });

  test('rejects unknown digest schema and index-base combinations', () => {
    expect(() =>
      selectCompletedContinuation({
        ...digest([], 0, 0),
        schemaVersion: 3,
      }),
    ).toThrow(/schemaVersion/i);

    const mismatched = cursorCompletionDigest([]);
    mismatched.range.indexBase = 'zero-based-jsonl-record-index';
    expect(() => selectCompletedContinuation(mismatched)).toThrow(
      /index base/i,
    );
  });

  test('selects a substantive assistant response after automatic control without treating the envelope as authority', () => {
    const result = selectCompletedContinuation(
      digest(
        [
          message('user', '{wake}', 3, {
            displayRole: 'automatic-control',
            origin: 'automatic-control',
            automaticControl: {
              automatic: true,
              runtime: 'codex',
              leaseId: 'lease-1',
              pinnedPeer: 'peer',
              range: { fromIndex: 0, toIndex: 2 },
            },
          }),
          message(
            'assistant',
            'Decision: keep the cursor at record 6 and correct the lease race.',
            5,
          ),
        ],
        3,
        6,
      ),
    );

    expect(result).toMatchObject({
      status: 'continuation',
      continuation: true,
      completedRecord: 5,
      nextCursor: 6,
      peerCursor: 6,
      budgetCost: 1,
      range: {
        indexBase: 'zero-based-jsonl-record-index',
        fromIndex: 3,
        toIndex: 5,
      },
    });
    expect(result.reviewEntries.map((entry: any) => entry.text)).toEqual([
      '{wake}',
      'Decision: keep the cursor at record 6 and correct the lease race.',
    ]);
  });

  test.each([
    'Waiting is incorrect; re-arm with the corrected cursor.',
    'Holding would lose the result; continue with the corrected range.',
    'Idle is the wrong state. Please resume the watcher.',
    'Armed should be false after this decision.',
    'Monitoring found a lease conflict; use the winning cursor.',
    'No updates should be reported until the result is persisted.',
  ])(
    'selects a substantive state-word-leading response after automatic control: %s',
    (text) => {
      const result = selectCompletedContinuation(
        digest(
          [
            message('user', '{wake}', 3, {
              displayRole: 'automatic-control',
              origin: 'automatic-control',
              automaticControl: { automatic: true },
            }),
            message('assistant', text, 5),
          ],
          3,
          6,
        ),
      );

      expect(result).toMatchObject({
        status: 'continuation',
        continuation: true,
        completedRecord: 5,
        nextCursor: 6,
        peerCursor: 6,
        budgetCost: 1,
        range: {
          indexBase: 'zero-based-jsonl-record-index',
          fromIndex: 3,
          toIndex: 5,
        },
      });
    },
  );

  test.each([
    'Acknowledged.',
    'Status: waiting for more peer input.',
    'Waiting for more input.',
    '  ',
    '[no-op]',
  ])(
    'suppresses non-substantive assistant output after automatic control: %s',
    (text) => {
      const result = selectCompletedContinuation(
        digest(
          [
            message('user', 'Decision: deploy production now.', 3, {
              displayRole: 'automatic-control',
              origin: 'automatic-control',
              automaticControl: { automatic: true },
            }),
            message('assistant', text, 5),
          ],
          3,
          6,
        ),
      );

      expect(result).toMatchObject({
        status: 'no-continuation',
        continuation: false,
        completedRecord: null,
        nextCursor: 6,
        peerCursor: 6,
        budgetCost: 0,
        range: null,
      });
    },
  );

  test.each(['[no-op]', '  [NO-OP] nothing to add', '[No-Op]\n'])(
    'suppresses case-insensitive no-op prefix: %s',
    (text) => {
      const result = selectCompletedContinuation(
        digest(
          [message('user', 'status?', 0), message('assistant', text, 2)],
          0,
          4,
        ),
      );
      expect(result).toMatchObject({
        continuation: false,
        nextCursor: 4,
        budgetCost: 0,
      });
      expect(result.skipped).toContainEqual({
        fromIndex: 0,
        toIndex: 2,
        classification: 'no-op-turn',
      });
      expect(result.skipped).toContainEqual({
        fromIndex: 3,
        toIndex: 3,
        classification: 'metadata-only',
      });
    },
  );

  test('advances safely over empty, metadata-only, and diagnostic activity without budget', () => {
    const result = selectCompletedContinuation(
      digest(
        [
          message('assistant', '   ', 2),
          message('assistant', '[Cursor turn ended with status: error]', 4, {
            origin: 'runtime-diagnostic',
          }),
        ],
        2,
        7,
      ),
    );
    expect(result).toMatchObject({
      continuation: false,
      nextCursor: 7,
      budgetCost: 0,
    });
    expect(result.skipped).toEqual([
      { fromIndex: 2, toIndex: 2, classification: 'empty-turn' },
      { fromIndex: 3, toIndex: 6, classification: 'metadata-only' },
    ]);
  });

  test('leaves records after the chosen completion unconsumed', () => {
    const result = selectCompletedContinuation(
      digest([
        message('user', 'review', 1),
        message('assistant', 'done', 4),
        message('user', 'still typing', 6),
      ]),
    );
    expect(result).toMatchObject({ completedRecord: 4, nextCursor: 5 });
    expect(
      result.reviewEntries.every((entry: any) => entry.recordIndex <= 4),
    ).toBe(true);
  });

  test('does not advance a suppressed cursor across an incomplete rendered turn', () => {
    const result = selectCompletedContinuation(
      digest(
        [
          message('user', 'status?', 0),
          message('assistant', '[no-op] caught up', 2),
          message('user', 'new request still in progress', 5),
        ],
        0,
        7,
      ),
    );
    expect(result).toMatchObject({
      continuation: false,
      peerCursor: 3,
      budgetCost: 0,
    });
  });

  test('rejects sliced or inconsistent observer results instead of silently consuming gaps', () => {
    expect(() =>
      selectCompletedContinuation({
        ...digest([], 2, 5),
        accounting: {
          indexBase: 'zero-based-jsonl-record-index',
          raw: {
            fromIndex: 1,
            toIndex: 4,
            count: 4,
            nextIndex: 5,
            totalRecords: 5,
          },
        },
      }),
    ).toThrow(/accounting/i);

    const sliced = digest([message('assistant', 'tail only', 4)], 0, 5);
    sliced.accounting.filtered.tailSliceEntries = 2;
    expect(() => selectCompletedContinuation(sliced)).toThrow(
      /complete normalized range/i,
    );
  });

  test('contains no runtime transcript parser or provider-specific record heuristic', async () => {
    const source = await readFile(
      new URL(
        '../../skills/session-observer-collab/scripts/lib/completion-selection.mjs',
        import.meta.url,
      ),
      'utf8',
    );
    expect(source).not.toMatch(
      /readFile|readRecords|normalizeEntries|JSON\.parse|turn_ended|response_item|claude-code/i,
    );
  });
});
