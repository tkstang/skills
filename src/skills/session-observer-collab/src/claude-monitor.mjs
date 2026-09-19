#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { activationStatus } from '../../../shared/collaboration/activation.js';
import {
  claimDelivery,
  claimObservation,
  observationEventKey,
  resolveDeliveryKeys,
  watchBatchEventKey,
} from '../../../shared/collaboration/claims.js';
import { publishDeliveryDiagnostic } from '../../../shared/collaboration/diagnostics.js';
import { listInbox } from '../../../shared/collaboration/messages.js';
import {
  assessAutomaticOwnership,
  inspectClaudeStopInventory,
} from '../../../shared/collaboration/ownership.js';
import { assertPin, pinsEqual } from '../../../shared/collaboration/types.js';
import { buildDigest } from '../../session-observer/src/lib/digest.js';
import { selectCompletedContinuation } from './lib/completion-selection.mjs';
import {
  readLease,
  canonicalizePeerTranscript,
  stateRoot,
  validateAbsolutePath,
  validateId,
} from './lib/lease-state.mjs';
import {
  advanceAdapterCursor,
  claimAdapterTrigger,
  inspectAdapterLease,
} from './lib/runtime-adapter.mjs';
import {
  observeCursorCompletion,
  verifySelectedPrefix,
} from './lib/selected-prefix.mjs';

export const MAX_MONITOR_RUNTIME_MS = 30 * 60 * 1000;
const DEFAULT_POLL_MS = 250;

function counters(lease) {
  return {
    leaseId: lease.leaseId,
    peerCursor: lease.peerCursor,
    continuationCount: lease.continuationCount,
    loopCount: lease.loopCount,
  };
}

function parsePin(value, label) {
  const separator = value.indexOf(':');
  if (separator <= 0 || separator === value.length - 1)
    throw new TypeError(`${label} must use <runtime>:<session-id>`);
  const pin = {
    runtime: value.slice(0, separator),
    sessionId: value.slice(separator + 1),
  };
  assertPin(pin);
  return pin;
}

function exactRecordPrefixIdentity(transcript, nextIndex) {
  return readFile(transcript).then((bytes) => {
    let end = 0;
    let records = 0;
    while (records < nextIndex && end < bytes.length) {
      const newline = bytes.indexOf(0x0a, end);
      end = newline === -1 ? bytes.length : newline + 1;
      records += 1;
    }
    if (records !== nextIndex)
      throw new Error('selected record prefix is no longer available');
    return createHash('sha256').update(bytes.subarray(0, end)).digest('hex');
  });
}

async function selectionUpdate(lease, selection) {
  if (lease.peerRuntime !== 'cursor')
    return { peerCursor: selection.peerCursor };
  return {
    peerCursor: selection.peerCursor,
    peerContinuity: await verifySelectedPrefix(
      lease.peerTranscript,
      selection.selectedPrefix,
    ),
  };
}

async function selectionPrefixIdentity(lease, selection) {
  return lease.peerRuntime === 'cursor'
    ? (
        await verifySelectedPrefix(
          lease.peerTranscript,
          selection.selectedPrefix,
        )
      ).prefixSha256
    : exactRecordPrefixIdentity(lease.peerTranscript, selection.peerCursor);
}

async function defaultObserve(lease) {
  if (lease.peerRuntime === 'cursor') return observeCursorCompletion(lease);
  return buildDigest(lease.peerRuntime, lease.peerTranscript, {
    fromIndex: lease.peerCursor,
    mode: 'review',
    sessionId: lease.peerSession,
  });
}

async function pendingRequests(root, collaborationId, pin) {
  const inbox = await listInbox({ root, collaborationId, pin });
  return inbox.messages.filter(
    (message) => message.kind === 'request' && !message.inert,
  );
}

function defaultOwnershipVerification(input, env) {
  return async ({ activation, lease, now }) => {
    const settingsPaths = (env.AGENT_MESSAGING_CLAUDE_SETTINGS ?? '')
      .split(process.platform === 'win32' ? ';' : ':')
      .filter(Boolean);
    const installedPlugins = env.AGENT_MESSAGING_CLAUDE_PLUGINS
      ? JSON.parse(env.AGENT_MESSAGING_CLAUDE_PLUGINS)
      : {};
    const inventory = await inspectClaudeStopInventory({
      settingsPaths,
      installedPlugins,
    });
    const ownership = await assessAutomaticOwnership({
      root: input.root,
      pin: input.self,
      worktree: input.cwd,
      inventory,
      acknowledgedFingerprint:
        activation.thirdPartyHookAcknowledgment?.configurationFingerprint ??
        null,
      requestedController: 'observer-collab',
      requestedActivationId: input.activationId,
      requestedCollaborationId: input.collaborationId,
      now: new Date(now),
    });
    const attestation = activation.composedMonitorAttestation;
    return (
      ownership.automaticAllowed &&
      ownership.controller === 'observer-collab' &&
      ownership.composedMonitorLeaseId === lease.leaseId &&
      typeof attestation?.observerLeaseId === 'string' &&
      pinsEqual(attestation.owner, input.self) &&
      pinsEqual(attestation.peer, input.peer) &&
      attestation.activationId === input.activationId &&
      attestation.collaborationId === input.collaborationId &&
      attestation.oldMonitorStopped === true &&
      attestation.standaloneWatcherStopped === true
    );
  };
}

async function exactComposition(input, now, expectedLeaseId = null) {
  const status = await activationStatus(input.root, input.self, new Date(now));
  const activation = status.activation;
  if (
    !status.active ||
    !activation ||
    activation.id !== input.activationId ||
    activation.collaborationId !== input.collaborationId ||
    activation.controller !== 'observer-collab' ||
    activation.mechanism !== 'monitor' ||
    activation.worktree !== input.cwd ||
    !pinsEqual(activation.pin, input.self)
  )
    return { valid: false, reason: 'activation-mismatch', status, lease: null };
  const lease = await readLease(input.root, input.self.sessionId);
  if (!lease)
    return { valid: false, reason: 'lease-missing', status, lease: null };
  for (const [matches, reason] of [
    [lease.runtime === 'claude-code', 'lease-runtime-mismatch'],
    [lease.ownerSession === input.self.sessionId, 'lease-owner-mismatch'],
    [lease.ownerCwd === input.cwd, 'lease-cwd-mismatch'],
    [lease.peerRuntime === input.peer.runtime, 'lease-peer-runtime-mismatch'],
    [lease.peerSession === input.peer.sessionId, 'lease-peer-session-mismatch'],
    [
      lease.peerTranscript === input.peerTranscript,
      'lease-transcript-mismatch',
    ],
  ]) {
    if (!matches) return { valid: false, reason, status, lease };
  }
  if (
    lease.composedActivation?.activationId !== activation.id ||
    lease.composedActivation?.collaborationId !== activation.collaborationId
  )
    return { valid: false, reason: 'lease-activation-mismatch', status, lease };
  if (
    lease.composedActivation?.oldMonitorStopped !== true ||
    lease.composedActivation?.standaloneWatcherStopped !== true
  )
    return {
      valid: false,
      reason: 'lease-attestation-mismatch',
      status,
      lease,
    };
  if (expectedLeaseId !== null && lease.leaseId !== expectedLeaseId)
    return { valid: false, reason: 'lease-generation-mismatch', status, lease };
  if (now >= Date.parse(status.effectiveExpiresAt))
    return { valid: false, reason: 'activation-expired', status, lease };
  if (now >= Date.parse(lease.expiresAt))
    return { valid: false, reason: 'lease-expired', status, lease };
  const inspected = await inspectAdapterLease(input.root, {
    runtime: 'claude-code',
    peerRuntime: input.peer.runtime,
    peerSession: input.peer.sessionId,
    ownerSession: input.self.sessionId,
    cwd: input.cwd,
    transcript: input.peerTranscript,
    now,
  });
  if (!inspected.eligible && lease.state !== 'triggered')
    return { valid: false, reason: inspected.reason, status, lease };
  if (
    input.verifyOwnership &&
    !(await input.verifyOwnership({ activation, lease, now }))
  )
    return { valid: false, reason: 'ownership-refused', status, lease };
  return { valid: true, reason: 'composed', status, lease };
}

function messageNotification(activation, claim, requests) {
  const owned = new Set(claim.owned.map((item) => item.messageId));
  return {
    type: 'agent-messaging-request-notification',
    collaborationId: activation.collaborationId,
    activationId: activation.id,
    attemptId: claim.event.token,
    eventKey: claim.event.eventKey,
    untrusted: true,
    messageIds: requests
      .filter((message) => owned.has(message.id))
      .map((message) => message.id),
  };
}

export async function runClaudeMonitor(input, dependencies = {}) {
  assertPin(input.self);
  assertPin(input.peer);
  if (input.self.runtime !== 'claude-code')
    throw new TypeError('Claude Monitor self pin must use claude-code');
  const canonicalPeer = await canonicalizePeerTranscript(
    input.peer.runtime,
    input.peerTranscript,
  );
  input = {
    ...input,
    cwd: validateAbsolutePath(input.cwd, 'cwd'),
    peerTranscript: canonicalPeer.peerCanonicalTranscriptPath,
  };
  const verifyOwnership =
    dependencies.verifyOwnership ??
    defaultOwnershipVerification(input, dependencies.env ?? process.env);
  const maxRuntimeMs = Number(input.maxRuntimeMs);
  const pollMs = Number(input.pollMs ?? DEFAULT_POLL_MS);
  if (
    !Number.isSafeInteger(maxRuntimeMs) ||
    maxRuntimeMs <= 0 ||
    maxRuntimeMs > MAX_MONITOR_RUNTIME_MS
  )
    throw new TypeError('max runtime must be from 1 to 1800000 milliseconds');
  if (!Number.isSafeInteger(pollMs) || pollMs < 1 || pollMs > 60_000)
    throw new TypeError('poll interval must be from 1 to 60000 milliseconds');
  if (!input.confirmOldMonitorStopped || !input.confirmStandaloneWatcherStopped)
    return {
      reason: 'stop-confirmation-required',
      notification: null,
      iterations: 0,
    };
  const now = dependencies.now ?? Date.now;
  const sleep =
    dependencies.sleep ??
    ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const observe = dependencies.observe ?? defaultObserve;
  const emit =
    dependencies.emit ??
    ((notification) =>
      process.stdout.write(`${JSON.stringify(notification)}\n`));
  const startedAt = now();
  const initial = await exactComposition(
    { ...input, verifyOwnership },
    startedAt,
  );
  if (!initial.valid)
    return { reason: initial.reason, notification: null, iterations: 0 };
  const leaseId = initial.lease.leaseId;
  const deadline = Math.min(
    startedAt + maxRuntimeMs,
    Date.parse(initial.status.effectiveExpiresAt),
    Date.parse(initial.lease.expiresAt),
  );
  let lease = initial.lease;
  let iterations = 0;
  while (now() < deadline) {
    if (dependencies.signal?.aborted)
      return { reason: 'interrupted', notification: null, iterations };
    iterations += 1;
    const composition = await exactComposition(
      { ...input, verifyOwnership },
      now(),
      leaseId,
    );
    if (!composition.valid)
      return { reason: composition.reason, notification: null, iterations };
    lease = composition.lease;
    const requests = await pendingRequests(
      input.root,
      input.collaborationId,
      input.self,
    );
    if (requests.length > 0) {
      const deliveryKeys = await resolveDeliveryKeys({
        root: input.root,
        activation: composition.status.activation,
        messages: requests,
      });
      const eventKey = watchBatchEventKey({
        activationId: input.activationId,
        bindingGeneration: composition.status.activation.bindingGeneration,
        deliveryKeys,
      });
      const claim = await claimDelivery({
        root: input.root,
        pin: input.self,
        eventKey,
        deliveryKeys,
        now: new Date(now()),
        clock: () => new Date(now()),
        hooks: dependencies.messageClaimHooks,
      });
      if (claim.slot && claim.owned.length > 0 && claim.activeAfterClaim) {
        const final = await exactComposition(
          { ...input, verifyOwnership },
          now(),
          leaseId,
        );
        if (!final.valid)
          return { reason: final.reason, notification: null, iterations };
        const notification = messageNotification(
          final.status.activation,
          claim,
          requests,
        );
        await emit(notification);
        return { reason: 'message-notified', notification, iterations };
      }
    } else {
      const digest = await observe(lease);
      const selection = selectCompletedContinuation(digest);
      const expected = counters(lease);
      if (selection.continuation && selection.range) {
        if (selection.range.fromIndex !== expected.peerCursor)
          return {
            reason: 'noncontiguous-selection',
            notification: null,
            iterations,
          };
        if (
          (await pendingRequests(input.root, input.collaborationId, input.self))
            .length > 0
        )
          continue;
        const observation = {
          owner: input.self,
          peer: input.peer,
          indexBase: selection.indexBase,
          fromIndex: selection.range.fromIndex,
          toIndex: selection.range.toIndex,
          nextIndex: selection.peerCursor,
          selectedPrefixIdentity: await selectionPrefixIdentity(
            lease,
            selection,
          ),
        };
        const eventKey = observationEventKey({
          activationId: input.activationId,
          observation,
        });
        const shared = await claimObservation({
          root: input.root,
          pin: input.self,
          eventKey,
          observation,
          now: new Date(now()),
          clock: () => new Date(now()),
          hooks: dependencies.observationClaimHooks,
        });
        if (!shared.slot || !shared.activeAfterClaim)
          return {
            reason: shared.duplicateEvent
              ? 'duplicate-observation'
              : 'shared-budget-refused',
            notification: null,
            iterations,
          };
        await dependencies.afterSharedSlot?.();
        const update = await selectionUpdate(lease, selection);
        const claimed = await claimAdapterTrigger(
          input.root,
          {
            runtime: 'claude-code',
            peerRuntime: input.peer.runtime,
            peerSession: input.peer.sessionId,
            ownerSession: input.self.sessionId,
            cwd: input.cwd,
            transcript: input.peerTranscript,
            now: now(),
          },
          expected,
          { ...update, loopIncrement: 1, terminal: true, diagnostic: null },
          now,
        );
        if (!claimed.triggered)
          return { reason: claimed.reason, notification: null, iterations };
        await dependencies.afterCursorClaim?.();
        const final = await exactComposition(
          { ...input, verifyOwnership },
          now(),
          leaseId,
        );
        if (!final.valid)
          return { reason: final.reason, notification: null, iterations };
        const notification = {
          type: 'session-observer-range-notification',
          collaborationId: input.collaborationId,
          activationId: input.activationId,
          attemptId: shared.event.token,
          eventKey,
          peer: `${input.peer.runtime}:${input.peer.sessionId}`,
          range: {
            indexBase: observation.indexBase,
            fromIndex: observation.fromIndex,
            toIndex: observation.toIndex,
          },
        };
        await publishDeliveryDiagnostic({
          root: input.root,
          pin: input.self,
          diagnostic: {
            attemptId: shared.event.token,
            activationId: input.activationId,
            eventKey,
            boundary: 'monitor',
            attemptKind: 'observation',
            observation,
            recordedAt: new Date(now()).toISOString(),
            stage: 'output-attempted',
            outcomeCode: 'observation-notification-attempted',
            errorCode: null,
          },
        }).catch(() => undefined);
        await emit(notification);
        return { reason: 'observation-notified', notification, iterations };
      }
      if (!selection.continuation && selection.peerCursor > lease.peerCursor) {
        const advanced = await advanceAdapterCursor(
          input.root,
          {
            runtime: 'claude-code',
            peerRuntime: input.peer.runtime,
            peerSession: input.peer.sessionId,
            ownerSession: input.self.sessionId,
            cwd: input.cwd,
            transcript: input.peerTranscript,
            now: now(),
          },
          expected,
          await selectionUpdate(lease, selection),
        );
        if (!advanced.advanced)
          return { reason: advanced.reason, notification: null, iterations };
        lease = advanced.lease;
      }
    }
    await sleep(Math.min(pollMs, Math.max(0, deadline - now())));
  }
  return { reason: 'duration-complete', notification: null, iterations };
}

function parseArgs(argv) {
  const values = {};
  const flags = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--'))
      throw new TypeError(`unexpected argument: ${token}`);
    const key = token.slice(2);
    if (key.startsWith('confirm-')) flags.add(key);
    else values[key] = argv[++index];
  }
  return { values, flags };
}

export async function runClaudeMonitorMain(
  argv = process.argv.slice(2),
  env = process.env,
) {
  const { values, flags } = parseArgs(argv);
  const root = values.root ?? stateRoot(env);
  const self = parsePin(values.self ?? '', '--self');
  const peer = parsePin(values.peer ?? '', '--peer');
  const input = {
    root,
    collaborationId: validateId(values.collab, 'collaboration-id'),
    activationId: validateId(values['activation-id'], 'activation-id'),
    self,
    peer,
    cwd: validateAbsolutePath(values.cwd, 'cwd'),
    peerTranscript: validateAbsolutePath(
      values['peer-transcript'],
      'peer-transcript',
    ),
    maxRuntimeMs: Number(values['max-runtime-ms']),
    pollMs:
      values['poll-ms'] === undefined ? undefined : Number(values['poll-ms']),
    confirmOldMonitorStopped: flags.has('confirm-old-monitor-stopped'),
    confirmStandaloneWatcherStopped: flags.has(
      'confirm-standalone-watcher-stopped',
    ),
  };
  return runClaudeMonitor(input);
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  runClaudeMonitorMain().catch((error) => {
    process.stderr.write(`claude-monitor: ${error?.code ?? 'error'}\n`);
    process.exitCode = 1;
  });
}
