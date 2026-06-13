import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runSequential } from '../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';
import {
  callsPerRound,
  hashArtifact,
  runConsensusLoop
} from '../plugins/consensus/skills/refine/scripts/consensus-loop.mjs';

function captureStdout() {
  const lines = [];
  return {
    write(chunk) {
      lines.push(String(chunk));
      return true;
    },
    events() {
      return lines.join('').split('\n').filter(Boolean).map((line) => JSON.parse(line));
    }
  };
}

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

function synthesizedStubs(mergedText) {
  const invokePeer = async () => ({
    json: {
      schema_version: 'v1',
      verdict: 'REVISE',
      reasoning: 'adopt the merge',
      critique: { own_previous: 'own note', peer_previous: 'peer note' },
      proposed_artifact: mergedText
    },
    stdout: '{"id":"peer"}'
  });
  const invokeSynthesizer = async () => ({
    json: {
      schema_version: 'v1',
      synthesized_artifact: mergedText,
      synthesis_reasoning: 'Merged both revisions favoring stronger reasoning.',
      unresolved_disagreements: ['Heading capitalization left open.']
    },
    stdout: '{"id":"synth"}'
  });
  return { invokePeer, invokeSynthesizer };
}

async function runSynthesized(tempRoot, suffix, { synthesizer } = {}) {
  const outputPath = path.join(tempRoot, `out-${suffix}.consensus.md`);
  const runDir = path.join(tempRoot, `.consensus/run-${suffix}`);
  const { invokePeer, invokeSynthesizer } = synthesizedStubs('Merged section.\n');
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
        { id: 'codex', available: true }
      ],
      warnings: []
    }),
    invokePeer,
    invokeSynthesizer
  });
  const artifact = await readFile(outputPath, 'utf8');
  return { result, artifact };
}

test('parallel_synthesized multi-section run converges via synthesis stability', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-synth-'));
  const { result, artifact } = await runSynthesized(tempRoot, 'converge');

  assert.equal(result.sections.length, 3);
  assert.equal(result.status, 'converged');
  for (const section of result.sections) {
    assert.equal(section.status.status, 'converged');
    assert.equal(section.status.termination_reason, 'synthesis_stability');
    assert.equal(section.status.iteration_mode, 'parallel_synthesized');
    // Two rounds of two peer calls + a synthesis per round.
    assert.equal(section.status.peer_calls, 4);
    assert.equal(section.status.synthesis_calls, 2);
  }

  const resolution = extractJsonBlock(artifact, 'consensus-resolution');
  assert.equal(resolution.iteration, 'parallel_synthesized');
  assert.equal(resolution.synthesizer, 'claude');
  assert.equal(resolution.sections.converged, 3);
  assert.equal(resolution.peer_calls, 12);
  assert.equal(resolution.synthesis_calls, 6);
});

test('parallel_synthesized artifact records synthesis text, reasoning, disagreements, and synthesizer id', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-synth-records-'));
  const { result, artifact } = await runSynthesized(tempRoot, 'records', { synthesizer: 'codex' });

  // The resolution names the configured synthesizer.
  const resolution = extractJsonBlock(artifact, 'consensus-resolution');
  assert.equal(resolution.synthesizer, 'codex');

  // Synthesis records are present in each section's record stream.
  const synthesisRecords = result.sections.flatMap((section) =>
    section.records.filter((record) => record.record_type === 'synthesis')
  );
  assert.ok(synthesisRecords.length >= 3, 'at least one synthesis record per section');
  for (const record of synthesisRecords) {
    assert.equal(record.synthesizer, 'codex');
    assert.equal(record.synthesized_artifact, 'Merged section.\n');
    assert.match(record.synthesis_reasoning, /stronger reasoning/i);
    assert.deepEqual(record.unresolved_disagreements, ['Heading capitalization left open.']);
  }

  // The synthesis content also lands in the artifact text.
  assert.match(artifact, /Merged both revisions/);
  assert.match(artifact, /Heading capitalization left open\./);
});

test('parallel_synthesized run_started discloses the synthesis call multiplier', () => {
  // calls_per_round must report { peer: 2, synthesis: 1 } for parallel_synthesized.
  assert.deepEqual(callsPerRound('parallel_synthesized'), { peer: 2, synthesis: 1 });
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

// --- p04-t06: escalation lifecycle integration ---------------------------

// A synthesized scenario that escalates on persistent_disagreement, then either
// resolves (disagreements cleared after the host decision) or stays stuck.
function lifecycleStubs({ resolveAfterHostDecision = true } = {}) {
  let hostDecided = false;
  let peerCall = 0;
  const mergedResolved = 'Resolved merge.\n';

  const invokePeer = async () => {
    peerCall += 1;
    // While stuck, peers keep diverging (unique text per call) so synthesis
    // stability never fires — the run stays alive until persistent_disagreement
    // accumulates 3 synthesis records. After the host settles it, both peers
    // adopt the resolved text so stability converges.
    const text = hostDecided && resolveAfterHostDecision ? mergedResolved : `stuck-${peerCall}.\n`;
    return {
      json: {
        schema_version: 'v1',
        verdict: 'REVISE',
        reasoning: 'revise',
        critique: { own_previous: 'o', peer_previous: 'p' },
        proposed_artifact: text
      },
      stdout: '{"id":"peer"}'
    };
  };

  const invokeSynthesizer = async () => {
    if (hostDecided && resolveAfterHostDecision) {
      return {
        json: {
          schema_version: 'v1',
          synthesized_artifact: mergedResolved,
          synthesis_reasoning: 'host direction settled it',
          unresolved_disagreements: []
        },
        stdout: '{"id":"synth"}'
      };
    }
    return {
      json: {
        schema_version: 'v1',
        synthesized_artifact: mergedResolved,
        synthesis_reasoning: 'still merging',
        unresolved_disagreements: ['scope boundary unresolved']
      },
      stdout: '{"id":"synth"}'
    };
  };

  return {
    invokePeer,
    invokeSynthesizer,
    markHostDecided() {
      hostDecided = true;
    }
  };
}

function singleSectionInput() {
  return '# Intro\n\nSeed text.\n';
}

const synthPreflight = async () => ({
  peers: ['claude', 'codex'],
  providerInventory: [
    { id: 'claude', available: true },
    { id: 'codex', available: true }
  ],
  warnings: []
});

test('synthesized run escalates on persistent_disagreement (host) then converges via --host-direction', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-escalation-lifecycle-'));
  const inputPath = path.join(tempRoot, 'draft.md');
  const outputPath = path.join(tempRoot, 'draft.consensus.md');
  await writeFile(inputPath, singleSectionInput());

  const stubs = lifecycleStubs({ resolveAfterHostDecision: true });
  const stdout = captureStdout();

  // Pass 1: run until persistent_disagreement escalates to the host.
  const first = await runSequential(
    {
      inputPath,
      output: outputPath,
      runDir: path.join(tempRoot, '.consensus/run1'),
      allowRoot: tempRoot,
      cwd: tempRoot,
      goal: 'Tighten it.',
      peers: ['claude', 'codex'],
      iteration: 'parallel_synthesized',
      synthesizer: 'claude',
      maxRounds: 8,
      agency: 'moderate',
      preflight: synthPreflight,
      invokePeer: stubs.invokePeer,
      invokeSynthesizer: stubs.invokeSynthesizer
    },
    { stdout }
  );

  assert.equal(first.sections[0].status.status, 'escalation');
  const event = stdout.events().find((entry) => entry.event === 'escalation_required');
  assert.ok(event, 'escalation_required emitted');
  assert.equal(event.trigger, 'persistent_disagreement');
  assert.equal(event.decide_via, 'host');
  assert.equal(event.resume.flag, '--host-direction');

  // Pass 2: host answers via --host-direction; disagreements clear → converges.
  stubs.markHostDecided();
  const second = await runSequential({
    inputPath,
    resume: outputPath,
    output: path.join(tempRoot, 'draft.resumed.consensus.md'),
    runDir: path.join(tempRoot, '.consensus/run2'),
    allowRoot: tempRoot,
    cwd: tempRoot,
    goal: 'Tighten it.',
    peers: ['claude', 'codex'],
    iteration: 'parallel_synthesized',
    synthesizer: 'claude',
    maxRounds: 8,
    agency: 'moderate',
    preflight: false,
    hostDirection: 'Adopt the resolved merge.',
    hostDecisionKind: 'blend',
    invokePeer: stubs.invokePeer,
    invokeSynthesizer: stubs.invokeSynthesizer
  });

  const records = second.sections[0].records;
  const hostRound = records.find((record) => record.verdict === 'HOST_DECISION');
  assert.ok(hostRound, 'HOST_DECISION round recorded on resume');
  assert.equal(hostRound.agent, 'host-orchestrator');
  assert.equal(hostRound.escalation_trigger, 'persistent_disagreement');
  assert.equal(second.sections[0].status.status, 'converged');
});

test('promotion: re-fired trigger after a HOST_DECISION routes to the user', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-escalation-promote-'));
  const inputPath = path.join(tempRoot, 'draft.md');
  const outputPath = path.join(tempRoot, 'draft.consensus.md');
  await writeFile(inputPath, singleSectionInput());

  // The host decision does NOT settle the disagreement → trigger re-fires.
  const stubs = lifecycleStubs({ resolveAfterHostDecision: false });

  const first = await runSequential(
    {
      inputPath,
      output: outputPath,
      runDir: path.join(tempRoot, '.consensus/run1'),
      allowRoot: tempRoot,
      cwd: tempRoot,
      goal: 'Tighten it.',
      peers: ['claude', 'codex'],
      iteration: 'parallel_synthesized',
      synthesizer: 'claude',
      maxRounds: 8,
      agency: 'moderate',
      preflight: synthPreflight,
      invokePeer: stubs.invokePeer,
      invokeSynthesizer: stubs.invokeSynthesizer
    },
    { stdout: captureStdout() }
  );
  assert.equal(first.sections[0].status.status, 'escalation');
  assert.equal(first.sections[0].status.escalation.decide_via, 'host');

  // Host answers, but the trigger persists → promotion re-routes to the user.
  const promoteStdout = captureStdout();
  const second = await runSequential(
    {
      inputPath,
      resume: outputPath,
      output: path.join(tempRoot, 'draft.resumed.consensus.md'),
      runDir: path.join(tempRoot, '.consensus/run2'),
      allowRoot: tempRoot,
      cwd: tempRoot,
      goal: 'Tighten it.',
      peers: ['claude', 'codex'],
      iteration: 'parallel_synthesized',
      synthesizer: 'claude',
      maxRounds: 8,
      agency: 'moderate',
      preflight: false,
      hostDirection: 'Keep the stuck merge.',
      hostDecisionKind: 'blend',
      invokePeer: stubs.invokePeer,
      invokeSynthesizer: stubs.invokeSynthesizer
    },
    { stdout: promoteStdout }
  );

  const status = second.sections[0].status;
  assert.equal(status.status, 'escalation');
  assert.equal(status.escalation.decide_via, 'user');
  assert.equal(status.escalation.promoted_from, 'host');

  const event = promoteStdout.events().find((entry) => entry.event === 'escalation_required');
  assert.ok(event, 'user-routed escalation re-emitted after promotion');
  assert.equal(event.decide_via, 'user');
  assert.equal(event.promoted_from, 'host');
  assert.equal(event.resume.flag, '--user-direction');
});

// --- p05-t02: interruption-point resume matrix --------------------------
//
// Each interruption point feeds a crafted record stream into runConsensusLoop as
// `initialRecords` and asserts the loop resumes at the correct entry point per the
// design's two-level transaction contract (design Error Handling / §1).

async function loopPaths(tempRoot, suffix, input) {
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
      path.join(dir, 'status.json')
    ],
    input,
    dir
  };
}

function peerRecord(round, agent, text) {
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
    iteration_mode: 'parallel_synthesized'
  };
}

function synthesisRecord(round, text) {
  return {
    schema_version: 'v1',
    record_type: 'synthesis',
    round_index: round,
    synthesizer: 'claude',
    synthesized_artifact: text,
    synthesis_reasoning: 'merged',
    unresolved_disagreements: [],
    artifact_hash: hashArtifact(text),
    iteration_mode: 'parallel_synthesized'
  };
}

function countingStubs(convergeText) {
  const calls = { peer: 0, synthesis: 0 };
  const invokePeer = async () => {
    calls.peer += 1;
    return {
      json: {
        schema_version: 'v1',
        verdict: 'REVISE',
        reasoning: 'adopt the merge',
        critique: { own_previous: 'o', peer_previous: 'p' },
        proposed_artifact: convergeText
      },
      stdout: '{"id":"peer"}'
    };
  };
  const invokeSynthesizer = async () => {
    calls.synthesis += 1;
    return {
      json: {
        schema_version: 'v1',
        synthesized_artifact: convergeText,
        synthesis_reasoning: 'merged favoring stronger reasoning',
        unresolved_disagreements: []
      },
      stdout: '{"id":"synth"}'
    };
  };
  return { calls, invokePeer, invokeSynthesizer };
}

const seedInput = '# Intro\n\nSeed.\n';

test('resume mid-peer-subround (no committed pair) re-executes the round', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-resume-midpeer-'));
  const { argv, sectionFile } = await loopPaths(tempRoot, 'midpeer', seedInput);
  const merged = '# Intro\n\nStable merge.\n';
  const stubs = countingStubs(merged);

  // No committed pair for the in-flight round: initialRecords is empty.
  const result = await runConsensusLoop(argv, {
    initialRecords: [],
    initialArtifact: seedInput,
    invokePeer: stubs.invokePeer,
    invokeSynthesizer: stubs.invokeSynthesizer
  });

  // Round 1 must run a fresh peer subround (2 peer calls) then synthesis.
  assert.equal(stubs.calls.peer >= 2, true);
  assert.equal(stubs.calls.synthesis >= 1, true);
  // Round 1 peers ran (turn_index 1 and 2 present in the stream).
  const round1Peers = result.records.filter(
    (record) => record.round_index === 1 && record.record_type !== 'synthesis'
  );
  assert.equal(round1Peers.length, 2);
});

test('resume pending-synthesis (pair without synthesis) resumes at synthesis only', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-resume-pending-'));
  const { argv } = await loopPaths(tempRoot, 'pending', seedInput);
  const pairText = '# Intro\n\nRound 1 revision.\n';
  const stubs = countingStubs('# Intro\n\nRound 2 revision.\n');

  // Round 1 has a committed peer pair but NO synthesis record (pending-synthesis).
  const initialRecords = [
    peerRecord(1, 'claude', pairText),
    peerRecord(1, 'codex', pairText)
  ];

  const result = await runConsensusLoop(argv, {
    initialRecords,
    initialArtifact: pairText,
    invokePeer: stubs.invokePeer,
    invokeSynthesizer: stubs.invokeSynthesizer
  });

  // The pending synthesis for round 1 must run WITHOUT re-running round 1 peers.
  const synthesisForRound1 = result.records.filter(
    (record) => record.record_type === 'synthesis' && record.round_index === 1
  );
  assert.equal(synthesisForRound1.length, 1, 'round 1 synthesis produced on resume');

  const round1Peers = result.records.filter(
    (record) => record.round_index === 1 && record.record_type !== 'synthesis'
  );
  assert.equal(round1Peers.length, 2, 'round 1 peer pair not duplicated');
});

test('resume post-synthesis (complete round) continues at the next round', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-resume-postsynth-'));
  const { argv } = await loopPaths(tempRoot, 'postsynth', seedInput);
  const round1Text = '# Intro\n\nRound 1 synthesized.\n';
  const stubs = countingStubs('# Intro\n\nRound 2 revision.\n');

  // A complete round 1: peer pair + synthesis. Resume must start round 2.
  const initialRecords = [
    peerRecord(1, 'claude', round1Text),
    peerRecord(1, 'codex', round1Text),
    synthesisRecord(1, round1Text)
  ];

  const result = await runConsensusLoop(argv, {
    initialRecords,
    initialArtifact: round1Text,
    invokePeer: stubs.invokePeer,
    invokeSynthesizer: stubs.invokeSynthesizer
  });

  // No additional synthesis for round 1; round 2 peers run next.
  const round1Synthesis = result.records.filter(
    (record) => record.record_type === 'synthesis' && record.round_index === 1
  );
  assert.equal(round1Synthesis.length, 1, 'round 1 synthesis not re-run');

  const round2Peers = result.records.filter(
    (record) => record.round_index === 2 && record.record_type !== 'synthesis'
  );
  assert.equal(round2Peers.length, 2, 'round 2 peer subround executed on resume');
});

test('pending escalation resume is consumed by a supplied --host-direction', async () => {
  // Covered end-to-end by the escalation lifecycle test above (resume + --host-direction
  // converges). Here we assert the matrix entry-point: a pending escalation artifact
  // resumed with a host direction appends the HOST_DECISION and proceeds.
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-resume-escalation-'));
  const inputPath = path.join(tempRoot, 'draft.md');
  const outputPath = path.join(tempRoot, 'draft.consensus.md');
  await writeFile(inputPath, singleSectionInput());

  const stubs = lifecycleStubs({ resolveAfterHostDecision: true });
  await runSequential(
    {
      inputPath,
      output: outputPath,
      runDir: path.join(tempRoot, '.consensus/run1'),
      allowRoot: tempRoot,
      cwd: tempRoot,
      goal: 'Tighten it.',
      peers: ['claude', 'codex'],
      iteration: 'parallel_synthesized',
      synthesizer: 'claude',
      maxRounds: 8,
      agency: 'moderate',
      preflight: synthPreflight,
      invokePeer: stubs.invokePeer,
      invokeSynthesizer: stubs.invokeSynthesizer
    },
    { stdout: captureStdout() }
  );

  stubs.markHostDecided();
  const second = await runSequential({
    inputPath,
    resume: outputPath,
    output: path.join(tempRoot, 'draft.resumed.consensus.md'),
    runDir: path.join(tempRoot, '.consensus/run2'),
    allowRoot: tempRoot,
    cwd: tempRoot,
    goal: 'Tighten it.',
    peers: ['claude', 'codex'],
    iteration: 'parallel_synthesized',
    synthesizer: 'claude',
    maxRounds: 8,
    agency: 'moderate',
    preflight: false,
    hostDirection: 'Adopt the resolved merge.',
    hostDecisionKind: 'blend',
    invokePeer: stubs.invokePeer,
    invokeSynthesizer: stubs.invokeSynthesizer
  });

  const records = second.sections[0].records;
  assert.ok(records.some((record) => record.verdict === 'HOST_DECISION'));
  assert.equal(second.sections[0].status.status, 'converged');
});
