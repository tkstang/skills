import { execFile } from 'node:child_process';
import {
  chmod,
  mkdtemp,
  mkdir,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HandoffGitTargetEvidence } from './git-target.js';
import {
  GuidancePreparationError,
  prepareForkGuidance,
  quoteShellWord,
} from './guidance.js';

const execFileAsync = promisify(execFile);
const cleanup: string[] = [];
const ID = '550e8400-e29b-41d4-a716-446655440000';

function evidence(target = '/repo/target'): HandoffGitTargetEvidence {
  const item = (path: string, dirty: boolean) => ({
    requestedPath: path,
    canonicalPath: path,
    worktreeRoot: path,
    commonGitDir: '/repo/.git',
    branch: 'main',
    head: 'a'.repeat(40),
    dirty,
    statusFingerprint: 'b'.repeat(64),
  });
  return { source: item('/repo/source', false), target: item(target, true) };
}

describe('destination-side fork guidance', () => {
  it('builds terminal guidance with a canonical cwd guard and explicit source selector', async () => {
    const validateTarget = vi.fn(async () => evidence("/repo/target's $place"));
    const result = await prepareForkGuidance(
      {
        sourcePath: '/repo/source',
        destinationPath: '/repo/target-alias',
        entryPoint: 'source-other',
        candidate: {
          key: `codex:cli:${ID}`,
          provider: 'codex',
          surface: 'cli',
          nativeId: ID,
          recordedCwd: '/repo/source',
          modifiedAtMs: 1,
          size: 1,
          engagement: 'engaged',
          originEvidence: 'cli-transcript',
        },
      },
      { validateTarget },
    );

    expect(validateTarget).toHaveBeenCalledWith(
      '/repo/source',
      '/repo/target-alias',
    );
    expect(result.destinationDirty).toBe(true);
    expect(result.expectedEffect).toContain('new fork');
    expect(result.instructions).toHaveLength(1);
    expect(result.instructions[0]).toMatchObject({
      kind: 'terminal',
      runIn: "/repo/target's $place",
    });
    const command =
      result.instructions[0].kind === 'terminal'
        ? result.instructions[0].command
        : '';
    expect(command).toContain(quoteShellWord("/repo/target's $place"));
    expect(command).toContain(`codex fork ${ID}`);
    expect(command).not.toContain('--print');
    expect(command).not.toContain('--json');
    expect(command).not.toContain('resume');
  });

  it('executes only a mock provider when cwd matches and refuses from another cwd', async () => {
    const root = await mkdtemp(join(tmpdir(), 'guidance-shell-'));
    cleanup.push(root);
    const destination = join(root, "target's $dir");
    const wrong = join(root, 'wrong');
    const bin = join(root, 'bin');
    await mkdir(destination);
    await mkdir(wrong);
    await mkdir(bin);
    const canonicalDestination = await realpath(destination);
    await writeFile(
      join(bin, 'codex'),
      '#!/bin/sh\nprintf "mock:%s\\n" "$*"\n',
    );
    await chmod(join(bin, 'codex'), 0o755);

    const prepared = await prepareForkGuidance(
      {
        sourcePath: '/repo/source',
        destinationPath: destination,
        entryPoint: 'source-current',
        candidate: {
          key: `codex:cli:${ID}`,
          provider: 'codex',
          surface: 'cli',
          nativeId: ID,
          recordedCwd: '/repo/source',
          modifiedAtMs: 1,
          size: 1,
          engagement: 'engaged',
          originEvidence: 'cli-transcript',
        },
      },
      { validateTarget: async () => evidence(canonicalDestination) },
    );
    const instruction = prepared.instructions[0];
    if (instruction.kind !== 'terminal')
      throw new Error('expected terminal instruction');
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}` };
    await expect(
      execFileAsync('sh', ['-c', instruction.command], {
        cwd: destination,
        env,
      }),
    ).resolves.toMatchObject({
      stdout: `mock:fork ${ID}\n`,
    });
    await expect(
      execFileAsync(
        'sh',
        ['-c', `${instruction.command}; printf shell-alive`],
        {
          cwd: wrong,
          env,
        },
      ),
    ).resolves.toMatchObject({
      stdout: 'shell-alive',
      stderr: expect.stringContaining(
        'Refusing: open the canonical destination worktree first.',
      ),
    });
  });

  it('uses exit-then-relaunch for a fresh destination when no native switch is documented', async () => {
    const result = await prepareForkGuidance(
      {
        sourcePath: '/repo/source',
        destinationPath: '/repo/target',
        entryPoint: 'destination-fresh',
        candidate: {
          key: `claude:cli:${ID}`,
          provider: 'claude',
          surface: 'cli',
          nativeId: ID,
          recordedCwd: '/repo/source',
          modifiedAtMs: 1,
          size: 1,
          engagement: 'engaged',
          originEvidence: 'cli-transcript',
        },
      },
      { validateTarget: async () => evidence() },
    );

    expect(result.instructions.map(({ kind }) => kind)).toEqual([
      'manual',
      'terminal',
    ]);
    expect(result.instructions[0]).toMatchObject({
      action: 'exit-current-session',
    });
    expect(JSON.stringify(result)).toContain('--fork-session');
    expect(JSON.stringify(result)).not.toContain('nested');
  });

  it('explains unsupported Cursor transitions without guessing syntax', async () => {
    const result = await prepareForkGuidance(
      {
        sourcePath: '/repo/source',
        destinationPath: '/repo/target',
        entryPoint: 'destination-fresh',
        candidate: {
          key: 'cursor:ambiguous:cursor-chat',
          provider: 'cursor',
          surface: 'ambiguous',
          nativeId: 'cursor-chat',
          recordedCwd: '/repo/source',
          modifiedAtMs: 1,
          size: 1,
          engagement: 'engaged',
          originEvidence: 'store-origin-ambiguous',
        },
      },
      { validateTarget: async () => evidence() },
    );

    expect(result.instructions).toEqual([
      expect.objectContaining({ kind: 'manual', action: 'unsupported' }),
    ]);
    expect(JSON.stringify(result)).not.toContain('cursor-agent --resume');
  });

  it.each(['bad id', '-flag', 'id; touch /tmp/nope', 'id\nnext'])(
    'rejects invalid provider IDs: %s',
    async (nativeId) => {
      await expect(
        prepareForkGuidance(
          {
            sourcePath: '/repo/source',
            destinationPath: '/repo/target',
            entryPoint: 'source-other',
            candidate: {
              key: `codex:cli:${nativeId}`,
              provider: 'codex',
              surface: 'cli',
              nativeId,
              recordedCwd: '/repo/source',
              modifiedAtMs: 1,
              size: 1,
              engagement: 'engaged',
              originEvidence: 'cli-transcript',
            },
          },
          { validateTarget: async () => evidence() },
        ),
      ).rejects.toBeInstanceOf(GuidancePreparationError);
    },
  );
});

afterEach(async () => {
  await Promise.all(
    cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
