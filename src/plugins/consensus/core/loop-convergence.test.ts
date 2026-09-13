import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import * as consensusLoop from '../../../plugins/consensus/scripts/consensus-loop.mjs';

const {
  detectConvergence,
  detectOscillation,
  detectParallelConvergence,
  detectParallelOscillation,
  detectSynthesisStability,
  hashArtifact,
  normalizeForHash,
  runConsensusLoop,
} = consensusLoop;

type RunFiles = {
  sectionPath: string;
  recordsPath: string;
  outputPath: string;
  statusPath: string;
};
type JsonRecord = Record<string, any>;

function parallelRecord(
  agent: string,
  {
    verdict,
    text,
    round = 1,
  }: { verdict: string; text: string; round?: number },
) {
  return {
    agent,
    round_index: round,
    iteration_mode: 'parallel_revision',
    verdict,
    proposed_artifact: text,
    artifact_hash: hashArtifact(text),
    critique: { own_previous: 'o', peer_previous: 'p' },
  };
}

async function makeRunFiles(sectionText = 'Initial section.\n') {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-round-'));
  const sectionPath = path.join(tempRoot, 'section.md');
  await writeFile(sectionPath, sectionText);
  return {
    tempRoot,
    sectionPath,
    recordsPath: path.join(tempRoot, 'records.json'),
    outputPath: path.join(tempRoot, 'output.md'),
    statusPath: path.join(tempRoot, 'status.json'),
  };
}

function alternatingArgv(files: RunFiles, extra: string[] = []) {
  return [
    '--section-file',
    files.sectionPath,
    '--goal',
    'Make this clearer.',
    '--peers',
    'claude,codex',
    '--max-rounds',
    '3',
    '--agency',
    'moderate',
    '--output-records',
    files.recordsPath,
    '--output-section',
    files.outputPath,
    '--output-status',
    files.statusPath,
    ...extra,
  ];
}

function stripVolatile(records: JsonRecord[]) {
  return records.map(({ timestamp, ...rest }) => rest);
}

it('normalizeForHash canonicalizes line endings, trailing whitespace, and EOF newlines', () => {
  expect(normalizeForHash('Hello  \r\nworld\t\r\n\r\n')).toBe('Hello\nworld\n');
  expect(normalizeForHash('Hello\nworld\n')).toBe(
    normalizeForHash('Hello\r\nworld\n\n'),
  );
  expect(normalizeForHash('')).toBe('');
});

it('normalizeForHash can be made strict through options', () => {
  expect(
    normalizeForHash('Hello  \n', { trimTrailingWhitespace: false }),
  ).not.toBe('Hello\n');
  expect(normalizeForHash('Hello  \n', { trimTrailingWhitespace: false })).toBe(
    'Hello  \n',
  );
});

it('hashArtifact returns a prefixed SHA-256 digest over normalized text', () => {
  const first = hashArtifact('alpha\r\nbeta  \n\n');
  const second = hashArtifact('alpha\nbeta\n');

  expect(first).toMatch(/^sha256:[a-f0-9]{64}$/);
  expect(first).toBe(second);
});

it('detectConvergence reports adjacent matching hashes', () => {
  const hash = hashArtifact('same');
  const result = detectConvergence([
    { turn_index: 1, agent: 'claude', artifact_hash: hash, verdict: 'REVISE' },
    { turn_index: 2, agent: 'codex', artifact_hash: hash, verdict: 'REVISE' },
  ]);

  expect(result).toEqual({
    converged: true,
    reason: 'hash_match',
    record_indexes: [0, 1],
    artifact_hash: hash,
  });
});

it('detectConvergence reports double ACCEPT on the same hash', () => {
  const hash = hashArtifact('accepted');
  const result = detectConvergence([
    { turn_index: 1, artifact_hash: hash, verdict: 'ACCEPT' },
    { turn_index: 2, artifact_hash: hash, verdict: 'ACCEPT' },
  ]);

  expect(result.converged).toBe(true);
  expect(result.reason).toBe('double_accept');
  expect(result.record_indexes).toEqual([0, 1]);
});

it('detectConvergence returns a stable non-converged shape', () => {
  expect(
    detectConvergence([
      { artifact_hash: hashArtifact('one'), verdict: 'REVISE' },
      { artifact_hash: hashArtifact('two'), verdict: 'REVISE' },
    ]),
  ).toEqual({ converged: false, reason: null });
});

it('detectConvergence uses strict bytewise hashing for minimal agency', () => {
  const records = [
    { artifact: 'same text  \n', verdict: 'REVISE' },
    { artifact: 'same text\n', verdict: 'REVISE' },
  ];

  expect(detectConvergence(records, { agency: 'moderate' }).converged).toBe(
    true,
  );
  expect(detectConvergence(records, { agency: 'minimal' })).toEqual({
    converged: false,
    reason: null,
  });
});

it('detectConvergence allows maximum agency double ACCEPT near matches', () => {
  const result = detectConvergence(
    [
      { artifact_hash: hashArtifact('accepted one'), verdict: 'ACCEPT' },
      { artifact_hash: hashArtifact('accepted two'), verdict: 'ACCEPT' },
    ],
    { agency: 'maximum' },
  );

  expect(result.converged).toBe(true);
  expect(result.reason).toBe('double_accept');
  expect(result.agency_decision).toBe('maximum_double_accept_near_match');
  expect(result.record_indexes).toEqual([0, 1]);
});

it('detectOscillation detects four-turn two-state alternation', () => {
  const a = hashArtifact('A');
  const b = hashArtifact('B');
  const result = detectOscillation([
    { artifact_hash: a },
    { artifact_hash: b },
    { artifact_hash: a },
    { artifact_hash: b },
  ]);

  expect(result).toEqual({
    oscillating: true,
    reason: 'oscillation_detected',
    record_indexes: [0, 1, 2, 3],
    hashes: [a, b],
  });
});

it('detectOscillation ignores non-alternating records', () => {
  const a = hashArtifact('A');
  const b = hashArtifact('B');
  const c = hashArtifact('C');

  expect(
    detectOscillation([
      { artifact_hash: a },
      { artifact_hash: b },
      { artifact_hash: c },
      { artifact_hash: b },
    ]),
  ).toEqual({ oscillating: false, reason: null });
});

it('alternating round execution produces a stable records stream (characterization)', async () => {
  const revisions = [
    'Round one revision.\n',
    'Round two revision.\n',
    'Round two revision.\n',
  ];
  async function runOnce() {
    const files = await makeRunFiles('Seed text.\n');
    let turn = 0;
    const result = await runConsensusLoop(alternatingArgv(files), {
      invokePeer: async () => {
        const proposed = revisions[turn] ?? revisions.at(-1);
        turn += 1;
        return {
          json: {
            schema_version: 'v1',
            verdict: 'REVISE',
            reasoning: `revision ${turn}`,
            proposed_artifact: proposed,
          },
          stdout: '{"id":"raw"}',
        };
      },
    });
    return result;
  }

  const result = await runOnce();
  expect(result.status.status).toBe('converged');
  expect(result.status.termination_reason).toBe('hash_match');

  // Stream is a deterministic function of stubbed responses (timestamps aside).
  expect(stripVolatile(result.records)).toEqual([
    {
      schema_version: 'v1',
      turn_index: 1,
      round_index: 1,
      agent: 'claude',
      verdict: 'REVISE',
      reasoning: 'revision 1',
      artifact_hash: hashArtifact('Round one revision.\n'),
      iteration_mode: 'alternating',
      raw_provider_response: '{"id":"raw"}',
      proposed_artifact: 'Round one revision.\n',
    },
    {
      schema_version: 'v1',
      turn_index: 2,
      round_index: 1,
      agent: 'codex',
      verdict: 'REVISE',
      reasoning: 'revision 2',
      artifact_hash: hashArtifact('Round two revision.\n'),
      iteration_mode: 'alternating',
      raw_provider_response: '{"id":"raw"}',
      proposed_artifact: 'Round two revision.\n',
    },
    {
      schema_version: 'v1',
      turn_index: 3,
      round_index: 2,
      agent: 'claude',
      verdict: 'REVISE',
      reasoning: 'revision 3',
      artifact_hash: hashArtifact('Round two revision.\n'),
      iteration_mode: 'alternating',
      raw_provider_response: '{"id":"raw"}',
      proposed_artifact: 'Round two revision.\n',
    },
  ]);

  // Repeat run reproduces the identical stream (NFR1 / FR9 regression lock).
  const second = await runOnce();
  expect(stripVolatile(second.records)).toEqual(stripVolatile(result.records));
});

it('detectParallelConvergence converges on same-round normalized hash match', () => {
  const records = [
    parallelRecord('claude', { verdict: 'REVISE', text: 'Final text  \n' }),
    parallelRecord('codex', { verdict: 'REVISE', text: 'Final text\n' }),
  ];

  const result = detectParallelConvergence(records, { agency: 'moderate' });
  expect(result.converged).toBe(true);
  expect(result.reason).toBe('parallel_hash_match');
  expect(result.record_indexes).toEqual([0, 1]);
});

it('detectParallelConvergence uses strict hashing at minimal agency', () => {
  const records = [
    parallelRecord('claude', { verdict: 'REVISE', text: 'Final text  \n' }),
    parallelRecord('codex', { verdict: 'REVISE', text: 'Final text\n' }),
  ];

  expect(
    detectParallelConvergence(records, { agency: 'moderate' }).converged,
  ).toBe(true);
  expect(detectParallelConvergence(records, { agency: 'minimal' })).toEqual({
    converged: false,
    reason: null,
  });
});

it('detectParallelConvergence converges on mutual ACCEPT_PEER adopting identical prior text', () => {
  const shared = 'Agreed text.\n';
  const records = [
    parallelRecord('claude', { verdict: 'ACCEPT_PEER', text: shared }),
    parallelRecord('codex', { verdict: 'ACCEPT_PEER', text: shared }),
  ];

  const result = detectParallelConvergence(records, { agency: 'moderate' });
  expect(result.converged).toBe(true);
  expect(result.reason).toBe('mutual_accept_peer');
});

it('detectParallelConvergence does NOT converge on mutual ACCEPT_PEER adopting differing texts (swap)', () => {
  const records = [
    parallelRecord('claude', {
      verdict: 'ACCEPT_PEER',
      text: 'Codex version.\n',
    }),
    parallelRecord('codex', {
      verdict: 'ACCEPT_PEER',
      text: 'Claude version.\n',
    }),
  ];

  expect(detectParallelConvergence(records, { agency: 'moderate' })).toEqual({
    converged: false,
    reason: null,
  });
});

it('detectParallelConvergence converges on mutual CONVERGED at moderate and maximum but not minimal', () => {
  const records = [
    parallelRecord('claude', { verdict: 'CONVERGED', text: 'A version.\n' }),
    parallelRecord('codex', { verdict: 'CONVERGED', text: 'B version.\n' }),
  ];

  const moderate = detectParallelConvergence(records, { agency: 'moderate' });
  expect(moderate.converged).toBe(true);
  expect(moderate.reason).toBe('mutual_converged');

  expect(
    detectParallelConvergence(records, { agency: 'maximum' }).converged,
  ).toBe(true);
  expect(detectParallelConvergence(records, { agency: 'minimal' })).toEqual({
    converged: false,
    reason: null,
  });
});

function parallelRound(round: number, claudeText: string, codexText: string) {
  return [
    parallelRecord('claude', { verdict: 'REVISE', text: claudeText, round }),
    parallelRecord('codex', { verdict: 'REVISE', text: codexText, round }),
  ];
}

it('detectParallelOscillation detects pair-based A/B/A/B cycling over four rounds', () => {
  // Order-normalized pairs: round1 = {A,B}, round2 = {C,D}, round3 = {A,B}, round4 = {C,D}
  const records = [
    ...parallelRound(1, 'A\n', 'B\n'),
    ...parallelRound(2, 'C\n', 'D\n'),
    // Order swapped within the round to prove order-normalization.
    ...parallelRound(3, 'B\n', 'A\n'),
    ...parallelRound(4, 'D\n', 'C\n'),
  ];

  const result = detectParallelOscillation(records, { agency: 'moderate' });
  expect(result.oscillating).toBe(true);
  expect(result.reason).toBe('oscillation_detected');
});

it('detectParallelOscillation ignores stable-but-diverged pairs', () => {
  const records = [
    ...parallelRound(1, 'A\n', 'B\n'),
    ...parallelRound(2, 'A\n', 'B\n'),
    ...parallelRound(3, 'A\n', 'B\n'),
    ...parallelRound(4, 'A\n', 'B\n'),
  ];

  expect(detectParallelOscillation(records, { agency: 'moderate' })).toEqual({
    oscillating: false,
    reason: null,
  });
});

it('detectParallelOscillation does not fire when only three rounds are present', () => {
  const records = [
    ...parallelRound(1, 'A\n', 'B\n'),
    ...parallelRound(2, 'C\n', 'D\n'),
    ...parallelRound(3, 'A\n', 'B\n'),
  ];

  expect(detectParallelOscillation(records, { agency: 'moderate' })).toEqual({
    oscillating: false,
    reason: null,
  });
});

function synthesizedRecord(
  agent: string,
  {
    verdict = 'REVISE',
    text,
    round,
  }: { verdict?: string; text: string; round: number },
) {
  return {
    agent,
    round_index: round,
    iteration_mode: 'parallel_synthesized',
    verdict,
    proposed_artifact: text,
    artifact_hash: hashArtifact(text),
    critique: { own_previous: 'o', peer_previous: 'p' },
  };
}

function synthesisRecord(
  text: string,
  { round, disagreements = [] }: { round: number; disagreements?: string[] },
) {
  return {
    record_type: 'synthesis',
    round_index: round,
    synthesizer: 'claude',
    synthesized_artifact: text,
    synthesis_reasoning: 'merged',
    unresolved_disagreements: disagreements,
    artifact_hash: hashArtifact(text),
    iteration_mode: 'parallel_synthesized',
  };
}

it('detectSynthesisStability converges when both peer revisions match the prior synthesis hash', () => {
  const synth = 'Stable synthesis.\n';
  const records = [
    synthesizedRecord('claude', { text: 'C1.\n', round: 1 }),
    synthesizedRecord('codex', { text: 'X1.\n', round: 1 }),
    synthesisRecord(synth, { round: 1 }),
    // Round 2 peers both revise back to exactly the prior synthesis.
    synthesizedRecord('claude', { text: synth, round: 2 }),
    synthesizedRecord('codex', { text: synth, round: 2 }),
  ];

  const result = detectSynthesisStability(records, { agency: 'moderate' });
  expect(result.converged).toBe(true);
  expect(result.reason).toBe('synthesis_stability');
  expect(result.artifact_hash).toBe(hashArtifact(synth));
});

it('detectSynthesisStability does not converge when only one peer matches the prior synthesis', () => {
  const synth = 'Stable synthesis.\n';
  const records = [
    synthesizedRecord('claude', { text: 'C1.\n', round: 1 }),
    synthesizedRecord('codex', { text: 'X1.\n', round: 1 }),
    synthesisRecord(synth, { round: 1 }),
    synthesizedRecord('claude', { text: synth, round: 2 }),
    synthesizedRecord('codex', { text: 'Different.\n', round: 2 }),
  ];

  expect(detectSynthesisStability(records, { agency: 'moderate' })).toEqual({
    converged: false,
    reason: null,
  });
});

it('detectSynthesisStability does not converge before a synthesis exists to stabilize on', () => {
  const records = [
    synthesizedRecord('claude', { text: 'C1.\n', round: 1 }),
    synthesizedRecord('codex', { text: 'C1.\n', round: 1 }),
  ];

  expect(detectSynthesisStability(records, { agency: 'moderate' })).toEqual({
    converged: false,
    reason: null,
  });
});

it('parallel_synthesized run converges via synthesis stability and records synthesis', async () => {
  const files = await makeRunFiles('Seed.\n');
  const synthText = 'Merged.\n';
  // Round 1: peers diverge, synthesis = Merged. Round 2: both peers revise to Merged.
  let peerCall = 0;
  const result = await runConsensusLoop(
    alternatingArgv(files, [
      '--iteration',
      'parallel_synthesized',
      '--synthesizer',
      'claude',
      '--max-rounds',
      '5',
    ]),
    {
      invokePeer: async ({ round }: { round: number }) => {
        peerCall += 1;
        const text = round === 1 ? `peer-${peerCall}.\n` : synthText;
        return {
          json: {
            schema_version: 'v1',
            verdict: 'REVISE',
            reasoning: `r${peerCall}`,
            critique: { own_previous: 'o', peer_previous: 'p' },
            proposed_artifact: text,
          },
          stdout: '{"id":"peer"}',
        };
      },
      invokeSynthesizer: async () => ({
        json: {
          schema_version: 'v1',
          synthesized_artifact: synthText,
          synthesis_reasoning: 'merged',
          unresolved_disagreements: [],
        },
        stdout: '{"id":"synth"}',
      }),
    },
  );

  expect(result.status.status).toBe('converged');
  expect(result.status.termination_reason).toBe('synthesis_stability');
  expect(result.status.synthesis_calls).toBe(2);
  const synthesisRecords = result.records.filter(
    (record: JsonRecord) => record.record_type === 'synthesis',
  );
  expect(synthesisRecords.length).toBe(2);
  expect(synthesisRecords[0].synthesized_artifact).toBe(synthText);
});

it('detectOscillation (alternating) is untouched by parallel oscillation work', () => {
  const a = hashArtifact('A');
  const b = hashArtifact('B');
  expect(
    detectOscillation([
      { artifact_hash: a },
      { artifact_hash: b },
      { artifact_hash: a },
      { artifact_hash: b },
    ]),
  ).toEqual({
    oscillating: true,
    reason: 'oscillation_detected',
    record_indexes: [0, 1, 2, 3],
    hashes: [a, b],
  });
});
