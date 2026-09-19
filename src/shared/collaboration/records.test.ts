import { spawnSync } from 'node:child_process';
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

import { describe, expect, test } from 'vitest';

import { collaborationPaths, resolveCollaborationRoot } from './paths.js';
import {
  CollaborationError,
  canonicalHash,
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
    const script = String.raw`
      const fs = require('node:fs');
      const [directory, target, stage] = process.argv.slice(1);
      const temporary = directory + '/.kill-' + stage + '.tmp';
      const fd = fs.openSync(temporary, 'wx', 0o600);
      fs.writeFileSync(fd, '{"schemaVersion":1,"id":"killed"}\n');
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      if (stage === 'after') fs.linkSync(temporary, target);
      process.kill(process.pid, 'SIGKILL');
    `;
    const before = path.join(directory, 'before-kill.json');
    const after = path.join(directory, 'after-kill.json');
    expect(
      spawnSync(process.execPath, ['-e', script, directory, before, 'before'])
        .signal,
    ).toBe('SIGKILL');
    expect(
      spawnSync(process.execPath, ['-e', script, directory, after, 'after'])
        .signal,
    ).toBe('SIGKILL');
    await expect(readFile(before)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(JSON.parse(await readFile(after, 'utf8'))).toEqual({
      schemaVersion: 1,
      id: 'killed',
    });
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
