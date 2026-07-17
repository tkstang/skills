---
oat_generated: true
oat_generated_at: 2026-07-17
oat_source_head_sha: 6c03afde1417fbe29f0e2c81009629f0e36ca945
oat_source_main_merge_base_sha: 6c03afde1417fbe29f0e2c81009629f0e36ca945
oat_warning: "GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index"
---

# Codebase Structure

**Analysis Date:** 2026-07-17

## Directory Layout

```
skills/ (repository root)
├── src/                         # Canonical TypeScript source
│   ├── consensus/               # Consensus deliberation engine
│   │   ├── core/                # Core loop state machine and types
│   │   ├── provider-cli/        # Provider abstraction and invocation
│   │   ├── config/              # Configuration resolution and persistence
│   │   ├── create/              # Create skill wrapper
│   │   ├── decide/              # Decide skill wrapper
│   │   ├── plan/                # Plan skill wrapper
│   │   ├── refine/              # Refine skill wrapper
│   │   ├── evaluate/            # Evaluate skill wrapper
│   │   └── panel/               # Panel skill wrapper
│   └── transcript/              # Session observation and export
│       ├── core/                # Runtime definitions (Claude, Codex, Cursor)
│       ├── session-observer/    # Session watcher and digester
│       └── export-session/      # Transcript exporter
├── plugins/                     # Packaged plugins
│   └── consensus/               # Consensus plugin (ships to providers)
│       ├── scripts/             # Generated skill runtime scripts
│       ├── skills/              # Per-skill plugin manifests and schemas
│       │   ├── create/
│       │   ├── decide/
│       │   ├── plan/
│       │   ├── refine/
│       │   ├── evaluate/
│       │   ├── panel/
│       │   └── phone-a-friend/
│       └── .{claude,codex,cursor}-plugin/  # Provider-specific manifests
├── skills/                      # Standalone skills (not in plugin)
│   ├── session-observer/        # Session observation skill
│   ├── session-observer-collab/ # Session observation with agent collaboration
│   └── export-session-transcript/ # Export transcript skill
├── tests/                       # Vitest suite (organized by domain)
│   ├── consensus/               # Consensus engine tests
│   ├── session-observer/        # Session-observer tests
│   ├── export-session-transcript/ # Export skill tests
│   ├── session-observer-collab/ # Collaboration tests
│   ├── transcript-core/         # Transcript format tests
│   ├── tooling/                 # Build and config tests
│   ├── repo/                    # Repository invariant tests
│   ├── release/                 # Release/versioning tests
│   ├── fixtures/                # Static test fixture files
│   └── helpers/                 # Shared test utilities
├── scripts/                     # Build, validation, test infrastructure
│   ├── build-generated.mjs      # Bundles TS source to .mjs runtimes
│   ├── validate.mjs             # Repo invariant checks
│   ├── validate-skill-versions.mjs # Skill version sync checks
│   ├── validate-internal-flags.mjs # Internal flag stamping for OAT tools
│   ├── smoke-test.mjs           # End-to-end smoke test
│   ├── run-vitest.mjs           # Vitest invocation wrapper
│   ├── sync-transcript-core.mjs # Sync shared transcript types
│   └── git-hooks/               # Git hook management
├── .agents/                     # OAT tooling mirrors (synced)
├── .claude/                     # Claude Code provider config (synced)
├── .cursor/                     # Cursor provider config (synced)
├── .oat/                        # OAT tool configuration and knowledge
├── documentation/               # Fumadocs site (User Guide + Engineering)
├── shared/                      # Shared code (currently minimal)
└── tools/                       # Development tools (git hooks manager)
```

## Directory Purposes

**src/consensus/core/:**

- Purpose: Core deliberation loop and verdict state machine
- Contains: Loop record types, verdict types, iteration modes (alternating, parallel_revision, parallel_synthesized), turn execution, synthesis orchestration, escalation detection, artifact tracking
- Key files: `consensus-loop.ts` (all types and core logic)

**src/consensus/provider-cli/:**

- Purpose: Provider abstraction, CLI subprocess invocation, capability discovery, structured output modes
- Contains: Provider registry, host context detection, command routing (run, config, preflight), schema validation, retry logic, submit capture, environment probing
- Key files: `cli.ts` (entrypoint), `commands.ts` (command handlers), `types.ts` (provider/host types), `adapters.ts` (provider implementations), `probe.ts` (capability detection), `invocation.ts` (subprocess invocation), `structured-output.ts` (schema binding)

**src/consensus/config/:**

- Purpose: Peer composition and default configuration resolution
- Contains: Config scope hierarchy (user/project/effective), peer registry, role-based selection, composition merging
- Key files: `consensus-config.ts` (all types and resolution logic)

**src/consensus/{create,decide,plan,refine,evaluate,panel}/:**

- Purpose: Individual skill wrappers around consensus loop
- Contains: CLI argument parsing, prompt builders, input validation, output rendering, state path management
- Key files: `consensus-{skill}.ts` (all skill logic)

**src/transcript/core/:**

- Purpose: Runtime definitions for provider session message formats
- Contains: Runtime type discriminators, message record shapes per provider (Claude Code, Codex, Cursor)
- Key files: `runtimes.ts` (runtime types and constants)

**src/transcript/session-observer/:**

- Purpose: Session watcher and digest computation
- Contains: Session state tracking, message filtering, ranking, digest building, environment probing
- Key files: `session-observer.ts` (main entry), `lib/state.ts` (state persistence), `lib/watch-state.ts` (state updates), `lib/rank.ts` (message ranking), `probe-local.ts` (runtime detection)

**src/transcript/export-session/:**

- Purpose: Session transcript export and sanitization
- Contains: Transcript loading, filtering, format conversion, sensitive data removal
- Key files: `export-session-transcript.ts` (main entry), `sanitize.ts` (data sanitization)

**plugins/consensus/:**

- Purpose: Provider plugin package (ships all consensus skills)
- Contains: Generated skill runtime scripts (`.mjs`), skill manifests (SKILL.md), JSON schemas, provider-specific plugin configs
- Generated: Yes (scripts generated from src/ via `pnpm run build`)
- Committed: Yes (generated outputs committed; regenerate with build step)

**plugins/consensus/skills/{skill}/:**

- Purpose: Per-skill plugin metadata and schemas
- Contains: SKILL.md (skill contract), schemas (verdict, synthesis, advisory), operator QA references
- Key files: `SKILL.md` (shipped skill documentation), `schemas/*.schema.json` (verdict/synthesis validation)

**skills/session-observer/:**

- Purpose: Standalone session-observer skill (not in plugin)
- Contains: Generated runtime script, references, skill metadata
- Generated: Yes (runtime .mjs generated from src/ via `pnpm run build`)
- Committed: Yes (committed generated output)

**skills/session-observer-collab/:**

- Purpose: Session-observer with agent collaboration support
- Contains: Collab control logic, runtime adapters, lifecycle hooks for Codex/Cursor
- Generated: Yes (scripts generated from source)
- Committed: Yes

**skills/export-session-transcript/:**

- Purpose: Standalone export-session-transcript skill
- Contains: Generated runtime script, references, skill metadata
- Generated: Yes (runtime .mjs generated from src/)
- Committed: Yes

**tests/consensus/:**

- Purpose: Consensus engine tests (core loop, verdict parsing, synthesizer orchestration)
- Contains: Import tests for generated runtimes, install contract tests
- Key files: `generated-config-import.test.ts`, `generated-refine-import.test.ts`, `generated-evaluate-import.test.ts`, `install-contract.test.ts`

**tests/session-observer/:**

- Purpose: Session-observer skill behavior tests
- Contains: Observation pipeline tests, watch-state tests, CLI override tests
- Key files: `observe.test.ts`, `watch-state.test.ts`, `cli-session-override.test.ts`

**tests/export-session-transcript/:**

- Purpose: Export skill behavior tests
- Contains: Export logic tests

**tests/session-observer-collab/:**

- Purpose: Session-observer collaboration and agent integration tests
- Contains: Codex lifecycle tests, control tests, hook tests, completion selection tests

**tests/transcript-core/:**

- Purpose: Transcript format and runtime validation
- Contains: Runtime discovery and format tests

**tests/tooling/:**

- Purpose: Build and test infrastructure verification
- Contains: Generated output sync checks, vitest config validation, no-node-test-runner policy enforcement
- Key files: `generated-output-sync.test.ts` (drift guard), `vitest-config.test.ts`, `no-node-test-runner.test.ts`

**tests/repo/:**

- Purpose: Repository invariant checks (layout, manifests, metadata)
- Contains: Plugin manifest validation, skill frontmatter checks, README scope verification

**tests/release/:**

- Purpose: Release and version bump checks
- Contains: Version script validation, release checklist verification

**tests/helpers/:**

- Purpose: Shared test utilities (not test files; no `.test.ts`)
- Contains: Subprocess execution helpers, temp directory management, JSONL parsing, fixture utilities, repo root resolution

**tests/fixtures/:**

- Purpose: Static test fixture files (markdown samples, stub binaries, test data)
- Contains: Sample input files, mock command binaries used by tests

**scripts/:**

- Purpose: Build, validation, and test infrastructure
- Contains: esbuild bundler script, vitest wrapper, repo invariant validators, smoke test, git hook manager
- Key files: `build-generated.mjs` (TS → .mjs transpiler), `validate.mjs` (repo checks), `run-vitest.mjs` (test runner)

**scripts/git-hooks/:**

- Purpose: Git hook management and implementations
- Contains: Hook setup/disable CLI, pre-commit linting, pre-push validation, commit-msg linting
- Key files: `manage-hooks.mjs` (hook manager), `pre-commit` (runs oxlint/lint-staged), `pre-push` (build check + validate), `commit-msg` (commitlint)

**documentation/:**

- Purpose: Fumadocs site for user and engineering documentation
- Contains: Next.js + MDX docs app, User Guide (install/use/configure), Engineering (architecture/layout/contributing)
- Key files: `docs/index.md` (site root), `docs/user-guide/`, `docs/engineering/`

**.agents/, .claude/, .cursor/:**

- Purpose: Provider-specific OAT tooling mirrors (synced, not canonical)
- Generated: Yes (regenerated by `oat sync` from canonical `.agents/skills/` upstream)
- Committed: Yes (committed for bootstrapping and CI reference)
- Note: Do not edit these directly; they are regenerated on each `oat tools update` + `oat sync`

**.oat/:**

- Purpose: OAT tool configuration and generated knowledge
- Contains: `.oat/config.json` (OAT project config), `.oat/repo/knowledge/` (codebase knowledge docs)
- Generated: Partially (knowledge docs generated; config managed manually)

**shared/:**

- Purpose: Shared code between skills (currently minimal)
- Contains: Symlink to transcript-core (if present); mostly placeholder for future shared utilities

## Key File Locations

**Entry Points:**

- `src/consensus/create/consensus-create.ts`: Create skill canonical source
- `src/consensus/refine/consensus-refine.ts`: Refine skill canonical source
- `src/consensus/evaluate/consensus-evaluate.ts`: Evaluate skill canonical source
- `src/consensus/decide/consensus-decide.ts`: Decide skill canonical source
- `src/consensus/plan/consensus-plan.ts`: Plan skill canonical source
- `src/consensus/panel/consensus-panel.ts`: Panel skill canonical source
- `src/consensus/provider-cli/cli.ts`: Provider CLI entrypoint (canonical source)
- `src/transcript/session-observer/session-observer.ts`: Session-observer entrypoint
- `src/transcript/export-session/export-session-transcript.ts`: Export-session entrypoint

**Configuration:**

- `package.json`: Project metadata, scripts, dependencies, pnpm version pin
- `tsconfig.json`: TypeScript compiler options
- `vitest.config.mjs`: Vitest configuration (30s timeout, node environment)
- `.oxlintrc.json`: oxlint linting rules
- `.oxfmtrc.json`: oxfmt formatting rules
- `commitlint.config.js`: Conventional commits enforcement
- `.lintstagedrc.mjs`: Pre-commit linting scope

**Core Logic:**

- `src/consensus/core/consensus-loop.ts`: Deliberation state machine, all verdict/loop types
- `src/consensus/provider-cli/commands.ts`: CLI command handlers (run, config, preflight)
- `src/consensus/provider-cli/types.ts`: Provider registry, host context, capabilities types
- `src/consensus/config/consensus-config.ts`: Configuration resolution and merging

**Testing:**

- `tests/consensus/`: Consensus engine tests (import contract, install contract, generated output checks)
- `tests/session-observer/`: Session-observer skill tests
- `tests/tooling/generated-output-sync.test.ts`: Drift guard for generated `.mjs` files
- `tests/helpers/`: Shared test utilities (subprocess, temp dirs, fixture loading)

## Naming Conventions

**Files:**

- Canonical TypeScript source: `src/*/.../*.ts` (e.g., `src/consensus/core/consensus-loop.ts`)
- Generated runtime: `plugins/consensus/skills/*/scripts/*.mjs` or `skills/*/scripts/*.mjs` (e.g., `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`)
- Skill metadata: `SKILL.md` (e.g., `plugins/consensus/skills/refine/SKILL.md`)
- Schemas: `schemas/*.schema.json` (e.g., `plugins/consensus/skills/refine/schemas/verdict-parallel.schema.json`)
- Tests: `tests/**/*.test.ts` (Vitest convention)
- Scripts: Named descriptively with `.mjs` (e.g., `build-generated.mjs`, `validate.mjs`)

**Directories:**

- Skill names: kebab-case (e.g., `session-observer`, `export-session-transcript`)
- Layer names: kebab-case (e.g., `provider-cli`, `consensus-config`)
- Domain dirs in tests: pluralized (e.g., `tests/consensus/`, `tests/helpers/`)
- Config scopes: `user` (user home), `project` (repo root), `effective` (merged)

## Where to Add New Code

**New Consensus Skill:**

- Canonical source: `src/consensus/<skill-name>/<skill-name>-<skill>.ts` (e.g., `src/consensus/phone-a-friend/consensus-phone-a-friend.ts`)
- Plugin skill dir: `plugins/consensus/skills/<skill-name>/` with SKILL.md, schemas, generated scripts
- Tests: `tests/consensus/` with skill-specific test file
- Schema files: `plugins/consensus/skills/<skill-name>/schemas/` (e.g., `verdict-parallel.schema.json`)
- Entry file: Add to `generatedOutputs` in `scripts/build-generated.mjs` with source/output mapping

**New Transcript Skill (e.g., transcript filter):**

- Canonical source: `src/transcript/<feature>/<feature>.ts`
- Standalone skill dir: `skills/<feature-name>/` with SKILL.md, generated scripts
- Tests: `tests/<feature-name>/` or add to `tests/transcript-core/` if related to core

**New Provider Integration:**

- Add provider adapter: `src/consensus/provider-cli/adapters.ts` (new export, capability definitions, invocation logic)
- Update probe: `src/consensus/provider-cli/probe.ts` (probe command for new provider)
- Tests: `tests/repo/provider-manifest.test.ts` (if adding provider-specific manifest)

**Shared Utilities:**

- Provider-agnostic helpers: `shared/` (e.g., transcript-core symlink, future shared modules)
- Test helpers: `tests/helpers/` (e.g., subprocess utils, fixture loaders)

**Configuration:**

- User/project config: `~/.consensus/config.json` (user) or `.consensus/config.json` (project)
- No hardcoded defaults in source; all defaults in `src/consensus/config/consensus-config.ts` or skill wrappers

## Special Directories

**plugins/consensus/scripts/:**

- Purpose: Generated consensus shared runtime (used by all skills)
- Generated: Yes (from `src/consensus/core/consensus-loop.ts` via esbuild)
- Committed: Yes
- Used by: All consensus skills (import `../../../scripts/consensus-loop.mjs`)

**plugins/consensus/skills/{skill}/scripts/:**

- Purpose: Generated skill-specific runtime entrypoint
- Generated: Yes (from `src/consensus/{skill}/` via esbuild with import rewrites)
- Committed: Yes
- Used by: Provider plugin interface or direct CLI invocation

**skills/{skill}/scripts/:**

- Purpose: Generated standalone skill runtime entrypoint
- Generated: Yes (from `src/transcript/*/` via esbuild)
- Committed: Yes
- Used by: Standalone skill installation (not in plugin)

**.consensus/ (runtime):**

- Purpose: Shared provider CLI runtime generated by `install.sh`
- Generated: Yes (installed from `plugins/consensus/scripts/consensus.mjs` or remote)
- Committed: No (generated at install time)
- Location: `~/.consensus/consensus.mjs` (if standalone skill install) or via plugin runtime

**tests/fixtures/:**

- Purpose: Static test data and mock binaries
- Generated: No
- Committed: Yes
- Examples: Sample markdown input, stub provider CLIs, JSONL test fixtures

**.git/hooks/ (if enabled):**

- Purpose: Git hook implementations installed by `pnpm prepare` or `pnpm hooks:enable-all`
- Generated: Symlinks (not committed; created by hook manager)
- Maintained by: `tools/git-hooks/manage-hooks.mjs`

---

_Structure analysis: 2026-07-17_
