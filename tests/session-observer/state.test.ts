/**
 * state.test.ts — tests for src/transcript/session-observer/lib/state.ts
 *
 * Each test uses a fresh temp STATE_DIR to ensure isolation.
 */

import { readFile, readdir, writeFile, access, unlink } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import * as state from '../../src/transcript/session-observer/lib/state.js';
import { withTmpStateDir } from './helpers/tmpdir.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
