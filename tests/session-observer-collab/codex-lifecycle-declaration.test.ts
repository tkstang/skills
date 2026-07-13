import { readFile } from 'node:fs/promises';

import { describe, expect, test } from 'vitest';

const lifecyclePath = new URL(
  '../../skills/session-observer-collab/scripts/codex-lifecycle.mjs',
  import.meta.url,
);
const declarationPath = new URL(
  '../../skills/session-observer-collab/scripts/codex-lifecycle.d.ts',
  import.meta.url,
);

describe('Codex lifecycle declarations', () => {
  test('makes supportRemoved optional for the no-registration uninstall result', async () => {
    const source = await readFile(lifecyclePath, 'utf8');
    const declaration = await readFile(declarationPath, 'utf8');
    const noRegistrationReturn = source.slice(
      source.indexOf('if (exact.length === 0)'),
      source.indexOf('const next = structuredClone(config)'),
    );

    expect(noRegistrationReturn).not.toMatch(/supportRemoved/);
    expect(declaration).toMatch(/supportRemoved\?: boolean/);
  });
});
