import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  detectConvergence,
  detectOscillation,
  detectParallelConvergence,
  detectParallelOscillation,
  hashArtifact,
  normalizeForHash,
  runConsensusLoop
} from '../plugins/consensus/skills/refine/scripts/consensus-loop.mjs';

function parallelRecord(agent, { verdict, text, round = 1 }) {
  return {
    agent,
    round_index: round,
    iteration_mode: 'parallel_revision',
    verdict,
    proposed_artifact: text,
    artifact_hash: hashArtifact(text),
    critique: { own_previous: 'o', peer_previous: 'p' }
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
    statusPath: path.join(tempRoot, 'status.json')
  };
}

function alternatingArgv(files, extra = []) {
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
    ...extra
  ];
}

function stripVolatile(records) {
  return records.map(({ timestamp, ...rest }) => rest);
}

test('normalizeForHash canonicalizes line endings, trailing whitespace, and EOF newlines', () => {
  assert.equal(normalizeForHash('Hello  \r\nworld\t\r\n\r\n'), 'Hello\nworld\n');
  assert.equal(normalizeForHash('Hello\nworld\n'), normalizeForHash('Hello\r\nworld\n\n'));
  assert.equal(normalizeForHash(''), '');
});

test('normalizeForHash can be made strict through options', () => {
  assert.notEqual(normalizeForHash('Hello  \n', { trimTrailingWhitespace: false }), 'Hello\n');
  assert.equal(normalizeForHash('Hello  \n', { trimTrailingWhitespace: false }), 'Hello  \n');
});

test('hashArtifact returns a prefixed SHA-256 digest over normalized text', () => {
  const first = hashArtifact('alpha\r\nbeta  \n\n');
  const second = hashArtifact('alpha\nbeta\n');

  assert.match(first, /^sha256:[a-f0-9]{64}$/);
  assert.equal(first, second);
});

test('detectConvergence reports adjacent matching hashes', () => {
  const hash = hashArtifact('same');
  const result = detectConvergence([
    { turn_index: 1, agent: 'claude', artifact_hash: hash, verdict: 'REVISE' },
    { turn_index: 2, agent: 'codex', artifact_hash: hash, verdict: 'REVISE' }
  ]);

  assert.deepEqual(result, {
    converged: true,
    reason: 'hash_match',
    record_indexes: [0, 1],
    artifact_hash: hash
  });
});

test('detectConvergence reports double ACCEPT on the same hash', () => {
  const hash = hashArtifact('accepted');
  const result = detectConvergence([
    { turn_index: 1, artifact_hash: hash, verdict: 'ACCEPT' },
    { turn_index: 2, artifact_hash: hash, verdict: 'ACCEPT' }
  ]);

  assert.equal(result.converged, true);
  assert.equal(result.reason, 'double_accept');
  assert.deepEqual(result.record_indexes, [0, 1]);
});

test('detectConvergence returns a stable non-converged shape', () => {
  assert.deepEqual(
    detectConvergence([
      { artifact_hash: hashArtifact('one'), verdict: 'REVISE' },
      { artifact_hash: hashArtifact('two'), verdict: 'REVISE' }
    ]),
    { converged: false, reason: null }
  );
});

test('detectConvergence uses strict bytewise hashing for minimal agency', () => {
  const records = [
    { artifact: 'same text  \n', verdict: 'REVISE' },
    { artifact: 'same text\n', verdict: 'REVISE' }
  ];

  assert.equal(detectConvergence(records, { agency: 'moderate' }).converged, true);
  assert.deepEqual(detectConvergence(records, { agency: 'minimal' }), { converged: false, reason: null });
});

test('detectConvergence allows maximum agency double ACCEPT near matches', () => {
  const result = detectConvergence(
    [
      { artifact_hash: hashArtifact('accepted one'), verdict: 'ACCEPT' },
      { artifact_hash: hashArtifact('accepted two'), verdict: 'ACCEPT' }
    ],
    { agency: 'maximum' }
  );

  assert.equal(result.converged, true);
  assert.equal(result.reason, 'double_accept');
  assert.equal(result.agency_decision, 'maximum_double_accept_near_match');
  assert.deepEqual(result.record_indexes, [0, 1]);
});

test('detectOscillation detects four-turn two-state alternation', () => {
  const a = hashArtifact('A');
  const b = hashArtifact('B');
  const result = detectOscillation([
    { artifact_hash: a },
    { artifact_hash: b },
    { artifact_hash: a },
    { artifact_hash: b }
  ]);

  assert.deepEqual(result, {
    oscillating: true,
    reason: 'oscillation_detected',
    record_indexes: [0, 1, 2, 3],
    hashes: [a, b]
  });
});

test('detectOscillation ignores non-alternating records', () => {
  const a = hashArtifact('A');
  const b = hashArtifact('B');
  const c = hashArtifact('C');

  assert.deepEqual(
    detectOscillation([{ artifact_hash: a }, { artifact_hash: b }, { artifact_hash: c }, { artifact_hash: b }]),
    { oscillating: false, reason: null }
  );
});

test('alternating round execution produces a stable records stream (characterization)', async () => {
  const revisions = ['Round one revision.\n', 'Round two revision.\n', 'Round two revision.\n'];
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
            proposed_artifact: proposed
          },
          stdout: '{"id":"raw"}'
        };
      }
    });
    return result;
  }

  const result = await runOnce();
  assert.equal(result.status.status, 'converged');
  assert.equal(result.status.termination_reason, 'hash_match');

  // Stream is a deterministic function of stubbed responses (timestamps aside).
  assert.deepEqual(stripVolatile(result.records), [
    {
      schema_version: 'v1',
      turn_index: 1,
      round_index: 1,
      agent: 'claude',
      verdict: 'REVISE',
      reasoning: 'revision 1',
      artifact_hash: hashArtifact('Round one revision.\n'),
      iteration_mode: 'alternating',
      raw_paseo_response: '{"id":"raw"}',
      proposed_artifact: 'Round one revision.\n'
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
      raw_paseo_response: '{"id":"raw"}',
      proposed_artifact: 'Round two revision.\n'
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
      raw_paseo_response: '{"id":"raw"}',
      proposed_artifact: 'Round two revision.\n'
    }
  ]);

  // Repeat run reproduces the identical stream (NFR1 / FR9 regression lock).
  const second = await runOnce();
  assert.deepEqual(stripVolatile(second.records), stripVolatile(result.records));
});

test('detectParallelConvergence converges on same-round normalized hash match', () => {
  const records = [
    parallelRecord('claude', { verdict: 'REVISE', text: 'Final text  \n' }),
    parallelRecord('codex', { verdict: 'REVISE', text: 'Final text\n' })
  ];

  const result = detectParallelConvergence(records, { agency: 'moderate' });
  assert.equal(result.converged, true);
  assert.equal(result.reason, 'parallel_hash_match');
  assert.deepEqual(result.record_indexes, [0, 1]);
});

test('detectParallelConvergence uses strict hashing at minimal agency', () => {
  const records = [
    parallelRecord('claude', { verdict: 'REVISE', text: 'Final text  \n' }),
    parallelRecord('codex', { verdict: 'REVISE', text: 'Final text\n' })
  ];

  assert.equal(detectParallelConvergence(records, { agency: 'moderate' }).converged, true);
  assert.deepEqual(detectParallelConvergence(records, { agency: 'minimal' }), {
    converged: false,
    reason: null
  });
});

test('detectParallelConvergence converges on mutual ACCEPT_PEER adopting identical prior text', () => {
  const shared = 'Agreed text.\n';
  const records = [
    parallelRecord('claude', { verdict: 'ACCEPT_PEER', text: shared }),
    parallelRecord('codex', { verdict: 'ACCEPT_PEER', text: shared })
  ];

  const result = detectParallelConvergence(records, { agency: 'moderate' });
  assert.equal(result.converged, true);
  assert.equal(result.reason, 'mutual_accept_peer');
});

test('detectParallelConvergence does NOT converge on mutual ACCEPT_PEER adopting differing texts (swap)', () => {
  const records = [
    parallelRecord('claude', { verdict: 'ACCEPT_PEER', text: 'Codex version.\n' }),
    parallelRecord('codex', { verdict: 'ACCEPT_PEER', text: 'Claude version.\n' })
  ];

  assert.deepEqual(detectParallelConvergence(records, { agency: 'moderate' }), {
    converged: false,
    reason: null
  });
});

test('detectParallelConvergence converges on mutual CONVERGED at moderate and maximum but not minimal', () => {
  const records = [
    parallelRecord('claude', { verdict: 'CONVERGED', text: 'A version.\n' }),
    parallelRecord('codex', { verdict: 'CONVERGED', text: 'B version.\n' })
  ];

  const moderate = detectParallelConvergence(records, { agency: 'moderate' });
  assert.equal(moderate.converged, true);
  assert.equal(moderate.reason, 'mutual_converged');

  assert.equal(detectParallelConvergence(records, { agency: 'maximum' }).converged, true);
  assert.deepEqual(detectParallelConvergence(records, { agency: 'minimal' }), {
    converged: false,
    reason: null
  });
});

test('detectParallelOscillation is still a no-op placeholder before p02-t06', () => {
  assert.deepEqual(detectParallelOscillation([], {}), { oscillating: false, reason: null });
});
