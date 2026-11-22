import { execFileSync } from 'node:child_process';
import { mkdtemp, realpath, rm, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { gitEnv } from '../../../../tests/helpers/git-env.mjs';
import type { WorkingTreeSnapshot } from './working-tree.js';
import {
  compareWorkingTrees,
  describeWorkingTreeChanges,
  snapshotWorkingTree,
} from './working-tree.js';

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(
    cleanup.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

const env = gitEnv({
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.invalid',
});

function git(cwd: string, ...args: string[]) {
  return execFileSync('git', args, { cwd, env, encoding: 'utf8' });
}

async function repo() {
  const dir = await realpath(
    await mkdtemp(path.join(os.tmpdir(), 'consensus-worktree-')),
  );
  cleanup.push(dir);
  git(dir, 'init', '-q', '-b', 'main');
  await writeFile(path.join(dir, 'clean.txt'), 'one\n');
  await writeFile(path.join(dir, 'dirty.txt'), 'base\n');
  await writeFile(path.join(dir, '.gitignore'), 'ignored.log\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'init');
  // Already modified before the turn starts.
  await writeFile(path.join(dir, 'dirty.txt'), 'edited once\n');
  return dir;
}

async function snapshot(dir: string, snapshotEnv = env) {
  const result = await snapshotWorkingTree(dir, { env: snapshotEnv });
  if (!result.ok) throw new Error(result.message);
  return result.snapshot;
}

async function changesAfter(
  dir: string,
  before: WorkingTreeSnapshot,
): Promise<string[]> {
  const changes = compareWorkingTrees(before, await snapshot(dir));
  return [...(changes.head_changed ? ['HEAD'] : []), ...changes.paths];
}

describe('working-tree snapshot', () => {
  it('reports no change for an untouched checkout, including ignored files', async () => {
    const dir = await repo();
    const before = await snapshot(dir);
    await writeFile(path.join(dir, 'ignored.log'), 'noise\n');

    expect(await changesAfter(dir, before)).toEqual([]);
  });

  it.each([
    [
      'a modified clean file',
      (dir: string) => writeFile(path.join(dir, 'clean.txt'), 'two\n'),
      ['clean.txt'],
    ],
    [
      'a second edit to an already-modified file',
      (dir: string) => writeFile(path.join(dir, 'dirty.txt'), 'edited twice\n'),
      ['dirty.txt'],
    ],
    [
      'a new untracked file',
      (dir: string) => writeFile(path.join(dir, 'new.txt'), 'hello\n'),
      ['new.txt'],
    ],
    [
      'a deleted file',
      (dir: string) => unlink(path.join(dir, 'clean.txt')),
      ['clean.txt'],
    ],
  ])('lists %s', async (_label, change, expected) => {
    const dir = await repo();
    const before = await snapshot(dir);
    await change(dir);

    expect(await changesAfter(dir, before)).toEqual(expected);
  });

  it.each([
    ['assume-unchanged', '--assume-unchanged'],
    ['skip-worktree', '--skip-worktree'],
  ])(
    'lists an edit to a tracked file marked %s, which git status hides',
    async (_label, flag) => {
      const dir = await repo();
      git(dir, 'update-index', flag, 'clean.txt');
      const before = await snapshot(dir);
      await writeFile(path.join(dir, 'clean.txt'), 'hidden edit\n');

      expect(git(dir, 'status', '--porcelain')).not.toContain('clean.txt');
      expect(await changesAfter(dir, before)).toEqual(['clean.txt']);
    },
  );

  it('reports a new commit as a HEAD change', async () => {
    const dir = await repo();
    const before = await snapshot(dir);
    git(dir, 'commit', '-q', '-am', 'peer commit');

    expect(await changesAfter(dir, before)).toEqual(['HEAD', 'dirty.txt']);
  });

  it('describes the changes as one list, HEAD first', async () => {
    const dir = await repo();
    const before = await snapshot(dir);
    git(dir, 'commit', '-q', '-am', 'peer commit');
    await writeFile(path.join(dir, 'new.txt'), 'hello\n');

    expect(
      describeWorkingTreeChanges(
        compareWorkingTrees(before, await snapshot(dir)),
      ),
    ).toBe('HEAD, dirty.txt, new.txt');
  });

  it('ignores an inherited GIT_DIR and snapshots the checkout at cwd', async () => {
    const dir = await repo();
    const other = await realpath(
      await mkdtemp(path.join(os.tmpdir(), 'consensus-worktree-other-')),
    );
    cleanup.push(other);
    git(other, 'init', '-q', '-b', 'main');
    await writeFile(path.join(other, 'other.txt'), 'other\n');
    git(other, 'add', '.');
    git(other, 'commit', '-q', '-m', 'other');
    const before = await snapshot(dir, {
      ...env,
      GIT_DIR: path.join(other, '.git'),
    });
    await writeFile(path.join(dir, 'clean.txt'), 'two\n');

    expect(before.root).toBe(dir);
    expect(await changesAfter(dir, before)).toEqual(['clean.txt']);
  });

  it('refuses a directory that is not a git checkout', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'consensus-not-git-'));
    cleanup.push(dir);
    // A ceiling keeps git from finding a repository above the temp dir.
    const result = await snapshotWorkingTree(dir, {
      env: { ...env, GIT_CEILING_DIRECTORIES: path.dirname(dir) },
    });

    expect(result).toMatchObject({ ok: false });
    expect(result.ok === false && result.message).toMatch(
      /not a git repository/i,
    );
  });
});
