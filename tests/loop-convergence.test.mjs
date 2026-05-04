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

test('hashArtifact returns a SHA-256 hex digest over normalized text', () => {
  const first = hashArtifact('alpha\r\nbeta  \n\n');
  const second = hashArtifact('alpha\nbeta\n');

  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, second);
});

test('detectConvergence reports adjacent matching hashes', () => {
  const hash = hashArtifact('same');
  const result = detectConvergence([
    { turn: 1, agent: 'claude', artifact_hash: hash, verdict: { decision: 'REVISE' } },
    { turn: 2, agent: 'codex', artifact_hash: hash, verdict: { decision: 'REVISE' } }
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
    { turn: 1, artifact_hash: hash, verdict: { decision: 'ACCEPT' } },
    { turn: 2, artifact_hash: hash, verdict: { decision: 'ACCEPT' } }
  ]);

  assert.equal(result.converged, true);
  assert.equal(result.reason, 'double_accept_same_hash');
  assert.deepEqual(result.record_indexes, [0, 1]);
});

test('detectConvergence returns a stable non-converged shape', () => {
  assert.deepEqual(
    detectConvergence([
      { artifact_hash: hashArtifact('one'), verdict: { decision: 'REVISE' } },
      { artifact_hash: hashArtifact('two'), verdict: { decision: 'REVISE' } }
    ]),
    { converged: false, reason: null }
  );
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
    reason: 'two_state_oscillation',
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
