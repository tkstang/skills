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

    expect(scope.resolvedBaseRef).toBe(fixture.base);
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
    ).toMatchObject({
      kind: 'file',
      text: 'delete\n',
      blobId: expect.stringMatching(/^[a-f0-9]{40,64}$/u),
    });
    expect(scope.token).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('persists a resolved base tip separately from its merge base and base blob identities', async () => {
    const fixture = await gitFixture();
    const currentBranch = git(fixture.worktree, [
      'branch',
      '--show-current',
    ]).trim();
    git(fixture.worktree, ['branch', 'review-base', fixture.base]);
    await writeFile(
      path.join(fixture.worktree, 'tracked.txt'),
      'head change\n',
    );
    git(fixture.worktree, ['add', 'tracked.txt']);
    git(fixture.worktree, ['commit', '-q', '-m', 'head change']);
    git(fixture.worktree, ['checkout', '-q', 'review-base']);
    await writeFile(path.join(fixture.worktree, 'other.txt'), 'base tip\n');
    git(fixture.worktree, ['add', 'other.txt']);
    git(fixture.worktree, ['commit', '-q', '-m', 'base tip']);
    const resolvedBaseRef = git(fixture.worktree, ['rev-parse', 'HEAD']).trim();
    git(fixture.worktree, ['checkout', '-q', currentBranch]);

    const scope = await captureReviewScope({
      cwd: fixture.worktree,
      request: { kind: 'base_branch', ref: 'review-base' },
    });

    expect(scope.resolvedBaseRef).toBe(resolvedBaseRef);
    expect(scope.mergeBase).toBe(fixture.base);
    expect(scope.resolvedBaseRef).not.toBe(scope.mergeBase);
    expect(
      scope.versions.find(
        (entry) => entry.path === 'tracked.txt' && entry.source === 'base',
      )?.blobId,
    ).toMatch(/^[a-f0-9]{40,64}$/u);
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

  it('captures a tracked directory symlink in a branch diff as link text', async () => {
    const fixture = await gitFixture();
    const skillDirectory = path.join(
      fixture.worktree,
      '.agents',
      'skills',
      'example',
    );
    const providerDirectory = path.join(fixture.worktree, '.claude', 'skills');
    await mkdir(skillDirectory, { recursive: true });
    await mkdir(providerDirectory, { recursive: true });
    await writeFile(path.join(skillDirectory, 'SKILL.md'), '# Example\n');
    await symlink(
      '../../.agents/skills/example',
      path.join(providerDirectory, 'example'),
      'dir',
    );
    git(fixture.worktree, ['add', '.agents', '.claude']);
    git(fixture.worktree, ['commit', '-q', '-m', 'add provider view']);

    const scope = await captureReviewScope({
      cwd: fixture.worktree,
      request: { kind: 'base_branch', ref: fixture.base },
    });

    expect(
      scope.versions.find(
        (entry) =>
          entry.path === '.claude/skills/example' && entry.source === 'live',
      ),
    ).toMatchObject({
      kind: 'symlink',
      mode: 0o120000,
      text: '../../.agents/skills/example',
      bytes: Buffer.byteLength('../../.agents/skills/example'),
    });
  });

  it('captures a retargeted tracked symlink as separate base and live link text', async () => {
    const fixture = await gitFixture();
    const linkPath = path.join(fixture.worktree, 'provider-view');
    await mkdir(path.join(fixture.worktree, 'target-one'));
    await mkdir(path.join(fixture.worktree, 'target-two'));
    await symlink('target-one', linkPath, 'dir');
    git(fixture.worktree, ['add', 'provider-view']);
    git(fixture.worktree, ['commit', '-q', '-m', 'add provider view']);
    const base = git(fixture.worktree, ['rev-parse', 'HEAD']).trim();
    await rm(linkPath);
    await symlink('target-two', linkPath, 'dir');
    git(fixture.worktree, ['add', 'provider-view']);
    git(fixture.worktree, ['commit', '-q', '-m', 'retarget provider view']);

    const scope = await captureReviewScope({
      cwd: fixture.worktree,
      request: { kind: 'base_branch', ref: base },
    });

    expect(
      scope.versions
        .filter((entry) => entry.path === 'provider-view')
        .map(({ source, kind, mode, text }) => ({ source, kind, mode, text })),
    ).toEqual([
      {
        source: 'live',
        kind: 'symlink',
        mode: 0o120000,
        text: 'target-two',
      },
      {
        source: 'base',
        kind: 'symlink',
        mode: 0o120000,
        text: 'target-one',
      },
    ]);
  });

  it('captures an explicitly selected escaping symlink without reading its target', async () => {
    const fixture = await gitFixture();
    const external = path.join(fixture.root, 'outside.txt');
    await writeFile(external, 'outside contents must not be captured\n');
    await symlink(external, path.join(fixture.worktree, 'escape.txt'));

    const scope = await captureReviewScope({
      cwd: fixture.worktree,
      request: { kind: 'files', paths: ['escape.txt'] },
    });

    expect(scope.versions[0]).toMatchObject({
      kind: 'symlink',
      mode: 0o120000,
      text: external,
      bytes: Buffer.byteLength(external),
    });
    expect(scope.versions[0]?.text).not.toContain('outside contents');
  });

  it('rejects a selected symlink reached through an escaping symlinked ancestor', async () => {
    const fixture = await gitFixture();
    const externalDirectory = path.join(fixture.root, 'outside');
    await mkdir(externalDirectory);
    await symlink('target', path.join(externalDirectory, 'outside-link'));
    await symlink(
      externalDirectory,
      path.join(fixture.worktree, 'linked-directory'),
      'dir',
    );

    await expect(
      captureReviewScope({
        cwd: fixture.worktree,
        request: {
          kind: 'files',
          paths: ['linked-directory/outside-link'],
        },
      }),
    ).rejects.toThrow('path_escape: linked-directory/outside-link');
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

  it('captures file and document scopes without HEAD and treats the first commit as drift', async () => {
    const fixture = await unbornGitFixture();
    const external = path.join(fixture.root, 'external.md');
    await writeFile(path.join(fixture.worktree, 'draft.txt'), 'draft\n');
    await writeFile(external, 'external\n');

    const fileScope = await captureReviewScope({
      cwd: fixture.worktree,
      request: { kind: 'files', paths: ['draft.txt'] },
    });
    const internalDocument = await captureReviewScope({
      cwd: fixture.worktree,
      request: { kind: 'document', path: 'draft.txt' },
    });
    const externalDocument = await captureReviewScope({
      cwd: fixture.worktree,
      request: { kind: 'document', path: external },
    });

    expect(fileScope.head).toBeNull();
    expect(internalDocument.head).toBeNull();
    expect(externalDocument.head).toBeNull();
    expect(externalDocument.externalDocuments).toEqual([
      await realpath(external),
    ]);
    await expect(
      captureReviewScope({
        cwd: fixture.worktree,
        request: { kind: 'base_branch', ref: 'main' },
      }),
    ).rejects.toThrow('base_scope_requires_head');

    git(fixture.worktree, ['add', 'draft.txt']);
    git(fixture.worktree, ['commit', '-q', '-m', 'first']);
    const after = await captureScopeState(fileScope);
    expect(compareScopeState(fileScope.captureState, after)).toMatchObject({
      checked: true,
      stable: false,
      differences: expect.arrayContaining(['HEAD changed']),
    });
  });

  it('rejects malformed refs, empty scopes, binary inputs, special files, and bounds', async () => {
    const fixture = await gitFixture();
    const fifo = path.join(fixture.worktree, 'named-pipe');
    execFileSync('mkfifo', [fifo]);
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
        request: { kind: 'files', paths: ['binary.txt'] },
      }),
    ).rejects.toThrow('binary_scope_not_supported');
    await expect(
      captureReviewScope({
        cwd: fixture.worktree,
        request: { kind: 'files', paths: ['named-pipe'] },
      }),
    ).rejects.toThrow('scope_path_not_regular: named-pipe');
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
  it('detects a selected symlink being retargeted, replaced, or removed', async () => {
    const mutations = [
      async (linkPath: string) => {
        await rm(linkPath);
        await symlink('target-two', linkPath);
      },
      async (linkPath: string) => {
        await rm(linkPath);
        await writeFile(linkPath, 'replacement file\n');
      },
      async (linkPath: string) => rm(linkPath),
    ];

    for (const mutate of mutations) {
      const fixture = await gitFixture();
      const linkPath = path.join(fixture.worktree, 'provider-view');
      await symlink('target-one', linkPath);
      const scope = await captureReviewScope({
        cwd: fixture.worktree,
        request: { kind: 'files', paths: ['provider-view'] },
      });
      const before = await captureScopeState(scope);
      await mutate(linkPath);
      const after = await captureScopeState(scope);

      expect(compareScopeState(before, after)).toMatchObject({
        checked: true,
        stable: false,
        differences: expect.arrayContaining([
          'selected path changed: worktree:provider-view',
        ]),
      });
    }
  });

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

async function unbornGitFixture(): Promise<{
  root: string;
  worktree: string;
}> {
  const root = await realpath(
    await mkdtemp(path.join(os.tmpdir(), 'consensus-review-unborn-')),
  );
  roots.push(root);
  const worktree = path.join(root, 'repo');
  await mkdir(worktree);
  git(worktree, ['init', '-q']);
  git(worktree, ['config', 'user.email', 'fixture@example.com']);
  git(worktree, ['config', 'user.name', 'Fixture']);
  return { root, worktree };
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}
