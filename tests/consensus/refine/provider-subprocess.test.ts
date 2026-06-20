import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import * as consensusLoop from '../../../plugins/consensus/skills/refine/scripts/consensus-loop.mjs';
import {
  consensusCliFixture,
  fixtureBin,
  makeProviderCliEnv,
  parseJsonl,
} from '../../helpers/process.mjs';

const providerSubprocessFixture = path.join(fixtureBin, 'consensus-provider-stub');

const {
  SUBPROCESS_OUTPUT_CAP_BYTES,
  ConsensusError,
  invokeConsensusProviderCli,
  invokeProviderCliWithRetry,
  invokeValidatedPeer,
  runProviderCliCommand,
} = consensusLoop;

it('invokeValidatedPeer re-invokes when a verdict fails OUR validation, then returns a valid one', async () => {
  const responses = [
    {
      json: {
        schema_version: 'v1',
        verdict: 'REVISE',
        reasoning: 'forgot the artifact',
      },
    },
    {
      json: {
        schema_version: 'v1',
        verdict: 'ACCEPT',
        reasoning: 'good as-is',
      },
    },
  ];
  let calls = 0;
  const result = await invokeValidatedPeer({
    mode: 'alternating',
    sleep: async () => {},
    invoke: async () => responses[calls++],
  });
  expect(result.json.verdict).toBe('ACCEPT');
  expect(calls).toBe(2);
});

it('invokeValidatedPeer throws after the attempt budget when the verdict stays invalid', async () => {
  let calls = 0;
  await expect(
    invokeValidatedPeer({
      mode: 'alternating',
      attempts: 3,
      sleep: async () => {},
      invoke: async () => {
        calls += 1;
        return {
          json: {
            schema_version: 'v1',
            verdict: 'REVISE',
            reasoning: 'still no artifact',
          },
        };
      },
    }),
  ).rejects.toThrow(/invalid verdict shape/);
  expect(calls).toBe(3);
});

it('invokeValidatedPeer returns immediately when the first verdict is valid', async () => {
  let calls = 0;
  const result = await invokeValidatedPeer({
    mode: 'parallel_revision',
    sleep: async () => {},
    invoke: async () => {
      calls += 1;
      return {
        json: {
          schema_version: 'v1',
          verdict: 'CONVERGED',
          reasoning: 'aligned',
        },
      };
    },
  });
  expect(result.json.verdict).toBe('CONVERGED');
  expect(calls).toBe(1);
});

it('invokeProviderCliWithRetry retries validation failures and returns the eventual success', async () => {
  let calls = 0;
  const sleeps: number[] = [];
  const result = await invokeProviderCliWithRetry(
    {},
    {
      sleep: async (ms: number) => {
        sleeps.push(ms);
      },
      invoke: async () => {
        calls += 1;
        if (calls < 3) {
          return {
            provider: 'codex',
            args: [],
            stdout: '{}',
            stderr: '',
            json: {
              schema_version: 'v1',
              verdict: 'REVISE',
              reasoning: 'missing artifact',
            },
          };
        }
        return {
          provider: 'codex',
          args: [],
          stdout: '{}',
          stderr: '',
          json: {
            schema_version: 'v1',
            verdict: 'ACCEPT',
            reasoning: 'valid',
          },
        };
      },
    },
  );
  expect(result.json.verdict).toBe('ACCEPT');
  expect(calls).toBe(3);
  expect(sleeps.length).toBe(2);
});

it('invokeProviderCliWithRetry does not double-retry exhausted provider CLI failures', async () => {
  let calls = 0;
  await expect(
    invokeProviderCliWithRetry(
      {
        provider: 'codex',
        schemaPath: '/schema/verdict.json',
        prompt: 'prompt',
      },
      {
        mode: 'alternating',
        attempts: 3,
        sleep: async () => {},
        invoke: async () => {
          calls += 1;
          throw new ConsensusError('provider retries exhausted', {
            code: 'PROVIDER_INVALID_JSON',
            details: {
              attempts: {
                cli_attempts: 3,
                terminal_reason: 'invalid_json',
                retryable: false,
              },
            },
          });
        },
      },
    ),
  ).rejects.toSatisfy((error: { code?: string }) => {
    expect(error.code).toBe('PROVIDER_INVALID_JSON');
    return true;
  });
  expect(calls).toBe(1);
});

it('invokeConsensusProviderCli shells out with request JSON for provider, schema, and prompt', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-provider-'));
  const callsPath = path.join(tempRoot, 'calls.jsonl');
  const result = await invokeConsensusProviderCli({
    provider: 'codex',
    schemaPath: '/schema/verdict.json',
    prompt: 'Review this section.',
    cwd: tempRoot,
    env: makeProviderCliEnv({ CONSENSUS_STUB_CALLS_JSONL: callsPath }),
  });

  expect(result.json.verdict).toBe('ACCEPT');
  expect(result.provider).toBe('codex');
  expect(result.raw_provider_response).toContain('ACCEPT');

  const calls = parseJsonl(await readFile(callsPath, 'utf8'));
  expect(calls).toEqual([
    {
      args: ['run', '--request-json', '-', '--json'],
      event: 'run',
      provider: 'codex',
      schema_path: '/schema/verdict.json',
    },
  ]);
});

it('invokeConsensusProviderCli parses JSON output from the fixture response', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-provider-'));
  const result = await invokeConsensusProviderCli({
    provider: 'claude',
    schemaPath: '/schema/verdict.json',
    prompt: 'prompt',
    cwd: tempRoot,
    env: makeProviderCliEnv({
      CONSENSUS_STUB_VERDICT: 'REVISE',
      CONSENSUS_STUB_PROPOSED_ARTIFACT: 'New text',
    }),
  });

  expect(result.json.verdict).toBe('REVISE');
  expect(result.json.proposed_artifact).toBe('New text');
});

it('invokeConsensusProviderCli resolves the consensus fixture from env', async () => {
  const result = await invokeConsensusProviderCli({
    provider: 'claude',
    schemaPath: '/schema/verdict.json',
    prompt: 'prompt',
    env: makeProviderCliEnv(),
  });

  expect(result.args).toEqual(['fixture-consensus-cli']);
  expect(consensusCliFixture).toMatch(/tests\/fixtures\/bin\/consensus$/);
});

it('runProviderCliCommand rejects stdout beyond the 10 MB subprocess cap', async () => {
  await expect(
    runProviderCliCommand(
      providerSubprocessFixture,
      ['big-output', String(SUBPROCESS_OUTPUT_CAP_BYTES + 1)],
      {},
    ),
  ).rejects.toThrow(/stdout exceeded subprocess output cap/);
});

it('runProviderCliCommand allows stdout at the 10 MB boundary', async () => {
  const result = await runProviderCliCommand(
    providerSubprocessFixture,
    ['big-output', String(SUBPROCESS_OUTPUT_CAP_BYTES)],
    {},
  );

  expect(result.stdout.length).toBe(SUBPROCESS_OUTPUT_CAP_BYTES);
});

it('invokeConsensusProviderCli propagates provider failures with diagnostics', async () => {
  await expect(
    invokeConsensusProviderCli({
      provider: 'claude',
      schemaPath: '/schema/verdict.json',
      prompt: 'prompt',
      env: makeProviderCliEnv({
        CONSENSUS_STUB_RUN_FAILURE_CODE: 'PROVIDER_TIMEOUT',
        CONSENSUS_STUB_RUN_FAILURE_RETRYABLE: '1',
      }),
    }),
  ).rejects.toSatisfy((error: { code?: string; details?: unknown }) => {
    expect(error.code).toBe('PROVIDER_TIMEOUT');
    expect(error.details).toEqual(
      expect.objectContaining({
        retryable: true,
        diagnostics: expect.objectContaining({
          fixture_failure: true,
        }),
      }),
    );
    return true;
  });
});
