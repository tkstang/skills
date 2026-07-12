import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import {
  access,
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';

export const LEASE_SCHEMA_VERSION = 2;
export const LEASE_STATES = Object.freeze([
  'armed',
  'waiting',
  'idle',
  'triggered',
  'disarmed',
]);
export const DEFAULT_WAIT_MS = 5_000;
export const MAX_WAIT_MS = 60_000;
export const MAX_LEASE_MS = 24 * 60 * 60 * 1_000;
export const MAX_CONTINUATIONS = 100;
export const MAX_LOOPS = 1_000;

const ID = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,127})$/;
const RUNTIMES = new Set(['codex', 'cursor']);

export class LeaseError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'LeaseError';
    this.code = code;
  }
}

export function stateRoot(env = process.env) {
  const base =
    env.XDG_STATE_HOME || join(env.HOME || homedir(), '.local', 'state');
  if (!isAbsolute(base))
    throw new LeaseError(
      'invalid-state-root',
      'XDG_STATE_HOME must be absolute',
    );
  return join(resolve(base), 'session-observer', 'collab');
}

export function validateId(value, label = 'session') {
  if (
    typeof value !== 'string' ||
    !ID.test(value) ||
    value === '.' ||
    value === '..'
  ) {
    throw new LeaseError(
      `invalid-${label}`,
      `${label} must be a safe non-empty identifier`,
    );
  }
  return value;
}

export function validateRuntime(value) {
  if (!RUNTIMES.has(value))
    throw new LeaseError('invalid-runtime', 'runtime must be codex or cursor');
  return value;
}

export function validateAbsolutePath(value, label) {
  if (typeof value !== 'string' || !isAbsolute(value) || value.includes('\0')) {
    throw new LeaseError(
      `invalid-${label}`,
      `${label} must be an absolute path`,
    );
  }
  return resolve(value);
}

export function leasePath(root, ownerSession) {
  validateId(ownerSession, 'owner-session');
  const leases = join(resolve(root), 'leases');
  const candidate = join(leases, `${ownerSession}.json`);
  if (!candidate.startsWith(`${leases}${sep}`))
    throw new LeaseError('invalid-owner-session', 'unsafe lease path');
  return candidate;
}

function integer(value, name, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new LeaseError(
      'malformed-lease',
      `${name} must be an integer from ${min} to ${max}`,
    );
  }
  return value;
}

function timestamp(value, name) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new LeaseError('malformed-lease', `${name} must be an ISO timestamp`);
  }
  return new Date(value).toISOString();
}

export function migrateLease(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new LeaseError('malformed-lease', 'lease must be an object');
  if (input.schemaVersion === 1) {
    input = {
      ...input,
      schemaVersion: 2,
      continuationCount: input.triggerCount ?? input.continuationCount ?? 0,
      continuationCap: input.triggerCap ?? input.continuationCap ?? 1,
      loopCount: input.loopCount ?? 0,
      loopCap: input.loopCap ?? 1,
      diagnostic: input.diagnostic ?? null,
    };
    delete input.triggerCount;
    delete input.triggerCap;
  }
  if (input.schemaVersion !== LEASE_SCHEMA_VERSION) {
    throw new LeaseError(
      'unsupported-schema',
      `unsupported lease schema: ${String(input.schemaVersion)}`,
    );
  }
  return input;
}

export function validateLease(raw) {
  const value = migrateLease(structuredClone(raw));
  validateId(value.leaseId, 'lease-id');
  validateRuntime(value.runtime);
  validateId(value.ownerSession, 'owner-session');
  validateId(value.peerSession, 'peer-session');
  validateAbsolutePath(value.ownerCwd, 'owner-cwd');
  validateAbsolutePath(value.peerTranscript, 'peer-transcript');
  if (!LEASE_STATES.includes(value.state))
    throw new LeaseError('malformed-lease', 'invalid lease state');
  value.armedAt = timestamp(value.armedAt, 'armedAt');
  value.expiresAt = timestamp(value.expiresAt, 'expiresAt');
  value.updatedAt = timestamp(value.updatedAt, 'updatedAt');
  integer(value.waitMs, 'waitMs', 0, MAX_WAIT_MS);
  integer(value.peerCursor, 'peerCursor', 0, Number.MAX_SAFE_INTEGER);
  integer(value.continuationCount, 'continuationCount', 0, MAX_CONTINUATIONS);
  integer(value.continuationCap, 'continuationCap', 1, MAX_CONTINUATIONS);
  integer(value.loopCount, 'loopCount', 0, MAX_LOOPS);
  integer(value.loopCap, 'loopCap', 1, MAX_LOOPS);
  if (
    value.continuationCount > value.continuationCap ||
    value.loopCount > value.loopCap
  ) {
    throw new LeaseError('malformed-lease', 'lease counters exceed their caps');
  }
  if (
    Date.parse(value.expiresAt) < Date.parse(value.armedAt) ||
    Date.parse(value.expiresAt) - Date.parse(value.armedAt) > MAX_LEASE_MS
  ) {
    throw new LeaseError(
      'malformed-lease',
      'lease expiry is invalid or exceeds the maximum',
    );
  }
  if (value.diagnostic !== null && typeof value.diagnostic !== 'string')
    throw new LeaseError(
      'malformed-lease',
      'diagnostic must be a string or null',
    );
  return value;
}

export function effectiveLease(lease, now = Date.now()) {
  const value = validateLease(lease);
  if (
    (value.state === 'armed' || value.state === 'waiting') &&
    now >= Date.parse(value.expiresAt)
  ) {
    value.state = 'idle';
    value.diagnostic = 'lease-expired';
  }
  if (
    (value.state === 'armed' || value.state === 'waiting') &&
    (value.continuationCount >= value.continuationCap ||
      value.loopCount >= value.loopCap)
  ) {
    value.state = 'idle';
    value.diagnostic = 'cap-reached';
  }
  return value;
}

export async function atomicWriteJson(file, value) {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  await chmod(dirname(file), 0o700);
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await open(temp, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temp, file);
  await chmod(file, 0o600);
}

export async function readLease(
  root,
  ownerSession,
  { persistMigration = true } = {},
) {
  const file = leasePath(root, ownerSession);
  let raw;
  try {
    const metadata = await lstat(file);
    const wrongOwner =
      typeof process.getuid === 'function' && metadata.uid !== process.getuid();
    if (
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      wrongOwner ||
      (metadata.mode & 0o077) !== 0
    ) {
      throw new LeaseError(
        'unsafe-lease',
        'lease must be a regular owner-only file owned by this user',
      );
    }
    raw = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    if (error instanceof LeaseError) throw error;
    throw new LeaseError(
      'malformed-lease',
      `cannot read lease safely: ${error.message}`,
    );
  }
  const migrated = validateLease(raw);
  if (persistMigration && raw.schemaVersion !== migrated.schemaVersion)
    await atomicWriteJson(file, migrated);
  return migrated;
}

export async function writeLease(root, lease) {
  const value = validateLease(lease);
  await atomicWriteJson(leasePath(root, value.ownerSession), value);
  return value;
}

async function withLock(file, fn) {
  const lock = `${file}.lock`;
  let handle;
  try {
    handle = await open(lock, 'wx', 0o600);
  } catch (error) {
    if (error?.code === 'EEXIST') return { ok: false, reason: 'conflict' };
    throw error;
  }
  try {
    return await fn();
  } finally {
    await handle.close();
    await rm(lock, { force: true });
  }
}

export async function compareAndSwapTrigger(
  root,
  ownerSession,
  expected,
  update,
  now = Date.now(),
) {
  const file = leasePath(root, ownerSession);
  return withLock(file, async () => {
    const current = await readLease(root, ownerSession, {
      persistMigration: false,
    });
    if (!current) return { ok: false, reason: 'missing' };
    if (
      current.peerCursor !== expected.peerCursor ||
      current.continuationCount !== expected.continuationCount ||
      current.loopCount !== expected.loopCount
    ) {
      return { ok: false, reason: 'stale', lease: current };
    }
    const effective = effectiveLease(current, now);
    if (!['armed', 'waiting'].includes(effective.state))
      return {
        ok: false,
        reason: effective.diagnostic || effective.state,
        lease: effective,
      };
    const nextCursor = integer(
      update.peerCursor,
      'peerCursor',
      current.peerCursor,
      Number.MAX_SAFE_INTEGER,
    );
    const next = validateLease({
      ...current,
      peerCursor: nextCursor,
      continuationCount: current.continuationCount + 1,
      loopCount: current.loopCount + (update.loopIncrement ?? 1),
      state: update.terminal === false ? 'armed' : 'triggered',
      diagnostic: update.diagnostic ?? null,
      updatedAt: new Date(now).toISOString(),
    });
    await atomicWriteJson(file, next);
    return { ok: true, lease: next };
  });
}

export async function beginLeaseWait(
  root,
  ownerSession,
  identity,
  now = Date.now(),
) {
  const file = leasePath(root, ownerSession);
  return withLock(file, async () => {
    const current = await readLease(root, ownerSession, {
      persistMigration: false,
    });
    if (!current) return { ok: false, reason: 'missing' };
    if (
      current.runtime !== identity.runtime ||
      current.ownerCwd !== identity.ownerCwd ||
      current.peerTranscript !== identity.peerTranscript
    ) {
      return { ok: false, reason: 'identity-mismatch', lease: current };
    }
    const effective = effectiveLease(current, now);
    if (!['armed', 'waiting'].includes(effective.state)) {
      return {
        ok: false,
        reason: effective.diagnostic || effective.state,
        lease: effective,
      };
    }
    if (effective.state === 'waiting') {
      return { ok: true, changed: false, lease: effective };
    }
    const waiting = validateLease({
      ...effective,
      state: 'waiting',
      updatedAt: new Date(now).toISOString(),
      diagnostic: null,
    });
    await atomicWriteJson(file, waiting);
    return { ok: true, changed: true, lease: waiting };
  });
}

export async function resourceExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function pruneLeases(
  root,
  { now = Date.now(), ownerSession } = {},
) {
  const leasesDir = join(resolve(root), 'leases');
  let names;
  try {
    names = await readdir(leasesDir);
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  const removed = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const session = name.slice(0, -5);
    if (!ID.test(session) || (ownerSession && session !== ownerSession))
      continue;
    let lease;
    try {
      lease = await readLease(root, session);
    } catch {
      continue;
    }
    if (!lease || lease.ownerSession !== session) continue;
    const expired = now >= Date.parse(lease.expiresAt);
    const missing =
      !(await resourceExists(lease.ownerCwd)) ||
      !(await resourceExists(lease.peerTranscript));
    if (expired || missing) {
      await rm(leasePath(root, session));
      removed.push(session);
    }
  }
  return removed;
}
