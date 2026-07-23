import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';

import type { JsonObject } from './runtimes.js';

export type CursorFrameParseState =
  | 'parsed'
  | 'blank'
  | 'malformed'
  | 'partial';

export interface CursorTranscriptFrame {
  frameIndex: number;
  byteStart: number;
  byteEnd: number;
  closed: boolean;
  parseState: CursorFrameParseState;
  record: JsonObject | null;
}

export interface CursorFrameIssue {
  frameIndex: number;
  byteStart: number;
  byteEnd: number;
  parseState: 'malformed' | 'partial';
}

export interface CursorTranscriptScan {
  indexBase: 'zero-based-jsonl-frame-index';
  totalFrames: number;
  safeThroughFrame: number | null;
  safePrefixBytes: number;
  safePrefixSha256: string;
  verifiedPrefixSha256: string | null;
  file: {
    size: number;
    mtimeMs: number;
    device: number | null;
    inode: number | null;
  };
  blockingFrame: CursorFrameIssue | null;
}

export interface CursorTranscriptScanOptions {
  verifyPrefixBytes?: number;
  onFrame(frame: CursorTranscriptFrame): void | Promise<void>;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseClosedFrame(
  frameBytes: Buffer,
): Pick<CursorTranscriptFrame, 'parseState' | 'record'> {
  if (frameBytes.length === 0) {
    return { parseState: 'blank', record: null };
  }

  try {
    const value: unknown = JSON.parse(frameBytes.toString('utf8'));
    if (!isJsonObject(value)) {
      return { parseState: 'malformed', record: null };
    }
    return { parseState: 'parsed', record: value };
  } catch {
    return { parseState: 'malformed', record: null };
  }
}

function optionalFileIdentity(value: number): number | null {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function validateVerifyPrefixBytes(value: number | undefined): void {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
    throw new TypeError('verifyPrefixBytes must be a non-negative integer');
  }
}

export async function scanCursorTranscript(
  transcriptPath: string,
  options: CursorTranscriptScanOptions,
): Promise<CursorTranscriptScan> {
  validateVerifyPrefixBytes(options.verifyPrefixBytes);

  const handle = await open(transcriptPath, 'r');
  try {
    const file = await handle.stat();
    const safePrefixHash = createHash('sha256');
    const verifiedPrefixHash =
      options.verifyPrefixBytes === undefined ? null : createHash('sha256');
    let verifiedBytes = 0;
    let verifiedPrefixSha256: string | null =
      options.verifyPrefixBytes === 0
        ? createHash('sha256').digest('hex')
        : null;
    let carry = Buffer.alloc(0);
    let carryByteStart = 0;
    let frameIndex = 0;
    let safeThroughFrame: number | null = null;
    let safePrefixBytes = 0;
    let blockingFrame: CursorFrameIssue | null = null;

    const updateVerifiedHash = (chunk: Buffer): void => {
      if (
        verifiedPrefixHash === null ||
        options.verifyPrefixBytes === undefined ||
        verifiedBytes >= options.verifyPrefixBytes
      ) {
        return;
      }

      const remaining = options.verifyPrefixBytes - verifiedBytes;
      const bytes = chunk.subarray(0, Math.min(chunk.length, remaining));
      verifiedPrefixHash.update(bytes);
      verifiedBytes += bytes.length;
    };

    const emitClosedFrame = async (
      contentBytes: Buffer,
      rawFrameBytes: Buffer,
      byteStart: number,
    ): Promise<void> => {
      const parsed = parseClosedFrame(contentBytes);
      const frame: CursorTranscriptFrame = {
        frameIndex,
        byteStart,
        byteEnd: byteStart + rawFrameBytes.length,
        closed: true,
        ...parsed,
      };

      if (
        blockingFrame === null &&
        (frame.parseState === 'parsed' || frame.parseState === 'blank')
      ) {
        safePrefixHash.update(rawFrameBytes);
        safeThroughFrame = frame.frameIndex;
        safePrefixBytes = frame.byteEnd;
      } else if (blockingFrame === null) {
        blockingFrame = {
          frameIndex: frame.frameIndex,
          byteStart: frame.byteStart,
          byteEnd: frame.byteEnd,
          parseState: 'malformed',
        };
      }

      await options.onFrame(frame);
      frameIndex += 1;
    };

    if (file.size > 0) {
      const stream = handle.createReadStream({
        autoClose: false,
        start: 0,
        end: file.size - 1,
      });

      for await (const streamChunk of stream) {
        const chunk = Buffer.isBuffer(streamChunk)
          ? streamChunk
          : Buffer.from(streamChunk);
        updateVerifiedHash(chunk);

        let chunkOffset = 0;
        while (chunkOffset < chunk.length) {
          const newlineOffset = chunk.indexOf(0x0a, chunkOffset);
          if (newlineOffset === -1) {
            const suffix = chunk.subarray(chunkOffset);
            carry =
              carry.length === 0
                ? Buffer.from(suffix)
                : Buffer.concat([carry, suffix]);
            break;
          }

          const segment = chunk.subarray(chunkOffset, newlineOffset);
          const contentBytes =
            carry.length === 0 ? segment : Buffer.concat([carry, segment]);
          const rawFrameBytes = Buffer.concat([
            contentBytes,
            Buffer.from('\n'),
          ]);
          await emitClosedFrame(contentBytes, rawFrameBytes, carryByteStart);
          carry = Buffer.alloc(0);
          chunkOffset = newlineOffset + 1;
          carryByteStart += rawFrameBytes.length;
        }
      }
    }

    if (carry.length > 0) {
      const frame: CursorTranscriptFrame = {
        frameIndex,
        byteStart: carryByteStart,
        byteEnd: carryByteStart + carry.length,
        closed: false,
        parseState: 'partial',
        record: null,
      };
      if (blockingFrame === null) {
        blockingFrame = {
          frameIndex: frame.frameIndex,
          byteStart: frame.byteStart,
          byteEnd: frame.byteEnd,
          parseState: 'partial',
        };
      }
      await options.onFrame(frame);
      frameIndex += 1;
    }

    if (
      verifiedPrefixHash !== null &&
      options.verifyPrefixBytes !== undefined &&
      options.verifyPrefixBytes > 0 &&
      verifiedBytes === options.verifyPrefixBytes
    ) {
      verifiedPrefixSha256 = verifiedPrefixHash.digest('hex');
    }

    return {
      indexBase: 'zero-based-jsonl-frame-index',
      totalFrames: frameIndex,
      safeThroughFrame,
      safePrefixBytes,
      safePrefixSha256: safePrefixHash.digest('hex'),
      verifiedPrefixSha256,
      file: {
        size: file.size,
        mtimeMs: file.mtimeMs,
        device: optionalFileIdentity(file.dev),
        inode: optionalFileIdentity(file.ino),
      },
      blockingFrame,
    };
  } finally {
    await handle.close();
  }
}
