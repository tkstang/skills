import { lstat } from 'node:fs/promises';
import path from 'node:path';

import {
  resolveMember,
  resolveMemberByPin,
  type ResolvedMember,
} from './membership.js';
import { collaborationPaths } from './paths.js';
import {
  canonicalHash,
  CollaborationError,
  enumerateJsonRecords,
  publishImmutableRecord,
  readJsonRecord,
} from './records.js';
import {
  assertBoundedString,
  assertPin,
  assertUuid,
  MAX_BODY_BYTES,
  MAX_SUBJECT_BYTES,
  type AckRecord,
  type MessageKind,
  type MessagePriority,
  type MessageRecord,
  type Pin,
} from './types.js';

export interface SendMessageInput {
  root: string;
  collaborationId: string;
  senderPin: Pin;
  recipientAlias: string;
  id: string;
  kind?: MessageKind;
  priority?: MessagePriority;
  subject: string;
  body: string;
  replyTo?: { participantId: string; messageId: string } | null;
  now?: string;
}

function timestamp(value?: string): string {
  const result = value ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(result)))
    throw new TypeError('timestamp must be ISO-8601');
  return result;
}

async function assertNotClosed(
  root: string,
  collaborationId: string,
): Promise<void> {
  const closed = collaborationPaths(root, collaborationId).closed;
  const exists = await lstat(closed).then(
    () => true,
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return false;
      throw error;
    },
  );
  if (exists)
    throw new CollaborationError('RECORD_CONFLICT', 'collaboration is closed');
}

function contentFields(
  message: Omit<MessageRecord, 'contentHash' | 'createdAt'>,
): unknown {
  return message;
}

function messagePath(
  root: string,
  collaborationId: string,
  participantId: string,
  id: string,
): string {
  return path.join(
    collaborationPaths(root, collaborationId).inbox,
    participantId,
    `${id}.json`,
  );
}

async function validateReply(
  input: SendMessageInput,
  sender: ResolvedMember,
): Promise<void> {
  if (!input.replyTo) return;
  assertUuid(input.replyTo.participantId, 'reply participant ID');
  assertUuid(input.replyTo.messageId, 'reply message ID');
  const original = await readJsonRecord<MessageRecord>(
    messagePath(
      input.root,
      input.collaborationId,
      input.replyTo.participantId,
      input.replyTo.messageId,
    ),
  );
  if (
    original.from.participantId !== sender.member.participantId &&
    original.to.participantId !== sender.member.participantId
  ) {
    throw new CollaborationError(
      'RECORD_CONFLICT',
      'reply reference does not involve the sender',
    );
  }
}

export async function sendMessage(input: SendMessageInput): Promise<{
  message: MessageRecord;
  duplicate: boolean;
  staleAfterPublish: boolean;
}> {
  assertUuid(input.collaborationId, 'collaboration ID');
  assertUuid(input.id, 'message ID');
  assertPin(input.senderPin);
  assertBoundedString(input.subject, 'subject', MAX_SUBJECT_BYTES);
  assertBoundedString(input.body, 'body', MAX_BODY_BYTES, true);
  const kind = input.kind ?? 'update';
  const priority = input.priority ?? 'normal';
  if (!['request', 'update'].includes(kind))
    throw new TypeError('message kind is invalid');
  if (!['normal', 'high'].includes(priority))
    throw new TypeError('message priority is invalid');
  await assertNotClosed(input.root, input.collaborationId);
  const sender = await resolveMemberByPin(
    input.root,
    input.collaborationId,
    input.senderPin,
  );
  const recipient = await resolveMember(
    input.root,
    input.collaborationId,
    input.recipientAlias,
  );
  if (sender.departed || recipient.departed)
    throw new CollaborationError(
      'RECORD_CONFLICT',
      'departed members cannot send or receive',
    );
  if (sender.member.participantId === recipient.member.participantId) {
    throw new TypeError('self-send is not allowed');
  }
  await validateReply(input, sender);
  const withoutHash: Omit<MessageRecord, 'contentHash' | 'createdAt'> = {
    schemaVersion: 1,
    id: input.id,
    collaborationId: input.collaborationId,
    from: {
      participantId: sender.member.participantId,
      generation: sender.binding.generation,
      pin: sender.binding.pin,
    },
    to: {
      participantId: recipient.member.participantId,
      generation: recipient.binding.generation,
    },
    kind,
    priority,
    subject: input.subject,
    body: input.body,
    replyTo: input.replyTo ?? null,
  };
  const contentHash = canonicalHash(contentFields(withoutHash));
  const target = messagePath(
    input.root,
    input.collaborationId,
    recipient.member.participantId,
    input.id,
  );
  const existing = await readJsonRecord<MessageRecord>(target).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    },
  );
  if (existing) {
    if (existing.contentHash !== contentHash) {
      throw new CollaborationError(
        'RECORD_CONFLICT',
        'message ID already has different content',
      );
    }
    return { message: existing, duplicate: true, staleAfterPublish: false };
  }
  const message: MessageRecord = {
    ...withoutHash,
    createdAt: timestamp(input.now),
    contentHash,
  };
  try {
    await publishImmutableRecord(target, message, { root: input.root });
  } catch (error) {
    if (
      error instanceof CollaborationError &&
      error.code === 'RECORD_CONFLICT'
    ) {
      const winner = await readJsonRecord<MessageRecord>(target);
      if (winner.contentHash === contentHash) {
        return { message: winner, duplicate: true, staleAfterPublish: false };
      }
    }
    throw error;
  }
  const currentSender = await resolveMember(
    input.root,
    input.collaborationId,
    sender.member.alias,
  );
  const staleAfterPublish =
    currentSender.binding.generation !== sender.binding.generation;
  return { message, duplicate: false, staleAfterPublish };
}

export interface InboxInput {
  root: string;
  collaborationId: string;
  pin: Pin;
  includeAcknowledged?: boolean;
  maxMessages?: number;
  maxBytes?: number;
}

async function currentRecipient(input: InboxInput): Promise<ResolvedMember> {
  const recipient = await resolveMemberByPin(
    input.root,
    input.collaborationId,
    input.pin,
  );
  if (recipient.departed)
    throw new CollaborationError(
      'RECORD_CONFLICT',
      'departed member inbox is inert',
    );
  return recipient;
}

async function acknowledged(
  input: InboxInput,
  recipient: ResolvedMember,
  message: MessageRecord,
): Promise<boolean> {
  if (
    recipient.binding.inheritedAckRefs.some(
      (ack) =>
        ack.messageId === message.id && ack.messageHash === message.contentHash,
    )
  ) {
    return true;
  }
  const ackPath = path.join(
    collaborationPaths(input.root, input.collaborationId).acknowledgments,
    recipient.member.participantId,
    String(recipient.binding.generation),
    `${message.id}.json`,
  );
  const ack = await readJsonRecord<AckRecord>(ackPath).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    },
  );
  return ack?.messageHash === message.contentHash;
}

export async function listInbox(input: InboxInput): Promise<{
  messages: MessageRecord[];
  acknowledged: MessageRecord[];
  truncated: boolean;
}> {
  const recipient = await currentRecipient(input);
  const directory = path.join(
    collaborationPaths(input.root, input.collaborationId).inbox,
    recipient.member.participantId,
  );
  const files = await enumerateJsonRecords(directory, { maxEntries: 4096 });
  const records = await Promise.all(
    files.map((file) =>
      readJsonRecord<MessageRecord>(file, { maxBytes: MAX_BODY_BYTES + 4096 }),
    ),
  );
  const sorted = records.toSorted((left, right) => {
    const priority =
      Number(right.priority === 'high') - Number(left.priority === 'high');
    return (
      priority ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.from.pin.runtime.localeCompare(right.from.pin.runtime) ||
      left.from.pin.sessionId.localeCompare(right.from.pin.sessionId) ||
      left.id.localeCompare(right.id)
    );
  });
  const pending: MessageRecord[] = [];
  const acked: MessageRecord[] = [];
  for (const message of sorted) {
    if (await acknowledged(input, recipient, message)) acked.push(message);
    else pending.push(message);
  }
  const maxMessages = input.maxMessages ?? 8;
  const maxBytes = input.maxBytes ?? 48 * 1024;
  const selected: MessageRecord[] = [];
  let bytes = 0;
  for (const message of pending) {
    const size = Buffer.byteLength(message.body, 'utf8');
    if (selected.length >= maxMessages || bytes + size > maxBytes) break;
    selected.push(message);
    bytes += size;
  }
  return {
    messages: selected,
    acknowledged: input.includeAcknowledged ? acked : [],
    truncated: selected.length !== pending.length,
  };
}

export async function readMessage(
  input: InboxInput & { messageId: string },
): Promise<MessageRecord> {
  assertUuid(input.messageId, 'message ID');
  const recipient = await currentRecipient(input);
  return readJsonRecord<MessageRecord>(
    messagePath(
      input.root,
      input.collaborationId,
      recipient.member.participantId,
      input.messageId,
    ),
    { maxBytes: MAX_BODY_BYTES + 4096 },
  );
}

export async function acknowledgeMessage(
  input: InboxInput & { messageId: string; now?: string },
): Promise<{ ack: AckRecord; duplicate: boolean }> {
  const recipient = await currentRecipient(input);
  const message = await readMessage(input);
  const paths = collaborationPaths(input.root, input.collaborationId);
  const target = path.join(
    paths.acknowledgments,
    recipient.member.participantId,
    String(recipient.binding.generation),
    `${message.id}.json`,
  );
  const existing = await readJsonRecord<AckRecord>(target).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    },
  );
  if (existing) {
    if (existing.messageHash !== message.contentHash)
      throw new CollaborationError(
        'RECORD_CONFLICT',
        'ack hash conflicts with message',
      );
    return { ack: existing, duplicate: true };
  }
  const ack: AckRecord = {
    schemaVersion: 1,
    messageId: message.id,
    messageHash: message.contentHash,
    recipient: recipient.binding.pin,
    bindingGeneration: recipient.binding.generation,
    receivedAt: timestamp(input.now),
  };
  await publishImmutableRecord(target, ack, { root: input.root });
  const current = await resolveMember(
    input.root,
    input.collaborationId,
    recipient.member.alias,
  );
  if (current.binding.generation !== recipient.binding.generation) {
    throw new CollaborationError(
      'COMMIT_UNCERTAIN',
      'ack published during takeover and may require replay',
      true,
    );
  }
  return { ack, duplicate: false };
}
