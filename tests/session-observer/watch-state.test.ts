/**
 * watch-state.test.ts — tests for src/transcript/session-observer/lib/watch-state.ts
 *
 * Each test uses a fresh temp STATE_DIR to ensure isolation.
 */

import { readFile, readdir, writeFile, unlink, utimes } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, afterEach, test, vi } from 'vitest';

import * as watchState from '../../src/transcript/session-observer/lib/watch-state.js';
import type { WatcherRecord } from '../../src/transcript/session-observer/lib/types.js';
import { withTmpStateDir } from './helpers/tmpdir.js';

function assertWatcherRecord(value: unknown): asserts value is WatcherRecord {
  expect(value && typeof value === 'object' && 'pid' in value).toBeTruthy();
}

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

    expect(active).toEqual({
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
    expect(raw.schemaVersion).toBe(1);
    expect(raw.active).toEqual(active);
    expect(raw.watchers).toEqual([active]);

    const files = await readdir(dir);
    expect(files.filter((file) => file.endsWith('.tmp'))).toEqual([]);
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

    await expect(
      () =>
        watchState.startWatcher({
          runtime: 'codex',
          cwd: '/repo',
          pid: process.pid,
          startedAt: '2026-06-03T12:01:00.000Z',
        }),
    ).rejects.toThrow(/already active/i);
  });
});

test('startWatcher allows concurrent live watchers in the same cwd for different pids', async () => {
  await withTmpStateDir(async (dir) => {
    vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      expect(signal).toBe(0);
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

    expect(second.pid).toBe(222);
    const raw = JSON.parse(await readFile(join(dir, 'watch.json'), 'utf8'));
    expect(raw.active.pid).toBe(111);
    expect(raw.watchers.length).toBe(2);
    expect(raw.watchers.map((watcher: any) => watcher.pid)).toEqual([111, 222]);
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
      expect(signal).toBe(0);
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

    expect(active.pid).toBe(process.pid);
    const raw = JSON.parse(await readFile(join(dir, 'watch.json'), 'utf8'));
    expect(raw.active.pid).toBe(process.pid);
    expect(raw.active.startedAt).toBe('2026-06-03T12:00:00.000Z');
    expect(raw.watchers.length).toBe(1);
    expect(raw.watchers[0].pid).toBe(process.pid);
  });
});

test('control directives are written to and read from watch.control.json', async () => {
  await withTmpStateDir(async (dir) => {
    const issuedAt = '2026-06-03T12:02:00.000Z';

    await watchState.writeControlDirective('pause', { issuedAt });

    const raw = JSON.parse(
      await readFile(join(dir, 'watch.control.json'), 'utf8'),
    );
    expect(raw).toEqual({ directive: 'pause', issuedAt });

    const directive = await watchState.readControlDirective();
    expect(directive).toEqual({ directive: 'pause', issuedAt });
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
    expect(first).toEqual({ directive: 'pause', issuedAt, pid: 111 });
    expect(second).toEqual({ directive: 'stop', issuedAt, pid: 222 });

    expect(await watchState.readControlDirective({ pid: 111 })).toEqual({
      directive: 'pause',
      issuedAt,
      pid: 111,
    });
    expect(await watchState.readControlDirective({ pid: 222 })).toEqual({
      directive: 'stop',
      issuedAt,
      pid: 222,
    });

    // Clearing one pid's directive leaves the other untouched.
    expect(await watchState.clearControlDirective({ pid: 111 })).toBe(true);
    expect(await watchState.readControlDirective({ pid: 111 })).toBe(null);
    expect(await watchState.readControlDirective({ pid: 222 })).toEqual({
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

    expect(await watchState.readControlDirective({ pid: 333 })).toEqual({
      directive: 'flush',
      issuedAt,
    });

    // A pid-scoped clear consumes a pid-less legacy directive too.
    expect(await watchState.clearControlDirective({ pid: 333 })).toBe(true);
    expect(await watchState.readControlDirective({ pid: 333 })).toBe(null);
  });
});

test('clearStaleControlDirectives removes directives for dead pids only', async () => {
  await withTmpStateDir(async (dir) => {
    const issuedAt = '2026-06-03T12:02:00.000Z';
    vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      expect(signal).toBe(0);
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
    expect(cleared).toBe(1);
    expect(await watchState.readControlDirective({ pid: 424242 })).toBe(null);
    expect(await watchState.readControlDirective({ pid: process.pid })).toEqual({ directive: 'pause', issuedAt, pid: process.pid });
  });
});

test('findLiveWatcherForTarget reports a conflicting live watcher for the same target', async () => {
  await withTmpStateDir(async () => {
    vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      expect(signal).toBe(0);
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
    expect(conflict?.pid).toBe(111);

    // The owning watcher itself is excluded.
    expect(await watchState.findLiveWatcherForTarget({
        runtime: 'codex',
        sessionId: 'abc',
        excludePid: 111,
      })).toBe(null);

    // A different session is not a conflict.
    expect(await watchState.findLiveWatcherForTarget({
        runtime: 'codex',
        sessionId: 'other',
        excludePid: 222,
      })).toBe(null);
  });
});

test('recordWatcherTarget rejects an overlapping live target under the lock', async () => {
  await withTmpStateDir(async () => {
    vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      expect(signal).toBe(0);
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
    } as const;
    await watchState.recordWatcherTarget({ pid: 111, target });

    // Both watchers passed the pre-check before either recorded; the locked
    // write is the authoritative gate for the loser.
    const dupErr: any = await watchState
      .recordWatcherTarget({ pid: 222, target })
      .then(() => null)
      .catch((e) => e);
    expect(dupErr).not.toBe(null);
    expect(dupErr.message).toMatch(/already watching codex:abc/);
    expect(dupErr.code).toBe('DUPLICATE_WATCH_TARGET');
    expect(dupErr.conflictPid).toBe(111);

    // Re-recording the same target for the owning pid stays allowed.
    const updated = await watchState.recordWatcherTarget({ pid: 111, target });
    assertWatcherRecord(updated);
    expect(updated.targets.length).toBe(1);
  });
});

test('findLiveWatcherForTarget falls back to legacy top-level fields when targets[] is absent', async () => {
  await withTmpStateDir(async (dir) => {
    vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      expect(signal).toBe(0);
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
    expect(conflict?.pid).toBe(111);

    expect(await watchState.findLiveWatcherForTarget({
        runtime: 'codex',
        sessionId: 'other-session',
        excludePid: 222,
      })).toBe(null);

    // The locked recordWatcherTarget gate honors legacy records too.
    await watchState.startWatcher({
      runtime: 'codex',
      cwd: '/repo',
      pid: 222,
      startedAt: '2026-06-11T12:00:00.000Z',
    });
    await expect(
      () =>
        watchState.recordWatcherTarget({
          pid: 222,
          target: {
            runtime: 'codex',
            sessionId: 'legacy-session',
            transcriptPath: '/tmp/legacy.jsonl',
          },
        }),
    ).rejects.toThrow(/already watching codex:legacy-session/);
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

    assertWatcherRecord(active);
    expect(active.requestedRuntime).toBe('auto');
    expect(active.resolvedRuntime).toBe('codex');
    expect(active.sessionId).toBe('abc');
    expect(active.transcriptPath).toBe('/tmp/abc.jsonl');
    expect(active.targets.length).toBe(1);
    expect(active.targets[0].baselineRecordIndex).toBe(5);
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

    assertWatcherRecord(active);
    expect(active.lastPollAt).toBe('2026-06-03T12:00:03.000Z');
    expect(active.lastError).toBeTruthy();
    expect((active.lastError as any).message).toBe('poll failed');
  });
});

// ---------------------------------------------------------------------------
// Stale watch.json.lock reclaim (mirrors state.test.ts's coverage of
// state.ts's identically-shaped, deliberately duplicated acquireLock).
// ---------------------------------------------------------------------------

test('acquireLock reclaims a watch.json.lock whose owner PID is dead, without waiting out the full retry window', async () => {
  await withTmpStateDir(async (dir) => {
    const lock = join(dir, 'watch.json.lock');
    await writeFile(lock, '999999');

    vi.spyOn(process, 'kill').mockImplementation(
      (pid: number, signal?: string | number) => {
        expect(signal).toBe(0);
        if (pid === 999999) {
          const err = new Error('no such process') as NodeJS.ErrnoException;
          err.code = 'ESRCH';
          throw err;
        }
        return true;
      },
    );

    const start = Date.now();
    await watchState.loadWatchState();
    const elapsed = Date.now() - start;
    expect(
      elapsed,
      'a dead-PID lock should be reclaimed promptly, not waited out',
    ).toBeLessThan(1000);
  });
});

test('acquireLock does not reclaim a fresh live-owner watch.json.lock; stays pending until released', async () => {
  await withTmpStateDir(async (dir) => {
    const lock = join(dir, 'watch.json.lock');
    // Content is this test process's own (live) PID — simulates a healthy,
    // currently-held lock.
    await writeFile(lock, String(process.pid));

    let settled = false;
    const pending = watchState.loadWatchState().finally(() => {
      settled = true;
    });

    // Well under the internal stale-age threshold (LOCK_RETRIES * LOCK_INTERVAL_MS).
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(
      settled,
      'a live-owner lock must not be reclaimed while fresh',
    ).toBe(false);

    // Simulate the owner's own releaseLock().
    await unlink(lock);
    await pending;
    expect(settled).toBe(true);
  });
});

test('acquireLock reclaims an empty/garbage watch.json.lock once older than the stale threshold', async () => {
  await withTmpStateDir(async (dir) => {
    const lock = join(dir, 'watch.json.lock');
    await writeFile(lock, ''); // no parseable PID — falls back to the age check

    const past = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
    await utimes(lock, past, past);

    const start = Date.now();
    await watchState.loadWatchState();
    const elapsed = Date.now() - start;
    expect(
      elapsed,
      'an aged garbage lock should be reclaimed promptly, not waited out',
    ).toBeLessThan(1000);
  });
});

test('acquireLock never reclaims a watch.json.lock via age when its recorded PID is confirmed live, no matter how old', async () => {
  await withTmpStateDir(async (dir) => {
    const lock = join(dir, 'watch.json.lock');
    await writeFile(lock, String(process.pid)); // live owner: this test process
    const past = new Date(Date.now() - 60 * 60 * 1000); // far past any age threshold
    await utimes(lock, past, past);

    let settled = false;
    const pending = watchState.loadWatchState().finally(() => {
      settled = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(
      settled,
      'a live-owner lock must never be reclaimed via age alone',
    ).toBe(false);

    await unlink(lock);
    await pending;
    expect(settled).toBe(true);
  });
});

// Regression for the unconditional-unlink race: two contenders racing to
// reclaim the SAME stale (dead-PID) lock must not both end up believing they
// hold it. tryReclaim's rename-based exclusive claim (instead of a bare
// unlink) is what this proves.
test('two concurrent startWatcher calls against a stale dead-PID lock both land cleanly — no double-acquisition, no residue', async () => {
  await withTmpStateDir(async (dir) => {
    const lock = join(dir, 'watch.json.lock');
    await writeFile(lock, '999999');

    vi.spyOn(process, 'kill').mockImplementation(
      (pid: number, signal?: string | number) => {
        expect(signal).toBe(0);
        if (pid === 999999) {
          const err = new Error('no such process') as NodeJS.ErrnoException;
          err.code = 'ESRCH';
          throw err;
        }
        return true;
      },
    );

    const [a, b] = await Promise.all([
      watchState.startWatcher({
        runtime: 'codex',
        cwd: '/repo-a',
        pid: 3001,
        startedAt: '2026-06-03T12:00:00.000Z',
      }),
      watchState.startWatcher({
        runtime: 'claude-code',
        cwd: '/repo-b',
        pid: 3002,
        startedAt: '2026-06-03T12:00:01.000Z',
      }),
    ]);

    expect(a.pid).toBe(3001);
    expect(b.pid).toBe(3002);

    const raw = JSON.parse(await readFile(join(dir, 'watch.json'), 'utf8'));
    expect(
      (raw.watchers as Array<{ pid: number }>).map((w) => w.pid).sort(),
    ).toEqual([3001, 3002]);

    const files = await readdir(dir);
    expect(files.filter((f) => f.includes('.reclaim.'))).toEqual([]);
    expect(files.filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });
});
