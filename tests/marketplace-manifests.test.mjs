import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repoRoot = new URL('..', import.meta.url);

const marketplaces = [
  '.claude-plugin/marketplace.json',
  '.cursor-plugin/marketplace.json',
  '.agents/plugins/marketplace.json'
];

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, repoRoot), 'utf8'));
}

test('marketplace manifests declare local consensus plugin source', async () => {
  for (const marketplacePath of marketplaces) {
    const manifest = await readJson(marketplacePath);
    const entry = manifest.plugins?.find((plugin) => plugin.name === 'consensus');

    assert.ok(entry, `${marketplacePath} should declare consensus`);
    assert.equal(entry.source?.path, './plugins/consensus');
    assert.equal(entry.source.path.includes('..'), false, `${marketplacePath} should not escape repo root`);

    const resolvedSourcePath = path.resolve(repoRoot.pathname, entry.source.path);
    assert.ok(resolvedSourcePath.startsWith(path.resolve(repoRoot.pathname)));
    assert.equal((await stat(resolvedSourcePath)).isDirectory(), true);
  }
});
