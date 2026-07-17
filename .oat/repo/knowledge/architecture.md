---
oat_generated: true
oat_generated_at: 2026-07-17
oat_source_head_sha: 6c03afde1417fbe29f0e2c81009629f0e36ca945
oat_source_main_merge_base_sha: 6c03afde1417fbe29f0e2c81009629f0e36ca945
oat_warning: "GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index"
---

# Architecture

**Analysis Date:** 2026-07-17

## Pattern Overview

**Overall:** Consensus deliberation engine with provider CLI abstraction, supporting multi-peer iteration (alternating/parallel modes) and session observation/export capabilities.

**Key Characteristics:**

- Multi-layered architecture: config resolution → core deliberation loop → skills wrappers
- Provider-agnostic CLI subprocess model with probe-time capability discovery
- Schema-bound verdict and synthesis payloads conforming to JSON schemas
- Generated runtime outputs (`.mjs`) from canonical TypeScript source, kept in sync via build step
- Dependency-free Node.js ESM runtime for shipped skills; development tooling uses pnpm
- Three deliberation modes: alternating (sequential turns), parallel_revision (independent drafts with mutual awareness), parallel_synthesized (parallel with synthesis layer)
- Audit trail recorded as JSONL records in run directories; terminal status reports cost, termination reason, artifact hash

## Layers

**Consensus Core Loop:**

- Purpose: Implements deliberation state machine, verdict parsing, synthesis orchestration, escalation detection
- Location: `src/consensus/core/consensus-loop.ts`
- Contains: Iteration modes, verdict types (alternating vs. parallel), loop record structures, turn execution, artifact tracking
- Depends on: Provider CLI types, hash computation, filesystem I/O
- Used by: All skill wrappers (create, decide, plan, refine, evaluate, panel) via import

**Provider CLI Layer:**

- Purpose: Abstracts provider (Claude, Codex, Cursor, or custom) communication via local CLI subprocess; probes capabilities, manages invocation, structured output strategies
- Location: `src/consensus/provider-cli/` (commands.ts, types.ts, adapters.ts, invocation.ts, probe.ts, structured-output.ts)
- Contains: Provider registry, host context detection, structured output modes (stdout_json, json_envelope, sidecar_file), schema validation, retry logic, submission capture
- Depends on: Node subprocess, environment detection, filesystem
- Used by: Consensus loop (via `PeerInvoker` / `SynthesizerInvoker`), provider CLI CLI entrypoint

**Configuration Layer:**

- Purpose: Resolves peer compositions (individual peer selections or scoped defaults), reads/writes per-skill config, merges user/project scope defaults
- Location: `src/consensus/config/consensus-config.ts`
- Contains: Peer registry, role-based panel selection, default config persistence (user/project scope), composition resolution
- Depends on: Filesystem (config directories)
- Used by: All skill wrappers during initialization

**Skills Layer (Deliberation Wrappers):**

- Purpose: Each skill (create, decide, plan, refine, evaluate, panel, phone-a-friend) wraps consensus loop with skill-specific argument parsing, prompt builders, and output rendering
- Location: `src/consensus/{create,decide,plan,refine,evaluate,panel,phone-a-friend}/`
- Contains: Parsed CLI args, input validation, prompt builders (TurnPrompt, ParallelTurnPrompt, SynthesisPrompt), state path management, artifact rendering
- Depends on: Consensus core loop, provider CLI, config layer
- Used by: Generated skill entrypoints (`plugins/consensus/skills/*/scripts/*.mjs`)

**Transcript Core Layer:**

- Purpose: Runtime definitions for transcript formats (Claude Code, Codex, Cursor session message schemas)
- Location: `src/transcript/core/runtimes.ts`
- Contains: Runtime discriminators, message record types, session metadata shapes per provider
- Depends on: TypeScript types only
- Used by: Session-observer, export-session-transcript skills

**Session-Observer Layer:**

- Purpose: Watches provider session directories for new transcripts, extracts changes, computes ranked digests of recent activity, manages state tracking to avoid re-processing
- Location: `src/transcript/session-observer/session-observer.ts` and `lib/` subdirectory
- Contains: State management (watch-state.ts), ranking/filtering (rank.ts), digest computation, environment probing (probe-local.ts)
- Depends on: Transcript core, filesystem watching, Node.js child_process
- Used by: Session-observer skill entry point

**Export-Session-Transcript Layer:**

- Purpose: Exports full or filtered session transcripts in canonical formats
- Location: `src/transcript/export-session/export-session-transcript.ts`
- Contains: Transcript loading, sanitization (sanitize.ts), filtering, output rendering
- Depends on: Transcript core, filesystem I/O
- Used by: Export-session-transcript skill entry point

## Data Flow

**Skill Invocation (e.g., create, refine):**

1. User invokes skill via provider interface → arguments parsed by skill wrapper
2. Wrapper resolves consensus composition (peer list) and defaults from config layers
3. Wrapper constructs LoopOptions and delegates to `runConsensusLoop()`
4. Loop initializes records, resolves artifact (if resume), and enters turn/round execution

**Deliberation Turn (Alternating Mode):**

1. Current artifact + goal passed to `invokePeer()` (peer invocation callback)
2. Peer invocation builds turn prompt, invokes provider CLI subprocess with schema path
3. Provider CLI probes provider (e.g., `claude`) for capabilities, invokes with structured output mode
4. Provider returns verdict (ACCEPT/REVISE/IMPASSE) + optional revision + critique
5. Loop validates verdict against schema, updates artifact if REVISE, writes LoopRecord
6. Loop checks termination conditions (convergence, max rounds, impasse); continues or synthesizes

**Parallel Revision Round:**

1. Both peers receive same artifact + goal; each produces independent revision
2. Both return REVISE or terminal verdicts; loop synthesizes if both REVISE (not converged)
3. Synthesis invocation: calls `invokeSynthesizer()` with both revisions + prior critiques
4. Synthesizer produces merged artifact + synthesis reasoning + unresolved disagreements
5. New artifact replaces working copy; loop enters next round

**Records and Status:**

1. Each turn writes LoopRecord (JSONL) with: timestamp, turn/round index, agent, verdict, reasoning, artifact_hash
2. At termination, final status written with: status (converged/impasse/escalated), termination_reason, final_artifact_hash, cost
3. Skill wrapper reads terminal status and artifact, renders final output (markdown, JSON, or section replacement)

**Session Observation:**

1. Session-observer polls provider session directory (Claude: `~/.claude/projects/<slug>/`, Codex: `~/.codex/sessions/`)
2. For each session file, extracts new messages since prior offset
3. Computes ranked digest of significant messages (assistant responses, user questions)
4. Writes state file with offset + digest; subsequent polls only process new messages

**Transcript Export:**

1. Locates provider session directory from runtime context (Claude Code, Codex, Cursor)
2. Loads full or filtered transcript from JSONL/JSON files
3. Sanitizes sensitive metadata, renders in canonical format (Markdown, JSON)
4. Outputs to stdout or specified file

**State Management:**

- Consensus loop maintains in-memory records list; appends to JSONL on each turn
- Config is merged at invocation time (user defaults + project defaults + CLI overrides)
- Session-observer state is persisted per session (offset + prior digest)
- Run directories (`--run-dir` or `~/.../<skill>/run-<timestamp>/`) isolate concurrent executions

## Key Abstractions

**Verdict Payload:**

- Purpose: Peer response structure validated against skill-specific schema
- Examples: `src/consensus/core/consensus-loop.ts` (PeerVerdictPayload type); `plugins/consensus/skills/refine/schemas/verdict-*.schema.json`
- Pattern: Discriminated union on verdict field (ACCEPT/REVISE/IMPASSE + ACCEPT_PEER/CONVERGED for parallel); includes reasoning, optional critique, optional proposed_artifact

**Loop Record:**

- Purpose: Audit trail entry for each deliberation turn or synthesis
- Examples: `src/consensus/core/consensus-loop.ts` (LoopRecord type); written to `<run-dir>/records.jsonl`
- Pattern: JSON object with timestamp, turn_index, round_index, agent/synthesizer name, verdict (typed or raw), reasoning, artifact/proposed_artifact, metadata

**Prompt Profile:**

- Purpose: Customizable prompt-building strategy for turn/synthesis prompts
- Examples: `src/consensus/core/consensus-loop.ts` (TurnPromptBuilder, SynthesisPromptBuilder types); default implementations in each skill wrapper
- Pattern: Functions accepting turn/synthesis input (goal, artifact, peer history) returning string prompt

**Provider Invocation:**

- Purpose: Encapsulates subprocess invocation logic and capability detection
- Examples: `src/consensus/provider-cli/invocation.ts` (ProviderInvocationArgs, ProviderResult); adapter implementations in `src/consensus/provider-cli/adapters.ts`
- Pattern: Stateless callable taking schema path and prompt, returning structured JSON verdict or error

**Configuration Scope:**

- Purpose: User/project/effective config resolution for peer defaults
- Examples: `src/consensus/config/consensus-config.ts` (ConsensusConfigScope, ConsensusDefaults); stored in `~/.consensus/config.json` (user) or `.consensus/config.json` (project)
- Pattern: Hierarchical merge: effective = project defaults merged with user defaults, CLI overrides both

## Entry Points

**Create Skill:**

- Location: `src/consensus/create/consensus-create.ts` (canonical) → generated `plugins/consensus/skills/create/scripts/consensus-create.mjs` (runtime)
- Triggers: Provider plugin interface or CLI invocation
- Responsibilities: Parse brief/template, resolve peers, run consensus loop with create goal, render artifact to output file/stdout

**Refine Skill:**

- Location: `src/consensus/refine/consensus-refine.ts` (canonical) → generated `plugins/consensus/skills/refine/scripts/consensus-refine.mjs` (runtime)
- Triggers: Provider plugin interface or CLI invocation
- Responsibilities: Parse markdown section, resolve peers, run consensus loop with refine goal, replace section in source file or output full markdown

**Evaluate Skill:**

- Location: `src/consensus/evaluate/consensus-evaluate.ts` (canonical) → generated `plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs` (runtime)
- Triggers: Provider plugin interface or CLI invocation
- Responsibilities: Parse artifact + rubric, resolve peers, run consensus loop with evaluation goal, render verdict/synthesis to section or file

**Decide Skill:**

- Location: `src/consensus/decide/consensus-decide.ts` (canonical) → generated `plugins/consensus/skills/decide/scripts/consensus-decide.mjs` (runtime)
- Triggers: Provider plugin interface or CLI invocation
- Responsibilities: Parse options, resolve peers, run consensus loop with choice goal, render decision to output

**Plan Skill:**

- Location: `src/consensus/plan/consensus-plan.ts` (canonical) → generated `plugins/consensus/skills/plan/scripts/consensus-plan.mjs` (runtime)
- Triggers: Provider plugin interface or CLI invocation
- Responsibilities: Parse goal/constraints, resolve peers, run consensus loop with planning goal, render plan to output

**Panel Skill:**

- Location: `src/consensus/panel/consensus-panel.ts` (canonical) → generated `plugins/consensus/skills/panel/scripts/consensus-panel.mjs` (runtime)
- Triggers: Provider plugin interface or CLI invocation
- Responsibilities: Parse question, resolve panelists, invoke each with same prompt (no consensus loop), render attributed panel responses

**Phone-a-Friend Skill:**

- Location: `src/consensus/{panel or phone}/...` (likely) → generated `plugins/consensus/skills/phone-a-friend/scripts/...` (runtime)
- Triggers: Provider plugin interface or CLI invocation
- Responsibilities: Parse question, select one advisor peer, invoke with advisory schema, render advisory response with reasoning

**Session-Observer Skill:**

- Location: `src/transcript/session-observer/session-observer.ts` (canonical) → generated `skills/session-observer/scripts/session-observer.mjs` (runtime)
- Triggers: Provider plugin interface during active session or manual CLI invocation
- Responsibilities: Detect active session, watch for new transcript entries, rank and digest changes, output digest or state summary

**Export-Session-Transcript Skill:**

- Location: `src/transcript/export-session/export-session-transcript.ts` (canonical) → generated `skills/export-session-transcript/scripts/export-session-transcript.mjs` (runtime)
- Triggers: Manual CLI invocation or provider plugin interface
- Responsibilities: Load full session transcript, filter if requested, sanitize, output in canonical format

**Provider CLI Entrypoint:**

- Location: `src/consensus/provider-cli/cli.ts` (canonical) → generated `plugins/consensus/scripts/consensus.mjs` (runtime)
- Triggers: Skill wrapper subprocess invocation (spawn with args)
- Responsibilities: Parse provider CLI args (run, config, preflight), dispatch to command handler, output JSON envelope (ProviderListEnvelope, ConfigEnvelope, SubmitResult, etc.)

## Error Handling

**Strategy:** Multi-level error classification with retry logic at provider CLI level; escalation and impasse detection at loop level; user/host intervention on terminal conditions.

**Patterns:**

- Provider CLI errors (auth, timeout, output parsing) trigger automatic retry with exponential backoff (retry options in `RetryOptions`)
- Verdict parsing failures mark turn as error record but continue loop (records contain `raw_provider_response` for debugging)
- Termination conditions: convergence (all accept or converged), impasse (repeated rejection loops), max rounds, user/host intervention
- Escalation triggers (e.g., unresolved disagreements exceed threshold) set `escalation_trigger` field in records, caller can decide intervention
- Artifact hash mismatch detection via `hashArtifact()` before/after verdicts to detect unexpected mutations
- Host guard checks prevent unauthorized nested consensus invocations (depth tracking in `HostContext`)
- Input size cap enforced (`INPUT_SIZE_CAP_BYTES` = 1 MiB) to prevent resource exhaustion

## Cross-Cutting Concerns

**Logging:** No built-in logging library. Errors written to stderr via `ConsensusCliIo.stderr`. Records written to JSONL files for audit trail. Provider diagnostics (capabilities, output strategy, exit codes) captured in `ProviderDiagnostics` and serialized in terminal status.

**Validation:** Verdict and synthesis payloads validated against JSON schemas before acceptance. Input sizes checked against `INPUT_SIZE_CAP_BYTES`. Host depth validated against `max_depth` to prevent infinite recursion. Provider ID matched against `PROVIDER_ID_PATTERN` (alphanumeric + dash/underscore, 1-32 chars).

**Authentication:** Provider authentication deferred to local CLI tools (claude, codex, cursor). Provider CLI reports auth_required status if credentials missing. No built-in credential storage; host provides credentials via environment or native auth flow.

**Confinement:** All filesystem writes confined via `confineWrite()` helper to run directory; path traversal blocked. Config reads scoped to user/project config directories. Input reads limited to `INPUT_SIZE_CAP_BYTES`. Run directory path constructed from timestamp + random UUID to ensure uniqueness and isolation.

---

_Architecture analysis: 2026-07-17_
