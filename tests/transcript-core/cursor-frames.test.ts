import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  scanCursorTranscript,
  type CursorTranscriptFrame,
} from '../../src/transcript/core/cursor-frames.js';

const fixtureDirectory = new URL(
  '../session-observer/fixtures/cursor/',
  import.meta.url,
);
const temporaryDirectories: string[] = [];

async function fixturePath(file: string): Promise<string> {
  return new URL(file, fixtureDirectory).pathname;
}

async function scanFixture(
  file: string,
  verifyPrefixBytes?: number,
): Promise<{
  frames: CursorTranscriptFrame[];
  scan: Awaited<ReturnType<typeof scanCursorTranscript>>;
}> {
  const frames: CursorTranscriptFrame[] = [];
  const scan = await scanCursorTranscript(await fixturePath(file), {
    verifyPrefixBytes,
    onFrame(frame) {
      frames.push(frame);
    },
  });
  return { frames, scan };
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('scanCursorTranscript', () => {
  it('reports zero-based physical indexes and exact closed-frame byte ranges', async () => {
    const bytes = await readFile(
      new URL('framed-closed.jsonl', fixtureDirectory),
    );
    const lines = bytes.toString('utf8').split('\n');
    lines.pop();
    const boundaries = lines.map((line) => Buffer.byteLength(line) + 1);
    const { frames, scan } = await scanFixture('framed-closed.jsonl');

    expect(
      frames.map(({ frameIndex, byteStart, byteEnd, closed, parseState }) => ({
        frameIndex,
        byteStart,
        byteEnd,
        closed,
        parseState,
      })),
    ).toEqual([
      {
        frameIndex: 0,
        byteStart: 0,
        byteEnd: boundaries[0],
        closed: true,
        parseState: 'parsed',
      },
      {
        frameIndex: 1,
        byteStart: boundaries[0],
        byteEnd: boundaries[0] + boundaries[1],
        closed: true,
        parseState: 'parsed',
      },
      {
        frameIndex: 2,
        byteStart: boundaries[0] + boundaries[1],
        byteEnd: bytes.length,
        closed: true,
        parseState: 'parsed',
      },
    ]);
    expect(scan).toMatchObject({
      indexBase: 'zero-based-jsonl-frame-index',
      totalFrames: 3,
      safeThroughFrame: 2,
      safePrefixBytes: bytes.length,
      safePrefixSha256: sha256(bytes),
      verifiedPrefixSha256: null,
      blockingFrame: null,
      file: {
        size: bytes.length,
      },
    });
    expect(scan.file.device).toEqual(expect.any(Number));
    expect(scan.file.inode).toEqual(expect.any(Number));
  });

  it('counts blank physical frames without collapsing indexes', async () => {
    const { frames, scan } = await scanFixture('framed-blank-lines.jsonl');

    expect(frames.map((frame) => frame.frameIndex)).toEqual([0, 1, 2, 3]);
    expect(frames.map((frame) => frame.parseState)).toEqual([
      'parsed',
      'blank',
      'parsed',
      'blank',
    ]);
    expect(frames[1].record).toBeNull();
    expect(scan.safeThroughFrame).toBe(3);
  });

  it('fails closed at a malformed middle frame while preserving later physical positions', async () => {
    const bytes = await readFile(
      new URL('framed-malformed-middle.jsonl', fixtureDirectory),
    );
    const firstBoundary = bytes.indexOf(0x0a) + 1;
    const { frames, scan } = await scanFixture('framed-malformed-middle.jsonl');

    expect(frames.map((frame) => frame.frameIndex)).toEqual([0, 1, 2]);
    expect(frames.map((frame) => frame.parseState)).toEqual([
      'parsed',
      'malformed',
      'parsed',
    ]);
    expect(scan.safeThroughFrame).toBe(0);
    expect(scan.safePrefixBytes).toBe(firstBoundary);
    expect(scan.safePrefixSha256).toBe(
      sha256(bytes.subarray(0, firstBoundary)),
    );
    expect(scan.blockingFrame).toEqual({
      frameIndex: 1,
      byteStart: firstBoundary,
      byteEnd: frames[1].byteEnd,
      parseState: 'malformed',
    });
  });

  it('classifies a parseable unterminated tail as partial', async () => {
    const { frames, scan } = await scanFixture(
      'framed-unterminated-tail.jsonl',
    );

    expect(frames.map((frame) => frame.parseState)).toEqual([
      'parsed',
      'partial',
    ]);
    expect(frames[1]).toMatchObject({
      frameIndex: 1,
      closed: false,
      record: null,
    });
    expect(scan.blockingFrame).toMatchObject({
      frameIndex: 1,
      parseState: 'partial',
    });
    expect(scan.safeThroughFrame).toBe(0);
  });

  it('recovers a repaired blocker from the last verified safe boundary', async () => {
    const before = await scanFixture('framed-repair-before.jsonl');
    const after = await scanFixture(
      'framed-repair-after.jsonl',
      before.scan.safePrefixBytes,
    );

    expect(before.scan.blockingFrame?.frameIndex).toBe(1);
    expect(after.scan.blockingFrame).toBeNull();
    expect(after.scan.safeThroughFrame).toBe(2);
    expect(after.scan.verifiedPrefixSha256).toBe(before.scan.safePrefixSha256);
  });

  it('snapshots the requested verified prefix while permitting appended bytes', async () => {
    const beforeBytes = await readFile(
      new URL('framed-append-before.jsonl', fixtureDirectory),
    );
    const before = await scanFixture('framed-append-before.jsonl');
    const after = await scanFixture(
      'framed-append-after.jsonl',
      beforeBytes.length,
    );

    expect(before.scan.safePrefixBytes).toBe(beforeBytes.length);
    expect(after.scan.verifiedPrefixSha256).toBe(before.scan.safePrefixSha256);
    expect(after.scan.safePrefixBytes).toBeGreaterThan(beforeBytes.length);
    expect(after.scan.safePrefixSha256).not.toBe(before.scan.safePrefixSha256);
  });

  it('detects same-length prefix replacement through the verified snapshot', async () => {
    const beforeBytes = await readFile(
      new URL('framed-replacement-before.jsonl', fixtureDirectory),
    );
    const before = await scanFixture('framed-replacement-before.jsonl');
    const after = await scanFixture(
      'framed-replacement-after.jsonl',
      beforeBytes.length,
    );

    expect(after.scan.safePrefixBytes).toBe(before.scan.safePrefixBytes);
    expect(after.scan.verifiedPrefixSha256).not.toBe(
      before.scan.safePrefixSha256,
    );
  });

  it('returns no verified snapshot when the requested prefix exceeds the file', async () => {
    const bytes = await readFile(
      new URL('framed-closed.jsonl', fixtureDirectory),
    );
    const { scan } = await scanFixture('framed-closed.jsonl', bytes.length + 1);

    expect(scan.verifiedPrefixSha256).toBeNull();
  });

  it('awaits per-frame callbacks in source order', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cursor-frames-'));
    temporaryDirectories.push(directory);
    const transcriptPath = join(directory, 'transcript.jsonl');
    await writeFile(transcriptPath, '{"a":1}\n{"b":2}\n', 'utf8');
    const observed: number[] = [];

    const scan = await scanCursorTranscript(transcriptPath, {
      async onFrame(frame) {
        await Promise.resolve();
        observed.push(frame.frameIndex);
      },
    });

    expect(observed).toEqual([0, 1]);
    expect(scan.totalFrames).toBe(2);
  });
});
