/**
 * state.test.ts — tests for src/transcript/session-observer/lib/state.ts
 *
 * Each test uses a fresh temp STATE_DIR to ensure isolation.
 */

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  readFile,
  readdir,
  writeFile,
  access,
  unlink,
  utimes,
} from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect, it, vi } from 'vitest';

import {
  loadCursorState,
  mutateCursorState,
} from '../../src/transcript/session-observer/lib/cursor-state.js';
import * as state from '../../src/transcript/session-observer/lib/state.js';
import { withTmpStateDir } from './helpers/tmpdir.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const GENERATED_STATE_URL = pathToFileURL(
  join(process.cwd(), 'skills/session-observer/scripts/lib/state.mjs'),
).href;
const GENERATED_CURSOR_STATE_URL = pathToFileURL(
  join(process.cwd(), 'skills/session-observer/scripts/lib/cursor-state.mjs'),
).href;
const LOCK_PUBLICATION_BOUNDARIES = [
  'private-created',
  'token-written',
  'token-synced',
] as const;

async function killWorkerAtReady(
  source: string,
  stateDir: string,
): Promise<void> {
  const child = spawn(process.execPath, ['--input-type=module', '-e', source], {
    env: { ...process.env, STATE_DIR: stateDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = once(child, 'exit');
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`worker did not reach boundary: ${stderr}`));
    }, 5000);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      if (!chunk.includes('READY')) return;
      clearTimeout(timeout);
      resolve();
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      reject(
        new Error(
          `worker exited before boundary code=${code} signal=${signal}: ${stderr}`,
        ),
      );
    });
  });
  child.kill('SIGKILL');
  await exited;
}

async function startLegacyEmptyLockHolder(lock: string): Promise<{
  release(): Promise<void>;
}> {
  const child = spawn(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
        const { open, unlink } = await import('node:fs/promises');
        const lock = ${JSON.stringify(lock)};
        const handle = await open(lock, 'wx', 0o600);
        await handle.close();
        process.stdout.write('READY\\n');
        process.stdin.setEncoding('utf8');
        process.stdin.once('data', async () => {
          await unlink(lock);
          process.stdout.write('RELEASED\\n');
          process.exit(0);
        });
        await new Promise(() => {});
      `,
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`legacy lock holder did not start: ${stderr}`));
    }, 5000);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      if (!chunk.includes('READY')) return;
      clearTimeout(timeout);
      resolve();
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      reject(
        new Error(
          `legacy lock holder exited early code=${code} signal=${signal}: ${stderr}`,
        ),
      );
    });
  });
  return {
    async release() {
      const exited = once(child, 'exit');
      child.stdin.write('release\n');
      await exited;
    },
  };
}

// ---------------------------------------------------------------------------
// Deterministic lock-race harness: a path-scoped `readFile` interceptor and a
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
type ReadFileInterceptor = (
  path: string,
  real: typeof import('node:fs/promises').readFile,
) => Promise<string>;

const lockRaceHarness = vi.hoisted(() => {
  let readInterceptor: {
    path: string;
    remaining: number;
    run: ReadFileInterceptor;
  } | null = null;
  let openCounter: { path: string; count: number } | null = null;
  return {
    setReadInterceptor: (
      path: string,
      call: number,
      run: ReadFileInterceptor,
    ) => {
      readInterceptor = { path, remaining: call, run };
    },
    takeReadInterceptor: (path: string): ReadFileInterceptor | null => {
      if (!readInterceptor || readInterceptor.path !== path) return null;
      readInterceptor.remaining -= 1;
      if (readInterceptor.remaining > 0) return null;
      const run = readInterceptor.run;
      readInterceptor = null;
      return run;
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
      if (
        openCounter &&
        (path === openCounter.path ||
          (path.startsWith(`${openCounter.path}.`) && path.endsWith('.owner')))
      ) {
        openCounter.count++;
      }
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
    link: (async (existingPath: string, newPath: string) => {
      lockRaceHarness.recordOpen(newPath);
      return actual.link(existingPath, newPath);
    }) as typeof actual.link,
    readFile: (async (path: string, ...rest: unknown[]) => {
      const interceptor = lockRaceHarness.takeReadInterceptor(path);
      if (interceptor) return interceptor(path, actual.readFile);
      return (actual.readFile as (...a: unknown[]) => Promise<unknown>)(
        path,
        ...rest,
      );
    }) as typeof actual.readFile,
  };
});

it.each(LOCK_PUBLICATION_BOUNDARIES)(
  'recovers a legacy-state queue after process death at contender publication boundary %s',
  async (boundary) => {
    await withTmpStateDir(async (dir) => {
      await killWorkerAtReady(
        `
          const { mutate } = await import(${JSON.stringify(GENERATED_STATE_URL)});
          await mutate(
            state => state,
            {
              async onLockPublicationBoundary(boundary) {
                if (boundary !== ${JSON.stringify(boundary)}) return;
                process.stdout.write('READY\\n');
                await new Promise(() => {});
              }
            }
          );
        `,
        dir,
      );

      await expect(state.mutate((current) => current)).resolves.toMatchObject({
        schemaVersion: 1,
      });
      expect(await readdir(join(dir, 'state.json.lock.owner-tokens'))).toEqual(
        [],
      );
      expect(await readdir(join(dir, 'state.json.lock.owners'))).toEqual([]);
    });
  },
);

it.each(LOCK_PUBLICATION_BOUNDARIES)(
  'recovers a transition-lock queue after process death at contender publication boundary %s',
  async (boundary) => {
    await withTmpStateDir(async (dir) => {
      const sessionId = `transition-publication-${boundary}`;
      const input = {
        lastRecordIndex: 0,
        lastTotalRecords: 0,
        transcriptPath: `/tmp/${sessionId}.jsonl`,
        recordedCwd: '/project',
      };
      await killWorkerAtReady(
        `
          const { markRead } = await import(${JSON.stringify(GENERATED_STATE_URL)});
          await markRead(
            'cursor',
            ${JSON.stringify(sessionId)},
            ${JSON.stringify(input)},
            {
              async onLockPublicationBoundary(boundary) {
                if (boundary !== ${JSON.stringify(boundary)}) return;
                process.stdout.write('READY\\n');
                await new Promise(() => {});
              }
            }
          );
        `,
        dir,
      );

      await expect(
        state.markRead('cursor', sessionId, input),
      ).resolves.toBeUndefined();
      expect(
        await readdir(join(dir, 'cursor-state-transition.lock.owner-tokens')),
      ).toEqual([]);
      expect(
        await readdir(join(dir, 'cursor-state-transition.lock.owners')),
      ).toEqual([]);
    });
  },
);

it.each([
  ['write', 'private-created'],
  ['sync', 'token-written'],
] as const)(
  'cleans a private legacy-state token after injected %s failure',
  async (failure, boundary) => {
    await withTmpStateDir(async (dir) => {
      await expect(
        state.mutate((current) => current, {
          onLockPublicationBoundary(current) {
            if (current === boundary) throw new Error(`injected-${failure}`);
          },
        }),
      ).rejects.toThrow(`injected-${failure}`);
      await expect(state.mutate((current) => current)).resolves.toMatchObject({
        schemaVersion: 1,
      });
      expect(await readdir(join(dir, 'state.json.lock.owner-tokens'))).toEqual(
        [],
      );
      expect(await readdir(join(dir, 'state.json.lock.owners'))).toEqual([]);
    });
  },
);

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
    expect(
      !isNaN(readAt.getTime()),
      'lastReadAt must be a valid date',
    ).toBeTruthy();
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
    expect(
      cxEntry,
      'codex entry should still exist (just zeroed)',
    ).toBeTruthy();
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
    expect(
      bakFiles.length > 0,
      'a v0 backup file must be created',
    ).toBeTruthy();

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
    expect(
      bakFiles.length > 0,
      'a corrupt backup file must be created',
    ).toBeTruthy();
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
    expect(settled, 'load() should wait while the state lock exists').toBe(
      false,
    );

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
    expect(raw.sessions['claude-code:migrated-session'].lastRecordIndex).toBe(
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

it('composes legacy state with explicit legacy-unverified Cursor markers', async () => {
  await withTmpStateDir(async (dir) => {
    await writeFile(
      join(dir, 'state.json'),
      JSON.stringify({
        schemaVersion: 1,
        sessions: {
          'codex:kept': {
            runtime: 'codex',
            sessionId: 'kept',
            lastRecordIndex: 2,
            lastTotalRecords: 3,
          },
          'cursor:legacy': {
            runtime: 'cursor',
            sessionId: 'legacy',
            lastRecordIndex: 9,
            lastTotalRecords: 11,
          },
        },
      }),
    );

    const marker = await state.migrateLegacyCursorState('legacy');
    expect(marker).toMatchObject({
      legacyLastRecordIndex: 9,
      migrationStatus: 'complete',
    });

    const composed: any = await state.load();
    expect(composed.sessions['codex:kept']).toMatchObject({
      lastRecordIndex: 2,
    });
    expect(composed.sessions['cursor:legacy']).toMatchObject({
      runtime: 'cursor',
      recoveryRequired: true,
      recoveryCode: 'LEGACY_CURSOR_UNVERIFIED',
      legacyLastRecordIndex: 9,
    });
    await expect(state.getSession('cursor', 'legacy')).rejects.toThrow(
      'LEGACY_CURSOR_UNVERIFIED',
    );
    await expect(
      state.markRead('cursor', 'legacy', {
        lastRecordIndex: 1,
        lastTotalRecords: 12,
        transcriptPath: '/tmp/legacy.jsonl',
        recordedCwd: '/project',
      }),
    ).rejects.toThrow('LEGACY_CURSOR_UNVERIFIED');
  });
});

it('preserves zero-offset Cursor preference metadata without creating v2 ownership', async () => {
  await withTmpStateDir(async (dir) => {
    await writeFile(
      join(dir, 'state.json'),
      JSON.stringify({
        schemaVersion: 1,
        sessions: {
          'cursor:legacy-zero': {
            runtime: 'cursor',
            sessionId: 'legacy-zero',
            lastRecordIndex: 0,
            lastTotalRecords: 4,
            lastReadAt: '2026-05-17T12:00:00.000Z',
            transcriptPath: '/tmp/legacy-zero.jsonl',
            recordedCwd: '/project',
          },
        },
      }),
    );

    const composed: any = await state.load();
    expect(composed.sessions['cursor:legacy-zero']).toMatchObject({
      runtime: 'cursor',
      lastRecordIndex: 0,
      recoveryRequired: true,
      recordedCwd: '/project',
      transcriptPath: '/tmp/legacy-zero.jsonl',
    });
    await expect(state.getSession('cursor', 'legacy-zero')).resolves.toBeNull();
    expect((await loadCursorState()).sessions).toEqual({});
  });
});

it('projects pre-integration Cursor record indexes without creating v2 ownership', async () => {
  await withTmpStateDir(async (dir) => {
    await state.markRead('cursor', 'compat', {
      lastRecordIndex: 3,
      lastTotalRecords: 4,
      transcriptPath: '/tmp/compat.jsonl',
      recordedCwd: '/project',
    });

    const raw = JSON.parse(await readFile(join(dir, 'state.json'), 'utf8'));
    expect(raw.sessions['cursor:compat']).toMatchObject({
      runtime: 'cursor',
      lastRecordIndex: 3,
      cursorCompatibility: 'pre-integration-record-index',
    });
    await expect(state.getSession('cursor', 'compat')).resolves.toMatchObject({
      lastRecordIndex: 3,
      cursorCompatibility: 'pre-integration-record-index',
    });
    await expect(state.load()).resolves.toMatchObject({
      sessions: {
        'cursor:compat': {
          lastRecordIndex: 3,
          cursorCompatibility: 'pre-integration-record-index',
        },
      },
    });
    await expect(state.setWatchedByPid('cursor', 'compat', 4321)).resolves.toBe(
      true,
    );
    await expect(
      state.clearWatchedByPid('cursor', 'compat', 4321),
    ).resolves.toBe(true);

    const cursor = await loadCursorState();
    expect(cursor.sessions).toEqual({});
    expect(cursor.legacyUnverified).toEqual({});
  });
});

it('restores the exact legacy preimage when a migration marker appears during compatibility write', async () => {
  await withTmpStateDir(async (dir) => {
    await writeFile(
      join(dir, 'state.json'),
      JSON.stringify({
        schemaVersion: 1,
        sessions: {
          'claude-code:preserved': {
            runtime: 'claude-code',
            sessionId: 'preserved',
            lastRecordIndex: 4,
            lastTotalRecords: 4,
          },
          'cursor:interleaved': {
            runtime: 'cursor',
            sessionId: 'interleaved',
            lastRecordIndex: 7,
            lastTotalRecords: 9,
            transcriptPath: '/tmp/original.jsonl',
            recordedCwd: '/original',
            watchedByPid: 77,
          },
        },
      }),
    );
    const before = JSON.parse(await readFile(join(dir, 'state.json'), 'utf8'));
    const backupPath = join(dir, 'interleaved-legacy.bak');

    await expect(
      state.markRead(
        'cursor',
        'interleaved',
        {
          lastRecordIndex: 8,
          lastTotalRecords: 10,
          transcriptPath: '/tmp/new.jsonl',
          recordedCwd: '/new',
        },
        {
          async onCompatibilityBoundary(boundary) {
            if (boundary !== 'prechecked') return;
            await mutateCursorState((cursor) => {
              cursor.legacyUnverified['cursor:interleaved'] = {
                runtime: 'cursor',
                sessionId: 'interleaved',
                legacyLastRecordIndex: 7,
                transcriptPath: '/tmp/original.jsonl',
                recordedCwd: '/original',
                backupPath,
                migrationStatus: 'marker-written',
                createdAt: '2026-07-23T00:00:00.000Z',
              };
            });
          },
        },
      ),
    ).rejects.toThrow('LEGACY_CURSOR_UNVERIFIED');

    const after = JSON.parse(await readFile(join(dir, 'state.json'), 'utf8'));
    expect(after).toEqual(before);
    await expect(
      state.migrateLegacyCursorState('interleaved'),
    ).resolves.toMatchObject({ migrationStatus: 'complete' });
    await expect(access(backupPath)).resolves.not.toThrow();
  });
});

it.each([
  'marker-written',
  'backup-written',
  'legacy-removed',
  'marker-legacy-removed',
  'complete',
] as const)(
  'reclaims process-crashed migration locks at %s',
  async (boundary) => {
    await withTmpStateDir(async (dir) => {
      await writeFile(
        join(dir, 'state.json'),
        JSON.stringify({
          schemaVersion: 1,
          sessions: {
            'cursor:killed-migration': {
              runtime: 'cursor',
              sessionId: 'killed-migration',
              lastRecordIndex: 7,
              lastTotalRecords: 9,
            },
          },
        }),
      );
      await killWorkerAtReady(
        `
          const { migrateLegacyCursorState } = await import(${JSON.stringify(GENERATED_STATE_URL)});
          await migrateLegacyCursorState('killed-migration', {
            async onBoundary(boundary) {
              if (boundary !== ${JSON.stringify(boundary)}) return;
              process.stdout.write('READY\\n');
              await new Promise(() => {});
            }
          });
        `,
        dir,
      );

      await expect(
        state.migrateLegacyCursorState('killed-migration'),
      ).resolves.toMatchObject({ migrationStatus: 'complete' });
      const files = await readdir(dir);
      expect(files.filter((name) => name.endsWith('.lock'))).toEqual([]);
    });
  },
);

it.each(['legacy-written', 'cursor-updated'] as const)(
  'retries compatibility transition after process failure at %s',
  async (failureBoundary) => {
    await withTmpStateDir(async (dir) => {
      await writeFile(
        join(dir, 'state.json'),
        JSON.stringify({
          schemaVersion: 1,
          sessions: {
            'cursor:retry': {
              runtime: 'cursor',
              sessionId: 'retry',
              lastRecordIndex: 0,
              lastTotalRecords: 2,
              transcriptPath: '/tmp/retry.jsonl',
              recordedCwd: '/project',
            },
          },
        }),
      );
      await state.load();

      await expect(
        state.markRead(
          'cursor',
          'retry',
          {
            lastRecordIndex: 2,
            lastTotalRecords: 2,
            transcriptPath: '/tmp/retry.jsonl',
            recordedCwd: '/project',
          },
          {
            onCompatibilityBoundary(boundary) {
              if (boundary === failureBoundary) {
                throw new Error(`injected:${boundary}`);
              }
            },
          },
        ),
      ).rejects.toThrow(`injected:${failureBoundary}`);

      await state.markRead('cursor', 'retry', {
        lastRecordIndex: 2,
        lastTotalRecords: 2,
        transcriptPath: '/tmp/retry.jsonl',
        recordedCwd: '/project',
      });
      const legacy = JSON.parse(
        await readFile(join(dir, 'state.json'), 'utf8'),
      );
      expect(legacy.sessions['cursor:retry']).toMatchObject({
        lastRecordIndex: 2,
        cursorCompatibility: 'pre-integration-record-index',
      });
      expect(await loadCursorState()).toEqual({
        schemaVersion: 2,
        sessions: {},
        legacyUnverified: {},
      });
    });
  },
);

it.each(['prechecked', 'legacy-written', 'cursor-updated'] as const)(
  'reclaims process-crashed compatibility locks at %s',
  async (boundary) => {
    await withTmpStateDir(async (dir) => {
      await writeFile(
        join(dir, 'state.json'),
        JSON.stringify({
          schemaVersion: 1,
          sessions: {
            'cursor:killed-compatibility': {
              runtime: 'cursor',
              sessionId: 'killed-compatibility',
              lastRecordIndex: 0,
              lastTotalRecords: 2,
            },
          },
        }),
      );
      await state.load();
      await killWorkerAtReady(
        `
          const { markRead } = await import(${JSON.stringify(GENERATED_STATE_URL)});
          await markRead(
            'cursor',
            'killed-compatibility',
            {
              lastRecordIndex: 2,
              lastTotalRecords: 2,
              transcriptPath: '/tmp/killed.jsonl',
              recordedCwd: '/project'
            },
            {
              async onCompatibilityBoundary(boundary) {
                if (boundary !== ${JSON.stringify(boundary)}) return;
                process.stdout.write('READY\\n');
                await new Promise(() => {});
              }
            }
          );
        `,
        dir,
      );

      await expect(
        state.markRead('cursor', 'killed-compatibility', {
          lastRecordIndex: 2,
          lastTotalRecords: 2,
          transcriptPath: '/tmp/killed.jsonl',
          recordedCwd: '/project',
        }),
      ).resolves.toBeUndefined();
      expect(
        (await loadCursorState()).legacyUnverified[
          'cursor:killed-compatibility'
        ],
      ).toBeUndefined();
      const files = await readdir(dir);
      expect(files.filter((name) => name.endsWith('.lock'))).toEqual([]);
    });
  },
);

it.each(['locked', 'written'] as const)(
  'reclaims process-crashed v2 mutation lock at %s',
  async (boundary) => {
    await withTmpStateDir(async (dir) => {
      await mutateCursorState(() => {});
      await killWorkerAtReady(
        `
          const { mutateCursorState } = await import(${JSON.stringify(GENERATED_CURSOR_STATE_URL)});
          await mutateCursorState(
            () => {},
            {
              async onMutationBoundary(boundary) {
                if (boundary !== ${JSON.stringify(boundary)}) return;
                process.stdout.write('READY\\n');
                await new Promise(() => {});
              }
            }
          );
        `,
        dir,
      );

      await expect(mutateCursorState(() => {})).resolves.toMatchObject({
        schemaVersion: 2,
      });
      const files = await readdir(dir);
      expect(files.filter((name) => name.endsWith('.lock'))).toEqual([]);
    });
  },
);

it('explicit Cursor reset removes legacy markers without changing non-Cursor state', async () => {
  await withTmpStateDir(async (dir) => {
    await writeFile(
      join(dir, 'state.json'),
      JSON.stringify({
        schemaVersion: 1,
        sessions: {
          'claude-code:kept': {
            runtime: 'claude-code',
            sessionId: 'kept',
            lastRecordIndex: 3,
            lastTotalRecords: 4,
          },
          'cursor:legacy': {
            runtime: 'cursor',
            sessionId: 'legacy',
            lastRecordIndex: 8,
            lastTotalRecords: 10,
          },
        },
      }),
    );
    await state.migrateLegacyCursorState('legacy');

    await state.resetBySession('cursor', 'legacy');

    expect(await state.getSession('cursor', 'legacy')).toBeNull();
    expect(await state.getSession('claude-code', 'kept')).toMatchObject({
      lastRecordIndex: 3,
    });
    expect(
      (await loadCursorState()).legacyUnverified['cursor:legacy'],
    ).toBeUndefined();
  });
});

it.each([
  ['corrupt', '{ corrupt'],
  ['schema', JSON.stringify({ schemaVersion: 1, sessions: {} })],
] as const)(
  'runtime-scoped Cursor reset truthfully reports destructive whole-store %s recovery',
  async (reason, raw) => {
    await withTmpStateDir(async (dir) => {
      await writeFile(join(dir, 'cursor-state.json'), raw);
      await expect(
        state.resetByRuntimeWithDiagnostics('cursor'),
      ).resolves.toMatchObject({
        runtime: 'cursor',
        recovery: {
          performed: true,
          reason,
          scope: 'cursor-store',
          destructive: true,
          preservesSiblingSessions: false,
        },
      });
      await expect(loadCursorState()).resolves.toEqual({
        schemaVersion: 2,
        sessions: {},
        legacyUnverified: {},
      });
    });
  },
);

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
    const pending = state
      .mutate((s: any) => s)
      .finally(() => {
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
    expect(settled, 'a live-owner lock must not be reclaimed while fresh').toBe(
      false,
    );

    // Simulate the owner's own releaseLock().
    lockRaceHarness.stopOpenCounter();
    await unlink(lock);
    await pending;
    expect(settled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 15. Pre-upgrade empty locks are owner-unknown and therefore fail closed.
// A live subprocess models the legacy runtime that published an empty lock.
// ---------------------------------------------------------------------------
it.each([
  [
    'state.json.lock',
    (dir: string) => join(dir, 'state.json.lock'),
    () => state.mutate((s: any) => s),
  ],
  [
    'cursor-state.json.lock',
    (dir: string) => join(dir, 'cursor-state.json.lock'),
    () => mutateCursorState((s) => s),
  ],
  [
    'cursor-state-transition.lock',
    (dir: string) => join(dir, 'cursor-state-transition.lock'),
    () => state.resetByRuntime('cursor'),
  ],
] as const)(
  'a live pre-upgrade empty %s fails closed until its owner releases it',
  async (_label, lockFor, operation) => {
    await withTmpStateDir(async (dir) => {
      const lock = lockFor(dir);
      const holder = await startLegacyEmptyLockHolder(lock);
      lockRaceHarness.startOpenCounter(lock);
      let settled = false;
      const pending = operation().finally(() => {
        settled = true;
      });
      try {
        await vi.waitFor(
          () => {
            if (lockRaceHarness.peekOpenCount() < 2) {
              throw new Error('waiting for a second lock attempt');
            }
          },
          { timeout: 2000, interval: 5 },
        );
        expect(settled).toBe(false);
        expect(await readFile(lock, 'utf8')).toBe('');
      } finally {
        lockRaceHarness.stopOpenCounter();
        await holder.release();
      }
      await pending;
      expect(settled).toBe(true);
    });
  },
);

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
    const pending = state
      .mutate((s: any) => s)
      .finally(() => {
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
// 18. Stale-lock reclaim is bound to the exact observed generation.
// The second read is the removal-time revalidation. Replacing the dead lock
// immediately before that read deterministically models another reclaimer
// publishing a fresh live generation in the inspection/removal window.
// ---------------------------------------------------------------------------
it.each([
  [
    'state.json.lock',
    (dir: string) => join(dir, 'state.json.lock'),
    () => state.mutate((s: any) => s),
  ],
  [
    'cursor-state.json.lock',
    (dir: string) => join(dir, 'cursor-state.json.lock'),
    () => mutateCursorState((s) => s),
  ],
  [
    'cursor-state-transition.lock',
    (dir: string) => join(dir, 'cursor-state-transition.lock'),
    () => state.resetByRuntime('cursor'),
  ],
] as const)(
  'replacement between inspection and removal never deletes a fresh live generation of %s',
  async (_label, lockFor, operation) => {
    await withTmpStateDir(async (dir) => {
      const lock = lockFor(dir);
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

      lockRaceHarness.setReadInterceptor(lock, 2, async (path, real) => {
        await unlink(path);
        await writeFile(path, String(process.pid));
        return real(path, 'utf8');
      });

      lockRaceHarness.startOpenCounter(lock);
      let settled = false;
      const pending = operation().finally(() => {
        settled = true;
      });
      try {
        await vi.waitFor(() => {
          expect(lockRaceHarness.peekOpenCount()).toBeGreaterThanOrEqual(3);
        });
        expect(await readFile(lock, 'utf8')).toBe(String(process.pid));
        expect(settled).toBe(false);
        await unlink(lock);
        await pending;
        expect(settled).toBe(true);
      } finally {
        lockRaceHarness.stopOpenCounter();
        killSpy.mockRestore();
      }
    });
  },
);
