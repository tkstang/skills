import { describe, expect, it } from 'vitest';

import {
  failureEnvelope,
  processExitForEnvelope,
  successEnvelope,
  usageFailure,
} from '../../../src/consensus/provider-cli/envelope.js';

describe('provider CLI envelopes', () => {
  it('builds success envelopes with the stable projection surface', () => {
    expect(
      successEnvelope({
        provider: 'claude',
        args: ['claude', '--print'],
        stdout: '{"verdict":"accept"}',
        json: { verdict: 'accept' },
        attempts: {
          cli_attempts: 1,
          retryable: false,
          terminal_reason: 'success',
        },
      }),
    ).toEqual({
      schema_version: 'v1',
      ok: true,
      provider: 'claude',
      args: ['claude', '--print'],
      stdout: '{"verdict":"accept"}',
      json: { verdict: 'accept' },
      attempts: {
        cli_attempts: 1,
        retryable: false,
        terminal_reason: 'success',
      },
    });
  });

  it('returns process code 0 for structured provider failures', () => {
    const envelope = failureEnvelope({
      provider: 'codex',
      code: 'PROVIDER_MISSING',
      message: 'Provider executable was not found.',
      retryable: false,
      terminal_reason: 'missing_executable',
    });

    expect(envelope.ok).toBe(false);
    expect(processExitForEnvelope(envelope)).toBe(0);
  });

  it('returns nonzero for CLI usage failures', () => {
    const envelope = usageFailure('Unknown command', {
      argv: ['unknown'],
    });

    expect(envelope).toMatchObject({
      ok: false,
      code: 'CONSENSUS_CLI_USAGE',
      retryable: false,
      attempts: {
        cli_attempts: 0,
        retryable: false,
        terminal_reason: 'usage',
      },
    });
    expect(processExitForEnvelope(envelope)).toBe(2);
  });

  it('keeps top-level retryability as the caller-facing authority', () => {
    const envelope = failureEnvelope({
      provider: 'cursor',
      code: 'PROVIDER_INVALID_JSON',
      message: 'Provider returned invalid JSON.',
      retryable: true,
      attempts: {
        cli_attempts: 2,
        retryable: false,
      },
      terminal_reason: 'invalid_json',
    });

    expect(envelope.retryable).toBe(true);
    expect(envelope.attempts.retryable).toBe(true);
  });

  it('carries terminal reason classifications in attempt summaries', () => {
    const envelope = failureEnvelope({
      provider: 'claude',
      code: 'PROVIDER_EXIT',
      message: 'Provider exited nonzero.',
      retryable: false,
      terminal_reason: 'provider_exit_terminal',
    });

    expect(envelope.attempts.terminal_reason).toBe('provider_exit_terminal');
  });
});
