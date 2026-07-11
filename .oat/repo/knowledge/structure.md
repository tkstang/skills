---
oat_generated: true
oat_generated_at: 2026-07-11
oat_source_head_sha: 0e25a36d3958a1e09c7bedaddd6d3498dc0905d7
oat_source_main_merge_base_sha: 17043d653233fb906e018f5872359d99eb556208
oat_warning: "GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index"
---

# Codebase Structure

**Analysis Date:** 2026-07-11

## Directory Layout

```
skills/
├── src/                                    # Canonical TypeScript source (developer-only)
│   ├── consensus/                         # Consensus loop + skills
│   │   ├── core/                          # Core loop orchestration
│   │   ├── provider-cli/                  # Provider CLI integration layer
│   │   ├── config/                        # Configuration resolution
│   │   ├── decide/                        # Decide skill logic
│   │   ├── create/                        # Create skill logic
│   │   ├── plan/                          # Plan skill logic
│   │   ├── refine/                        # Refine skill logic
│   │   ├── evaluate/                      # Evaluate skill logic
│   │   └── panel/                         # Panel skill logic
│   └── transcript/                        # Transcript capture + export
│       ├── core/                          # Runtime definitions (canonical source)
│       ├── session-observer/              # Live session capture
│       └── export-session/                # Transcript export pipeline
├── plugins/                               # Built + committed plugin outputs
│   └── consensus/                         # Consensus plugin (provider-specific skills)
│       ├── scripts/                       # Shared/plugin-level runtime
│       │   ├── consensus.mjs              # Main consensus entry
│       │   └── consensus-loop.mjs         # Generated from core loop
│       ├── skills/                        # Per-skill plugin entries
│       │   ├── decide/                    # Decide skill plugin
│       │   ├── create/                    # Create skill plugin
│       │   ├── plan/                      # Plan skill plugin
│       │   ├── refine/                    # Refine skill plugin
│       │   ├── evaluate/                  # Evaluate skill plugin
│       │   ├── panel/                     # Panel skill plugin
│       │   └── phone-a-friend/            # Phone-a-friend skill plugin
│       ├── .claude-plugin/                # Claude Code plugin manifest
│       ├── .codex-plugin/                 # Codex plugin manifest
│       ├── .cursor-plugin/                # Cursor agent plugin manifest
│       └── SKILL.md                       # Plugin-level metadata
├── skills/                                # Standalone skills (cross-provider)
│   ├── session-observer/                  # Live transcript observer skill
│   │   ├── SKILL.md                       # Skill metadata
│   │   └── scripts/                       # Generated skill runtime
│   └── export-session-transcript/         # Transcript export skill
│       ├── SKILL.md                       # Skill metadata
│       └── scripts/                       # Generated skill runtime
├── tests/                                 # Test suite
│   ├── consensus/                         # Consensus tests by module
│   │   ├── core/                          # Loop orchestration tests
│   │   ├── provider-cli/                  # Provider CLI tests
│   │   ├── decide/                        # Decide skill tests
│   │   └── [...other skills...]
│   ├── session-observer/                  # Session observer tests
│   ├── export-session-transcript/         # Export transcript tests
│   ├── tooling/                           # Build + validation tests
│   │   └── generated-output-sync.test.ts # Drift check for built outputs
│   ├── helpers/                           # Shared test utilities
│   ├── fixtures/                          # Test data
│   └── repo/                              # Repository validation tests
├── scripts/                               # Development/build scripts
│   ├── build-generated.mjs                # esbuild + import rewrite (TypeScript → ESM)
│   ├── validate.mjs                       # Repository invariant checks
│   ├── validate-skill-versions.mjs        # Enforce version bumps on skill edits
│   ├── validate-internal-flags.mjs        # Enforce OAT internal metadata flags
│   ├── build-check.mjs                    # Verify generated outputs match source
│   └── [other tooling scripts]
├── tools/                                 # Runtime tool configuration
│   └── git-hooks/                         # Pre-commit, pre-push, commit-msg hooks
├── documentation/                         # Fumadocs site
│   ├── docs/                              # Markdown source
│   │   ├── user-guide/                    # Consumer docs
│   │   └── engineering/                   # Developer docs
│   └── components/                        # React components
├── shared/                                # Deprecated; transcript-core moved to src/
│   └── transcript-core/README.md          # Migration note
├── .agents/                               # OAT tooling skills (synced)
├── package.json                           # Root package manifest
└── .oxlintrc.json / .oxfmtrc.json        # Linting + formatting config
```

## Directory Purposes

**src/** — Canonical TypeScript source

- Purpose: Single source of truth for non-trivial logic; never shipped directly
- Contains: TypeScript `.ts` files with full type safety
- Key files: `src/consensus/core/consensus-loop.ts` (orchestration), `src/consensus/provider-cli/` (CLI integration), `src/transcript/core/runtimes.ts` (shared transcript definitions)
- Build process: `pnpm run build` compiles to esm `.mjs` under `plugins/` and `skills/`, applies import rewrites to maintain relative path independence

**plugins/consensus/** — Provider-specific plugin

- Purpose: Consensus workflow exposed as installable plugin for Claude Code, Codex, Cursor
- Contains: Generated `.mjs` skill scripts, provider plugin manifests (.claude-plugin, .codex-plugin, .cursor-plugin), SKILL.md metadata
- Key files: `scripts/consensus-loop.mjs` (generated from core loop, shared at plugin root), `skills/*/scripts/consensus-decide.mjs` (generated, one per skill)
- Committed: Yes (all .mjs outputs). Generated: Yes (never hand-edit).

**skills/** — Standalone cross-provider skills

- Purpose: Session capture and export workflows installable independently of consensus plugin
- Contains: Generated `.mjs` skill scripts, SKILL.md metadata for each skill
- Key files: `session-observer/scripts/session-observer.mjs`, `export-session-transcript/scripts/export-session-transcript.mjs`
- Committed: Yes. Generated: Yes (never hand-edit).

**tests/** — Vitest suite

- Purpose: Unit and integration tests for core loop, provider CLI, skills, session capture
- Contains: `.test.ts` files organized by module mirror to `src/`
- Key files: `tests/tooling/generated-output-sync.test.ts` (drift check), `tests/consensus/core/` (loop tests), `tests/consensus/provider-cli/` (CLI integration tests)
- Entry: `pnpm run test` runs full suite; `pnpm run test:vitest` with options for narrowing

**scripts/** — Build and validation tooling

- Purpose: Canonical source → generated output build, repository invariant checks
- Contains: Node.js `.mjs` and `.ts` scripts, esbuild config
- Key files: `build-generated.mjs` (main build orchestrator), `validate.mjs` (repo structure checks), `validate-skill-versions.mjs` (enforce version bumps)
- Entry: `pnpm run build`, `pnpm run validate`, `pnpm run build:check`

**documentation/** — Fumadocs site

- Purpose: User guide (install, use, configure) and engineering docs (architecture, contributing)
- Contains: Markdown under `docs/` (user-guide, engineering subdirectories), React components, Next.js app
- Key files: `docs/index.md` (top-level nav), `docs/engineering/architecture/` (technical deep-dive)
- Entry: `cd documentation && pnpm dev` (local dev server)

**tools/git-hooks/** — Git hook scripts

- Purpose: Pre-commit linting, pre-push validation, commit message linting
- Contains: Bash + Node scripts managed by `manage-hooks.mjs`
- Key files: `pre-commit` (lint-staged + commitlint), `pre-push` (full build checks), `commit-msg` (commitlint)
- Entry: Installed by `pnpm install` (via prepare script); managed via `pnpm hooks:*` commands

## Key File Locations

**Entry Points:**

- `src/consensus/decide/consensus-decide.ts` → `plugins/consensus/skills/decide/scripts/consensus-decide.mjs` (decide skill entry)
- `src/consensus/create/consensus-create.ts` → `plugins/consensus/skills/create/scripts/consensus-create.mjs` (create skill entry)
- `src/consensus/plan/consensus-plan.ts` → `plugins/consensus/skills/plan/scripts/consensus-plan.mjs` (plan skill entry)
- `src/consensus/refine/consensus-refine.ts` → `plugins/consensus/skills/refine/scripts/consensus-refine.mjs` (refine skill entry)
- `src/consensus/evaluate/consensus-evaluate.ts` → `plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs` (evaluate skill entry)
- `src/consensus/panel/consensus-panel.ts` → `plugins/consensus/skills/panel/scripts/consensus-panel.mjs` (panel skill entry)
- `src/transcript/session-observer/session-observer.ts` → `skills/session-observer/scripts/session-observer.mjs` (session observer entry)
- `src/transcript/export-session/export-session-transcript.ts` → `skills/export-session-transcript/scripts/export-session-transcript.mjs` (export transcript entry)

**Configuration:**

- `package.json`: Root manifest; pinned Node/pnpm versions, build/test/validate scripts
- `.oxlintrc.json`: oxlint configuration (JS/TS linting rules)
- `.oxfmtrc.json`: oxfmt configuration (JS/TS formatting rules)
- `tsconfig.json`: TypeScript compiler config
- `plugins/consensus/SKILL.md`: Plugin-level metadata (version, dependencies, description)
- `skills/session-observer/SKILL.md`: Standalone skill metadata
- `skills/export-session-transcript/SKILL.md`: Standalone skill metadata

**Core Logic:**

- `src/consensus/core/consensus-loop.ts`: Loop orchestration, turn/round execution, convergence detection, escalation routing
- `src/consensus/provider-cli/` (14 files): CLI argument parsing, provider registry probe, structured output extraction, subprocess spawning, host guards, limits
- `src/consensus/config/consensus-config.ts`: Configuration resolution, YAML I/O, scope precedence
- `src/transcript/core/runtimes.ts`: Per-provider transcript shape and query logic (canonical source for generated copies)

**Testing:**

- `tests/tooling/generated-output-sync.test.ts`: Drift check; fails if any `.mjs` diverges from source
- `tests/consensus/core/`: Loop unit tests (round execution, verdict parsing, convergence)
- `tests/consensus/provider-cli/`: CLI argument parsing, envelope handling
- `tests/helpers/`: Shared test utilities (mock runner, fixture loaders)
- `tests/fixtures/`: Test data (sample prompts, verdicts, configs)

## Naming Conventions

**Files:**

- TypeScript source: camelCase: `consensus-loop.ts`, `provider-cli.ts`, `consensus-decide.ts` (dash-separated compound terms)
- Generated ESM: `.mjs` extension (generated from `.ts`, never hand-edited, carry `// GENERATED` banner)
- Tests: `.test.ts` suffix: `consensus-loop.test.ts`, `args.test.ts`
- Config: lowercase with extensions: `tsconfig.json`, `.oxlintrc.json`, `package.json`

**Directories:**

- Kebab-case for multi-word directories: `provider-cli`, `session-observer`, `export-session`, `export-session-transcript`
- Skill names: lowercase, dash-separated: `consensus/decide`, `consensus/plan`, `skills/session-observer`
- Test mirror structure: `tests/consensus/core/` mirrors `src/consensus/core/`
- Scope directories: `user-guide`, `engineering` under `documentation/docs/`

## Where to Add New Code

**New Consensus Skill:**

- Canonical source: `src/consensus/{skillname}/consensus-{skillname}.ts` (export main function + types)
- Plugin output: `plugins/consensus/skills/{skillname}/scripts/consensus-{skillname}.mjs` (generated by build)
- Plugin manifest: `plugins/consensus/skills/{skillname}/SKILL.md` (metadata, version, usage)
- Tests: `tests/consensus/{skillname}/consensus-{skillname}.test.ts`
- Build config: Add entry to `scripts/build-generated.mjs` generatedOutputs array

**New Standalone Skill:**

- Canonical source: `src/transcript/{skillname}/{skillname}.ts`
- Skill output: `skills/{skillname}/scripts/{skillname}.mjs` (generated)
- Skill manifest: `skills/{skillname}/SKILL.md`
- Tests: `tests/{skillname}/{skillname}.test.ts`
- Build config: Add entry to `scripts/build-generated.mjs` generatedOutputs array

**New Provider-CLI Integration:**

- Canonical source: Add/edit `src/consensus/provider-cli/*.ts` (e.g., new adapter for future provider)
- CLI entry: Integration lives in `src/consensus/provider-cli/cli.ts` (shebang entry) or `commands.ts` (subcommand handler)
- Plugin commands: Regenerate `plugins/consensus/scripts/consensus.mjs` (depends on provider-cli exports)
- Tests: Mirror test file under `tests/consensus/provider-cli/`

**Shared Transcript Logic:**

- Canonical source: `src/transcript/core/runtimes.ts` (per-provider transcript shape)
- Generated copies: Regenerated to:
  - `skills/session-observer/scripts/lib/runtimes.mjs`
  - `skills/export-session-transcript/scripts/lib/runtimes.mjs`
- Process: Edit canonical, run `pnpm run build`, commit canonical + regenerated copies together
- Sync alternative: `pnpm run sync:transcript-core` (compatibility wrapper)

## Special Directories

**plugins/consensus/scripts/** — Plugin-level shared runtime

- Purpose: Consensus loop entry point shared by all skills in the plugin
- Generated: Yes (`consensus-loop.mjs` from `src/consensus/core/consensus-loop.ts`)
- Committed: Yes
- Never edit: Hand-editing `.mjs` breaks generated-output drift check

**plugins/consensus/{.claude-plugin,.codex-plugin,.cursor-plugin}/** — Provider-specific manifests

- Purpose: Plugin metadata and entry-point configuration for each provider (Claude Code, Codex, Cursor)
- Generated: No (authored manifests)
- Committed: Yes
- Format: JSON or provider-specific config files (claude-plugin.json, codex-plugin.json, cursor-plugin.json structure)

**skills/{skill}/scripts/lib/** — Generated libraries for skills

- Purpose: Shared logic copied to each skill (e.g., runtimes.mjs, sanitize.mjs for export-session-transcript)
- Generated: Yes (from canonical source, one copy per consumer)
- Committed: Yes
- Never edit: Each copy is a generated snapshot; edit canonical source instead

**.agents/**, **.claude/**, **.cursor/** — Provider synced mirrors

- Purpose: OAT sync mirrors of skills (`.agents/skills/`), agent instructions, provider-specific skill shortcuts
- Generated: Yes (by `oat sync`, `oat tools update`)
- Committed: Yes (synced)
- Never edit: These are auto-generated from canonical skill under `plugins/` or `skills/`

**shared/transcript-core/** — Deprecated

- Purpose: Migration note; canonical source moved to `src/transcript/core/runtimes.ts`
- Generated: No
- Committed: Yes (README only, explaining the move)
- Migration: Consumer skills now carry their own generated copy under `scripts/lib/runtimes.mjs`

**tests/fixtures/** — Test data

- Purpose: Reusable test fixtures (sample input files, config YAMLs, verdicts, error responses)
- Generated: No (hand-authored test assets)
- Committed: Yes
- Usage: Tests load fixtures via helpers, e.g., `loadFixture('verdict-accept.json')`

---

_Structure analysis: 2026-07-11_
