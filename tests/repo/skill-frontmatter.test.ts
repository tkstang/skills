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
const planSkillPath = new URL(
  '../../plugins/consensus/skills/plan/SKILL.md',
  import.meta.url,
);
const panelSkillPath = new URL(
  '../../plugins/consensus/skills/panel/SKILL.md',
  import.meta.url,
);
const collaborationSkillPath = new URL(
  '../../skills/session-observer-collab/SKILL.md',
  import.meta.url,
);
const bumpVersionPath = new URL(
  '../../scripts/bump-version.mjs',
  import.meta.url,
);
const skillPaths = [
  refineSkillPath,
  evaluateSkillPath,
  createSkillPath,
  decideSkillPath,
  planSkillPath,
  panelSkillPath,
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

      expect([
        'refine',
        'evaluate',
        'create',
        'decide',
        'plan',
        'panel',
      ]).toContain(name);
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

  it('plan skill has promoted top-level version matching metadata.version', async () => {
    const markdown = await readFile(planSkillPath, 'utf8');
    const block = frontmatter(markdown);

    const topLevelVersion = field(block, 'version');
    const metaVersion = metadataVersion(block);

    expect(topLevelVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(
      topLevelVersion,
      'top-level version must match metadata.version',
    ).toBe(metaVersion);
  });

  it('plan skill has a useful argument-hint', async () => {
    const markdown = await readFile(planSkillPath, 'utf8');
    const block = frontmatter(markdown);

    const hint = field(block, 'argument-hint');
    expect(hint, 'argument-hint should mention inline goals').toMatch(/--goal/);
    expect(hint, 'argument-hint should mention inline constraints').toMatch(
      /--constraints/,
    );
  });

  it('panel skill frontmatter is portable and versioned', async () => {
    const markdown = await readFile(panelSkillPath, 'utf8');
    const block = frontmatter(markdown);
    const name = field(block, 'name');

    expect(name).toBe('panel');
    expect(path.basename(path.dirname(panelSkillPath.pathname))).toBe(name);
    expect(field(block, 'description')).toMatch(/multi-peer|panel/i);
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

  it('panel skill has a useful argument-hint', async () => {
    const markdown = await readFile(panelSkillPath, 'utf8');
    const block = frontmatter(markdown);

    const hint = field(block, 'argument-hint');
    expect(hint, 'argument-hint should mention inline questions').toMatch(
      /--question/,
    );
    expect(hint, 'argument-hint should mention question files').toMatch(
      /--question-file/,
    );
    expect(hint, 'argument-hint should mention panel selection').toMatch(
      /--panelists/,
    );
  });

  it('panel skill documents moderation, invocation, and output responsibilities', async () => {
    const markdown = await readFile(panelSkillPath, 'utf8');

    for (const requiredPhrase of [
      'neutral moderator',
      'sensitive',
      'private context',
      'consensus-panel.mjs',
      '--panelists',
      '--panel-size',
      'consensus config',
      'JSONL',
      'Output Contract',
      'When NOT to Use',
      'Success Criteria',
      'BL-260701-add-multi-round-panel',
    ]) {
      expect(markdown).toMatch(new RegExp(requiredPhrase, 'i'));
    }
  });

  it('standalone and plugin skills are included in version bump tooling', async () => {
    const script = await readFile(bumpVersionPath, 'utf8');

    expect(script).toMatch(/plugins\/consensus\/skills\/panel\/SKILL\.md/);
    expect(script).toMatch(/skills\/session-observer-collab\/SKILL\.md/);
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

  it('session observer collaboration skill is a public, versioned canonical skill', async () => {
    const markdown = await readFile(collaborationSkillPath, 'utf8');
    const block = frontmatter(markdown);

    expect(field(block, 'name')).toBe('session-observer-collab');
    expect(path.basename(path.dirname(collaborationSkillPath.pathname))).toBe(
      'session-observer-collab',
    );
    expect(field(block, 'description').length > 40).toBeTruthy();
    expect(field(block, 'license')).toBe('MIT');
    expect(field(block, 'compatibility')).toMatch(/Agent Skills baseline/);
    expect(field(block, 'compatibility')).toMatch(/Node\.js 22/);
    expect(field(block, 'version')).toMatch(/^\d+\.\d+\.\d+$/);
    expect(metadataVersion(block)).toBe(field(block, 'version'));
    expect(block).not.toMatch(/^\s*internal:\s*true\s*$/m);
    expect(block).not.toMatch(/^\s{2}internal:\s*true\s*$/m);
  });

  it('session observer collaboration routes to exactly one runtime reference', async () => {
    const markdown = await readFile(collaborationSkillPath, 'utf8');

    for (const runtime of ['claude-code', 'codex', 'cursor']) {
      expect(markdown).toContain(`references/runtime-${runtime}`);
    }
    expect(markdown).toMatch(/load exactly one matching reference/i);
    expect(markdown).not.toMatch(/\bTODO\b|\bFIXME\b|<placeholder>/i);
  });
});
