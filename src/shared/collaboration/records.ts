import { createHash, randomUUID } from 'node:crypto';
import {
  chmod,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  realpath,
  unlink,
} from 'node:fs/promises';
import path from 'node:path';

import {
  assertAlias,
  assertBoundedString,
  assertPin,
  assertUuid,
  MAX_BODY_BYTES,
  MAX_SUBJECT_BYTES,
  SCHEMA_VERSION,
  type AckRecord,
  type BindingRecord,
  type ClosedRecord,
  type CollaborationRecord,
  type DepartureRecord,
  type LogEntryRecord,
  type MemberRecord,
  type MessageRecord,
} from './types.js';

export type CollaborationErrorCode =
  | 'CAPACITY_EXCEEDED'
  | 'COMMIT_UNCERTAIN'
  | 'INVALID_ID'
  | 'INVALID_ROOT'
  | 'MALFORMED_RECORD'
  | 'RECORD_CONFLICT'
  | 'RECORD_TOO_LARGE'
  | 'STORAGE_UNSUPPORTED'
  | 'UNKNOWN_SCHEMA'
  | 'UNSAFE_PATH';

export class CollaborationError extends Error {
  readonly code: CollaborationErrorCode;
  readonly retryable: boolean;

  constructor(
    code: CollaborationErrorCode,
    message: string,
    retryable = false,
  ) {
    super(message);
    this.name = 'CollaborationError';
    this.code = code;
    this.retryable = retryable;
  }
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stable(child)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(stable(value))}\n`;
}

export function canonicalHash(value: unknown): string {
  return createHash('sha256')
    .update(canonicalJson(value), 'utf8')
    .digest('hex');
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

function assertSchema(
  record: unknown,
): asserts record is Record<string, unknown> {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new CollaborationError(
      'MALFORMED_RECORD',
      'record must be a JSON object',
    );
  }
  const version = (record as { schemaVersion?: unknown }).schemaVersion;
  if (version !== SCHEMA_VERSION) {
    throw new CollaborationError(
      'UNKNOWN_SCHEMA',
      `unsupported schema version: ${String(version)}`,
    );
  }
}

function malformed(message: string): never {
  throw new CollaborationError('MALFORMED_RECORD', message);
}

function assertTimestamp(
  value: unknown,
  label: string,
): asserts value is string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    malformed(`${label} must be an ISO-8601 timestamp`);
  }
}

function assertGeneration(
  value: unknown,
  label: string,
): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    malformed(`${label} must be a non-negative safe integer`);
  }
}

function assertHash(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    malformed(`${label} must be a SHA-256 hex digest`);
  }
}

export function canonicalRecordHash(
  record: Record<string, unknown> & { contentHash?: unknown },
): string {
  const { contentHash: _contentHash, ...content } = record;
  return canonicalHash(content);
}

function assertRecordHash(
  record: Record<string, unknown> & { contentHash?: unknown },
  label: string,
): void {
  assertHash(record.contentHash, `${label} contentHash`);
  if (record.contentHash !== canonicalRecordHash(record)) {
    malformed(`${label} contentHash does not match content`);
  }
}

function assertUuidValue(
  value: unknown,
  label: string,
): asserts value is string {
  if (typeof value !== 'string') malformed(`${label} must be a UUID`);
  assertUuid(value, label);
}

function validateBinding(record: BindingRecord): void {
  assertUuidValue(record.participantId, 'binding participantId');
  assertGeneration(record.generation, 'binding generation');
  assertPin(record.pin);
  if (!path.isAbsolute(record.worktree))
    malformed('binding worktree must be absolute');
  if (record.previousPin !== null) assertPin(record.previousPin);
  assertBoundedString(record.reason, 'binding reason', 512);
  assertTimestamp(record.createdAt, 'binding createdAt');
  if (!Array.isArray(record.inheritedAckRefs))
    malformed('binding inheritedAckRefs must be an array');
  for (const ack of record.inheritedAckRefs) {
    if (!ack || typeof ack !== 'object')
      malformed('binding inherited ack must be an object');
    assertUuidValue(ack.messageId, 'inherited messageId');
    assertHash(ack.messageHash, 'inherited messageHash');
  }
  assertRecordHash(
    record as unknown as Record<string, unknown> & { contentHash: string },
    'binding',
  );
}

function messageHash(record: MessageRecord): string {
  return canonicalHash({
    schemaVersion: 1,
    id: record.id,
    collaborationId: record.collaborationId,
    from: record.from,
    to: record.to,
    kind: record.kind,
    priority: record.priority,
    subject: record.subject,
    body: record.body,
    replyTo: record.replyTo,
  });
}

function logHash(record: LogEntryRecord): string {
  return canonicalHash({
    collaborationId: record.collaborationId,
    id: record.id,
    category: record.category,
    title: record.title,
    author: record.author,
    whatHappened: record.whatHappened,
    assessment: record.assessment,
    skillImplication: record.skillImplication,
  });
}

function validateAuthoritativeRecord(
  file: string,
  value: Record<string, unknown>,
): void {
  const segments = path.resolve(file).split(path.sep);
  const collaborationIndex = segments.lastIndexOf('collaborations');
  const collaborationPathId =
    collaborationIndex >= 0 ? segments[collaborationIndex + 1] : undefined;
  const basename = path.basename(file, '.json');
  const parent = path.basename(path.dirname(file));
  const grandparent = path.basename(path.dirname(path.dirname(file)));
  try {
    if (path.basename(file) === 'collaboration.json') {
      const candidate = value as unknown as CollaborationRecord;
      assertUuidValue(candidate.id, 'collaboration id');
      if (candidate.id !== parent)
        malformed('collaboration path identity does not match id');
      assertBoundedString(candidate.label, 'collaboration label', 128);
      assertBoundedString(candidate.task, 'collaboration task', 2048);
      assertTimestamp(candidate.createdAt, 'collaboration createdAt');
      assertRecordHash(
        candidate as unknown as Record<string, unknown> & {
          contentHash: string;
        },
        'collaboration',
      );
    } else if (segments.includes('members')) {
      const candidate = value as unknown as MemberRecord;
      assertAlias(candidate.alias);
      if (candidate.alias !== basename)
        malformed('member path identity does not match alias');
      assertUuidValue(candidate.participantId, 'member participantId');
      assertUuidValue(candidate.collaborationId, 'member collaborationId');
      if (candidate.collaborationId !== collaborationPathId)
        malformed('member collaboration path identity does not match record');
      assertTimestamp(candidate.createdAt, 'member createdAt');
      if (
        !candidate.initialBinding ||
        typeof candidate.initialBinding !== 'object'
      )
        malformed('member initialBinding is required');
      validateBinding(candidate.initialBinding);
      if (
        candidate.initialBinding.participantId !== candidate.participantId ||
        candidate.initialBinding.generation !== 0
      )
        malformed('member initial binding identity is invalid');
      assertRecordHash(
        candidate as unknown as Record<string, unknown> & {
          contentHash: string;
        },
        'member',
      );
    } else if (segments.includes('bindings')) {
      const candidate = value as unknown as BindingRecord;
      validateBinding(candidate);
      if (
        candidate.participantId !== parent ||
        String(candidate.generation) !== basename
      )
        malformed('binding path identity does not match record');
    } else if (segments.includes('departures')) {
      const candidate = value as unknown as DepartureRecord;
      assertUuidValue(candidate.participantId, 'departure participantId');
      assertGeneration(candidate.generation, 'departure generation');
      assertPin(candidate.pin);
      assertTimestamp(candidate.departedAt, 'departure departedAt');
      assertRecordHash(
        candidate as unknown as Record<string, unknown> & {
          contentHash: string;
        },
        'departure',
      );
      if (
        candidate.participantId !== parent ||
        String(candidate.generation) !== basename
      )
        malformed('departure path identity does not match record');
    } else if (segments.includes('inbox')) {
      const candidate = value as unknown as MessageRecord;
      assertUuidValue(candidate.id, 'message id');
      assertUuidValue(candidate.collaborationId, 'message collaborationId');
      if (candidate.collaborationId !== collaborationPathId)
        malformed('message collaboration path identity does not match record');
      if (
        !candidate.from ||
        typeof candidate.from !== 'object' ||
        !candidate.to ||
        typeof candidate.to !== 'object'
      )
        malformed('message endpoints are required');
      assertUuidValue(
        candidate.from.participantId,
        'message sender participantId',
      );
      assertGeneration(candidate.from.generation, 'message sender generation');
      assertPin(candidate.from.pin);
      assertUuidValue(
        candidate.to.participantId,
        'message recipient participantId',
      );
      assertGeneration(candidate.to.generation, 'message recipient generation');
      if (!['request', 'update'].includes(candidate.kind))
        malformed('message kind is unsupported');
      if (!['normal', 'high'].includes(candidate.priority))
        malformed('message priority is unsupported');
      assertBoundedString(
        candidate.subject,
        'message subject',
        MAX_SUBJECT_BYTES,
      );
      assertBoundedString(candidate.body, 'message body', MAX_BODY_BYTES, true);
      if (candidate.replyTo !== null) {
        if (!candidate.replyTo || typeof candidate.replyTo !== 'object')
          malformed('message replyTo is invalid');
        assertUuidValue(candidate.replyTo.participantId, 'reply participantId');
        assertUuidValue(candidate.replyTo.messageId, 'reply messageId');
      }
      assertTimestamp(candidate.createdAt, 'message createdAt');
      assertHash(candidate.contentHash, 'message contentHash');
      if (candidate.contentHash !== messageHash(candidate))
        malformed('message contentHash does not match content');
      if (candidate.to.participantId !== parent || candidate.id !== basename)
        malformed('message path identity does not match record');
    } else if (segments.includes('acks')) {
      const candidate = value as unknown as AckRecord;
      assertUuidValue(candidate.messageId, 'ack messageId');
      assertHash(candidate.messageHash, 'ack messageHash');
      assertPin(candidate.recipient);
      assertGeneration(candidate.bindingGeneration, 'ack bindingGeneration');
      assertTimestamp(candidate.receivedAt, 'ack receivedAt');
      assertRecordHash(
        candidate as unknown as Record<string, unknown> & {
          contentHash: string;
        },
        'acknowledgment',
      );
      assertUuidValue(grandparent, 'ack participant path');
      if (
        candidate.messageId !== basename ||
        String(candidate.bindingGeneration) !== parent
      )
        malformed('ack path identity does not match record');
    } else if (segments.includes('entries') && segments.includes('log')) {
      const candidate = value as unknown as LogEntryRecord;
      assertUuidValue(candidate.id, 'log entry id');
      assertUuidValue(candidate.collaborationId, 'log collaborationId');
      if (candidate.collaborationId !== collaborationPathId)
        malformed('log collaboration path identity does not match record');
      assertBoundedString(candidate.category, 'log category', 64);
      assertBoundedString(candidate.title, 'log title', 256);
      assertPin(candidate.author);
      assertTimestamp(candidate.authoredAt, 'log authoredAt');
      assertBoundedString(
        candidate.whatHappened,
        'log whatHappened',
        16 * 1024,
      );
      assertBoundedString(candidate.assessment, 'log assessment', 2048);
      assertBoundedString(
        candidate.skillImplication,
        'log skillImplication',
        4096,
      );
      assertHash(candidate.contentHash, 'log contentHash');
      if (candidate.contentHash !== logHash(candidate))
        malformed('log contentHash does not match content');
      if (candidate.id !== basename)
        malformed('log path identity does not match id');
    } else if (path.basename(file) === 'closed.json') {
      const candidate = value as unknown as ClosedRecord;
      assertUuidValue(candidate.collaborationId, 'closed collaborationId');
      assertPin(candidate.closedBy);
      assertTimestamp(candidate.closedAt, 'closed closedAt');
      assertRecordHash(
        candidate as unknown as Record<string, unknown> & {
          contentHash: string;
        },
        'closed marker',
      );
      if (candidate.collaborationId !== parent)
        malformed('closed path identity does not match collaboration');
    }
  } catch (error) {
    if (error instanceof CollaborationError) throw error;
    throw new CollaborationError('MALFORMED_RECORD', (error as Error).message);
  }
}

export async function readJsonRecord<T>(
  file: string,
  options: { maxBytes?: number; expectedUid?: number } = {},
): Promise<T> {
  const info = await lstat(file).catch((error) => {
    if (isMissing(error)) throw error;
    throw new CollaborationError(
      'UNSAFE_PATH',
      `cannot inspect record: ${(error as Error).message}`,
    );
  });
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new CollaborationError(
      'UNSAFE_PATH',
      'record must be a regular file',
    );
  }
  const expectedUid = options.expectedUid ?? process.getuid?.();
  if (expectedUid !== undefined && info.uid !== expectedUid) {
    throw new CollaborationError(
      'UNSAFE_PATH',
      'record owner does not match the current user',
    );
  }
  const maxBytes = options.maxBytes ?? 128 * 1024;
  if (info.size > maxBytes) {
    throw new CollaborationError(
      'RECORD_TOO_LARGE',
      `record exceeds ${maxBytes} bytes`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    throw new CollaborationError(
      'MALFORMED_RECORD',
      `invalid JSON record: ${(error as Error).message}`,
    );
  }
  assertSchema(parsed);
  validateAuthoritativeRecord(file, parsed);
  return parsed as T;
}

async function ensurePrivateDirectory(
  directory: string,
  root: string,
): Promise<void> {
  if (!path.isAbsolute(root) || !path.isAbsolute(directory)) {
    throw new CollaborationError(
      'INVALID_ROOT',
      'storage paths must be absolute',
    );
  }
  const relative = path.relative(path.resolve(root), path.resolve(directory));
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new CollaborationError(
      'UNSAFE_PATH',
      'record path escapes the collaboration root',
    );
  }
  await mkdir(root, { recursive: true, mode: 0o700 });
  await chmod(root, 0o700);
  const canonicalRoot = await realpath(root);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const info = await lstat(directory);
  const canonicalDirectory = await realpath(directory);
  const canonicalRelative = path.relative(canonicalRoot, canonicalDirectory);
  if (
    !info.isDirectory() ||
    canonicalRelative.startsWith('..') ||
    path.isAbsolute(canonicalRelative) ||
    (typeof process.getuid === 'function' && info.uid !== process.getuid())
  ) {
    throw new CollaborationError('UNSAFE_PATH', 'storage directory is unsafe');
  }
}

export interface PublicationResult<T> {
  created: boolean;
  path: string;
  hash: string;
  record: T;
}

export interface PublicationHooks {
  afterFileSync?: () => void | Promise<void>;
  afterLink?: () => void | Promise<void>;
  beforeDirectorySync?: () => void | Promise<void>;
}

export async function publishImmutableRecord<T extends { schemaVersion: 1 }>(
  target: string,
  record: T,
  options: { root: string; hooks?: PublicationHooks },
): Promise<PublicationResult<T>> {
  assertSchema(record);
  const directory = path.dirname(target);
  await ensurePrivateDirectory(directory, options.root);
  const bytes = canonicalJson(record);
  const hash = canonicalHash(record);
  const temporary = path.join(
    directory,
    `.${path.basename(target)}.tmp-${process.pid}-${randomUUID()}`,
  );
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  let published = false;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(bytes, 'utf8');
    await handle.sync();
    await options.hooks?.afterFileSync?.();
    await handle.close();
    handle = undefined;
    await import('node:fs/promises').then(({ link }) =>
      link(temporary, target),
    );
    published = true;
    await options.hooks?.afterLink?.();
    await options.hooks?.beforeDirectorySync?.();
    const directoryHandle = await open(directory, 'r');
    try {
      await directoryHandle.sync();
    } catch (error) {
      throw new CollaborationError(
        'COMMIT_UNCERTAIN',
        `record was published but directory sync failed: ${(error as Error).message}`,
        true,
      );
    } finally {
      await directoryHandle.close();
    }
    return { created: true, path: target, hash, record };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EEXIST') {
      const existing = await readJsonRecord<T>(target);
      if (canonicalHash(existing) !== hash) {
        throw new CollaborationError(
          'RECORD_CONFLICT',
          'record ID already has different content',
        );
      }
      return { created: false, path: target, hash, record: existing };
    }
    if (error instanceof CollaborationError) throw error;
    if (
      code === 'EXDEV' ||
      code === 'EPERM' ||
      code === 'EOPNOTSUPP' ||
      code === 'ENOTSUP'
    ) {
      throw new CollaborationError(
        'STORAGE_UNSUPPORTED',
        `hard-link publication is unsupported: ${code}`,
      );
    }
    if (published) {
      throw new CollaborationError(
        'COMMIT_UNCERTAIN',
        `record publication outcome is uncertain: ${(error as Error).message}`,
        true,
      );
    }
    throw error;
  } finally {
    await handle?.close().catch(() => undefined);
    await unlink(temporary).catch((error) => {
      if (!isMissing(error)) throw error;
    });
  }
}

export async function enumerateJsonRecords(
  directory: string,
  options: { maxEntries: number },
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    (error) => {
      if (isMissing(error)) return [];
      throw error;
    },
  );
  const records = entries
    .filter(
      (entry) => !entry.name.startsWith('.') && entry.name.endsWith('.json'),
    )
    .map((entry) => {
      if (!entry.isFile() || entry.isSymbolicLink()) {
        throw new CollaborationError(
          'UNSAFE_PATH',
          `record entry ${entry.name} is not a regular file`,
        );
      }
      return path.join(directory, entry.name);
    })
    .toSorted();
  if (records.length > options.maxEntries) {
    throw new CollaborationError(
      'CAPACITY_EXCEEDED',
      `record directory exceeds ${options.maxEntries} entries`,
    );
  }
  return records;
}
