import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.mts'],
    // Some integration tests spawn subprocesses or drive real timers; under a
    // saturated parallel run their ~1-3s of work can be starved past a tight
    // budget. 30s gives headroom without masking genuine hangs; fast unit tests
    // finish in milliseconds and are unaffected.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
