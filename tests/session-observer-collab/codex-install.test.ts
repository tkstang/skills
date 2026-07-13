import { spawn } from 'node:child_process';
import {
  access,
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { run } from '../../skills/session-observer-collab/scripts/collab-control.mjs';

const roots: string[] = [];

function executeHook(scriptPath: string, cwd: string, env: NodeJS.ProcessEnv) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const child = spawn(process.execPath, ['--', scriptPath], { cwd, env });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => (stdout += chunk));
      child.stderr.on('data', (chunk) => (stderr += chunk));
      child.once('error', reject);
      child.once('close', (code) => resolve({ code, stdout, stderr }));
      child.stdin.end(
        `${JSON.stringify({ hook_event_name: 'Stop', session_id: 'none', cwd })}\n`,
      );
    },
  );
}

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('installed Codex Stop hook bundle', () => {
  test('runs outside the repository and survives idempotent reinstall', async () => {
    const home = await mkdtemp(join(tmpdir(), 'codex-install-'));
    roots.push(home);
    const outside = join(home, 'outside');
    const hooksPath = join(home, '.codex', 'hooks.json');
    const scriptPath = join(
      home,
      '.codex',
      'hooks',
      'session-observer-collab-stop.mjs',
    );
    const stateRoot = join(home, 'state');
    await mkdir(outside);
    const env = {
      ...process.env,
      HOME: home,
      SESSION_OBSERVER_STATE_DIR: stateRoot,
    };

    const first = await run(
      ['codex-install', '--hooks-path', hooksPath, '--script-path', scriptPath],
      env,
    );
    const launcher = await readFile(scriptPath, 'utf8');
    const firstRun = await executeHook(scriptPath, outside, env);
    const second = await run(
      ['codex-install', '--hooks-path', hooksPath, '--script-path', scriptPath],
      env,
    );
    const secondRun = await executeHook(scriptPath, outside, env);

    expect(first).toMatchObject({ bundle: { changed: true } });
    expect(second).toMatchObject({ bundle: { changed: false } });
    expect(await readFile(scriptPath, 'utf8')).toBe(launcher);
    expect(firstRun).toEqual({ code: 0, stdout: '', stderr: '' });
    expect(secondRun).toEqual({ code: 0, stdout: '', stderr: '' });
    expect(firstRun.stderr).not.toContain('ERR_MODULE_NOT_FOUND');
    expect((await stat(scriptPath)).mode & 0o777).toBe(0o700);

    const supportRoot = join(
      dirname(scriptPath),
      '.session-observer-collab-stop.mjs.support',
    );
    const versions = (await readdir(supportRoot)).filter(
      (name) => !name.startsWith('.stage-'),
    );
    expect(versions).toHaveLength(1);
    expect((await stat(join(supportRoot, versions[0]))).mode & 0o777).toBe(
      0o700,
    );
    expect(
      (
        await stat(
          join(
            supportRoot,
            versions[0],
            '.session-observer-collab-bundle.json',
          ),
        )
      ).mode & 0o777,
    ).toBe(0o600);
    expect(
      (
        await stat(
          join(
            supportRoot,
            versions[0],
            'session-observer-collab/scripts/hooks/codex-stop.mjs',
          ),
        )
      ).mode & 0o777,
    ).toBe(0o600);
  });

  test('cleans a failed publish and removes only owned installed artifacts', async () => {
    const home = await mkdtemp(join(tmpdir(), 'codex-install-cleanup-'));
    roots.push(home);
    const hooksPath = join(home, '.codex', 'hooks.json');
    const scriptPath = join(home, '.codex', 'hooks', 'observer.mjs');
    const stateRoot = join(home, 'state');
    const env = {
      ...process.env,
      HOME: home,
      SESSION_OBSERVER_STATE_DIR: stateRoot,
    };
    await mkdir(scriptPath, { recursive: true });

    await expect(
      run(
        [
          'codex-install',
          '--hooks-path',
          hooksPath,
          '--script-path',
          scriptPath,
        ],
        env,
      ),
    ).rejects.toThrow();
    const supportRoot = join(dirname(scriptPath), '.observer.mjs.support');
    await expect(access(supportRoot)).rejects.toMatchObject({ code: 'ENOENT' });

    await chmod(scriptPath, 0o700);
    const { rm } = await import('node:fs/promises');
    await rm(scriptPath, { recursive: true });
    await run(
      ['codex-install', '--hooks-path', hooksPath, '--script-path', scriptPath],
      env,
    );
    await writeFile(join(supportRoot, 'user-note.txt'), 'not observer-owned\n');
    const removed = await run(
      [
        'codex-uninstall',
        '--hooks-path',
        hooksPath,
        '--script-path',
        scriptPath,
        '--confirmed',
        '--remove-script',
      ],
      env,
    );
    expect(removed).toMatchObject({
      scriptRemoved: true,
      supportRemoved: false,
    });
    await expect(access(scriptPath)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readFile(join(supportRoot, 'user-note.txt'), 'utf8')).toBe(
      'not observer-owned\n',
    );
  });
});
