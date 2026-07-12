import {
  beginLeaseWait,
  compareAndSwapTrigger,
  effectiveLease,
  finishLeaseWait,
  readLease,
  validateAbsolutePath,
  validateId,
  validateOwnerRuntime,
  validatePeerRuntime,
} from './lease-state.mjs';

export const RUNTIME_ADAPTER_VERSION = 2;

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
    lease.ownerCwd !== input.cwd ||
    lease.peerTranscript !== input.transcript
  ) {
    return { eligible: false, reason: 'identity-mismatch', lease };
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
  const result = await beginLeaseWait(
    root,
    input.ownerSession,
    {
      runtime: input.runtime,
      peerRuntime: input.peerRuntime,
      peerSession: input.peerSession,
      ownerCwd: input.cwd,
      peerTranscript: input.transcript,
    },
    input.now,
  );
  return {
    waiting: result.ok,
    changed: result.ok && result.changed,
    reason: result.ok ? 'waiting' : result.reason,
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
  const result = await compareAndSwapTrigger(
    root,
    invocation.ownerSession,
    expected,
    completion,
    invocation.now,
  );
  return {
    triggered: result.ok,
    reason: result.ok ? 'triggered' : result.reason,
    lease: result.lease ?? null,
  };
}
