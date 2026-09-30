import { describe, expect, it } from 'vitest';

import {
  defaultSchemaStrategy,
  providerRegistry,
} from '../provider-cli/adapters.js';
import type { ProviderRunFailureInput } from '../provider-cli/adapters.js';
import { runProviderList } from '../provider-cli/commands.js';

describe('provider adapter registry', () => {
  it('registers the first-scope provider adapters by user-facing ID', () => {
    const registry = providerRegistry();

    expect(registry.list().map((adapter) => adapter.id)).toEqual([
      'claude',
      'codex',
      'cursor',
    ]);
    expect(registry.get('claude')?.display_name).toBe('Claude');
    expect(registry.get('codex')?.display_name).toBe('Codex');
    expect(registry.get('cursor')?.display_name).toBe('Cursor');
  });

  it('declares plural schema strategies and first-scope host dispatch limits', () => {
    for (const adapter of providerRegistry().list()) {
      expect(adapter.capabilities.schema_strategies.length).toBeGreaterThan(0);
      expect(adapter.capabilities.supports_same_host_subprocess).toBe(true);
      expect(adapter.capabilities.supports_host_native_dispatch).toBe(false);
    }
  });

  it('keeps provider-specific option capability differences explicit', () => {
    const registry = providerRegistry();

    expect(registry.get('claude')?.capabilities.options).toMatchObject({
      model: true,
      effort: 'effort',
      runtime_policy: {
        permission_modes: expect.arrayContaining(['non-interactive']),
        env_allowlist: true,
      },
    });
    expect(registry.get('codex')?.capabilities.options).toMatchObject({
      model: true,
      effort: 'reasoning_effort',
      runtime_policy: {
        sandboxes: expect.arrayContaining(['workspace-write']),
        approval_policies: expect.arrayContaining(['never']),
        env_allowlist: true,
      },
    });
    expect(registry.get('codex')?.capabilities.output_modes).toEqual([
      'last_message_file',
    ]);
    expect(registry.get('cursor')?.capabilities.options).toMatchObject({
      model: false,
      effort: null,
      runtime_policy: {
        permission_modes: ['non-interactive', 'read-only'],
        env_allowlist: true,
      },
    });
  });

  it('reserves submit-tool candidate strategy for Cursor without selecting it by default', () => {
    const registry = providerRegistry();

    expect(registry.get('cursor')?.capabilities.schema_strategies).toEqual([
      'prompt_only',
      'submit_tool_candidate',
    ]);
    expect(registry.get('cursor')?.capabilities.supports_submit_tool).toBe(
      false,
    );
    expect(defaultSchemaStrategy(registry.get('cursor')!)).toBe('prompt_only');

    for (const adapter of registry.list()) {
      expect(defaultSchemaStrategy(adapter)).not.toBe('submit_tool_candidate');
      expect(adapter.capabilities.supports_submit_tool).toBe(false);
    }
  });

  it('classifies an unmatched provider exit as terminal', () => {
    const adapter = providerRegistry().get('claude')!;

    expect(
      adapter.classifyRunFailure({
        code: 'PROVIDER_EXIT',
        message: 'Provider subprocess exited with code 1.',
        retryable: true,
        stdout: '',
        stderr: 'boom',
        exit_code: 1,
        signal: null,
      }),
    ).toMatchObject({
      code: 'PROVIDER_EXIT',
      retryable: false,
      terminal_reason: 'provider_exit_terminal',
    });
  });

  it('classifies an externally-interrupted run with a reliable signal as transient', () => {
    const adapter = providerRegistry().get('codex')!;

    expect(
      adapter.classifyRunFailure(
        providerExitFailure({
          exit_code: null,
          signal: 'SIGTERM',
        }),
      ),
    ).toMatchObject({
      code: 'PROVIDER_EXIT',
      retryable: true,
      terminal_reason: 'provider_exit_interrupted',
      exit_classification: 'interrupted',
    });
  });

  it('keeps CLI timeout and output-cap terminations terminal', () => {
    const adapter = providerRegistry().get('codex')!;

    expect(
      adapter.classifyRunFailure({
        code: 'PROVIDER_TIMEOUT',
        message: 'Provider subprocess timed out.',
        retryable: false,
        stdout: '',
        stderr: '',
        exit_code: null,
        signal: 'SIGTERM',
      }),
    ).toMatchObject({
      retryable: false,
      terminal_reason: 'provider_timeout',
      exit_classification: 'terminal',
    });

    expect(
      adapter.classifyRunFailure({
        code: 'PROVIDER_OUTPUT_CAP_EXCEEDED',
        message: 'Provider subprocess exceeded output cap.',
        retryable: false,
        stdout: '',
        stderr: '',
        exit_code: null,
        signal: 'SIGTERM',
      }),
    ).toMatchObject({
      retryable: false,
      terminal_reason: 'output_cap_exceeded',
      exit_classification: 'terminal',
    });
  });

  it('defaults ambiguous signal cases to terminal', () => {
    const adapter = providerRegistry().get('cursor')!;

    expect(
      adapter.classifyRunFailure(
        providerExitFailure({
          exit_code: 143,
          signal: 'SIGTERM',
        }),
      ),
    ).toMatchObject({
      code: 'PROVIDER_EXIT',
      retryable: false,
      terminal_reason: 'provider_exit_terminal',
      exit_classification: 'unknown',
    });
  });

  it('applies evidence-backed provider-specific transient signatures', () => {
    const registry = providerRegistry();

    expect(
      registry.get('claude')!.classifyRunFailure(
        providerExitFailure({
          stderr: 'API Error: Repeated 529 Overloaded errors.',
        }),
      ),
    ).toMatchObject({
      code: 'PROVIDER_EXIT',
      retryable: true,
      terminal_reason: 'provider_exit_transient',
      exit_classification: 'transient',
    });

    expect(
      registry.get('codex')!.classifyRunFailure(
        providerExitFailure({
          stderr: 'rate limiter has requested a pause; Try again at 12:34.',
        }),
      ),
    ).toMatchObject({
      code: 'PROVIDER_EXIT',
      retryable: true,
      terminal_reason: 'provider_exit_transient',
      exit_classification: 'transient',
    });

    expect(
      registry.get('cursor')!.classifyRunFailure(
        providerExitFailure({
          stderr: 'stream_error: session_error after network error',
        }),
      ),
    ).toMatchObject({
      code: 'PROVIDER_EXIT',
      retryable: true,
      terminal_reason: 'provider_exit_transient',
      exit_classification: 'transient',
    });

    expect(
      registry.get('cursor')!.classifyRunFailure(
        providerExitFailure({
          stderr: 'API Error: Repeated 529 Overloaded errors.',
        }),
      ),
    ).toMatchObject({
      retryable: false,
      terminal_reason: 'provider_exit_terminal',
      exit_classification: 'unknown',
    });
  });

  it('reads session identity from provider machine output, not model text', () => {
    const registry = providerRegistry();
    const codexStdout = [
      '{"type":"thread.started","thread_id":"0199f3a2-7c1e-7d40-9a55-3b6f0e2d8c41"}',
      '{"type":"item.completed","item":{"type":"agent_message","text":"{\\"thread_id\\":\\"forged\\"}"}}',
      '{"type":"turn.completed"}',
    ].join('\n');
    const claudeStdout = JSON.stringify({
      type: 'result',
      session_id: '5b1f7f9e-2c55-4a8e-9d0e-6c7a4f1e2b30',
      result: '{"session_id":"forged"}',
      modelUsage: { 'claude-fable-5-1': { inputTokens: 1 } },
    });

    expect(registry.get('codex')!.extractSession(codexStdout)).toEqual({
      session_id: '0199f3a2-7c1e-7d40-9a55-3b6f0e2d8c41',
    });
    expect(registry.get('claude')!.extractSession(claudeStdout)).toEqual({
      session_id: '5b1f7f9e-2c55-4a8e-9d0e-6c7a4f1e2b30',
      observed_models: ['claude-fable-5-1'],
    });
    // A model that prints a session-shaped object is not provider metadata.
    expect(
      registry.get('codex')!.extractSession('{"session_id":"forged"}'),
    ).toEqual({});
  });

  it.each([
    [
      'claude',
      'Error: No conversation found with session ID: 0199f3a2-7c1e-7d40-9a55-3b6f0e2d8c41',
    ],
    [
      'codex',
      'Error: thread/resume failed: no rollout found for thread id 0199f3a2-7c1e-7d40-9a55-3b6f0e2d8c41',
    ],
  ] as const)(
    'classifies a %s unknown-session rejection apart from auth failure',
    (id, stderr) => {
      const classify = providerRegistry().get(id)!.classifyRunFailure;

      expect(classify(providerExitFailure({ stderr }))).toMatchObject({
        code: 'PROVIDER_SESSION_NOT_FOUND',
        retryable: false,
      });
      expect(
        classify(providerExitFailure({ stderr: 'Error: not logged in' })).code,
      ).toBe('PROVIDER_AUTH_REQUIRED');
    },
  );

  it('verifies native resume only where a live same-session smoke passed', () => {
    const status = Object.fromEntries(
      providerRegistry()
        .list()
        .map((adapter) => [
          adapter.id,
          adapter.capabilities.continuation?.native_resume,
        ]),
    );

    expect(status).toEqual({
      claude: 'verified',
      codex: 'verified',
      cursor: 'unverified',
    });
  });

  it('uses adapter capabilities for default provider inventory entries', async () => {
    const envelope = await runProviderList();

    expect(envelope.providers).toEqual([
      expect.objectContaining({
        id: 'claude',
        status: 'missing',
        capabilities: providerRegistry().get('claude')?.capabilities,
      }),
      expect.objectContaining({
        id: 'codex',
        status: 'missing',
        capabilities: providerRegistry().get('codex')?.capabilities,
      }),
      expect.objectContaining({
        id: 'cursor',
        status: 'missing',
        capabilities: providerRegistry().get('cursor')?.capabilities,
      }),
    ]);
  });
});

describe.each(['claude', 'codex', 'cursor'] as const)(
  'exit classification: %s',
  (id) => {
    it('classifies shared transient signatures as retryable within budget', () => {
      const adapter = providerRegistry().get(id)!;

      expect(
        adapter.classifyRunFailure(
          providerExitFailure({ stderr: 'HTTP 429 Too Many Requests' }),
        ),
      ).toMatchObject({
        code: 'PROVIDER_EXIT',
        retryable: true,
        terminal_reason: 'provider_exit_transient',
        exit_classification: 'transient',
      });
    });

    it('classifies auth and unsupported-option signatures as terminal', () => {
      const adapter = providerRegistry().get(id)!;

      expect(
        adapter.classifyRunFailure(
          providerExitFailure({ stderr: 'authentication required' }),
        ),
      ).toMatchObject({
        code: 'PROVIDER_AUTH_REQUIRED',
        retryable: false,
        terminal_reason: 'provider_auth_required',
        exit_classification: 'terminal',
      });

      expect(
        adapter.classifyRunFailure(
          providerExitFailure({ stderr: 'unknown option: --bad-flag' }),
        ),
      ).toMatchObject({
        code: 'PROVIDER_UNSUPPORTED_OPTION',
        retryable: false,
        terminal_reason: 'provider_unsupported_option',
        exit_classification: 'terminal',
      });
    });

    it('classifies unknown provider exits as terminal by default', () => {
      const adapter = providerRegistry().get(id)!;

      expect(
        adapter.classifyRunFailure(
          providerExitFailure({ stderr: 'unmatched provider failure' }),
        ),
      ).toMatchObject({
        code: 'PROVIDER_EXIT',
        retryable: false,
        terminal_reason: 'provider_exit_terminal',
        exit_classification: 'unknown',
      });
    });
  },
);

function providerExitFailure(
  overrides: Partial<ProviderRunFailureInput> = {},
): ProviderRunFailureInput {
  return {
    code: 'PROVIDER_EXIT',
    message: 'Provider subprocess exited with code null.',
    retryable: true,
    stdout: '',
    stderr: '',
    exit_code: 1,
    signal: null,
    ...overrides,
  };
}
