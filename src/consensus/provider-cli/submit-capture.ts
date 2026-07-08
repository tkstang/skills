import { randomUUID } from 'node:crypto';
import path from 'node:path';

export const DEFAULT_SUBMIT_CAPTURE_MAX_BYTES = 1024 * 1024 * 10;
export const CONSENSUS_SUBMIT_MAX_BYTES_ENV =
  'CONSENSUS_SUBMIT_MAX_BYTES';
export const CONSENSUS_SUBMIT_CAPTURE_DIR = '.consensus/submit';

export class SubmitCaptureLimitError extends Error {
  readonly bytes: number;
  readonly maxBytes: number;

  constructor(bytes: number, maxBytes: number) {
    super(submitCaptureLimitMessage(bytes, maxBytes));
    this.bytes = bytes;
    this.maxBytes = maxBytes;
  }
}

export function submitCaptureMaxBytes(
  maxOutputBytes: number | undefined,
): number {
  return maxOutputBytes ?? DEFAULT_SUBMIT_CAPTURE_MAX_BYTES;
}

export function parseSubmitCaptureMaxBytes(
  value: string | undefined,
): number | undefined {
  if (value === undefined || value === '') {
    return DEFAULT_SUBMIT_CAPTURE_MAX_BYTES;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return undefined;
  }

  return parsed;
}

export function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

export function assertWithinSubmitCaptureLimit(
  value: string,
  maxBytes: number,
) {
  const bytes = byteLength(value);
  if (bytes > maxBytes) {
    throw new SubmitCaptureLimitError(bytes, maxBytes);
  }
}

export function submitCaptureLimitMessage(
  bytes: number,
  maxBytes: number,
) {
  return `Submitted verdict exceeds submit capture limit of ${maxBytes} bytes (${bytes} bytes).`;
}

export function submitCaptureDirectory(cwd: string): string {
  return path.resolve(cwd, CONSENSUS_SUBMIT_CAPTURE_DIR);
}

export function submitCaptureFilePath(
  cwd: string,
  id: string = randomUUID(),
): string {
  return path.join(
    submitCaptureDirectory(cwd),
    `consensus-submit-${id}.json`,
  );
}
