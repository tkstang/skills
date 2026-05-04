import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  VERDICT_CAPS,
  validateVerdictCaps,
  validateVerdictShape
} from '../plugins/consensus/skills/consensus-refine/scripts/consensus-loop.mjs';

const schemaPath = new URL(
  '../plugins/consensus/skills/consensus-refine/schemas/verdict-alternating.schema.json',
  import.meta.url
);

function validVerdict(overrides = {}) {
  return {
    schema_version: 'v0',
    decision: 'ACCEPT',
    reasoning: 'Looks good.',
    ...overrides
  };
}

test('verdict schema declares alternating branches without maxLength caps', async () => {
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  const serialized = JSON.stringify(schema);

  assert.equal(schema.$id, 'https://example.com/consensus/verdict-alternating.schema.json');
  assert.equal(schema.oneOf.length, 3);
  assert.equal(serialized.includes('maxLength'), false);

  const decisions = schema.oneOf.map((branch) => branch.properties.decision.const).sort();
  assert.deepEqual(decisions, ['ACCEPT', 'IMPASSE', 'REVISE']);
});

test('validateVerdictShape accepts ACCEPT, REVISE, and IMPASSE verdicts', () => {
  assert.deepEqual(validateVerdictShape(validVerdict()), { ok: true, errors: [] });
  assert.deepEqual(
    validateVerdictShape(validVerdict({ decision: 'REVISE', proposed_artifact: 'Updated section.' })),
    { ok: true, errors: [] }
  );
  assert.deepEqual(
    validateVerdictShape(validVerdict({ decision: 'IMPASSE', concerns: ['conflict remains'] })),
    { ok: true, errors: [] }
  );
});

test('validateVerdictShape enforces schema version, branch requirements, and additional properties', () => {
  assert.match(validateVerdictShape(validVerdict({ schema_version: 'v1' })).errors.join('\n'), /schema_version/);
  assert.match(validateVerdictShape(validVerdict({ decision: 'REVISE' })).errors.join('\n'), /proposed_artifact/);
  assert.match(validateVerdictShape(validVerdict({ decision: 'IMPASSE' })).errors.join('\n'), /concerns/);
  assert.match(validateVerdictShape(validVerdict({ extra: true })).errors.join('\n'), /additional property: extra/);
});

test('validateVerdictCaps applies UTF-8 byte caps after shape validation', () => {
  const accepted = validateVerdictCaps(validVerdict({ reasoning: 'é'.repeat(4) }));
  assert.equal(accepted.ok, true);

  const oversized = validateVerdictCaps(
    validVerdict({ decision: 'REVISE', proposed_artifact: 'x'.repeat(VERDICT_CAPS.proposed_artifact_bytes + 1) })
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
    validVerdict({ decision: 'IMPASSE', concerns: ['é'.repeat((VERDICT_CAPS.concern_bytes / 2) + 1)] })
  );
  assert.equal(concerns.ok, false);
  assert.equal(concerns.metadata.field, 'concerns[0]');
  assert.equal(concerns.metadata.actual_bytes, VERDICT_CAPS.concern_bytes + 2);
});
