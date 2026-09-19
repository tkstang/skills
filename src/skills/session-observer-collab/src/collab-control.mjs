#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { chmod, mkdir, open, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  appendLogEntry,
  getLogView,
  renderLog,
} from '../../../shared/collaboration/log.js';
import {
  joinCollaboration,
  openCollaboration,
} from '../../../shared/collaboration/membership.js';
import { collaborationPaths } from '../../../shared/collaboration/paths.js';
import { assertPin } from '../../../shared/collaboration/types.js';
import {
  assessCodexHookReadiness,
  inspectCodexStopHook,
  installCodexStopHook,
  uninstallCodexStopHook,
  withCodexLifecycleLock,
} from './codex-lifecycle.mjs';
import { installCodexStopBundle } from './lib/codex-install.mjs';
import {
  DEFAULT_WAIT_MS,
  LEASE_SCHEMA_VERSION,
  MAX_CONTINUATIONS,
  MAX_LEASE_MS,
  MAX_LOOPS,
  atomicWriteJson,
  canonicalizePeerTranscript,
  effectiveLease,
  leasePath,
  pruneLeases,
  readLease,
  recoverOrphanedWait,
  stateRoot,
  validateAbsolutePath,
  validateId,
  validateOwnerRuntime,
  validatePeerIndexBase,
  validatePeerRuntime,
  validatePeerTranscriptSession,
  withLeaseLock,
} from './lib/lease-state.mjs';
import { captureCursorArmContinuity } from './lib/selected-prefix.mjs';

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
    if (
      rawKey === 'json' ||
      rawKey === 'confirmed' ||
      rawKey === 'remove-script' ||
      rawKey === 'what-stdin' ||
      rawKey === 'confirm-old-monitor-stopped' ||
      rawKey === 'confirm-standalone-watcher-stopped'
    ) {
      options[key] = true;
      continue;
    }
    const value = inline ?? rest[++i];
    if (value === undefined || value.startsWith('--'))
      throw new Error(`missing value for --${rawKey}`);
    options[key] = value;
  }
  return { command, options };
}

function requiredOption(options, key, flag = key) {
  const value = options[key];
  if (typeof value !== 'string' || value.length === 0)
    throw new Error(`--${flag} is required`);
  return value;
}

function parsePin(value) {
  const separator = value.indexOf(':');
  if (separator <= 0 || separator === value.length - 1)
    throw new Error('--self must use <runtime>:<session-id>');
  const pin = {
    runtime: value.slice(0, separator),
    sessionId: value.slice(separator + 1),
  };
  assertPin(pin);
  return pin;
}

function sharedResult(root, collaborationId, data) {
  return {
    collaborationId,
    root,
    paths: collaborationPaths(root, collaborationId),
    delivery: 'disabled',
    data,
  };
}

async function readStdinBounded() {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > 16 * 1024)
      throw new Error('standard input exceeds 16384 bytes');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
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

async function withInstallationLock(root, fn) {
  const lock = join(root, 'installation.json.lock');
  let handle;
  await mkdir(root, { recursive: true, mode: 0o700 });
  await chmod(root, 0o700);
  for (let attempt = 0; ; attempt += 1) {
    try {
      handle = await open(lock, 'wx', 0o600);
      break;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      if (attempt >= 199)
        throw new Error('installation mutation lock timed out', {
          cause: error,
        });
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

export async function install(root, { runtime, command }) {
  validateOwnerRuntime(runtime);
  const exactCommand = validateAbsolutePath(command, 'command');
  return withInstallationLock(root, async () => {
    const installation = await readInstallation(root);
    const existing = installation.runtimes[runtime];
    if (existing?.command === exactCommand)
      return { changed: false, installation };
    installation.runtimes[runtime] = { command: exactCommand };
    await atomicWriteJson(join(root, 'installation.json'), installation);
    return { changed: true, installation };
  });
}

export async function arm(root, options, now = Date.now()) {
  const runtime = validateOwnerRuntime(options.runtime);
  const peerRuntime = validatePeerRuntime(options.peerRuntime);
  const ownerSession = validateId(options.session, 'owner-session');
  const peerSession = validateId(options.peerSession, 'peer-session');
  const ownerCwd = validateAbsolutePath(options.cwd, 'owner-cwd');
  const peerPath = await canonicalizePeerTranscript(
    peerRuntime,
    options.peerTranscript,
  );
  validatePeerTranscriptSession(
    peerRuntime,
    peerSession,
    peerPath.peerCanonicalTranscriptPath,
  );
  if (options.peerIndexBase !== undefined) {
    validatePeerIndexBase(options.peerIndexBase, peerRuntime);
  }
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
  const composedActivation =
    runtime === 'claude-code'
      ? (() => {
          const collaborationId = String(options.collaborationId ?? '');
          const activationId = String(options.activationId ?? '');
          const uuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
          if (!uuid.test(collaborationId) || !uuid.test(activationId))
            throw new Error(
              'Claude Monitor arm requires --collaboration-id and --activation-id UUIDs',
            );
          if (
            options.confirmOldMonitorStopped !== true ||
            options.confirmStandaloneWatcherStopped !== true
          ) {
            throw new Error(
              'Claude Monitor arm requires exact acting-session confirmation that the old Monitor and standalone watcher are stopped',
            );
          }
          return {
            collaborationId,
            activationId,
            controller: 'observer-collab',
            mechanism: 'monitor',
            ownerRuntime: runtime,
            ownerSession,
            peerRuntime,
            peerSession,
            ownerCwd,
            peerTranscript: peerPath.peerTranscript,
            confirmedAt: new Date(now).toISOString(),
            oldMonitorStopped: true,
            standaloneWatcherStopped: true,
          };
        })()
      : null;
  const identity = {
    runtime,
    peerRuntime,
    ownerSession,
    ownerCwd,
    peerSession,
    ...peerPath,
  };
  const file = leasePath(root, ownerSession);
  return withCodexLifecycleLock(root, () =>
    withLeaseLock(file, async () => {
      let existing;
      try {
        existing = await readLease(root, ownerSession, {
          persistMigration: false,
        });
      } catch (error) {
        if (error?.code !== 'cursor-lease-rearm-required') throw error;
        existing = null;
      }
      const isClaudeRearm = runtime === 'claude-code' && existing !== null;
      if (isClaudeRearm) {
        if (
          existing.runtime !== runtime ||
          existing.peerRuntime !== peerRuntime ||
          existing.ownerSession !== ownerSession ||
          existing.ownerCwd !== ownerCwd ||
          existing.peerSession !== peerSession ||
          existing.peerTranscript !== peerPath.peerTranscript ||
          existing.composedActivation?.collaborationId !==
            composedActivation.collaborationId ||
          existing.composedActivation?.activationId !==
            composedActivation.activationId
        ) {
          throw new Error(
            'Claude Monitor re-arm must preserve the exact owner, peer, transcript, cwd, collaboration, and activation',
          );
        }
        if (
          now >= Date.parse(existing.expiresAt) ||
          existing.continuationCount >= existing.continuationCap ||
          existing.loopCount >= existing.loopCap
        ) {
          throw new Error(
            'Claude Monitor re-arm cannot revive an expired or exhausted observer lease',
          );
        }
      }
      if (
        runtime === 'claude-code' &&
        !isClaudeRearm &&
        options.cursor === undefined
      ) {
        throw new Error(
          'Claude Monitor initial arm requires an explicit private --cursor',
        );
      }
      const cursor = numberOption(
        options.cursor ?? existing?.peerCursor ?? 0,
        'cursor',
        0,
        Number.MAX_SAFE_INTEGER,
      );
      if (isClaudeRearm && cursor !== existing.peerCursor)
        throw new Error(
          'Claude Monitor re-arm cannot reset the private cursor',
        );
      const peerContinuity =
        peerRuntime === 'cursor'
          ? await captureCursorArmContinuity(
              peerPath.peerCanonicalTranscriptPath,
              cursor,
            )
          : null;
      const request = {
        ...identity,
        peerCursor: cursor,
        peerContinuity,
        continuationCap,
        loopCap,
        waitMs,
        leaseMs,
        ...(runtime === 'claude-code' ? { composedActivation } : {}),
      };
      if (
        existing &&
        ['armed', 'waiting'].includes(effectiveLease(existing, now).state) &&
        Object.entries(request).every(([key, value]) =>
          value !== null && typeof value === 'object'
            ? JSON.stringify(existing[key]) === JSON.stringify(value)
            : existing[key] === value,
        )
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
        peerContinuity,
        ...(runtime === 'claude-code' ? { composedActivation } : {}),
        continuationCount: isClaudeRearm ? existing.continuationCount : 0,
        continuationCap: isClaudeRearm
          ? existing.continuationCap
          : continuationCap,
        loopCount: isClaudeRearm ? existing.loopCount : 0,
        loopCap: isClaudeRearm ? existing.loopCap : loopCap,
        waitMs,
        leaseMs,
        waitStartedAt: null,
        waitDeadlineAt: null,
        waitToken: null,
        waitPid: null,
        armedAt: isClaudeRearm ? existing.armedAt : stamp,
        expiresAt: isClaudeRearm
          ? existing.expiresAt
          : new Date(now + leaseMs).toISOString(),
        updatedAt: stamp,
        diagnostic: null,
      };
      await atomicWriteJson(file, lease);
      return { changed: true, lease };
    }),
  );
}

function records(value, name) {
  if (value === undefined) return [];
  if (!Array.isArray(value))
    throw new Error(`${name} must contain a JSON array`);
  return value;
}

async function readRecords(path, name) {
  if (path === undefined) return [];
  const absolute = validateAbsolutePath(path, name);
  try {
    return records(JSON.parse(await readFile(absolute, 'utf8')), name);
  } catch (error) {
    if (error.message?.includes('must contain a JSON array')) throw error;
    throw new Error(`${name} is unreadable: ${error.message}`, {
      cause: error,
    });
  }
}

export async function codexInstall(root, options) {
  return withCodexLifecycleLock(root, async () => {
    const bundle = await installCodexStopBundle({
      scriptPath: options.scriptPath,
      sourceScriptPath:
        options.sourceScriptPath ??
        fileURLToPath(new URL('./hooks/codex-stop.mjs', import.meta.url)),
    });
    const registration = await installCodexStopHook(options);
    return {
      bundle,
      registration,
      readiness: assessCodexHookReadiness({
        scriptPath: options.scriptPath,
        hooks: registration.config,
      }),
    };
  });
}

export async function codexStatus(root, options, now = Date.now()) {
  const registration = await inspectCodexStopHook({
    hooksPath: options.hooksPath,
    scriptPath: options.scriptPath,
  });
  const current = options.session
    ? await status(root, options.session, now)
    : { lease: null };
  return assessCodexHookReadiness({
    scriptPath: options.scriptPath,
    hooks: registration.config,
    trustRecords: await readRecords(
      options.trustRecordsPath,
      'trust-records-path',
    ),
    hookStatuses: await readRecords(
      options.hookStatusesPath,
      'hook-statuses-path',
    ),
    leaseArmed: ['armed', 'waiting'].includes(current.lease?.state),
  });
}

export async function codexUninstall(root, options, now = Date.now()) {
  if (options.confirmed !== true)
    throw new Error(
      'explicit --confirmed is required to uninstall the Codex hook',
    );
  return uninstallCodexStopHook({
    hooksPath: options.hooksPath,
    scriptPath: options.scriptPath,
    confirmed: true,
    root,
    removeScript: options.removeScript === true,
    now,
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
      waitStartedAt: null,
      waitDeadlineAt: null,
      waitToken: null,
      waitPid: null,
      updatedAt: new Date(now).toISOString(),
      diagnostic: 'user-disarmed',
    };
    await atomicWriteJson(file, lease);
    return { changed: true, lease };
  });
}

export async function status(
  root,
  ownerSession,
  now = Date.now(),
  recoveryOptions,
) {
  const installation = await readInstallation(root);
  if (ownerSession) {
    await recoverOrphanedWait(
      root,
      validateId(ownerSession, 'owner-session'),
      now,
      recoveryOptions,
    );
    await pruneLeases(root, {
      now,
      ownerSession: validateId(ownerSession, 'owner-session'),
    });
  }
  const lease = ownerSession
    ? await readLease(root, validateId(ownerSession, 'owner-session'))
    : null;
  return { installation, lease: lease ? effectiveLease(lease, now) : null };
}

export async function run(
  argv,
  env = process.env,
  now = Date.now(),
  readStdin = readStdinBounded,
) {
  const { command, options } = parseArgs(argv);
  const root = stateRoot(env);
  await mkdir(root, { recursive: true, mode: 0o700 });
  await chmod(root, 0o700);
  if (command === 'collaboration-open') {
    const collaborationId =
      typeof options.collab === 'string' ? options.collab : randomUUID();
    const data = await openCollaboration({
      root,
      collaborationId,
      pin: parsePin(requiredOption(options, 'self')),
      alias: requiredOption(options, 'alias'),
      label: requiredOption(options, 'label'),
      task: requiredOption(options, 'task'),
      worktree: typeof options.cwd === 'string' ? options.cwd : process.cwd(),
      now: new Date(now).toISOString(),
    });
    return {
      ok: true,
      command,
      ...sharedResult(root, collaborationId, data),
    };
  }
  if (command === 'collaboration-join') {
    const collaborationId = requiredOption(options, 'collab');
    const data = await joinCollaboration({
      root,
      collaborationId,
      pin: parsePin(requiredOption(options, 'self')),
      alias: requiredOption(options, 'alias'),
      worktree: typeof options.cwd === 'string' ? options.cwd : process.cwd(),
      now: new Date(now).toISOString(),
    });
    return {
      ok: true,
      command,
      ...sharedResult(root, collaborationId, data),
    };
  }
  if (command === 'log-append') {
    const collaborationId = requiredOption(options, 'collab');
    const whatHappened =
      options.whatStdin === true
        ? await readStdin()
        : requiredOption(options, 'what');
    const data = await appendLogEntry({
      root,
      collaborationId,
      pin: parsePin(requiredOption(options, 'self')),
      id: requiredOption(options, 'id'),
      category: requiredOption(options, 'category'),
      title: requiredOption(options, 'title'),
      whatHappened,
      assessment: requiredOption(options, 'assessment'),
      skillImplication: requiredOption(options, 'implication'),
      now: new Date(now).toISOString(),
    });
    return {
      ok: true,
      command,
      ...sharedResult(root, collaborationId, data),
    };
  }
  if (command === 'log-show' || command === 'log-render') {
    const collaborationId = requiredOption(options, 'collab');
    const data =
      command === 'log-render'
        ? await renderLog({ root, collaborationId })
        : await getLogView({ root, collaborationId });
    return {
      ok: true,
      command,
      ...sharedResult(root, collaborationId, data),
    };
  }
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
  if (command === 'codex-install')
    return { ok: true, command, ...(await codexInstall(root, options)) };
  if (command === 'codex-status')
    return { ok: true, command, ...(await codexStatus(root, options, now)) };
  if (command === 'codex-uninstall')
    return { ok: true, command, ...(await codexUninstall(root, options, now)) };
  throw new Error(
    'usage: collab-control collaboration-open|collaboration-join|log-append|log-show|log-render|install|status|arm|disarm|prune|codex-install|codex-status|codex-uninstall [options] [--json]',
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
