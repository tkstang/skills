import { readFile } from 'node:fs/promises';
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
});
