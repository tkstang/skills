import path from 'node:path';

import {
  activationStatus,
  DeliveryError,
} from '../../../shared/collaboration/activation.js';
import {
  claimDelivery,
  deliveryClaimStatus,
  watchBatchEventKey,
  type DeliveryKey,
} from '../../../shared/collaboration/claims.js';
import { publishDeliveryDiagnostic } from '../../../shared/collaboration/diagnostics.js';
import { listInbox } from '../../../shared/collaboration/messages.js';
import { collaborationPaths } from '../../../shared/collaboration/paths.js';
import {
  enumerateJsonRecords,
  readJsonRecord,
} from '../../../shared/collaboration/records.js';
import type {
  InboxMessage,
  Pin,
  RetryRecord,
} from '../../../shared/collaboration/types.js';
import {
  assessAutomaticOwnership,
  inspectClaudeStopInventory,
  inspectCodexStopInventory,
} from './registration.js';

export const MAX_WATCH_DURATION_MS = 30 * 60 * 1000;
export const DEFAULT_WATCH_POLL_MS = 1000;

export interface WatchNotification {
  type: 'agent-messaging-request-notification';
  collaborationId: string;
  activationId: string;
  eventKey: string;
  untrusted: true;
  requests: Array<{
    id: string;
    from: string;
    priority: 'normal' | 'high';
    subject: string;
  }>;
}

export interface WatchInput {
  root: string;
  collaborationId: string;
  pin: Pin;
  worktree: string;
  durationMs: number;
  pollMs?: number;
  confirmNoObserverMonitor?: boolean;
  env?: NodeJS.ProcessEnv;
}

export interface WatchDependencies {
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  emit: (notification: WatchNotification) => void | Promise<void>;
  signal?: AbortSignal;
  afterEventClaim?: () => void | Promise<void>;
}

export interface WatchResult {
  reason:
    | 'duration-complete'
    | 'activation-inactive'
    | 'budget-exhausted'
    | 'interrupted'
    | 'ownership-refused';
  notifications: number;
  claimedRequests: number;
  iterations: number;
}

function validateTiming(durationMs: number, pollMs: number): void {
  if (
    !Number.isSafeInteger(durationMs) ||
    durationMs <= 0 ||
    durationMs > MAX_WATCH_DURATION_MS
  ) {
    throw new TypeError('watch duration must be from 1ms through 30 minutes');
  }
  if (!Number.isSafeInteger(pollMs) || pollMs <= 0 || pollMs > 60_000) {
    throw new TypeError('watch poll interval must be from 1ms through 60s');
  }
}

async function inventoryFor(input: WatchInput) {
  const env = input.env ?? process.env;
  if (input.pin.runtime === 'codex') {
    return inspectCodexStopInventory(
      env.AGENT_MESSAGING_HOOKS_PATH ??
        path.join(env.HOME ?? input.worktree, '.codex', 'hooks.json'),
    );
  }
  if (input.pin.runtime !== 'claude-code')
    throw new DeliveryError(
      'DELIVERY_INACTIVE',
      'this host has no verified standalone watch boundary',
    );
  const settingsPaths = (env.AGENT_MESSAGING_CLAUDE_SETTINGS ?? '')
    .split(path.delimiter)
    .filter(Boolean);
  const installedPlugins = env.AGENT_MESSAGING_CLAUDE_PLUGINS
    ? (JSON.parse(env.AGENT_MESSAGING_CLAUDE_PLUGINS) as Record<string, string>)
    : {};
  return inspectClaudeStopInventory({ settingsPaths, installedPlugins });
}

async function deliveryKeys(
  input: WatchInput,
  activationId: string,
  participantId: string,
  messages: InboxMessage[],
): Promise<DeliveryKey[]> {
  const files = await enumerateJsonRecords(
    path.join(
      collaborationPaths(input.root, input.collaborationId).directory,
      'retries',
      participantId,
    ),
    { root: input.root, maxEntries: 4096 },
  );
  const generations = new Map<string, number>();
  for (const file of files) {
    const retry = await readJsonRecord<RetryRecord>(file, { root: input.root });
    if (
      retry.activationId !== activationId ||
      retry.participantId !== participantId
    ) {
      continue;
    }
    generations.set(
      retry.messageId,
      Math.max(generations.get(retry.messageId) ?? 0, retry.retryGeneration),
    );
  }
  return messages.map((message) => ({
    messageId: message.id,
    retryGeneration: generations.get(message.id) ?? 0,
  }));
}

async function acceptedOwnership(input: WatchInput, now: Date) {
  const status = await activationStatus(input.root, input.pin, now);
  if (
    !status.active ||
    !status.activation ||
    status.activation.collaborationId !== input.collaborationId ||
    status.activation.worktree !== path.resolve(input.worktree) ||
    status.activation.controller !== 'standalone-messaging' ||
    status.activation.mechanism !== 'monitor'
  ) {
    return { status, allowed: false };
  }
  if (
    input.pin.runtime === 'claude-code' &&
    (!input.confirmNoObserverMonitor ||
      !status.activation.noObserverMonitorAttestation ||
      status.activation.noObserverMonitorAttestation.epoch !==
        status.activation.epoch)
  ) {
    return { status, allowed: false };
  }
  const ownership = await assessAutomaticOwnership({
    root: input.root,
    pin: input.pin,
    worktree: input.worktree,
    inventory: await inventoryFor(input),
    acknowledgedFingerprint:
      status.activation.thirdPartyHookAcknowledgment?.configurationFingerprint,
    now,
  });
  return { status, allowed: ownership.automaticAllowed };
}

export async function watchInbox(
  input: WatchInput,
  dependencies: WatchDependencies,
): Promise<WatchResult> {
  const pollMs = input.pollMs ?? DEFAULT_WATCH_POLL_MS;
  validateTiming(input.durationMs, pollMs);
  if (!path.isAbsolute(input.worktree))
    throw new TypeError('watch worktree must be absolute');
  const currentTime = dependencies.now ?? (() => new Date());
  const sleep =
    dependencies.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const startedAt = currentTime().getTime();
  const requestedDeadline = startedAt + input.durationMs;
  const maximumIterations = Math.ceil(input.durationMs / pollMs) + 1;
  let notifications = 0;
  let claimedRequests = 0;
  let iterations = 0;
  let reason: WatchResult['reason'] = 'duration-complete';

  while (iterations < maximumIterations) {
    if (dependencies.signal?.aborted) {
      reason = 'interrupted';
      break;
    }
    const now = currentTime();
    const ownership = await acceptedOwnership(input, now);
    const activation = ownership.status.activation;
    if (!activation || !ownership.status.active) {
      reason = 'activation-inactive';
      break;
    }
    if (!ownership.allowed) {
      reason = 'ownership-refused';
      break;
    }
    const expiry = Date.parse(ownership.status.effectiveExpiresAt!);
    const deadline = Math.min(requestedDeadline, expiry);
    if (now.getTime() >= deadline) break;
    const claims = await deliveryClaimStatus({
      root: input.root,
      pin: input.pin,
    });
    if (claims.remainingSlots === 0) {
      reason = 'budget-exhausted';
      break;
    }
    iterations += 1;
    const inbox = await listInbox({
      root: input.root,
      collaborationId: input.collaborationId,
      pin: input.pin,
      maxMessages: 4096,
      maxBytes: Number.MAX_SAFE_INTEGER,
    });
    const requests = inbox.messages.filter(
      (message) => message.kind === 'request' && !message.inert,
    );
    if (requests.length > 0) {
      const keys = await deliveryKeys(
        input,
        activation.id,
        activation.participantId,
        requests,
      );
      const eventKey = watchBatchEventKey({
        activationId: activation.id,
        bindingGeneration: activation.bindingGeneration,
        deliveryKeys: keys,
      });
      let finalOwnership = true;
      const claim = await claimDelivery({
        root: input.root,
        pin: input.pin,
        eventKey,
        deliveryKeys: keys,
        now,
        hooks: {
          afterEventClaim: dependencies.afterEventClaim,
          beforeFinalValidation: async () => {
            const final = await acceptedOwnership(input, currentTime());
            finalOwnership =
              final.allowed && final.status.activation?.id === activation.id;
          },
        },
      });
      if (finalOwnership && claim.activeAfterClaim && claim.owned.length > 0) {
        const owned = new Set(claim.owned.map((item) => item.messageId));
        const selected = requests.filter((message) => owned.has(message.id));
        await publishDeliveryDiagnostic({
          root: input.root,
          pin: input.pin,
          diagnostic: {
            attemptId: claim.event.token,
            activationId: activation.id,
            eventKey,
            boundary: 'watch',
            recordedAt: currentTime().toISOString(),
            stage: 'output-attempted',
            outcomeCode: 'watch-notification-attempted',
            errorCode: null,
          },
        }).catch(() => undefined);
        await dependencies.emit({
          type: 'agent-messaging-request-notification',
          collaborationId: input.collaborationId,
          activationId: activation.id,
          eventKey,
          untrusted: true,
          requests: selected.map((message) => ({
            id: message.id,
            from: `${message.from.pin.runtime}:${message.from.pin.sessionId}`,
            priority: message.priority,
            subject: message.subject,
          })),
        });
        notifications += 1;
        claimedRequests += selected.length;
      }
    }
    const remaining = deadline - currentTime().getTime();
    if (remaining <= 0) break;
    await sleep(Math.min(pollMs, remaining));
  }
  return { reason, notifications, claimedRequests, iterations };
}
