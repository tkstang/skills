import { describe, expect, it } from 'vitest';

import { providerRegistry } from '../../../src/consensus/provider-cli/adapters.js';
import {
  buildProviderInvocation,
  type ProviderInvocation,
} from '../../../src/consensus/provider-cli/invocation.js';
import { defaultRuntimePolicy } from '../../../src/consensus/provider-cli/runtime-policy.js';
import type {
  ConsensusCliRunRequest,
  StructuredOutputStrategy,
} from '../../../src/consensus/provider-cli/types.js';

describe('provider invocation builders', () => {
  it.each(['claude', 'codex', 'cursor'] as const)(
    'builds %s argv arrays without shell interpolation or prompt argv leakage',
    (id) => {
      const invocation = buildInvocation(id, 'prompt_only');

      expect(invocation.shell).toBe(false);
      expect(invocation.argv).toEqual(expect.any(Array));
      expect(invocation.stdin).toBe('Sensitive prompt text.');
      expect(invocation.argv.join(' ')).not.toContain('Sensitive prompt text.');
      expect(invocation.redacted_command).toEqual([
        invocation.executable,
        ...invocation.argv,
      ]);
    },
  );

  it('reflects Claude provider-validated schema strategy in argv', () => {
    const invocation = buildInvocation('claude', 'provider_validated', {
      model: 'claude-sonnet',
      effort: 'high',
    });

    expect(invocation).toMatchObject({
      executable: 'claude',
      output_mode: 'stdout_json',
      strategy: 'provider_validated',
    });
    expect(invocation.argv).toEqual([
      '--print',
      '--output-format',
      'json',
      '--json-schema',
      'schema.json',
      '--model',
      'claude-sonnet',
      '--effort',
      'high',
    ]);
  });

  it('reflects Codex constrained-native schema and reasoning effort in argv', () => {
    const invocation = buildInvocation('codex', 'constrained_native', {
      model: 'gpt-5.1-codex',
      effort: 'xhigh',
      runtime_policy: {
        sandbox: 'workspace-write',
        approval_policy: 'never',
      },
    });

    expect(invocation.argv).toEqual([
      'exec',
      '--json',
      '--output-schema',
      'schema.json',
      '--model',
      'gpt-5.1-codex',
      '--reasoning-effort',
      'xhigh',
      '--sandbox',
      'workspace-write',
      '--approval-policy',
      'never',
    ]);
  });

  it('maps effective non-interactive runtime policies to provider controls', () => {
    const claude = buildInvocation('claude', 'provider_validated', {
      runtime_policy: defaultRuntimePolicy(),
    });
    const codex = buildInvocation('codex', 'constrained_native', {
      runtime_policy: defaultRuntimePolicy(),
    });
    const cursor = buildInvocation('cursor', 'prompt_only', {
      runtime_policy: defaultRuntimePolicy(),
    });

    expect(claude.argv).toContain('--permission-mode');
    expect(claude.argv).toContain('non-interactive');
    expect(codex.argv).toContain('--approval-policy');
    expect(codex.argv).toContain('never');
    expect(cursor.argv).toContain('--force');
  });

  it('keeps Cursor on prompt-only argv shape unless submit-tool is explicitly implemented later', () => {
    const invocation = buildInvocation('cursor', 'prompt_only', {
      model: 'ignored-model',
      effort: 'ignored-effort',
    });

    expect(invocation).toMatchObject({
      executable: 'cursor-agent',
      output_mode: 'stdout_json',
      strategy: 'prompt_only',
    });
    expect(invocation.argv).toEqual([
      '--output-format',
      'json',
      '--force',
    ]);
    expect(invocation.argv.join(' ')).not.toContain('ignored-model');
    expect(invocation.argv.join(' ')).not.toContain('ignored-effort');
  });

  it('keeps host-native dispatch unsupported for every first-scope invocation', () => {
    expect(
      providerRegistry()
        .list()
        .map((adapter) => adapter.capabilities.supports_host_native_dispatch),
    ).toEqual([false, false, false]);
  });
});

function buildInvocation(
  id: 'claude' | 'codex' | 'cursor',
  strategy: StructuredOutputStrategy,
  overrides: Partial<ConsensusCliRunRequest> = {},
): ProviderInvocation {
  const adapter = providerRegistry().get(id);
  if (!adapter) throw new Error(`Missing adapter fixture: ${id}`);

  return buildProviderInvocation(adapter, {
    schema_version: 'v1',
    provider: id,
    schema_path: 'schema.json',
    prompt: 'Sensitive prompt text.',
    ...overrides,
  }, {
    strategy,
  });
}
