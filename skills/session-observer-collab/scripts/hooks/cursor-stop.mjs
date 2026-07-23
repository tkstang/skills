#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { open, readFile } from 'node:fs/promises';

import { createCursorTurnAccumulator } from '../../../session-observer/scripts/lib/cursor-analysis.mjs';
import { scanCursorTranscript } from '../../../session-observer/scripts/lib/cursor-frames.mjs';
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

function completionIndexBase(value) {
  if (
    value !== 'zero-based-jsonl-record-index' &&
    value !== 'zero-based-jsonl-frame-index'
  ) {
    throw new TypeError('range.indexBase must be a supported index base');
  }
  return value;
}

export function cursorWakeEnvelope(lease, range) {
  const peer = `${lease.peerRuntime}:${lease.peerSession}`;
  const indexBase = completionIndexBase(range.indexBase);
  return [
    '<session_observer_wake automatic="true" schema_version="2"',
    `  runtime="cursor" lease_id="${escapeAttribute(lease.leaseId)}"`,
    `  peer="${escapeAttribute(peer)}" index_base="${indexBase}"`,
    `  records="${range.fromIndex}-${range.toIndex}">`,
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
  if (lease.peerRuntime === 'cursor') {
    const identity = {
      runtime: 'cursor',
      sessionId: lease.peerSession,
      projectCwd: lease.ownerCwd,
      canonicalCwd: lease.ownerCwd,
      canonicalTranscriptPath: lease.peerCanonicalTranscriptPath,
      cwdEvidence: ['direct-project-root'],
      sessionEvidence: ['explicit-pin'],
      strength: 'exact',
      reasons: [],
    };
    const accumulator = createCursorTurnAccumulator(identity, lease.peerCursor);
    const scan = await scanCursorTranscript(lease.peerTranscript, {
      verifyPrefixBytes: lease.peerContinuity?.prefixBytes,
      onFrame(frame) {
        accumulator.onFrame(frame);
      },
    });
    const checkpoint = lease.peerContinuity;
    if (
      checkpoint !== null &&
      (scan.file.size < checkpoint.observedSize ||
        scan.file.size < checkpoint.prefixBytes ||
        scan.file.device !== checkpoint.device ||
        scan.file.inode !== checkpoint.inode ||
        scan.verifiedPrefixSha256 !== checkpoint.prefixSha256)
    ) {
      throw new Error('cursor continuity changed during completion read');
    }
    return buildDigest('cursor', lease.peerTranscript, {
      fromIndex: lease.peerCursor,
      mode: 'review',
      sessionId: lease.peerSession,
      recordedCwd: lease.ownerCwd,
      cursorProjection: 'confirmed-completion',
      cursorIdentity: identity,
      cursorScan: scan,
      cursorAnalysis: accumulator.finish(scan),
      cursorState: null,
      cursorContinuity: checkpoint === null ? 'new' : 'verified',
    });
  }
  return buildDigest(lease.peerRuntime, lease.peerTranscript, {
    fromIndex: lease.peerCursor,
    mode: 'review',
    sessionId: lease.peerSession,
  });
}

function validSelection(selection, expected, lease) {
  return (
    selection.continuation === true &&
    selection.indexBase === lease.peerIndexBase &&
    selection.range !== null &&
    selection.range.fromIndex === expected.peerCursor &&
    selection.range.toIndex === selection.completedRecord &&
    selection.peerCursor === selection.completedRecord + 1
  );
}

function isPendingCursorCompletion(digest, lease) {
  return (
    lease.peerRuntime === 'cursor' &&
    digest?.schemaVersion === 2 &&
    digest.runtime === 'cursor' &&
    digest.range?.indexBase === 'zero-based-jsonl-frame-index' &&
    digest.accounting?.indexBase === 'zero-based-jsonl-frame-index' &&
    digest.cursorEvidence?.projection === 'confirmed-completion' &&
    digest.cursorEvidence?.status?.lifecycle === 'pending' &&
    digest.cursorEvidence?.blockingFrame === null &&
    digest.accounting?.buffered?.reason === 'stability-wait' &&
    digest.range.fromIndex === lease.peerCursor &&
    digest.range.nextIndex === lease.peerCursor
  );
}

function validDigestForLease(digest, lease) {
  if (lease.peerRuntime !== 'cursor') return digest?.schemaVersion === 1;
  return (
    digest?.schemaVersion === 2 &&
    digest.runtime === 'cursor' &&
    digest.range?.indexBase === lease.peerIndexBase &&
    digest.accounting?.indexBase === lease.peerIndexBase &&
    digest.cursorEvidence?.projection === 'confirmed-completion'
  );
}

async function hashPrefix(transcript, prefixBytes) {
  const hash = createHash('sha256');
  if (prefixBytes === 0) return hash.digest('hex');
  const handle = await open(transcript, 'r');
  try {
    let bytesRead = 0;
    const stream = handle.createReadStream({
      start: 0,
      end: prefixBytes - 1,
      autoClose: false,
    });
    for await (const chunk of stream) {
      bytesRead += chunk.byteLength;
      hash.update(chunk);
    }
    if (bytesRead !== prefixBytes)
      throw new Error('cursor checkpoint prefix is incomplete');
    return hash.digest('hex');
  } finally {
    await handle.close();
  }
}

async function cursorCheckpoint(lease, nextFrameIndex) {
  const frameEnds = [];
  const scan = await scanCursorTranscript(lease.peerTranscript, {
    verifyPrefixBytes: lease.peerContinuity?.prefixBytes,
    onFrame(frame) {
      frameEnds[frame.frameIndex] =
        frame.closed &&
        (frame.parseState === 'parsed' || frame.parseState === 'blank')
          ? frame.byteEnd
          : null;
    },
  });
  const prior = lease.peerContinuity;
  if (
    (prior !== null &&
      (scan.file.size < prior.observedSize ||
        scan.file.size < prior.prefixBytes ||
        scan.file.device !== prior.device ||
        scan.file.inode !== prior.inode ||
        scan.verifiedPrefixSha256 !== prior.prefixSha256)) ||
    scan.file.device === null ||
    scan.file.inode === null ||
    nextFrameIndex > (scan.safeThroughFrame ?? -1) + 1
  ) {
    throw new Error('cursor checkpoint continuity is unavailable');
  }
  const prefixBytes = nextFrameIndex === 0 ? 0 : frameEnds[nextFrameIndex - 1];
  if (!Number.isSafeInteger(prefixBytes) || prefixBytes < 0)
    throw new Error('cursor checkpoint frame is unavailable');
  return Object.freeze({
    indexBase: 'zero-based-jsonl-frame-index',
    nextFrameIndex,
    prefixBytes,
    prefixSha256: await hashPrefix(lease.peerTranscript, prefixBytes),
    observedSize: scan.file.size,
    device: scan.file.device,
    inode: scan.file.inode,
  });
}

async function cursorUpdate(lease, selection) {
  if (lease.peerRuntime !== 'cursor') {
    return Object.freeze({ peerCursor: selection.peerCursor });
  }
  return Object.freeze({
    peerCursor: selection.peerCursor,
    peerContinuity: await cursorCheckpoint(lease, selection.peerCursor),
  });
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
        const digest = await observe(activeLease);
        if (!validDigestForLease(digest, activeLease)) {
          diagnostic = 'observer-invalid';
          return null;
        }
        if (isPendingCursorCompletion(digest, activeLease)) {
          const remaining = deadline - now();
          if (remaining > 0) await sleep(Math.min(POLL_MS, remaining));
          continue;
        }
        selection = selectCompletedContinuation(digest);
      } catch {
        diagnostic = 'observer-invalid';
        return null;
      }

      if (validSelection(selection, expected, activeLease)) {
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
            ...(await cursorUpdate(activeLease, selection)),
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
          await cursorUpdate(activeLease, selection),
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
