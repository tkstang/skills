/**
 * Streaming LF-only line reader for JSONL session stores.
 *
 * Records are split on the LF byte (0x0A) only. `readline` is not used,
 * because transcript string values can contain U+2028/U+2029, which some
 * line readers treat as line terminators. A trailing CR is stripped.
 *
 * Lines longer than `maxLineBytes` are never decoded unless the caller's
 * `keepOversize` callback accepts the line from its first bytes; otherwise
 * they are reported as skipped without buffering their contents.
 */
import { open } from 'node:fs/promises';

/** Bytes of an oversize line handed to `keepOversize` for inspection. */
export const OVERSIZE_PREFIX_BYTES = 512;
/** Hard cap on an accepted oversize line; longer lines are dropped. */
export const DEFAULT_MAX_OVERSIZE_BYTES = 32 * 1024 * 1024;
const CHUNK_BYTES = 256 * 1024;

export type LineEvent =
  | { kind: 'line'; text: string }
  | {
      kind: 'oversize';
      /** The full line when `keepOversize` accepted it, else `null`. */
      text: string | null;
      /** The first bytes of the line, decoded (may end mid-character). */
      prefix: string;
      bytes: number;
    };

export interface ReadLinesOptions {
  maxLineBytes: number;
  /** Decide from the first bytes whether an oversize line is kept whole. */
  keepOversize?: (prefix: string) => boolean;
  maxOversizeBytes?: number;
  /** Absolute epoch-ms deadline; reading stops once it passes. */
  deadline?: number | null;
}

export interface ReadLinesResult {
  bytesRead: number;
  /** True when the callback asked to stop. */
  stopped: boolean;
  /** True when the deadline passed before the file was fully read. */
  timedOut: boolean;
}

/**
 * Stream `file` line by line. The callback returns `false` to stop early.
 * Blank lines are skipped. Throws only when the file cannot be opened.
 */
export async function readLines(
  file: string,
  options: ReadLinesOptions,
  onLine: (event: LineEvent) => boolean | void,
): Promise<ReadLinesResult> {
  const maxOversize = options.maxOversizeBytes ?? DEFAULT_MAX_OVERSIZE_BYTES;
  const handle = await open(file, 'r');
  const chunk = Buffer.allocUnsafe(CHUNK_BYTES);
  let parts: Buffer[] = [];
  let lineBytes = 0;
  let mode: 'normal' | 'keep' | 'drop' = 'normal';
  let prefix = '';
  let bytesRead = 0;
  let stopped = false;
  let timedOut = false;

  const append = (slice: Buffer) => {
    if (slice.length === 0) return;
    lineBytes += slice.length;
    if (mode === 'normal') {
      parts.push(Buffer.from(slice));
      if (lineBytes > options.maxLineBytes) {
        const head = Buffer.concat(parts).subarray(0, OVERSIZE_PREFIX_BYTES);
        prefix = head.toString('utf8');
        mode = options.keepOversize?.(prefix) ? 'keep' : 'drop';
        if (mode === 'drop') parts = [];
      }
      return;
    }
    if (mode === 'keep') {
      if (lineBytes > maxOversize) {
        mode = 'drop';
        parts = [];
        return;
      }
      parts.push(Buffer.from(slice));
    }
  };

  const decode = (buffer: Buffer): string => {
    const end =
      buffer.length > 0 && buffer[buffer.length - 1] === 0x0d
        ? buffer.length - 1
        : buffer.length;
    return buffer.toString('utf8', 0, end);
  };

  /** Emit the buffered line; returns false when the caller stops. */
  const finish = (): boolean => {
    if (lineBytes === 0) return true;
    let event: LineEvent | null;
    if (mode === 'normal') {
      const text = decode(parts.length === 1 ? parts[0] : Buffer.concat(parts));
      event = text.trim() === '' ? null : { kind: 'line', text };
    } else {
      event = {
        kind: 'oversize',
        text: mode === 'keep' ? decode(Buffer.concat(parts)) : null,
        prefix,
        bytes: lineBytes,
      };
    }
    parts = [];
    lineBytes = 0;
    mode = 'normal';
    prefix = '';
    return event === null ? true : onLine(event) !== false;
  };

  try {
    outer: for (;;) {
      if (options.deadline != null && Date.now() >= options.deadline) {
        timedOut = true;
        break;
      }
      const { bytesRead: count } = await handle.read(
        chunk,
        0,
        CHUNK_BYTES,
        null,
      );
      if (count === 0) break;
      bytesRead += count;
      const view = chunk.subarray(0, count);
      let position = 0;
      while (position < count) {
        const newline = view.indexOf(0x0a, position);
        if (newline === -1) {
          append(view.subarray(position));
          break;
        }
        // Fast path: a whole line inside this chunk needs no copy.
        if (lineBytes === 0 && newline - position <= options.maxLineBytes) {
          const text = decode(view.subarray(position, newline));
          position = newline + 1;
          if (text.trim() === '') continue;
          if (onLine({ kind: 'line', text }) === false) {
            stopped = true;
            break outer;
          }
          continue;
        }
        append(view.subarray(position, newline));
        position = newline + 1;
        if (!finish()) {
          stopped = true;
          break outer;
        }
      }
    }
    if (!stopped && !timedOut && !finish()) stopped = true;
  } finally {
    await handle.close().catch(() => {});
  }
  return { bytesRead, stopped, timedOut };
}

/** Parse one JSONL line into a plain object, or `null` when it is not one. */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
