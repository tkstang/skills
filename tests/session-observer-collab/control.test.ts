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
  assessCodexHookReadiness,
  installCodexStopHook,
  uninstallCodexStopHook,
} from '../../skills/session-observer-collab/scripts/codex-lifecycle.mjs';
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
  finishAdapterWait,
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
    peerRuntime: 'cursor',
    session: 'owner-1',
    peerSession: 'peer-1',
    cwd,
    peerTranscript: transcript,
    leaseMs: '60000',
    continuationCap: '2',
  };
}

describe('collaboration lease controls', () => {
  test('installs the exact Codex Stop command without replacing unrelated hooks', async () => {
    const { home } = await fixture();
    const hooksPath = join(home, '.codex', 'hooks.json');
    const scriptPath = join(
      home,
      '.codex',
      'hooks',
      'session-observer-collab-stop.mjs',
    );
    const unrelated = {
      hooks: {
        Stop: [
          {
            hooks: [
              {
                type: 'command',
                command: 'node /tmp/unrelated-stop.mjs',
                timeout: 10,
              },
            ],
          },
        ],
        SessionStart: [
          { hooks: [{ type: 'command', command: 'node /tmp/start.mjs' }] },
        ],
      },
    };
    await mkdir(join(home, '.codex'), { recursive: true });
    await writeFile(hooksPath, JSON.stringify(unrelated));

    const first = await installCodexStopHook({ hooksPath, scriptPath });
    const second = await installCodexStopHook({ hooksPath, scriptPath });
    const written = JSON.parse(await readFile(hooksPath, 'utf8'));

    expect(first).toMatchObject({
      changed: true,
      exactCommand: `node ${scriptPath}`,
    });
    expect(second).toMatchObject({ changed: false });
    expect(written.hooks.SessionStart).toEqual(unrelated.hooks.SessionStart);
    expect(written.hooks.Stop[0]).toEqual(unrelated.hooks.Stop[0]);
    expect(
      written.hooks.Stop.flatMap((group: { hooks: unknown[] }) => group.hooks),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: `node ${scriptPath}`,
          statusMessage: 'Checking for Session Observer peer activity',
        }),
      ]),
    );
  });

  test('reports trust, explicit disablement, and effective execution as separate Codex facts', async () => {
    const { home } = await fixture();
    const scriptPath = join(
      home,
      '.codex',
      'hooks',
      'session-observer-collab-stop.mjs',
    );
    const exactCommand = `node ${scriptPath}`;
    const hooks = {
      hooks: {
        Stop: [{ hooks: [{ type: 'command', command: exactCommand }] }],
      },
    };

    expect(
      assessCodexHookReadiness({
        scriptPath,
        hooks,
        trustRecords: [{ command: exactCommand, trusted: true }],
        hookStatuses: [
          { command: exactCommand, lastRanAt: '2026-07-12T12:00:00.000Z' },
        ],
      }),
    ).toMatchObject({
      installed: true,
      trusted: 'trusted',
      enablement: 'not-explicitly-disabled',
      effectiveExecution: 'observed',
      mayArm: true,
    });
    expect(
      assessCodexHookReadiness({
        scriptPath,
        hooks,
        trustRecords: [{ command: exactCommand, trusted: true }],
        hookStatuses: [
          {
            command: exactCommand,
            enabled: false,
            lastRanAt: '2026-07-12T12:00:00.000Z',
          },
        ],
      }),
    ).toMatchObject({ enablement: 'disabled', mayArm: false });
    expect(
      assessCodexHookReadiness({
        scriptPath,
        hooks,
        trustRecords: [{ command: 'node /other/script.mjs', trusted: true }],
        hookStatuses: [
          {
            command: 'node /other/script.mjs',
            lastRanAt: '2026-07-12T12:00:00.000Z',
          },
        ],
      }),
    ).toMatchObject({
      trusted: 'unverified',
      effectiveExecution: 'unverified',
      mayArm: false,
    });
  });

  test('uninstalls only the confirmed exact Codex hook after all leases are disarmed', async () => {
    const { home } = await fixture();
    const hooksPath = join(home, '.codex', 'hooks.json');
    const scriptPath = join(
      home,
      '.codex',
      'hooks',
      'session-observer-collab-stop.mjs',
    );
    await installCodexStopHook({ hooksPath, scriptPath });
    await expect(
      uninstallCodexStopHook({ hooksPath, scriptPath, confirmed: false }),
    ).rejects.toThrow('explicit confirmation');
    await expect(
      uninstallCodexStopHook({
        hooksPath,
        scriptPath,
        confirmed: true,
        activeLeaseCount: 1,
      }),
    ).rejects.toThrow('active collaboration leases');

    const result = await uninstallCodexStopHook({
      hooksPath,
      scriptPath,
      confirmed: true,
      activeLeaseCount: 0,
    });
    expect(result).toMatchObject({ changed: true, removed: 1 });
    expect(JSON.parse(await readFile(hooksPath, 'utf8')).hooks.Stop).toEqual(
      [],
    );
  });

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

  test('concurrent installs retain every distinct runtime registration', async () => {
    const { root } = await fixture();
    await Promise.all([
      install(root, { runtime: 'codex', command: '/usr/bin/node' }),
      install(root, { runtime: 'cursor', command: '/bin/sh' }),
    ]);
    expect((await status(root)).installation.runtimes).toEqual({
      codex: { command: '/usr/bin/node' },
      cursor: { command: '/bin/sh' },
    });
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
    expect(await readLease(root, 'owner-session')).toMatchObject({
      schemaVersion: 4,
      peerRuntime: 'claude-code',
      leaseMs: 60_000,
    });
    const missingPeerRuntime = { ...old };
    delete missingPeerRuntime.peerRuntime;
    await writeFile(
      leasePath(root, 'owner-session'),
      JSON.stringify(missingPeerRuntime),
    );
    await chmod(leasePath(root, 'owner-session'), 0o600);
    await expect(readLease(root, 'owner-session')).rejects.toMatchObject({
      code: 'peer-runtime-rearm-required',
      message: 'legacy lease is missing peerRuntime; re-arm required',
    });
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
    expect((await status(root, 'owner-1', 62_000)).lease).toBeNull();
    await arm(root, options(cwd, transcript), 63_000);
    expect((await disarm(root, 'owner-1', 64_000)).changed).toBe(true);
    expect((await disarm(root, 'owner-1', 65_000)).changed).toBe(false);
    expect((await disarm(root, 'missing', 65_000)).changed).toBe(false);
  });

  test('CAS accepts one claimant and benignly rejects stale claims', async () => {
    const { root, cwd, transcript } = await fixture();
    await arm(root, options(cwd, transcript), 1_000);
    const lease = (await readLease(root, 'owner-1'))!;
    const expected = {
      leaseId: lease.leaseId,
      peerCursor: 0,
      continuationCount: 0,
      loopCount: 0,
    };
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

  test('prunes capped leases and only targeted disarmed leases', async () => {
    const { root, cwd, transcript } = await fixture();
    const capped = await arm(
      root,
      {
        ...options(cwd, transcript),
        session: 'capped',
        continuationCap: '1',
      },
      1_000,
    );
    await compareAndSwapTrigger(
      root,
      'capped',
      {
        leaseId: capped.lease.leaseId,
        peerCursor: 0,
        continuationCount: 0,
        loopCount: 0,
      },
      { peerCursor: 1, terminal: false },
      2_000,
    );
    await arm(
      root,
      { ...options(cwd, transcript), session: 'disarmed' },
      1_000,
    );
    await disarm(root, 'disarmed', 2_000);

    expect(await pruneLeases(root, { now: 3_000 })).toEqual(['capped']);
    expect((await readLease(root, 'disarmed'))?.state).toBe('disarmed');
    expect(
      await pruneLeases(root, { now: 3_000, ownerSession: 'disarmed' }),
    ).toEqual(['disarmed']);
  });

  test('status cleanup is scoped and leaves malformed and unrelated leases untouched', async () => {
    const { root, cwd, transcript } = await fixture();
    await arm(root, options(cwd, transcript), 1_000);
    await arm(
      root,
      { ...options(cwd, transcript), session: 'unrelated' },
      1_000,
    );
    await writeFile(join(root, 'leases', 'ambiguous.json'), '{bad');

    expect((await status(root, 'owner-1', 62_000)).lease).toBeNull();
    expect(await readLease(root, 'unrelated')).not.toBeNull();
    expect(await readFile(join(root, 'leases', 'ambiguous.json'), 'utf8')).toBe(
      '{bad',
    );

    await arm(
      root,
      { ...options(cwd, transcript), session: 'install-target' },
      63_000,
    );
    await disarm(root, 'install-target', 64_000);
    await run(
      [
        'install',
        '--runtime',
        'codex',
        '--command',
        '/usr/bin/node',
        '--session',
        'install-target',
      ],
      { SESSION_OBSERVER_STATE_DIR: root },
      65_000,
    );
    expect(await readLease(root, 'install-target')).toBeNull();
    expect(await readLease(root, 'unrelated')).not.toBeNull();
  });

  test('exports a complete adapter contract and validates identity before CAS', async () => {
    const { root, cwd, transcript } = await fixture();
    await arm(root, options(cwd, transcript), 1_000);
    const adapter = defineRuntimeAdapter({
      runtime: 'codex',
      identify() {},
      emit() {},
    });
    expect(adapter.version).toBe(2);
    const invocation = {
      runtime: 'codex',
      peerRuntime: 'cursor',
      peerSession: 'peer-1',
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
        expect.objectContaining({ waiting: true, changed: true }),
        expect.objectContaining({ waiting: true, changed: false }),
      ]),
    );
    expect((await readLease(root, 'owner-1'))?.state).toBe('waiting');
    expect((await inspectAdapterLease(root, invocation)).eligible).toBe(true);
    expect(
      (
        await claimAdapterTrigger(
          root,
          invocation,
          {
            leaseId: waits[0].lease!.leaseId,
            peerCursor: 0,
            continuationCount: 0,
            loopCount: 0,
          },
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
    expect(
      effectiveLease((await readLease(root, 'owner-1'))!, 62_000),
    ).toMatchObject({
      state: 'idle',
      diagnostic: 'lease-expired',
    });
    expect((await status(root, 'owner-1', 62_000)).lease).toBeNull();

    await arm(
      root,
      { ...options(cwd, transcript), continuationCap: '1' },
      100_000,
    );
    const lease = (await readLease(root, 'owner-1'))!;
    await compareAndSwapTrigger(
      root,
      'owner-1',
      {
        leaseId: lease.leaseId,
        peerCursor: 0,
        continuationCount: 0,
        loopCount: 0,
      },
      { peerCursor: 1, terminal: false },
      101_000,
    );
    expect(
      effectiveLease((await readLease(root, 'owner-1'))!, 102_000),
    ).toMatchObject({
      state: 'idle',
      diagnostic: 'cap-reached',
    });
    expect((await status(root, 'owner-1', 102_000)).lease).toBeNull();
  });

  test('bounds waiting by its stored deadline and clears timing on terminal paths', async () => {
    const { root, cwd, transcript } = await fixture();
    const armed = await arm(
      root,
      { ...options(cwd, transcript), waitMs: '5000' },
      1_000,
    );
    expect(armed.lease).toMatchObject({
      waitStartedAt: null,
      waitDeadlineAt: null,
    });
    const invocation = {
      runtime: 'codex',
      peerRuntime: 'cursor',
      peerSession: 'peer-1',
      ownerSession: 'owner-1',
      cwd,
      transcript,
      now: 2_000,
    };
    const waiting = await beginAdapterWait(root, invocation);
    expect(waiting.lease).toMatchObject({
      state: 'waiting',
      waitStartedAt: new Date(2_000).toISOString(),
      waitDeadlineAt: new Date(7_000).toISOString(),
    });
    expect(
      effectiveLease((await readLease(root, 'owner-1'))!, 7_000),
    ).toMatchObject({
      state: 'idle',
      diagnostic: 'wait-timeout',
      waitStartedAt: null,
      waitDeadlineAt: null,
    });

    const expected = {
      leaseId: waiting.lease!.leaseId,
      peerCursor: 0,
      continuationCount: 0,
      loopCount: 0,
    };
    expect(
      await finishAdapterWait(root, { ...invocation, now: 7_000 }, expected),
    ).toMatchObject({
      finished: true,
      lease: { waitStartedAt: null, waitDeadlineAt: null },
    });

    await arm(root, options(cwd, transcript), 8_000);
    const nextWait = await beginAdapterWait(root, {
      ...invocation,
      now: 9_000,
    });
    await disarm(root, 'owner-1', 10_000);
    expect(await readLease(root, 'owner-1')).toMatchObject({
      state: 'disarmed',
      waitStartedAt: null,
      waitDeadlineAt: null,
    });

    const rearmed = await arm(
      root,
      { ...options(cwd, transcript), cursor: '1' },
      11_000,
    );
    expect(rearmed.lease).toMatchObject({
      state: 'armed',
      waitStartedAt: null,
      waitDeadlineAt: null,
    });
    const triggerWait = await beginAdapterWait(root, {
      ...invocation,
      now: 12_000,
    });
    expect(
      await compareAndSwapTrigger(
        root,
        'owner-1',
        {
          leaseId: triggerWait.lease!.leaseId,
          peerCursor: 1,
          continuationCount: 0,
          loopCount: 0,
        },
        { peerCursor: 2 },
        13_000,
      ),
    ).toMatchObject({
      ok: true,
      lease: { waitStartedAt: null, waitDeadlineAt: null },
    });
    expect(nextWait.waiting).toBe(true);

    await arm(
      root,
      {
        ...options(cwd, transcript),
        session: 'owner-bounded',
        waitMs: '5000',
        leaseMs: '3000',
      },
      20_000,
    );
    expect(
      await beginAdapterWait(root, {
        ...invocation,
        ownerSession: 'owner-bounded',
        now: 21_000,
      }),
    ).toMatchObject({
      waiting: true,
      lease: {
        waitStartedAt: new Date(21_000).toISOString(),
        waitDeadlineAt: new Date(23_000).toISOString(),
      },
    });
  });

  test('CLI run is JSON-ready and rejects unsafe session paths', async () => {
    const { home, cwd, transcript } = await fixture();
    const result = await run(
      [
        'arm',
        '--runtime',
        'codex',
        '--peer-runtime',
        'cursor',
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
      run(
        [
          'arm',
          '--runtime',
          'codex',
          '--session',
          'owner-2',
          '--peer-session',
          'peer-1',
          '--cwd',
          cwd,
          '--peer-transcript',
          transcript,
        ],
        { HOME: home },
      ),
    ).rejects.toMatchObject({ code: 'invalid-peer-runtime' });
    await expect(
      run(['status', '--session', '../escape'], { HOME: home }),
    ).rejects.toMatchObject({ code: 'invalid-owner-session' });
  });

  test('changed arm requests create new generations and stale claims cannot overwrite them', async () => {
    const { root, cwd, transcript } = await fixture();
    const first = await arm(root, options(cwd, transcript), 1_000);
    const expected = {
      leaseId: first.lease.leaseId,
      peerCursor: first.lease.peerCursor,
      continuationCount: first.lease.continuationCount,
      loopCount: first.lease.loopCount,
    };
    const second = await arm(
      root,
      { ...options(cwd, transcript), cursor: '4' },
      2_000,
    );
    expect(second.changed).toBe(true);
    expect(second.lease.leaseId).not.toBe(first.lease.leaseId);
    await expect(
      compareAndSwapTrigger(
        root,
        'owner-1',
        expected,
        { peerCursor: 5 },
        3_000,
      ),
    ).resolves.toMatchObject({ ok: false, reason: 'stale' });
    expect(await readLease(root, 'owner-1')).toMatchObject({
      leaseId: second.lease.leaseId,
      peerCursor: 4,
      continuationCount: 0,
    });

    const changedRequests = [
      { waitMs: '6000' },
      { leaseMs: '59000' },
      { continuationCap: '3' },
      { loopCap: '3' },
      { runtime: 'cursor' },
      { peerRuntime: 'codex' },
      { peerSession: 'peer-2' },
      { cwd: join(cwd, 'other') },
      { peerTranscript: join(cwd, 'other.jsonl') },
    ];
    let generation = second.lease.leaseId;
    for (const change of changedRequests) {
      const result = await arm(
        root,
        { ...options(cwd, transcript), ...change },
        4_000,
      );
      expect(result.changed).toBe(true);
      expect(result.lease.leaseId).not.toBe(generation);
      expect(
        (await arm(root, { ...options(cwd, transcript), ...change }, 4_100))
          .changed,
      ).toBe(false);
      generation = result.lease.leaseId;
    }
  });

  test('stale claims and wait finishes cannot overwrite disarm or re-arm', async () => {
    const { root, cwd, transcript } = await fixture();
    const first = await arm(root, options(cwd, transcript), 1_000);
    const invocation = {
      runtime: 'codex',
      peerRuntime: 'cursor',
      peerSession: 'peer-1',
      ownerSession: 'owner-1',
      cwd,
      transcript,
      now: 2_000,
    };
    const waiting = await beginAdapterWait(root, invocation);
    const expected = {
      leaseId: first.lease.leaseId,
      peerCursor: 0,
      continuationCount: 0,
      loopCount: 0,
    };
    const [, claim] = await Promise.all([
      disarm(root, 'owner-1', 3_000),
      claimAdapterTrigger(root, { ...invocation, now: 4_000 }, expected, {
        peerCursor: 1,
      }),
    ]);
    expect(claim.triggered === true || claim.reason === 'user-disarmed').toBe(
      true,
    );
    expect(await readLease(root, 'owner-1')).toMatchObject({
      state: 'disarmed',
      diagnostic: 'user-disarmed',
    });

    const [rearmed, finish] = await Promise.all([
      arm(root, { ...options(cwd, transcript), waitMs: '6000' }, 5_000),
      finishAdapterWait(
        root,
        { ...invocation, now: 6_000 },
        expected,
        'wait-timeout',
      ),
    ]);
    expect(rearmed.lease.leaseId).not.toBe(first.lease.leaseId);
    expect(finish.finished).toBe(false);
    expect(waiting.waiting).toBe(true);
    expect(await readLease(root, 'owner-1')).toMatchObject({
      leaseId: rearmed.lease.leaseId,
      state: 'armed',
      diagnostic: null,
    });
  });

  test('finish waiting is generation-safe and records its timeout diagnostic', async () => {
    const { root, cwd, transcript } = await fixture();
    await arm(root, options(cwd, transcript), 1_000);
    const invocation = {
      runtime: 'codex',
      peerRuntime: 'cursor',
      peerSession: 'peer-1',
      ownerSession: 'owner-1',
      cwd,
      transcript,
      now: 2_000,
    };
    const waiting = await beginAdapterWait(root, invocation);
    const lease = waiting.lease!;
    expect(
      await finishAdapterWait(
        root,
        { ...invocation, peerSession: 'wrong-peer', now: 2_500 },
        {
          leaseId: lease.leaseId,
          peerCursor: lease.peerCursor,
          continuationCount: lease.continuationCount,
          loopCount: lease.loopCount,
        },
      ),
    ).toMatchObject({ finished: false, reason: 'identity-mismatch' });
    expect(
      await finishAdapterWait(
        root,
        { ...invocation, now: 3_000 },
        {
          leaseId: lease.leaseId,
          peerCursor: lease.peerCursor,
          continuationCount: lease.continuationCount,
          loopCount: lease.loopCount,
        },
        'wait-timeout',
      ),
    ).toMatchObject({
      finished: true,
      reason: 'wait-timeout',
      lease: { state: 'idle', diagnostic: 'wait-timeout' },
    });
  });

  test('validates the exact runtime and session peer pin', async () => {
    const { root, cwd, transcript } = await fixture();
    await arm(root, options(cwd, transcript), 1_000);
    const invocation = {
      runtime: 'codex',
      peerRuntime: 'cursor',
      peerSession: 'peer-1',
      ownerSession: 'owner-1',
      cwd,
      transcript,
      now: 2_000,
    };
    expect((await inspectAdapterLease(root, invocation)).eligible).toBe(true);
    expect(
      await inspectAdapterLease(root, {
        ...invocation,
        peerRuntime: 'codex',
      }),
    ).toMatchObject({ eligible: false, reason: 'identity-mismatch' });
    expect(
      await inspectAdapterLease(root, { ...invocation, peerSession: 'peer-2' }),
    ).toMatchObject({ eligible: false, reason: 'identity-mismatch' });
  });

  test.each([
    ['codex', 'claude-code'],
    ['codex', 'codex'],
    ['codex', 'cursor'],
    ['cursor', 'claude-code'],
    ['cursor', 'codex'],
    ['cursor', 'cursor'],
  ])(
    'pins owner runtime %s to observable peer runtime %s and exact peer session',
    async (runtime, peerRuntime) => {
      const { root, cwd, transcript } = await fixture();
      await arm(
        root,
        { ...options(cwd, transcript), runtime, peerRuntime },
        1_000,
      );
      const invocation = {
        runtime,
        peerRuntime,
        peerSession: 'peer-1',
        ownerSession: 'owner-1',
        cwd,
        transcript,
        now: 2_000,
      };
      expect(await inspectAdapterLease(root, invocation)).toMatchObject({
        eligible: true,
      });
      const otherPeerRuntime =
        peerRuntime === 'claude-code' ? 'codex' : 'claude-code';
      expect(
        await inspectAdapterLease(root, {
          ...invocation,
          peerRuntime: otherPeerRuntime,
        }),
      ).toMatchObject({ eligible: false, reason: 'identity-mismatch' });
      expect(
        await inspectAdapterLease(root, {
          ...invocation,
          peerSession: 'other-peer',
        }),
      ).toMatchObject({ eligible: false, reason: 'identity-mismatch' });
    },
  );

  test('rejects claude-code as an owner adapter runtime', async () => {
    const { root, cwd, transcript } = await fixture();
    await expect(
      arm(root, { ...options(cwd, transcript), runtime: 'claude-code' }, 1_000),
    ).rejects.toMatchObject({ code: 'invalid-owner-runtime' });
    expect(() =>
      defineRuntimeAdapter({
        runtime: 'claude-code',
        identify() {},
        emit() {},
      }),
    ).toThrow(expect.objectContaining({ code: 'invalid-owner-runtime' }));
  });

  test('uses the exact collaboration state override ahead of XDG and HOME', async () => {
    const { home } = await fixture();
    const exact = join(home, 'exact-collaboration-state');
    expect(
      stateRoot({
        SESSION_OBSERVER_STATE_DIR: exact,
        XDG_STATE_HOME: join(home, 'xdg'),
        HOME: join(home, 'other-home'),
      } as NodeJS.ProcessEnv),
    ).toBe(exact);
    expect(
      stateRoot({
        XDG_STATE_HOME: join(home, 'xdg'),
        HOME: home,
      } as NodeJS.ProcessEnv),
    ).toBe(join(home, 'xdg', 'session-observer', 'collab'));
  });
});
