import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

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
    preflight: async () => ({ peers: ['claude', 'codex'], warnings: [] })
  });

  const manifest = await readJson(prepared.manifestPath);
  for (const section of [...manifest.sections].reverse()) {
    await writeFile(section.output_section, `Final ${section.original_index}: ${section.name}\n`);
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
            reasoning: `accepted ${section.name}`
          }
        ],
        null,
        2
      )}\n`
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
          final_artifact_hash: `sha256:${String(section.original_index).repeat(64).slice(0, 64)}`
        },
        null,
        2
      )}\n`
    );
  }

  return { tempRoot, prepared, manifest };
}

test('fanInParallelRun assembles section outputs in original order with parallel metadata', async () => {
  const { tempRoot, prepared, manifest } = await prepareCompletedManifest();
  const result = await fanInParallelRun(prepared.manifestPath, { cwd: tempRoot, allowRoot: tempRoot });

  assert.equal(result.mode, 'parallel');
  assert.equal(result.parallel, true);
  assert.equal(result.sections.length, 3);
  assert.equal(result.status, 'converged');
  assert.equal((await stat(manifest.output_path)).isFile(), true);
  assert.deepEqual(
    result.sections.map((section) => section.original_index),
    [0, 1, 2]
  );

  const artifact = await readFile(manifest.output_path, 'utf8');
  assert.match(artifact, /- Parallel: true/);
  assert.match(artifact, /section-runner-01-intro-0/);
  assert.match(artifact, /section-runner-02-details-1/);
  assert.match(artifact, /section-runner-03-close-2/);
  assert.ok(artifact.indexOf('Final 0: Intro') < artifact.indexOf('Final 1: Details'));
  assert.ok(artifact.indexOf('Final 1: Details') < artifact.indexOf('Final 2: Close'));

  const resolution = extractJsonBlock(artifact, 'consensus-resolution');
  assert.equal(resolution.parallel, true);
  assert.deepEqual(resolution.subagent_ids, manifest.sections.map((section) => section.subagent_id));
});

test('fanInParallelRun rejects manifest section paths that escape the prepared run directory', async () => {
  const { tempRoot, prepared, manifest } = await prepareCompletedManifest();
  const escapedRecords = path.join(tempRoot, 'escaped-records.json');
  await writeFile(escapedRecords, '[]\n');
  manifest.sections[0].output_records = escapedRecords;
  await writeFile(prepared.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  await assert.rejects(
    fanInParallelRun(prepared.manifestPath, { cwd: tempRoot, allowRoot: tempRoot }),
    /output_records.*outside.*run/i
  );
});

test('fanInParallelRun rejects manifest output paths outside cwd or allow-root', async () => {
  const { tempRoot, prepared, manifest } = await prepareCompletedManifest();
  const escapedOutputRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-output-escape-'));
  manifest.output_path = path.join(escapedOutputRoot, 'escaped.consensus.md');
  await writeFile(prepared.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  await assert.rejects(
    fanInParallelRun(prepared.manifestPath, { cwd: tempRoot, allowRoot: tempRoot }),
    /output_path.*outside allowed root/i
  );
});

test('runWrapperCli fans in a prepared manifest', async () => {
  const { tempRoot, prepared, manifest } = await prepareCompletedManifest();
  const stdout = captureWriter();
  const stderr = captureWriter();
  const exitCode = await runWrapperCli(['--fan-in', prepared.manifestPath, '--allow-root', tempRoot], {
    stdout: stdout.stream,
    stderr: stderr.stream
  });

  assert.equal(exitCode, 0, stderr.value());
  const artifact = await readFile(manifest.output_path, 'utf8');
  assert.match(artifact, /Final 0: Intro/);

  const events = stdout.value().trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(events[0].event, 'run_started');
  assert.equal(events.at(-1).event, 'run_completed');
  assert.equal(events.at(-1).status, 'converged');
  assert.equal(events.at(-1).output_path, manifest.output_path);
});
