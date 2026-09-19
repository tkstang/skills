import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  activationStatus,
  disableActivation,
  enableActivation,
  MAX_ACTIVATION_DURATION_MS,
  recordHumanActivity,
} from './activation.js';
import {
  closeCollaboration,
  joinCollaboration,
  leaveCollaboration,
  openCollaboration,
  takeOverMembership,
} from './membership.js';
import { activationDirectory } from './paths.js';
import { canonicalRecordHash } from './records.js';

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'activation-test-'));
  const collaborationId = crypto.randomUUID();
  const pin = { runtime: 'codex' as const, sessionId: 'owner' };
  await openCollaboration({
    root,
    collaborationId,
    pin,
    alias: 'owner',
    label: 'activation',
    task: 'finite delivery',
    worktree: '/tmp/owner',
  });
  return { root, collaborationId, pin };
}

const humanEvidence = (qualifiedAt: Date) => ({
  hostVersion: 'fixture-1.0',
  surface: 'fixture-native-prompt',
  qualifiedAt: qualifiedAt.toISOString(),
});

const humanProvenance = (nativeEventId: string) => ({
  hostVersion: 'fixture-1.0',
  surface: 'fixture-native-prompt',
  nativeEventId,
  trustedHumanOrigin: true as const,
});

describe('delivery activation', () => {
  test('publishes the complete immutable schema and requires termination before a successor', async () => {
    const input = await fixture();
    const now = new Date('2026-09-19T10:00:00.000Z');
    const first = await enableActivation({
      ...input,
      worktree: '/tmp/owner',
      now,
    });
    expect(first).toMatchObject({
      epoch: 0,
      previousEpoch: null,
      controller: 'standalone-messaging',
      thirdPartyHookAcknowledgment: null,
      noObserverMonitorAttestation: null,
      expiryMode: 'fixed',
      maxContinuations: 20,
      waitMs: 0,
    });
    await expect(
      enableActivation({ ...input, worktree: '/tmp/owner', now }),
    ).rejects.toMatchObject({ code: 'DELIVERY_CONFLICT' });
    await disableActivation({
      root: input.root,
      pin: input.pin,
      now: new Date(now.getTime() + 1),
    });
    const second = await enableActivation({
      ...input,
      worktree: '/tmp/owner',
      now: new Date(now.getTime() + 2),
    });
    expect(second).toMatchObject({ epoch: 1, previousEpoch: 0 });
  });

  test('renews only proven human-idle events without crossing an expiry gap or hard cap', async () => {
    const input = await fixture();
    const start = new Date('2026-09-19T10:00:00.000Z');
    await enableActivation({
      ...input,
      worktree: '/tmp/owner',
      now: start,
      expiryMode: 'human-idle',
      idleTimeoutMs: 1000,
      maxDurationMs: 2500,
      humanProvenanceEvidence: humanEvidence(start),
    });
    await recordHumanActivity({
      root: input.root,
      pin: input.pin,
      eventKey: 'human-1',
      now: new Date(start.getTime() + 900),
      provenance: humanProvenance('human-1'),
    });
    expect(
      (
        await activationStatus(
          input.root,
          input.pin,
          new Date(start.getTime() + 1800),
        )
      ).active,
    ).toBe(true);
    await recordHumanActivity({
      root: input.root,
      pin: input.pin,
      eventKey: 'human-2',
      now: new Date(start.getTime() + 1800),
      provenance: humanProvenance('human-2'),
    });
    const capped = await activationStatus(
      input.root,
      input.pin,
      new Date(start.getTime() + 2501),
    );
    expect(capped).toMatchObject({
      active: false,
      terminationReason: 'expired',
    });
    expect(capped.notice).toContain('Re-enable explicitly');
    await expect(
      recordHumanActivity({
        root: input.root,
        pin: input.pin,
        eventKey: 'late',
        now: new Date(start.getTime() + 2600),
        provenance: humanProvenance('late'),
      }),
    ).rejects.toMatchObject({ code: 'DELIVERY_INACTIVE' });
    await expect(
      recordHumanActivity({
        root: input.root,
        pin: input.pin,
        eventKey: 'arbitrary-cli-event',
        now: new Date(start.getTime() + 10),
        provenance: humanProvenance('different-native-event'),
      }),
    ).rejects.toThrow('native and exact');
    await expect(
      recordHumanActivity({
        root: input.root,
        pin: input.pin,
        eventKey: 'not-trusted',
        now: new Date(start.getTime() + 10),
        provenance: {
          ...humanProvenance('not-trusted'),
          trustedHumanOrigin: false,
        } as unknown as Parameters<typeof recordHumanActivity>[0]['provenance'],
      }),
    ).rejects.toMatchObject({ code: 'DELIVERY_INACTIVE' });
  });

  test('uses fixed expiry when human provenance is unavailable', async () => {
    const input = await fixture();
    const start = new Date('2026-09-19T10:00:00.000Z');
    await enableActivation({
      ...input,
      worktree: '/tmp/owner',
      now: start,
      expiryMode: 'fixed',
      fixedDurationMs: 1000,
    });
    await expect(
      recordHumanActivity({
        root: input.root,
        pin: input.pin,
        eventKey: 'peer-message',
        now: new Date(start.getTime() + 10),
        provenance: humanProvenance('peer-message'),
      }),
    ).rejects.toMatchObject({ code: 'DELIVERY_CONFLICT' });
    expect(
      (
        await activationStatus(
          input.root,
          input.pin,
          new Date(start.getTime() + 1001),
        )
      ).terminationReason,
    ).toBe('expired');
  });

  test('rejects human-idle enablement and renewal without exact host provenance', async () => {
    const input = await fixture();
    const start = new Date('2026-09-19T10:00:00.000Z');
    await expect(
      enableActivation({
        ...input,
        worktree: '/tmp/owner',
        now: start,
        expiryMode: 'human-idle',
      }),
    ).rejects.toMatchObject({ code: 'DELIVERY_INACTIVE' });
    await enableActivation({
      ...input,
      worktree: '/tmp/owner',
      now: start,
      expiryMode: 'human-idle',
      humanProvenanceEvidence: humanEvidence(start),
    });
    await expect(
      recordHumanActivity({
        root: input.root,
        pin: input.pin,
        eventKey: 'arbitrary-cli-event',
        now: new Date(start.getTime() + 10),
        provenance: {
          ...humanProvenance('different-native-event'),
          hostVersion: 'unqualified-version',
        },
      }),
    ).rejects.toMatchObject({ code: 'DELIVERY_INACTIVE' });
  });

  test('recognizes closure, departure, and binding succession as terminal', async () => {
    for (const terminal of ['close', 'depart', 'takeover'] as const) {
      const input = await fixture();
      const start = new Date('2026-09-19T10:00:00.000Z');
      await enableActivation({
        ...input,
        worktree: '/tmp/owner',
        now: start,
        maxDurationMs: MAX_ACTIVATION_DURATION_MS,
      });
      if (terminal === 'close') await closeCollaboration(input);
      if (terminal === 'depart')
        await leaveCollaboration({ ...input, alias: 'owner' });
      if (terminal === 'takeover') {
        await takeOverMembership({
          ...input,
          alias: 'owner',
          pin: { runtime: 'codex', sessionId: 'successor' },
          expectedPreviousPin: input.pin,
          reason: 'human-directed replacement',
          worktree: '/tmp/owner',
        });
      }
      expect(
        (await activationStatus(input.root, input.pin, start))
          .terminationReason,
      ).toBe(
        terminal === 'close'
          ? 'closed'
          : terminal === 'depart'
            ? 'departed'
            : 'superseded',
      );
    }
  });

  test('one exact session may have only one active collaboration binding', async () => {
    const first = await fixture();
    await enableActivation({ ...first, worktree: '/tmp/owner' });
    const secondId = crypto.randomUUID();
    await openCollaboration({
      root: first.root,
      collaborationId: secondId,
      pin: { runtime: 'claude-code', sessionId: 'driver' },
      alias: 'driver',
      label: 'second',
      task: 'second',
      worktree: '/tmp/driver',
    });
    await joinCollaboration({
      root: first.root,
      collaborationId: secondId,
      pin: first.pin,
      alias: 'owner',
      worktree: '/tmp/owner',
    });
    await expect(
      enableActivation({
        root: first.root,
        collaborationId: secondId,
        pin: first.pin,
        worktree: '/tmp/owner',
      }),
    ).rejects.toMatchObject({ code: 'DELIVERY_CONFLICT' });
  });

  test.each([
    [
      'overlong hard expiry',
      (record: Record<string, unknown>) => {
        record.hardExpiresAt = '2026-09-20T10:00:00.001Z';
        record.fixedExpiresAt = '2026-09-20T10:00:00.001Z';
      },
    ],
    [
      'reversed hard expiry',
      (record: Record<string, unknown>) => {
        record.hardExpiresAt = '2026-09-19T09:59:59.999Z';
      },
    ],
    [
      'fixed expiry beyond hard expiry',
      (record: Record<string, unknown>) => {
        record.hardExpiresAt = '2026-09-19T11:00:00.000Z';
        record.fixedExpiresAt = '2026-09-19T11:00:00.001Z';
      },
    ],
    [
      'mismatched attestation epoch',
      (record: Record<string, unknown>) => {
        record.noObserverMonitorAttestation = {
          pin: record.pin,
          epoch: 1,
          confirmedAt: record.startedAt,
        };
      },
    ],
  ])('fails closed for correctly hashed %s records', async (_label, mutate) => {
    const input = await fixture();
    const now = new Date('2026-09-19T10:00:00.000Z');
    const activation = await enableActivation({
      ...input,
      worktree: '/tmp/owner',
      now,
      fixedDurationMs: 60 * 60 * 1000,
    });
    const file = path.join(
      activationDirectory(input.root, input.pin),
      'epochs',
      '0.json',
    );
    const record = JSON.parse(await readFile(file, 'utf8')) as Record<
      string,
      unknown
    >;
    mutate(record);
    delete record.contentHash;
    record.contentHash = canonicalRecordHash(record);
    await writeFile(file, `${JSON.stringify(record)}\n`);
    await expect(
      activationStatus(input.root, input.pin, now),
    ).rejects.toMatchObject({ code: 'MALFORMED_RECORD' });
    expect(activation.id).toBe(record.id);
  });
});
