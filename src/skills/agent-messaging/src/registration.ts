import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalJson } from '../../../shared/collaboration/records.js';
import {
  assertPin,
  type DeliveryController,
  type Pin,
} from '../../../shared/collaboration/types.js';

export const OBSERVER_LEASE_SCHEMA_VERSION = 6;
export const OBSERVER_LAUNCHER_OWNER = 'session-observer-collab-codex-stop';
export const OBSERVER_BUNDLE_MANIFEST = '.session-observer-collab-bundle.json';
export const OBSERVER_BUNDLE_FILES = [
  'session-observer-collab/scripts/hooks/codex-stop.mjs',
] as const;
export const OBSERVER_COMPOSITION_CAPABILITY =
  'agent-messaging-stop-composition';
export const OBSERVER_COMPOSITION_CAPABILITY_VERSION = 1;
export const MESSAGING_HOOK_OWNER = 'agent-messaging-host-hook-v1';

export interface StopRegistration {
  source: string;
  command: string;
  configuration: {
    groupIndex: number;
    hookIndex: number;
    group: Record<string, unknown>;
    hook: Record<string, unknown>;
  };
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
  controller: DeliveryController | null;
  reason: string;
  recoveryCommand: string | null;
  inventory: HookInventory;
  thirdPartyAcknowledgmentRequired: boolean;
  acknowledgedFingerprint: string | null;
  composedMonitorLeaseId: string | null;
  composedMonitorPeer: Pin | null;
}

function fingerprint(registrations: StopRegistration[]): string {
  return createHash('sha256')
    .update(
      canonicalJson(
        registrations
          .map(({ source, configuration }) => ({ source, configuration }))
          .toSorted(
            (left, right) =>
              left.source.localeCompare(right.source) ||
              canonicalJson(left.configuration).localeCompare(
                canonicalJson(right.configuration),
              ),
          ),
      ),
    )
    .digest('hex');
}

function stopRegistrations(
  value: unknown,
  source: string,
): Array<Pick<StopRegistration, 'source' | 'command' | 'configuration'>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const hooks = (value as { hooks?: unknown }).hooks;
  if (!hooks || typeof hooks !== 'object' || Array.isArray(hooks)) return [];
  const groups = (hooks as { Stop?: unknown }).Stop;
  if (!Array.isArray(groups)) return [];
  const registrations: Array<
    Pick<StopRegistration, 'source' | 'command' | 'configuration'>
  > = [];
  for (const [groupIndex, group] of groups.entries()) {
    if (!group || typeof group !== 'object' || Array.isArray(group)) continue;
    const entries = (group as { hooks?: unknown }).hooks;
    if (!Array.isArray(entries)) continue;
    for (const [hookIndex, entry] of entries.entries()) {
      if (
        entry &&
        typeof entry === 'object' &&
        !Array.isArray(entry) &&
        typeof (entry as { command?: unknown }).command === 'string'
      ) {
        const groupRecord = group as Record<string, unknown>;
        const { hooks: _hooks, ...groupConfiguration } = groupRecord;
        registrations.push({
          source: path.resolve(source),
          command: (entry as { command: string }).command,
          configuration: {
            groupIndex,
            hookIndex,
            group: groupConfiguration,
            hook: structuredClone(entry as Record<string, unknown>),
          },
        });
      }
    }
  }
  return registrations;
}

function stopCommands(value: unknown): string[] {
  return stopRegistrations(value, '/inventory').map(
    (registration) => registration.command,
  );
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
    JSON.stringify(manifest.files) !== JSON.stringify(OBSERVER_BUNDLE_FILES) ||
    !manifest.capabilities ||
    typeof manifest.capabilities !== 'object' ||
    Array.isArray(manifest.capabilities) ||
    (manifest.capabilities as Record<string, unknown>)[
      OBSERVER_COMPOSITION_CAPABILITY
    ] !== OBSERVER_COMPOSITION_CAPABILITY_VERSION ||
    typeof manifest.contentDigest !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(manifest.contentDigest) ||
    manifest.contentDigest.slice(0, 24) !== marker[1]
  ) {
    return false;
  }
  const hash = createHash('sha256');
  hash.update(OBSERVER_COMPOSITION_CAPABILITY);
  hash.update('\0');
  hash.update(String(OBSERVER_COMPOSITION_CAPABILITY_VERSION));
  hash.update('\0');
  try {
    for (const file of OBSERVER_BUNDLE_FILES) {
      const installed = path.join(supportRoot, file);
      const info = await lstat(installed);
      if (!info.isFile() || info.isSymbolicLink()) return false;
      hash.update(file);
      hash.update('\0');
      hash.update(await readFile(installed));
      hash.update('\0');
    }
  } catch {
    return false;
  }
  return hash.digest('hex') === manifest.contentDigest;
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
  for (const registration of stopRegistrations(config, hooksPath)) {
    const { command } = registration;
    registrations.push({
      ...registration,
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
    for (const registration of stopRegistrations(config, source)) {
      const { command } = registration;
      registrations.push({
        ...registration,
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
    for (const registration of stopRegistrations(config, source)) {
      const { command } = registration;
      registrations.push({
        ...registration,
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
  leaseId: string;
  runtime: string;
  peerRuntime: string;
  ownerSession: string;
  ownerCwd: string;
  peerSession: string;
  peerTranscript: string;
  peerCanonicalTranscriptPath: string;
  peerIndexBase: string;
  peerCursor: number;
  peerContinuity: unknown;
  state: string;
  continuationCount: number;
  continuationCap: number;
  loopCount: number;
  loopCap: number;
  armedAt: string;
  expiresAt: string;
  updatedAt: string;
  leaseMs: number;
  waitMs: number;
  waitStartedAt: string | null;
  waitDeadlineAt: string | null;
  waitToken: string | null;
  waitPid: number | null;
  diagnostic: string | null;
  composedActivation?: {
    collaborationId: string;
    activationId: string;
    controller: 'observer-collab';
    mechanism: 'monitor';
    ownerRuntime: 'claude-code';
    ownerSession: string;
    peerRuntime: string;
    peerSession: string;
    ownerCwd: string;
    peerTranscript: string;
    confirmedAt: string;
    oldMonitorStopped: true;
    standaloneWatcherStopped: true;
  } | null;
}

const SAFE_LEASE_ID = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,127})$/u;
function validLeaseId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    SAFE_LEASE_ID.test(value) &&
    value !== '.' &&
    value !== '..'
  );
}
function validInteger(value: unknown, minimum: number, maximum: number) {
  return (
    Number.isSafeInteger(value) &&
    (value as number) >= minimum &&
    (value as number) <= maximum
  );
}
function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
function validateObserverLease(raw: unknown): ObserverLease {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new TypeError('observer lease must be an object');
  const lease = raw as ObserverLease;
  if (
    lease.schemaVersion !== OBSERVER_LEASE_SCHEMA_VERSION ||
    !validLeaseId(lease.leaseId) ||
    !['claude-code', 'codex', 'cursor'].includes(lease.runtime) ||
    !['claude-code', 'codex', 'cursor'].includes(lease.peerRuntime) ||
    !validLeaseId(lease.ownerSession) ||
    !validLeaseId(lease.peerSession) ||
    typeof lease.ownerCwd !== 'string' ||
    !path.isAbsolute(lease.ownerCwd) ||
    lease.ownerCwd.includes('\0') ||
    typeof lease.peerTranscript !== 'string' ||
    !path.isAbsolute(lease.peerTranscript) ||
    lease.peerTranscript.includes('\0') ||
    typeof lease.peerCanonicalTranscriptPath !== 'string' ||
    !path.isAbsolute(lease.peerCanonicalTranscriptPath) ||
    lease.peerCanonicalTranscriptPath.includes('\0') ||
    path.resolve(lease.peerTranscript) !==
      path.resolve(lease.peerCanonicalTranscriptPath) ||
    lease.peerIndexBase !==
      (lease.peerRuntime === 'cursor'
        ? 'zero-based-jsonl-frame-index'
        : 'zero-based-jsonl-record-index') ||
    !['armed', 'waiting', 'idle', 'triggered', 'disarmed'].includes(
      lease.state,
    ) ||
    !validTimestamp(lease.armedAt) ||
    !validTimestamp(lease.expiresAt) ||
    !validTimestamp(lease.updatedAt) ||
    !validInteger(lease.waitMs, 0, 60_000) ||
    !validInteger(lease.leaseMs, 1, 24 * 60 * 60 * 1000) ||
    !validInteger(lease.peerCursor, 0, Number.MAX_SAFE_INTEGER) ||
    !validInteger(lease.continuationCount, 0, 100) ||
    !validInteger(lease.continuationCap, 1, 100) ||
    !validInteger(lease.loopCount, 0, 1000) ||
    !validInteger(lease.loopCap, 1, 1000) ||
    lease.continuationCount > lease.continuationCap ||
    lease.loopCount > lease.loopCap ||
    (lease.diagnostic !== null && typeof lease.diagnostic !== 'string')
  )
    throw new TypeError('observer lease schema is invalid');
  const timingBothNull =
    lease.waitStartedAt === null && lease.waitDeadlineAt === null;
  const timingBothValid =
    validTimestamp(lease.waitStartedAt) && validTimestamp(lease.waitDeadlineAt);
  const waiterBothNull = lease.waitToken === null && lease.waitPid === null;
  const waiterBothValid =
    validLeaseId(lease.waitToken) &&
    validInteger(lease.waitPid, 1, Number.MAX_SAFE_INTEGER);
  if (
    (!timingBothNull && !timingBothValid) ||
    (!waiterBothNull && !waiterBothValid) ||
    (lease.state !== 'waiting' && (!timingBothNull || !waiterBothNull))
  )
    throw new TypeError('observer wait state is invalid');
  if (timingBothValid) {
    const started = Date.parse(lease.waitStartedAt!);
    const deadline = Date.parse(lease.waitDeadlineAt!);
    if (
      deadline < started ||
      deadline - started > lease.waitMs ||
      deadline > Date.parse(lease.expiresAt)
    )
      throw new TypeError('observer wait deadline is invalid');
  }
  if (
    Date.parse(lease.expiresAt) < Date.parse(lease.armedAt) ||
    Date.parse(lease.expiresAt) - Date.parse(lease.armedAt) !== lease.leaseMs
  )
    throw new TypeError('observer lease duration is invalid');
  if (lease.peerRuntime === 'cursor') {
    const checkpoint = lease.peerContinuity as Record<string, unknown> | null;
    if (
      !checkpoint ||
      checkpoint.indexBase !== 'zero-based-jsonl-frame-index' ||
      !validInteger(checkpoint.nextFrameIndex, 0, Number.MAX_SAFE_INTEGER) ||
      !validInteger(checkpoint.prefixBytes, 0, Number.MAX_SAFE_INTEGER) ||
      !validInteger(checkpoint.observedSize, 0, Number.MAX_SAFE_INTEGER) ||
      checkpoint.nextFrameIndex !== lease.peerCursor ||
      (checkpoint.prefixBytes as number) >
        (checkpoint.observedSize as number) ||
      typeof checkpoint.prefixSha256 !== 'string' ||
      !/^[a-f0-9]{64}$/u.test(checkpoint.prefixSha256) ||
      ![checkpoint.device, checkpoint.inode].every(
        (value) =>
          value === null || validInteger(value, 0, Number.MAX_SAFE_INTEGER),
      )
    )
      throw new TypeError('observer cursor continuity is invalid');
  } else if (lease.peerContinuity !== null) {
    throw new TypeError('observer record continuity is invalid');
  }
  if (lease.runtime === 'claude-code') {
    const composed = lease.composedActivation;
    if (
      !composed ||
      composed.controller !== 'observer-collab' ||
      composed.mechanism !== 'monitor' ||
      composed.ownerRuntime !== lease.runtime ||
      composed.ownerSession !== lease.ownerSession ||
      composed.peerRuntime !== lease.peerRuntime ||
      composed.peerSession !== lease.peerSession ||
      composed.ownerCwd !== lease.ownerCwd ||
      composed.peerTranscript !== lease.peerTranscript ||
      composed.oldMonitorStopped !== true ||
      composed.standaloneWatcherStopped !== true ||
      !validTimestamp(composed.confirmedAt)
    )
      throw new TypeError('Claude composed Monitor lease is invalid');
  }
  return lease;
}

async function inspectObserverLease(input: {
  root: string;
  pin: Pin;
  worktree: string;
  now?: Date;
}): Promise<{
  state: 'absent' | 'inactive' | 'present' | 'uncertain';
  lease: ObserverLease | null;
}> {
  const file = path.join(input.root, 'leases', `${input.pin.sessionId}.json`);
  let info;
  try {
    info = await lstat(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return { state: 'absent', lease: null };
    return { state: 'uncertain', lease: null };
  }
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    (process.getuid && info.uid !== process.getuid()) ||
    info.size > 64 * 1024
  ) {
    return { state: 'uncertain', lease: null };
  }
  let lease: ObserverLease;
  try {
    lease = validateObserverLease(JSON.parse(await readFile(file, 'utf8')));
  } catch {
    return { state: 'uncertain', lease: null };
  }
  if (
    lease.runtime !== input.pin.runtime ||
    lease.ownerSession !== input.pin.sessionId ||
    path.resolve(lease.ownerCwd) !== path.resolve(input.worktree)
  ) {
    return { state: 'uncertain', lease };
  }
  if (lease.state === 'triggered') return { state: 'present', lease };
  if (['idle', 'disarmed'].includes(lease.state))
    return { state: 'inactive', lease };
  const now = (input.now ?? new Date()).getTime();
  if (
    now >= Date.parse(lease.expiresAt) ||
    lease.continuationCount >= lease.continuationCap ||
    lease.loopCount >= lease.loopCap ||
    (lease.state === 'waiting' &&
      (lease.waitDeadlineAt === null ||
        now >= Date.parse(lease.waitDeadlineAt)))
  ) {
    return { state: 'inactive', lease };
  }
  return { state: 'present', lease };
}

export async function assessAutomaticOwnership(input: {
  root: string;
  pin: Pin;
  worktree: string;
  inventory: HookInventory;
  acknowledgedFingerprint?: string | null;
  requestedController?: DeliveryController | null;
  requestedActivationId?: string | null;
  requestedCollaborationId?: string | null;
  now?: Date;
}): Promise<OwnershipAssessment> {
  assertPin(input.pin);
  const inspectedLease = await inspectObserverLease(input);
  const lease = inspectedLease.state;
  const observerLease = inspectedLease.lease;
  const recoveryCommand = `node <observer-collab-skill>/scripts/collab-control.mjs disarm --session ${input.pin.sessionId}`;
  if (lease === 'uncertain') {
    return {
      automaticAllowed: false,
      observerOwner: lease,
      controller: null,
      reason: 'observer ownership cannot be established safely',
      recoveryCommand,
      inventory: input.inventory,
      thirdPartyAcknowledgmentRequired: false,
      acknowledgedFingerprint: null,
      composedMonitorLeaseId: null,
      composedMonitorPeer: null,
    };
  }
  if (
    input.inventory.unreadableSources.length > 0 ||
    input.inventory.unresolvedPlugins.length > 0
  ) {
    return {
      automaticAllowed: false,
      observerOwner: lease,
      controller: null,
      reason: 'required hook inventory is unreadable or unresolved',
      recoveryCommand: null,
      inventory: input.inventory,
      thirdPartyAcknowledgmentRequired: false,
      acknowledgedFingerprint: null,
      composedMonitorLeaseId: null,
      composedMonitorPeer: null,
    };
  }
  const recognizedObserver = input.inventory.registrations.some(
    (registration) => registration.recognizedObserver,
  );
  const recognizedMessaging = input.inventory.registrations.some(
    (registration) => registration.recognizedMessaging,
  );
  let controller: DeliveryController;
  if (lease === 'present') {
    if (input.requestedController === 'standalone-messaging') {
      return {
        automaticAllowed: false,
        observerOwner: lease,
        controller: null,
        reason:
          'an exact-session observer continuation owner is active or triggered',
        recoveryCommand,
        inventory: input.inventory,
        thirdPartyAcknowledgmentRequired: false,
        acknowledgedFingerprint: null,
        composedMonitorLeaseId: null,
        composedMonitorPeer: null,
      };
    }
    if (input.pin.runtime === 'claude-code') {
      const composed = observerLease?.composedActivation;
      if (
        !composed ||
        composed.activationId !== input.requestedActivationId ||
        composed.collaborationId !== input.requestedCollaborationId
      ) {
        return {
          automaticAllowed: false,
          observerOwner: lease,
          controller: null,
          reason:
            'Claude composed delivery requires the exact verified composed Monitor activation',
          recoveryCommand: null,
          inventory: input.inventory,
          thirdPartyAcknowledgmentRequired: false,
          acknowledgedFingerprint: null,
          composedMonitorLeaseId: null,
          composedMonitorPeer: null,
        };
      }
    }
    if (input.pin.runtime !== 'claude-code' && !recognizedObserver) {
      return {
        automaticAllowed: false,
        observerOwner: lease,
        controller: null,
        reason:
          'the active observer lease has no verified composed-capable adapter',
        recoveryCommand,
        inventory: input.inventory,
        thirdPartyAcknowledgmentRequired: false,
        acknowledgedFingerprint: null,
        composedMonitorLeaseId: null,
        composedMonitorPeer: null,
      };
    }
    if (recognizedMessaging) {
      return {
        automaticAllowed: false,
        observerOwner: lease,
        controller: null,
        reason:
          'standalone messaging and observer Stop registrations both exist; remove the standalone route before composition',
        recoveryCommand: null,
        inventory: input.inventory,
        thirdPartyAcknowledgmentRequired: false,
        acknowledgedFingerprint: null,
        composedMonitorLeaseId: null,
        composedMonitorPeer: null,
      };
    }
    controller = 'observer-collab';
  } else {
    if (input.requestedController === 'observer-collab') {
      return {
        automaticAllowed: false,
        observerOwner: lease,
        controller: null,
        reason:
          input.pin.runtime === 'claude-code'
            ? 'composed-monitor-inactive: Claude observer delivery requires an exact active dedicated composed Monitor'
            : 'observer-collab requires an active exact-session lease and verified composed-capable adapter',
        recoveryCommand: null,
        inventory: input.inventory,
        thirdPartyAcknowledgmentRequired: false,
        acknowledgedFingerprint: null,
        composedMonitorLeaseId: null,
        composedMonitorPeer: null,
      };
    }
    controller = 'standalone-messaging';
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
      controller: null,
      reason:
        'third-party Stop registrations require exact scoped acknowledgment',
      recoveryCommand: null,
      inventory: input.inventory,
      thirdPartyAcknowledgmentRequired: true,
      acknowledgedFingerprint: null,
      composedMonitorLeaseId: null,
      composedMonitorPeer: null,
    };
  }
  return {
    automaticAllowed: true,
    observerOwner: lease,
    controller,
    reason:
      controller === 'observer-collab'
        ? 'the exact-session observer lease and verified composed adapter own the single bounded route'
        : 'no active observer owner and the bounded hook inventory is accepted',
    recoveryCommand: null,
    inventory: input.inventory,
    thirdPartyAcknowledgmentRequired: thirdParty.length > 0,
    acknowledgedFingerprint:
      thirdParty.length > 0 ? input.inventory.fingerprint : null,
    composedMonitorLeaseId:
      input.pin.runtime === 'claude-code' && controller === 'observer-collab'
        ? (observerLease?.leaseId ?? null)
        : null,
    composedMonitorPeer:
      input.pin.runtime === 'claude-code' && controller === 'observer-collab'
        ? ({
            runtime: observerLease!.peerRuntime,
            sessionId: observerLease!.peerSession,
          } as Pin)
        : null,
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
