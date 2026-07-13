import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { arm } from '../../skills/session-observer-collab/scripts/collab-control.mjs';
import { runCursorStopHook } from '../../skills/session-observer-collab/scripts/hooks/cursor-stop.mjs';
import {
  readLease,
  stateRoot,
} from '../../skills/session-observer-collab/scripts/lib/lease-state.mjs';

const roots: string[] = [];
const START = 1_700_000_000_000;

async function fixture() {
  const home = await mkdtemp(join(tmpdir(), 'cursor-hook-'));
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
      runtime: 'cursor',
      peerRuntime: 'claude-code',
      session: 'cursor-1',
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

function event(overrides: Record<string, unknown> = {}) {
  return {
    conversation_id: 'cursor-1',
    generation_id: 'generation-1',
    status: 'success',
    loop_count: 0,
    ...overrides,
  };
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
      text: 'For Cursor: the continuation is ready for review.',
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

describe('Cursor Stop continuation hook', () => {
  test('claims an exact completed range and returns only a followup_message envelope', async () => {
    const { root, cwd, transcript } = await fixture();
    const armed = await armLease(root, cwd, transcript);

    const result = await runCursorStopHook(event(), {
      root,
      now: () => START + 1,
      observe: async () => digest(),
    });

    expect(result).toEqual({ followup_message: expect.any(String) });
    expect(result?.followup_message).toContain(
      '<session_observer_wake automatic="true"',
    );
    expect(result?.followup_message).toContain('runtime="cursor"');
    expect(result?.followup_message).toContain(
      `lease_id="${armed.lease.leaseId}"`,
    );
    expect(result?.followup_message).toContain('records="0-2"');
    expect(await readLease(root, 'cursor-1')).toMatchObject({
      state: 'armed',
      peerCursor: 3,
      continuationCount: 1,
      loopCount: 1,
    });
  });

  test('rejects malformed, non-success, and loop-limited generations before observing peer output', async () => {
    const { root, cwd, transcript } = await fixture();
    await armLease(root, cwd, transcript);
    let observed = 0;
    const options = {
      root,
      observe: async () => {
        observed += 1;
        return digest();
      },
    };

    await expect(runCursorStopHook(event({ status: 'error' }), options)).resolves.toBeNull();
    await expect(runCursorStopHook(event({ status: 'aborted' }), options)).resolves.toBeNull();
    await expect(runCursorStopHook(event({ status: 'cancelled' }), options)).resolves.toBeNull();
    await expect(runCursorStopHook(event({ loop_count: -1 }), options)).resolves.toBeNull();
    await expect(
      runCursorStopHook(event({ loop_count: 1 }), { ...options, loopLimit: 1 }),
    ).resolves.toBeNull();
    expect(observed).toBe(0);
    expect(await readLease(root, 'cursor-1')).toMatchObject({
      state: 'armed',
      peerCursor: 0,
      continuationCount: 0,
      loopCount: 0,
    });
  });

  test('enforces Cursor loop_limit independently from the lease cap', async () => {
    const { root, cwd, transcript } = await fixture();
    await armLease(root, cwd, transcript, { continuationCap: 2, loopCap: 2 });

    await expect(
      runCursorStopHook(event({ loop_count: 4 }), {
        root,
        loopLimit: 5,
        now: () => START + 1,
        observe: async () => digest(),
      }),
    ).resolves.toEqual({ followup_message: expect.any(String) });
    expect(await readLease(root, 'cursor-1')).toMatchObject({
      state: 'triggered',
      continuationCount: 1,
      loopCount: 1,
    });
  });

  test('does not promote provisional or late output after the bounded wait becomes idle', async () => {
    const { root, cwd, transcript } = await fixture();
    await armLease(root, cwd, transcript, { waitMs: 1 });
    const provisional = digest();
    provisional.entries[1].text = '[no-op] provisional Cursor planning';
    const moments = [START + 1, START + 1, START + 2, START + 2];

    await expect(
      runCursorStopHook(event(), {
        root,
        now: () => moments.shift() ?? START + 2,
        observe: async () => provisional,
      }),
    ).resolves.toBeNull();
    expect(await readLease(root, 'cursor-1')).toMatchObject({
      state: 'idle',
      peerCursor: 3,
      continuationCount: 0,
    });

    let observed = false;
    await expect(
      runCursorStopHook(event({ generation_id: 'generation-2' }), {
        root,
        observe: async () => {
          observed = true;
          return digest(3);
        },
      }),
    ).resolves.toBeNull();
    expect(observed).toBe(false);
  });
});
