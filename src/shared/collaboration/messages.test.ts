import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  joinCollaboration,
  closeCollaboration,
  resolveMember,
  openCollaboration,
  takeOverMembership,
} from './membership.js';
import {
  acknowledgeMessage,
  listInbox,
  readMessage,
  sendMessage,
} from './messages.js';

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'agent-messaging-mail-'));
  const collaborationId = crypto.randomUUID();
  const driver = { runtime: 'codex' as const, sessionId: 'driver' };
  const reviewer = { runtime: 'claude-code' as const, sessionId: 'reviewer' };
  await openCollaboration({
    root,
    collaborationId,
    alias: 'driver',
    pin: driver,
    worktree: '/tmp/a',
    label: 'mail',
    task: 'test',
  });
  await joinCollaboration({
    root,
    collaborationId,
    alias: 'reviewer',
    pin: reviewer,
    worktree: '/tmp/b',
  });
  return { root, collaborationId, driver, reviewer };
}

describe('addressed messages and acknowledgments', () => {
  test('concurrent senders preserve every immutable recipient message', async () => {
    const f = await fixture();
    const implementer = { runtime: 'cursor' as const, sessionId: 'impl' };
    await joinCollaboration({
      ...f,
      alias: 'implementer',
      pin: implementer,
      worktree: '/tmp/c',
    });
    await Promise.all([
      sendMessage({
        ...f,
        senderPin: f.driver,
        recipientAlias: 'reviewer',
        id: crypto.randomUUID(),
        kind: 'request',
        priority: 'normal',
        subject: 'one',
        body: 'first',
      }),
      sendMessage({
        ...f,
        senderPin: implementer,
        recipientAlias: 'reviewer',
        id: crypto.randomUUID(),
        kind: 'update',
        priority: 'high',
        subject: 'two',
        body: 'second',
      }),
    ]);
    const inbox = await listInbox({ ...f, pin: f.reviewer });
    expect(inbox.messages.map((message) => message.subject)).toEqual([
      'two',
      'one',
    ]);
    expect(inbox.acknowledged).toEqual([]);
  });

  test('same-ID retry is idempotent and conflicting payload is rejected', async () => {
    const f = await fixture();
    const id = crypto.randomUUID();
    const first = await sendMessage({
      ...f,
      senderPin: f.driver,
      recipientAlias: 'reviewer',
      id,
      kind: 'update',
      priority: 'normal',
      subject: 'same',
      body: 'body',
    });
    const retry = await sendMessage({
      ...f,
      senderPin: f.driver,
      recipientAlias: 'reviewer',
      id,
      kind: 'update',
      priority: 'normal',
      subject: 'same',
      body: 'body',
    });
    expect(first.duplicate).toBe(false);
    expect(retry.duplicate).toBe(true);
    await expect(
      sendMessage({
        ...f,
        senderPin: f.driver,
        recipientAlias: 'reviewer',
        id,
        kind: 'update',
        priority: 'normal',
        subject: 'changed',
        body: 'body',
      }),
    ).rejects.toMatchObject({ code: 'RECORD_CONFLICT' });
  });

  test('printing does not ack; explicit recipient ack persists across restart', async () => {
    const f = await fixture();
    const id = crypto.randomUUID();
    await sendMessage({
      ...f,
      senderPin: f.driver,
      recipientAlias: 'reviewer',
      id,
      kind: 'request',
      priority: 'normal',
      subject: 'review',
      body: 'full body',
    });
    expect(
      (await readMessage({ ...f, pin: f.reviewer, messageId: id })).body,
    ).toBe('full body');
    expect((await listInbox({ ...f, pin: f.reviewer })).messages).toHaveLength(
      1,
    );
    await acknowledgeMessage({ ...f, pin: f.reviewer, messageId: id });
    expect((await listInbox({ ...f, pin: f.reviewer })).messages).toHaveLength(
      0,
    );
    expect(
      (await listInbox({ ...f, pin: f.reviewer, includeAcknowledged: true }))
        .acknowledged,
    ).toHaveLength(1);
  });

  test('takeover conservatively replays unacknowledged mail and rejects stale ack', async () => {
    const f = await fixture();
    const id = crypto.randomUUID();
    await sendMessage({
      ...f,
      senderPin: f.driver,
      recipientAlias: 'reviewer',
      id,
      kind: 'request',
      priority: 'normal',
      subject: 'pending',
      body: 'work',
    });
    const successor = {
      runtime: 'claude-code' as const,
      sessionId: 'successor',
    };
    await takeOverMembership({
      ...f,
      alias: 'reviewer',
      pin: successor,
      expectedPreviousPin: f.reviewer,
      reason: 'human directed',
      worktree: '/tmp/new',
    });
    await expect(
      acknowledgeMessage({ ...f, pin: f.reviewer, messageId: id }),
    ).rejects.toMatchObject({ code: 'NOT_CURRENT_MEMBER' });
    expect(
      (await listInbox({ ...f, pin: successor })).messages.map(
        (message) => message.id,
      ),
    ).toEqual([id]);
  });

  test('enforces body limits and recipient identity', async () => {
    const f = await fixture();
    await expect(
      sendMessage({
        ...f,
        senderPin: f.driver,
        recipientAlias: 'reviewer',
        id: crypto.randomUUID(),
        kind: 'update',
        priority: 'normal',
        subject: 'large',
        body: 'x'.repeat(32 * 1024 + 1),
      }),
    ).rejects.toThrow('bounded UTF-8');
    await expect(
      sendMessage({
        ...f,
        senderPin: f.driver,
        recipientAlias: 'missing',
        id: crypto.randomUUID(),
        kind: 'update',
        priority: 'normal',
        subject: 'none',
        body: 'body',
      }),
    ).rejects.toMatchObject({ code: 'MEMBER_NOT_FOUND' });
  });

  test('reports deterministic close and takeover races after publication', async () => {
    const closed = await fixture();
    const closedResult = await sendMessage({
      ...closed,
      senderPin: closed.driver,
      recipientAlias: 'reviewer',
      id: crypto.randomUUID(),
      subject: 'close race',
      body: 'published first',
      hooks: {
        afterPublish: async () => {
          await closeCollaboration({ ...closed, pin: closed.driver });
        },
      },
    });
    expect(closedResult).toMatchObject({
      staleAfterPublish: true,
      raceStatus: 'closed',
    });
    expect(
      (await listInbox({ ...closed, pin: closed.reviewer })).messages[0],
    ).toMatchObject({ inert: true, raceStatus: 'closed' });

    const takeover = await fixture();
    const successor = { runtime: 'cursor' as const, sessionId: 'successor' };
    const takeoverResult = await sendMessage({
      ...takeover,
      senderPin: takeover.driver,
      recipientAlias: 'reviewer',
      id: crypto.randomUUID(),
      subject: 'takeover race',
      body: 'published first',
      hooks: {
        afterPublish: async () => {
          await takeOverMembership({
            ...takeover,
            alias: 'reviewer',
            pin: successor,
            expectedPreviousPin: takeover.reviewer,
            reason: 'race',
            worktree: '/tmp/successor',
          });
        },
      },
    });
    expect(takeoverResult.raceStatus).toBe('recipient-superseded');
    expect(
      (await listInbox({ ...takeover, pin: successor })).messages[0],
    ).toMatchObject({ inert: true, raceStatus: 'recipient-superseded' });
  });

  test('bounds combined pending and acknowledged output and accepts reordered acks', async () => {
    const f = await fixture();
    const ids = Array.from({ length: 10 }, () => crypto.randomUUID());
    for (const [index, id] of ids.entries()) {
      await sendMessage({
        ...f,
        senderPin: f.driver,
        recipientAlias: 'reviewer',
        id,
        subject: `message ${index}`,
        body: 'body',
      });
    }
    await acknowledgeMessage({ ...f, pin: f.reviewer, messageId: ids[1]! });
    await acknowledgeMessage({ ...f, pin: f.reviewer, messageId: ids[0]! });
    const inbox = await listInbox({
      ...f,
      pin: f.reviewer,
      includeAcknowledged: true,
      maxMessages: 8,
    });
    expect(inbox.messages.length + inbox.acknowledged.length).toBe(8);
    expect(inbox).toMatchObject({
      pendingTotal: 8,
      acknowledgedTotal: 2,
      truncated: true,
    });
  });

  test('allows the inbox cap boundary and rejects one over', async () => {
    const f = await fixture();
    const reviewer = await resolveMember(f.root, f.collaborationId, 'reviewer');
    const directory = path.join(
      f.root,
      'collaborations',
      f.collaborationId,
      'inbox',
      reviewer.member.participantId,
    );
    await mkdir(directory, { recursive: true });
    await Promise.all(
      Array.from({ length: 4096 }, (_, index) =>
        writeFile(path.join(directory, `${index}.json`), '{}'),
      ),
    );
    await expect(
      sendMessage({
        ...f,
        senderPin: f.driver,
        recipientAlias: 'reviewer',
        id: crypto.randomUUID(),
        subject: 'overflow',
        body: 'body',
      }),
    ).rejects.toMatchObject({ code: 'CAPACITY_EXCEEDED' });
  }, 20_000);
});
