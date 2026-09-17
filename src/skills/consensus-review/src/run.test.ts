import { describe, expect, it } from 'vitest';

import type { ProviderInventoryEntry } from '../../../plugins/consensus/provider-cli/types.js';
import { runReview } from './run.js';

describe('review transport runner', () => {
  it('uses the same explicit host context for scoped preflight and dispatch', async () => {
    const seen: unknown[] = [];
    const result = await runReview(
      {
        provider: 'codex',
        prompt: 'Review the captured scope.',
        schemaPath: '/external/review.schema.json',
        cwd: '/workspace/repo',
        host: 'codex',
        allowSameProvider: true,
        codexCapturePath: '/external/reviews/run-123/last-message.json',
      },
      {
        env: {
          CONSENSUS_PARENT_HOST: 'codex',
          CONSENSUS_RUN_ID: 'run-123',
          CONSENSUS_DEPTH: '0',
        },
        async preflight(input) {
          seen.push(input.host);
          return readyProvider('codex');
        },
        async runTurn(request, dependencies) {
          seen.push(request.host);
          expect(request.runtime_policy).toEqual({
            permission_mode: 'non-interactive',
            sandbox: 'read-only',
            approval_policy: 'never',
          });
          expect(dependencies.transport).toEqual({
            submitCaptureEnabled: false,
            strategy: 'prompt_only',
            lastMessageFile: '/external/reviews/run-123/last-message.json',
            preserveLastMessageFile: true,
          });
          return {
            schema_version: 'v1',
            ok: true,
            provider: 'codex',
            args: ['codex', 'exec'],
            stdout: '{"verdict":"pass"}',
            json: { verdict: 'pass' },
            attempts: {
              cli_attempts: 1,
              terminal_reason: 'success',
              retryable: false,
            },
          };
        },
      },
    );

    expect(result).toMatchObject({
      ok: true,
      status: 'completed',
      invocation_count: 1,
    });
    expect(seen).toHaveLength(2);
    expect(seen[1]).toEqual(seen[0]);
  });

  it('blocks unknown host evidence and an in-worktree Codex capture before preflight', async () => {
    const preflight = async () => readyProvider('codex');

    await expect(
      runReview(
        {
          provider: 'codex',
          prompt: 'Review.',
          schemaPath: '/external/review.schema.json',
          cwd: '/workspace/repo',
          host: 'codex',
          allowSameProvider: true,
          codexCapturePath: '/external/reviews/run/last-message.json',
        },
        { env: {}, preflight },
      ),
    ).resolves.toMatchObject({
      ok: false,
      status: 'preflight_failed',
      invocation_count: 0,
      reason: 'unknown_host',
    });

    await expect(
      runReview(
        {
          provider: 'codex',
          prompt: 'Review.',
          schemaPath: '/external/review.schema.json',
          cwd: '/workspace/repo',
          host: 'codex',
          allowSameProvider: true,
          codexCapturePath: '/workspace/repo/.review/last-message.json',
        },
        {
          env: { CONSENSUS_PARENT_HOST: 'codex' },
          preflight,
        },
      ),
    ).resolves.toMatchObject({
      ok: false,
      status: 'preflight_failed',
      invocation_count: 0,
      reason: 'capture_not_external',
    });
  });

  it('maps Claude review transport to provider validation and plan mode', async () => {
    await runReview(
      {
        provider: 'claude',
        prompt: 'Review.',
        schemaPath: '/external/review.schema.json',
        cwd: '/workspace/repo',
        host: 'codex',
      },
      {
        env: { CONSENSUS_PARENT_HOST: 'codex' },
        preflight: async () => readyProvider('claude'),
        async runTurn(request, dependencies) {
          expect(request.runtime_policy).toEqual({
            permission_mode: 'read-only',
          });
          expect(dependencies.transport).toEqual({
            submitCaptureEnabled: false,
            strategy: 'provider_validated',
          });
          return {
            schema_version: 'v1',
            ok: false,
            provider: 'claude',
            code: 'PROVIDER_EXIT',
            message: 'fixture stop',
            retryable: false,
            attempts: {
              cli_attempts: 1,
              terminal_reason: 'fixture',
              retryable: false,
            },
          };
        },
      },
    );
  });

  it('requires explicit consent before a same-provider review', async () => {
    await expect(
      runReview(
        {
          provider: 'codex',
          prompt: 'Review.',
          schemaPath: '/external/review.schema.json',
          cwd: '/workspace/repo',
          host: 'codex',
          codexCapturePath: '/external/reviews/run/last-message.json',
        },
        { env: { CONSENSUS_PARENT_HOST: 'codex' } },
      ),
    ).resolves.toMatchObject({
      ok: false,
      status: 'preflight_failed',
      reason: 'same_provider_consent_required',
      invocation_count: 0,
    });
  });
});

function readyProvider(id: 'claude' | 'codex'): ProviderInventoryEntry {
  return {
    id,
    status: 'ready',
    capabilities: {
      schema_strategies:
        id === 'codex'
          ? ['constrained_native', 'prompt_only']
          : ['provider_validated', 'prompt_only'],
      output_modes: id === 'codex' ? ['last_message_file'] : ['stdout_json'],
      options: {
        model: true,
        effort: id === 'codex' ? 'reasoning_effort' : 'effort',
        runtime_policy: {
          permission_modes: ['non-interactive', 'read-only'],
          ...(id === 'codex'
            ? {
                sandboxes: ['read-only'],
                approval_policies: ['never'],
              }
            : {}),
          env_allowlist: true,
        },
      },
      supports_submit_tool: false,
      supports_same_host_subprocess: true,
      supports_host_native_dispatch: false,
    },
  };
}
