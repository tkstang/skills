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

export const LEASE_SCHEMA_VERSION = 4;
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
const OWNER_RUNTIMES = new Set(['codex', 'cursor']);
const PEER_RUNTIMES = new Set(['claude-code', 'codex', 'cursor']);

export class LeaseError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'LeaseError';
    this.code = code;
  }
}

export function stateRoot(env = process.env) {
  if (env.SESSION_OBSERVER_STATE_DIR) {
    if (!isAbsolute(env.SESSION_OBSERVER_STATE_DIR))
      throw new LeaseError(
        'invalid-state-root',
        'SESSION_OBSERVER_STATE_DIR must be absolute',
      );
    return resolve(env.SESSION_OBSERVER_STATE_DIR);
  }
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

export function validateOwnerRuntime(value) {
  if (!OWNER_RUNTIMES.has(value))
    throw new LeaseError(
      'invalid-owner-runtime',
      'owner runtime must be codex or cursor',
    );
  return value;
}

export function validatePeerRuntime(value) {
  if (!PEER_RUNTIMES.has(value))
    throw new LeaseError(
      'invalid-peer-runtime',
      'peer runtime must be claude-code, codex, or cursor',
    );
  return value;
}

// Backward-compatible owner adapter validator.
export const validateRuntime = validateOwnerRuntime;

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
  if (input.schemaVersion === 2) {
    if (input.peerRuntime === undefined) {
      throw new LeaseError(
        'peer-runtime-rearm-required',
        'legacy lease is missing peerRuntime; re-arm required',
      );
    }
    input = {
      ...input,
      schemaVersion: 3,
      leaseMs:
        input.leaseMs ??
        Date.parse(input.expiresAt) - Date.parse(input.armedAt),
    };
  }
  if (input.schemaVersion === 3) {
    if (input.peerRuntime === undefined) {
      throw new LeaseError(
        'peer-runtime-rearm-required',
        'legacy lease is missing peerRuntime; re-arm required',
      );
    }
    input = {
      ...input,
      schemaVersion: 4,
      waitStartedAt: input.waitStartedAt ?? null,
      waitDeadlineAt: input.waitDeadlineAt ?? null,
    };
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
  validateOwnerRuntime(value.runtime);
  validatePeerRuntime(value.peerRuntime);
  validateId(value.ownerSession, 'owner-session');
  validateId(value.peerSession, 'peer-session');
  validateAbsolutePath(value.ownerCwd, 'owner-cwd');
  validateAbsolutePath(value.peerTranscript, 'peer-transcript');
  if (!LEASE_STATES.includes(value.state))
    throw new LeaseError('malformed-lease', 'invalid lease state');
  value.armedAt = timestamp(value.armedAt, 'armedAt');
  value.expiresAt = timestamp(value.expiresAt, 'expiresAt');
  value.updatedAt = timestamp(value.updatedAt, 'updatedAt');
  if ((value.waitStartedAt === null) !== (value.waitDeadlineAt === null)) {
    throw new LeaseError(
      'malformed-lease',
      'wait timing fields must both be timestamps or both be null',
    );
  }
  if (value.waitStartedAt !== null) {
    value.waitStartedAt = timestamp(value.waitStartedAt, 'waitStartedAt');
    value.waitDeadlineAt = timestamp(value.waitDeadlineAt, 'waitDeadlineAt');
  }
  integer(value.waitMs, 'waitMs', 0, MAX_WAIT_MS);
  integer(value.leaseMs, 'leaseMs', 1, MAX_LEASE_MS);
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
  if (value.state !== 'waiting' && value.waitStartedAt !== null) {
    throw new LeaseError(
      'malformed-lease',
      'only waiting leases may retain wait timing fields',
    );
  }
  if (value.waitStartedAt !== null) {
    const waitStarted = Date.parse(value.waitStartedAt);
    const waitDeadline = Date.parse(value.waitDeadlineAt);
    if (
      waitDeadline < waitStarted ||
      waitDeadline - waitStarted > value.waitMs ||
      waitDeadline > Date.parse(value.expiresAt)
    ) {
      throw new LeaseError(
        'malformed-lease',
        'wait deadline must be bounded by waitMs and lease expiry',
      );
    }
  }
  if (
    Date.parse(value.expiresAt) < Date.parse(value.armedAt) ||
    Date.parse(value.expiresAt) - Date.parse(value.armedAt) !== value.leaseMs
  ) {
    throw new LeaseError(
      'malformed-lease',
      'lease expiry must match its finite lease duration',
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
    value.waitStartedAt = null;
    value.waitDeadlineAt = null;
  }
  if (
    (value.state === 'armed' || value.state === 'waiting') &&
    (value.continuationCount >= value.continuationCap ||
      value.loopCount >= value.loopCap)
  ) {
    value.state = 'idle';
    value.diagnostic = 'cap-reached';
    value.waitStartedAt = null;
    value.waitDeadlineAt = null;
  }
  if (
    value.state === 'waiting' &&
    (value.waitDeadlineAt === null || now >= Date.parse(value.waitDeadlineAt))
  ) {
    value.state = 'idle';
    value.diagnostic =
      value.waitDeadlineAt === null
        ? 'wait-timing-rearm-required'
        : 'wait-timeout';
    value.waitStartedAt = null;
    value.waitDeadlineAt = null;
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
  if (persistMigration && raw.schemaVersion !== migrated.schemaVersion) {
    return withLeaseLock(file, async () => {
      const latest = await readLease(root, ownerSession, {
        persistMigration: false,
      });
      if (latest) await atomicWriteJson(file, latest);
      return latest;
    });
  }
  return migrated;
}

export async function writeLease(root, lease) {
  const value = validateLease(lease);
  const file = leasePath(root, value.ownerSession);
  return withLeaseLock(file, async () => {
    await atomicWriteJson(file, value);
    return value;
  });
}

export async function withLeaseLock(file, fn) {
  const lock = `${file}.lock`;
  let handle;
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  await chmod(dirname(file), 0o700);
  for (let attempt = 0; ; attempt += 1) {
    try {
      handle = await open(lock, 'wx', 0o600);
      break;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      if (attempt >= 199)
        throw new LeaseError(
          'lease-lock-timeout',
          'lease mutation lock timed out',
        );
      await new Promise((resolveWait) => setTimeout(resolveWait, 5));
    }
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
  return withLeaseLock(file, async () => {
    const current = await readLease(root, ownerSession, {
      persistMigration: false,
    });
    if (!current) return { ok: false, reason: 'missing' };
    if (
      current.leaseId !== expected.leaseId ||
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
    const loopIncrement = integer(
      update.loopIncrement ?? 1,
      'loopIncrement',
      0,
      current.loopCap - current.loopCount,
    );
    const next = validateLease({
      ...current,
      peerCursor: nextCursor,
      continuationCount: current.continuationCount + 1,
      loopCount: current.loopCount + loopIncrement,
      state: update.terminal === false ? 'armed' : 'triggered',
      waitStartedAt: null,
      waitDeadlineAt: null,
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
  return withLeaseLock(file, async () => {
    const current = await readLease(root, ownerSession, {
      persistMigration: false,
    });
    if (!current) return { ok: false, reason: 'missing' };
    if (
      current.runtime !== identity.runtime ||
      current.peerRuntime !== identity.peerRuntime ||
      current.peerSession !== identity.peerSession ||
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
      waitStartedAt: new Date(now).toISOString(),
      waitDeadlineAt: new Date(
        Math.min(now + effective.waitMs, Date.parse(effective.expiresAt)),
      ).toISOString(),
      updatedAt: new Date(now).toISOString(),
      diagnostic: null,
    });
    await atomicWriteJson(file, waiting);
    return { ok: true, changed: true, lease: waiting };
  });
}

export async function finishLeaseWait(
  root,
  ownerSession,
  expected,
  diagnostic = 'wait-timeout',
  now = Date.now(),
) {
  const file = leasePath(root, ownerSession);
  return withLeaseLock(file, async () => {
    const current = await readLease(root, ownerSession, {
      persistMigration: false,
    });
    if (!current) return { ok: false, reason: 'missing' };
    if (
      current.leaseId !== expected.leaseId ||
      current.peerCursor !== expected.peerCursor ||
      current.continuationCount !== expected.continuationCount ||
      current.loopCount !== expected.loopCount
    ) {
      return { ok: false, reason: 'stale', lease: current };
    }
    if (current.state !== 'waiting')
      return { ok: false, reason: current.state, lease: current };
    const idle = validateLease({
      ...current,
      state: 'idle',
      waitStartedAt: null,
      waitDeadlineAt: null,
      diagnostic,
      updatedAt: new Date(now).toISOString(),
    });
    await atomicWriteJson(file, idle);
    return { ok: true, lease: idle };
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
  const targetedSession = ownerSession
    ? validateId(ownerSession, 'owner-session')
    : undefined;
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
    if (!ID.test(session) || (targetedSession && session !== targetedSession))
      continue;
    const file = leasePath(root, session);
    await withLeaseLock(file, async () => {
      let lease;
      try {
        lease = await readLease(root, session, { persistMigration: false });
      } catch {
        return;
      }
      if (!lease || lease.ownerSession !== session) return;
      const expired = now >= Date.parse(lease.expiresAt);
      const capped =
        lease.continuationCount >= lease.continuationCap ||
        lease.loopCount >= lease.loopCap;
      const targetedDisarmed =
        Boolean(targetedSession) && lease.state === 'disarmed';
      const missing =
        !(await resourceExists(lease.ownerCwd)) ||
        !(await resourceExists(lease.peerTranscript));
      if (expired || capped || targetedDisarmed || missing) {
        await rm(file);
        removed.push(session);
      }
    });
  }
  return removed;
}
