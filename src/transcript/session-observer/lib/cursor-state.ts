import { chmod, mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type {
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
    isNullableNonNegativeInteger(value.device) &&
    isNullableNonNegativeInteger(value.inode)
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
      'humanRecordIndexes',
      'toolRecordIndexes',
      'lifecycle',
    ]) &&
    typeof value.turnId === 'string' &&
    isNonNegativeInteger(value.fromFrameIndex) &&
    isNonNegativeInteger(value.observedThroughFrame) &&
    isStringArray(value.deliveredEntryKeys) &&
    isIntegerArray(value.humanRecordIndexes) &&
    isIntegerArray(value.toolRecordIndexes) &&
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
    ]) &&
    typeof value.turnId === 'string' &&
    isNonNegativeInteger(value.fromFrameIndex) &&
    isNonNegativeInteger(value.throughFrameIndex) &&
    isStringArray(value.entryKeys) &&
    isNonNegativeInteger(value.prefixBytes) &&
    typeof value.prefixSha256 === 'string' &&
    /^[a-f0-9]{64}$/u.test(value.prefixSha256) &&
    typeof value.firstObservedAt === 'string' &&
    typeof value.confirmAfter === 'string'
  );
}

function isPendingDelivery(value: unknown): value is PendingCursorDelivery {
  return (
    isObject(value) &&
    hasOnlyKeys(value, [
      'deliveryId',
      'expectedNextFrameIndex',
      'reservedThroughFrameIndex',
      'entryKeys',
      'intendedCheckpoint',
      'reservedByPid',
      'reservedAt',
    ]) &&
    typeof value.deliveryId === 'string' &&
    isNonNegativeInteger(value.expectedNextFrameIndex) &&
    isNonNegativeInteger(value.reservedThroughFrameIndex) &&
    isStringArray(value.entryKeys) &&
    isCheckpoint(value.intendedCheckpoint) &&
    isNonNegativeInteger(value.reservedByPid) &&
    typeof value.reservedAt === 'string'
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
    (value.pendingDelivery === null || isPendingDelivery(value.pendingDelivery))
  );
}

function isLegacyMarker(value: unknown): value is LegacyCursorStateMarker {
  return (
    isObject(value) &&
    hasOnlyKeys(value, [
      'runtime',
      'sessionId',
      'legacyLastRecordIndex',
      'backupPath',
      'migrationStatus',
      'createdAt',
    ]) &&
    value.runtime === 'cursor' &&
    typeof value.sessionId === 'string' &&
    value.sessionId.length > 0 &&
    isNonNegativeInteger(value.legacyLastRecordIndex) &&
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
    return emptyCursorState();
  }

  if (!isCursorState(parsed)) {
    await writeBackup(dir, 'schema', raw);
    return emptyCursorState();
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
    state.sessions[cursorSessionKey(entry.sessionId)] = entry;
  });
}
