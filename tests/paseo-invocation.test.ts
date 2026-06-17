import { mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import * as consensusLoop from '../plugins/consensus/skills/refine/scripts/consensus-loop.mjs';

const {
  SUBPROCESS_OUTPUT_CAP_BYTES,
  ConsensusError,
  invokePaseo,
  invokePaseoWithRetry,
  invokeValidatedPeer,
} = consensusLoop;

it('invokeValidatedPeer re-invokes when a verdict fails OUR validation, then returns a valid one', async () => {
  // A REVISE without proposed_artifact is schema-valid (post-oneOf) but fails our
  // branch-table validator; paseo cannot retry it, so invokeValidatedPeer does.
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

it('invokeValidatedPeer returns immediately when the first verdict is valid (no retry)', async () => {
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

it('invokePaseoWithRetry retries transient paseo failures and returns the eventual success', async () => {
  let calls = 0;
  const sleeps: number[] = [];
  const result = await invokePaseoWithRetry(
    {},
    {
      sleep: async (ms: number) => {
        sleeps.push(ms);
      },
      invoke: async () => {
        calls += 1;
        if (calls < 3) {
          throw new ConsensusError(
            'finished without a structured output message',
            { code: 'PASEO_EXIT' },
          );
        }
        return { json: { ok: true } };
      },
    },
  );
  expect(result).toEqual({ json: { ok: true } });
  expect(calls).toBe(3);
  expect(sleeps.length).toBe(2); // two waits between three attempts
});

it('invokePaseoWithRetry does not retry non-transient errors (e.g. missing binary)', async () => {
  let calls = 0;
  await expect(
    invokePaseoWithRetry(
      {},
      {
        sleep: async () => {},
        invoke: async () => {
          calls += 1;
          throw new ConsensusError('paseo executable not found on PATH', {
            code: 'PASEO_MISSING',
          });
        },
      },
    ),
  ).rejects.toThrow(/not found on PATH/);
  expect(calls).toBe(1);
});

it('invokePaseoWithRetry stops after the attempt budget on persistent transient failure', async () => {
  let calls = 0;
  await expect(
    invokePaseoWithRetry(
      {},
      {
        attempts: 3,
        sleep: async () => {},
        invoke: async () => {
          calls += 1;
          throw new ConsensusError('still failing', { code: 'PASEO_EXIT' });
        },
      },
    ),
  ).rejects.toThrow(/still failing/);
  expect(calls).toBe(3);
});

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const fixtureBin = path.join(repoRoot, 'tests/fixtures/bin');

function stubEnv(overrides: NodeJS.ProcessEnv = {}) {
  return {
    ...process.env,
    PATH: `${fixtureBin}${path.delimiter}${process.env.PATH}`,
    ...overrides,
  };
}

it('invokePaseo shells out with array args for provider, schema, and JSON prompt', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-paseo-'));
  const capturePath = path.join(tempRoot, 'capture.json');
  const result = await invokePaseo({
    provider: 'codex',
    schemaPath: '/schema/verdict.json',
    prompt: 'Review this section.',
    cwd: tempRoot,
    env: stubEnv({ PASEO_STUB_CAPTURE_PATH: capturePath }),
  });

  expect(result.json.verdict).toBe('ACCEPT');
  expect(result.provider).toBe('codex');

  const capture = JSON.parse(await readFile(capturePath, 'utf8'));
  expect(capture.argv).toEqual([
    'run',
    '--provider',
    'codex',
    '--output-schema',
    '/schema/verdict.json',
    '--json',
    'Review this section.',
  ]);
  expect(await realpath(capture.cwd)).toBe(await realpath(tempRoot));
});

it('invokePaseo parses JSON output from the fixture response file', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-paseo-'));
  const responsePath = path.join(tempRoot, 'response.json');
  await writeFile(
    responsePath,
    JSON.stringify({
      schema_version: 'v0',
      verdict: 'REVISE',
      reasoning: 'tighten',
      proposed_artifact: 'New text',
    }),
  );

  const result = await invokePaseo({
    provider: 'claude',
    schemaPath: '/schema/verdict.json',
    prompt: 'prompt',
    env: stubEnv({ PASEO_STUB_RESPONSE_FILE: responsePath }),
  });

  expect(result.json.verdict).toBe('REVISE');
  expect(result.json.proposed_artifact).toBe('New text');
});

it('invokePaseo rejects stdout beyond the 10 MB subprocess cap', async () => {
  await expect(
    invokePaseo({
      provider: 'claude',
      schemaPath: '/schema/verdict.json',
      prompt: 'prompt',
      env: stubEnv({
        PASEO_STUB_STDOUT_BYTES: String(SUBPROCESS_OUTPUT_CAP_BYTES + 1),
      }),
    }),
  ).rejects.toThrow(/stdout exceeded subprocess output cap/);
});

it('invokePaseo allows stdout at the 10 MB boundary', async () => {
  const payload = JSON.stringify({
    schema_version: 'v0',
    verdict: 'ACCEPT',
    reasoning: 'ok',
  });
  const padding = SUBPROCESS_OUTPUT_CAP_BYTES - Buffer.byteLength(payload);
  const result = await invokePaseo({
    provider: 'claude',
    schemaPath: '/schema/verdict.json',
    prompt: 'prompt',
    env: stubEnv({ PASEO_STUB_JSON_WITH_PADDING_BYTES: String(padding) }),
  });

  expect(result.json.verdict).toBe('ACCEPT');
});

it('invokePaseo propagates non-zero exit as a hard error with stderr', async () => {
  await expect(
    invokePaseo({
      provider: 'claude',
      schemaPath: '/schema/verdict.json',
      prompt: 'prompt',
      env: stubEnv({
        PASEO_STUB_EXIT_CODE: '42',
        PASEO_STUB_STDERR: 'provider failed',
      }),
    }),
  ).rejects.toThrow(/paseo exited with code 42: provider failed/);
});
