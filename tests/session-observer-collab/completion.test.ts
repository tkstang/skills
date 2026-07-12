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
