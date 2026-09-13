import { describe, expect, it } from 'vitest';

import { validateSchemaSubset } from '../../../src/consensus/provider-cli/schema-validate.js';

describe('schema subset validation', () => {
  it('accepts valid objects and reports the specific failing field', () => {
    const schema = {
      type: 'object',
      required: ['verdict', 'confidence'],
      properties: {
        verdict: { type: 'string' },
        confidence: { type: 'number' },
        reasons: { type: 'array' },
      },
    };

    expect(
      validateSchemaSubset(
        { verdict: 'accept', confidence: 0.9, reasons: ['clear'] },
        schema,
      ),
    ).toEqual({ ok: true });

    expect(validateSchemaSubset({ verdict: 'accept' }, schema)).toEqual({
      ok: false,
      message: 'Missing required JSON field: confidence',
    });

    expect(
      validateSchemaSubset(
        { verdict: 'accept', confidence: 'high' },
        schema,
      ),
    ).toEqual({
      ok: false,
      message: 'Field confidence must be number.',
    });
  });
});
