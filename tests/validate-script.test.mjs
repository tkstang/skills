import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  parseFrontmatter,
  parseJsonFile,
  validateMarketplaceSource,
  validateReadmeInstallMatrix,
  validateRepository,
  validateSkillReference,
  validateVersionConsistency
} from '../scripts/validate.mjs';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);

test('parseFrontmatter reads skill metadata', () => {
  const parsed = parseFrontmatter(`---\nname: consensus-refine\nmetadata:\n  version: "0.1.0"\n---\n# Body\n`);

  assert.equal(parsed.name, 'consensus-refine');
  assert.deepEqual(parsed.metadata, { version: '0.1.0' });
});

test('parseJsonFile reports valid JSON path context', async () => {
  const manifest = await parseJsonFile(path.join(repoRoot, 'plugins/consensus/.codex-plugin/plugin.json'));

  assert.equal(manifest.name, 'consensus');
  assert.equal(manifest.version, '0.1.0');
});

test('individual validators reject escaping paths and missing install matrix', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-validator-'));
  await mkdir(path.join(tempRoot, 'plugins'), { recursive: true });
  await writeFile(path.join(tempRoot, 'README.md'), '# Missing\n');

  const marketplaceIssues = await validateMarketplaceSource(tempRoot, {
    name: 'bad',
    source: { path: '../outside' }
  });
  assert.equal(marketplaceIssues.length, 1);
  assert.match(marketplaceIssues[0], /escape/i);

  const skillIssues = await validateSkillReference(tempRoot, {
    name: 'bad',
    path: '../outside'
  });
  assert.equal(skillIssues.length, 1);
  assert.match(skillIssues[0], /escape/i);

  const readmeIssues = await validateReadmeInstallMatrix(tempRoot);
  assert.equal(readmeIssues.length, 1);
  assert.match(readmeIssues[0], /Install Matrix/);
});

test('version consistency and full repository validation pass', async () => {
  const versionIssues = await validateVersionConsistency(repoRoot);
  assert.deepEqual(versionIssues, []);

  const result = await validateRepository({ root: repoRoot });
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});
