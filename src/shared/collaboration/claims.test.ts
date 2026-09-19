import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { disableActivation, enableActivation } from './activation.js';
import {
  claimDelivery,
  createDeliveryRetry,
  deliveryClaimStatus,
  watchBatchEventKey,
} from './claims.js';
import { openCollaboration } from './membership.js';

async function fixture(maxContinuations = 2) {
  const root = await mkdtemp(path.join(tmpdir(), 'claims-test-'));
  const collaborationId = crypto.randomUUID();
  const pin = { runtime: 'codex' as const, sessionId: 'owner' };
  await openCollaboration({
    root,
    collaborationId,
    pin,
    alias: 'owner',
    label: 'claims',
    task: 'finite',
    worktree: '/tmp/owner',
  });
  const activation = await enableActivation({
    root,
    collaborationId,
    pin,
    worktree: '/tmp/owner',
    maxContinuations,
  });
  return { root, collaborationId, pin, activation };
}

describe('delivery claims', () => {
  test('orders event, slot, and message claims without acknowledging mail', async () => {
    const f = await fixture();
    const messageId = crypto.randomUUID();
    const result = await claimDelivery({
      root: f.root,
      pin: f.pin,
      eventKey: 'stop-chain-1',
      deliveryKeys: [{ messageId, retryGeneration: 0 }],
      token: 'attempt-1',
    });
    expect(result).toMatchObject({
      duplicateEvent: false,
      activeAfterClaim: true,
    });
    expect(result.slot?.slot).toBe(1);
    expect(result.owned[0]).toMatchObject({ messageId, retryGeneration: 0 });
    const duplicate = await claimDelivery({
      root: f.root,
      pin: f.pin,
      eventKey: 'stop-chain-1',
      deliveryKeys: [{ messageId, retryGeneration: 0 }],
      token: 'attempt-1',
    });
    expect(duplicate).toMatchObject({
      duplicateEvent: true,
      slot: null,
      owned: [],
    });
  });

  test('never overspends slots and does not claim messages after exhaustion', async () => {
    const f = await fixture(1);
    await claimDelivery({
      root: f.root,
      pin: f.pin,
      eventKey: 'event-a',
      deliveryKeys: [{ messageId: crypto.randomUUID(), retryGeneration: 0 }],
    });
    const messageId = crypto.randomUUID();
    const exhausted = await claimDelivery({
      root: f.root,
      pin: f.pin,
      eventKey: 'event-b',
      deliveryKeys: [{ messageId, retryGeneration: 0 }],
    });
    expect(exhausted).toMatchObject({ slot: null, owned: [] });
    expect(
      await deliveryClaimStatus({ root: f.root, pin: f.pin }),
    ).toMatchObject({ spentSlots: 1, remainingSlots: 0 });
  });

  test('uses deterministic request-batch identities and explicit retry generations', async () => {
    const f = await fixture();
    const ids = [crypto.randomUUID(), crypto.randomUUID()];
    const forward = watchBatchEventKey({
      activationId: f.activation.id,
      bindingGeneration: 0,
      deliveryKeys: ids.map((messageId) => ({ messageId, retryGeneration: 0 })),
    });
    const reverse = watchBatchEventKey({
      activationId: f.activation.id,
      bindingGeneration: 0,
      deliveryKeys: ids
        .toReversed()
        .map((messageId) => ({ messageId, retryGeneration: 0 })),
    });
    const retry = watchBatchEventKey({
      activationId: f.activation.id,
      bindingGeneration: 0,
      deliveryKeys: [
        { messageId: ids[0]!, retryGeneration: 1 },
        { messageId: ids[1]!, retryGeneration: 0 },
      ],
    });
    expect(forward).toBe(reverse);
    expect(retry).not.toBe(forward);
  });

  test('creates one idempotent retry after a pre-slot interruption', async () => {
    const f = await fixture();
    const messageId = crypto.randomUUID();
    await expect(
      claimDelivery({
        root: f.root,
        pin: f.pin,
        eventKey: 'interrupted',
        deliveryKeys: [{ messageId, retryGeneration: 0 }],
        token: 'attempt-interrupted',
        hooks: {
          afterEventClaim: () => {
            throw new Error('fault');
          },
        },
      }),
    ).rejects.toThrow('fault');
    const retry = await createDeliveryRetry({
      root: f.root,
      pin: f.pin,
      priorAttemptId: 'attempt-interrupted',
      messageId,
    });
    expect(retry.retryGeneration).toBe(1);
    expect(
      (
        await createDeliveryRetry({
          root: f.root,
          pin: f.pin,
          priorAttemptId: 'attempt-interrupted',
          messageId,
        })
      ).contentHash,
    ).toBe(retry.contentHash);
    expect(
      (await deliveryClaimStatus({ root: f.root, pin: f.pin }))
        .interruptedAttempts,
    ).toContain('attempt-interrupted');
  });

  test('final validation refuses emission after revocation and keeps the spent slot', async () => {
    const f = await fixture();
    const result = await claimDelivery({
      root: f.root,
      pin: f.pin,
      eventKey: 'revoke-race',
      deliveryKeys: [{ messageId: crypto.randomUUID(), retryGeneration: 0 }],
      hooks: {
        beforeFinalValidation: async () => {
          await disableActivation({ root: f.root, pin: f.pin });
        },
      },
    });
    expect(result.activeAfterClaim).toBe(false);
    expect(
      (await deliveryClaimStatus({ root: f.root, pin: f.pin })).spentSlots,
    ).toBe(1);
  });

  test.each([
    'afterEventClaim',
    'afterSlotClaim',
    'afterMessageClaim',
  ] as const)(
    'survives an actual process kill at %s with bounded inspectable state',
    async (stage) => {
      const f = await fixture(4);
      const helper = fileURLToPath(
        new URL('./process-fixture.ts', import.meta.url),
      );
      const child = spawn(
        process.execPath,
        [
          '--import',
          'tsx',
          helper,
          'claim',
          JSON.stringify({
            root: f.root,
            pin: f.pin,
            eventKey: `process-${stage}`,
            deliveryKeys: [
              { messageId: crypto.randomUUID(), retryGeneration: 0 },
            ],
            token: `attempt-${stage}`,
            stage,
          }),
        ],
        { stdio: ['pipe', 'pipe', 'pipe'] },
      );
      await once(child.stdout!, 'data');
      child.kill('SIGKILL');
      const [, signal] = await once(child, 'exit');
      expect(signal).toBe('SIGKILL');
      const status = await deliveryClaimStatus({ root: f.root, pin: f.pin });
      expect(status.spentSlots).toBe(stage === 'afterEventClaim' ? 0 : 1);
      expect([
        ...status.interruptedAttempts,
        ...status.outcomeUnknown,
      ]).toContain(`attempt-${stage}`);
    },
    30_000,
  );
});
