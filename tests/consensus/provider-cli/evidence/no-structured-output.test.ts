import { writeFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { runProviderTurn } from '../../../../src/consensus/provider-cli/structured-output.js';
import type { ProviderProcessResult } from '../../../../src/consensus/provider-cli/subprocess.js';
import type { ConsensusCliRunRequest } from '../../../../src/consensus/provider-cli/types.js';

describe('submit evidence: no structured-output message', () => {
  it('converts a no-final-JSON turn into a captured verdict via submit', async () => {
    const submitted = await runProviderTurn(
      request({ provider: 'codex', max_attempts: 1 }),
      {
        readSchema: async () => schema(),
        async runSubprocess(_invocation, options) {
          const submitPath = options.env?.CONSENSUS_SUBMIT_FILE;
          if (!submitPath) throw new Error('Missing submit capture path');
          await writeFile(submitPath, '{"verdict":"submit"}', 'utf8');
          return codexTurnWithoutFinalJson();
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

    const control = await runProviderTurn(
      request({ provider: 'codex', max_attempts: 1 }),
      {
        readSchema: async () => schema(),
        runSubprocess: async () => codexTurnWithoutFinalJson(),
      },
    );

    expect(control).toMatchObject({
      ok: false,
      code: 'PROVIDER_INVALID_JSON',
      attempts: {
        cli_attempts: 1,
        terminal_reason: 'missing_provider_output',
      },
      diagnostics: {
        verdict_source: 'final_message',
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

function codexTurnWithoutFinalJson(): ProviderProcessResult {
  return {
    ok: true,
    stdout: '{"type":"turn.completed"}\n',
    stderr: '',
    last_message: '',
    exit_code: 0,
    signal: null,
    diagnostics: {},
  };
}
