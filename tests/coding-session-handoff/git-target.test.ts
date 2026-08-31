import { execFile } from 'node:child_process';
import {
  mkdtemp,
  mkdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, test } from 'vitest';

import {
  GitTargetError,
  inspectWorktree,
  revalidateHandoffTarget,
  validateHandoffTarget,
  type GitTargetDependencies,
} from '../../src/transcript/coding-session-handoff/git-target.js';

const execFileAsync = promisify(execFile);
const cleanupRoots: string[] = [];

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
  });
  return stdout.trim();
}

async function fixture(): Promise<{
  root: string;
  source: string;
  target: string;
}> {
  const root = await mkdtemp(join(tmpdir(), 'handoff-git-target-'));
  cleanupRoots.push(root);
  const source = join(root, 'source');
  const target = join(root, 'target');
  await mkdir(source);
  await git(source, ['init']);
  await git(source, ['config', 'user.email', 'test@example.com']);
  await git(source, ['config', 'user.name', 'Test']);
  await writeFile(join(source, 'README.md'), 'fixture\n');
  await git(source, ['add', 'README.md']);
  await git(source, ['commit', '-m', 'fixture']);
  await git(source, ['worktree', 'add', '-b', 'target', target]);
  return { root, source, target };
}

afterEach(async () => {
  await Promise.all(
    cleanupRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('Git worktree target evidence', () => {
  test('rejects missing paths and existing non-worktrees', async () => {
    const { root } = await fixture();
    const ordinaryDirectory = join(root, 'ordinary');
    await mkdir(ordinaryDirectory);

    await expect(inspectWorktree(join(root, 'missing'))).rejects.toMatchObject({
      code: 'path-missing',
    });
    await expect(inspectWorktree(ordinaryDirectory)).rejects.toMatchObject({
      code: 'not-worktree',
    });
  });

  test('accepts registered source/target roots with exact shared common Git directory', async () => {
    const { source, target } = await fixture();

    const evidence = await validateHandoffTarget(source, target);

    expect(evidence.source.commonGitDir).toBe(evidence.target.commonGitDir);
    expect(evidence.source.worktreeRoot).toBe(evidence.source.canonicalPath);
    expect(evidence.target.worktreeRoot).toBe(evidence.target.canonicalPath);
    expect(evidence.source.dirty).toBe(false);
  });

  test('ignores an unrelated stale registered sibling while proving the requested roots', async () => {
    const { root, source, target } = await fixture();
    const stale = join(root, 'stale-sibling');
    await git(source, ['worktree', 'add', '-b', 'stale-sibling', stale]);
    await rm(stale, { recursive: true, force: true });

    const registered = await git(source, ['worktree', 'list', '--porcelain']);
    expect(registered).toContain('stale-sibling');
    expect(registered).toContain('prunable');

    await expect(validateHandoffTarget(source, target)).resolves.toMatchObject({
      source: { canonicalPath: await realpath(source) },
      target: { canonicalPath: await realpath(target) },
    });
  });

  test('preserves a newline-bearing registered worktree path from NUL-delimited porcelain', async () => {
    const { root, source } = await fixture();
    const newlineTarget = join(root, 'target\nwith-newline');
    await git(source, [
      'worktree',
      'add',
      '-b',
      'newline-target',
      newlineTarget,
    ]);

    const evidence = await inspectWorktree(newlineTarget);

    expect(evidence.requestedPath).toBe(newlineTarget);
    expect(evidence.canonicalPath).toBe(await realpath(newlineTarget));
    expect(evidence.worktreeRoot).toBe(await realpath(newlineTarget));
  });

  test('accepts a symlink alias only when it resolves to the registered worktree root', async () => {
    const { root, source, target } = await fixture();
    const alias = join(root, 'target-alias');
    await symlink(target, alias);

    const evidence = await validateHandoffTarget(source, alias);

    expect(evidence.target.requestedPath).toBe(alias);
    expect(evidence.target.canonicalPath).toBe(await realpath(target));
  });

  test('rejects separate clones even when their remotes refer to the same repository', async () => {
    const { root, source } = await fixture();
    const clone = join(root, 'clone');
    await execFileAsync('git', ['clone', source, clone]);

    await expect(validateHandoffTarget(source, clone)).rejects.toMatchObject({
      code: 'repository-mismatch',
    });
  });

  test('preserves detached HEAD as a null branch', async () => {
    const { target } = await fixture();
    await git(target, ['checkout', '--detach']);

    const evidence = await inspectWorktree(target);

    expect(evidence.branch).toBeNull();
    expect(evidence.head).toMatch(/^[0-9a-f]{40,64}$/u);
  });

  test('refuses a dirty source but allows and fingerprints a dirty target without filenames', async () => {
    const { source, target } = await fixture();
    await writeFile(join(source, 'source-secret-name.txt'), 'dirty\n');
    await expect(validateHandoffTarget(source, target)).rejects.toMatchObject({
      code: 'source-dirty',
      role: 'source',
    });
    await rm(join(source, 'source-secret-name.txt'));

    await writeFile(join(target, 'target-secret-name.txt'), 'dirty\n');
    const evidence = await validateHandoffTarget(source, target);
    expect(evidence.target.dirty).toBe(true);
    expect(evidence.target.statusFingerprint).toMatch(/^[0-9a-f]{64}$/u);
    expect(JSON.stringify(evidence.target)).not.toContain(
      'target-secret-name.txt',
    );
  });

  test('rejects oversized status output and timeouts with typed path-free errors', async () => {
    const oversizedDeps: GitTargetDependencies = {
      realpath: async (path) => path,
      execFile: async (_file, args) => {
        if (args.includes('status')) {
          throw Object.assign(new Error('/private/repo/secret.txt'), {
            code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER',
          });
        }
        if (args.includes('--show-toplevel')) {
          return { stdout: '/private/repo\n', stderr: '' };
        }
        if (args.includes('--git-common-dir')) {
          return { stdout: '/private/repo/.git\n', stderr: '' };
        }
        if (args.includes('worktree')) {
          return {
            stdout: `worktree /private/repo\0HEAD ${'a'.repeat(40)}\0branch refs/heads/main\0\0`,
            stderr: '',
          };
        }
        if (args.includes('--abbrev-ref')) {
          return { stdout: 'main\n', stderr: '' };
        }
        return { stdout: `${'a'.repeat(40)}\n`, stderr: '' };
      },
    };
    let oversized: unknown;
    try {
      await inspectWorktree('/private/repo', { deps: oversizedDeps });
    } catch (error) {
      oversized = error;
    }
    expect(oversized).toBeInstanceOf(GitTargetError);
    expect(oversized).toMatchObject({ code: 'status-oversized' });
    expect(JSON.stringify(oversized)).not.toContain('/private/repo');

    const timeoutDeps: GitTargetDependencies = {
      realpath: async (path) => path,
      execFile: async () => {
        throw Object.assign(new Error('/private/repo/secret.txt'), {
          code: 'ETIMEDOUT',
        });
      },
    };
    await expect(
      inspectWorktree('/private/repo', { deps: timeoutDeps }),
    ).rejects.toMatchObject({
      code: 'git-timeout',
    });
  });

  test('detects exact evidence drift before execution', async () => {
    const { source, target } = await fixture();
    const expected = await validateHandoffTarget(source, target);
    await writeFile(join(target, 'drift.txt'), 'changed\n');

    await expect(revalidateHandoffTarget(expected)).rejects.toMatchObject({
      code: 'git-evidence-drift',
      role: 'target',
    });
  });
});
