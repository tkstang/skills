#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

import { buildDigest } from '../../../session-observer/scripts/lib/digest.mjs';
import { selectCompletedContinuation } from '../lib/completion-selection.mjs';
import {
  readLease,
  resourceExists,
  stateRoot,
  validateAbsolutePath,
  validateId,
} from '../lib/lease-state.mjs';
import {
  beginAdapterWait,
  claimAdapterTrigger,
  defineRuntimeAdapter,
  finishAdapterWait,
  inspectAdapterLease,
} from '../lib/runtime-adapter.mjs';

const POLL_MS = 250;

function providerTerminationError() {
  const error = new Error('Codex Stop hook terminated by provider');
  error.code = 'provider-terminated';
  return error;
}

function waitFor(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(providerTerminationError());
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(providerTerminationError());
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => {
        signal.removeEventListener('abort', onAbort);
      });
  });
}

function counters(lease) {
  return {
    leaseId: lease.leaseId,
    peerCursor: lease.peerCursor,
    continuationCount: lease.continuationCount,
    loopCount: lease.loopCount,
  };
}

function allow(diagnostic) {
  return Object.freeze({ decision: 'allow', diagnostic });
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function wakeEnvelope(lease, range) {
  const peer = `${lease.peerRuntime}:${lease.peerSession}`;
  return [
    '<session_observer_wake automatic="true"',
    `  runtime="codex" lease_id="${escapeAttribute(lease.leaseId)}"`,
    `  peer="${escapeAttribute(peer)}" records="${range.fromIndex}-${range.toIndex}">`,
    'Review the pinned peer range and respond only if it contains substantive new information.',
    '</session_observer_wake>',
  ].join('\n');
}

export const CODEX_STOP_ADAPTER = defineRuntimeAdapter({
  runtime: 'codex',
  identify(event) {
    if (!event || typeof event !== 'object') return null;
    if (event.hook_event_name !== 'Stop') return null;
    try {
      return Object.freeze({
        ownerSession: validateId(event.session_id, 'owner-session'),
        cwd: validateAbsolutePath(event.cwd, 'cwd'),
      });
    } catch {
      return null;
    }
  },
  emit(lease, range) {
    return Object.freeze({
      decision: 'block',
      reason: wakeEnvelope(lease, range),
    });
  },
});

async function defaultObserve(lease) {
  return buildDigest(lease.peerRuntime, lease.peerTranscript, {
    fromIndex: lease.peerCursor,
    mode: 'review',
    sessionId: lease.peerSession,
  });
}

function validSelection(selection, expected) {
  return (
    selection.continuation === true &&
    selection.range !== null &&
    selection.range.fromIndex === expected.peerCursor &&
    selection.range.toIndex === selection.completedRecord &&
    selection.peerCursor === selection.completedRecord + 1
  );
}

/**
 * Executes one Codex Stop-hook catch window. Non-trigger outcomes are returned
 * to callers for diagnostics but deliberately produce no hook output.
 */
export async function runCodexStopHook(event, options = {}) {
  const identity = CODEX_STOP_ADAPTER.identify(event);
  if (!identity) return allow('invalid-hook-input');

  const root = options.root ?? stateRoot(options.env ?? process.env);
  const observe = options.observe ?? defaultObserve;
  const sleep =
    options.sleep ??
    ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const signal = options.signal;
  let currentNow = now();
  let lease;

  try {
    lease = await readLease(root, identity.ownerSession);
  } catch (error) {
    return allow(error?.code ?? 'malformed-lease');
  }
  if (!lease) return allow('missing');
  if (lease.ownerSession !== identity.ownerSession)
    return allow('identity-mismatch');

  const invocation = {
    runtime: 'codex',
    peerRuntime: lease.peerRuntime,
    peerSession: lease.peerSession,
    ownerSession: identity.ownerSession,
    cwd: identity.cwd,
    transcript: lease.peerTranscript,
    now: currentNow,
  };
  const inspected = await inspectAdapterLease(root, invocation).catch(
    (error) => ({
      eligible: false,
      reason: error?.code ?? 'malformed-lease',
      lease: null,
    }),
  );
  if (!inspected.eligible) return allow(inspected.reason);
  if (
    !(await resourceExists(inspected.lease.ownerCwd)) ||
    !(await resourceExists(inspected.lease.peerTranscript))
  ) {
    return allow('missing-resource');
  }

  const waiting = await beginAdapterWait(root, invocation).catch((error) => ({
    waiting: false,
    reason: error?.code ?? 'malformed-lease',
    lease: null,
  }));
  if (!waiting.waiting || !waiting.lease) return allow(waiting.reason);

  const expected = counters(waiting.lease);
  const deadline = Date.parse(waiting.lease.waitDeadlineAt);
  if (!Number.isFinite(deadline)) return allow('malformed-lease');
  let diagnostic = 'wait-timeout';

  try {
    while ((currentNow = now()) < deadline) {
      let selection;
      try {
        selection = selectCompletedContinuation(
          await waitFor(
            Promise.resolve().then(() => observe(waiting.lease)),
            signal,
          ),
        );
      } catch (error) {
        diagnostic =
          error?.code === 'provider-terminated'
            ? 'provider-terminated'
            : 'observer-invalid';
        return allow(diagnostic);
      }

      if (validSelection(selection, expected)) {
        const terminal =
          waiting.lease.continuationCount + selection.budgetCost >=
            waiting.lease.continuationCap ||
          waiting.lease.loopCount + 1 >= waiting.lease.loopCap;
        const claimed = await claimAdapterTrigger(
          root,
          { ...invocation, now: currentNow },
          expected,
          {
            peerCursor: selection.peerCursor,
            loopIncrement: 1,
            terminal,
            diagnostic: null,
          },
        ).catch((error) => ({
          triggered: false,
          reason: error?.code ?? 'claim-failed',
          lease: null,
        }));
        if (!claimed.triggered) {
          diagnostic = claimed.reason;
          return allow(claimed.reason);
        }
        return CODEX_STOP_ADAPTER.emit(waiting.lease, selection.range);
      }

      const remaining = deadline - now();
      if (remaining > 0)
        await waitFor(
          Promise.resolve(sleep(Math.min(POLL_MS, remaining))),
          signal,
        );
    }
    return allow(diagnostic);
  } catch (error) {
    diagnostic =
      error?.code === 'provider-terminated'
        ? 'provider-terminated'
        : 'observer-invalid';
    return allow(diagnostic);
  } finally {
    // A provider cancellation can arrive while either observe or sleep is
    // pending. Finalize only this generation, so a stale hook cannot change a
    // re-armed lease, but its own `waiting` state never outlives the process.
    await finishAdapterWait(
      root,
      { ...invocation, now: currentNow },
      expected,
      diagnostic,
    ).catch(() => {});
  }
}

async function readStdin() {
  const input = await readFile('/dev/stdin', 'utf8');
  return JSON.parse(input || '{}');
}

async function main() {
  let event;
  try {
    event = await readStdin();
  } catch {
    return;
  }
  const controller = new AbortController();
  const terminate = () => controller.abort();
  process.once('SIGINT', terminate);
  process.once('SIGTERM', terminate);
  try {
    const result = await runCodexStopHook(event, { signal: controller.signal });
    if (result.decision === 'block')
      process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    process.removeListener('SIGINT', terminate);
    process.removeListener('SIGTERM', terminate);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(() => {});
}
