import { randomUUID } from 'node:crypto';
import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';

import { collaborationPaths, memberBindingDirectory } from './paths.js';
import {
  CollaborationError,
  canonicalHash,
  canonicalRecordHash,
  enumerateJsonRecords,
  publishImmutableRecord,
  readJsonRecord,
  type PublicationResult,
} from './records.js';
import {
  assertAlias,
  assertBoundedString,
  assertPin,
  assertUuid,
  pinsEqual,
  type BindingRecord,
  type AckRecord,
  type ClosedRecord,
  type CollaborationRecord,
  type DepartureRecord,
  type MemberRecord,
  type MessageRecord,
  type Pin,
} from './types.js';

export type MembershipErrorCode =
  | 'COLLABORATION_CLOSED'
  | 'MEMBER_DEPARTED'
  | 'MEMBER_NOT_FOUND'
  | 'NOT_CURRENT_MEMBER'
  | 'STALE_BINDING';

export class MembershipError extends Error {
  readonly code: MembershipErrorCode;

  constructor(code: MembershipErrorCode, message: string) {
    super(message);
    this.name = 'MembershipError';
    this.code = code;
  }
}

interface CommonMembershipInput {
  root: string;
  collaborationId: string;
  now?: string;
}

export interface JoinInput extends CommonMembershipInput {
  alias: string;
  pin: Pin;
  worktree: string;
  hooks?: {
    afterAliasPublish?: () => void | Promise<void>;
    afterBindingPublish?: () => void | Promise<void>;
  };
}

function timestamp(value?: string): string {
  const result = value ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(result)))
    throw new TypeError('timestamp must be ISO-8601');
  return result;
}

function withContentHash<T extends Record<string, unknown>>(
  record: T,
): T & { contentHash: string } {
  return { ...record, contentHash: canonicalRecordHash(record) };
}

async function canonicalWorktree(value: string): Promise<string> {
  if (!path.isAbsolute(value)) throw new TypeError('worktree must be absolute');
  const info = await lstat(value).catch(() => null);
  if (!info) return path.resolve(value);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new TypeError('worktree must be a directory');
  return realpath(value);
}

export async function isCollaborationClosed(
  root: string,
  collaborationId: string,
): Promise<boolean> {
  const file = collaborationPaths(root, collaborationId).closed;
  return readJsonRecord<ClosedRecord>(file).then(
    () => true,
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return false;
      throw error;
    },
  );
}

async function assertOpen(
  root: string,
  collaborationId: string,
): Promise<void> {
  if (await isCollaborationClosed(root, collaborationId)) {
    throw new MembershipError(
      'COLLABORATION_CLOSED',
      'collaboration is closed',
    );
  }
}

export async function openCollaboration(
  input: JoinInput & { label: string; task: string },
): Promise<{ collaboration: CollaborationRecord; member: ResolvedMember }> {
  assertUuid(input.collaborationId, 'collaboration ID');
  assertBoundedString(input.label, 'label', 128);
  assertBoundedString(input.task, 'task', 2048);
  const createdAt = timestamp(input.now);
  const paths = collaborationPaths(input.root, input.collaborationId);
  const collaboration: CollaborationRecord = withContentHash({
    schemaVersion: 1 as const,
    id: input.collaborationId,
    label: input.label,
    task: input.task,
    createdAt,
  });
  await publishImmutableRecord(paths.collaboration, collaboration, {
    root: input.root,
  });
  const joined = await joinCollaboration({ ...input, now: createdAt });
  return { collaboration, member: joined.member };
}

export async function joinCollaboration(
  input: JoinInput,
): Promise<{ member: ResolvedMember; closedRace: boolean }> {
  assertAlias(input.alias);
  assertPin(input.pin);
  await assertOpen(input.root, input.collaborationId);
  const paths = collaborationPaths(input.root, input.collaborationId);
  await readJsonRecord<CollaborationRecord>(paths.collaboration);
  const createdAt = timestamp(input.now);
  const participantId = randomUUID();
  const worktree = await canonicalWorktree(input.worktree);
  const binding: BindingRecord = withContentHash({
    schemaVersion: 1 as const,
    participantId,
    generation: 0,
    pin: input.pin,
    worktree,
    previousPin: null,
    reason: 'initial join',
    createdAt,
    inheritedAckRefs: [],
  });
  const member: MemberRecord = withContentHash({
    schemaVersion: 1 as const,
    alias: input.alias,
    participantId,
    collaborationId: input.collaborationId,
    createdAt,
    initialBinding: binding,
  });
  const memberTarget = path.join(paths.members, `${input.alias}.json`);
  const existingMember = await readJsonRecord<MemberRecord>(memberTarget).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    },
  );
  if (!existingMember) {
    const members = await enumerateJsonRecords(paths.members, {
      maxEntries: 128,
    });
    if (members.length >= 128) {
      throw new CollaborationError(
        'CAPACITY_EXCEEDED',
        'collaboration already has 128 members',
      );
    }
  }
  try {
    await publishImmutableRecord(memberTarget, member, { root: input.root });
    await input.hooks?.afterAliasPublish?.();
  } catch (error) {
    if (
      !(error instanceof CollaborationError) ||
      error.code !== 'RECORD_CONFLICT'
    )
      throw error;
    const existing = await readJsonRecord<MemberRecord>(memberTarget);
    if (pinsEqual(existing.initialBinding.pin, input.pin)) {
      const recovered = await resolveMember(
        input.root,
        input.collaborationId,
        input.alias,
      );
      const closedRace = await isCollaborationClosed(
        input.root,
        input.collaborationId,
      );
      if (closedRace)
        throw new MembershipError(
          'COLLABORATION_CLOSED',
          'join recovered during closure and is inert',
        );
      if (
        recovered.departed ||
        recovered.binding.generation !== 0 ||
        !pinsEqual(recovered.binding.pin, input.pin)
      ) {
        throw new MembershipError(
          'STALE_BINDING',
          `alias ${input.alias} initial binding is no longer current`,
        );
      }
      return { member: recovered, closedRace };
    }
    throw new MembershipError(
      'STALE_BINDING',
      `alias ${input.alias} already belongs to another participant`,
    );
  }
  await publishImmutableRecord(
    path.join(memberBindingDirectory(paths, participantId), '0.json'),
    binding,
    { root: input.root },
  );
  await input.hooks?.afterBindingPublish?.();
  const closedRace = await isCollaborationClosed(
    input.root,
    input.collaborationId,
  );
  if (closedRace) {
    throw new MembershipError(
      'COLLABORATION_CLOSED',
      'join published during closure and is inert',
    );
  }
  return { member: { member, binding, departed: false }, closedRace };
}

export interface ResolvedMember {
  member: MemberRecord;
  binding: BindingRecord;
  departed: boolean;
}

export async function resolveMember(
  root: string,
  collaborationId: string,
  alias: string,
): Promise<ResolvedMember> {
  assertAlias(alias);
  const paths = collaborationPaths(root, collaborationId);
  let member: MemberRecord;
  try {
    member = await readJsonRecord<MemberRecord>(
      path.join(paths.members, `${alias}.json`),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new MembershipError(
        'MEMBER_NOT_FOUND',
        `member ${alias} does not exist`,
      );
    }
    throw error;
  }
  const bindingFiles = await enumerateJsonRecords(
    memberBindingDirectory(paths, member.participantId),
    { maxEntries: 64 },
  );
  if (bindingFiles.length === 0) {
    await publishImmutableRecord(
      path.join(memberBindingDirectory(paths, member.participantId), '0.json'),
      member.initialBinding,
      { root },
    );
    bindingFiles.push(
      path.join(memberBindingDirectory(paths, member.participantId), '0.json'),
    );
  }
  const bindings = await Promise.all(
    bindingFiles.map((file) => readJsonRecord<BindingRecord>(file)),
  );
  const binding = bindings.toSorted(
    (left, right) => right.generation - left.generation,
  )[0];
  if (!binding)
    throw new MembershipError('MEMBER_NOT_FOUND', 'member has no binding');
  const departureFile = path.join(
    paths.departures,
    member.participantId,
    `${binding.generation}.json`,
  );
  const departed = await readJsonRecord<DepartureRecord>(departureFile).then(
    (departure) => {
      if (!pinsEqual(departure.pin, binding.pin)) {
        throw new CollaborationError(
          'MALFORMED_RECORD',
          'departure pin does not match its binding',
        );
      }
      return true;
    },
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return false;
      throw error;
    },
  );
  return { member, binding, departed };
}

export async function resolveMemberByPin(
  root: string,
  collaborationId: string,
  pin: Pin,
): Promise<ResolvedMember> {
  assertPin(pin);
  const paths = collaborationPaths(root, collaborationId);
  const files = await enumerateJsonRecords(paths.members, { maxEntries: 128 });
  for (const file of files) {
    const member = await readJsonRecord<MemberRecord>(file);
    const resolved = await resolveMember(root, collaborationId, member.alias);
    if (pinsEqual(resolved.binding.pin, pin)) return resolved;
  }
  throw new MembershipError(
    'NOT_CURRENT_MEMBER',
    'pin is not a current collaboration member',
  );
}

export async function takeOverMembership(
  input: JoinInput & { expectedPreviousPin: Pin; reason: string },
): Promise<{ member: ResolvedMember; closedRace: boolean }> {
  assertPin(input.pin);
  assertPin(input.expectedPreviousPin);
  assertBoundedString(input.reason, 'takeover reason', 512);
  await assertOpen(input.root, input.collaborationId);
  const current = await resolveMember(
    input.root,
    input.collaborationId,
    input.alias,
  );
  if (current.departed)
    throw new MembershipError(
      'MEMBER_DEPARTED',
      'departed member cannot be taken over',
    );
  if (!pinsEqual(current.binding.pin, input.expectedPreviousPin)) {
    throw new MembershipError(
      'STALE_BINDING',
      'expected previous pin is not current',
    );
  }
  if (current.binding.generation >= 63) {
    throw new CollaborationError(
      'CAPACITY_EXCEEDED',
      'member already has the maximum 64 binding generations',
    );
  }
  const paths = collaborationPaths(input.root, input.collaborationId);
  const ackDirectory = path.join(
    paths.acknowledgments,
    current.member.participantId,
    String(current.binding.generation),
  );
  const ackFiles = await enumerateJsonRecords(ackDirectory, {
    maxEntries: 4096,
  });
  const ackRecords = await Promise.all(
    ackFiles.map((file) => readJsonRecord<AckRecord>(file)),
  );
  const acknowledgedMessages = await Promise.all(
    ackRecords.map((ack) =>
      readJsonRecord<MessageRecord>(
        path.join(
          paths.inbox,
          current.member.participantId,
          `${ack.messageId}.json`,
        ),
      ),
    ),
  );
  if (
    ackRecords.some((ack, index) => {
      const message = acknowledgedMessages[index];
      return (
        ack.bindingGeneration !== current.binding.generation ||
        !pinsEqual(ack.recipient, current.binding.pin) ||
        message?.contentHash !== ack.messageHash
      );
    })
  ) {
    throw new CollaborationError(
      'MALFORMED_RECORD',
      'acknowledgment identity does not match its binding',
    );
  }
  const inheritedAckRefs = [
    ...current.binding.inheritedAckRefs,
    ...ackRecords.map((ack) => ({
      messageId: ack.messageId,
      messageHash: ack.messageHash,
    })),
  ].filter(
    (ack, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.messageId === ack.messageId &&
          candidate.messageHash === ack.messageHash,
      ) === index,
  );
  const binding: BindingRecord = withContentHash({
    schemaVersion: 1 as const,
    participantId: current.member.participantId,
    generation: current.binding.generation + 1,
    pin: input.pin,
    worktree: await canonicalWorktree(input.worktree),
    previousPin: current.binding.pin,
    reason: input.reason,
    createdAt: timestamp(input.now),
    inheritedAckRefs,
  });
  try {
    await publishImmutableRecord(
      path.join(
        memberBindingDirectory(paths, current.member.participantId),
        `${binding.generation}.json`,
      ),
      binding,
      { root: input.root },
    );
    await input.hooks?.afterBindingPublish?.();
  } catch (error) {
    if (
      error instanceof CollaborationError &&
      error.code === 'RECORD_CONFLICT'
    ) {
      throw new MembershipError(
        'STALE_BINDING',
        'another successor won this generation',
      );
    }
    throw error;
  }
  const closedRace = await isCollaborationClosed(
    input.root,
    input.collaborationId,
  );
  if (closedRace) {
    throw new MembershipError(
      'COLLABORATION_CLOSED',
      'takeover published during closure and is inert',
    );
  }
  return {
    member: { member: current.member, binding, departed: false },
    closedRace,
  };
}

export async function leaveCollaboration(
  input: CommonMembershipInput & { alias: string; pin: Pin },
): Promise<PublicationResult<DepartureRecord>> {
  const current = await resolveMember(
    input.root,
    input.collaborationId,
    input.alias,
  );
  if (!pinsEqual(current.binding.pin, input.pin)) {
    throw new MembershipError(
      'STALE_BINDING',
      'only the current binding may leave',
    );
  }
  const departure: DepartureRecord = withContentHash({
    schemaVersion: 1 as const,
    participantId: current.member.participantId,
    generation: current.binding.generation,
    pin: input.pin,
    departedAt: timestamp(input.now),
  });
  const paths = collaborationPaths(input.root, input.collaborationId);
  const target = path.join(
    paths.departures,
    current.member.participantId,
    `${current.binding.generation}.json`,
  );
  const existing = await readJsonRecord<DepartureRecord>(target).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    },
  );
  if (existing) {
    if (!pinsEqual(existing.pin, input.pin)) {
      throw new MembershipError(
        'STALE_BINDING',
        'departure belongs to another binding',
      );
    }
    return {
      created: false,
      path: target,
      hash: canonicalHash(existing),
      record: existing,
    };
  }
  return publishImmutableRecord(target, departure, { root: input.root });
}

export async function closeCollaboration(
  input: CommonMembershipInput & { pin: Pin },
): Promise<PublicationResult<ClosedRecord>> {
  const current = await resolveMemberByPin(
    input.root,
    input.collaborationId,
    input.pin,
  );
  if (current.departed)
    throw new MembershipError(
      'MEMBER_DEPARTED',
      'departed member cannot close collaboration',
    );
  const target = collaborationPaths(input.root, input.collaborationId).closed;
  const existing = await readJsonRecord<ClosedRecord>(target).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    },
  );
  if (existing) {
    return {
      created: false,
      path: target,
      hash: canonicalHash(existing),
      record: existing,
    };
  }
  const record: ClosedRecord = withContentHash({
    schemaVersion: 1 as const,
    collaborationId: input.collaborationId,
    closedBy: input.pin,
    closedAt: timestamp(input.now),
  });
  return publishImmutableRecord(target, record, {
    root: input.root,
  });
}
