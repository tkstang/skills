import crypto from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { enableActivation } from '../../../shared/collaboration/activation.js';
import { deliveryClaimStatus } from '../../../shared/collaboration/claims.js';
import { latestDeliveryDiagnostic } from '../../../shared/collaboration/diagnostics.js';
import {
  joinCollaboration,
  openCollaboration,
} from '../../../shared/collaboration/membership.js';
import { sendMessage } from '../../../shared/collaboration/messages.js';
import {
  DEFAULT_MONITOR_POLL_MS,
  runClaudeMonitor,
  runClaudeMonitorMain,
} from './claude-monitor.mjs';
import { arm } from './collab-control.mjs';
import { readLease } from './lib/lease-state.mjs';

const roots: string[] = [];
const START = Date.parse('2026-09-19T20:00:00.000Z');

async function fixture(maxContinuations = 2) {
  const root = await mkdtemp(path.join(tmpdir(), 'claude-monitor-'));
  roots.push(root);
  const cwd = path.join(root, 'worktree');
  const transcript = path.join(root, 'peer.jsonl');
  const claudeSettings = path.join(root, 'claude-settings.json');
  await mkdir(cwd);
  await writeFile(transcript, '{}\n{}\n{}\n');
  await writeFile(claudeSettings, '{}\n');
  const collaborationId = crypto.randomUUID();
  const activationId = crypto.randomUUID();
  const self = { runtime: 'claude-code' as const, sessionId: 'claude-owner' };
  const peer = { runtime: 'codex' as const, sessionId: 'codex-peer' };
  const sender = { runtime: 'cursor' as const, sessionId: 'sender' };
  await openCollaboration({
    root,
    collaborationId,
    pin: self,
    alias: 'owner',
    label: 'composed monitor',
    task: 'bounded composition',
    worktree: cwd,
  });
  await joinCollaboration({
    root,
    collaborationId,
    pin: sender,
    alias: 'sender',
    worktree: cwd,
  });
  await arm(
    root,
    {
      runtime: 'claude-code',
      peerRuntime: peer.runtime,
      session: self.sessionId,
      peerSession: peer.sessionId,
      cwd,
      peerTranscript: transcript,
      cursor: 0,
      leaseMs: 60_000,
      continuationCap: 10,
      loopCap: 10,
      collaborationId,
      activationId,
      confirmOldMonitorStopped: true,
      confirmStandaloneWatcherStopped: true,
    },
    START,
  );
  const observerLease = await readLease(root, self.sessionId);
  const activation = await enableActivation({
    root,
    collaborationId,
    pin: self,
    worktree: cwd,
    activationId,
    mechanism: 'monitor',
    controller: 'observer-collab',
    fixedDurationMs: 60_000,
    maxDurationMs: 60_000,
    maxContinuations,
    now: new Date(START),
    composedMonitorAttestation: {
      owner: self,
      peer,
      observerLeaseId: observerLease!.leaseId,
      activationId,
      collaborationId,
      epoch: 0,
      confirmedAt: new Date(START).toISOString(),
      oldMonitorStopped: true,
      standaloneWatcherStopped: true,
    },
    claudeInventorySources: {
      settingsPaths: [claudeSettings],
      installedPlugins: {},
    },
  });
  return {
    root,
    cwd,
    transcript,
    collaborationId,
    activationId,
    self,
    peer,
    sender,
    activation,
  };
}

function input(item: Awaited<ReturnType<typeof fixture>>) {
  return {
    root: item.root,
    collaborationId: item.collaborationId,
    activationId: item.activationId,
    self: item.self,
    peer: item.peer,
    cwd: item.cwd,
    peerTranscript: item.transcript,
    maxRuntimeMs: 1000,
    pollMs: 1,
    confirmOldMonitorStopped: true,
    confirmStandaloneWatcherStopped: true,
  };
}

function substantive(fromIndex = 0) {
  return {
    schemaVersion: 1,
    range: {
      indexBase: 'zero-based-jsonl-record-index',
      fromIndex,
      toIndex: 2,
      nextIndex: 3,
      totalRecords: 3,
      newRecords: 3 - fromIndex,
    },
    accounting: {
      indexBase: 'zero-based-jsonl-record-index',
      raw: {
        fromIndex,
        toIndex: 2,
        count: 3 - fromIndex,
        nextIndex: 3,
        totalRecords: 3,
      },
      rendered: { count: 2 },
      filtered: { tailSliceEntries: 0 },
    },
    entries: [
      {
        role: 'user',
        text: 'Review this.',
        kind: 'message',
        recordIndex: fromIndex,
      },
      { role: 'assistant', text: 'Complete.', kind: 'message', recordIndex: 2 },
    ],
  };
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('finite Claude composed Monitor', () => {
  test('uses the 1000ms default poll and rejects a relative root', async () => {
    expect(DEFAULT_MONITOR_POLL_MS).toBe(1000);
    await expect(
      runClaudeMonitorMain([
        '--root',
        'relative-state',
        '--collaboration-id',
        crypto.randomUUID(),
        '--activation-id',
        crypto.randomUUID(),
        '--self',
        'claude-code:self',
        '--peer',
        'codex:peer',
        '--cwd',
        '/tmp/worktree',
        '--peer-transcript',
        '/tmp/peer.jsonl',
        '--max-runtime-ms',
        '1000',
      ]),
    ).rejects.toThrow('root must be an absolute path');
  });

  test('requires explicit cursor and stop confirmations and preserves cursor/budget on exact re-arm', async () => {
    const item = await fixture();
    expect(
      (
        await runClaudeMonitor({
          ...input(item),
          pollMs: 17,
          confirmOldMonitorStopped: false,
        })
      ).reason,
    ).toBe('stop-confirmation-required');
    await expect(
      arm(item.root, {
        runtime: 'claude-code',
        peerRuntime: item.peer.runtime,
        session: 'other',
        peerSession: item.peer.sessionId,
        cwd: item.cwd,
        peerTranscript: item.transcript,
        collaborationId: item.collaborationId,
        activationId: item.activationId,
      }),
    ).rejects.toThrow(/confirmation|cursor/iu);
    const before = await readLease(item.root, item.self.sessionId);
    const rearmed = await arm(
      item.root,
      {
        runtime: 'claude-code',
        peerRuntime: item.peer.runtime,
        session: item.self.sessionId,
        peerSession: item.peer.sessionId,
        cwd: item.cwd,
        peerTranscript: item.transcript,
        collaborationId: item.collaborationId,
        activationId: item.activationId,
        confirmOldMonitorStopped: true,
        confirmStandaloneWatcherStopped: true,
      },
      START + 1,
    );
    expect(rearmed.lease).toMatchObject({
      peerCursor: before?.peerCursor,
      continuationCount: before?.continuationCount,
      expiresAt: before?.expiresAt,
    });
  });

  test('selects inbox first and never reads or advances the observer cursor', async () => {
    const item = await fixture();
    const sent = await sendMessage({
      root: item.root,
      collaborationId: item.collaborationId,
      senderPin: item.sender,
      recipientAlias: 'owner',
      id: crypto.randomUUID(),
      kind: 'request',
      subject: 'please inspect',
      body: 'bounded request',
      now: new Date(START + 1).toISOString(),
    });
    let observed = false;
    const result = await runClaudeMonitor(input(item), {
      now: () => START + 2,
      observe: async () => {
        observed = true;
        return substantive();
      },
      emit: async () => undefined,
    });
    expect(result.reason).toBe('message-notified');
    expect(result.notification).toMatchObject({
      messageIds: [sent.message.id],
    });
    expect(observed).toBe(false);
    expect((await readLease(item.root, item.self.sessionId))?.peerCursor).toBe(
      0,
    );
    expect(
      (await latestDeliveryDiagnostic({ root: item.root, pin: item.self }))
        .latest,
    ).toMatchObject({
      boundary: 'monitor',
      attemptKind: 'message',
      stage: 'output-attempted',
    });
  });

  test('main reports a redacted refusal reason and nonzero outcome', async () => {
    const item = await fixture();
    const stderr: string[] = [];
    const result = await runClaudeMonitorMain(
      [
        '--root',
        item.root,
        '--collaboration-id',
        item.collaborationId,
        '--activation-id',
        item.activationId,
        '--self',
        `${item.self.runtime}:${item.self.sessionId}`,
        '--peer',
        `${item.peer.runtime}:${item.peer.sessionId}`,
        '--cwd',
        item.cwd,
        '--peer-transcript',
        item.transcript,
        '--max-runtime-ms',
        '10',
      ],
      {},
      { stderr: (value: string) => stderr.push(value) },
    );
    expect(result).toMatchObject({
      reason: 'stop-confirmation-required',
      exitCode: 1,
    });
    expect(stderr).toEqual(['claude-monitor: stop-confirmation-required\n']);
  });

  test('claims a shared observation slot before private CAS and emits only exact range identity', async () => {
    const item = await fixture();
    const order: string[] = [];
    const result = await runClaudeMonitor(input(item), {
      now: () => START + 2,
      observe: async () => substantive(),
      observationClaimHooks: {
        afterEventClaim: () => order.push('event'),
        afterSlotClaim: () => order.push('slot'),
      },
      afterSharedSlot: () => order.push('before-cas'),
      afterCursorClaim: () => order.push('after-cas'),
      emit: async () => order.push('emit'),
    });
    expect(result.reason).toBe('observation-notified');
    expect(order).toEqual(['event', 'slot', 'before-cas', 'after-cas', 'emit']);
    expect(result.notification).toMatchObject({
      type: 'session-observer-range-notification',
      peer: 'codex:codex-peer',
      range: { fromIndex: 0, toIndex: 2 },
    });
    expect(JSON.stringify(result.notification)).not.toContain('Review this');
    expect(
      (await deliveryClaimStatus({ root: item.root, pin: item.self }))
        .observationAttempts,
    ).toMatchObject([
      { status: 'outcome-unknown', observation: { fromIndex: 0, toIndex: 2 } },
    ]);
  });

  test('requires explicit re-arm before restarting from a triggered lease', async () => {
    const item = await fixture();
    expect(
      (
        await runClaudeMonitor(input(item), {
          now: () => START + 2,
          observe: async () => substantive(),
          emit: async () => undefined,
        })
      ).reason,
    ).toBe('observation-notified');
    const restarted = await runClaudeMonitor(input(item), {
      now: () => START + 3,
      observe: async () => substantive(),
    });
    expect(restarted.reason).toBe('rearm-required');
    expect(
      (await deliveryClaimStatus({ root: item.root, pin: item.self }))
        .spentSlots,
    ).toBe(1);
  });

  test('does not let the expected triggered state hide a final identity failure', async () => {
    const item = await fixture();
    const leasePath = path.join(
      item.root,
      'leases',
      `${item.self.sessionId}.json`,
    );
    const result = await runClaudeMonitor(input(item), {
      now: () => START + 2,
      observe: async () => substantive(),
      afterCursorClaim: async () => {
        const lease = JSON.parse(await readFile(leasePath, 'utf8'));
        await writeFile(
          leasePath,
          `${JSON.stringify({
            ...lease,
            ownerCwd: '/tmp/changed-worktree',
            composedActivation: {
              ...lease.composedActivation,
              ownerCwd: '/tmp/changed-worktree',
            },
          })}\n`,
        );
      },
      emit: async () => {
        throw new Error('must not emit');
      },
    });
    expect(result.reason).toBe('lease-cwd-mismatch');
  });

  test('a CAS loser wastes the shared slot and emits nothing', async () => {
    const item = await fixture();
    const result = await runClaudeMonitor(input(item), {
      now: () => START + 2,
      observe: async () => substantive(),
      afterSharedSlot: async () => {
        await arm(
          item.root,
          {
            runtime: 'claude-code',
            peerRuntime: item.peer.runtime,
            session: item.self.sessionId,
            peerSession: item.peer.sessionId,
            cwd: item.cwd,
            peerTranscript: item.transcript,
            collaborationId: item.collaborationId,
            activationId: item.activationId,
            confirmOldMonitorStopped: true,
            confirmStandaloneWatcherStopped: true,
          },
          START + 2,
        );
      },
      emit: async () => {
        throw new Error('must not emit');
      },
    });
    expect(result.reason).toBe('stale');
    expect(
      (await deliveryClaimStatus({ root: item.root, pin: item.self }))
        .spentSlots,
    ).toBe(1);
  });

  test('same selected range is deduplicated across an explicit exact re-arm', async () => {
    const item = await fixture();
    const first = await runClaudeMonitor(input(item), {
      now: () => START + 2,
      observe: async () => substantive(),
      afterSharedSlot: async () => {
        await arm(
          item.root,
          {
            runtime: 'claude-code',
            peerRuntime: item.peer.runtime,
            session: item.self.sessionId,
            peerSession: item.peer.sessionId,
            cwd: item.cwd,
            peerTranscript: item.transcript,
            collaborationId: item.collaborationId,
            activationId: item.activationId,
            confirmOldMonitorStopped: true,
            confirmStandaloneWatcherStopped: true,
          },
          START + 2,
        );
      },
    });
    expect(first.reason).toBe('stale');
    await arm(
      item.root,
      {
        runtime: 'claude-code',
        peerRuntime: item.peer.runtime,
        session: item.self.sessionId,
        peerSession: item.peer.sessionId,
        cwd: item.cwd,
        peerTranscript: item.transcript,
        collaborationId: item.collaborationId,
        activationId: item.activationId,
        confirmOldMonitorStopped: true,
        confirmStandaloneWatcherStopped: true,
      },
      START + 3,
    );
    const second = await runClaudeMonitor(input(item), {
      now: () => START + 4,
      observe: async () => substantive(),
    });
    expect(second.reason).toBe('duplicate-observation');
    expect(
      (await deliveryClaimStatus({ root: item.root, pin: item.self }))
        .spentSlots,
    ).toBe(1);
  });

  test('prints no notification for missing fresh stop confirmation', async () => {
    const item = await fixture();
    const result = await runClaudeMonitor(
      { ...input(item), confirmOldMonitorStopped: false },
      {
        emit: async () => {
          throw new Error('must not emit');
        },
      },
    );
    expect(result).toMatchObject({
      reason: 'stop-confirmation-required',
      notification: null,
    });
  });
});
