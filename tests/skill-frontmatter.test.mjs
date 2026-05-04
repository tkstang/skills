import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const skillPath = new URL('../plugins/consensus/skills/consensus-refine/SKILL.md', import.meta.url);

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

test('consensus-refine skill frontmatter is portable and versioned', async () => {
  const markdown = await readFile(skillPath, 'utf8');
  const block = frontmatter(markdown);
  const name = field(block, 'name');

  assert.equal(name, 'consensus-refine');
  assert.equal(path.basename(path.dirname(skillPath.pathname)), name);
  assert.ok(field(block, 'description').length > 40);
  assert.equal(field(block, 'license'), 'MIT');
  assert.match(field(block, 'compatibility'), /Agent Skills baseline/);

  const allowedTools = field(block, 'allowed-tools');
  for (const requiredTool of ['Bash(node:*)', 'Bash(paseo:*)', 'Read', 'Write']) {
    assert.match(allowedTools, new RegExp(requiredTool.replace(/[()*]/g, '\\$&')));
  }

  assert.match(block, /^metadata:\n(?:  .+\n)*  version: ["']0\.1\.0["']$/m);
});

test('skill instructions cover host orchestration responsibilities', async () => {
  const markdown = await readFile(skillPath, 'utf8');

  for (const requiredPhrase of [
    'consensus-refine.mjs',
    'JSONL',
    '--prepare-parallel',
    '--fan-in',
    'Codex',
    'fail closed',
    'impasse'
  ]) {
    assert.match(markdown, new RegExp(requiredPhrase, 'i'));
  }
});
