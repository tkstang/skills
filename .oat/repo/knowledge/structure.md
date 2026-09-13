---
oat_generated: true
oat_generated_at: 2026-08-31
oat_source_head_sha: ae313c5bb6e54d521b4b00d0f44993b8fdf72ecc
oat_source_main_merge_base_sha: 467efe57bcb5e40b2cfb09c77507aa50e4c1cc44
oat_warning: 'GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index'
---

# Codebase Structure

**Analysis Date:** 2026-08-31

## Directory Layout

```
skills/                                      # repository root
├── src/                                     # canonical TypeScript runtime source
│   ├── consensus/                           # Consensus engine and workflow wrappers
│   │   ├── config/                          # persisted peer/default configuration
│   │   ├── core/                            # shared deliberation loop
│   │   ├── provider-cli/                    # provider-neutral CLI command boundary
│   │   ├── {create,decide,plan}/             # convergence workflow wrappers
│   │   ├── refine/                          # section/refine workflow modules
│   │   ├── evaluate/                        # evaluation workflow wrapper
│   │   ├── panel/                           # attributed-panel workflow wrapper
│   │   └── shared/                          # helpers reused by generated wrappers
│   └── transcript/                          # local session transcript runtime
│       ├── core/                            # cross-runtime parsing/normalization
│       ├── session-observer/                # observer CLI and persistence modules
│       └── export-session/                  # export CLI and sanitization
├── plugins/consensus/                       # shipped Consensus plugin package
│   ├── .{claude,codex,cursor}-plugin/        # provider plugin manifests
│   ├── agents/                              # section-runner agent prompt
│   ├── scripts/                             # generated shared loop and provider CLI
│   └── skills/                              # seven workflow contracts and assets
├── skills/                                  # standalone skill distributions
│   ├── session-observer/                    # generated observer runtime
│   ├── export-session-transcript/           # generated exporter runtime
│   └── session-observer-collab/             # authored collaboration controls/hooks
├── scripts/                                 # generated-build, validation, and release tooling
├── tests/                                   # Vitest behavior and contract tests
├── tools/git-hooks/                         # installed hook implementations/manager
├── documentation/                           # independent Next/Fumadocs application
├── .agents/                                 # OAT tooling mirror and marketplace manifest
├── .claude/, .cursor/, .codex/              # provider-specific agent/skill configuration
├── .oat/                                    # local OAT configuration, projects, and knowledge
├── .github/workflows/                       # CI, release, docs, and live-E2E workflows
├── package.json                             # root developer scripts/tool versions
├── scripts/build-generated.mjs              # canonical source-to-distribution registry
├── vitest.config.mjs                        # root test configuration
└── install.sh                               # standalone Consensus CLI installer
```

## Directory Purposes

**`src/consensus/`:**

- Purpose: Canonical TypeScript for the Consensus plugin runtime.
- Contains: The shared core state machine, provider CLI, composition/configuration, and per-workflow wrappers.
- Key files: `src/consensus/core/consensus-loop.ts`, `src/consensus/provider-cli/cli.ts`, `src/consensus/provider-cli/commands.ts`, and `src/consensus/config/consensus-config.ts`.

**`src/consensus/core/`:**

- Purpose: Reusable deliberation mechanics for workflow wrappers that converge or escalate.
- Contains: The main loop, typed records/status, prompt builders, provider bridge, round scheduling, validation, and escalation helpers.
- Key files: `src/consensus/core/consensus-loop.ts`, `src/consensus/core/loop-types.ts`, `src/consensus/core/loop-rounds.ts`, and `src/consensus/core/loop-records.ts`.

**`src/consensus/provider-cli/`:**

- Purpose: A command-line service layer for the workflow wrappers.
- Contains: CLI parsing, config/list/preflight/run/submit handlers, provider adapters, command builders, bounded subprocess execution, schema validation, and JSON envelopes.
- Key files: `src/consensus/provider-cli/cli.ts`, `src/consensus/provider-cli/args.ts`, `src/consensus/provider-cli/commands.ts`, `src/consensus/provider-cli/adapters.ts`, and `src/consensus/provider-cli/structured-output.ts`.

**`src/consensus/{create,decide,plan,evaluate,panel}/`:**

- Purpose: Workflow-specific canonical entrypoints for creating artifacts, choosing documented options, planning, evaluating, and attributed panels.
- Contains: One `consensus-<workflow>.ts` implementation per directory.
- Key files: `src/consensus/create/consensus-create.ts`, `src/consensus/decide/consensus-decide.ts`, `src/consensus/plan/consensus-plan.ts`, `src/consensus/evaluate/consensus-evaluate.ts`, and `src/consensus/panel/consensus-panel.ts`.

**`src/consensus/refine/`:**

- Purpose: Canonical implementation of section-aware refinement, parallel preparation/fan-in, rendering, resume, and write confinement.
- Contains: The CLI wrapper plus argument, escalation, manifest, rendering, resume, section, shared, and type modules.
- Key files: `src/consensus/refine/consensus-refine.ts`, `src/consensus/refine/refine-manifest.ts`, `src/consensus/refine/refine-resume.ts`, and `src/consensus/refine/refine-shared.ts`.

**`src/transcript/`:**

- Purpose: Canonical TypeScript for standalone local-transcript tools.
- Contains: Cross-runtime record discovery/normalization, the session observer, and the transcript exporter/sanitizer.
- Key files: `src/transcript/core/runtimes.ts`, `src/transcript/session-observer/session-observer.ts`, and `src/transcript/export-session/export-session-transcript.ts`.

**`src/transcript/session-observer/lib/`:**

- Purpose: Decompose observer behavior beneath the CLI entrypoint.
- Contains: Candidate discovery, observation, digest generation, ranking, durable state, Cursor continuity/state, and watcher control/loop modules.
- Key files: `src/transcript/session-observer/lib/locate.ts`, `src/transcript/session-observer/lib/observe.ts`, `src/transcript/session-observer/lib/digest.ts`, `src/transcript/session-observer/lib/state.ts`, and `src/transcript/session-observer/lib/watch.ts`.

**`plugins/consensus/`:**

- Purpose: Provider-loadable Consensus plugin distribution.
- Contains: Plugin manifests, generated shared runtime modules, seven workflow directories, schemas, operator QA references, and the section-runner agent prompt.
- Key files: `plugins/consensus/.codex-plugin/plugin.json`, `plugins/consensus/scripts/consensus.mjs`, `plugins/consensus/scripts/consensus-loop.mjs`, and `plugins/consensus/agents/consensus-section-runner.md`.

**`plugins/consensus/skills/`:**

- Purpose: Agent-facing contracts/assets for `create`, `decide`, `evaluate`, `panel`, `phone-a-friend`, `plan`, and `refine`.
- Contains: Each workflow's `SKILL.md`; generated scripts where applicable; JSON schemas; and operator-QA references/examples where applicable.
- Key files: `plugins/consensus/skills/refine/SKILL.md`, `plugins/consensus/skills/evaluate/schemas/verdict-parallel.schema.json`, `plugins/consensus/skills/panel/schemas/panel-response.schema.json`, and `plugins/consensus/skills/phone-a-friend/schemas/advisory.schema.json`.

**`skills/`:**

- Purpose: Public standalone skill distributions outside the Consensus plugin package.
- Contains: Agent contracts, references, runtime scripts, and hand-written collaboration runtime modules.
- Key files: `skills/session-observer/SKILL.md`, `skills/export-session-transcript/SKILL.md`, and `skills/session-observer-collab/SKILL.md`.

**`skills/session-observer-collab/scripts/`:**

- Purpose: Implement collaboration controls, provider runtime adapters, and Codex/Cursor stop hooks.
- Contains: Authored `.mjs` modules with paired `.d.ts` declarations; these files are not generated runtime output.
- Key files: `skills/session-observer-collab/scripts/collab-control.mjs`, `skills/session-observer-collab/scripts/codex-lifecycle.mjs`, `skills/session-observer-collab/scripts/hooks/codex-stop.mjs`, and `skills/session-observer-collab/scripts/hooks/cursor-stop.mjs`.

**`scripts/`:**

- Purpose: Root build, validation, versioning, smoke-test, OAT mirror, and worktree automation.
- Contains: Node ESM scripts and `scripts/lib/` support code, plus shell worktree scripts.
- Key files: `scripts/build-generated.mjs`, `scripts/validate.mjs`, `scripts/validate-skill-versions.mjs`, `scripts/validate-internal-flags.mjs`, `scripts/bump-version.mjs`, and `scripts/smoke-test.mjs`.

**`tests/`:**

- Purpose: Vitest coverage organized by source/runtime domain and repository contract type.
- Contains: Consensus, transcript, standalone-skill, tooling, repository, release, script, fixture, and helper tests.
- Key files: `tests/tooling/generated-output-sync.test.ts`, `tests/consensus/core/loop-convergence.test.ts`, `tests/session-observer/observe.test.ts`, `tests/export-session-transcript/cli.test.ts`, and `tests/repo/layout.test.ts`.

**`documentation/`:**

- Purpose: The separately packaged documentation website.
- Contains: Next application files, Fumadocs source/configuration, and user-guide/engineering MDX content.
- Key files: `documentation/package.json`, `documentation/app/[[...slug]]/page.tsx`, `documentation/lib/source.ts`, `documentation/source.config.ts`, and `documentation/docs/index.md`.

**`.agents/`, `.claude/`, `.cursor/`, and `.codex/`:**

- Purpose: Agent/provider configuration surfaces present in the checkout.
- Contains: OAT agent definitions and skills under `.agents/`, provider-facing agent/skill entries under `.claude/` and `.cursor/`, and Codex configuration/agents under `.codex/`.
- Key files: `.agents/plugins/marketplace.json`, `.agents/agents/oat-codebase-mapper.md`, and `.codex/config.toml`.
- Evidence: `.claude/agents/` and `.claude/skills/` contain symlinks into `.agents/`; `.cursor/agents/` also contains symlinks into `.agents/`.

**`.oat/`:**

- Purpose: OAT runtime configuration and repository management metadata.
- Contains: Project/idea state, repository reference material, the file-backed backlog, and generated knowledge documents.
- Key files: `.oat/config.json`, `.oat/repo/pjm/backlog/index.md`, and `.oat/repo/knowledge/architecture.md`.

## Key File Locations

**Entry Points:**

- `src/consensus/provider-cli/cli.ts`: Canonical Node entrypoint for the generated provider CLI `plugins/consensus/scripts/consensus.mjs`.
- `src/consensus/{create,decide,plan,refine,evaluate,panel}/consensus-*.ts`: Canonical executable workflow implementations generated to their matching plugin skill `scripts/` directories.
- `src/transcript/session-observer/session-observer.ts`: Canonical source for `skills/session-observer/scripts/session-observer.mjs`.
- `src/transcript/export-session/export-session-transcript.ts`: Canonical source for `skills/export-session-transcript/scripts/export-session-transcript.mjs`.
- `skills/session-observer-collab/scripts/collab-control.mjs`: Authored standalone collaboration control runtime.
- `documentation/app/[[...slug]]/page.tsx`: Catch-all docs page entrypoint.

**Configuration:**

- `package.json`: Root Node/pnpm scripts, runtime engine floors, and developer dependencies.
- `tsconfig.json`: Root strict NodeNext type-check boundary for `src/`, `scripts/`, declarations, and tests.
- `vitest.config.mjs`: Root Vitest test inclusion and timeout configuration.
- `scripts/build-generated.mjs`: Explicit canonical TypeScript-to-committed-runtime mapping and build/check logic.
- `plugins/consensus/.claude-plugin/plugin.json`, `plugins/consensus/.codex-plugin/plugin.json`, and `plugins/consensus/.cursor-plugin/plugin.json`: Provider-specific Consensus plugin descriptors.
- `.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`, and `.cursor-plugin/marketplace.json`: Marketplace references for the Consensus plugin source.
- `documentation/package.json`, `documentation/source.config.ts`, and `documentation/next.config.js`: Documentation app package/configuration boundary.

**Core Logic:**

- `src/consensus/core/consensus-loop.ts`: Main Consensus loop orchestration and top-level CLI behavior.
- `src/consensus/provider-cli/commands.ts`: Provider CLI command dispatch and envelope production.
- `src/consensus/provider-cli/adapters.ts`: Claude, Codex, and Cursor adapter registry/capabilities.
- `src/consensus/config/consensus-config.ts`: User/project configuration persistence and effective composition resolution.
- `src/transcript/core/runtimes.ts`: Runtime transcript discovery/normalization primitives.
- `src/transcript/session-observer/lib/observe.ts`: Incremental transcript observation.
- `src/transcript/export-session/sanitize.ts`: Transcript export sanitization.

**Testing:**

- `tests/consensus/`: Workflow, loop, CLI, configuration, generated-import, and installation contracts.
- `tests/transcript-core/`: Shared runtime parser and Cursor-frame coverage.
- `tests/session-observer/` and `tests/export-session-transcript/`: Standalone tool behavior coverage.
- `tests/session-observer-collab/`: Authored collaboration runtime/hook behavior coverage.
- `tests/tooling/`, `tests/repo/`, `tests/release/`, and `tests/scripts/`: Build, validation, layout, manifest, versioning, and root-script contracts.

## Naming Conventions

**Files:**

- Canonical runtime source is kebab-case TypeScript: `src/consensus/provider-cli/structured-output.ts`, `src/consensus/refine/refine-resume.ts`, and `src/transcript/session-observer/lib/watch-state.ts`.
- Generated runtime files retain their source basename with the `.mjs` extension: `src/transcript/session-observer/lib/watch-state.ts` → `skills/session-observer/scripts/lib/watch-state.mjs`; the provider CLI maps `src/consensus/provider-cli/cli.ts` to the distinct executable name `plugins/consensus/scripts/consensus.mjs`.
- Agent skill contracts are uppercase `SKILL.md`, for example `plugins/consensus/skills/plan/SKILL.md` and `skills/session-observer/SKILL.md`.
- Test files use `<subject>.test.ts` and follow their domain path, for example `tests/consensus/provider-cli/commands.test.ts` and `tests/session-observer/watch.test.ts`.
- JSON schemas use descriptive kebab-case names ending in `.schema.json`, for example `plugins/consensus/skills/create/schemas/verdict-parallel.schema.json`.

**Directories:**

- Runtime domains use singular product/domain directories: `src/consensus/` and `src/transcript/`.
- Consensus workflow directories use the invocation name: `plugins/consensus/skills/create/`, `plugins/consensus/skills/phone-a-friend/`, and `src/consensus/refine/`.
- Test directories mirror the owning runtime segment: `src/consensus/provider-cli/` ↔ `tests/consensus/provider-cli/`; `src/transcript/core/` ↔ `tests/transcript-core/`.
- Generated distribution directories mirror installed skill/package layout rather than `src/` layout: `plugins/consensus/skills/<workflow>/scripts/` and `skills/<standalone-skill>/scripts/`.

## Where to Add New Code

**New Consensus workflow feature:**

- Primary code: A workflow-specific canonical module under `src/consensus/<workflow>/`, following `src/consensus/create/consensus-create.ts` or `src/consensus/panel/consensus-panel.ts`.
- Shared deliberation mechanics: `src/consensus/core/` when the behavior belongs to the reusable loop; `src/consensus/provider-cli/` when it belongs to provider command execution; `src/consensus/config/consensus-config.ts` when it belongs to composition defaults.
- Distribution mapping: `scripts/build-generated.mjs` establishes each generated runtime output under `plugins/consensus/`.
- Agent contract/assets: `plugins/consensus/skills/<workflow>/` holds `SKILL.md`, schemas, and references; `plugins/consensus/.{claude,codex,cursor}-plugin/plugin.json` is the existing package descriptor set.
- Tests: `tests/consensus/<workflow>/` for wrapper behavior and `tests/consensus/core/` or `tests/consensus/provider-cli/` for the shared layer.

**New standalone transcript feature:**

- Primary code: `src/transcript/session-observer/` for peer-session observation or `src/transcript/export-session/` for this-session export; cross-runtime parsing belongs in `src/transcript/core/`.
- Distribution mapping: `scripts/build-generated.mjs` maps canonical source to the appropriate `skills/<name>/scripts/` file and emits local import rewrites for its generated dependencies.
- Skill contract: `skills/<name>/SKILL.md`, with references in `skills/<name>/references/` when they exist for that standalone skill.
- Tests: `tests/session-observer/`, `tests/export-session-transcript/`, or `tests/transcript-core/`, matching the source layer.

**New collaboration-control module:**

- Implementation: `skills/session-observer-collab/scripts/` is the existing authored runtime location; each existing `.mjs` control/hook module has a paired `.d.ts` declaration.
- Tests: `tests/session-observer-collab/` contains the matching runtime, install, hook, lifecycle, and control contracts.

**Utilities:**

- Build/repository utilities: `scripts/` and `scripts/lib/`, as used by `scripts/build-generated.mjs`, `scripts/validate.mjs`, and `scripts/lib/discover-skills.mjs`.
- Test-only utilities: `tests/helpers/`, with fixture binaries/data under `tests/fixtures/`.
- Documentation app utilities: `documentation/lib/` and `documentation/components/`, separate from shipped Node runtimes.

## Special Directories

**`plugins/consensus/scripts/`:**

- Purpose: Distribute the generated Consensus provider CLI and shared core modules used by plugin workflows.
- Generated: Yes; each mapped output begins with the generated banner set in `scripts/build-generated.mjs`.
- Committed: Yes; `scripts/build-generated.mjs --check` compares regenerated output against these files.

**`plugins/consensus/skills/*/scripts/`:**

- Purpose: Distribute generated workflow executables and their generated helper/config dependencies.
- Generated: Yes for files with the banner; `plugins/consensus/skills/refine/scripts/.gitkeep` is a non-runtime placeholder.
- Committed: Yes; mappings are declared in `scripts/build-generated.mjs` and coverage appears in `tests/tooling/generated-output-sync.test.ts`.

**`skills/session-observer/scripts/` and `skills/export-session-transcript/scripts/`:**

- Purpose: Distribute generated standalone CLIs plus generated transcript-core/support modules.
- Generated: Yes; sources are in `src/transcript/` and mappings are in `scripts/build-generated.mjs`.
- Committed: Yes; source/banner and sync contracts are checked by `tests/tooling/generated-output-sync.test.ts`.

**`skills/session-observer-collab/scripts/`:**

- Purpose: Distribute the collaboration protocol's control, adapter, and lifecycle-hook runtime.
- Generated: No; the repository instruction in `AGENTS.md` identifies these `.mjs` files as deliberately authored shipped runtime.
- Committed: Yes; `scripts/validate.mjs` enumerates its required distribution files and `tests/session-observer-collab/` covers them.

**`.agents/skills/`:**

- Purpose: Contain OAT tooling-skill mirrors and related framework resources used by agent workflows.
- Generated: Yes; `AGENTS.md` describes refresh through `oat tools update` and `oat sync`, with internal-flag stamping in `scripts/apply-internal-flags.mjs`.
- Committed: Yes; `scripts/validate-internal-flags.mjs` and `tests/scripts/validate-internal-flags.test.ts` enforce the generated-mirror metadata rule.

**`.oat/`:**

- Purpose: Keep OAT's repository-level configuration, project records, knowledge, references, and backlog material.
- Generated: Partially; `.oat/repo/knowledge/` contains generated mapping output, while `.oat/config.json` and repository management records have separate ownership.
- Committed: Mixed; `.gitignore` excludes local configuration, local/archived project material, review artifacts, and analysis output while retaining selected placeholder paths and repository knowledge/reference files.

**`documentation/`:**

- Purpose: Package the Next/Fumadocs documentation site independently from the root tooling package.
- Generated: Partially; Fumadocs MDX generation is run by `documentation/package.json` `predev`/`prebuild` scripts, while authored docs live under `documentation/docs/`.
- Committed: Yes; `documentation/package.json`, `documentation/app/`, and `documentation/docs/` are tracked project files.

---

_Structure analysis: 2026-08-31_
