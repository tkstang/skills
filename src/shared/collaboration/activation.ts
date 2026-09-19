import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { isCollaborationClosed, resolveMemberByPin } from './membership.js';
import { activationDirectory } from './paths.js';
import {
  canonicalRecordHash,
  CollaborationError,
  enumerateJsonRecords,
  publishImmutableRecord,
  readJsonRecord,
} from './records.js';
import {
  assertBoundedString,
  assertPin,
  assertUuid,
  pinsEqual,
  SCHEMA_VERSION,
  type ActivationRecord,
  type ActivationRevocationRecord,
  type ActivityReceiptRecord,
  type DeliveryController,
  type DeliveryMechanism,
  type ExpiryMode,
  type Pin,
} from './types.js';

export const DEFAULT_IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;
export const MAX_ACTIVATION_DURATION_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_MAX_CONTINUATIONS = 20;
export const MAX_CONTINUATIONS = 100;
export const MAX_WAIT_MS = 60_000;
export const MAX_ACTIVITY_RECEIPTS = 4096;
export const MAX_ACTIVATION_EPOCHS = 64;

export class DeliveryError extends Error {
  readonly code: 'DELIVERY_INACTIVE' | 'DELIVERY_CONFLICT';

  constructor(
    code: 'DELIVERY_INACTIVE' | 'DELIVERY_CONFLICT',
    message: string,
  ) {
    super(message);
    this.name = 'DeliveryError';
    this.code = code;
  }
}

export interface EnableActivationInput {
  root: string;
  collaborationId: string;
  pin: Pin;
  worktree: string;
  mechanism?: DeliveryMechanism;
  controller?: DeliveryController;
  expiryMode?: ExpiryMode;
  idleTimeoutMs?: number;
  fixedDurationMs?: number;
  maxDurationMs?: number;
  maxContinuations?: number;
  waitMs?: number;
  thirdPartyHookAcknowledgment?: ActivationRecord['thirdPartyHookAcknowledgment'];
  noObserverMonitorAttestation?: ActivationRecord['noObserverMonitorAttestation'];
  noObserverMonitorConfirmed?: boolean;
  now?: Date;
  activationId?: string;
}

export type TerminationReason =
  | 'revoked'
  | 'expired'
  | 'closed'
  | 'superseded'
  | 'departed';

export interface ActivationStatus {
  activation: ActivationRecord | null;
  active: boolean;
  terminationReason: TerminationReason | null;
  effectiveExpiresAt: string | null;
  notice: string | null;
}

function timestamp(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new CollaborationError(
      'MALFORMED_RECORD',
      `${label} must be an ISO-8601 timestamp`,
    );
  }
  return parsed;
}

function assertIntegerRange(
  value: number,
  label: string,
  minimum: number,
  maximum: number,
): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(
      `${label} must be an integer from ${minimum} to ${maximum}`,
    );
  }
}

function validateActivation(record: ActivationRecord): ActivationRecord {
  try {
    assertUuid(record.id, 'activation ID');
    assertUuid(record.collaborationId, 'activation collaboration ID');
    assertUuid(record.participantId, 'activation participant ID');
    assertPin(record.pin);
    if (!path.isAbsolute(record.worktree))
      throw new TypeError('activation worktree must be absolute');
    assertIntegerRange(
      record.epoch,
      'activation epoch',
      0,
      MAX_ACTIVATION_EPOCHS - 1,
    );
    if (
      record.previousEpoch !== null &&
      record.previousEpoch !== record.epoch - 1
    ) {
      throw new TypeError(
        'activation previousEpoch must identify the contiguous predecessor',
      );
    }
    assertIntegerRange(
      record.bindingGeneration,
      'binding generation',
      0,
      Number.MAX_SAFE_INTEGER,
    );
    if (!['stop', 'monitor'].includes(record.mechanism))
      throw new TypeError('activation mechanism is unsupported');
    if (
      !['standalone-messaging', 'observer-collab'].includes(record.controller)
    ) {
      throw new TypeError('activation controller is unsupported');
    }
    if (!['human-idle', 'fixed'].includes(record.expiryMode))
      throw new TypeError('activation expiry mode is unsupported');
    timestamp(record.startedAt, 'activation startedAt');
    timestamp(record.hardExpiresAt, 'activation hardExpiresAt');
    if (record.expiryMode === 'human-idle') {
      assertIntegerRange(
        record.idleTimeoutMs ?? 0,
        'idle timeout',
        1,
        MAX_ACTIVATION_DURATION_MS,
      );
      if (record.fixedExpiresAt !== null)
        throw new TypeError('human-idle activation cannot have fixedExpiresAt');
    } else {
      if (record.idleTimeoutMs !== null)
        throw new TypeError('fixed activation cannot have idleTimeoutMs');
      if (record.fixedExpiresAt === null)
        throw new TypeError('fixed activation requires fixedExpiresAt');
      timestamp(record.fixedExpiresAt, 'activation fixedExpiresAt');
    }
    assertIntegerRange(
      record.maxContinuations,
      'max continuations',
      1,
      MAX_CONTINUATIONS,
    );
    assertIntegerRange(record.waitMs, 'wait milliseconds', 0, MAX_WAIT_MS);
    if (
      record.contentHash !==
      canonicalRecordHash(
        record as unknown as Record<string, unknown> & { contentHash: string },
      )
    )
      throw new TypeError('activation contentHash does not match content');
    return record;
  } catch (error) {
    if (error instanceof CollaborationError) throw error;
    throw new CollaborationError('MALFORMED_RECORD', (error as Error).message);
  }
}

async function activationRecords(
  root: string,
  pin: Pin,
): Promise<ActivationRecord[]> {
  const directory = path.join(activationDirectory(root, pin), 'epochs');
  const files = await enumerateJsonRecords(directory, {
    root,
    maxEntries: MAX_ACTIVATION_EPOCHS,
  });
  for (const file of files) {
    if (!/^(0|[1-9][0-9]*)\.json$/u.test(path.basename(file))) {
      throw new CollaborationError(
        'MALFORMED_RECORD',
        'activation epoch filename is invalid',
      );
    }
  }
  const records = await Promise.all(
    files.map(async (file) =>
      validateActivation(
        await readJsonRecord<ActivationRecord>(file, { root }),
      ),
    ),
  );
  records.sort((left, right) => left.epoch - right.epoch);
  for (const [index, record] of records.entries()) {
    if (
      record.epoch !== index ||
      record.previousEpoch !== (index === 0 ? null : index - 1)
    ) {
      throw new CollaborationError(
        'MALFORMED_RECORD',
        'activation epochs are not contiguous',
      );
    }
    if (!pinsEqual(record.pin, pin))
      throw new CollaborationError(
        'MALFORMED_RECORD',
        'activation pin does not match its namespace',
      );
  }
  return records;
}

async function isRevoked(
  root: string,
  pin: Pin,
  activationId: string,
): Promise<boolean> {
  return readJsonRecord<ActivationRevocationRecord>(
    path.join(
      activationDirectory(root, pin),
      'revoked',
      `${activationId}.json`,
    ),
    { root },
  ).then(
    (record) => {
      if (
        record.activationId !== activationId ||
        record.contentHash !==
          canonicalRecordHash(
            record as unknown as Record<string, unknown> & {
              contentHash: string;
            },
          )
      ) {
        throw new CollaborationError(
          'MALFORMED_RECORD',
          'activation revocation is invalid',
        );
      }
      return true;
    },
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return false;
      throw error;
    },
  );
}

async function activityReceipts(
  root: string,
  activation: ActivationRecord,
): Promise<ActivityReceiptRecord[]> {
  const directory = path.join(
    activationDirectory(root, activation.pin),
    'activity',
    activation.id,
  );
  const files = await enumerateJsonRecords(directory, {
    root,
    maxEntries: MAX_ACTIVITY_RECEIPTS,
  });
  const receipts = await Promise.all(
    files.map(async (file) => {
      const record = await readJsonRecord<ActivityReceiptRecord>(file, {
        root,
        maxBytes: 8192,
      });
      if (
        record.activationId !== activation.id ||
        record.contentHash !==
          canonicalRecordHash(
            record as unknown as Record<string, unknown> & {
              contentHash: string;
            },
          )
      ) {
        throw new CollaborationError(
          'MALFORMED_RECORD',
          'activity receipt is invalid',
        );
      }
      assertBoundedString(record.eventKey, 'activity event key', 256);
      timestamp(record.observedAt, 'activity observedAt');
      return record;
    }),
  );
  return receipts.toSorted(
    (left, right) =>
      left.observedAt.localeCompare(right.observedAt) ||
      left.eventKey.localeCompare(right.eventKey),
  );
}

export async function effectiveActivationExpiry(
  root: string,
  activation: ActivationRecord,
): Promise<string> {
  validateActivation(activation);
  const started = timestamp(activation.startedAt, 'activation startedAt');
  const hard = timestamp(activation.hardExpiresAt, 'activation hardExpiresAt');
  if (activation.expiryMode === 'fixed') {
    return new Date(
      Math.min(
        hard,
        timestamp(activation.fixedExpiresAt!, 'activation fixedExpiresAt'),
      ),
    ).toISOString();
  }
  let liveThrough = Math.min(hard, started + activation.idleTimeoutMs!);
  for (const receipt of await activityReceipts(root, activation)) {
    const observed = timestamp(receipt.observedAt, 'activity observedAt');
    if (observed < started || observed > liveThrough) {
      throw new CollaborationError(
        'MALFORMED_RECORD',
        'activity receipt crosses an expired activation gap',
      );
    }
    liveThrough = Math.min(hard, observed + activation.idleTimeoutMs!);
  }
  return new Date(liveThrough).toISOString();
}

export async function activationStatus(
  root: string,
  pin: Pin,
  now = new Date(),
): Promise<ActivationStatus> {
  assertPin(pin);
  const records = await activationRecords(root, pin);
  const activation = records.at(-1) ?? null;
  if (!activation)
    return {
      activation: null,
      active: false,
      terminationReason: null,
      effectiveExpiresAt: null,
      notice: null,
    };
  if (await isRevoked(root, pin, activation.id))
    return {
      activation,
      active: false,
      terminationReason: 'revoked',
      effectiveExpiresAt: await effectiveActivationExpiry(root, activation),
      notice:
        'Delivery is disabled. Re-enable explicitly to resume automatic checks.',
    };
  if (await isCollaborationClosed(root, activation.collaborationId))
    return {
      activation,
      active: false,
      terminationReason: 'closed',
      effectiveExpiresAt: await effectiveActivationExpiry(root, activation),
      notice:
        'The collaboration is closed; delivery remains manual/history-only.',
    };
  const member = await resolveMemberByPin(
    root,
    activation.collaborationId,
    pin,
  ).catch((error) => {
    if ((error as { code?: string }).code === 'NOT_CURRENT_MEMBER') return null;
    throw error;
  });
  if (
    !member ||
    member.binding.generation !== activation.bindingGeneration ||
    member.member.participantId !== activation.participantId
  ) {
    return {
      activation,
      active: false,
      terminationReason: 'superseded',
      effectiveExpiresAt: await effectiveActivationExpiry(root, activation),
      notice:
        'Delivery ownership was superseded; the current session must enable a new epoch.',
    };
  }
  if (member.departed)
    return {
      activation,
      active: false,
      terminationReason: 'departed',
      effectiveExpiresAt: await effectiveActivationExpiry(root, activation),
      notice: 'The participant departed; automatic delivery is inactive.',
    };
  const effectiveExpiresAt = await effectiveActivationExpiry(root, activation);
  if (now.getTime() > Date.parse(effectiveExpiresAt))
    return {
      activation,
      active: false,
      terminationReason: 'expired',
      effectiveExpiresAt,
      notice:
        'Delivery expired with mail still queued. Re-enable explicitly after inspecting the inbox.',
    };
  return {
    activation,
    active: true,
    terminationReason: null,
    effectiveExpiresAt,
    notice: null,
  };
}

export async function enableActivation(
  input: EnableActivationInput,
): Promise<ActivationRecord> {
  assertPin(input.pin);
  if (!path.isAbsolute(input.worktree))
    throw new TypeError('activation worktree must be absolute');
  const member = await resolveMemberByPin(
    input.root,
    input.collaborationId,
    input.pin,
  );
  if (member.departed)
    throw new CollaborationError(
      'RECORD_CONFLICT',
      'departed member cannot activate delivery',
    );
  if (await isCollaborationClosed(input.root, input.collaborationId))
    throw new CollaborationError(
      'RECORD_CONFLICT',
      'closed collaboration cannot activate delivery',
    );
  const existing = await activationRecords(input.root, input.pin);
  if (existing.length >= MAX_ACTIVATION_EPOCHS)
    throw new CollaborationError(
      'CAPACITY_EXCEEDED',
      'activation epoch capacity is exhausted',
    );
  if (existing.length > 0) {
    const status = await activationStatus(
      input.root,
      input.pin,
      input.now ?? new Date(),
    );
    if (status.active)
      throw new DeliveryError(
        'DELIVERY_CONFLICT',
        'an automatic delivery activation is already active for this exact session',
      );
  }
  const now = input.now ?? new Date();
  const startedAt = now.toISOString();
  const maxDurationMs = input.maxDurationMs ?? MAX_ACTIVATION_DURATION_MS;
  if (
    !Number.isSafeInteger(maxDurationMs) ||
    maxDurationMs <= 0 ||
    maxDurationMs > MAX_ACTIVATION_DURATION_MS
  )
    throw new TypeError('max duration must be within 24 hours');
  const expiryMode = input.expiryMode ?? 'fixed';
  const idleTimeoutMs =
    expiryMode === 'human-idle'
      ? (input.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS)
      : null;
  if (
    idleTimeoutMs !== null &&
    (!Number.isSafeInteger(idleTimeoutMs) ||
      idleTimeoutMs <= 0 ||
      idleTimeoutMs > MAX_ACTIVATION_DURATION_MS)
  )
    throw new TypeError('idle timeout must be within 24 hours');
  const fixedDurationMs =
    expiryMode === 'fixed'
      ? (input.fixedDurationMs ?? DEFAULT_IDLE_TIMEOUT_MS)
      : null;
  if (
    fixedDurationMs !== null &&
    (!Number.isSafeInteger(fixedDurationMs) ||
      fixedDurationMs <= 0 ||
      fixedDurationMs > maxDurationMs)
  )
    throw new TypeError('fixed expiry must fit the activation duration');
  const epoch = existing.length;
  const base = {
    schemaVersion: SCHEMA_VERSION,
    id: input.activationId ?? randomUUID(),
    epoch,
    previousEpoch: epoch === 0 ? null : epoch - 1,
    collaborationId: input.collaborationId,
    participantId: member.member.participantId,
    bindingGeneration: member.binding.generation,
    pin: input.pin,
    worktree: path.resolve(input.worktree),
    mechanism: input.mechanism ?? 'stop',
    controller: input.controller ?? 'standalone-messaging',
    thirdPartyHookAcknowledgment: input.thirdPartyHookAcknowledgment ?? null,
    noObserverMonitorAttestation:
      input.noObserverMonitorAttestation ??
      (input.noObserverMonitorConfirmed
        ? { pin: input.pin, epoch, confirmedAt: startedAt }
        : null),
    startedAt,
    hardExpiresAt: new Date(now.getTime() + maxDurationMs).toISOString(),
    expiryMode,
    idleTimeoutMs,
    fixedExpiresAt:
      fixedDurationMs === null
        ? null
        : new Date(now.getTime() + fixedDurationMs).toISOString(),
    maxContinuations: input.maxContinuations ?? DEFAULT_MAX_CONTINUATIONS,
    waitMs: input.waitMs ?? 0,
  } satisfies Omit<ActivationRecord, 'contentHash'>;
  const activation: ActivationRecord = {
    ...base,
    contentHash: canonicalRecordHash(
      base as unknown as Record<string, unknown>,
    ),
  };
  validateActivation(activation);
  await publishImmutableRecord(
    path.join(
      activationDirectory(input.root, input.pin),
      'epochs',
      `${epoch}.json`,
    ),
    activation,
    { root: input.root },
  );
  if (await isCollaborationClosed(input.root, input.collaborationId))
    throw new CollaborationError(
      'RECORD_CONFLICT',
      'activation published during closure and is inert',
    );
  return activation;
}

export async function recordHumanActivity(input: {
  root: string;
  pin: Pin;
  eventKey: string;
  now?: Date;
}): Promise<ActivityReceiptRecord> {
  const status = await activationStatus(
    input.root,
    input.pin,
    input.now ?? new Date(),
  );
  if (!status.activation || !status.active)
    throw new DeliveryError(
      'DELIVERY_INACTIVE',
      status.notice ?? 'delivery activation is inactive',
    );
  if (status.activation.expiryMode !== 'human-idle')
    throw new DeliveryError(
      'DELIVERY_CONFLICT',
      'fixed-expiry activation cannot be renewed',
    );
  assertBoundedString(input.eventKey, 'human event key', 256);
  const base = {
    schemaVersion: SCHEMA_VERSION,
    activationId: status.activation.id,
    eventKey: input.eventKey,
    observedAt: (input.now ?? new Date()).toISOString(),
  } satisfies Omit<ActivityReceiptRecord, 'contentHash'>;
  const record: ActivityReceiptRecord = {
    ...base,
    contentHash: canonicalRecordHash(
      base as unknown as Record<string, unknown>,
    ),
  };
  const safeKey = await import('node:crypto').then(({ createHash }) =>
    createHash('sha256').update(`human\0${input.eventKey}`).digest('hex'),
  );
  await publishImmutableRecord(
    path.join(
      activationDirectory(input.root, input.pin),
      'activity',
      status.activation.id,
      `${safeKey}.json`,
    ),
    record,
    { root: input.root },
  );
  return record;
}

export async function disableActivation(input: {
  root: string;
  pin: Pin;
  now?: Date;
}): Promise<ActivationRevocationRecord> {
  const status = await activationStatus(
    input.root,
    input.pin,
    input.now ?? new Date(),
  );
  if (!status.activation)
    throw new DeliveryError(
      'DELIVERY_INACTIVE',
      'no activation exists for this session',
    );
  const base = {
    schemaVersion: SCHEMA_VERSION,
    activationId: status.activation.id,
    revokedAt: (input.now ?? new Date()).toISOString(),
    revokedBy: input.pin,
  } satisfies Omit<ActivationRevocationRecord, 'contentHash'>;
  const record: ActivationRevocationRecord = {
    ...base,
    contentHash: canonicalRecordHash(
      base as unknown as Record<string, unknown>,
    ),
  };
  await publishImmutableRecord(
    path.join(
      activationDirectory(input.root, input.pin),
      'revoked',
      `${record.activationId}.json`,
    ),
    record,
    { root: input.root },
  );
  return record;
}
