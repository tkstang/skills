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

export interface CollaborationRecord extends HasSchemaVersion {
  id: string;
  label: string;
  task: string;
  createdAt: string;
}

export interface MemberRecord extends HasSchemaVersion {
  alias: string;
  participantId: string;
  collaborationId: string;
  createdAt: string;
}

export interface AckReference {
  messageId: string;
  messageHash: string;
}

export interface BindingRecord extends HasSchemaVersion {
  participantId: string;
  generation: number;
  pin: Pin;
  worktree: string;
  previousPin: Pin | null;
  reason: string;
  createdAt: string;
  inheritedAckRefs: AckReference[];
}

export interface DepartureRecord extends HasSchemaVersion {
  participantId: string;
  generation: number;
  pin: Pin;
  departedAt: string;
}

export interface ClosedRecord extends HasSchemaVersion {
  collaborationId: string;
  closedBy: Pin;
  closedAt: string;
}

export type MessageKind = 'request' | 'update';
export type MessagePriority = 'normal' | 'high';

export interface MessageRecord extends HasSchemaVersion {
  id: string;
  collaborationId: string;
  from: {
    participantId: string;
    generation: number;
    pin: Pin;
  };
  to: {
    participantId: string;
    generation: number;
  };
  kind: MessageKind;
  priority: MessagePriority;
  subject: string;
  body: string;
  replyTo: { participantId: string; messageId: string } | null;
  createdAt: string;
  contentHash: string;
}

export interface AckRecord extends HasSchemaVersion {
  messageId: string;
  messageHash: string;
  recipient: Pin;
  bindingGeneration: number;
  receivedAt: string;
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
