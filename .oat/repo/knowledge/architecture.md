---
oat_generated: true
oat_generated_at: 2026-06-20
oat_source_head_sha: e4e9348cf8b809448c693ed7182c017048eb4acf
oat_source_main_merge_base_sha: e4e9348cf8b809448c693ed7182c017048eb4acf
oat_warning: 'GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index'
---

# Architecture

**Analysis Date:** 2026-06-20

## Pattern Overview

**Overall:** Multi-module monorepo with canonical TypeScript source, generated Node.js runtime outputs, and provider plugin distribution.

**Key Characteristics:**

- Canonical source lives in `src/` under TypeScript; shipped skills/plugins execute committed `.mjs` generated outputs with no dependencies
- Provider-agnostic core algorithms (consensus loop, transcript adapters) authored once under `src/`, distributed to multiple consumers via generated outputs
- Three distribution targets: `plugins/consensus/` (AI peer deliberation), `skills/session-observer/` (transcript observer), `skills/export-session-transcript/` (sanitized export)
- Build system (`scripts/build-generated.mjs`) rewrites TypeScript imports to `.mjs` paths and bundles only where needed (provider CLI)
- No runtime dependencies on shipped code; developer tooling (tests, type-checking, linting) is Node.js + dev packages only

## Layers

**Source (Canonical):**

- Purpose: Single source of truth for all algorithms and business logic
- Location: `src/consensus/`, `src/transcript/`
- Contains: TypeScript modules for consensus deliberation loop, provider CLI bridge, transcript parsing, session observation, sanitization
- Depends on: Node.js standard library only
- Used by: Build system (generates `.mjs` output), tests (via TypeScript imports)

**Provider CLI (Subprocess Bridge):**

- Purpose: Invoke peer AI agents (Claude, Codex, Cursor) and synthesizers; mediate structured output extraction and permission guards
- Location: `src/consensus/provider-cli/`
- Contains: `cli.ts` (CLI entry point), `commands.ts` (provider list, preflight), `adapters.ts` (per-provider invocation), `structured-output.ts` (output parsing), `probe.ts` (provider readiness checks), `host-guard.ts` (depth/recursion guards)
- Depends on: Spawns local provider CLIs as child processes; reads environment for `CLAUDE_*`, `CURSOR_*` configs
- Used by: Consensus core loop via `invokeConsensusProviderCli()`

**Consensus Core Loop:**

- Purpose: Runs deliberation rounds (alternating or parallel modes) between two AI peers, implements convergence logic, respects iteration modes, handles escalation
- Location: `src/consensus/core/consensus-loop.ts`
- Contains: `runConsensusLoop()` function, verdict/synthesis payload types, loop options interface, artifact hashing, file confinement helpers
- Depends on: Provider CLI via subprocess invocation, file I/O with path confinement
- Used by: `consensus-refine.ts` (markdown refinement) and `consensus-evaluate.ts` (rubric evaluation)

**Consensus Wrappers:**

- Purpose: Entry points for end-user skill workflows; parse CLI args, load artifacts, run loop, emit JSONL events, handle resume state
- Locations: `src/consensus/refine/consensus-refine.ts`, `src/consensus/evaluate/consensus-evaluate.ts`
- Contains: CLI argument parsing (flags like `--goal`, `--iteration`, `--agency`), file read/write with 1 MiB cap, section parsing (refine) or rubric loading (evaluate), JSONL event emission
- Depends on: Consensus core loop, provider CLI
- Used by: Generated `.mjs` scripts shipped under `plugins/consensus/skills/`

**Transcript Core (Multi-Runtime Adapters):**

- Purpose: Single source of truth for per-runtime transcript location, record shape, and schema
- Location: `src/transcript/core/runtimes.ts`
- Contains: Runtime discovery (`discoverPaths()`), cwd encoding, session metadata extraction, record normalization (drops tool calls, command messages by default)
- Depends on: Node.js fs/path APIs, runtime-specific directory structure knowledge (Claude Code: `~/.claude/`, Cursor: `~/.cursor/agent-logs/`, Codex: varies by env)
- Used by: Session observer and export-session-transcript via generated copies

**Session Observer (Transcript Digester):**

- Purpose: Read agent session transcripts, digest changes into markdown, support live watch mode with debounce
- Location: `src/transcript/session-observer/`
- Contains: `session-observer.ts` (CLI, subcommands: review/catch-up/watch/locate/state), `lib/observe.ts` (catch-up logic), `lib/watch.ts` (poll/debounce), `lib/locate.ts` (transcript discovery + ranking), `lib/digest.ts` (record → markdown), `lib/rank.ts` (candidate prioritization), `lib/state.ts` (offset persistence), `lib/watch-state.ts` (watch mode state machine)
- Depends on: Transcript core (runtime adapters), file I/O, readline for subprocess communication
- Used by: Generated `.mjs` scripts under `skills/session-observer/scripts/`

**Export Session Transcript (Sanitizer):**

- Purpose: Export live agent session to clean Markdown; drop environment wrappers, tool calls, subagent payloads, instruction records
- Location: `src/transcript/export-session/`
- Contains: `export-session-transcript.ts` (CLI, session selection by marker or ID), `sanitize.ts` (sanitization pass), normalization via transcript-core
- Depends on: Transcript core, session marker announcement protocol (marker text injected to get session ID)
- Used by: Generated `.mjs` scripts under `skills/export-session-transcript/scripts/`

## Data Flow

**Consensus Refine Workflow:**

1. User runs `consensus-refine.mjs draft.md --goal "..." --iteration alternating`
2. Wrapper loads draft, parses into sections, emits `run_started` event (JSONL)
3. Loop spawns provider CLI subprocess with peer ID and prompt
4. Provider CLI invokes local `claude` CLI, captures JSON output, returns to loop
5. Loop evaluates verdict, writes section artifacts, emits `peer_turn` event
6. Peer 2 invokes similarly; loop checks convergence
7. On convergence or impasse, emits `run_completed` event, writes final artifact + deliberation log
8. Resume from `--resume <artifact>` re-enters with persisted records and optional `--user-direction`

**Consensus Evaluate Workflow:**

1. User runs `consensus-evaluate.mjs artifact.md --rubric rubric.md --iteration parallel_revision`
2. Wrapper loads artifact + rubric, emits `run_started` event
3. Loop spawns both peers in parallel (not alternating); each evaluates against rubric
4. Per-round synthesis (if `--iteration parallel_synthesized`) invokes synthesizer to merge findings
5. Escalation triggered if peers disagree persistently; requires `--host-direction` re-entry
6. Emits `peer_turn`, `synthesis`, `escalation_required` events; final `run_completed`

**Session Observer Catch-Up:**

1. User runs `session-observer.mjs catch-up --runtime codex --cwd $PWD`
2. Locate discovers candidate transcripts for cwd (latest by default; `--session <id>` to select)
3. State file (`~/.session-observer-state.json`) holds per-cwd read offsets
4. Observer reads transcript from last-read offset, builds digest via `digest.ts`
5. Emits Markdown-rendered digest to stdout
6. Updates state offset for next catch-up

**Session Observer Watch Mode:**

1. User runs `session-observer.mjs watch --runtime codex --cwd $PWD`
2. Watch loop polls transcript file on 1s interval (configurable)
3. Detects settled changes (file quiet > debounce window)
4. Emits catch-up digest for new records
5. Continuous writes every `--max-pending-sec` even if file not quiet
6. Watch-ctl socket allows `pause`, `resume`, `status`, `stop` from another terminal

**Export Session Transcript:**

1. Agent announces session marker (unique hex token) early in conversation
2. User runs `export-session-transcript.mjs --match <marker>` or `--session <id>`
3. Script locates matching transcript, reads all records
4. Normalization drops tool calls, command messages
5. Sanitization (export-owned) drops environment wrappers, hidden payloads, instruction records
6. Renders to Markdown, writes to `~/Downloads/` or `--out <path>`

## Key Abstractions

**IterationMode:**

- Purpose: Selects how peers deliberate
- Examples: `alternating` (default for refine: P1 → P2 → P1...), `parallel_revision` (both peers each round), `parallel_synthesized` (parallel + per-round synthesis merge)
- Pattern: Union type at `src/consensus/core/consensus-loop.ts` lines 17–20; branching in loop logic

**VerdictValue:**

- Purpose: Encodes peer evaluation outcome
- Examples: `ACCEPT` (peer accepts previous state), `REVISE` (peer proposes change), `CONVERGED` (both agree), `IMPASSE` (stuck, needs escalation)
- Pattern: Discriminated union; payload shape differs per verdict type (`RevisionVerdictPayload` vs `TerminalVerdictPayload`)

**Runtime (Transcript):**

- Purpose: Abstracts per-provider transcript store location and schema
- Examples: `'claude-code'`, `'codex'`, `'cursor'`
- Pattern: String union at `src/transcript/core/runtimes.ts` line 22; functions `discoverPaths()`, `encodeCwd()`, `normalizeEntries()` dispatch per runtime

**ProviderInventoryEntry:**

- Purpose: Snapshot of a provider's capabilities, status, and guard level
- Examples: `{ id: 'claude', status: 'ready', capabilities: { ... }, guard: 'none' }`
- Pattern: Queried from provider CLI via `provider ls` command; informs feasibility checks in consensus wrappers

**Agency (Escalation Level):**

- Purpose: Controls who breaks impasse: `'minimal'` (no escalation), `'moderate'` (escalate to user), `'maximum'` (escalate to host orchestrator)
- Pattern: Flag `--agency minimal|moderate|maximum`; wrapped peers invoke host-guard logic to prevent recursive consensus infinite loops

**LoopRecord:**

- Purpose: Audit log entry for a consensus round; persisted to disk for resume
- Examples: `{ turn_index: 0, round_index: 1, agent: 'peer-1', verdict: { ... }, timestamp: '...' }`
- Pattern: Array of records written to JSON file, reloadable for `--resume` mode; allows debugging and resumable workflows

## Entry Points

**Consensus Refine CLI:**

- Location: `src/consensus/refine/consensus-refine.ts` (source), `plugins/consensus/skills/refine/scripts/consensus-refine.mjs` (generated)
- Triggers: `node plugins/consensus/skills/refine/scripts/consensus-refine.mjs <draft.md> --goal "..." [options]`
- Responsibilities: Parse CLI args, load draft, invoke consensus loop, emit JSONL events, write output + deliberation artifact

**Consensus Evaluate CLI:**

- Location: `src/consensus/evaluate/consensus-evaluate.ts` (source), `plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs` (generated)
- Triggers: `node plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs <artifact.md> --rubric rubric.md [options]`
- Responsibilities: Load artifact + rubric, invoke loop, evaluate section-by-section, emit findings, write output

**Consensus Provider CLI:**

- Location: `src/consensus/provider-cli/cli.ts` (source), `plugins/consensus/scripts/consensus.mjs` (generated, bundled)
- Triggers: `node plugins/consensus/scripts/consensus.mjs provider ls --json`, `preflight --json`, `run --json <envelope-JSON>`
- Responsibilities: Query provider inventory, preflight readiness checks, invoke peers via subprocess, return structured output

**Session Observer CLI:**

- Location: `src/transcript/session-observer/session-observer.ts`, `skills/session-observer/scripts/session-observer.mjs`
- Triggers: `node skills/session-observer/scripts/session-observer.mjs review|catch-up|watch [options]`
- Responsibilities: Discover transcripts, parse records, emit digest, watch/poll mode orchestration

**Export Session Transcript CLI:**

- Location: `src/transcript/export-session/export-session-transcript.ts`, `skills/export-session-transcript/scripts/export-session-transcript.mjs`
- Triggers: `node skills/export-session-transcript/scripts/export-session-transcript.mjs [--match <marker>|--session <id>] [--out <path>]`
- Responsibilities: Locate session, read + sanitize records, render Markdown, write file

## Error Handling

**Strategy:** Exit codes, JSONL event emission, error envelopes in structured output.

**Patterns:**

- **Provider CLI envelope:** All provider CLI commands return JSON with `{ ok: true, ... }` on success or `{ ok: false, error: { code, message, ... } }` on failure; exit code reflects result
- **EXIT_CODES:** Consensus wrappers define exit code map (e.g., `PROVIDER_UNAVAILABLE = 1`, `INVALID_RESUME = 4`) at `src/consensus/core/consensus-loop.ts`; callers can parse exit code
- **JSONL events:** Consensus wrappers emit JSON lines to stdout (refine, evaluate); each line is `{ event: "...", ... }`; on error, emits `{ event: "error", code: "...", message: "..." }` followed by exit
- **File confinement:** Wrappers use `confineWrite()` / `resolveOutputPath()` helpers to prevent path traversal; enforce 1 MiB read cap on input files
- **Transcript parsing:** Session observer handles missing/corrupt transcript files gracefully; emits diagnostics; falls back to no-match exit code if not found

## Cross-Cutting Concerns

**Logging:** JSONL event stream to stdout (consensus wrappers, session observer watch). Debugging info (provider CLI invocations, peer responses) written to stderr or captured in deliberation artifact.

**Validation:** 
- Provider preflight check verifies installed provider CLIs and capabilities before expensive runs
- Consensus resume artifact validation ensures section state and record integrity before reloading
- Transcript format validation via per-runtime schema; mismatches yield diagnostics

**Authentication:** 
- Delegated to local provider CLIs; consensus/transcript code does not handle keys
- Provider CLI inherits host environment (e.g., `ANTHROPIC_API_KEY`) and subprocess CLI home directory
- Host guard prevents recursive consensus invocations (depth tracking via `CONSENSUS_DEPTH` env var)

---

_Architecture analysis: 2026-06-20_
