---
oat_generated: true
oat_generated_at: 2026-08-31
oat_source_head_sha: ae313c5bb6e54d521b4b00d0f44993b8fdf72ecc
oat_source_main_merge_base_sha: 467efe57bcb5e40b2cfb09c77507aa50e4c1cc44
oat_warning: 'GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index'
---

# Architecture

**Analysis Date:** 2026-08-31

## Pattern Overview

**Overall:** A distribution-first Node ESM repository: canonical TypeScript runtime modules in `src/` are compiled into committed, provider-loadable `.mjs` files under `plugins/consensus/` and selected standalone directories under `skills/`.

**Key Characteristics:**

- The two authored runtime domains are the Consensus peer-deliberation system (`src/consensus/`) and transcript observation/export (`src/transcript/`); their shipped surfaces are declared by the mapping array in `scripts/build-generated.mjs`.
- Consensus separates workflow wrappers (`src/consensus/create/`, `src/consensus/decide/`, `src/consensus/plan/`, `src/consensus/refine/`, `src/consensus/evaluate/`, and `src/consensus/panel/`) from the reusable loop, config, and provider-command layers.
- Provider-specific packaging is metadata and distribution around one Consensus implementation: the provider manifests in `plugins/consensus/.claude-plugin/plugin.json`, `plugins/consensus/.codex-plugin/plugin.json`, and `plugins/consensus/.cursor-plugin/plugin.json` identify the same `plugins/consensus/` package.
- The two generated standalone tools share transcript parsing primitives: `src/transcript/core/runtimes.ts`, `src/transcript/core/cursor-frames.ts`, and `src/transcript/core/cursor-analysis.ts` each have separate generated copies for `skills/session-observer/` and `skills/export-session-transcript/`.
- `skills/session-observer-collab/` is a distinct shipped-runtime boundary. Its `.mjs` controls, adapters, and hooks are authored files paired with `.d.ts` declarations rather than outputs of `scripts/build-generated.mjs`, as described in `AGENTS.md` and evidenced by that build mapping's omission of this directory.

## Layers

**Skill and plugin contracts:**

- Purpose: Declare the agent-facing workflows, user-facing instructions, and provider install metadata.
- Location: `plugins/consensus/skills/*/SKILL.md`, `skills/*/SKILL.md`, and `plugins/consensus/.{claude,codex,cursor}-plugin/plugin.json`.
- Contains: Consensus workflow descriptions and schemas; standalone skill instructions; marketplace package metadata.
- Depends on: Generated runtime scripts in the adjacent `scripts/` directories and the plugin CLI at `plugins/consensus/scripts/consensus.mjs`.
- Used by: Claude Code, Codex, and Cursor plugin/skill loading, as surfaced by the marketplace manifests in `.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`, and `.cursor-plugin/marketplace.json`.

**Consensus workflow wrappers:**

- Purpose: Parse a workflow's input, resolve run paths and peer configuration, invoke the common deliberation/provider mechanics, and render workflow-specific artifacts.
- Location: `src/consensus/create/consensus-create.ts`, `src/consensus/decide/consensus-decide.ts`, `src/consensus/plan/consensus-plan.ts`, `src/consensus/refine/consensus-refine.ts`, `src/consensus/evaluate/consensus-evaluate.ts`, and `src/consensus/panel/consensus-panel.ts`.
- Contains: Argument parsing, prompt and artifact rendering, output/run directory state, schema selection, and executable entrypoint handling.
- Depends on: `src/consensus/core/`, `src/consensus/config/consensus-config.ts`, `src/consensus/provider-cli/`, and `src/consensus/shared/cli-helpers.ts`; refine additionally divides responsibilities among `src/consensus/refine/refine-*.ts` modules.
- Used by: Generated scripts in `plugins/consensus/skills/{create,decide,plan,refine,evaluate,panel}/scripts/`.

**Consensus loop core:**

- Purpose: Execute alternating and parallel peer deliberation, validate turns, maintain an auditable record, and stop on convergence, impasse, escalation, or round limits.
- Location: `src/consensus/core/consensus-loop.ts` with focused modules `loop-args.ts`, `loop-escalation.ts`, `loop-prompts.ts`, `loop-provider.ts`, `loop-records.ts`, `loop-rounds.ts`, `loop-types.ts`, and `loop-validation.ts`.
- Contains: Loop state/status types, records, turn/synthesis orchestration, schema/argument validation, and error-to-exit handling.
- Depends on: Provider invocation through `src/consensus/provider-cli/` and workflow-supplied prompt/schema/rendering inputs.
- Used by: The create, decide, plan, refine, and evaluate wrappers. `src/consensus/panel/consensus-panel.ts` instead runs independent attributed panel responses without the convergence loop.

**Consensus provider CLI and configuration:**

- Purpose: Present one JSON-envelope command boundary for provider inventory, preflight, configuration, structured `run`, and verdict `submit` operations.
- Location: `src/consensus/provider-cli/` and `src/consensus/config/consensus-config.ts`.
- Contains: CLI entrypoint in `cli.ts`, command dispatch in `commands.ts`, parsed command contracts in `args.ts`, adapters in `adapters.ts`, provider command construction in `invocation.ts`, subprocess control in `subprocess.ts`, and structured-output/schema validation in `structured-output.ts` and `schema-validate.ts`.
- Depends on: Node subprocess/file APIs and registered provider CLI executables declared in `src/consensus/provider-cli/adapters.ts`.
- Used by: Consensus wrappers through generated `plugins/consensus/scripts/consensus.mjs`; `plugins/consensus/skills/phone-a-friend/SKILL.md` directs its one-shot advisory workflow to this CLI rather than to a dedicated wrapper.

**Transcript primitives and standalone CLIs:**

- Purpose: Normalize Claude Code, Codex, and Cursor transcript data; inspect another session incrementally; or export this session after structural/content sanitization.
- Location: Shared primitives in `src/transcript/core/`; observer modules in `src/transcript/session-observer/`; export modules in `src/transcript/export-session/`.
- Contains: Runtime discovery/record normalization in `runtimes.ts`, Cursor frame handling in `cursor-frames.ts` and `cursor-analysis.ts`, the observer CLI in `session-observer.ts`, observer state/watch/digest modules in `src/transcript/session-observer/lib/`, and the export CLI plus sanitizer in `src/transcript/export-session/`.
- Depends on: Local transcript stores, Node filesystem APIs, and the common transcript-core modules.
- Used by: Generated executable files in `skills/session-observer/scripts/` and `skills/export-session-transcript/scripts/`.

**Build, test, validation, and documentation support:**

- Purpose: Compile runtime distributions, test source and distribution contracts, validate repository/skill metadata, and render the documentation site.
- Location: `scripts/`, `tests/`, and `documentation/`.
- Contains: The explicit source-to-output registry in `scripts/build-generated.mjs`, test launch in `scripts/run-vitest.mjs`, repository validation in `scripts/validate.mjs`, and a standalone Next/Fumadocs application under `documentation/`.
- Depends on: Root developer tooling declared in `package.json`; documentation has its own package boundary in `documentation/package.json`.
- Used by: Root package scripts in `package.json` and CI workflows under `.github/workflows/`.

## Data Flow

**Consensus convergence workflow (create, decide, plan, refine, or evaluate):**

1. A provider loads a skill contract such as `plugins/consensus/skills/refine/SKILL.md` and executes its generated wrapper, for example `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`.
2. The wrapper's canonical source, `src/consensus/refine/consensus-refine.ts`, parses inputs, resolves a run directory, reads configuration through generated `consensus-config.mjs`, and prepares workflow-specific schemas and prompts.
3. The wrapper calls the common loop modules generated from `src/consensus/core/`; the loop uses `loop-provider.ts` to invoke the generated Consensus CLI.
4. `plugins/consensus/scripts/consensus.mjs`, built from `src/consensus/provider-cli/cli.ts`, routes commands to `commands.ts`; adapters and invocation builders select and run an installed Claude, Codex, or Cursor executable under the request's runtime policy.
5. `src/consensus/provider-cli/structured-output.ts` returns a normalized envelope; core validation and record modules evaluate the verdict/schema and persist loop state for the wrapper to render into its final Markdown artifact.

**Consensus panel and one-shot advisory workflows:**

1. `plugins/consensus/skills/panel/scripts/consensus-panel.mjs` runs the generated source from `src/consensus/panel/consensus-panel.ts`, resolving the configured panelists and the panel response schema in `plugins/consensus/skills/panel/schemas/panel-response.schema.json`.
2. The panel wrapper issues provider CLI requests and writes attributed responses without using the convergence loop, as shown by its direct `src/consensus/provider-cli/` imports.
3. `plugins/consensus/skills/phone-a-friend/SKILL.md` invokes `plugins/consensus/scripts/consensus.mjs run` with `plugins/consensus/skills/phone-a-friend/schemas/advisory.schema.json`, yielding a single provider CLI envelope.

**Session observation:**

1. The generated `skills/session-observer/scripts/session-observer.mjs` parses a review, catch-up, location, state, watch, or watch-control request from canonical `src/transcript/session-observer/session-observer.ts`.
2. Discovery and identity resolution in `src/transcript/session-observer/lib/locate.ts` use transcript-runtime primitives in `src/transcript/core/` to locate eligible local session files.
3. `src/transcript/session-observer/lib/observe.ts`, `digest.ts`, and `rank.ts` turn new transcript records into a bounded digest; the watcher path uses `watch.ts` and `watch-state.ts`.
4. `src/transcript/session-observer/lib/state.ts` persists session offsets and state; `watch-state.ts` persists watcher metadata. Both default to `~/.local/state/session-observer/` unless `STATE_DIR` is set.

**Session export:**

1. The generated `skills/export-session-transcript/scripts/export-session-transcript.mjs` starts in canonical `src/transcript/export-session/export-session-transcript.ts`.
2. It enumerates/reads a selected runtime transcript through the generated transcript-core modules, normalizes entries, then calls `src/transcript/export-session/sanitize.ts` for content filtering.
3. The CLI removes the export marker and empty entries, renders Markdown, and writes the selected output path; its documented pipeline appears in the source header of `src/transcript/export-session/export-session-transcript.ts`.

**State Management:**

- Consensus composition merges user/project configuration in `src/consensus/config/consensus-config.ts`; a project config path is `.consensus/config.json` beneath the invocation cwd. Create, decide, plan, and evaluate write `input.md`, `records.json`, `output.md`, and `status.json` under their resolved run directory, as defined in their respective wrapper sources.
- Refine manages section-oriented manifests, state, resume data, and safe writes through `src/consensus/refine/refine-manifest.ts`, `refine-resume.ts`, and `refine-shared.ts`.
- Session-observer owns durable per-session and watch state in `src/transcript/session-observer/lib/state.ts` and `watch-state.ts`; transcript export does not persist transcript state in its source flow.

## Key Abstractions

**Generated-output registry:**

- Purpose: Make every committed runtime distribution traceable to canonical TypeScript.
- Examples: `scripts/build-generated.mjs`, `plugins/consensus/scripts/consensus.mjs`, `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`, and `skills/session-observer/scripts/session-observer.mjs`.
- Pattern: `generatedOutputs` maps one source file to one or more output paths; outputs carry a `// GENERATED by scripts/build-generated.mjs` banner and `scripts/build-generated.mjs --check` compares rebuilt text with committed files.

**Provider adapter and envelope:**

- Purpose: Give workflows a common provider-neutral command/result boundary.
- Examples: `src/consensus/provider-cli/adapters.ts`, `src/consensus/provider-cli/invocation.ts`, `src/consensus/provider-cli/structured-output.ts`, and `src/consensus/provider-cli/envelope.ts`.
- Pattern: A registry maps a provider ID to probe, invocation-builder, capability, and failure-classification functions; commands emit versioned JSON envelopes, including terminal provider outcomes.

**Consensus run state:**

- Purpose: Retain the input, iterative records, output, and terminal status for a workflow run.
- Examples: `statePathsFor()` in `src/consensus/create/consensus-create.ts`, `src/consensus/decide/consensus-decide.ts`, `src/consensus/plan/consensus-plan.ts`, and `src/consensus/evaluate/consensus-evaluate.ts`.
- Pattern: Workflow wrappers resolve a confined run directory and use named paths for input, records, output, and status; the shared loop persists records through `src/consensus/core/loop-records.ts`.

**Transcript runtime projection:**

- Purpose: Shield observer/export features from the different session-record formats of Claude Code, Codex, and Cursor.
- Examples: `src/transcript/core/runtimes.ts`, `src/transcript/core/cursor-frames.ts`, and `src/transcript/core/cursor-analysis.ts`.
- Pattern: Runtime-specific discovery and record parsing feed normalized entries; observer-specific modules consume those entries to rank/digest state, while exporter-specific modules sanitize and render them.

## Entry Points

**Consensus provider CLI:**

- Location: Canonical `src/consensus/provider-cli/cli.ts`; generated runtime `plugins/consensus/scripts/consensus.mjs`.
- Triggers: Consensus workflow wrappers and direct `consensus` commands documented in `plugins/consensus/README.md`.
- Responsibilities: Bind Node process I/O, call `runConsensusCli()`, and set the returned process exit code.

**Consensus workflow CLIs:**

- Location: Canonical wrappers in `src/consensus/{create,decide,plan,refine,evaluate,panel}/`; generated scripts in the matching `plugins/consensus/skills/<name>/scripts/` directory.
- Triggers: The corresponding `SKILL.md` contract under `plugins/consensus/skills/`.
- Responsibilities: Implement each workflow's argument handling, provider/core calls, run-state paths, JSONL status output, and artifact rendering.

**Session observer:**

- Location: Canonical `src/transcript/session-observer/session-observer.ts`; generated runtime `skills/session-observer/scripts/session-observer.mjs`.
- Triggers: The standalone contract `skills/session-observer/SKILL.md` or its Node CLI invocation.
- Responsibilities: Route `review`, `catch-up`, `locate`, `whoami`, `state`, `watch`, `catch-up-then-watch`, and `watch-ctl` subcommands.

**Session transcript exporter:**

- Location: Canonical `src/transcript/export-session/export-session-transcript.ts`; generated runtime `skills/export-session-transcript/scripts/export-session-transcript.mjs`.
- Triggers: The standalone contract `skills/export-session-transcript/SKILL.md` or its Node CLI invocation.
- Responsibilities: Select the current/specified transcript, sanitize visible entries, render Markdown, and write it to the resolved output path.

**Documentation application:**

- Location: `documentation/app/[[...slug]]/page.tsx`, `documentation/app/layout.tsx`, and `documentation/lib/source.ts`.
- Triggers: The `dev`, `build`, and `start` scripts in `documentation/package.json`.
- Responsibilities: Load Fumadocs-generated document content from `documentation/docs/`, render a static docs route, and expose Fumadocs search at `documentation/app/api/search/route.ts`.

## Error Handling

**Strategy:** Validate inputs at each command boundary, normalize provider failures into envelopes, preserve loop terminal states/records, and map top-level exceptions to explicit process exit codes.

**Patterns:**

- `src/consensus/provider-cli/args.ts` throws `ConsensusCliUsageError` for malformed command arguments; `src/consensus/provider-cli/commands.ts` converts command results and errors into stdout JSON envelopes via `envelope.ts`.
- `src/consensus/provider-cli/adapters.ts` classifies missing executables, authentication requirements, unsupported options, and transient provider errors; `subprocess.ts` applies bounded child-process execution.
- `src/consensus/core/loop-rounds.ts`, `loop-provider.ts`, and `loop-validation.ts` use `ConsensusError` codes/exit semantics for invalid loop state, provider responses, and input validation. Top-level catch handlers in `consensus-loop.ts` and workflow wrappers set `process.exitCode`.
- `src/consensus/refine/refine-shared.ts` confines writes to the allowed root, rejects symlink targets, and writes via a temporary file before renaming.
- The observer returns documented numeric CLI outcomes from `src/transcript/session-observer/session-observer.ts`, while state/watch modules surface schema, lock, and recovery errors from `src/transcript/session-observer/lib/state.ts`, `watch-state.ts`, and `cursor-state.ts`.

## Cross-Cutting Concerns

**Logging:** Consensus wrappers emit JSONL lifecycle/status events and persist records/status under their run directories, visible in `src/consensus/refine/consensus-refine.ts` and the create/decide/plan/evaluate wrapper modules. Session-observer watch mode optionally appends JSON events through `src/transcript/session-observer/lib/watch.ts`.

**Validation:** Provider command parsing and request validation live in `src/consensus/provider-cli/args.ts` and `schema-validate.ts`; workflow option validation is scoped in the wrapper and core validation files. Root repository/manifest invariants are checked by `scripts/validate.mjs`, with generated-output consistency covered by `tests/tooling/generated-output-sync.test.ts`.

**Authentication:** The runtime does not implement a separate credential store. Provider readiness/auth-required classification is in `src/consensus/provider-cli/adapters.ts` and `probe.ts`; the invoked provider CLIs remain the authentication boundary.

---

_Architecture analysis: 2026-08-31_
