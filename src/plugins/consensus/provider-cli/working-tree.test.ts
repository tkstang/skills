import { execFileSync } from 'node:child_process';
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  unlink,
  utimes,
  writeFile,
} from 'node:fs/promises';
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

async function scratchDir() {
  const dir = await realpath(
    await mkdtemp(path.join(os.tmpdir(), 'consensus-worktree-scratch-')),
  );
  cleanup.push(dir);
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

  it('lists a mode change even when the repository ignores file modes', async () => {
    const dir = await repo();
    git(dir, 'config', 'core.fileMode', 'false');
    const before = await snapshot(dir);
    await chmod(path.join(dir, 'clean.txt'), 0o755);

    expect(await changesAfter(dir, before)).toEqual(['clean.txt']);
  });

  it('lists a mode change to a file that was already modified', async () => {
    const dir = await repo();
    const before = await snapshot(dir);
    await chmod(path.join(dir, 'dirty.txt'), 0o755);

    expect(await changesAfter(dir, before)).toEqual(['dirty.txt']);
  });

  it.each([
    ['the repository root', '.'],
    ['a subdirectory', 'sub'],
  ])(
    'lists a permission change to a clean tracked file from %s',
    async (_label, from) => {
      const dir = await repo();
      await mkdir(path.join(dir, 'sub'));
      await writeFile(path.join(dir, 'sub', 'inner.txt'), 'inner\n');
      git(dir, 'add', 'sub');
      git(dir, 'commit', '-q', '-m', 'sub');
      await chmod(path.join(dir, 'clean.txt'), 0o644);
      const cwd = path.join(dir, from);
      const before = await snapshot(cwd);
      await chmod(path.join(dir, 'clean.txt'), 0o600);

      expect(git(dir, 'status', '--porcelain')).not.toContain('clean.txt');
      expect(compareWorkingTrees(before, await snapshot(cwd)).paths).toEqual([
        'clean.txt',
      ]);
    },
  );

  it.each([
    ['.git/info/attributes', 'probe'],
    ['.gitattributes', 'probe'],
    ['.git/info/attributes', 'odd.name=x'],
  ])(
    'runs no filter driver mapped in %s (driver %s) on a stat-dirty file',
    async (attributes, driver) => {
      const dir = await repo();
      const marker = path.join(await scratchDir(), 'filter-ran');
      git(
        dir,
        'config',
        `filter.${driver}.clean`,
        `echo ran >> '${marker}'; cat`,
      );
      git(dir, 'config', `filter.${driver}.required`, 'true');
      await writeFile(path.join(dir, attributes), `*.txt filter=${driver}\n`);
      // An old mtime makes status re-read the file, which is when it filters.
      const old = new Date('2020-01-01T00:00:00Z');
      await utimes(path.join(dir, 'clean.txt'), old, old);

      const before = await snapshot(dir);

      await expect(access(marker)).rejects.toThrow();
      expect(await changesAfter(dir, before)).toEqual([]);
      await expect(access(marker)).rejects.toThrow();
    },
  );

  it('runs no filter driver defined in a checked-out submodule config', async () => {
    const scratch = await scratchDir();
    const marker = path.join(scratch, 'filter-ran');
    const submodule = (cwd: string, ...args: string[]) =>
      git(cwd, '-c', 'protocol.file.allow=always', 'submodule', '-q', ...args);
    // inner is nested in middle, which is a submodule of the checkout. Each
    // maps its file to its own driver, so neither name covers the other.
    for (const name of ['inner', 'middle']) {
      const source = path.join(scratch, name);
      await mkdir(source);
      git(source, 'init', '-q', '-b', 'main');
      await writeFile(
        path.join(source, '.gitattributes'),
        `*.txt filter=${name}\n`,
      );
      await writeFile(path.join(source, `${name}.txt`), `${name}\n`);
      if (name === 'middle') submodule(source, 'add', '../inner', 'inner');
      git(source, 'add', '.');
      git(source, 'commit', '-q', '-m', name);
    }
    const dir = await repo();
    submodule(dir, 'add', path.join(scratch, 'middle'), 'middle');
    submodule(dir, 'update', '--init', '--recursive');
    git(dir, 'commit', '-q', '-m', 'add submodule');
    const old = new Date('2020-01-01T00:00:00Z');
    for (const sub of ['middle', 'middle/inner']) {
      const subDir = path.join(dir, sub);
      const name = path.basename(sub);
      // The submodule's own config, which the superproject's never includes.
      git(
        subDir,
        'config',
        `filter.${name}.clean`,
        `echo ${name} >> '${marker}'; cat`,
      );
      git(subDir, 'config', `filter.${name}.required`, 'true');
      // An old mtime makes status re-read the file, which is when it filters.
      await utimes(path.join(subDir, `${name}.txt`), old, old);
    }

    const before = await snapshot(dir);

    await expect(access(marker)).rejects.toThrow();
    expect(await changesAfter(dir, before)).toEqual([]);
    await expect(access(marker)).rejects.toThrow();
  });

  it('hides the caller environment from git', async () => {
    const dir = await repo();
    const shims = await scratchDir();
    const seen = path.join(shims, 'seen');
    const realGit = execFileSync('sh', ['-c', 'command -v git'], {
      env,
      encoding: 'utf8',
    }).trim();
    await writeFile(
      path.join(shims, 'git'),
      `#!/bin/sh\nprintf '%s\\n' "\${PROBE_SECRET-unset}" >> '${seen}'\nexec '${realGit}' "$@"\n`,
      { mode: 0o755 },
    );

    await snapshot(dir, {
      ...env,
      PATH: `${shims}${path.delimiter}${env.PATH}`,
      PROBE_SECRET: 'credential',
    });

    const values = new Set((await readFile(seen, 'utf8')).trim().split('\n'));
    expect(values).toEqual(new Set(['unset']));
  });

  it('lists an exclude rule added to hide a new file', async () => {
    const dir = await repo();
    const before = await snapshot(dir);
    await writeFile(path.join(dir, '.git', 'info', 'exclude'), 'hidden.txt\n');
    await writeFile(path.join(dir, 'hidden.txt'), 'peer output\n');

    expect(await changesAfter(dir, before)).toEqual(['.git/info/exclude']);
  });

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
