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
});
