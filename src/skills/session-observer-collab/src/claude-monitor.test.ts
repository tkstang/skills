import crypto from 'node:crypto';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import {
  disableActivation,
  enableActivation,
} from '../../../shared/collaboration/activation.js';
import { deliveryClaimStatus } from '../../../shared/collaboration/claims.js';
import { latestDeliveryDiagnostic } from '../../../shared/collaboration/diagnostics.js';
import {
  closeCollaboration,
  joinCollaboration,
  openCollaboration,
  takeOverMembership,
} from '../../../shared/collaboration/membership.js';
import {
  acknowledgeMessage,
  sendMessage,
} from '../../../shared/collaboration/messages.js';
import {
  DEFAULT_MONITOR_POLL_MS,
  runClaudeMonitor,
  runClaudeMonitorMain,
} from './claude-monitor.mjs';
import { arm } from './collab-control.mjs';
import { readLease } from './lib/lease-state.mjs';

const roots: string[] = [];
const START = Date.parse('2026-09-19T20:00:00.000Z');

async function fixture(
  maxContinuations = 2,
  peerRuntime: 'claude-code' | 'codex' | 'cursor' = 'codex',
) {
  const root = await mkdtemp(path.join(tmpdir(), 'claude-monitor-'));
  roots.push(root);
  const cwd = path.join(root, 'worktree');
  const transcript =
    peerRuntime === 'cursor'
      ? path.join(
          root,
          '.cursor',
          'projects',
          'project',
          'agent-transcripts',
          'cursor-peer',
          'cursor-peer.jsonl',
        )
      : path.join(root, 'peer.jsonl');
  const claudeSettings = path.join(root, 'claude-settings.json');
  await mkdir(cwd);
  await mkdir(path.dirname(transcript), { recursive: true });
  await writeFile(transcript, '{}\n{}\n{}\n');
  await writeFile(claudeSettings, '{}\n');
  const collaborationId = crypto.randomUUID();
  const activationId = crypto.randomUUID();
  const self = { runtime: 'claude-code' as const, sessionId: 'claude-owner' };
  const peer = { runtime: peerRuntime, sessionId: `${peerRuntime}-peer` };
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

async function cursorSubstantive(item: Awaited<ReturnType<typeof fixture>>) {
  const bytes = await readFile(item.transcript);
  const metadata = await stat(item.transcript);
  return {
    schemaVersion: 2,
    runtime: 'cursor',
    sessionId: item.peer.sessionId,
    transcriptPath: item.transcript,
    range: {
      indexBase: 'zero-based-jsonl-frame-index',
      fromIndex: 0,
      toIndex: 2,
      nextIndex: 3,
      totalFrames: 3,
      renderedFromIndex: 2,
      renderedToIndex: 2,
      newFrames: 3,
    },
    accounting: {
      indexBase: 'zero-based-jsonl-frame-index',
      raw: { fromIndex: 0, toIndex: 2, count: 3, nextIndex: 3, totalFrames: 3 },
      rendered: { count: 1, fromIndex: 2, toIndex: 2 },
      filtered: {
        toolCalls: 0,
        automaticControls: 0,
        emptyOrNoOp: 0,
        metadataFrames: 2,
        unstableContent: 0,
      },
      buffered: { fromIndex: null, count: 0, reason: null },
      recovery: { omittedUserMessages: [], omittedAssistantEntries: [] },
    },
    entries: [
      {
        role: 'assistant',
        text: 'Cursor completion.',
        recordIndex: 2,
        sourceFrameIndex: 1,
        kind: 'message',
        entryKey: 'entry-assistant-1',
        turnId: 'turn-1',
        availability: 'completed',
      },
    ],
    cursorEvidence: {
      projection: 'confirmed-completion',
      continuity: 'verified',
      status: {
        engagement: 'engaged',
        activity: 'assistant-progress',
        content: 'available',
        lifecycle: 'success',
        delivery: 'none',
        health: 'healthy',
      },
      lifecycleEvents: [
        {
          turnId: 'turn-1',
          terminalFrameIndex: 2,
          lifecycle: 'success',
          finalEntryKey: 'entry-assistant-1',
          contentPreviouslyObservable: false,
        },
      ],
      bufferedFromFrame: null,
      blockingFrame: null,
      selectedPrefix: {
        indexBase: 'zero-based-jsonl-frame-index',
        nextFrameIndex: 3,
        prefixBytes: bytes.length,
        prefixSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
        observedSize: bytes.length,
        device: Number(metadata.dev),
        inode: Number(metadata.ino),
      },
    },
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

  test('shares the finite cap across message and observation wake kinds', async () => {
    const item = await fixture(1);
    const sent = await sendMessage({
      root: item.root,
      collaborationId: item.collaborationId,
      senderPin: item.sender,
      recipientAlias: 'owner',
      id: crypto.randomUUID(),
      kind: 'request',
      subject: 'message first',
      body: 'bounded',
    });
    expect(
      (
        await runClaudeMonitor(input(item), {
          now: () => START + 2,
          emit: async () => undefined,
        })
      ).reason,
    ).toBe('message-notified');
    await acknowledgeMessage({
      root: item.root,
      collaborationId: item.collaborationId,
      pin: item.self,
      messageId: sent.message.id,
    });
    const observation = await runClaudeMonitor(input(item), {
      now: () => START + 3,
      observe: async () => substantive(),
    });
    expect(observation.reason).toBe('shared-budget-refused');
    expect(
      (await deliveryClaimStatus({ root: item.root, pin: item.self }))
        .spentSlots,
    ).toBe(1);
  });

  test.each(['revoked', 'closed', 'expired'] as const)(
    'refuses output when the activation becomes %s during a message claim',
    async (boundary) => {
      const item = await fixture();
      await sendMessage({
        root: item.root,
        collaborationId: item.collaborationId,
        senderPin: item.sender,
        recipientAlias: 'owner',
        id: crypto.randomUUID(),
        kind: 'request',
        subject: boundary,
        body: 'bounded',
      });
      let current = START + 2;
      const result = await runClaudeMonitor(input(item), {
        now: () => current,
        messageClaimHooks: {
          afterMessageClaim: async () => {
            if (boundary === 'revoked') {
              await disableActivation({ root: item.root, pin: item.self });
            } else if (boundary === 'closed') {
              await closeCollaboration({
                root: item.root,
                collaborationId: item.collaborationId,
                pin: item.self,
              });
            } else {
              current = START + 60_001;
            }
          },
        },
        emit: async () => {
          throw new Error('must not emit');
        },
      });
      expect(result.notification).toBeNull();
      expect(result.reason).toMatch(/activation|expired|duration-complete/iu);
    },
  );

  test('rejects wrong peer identity before spending a shared slot', async () => {
    const item = await fixture();
    const result = await runClaudeMonitor(
      {
        ...input(item),
        peer: { ...item.peer, sessionId: 'wrong-peer' },
      },
      { now: () => START + 2 },
    );
    expect(result.reason).toBe('lease-peer-session-mismatch');
    expect(
      (await deliveryClaimStatus({ root: item.root, pin: item.self }))
        .spentSlots,
    ).toBe(0);
  });

  test('advances private no-op progress without a notification or shared slot', async () => {
    const item = await fixture();
    const noop: any = substantive();
    noop.entries = [
      {
        ...noop.entries[0]!,
        displayRole: 'automatic-control',
        origin: 'automatic-control',
        automaticControl: { automatic: true },
      },
      { ...noop.entries[1]!, text: 'Acknowledged.' },
    ];
    let clock = START + 2;
    const result = await runClaudeMonitor(
      { ...input(item), maxRuntimeMs: 10 },
      {
        now: () => clock,
        observe: async () => noop,
        sleep: async (amount: number) => {
          clock += amount;
        },
        emit: async () => {
          throw new Error('must not emit');
        },
      },
    );
    expect(result.reason).toBe('duration-complete');
    expect((await readLease(item.root, item.self.sessionId))?.peerCursor).toBe(
      3,
    );
    expect(
      (await deliveryClaimStatus({ root: item.root, pin: item.self }))
        .spentSlots,
    ).toBe(0);
  });

  test('refuses output when the owner binding is taken over during a run', async () => {
    const item = await fixture();
    await sendMessage({
      root: item.root,
      collaborationId: item.collaborationId,
      senderPin: item.sender,
      recipientAlias: 'owner',
      id: crypto.randomUUID(),
      kind: 'request',
      subject: 'takeover',
      body: 'bounded',
    });
    const result = await runClaudeMonitor(input(item), {
      now: () => START + 2,
      messageClaimHooks: {
        afterMessageClaim: async () => {
          await takeOverMembership({
            root: item.root,
            collaborationId: item.collaborationId,
            pin: { runtime: 'claude-code', sessionId: 'replacement' },
            alias: 'owner',
            worktree: item.cwd,
            expectedPreviousPin: item.self,
            reason: 'fixture takeover',
          });
        },
      },
      emit: async () => {
        throw new Error('must not emit');
      },
    });
    expect(result.notification).toBeNull();
    expect(result.reason).toMatch(/activation|lease/iu);
  });

  test('records interrupted output without inventing observation retry', async () => {
    const item = await fixture();
    await expect(
      runClaudeMonitor(input(item), {
        now: () => START + 2,
        observe: async () => substantive(),
        emit: async () => {
          throw new Error('simulated interrupted output');
        },
      }),
    ).rejects.toThrow('simulated interrupted output');
    const status = await deliveryClaimStatus({
      root: item.root,
      pin: item.self,
    });
    expect(status.interruptedAttempts).toEqual([]);
    expect(status.outcomeUnknown).toEqual([]);
    expect(status.observationAttempts[0]).toMatchObject({
      status: 'outcome-unknown',
    });
  });

  test('duplicate concurrent runners emit at most one notification', async () => {
    const item = await fixture();
    await sendMessage({
      root: item.root,
      collaborationId: item.collaborationId,
      senderPin: item.sender,
      recipientAlias: 'owner',
      id: crypto.randomUUID(),
      kind: 'request',
      subject: 'concurrent',
      body: 'bounded',
    });
    let clock = START + 2;
    const emitted: string[] = [];
    const run = () =>
      runClaudeMonitor(
        { ...input(item), maxRuntimeMs: 100 },
        {
          now: () => (clock += 10),
          sleep: async () => undefined,
          emit: async (notification: { eventKey: string }) =>
            emitted.push(notification.eventKey),
        },
      );
    const results = await Promise.all([run(), run()]);
    expect(
      results.filter((result) => result.reason === 'message-notified'),
    ).toHaveLength(1);
    expect(emitted).toHaveLength(1);
    expect(
      (await deliveryClaimStatus({ root: item.root, pin: item.self }))
        .spentSlots,
    ).toBe(1);
  });

  test('a kill after the observation event claim stays deduplicated after re-arm', async () => {
    const item = await fixture();
    await expect(
      runClaudeMonitor(input(item), {
        now: () => START + 2,
        observe: async () => substantive(),
        observationClaimHooks: {
          afterEventClaim: () => {
            throw new Error('simulated kill after event');
          },
        },
      }),
    ).rejects.toThrow('simulated kill after event');
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
    const repeated = await runClaudeMonitor(input(item), {
      now: () => START + 4,
      observe: async () => substantive(),
    });
    expect(repeated.reason).toBe('duplicate-observation');
    expect(
      (await deliveryClaimStatus({ root: item.root, pin: item.self }))
        .spentSlots,
    ).toBe(0);
  });

  test('a kill after the shared slot remains bounded and quiet after re-arm', async () => {
    const item = await fixture();
    await expect(
      runClaudeMonitor(input(item), {
        now: () => START + 2,
        observe: async () => substantive(),
        observationClaimHooks: {
          afterSlotClaim: () => {
            throw new Error('simulated kill after slot');
          },
        },
      }),
    ).rejects.toThrow('simulated kill after slot');
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
    const repeated = await runClaudeMonitor(input(item), {
      now: () => START + 4,
      observe: async () => substantive(),
    });
    expect(repeated.reason).toBe('duplicate-observation');
    expect(
      (await deliveryClaimStatus({ root: item.root, pin: item.self }))
        .spentSlots,
    ).toBe(1);
  });

  test('parses a synthetic Claude transcript through the real buildDigest path', async () => {
    const item = await fixture(2, 'claude-code');
    await writeFile(
      item.transcript,
      [
        {
          type: 'user',
          sessionId: item.peer.sessionId,
          message: { role: 'user', content: 'Please inspect this.' },
        },
        {
          type: 'assistant',
          sessionId: item.peer.sessionId,
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Inspection complete.' }],
          },
        },
      ]
        .map((record) => JSON.stringify(record))
        .join('\n') + '\n',
    );
    const result = await runClaudeMonitor(input(item), {
      now: () => START + 2,
      emit: async () => undefined,
    });
    expect(result.reason).toBe('observation-notified');
    expect(result.notification).toMatchObject({
      peer: `claude-code:${item.peer.sessionId}`,
    });
    await expect(access(path.join(item.root, 'offsets'))).rejects.toThrow();
  });

  test.each(['truncated', 'prefix-changed'] as const)(
    'covers the Cursor peer branch and refuses %s continuity after re-arm',
    async (mutation) => {
      const item = await fixture(2, 'cursor');
      const digest = await cursorSubstantive(item);
      const first = await runClaudeMonitor(input(item), {
        now: () => START + 2,
        observe: async () => digest,
        emit: async () => undefined,
      });
      expect(first.reason).toBe('observation-notified');
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
      const original = await readFile(item.transcript);
      await writeFile(
        item.transcript,
        mutation === 'truncated'
          ? original.subarray(0, Math.max(0, original.length - 2))
          : Buffer.concat([Buffer.from('X'), original.subarray(1)]),
      );
      const second = await runClaudeMonitor(input(item), {
        now: () => START + 4,
        observe: async () => digest,
      });
      expect(second.reason).toMatch(/continuity-(size|prefix)-mismatch/u);
      expect(
        (await deliveryClaimStatus({ root: item.root, pin: item.self }))
          .spentSlots,
      ).toBe(1);
    },
  );

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
