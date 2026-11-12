import { execFileSync, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

// The host runs the `delegate_snapshot` function exactly as accounting.md
// prints it, so the test extracts that fenced block rather than a copy.
const accounting = readFileSync(
  fileURLToPath(new URL('../references/accounting.md', import.meta.url)),
  'utf8',
);
const snapshotSource = /```sh\n(delegate_snapshot\(\)[\s\S]*?)```/.exec(
  accounting,
)?.[1];

// A git hook or the caller's shell can export GIT_DIR or GIT_INDEX_FILE,
// which would point every command at the wrong repository.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
);

const shells = ['bash', 'zsh'].filter(
  (shell) => spawnSync(shell, ['-c', 'true'], { env }).status === 0,
);

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, env, encoding: 'utf8' }).trim();
}

function fixture() {
  const root = realpathSync(
    mkdtempSync(path.join(os.tmpdir(), 'consensus-delegate-snapshot-')),
  );
  roots.push(root);
  const repo = path.join(root, 'repo');
  const worktree = path.join(root, 'worktree');
  execFileSync('git', ['init', '-q', repo], { env });
  git(repo, 'config', 'user.email', 'fixture@example.com');
  git(repo, 'config', 'user.name', 'Fixture');
  writeFileSync(path.join(repo, 'a.txt'), 'a\n');
  writeFileSync(path.join(repo, '.gitignore'), 'ignored/\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'base');
  git(repo, 'worktree', 'add', '-q', '-b', 'delegate/test', worktree, 'HEAD');
  return { root, worktree, state: path.join(root, 'state') };
}

function snapshot(shell: string, worktree: string, out: string) {
  const result = spawnSync(
    shell,
    [
      '-c',
      `${snapshotSource}\ndelegate_snapshot "$1" "$2"`,
      'snap',
      worktree,
      out,
    ],
    { env, encoding: 'utf8' },
  );
  const ids = Object.fromEntries(
    result.stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => line.split(' ')),
  ) as Record<'head' | 'index' | 'tree', string | undefined>;
  return { status: result.status, ids };
}

describe('delegate_snapshot in accounting.md', () => {
  it('is a fenced sh block the test can extract', () => {
    expect(snapshotSource).toBeDefined();
  });

  describe.each(shells)('under %s', (shell) => {
    it('records a clean worktree as its HEAD tree', () => {
      const { worktree, state } = fixture();
      const { status, ids } = snapshot(shell, worktree, `${state}/before`);

      expect(status).toBe(0);
      expect(ids.head).toBe(git(worktree, 'rev-parse', 'HEAD'));
      expect(ids.index).toBe(git(worktree, 'rev-parse', 'HEAD^{tree}'));
      expect(ids.tree).toBe(git(worktree, 'rev-parse', 'HEAD^{tree}'));
    });

    it('changes tree for content git status cannot see, but not for ignored files', () => {
      const { worktree, state } = fixture();
      appendFileSync(path.join(worktree, 'a.txt'), 'b\n');
      const modified = snapshot(shell, worktree, `${state}/1`).ids.tree;
      const statusBefore = git(worktree, 'status', '--porcelain=v2');

      appendFileSync(path.join(worktree, 'a.txt'), 'c\n');
      expect(git(worktree, 'status', '--porcelain=v2')).toBe(statusBefore);
      const reEdited = snapshot(shell, worktree, `${state}/2`).ids.tree;
      expect(reEdited).not.toBe(modified);

      writeFileSync(path.join(worktree, 'new.txt'), 'new\n');
      const untracked = snapshot(shell, worktree, `${state}/3`).ids.tree;
      expect(untracked).not.toBe(reEdited);

      mkdirSync(path.join(worktree, 'ignored'));
      writeFileSync(path.join(worktree, 'ignored', 'x.txt'), 'x\n');
      expect(snapshot(shell, worktree, `${state}/4`).ids.tree).toBe(untracked);
    });

    it('leaves the worktree index unchanged', () => {
      const { worktree, state } = fixture();
      writeFileSync(path.join(worktree, 'staged.txt'), 'staged\n');
      git(worktree, 'add', 'staged.txt');
      writeFileSync(path.join(worktree, 'untracked.txt'), 'u\n');
      const before = git(worktree, 'write-tree');

      const { status, ids } = snapshot(shell, worktree, `${state}/s`);

      expect(status).toBe(0);
      expect(ids.index).toBe(before);
      expect(git(worktree, 'write-tree')).toBe(before);
      expect(git(worktree, 'status', '--porcelain')).toContain(
        '?? untracked.txt',
      );
    });

    it('returns nonzero and prints no IDs when the worktree is missing', () => {
      const { root, state } = fixture();
      const { status, ids } = snapshot(
        shell,
        path.join(root, 'missing'),
        `${state}/missing`,
      );

      expect(status).not.toBe(0);
      expect(ids).toEqual({});
    });
  });
});
