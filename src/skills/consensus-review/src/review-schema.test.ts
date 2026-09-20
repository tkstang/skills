import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const schema = JSON.parse(
  readFileSync(
    new URL('../schemas/review.schema.json', import.meta.url),
    'utf8',
  ),
);

describe('review response schema', () => {
  it('uses Draft-07 definitions and resolves every local reference', () => {
    expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
    expect(schema.$defs).toBeUndefined();
    const refs: string[] = [];
    function visit(value: unknown) {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        if (key === '$ref') refs.push(child as string);
        else visit(child);
      }
    }
    visit(schema);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ref).toMatch(/^#\/definitions\/[^/]+$/u);
      expect(schema.definitions[ref.split('/')[2]!]).toBeDefined();
    }
  });

  it('preserves mutually exclusive finding locations and closed objects', () => {
    expect(schema.definitions.finding.oneOf).toEqual([
      { required: ['location'], not: { required: ['anchor'] } },
      { required: ['anchor'], not: { required: ['location'] } },
    ]);
    for (const definition of [schema, ...Object.values(schema.definitions)]) {
      expect(definition).toMatchObject({
        type: 'object',
        additionalProperties: false,
      });
    }
    expect(schema.definitions.finding.properties.confidence).toEqual({
      type: 'number',
      minimum: 0,
      maximum: 1,
    });
  });
});
