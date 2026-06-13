/**
 * state.test.mjs — tests for scripts/lib/state.mjs
 *
 * Each test uses a fresh temp STATE_DIR to ensure isolation.
 */

import assert from 'node:assert/strict';
import { readFile, readdir, writeFile, access, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
// Resolve state.mjs path relative to this test file's location.
import { fileURLToPath } from 'node:url';

import { withTmpStateDir } from './helpers/tmpdir.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_MJS = join(
  __dirname,
  '../../skills/session-observer/scripts/lib/state.mjs',
);

async function importState() {
  // Dynamic import so each test group can pick up a fresh module.
  // We clear the module cache by appending a query to bust Node's ESM cache.
  const cacheBust = `?t=${Date.now()}-${Math.random()}`;
  return import(`${STATE_MJS}${cacheBust}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// 1. mutate creates state.json on first write
// ---------------------------------------------------------------------------
it('mutate creates state.json on first write', async () => {
  await withTmpStateDir(async (dir) => {
    const state = await importState();
    await state.mutate((s) => s);
    const stateFile = join(dir, 'state.json');
    await assert.doesNotReject(() => access(stateFile));
  });
});

// ---------------------------------------------------------------------------
// 2. mutate writes atomically — no lingering .tmp on success
// ---------------------------------------------------------------------------
it('mutate writes atomically: no lingering .tmp file after success', async () => {
  await withTmpStateDir(async (dir) => {
    const state = await importState();
    await state.mutate((s) => s);
    const files = await readdir(dir);
    const tmpFiles = files.filter((f) => f.endsWith('.tmp'));
    assert.deepEqual(
      tmpFiles,
      [],
      'no .tmp files should remain after a successful mutate',
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Lock contention: two concurrent mutates both succeed
// ---------------------------------------------------------------------------
it('two concurrent mutate calls both succeed and final state contains both mutations', async () => {
  await withTmpStateDir(async (_dir) => {
    const state = await importState();

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

    const a = await state.getSession('claude-code', 'sess-a');
    const b = await state.getSession('codex', 'sess-b');
    assert.ok(a, 'sess-a must exist');
    assert.ok(b, 'sess-b must exist');
  });
});

// ---------------------------------------------------------------------------
// 4. getSession returns null when missing; returns stored entry when present
// ---------------------------------------------------------------------------
it('getSession returns null when missing', async () => {
  await withTmpStateDir(async (_dir) => {
    const state = await importState();
    const result = await state.getSession('claude-code', 'nonexistent');
    assert.equal(result, null);
  });
});

it('getSession returns stored entry when present', async () => {
  await withTmpStateDir(async (_dir) => {
    const state = await importState();
    await state.markRead('claude-code', 'sess-x', {
      lastRecordIndex: 5,
      lastTotalRecords: 10,
      transcriptPath: '/tmp/x.jsonl',
      recordedCwd: '/my/project',
    });
    const entry = await state.getSession('claude-code', 'sess-x');
    assert.ok(entry, 'entry should be found');
    assert.equal(entry.lastRecordIndex, 5);
    assert.equal(entry.lastTotalRecords, 10);
    assert.equal(entry.transcriptPath, '/tmp/x.jsonl');
    assert.equal(entry.recordedCwd, '/my/project');
  });
});

// ---------------------------------------------------------------------------
// 5. markRead updates expected fields
// ---------------------------------------------------------------------------
it('markRead updates lastRecordIndex, lastTotalRecords, lastReadAt, transcriptPath, recordedCwd', async () => {
  await withTmpStateDir(async (_dir) => {
    const state = await importState();
    const before = new Date().toISOString();
    await state.markRead('codex', 'sess-m', {
      lastRecordIndex: 7,
      lastTotalRecords: 15,
      transcriptPath: '/tmp/m.jsonl',
      recordedCwd: '/home/user/code',
    });
    const entry = await state.getSession('codex', 'sess-m');
    assert.ok(entry);
    assert.equal(entry.lastRecordIndex, 7);
    assert.equal(entry.lastTotalRecords, 15);
    assert.equal(entry.transcriptPath, '/tmp/m.jsonl');
    assert.equal(entry.recordedCwd, '/home/user/code');
    // lastReadAt must be a valid ISO 8601 date at or after `before`
    const readAt = new Date(entry.lastReadAt);
    assert.ok(!isNaN(readAt.getTime()), 'lastReadAt must be a valid date');
    assert.ok(
      readAt.toISOString() >= before,
      'lastReadAt must be >= before timestamp',
    );
    // reserved field
    assert.equal(entry.watchedByPid, null);
  });
});

// ---------------------------------------------------------------------------
// 6. resetByRuntime zeros only that runtime's entries
// ---------------------------------------------------------------------------
it("resetByRuntime('codex') zeros only codex entries; leaves claude-code untouched", async () => {
  await withTmpStateDir(async (_dir) => {
    const state = await importState();
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
    const cxEntry = await state.getSession('codex', 'sess-cx');
    assert.ok(cxEntry, 'codex entry should still exist (just zeroed)');
    assert.equal(cxEntry.lastRecordIndex, 0);
    assert.equal(cxEntry.lastTotalRecords, 0);

    // claude-code entry should be untouched
    const ccEntry = await state.getSession('claude-code', 'sess-cc');
    assert.ok(ccEntry, 'claude-code entry should be untouched');
    assert.equal(ccEntry.lastRecordIndex, 3);
  });
});

// ---------------------------------------------------------------------------
// 7. resetBySession zeros only that specific entry
// ---------------------------------------------------------------------------
it("resetBySession('codex', 'abc') zeros only that entry", async () => {
  await withTmpStateDir(async (_dir) => {
    const state = await importState();
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

    const abc = await state.getSession('codex', 'abc');
    assert.ok(abc);
    assert.equal(abc.lastRecordIndex, 0);
    assert.equal(abc.lastTotalRecords, 0);

    const xyz = await state.getSession('codex', 'xyz');
    assert.ok(xyz);
    assert.equal(xyz.lastRecordIndex, 6, 'xyz entry must remain untouched');
  });
});

// ---------------------------------------------------------------------------
// 8. clear empties sessions but preserves schemaVersion
// ---------------------------------------------------------------------------
it('clear empties sessions but preserves schemaVersion', async () => {
  await withTmpStateDir(async (dir) => {
    const state = await importState();
    await state.markRead('claude-code', 'sess-1', {
      lastRecordIndex: 1,
      lastTotalRecords: 5,
      transcriptPath: '/tmp/1.jsonl',
      recordedCwd: '/p',
    });
    await state.clear();

    const raw = JSON.parse(await readFile(join(dir, 'state.json'), 'utf8'));
    assert.equal(raw.schemaVersion, 1);
    assert.deepEqual(raw.sessions, {});
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
    const state = await importState();
    const loaded = await state.load();

    // A backup file with 'v0' in the name must exist (unique timestamped name)
    const files = await readdir(dir);
    const bakFiles = files.filter((f) => f.startsWith('state.json.v0-'));
    assert.ok(bakFiles.length > 0, 'a v0 backup file must be created');

    // Migrated state must have schemaVersion: 1
    assert.equal(loaded.schemaVersion, 1);
  });
});

// ---------------------------------------------------------------------------
// 10. Corrupt state.json is moved to .bak; subsequent load returns empty
// ---------------------------------------------------------------------------
it('corrupt state.json is backed up and subsequent load returns empty state', async () => {
  await withTmpStateDir(async (dir) => {
    // Write corrupt JSON
    await writeFile(join(dir, 'state.json'), '{ this is not valid json !!!');

    const state = await importState();
    const loaded = await state.load();

    // Should return empty valid state
    assert.equal(loaded.schemaVersion, 1);
    assert.deepEqual(loaded.sessions, {});

    // A .bak file with 'corrupt' in the name must exist
    const files = await readdir(dir);
    const bakFiles = files.filter((f) => f.startsWith('state.json.corrupt-'));
    assert.ok(bakFiles.length > 0, 'a corrupt backup file must be created');
  });
});

it('load waits for the state lock before writing corrupt backups', async () => {
  await withTmpStateDir(async (dir) => {
    await writeFile(join(dir, 'state.json'), '{ this is not valid json !!!');
    const lock = join(dir, 'state.json.lock');
    await writeFile(lock, String(process.pid));

    const state = await importState();
    let settled = false;
    const pendingLoad = state.load().finally(() => {
      settled = true;
    });

    await sleep(75);
    assert.equal(
      settled,
      false,
      'load() should wait while the state lock exists',
    );

    await unlink(lock);
    const loaded = await pendingLoad;
    assert.equal(loaded.schemaVersion, 1);

    const files = await readdir(dir);
    const bakFiles = files.filter((f) => f.startsWith('state.json.corrupt-'));
    assert.ok(
      bakFiles.length > 0,
      'a corrupt backup file must be created after lock release',
    );
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
    const state = await importState();
    await state.mutate((s) => s); // identity mutation — just triggers read+persist

    // Re-read the raw file: it must now have schemaVersion: 1
    const raw = JSON.parse(await readFile(join(dir, 'state.json'), 'utf8'));
    assert.equal(
      raw.schemaVersion,
      1,
      'state.json must be upgraded to schemaVersion 1 after mutate()',
    );
    // Session data must be preserved
    assert.ok(
      raw.sessions['claude-code:migrated-session'],
      'session entry must survive migration',
    );
    assert.equal(
      raw.sessions['claude-code:migrated-session'].lastRecordIndex,
      3,
    );
  });
});

// ---------------------------------------------------------------------------
// 12. Backup uniqueness: repeated backups do not overwrite each other
// ---------------------------------------------------------------------------
it('repeated corrupt backups produce unique filenames and do not clobber each other', async () => {
  await withTmpStateDir(async (dir) => {
    // Simulate two consecutive corrupt-state loads.
    // We do them sequentially with a tiny delay to get distinct timestamps.
    const state = await importState();

    await writeFile(join(dir, 'state.json'), '{ bad json 1 }');
    await state.load(); // triggers first backup

    await writeFile(join(dir, 'state.json'), '{ bad json 2 }');
    // Small delay to ensure distinct millisecond timestamp in backup filename
    await sleep(5);
    await state.load(); // triggers second backup

    const files = await readdir(dir);
    const bakFiles = files.filter((f) => f.startsWith('state.json.corrupt-'));
    // Both backups must exist as distinct files
    assert.ok(
      bakFiles.length >= 2,
      `expected at least 2 backup files, got ${bakFiles.length}: ${bakFiles.join(', ')}`,
    );
  });
});

it('setWatchedByPid and clearWatchedByPid preserve read offsets', async () => {
  await withTmpStateDir(async (_dir) => {
    const state = await importState();
    await state.markRead('codex', 'sess-watch', {
      lastRecordIndex: 12,
      lastTotalRecords: 20,
      transcriptPath: '/tmp/watch.jsonl',
      recordedCwd: '/repo',
    });

    const before = await state.getSession('codex', 'sess-watch');
    assert.ok(before);

    const setResult = await state.setWatchedByPid('codex', 'sess-watch', 1234);
    assert.equal(setResult, true);
    const watched = await state.getSession('codex', 'sess-watch');
    assert.equal(watched.watchedByPid, 1234);
    assert.equal(watched.lastRecordIndex, before.lastRecordIndex);
    assert.equal(watched.lastTotalRecords, before.lastTotalRecords);
    assert.equal(watched.lastReadAt, before.lastReadAt);
    assert.equal(watched.transcriptPath, before.transcriptPath);
    assert.equal(watched.recordedCwd, before.recordedCwd);

    const clearResult = await state.clearWatchedByPid('codex', 'sess-watch');
    assert.equal(clearResult, true);
    const cleared = await state.getSession('codex', 'sess-watch');
    assert.equal(cleared.watchedByPid, null);
    assert.equal(cleared.lastRecordIndex, before.lastRecordIndex);
    assert.equal(cleared.lastTotalRecords, before.lastTotalRecords);
    assert.equal(cleared.lastReadAt, before.lastReadAt);
    assert.equal(cleared.transcriptPath, before.transcriptPath);
    assert.equal(cleared.recordedCwd, before.recordedCwd);
  });
});
