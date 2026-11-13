import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { gitEnv } from '../helpers/git-env.mjs';

const selector = fileURLToPath(
  new URL('../../scripts/select-session-toolkit-checks.ts', import.meta.url),
);
let owned: string;
let repo: string;
let base: string;

function git(...args: string[]): string {
  return execFileSync('git', args, {
    cwd: repo,
    env: gitEnv(),
    encoding: 'utf8',
  }).trim();
}

function write(path: string, content = 'fixture\n'): void {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), content);
}

function commit(): string {
  git('add', '-A');
  git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture');
  return git('rev-parse', 'HEAD');
}

function select(overrides: NodeJS.ProcessEnv = {}) {
  const output = join(owned, 'output');
  writeFileSync(output, 'existing=kept\n');
  const result = spawnSync(process.execPath, [selector], {
    cwd: repo,
    encoding: 'utf8',
    env: gitEnv({
      GITHUB_EVENT_NAME: 'pull_request',
      PR_BASE_SHA: base,
      PR_HEAD_SHA: git('rev-parse', 'HEAD'),
      GITHUB_OUTPUT: output,
      ...overrides,
    }),
  });
  return { ...result, output: readFileSync(output, 'utf8') };
}

beforeEach(() => {
  owned = mkdtempSync(join(tmpdir(), 'toolkit-selector-'));
  repo = join(owned, 'repo');
  mkdirSync(repo);
  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  git('config', 'core.hooksPath', join(owned, 'no-hooks'));
  write('README.md');
  base = commit();
});

afterEach(() => rmSync(owned, { recursive: true, force: true }));

describe('Session Toolkit archive selector CLI', () => {
  it('skips only known guidance, docs app and nested Markdown PJM notes', () => {
    write('README.md', 'updated\n');
    write('CONTRIBUTING.md');
    write('AGENTS.md');
    write('documentation/nested/space and\nnewline.ts');
    write('.oat/repo/pjm/backlog/items/note.md');
    commit();
    const result = select();
    expect(result.status, result.stderr).toBe(0);
    expect(result.output).toBe('existing=kept\nrelevant=false\n');
  });

  it('skips an empty PR diff', () => {
    expect(select().output).toBe('existing=kept\nrelevant=false\n');
  });

  it.each([
    'src/feature.ts',
    'tests/check.test.ts',
    'package.json',
    'pnpm-lock.yaml',
    '.github/workflows/session-toolkit.yml',
    '.node-version',
    '.oat/repo/settings.json',
    'nested/README.md',
    'README.md\nunknown',
    'unknown [glob] name',
  ])('runs proof for archive inputs or unknown path %j', (path) => {
    write(path);
    commit();
    const result = select();
    expect(result.status, result.stderr).toBe(0);
    expect(result.output).toBe('existing=kept\nrelevant=true\n');
  });

  it('compares from the merge-base rather than including base-only changes', () => {
    git('checkout', '-qb', 'base-update');
    write('src/base-only.ts');
    const advancedBase = commit();
    git('checkout', '-qb', 'pr', base);
    write('README.md', 'PR documentation\n');
    commit();
    const result = select({ PR_BASE_SHA: advancedBase });
    expect(result.status, result.stderr).toBe(0);
    expect(result.output).toBe('existing=kept\nrelevant=false\n');
  });

  it.each(['into', 'out of'])(
    'classifies both sides of a rename %s docs',
    (direction) => {
      const oldPath =
        direction === 'into' ? 'runtime.ts' : 'documentation/runtime.ts';
      const newPath =
        direction === 'into' ? 'documentation/runtime.ts' : 'runtime.ts';
      write(oldPath);
      base = commit();
      mkdirSync(dirname(join(repo, newPath)), { recursive: true });
      git('mv', oldPath, newPath);
      commit();
      const result = select();
      expect(result.status, result.stderr).toBe(0);
      expect(result.output).toBe('existing=kept\nrelevant=true\n');
    },
  );

  it.each(['push', 'workflow_dispatch'])(
    'workflow bridge runs proof for %s without a helper in the release checkout',
    (event) => {
      // Execute the workflow's shell bridge, not a second implementation. The
      // historical checkout has no scripts/ directory or installed dependencies.
      const workflow = readFileSync(
        new URL('../../.github/workflows/session-toolkit.yml', import.meta.url),
        'utf8',
      );
      const block = workflow.match(
        /id: changes\n[\s\S]*?        run: \|\n((?:          .*\n)+)/,
      );
      if (!block) throw new Error('Selector run block missing');
      const bridge = block[1].replace(/^          /gm, '');
      const output = join(owned, 'output');
      const result = spawnSync('bash', ['-euo', 'pipefail', '-c', bridge], {
        cwd: repo,
        encoding: 'utf8',
        env: gitEnv({
          GITHUB_EVENT_NAME: event,
          GITHUB_OUTPUT: output,
          PR_BASE_SHA: '',
          PR_HEAD_SHA: '',
        }),
      });
      expect(result.status, result.stderr).toBe(0);
      expect(readFileSync(output, 'utf8')).toBe('relevant=true\n');
    },
  );

  it.each(['', '--help', 'A'.repeat(40), '1'.repeat(40)])(
    'fails closed for malformed or missing base revision %j',
    (revision) => {
      const result = select({ PR_BASE_SHA: revision });
      expect(result.status).toBe(1);
      expect(result.output).toBe('existing=kept\n');
      expect(result.stderr).toContain('E_ARCHIVE_SELECTION');
    },
  );

  it('validates the head revision too', () => {
    const result = select({ PR_HEAD_SHA: '--help' });
    expect(result.status).toBe(1);
    expect(result.output).toBe('existing=kept\n');
    expect(result.stderr).toContain('E_INVALID_PR_REVISION');
  });

  it('rejects an existing non-commit object', () => {
    const result = select({ PR_HEAD_SHA: git('rev-parse', 'HEAD:README.md') });
    expect(result.status).toBe(1);
    expect(result.output).toBe('existing=kept\n');
  });

  it('fails closed when commits have no merge-base', () => {
    git('checkout', '--orphan', 'unrelated');
    write('README.md', 'different history\n');
    commit();
    const result = select();
    expect(result.status).toBe(1);
    expect(result.output).toBe('existing=kept\n');
  });
});
