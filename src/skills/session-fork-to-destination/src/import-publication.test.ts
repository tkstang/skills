import { execFile } from 'node:child_process';
import { watch } from 'node:fs';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, beforeEach, expect, it } from 'vitest';

import { SessionImportError } from './import-errors.js';
import { publishImportSeed, readImportSnapshot } from './import-store.js';
import {
  applySessionImport,
  planSessionImport,
  type SessionImportInput,
} from './session-import.js';

// Protects publication/replay after real permission or staging-time drift; earlier plan-only stale checks and native loaders cannot exercise these filesystem failure windows.
const exec = promisify(execFile);
const id = '550e8400-e29b-41d4-a716-446655440081';
let root: string;
let home: string;
let seed: string;
let saved: Record<string, string | undefined>;
const bytes = Buffer.from('synthetic-native-seed\n');
const deadline = () => Date.now() + 30_000;

beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'import-publication-')));
  home = join(root, 'store');
  seed = join(home, 'projects', 'synthetic', `${id}.jsonl`);
  await mkdir(home);
  saved = Object.fromEntries(
    ['HOME', 'STATE_DIR', 'CODEX_HOME', 'CLAUDE_CONFIG_DIR'].map((key) => [
      key,
      process.env[key],
    ]),
  );
  process.env.HOME = root;
  process.env.STATE_DIR = join(root, 'state');
  delete process.env.CODEX_HOME;
  delete process.env.CLAUDE_CONFIG_DIR;
});
afterEach(async () => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  // Restore only owned fixture permissions, including paths left by an intentional cleanup failure.
  await chmod(home, 0o700).catch(() => {});
  await chmod(dirname(seed), 0o700).catch(() => {});
  await rm(root, { recursive: true, force: true });
});

it('revalidates after staging and removes only its owned temporary file on refusal', async () => {
  await mkdir(dirname(seed), { recursive: true });
  const unrelated = '.unrelated.tmp';
  await writeFile(join(dirname(seed), unrelated), 'preserve');
  const refusal = new SessionImportError('source-snapshot-changed');
  await expect(
    publishImportSeed(home, seed, id, 'claude', bytes, deadline(), async () => {
      expect(
        (await readdir(dirname(seed))).filter((name) =>
          name.startsWith('.session-import-'),
        ),
      ).toHaveLength(1);
      throw refusal;
    }),
  ).rejects.toBe(refusal);
  await expect(lstat(seed)).rejects.toMatchObject({ code: 'ENOENT' });
  expect(await readdir(dirname(seed))).toEqual([unrelated]);
  expect(await readFile(join(dirname(seed), unrelated), 'utf8')).toBe(
    'preserve',
  );
});

it('preserves a raw source-read permission error from pre-link revalidation', async (context) => {
  if (process.getuid?.() === 0)
    context.skip('Permission refusal requires a non-root user');
  const source = join(root, 'unreadable-source');
  await writeFile(source, '{"synthetic":true}\n');
  await chmod(source, 0);
  try {
    await expect(
      publishImportSeed(
        home,
        seed,
        id,
        'claude',
        bytes,
        deadline(),
        async () => {
          await readFile(source);
        },
      ),
    ).rejects.toMatchObject({ code: 'EACCES' });
    await expect(readImportSnapshot(source, deadline())).rejects.toMatchObject({
      code: 'source-unreadable',
    });
    await expect(lstat(seed)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readdir(dirname(seed))).toEqual([]);
  } finally {
    await chmod(source, 0o600);
  }
});

it('retains the original refusal when owned staging cleanup is also denied', async (context) => {
  if (process.getuid?.() === 0)
    context.skip('Permission refusal requires a non-root user');
  const refusal = new SessionImportError(
    'git-evidence-drift',
    'Git changed during publication.',
  );
  try {
    await expect(
      publishImportSeed(
        home,
        seed,
        id,
        'claude',
        bytes,
        deadline(),
        async () => {
          await chmod(dirname(seed), 0o500);
          throw refusal;
        },
      ),
    ).rejects.toBe(refusal);
    expect(refusal.code).toBe('git-evidence-drift');
    expect(refusal.message).toContain('store-cleanup-failed');
    await expect(lstat(seed)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(
      (await readdir(dirname(seed))).filter((name) =>
        name.startsWith('.session-import-'),
      ),
    ).toHaveLength(1);
  } finally {
    await chmod(dirname(seed), 0o700);
  }
});

async function importFixture(): Promise<SessionImportInput> {
  const source = join(root, 'source');
  const target = join(root, 'destination with_under');
  await mkdir(source);
  await exec('git', ['-C', source, 'init', '-q']);
  await exec('git', [
    '-C',
    source,
    '-c',
    'user.name=Synthetic',
    '-c',
    'user.email=synthetic@example.invalid',
    'commit',
    '--allow-empty',
    '-qm',
    'synthetic',
  ]);
  await exec('git', ['-C', source, 'worktree', 'add', '-qb', 'target', target]);
  const timestamp = '2026-09-30T12:00:00.000Z';
  const raw = join(
    root,
    '.codex',
    'sessions',
    '2026',
    '09',
    '30',
    `rollout-2026-09-30T12-00-00-${id}.jsonl`,
  );
  await mkdir(dirname(raw), { recursive: true });
  const records = [
    {
      type: 'session_meta',
      timestamp,
      payload: { id, cwd: source, timestamp, source: 'cli' },
    },
    {
      type: 'response_item',
      timestamp,
      payload: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'synthetic prompt' }],
      },
    },
    {
      type: 'response_item',
      timestamp,
      payload: {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'synthetic completed reply' }],
      },
    },
  ];
  await writeFile(
    raw,
    records.map((record) => JSON.stringify(record)).join('\n') + '\n',
  );
  return {
    sourcePath: source,
    destinationPath: target,
    session: `codex:cli:${id}`,
    to: 'claude',
    entryPoint: 'destination-fresh',
  };
}

for (const routing of ['default', 'environment', 'explicit'] as const) {
  it(`reports real write denial with a guarded ${routing} public apply replay`, async (context) => {
    if (process.getuid?.() === 0)
      context.skip('Permission refusal requires a non-root user');
    const input = await importFixture();
    if (routing === 'default') {
      home = join(root, '.claude');
      await mkdir(home);
    } else {
      const alias = join(root, 'home alias');
      await symlink(home, alias);
      if (routing === 'environment') process.env.CLAUDE_CONFIG_DIR = alias;
      else input.targetHome = alias;
    }
    const plan = await planSessionImport(input);
    expect(plan.targetHome.source).toBe(routing);
    const forkCommand = plan.instructions.find(
      (instruction) => instruction.kind === 'terminal',
    )?.command;
    expect(forkCommand).toContain(
      `if test "$(pwd -P)" = '${input.destinationPath}'`,
    );
    if (routing === 'environment')
      expect(forkCommand).toContain(
        `env 'CLAUDE_CONFIG_DIR=${join(root, 'home alias')}' claude --resume ${plan.seed.id} --fork-session`,
      );
    if (routing === 'default')
      expect(forkCommand).toContain('test "${CLAUDE_CONFIG_DIR+set}" != set');
    await chmod(home, 0o500);
    try {
      const error = await applySessionImport(input, plan.digest).catch(
        (reason: unknown) => reason,
      );
      expect(error).toBeInstanceOf(SessionImportError);
      const refusal = error as SessionImportError;
      expect(refusal.code).toBe('store-write-denied');
      expect(refusal.replayCommand).toContain('if test "$(pwd -P)" =');
      expect(refusal.replayCommand).toContain(process.cwd());
      expect(refusal.replayCommand).toContain(`--expect-plan ${plan.digest}`);
      expect(refusal.replayCommand).toContain('--apply');
      if (routing === 'default')
        expect(refusal.replayCommand).toContain(
          'test "${CLAUDE_CONFIG_DIR+set}" != set',
        );
      if (routing === 'environment')
        expect(refusal.replayCommand).toContain(
          `env 'CLAUDE_CONFIG_DIR=${join(root, 'home alias')}'`,
        );
      if (routing === 'explicit')
        expect(refusal.replayCommand).toContain(
          `--target-home '${join(root, 'home alias')}'`,
        );
      await expect(lstat(plan.seed.path)).rejects.toMatchObject({
        code: 'ENOENT',
      });
      expect(await readdir(home)).toEqual([]);
    } finally {
      await chmod(home, 0o700);
    }
  });
}

it('keeps secondary cleanup detail when public apply enriches a denied-link replay', async (context) => {
  if (process.getuid?.() === 0)
    context.skip('Permission refusal requires a non-root user');
  const input = { ...(await importFixture()), targetHome: home };
  const plan = await planSessionImport(input);
  const parent = dirname(plan.seed.path);
  await mkdir(parent, { recursive: true });
  let changed = false;
  let permissionError: unknown;
  let finish!: () => void;
  const changedPermissions = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const watcher = watch(parent, (_event, filename) => {
    if (changed || !filename?.startsWith('.session-import-')) return;
    changed = true;
    void chmod(parent, 0o500)
      .catch((error: unknown) => {
        permissionError = error;
      })
      .finally(finish);
  });
  try {
    const error = await applySessionImport(input, plan.digest).catch(
      (reason: unknown) => reason,
    );
    expect(changed).toBe(true);
    await changedPermissions;
    expect(permissionError).toBeUndefined();
    expect(error).toMatchObject({
      code: 'store-write-denied',
      message: expect.stringContaining(
        'Secondary cleanup failure (store-cleanup-failed)',
      ),
      replayCommand: expect.stringContaining(`--expect-plan ${plan.digest}`),
    });
    await expect(lstat(plan.seed.path)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(
      (await readdir(parent)).filter((name) =>
        name.startsWith('.session-import-'),
      ),
    ).toHaveLength(1);
  } finally {
    watcher.close();
    await chmod(parent, 0o700);
  }
});

it('refuses target home drift observed after staging through public apply', async () => {
  const input = await importFixture();
  const alias = join(root, 'home alias');
  const replacement = join(root, 'replacement-home');
  await mkdir(replacement);
  await symlink(home, alias);
  const preparedAlias = join(root, 'replacement-alias');
  await symlink(replacement, preparedAlias);
  input.targetHome = alias;
  const plan = await planSessionImport(input);
  await mkdir(dirname(plan.seed.path), { recursive: true });
  let changed = false;
  let driftError: unknown;
  let finish!: () => void;
  const drift = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const watcher = watch(dirname(plan.seed.path), (_event, filename) => {
    if (changed || !filename?.startsWith('.session-import-')) return;
    changed = true;
    void (async () => {
      try {
        await rename(preparedAlias, alias);
      } catch (error) {
        driftError = error;
      } finally {
        finish();
      }
    })();
  });
  try {
    await expect(applySessionImport(input, plan.digest)).rejects.toMatchObject({
      code: 'target-home-drift',
    });
    expect(changed).toBe(true);
    await drift;
    expect(driftError).toBeUndefined();
    await expect(lstat(plan.seed.path)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(await readdir(dirname(plan.seed.path))).toEqual([]);
    expect(await readdir(replacement)).toEqual([]);
  } finally {
    watcher.close();
  }
});
