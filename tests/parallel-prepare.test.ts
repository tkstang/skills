import { mkdtemp, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import * as consensusRefine from '../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';

const { prepareParallelRun, runWrapperCli } = consensusRefine;

type JsonRecord = Record<string, any>;

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const sampleInput = path.join(repoRoot, 'tests/fixtures/sample-input.md');

function captureWriter() {
  let value = '';
  return {
    stream: {
      write(chunk: unknown) {
        value += chunk;
      },
    },
    value() {
      return value;
    },
  };
}

async function readJson(filePath: string): Promise<any> {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

it('prepareParallelRun writes section packets and a dispatch manifest', async () => {
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
    preflight: async () => ({ peers: ['claude', 'codex'], warnings: [] }),
  });

  expect(result.mode).toBe('prepare_parallel');
  expect(result.parallel).toBe(true);
  expect(result.parallelism).toBe(3);
  expect(result.sections.length).toBe(3);
  expect((await stat(result.manifestPath)).isFile()).toBe(true);

  const manifest = await readJson(result.manifestPath);
  expect(manifest.consensus_schema_version).toBe('v1');
  expect(manifest.mode).toBe('parallel');
  expect(manifest.input_path).toBe(sampleInput);
  expect(manifest.output_path).toBe(outputPath);
  expect(manifest.run_dir).toBe(runDir);
  expect(manifest.goal).toBe('Tighten each section.');
  expect(manifest.peers).toEqual(['claude', 'codex']);
  expect(manifest.max_rounds).toBe(5);
  expect(manifest.agency).toBe('maximum');
  expect(manifest.parallelism).toBe(3);

  expect(
    manifest.sections.map((section: JsonRecord) => section.original_index),
  ).toEqual([0, 1, 2]);

  for (const section of manifest.sections) {
    expect(section.subagent_id).toMatch(/^section-runner-/);
    expect((await stat(section.packet_path)).isFile()).toBe(true);
    expect((await stat(section.section_file)).isFile()).toBe(true);
    expect(section.output_records.endsWith('records.json')).toBe(true);
    expect(section.output_section.endsWith('output.md')).toBe(true);
    expect(section.output_status.endsWith('status.json')).toBe(true);

    const packet = await readJson(section.packet_path);
    expect(packet.consensus_schema_version).toBe('v1');
    expect(packet.manifest_path).toBe(result.manifestPath);
    expect(packet.section_id).toBe(section.section_id);
    expect(packet.section_file).toBe(section.section_file);
    expect(packet.peers).toEqual(['claude', 'codex']);
    expect(packet.max_rounds).toBe(5);
    expect(packet.agency).toBe('maximum');
  }

  expect(result.dispatchEvent.phase).toEqual('parallel_dispatch_required');
  expect(result.dispatchEvent.manifest).toBe(result.manifestPath);
  expect(result.dispatchEvent.parallelism).toBe(3);
  expect(result.dispatchEvent.sections.length).toBe(3);
});

it('runWrapperCli emits parallel dispatch JSONL for prepare mode', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-prepare-cli-'),
  );
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
      'claude,codex',
    ],
    {
      stdout: stdout.stream,
      stderr: stderr.stream,
      cwd: tempRoot,
      preflight: async () => ({ peers: ['claude', 'codex'], warnings: [] }),
    },
  );

  expect(exitCode, stderr.value()).toBe(0);
  const events = stdout
    .value()
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  expect(events[0].event).toBe('run_started');
  const dispatch = events.find(
    (event) => event.phase === 'parallel_dispatch_required',
  );
  expect(dispatch).toBeTruthy();
  expect(dispatch.parallelism).toBe(3);
  expect(dispatch.sections.length).toBe(3);
  expect((await stat(dispatch.manifest)).isFile()).toBe(true);
  expect(events.at(-1).event).toBe('run_completed');
  expect(events.at(-1).status).toBe('prepared');
});

// --- p05-t04: parallel-section packets carry mode + synthesizer ----------

it('prepareParallelRun threads iteration_mode and synthesizer through packets, manifest, and loop_argv', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-prepare-mode-'),
  );
  const result = await prepareParallelRun({
    inputPath: sampleInput,
    output: path.join(tempRoot, 'sample.consensus.md'),
    runDir: path.join(tempRoot, '.consensus/run'),
    allowRoot: tempRoot,
    cwd: tempRoot,
    goal: 'Tighten each section.',
    peers: ['claude', 'codex'],
    iteration: 'parallel_synthesized',
    synthesizer: 'codex',
    maxRounds: 4,
    agency: 'moderate',
    preflight: async () => ({
      peers: ['claude', 'codex'],
      providerInventory: [
        { id: 'claude', available: true },
        { id: 'codex', available: true },
      ],
      warnings: [],
    }),
  });

  const manifest = await readJson(result.manifestPath);
  expect(manifest.iteration_mode).toBe('parallel_synthesized');
  expect(manifest.synthesizer).toBe('codex');

  for (const section of manifest.sections) {
    expect(section.iteration_mode).toBe('parallel_synthesized');
    expect(section.synthesizer).toBe('codex');
    // The loop argv carries the synthesizer flag for the section runner.
    expect(section.loop_argv.includes('--iteration')).toBeTruthy();
    expect(
      section.loop_argv[section.loop_argv.indexOf('--iteration') + 1],
    ).toBe('parallel_synthesized');
    expect(section.loop_argv.includes('--synthesizer')).toBeTruthy();
    expect(
      section.loop_argv[section.loop_argv.indexOf('--synthesizer') + 1],
    ).toBe('codex');

    const packet = await readJson(section.packet_path);
    expect(packet.iteration_mode).toBe('parallel_synthesized');
    expect(packet.synthesizer).toBe('codex');
  }

  // The dispatch event surfaces the mode for host visibility.
  expect(result.dispatchEvent.iteration_mode).toBe('parallel_synthesized');
  expect(result.dispatchEvent.synthesizer).toBe('codex');
});
