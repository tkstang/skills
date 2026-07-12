import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import {
  arm,
  disarm,
  install,
  run,
  status,
} from '../../skills/session-observer-collab/scripts/collab-control.mjs';
import {
  compareAndSwapTrigger,
  effectiveLease,
  leasePath,
  pruneLeases,
  readLease,
  stateRoot,
} from '../../skills/session-observer-collab/scripts/lib/lease-state.mjs';
import {
  beginAdapterWait,
  claimAdapterTrigger,
  defineRuntimeAdapter,
  inspectAdapterLease,
} from '../../skills/session-observer-collab/scripts/lib/runtime-adapter.mjs';

const roots: string[] = [];
async function fixture() {
  const home = await mkdtemp(join(tmpdir(), 'collab-control-'));
  roots.push(home);
  const root = stateRoot({ HOME: home } as NodeJS.ProcessEnv);
  const cwd = join(home, 'work');
  const transcript = join(home, 'peer.jsonl');
  await mkdir(cwd);
  await writeFile(transcript, '{}\n');
  return { home, root, cwd, transcript };
}
afterEach(async () =>
  Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  ),
);

function options(cwd: string, transcript: string) {
  return {
    runtime: 'codex',
    session: 'owner-1',
    peerSession: 'peer-1',
    cwd,
    peerTranscript: transcript,
    leaseMs: '60000',
    continuationCap: '2',
  };
}

describe('collaboration lease controls', () => {
  test('install and arm are idempotent and owner-only', async () => {
    const { root, cwd, transcript } = await fixture();
    expect(
      (await install(root, { runtime: 'codex', command: '/usr/bin/node' }))
        .changed,
    ).toBe(true);
    expect(
      (await install(root, { runtime: 'codex', command: '/usr/bin/node' }))
        .changed,
    ).toBe(false);
    expect(
      (await arm(root, options(cwd, transcript), 1_700_000_000_000)).changed,
    ).toBe(true);
    expect(
      (await arm(root, options(cwd, transcript), 1_700_000_000_100)).changed,
    ).toBe(false);
    expect((await stat(root)).mode & 0o777).toBe(0o700);
    expect((await stat(leasePath(root, 'owner-1'))).mode & 0o777).toBe(0o600);
  });

  test('migrates v1 and fails closed for malformed or unsupported data', async () => {
    const { root } = await fixture();
    await mkdir(join(root, 'leases'), { recursive: true });
    const old = JSON.parse(
      await readFile(
        join(import.meta.dirname, 'fixtures/lease-v1.json'),
        'utf8',
      ),
    );
    old.ownerCwd = '/workspace/example';
    await writeFile(leasePath(root, 'owner-session'), JSON.stringify(old));
    await chmod(leasePath(root, 'owner-session'), 0o600);
    expect((await readLease(root, 'owner-session'))?.schemaVersion).toBe(2);
    await writeFile(leasePath(root, 'owner-session'), '{bad');
    await chmod(leasePath(root, 'owner-session'), 0o600);
    await expect(readLease(root, 'owner-session')).rejects.toMatchObject({
      code: 'malformed-lease',
    });
    await writeFile(
      leasePath(root, 'owner-session'),
      JSON.stringify({ schemaVersion: 99 }),
    );
    await chmod(leasePath(root, 'owner-session'), 0o600);
    await expect(readLease(root, 'owner-session')).rejects.toMatchObject({
      code: 'unsupported-schema',
    });
  });

  test('reports truthful states and disarms idempotently', async () => {
    const { root, cwd, transcript } = await fixture();
    const armed = await arm(root, options(cwd, transcript), 1_000);
    expect(armed.lease.state).toBe('armed');
    expect(
      effectiveLease((await readLease(root, 'owner-1'))!, 2_000).state,
    ).toBe('armed');
    expect((await status(root, 'owner-1', 2_000)).lease?.state).toBe('armed');
    expect((await status(root, 'owner-1', 62_000)).lease?.state).toBe('idle');
    expect((await disarm(root, 'owner-1', 2_000)).changed).toBe(true);
    expect((await disarm(root, 'owner-1', 3_000)).changed).toBe(false);
    expect((await disarm(root, 'missing', 3_000)).changed).toBe(false);
  });

  test('CAS accepts one claimant and benignly rejects stale claims', async () => {
    const { root, cwd, transcript } = await fixture();
    await arm(root, options(cwd, transcript), 1_000);
    const expected = { peerCursor: 0, continuationCount: 0, loopCount: 0 };
    const claims = await Promise.all([
      compareAndSwapTrigger(
        root,
        'owner-1',
        expected,
        { peerCursor: 4 },
        2_000,
      ),
      compareAndSwapTrigger(
        root,
        'owner-1',
        expected,
        { peerCursor: 4 },
        2_000,
      ),
    ]);
    expect(claims.filter((claim) => claim.ok)).toHaveLength(1);
    expect(claims.filter((claim) => !claim.ok)).toHaveLength(1);
    expect((await readLease(root, 'owner-1'))?.continuationCount).toBe(1);
  });

  test('prunes only unambiguously owned expired or missing-resource leases', async () => {
    const { root, cwd, transcript } = await fixture();
    await arm(root, options(cwd, transcript), 1_000);
    await writeFile(join(root, 'leases', 'ambiguous.json'), '{bad');
    expect(await pruneLeases(root, { now: 62_000 })).toEqual(['owner-1']);
    expect(await readFile(join(root, 'leases', 'ambiguous.json'), 'utf8')).toBe(
      '{bad',
    );
  });

  test('exports a complete adapter contract and validates identity before CAS', async () => {
    const { root, cwd, transcript } = await fixture();
    await arm(root, options(cwd, transcript), 1_000);
    const adapter = defineRuntimeAdapter({
      runtime: 'codex',
      identify() {},
      emit() {},
    });
    expect(adapter.version).toBe(1);
    const invocation = {
      runtime: 'codex',
      ownerSession: 'owner-1',
      cwd,
      transcript,
      now: 2_000,
    };
    const waits = await Promise.all([
      beginAdapterWait(root, invocation),
      beginAdapterWait(root, invocation),
    ]);
    expect(waits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          waiting: true,
          changed: true,
          reason: 'waiting',
          lease: expect.objectContaining({ state: 'waiting' }),
        }),
        expect.objectContaining({
          waiting: false,
          changed: false,
          reason: 'conflict',
          lease: null,
        }),
      ]),
    );
    expect((await readLease(root, 'owner-1'))?.state).toBe('waiting');
    expect((await inspectAdapterLease(root, invocation)).eligible).toBe(true);
    expect(
      (
        await claimAdapterTrigger(
          root,
          invocation,
          { peerCursor: 0, continuationCount: 0, loopCount: 0 },
          { peerCursor: 3 },
        )
      ).triggered,
    ).toBe(true);
    expect(
      (
        await inspectAdapterLease(root, {
          ...invocation,
          cwd: join(cwd, 'wrong'),
        })
      ).reason,
    ).toBe('identity-mismatch');
  });

  test('expiry and caps make armed or waiting leases truthfully idle', async () => {
    const { root, cwd, transcript } = await fixture();
    await arm(root, options(cwd, transcript), 1_000);
    expect((await status(root, 'owner-1', 62_000)).lease).toMatchObject({
      state: 'idle',
      diagnostic: 'lease-expired',
    });

    await arm(
      root,
      { ...options(cwd, transcript), continuationCap: '1' },
      100_000,
    );
    await compareAndSwapTrigger(
      root,
      'owner-1',
      { peerCursor: 0, continuationCount: 0, loopCount: 0 },
      { peerCursor: 1, terminal: false },
      101_000,
    );
    expect((await status(root, 'owner-1', 102_000)).lease).toMatchObject({
      state: 'idle',
      diagnostic: 'cap-reached',
    });
  });

  test('CLI run is JSON-ready and rejects unsafe session paths', async () => {
    const { home, cwd, transcript } = await fixture();
    const result = await run(
      [
        'arm',
        '--runtime',
        'codex',
        '--session',
        'owner-1',
        '--peer-session',
        'peer-1',
        '--cwd',
        cwd,
        '--peer-transcript',
        transcript,
      ],
      { HOME: home },
      1_000,
    );
    expect(result).toMatchObject({ ok: true, command: 'arm', changed: true });
    await expect(
      run(['status', '--session', '../escape'], { HOME: home }),
    ).rejects.toMatchObject({ code: 'invalid-owner-session' });
  });
});
