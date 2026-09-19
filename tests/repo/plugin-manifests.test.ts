import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = new URL('../..', import.meta.url);

const plugins = [
  {
    name: 'consensus',
    version: '0.2.0',
    description:
      'Consensus create, decide, plan, refine, evaluate, review, panel, phone-a-friend, observer, and observer-collab skills for deliberation, bounded review, consultation, and observation.',
    skills: [
      'create',
      'decide',
      'evaluate',
      'observer',
      'observer-collab',
      'panel',
      'phone-a-friend',
      'plan',
      'refine',
      'review',
    ],
    permissionDeclaration: 'verified',
    permissionEvidence: /verified .*2026-06-20/i,
  },
  {
    name: 'session',
    version: '0.3.0',
    description:
      'Session messaging, retrospective, handoff, transcript export, and destination-fork guidance for coding-agent conversations.',
    skills: [
      'export-transcript',
      'fork-to-destination',
      'handoff',
      'messaging',
      'retro',
    ],
    permissionDeclaration: 'unverified',
    permissionEvidence: /isolated export execution.*live provider.*unverified/i,
  },
] as const;

const providers = ['claude', 'cursor', 'codex'] as const;

async function readJson(relativePath: string) {
  return JSON.parse(await readFile(new URL(relativePath, repoRoot), 'utf8'));
}

describe('plugin-manifests', () => {
  it('declares both complete plugins across every provider surface', async () => {
    for (const plugin of plugins) {
      const pluginRoot = new URL(
        `../../plugins/${plugin.name}/`,
        import.meta.url,
      );
      expect(
        (
          await readdir(new URL('skills/', pluginRoot), {
            withFileTypes: true,
          })
        )
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .toSorted(),
      ).toEqual([...plugin.skills]);

      for (const provider of providers) {
        const manifestPath = `plugins/${plugin.name}/.${provider}-plugin/plugin.json`;
        const manifest = await readJson(manifestPath);
        expect(manifest.name, `${plugin.name}/${provider} name`).toBe(
          plugin.name,
        );
        expect(manifest.version, `${plugin.name}/${provider} version`).toBe(
          plugin.version,
        );
        expect(manifest.author, `${plugin.name}/${provider} author`).toEqual({
          name: 'Thomas Stang',
        });
        expect(manifest.description).toBe(plugin.description);

        if (provider === 'codex') {
          expect(manifest.skills).toBe('./skills/');
        } else {
          expect('skills' in manifest).toBe(false);
        }

        for (const skill of plugin.skills) {
          const relativeSkillPath = `./skills/${skill}`;
          expect(relativeSkillPath.includes('..')).toBe(false);
          const resolvedSkillPath = path.resolve(
            (pluginRoot as URL).pathname,
            relativeSkillPath,
          );
          expect(
            resolvedSkillPath.startsWith(
              path.resolve((pluginRoot as URL).pathname),
            ),
          ).toBe(true);
          expect((await stat(resolvedSkillPath)).isDirectory()).toBe(true);
        }

        expect(manifest.metadata?.permission_declaration).toBe(
          plugin.permissionDeclaration,
        );
        expect(
          manifest.metadata?.permission_verification?.join('\n') ?? '',
        ).toMatch(plugin.permissionEvidence);
        expect(JSON.stringify(manifest.metadata)).not.toMatch(
          /provisional|before v0\.1 tagging|release_checklist/i,
        );
      }
    }
  });

  it('codex manifests include plugin-specific runtime interface metadata', async () => {
    const consensus = await readJson(
      'plugins/consensus/.codex-plugin/plugin.json',
    );
    expect(consensus.interface?.displayName).toBe('Consensus');
    expect(JSON.stringify(consensus.interface)).toMatch(/decide/i);
    expect(JSON.stringify(consensus.interface)).toMatch(/phone-a-friend/i);
    expect(JSON.stringify(consensus.interface)).toMatch(/review/i);
    expect(JSON.stringify(consensus.interface)).toMatch(/observer-collab/i);

    const session = await readJson('plugins/session/.codex-plugin/plugin.json');
    expect(session.interface?.displayName).toBe('Session');
    expect(session.interface?.developerName).toBe('Thomas Stang');
    expect(session.interface?.category).toBe('Coding');
    expect(session.interface?.capabilities).toEqual([
      'Interactive',
      'Read',
      'Write',
    ]);
    expect(JSON.stringify(session.interface)).toMatch(/export/i);
    expect(JSON.stringify(session.interface)).toMatch(/fork/i);
  });
});
