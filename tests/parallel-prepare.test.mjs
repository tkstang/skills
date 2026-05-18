import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
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

test('prepareParallelRun writes section packets and a dispatch manifest', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-prepare-'));
  const runDir = path.join(tempRoot, '.consensus/run');
  const outputPath = path.join(tempRoot, 'sample.consensus.md');

  const result = await prepareParallelRun({
    inputPath: sampleInput,
    output: outputPath,
    runDir,
    allowRoot: tempRoot,
    cwd: tempRoot,
    goal: 'Tighten each section.',
    peers: ['claude', 'codex'],
    maxRounds: 5,
    agency: 'maximum',
    preflight: async () => ({ peers: ['claude', 'codex'], warnings: [] })
  });

  assert.equal(result.mode, 'prepare_parallel');
  assert.equal(result.parallel, true);
  assert.equal(result.parallelism, 3);
  assert.equal(result.sections.length, 3);
  assert.equal((await stat(result.manifestPath)).isFile(), true);

  const manifest = await readJson(result.manifestPath);
  assert.equal(manifest.consensus_schema_version, 'v0');
  assert.equal(manifest.mode, 'parallel');
  assert.equal(manifest.input_path, sampleInput);
  assert.equal(manifest.output_path, outputPath);
  assert.equal(manifest.run_dir, runDir);
  assert.equal(manifest.goal, 'Tighten each section.');
  assert.deepEqual(manifest.peers, ['claude', 'codex']);
  assert.equal(manifest.max_rounds, 5);
  assert.equal(manifest.agency, 'maximum');
  assert.equal(manifest.parallelism, 3);

  assert.deepEqual(
    manifest.sections.map((section) => section.original_index),
    [0, 1, 2]
  );

  for (const section of manifest.sections) {
    assert.match(section.subagent_id, /^section-runner-/);
    assert.equal((await stat(section.packet_path)).isFile(), true);
    assert.equal((await stat(section.section_file)).isFile(), true);
    assert.equal(section.output_records.endsWith('records.json'), true);
    assert.equal(section.output_section.endsWith('output.md'), true);
    assert.equal(section.output_status.endsWith('status.json'), true);

    const packet = await readJson(section.packet_path);
    assert.equal(packet.consensus_schema_version, 'v0');
    assert.equal(packet.manifest_path, result.manifestPath);
    assert.equal(packet.section_id, section.section_id);
    assert.equal(packet.section_file, section.section_file);
    assert.deepEqual(packet.peers, ['claude', 'codex']);
    assert.equal(packet.max_rounds, 5);
    assert.equal(packet.agency, 'maximum');
  }

  assert.deepEqual(result.dispatchEvent.phase, 'parallel_dispatch_required');
  assert.equal(result.dispatchEvent.manifest, result.manifestPath);
  assert.equal(result.dispatchEvent.parallelism, 3);
  assert.equal(result.dispatchEvent.sections.length, 3);
});

test('runWrapperCli emits parallel dispatch JSONL for prepare mode', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-prepare-cli-'));
  const stdout = captureWriter();
  const stderr = captureWriter();
  const exitCode = await runWrapperCli(
    [
      sampleInput,
      '--prepare-parallel',
      '--output',
      path.join(tempRoot, 'sample.consensus.md'),
      '--run-dir',
      path.join(tempRoot, '.consensus/run'),
      '--allow-root',
      tempRoot,
      '--goal',
      'Prepare for host dispatch.',
      '--peers',
      'claude,codex'
    ],
    {
      stdout: stdout.stream,
      stderr: stderr.stream,
      cwd: tempRoot,
      preflight: async () => ({ peers: ['claude', 'codex'], warnings: [] })
    }
  );

  assert.equal(exitCode, 0, stderr.value());
  const events = stdout.value().trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(events[0].event, 'run_started');
  const dispatch = events.find((event) => event.phase === 'parallel_dispatch_required');
  assert.ok(dispatch);
  assert.equal(dispatch.parallelism, 3);
  assert.equal(dispatch.sections.length, 3);
  assert.equal((await stat(dispatch.manifest)).isFile(), true);
  assert.equal(events.at(-1).event, 'run_completed');
  assert.equal(events.at(-1).status, 'prepared');
});
