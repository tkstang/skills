import { describe, expect, it } from 'vitest';

import {
  FIRST_SCOPE_HOST_NATIVE_DISPATCH,
  FIRST_SCOPE_PROVIDER_IDS,
  PROVIDER_ERROR_CODES,
  STRUCTURED_OUTPUT_STRATEGIES,
  type ConsensusCliRunEnvelope,
  type ProviderCapabilities,
} from '../../../src/consensus/provider-cli/types.js';

describe('provider CLI model types', () => {
  it('exposes the first-scope provider IDs', () => {
    expect(FIRST_SCOPE_PROVIDER_IDS).toEqual(['claude', 'codex', 'cursor']);
  });

  it('includes all structured output strategies including reserved submit-tool support', () => {
    expect(STRUCTURED_OUTPUT_STRATEGIES).toEqual([
      'constrained_native',
      'provider_validated',
      'prompt_only',
      'submit_tool_candidate',
    ]);
  });

  it('exports the provider-neutral error taxonomy in declared order', () => {
    expect(PROVIDER_ERROR_CODES).toEqual([
      'PROVIDER_MISSING',
      'PROVIDER_UNAVAILABLE',
      'PROVIDER_AUTH_REQUIRED',
      'PROVIDER_UNSUPPORTED',
      'PROVIDER_UNSUPPORTED_OPTION',
      'PROVIDER_EXIT',
      'PROVIDER_INVALID_JSON',
      'PROVIDER_SCHEMA_VALIDATION',
      'PROVIDER_TIMEOUT',
      'PROVIDER_OUTPUT_CAP_EXCEEDED',
      'HOST_RECURSION_BLOCKED',
      'CONSENSUS_CLI_USAGE',
    ]);
  });

  it('represents first-scope host-native dispatch as reserved and unsupported', () => {
    expect(FIRST_SCOPE_HOST_NATIVE_DISPATCH).toEqual({
      supported: false,
      reserved: true,
    });

    const capabilities = {
      schema_strategies: ['prompt_only'],
      output_modes: ['stdout_json'],
      options: {
        model: true,
        effort: null,
        runtime_policy: {
          env_allowlist: true,
        },
      },
      supports_submit_tool: false,
      supports_same_host_subprocess: true,
      supports_host_native_dispatch: false,
    } satisfies ProviderCapabilities;

    expect(capabilities.supports_host_native_dispatch).toBe(false);
  });

  it('keeps run envelopes JSON-serializable', () => {
    const envelope: ConsensusCliRunEnvelope = {
      schema_version: 'v1',
      ok: false,
      provider: 'cursor',
      code: 'PROVIDER_AUTH_REQUIRED',
      message: 'Provider authentication is required.',
      retryable: false,
      attempts: {
        cli_attempts: 1,
        retryable: false,
        terminal_reason: 'auth_required',
      },
      diagnostics: {
        strategy_used: 'prompt_only',
        output_mode: 'stdout_json',
        provider_exit_code: null,
        provider_signal: null,
      },
    };

    expect(JSON.parse(JSON.stringify(envelope))).toEqual(envelope);
  });
});
