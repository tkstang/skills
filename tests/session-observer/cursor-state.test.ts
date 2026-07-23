import {
  access,
  readFile,
  readdir,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import {
  getCursorSession,
  loadCursorState,
  mutateCursorState,
  setCursorSession,
} from '../../src/transcript/session-observer/lib/cursor-state.js';
import * as legacyState from '../../src/transcript/session-observer/lib/state.js';
import type { CursorSessionStateEntry } from '../../src/transcript/session-observer/lib/types.js';
import { withTmpStateDir } from './helpers/tmpdir.js';

function checkpoint(nextFrameIndex = 3) {
  return {
    indexBase: 'zero-based-jsonl-frame-index' as const,
    nextFrameIndex,
    prefixBytes: 128,
    prefixSha256: 'a'.repeat(64),
    observedSize: 128,
    device: 12,
    inode: 34,
  };
}

function sessionEntry(sessionId = 'cursor-session'): CursorSessionStateEntry {
  return {
    runtime: 'cursor',
    sessionId,
    indexBase: 'zero-based-jsonl-frame-index',
    lastRecordIndex: 3,
    canonicalCwd: '/workspace/project',
    transcriptPath:
      '/cursor/projects/project/agent-transcripts/session/transcript.jsonl',
    continuity: checkpoint(),
    lastStatus: {
      engagement: 'engaged',
      activity: 'assistant-progress',
      content: 'buffered',
      lifecycle: 'pending',
      delivery: 'reserved',
      health: 'healthy',
    },
    openTurn: {
      turnId: 'turn-0',
      fromFrameIndex: 0,
      observedThroughFrame: 2,
      deliveredEntryKeys: ['entry-0'],
      humanRecordIndexes: [0],
      toolRecordIndexes: [],
      lifecycle: 'pending',
    },
    stabilityCandidate: {
      turnId: 'turn-0',
      fromFrameIndex: 1,
      throughFrameIndex: 2,
      entryKeys: ['entry-0'],
      prefixBytes: 128,
      prefixSha256: 'b'.repeat(64),
      firstObservedAt: '2026-07-22T00:00:00.000Z',
      confirmAfter: '2026-07-22T00:00:01.000Z',
    },
    pendingDelivery: {
      deliveryId: 'delivery-0',
      expectedNextFrameIndex: 0,
      reservedThroughFrameIndex: 2,
      entryKeys: ['entry-0'],
      intendedCheckpoint: checkpoint(),
      reservedByPid: 123,
      reservedAt: '2026-07-22T00:00:01.000Z',
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeLegacyState(
  dir: string,
  sessionId: string,
  lastRecordIndex: number,
): Promise<void> {
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
          transcriptPath: '/tmp/claude.jsonl',
        },
        [`cursor:${sessionId}`]: {
          runtime: 'cursor',
          sessionId,
          lastRecordIndex,
          lastTotalRecords: lastRecordIndex + 2,
          transcriptPath: '/tmp/cursor.jsonl',
        },
      },
    }),
  );
}

it('loads an empty isolated Cursor schema v2 state', async () => {
  await withTmpStateDir(async (dir) => {
    await expect(loadCursorState()).resolves.toEqual({
      schemaVersion: 2,
      sessions: {},
      legacyUnverified: {},
    });
    await expect(access(join(dir, 'state.json'))).rejects.toThrow();
  });
});

it('writes cursor-state.json atomically with owner-only permissions and leaves state.json unchanged', async () => {
  await withTmpStateDir(async (dir) => {
    const legacy = '{"schemaVersion":1,"sessions":{}}';
    await writeFile(join(dir, 'state.json'), legacy);

    await mutateCursorState((state) => state);

    const cursorPath = join(dir, 'cursor-state.json');
    await expect(access(cursorPath)).resolves.not.toThrow();
    expect((await stat(dir)).mode & 0o777).toBe(0o700);
    expect((await stat(cursorPath)).mode & 0o777).toBe(0o600);
    expect(await readFile(join(dir, 'state.json'), 'utf8')).toBe(legacy);
    expect(
      (await readdir(dir)).filter((name) => name.endsWith('.tmp')),
    ).toEqual([]);
  });
});

it('persists observation status and completion-reconciliation context without prose', async () => {
  await withTmpStateDir(async (dir) => {
    const entry = sessionEntry();
    await setCursorSession(entry);

    await expect(getCursorSession(entry.sessionId)).resolves.toEqual(entry);
    const raw = JSON.parse(
      await readFile(join(dir, 'cursor-state.json'), 'utf8'),
    );
    expect(raw).toMatchObject({
      schemaVersion: 2,
      sessions: {
        'cursor:cursor-session': {
          lastStatus: {
            content: 'buffered',
            lifecycle: 'pending',
            delivery: 'reserved',
          },
          openTurn: {
            deliveredEntryKeys: ['entry-0'],
            lifecycle: 'pending',
          },
          stabilityCandidate: {
            entryKeys: ['entry-0'],
          },
          pendingDelivery: {
            deliveryId: 'delivery-0',
            entryKeys: ['entry-0'],
          },
        },
      },
    });
    expect(JSON.stringify(raw)).not.toContain('assistant text');
  });
});

it('serializes concurrent Cursor mutations under the Cursor-only lock', async () => {
  await withTmpStateDir(async () => {
    await Promise.all([
      setCursorSession(sessionEntry('session-a')),
      setCursorSession(sessionEntry('session-b')),
    ]);

    const loaded = await loadCursorState();
    expect(Object.keys(loaded.sessions).toSorted()).toEqual([
      'cursor:session-a',
      'cursor:session-b',
    ]);
  });
});

it('waits for cursor-state.json.lock before reading or writing backups', async () => {
  await withTmpStateDir(async (dir) => {
    await writeFile(join(dir, 'cursor-state.json'), '{ broken');
    const lock = join(dir, 'cursor-state.json.lock');
    await writeFile(lock, String(process.pid));

    let settled = false;
    const pending = loadCursorState().finally(() => {
      settled = true;
    });
    await sleep(75);
    expect(settled).toBe(false);

    await unlink(lock);
    await expect(pending).resolves.toEqual({
      schemaVersion: 2,
      sessions: {},
      legacyUnverified: {},
    });
    expect(
      (await readdir(dir)).some((name) =>
        name.startsWith('cursor-state.json.corrupt-'),
      ),
    ).toBe(true);
  });
});

it('backs up corrupt and invalid-schema Cursor state without trusting it', async () => {
  await withTmpStateDir(async (dir) => {
    await writeFile(join(dir, 'cursor-state.json'), '{ corrupt');
    expect((await loadCursorState()).sessions).toEqual({});

    await writeFile(
      join(dir, 'cursor-state.json'),
      JSON.stringify({ schemaVersion: 1, sessions: {} }),
    );
    expect((await loadCursorState()).sessions).toEqual({});

    const files = await readdir(dir);
    expect(
      files.some((name) => name.startsWith('cursor-state.json.corrupt-')),
    ).toBe(true);
    expect(
      files.some((name) => name.startsWith('cursor-state.json.schema-')),
    ).toBe(true);
  });
});

it.each([
  'marker-written',
  'backup-written',
  'legacy-removed',
  'marker-legacy-removed',
  'complete',
] as const)(
  'resumes legacy Cursor migration after an injected %s failure',
  async (boundary) => {
    await withTmpStateDir(async (dir) => {
      await writeLegacyState(dir, 'legacy-session', 7);

      await expect(
        legacyState.migrateLegacyCursorState('legacy-session', {
          onBoundary(reached) {
            if (reached === boundary) {
              throw new Error(`injected:${boundary}`);
            }
          },
        }),
      ).rejects.toThrow(`injected:${boundary}`);

      const marker =
        await legacyState.migrateLegacyCursorState('legacy-session');
      expect(marker).toMatchObject({
        runtime: 'cursor',
        sessionId: 'legacy-session',
        legacyLastRecordIndex: 7,
        migrationStatus: 'complete',
      });
      await expect(access(marker!.backupPath)).resolves.not.toThrow();

      const legacy = JSON.parse(
        await readFile(join(dir, 'state.json'), 'utf8'),
      );
      expect(legacy.sessions['cursor:legacy-session']).toBeUndefined();
      expect(legacy.sessions['claude-code:preserved']).toMatchObject({
        lastRecordIndex: 4,
      });

      const cursor = await loadCursorState();
      expect(cursor.sessions['cursor:legacy-session']).toBeUndefined();
      expect(cursor.legacyUnverified['cursor:legacy-session']).toEqual(marker);
    });
  },
);

it('blocks migration if a legacy Cursor record index changes after the marker', async () => {
  await withTmpStateDir(async (dir) => {
    await writeLegacyState(dir, 'changed-session', 5);
    await expect(
      legacyState.migrateLegacyCursorState('changed-session', {
        onBoundary(boundary) {
          if (boundary === 'marker-written') {
            throw new Error('stop-after-marker');
          }
        },
      }),
    ).rejects.toThrow('stop-after-marker');

    const legacy = JSON.parse(await readFile(join(dir, 'state.json'), 'utf8'));
    legacy.sessions['cursor:changed-session'].lastRecordIndex = 6;
    await writeFile(join(dir, 'state.json'), JSON.stringify(legacy));

    await expect(
      legacyState.migrateLegacyCursorState('changed-session'),
    ).rejects.toThrow('LEGACY_CURSOR_CHANGED');
    const marker = (await loadCursorState()).legacyUnverified[
      'cursor:changed-session'
    ];
    expect(marker).toMatchObject({
      legacyLastRecordIndex: 5,
      migrationStatus: 'marker-written',
    });
  });
});
