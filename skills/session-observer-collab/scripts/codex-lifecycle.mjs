import { randomUUID } from 'node:crypto';
import {
  chmod,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname } from 'node:path';

import { validateAbsolutePath } from './lib/lease-state.mjs';

export const CODEX_STOP_STATUS_MESSAGE =
  'Checking for Session Observer peer activity';
export const CODEX_STOP_TIMEOUT_SECONDS = 15;

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

export function codexStopCommand(scriptPath) {
  return `node ${validateAbsolutePath(scriptPath, 'script-path')}`;
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
      (entry) =>
        plainObject(entry) &&
        entry.type === 'command' &&
        entry.command === command,
    ),
  );
}

export async function installCodexStopHook(input) {
  const { hooksPath, scriptPath } = resolvedPaths(input);
  const command = codexStopCommand(scriptPath);
  const config = await readHookConfig(hooksPath);
  if (exactHookEntries(config, command).length > 0)
    return { changed: false, exactCommand: command, config };
  const next = structuredClone(config);
  next.hooks.Stop ??= [];
  next.hooks.Stop.push({ hooks: [codexStopHookEntry(scriptPath)] });
  await writeHookConfig(hooksPath, next);
  return { changed: true, exactCommand: command, config: next };
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
  const enablement =
    status?.enabled === false ? 'disabled' : 'not-explicitly-disabled';
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
    enablement,
    effectiveExecution,
    mayArm:
      installed &&
      trusted === 'trusted' &&
      enablement !== 'disabled' &&
      effectiveExecution === 'observed',
  });
}

export async function uninstallCodexStopHook({
  hooksPath: rawHooksPath,
  scriptPath: rawScriptPath,
  confirmed,
  activeLeaseCount = 0,
  removeScript = false,
}) {
  if (confirmed !== true)
    throw new CodexLifecycleError(
      'confirmation-required',
      'explicit confirmation is required to uninstall the Codex hook',
    );
  if (!Number.isSafeInteger(activeLeaseCount) || activeLeaseCount < 0)
    throw new CodexLifecycleError(
      'invalid-active-lease-count',
      'active lease count must be a non-negative integer',
    );
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
  const next = structuredClone(config);
  let removed = 0;
  if (Array.isArray(next.hooks.Stop)) {
    next.hooks.Stop = next.hooks.Stop.map((group) => {
      const hooks = group.hooks.filter((entry) => {
        const observer =
          plainObject(entry) &&
          entry.type === 'command' &&
          entry.command === command;
        if (observer) removed += 1;
        return !observer;
      });
      return { ...group, hooks };
    }).filter((group) => group.hooks.length > 0);
  }
  if (removed > 0) await writeHookConfig(hooksPath, next);
  if (removeScript) await rm(scriptPath, { force: true });
  return {
    changed: removed > 0 || removeScript,
    exactCommand: command,
    removed,
  };
}
