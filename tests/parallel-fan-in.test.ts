import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import * as consensusRefine from '../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';

const { fanInParallelRun, prepareParallelRun, runWrapperCli } = consensusRefine;

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

function extractJsonBlock(markdown: string, label: string): any {
  const pattern = new RegExp(
    '<!-- consensus:' + label + '\\n([\\s\\S]*?)\\n-->',
  );
  const match = markdown.match(pattern);
  expect(match, `missing ${label} JSON block`).toBeTruthy();
  if (!match) throw new Error(`missing ${label} JSON block`);
  return JSON.parse(match[1]);
}

async function prepareCompletedManifest() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-fan-in-'));
  const outputPath = path.join(tempRoot, 'sample.consensus.md');
  const prepared = await prepareParallelRun({
    inputPath: sampleInput,
    output: outputPath,
    runDir: path.join(tempRoot, '.consensus/run'),
    allowRoot: tempRoot,
    cwd: tempRoot,
    goal: 'Fan in completed sections.',
    peers: ['claude', 'codex'],
    maxRounds: 2,
    agency: 'moderate',
    preflight: async () => ({ peers: ['claude', 'codex'], warnings: [] }),
  });

  const manifest = await readJson(prepared.manifestPath);
  await writeCompletedSectionOutputs(manifest);

  return { tempRoot, prepared, manifest };
}

async function writeCompletedSectionOutputs(manifest: JsonRecord) {
  for (const section of [...manifest.sections].toReversed()) {
    await writeFile(
      section.output_section,
      `Final ${section.original_index}: ${section.name}\n`,
    );
    await writeFile(
      section.output_records,
      `${JSON.stringify(
        [
          {
            schema_version: 'v0',
            round_index: 1,
            turn_index: 1,
            agent: 'claude',
            verdict: 'ACCEPT',
            reasoning: `accepted ${section.name}`,
          },
        ],
        null,
        2,
      )}\n`,
    );
    await writeFile(
      section.output_status,
      `${JSON.stringify(
        {
          schema_version: 'v0',
          status: 'converged',
          termination_reason: 'double_accept',
          turns: 2,
          rounds: 1,
          final_artifact_hash: `sha256:${String(section.original_index).repeat(64).slice(0, 64)}`,
        },
        null,
        2,
      )}\n`,
    );
  }
}

it('fanInParallelRun accepts prepared default output next to an absolute input outside cwd', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-fan-in-cwd-'),
  );
  const inputRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-fan-in-input-'),
  );
  const inputPath = path.join(inputRoot, 'draft.md');
  await writeFile(inputPath, '# A\nFirst\n\n# B\nSecond\n');

  const prepared = await prepareParallelRun({
    inputPath,
    runDir: path.join(tempRoot, '.consensus/run'),
    cwd: tempRoot,
    goal: 'Fan in default output.',
    peers: ['claude', 'codex'],
    maxRounds: 2,
    agency: 'moderate',
    preflight: async () => ({ peers: ['claude', 'codex'], warnings: [] }),
  });
  const manifest = await readJson(prepared.manifestPath);
  await writeCompletedSectionOutputs(manifest);

  const result = await fanInParallelRun(prepared.manifestPath, {
    cwd: tempRoot,
  });

  expect(result.status).toBe('converged');
  expect(manifest.output_path).toBe(`${inputPath}.consensus.md`);
  expect((await stat(manifest.output_path)).isFile()).toBe(true);
  expect(await readFile(manifest.output_path, 'utf8')).toMatch(/Final 0: A/);
});

it('fanInParallelRun assembles section outputs in original order with parallel metadata', async () => {
  const { tempRoot, prepared, manifest } = await prepareCompletedManifest();
  const result = await fanInParallelRun(prepared.manifestPath, {
    cwd: tempRoot,
    allowRoot: tempRoot,
  });

  expect(result.mode).toBe('parallel');
  expect(result.parallel).toBe(true);
  expect(result.sections.length).toBe(3);
  expect(result.status).toBe('converged');
  expect((await stat(manifest.output_path)).isFile()).toBe(true);
  expect(
    result.sections.map((section: JsonRecord) => section.original_index),
  ).toEqual([0, 1, 2]);

  const artifact = await readFile(manifest.output_path, 'utf8');
  expect(artifact).toMatch(/- Parallel: true/);
  expect(artifact).toMatch(/section-runner-01-intro-0/);
  expect(artifact).toMatch(/section-runner-02-details-1/);
  expect(artifact).toMatch(/section-runner-03-close-2/);
  expect(
    artifact.indexOf('Final 0: Intro') < artifact.indexOf('Final 1: Details'),
  ).toBeTruthy();
  expect(
    artifact.indexOf('Final 1: Details') < artifact.indexOf('Final 2: Close'),
  ).toBeTruthy();

  const resolution = extractJsonBlock(artifact, 'consensus-resolution');
  expect(resolution.parallel).toBe(true);
  expect(resolution.subagent_ids).toEqual(
    manifest.sections.map((section: JsonRecord) => section.subagent_id),
  );
});

it('fanInParallelRun rejects manifest section paths that escape the prepared run directory', async () => {
  const { tempRoot, prepared, manifest } = await prepareCompletedManifest();
  const escapedRecords = path.join(tempRoot, 'escaped-records.json');
  await writeFile(escapedRecords, '[]\n');
  manifest.sections[0].output_records = escapedRecords;
  await writeFile(
    prepared.manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  await expect(
    fanInParallelRun(prepared.manifestPath, {
      cwd: tempRoot,
      allowRoot: tempRoot,
    }),
  ).rejects.toThrow(/output_records.*outside.*run/i);
});

it('fanInParallelRun rejects manifest output paths outside cwd or allow-root', async () => {
  const { tempRoot, prepared, manifest } = await prepareCompletedManifest();
  const escapedOutputRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-output-escape-'),
  );
  manifest.output_path = path.join(escapedOutputRoot, 'escaped.consensus.md');
  await writeFile(
    prepared.manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  await expect(
    fanInParallelRun(prepared.manifestPath, {
      cwd: tempRoot,
      allowRoot: tempRoot,
    }),
  ).rejects.toThrow(/output_path.*outside allowed root/i);
});

// --- p05-t04: fan-in aggregates an escalated section ---------------------

async function writeMixedSectionOutputs(manifest: JsonRecord) {
  // Section 0 converges; section 1 escalates; section 2 converges. The escalated
  // section must surface without blocking the converged ones.
  const outcomes = ['converged', 'escalation', 'converged'];
  for (const section of manifest.sections) {
    const outcome = outcomes[section.original_index] ?? 'converged';
    await writeFile(
      section.output_section,
      `Final ${section.original_index}: ${section.name}\n`,
    );
    await writeFile(
      section.output_records,
      `${JSON.stringify(
        [
          {
            schema_version: 'v1',
            round_index: 1,
            turn_index: 1,
            agent: 'claude',
            verdict: outcome === 'escalation' ? 'REVISE' : 'ACCEPT',
            reasoning: `${outcome} ${section.name}`,
          },
        ],
        null,
        2,
      )}\n`,
    );
    const status =
      outcome === 'escalation'
        ? {
            schema_version: 'v1',
            status: 'escalation',
            termination_reason: 'persistent_disagreement',
            iteration_mode: 'parallel_synthesized',
            turns: 2,
            rounds: 1,
            escalation: {
              trigger: 'persistent_disagreement',
              decide_via: 'host',
              decision_kinds: ['blend'],
            },
            final_artifact_hash: `sha256:${String(section.original_index).repeat(64).slice(0, 64)}`,
          }
        : {
            schema_version: 'v1',
            status: 'converged',
            termination_reason: 'double_accept',
            turns: 2,
            rounds: 1,
            final_artifact_hash: `sha256:${String(section.original_index).repeat(64).slice(0, 64)}`,
          };
    await writeFile(
      section.output_status,
      `${JSON.stringify(status, null, 2)}\n`,
    );
  }
}

it('fanInParallelRun aggregates an escalated section without blocking others', async () => {
  const { tempRoot, prepared, manifest } = await prepareCompletedManifest();
  await writeMixedSectionOutputs(manifest);

  const result = await fanInParallelRun(prepared.manifestPath, {
    cwd: tempRoot,
    allowRoot: tempRoot,
  });

  // Two converged + one escalated → partial, not a hard error; ordering preserved.
  expect(result.status).toBe('partial');
  expect(
    result.sections.map((section: JsonRecord) => section.original_index),
  ).toEqual([0, 1, 2]);
  expect(result.sections[1].status.status).toBe('escalation');

  const artifact = await readFile(manifest.output_path, 'utf8');
  // The escalated section joins impasse accounting and is surfaced in the summary.
  const resolution = extractJsonBlock(artifact, 'consensus-resolution');
  expect(resolution.sections.escalation).toBe(1);
  expect(resolution.sections.converged).toBe(2);
  expect(artifact).toMatch(/1 escalation/);
});

it('fanInParallelRun with --fail-on-section-error does not fail solely on escalation', async () => {
  const { tempRoot, prepared, manifest } = await prepareCompletedManifest();
  await writeMixedSectionOutputs(manifest);

  // Escalation is a partial outcome (like impasse re-presented to a host), not a
  // hard section error: fan-in completes and surfaces it rather than throwing.
  const result = await fanInParallelRun(prepared.manifestPath, {
    cwd: tempRoot,
    allowRoot: tempRoot,
    failOnSectionError: true,
  });
  expect(result.status).toBe('partial');
});

it('runWrapperCli fans in a prepared manifest', async () => {
  const { tempRoot, prepared, manifest } = await prepareCompletedManifest();
  const stdout = captureWriter();
  const stderr = captureWriter();
  const exitCode = await runWrapperCli(
    ['--fan-in', prepared.manifestPath, '--allow-root', tempRoot],
    {
      stdout: stdout.stream,
      stderr: stderr.stream,
    },
  );

  expect(exitCode, stderr.value()).toBe(0);
  const artifact = await readFile(manifest.output_path, 'utf8');
  expect(artifact).toMatch(/Final 0: Intro/);

  const events = stdout
    .value()
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  expect(events[0].event).toBe('run_started');
  expect(events.at(-1).event).toBe('run_completed');
  expect(events.at(-1).status).toBe('converged');
  expect(events.at(-1).output_path).toBe(manifest.output_path);
});
