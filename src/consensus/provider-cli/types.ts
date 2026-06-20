export const FIRST_SCOPE_PROVIDER_IDS = ['claude', 'codex', 'cursor'] as const;

export type FirstScopeProviderId = (typeof FIRST_SCOPE_PROVIDER_IDS)[number];

export type ProviderId = FirstScopeProviderId | (string & {});

export const HOST_RUNTIMES = [
  'claude',
  'codex',
  'cursor',
  'unknown',
] as const;

export type HostRuntime = (typeof HOST_RUNTIMES)[number];

export interface HostContext {
  runtime: HostRuntime;
  cwd: string;
  run_id: string;
  depth: number;
  max_depth: number;
}

export const STRUCTURED_OUTPUT_STRATEGIES = [
  'constrained_native',
  'provider_validated',
  'prompt_only',
  'submit_tool_candidate',
] as const;

export type StructuredOutputStrategy =
  (typeof STRUCTURED_OUTPUT_STRATEGIES)[number];

export const OUTPUT_MODES = [
  'stdout_json',
  'json_envelope',
  'last_message_file',
  'sidecar_file',
] as const;

export type OutputMode = (typeof OUTPUT_MODES)[number];

export type ProviderEffortOption = 'effort' | 'reasoning_effort' | null;

export interface ProviderRuntimePolicyCapabilities {
  permission_modes?: string[];
  sandboxes?: string[];
  approval_policies?: string[];
  env_allowlist: boolean;
}

export interface ProviderOptionCapabilities {
  model: boolean;
  effort: ProviderEffortOption;
  runtime_policy: ProviderRuntimePolicyCapabilities;
}

export interface ProviderCapabilities {
  schema_strategies: StructuredOutputStrategy[];
  output_modes: OutputMode[];
  options: ProviderOptionCapabilities;
  supports_submit_tool: boolean;
  supports_same_host_subprocess: boolean;
  supports_host_native_dispatch: boolean;
  future_extension_kind?:
    | 'custom_command'
    | 'openai_compatible_base_url'
    | 'acp_like';
}

export const FIRST_SCOPE_HOST_NATIVE_DISPATCH = {
  supported: false,
  reserved: true,
} as const;

export interface ProviderInventoryEntry {
  id: ProviderId;
  status:
    | 'ready'
    | 'missing'
    | 'unavailable'
    | 'auth_required'
    | 'unsupported';
  executable?: string;
  version?: string;
  capabilities: ProviderCapabilities;
  host_relation?: 'different_host' | 'same_host' | 'unknown';
  guard?:
    | 'none'
    | 'subprocess_isolated'
    | 'host_native_safe_packet_required'
    | 'blocked';
  diagnostics?: ProviderDiagnostics;
}

export interface ProviderRuntimePolicy {
  permission_mode?: string;
  sandbox?: string;
  approval_policy?: string;
  env_allowlist?: string[];
}

export interface ConsensusCliRunRequest {
  schema_version: 'v1';
  provider: ProviderId;
  schema_path: string;
  prompt: string;
  cwd?: string;
  host?: HostContext;
  model?: string;
  effort?: string;
  runtime_policy?: ProviderRuntimePolicy;
  max_attempts?: number;
  max_runtime_sec?: number;
  max_output_bytes?: number;
  redaction?: {
    include_args?: boolean;
    include_stderr?: boolean;
  };
}

export interface AttemptSummary {
  cli_attempts: number;
  provider_internal_attempts?: number | 'unknown';
  terminal_reason?: string;
  retryable: boolean;
}

export interface ProviderDiagnostics {
  strategy_used?: StructuredOutputStrategy;
  output_mode?: OutputMode;
  host_relation?: 'different_host' | 'same_host' | 'unknown';
  guard?:
    | 'none'
    | 'subprocess_isolated'
    | 'host_native_safe_packet_required'
    | 'blocked';
  redacted_command?: string[];
  provider_exit_code?: number | null;
  provider_signal?: string | null;
  output_bytes?: {
    stdout?: number;
    stderr?: number;
    max?: number;
  };
  timeout_sec?: number;
  warnings?: string[];
}

export const PROVIDER_ERROR_CODES = [
  'PROVIDER_MISSING',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_AUTH_REQUIRED',
  'PROVIDER_UNSUPPORTED',
  'PROVIDER_UNSUPPORTED_OPTION',
  'PROVIDER_EXIT',
  'PROVIDER_INVALID_JSON',
  'PROVIDER_SCHEMA_VALIDATION',
  'PROVIDER_TIMEOUT',
  'PROVIDER_OUTPUT_CAP_EXCEEDED',
  'HOST_RECURSION_BLOCKED',
  'CONSENSUS_CLI_USAGE',
] as const;

export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[number];

export interface ConsensusCliRunSuccess {
  schema_version: 'v1';
  ok: true;
  provider: ProviderId;
  args: string[];
  stdout: string;
  stderr?: string;
  json: unknown;
  attempts: AttemptSummary;
  diagnostics?: ProviderDiagnostics;
}

export interface ConsensusCliRunFailure {
  schema_version: 'v1';
  ok: false;
  provider?: ProviderId;
  code: ProviderErrorCode;
  message: string;
  retryable: boolean;
  attempts: AttemptSummary;
  stdout?: string;
  stderr?: string;
  diagnostics?: ProviderDiagnostics;
}

export type ConsensusCliRunEnvelope =
  | ConsensusCliRunSuccess
  | ConsensusCliRunFailure;
