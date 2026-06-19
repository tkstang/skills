---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-19
oat_generated: false
oat_template: false
---

# Design: consensus-peer-invocation

> Working draft: this file is intentionally partial during selective design review. Only accepted sections are written here; remaining sections will be added as they are reviewed or silently accepted.

## Overview

The design replaces the current external peer invocation backend with a small owned `consensus` CLI boundary. The CLI is responsible for provider inventory, preflight, one-shot provider execution, provider-output validation, retry accounting, and provider-neutral diagnostics. The existing consensus loop remains the canonical deliberation engine for Refine and Evaluate.

The first consumers are Consensus Refine and Consensus Evaluate. Stoa and Open Agent Toolkit are contract pressures for the CLI shape, but their migration is not part of the first implementation. The CLI therefore exposes a provider-generic local executable contract rather than a plugin-private helper whose request and response shapes only understand verdict semantics.

Canonical implementation source remains TypeScript. Shipped runtime output remains dependency-free committed `.mjs`, built through the repo's generated-runtime pipeline. Runtime argument parsing should use Node standard library APIs such as `node:util.parseArgs`; CLI frameworks and runtime npm dependencies are out of scope.

## Architecture

### System Context

The CLI sits below the consensus loop and above provider subprocesses. Refine and Evaluate continue to build prompts, run the deliberation algorithm, validate verdict branch semantics, apply verdict caps, write audit records, and manage resume behavior. The new CLI owns the provider subprocess boundary and returns one normalized envelope per provider turn.

Stoa and future OAT consumers should be able to call the same executable for one-shot structured provider output without importing consensus plugin internals. Consensus-specific concepts such as iteration mode, convergence, verdict branch rules, and section retry remain outside the CLI.

**Key Components:**

- **Stable Consensus CLI Executable:** Provider-generic command surface for inventory, preflight, and one-shot runs.
- **Provider Adapter Registry:** First-scope adapters for Claude, Codex, and Cursor, each declaring command construction, readiness probes, output modes, and supported structured-output strategies.
- **Structured Output Coordinator:** Per-request strategy selector for constrained-native, provider-validated, prompt-only, and bounded submit-tool-candidate paths.
- **Host Runtime Guard:** Runtime identity and recursion-depth guard that permits intentional same-provider leaf subprocesses while preventing unbounded recursive self-spawn.
- **Consensus Integration Adapter:** Bridge from CLI envelopes back to the current `invokePeer` and `invokeSynthesizer` seams.
- **Generated Runtime Packaging:** Canonical TypeScript source plus generated dependency-free `.mjs` entrypoints with drift checks.

### Component Diagram

```text
Consensus Refine / Consensus Evaluate
        |
        v
Shared consensus-loop primitive
        |
        v
Consensus Integration Adapter
        |
        v
consensus CLI executable
        |
        +--> Provider Adapter Registry
        |       +--> claude adapter
        |       +--> codex adapter
        |       +--> cursor adapter
        |
        +--> Structured Output Coordinator
        +--> Host Runtime Guard
        +--> Attempt / Error Accounting
        |
        v
Provider CLI subprocess
```

### Data Flow

1. Refine or Evaluate selects a peer provider and builds the existing prompt for the current turn.
2. The consensus integration adapter invokes the new `consensus` CLI with provider, schema path, prompt, cwd, host context, and optional provider options such as model and effort.
3. The CLI resolves the provider adapter, runs preflight checks, applies the host runtime guard, and selects a structured-output strategy for the request/schema.
4. The adapter builds an argv array and launches the provider subprocess with bounded stdout/stderr capture.
5. The CLI parses and validates provider output against the selected schema subset, retrying provider-output reliability failures within its own attempt budget.
6. The CLI emits a versioned success or failure envelope with raw stdout/stderr, parsed JSON when available, attempt metadata, and safe diagnostics.
7. The integration adapter projects successful envelopes back into the existing peer invocation result shape.
8. The consensus loop normalizes the verdict, validates branch semantics and verdict caps, performs loop-level retry/classification when needed, and writes JSONL audit records.

### Retry Boundary

Retry behavior is deliberately split into tiers. Provider CLIs may perform their own internal repair or re-prompting; the new CLI records that as `provider_internal_attempts` when known. The CLI owns provider-output reliability retries: subprocess failures, invalid JSON, missing payload, schema-subset validation failures, and subprocess output cap failures. The consensus loop owns verdict-contract retries: `normalizeVerdict`, branch shape, verdict content caps, convergence, impasse, and section-level retry.

The CLI envelope must expose attempt counts and terminal reasons so the loop does not unknowingly multiply provider retry cost.

## Component Design

### Stable Consensus CLI Executable

**Purpose:** Provide a stable local executable boundary for provider inventory, preflight, and one-shot structured provider runs.

**Responsibilities:**

- Expose machine-readable subcommands:
  - `provider ls --json`
  - `preflight --json`
  - `run --provider <id> --schema <path> --json <prompt>`
- Emit versioned success and failure envelopes independent of consensus verdict semantics.
- Resolve through `PATH` or an explicit `CONSENSUS_CLI_PATH`.
- Keep runtime implementation dependency-free and generated from canonical TypeScript.
- Avoid daemon, workspace, WebSocket, and broad provider-platform responsibilities.

**Design Decisions:**

- A package-level generated executable is preferred, for example `bin/consensus.mjs` or `plugins/consensus/scripts/consensus.mjs`.
- Plugin-local shims or generated per-skill copies are fallback packaging details if provider installs cannot reliably preserve a plugin-level executable path.
- The CLI is a spawned process, not a cross-skill import. This keeps Refine, Evaluate, Stoa, and OAT on the same executable contract.

### Provider Adapter Registry

**Purpose:** Isolate provider-specific command construction, capability reporting, readiness probing, and output capture.

**Responsibilities:**

- Register first-scope adapters for `claude`, `codex`, and `cursor`.
- Build argv arrays without shell interpolation.
- Report provider availability, version, auth/readiness state, schema strategies, output modes, and option support.
- Map provider-specific failures to backend-neutral error categories.
- Keep future extension points explicit without implementing broad future provider support in this project.

**Interfaces:**

```ts
interface ProviderAdapter {
  id: ProviderId;
  display_name: string;
  capabilities: ProviderCapabilities;
  probe(context: ProviderProbeContext): Promise<ProviderInventoryEntry>;
  buildInvocation(request: ConsensusCliRunRequest): ProviderInvocation;
}
```

`schema_strategies` is a supported strategy set, not one static value per provider. The Structured Output Coordinator chooses per request/schema. Claude, for example, can advertise `provider_validated` and `prompt_only`; permissive schemas should choose prompt plus local validation rather than a provider path known to produce placeholder output. Claude `--json-schema` is classified as `provider_validated` or prompt plus retry, never `constrained_native`, unless live evidence proves constrained decoding.

### Structured Output Coordinator

**Purpose:** Select and enforce the least brittle structured-output path available for a provider and schema.

**Responsibilities:**

- Choose one of `constrained_native`, `provider_validated`, `prompt_only`, or `submit_tool_candidate` per request/schema.
- Run local JSON parsing and schema-subset validation after every provider strategy.
- Return provider-output failures to the CLI retry loop.
- Preserve the split between CLI-level schema reliability and loop-level verdict contract validation.

The CLI validator must be a strict subset of the loop's `normalizeVerdict`, branch validation, and verdict-cap contract. It should validate that the provider returned parseable JSON matching the selected schema subset; it must not become the authority for consensus branch semantics.

### Host Runtime Guard

**Purpose:** Avoid unsafe recursive or host-native self-spawn behavior while allowing intentional same-provider peer subprocesses.

**Responsibilities:**

- Detect host runtime as `claude`, `codex`, `cursor`, or `unknown`.
- Propagate `CONSENSUS_RUN_ID`, `CONSENSUS_PARENT_HOST`, and `CONSENSUS_DEPTH`.
- Permit host depth `0` spawning a same-provider leaf subprocess at depth `1`.
- Block a depth-1 peer from invoking `consensus` again at depth `2` by default unless `max_depth` explicitly permits it.
- Report safe same-host availability as `host_relation: 'same_host'` and `guard: 'subprocess_isolated'`.

This guard does not forbid same-provider peers. A Codex host can spawn a Codex peer when the peer is isolated as a subprocess and the depth guard remains within bounds.

### Consensus Integration Adapter

**Purpose:** Connect the new CLI to the existing consensus-loop invocation seams without changing the deliberation engine.

**Responsibilities:**

- Replace the default external-backend invocation path behind `invokePeer` and `invokeSynthesizer`.
- Project successful CLI envelopes into the current peer invocation result shape: `provider`, `args`, `stdout`, `stderr`, and `json`.
- Preserve loop-level validation, retry classification, verdict caps, and audit writes.
- Write provider-neutral audit fields for new CLI-backed runs.

New audit writes use `raw_provider_response`. Historical `.oat` artifacts and research files do not need to be rewritten, but implementation source, generated runtime outputs, tests, and maintained docs should not retain old backend-specific audit aliases after cleanup.

### Generated Runtime Packaging

**Purpose:** Keep the shipped plugin runtime install-free while preserving maintainable TypeScript source.

**Responsibilities:**

- Add canonical TypeScript source for the CLI and adapters.
- Generate committed `.mjs` runtime outputs through the existing build system.
- Include drift checks for generated output.
- Add smoke coverage for executable resolution and `--json` output shape.
- Forbid hand-editing generated runtime outputs.

### Attempt and Error Accounting

**Purpose:** Make retry behavior observable without coupling external consumers to consensus verdict semantics.

**Responsibilities:**

- Track CLI-owned attempts separately from provider-internal attempts.
- Expose terminal reason and retryability in both success and failure envelopes.
- Preserve enough detail for Refine/Evaluate audit records and Stoa/OAT diagnostics.

Provider-internal retry counts are populated only when the provider exposes them. Otherwise the value is omitted or reported as `'unknown'`.

## Data Models

The CLI data models are JSON-serializable TypeScript interfaces. They do not introduce new persistent storage. Persistent records remain the existing consensus records, status files, and artifact blocks written by Refine and Evaluate.

### Provider Identifier and Host Runtime

```ts
type ProviderId = 'claude' | 'codex' | 'cursor' | string;
type HostRuntime = 'claude' | 'codex' | 'cursor' | 'unknown';

interface HostContext {
  runtime: HostRuntime;
  cwd: string;
  run_id: string;
  depth: number;
  max_depth: number;
}
```

`ProviderId` remains open so future providers such as Gemini, Kimi, OpenCode, OpenRouter, GLM, Pi, and local open-weight adapters can be added deliberately. First-scope provider IDs are `claude`, `codex`, and `cursor`.

`depth` is the recursion guard counter. Parent orchestration is depth `0`. A same-provider peer subprocess runs as depth `1` and is allowed. A depth-1 peer attempting to run `consensus` again would become depth `2` and is blocked unless `max_depth` explicitly permits it.

### Provider Capabilities and Inventory

```ts
type StructuredOutputStrategy =
  | 'constrained_native'
  | 'provider_validated'
  | 'prompt_only'
  | 'submit_tool_candidate';

type OutputMode =
  | 'stdout_json'
  | 'json_envelope'
  | 'last_message_file'
  | 'sidecar_file';

type ProviderEffortOption = 'effort' | 'reasoning_effort' | null;

interface ProviderRuntimePolicyCapabilities {
  permission_modes?: string[];
  sandboxes?: string[];
  approval_policies?: string[];
  env_allowlist: boolean;
}

interface ProviderOptionCapabilities {
  model: boolean;
  effort: ProviderEffortOption;
  runtime_policy: ProviderRuntimePolicyCapabilities;
}

interface ProviderCapabilities {
  schema_strategies: StructuredOutputStrategy[];
  output_modes: OutputMode[];
  options: ProviderOptionCapabilities;
  supports_submit_tool: boolean;
  supports_same_host_subprocess: boolean;
  supports_host_native_dispatch: boolean;
  future_extension_kind?: 'custom_command' | 'openai_compatible_base_url' | 'acp_like';
}

interface ProviderInventoryEntry {
  id: ProviderId;
  status: 'ready' | 'missing' | 'unavailable' | 'auth_required' | 'unsupported';
  executable?: string;
  version?: string;
  capabilities: ProviderCapabilities;
  host_relation?: 'different_host' | 'same_host' | 'unknown';
  guard?: 'none' | 'subprocess_isolated' | 'host_native_safe_packet_required' | 'blocked';
  diagnostics?: ProviderDiagnostics;
}
```

`schema_strategies` is intentionally plural. The Coordinator chooses per request/schema. For example, Claude can support both `provider_validated` and `prompt_only`, while permissive schemas should avoid a provider-validated path known to produce placeholder-shaped output.

`options` makes model, effort, permission/sandbox posture, and environment passthrough explicit and capability-gated. Stoa-style provider differences fit this shape: Claude may support an `effort` flag and permission modes, Codex may support `reasoning_effort`, sandbox, and approval-policy settings, and Cursor may support a narrower set. Unsupported options should be rejected with a provider-neutral unsupported-option error rather than silently ignored.

### CLI Run Request

```ts
interface ConsensusCliRunRequest {
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

interface ProviderRuntimePolicy {
  permission_mode?: string;
  sandbox?: string;
  approval_policy?: string;
  env_allowlist?: string[];
}
```

The request is provider-generic so Refine, Evaluate, Stoa, and OAT can use it. Consensus-specific fields such as iteration mode, verdict branch, byte caps, convergence state, and section retry do not belong here.

`model`, `effort`, and `runtime_policy` are optional provider options validated against `ProviderCapabilities.options`. `runtime_policy` is caller-controlled: Consensus can choose a restrictive/no-tools posture for verdict-only peers where supported, while Stoa or OAT can choose permissive modes for workflows that genuinely need file or tool access. `env_allowlist` names additional parent-environment variables the CLI may pass through to the provider child; diagnostics never include values. `max_runtime_sec` and `max_output_bytes` belong to the CLI because the CLI owns provider subprocess execution and capture. Verdict content caps remain in the consensus loop.

### CLI Result Envelope

```ts
interface ConsensusCliRunSuccess {
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

interface ConsensusCliRunFailure {
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

type ConsensusCliRunEnvelope =
  | ConsensusCliRunSuccess
  | ConsensusCliRunFailure;
```

This deliberately preserves the current peer invocation projection surface: `provider`, `args`, `stdout`, `stderr`, and `json`. The integration adapter can project a success envelope back into the existing `invokePeer` and `invokeSynthesizer` seam while retaining richer diagnostics for audit and tests.

The CLI envelope `schema_version` is a separate version namespace from `LoopRecord.schema_version`. They may both start at `'v1'`, but they evolve independently.

### Attempt Summary

```ts
interface AttemptSummary {
  cli_attempts: number;
  provider_internal_attempts?: number | 'unknown';
  terminal_reason?: string;
  retryable: boolean;
}
```

`cli_attempts` counts retries owned by the consensus CLI. `provider_internal_attempts` is populated only when the provider exposes it; otherwise it is omitted or set to `'unknown'`. Loop-level retry remains visible in consensus records and is not counted here.

### Provider Diagnostics

```ts
interface ProviderDiagnostics {
  strategy_used?: StructuredOutputStrategy;
  output_mode?: OutputMode;
  host_relation?: 'different_host' | 'same_host' | 'unknown';
  guard?: 'none' | 'subprocess_isolated' | 'host_native_safe_packet_required' | 'blocked';
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
```

Diagnostics must be safe for artifacts and user-facing output. Sensitive environment variables and unredacted prompt content are not stored.

### Provider Error Codes

```ts
type ProviderErrorCode =
  | 'PROVIDER_MISSING'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_AUTH_REQUIRED'
  | 'PROVIDER_UNSUPPORTED'
  | 'PROVIDER_UNSUPPORTED_OPTION'
  | 'PROVIDER_EXIT'
  | 'PROVIDER_INVALID_JSON'
  | 'PROVIDER_SCHEMA_VALIDATION'
  | 'PROVIDER_OUTPUT_CAP_EXCEEDED'
  | 'PROVIDER_TIMEOUT'
  | 'HOST_RECURSION_BLOCKED'
  | 'CONSENSUS_CLI_USAGE';
```

The final retry and remediation behavior for these codes is specified in Error Handling, but the data model reserves the code space needed by the request and envelope.

### Provider Audit Fields

```ts
interface ProviderAuditFields {
  raw_provider_response?: string;
  provider_diagnostics?: ProviderDiagnostics;
  attempts?: AttemptSummary;
}
```

New writes use `raw_provider_response`. No old backend-specific raw response alias is required in final source. Historical `.oat` artifacts can remain as-is, but maintained runtime code, tests, and docs should use provider-neutral field names after cutover cleanup.

### Validation Considerations

The CLI validates JSON parseability and the selected schema subset only. It does not validate consensus-specific branch semantics, verdict caps, convergence, or section retry rules. Refine and Evaluate continue to validate verdict contracts in the consensus loop after adapting the envelope.

## API Design

This project defines a local CLI/process API, not an HTTP API. Machine-readable commands write one JSON document to stdout when `--json` is supplied. Provider stderr is captured into envelopes or diagnostics rather than streamed as the primary API.

The CLI exits `0` whenever it emits a valid structured envelope, including `ok: false` provider failures. It exits nonzero only for CLI usage or internal errors that prevent a valid envelope from being emitted, such as invalid arguments, conflicting inputs, unreadable request JSON, or a missing schema file. Callers should parse stdout first when present.

### `consensus provider ls`

**Method:** Local process invocation

**Command:** `consensus provider ls --json`

**Response:**

```ts
interface ProviderListEnvelope {
  schema_version: 'v1';
  ok: true;
  providers: ProviderInventoryEntry[];
  diagnostics?: ProviderDiagnostics;
}
```

Provider absence is represented in each provider entry, not as command failure.

### `consensus preflight`

**Method:** Local process invocation

**Command:** `consensus preflight --json [--provider <id>] [--max-depth <n>]`

**Response:**

```ts
interface PreflightEnvelope {
  schema_version: 'v1';
  ok: true;
  providers: ProviderInventoryEntry[];
  usable: boolean;
  diagnostics?: ProviderDiagnostics;
}
```

Preflight reports missing executables, auth-required states, unsupported capabilities, and same-host guard status. It exits nonzero only for CLI usage or internal failures, not because an optional provider is unavailable.

### `consensus run`

**Method:** Local process invocation

**Command:** `consensus run --provider <id> --schema <path> --json`

Prompt input does not default to argv because consensus prompts can include large diffs and artifacts. Supported prompt inputs are:

- stdin prompt: `consensus run --provider <id> --schema <path> --json < prompt.txt`
- prompt file: `consensus run --provider <id> --schema <path> --prompt-file <path> --json`
- short-prompt convenience: `--prompt <text>` for small manual invocations only
- JSON request: `--request-json <path|->`, where `-` means stdin contains the full `ConsensusCliRunRequest`

`--request-json -` consumes stdin for the request JSON, so it cannot be combined with stdin prompt input. `--request-json` also cannot be combined with request-shaping flags for the same fields, such as `--provider`, `--schema`, `--prompt-file`, `--prompt`, `--model`, `--effort`, `--permission-mode`, `--sandbox`, `--approval-policy`, `--env-allow`, `--timeout-sec`, or `--max-attempts`; conflicts fail as `CONSENSUS_CLI_USAGE`.

Optional flags include `--model`, `--effort`, `--permission-mode`, `--sandbox`, `--approval-policy`, `--env-allow`, `--max-attempts`, `--timeout-sec`, `--max-output-bytes`, `--cwd`, and `--max-depth`. These are validated against provider capabilities before invocation. The default runtime policy must be non-interactive: it must not select a provider mode that waits for an approval prompt during a one-shot run.

**Response:** `ConsensusCliRunEnvelope`

Provider-level failures are structured data: `ok: false` with a backend-neutral `ProviderErrorCode`, emitted to stdout with process exit `0`. CLI usage/internal failures that prevent an envelope use nonzero exit and may emit a `CONSENSUS_CLI_USAGE` envelope when enough context exists.

**Authorization:** The CLI has no separate auth layer. Provider auth remains owned by the provider CLI/runtime and is surfaced as provider inventory `auth_required` or provider-neutral run errors.

### Observability Boundary

The CLI returns a single envelope per stateless provider turn. Refine and Evaluate continue to own per-turn JSONL event emission and audit records, including provider diagnostics and raw response fields projected from the CLI envelope.

## Security Considerations

### Authentication

The CLI has no separate authentication layer. Provider auth remains owned by each provider CLI/runtime and is surfaced through provider inventory entries such as `auth_required` or structured `ok: false` envelopes. The CLI must not persist credentials, echo sensitive environment variables, or include unredacted prompt content in diagnostics.

### Authorization and Runtime Policy

The CLI is policy-neutral about provider permission and sandbox posture. It exposes caller-controlled, capability-gated runtime policy options such as permission mode, sandbox, approval policy, and environment allowlist. The default policy must be safe for non-interactive one-shot execution and must not block waiting for a provider approval prompt.

Consensus should select a restrictive/no-tools posture for current verdict-only peers where supported, because consensus peers return revised artifacts as structured output fields such as `proposed_artifact`; they do not need filesystem writes to update artifacts. Stoa and OAT can select more permissive policies for workflows that genuinely need file writes, terminal tools, or broader agentic behavior.

The prompt remains attacker-influenceable content: it can contain draft artifacts, code diffs, and another peer's output. Consumers that do not require provider tools should select the most restrictive provider policy available for their workflow. If a provider cannot support a requested policy, the adapter should fail with `PROVIDER_UNSUPPORTED_OPTION`.

The host runtime guard is also a security boundary. Same-provider subprocesses are allowed only as isolated leaf peers within the configured depth limit. Unsafe recursive self-spawn, host-native dispatch without a safe packet contract, and unsupported provider options fail before provider invocation.

### Data Protection

- **Prompt Handling:** Prompt input uses stdin or `--prompt-file` by default so large and potentially sensitive artifacts do not appear in process listings or hit argv limits. `--prompt` is only a short-prompt manual convenience.
- **Child Environment:** Provider subprocesses receive a filtered allowlisted environment rather than the full parent environment. The built-in allowlist should include only provider-required variables, path/runtime basics needed to launch the provider, and explicit variables needed by the host guard such as `CONSENSUS_RUN_ID`, `CONSENSUS_PARENT_HOST`, and `CONSENSUS_DEPTH`. Callers can extend the allowlist through `runtime_policy.env_allowlist` for provider-specific needs.
- **Diagnostics:** Diagnostics can include redacted commands, byte counts, provider exit metadata, selected strategy, and guard state. They must not include full prompts, auth tokens, unredacted environment dumps, or unrelated parent-process secrets.
- **Audit Records:** Raw provider responses are stored for resume/debug compatibility, so consensus artifacts must be treated as potentially sensitive.

### Input Validation

Request JSON, prompt files, schema paths, and cwd values are resolved and validated before invocation. Provider execution uses `spawn` with argv arrays and no shell interpolation. Sidecar output paths and last-message files must be created under a private temp directory with restrictive permissions and cleaned up after the run.

### Threat Mitigation

- **Prompt injection into provider tools:** Mitigated by caller-selected runtime policy. Consensus should choose restrictive/no-tools policies for verdict-only peers where supported; consumers that need tools remain responsible for selecting an appropriate posture for their threat model.
- **Credential leakage:** Mitigated by allowlisted child environments and redacted diagnostics.
- **Recursive self-spawn or hangs:** Mitigated by host runtime detection, depth counters, and default blocking at depth `2`.
- **Shell injection:** Mitigated by argv-array process spawning and rejecting shell-string command construction.

## Performance Considerations

This CLI is not a high-throughput service; performance risk is mostly latency and cost amplification from subprocess startup, provider retries, and large prompt/output handling. The design should preserve the current bounded behavior rather than optimize for concurrent server load.

Provider subprocess runtime is bounded by `max_runtime_sec`, defaulting to 300 seconds unless changed deliberately, and stdout/stderr capture is bounded by `max_output_bytes`, defaulting to the existing consensus subprocess cap unless changed deliberately. The CLI owns those bounds because it owns provider execution; verdict content caps remain in the consensus loop. Prompt input should stream from stdin or `--prompt-file` so large artifacts avoid argv limits and unnecessary command-line copying.

Retries must remain bounded at each tier. Provider-internal retries are reported when known, CLI retries are limited by `max_attempts`, and loop retries remain governed by existing consensus controls. The CLI envelope exposes attempt counts and terminal reasons so Refine and Evaluate can avoid accidentally multiplying cost.

Preflight and provider inventory can probe executables and versions on demand; no persistent cache is required for first scope. Generated `.mjs` packaging should add negligible overhead compared with provider model latency, and no runtime dependency install should be required.

## Error Handling

Error handling keeps the same two-tier split as the architecture: the CLI owns provider execution failures, while Refine and Evaluate own consensus verdict-contract failures.

| Current Source | New Provider-Neutral Code | Owner | Retry |
| --- | --- | --- | --- |
| missing provider executable | `PROVIDER_MISSING` | CLI / preflight | No |
| unavailable provider | `PROVIDER_UNAVAILABLE` | preflight + wrapper | No |
| provider auth or locked credential store | `PROVIDER_AUTH_REQUIRED` | preflight + wrapper | No |
| provider process timeout | `PROVIDER_TIMEOUT` | CLI | No by default; bounded retry only if explicitly classified transient |
| provider process nonzero exit | `PROVIDER_EXIT` | CLI | Bounded retry according to adapter classification |
| unparseable provider output | `PROVIDER_INVALID_JSON` | CLI | Yes, re-invoke within `max_attempts` |
| schema-subset failure | `PROVIDER_SCHEMA_VALIDATION` | CLI | Yes, re-prompt with validation feedback within `max_attempts` |
| subprocess stdout/stderr cap | `PROVIDER_OUTPUT_CAP_EXCEEDED` | CLI | No by default |
| unsupported model/effort/runtime policy | `PROVIDER_UNSUPPORTED_OPTION` | CLI | No |
| unsafe recursive spawn | `HOST_RECURSION_BLOCKED` | CLI | No |
| bad flags / conflicting inputs | `CONSENSUS_CLI_USAGE` | CLI | No |
| `INVALID_VERDICT_SHAPE` / `INVALID_VERDICT_CAPS` | unchanged | consensus loop | Loop retry |

The CLI emits structured `ok: false` envelopes for provider-level failures and exits `0` when it can emit a valid envelope. Nonzero process exit is reserved for CLI usage or internal failures that prevent a valid envelope from being emitted.

`PROVIDER_EXIT` classification is adapter-owned. First implementation can match current broad retry behavior by retrying nonzero provider exits within `max_attempts`, except for adapter-recognized terminal cases such as unsupported options, auth-required states, missing executables, recursion guard failures, output caps, and usage errors. Later refinements can add stderr/signature matching for rate limits, 429s, interrupted runs, and provider-specific transient classes.

Retry action differs by code. `PROVIDER_INVALID_JSON`, transient `PROVIDER_EXIT`, and explicitly retryable `PROVIDER_TIMEOUT` re-invoke the provider. `PROVIDER_SCHEMA_VALIDATION` re-prompts with the validation error appended so the peer can self-correct against the same schema. These retries share the same `max_attempts` budget and are reflected in `attempts.cli_attempts`.

The consensus loop's retryable provider set should shrink after migration. The loop treats terminal `ok: false` envelopes as already exhausted at the provider tier and should not retry them again. Loop-owned retry remains for verdict-contract failures after normalization, specifically `INVALID_VERDICT_SHAPE` and `INVALID_VERDICT_CAPS`, plus existing section/convergence controls.

No backend-specific compatibility aliases are required in final source. New writes, tests, diagnostics, and public-facing messages should use provider-neutral codes and fields only. Historical `.oat` artifacts and research files can remain untouched.

Human remediation messages should stay actionable and provider-neutral: missing executable, auth required, unsupported option, timed out provider, output cap exceeded, invalid JSON, schema validation failure, or host recursion blocked. Diagnostics may include redacted argv, provider exit code/signal, selected strategy, output byte counts, timeout seconds, and retry summary.

## Testing Strategy

### Requirement-to-Test Mapping

| ID | Verification | Key Scenarios |
| --- | --- | --- |
| FR1 | integration | `provider ls`, `preflight`, and `run` emit stable JSON envelopes; structured failures exit `0`; usage failures exit nonzero |
| FR2 | unit + integration | Claude, Codex, and Cursor adapters report capabilities, build argv arrays, probe readiness, and normalize output modes |
| FR3 | unit + integration | Strategy selection distinguishes `constrained_native`, `provider_validated`, `prompt_only`, and `submit_tool_candidate`; invalid JSON and schema-subset failures retry correctly |
| FR4 | integration + e2e | Refine and Evaluate invoke peers through the CLI seam without changing consensus loop behavior, convergence, section control, or wrapper output |
| FR5 | unit + integration | Provider inventory distinguishes missing executable, unavailable provider, auth required, unsupported capability, and transient provider failure |
| FR6 | unit | Provider-neutral error codes map to retry classification, remediation messages, and structured envelopes without backend-specific aliases |
| FR7 | integration | New CLI-backed records write `raw_provider_response`, diagnostics, and attempt summaries; resume works for CLI-backed records |
| FR8 | unit + integration | Canonical TypeScript builds committed `.mjs` entrypoints; drift checks catch stale generated runtime output; shipped entrypoint smoke tests pass |
| FR9 | unit + integration | Host runtime detection sets depth metadata; same-provider depth `0 -> 1` peer succeeds; depth `1 -> 2` recursion blocks by default |
| FR10 | manual + integration | Cursor submit-tool spike proves or rejects reliability, audit capture, local/cloud behavior, and dependency posture before adoption |
| FR11 | manual | Adapter capability review confirms future providers can be represented without implementing broad provider support |
| NFR1 | integration | Shipped runtime has no install-time npm dependency and uses Node standard library APIs |
| NFR2 | unit + integration | Timeouts, output caps, invalid JSON, schema failures, provider exits, and verdict caps are enforced at the correct tier |
| NFR3 | integration + static | Dogfood fallback is removed after parity; identifier scan confirms maintained source/runtime/tests/docs have no old backend names, excluding historical `.oat` artifacts |
| NFR4 | unit + integration | Stub executables and injected invokers cover adapter behavior without live provider calls |
| NFR5 | unit | Process spawning uses argv arrays; prompt input avoids argv by default; env allowlist, redaction, temp files, and cleanup are verified |
| NFR6 | manual | Plan review confirms first implementation stays within Claude/Codex/Cursor and defers broad provider-platform work |

### Unit Tests

Unit tests should cover provider adapter capability objects, argv construction, provider option validation, runtime-policy validation, env allowlist construction, schema strategy selection, JSON parsing, schema-subset validation, timeout handling, output cap handling, error mapping, retry classification, and host runtime depth behavior. Tests should assert that unsupported options fail as `PROVIDER_UNSUPPORTED_OPTION`, provider timeouts fail as `PROVIDER_TIMEOUT`, and provider-tier terminal failures are not marked for loop retry.

### Integration Tests

Integration tests should use stub provider executables and injected invokers rather than live provider calls. They should exercise the CLI commands end-to-end, including stdin prompt input, `--prompt-file`, `--request-json -`, conflict detection, structured `ok:false` envelopes, exit-code behavior, redacted diagnostics, sidecar/last-message output modes, Refine/Evaluate wrapper integration, generated-output drift checks, and provider-neutral audit records.

### End-to-End Tests

End-to-end coverage should include mocked Refine and Evaluate runs that complete through the CLI backend, write JSONL records, and resume from CLI-backed records. Dogfood verification with live providers remains manual/operator-driven until provider paths are stable enough for automated smoke coverage.

## Deployment Strategy

### Build Process

Canonical TypeScript source builds the CLI and integration code into committed dependency-free `.mjs` runtime outputs through the existing generated-runtime pipeline. Build drift checks must verify that generated plugin/runtime entrypoints match source before merge.

### Deployment Steps

1. Add generated CLI entrypoints and adapter source behind an explicit dogfood switch.
2. Ship Refine and Evaluate wrappers that can select the CLI backend for new runs.
3. Validate with unit, integration, smoke, and build drift checks.
4. Dogfood the CLI backend with local providers.
5. Switch new runs to the CLI backend after parity is accepted.
6. Remove old backend scaffolding and run the identifier cleanup scan.

### Rollback Plan

Before cleanup, rollback is switching new runs back to the old backend while defects are fixed. After cleanup, rollback is a normal git revert or forward fix; the design does not keep a permanent dual-backend runtime.

### Configuration

Backend selection during dogfood should use one explicit switch, such as an environment variable or wrapper option chosen during planning. Provider runtime policy is supplied per run through `runtime_policy` or equivalent CLI flags. `CONSENSUS_CLI_PATH` may override executable resolution for development and tests.

### Monitoring

There is no service dashboard. Observability is artifact and test based: CLI envelopes, Refine/Evaluate JSONL records, attempt summaries, provider diagnostics, smoke output, and operator QA notes.

## Migration Plan

No database migration is required. This is a runtime and generated-output migration from the current external provider backend to the owned `consensus` CLI path.

### Migration Steps

1. Add the new CLI, provider adapters, result envelopes, timeout handling, and provider-neutral audit fields behind an explicit dogfood switch.
2. Wire Refine and Evaluate through the existing peer invocation seam so new runs can select the CLI backend without changing deliberation behavior.
3. Verify parity with mocked provider tests, generated-output drift checks, and smoke coverage for Refine and Evaluate.
4. Dogfood the CLI backend on new consensus runs only. In-flight runs started on the old backend should finish on that backend.
5. Switch the default for new runs to the CLI backend after parity and dogfood evidence are acceptable.
6. Remove temporary fallback scaffolding and old backend references from implementation source, generated runtime outputs, tests, fixtures, and maintained docs.
7. Run a static identifier scan as a cleanup gate. The scan should cover source, generated runtime outputs, tests, fixtures, README/release/operator docs, and plugin manifests, while excluding historical `.oat` artifacts and research files.

### Non-Goals

Cross-cutover resume is a non-goal. A run started on the old backend is not required to resume under the new CLI after cleanup removes old backend fields and aliases. The safe operational sequence is to finish in-flight old-backend runs, cut over new runs to the CLI, then perform the source cleanup.

Historical `.oat` project artifacts and research notes are not rewritten by this migration. They may still mention the old backend as project history.

### Rollback Strategy

Before the cleanup phase, rollback is the dogfood switch: route new runs back to the old backend if CLI parity fails. After the cleanup phase, rollback is a normal git revert or follow-up fix, not a permanent dual-path runtime.

### Compatibility Boundary

Final source does not keep compatibility aliases for old backend response fields, error names, env vars, command paths, or fixture names. New writes use provider-neutral fields such as `raw_provider_response` and provider-neutral error codes only.

## Implementation Phases

### Phase 1: CLI Contract and Core Models

**Goal:** Establish the provider-neutral CLI envelope, request model, error taxonomy, timeout/output caps, and generated entrypoint shape.

**Tasks:** Add canonical TypeScript model definitions, CLI argument parsing, request normalization, structured success/failure envelopes, and unit tests for usage errors and envelope output.

**Verification:** Unit tests for request parsing and envelope shape; smoke command for `provider ls --json` and `run --request-json` with stub providers.

### Phase 2: Provider Adapter Floor

**Goal:** Implement Claude, Codex, and Cursor adapters with capability reporting, argv construction, readiness probing, runtime policy mapping, and provider-output capture.

**Tasks:** Add adapter registry, stub executable tests, provider inventory/preflight behavior, strategy selection, timeout handling, output caps, env allowlist behavior, and redacted diagnostics.

**Verification:** Unit and integration tests for each adapter plus provider inventory/preflight snapshots.

### Phase 3: Consensus Loop Integration

**Goal:** Route Refine and Evaluate through the CLI backend without changing deliberation semantics.

**Tasks:** Replace the default provider invocation path behind the existing seams, write provider-neutral audit fields, shrink loop retry responsibility to verdict-contract failures, and preserve JSONL observability.

**Verification:** Refine/Evaluate integration tests, resume tests for CLI-backed records, smoke tests, and existing consensus suite.

### Phase 4: Dogfood and Clean Cutover

**Goal:** Prove parity on new runs, switch defaults, and remove old backend references from maintained source.

**Tasks:** Run live-provider dogfood, fix parity gaps, switch new runs to the CLI backend, remove fallback scaffolding, update maintained docs, regenerate runtime outputs, and run identifier scans excluding historical `.oat` artifacts.

**Verification:** Full test suite, build drift check, smoke test, static identifier scan, and operator QA evidence.

## Risks and Mitigation

| Risk | Probability | Impact | Mitigation | Contingency |
| --- | --- | --- | --- | --- |
| Provider CLI drift breaks direct adapters | Medium | High | Keep adapters narrow, test argv/output contracts with stubs, and isolate provider-specific behavior in the registry | Patch the affected adapter and keep dogfood switch available until cleanup |
| Prompt-only or provider-validated output remains unreliable | High | High | Preserve local validation, schema-subset retries, validation-feedback re-prompts, and bounded submit-tool evaluation | Defer Cursor or specific strategy adoption until reliability criteria are met |
| Retry tiers multiply cost or latency | Medium | High | Track provider-internal, CLI, and loop attempts separately; make provider-tier terminal failures non-retryable by the loop | Tighten retry budgets or mark more provider errors terminal |
| Hung provider subprocess stalls a run | Medium | High | Enforce `max_runtime_sec`, kill timed-out subprocesses, and emit `PROVIDER_TIMEOUT` | Lower default timeout or mark provider timeout terminal for that adapter |
| Clean cutover removes needed fallback too early | Medium | Medium | Gate cleanup on parity, dogfood evidence, and static identifier scan | Revert cleanup commit or reintroduce a targeted fix, not a permanent dual path |
| Runtime policy is too restrictive or too permissive for a consumer | Medium | Medium | Make runtime policy caller-controlled and capability-gated; document Consensus and Stoa policy differences | Add provider-specific policy mappings or reject unsupported policies clearly |
| Generated runtime output drifts from TypeScript source | Medium | Medium | Extend build mappings and drift checks with generated CLI outputs | Regenerate outputs and block merge until drift checks pass |
| Scope expands into a broad provider platform | Medium | Medium | Limit first implementation to Claude/Codex/Cursor and future-provider capability shape only | Split broader provider catalog work into a separate project |
