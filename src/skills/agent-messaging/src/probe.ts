import { cpus, platform, arch } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

import {
  activationStatus,
  MAX_ACTIVITY_RECEIPTS,
} from '../../../shared/collaboration/activation.js';
import { activationDirectory } from '../../../shared/collaboration/paths.js';
import { enumerateJsonRecords } from '../../../shared/collaboration/records.js';
import {
  assertBoundedString,
  assertPin,
  assertUuid,
  type Pin,
} from '../../../shared/collaboration/types.js';

export type ProbeHost = 'codex' | 'claude-code' | 'cursor';
export type ProbeBoundary =
  | 'prompt-start'
  | 'stop-continuation'
  | 'idle-notification'
  | 'human-renewal';

export interface LiveAuthorization {
  exactSessionApproved: boolean;
  hookAndTrustChangesApproved: boolean;
  quotaBudgetApproved: boolean;
  timeoutApproved: boolean;
  cleanupApproved: boolean;
}

export interface HostProbePlan {
  schemaVersion: 1;
  id: string;
  collaborationId: string;
  host: ProbeHost;
  hostVersion: string;
  surface: string;
  command: string[];
  boundary: ProbeBoundary;
  session: Pin;
  worktree: string;
  eventProvenance: string;
  timeoutMs: number;
  maxEvents: number;
  maxAttempts: number;
  authorizationComplete: boolean;
  execution: 'fixture-only' | 'live-authorized';
  capability: 'manual-fallback' | 'probe-candidate';
  ownershipPreflightRequired: true;
}

export interface SanitizedProbeReceipt {
  probeId: string;
  collaborationId: string;
  host: ProbeHost;
  hostVersion: string;
  boundary: ProbeBoundary;
  eventId: string;
  eventProvenance: string;
  observedAt: string;
  invoked: boolean;
  recipientContextObserved: boolean;
  continuationObserved: boolean;
  humanOriginObserved: boolean;
  outcome: 'observed' | 'unsupported' | 'unknown';
  errorCode: 'timeout' | 'interrupted' | 'unsupported' | 'fixture-error' | null;
}

export interface ProbeOwnedResources {
  registrations: string[];
  processes: string[];
}

export interface ProbeAdapter {
  setup(plan: HostProbePlan): Promise<ProbeOwnedResources>;
  invoke(input: {
    plan: HostProbePlan;
    attempt: number;
    event: number;
  }): Promise<{
    eventId: string;
    observedAt: string;
    invoked: boolean;
    recipientContextObserved: boolean;
    continuationObserved: boolean;
    humanOriginObserved: boolean;
    unsupported?: boolean;
  }>;
  cleanup(resources: ProbeOwnedResources): Promise<void>;
}

function integerInRange(
  value: number,
  label: string,
  minimum: number,
  maximum: number,
): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum)
    throw new TypeError(`${label} must be from ${minimum} through ${maximum}`);
}

export function createHostProbePlan(input: {
  optIn: boolean;
  id: string;
  collaborationId: string;
  host: ProbeHost;
  hostVersion: string;
  surface: string;
  command: string[];
  boundary: ProbeBoundary;
  session: Pin;
  worktree: string;
  eventProvenance: string;
  timeoutMs: number;
  maxEvents?: number;
  maxAttempts?: number;
  liveAuthorization?: LiveAuthorization | null;
}): HostProbePlan {
  if (!input.optIn)
    throw new TypeError('probe creation requires explicit opt-in');
  if (!['codex', 'claude-code', 'cursor'].includes(input.host))
    throw new TypeError('probe host is unsupported');
  if (
    ![
      'prompt-start',
      'stop-continuation',
      'idle-notification',
      'human-renewal',
    ].includes(input.boundary)
  )
    throw new TypeError('probe boundary is unsupported');
  assertBoundedString(input.id, 'probe ID', 128);
  assertUuid(input.collaborationId, 'probe collaboration ID');
  assertPin(input.session);
  if (input.session.runtime !== input.host)
    throw new TypeError('probe host must match the exact session runtime');
  assertBoundedString(input.hostVersion, 'host version', 128);
  assertBoundedString(input.surface, 'host surface', 256);
  assertBoundedString(input.eventProvenance, 'event provenance', 256);
  if (!path.isAbsolute(input.worktree))
    throw new TypeError('probe worktree must be absolute');
  if (input.command.length === 0 || input.command.length > 16)
    throw new TypeError('probe command must contain 1 through 16 arguments');
  for (const argument of input.command)
    assertBoundedString(argument, 'probe command argument', 1024, true);
  integerInRange(input.timeoutMs, 'probe timeout milliseconds', 1, 60_000);
  const maxEvents = input.maxEvents ?? 1;
  const maxAttempts = input.maxAttempts ?? 1;
  integerInRange(maxEvents, 'probe event budget', 1, 4);
  integerInRange(maxAttempts, 'probe attempt budget', 1, 2);
  if (input.host === 'cursor' && maxAttempts > 2)
    throw new TypeError(
      'Cursor probes allow one initial attempt and one retry',
    );
  const authorizationComplete = Boolean(
    input.liveAuthorization &&
    Object.values(input.liveAuthorization).every((value) => value === true),
  );
  return {
    schemaVersion: 1,
    id: input.id,
    collaborationId: input.collaborationId,
    host: input.host,
    hostVersion: input.hostVersion,
    surface: input.surface,
    command: [...input.command],
    boundary: input.boundary,
    session: input.session,
    worktree: path.resolve(input.worktree),
    eventProvenance: input.eventProvenance,
    timeoutMs: input.timeoutMs,
    maxEvents,
    maxAttempts,
    authorizationComplete,
    execution: authorizationComplete ? 'live-authorized' : 'fixture-only',
    capability:
      input.host === 'cursor' || !authorizationComplete
        ? 'manual-fallback'
        : 'probe-candidate',
    ownershipPreflightRequired: true,
  };
}

function unknownReceipt(
  plan: HostProbePlan,
  eventId: string,
  errorCode: SanitizedProbeReceipt['errorCode'],
): SanitizedProbeReceipt {
  return {
    probeId: plan.id,
    collaborationId: plan.collaborationId,
    host: plan.host,
    hostVersion: plan.hostVersion,
    boundary: plan.boundary,
    eventId,
    eventProvenance: plan.eventProvenance,
    observedAt: new Date().toISOString(),
    invoked: false,
    recipientContextObserved: false,
    continuationObserved: false,
    humanOriginObserved: false,
    outcome: errorCode === 'unsupported' ? 'unsupported' : 'unknown',
    errorCode,
  };
}

function validateOwnedResources(resources: ProbeOwnedResources): void {
  if (resources.registrations.length > 16 || resources.processes.length > 16)
    throw new TypeError('probe owned-resource list exceeds 16 entries');
  for (const value of [...resources.registrations, ...resources.processes])
    assertBoundedString(value, 'probe owned resource', 512);
}

async function withTimeout<T>(
  operation: Promise<T>,
  milliseconds: number,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('PROBE_TIMEOUT')),
          milliseconds,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function runHostProbe(
  plan: HostProbePlan,
  adapter: ProbeAdapter,
  options: {
    signal?: AbortSignal;
    ownershipCheck?: (plan: HostProbePlan) => Promise<boolean>;
  } = {},
): Promise<{
  status: 'completed' | 'unverified' | 'interrupted' | 'unknown';
  receipts: SanitizedProbeReceipt[];
  cleanupVerified: boolean;
}> {
  if (!plan.authorizationComplete)
    return { status: 'unverified', receipts: [], cleanupVerified: false };
  if (!options.ownershipCheck)
    return { status: 'unverified', receipts: [], cleanupVerified: false };
  const ownershipAllowed = await withTimeout(
    options.ownershipCheck(plan),
    plan.timeoutMs,
  ).catch(() => false);
  if (!ownershipAllowed)
    return { status: 'unverified', receipts: [], cleanupVerified: false };
  let owned: ProbeOwnedResources = { registrations: [], processes: [] };
  let cleanupVerified = false;
  const receipts: SanitizedProbeReceipt[] = [];
  let status: 'completed' | 'interrupted' | 'unknown' = 'completed';
  let stop = false;
  try {
    const prepared = await withTimeout(adapter.setup(plan), plan.timeoutMs);
    validateOwnedResources(prepared);
    owned = {
      registrations: [...prepared.registrations],
      processes: [...prepared.processes],
    };
    for (let attempt = 1; attempt <= plan.maxAttempts; attempt += 1) {
      for (let event = 1; event <= plan.maxEvents; event += 1) {
        if (options.signal?.aborted) {
          status = 'interrupted';
          receipts.push(unknownReceipt(plan, `event-${event}`, 'interrupted'));
          stop = true;
          break;
        }
        try {
          const raw = await withTimeout(
            adapter.invoke({ plan, attempt, event }),
            plan.timeoutMs,
          );
          assertBoundedString(raw.eventId, 'probe event ID', 128);
          if (Number.isNaN(Date.parse(raw.observedAt)))
            throw new TypeError('probe receipt timestamp is invalid');
          receipts.push({
            probeId: plan.id,
            collaborationId: plan.collaborationId,
            host: plan.host,
            hostVersion: plan.hostVersion,
            boundary: plan.boundary,
            eventId: raw.eventId,
            eventProvenance: plan.eventProvenance,
            observedAt: raw.observedAt,
            invoked: raw.invoked,
            recipientContextObserved: raw.recipientContextObserved,
            continuationObserved: raw.continuationObserved,
            humanOriginObserved: raw.humanOriginObserved,
            outcome: raw.unsupported
              ? 'unsupported'
              : raw.invoked
                ? 'observed'
                : 'unknown',
            errorCode: raw.unsupported ? 'unsupported' : null,
          });
        } catch (error) {
          status = 'unknown';
          receipts.push(
            unknownReceipt(
              plan,
              `event-${event}`,
              error instanceof Error && error.message === 'PROBE_TIMEOUT'
                ? 'timeout'
                : 'fixture-error',
            ),
          );
          stop = true;
          break;
        }
      }
      if (stop || receipts.every((receipt) => receipt.outcome === 'observed'))
        break;
    }
  } catch (error) {
    status = 'unknown';
    receipts.push(
      unknownReceipt(
        plan,
        'setup',
        error instanceof Error && error.message === 'PROBE_TIMEOUT'
          ? 'timeout'
          : 'fixture-error',
      ),
    );
  } finally {
    try {
      await withTimeout(
        adapter.cleanup({
          registrations: [...owned.registrations],
          processes: [...owned.processes],
        }),
        plan.timeoutMs,
      );
      cleanupVerified = true;
    } catch {
      cleanupVerified = false;
    }
  }
  return { status, receipts, cleanupVerified };
}

export async function benchmarkActivityReceiptValidation(input: {
  root: string;
  pin: Pin;
  now?: Date;
}): Promise<{
  receiptCount: 4096;
  coldMs: number;
  warmMs: number;
  machine: {
    platform: string;
    arch: string;
    cpu: string;
    node: string;
  };
}> {
  const initial = await activationStatus(input.root, input.pin, input.now);
  if (!initial.activation)
    throw new TypeError('receipt benchmark requires an activation');
  const files = await enumerateJsonRecords(
    path.join(
      activationDirectory(input.root, input.pin),
      'activity',
      initial.activation.id,
    ),
    { root: input.root, maxEntries: MAX_ACTIVITY_RECEIPTS },
  );
  if (files.length !== MAX_ACTIVITY_RECEIPTS)
    throw new TypeError('receipt benchmark requires exactly 4096 receipts');
  const coldStarted = performance.now();
  await activationStatus(input.root, input.pin, input.now);
  const coldMs = performance.now() - coldStarted;
  const warmStarted = performance.now();
  await activationStatus(input.root, input.pin, input.now);
  const warmMs = performance.now() - warmStarted;
  return {
    receiptCount: 4096,
    coldMs,
    warmMs,
    machine: {
      platform: platform(),
      arch: arch(),
      cpu: cpus()[0]?.model ?? 'unknown',
      node: process.version,
    },
  };
}
