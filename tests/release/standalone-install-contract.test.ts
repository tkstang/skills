import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const execFile = promisify(execFileCallback);

async function repoFile(relativePath: string) {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}

async function git(cwd: string, ...args: string[]) {
  return execFile('git', args, { cwd });
}

describe('standalone install contract', () => {
  it('documents explicit scoped standalone commands with a planned exact release tag', async () => {
    const guide = await repoFile(
      'documentation/docs/user-guide/installation.md',
    );
    const commands = [...guide.matchAll(/^bash "\$INSTALLER" (.+)$/gm)].map(
      (match) => match[1],
    );
    expect(commands).toHaveLength(6);
    for (const agent of ['codex', 'claude-code', 'cursor']) {
      for (const scope of ['project', 'user']) {
        const command = commands.find((line) =>
          line.includes(`--agent ${agent} --scope ${scope}`),
        );
        expect(command).toContain('--skill next-steps');
        expect(command).toMatch(/--ref v0\.1\.2$/);
        expect(command).not.toMatch(/<|--ref (?:main|HEAD|latest)/);
      }
    }
    expect(guide).toMatch(/--scope.*required/);
    expect(guide).toContain('skills/<name>/');
    expect(guide).toContain('.standalone-install-incomplete');
    expect(guide).toMatch(/once a release contains the helper/);
    expect(guide).toMatch(/copy fidelity/);
    expect(guide).toMatch(/signed.tag/);
    expect(guide).toContain('temporary `HOME`');
    const helperPath = path.join(repoRoot, 'scripts/install-standalone.mjs');
    const { DEFAULT_REPOSITORY } = await import(helperPath);
    expect(DEFAULT_REPOSITORY).toBe('https://github.com/tkstang/skills.git');
    expect(guide).toContain(DEFAULT_REPOSITORY);
  });

  it('boots from the annotated release tag when a same-named branch diverges', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'standalone-bootstrap-'));
    const source = path.join(root, 'source');
    const checkout = path.join(root, 'skills-installer');
    const tagInstaller = '#!/usr/bin/env bash\necho tag\n';
    const branchInstaller = '#!/usr/bin/env bash\necho branch\n';

    try {
      const guide = await repoFile(
        'documentation/docs/user-guide/installation.md',
      );
      expect(guide).toContain('git -C skills-installer init --quiet');
      expect(guide).toContain(
        'git -C skills-installer fetch --no-tags --depth=1 origin refs/tags/v0.1.2',
      );
      expect(guide).toContain(
        "git -C skills-installer checkout --detach --quiet 'FETCH_HEAD^{commit}'",
      );

      await mkdir(source);
      await git(source, 'init', '--quiet');
      await git(source, 'config', 'user.email', 'fixture@example.test');
      await git(source, 'config', 'user.name', 'Fixture');
      await writeFile(path.join(source, 'install.sh'), tagInstaller);
      await git(source, 'add', 'install.sh');
      await git(source, 'commit', '--quiet', '-m', 'tagged installer');
      await git(source, 'tag', '-a', 'v0.1.2', '-m', 'release v0.1.2');
      const { stdout: tagHead } = await git(
        source,
        'rev-parse',
        'v0.1.2^{commit}',
      );

      await git(source, 'switch', '--quiet', '-c', 'v0.1.2');
      await writeFile(path.join(source, 'install.sh'), branchInstaller);
      await git(source, 'add', 'install.sh');
      await git(source, 'commit', '--quiet', '-m', 'branch installer');

      await mkdir(checkout);
      await git(checkout, 'init', '--quiet');
      await git(checkout, 'remote', 'add', 'origin', source);
      await git(
        checkout,
        'fetch',
        '--no-tags',
        '--depth=1',
        'origin',
        'refs/tags/v0.1.2',
      );
      await git(
        checkout,
        'checkout',
        '--detach',
        '--quiet',
        'FETCH_HEAD^{commit}',
      );

      const { stdout: checkoutHead } = await git(checkout, 'rev-parse', 'HEAD');
      expect(checkoutHead.trim()).toBe(tagHead.trim());
      expect(await readFile(path.join(checkout, 'install.sh'), 'utf8')).toBe(
        tagInstaller,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('keeps live host and user-home release evidence separate from copy verification', async () => {
    const release = await repoFile('RELEASING.md');
    const section = release
      .split('## First-party standalone acceptance')[1]
      ?.split('\n## ')[0];
    expect(section).toBeDefined();
    for (const host of ['Codex', 'Claude Code', 'Cursor']) {
      for (const scope of ['project', 'user'])
        expect(section).toMatch(new RegExp(`\\| ${host} +\\| ${scope} +\\|`));
    }
    for (const evidence of [
      'pinned tag',
      'selected skill',
      'placement',
      'payload verification',
      'printed invocation',
      'fresh-session discovery',
      'permission behavior',
      'authorization',
    ])
      expect(section).toContain(evidence);
  });
});
