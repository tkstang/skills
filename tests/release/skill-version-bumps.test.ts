import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import { validateChangedSkillVersions } from '../../scripts/validate-skill-versions.js';
import { gitEnv } from '../helpers/git-env.mjs';

const execFile = promisify(execFileCallback);

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFile('git', args, { cwd: root, env: gitEnv() });
  return stdout;
}

function skillFrontmatter(name: string, version: string): string {
  return `---
name: ${name}
metadata:
  version: "${version}"
---
# ${name}
`;
}

const BASE_CHANGELOG = `# Changelog

## [Unreleased]

### Changed

- Seeded baseline entry.

## [0.1.0] - 2026-01-01

### Added

- Initial release.
`;

/** Write CHANGELOG.md with `entry` appended inside `## [Unreleased]`. */
async function writeChangelogEntry(root: string, entry: string) {
  await writeFile(
    path.join(root, 'CHANGELOG.md'),
    BASE_CHANGELOG.replace(
      '- Seeded baseline entry.\n',
      `- Seeded baseline entry.\n${entry}\n`,
    ),
  );
}

/** Init a temp git repo with one committed skill; returns root + base sha. */
async function initRepo(
  baseVersion = '1.0.0',
): Promise<{ root: string; baseSha: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'skill-version-'));
  await git(root, ['init', '-q']);
  await git(root, ['config', 'user.email', 'test@example.com']);
  await git(root, ['config', 'user.name', 'Test']);

  await mkdir(path.join(root, 'src/skills/demo/scripts'), { recursive: true });
  await writeFile(
    path.join(root, 'src/skills/demo/SKILL.md'),
    skillFrontmatter('demo', baseVersion),
  );
  await writeFile(
    path.join(root, 'src/skills/demo/scripts/run.mjs'),
    'export const value = 1;\n',
  );
  await writeFile(path.join(root, 'CHANGELOG.md'), BASE_CHANGELOG);

  await git(root, ['add', '-A']);
  await git(root, ['commit', '-q', '-m', 'base']);
  const baseSha = (await git(root, ['rev-parse', 'HEAD'])).trim();

  return { root, baseSha };
}

describe('validateChangedSkillVersions', () => {
  it('flags a script change without a version bump', async () => {
    const { root, baseSha } = await initRepo();

    await writeFile(
      path.join(root, 'src/skills/demo/scripts/run.mjs'),
      'export const value = 2;\n',
    );
    await git(root, ['commit', '-aqm', 'change script without bump']);

    const result = await validateChangedSkillVersions(root, {
      baseRef: baseSha,
    });

    expect(result.checkedSkillCount).toBe(1);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].skill).toBe('demo');
    expect(result.findings[0].message).toMatch(/must bump SKILL\.md version/);
  });

  it('accepts a directory change accompanied by a version bump', async () => {
    const { root, baseSha } = await initRepo();

    await writeFile(
      path.join(root, 'src/skills/demo/scripts/run.mjs'),
      'export const value = 2;\n',
    );
    await writeFile(
      path.join(root, 'src/skills/demo/SKILL.md'),
      skillFrontmatter('demo', '1.0.1'),
    );
    await writeChangelogEntry(root, '- `demo` 1.0.1 changes its script.');
    await git(root, ['commit', '-aqm', 'change script with bump']);

    const result = await validateChangedSkillVersions(root, {
      baseRef: baseSha,
    });

    expect(result.findings).toEqual([]);
  });

  it('flags a version that decreases', async () => {
    const { root, baseSha } = await initRepo();

    await writeFile(
      path.join(root, 'src/skills/demo/SKILL.md'),
      skillFrontmatter('demo', '0.9.0'),
    );
    await git(root, ['commit', '-aqm', 'lower version']);

    const result = await validateChangedSkillVersions(root, {
      baseRef: baseSha,
    });

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].message).toMatch(/version must increase/);
  });

  it('flags a deleted skill file without a version bump', async () => {
    const { root, baseSha } = await initRepo();

    await rm(path.join(root, 'src/skills/demo/scripts/run.mjs'));
    await git(root, ['commit', '-aqm', 'delete script without bump']);

    const result = await validateChangedSkillVersions(root, {
      baseRef: baseSha,
    });

    expect(result.checkedSkillCount).toBe(1);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].skill).toBe('demo');
    expect(result.findings[0].message).toMatch(/must bump SKILL\.md version/);
  });

  it('flags a downgrade from a release to a prerelease version', async () => {
    const { root, baseSha } = await initRepo();

    await writeFile(
      path.join(root, 'src/skills/demo/SKILL.md'),
      skillFrontmatter('demo', '1.0.0-alpha'),
    );
    await git(root, ['commit', '-aqm', 'downgrade to prerelease']);

    const result = await validateChangedSkillVersions(root, {
      baseRef: baseSha,
    });

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].message).toMatch(/stable semver/);
  });

  it('accepts a prerelease-to-release increase', async () => {
    const { root, baseSha } = await initRepo('1.0.0-alpha');

    await writeFile(
      path.join(root, 'src/skills/demo/SKILL.md'),
      skillFrontmatter('demo', '1.0.0'),
    );
    await writeChangelogEntry(root, '- `demo` 1.0.0 finalizes the release.');
    await git(root, ['commit', '-aqm', 'finalize release']);

    const result = await validateChangedSkillVersions(root, {
      baseRef: baseSha,
    });

    expect(result.findings).toEqual([]);
  });

  it('distinguishes a brand-new skill directory', async () => {
    const { root, baseSha } = await initRepo();

    await mkdir(path.join(root, 'src/skills/fresh'), { recursive: true });
    await writeFile(
      path.join(root, 'src/skills/fresh/SKILL.md'),
      skillFrontmatter('fresh', '1.0.0'),
    );
    await git(root, ['add', '-A']);
    await git(root, ['commit', '-qm', 'add new skill']);

    const result = await validateChangedSkillVersions(root, {
      baseRef: baseSha,
    });

    expect(result.findings).toEqual([]);
    expect(result.newOwners).toContain('fresh');
  });

  it('reports no findings when nothing changed', async () => {
    const { root, baseSha } = await initRepo();

    const result = await validateChangedSkillVersions(root, {
      baseRef: baseSha,
    });

    expect(result.checkedSkillCount).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it('requires a baseRef', async () => {
    const { root } = await initRepo();
    await expect(validateChangedSkillVersions(root, {})).rejects.toThrow(
      /baseRef/,
    );
  });

  it.each(['unstaged', 'staged', 'untracked'] as const)(
    'includes %s local edits in the affected-owner check',
    async (state) => {
      const { root, baseSha } = await initRepo();
      const target =
        state === 'untracked'
          ? path.join(root, 'src/skills/demo/scripts/extra.mjs')
          : path.join(root, 'src/skills/demo/scripts/run.mjs');
      await writeFile(target, 'export const value = 2;\n');
      if (state === 'staged') await git(root, ['add', '-A']);

      const result = await validateChangedSkillVersions(root, {
        baseRef: baseSha,
      });
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].skill).toBe('demo');
    },
  );

  it('propagates a shared-runtime change through declared closure', async () => {
    const { root, baseSha } = await initRepo();
    await mkdir(path.join(root, 'src/shared/runtime'), { recursive: true });
    await writeFile(
      path.join(root, 'src/shared/runtime/shared.ts'),
      'export const shared = 1;\n',
    );
    await git(root, ['add', '-A']);
    await git(root, ['commit', '-qm', 'add shared runtime']);
    const comparisonBase = (await git(root, ['rev-parse', 'HEAD'])).trim();
    await writeFile(
      path.join(root, 'src/shared/runtime/shared.ts'),
      'export const shared = 2;\n',
    );

    const result = await validateChangedSkillVersions(root, {
      baseRef: comparisonBase,
      declarations: [
        {
          owner: 'demo',
          source: 'src/skills/demo',
          allowedSourceRoots: ['src/shared/runtime'],
          targets: [
            {
              kind: 'standalone',
              name: 'demo',
              output: 'skills/demo',
            },
          ],
        },
      ],
    });
    expect(baseSha).not.toBe(comparisonBase);
    expect(result.findings[0].message).toMatch(/runtime closure changed/);
  });

  it('uses the higher valid historical field when legacy versions conflict', async () => {
    const { root, baseSha } = await initRepo();
    await writeFile(
      path.join(root, 'src/skills/demo/SKILL.md'),
      skillFrontmatter('demo', '1.0.1'),
    );
    const legacy = `---
name: demo
version: "1.1.0"
metadata:
  version: "1.2.0"
---
# demo
`;
    const gitExecFile = async (args: string[]) => {
      if (
        args[0] === 'show' &&
        args[1]?.endsWith(':src/skills/demo/SKILL.md')
      ) {
        return legacy;
      }
      return git(root, args);
    };
    const result = await validateChangedSkillVersions(root, {
      baseRef: baseSha,
      gitExecFile,
    });
    expect(result.findings[0].message).toMatch(/base 1\.2\.0, current 1\.0\.1/);
  });

  it('preserves version identity across a clean-break owner rename', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'skill-version-rename-'));
    await git(root, ['init', '-q']);
    await git(root, ['config', 'user.email', 'test@example.com']);
    await git(root, ['config', 'user.name', 'Test']);
    await mkdir(path.join(root, 'skills/old-demo'), { recursive: true });
    await writeFile(
      path.join(root, 'skills/old-demo/SKILL.md'),
      skillFrontmatter('old-demo', '2.0.0'),
    );
    await git(root, ['add', '-A']);
    await git(root, ['commit', '-qm', 'base']);
    const baseSha = (await git(root, ['rev-parse', 'HEAD'])).trim();

    await rm(path.join(root, 'skills/old-demo'), { recursive: true });
    await mkdir(path.join(root, 'src/skills/new-demo'), { recursive: true });
    await writeFile(
      path.join(root, 'src/skills/new-demo/SKILL.md'),
      skillFrontmatter('new-demo', '2.0.0'),
    );

    const result = await validateChangedSkillVersions(root, {
      baseRef: baseSha,
      legacyOwners: { 'old-demo': 'new-demo' },
    });
    expect(result.newOwners).not.toContain('new-demo');
    expect(result.findings[0].message).toMatch(/must bump/);
  });

  it('rejects ownerless generated skill output changes', async () => {
    const { root, baseSha } = await initRepo();
    await mkdir(path.join(root, 'skills/orphan'), { recursive: true });
    await writeFile(
      path.join(root, 'skills/orphan/runtime.mjs'),
      'export {};\n',
    );

    const result = await validateChangedSkillVersions(root, {
      baseRef: baseSha,
      declarations: [],
    });
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        skill: '<ownerless>',
        message: expect.stringMatching(/no declared owner/),
      }),
    );
  });

  it('rejects an unresolved explicit base', async () => {
    const { root } = await initRepo();
    await expect(
      validateChangedSkillVersions(root, { baseRef: 'missing-base' }),
    ).rejects.toThrow();
  });

  it('accepts a version bump accompanied by an Unreleased changelog entry', async () => {
    const { root, baseSha } = await initRepo();

    await writeFile(
      path.join(root, 'src/skills/demo/SKILL.md'),
      skillFrontmatter('demo', '1.1.0'),
    );
    await writeChangelogEntry(root, '- `demo` 1.1.0 does a new thing.');
    await git(root, ['commit', '-aqm', 'bump with changelog']);

    const result = await validateChangedSkillVersions(root, {
      baseRef: baseSha,
    });

    expect(result.bumpedSkills).toEqual(['demo']);
    expect(result.findings).toEqual([]);
  });

  it('flags a version bump with no changelog entry', async () => {
    const { root, baseSha } = await initRepo();

    await writeFile(
      path.join(root, 'src/skills/demo/SKILL.md'),
      skillFrontmatter('demo', '1.1.0'),
    );
    await git(root, ['commit', '-aqm', 'bump without changelog']);

    const result = await validateChangedSkillVersions(root, {
      baseRef: baseSha,
    });

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].skill).toBe('<changelog>');
    expect(result.findings[0].message).toMatch(
      /skill demo 1\.1\.0 changed version.*no new changelog entry/s,
    );
    expect(result.findings[0].message).toMatch(
      /add an entry under ## \[Unreleased\] in CHANGELOG\.md/,
    );
  });

  it('flags a bump whose new Unreleased entry does not name the skill and version', async () => {
    const { root, baseSha } = await initRepo();

    await writeFile(
      path.join(root, 'src/skills/demo/SKILL.md'),
      skillFrontmatter('demo', '1.1.0'),
    );
    await writeChangelogEntry(
      root,
      '- `demo` now does a new thing.\n- `other-skill` 1.1.0 unrelated.\n- `demo` 11.1.0 and 1.1.01 are not the bumped version.',
    );
    await git(root, ['commit', '-aqm', 'bump with entry missing version']);

    const result = await validateChangedSkillVersions(root, {
      baseRef: baseSha,
    });

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].skill).toBe('<changelog>');
    expect(result.findings[0].message).toMatch(
      /skill demo 1\.1\.0 changed version/,
    );
  });

  it('flags a changelog edit that lands outside the Unreleased section', async () => {
    const { root, baseSha } = await initRepo();

    await writeFile(
      path.join(root, 'src/skills/demo/SKILL.md'),
      skillFrontmatter('demo', '1.1.0'),
    );
    await writeFile(
      path.join(root, 'CHANGELOG.md'),
      BASE_CHANGELOG.replace(
        '- Initial release.\n',
        '- Initial release.\n- `demo` 1.1.0 filed against the released version.\n',
      ),
    );
    await git(root, ['commit', '-aqm', 'bump with misfiled changelog']);

    const result = await validateChangedSkillVersions(root, {
      baseRef: baseSha,
    });

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].skill).toBe('<changelog>');
  });

  it('requires no changelog entry when no version changed', async () => {
    const { root, baseSha } = await initRepo();

    await writeFile(path.join(root, 'README.md'), '# demo repo\n');
    await git(root, ['add', '-A']);
    await git(root, ['commit', '-qm', 'unrelated change']);

    const result = await validateChangedSkillVersions(root, {
      baseRef: baseSha,
    });

    expect(result.bumpedSkills).toEqual([]);
    expect(result.findings).toEqual([]);
  });

  it('flags a plugin release version bump with no changelog entry', async () => {
    const { root, baseSha } = await initRepo();
    const manifest = path.join(
      root,
      'plugins/consensus/.claude-plugin/plugin.json',
    );

    await mkdir(path.dirname(manifest), { recursive: true });
    await writeFile(
      manifest,
      `${JSON.stringify({ name: 'consensus', version: '0.1.0' }, null, 2)}\n`,
    );
    await git(root, ['add', '-A']);
    await git(root, ['commit', '-qm', 'add plugin manifest']);
    const withManifest = (await git(root, ['rev-parse', 'HEAD'])).trim();
    expect(withManifest).not.toBe(baseSha);

    await writeFile(
      manifest,
      `${JSON.stringify({ name: 'consensus', version: '0.2.0' }, null, 2)}\n`,
    );
    await git(root, ['commit', '-aqm', 'bump plugin release']);

    const result = await validateChangedSkillVersions(root, {
      baseRef: withManifest,
    });

    expect(result.bumpedPlugins).toEqual(['consensus']);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].skill).toBe('<changelog>');
    expect(result.findings[0].message).toMatch(
      /plugin consensus 0\.2\.0 changed version/,
    );
  });

  it('accepts a release that moves Unreleased entries under a new version heading', async () => {
    const { root } = await initRepo();
    const manifest = path.join(
      root,
      'plugins/consensus/.claude-plugin/plugin.json',
    );

    await mkdir(path.dirname(manifest), { recursive: true });
    await writeFile(
      manifest,
      `${JSON.stringify({ name: 'consensus', version: '0.1.0' }, null, 2)}\n`,
    );
    await writeFile(path.join(root, 'CHANGELOG.md'), BASE_CHANGELOG);
    await git(root, ['add', '-A']);
    await git(root, ['commit', '-qm', 'add plugin manifest and changelog']);
    const withManifest = (await git(root, ['rev-parse', 'HEAD'])).trim();

    await writeFile(
      manifest,
      `${JSON.stringify({ name: 'consensus', version: '0.2.0' }, null, 2)}\n`,
    );
    await writeFile(
      path.join(root, 'CHANGELOG.md'),
      `# Changelog

## [Unreleased]

## [0.2.0] - 2026-09-16

### Changed

- Seeded baseline entry.

## [0.1.0] - 2026-01-01

### Added

- Initial release.
`,
    );
    await git(root, ['commit', '-aqm', 'release consensus 0.2.0']);

    const result = await validateChangedSkillVersions(root, {
      baseRef: withManifest,
    });

    expect(result.bumpedPlugins).toEqual(['consensus']);
    expect(result.findings).toEqual([]);
  });
});
