import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  SUBPROCESS_OUTPUT_CAP_BYTES,
  ConsensusError,
  invokePaseo,
  invokePaseoWithRetry,
  invokeValidatedPeer
} from '../plugins/consensus/skills/refine/scripts/consensus-loop.mjs';

test('invokeValidatedPeer re-invokes when a verdict fails OUR validation, then returns a valid one', async () => {
  // A REVISE without proposed_artifact is schema-valid (post-oneOf) but fails our
  // branch-table validator; paseo cannot retry it, so invokeValidatedPeer does.
  const responses = [
    { json: { schema_version: 'v1', verdict: 'REVISE', reasoning: 'forgot the artifact' } },
    { json: { schema_version: 'v1', verdict: 'ACCEPT', reasoning: 'good as-is' } }
  ];
  let calls = 0;
  const result = await invokeValidatedPeer({
    mode: 'alternating',
    sleep: async () => {},
    invoke: async () => responses[calls++]
  });
  assert.equal(result.json.verdict, 'ACCEPT');
  assert.equal(calls, 2);
});

test('invokeValidatedPeer throws after the attempt budget when the verdict stays invalid', async () => {
  let calls = 0;
  await assert.rejects(
    invokeValidatedPeer({
      mode: 'alternating',
      attempts: 3,
      sleep: async () => {},
      invoke: async () => {
        calls += 1;
        return { json: { schema_version: 'v1', verdict: 'REVISE', reasoning: 'still no artifact' } };
      }
    }),
    /invalid verdict shape/
  );
  assert.equal(calls, 3);
});

test('invokeValidatedPeer returns immediately when the first verdict is valid (no retry)', async () => {
  let calls = 0;
  const result = await invokeValidatedPeer({
    mode: 'parallel_revision',
    sleep: async () => {},
    invoke: async () => {
      calls += 1;
      return { json: { schema_version: 'v1', verdict: 'CONVERGED', reasoning: 'aligned' } };
    }
  });
  assert.equal(result.json.verdict, 'CONVERGED');
  assert.equal(calls, 1);
});

test('invokePaseoWithRetry retries transient paseo failures and returns the eventual success', async () => {
  let calls = 0;
  const sleeps = [];
  const result = await invokePaseoWithRetry(
    {},
    {
      sleep: async (ms) => { sleeps.push(ms); },
      invoke: async () => {
        calls += 1;
        if (calls < 3) {
          throw new ConsensusError('finished without a structured output message', { code: 'PASEO_EXIT' });
        }
        return { json: { ok: true } };
      }
    }
  );
  assert.deepEqual(result, { json: { ok: true } });
  assert.equal(calls, 3);
  assert.equal(sleeps.length, 2); // two waits between three attempts
});

test('invokePaseoWithRetry does not retry non-transient errors (e.g. missing binary)', async () => {
  let calls = 0;
  await assert.rejects(
    invokePaseoWithRetry(
      {},
      {
        sleep: async () => {},
        invoke: async () => {
          calls += 1;
          throw new ConsensusError('paseo executable not found on PATH', { code: 'PASEO_MISSING' });
        }
      }
    ),
    /not found on PATH/
  );
  assert.equal(calls, 1);
});

test('invokePaseoWithRetry stops after the attempt budget on persistent transient failure', async () => {
  let calls = 0;
  await assert.rejects(
    invokePaseoWithRetry(
      {},
      {
        attempts: 3,
        sleep: async () => {},
        invoke: async () => {
          calls += 1;
          throw new ConsensusError('still failing', { code: 'PASEO_EXIT' });
        }
      }
    ),
    /still failing/
  );
  assert.equal(calls, 3);
});

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const fixtureBin = path.join(repoRoot, 'tests/fixtures/bin');

function stubEnv(overrides = {}) {
  return {
    ...process.env,
    PATH: `${fixtureBin}${path.delimiter}${process.env.PATH}`,
    ...overrides
  };
}

test('invokePaseo shells out with array args for provider, schema, and JSON prompt', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-paseo-'));
  const capturePath = path.join(tempRoot, 'capture.json');
  const result = await invokePaseo({
    provider: 'codex',
    schemaPath: '/schema/verdict.json',
    prompt: 'Review this section.',
    cwd: tempRoot,
    env: stubEnv({ PASEO_STUB_CAPTURE_PATH: capturePath })
  });

  assert.equal(result.json.verdict, 'ACCEPT');
  assert.equal(result.provider, 'codex');

  const capture = JSON.parse(await readFile(capturePath, 'utf8'));
  assert.deepEqual(capture.argv, [
    'run',
    '--provider',
    'codex',
    '--output-schema',
    '/schema/verdict.json',
    '--json',
    'Review this section.'
  ]);
  assert.equal(await realpath(capture.cwd), await realpath(tempRoot));
});

test('invokePaseo parses JSON output from the fixture response file', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-paseo-'));
  const responsePath = path.join(tempRoot, 'response.json');
  await writeFile(
    responsePath,
    JSON.stringify({ schema_version: 'v0', verdict: 'REVISE', reasoning: 'tighten', proposed_artifact: 'New text' })
  );

  const result = await invokePaseo({
    provider: 'claude',
    schemaPath: '/schema/verdict.json',
    prompt: 'prompt',
    env: stubEnv({ PASEO_STUB_RESPONSE_FILE: responsePath })
  });

  assert.equal(result.json.verdict, 'REVISE');
  assert.equal(result.json.proposed_artifact, 'New text');
});

test('invokePaseo rejects stdout beyond the 10 MB subprocess cap', async () => {
  await assert.rejects(
    invokePaseo({
      provider: 'claude',
      schemaPath: '/schema/verdict.json',
      prompt: 'prompt',
      env: stubEnv({ PASEO_STUB_STDOUT_BYTES: String(SUBPROCESS_OUTPUT_CAP_BYTES + 1) })
    }),
    /stdout exceeded subprocess output cap/
  );
});

test('invokePaseo allows stdout at the 10 MB boundary', async () => {
  const payload = JSON.stringify({ schema_version: 'v0', verdict: 'ACCEPT', reasoning: 'ok' });
  const padding = SUBPROCESS_OUTPUT_CAP_BYTES - Buffer.byteLength(payload);
  const result = await invokePaseo({
    provider: 'claude',
    schemaPath: '/schema/verdict.json',
    prompt: 'prompt',
    env: stubEnv({ PASEO_STUB_JSON_WITH_PADDING_BYTES: String(padding) })
  });

  assert.equal(result.json.verdict, 'ACCEPT');
});

test('invokePaseo propagates non-zero exit as a hard error with stderr', async () => {
  await assert.rejects(
    invokePaseo({
      provider: 'claude',
      schemaPath: '/schema/verdict.json',
      prompt: 'prompt',
      env: stubEnv({ PASEO_STUB_EXIT_CODE: '42', PASEO_STUB_STDERR: 'provider failed' })
    }),
    /paseo exited with code 42: provider failed/
  );
});
