import { describe, expect, it } from 'vitest';

import {
  ConsensusError,
  VERDICT_CAPS,
  invokeProviderCliWithRetry,
} from '../../../src/consensus/core/consensus-loop.js';

function validAccept() {
  return {
    json: {
      schema_version: 'v1',
      verdict: 'ACCEPT',
      reasoning: 'accepted',
    },
    raw_provider_response: '{"verdict":"ACCEPT"}',
    attempts: { cli_attempts: 1, terminal_reason: 'success', retryable: false },
  };
}

function exhaustedProviderError(code: string) {
  return new ConsensusError(`provider failed with ${code}`, {
    code,
    details: {
      attempts: {
        cli_attempts: 3,
        terminal_reason: code.toLowerCase(),
        retryable: false,
      },
    },
  });
}

describe('provider CLI retry boundary', () => {
  it('does not retry terminal provider-tier failures after CLI exhaustion', async () => {
    let calls = 0;

    await expect(
      invokeProviderCliWithRetry(
        { provider: 'cursor', schemaPath: 'schema.json', prompt: 'prompt' },
        {
          mode: 'alternating',
          attempts: 3,
          sleep: async () => {},
          invoke: async () => {
            calls += 1;
            throw exhaustedProviderError('PROVIDER_AUTH_REQUIRED');
          },
        },
      ),
    ).rejects.toSatisfy((error: { code?: string }) => {
      expect(error.code).toBe('PROVIDER_AUTH_REQUIRED');
      return true;
    });

    expect(calls).toBe(1);
  });

  it('keeps loop retries for invalid verdict shape', async () => {
    let calls = 0;
    const result = await invokeProviderCliWithRetry(
      { provider: 'claude', schemaPath: 'schema.json', prompt: 'prompt' },
      {
        mode: 'alternating',
        attempts: 3,
        sleep: async () => {},
        invoke: async () => {
          calls += 1;
          if (calls === 1) {
            return {
              json: {
                schema_version: 'v1',
                verdict: 'REVISE',
                reasoning: 'missing proposed artifact',
              },
            };
          }
          return validAccept();
        },
      },
    );

    expect(result.json).toMatchObject({ verdict: 'ACCEPT' });
    expect(calls).toBe(2);
  });

  it('keeps loop retries for invalid verdict caps', async () => {
    let calls = 0;
    const result = await invokeProviderCliWithRetry(
      { provider: 'claude', schemaPath: 'schema.json', prompt: 'prompt' },
      {
        mode: 'alternating',
        attempts: 3,
        sleep: async () => {},
        invoke: async () => {
          calls += 1;
          if (calls === 1) {
            return {
              json: {
                schema_version: 'v1',
                verdict: 'ACCEPT',
                reasoning: 'x'.repeat(VERDICT_CAPS.reasoning_bytes + 1),
              },
            };
          }
          return validAccept();
        },
      },
    );

    expect(result.json).toMatchObject({ verdict: 'ACCEPT' });
    expect(calls).toBe(2);
  });

  it('does not repeat provider invalid-json schema or timeout retries', async () => {
    for (const code of [
      'PROVIDER_INVALID_JSON',
      'PROVIDER_SCHEMA_VALIDATION',
      'PROVIDER_TIMEOUT',
    ]) {
      let calls = 0;
      await expect(
        invokeProviderCliWithRetry(
          { provider: 'codex', schemaPath: 'schema.json', prompt: 'prompt' },
          {
            mode: 'alternating',
            attempts: 3,
            sleep: async () => {},
            invoke: async () => {
              calls += 1;
              throw exhaustedProviderError(code);
            },
          },
        ),
      ).rejects.toSatisfy((error: { code?: string }) => {
        expect(error.code).toBe(code);
        return true;
      });
      expect(calls, code).toBe(1);
    }
  });
});
