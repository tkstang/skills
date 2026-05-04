import assert from 'node:assert/strict';
import { cp, mkdir, readFile, writeFile, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  bumpVersion,
  isValidSemver
} from '../scripts/bump-version.mjs';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const jsonFiles = [
  'plugins/consensus/.claude-plugin/plugin.json',
  'plugins/consensus/.cursor-plugin/plugin.json',
  'plugins/consensus/.codex-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  '.cursor-plugin/marketplace.json',
  '.agents/plugins/marketplace.json'
];

async function tempReleaseRoot() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'release-versioning-'));
  for (const file of jsonFiles) {
    await mkdir(path.dirname(path.join(tempRoot, file)), { recursive: true });
    await cp(path.join(repoRoot, file), path.join(tempRoot, file));
  }
  return tempRoot;
}

async function readJson(root, relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

test('isValidSemver accepts release and prerelease versions only', () => {
  assert.equal(isValidSemver('0.2.0'), true);
  assert.equal(isValidSemver('0.2.0-beta.1'), true);
  assert.equal(isValidSemver('v0.2.0'), false);
  assert.equal(isValidSemver('0.2'), false);
  assert.equal(isValidSemver('0.2.0+build'), false);
});

test('bumpVersion updates plugin manifests and present marketplace versions', async () => {
  const root = await tempReleaseRoot();
  const cursorMarketplacePath = '.cursor-plugin/marketplace.json';
  const cursorMarketplace = await readJson(root, cursorMarketplacePath);
  delete cursorMarketplace.plugins[0].version;
  await writeFile(path.join(root, cursorMarketplacePath), `${JSON.stringify(cursorMarketplace, null, 2)}\n`);

  const result = await bumpVersion({ root, version: '0.2.0-beta.1' });

  assert.deepEqual([...result.updatedFiles].sort(), [...jsonFiles].sort());
  for (const file of jsonFiles.slice(0, 3)) {
    assert.equal((await readJson(root, file)).version, '0.2.0-beta.1');
  }
  assert.equal((await readJson(root, '.claude-plugin/marketplace.json')).plugins[0].version, '0.2.0-beta.1');
  assert.equal((await readJson(root, '.agents/plugins/marketplace.json')).plugins[0].version, '0.2.0-beta.1');
  assert.equal('version' in (await readJson(root, cursorMarketplacePath)).plugins[0], false);
});

test('bumpVersion rejects malformed semver before modifying files', async () => {
  const root = await tempReleaseRoot();

  await assert.rejects(
    bumpVersion({ root, version: 'v0.2.0' }),
    /semver/i
  );
  assert.equal((await readJson(root, 'plugins/consensus/.claude-plugin/plugin.json')).version, '0.1.0');
});
