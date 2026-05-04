import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { EXIT_CODES } from '../plugins/consensus/skills/consensus-refine/scripts/consensus-loop.mjs';
import {
  fanInParallelRun,
  prepareParallelRun,
  runWrapperCli
} from '../plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const sampleInput = path.join(repoRoot, 'tests/fixtures/sample-input.md');

function captureWriter() {
  let value = '';
  return {
    stream: {
      write(chunk) {
        value += chunk;
      }
    },
    value() {
      return value;
    }
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function extractJsonBlock(markdown, label) {
  const pattern = new RegExp('<!-- consensus:' + label + '\\n([\\s\\S]*?)\\n-->');
  const match = markdown.match(pattern);
  assert.ok(match, `missing ${label} JSON block`);
  return JSON.parse(match[1]);
}

async function prepareBrokenManifest() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-parallel-errors-'));
  const prepared = await prepareParallelRun({
    inputPath: sampleInput,
    output: path.join(tempRoot, 'sample.consensus.md'),
    runDir: path.join(tempRoot, '.consensus/run'),
    allowRoot: tempRoot,
    cwd: tempRoot,
    goal: 'Handle parallel errors.',
    peers: ['claude', 'codex'],
    maxRounds: 2,
    agency: 'moderate',
    preflight: async () => ({ peers: ['claude', 'codex'], warnings: [] })
  });
  const manifest = await readJson(prepared.manifestPath);
  const [success, malformed, timeout] = manifest.sections;

  await writeFile(success.output_section, 'Successful parallel section.\n');
  await writeFile(
    success.output_records,
    `${JSON.stringify([{ schema_version: 'v0', round_index: 1, agent: 'claude', verdict: 'ACCEPT', reasoning: 'ok' }])}\n`
  );
  await writeFile(
    success.output_status,
    `${JSON.stringify({ schema_version: 'v0', status: 'converged', termination_reason: 'double_accept', turns: 2, rounds: 1 })}\n`
  );

  await writeFile(malformed.output_section, 'This output should not be trusted.\n');
  await writeFile(malformed.output_records, '{"not valid json"\n');
  await writeFile(
    malformed.output_status,
    `${JSON.stringify({ schema_version: 'v0', status: 'converged', termination_reason: 'double_accept', turns: 2, rounds: 1 })}\n`
  );

  await writeFile(timeout.output_records, '[]\n');
  await writeFile(
    timeout.output_status,
    `${JSON.stringify({ schema_version: 'v0', status: 'timeout', termination_reason: 'section_timeout', turns: 0, rounds: 0 })}\n`
  );

  return { tempRoot, prepared, manifest };
}

test('fanInParallelRun writes partial artifacts for malformed, missing, and timeout sections', async () => {
  const { tempRoot, prepared, manifest } = await prepareBrokenManifest();
  const result = await fanInParallelRun(prepared.manifestPath, { cwd: tempRoot, allowRoot: tempRoot });

  assert.equal(result.status, 'partial');
  assert.equal(result.sections[0].status.status, 'converged');
  assert.equal(result.sections[1].status.status, 'error');
  assert.equal(result.sections[2].status.status, 'error');

  const artifact = await readFile(manifest.output_path, 'utf8');
  assert.match(artifact, /Successful parallel section/);
  assert.match(artifact, /## Details/);
  assert.match(artifact, /## Close/);
  assert.match(artifact, /<!-- consensus:section-error/);
  assert.match(artifact, /malformed result JSON/);
  assert.match(artifact, /missing output file/);
  assert.match(artifact, /section_timeout/);
  assert.match(artifact, /status\.json/);

  const resolution = extractJsonBlock(artifact, 'consensus-resolution');
  assert.equal(resolution.status, 'partial');
  assert.equal(resolution.sections.converged, 1);
  assert.equal(resolution.sections.error, 2);

  const states = extractJsonBlock(artifact, 'consensus-section-states');
  assert.deepEqual(
    states.map((section) => section.status),
    ['converged', 'error', 'error']
  );
});

test('runWrapperCli returns 74 for parallel section errors only after writing the artifact', async () => {
  const { tempRoot, prepared, manifest } = await prepareBrokenManifest();
  const stdout = captureWriter();
  const stderr = captureWriter();
  const exitCode = await runWrapperCli(
    ['--fan-in', prepared.manifestPath, '--allow-root', tempRoot, '--fail-on-section-error'],
    {
      stdout: stdout.stream,
      stderr: stderr.stream
    }
  );

  assert.equal(exitCode, EXIT_CODES.SECTION_ERROR);
  assert.equal((await stat(manifest.output_path)).isFile(), true);
  assert.match(await readFile(manifest.output_path, 'utf8'), /Status: partial/);

  const events = stdout.value().trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(events.at(-1).event, 'error');
  assert.equal(events.at(-1).exit_code, EXIT_CODES.SECTION_ERROR);
  assert.match(stderr.value(), /section error or impasse/i);
});
