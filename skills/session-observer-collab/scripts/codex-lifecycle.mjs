import { randomUUID } from 'node:crypto';
import {
  chmod,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { removeCodexStopBundle } from './lib/codex-install.mjs';
import {
  effectiveLease,
  leasePath,
  MAX_WAIT_MS,
  readLease,
  validateAbsolutePath,
  withLeaseLock,
} from './lib/lease-state.mjs';

export const CODEX_STOP_STATUS_MESSAGE =
  'Checking for Session Observer peer activity';
// Codex enforces this provider-level timeout independently of a lease. Keep a
// finite grace period for setup and state finalization after every supported
// bounded wait, so the provider cannot strand a lease in `waiting`.
export const CODEX_STOP_TIMEOUT_GRACE_SECONDS = 5;
export const CODEX_STOP_TIMEOUT_SECONDS =
  MAX_WAIT_MS / 1_000 + CODEX_STOP_TIMEOUT_GRACE_SECONDS;

export class CodexLifecycleError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CodexLifecycleError';
    this.code = code;
  }
}

function plainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateHookConfig(value) {
  if (!plainObject(value) || !plainObject(value.hooks))
    throw new CodexLifecycleError(
      'invalid-hooks-config',
      'Codex hooks config must contain a hooks object',
    );
  for (const [event, groups] of Object.entries(value.hooks)) {
    if (!Array.isArray(groups))
      throw new CodexLifecycleError(
        'invalid-hooks-config',
        `Codex hook event ${event} must be an array`,
      );
    for (const group of groups) {
      if (!plainObject(group) || !Array.isArray(group.hooks))
        throw new CodexLifecycleError(
          'invalid-hooks-config',
          `Codex hook event ${event} contains an invalid hook group`,
        );
    }
  }
  return value;
}

async function readHookConfig(hooksPath) {
  try {
    return validateHookConfig(JSON.parse(await readFile(hooksPath, 'utf8')));
  } catch (error) {
    if (error?.code === 'ENOENT') return { hooks: {} };
    if (error instanceof CodexLifecycleError) throw error;
    throw new CodexLifecycleError(
      'invalid-hooks-config',
      `Codex hooks config is unreadable: ${error.message}`,
    );
  }
}

async function writeHookConfig(hooksPath, config) {
  await mkdir(dirname(hooksPath), { recursive: true, mode: 0o700 });
  const temporary = `${hooksPath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, {
      mode: 0o600,
    });
    await chmod(temporary, 0o600);
    await rename(temporary, hooksPath);
    await chmod(hooksPath, 0o600);
  } finally {
    await rm(temporary, { force: true });
  }
}

function resolvedPaths({ hooksPath, scriptPath }) {
  return {
    hooksPath: validateAbsolutePath(hooksPath, 'hooks-path'),
    scriptPath: validateAbsolutePath(scriptPath, 'script-path'),
  };
}

export async function withCodexLifecycleLock(root, fn) {
  const stateRoot = validateAbsolutePath(root, 'state-root');
  const lock = join(stateRoot, 'codex-lifecycle.lock');
  let handle;
  await mkdir(stateRoot, { recursive: true, mode: 0o700 });
  await chmod(stateRoot, 0o700);
  for (let attempt = 0; ; attempt += 1) {
    try {
      handle = await open(lock, 'wx', 0o600);
      break;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      if (attempt >= 199)
        throw new CodexLifecycleError(
          'codex-lifecycle-lock-timeout',
          'Codex lifecycle mutation lock timed out',
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

async function activeCodexLeaseCount(root, now) {
  const leasesDir = join(root, 'leases');
  let names;
  try {
    names = await readdir(leasesDir);
  } catch (error) {
    if (error?.code === 'ENOENT') return 0;
    throw error;
  }
  let count = 0;
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const ownerSession = name.slice(0, -'.json'.length);
    const file = leasePath(root, ownerSession);
    await withLeaseLock(file, async () => {
      const lease = await readLease(root, ownerSession, {
        persistMigration: false,
      });
      if (!lease) return;
      const effective = effectiveLease(lease, now);
      if (
        effective.runtime === 'codex' &&
        ['armed', 'waiting'].includes(effective.state)
      ) {
        count += 1;
      }
    });
  }
  return count;
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

export function codexStopCommand(scriptPath) {
  // Codex stores command hooks as shell commands. Keep the registered command
  // as one canonical string so the same byte sequence is used for install,
  // trust/status matching, and removal, including paths with spaces or shell
  // metacharacters.
  return `node -- ${shellQuote(validateAbsolutePath(scriptPath, 'script-path'))}`;
}

export function codexStopHookEntry(scriptPath) {
  return Object.freeze({
    type: 'command',
    command: codexStopCommand(scriptPath),
    timeout: CODEX_STOP_TIMEOUT_SECONDS,
    statusMessage: CODEX_STOP_STATUS_MESSAGE,
  });
}

function exactHookEntries(config, command) {
  return (config.hooks.Stop ?? []).flatMap((group) =>
    group.hooks.filter(
      (entry) => plainObject(entry) && entry.command === command,
    ),
  );
}

function hasCanonicalManagedFields(entry, canonical) {
  return (
    entry.type === canonical.type &&
    entry.timeout === canonical.timeout &&
    entry.statusMessage === canonical.statusMessage
  );
}

export async function installCodexStopHook(input) {
  const { hooksPath, scriptPath } = resolvedPaths(input);
  const command = codexStopCommand(scriptPath);
  const config = await readHookConfig(hooksPath);
  const exact = exactHookEntries(config, command);
  if (exact.length > 1)
    throw new CodexLifecycleError(
      'ambiguous-observer-registration',
      'multiple exact Codex observer registrations found; refusing reconciliation',
    );
  const canonical = codexStopHookEntry(scriptPath);
  if (exact.length === 1 && hasCanonicalManagedFields(exact[0], canonical))
    return { changed: false, exactCommand: command, config };
  const next = structuredClone(config);
  next.hooks.Stop ??= [];
  if (exact.length === 0) {
    next.hooks.Stop.push({ hooks: [canonical] });
  } else {
    next.hooks.Stop = next.hooks.Stop.map((group) => ({
      ...group,
      hooks: group.hooks.map((entry) =>
        plainObject(entry) && entry.command === command
          ? { ...entry, ...canonical }
          : entry,
      ),
    }));
  }
  await writeHookConfig(hooksPath, next);
  return { changed: true, exactCommand: command, config: next };
}

export async function inspectCodexStopHook({
  hooksPath: rawHooksPath,
  scriptPath: rawScriptPath,
}) {
  const { hooksPath, scriptPath } = resolvedPaths({
    hooksPath: rawHooksPath,
    scriptPath: rawScriptPath,
  });
  const config = await readHookConfig(hooksPath);
  return {
    exactCommand: codexStopCommand(scriptPath),
    config,
  };
}

function exactRecord(records, command) {
  if (!Array.isArray(records)) return undefined;
  return records.find(
    (record) => plainObject(record) && record.command === command,
  );
}

/**
 * Classifies only observed Codex facts. The caller supplies data read from the
 * `/hooks` trust/status surfaces; this module neither grants trust nor guesses
 * what a missing `enabled` field means.
 */
export function assessCodexHookReadiness({
  scriptPath,
  hooks,
  trustRecords = [],
  hookStatuses = [],
  leaseArmed = false,
  liveWakePassed = false,
}) {
  const command = codexStopCommand(scriptPath);
  const config = validateHookConfig(hooks);
  const trust = exactRecord(trustRecords, command);
  const status = exactRecord(hookStatuses, command);
  const trusted = trust
    ? trust.trusted === true
      ? 'trusted'
      : 'untrusted'
    : 'unverified';
  const explicitEnablement =
    status?.enabled === true
      ? 'enabled'
      : status?.enabled === false
        ? 'disabled'
        : 'not-explicitly-enabled';
  const effectiveExecution =
    typeof status?.lastRanAt === 'string' &&
    Number.isFinite(Date.parse(status.lastRanAt))
      ? 'observed'
      : 'unverified';
  const installed = exactHookEntries(config, command).length > 0;
  return Object.freeze({
    exactCommand: command,
    installed,
    trusted,
    explicitEnablement,
    effectiveExecution,
    leaseArmed: leaseArmed === true ? 'armed' : 'not-armed',
    liveWake: liveWakePassed === true ? 'passed' : 'unverified',
    mayArm:
      installed &&
      trusted === 'trusted' &&
      explicitEnablement !== 'disabled' &&
      effectiveExecution === 'observed',
  });
}

export async function uninstallCodexStopHook({
  hooksPath: rawHooksPath,
  scriptPath: rawScriptPath,
  confirmed,
  root,
  removeScript = false,
  now = Date.now(),
}) {
  if (confirmed !== true)
    throw new CodexLifecycleError(
      'confirmation-required',
      'explicit confirmation is required to uninstall the Codex hook',
    );
  return withCodexLifecycleLock(root, async () => {
    const activeLeaseCount = await activeCodexLeaseCount(root, now);
    if (activeLeaseCount > 0)
      throw new CodexLifecycleError(
        'active-leases',
        'cannot uninstall while active collaboration leases remain',
      );
    const { hooksPath, scriptPath } = resolvedPaths({
      hooksPath: rawHooksPath,
      scriptPath: rawScriptPath,
    });
    const command = codexStopCommand(scriptPath);
    const config = await readHookConfig(hooksPath);
    const exact = exactHookEntries(config, command);
    if (exact.length > 1)
      throw new CodexLifecycleError(
        'ambiguous-observer-registration',
        'multiple exact Codex observer registrations found; refusing removal',
      );
    if (exact.length === 0)
      return {
        changed: false,
        exactCommand: command,
        removed: 0,
        scriptRemoved: false,
        safety: { activeLeaseCount },
      };
    const next = structuredClone(config);
    let removed = 0;
    if (Array.isArray(next.hooks.Stop)) {
      next.hooks.Stop = next.hooks.Stop.map((group) => {
        const hooks = group.hooks.filter((entry) => {
          const observer = plainObject(entry) && entry.command === command;
          if (observer) removed += 1;
          return !observer;
        });
        return { ...group, hooks };
      }).filter((group) => group.hooks.length > 0);
    }
    await writeHookConfig(hooksPath, next);
    let scriptRemoved = false;
    let supportRemoved = false;
    if (removeScript) {
      ({ scriptRemoved, supportRemoved } =
        await removeCodexStopBundle(scriptPath));
    }
    return {
      changed: true,
      exactCommand: command,
      removed,
      scriptRemoved,
      supportRemoved,
      safety: { activeLeaseCount },
    };
  });
}
