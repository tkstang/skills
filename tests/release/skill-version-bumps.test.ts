import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

// @ts-expect-error No type declarations for script helpers; importing for runtime behavior.
import { validateChangedSkillVersions } from '../../scripts/validate-skill-versions.mjs';

const execFile = promisify(execFileCallback);

// Strip inherited git env vars (set when tests run inside a git hook) so the
// temp-repo git commands resolve the temp repo via cwd, not the ambient repo.
function gitEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_COMMON_DIR',
    'GIT_PREFIX',
    'GIT_NAMESPACE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  ]) {
    delete env[key];
  }
  return env;
}

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFile('git', args, { cwd: root, env: gitEnv() });
  return stdout;
}

function skillFrontmatter(name: string, version: string): string {
  return `---
name: ${name}
version: "${version}"
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

  await mkdir(path.join(root, 'skills/demo/scripts'), { recursive: true });
  await writeFile(
    path.join(root, 'skills/demo/SKILL.md'),
    skillFrontmatter('demo', baseVersion),
  );
  await writeFile(
    path.join(root, 'skills/demo/scripts/run.mjs'),
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
      path.join(root, 'skills/demo/scripts/run.mjs'),
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
      path.join(root, 'skills/demo/scripts/run.mjs'),
      'export const value = 2;\n',
    );
    await writeFile(
      path.join(root, 'skills/demo/SKILL.md'),
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
      path.join(root, 'skills/demo/SKILL.md'),
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

    await rm(path.join(root, 'skills/demo/scripts/run.mjs'));
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
      path.join(root, 'skills/demo/SKILL.md'),
      skillFrontmatter('demo', '1.0.0-alpha'),
    );
    await git(root, ['commit', '-aqm', 'downgrade to prerelease']);

    const result = await validateChangedSkillVersions(root, {
      baseRef: baseSha,
    });

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].message).toMatch(/version must increase/);
  });

  it('accepts a prerelease-to-release increase', async () => {
    const { root, baseSha } = await initRepo('1.0.0-alpha');

    await writeFile(
      path.join(root, 'skills/demo/SKILL.md'),
      skillFrontmatter('demo', '1.0.0'),
    );
    await git(root, ['commit', '-aqm', 'finalize release']);

    const result = await validateChangedSkillVersions(root, {
      baseRef: baseSha,
    });

    expect(result.findings).toEqual([]);
  });

  it('skips a brand-new skill directory', async () => {
    const { root, baseSha } = await initRepo();

    await mkdir(path.join(root, 'skills/fresh'), { recursive: true });
    await writeFile(
      path.join(root, 'skills/fresh/SKILL.md'),
      skillFrontmatter('fresh', '1.0.0'),
    );
    await git(root, ['add', '-A']);
    await git(root, ['commit', '-qm', 'add new skill']);

    const result = await validateChangedSkillVersions(root, {
      baseRef: baseSha,
    });

    expect(result.findings).toEqual([]);
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
    await expect(
      validateChangedSkillVersions(root, {}),
    ).rejects.toThrow(/baseRef/);
  });
});
