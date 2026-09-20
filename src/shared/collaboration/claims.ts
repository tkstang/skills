import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';

import { activationStatus, DeliveryError } from './activation.js';
import { activationDirectory, collaborationPaths } from './paths.js';
import {
  canonicalRecordHash,
  CollaborationError,
  enumerateJsonRecords,
  publishImmutableRecord,
  readJsonRecord,
  type PublicationHooks,
} from './records.js';
import {
  assertBoundedString,
  assertPin,
  assertUuid,
  SCHEMA_VERSION,
  type EventClaimRecord,
  type MessageClaimRecord,
  type Pin,
  type RetryRecord,
  type InboxMessage,
  type ActivationRecord,
  type SlotClaimRecord,
  type ObservationClaimIdentity,
} from './types.js';

export interface DeliveryKey {
  messageId: string;
  retryGeneration: number;
}

export interface ClaimHooks {
  afterEventClaim?: () => void | Promise<void>;
  afterSlotClaim?: () => void | Promise<void>;
  afterMessageClaim?: () => void | Promise<void>;
  beforeFinalValidation?: () => void | Promise<void>;
}

export interface ClaimDeliveryInput {
  root: string;
  pin: Pin;
  eventKey: string;
  deliveryKeys: DeliveryKey[];
  now?: Date;
  clock?: () => Date;
  token?: string;
  hooks?: ClaimHooks;
}

export async function resolveDeliveryKeys(input: {
  root: string;
  activation: ActivationRecord;
  messages: Pick<InboxMessage, 'id'>[];
}): Promise<DeliveryKey[]> {
  const files = await enumerateJsonRecords(
    path.join(
      collaborationPaths(input.root, input.activation.collaborationId)
        .directory,
      'retries',
      input.activation.participantId,
    ),
    { root: input.root, maxEntries: 4096 },
  );
  const generations = new Map<string, number>();
  for (const file of files) {
    const retry = await readJsonRecord<RetryRecord>(file, { root: input.root });
    if (
      retry.activationId !== input.activation.id ||
      retry.participantId !== input.activation.participantId ||
      !Number.isSafeInteger(retry.retryGeneration) ||
      retry.retryGeneration < 1
    )
      throw new CollaborationError(
        'MALFORMED_RECORD',
        'retry record identity or generation is invalid',
      );
    generations.set(
      retry.messageId,
      Math.max(generations.get(retry.messageId) ?? 0, retry.retryGeneration),
    );
  }
  return input.messages.map((message) => ({
    messageId: message.id,
    retryGeneration: generations.get(message.id) ?? 0,
  }));
}

function safeKey(domain: string, value: string): string {
  return createHash('sha256')
    .update(`${domain}\0${value}`, 'utf8')
    .digest('hex');
}

function assertObservation(value: ObservationClaimIdentity): void {
  assertPin(value.owner);
  assertPin(value.peer);
  if (
    !['zero-based-jsonl-record-index', 'zero-based-jsonl-frame-index'].includes(
      value.indexBase,
    ) ||
    !Number.isSafeInteger(value.fromIndex) ||
    !Number.isSafeInteger(value.toIndex) ||
    !Number.isSafeInteger(value.nextIndex) ||
    value.fromIndex < 0 ||
    value.toIndex < value.fromIndex ||
    value.nextIndex !== value.toIndex + 1 ||
    !/^[a-f0-9]{64}$/u.test(value.selectedPrefixIdentity)
  )
    throw new TypeError('observation claim identity is invalid');
}

export function observationEventKey(input: {
  activationId: string;
  observation: ObservationClaimIdentity;
}): string {
  assertUuid(input.activationId, 'activation ID');
  assertObservation(input.observation);
  const item = input.observation;
  return safeKey(
    'agent-messaging-composed-observation-v1',
    [
      input.activationId,
      item.owner.runtime,
      item.owner.sessionId,
      item.peer.runtime,
      item.peer.sessionId,
      item.indexBase,
      item.fromIndex,
      item.toIndex,
      item.nextIndex,
      item.selectedPrefixIdentity,
    ].join('\0'),
  );
}

export async function claimObservation(input: {
  root: string;
  pin: Pin;
  eventKey: string;
  observation: ObservationClaimIdentity;
  now?: Date;
  clock?: () => Date;
  token?: string;
  hooks?: Pick<
    ClaimHooks,
    'afterEventClaim' | 'afterSlotClaim' | 'beforeFinalValidation'
  >;
}): Promise<{
  event: EventClaimRecord;
  slot: SlotClaimRecord | null;
  duplicateEvent: boolean;
  activeAfterClaim: boolean;
}> {
  assertObservation(input.observation);
  const before = await activationStatus(
    input.root,
    input.pin,
    input.now ?? new Date(),
  );
  if (!before.activation || !before.active)
    throw new DeliveryError(
      'DELIVERY_INACTIVE',
      before.notice ?? 'delivery activation is inactive',
    );
  const activation = before.activation;
  if (
    input.eventKey !==
    observationEventKey({
      activationId: activation.id,
      observation: input.observation,
    })
  )
    throw new TypeError('observation event key does not match its identity');
  const token = input.token ?? randomUUID();
  const base = {
    schemaVersion: SCHEMA_VERSION,
    activationId: activation.id,
    token,
    eventKey: input.eventKey,
    proposedDeliveryKeys: [],
    observation: input.observation,
    attemptedAt: (input.now ?? new Date()).toISOString(),
  } satisfies Omit<EventClaimRecord, 'contentHash'>;
  const claimRoot = path.join(
    activationDirectory(input.root, input.pin),
    'claims',
    activation.id,
  );
  const eventPath = path.join(
    claimRoot,
    'events',
    `${safeKey('event', input.eventKey)}.json`,
  );
  const eventResult = await publish<EventClaimRecord>(
    eventPath,
    base,
    input.root,
  ).catch(async (error) => {
    if (
      error instanceof CollaborationError &&
      error.code === 'RECORD_CONFLICT'
    ) {
      const winner = await readJsonRecord<EventClaimRecord>(eventPath, {
        root: input.root,
      });
      return {
        created: false,
        path: eventPath,
        hash: winner.contentHash,
        record: winner,
      };
    }
    throw error;
  });
  if (!eventResult.created)
    return {
      event: eventResult.record,
      slot: null,
      duplicateEvent: true,
      activeAfterClaim: false,
    };
  await input.hooks?.afterEventClaim?.();
  let slot: SlotClaimRecord | null = null;
  for (let number = 1; number <= activation.maxContinuations; number += 1) {
    const result = await publish<SlotClaimRecord>(
      path.join(claimRoot, 'slots', `${number}.json`),
      { ...base, slot: number },
      input.root,
    ).catch((error) => {
      if (
        error instanceof CollaborationError &&
        error.code === 'RECORD_CONFLICT'
      )
        return null;
      throw error;
    });
    if (result?.created) {
      slot = result.record;
      break;
    }
  }
  if (!slot)
    return {
      event: eventResult.record,
      slot: null,
      duplicateEvent: false,
      activeAfterClaim: false,
    };
  await input.hooks?.afterSlotClaim?.();
  await input.hooks?.beforeFinalValidation?.();
  const after = await activationStatus(
    input.root,
    input.pin,
    input.clock?.() ?? new Date(),
  );
  return {
    event: eventResult.record,
    slot,
    duplicateEvent: false,
    activeAfterClaim: after.active && after.activation?.id === activation.id,
  };
}

export function deliveryKey(input: DeliveryKey): string {
  assertUuid(input.messageId, 'delivery message ID');
  if (!Number.isSafeInteger(input.retryGeneration) || input.retryGeneration < 0)
    throw new TypeError('retry generation must be a non-negative integer');
  return `${input.messageId}:${input.retryGeneration}`;
}

export function watchBatchEventKey(input: {
  activationId: string;
  bindingGeneration: number;
  deliveryKeys: DeliveryKey[];
}): string {
  assertUuid(input.activationId, 'activation ID');
  const keys = input.deliveryKeys.map(deliveryKey).toSorted();
  return safeKey(
    'agent-messaging-watch-batch-v1',
    `${input.activationId}\0${input.bindingGeneration}\0${keys.join('\0')}`,
  );
}

function baseClaim(
  input: ClaimDeliveryInput,
  activationId: string,
  token: string,
  attemptedAt: string,
): Omit<EventClaimRecord, 'contentHash'> {
  assertBoundedString(input.eventKey, 'event key', 256);
  const proposedDeliveryKeys = input.deliveryKeys.map(deliveryKey).toSorted();
  if (new Set(proposedDeliveryKeys).size !== proposedDeliveryKeys.length)
    throw new TypeError('delivery keys must be unique');
  return {
    schemaVersion: SCHEMA_VERSION,
    activationId,
    token,
    eventKey: input.eventKey,
    proposedDeliveryKeys,
    attemptedAt,
  };
}

async function publish<T extends { schemaVersion: 1; contentHash: string }>(
  target: string,
  base: Omit<T, 'contentHash'>,
  root: string,
  hooks?: PublicationHooks,
) {
  const record = {
    ...base,
    contentHash: canonicalRecordHash(
      base as unknown as Record<string, unknown>,
    ),
  } as T;
  return publishImmutableRecord(target, record, { root, hooks });
}

export async function claimDelivery(input: ClaimDeliveryInput): Promise<{
  event: EventClaimRecord;
  slot: SlotClaimRecord | null;
  owned: MessageClaimRecord[];
  duplicateEvent: boolean;
  activeAfterClaim: boolean;
}> {
  const before = await activationStatus(
    input.root,
    input.pin,
    input.now ?? new Date(),
  );
  if (!before.activation || !before.active)
    throw new DeliveryError(
      'DELIVERY_INACTIVE',
      before.notice ?? 'delivery activation is inactive',
    );
  const activation = before.activation;
  const token = input.token ?? randomUUID();
  const attemptedAt = (input.now ?? new Date()).toISOString();
  const base = baseClaim(input, activation.id, token, attemptedAt);
  const claimRoot = path.join(
    activationDirectory(input.root, input.pin),
    'claims',
    activation.id,
  );
  const eventPath = path.join(
    claimRoot,
    'events',
    `${safeKey('event', input.eventKey)}.json`,
  );
  const existingEvent = await readJsonRecord<EventClaimRecord>(eventPath, {
    root: input.root,
  }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (existingEvent)
    return {
      event: existingEvent,
      slot: null,
      owned: [],
      duplicateEvent: true,
      activeAfterClaim: false,
    };
  const eventResult = await publish<EventClaimRecord>(
    eventPath,
    base,
    input.root,
  ).catch(async (error) => {
    if (
      error instanceof CollaborationError &&
      error.code === 'RECORD_CONFLICT'
    ) {
      const winner = await readJsonRecord<EventClaimRecord>(eventPath, {
        root: input.root,
      });
      return {
        created: false,
        path: eventPath,
        hash: winner.contentHash,
        record: winner,
      };
    }
    throw error;
  });
  if (!eventResult.created)
    return {
      event: eventResult.record,
      slot: null,
      owned: [],
      duplicateEvent: true,
      activeAfterClaim: false,
    };
  await input.hooks?.afterEventClaim?.();
  let slot: SlotClaimRecord | null = null;
  for (let number = 1; number <= activation.maxContinuations; number += 1) {
    const slotBase = { ...base, slot: number } satisfies Omit<
      SlotClaimRecord,
      'contentHash'
    >;
    const result = await publish<SlotClaimRecord>(
      path.join(claimRoot, 'slots', `${number}.json`),
      slotBase,
      input.root,
    ).catch((error) => {
      if (
        error instanceof CollaborationError &&
        error.code === 'RECORD_CONFLICT'
      )
        return null;
      throw error;
    });
    if (result?.created) {
      slot = result.record;
      break;
    }
  }
  if (!slot)
    return {
      event: eventResult.record,
      slot: null,
      owned: [],
      duplicateEvent: false,
      activeAfterClaim: false,
    };
  await input.hooks?.afterSlotClaim?.();
  const owned: MessageClaimRecord[] = [];
  for (const item of input.deliveryKeys) {
    const key = deliveryKey(item);
    const messageBase = {
      ...base,
      deliveryKey: key,
      messageId: item.messageId,
      retryGeneration: item.retryGeneration,
    } satisfies Omit<MessageClaimRecord, 'contentHash'>;
    const result = await publish<MessageClaimRecord>(
      path.join(claimRoot, 'messages', `${safeKey('message', key)}.json`),
      messageBase,
      input.root,
    ).catch((error) => {
      if (
        error instanceof CollaborationError &&
        error.code === 'RECORD_CONFLICT'
      )
        return null;
      throw error;
    });
    if (result?.created) owned.push(result.record);
    await input.hooks?.afterMessageClaim?.();
  }
  await input.hooks?.beforeFinalValidation?.();
  const after = await activationStatus(
    input.root,
    input.pin,
    input.clock?.() ?? new Date(),
  );
  return {
    event: eventResult.record,
    slot,
    owned,
    duplicateEvent: false,
    activeAfterClaim: after.active && after.activation?.id === activation.id,
  };
}

export async function createDeliveryRetry(input: {
  root: string;
  pin: Pin;
  priorAttemptId: string;
  messageId: string;
  now?: Date;
}): Promise<RetryRecord> {
  assertBoundedString(input.priorAttemptId, 'prior attempt ID', 128);
  assertUuid(input.messageId, 'message ID');
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
  const eventFiles = await enumerateJsonRecords(
    path.join(
      activationDirectory(input.root, input.pin),
      'claims',
      status.activation.id,
      'events',
    ),
    { root: input.root, maxEntries: 4096 },
  );
  const events = await Promise.all(
    eventFiles.map((file) =>
      readJsonRecord<EventClaimRecord>(file, { root: input.root }),
    ),
  );
  const prior = events.find(
    (event) =>
      event.token === input.priorAttemptId ||
      event.eventKey === input.priorAttemptId,
  );
  if (
    !prior ||
    !prior.proposedDeliveryKeys.some((key) =>
      key.startsWith(`${input.messageId}:`),
    )
  )
    throw new CollaborationError(
      'RECORD_CONFLICT',
      'prior attempt did not propose this message',
    );
  const priorGeneration = Math.max(
    ...prior.proposedDeliveryKeys
      .filter((key) => key.startsWith(`${input.messageId}:`))
      .map((key) => Number(key.split(':').at(-1))),
    0,
  );
  const target = path.join(
    collaborationPaths(input.root, status.activation.collaborationId).directory,
    'retries',
    status.activation.participantId,
    `${safeKey('retry', `${input.priorAttemptId}\0${input.messageId}`)}.json`,
  );
  const existing = await readJsonRecord<RetryRecord>(target, {
    root: input.root,
  }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (existing) {
    if (
      existing.activationId !== status.activation.id ||
      existing.priorAttemptId !== input.priorAttemptId ||
      existing.messageId !== input.messageId
    ) {
      throw new CollaborationError(
        'MALFORMED_RECORD',
        'retry record identity is invalid',
      );
    }
    return existing;
  }
  const base = {
    schemaVersion: SCHEMA_VERSION,
    activationId: status.activation.id,
    priorAttemptId: input.priorAttemptId,
    participantId: status.activation.participantId,
    messageId: input.messageId,
    retryGeneration: priorGeneration + 1,
    createdAt: (input.now ?? new Date()).toISOString(),
  } satisfies Omit<RetryRecord, 'contentHash'>;
  const record = {
    ...base,
    contentHash: canonicalRecordHash(
      base as unknown as Record<string, unknown>,
    ),
  };
  return (await publishImmutableRecord(target, record, { root: input.root }))
    .record;
}

export async function deliveryClaimStatus(input: {
  root: string;
  pin: Pin;
}): Promise<{
  spentSlots: number;
  remainingSlots: number;
  interruptedAttempts: string[];
  outcomeUnknown: string[];
  observationAttempts: Array<{
    attemptId: string;
    eventKey: string;
    observation: ObservationClaimIdentity;
    status: 'interrupted' | 'outcome-unknown';
  }>;
}> {
  const status = await activationStatus(input.root, input.pin);
  if (!status.activation)
    return {
      spentSlots: 0,
      remainingSlots: 0,
      interruptedAttempts: [],
      outcomeUnknown: [],
      observationAttempts: [],
    };
  const base = path.join(
    activationDirectory(input.root, input.pin),
    'claims',
    status.activation.id,
  );
  const [eventFiles, slotFiles, messageFiles] = await Promise.all([
    enumerateJsonRecords(path.join(base, 'events'), {
      root: input.root,
      maxEntries: 4096,
    }),
    enumerateJsonRecords(path.join(base, 'slots'), {
      root: input.root,
      maxEntries: status.activation.maxContinuations,
    }),
    enumerateJsonRecords(path.join(base, 'messages'), {
      root: input.root,
      maxEntries: 4096,
    }),
  ]);
  const [events, slots, messages] = await Promise.all([
    Promise.all(
      eventFiles.map((file) =>
        readJsonRecord<EventClaimRecord>(file, { root: input.root }),
      ),
    ),
    Promise.all(
      slotFiles.map((file) =>
        readJsonRecord<SlotClaimRecord>(file, { root: input.root }),
      ),
    ),
    Promise.all(
      messageFiles.map((file) =>
        readJsonRecord<MessageClaimRecord>(file, { root: input.root }),
      ),
    ),
  ]);
  const interruptedAttempts = events
    .filter(
      (event) =>
        event.observation === undefined &&
        (!slots.some((slot) => slot.token === event.token) ||
          (event.proposedDeliveryKeys.length > 0 &&
            !messages.some((message) => message.token === event.token))),
    )
    .map((event) => event.token);
  const outcomeUnknown = events
    .filter(
      (event) =>
        event.observation === undefined &&
        messages.some((message) => message.token === event.token),
    )
    .map((event) => event.token);
  const observationAttempts = events
    .filter(
      (
        event,
      ): event is EventClaimRecord & {
        observation: ObservationClaimIdentity;
      } => event.observation !== undefined,
    )
    .map((event) => ({
      attemptId: event.token,
      eventKey: event.eventKey,
      observation: event.observation,
      status: slots.some((slot) => slot.token === event.token)
        ? ('outcome-unknown' as const)
        : ('interrupted' as const),
    }));
  return {
    spentSlots: slots.length,
    remainingSlots: Math.max(
      0,
      status.activation.maxContinuations - slots.length,
    ),
    interruptedAttempts,
    outcomeUnknown,
    observationAttempts,
  };
}
