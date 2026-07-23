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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Deterministic lock-race harness: a one-shot `rename` interceptor and a
// path-scoped `open` call counter, used by the stale watch.json.lock reclaim
// tests below in place of wall-clock waits/bounds (see the plan's
// virtual-clock discipline; mirrors state.test.ts's identical harness for
// watch-state.ts's independently-duplicated acquireLock/tryReclaim).
// watch-state.ts has no injectable clock, so timing determinism instead
// comes from spying on the underlying fs calls acquireLock/tryReclaim
// actually make.
//
// vi.hoisted is required because vi.mock factories are hoisted above normal
// module-scope declarations; without it, the mutable interceptor/counter
// state referenced inside the factory would be in the temporal dead zone.
// ---------------------------------------------------------------------------
type RenameInterceptor = (
  src: string,
  dest: string,
  real: (src: string, dest: string) => Promise<void>,
) => Promise<void>;

const lockRaceHarness = vi.hoisted(() => {
  let renameInterceptor: RenameInterceptor | null = null;
  let openCounter: { path: string; count: number } | null = null;
  return {
    setRenameInterceptor: (fn: RenameInterceptor | null) => {
      renameInterceptor = fn;
    },
    takeRenameInterceptor: (): RenameInterceptor | null => {
      const fn = renameInterceptor;
      renameInterceptor = null; // one-shot
      return fn;
    },
    startOpenCounter: (path: string) => {
      openCounter = { path, count: 0 };
    },
    peekOpenCount: (): number => openCounter?.count ?? 0,
    stopOpenCounter: (): number => {
      const count = openCounter?.count ?? 0;
      openCounter = null;
      return count;
    },
    recordOpen: (path: string) => {
      if (openCounter && path === openCounter.path) openCounter.count++;
    },
  };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    open: (async (path: string, ...rest: unknown[]) => {
      lockRaceHarness.recordOpen(path);
      return (actual.open as (...a: unknown[]) => Promise<unknown>)(
        path,
        ...rest,
      );
    }) as typeof actual.open,
    rename: (async (src: string, dest: string) => {
      const interceptor = lockRaceHarness.takeRenameInterceptor();
      if (interceptor) return interceptor(src, dest, actual.rename);
      return actual.rename(src, dest);
    }) as typeof actual.rename,
  };
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

// Deterministic via the open('wx') call counter rather than a wall-clock
// elapsed bound (review finding 2: avoid real-time waits/bounds —
// watch-state.ts has no injectable clock, so the underlying fs call count is
// the deterministic proxy for "reclaimed promptly, not waited out").
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

    lockRaceHarness.startOpenCounter(lock);
    await watchState.loadWatchState();
    const opens = lockRaceHarness.stopOpenCounter();
    expect(
      opens,
      'a dead-PID lock should be reclaimed within a handful of open("wx") attempts, not the full retry budget',
    ).toBeLessThan(5);
  });
});

// Deterministic via vi.waitFor keyed to a second open('wx') attempt, instead
// of a fixed 300ms wait (review finding 2).
test('acquireLock does not reclaim a fresh live-owner watch.json.lock; stays pending until released', async () => {
  await withTmpStateDir(async (dir) => {
    const lock = join(dir, 'watch.json.lock');
    // Content is this test process's own (live) PID — simulates a healthy,
    // currently-held lock.
    await writeFile(lock, String(process.pid));

    lockRaceHarness.startOpenCounter(lock);
    let settled = false;
    const pending = watchState.loadWatchState().finally(() => {
      settled = true;
    });

    // Wait until the loop has made a second open('wx') attempt — proof it
    // evaluated and rejected reclaim once, then fell back to the normal
    // retry path — rather than a guessed wall-clock duration.
    await vi.waitFor(
      () => {
        if (lockRaceHarness.peekOpenCount() < 2) {
          throw new Error('waiting for a second open("wx") attempt');
        }
      },
      { timeout: 2000, interval: 5 },
    );
    expect(
      settled,
      'a live-owner lock must not be reclaimed while fresh',
    ).toBe(false);

    // Simulate the owner's own releaseLock().
    lockRaceHarness.stopOpenCounter();
    await unlink(lock);
    await pending;
    expect(settled).toBe(true);
  });
});

// Deterministic via the open('wx') call counter (review finding 2).
test('acquireLock reclaims an empty/garbage watch.json.lock once older than the stale threshold', async () => {
  await withTmpStateDir(async (dir) => {
    const lock = join(dir, 'watch.json.lock');
    await writeFile(lock, ''); // no parseable PID — falls back to the age check

    const past = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
    await utimes(lock, past, past);

    lockRaceHarness.startOpenCounter(lock);
    await watchState.loadWatchState();
    const opens = lockRaceHarness.stopOpenCounter();
    expect(
      opens,
      'an aged garbage lock should be reclaimed within a handful of open("wx") attempts, not the full retry budget',
    ).toBeLessThan(5);
  });
});

// Deterministic via vi.waitFor keyed to a second open('wx') attempt (review
// finding 2).
test('acquireLock never reclaims a watch.json.lock via age when its recorded PID is confirmed live, no matter how old', async () => {
  await withTmpStateDir(async (dir) => {
    const lock = join(dir, 'watch.json.lock');
    await writeFile(lock, String(process.pid)); // live owner: this test process
    const past = new Date(Date.now() - 60 * 60 * 1000); // far past any age threshold
    await utimes(lock, past, past);

    lockRaceHarness.startOpenCounter(lock);
    let settled = false;
    const pending = watchState.loadWatchState().finally(() => {
      settled = true;
    });

    await vi.waitFor(
      () => {
        if (lockRaceHarness.peekOpenCount() < 2) {
          throw new Error('waiting for a second open("wx") attempt');
        }
      },
      { timeout: 2000, interval: 5 },
    );
    expect(
      settled,
      'a live-owner lock must never be reclaimed via age alone',
    ).toBe(false);

    lockRaceHarness.stopOpenCounter();
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

// The isLockStale → tryReclaim TOCTOU window is closed (review finding 1).
// tryReclaim's rename-based claim is exclusive per-inode, but its source is
// the lock *path* — if a losing reclaimer (B) is preempted between its
// isLockStale read and its rename, a concurrent winner (A) can complete an
// entire reclaim-and-recreate cycle first, leaving B's rename to detach A's
// fresh *live* lock instead of the original stale one. The concurrent
// startWatcher test above cannot reproduce this (no control over the
// interleaving point), so this test forces it deterministically: intercept
// B's reclaim-claim rename call and, from inside the interceptor,
// synchronously complete "A"'s full reclaim cycle (real fs calls) before
// letting B's rename proceed against A's now-fresh lock. Mirrors
// state.test.ts's identical regression for state.ts's independently-
// duplicated acquireLock/tryReclaim.
test("a losing reclaimer never renames away a concurrent winner's fresh live watch.json.lock (isLockStale→tryReclaim interleaving)", async () => {
  await withTmpStateDir(async (dir) => {
    const lock = join(dir, 'watch.json.lock');
    await writeFile(lock, '999999'); // orphaned: dead PID — both "A" and "B" independently judge this stale

    vi.spyOn(process, 'kill').mockImplementation(
      (pid: number, signal?: string | number) => {
        expect(signal).toBe(0);
        if (pid === 999999) {
          const err = new Error('no such process') as NodeJS.ErrnoException;
          err.code = 'ESRCH';
          throw err;
        }
        // Any other PID (including this test's own, used for "A"'s fresh
        // lock below) is live.
        return true;
      },
    );

    lockRaceHarness.setRenameInterceptor(async (src, dest, real) => {
      expect(src).toBe(lock);
      expect(dest).toContain('.reclaim.');
      // "A" completes an entire reclaim-and-recreate cycle here, using real
      // fs calls, simulating B having been preempted right after its
      // isLockStale read returned true (dead PID) but before this rename
      // ran.
      await unlink(lock);
      await writeFile(lock, String(process.pid)); // A's own live PID
      // Now let B's originally-intended rename proceed — against A's fresh
      // live lock, not the orphaned one B observed.
      return real(src, dest);
    });

    let bSettled = false;
    const pending = watchState.loadWatchState().finally(() => {
      bSettled = true;
    });

    // Proving B does *not* eventually resolve is an absence, which cannot be
    // observed at a specific instant the way "at least N open() calls
    // happened" can. watch-state.ts has no injectable clock (review finding
    // 2), so this races `pending` against a generous timeout (10x the
    // internal 50ms retry-poll interval) and asserts on which one wins, not
    // on how long it took.
    const outcome = await Promise.race([
      pending.then(() => 'resolved' as const),
      sleep(500).then(() => 'timed-out' as const),
    ]);

    expect(
      outcome,
      "B must not resolve after stealing A's fresh live lock — it must detect the live PID, restore it, and back off instead of creating a competing lock",
    ).toBe('timed-out');
    expect(bSettled, 'B must still be pending, not resolved').toBe(false);

    // Exactly one lock file exists, and it is still A's.
    const lockContent = await readFile(lock, 'utf8');
    expect(lockContent).toBe(String(process.pid));
    const files = await readdir(dir);
    expect(files.filter((f) => f.includes('.reclaim.'))).toEqual([]);

    // Simulate A releasing its lock; B's still-pending loadWatchState()
    // should now proceed normally through the ordinary (non-reclaim) path.
    await unlink(lock);
    await pending;
    expect(bSettled).toBe(true);
  });
});
