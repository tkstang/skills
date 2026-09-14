import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('generated consensus-refine import', () => {
  it('bundles the shared consensus-loop runtime', async () => {
    const source = await readFile(
      new URL(
        '../../../plugins/consensus/skills/refine/scripts/consensus-refine.mjs',
        import.meta.url,
      ),
      'utf8',
    );

    expect(source).toContain('// GENERATED skill payload for refine.');
    expect(source).not.toMatch(/from\s+['"]\.\.?\//);
    expect(source).not.toContain('../core/');
  });
});
