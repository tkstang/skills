import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  mkdtemp,
  mkdir,
  readFile,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import {
  closeCollaboration,
  joinCollaboration,
  openCollaboration,
} from './membership.js';
import { acknowledgeMessage, listInbox, sendMessage } from './messages.js';
import { collaborationPaths, resolveCollaborationRoot } from './paths.js';
import {
  CollaborationError,
  canonicalHash,
  canonicalRecordHash,
  enumerateJsonRecords,
  publishImmutableRecord,
  readJsonRecord,
} from './records.js';

async function fixture() {
  const home = await mkdtemp(path.join(tmpdir(), 'agent-messaging-records-'));
  return { home, root: path.join(home, 'state') };
}

describe('collaboration storage primitives', () => {
  test('resolves absolute override, XDG, and home roots without fallback merging', () => {
    expect(
      resolveCollaborationRoot({
        SESSION_OBSERVER_STATE_DIR: '/override',
        XDG_STATE_HOME: '/xdg',
        HOME: '/home/test',
      }),
    ).toBe('/override');
    expect(
      resolveCollaborationRoot({ XDG_STATE_HOME: '/xdg', HOME: '/home/test' }),
    ).toBe('/xdg/session-observer/collab');
    expect(resolveCollaborationRoot({ HOME: '/home/test' })).toBe(
      '/home/test/.local/state/session-observer/collab',
    );
    expect(() =>
      resolveCollaborationRoot({ SESSION_OBSERVER_STATE_DIR: 'relative' }),
    ).toThrow('SESSION_OBSERVER_STATE_DIR must be absolute');
  });

  test('publishes one immutable winner and makes identical retries idempotent', async () => {
    const { root } = await fixture();
    const directory = path.join(root, 'records');
    const target = path.join(directory, 'record.json');
    const payload = {
      schemaVersion: 1 as const,
      id: crypto.randomUUID(),
      value: 'same',
    };

    const [first, second] = await Promise.all([
      publishImmutableRecord(target, payload, { root }),
      publishImmutableRecord(target, payload, { root }),
    ]);

    expect([first.created, second.created].toSorted()).toEqual([false, true]);
    expect(JSON.parse(await readFile(target, 'utf8'))).toEqual(payload);
    expect((await stat(target)).mode & 0o777).toBe(0o600);
  });

  test('rejects conflicting IDs, unsupported schemas, symlinks, and oversized input', async () => {
    const { root } = await fixture();
    const target = path.join(root, 'records', 'record.json');
    await publishImmutableRecord(
      target,
      { schemaVersion: 1, id: 'a' },
      { root },
    );
    await expect(
      publishImmutableRecord(target, { schemaVersion: 1, id: 'b' }, { root }),
    ).rejects.toMatchObject({ code: 'RECORD_CONFLICT' });
    await expect(readJsonRecord(target, { maxBytes: 1 })).rejects.toMatchObject(
      {
        code: 'RECORD_TOO_LARGE',
      },
    );
    await writeFile(path.join(root, 'bad.json'), '{"schemaVersion":2}');
    await expect(
      readJsonRecord(path.join(root, 'bad.json')),
    ).rejects.toMatchObject({
      code: 'UNKNOWN_SCHEMA',
    });
    await symlink(target, path.join(root, 'linked.json'));
    await expect(
      readJsonRecord(path.join(root, 'linked.json')),
    ).rejects.toMatchObject({
      code: 'UNSAFE_PATH',
    });
    await expect(
      readJsonRecord(target, { expectedUid: (process.getuid?.() ?? 0) + 1 }),
    ).rejects.toMatchObject({ code: 'UNSAFE_PATH' });
  });

  test('validates every authoritative schema-v1 record shape', async () => {
    const { root } = await fixture();
    const collaborationId = crypto.randomUUID();
    const participantId = crypto.randomUUID();
    const messageId = crypto.randomUUID();
    const entryId = crypto.randomUUID();
    const paths = collaborationPaths(root, collaborationId);
    const files = [
      paths.collaboration,
      path.join(paths.members, 'driver.json'),
      path.join(paths.bindings, participantId, '0.json'),
      path.join(paths.departures, participantId, '0.json'),
      path.join(paths.inbox, participantId, `${messageId}.json`),
      path.join(paths.acknowledgments, participantId, '0', `${messageId}.json`),
      path.join(paths.logEntries, `${entryId}.json`),
      paths.closed,
    ];
    for (const file of files) {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, '{"schemaVersion":1}\n');
      await expect(readJsonRecord(file), file).rejects.toMatchObject({
        code: 'MALFORMED_RECORD',
      });
    }
  });

  test('rejects valid-shape forged binding, closure, and acknowledgment records', async () => {
    const bindingFixture = await fixture();
    const bindingCollaboration = crypto.randomUUID();
    const driver = { runtime: 'codex' as const, sessionId: 'driver' };
    const opened = await openCollaboration({
      root: bindingFixture.root,
      collaborationId: bindingCollaboration,
      alias: 'driver',
      pin: driver,
      worktree: '/tmp/driver',
      label: 'integrity',
      task: 'reject corruption',
    });
    const bindingFile = path.join(
      collaborationPaths(bindingFixture.root, bindingCollaboration).bindings,
      opened.member.member.participantId,
      '0.json',
    );
    const forgedBinding = JSON.parse(await readFile(bindingFile, 'utf8'));
    forgedBinding.reason = 'forged';
    await writeFile(bindingFile, `${JSON.stringify(forgedBinding)}\n`);
    await expect(readJsonRecord(bindingFile)).rejects.toMatchObject({
      code: 'MALFORMED_RECORD',
    });

    const closedFixture = await fixture();
    const closedCollaboration = crypto.randomUUID();
    await openCollaboration({
      root: closedFixture.root,
      collaborationId: closedCollaboration,
      alias: 'driver',
      pin: driver,
      worktree: '/tmp/driver',
      label: 'closed integrity',
      task: 'reject closure corruption',
    });
    await closeCollaboration({
      root: closedFixture.root,
      collaborationId: closedCollaboration,
      pin: driver,
    });
    const closedFile = collaborationPaths(
      closedFixture.root,
      closedCollaboration,
    ).closed;
    const forgedClosed = JSON.parse(await readFile(closedFile, 'utf8'));
    forgedClosed.closedAt = '2020-01-01T00:00:00.000Z';
    await writeFile(closedFile, `${JSON.stringify(forgedClosed)}\n`);
    await expect(readJsonRecord(closedFile)).rejects.toMatchObject({
      code: 'MALFORMED_RECORD',
    });

    const ackFixture = await fixture();
    const ackCollaboration = crypto.randomUUID();
    const reviewer = { runtime: 'cursor' as const, sessionId: 'reviewer' };
    await openCollaboration({
      root: ackFixture.root,
      collaborationId: ackCollaboration,
      alias: 'driver',
      pin: driver,
      worktree: '/tmp/driver',
      label: 'ack integrity',
      task: 'reject receipt corruption',
    });
    const joined = await joinCollaboration({
      root: ackFixture.root,
      collaborationId: ackCollaboration,
      alias: 'reviewer',
      pin: reviewer,
      worktree: '/tmp/reviewer',
    });
    const messageId = crypto.randomUUID();
    await sendMessage({
      root: ackFixture.root,
      collaborationId: ackCollaboration,
      senderPin: driver,
      recipientAlias: 'reviewer',
      id: messageId,
      subject: 'ack me',
      body: 'body',
    });
    await acknowledgeMessage({
      root: ackFixture.root,
      collaborationId: ackCollaboration,
      pin: reviewer,
      messageId,
    });
    const ackFile = path.join(
      collaborationPaths(ackFixture.root, ackCollaboration).acknowledgments,
      joined.member.member.participantId,
      '0',
      `${messageId}.json`,
    );
    const forgedAck = JSON.parse(await readFile(ackFile, 'utf8'));
    forgedAck.messageHash = '0'.repeat(64);
    forgedAck.contentHash = canonicalRecordHash(forgedAck);
    await writeFile(ackFile, `${JSON.stringify(forgedAck)}\n`);
    await expect(
      listInbox({
        root: ackFixture.root,
        collaborationId: ackCollaboration,
        pin: reviewer,
        includeAcknowledged: true,
      }),
    ).rejects.toMatchObject({ code: 'MALFORMED_RECORD' });
  });

  test('reports publication-stage failures and preserves retry semantics', async () => {
    const { root } = await fixture();
    const beforeTarget = path.join(root, 'records', 'before.json');
    const record = { schemaVersion: 1 as const, id: crypto.randomUUID() };
    await expect(
      publishImmutableRecord(beforeTarget, record, {
        root,
        hooks: { afterFileSync: () => Promise.reject(new Error('fault')) },
      }),
    ).rejects.toThrow('fault');
    await expect(readFile(beforeTarget)).rejects.toMatchObject({
      code: 'ENOENT',
    });

    const afterTarget = path.join(root, 'records', 'after.json');
    await expect(
      publishImmutableRecord(afterTarget, record, {
        root,
        hooks: { afterLink: () => Promise.reject(new Error('fault')) },
      }),
    ).rejects.toMatchObject({ code: 'COMMIT_UNCERTAIN' });
    expect(
      (await publishImmutableRecord(afterTarget, record, { root })).created,
    ).toBe(false);
    const syncTarget = path.join(root, 'records', 'sync.json');
    await expect(
      publishImmutableRecord(syncTarget, record, {
        root,
        hooks: {
          beforeDirectorySync: () => Promise.reject(new Error('sync fault')),
        },
      }),
    ).rejects.toMatchObject({ code: 'COMMIT_UNCERTAIN' });
    expect(
      (await publishImmutableRecord(syncTarget, record, { root })).created,
    ).toBe(false);
  });

  test('survives process termination before and after publication', async () => {
    const { root } = await fixture();
    const directory = path.join(root, 'records');
    await mkdir(directory, { recursive: true });
    const helper = fileURLToPath(
      new URL('./process-fixture.ts', import.meta.url),
    );
    for (const [stage, visible] of [
      ['afterFileSync', false],
      ['afterLink', true],
      ['beforeDirectorySync', true],
    ] as const) {
      const target = path.join(directory, `${stage}.json`);
      const record = { schemaVersion: 1 as const, id: crypto.randomUUID() };
      const child = spawn(
        process.execPath,
        [
          '--import',
          'tsx',
          helper,
          'publish',
          JSON.stringify({ root, target, id: record.id, stage }),
        ],
        { stdio: ['pipe', 'pipe', 'pipe'] },
      );
      await once(child.stdout!, 'data');
      child.kill('SIGKILL');
      const [, signal] = await once(child, 'exit');
      expect(signal).toBe('SIGKILL');
      if (visible)
        expect(JSON.parse(await readFile(target, 'utf8'))).toEqual(record);
      else
        await expect(readFile(target)).rejects.toMatchObject({
          code: 'ENOENT',
        });
      expect(
        (await publishImmutableRecord(target, record, { root })).created,
      ).toBe(!visible);
    }
  });

  test('bounds enumeration and ignores private temporary siblings', async () => {
    const { root } = await fixture();
    const directory = path.join(root, 'records');
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'a.json'), '{"schemaVersion":1}');
    await writeFile(path.join(directory, '.record.tmp-dead'), 'partial');
    expect(await enumerateJsonRecords(directory, { maxEntries: 1 })).toEqual([
      path.join(directory, 'a.json'),
    ]);
    await writeFile(path.join(directory, 'b.json'), '{"schemaVersion":1}');
    await expect(
      enumerateJsonRecords(directory, { maxEntries: 1 }),
    ).rejects.toMatchObject({ code: 'CAPACITY_EXCEEDED' });
  });

  test('uses canonical hashes and path-safe collaboration IDs', async () => {
    expect(canonicalHash({ b: 2, a: 1 })).toBe(canonicalHash({ a: 1, b: 2 }));
    const id = crypto.randomUUID();
    expect(collaborationPaths('/root', id).directory).toBe(
      path.join('/root', 'collaborations', id),
    );
    expect(() => collaborationPaths('/root', '../escape')).toThrow(
      CollaborationError,
    );
  });
});
