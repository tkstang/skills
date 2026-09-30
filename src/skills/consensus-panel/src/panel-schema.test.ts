import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import { panelResponseSchemaPath as generatedPanelResponseSchemaPath } from '../../../../plugins/consensus/skills/panel/scripts/consensus-panel.mjs';
import { validateSchemaSubset } from '../../../plugins/consensus/provider-cli/schema-validate.js';
import {
  parsePanelResponsePayload,
  panelResponseSchemaPath,
} from './consensus-panel.js';

const schemaPath = panelResponseSchemaPath();
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const stringLimits = {
  understood_question: 4096,
  response: 16384,
} as const;
const arrayFields = ['key_points', 'risks', 'assumptions'] as const;
const arrayMaxItems = 50;
const arrayItemMaxLength = 4096;

const valid = {
  schema_version: 'v1',
  understood_question: 'What should we do about the migration?',
  response: 'Ship behind a feature flag and prepare rollback.',
  key_points: ['Use staged rollout.', 'Add rollback evidence.'],
  risks: ['Flag cleanup may be missed.'],
  assumptions: ['The system supports feature flags.'],
  confidence: 'medium',
};

describe('panel-response.schema.json', () => {
  it('resolves to the shipped panel schema path', () => {
    expect(schemaPath).toBe(
      fileURLToPath(
        new URL('../schemas/panel-response.schema.json', import.meta.url),
      ),
    );
  });

  it('resolves the generated runtime schema path to an existing shipped file', () => {
    const generatedSchemaPath = generatedPanelResponseSchemaPath();

    expect(generatedSchemaPath).toBe(
      fileURLToPath(
        new URL(
          '../../../../plugins/consensus/skills/panel/schemas/panel-response.schema.json',
          import.meta.url,
        ),
      ),
    );
    expect(existsSync(generatedSchemaPath)).toBe(true);
  });

  it('accepts a well-formed panel response payload', () => {
    expect(validateSchemaSubset(valid, schema).ok).toBe(true);
    expect(parsePanelResponsePayload(valid)).toEqual(valid);
  });

  it('rejects missing and wrong-typed fields', () => {
    const { response: _response, ...missingResponse } = valid;

    expect(validateSchemaSubset(missingResponse, schema).ok).toBe(false);
    expect(() => parsePanelResponsePayload(missingResponse)).toThrow(
      /Missing required JSON field: response/,
    );
    expect(
      validateSchemaSubset({ ...valid, key_points: 'oops' }, schema).ok,
    ).toBe(false);
    expect(() =>
      parsePanelResponsePayload({ ...valid, key_points: 'oops' }),
    ).toThrow(/key_points must be an array/);
  });

  it('rejects wrong confidence values and additional properties', () => {
    expect(() =>
      parsePanelResponsePayload({ ...valid, confidence: 'certain' }),
    ).toThrow(/confidence must be low, medium, or high/);
    expect(() => parsePanelResponsePayload({ ...valid, extra: true })).toThrow(
      /unknown key: extra/,
    );
  });

  it('keeps schema and runtime response limits aligned at their boundaries', () => {
    expect(schema.properties.understood_question).toMatchObject({
      type: 'string',
      minLength: 1,
      maxLength: stringLimits.understood_question,
    });
    expect(schema.properties.response).toMatchObject({
      type: 'string',
      minLength: 1,
      maxLength: stringLimits.response,
    });
    for (const field of arrayFields) {
      expect(schema.properties[field]).toMatchObject({
        type: 'array',
        maxItems: arrayMaxItems,
        items: {
          type: 'string',
          minLength: 1,
          maxLength: arrayItemMaxLength,
        },
      });
    }

    const boundaryPayload = {
      ...valid,
      understood_question: '😀'.repeat(stringLimits.understood_question),
      response: 'r'.repeat(stringLimits.response),
      key_points: Array.from({ length: arrayMaxItems }, () =>
        'k'.repeat(arrayItemMaxLength),
      ),
      risks: [],
      assumptions: [],
    };
    expect(parsePanelResponsePayload(boundaryPayload)).toEqual(boundaryPayload);
  });

  it.each([
    {
      field: 'understood_question',
      payload: {
        ...valid,
        understood_question: '😀'.repeat(stringLimits.understood_question + 1),
      },
      error: /understood_question must be at most 4096 characters/,
    },
    {
      field: 'response',
      payload: {
        ...valid,
        response: 'r'.repeat(stringLimits.response + 1),
      },
      error: /response must be at most 16384 characters/,
    },
    {
      field: 'key_points',
      payload: {
        ...valid,
        key_points: Array.from({ length: arrayMaxItems + 1 }, () => 'point'),
      },
      error: /key_points must contain at most 50 items/,
    },
    {
      field: 'risks',
      payload: { ...valid, risks: [''] },
      error: /risks\[0\] must be a non-empty string/,
    },
    {
      field: 'assumptions',
      payload: {
        ...valid,
        assumptions: ['a'.repeat(arrayItemMaxLength + 1)],
      },
      error: /assumptions\[0\] must be at most 4096 characters/,
    },
  ])('rejects an out-of-bounds $field value', ({ payload, error }) => {
    expect(() => parsePanelResponsePayload(payload)).toThrow(error);
  });

  it('declares the provider-native schema contract', () => {
    expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
    expect(schema.$id).toBe(
      'https://github.com/tkstang/skills/panel/panel-response.schema.json',
    );
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual([
      'schema_version',
      'understood_question',
      'response',
      'key_points',
      'risks',
      'assumptions',
      'confidence',
    ]);
    expect(schema.properties.confidence.enum).toEqual([
      'low',
      'medium',
      'high',
    ]);
  });
});
