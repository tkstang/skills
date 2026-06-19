---
oat_plan_source: spec-driven
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-06-19
oat_phase: plan
oat_phase_status: complete
oat_plan_parallel_groups: []
oat_plan_hill_phases: ["p04"]
oat_auto_review_at_hill_checkpoints: true
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
oat_template: false
---

# Implementation Plan: consensus-peer-invocation

> Execute this plan using `oat-project-implement` — sequential by default, parallel when `oat_plan_parallel_groups` is declared.

**Goal:** Replace the current external peer invocation backend with an owned `consensus` CLI that provides provider inventory, preflight, one-shot structured runs, provider-neutral diagnostics, and a clean source-level cutover.

**Architecture:** Canonical TypeScript source under `src/consensus/provider-cli/` builds a dependency-free generated CLI at `plugins/consensus/scripts/consensus.mjs`. Refine and Evaluate call that CLI through the existing consensus-loop invocation seams while the loop remains responsible for verdict semantics, convergence, and audit JSONL records.

**Tech Stack:** Node.js 22+, TypeScript source, generated `.mjs` runtime outputs via `scripts/build-generated.mjs`, Vitest tests through `pnpm run test:vitest -- <file>`, Node standard library process/fs/path APIs only for shipped runtime.

**Commit Convention:** `{type}({scope}): {description}` - e.g., `feat(p01-t01): add provider cli model types`

## Planning Checklist

- [x] Defer HiLL checkpoint confirmation to oat-project-implement
- [x] Evaluated phases for parallelism opportunities
- [x] Keep `oat_plan_parallel_groups` sequential because phases share `src/consensus/core/consensus-loop.ts`, generated output mappings, and consensus docs

---

## Parallelism

No parallel phase group is declared. The phases intentionally build on shared files:

- p01 establishes CLI types, parsing, and generated entrypoint wiring used by every later phase.
- p02 fills the adapter/execution internals behind that CLI.
- p03 changes shared consensus-loop invocation and both Refine/Evaluate wrappers.
- p04 removes old backend identifiers across source, generated runtime, tests, fixtures, and maintained docs.

Running these phases concurrently would create avoidable conflicts in `src/consensus/core/consensus-loop.ts`, `scripts/build-generated.mjs`, generated outputs, and docs.

---

## Phase 1: CLI Contract and Generated Entrypoint

Goal: establish the provider-neutral request/envelope/error contract, CLI argument surface, and generated runtime entrypoint before provider adapters exist.

### Task p01-t01: Add Provider CLI Model Types

**Files:**

- Create: `src/consensus/provider-cli/types.ts`
- Create: `tests/consensus/provider-cli/types.test.ts`

**Step 1: Write test (RED)**

Add tests that assert the exported constants/type helper data expose:

- first-scope provider IDs: `claude`, `codex`, `cursor`
- structured output strategies including reserved `submit_tool_candidate`
- provider-neutral error codes from `PROVIDER_MISSING` through `CONSENSUS_CLI_USAGE`
- first-scope host-native dispatch default is represented as unsupported/reserved

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/types.test.ts`
Expected: Test fails because the module does not exist.

**Step 2: Implement (GREEN)**

Create exported TypeScript interfaces and constant arrays matching `design.md`:

- `ProviderId`, `HostRuntime`, `HostContext`
- `ProviderCapabilities`, `ProviderInventoryEntry`
- `ConsensusCliRunRequest`, `ConsensusCliRunEnvelope`
- `AttemptSummary`, `ProviderDiagnostics`, `ProviderErrorCode`

Keep values JSON-serializable and avoid runtime dependencies.

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/types.test.ts`
Expected: Test passes.

**Step 3: Refactor**

Keep model exports grouped by concept. Do not import consensus verdict types into this module.

**Step 4: Verify**

Run: `pnpm run type-check`
Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add src/consensus/provider-cli/types.ts tests/consensus/provider-cli/types.test.ts
git commit -m "feat(p01-t01): add provider cli model types"
```

---

### Task p01-t02: Parse CLI Arguments and Prompt Sources

**Files:**

- Create: `src/consensus/provider-cli/args.ts`
- Create: `tests/consensus/provider-cli/args.test.ts`

**Step 1: Write test (RED)**

Cover argument parsing for:

- `provider ls --json`
- `preflight --json [--provider <id>] [--max-depth <n>]`
- `run --provider <id> --schema <path> --json`
- prompt via stdin marker, `--prompt-file`, short `--prompt`, and `--request-json <path|->`
- conflicts between `--request-json` and request-shaping flags
- positive integer validation for `--max-attempts`, `--timeout-sec`, `--max-output-bytes`, `--max-depth`

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/args.test.ts`
Expected: Test fails because parser is absent.

**Step 2: Implement (GREEN)**

Export parsing functions such as:

- `parseConsensusCliArgs(argv: readonly string[]): ParsedConsensusCliCommand`
- `normalizeRunRequest(command, io): Promise<ConsensusCliRunRequest>`

Use `node:util.parseArgs` or a small stdlib parser. Keep prompt content out of argv by default and model stdin/request-json collisions as `CONSENSUS_CLI_USAGE`.

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/args.test.ts`
Expected: Test passes.

**Step 3: Refactor**

Keep file path reads injectable for tests so parsing can be tested without process globals.

**Step 4: Verify**

Run: `pnpm run type-check`
Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add src/consensus/provider-cli/args.ts tests/consensus/provider-cli/args.test.ts
git commit -m "feat(p01-t02): parse provider cli arguments"
```

---

### Task p01-t03: Add Envelope and Exit-Code Helpers

**Files:**

- Create: `src/consensus/provider-cli/envelope.ts`
- Create: `tests/consensus/provider-cli/envelope.test.ts`

**Step 1: Write test (RED)**

Add tests for:

- success envelope shape
- structured provider failures exiting as process code `0`
- usage/internal failures returning nonzero when no valid envelope can be emitted
- `ConsensusCliRunFailure.retryable` as the caller-facing authority
- `attempts.retryable` mirroring the top-level value
- `terminal_reason` carrying the classification basis

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/envelope.test.ts`
Expected: Test fails because helpers are absent.

**Step 2: Implement (GREEN)**

Export helpers such as:

- `successEnvelope(input): ConsensusCliRunSuccess`
- `failureEnvelope(input): ConsensusCliRunFailure`
- `processExitForEnvelope(envelope): number`
- `usageFailure(message, details): ConsensusCliRunFailure`

Do not encode consensus verdict semantics here.

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/envelope.test.ts`
Expected: Test passes.

**Step 3: Refactor**

Keep messages provider-neutral and reserve provider-specific details for diagnostics.

**Step 4: Verify**

Run: `pnpm run type-check`
Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add src/consensus/provider-cli/envelope.ts tests/consensus/provider-cli/envelope.test.ts
git commit -m "feat(p01-t03): add provider cli envelopes"
```

---

### Task p01-t04: Wire Generated CLI Entrypoint

**Files:**

- Create: `src/consensus/provider-cli/cli.ts`
- Modify: `scripts/build-generated.mjs`
- Modify: `tests/tooling/generated-output-sync.test.ts`
- Create: `plugins/consensus/scripts/consensus.mjs` (generated by `pnpm run build`)

**Step 1: Write test (RED)**

Update generated-output tests to expect a new mapping:

- source: `src/consensus/provider-cli/cli.ts`
- output: `plugins/consensus/scripts/consensus.mjs`
- `--list-outputs` includes the new output
- generated output starts with the standard generated banner and shebang

Run: `pnpm run test:vitest -- tests/tooling/generated-output-sync.test.ts`
Expected: Test fails because the mapping/output is absent.

**Step 2: Implement (GREEN)**

Add the build mapping and a minimal CLI main that can parse `--help` and route parsed commands to placeholder handlers returning structured `CONSENSUS_CLI_USAGE` for unsupported paths until later tasks fill them.

Run: `pnpm run build`
Expected: `plugins/consensus/scripts/consensus.mjs` is generated.

Run: `pnpm run test:vitest -- tests/tooling/generated-output-sync.test.ts`
Expected: Test passes.

**Step 3: Refactor**

Keep generated output ignored by lint/format through existing generated-output config patterns if the test exposes a missing exclusion.

**Step 4: Verify**

Run: `pnpm run build:check`
Expected: New consensus CLI output is in sync.

**Step 5: Commit**

```bash
git add src/consensus/provider-cli/cli.ts scripts/build-generated.mjs tests/tooling/generated-output-sync.test.ts plugins/consensus/scripts/consensus.mjs
git commit -m "feat(p01-t04): add generated provider cli entrypoint"
```

---

### Task p01-t05: Implement Provider List and Preflight Skeleton

**Files:**

- Create: `src/consensus/provider-cli/commands.ts`
- Create: `tests/consensus/provider-cli/commands.test.ts`
- Modify: `src/consensus/provider-cli/cli.ts`

**Step 1: Write test (RED)**

Use injected registry/probe functions to assert:

- `provider ls --json` returns `{ schema_version: 'v1', ok: true, providers: [...] }`
- missing providers are entries, not command failures
- `preflight --json` returns `usable: true` when selected providers are ready
- `preflight --json --provider cursor` returns `usable: false` when cursor is `auth_required`
- envelope-level diagnostics are command-level only

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/commands.test.ts`
Expected: Test fails because command handlers are absent.

**Step 2: Implement (GREEN)**

Export command handlers:

- `runProviderList(options): Promise<ProviderListEnvelope>`
- `runPreflight(options): Promise<PreflightEnvelope>`
- `runConsensusCli(argv, io): Promise<number>`

Use an injectable registry placeholder that phase 2 will replace with real adapters.

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/commands.test.ts`
Expected: Test passes.

**Step 3: Refactor**

Keep stdout writing centralized in `cli.ts`; handlers should return envelopes.

**Step 4: Verify**

Run: `pnpm run type-check`
Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add src/consensus/provider-cli/commands.ts src/consensus/provider-cli/cli.ts tests/consensus/provider-cli/commands.test.ts
git commit -m "feat(p01-t05): add provider list and preflight handlers"
```

---

### Task p01-t06: Add CLI Process Contract Tests

**Files:**

- Create: `tests/consensus/provider-cli/cli-process.test.ts`
- Modify: `tests/helpers/process.mjs`

**Step 1: Write test (RED)**

Add process-level tests that run `plugins/consensus/scripts/consensus.mjs` after build and assert:

- `provider ls --json` writes a single parseable JSON document
- bad flags exit nonzero
- structured provider absence exits `0`
- `--request-json -` consumes stdin and rejects conflicting flags

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/cli-process.test.ts`
Expected: Test fails until the generated entrypoint routes correctly.

**Step 2: Implement (GREEN)**

Add only test helper support needed to run generated CLI scripts with stdin and capture stdout/stderr. Do not add runtime dependencies.

Run: `pnpm run build && pnpm run test:vitest -- tests/consensus/provider-cli/cli-process.test.ts`
Expected: Test passes.

**Step 3: Refactor**

Keep helper additions generic and reusable for future generated CLI tests.

**Step 4: Verify**

Run: `pnpm run build:check`
Expected: Generated outputs remain in sync.

**Step 5: Commit**

```bash
git add tests/consensus/provider-cli/cli-process.test.ts tests/helpers/process.mjs plugins/consensus/scripts/consensus.mjs
git commit -m "test(p01-t06): cover provider cli process contract"
```

---

## Phase 2: Provider Adapter Floor and Execution Reliability

Goal: implement Claude, Codex, and Cursor adapter capabilities, readiness probes, host guard, runtime policy validation, subprocess execution, schema strategy selection, and CLI-owned retries.

### Task p02-t01: Add Adapter Registry and Capability Objects

**Files:**

- Create: `src/consensus/provider-cli/adapters.ts`
- Create: `tests/consensus/provider-cli/adapters.test.ts`
- Modify: `src/consensus/provider-cli/commands.ts`

**Step 1: Write test (RED)**

Assert the registry exposes `claude`, `codex`, and `cursor` adapters with:

- plural `schema_strategies`
- `supports_same_host_subprocess: true`
- `supports_host_native_dispatch: false`
- model/effort/runtime-policy capability differences
- `submit_tool_candidate` reserved for Cursor and not selected by default

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/adapters.test.ts`
Expected: Test fails because registry is absent.

**Step 2: Implement (GREEN)**

Define `ProviderAdapter` objects and a `providerRegistry()` helper. Keep command construction for later tasks; this task only declares capabilities and lookup behavior.

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/adapters.test.ts`
Expected: Test passes.

**Step 3: Refactor**

Keep adapter IDs user-facing as `claude`, `codex`, and `cursor`.

**Step 4: Verify**

Run: `pnpm run type-check`
Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add src/consensus/provider-cli/adapters.ts src/consensus/provider-cli/commands.ts tests/consensus/provider-cli/adapters.test.ts
git commit -m "feat(p02-t01): add provider adapter registry"
```

---

### Task p02-t02: Implement Provider Readiness Probes

**Files:**

- Create: `src/consensus/provider-cli/probe.ts`
- Create: `tests/consensus/provider-cli/probe.test.ts`
- Modify: `src/consensus/provider-cli/adapters.ts`
- Modify: `src/consensus/provider-cli/commands.ts`

**Step 1: Write test (RED)**

Use injected command runners to cover:

- missing executable -> `PROVIDER_MISSING` / provider entry `missing`
- version/readiness success -> provider entry `ready`
- locked/auth-required output -> provider entry `auth_required`
- terminal local configuration/platform issue -> provider entry `unavailable`
- unsupported requested provider ID -> provider entry `unsupported`

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/probe.test.ts`
Expected: Test fails because probing is absent.

**Step 2: Implement (GREEN)**

Add probe helpers for executable lookup and provider readiness. Keep classifiers conservative and provider-neutral; adapter-specific text matching belongs in adapter probe definitions.

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/probe.test.ts`
Expected: Test passes.

**Step 3: Refactor**

Keep `PROVIDER_UNAVAILABLE` limited to pre-invocation readiness failures.

**Step 4: Verify**

Run: `pnpm run type-check`
Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add src/consensus/provider-cli/probe.ts src/consensus/provider-cli/adapters.ts src/consensus/provider-cli/commands.ts tests/consensus/provider-cli/probe.test.ts
git commit -m "feat(p02-t02): implement provider readiness probes"
```

---

### Task p02-t03: Add Host Runtime Guard

**Files:**

- Create: `src/consensus/provider-cli/host-guard.ts`
- Create: `tests/consensus/provider-cli/host-guard.test.ts`
- Modify: `src/consensus/provider-cli/commands.ts`

**Step 1: Write test (RED)**

Cover:

- host runtime detection from Claude/Codex/Cursor environment markers
- depth `0` host spawning same-provider peer at depth `1` succeeds with `subprocess_isolated`
- depth `1` peer attempting depth `2` blocks by default with `HOST_RECURSION_BLOCKED`
- `max_depth` opt-in allows configured deeper recursion
- `host_native_safe_packet_required` is not emitted in first scope

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/host-guard.test.ts`
Expected: Test fails because guard is absent.

**Step 2: Implement (GREEN)**

Export helpers such as:

- `detectHostRuntime(env): HostRuntime`
- `buildChildHostEnv(context): Record<string, string>`
- `evaluateHostGuard({ host, provider }): HostGuardResult`

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/host-guard.test.ts`
Expected: Test passes.

**Step 3: Refactor**

Ensure same-provider subprocesses are allowed only as isolated leaf peers within depth bounds.

**Step 4: Verify**

Run: `pnpm run type-check`
Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add src/consensus/provider-cli/host-guard.ts src/consensus/provider-cli/commands.ts tests/consensus/provider-cli/host-guard.test.ts
git commit -m "feat(p02-t03): add provider host recursion guard"
```

---

### Task p02-t04: Validate Runtime Policy and Child Environment

**Files:**

- Create: `src/consensus/provider-cli/runtime-policy.ts`
- Create: `tests/consensus/provider-cli/runtime-policy.test.ts`
- Modify: `src/consensus/provider-cli/adapters.ts`

**Step 1: Write test (RED)**

Cover:

- supported model/effort/runtime policy options pass
- unsupported model/effort/runtime policy fails with `PROVIDER_UNSUPPORTED_OPTION`
- default policy is non-interactive
- child environment is allowlisted and excludes unrelated secrets
- caller `runtime_policy.env_allowlist` can add named variables without exposing values in diagnostics

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/runtime-policy.test.ts`
Expected: Test fails because validation is absent.

**Step 2: Implement (GREEN)**

Add helpers:

- `validateProviderOptions(request, capabilities)`
- `buildChildEnvironment({ parentEnv, request, hostEnv })`
- `redactedRuntimePolicyDiagnostics(policy)`

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/runtime-policy.test.ts`
Expected: Test passes.

**Step 3: Refactor**

Keep provider-specific option names capability-driven, not hard-coded in callers.

**Step 4: Verify**

Run: `pnpm run type-check`
Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add src/consensus/provider-cli/runtime-policy.ts src/consensus/provider-cli/adapters.ts tests/consensus/provider-cli/runtime-policy.test.ts
git commit -m "feat(p02-t04): validate provider runtime policy"
```

---

### Task p02-t05: Build Provider Invocation Arguments

**Files:**

- Create: `src/consensus/provider-cli/invocation.ts`
- Create: `tests/consensus/provider-cli/invocation.test.ts`
- Modify: `src/consensus/provider-cli/adapters.ts`

**Step 1: Write test (RED)**

Assert each first-scope adapter builds argv arrays with:

- no shell string interpolation
- prompt delivered via stdin or temp/sidecar path, not trailing prompt argv
- provider schema strategy reflected in argv/options where supported
- model and effort mapped only when capabilities permit
- `supports_host_native_dispatch` remains false

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/invocation.test.ts`
Expected: Test fails because invocation builders are absent.

**Step 2: Implement (GREEN)**

Add `ProviderInvocation` and adapter `buildInvocation()` implementations for Claude, Codex, and Cursor. Keep provider-specific flags isolated in adapter definitions.

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/invocation.test.ts`
Expected: Test passes.

**Step 3: Refactor**

Keep argument arrays deterministic so tests can snapshot meaningful command shape without secrets.

**Step 4: Verify**

Run: `pnpm run type-check`
Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add src/consensus/provider-cli/invocation.ts src/consensus/provider-cli/adapters.ts tests/consensus/provider-cli/invocation.test.ts
git commit -m "feat(p02-t05): build provider invocation arguments"
```

---

### Task p02-t06: Add Bounded Subprocess Runner

**Files:**

- Create: `src/consensus/provider-cli/subprocess.ts`
- Create: `tests/consensus/provider-cli/subprocess.test.ts`
- Create: `tests/fixtures/bin/consensus-provider-stub`
- Modify: `tests/helpers/process.mjs`

**Step 1: Write test (RED)**

Use a stub executable to cover:

- stdin prompt delivery
- stdout/stderr capture
- nonzero exit as `PROVIDER_EXIT`
- timeout kill as `PROVIDER_TIMEOUT`
- stdout/stderr cap as `PROVIDER_OUTPUT_CAP_EXCEEDED`
- redacted command diagnostics
- no shell execution

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/subprocess.test.ts`
Expected: Test fails because subprocess runner is absent.

**Step 2: Implement (GREEN)**

Export `runProviderSubprocess(invocation, options): Promise<ProviderProcessResult>`. Use `spawn`, bounded buffers, timeout cleanup, and private temp paths for sidecar/last-message modes.

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/subprocess.test.ts`
Expected: Test passes.

**Step 3: Refactor**

Keep temp-file cleanup observable through tests without depending on wall-clock sleeps.

**Step 4: Verify**

Run: `pnpm run type-check`
Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add src/consensus/provider-cli/subprocess.ts tests/consensus/provider-cli/subprocess.test.ts tests/fixtures/bin/consensus-provider-stub tests/helpers/process.mjs
git commit -m "feat(p02-t06): add bounded provider subprocess runner"
```

---

### Task p02-t07: Add Structured Output Coordinator and CLI Run Retries

**Files:**

- Create: `src/consensus/provider-cli/structured-output.ts`
- Create: `tests/consensus/provider-cli/structured-output.test.ts`
- Modify: `src/consensus/provider-cli/commands.ts`
- Modify: `src/consensus/provider-cli/cli.ts`

**Step 1: Write test (RED)**

Cover:

- strategy selection among `constrained_native`, `provider_validated`, and `prompt_only`
- `submit_tool_candidate` remains reserved and not selected by default
- parse failure -> `PROVIDER_INVALID_JSON` and re-invoke
- schema subset failure -> `PROVIDER_SCHEMA_VALIDATION` and re-prompt with validation feedback
- timeout/nonzero exit retry classification follows adapter decisions
- terminal `ok:false` envelope exits process `0`

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/structured-output.test.ts`
Expected: Test fails because run coordination is absent.

**Step 2: Implement (GREEN)**

Add `runProviderTurn(request, dependencies): Promise<ConsensusCliRunEnvelope>`. Validate only parseability and the selected schema subset; leave verdict branch/cap validation to the consensus loop.

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/structured-output.test.ts`
Expected: Test passes.

**Step 3: Refactor**

Keep retry accounting in `attempts.cli_attempts` and preserve `terminal_reason`.

**Step 4: Verify**

Run: `pnpm run build && pnpm run test:vitest -- tests/consensus/provider-cli/cli-process.test.ts tests/consensus/provider-cli/structured-output.test.ts`
Expected: Generated CLI and structured-output tests pass.

**Step 5: Commit**

```bash
git add src/consensus/provider-cli/structured-output.ts src/consensus/provider-cli/commands.ts src/consensus/provider-cli/cli.ts tests/consensus/provider-cli/structured-output.test.ts plugins/consensus/scripts/consensus.mjs
git commit -m "feat(p02-t07): add structured provider run coordination"
```

---

## Phase 3: Refine and Evaluate Integration

Goal: route both shipped consumers through the new CLI backend, preserve consensus-loop behavior, write provider-neutral audit records, and stop double-retrying provider-tier failures.

### Task p03-t01: Add Consensus CLI Invoker Seam

**Files:**

- Modify: `src/consensus/core/consensus-loop.ts`
- Create: `tests/consensus/core/provider-cli-invocation.test.ts`

**Step 1: Write test (RED)**

Add tests for a new invoker seam that:

- invokes the generated `consensus` CLI or injected command runner
- sends prompt via stdin or request JSON
- projects success envelopes to `{ provider, args, stdout, stderr, json }`
- maps structured `ok:false` provider failures to `ConsensusError`
- preserves injected `invokePeer` and `invokeSynthesizer` test seams

Run: `pnpm run test:vitest -- tests/consensus/core/provider-cli-invocation.test.ts`
Expected: Test fails because the seam does not exist.

**Step 2: Implement (GREEN)**

Introduce provider-neutral names such as `ProviderInvocationArgs`, `ProviderResult`, `invokeConsensusProviderCli()`, and `invokeProviderCliWithRetry()` while keeping old code reachable behind the dogfood switch until phase 4 cleanup.

Run: `pnpm run test:vitest -- tests/consensus/core/provider-cli-invocation.test.ts`
Expected: Test passes.

**Step 3: Refactor**

Keep exported signatures stable enough for existing wrapper tests to compile.

**Step 4: Verify**

Run: `pnpm run type-check`
Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add src/consensus/core/consensus-loop.ts tests/consensus/core/provider-cli-invocation.test.ts
git commit -m "feat(p03-t01): add consensus provider cli invocation seam"
```

---

### Task p03-t02: Write Provider-Neutral Audit and Resume Fields

**Files:**

- Modify: `src/consensus/core/consensus-loop.ts`
- Modify: `tests/consensus/core/loop-records.test.ts`
- Modify: `tests/consensus/refine/resume-matrix.test.ts`

**Step 1: Write test (RED)**

Add tests that new CLI-backed records write:

- `raw_provider_response`
- `provider_diagnostics`
- `attempts`

Also verify resume works from CLI-backed records and does not require old backend aliases for new runs.

Run: `pnpm run test:vitest -- tests/consensus/core/loop-records.test.ts tests/consensus/refine/resume-matrix.test.ts`
Expected: Tests fail because records still write old backend fields.

**Step 2: Implement (GREEN)**

Update peer and synthesis record construction to write provider-neutral audit fields when the CLI path is active.

Run: `pnpm run test:vitest -- tests/consensus/core/loop-records.test.ts tests/consensus/refine/resume-matrix.test.ts`
Expected: Tests pass.

**Step 3: Refactor**

Keep historical `.oat` artifacts untouched; do not add source-level compatibility aliases.

**Step 4: Verify**

Run: `pnpm run type-check`
Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add src/consensus/core/consensus-loop.ts tests/consensus/core/loop-records.test.ts tests/consensus/refine/resume-matrix.test.ts
git commit -m "feat(p03-t02): write provider-neutral consensus audit fields"
```

---

### Task p03-t03: Shrink Loop Retry Responsibility

**Files:**

- Modify: `src/consensus/core/consensus-loop.ts`
- Modify: `tests/consensus/refine/paseo-invocation.test.ts` (renamed to `tests/consensus/refine/provider-subprocess.test.ts` in p04-t05)
- Create: `tests/consensus/core/provider-retry-boundary.test.ts`

**Step 1: Write test (RED)**

Cover:

- terminal `ok:false` provider envelope is treated as provider-tier exhausted
- loop retry remains for `INVALID_VERDICT_SHAPE`
- loop retry remains for `INVALID_VERDICT_CAPS`
- provider invalid JSON/schema/timeout retry accounting is not repeated by the loop after CLI exhaustion

Run: `pnpm run test:vitest -- tests/consensus/core/provider-retry-boundary.test.ts tests/consensus/refine/paseo-invocation.test.ts`
Expected: New boundary tests fail.

**Step 2: Implement (GREEN)**

Update retry classification so provider-tier terminal failures are not retried by the consensus loop. Keep verdict-contract retry behavior unchanged.

Run: `pnpm run test:vitest -- tests/consensus/core/provider-retry-boundary.test.ts tests/consensus/refine/paseo-invocation.test.ts`
Expected: Tests pass.

**Step 3: Refactor**

Make helper names provider-neutral where touched, leaving full identifier cleanup to phase 4.

**Step 4: Verify**

Run: `pnpm run test:vitest -- tests/consensus/core/verdict-validation.test.ts tests/consensus/core/provider-retry-boundary.test.ts`
Expected: Verdict validation and retry boundary tests pass.

**Step 5: Commit**

```bash
git add src/consensus/core/consensus-loop.ts tests/consensus/core/provider-retry-boundary.test.ts tests/consensus/refine/paseo-invocation.test.ts
git commit -m "fix(p03-t03): keep provider retries out of consensus loop"
```

---

### Task p03-t04: Add Refine Wrapper Backend Switch and Preflight

**Files:**

- Modify: `src/consensus/refine/consensus-refine.ts`
- Modify: `tests/consensus/refine/wrapper-options.test.ts`
- Modify: `tests/consensus/refine/error-handling.test.ts`
- Modify: `plugins/consensus/skills/refine/scripts/consensus-refine.mjs` (generated by `pnpm run build`)

**Step 1: Write test (RED)**

Cover Refine wrapper behavior:

- dogfood switch selects the CLI backend for new runs
- `CONSENSUS_CLI_PATH` overrides generated CLI resolution
- preflight uses `consensus provider ls` / `preflight` results
- auth-required Cursor reports actionable provider-neutral remediation
- default path remains old backend until cutover phase

Run: `pnpm run test:vitest -- tests/consensus/refine/wrapper-options.test.ts tests/consensus/refine/error-handling.test.ts`
Expected: Tests fail because switch/preflight are absent.

**Step 2: Implement (GREEN)**

Add backend selection and provider-neutral preflight while preserving existing wrapper flags and output behavior.

Run: `pnpm run build && pnpm run test:vitest -- tests/consensus/refine/wrapper-options.test.ts tests/consensus/refine/error-handling.test.ts`
Expected: Tests pass and generated refine runtime updates.

**Step 3: Refactor**

Keep old backend fallback isolated behind one temporary dogfood switch.

**Step 4: Verify**

Run: `pnpm run build:check`
Expected: Generated outputs are in sync.

**Step 5: Commit**

```bash
git add src/consensus/refine/consensus-refine.ts tests/consensus/refine/wrapper-options.test.ts tests/consensus/refine/error-handling.test.ts plugins/consensus/skills/refine/scripts/consensus-refine.mjs
git commit -m "feat(p03-t04): add refine provider cli backend switch"
```

---

### Task p03-t05: Add Evaluate Wrapper Backend Switch and Preflight

**Files:**

- Modify: `src/consensus/evaluate/consensus-evaluate.ts`
- Modify: `tests/consensus/evaluate/wrapper.test.ts`
- Modify: `tests/consensus/evaluate/output.test.ts`
- Modify: `plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs` (generated by `pnpm run build`)

**Step 1: Write test (RED)**

Cover Evaluate wrapper behavior:

- dogfood switch selects the CLI backend
- explicit peers and synthesizer flow through provider-neutral preflight
- provider auth/unavailable errors render clearly
- output artifact and records shape remain stable

Run: `pnpm run test:vitest -- tests/consensus/evaluate/wrapper.test.ts tests/consensus/evaluate/output.test.ts`
Expected: Tests fail because Evaluate still relies on current invocation semantics.

**Step 2: Implement (GREEN)**

Wire Evaluate to the same CLI backend selection and preflight path used by Refine, without changing evaluation prompts or artifact rendering.

Run: `pnpm run build && pnpm run test:vitest -- tests/consensus/evaluate/wrapper.test.ts tests/consensus/evaluate/output.test.ts`
Expected: Tests pass and generated evaluate runtime updates.

**Step 3: Refactor**

Share wrapper-side CLI resolution helpers where doing so reduces duplication without changing runtime dependency posture.

**Step 4: Verify**

Run: `pnpm run build:check`
Expected: Generated outputs are in sync.

**Step 5: Commit**

```bash
git add src/consensus/evaluate/consensus-evaluate.ts tests/consensus/evaluate/wrapper.test.ts tests/consensus/evaluate/output.test.ts plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs
git commit -m "feat(p03-t05): add evaluate provider cli backend switch"
```

---

### Task p03-t06: Add Refine and Evaluate CLI Backend Integration Tests

**Files:**

- Create: `tests/fixtures/bin/consensus`
- Create: `tests/consensus/refine/provider-cli-integration.test.ts`
- Create: `tests/consensus/evaluate/provider-cli-integration.test.ts`
- Modify: `tests/helpers/process.mjs`

**Step 1: Write test (RED)**

Use a stub `consensus` executable to assert:

- Refine completes a mocked CLI-backed run
- Evaluate completes a mocked CLI-backed run
- JSONL/audit records contain provider-neutral raw response and diagnostics
- resume reads CLI-backed records
- provider-level terminal `ok:false` is not double-retried by the loop

Run: `pnpm run test:vitest -- tests/consensus/refine/provider-cli-integration.test.ts tests/consensus/evaluate/provider-cli-integration.test.ts`
Expected: Tests fail until wrappers and loop integration are complete.

**Step 2: Implement (GREEN)**

Add only test fixtures/helpers needed to drive the CLI backend through public wrapper surfaces.

Run: `pnpm run test:vitest -- tests/consensus/refine/provider-cli-integration.test.ts tests/consensus/evaluate/provider-cli-integration.test.ts`
Expected: Tests pass.

**Step 3: Refactor**

Keep fixture protocol documented in comments because later cleanup will remove old backend fixtures.

**Step 4: Verify**

Run: `pnpm run test:vitest -- tests/consensus/refine/provider-cli-integration.test.ts tests/consensus/evaluate/provider-cli-integration.test.ts tests/consensus/core/provider-retry-boundary.test.ts`
Expected: Integration and retry-boundary tests pass.

**Step 5: Commit**

```bash
git add tests/fixtures/bin/consensus tests/consensus/refine/provider-cli-integration.test.ts tests/consensus/evaluate/provider-cli-integration.test.ts tests/helpers/process.mjs
git commit -m "test(p03-t06): cover consensus cli backend integration"
```

---

### Task p03-t07: Extend Smoke Coverage for the CLI Backend

**Files:**

- Modify: `scripts/smoke-test.mjs`
- Modify: `tests/release/smoke-test-script.test.ts`

**Step 1: Write test (RED)**

Add a release smoke test assertion that the mocked end-to-end flow can run through the CLI backend switch and still validate wrapper output.

Run: `pnpm run test:vitest -- tests/release/smoke-test-script.test.ts`
Expected: Test fails until smoke script supports the CLI backend mode.

**Step 2: Implement (GREEN)**

Add a smoke-script option or environment mode that selects the CLI backend with stubbed provider output.

Run: `pnpm run test:vitest -- tests/release/smoke-test-script.test.ts`
Expected: Test passes.

**Step 3: Refactor**

Keep old backend smoke behavior available until phase 4 cutover.

**Step 4: Verify**

Run: `pnpm run smoke`
Expected: Mocked end-to-end smoke flow passes.

**Step 5: Commit**

```bash
git add scripts/smoke-test.mjs tests/release/smoke-test-script.test.ts
git commit -m "test(p03-t07): add provider cli backend smoke coverage"
```

---

## Phase 4: Dogfood, Default Cutover, and Source Cleanup

Goal: prove the CLI backend on new runs, switch defaults, remove old backend scaffolding, and enforce a provider-neutral source tree.

### Task p04-t01: Update Consensus Skill Instructions and Operator Docs

**Files:**

- Modify: `plugins/consensus/skills/refine/SKILL.md`
- Modify: `plugins/consensus/skills/evaluate/SKILL.md`
- Modify: `plugins/consensus/skills/refine/references/operator-qa.md`
- Modify: `plugins/consensus/skills/evaluate/references/operator-qa.md`
- Modify: `plugins/consensus/README.md`
- Modify: `README.md`

**Step 1: Write test (RED)**

Update docs/frontmatter tests to expect:

- `node` and `consensus` CLI permission language instead of old backend command language
- provider-neutral preflight instructions
- Cursor auth-required guidance framed through provider inventory
- no public claims for future providers beyond extension points

Run: `pnpm run test:vitest -- tests/repo/skill-frontmatter.test.ts tests/repo/readme-scope.test.ts`
Expected: Tests fail until docs are updated.

**Step 2: Implement (GREEN)**

Update maintained docs and skill instructions to describe the CLI backend and provider-neutral diagnostics.

Run: `pnpm run test:vitest -- tests/repo/skill-frontmatter.test.ts tests/repo/readme-scope.test.ts`
Expected: Tests pass.

**Step 3: Refactor**

Keep old `.oat` artifacts and research untouched.

**Step 4: Verify**

Run: `pnpm run validate`
Expected: Repository structure and docs validation pass.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/refine/SKILL.md plugins/consensus/skills/evaluate/SKILL.md plugins/consensus/skills/refine/references/operator-qa.md plugins/consensus/skills/evaluate/references/operator-qa.md plugins/consensus/README.md README.md tests/repo/skill-frontmatter.test.ts tests/repo/readme-scope.test.ts
git commit -m "docs(p04-t01): update consensus provider cli instructions"
```

---

### Task p04-t02: Record Cursor Submit-Tool Spike Outcome

**Files:**

- Create: `.oat/projects/shared/consensus-peer-invocation/research/cursor-submit-tool-spike.md`
- Modify: `src/consensus/provider-cli/adapters.ts`
- Modify: `tests/consensus/provider-cli/adapters.test.ts`
- Modify: `tests/consensus/provider-cli/structured-output.test.ts`

**Step 1: Write test (RED)**

Keep automated tests asserting `submit_tool_candidate` is not selected by default unless the spike records a concrete acceptance decision and the implementation explicitly enables it.

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/adapters.test.ts tests/consensus/provider-cli/structured-output.test.ts`
Expected: Tests fail only if submit-tool is accidentally selected.

**Step 2: Implement (GREEN)**

Record the Cursor SDK/manual investigation result if credentials are available. If credentials are not available or the path is still uncertain, record an explicit deferral rather than blocking the cutover. The note must choose one of:

- accepted with reliability/audit/local-cloud/dependency evidence and follow-up implementation task
- deferred with reason and current prompt-only/provider-validated posture retained

Keep first-scope implementation viable when deferred.

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/adapters.test.ts tests/consensus/provider-cli/structured-output.test.ts`
Expected: Tests pass with the recorded decision.

**Step 3: Refactor**

If the spike is deferred, keep the adapter capability as reserved and do not add runtime SDK dependencies.

**Step 4: Verify**

Run: `pnpm run type-check`
Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add .oat/projects/shared/consensus-peer-invocation/research/cursor-submit-tool-spike.md src/consensus/provider-cli/adapters.ts tests/consensus/provider-cli/adapters.test.ts tests/consensus/provider-cli/structured-output.test.ts
git commit -m "docs(p04-t02): record cursor submit tool spike outcome"
```

---

### Task p04-t03: Record Provider CLI Dogfood Parity Evidence

**Files:**

- Create: `.oat/projects/shared/consensus-peer-invocation/research/provider-cli-dogfood-parity.md`
- Modify: `plugins/consensus/skills/refine/references/operator-qa.md`
- Modify: `plugins/consensus/skills/evaluate/references/operator-qa.md`

**Step 1: Write test (RED)**

Run the automated parity checks and collect any live-provider dogfood commands that are available on the operator machine.

Run: `pnpm run build:check && pnpm run test && pnpm run smoke`
Expected: Automated mocked parity checks pass before recording cutover readiness.

**Step 2: Implement (GREEN)**

Write a dogfood parity note that records:

- automated test/build/smoke evidence
- Refine CLI-backed dogfood result or explicit reason it could not run
- Evaluate CLI-backed dogfood result or explicit reason it could not run
- provider inventory/preflight output summary for Claude, Codex, and Cursor
- explicit decision: acceptable to cut over, or blocked

Update operator QA references with the dogfood checklist if the existing docs do not already cover it.

Run: `pnpm run validate`
Expected: Validation passes.

**Step 3: Refactor**

Do not proceed to p04-t04 unless this note records acceptable parity evidence or an explicit user-approved risk acceptance.

**Step 4: Verify**

Run: `pnpm run build:check && pnpm run test && pnpm run smoke`
Expected: Automated parity checks still pass after documentation updates.

**Step 5: Commit**

```bash
git add .oat/projects/shared/consensus-peer-invocation/research/provider-cli-dogfood-parity.md plugins/consensus/skills/refine/references/operator-qa.md plugins/consensus/skills/evaluate/references/operator-qa.md
git commit -m "docs(p04-t03): record provider cli dogfood parity"
```

---

### Task p04-t04: Switch Default Backend and Remove Dogfood Fallback

**Files:**

- Modify: `src/consensus/core/consensus-loop.ts`
- Modify: `src/consensus/refine/consensus-refine.ts`
- Modify: `src/consensus/evaluate/consensus-evaluate.ts`
- Modify: `tests/consensus/refine/wrapper-options.test.ts`
- Modify: `tests/consensus/evaluate/wrapper.test.ts`
- Modify: `scripts/smoke-test.mjs`
- Modify: generated consensus runtime outputs under `plugins/consensus/`

**Step 1: Write test (RED)**

Update tests so the provider CLI backend is the default for new runs and old backend fallback flags/env vars are rejected or absent.

Run: `pnpm run test:vitest -- tests/consensus/refine/wrapper-options.test.ts tests/consensus/evaluate/wrapper.test.ts tests/release/smoke-test-script.test.ts`
Expected: Tests fail while fallback remains default.

**Step 2: Implement (GREEN)**

Remove temporary dogfood fallback scaffolding and make the provider CLI backend the only runtime path for new runs.

Run: `pnpm run build && pnpm run test:vitest -- tests/consensus/refine/wrapper-options.test.ts tests/consensus/evaluate/wrapper.test.ts tests/release/smoke-test-script.test.ts`
Expected: Tests pass and generated outputs update.

**Step 3: Refactor**

Remove obsolete fallback switches, env vars, and remediation text while keeping provider-neutral remediation.

**Step 4: Verify**

Run: `pnpm run smoke`
Expected: Mocked end-to-end consensus smoke passes on the provider CLI backend.

**Step 5: Commit**

```bash
git add src/consensus/core/consensus-loop.ts src/consensus/refine/consensus-refine.ts src/consensus/evaluate/consensus-evaluate.ts tests/consensus/refine/wrapper-options.test.ts tests/consensus/evaluate/wrapper.test.ts scripts/smoke-test.mjs plugins/consensus
git commit -m "feat(p04-t04): switch consensus wrappers to provider cli backend"
```

---

### Task p04-t05: Remove Old Backend Helpers, Fixtures, and Test Names

**Files:**

- Delete: `scripts/install-paseo.mjs`
- Delete: `tests/release/install-paseo.test.ts`
- Delete: `tests/fixtures/bin/paseo`
- Rename: `tests/consensus/refine/paseo-invocation.test.ts` -> `tests/consensus/refine/provider-subprocess.test.ts`
- Modify: `tests/helpers/process.mjs`
- Modify: `tests/AGENTS.md`
- Modify: `tests/release/versioning.test.ts`
- Modify: `tests/repo/package-metadata.test.ts`

**Step 1: Write test (RED)**

Use existing release/repo tests and the renamed provider subprocess tests to identify old helper references.

Run: `pnpm run test:vitest -- tests/release/versioning.test.ts tests/repo/package-metadata.test.ts tests/consensus/refine/paseo-invocation.test.ts`
Expected: Tests fail while old helper names and fixtures remain.

**Step 2: Implement (GREEN)**

Remove the install helper and old stub fixture. Rename/refactor old invocation tests to `tests/consensus/refine/provider-subprocess.test.ts` and replace old stub environment variables with the new `consensus` fixture.

Run: `pnpm run test:vitest -- tests/release/versioning.test.ts tests/repo/package-metadata.test.ts tests/consensus/refine/provider-subprocess.test.ts`
Expected: Tests pass.

**Step 3: Refactor**

Keep any release note wording factual and do not claim marketplace/provider support beyond verified paths.

**Step 4: Verify**

Run: `pnpm run validate`
Expected: Validation passes after removed files are no longer referenced.

**Step 5: Commit**

```bash
git add -A scripts/install-paseo.mjs tests/release/install-paseo.test.ts tests/fixtures/bin/paseo tests/consensus/refine/paseo-invocation.test.ts tests/consensus/refine/provider-subprocess.test.ts tests/helpers/process.mjs tests/AGENTS.md tests/release/versioning.test.ts tests/repo/package-metadata.test.ts
git commit -m "refactor(p04-t05): remove old provider backend helpers"
```

---

### Task p04-t06: Add Provider-Neutral Identifier Scan

**Files:**

- Create: `tests/consensus/provider-cli/source-cleanup.test.ts`
- Modify: `tests/tooling/vitest-config.test.ts`

**Step 1: Write test (RED)**

Add a static scan that fails if maintained source/runtime/tests/docs contain old backend identifiers after cleanup. The scan should include:

- `src/`
- `plugins/consensus/`
- `tests/`
- `scripts/`
- `README.md`, `RELEASING.md`, `CONTRIBUTING.md`

Exclude historical `.oat` artifacts, research files, and generated dependency metadata that is outside maintained source scope.

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/source-cleanup.test.ts`
Expected: Test fails if p04-t01 through p04-t05 missed a maintained old-backend identifier.

**Step 2: Implement (GREEN)**

Add the scan and fix any remaining maintained source identifiers it exposes.

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/source-cleanup.test.ts`
Expected: Static scan passes.

**Step 3: Refactor**

Make exclusions explicit so historical `.oat` research remains readable.

**Step 4: Verify**

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/source-cleanup.test.ts`
Expected: Static scan passes.

**Step 5: Commit**

```bash
git add tests/consensus/provider-cli/source-cleanup.test.ts tests/tooling/vitest-config.test.ts
git commit -m "test(p04-t06): add provider-neutral source cleanup scan"
```

---

### Task p04-t07: Run Final Validation and Update Release Docs

**Files:**

- Modify: `RELEASING.md`
- Modify: `plugins/consensus/README.md`
- Modify: `README.md`
- Modify: generated runtime outputs if `pnpm run build` changes them

**Step 1: Write test (RED)**

Run the cleanup scan and full validation stack to expose any stale source/docs/generated references.

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/source-cleanup.test.ts`
Expected: Test fails if any maintained old backend identifiers remain.

**Step 2: Implement (GREEN)**

Update release/operator docs to describe provider CLI verification, local provider auth checks, and known provider limitations without stale old-backend claims.

Run: `pnpm run test:vitest -- tests/consensus/provider-cli/source-cleanup.test.ts`
Expected: Static scan passes.

**Step 3: Refactor**

Keep release wording narrow: do not claim live provider support until operator dogfood evidence exists.

**Step 4: Verify**

Run: `pnpm run premerge`
Expected: Full premerge-equivalent checks pass.

**Step 5: Commit**

```bash
git add RELEASING.md plugins/consensus/README.md README.md plugins/consensus
git commit -m "docs(p04-t07): finish provider cli cutover verification"
```

---

## Reviews

| Scope  | Type     | Status  | Date | Artifact |
| ------ | -------- | ------- | ---- | -------- |
| p01    | code     | passed  | 2026-06-19 | `.oat/projects/shared/consensus-peer-invocation/reviews/archived/p01-review-2026-06-19-v2.md` |
| p02    | code     | passed  | 2026-06-19 | `.oat/projects/shared/consensus-peer-invocation/reviews/archived/p02-review-2026-06-19-v4.md` |
| p03    | code     | passed  | 2026-06-19 | `.oat/projects/shared/consensus-peer-invocation/reviews/archived/p03-review-2026-06-19-v2.md` |
| p04    | code     | passed  | 2026-06-19 | `.oat/projects/shared/consensus-peer-invocation/reviews/archived/p04-review-2026-06-19-v2.md` |
| final  | code     | passed  | 2026-06-19 | `.oat/projects/shared/consensus-peer-invocation/reviews/archived/final-review-2026-06-19-v3.md` |
| spec   | artifact | pending | -    | -        |
| design | artifact | pending | -    | -        |
| plan   | artifact | passed  | 2026-06-19 | inline plan artifact review |

**Status values:** `pending` -> `received` -> `fixes_added` -> `fixes_completed` -> `passed`

**Meaning:**

- `received`: review artifact exists but findings have not yet been converted into fix tasks.
- `fixes_added`: fix tasks were added to the plan.
- `fixes_completed`: fix tasks implemented, awaiting re-review.
- `passed`: re-review run and recorded as passing with no Critical/Important findings.

---

## Implementation Complete

**Summary:**

- Phase 1: 6 tasks - CLI contract, argument parsing, envelopes, generated entrypoint, provider list/preflight skeleton, and process contract tests.
- Phase 2: 7 tasks - provider adapters, readiness probes, host guard, runtime policy, invocation builders, subprocess runner, and structured-output retries.
- Phase 3: 7 tasks - consensus-loop invoker seam, provider-neutral audit/resume, retry boundary, Refine/Evaluate backend switches, integration tests, and smoke coverage.
- Phase 4: 7 tasks - docs update, Cursor submit-tool spike outcome, dogfood parity evidence, default cutover, old backend cleanup, identifier scan, and final verification.

**Total: 27 tasks**

Ready for implementation after plan review passes and `oat-project-implement` confirms HiLL checkpoints.

---

## References

- Design: `design.md`
- Spec: `spec.md`
- Discovery: `discovery.md`
- Research synthesis: `research/synthesized/consensus-peer-invocation-research-synthesis-gpt-5.md`
- Build mapping: `scripts/build-generated.mjs`
- Generated consensus runtimes: `plugins/consensus/skills/refine/scripts/`, `plugins/consensus/skills/evaluate/scripts/`
- Proposed generated CLI runtime: `plugins/consensus/scripts/consensus.mjs`
