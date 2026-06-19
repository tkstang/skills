import type {
  AttemptSummary,
  ConsensusCliRunEnvelope,
  ConsensusCliRunFailure,
  ConsensusCliRunSuccess,
  ProviderDiagnostics,
  ProviderErrorCode,
  ProviderId,
} from './types.js';

export interface SuccessEnvelopeInput {
  provider: ProviderId;
  args: string[];
  stdout: string;
  stderr?: string;
  json: unknown;
  attempts?: Partial<AttemptSummary>;
  diagnostics?: ProviderDiagnostics;
}

export interface FailureEnvelopeInput {
  provider?: ProviderId;
  code: ProviderErrorCode;
  message: string;
  retryable: boolean;
  attempts?: Partial<AttemptSummary>;
  terminal_reason?: string;
  stdout?: string;
  stderr?: string;
  diagnostics?: ProviderDiagnostics;
}

export function successEnvelope(
  input: SuccessEnvelopeInput,
): ConsensusCliRunSuccess {
  const envelope: ConsensusCliRunSuccess = {
    schema_version: 'v1',
    ok: true,
    provider: input.provider,
    args: input.args,
    stdout: input.stdout,
    json: input.json,
    attempts: buildAttemptSummary(input.attempts, false),
  };

  if (input.stderr !== undefined) envelope.stderr = input.stderr;
  if (input.diagnostics) envelope.diagnostics = input.diagnostics;

  return envelope;
}

export function failureEnvelope(
  input: FailureEnvelopeInput,
): ConsensusCliRunFailure {
  const envelope: ConsensusCliRunFailure = {
    schema_version: 'v1',
    ok: false,
    code: input.code,
    message: input.message,
    retryable: input.retryable,
    attempts: buildAttemptSummary(
      {
        ...input.attempts,
        terminal_reason:
          input.terminal_reason ?? input.attempts?.terminal_reason,
      },
      input.retryable,
    ),
  };

  if (input.provider) envelope.provider = input.provider;
  if (input.stdout !== undefined) envelope.stdout = input.stdout;
  if (input.stderr !== undefined) envelope.stderr = input.stderr;
  if (input.diagnostics) envelope.diagnostics = input.diagnostics;

  return envelope;
}

export function usageFailure(
  message: string,
  details?: unknown,
): ConsensusCliRunFailure {
  const diagnostics: ProviderDiagnostics | undefined =
    details === undefined ? undefined : { warnings: [JSON.stringify(details)] };

  return failureEnvelope({
    code: 'CONSENSUS_CLI_USAGE',
    message,
    retryable: false,
    attempts: {
      cli_attempts: 0,
      terminal_reason: 'usage',
    },
    diagnostics,
  });
}

export function processExitForEnvelope(envelope: ConsensusCliRunEnvelope) {
  if (envelope.ok) return 0;
  if (envelope.code === 'CONSENSUS_CLI_USAGE') return 2;
  return 0;
}

function buildAttemptSummary(
  attempts: Partial<AttemptSummary> | undefined,
  retryable: boolean,
): AttemptSummary {
  return {
    cli_attempts: attempts?.cli_attempts ?? 1,
    ...(attempts?.provider_internal_attempts === undefined
      ? {}
      : { provider_internal_attempts: attempts.provider_internal_attempts }),
    ...(attempts?.terminal_reason === undefined
      ? {}
      : { terminal_reason: attempts.terminal_reason }),
    retryable,
  };
}
