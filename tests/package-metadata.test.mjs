import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('package metadata declares the test harness contract', async () => {
  const packageJson = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8'),
  );

  assert.equal(packageJson.private, true);
  assert.equal(packageJson.type, 'module');
  assert.match(packageJson.engines?.node ?? '', />=\s*22/);
  assert.equal(
    packageJson.scripts?.test,
    'pnpm run test:node && pnpm run test:vitest',
  );
  assert.equal(
    packageJson.scripts?.['test:node'],
    "node --test $(find tests -name '*.test.mjs' ! -name 'generated-output-sync.test.mjs' -type f | sort)",
  );
  assert.equal(
    packageJson.scripts?.['test:vitest'],
    'node scripts/run-vitest.mjs',
  );
  assert.equal(packageJson.scripts?.['type-check'], 'tsc --noEmit');
  assert.equal(packageJson.scripts?.validate, 'node scripts/validate.mjs');
  assert.equal(packageJson.scripts?.smoke, 'node scripts/smoke-test.mjs');
});
