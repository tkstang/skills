import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ConsensusError,
  invokeConsensusProviderCli,
  runConsensusLoop,
} from '../../../src/consensus/core/consensus-loop.js';

describe('consensus provider CLI invocation seam', () => {
  it('sends a request JSON envelope to the consensus CLI and projects success', async () => {
    const calls: Array<{
      command: string;
      args: string[];
      input?: string;
      cwd?: string;
      env?: NodeJS.ProcessEnv;
    }> = [];
    const result = await invokeConsensusProviderCli({
      provider: 'codex',
      schemaPath: '/schemas/verdict.json',
      prompt: 'Review this section.',
      cwd: '/tmp/consensus-run',
      env: { CONSENSUS_CLI_PATH: '/tmp/bin/consensus' },
      runCommand: async (command, args, options) => {
        calls.push({ command, args, ...options });
        return {
          code: 0,
          stdout: JSON.stringify({
            schema_version: 'v1',
            ok: true,
            provider: 'codex',
            args: ['codex', 'exec'],
            stdout: '{"verdict":"ACCEPT"}',
            stderr: '',
            json: {
              schema_version: 'v1',
              verdict: 'ACCEPT',
              reasoning: 'ready',
            },
            attempts: {
              cli_attempts: 1,
              terminal_reason: 'success',
              retryable: false,
            },
            diagnostics: { strategy_used: 'constrained_native' },
          }),
          stderr: '',
        };
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      command: '/tmp/bin/consensus',
      args: ['run', '--request-json', '-', '--json'],
      cwd: '/tmp/consensus-run',
    });
    expect(JSON.parse(calls[0].input ?? '')).toMatchObject({
      schema_version: 'v1',
      provider: 'codex',
      schema_path: '/schemas/verdict.json',
      prompt: 'Review this section.',
      cwd: '/tmp/consensus-run',
    });
    expect(result).toMatchObject({
      provider: 'codex',
      args: ['codex', 'exec'],
      stdout: '{"verdict":"ACCEPT"}',
      stderr: '',
      json: {
        schema_version: 'v1',
        verdict: 'ACCEPT',
        reasoning: 'ready',
      },
      attempts: { cli_attempts: 1 },
      provider_diagnostics: { strategy_used: 'constrained_native' },
    });
  });

  it('maps structured ok:false provider failures to ConsensusError', async () => {
    await expect(
      invokeConsensusProviderCli({
        provider: 'cursor',
        schemaPath: '/schemas/verdict.json',
        prompt: 'Review this section.',
        runCommand: async () => ({
          code: 0,
          stdout: JSON.stringify({
            schema_version: 'v1',
            ok: false,
            provider: 'cursor',
            code: 'PROVIDER_AUTH_REQUIRED',
            message: 'Provider authentication is required.',
            retryable: false,
            attempts: {
              cli_attempts: 1,
              terminal_reason: 'auth_required',
              retryable: false,
            },
            diagnostics: { guard: 'none' },
          }),
          stderr: '',
        }),
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ConsensusError);
      const consensusError = error as ConsensusError;
      expect(consensusError.code).toBe('PROVIDER_AUTH_REQUIRED');
      expect(consensusError.message).toBe(
        'Provider authentication is required.',
      );
      expect(consensusError.details).toMatchObject({
        provider: 'cursor',
        attempts: { cli_attempts: 1, terminal_reason: 'auth_required' },
        diagnostics: { guard: 'none' },
      });
      return true;
    });
  });

  it('preserves injected peer invokers without requiring the provider CLI', async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), 'consensus-provider-cli-seam-'),
    );
    const sectionPath = path.join(tempRoot, 'section.md');
    const recordsPath = path.join(tempRoot, 'records.json');
    const outputPath = path.join(tempRoot, 'output.md');
    const statusPath = path.join(tempRoot, 'status.json');
    await writeFile(sectionPath, 'Stable text.\n');

    const result = await runConsensusLoop(
      {
        sectionFile: sectionPath,
        goal: 'Tighten.',
        peers: ['claude', 'codex'],
        maxRounds: 1,
        iteration: 'alternating',
        coldStart: 'shared_input',
        agency: 'moderate',
        synthesizer: null,
        outputRecords: recordsPath,
        outputSection: outputPath,
        outputStatus: statusPath,
      },
      {
        invokePeer: async ({ provider }) => ({
          provider,
          json: {
            schema_version: 'v1',
            verdict: 'ACCEPT',
            reasoning: `${provider} accepts`,
          },
          stdout: JSON.stringify({ provider }),
        }),
      },
    );

    expect(result.status.status).toBe('converged');
    expect(await readFile(outputPath, 'utf8')).toBe('Stable text.\n');
  });
});
