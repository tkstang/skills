import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  claimObservation,
  observationEventKey,
} from '../../../shared/collaboration/claims.js';
import { runAgentMessagingCli } from './agent-messaging.js';

async function run(argv: string[], env: NodeJS.ProcessEnv = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runAgentMessagingCli(argv, {
    env,
    cwd: '/tmp/worktree',
    readStdin: async () => '',
    stdout: (value) => stdout.push(value),
    stderr: (value) => stderr.push(value),
  });
  return { code, stdout: stdout.join(''), stderr: stderr.join('') };
}

describe('agent messaging CLI', () => {
  test('generates an explicit non-executing host probe plan', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'agent-messaging-cli-'));
    const collaborationId = crypto.randomUUID();
    const args = [
      'delivery',
      'probe-plan',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:recipient',
      '--probe-id',
      'codex-stop-fixture',
      '--host-version',
      'fixture-1.0',
      '--surface',
      'fixture hook',
      '--command',
      '["/fixture/codex","--probe"]',
      '--boundary',
      'stop-continuation',
      '--event-provenance',
      'fixture native event ID',
      '--timeout-ms',
      '1000',
      '--json',
    ];
    const refused = await run(args);
    expect(refused.code).toBe(2);
    expect(JSON.parse(refused.stderr).message).toContain('explicit opt-in');
    const planned = await run([...args, '--probe-opt-in']);
    expect(planned.code).toBe(0);
    expect(JSON.parse(planned.stdout).data).toMatchObject({
      collaborationId,
      execution: 'fixture-only',
      capability: 'manual-fallback',
      authorizationComplete: false,
    });
  });

  test('enables, reports, disables, and re-enables finite delivery epochs', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'agent-messaging-cli-'));
    const collaborationId = crypto.randomUUID();
    await run([
      'open',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:driver',
      '--alias',
      'driver',
      '--label',
      'delivery',
      '--task',
      'bounded',
    ]);
    const enabled = await run([
      'delivery',
      'enable',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:driver',
      '--expires-in',
      '2h',
      '--max-duration',
      '24h',
      '--max-continuations',
      '3',
      '--json',
    ]);
    expect(enabled.code).toBe(0);
    expect(JSON.parse(enabled.stdout).data).toMatchObject({
      epoch: 0,
      controller: 'standalone-messaging',
      expiryMode: 'fixed',
      maxContinuations: 3,
      thirdPartyHookAcknowledgment: null,
      noObserverMonitorAttestation: null,
    });
    const status = await run([
      'status',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:driver',
      '--json',
    ]);
    expect(JSON.parse(status.stdout).data.delivery).toMatchObject({
      active: true,
      slots: { spentSlots: 0, remainingSlots: 3 },
      deliveryClaim: expect.stringContaining('never proof of delivery'),
    });
    const activationId = JSON.parse(enabled.stdout).data.id as string;
    const observation = {
      owner: { runtime: 'codex' as const, sessionId: 'driver' },
      peer: { runtime: 'claude-code' as const, sessionId: 'peer' },
      indexBase: 'zero-based-jsonl-record-index' as const,
      fromIndex: 1,
      toIndex: 2,
      nextIndex: 3,
      selectedPrefixIdentity: 'a'.repeat(64),
    };
    await expect(
      claimObservation({
        root,
        pin: observation.owner,
        eventKey: observationEventKey({ activationId, observation }),
        observation,
        token: 'cli-observation-interruption',
        hooks: {
          afterEventClaim: () => {
            throw new Error('simulated observation interruption');
          },
        },
      }),
    ).rejects.toThrow('simulated observation interruption');
    const observedStatus = await run([
      'status',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:driver',
      '--json',
    ]);
    const delivery = JSON.parse(observedStatus.stdout).data.delivery;
    expect(delivery.interruptedAttempts).toEqual([]);
    expect(JSON.stringify(delivery)).not.toContain('delivery retry');
    expect(delivery.slots.observationAttempts).toEqual([
      expect.objectContaining({
        attemptId: 'cli-observation-interruption',
        status: 'interrupted',
      }),
    ]);
    expect(
      (
        await run([
          'delivery',
          'disable',
          '--root',
          root,
          '--collab',
          collaborationId,
          '--self',
          'codex:driver',
          '--json',
        ])
      ).code,
    ).toBe(0);
    const renewed = await run([
      'delivery',
      'enable',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:driver',
      '--json',
    ]);
    expect(JSON.parse(renewed.stdout).data).toMatchObject({
      epoch: 1,
      previousEpoch: 0,
    });
  });

  test('refuses CLI human-idle activation and exposes no renewal command', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'agent-messaging-cli-'));
    const collaborationId = crypto.randomUUID();
    await run([
      'open',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:driver',
      '--alias',
      'driver',
      '--label',
      'delivery',
      '--task',
      'bounded',
    ]);
    const enable = await run([
      'delivery',
      'enable',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:driver',
      '--expiry-mode',
      'human-idle',
      '--json',
    ]);
    expect(enable.code).toBe(3);
    expect(JSON.parse(enable.stderr).message).toContain(
      'qualifying live human-origin evidence',
    );
    const renewal = await run([
      'delivery',
      'activity',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:driver',
      '--event',
      'manual',
      '--json',
    ]);
    expect(renewal.code).toBe(2);
    expect(JSON.parse(renewal.stderr).message).toContain(
      'unknown command: delivery activity',
    );
  });
  test('opens, joins, sends, reads, and acknowledges with JSON envelopes', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'agent-messaging-cli-'));
    const collaborationId = crypto.randomUUID();
    const opened = await run([
      'open',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:driver',
      '--alias',
      'driver',
      '--label',
      'cli',
      '--task',
      'test',
      '--json',
    ]);
    expect(opened.code).toBe(0);
    await run([
      'join',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'claude-code:reviewer',
      '--alias',
      'reviewer',
      '--json',
    ]);
    const id = crypto.randomUUID();
    expect(
      (
        await run([
          'send',
          '--root',
          root,
          '--collab',
          collaborationId,
          '--self',
          'codex:driver',
          '--to',
          'reviewer',
          '--id',
          id,
          '--kind',
          'request',
          '--subject',
          'Review',
          '--body',
          'Please review',
          '--json',
        ])
      ).code,
    ).toBe(0);
    const inbox = await run([
      'inbox',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'claude-code:reviewer',
      '--json',
    ]);
    expect(JSON.parse(inbox.stdout).data.messages[0].id).toBe(id);
    expect(
      (
        await run([
          'ack',
          '--root',
          root,
          '--collab',
          collaborationId,
          '--self',
          'claude-code:reviewer',
          '--message',
          id,
          '--json',
        ])
      ).code,
    ).toBe(0);
  });

  test('rejects explicit self conflicting with a harness signal before mutation', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'agent-messaging-cli-'));
    const result = await run(
      [
        'open',
        '--root',
        root,
        '--self',
        'codex:explicit',
        '--alias',
        'driver',
        '--label',
        'cli',
        '--task',
        'test',
        '--json',
      ],
      { AGENT_MESSAGING_SELF_PIN: 'codex:harness' },
    );
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stderr).code).toBe('IDENTITY_CONFLICT');
  });

  test('reports generated collaboration recovery context after possible publication', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'agent-messaging-cli-'));
    const invalidWorktree = path.join(root, 'not-a-worktree');
    await writeFile(invalidWorktree, 'regular file');
    const result = await run([
      'open',
      '--root',
      root,
      '--self',
      'codex:driver',
      '--alias',
      'driver',
      '--label',
      'recovery context',
      '--task',
      'recover a partial open',
      '--cwd',
      invalidWorktree,
      '--json',
    ]);
    expect(result.code).toBe(2);
    const failure = JSON.parse(result.stderr);
    expect(failure.collaborationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    expect(failure.paths.collaboration).toBe(
      path.join(
        root,
        'collaborations',
        failure.collaborationId,
        'collaboration.json',
      ),
    );
  });

  test('treats shell-looking bodies as inert data', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'agent-messaging-cli-'));
    const collaborationId = crypto.randomUUID();
    await run([
      'open',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:driver',
      '--alias',
      'driver',
      '--label',
      'cli',
      '--task',
      'test',
    ]);
    await run([
      'join',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'cursor:peer',
      '--alias',
      'peer',
    ]);
    const body = '$(touch /tmp/agent-messaging-must-not-execute)';
    await run([
      'send',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:driver',
      '--to',
      'peer',
      '--id',
      crypto.randomUUID(),
      '--subject',
      'data',
      '--body',
      body,
    ]);
    const inbox = await run([
      'inbox',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'cursor:peer',
      '--json',
    ]);
    expect(JSON.parse(inbox.stdout).data.messages[0].body).toBe(body);
  });

  test('creates validated replies and rejects malformed or unrelated references', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'agent-messaging-cli-'));
    const collaborationId = crypto.randomUUID();
    const opened = await run([
      'open',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:driver',
      '--alias',
      'driver',
      '--label',
      'cli',
      '--task',
      'reply',
      '--json',
    ]);
    const driverId = JSON.parse(opened.stdout).data.member.member.participantId;
    const joined = await run([
      'join',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'cursor:reviewer',
      '--alias',
      'reviewer',
      '--json',
    ]);
    const reviewerId = JSON.parse(joined.stdout).data.member.member
      .participantId;
    await run([
      'join',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'claude-code:third',
      '--alias',
      'third',
      '--json',
    ]);
    const originalId = crypto.randomUUID();
    await run([
      'send',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:driver',
      '--to',
      'reviewer',
      '--id',
      originalId,
      '--subject',
      'question',
      '--body',
      'answer me',
      '--json',
    ]);
    const replyId = crypto.randomUUID();
    expect(
      (
        await run([
          'send',
          '--root',
          root,
          '--collab',
          collaborationId,
          '--self',
          'cursor:reviewer',
          '--to',
          'driver',
          '--id',
          replyId,
          '--subject',
          'answer',
          '--body',
          'done',
          '--reply-to',
          `${reviewerId}/${originalId}`,
          '--json',
        ])
      ).code,
    ).toBe(0);
    const driverInbox = await run([
      'inbox',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:driver',
      '--json',
    ]);
    expect(JSON.parse(driverInbox.stdout).data.messages[0].replyTo).toEqual({
      participantId: reviewerId,
      messageId: originalId,
    });
    expect(
      (
        await run([
          'send',
          '--root',
          root,
          '--collab',
          collaborationId,
          '--self',
          'cursor:reviewer',
          '--to',
          'driver',
          '--id',
          crypto.randomUUID(),
          '--subject',
          'bad',
          '--body',
          'bad',
          '--reply-to',
          'malformed',
          '--json',
        ])
      ).code,
    ).toBe(2);
    const unrelated = await run([
      'send',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'claude-code:third',
      '--to',
      'driver',
      '--id',
      crypto.randomUUID(),
      '--subject',
      'bad',
      '--body',
      'bad',
      '--reply-to',
      `${reviewerId}/${originalId}`,
      '--json',
    ]);
    expect(unrelated.code).toBe(1);
    expect(JSON.parse(unrelated.stderr).code).toBe('RECORD_CONFLICT');
    expect(driverId).toMatch(/[0-9a-f-]{36}/u);
  });

  test('keeps a published message when stdout is dropped', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'agent-messaging-cli-'));
    const collaborationId = crypto.randomUUID();
    await run([
      'open',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:driver',
      '--alias',
      'driver',
      '--label',
      'cli',
      '--task',
      'stdout',
    ]);
    await run([
      'join',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'cursor:reviewer',
      '--alias',
      'reviewer',
    ]);
    const id = crypto.randomUUID();
    const errors: string[] = [];
    const code = await runAgentMessagingCli(
      [
        'send',
        '--root',
        root,
        '--collab',
        collaborationId,
        '--self',
        'codex:driver',
        '--to',
        'reviewer',
        '--id',
        id,
        '--subject',
        'queued',
        '--body',
        'durable',
        '--json',
      ],
      {
        env: {},
        cwd: '/tmp/worktree',
        readStdin: async () => '',
        stdout: () => {
          throw new Error('stdout closed');
        },
        stderr: (value) => errors.push(value),
      },
    );
    expect(code).toBe(1);
    expect(errors.join('')).toContain('stdout closed');
    const inbox = await run([
      'inbox',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'cursor:reviewer',
      '--json',
    ]);
    expect(JSON.parse(inbox.stdout).data.messages[0].id).toBe(id);
  });

  test('uses exit 3 for closed or inactive commands and exit 2 for stale identity', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'agent-messaging-cli-'));
    const collaborationId = crypto.randomUUID();
    await run([
      'open',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:driver',
      '--alias',
      'driver',
      '--label',
      'cli',
      '--task',
      'exit',
    ]);
    await run([
      'join',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'cursor:reviewer',
      '--alias',
      'reviewer',
    ]);
    await run([
      'leave',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'cursor:reviewer',
    ]);
    for (const args of [
      ['inbox', '--self', 'cursor:reviewer'],
      [
        'send',
        '--self',
        'codex:driver',
        '--to',
        'reviewer',
        '--id',
        crypto.randomUUID(),
        '--subject',
        'x',
        '--body',
        'x',
      ],
      ['close', '--self', 'cursor:reviewer'],
    ]) {
      expect(
        (
          await run([
            ...args,
            '--root',
            root,
            '--collab',
            collaborationId,
            '--json',
          ])
        ).code,
      ).toBe(3);
    }
    expect(
      (
        await run([
          'leave',
          '--root',
          root,
          '--collab',
          collaborationId,
          '--self',
          'cursor:stale',
          '--json',
        ])
      ).code,
    ).toBe(2);
    await run([
      'close',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:driver',
    ]);
    expect(
      (
        await run([
          'join',
          '--root',
          root,
          '--collab',
          collaborationId,
          '--self',
          'claude-code:late',
          '--alias',
          'late',
          '--json',
        ])
      ).code,
    ).toBe(3);
    expect(
      (
        await run([
          'join',
          '--root',
          root,
          '--collab',
          collaborationId,
          '--self',
          'claude-code:new',
          '--alias',
          'driver',
          '--succeeds',
          'codex:driver',
          '--reason',
          'late takeover',
          '--json',
        ])
      ).code,
    ).toBe(3);
  });

  test('status reports log digest staleness and fails unsafe closed-marker inspection', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'agent-messaging-cli-'));
    const collaborationId = crypto.randomUUID();
    await run([
      'open',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:driver',
      '--alias',
      'driver',
      '--label',
      'cli',
      '--task',
      'status',
    ]);
    await run(['log', 'render', '--root', root, '--collab', collaborationId]);
    await run([
      'log',
      'append',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:driver',
      '--id',
      crypto.randomUUID(),
      '--category',
      'test',
      '--title',
      'Later',
      '--what',
      'changed',
      '--assessment',
      'stale',
      '--implication',
      'render again',
    ]);
    const status = await run([
      'status',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:driver',
      '--json',
    ]);
    expect(JSON.parse(status.stdout).data.logView).toMatchObject({
      stale: true,
    });
    expect(JSON.parse(status.stdout).data.logView.path).toContain(
      'collaboration.md',
    );
    const marker = path.join(
      root,
      'collaborations',
      collaborationId,
      'closed.json',
    );
    await rm(marker, { force: true });
    await mkdir(marker);
    const unsafe = await run([
      'status',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:driver',
      '--json',
    ]);
    expect(unsafe.code).toBe(1);
    expect(JSON.parse(unsafe.stderr).code).toBe('UNSAFE_PATH');
  });

  test('status presents pre-takeover mail as actionable reassigned work', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'agent-messaging-cli-'));
    const collaborationId = crypto.randomUUID();
    await run([
      'open',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:driver',
      '--alias',
      'driver',
      '--label',
      'cli',
      '--task',
      'replay',
    ]);
    await run([
      'join',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'cursor:old',
      '--alias',
      'reviewer',
    ]);
    const id = crypto.randomUUID();
    await run([
      'send',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'codex:driver',
      '--to',
      'reviewer',
      '--id',
      id,
      '--subject',
      'pending',
      '--body',
      'still actionable',
    ]);
    await run([
      'join',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'cursor:successor',
      '--alias',
      'reviewer',
      '--succeeds',
      'cursor:old',
      '--reason',
      'take over pending work',
    ]);
    const status = await run([
      'status',
      '--root',
      root,
      '--collab',
      collaborationId,
      '--self',
      'cursor:successor',
      '--json',
    ]);
    expect(JSON.parse(status.stdout).data.inbox.messages[0]).toMatchObject({
      id,
      raceStatus: 'recipient-reassigned',
      inert: false,
    });
  });
});
