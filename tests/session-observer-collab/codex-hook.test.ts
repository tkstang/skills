import { createHash } from 'node:crypto';
import {
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { arm } from '../../skills/session-observer-collab/scripts/collab-control.mjs';
import { runCodexStopHook } from '../../skills/session-observer-collab/scripts/hooks/codex-stop.mjs';
import {
  readLease,
  stateRoot,
  writeLease,
} from '../../skills/session-observer-collab/scripts/lib/lease-state.mjs';
import * as runtimeAdapter from '../../skills/session-observer-collab/scripts/lib/runtime-adapter.mjs';

const { beginAdapterWait, inspectAdapterLease } = runtimeAdapter;
const advanceAdapterCursor = (
  runtimeAdapter as unknown as {
    advanceAdapterCursor: (...args: any[]) => Promise<any>;
  }
).advanceAdapterCursor;

const roots: string[] = [];
const START = 1_700_000_000_000;

async function fixture() {
  const temporaryHome = await mkdtemp(join(tmpdir(), 'codex-hook-'));
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

async function continuity(transcript: string, nextFrameIndex: number) {
  const contents = await readFile(transcript);
  const metadata = await stat(transcript);
  return {
    indexBase: 'zero-based-jsonl-frame-index' as const,
    nextFrameIndex,
    prefixBytes: contents.byteLength,
    prefixSha256: createHash('sha256').update(contents).digest('hex'),
    observedSize: metadata.size,
    device: metadata.dev,
    inode: metadata.ino,
  };
}

async function armCursorPeerLease(
  root: string,
  cwd: string,
  transcript: string,
): Promise<any> {
  const armed = await armLease(root, cwd, transcript, {
    peerRuntime: 'cursor',
  });
  return writeLease(root, {
    ...armed.lease,
    peerContinuity: await continuity(transcript, 0),
  } as any);
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
  test('rejects stored-path substitution and use-time symlink escape without observing or mutating', async () => {
    const { home, root, cwd, transcript, transcriptStore } = await fixture();
    const original = await armCursorPeerLease(root, cwd, transcript);
    const outside = join(home, 'outside.jsonl');
    const other = join(transcriptStore, 'peer-1', 'other.jsonl');
    await writeFile(outside, '{}\n');
    await writeFile(other, '{}\n');

    await expect(
      inspectAdapterLease(root, {
        runtime: 'codex',
        peerRuntime: 'cursor',
        peerSession: 'peer-1',
        ownerSession: 'codex-1',
        cwd,
        transcript: other,
        now: START + 1,
      }),
    ).resolves.toMatchObject({
      eligible: false,
      reason: 'continuity-path-mismatch',
    });
    expect(await readLease(root, 'codex-1')).toEqual(original);

    for (const substitution of ['stored-path', 'symlink-escape']) {
      await writeLease(root, original);
      if (substitution === 'stored-path') {
        const raw = {
          ...original,
          peerTranscript: other,
        };
        await writeFile(
          join(root, 'leases', 'codex-1.json'),
          `${JSON.stringify(raw)}\n`,
        );
      } else {
        await rm(transcript);
        await symlink(outside, transcript);
      }
      const before = await readFile(
        join(root, 'leases', 'codex-1.json'),
        'utf8',
      );
      let observed = 0;

      await expect(
        runCodexStopHook(
          { hook_event_name: 'Stop', session_id: 'codex-1', cwd },
          {
            root,
            now: () => START + 1,
            observe: async () => {
              observed += 1;
              return digest();
            },
          },
        ),
      ).resolves.toMatchObject({ decision: 'allow' });

      expect(observed).toBe(0);
      expect(await readFile(join(root, 'leases', 'codex-1.json'), 'utf8')).toBe(
        before,
      );
      if (substitution === 'symlink-escape') {
        await rm(transcript);
        await writeFile(transcript, '{}\n');
      }
    }
  });

  test('threads the next private checkpoint through the safe-cursor CAS route', async () => {
    const { root, cwd, transcript } = await fixture();
    const lease = await armCursorPeerLease(root, cwd, transcript);
    const invocation = {
      runtime: 'codex',
      peerRuntime: 'cursor',
      peerSession: 'peer-1',
      ownerSession: 'codex-1',
      cwd,
      transcript,
      now: START + 1,
    };
    const waiting = await beginAdapterWait(root, invocation);
    const nextContinuity = await continuity(transcript, 3);
    const advanced = await advanceAdapterCursor(
      root,
      invocation,
      {
        leaseId: lease.leaseId,
        peerCursor: 0,
        continuationCount: 0,
        loopCount: 0,
      },
      {
        peerCursor: 3,
        peerContinuity: nextContinuity,
      },
    );

    expect(waiting.waiting).toBe(true);
    expect(advanced).toMatchObject({
      advanced: true,
      lease: {
        peerCursor: 3,
        peerContinuity: nextContinuity,
        continuationCount: 0,
        loopCount: 0,
      },
    });
  });

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
      peerCursor: 3,
      continuationCount: 0,
      loopCount: 0,
      diagnostic: 'wait-timeout',
      waitStartedAt: null,
      waitDeadlineAt: null,
    });
  });

  test('advances a suppressible range once, then selects a later substantive range exactly once', async () => {
    const { root, cwd, transcript } = await fixture();
    await armLease(root, cwd, transcript, { waitMs: 100 });
    let calls = 0;
    const result = await runCodexStopHook(
      { hook_event_name: 'Stop', session_id: 'codex-1', cwd },
      {
        root,
        now: () => START + 1,
        observe: async (lease: { peerCursor: number }) => {
          calls += 1;
          const value = digest(lease.peerCursor);
          if (lease.peerCursor === 0)
            value.entries[1].text = '[no-op] caught up';
          return value;
        },
      },
    );
    expect(result).toMatchObject({ decision: 'block' });
    expect(calls).toBe(2);
    expect(await readLease(root, 'codex-1')).toMatchObject({
      peerCursor: 6,
      continuationCount: 1,
      loopCount: 1,
    });
  });

  test('refuses to advance a suppressible digest whose range is not contiguous', async () => {
    const { root, cwd, transcript } = await fixture();
    await armLease(root, cwd, transcript, { cursor: 3, waitMs: 100 });
    const noOp = digest(0);
    noOp.entries[1].text = '[no-op] stale observer output';
    Object.assign(noOp.range, {
      toIndex: 5,
      nextIndex: 6,
      totalRecords: 6,
      newRecords: 6,
    });
    Object.assign(noOp.accounting.raw, {
      toIndex: 5,
      count: 6,
      nextIndex: 6,
      totalRecords: 6,
    });
    await expect(
      runCodexStopHook(
        { hook_event_name: 'Stop', session_id: 'codex-1', cwd },
        { root, now: () => START + 1, observe: async () => noOp },
      ),
    ).resolves.toMatchObject({
      decision: 'allow',
      diagnostic: 'noncontiguous-selection',
    });
    expect(await readLease(root, 'codex-1')).toMatchObject({
      peerCursor: 3,
      continuationCount: 0,
      loopCount: 0,
    });
  });

  test('finalizes a maximum opt-in wait when the provider terminates the hook', async () => {
    const { root, cwd, transcript } = await fixture();
    await armLease(root, cwd, transcript, { waitMs: 60_000 });
    const controller = new AbortController();
    let observing!: () => void;
    const observationStarted = new Promise<void>((resolve) => {
      observing = resolve;
    });
    const result = runCodexStopHook(
      { hook_event_name: 'Stop', session_id: 'codex-1', cwd },
      {
        root,
        now: () => START + 1,
        signal: controller.signal,
        observe: async () => {
          observing();
          return new Promise(() => {});
        },
      },
    );

    await observationStarted;
    controller.abort();

    await expect(result).resolves.toMatchObject({
      decision: 'allow',
      diagnostic: 'provider-terminated',
    });
    expect(await readLease(root, 'codex-1')).toMatchObject({
      state: 'idle',
      diagnostic: 'provider-terminated',
      waitStartedAt: null,
      waitDeadlineAt: null,
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
