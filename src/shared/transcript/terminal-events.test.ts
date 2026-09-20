import { describe, expect, it } from 'vitest';

import type {
  CursorTranscriptAnalysis,
  CursorTurnAnalysis,
} from './cursor-analysis.js';
import type {
  DetailedTranscriptRead,
  DetailedTranscriptRecord,
  JsonObject,
} from './runtimes.js';
import {
  codexRetryEvidenceFragment,
  decodeCodexLifecycleRecord,
  extractCursorTerminalEvents,
  extractRecordedTerminalEvents,
} from './terminal-events.js';

function detailed(
  record: JsonObject,
  recordIndex: number,
): DetailedTranscriptRecord {
  return {
    record,
    recordIndex,
    physicalLine: recordIndex + 1,
    sourceCarrier: JSON.stringify(record),
  };
}

function read(records: JsonObject[]): DetailedTranscriptRead {
  return {
    records: records.map(detailed),
    diagnostics: [],
    capturedAt: '2026-09-20T12:00:00.000Z',
    sourceBytes: 1,
  };
}

function codexEvents(records: JsonObject[], fromIndex = 0) {
  return extractRecordedTerminalEvents({
    runtime: 'codex',
    sessionId: 'codex-session',
    nativeSessionId: 'codex-native-session',
    read: read(records),
    fromIndex,
    nextIndex: records.length,
  });
}

function claudeEvents(records: JsonObject[], fromIndex = 0) {
  return extractRecordedTerminalEvents({
    runtime: 'claude-code',
    sessionId: 'claude-session',
    nativeSessionId: 'claude-native-session',
    read: read(records),
    fromIndex,
    nextIndex: records.length,
  });
}

describe('Codex terminal decoding', () => {
  it('shares task lifecycle classification with activity and excludes success', () => {
    const started = detailed(
      { type: 'event_msg', payload: { type: 'task_started' } },
      0,
    );
    const completed = detailed(
      { type: 'event_msg', payload: { type: 'task_complete' } },
      1,
    );
    const failed = detailed(
      {
        type: 'event_msg',
        payload: {
          type: 'task_complete',
          error: { codex_error_info: 'response_too_large' },
        },
      },
      2,
    );
    const aborted = detailed(
      { type: 'event_msg', payload: { type: 'turn_aborted' } },
      3,
    );

    expect(decodeCodexLifecycleRecord(started)?.outcome).toBe('pending');
    expect(decodeCodexLifecycleRecord(completed)?.outcome).toBe('success');
    expect(decodeCodexLifecycleRecord(failed)?.outcome).toBe('error');
    expect(decodeCodexLifecycleRecord(aborted)?.outcome).toBe('cancelled');
    expect(
      codexEvents([
        started.record,
        completed.record,
        failed.record,
        aborted.record,
      ]).map((event) => [event.nativeType, event.status]),
    ).toEqual([
      ['task_complete', 'error'],
      ['turn_aborted', 'aborted'],
    ]);
  });

  it('retains only verified usage-limit retry suffix fragments and provenance', () => {
    const events = codexEvents([
      {
        type: 'event_msg',
        payload: {
          type: 'task_complete',
          error: {
            codex_error_info: 'usage_limit_exceeded',
            message: 'Provider limit; try again at Sep 19th, 2026 5:01 AM.',
          },
        },
      },
      {
        type: 'event_msg',
        payload: {
          type: 'task_complete',
          error: {
            codex_error_info: 'usage_limit_exceeded',
            message: 'Provider limit; try again at 9:30 AM.',
          },
        },
      },
    ]);

    expect(events).toEqual([
      expect.objectContaining({
        nativeErrorCode: 'usage_limit_exceeded',
        retryEvidence: {
          fragment: 'Sep 19th, 2026 5:01 AM',
          provenance: 'inferred-from-error-message',
          source: {
            indexBase: 'zero-based-jsonl-record-index',
            recordIndex: 0,
            physicalLine: 1,
            jsonPointer: '/payload/error/message',
          },
        },
      }),
      expect.objectContaining({
        retryEvidence: expect.objectContaining({ fragment: '9:30 AM' }),
      }),
    ]);
    expect(JSON.stringify(events)).not.toContain('Provider limit');
  });

  it.each([
    ['wrong code', 'response_too_large', 'try again at 9:30 AM.'],
    ['bad hour', 'usage_limit_exceeded', 'try again at 13:30 AM.'],
    ['bad minute', 'usage_limit_exceeded', 'try again at 9:99 AM.'],
    [
      'bad date',
      'usage_limit_exceeded',
      'try again at Feb 30th, 2026 9:30 AM.',
    ],
    [
      'bad ordinal',
      'usage_limit_exceeded',
      'try again at Sep 19st, 2026 9:30 AM.',
    ],
    ['trailing prose', 'usage_limit_exceeded', 'try again at 9:30 AM. Later.'],
    ['no suffix', 'usage_limit_exceeded', 'usage limit reached'],
  ])('rejects %s as retry evidence', (_name, code, message) => {
    const [event] = codexEvents([
      {
        type: 'event_msg',
        payload: {
          type: 'task_complete',
          error: { codex_error_info: code, message },
        },
      },
    ]);
    expect(event).not.toHaveProperty('retryEvidence');
  });

  it('accepts a valid bare calendar day without inventing an absolute instant', () => {
    expect(
      codexRetryEvidenceFragment(
        'Limit punctuation varies: try again at Sep 19, 2026 5:01 AM.',
      ),
    ).toBe('Sep 19, 2026 5:01 AM');
  });
});

describe('Claude Code terminal decoding', () => {
  const assistant = (overrides: JsonObject): JsonObject => ({
    type: 'assistant',
    sessionId: 'claude-session',
    message: { id: 'assistant-1', role: 'assistant', content: [] },
    ...overrides,
  });

  it.each([
    [{ isApiErrorMessage: true, apiErrorStatus: 429 }, 'api-error', 429],
    [{ isAbortedMidStream: true }, 'aborted-mid-stream', undefined],
    [{ truncatedAfterOutput: true }, 'truncated-after-output', undefined],
  ])('emits the explicit assistant flag %#', (flags, status, errorCode) => {
    const [event] = claudeEvents([assistant(flags)]);
    expect(event).toMatchObject({
      nativeType: 'assistant',
      status,
      source: { recordIndex: 0, physicalLine: 1 },
    });
    if (errorCode === undefined) {
      expect(event).not.toHaveProperty('nativeErrorCode');
    } else {
      expect(event.nativeErrorCode).toBe(errorCode);
    }
  });

  it('applies API error then abort then truncation precedence once per record', () => {
    expect(
      claudeEvents([
        assistant({
          isApiErrorMessage: true,
          isAbortedMidStream: true,
          truncatedAfterOutput: true,
        }),
        assistant({
          message: { id: 'assistant-2', role: 'assistant', content: [] },
          isAbortedMidStream: true,
          truncatedAfterOutput: true,
        }),
      ]).map((event) => event.status),
    ).toEqual(['api-error', 'aborted-mid-stream']);
  });

  it('ignores tool failures, error prose, stop reasons, and bare API status', () => {
    expect(
      claudeEvents([
        assistant({ apiErrorStatus: 500, error: 'private body' }),
        assistant({
          message: {
            id: 'assistant-2',
            role: 'assistant',
            stop_reason: 'error',
          },
        }),
        {
          type: 'user',
          sessionId: 'claude-session',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                is_error: true,
                content: 'private tool body',
              },
            ],
          },
          toolUseResult: { interrupted: true },
          toolDenialKind: 'user-rejected',
        },
      ]),
    ).toEqual([]);
  });

  it('joins a new interruption pointer to an earlier exact-session assistant', () => {
    const records = [
      assistant({}),
      {
        type: 'user',
        sessionId: 'claude-session',
        interruptedMessageId: 'assistant-1',
        message: { role: 'user', content: [] },
      },
    ];
    expect(claudeEvents(records, 1)).toEqual([
      expect.objectContaining({
        nativeType: 'user-interruption',
        status: 'interrupted',
        source: expect.objectContaining({
          recordIndex: 1,
          jsonPointer: '/interruptedMessageId',
        }),
      }),
    ]);
  });

  it('suppresses explicit-abort duplicates and orphan or cross-session pointers', () => {
    const records = [
      assistant({ isAbortedMidStream: true }),
      {
        type: 'assistant',
        sessionId: 'other-session',
        message: { id: 'other-assistant', role: 'assistant', content: [] },
      },
      ...['assistant-1', 'missing', 'other-assistant'].map(
        (interruptedMessageId) => ({
          type: 'user',
          sessionId: 'claude-session',
          interruptedMessageId,
          message: { role: 'user', content: [] },
        }),
      ),
    ];
    expect(claudeEvents(records, 2)).toEqual([]);
  });

  it('keeps a later recovery record from hiding the earlier failure', () => {
    const events = claudeEvents([
      assistant({ isApiErrorMessage: true, error: 'private failure body' }),
      {
        type: 'assistant',
        sessionId: 'claude-session',
        message: {
          id: 'assistant-2',
          role: 'assistant',
          content: [{ type: 'text', text: 'later recovery body' }],
        },
      },
    ]);
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events)).not.toMatch(/private|recovery body/u);
  });
});

describe('Cursor terminal decoding', () => {
  function turn(
    lifecycle: CursorTurnAnalysis['lifecycle'],
    terminalFrameIndex: number,
  ): CursorTurnAnalysis {
    return {
      turnId: `turn-${terminalFrameIndex}`,
      fromFrameIndex: terminalFrameIndex - 1,
      observedThroughFrame: terminalFrameIndex,
      assistantRecords: [],
      humanRecordIndexes: [],
      toolRecordIndexes: [],
      lifecycle,
      terminalFrameIndex,
      finalSubstantiveEntryKey: null,
    };
  }

  const analysis: CursorTranscriptAnalysis = {
    turns: [
      turn('success', 1),
      turn('error', 3),
      turn('aborted', 5),
      turn('cancelled', 7),
    ],
    metadataFrameIndexes: [],
    blockingFrame: null,
  };

  it('emits frame-located error, aborted, and cancelled outcomes only', () => {
    expect(
      extractCursorTerminalEvents({
        runtime: 'cursor',
        sessionId: 'cursor-session',
        nativeSessionId: 'cursor-session',
        analysis,
        fromIndex: 0,
        nextIndex: 8,
      }),
    ).toEqual([
      expect.objectContaining({
        status: 'error',
        source: expect.objectContaining({ frameIndex: 3, physicalLine: 4 }),
      }),
      expect.objectContaining({
        status: 'aborted',
        source: expect.objectContaining({ frameIndex: 5, physicalLine: 6 }),
      }),
      expect.objectContaining({
        status: 'cancelled',
        source: expect.objectContaining({ frameIndex: 7, physicalLine: 8 }),
      }),
    ]);
  });

  it('restricts events to the exact consumed frame range', () => {
    expect(
      extractCursorTerminalEvents({
        runtime: 'cursor',
        sessionId: 'cursor-session',
        nativeSessionId: 'cursor-session',
        analysis,
        fromIndex: 4,
        nextIndex: 7,
      }).map((event) => event.status),
    ).toEqual(['aborted']);
  });
});
