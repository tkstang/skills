import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalJson } from '../../../shared/collaboration/records.js';
import { assertPin, type Pin } from '../../../shared/collaboration/types.js';

export const OBSERVER_LEASE_SCHEMA_VERSION = 6;
export const OBSERVER_LAUNCHER_OWNER = 'session-observer-collab-codex-stop';
export const OBSERVER_BUNDLE_MANIFEST = '.session-observer-collab-bundle.json';
export const OBSERVER_BUNDLE_FILES = [
  'session-observer-collab/scripts/hooks/codex-stop.mjs',
] as const;
export const MESSAGING_HOOK_OWNER = 'agent-messaging-host-hook-v1';

export interface StopRegistration {
  source: string;
  command: string;
  recognizedObserver: boolean;
  recognizedMessaging: boolean;
}

export interface HookInventory {
  runtime: 'codex' | 'claude-code';
  registrations: StopRegistration[];
  fingerprint: string;
  unreadableSources: string[];
  unresolvedPlugins: string[];
  visibilityLimits: string[];
}

export interface OwnershipAssessment {
  automaticAllowed: boolean;
  observerOwner: 'absent' | 'inactive' | 'present' | 'uncertain';
  reason: string;
  recoveryCommand: string | null;
  inventory: HookInventory;
  thirdPartyAcknowledgmentRequired: boolean;
  acknowledgedFingerprint: string | null;
}

function fingerprint(registrations: StopRegistration[]): string {
  return createHash('sha256')
    .update(
      canonicalJson(
        registrations
          .map(({ source, command }) => ({ source, command }))
          .toSorted(
            (left, right) =>
              left.source.localeCompare(right.source) ||
              left.command.localeCompare(right.command),
          ),
      ),
    )
    .digest('hex');
}

function stopCommands(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const hooks = (value as { hooks?: unknown }).hooks;
  if (!hooks || typeof hooks !== 'object' || Array.isArray(hooks)) return [];
  const groups = (hooks as { Stop?: unknown }).Stop;
  if (!Array.isArray(groups)) return [];
  const commands: string[] = [];
  for (const group of groups) {
    if (!group || typeof group !== 'object' || Array.isArray(group)) continue;
    const entries = (group as { hooks?: unknown }).hooks;
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (
        entry &&
        typeof entry === 'object' &&
        !Array.isArray(entry) &&
        typeof (entry as { command?: unknown }).command === 'string'
      ) {
        commands.push((entry as { command: string }).command);
      }
    }
  }
  return commands;
}

function commandScript(command: string): string | null {
  const match = /^node\s+--\s+(?:'((?:[^']|'"'"')*)'|"([^"]+)"|(\S+))$/u.exec(
    command.trim(),
  );
  const raw = match?.[1] ?? match?.[2] ?? match?.[3];
  return raw ? raw.replaceAll(`'"'"'`, `'`) : null;
}

async function recognizedObserverLauncher(command: string): Promise<boolean> {
  const script = commandScript(command);
  if (!script || !path.isAbsolute(script)) return false;
  const launcher = await readFile(script, 'utf8').catch(() => null);
  const marker = launcher?.match(
    new RegExp(`^// ${OBSERVER_LAUNCHER_OWNER}:([a-f0-9]{24})$`, 'mu'),
  );
  if (!launcher || !marker) return false;
  const supportRoot = path.join(
    path.dirname(script),
    `.${path.basename(script)}.support`,
    marker[1]!,
  );
  const manifest = await readFile(
    path.join(supportRoot, OBSERVER_BUNDLE_MANIFEST),
    'utf8',
  )
    .then((bytes) => JSON.parse(bytes) as Record<string, unknown>)
    .catch(() => null);
  if (
    !manifest ||
    manifest.owner !== OBSERVER_LAUNCHER_OWNER ||
    manifest.version !== marker[1] ||
    JSON.stringify(manifest.files) !== JSON.stringify(OBSERVER_BUNDLE_FILES)
  ) {
    return false;
  }
  return Promise.all(
    OBSERVER_BUNDLE_FILES.map((file) => lstat(path.join(supportRoot, file))),
  ).then(
    (entries) =>
      entries.every((entry) => entry.isFile() && !entry.isSymbolicLink()),
    () => false,
  );
}

async function recognizedMessagingLauncher(command: string): Promise<boolean> {
  const script = commandScript(command);
  if (!script || !path.isAbsolute(script)) return false;
  const info = await lstat(script).catch(() => null);
  if (
    !info ||
    !info.isFile() ||
    info.isSymbolicLink() ||
    info.size > 2 * 1024 * 1024
  ) {
    return false;
  }
  const launcher = await readFile(script, 'utf8').catch(() => null);
  if (!launcher || !launcher.includes(`"${MESSAGING_HOOK_OWNER}"`))
    return false;
  const header = launcher.slice(0, 512);
  return (
    header.includes('// GENERATED skill payload for agent-messaging.') &&
    (header.includes('// src/skills/agent-messaging/src/hooks/codex.ts') ||
      header.includes('// src/skills/agent-messaging/src/hooks/claude-code.ts'))
  );
}

async function readConfig(file: string): Promise<unknown | null> {
  return readFile(file, 'utf8').then(
    (value) => JSON.parse(value) as unknown,
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    },
  );
}

export async function inspectCodexStopInventory(
  hooksPath: string,
): Promise<HookInventory> {
  if (!path.isAbsolute(hooksPath))
    throw new TypeError('Codex hooks path must be absolute');
  const unreadableSources: string[] = [];
  let config: unknown | null = null;
  try {
    config = await readConfig(hooksPath);
  } catch {
    unreadableSources.push(hooksPath);
  }
  const registrations: StopRegistration[] = [];
  for (const command of stopCommands(config)) {
    registrations.push({
      source: hooksPath,
      command,
      recognizedObserver: await recognizedObserverLauncher(command),
      recognizedMessaging: await recognizedMessagingLauncher(command),
    });
  }
  return {
    runtime: 'codex',
    registrations,
    fingerprint: fingerprint(registrations),
    unreadableSources,
    unresolvedPlugins: [],
    visibilityLimits: [],
  };
}

export interface ClaudeInventoryInput {
  settingsPaths: string[];
  installedPlugins?: Record<string, string>;
}

export async function inspectClaudeStopInventory(
  input: ClaudeInventoryInput,
): Promise<HookInventory> {
  const registrations: StopRegistration[] = [];
  const unreadableSources: string[] = [];
  const unresolvedPlugins: string[] = [];
  const enabledPlugins = new Set<string>();
  for (const source of input.settingsPaths) {
    if (!path.isAbsolute(source))
      throw new TypeError('Claude settings paths must be absolute');
    let config: unknown | null = null;
    try {
      config = await readConfig(source);
    } catch {
      unreadableSources.push(source);
      continue;
    }
    for (const command of stopCommands(config)) {
      registrations.push({
        source,
        command,
        recognizedObserver: false,
        recognizedMessaging: await recognizedMessagingLauncher(command),
      });
    }
    if (config && typeof config === 'object' && !Array.isArray(config)) {
      const plugins = (config as { enabledPlugins?: unknown }).enabledPlugins;
      if (plugins && typeof plugins === 'object' && !Array.isArray(plugins)) {
        for (const [name, enabled] of Object.entries(plugins)) {
          if (enabled === true) enabledPlugins.add(name);
        }
      }
    }
  }
  for (const name of enabledPlugins) {
    const pluginRoot = input.installedPlugins?.[name];
    if (!pluginRoot || !path.isAbsolute(pluginRoot)) {
      unresolvedPlugins.push(name);
      continue;
    }
    const source = path.join(pluginRoot, 'hooks', 'hooks.json');
    let config: unknown | null = null;
    try {
      config = await readConfig(source);
    } catch {
      unreadableSources.push(source);
      continue;
    }
    for (const command of stopCommands(config)) {
      registrations.push({
        source,
        command,
        recognizedObserver: false,
        recognizedMessaging: await recognizedMessagingLauncher(command),
      });
    }
  }
  return {
    runtime: 'claude-code',
    registrations,
    fingerprint: fingerprint(registrations),
    unreadableSources,
    unresolvedPlugins,
    visibilityLimits: [
      'session-scoped skill and agent frontmatter hooks are not enumerable from loaded settings files',
    ],
  };
}

interface ObserverLease {
  schemaVersion: number;
  runtime: string;
  ownerSession: string;
  ownerCwd: string;
  state: string;
  continuationCount: number;
  continuationCap: number;
  loopCount: number;
  loopCap: number;
  armedAt: string;
  expiresAt: string;
  leaseMs: number;
}

async function inspectObserverLease(input: {
  root: string;
  pin: Pin;
  worktree: string;
  now?: Date;
}): Promise<'absent' | 'inactive' | 'present' | 'uncertain'> {
  const file = path.join(input.root, 'leases', `${input.pin.sessionId}.json`);
  let info;
  try {
    info = await lstat(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'absent';
    return 'uncertain';
  }
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    (process.getuid && info.uid !== process.getuid()) ||
    info.size > 64 * 1024
  ) {
    return 'uncertain';
  }
  let lease: ObserverLease;
  try {
    lease = JSON.parse(await readFile(file, 'utf8')) as ObserverLease;
  } catch {
    return 'uncertain';
  }
  if (
    lease.schemaVersion !== OBSERVER_LEASE_SCHEMA_VERSION ||
    lease.runtime !== input.pin.runtime ||
    lease.ownerSession !== input.pin.sessionId ||
    lease.ownerCwd !== path.resolve(input.worktree) ||
    !['armed', 'waiting', 'idle', 'triggered', 'disarmed'].includes(
      lease.state,
    ) ||
    !Number.isSafeInteger(lease.continuationCount) ||
    !Number.isSafeInteger(lease.continuationCap) ||
    !Number.isSafeInteger(lease.loopCount) ||
    !Number.isSafeInteger(lease.loopCap) ||
    lease.continuationCount > lease.continuationCap ||
    lease.loopCount > lease.loopCap ||
    Number.isNaN(Date.parse(lease.armedAt)) ||
    Number.isNaN(Date.parse(lease.expiresAt)) ||
    Date.parse(lease.expiresAt) - Date.parse(lease.armedAt) !== lease.leaseMs
  ) {
    return 'uncertain';
  }
  if (lease.state === 'triggered') return 'present';
  if (['idle', 'disarmed'].includes(lease.state)) return 'inactive';
  const now = (input.now ?? new Date()).getTime();
  if (
    now >= Date.parse(lease.expiresAt) ||
    lease.continuationCount >= lease.continuationCap ||
    lease.loopCount >= lease.loopCap
  ) {
    return 'inactive';
  }
  return 'present';
}

export async function assessAutomaticOwnership(input: {
  root: string;
  pin: Pin;
  worktree: string;
  inventory: HookInventory;
  acknowledgedFingerprint?: string | null;
  now?: Date;
}): Promise<OwnershipAssessment> {
  assertPin(input.pin);
  const lease = await inspectObserverLease(input);
  const recoveryCommand = `node <observer-collab-skill>/scripts/collab-control.mjs disarm --session ${input.pin.sessionId}`;
  if (lease === 'present' || lease === 'uncertain') {
    return {
      automaticAllowed: false,
      observerOwner: lease,
      reason:
        lease === 'present'
          ? 'an exact-session observer continuation owner is active or triggered'
          : 'observer ownership cannot be established safely',
      recoveryCommand,
      inventory: input.inventory,
      thirdPartyAcknowledgmentRequired: false,
      acknowledgedFingerprint: null,
    };
  }
  if (
    input.inventory.unreadableSources.length > 0 ||
    input.inventory.unresolvedPlugins.length > 0
  ) {
    return {
      automaticAllowed: false,
      observerOwner: lease,
      reason: 'required hook inventory is unreadable or unresolved',
      recoveryCommand: null,
      inventory: input.inventory,
      thirdPartyAcknowledgmentRequired: false,
      acknowledgedFingerprint: null,
    };
  }
  const thirdParty = input.inventory.registrations.filter(
    (registration) =>
      !registration.recognizedObserver && !registration.recognizedMessaging,
  );
  if (
    thirdParty.length > 0 &&
    input.acknowledgedFingerprint !== input.inventory.fingerprint
  ) {
    return {
      automaticAllowed: false,
      observerOwner: lease,
      reason:
        'third-party Stop registrations require exact scoped acknowledgment',
      recoveryCommand: null,
      inventory: input.inventory,
      thirdPartyAcknowledgmentRequired: true,
      acknowledgedFingerprint: null,
    };
  }
  return {
    automaticAllowed: true,
    observerOwner: lease,
    reason:
      'no active observer owner and the bounded hook inventory is accepted',
    recoveryCommand: null,
    inventory: input.inventory,
    thirdPartyAcknowledgmentRequired: thirdParty.length > 0,
    acknowledgedFingerprint:
      thirdParty.length > 0 ? input.inventory.fingerprint : null,
  };
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function codexMessagingCommand(scriptPath: string): string {
  if (!path.isAbsolute(scriptPath))
    throw new TypeError('messaging hook script path must be absolute');
  return `node -- ${shellQuote(path.resolve(scriptPath))}`;
}

async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
  await rename(temporary, file);
}

export async function installCodexMessagingHooks(input: {
  hooksPath: string;
  scriptPath: string;
}): Promise<{ changed: boolean; exactCommand: string }> {
  if (!path.isAbsolute(input.hooksPath))
    throw new TypeError('Codex hooks path must be absolute');
  const config = ((await readConfig(input.hooksPath)) ?? {}) as Record<
    string,
    unknown
  >;
  const hooks =
    config.hooks &&
    typeof config.hooks === 'object' &&
    !Array.isArray(config.hooks)
      ? (structuredClone(config.hooks) as Record<string, unknown>)
      : {};
  const command = codexMessagingCommand(input.scriptPath);
  let changed = false;
  for (const event of ['UserPromptSubmit', 'Stop']) {
    const groups = Array.isArray(hooks[event])
      ? structuredClone(hooks[event])
      : [];
    const exists = stopCommands({ hooks: { Stop: groups } }).includes(command);
    if (!exists) {
      groups.push({ hooks: [{ type: 'command', command, timeout: 65 }] });
      hooks[event] = groups;
      changed = true;
    }
  }
  if (changed) await writeJsonAtomic(input.hooksPath, { ...config, hooks });
  return { changed, exactCommand: command };
}

export async function uninstallCodexMessagingHooks(input: {
  hooksPath: string;
  scriptPath: string;
}): Promise<{ changed: boolean }> {
  if (!path.isAbsolute(input.hooksPath))
    throw new TypeError('Codex hooks path must be absolute');
  const config = await readConfig(input.hooksPath);
  if (!config || typeof config !== 'object' || Array.isArray(config))
    return { changed: false };
  const next = structuredClone(config) as Record<string, unknown>;
  const hooks = next.hooks as Record<string, unknown> | undefined;
  if (!hooks) return { changed: false };
  const command = codexMessagingCommand(input.scriptPath);
  let changed = false;
  for (const event of ['UserPromptSubmit', 'Stop']) {
    const groups = Array.isArray(hooks[event])
      ? (hooks[event] as unknown[])
      : [];
    hooks[event] = groups
      .map((group) => {
        if (!group || typeof group !== 'object' || Array.isArray(group))
          return group;
        const entries = Array.isArray((group as { hooks?: unknown }).hooks)
          ? ((group as { hooks: unknown[] }).hooks ?? [])
          : [];
        const filtered = entries.filter(
          (entry) =>
            !entry ||
            typeof entry !== 'object' ||
            Array.isArray(entry) ||
            (entry as { command?: unknown }).command !== command,
        );
        if (filtered.length !== entries.length) changed = true;
        return { ...group, hooks: filtered };
      })
      .filter(
        (group) =>
          !group ||
          typeof group !== 'object' ||
          Array.isArray(group) ||
          ((group as { hooks?: unknown[] }).hooks?.length ?? 0) > 0,
      );
  }
  if (changed) await writeJsonAtomic(input.hooksPath, next);
  return { changed };
}

export function claudeSessionHookDeclaration(scriptPath: string): object {
  const command = codexMessagingCommand(scriptPath);
  return {
    hooks: {
      UserPromptSubmit: [
        { hooks: [{ type: 'command', command, timeout: 65 }] },
      ],
      Stop: [{ hooks: [{ type: 'command', command, timeout: 65 }] }],
    },
  };
}
