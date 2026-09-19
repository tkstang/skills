import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { readRecordsDetailed } from '../runtimes.js';
import { classifyNativeName } from './classify.js';
import { correlateActivity } from './correlate.js';
import { extractActivity } from './extract.js';
import type {
  ActivitySource,
  ExtractedActivity,
  ExtractedActivityEvent,
} from './types.js';

const FIXTURE_ROOT = fileURLToPath(
  new URL('../fixtures/session-fidelity/', import.meta.url),
);

const CLAUDE_SOURCE: ActivitySource = {
  runtime: 'claude-code',
  sessionId: 'fixture-claude-session',
  nativeSessionId: 'fixture-claude-session',
  transcriptPath: '/fixture/claude.jsonl',
};

const CODEX_SOURCE: ActivitySource = {
  runtime: 'codex',
  sessionId: '77777777-7777-4777-8777-777777777777',
  nativeSessionId: '88888888-8888-4888-8888-888888888888',
  transcriptPath: `${FIXTURE_ROOT}codex/captured-activity.jsonl`,
};

function event(
  eventKey: string,
  kind: ExtractedActivityEvent['kind'],
  recordIndex: number,
  fields: Partial<ExtractedActivityEvent> = {},
): ExtractedActivityEvent {
  return {
    eventKey,
    kind,
    nativeType: kind,
    locator: {
      recordIndex,
      physicalLine: recordIndex + 1,
      jsonPointer: '/payload',
    },
    outcome: 'unknown',
    ...fields,
  };
}

function activity(
  source: ActivitySource,
  events: ExtractedActivityEvent[],
): ExtractedActivity {
  return {
    activitySchemaVersion: 1,
    source,
    events,
    coverage: [],
    diagnostics: [],
  };
}

describe('native activity classification', () => {
  it.each([
    ['Bash', 'shell'],
    ['Read', 'read'],
    ['Write', 'write'],
    ['apply_patch', 'edit'],
    ['Grep', 'grep'],
    ['Glob', 'glob'],
    ['web_search', 'search'],
    ['WebFetch', 'fetch'],
    ['spawn_agent', 'task'],
    ['send_message', 'task'],
    ['wait_agent', 'task'],
    ['interrupt_agent', 'task'],
    ['followup_task', 'task'],
    ['list_agents', 'task'],
    ['multi_agent_v1__spawn_agent', 'task'],
    ['request_user_input', 'ask'],
    ['request_user_input_async', 'ask'],
    ['mcp__unlisted_server__brand_new_tool', 'mcp'],
    ['unknown_tool', 'other'],
    ['mcp_unrecognized_shape', 'other'],
  ] as const)('classifies %s as %s', (nativeName, category) => {
    expect(classifyNativeName(nativeName)).toBe(category);
  });

  it('preserves an unrecognized MCP native name as generic MCP evidence', () => {
    const nativeName = 'mcp__unlisted_server__brand_new_tool';
    const correlated = correlateActivity(
      activity(CLAUDE_SOURCE, [
        event('mcp-call', 'call', 0, {
          nativeType: 'tool_use',
          nativeName,
          nativeCallId: 'mcp-call-id',
          outcome: 'pending',
        }),
      ]),
    );

    expect(correlated.events[0]).toMatchObject({
      nativeName,
      category: 'mcp',
      ownership: 'owned',
    });
  });
});

describe('explicit native correlation', () => {
  it('excludes inherited Codex calls from counted child invocations', async () => {
    const read = await readRecordsDetailed(CODEX_SOURCE.transcriptPath);
    const correlated = correlateActivity(
      extractActivity({ source: CODEX_SOURCE, read }),
    );
    const calls = correlated.events.filter(
      (candidate) => candidate.kind === 'call',
    );

    expect(calls.map((candidate) => candidate.ownership)).toEqual([
      'inherited',
      'owned',
      'owned',
    ]);
    expect(calls.map((candidate) => candidate.category)).toEqual([
      'shell',
      'shell',
      'edit',
    ]);
    expect(correlated.correlationCounts.responseStreamCalls).toEqual({
      captured: 3,
      counted: 2,
      owned: 2,
      inherited: 1,
      unknown: 0,
    });
    expect(correlated.correlationCounts.results).toEqual({
      matched: 3,
      unmatched: 0,
    });
    expect(correlated.correlationCounts.itemEvidence).toEqual({
      linked: 0,
      standalone: 4,
    });
  });

  it('links late and multiple outputs only to one explicit call id', () => {
    const correlated = correlateActivity(
      activity(CLAUDE_SOURCE, [
        event('call-a', 'call', 0, {
          nativeType: 'tool_use',
          nativeCallId: 'call-a-id',
          nativeName: 'Read',
          outcome: 'pending',
        }),
        event('call-b', 'call', 1, {
          nativeType: 'tool_use',
          nativeCallId: 'call-b-id',
          nativeName: 'Read',
          outcome: 'pending',
        }),
        event('result-a-late-1', 'result', 8, {
          nativeType: 'tool_result',
          nativeCallId: 'call-a-id',
          outcome: 'success',
        }),
        event('result-a-late-2', 'result', 10, {
          nativeType: 'tool_result',
          nativeCallId: 'call-a-id',
          outcome: 'error',
        }),
        event('unmatched-result', 'result', 11, {
          nativeType: 'tool_result',
          nativeCallId: 'missing-call-id',
        }),
      ]),
    );

    expect(
      correlated.events
        .filter((candidate) => candidate.kind === 'result')
        .map((candidate) => candidate.relatedCallKey),
    ).toEqual(['call-a', 'call-a', undefined]);
    expect(correlated.correlationCounts.results).toEqual({
      matched: 2,
      unmatched: 1,
    });
    expect(correlated.correlationCounts.responseStreamCalls.captured).toBe(2);
  });

  it('leaves reused native ids ambiguous instead of choosing by order', () => {
    const correlated = correlateActivity(
      activity(CLAUDE_SOURCE, [
        event('duplicate-call-1', 'call', 0, {
          nativeCallId: 'duplicate-id',
          nativeName: 'Bash',
        }),
        event('duplicate-call-2', 'call', 1, {
          nativeCallId: 'duplicate-id',
          nativeName: 'Bash',
        }),
        event('duplicate-result', 'result', 2, {
          nativeCallId: 'duplicate-id',
          outcome: 'error',
        }),
      ]),
    );

    expect(correlated.events[2].relatedCallKey).toBeUndefined();
    expect(correlated.diagnostics).toContainEqual({
      code: 'AMBIGUOUS_NATIVE_CORRELATION',
      locator: correlated.events[0].locator,
      field: 'nativeCallId',
      nativeId: 'duplicate-id',
    });
  });

  it('keeps process launch and poll calls as independent pending invocations', () => {
    const correlated = correlateActivity(
      activity(CLAUDE_SOURCE, [
        event('launch-call', 'call', 0, {
          nativeCallId: 'launch-id',
          nativeName: 'exec_command',
          arguments: { cmd: 'long task' },
          outcome: 'pending',
        }),
        event('launch-result', 'result', 1, {
          nativeCallId: 'launch-id',
          result: { sessionId: 'process-handle', status: 'running' },
          outcome: 'pending',
        }),
        event('poll-call', 'call', 2, {
          nativeCallId: 'poll-id',
          nativeName: 'write_stdin',
          arguments: { sessionId: 'process-handle', chars: '' },
          outcome: 'pending',
        }),
        event('poll-result', 'result', 3, {
          nativeCallId: 'poll-id',
          outcome: 'unknown',
        }),
      ]),
    );

    expect(correlated.events[1].relatedCallKey).toBe('launch-call');
    expect(correlated.events[3].relatedCallKey).toBe('poll-call');
    expect(correlated.events[0].outcome).toBe('pending');
    expect(correlated.events[2].outcome).toBe('pending');
    expect(correlated.correlationCounts.responseStreamCalls.captured).toBe(2);
  });

  it('links cross-stream item evidence only through corroborated native ids', () => {
    const correlated = correlateActivity(
      activity(CLAUDE_SOURCE, [
        event('stream-call', 'call', 0, {
          nativeId: 'response-item-id',
          nativeCallId: 'call-id',
          nativeName: 'exec_command',
          outcome: 'pending',
        }),
        event('linked-by-item-id', 'item', 1, {
          nativeType: 'CommandExecution',
          nativeId: 'response-item-id',
          outcome: 'error',
        }),
        event('linked-by-call-id', 'item', 2, {
          nativeType: 'CommandExecution',
          nativeCallId: 'call-id',
          outcome: 'success',
        }),
        event('similar-but-unlinked', 'item', 3, {
          nativeType: 'CommandExecution',
          nativeId: 'different-id',
          nativeName: 'exec_command',
          turnId: 'same-turn',
          outcome: 'error',
        }),
      ]),
    );

    expect(correlated.events[1].relatedCallKey).toBe('stream-call');
    expect(correlated.events[2].relatedCallKey).toBe('stream-call');
    expect(correlated.events[3].relatedCallKey).toBeUndefined();
    expect(correlated.events[0].outcome).toBe('pending');
    expect(correlated.correlationCounts.itemEvidence).toEqual({
      linked: 2,
      standalone: 1,
    });
  });

  it('retains item_completed call_id for exact cross-stream correlation', () => {
    const extracted = extractActivity({
      source: CODEX_SOURCE,
      read: {
        records: [
          {
            record: {
              type: 'session_meta',
              payload: { id: CODEX_SOURCE.nativeSessionId },
            },
            recordIndex: 0,
            physicalLine: 1,
          },
          {
            record: {
              type: 'response_item',
              payload: {
                type: 'function_call',
                id: 'response-item-id',
                call_id: 'shared-call-id',
                name: 'exec_command',
                arguments: '{}',
              },
            },
            recordIndex: 1,
            physicalLine: 2,
          },
          {
            record: {
              type: 'event_msg',
              payload: {
                type: 'item_completed',
                item: {
                  type: 'CommandExecution',
                  id: 'standalone-item-id',
                  call_id: 'shared-call-id',
                  status: 'failed',
                },
              },
            },
            recordIndex: 2,
            physicalLine: 3,
          },
        ],
        diagnostics: [],
      },
    });
    const correlated = correlateActivity(extracted);

    expect(correlated.events[2]).toMatchObject({
      nativeType: 'CommandExecution',
      nativeCallId: 'shared-call-id',
      relatedCallKey: correlated.events[1].eventKey,
      outcome: 'error',
    });
  });

  it('rejects conflicting explicit item identifiers without choosing one', () => {
    const correlated = correlateActivity(
      activity(CLAUDE_SOURCE, [
        event('call-by-call-id', 'call', 0, {
          nativeId: 'response-a',
          nativeCallId: 'call-a',
          nativeName: 'exec_command',
        }),
        event('call-by-native-id', 'call', 1, {
          nativeId: 'response-b',
          nativeCallId: 'call-b',
          nativeName: 'apply_patch',
        }),
        event('conflicting-item', 'item', 2, {
          nativeType: 'CommandExecution',
          nativeCallId: 'call-a',
          nativeId: 'response-b',
        }),
      ]),
    );

    expect(correlated.events[2].relatedCallKey).toBeUndefined();
    expect(correlated.diagnostics).toContainEqual({
      code: 'AMBIGUOUS_NATIVE_CORRELATION',
      locator: correlated.events[2].locator,
      field: 'nativeCallId+nativeId',
    });
  });

  it('keeps child ownership unknown when the boundary is absent or conflicting', () => {
    const sessionMeta = (
      eventKey: string,
      recordIndex: number,
      boundary?: number,
    ): ExtractedActivityEvent =>
      event(eventKey, 'metadata', recordIndex, {
        nativeType: 'session_meta',
        metadata: {
          nativeSessionId: CODEX_SOURCE.nativeSessionId,
          directParentThreadId: 'fixture-parent',
          directParentMarkerPresent: true,
          subagentHistoryStartOrdinalPresent: boundary !== undefined,
          ...(boundary === undefined
            ? {}
            : { subagentHistoryStartOrdinal: boundary }),
        },
      });
    const ownedCall = event('child-call', 'call', 2, {
      nativeCallId: 'child-call-id',
      nativeName: 'exec_command',
      locator: {
        recordIndex: 2,
        physicalLine: 3,
        jsonPointer: '/payload',
        ordinal: 7,
      },
    });

    const absent = correlateActivity(
      activity(CODEX_SOURCE, [sessionMeta('meta', 0), ownedCall]),
    );
    const conflicting = correlateActivity(
      activity(CODEX_SOURCE, [
        sessionMeta('meta-1', 0, 5),
        sessionMeta('meta-2', 1, 6),
        ownedCall,
      ]),
    );

    expect(absent.events[1].ownership).toBe('unknown');
    expect(absent.correlationCounts.responseStreamCalls.counted).toBe(0);
    expect(conflicting.events[2].ownership).toBe('unknown');
    expect(conflicting.correlationCounts.responseStreamCalls.counted).toBe(0);
  });

  it('requires complete and agreeing child lineage before counting ownership', () => {
    const call = event('child-call', 'call', 1, {
      nativeCallId: 'child-call-id',
      nativeName: 'exec_command',
      locator: {
        recordIndex: 1,
        physicalLine: 2,
        jsonPointer: '/payload',
        ordinal: 8,
      },
    });
    const metadataEvent = (
      eventKey: string,
      metadata: Record<string, unknown>,
    ): ExtractedActivityEvent =>
      event(eventKey, 'metadata', 0, {
        nativeType: 'session_meta',
        metadata: {
          nativeSessionId: CODEX_SOURCE.nativeSessionId,
          ...metadata,
        },
      });

    const boundaryWithoutParent = correlateActivity(
      activity(CODEX_SOURCE, [
        metadataEvent('missing-parent', {
          subagentHistoryStartOrdinalPresent: true,
          subagentHistoryStartOrdinal: 5,
        }),
        call,
      ]),
    );
    const conflictingParents = correlateActivity(
      extractActivity({
        source: CODEX_SOURCE,
        read: {
          records: [
            {
              record: {
                type: 'session_meta',
                payload: {
                  id: CODEX_SOURCE.nativeSessionId,
                  parent_thread_id: 'parent-a',
                  subagent_history_start_ordinal: 5,
                  source: {
                    subagent: {
                      thread_spawn: { parent_thread_id: 'parent-b' },
                    },
                  },
                },
              },
              recordIndex: 0,
              physicalLine: 1,
            },
            {
              record: {
                type: 'response_item',
                ordinal: 8,
                payload: {
                  type: 'function_call',
                  call_id: 'child-call-id',
                  name: 'exec_command',
                  arguments: '{}',
                },
              },
              recordIndex: 1,
              physicalLine: 2,
            },
          ],
          diagnostics: [],
        },
      }),
    );
    const incompleteNestedParent = correlateActivity(
      activity(CODEX_SOURCE, [
        metadataEvent('invalid-nested-parent', {
          subagentMarkerPresent: true,
          nestedParentMarkerPresent: true,
        }),
        call,
      ]),
    );
    const invalidSecondParent = correlateActivity(
      activity(CODEX_SOURCE, [
        metadataEvent('invalid-second-parent', {
          directParentMarkerPresent: true,
          directParentThreadId: 'parent-a',
          nestedParentMarkerPresent: true,
          subagentMarkerPresent: true,
          subagentHistoryStartOrdinalPresent: true,
          subagentHistoryStartOrdinal: 5,
        }),
        call,
      ]),
    );

    for (const correlated of [
      boundaryWithoutParent,
      conflictingParents,
      incompleteNestedParent,
      invalidSecondParent,
    ]) {
      expect(correlated.events[1].ownership).toBe('unknown');
      expect(correlated.correlationCounts.responseStreamCalls.counted).toBe(0);
    }
  });
});
