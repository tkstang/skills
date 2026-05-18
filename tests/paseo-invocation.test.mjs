import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  SUBPROCESS_OUTPUT_CAP_BYTES,
  invokePaseo
} from '../plugins/consensus/skills/consensus-refine/scripts/consensus-loop.mjs';

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
