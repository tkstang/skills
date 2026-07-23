import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';

import {
  beginLeaseWait,
  canonicalizePeerTranscript,
  compareAndSwapCursor,
  compareAndSwapTrigger,
  createWaiterIdentity,
  effectiveLease,
  finishLeaseWait,
  readLease,
  validateAbsolutePath,
  validateId,
  validateOwnerRuntime,
  validatePeerRuntime,
} from './lease-state.mjs';

export const RUNTIME_ADAPTER_VERSION = 2;

function fileIdentity(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

async function hashPrefix(handle, prefixBytes) {
  const hash = createHash('sha256');
  if (prefixBytes === 0) return hash.digest('hex');
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
  if (bytesRead !== prefixBytes) return null;
  return hash.digest('hex');
}

export async function verifyAdapterPeerContinuity(lease, transcript) {
  if (lease.peerRuntime !== 'cursor') {
    const requested = validateAbsolutePath(transcript, 'transcript');
    return Object.freeze({
      verified: requested === lease.peerTranscript,
      reason:
        requested === lease.peerTranscript ? 'verified' : 'identity-mismatch',
      canonicalTranscriptPath:
        requested === lease.peerTranscript ? requested : null,
    });
  }

  let requestedPath;
  let leasedPath;
  try {
    requestedPath = await canonicalizePeerTranscript('cursor', transcript);
    leasedPath = await canonicalizePeerTranscript(
      'cursor',
      lease.peerTranscript,
    );
  } catch (error) {
    return Object.freeze({
      verified: false,
      reason: error?.code ?? 'continuity-path-mismatch',
      canonicalTranscriptPath: null,
    });
  }
  if (
    requestedPath.peerCanonicalTranscriptPath !==
      lease.peerCanonicalTranscriptPath ||
    leasedPath.peerCanonicalTranscriptPath !==
      lease.peerCanonicalTranscriptPath ||
    requestedPath.peerCanonicalTranscriptPath !==
      leasedPath.peerCanonicalTranscriptPath
  ) {
    return Object.freeze({
      verified: false,
      reason: 'continuity-path-mismatch',
      canonicalTranscriptPath: null,
    });
  }

  const checkpoint = lease.peerContinuity;
  if (checkpoint === null) {
    return Object.freeze({
      verified: true,
      reason: 'verified',
      canonicalTranscriptPath: lease.peerCanonicalTranscriptPath,
    });
  }

  let handle;
  try {
    handle = await open(lease.peerCanonicalTranscriptPath, 'r');
    const metadata = await handle.stat();
    if (
      metadata.size < checkpoint.observedSize ||
      metadata.size < checkpoint.prefixBytes
    ) {
      return Object.freeze({
        verified: false,
        reason: 'continuity-size-mismatch',
        canonicalTranscriptPath: lease.peerCanonicalTranscriptPath,
      });
    }
    if (
      checkpoint.device !== null &&
      fileIdentity(metadata.dev) !== checkpoint.device
    ) {
      return Object.freeze({
        verified: false,
        reason: 'continuity-device-mismatch',
        canonicalTranscriptPath: lease.peerCanonicalTranscriptPath,
      });
    }
    if (
      checkpoint.inode !== null &&
      fileIdentity(metadata.ino) !== checkpoint.inode
    ) {
      return Object.freeze({
        verified: false,
        reason: 'continuity-inode-mismatch',
        canonicalTranscriptPath: lease.peerCanonicalTranscriptPath,
      });
    }
    if (
      (await hashPrefix(handle, checkpoint.prefixBytes)) !==
      checkpoint.prefixSha256
    ) {
      return Object.freeze({
        verified: false,
        reason: 'continuity-prefix-mismatch',
        canonicalTranscriptPath: lease.peerCanonicalTranscriptPath,
      });
    }
  } catch (error) {
    return Object.freeze({
      verified: false,
      reason: error?.code ?? 'continuity-read-failed',
      canonicalTranscriptPath: lease.peerCanonicalTranscriptPath,
    });
  } finally {
    await handle?.close();
  }

  return Object.freeze({
    verified: true,
    reason: 'verified',
    canonicalTranscriptPath: lease.peerCanonicalTranscriptPath,
  });
}

async function validateCursorUpdate(lease, transcript, update) {
  if (lease.peerRuntime !== 'cursor') {
    if (
      update &&
      typeof update === 'object' &&
      Object.hasOwn(update, 'peerContinuity') &&
      update.peerContinuity !== null
    ) {
      return { ok: false, reason: 'continuity-not-applicable' };
    }
    return { ok: true, update };
  }
  if (
    !update ||
    typeof update !== 'object' ||
    !Object.hasOwn(update, 'peerContinuity') ||
    update.peerContinuity === null
  ) {
    return { ok: false, reason: 'continuity-required' };
  }
  if (update.peerContinuity.nextFrameIndex !== update.peerCursor)
    return { ok: false, reason: 'continuity-required' };
  const proposed = await verifyAdapterPeerContinuity(
    {
      ...lease,
      peerCursor: update.peerCursor,
      peerContinuity: update.peerContinuity,
    },
    transcript,
  );
  return proposed.verified
    ? { ok: true, update }
    : { ok: false, reason: proposed.reason };
}

export function defineRuntimeAdapter(adapter) {
  if (!adapter || typeof adapter !== 'object')
    throw new TypeError('adapter must be an object');
  validateOwnerRuntime(adapter.runtime);
  for (const method of ['identify', 'emit'])
    if (typeof adapter[method] !== 'function')
      throw new TypeError(`adapter.${method} must be a function`);
  return Object.freeze({ version: RUNTIME_ADAPTER_VERSION, ...adapter });
}

export function validateAdapterInvocation(input) {
  if (!input || typeof input !== 'object')
    throw new TypeError('invocation must be an object');
  return Object.freeze({
    runtime: validateOwnerRuntime(input.runtime),
    peerRuntime: validatePeerRuntime(input.peerRuntime),
    peerSession: validateId(input.peerSession, 'peer-session'),
    ownerSession: validateId(input.ownerSession, 'owner-session'),
    cwd: validateAbsolutePath(input.cwd, 'cwd'),
    transcript: validateAbsolutePath(input.transcript, 'transcript'),
    now: input.now === undefined ? Date.now() : input.now,
    waiter: input.waiter,
  });
}

export async function inspectAdapterLease(root, invocation) {
  const input = validateAdapterInvocation(invocation);
  const lease = await readLease(root, input.ownerSession);
  if (!lease) return { eligible: false, reason: 'missing', lease: null };
  if (
    lease.runtime !== input.runtime ||
    lease.peerRuntime !== input.peerRuntime ||
    lease.peerSession !== input.peerSession ||
    lease.ownerCwd !== input.cwd
  ) {
    return { eligible: false, reason: 'identity-mismatch', lease };
  }
  const continuity = await verifyAdapterPeerContinuity(lease, input.transcript);
  if (!continuity.verified) {
    return { eligible: false, reason: continuity.reason, lease };
  }
  const effective = effectiveLease(lease, input.now);
  return {
    eligible: ['armed', 'waiting'].includes(effective.state),
    reason: effective.diagnostic || effective.state,
    lease: effective,
  };
}

export async function beginAdapterWait(root, invocation) {
  const input = validateAdapterInvocation(invocation);
  const inspected = await inspectAdapterLease(root, input);
  if (!inspected.eligible || !inspected.lease) {
    return {
      ok: false,
      waiting: false,
      changed: false,
      reason: inspected.reason,
      lease: inspected.lease,
    };
  }
  const waiter = input.waiter ?? (await createWaiterIdentity());
  const result = await beginLeaseWait(
    root,
    input.ownerSession,
    {
      runtime: input.runtime,
      peerRuntime: input.peerRuntime,
      peerSession: input.peerSession,
      ownerCwd: input.cwd,
      peerTranscript: inspected.lease.peerTranscript,
    },
    input.now,
    waiter,
  );
  return {
    waiting: result.ok,
    changed: result.ok && result.changed,
    reason: result.ok ? 'waiting' : result.reason,
    lease: result.lease ?? null,
  };
}

export async function advanceAdapterCursor(
  root,
  invocation,
  expected,
  cursorUpdate,
) {
  const inspected = await inspectAdapterLease(root, invocation);
  if (!inspected.eligible)
    return {
      advanced: false,
      reason: inspected.reason,
      lease: inspected.lease,
    };
  const checked = await validateCursorUpdate(
    inspected.lease,
    invocation.transcript,
    cursorUpdate,
  );
  if (!checked.ok)
    return {
      advanced: false,
      reason: checked.reason,
      lease: inspected.lease,
    };
  const result = await compareAndSwapCursor(
    root,
    invocation.ownerSession,
    expected,
    checked.update,
    invocation.now,
  );
  return {
    advanced: result.ok,
    reason: result.ok ? 'advanced' : result.reason,
    lease: result.lease ?? null,
  };
}

export async function finishAdapterWait(
  root,
  invocation,
  expected,
  diagnostic = 'wait-timeout',
) {
  const input = validateAdapterInvocation(invocation);
  const lease = await readLease(root, input.ownerSession);
  if (!lease)
    return {
      finished: false,
      reason: 'missing',
      lease: null,
    };
  if (
    lease.runtime !== input.runtime ||
    lease.peerRuntime !== input.peerRuntime ||
    lease.peerSession !== input.peerSession ||
    lease.ownerCwd !== input.cwd ||
    lease.peerTranscript !== input.transcript
  )
    return { finished: false, reason: 'identity-mismatch', lease };
  const result = await finishLeaseWait(
    root,
    input.ownerSession,
    expected,
    diagnostic,
    input.now,
  );
  return {
    finished: result.ok,
    reason: result.ok ? diagnostic : result.reason,
    lease: result.lease ?? null,
  };
}

/**
 * @param {import('./lease-state.mjs').LeaseUpdate | null | undefined} completion
 */
export async function claimAdapterTrigger(
  root,
  invocation,
  expected,
  completion,
) {
  const inspected = await inspectAdapterLease(root, invocation);
  if (!inspected.eligible)
    return {
      triggered: false,
      reason: inspected.reason,
      lease: inspected.lease,
    };
  if (
    !completion ||
    !Number.isSafeInteger(completion.peerCursor) ||
    completion.peerCursor <= expected.peerCursor
  ) {
    return { triggered: false, reason: 'no-advance', lease: inspected.lease };
  }
  const checked = await validateCursorUpdate(
    inspected.lease,
    invocation.transcript,
    completion,
  );
  if (!checked.ok)
    return {
      triggered: false,
      reason: checked.reason,
      lease: inspected.lease,
    };
  const result = await compareAndSwapTrigger(
    root,
    invocation.ownerSession,
    expected,
    checked.update,
    invocation.now,
  );
  return {
    triggered: result.ok,
    reason: result.ok ? 'triggered' : result.reason,
    lease: result.lease ?? null,
  };
}
