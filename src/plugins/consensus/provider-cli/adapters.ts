import {
  buildClaudeInvocation,
  buildCodexInvocation,
  buildCursorInvocation,
} from './invocation.js';
import type { ProviderInvocationBuilder } from './invocation.js';
import type { ProviderProbeDefinition } from './probe.js';
import { isReliableExternalInterrupt } from './subprocess.js';
import type {
  FirstScopeProviderId,
  ProviderExitClassification,
  ProviderCapabilities,
  ProviderErrorCode,
  ProviderId,
  StructuredOutputStrategy,
} from './types.js';

export interface ProviderAdapter {
  id: FirstScopeProviderId;
  display_name: string;
  executable: string;
  probe: ProviderProbeDefinition;
  classifyRunFailure: ProviderRunFailureClassifier;
  buildInvocation: ProviderInvocationBuilder;
  extractSession: ProviderSessionExtractor;
  capabilities: ProviderCapabilities;
}

export interface ProviderSessionObservation {
  session_id?: string;
  observed_models?: string[];
}

// Reads provider machine output (JSON result or JSONL events). Never inspects
// model-authored text, and never looks up a "latest" session.
export type ProviderSessionExtractor = (
  stdout: string,
) => ProviderSessionObservation;

export interface ProviderAdapterRegistry {
  list(): ProviderAdapter[];
  get(id: ProviderId): ProviderAdapter | undefined;
}

export interface ProviderRunFailureInput {
  code: Extract<
    ProviderErrorCode,
    | 'PROVIDER_MISSING'
    | 'PROVIDER_EXIT'
    | 'PROVIDER_TIMEOUT'
    | 'PROVIDER_OUTPUT_CAP_EXCEEDED'
  >;
  message: string;
  retryable: boolean;
  stdout: string;
  stderr: string;
  exit_code: number | null;
  signal: string | null;
}

export interface ProviderRunFailureClassification {
  code: ProviderErrorCode;
  message: string;
  retryable: boolean;
  terminal_reason: string;
  exit_classification: ProviderExitClassification;
}

export type ProviderRunFailureClassifier = (
  failure: ProviderRunFailureInput,
) => ProviderRunFailureClassification;

const COMMON_AUTH_REQUIRED_PATTERNS = [
  /auth(?:entication)? required/i,
  /not logged in/i,
  /login required/i,
  /keychain.*locked/i,
] as const;

const COMMON_UNAVAILABLE_PATTERNS = [
  /unsupported platform/i,
  /not configured/i,
] as const;

const COMMON_UNSUPPORTED_OPTION_PATTERNS = [
  /unknown (?:option|flag|argument)/i,
  /unrecognized (?:option|flag|argument)/i,
  /unsupported (?:option|flag|argument)/i,
  /invalid (?:option|flag|argument)/i,
] as const;

const CLAUDE_SESSION_NOT_FOUND_PATTERNS = [
  // Evidence: Claude Code 2.1.284 `--print --resume <unknown-uuid>` exits 1
  // with this message (live check, 2026-09-28).
  /No conversation found with session ID/i,
] as const;

const CODEX_SESSION_NOT_FOUND_PATTERNS = [
  // Evidence: codex-cli 0.157.1 `exec resume <unknown-uuid> -` exits 1 with
  // "thread/resume failed: no rollout found for thread id" (live check,
  // 2026-09-28).
  /no rollout found for thread id/i,
] as const;

const COMMON_TRANSIENT_EXIT_PATTERNS = [
  /\b429\b/i,
  /rate limit/i,
  /temporar(?:y|ily) unavailable/i,
  /try again/i,
  /econnreset/i,
  /etimedout/i,
] as const;

const CLAUDE_TRANSIENT_EXIT_PATTERNS = [
  // Evidence: Claude Code error reference documents this exact repeated 529
  // overload message as temporary capacity exhaustion:
  // https://code.claude.com/docs/en/errors
  /API Error: Repeated 529 Overloaded errors/i,
] as const;

const CODEX_TRANSIENT_EXIT_PATTERNS = [
  // Evidence: installed codex-cli 0.142.5 binary strings include these
  // rate-limit and overload messages in provider-facing error paths.
  /rate limiter has requested a/i,
  /failed to fetch codex rate limits/i,
  /unknown rate limit reached type/i,
  /dropping overload response for connection/i,
  /try again at/i,
] as const;

const CURSOR_TRANSIENT_EXIT_PATTERNS = [
  // Evidence: installed cursor-agent 2026.07.01 bundle contains these
  // connection/session terminal reasons and network errors.
  /connection_timeout/i,
  /stream_error/i,
  /session_error/i,
  /session_aborted/i,
  /network error/i,
] as const;

export const DEFAULT_PROVIDER_ADAPTERS: readonly ProviderAdapter[] = [
  {
    id: 'claude',
    display_name: 'Claude',
    executable: 'claude',
    buildInvocation: buildClaudeInvocation,
    extractSession: extractJsonResultSession,
    classifyRunFailure: defaultRunFailureClassifier({
      session_not_found_patterns: CLAUDE_SESSION_NOT_FOUND_PATTERNS,
      auth_required_patterns: COMMON_AUTH_REQUIRED_PATTERNS,
      unavailable_patterns: COMMON_UNAVAILABLE_PATTERNS,
      unsupported_option_patterns: COMMON_UNSUPPORTED_OPTION_PATTERNS,
      transient_exit_patterns: [
        ...COMMON_TRANSIENT_EXIT_PATTERNS,
        ...CLAUDE_TRANSIENT_EXIT_PATTERNS,
      ],
    }),
    probe: {
      version_args: ['--version'],
      // Release verification established the provider-validated run surface at
      // Claude Code 2.1.185 (RELEASING.md).
      minimum_version: '2.1.185',
      capabilities: {
        run: {
          args: ['--help'],
          required_output_patterns: [/--print\b/, /--output-format\b/],
        },
      },
      auth_required_patterns: COMMON_AUTH_REQUIRED_PATTERNS,
      unavailable_patterns: COMMON_UNAVAILABLE_PATTERNS,
    },
    capabilities: {
      schema_strategies: ['provider_validated', 'prompt_only'],
      output_modes: ['stdout_json'],
      options: {
        model: true,
        effort: 'effort',
        runtime_policy: {
          permission_modes: ['non-interactive', 'read-only'],
          env_allowlist: true,
        },
      },
      supports_submit_tool: false,
      supports_same_host_subprocess: true,
      supports_host_native_dispatch: false,
      continuation: {
        native_resume: 'verified',
        session_id_source: 'stdout_json.session_id',
        evidence:
          'Live same-session smoke 2026-09-28 with Claude Code 2.1.284: `--print --output-format json --json-schema --resume <uuid>` recalled an unseen marker, preserved session_id, model, and schema. `--resume` also accepts a session title, so the wrapper requires a UUID.',
      },
    },
  },
  {
    id: 'codex',
    display_name: 'Codex',
    executable: 'codex',
    buildInvocation: buildCodexInvocation,
    extractSession: extractCodexJsonlSession,
    classifyRunFailure: defaultRunFailureClassifier({
      session_not_found_patterns: CODEX_SESSION_NOT_FOUND_PATTERNS,
      auth_required_patterns: COMMON_AUTH_REQUIRED_PATTERNS,
      unavailable_patterns: COMMON_UNAVAILABLE_PATTERNS,
      unsupported_option_patterns: COMMON_UNSUPPORTED_OPTION_PATTERNS,
      transient_exit_patterns: [
        ...COMMON_TRANSIENT_EXIT_PATTERNS,
        ...CODEX_TRANSIENT_EXIT_PATTERNS,
      ],
    }),
    probe: {
      version_args: ['--version'],
      // Release verification established the provider-validated run surface at
      // Codex CLI 0.139.0 (RELEASING.md).
      minimum_version: '0.139.0',
      capabilities: {
        run: {
          args: ['exec', '--help'],
          required_output_patterns: [
            /--json\b/,
            /--output-last-message\b/,
            /--output-schema\b/,
          ],
        },
      },
      auth_required_patterns: COMMON_AUTH_REQUIRED_PATTERNS,
      unavailable_patterns: COMMON_UNAVAILABLE_PATTERNS,
    },
    capabilities: {
      schema_strategies: ['constrained_native', 'prompt_only'],
      output_modes: ['last_message_file'],
      options: {
        model: true,
        effort: 'reasoning_effort',
        runtime_policy: {
          permission_modes: ['non-interactive'],
          sandboxes: ['read-only', 'workspace-write'],
          approval_policies: ['never', 'on-request'],
          env_allowlist: true,
        },
      },
      supports_submit_tool: false,
      supports_same_host_subprocess: true,
      supports_host_native_dispatch: false,
      continuation: {
        native_resume: 'verified',
        session_id_source: 'jsonl.thread.started.thread_id',
        evidence:
          'Live same-session smoke 2026-09-28 with codex-cli 0.157.1: `exec resume --json --output-schema -c sandbox_mode=... <uuid> -` recalled an unseen marker with read-only sandbox and approval never. `exec resume` rejects `--sandbox`, and a non-UUID that matches no thread name silently starts a new thread, so the wrapper requires a UUID and verifies the returned thread_id.',
      },
    },
  },
  {
    id: 'cursor',
    display_name: 'Cursor',
    executable: 'cursor-agent',
    buildInvocation: buildCursorInvocation,
    extractSession: extractJsonResultSession,
    classifyRunFailure: defaultRunFailureClassifier({
      session_not_found_patterns: [],
      auth_required_patterns: [
        ...COMMON_AUTH_REQUIRED_PATTERNS,
        /credential.*locked/i,
      ],
      unavailable_patterns: COMMON_UNAVAILABLE_PATTERNS,
      unsupported_option_patterns: COMMON_UNSUPPORTED_OPTION_PATTERNS,
      transient_exit_patterns: [
        ...COMMON_TRANSIENT_EXIT_PATTERNS,
        ...CURSOR_TRANSIENT_EXIT_PATTERNS,
      ],
    }),
    probe: {
      version_args: ['--version'],
      // Release verification established the prompt-only run surface at the
      // 2026.06.19 Cursor agent build (RELEASING.md).
      minimum_version: '2026.6.19',
      capabilities: {
        run: {
          args: ['--help'],
          required_output_patterns: [/--output-format\b/, /--force\b/],
        },
      },
      auth_required_patterns: [
        ...COMMON_AUTH_REQUIRED_PATTERNS,
        /credential.*locked/i,
      ],
      unavailable_patterns: COMMON_UNAVAILABLE_PATTERNS,
    },
    capabilities: {
      schema_strategies: ['prompt_only', 'submit_tool_candidate'],
      output_modes: ['stdout_json'],
      options: {
        model: false,
        effort: null,
        runtime_policy: {
          permission_modes: ['non-interactive', 'read-only'],
          env_allowlist: true,
        },
      },
      supports_submit_tool: false,
      supports_same_host_subprocess: true,
      supports_host_native_dispatch: false,
      continuation: {
        native_resume: 'unverified',
        session_id_source: 'stdout_json.session_id',
        evidence:
          'Cursor documents `--resume [chatId]` and a JSON result `session_id`. Raw CLI resume passed a same-session marker smoke on 2026-09-29 (cursor-agent 2026.09.28, cursor-grok-4.6-high, `--print --mode ask --sandbox enabled`, run by the user because agent shells cannot read the Cursor login). During that smoke a transport reconnect replayed each resumed turn, so its result held two answers. The wrapper resume path is not implemented; a future one should require the read-only policy (`--trust --mode ask --sandbox enabled`), not the default `--force`.',
      },
    },
  },
];

export function providerRegistry(
  adapters: readonly ProviderAdapter[] = DEFAULT_PROVIDER_ADAPTERS,
): ProviderAdapterRegistry {
  const byId = new Map<ProviderId, ProviderAdapter>();
  for (const adapter of adapters) byId.set(adapter.id, adapter);

  return {
    list() {
      return [...adapters];
    },
    get(id) {
      return byId.get(id);
    },
  };
}

export function defaultSchemaStrategy(
  adapter: ProviderAdapter,
): StructuredOutputStrategy {
  return (
    adapter.capabilities.schema_strategies.find(
      (strategy) => strategy !== 'submit_tool_candidate',
    ) ?? 'prompt_only'
  );
}

interface RunFailureClassifierPatterns {
  session_not_found_patterns: readonly RegExp[];
  auth_required_patterns: readonly RegExp[];
  unavailable_patterns: readonly RegExp[];
  unsupported_option_patterns: readonly RegExp[];
  transient_exit_patterns: readonly RegExp[];
}

function defaultRunFailureClassifier(
  patterns: RunFailureClassifierPatterns,
): ProviderRunFailureClassifier {
  return (failure) => {
    if (failure.code !== 'PROVIDER_EXIT') {
      return {
        code: failure.code,
        message: failure.message,
        retryable: failure.retryable,
        terminal_reason: terminalReasonForNonExitFailure(failure.code),
        exit_classification: 'terminal',
      };
    }

    const output = `${failure.stdout}\n${failure.stderr}\n${failure.message}`;
    const outputLine = firstNonEmptyLine(output);
    if (isReliableExternalInterrupt(failure)) {
      return {
        code: 'PROVIDER_EXIT',
        message: `Provider subprocess was interrupted by signal ${failure.signal}.`,
        retryable: true,
        terminal_reason: 'provider_exit_interrupted',
        exit_classification: 'interrupted',
      };
    }

    // Checked before auth: an unknown session is a definitive pre-turn
    // rejection, which is what makes a reconstructed fallback safe. Both CLIs
    // print it to stderr with empty stdout; any stdout means the turn may have
    // started, so peer text quoting the phrase never counts as a rejection.
    if (
      failure.stdout.trim() === '' &&
      matchesAny(failure.stderr, patterns.session_not_found_patterns)
    ) {
      return {
        code: 'PROVIDER_SESSION_NOT_FOUND',
        message: outputLine ?? 'Provider could not find the requested session.',
        retryable: false,
        terminal_reason: 'provider_session_not_found',
        exit_classification: 'terminal',
      };
    }

    if (matchesAny(output, patterns.auth_required_patterns)) {
      return {
        code: 'PROVIDER_AUTH_REQUIRED',
        message: outputLine ?? 'Provider authentication is required.',
        retryable: false,
        terminal_reason: 'provider_auth_required',
        exit_classification: 'terminal',
      };
    }

    if (matchesAny(output, patterns.unsupported_option_patterns)) {
      return {
        code: 'PROVIDER_UNSUPPORTED_OPTION',
        message: outputLine ?? 'Provider rejected an unsupported option.',
        retryable: false,
        terminal_reason: 'provider_unsupported_option',
        exit_classification: 'terminal',
      };
    }

    if (matchesAny(output, patterns.unavailable_patterns)) {
      return {
        code: 'PROVIDER_EXIT',
        message: outputLine ?? failure.message,
        retryable: false,
        terminal_reason: 'provider_unavailable_exit',
        exit_classification: 'terminal',
      };
    }

    if (matchesAny(output, patterns.transient_exit_patterns)) {
      return {
        code: 'PROVIDER_EXIT',
        message: outputLine ?? failure.message,
        retryable: true,
        terminal_reason: 'provider_exit_transient',
        exit_classification: 'transient',
      };
    }

    return {
      code: 'PROVIDER_EXIT',
      message: outputLine ?? failure.message,
      retryable: false,
      terminal_reason: 'provider_exit_terminal',
      exit_classification: 'unknown',
    };
  };
}

export function extractJsonResultSession(
  stdout: string,
): ProviderSessionObservation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch {
    return {};
  }
  if (!isRecord(parsed)) return {};
  const observation: ProviderSessionObservation = {};
  if (typeof parsed.session_id === 'string' && parsed.session_id) {
    observation.session_id = parsed.session_id;
  }
  if (isRecord(parsed.modelUsage)) {
    const models = Object.keys(parsed.modelUsage);
    if (models.length > 0) observation.observed_models = models;
  }
  return observation;
}

export function extractCodexJsonlSession(
  stdout: string,
): ProviderSessionObservation {
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    let event: unknown;
    try {
      event = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (
      isRecord(event) &&
      event.type === 'thread.started' &&
      typeof event.thread_id === 'string' &&
      event.thread_id
    ) {
      return { session_id: event.thread_id };
    }
  }
  return {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function terminalReasonForNonExitFailure(
  code: Exclude<ProviderRunFailureInput['code'], 'PROVIDER_EXIT'>,
) {
  if (code === 'PROVIDER_MISSING') return 'provider_missing';
  if (code === 'PROVIDER_TIMEOUT') return 'provider_timeout';
  return 'output_cap_exceeded';
}

function matchesAny(value: string, patterns: readonly RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

function firstNonEmptyLine(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
}
