/**
 * watch-state.test.ts — tests for src/transcript/session-observer/lib/watch-state.ts
 *
 * Each test uses a fresh temp STATE_DIR to ensure isolation.
 */

import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, test, vi } from 'vitest';

import * as watchState from '../../src/transcript/session-observer/lib/watch-state.js';
import { withTmpStateDir } from './helpers/tmpdir.js';

afterEach(() => {
  vi.restoreAllMocks();
});

test('startWatcher writes watch.json atomically with active watcher metadata', async () => {
  await withTmpStateDir(async (dir) => {
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
      requestedRuntime: 'codex',
      cwd: '/repo',
      session: null,
      startedAt,
      pollSec: null,
      debounceSec: null,
      maxPendingSec: null,
      heartbeatSec: null,
      staleAfterSec: null,
      lastPollAt: null,
      lastEventAt: null,
      eventCount: 0,
      resolvedRuntime: null,
      sessionId: null,
      transcriptPath: null,
      targets: [],
      lastError: null,
    });

    const raw = JSON.parse(await readFile(join(dir, 'watch.json'), 'utf8'));
    assert.equal(raw.schemaVersion, 1);
    assert.deepEqual(raw.active, active);
    assert.deepEqual(raw.watchers, [active]);

    const files = await readdir(dir);
    assert.deepEqual(
      files.filter((file) => file.endsWith('.tmp')),
      [],
    );
  });
});

test('startWatcher refuses a second watcher for the same pid when pid is live', async () => {
  await withTmpStateDir(async () => {
    await watchState.startWatcher({
      runtime: 'codex',
      cwd: '/repo',
      pid: process.pid,
      startedAt: '2026-06-03T12:00:00.000Z',
    });

    await assert.rejects(
      () =>
        watchState.startWatcher({
          runtime: 'codex',
          cwd: '/repo',
          pid: process.pid,
          startedAt: '2026-06-03T12:01:00.000Z',
        }),
      /already active/i,
    );
  });
});

test('startWatcher allows concurrent live watchers in the same cwd for different pids', async () => {
  await withTmpStateDir(async (dir) => {
    vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      assert.equal(signal, 0);
      if (pid === 111 || pid === 222) return true;
      return true;
    });

    await watchState.startWatcher({
      runtime: 'codex',
      cwd: '/repo',
      pid: 111,
      startedAt: '2026-06-03T12:00:00.000Z',
    });
    const second = await watchState.startWatcher({
      runtime: 'claude-code',
      cwd: '/repo',
      pid: 222,
      startedAt: '2026-06-03T12:00:01.000Z',
    });

    assert.equal(second.pid, 222);
    const raw = JSON.parse(await readFile(join(dir, 'watch.json'), 'utf8'));
    assert.equal(raw.active.pid, 111);
    assert.equal(raw.watchers.length, 2);
    assert.deepEqual(
      raw.watchers.map((watcher: any) => watcher.pid),
      [111, 222],
    );
  });
});

test('startWatcher clears a stale active pid before registering the new watcher', async () => {
  await withTmpStateDir(async (dir) => {
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
      'utf8',
    );

    vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      assert.equal(signal, 0);
      if (pid === 424242) {
        const err = new Error('no such process') as NodeJS.ErrnoException;
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
    assert.equal(raw.watchers.length, 1);
    assert.equal(raw.watchers[0].pid, process.pid);
  });
});

test('control directives are written to and read from watch.control.json', async () => {
  await withTmpStateDir(async (dir) => {
    const issuedAt = '2026-06-03T12:02:00.000Z';

    await watchState.writeControlDirective('pause', { issuedAt });

    const raw = JSON.parse(
      await readFile(join(dir, 'watch.control.json'), 'utf8'),
    );
    assert.deepEqual(raw, { directive: 'pause', issuedAt });

    const directive = await watchState.readControlDirective();
    assert.deepEqual(directive, { directive: 'pause', issuedAt });
  });
});

test('pid-targeted control directives use per-pid files and do not overwrite each other', async () => {
  await withTmpStateDir(async (dir) => {
    const issuedAt = '2026-06-03T12:02:00.000Z';

    await watchState.writeControlDirective('pause', { issuedAt, pid: 111 });
    await watchState.writeControlDirective('stop', { issuedAt, pid: 222 });

    const first = JSON.parse(
      await readFile(join(dir, 'watch.control.111.json'), 'utf8'),
    );
    const second = JSON.parse(
      await readFile(join(dir, 'watch.control.222.json'), 'utf8'),
    );
    assert.deepEqual(first, { directive: 'pause', issuedAt, pid: 111 });
    assert.deepEqual(second, { directive: 'stop', issuedAt, pid: 222 });

    assert.deepEqual(await watchState.readControlDirective({ pid: 111 }), {
      directive: 'pause',
      issuedAt,
      pid: 111,
    });
    assert.deepEqual(await watchState.readControlDirective({ pid: 222 }), {
      directive: 'stop',
      issuedAt,
      pid: 222,
    });

    // Clearing one pid's directive leaves the other untouched.
    assert.equal(await watchState.clearControlDirective({ pid: 111 }), true);
    assert.equal(await watchState.readControlDirective({ pid: 111 }), null);
    assert.deepEqual(await watchState.readControlDirective({ pid: 222 }), {
      directive: 'stop',
      issuedAt,
      pid: 222,
    });
  });
});

test('readControlDirective falls back to legacy pid-less directives', async () => {
  await withTmpStateDir(async () => {
    const issuedAt = '2026-06-03T12:02:00.000Z';

    await watchState.writeControlDirective('flush', { issuedAt });

    assert.deepEqual(await watchState.readControlDirective({ pid: 333 }), {
      directive: 'flush',
      issuedAt,
    });

    // A pid-scoped clear consumes a pid-less legacy directive too.
    assert.equal(await watchState.clearControlDirective({ pid: 333 }), true);
    assert.equal(await watchState.readControlDirective({ pid: 333 }), null);
  });
});

test('clearStaleControlDirectives removes directives for dead pids only', async () => {
  await withTmpStateDir(async (dir) => {
    const issuedAt = '2026-06-03T12:02:00.000Z';
    vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      assert.equal(signal, 0);
      if (pid === 424242) {
        const err = new Error('no such process') as NodeJS.ErrnoException;
        err.code = 'ESRCH';
        throw err;
      }
      return true;
    });

    await watchState.writeControlDirective('pause', { issuedAt, pid: 424242 });
    await watchState.writeControlDirective('pause', {
      issuedAt,
      pid: process.pid,
    });

    const cleared = await watchState.clearStaleControlDirectives();
    assert.equal(cleared, 1);
    assert.equal(await watchState.readControlDirective({ pid: 424242 }), null);
    assert.deepEqual(
      await watchState.readControlDirective({ pid: process.pid }),
      { directive: 'pause', issuedAt, pid: process.pid },
    );
  });
});

test('findLiveWatcherForTarget reports a conflicting live watcher for the same target', async () => {
  await withTmpStateDir(async () => {
    vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      assert.equal(signal, 0);
      return true;
    });

    await watchState.startWatcher({
      runtime: 'codex',
      cwd: '/repo',
      pid: 111,
      startedAt: '2026-06-03T12:00:00.000Z',
    });
    await watchState.recordWatcherTarget({
      pid: 111,
      target: {
        runtime: 'codex',
        sessionId: 'abc',
        transcriptPath: '/tmp/abc.jsonl',
      },
    });

    const conflict = await watchState.findLiveWatcherForTarget({
      runtime: 'codex',
      sessionId: 'abc',
      excludePid: 222,
    });
    assert.equal(conflict?.pid, 111);

    // The owning watcher itself is excluded.
    assert.equal(
      await watchState.findLiveWatcherForTarget({
        runtime: 'codex',
        sessionId: 'abc',
        excludePid: 111,
      }),
      null,
    );

    // A different session is not a conflict.
    assert.equal(
      await watchState.findLiveWatcherForTarget({
        runtime: 'codex',
        sessionId: 'other',
        excludePid: 222,
      }),
      null,
    );
  });
});

test('recordWatcherTarget rejects an overlapping live target under the lock', async () => {
  await withTmpStateDir(async () => {
    vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      assert.equal(signal, 0);
      return true;
    });

    await watchState.startWatcher({
      runtime: 'codex',
      cwd: '/repo',
      pid: 111,
      startedAt: '2026-06-11T12:00:00.000Z',
    });
    await watchState.startWatcher({
      runtime: 'codex',
      cwd: '/repo',
      pid: 222,
      startedAt: '2026-06-11T12:00:01.000Z',
    });

    const target = {
      runtime: 'codex',
      sessionId: 'abc',
      transcriptPath: '/tmp/abc.jsonl',
    };
    await watchState.recordWatcherTarget({ pid: 111, target });

    // Both watchers passed the pre-check before either recorded; the locked
    // write is the authoritative gate for the loser.
    await assert.rejects(
      () => watchState.recordWatcherTarget({ pid: 222, target }),
      (err: any) => {
        assert.match(err.message, /already watching codex:abc/);
        assert.equal(err.code, 'DUPLICATE_WATCH_TARGET');
        assert.equal(err.conflictPid, 111);
        return true;
      },
    );

    // Re-recording the same target for the owning pid stays allowed.
    const updated = await watchState.recordWatcherTarget({ pid: 111, target });
    assert.equal(updated.targets.length, 1);
  });
});

test('findLiveWatcherForTarget falls back to legacy top-level fields when targets[] is absent', async () => {
  await withTmpStateDir(async (dir) => {
    vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      assert.equal(signal, 0);
      return true;
    });

    // Legacy single-`active` record lifted into watchers[]: resolved target
    // lives at the top level, no targets[] array.
    await writeFile(
      join(dir, 'watch.json'),
      JSON.stringify({
        schemaVersion: 1,
        active: {
          pid: 111,
          runtime: 'codex',
          resolvedRuntime: 'codex',
          sessionId: 'legacy-session',
          transcriptPath: '/tmp/legacy.jsonl',
          startedAt: '2026-06-11T11:00:00.000Z',
          lastEventAt: null,
          eventCount: 0,
        },
      }),
      'utf8',
    );

    const conflict = await watchState.findLiveWatcherForTarget({
      runtime: 'codex',
      sessionId: 'legacy-session',
      excludePid: 222,
    });
    assert.equal(conflict?.pid, 111);

    assert.equal(
      await watchState.findLiveWatcherForTarget({
        runtime: 'codex',
        sessionId: 'other-session',
        excludePid: 222,
      }),
      null,
    );

    // The locked recordWatcherTarget gate honors legacy records too.
    await watchState.startWatcher({
      runtime: 'codex',
      cwd: '/repo',
      pid: 222,
      startedAt: '2026-06-11T12:00:00.000Z',
    });
    await assert.rejects(
      () =>
        watchState.recordWatcherTarget({
          pid: 222,
          target: {
            runtime: 'codex',
            sessionId: 'legacy-session',
            transcriptPath: '/tmp/legacy.jsonl',
          },
        }),
      /already watching codex:legacy-session/,
    );
  });
});

test('recordWatcherTarget stores resolved pinned target metadata', async () => {
  await withTmpStateDir(async () => {
    await watchState.startWatcher({
      runtime: 'auto',
      cwd: '/repo',
      session: 'codex:abc',
      pid: process.pid,
      startedAt: '2026-06-03T12:00:00.000Z',
    });

    const active = await watchState.recordWatcherTarget({
      pid: process.pid,
      target: {
        runtime: 'codex',
        sessionId: 'abc',
        transcriptPath: '/tmp/abc.jsonl',
        recordedCwd: '/repo',
        recordCount: 5,
        baselineRecordIndex: 5,
        engagementStatus: 'engaged',
        lockedAt: '2026-06-03T12:00:01.000Z',
      },
    });

    assert.equal(active.requestedRuntime, 'auto');
    assert.equal(active.resolvedRuntime, 'codex');
    assert.equal(active.sessionId, 'abc');
    assert.equal(active.transcriptPath, '/tmp/abc.jsonl');
    assert.equal(active.targets.length, 1);
    assert.equal(active.targets[0].baselineRecordIndex, 5);
  });
});

test('recordWatcherPoll and recordWatcherError update active heartbeat fields', async () => {
  await withTmpStateDir(async () => {
    await watchState.startWatcher({
      runtime: 'codex',
      cwd: '/repo',
      pid: process.pid,
      startedAt: '2026-06-03T12:00:00.000Z',
    });

    await watchState.recordWatcherPoll({
      pid: process.pid,
      lastPollAt: '2026-06-03T12:00:03.000Z',
    });
    const active = await watchState.recordWatcherError({
      pid: process.pid,
      error: new Error('poll failed'),
      at: '2026-06-03T12:00:04.000Z',
    });

    assert.equal(active.lastPollAt, '2026-06-03T12:00:03.000Z');
    assert.equal(active.lastError.message, 'poll failed');
  });
});
