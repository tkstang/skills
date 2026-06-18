import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('package-metadata', () => {
  it('package metadata declares the test harness contract', async () => {
    const packageJson = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8'),
    );

    expect(packageJson.private).toBe(true);
    expect(packageJson.type).toBe('module');
    expect(packageJson.engines?.node ?? '').toMatch(/>=\s*22/);
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
