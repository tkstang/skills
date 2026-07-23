import { chmod, mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { CursorTranscriptScan } from '../../core/cursor-frames.js';
import type {
  ContinuityFailureCode,
  ContinuityResult,
  CursorCandidateObservation,
  CursorIdentityEvidence,
  CursorObserverStateV2,
  CursorSessionStateEntry,
  CursorStateMutator,
  CursorStabilityCandidate,
  CursorTurnReconciliation,
  LegacyCursorStateMarker,
  ObservationStatus,
  PendingCursorDelivery,
  TranscriptContinuityCheckpoint,
} from './types.js';

const SCHEMA_VERSION = 2 as const;
const LOCK_RETRIES = 100;
const LOCK_INTERVAL_MS = 50;
let backupSequence = 0;

export class CursorStateRecoveryRequiredError extends Error {
  readonly code = 'CURSOR_STATE_RECOVERY_REQUIRED';

  constructor(readonly reason: 'corrupt' | 'schema') {
    super(
      `cursor-state: ${reason} state requires explicit reset and replay before mutation`,
    );
    this.name = 'CursorStateRecoveryRequiredError';
  }
}

function blockedContinuity(
  code: ContinuityFailureCode,
  message: string,
  checkpoint: TranscriptContinuityCheckpoint | null,
): ContinuityResult {
  return { status: 'blocked', code, message, checkpoint };
}

export function validateCursorContinuity(
  identity: CursorIdentityEvidence,
  scan: CursorTranscriptScan,
  prior: CursorSessionStateEntry | null,
): ContinuityResult {
  if (identity.runtime !== 'cursor' || identity.strength !== 'exact') {
    throw new TypeError('Cursor continuity requires an exact Cursor identity');
  }

  if (scan.file.device === null || scan.file.inode === null) {
    return blockedContinuity(
      'FILE_IDENTITY_UNAVAILABLE',
      'The transcript filesystem did not provide stable device and inode identity.',
      prior?.continuity ?? null,
    );
  }

  if (prior === null) {
    return { status: 'new', fromFrameIndex: 0 };
  }

  const checkpoint = prior.continuity;
  if (
    prior.indexBase !== 'zero-based-jsonl-frame-index' ||
    checkpoint.indexBase !== 'zero-based-jsonl-frame-index' ||
    prior.lastRecordIndex !== checkpoint.nextFrameIndex
  ) {
    return blockedContinuity(
      'INDEX_BASE_MISMATCH',
      'The saved Cursor position is not a consistent physical-frame checkpoint.',
      checkpoint,
    );
  }

  if (
    prior.sessionId !== identity.sessionId ||
    prior.canonicalCwd !== identity.canonicalCwd ||
    prior.transcriptPath !== identity.canonicalTranscriptPath
  ) {
    return blockedContinuity(
      'ROTATION_UNSUPPORTED',
      'The exact Cursor session, cwd, or canonical transcript path changed.',
      checkpoint,
    );
  }

  if (checkpoint.device === null || checkpoint.inode === null) {
    return blockedContinuity(
      'FILE_IDENTITY_UNAVAILABLE',
      'The saved checkpoint lacks stable device or inode identity.',
      checkpoint,
    );
  }

  if (
    scan.file.size < checkpoint.prefixBytes ||
    scan.totalFrames < checkpoint.nextFrameIndex
  ) {
    return blockedContinuity(
      'TRANSCRIPT_SHRANK',
      'The transcript is smaller than the previously observed checkpoint.',
      checkpoint,
    );
  }

  if (
    scan.file.device !== checkpoint.device ||
    scan.file.inode !== checkpoint.inode
  ) {
    return blockedContinuity(
      'TRANSCRIPT_REPLACED',
      'The transcript file identity changed at the same canonical path.',
      checkpoint,
    );
  }

  if (
    scan.safePrefixBytes < checkpoint.prefixBytes ||
    scan.verifiedPrefixSha256 === null ||
    scan.verifiedPrefixSha256 !== checkpoint.prefixSha256
  ) {
    return blockedContinuity(
      'PREFIX_MISMATCH',
      'The previously verified transcript prefix no longer matches.',
      checkpoint,
    );
  }

  return {
    status: 'verified',
    fromFrameIndex: checkpoint.nextFrameIndex,
  };
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isNullableNonNegativeInteger(value: unknown): value is number | null {
  return value === null || isNonNegativeInteger(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === 'string')
  );
}

function isIntegerArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(isNonNegativeInteger);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isCheckpoint(value: unknown): value is TranscriptContinuityCheckpoint {
  return (
    isObject(value) &&
    hasOnlyKeys(value, [
      'indexBase',
      'nextFrameIndex',
      'prefixBytes',
      'prefixSha256',
      'observedSize',
      'device',
      'inode',
    ]) &&
    value.indexBase === 'zero-based-jsonl-frame-index' &&
    isNonNegativeInteger(value.nextFrameIndex) &&
    isNonNegativeInteger(value.prefixBytes) &&
    typeof value.prefixSha256 === 'string' &&
    /^[a-f0-9]{64}$/u.test(value.prefixSha256) &&
    isNonNegativeInteger(value.observedSize) &&
    (value.prefixBytes as number) <= (value.observedSize as number) &&
    isNullableNonNegativeInteger(value.device) &&
    isNullableNonNegativeInteger(value.inode)
  );
}

function isForwardDeliveryCheckpoint(
  expected: TranscriptContinuityCheckpoint,
  intended: TranscriptContinuityCheckpoint,
  reservedThroughFrameIndex: number,
): boolean {
  return (
    expected.device !== null &&
    expected.inode !== null &&
    intended.device === expected.device &&
    intended.inode === expected.inode &&
    intended.indexBase === expected.indexBase &&
    reservedThroughFrameIndex >= expected.nextFrameIndex &&
    intended.nextFrameIndex === reservedThroughFrameIndex + 1 &&
    intended.nextFrameIndex > expected.nextFrameIndex &&
    intended.prefixBytes >= expected.prefixBytes
  );
}

function isObservationStatus(value: unknown): value is ObservationStatus {
  return (
    isObject(value) &&
    hasOnlyKeys(value, [
      'engagement',
      'activity',
      'content',
      'lifecycle',
      'delivery',
      'health',
    ]) &&
    ['engaged', 'unengaged', 'unknown'].includes(String(value.engagement)) &&
    ['none', 'human-input', 'assistant-progress', 'tool-activity'].includes(
      String(value.activity),
    ) &&
    ['none', 'buffered', 'available', 'suppressed'].includes(
      String(value.content),
    ) &&
    [
      'none',
      'pending',
      'success',
      'aborted',
      'error',
      'cancelled',
      'unknown',
    ].includes(String(value.lifecycle)) &&
    ['none', 'reserved', 'committed', 'uncertain'].includes(
      String(value.delivery),
    ) &&
    ['healthy', 'blocked', 'stale', 'error', 'unknown'].includes(
      String(value.health),
    )
  );
}

function isOpenTurn(value: unknown): value is CursorTurnReconciliation {
  return (
    isObject(value) &&
    hasOnlyKeys(value, [
      'turnId',
      'fromFrameIndex',
      'observedThroughFrame',
      'deliveredEntryKeys',
      'assistantEntryKeys',
      'humanRecordIndexes',
      'toolRecordIndexes',
      'hasHumanInput',
      'hasAutomaticControlInput',
      'lifecycle',
    ]) &&
    typeof value.turnId === 'string' &&
    isNonNegativeInteger(value.fromFrameIndex) &&
    isNonNegativeInteger(value.observedThroughFrame) &&
    isStringArray(value.deliveredEntryKeys) &&
    isStringArray(value.assistantEntryKeys) &&
    isIntegerArray(value.humanRecordIndexes) &&
    isIntegerArray(value.toolRecordIndexes) &&
    typeof value.hasHumanInput === 'boolean' &&
    typeof value.hasAutomaticControlInput === 'boolean' &&
    ['pending', 'success', 'aborted', 'error', 'cancelled', 'unknown'].includes(
      String(value.lifecycle),
    )
  );
}

function isStabilityCandidate(
  value: unknown,
): value is CursorStabilityCandidate {
  return (
    isObject(value) &&
    hasOnlyKeys(value, [
      'turnId',
      'fromFrameIndex',
      'throughFrameIndex',
      'entryKeys',
      'prefixBytes',
      'prefixSha256',
      'firstObservedAt',
      'confirmAfter',
      'confirmedAt',
    ]) &&
    typeof value.turnId === 'string' &&
    isNonNegativeInteger(value.fromFrameIndex) &&
    isNonNegativeInteger(value.throughFrameIndex) &&
    isStringArray(value.entryKeys) &&
    isNonNegativeInteger(value.prefixBytes) &&
    typeof value.prefixSha256 === 'string' &&
    /^[a-f0-9]{64}$/u.test(value.prefixSha256) &&
    typeof value.firstObservedAt === 'string' &&
    Number.isFinite(Date.parse(value.firstObservedAt)) &&
    typeof value.confirmAfter === 'string' &&
    Number.isFinite(Date.parse(value.confirmAfter)) &&
    (value.confirmedAt === null ||
      (typeof value.confirmedAt === 'string' &&
        Number.isFinite(Date.parse(value.confirmedAt))))
  );
}

function isCandidateObservation(
  value: unknown,
): value is CursorCandidateObservation {
  return (
    isObject(value) &&
    hasOnlyKeys(value, [
      'turnId',
      'fromFrameIndex',
      'throughFrameIndex',
      'entryKeys',
      'prefixBytes',
      'prefixSha256',
      'observedAt',
    ]) &&
    typeof value.turnId === 'string' &&
    isNonNegativeInteger(value.fromFrameIndex) &&
    isNonNegativeInteger(value.throughFrameIndex) &&
    isStringArray(value.entryKeys) &&
    isNonNegativeInteger(value.prefixBytes) &&
    typeof value.prefixSha256 === 'string' &&
    /^[a-f0-9]{64}$/u.test(value.prefixSha256) &&
    typeof value.observedAt === 'string' &&
    Number.isFinite(Date.parse(value.observedAt))
  );
}

function isPendingDelivery(value: unknown): value is PendingCursorDelivery {
  return (
    isObject(value) &&
    hasOnlyKeys(value, [
      'deliveryId',
      'expectedNextFrameIndex',
      'expectedCheckpoint',
      'reservedThroughFrameIndex',
      'entryKeys',
      'intendedCheckpoint',
      'reservedByPid',
      'reservedAt',
    ]) &&
    typeof value.deliveryId === 'string' &&
    value.deliveryId.length > 0 &&
    isNonNegativeInteger(value.expectedNextFrameIndex) &&
    isCheckpoint(value.expectedCheckpoint) &&
    value.expectedNextFrameIndex === value.expectedCheckpoint.nextFrameIndex &&
    isNonNegativeInteger(value.reservedThroughFrameIndex) &&
    isStringArray(value.entryKeys) &&
    isCheckpoint(value.intendedCheckpoint) &&
    isForwardDeliveryCheckpoint(
      value.expectedCheckpoint,
      value.intendedCheckpoint,
      value.reservedThroughFrameIndex as number,
    ) &&
    isNonNegativeInteger(value.reservedByPid) &&
    value.reservedByPid > 0 &&
    typeof value.reservedAt === 'string' &&
    Number.isFinite(Date.parse(value.reservedAt))
  );
}

function isSessionEntry(value: unknown): value is CursorSessionStateEntry {
  return (
    isObject(value) &&
    hasOnlyKeys(value, [
      'runtime',
      'sessionId',
      'indexBase',
      'lastRecordIndex',
      'canonicalCwd',
      'transcriptPath',
      'continuity',
      'lastStatus',
      'openTurn',
      'stabilityCandidate',
      'pendingDelivery',
    ]) &&
    value.runtime === 'cursor' &&
    typeof value.sessionId === 'string' &&
    value.sessionId.length > 0 &&
    value.indexBase === 'zero-based-jsonl-frame-index' &&
    isNonNegativeInteger(value.lastRecordIndex) &&
    typeof value.canonicalCwd === 'string' &&
    value.canonicalCwd.length > 0 &&
    typeof value.transcriptPath === 'string' &&
    value.transcriptPath.length > 0 &&
    isCheckpoint(value.continuity) &&
    value.lastRecordIndex === value.continuity.nextFrameIndex &&
    isObservationStatus(value.lastStatus) &&
    (value.openTurn === null || isOpenTurn(value.openTurn)) &&
    (value.stabilityCandidate === null ||
      isStabilityCandidate(value.stabilityCandidate)) &&
    (value.pendingDelivery === null ||
      (isPendingDelivery(value.pendingDelivery) &&
        checkpointsEqual(
          value.pendingDelivery.expectedCheckpoint,
          value.continuity,
        )))
  );
}

function isLegacyMarker(value: unknown): value is LegacyCursorStateMarker {
  return (
    isObject(value) &&
    hasOnlyKeys(value, [
      'runtime',
      'sessionId',
      'legacyLastRecordIndex',
      'transcriptPath',
      'recordedCwd',
      'lastReadAt',
      'backupPath',
      'migrationStatus',
      'createdAt',
    ]) &&
    value.runtime === 'cursor' &&
    typeof value.sessionId === 'string' &&
    value.sessionId.length > 0 &&
    isNonNegativeInteger(value.legacyLastRecordIndex) &&
    (value.transcriptPath === undefined ||
      typeof value.transcriptPath === 'string') &&
    (value.recordedCwd === undefined ||
      value.recordedCwd === null ||
      typeof value.recordedCwd === 'string') &&
    (value.lastReadAt === undefined ||
      (typeof value.lastReadAt === 'string' &&
        Number.isFinite(Date.parse(value.lastReadAt)))) &&
    typeof value.backupPath === 'string' &&
    ['marker-written', 'legacy-removed', 'complete'].includes(
      String(value.migrationStatus),
    ) &&
    typeof value.createdAt === 'string'
  );
}

function isCursorState(value: unknown): value is CursorObserverStateV2 {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, ['schemaVersion', 'sessions', 'legacyUnverified']) ||
    value.schemaVersion !== SCHEMA_VERSION ||
    !isObject(value.sessions) ||
    !isObject(value.legacyUnverified)
  ) {
    return false;
  }

  return (
    Object.entries(value.sessions).every(
      ([key, entry]) =>
        isSessionEntry(entry) && key === cursorSessionKey(entry.sessionId),
    ) &&
    Object.entries(value.legacyUnverified).every(
      ([key, marker]) =>
        isLegacyMarker(marker) && key === cursorSessionKey(marker.sessionId),
    )
  );
}

function emptyCursorState(): CursorObserverStateV2 {
  return {
    schemaVersion: SCHEMA_VERSION,
    sessions: {},
    legacyUnverified: {},
  };
}

function stateDir(): string {
  return (
    process.env.STATE_DIR ??
    join(homedir(), '.local', 'state', 'session-observer')
  );
}

function statePath(dir: string): string {
  return join(dir, 'cursor-state.json');
}

function lockPath(dir: string): string {
  return join(dir, 'cursor-state.json.lock');
}

function tempPath(dir: string): string {
  return join(dir, `cursor-state.json.${process.pid}.tmp`);
}

function backupPath(dir: string, label: string): string {
  backupSequence += 1;
  return join(
    dir,
    `cursor-state.json.${label}-${Date.now()}-${process.pid}-${backupSequence}.bak`,
  );
}

async function ensurePrivateDirectory(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await chmod(dir, 0o700);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireLock(path: string): Promise<void> {
  for (let attempt = 0; attempt < LOCK_RETRIES; attempt += 1) {
    try {
      const handle = await open(path, 'wx', 0o600);
      await handle.close();
      return;
    } catch (error) {
      if (!isErrnoException(error) || error.code !== 'EEXIST') throw error;
      await sleep(LOCK_INTERVAL_MS);
    }
  }
  throw new Error(
    `cursor-state: could not acquire lock after ${LOCK_RETRIES} retries`,
  );
}

async function releaseLock(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if (!isErrnoException(error) || error.code !== 'ENOENT') throw error;
  }
}

async function writePrivateAtomic(
  path: string,
  temporaryPath: string,
  content: string,
): Promise<void> {
  let handle;
  try {
    handle = await open(temporaryPath, 'w', 0o600);
    await handle.writeFile(content, 'utf8');
    await handle.datasync();
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, path);
    await chmod(path, 0o600);
  } finally {
    if (handle) await handle.close();
    try {
      await unlink(temporaryPath);
    } catch {
      // Best-effort cleanup; the destination was either committed or the
      // original write/rename error remains the authoritative failure.
    }
  }
}

async function writeBackup(
  dir: string,
  label: string,
  raw: string,
): Promise<void> {
  const destination = backupPath(dir, label);
  await writePrivateAtomic(destination, `${destination}.tmp`, raw);
}

async function readCursorState(dir: string): Promise<CursorObserverStateV2> {
  let raw: string;
  try {
    raw = await readFile(statePath(dir), 'utf8');
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return emptyCursorState();
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await writeBackup(dir, 'corrupt', raw);
    throw new CursorStateRecoveryRequiredError('corrupt');
  }

  if (!isCursorState(parsed)) {
    await writeBackup(dir, 'schema', raw);
    throw new CursorStateRecoveryRequiredError('schema');
  }
  return parsed;
}

async function writeCursorState(
  dir: string,
  state: CursorObserverStateV2,
): Promise<void> {
  if (!isCursorState(state)) {
    throw new TypeError('cursor-state: invalid schema v2 state');
  }
  await writePrivateAtomic(
    statePath(dir),
    tempPath(dir),
    JSON.stringify(state, null, 2),
  );
}

interface CursorStateTransactionResult<T> {
  write: boolean;
  value: T;
}

async function transactCursorState<T>(
  transaction: (
    state: CursorObserverStateV2,
  ) => CursorStateTransactionResult<T>,
): Promise<T> {
  const dir = stateDir();
  await ensurePrivateDirectory(dir);
  const lock = lockPath(dir);
  await acquireLock(lock);
  try {
    const state = await readCursorState(dir);
    const result = transaction(state);
    if (result.write) await writeCursorState(dir, state);
    return result.value;
  } finally {
    await releaseLock(lock);
  }
}

function checkpointsEqual(
  left: TranscriptContinuityCheckpoint,
  right: TranscriptContinuityCheckpoint,
): boolean {
  return (
    left.indexBase === right.indexBase &&
    left.nextFrameIndex === right.nextFrameIndex &&
    left.prefixBytes === right.prefixBytes &&
    left.prefixSha256 === right.prefixSha256 &&
    left.observedSize === right.observedSize &&
    left.device === right.device &&
    left.inode === right.inode
  );
}

function sameStringArray(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function pendingDeliveriesEqual(
  left: PendingCursorDelivery,
  right: PendingCursorDelivery,
): boolean {
  return (
    left.deliveryId === right.deliveryId &&
    left.expectedNextFrameIndex === right.expectedNextFrameIndex &&
    checkpointsEqual(left.expectedCheckpoint, right.expectedCheckpoint) &&
    left.reservedThroughFrameIndex === right.reservedThroughFrameIndex &&
    sameStringArray(left.entryKeys, right.entryKeys) &&
    checkpointsEqual(left.intendedCheckpoint, right.intendedCheckpoint) &&
    left.reservedByPid === right.reservedByPid &&
    left.reservedAt === right.reservedAt
  );
}

function sameStabilityBoundary(
  candidate: CursorStabilityCandidate,
  observation: CursorCandidateObservation,
): boolean {
  return (
    candidate.turnId === observation.turnId &&
    candidate.fromFrameIndex === observation.fromFrameIndex &&
    candidate.throughFrameIndex === observation.throughFrameIndex &&
    candidate.prefixBytes === observation.prefixBytes &&
    candidate.prefixSha256 === observation.prefixSha256 &&
    sameStringArray(candidate.entryKeys, observation.entryKeys)
  );
}

export function cursorSessionKey(sessionId: string): string {
  return `cursor:${sessionId}`;
}

export async function loadCursorState(): Promise<CursorObserverStateV2> {
  const dir = stateDir();
  await ensurePrivateDirectory(dir);
  const lock = lockPath(dir);
  await acquireLock(lock);
  try {
    return await readCursorState(dir);
  } finally {
    await releaseLock(lock);
  }
}

export async function mutateCursorState(
  mutate: CursorStateMutator,
): Promise<CursorObserverStateV2> {
  const dir = stateDir();
  await ensurePrivateDirectory(dir);
  const lock = lockPath(dir);
  await acquireLock(lock);
  try {
    const current = await readCursorState(dir);
    const next = mutate(current) ?? current;
    await writeCursorState(dir, next);
    return next;
  } finally {
    await releaseLock(lock);
  }
}

export async function getCursorSession(
  sessionId: string,
): Promise<CursorSessionStateEntry | null> {
  const state = await loadCursorState();
  return state.sessions[cursorSessionKey(sessionId)] ?? null;
}

export async function setCursorSession(
  entry: CursorSessionStateEntry,
): Promise<void> {
  if (!isSessionEntry(entry)) {
    throw new TypeError('cursor-state: invalid Cursor session entry');
  }
  await mutateCursorState((state) => {
    const key = cursorSessionKey(entry.sessionId);
    const existing = state.sessions[key];
    if (
      existing?.pendingDelivery &&
      (!entry.pendingDelivery ||
        !pendingDeliveriesEqual(
          existing.pendingDelivery,
          entry.pendingDelivery,
        ))
    ) {
      throw new Error('DELIVERY_RESERVATION_ACTIVE');
    }
    state.sessions[key] = entry;
  });
}

export interface CursorCandidateCheckpointResult {
  status: 'staged' | 'waiting' | 'confirmed' | 'replaced';
  entryKeys: string[];
}

export async function checkpointCursorCandidate(input: {
  sessionId: string;
  stabilityMs: number;
  observation: CursorCandidateObservation;
}): Promise<CursorCandidateCheckpointResult> {
  if (
    !Number.isSafeInteger(input.stabilityMs) ||
    input.stabilityMs < 0 ||
    !isCandidateObservation(input.observation)
  ) {
    throw new TypeError('cursor-state: invalid stability observation');
  }

  return transactCursorState<CursorCandidateCheckpointResult>((state) => {
    const entry = state.sessions[cursorSessionKey(input.sessionId)];
    if (!entry) throw new Error('CURSOR_SESSION_NOT_FOUND');
    if (entry.pendingDelivery) throw new Error('DELIVERY_RESERVATION_ACTIVE');
    const observedAtMs = Date.parse(input.observation.observedAt);
    const existing = entry.stabilityCandidate;

    if (existing && sameStabilityBoundary(existing, input.observation)) {
      if (existing.confirmedAt !== null) {
        return {
          write: false,
          value: {
            status: 'confirmed' as const,
            entryKeys: [...existing.entryKeys],
          },
        };
      }
      if (observedAtMs < Date.parse(existing.confirmAfter)) {
        return {
          write: false,
          value: {
            status: 'waiting' as const,
            entryKeys: [...existing.entryKeys],
          },
        };
      }
      existing.confirmedAt = input.observation.observedAt;
      return {
        write: true,
        value: {
          status: 'confirmed' as const,
          entryKeys: [...existing.entryKeys],
        },
      };
    }

    const next: CursorStabilityCandidate = {
      turnId: input.observation.turnId,
      fromFrameIndex: input.observation.fromFrameIndex,
      throughFrameIndex: input.observation.throughFrameIndex,
      entryKeys: [...input.observation.entryKeys],
      prefixBytes: input.observation.prefixBytes,
      prefixSha256: input.observation.prefixSha256,
      firstObservedAt: input.observation.observedAt,
      confirmAfter: new Date(observedAtMs + input.stabilityMs).toISOString(),
      confirmedAt: null,
    };
    entry.stabilityCandidate = next;
    return {
      write: true,
      value: {
        status: existing === null ? ('staged' as const) : ('replaced' as const),
        entryKeys: [...next.entryKeys],
      },
    };
  });
}

export async function reserveCursorDelivery(input: {
  sessionId: string;
  ownerPid: number;
  expected: TranscriptContinuityCheckpoint;
  pending: PendingCursorDelivery;
}): Promise<'reserved' | 'stale' | 'owner-conflict'> {
  if (
    !isNonNegativeInteger(input.ownerPid) ||
    input.ownerPid === 0 ||
    !isCheckpoint(input.expected) ||
    !isPendingDelivery(input.pending) ||
    input.pending.reservedByPid !== input.ownerPid ||
    input.pending.expectedNextFrameIndex !== input.expected.nextFrameIndex ||
    !checkpointsEqual(input.pending.expectedCheckpoint, input.expected) ||
    !isForwardDeliveryCheckpoint(
      input.expected,
      input.pending.intendedCheckpoint,
      input.pending.reservedThroughFrameIndex,
    )
  ) {
    throw new TypeError('cursor-state: invalid delivery reservation');
  }

  return transactCursorState((state) => {
    const entry = state.sessions[cursorSessionKey(input.sessionId)];
    if (!entry) return { write: false, value: 'stale' as const };
    const existing = entry.pendingDelivery;
    if (existing) {
      if (existing.reservedByPid !== input.ownerPid) {
        return { write: false, value: 'owner-conflict' as const };
      }
      const idempotent =
        pendingDeliveriesEqual(existing, input.pending) &&
        checkpointsEqual(entry.continuity, input.expected);
      return {
        write: false,
        value: idempotent ? ('reserved' as const) : ('owner-conflict' as const),
      };
    }
    if (!checkpointsEqual(entry.continuity, input.expected)) {
      return { write: false, value: 'stale' as const };
    }

    entry.pendingDelivery = structuredClone(input.pending);
    entry.lastStatus = { ...entry.lastStatus, delivery: 'reserved' };
    return { write: true, value: 'reserved' as const };
  });
}

export async function commitCursorDelivery(input: {
  sessionId: string;
  deliveryId: string;
  nextState: CursorSessionStateEntry;
}): Promise<'committed' | 'stale'> {
  if (
    !input.deliveryId ||
    !isSessionEntry(input.nextState) ||
    input.nextState.sessionId !== input.sessionId ||
    input.nextState.pendingDelivery !== null ||
    input.nextState.stabilityCandidate !== null ||
    input.nextState.lastStatus.delivery !== 'committed'
  ) {
    throw new TypeError('cursor-state: invalid delivery commit');
  }

  return transactCursorState((state) => {
    const key = cursorSessionKey(input.sessionId);
    const current = state.sessions[key];
    const pending = current?.pendingDelivery;
    if (!current || !pending || pending.deliveryId !== input.deliveryId) {
      return { write: false, value: 'stale' as const };
    }
    if (
      !checkpointsEqual(current.continuity, pending.expectedCheckpoint) ||
      !checkpointsEqual(
        pending.intendedCheckpoint,
        input.nextState.continuity,
      ) ||
      !isForwardDeliveryCheckpoint(
        pending.expectedCheckpoint,
        pending.intendedCheckpoint,
        pending.reservedThroughFrameIndex,
      )
    ) {
      return { write: false, value: 'stale' as const };
    }

    state.sessions[key] = structuredClone(input.nextState);
    return { write: true, value: 'committed' as const };
  });
}

export async function abandonCursorDelivery(input: {
  sessionId: string;
  deliveryId: string;
  ownerPid: number;
}): Promise<'abandoned' | 'stale' | 'owner-conflict' | 'delivery-uncertain'> {
  if (
    !input.sessionId ||
    !input.deliveryId ||
    !isNonNegativeInteger(input.ownerPid) ||
    input.ownerPid === 0
  ) {
    throw new TypeError('cursor-state: invalid delivery abandonment');
  }
  return transactCursorState((state) => {
    const entry = state.sessions[cursorSessionKey(input.sessionId)];
    const pending = entry?.pendingDelivery;
    if (!entry || !pending || pending.deliveryId !== input.deliveryId) {
      return { write: false, value: 'stale' as const };
    }
    if (pending.reservedByPid !== input.ownerPid) {
      return { write: false, value: 'owner-conflict' as const };
    }
    if (entry.lastStatus.delivery === 'uncertain') {
      return { write: false, value: 'delivery-uncertain' as const };
    }

    entry.pendingDelivery = null;
    entry.lastStatus = { ...entry.lastStatus, delivery: 'none' };
    return { write: true, value: 'abandoned' as const };
  });
}

export type CursorDeliveryRecovery =
  | { status: 'none' }
  | {
      status: 'delivery-uncertain';
      deliveryId: string;
      entryKeys: string[];
      expectedNextFrameIndex: number;
      reservedThroughFrameIndex: number;
    };

export async function recoverCursorDelivery(
  sessionId: string,
): Promise<CursorDeliveryRecovery> {
  return transactCursorState<CursorDeliveryRecovery>((state) => {
    const entry = state.sessions[cursorSessionKey(sessionId)];
    const pending = entry?.pendingDelivery;
    if (!entry || !pending) {
      return { write: false, value: { status: 'none' as const } };
    }
    const value: CursorDeliveryRecovery = {
      status: 'delivery-uncertain',
      deliveryId: pending.deliveryId,
      entryKeys: [...pending.entryKeys],
      expectedNextFrameIndex: pending.expectedNextFrameIndex,
      reservedThroughFrameIndex: pending.reservedThroughFrameIndex,
    };
    if (entry.lastStatus.delivery === 'uncertain') {
      return { write: false, value };
    }
    entry.lastStatus = { ...entry.lastStatus, delivery: 'uncertain' };
    return { write: true, value };
  });
}

export async function resetCursorSessionState(
  sessionId: string,
): Promise<boolean> {
  let removed = false;
  await mutateCursorState((state) => {
    const key = cursorSessionKey(sessionId);
    removed =
      Object.hasOwn(state.sessions, key) ||
      Object.hasOwn(state.legacyUnverified, key);
    delete state.sessions[key];
    delete state.legacyUnverified[key];
  });
  return removed;
}

export async function resetAllCursorState(): Promise<number> {
  const dir = stateDir();
  await ensurePrivateDirectory(dir);
  const lock = lockPath(dir);
  await acquireLock(lock);
  try {
    let count = 0;
    try {
      const state = await readCursorState(dir);
      count = new Set([
        ...Object.keys(state.sessions),
        ...Object.keys(state.legacyUnverified),
      ]).size;
    } catch (error) {
      if (!(error instanceof CursorStateRecoveryRequiredError)) throw error;
    }
    await writeCursorState(dir, emptyCursorState());
    return count;
  } finally {
    await releaseLock(lock);
  }
}

export async function clearCursorState(): Promise<void> {
  await resetAllCursorState();
}
