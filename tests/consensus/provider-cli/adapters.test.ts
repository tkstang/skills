import { describe, expect, it } from 'vitest';

import {
  defaultSchemaStrategy,
  providerRegistry,
} from '../../../src/consensus/provider-cli/adapters.js';
import { runProviderList } from '../../../src/consensus/provider-cli/commands.js';
import type { ProviderRunFailureInput } from '../../../src/consensus/provider-cli/adapters.js';

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
        permission_modes: ['non-interactive'],
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
