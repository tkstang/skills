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

  it('declares the provider-native schema contract', () => {
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
