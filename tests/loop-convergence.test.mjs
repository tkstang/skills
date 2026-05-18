import assert from 'node:assert/strict';
import test from 'node:test';

import {
  detectConvergence,
  detectOscillation,
  hashArtifact,
  normalizeForHash
} from '../plugins/consensus/skills/consensus-refine/scripts/consensus-loop.mjs';

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
