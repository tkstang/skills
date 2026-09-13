import { access, readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const WRAPPER_OUTPUTS = [
  '../../plugins/consensus/skills/create/scripts/consensus-create.mjs',
  '../../plugins/consensus/skills/decide/scripts/consensus-decide.mjs',
  '../../plugins/consensus/skills/plan/scripts/consensus-plan.mjs',
  '../../plugins/consensus/skills/refine/scripts/consensus-refine.mjs',
  '../../plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs',
] as const;

describe('generated consensus config imports', () => {
  it('rewrites convergence wrappers to sibling consensus-config outputs', async () => {
    for (const output of WRAPPER_OUTPUTS) {
      const outputUrl = new URL(output, import.meta.url);
      const configUrl = new URL('consensus-config.mjs', outputUrl);
      const source = await readFile(outputUrl, 'utf8');

      expect(source).toContain("from './consensus-config.mjs'");
      expect(source).not.toContain('../config/');
      await expect(access(configUrl)).resolves.toBeUndefined();
    }
  });
});
