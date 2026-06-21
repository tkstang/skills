import { describe, expect, it } from 'vitest';

import {
  buildChildEnvironment,
  defaultRuntimePolicy,
  redactedRuntimePolicyDiagnostics,
  validateProviderOptions,
} from '../../../src/consensus/provider-cli/runtime-policy.js';
import { providerRegistry } from '../../../src/consensus/provider-cli/adapters.js';
import type {
  ConsensusCliRunRequest,
  ProviderCapabilities,
} from '../../../src/consensus/provider-cli/types.js';

describe('provider runtime policy validation', () => {
  it('accepts supported model, effort, and runtime policy options', () => {
    const result = validateProviderOptions(
      request({
        provider: 'codex',
        model: 'gpt-5.1-codex',
        effort: 'high',
        runtime_policy: {
          permission_mode: 'non-interactive',
          sandbox: 'workspace-write',
          approval_policy: 'never',
          env_allowlist: ['OPENAI_API_KEY'],
        },
      }),
      capabilities('codex'),
    );

    expect(result).toEqual({ ok: true });
  });

  it('rejects unsupported model, effort, and runtime policy options', () => {
    expect(
      validateProviderOptions(
        request({ provider: 'cursor', model: 'cursor-model' }),
        capabilities('cursor'),
      ),
    ).toMatchObject({
      ok: false,
      code: 'PROVIDER_UNSUPPORTED_OPTION',
      option: 'model',
    });

    expect(
      validateProviderOptions(
        request({ provider: 'cursor', effort: 'high' }),
        capabilities('cursor'),
      ),
    ).toMatchObject({
      ok: false,
      code: 'PROVIDER_UNSUPPORTED_OPTION',
      option: 'effort',
    });

    expect(
      validateProviderOptions(
        request({
          provider: 'claude',
          runtime_policy: { sandbox: 'workspace-write' },
        }),
        capabilities('claude'),
      ),
    ).toMatchObject({
      ok: false,
      code: 'PROVIDER_UNSUPPORTED_OPTION',
      option: 'runtime_policy.sandbox',
    });
  });

  it('uses a non-interactive default runtime policy', () => {
    expect(defaultRuntimePolicy()).toEqual({
      permission_mode: 'non-interactive',
    });
    expect(defaultRuntimePolicy({ sandbox: 'read-only' })).toEqual({
      permission_mode: 'non-interactive',
      sandbox: 'read-only',
    });
  });

  it.each([
    [
      'claude',
      ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN'],
      ['OPENAI_API_KEY', 'CURSOR_API_KEY'],
    ],
    ['codex', ['OPENAI_API_KEY'], ['ANTHROPIC_API_KEY', 'CURSOR_API_KEY']],
    ['cursor', ['CURSOR_API_KEY'], ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY']],
  ] as const)(
    'passes only %s provider credentials plus base and host environment',
    (provider, expectedProviderKeys, omittedProviderKeys) => {
      const env = buildChildEnvironment({
        parentEnv: {
          PATH: '/usr/bin',
          HOME: '/Users/test',
          ANTHROPIC_API_KEY: 'anthropic-secret',
          CLAUDE_CODE_OAUTH_TOKEN: 'claude-token',
          OPENAI_API_KEY: 'openai-secret',
          CURSOR_API_KEY: 'cursor-secret',
          SECRET_TOKEN: 'do-not-pass',
        },
        request: request({ provider }),
        hostEnv: {
          CONSENSUS_RUN_ID: 'run-123',
          CONSENSUS_PARENT_HOST: provider,
          CONSENSUS_DEPTH: '1',
        },
      });

      expect(env).toMatchObject({
        PATH: '/usr/bin',
        HOME: '/Users/test',
        CONSENSUS_RUN_ID: 'run-123',
        CONSENSUS_PARENT_HOST: provider,
        CONSENSUS_DEPTH: '1',
      });
      for (const key of expectedProviderKeys) {
        expect(env).toHaveProperty(key);
      }
      for (const key of omittedProviderKeys) {
        expect(env).not.toHaveProperty(key);
      }
      expect(env).not.toHaveProperty('SECRET_TOKEN');
    },
  );

  it('allows explicit env allowlist variables even when unrelated to the selected provider', () => {
    const env = buildChildEnvironment({
      parentEnv: {
        PATH: '/usr/bin',
        HOME: '/Users/test',
        ANTHROPIC_API_KEY: 'anthropic-secret',
        OPENAI_API_KEY: 'openai-secret',
        CUSTOM_OPENAI_COMPATIBLE_KEY: 'custom-secret',
        SECRET_TOKEN: 'do-not-pass',
      },
      request: request({
        provider: 'claude',
        runtime_policy: {
          env_allowlist: ['CUSTOM_OPENAI_COMPATIBLE_KEY'],
        },
      }),
      hostEnv: {
        CONSENSUS_RUN_ID: 'run-123',
        CONSENSUS_PARENT_HOST: 'claude',
        CONSENSUS_DEPTH: '1',
      },
    });

    expect(env).toMatchObject({
      PATH: '/usr/bin',
      HOME: '/Users/test',
      ANTHROPIC_API_KEY: 'anthropic-secret',
      CUSTOM_OPENAI_COMPATIBLE_KEY: 'custom-secret',
      CONSENSUS_RUN_ID: 'run-123',
      CONSENSUS_PARENT_HOST: 'claude',
      CONSENSUS_DEPTH: '1',
    });
    expect(env).not.toHaveProperty('OPENAI_API_KEY');
    expect(env).not.toHaveProperty('SECRET_TOKEN');
  });

  it('merges submit capture variables from host env without requiring allowlist', () => {
    const env = buildChildEnvironment({
      parentEnv: {
        PATH: '/usr/bin',
        CONSENSUS_SUBMIT_FILE: '/untrusted/capture.json',
        CONSENSUS_SUBMIT_SCHEMA: '/untrusted/schema.json',
      },
      request: request({ provider: 'claude' }),
      hostEnv: {
        CONSENSUS_SUBMIT_FILE: '/tmp/capture.json',
        CONSENSUS_SUBMIT_SCHEMA: '/tmp/schema.json',
      },
    });

    expect(env).toMatchObject({
      PATH: '/usr/bin',
      CONSENSUS_SUBMIT_FILE: '/tmp/capture.json',
      CONSENSUS_SUBMIT_SCHEMA: '/tmp/schema.json',
    });
  });

  it('allows caller-named env variables without exposing values in diagnostics', () => {
    const policy = {
      env_allowlist: ['CUSTOM_SECRET'],
    };
    const env = buildChildEnvironment({
      parentEnv: {
        CUSTOM_SECRET: 'custom-secret-value',
      },
      request: request({ provider: 'claude', runtime_policy: policy }),
      hostEnv: {},
    });
    const diagnostics = redactedRuntimePolicyDiagnostics(policy);

    expect(env.CUSTOM_SECRET).toBe('custom-secret-value');
    expect(diagnostics).toEqual({
      permission_mode: 'non-interactive',
      env_allowlist: ['CUSTOM_SECRET'],
    });
    expect(JSON.stringify(diagnostics)).not.toContain('custom-secret-value');
  });
});

function capabilities(id: 'claude' | 'codex' | 'cursor'): ProviderCapabilities {
  const selected = providerRegistry().get(id);
  if (!selected) throw new Error(`Missing adapter fixture: ${id}`);
  return selected.capabilities;
}

function request(
  overrides: Partial<ConsensusCliRunRequest>,
): ConsensusCliRunRequest {
  return {
    schema_version: 'v1',
    provider: 'claude',
    schema_path: 'schema.json',
    prompt: 'Return JSON.',
    ...overrides,
  };
}
