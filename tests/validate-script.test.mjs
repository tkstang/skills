import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, symlink } from 'node:fs/promises';
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

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function createValidTempRepository() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-validator-'));

  await mkdir(path.join(tempRoot, 'skills'), { recursive: true });
  await mkdir(path.join(tempRoot, 'plugins/consensus/skills/consensus-refine'), { recursive: true });
  await mkdir(path.join(tempRoot, 'plugins/consensus/agents'), { recursive: true });
  await mkdir(path.join(tempRoot, 'plugins/consensus/.claude-plugin'), { recursive: true });
  await mkdir(path.join(tempRoot, 'plugins/consensus/.cursor-plugin'), { recursive: true });
  await mkdir(path.join(tempRoot, 'plugins/consensus/.codex-plugin'), { recursive: true });
  await mkdir(path.join(tempRoot, '.claude-plugin'), { recursive: true });
  await mkdir(path.join(tempRoot, '.cursor-plugin'), { recursive: true });
  await mkdir(path.join(tempRoot, '.agents/plugins'), { recursive: true });

  await writeFile(path.join(tempRoot, 'README.md'), '# Test\n\n## Local Git Repository Install\n');
  await writeFile(path.join(tempRoot, 'LICENSE'), 'MIT\n');
  await writeFile(path.join(tempRoot, 'CHANGELOG.md'), '# Changelog\n');
  await writeFile(path.join(tempRoot, 'CONTRIBUTING.md'), '# Contributing\n');
  await writeFile(path.join(tempRoot, 'RELEASING.md'), '# Releasing\n');
  await writeFile(path.join(tempRoot, 'AGENTS.md'), '# Agents\n');
  await symlink('AGENTS.md', path.join(tempRoot, 'CLAUDE.md'));

  const skillFrontmatter = `---
name: consensus-refine
description: Test skill
license: MIT
compatibility: codex
metadata:
  version: "0.1.0"
---
# Consensus Refine
`;
  await writeFile(path.join(tempRoot, 'plugins/consensus/skills/consensus-refine/SKILL.md'), skillFrontmatter);

  const providerManifest = {
    name: 'consensus',
    version: '0.1.0',
    author: { name: 'Thomas Stang' }
  };
  await writeJson(path.join(tempRoot, 'plugins/consensus/.claude-plugin/plugin.json'), providerManifest);
  await writeJson(path.join(tempRoot, 'plugins/consensus/.cursor-plugin/plugin.json'), providerManifest);
  await writeJson(path.join(tempRoot, 'plugins/consensus/.codex-plugin/plugin.json'), {
    ...providerManifest,
    skills: './skills/'
  });

  const claudeMarketplace = {
    name: 'skills',
    owner: { name: 'Thomas Stang' },
    plugins: [{ name: 'consensus', source: './plugins/consensus' }]
  };
  const codexMarketplace = {
    name: 'skills',
    plugins: [{ name: 'consensus', source: { source: 'local', path: './plugins/consensus' } }]
  };
  await writeJson(path.join(tempRoot, '.claude-plugin/marketplace.json'), claudeMarketplace);
  await writeJson(path.join(tempRoot, '.cursor-plugin/marketplace.json'), claudeMarketplace);
  await writeJson(path.join(tempRoot, '.agents/plugins/marketplace.json'), codexMarketplace);

  return tempRoot;
}

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

test('individual validators reject escaping paths and missing install docs', async () => {
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
  assert.match(readmeIssues[0], /Local Git Repository Install/);
});

test('version consistency and full repository validation pass', async () => {
  const versionIssues = await validateVersionConsistency(repoRoot);
  assert.deepEqual(versionIssues, []);

  const result = await validateRepository({ root: repoRoot });
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('repository validation accepts bumped semver versions and rejects malformed versions', async () => {
  const tempRoot = await createValidTempRepository();
  for (const provider of ['.claude-plugin', '.cursor-plugin', '.codex-plugin']) {
    const manifest = {
      name: 'consensus',
      version: '0.1.1'
    };
    if (provider === '.codex-plugin') {
      manifest.skills = './skills/';
    }
    await writeJson(path.join(tempRoot, `plugins/consensus/${provider}/plugin.json`), manifest);
  }

  const bumped = await validateRepository({ root: tempRoot });
  assert.equal(bumped.ok, true, bumped.errors.join('\n'));

  await writeJson(path.join(tempRoot, 'plugins/consensus/.codex-plugin/plugin.json'), {
    name: 'consensus',
    version: 'next',
    skills: './skills/'
  });

  const malformed = await validateRepository({ root: tempRoot });
  assert.equal(malformed.ok, false);
  assert.match(malformed.errors.join('\n'), /valid semver/);
});

test('full repository validation rejects invalid standalone skill directories', async () => {
  const tempRoot = await createValidTempRepository();
  await mkdir(path.join(tempRoot, 'skills/bad-skill'), { recursive: true });
  await writeFile(
    path.join(tempRoot, 'skills/bad-skill/SKILL.md'),
    `---
name: bad-skill
---
# Bad Skill
`
  );

  const result = await validateRepository({ root: tempRoot });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /skills\/bad-skill\/SKILL\.md missing frontmatter field: description/);
});
