import assert from 'node:assert/strict';
import { lstat, readFile } from 'node:fs/promises';
import test from 'node:test';

const repoRoot = new URL('..', import.meta.url);
const requiredDocs = [
  'README.md',
  'LICENSE',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'RELEASING.md',
];
const refineSkillPath = 'plugins/consensus/skills/refine/SKILL.md';

async function read(relativePath) {
  return readFile(new URL(relativePath, repoRoot), 'utf8');
}

test('baseline documentation files exist', async () => {
  for (const docPath of requiredDocs) {
    const contents = await read(docPath);
    assert.ok(contents.trim().length > 0, `${docPath} should not be empty`);
  }
});

test('README documents local git repository install, permissions, and limitations', async () => {
  const readme = await read('README.md');

  assert.match(readme, /^## Local Git Repository Install$/m);
  assert.match(readme, /^## Permissions$/m);
  assert.match(readme, /^## Limitations$/m);
});

test('license, changelog, and provider docs contract are present', async () => {
  assert.match(await read('LICENSE'), /MIT License/);
  assert.match(await read('CHANGELOG.md'), /## \[0\.1\.0\] - Unreleased/);

  const claude = await lstat(new URL('CLAUDE.md', repoRoot));
  assert.equal(claude.isSymbolicLink(), true);
});

test('refine SKILL.md documents iteration-mode and escalation sections', async () => {
  const skill = await read(refineSkillPath);

  assert.match(skill, /^## Iteration Modes$/m);
  assert.match(skill, /^## Escalation Handling$/m);
});

test('documentation records the generated TypeScript runtime contract', async () => {
  const readme = await read('README.md');
  const rootAgents = await read('AGENTS.md');
  const consensusAgents = await read('plugins/consensus/AGENTS.md');
  const testAgents = await read('tests/AGENTS.md');
  const decisions = await read('.oat/repo/reference/decision-record.md');

  assert.match(readme, /^### Generated runtime outputs$/m);
  assert.match(readme, /scripts\/build-generated\.mjs --check/);
  assert.match(rootAgents, /canonical TypeScript source/);
  assert.match(consensusAgents, /src\/consensus\//);
  assert.match(consensusAgents, /plugins\/consensus\/skills\/\*\/scripts\//);
  assert.match(testAgents, /tests\/generated-output-sync\.test\.mjs/);
  assert.match(
    decisions,
    /Canonical TypeScript sources build committed generated runtime outputs/,
  );
});
