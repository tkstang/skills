import { describe, expect, it } from 'vitest';

import type { DetailedTranscriptRecord, JsonObject } from '../runtimes.js';
import { extractActivity } from './extract.js';
import type { ActivitySource } from './types.js';

const SNAPSHOT = {
  capturedAt: '2026-09-20T00:00:00.000Z',
  sourceBytes: 0,
};

function detailed(
  record: JsonObject,
  recordIndex: number,
): DetailedTranscriptRecord {
  return {
    record,
    sourceCarrier: '{}',
    recordIndex,
    physicalLine: recordIndex + 1,
  };
}

function source(runtime: 'claude-code' | 'codex'): ActivitySource {
  return {
    runtime,
    sessionId: 'native-session',
    nativeSessionId: 'native-session',
    transcriptPath: '/fixture/session.jsonl',
  };
}

describe('captured-source token usage', () => {
  it('deduplicates Claude message blocks and preserves conflicts and missing-id uncertainty', () => {
    const usage = {
      input_tokens: 10,
      output_tokens: 4,
      cache_creation: { ephemeral_5m_input_tokens: 2 },
      service_tier: 'fixture-tier',
      server_tool_use: { web_search_requests: 3 },
    };
    const records = [
      detailed(
        {
          type: 'assistant',
          sessionId: 'native-session',
          message: { id: 'message-1', model: 'claude-fixture', usage },
        },
        0,
      ),
      detailed(
        {
          type: 'assistant',
          sessionId: 'native-session',
          message: { id: 'message-1', model: 'claude-fixture', usage },
        },
        1,
      ),
      detailed(
        {
          type: 'assistant',
          sessionId: 'native-session',
          message: {
            id: 'message-1',
            model: 'claude-fixture',
            usage: { ...usage, output_tokens: 9 },
          },
        },
        2,
      ),
      detailed(
        {
          type: 'assistant',
          sessionId: 'native-session',
          message: { usage: { input_tokens: 3, output_tokens: 1 } },
        },
        3,
      ),
      detailed(
        {
          type: 'assistant',
          sessionId: 'native-session',
          message: { usage: { input_tokens: 3, output_tokens: 1 } },
        },
        4,
      ),
      detailed(
        {
          type: 'assistant',
          sessionId: 'other-session',
          message: {
            id: 'other-message',
            model: 'wrong-session-model',
            usage: { input_tokens: 999 },
          },
        },
        5,
      ),
    ];

    const extracted = extractActivity({
      source: source('claude-code'),
      read: { ...SNAPSHOT, records, diagnostics: [] },
    });
    const metadata = extracted.sourceMetadata?.usage;

    expect(metadata?.availability).toBe('recorded');
    expect(metadata?.samples).toHaveLength(3);
    expect(metadata?.samples[0]).toMatchObject({
      semantics: 'claude-message',
      messageId: 'message-1',
      model: 'claude-fixture',
      tokens: {
        input_tokens: 10,
        output_tokens: 4,
        cache_creation: { ephemeral_5m_input_tokens: 2 },
      },
    });
    expect(metadata?.samples[0]?.tokens).not.toHaveProperty('service_tier');
    expect(metadata?.samples[0]?.tokens).not.toHaveProperty('server_tool_use');
    expect(metadata?.samples.slice(1)).toEqual([
      expect.objectContaining({
        uncertainty: 'missing-message-id',
        tokens: { input_tokens: 3, output_tokens: 1 },
      }),
      expect.objectContaining({
        uncertainty: 'missing-message-id',
        tokens: { input_tokens: 3, output_tokens: 1 },
      }),
    ]);
    expect(metadata?.diagnostics.map(({ code }) => code)).toEqual([
      'USAGE_CONFLICT',
      'USAGE_DEDUP_UNCERTAIN',
      'USAGE_DEDUP_UNCERTAIN',
      'USAGE_SESSION_MISMATCH',
    ]);
    expect(JSON.stringify(metadata)).not.toContain('wrong-session-model');
    expect(JSON.stringify(metadata)).not.toMatch(/price|cost|currency/iu);
  });

  it('keeps Codex cumulative, last-turn, and response usage separate across resets', () => {
    const tokenCount = (total: number, last: number): JsonObject => ({
      type: 'event_msg',
      payload: {
        type: 'token_count',
        info: {
          total_token_usage: { input_tokens: total - 10, total_tokens: total },
          last_token_usage: { input_tokens: last - 2, total_tokens: last },
        },
      },
    });
    const response = (
      responseId: string,
      turnId: string,
      total: number,
    ): JsonObject => ({
      type: 'token_usage_record',
      payload: {
        thread_id: 'native-session',
        session_id: 'root-session',
        response_id: responseId,
        turn_id: turnId,
        usage: { input_tokens: total - 1, total_tokens: total },
        turn_token_usage: { input_tokens: total - 2, total_tokens: total },
        thread_token_usage: { input_tokens: total - 3, total_tokens: total },
      },
    });
    const records = [
      detailed(
        {
          type: 'session_meta',
          payload: { id: 'native-session', session_id: 'root-session' },
        },
        0,
      ),
      detailed(
        {
          type: 'turn_context',
          payload: { turn_id: 'turn-1', model: 'gpt-fixture' },
        },
        1,
      ),
      detailed(tokenCount(100, 20), 2),
      detailed(tokenCount(100, 20), 3),
      detailed(tokenCount(80, 10), 4),
      detailed(response('response-1', 'turn-1', 12), 5),
      detailed(response('response-1', 'turn-1', 12), 6),
      detailed(response('response-1', 'turn-1', 15), 7),
      detailed(response('response-2', 'turn-unknown', 7), 8),
      detailed(
        {
          type: 'token_usage_record',
          payload: {
            thread_id: 'other-thread',
            session_id: 'root-session',
            response_id: 'wrong-session',
            usage: { total_tokens: 999 },
          },
        },
        9,
      ),
    ];

    const extracted = extractActivity({
      source: source('codex'),
      read: { ...SNAPSHOT, records, diagnostics: [] },
    });
    const metadata = extracted.sourceMetadata?.usage;

    expect(metadata?.samples.map(({ semantics }) => semantics)).toEqual([
      'codex-cumulative',
      'codex-last-turn',
      'codex-cumulative',
      'codex-last-turn',
      'codex-response',
      'codex-response',
    ]);
    expect(metadata?.samples.slice(0, 4).map(({ segment }) => segment)).toEqual(
      [0, 0, 1, 1],
    );
    expect(metadata?.samples.map(({ ownership }) => ownership)).toEqual([
      'owned',
      'owned',
      'owned',
      'owned',
      'owned',
      'owned',
    ]);
    expect(metadata?.samples[4]).toMatchObject({
      responseId: 'response-1',
      turnId: 'turn-1',
      model: 'gpt-fixture',
      tokens: {
        usage: { input_tokens: 11, total_tokens: 12 },
        turn_token_usage: { input_tokens: 10, total_tokens: 12 },
        thread_token_usage: { input_tokens: 9, total_tokens: 12 },
      },
    });
    expect(metadata?.samples[5]).not.toHaveProperty('model');
    expect(metadata?.diagnostics.map(({ code }) => code)).toEqual([
      'USAGE_COUNTER_RESET',
      'USAGE_CONFLICT',
      'USAGE_SESSION_MISMATCH',
    ]);
    expect(JSON.stringify(metadata)).not.toMatch(/price|cost|currency/iu);
  });

  it('labels inherited, owned, and unknown Codex counters without crossing ownership boundaries', () => {
    const tokenCount = (
      total: number,
      ordinal?: number,
    ): DetailedTranscriptRecord =>
      detailed(
        {
          ...(ordinal === undefined ? {} : { ordinal }),
          type: 'event_msg',
          payload: {
            type: 'token_count',
            info: {
              total_token_usage: { total_tokens: total },
              last_token_usage: { total_tokens: total / 10 },
            },
          },
        },
        total,
      );
    const records = [
      detailed(
        {
          ordinal: 0,
          type: 'session_meta',
          payload: {
            id: 'native-session',
            session_id: 'root-session',
            parent_thread_id: 'parent-thread',
            subagent_history_start_ordinal: 5,
          },
        },
        0,
      ),
      detailed(
        {
          ordinal: 4,
          type: 'turn_context',
          payload: { turn_id: 'cross-boundary-turn', model: 'parent-model' },
        },
        1,
      ),
      tokenCount(100, 2),
      tokenCount(120, 3),
      tokenCount(20, 6),
      tokenCount(10, 7),
      tokenCount(8),
      detailed(
        {
          ordinal: 8,
          type: 'token_usage_record',
          payload: {
            thread_id: 'native-session',
            session_id: 'root-session',
            response_id: 'owned-response',
            turn_id: 'cross-boundary-turn',
            usage: { total_tokens: 4 },
          },
        },
        8,
      ),
    ];

    const metadata = extractActivity({
      source: source('codex'),
      read: { ...SNAPSHOT, records, diagnostics: [] },
    }).sourceMetadata?.usage;

    expect(metadata?.samples.map(({ ownership }) => ownership)).toEqual([
      'inherited',
      'inherited',
      'inherited',
      'inherited',
      'owned',
      'owned',
      'owned',
      'owned',
      'unknown',
      'unknown',
      'owned',
    ]);
    expect(metadata?.diagnostics.map(({ code }) => code)).toEqual([
      'USAGE_COUNTER_RESET',
    ]);
    expect(metadata?.samples.at(-1)).not.toHaveProperty('model');
  });

  it('reports absence as not-recorded instead of zero', () => {
    const extracted = extractActivity({
      source: source('codex'),
      read: { ...SNAPSHOT, records: [], diagnostics: [] },
    });
    expect(extracted.sourceMetadata?.usage).toEqual({
      scope: 'captured-source',
      availability: 'not-recorded',
      samples: [],
      diagnostics: [],
    });
  });
});
