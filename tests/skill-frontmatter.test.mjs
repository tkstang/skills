import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const refineSkillPath = new URL(
  '../plugins/consensus/skills/refine/SKILL.md',
  import.meta.url,
);
const evaluateSkillPath = new URL(
  '../plugins/consensus/skills/evaluate/SKILL.md',
  import.meta.url,
);

function frontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match, 'SKILL.md should start with frontmatter');
  return match[1];
}

function field(block, name) {
  const match = block.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'));
  assert.ok(match, `frontmatter should include ${name}`);
  return match[1].trim().replace(/^["']|["']$/g, '');
}

function optionalField(block, name) {
  const match = block.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'));
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : null;
}

test('refine skill frontmatter is portable and versioned', async () => {
  const markdown = await readFile(refineSkillPath, 'utf8');
  const block = frontmatter(markdown);
  const name = field(block, 'name');

  assert.equal(name, 'refine');
  assert.equal(path.basename(path.dirname(refineSkillPath.pathname)), name);
  assert.ok(field(block, 'description').length > 40);
  assert.equal(field(block, 'license'), 'MIT');
  assert.match(field(block, 'compatibility'), /Agent Skills baseline/);

  const allowedTools = field(block, 'allowed-tools');
  for (const requiredTool of [
    'Bash(node:*)',
    'Bash(paseo:*)',
    'Read',
    'Write',
  ]) {
    assert.match(
      allowedTools,
      new RegExp(requiredTool.replace(/[()*]/g, '\\$&')),
    );
  }

  assert.match(block, /^metadata:\n(?:  .+\n)*  version: ["']0\.1\.0["']$/m);
});

test('refine skill has promoted top-level version matching metadata.version', async () => {
  const markdown = await readFile(refineSkillPath, 'utf8');
  const block = frontmatter(markdown);

  const topLevelVersion = field(block, 'version');
  const metaVersionMatch = block.match(
    /^metadata:\n(?:  .+\n)*?  version:\s*["']?([^"'\n]+)["']?/m,
  );
  assert.ok(metaVersionMatch, 'frontmatter should include metadata.version');
  const metaVersion = metaVersionMatch[1].trim().replace(/^["']|["']$/g, '');

  assert.match(topLevelVersion, /^\d+\.\d+\.\d+/);
  assert.equal(
    topLevelVersion,
    metaVersion,
    'top-level version must match metadata.version',
  );
});

test('refine skill has a useful argument-hint', async () => {
  const markdown = await readFile(refineSkillPath, 'utf8');
  const block = frontmatter(markdown);

  const hint = field(block, 'argument-hint');
  assert.match(hint, /\.md/, 'argument-hint should reference a markdown input');
  assert.match(hint, /goal/i, 'argument-hint should mention the optional goal');
});

test('evaluate skill frontmatter is portable and versioned', async () => {
  const markdown = await readFile(evaluateSkillPath, 'utf8');
  const block = frontmatter(markdown);
  const name = field(block, 'name');

  assert.equal(name, 'evaluate');
  assert.equal(path.basename(path.dirname(evaluateSkillPath.pathname)), name);
  assert.ok(field(block, 'description').length > 40);
  assert.equal(field(block, 'license'), 'MIT');
  assert.match(field(block, 'compatibility'), /Agent Skills baseline/);

  const allowedTools = field(block, 'allowed-tools');
  for (const requiredTool of [
    'Bash(node:*)',
    'Bash(paseo:*)',
    'Read',
    'Write',
  ]) {
    assert.match(
      allowedTools,
      new RegExp(requiredTool.replace(/[()*]/g, '\\$&')),
    );
  }

  assert.match(block, /^metadata:\n(?:  .+\n)*  version: ["']0\.1\.0["']$/m);
});

test('evaluate skill has promoted top-level version matching metadata.version', async () => {
  const markdown = await readFile(evaluateSkillPath, 'utf8');
  const block = frontmatter(markdown);

  const topLevelVersion = field(block, 'version');
  const metaVersionMatch = block.match(
    /^metadata:\n(?:  .+\n)*?  version:\s*["']?([^"'\n]+)["']?/m,
  );
  assert.ok(metaVersionMatch, 'frontmatter should include metadata.version');
  const metaVersion = metaVersionMatch[1].trim().replace(/^["']|["']$/g, '');

  assert.match(topLevelVersion, /^\d+\.\d+\.\d+/);
  assert.equal(
    topLevelVersion,
    metaVersion,
    'top-level version must match metadata.version',
  );
});

test('evaluate skill has a useful argument-hint', async () => {
  const markdown = await readFile(evaluateSkillPath, 'utf8');
  const block = frontmatter(markdown);

  const hint = field(block, 'argument-hint');
  assert.match(
    hint,
    /\.md/,
    'argument-hint should reference a markdown artifact',
  );
  assert.match(hint, /--rubric/, 'argument-hint should mention --rubric');
});

test('skill instructions cover host orchestration responsibilities', async () => {
  const markdown = await readFile(refineSkillPath, 'utf8');

  for (const requiredPhrase of [
    'consensus-refine.mjs',
    'JSONL',
    '--prepare-parallel',
    '--fan-in',
    'Codex',
    'fail closed',
    'impasse',
  ]) {
    assert.match(markdown, new RegExp(requiredPhrase, 'i'));
  }
});
