import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { selectCompletedContinuation } from '../../skills/session-observer-collab/scripts/lib/completion-selection.mjs';
// @ts-expect-error shipped collaboration runtime; no type declarations here.
import { observeCursorCompletion } from '../../skills/session-observer-collab/scripts/lib/selected-prefix.mjs';

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
      selectedPrefix: {
        indexBase: 'zero-based-jsonl-frame-index',
        nextFrameIndex: totalFrames,
        prefixBytes: totalFrames * 100,
        prefixSha256: 'a'.repeat(64),
        observedSize: totalFrames * 100,
        device: 1,
        inode: 2,
      },
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
      selectedPrefix: {
        nextFrameIndex: 8,
        prefixBytes: 800,
        prefixSha256: 'a'.repeat(64),
        observedSize: 800,
        device: 1,
        inode: 2,
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

  test('selects a complete terminal-success prefix before a valid pending Cursor suffix', () => {
    const pending = cursorCompletionDigest(
      [
        {
          role: 'assistant',
          text: 'Synthetic completed prefix.',
          recordIndex: 5,
          sourceFrameIndex: 4,
          kind: 'message',
          entryKey: 'entry-assistant-4',
          turnId: 'turn-3',
          availability: 'completed',
        },
      ],
      3,
      8,
    );
    pending.range.toIndex = 5;
    pending.range.nextIndex = 6;
    pending.range.newFrames = 3;
    pending.accounting.raw.toIndex = 5;
    pending.accounting.raw.count = 3;
    pending.accounting.raw.nextIndex = 6;
    pending.accounting.filtered.metadataFrames = 0;
    pending.accounting.buffered = {
      fromIndex: 6,
      count: 2,
      reason: 'stability-wait',
    };
    pending.cursorEvidence.status.lifecycle = 'pending';
    pending.cursorEvidence.bufferedFromFrame = 6;
    pending.cursorEvidence.selectedPrefix.nextFrameIndex = 6;
    pending.cursorEvidence.selectedPrefix.prefixBytes = 600;
    pending.cursorEvidence.selectedPrefix.observedSize = 600;

    expect(selectCompletedContinuation(pending)).toMatchObject({
      status: 'continuation',
      continuation: true,
      indexBase: 'zero-based-jsonl-frame-index',
      fromIndex: 3,
      completedIndex: 5,
      completedRecord: 5,
      nextCursor: 6,
      peerCursor: 6,
      budgetCost: 1,
      range: {
        indexBase: 'zero-based-jsonl-frame-index',
        fromIndex: 3,
        toIndex: 5,
      },
      reviewEntries: [
        expect.objectContaining({
          text: 'Synthetic completed prefix.',
          recordIndex: 5,
          availability: 'completed',
        }),
      ],
      selectedPrefix: {
        nextFrameIndex: 6,
        prefixBytes: 600,
        observedSize: 600,
      },
    });
  });

  test('binds a Cursor completion checkpoint before a safe no-op suffix', () => {
    const suffixDigest = cursorCompletionDigest(
      [
        {
          role: 'assistant',
          text: 'Synthetic substantive result.',
          recordIndex: 2,
          sourceFrameIndex: 1,
          kind: 'message',
          entryKey: 'entry-assistant-1',
          turnId: 'turn-1',
          availability: 'completed',
        },
      ],
      0,
      6,
    );
    suffixDigest.cursorEvidence.selectedPrefix.nextFrameIndex = 3;
    suffixDigest.cursorEvidence.selectedPrefix.prefixBytes = 300;
    suffixDigest.cursorEvidence.selectedPrefix.observedSize = 300;

    expect(selectCompletedContinuation(suffixDigest)).toMatchObject({
      continuation: true,
      peerCursor: 3,
      selectedPrefix: {
        nextFrameIndex: 3,
        prefixBytes: 300,
        observedSize: 300,
      },
    });
  });

  test('rejects non-completion, unbound, or invalidly buffered Cursor v2 projections', () => {
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

    const unbound = cursorCompletionDigest([entry]);
    (unbound.cursorEvidence as any).selectedPrefix = null;
    expect(() => selectCompletedContinuation(unbound)).toThrow(
      /selected Cursor prefix snapshot/i,
    );

    const sliced = cursorCompletionDigest([entry]);
    sliced.accounting.rendered.count = 2;
    expect(() => selectCompletedContinuation(sliced)).toThrow(/complete/i);

    const invalidSuffixes = [
      {
        name: 'malformed',
        mutate(value: any) {
          value.cursorEvidence.blockingFrame = {
            frameIndex: 8,
            byteStart: 800,
            byteEnd: 820,
            parseState: 'malformed',
          };
          value.cursorEvidence.status.health = 'blocked';
          value.accounting.buffered.reason = 'malformed';
        },
      },
      {
        name: 'partial',
        mutate(value: any) {
          value.cursorEvidence.blockingFrame = {
            frameIndex: 8,
            byteStart: 800,
            byteEnd: 820,
            parseState: 'partial',
          };
          value.accounting.buffered.reason = 'partial';
        },
      },
      {
        name: 'tail-sliced',
        mutate(value: any) {
          value.accounting.rendered.count += 1;
        },
      },
      {
        name: 'discontinuous',
        mutate(value: any) {
          value.accounting.raw.toIndex -= 1;
        },
      },
      {
        name: 'unaccounted',
        mutate(value: any) {
          value.accounting.buffered.count -= 1;
        },
      },
    ];
    const validPending = cursorCompletionDigest(
      [
        {
          ...entry,
          recordIndex: 5,
          sourceFrameIndex: 4,
          entryKey: 'entry-assistant-4',
        },
      ],
      3,
      8,
    );
    validPending.range.toIndex = 5;
    validPending.range.nextIndex = 6;
    validPending.range.newFrames = 3;
    validPending.accounting.raw.toIndex = 5;
    validPending.accounting.raw.count = 3;
    validPending.accounting.raw.nextIndex = 6;
    validPending.accounting.filtered.metadataFrames = 0;
    validPending.accounting.buffered = {
      fromIndex: 6,
      count: 2,
      reason: 'stability-wait',
    };
    validPending.cursorEvidence.status.lifecycle = 'pending';
    validPending.cursorEvidence.bufferedFromFrame = 6;
    validPending.cursorEvidence.selectedPrefix.nextFrameIndex = 6;
    validPending.cursorEvidence.selectedPrefix.prefixBytes = 600;
    validPending.cursorEvidence.selectedPrefix.observedSize = 600;

    for (const invalid of invalidSuffixes) {
      const fixture = structuredClone(validPending);
      invalid.mutate(fixture);
      expect(() => selectCompletedContinuation(fixture), invalid.name).toThrow(
        /complete/i,
      );
    }
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

// ---------------------------------------------------------------------------
// Cross-skill regression: ask-user content must not strand a continuation
//
// session-observer renders Cursor questions as digest content. This selector
// requires every schema-v2 entry to be the final message of a terminal-success
// turn, so a question leaking into the confirmed-completion projection makes an
// otherwise valid collaboration turn `observer-invalid`.
// ---------------------------------------------------------------------------

describe('Cursor ask-user content and the confirmed-completion contract', () => {
  const FIXTURE_DIR = join(
    dirname(fileURLToPath(import.meta.url)),
    '../session-observer/fixtures/cursor',
  );

  /**
   * Drive the REAL production handoff. `observeCursorCompletion` builds the
   * confirmed-completion digest and attaches the selected-prefix envelope that
   * `selectCompletedContinuation` verifies; the synthetic
   * `cursorCompletionDigest()` helper invents both, so using it here would let
   * a regression in that handoff pass unnoticed.
   *
   * The fixture is copied to a temp dir because the lease reads by path and the
   * suite must leave the working tree clean.
   */
  async function observeFixture(
    name: string,
    run: (observed: any) => void | Promise<void>,
  ) {
    const tmpDir = await mkdtemp(join(tmpdir(), 'cursor-collab-'));
    try {
      const peerTranscript = join(tmpDir, name);
      await writeFile(
        peerTranscript,
        await readFile(join(FIXTURE_DIR, name), 'utf8'),
      );
      const observed: any = await observeCursorCompletion({
        peerSession: 'cursor-ask',
        ownerCwd: tmpDir,
        peerTranscript,
        peerCanonicalTranscriptPath: peerTranscript,
        peerCursor: 0,
        peerContinuity: null,
      });
      await run(observed);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  }

  test('a successful turn containing AskQuestion still selects a continuation', async () => {
    await observeFixture('ask-question.jsonl', (observed) => {
      // The question is observation-only content; the confirmed projection
      // keeps exactly the final message.
      expect(observed.entries).toHaveLength(1);
      expect(observed.entries[0].text).toBe(
        'Discovery is complete and committed.',
      );
      expect(observed.entries[0].kind).toBe('message');
      expect(observed.cursorEvidence.selectedPrefix).toBeTruthy();

      const result: any = selectCompletedContinuation(observed);
      expect(result.status).toBe('continuation');
      expect(result.continuation).toBe(true);
    });
  });

  test('a turn ending on the question yields no continuation, not observer-invalid', async () => {
    // Production shape `user → AskQuestion → turn_ended(success)`.
    await observeFixture('ask-question-final.jsonl', (observed) => {
      // The question is never promoted here...
      expect(observed.entries).toHaveLength(0);
      // ...but it stays reachable.
      expect(
        observed.accounting.recovery.omittedAssistantEntries.length,
      ).toBeGreaterThan(0);
      expect(observed.cursorEvidence.selectedPrefix).toBeTruthy();

      const result: any = selectCompletedContinuation(observed);
      expect(result.status).not.toBe('observer-invalid');
      expect(result.continuation).toBeFalsy();
    });
  });

  test('an ask-user entry in that projection would be rejected', async () => {
    // Guards the invariant itself: if ask-user content ever reaches the
    // confirmed projection again, this is the failure it produces.
    expect(() =>
      selectCompletedContinuation(
        cursorCompletionDigest([
          {
            role: 'assistant',
            text: '[AskQuestion] Gate — Proceed?',
            recordIndex: 5,
            sourceFrameIndex: 5,
            kind: 'ask_user',
            entryKey: 'entry-assistant-5',
            turnId: 'turn-3',
            availability: 'completed',
          },
          {
            role: 'assistant',
            text: 'Done.',
            recordIndex: 7,
            sourceFrameIndex: 6,
            kind: 'message',
            entryKey: 'entry-assistant-6',
            turnId: 'turn-3',
            availability: 'completed',
          },
        ]),
      ),
    ).toThrow(/confirmed-completion contract/);
  });
});
