import { randomUUID } from 'node:crypto';
import path from 'node:path';

import type {
  ProviderAdapter,
  ProviderSessionObservation,
} from './adapters.js';
import { redactedRuntimePolicyDiagnostics } from './runtime-policy.js';
import type {
  ConsensusCliRunRequest,
  ContinuationMode,
  ContinuationReceipt,
  ContinuationTurnState,
  ProviderErrorCode,
} from './types.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Provider failures that reject a turn before it is accepted. Anything else
// after spawn (timeout, signal, unknown nonzero exit) is ambiguous.
const NOT_STARTED_FAILURE_CODES: readonly ProviderErrorCode[] = [
  'PROVIDER_MISSING',
  'PROVIDER_AUTH_REQUIRED',
  'PROVIDER_UNSUPPORTED_OPTION',
  'PROVIDER_SESSION_NOT_FOUND',
];

export function isProviderSessionId(value: string) {
  return UUID_PATTERN.test(value);
}

export function continuationMode(
  request: ConsensusCliRunRequest,
): ContinuationMode {
  return request.continuation?.mode ?? 'new';
}

// Returns a usage message for contradictory or unsafe continuation requests.
export function continuationUsageError(
  request: ConsensusCliRunRequest,
): string | undefined {
  const continuation = request.continuation;
  if (!continuation) return undefined;
  const { mode } = continuation;

  if (continuation.round !== undefined) {
    if (!Number.isInteger(continuation.round) || continuation.round < 1) {
      return 'Continuation round must be a positive integer.';
    }
    if (mode === 'new' && continuation.round !== 1) {
      return 'A new consultation starts at round 1; use --resume or --continuation reconstructed for later rounds.';
    }
    if (mode !== 'new' && continuation.round < 2) {
      return 'A continuation round must be 2 or greater.';
    }
  }
  if (
    continuation.consultation_id !== undefined &&
    continuation.consultation_id.trim() === ''
  ) {
    return 'Continuation consultation_id must be a non-empty string.';
  }
  if (mode !== 'native-resume') {
    if (continuation.session_id !== undefined) {
      return `A ${mode} run cannot target an existing session; use --resume for native resume.`;
    }
    if (
      continuation.fallback !== undefined ||
      continuation.fallback_prompt !== undefined
    ) {
      return 'Resume fallback options apply only to native resume (--resume).';
    }
  }
  if (mode === 'new' && continuation.previous_session_id !== undefined) {
    return 'A predecessor session implies a continuation; use --continuation reconstructed.';
  }
  if (
    mode === 'reconstructed' &&
    continuation.previous_session_id !== undefined &&
    continuation.previous_session_id.trim() === ''
  ) {
    return 'Previous session id must be a non-empty string.';
  }
  if (mode !== 'native-resume') return undefined;

  if (!continuation.session_id) {
    return 'Native resume requires an explicit provider session id.';
  }
  if (!isProviderSessionId(continuation.session_id)) {
    return 'Native resume requires a provider session UUID; titles, names, and "latest" selectors are not accepted.';
  }
  if (continuation.previous_session_id !== undefined) {
    return 'Native resume continues the --resume session itself; --previous-session applies only to reconstructed continuation.';
  }
  if ((request.max_attempts ?? 1) > 1) {
    return 'Native resume is single-attempt: a failed or malformed turn may already be recorded in the session, so the wrapper never resubmits it.';
  }
  const fallback = continuation.fallback ?? 'error';
  const fallbackPrompt = continuation.fallback_prompt;
  if (fallback === 'error' && fallbackPrompt !== undefined) {
    return 'A fallback prompt requires --resume-fallback reconstructed.';
  }
  if (fallback === 'reconstructed') {
    if (!fallbackPrompt || fallbackPrompt.trim() === '') {
      return 'Reconstructed fallback requires a continuation packet (--fallback-prompt-file).';
    }
    if (fallbackPrompt.trim() === request.prompt.trim()) {
      return 'The fallback continuation packet must carry reconstructed context, not repeat the native follow-up prompt.';
    }
  }
  return undefined;
}

// Canonical disclosure for every reconstructed continuation. The wrapper adds
// it so a new session is never presented as retained provider memory.
export function reconstructedContinuationPrompt(
  packet: string,
  fallbackReason?: string,
) {
  return [
    'Continuation notice (added by the consensus wrapper):',
    '- This is a NEW provider session. You have no memory of earlier rounds, and no earlier transcript is available to you.',
    '- The host reconstructed the context below from earlier rounds. It is a summary, may be incomplete, and is not the original transcript.',
    ...(fallbackReason
      ? [
          `- A native resume of the earlier session was requested but unavailable (${fallbackReason}).`,
        ]
      : []),
    '- Judge the current candidate on its merits. Name material blockers, explain any disagreement, and state whether the exact candidate is acceptable. You are not obligated to agree.',
    '',
    packet,
  ].join('\n');
}

export function turnStateFor(trace: ProviderTurnTrace): ContinuationTurnState {
  if (!trace.process) return 'not_started';
  if (trace.process.ok) return 'completed';
  // Any provider stdout (a session event, a partial result, or unparseable
  // output) means the turn may have been accepted, whatever the failure text
  // says.
  if (
    trace.process.stdout.trim() === '' &&
    trace.failure_code &&
    NOT_STARTED_FAILURE_CODES.includes(trace.failure_code)
  ) {
    return 'not_started';
  }
  return 'unknown';
}

export interface ProviderTurnTrace {
  process?: { ok: boolean; stdout: string };
  failure_code?: ProviderErrorCode;
}

export function continuationReceipt(input: {
  request: ConsensusCliRunRequest;
  adapter?: ProviderAdapter;
  mode: ContinuationMode;
  consultationId: string;
  trace: ProviderTurnTrace;
  fallbackReason?: string;
}): ContinuationReceipt {
  const { request, adapter, mode, trace } = input;
  const observation: ProviderSessionObservation =
    adapter && trace.process
      ? adapter.extractSession(trace.process.stdout)
      : {};
  const continuation = request.continuation;
  const round =
    continuation?.round ??
    (mode === 'new' && !input.fallbackReason ? 1 : undefined);

  return {
    mode,
    provider: request.provider,
    ...(observation.session_id ? { session_id: observation.session_id } : {}),
    ...(continuation?.mode === 'native-resume' && continuation.session_id
      ? { requested_session_id: continuation.session_id }
      : {}),
    ...(mode === 'reconstructed' && previousSessionId(request)
      ? { previous_session_id: previousSessionId(request) }
      : {}),
    consultation_id: input.consultationId,
    ...(round !== undefined ? { round } : {}),
    cwd: path.resolve(request.cwd ?? process.cwd()),
    ...(request.model ? { requested_model: request.model } : {}),
    ...(request.effort ? { requested_effort: request.effort } : {}),
    ...(observation.observed_models
      ? { observed_models: observation.observed_models }
      : {}),
    runtime_policy: redactedRuntimePolicyDiagnostics(request.runtime_policy),
    turn: turnStateFor(trace),
    ...(input.fallbackReason ? { fallback_reason: input.fallbackReason } : {}),
    ...(adapter?.capabilities.continuation
      ? { capability: adapter.capabilities.continuation }
      : {}),
  };
}

export function consultationIdFor(request: ConsensusCliRunRequest) {
  return request.continuation?.consultation_id ?? randomUUID();
}

// A fallback from native resume records the session it could not resume as
// the predecessor.
function previousSessionId(request: ConsensusCliRunRequest) {
  const continuation = request.continuation;
  if (!continuation) return undefined;
  return continuation.mode === 'native-resume'
    ? continuation.session_id
    : continuation.previous_session_id;
}
