import { execFile } from 'node:child_process';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const exec = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '../..');
const installer = path.join(repoRoot, 'install.sh');
const marker = '.standalone-install-incomplete';
const payload = new Map([
  [
    'SKILL.md',
    Buffer.from('---\nname: demo\ndescription: fixture\n---\nDemo\n'),
  ],
  [
    'scripts/run.mjs',
    Buffer.from('#!/usr/bin/env node\nconsole.log("demo");\n'),
  ],
  ['assets/data.bin', Buffer.from([0, 255, 10, 128])],
]);
let root: string;
let home: string;
let project: string;
let source: string;
let env: NodeJS.ProcessEnv;

async function git(...gitArgs: string[]) {
  return exec('git', ['-C', source, ...gitArgs], { env });
}

async function tag(name: string) {
  await git('add', '.');
  await git('commit', '-m', name);
  await git('tag', name);
}

function args(overrides: Record<string, string> = {}) {
  return Object.entries({
    skill: 'demo',
    agent: 'codex',
    scope: 'project',
    ref: 'v1.0.0',
    repository: source,
    ...overrides,
  }).flatMap(([key, value]) => [`--${key}`, value]);
}

function run(argv = args(), extraEnv: NodeJS.ProcessEnv = {}) {
  return exec('bash', [installer, ...argv], {
    cwd: project,
    env: { ...env, ...extraEnv },
  });
}

async function untouched() {
  expect(await readdir(project)).toEqual([]);
  expect(await readdir(home)).toEqual([]);
}

beforeEach(async () => {
  root = await realpath(
    await mkdtemp(path.join(tmpdir(), 'standalone-installer-')),
  );
  home = path.join(root, 'home');
  project = path.join(root, 'project');
  source = path.join(root, 'source');
  await Promise.all([home, project, source].map((dir) => mkdir(dir)));
  env = {
    PATH: process.env.PATH,
    HOME: home,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_AUTHOR_NAME: 'Fixture',
    GIT_AUTHOR_EMAIL: 'fixture@example.test',
    GIT_COMMITTER_NAME: 'Fixture',
    GIT_COMMITTER_EMAIL: 'fixture@example.test',
  };
  await git('init', '-b', 'main');
  for (const [name, bytes] of payload) {
    const file = path.join(source, 'skills/demo', name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
    await chmod(file, name.endsWith('.mjs') ? 0o755 : 0o644);
  }
  await tag('v1.0.0');
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('standalone installation', () => {
  it.each(
    [
      ['codex', '.agents', '$demo'],
      ['claude-code', '.claude', '/demo'],
      ['cursor', '.cursor', 'demo'],
    ].flatMap(([agent, directory, invocation]) =>
      ['project', 'user'].map((scope) => ({
        agent,
        directory,
        invocation,
        scope,
      })),
    ),
  )(
    'installs complete payload for $agent at $scope scope',
    async ({ agent, directory, invocation, scope }) => {
      const { stdout } = await run(args({ agent, scope }));
      const base = scope === 'project' ? project : home;
      const target = path.join(base, directory, 'skills/demo');
      expect(stdout).toContain(target);
      expect(stdout).toContain('v1.0.0');
      expect(stdout).toContain(scope);
      expect(stdout).toContain('Verified');
      expect(stdout).toContain(invocation);
      if (agent === 'cursor') expect(stdout).toMatch(/inventory/i);
      for (const [name, bytes] of payload) {
        expect(await readFile(path.join(target, name))).toEqual(bytes);
        expect((await lstat(path.join(target, name))).mode & 0o777).toBe(
          name.endsWith('.mjs') ? 0o755 : 0o644,
        );
      }
      expect(await readdir(target)).toEqual(['SKILL.md', 'assets', 'scripts']);
      expect(await readdir(base)).toEqual([directory]);
      expect(await readdir(scope === 'project' ? home : project)).toEqual([]);
    },
  );

  it('shows help without installing', async () => {
    const { stdout } = await run(['--help']);
    for (const flag of [
      '--skill',
      '--agent',
      '--scope',
      '--ref',
      '--repository',
    ])
      expect(stdout).toContain(flag);
    await untouched();
  });

  it.each(['skill', 'agent', 'scope', 'ref'])(
    'requires --%s',
    async (missing) => {
      const argv = args();
      argv.splice(argv.indexOf(`--${missing}`), 2);
      await expect(run(argv)).rejects.toMatchObject({
        stderr: expect.stringContaining(`--${missing}`),
      });
      await untouched();
    },
  );

  it.each([
    ['skill', '../demo'],
    ['skill', 'Bad_Name'],
    ['agent', 'other'],
    ['scope', 'global'],
    ['ref', 'HEAD'],
    ['ref', '../bad'],
    ['repository', '-evil'],
  ])('refuses invalid %s=%s', async (key, value) => {
    await expect(run(args({ [key]: value }))).rejects.toMatchObject({
      stderr: expect.stringContaining('install.sh:'),
    });
    await untouched();
  });

  it.each([['--unknown'], ['--skill'], ['--help', '--scope', 'user']])(
    'refuses malformed arguments %j',
    async (...argv) => {
      await expect(run(argv)).rejects.toMatchObject({
        stderr: expect.stringContaining('install.sh:'),
      });
      await untouched();
    },
  );

  it.each([
    'missing-tag',
    'branch-only',
    'missing-skill',
    'source-only',
    'symlink',
    'gitlink',
    'marker',
  ])('refuses %s before creating provider parents', async (scenario) => {
    let overrides: Record<string, string> = {};
    if (scenario === 'missing-tag') overrides = { ref: 'v9.9.9' };
    if (scenario === 'branch-only') {
      await git('branch', 'branch-only');
      overrides = { ref: 'branch-only' };
    }
    if (scenario === 'missing-skill') overrides = { skill: 'absent' };
    if (scenario === 'source-only') {
      await mkdir(path.join(source, 'src/skills/authored'), {
        recursive: true,
      });
      await writeFile(
        path.join(source, 'src/skills/authored/SKILL.md'),
        'Authored only',
      );
      overrides = { skill: 'authored', ref: 'v2.0.0' };
    }
    if (scenario === 'symlink') {
      await symlink('SKILL.md', path.join(source, 'skills/demo/link'));
      overrides = { ref: 'v2.0.0' };
    }
    if (scenario === 'gitlink') {
      const { stdout } = await git('rev-parse', 'HEAD');
      await git(
        'update-index',
        '--add',
        '--cacheinfo',
        `160000,${stdout.trim()},skills/demo/submodule`,
      );
      await git('commit', '-m', 'gitlink');
      await git('tag', 'v2.0.0');
      overrides = { ref: 'v2.0.0' };
    }
    if (scenario === 'marker') {
      await writeFile(path.join(source, 'skills/demo', marker), 'reserved');
      overrides = { ref: 'v2.0.0' };
    }
    if (['source-only', 'symlink', 'marker'].includes(scenario))
      await tag('v2.0.0');
    await expect(run(args(overrides))).rejects.toMatchObject({
      stderr: expect.stringContaining('install.sh:'),
    });
    await untouched();
  });

  it('chooses an annotated exact tag over a different same-name branch', async () => {
    await git('tag', '-a', 'release', '-m', 'release');
    await writeFile(path.join(source, 'skills/demo/SKILL.md'), 'wrong branch');
    await git('commit', '-am', 'different branch');
    await git('branch', 'release');
    await run(args({ ref: 'release' }));
    expect(
      await readFile(path.join(project, '.agents/skills/demo/SKILL.md')),
    ).toEqual(payload.get('SKILL.md'));
  });

  it('scrubs inherited Git routing and configuration without touching the decoy', async () => {
    const before = await git('show-ref');
    const index = await readFile(path.join(source, '.git/index'));
    const config = await readFile(path.join(source, '.git/config'));
    await run(args(), {
      GIT_DIR: path.join(source, '.git'),
      GIT_WORK_TREE: source,
      GIT_INDEX_FILE: path.join(source, '.git/index'),
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'protocol.file.allow',
      GIT_CONFIG_VALUE_0: 'never',
      GIT_CONFIG_PARAMETERS: "'protocol.file.allow=never'",
    });
    expect(
      await readFile(path.join(project, '.agents/skills/demo/SKILL.md')),
    ).toEqual(payload.get('SKILL.md'));
    expect(await git('show-ref')).toEqual(before);
    expect(await readFile(path.join(source, '.git/index'))).toEqual(index);
    expect(await readFile(path.join(source, '.git/config'))).toEqual(config);
    expect((await git('status', '--porcelain')).stdout).toBe('');
  });

  it('preserves an existing destination byte-for-byte', async () => {
    const target = path.join(project, '.agents/skills/demo');
    await mkdir(target, { recursive: true });
    const bytes = Buffer.from([1, 255, 3]);
    await writeFile(path.join(target, 'keep'), bytes);
    await expect(run()).rejects.toMatchObject({
      stderr: expect.stringContaining(target),
    });
    expect(await readdir(target)).toEqual(['keep']);
    expect(await readFile(path.join(target, 'keep'))).toEqual(bytes);
  });

  it('refuses a symlinked provider ancestor', async () => {
    await symlink(home, path.join(project, '.agents'));
    await expect(run()).rejects.toMatchObject({
      stderr: expect.stringContaining('symlink'),
    });
    expect(await readdir(home)).toEqual([]);
  });

  it('retains a marked partial destination on injected mid-write failure', async () => {
    const modulePath = path.join(repoRoot, 'scripts/install-standalone.mjs');
    const { installStandalone, fileOperations } = await import(modulePath);
    const original = fileOperations.open;
    fileOperations.open = async (...values: Parameters<typeof original>) => {
      if (String(values[0]).endsWith('data.bin'))
        throw new Error('injected write failure');
      return original(...values);
    };
    const target = path.join(project, '.agents/skills/demo');
    try {
      await expect(
        installStandalone(
          {
            skill: 'demo',
            agent: 'codex',
            scope: 'project',
            ref: 'v1.0.0',
            repository: source,
          },
          { cwd: project, env },
        ),
      ).rejects.toThrow(`Incomplete installation retained at ${target}`);
    } finally {
      fileOperations.open = original;
    }
    expect((await lstat(path.join(target, marker))).isFile()).toBe(true);
    expect(await readFile(path.join(target, 'SKILL.md'))).toEqual(
      payload.get('SKILL.md'),
    );
    await expect(run()).rejects.toMatchObject({
      stderr: expect.stringContaining(target),
    });
  });
});
