import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('generated consensus-refine import', () => {
  it('imports the sibling generated consensus-loop runtime', async () => {
    const source = await readFile(
      new URL(
        '../../plugins/consensus/skills/refine/scripts/consensus-refine.mjs',
        import.meta.url,
      ),
      'utf8',
    );

    expect(source).toContain("from './consensus-loop.mjs';");
    expect(source).not.toContain('../core/');
  });
});
