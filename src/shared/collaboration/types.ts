import { createHash } from 'node:crypto';

export const SCHEMA_VERSION = 1 as const;
export const MAX_IDENTIFIER_BYTES = 128;
export const MAX_BODY_BYTES = 32 * 1024;
export const MAX_SUBJECT_BYTES = 256;

export type Runtime = 'codex' | 'claude-code' | 'cursor';

export interface Pin {
  runtime: Runtime;
  sessionId: string;
}

export interface HasSchemaVersion {
  schemaVersion: typeof SCHEMA_VERSION;
}

export function assertUuid(value: string, label = 'UUID'): void {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value,
    )
  ) {
    throw new TypeError(`${label} must be a UUID`);
  }
}

export function assertAlias(value: string): void {
  if (!/^[a-z][a-z0-9-]{0,31}$/u.test(value)) {
    throw new TypeError('alias must match [a-z][a-z0-9-]{0,31}');
  }
}

export function assertBoundedString(
  value: unknown,
  label: string,
  maxBytes = MAX_IDENTIFIER_BYTES,
  allowEmpty = false,
): asserts value is string {
  if (
    typeof value !== 'string' ||
    (!allowEmpty && value.length === 0) ||
    Buffer.byteLength(value, 'utf8') > maxBytes
  ) {
    throw new TypeError(`${label} must be a bounded UTF-8 string`);
  }
}

export function assertPin(value: unknown): asserts value is Pin {
  if (!value || typeof value !== 'object')
    throw new TypeError('pin must be an object');
  const pin = value as Partial<Pin>;
  if (!['codex', 'claude-code', 'cursor'].includes(pin.runtime ?? '')) {
    throw new TypeError('pin runtime is unsupported');
  }
  assertBoundedString(pin.sessionId, 'pin sessionId');
}

export function pinKey(pin: Pin): string {
  assertPin(pin);
  return createHash('sha256')
    .update(`${pin.runtime}\0${pin.sessionId}`, 'utf8')
    .digest('hex');
}

export function pinsEqual(left: Pin, right: Pin): boolean {
  return left.runtime === right.runtime && left.sessionId === right.sessionId;
}
