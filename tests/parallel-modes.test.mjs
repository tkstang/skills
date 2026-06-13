import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runSequential } from '../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const fixtureBin = path.join(repoRoot, 'tests/fixtures/bin');
const sampleInput = path.join(repoRoot, 'tests/fixtures/sample-input.md');

// A parallel-mode CONVERGED verdict from the paseo stub: both peers emit it each
// round, so every section converges in round 1 (mutual_converged at moderate).
const CONVERGED_VERDICT = JSON.stringify({
  schema_version: 'v1',
  verdict: 'CONVERGED',
  reasoning: 'Both revisions already agree.',
  critique: {
    own_previous: 'My prior revision reads well.',
    peer_previous: "The peer's prior revision is equivalent."
  }
});

function stubEnv(overrides = {}) {
  return {
    PATH: `${fixtureBin}${path.delimiter}${process.env.PATH}`,
    PASEO_STUB_RESPONSE_JSON: CONVERGED_VERDICT,
    ...overrides
  };
}

async function runParallel(tempRoot, suffix) {
  const outputPath = path.join(tempRoot, `out-${suffix}.consensus.md`);
  const runDir = path.join(tempRoot, `.consensus/run-${suffix}`);
  const result = await runSequential({
    inputPath: sampleInput,
    output: outputPath,
    runDir,
    allowRoot: tempRoot,
    cwd: tempRoot,
    goal: 'Tighten every section.',
    peers: ['claude', 'codex'],
    iteration: 'parallel_revision',
    maxRounds: 3,
    agency: 'moderate',
    preflight: async () => ({ peers: ['claude', 'codex'], warnings: [] }),
    env: stubEnv()
  });
  const artifact = await readFile(outputPath, 'utf8');
  return { result, artifact };
}

function extractJsonBlock(markdown, label) {
  const pattern = new RegExp('<!-- consensus:' + label + '\\n([\\s\\S]*?)\\n-->');
  const match = markdown.match(pattern);
  assert.ok(match, `missing ${label} JSON block`);
  return JSON.parse(match[1]);
}

function readRecords(artifact) {
  // Pull all consensus-verdict blocks from the deliberation log.
  const pattern = /<!-- consensus:consensus-verdict\n([\s\S]*?)\n-->/g;
  const verdicts = [];
  let match;
  while ((match = pattern.exec(artifact)) !== null) {
    verdicts.push(JSON.parse(match[1]));
  }
  return verdicts;
}

test('parallel_revision multi-section run converges end-to-end via the paseo stub', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-parallel-'));
  const { result, artifact } = await runParallel(tempRoot, 'converge');

  assert.equal(result.sections.length, 3);
  assert.equal(result.status, 'converged');
  for (const section of result.sections) {
    assert.equal(section.status.status, 'converged');
    assert.equal(section.status.iteration_mode, 'parallel_revision');
    // Each converged section ran exactly one round of two peer calls.
    assert.equal(section.status.peer_calls, 2);
  }

  const resolution = extractJsonBlock(artifact, 'consensus-resolution');
  assert.equal(resolution.iteration, 'parallel_revision');
  assert.equal(resolution.sections.converged, 3);
  assert.equal(resolution.peer_calls, 6);
  assert.equal(resolution.synthesis_calls, 0);
});

test('parallel_revision artifact records per-round critiques for both peers', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-parallel-critique-'));
  const { artifact } = await runParallel(tempRoot, 'critique');

  const verdicts = readRecords(artifact);
  // 3 sections x 2 peers = 6 peer verdicts, each carrying a critique.
  const parallelVerdicts = verdicts.filter((verdict) => verdict.verdict === 'CONVERGED');
  assert.equal(parallelVerdicts.length, 6);
  for (const verdict of parallelVerdicts) {
    assert.ok(verdict.critique, 'each parallel verdict carries a critique');
    assert.equal(typeof verdict.critique.own_previous, 'string');
    assert.equal(typeof verdict.critique.peer_previous, 'string');
  }
  assert.match(artifact, /own_previous/);
  assert.match(artifact, /peer_previous/);
});

test('parallel_revision stubbed runs are byte-reproducible modulo timestamps and run id', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-parallel-repro-'));
  const first = await runParallel(tempRoot, 'one');
  const second = await runParallel(tempRoot, 'two');

  function normalize(artifact) {
    return artifact
      .replace(/^timestamp:.*$/gm, 'timestamp: <ts>')
      .replace(/"timestamp": "[^"]*"/g, '"timestamp": "<ts>"')
      .replace(/^generated_at:.*$/gm, 'generated_at: <ts>')
      .replace(/^started_at:.*$/gm, 'started_at: <ts>')
      .replace(/^ended_at:.*$/gm, 'ended_at: <ts>')
      .replace(/"started_at": "[^"]*"/g, '"started_at": "<ts>"')
      .replace(/"ended_at": "[^"]*"/g, '"ended_at": "<ts>"')
      .replace(/"wall_clock_ms": \d+/g, '"wall_clock_ms": <ms>')
      .replace(/^run_id:.*$/gm, 'run_id: <run>')
      .replace(/"run_id": "[^"]*"/g, '"run_id": "<run>"')
      .replace(/^wall_clock_ms:.*$/gm, 'wall_clock_ms: <ms>')
      .replace(/run-(one|two)/g, 'run-<x>')
      .replace(/out-(one|two)\.consensus\.md/g, 'out-<x>.consensus.md');
  }

  assert.equal(normalize(first.artifact), normalize(second.artifact));

  // Records streams (sections) are identical modulo per-record timestamps.
  function recordsOf(result) {
    return result.sections.map((section) =>
      section.records.map(({ timestamp, ...rest }) => rest)
    );
  }
  assert.deepEqual(recordsOf(first.result), recordsOf(second.result));
});
