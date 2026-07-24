import { createHash } from 'node:crypto';
import {
  appendFile,
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import {
  arm,
  disarm,
} from '../../skills/session-observer-collab/scripts/collab-control.mjs';
import { runCursorStopHook } from '../../skills/session-observer-collab/scripts/hooks/cursor-stop.mjs';
import {
  leasePath,
  readLease,
  stateRoot,
  withLeaseLock,
  writeLease,
} from '../../skills/session-observer-collab/scripts/lib/lease-state.mjs';
import {
  beginAdapterWait,
  claimAdapterTrigger,
} from '../../skills/session-observer-collab/scripts/lib/runtime-adapter.mjs';

const roots: string[] = [];
const START = 1_700_000_000_000;

async function fixture() {
  const temporaryHome = await mkdtemp(join(tmpdir(), 'cursor-hook-'));
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
  return { root, cwd, transcript, transcriptStore };
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

async function writeCursorFrames(
  transcript: string,
  frames: Array<Record<string, unknown>>,
) {
  await writeFile(
    transcript,
    frames.map((frame) => `${JSON.stringify(frame)}\n`).join(''),
  );
}

async function frameContinuity(transcript: string, nextFrameIndex: number) {
  const contents = await readFile(transcript);
  const frameEnds: number[] = [];
  for (let offset = 0; offset < contents.byteLength; offset += 1) {
    if (contents[offset] === 0x0a) frameEnds.push(offset + 1);
  }
  if (nextFrameIndex > frameEnds.length)
    throw new Error('nextFrameIndex exceeds the closed frame count');
  const prefixBytes = nextFrameIndex === 0 ? 0 : frameEnds[nextFrameIndex - 1];
  const metadata = await stat(transcript);
  return {
    indexBase: 'zero-based-jsonl-frame-index' as const,
    nextFrameIndex,
    prefixBytes,
    prefixSha256: createHash('sha256')
      .update(contents.subarray(0, prefixBytes))
      .digest('hex'),
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

async function armCursorFrameLease(
  root: string,
  cwd: string,
  transcript: string,
  frames: Array<Record<string, unknown>>,
  nextFrameIndex = 0,
  overrides: Record<string, string | number> = {},
): Promise<any> {
  await writeCursorFrames(transcript, frames);
  const armed = await armLease(root, cwd, transcript, {
    peerRuntime: 'cursor',
    ...overrides,
  });
  return writeLease(root, {
    ...armed.lease,
    peerCursor: nextFrameIndex,
    peerContinuity: await frameContinuity(transcript, nextFrameIndex),
  } as any);
}

const humanFrame = (text: string) => ({
  role: 'user',
  message: { content: [{ type: 'text', text }] },
});
const assistantFrame = (text: string) => ({
  role: 'assistant',
  message: { content: [{ type: 'text', text }] },
});
const terminalFrame = (status: string) => ({ type: 'turn_ended', status });

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

function digestWithEntries(
  entries: Array<Record<string, unknown>>,
  fromIndex = 0,
  totalRecords = entries.length,
) {
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
  test.each([
    [
      'synthetic control',
      [
        humanFrame(
          '<session_observer_wake automatic="true" schema_version="2" runtime="codex" lease_id="lease-1" peer="cursor:peer-1" index_base="zero-based-jsonl-frame-index" records="0-2">Review.</session_observer_wake>',
        ),
        assistantFrame('Acknowledged.'),
        terminalFrame('success'),
      ],
    ],
    [
      'no-op',
      [
        humanFrame('Check for peer changes.'),
        assistantFrame('[no-op] no substantive peer delta'),
        terminalFrame('success'),
      ],
    ],
    [
      'metadata-only',
      [
        { type: 'metadata', source: 'synthetic-fixture' },
        terminalFrame('success'),
      ],
    ],
  ] as const)(
    'advances a completed Cursor v2 %s range without spending continuation budget',
    async (_classification, frames) => {
      const { root, cwd, transcript } = await fixture();
      await armCursorFrameLease(root, cwd, transcript, [...frames], 0, {
        waitMs: 1,
      });
      const moments = [START + 1, START + 1, START + 1, START + 2, START + 2];

      await expect(
        runCursorStopHook(event(), {
          root,
          now: () => moments.shift() ?? START + 2,
          sleep: async () => {},
        }),
      ).resolves.toBeNull();
      expect(await readLease(root, 'cursor-1')).toMatchObject({
        state: 'idle',
        peerCursor: frames.length,
        peerContinuity: { nextFrameIndex: frames.length },
        continuationCount: 0,
        loopCount: 0,
      });
    },
  );

  test.each([
    [
      'closed no-op',
      [
        humanFrame('Check the already completed result.'),
        assistantFrame('[no-op] no substantive peer delta'),
        terminalFrame('success'),
      ],
    ],
    [
      'automatic acknowledgement',
      [
        humanFrame(
          '<session_observer_wake automatic="true" schema_version="2" runtime="codex" lease_id="lease-suffix" peer="cursor:peer-1" index_base="zero-based-jsonl-frame-index" records="3-5">Review.</session_observer_wake>',
        ),
        assistantFrame('Acknowledged.'),
        terminalFrame('success'),
      ],
    ],
    ['metadata-only', [{ type: 'metadata', source: 'synthetic-safe-suffix' }]],
  ] as const)(
    'claims a substantive Cursor completion before a %s suffix',
    async (_classification, suffix) => {
      const { root, cwd, transcript } = await fixture();
      await armCursorFrameLease(
        root,
        cwd,
        transcript,
        [
          humanFrame('Produce one substantive result.'),
          assistantFrame('Substantive result before the safe suffix.'),
          terminalFrame('success'),
          ...suffix,
        ],
        0,
        { waitMs: 1 },
      );
      const moments = [
        START + 1,
        START + 1,
        START + 1,
        START + 1,
        START + 2,
        START + 2,
      ];

      await expect(
        runCursorStopHook(event(), {
          root,
          now: () => moments.shift() ?? START + 2,
          sleep: async () => {},
        }),
      ).resolves.toEqual({ followup_message: expect.any(String) });
      expect(await readLease(root, 'cursor-1')).toMatchObject({
        peerCursor: 3,
        peerContinuity: { nextFrameIndex: 3 },
        continuationCount: 1,
      });
    },
  );

  test('does not emit or spend twice when Cursor repeats the same Stop event', async () => {
    const { root, cwd, transcript } = await fixture();
    await armCursorFrameLease(
      root,
      cwd,
      transcript,
      [
        humanFrame('Review the completed range once.'),
        assistantFrame('One completed substantive result.'),
        terminalFrame('success'),
      ],
      0,
      { waitMs: 1 },
    );

    await expect(
      runCursorStopHook(event(), {
        root,
        now: () => START + 1,
      }),
    ).resolves.toEqual({ followup_message: expect.any(String) });
    const moments = [START + 2, START + 2, START + 2, START + 3, START + 3];
    await expect(
      runCursorStopHook(event(), {
        root,
        now: () => moments.shift() ?? START + 3,
        sleep: async () => {},
      }),
    ).resolves.toBeNull();

    expect(await readLease(root, 'cursor-1')).toMatchObject({
      state: 'idle',
      peerCursor: 3,
      peerContinuity: { nextFrameIndex: 3 },
      continuationCount: 1,
      loopCount: 1,
    });
  });

  test('wakes once for a completed Cursor prefix and leaves a later pending turn unread', async () => {
    const { root, cwd, transcript } = await fixture();
    await armCursorFrameLease(
      root,
      cwd,
      transcript,
      [
        humanFrame('Review the completed prefix.'),
        assistantFrame('The completed prefix is ready.'),
        terminalFrame('success'),
        humanFrame('Start a later turn.'),
        assistantFrame('This later turn is still pending.'),
      ],
      0,
      { waitMs: 1 },
    );

    await expect(
      runCursorStopHook(event(), {
        root,
        now: () => START + 1,
      }),
    ).resolves.toEqual({
      followup_message: expect.stringContaining('records="0-2"'),
    });
    expect(await readLease(root, 'cursor-1')).toMatchObject({
      state: 'armed',
      peerCursor: 3,
      peerContinuity: { nextFrameIndex: 3 },
      continuationCount: 1,
      loopCount: 1,
      diagnostic: null,
    });

    const moments = [START + 2, START + 2, START + 2, START + 3, START + 3];
    await expect(
      runCursorStopHook(event(), {
        root,
        now: () => moments.shift() ?? START + 3,
        sleep: async () => {},
      }),
    ).resolves.toBeNull();
    expect(await readLease(root, 'cursor-1')).toMatchObject({
      state: 'idle',
      peerCursor: 3,
      peerContinuity: { nextFrameIndex: 3 },
      continuationCount: 1,
      loopCount: 1,
      diagnostic: 'wait-timeout',
    });
  });

  test.each(['expired', 'disarmed'])(
    'does not observe or mutate an explicitly %s Cursor lease',
    async (state) => {
      const { root, cwd, transcript } = await fixture();
      const lease = await armCursorFrameLease(root, cwd, transcript, [
        humanFrame('This range must remain unread.'),
        assistantFrame('This output must not wake the owner.'),
        terminalFrame('success'),
      ]);
      if (state === 'disarmed') {
        await disarm(root, 'cursor-1', START + 1);
      }
      let observed = 0;

      await expect(
        runCursorStopHook(event(), {
          root,
          now: () => (state === 'expired' ? START + 60_001 : START + 2),
          observe: async () => {
            observed += 1;
            return digest();
          },
        }),
      ).resolves.toBeNull();
      expect(observed).toBe(0);
      expect(await readLease(root, 'cursor-1')).toMatchObject({
        leaseId: lease.leaseId,
        state: state === 'disarmed' ? 'disarmed' : 'armed',
        peerCursor: 0,
        peerContinuity: lease.peerContinuity,
        continuationCount: 0,
        loopCount: 0,
      });
    },
  );

  test('waits through a pending frame range and claims only after terminal success', async () => {
    const { root, cwd, transcript } = await fixture();
    await armCursorFrameLease(root, cwd, transcript, [
      humanFrame('Inspect the frame boundary.'),
      assistantFrame('The completed result is ready.'),
    ]);
    let currentNow = START + 1;
    let slept = 0;

    const result = await runCursorStopHook(event(), {
      root,
      now: () => currentNow,
      sleep: async () => {
        slept += 1;
        await appendFile(
          transcript,
          `${JSON.stringify(terminalFrame('success'))}\n`,
        );
        currentNow += 1;
      },
    });

    expect(slept).toBe(1);
    expect(result?.followup_message).toContain('records="0-2"');
    expect(await readLease(root, 'cursor-1')).toMatchObject({
      peerCursor: 3,
      peerContinuity: {
        indexBase: 'zero-based-jsonl-frame-index',
        nextFrameIndex: 3,
      },
      continuationCount: 1,
      loopCount: 1,
    });
  });

  test.each(['aborted', 'error', 'cancelled', 'unknown'])(
    'consumes a terminal %s frame range without spending a continuation',
    async (status) => {
      const { root, cwd, transcript } = await fixture();
      await armCursorFrameLease(
        root,
        cwd,
        transcript,
        [
          humanFrame('Inspect the non-success boundary.'),
          assistantFrame('This result must remain suppressed.'),
          terminalFrame(status),
        ],
        0,
        { waitMs: 1 },
      );
      const moments = [START + 1, START + 1, START + 1, START + 2, START + 2];

      await expect(
        runCursorStopHook(event(), {
          root,
          now: () => moments.shift() ?? START + 2,
          sleep: async () => {},
        }),
      ).resolves.toBeNull();
      expect(await readLease(root, 'cursor-1')).toMatchObject({
        state: 'idle',
        peerCursor: 3,
        peerContinuity: {
          nextFrameIndex: 3,
        },
        continuationCount: 0,
        loopCount: 0,
      });
    },
  );

  test.each(['aborted', 'error', 'cancelled', 'unknown'])(
    'rejects a selected success rewritten to %s before the trigger CAS',
    async (status) => {
      const { root, cwd, transcript } = await fixture();
      const frames = [
        humanFrame('Inspect the selected success boundary.'),
        assistantFrame('This result was initially successful.'),
        terminalFrame('success'),
      ];
      const lease = await armCursorFrameLease(root, cwd, transcript, frames);

      await expect(
        runCursorStopHook(event(), {
          root,
          now: () => START + 1,
          beforeCursorUpdate: async () => {
            await writeCursorFrames(transcript, [
              ...frames.slice(0, -1),
              {
                ...terminalFrame(status),
                padding: 'preserve-or-grow-the-observed-file-size',
              },
            ]);
          },
        }),
      ).resolves.toBeNull();
      expect(await readLease(root, 'cursor-1')).toMatchObject({
        state: 'idle',
        peerCursor: 0,
        peerContinuity: lease.peerContinuity,
        continuationCount: 0,
        loopCount: 0,
      });
    },
  );

  test('rejects a selected success when its transcript inode changes before the trigger CAS', async () => {
    const { root, cwd, transcript } = await fixture();
    const frames = [
      humanFrame('Inspect the selected file identity.'),
      assistantFrame('This result was initially successful.'),
      terminalFrame('success'),
    ];
    const lease = await armCursorFrameLease(root, cwd, transcript, frames);

    await expect(
      runCursorStopHook(event(), {
        root,
        now: () => START + 1,
        beforeCursorUpdate: async () => {
          const replacement = `${transcript}.replacement`;
          await writeCursorFrames(replacement, frames);
          expect((await stat(replacement)).ino).not.toBe(
            (await stat(transcript)).ino,
          );
          await rm(transcript);
          await rename(replacement, transcript);
        },
      }),
    ).resolves.toBeNull();
    expect(await readLease(root, 'cursor-1')).toMatchObject({
      state: 'idle',
      peerCursor: 0,
      peerContinuity: lease.peerContinuity,
      continuationCount: 0,
      loopCount: 0,
    });
  });

  test.each([
    ['wait deadline', { waitMs: 5, leaseMs: 20 }, 'wait-timeout'],
    ['lease expiry', { waitMs: 20, leaseMs: 5 }, 'lease-expired'],
  ])(
    'does not wake or spend budget when selected-prefix work crosses the %s',
    async (_boundary, overrides, diagnostic) => {
      const { root, cwd, transcript } = await fixture();
      const lease = await armCursorFrameLease(
        root,
        cwd,
        transcript,
        [
          humanFrame('Check the authorization clock.'),
          assistantFrame('The result completed before the boundary.'),
          terminalFrame('success'),
        ],
        0,
        overrides,
      );
      let currentNow = START + 1;

      await expect(
        runCursorStopHook(event(), {
          root,
          now: () => currentNow,
          beforeCursorUpdate: async () => {
            currentNow = START + 6;
          },
        }),
      ).resolves.toBeNull();
      expect(await readLease(root, 'cursor-1')).toMatchObject({
        state: 'idle',
        diagnostic,
        peerCursor: 0,
        peerContinuity: lease.peerContinuity,
        continuationCount: 0,
        loopCount: 0,
      });
    },
  );

  test.each([
    ['wait deadline', { waitMs: 5, leaseMs: 20 }, 'wait-timeout'],
    ['lease expiry', { waitMs: 20, leaseMs: 5 }, 'lease-expired'],
  ])(
    'refreshes %s authorization after final continuity validation waits on the trigger lock',
    async (_boundary, overrides, diagnostic) => {
      const { root, cwd, transcript } = await fixture();
      const lease = await armCursorFrameLease(
        root,
        cwd,
        transcript,
        [
          humanFrame('Check locked trigger authorization.'),
          assistantFrame('The completed result must not wake late.'),
          terminalFrame('success'),
        ],
        0,
        overrides,
      );
      let clockReads = 0;
      let blocker: Promise<void> | undefined;

      await expect(
        runCursorStopHook(event(), {
          root,
          now: () => {
            clockReads += 1;
            return clockReads >= 4 ? START + 6 : START + 1;
          },
          beforeCursorUpdate: async () => {
            let locked!: () => void;
            const lockHeld = new Promise<void>((resolve) => {
              locked = resolve;
            });
            blocker = withLeaseLock(leasePath(root, 'cursor-1'), async () => {
              locked();
              await new Promise((resolve) => setTimeout(resolve, 25));
            });
            await lockHeld;
          },
        }),
      ).resolves.toBeNull();
      await blocker;

      expect(clockReads).toBeGreaterThanOrEqual(4);
      expect(await readLease(root, 'cursor-1')).toMatchObject({
        state: 'idle',
        diagnostic,
        peerCursor: 0,
        peerContinuity: lease.peerContinuity,
        continuationCount: 0,
        loopCount: 0,
      });
    },
  );

  test('fails closed on a malformed frame without advancing private continuity', async () => {
    const { root, cwd, transcript } = await fixture();
    const lease = await armCursorFrameLease(root, cwd, transcript, [
      humanFrame('Inspect malformed input.'),
    ]);
    await appendFile(transcript, '{malformed}\n');

    await expect(
      runCursorStopHook(event(), {
        root,
        now: () => START + 1,
      }),
    ).resolves.toBeNull();
    expect(await readLease(root, 'cursor-1')).toMatchObject({
      peerCursor: lease.peerCursor,
      peerContinuity: lease.peerContinuity,
      continuationCount: 0,
      loopCount: 0,
    });
  });

  test.each(['shrink', 'replacement'])(
    'fails closed on transcript %s without observing or changing the private frame range',
    async (failure) => {
      const { root, cwd, transcript } = await fixture();
      const frames = [
        humanFrame('Inspect continuity.'),
        assistantFrame('Completed continuity result.'),
        terminalFrame('success'),
      ];
      const lease = await armCursorFrameLease(root, cwd, transcript, frames, 3);
      if (failure === 'shrink') {
        await writeCursorFrames(transcript, frames.slice(0, 1));
      } else {
        await rm(transcript);
        await writeCursorFrames(transcript, frames);
      }
      let observed = 0;

      await expect(
        runCursorStopHook(event(), {
          root,
          observe: async () => {
            observed += 1;
            return digest();
          },
        }),
      ).resolves.toBeNull();
      expect(observed).toBe(0);
      expect(await readLease(root, 'cursor-1')).toEqual(lease);
    },
  );

  test('consumes a no-op completion, idles, and ignores late output', async () => {
    const { root, cwd, transcript } = await fixture();
    await armCursorFrameLease(
      root,
      cwd,
      transcript,
      [
        humanFrame('Check for peer changes.'),
        assistantFrame('[no-op] no substantive peer delta'),
        terminalFrame('success'),
      ],
      0,
      { waitMs: 1 },
    );
    const moments = [START + 1, START + 1, START + 1, START + 2, START + 2];

    await expect(
      runCursorStopHook(event(), {
        root,
        now: () => moments.shift() ?? START + 2,
        sleep: async () => {},
      }),
    ).resolves.toBeNull();
    expect(await readLease(root, 'cursor-1')).toMatchObject({
      state: 'idle',
      peerCursor: 3,
      peerContinuity: { nextFrameIndex: 3 },
      continuationCount: 0,
    });

    await appendFile(
      transcript,
      [
        humanFrame('Late direction.'),
        assistantFrame('Late substantive result.'),
        terminalFrame('success'),
      ]
        .map((frame) => `${JSON.stringify(frame)}\n`)
        .join(''),
    );
    let observed = 0;
    await expect(
      runCursorStopHook(event({ generation_id: 'generation-2' }), {
        root,
        observe: async () => {
          observed += 1;
          return digest(3);
        },
      }),
    ).resolves.toBeNull();
    expect(observed).toBe(0);
    expect(await readLease(root, 'cursor-1')).toMatchObject({
      state: 'idle',
      peerCursor: 3,
      peerContinuity: { nextFrameIndex: 3 },
    });
  });

  test('claims only the unconsumed successful frame range and enforces the cap', async () => {
    const { root, cwd, transcript } = await fixture();
    const lease = await armCursorFrameLease(
      root,
      cwd,
      transcript,
      [
        humanFrame('Old failed direction.'),
        assistantFrame('Old failed result.'),
        terminalFrame('error'),
        humanFrame('New direction.'),
        assistantFrame('New completed result.'),
        terminalFrame('success'),
      ],
      3,
      { continuationCap: 1, loopCap: 2 },
    );

    const result = await runCursorStopHook(event(), {
      root,
      now: () => START + 1,
    });

    expect(result?.followup_message).toContain('records="3-5"');
    expect(await readLease(root, 'cursor-1')).toMatchObject({
      state: 'triggered',
      leaseId: lease.leaseId,
      peerCursor: 6,
      peerContinuity: { nextFrameIndex: 6 },
      continuationCount: 1,
      continuationCap: 1,
      loopCount: 1,
    });
  });

  test.each([
    ['device', { device: 1 }],
    ['inode', { inode: 1 }],
    ['prefix', { prefixSha256: 'f'.repeat(64) }],
  ])(
    'rejects a private continuity %s mismatch before observing or mutating the lease',
    async (_label, mismatch) => {
      const { root, cwd, transcript } = await fixture();
      const lease = await armCursorPeerLease(root, cwd, transcript);
      const before = await writeLease(root, {
        ...lease,
        peerContinuity: {
          ...lease.peerContinuity!,
          ...mismatch,
        },
      } as any);
      let observed = 0;

      await expect(
        runCursorStopHook(event(), {
          root,
          now: () => START + 1,
          observe: async () => {
            observed += 1;
            return digest();
          },
        }),
      ).resolves.toBeNull();

      expect(observed).toBe(0);
      expect(await readLease(root, 'cursor-1')).toEqual(before);
    },
  );

  test('threads the next private checkpoint through the trigger CAS route', async () => {
    const { root, cwd, transcript } = await fixture();
    const lease = await armCursorPeerLease(root, cwd, transcript);
    const invocation = {
      runtime: 'cursor',
      peerRuntime: 'cursor',
      peerSession: 'peer-1',
      ownerSession: 'cursor-1',
      cwd,
      transcript,
      now: START + 1,
    };
    await expect(
      claimAdapterTrigger(
        root,
        invocation,
        {
          leaseId: lease.leaseId,
          peerCursor: 0,
          continuationCount: 0,
          loopCount: 0,
        },
        {
          peerCursor: 1,
          loopIncrement: 1,
          terminal: false,
        } as any,
      ),
    ).resolves.toMatchObject({
      triggered: false,
      reason: 'continuity-required',
    });
    expect(await readLease(root, 'cursor-1')).toEqual(lease);

    const waiting = await beginAdapterWait(root, invocation);
    const nextContinuity = await continuity(transcript, 3);
    const claimed = await claimAdapterTrigger(
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
        loopIncrement: 1,
        terminal: false,
      } as any,
    );

    expect(waiting.waiting).toBe(true);
    expect(claimed).toMatchObject({
      triggered: true,
      lease: {
        peerCursor: 3,
        peerContinuity: nextContinuity,
        continuationCount: 1,
        loopCount: 1,
      },
    });
  });

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

    await expect(
      runCursorStopHook(event({ status: 'error' }), options),
    ).resolves.toBeNull();
    await expect(
      runCursorStopHook(event({ status: 'aborted' }), options),
    ).resolves.toBeNull();
    await expect(
      runCursorStopHook(event({ status: 'cancelled' }), options),
    ).resolves.toBeNull();
    await expect(
      runCursorStopHook(event({ loop_count: -1 }), options),
    ).resolves.toBeNull();
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

  test('binds a Stop payload to its exact conversation identity', async () => {
    const { root, cwd, transcript } = await fixture();
    await armLease(root, cwd, transcript);
    let observed = false;

    await expect(
      runCursorStopHook(event({ conversation_id: 'cursor-other' }), {
        root,
        observe: async () => {
          observed = true;
          return digest();
        },
      }),
    ).resolves.toBeNull();
    await expect(
      runCursorStopHook(event({ generation_id: '' }), {
        root,
        observe: async () => {
          observed = true;
          return digest();
        },
      }),
    ).resolves.toBeNull();

    expect(observed).toBe(false);
    expect(await readLease(root, 'cursor-1')).toMatchObject({
      state: 'armed',
      peerCursor: 0,
      continuationCount: 0,
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
    const moments = [START + 1, START + 1, START + 1, START + 2, START + 2];

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

  test('suppresses automatic acknowledgements and no-op turns without spending a continuation', async () => {
    const { root, cwd, transcript } = await fixture();
    await armLease(root, cwd, transcript, { waitMs: 1 });
    const moments = [START + 1, START + 1, START + 1, START + 2, START + 2];

    await expect(
      runCursorStopHook(event(), {
        root,
        now: () => moments.shift() ?? START + 2,
        observe: async () =>
          digestWithEntries([
            {
              role: 'user',
              text: '<session_observer_wake automatic="true">',
              kind: 'message',
              recordIndex: 0,
              automaticControl: { automatic: true },
            },
            {
              role: 'assistant',
              text: 'Acknowledged.',
              kind: 'message',
              recordIndex: 1,
            },
            {
              role: 'user',
              text: 'Check the peer status.',
              kind: 'message',
              recordIndex: 2,
            },
            {
              role: 'assistant',
              text: '[no-op] no substantive peer delta',
              kind: 'message',
              recordIndex: 3,
            },
          ]),
      }),
    ).resolves.toBeNull();
    expect(await readLease(root, 'cursor-1')).toMatchObject({
      state: 'idle',
      peerCursor: 4,
      continuationCount: 0,
      loopCount: 0,
    });
  });

  test('does not resume a terminal lease after a later generation without an explicit re-arm', async () => {
    const { root, cwd, transcript } = await fixture();
    await armLease(root, cwd, transcript, { continuationCap: 1, loopCap: 2 });

    await expect(
      runCursorStopHook(event(), {
        root,
        now: () => START + 1,
        observe: async () => digest(),
      }),
    ).resolves.toEqual({ followup_message: expect.any(String) });
    expect(await readLease(root, 'cursor-1')).toMatchObject({
      state: 'triggered',
      continuationCount: 1,
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
