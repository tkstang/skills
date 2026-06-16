import { describe, expect, it } from 'vitest';

describe('vitest tooling', () => {
  it('runs project Vitest tests under the Node runtime', () => {
    expect(process.versions.node).toMatch(/^\d+\./);
  });
});
