import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { enableActivation } from './activation.js';
import {
  latestDeliveryDiagnostic,
  publishDeliveryDiagnostic,
} from './diagnostics.js';
import { openCollaboration } from './membership.js';
import { activationDirectory } from './paths.js';

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'diagnostics-test-'));
  const collaborationId = crypto.randomUUID();
  const pin = { runtime: 'codex' as const, sessionId: 'owner' };
  await openCollaboration({
    root,
    collaborationId,
    pin,
    alias: 'owner',
    label: 'diagnostics',
    task: 'bounded',
    worktree: '/tmp/owner',
  });
  const activation = await enableActivation({
    root,
    collaborationId,
    pin,
    worktree: '/tmp/owner',
  });
  return { root, pin, activation };
}

describe('delivery diagnostics', () => {
  test('publishes only bounded allowlisted outcome evidence', async () => {
    const f = await fixture();
    const diagnostic = {
      attemptId: 'attempt-1',
      activationId: f.activation.id,
      eventKey: 'event-1',
      boundary: 'stop' as const,
      recordedAt: '2026-09-19T10:00:00.000Z',
      stage: 'output-attempted' as const,
      outcomeCode: 'stdout-written',
      errorCode: null,
    };
    const first = await publishDeliveryDiagnostic({
      root: f.root,
      pin: f.pin,
      diagnostic,
    });
    expect(
      (
        await publishDeliveryDiagnostic({
          root: f.root,
          pin: f.pin,
          diagnostic,
        })
      ).contentHash,
    ).toBe(first.contentHash);
    expect(
      (await latestDeliveryDiagnostic({ root: f.root, pin: f.pin })).latest,
    ).toMatchObject({ attemptId: 'attempt-1', outcomeCode: 'stdout-written' });
  });

  test('rejects secrets, oversized values, and conflicting same-attempt retries', async () => {
    const f = await fixture();
    const base = {
      attemptId: 'attempt-2',
      activationId: f.activation.id,
      eventKey: 'event-2',
      boundary: 'watch' as const,
      recordedAt: '2026-09-19T10:00:00.000Z',
      stage: 'event-claimed' as const,
      outcomeCode: 'claimed',
      errorCode: null,
    };
    await publishDeliveryDiagnostic({
      root: f.root,
      pin: f.pin,
      diagnostic: base,
    });
    await expect(
      publishDeliveryDiagnostic({
        root: f.root,
        pin: f.pin,
        diagnostic: { ...base, outcomeCode: 'different' },
      }),
    ).rejects.toMatchObject({ code: 'RECORD_CONFLICT' });
    await expect(
      publishDeliveryDiagnostic({
        root: f.root,
        pin: f.pin,
        diagnostic: {
          ...base,
          attemptId: 'attempt-secret',
          outcomeCode: 'password=hidden',
        },
      }),
    ).rejects.toThrow('sensitive');
    await expect(
      publishDeliveryDiagnostic({
        root: f.root,
        pin: f.pin,
        diagnostic: { ...base, attemptId: 'a'.repeat(129) },
      }),
    ).rejects.toThrow('bounded');
  });

  test('reports diagnostic capacity without deleting or truncating records', async () => {
    const f = await fixture();
    const directory = path.join(
      activationDirectory(f.root, f.pin),
      'diagnostics',
    );
    await mkdir(directory, { recursive: true });
    for (let index = 0; index < 4097; index += 1)
      await writeFile(
        path.join(directory, `${index}.json`),
        '{"schemaVersion":1}\n',
      );
    expect(
      await latestDeliveryDiagnostic({ root: f.root, pin: f.pin }),
    ).toMatchObject({
      latest: null,
      capacityError: expect.stringContaining('4096'),
    });
  }, 30_000);
});
