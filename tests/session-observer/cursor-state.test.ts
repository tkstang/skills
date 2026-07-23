import {
  access,
  appendFile,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import {
  scanCursorTranscript,
  type CursorTranscriptScan,
} from '../../src/transcript/core/cursor-frames.js';
import {
  abandonCursorDelivery,
  checkpointCursorCandidate,
  commitCursorDelivery,
  getCursorSession,
  loadCursorState,
  mutateCursorState,
  recoverCursorDelivery,
  reserveCursorDelivery,
  resetAllCursorState,
  resetCursorSessionState,
  setCursorSession,
  validateCursorContinuity,
} from '../../src/transcript/session-observer/lib/cursor-state.js';
import * as legacyState from '../../src/transcript/session-observer/lib/state.js';
import type {
  CursorIdentityEvidence,
  CursorSessionStateEntry,
} from '../../src/transcript/session-observer/lib/types.js';
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
      assistantEntryKeys: ['entry-0'],
      humanRecordIndexes: [0],
      toolRecordIndexes: [],
      hasHumanInput: true,
      hasAutomaticControlInput: false,
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
      confirmedAt: null,
    },
    pendingDelivery: {
      deliveryId: 'delivery-0',
      expectedNextFrameIndex: 3,
      expectedCheckpoint: checkpoint(3),
      reservedThroughFrameIndex: 4,
      entryKeys: ['entry-0'],
      intendedCheckpoint: checkpoint(5),
      reservedByPid: 123,
      reservedAt: '2026-07-22T00:00:01.000Z',
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scan(
  transcriptPath: string,
  verifyPrefixBytes?: number,
): Promise<CursorTranscriptScan> {
  return scanCursorTranscript(transcriptPath, {
    verifyPrefixBytes,
    onFrame() {},
  });
}

function exactIdentity(
  transcriptPath: string,
  canonicalCwd = '/workspace/project',
): CursorIdentityEvidence {
  return {
    runtime: 'cursor',
    sessionId: 'continuity-session',
    projectCwd: canonicalCwd,
    canonicalCwd,
    canonicalTranscriptPath: transcriptPath,
    cwdEvidence: ['direct-project-root'],
    sessionEvidence: ['explicit-pin', 'transcript-path'],
    strength: 'exact',
    reasons: [],
  };
}

function entryFromScan(
  transcriptPath: string,
  current: CursorTranscriptScan,
): CursorSessionStateEntry {
  const nextFrameIndex =
    current.safeThroughFrame === null ? 0 : current.safeThroughFrame + 1;
  return {
    ...sessionEntry('continuity-session'),
    sessionId: 'continuity-session',
    lastRecordIndex: nextFrameIndex,
    transcriptPath,
    continuity: {
      indexBase: 'zero-based-jsonl-frame-index',
      nextFrameIndex,
      prefixBytes: current.safePrefixBytes,
      prefixSha256: current.safePrefixSha256,
      observedSize: current.file.size,
      device: current.file.device,
      inode: current.file.inode,
    },
    lastStatus: {
      engagement: 'engaged',
      activity: 'assistant-progress',
      content: 'none',
      lifecycle: 'pending',
      delivery: 'none',
      health: 'healthy',
    },
    openTurn: null,
    stabilityCandidate: null,
    pendingDelivery: null,
  };
}

function deliveryEntry(sessionId = 'delivery-session') {
  return {
    ...sessionEntry(sessionId),
    sessionId,
    continuity: checkpoint(3),
    lastRecordIndex: 3,
    openTurn: {
      turnId: 'turn-delivery',
      fromFrameIndex: 0,
      observedThroughFrame: 2,
      deliveredEntryKeys: [],
      assistantEntryKeys: ['entry-delivery'],
      humanRecordIndexes: [0],
      toolRecordIndexes: [],
      hasHumanInput: true,
      hasAutomaticControlInput: false,
      lifecycle: 'pending' as const,
    },
    stabilityCandidate: null,
    pendingDelivery: null,
    lastStatus: {
      engagement: 'engaged' as const,
      activity: 'assistant-progress' as const,
      content: 'available' as const,
      lifecycle: 'pending' as const,
      delivery: 'none' as const,
      health: 'healthy' as const,
    },
  };
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
    await expect(pending).rejects.toMatchObject({
      code: 'CURSOR_STATE_RECOVERY_REQUIRED',
      reason: 'corrupt',
    });
    expect(
      (await readdir(dir)).some((name) =>
        name.startsWith('cursor-state.json.corrupt-'),
      ),
    ).toBe(true);
  });
});

it.each([
  ['corrupt', '{ corrupt'],
  ['schema', JSON.stringify({ schemaVersion: 1, sessions: {} })],
] as const)(
  'fails closed on %s Cursor state across every mutation path until explicit reset',
  async (label, raw) => {
    await withTmpStateDir(async (dir) => {
      const path = join(dir, 'cursor-state.json');
      const entry = deliveryEntry('corrupt-session');
      const pending = {
        deliveryId: 'corrupt-delivery',
        expectedNextFrameIndex: 3,
        expectedCheckpoint: entry.continuity,
        reservedThroughFrameIndex: 4,
        entryKeys: ['entry-delivery'],
        intendedCheckpoint: {
          ...checkpoint(5),
          prefixBytes: 256,
          observedSize: 256,
        },
        reservedByPid: 101,
        reservedAt: '2026-07-22T00:00:00.000Z',
      };
      const committed = {
        ...entry,
        lastRecordIndex: 5,
        continuity: pending.intendedCheckpoint,
        pendingDelivery: null,
        stabilityCandidate: null,
        lastStatus: { ...entry.lastStatus, delivery: 'committed' as const },
      };
      const mutations = [
        () => loadCursorState(),
        () => mutateCursorState(() => {}),
        () => setCursorSession(entry),
        () =>
          checkpointCursorCandidate({
            sessionId: entry.sessionId,
            stabilityMs: 100,
            observation: {
              turnId: 'turn-corrupt',
              fromFrameIndex: 3,
              throughFrameIndex: 4,
              entryKeys: ['entry-delivery'],
              prefixBytes: 256,
              prefixSha256: 'b'.repeat(64),
              observedAt: '2026-07-22T00:00:00.000Z',
            },
          }),
        () =>
          reserveCursorDelivery({
            sessionId: entry.sessionId,
            ownerPid: 101,
            expected: entry.continuity,
            pending,
          }),
        () =>
          commitCursorDelivery({
            sessionId: entry.sessionId,
            deliveryId: pending.deliveryId,
            nextState: committed,
          }),
        () =>
          abandonCursorDelivery({
            sessionId: entry.sessionId,
            deliveryId: pending.deliveryId,
            ownerPid: 101,
          }),
        () => recoverCursorDelivery(entry.sessionId),
        () => resetCursorSessionState(entry.sessionId),
      ];

      for (const mutation of mutations) {
        await writeFile(path, raw);
        await expect(mutation()).rejects.toMatchObject({
          code: 'CURSOR_STATE_RECOVERY_REQUIRED',
        });
        expect(await readFile(path, 'utf8')).toBe(raw);
      }

      expect(
        (await readdir(dir)).some((name) =>
          name.startsWith(`cursor-state.json.${label}-`),
        ),
      ).toBe(true);
      await writeFile(path, raw);
      await expect(resetAllCursorState()).resolves.toBe(0);
      await expect(loadCursorState()).resolves.toEqual({
        schemaVersion: 2,
        sessions: {},
        legacyUnverified: {},
      });
    });
  },
);

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

it('validates append-only Cursor continuity from the exact saved prefix', async () => {
  await withTmpStateDir(async (dir) => {
    const transcriptPath = join(dir, 'append.jsonl');
    await writeFile(transcriptPath, '{"role":"user","content":"one"}\n');
    const initial = await scan(transcriptPath);
    const prior = entryFromScan(transcriptPath, initial);

    await appendFile(transcriptPath, '{"role":"assistant","content":"two"}\n');
    const appended = await scan(transcriptPath, prior.continuity.prefixBytes);

    expect(
      validateCursorContinuity(exactIdentity(transcriptPath), appended, prior),
    ).toEqual({
      status: 'verified',
      fromFrameIndex: prior.continuity.nextFrameIndex,
    });
  });
});

it('resumes from the verified frame after a blocking partial frame is repaired', async () => {
  await withTmpStateDir(async (dir) => {
    const transcriptPath = join(dir, 'repair.jsonl');
    await writeFile(
      transcriptPath,
      '{"role":"user","content":"one"}\n{"role":"assistant"',
    );
    const blocked = await scan(transcriptPath);
    const prior = entryFromScan(transcriptPath, blocked);
    expect(blocked.blockingFrame?.parseState).toBe('partial');

    await writeFile(
      transcriptPath,
      '{"role":"user","content":"one"}\n{"role":"assistant","content":"repaired"}\n',
    );
    const repaired = await scan(transcriptPath, prior.continuity.prefixBytes);

    expect(
      validateCursorContinuity(exactIdentity(transcriptPath), repaired, prior),
    ).toEqual({
      status: 'verified',
      fromFrameIndex: prior.continuity.nextFrameIndex,
    });
  });
});

it.each([
  ['partial', `{"role":"assistant","content":"${'x'.repeat(200)}`],
  ['malformed', `{"role":"assistant","content":${'x'.repeat(200)}}\n`],
])(
  'accepts a shorter repair of an unverified %s tail',
  async (_parseState, blockingTail) => {
    await withTmpStateDir(async (dir) => {
      const transcriptPath = join(dir, 'shorter-repair.jsonl');
      const verified = '{"role":"user","content":"one"}\n';
      await writeFile(transcriptPath, verified + blockingTail);
      const blocked = await scan(transcriptPath);
      const prior = entryFromScan(transcriptPath, blocked);
      expect(blocked.file.size).toBeGreaterThan(
        Buffer.byteLength(verified + '{"role":"assistant","content":"ok"}\n'),
      );

      await writeFile(
        transcriptPath,
        verified + '{"role":"assistant","content":"ok"}\n',
      );
      const repaired = await scan(transcriptPath, prior.continuity.prefixBytes);

      expect(
        validateCursorContinuity(
          exactIdentity(transcriptPath),
          repaired,
          prior,
        ),
      ).toEqual({
        status: 'verified',
        fromFrameIndex: prior.continuity.nextFrameIndex,
      });
    });
  },
);

it('blocks transcript shrink without mutating prior evidence', async () => {
  await withTmpStateDir(async (dir) => {
    const transcriptPath = join(dir, 'shrink.jsonl');
    await writeFile(
      transcriptPath,
      '{"role":"user","content":"one"}\n{"role":"assistant","content":"two"}\n',
    );
    const initial = await scan(transcriptPath);
    const prior = entryFromScan(transcriptPath, initial);
    const snapshot = structuredClone(prior);

    await writeFile(transcriptPath, '{"role":"user","content":"one"}\n');
    const shrunk = await scan(transcriptPath, prior.continuity.prefixBytes);

    expect(
      validateCursorContinuity(exactIdentity(transcriptPath), shrunk, prior),
    ).toMatchObject({
      status: 'blocked',
      code: 'TRANSCRIPT_SHRANK',
      checkpoint: prior.continuity,
    });
    expect(prior).toEqual(snapshot);
  });
});

it('blocks same-path inode replacement even when the prefix is identical', async () => {
  await withTmpStateDir(async (dir) => {
    const transcriptPath = join(dir, 'replace.jsonl');
    const replacementPath = join(dir, 'replacement.jsonl');
    const content = '{"role":"user","content":"one"}\n';
    await writeFile(transcriptPath, content);
    const initial = await scan(transcriptPath);
    const prior = entryFromScan(transcriptPath, initial);

    await writeFile(replacementPath, content);
    await rename(replacementPath, transcriptPath);
    const replaced = await scan(transcriptPath, prior.continuity.prefixBytes);
    expect(replaced.file.inode).not.toBe(prior.continuity.inode);

    expect(
      validateCursorContinuity(exactIdentity(transcriptPath), replaced, prior),
    ).toMatchObject({
      status: 'blocked',
      code: 'TRANSCRIPT_REPLACED',
    });
  });
});

it('blocks canonical-path rotation even when transcript bytes match', async () => {
  await withTmpStateDir(async (dir) => {
    const transcriptPath = join(dir, 'original.jsonl');
    const rotatedPath = join(dir, 'rotated.jsonl');
    const content = '{"role":"user","content":"one"}\n';
    await writeFile(transcriptPath, content);
    const initial = await scan(transcriptPath);
    const prior = entryFromScan(transcriptPath, initial);
    await writeFile(rotatedPath, content);
    const rotated = await scan(rotatedPath, prior.continuity.prefixBytes);

    expect(
      validateCursorContinuity(exactIdentity(rotatedPath), rotated, prior),
    ).toMatchObject({
      status: 'blocked',
      code: 'ROTATION_UNSUPPORTED',
    });
  });
});

it('blocks an in-place prefix mutation and does not expose the saved hash', async () => {
  await withTmpStateDir(async (dir) => {
    const transcriptPath = join(dir, 'prefix.jsonl');
    await writeFile(transcriptPath, '{"role":"user","content":"one"}\n');
    const initial = await scan(transcriptPath);
    const prior = entryFromScan(transcriptPath, initial);

    await writeFile(transcriptPath, '{"role":"user","content":"two"}\n');
    const mutated = await scan(transcriptPath, prior.continuity.prefixBytes);
    const result = validateCursorContinuity(
      exactIdentity(transcriptPath),
      mutated,
      prior,
    );
    expect(result).toMatchObject({
      status: 'blocked',
      code: 'PREFIX_MISMATCH',
    });
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      expect(result.message).not.toContain(prior.continuity.prefixSha256);
    }
  });
});

it('blocks stateful continuity when stat identity is unavailable', async () => {
  await withTmpStateDir(async (dir) => {
    const transcriptPath = join(dir, 'missing-stat.jsonl');
    await writeFile(transcriptPath, '{"role":"user","content":"one"}\n');
    const initial = await scan(transcriptPath);
    const prior = entryFromScan(transcriptPath, initial);
    const missingIdentity = {
      ...initial,
      file: { ...initial.file, device: null },
      verifiedPrefixSha256: prior.continuity.prefixSha256,
    };

    expect(
      validateCursorContinuity(
        exactIdentity(transcriptPath),
        missingIdentity,
        prior,
      ),
    ).toMatchObject({
      status: 'blocked',
      code: 'FILE_IDENTITY_UNAVAILABLE',
    });
  });
});

it('explicit reset permits replay from frame zero as new continuity', async () => {
  await withTmpStateDir(async (dir) => {
    const transcriptPath = join(dir, 'replay.jsonl');
    await writeFile(transcriptPath, '{"role":"user","content":"one"}\n');
    const current = await scan(transcriptPath);
    await setCursorSession(entryFromScan(transcriptPath, current));
    await legacyState.resetBySession('cursor', 'continuity-session');
    expect(await getCursorSession('continuity-session')).toBeNull();

    expect(
      validateCursorContinuity(exactIdentity(transcriptPath), current, null),
    ).toEqual({ status: 'new', fromFrameIndex: 0 });
  });
});

it('confirms a candidate from its exact prefix boundary even when later bytes grow', async () => {
  await withTmpStateDir(async (dir) => {
    const sessionId = 'candidate-growth';
    await setCursorSession(deliveryEntry(sessionId));
    const transcriptPath = join(dir, 'candidate-growth.jsonl');
    await writeFile(transcriptPath, '{"role":"assistant","content":"one"}\n');
    const first = await scan(transcriptPath);

    const staged = await checkpointCursorCandidate({
      sessionId,
      stabilityMs: 1000,
      observation: {
        turnId: 'turn-growth',
        fromFrameIndex: 0,
        throughFrameIndex: 0,
        entryKeys: ['entry-growth'],
        prefixBytes: first.safePrefixBytes,
        prefixSha256: first.safePrefixSha256,
        observedAt: '2026-07-22T00:00:00.000Z',
      },
    });
    expect(staged).toMatchObject({ status: 'staged' });

    await appendFile(
      transcriptPath,
      '{"role":"assistant","content":"later"}\n',
    );
    const grown = await scan(transcriptPath, first.safePrefixBytes);
    expect(grown.file.size).toBeGreaterThan(first.file.size);

    const confirmed = await checkpointCursorCandidate({
      sessionId,
      stabilityMs: 1000,
      observation: {
        turnId: 'turn-growth',
        fromFrameIndex: 0,
        throughFrameIndex: 0,
        entryKeys: ['entry-growth'],
        prefixBytes: first.safePrefixBytes,
        prefixSha256: grown.verifiedPrefixSha256!,
        observedAt: '2026-07-22T00:00:02.000Z',
      },
    });
    expect(confirmed).toMatchObject({
      status: 'confirmed',
      entryKeys: ['entry-growth'],
    });
    expect(
      (await getCursorSession(sessionId))?.stabilityCandidate,
    ).toMatchObject({
      prefixBytes: first.safePrefixBytes,
      confirmedAt: '2026-07-22T00:00:02.000Z',
    });
  });
});

it('replaces a changed stability candidate and restarts its confirmation clock', async () => {
  await withTmpStateDir(async () => {
    const sessionId = 'candidate-replaced';
    await setCursorSession(deliveryEntry(sessionId));
    const baseObservation = {
      turnId: 'turn-replaced',
      fromFrameIndex: 1,
      throughFrameIndex: 2,
      entryKeys: ['entry-old'],
      prefixBytes: 128,
      prefixSha256: 'c'.repeat(64),
      observedAt: '2026-07-22T00:00:00.000Z',
    };
    await checkpointCursorCandidate({
      sessionId,
      stabilityMs: 1000,
      observation: baseObservation,
    });

    const replaced = await checkpointCursorCandidate({
      sessionId,
      stabilityMs: 1000,
      observation: {
        ...baseObservation,
        entryKeys: ['entry-new'],
        prefixSha256: 'd'.repeat(64),
        observedAt: '2026-07-22T00:00:02.000Z',
      },
    });
    expect(replaced).toMatchObject({
      status: 'replaced',
      entryKeys: ['entry-new'],
    });
    expect(
      (await getCursorSession(sessionId))?.stabilityCandidate,
    ).toMatchObject({
      entryKeys: ['entry-new'],
      firstObservedAt: '2026-07-22T00:00:02.000Z',
      confirmAfter: '2026-07-22T00:00:03.000Z',
      confirmedAt: null,
    });
  });
});

it('restores structural openTurn context across restart without transcript prose', async () => {
  await withTmpStateDir(async (dir) => {
    const entry = deliveryEntry('open-turn-restart');
    await setCursorSession(entry);

    const restarted = await getCursorSession('open-turn-restart');
    expect(restarted?.openTurn).toEqual(entry.openTurn);
    expect(restarted?.openTurn).toMatchObject({
      assistantEntryKeys: ['entry-delivery'],
      humanRecordIndexes: [0],
      hasHumanInput: true,
      hasAutomaticControlInput: false,
    });
    expect(
      await readFile(join(dir, 'cursor-state.json'), 'utf8'),
    ).not.toContain('assistant prose');
  });
});

it('delivery reservation rejects owner conflicts and stale checkpoints', async () => {
  await withTmpStateDir(async (dir) => {
    const sessionId = 'delivery-conflict';
    const entry = deliveryEntry(sessionId);
    await setCursorSession(entry);
    const intended = {
      ...checkpoint(5),
      prefixBytes: 256,
      prefixSha256: 'e'.repeat(64),
      observedSize: 256,
    };
    const pending = {
      deliveryId: 'delivery-conflict-1',
      expectedNextFrameIndex: 3,
      expectedCheckpoint: entry.continuity,
      reservedThroughFrameIndex: 4,
      entryKeys: ['entry-delivery'],
      intendedCheckpoint: intended,
      reservedByPid: 101,
      reservedAt: '2026-07-22T00:00:00.000Z',
    };

    await expect(
      reserveCursorDelivery({
        sessionId,
        ownerPid: 101,
        expected: entry.continuity,
        pending,
      }),
    ).resolves.toBe('reserved');
    const reservedState = await readFile(
      join(dir, 'cursor-state.json'),
      'utf8',
    );
    await expect(
      reserveCursorDelivery({
        sessionId,
        ownerPid: 202,
        expected: entry.continuity,
        pending: {
          ...pending,
          deliveryId: 'delivery-conflict-2',
          reservedByPid: 202,
        },
      }),
    ).resolves.toBe('owner-conflict');
    expect(await readFile(join(dir, 'cursor-state.json'), 'utf8')).toBe(
      reservedState,
    );

    const staleSession = 'delivery-stale';
    await setCursorSession(deliveryEntry(staleSession));
    await expect(
      reserveCursorDelivery({
        sessionId: staleSession,
        ownerPid: 101,
        expected: checkpoint(2),
        pending: {
          ...pending,
          expectedNextFrameIndex: 2,
          expectedCheckpoint: checkpoint(2),
        },
      }),
    ).resolves.toBe('stale');

    const structuralStaleSession = 'delivery-structural-stale';
    const structuralEntry = deliveryEntry(structuralStaleSession);
    await setCursorSession(structuralEntry);
    const structurallyChangedExpected = {
      ...structuralEntry.continuity,
      prefixSha256: '9'.repeat(64),
    };
    await expect(
      reserveCursorDelivery({
        sessionId: structuralStaleSession,
        ownerPid: 101,
        expected: structurallyChangedExpected,
        pending: {
          ...pending,
          expectedCheckpoint: structurallyChangedExpected,
        },
      }),
    ).resolves.toBe('stale');
  });
});

it.each([
  [
    'backward frame',
    {
      reservedThroughFrameIndex: 1,
      intendedCheckpoint: checkpoint(2),
    },
  ],
  [
    'backward prefix',
    {
      reservedThroughFrameIndex: 4,
      intendedCheckpoint: {
        ...checkpoint(5),
        prefixBytes: 64,
        observedSize: 128,
      },
    },
  ],
  [
    'mismatched file',
    {
      reservedThroughFrameIndex: 4,
      intendedCheckpoint: {
        ...checkpoint(5),
        prefixBytes: 256,
        observedSize: 256,
        inode: 99,
      },
    },
  ],
])('rejects a %s delivery checkpoint', async (_label, invalid) => {
  await withTmpStateDir(async () => {
    const sessionId = `delivery-invalid-${String(_label).replaceAll(' ', '-')}`;
    const entry = deliveryEntry(sessionId);
    await setCursorSession(entry);

    await expect(
      reserveCursorDelivery({
        sessionId,
        ownerPid: 606,
        expected: entry.continuity,
        pending: {
          deliveryId: `delivery-invalid-${_label}`,
          expectedNextFrameIndex: 3,
          expectedCheckpoint: entry.continuity,
          reservedThroughFrameIndex: invalid.reservedThroughFrameIndex,
          entryKeys: ['entry-delivery'],
          intendedCheckpoint: invalid.intendedCheckpoint,
          reservedByPid: 606,
          reservedAt: '2026-07-22T00:00:00.000Z',
        },
      }),
    ).rejects.toThrow('invalid delivery reservation');
    expect((await getCursorSession(sessionId))?.continuity).toEqual(
      entry.continuity,
    );
  });
});

it('abandons a reservation after crash-before-output without advancing state', async () => {
  await withTmpStateDir(async () => {
    const sessionId = 'delivery-abandon';
    const entry = deliveryEntry(sessionId);
    await setCursorSession(entry);
    const pending = {
      deliveryId: 'delivery-abandon-1',
      expectedNextFrameIndex: 3,
      expectedCheckpoint: entry.continuity,
      reservedThroughFrameIndex: 4,
      entryKeys: ['entry-delivery'],
      intendedCheckpoint: {
        ...checkpoint(5),
        prefixBytes: 256,
        prefixSha256: 'f'.repeat(64),
        observedSize: 256,
      },
      reservedByPid: 303,
      reservedAt: '2026-07-22T00:00:00.000Z',
    };
    await reserveCursorDelivery({
      sessionId,
      ownerPid: 303,
      expected: entry.continuity,
      pending,
    });

    await expect(
      abandonCursorDelivery({
        sessionId,
        deliveryId: pending.deliveryId,
        ownerPid: 303,
      }),
    ).resolves.toBe('abandoned');
    const after = await getCursorSession(sessionId);
    expect(after?.continuity).toEqual(entry.continuity);
    expect(after?.pendingDelivery).toBeNull();
    expect(after?.lastStatus.delivery).toBe('none');
  });
});

it('recovers crash-after-output as replay-safe delivery-uncertain state', async () => {
  await withTmpStateDir(async () => {
    const sessionId = 'delivery-uncertain';
    const entry = deliveryEntry(sessionId);
    await setCursorSession(entry);
    const pending = {
      deliveryId: 'delivery-uncertain-1',
      expectedNextFrameIndex: 3,
      expectedCheckpoint: entry.continuity,
      reservedThroughFrameIndex: 4,
      entryKeys: ['entry-delivery'],
      intendedCheckpoint: {
        ...checkpoint(5),
        prefixBytes: 256,
        prefixSha256: '1'.repeat(64),
        observedSize: 256,
      },
      reservedByPid: 404,
      reservedAt: '2026-07-22T00:00:00.000Z',
    };
    await reserveCursorDelivery({
      sessionId,
      ownerPid: 404,
      expected: entry.continuity,
      pending,
    });

    const recovered = await recoverCursorDelivery(sessionId);
    expect(recovered).toEqual({
      status: 'delivery-uncertain',
      deliveryId: pending.deliveryId,
      entryKeys: ['entry-delivery'],
      expectedNextFrameIndex: 3,
      reservedThroughFrameIndex: 4,
    });
    expect(await recoverCursorDelivery(sessionId)).toEqual(recovered);
    const after = await getCursorSession(sessionId);
    expect(after?.continuity).toEqual(entry.continuity);
    expect(after?.pendingDelivery).toEqual(pending);
    expect(after?.lastStatus.delivery).toBe('uncertain');
  });
});

it('commits a reserved delivery with one checkpoint CAS and is replay-safe', async () => {
  await withTmpStateDir(async () => {
    const sessionId = 'delivery-commit';
    const entry = deliveryEntry(sessionId);
    await setCursorSession(entry);
    const intended = {
      ...checkpoint(5),
      prefixBytes: 256,
      prefixSha256: '2'.repeat(64),
      observedSize: 256,
    };
    const pending = {
      deliveryId: 'delivery-commit-1',
      expectedNextFrameIndex: 3,
      expectedCheckpoint: entry.continuity,
      reservedThroughFrameIndex: 4,
      entryKeys: ['entry-delivery'],
      intendedCheckpoint: intended,
      reservedByPid: 505,
      reservedAt: '2026-07-22T00:00:00.000Z',
    };
    await reserveCursorDelivery({
      sessionId,
      ownerPid: 505,
      expected: entry.continuity,
      pending,
    });
    const nextState = {
      ...entry,
      lastRecordIndex: 5,
      continuity: intended,
      pendingDelivery: null,
      openTurn: {
        ...entry.openTurn!,
        observedThroughFrame: 4,
        deliveredEntryKeys: ['entry-delivery'],
      },
      lastStatus: {
        ...entry.lastStatus,
        delivery: 'committed' as const,
      },
    };

    await expect(
      commitCursorDelivery({
        sessionId,
        deliveryId: pending.deliveryId,
        nextState,
      }),
    ).resolves.toBe('committed');
    expect(await getCursorSession(sessionId)).toEqual(nextState);
    await expect(
      commitCursorDelivery({
        sessionId,
        deliveryId: pending.deliveryId,
        nextState,
      }),
    ).resolves.toBe('stale');
  });
});

it.each([
  ['backward frame', checkpoint(2)],
  [
    'backward prefix',
    {
      ...checkpoint(5),
      prefixBytes: 64,
      observedSize: 128,
    },
  ],
  [
    'mismatched file',
    {
      ...checkpoint(5),
      prefixBytes: 256,
      observedSize: 256,
      device: 99,
    },
  ],
])('refuses to commit a %s checkpoint through CAS', async (_label, invalid) => {
  await withTmpStateDir(async () => {
    const sessionId = `delivery-commit-${String(_label).replaceAll(' ', '-')}`;
    const entry = deliveryEntry(sessionId);
    await setCursorSession(entry);
    const intended = {
      ...checkpoint(5),
      prefixBytes: 256,
      prefixSha256: '3'.repeat(64),
      observedSize: 256,
    };
    const deliveryId = `delivery-commit-${_label}`;
    await reserveCursorDelivery({
      sessionId,
      ownerPid: 707,
      expected: entry.continuity,
      pending: {
        deliveryId,
        expectedNextFrameIndex: 3,
        expectedCheckpoint: entry.continuity,
        reservedThroughFrameIndex: 4,
        entryKeys: ['entry-delivery'],
        intendedCheckpoint: intended,
        reservedByPid: 707,
        reservedAt: '2026-07-22T00:00:00.000Z',
      },
    });

    await expect(
      commitCursorDelivery({
        sessionId,
        deliveryId,
        nextState: {
          ...entry,
          lastRecordIndex: invalid.nextFrameIndex,
          continuity: invalid,
          pendingDelivery: null,
          stabilityCandidate: null,
          lastStatus: { ...entry.lastStatus, delivery: 'committed' as const },
        },
      }),
    ).resolves.toBe('stale');
    expect((await getCursorSession(sessionId))?.continuity).toEqual(
      entry.continuity,
    );
  });
});
