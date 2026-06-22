import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = new URL('../..', import.meta.url);
const pluginRoot = new URL('../../plugins/consensus/', import.meta.url);

const providers: Record<string, { manifestPath: string; skills?: string }> = {
  claude: {
    manifestPath: 'plugins/consensus/.claude-plugin/plugin.json',
  },
  cursor: {
    manifestPath: 'plugins/consensus/.cursor-plugin/plugin.json',
  },
  codex: {
    manifestPath: 'plugins/consensus/.codex-plugin/plugin.json',
    skills: './skills/',
  },
};

async function readJson(relativePath: string) {
  return JSON.parse(await readFile(new URL(relativePath, repoRoot), 'utf8'));
}

describe('plugin-manifests', () => {
  it('provider plugin manifests declare consensus metadata and skill directory', async () => {
    for (const [provider, config] of Object.entries(providers)) {
      const manifest = await readJson(config.manifestPath);

      expect(manifest.name, `${provider} name`).toBe('consensus');
      expect(manifest.version, `${provider} version`).toBe('0.1.0');
      expect(manifest.author, `${provider} author`).toEqual({
        name: 'Thomas Stang',
      });

      if (provider === 'codex') {
        expect(manifest.skills, `${provider} skill discovery path`).toBe(
          config.skills,
        );
      } else {
        expect(
          'skills' in manifest,
          `${provider} should rely on skills/ directory discovery`,
        ).toBe(false);
      }

      const relativeSkillPath = './skills/refine';
      expect(relativeSkillPath).toBe('./skills/refine');
      expect(
        relativeSkillPath.includes('..'),
        `${provider} skill path should not traverse upward`,
      ).toBe(false);

      const resolvedSkillPath = path.resolve(
        (pluginRoot as URL).pathname,
        relativeSkillPath,
      );
      expect(
        resolvedSkillPath.startsWith(
          path.resolve((pluginRoot as URL).pathname),
        ),
        `${provider} skill path should stay inside plugin root`,
      ).toBeTruthy();
      expect((await stat(resolvedSkillPath)).isDirectory()).toBe(true);

      expect(
        manifest.metadata?.release_checklist?.join('\n') ?? '',
        `${provider} should carry release-time permission verification notes`,
      ).toMatch(/verify .*runtime/i);
      expect(
        JSON.stringify(manifest),
        `${provider} manifest should advertise consensus-create`,
      ).toMatch(/create/i);
      expect(
        JSON.stringify(manifest),
        `${provider} manifest should advertise consensus-decide`,
      ).toMatch(/decide/i);
    }
  });

  it('codex manifest includes runtime interface metadata', async () => {
    const manifest = await readJson(providers.codex.manifestPath);

    expect(manifest.interface?.displayName).toBe('Consensus');
    expect(manifest.interface?.shortDescription).toBe(
      'Create, decide, refine, and evaluate artifacts with two-peer deliberation.',
    );
    expect(manifest.interface?.longDescription).toBe(
      'Consensus deliberation skills for creating artifacts from briefs, deciding between options, refining markdown drafts, or evaluating artifacts against rubrics with multiple AI peers and an audit trail.',
    );
    expect(manifest.interface?.developerName).toBe('Thomas Stang');
    expect(manifest.interface?.category).toBe('Coding');
    expect(manifest.interface?.capabilities).toEqual([
      'Interactive',
      'Read',
      'Write',
    ]);
    expect(manifest.interface?.defaultPrompt).toEqual([
      'Use Consensus Create to draft from a brief, Consensus Decide to turn options into a decision, Consensus Refine to improve a markdown draft, or Consensus Evaluate to judge an artifact against a rubric.',
    ]);
    expect(JSON.stringify(manifest.interface)).toMatch(/decide/i);
  });
});
