import type {
  FirstScopeProviderId,
  ProviderExitClassification,
  ProviderCapabilities,
  ProviderErrorCode,
  ProviderId,
  StructuredOutputStrategy,
} from './types.js';
import type { ProviderProbeDefinition } from './probe.js';
import {
  buildClaudeInvocation,
  buildCodexInvocation,
  buildCursorInvocation,
} from './invocation.js';
import { isReliableExternalInterrupt } from './subprocess.js';
import type { ProviderInvocationBuilder } from './invocation.js';

export interface ProviderAdapter {
  id: FirstScopeProviderId;
  display_name: string;
  executable: string;
  probe: ProviderProbeDefinition;
  classifyRunFailure: ProviderRunFailureClassifier;
  buildInvocation: ProviderInvocationBuilder;
  capabilities: ProviderCapabilities;
}

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
    classifyRunFailure: defaultRunFailureClassifier({
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
    },
  },
  {
    id: 'codex',
    display_name: 'Codex',
    executable: 'codex',
    buildInvocation: buildCodexInvocation,
    classifyRunFailure: defaultRunFailureClassifier({
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
    },
  },
  {
    id: 'cursor',
    display_name: 'Cursor',
    executable: 'cursor-agent',
    buildInvocation: buildCursorInvocation,
    classifyRunFailure: defaultRunFailureClassifier({
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
          permission_modes: ['non-interactive'],
          env_allowlist: true,
        },
      },
      supports_submit_tool: false,
      supports_same_host_subprocess: true,
      supports_host_native_dispatch: false,
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
