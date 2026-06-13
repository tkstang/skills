import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  LOOP_SCHEMA_VERSION,
  VERDICT_CAPS,
  validateSynthesisShape,
  validateVerdictCaps,
  validateVerdictShape
} from '../plugins/consensus/skills/refine/scripts/consensus-loop.mjs';

const schemaPath = new URL(
  '../plugins/consensus/skills/refine/schemas/verdict-alternating.schema.json',
  import.meta.url
);

const parallelSchemaPath = new URL(
  '../plugins/consensus/skills/refine/schemas/verdict-parallel.schema.json',
  import.meta.url
);

const synthesisSchemaPath = new URL(
  '../plugins/consensus/skills/refine/schemas/synthesis.schema.json',
  import.meta.url
);

function validSynthesis(overrides = {}) {
  return {
    schema_version: 'v1',
    synthesized_artifact: 'Merged section.\n',
    synthesis_reasoning: 'Took the stronger framing from peer A and the example from peer B.',
    unresolved_disagreements: [],
    ...overrides
  };
}

function validVerdict(overrides = {}) {
  return {
    schema_version: 'v1',
    verdict: 'ACCEPT',
    reasoning: 'Looks good.',
    ...overrides
  };
}

function parallelCritique(overrides = {}) {
  return { own_previous: 'My prior draft was thin.', peer_previous: 'Peer prior draft over-claimed.', ...overrides };
}

function parallelVerdict(overrides = {}) {
  return {
    schema_version: 'v1',
    verdict: 'REVISE',
    reasoning: 'Tightened the argument.',
    critique: parallelCritique(),
    proposed_artifact: 'Revised section.\n',
    ...overrides
  };
}

test('loop and alternating schema both speak schema v1', async () => {
  assert.equal(LOOP_SCHEMA_VERSION, 'v1');

  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  assert.equal(schema.properties.schema_version.const, 'v1');
});

test('verdict schema declares alternating branches without maxLength caps', async () => {
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  const serialized = JSON.stringify(schema);

  assert.equal(schema.$id, 'consensus-plugin/v1/verdict-alternating.schema.json');
  assert.deepEqual(schema.required, ['schema_version', 'verdict', 'reasoning']);
  assert.equal(schema.oneOf.length, 3);
  assert.equal(serialized.includes('maxLength'), false);

  assert.deepEqual(schema.properties.verdict.enum, ['ACCEPT', 'REVISE', 'IMPASSE']);
});

test('validateVerdictShape accepts ACCEPT, REVISE, and IMPASSE verdicts', () => {
  assert.deepEqual(validateVerdictShape(validVerdict()), { ok: true, errors: [] });
  assert.deepEqual(
    validateVerdictShape(validVerdict({ verdict: 'REVISE', proposed_artifact: 'Updated section.' })),
    { ok: true, errors: [] }
  );
  assert.deepEqual(
    validateVerdictShape(validVerdict({ verdict: 'IMPASSE', concerns: ['conflict remains'] })),
    { ok: true, errors: [] }
  );
  assert.deepEqual(validateVerdictShape(validVerdict({ verdict: 'IMPASSE' })), { ok: true, errors: [] });
});

test('validateVerdictShape enforces schema version, branch requirements, and additional properties', () => {
  assert.match(validateVerdictShape(validVerdict({ schema_version: 'v0' })).errors.join('\n'), /schema_version/);
  assert.match(validateVerdictShape(validVerdict({ verdict: 'REVISE' })).errors.join('\n'), /proposed_artifact/);
  assert.match(validateVerdictShape({ schema_version: 'v1', decision: 'ACCEPT', reasoning: 'old' }).errors.join('\n'), /verdict/);
  assert.match(validateVerdictShape(validVerdict({ extra: true })).errors.join('\n'), /additional property: extra/);
});

test('parallel verdict schema declares the parallel vocabulary and critique fields', async () => {
  const schema = JSON.parse(await readFile(parallelSchemaPath, 'utf8'));

  assert.equal(schema.$id, 'consensus-plugin/v1/verdict-parallel.schema.json');
  assert.equal(schema.properties.schema_version.const, 'v1');
  assert.deepEqual(schema.properties.verdict.enum, ['REVISE', 'ACCEPT_PEER', 'CONVERGED', 'IMPASSE']);
  assert.ok(schema.properties.critique);
  assert.deepEqual(schema.properties.critique.required, ['own_previous', 'peer_previous']);
  assert.equal(JSON.stringify(schema).includes('maxLength'), false);
});

test('validateVerdictShape accepts the parallel vocabulary in parallel mode', () => {
  assert.deepEqual(validateVerdictShape(parallelVerdict(), { mode: 'parallel_revision' }), { ok: true, errors: [] });
  assert.deepEqual(
    validateVerdictShape(
      parallelVerdict({ verdict: 'ACCEPT_PEER', proposed_artifact: 'Adopted peer text.\n' }),
      { mode: 'parallel_synthesized' }
    ),
    { ok: true, errors: [] }
  );
  assert.deepEqual(
    validateVerdictShape(
      { schema_version: 'v1', verdict: 'CONVERGED', reasoning: 'We agree.', critique: parallelCritique() },
      { mode: 'parallel_revision' }
    ),
    { ok: true, errors: [] }
  );
  assert.deepEqual(
    validateVerdictShape(
      { schema_version: 'v1', verdict: 'IMPASSE', reasoning: 'Cannot agree.', critique: parallelCritique() },
      { mode: 'parallel_revision' }
    ),
    { ok: true, errors: [] }
  );
});

test('validateVerdictShape enforces critique and artifact requirements per parallel branch', () => {
  assert.match(
    validateVerdictShape(parallelVerdict({ critique: undefined }), { mode: 'parallel_revision' }).errors.join('\n'),
    /critique/
  );
  assert.match(
    validateVerdictShape(parallelVerdict({ critique: { own_previous: 'only own' } }), { mode: 'parallel_revision' })
      .errors.join('\n'),
    /peer_previous/
  );
  assert.match(
    validateVerdictShape(parallelVerdict({ proposed_artifact: undefined }), { mode: 'parallel_revision' })
      .errors.join('\n'),
    /proposed_artifact/
  );
  assert.match(
    validateVerdictShape(
      { schema_version: 'v1', verdict: 'ACCEPT_PEER', reasoning: 'Adopt.', critique: parallelCritique() },
      { mode: 'parallel_revision' }
    ).errors.join('\n'),
    /proposed_artifact/
  );
  assert.match(
    validateVerdictShape(
      { schema_version: 'v1', verdict: 'CONVERGED', reasoning: 'Agree.' },
      { mode: 'parallel_revision' }
    ).errors.join('\n'),
    /critique/
  );
});

test('validateVerdictShape rejects cross-mode vocabularies', () => {
  // Alternating vocabulary is invalid in parallel mode.
  assert.match(
    validateVerdictShape(validVerdict({ verdict: 'ACCEPT' }), { mode: 'parallel_revision' }).errors.join('\n'),
    /verdict/
  );
  // Parallel vocabulary is invalid in alternating mode (default and explicit).
  assert.match(
    validateVerdictShape(parallelVerdict({ verdict: 'ACCEPT_PEER' })).errors.join('\n'),
    /verdict/
  );
  assert.match(
    validateVerdictShape(parallelVerdict({ verdict: 'CONVERGED' }), { mode: 'alternating' }).errors.join('\n'),
    /verdict/
  );
});

test('synthesis schema declares the v1 payload shape', async () => {
  const schema = JSON.parse(await readFile(synthesisSchemaPath, 'utf8'));

  assert.equal(schema.$id, 'consensus-plugin/v1/synthesis.schema.json');
  assert.equal(schema.properties.schema_version.const, 'v1');
  assert.deepEqual(schema.required, [
    'schema_version',
    'synthesized_artifact',
    'synthesis_reasoning',
    'unresolved_disagreements'
  ]);
  assert.equal(schema.properties.unresolved_disagreements.type, 'array');
  assert.equal(JSON.stringify(schema).includes('maxLength'), false);
});

test('validateSynthesisShape accepts a complete v1 synthesis payload', () => {
  assert.deepEqual(validateSynthesisShape(validSynthesis()), { ok: true, errors: [] });
  assert.deepEqual(
    validateSynthesisShape(validSynthesis({ unresolved_disagreements: ['scope of section 2'] })),
    { ok: true, errors: [] }
  );
});

test('validateSynthesisShape rejects missing, mistyped, and extra fields', () => {
  assert.match(validateSynthesisShape(validSynthesis({ schema_version: 'v0' })).errors.join('\n'), /schema_version/);
  assert.match(validateSynthesisShape(validSynthesis({ synthesized_artifact: 42 })).errors.join('\n'), /synthesized_artifact/);
  assert.match(validateSynthesisShape(validSynthesis({ synthesis_reasoning: undefined })).errors.join('\n'), /synthesis_reasoning/);
  assert.match(
    validateSynthesisShape({ schema_version: 'v1', synthesized_artifact: 'x', synthesis_reasoning: 'y' }).errors.join('\n'),
    /unresolved_disagreements/
  );
  assert.match(
    validateSynthesisShape(validSynthesis({ unresolved_disagreements: 'not an array' })).errors.join('\n'),
    /unresolved_disagreements/
  );
  assert.match(
    validateSynthesisShape(validSynthesis({ unresolved_disagreements: [1, 2] })).errors.join('\n'),
    /unresolved_disagreements\[0\]/
  );
  assert.match(validateSynthesisShape(validSynthesis({ extra: true })).errors.join('\n'), /additional property: extra/);
  assert.deepEqual(validateSynthesisShape(null), { ok: false, errors: ['synthesis must be an object'] });
});

test('validateVerdictCaps caps parallel critique fields like reasoning', () => {
  const ownOversize = validateVerdictCaps(
    parallelVerdict({ critique: parallelCritique({ own_previous: 'x'.repeat(VERDICT_CAPS.reasoning_bytes + 1) }) }),
    { mode: 'parallel_revision' }
  );
  assert.equal(ownOversize.ok, false);
  assert.deepEqual(ownOversize.metadata, {
    code: 'OVERSIZE_REJECTED',
    field: 'critique.own_previous',
    limit_bytes: VERDICT_CAPS.reasoning_bytes,
    actual_bytes: VERDICT_CAPS.reasoning_bytes + 1
  });

  const peerOversize = validateVerdictCaps(
    parallelVerdict({ critique: parallelCritique({ peer_previous: 'é'.repeat((VERDICT_CAPS.reasoning_bytes / 2) + 1) }) }),
    { mode: 'parallel_revision' }
  );
  assert.equal(peerOversize.ok, false);
  assert.equal(peerOversize.metadata.field, 'critique.peer_previous');
  assert.equal(peerOversize.metadata.actual_bytes, VERDICT_CAPS.reasoning_bytes + 2);

  const within = validateVerdictCaps(parallelVerdict(), { mode: 'parallel_revision' });
  assert.equal(within.ok, true);
});

test('validateVerdictCaps total-verdict cap is enforced for parallel verdicts with critiques', () => {
  const total = validateVerdictCaps(
    parallelVerdict({ proposed_artifact: 'x'.repeat(VERDICT_CAPS.total_verdict_bytes) }),
    { mode: 'parallel_revision' }
  );
  assert.equal(total.ok, false);
  assert.equal(total.metadata.field, 'verdict');
});

test('validateVerdictCaps applies UTF-8 byte caps after shape validation', () => {
  const accepted = validateVerdictCaps(validVerdict({ reasoning: 'é'.repeat(4) }));
  assert.equal(accepted.ok, true);

  const oversized = validateVerdictCaps(
    validVerdict({ verdict: 'REVISE', proposed_artifact: 'x'.repeat(VERDICT_CAPS.proposed_artifact_bytes + 1) })
  );

  assert.equal(oversized.ok, false);
  assert.deepEqual(oversized.metadata, {
    code: 'OVERSIZE_REJECTED',
    field: 'proposed_artifact',
    limit_bytes: VERDICT_CAPS.proposed_artifact_bytes,
    actual_bytes: VERDICT_CAPS.proposed_artifact_bytes + 1
  });
});

test('validateVerdictCaps reports oversized reasoning and concerns with byte counts', () => {
  const reasoning = validateVerdictCaps(validVerdict({ reasoning: 'x'.repeat(VERDICT_CAPS.reasoning_bytes + 1) }));
  assert.equal(reasoning.ok, false);
  assert.equal(reasoning.metadata.field, 'reasoning');
  assert.equal(reasoning.metadata.code, 'OVERSIZE_REJECTED');

  const concerns = validateVerdictCaps(
    validVerdict({ verdict: 'IMPASSE', concerns: ['é'.repeat((VERDICT_CAPS.concern_bytes / 2) + 1)] })
  );
  assert.equal(concerns.ok, false);
  assert.equal(concerns.metadata.field, 'concerns[0]');
  assert.equal(concerns.metadata.actual_bytes, VERDICT_CAPS.concern_bytes + 2);
});

test('validateVerdictCaps enforces max concern count and total JSON payload caps', () => {
  const tooManyConcerns = validateVerdictCaps(
    validVerdict({ concerns: Array.from({ length: VERDICT_CAPS.max_concerns + 1 }, () => 'small') })
  );
  assert.equal(tooManyConcerns.ok, false);
  assert.deepEqual(tooManyConcerns.metadata, {
    code: 'OVERSIZE_REJECTED',
    field: 'concerns',
    limit_count: VERDICT_CAPS.max_concerns,
    actual_count: VERDICT_CAPS.max_concerns + 1
  });

  const total = validateVerdictCaps(
    validVerdict({ verdict: 'REVISE', proposed_artifact: 'x'.repeat(VERDICT_CAPS.total_verdict_bytes) })
  );
  assert.equal(total.ok, false);
  assert.equal(total.metadata.field, 'verdict');
});
