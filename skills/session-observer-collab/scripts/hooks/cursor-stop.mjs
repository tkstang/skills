#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

import { buildDigest } from '../../../session-observer/scripts/lib/digest.mjs';
import { selectCompletedContinuation } from '../lib/completion-selection.mjs';
import {
  readLease,
  resourceExists,
  stateRoot,
  validateId,
} from '../lib/lease-state.mjs';
import {
  advanceAdapterCursor,
  beginAdapterWait,
  claimAdapterTrigger,
  defineRuntimeAdapter,
  finishAdapterWait,
  inspectAdapterLease,
} from '../lib/runtime-adapter.mjs';

export const DEFAULT_CURSOR_LOOP_LIMIT = 5;
const POLL_MS = 250;

function integer(value, label) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new TypeError(`${label} must be a non-negative safe integer`);
  return value;
}

function loopLimit(value) {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new TypeError('loopLimit must be a positive safe integer');
  return value;
}

function counters(lease) {
  return {
    leaseId: lease.leaseId,
    peerCursor: lease.peerCursor,
    continuationCount: lease.continuationCount,
    loopCount: lease.loopCount,
  };
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function cursorWakeEnvelope(lease, range) {
  const peer = `${lease.peerRuntime}:${lease.peerSession}`;
  return [
    '<session_observer_wake automatic="true"',
    `  runtime="cursor" lease_id="${escapeAttribute(lease.leaseId)}"`,
    `  peer="${escapeAttribute(peer)}" records="${range.fromIndex}-${range.toIndex}">`,
    'Review the pinned peer range and respond only if it contains substantive new information.',
    '</session_observer_wake>',
  ].join('\n');
}

export const CURSOR_STOP_ADAPTER = defineRuntimeAdapter({
  runtime: 'cursor',
  identify(event) {
    if (!event || typeof event !== 'object' || event.status !== 'success')
      return null;
    try {
      return Object.freeze({
        ownerSession: validateId(event.conversation_id, 'conversation-id'),
        generationId: validateId(event.generation_id, 'generation-id'),
        loopCount: integer(event.loop_count, 'loop_count'),
      });
    } catch {
      return null;
    }
  },
  emit(lease, range) {
    return Object.freeze({
      followup_message: cursorWakeEnvelope(lease, range),
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
 * Executes one Cursor Stop-hook catch window. A hook can only submit the
 * documented synthetic follow-up envelope; every non-trigger outcome is null.
 */
export async function runCursorStopHook(event, options = {}) {
  const identity = CURSOR_STOP_ADAPTER.identify(event);
  if (!identity) return null;

  let configuredLoopLimit;
  try {
    configuredLoopLimit = loopLimit(
      options.loopLimit ?? DEFAULT_CURSOR_LOOP_LIMIT,
    );
  } catch {
    return null;
  }
  // Cursor's own chaining limit is a separate ceiling from the finite lease.
  // Once reached, the now-idle conversation cannot be awakened by later peer
  // output, so do not open a wait or consume a lease continuation.
  if (identity.loopCount >= configuredLoopLimit) return null;

  const root = options.root ?? stateRoot(options.env ?? process.env);
  const observe = options.observe ?? defaultObserve;
  const sleep =
    options.sleep ??
    ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  let currentNow = now();
  let lease;

  try {
    lease = await readLease(root, identity.ownerSession);
  } catch {
    return null;
  }
  if (!lease || lease.ownerSession !== identity.ownerSession) return null;

  // Cursor's documented Stop payload has no cwd. Bind the invocation to the
  // already owner-only, validated lease instead of accepting an untrusted path.
  const invocation = {
    runtime: 'cursor',
    peerRuntime: lease.peerRuntime,
    peerSession: lease.peerSession,
    ownerSession: identity.ownerSession,
    cwd: lease.ownerCwd,
    transcript: lease.peerTranscript,
    now: currentNow,
  };
  const inspected = await inspectAdapterLease(root, invocation).catch(() => ({
    eligible: false,
    lease: null,
  }));
  if (!inspected.eligible || !inspected.lease) return null;
  if (
    !(await resourceExists(inspected.lease.ownerCwd)) ||
    !(await resourceExists(inspected.lease.peerTranscript))
  ) {
    return null;
  }

  const waiting = await beginAdapterWait(root, invocation).catch(() => ({
    waiting: false,
    lease: null,
  }));
  if (!waiting.waiting || !waiting.lease) return null;

  let activeLease = waiting.lease;
  let expected = counters(activeLease);
  const deadline = Date.parse(activeLease.waitDeadlineAt);
  if (!Number.isFinite(deadline)) return null;
  let diagnostic = 'wait-timeout';

  try {
    while ((currentNow = now()) < deadline) {
      let selection;
      try {
        selection = selectCompletedContinuation(await observe(activeLease));
      } catch {
        diagnostic = 'observer-invalid';
        return null;
      }

      if (validSelection(selection, expected)) {
        const terminal =
          activeLease.continuationCount + selection.budgetCost >=
            activeLease.continuationCap ||
          activeLease.loopCount + 1 >= activeLease.loopCap ||
          identity.loopCount + 1 >= configuredLoopLimit;
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
        ).catch(() => ({ triggered: false, lease: null }));
        if (!claimed.triggered) return null;
        return CURSOR_STOP_ADAPTER.emit(activeLease, selection.range);
      }

      if (
        selection.continuation === false &&
        selection.peerCursor > expected.peerCursor
      ) {
        if (selection.fromIndex !== expected.peerCursor) {
          diagnostic = 'noncontiguous-selection';
          return null;
        }
        const advanced = await advanceAdapterCursor(
          root,
          { ...invocation, now: currentNow },
          expected,
          selection.peerCursor,
        ).catch(() => ({ advanced: false, lease: null }));
        if (!advanced.advanced || !advanced.lease) return null;
        activeLease = advanced.lease;
        expected = counters(activeLease);
        continue;
      }

      const remaining = deadline - now();
      if (remaining > 0) await sleep(Math.min(POLL_MS, remaining));
    }
    return null;
  } catch {
    diagnostic = 'observer-invalid';
    return null;
  } finally {
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

export async function runCursorStopMain() {
  let event;
  try {
    event = await readStdin();
  } catch {
    return;
  }
  const result = await runCursorStopHook(event);
  if (result?.followup_message)
    process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCursorStopMain().catch(() => {});
}
