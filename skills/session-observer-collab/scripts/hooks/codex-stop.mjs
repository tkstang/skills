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
  validateAbsolutePath,
  validateId,
} from '../lib/lease-state.mjs';
import {
  beginAdapterWait,
  advanceAdapterCursor,
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

function completionIndexBase(value) {
  if (
    value !== 'zero-based-jsonl-record-index' &&
    value !== 'zero-based-jsonl-frame-index'
  ) {
    throw new TypeError('range.indexBase must be a supported index base');
  }
  return value;
}

export function wakeEnvelope(lease, range) {
  const peer = `${lease.peerRuntime}:${lease.peerSession}`;
  const indexBase = completionIndexBase(range.indexBase);
  return [
    '<session_observer_wake automatic="true" schema_version="2"',
    `  runtime="codex" lease_id="${escapeAttribute(lease.leaseId)}"`,
    `  peer="${escapeAttribute(peer)}" index_base="${indexBase}"`,
    `  records="${range.fromIndex}-${range.toIndex}">`,
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

  let activeLease = waiting.lease;
  let expected = counters(activeLease);
  const deadline = Date.parse(waiting.lease.waitDeadlineAt);
  if (!Number.isFinite(deadline)) return allow('malformed-lease');
  let diagnostic = 'wait-timeout';

  try {
    while ((currentNow = now()) < deadline) {
      let selection;
      try {
        const digest = await waitFor(
          Promise.resolve().then(() => observe(activeLease)),
          signal,
        );
        if (!validDigestForLease(digest, activeLease)) {
          diagnostic = 'observer-invalid';
          return allow(diagnostic);
        }
        if (isPendingCursorCompletion(digest, activeLease)) {
          const remaining = deadline - now();
          if (remaining > 0) {
            await waitFor(
              Promise.resolve(sleep(Math.min(POLL_MS, remaining))),
              signal,
            );
          }
          continue;
        }
        selection = selectCompletedContinuation(digest);
      } catch (error) {
        diagnostic =
          error?.code === 'provider-terminated'
            ? 'provider-terminated'
            : 'observer-invalid';
        return allow(diagnostic);
      }

      if (validSelection(selection, expected, activeLease)) {
        const terminal =
          activeLease.continuationCount + selection.budgetCost >=
            activeLease.continuationCap ||
          activeLease.loopCount + 1 >= activeLease.loopCap;
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
        ).catch((error) => ({
          triggered: false,
          reason: error?.code ?? 'claim-failed',
          lease: null,
        }));
        if (!claimed.triggered) {
          diagnostic = claimed.reason;
          return allow(claimed.reason);
        }
        return CODEX_STOP_ADAPTER.emit(activeLease, selection.range);
      }

      if (
        selection.continuation === false &&
        selection.peerCursor > expected.peerCursor
      ) {
        if (selection.fromIndex !== expected.peerCursor) {
          diagnostic = 'noncontiguous-selection';
          return allow(diagnostic);
        }
        const advanced = await advanceAdapterCursor(
          root,
          { ...invocation, now: currentNow },
          expected,
          await cursorUpdate(activeLease, selection),
        ).catch((error) => ({
          advanced: false,
          reason: error?.code ?? 'cursor-advance-failed',
          lease: null,
        }));
        if (!advanced.advanced || !advanced.lease) {
          diagnostic = advanced.reason;
          return allow(advanced.reason);
        }
        activeLease = advanced.lease;
        expected = counters(activeLease);
        continue;
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

export async function runCodexStopMain() {
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
  runCodexStopMain().catch(() => {});
}
