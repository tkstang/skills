// tests/tooling/no-node-test-runner.test.ts
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Documented allowlist. Expected empty — any addition must be justified here.
const ALLOWED_MJS_TESTS: string[] = [];

// Small recursive walk (no experimental fs.glob on Node 22 — see vitest-config.test.ts style).
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

const TEST_FILES = walk('tests').filter((f) => /\.test\.(ts|mts|mjs)$/.test(f));

describe('test-runner policy', () => {
  it('has no tests/**/*.test.mjs (Vitest-only)', () => {
    const stray = TEST_FILES.filter(
      (f) => f.endsWith('.test.mjs') && !ALLOWED_MJS_TESTS.includes(f),
    );
    expect(stray).toEqual([]);
  });

  it('no test source imports node:test', () => {
    const offenders = TEST_FILES.filter((f) =>
      /from\s+['"]node:test['"]/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('no test source imports node:assert (use Vitest expect)', () => {
    const offenders = TEST_FILES.filter((f) =>
      /from\s+['"]node:assert(\/strict)?['"]/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
