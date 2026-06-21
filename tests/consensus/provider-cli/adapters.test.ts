import { describe, expect, it } from 'vitest';

import {
  defaultSchemaStrategy,
  providerRegistry,
} from '../../../src/consensus/provider-cli/adapters.js';
import { runProviderList } from '../../../src/consensus/provider-cli/commands.js';

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
