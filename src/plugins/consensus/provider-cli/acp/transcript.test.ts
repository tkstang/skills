import { describe, expect, it } from 'vitest';

import type { AcpTurnResult } from './transcript.js';
import {
  classifyAcpTurn,
  emptyTurnResult,
  parseAcpTurnResult,
  redactText,
  sanitizeTurnResult,
  serializeAcpTurnResult,
} from './transcript.js';

function turn(overrides: Partial<AcpTurnResult>): AcpTurnResult {
  return {
    ...emptyTurnResult(),
    session_id: 'session-1',
    phase: 'complete',
    prompt_sent: true,
    ...overrides,
  };
}

describe('AcpTurnResult serialization', () => {
  it('round-trips through adapter stdout', () => {
    const result = turn({
      stop_reason: 'end_turn',
      text: 'answer',
      denials: [{ tool: 'write_file', kind: 'edit', outcome: 'rejected' }],
      models: { config_model: 'm' },
      usage: { totalTokens: 3 },
    });

    expect(parseAcpTurnResult(serializeAcpTurnResult(result))).toEqual(result);
  });

  it('rejects stdout that is not a serialized turn', () => {
    expect(
      parseAcpTurnResult('{"type":"result","result":"hi"}'),
    ).toBeUndefined();
    expect(parseAcpTurnResult('not json')).toBeUndefined();
  });
});

describe('classifyAcpTurn', () => {
  it.each([
    [
      'a blank end_turn without denials',
      turn({ stop_reason: 'end_turn', text: ' \n' }),
      'PROVIDER_EMPTY_OUTPUT',
      'completed',
    ],
    [
      'max_tokens',
      turn({ stop_reason: 'max_tokens', text: 'partial' }),
      'PROVIDER_LIMIT_REACHED',
      'completed',
    ],
    [
      'max_turn_requests',
      turn({ stop_reason: 'max_turn_requests' }),
      'PROVIDER_LIMIT_REACHED',
      'completed',
    ],
    ['refusal', turn({ stop_reason: 'refusal' }), 'PROVIDER_EXIT', 'completed'],
    [
      'cancelled without a denial',
      turn({ stop_reason: 'cancelled' }),
      'PROVIDER_EXIT',
      'completed',
    ],
    [
      'a JSON-RPC error before the prompt',
      turn({
        phase: 'session_new',
        prompt_sent: false,
        error: {
          phase: 'session_new',
          kind: 'jsonrpc',
          code: -32603,
          message: 'boom',
        },
      }),
      'PROVIDER_EXIT',
      'not_started',
    ],
    [
      'a JSON-RPC error answering the prompt',
      turn({
        phase: 'prompt',
        error: {
          phase: 'prompt',
          kind: 'jsonrpc',
          code: -32603,
          message: 'boom',
        },
      }),
      'PROVIDER_EXIT',
      'unknown',
    ],
    [
      'a missing executable',
      turn({
        phase: 'spawn',
        prompt_sent: false,
        error: {
          phase: 'spawn',
          kind: 'spawn',
          errno: 'ENOENT',
          message: 'gone',
        },
      }),
      'PROVIDER_MISSING',
      'not_started',
    ],
    [
      'an interrupt during the prompt',
      turn({ phase: 'prompt', abort: 'interrupt' }),
      'PROVIDER_EXIT',
      'unknown',
    ],
  ])('fails %s', (_name, result, code, turnState) => {
    expect(classifyAcpTurn(result)).toMatchObject({
      ok: false,
      code,
      retryable: false,
      turn: turnState,
    });
  });

  it('prefers a matching error-text pattern over a nonblank answer', () => {
    const result = turn({
      stop_reason: 'end_turn',
      text: '\n⚠ agent executor error: generating and executing: Error 500',
    });

    expect(classifyAcpTurn(result).ok).toBe(true);
    expect(
      classifyAcpTurn(result, {
        errorTextPatterns: [
          { pattern: /agent executor error/i, code: 'PROVIDER_EXIT' },
        ],
      }),
    ).toMatchObject({
      ok: false,
      code: 'PROVIDER_EXIT',
      message:
        'The ACP agent reported an error instead of an answer: ⚠ agent executor error: generating and executing: Error 500',
    });
  });

  it('redacts credential shapes from the error line it reports', () => {
    const result = turn({
      stop_reason: 'end_turn',
      text: 'agent executor error: Bearer abcdefghijklmnopqrstuv',
    });

    const classification = classifyAcpTurn(result, {
      errorTextPatterns: [
        { pattern: /agent executor error/i, code: 'PROVIDER_EXIT' },
      ],
    });

    expect(classification).toMatchObject({
      ok: false,
      message:
        'The ACP agent reported an error instead of an answer: agent executor error: <redacted>',
    });
  });
});

describe('redactText', () => {
  it('removes credential values, default key shapes, and descriptor patterns', () => {
    const text =
      'key AIzaSyA1234567890abcdefghijk value s3cr3t-value code AB12-CD34 and AB12-CD34';

    expect(
      redactText(text, {
        secretValues: ['s3cr3t-value', 'abc'],
        patterns: [/[A-Z0-9]{4}-[A-Z0-9]{4}/],
      }),
    ).toBe('key <redacted> value <redacted> code <redacted> and <redacted>');
  });

  it('applies descriptor patterns to the answer text as well', () => {
    const sanitized = sanitizeTurnResult(
      turn({
        text: 'Log in with Your code: QZXW-7342 now. Bearer abcdefghijklmnopqrstuv',
      }),
      { patterns: [/(?<=Your code:\s*)[A-Z0-9]{4}-[A-Z0-9]{4}\b/g] },
    );

    expect(sanitized.text).toBe(
      'Log in with Your code: <redacted> now. Bearer abcdefghijklmnopqrstuv',
    );
  });

  it('keeps default credential shapes in the answer but removes literal secrets, and fully redacts agent metadata', () => {
    const sample = 'Bearer abcdefghijklmnopqrstuv';
    const sanitized = sanitizeTurnResult(
      turn({
        text: `Example header: ${sample}; key s3cret-value`,
        agent: { title: `${sample} s3cret-value` },
        denials: [{ tool: 'Write', kind: 'edit', outcome: 'rejected' }],
      }),
      { secretValues: ['s3cret-value'] },
    );

    expect(sanitized.text).toBe(`Example header: ${sample}; key <redacted>`);
    expect(sanitized.agent).toEqual({ title: '<redacted> <redacted>' });
    expect(sanitized.denials).toEqual([
      { tool: 'Write', kind: 'edit', outcome: 'rejected' },
    ]);
  });
});
