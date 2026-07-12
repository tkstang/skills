import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { arm } from '../../skills/session-observer-collab/scripts/collab-control.mjs';
import { runCodexStopHook } from '../../skills/session-observer-collab/scripts/hooks/codex-stop.mjs';
import {
  readLease,
  stateRoot,
} from '../../skills/session-observer-collab/scripts/lib/lease-state.mjs';

const roots: string[] = [];
const START = 1_700_000_000_000;

async function fixture() {
  const home = await mkdtemp(join(tmpdir(), 'codex-hook-'));
  roots.push(home);
  const root = stateRoot({ HOME: home } as NodeJS.ProcessEnv);
  const cwd = join(home, 'work');
  const transcript = join(home, 'peer.jsonl');
  await mkdir(cwd);
  await writeFile(transcript, '{}\n');
  return { root, cwd, transcript };
}

afterEach(async () =>
  Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  ),
);

async function armLease(
  root: string,
  cwd: string,
  transcript: string,
  overrides: Record<string, string | number> = {},
) {
  return arm(
    root,
    {
      runtime: 'codex',
      peerRuntime: 'claude-code',
      session: 'codex-1',
      peerSession: 'peer-1',
      cwd,
      peerTranscript: transcript,
      waitMs: 100,
      leaseMs: 60_000,
      continuationCap: 2,
      loopCap: 2,
      ...overrides,
    },
    START,
  );
}

function digest(fromIndex = 0) {
  const entries = [
    {
      role: 'user',
      text: 'Please review the lease race.',
      kind: 'message',
      recordIndex: fromIndex,
    },
    {
      role: 'assistant',
      text: 'For Codex: the cursor update is ready for review.',
      kind: 'message',
      recordIndex: fromIndex + 2,
    },
  ];
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
      rendered: { count: entries.length },
      filtered: { tailSliceEntries: 0 },
    },
    entries,
  };
}

describe('Codex Stop continuation hook', () => {
  test('claims an exact completed range and emits the synthetic wake envelope', async () => {
    const { root, cwd, transcript } = await fixture();
    const armed = await armLease(root, cwd, transcript);

    const result = await runCodexStopHook(
      { hook_event_name: 'Stop', session_id: 'codex-1', cwd },
      { root, now: () => START + 1, observe: async () => digest() },
    );

    expect(result).toMatchObject({
      decision: 'block',
      reason: expect.any(String),
    });
    expect(result.reason).toContain('<session_observer_wake automatic="true"');
    expect(result.reason).toContain('runtime="codex"');
    expect(result.reason).toContain(`lease_id="${armed.lease.leaseId}"`);
    expect(result.reason).toContain('peer="claude-code:peer-1"');
    expect(result.reason).toContain('records="0-2"');
    expect(await readLease(root, 'codex-1')).toMatchObject({
      state: 'armed',
      peerCursor: 3,
      continuationCount: 1,
      loopCount: 1,
    });
  });

  test('fails closed for malformed hook data, mismatched worktrees, expired leases, and cap exhaustion', async () => {
    const { root, cwd, transcript } = await fixture();
    await armLease(root, cwd, transcript, { continuationCap: 1 });

    await expect(
      runCodexStopHook(
        { hook_event_name: 'Stop', session_id: 'bad/session', cwd },
        { root },
      ),
    ).resolves.toMatchObject({
      decision: 'allow',
      diagnostic: 'invalid-hook-input',
    });
    await expect(
      runCodexStopHook(
        {
          hook_event_name: 'Stop',
          session_id: 'codex-1',
          cwd: join(cwd, 'other'),
        },
        { root, observe: async () => digest() },
      ),
    ).resolves.toMatchObject({
      decision: 'allow',
      diagnostic: 'identity-mismatch',
    });
    expect((await readLease(root, 'codex-1'))?.state).toBe('armed');

    const exhausted = await runCodexStopHook(
      { hook_event_name: 'Stop', session_id: 'codex-1', cwd },
      { root, now: () => START + 1, observe: async () => digest() },
    );
    expect(exhausted).toMatchObject({ decision: 'block' });
    expect((await readLease(root, 'codex-1'))?.state).toBe('triggered');
    await expect(
      runCodexStopHook(
        { hook_event_name: 'Stop', session_id: 'codex-1', cwd },
        { root, now: () => START + 2, observe: async () => digest(3) },
      ),
    ).resolves.toMatchObject({ decision: 'allow', diagnostic: 'triggered' });
  });

  test('does not spend a continuation on no-op output and marks the bounded wait idle', async () => {
    const { root, cwd, transcript } = await fixture();
    await armLease(root, cwd, transcript, { waitMs: 1 });
    const noOp = digest();
    noOp.entries[1].text = '[no-op] waiting for a substantive peer result';
    const moments = [START + 1, START + 1, START + 2, START + 2];

    await expect(
      runCodexStopHook(
        { hook_event_name: 'Stop', session_id: 'codex-1', cwd },
        {
          root,
          now: () => moments.shift() ?? START + 2,
          observe: async () => noOp,
        },
      ),
    ).resolves.toMatchObject({ decision: 'allow', diagnostic: 'wait-timeout' });
    expect(await readLease(root, 'codex-1')).toMatchObject({
      state: 'idle',
      peerCursor: 0,
      continuationCount: 0,
      loopCount: 0,
      diagnostic: 'wait-timeout',
    });
  });

  test('does not re-trigger a claimed Stop boundary', async () => {
    const { root, cwd, transcript } = await fixture();
    await armLease(root, cwd, transcript, { continuationCap: 1 });
    const hook = { hook_event_name: 'Stop', session_id: 'codex-1', cwd };
    const options = {
      root,
      now: () => START + 1,
      observe: async () => digest(),
    };

    const results = [
      await runCodexStopHook(hook, options),
      await runCodexStopHook(hook, options),
    ];

    expect(
      results.filter((result) => result.decision === 'block'),
    ).toHaveLength(1);
    expect(await readLease(root, 'codex-1')).toMatchObject({
      peerCursor: 3,
      continuationCount: 1,
      loopCount: 1,
    });
  });

  test('a restarted Codex client requires an explicit re-arm after an idle timeout', async () => {
    const { root, cwd, transcript } = await fixture();
    await armLease(root, cwd, transcript, { waitMs: 1 });
    const timeoutMoments = [START + 1, START + 1, START + 2, START + 2];
    const event = { hook_event_name: 'Stop', session_id: 'codex-1', cwd };
    const noOp = digest();
    noOp.entries[1].text = '[no-op] still waiting for the peer';

    await expect(
      runCodexStopHook(event, {
        root,
        now: () => timeoutMoments.shift() ?? START + 2,
        observe: async () => noOp,
      }),
    ).resolves.toMatchObject({ decision: 'allow', diagnostic: 'wait-timeout' });
    await expect(
      runCodexStopHook(event, { root, observe: async () => noOp }),
    ).resolves.toMatchObject({ decision: 'allow', diagnostic: 'wait-timeout' });

    await armLease(root, cwd, transcript, { waitMs: 100 });
    await expect(
      runCodexStopHook(event, {
        root,
        now: () => START + 3,
        observe: async () => digest(),
      }),
    ).resolves.toMatchObject({ decision: 'block' });
  });
});
