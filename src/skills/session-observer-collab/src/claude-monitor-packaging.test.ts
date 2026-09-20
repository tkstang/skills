import { spawnSync } from 'node:child_process';
import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { distributions } from '../../../distributions.js';

describe('Claude Monitor packaging declaration', () => {
  test('uses shared collaboration ownership without the messaging source root', () => {
    const declaration = distributions.find(
      (candidate) => candidate.owner === 'session-observer-collab',
    );
    expect(declaration?.allowedSourceRoots).toContain(
      'src/shared/collaboration',
    );
    expect(declaration?.allowedSourceRoots).not.toContain(
      'src/skills/agent-messaging',
    );
  });

  test('declares the finite Monitor as an observer-collab runtime entrypoint', async () => {
    const build = JSON.parse(
      await readFile(
        path.resolve('src/skills/session-observer-collab/build.json'),
        'utf8',
      ),
    ) as { runtime: string[] };
    expect(build.runtime).toContain('src/claude-monitor.mjs');
    const source = await readFile(
      path.resolve('src/skills/session-observer-collab/src/claude-monitor.mjs'),
      'utf8',
    );
    expect(source).not.toMatch(/catch-up-then-watch|spawn\s*\(/u);
    expect(source).toContain('MAX_MONITOR_RUNTIME_MS');
  });

  test.each([
    'skills/session-observer-collab',
    'plugins/consensus/skills/observer-collab',
  ])(
    'executes copied %s Monitor through real and symlinked paths',
    async (relative) => {
      const source = path.resolve(relative);
      const destination = await mkdtemp(
        path.join(tmpdir(), 'claude-monitor-installed-'),
      );
      const linkedDestination = `${destination}-linked`;
      try {
        await cp(source, destination, { recursive: true });
        await symlink(destination, linkedDestination, 'dir');

        for (const installed of [destination, linkedDestination]) {
          const result = spawnSync(
            process.execPath,
            [
              path.join(installed, 'scripts', 'claude-monitor.mjs'),
              '--self',
              'bad',
            ],
            {
              encoding: 'utf8',
              env: { HOME: destination, PATH: process.env.PATH },
            },
          );
          expect(result.status).toBe(1);
          expect(result.stderr).toContain('claude-monitor:');
          expect(result.stderr).toContain(
            '--self must use <runtime>:<session-id>',
          );
        }
      } finally {
        await rm(linkedDestination, { recursive: true, force: true });
        await rm(destination, { recursive: true, force: true });
      }
    },
  );

  test.each([
    {
      observer: 'skills/session-observer-collab',
      messaging: 'skills/agent-messaging',
    },
    {
      observer: 'plugins/consensus/skills/observer-collab',
      messaging: 'plugins/session/skills/messaging',
    },
  ])(
    'executes the documented composed sequence from copied $observer and $messaging bundles at one explicit root',
    async ({ observer, messaging }) => {
      const temporaryDirectory = await mkdtemp(
        path.join(tmpdir(), 'claude-monitor-sequence-'),
      );
      const temporary = await realpath(temporaryDirectory);
      try {
        const observerInstall = path.join(temporary, 'observer');
        const messagingInstall = path.join(temporary, 'messaging');
        const root = path.join(temporary, 'state');
        const home = path.join(temporary, 'home');
        const cwd = path.join(temporary, 'worktree');
        const transcript = path.join(temporary, 'peer.jsonl');
        const settings = path.join(home, '.claude', 'settings.json');
        const collaborationId = '11111111-1111-4111-8111-111111111111';
        const activationId = '22222222-2222-4222-8222-222222222222';
        await Promise.all([
          cp(path.resolve(observer), observerInstall, { recursive: true }),
          cp(path.resolve(messaging), messagingInstall, { recursive: true }),
          mkdir(path.dirname(settings), { recursive: true }),
          mkdir(cwd, { recursive: true }),
        ]);
        await writeFile(settings, '{}\n');
        await writeFile(
          transcript,
          `${JSON.stringify({
            type: 'user',
            message: { role: 'user', content: 'hello' },
            sessionId: 'peer-1',
            uuid: 'user-1',
            timestamp: '2026-09-19T00:00:00.000Z',
          })}\n`,
        );
        const env: NodeJS.ProcessEnv = { ...process.env, HOME: home };
        delete env.SESSION_OBSERVER_STATE_DIR;
        delete env.XDG_STATE_HOME;
        delete env.CODEX_THREAD_ID;
        delete env.CLAUDE_SESSION_ID;
        delete env.CURSOR_SESSION_ID;
        const invoke = (script: string, args: string[]) =>
          spawnSync(process.execPath, [script, ...args], {
            cwd,
            encoding: 'utf8',
            env,
          });
        const messagingScript = path.join(
          messagingInstall,
          'scripts',
          'agent-messaging.mjs',
        );
        const controlScript = path.join(
          observerInstall,
          'scripts',
          'collab-control.mjs',
        );
        const monitorScript = path.join(
          observerInstall,
          'scripts',
          'claude-monitor.mjs',
        );

        const opened = invoke(messagingScript, [
          'open',
          '--root',
          root,
          '--collab',
          collaborationId,
          '--self',
          'claude-code:self-1',
          '--alias',
          'self',
          '--label',
          'packaging',
          '--task',
          'composed Monitor sequence',
          '--json',
        ]);
        expect(opened.status, opened.stderr).toBe(0);

        const compositionArgs = [
          '--root',
          root,
          '--runtime',
          'claude-code',
          '--peer-runtime',
          'claude-code',
          '--session',
          'self-1',
          '--peer-session',
          'peer-1',
          '--cwd',
          cwd,
          '--peer-transcript',
          transcript,
          '--collaboration-id',
          collaborationId,
          '--activation-id',
          activationId,
          '--confirm-old-monitor-stopped',
          '--confirm-standalone-watcher-stopped',
        ];
        const armArgs = [
          'arm',
          ...compositionArgs,
          '--cursor',
          '0',
          '--lease-ms',
          '30000',
          '--continuation-cap',
          '20',
          '--loop-cap',
          '100',
        ];
        const armed = invoke(controlScript, armArgs);
        expect(armed.status, armed.stderr).toBe(0);
        await expect(
          readFile(path.join(root, 'leases', 'self-1.json'), 'utf8'),
        ).resolves.toContain(activationId);
        await expect(
          readFile(
            path.join(
              home,
              '.local',
              'state',
              'session-observer',
              'collab',
              'leases',
              'self-1.json',
            ),
            'utf8',
          ),
        ).rejects.toMatchObject({ code: 'ENOENT' });

        const enabled = invoke(messagingScript, [
          'delivery',
          'enable',
          '--root',
          root,
          '--collab',
          collaborationId,
          '--self',
          'claude-code:self-1',
          '--cwd',
          cwd,
          '--activation-id',
          activationId,
          '--controller',
          'observer-collab',
          '--mechanism',
          'monitor',
          '--expires-in',
          '30m',
          '--max-duration',
          '30m',
          '--max-continuations',
          '20',
          '--settings-paths',
          settings,
          '--confirm-old-monitor-stopped',
          '--confirm-standalone-watcher-stopped',
          '--json',
        ]);
        expect(enabled.status, enabled.stderr).toBe(0);

        const monitored = invoke(monitorScript, [
          '--root',
          root,
          '--collaboration-id',
          collaborationId,
          '--activation-id',
          activationId,
          '--self',
          'claude-code:self-1',
          '--peer',
          'claude-code:peer-1',
          '--cwd',
          cwd,
          '--peer-transcript',
          transcript,
          '--max-runtime-ms',
          '5',
          '--poll-ms',
          '1',
          '--confirm-old-monitor-stopped',
          '--confirm-standalone-watcher-stopped',
        ]);
        expect(monitored.status, monitored.stderr).toBe(0);
        expect(monitored.stderr).toContain('claude-monitor: duration-complete');

        const rearmed = invoke(controlScript, ['arm', ...compositionArgs]);
        expect(rearmed.status, rearmed.stderr).toBe(0);
      } finally {
        await rm(temporary, { recursive: true, force: true });
      }
    },
  );
});
