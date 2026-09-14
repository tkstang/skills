import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('generated consensus-evaluate import', () => {
  it('bundles the shared consensus-loop runtime', async () => {
    const source = await readFile(
      new URL(
        '../../../plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs',
        import.meta.url,
      ),
      'utf8',
    );

    expect(source).toContain('// GENERATED skill payload for evaluate.');
    expect(source).not.toMatch(/from\s+['"]\.\.?\//);
    expect(source).not.toContain('../core/');
  });
});
