import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const refineSkillPath = new URL(
  '../../plugins/consensus/skills/refine/SKILL.md',
  import.meta.url,
);
const evaluateSkillPath = new URL(
  '../../plugins/consensus/skills/evaluate/SKILL.md',
  import.meta.url,
);
const createSkillPath = new URL(
  '../../plugins/consensus/skills/create/SKILL.md',
  import.meta.url,
);
const decideSkillPath = new URL(
  '../../plugins/consensus/skills/decide/SKILL.md',
  import.meta.url,
);
const skillPaths = [
  refineSkillPath,
  evaluateSkillPath,
  createSkillPath,
  decideSkillPath,
];

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

function metadataVersion(block: string) {
  const match = block.match(
    /^metadata:\n(?:  .+\n)*?  version:\s*["']?([^"'\n]+)["']?/m,
  );
  expect(match, 'frontmatter should include metadata.version').toBeTruthy();
  return match![1].trim().replace(/^["']|["']$/g, '');
}

describe('skill-frontmatter', () => {
  it.each(skillPaths)(
    '%s frontmatter is portable, provider-cli aware, and versioned',
    async (skillPath) => {
      const markdown = await readFile(skillPath, 'utf8');
      const block = frontmatter(markdown);
      const name = field(block, 'name');

      expect(['refine', 'evaluate', 'create', 'decide']).toContain(name);
      expect(path.basename(path.dirname(skillPath.pathname))).toBe(name);
      expect(field(block, 'description').length > 40).toBeTruthy();
      expect(field(block, 'license')).toBe('MIT');
      expect(field(block, 'compatibility')).toMatch(/Agent Skills baseline/);
      expect(field(block, 'compatibility')).toMatch(/consensus CLI/);

      const allowedTools = field(block, 'allowed-tools');
      for (const requiredTool of [
        'Bash(node:*)',
        'Bash(consensus:*)',
        'Read',
        'Write',
      ]) {
        expect(allowedTools).toMatch(
          new RegExp(requiredTool.replace(/[()*]/g, '\\$&')),
        );
      }

      expect(metadataVersion(block)).toBe(field(block, 'version'));
    },
  );

  it('refine skill has promoted top-level version matching metadata.version', async () => {
    const markdown = await readFile(refineSkillPath, 'utf8');
    const block = frontmatter(markdown);

    const topLevelVersion = field(block, 'version');
    const metaVersion = metadataVersion(block);

    expect(topLevelVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(
      topLevelVersion,
      'top-level version must match metadata.version',
    ).toBe(metaVersion);
  });

  it('refine skill has a useful argument-hint', async () => {
    const markdown = await readFile(refineSkillPath, 'utf8');
    const block = frontmatter(markdown);

    const hint = field(block, 'argument-hint');
    expect(hint, 'argument-hint should reference a markdown input').toMatch(
      /\.md/,
    );
    expect(hint, 'argument-hint should mention the optional goal').toMatch(
      /goal/i,
    );
  });

  it('evaluate skill frontmatter is portable and versioned', async () => {
    const markdown = await readFile(evaluateSkillPath, 'utf8');
    const block = frontmatter(markdown);
    const name = field(block, 'name');

    expect(name).toBe('evaluate');
    expect(path.basename(path.dirname(evaluateSkillPath.pathname))).toBe(name);
    expect(field(block, 'description').length > 40).toBeTruthy();
    expect(field(block, 'license')).toBe('MIT');
    expect(field(block, 'compatibility')).toMatch(/Agent Skills baseline/);
    expect(field(block, 'compatibility')).toMatch(/consensus CLI/);

    const allowedTools = field(block, 'allowed-tools');
    for (const requiredTool of [
      'Bash(node:*)',
      'Bash(consensus:*)',
      'Read',
      'Write',
    ]) {
      expect(allowedTools).toMatch(
        new RegExp(requiredTool.replace(/[()*]/g, '\\$&')),
      );
    }

    expect(metadataVersion(block)).toBe(field(block, 'version'));
  });

  it('evaluate skill has promoted top-level version matching metadata.version', async () => {
    const markdown = await readFile(evaluateSkillPath, 'utf8');
    const block = frontmatter(markdown);

    const topLevelVersion = field(block, 'version');
    const metaVersion = metadataVersion(block);

    expect(topLevelVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(
      topLevelVersion,
      'top-level version must match metadata.version',
    ).toBe(metaVersion);
  });

  it('evaluate skill has a useful argument-hint', async () => {
    const markdown = await readFile(evaluateSkillPath, 'utf8');
    const block = frontmatter(markdown);

    const hint = field(block, 'argument-hint');
    expect(hint, 'argument-hint should reference a markdown artifact').toMatch(
      /\.md/,
    );
    expect(hint, 'argument-hint should mention --rubric').toMatch(/--rubric/);
  });

  it('create skill has promoted top-level version matching metadata.version', async () => {
    const markdown = await readFile(createSkillPath, 'utf8');
    const block = frontmatter(markdown);

    const topLevelVersion = field(block, 'version');
    const metaVersion = metadataVersion(block);

    expect(topLevelVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(
      topLevelVersion,
      'top-level version must match metadata.version',
    ).toBe(metaVersion);
  });

  it('create skill has a useful argument-hint', async () => {
    const markdown = await readFile(createSkillPath, 'utf8');
    const block = frontmatter(markdown);

    const hint = field(block, 'argument-hint');
    expect(hint, 'argument-hint should mention inline briefs').toMatch(
      /--brief/,
    );
    expect(hint, 'argument-hint should mention file briefs').toMatch(
      /--brief-file/,
    );
  });

  it('decide skill has promoted top-level version matching metadata.version', async () => {
    const markdown = await readFile(decideSkillPath, 'utf8');
    const block = frontmatter(markdown);

    const topLevelVersion = field(block, 'version');
    const metaVersion = metadataVersion(block);

    expect(topLevelVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(
      topLevelVersion,
      'top-level version must match metadata.version',
    ).toBe(metaVersion);
  });

  it('decide skill has a useful argument-hint', async () => {
    const markdown = await readFile(decideSkillPath, 'utf8');
    const block = frontmatter(markdown);

    const hint = field(block, 'argument-hint');
    expect(hint, 'argument-hint should mention options files').toMatch(
      /--options/,
    );
    expect(hint, 'argument-hint should reference markdown options').toMatch(
      /\.md/,
    );
  });

  it('skill instructions cover host orchestration responsibilities', async () => {
    const markdown = await readFile(skillPaths[0], 'utf8');

    for (const requiredPhrase of [
      'consensus-refine.mjs',
      'JSONL',
      '--prepare-parallel',
      '--fan-in',
      'Codex',
      'fail closed',
      'impasse',
      'provider inventory',
      'consensus preflight',
    ]) {
      expect(markdown).toMatch(new RegExp(requiredPhrase, 'i'));
    }
  });
});
