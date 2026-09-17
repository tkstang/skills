import { execFileSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  captureReviewScope,
  captureScopeState,
  compareScopeState,
  createReviewRunState,
  REVIEW_SCOPE_LIMITS,
} from './scope.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('review scope capture', () => {
  it('captures committed, staged, unstaged, renamed, and deleted branch paths with separate base bytes', async () => {
    const fixture = await gitFixture();
    await writeFile(
      path.join(fixture.worktree, 'committed.txt'),
      'committed\n',
    );
    git(fixture.worktree, ['add', 'committed.txt']);
    git(fixture.worktree, ['commit', '-m', 'committed change']);
    await writeFile(path.join(fixture.worktree, 'staged.txt'), 'staged\n');
    git(fixture.worktree, ['add', 'staged.txt']);
    await writeFile(path.join(fixture.worktree, 'unstaged.txt'), 'unstaged\n');
    git(fixture.worktree, ['mv', 'rename-old.txt', 'rename-new.txt']);
    await rm(path.join(fixture.worktree, 'delete.txt'));

    const scope = await captureReviewScope({
      cwd: fixture.worktree,
      request: { kind: 'base_branch', ref: fixture.base },
    });

    expect(scope.mergeBase).toBe(fixture.base);
    expect(scope.selectedPaths).toEqual([
      'committed.txt',
      'delete.txt',
      'rename-new.txt',
      'rename-old.txt',
      'staged.txt',
      'unstaged.txt',
    ]);
    expect(
      scope.versions.find(
        (entry) => entry.path === 'delete.txt' && entry.source === 'live',
      ),
    ).toMatchObject({ kind: 'deleted' });
    expect(
      scope.versions.find(
        (entry) => entry.path === 'delete.txt' && entry.source === 'base',
      ),
    ).toMatchObject({ kind: 'file', text: 'delete\n' });
    expect(scope.token).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('captures explicitly selected tracked and untracked files', async () => {
    const fixture = await gitFixture();
    await writeFile(path.join(fixture.worktree, 'tracked.txt'), 'dirty\n');
    await writeFile(path.join(fixture.worktree, 'untracked.txt'), 'new\n');

    const scope = await captureReviewScope({
      cwd: fixture.worktree,
      request: {
        kind: 'files',
        paths: ['tracked.txt', 'untracked.txt', 'tracked.txt'],
      },
    });

    expect(scope.selectedPaths).toEqual(['tracked.txt', 'untracked.txt']);
    expect(scope.versions.map((entry) => entry.text)).toEqual([
      'dirty\n',
      'new\n',
    ]);
  });

  it('uses repository paths for internal documents and stable absolute anchors for external documents', async () => {
    const fixture = await gitFixture();
    const external = path.join(fixture.root, 'external plan.md');
    await writeFile(external, 'external\n');

    const internalScope = await captureReviewScope({
      cwd: fixture.worktree,
      request: { kind: 'document', path: 'tracked.txt' },
    });
    const externalScope = await captureReviewScope({
      cwd: fixture.worktree,
      request: { kind: 'document', path: external },
    });

    expect(internalScope.selectedPaths).toEqual(['tracked.txt']);
    expect(internalScope.externalDocuments).toEqual([]);
    expect(externalScope.selectedPaths).toEqual([]);
    expect(externalScope.externalDocuments).toEqual([await realpath(external)]);
    expect(externalScope.versions[0]).toMatchObject({
      path: await realpath(external),
      text: 'external\n',
    });
  });

  it('rejects malformed refs, empty scopes, escapes, symlink escapes, binary inputs, and bounds', async () => {
    const fixture = await gitFixture();
    const external = path.join(fixture.root, 'outside.txt');
    await writeFile(external, 'outside\n');
    await symlink(external, path.join(fixture.worktree, 'escape.txt'));
    await writeFile(
      path.join(fixture.worktree, 'binary.txt'),
      Buffer.from([0]),
    );

    await expect(
      captureReviewScope({
        cwd: fixture.worktree,
        request: { kind: 'base_branch', ref: '--bad' },
      }),
    ).rejects.toThrow('base_ref_invalid');
    await expect(
      captureReviewScope({
        cwd: fixture.worktree,
        request: { kind: 'files', paths: [] },
      }),
    ).rejects.toThrow('scope_required');
    await expect(
      captureReviewScope({
        cwd: fixture.worktree,
        request: { kind: 'files', paths: ['../outside.txt'] },
      }),
    ).rejects.toThrow('path_escape');
    await expect(
      captureReviewScope({
        cwd: fixture.worktree,
        request: { kind: 'files', paths: ['escape.txt'] },
      }),
    ).rejects.toThrow('scope_path_not_regular');
    await expect(
      captureReviewScope({
        cwd: fixture.worktree,
        request: { kind: 'files', paths: ['binary.txt'] },
      }),
    ).rejects.toThrow('binary_scope_not_supported');
    await expect(
      captureReviewScope({
        cwd: fixture.worktree,
        request: {
          kind: 'files',
          paths: Array.from(
            { length: REVIEW_SCOPE_LIMITS.maxSelectedFiles + 1 },
            (_, index) => `f-${index}.txt`,
          ),
        },
      }),
    ).rejects.toThrow('scope_too_large');
  });
});

describe('selected scope drift', () => {
  it('detects selected dirty content changing when porcelain status stays the same', async () => {
    const fixture = await gitFixture();
    await writeFile(path.join(fixture.worktree, 'tracked.txt'), 'dirty-one\n');
    const scope = await captureReviewScope({
      cwd: fixture.worktree,
      request: { kind: 'files', paths: ['tracked.txt'] },
    });
    const before = await captureScopeState(scope);
    await writeFile(path.join(fixture.worktree, 'tracked.txt'), 'dirty-two\n');
    const after = await captureScopeState(scope);

    expect(before.status).toBe(after.status);
    expect(compareScopeState(before, after)).toMatchObject({
      checked: true,
      stable: false,
      differences: ['selected path changed: worktree:tracked.txt'],
    });
  });

  it('discloses that an unselected dirty file can change without detection', async () => {
    const fixture = await gitFixture();
    await writeFile(
      path.join(fixture.worktree, 'tracked.txt'),
      'selected dirty\n',
    );
    await writeFile(
      path.join(fixture.worktree, 'other.txt'),
      'other dirty one\n',
    );
    const scope = await captureReviewScope({
      cwd: fixture.worktree,
      request: { kind: 'files', paths: ['tracked.txt'] },
    });
    const before = await captureScopeState(scope);
    await writeFile(
      path.join(fixture.worktree, 'other.txt'),
      'other dirty two\n',
    );
    const after = await captureScopeState(scope);
    const comparison = compareScopeState(before, after);

    expect(comparison.stable).toBe(true);
    expect(comparison.limitation).toContain('outside the selected set');
  });

  it('reports failed after-scans without claiming a completed comparison', async () => {
    const fixture = await gitFixture();
    const scope = await captureReviewScope({
      cwd: fixture.worktree,
      request: { kind: 'files', paths: ['tracked.txt'] },
    });
    const before = await captureScopeState(scope);

    expect(
      compareScopeState(before, new Error('fixture read failure')),
    ).toEqual(
      expect.objectContaining({
        checked: false,
        stable: false,
        differences: ['after_scan_failed: fixture read failure'],
      }),
    );
  });
});

describe('external review run state', () => {
  it('creates private collision-safe state keyed by the canonical worktree', async () => {
    const fixture = await gitFixture();
    const xdg = path.join(fixture.root, 'state');
    const first = await createReviewRunState({
      cwd: fixture.worktree,
      env: { XDG_STATE_HOME: xdg },
      runId: 'fixed-run',
    });

    expect(first.runDirectory).toContain(first.worktreeKey);
    expect(first.runDirectory.startsWith(await realpath(xdg))).toBe(true);
    await expect(
      createReviewRunState({
        cwd: fixture.worktree,
        env: { XDG_STATE_HOME: xdg },
        runId: 'fixed-run',
      }),
    ).rejects.toThrow(/EEXIST/u);
  });

  it('rejects relative state roots and state roots resolving into the worktree', async () => {
    const fixture = await gitFixture();
    await expect(
      createReviewRunState({
        cwd: fixture.worktree,
        env: { XDG_STATE_HOME: 'relative' },
      }),
    ).rejects.toThrow('XDG_STATE_HOME must be absolute');
    await expect(
      createReviewRunState({
        cwd: fixture.worktree,
        env: { XDG_STATE_HOME: path.join(fixture.worktree, '.state') },
      }),
    ).rejects.toThrow('review_state_inside_worktree');
  });

  it('rejects a state-root symlink resolving into the worktree', async () => {
    const fixture = await gitFixture();
    const linked = path.join(fixture.root, 'linked-state');
    await mkdir(path.join(fixture.worktree, 'actual-state'));
    await symlink(path.join(fixture.worktree, 'actual-state'), linked, 'dir');

    await expect(
      createReviewRunState({
        cwd: fixture.worktree,
        env: { XDG_STATE_HOME: linked },
      }),
    ).rejects.toThrow('review_state_inside_worktree');
  });
});

async function gitFixture(): Promise<{
  root: string;
  worktree: string;
  base: string;
}> {
  const root = await realpath(
    await mkdtemp(path.join(os.tmpdir(), 'consensus-review-scope-')),
  );
  roots.push(root);
  const worktree = path.join(root, 'repo');
  await mkdir(worktree);
  git(worktree, ['init', '-q']);
  git(worktree, ['config', 'user.email', 'fixture@example.com']);
  git(worktree, ['config', 'user.name', 'Fixture']);
  await Promise.all([
    writeFile(path.join(worktree, 'tracked.txt'), 'tracked\n'),
    writeFile(path.join(worktree, 'other.txt'), 'other\n'),
    writeFile(path.join(worktree, 'rename-old.txt'), 'rename\n'),
    writeFile(path.join(worktree, 'delete.txt'), 'delete\n'),
    writeFile(path.join(worktree, 'unstaged.txt'), 'initial\n'),
  ]);
  git(worktree, ['add', '.']);
  git(worktree, ['commit', '-q', '-m', 'base']);
  const base = git(worktree, ['rev-parse', 'HEAD']).trim();
  return { root, worktree, base };
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}
