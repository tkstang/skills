import { describe, expect, it } from 'vitest';

import { providerRegistry } from '../../../src/consensus/provider-cli/adapters.js';
import {
  runProviderTurn,
  selectStructuredOutputStrategy,
} from '../../../src/consensus/provider-cli/structured-output.js';
import { processExitForEnvelope } from '../../../src/consensus/provider-cli/envelope.js';
import type { ProviderProcessResult } from '../../../src/consensus/provider-cli/subprocess.js';
import type {
  ConsensusCliRunRequest,
  ProviderId,
} from '../../../src/consensus/provider-cli/types.js';

describe('structured provider output coordinator', () => {
  it('selects constrained-native, provider-validated, and prompt-only strategies', () => {
    const registry = providerRegistry();

    expect(selectStructuredOutputStrategy(registry.get('codex')!)).toBe(
      'constrained_native',
    );
    expect(selectStructuredOutputStrategy(registry.get('claude')!)).toBe(
      'provider_validated',
    );
    expect(selectStructuredOutputStrategy(registry.get('cursor')!)).toBe(
      'prompt_only',
    );
  });

  it('keeps submit-tool candidate reserved and unselected by default', () => {
    const cursor = providerRegistry().get('cursor')!;

    expect(cursor.capabilities.schema_strategies).toContain(
      'submit_tool_candidate',
    );
    expect(selectStructuredOutputStrategy(cursor)).not.toBe(
      'submit_tool_candidate',
    );
  });

  it('re-invokes after invalid JSON within the CLI attempt budget', async () => {
    const subprocess = fakeSubprocess([
      processSuccess('not json'),
      processSuccess('{"verdict":"accept"}'),
    ]);

    const envelope = await runProviderTurn(request(), {
      readSchema: async () => schema(),
      runSubprocess: subprocess.run,
    });

    expect(envelope).toMatchObject({
      ok: true,
      json: { verdict: 'accept' },
      attempts: {
        cli_attempts: 2,
        terminal_reason: 'success',
      },
    });
    expect(subprocess.prompts).toHaveLength(2);
  });

  it('re-prompts with validation feedback after schema subset failures', async () => {
    const subprocess = fakeSubprocess([
      processSuccess('{"other":"value"}'),
      processSuccess('{"verdict":"accept"}'),
    ]);

    const envelope = await runProviderTurn(request(), {
      readSchema: async () => schema(),
      runSubprocess: subprocess.run,
    });

    expect(envelope.ok).toBe(true);
    expect(subprocess.prompts[1]).toContain('Schema validation failed');
    expect(envelope.attempts.cli_attempts).toBe(2);
  });

  it('retries retryable provider exits and stops on timeout classifications', async () => {
    const subprocess = fakeSubprocess([
      processFailure('PROVIDER_EXIT', true, {
        stderr: 'temporary unavailable, try again',
      }),
      processSuccess('{"verdict":"accept"}'),
    ]);

    await expect(
      runProviderTurn(request({ provider: 'codex' }), {
        readSchema: async () => schema(),
        runSubprocess: subprocess.run,
      }),
    ).resolves.toMatchObject({
      ok: true,
      attempts: { cli_attempts: 2 },
    });

    await expect(
      runProviderTurn(request({ provider: 'codex' }), {
        readSchema: async () => schema(),
        runSubprocess: fakeSubprocess([
          processFailure('PROVIDER_TIMEOUT', false),
          processSuccess('{"verdict":"accept"}'),
        ]).run,
      }),
    ).resolves.toMatchObject({
      ok: false,
      code: 'PROVIDER_TIMEOUT',
      attempts: { cli_attempts: 1 },
    });
  });

  it('does not retry adapter-classified terminal provider exits', async () => {
    await expect(
      runProviderTurn(request({ provider: 'claude' }), {
        readSchema: async () => schema(),
        runSubprocess: fakeSubprocess([
          processFailure('PROVIDER_EXIT', true, {
            stderr: 'authentication required',
          }),
          processSuccess('{"verdict":"accept"}'),
        ]).run,
      }),
    ).resolves.toMatchObject({
      ok: false,
      code: 'PROVIDER_AUTH_REQUIRED',
      attempts: {
        cli_attempts: 1,
        terminal_reason: 'provider_auth_required',
      },
    });

    await expect(
      runProviderTurn(request({ provider: 'codex' }), {
        readSchema: async () => schema(),
        runSubprocess: fakeSubprocess([
          processFailure('PROVIDER_EXIT', true, {
            stderr: 'unknown option: --approval-policy',
          }),
          processSuccess('{"verdict":"accept"}'),
        ]).run,
      }),
    ).resolves.toMatchObject({
      ok: false,
      code: 'PROVIDER_UNSUPPORTED_OPTION',
      attempts: {
        cli_attempts: 1,
        terminal_reason: 'provider_unsupported_option',
      },
    });

    await expect(
      runProviderTurn(request({ provider: 'cursor' }), {
        readSchema: async () => schema(),
        runSubprocess: fakeSubprocess([
          processFailure('PROVIDER_EXIT', true, {
            stderr: 'fatal local configuration error',
          }),
          processSuccess('{"verdict":"accept"}'),
        ]).run,
      }),
    ).resolves.toMatchObject({
      ok: false,
      code: 'PROVIDER_EXIT',
      attempts: {
        cli_attempts: 1,
        terminal_reason: 'provider_exit_terminal',
      },
    });
  });

  it('applies the default non-interactive runtime policy before invocation', async () => {
    const subprocess = fakeSubprocess([
      processSuccess('{"verdict":"accept"}'),
    ]);

    await expect(
      runProviderTurn(request({ provider: 'codex' }), {
        readSchema: async () => schema(),
        runSubprocess: subprocess.run,
      }),
    ).resolves.toMatchObject({ ok: true });

    expect(subprocess.invocations[0]?.argv).toEqual(
      expect.arrayContaining(['--approval-policy', 'never']),
    );
  });

  it('emits terminal ok:false envelopes that still exit process 0', async () => {
    const envelope = await runProviderTurn(request({ max_attempts: 1 }), {
      readSchema: async () => schema(),
      runSubprocess: fakeSubprocess([processSuccess('not json')]).run,
    });

    expect(envelope).toMatchObject({
      ok: false,
      code: 'PROVIDER_INVALID_JSON',
      retryable: false,
      attempts: {
        cli_attempts: 1,
        terminal_reason: 'invalid_json',
      },
    });
    expect(processExitForEnvelope(envelope)).toBe(0);
  });
});

function request(
  overrides: Partial<ConsensusCliRunRequest> = {},
): ConsensusCliRunRequest {
  return {
    schema_version: 'v1',
    provider: 'claude',
    schema_path: 'schema.json',
    prompt: 'Return JSON.',
    max_attempts: 2,
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

function fakeSubprocess(results: ProviderProcessResult[]) {
  const prompts: string[] = [];
  const invocations: Array<{ argv: string[]; stdin: string }> = [];

  return {
    prompts,
    invocations,
    async run(invocation: { argv: string[]; stdin: string }) {
      prompts.push(invocation.stdin);
      invocations.push(invocation);
      const result = results.shift();
      if (!result) throw new Error('Unexpected subprocess invocation');
      return result;
    },
  };
}

function processSuccess(stdout: string): ProviderProcessResult {
  return {
    ok: true,
    stdout,
    stderr: '',
    exit_code: 0,
    signal: null,
    diagnostics: {
      strategy_used: 'prompt_only',
      output_mode: 'stdout_json',
      redacted_command: ['provider'],
    },
  };
}

function processFailure(
  code: Extract<
    ProviderProcessResult,
    { ok: false }
  >['code'],
  retryable: boolean,
  overrides: Partial<Extract<ProviderProcessResult, { ok: false }>> = {},
): ProviderProcessResult {
  return {
    ok: false,
    code,
    message: code,
    retryable,
    stdout: '',
    stderr: '',
    exit_code: code === 'PROVIDER_EXIT' ? 1 : null,
    signal: null,
    diagnostics: {
      strategy_used: 'prompt_only',
      output_mode: 'stdout_json',
      redacted_command: ['provider'],
    },
    ...overrides,
  };
}
