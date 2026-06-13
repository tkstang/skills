import assert from 'node:assert/strict';
import test from 'node:test';

import {
  detectEscalation,
  routeEscalation,
  ESCALATION_TRIGGERS,
  hashArtifact
} from '../plugins/consensus/skills/refine/scripts/consensus-loop.mjs';

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

export { peerRecord, synthesisRecord, interventionRecord, synthesizedRound };
