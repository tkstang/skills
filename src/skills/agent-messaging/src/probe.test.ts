import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  enableActivation,
  MAX_ACTIVITY_RECEIPTS,
} from '../../../shared/collaboration/activation.js';
import {
  joinCollaboration,
  openCollaboration,
} from '../../../shared/collaboration/membership.js';
import { activationDirectory } from '../../../shared/collaboration/paths.js';
import { canonicalRecordHash } from '../../../shared/collaboration/records.js';
import type {
  ActivityReceiptRecord,
  Pin,
} from '../../../shared/collaboration/types.js';
import {
  benchmarkActivityReceiptValidation,
  createHostProbePlan,
  runHostProbe,
  type HostProbePlan,
  type ProbeAdapter,
} from './probe.js';

const authorization = {
  exactSessionApproved: true,
  hookAndTrustChangesApproved: true,
  quotaBudgetApproved: true,
  timeoutApproved: true,
  cleanupApproved: true,
};
const ownershipCheck = async () => true;

function plan(
  overrides: Partial<Parameters<typeof createHostProbePlan>[0]> = {},
): HostProbePlan {
  return createHostProbePlan({
    optIn: true,
    id: 'probe-fixture',
    collaborationId: '11111111-1111-4111-8111-111111111111',
    host: 'codex',
    hostVersion: 'fixture-1.0',
    surface: 'fixture hook stdin/stdout',
    command: ['/fixture/codex', '--probe'],
    boundary: 'stop-continuation',
    session: { runtime: 'codex', sessionId: 'recipient' },
    worktree: '/tmp/recipient',
    eventProvenance: 'fixture native event ID',
    timeoutMs: 100,
    maxEvents: 1,
    maxAttempts: 1,
    liveAuthorization: authorization,
    ...overrides,
  });
}

describe('bounded host probes', () => {
  test('requires explicit opt-in and exact bounded command budgets', () => {
    expect(() => plan({ optIn: false })).toThrow('explicit opt-in');
    expect(() => plan({ timeoutMs: 60_001 })).toThrow('60000');
    expect(() => plan({ maxEvents: 5 })).toThrow('through 4');
    expect(() =>
      plan({
        host: 'cursor',
        session: { runtime: 'codex', sessionId: 'recipient' },
      }),
    ).toThrow('match the exact session runtime');
    expect(
      plan({
        host: 'cursor',
        session: { runtime: 'cursor', sessionId: 'recipient' },
      }),
    ).toMatchObject({ capability: 'manual-fallback' });
  });

  test('keeps unauthorized plans manual and performs no adapter work', async () => {
    let calls = 0;
    const adapter: ProbeAdapter = {
      setup: async () => {
        calls += 1;
      },
      invoke: async () => {
        calls += 1;
        throw new Error('must not run');
      },
      cleanup: async () => {
        calls += 1;
      },
      verifyCleanup: async () => true,
    };
    const unauthorized = plan({ liveAuthorization: null });
    expect(unauthorized).toMatchObject({
      authorizationComplete: false,
      execution: 'fixture-only',
      capability: 'manual-fallback',
    });
    expect(await runHostProbe(unauthorized, adapter)).toEqual({
      status: 'unverified',
      receipts: [],
      cleanupVerified: false,
    });
    expect(await runHostProbe(plan(), adapter)).toMatchObject({
      status: 'unverified',
      receipts: [],
    });
    expect(
      await runHostProbe(plan(), adapter, {
        ownershipCheck: async () => false,
      }),
    ).toMatchObject({ status: 'unverified', receipts: [] });
    expect(calls).toBe(0);
  });

  test('sanitizes receipts and cleans up only resources owned by the probe', async () => {
    const unrelated = ['registration-existing', 'process-existing'];
    const cleaned: unknown[] = [];
    const adapter: ProbeAdapter = {
      setup: async (_plan, context) => {
        context.ownRegistration('registration-probe');
        context.ownProcess('process-probe');
      },
      invoke: async () =>
        ({
          eventId: 'native-event-1',
          observedAt: '2026-09-19T12:00:00.000Z',
          invoked: true,
          recipientContextObserved: true,
          continuationObserved: true,
          humanOriginObserved: false,
          prompt: 'secret prompt',
          environment: { TOKEN: 'secret' },
        }) as Awaited<ReturnType<ProbeAdapter['invoke']>>,
      cleanup: async (resources) => {
        cleaned.push(resources);
      },
      verifyCleanup: async () => true,
    };
    const result = await runHostProbe(plan(), adapter, { ownershipCheck });
    expect(result).toMatchObject({
      status: 'completed',
      cleanupVerified: true,
      receipts: [{ outcome: 'observed', eventId: 'native-event-1' }],
    });
    expect(JSON.stringify(result)).not.toMatch(/secret prompt|TOKEN/u);
    expect(cleaned).toEqual([
      {
        registrations: ['registration-probe'],
        processes: ['process-probe'],
      },
    ]);
    expect(unrelated).toEqual(['registration-existing', 'process-existing']);
  });

  test('bounds timeout, interruption, and one correction retry with honest results', async () => {
    let invocations = 0;
    const retryAdapter: ProbeAdapter = {
      setup: async () => undefined,
      invoke: async () => {
        invocations += 1;
        return {
          eventId: `event-${invocations}`,
          observedAt: '2026-09-19T12:00:00.000Z',
          invoked: invocations === 2,
          recipientContextObserved: false,
          continuationObserved: false,
          humanOriginObserved: false,
          unsupported: invocations === 1,
        };
      },
      cleanup: async () => undefined,
      verifyCleanup: async () => true,
    };
    const retried = await runHostProbe(plan({ maxAttempts: 2 }), retryAdapter, {
      ownershipCheck,
    });
    expect(retried.receipts.map(({ outcome }) => outcome)).toEqual([
      'unsupported',
      'observed',
    ]);
    expect(invocations).toBe(2);

    const timeoutAdapter: ProbeAdapter = {
      setup: async () => undefined,
      invoke: () => new Promise(() => undefined),
      cleanup: async () => undefined,
      verifyCleanup: async () => true,
    };
    const timedOut = await runHostProbe(
      plan({ timeoutMs: 2 }),
      timeoutAdapter,
      { ownershipCheck },
    );
    expect(timedOut).toMatchObject({
      status: 'unknown',
      cleanupVerified: false,
      receipts: [{ outcome: 'unknown', errorCode: 'timeout' }],
    });

    const controller = new AbortController();
    controller.abort();
    const interrupted = await runHostProbe(plan(), retryAdapter, {
      signal: controller.signal,
      ownershipCheck,
    });
    expect(interrupted).toMatchObject({
      status: 'interrupted',
      cleanupVerified: true,
      receipts: [{ errorCode: 'interrupted' }],
    });
  });

  test('aborts timed-out setup before cleanup and rejects late resource ownership', async () => {
    const cleaned: unknown[] = [];
    let lateOwnershipRejected = false;
    const adapter: ProbeAdapter = {
      setup: async (_plan, context) => {
        context.ownRegistration('registration-before-block');
        await new Promise<void>((resolve) => {
          context.signal.addEventListener(
            'abort',
            () => {
              try {
                context.ownProcess('late-process');
              } catch {
                lateOwnershipRejected = true;
              }
              resolve();
            },
            { once: true },
          );
        });
      },
      invoke: async () => {
        throw new Error('must not invoke');
      },
      cleanup: async (resources) => {
        cleaned.push(resources);
      },
      verifyCleanup: async () => true,
    };
    const result = await runHostProbe(plan({ timeoutMs: 5 }), adapter, {
      ownershipCheck,
    });
    expect(result).toMatchObject({
      status: 'unknown',
      cleanupVerified: true,
      receipts: [{ eventId: 'setup', errorCode: 'timeout' }],
    });
    expect(lateOwnershipRejected).toBe(true);
    expect(cleaned).toEqual([
      {
        registrations: ['registration-before-block'],
        processes: [],
      },
    ]);
  });

  test('quiesces and cleans an interrupted in-flight invocation without late side effects', async () => {
    const controller = new AbortController();
    const cleaned: unknown[] = [];
    let lateOwnershipRejected = false;
    const adapter: ProbeAdapter = {
      setup: async (_plan, context) => {
        context.ownRegistration('registration-owned');
      },
      invoke: async ({ context }) => {
        context.ownProcess('process-owned');
        await new Promise<void>((resolve) => {
          context.signal.addEventListener(
            'abort',
            () => {
              try {
                context.ownRegistration('late-registration');
              } catch {
                lateOwnershipRejected = true;
              }
              resolve();
            },
            { once: true },
          );
        });
        return {
          eventId: 'should-not-emit',
          observedAt: '2026-09-19T12:00:00.000Z',
          invoked: true,
          recipientContextObserved: true,
          continuationObserved: true,
          humanOriginObserved: false,
        };
      },
      cleanup: async (resources) => {
        cleaned.push(resources);
      },
      verifyCleanup: async () => true,
    };
    setTimeout(() => controller.abort(), 5);
    const result = await runHostProbe(plan({ timeoutMs: 100 }), adapter, {
      signal: controller.signal,
      ownershipCheck,
    });
    expect(result).toMatchObject({
      status: 'interrupted',
      cleanupVerified: true,
      receipts: [{ errorCode: 'interrupted' }],
    });
    expect(lateOwnershipRejected).toBe(true);
    expect(cleaned).toEqual([
      {
        registrations: ['registration-owned'],
        processes: ['process-owned'],
      },
    ]);
  });

  test('validates exactly 4096 activity receipts and records cold/warm timing', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'receipt-benchmark-'));
    const collaborationId = crypto.randomUUID();
    const pin: Pin = { runtime: 'codex', sessionId: 'benchmark' };
    const started = new Date('2026-09-19T12:00:00.000Z');
    await openCollaboration({
      root,
      collaborationId,
      pin,
      alias: 'benchmark',
      label: 'receipt benchmark',
      task: 'validate exact semantics',
      worktree: '/tmp/benchmark',
      now: started.toISOString(),
    });
    const peer: Pin = { runtime: 'cursor', sessionId: 'peer' };
    await joinCollaboration({
      root,
      collaborationId,
      pin: peer,
      alias: 'peer',
      worktree: '/tmp/peer',
      now: started.toISOString(),
    });
    const activation = await enableActivation({
      root,
      collaborationId,
      pin,
      worktree: '/tmp/benchmark',
      expiryMode: 'human-idle',
      idleTimeoutMs: 2 * 60 * 60 * 1000,
      maxDurationMs: 24 * 60 * 60 * 1000,
      humanProvenanceEvidence: {
        hostVersion: 'fixture-1.0',
        surface: 'fixture-native-prompt',
        qualifiedAt: started.toISOString(),
      },
      now: started,
    });
    const directory = path.join(
      activationDirectory(root, pin),
      'activity',
      activation.id,
    );
    await mkdir(directory, { recursive: true });
    for (let offset = 0; offset < MAX_ACTIVITY_RECEIPTS; offset += 128) {
      await Promise.all(
        Array.from(
          { length: Math.min(128, MAX_ACTIVITY_RECEIPTS - offset) },
          async (_, index) => {
            const number = offset + index;
            const base = {
              schemaVersion: 1 as const,
              activationId: activation.id,
              eventKey: `human-${String(number).padStart(4, '0')}`,
              observedAt: new Date(started.getTime() + number).toISOString(),
            };
            const record: ActivityReceiptRecord = {
              ...base,
              contentHash: canonicalRecordHash(base),
            };
            await writeFile(
              path.join(directory, `${String(number).padStart(4, '0')}.json`),
              `${JSON.stringify(record)}\n`,
            );
          },
        ),
      );
    }
    const result = await benchmarkActivityReceiptValidation({
      root,
      pin,
      now: new Date(started.getTime() + MAX_ACTIVITY_RECEIPTS),
    });
    expect(result.receiptCount).toBe(4096);
    expect(result.coldMs).toBeGreaterThan(0);
    expect(result.warmMs).toBeGreaterThan(0);
    expect(result.machine.node).toBe(process.version);
  }, 30_000);
});
