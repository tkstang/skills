/**
 * state.test.ts — tests for src/transcript/session-observer/lib/state.ts
 *
 * Each test uses a fresh temp STATE_DIR to ensure isolation.
 */

import {
  readFile,
  readdir,
  writeFile,
  access,
  unlink,
  utimes,
} from 'node:fs/promises';
import { join } from 'node:path';

import { expect, it, vi } from 'vitest';

import * as state from '../../src/transcript/session-observer/lib/state.js';
import { withTmpStateDir } from './helpers/tmpdir.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Deterministic lock-race harness: a one-shot `rename` interceptor and a
// path-scoped `open` call counter, used by the stale-lock reclaim tests
// below in place of wall-clock waits/bounds (see the plan's virtual-clock
// discipline). state.ts and watch-state.ts have no injectable clock, so
// timing determinism instead comes from spying on the underlying fs calls
// acquireLock/tryReclaim actually make.
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

// ---------------------------------------------------------------------------
// 1. mutate creates state.json on first write
// ---------------------------------------------------------------------------
it('mutate creates state.json on first write', async () => {
  await withTmpStateDir(async (dir) => {
    await state.mutate((s: any) => s);
    const stateFile = join(dir, 'state.json');
    await expect(access(stateFile)).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. mutate writes atomically — no lingering .tmp on success
// ---------------------------------------------------------------------------
it('mutate writes atomically: no lingering .tmp file after success', async () => {
  await withTmpStateDir(async (dir) => {
    await state.mutate((s: any) => s);
    const files = await readdir(dir);
    const tmpFiles = files.filter((f) => f.endsWith('.tmp'));
    expect(
      tmpFiles,
      'no .tmp files should remain after a successful mutate',
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. Lock contention: two concurrent mutates both succeed
// ---------------------------------------------------------------------------
it('two concurrent mutate calls both succeed and final state contains both mutations', async () => {
  await withTmpStateDir(async (_dir) => {
    // Both mutations write a different session entry; both must land.
    await Promise.all([
      state.markRead('claude-code', 'sess-a', {
        lastRecordIndex: 1,
        lastTotalRecords: 10,
        transcriptPath: '/tmp/a.jsonl',
        recordedCwd: '/proj',
      }),
      state.markRead('codex', 'sess-b', {
        lastRecordIndex: 2,
        lastTotalRecords: 20,
        transcriptPath: '/tmp/b.jsonl',
        recordedCwd: '/proj',
      }),
    ]);

    const a: any = await state.getSession('claude-code', 'sess-a');
    const b: any = await state.getSession('codex', 'sess-b');
    expect(a, 'sess-a must exist').toBeTruthy();
    expect(b, 'sess-b must exist').toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 4. getSession returns null when missing; returns stored entry when present
// ---------------------------------------------------------------------------
it('getSession returns null when missing', async () => {
  await withTmpStateDir(async (_dir) => {
    const result = await state.getSession('claude-code', 'nonexistent');
    expect(result).toBe(null);
  });
});

it('getSession returns stored entry when present', async () => {
  await withTmpStateDir(async (_dir) => {
    await state.markRead('claude-code', 'sess-x', {
      lastRecordIndex: 5,
      lastTotalRecords: 10,
      transcriptPath: '/tmp/x.jsonl',
      recordedCwd: '/my/project',
    });
    const entry: any = await state.getSession('claude-code', 'sess-x');
    expect(entry, 'entry should be found').toBeTruthy();
    expect(entry.lastRecordIndex).toBe(5);
    expect(entry.lastTotalRecords).toBe(10);
    expect(entry.transcriptPath).toBe('/tmp/x.jsonl');
    expect(entry.recordedCwd).toBe('/my/project');
  });
});

// ---------------------------------------------------------------------------
// 5. markRead updates expected fields
// ---------------------------------------------------------------------------
it('markRead updates lastRecordIndex, lastTotalRecords, lastReadAt, transcriptPath, recordedCwd', async () => {
  await withTmpStateDir(async (_dir) => {
    const before = new Date().toISOString();
    await state.markRead('codex', 'sess-m', {
      lastRecordIndex: 7,
      lastTotalRecords: 15,
      transcriptPath: '/tmp/m.jsonl',
      recordedCwd: '/home/user/code',
    });
    const entry: any = await state.getSession('codex', 'sess-m');
    expect(entry).toBeTruthy();
    expect(entry.lastRecordIndex).toBe(7);
    expect(entry.lastTotalRecords).toBe(15);
    expect(entry.transcriptPath).toBe('/tmp/m.jsonl');
    expect(entry.recordedCwd).toBe('/home/user/code');
    // lastReadAt must be a valid ISO 8601 date at or after `before`
    expect(entry.lastReadAt).toBeTruthy();
    const readAt = new Date(entry.lastReadAt);
    expect(!isNaN(readAt.getTime()), 'lastReadAt must be a valid date').toBeTruthy();
    expect(
      readAt.toISOString() >= before,
      'lastReadAt must be >= before timestamp',
    ).toBeTruthy();
    // reserved field
    expect(entry.watchedByPid).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// 6. resetByRuntime zeros only that runtime's entries
// ---------------------------------------------------------------------------
it("resetByRuntime('codex') zeros only codex entries; leaves claude-code untouched", async () => {
  await withTmpStateDir(async (_dir) => {
    // Set up two runtimes
    await state.markRead('claude-code', 'sess-cc', {
      lastRecordIndex: 3,
      lastTotalRecords: 9,
      transcriptPath: '/tmp/cc.jsonl',
      recordedCwd: '/proj',
    });
    await state.markRead('codex', 'sess-cx', {
      lastRecordIndex: 4,
      lastTotalRecords: 12,
      transcriptPath: '/tmp/cx.jsonl',
      recordedCwd: '/proj',
    });

    await state.resetByRuntime('codex');

    // codex entry should be zeroed
    const cxEntry: any = await state.getSession('codex', 'sess-cx');
    expect(cxEntry, 'codex entry should still exist (just zeroed)').toBeTruthy();
    expect(cxEntry.lastRecordIndex).toBe(0);
    expect(cxEntry.lastTotalRecords).toBe(0);

    // claude-code entry should be untouched
    const ccEntry: any = await state.getSession('claude-code', 'sess-cc');
    expect(ccEntry, 'claude-code entry should be untouched').toBeTruthy();
    expect(ccEntry.lastRecordIndex).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 7. resetBySession zeros only that specific entry
// ---------------------------------------------------------------------------
it("resetBySession('codex', 'abc') zeros only that entry", async () => {
  await withTmpStateDir(async (_dir) => {
    await state.markRead('codex', 'abc', {
      lastRecordIndex: 5,
      lastTotalRecords: 10,
      transcriptPath: '/tmp/abc.jsonl',
      recordedCwd: '/p',
    });
    await state.markRead('codex', 'xyz', {
      lastRecordIndex: 6,
      lastTotalRecords: 11,
      transcriptPath: '/tmp/xyz.jsonl',
      recordedCwd: '/p',
    });

    await state.resetBySession('codex', 'abc');

    const abc: any = await state.getSession('codex', 'abc');
    expect(abc).toBeTruthy();
    expect(abc.lastRecordIndex).toBe(0);
    expect(abc.lastTotalRecords).toBe(0);

    const xyz: any = await state.getSession('codex', 'xyz');
    expect(xyz).toBeTruthy();
    expect(xyz.lastRecordIndex, 'xyz entry must remain untouched').toBe(6);
  });
});

// ---------------------------------------------------------------------------
// 8. clear empties sessions but preserves schemaVersion
// ---------------------------------------------------------------------------
it('clear empties sessions but preserves schemaVersion', async () => {
  await withTmpStateDir(async (dir) => {
    await state.markRead('claude-code', 'sess-1', {
      lastRecordIndex: 1,
      lastTotalRecords: 5,
      transcriptPath: '/tmp/1.jsonl',
      recordedCwd: '/p',
    });
    await state.clear();

    const raw = JSON.parse(await readFile(join(dir, 'state.json'), 'utf8'));
    expect(raw.schemaVersion).toBe(1);
    expect(raw.sessions).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// 9. migrateIfNeeded writes a v0 backup when reading an older schema
// ---------------------------------------------------------------------------
it('migrateIfNeeded writes a v0 backup and upgrades in memory on older schema', async () => {
  await withTmpStateDir(async (dir) => {
    // Write a fake v0 state (no schemaVersion field)
    const v0State = {
      sessions: {
        'claude-code:old-session': {
          runtime: 'claude-code',
          sessionId: 'old-session',
          lastRecordIndex: 2,
          lastTotalRecords: 8,
          lastReadAt: '2026-01-01T00:00:00.000Z',
          transcriptPath: '/tmp/old.jsonl',
          recordedCwd: '/old',
        },
      },
    };
    await writeFile(join(dir, 'state.json'), JSON.stringify(v0State));

    // Loading should trigger migration (backup filenames now use timestamp+pid)
    const loaded = await state.load();

    // A backup file with 'v0' in the name must exist (unique timestamped name)
    const files = await readdir(dir);
    const bakFiles = files.filter((f) => f.startsWith('state.json.v0-'));
    expect(bakFiles.length > 0, 'a v0 backup file must be created').toBeTruthy();

    // Migrated state must have schemaVersion: 1
    expect(loaded.schemaVersion).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 10. Corrupt state.json is moved to .bak; subsequent load returns empty
// ---------------------------------------------------------------------------
it('corrupt state.json is backed up and subsequent load returns empty state', async () => {
  await withTmpStateDir(async (dir) => {
    // Write corrupt JSON
    await writeFile(join(dir, 'state.json'), '{ this is not valid json !!!');

    const loaded = await state.load();

    // Should return empty valid state
    expect(loaded.schemaVersion).toBe(1);
    expect(loaded.sessions).toEqual({});

    // A .bak file with 'corrupt' in the name must exist
    const files = await readdir(dir);
    const bakFiles = files.filter((f) => f.startsWith('state.json.corrupt-'));
    expect(bakFiles.length > 0, 'a corrupt backup file must be created').toBeTruthy();
  });
});

it('load waits for the state lock before writing corrupt backups', async () => {
  await withTmpStateDir(async (dir) => {
    await writeFile(join(dir, 'state.json'), '{ this is not valid json !!!');
    const lock = join(dir, 'state.json.lock');
    await writeFile(lock, String(process.pid));

    let settled = false;
    const pendingLoad = state.load().finally(() => {
      settled = true;
    });

    await sleep(75);
    expect(
      settled,
      'load() should wait while the state lock exists',
    ).toBe(false);

    await unlink(lock);
    const loaded = await pendingLoad;
    expect(loaded.schemaVersion).toBe(1);

    const files = await readdir(dir);
    const bakFiles = files.filter((f) => f.startsWith('state.json.corrupt-'));
    expect(
      bakFiles.length > 0,
      'a corrupt backup file must be created after lock release',
    ).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 11. migrateIfNeeded: migration persists to disk via mutate() path
// ---------------------------------------------------------------------------
it('migration via mutate(): re-load after mutate returns upgraded schema (schemaVersion 1)', async () => {
  await withTmpStateDir(async (dir) => {
    // Write a v0 state (no schemaVersion)
    const v0State = {
      sessions: {
        'claude-code:migrated-session': {
          runtime: 'claude-code',
          sessionId: 'migrated-session',
          lastRecordIndex: 3,
          lastTotalRecords: 9,
          lastReadAt: '2026-01-01T00:00:00.000Z',
          transcriptPath: '/tmp/migrated.jsonl',
          recordedCwd: '/migrated/project',
        },
      },
    };
    await writeFile(join(dir, 'state.json'), JSON.stringify(v0State));

    // Go through mutate() — this forces a readState+writeState cycle under the lock,
    // which persists the migrated state (schemaVersion: 1) to disk.
    await state.mutate((s: any) => s); // identity mutation — just triggers read+persist

    // Re-read the raw file: it must now have schemaVersion: 1
    const raw = JSON.parse(await readFile(join(dir, 'state.json'), 'utf8'));
    expect(
      raw.schemaVersion,
      'state.json must be upgraded to schemaVersion 1 after mutate()',
    ).toBe(1);
    // Session data must be preserved
    expect(
      raw.sessions['claude-code:migrated-session'],
      'session entry must survive migration',
    ).toBeTruthy();
    expect(raw.sessions['claude-code:migrated-session'].lastRecordIndex).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 12. Backup uniqueness: repeated backups do not overwrite each other
// ---------------------------------------------------------------------------
it('repeated corrupt backups produce unique filenames and do not clobber each other', async () => {
  await withTmpStateDir(async (dir) => {
    // Simulate two consecutive corrupt-state loads.
    // We do them sequentially with a tiny delay to get distinct timestamps.

    await writeFile(join(dir, 'state.json'), '{ bad json 1 }');
    await state.load(); // triggers first backup

    await writeFile(join(dir, 'state.json'), '{ bad json 2 }');
    // Small delay to ensure distinct millisecond timestamp in backup filename
    await sleep(5);
    await state.load(); // triggers second backup

    const files = await readdir(dir);
    const bakFiles = files.filter((f) => f.startsWith('state.json.corrupt-'));
    // Both backups must exist as distinct files
    expect(
      bakFiles.length >= 2,
      `expected at least 2 backup files, got ${bakFiles.length}: ${bakFiles.join(', ')}`,
    ).toBeTruthy();
  });
});

it('setWatchedByPid and clearWatchedByPid preserve read offsets', async () => {
  await withTmpStateDir(async (_dir) => {
    await state.markRead('codex', 'sess-watch', {
      lastRecordIndex: 12,
      lastTotalRecords: 20,
      transcriptPath: '/tmp/watch.jsonl',
      recordedCwd: '/repo',
    });

    const before: any = await state.getSession('codex', 'sess-watch');
    expect(before).toBeTruthy();

    const setResult = await state.setWatchedByPid('codex', 'sess-watch', 1234);
    expect(setResult).toBe(true);
    const watched: any = await state.getSession('codex', 'sess-watch');
    expect(watched).toBeTruthy();
    expect(watched.watchedByPid).toBe(1234);
    expect(watched.lastRecordIndex).toBe(before.lastRecordIndex);
    expect(watched.lastTotalRecords).toBe(before.lastTotalRecords);
    expect(watched.lastReadAt).toBe(before.lastReadAt);
    expect(watched.transcriptPath).toBe(before.transcriptPath);
    expect(watched.recordedCwd).toBe(before.recordedCwd);

    const clearResult = await state.clearWatchedByPid('codex', 'sess-watch');
    expect(clearResult).toBe(true);
    const cleared: any = await state.getSession('codex', 'sess-watch');
    expect(cleared).toBeTruthy();
    expect(cleared.watchedByPid).toBe(null);
    expect(cleared.lastRecordIndex).toBe(before.lastRecordIndex);
    expect(cleared.lastTotalRecords).toBe(before.lastTotalRecords);
    expect(cleared.lastReadAt).toBe(before.lastReadAt);
    expect(cleared.transcriptPath).toBe(before.transcriptPath);
    expect(cleared.recordedCwd).toBe(before.recordedCwd);
  });
});

// ---------------------------------------------------------------------------
// 13. Stale-lock reclaim: dead owner PID
// Deterministic via the open('wx') call counter rather than a wall-clock
// elapsed bound (review finding 2: avoid real-time waits/bounds — state.ts
// has no injectable clock, so the underlying fs call count is the
// deterministic proxy for "reclaimed promptly, not waited out").
// ---------------------------------------------------------------------------
it('acquireLock reclaims a lock whose owner PID is dead, without waiting out the full retry window', async () => {
  await withTmpStateDir(async (dir) => {
    const lock = join(dir, 'state.json.lock');
    await writeFile(lock, '999999');

    const killSpy = vi
      .spyOn(process, 'kill')
      .mockImplementation((pid: number, signal?: string | number) => {
        expect(signal).toBe(0);
        if (pid === 999999) {
          const err = new Error('no such process') as NodeJS.ErrnoException;
          err.code = 'ESRCH';
          throw err;
        }
        return true;
      });

    lockRaceHarness.startOpenCounter(lock);
    try {
      await state.mutate((s: any) => s);
    } finally {
      const opens = lockRaceHarness.stopOpenCounter();
      killSpy.mockRestore();
      // A healthy reclaim needs only the initial failed open('wx') plus the
      // recreate open('wx') — nowhere near the full LOCK_RETRIES (100)
      // budget a real timeout would exhaust.
      expect(
        opens,
        'a dead-PID lock should be reclaimed within a handful of open("wx") attempts, not the full retry budget',
      ).toBeLessThan(5);
    }
  });
});

// ---------------------------------------------------------------------------
// 14. Stale-lock reclaim: live-owner lock is never stolen while fresh
// Deterministic via vi.waitFor keyed to a second open('wx') attempt, instead
// of a fixed sleep(300) (review finding 2).
// ---------------------------------------------------------------------------
it('acquireLock does not reclaim a fresh live-owner lock; stays pending until the owner releases it', async () => {
  await withTmpStateDir(async (dir) => {
    const lock = join(dir, 'state.json.lock');
    // Content is this test process's own (live) PID — simulates a healthy,
    // currently-held lock.
    await writeFile(lock, String(process.pid));

    lockRaceHarness.startOpenCounter(lock);
    let settled = false;
    const pending = state.mutate((s: any) => s).finally(() => {
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

// ---------------------------------------------------------------------------
// 15. Stale-lock reclaim: aged empty/garbage lock (no parseable PID)
// Deterministic via the open('wx') call counter (review finding 2).
// ---------------------------------------------------------------------------
it('acquireLock reclaims an empty/garbage lock once it is older than the stale threshold', async () => {
  await withTmpStateDir(async (dir) => {
    const lock = join(dir, 'state.json.lock');
    await writeFile(lock, ''); // no parseable PID — falls back to the age check

    const past = new Date(Date.now() - 60 * 60 * 1000); // 1h ago: well past any stale threshold
    await utimes(lock, past, past);

    lockRaceHarness.startOpenCounter(lock);
    await state.mutate((s: any) => s);
    const opens = lockRaceHarness.stopOpenCounter();
    expect(
      opens,
      'an aged garbage lock should be reclaimed within a handful of open("wx") attempts, not the full retry budget',
    ).toBeLessThan(5);
  });
});

// ---------------------------------------------------------------------------
// 16. Stale-lock reclaim: a live-owner lock is never reclaimed via age,
// however old — the age fallback only applies when no PID can be read.
// Deterministic via vi.waitFor keyed to a second open('wx') attempt (review
// finding 2).
// ---------------------------------------------------------------------------
it('acquireLock never reclaims a lock via age when its recorded PID is confirmed live, no matter how old', async () => {
  await withTmpStateDir(async (dir) => {
    const lock = join(dir, 'state.json.lock');
    await writeFile(lock, String(process.pid)); // live owner: this test process
    const past = new Date(Date.now() - 60 * 60 * 1000); // far past any age threshold
    await utimes(lock, past, past);

    lockRaceHarness.startOpenCounter(lock);
    let settled = false;
    const pending = state.mutate((s: any) => s).finally(() => {
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

// ---------------------------------------------------------------------------
// 17. Stale-lock reclaim: concurrent reclaimers never both hold the lock.
// Regression for the unconditional-unlink race: two contenders racing to
// reclaim the SAME stale (dead-PID) lock must not both end up believing they
// hold it. tryReclaim's rename-based exclusive claim (instead of a bare
// unlink) is what this proves. (This same-process Promise.all race gives no
// control over exactly where either contender is interrupted, so it cannot
// by itself reproduce the isLockStale→tryReclaim TOCTOU window closed by
// test 18 below — it still has real lost-update detection power, which is
// why it stays.)
// ---------------------------------------------------------------------------
it('two concurrent mutate calls against a stale dead-PID lock both land cleanly — no double-acquisition, no residue', async () => {
  await withTmpStateDir(async (dir) => {
    const lock = join(dir, 'state.json.lock');
    await writeFile(lock, '999999');

    const killSpy = vi
      .spyOn(process, 'kill')
      .mockImplementation((pid: number, signal?: string | number) => {
        expect(signal).toBe(0);
        if (pid === 999999) {
          const err = new Error('no such process') as NodeJS.ErrnoException;
          err.code = 'ESRCH';
          throw err;
        }
        return true;
      });

    try {
      await Promise.all([
        state.markRead('claude-code', 'race-a', {
          lastRecordIndex: 1,
          lastTotalRecords: 5,
          transcriptPath: '/tmp/race-a.jsonl',
          recordedCwd: '/proj',
        }),
        state.markRead('codex', 'race-b', {
          lastRecordIndex: 2,
          lastTotalRecords: 6,
          transcriptPath: '/tmp/race-b.jsonl',
          recordedCwd: '/proj',
        }),
      ]);
    } finally {
      killSpy.mockRestore();
    }

    // Both mutations must have landed — proves the two racing acquisitions
    // were correctly serialized (not both believing they held the lock at
    // once, which would risk a lost update or a corrupt write).
    const a: any = await state.getSession('claude-code', 'race-a');
    const b: any = await state.getSession('codex', 'race-b');
    expect(a, 'race-a must exist').toBeTruthy();
    expect(b, 'race-b must exist').toBeTruthy();

    // No leftover reclaim-claim or tmp artifacts from the race.
    const files = await readdir(dir);
    expect(files.filter((f) => f.includes('.reclaim.'))).toEqual([]);
    expect(files.filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 18. Stale-lock reclaim: the isLockStale → tryReclaim TOCTOU window is
// closed (review finding 1). tryReclaim's rename-based claim is exclusive
// per-inode, but its source is the lock *path* — if a losing reclaimer (B)
// is preempted between its isLockStale read and its rename, a concurrent
// winner (A) can complete an entire reclaim-and-recreate cycle first,
// leaving B's rename to detach A's fresh *live* lock instead of the
// original stale one. Test 17's same-process Promise.all race cannot
// reproduce this (no control over the interleaving point), so this test
// forces it deterministically: intercept B's reclaim-claim rename call and,
// from inside the interceptor, synchronously complete "A"'s full reclaim
// cycle (real fs calls) before letting B's rename proceed against A's now-
// fresh lock.
// ---------------------------------------------------------------------------
it("a losing reclaimer never renames away a concurrent winner's fresh live lock (isLockStale→tryReclaim interleaving)", async () => {
  await withTmpStateDir(async (dir) => {
    const lock = join(dir, 'state.json.lock');
    await writeFile(lock, '999999'); // orphaned: dead PID — both "A" and "B" independently judge this stale

    const killSpy = vi
      .spyOn(process, 'kill')
      .mockImplementation((pid: number, signal?: string | number) => {
        expect(signal).toBe(0);
        if (pid === 999999) {
          const err = new Error('no such process') as NodeJS.ErrnoException;
          err.code = 'ESRCH';
          throw err;
        }
        // Any other PID (including this test's own, used for "A"'s fresh
        // lock below) is live.
        return true;
      });

    try {
      lockRaceHarness.setRenameInterceptor(async (src, dest, real) => {
        expect(src).toBe(lock);
        expect(dest).toContain('.reclaim.');
        // "A" completes an entire reclaim-and-recreate cycle here, using
        // real fs calls, simulating B having been preempted right after its
        // isLockStale read returned true (dead PID) but before this rename
        // ran.
        await unlink(lock);
        await writeFile(lock, String(process.pid)); // A's own live PID
        // Now let B's originally-intended rename proceed — against A's
        // fresh live lock, not the orphaned one B observed.
        return real(src, dest);
      });

      let bSettled = false;
      const pending = state.mutate((s: any) => s).finally(() => {
        bSettled = true;
      });

      // Proving B does *not* eventually resolve is an absence, which cannot
      // be observed at a specific instant the way "at least N open() calls
      // happened" can (an open('wx') *call* is recorded synchronously, long
      // before acquireLock's surrounding awaits — including mutate()'s own
      // read+write+release — have any chance to finish, so polling on call
      // count alone would race ahead of the buggy code's eventual success
      // too). state.ts has no injectable clock (review finding 2), so this
      // is the one wait in this suite that is a genuine, bounded real-time
      // wait rather than a guessed elapsed bound: it races `pending` against
      // a generous timeout (10x the internal 50ms retry-poll interval) and
      // asserts on which one wins, not on how long it took.
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

      // Simulate A releasing its lock; B's still-pending mutate() should now
      // proceed normally through the ordinary (non-reclaim) path.
      await unlink(lock);
      await pending;
      expect(bSettled).toBe(true);
    } finally {
      killSpy.mockRestore();
    }
  });
});
