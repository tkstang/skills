import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runWrapperCli } from '../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';
import { captureWriter, parseJsonl, runNodeScript } from './helpers/process.mjs';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const sampleInput = path.join(repoRoot, 'tests/fixtures/sample-input.md');
const fixtureBin = path.join(repoRoot, 'tests/fixtures/bin');
const loopScript = path.join(repoRoot, 'plugins/consensus/skills/refine/scripts/consensus-loop.mjs');

function stubEnv(overrides = {}) {
  return {
    ...process.env,
    PATH: `${fixtureBin}${path.delimiter}${process.env.PATH}`,
    ...overrides
  };
}

function extractJsonBlock(markdown, label) {
  const pattern = new RegExp('<!-- consensus:' + label + '\\n([\\s\\S]*?)\\n-->');
  const match = markdown.match(pattern);
  assert.ok(match, `missing ${label} JSON block`);
  return JSON.parse(match[1]);
}

test('prepare, simulated host section loops, and fan-in work end-to-end', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-parallel-integration-'));
  const outputPath = path.join(tempRoot, 'sample.consensus.md');
  const runDir = path.join(tempRoot, '.consensus/run');
  const prepareStdout = captureWriter();
  const prepareStderr = captureWriter();

  const prepareExit = await runWrapperCli(
    [
      sampleInput,
      '--prepare-parallel',
      '--output',
      outputPath,
      '--run-dir',
      runDir,
      '--allow-root',
      tempRoot,
      '--goal',
      'Exercise host-mediated parallel dispatch.',
      '--peers',
      'claude,codex',
      '--max-rounds',
      '2'
    ],
    {
      stdout: prepareStdout.stream,
      stderr: prepareStderr.stream,
      cwd: tempRoot,
      preflight: async () => ({ peers: ['claude', 'codex'], warnings: [] })
    }
  );

  assert.equal(prepareExit, 0, prepareStderr.value());
  const dispatch = parseJsonl(prepareStdout.value()).find((event) => event.phase === 'parallel_dispatch_required');
  assert.ok(dispatch);

  const manifest = JSON.parse(await readFile(dispatch.manifest, 'utf8'));
  const completionOrder = [manifest.sections[2], manifest.sections[0], manifest.sections[1]];
  assert.deepEqual(
    completionOrder.map((section) => section.original_index),
    [2, 0, 1]
  );

  for (const section of completionOrder) {
    const env =
      section.original_index === 2
        ? stubEnv({
            PASEO_STUB_RESPONSE_JSON: JSON.stringify({
              schema_version: 'v1',
              verdict: 'IMPASSE',
              reasoning: 'The closing section needs user direction.',
              concerns: ['tone and brevity conflict']
            })
          })
        : stubEnv();
    await runNodeScript(loopScript, section.loop_argv, { cwd: tempRoot, env });
  }

  const fanInStdout = captureWriter();
  const fanInStderr = captureWriter();
  const fanInExit = await runWrapperCli(['--fan-in', dispatch.manifest], {
    stdout: fanInStdout.stream,
    stderr: fanInStderr.stream,
    cwd: tempRoot
  });

  assert.equal(fanInExit, 0, fanInStderr.value());
  const artifact = await readFile(outputPath, 'utf8');
  assert.ok(artifact.indexOf('# Intro') < artifact.indexOf('## Details'));
  assert.ok(artifact.indexOf('## Details') < artifact.indexOf('## Close'));
  assert.match(artifact, /The closing section needs user direction/);

  const resolution = extractJsonBlock(artifact, 'consensus-resolution');
  assert.equal(resolution.status, 'partial');
  assert.equal(resolution.parallel, true);
  assert.equal(resolution.sections.converged, 2);
  assert.equal(resolution.sections.impasse, 1);

  const fanInEvents = parseJsonl(fanInStdout.value());
  assert.equal(fanInEvents.at(-1).event, 'run_completed');
  assert.equal(fanInEvents.at(-1).status, 'partial');
});
