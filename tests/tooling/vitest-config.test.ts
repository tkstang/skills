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

  it('allows integration tests enough time for subprocess fixtures', () => {
    // Generous enough that subprocess/real-timer integration tests are not
    // starved past their budget under a saturated parallel run. Asserted as a
    // floor so future upward tuning does not break this guard.
    expect(vitestConfig.test?.testTimeout).toBeGreaterThanOrEqual(30_000);
    expect(vitestConfig.test?.hookTimeout).toBeGreaterThanOrEqual(30_000);
  });
});
