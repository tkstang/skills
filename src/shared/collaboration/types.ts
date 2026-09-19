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
  contentHash: string;
}

export interface MemberRecord extends HasSchemaVersion {
  alias: string;
  participantId: string;
  collaborationId: string;
  createdAt: string;
  initialBinding: BindingRecord;
  contentHash: string;
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
  contentHash: string;
}

export interface DepartureRecord extends HasSchemaVersion {
  participantId: string;
  generation: number;
  pin: Pin;
  departedAt: string;
  contentHash: string;
}

export interface ClosedRecord extends HasSchemaVersion {
  collaborationId: string;
  closedBy: Pin;
  closedAt: string;
  contentHash: string;
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
  contentHash: string;
}

export type DeliveryMechanism = 'stop' | 'monitor';
export type DeliveryController = 'standalone-messaging' | 'observer-collab';
export type ExpiryMode = 'human-idle' | 'fixed';

export interface ActivationRecord extends HasSchemaVersion {
  id: string;
  epoch: number;
  previousEpoch: number | null;
  collaborationId: string;
  participantId: string;
  bindingGeneration: number;
  pin: Pin;
  worktree: string;
  mechanism: DeliveryMechanism;
  controller: DeliveryController;
  thirdPartyHookAcknowledgment: {
    configurationFingerprint: string;
    acknowledgedAt: string;
  } | null;
  noObserverMonitorAttestation: {
    pin: Pin;
    epoch: number;
    confirmedAt: string;
  } | null;
  composedMonitorAttestation: {
    owner: Pin;
    peer: Pin;
    observerLeaseId: string;
    activationId: string;
    collaborationId: string;
    epoch: number;
    confirmedAt: string;
    oldMonitorStopped: true;
    standaloneWatcherStopped: true;
  } | null;
  startedAt: string;
  hardExpiresAt: string;
  expiryMode: ExpiryMode;
  idleTimeoutMs: number | null;
  fixedExpiresAt: string | null;
  maxContinuations: number;
  waitMs: number;
  contentHash: string;
}

export interface ActivityReceiptRecord extends HasSchemaVersion {
  activationId: string;
  eventKey: string;
  observedAt: string;
  contentHash: string;
}

export interface HumanProvenanceEvidenceRecord extends HasSchemaVersion {
  activationId: string;
  pin: Pin;
  hostVersion: string;
  surface: string;
  qualifiedAt: string;
  contentHash: string;
}

export interface ActivationRevocationRecord extends HasSchemaVersion {
  activationId: string;
  revokedAt: string;
  revokedBy: Pin;
  contentHash: string;
}

export interface EventClaimRecord extends HasSchemaVersion {
  activationId: string;
  token: string;
  eventKey: string;
  proposedDeliveryKeys: string[];
  observation?: ObservationClaimIdentity;
  attemptedAt: string;
  contentHash: string;
}

export interface ObservationClaimIdentity {
  owner: Pin;
  peer: Pin;
  indexBase: 'zero-based-jsonl-record-index' | 'zero-based-jsonl-frame-index';
  fromIndex: number;
  toIndex: number;
  nextIndex: number;
  selectedPrefixIdentity: string;
}

export interface SlotClaimRecord extends EventClaimRecord {
  slot: number;
}

export interface MessageClaimRecord extends EventClaimRecord {
  deliveryKey: string;
  messageId: string;
  retryGeneration: number;
}

export interface RetryRecord extends HasSchemaVersion {
  activationId: string;
  priorAttemptId: string;
  participantId: string;
  messageId: string;
  retryGeneration: number;
  createdAt: string;
  contentHash: string;
}

export interface DeliveryDiagnosticRecord extends HasSchemaVersion {
  attemptId: string;
  activationId: string;
  eventKey: string;
  boundary: 'prompt-start' | 'stop' | 'watch' | 'monitor' | 'manual';
  attemptKind?: 'message' | 'observation';
  observation?: ObservationClaimIdentity;
  recordedAt: string;
  stage:
    | 'event-claimed'
    | 'slot-claimed'
    | 'messages-claimed'
    | 'final-validation'
    | 'output-attempted';
  outcomeCode:
    | 'claimed'
    | 'stdout-written'
    | 'host-output-attempted'
    | 'watch-notification-attempted'
    | 'observation-notification-attempted';
  errorCode:
    | 'diagnostic-write-failed'
    | 'host-timeout'
    | 'host-protocol-error'
    | null;
  contentHash: string;
}

export interface LogEntryRecord extends HasSchemaVersion {
  id: string;
  collaborationId: string;
  category: string;
  title: string;
  author: Pin;
  authoredAt: string;
  whatHappened: string;
  assessment: string;
  skillImplication: string;
  contentHash: string;
}

export type MessageRaceStatus =
  | 'current'
  | 'closed'
  | 'sender-superseded'
  | 'recipient-superseded'
  | 'recipient-reassigned';

export interface InboxMessage extends MessageRecord {
  raceStatus: MessageRaceStatus;
  inert: boolean;
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
