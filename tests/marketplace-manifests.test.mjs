import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repoRoot = new URL('..', import.meta.url);

const marketplaces = [
  {
    path: '.claude-plugin/marketplace.json',
    sourceKind: 'string',
  },
  {
    path: '.cursor-plugin/marketplace.json',
    sourceKind: 'string',
  },
  {
    path: '.agents/plugins/marketplace.json',
    sourceKind: 'object',
  },
];

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, repoRoot), 'utf8'));
}

test('marketplace manifests declare local consensus plugin source', async () => {
  for (const { path: marketplacePath, sourceKind } of marketplaces) {
    const manifest = await readJson(marketplacePath);
    const entry = manifest.plugins?.find(
      (plugin) => plugin.name === 'consensus',
    );
    const sourcePath =
      typeof entry?.source === 'string' ? entry.source : entry?.source?.path;

    assert.equal(manifest.name, 'skills');
    assert.ok(entry, `${marketplacePath} should declare consensus`);
    assert.equal(typeof entry.source, sourceKind);
    assert.equal(sourcePath, './plugins/consensus');
    assert.equal(
      sourcePath.includes('..'),
      false,
      `${marketplacePath} should not escape repo root`,
    );

    const resolvedSourcePath = path.resolve(repoRoot.pathname, sourcePath);
    assert.ok(resolvedSourcePath.startsWith(path.resolve(repoRoot.pathname)));
    assert.equal((await stat(resolvedSourcePath)).isDirectory(), true);
  }
});
