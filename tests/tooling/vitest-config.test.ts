import { describe, expect, it } from 'vitest';

// @ts-expect-error Vitest config is runtime JS and intentionally declaration-free.
import vitestConfig from '../../vitest.config.mjs';

describe('vitest tooling', () => {
  it('runs project Vitest tests under the Node runtime', () => {
    expect(process.versions.node).toMatch(/^\d+\./);
  });

  it('discovers TypeScript and MTS test guards', () => {
    expect(vitestConfig.test?.include).toEqual([
      'tests/**/*.test.ts',
      'tests/**/*.test.mts',
    ]);
  });
});
