import { readFile } from 'node:fs/promises';
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
        'sync:transcript-core',
        'test',
        'test:vitest',
        'type-check',
        'validate',
        'worktree:init',
        'worktree:validate',
      ].toSorted(),
    );
    expect(packageJson.scripts?.test).toBe('pnpm run test:vitest');
    expect(packageJson.scripts?.['test:node']).toBeUndefined();
    expect(packageJson.scripts?.['test:vitest']).toBe(
      'node scripts/run-vitest.mjs',
    );
    expect(packageJson.scripts?.['type-check']).toBe('tsc --noEmit');
    expect(packageJson.scripts?.validate).toBe('node scripts/validate.mjs');
    expect(packageJson.scripts?.smoke).toBe('node scripts/smoke-test.mjs');
  });
});
