import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { codexStopCommand } from '../../session-observer-collab/src/codex-lifecycle.mjs';
import { installCodexStopBundle } from '../../session-observer-collab/src/lib/codex-install.mjs';
import {
  effectiveLease,
  leasePath,
  LEASE_SCHEMA_VERSION,
} from '../../session-observer-collab/src/lib/lease-state.mjs';
import {
  assessAutomaticOwnership,
  inspectClaudeStopInventory,
  inspectCodexStopInventory,
} from './registration.js';

function lease(state: 'armed' | 'waiting' | 'idle' | 'triggered' | 'disarmed') {
  const armedAt = '2026-09-19T10:00:00.000Z';
  return {
    schemaVersion: 6 as const,
    leaseId: 'lease-1',
    runtime: 'codex' as const,
    peerRuntime: 'claude-code' as const,
    ownerSession: 'owner',
    ownerCwd: '/tmp/worktree',
    peerSession: 'peer',
    peerTranscript: '/tmp/peer.jsonl',
    peerCanonicalTranscriptPath: '/tmp/peer.jsonl',
    peerIndexBase: 'zero-based-jsonl-record-index' as const,
    state,
    peerCursor: 0,
    peerContinuity: null,
    continuationCount: 0,
    continuationCap: 5,
    loopCount: 0,
    loopCap: 10,
    waitMs: state === 'waiting' ? 1000 : 0,
    waitStartedAt: state === 'waiting' ? armedAt : null,
    waitDeadlineAt: state === 'waiting' ? '2026-09-19T10:00:01.000Z' : null,
    waitToken: state === 'waiting' ? 'waiter' : null,
    waitPid: state === 'waiting' ? 42 : null,
    leaseMs: 3600000,
    armedAt,
    expiresAt: '2026-09-19T11:00:00.000Z',
    updatedAt: armedAt,
    diagnostic: null,
  };
}

describe('observer owner contract', () => {
  test('pins observer path, schema, effective-state, command, and real launcher recognition', async () => {
    expect(LEASE_SCHEMA_VERSION).toBe(6);
    const root = await mkdtemp(path.join(tmpdir(), 'owner-contract-'));
    expect(leasePath(root, 'owner')).toBe(
      path.join(root, 'leases', 'owner.json'),
    );
    expect(
      effectiveLease(lease('armed'), Date.parse('2026-09-19T12:00:00.000Z'))
        .state,
    ).toBe('idle');
    const scriptPath = path.join(root, 'observer-stop.mjs');
    const sourceScriptPath = path.resolve(
      'skills/session-observer-collab/scripts/hooks/codex-stop.mjs',
    );
    await installCodexStopBundle({ scriptPath, sourceScriptPath });
    const hooksPath = path.join(root, 'hooks.json');
    await writeFile(
      hooksPath,
      JSON.stringify({
        hooks: {
          Stop: [{ hooks: [{ command: codexStopCommand(scriptPath) }] }],
        },
      }),
    );
    const inventory = await inspectCodexStopInventory(hooksPath);
    expect(inventory.registrations[0]?.recognizedObserver).toBe(true);
    const mutated = await readFile(scriptPath, 'utf8');
    await writeFile(
      scriptPath,
      mutated.replace('session-observer-collab-codex-stop', 'drifted-owner'),
    );
    expect(
      (await inspectCodexStopInventory(hooksPath)).registrations[0]
        ?.recognizedObserver,
    ).toBe(false);
  });

  test.each([
    ['armed', 'present'],
    ['waiting', 'inactive'],
    ['triggered', 'present'],
    ['idle', 'inactive'],
    ['disarmed', 'inactive'],
  ] as const)(
    'maps %s observer state to %s without mutating lease bytes',
    async (state, expected) => {
      const root = await mkdtemp(path.join(tmpdir(), 'owner-contract-'));
      const file = leasePath(root, 'owner');
      await import('node:fs/promises').then(({ mkdir }) =>
        mkdir(path.dirname(file), { recursive: true }),
      );
      await writeFile(file, `${JSON.stringify(lease(state))}\n`);
      const before = await readFile(file);
      const inventory = await inspectCodexStopInventory(
        path.join(root, 'missing-hooks.json'),
      );
      const result = await assessAutomaticOwnership({
        root,
        pin: { runtime: 'codex', sessionId: 'owner' },
        worktree: '/tmp/worktree',
        inventory,
        now: new Date('2026-09-19T10:30:00.000Z'),
      });
      expect(result.observerOwner).toBe(expected);
      expect(await readFile(file)).toEqual(before);
      if (expected === 'present')
        expect(result.recoveryCommand).toContain('disarm --session owner');
    },
  );

  test('keeps expired triggered ownership conservative and permits explicit disarm state', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'owner-contract-'));
    const file = leasePath(root, 'owner');
    await import('node:fs/promises').then(({ mkdir }) =>
      mkdir(path.dirname(file), { recursive: true }),
    );
    await writeFile(file, `${JSON.stringify(lease('triggered'))}\n`);
    const inventory = await inspectCodexStopInventory(
      path.join(root, 'missing-hooks.json'),
    );
    const base = {
      root,
      pin: { runtime: 'codex' as const, sessionId: 'owner' },
      worktree: '/tmp/worktree',
      inventory,
      now: new Date('2026-09-19T12:00:00.000Z'),
    };
    expect((await assessAutomaticOwnership(base)).observerOwner).toBe(
      'present',
    );
    await writeFile(file, `${JSON.stringify(lease('disarmed'))}\n`);
    expect((await assessAutomaticOwnership(base)).automaticAllowed).toBe(true);
  });

  test.each([
    ['partial idle', (value: Record<string, unknown>) => delete value.leaseId],
    [
      'partial disarmed',
      (value: Record<string, unknown>) => delete value.peerTranscript,
    ],
    [
      'future schema',
      (value: Record<string, unknown>) => {
        value.schemaVersion = 7;
      },
    ],
    [
      'invalid counter',
      (value: Record<string, unknown>) => {
        value.continuationCount = -1;
      },
    ],
    [
      'partial wait fields',
      (value: Record<string, unknown>) => {
        value.state = 'waiting';
        value.waitStartedAt = '2026-09-19T10:00:00.000Z';
        value.waitDeadlineAt = null;
      },
    ],
    [
      'invalid canonical peer path',
      (value: Record<string, unknown>) => {
        value.peerCanonicalTranscriptPath = '/tmp/other.jsonl';
      },
    ],
  ])('treats %s lease records as uncertain', async (_label, mutate) => {
    const root = await mkdtemp(path.join(tmpdir(), 'owner-contract-'));
    const file = leasePath(root, 'owner');
    await import('node:fs/promises').then(({ mkdir }) =>
      mkdir(path.dirname(file), { recursive: true }),
    );
    const value = JSON.parse(JSON.stringify(lease('idle'))) as Record<
      string,
      unknown
    >;
    mutate(value);
    await writeFile(file, `${JSON.stringify(value)}\n`);
    const inventory = await inspectCodexStopInventory(
      path.join(root, 'missing-hooks.json'),
    );
    expect(
      await assessAutomaticOwnership({
        root,
        pin: { runtime: 'codex', sessionId: 'owner' },
        worktree: '/tmp/worktree',
        inventory,
        now: new Date('2026-09-19T10:30:00.000Z'),
      }),
    ).toMatchObject({
      automaticAllowed: false,
      observerOwner: 'uncertain',
      controller: null,
    });
  });

  test('selects composition only for an active lease and verified observer adapter', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'owner-contract-'));
    const file = leasePath(root, 'owner');
    await import('node:fs/promises').then(({ mkdir }) =>
      mkdir(path.dirname(file), { recursive: true }),
    );
    await writeFile(file, `${JSON.stringify(lease('armed'))}\n`);
    const scriptPath = path.join(root, 'observer-stop.mjs');
    await installCodexStopBundle({
      scriptPath,
      sourceScriptPath: path.resolve(
        'skills/session-observer-collab/scripts/hooks/codex-stop.mjs',
      ),
    });
    const hooksPath = path.join(root, 'hooks.json');
    await writeFile(
      hooksPath,
      JSON.stringify({
        hooks: {
          Stop: [{ hooks: [{ command: codexStopCommand(scriptPath) }] }],
        },
      }),
    );
    const inventory = await inspectCodexStopInventory(hooksPath);
    const base = {
      root,
      pin: { runtime: 'codex' as const, sessionId: 'owner' },
      worktree: '/tmp/worktree',
      inventory,
      now: new Date('2026-09-19T10:30:00.000Z'),
    };
    expect(await assessAutomaticOwnership(base)).toMatchObject({
      automaticAllowed: true,
      observerOwner: 'present',
      controller: 'observer-collab',
    });
    expect(
      await assessAutomaticOwnership({
        ...base,
        requestedController: 'standalone-messaging',
      }),
    ).toMatchObject({ automaticAllowed: false, controller: null });
    await writeFile(file, `${JSON.stringify(lease('disarmed'))}\n`);
    expect(await assessAutomaticOwnership(base)).toMatchObject({
      automaticAllowed: true,
      observerOwner: 'inactive',
      controller: 'standalone-messaging',
    });
  });

  test('recognizes only the exact verified Claude composed Monitor activation', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'owner-contract-'));
    const settingsPath = path.join(root, 'settings.json');
    await writeFile(settingsPath, '{}\n');
    const inventory = await inspectClaudeStopInventory({
      settingsPaths: [settingsPath],
    });
    expect(
      await assessAutomaticOwnership({
        root,
        pin: { runtime: 'claude-code', sessionId: 'owner' },
        worktree: '/tmp/worktree',
        inventory,
        requestedController: 'observer-collab',
      }),
    ).toMatchObject({
      automaticAllowed: false,
      controller: null,
      reason: expect.stringContaining('composed-monitor-inactive'),
    });
    const activationId = '11111111-1111-4111-8111-111111111111';
    const collaborationId = '22222222-2222-4222-8222-222222222222';
    const composed = {
      ...lease('armed'),
      runtime: 'claude-code',
      composedActivation: {
        collaborationId,
        activationId,
        controller: 'observer-collab',
        mechanism: 'monitor',
        ownerRuntime: 'claude-code',
        ownerSession: 'owner',
        peerRuntime: 'claude-code',
        peerSession: 'peer',
        ownerCwd: '/tmp/worktree',
        peerTranscript: '/tmp/peer.jsonl',
        confirmedAt: '2026-09-19T10:00:00.000Z',
        oldMonitorStopped: true,
        standaloneWatcherStopped: true,
      },
    };
    const file = leasePath(root, 'owner');
    await import('node:fs/promises').then(({ mkdir }) =>
      mkdir(path.dirname(file), { recursive: true }),
    );
    await writeFile(file, `${JSON.stringify(composed)}\n`);
    const exact = await assessAutomaticOwnership({
      root,
      pin: { runtime: 'claude-code', sessionId: 'owner' },
      worktree: '/tmp/worktree',
      inventory,
      requestedController: 'observer-collab',
      requestedActivationId: activationId,
      requestedCollaborationId: collaborationId,
      now: new Date('2026-09-19T10:30:00.000Z'),
    });
    expect(exact).toMatchObject({
      automaticAllowed: true,
      observerOwner: 'present',
      controller: 'observer-collab',
      composedMonitorLeaseId: 'lease-1',
      composedMonitorPeer: { runtime: 'claude-code', sessionId: 'peer' },
    });
    expect(
      await assessAutomaticOwnership({
        ...exact,
        root,
        pin: { runtime: 'claude-code', sessionId: 'owner' },
        worktree: '/tmp/worktree',
        inventory,
        requestedController: 'observer-collab',
        requestedActivationId: '33333333-3333-4333-8333-333333333333',
        requestedCollaborationId: collaborationId,
        now: new Date('2026-09-19T10:30:00.000Z'),
      }),
    ).toMatchObject({ automaticAllowed: false, controller: null });
  });
});
