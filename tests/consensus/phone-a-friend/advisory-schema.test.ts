import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateSchemaSubset } from '../../../src/consensus/provider-cli/schema-validate.js';

const schema = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        '../../../plugins/consensus/skills/phone-a-friend/schemas/advisory.schema.json',
        import.meta.url,
      ),
    ),
    'utf8',
  ),
);

const example = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        '../../../plugins/consensus/skills/phone-a-friend/references/examples/registry-cache.advisory.json',
        import.meta.url,
      ),
    ),
    'utf8',
  ),
);

const valid = {
  schema_version: 'v1',
  understood_question: 'Should we cache the registry lookup?',
  take: 'Caching is reasonable but invalidation is the risk.',
  recommendation: 'Cache with a short TTL and a manual bust.',
  risks: ['stale entries after a provider change'],
  follow_up_questions: ['How often does the registry change?'],
  confidence: 'medium',
  assumptions: ['the registry is read-mostly'],
};

describe('advisory.schema.json', () => {
  it('accepts a well-formed advisory payload', () => {
    expect(validateSchemaSubset(valid, schema).ok).toBe(true);
  });

  it('accepts the shipped example advisory payload', () => {
    expect(validateSchemaSubset(example, schema).ok).toBe(true);
  });

  it('rejects a payload missing a required field', () => {
    const { confidence, ...missing } = valid;

    expect(validateSchemaSubset(missing, schema).ok).toBe(false);
  });

  it('rejects a payload with a wrong-typed field', () => {
    expect(validateSchemaSubset({ ...valid, risks: 'oops' }, schema).ok).toBe(
      false,
    );
  });

  it('declares the full contract for provider-native enforcement', () => {
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual([
      'schema_version',
      'understood_question',
      'take',
      'recommendation',
      'risks',
      'follow_up_questions',
      'confidence',
    ]);
    expect(schema.properties.confidence.enum).toEqual([
      'low',
      'medium',
      'high',
    ]);
  });
});
