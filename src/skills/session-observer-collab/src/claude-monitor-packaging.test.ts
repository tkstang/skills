import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

describe('Claude Monitor packaging declaration', () => {
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
      await cp(source, destination, { recursive: true });
      const linkedDestination = `${destination}-linked`;
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
      }
    },
  );
});
