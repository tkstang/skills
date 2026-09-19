import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  joinCollaboration,
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
});
