import crypto from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import {
  disableActivation,
  enableActivation,
} from '../../../shared/collaboration/activation.js';
import { deliveryClaimStatus } from '../../../shared/collaboration/claims.js';
import {
  joinCollaboration,
  openCollaboration,
} from '../../../shared/collaboration/membership.js';
import {
  acknowledgeMessage,
  sendMessage,
} from '../../../shared/collaboration/messages.js';
import { runAgentMessagingCli } from '../../agent-messaging/src/agent-messaging.js';
import { runCodexHook as runStandaloneCodexHook } from '../../agent-messaging/src/hooks/codex.js';
import { watchInbox } from '../../agent-messaging/src/watch.js';
import { getSession, markRead } from '../../session-observer/src/lib/state.js';
import { codexStopCommand } from './codex-lifecycle.mjs';
import { arm, disarm } from './collab-control.mjs';
import { runCodexStopHook } from './hooks/codex-stop.mjs';
import { installCodexStopBundle } from './lib/codex-install.mjs';
import { readLease } from './lib/lease-state.mjs';

const roots: string[] = [];
const START = Date.parse('2026-09-19T10:00:00.000Z');

function digest(fromIndex = 0) {
  const totalRecords = fromIndex + 3;
  return {
    schemaVersion: 1,
    range: {
      indexBase: 'zero-based-jsonl-record-index',
      fromIndex,
      toIndex: totalRecords - 1,
      nextIndex: totalRecords,
      totalRecords,
      newRecords: totalRecords - fromIndex,
    },
    accounting: {
      indexBase: 'zero-based-jsonl-record-index',
      raw: {
        fromIndex,
        toIndex: totalRecords - 1,
        count: totalRecords - fromIndex,
        nextIndex: totalRecords,
        totalRecords,
      },
      rendered: { count: 2 },
      filtered: { tailSliceEntries: 0 },
    },
    entries: [
      {
        role: 'user',
        text: 'Please review the composed controller.',
        kind: 'message',
        recordIndex: fromIndex,
      },
      {
        role: 'assistant',
        text: 'For Codex: the composed result is ready.',
        kind: 'message',
        recordIndex: fromIndex + 2,
      },
    ],
  };
}

async function fixture(maxContinuations = 3) {
  const root = await mkdtemp(path.join(tmpdir(), 'messaging-composition-'));
  roots.push(root);
  const cwd = path.join(root, 'worktree');
  const peerTranscript = path.join(root, 'peer.jsonl');
  await mkdir(cwd);
  await writeFile(peerTranscript, '{}\n');
  const collaborationId = crypto.randomUUID();
  const driver = { runtime: 'cursor' as const, sessionId: 'driver' };
  const recipient = { runtime: 'codex' as const, sessionId: 'recipient' };
  await openCollaboration({
    root,
    collaborationId,
    pin: driver,
    alias: 'driver',
    label: 'composition',
    task: 'share one continuation owner',
    worktree: cwd,
  });
  await joinCollaboration({
    root,
    collaborationId,
    pin: recipient,
    alias: 'recipient',
    worktree: cwd,
  });
  await joinCollaboration({
    root,
    collaborationId,
    pin: { runtime: 'claude-code', sessionId: 'third' },
    alias: 'third',
    worktree: cwd,
  });
  const activation = await enableActivation({
    root,
    collaborationId,
    pin: recipient,
    worktree: cwd,
    controller: 'observer-collab',
    mechanism: 'stop',
    maxContinuations,
    now: new Date(START),
  });
  await arm(
    root,
    {
      runtime: 'codex',
      peerRuntime: 'claude-code',
      session: recipient.sessionId,
      peerSession: 'peer',
      cwd,
      peerTranscript,
      waitMs: 1,
      leaseMs: 60_000,
      continuationCap: 3,
      loopCap: 3,
    },
    START,
  );
  return {
    root,
    cwd,
    peerTranscript,
    collaborationId,
    driver,
    recipient,
    activation,
  };
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('observer and messaging continuation composition', () => {
  test('ships exact-ID dedup guidance in every generated skill form', async () => {
    for (const file of [
      'skills/agent-messaging/SKILL.md',
      'plugins/session/skills/messaging/SKILL.md',
      'skills/session-observer-collab/SKILL.md',
      'plugins/consensus/skills/observer-collab/SKILL.md',
    ]) {
      const contents = await readFile(path.resolve(file), 'utf8');
      expect(contents).toMatch(/exact\s+message ID/u);
      expect(contents).toMatch(
        /(?:do not|does not)\s+advance either observer cursor/u,
      );
    }
  });

  test('enables only through the verified observer route and delegates registration', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'messaging-enable-'));
    roots.push(root);
    const cwd = path.join(root, 'worktree');
    const transcript = path.join(root, 'peer.jsonl');
    await mkdir(cwd);
    await writeFile(transcript, '{}\n');
    const collaborationId = crypto.randomUUID();
    const pin = { runtime: 'codex' as const, sessionId: 'recipient' };
    const enableNow = Date.now();
    await openCollaboration({
      root,
      collaborationId,
      pin,
      alias: 'recipient',
      label: 'enable-composition',
      task: 'verify one owner',
      worktree: cwd,
    });
    await arm(
      root,
      {
        runtime: 'codex',
        peerRuntime: 'claude-code',
        session: pin.sessionId,
        peerSession: 'peer',
        cwd,
        peerTranscript: transcript,
        leaseMs: 60 * 60 * 1000,
      },
      enableNow,
    );
    const launcher = path.join(root, 'observer-stop.mjs');
    const installed = await installCodexStopBundle({
      scriptPath: launcher,
      sourceScriptPath: path.resolve(
        'skills/session-observer-collab/scripts/hooks/codex-stop.mjs',
      ),
    });
    const hooksPath = path.join(root, 'hooks.json');
    await writeFile(
      hooksPath,
      JSON.stringify({
        hooks: {
          Stop: [{ hooks: [{ command: codexStopCommand(launcher) }] }],
        },
      }),
    );
    const invoke = async (args: string[]) => {
      const stdout: string[] = [];
      const stderr: string[] = [];
      const code = await runAgentMessagingCli(args, {
        env: { HOME: root, SESSION_OBSERVER_STATE_DIR: root },
        cwd,
        readStdin: async () => '',
        stdout: (value) => stdout.push(value),
        stderr: (value) => stderr.push(value),
      });
      return { code, stdout: stdout.join(''), stderr: stderr.join('') };
    };
    const enableArgs = [
      'delivery',
      'enable',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:recipient',
      '--cwd',
      cwd,
      '--hooks-path',
      hooksPath,
      '--controller',
      'observer-collab',
      '--json',
    ];
    const manifestPath = path.join(
      installed.supportRoot,
      installed.version,
      '.session-observer-collab-bundle.json',
    );
    const currentManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    await writeFile(
      manifestPath,
      `${JSON.stringify({
        owner: currentManifest.owner,
        version: currentManifest.version,
        files: currentManifest.files,
      })}\n`,
    );
    const legacyRefusal = await invoke(enableArgs);
    expect(legacyRefusal.code).toBe(3);
    expect(JSON.parse(legacyRefusal.stderr).message).toContain(
      'no verified composed-capable adapter',
    );
    await writeFile(manifestPath, `${JSON.stringify(currentManifest)}\n`);
    const installedHook = path.join(
      installed.supportRoot,
      installed.version,
      'session-observer-collab/scripts/hooks/codex-stop.mjs',
    );
    const installedHookBytes = await readFile(installedHook);
    await writeFile(
      installedHook,
      Buffer.concat([installedHookBytes, Buffer.from('\n// drift\n')]),
    );
    const digestRefusal = await invoke(enableArgs);
    expect(digestRefusal.code).toBe(3);
    expect(JSON.parse(digestRefusal.stderr).message).toContain(
      'no verified composed-capable adapter',
    );
    await writeFile(installedHook, installedHookBytes);
    const enabled = await invoke(enableArgs);
    expect(enabled.code, enabled.stderr).toBe(0);
    expect(JSON.parse(enabled.stdout).data).toMatchObject({
      controller: 'observer-collab',
      mechanism: 'stop',
    });
    const registered = await invoke([
      'delivery',
      'register',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:recipient',
      '--cwd',
      cwd,
      '--hooks-path',
      hooksPath,
      '--json',
    ]);
    expect(registered.code, registered.stderr).toBe(0);
    expect(JSON.parse(registered.stdout).data).toMatchObject({
      changed: false,
      controller: 'observer-collab',
      delegated: true,
    });
  });

  test('refuses registration when observer ownership changes after activation', async () => {
    const setup = async (composed: boolean) => {
      const root = await mkdtemp(
        path.join(tmpdir(), 'messaging-register-race-'),
      );
      roots.push(root);
      const cwd = path.join(root, 'worktree');
      const transcript = path.join(root, 'peer.jsonl');
      await mkdir(cwd);
      await writeFile(transcript, '{}\n');
      const collaborationId = crypto.randomUUID();
      const pin = { runtime: 'codex' as const, sessionId: 'recipient' };
      await openCollaboration({
        root,
        collaborationId,
        pin,
        alias: 'recipient',
        label: 'register-race',
        task: 'preserve the immutable controller',
        worktree: cwd,
      });
      const launcher = path.join(root, 'observer-stop.mjs');
      await installCodexStopBundle({
        scriptPath: launcher,
        sourceScriptPath: path.resolve(
          'skills/session-observer-collab/scripts/hooks/codex-stop.mjs',
        ),
      });
      const hooksPath = path.join(root, 'hooks.json');
      if (composed) {
        await arm(
          root,
          {
            runtime: 'codex',
            peerRuntime: 'claude-code',
            session: pin.sessionId,
            peerSession: 'peer',
            cwd,
            peerTranscript: transcript,
            leaseMs: 60 * 60 * 1000,
          },
          Date.now(),
        );
        await writeFile(
          hooksPath,
          JSON.stringify({
            hooks: {
              Stop: [{ hooks: [{ command: codexStopCommand(launcher) }] }],
            },
          }),
        );
      } else {
        await writeFile(hooksPath, '{}\n');
      }
      const invoke = async (args: string[]) => {
        const stdout: string[] = [];
        const stderr: string[] = [];
        const code = await runAgentMessagingCli(args, {
          env: { HOME: root, SESSION_OBSERVER_STATE_DIR: root },
          cwd,
          readStdin: async () => '',
          stdout: (value) => stdout.push(value),
          stderr: (value) => stderr.push(value),
        });
        return { code, stdout: stdout.join(''), stderr: stderr.join('') };
      };
      const enabled = await invoke([
        'delivery',
        'enable',
        '--root',
        root,
        '--collab',
        collaborationId,
        '--self',
        'codex:recipient',
        '--cwd',
        cwd,
        '--hooks-path',
        hooksPath,
        ...(composed ? ['--controller', 'observer-collab'] : []),
        '--json',
      ]);
      expect(enabled.code, enabled.stderr).toBe(0);
      return {
        root,
        cwd,
        transcript,
        collaborationId,
        launcher,
        hooksPath,
        invoke,
      };
    };

    const armed = await setup(false);
    await arm(
      armed.root,
      {
        runtime: 'codex',
        peerRuntime: 'claude-code',
        session: 'recipient',
        peerSession: 'peer',
        cwd: armed.cwd,
        peerTranscript: armed.transcript,
        leaseMs: 60 * 60 * 1000,
      },
      Date.now(),
    );
    await writeFile(
      armed.hooksPath,
      JSON.stringify({
        hooks: {
          Stop: [{ hooks: [{ command: codexStopCommand(armed.launcher) }] }],
        },
      }),
    );
    const armedRegistration = await armed.invoke([
      'delivery',
      'register',
      '--root',
      armed.root,
      '--collab',
      armed.collaborationId,
      '--self',
      'codex:recipient',
      '--cwd',
      armed.cwd,
      '--hooks-path',
      armed.hooksPath,
      '--json',
    ]);
    expect(armedRegistration.code).toBe(3);
    expect(JSON.parse(armedRegistration.stderr).message).toContain(
      'observer continuation owner is active or triggered',
    );

    const disarmed = await setup(true);
    await disarm(disarmed.root, 'recipient', Date.now());
    const disarmedRegistration = await disarmed.invoke([
      'delivery',
      'register',
      '--root',
      disarmed.root,
      '--collab',
      disarmed.collaborationId,
      '--self',
      'codex:recipient',
      '--cwd',
      disarmed.cwd,
      '--hooks-path',
      disarmed.hooksPath,
      '--script-path',
      path.join(disarmed.root, 'messaging-stop.mjs'),
      '--json',
    ]);
    expect(disarmedRegistration.code).toBe(3);
    expect(JSON.parse(disarmedRegistration.stderr).message).toContain(
      'observer-collab requires an active exact-session lease',
    );
  });

  test('presents addressed requests before observation without advancing either observer cursor', async () => {
    const f = await fixture();
    const messageId = crypto.randomUUID();
    await sendMessage({
      root: f.root,
      collaborationId: f.collaborationId,
      senderPin: f.driver,
      recipientAlias: 'recipient',
      id: messageId,
      kind: 'request',
      subject: 'Review this first',
      body: 'The inbox wins over observation.',
    });
    const priorStateDir = process.env.STATE_DIR;
    const publicStateDir = path.join(f.root, 'public-observer-state');
    process.env.STATE_DIR = publicStateDir;
    try {
      await markRead('claude-code', 'peer', {
        lastRecordIndex: 11,
        lastTotalRecords: 11,
        transcriptPath: f.peerTranscript,
        recordedCwd: f.cwd,
      });
      const publicStatePath = path.join(publicStateDir, 'state.json');
      const beforePublic = await getSession('claude-code', 'peer');
      const beforePublicBytes = await readFile(publicStatePath);
      const beforeLease = await readLease(f.root, f.recipient.sessionId);
      let observed = 0;
      const output = await runCodexStopHook(
        {
          hook_event_name: 'Stop',
          session_id: f.recipient.sessionId,
          cwd: f.cwd,
          event_id: 'message-first',
        },
        {
          root: f.root,
          now: () => START + 1,
          observe: async () => {
            observed += 1;
            return digest();
          },
        },
      );
      expect(output).toMatchObject({
        decision: 'block',
        reason: expect.stringContaining(messageId),
      });
      expect(output.reason).toContain('agent_messaging_context');
      expect(observed).toBe(0);
      expect(await readLease(f.root, f.recipient.sessionId)).toEqual(
        beforeLease,
      );
      expect(await getSession('claude-code', 'peer')).toEqual(beforePublic);
      await acknowledgeMessage({
        root: f.root,
        collaborationId: f.collaborationId,
        pin: f.recipient,
        messageId,
      });
      expect(await readLease(f.root, f.recipient.sessionId)).toEqual(
        beforeLease,
      );
      expect(await getSession('claude-code', 'peer')).toEqual(beforePublic);
      expect(await readFile(publicStatePath)).toEqual(beforePublicBytes);
    } finally {
      if (priorStateDir === undefined) delete process.env.STATE_DIR;
      else process.env.STATE_DIR = priorStateDir;
    }
  });

  test('keeps standalone Stop and watch entrypoints inert for the observer-owned epoch', async () => {
    const f = await fixture();
    const messageId = crypto.randomUUID();
    await sendMessage({
      root: f.root,
      collaborationId: f.collaborationId,
      senderPin: f.driver,
      recipientAlias: 'recipient',
      id: messageId,
      kind: 'request',
      subject: 'Only the observer route may present this',
      body: 'Do not emit from standalone messaging.',
    });
    const env = { SESSION_OBSERVER_STATE_DIR: f.root, HOME: f.root };
    expect(
      await runStandaloneCodexHook(
        {
          hook_event_name: 'Stop',
          session_id: f.recipient.sessionId,
          cwd: f.cwd,
          event_id: 'standalone-inert',
        },
        { env },
      ),
    ).toBeNull();
    const notifications: unknown[] = [];
    expect(
      await watchInbox(
        {
          root: f.root,
          collaborationId: f.collaborationId,
          pin: f.recipient,
          worktree: f.cwd,
          durationMs: 10,
          pollMs: 1,
          env,
        },
        {
          emit: (notification) => {
            notifications.push(notification);
          },
          now: () => new Date(START + 1),
        },
      ),
    ).toMatchObject({ reason: 'ownership-refused', notifications: 0 });
    expect(notifications).toEqual([]);
  });

  test('rechecks the inbox before observer CAS and defers the selected range', async () => {
    const f = await fixture();
    const messageId = crypto.randomUUID();
    const output = await runCodexStopHook(
      {
        hook_event_name: 'Stop',
        session_id: f.recipient.sessionId,
        cwd: f.cwd,
        event_id: 'arrival-race',
      },
      {
        root: f.root,
        now: () => START + 1,
        observe: async () => {
          await sendMessage({
            root: f.root,
            collaborationId: f.collaborationId,
            senderPin: f.driver,
            recipientAlias: 'recipient',
            id: messageId,
            kind: 'request',
            subject: 'Arrived during selection',
            body: 'Defer the observation range.',
          });
          return digest();
        },
      },
    );
    expect(output.reason).toContain(messageId);
    expect(await readLease(f.root, f.recipient.sessionId)).toMatchObject({
      state: 'idle',
      peerCursor: 0,
      continuationCount: 0,
    });
    expect(
      await deliveryClaimStatus({ root: f.root, pin: f.recipient }),
    ).toMatchObject({ spentSlots: 1, remainingSlots: 2 });
  });

  test('reserves the shared slot before observer CAS and spends at most one on CAS loss', async () => {
    const f = await fixture();
    const output = await runCodexStopHook(
      {
        hook_event_name: 'Stop',
        session_id: f.recipient.sessionId,
        cwd: f.cwd,
        event_id: 'cas-loss',
      },
      {
        root: f.root,
        now: () => START + 1,
        observe: async () => digest(),
        afterSharedSlot: async () => {
          await disarm(f.root, f.recipient.sessionId, START + 1);
        },
      },
    );
    expect(output).toMatchObject({ decision: 'allow' });
    expect(await readLease(f.root, f.recipient.sessionId)).toMatchObject({
      peerCursor: 0,
      continuationCount: 0,
    });
    expect(
      await deliveryClaimStatus({ root: f.root, pin: f.recipient }),
    ).toMatchObject({
      spentSlots: 1,
      remainingSlots: 2,
      interruptedAttempts: [],
    });
  });

  test('shares the exact cap across observation and competing callbacks', async () => {
    const f = await fixture(1);
    const standalone =
      // @ts-expect-error Generated bundle modules intentionally ship without declarations.
      (await import('../../../../skills/session-observer-collab/scripts/hooks/codex-stop.mjs')) as {
        runCodexStopHook: typeof runCodexStopHook;
      };
    const plugin =
      // @ts-expect-error Generated bundle modules intentionally ship without declarations.
      (await import('../../../../plugins/consensus/skills/observer-collab/scripts/hooks/codex-stop.mjs')) as {
        runCodexStopHook: typeof runCodexStopHook;
      };
    const event = {
      hook_event_name: 'Stop',
      session_id: f.recipient.sessionId,
      cwd: f.cwd,
      event_id: 'same-native-event',
    };
    const outputs = await Promise.all([
      standalone.runCodexStopHook(event, {
        root: f.root,
        now: () => START + 1,
        observe: async () => digest(),
      }),
      plugin.runCodexStopHook(event, {
        root: f.root,
        now: () => START + 1,
        observe: async () => digest(),
      }),
    ]);
    expect(
      outputs.filter((output) => output.decision === 'block'),
    ).toHaveLength(1);
    expect(
      await deliveryClaimStatus({ root: f.root, pin: f.recipient }),
    ).toMatchObject({ spentSlots: 1, remainingSlots: 0 });
  });

  test('stops composed automation after explicit disable without deleting observer history', async () => {
    const f = await fixture();
    const before = await readLease(f.root, f.recipient.sessionId);
    await disableActivation({
      root: f.root,
      pin: f.recipient,
      now: new Date(START + 1),
    });
    const output = await runCodexStopHook(
      {
        hook_event_name: 'Stop',
        session_id: f.recipient.sessionId,
        cwd: f.cwd,
        event_id: 'disabled',
      },
      { root: f.root, now: () => START + 2, observe: async () => digest() },
    );
    expect(output).toMatchObject({
      decision: 'allow',
      diagnostic: 'composed-inactive',
    });
    expect(await readLease(f.root, f.recipient.sessionId)).toEqual(before);
  });
});
