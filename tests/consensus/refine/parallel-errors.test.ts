import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import * as consensusLoop from '../../../plugins/consensus/scripts/consensus-loop.mjs';
// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import * as consensusRefine from '../../../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';

const { EXIT_CODES } = consensusLoop;
const { fanInParallelRun, prepareParallelRun, runWrapperCli } = consensusRefine;

type JsonRecord = Record<string, any>;

const repoRoot = path.resolve(new URL('../../..', import.meta.url).pathname);
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

function extractJsonBlock(markdown: string, label: string): any {
  const pattern = new RegExp(
    '<!-- consensus:' + label + '\\n([\\s\\S]*?)\\n-->',
  );
  const match = markdown.match(pattern);
  expect(match, `missing ${label} JSON block`).toBeTruthy();
  if (!match) throw new Error(`missing ${label} JSON block`);
  return JSON.parse(match[1]);
}

async function prepareBrokenManifest() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-parallel-errors-'),
  );
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
    preflight: async () => ({ peers: ['claude', 'codex'], warnings: [] }),
  });
  const manifest = await readJson(prepared.manifestPath);
  const [success, malformed, timeout] = manifest.sections;

  await writeFile(success.output_section, 'Successful parallel section.\n');
  await writeFile(
    success.output_records,
    `${JSON.stringify([{ schema_version: 'v0', round_index: 1, agent: 'claude', verdict: 'ACCEPT', reasoning: 'ok' }])}\n`,
  );
  await writeFile(
    success.output_status,
    `${JSON.stringify({ schema_version: 'v0', status: 'converged', termination_reason: 'double_accept', turns: 2, rounds: 1 })}\n`,
  );

  await writeFile(
    malformed.output_section,
    'This output should not be trusted.\n',
  );
  await writeFile(malformed.output_records, '{"not valid json"\n');
  await writeFile(
    malformed.output_status,
    `${JSON.stringify({ schema_version: 'v0', status: 'converged', termination_reason: 'double_accept', turns: 2, rounds: 1 })}\n`,
  );

  await writeFile(timeout.output_records, '[]\n');
  await writeFile(
    timeout.output_status,
    `${JSON.stringify({ schema_version: 'v0', status: 'timeout', termination_reason: 'section_timeout', turns: 0, rounds: 0 })}\n`,
  );

  return { tempRoot, prepared, manifest };
}

it('fanInParallelRun writes partial artifacts for malformed, missing, and timeout sections', async () => {
  const { tempRoot, prepared, manifest } = await prepareBrokenManifest();
  const result = await fanInParallelRun(prepared.manifestPath, {
    cwd: tempRoot,
    allowRoot: tempRoot,
  });

  expect(result.status).toBe('partial');
  expect(result.sections[0].status.status).toBe('converged');
  expect(result.sections[1].status.status).toBe('error');
  expect(result.sections[2].status.status).toBe('error');

  const artifact = await readFile(manifest.output_path, 'utf8');
  expect(artifact).toMatch(/Successful parallel section/);
  expect(artifact).toMatch(/## Details/);
  expect(artifact).toMatch(/## Close/);
  expect(artifact).toMatch(/<!-- consensus:section-error/);
  expect(artifact).toMatch(/malformed result JSON/);
  expect(artifact).toMatch(/missing output file/);
  expect(artifact).toMatch(/section_timeout/);
  expect(artifact).toMatch(/status\.json/);

  const resolution = extractJsonBlock(artifact, 'consensus-resolution');
  expect(resolution.status).toBe('partial');
  expect(resolution.sections.converged).toBe(1);
  expect(resolution.sections.error).toBe(2);

  const states = extractJsonBlock(artifact, 'consensus-section-states');
  expect(states.map((section: JsonRecord) => section.status)).toEqual([
    'converged',
    'error',
    'error',
  ]);
});

it('runWrapperCli returns 74 for parallel section errors only after writing the artifact', async () => {
  const { tempRoot, prepared, manifest } = await prepareBrokenManifest();
  const stdout = captureWriter();
  const stderr = captureWriter();
  const exitCode = await runWrapperCli(
    [
      '--fan-in',
      prepared.manifestPath,
      '--allow-root',
      tempRoot,
      '--fail-on-section-error',
    ],
    {
      stdout: stdout.stream,
      stderr: stderr.stream,
    },
  );

  expect(exitCode).toBe(EXIT_CODES.SECTION_ERROR);
  expect((await stat(manifest.output_path)).isFile()).toBe(true);
  expect(await readFile(manifest.output_path, 'utf8')).toMatch(
    /Status: partial/,
  );

  const events = stdout
    .value()
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  expect(events.at(-1).event).toBe('error');
  expect(events.at(-1).exit_code).toBe(EXIT_CODES.SECTION_ERROR);
  expect(stderr.value()).toMatch(/section error or impasse/i);
});
