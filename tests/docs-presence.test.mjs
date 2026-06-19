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
const evaluateSkillPath = 'plugins/consensus/skills/evaluate/SKILL.md';

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

test('refine SKILL.md contains usage guidance sections', async () => {
  const skill = await read(refineSkillPath);

  assert.match(skill, /^## When NOT to Use$/m);
  assert.match(skill, /^## Examples$/m);
  assert.match(skill, /^## Success Criteria$/m);
});

test('evaluate SKILL.md contains usage guidance sections', async () => {
  const skill = await read(evaluateSkillPath);

  assert.match(skill, /^## When NOT to Use$/m);
  assert.match(skill, /^## Examples$/m);
  assert.match(skill, /^## Success Criteria$/m);
});

test('evaluate SKILL.md documents guided rubric creation flow', async () => {
  const skill = await read(evaluateSkillPath);

  assert.match(skill, /^## Guided Rubric Creation$/m);
  // no-rubric evaluation trigger
  assert.match(skill, /no rubric|provides no rubric|without a rubric/i);
  // user-approved paths
  assert.match(skill, /user-approved/i);
  // 12-criteria cap
  assert.match(skill, /12/);
});

test('evaluate skill is documented and registered in distribution surfaces', async () => {
  const requiredEvaluateFiles = [
    evaluateSkillPath,
    'plugins/consensus/skills/evaluate/references/operator-qa.md',
    'plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs',
    'plugins/consensus/skills/evaluate/scripts/consensus-loop.mjs',
    'plugins/consensus/skills/evaluate/schemas/verdict-alternating.schema.json',
    'plugins/consensus/skills/evaluate/schemas/verdict-parallel.schema.json',
    'plugins/consensus/skills/evaluate/schemas/synthesis.schema.json',
  ];

  for (const relativePath of requiredEvaluateFiles) {
    const contents = await read(relativePath);
    assert.ok(
      contents.trim().length > 0,
      `${relativePath} should not be empty`,
    );
  }

  const skill = await read(evaluateSkillPath);
  assert.match(skill, /^name: evaluate$/m);
  assert.match(skill, /^## Evaluation Invocation$/m);
  assert.match(skill, /^## Output Contract$/m);
  assert.match(skill, /--rubric <path>/);
  assert.match(skill, /parallel_revision/);
  assert.match(skill, /minimal/);
  assert.match(skill, /consensus-verdict/);

  const qa = await read(
    'plugins/consensus/skills/evaluate/references/operator-qa.md',
  );
  assert.match(qa, /consensus-evaluate\.mjs/);
  assert.match(qa, /--rubric/);
  assert.match(qa, /Unresolved dissent/);

  const providerManifests = [
    'plugins/consensus/.claude-plugin/plugin.json',
    'plugins/consensus/.codex-plugin/plugin.json',
    'plugins/consensus/.cursor-plugin/plugin.json',
  ];
  for (const manifestPath of providerManifests) {
    const manifest = JSON.parse(await read(manifestPath));
    const searchable = JSON.stringify(manifest);
    assert.match(searchable, /refine/);
    assert.match(searchable, /evaluate/);
  }
});

test('documentation records the generated TypeScript runtime contract', async () => {
  const readme = await read('README.md');
  const rootAgents = await read('AGENTS.md');
  const consensusAgents = await read('plugins/consensus/AGENTS.md');
  const testAgents = await read('tests/AGENTS.md');
  const decisions = await read('.oat/repo/reference/decision-record.md');
  const sharedTranscriptCore = await read('shared/transcript-core/README.md');
  const exportTranscriptFormats = await read(
    'skills/export-session-transcript/references/transcript-formats.md',
  );

  assert.match(readme, /^### Generated runtime outputs$/m);
  assert.match(readme, /src\/transcript\/core\/runtimes\.ts/);
  assert.match(readme, /pnpm run sync:transcript-core.*compatibility wrapper/);
  assert.match(readme, /scripts\/build-generated\.mjs --check/);
  assert.match(rootAgents, /canonical TypeScript source/);
  assert.match(
    rootAgents,
    /pnpm run sync:transcript-core.*compatibility wrapper/,
  );
  assert.match(consensusAgents, /src\/consensus\//);
  assert.match(consensusAgents, /plugins\/consensus\/skills\/\*\/scripts\//);
  assert.match(testAgents, /tests\/generated-output-sync\.test\.mjs/);
  assert.match(sharedTranscriptCore, /src\/transcript\/core\/runtimes\.ts/);
  assert.doesNotMatch(
    sharedTranscriptCore,
    /shared\/transcript-core\/runtimes\.mjs/,
  );
  assert.match(exportTranscriptFormats, /src\/transcript\/core\/runtimes\.ts/);
  assert.doesNotMatch(
    exportTranscriptFormats,
    /shared\/transcript-core\/runtimes\.mjs/,
  );
  assert.match(
    decisions,
    /Canonical TypeScript sources build committed generated runtime outputs/,
  );
  assert.match(decisions, /DR-014[\s\S]+Superseded in implementation/);
});
