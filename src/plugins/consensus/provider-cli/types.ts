export const FIRST_SCOPE_PROVIDER_IDS = ['claude', 'codex', 'cursor'] as const;

export type FirstScopeProviderId = (typeof FIRST_SCOPE_PROVIDER_IDS)[number];

export type ProviderId = FirstScopeProviderId | (string & {});

export const PROVIDER_PREFLIGHT_CAPABILITIES = ['run'] as const;

export type ProviderPreflightCapability =
  (typeof PROVIDER_PREFLIGHT_CAPABILITIES)[number];

export const HOST_RUNTIMES = ['claude', 'codex', 'cursor', 'unknown'] as const;

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
  // Free-form text: no schema, submit capture, or validation.
  'text',
] as const;

export type StructuredOutputStrategy =
  (typeof STRUCTURED_OUTPUT_STRATEGIES)[number];

// What a successful run returns: schema-validated JSON (the default) or the
// provider's final text.
export const RUN_OUTPUT_KINDS = ['json', 'text'] as const;

export type RunOutputKind = (typeof RUN_OUTPUT_KINDS)[number];

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

export const NATIVE_RESUME_STATUSES = [
  'verified',
  'unverified',
  'unsupported',
] as const;

export type NativeResumeStatus = (typeof NATIVE_RESUME_STATUSES)[number];

// Evidence levels stay distinct: documented by the provider, accepted by the
// installed CLI, and proven by a live same-session smoke through this wrapper.
// Only `verified` lets `consensus run --resume` reach the provider.
export interface ProviderContinuationCapability {
  native_resume: NativeResumeStatus;
  session_id_source: string;
  evidence: string;
}

export interface ProviderCapabilities {
  schema_strategies: StructuredOutputStrategy[];
  output_modes: OutputMode[];
  options: ProviderOptionCapabilities;
  supports_submit_tool: boolean;
  supports_same_host_subprocess: boolean;
  supports_host_native_dispatch: boolean;
  continuation?: ProviderContinuationCapability;
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
  status: 'ready' | 'missing' | 'unavailable' | 'auth_required' | 'unsupported';
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
  read_paths?: string[];
  edit_paths?: string[];
  // Claude `workspace-write` only: one `Bash(<pattern>)` rule each.
  bash_patterns?: string[];
  web_search?: boolean;
  web_fetch_domains?: string[];
}

export const CONTINUATION_MODES = [
  'new',
  'native-resume',
  'reconstructed',
] as const;

export type ContinuationMode = (typeof CONTINUATION_MODES)[number];

export const RESUME_FALLBACK_POLICIES = ['error', 'reconstructed'] as const;

export type ResumeFallbackPolicy = (typeof RESUME_FALLBACK_POLICIES)[number];

export interface ContinuationRequest {
  // `new` opens a consultation (round 1) under a caller-chosen consultation_id.
  mode: ContinuationMode;
  // native-resume: the exact provider session to continue. Never "latest".
  session_id?: string;
  // reconstructed: the predecessor provider session, when one exists.
  previous_session_id?: string;
  consultation_id?: string;
  round?: number;
  // native-resume only. `reconstructed` requires fallback_prompt.
  fallback?: ResumeFallbackPolicy;
  fallback_prompt?: string;
}

export interface ConsensusCliRunRequest {
  schema_version: 'v1';
  provider: ProviderId;
  // Defaults to `json`. `text` takes no schema.
  output?: RunOutputKind;
  // Required when `output` is `json`; rejected when it is `text`.
  schema_path?: string;
  prompt: string;
  cwd?: string;
  host?: HostContext;
  model?: string;
  effort?: string;
  runtime_policy?: ProviderRuntimePolicy;
  continuation?: ContinuationRequest;
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
  exit_classification?: ProviderExitClassification;
  verdict_source?: 'submit' | 'final_message';
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
  permission_denials?: {
    count: number;
    tools: string[];
  };
  permission_profile?: ProviderPermissionProfile;
  termination?: ProviderTermination;
}

// How a timed-out or capped provider run was stopped. `scope` is
// `process_group` on POSIX and `process` on Windows. `settled_by`:
// `sigterm` the group exited after SIGTERM; `sigkill` the escalation sent
// SIGKILL; `group_gone` the group had already exited (ESRCH);
// `settlement_timeout` the bound expired while the output pipes stayed open;
// `leader_exit` the single process exited (Windows).
export interface ProviderTermination {
  reason: 'timeout' | 'output_cap' | 'interrupt';
  scope: 'process_group' | 'process';
  signals: Array<'SIGTERM' | 'SIGKILL' | 'SIGINT' | 'SIGHUP'>;
  settled_by:
    | 'sigterm'
    | 'forwarded_signal'
    | 'sigkill'
    | 'group_gone'
    | 'settlement_timeout'
    | 'leader_exit';
}

// The provider permission controls one invocation applied. `mode` is the
// provider's own mode value, or `provider_default` when none was passed;
// absent `tools` means the provider's default tool set.
export interface ProviderPermissionProfile {
  mode: string;
  tools?: string[];
  allowed_tools?: string[];
}

export type ProviderExitClassification =
  | 'transient'
  | 'terminal'
  | 'unknown'
  | 'interrupted';

export const PROVIDER_ERROR_CODES = [
  'PROVIDER_MISSING',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_AUTH_REQUIRED',
  'PROVIDER_UNSUPPORTED',
  'PROVIDER_UNSUPPORTED_OPTION',
  'PROVIDER_EXIT',
  'PROVIDER_INVALID_JSON',
  'PROVIDER_SCHEMA_VALIDATION',
  'PROVIDER_EMPTY_OUTPUT',
  'PROVIDER_MALFORMED_RESULT',
  'PROVIDER_TIMEOUT',
  'PROVIDER_OUTPUT_CAP_EXCEEDED',
  'PROVIDER_ARGV_TOO_LARGE',
  'PROVIDER_SESSION_NOT_FOUND',
  'PROVIDER_SESSION_MISMATCH',
  'HOST_RECURSION_BLOCKED',
  'CONSENSUS_CLI_USAGE',
] as const;

export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[number];

// `not_started`: the provider never received the turn. `completed`: the
// provider process finished the turn (its output may still be unusable).
// `unknown`: the process started but ended ambiguously (timeout, signal,
// nonzero exit); do not resubmit before checking whether the turn landed.
export type ContinuationTurnState = 'not_started' | 'completed' | 'unknown';

export interface ContinuationReceipt {
  mode: ContinuationMode;
  provider: ProviderId;
  // Captured from provider machine output only, never from model text.
  session_id?: string;
  requested_session_id?: string;
  previous_session_id?: string;
  consultation_id: string;
  round?: number;
  cwd: string;
  requested_model?: string;
  requested_effort?: string;
  observed_models?: string[];
  runtime_policy?: ProviderRuntimePolicy;
  turn: ContinuationTurnState;
  fallback_reason?: string;
  capability?: ProviderContinuationCapability;
}

interface ConsensusCliRunSuccessBase {
  schema_version: 'v1';
  ok: true;
  provider: ProviderId;
  args: string[];
  stdout: string;
  stderr?: string;
  attempts: AttemptSummary;
  diagnostics?: ProviderDiagnostics;
  continuation?: ContinuationReceipt;
}

export interface ConsensusCliRunJsonSuccess extends ConsensusCliRunSuccessBase {
  output_kind: 'json';
  json: unknown;
}

export interface ConsensusCliRunTextSuccess extends ConsensusCliRunSuccessBase {
  output_kind: 'text';
  text: string;
  json: null;
}

// `output_kind` is an additive v1 discriminator.
export type ConsensusCliRunSuccess =
  | ConsensusCliRunJsonSuccess
  | ConsensusCliRunTextSuccess;

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
  continuation?: ContinuationReceipt;
}

export type ConsensusCliRunEnvelope =
  | ConsensusCliRunSuccess
  | ConsensusCliRunFailure;
