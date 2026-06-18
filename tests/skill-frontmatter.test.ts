import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const skillPath = new URL(
  '../plugins/consensus/skills/refine/SKILL.md',
  import.meta.url,
);

function frontmatter(markdown: string) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  expect(match, 'SKILL.md should start with frontmatter').toBeTruthy();
  return match![1];
}

function field(block: string, name: string) {
  const match = block.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'));
  expect(match, `frontmatter should include ${name}`).toBeTruthy();
  return match![1].trim().replace(/^["']|["']$/g, '');
}

describe('skill-frontmatter', () => {
  it('refine skill frontmatter is portable and versioned', async () => {
    const markdown = await readFile(skillPath, 'utf8');
    const block = frontmatter(markdown);
    const name = field(block, 'name');

    expect(name).toBe('refine');
    expect(path.basename(path.dirname(skillPath.pathname))).toBe(name);
    expect(field(block, 'description').length > 40).toBeTruthy();
    expect(field(block, 'license')).toBe('MIT');
    expect(field(block, 'compatibility')).toMatch(/Agent Skills baseline/);

    const allowedTools = field(block, 'allowed-tools');
    for (const requiredTool of [
      'Bash(node:*)',
      'Bash(paseo:*)',
      'Read',
      'Write',
    ]) {
      expect(allowedTools).toMatch(
        new RegExp(requiredTool.replace(/[()*]/g, '\\$&')),
      );
    }

    expect(block).toMatch(/^metadata:\n(?:  .+\n)*  version: ["']0\.1\.0["']$/m);
  });

  it('skill instructions cover host orchestration responsibilities', async () => {
    const markdown = await readFile(skillPath, 'utf8');

    for (const requiredPhrase of [
      'consensus-refine.mjs',
      'JSONL',
      '--prepare-parallel',
      '--fan-in',
      'Codex',
      'fail closed',
      'impasse',
    ]) {
      expect(markdown).toMatch(new RegExp(requiredPhrase, 'i'));
    }
  });
});
