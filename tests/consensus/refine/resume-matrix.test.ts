/**
 * resume-matrix.test.ts — Interruption-point resume matrix.
 *
 * Each interruption point feeds a crafted record stream into runConsensusLoop as
 * `initialRecords` and asserts the loop resumes at the correct entry point per the
 * design's two-level transaction contract (design Error Handling / §1).
 */

import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import * as consensusLoop from '../../../plugins/consensus/skills/refine/scripts/consensus-loop.mjs';

const { hashArtifact, runConsensusLoop } = consensusLoop;

type JsonRecord = Record<string, any>;

async function loopPaths(tempRoot: string, suffix: string, input: string) {
  const dir = path.join(tempRoot, suffix);
  const sectionFile = path.join(dir, 'section.md');
  return {
    sectionFile,
    argv: [
      '--section-file',
      sectionFile,
      '--goal',
      'Tighten.',
      '--peers',
      'claude,codex',
      '--max-rounds',
      '5',
      '--agency',
      'moderate',
      '--iteration',
      'parallel_synthesized',
      '--synthesizer',
      'claude',
      '--output-records',
      path.join(dir, 'records.json'),
      '--output-section',
      path.join(dir, 'output.md'),
      '--output-status',
      path.join(dir, 'status.json'),
    ],
    input,
    dir,
  };
}

function peerRecord(round: number, agent: string, text: string) {
  return {
    schema_version: 'v1',
    turn_index: (round - 1) * 2 + (agent === 'claude' ? 1 : 2),
    round_index: round,
    agent,
    verdict: 'REVISE',
    reasoning: 'revise',
    critique: { own_previous: 'o', peer_previous: 'p' },
    proposed_artifact: text,
    artifact_hash: hashArtifact(text),
    iteration_mode: 'parallel_synthesized',
  };
}

function synthesisRecord(round: number, text: string) {
  return {
    schema_version: 'v1',
    record_type: 'synthesis',
    round_index: round,
    synthesizer: 'claude',
    synthesized_artifact: text,
    synthesis_reasoning: 'merged',
    unresolved_disagreements: [],
    artifact_hash: hashArtifact(text),
    iteration_mode: 'parallel_synthesized',
  };
}

function countingStubs(convergeText: string) {
  const calls = { peer: 0, synthesis: 0 };
  const invokePeer = async () => {
    calls.peer += 1;
    return {
      json: {
        schema_version: 'v1',
        verdict: 'REVISE',
        reasoning: 'adopt the merge',
        critique: { own_previous: 'o', peer_previous: 'p' },
        proposed_artifact: convergeText,
      },
      stdout: '{"id":"peer"}',
    };
  };
  const invokeSynthesizer = async () => {
    calls.synthesis += 1;
    return {
      json: {
        schema_version: 'v1',
        synthesized_artifact: convergeText,
        synthesis_reasoning: 'merged favoring stronger reasoning',
        unresolved_disagreements: [],
      },
      stdout: '{"id":"synth"}',
    };
  };
  return { calls, invokePeer, invokeSynthesizer };
}

const seedInput = '# Intro\n\nSeed.\n';

it('resume mid-peer-subround (no committed pair) re-executes the round', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-resume-midpeer-'),
  );
  const { argv } = await loopPaths(tempRoot, 'midpeer', seedInput);
  const merged = '# Intro\n\nStable merge.\n';
  const stubs = countingStubs(merged);

  // No committed pair for the in-flight round: initialRecords is empty.
  const result = await runConsensusLoop(argv, {
    initialRecords: [],
    initialArtifact: seedInput,
    invokePeer: stubs.invokePeer,
    invokeSynthesizer: stubs.invokeSynthesizer,
  });

  // Round 1 must run a fresh peer subround (2 peer calls) then synthesis.
  expect(stubs.calls.peer >= 2).toBe(true);
  expect(stubs.calls.synthesis >= 1).toBe(true);
  // Round 1 peers ran (turn_index 1 and 2 present in the stream).
  const round1Peers = result.records.filter(
    (record: JsonRecord) =>
      record.round_index === 1 && record.record_type !== 'synthesis',
  );
  expect(round1Peers.length).toBe(2);
});

it('resume pending-synthesis (pair without synthesis) resumes at synthesis only', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-resume-pending-'),
  );
  const { argv } = await loopPaths(tempRoot, 'pending', seedInput);
  const pairText = '# Intro\n\nRound 1 revision.\n';
  const stubs = countingStubs('# Intro\n\nRound 2 revision.\n');

  // Round 1 has a committed peer pair but NO synthesis record (pending-synthesis).
  const initialRecords = [
    peerRecord(1, 'claude', pairText),
    peerRecord(1, 'codex', pairText),
  ];

  const result = await runConsensusLoop(argv, {
    initialRecords,
    initialArtifact: pairText,
    invokePeer: stubs.invokePeer,
    invokeSynthesizer: stubs.invokeSynthesizer,
  });

  // The pending synthesis for round 1 must run WITHOUT re-running round 1 peers.
  const synthesisForRound1 = result.records.filter(
    (record: JsonRecord) =>
      record.record_type === 'synthesis' && record.round_index === 1,
  );
  expect(
    synthesisForRound1.length,
    'round 1 synthesis produced on resume',
  ).toBe(1);

  const round1Peers = result.records.filter(
    (record: JsonRecord) =>
      record.round_index === 1 && record.record_type !== 'synthesis',
  );
  expect(round1Peers.length, 'round 1 peer pair not duplicated').toBe(2);
});

it('resume post-synthesis (complete round) continues at the next round', async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-resume-postsynth-'),
  );
  const { argv } = await loopPaths(tempRoot, 'postsynth', seedInput);
  const round1Text = '# Intro\n\nRound 1 synthesized.\n';
  const stubs = countingStubs('# Intro\n\nRound 2 revision.\n');

  // A complete round 1: peer pair + synthesis. Resume must start round 2.
  const initialRecords = [
    peerRecord(1, 'claude', round1Text),
    peerRecord(1, 'codex', round1Text),
    synthesisRecord(1, round1Text),
  ];

  const result = await runConsensusLoop(argv, {
    initialRecords,
    initialArtifact: round1Text,
    invokePeer: stubs.invokePeer,
    invokeSynthesizer: stubs.invokeSynthesizer,
  });

  // No additional synthesis for round 1; round 2 peers run next.
  const round1Synthesis = result.records.filter(
    (record: JsonRecord) =>
      record.record_type === 'synthesis' && record.round_index === 1,
  );
  expect(round1Synthesis.length, 'round 1 synthesis not re-run').toBe(1);

  const round2Peers = result.records.filter(
    (record: JsonRecord) =>
      record.round_index === 2 && record.record_type !== 'synthesis',
  );
  expect(round2Peers.length, 'round 2 peer subround executed on resume').toBe(
    2,
  );
});
