import { writeFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { providerRegistry } from '../../../../src/consensus/provider-cli/adapters.js';
import { runProviderTurn } from '../../../../src/consensus/provider-cli/structured-output.js';
import type { ProviderProcessResult } from '../../../../src/consensus/provider-cli/subprocess.js';
import type { ConsensusCliRunRequest } from '../../../../src/consensus/provider-cli/types.js';

describe('submit evidence: strict-output rejection', () => {
  it('converts a strict-output rejection into a captured verdict via submit', async () => {
    const submitted = await runProviderTurn(
      request({ provider: 'codex', max_attempts: 1 }),
      {
        readSchema: async () => schema(),
        async runSubprocess(invocation, options) {
          expect(invocation.argv).not.toContain('--output-schema');
          expect(invocation.argv).toContain('--output-last-message');
          const submitPath = options.env?.CONSENSUS_SUBMIT_FILE;
          if (!submitPath) throw new Error('Missing submit capture path');
          await writeFile(submitPath, '{"verdict":"submit"}', 'utf8');
          return strictOutputRejectedTurn();
        },
      },
    );

    expect(submitted).toMatchObject({
      ok: true,
      json: { verdict: 'submit' },
      attempts: {
        cli_attempts: 1,
        terminal_reason: 'success',
      },
      diagnostics: {
        verdict_source: 'submit',
      },
    });

    const legacyCodex = providerRegistry().get('codex')!;
    const control = await runProviderTurn(
      request({ provider: 'codex', max_attempts: 1 }),
      {
        registry: providerRegistry([
          {
            ...legacyCodex,
            capabilities: {
              ...legacyCodex.capabilities,
              schema_strategies: ['constrained_native'],
            },
          },
        ]),
        readSchema: async () => schema(),
        runSubprocess: async (invocation) => {
          expect(invocation.argv).toContain('--output-schema');
          return strictOutputRejectedBeforeTurn();
        },
      },
    );

    expect(control).toMatchObject({
      ok: false,
      code: 'PROVIDER_EXIT',
      attempts: {
        cli_attempts: 1,
        terminal_reason: 'provider_exit_terminal',
      },
      diagnostics: {
        strategy_used: 'constrained_native',
      },
    });
  });
});

function request(
  overrides: Partial<ConsensusCliRunRequest> = {},
): ConsensusCliRunRequest {
  return {
    schema_version: 'v1',
    provider: 'codex',
    schema_path: 'schema.json',
    prompt: 'Return JSON.',
    max_attempts: 1,
    ...overrides,
  };
}

function schema() {
  return {
    type: 'object',
    required: ['verdict'],
    properties: {
      verdict: { type: 'string' },
    },
  };
}

function strictOutputRejectedBeforeTurn(): ProviderProcessResult {
  return {
    ok: false,
    code: 'PROVIDER_EXIT',
    message:
      'OpenAI strict structured output rejected the requested schema before the peer turn started.',
    retryable: true,
    stdout: '',
    stderr:
      'OpenAI strict structured output rejected the requested schema before the peer turn started.',
    exit_code: 1,
    signal: null,
    diagnostics: {},
  };
}

function strictOutputRejectedTurn(): ProviderProcessResult {
  return {
    ok: true,
    stdout: '{"type":"turn.completed"}\n',
    stderr: '',
    last_message:
      'OpenAI strict structured output rejected the requested schema before final JSON was produced.',
    exit_code: 0,
    signal: null,
    diagnostics: {},
  };
}
