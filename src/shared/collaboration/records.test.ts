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
