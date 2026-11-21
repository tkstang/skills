import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  checkCursorRepoHooks,
  nodeHostFileSystem,
  parseCodexTopLevelDefaults,
  readCodexUserDefaults,
} from './read-only-isolation.js';

let scratch: string;
let home: string;

beforeEach(async () => {
  scratch = await realpath(
    await mkdtemp(path.join(tmpdir(), 'consensus-ro-iso-')),
  );
  home = path.join(scratch, 'home');
  await mkdir(home);
});

afterEach(async () => {
  await rm(scratch, { recursive: true, force: true });
});

async function put(root: string, file: string, contents: string) {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await writeFile(path.join(root, file), contents);
}

async function repo(name = 'repo') {
  const root = path.join(scratch, name);
  await mkdir(path.join(root, '.git'), { recursive: true });
  return root;
}

function gate(cwd: string) {
  return checkCursorRepoHooks({ cwd, fs: nodeHostFileSystem });
}

const CURSOR_HOOK = JSON.stringify({
  version: 1,
  hooks: { sessionStart: [{ command: './run.sh' }] },
});
// Matcherless: cursor-agent 2026.11.13 skips this file, but the gate refuses
// it so a loader change cannot start running it unnoticed.
const CLAUDE_HOOK = JSON.stringify({
  hooks: {
    SessionStart: [{ hooks: [{ type: 'command', command: './run.sh' }] }],
  },
});

describe('Cursor read-only repo-hook gate', () => {
  it.each([
    ['.cursor/hooks.json', CURSOR_HOOK, 'sessionStart'],
    ['.claude/settings.json', CLAUDE_HOOK, 'SessionStart'],
    ['.claude/settings.local.json', CLAUDE_HOOK, 'SessionStart'],
    [
      '.cursor/hooks.json',
      '// comment Cursor strips\n{"version":1,"hooks":{"workspaceOpen":[{"command":"x"}]}}',
      'workspaceOpen',
    ],
  ])('refuses %s that configures a hook', async (file, contents, event) => {
    const root = await repo();
    await put(root, file, contents);

    const result = gate(root);

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ root, file });
    if (!result.ok) expect(result.message).toContain(event);
  });

  it.each([
    ['no hook files', undefined],
    ['an empty hooks object', '{"version":1,"hooks":{}}'],
    ['only empty event arrays', '{"version":1,"hooks":{"stop":[]}}'],
    ['a zero-byte file', ''],
  ])('allows %s', async (_label, contents) => {
    const root = await repo();
    if (contents !== undefined) await put(root, '.cursor/hooks.json', contents);
    await put(root, '.claude/settings.json', '{"permissions":{"allow":[]}}');

    expect(gate(root)).toEqual({ ok: true, root });
  });

  it('refuses a hook file that does not parse', async () => {
    const root = await repo();
    await put(root, '.claude/settings.local.json', '{"hooks": {');

    expect(gate(root)).toMatchObject({
      ok: false,
      file: '.claude/settings.local.json',
      message: expect.stringContaining('not valid JSON'),
    });
  });

  it('refuses a hook path it cannot read', async () => {
    const root = await repo();
    await mkdir(path.join(root, '.claude', 'settings.json'), {
      recursive: true,
    });

    expect(gate(root)).toMatchObject({
      ok: false,
      file: '.claude/settings.json',
      message: expect.stringContaining('could not be read'),
    });
  });

  it('judges a symlinked hook file by its target', async () => {
    const root = await repo();
    await put(scratch, 'elsewhere/hooks.json', CURSOR_HOOK);
    await mkdir(path.join(root, '.cursor'));
    const { symlink } = await import('node:fs/promises');
    await symlink(
      path.join(scratch, 'elsewhere/hooks.json'),
      path.join(root, '.cursor/hooks.json'),
    );

    expect(gate(root).ok).toBe(false);
  });

  it('checks the repository root from a subdirectory, not hook files below it', async () => {
    const root = await repo();
    const sub = path.join(root, 'packages', 'app');
    await put(sub, '.cursor/hooks.json', CURSOR_HOOK);

    expect(gate(sub)).toEqual({ ok: true, root });

    await put(root, '.claude/settings.json', CLAUDE_HOOK);
    expect(gate(sub)).toMatchObject({ ok: false, root });
  });

  it('stops at a linked worktree whose .git is a file', async () => {
    const root = await repo();
    await put(root, '.claude/settings.local.json', CLAUDE_HOOK);
    const worktree = path.join(root, 'wt');
    await put(worktree, '.git', 'gitdir: ../.git/worktrees/wt\n');

    expect(gate(worktree)).toEqual({ ok: true, root: worktree });
  });

  it('checks the working directory itself outside any repository', async () => {
    const dir = path.join(scratch, 'plain');
    await put(dir, '.cursor/hooks.json', CURSOR_HOOK);

    expect(gate(dir)).toMatchObject({ ok: false, root: dir });
  });

  it('refuses when the working directory cannot be resolved', () => {
    expect(gate(path.join(scratch, 'missing'))).toMatchObject({
      ok: false,
      message: expect.stringContaining('could not resolve'),
    });
  });
});

describe('Codex user defaults for read-only runs', () => {
  it('reads only top-level model and effort strings', () => {
    expect(
      parseCodexTopLevelDefaults(
        [
          '# comment',
          'model = "gpt-test"  # trailing',
          "model_reasoning_effort = 'medium'",
          'model_provider = "router"',
          '[profiles.fast]',
          'model = "gpt-other"',
        ].join('\n'),
      ),
    ).toEqual({ model: 'gpt-test', effort: 'medium' });
  });

  it('ignores key-like lines inside a multi-line string', () => {
    expect(
      parseCodexTopLevelDefaults(
        [
          'developer_instructions = """',
          'model = "from-a-string"',
          '"""',
          "notes = '''",
          "model_reasoning_effort = 'from-a-literal'",
          "'''",
          '# a comment mentioning """ is not a string',
          'model = "real"',
        ].join('\n'),
      ),
    ).toEqual({ model: 'real' });
  });

  it('ignores values it cannot read as a plain string', () => {
    expect(
      parseCodexTopLevelDefaults('model = "a\\"b"\nmodel_reasoning_effort = 3'),
    ).toEqual({});
  });

  it('reads config.toml from CODEX_HOME, else HOME/.codex', async () => {
    await put(home, '.codex/config.toml', 'model = "from-home"\n');
    await put(scratch, 'codex-home/config.toml', 'model = "from-codex-home"\n');

    expect(readCodexUserDefaults({ HOME: home }, nodeHostFileSystem)).toEqual({
      model: 'from-home',
    });
    expect(
      readCodexUserDefaults(
        { HOME: home, CODEX_HOME: path.join(scratch, 'codex-home') },
        nodeHostFileSystem,
      ),
    ).toEqual({ model: 'from-codex-home' });
    expect(
      readCodexUserDefaults(
        { HOME: path.join(scratch, 'nobody') },
        nodeHostFileSystem,
      ),
    ).toEqual({});
    const reads: string[] = [];
    expect(
      readCodexUserDefaults(
        { HOME: home, CODEX_HOME: 'relative-codex-home' },
        {
          ...nodeHostFileSystem,
          readFile: (filePath) => {
            reads.push(filePath);
            return 'model = "relative"\n';
          },
        },
      ),
    ).toEqual({});
    expect(reads).toEqual([]);
  });
});
