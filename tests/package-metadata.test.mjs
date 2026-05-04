import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('package metadata declares the Node test harness contract', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

  assert.equal(packageJson.private, true);
  assert.equal(packageJson.type, 'module');
  assert.match(packageJson.engines?.node ?? '', />=\s*20/);
  assert.equal(packageJson.scripts?.test, 'node --test');
  assert.equal(packageJson.scripts?.validate, 'node scripts/validate.mjs');
  assert.equal(packageJson.scripts?.smoke, 'node scripts/smoke-test.mjs');
});
