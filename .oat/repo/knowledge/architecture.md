---
oat_generated: true
oat_generated_at: 2026-07-11
oat_source_head_sha: 0e25a36d3958a1e09c7bedaddd6d3498dc0905d7
oat_source_main_merge_base_sha: 17043d653233fb906e018f5872359d99eb556208
oat_warning: "GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index"
---

# Architecture

**Analysis Date:** 2026-07-11

## Pattern Overview

**Overall:** Canonical TypeScript source → generated dependency-free ESM runtime with single-provider CLI boundary.

The repo enforces **no-install-step shipping**: committed `.mjs` runtime outputs under `plugins/` and `skills/` carry no dependencies and use only Node.js standard library. Canonical logic lives in TypeScript under `src/`, built to committed ESM by `pnpm run build` using esbuild + import rewriting.

**Key Characteristics:**

- Single source of truth: canonical TypeScript in `src/`, never hand-edited `.mjs` outputs
- Build separation: TypeScript is developer-only; shipped runtimes are dependency-free Node ESM
- External boundary: provider CLI (Claude, Codex, Cursor) is the sole external integration, invoked as subprocess with structured input/output
- Generated copies: shared logic (transcript-core runtimes, consensus loop core) regenerated per-consumer skill to maintain independence
- Drift guards: build-check (`pnpm run build:check`) and tests (`tests/tooling/generated-output-sync.test.ts`) enforce consistency

## Layers

**Consensus Core Loop** (`src/consensus/core/consensus-loop.ts`):

- Purpose: Orchestrate iterative peer-feedback rounds; manage artifact convergence, verdict parsing, synthesis, and escalation detection
- Location: `src/consensus/core/`
- Contains: Loop execution engine, round/turn abstractions, verdict/synthesis payload types, convergence heuristics
- Depends on: Provider CLI types/invocation, configuration resolution
- Used by: Consensus skills (decide, create, plan, refine, evaluate) and decision/iteration strategies

**Provider CLI Integration** (`src/consensus/provider-cli/`):

- Purpose: Mediate all external agent invocation through structured subprocess calls; handle output parsing, schema validation, retry logic, host-environment guards
- Location: `src/consensus/provider-cli/`
- Contains: CLI argument parsing, provider registry/capabilities probe, structured output extraction, subprocess spawning, host context guards, submit capture limits
- Depends on: Node child_process, config, types
- Used by: Consensus loop, individual skills, inventory/config commands

**Consensus Skills** (consensus `create`, `decide`, `plan`, `refine`, `evaluate`, `panel`):

- Purpose: Expose domain-specific workflows (artifact creation, decision-making, planning, refinement, evaluation, panel discussion) as callable entry points
- Location: `src/consensus/{decide,create,plan,refine,evaluate,panel}/` and `plugins/consensus/skills/{skill}/`
- Contains: Skill-specific option parsing, file I/O, state path management, run initialization
- Depends on: Core loop, config, provider CLI, type definitions
- Used by: Provider-specific plugins (Claude plugin manifest, Codex plugin, Cursor agent CLI)

**Session Transcript Capture** (`src/transcript/`):

- Purpose: Extract and track per-provider transcript metadata; support session observation and export
- Location: `src/transcript/session-observer/` (live capture), `src/transcript/export-session/` (export pipeline), `src/transcript/core/` (shared runtime definitions)
- Contains: Runtime-specific transcript shape and query logic, session state tracking, sanitization rules
- Depends on: Standard library only
- Used by: Standalone session-observer and export-session-transcript skills

**Configuration & Composition** (`src/consensus/config/consensus-config.ts`):

- Purpose: Resolve consensus defaults (peers, panelists, panel-size, roles) across user and project scopes; apply scope precedence and workflow-specific overrides
- Location: `src/consensus/config/`
- Contains: Config file I/O (YAML), scope resolution, agent ref parsing, defaults merging
- Depends on: Standard library only (no YAML parser; plain text parsing)
- Used by: All consensus skills, provider CLI config commands

## Data Flow

**Consensus Loop Turn (Alternating or Parallel Mode):**

1. Caller invokes skill (e.g., `consensus-decide`) with options, input artifact, peer list
2. Skill validates inputs, resolves config, prepares state directories (records, status, output)
3. Core loop enters round loop, each round invokes one or more peers:
   - For alternating: serial peer invocations, each peer critiques and proposes next artifact
   - For parallel: concurrent peer invocations, synthesis step converges divergent proposals
4. Provider CLI subprocess is spawned with structured request (provider ID, prompt, schema path, host context)
5. Provider (Claude/Codex/Cursor) executes, returns structured JSON verdict (REVISE/ACCEPT/CONVERGED/IMPASSE)
6. Loop parses verdict, records it, updates artifact if revised, checks convergence conditions
7. After max rounds or convergence, loop terminates; skill writes final artifact + metadata to output path

**Escalation & Intervention:**

- Loop detects escalation triggers: persistent disagreement, oscillation, budget exhausted, near-done drift
- Escalation route determines whether to escalate to host (orchestrator) or user, or auto-resolve (declare done / near-match)
- Host intervention recorded as `USER_INTERVENTION` or `HOST_DECISION` record type

**Shared Transcript-Core Regeneration:**

1. Developer edits canonical source: `src/transcript/core/runtimes.ts` (per-provider transcript shape)
2. Build step invokes `pnpm run build` → esbuild processes, generates copies to:
   - `skills/session-observer/scripts/lib/runtimes.mjs`
   - `skills/export-session-transcript/scripts/lib/runtimes.mjs`
3. Drift check (`pnpm run build:check`) compares committed copies against fresh build output
4. If drift detected, test `tests/tooling/generated-output-sync.test.ts` fails; developer reruns build and commits updates

**State Management:**

- Loop records: JSONL format, one record per turn/round/synthesis event, includes verdict payload + artifact hash + metadata
- Artifact versioning: hash-based (content hash before/after each turn), enables convergence detection
- Status file: final `LoopStatus` written at termination with convergence reason, cost, attempt counts

## Key Abstractions

**LoopRecord:**

- Purpose: Immutable turn/round event log entry
- Examples: `src/consensus/core/consensus-loop.ts` (lines 72–101)
- Pattern: Union type covering synthesis, verdict, intervention, error records; each variant carries schema version + timestamp + context

**PeerVerdictPayload:**

- Purpose: Structured peer response: terminal verdict (ACCEPT/CONVERGED/IMPASSE) or revision verdict (REVISE/ACCEPT_PEER with proposed artifact)
- Examples: `src/consensus/core/consensus-loop.ts` (lines 47–60)
- Pattern: Discriminated union by verdict value; revision variants include proposed_artifact + optional critique

**ConsensusCliRunRequest / ProviderResult:**

- Purpose: Provider CLI wire protocol — request encodes provider ID, prompt, schema path, host context; result decodes JSON output + diagnostics
- Examples: `src/consensus/provider-cli/types.ts` (lines 103–200)
- Pattern: Structured I/O envelope; ProviderDiagnostics tracks strategy used (constrained_native, provider_validated, prompt_only), output mode, exit classification

**IterationMode (alternating vs. parallel_revision vs. parallel_synthesized):**

- Purpose: Control how peers respond and converge
- Examples: Type definition in `src/consensus/core/consensus-loop.ts` (line 19)
- Pattern: Alternating = one peer at a time, proposes next artifact; parallel = concurrent peers, synthesis step merges divergent versions

## Entry Points

**Consensus Skill CLI** (e.g., `consensus-decide`):

- Location: `plugins/consensus/skills/decide/scripts/consensus-decide.mjs` (generated from `src/consensus/decide/consensus-decide.ts`)
- Triggers: Provider plugin invocation (Claude plugin command, Codex skill, Cursor agent call) or direct CLI `node scripts/consensus-decide.mjs [args]`
- Responsibilities: Parse args, load input file, resolve config, initialize loop state, invoke core loop, write output

**Provider CLI Entry** (`consensus run`):

- Location: `src/consensus/provider-cli/cli.ts` (exports Node.js shebang entry + `runConsensusCli`)
- Triggers: Provider agent/plugin calls `consensus run --provider claude [args]` as subprocess
- Responsibilities: Parse structured request from stdin/file, probe provider capabilities, invoke provider, parse/validate output, emit structured envelope

**Session Observer** (`session-observer`):

- Location: `skills/session-observer/scripts/session-observer.mjs` (generated from `src/transcript/session-observer/session-observer.ts`)
- Triggers: Background skill in provider to capture transcript metadata during agent execution
- Responsibilities: Extract runtime context (Claude/Codex/Cursor), poll session state, record transcript snapshots

## Error Handling

**Strategy:** Structured error envelopes with exit codes; provider-level errors captured as ProviderDiagnostics.

**Patterns:**

- ConsensusError: Base error type with exit code; includes provider context (stdout, stderr, diagnostics)
- Retry logic: invokeProviderCliWithRetry in `src/consensus/core/consensus-loop.ts` implements exponential backoff for transient failures
- Submit capture limits: SubmitCaptureLimitError enforces CONSENSUS_SUBMIT_MAX_BYTES_ENV upper bound (prevents DoS)
- Host guard: evaluateHostGuard in `src/consensus/provider-cli/host-guard.ts` gates subprocess invocation if host relation unsafe (e.g., same-host subprocess in different provider)
- Schema validation: validateSchemaSubset in `src/consensus/provider-cli/schema-validate.ts` ensures provider output matches expected JSON schema subset

## Cross-Cutting Concerns

**Logging:** No structured logging framework; output via stdout/stderr WritableLike interface; diagnostics captured in LoopRecord.provider_diagnostics and ProviderDiagnostics.

**Validation:** Input size caps (INPUT_SIZE_CAP_BYTES in `src/consensus/decide/consensus-decide.ts`); provider output schema validation; config key validation (peer/panelist format via PROVIDER_ID_PATTERN); artifact hash normalization (line-ending, trailing whitespace handling).

**Authentication & Host Context:** Provider CLI receives HostContext (runtime, cwd, run_id, depth); used to validate safe-packet requirements and guard against unsafe same-host subprocess dispatch. No built-in auth; delegates to provider CLI (Claude auth via session token, etc.).

**Structured Output Strategy:** Loop respects provider capabilities (constrained_native, provider_validated, prompt_only, submit_tool_candidate); falls back gracefully if capability unavailable; diagnostics record which strategy actually used.
