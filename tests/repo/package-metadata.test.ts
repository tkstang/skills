import { access, readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('package-metadata', () => {
  it('package metadata declares the test harness contract', async () => {
    const packageJson = JSON.parse(
      await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
    );

    expect(packageJson.private).toBe(true);
    expect(packageJson.type).toBe('module');
    expect(packageJson.engines?.node ?? '').toMatch(/>=\s*22/);
    expect(Object.keys(packageJson.scripts ?? {}).toSorted()).toEqual(
      [
        'build',
        'build:check',
        'format',
        'format:check',
        'hooks',
        'hooks:disable-all',
        'hooks:enable-all',
        'hooks:status',
        'lint',
        'lint:fix',
        'premerge',
        'prepare',
        'smoke',
        'test',
        'test:live-e2e',
        'test:vitest',
        'type-check',
        'validate',
        'validate:internal-flags',
        'validate:skill-versions',
        'worktree:init',
        'worktree:validate',
      ].toSorted(),
    );
    expect(packageJson.scripts?.test).toBe('pnpm run test:vitest');
    expect(packageJson.scripts?.['test:node']).toBeUndefined();
    expect(packageJson.scripts?.['test:vitest']).toBe(
      'node scripts/run-vitest.mjs',
    );
    expect(packageJson.scripts?.['test:live-e2e']).toBe(
      'CONSENSUS_LIVE_SUBMIT_E2E=1 node scripts/run-vitest.mjs src/plugins/consensus/provider-cli/e2e/submit-live.e2e.test.ts',
    );
    await expect(
      access(
        new URL(
          '../../src/plugins/consensus/provider-cli/e2e/submit-live.e2e.test.ts',
          import.meta.url,
        ),
      ),
    ).resolves.toBeUndefined();
    expect(packageJson.scripts?.['type-check']).toBe('tsc --noEmit');
    expect(packageJson.scripts?.validate).toBe('tsx scripts/validate.ts');
    expect(packageJson.scripts?.['validate:skill-versions']).toBe(
      'tsx scripts/validate-skill-versions.ts',
    );
    expect(packageJson.scripts?.['validate:internal-flags']).toBe(
      'tsx scripts/validate-internal-flags.ts',
    );
    expect(packageJson.scripts?.smoke).toBe('node scripts/smoke-test.mjs');
  });
});
