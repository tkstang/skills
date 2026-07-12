#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_WAIT_MS,
  LEASE_SCHEMA_VERSION,
  MAX_CONTINUATIONS,
  MAX_LEASE_MS,
  MAX_LOOPS,
  atomicWriteJson,
  effectiveLease,
  leasePath,
  pruneLeases,
  readLease,
  stateRoot,
  validateAbsolutePath,
  validateId,
  validateRuntime,
  withLeaseLock,
} from './lib/lease-state.mjs';

export const CONTROL_SCHEMA_VERSION = 1;

function numberOption(value, name, min, max) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max)
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  return parsed;
}

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--'))
      throw new Error(`unexpected argument: ${token}`);
    const [rawKey, inline] = token.slice(2).split('=', 2);
    const key = rawKey.replace(/-([a-z])/g, (_, letter) =>
      letter.toUpperCase(),
    );
    if (rawKey === 'json') {
      options.json = true;
      continue;
    }
    const value = inline ?? rest[++i];
    if (value === undefined || value.startsWith('--'))
      throw new Error(`missing value for --${rawKey}`);
    options[key] = value;
  }
  return { command, options };
}

async function readInstallation(root) {
  try {
    const value = JSON.parse(
      await readFile(join(root, 'installation.json'), 'utf8'),
    );
    if (
      value.schemaVersion !== CONTROL_SCHEMA_VERSION ||
      !value.runtimes ||
      typeof value.runtimes !== 'object'
    )
      throw new Error('unsupported installation schema');
    return value;
  } catch (error) {
    if (error?.code === 'ENOENT')
      return { schemaVersion: CONTROL_SCHEMA_VERSION, runtimes: {} };
    throw new Error(`installation state is malformed: ${error.message}`, {
      cause: error,
    });
  }
}

export async function install(root, { runtime, command }) {
  validateRuntime(runtime);
  const exactCommand = validateAbsolutePath(command, 'command');
  const installation = await readInstallation(root);
  const existing = installation.runtimes[runtime];
  if (existing?.command === exactCommand)
    return { changed: false, installation };
  installation.runtimes[runtime] = { command: exactCommand };
  await atomicWriteJson(join(root, 'installation.json'), installation);
  return { changed: true, installation };
}

export async function arm(root, options, now = Date.now()) {
  const runtime = validateRuntime(options.runtime);
  const peerRuntime = validateRuntime(options.peerRuntime);
  const ownerSession = validateId(options.session, 'owner-session');
  const peerSession = validateId(options.peerSession, 'peer-session');
  const ownerCwd = validateAbsolutePath(options.cwd, 'owner-cwd');
  const peerTranscript = validateAbsolutePath(
    options.peerTranscript,
    'peer-transcript',
  );
  const waitMs = numberOption(
    options.waitMs ?? DEFAULT_WAIT_MS,
    'wait-ms',
    0,
    60_000,
  );
  const leaseMs = numberOption(
    options.leaseMs ?? 60_000,
    'lease-ms',
    1,
    MAX_LEASE_MS,
  );
  const continuationCap = numberOption(
    options.continuationCap ?? 1,
    'continuation-cap',
    1,
    MAX_CONTINUATIONS,
  );
  const loopCap = numberOption(
    options.loopCap ?? continuationCap,
    'loop-cap',
    1,
    MAX_LOOPS,
  );
  const cursor = numberOption(
    options.cursor ?? 0,
    'cursor',
    0,
    Number.MAX_SAFE_INTEGER,
  );
  const identity = {
    runtime,
    peerRuntime,
    ownerSession,
    ownerCwd,
    peerSession,
    peerTranscript,
  };
  const file = leasePath(root, ownerSession);
  return withLeaseLock(file, async () => {
    const existing = await readLease(root, ownerSession, {
      persistMigration: false,
    });
    const request = {
      ...identity,
      peerCursor: cursor,
      continuationCap,
      loopCap,
      waitMs,
      leaseMs,
    };
    if (
      existing &&
      ['armed', 'waiting'].includes(effectiveLease(existing, now).state) &&
      Object.entries(request).every(([key, value]) => existing[key] === value)
    ) {
      return { changed: false, lease: effectiveLease(existing, now) };
    }
    const stamp = new Date(now).toISOString();
    const lease = {
      schemaVersion: LEASE_SCHEMA_VERSION,
      leaseId: randomUUID(),
      ...identity,
      state: 'armed',
      peerCursor: cursor,
      continuationCount: 0,
      continuationCap,
      loopCount: 0,
      loopCap,
      waitMs,
      leaseMs,
      armedAt: stamp,
      expiresAt: new Date(now + leaseMs).toISOString(),
      updatedAt: stamp,
      diagnostic: null,
    };
    await atomicWriteJson(file, lease);
    return { changed: true, lease };
  });
}

export async function disarm(root, ownerSession, now = Date.now()) {
  const session = validateId(ownerSession, 'owner-session');
  const file = leasePath(root, session);
  return withLeaseLock(file, async () => {
    const existing = await readLease(root, session, {
      persistMigration: false,
    });
    if (!existing) return { changed: false, lease: null };
    if (existing.state === 'disarmed')
      return { changed: false, lease: existing };
    const lease = {
      ...existing,
      state: 'disarmed',
      updatedAt: new Date(now).toISOString(),
      diagnostic: 'user-disarmed',
    };
    await atomicWriteJson(file, lease);
    return { changed: true, lease };
  });
}

export async function status(root, ownerSession, now = Date.now()) {
  const installation = await readInstallation(root);
  if (ownerSession)
    await pruneLeases(root, {
      now,
      ownerSession: validateId(ownerSession, 'owner-session'),
    });
  const lease = ownerSession
    ? await readLease(root, validateId(ownerSession, 'owner-session'))
    : null;
  return { installation, lease: lease ? effectiveLease(lease, now) : null };
}

export async function run(argv, env = process.env, now = Date.now()) {
  const { command, options } = parseArgs(argv);
  const root = stateRoot(env);
  await mkdir(root, { recursive: true, mode: 0o700 });
  await chmod(root, 0o700);
  if (command === 'install') {
    const result = await install(root, options);
    if (options.session)
      await pruneLeases(root, { now, ownerSession: options.session });
    return { ok: true, command, ...result };
  }
  if (command === 'arm')
    return { ok: true, command, ...(await arm(root, options, now)) };
  if (command === 'disarm')
    return { ok: true, command, ...(await disarm(root, options.session, now)) };
  if (command === 'status')
    return { ok: true, command, ...(await status(root, options.session, now)) };
  if (command === 'prune')
    return {
      ok: true,
      command,
      removed: await pruneLeases(root, { now, ownerSession: options.session }),
    };
  throw new Error(
    'usage: collab-control install|status|arm|disarm|prune [options] [--json]',
  );
}

async function main() {
  const json = process.argv.includes('--json');
  try {
    const result = await run(process.argv.slice(2));
    process.stdout.write(
      json
        ? `${JSON.stringify(result)}\n`
        : `${result.command}: ${result.changed === false ? 'unchanged' : 'ok'}\n`,
    );
  } catch (error) {
    const result = {
      ok: false,
      error: error.code ?? 'invalid-input',
      message: error.message,
    };
    (json ? process.stdout : process.stderr).write(
      json
        ? `${JSON.stringify(result)}\n`
        : `collab-control: ${error.message}\n`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  await main();
