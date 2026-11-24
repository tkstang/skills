// The normalized result of one ACP turn, its serialized form (what an ACP
// adapter puts in ProviderProcessResult.stdout), and the pure classification
// of that result into success or a provider failure. Raw frames never appear
// here: only answer text, identifying metadata, sanitized denials, and
// redacted error text.
import type { ProviderErrorCode } from '../types.js';
import { isRecord } from './jsonrpc.js';
import type { AcpPermissionDenial } from './responder.js';

export const ACP_TURN_RESULT_SCHEMA = 'consensus.acp-turn.v1';

// The furthest phase the session reached.
export type AcpPhase =
  | 'spawn'
  | 'initialize'
  | 'authenticate'
  | 'session_new'
  | 'setup'
  | 'prompt'
  | 'complete';

// `mode_changed`: the agent reported leaving the confirmed read-only mode
// while the prompt was in flight.
export type AcpAbortReason =
  | 'timeout'
  | 'output_cap'
  | 'interrupt'
  | 'mode_changed';

export interface AcpSetupEvidence {
  step: 'mode' | 'config_option' | 'model_state';
  id: string;
  value: string;
  confirmed: boolean;
  // What confirmed it; absent when unconfirmed.
  evidence?:
    | 'initial_state'
    | 'current_mode_update'
    | 'config_option_update'
    | 'marker'
    | 'response'
    | 'session_state';
}

export interface AcpTurnError {
  phase: AcpPhase;
  kind:
    | 'spawn'
    | 'jsonrpc'
    | 'unsupported_option'
    | 'unconfirmed_setup'
    | 'agent_exit'
    | 'malformed'
    // consensus's own client failed (a stdin write threw, or a bug).
    | 'client_error';
  // JSON-RPC error code, for kind `jsonrpc`.
  code?: number;
  // Redacted.
  message: string;
  // Errno for kind `spawn` (ENOENT, EACCES, E2BIG).
  errno?: string;
}

export interface AcpTurnResult {
  schema: typeof ACP_TURN_RESULT_SCHEMA;
  agent?: { name?: string; title?: string; version?: string };
  session_id?: string;
  phase: AcpPhase;
  prompt_sent: boolean;
  // stopReason of the session/prompt response to our request.
  stop_reason?: string;
  // agent_message_chunk text after the prompt was sent, for our session.
  text: string;
  denials: AcpPermissionDenial[];
  // Agent->client methods refused with -32601 (fs/*, terminal/*, unknown).
  refused_methods: string[];
  usage?: Record<string, number>;
  models: {
    // session/new models.currentModelId.
    current_model_id?: string;
    // configOptions `model` currentValue, latest seen.
    config_model?: string;
    // session/prompt _meta.quota.model_usage[].model.
    usage_models?: string[];
  };
  setup: AcpSetupEvidence[];
  error?: AcpTurnError;
  abort?: AcpAbortReason;
  // The mode the agent reported after the read-only mode was confirmed.
  mode_drift?: string;
  cancel_sent?: boolean;
  session_closed?: boolean;
  // stdout lines that were not JSON-RPC messages.
  ignored_lines?: number;
}

export function emptyTurnResult(): AcpTurnResult {
  return {
    schema: ACP_TURN_RESULT_SCHEMA,
    phase: 'spawn',
    prompt_sent: false,
    text: '',
    denials: [],
    refused_methods: [],
    models: {},
    setup: [],
  };
}

export function serializeAcpTurnResult(result: AcpTurnResult): string {
  return JSON.stringify(result);
}

// Parses adapter stdout back into a turn result. Anything that is not a
// serialized AcpTurnResult yields undefined, so hooks never mistake other
// output for a transcript.
export function parseAcpTurnResult(stdout: string): AcpTurnResult | undefined {
  let value: unknown;
  try {
    value = JSON.parse(stdout);
  } catch {
    return undefined;
  }
  if (
    !isRecord(value) ||
    value.schema !== ACP_TURN_RESULT_SCHEMA ||
    typeof value.text !== 'string' ||
    typeof value.prompt_sent !== 'boolean' ||
    typeof value.phase !== 'string' ||
    !Array.isArray(value.denials) ||
    !Array.isArray(value.refused_methods) ||
    !Array.isArray(value.setup) ||
    !isRecord(value.models)
  ) {
    return undefined;
  }
  return value as unknown as AcpTurnResult;
}

// Credential shapes redacted from every error message and stderr capture.
const DEFAULT_REDACTIONS: readonly RegExp[] = [
  /AIza[0-9A-Za-z_-]{20,}/g,
  /\b(?:sk|fk|pk|ghp|gho|ghs|github_pat|xox[a-z])[-_][A-Za-z0-9_-]{12,}/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /\bBearer\s+[A-Za-z0-9._~+/-]{12,}=*/gi,
];
const MIN_SECRET_VALUE_CHARS = 6;
export const REDACTED = '<redacted>';

// Replaces each pattern match and each literal secret value. Patterns come
// from the descriptor (for example Droid's pairing code); secret values are
// the credential env values the child received.
export function redactText(
  text: string,
  options: {
    patterns?: readonly RegExp[];
    secretValues?: readonly string[];
  } = {},
): string {
  let redacted = redactSecretValues(text, options.secretValues);
  for (const pattern of [...DEFAULT_REDACTIONS, ...(options.patterns ?? [])]) {
    redacted = redacted.replace(globalPattern(pattern), REDACTED);
  }
  return redacted;
}

// Only the literal secret values: for answer text, which pattern redaction
// would mangle.
export function redactSecretValues(
  text: string,
  secretValues: readonly string[] = [],
): string {
  let redacted = text;
  for (const value of secretValues) {
    if (value.length < MIN_SECRET_VALUE_CHARS) continue;
    redacted = redacted.split(value).join(REDACTED);
  }
  return redacted;
}

// The result as it may leave the client: every agent-controlled string
// (metadata, ids, model names, denial fields, even object keys) gets full
// redaction. The answer text loses the literal secret values and the
// descriptor's own patterns (Droid's pairing code), which are narrow; the
// broad default credential shapes are not applied to it.
export function sanitizeTurnResult(
  result: AcpTurnResult,
  options: { patterns?: readonly RegExp[]; secretValues?: readonly string[] },
): AcpTurnResult {
  const redact = (text: string) => redactText(text, options);
  const walk = (value: unknown): unknown => {
    if (typeof value === 'string') return redact(value);
    if (Array.isArray(value)) return value.map(walk);
    if (isRecord(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [redact(key), walk(entry)]),
      );
    }
    return value;
  };
  const { schema, text, ...rest } = result;
  return {
    ...(walk(rest) as Omit<AcpTurnResult, 'schema' | 'text'>),
    schema,
    text: (options.patterns ?? []).reduce(
      (redacted, pattern) => redacted.replace(globalPattern(pattern), REDACTED),
      redactSecretValues(text, options.secretValues),
    ),
  };
}

function globalPattern(pattern: RegExp) {
  return pattern.global
    ? pattern
    : new RegExp(pattern.source, `${pattern.flags}g`);
}

// Failure codes a turn can classify to.
export type AcpFailureCode = Extract<
  ProviderErrorCode,
  | 'PROVIDER_MISSING'
  | 'PROVIDER_AUTH_REQUIRED'
  | 'PROVIDER_UNSUPPORTED_OPTION'
  | 'PROVIDER_EXIT'
  | 'PROVIDER_LIMIT_REACHED'
  | 'PROVIDER_EMPTY_OUTPUT'
  | 'PROVIDER_MALFORMED_RESULT'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_OUTPUT_CAP_EXCEEDED'
  | 'PROVIDER_ARGV_TOO_LARGE'
  | 'PROVIDER_PERMISSION_DENIED'
>;

export type AcpTurnClassification =
  | { ok: true; text: string; warnings: string[] }
  | {
      ok: false;
      code: AcpFailureCode;
      message: string;
      retryable: false;
      terminal_reason: string;
      // completed: the agent finished the turn, but the answer is unusable.
      turn: 'not_started' | 'unknown' | 'completed';
    };

export interface AcpClassifyOptions {
  // Shown in messages, e.g. "Antigravity".
  displayName?: string;
  // Extra auth-failure messages beyond JSON-RPC -32000 (agy's -32603 "No
  // browser is available").
  authErrorPatterns?: readonly RegExp[];
  // How to sign in, appended to auth failures.
  authHint?: string;
  // Appended to the message of a turn that timed out after the prompt.
  timeoutHint?: string;
  // Provider errors that arrive as answer text with end_turn; the first
  // matching pattern wins.
  errorTextPatterns?: readonly {
    pattern: RegExp;
    code: Extract<AcpFailureCode, 'PROVIDER_LIMIT_REACHED' | 'PROVIDER_EXIT'>;
  }[];
}

const AUTH_REQUIRED_CODE = -32000;

export function classifyAcpTurn(
  result: AcpTurnResult,
  options: AcpClassifyOptions = {},
): AcpTurnClassification {
  const name = options.displayName ?? result.agent?.name ?? 'The ACP agent';
  const startedTurn = result.prompt_sent ? 'unknown' : 'not_started';

  if (result.abort === 'timeout') {
    return failure(
      'PROVIDER_TIMEOUT',
      result.prompt_sent
        ? `${name} did not finish the turn before the deadline; the turn was cancelled.${options.timeoutHint ? ` ${options.timeoutHint}` : ''}`
        : `${name} did not finish starting the session before the deadline.`,
      'provider_timeout',
      startedTurn,
    );
  }
  if (result.abort === 'output_cap') {
    return failure(
      'PROVIDER_OUTPUT_CAP_EXCEEDED',
      `${name} exceeded the output cap.`,
      'output_cap_exceeded',
      startedTurn,
    );
  }
  if (result.abort === 'mode_changed') {
    return failure(
      'PROVIDER_EXIT',
      `${name} left read-only mode during the turn (now ${result.mode_drift ?? 'unknown'}); the turn was cancelled and its answer discarded.`,
      'acp_mode_changed',
      'unknown',
    );
  }
  if (result.abort === 'interrupt') {
    return failure(
      'PROVIDER_EXIT',
      `The ${name} run was interrupted by a signal sent to consensus.`,
      'provider_run_interrupted',
      startedTurn,
    );
  }

  const error = result.error;
  if (error) {
    if (error.kind === 'spawn') {
      return error.errno === 'E2BIG'
        ? failure(
            'PROVIDER_ARGV_TOO_LARGE',
            error.message,
            'provider_argv_too_large',
            'not_started',
          )
        : failure(
            'PROVIDER_MISSING',
            error.message,
            'provider_missing',
            'not_started',
          );
    }
    if (error.kind === 'unsupported_option') {
      return failure(
        'PROVIDER_UNSUPPORTED_OPTION',
        error.message,
        'provider_unsupported_option',
        'not_started',
      );
    }
    if (error.kind === 'unconfirmed_setup') {
      return failure(
        'PROVIDER_UNSUPPORTED_OPTION',
        `${name} did not confirm its read-only setup: ${error.message}`,
        'acp_setup_unconfirmed',
        'not_started',
      );
    }
    if (error.kind === 'jsonrpc' && isAuthError(error, options)) {
      const hint = options.authHint ? ` ${options.authHint}` : '';
      return failure(
        'PROVIDER_AUTH_REQUIRED',
        `${name} needs authentication: ${error.message}.${hint}`,
        'provider_auth_required',
        error.phase === 'prompt' ? 'unknown' : 'not_started',
      );
    }
    if (error.kind === 'client_error') {
      return failure(
        'PROVIDER_EXIT',
        `The consensus ACP client failed during ${error.phase}: ${error.message}`,
        'acp_client_error',
        startedTurn,
      );
    }
    if (error.kind === 'agent_exit') {
      return failure(
        'PROVIDER_EXIT',
        `${name} exited during ${error.phase}: ${error.message}`,
        'provider_exit_terminal',
        startedTurn,
      );
    }
    return failure(
      error.kind === 'malformed'
        ? 'PROVIDER_MALFORMED_RESULT'
        : 'PROVIDER_EXIT',
      `${name} failed during ${error.phase}: ${error.message}`,
      error.kind === 'malformed'
        ? 'acp_malformed_response'
        : 'acp_jsonrpc_error',
      error.phase === 'prompt' ? 'unknown' : 'not_started',
    );
  }

  if (!result.prompt_sent) {
    return failure(
      'PROVIDER_EXIT',
      `${name} ended before the prompt was sent.`,
      'acp_prompt_not_sent',
      'not_started',
    );
  }
  if (result.stop_reason === undefined) {
    return failure(
      'PROVIDER_EXIT',
      `${name} ended without answering the prompt.`,
      'acp_no_prompt_response',
      'unknown',
    );
  }

  const text = result.text;
  const blank = text.trim() === '';
  const denials = result.denials;

  if (result.stop_reason === 'end_turn') {
    for (const entry of options.errorTextPatterns ?? []) {
      if (entry.pattern.test(text)) {
        // Error text, not an answer: the default credential shapes come out
        // too (literal values and descriptor patterns already did), before
        // the line is shortened.
        return failure(
          entry.code,
          `${name} reported an error instead of an answer: ${firstLine(redactText(text))}`,
          entry.code === 'PROVIDER_LIMIT_REACHED'
            ? 'provider_limit_reached'
            : 'acp_error_text',
          'completed',
        );
      }
    }
    if (blank && denials.length > 0) return permissionDenied(name, denials);
    if (blank) {
      return failure(
        'PROVIDER_EMPTY_OUTPUT',
        `${name} ended the turn without answer text.`,
        'provider_empty_output',
        'completed',
      );
    }
    const warnings =
      denials.length > 0
        ? [
            `${name} asked for ${denials.length} tool permission(s) outside read-only; all were denied (${toolList(denials)}).`,
          ]
        : [];
    return { ok: true, text, warnings };
  }

  if (result.stop_reason === 'cancelled' && denials.length > 0) {
    return permissionDenied(name, denials);
  }
  if (
    result.stop_reason === 'max_tokens' ||
    result.stop_reason === 'max_turn_requests'
  ) {
    return failure(
      'PROVIDER_LIMIT_REACHED',
      `${name} stopped at a limit (${result.stop_reason}).`,
      'provider_limit_reached',
      'completed',
    );
  }
  return failure(
    'PROVIDER_EXIT',
    `${name} ended the turn with stop reason ${result.stop_reason}.`,
    'acp_stop_reason',
    'completed',
  );
}

function permissionDenied(
  name: string,
  denials: readonly AcpPermissionDenial[],
): AcpTurnClassification {
  return failure(
    'PROVIDER_PERMISSION_DENIED',
    `${name} tried to act outside read-only and was denied (${toolList(denials)}); the turn ended without an answer.`,
    'acp_permission_denied',
    'completed',
  );
}

function isAuthError(error: AcpTurnError, options: AcpClassifyOptions) {
  if (error.code === AUTH_REQUIRED_CODE) return true;
  return (options.authErrorPatterns ?? []).some((pattern) =>
    pattern.test(error.message),
  );
}

function toolList(denials: readonly AcpPermissionDenial[]) {
  const tools = [
    ...new Set(denials.map((denial) => denial.tool ?? denial.kind ?? 'tool')),
  ];
  return tools.join(', ');
}

function firstLine(text: string) {
  const line =
    text
      .split(/\r?\n/)
      .map((part) => part.trim())
      .find((part) => part !== '') ?? '';
  return line.length > 200 ? `${line.slice(0, 200)}…` : line;
}

function failure(
  code: AcpFailureCode,
  message: string,
  terminalReason: string,
  turn: 'not_started' | 'unknown' | 'completed',
): AcpTurnClassification {
  return {
    ok: false,
    code,
    message,
    retryable: false,
    terminal_reason: terminalReason,
    turn,
  };
}
