import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import * as consensusLoop from '../../../plugins/consensus/skills/refine/scripts/consensus-loop.mjs';
// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import * as consensusRefine from '../../../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';

const { callsPerRound } = consensusLoop;
const { runSequential } = consensusRefine;

type JsonRecord = Record<string, any>;

const repoRoot = path.resolve(new URL('../../..', import.meta.url).pathname);
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
    peer_previous: "The peer's prior revision is equivalent.",
  },
});

function stubEnv(overrides: NodeJS.ProcessEnv = {}) {
  return {
    PATH: `${fixtureBin}${path.delimiter}${process.env.PATH}`,
    PASEO_STUB_RESPONSE_JSON: CONVERGED_VERDICT,
    ...overrides,
  };
}

async function runParallel(tempRoot: string, suffix: string) {
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
    env: stubEnv(),
  });
  const artifact = await readFile(outputPath, 'utf8');
  return { result, artifact };
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

function readRecords(artifact: string): JsonRecord[] {
  // Pull all consensus-verdict blocks from the deliberation log.
  const pattern = /<!-- consensus:consensus-verdict\n([\s\S]*?)\n-->/g;
  const verdicts: JsonRecord[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(artifact)) !== null) {
    verdicts.push(JSON.parse(match[1]));
  }
  return verdicts;
}

it('parallel_revision multi-section run converges end-to-end via the paseo stub', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-parallel-'));
  const { result, artifact } = await runParallel(tempRoot, 'converge');

  expect(result.sections.length).toBe(3);
  expect(result.status).toBe('converged');
  for (const section of result.sections) {
    expect(section.status.status).toBe('converged');
    expect(section.status.iteration_mode).toBe('parallel_revision');
    // Each converged section ran exactly one round of two peer calls.
    expect(section.status.peer_calls).toBe(2);
  }

  const resolution = extractJsonBlock(artifact, 'consensus-resolution');
  expect(resolution.iteration).toBe('parallel_revision');
  expect(resolution.sections.converged).toBe(3);
  expect(resolution.peer_calls).toBe(6);
  expect(resolution.synthesis_calls).toBe(0);
});

it('parallel_revision artifact records per-round critiques for both peers', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-parallel-critique-'),
  );
  const { artifact } = await runParallel(tempRoot, 'critique');

  const verdicts = readRecords(artifact);
  // 3 sections x 2 peers = 6 peer verdicts, each carrying a critique.
  const parallelVerdicts = verdicts.filter(
    (verdict) => verdict.verdict === 'CONVERGED',
  );
  expect(parallelVerdicts.length).toBe(6);
  for (const verdict of parallelVerdicts) {
    expect(
      verdict.critique,
      'each parallel verdict carries a critique',
    ).toBeTruthy();
    expect(typeof verdict.critique.own_previous).toBe('string');
    expect(typeof verdict.critique.peer_previous).toBe('string');
  }
  expect(artifact).toMatch(/own_previous/);
  expect(artifact).toMatch(/peer_previous/);
});

function synthesizedStubs(mergedText: string) {
  const invokePeer = async () => ({
    json: {
      schema_version: 'v1',
      verdict: 'REVISE',
      reasoning: 'adopt the merge',
      critique: { own_previous: 'own note', peer_previous: 'peer note' },
      proposed_artifact: mergedText,
    },
    stdout: '{"id":"peer"}',
  });
  const invokeSynthesizer = async () => ({
    json: {
      schema_version: 'v1',
      synthesized_artifact: mergedText,
      synthesis_reasoning: 'Merged both revisions favoring stronger reasoning.',
      unresolved_disagreements: ['Heading capitalization left open.'],
    },
    stdout: '{"id":"synth"}',
  });
  return { invokePeer, invokeSynthesizer };
}

async function runSynthesized(
  tempRoot: string,
  suffix: string,
  { synthesizer }: { synthesizer?: string } = {},
) {
  const outputPath = path.join(tempRoot, `out-${suffix}.consensus.md`);
  const runDir = path.join(tempRoot, `.consensus/run-${suffix}`);
  const { invokePeer, invokeSynthesizer } =
    synthesizedStubs('Merged section.\n');
  const result = await runSequential({
    inputPath: sampleInput,
    output: outputPath,
    runDir,
    allowRoot: tempRoot,
    cwd: tempRoot,
    goal: 'Tighten every section.',
    peers: ['claude', 'codex'],
    iteration: 'parallel_synthesized',
    synthesizer,
    maxRounds: 5,
    agency: 'moderate',
    preflight: async () => ({
      peers: ['claude', 'codex'],
      providerInventory: [
        { id: 'claude', available: true },
        { id: 'codex', available: true },
      ],
      warnings: [],
    }),
    invokePeer,
    invokeSynthesizer,
  });
  const artifact = await readFile(outputPath, 'utf8');
  return { result, artifact };
}

it('parallel_synthesized multi-section run converges via synthesis stability', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-synth-'));
  const { result, artifact } = await runSynthesized(tempRoot, 'converge');

  expect(result.sections.length).toBe(3);
  expect(result.status).toBe('converged');
  for (const section of result.sections) {
    expect(section.status.status).toBe('converged');
    expect(section.status.termination_reason).toBe('synthesis_stability');
    expect(section.status.iteration_mode).toBe('parallel_synthesized');
    // Two rounds of two peer calls + a synthesis per round.
    expect(section.status.peer_calls).toBe(4);
    expect(section.status.synthesis_calls).toBe(2);
  }

  const resolution = extractJsonBlock(artifact, 'consensus-resolution');
  expect(resolution.iteration).toBe('parallel_synthesized');
  expect(resolution.synthesizer).toBe('claude');
  expect(resolution.sections.converged).toBe(3);
  expect(resolution.peer_calls).toBe(12);
  expect(resolution.synthesis_calls).toBe(6);
});

it('parallel_synthesized artifact records synthesis text, reasoning, disagreements, and synthesizer id', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-synth-records-'),
  );
  const { result, artifact } = await runSynthesized(tempRoot, 'records', {
    synthesizer: 'codex',
  });

  // The resolution names the configured synthesizer.
  const resolution = extractJsonBlock(artifact, 'consensus-resolution');
  expect(resolution.synthesizer).toBe('codex');

  // Synthesis records are present in each section's record stream.
  const synthesisRecords = result.sections.flatMap((section: JsonRecord) =>
    section.records.filter(
      (record: JsonRecord) => record.record_type === 'synthesis',
    ),
  );
  expect(
    synthesisRecords.length >= 3,
    'at least one synthesis record per section',
  ).toBeTruthy();
  for (const record of synthesisRecords) {
    expect(record.synthesizer).toBe('codex');
    expect(record.synthesized_artifact).toBe('Merged section.\n');
    expect(record.synthesis_reasoning).toMatch(/stronger reasoning/i);
    expect(record.unresolved_disagreements).toEqual([
      'Heading capitalization left open.',
    ]);
  }

  // The synthesis content also lands in the artifact text.
  expect(artifact).toMatch(/Merged both revisions/);
  expect(artifact).toMatch(/Heading capitalization left open\./);
});

it('parallel_synthesized run_started discloses the synthesis call multiplier', () => {
  // calls_per_round must report { peer: 2, synthesis: 1 } for parallel_synthesized.
  expect(callsPerRound('parallel_synthesized')).toEqual({
    peer: 2,
    synthesis: 1,
  });
});

it('parallel_revision stubbed runs are byte-reproducible modulo timestamps and run id', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-parallel-repro-'),
  );
  const first = await runParallel(tempRoot, 'one');
  const second = await runParallel(tempRoot, 'two');

  function normalize(artifact: string) {
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

  expect(normalize(first.artifact)).toBe(normalize(second.artifact));

  // Records streams (sections) are identical modulo per-record timestamps.
  function recordsOf(result: JsonRecord) {
    return result.sections.map((section: JsonRecord) =>
      section.records.map(({ timestamp, ...rest }: JsonRecord) => rest),
    );
  }
  expect(recordsOf(first.result)).toEqual(recordsOf(second.result));
});
