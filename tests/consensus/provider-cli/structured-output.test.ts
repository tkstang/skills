import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { providerRegistry } from '../../../src/consensus/provider-cli/adapters.js';
import {
  runProviderTurn,
  selectStructuredOutputStrategy,
} from '../../../src/consensus/provider-cli/structured-output.js';
import { processExitForEnvelope } from '../../../src/consensus/provider-cli/envelope.js';
import type { ProviderInvocation } from '../../../src/consensus/provider-cli/invocation.js';
import type {
  ProviderProcessResult,
  RunProviderSubprocessOptions,
} from '../../../src/consensus/provider-cli/subprocess.js';
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
    expect(cursor.capabilities.supports_submit_tool).toBe(false);
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

    const envelope = await runProviderTurn(request({ provider: 'cursor' }), {
      readSchema: async () => schema(),
      runSubprocess: subprocess.run,
    });

    expect(envelope.ok).toBe(true);
    expect(subprocess.prompts[1]).toContain('Schema validation failed');
    expect(envelope.attempts.cli_attempts).toBe(2);
  });

  it('retries a transient provider exit without mutating the prompt', async () => {
    const subprocess = fakeSubprocess([
      processFailure('PROVIDER_EXIT', true, {
        stderr: 'temporary unavailable, try again',
      }),
      processSuccess('{"verdict":"accept"}'),
    ]);

    const envelope = await runProviderTurn(request({ provider: 'cursor' }), {
      readSchema: async () => schema(),
      runSubprocess: subprocess.run,
    });

    expect(envelope).toMatchObject({
      ok: true,
      attempts: { cli_attempts: 2 },
    });
    expect(subprocess.prompts).toHaveLength(2);
    expect(subprocess.prompts[1]).toBe(subprocess.prompts[0]);
  });

  it('adds schema instructions to prompt-only provider prompts', async () => {
    const subprocess = fakeSubprocess([
      processSuccess('{"verdict":"accept"}'),
    ]);

    const envelope = await runProviderTurn(request({ provider: 'cursor' }), {
      readSchema: async () => schema(),
      runSubprocess: subprocess.run,
    });

    expect(envelope.ok).toBe(true);
    expect(subprocess.prompts[0]).toContain('Structured output requirements');
    expect(subprocess.prompts[0]).toContain('<JSON_SCHEMA>');
    expect(subprocess.prompts[0]).toContain('"required":["verdict"]');
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

  it('does not retry an unknown-signature provider exit within max_attempts', async () => {
    const subprocess = fakeSubprocess([
      processFailure('PROVIDER_EXIT', true, {
        stderr: 'boom',
      }),
      processSuccess('{"verdict":"accept"}'),
    ]);

    const envelope = await runProviderTurn(
      request({ provider: 'cursor', max_attempts: 3 }),
      {
        readSchema: async () => schema(),
        runSubprocess: subprocess.run,
      },
    );

    expect(envelope).toMatchObject({
      ok: false,
      code: 'PROVIDER_EXIT',
      attempts: {
        cli_attempts: 1,
        terminal_reason: 'provider_exit_terminal',
      },
    });
    expect(subprocess.prompts).toHaveLength(1);
  });

  it('records which exit classification fired in diagnostics', async () => {
    const transientEnvelope = await runProviderTurn(
      request({ provider: 'cursor' }),
      {
        readSchema: async () => schema(),
        runSubprocess: fakeSubprocess([
          processFailure('PROVIDER_EXIT', true, {
            stderr: 'temporary unavailable, try again',
          }),
          processSuccess('{"verdict":"accept"}'),
        ]).run,
      },
    );

    expect(transientEnvelope).toMatchObject({
      ok: true,
      diagnostics: {
        exit_classification: 'transient',
      },
    });

    const unknownEnvelope = await runProviderTurn(
      request({ provider: 'cursor', max_attempts: 3 }),
      {
        readSchema: async () => schema(),
        runSubprocess: fakeSubprocess([
          processFailure('PROVIDER_EXIT', true, {
            stderr: 'sensitive provider stderr: token-123',
          }),
        ]).run,
      },
    );

    expect(unknownEnvelope).toMatchObject({
      ok: false,
      diagnostics: {
        exit_classification: 'unknown',
      },
    });
    expect(JSON.stringify(unknownEnvelope.diagnostics)).not.toContain(
      'token-123',
    );
  });

  it('injects submit capture env while preserving host guard child env', async () => {
    const subprocess = fakeSubprocess([
      processSuccess('{"type":"turn.completed"}', {
        last_message: '{"verdict":"accept"}',
      }),
    ]);

    const envelope = await runProviderTurn(
      request({
        provider: 'codex',
        host: {
          runtime: 'codex',
          cwd: '/workspace',
          run_id: 'run-123',
          depth: 0,
          max_depth: 2,
        },
      }),
      {
        readSchema: async () => schema(),
        runSubprocess: subprocess.run,
      },
    );

    expect(envelope.ok).toBe(true);
    expect(subprocess.envs[0]).toMatchObject({
      CONSENSUS_RUN_ID: 'run-123',
      CONSENSUS_PARENT_HOST: 'codex',
      CONSENSUS_DEPTH: '1',
      CONSENSUS_SUBMIT_SCHEMA: path.resolve('schema.json'),
    });
    expect(subprocess.envs[0]?.CONSENSUS_SUBMIT_FILE).toMatch(
      /consensus-submit-[\w-]+\.json$/,
    );
  });

  it('generates a unique submit sidecar path per provider turn', async () => {
    const first = fakeSubprocess([processSuccess('{"verdict":"accept"}')]);
    const second = fakeSubprocess([processSuccess('{"verdict":"accept"}')]);

    await runProviderTurn(request({ provider: 'cursor' }), {
      readSchema: async () => schema(),
      runSubprocess: first.run,
    });
    await runProviderTurn(request({ provider: 'cursor' }), {
      readSchema: async () => schema(),
      runSubprocess: second.run,
    });

    expect(first.envs[0]?.CONSENSUS_SUBMIT_FILE).toBeTruthy();
    expect(second.envs[0]?.CONSENSUS_SUBMIT_FILE).toBeTruthy();
    expect(first.envs[0]?.CONSENSUS_SUBMIT_FILE).not.toBe(
      second.envs[0]?.CONSENSUS_SUBMIT_FILE,
    );
  });

  it('extracts Codex last-message-file output before schema validation', async () => {
    const envelope = await runProviderTurn(request({ provider: 'codex' }), {
      readSchema: async () => schema(),
      runSubprocess: fakeSubprocess([
        processSuccess(
          '{"type":"session.started"}\n{"type":"turn.completed"}\n',
          { last_message: '{"verdict":"accept"}' },
        ),
      ]).run,
    });

    expect(envelope).toMatchObject({
      ok: true,
      provider: 'codex',
      stdout: '{"verdict":"accept"}',
      json: { verdict: 'accept' },
      diagnostics: {
        output_mode: 'last_message_file',
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
      expect.arrayContaining(['-c', 'approval_policy="never"']),
    );
  });

  it('passes inline schema JSON to Claude while redacting diagnostics', async () => {
    const subprocess = fakeSubprocess([
      processSuccess('{"verdict":"accept"}'),
    ]);

    const envelope = await runProviderTurn(
      request({
        provider: 'claude',
        schema_path: '/tmp/consensus-schema/schema.json',
      }),
      {
        readSchema: async () => schema(),
        runSubprocess: subprocess.run,
      },
    );

    expect(envelope).toMatchObject({
      ok: true,
      provider: 'claude',
      diagnostics: {
        redacted_command: expect.arrayContaining([
          '--json-schema',
          '<inline-json-schema>',
        ]),
      },
    });
    const schemaArgument = argumentAfter(
      subprocess.invocations[0]?.argv ?? [],
      '--json-schema',
    );
    expect(schemaArgument).not.toBe('/tmp/consensus-schema/schema.json');
    expect(schemaArgument).not.toMatch(/(?:^|\/)schema\.json$/);
    expect(JSON.parse(schemaArgument)).toEqual(schema());
    expect(JSON.stringify(envelope)).not.toContain('"properties"');
  });

  it('unwraps Claude print-mode structured output before schema validation', async () => {
    const providerStdout = JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: false,
      result: 'I returned the requested verdict.',
      structured_output: { verdict: 'accept' },
    });

    const envelope = await runProviderTurn(request({ provider: 'claude' }), {
      readSchema: async () => schema(),
      runSubprocess: fakeSubprocess([processSuccess(providerStdout)]).run,
    });

    expect(envelope).toMatchObject({
      ok: true,
      provider: 'claude',
      stdout: providerStdout,
      json: { verdict: 'accept' },
    });
  });

  it('falls back to Claude print-mode result JSON before schema validation', async () => {
    const providerStdout = JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: false,
      result: '{"verdict":"accept"}',
    });

    const envelope = await runProviderTurn(request({ provider: 'claude' }), {
      readSchema: async () => schema(),
      runSubprocess: fakeSubprocess([processSuccess(providerStdout)]).run,
    });

    expect(envelope).toMatchObject({
      ok: true,
      provider: 'claude',
      stdout: providerStdout,
      json: { verdict: 'accept' },
    });
  });

  it('extracts embedded JSON from prompt-only provider result prose', async () => {
    const providerStdout = JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: false,
      result:
        'I checked the schema. {"verdict":"accept"} This is the final answer.',
    });

    const envelope = await runProviderTurn(request({ provider: 'cursor' }), {
      readSchema: async () => schema(),
      runSubprocess: fakeSubprocess([processSuccess(providerStdout)]).run,
    });

    expect(envelope).toMatchObject({
      ok: true,
      provider: 'cursor',
      stdout: providerStdout,
      json: { verdict: 'accept' },
    });
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
  const invocations: ProviderInvocation[] = [];
  const envs: Array<Record<string, string | undefined>> = [];

  return {
    prompts,
    invocations,
    envs,
    async run(
      invocation: ProviderInvocation,
      options: RunProviderSubprocessOptions,
    ) {
      prompts.push(invocation.stdin);
      invocations.push(invocation);
      envs.push(options?.env ?? {});
      const result = results.shift();
      if (!result) throw new Error('Unexpected subprocess invocation');
      if (
        result.ok &&
        invocation.output_mode === 'last_message_file' &&
        result.last_message === undefined
      ) {
        return {
          ...result,
          last_message: result.stdout,
        };
      }
      return result;
    },
  };
}

function argumentAfter(argv: string[], flag: string): string {
  const index = argv.indexOf(flag);
  if (index === -1 || argv[index + 1] === undefined) {
    throw new Error(`Missing argument after ${flag}`);
  }
  return argv[index + 1];
}

function processSuccess(
  stdout: string,
  overrides: Partial<Extract<ProviderProcessResult, { ok: true }>> = {},
): ProviderProcessResult {
  return {
    ok: true,
    stdout,
    stderr: '',
    exit_code: 0,
    signal: null,
    diagnostics: {},
    ...overrides,
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
