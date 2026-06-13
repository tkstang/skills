import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  LOOP_SCHEMA_VERSION,
  VERDICT_CAPS,
  validateVerdictCaps,
  validateVerdictShape
} from '../plugins/consensus/skills/refine/scripts/consensus-loop.mjs';

const schemaPath = new URL(
  '../plugins/consensus/skills/refine/schemas/verdict-alternating.schema.json',
  import.meta.url
);

function validVerdict(overrides = {}) {
  return {
    schema_version: 'v1',
    verdict: 'ACCEPT',
    reasoning: 'Looks good.',
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
