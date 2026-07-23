import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import {
  assessCodexHookReadiness,
  codexStopCommand,
  CODEX_STOP_TIMEOUT_GRACE_SECONDS,
  CODEX_STOP_TIMEOUT_SECONDS,
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
  compareAndSwapCursor,
  createWaiterIdentity,
  effectiveLease,
  leasePath,
  MAX_WAIT_MS,
  pruneLeases,
  readLease,
  recoverOrphanedWait,
  stateRoot,
  validateLease,
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
  const temporaryHome = await mkdtemp(join(tmpdir(), 'collab-control-'));
  const home = await realpath(temporaryHome);
  roots.push(home);
  const root = stateRoot({ HOME: home } as NodeJS.ProcessEnv);
  const cwd = join(home, 'work');
  const transcriptStore = join(
    home,
    '.cursor',
    'projects',
    'project',
    'agent-transcripts',
  );
  const transcript = join(transcriptStore, 'peer-1', 'peer-1.jsonl');
  await mkdir(cwd);
  await mkdir(join(transcriptStore, 'peer-1'), { recursive: true });
  await writeFile(transcript, '{}\n');
  return { home, root, cwd, transcript, transcriptStore };
}

async function cursorContinuity(transcript: string, nextFrameIndex: number) {
  const contents = await readFile(transcript);
  const metadata = await stat(transcript);
  return {
    indexBase: 'zero-based-jsonl-frame-index',
    nextFrameIndex,
    prefixBytes: contents.byteLength,
    prefixSha256: createHash('sha256').update(contents).digest('hex'),
    observedSize: metadata.size,
    device: metadata.dev,
    inode: metadata.ino,
  };
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

function leaseV5(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 5,
    leaseId: 'legacy-lease',
    runtime: 'codex',
    peerRuntime: 'claude-code',
    ownerSession: 'owner-session',
    ownerCwd: '/workspace/example',
    peerSession: 'peer-session',
    peerTranscript: '/workspace/peer/transcript.jsonl',
    state: 'armed',
    peerCursor: 2,
    continuationCount: 0,
    continuationCap: 2,
    loopCount: 0,
    loopCap: 2,
    waitMs: 5_000,
    waitStartedAt: null,
    waitDeadlineAt: null,
    waitToken: null,
    waitPid: null,
    leaseMs: 60_000,
    armedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-01-01T00:01:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    diagnostic: null,
    ...overrides,
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
      exactCommand: codexStopCommand(scriptPath),
    });
    expect(second).toMatchObject({ changed: false });
    expect(written.hooks.SessionStart).toEqual(unrelated.hooks.SessionStart);
    expect(written.hooks.Stop[0]).toEqual(unrelated.hooks.Stop[0]);
    expect(
      written.hooks.Stop.flatMap((group: { hooks: unknown[] }) => group.hooks),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: codexStopCommand(scriptPath),
          statusMessage: 'Checking for Session Observer peer activity',
        }),
      ]),
    );
    const installed = written.hooks.Stop.flatMap(
      (group: { hooks: Array<{ command?: string; timeout?: number }> }) =>
        group.hooks,
    ).find(
      (hook: { command?: string }) =>
        hook.command === codexStopCommand(scriptPath),
    );
    expect(installed?.timeout).toBe(CODEX_STOP_TIMEOUT_SECONDS);
    expect(CODEX_STOP_TIMEOUT_SECONDS).toBe(
      MAX_WAIT_MS / 1_000 + CODEX_STOP_TIMEOUT_GRACE_SECONDS,
    );
    expect(CODEX_STOP_TIMEOUT_GRACE_SECONDS).toBeGreaterThan(0);
    expect(CODEX_STOP_TIMEOUT_SECONDS).toBeGreaterThanOrEqual(16);
    expect(CODEX_STOP_TIMEOUT_SECONDS).toBeGreaterThanOrEqual(60);
  });

  test('reconciles stale managed fields for one exact observer command', async () => {
    const { home } = await fixture();
    const hooksPath = join(home, '.codex', 'hooks.json');
    const scriptPath = join(
      home,
      '.codex',
      'hooks',
      'session-observer-collab-stop.mjs',
    );
    const command = codexStopCommand(scriptPath);
    const orcaStopGroup = {
      matcher: 'Stop',
      hooks: [
        {
          type: 'command',
          command: 'node /opt/orca/stop-hook.mjs',
          timeout: 20,
          statusMessage: 'Orca is checking peers',
        },
      ],
    };
    const staleObserver = {
      type: 'legacy-command',
      command,
      timeout: 15,
      statusMessage: 'Old observer status',
      enabled: false,
      userLabel: 'keep this metadata',
    };
    const initial = {
      hooks: {
        Stop: [orcaStopGroup, { hooks: [staleObserver], matcher: 'Stop' }],
        SessionStart: [{ hooks: [{ type: 'command', command: 'node start' }] }],
      },
    };
    await mkdir(join(home, '.codex'), { recursive: true });
    await writeFile(hooksPath, JSON.stringify(initial, null, 2));

    const reconciled = await installCodexStopHook({ hooksPath, scriptPath });
    const written = JSON.parse(await readFile(hooksPath, 'utf8'));
    const observerEntries = written.hooks.Stop.flatMap(
      (group: { hooks: Array<{ command?: string }> }) => group.hooks,
    ).filter((hook: { command?: string }) => hook.command === command);

    expect(reconciled).toMatchObject({ changed: true, exactCommand: command });
    expect(written.hooks.Stop[0]).toEqual(orcaStopGroup);
    expect(written.hooks.SessionStart).toEqual(initial.hooks.SessionStart);
    expect(observerEntries).toEqual([
      expect.objectContaining({
        type: 'command',
        command,
        timeout: CODEX_STOP_TIMEOUT_SECONDS,
        statusMessage: 'Checking for Session Observer peer activity',
        enabled: false,
        userLabel: 'keep this metadata',
      }),
    ]);

    const canonical = await readFile(hooksPath, 'utf8');
    const reinstall = await installCodexStopHook({ hooksPath, scriptPath });
    expect(reinstall).toMatchObject({ changed: false, exactCommand: command });
    expect(await readFile(hooksPath, 'utf8')).toBe(canonical);
  });

  test('reports trust, explicit disablement, and effective execution as separate Codex facts', async () => {
    const { home } = await fixture();
    const scriptPath = join(
      home,
      '.codex',
      'hooks',
      'session-observer-collab-stop.mjs',
    );
    const exactCommand = codexStopCommand(scriptPath);
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
      explicitEnablement: 'not-explicitly-enabled',
      effectiveExecution: 'observed',
      leaseArmed: 'not-armed',
      liveWake: 'unverified',
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
    ).toMatchObject({ explicitEnablement: 'disabled', mayArm: false });
    expect(
      assessCodexHookReadiness({
        scriptPath,
        hooks,
        hookStatuses: [{ command: exactCommand, enabled: true }],
      }),
    ).toMatchObject({ explicitEnablement: 'enabled' });
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

  test('removes only one confirmed exact Codex registration', async () => {
    const { home, root } = await fixture();
    const hooksPath = join(home, '.codex', 'hooks.json');
    const scriptPath = join(
      home,
      '.codex',
      'hooks',
      'session-observer-collab-stop.mjs',
    );
    await installCodexStopHook({ hooksPath, scriptPath });
    await expect(
      uninstallCodexStopHook({
        hooksPath,
        scriptPath,
        confirmed: false,
        root,
      }),
    ).rejects.toThrow('explicit confirmation');
    const result = await uninstallCodexStopHook({
      hooksPath,
      scriptPath,
      confirmed: true,
      root,
    });
    expect(result).toMatchObject({ changed: true, removed: 1 });
    expect(JSON.parse(await readFile(hooksPath, 'utf8')).hooks.Stop).toEqual(
      [],
    );
  });

  test('exposes argv-safe Codex lifecycle commands and derives uninstall safety from leases', async () => {
    const { home, root, cwd, transcript } = await fixture();
    const hooksPath = join(home, '.codex', 'hooks.json');
    const scriptPath = join(
      home,
      '.codex',
      'hooks with spaces;and-$metacharacters.mjs',
    );
    const trustPath = join(home, 'trust records.json');
    const statusPath = join(home, 'hook status.json');
    const unrelated = {
      hooks: {
        Stop: [
          { hooks: [{ type: 'command', command: 'node /tmp/other.mjs' }] },
        ],
      },
    };
    await mkdir(join(home, '.codex'), { recursive: true });
    await writeFile(hooksPath, JSON.stringify(unrelated));
    await writeFile(scriptPath, '// hook\n');

    const env = { SESSION_OBSERVER_STATE_DIR: root } as NodeJS.ProcessEnv;
    const installed = await run(
      ['codex-install', '--hooks-path', hooksPath, '--script-path', scriptPath],
      env,
    );
    const command = codexStopCommand(scriptPath);
    expect(installed).toMatchObject({
      command: 'codex-install',
      bundle: { changed: true },
      readiness: { exactCommand: command, installed: true },
    });
    const installedLauncher = await readFile(scriptPath, 'utf8');
    expect(command).toContain('hooks with spaces;and-$metacharacters.mjs');
    await writeFile(trustPath, JSON.stringify([{ command, trusted: true }]));
    await writeFile(
      statusPath,
      JSON.stringify([{ command, lastRanAt: '2026-07-12T12:00:00.000Z' }]),
    );
    const readiness = await run(
      [
        'codex-status',
        '--hooks-path',
        hooksPath,
        '--script-path',
        scriptPath,
        '--trust-records-path',
        trustPath,
        '--hook-statuses-path',
        statusPath,
      ],
      env,
    );
    expect(readiness).toMatchObject({
      command: 'codex-status',
      explicitEnablement: 'not-explicitly-enabled',
      effectiveExecution: 'observed',
      leaseArmed: 'not-armed',
      liveWake: 'unverified',
    });

    await arm(root, options(cwd, transcript), 1_700_000_000_000);
    await expect(
      run(
        [
          'codex-uninstall',
          '--hooks-path',
          hooksPath,
          '--script-path',
          scriptPath,
          '--confirmed',
          '--remove-script',
        ],
        env,
        1_700_000_000_100,
      ),
    ).rejects.toThrow('active collaboration leases');
    expect(await readFile(scriptPath, 'utf8')).toBe(installedLauncher);

    await disarm(root, 'owner-1', 1_700_000_000_200);
    const firstRemoval = await run(
      [
        'codex-uninstall',
        '--hooks-path',
        hooksPath,
        '--script-path',
        scriptPath,
        '--confirmed',
        '--remove-script',
      ],
      env,
      1_700_000_000_300,
    );
    expect(firstRemoval).toMatchObject({
      command: 'codex-uninstall',
      removed: 1,
      scriptRemoved: true,
      supportRemoved: true,
      safety: { activeLeaseCount: 0 },
    });
    expect(JSON.parse(await readFile(hooksPath, 'utf8'))).toEqual(unrelated);
    await expect(readFile(scriptPath, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });

    await writeFile(scriptPath, '// retained when absent\n');
    const absent = await run(
      [
        'codex-uninstall',
        '--hooks-path',
        hooksPath,
        '--script-path',
        scriptPath,
        '--confirmed',
        '--remove-script',
      ],
      env,
    );
    expect(absent).toMatchObject({ removed: 0, scriptRemoved: false });
    expect(await readFile(scriptPath, 'utf8')).toBe(
      '// retained when absent\n',
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

  test('arms schema v6 with only a contained canonical Cursor path and private frame cursor', async () => {
    const { root, cwd, transcript, transcriptStore } = await fixture();
    const alias = join(transcriptStore, 'peer-1', 'peer-alias.jsonl');
    await symlink(transcript, alias);
    const canonicalTranscript = await realpath(transcript);

    const armed = await arm(root, options(cwd, alias), 1_000);
    expect(armed.lease).toMatchObject({
      schemaVersion: 6,
      peerRuntime: 'cursor',
      peerTranscript: canonicalTranscript,
      peerCanonicalTranscriptPath: canonicalTranscript,
      peerIndexBase: 'zero-based-jsonl-frame-index',
      peerCursor: 0,
      peerContinuity: null,
    });
    expect(armed.lease).not.toHaveProperty('lastRecordIndex');
    expect(armed.lease).not.toHaveProperty('observationCursor');
    expect((await status(root, 'owner-1', 2_000)).lease).toMatchObject({
      schemaVersion: 6,
      peerCanonicalTranscriptPath: canonicalTranscript,
      peerIndexBase: 'zero-based-jsonl-frame-index',
      peerContinuity: null,
    });
    expect((await disarm(root, 'owner-1', 3_000)).lease).toMatchObject({
      schemaVersion: 6,
      state: 'disarmed',
      peerCanonicalTranscriptPath: canonicalTranscript,
      peerContinuity: null,
    });
  });

  test('rejects a Cursor transcript symlink that escapes its supported store', async () => {
    const { home, root, cwd, transcriptStore } = await fixture();
    const outside = join(home, 'outside.jsonl');
    const unsupported = join(home, 'agent-transcripts', 'peer.jsonl');
    const escaped = join(transcriptStore, 'peer-1', 'escaped.jsonl');
    await writeFile(outside, '{}\n');
    await mkdir(join(home, 'agent-transcripts'));
    await writeFile(unsupported, '{}\n');
    await symlink(outside, escaped);

    await expect(
      arm(root, options(cwd, unsupported), 1_000),
    ).rejects.toMatchObject({
      code: 'unsupported-peer-transcript-store',
    });
    await expect(arm(root, options(cwd, escaped), 1_000)).rejects.toMatchObject(
      {
        code: 'peer-transcript-outside-store',
      },
    );
    expect(await readLease(root, 'owner-1')).toBeNull();
  });

  test('validates v6 index-base and private continuity checkpoint invariants', () => {
    const cursorLease = {
      ...leaseV5({
        schemaVersion: 6,
        peerRuntime: 'cursor',
        peerTranscript: '/cursor/projects/project/agent-transcripts/s/s.jsonl',
        peerCanonicalTranscriptPath:
          '/cursor/projects/project/agent-transcripts/s/s.jsonl',
        peerIndexBase: 'zero-based-jsonl-frame-index',
        peerCursor: 4,
      }),
      peerContinuity: {
        indexBase: 'zero-based-jsonl-frame-index',
        nextFrameIndex: 4,
        prefixBytes: 128,
        prefixSha256: 'a'.repeat(64),
        observedSize: 256,
        device: 1,
        inode: 2,
      },
    };
    expect(validateLease(cursorLease)).toMatchObject({
      peerIndexBase: 'zero-based-jsonl-frame-index',
      peerCursor: 4,
      peerContinuity: { nextFrameIndex: 4 },
    });
    expect(() =>
      validateLease({
        ...cursorLease,
        peerContinuity: {
          ...cursorLease.peerContinuity,
          nextFrameIndex: 3,
        },
      }),
    ).toThrow(/peer cursor/i);
    expect(() =>
      validateLease({
        ...cursorLease,
        peerIndexBase: 'zero-based-jsonl-record-index',
      }),
    ).toThrow(/index base/i);
    expect(() =>
      validateLease({
        ...leaseV5({
          schemaVersion: 6,
          peerCanonicalTranscriptPath: '/workspace/peer/transcript.jsonl',
          peerIndexBase: 'zero-based-jsonl-record-index',
          peerContinuity: cursorLease.peerContinuity,
        }),
      }),
    ).toThrow(/continuity/i);
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

  test('migrates legacy non-Cursor leases and requires explicit Cursor re-arm', async () => {
    const { root, cwd, transcript } = await fixture();
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
      schemaVersion: 6,
      peerRuntime: 'claude-code',
      peerCanonicalTranscriptPath: '/workspace/peer/transcript.jsonl',
      peerIndexBase: 'zero-based-jsonl-record-index',
      peerCursor: 2,
      peerContinuity: null,
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

    await writeFile(
      leasePath(root, 'owner-session'),
      JSON.stringify(
        leaseV5({
          peerRuntime: 'codex',
          peerCursor: 7,
        }),
      ),
    );
    await chmod(leasePath(root, 'owner-session'), 0o600);
    expect(await readLease(root, 'owner-session')).toMatchObject({
      schemaVersion: 6,
      peerRuntime: 'codex',
      peerCanonicalTranscriptPath: '/workspace/peer/transcript.jsonl',
      peerIndexBase: 'zero-based-jsonl-record-index',
      peerCursor: 7,
      peerContinuity: null,
    });

    await writeFile(
      leasePath(root, 'owner-1'),
      JSON.stringify(
        leaseV5({
          leaseId: 'legacy-cursor',
          peerRuntime: 'cursor',
          ownerSession: 'owner-1',
          ownerCwd: cwd,
          peerSession: 'peer-1',
          peerTranscript: transcript,
          peerCursor: 0,
        }),
      ),
    );
    await chmod(leasePath(root, 'owner-1'), 0o600);
    await expect(readLease(root, 'owner-1')).rejects.toMatchObject({
      code: 'cursor-lease-rearm-required',
    });
    await expect(
      arm(root, options(cwd, transcript), 2_000),
    ).resolves.toMatchObject({
      changed: true,
      lease: {
        schemaVersion: 6,
        peerRuntime: 'cursor',
        peerIndexBase: 'zero-based-jsonl-frame-index',
        peerCursor: 0,
        peerContinuity: null,
      },
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

  test('cursor-only CAS advances suppressed ranges without spending budget and rejects stale generations', async () => {
    const { root, cwd, transcript } = await fixture();
    const armed = await arm(root, options(cwd, transcript), 1_000);
    const waiting = await beginAdapterWait(root, {
      runtime: 'codex',
      peerRuntime: 'cursor',
      peerSession: 'peer-1',
      ownerSession: 'owner-1',
      cwd,
      transcript,
      now: 1_500,
    });
    const expected = {
      leaseId: armed.lease.leaseId,
      peerCursor: 0,
      continuationCount: 0,
      loopCount: 0,
    };
    const advanced = await compareAndSwapCursor(
      root,
      'owner-1',
      expected,
      {
        peerCursor: 4,
        peerContinuity: {
          indexBase: 'zero-based-jsonl-frame-index',
          nextFrameIndex: 4,
          prefixBytes: 128,
          prefixSha256: 'b'.repeat(64),
          observedSize: 256,
          device: 1,
          inode: 2,
        },
      },
      2_000,
    );
    expect(advanced).toMatchObject({
      ok: true,
      lease: {
        state: 'waiting',
        peerCursor: 4,
        peerContinuity: { nextFrameIndex: 4 },
        continuationCount: 0,
        loopCount: 0,
      },
    });
    expect(waiting.waiting).toBe(true);
    await expect(
      compareAndSwapCursor(root, 'owner-1', expected, 8, 3_000),
    ).resolves.toMatchObject({ ok: false, reason: 'stale' });
  });

  test('status recovers a killed generation-bound waiter but preserves a live waiter', async () => {
    const { root, cwd, transcript } = await fixture();
    await arm(root, options(cwd, transcript), 1_000);
    const child = spawn(process.execPath, [
      '-e',
      'setInterval(() => {}, 1000)',
    ]);
    const waiter = await createWaiterIdentity(child.pid!);
    const invocation = {
      runtime: 'codex',
      peerRuntime: 'cursor',
      peerSession: 'peer-1',
      ownerSession: 'owner-1',
      cwd,
      transcript,
      now: 2_000,
      waiter,
    };
    await beginAdapterWait(root, invocation);
    expect((await status(root, 'owner-1', 2_100)).lease).toMatchObject({
      state: 'waiting',
      waitToken: waiter.token,
    });

    child.kill('SIGKILL');
    await new Promise<void>((resolve) => child.once('exit', () => resolve()));
    expect((await status(root, 'owner-1', 2_200)).lease).toMatchObject({
      state: 'idle',
      diagnostic: 'waiter-terminated',
      waitStartedAt: null,
      waitDeadlineAt: null,
      waitToken: null,
    });
    expect((await status(root, 'owner-1', 2_300)).lease).toMatchObject({
      state: 'idle',
      diagnostic: 'waiter-terminated',
    });
  });

  test('orphan recovery is generation-safe and refuses unknown liveness', async () => {
    const { root, cwd, transcript } = await fixture();
    await arm(root, options(cwd, transcript), 1_000);
    const waiting = await beginAdapterWait(root, {
      runtime: 'codex',
      peerRuntime: 'cursor',
      peerSession: 'peer-1',
      ownerSession: 'owner-1',
      cwd,
      transcript,
      now: 2_000,
    });
    const stale = {
      leaseId: waiting.lease!.leaseId,
      waitToken: String(waiting.lease!.waitToken),
    };
    await arm(root, { ...options(cwd, transcript), cursor: '4' }, 2_100);
    await expect(
      recoverOrphanedWait(root, 'owner-1', 2_200, {
        expected: stale,
        isWaiterLive: async () => false,
      }),
    ).resolves.toMatchObject({ recovered: false, reason: 'stale' });

    const next = await beginAdapterWait(root, {
      runtime: 'codex',
      peerRuntime: 'cursor',
      peerSession: 'peer-1',
      ownerSession: 'owner-1',
      cwd,
      transcript,
      now: 2_300,
    });
    await expect(
      recoverOrphanedWait(root, 'owner-1', 2_400, {
        expected: {
          leaseId: next.lease!.leaseId,
          waitToken: String(next.lease!.waitToken),
        },
        isWaiterLive: async () => undefined,
      }),
    ).resolves.toMatchObject({ recovered: false, reason: 'liveness-unknown' });
    expect(await readLease(root, 'owner-1')).toMatchObject({
      state: 'waiting',
    });
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
        expect.objectContaining({
          waiting: false,
          changed: false,
          reason: 'waiter-active',
        }),
      ]),
    );
    expect((await readLease(root, 'owner-1'))?.state).toBe('waiting');
    expect((await inspectAdapterLease(root, invocation)).eligible).toBe(true);
    const completion = {
      peerCursor: 1,
      peerContinuity: await cursorContinuity(transcript, 1),
    };
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
          completion,
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
    const { root, cwd, transcript, transcriptStore } = await fixture();
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

    const otherTranscript = join(transcriptStore, 'peer-1', 'other.jsonl');
    await writeFile(otherTranscript, '{}\n');
    const changedRequests = [
      { waitMs: '6000' },
      { leaseMs: '59000' },
      { continuationCap: '3' },
      { loopCap: '3' },
      { runtime: 'cursor' },
      { peerRuntime: 'codex' },
      { peerSession: 'peer-2' },
      { cwd: join(cwd, 'other') },
      { peerTranscript: otherTranscript },
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
    const peerContinuity = await cursorContinuity(transcript, 1);
    const completion = {
      peerCursor: 1,
      peerContinuity,
    };
    const [, claim] = await Promise.all([
      disarm(root, 'owner-1', 3_000),
      claimAdapterTrigger(
        root,
        { ...invocation, now: 4_000 },
        expected,
        completion,
      ),
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
