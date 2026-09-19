import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  activationStatus,
  disableActivation,
  enableActivation,
} from '../../../shared/collaboration/activation.js';
import {
  createDeliveryRetry,
  deliveryClaimStatus,
} from '../../../shared/collaboration/claims.js';
import {
  joinCollaboration,
  openCollaboration,
} from '../../../shared/collaboration/membership.js';
import { sendMessage } from '../../../shared/collaboration/messages.js';
import { codexStopCommand } from '../../session-observer-collab/src/codex-lifecycle.mjs';
import { arm } from '../../session-observer-collab/src/collab-control.mjs';
import { installCodexStopBundle } from '../../session-observer-collab/src/lib/codex-install.mjs';
import {
  MAX_WATCH_DURATION_MS,
  watchInbox,
  type WatchNotification,
} from './watch.js';

async function fixture(
  input: {
    runtime?: 'codex' | 'claude-code';
    maxContinuations?: number;
    fixedDurationMs?: number;
  } = {},
) {
  const root = await mkdtemp(path.join(tmpdir(), 'messaging-watch-'));
  const collaborationId = crypto.randomUUID();
  const driver = { runtime: 'cursor' as const, sessionId: 'driver' };
  const recipient = {
    runtime: input.runtime ?? ('codex' as const),
    sessionId: 'recipient',
  };
  const now = new Date();
  await openCollaboration({
    root,
    collaborationId,
    pin: driver,
    alias: 'driver',
    label: 'watch',
    task: 'notify',
    worktree: '/tmp/driver',
    now: now.toISOString(),
  });
  await joinCollaboration({
    root,
    collaborationId,
    pin: recipient,
    alias: 'recipient',
    worktree: '/tmp/recipient',
    now: now.toISOString(),
  });
  const activation = await enableActivation({
    root,
    collaborationId,
    pin: recipient,
    worktree: '/tmp/recipient',
    mechanism: 'monitor',
    fixedDurationMs: input.fixedDurationMs ?? 60_000,
    maxDurationMs: input.fixedDurationMs ?? 60_000,
    maxContinuations: input.maxContinuations,
    noObserverMonitorConfirmed: recipient.runtime === 'claude-code',
    now,
  });
  const env = {
    SESSION_OBSERVER_STATE_DIR: root,
    HOME: root,
    AGENT_MESSAGING_CLAUDE_SETTINGS: '',
  };
  return { root, collaborationId, driver, recipient, activation, env, now };
}

async function send(
  f: Awaited<ReturnType<typeof fixture>>,
  kind: 'request' | 'update',
  subject: string,
) {
  const id = crypto.randomUUID();
  await sendMessage({
    root: f.root,
    collaborationId: f.collaborationId,
    senderPin: f.driver,
    recipientAlias: 'recipient',
    id,
    kind,
    subject,
    body: `secret body for ${subject}`,
  });
  return id;
}

function runner(f: Awaited<ReturnType<typeof fixture>>) {
  let milliseconds = f.now.getTime();
  const notifications: WatchNotification[] = [];
  return {
    notifications,
    dependencies: {
      now: () => new Date(milliseconds),
      sleep: async (amount: number) => {
        milliseconds += amount;
      },
      emit: (notification: WatchNotification) => {
        notifications.push(notification);
      },
    },
  };
}

async function addObserverOwner(root: string, hooksPath: string, now: number) {
  const peerTranscript = path.join(root, 'observer-peer.jsonl');
  await writeFile(peerTranscript, '{}\n');
  await arm(
    root,
    {
      runtime: 'codex',
      peerRuntime: 'claude-code',
      session: 'recipient',
      peerSession: 'observer-peer',
      cwd: '/tmp/recipient',
      peerTranscript,
      leaseMs: 60_000,
      continuationCap: 3,
      loopCap: 3,
    },
    now,
  );
  const launcher = path.join(root, 'observer-stop.mjs');
  await installCodexStopBundle({
    scriptPath: launcher,
    sourceScriptPath: path.resolve(
      'skills/session-observer-collab/scripts/hooks/codex-stop.mjs',
    ),
  });
  await writeFile(
    hooksPath,
    JSON.stringify({
      hooks: { Stop: [{ hooks: [{ command: codexStopCommand(launcher) }] }] },
    }),
  );
  const leasePath = path.join(root, 'leases', 'recipient.json');
  return { leasePath, leaseBytes: await readFile(leasePath) };
}

describe('finite inbox watch', () => {
  test('ignores updates and deduplicates unchanged, overlapping, and reordered request batches', async () => {
    const f = await fixture();
    await send(f, 'update', 'status only');
    const firstRequest = await send(f, 'request', 'first');
    const first = runner(f);
    await watchInbox(
      {
        root: f.root,
        collaborationId: f.collaborationId,
        pin: f.recipient,
        worktree: '/tmp/recipient',
        durationMs: 3,
        pollMs: 1,
        env: f.env,
      },
      first.dependencies,
    );
    expect(first.notifications).toHaveLength(1);
    expect(first.notifications[0]?.requests.map(({ id }) => id)).toEqual([
      firstRequest,
    ]);
    expect(JSON.stringify(first.notifications)).not.toContain('secret body');

    const unchanged = runner(f);
    await watchInbox(
      {
        root: f.root,
        collaborationId: f.collaborationId,
        pin: f.recipient,
        worktree: '/tmp/recipient',
        durationMs: 2,
        pollMs: 1,
        env: f.env,
      },
      unchanged.dependencies,
    );
    expect(unchanged.notifications).toHaveLength(0);

    const secondRequest = await send(f, 'request', 'second');
    const overlapping = runner(f);
    await watchInbox(
      {
        root: f.root,
        collaborationId: f.collaborationId,
        pin: f.recipient,
        worktree: '/tmp/recipient',
        durationMs: 2,
        pollMs: 1,
        env: f.env,
      },
      overlapping.dependencies,
    );
    expect(overlapping.notifications[0]?.requests.map(({ id }) => id)).toEqual([
      secondRequest,
    ]);
  });

  test('leaves a pre-slot crash inspectable and accepts an explicit retry generation', async () => {
    const f = await fixture();
    const messageId = await send(f, 'request', 'retry');
    const crashed = runner(f);
    await expect(
      watchInbox(
        {
          root: f.root,
          collaborationId: f.collaborationId,
          pin: f.recipient,
          worktree: '/tmp/recipient',
          durationMs: 2,
          pollMs: 1,
          env: f.env,
        },
        {
          ...crashed.dependencies,
          afterEventClaim: () => {
            throw new Error('fault-after-event');
          },
        },
      ),
    ).rejects.toThrow('fault-after-event');
    const status = await deliveryClaimStatus({
      root: f.root,
      pin: f.recipient,
    });
    expect(status.interruptedAttempts).toHaveLength(1);
    await createDeliveryRetry({
      root: f.root,
      pin: f.recipient,
      priorAttemptId: status.interruptedAttempts[0]!,
      messageId,
      now: f.now,
    });
    const retry = runner(f);
    await watchInbox(
      {
        root: f.root,
        collaborationId: f.collaborationId,
        pin: f.recipient,
        worktree: '/tmp/recipient',
        durationMs: 2,
        pollMs: 1,
        env: f.env,
      },
      retry.dependencies,
    );
    expect(retry.notifications[0]?.requests[0]?.id).toBe(messageId);
  });

  test('caps duration, stops at activation expiry, and honors interruption without rearming', async () => {
    const f = await fixture({ fixedDurationMs: 10 });
    await expect(
      watchInbox(
        {
          root: f.root,
          collaborationId: f.collaborationId,
          pin: f.recipient,
          worktree: '/tmp/recipient',
          durationMs: MAX_WATCH_DURATION_MS + 1,
          env: f.env,
        },
        { emit: () => undefined },
      ),
    ).rejects.toThrow('30 minutes');
    const expiry = runner(f);
    const result = await watchInbox(
      {
        root: f.root,
        collaborationId: f.collaborationId,
        pin: f.recipient,
        worktree: '/tmp/recipient',
        durationMs: 100,
        pollMs: 4,
        env: f.env,
      },
      expiry.dependencies,
    );
    expect(result.iterations).toBe(3);
    const controller = new AbortController();
    controller.abort();
    expect(
      await watchInbox(
        {
          root: f.root,
          collaborationId: f.collaborationId,
          pin: f.recipient,
          worktree: '/tmp/recipient',
          durationMs: 1,
          pollMs: 1,
          env: f.env,
        },
        { emit: () => undefined, signal: controller.signal },
      ),
    ).toMatchObject({ reason: 'interrupted', iterations: 0 });
  });

  test('re-arm keeps the same allowance and refuses exhausted or revoked activation', async () => {
    const f = await fixture({ maxContinuations: 1 });
    await send(f, 'request', 'only slot');
    const first = runner(f);
    await watchInbox(
      {
        root: f.root,
        collaborationId: f.collaborationId,
        pin: f.recipient,
        worktree: '/tmp/recipient',
        durationMs: 2,
        pollMs: 1,
        env: f.env,
      },
      first.dependencies,
    );
    const rearm = runner(f);
    expect(
      await watchInbox(
        {
          root: f.root,
          collaborationId: f.collaborationId,
          pin: f.recipient,
          worktree: '/tmp/recipient',
          durationMs: 2,
          pollMs: 1,
          env: f.env,
        },
        rearm.dependencies,
      ),
    ).toMatchObject({ reason: 'budget-exhausted' });
    await disableActivation({ root: f.root, pin: f.recipient, now: f.now });
    expect(
      await watchInbox(
        {
          root: f.root,
          collaborationId: f.collaborationId,
          pin: f.recipient,
          worktree: '/tmp/recipient',
          durationMs: 2,
          pollMs: 1,
          env: f.env,
        },
        runner(f).dependencies,
      ),
    ).toMatchObject({ reason: 'activation-inactive' });
  });

  test('requires fresh Claude Monitor confirmation for every watch start', async () => {
    const f = await fixture({ runtime: 'claude-code' });
    await send(f, 'request', 'claude');
    expect(
      await watchInbox(
        {
          root: f.root,
          collaborationId: f.collaborationId,
          pin: f.recipient,
          worktree: '/tmp/recipient',
          durationMs: 2,
          pollMs: 1,
          env: f.env,
        },
        runner(f).dependencies,
      ),
    ).toMatchObject({ reason: 'ownership-refused', notifications: 0 });
    const confirmed = runner(f);
    await watchInbox(
      {
        root: f.root,
        collaborationId: f.collaborationId,
        pin: f.recipient,
        worktree: '/tmp/recipient',
        durationMs: 2,
        pollMs: 1,
        confirmNoObserverMonitor: true,
        env: f.env,
      },
      confirmed.dependencies,
    );
    expect(confirmed.notifications).toHaveLength(1);
  });

  test('refuses an active observer owner without mutating its lease', async () => {
    const f = await fixture();
    await send(f, 'request', 'owner conflict');
    const leasePath = path.join(f.root, 'leases', 'recipient.json');
    await mkdir(path.dirname(leasePath), { recursive: true });
    const lease = `${JSON.stringify({
      schemaVersion: 6,
      runtime: 'codex',
      ownerSession: 'recipient',
      ownerCwd: '/tmp/recipient',
      state: 'armed',
      continuationCount: 0,
      continuationCap: 5,
      loopCount: 0,
      loopCap: 10,
      leaseMs: 60_000,
      armedAt: f.now.toISOString(),
      expiresAt: new Date(f.now.getTime() + 60_000).toISOString(),
    })}\n`;
    await writeFile(leasePath, lease);
    expect(
      await watchInbox(
        {
          root: f.root,
          collaborationId: f.collaborationId,
          pin: f.recipient,
          worktree: '/tmp/recipient',
          durationMs: 2,
          pollMs: 1,
          env: f.env,
        },
        runner(f).dependencies,
      ),
    ).toMatchObject({ reason: 'ownership-refused', notifications: 0 });
    expect(await readFile(leasePath, 'utf8')).toBe(lease);
  });

  test('keeps an in-flight standalone watch silent when a composed observer owner appears', async () => {
    const f = await fixture();
    await send(f, 'request', 'controller race');
    const hooksPath = path.join(f.root, 'hooks.json');
    await writeFile(hooksPath, '{}\n');
    const active = runner(f);
    let observer: Awaited<ReturnType<typeof addObserverOwner>> | undefined;
    const result = await watchInbox(
      {
        root: f.root,
        collaborationId: f.collaborationId,
        pin: f.recipient,
        worktree: '/tmp/recipient',
        durationMs: 2,
        pollMs: 1,
        env: { ...f.env, AGENT_MESSAGING_HOOKS_PATH: hooksPath },
      },
      {
        ...active.dependencies,
        afterEventClaim: async () => {
          observer = await addObserverOwner(f.root, hooksPath, f.now.getTime());
        },
      },
    );
    expect(result).toMatchObject({
      reason: 'ownership-refused',
      notifications: 0,
      claimedRequests: 0,
    });
    expect(active.notifications).toEqual([]);
    expect(observer).toBeDefined();
    expect(await readFile(observer!.leasePath)).toEqual(observer!.leaseBytes);
    expect(
      await deliveryClaimStatus({ root: f.root, pin: f.recipient }),
    ).toMatchObject({
      spentSlots: 1,
      remainingSlots: 19,
      interruptedAttempts: [],
      outcomeUnknown: [expect.any(String)],
    });
    expect(await activationStatus(f.root, f.recipient)).toMatchObject({
      active: true,
      activation: {
        id: f.activation.id,
        controller: 'standalone-messaging',
      },
    });
  });

  test('contains no daemon or child-process launch path', async () => {
    const source = await readFile(
      path.resolve('src/skills/agent-messaging/src/watch.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/node:child_process|\bspawn\(|\bfork\(/u);
  });
});
