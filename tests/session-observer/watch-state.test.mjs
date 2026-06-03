/**
 * watch-state.test.mjs — tests for scripts/lib/watch-state.mjs
 *
 * Each test uses a fresh temp STATE_DIR to ensure isolation.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { withTmpStateDir } from './helpers/tmpdir.mjs';

import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WATCH_STATE_MJS = join(__dirname, '../../skills/session-observer/scripts/lib/watch-state.mjs');

async function importWatchState() {
  const cacheBust = `?t=${Date.now()}-${Math.random()}`;
  return import(`${WATCH_STATE_MJS}${cacheBust}`);
}

test('startWatcher writes watch.json atomically with active watcher metadata', async () => {
  await withTmpStateDir(async (dir) => {
    const watchState = await importWatchState();
    const startedAt = '2026-06-03T12:00:00.000Z';

    const active = await watchState.startWatcher({
      runtime: 'codex',
      cwd: '/repo',
      pid: process.pid,
      startedAt,
    });

    assert.deepEqual(active, {
      pid: process.pid,
      runtime: 'codex',
      cwd: '/repo',
      startedAt,
      lastEventAt: null,
      eventCount: 0,
    });

    const raw = JSON.parse(await readFile(join(dir, 'watch.json'), 'utf8'));
    assert.equal(raw.schemaVersion, 1);
    assert.deepEqual(raw.active, active);

    const files = await readdir(dir);
    assert.deepEqual(files.filter((file) => file.endsWith('.tmp')), []);
  });
});

test('startWatcher refuses a second watcher for the same runtime and cwd when pid is live', async () => {
  await withTmpStateDir(async () => {
    const watchState = await importWatchState();
    await watchState.startWatcher({
      runtime: 'codex',
      cwd: '/repo',
      pid: process.pid,
      startedAt: '2026-06-03T12:00:00.000Z',
    });

    await assert.rejects(
      () => watchState.startWatcher({
        runtime: 'codex',
        cwd: '/repo',
        pid: process.pid,
        startedAt: '2026-06-03T12:01:00.000Z',
      }),
      /already active/i
    );
  });
});

test('startWatcher clears a stale active pid before registering the new watcher', async (t) => {
  await withTmpStateDir(async (dir) => {
    const watchState = await importWatchState();
    await writeFile(
      join(dir, 'watch.json'),
      JSON.stringify({
        schemaVersion: 1,
        active: {
          pid: 424242,
          runtime: 'codex',
          cwd: '/repo',
          startedAt: '2026-06-03T11:00:00.000Z',
          lastEventAt: null,
          eventCount: 0,
        },
      }),
      'utf8'
    );

    t.mock.method(process, 'kill', (pid, signal) => {
      assert.equal(signal, 0);
      if (pid === 424242) {
        const err = new Error('no such process');
        err.code = 'ESRCH';
        throw err;
      }
      return true;
    });

    const active = await watchState.startWatcher({
      runtime: 'codex',
      cwd: '/repo',
      pid: process.pid,
      startedAt: '2026-06-03T12:00:00.000Z',
    });

    assert.equal(active.pid, process.pid);
    const raw = JSON.parse(await readFile(join(dir, 'watch.json'), 'utf8'));
    assert.equal(raw.active.pid, process.pid);
    assert.equal(raw.active.startedAt, '2026-06-03T12:00:00.000Z');
  });
});

test('control directives are written to and read from watch.control.json', async () => {
  await withTmpStateDir(async (dir) => {
    const watchState = await importWatchState();
    const issuedAt = '2026-06-03T12:02:00.000Z';

    await watchState.writeControlDirective('pause', { issuedAt });

    const raw = JSON.parse(await readFile(join(dir, 'watch.control.json'), 'utf8'));
    assert.deepEqual(raw, { directive: 'pause', issuedAt });

    const directive = await watchState.readControlDirective();
    assert.deepEqual(directive, { directive: 'pause', issuedAt });
  });
});
