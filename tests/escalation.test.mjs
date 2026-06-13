import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  detectEscalation,
  routeEscalation,
  runConsensusLoop,
  ESCALATION_TRIGGERS,
  hashArtifact
} from '../plugins/consensus/skills/refine/scripts/consensus-loop.mjs';

async function makeRunFiles(sectionText = 'Initial section.\n') {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-escalation-'));
  const sectionPath = path.join(tempRoot, 'section.md');
  await writeFile(sectionPath, sectionText);
  return {
    tempRoot,
    sectionPath,
    recordsPath: path.join(tempRoot, 'records.json'),
    outputPath: path.join(tempRoot, 'output.md'),
    statusPath: path.join(tempRoot, 'status.json')
  };
}

function loopArgv(files, extra = []) {
  return [
    '--section-file',
    files.sectionPath,
    '--goal',
    'Tighten it.',
    '--peers',
    'claude,codex',
    '--max-rounds',
    '4',
    '--agency',
    'moderate',
    '--output-records',
    files.recordsPath,
    '--output-section',
    files.outputPath,
    '--output-status',
    files.statusPath,
    ...extra
  ];
}

// ---------------------------------------------------------------------------
// Record builders (mirroring the v1 record stream shape the engine produces).
// ---------------------------------------------------------------------------

function peerRecord({ agent, round, verdict = 'REVISE', text, critique }) {
  return {
    schema_version: 'v1',
    turn_index: round * 2,
    round_index: round,
    agent,
    verdict,
    reasoning: 'reasoning',
    critique: critique ?? { own_previous: 'own', peer_previous: 'peer' },
    proposed_artifact: text,
    artifact_hash: hashArtifact(text),
    iteration_mode: 'parallel_synthesized'
  };
}

function synthesisRecord({ round, text, disagreements }) {
  return {
    schema_version: 'v1',
    record_type: 'synthesis',
    round_index: round,
    synthesizer: 'claude',
    synthesized_artifact: text,
    synthesis_reasoning: 'merged',
    unresolved_disagreements: disagreements,
    artifact_hash: hashArtifact(text),
    iteration_mode: 'parallel_synthesized'
  };
}

function interventionRecord({ round, agent, verdict, decisionKind, trigger }) {
  return {
    schema_version: 'v1',
    turn_index: round * 2,
    round_index: round,
    agent,
    verdict,
    decision_kind: decisionKind,
    escalation_trigger: trigger,
    reasoning: 'decision text',
    iteration_mode: 'parallel_synthesized'
  };
}

// A synthesized round = pair + synthesis with the same disagreement set.
function synthesizedRound(round, disagreements, { text = `round ${round}\n` } = {}) {
  return [
    peerRecord({ agent: 'claude', round, text }),
    peerRecord({ agent: 'codex', round, text }),
    synthesisRecord({ round, text, disagreements })
  ];
}

// ---------------------------------------------------------------------------
// p04-t01: trigger predicates
// ---------------------------------------------------------------------------

test('ESCALATION_TRIGGERS exports the named trigger constants', () => {
  assert.equal(ESCALATION_TRIGGERS.persistent_disagreement, 'persistent_disagreement');
  assert.equal(ESCALATION_TRIGGERS.near_done_drift, 'near_done_drift');
  assert.equal(ESCALATION_TRIGGERS.budget_exhausted, 'budget_exhausted');
  assert.equal(ESCALATION_TRIGGERS.oscillation, 'oscillation');
});

test('persistent_disagreement fires when the same non-empty set repeats across 3 synthesis records', () => {
  const records = [
    ...synthesizedRound(1, ['  spacing rule  ', 'tone']),
    ...synthesizedRound(2, ['tone', 'spacing rule']),
    ...synthesizedRound(3, ['spacing rule', 'tone'])
  ];
  const result = detectEscalation(records, { mode: 'parallel_synthesized', agency: 'moderate' });
  assert.ok(result);
  assert.equal(result.trigger, ESCALATION_TRIGGERS.persistent_disagreement);
});

test('persistent_disagreement does not fire when the set changes across rounds', () => {
  const records = [
    ...synthesizedRound(1, ['spacing rule', 'tone']),
    ...synthesizedRound(2, ['tone']),
    ...synthesizedRound(3, ['spacing rule', 'tone'])
  ];
  const result = detectEscalation(records, { mode: 'parallel_synthesized', agency: 'moderate' });
  assert.equal(result, null);
});

test('persistent_disagreement does not fire on an empty disagreement set', () => {
  const records = [
    ...synthesizedRound(1, []),
    ...synthesizedRound(2, []),
    ...synthesizedRound(3, [])
  ];
  const result = detectEscalation(records, { mode: 'parallel_synthesized', agency: 'moderate' });
  assert.equal(result, null);
});

test('persistent_disagreement requires 3 consecutive synthesis records', () => {
  const records = [
    ...synthesizedRound(1, ['spacing rule']),
    ...synthesizedRound(2, ['spacing rule'])
  ];
  const result = detectEscalation(records, { mode: 'parallel_synthesized', agency: 'moderate' });
  assert.equal(result, null);
});

test('near_done_drift fires on mutual CONVERGED with differing hashes (parallel)', () => {
  const records = [
    peerRecord({ agent: 'claude', round: 1, verdict: 'CONVERGED', text: 'alpha\n' }),
    peerRecord({ agent: 'codex', round: 1, verdict: 'CONVERGED', text: 'beta\n' })
  ];
  const result = detectEscalation(records, { mode: 'parallel_revision', agency: 'moderate' });
  assert.ok(result);
  assert.equal(result.trigger, ESCALATION_TRIGGERS.near_done_drift);
});

test('near_done_drift fires on double-ACCEPT with differing hashes (alternating)', () => {
  const records = [
    {
      schema_version: 'v1',
      turn_index: 1,
      round_index: 1,
      agent: 'claude',
      verdict: 'ACCEPT',
      reasoning: 'ok',
      artifact_hash: hashArtifact('alpha\n'),
      iteration_mode: 'alternating'
    },
    {
      schema_version: 'v1',
      turn_index: 2,
      round_index: 1,
      agent: 'codex',
      verdict: 'ACCEPT',
      reasoning: 'ok',
      artifact_hash: hashArtifact('beta\n'),
      iteration_mode: 'alternating'
    }
  ];
  const result = detectEscalation(records, { mode: 'alternating', agency: 'moderate' });
  assert.ok(result);
  assert.equal(result.trigger, ESCALATION_TRIGGERS.near_done_drift);
});

test('near_done_drift does not fire when the two converged hashes match', () => {
  const records = [
    peerRecord({ agent: 'claude', round: 1, verdict: 'CONVERGED', text: 'same\n' }),
    peerRecord({ agent: 'codex', round: 1, verdict: 'CONVERGED', text: 'same\n' })
  ];
  const result = detectEscalation(records, { mode: 'parallel_revision', agency: 'moderate' });
  assert.equal(result, null);
});

test('budget_exhausted fires when max rounds reached without convergence', () => {
  const records = [
    ...synthesizedRound(1, ['a'], { text: 'r1\n' }),
    ...synthesizedRound(2, ['b'], { text: 'r2\n' })
  ];
  const result = detectEscalation(records, {
    mode: 'parallel_synthesized',
    agency: 'moderate',
    budgetExhausted: true
  });
  assert.ok(result);
  assert.equal(result.trigger, ESCALATION_TRIGGERS.budget_exhausted);
});

test('oscillation feeds the same trigger shape (parallel pair cycling)', () => {
  const records = [
    peerRecord({ agent: 'claude', round: 1, text: 'A\n' }),
    peerRecord({ agent: 'codex', round: 1, text: 'A\n' }),
    peerRecord({ agent: 'claude', round: 2, text: 'B\n' }),
    peerRecord({ agent: 'codex', round: 2, text: 'B\n' }),
    peerRecord({ agent: 'claude', round: 3, text: 'A\n' }),
    peerRecord({ agent: 'codex', round: 3, text: 'A\n' }),
    peerRecord({ agent: 'claude', round: 4, text: 'B\n' }),
    peerRecord({ agent: 'codex', round: 4, text: 'B\n' })
  ];
  const result = detectEscalation(records, { mode: 'parallel_revision', agency: 'moderate' });
  assert.ok(result);
  assert.equal(result.trigger, ESCALATION_TRIGGERS.oscillation);
});

test('detectEscalation returns null when no trigger fires', () => {
  const records = synthesizedRound(1, ['a']);
  const result = detectEscalation(records, { mode: 'parallel_synthesized', agency: 'moderate' });
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// p04-t02: routing table + genuinely-stuck promotion
// ---------------------------------------------------------------------------

// Design §5 routing table (trigger × agency → decide_via).
const ROUTING_TABLE = {
  persistent_disagreement: { minimal: 'user', moderate: 'host', maximum: 'host' },
  oscillation: { minimal: 'user', moderate: 'user', maximum: 'host' },
  budget_exhausted: { minimal: 'user', moderate: 'user', maximum: 'auto' },
  near_done_drift: { minimal: 'user', moderate: 'host', maximum: 'auto' }
};

for (const [trigger, byAgency] of Object.entries(ROUTING_TABLE)) {
  for (const [agency, expected] of Object.entries(byAgency)) {
    test(`routeEscalation: ${trigger} @ ${agency} → ${expected}`, () => {
      const route = routeEscalation(trigger, agency, []);
      assert.equal(route.decide_via, expected);
    });
  }
}

test('host-routed escalation lists defer_to_user as an allowed decision kind', () => {
  const route = routeEscalation(ESCALATION_TRIGGERS.persistent_disagreement, 'moderate', []);
  assert.equal(route.decide_via, 'host');
  assert.ok(route.decision_kinds.includes('defer_to_user'));
});

test('user-routed escalation does not list defer_to_user', () => {
  const route = routeEscalation(ESCALATION_TRIGGERS.oscillation, 'minimal', []);
  assert.equal(route.decide_via, 'user');
  assert.ok(!route.decision_kinds.includes('defer_to_user'));
});

test('maximum budget_exhausted auto-resolves to declare-done (recorded as auto-resolved)', () => {
  const route = routeEscalation(ESCALATION_TRIGGERS.budget_exhausted, 'maximum', []);
  assert.equal(route.decide_via, 'auto');
  assert.equal(route.auto_resolution, 'declare_done');
});

test('maximum near_done_drift auto-resolves via the existing near-match rule', () => {
  const route = routeEscalation(ESCALATION_TRIGGERS.near_done_drift, 'maximum', []);
  assert.equal(route.decide_via, 'auto');
});

test('promotion: trigger re-fires after a HOST_DECISION → decide_via user, promoted_from host', () => {
  const records = [
    ...synthesizedRound(1, ['x']),
    ...synthesizedRound(2, ['x']),
    ...synthesizedRound(3, ['x']),
    interventionRecord({
      round: 4,
      agent: 'host-orchestrator',
      verdict: 'HOST_DECISION',
      decisionKind: 'blend',
      trigger: ESCALATION_TRIGGERS.persistent_disagreement
    }),
    ...synthesizedRound(5, ['x']),
    ...synthesizedRound(6, ['x']),
    ...synthesizedRound(7, ['x'])
  ];
  const route = routeEscalation(ESCALATION_TRIGGERS.persistent_disagreement, 'moderate', records);
  assert.equal(route.decide_via, 'user');
  assert.equal(route.promoted_from, 'host');
});

test('promotion: explicit defer_to_user decline re-routes to user', () => {
  const records = [
    ...synthesizedRound(1, ['x']),
    ...synthesizedRound(2, ['x']),
    ...synthesizedRound(3, ['x']),
    interventionRecord({
      round: 4,
      agent: 'host-orchestrator',
      verdict: 'HOST_DECISION',
      decisionKind: 'defer_to_user',
      trigger: ESCALATION_TRIGGERS.persistent_disagreement
    })
  ];
  const route = routeEscalation(ESCALATION_TRIGGERS.persistent_disagreement, 'moderate', records);
  assert.equal(route.decide_via, 'user');
  assert.equal(route.promoted_from, 'host');
});

test('a HOST_DECISION for a DIFFERENT trigger does not promote', () => {
  const records = [
    interventionRecord({
      round: 4,
      agent: 'host-orchestrator',
      verdict: 'HOST_DECISION',
      decisionKind: 'blend',
      trigger: ESCALATION_TRIGGERS.oscillation
    })
  ];
  const route = routeEscalation(ESCALATION_TRIGGERS.persistent_disagreement, 'moderate', records);
  assert.equal(route.decide_via, 'host');
  assert.ok(!route.promoted_from);
});

test('maximum budget_exhausted is exempt from promotion even after a HOST_DECISION', () => {
  const records = [
    interventionRecord({
      round: 4,
      agent: 'host-orchestrator',
      verdict: 'HOST_DECISION',
      decisionKind: 'extend_budget',
      trigger: ESCALATION_TRIGGERS.budget_exhausted
    })
  ];
  const route = routeEscalation(ESCALATION_TRIGGERS.budget_exhausted, 'maximum', records);
  assert.equal(route.decide_via, 'auto');
  assert.ok(!route.promoted_from);
});

// ---------------------------------------------------------------------------
// p04-t03: escalation terminal status + decision packet (loop-level)
// ---------------------------------------------------------------------------

// A synthesized stub whose peers keep diverging and whose synthesis always
// reports the same unresolved-disagreement set → persistent_disagreement.
function persistentSynthesizedStubs(disagreements = ['heading style']) {
  let peerCall = 0;
  const invokePeer = async () => {
    peerCall += 1;
    return {
      json: {
        schema_version: 'v1',
        verdict: 'REVISE',
        reasoning: `r${peerCall}`,
        critique: { own_previous: 'o', peer_previous: 'p' },
        proposed_artifact: `peer-${peerCall}.\n`
      },
      stdout: '{"id":"peer"}'
    };
  };
  let synthCall = 0;
  const invokeSynthesizer = async () => {
    synthCall += 1;
    return {
      json: {
        schema_version: 'v1',
        synthesized_artifact: `merge-${synthCall}.\n`,
        synthesis_reasoning: 'merged',
        unresolved_disagreements: disagreements
      },
      stdout: '{"id":"synth"}'
    };
  };
  return { invokePeer, invokeSynthesizer };
}

test('synthesized persistent_disagreement at moderate terminates with status escalation routed to host', async () => {
  const files = await makeRunFiles('Seed.\n');
  const { invokePeer, invokeSynthesizer } = persistentSynthesizedStubs();
  const result = await runConsensusLoop(
    loopArgv(files, ['--iteration', 'parallel_synthesized', '--synthesizer', 'claude', '--max-rounds', '8']),
    { invokePeer, invokeSynthesizer }
  );

  assert.equal(result.status.status, 'escalation');
  assert.equal(result.status.escalation.trigger, ESCALATION_TRIGGERS.persistent_disagreement);
  assert.equal(result.status.escalation.decide_via, 'host');
  assert.ok(result.status.escalation.decision_kinds.includes('defer_to_user'));
  assert.ok(result.status.escalation.divergent);
  assert.ok(result.status.escalation.divergent.synthesis);
});

test('user-routed escalation packet omits defer_to_user', async () => {
  const files = await makeRunFiles('Seed.\n');
  const { invokePeer, invokeSynthesizer } = persistentSynthesizedStubs();
  const result = await runConsensusLoop(
    loopArgv(files, [
      '--iteration',
      'parallel_synthesized',
      '--synthesizer',
      'claude',
      '--agency',
      'minimal',
      '--max-rounds',
      '8'
    ]),
    { invokePeer, invokeSynthesizer }
  );

  assert.equal(result.status.status, 'escalation');
  assert.equal(result.status.escalation.decide_via, 'user');
  assert.ok(!result.status.escalation.decision_kinds.includes('defer_to_user'));
});

// Minimal-agency oscillation must preserve the v0.1 'oscillation' status.
test('minimal-agency parallel oscillation preserves the v0.1 oscillation status', async () => {
  const files = await makeRunFiles('Seed.\n');
  // Within a round the two peers differ; the order-normalized PAIR cycles
  // {A,B} / {C,D} / {A,B} / {C,D} → pair oscillation. Strict (minimal) hashing.
  const invokePeer = async ({ round, peerIndex }) => {
    const odd = round % 2 === 1;
    const text = odd ? (peerIndex === 0 ? 'A\n' : 'B\n') : peerIndex === 0 ? 'C\n' : 'D\n';
    return {
      json: {
        schema_version: 'v1',
        verdict: 'REVISE',
        reasoning: `r${round}`,
        critique: { own_previous: 'o', peer_previous: 'p' },
        proposed_artifact: text
      },
      stdout: '{"id":"peer"}'
    };
  };
  const result = await runConsensusLoop(
    loopArgv(files, ['--iteration', 'parallel_revision', '--agency', 'minimal', '--max-rounds', '6']),
    { invokePeer }
  );

  assert.equal(result.status.status, 'oscillation');
});

// Minimal-agency budget exhaustion must preserve the v0.1 'max-rounds' status.
test('minimal-agency budget exhaustion preserves the v0.1 max-rounds status', async () => {
  const files = await makeRunFiles('Seed.\n');
  let call = 0;
  const invokePeer = async () => {
    call += 1;
    return {
      json: {
        schema_version: 'v1',
        verdict: 'REVISE',
        reasoning: `r${call}`,
        critique: { own_previous: 'o', peer_previous: 'p' },
        proposed_artifact: `unique-${call}.\n`
      },
      stdout: '{"id":"peer"}'
    };
  };
  const result = await runConsensusLoop(
    loopArgv(files, ['--iteration', 'parallel_revision', '--agency', 'minimal', '--max-rounds', '3']),
    { invokePeer }
  );

  assert.equal(result.status.status, 'max-rounds');
});

// Maximum-agency budget exhaustion keeps auto declare-done (converged).
test('maximum-agency budget exhaustion auto-declares done (converged), not escalation', async () => {
  const files = await makeRunFiles('Seed.\n');
  let call = 0;
  const invokePeer = async () => {
    call += 1;
    return {
      json: {
        schema_version: 'v1',
        verdict: 'REVISE',
        reasoning: `r${call}`,
        critique: { own_previous: 'o', peer_previous: 'p' },
        proposed_artifact: `unique-${call}.\n`
      },
      stdout: '{"id":"peer"}'
    };
  };
  const result = await runConsensusLoop(
    loopArgv(files, ['--iteration', 'parallel_revision', '--agency', 'maximum', '--max-rounds', '3']),
    { invokePeer }
  );

  assert.equal(result.status.status, 'converged');
  assert.equal(result.status.termination_reason, 'max_rounds_exhausted');
});

export { peerRecord, synthesisRecord, interventionRecord, synthesizedRound };
