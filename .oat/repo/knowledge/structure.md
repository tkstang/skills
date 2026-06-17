---
oat_generated: true
oat_generated_at: 2026-06-12
oat_source_head_sha: d008a7e571d90cc6c436c82e176129f62ab54ec4
oat_source_main_merge_base_sha: ed22b463dcdaa466476b0957fea64deb3f663391
oat_warning: "GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index"
---

# Codebase Structure

**Analysis Date:** 2026-06-12

## Directory Layout

```
/Users/tstang/Code/skills/
├── .agents/                                    # Project orchestration (not shipped)
│   └── skills/                                 # OAT workflow skills
├── .claude/                                    # Claude Code provider config
├── .codex/                                     # Codex provider config
├── .cursor/                                    # Cursor provider config
├── .oat/                                       # OAT project state
├── .github/                                    # Workflow definitions
├── plugins/
│   └── consensus/                              # Consensus plugin package v0.1
│       ├── .claude-plugin/                     # Claude Code manifest
│       ├── .codex-plugin/                      # Codex manifest
│       ├── .cursor-plugin/                     # Cursor manifest (--plugin-dir)
│       ├── agents/                             # Orchestration docs
│       │   └── consensus-section-runner.md    # Subagent task contract
│       └── skills/
│           └── refine/
│               ├── scripts/
│               │   ├── consensus-refine.mjs    # CLI entry point
│               │   └── consensus-loop.mjs      # Deliberation engine
│               ├── schemas/                    # Validation schemas
│               └── SKILL.md                    # User documentation
├── skills/                                     # Standalone skills (not packaged)
│   ├── session-observer/
│   │   ├── scripts/
│   │   │   ├── session-observer.mjs            # CLI entry point
│   │   │   ├── lib/
│   │   │   │   ├── locate.mjs                  # Transcript discovery
│   │   │   │   ├── rank.mjs                    # Candidate scoring
│   │   │   │   ├── observe.mjs                 # Catch-up logic
│   │   │   │   ├── digest.mjs                  # Markdown rendering
│   │   │   │   ├── watch.mjs                   # Watch loop
│   │   │   │   ├── state.mjs                   # Offset persistence
│   │   │   │   ├── watch-state.mjs             # Watcher control
│   │   │   │   ├── session-classifier.mjs     # Engagement detection
│   │   │   │   └── runtimes.mjs                # Vendored transcript-core
│   │   │   └── probe-local.mjs                 # Diagnostic helper
│   │   ├── references/                         # Runtime documentation
│   │   └── SKILL.md
│   └── export-session-transcript/
│       ├── scripts/
│       │   ├── export-session-transcript.mjs   # CLI entry point
│       │   └── lib/
│       │       ├── runtimes.mjs                # Vendored transcript-core
│       │       └── sanitize.mjs                # Content filtering
│       ├── references/                         # Runtime documentation
│       └── SKILL.md
├── src/                                        # Canonical TypeScript source
│   ├── consensus/
│   └── transcript/
│       ├── core/
│       │   └── runtimes.ts                     # Canonical transcript-core source
│       └── export-session/
│           ├── export-session-transcript.ts    # Canonical export CLI source
│           └── sanitize.ts                     # Canonical sanitizer source
├── shared/                                     # Compatibility/reference docs
│   └── transcript-core/
│       └── README.md                           # Pointer to src/transcript/core
├── tests/
│   ├── consensus-loop-cli.test.mjs
│   ├── consensus-*.test.mjs                    # Consensus tests
│   ├── session-observer/
│   │   ├── cli.test.mjs
│   │   ├── digest.test.mjs
│   │   ├── locate.test.mjs
│   │   ├── observe.test.mjs
│   │   ├── rank.test.mjs
│   │   ├── state.test.mjs
│   │   ├── watch.test.mjs
│   │   └── integration.test.mjs
│   ├── export-session-transcript/
│   │   ├── cli.test.ts
│   │   └── sanitize.test.ts
│   ├── transcript-core/
│   │   └── runtimes.test.ts
│   ├── fixtures/                               # Test data
│   ├── helpers/
│   │   └── process.mjs
│   └── *.test.mjs                              # Repository-level tests
├── scripts/
│   ├── build-generated.mjs                     # Generates committed .mjs output
│   ├── sync-transcript-core.mjs                # Compatibility wrapper
│   ├── validate.mjs                            # Invariant verification
│   ├── smoke-test.mjs                          # E2E consensus check
│   ├── install-paseo.mjs                       # Paseo helper
│   └── bump-version.mjs
├── .claude-plugin/                             # Repo-root Claude marketplace entry
│   └── marketplace.json
├── .cursor-plugin/                             # Repo-root Cursor marketplace entry
│   └── marketplace.json
├── .gitignore
├── package.json
├── README.md
├── CONTRIBUTING.md
├── RELEASING.md
└── LICENSE
```

## Directory Purposes

**`plugins/`:**

- Purpose: Packaged, multi-provider plugins
- Contains: Self-contained plugin directories with provider manifests and skills
- Key files: `plugins/consensus/.claude-plugin/marketplace.json`, `plugins/consensus/.codex-plugin/marketplace.json`, `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`
- Notes: Consensus is the only v0.1 plugin; future skills will be added as siblings

**`skills/`:**

- Purpose: Standalone skills distributed outside plugin packages
- Contains: session-observer and export-session-transcript, each with scripts/lib structure
- Key files: `skills/session-observer/scripts/session-observer.mjs`, `skills/export-session-transcript/scripts/export-session-transcript.mjs`
- Notes: Standalone skills are invoked directly; not registered in plugin marketplaces (v0.1)

**`src/transcript/`:**

- Purpose: Canonical TypeScript source for transcript-core and export-session runtime code
- Contains: per-runtime transcript adapters, export CLI, and export content sanitizer
- Key files: `src/transcript/core/runtimes.ts`, `src/transcript/export-session/export-session-transcript.ts`, `src/transcript/export-session/sanitize.ts`
- Notes: Generated committed `.mjs` output remains under `skills/`; `sync-transcript-core.mjs` is only a compatibility wrapper

**`shared/transcript-core/`:**

- Purpose: Compatibility documentation pointer for the former transcript-core source path
- Contains: `README.md`
- Key files: `shared/transcript-core/README.md`
- Notes: Do not add canonical runtime source here; edit `src/transcript/core/runtimes.ts`

**`plugins/consensus/skills/refine/scripts/`:**

- Purpose: Deliberation and orchestration logic
- Contains: Main CLI (consensus-refine.mjs), loop engine (consensus-loop.mjs), subprocess coordination
- Key files: `consensus-refine.mjs` (entry), `consensus-loop.mjs` (deliberation)
- Notes: Exports JSONL for host coordination; handles sequential and parallel modes

**`plugins/consensus/agents/`:**

- Purpose: Host-facing task contracts for parallel section execution
- Contains: Documentation for subagent orchestration
- Key files: `consensus-section-runner.md` (subagent task contract)
- Notes: Defines how host dispatches parallel section runners

**`skills/session-observer/scripts/lib/`:**

- Purpose: Modular task layers for observation and watch
- Contains: Transcript discovery, ranking, delta detection, rendering, state, watch control
- Key files: `locate.mjs` (discovery), `observe.mjs` (catch-up), `digest.mjs` (rendering), `state.mjs` (persistence), `watch.mjs` (polling)
- Notes: No single monolithic orchestrator; each module handles one responsibility

**`skills/export-session-transcript/scripts/lib/`:**

- Purpose: Shared and skill-specific processing
- Contains: Vendored transcript-core (runtimes.mjs), sanitization filters
- Key files: `runtimes.mjs` (provider adapters), `sanitize.mjs` (content filtering)
- Notes: Minimal; most work is in CLI entry point

**`tests/`:**

- Purpose: Node and Vitest test suites
- Contains: Unit tests per module, integration tests, fixture data, generated-output drift coverage
- Key files: `*.test.mjs` and `*.test.ts` files
- Notes: Run via `npm test`; includes `tests/generated-output-sync.test.mjs` drift verification

**`scripts/`:**

- Purpose: Repository-level utilities
- Contains: generated-output build/check, compatibility transcript sync wrapper, validation, smoke testing, version management
- Key files: `build-generated.mjs` (generated output), `sync-transcript-core.mjs` (compatibility wrapper), `validate.mjs` (invariants), `smoke-test.mjs` (E2E)
- Notes: Build and validation checks run as part of CI

## Key File Locations

**Entry Points:**

- `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`: Main CLI for consensus refinement
- `skills/session-observer/scripts/session-observer.mjs`: CLI for session review/catch-up/watch
- `skills/export-session-transcript/scripts/export-session-transcript.mjs`: CLI for transcript export

**Configuration:**

- `.claude-plugin/marketplace.json`: Claude Code marketplace entry (repo-root)
- `.cursor-plugin/marketplace.json`: Cursor marketplace entry (repo-root)
- `plugins/consensus/.claude-plugin/marketplace.json`: Consensus plugin manifest for Claude Code
- `plugins/consensus/.codex-plugin/marketplace.json`: Consensus plugin manifest for Codex
- `plugins/consensus/.cursor-plugin/marketplace.json`: Consensus plugin manifest for Cursor
- `.claude/agents/`, `.cursor/agents/`, `.codex/agents/`: Provider-specific config (local, not shipped)

**Core Logic:**

- `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`: Deliberation engine (verdict validation, convergence, impasse)
- `skills/session-observer/scripts/lib/locate.mjs`: Transcript path discovery per runtime
- `skills/session-observer/scripts/lib/observe.mjs`: Delta detection and state tracking
- `skills/export-session-transcript/scripts/lib/sanitize.mjs`: Content filtering (payload removal)
- `src/transcript/core/runtimes.ts`: Provider adapter (canonical source)
- `src/transcript/export-session/export-session-transcript.ts`: Export CLI canonical source
- `src/transcript/export-session/sanitize.ts`: Export content sanitizer canonical source

**Testing:**

- `tests/generated-output-sync.test.mjs`: Verifies generated runtime outputs are in sync (run as part of `npm test`)
- `tests/consensus-loop-cli.test.mjs`: Tests deliberation loop, verdicts, convergence
- `tests/session-observer/cli.test.mjs`: Tests session-observer CLI argument parsing and subcommand dispatch
- `tests/export-session-transcript/cli.test.ts`: Tests export transcript CLI
- `tests/export-session-transcript/sanitize.test.ts`: Tests export content sanitizer
- `tests/transcript-core/runtimes.test.ts`: Tests transcript-core runtime helpers
- `tests/session-observer/digest.test.mjs`: Tests Markdown rendering
- `tests/session-observer/watch.test.mjs`: Tests watch polling and debounce logic

**Documentation:**

- `skills/session-observer/SKILL.md`: User guide for session-observer
- `skills/export-session-transcript/SKILL.md`: User guide for export-session-transcript
- `plugins/consensus/skills/refine/SKILL.md`: User guide for consensus refine
- `README.md`: Repository overview and usage instructions
- `RELEASING.md`: Release checklist
- `CONTRIBUTING.md`: Contribution guidelines

## Naming Conventions

**Files:**

- `.mjs`: ECMAScript modules (Node ESM)
- `.test.mjs`: Test files (run via `node --test`)
- `scripts/` entry points are CamelCase names (e.g., `consensus-refine.mjs`)
- Library modules in `lib/` are lowercase with hyphens (e.g., `digest.mjs`, `watch.mjs`)
- Manifests: `marketplace.json`, `SKILL.md`

**Directories:**

- `scripts/`: Executable entry points
- `lib/`: Library modules (utilities, business logic)
- `references/`: Runtime documentation (not part of public distribution)
- `schemas/`: JSON schema files (Consensus verdicts)
- `fixtures/`: Test data
- `.agents/`, `.claude/`, `.cursor/`, `.codex/`: Provider-specific config
- `.oat/`, `.github/`: Project infrastructure

**Environment Variables:**

- `STATE_DIR`: Overrides `~/.local/state/session-observer` for state files (used in tests)
- `SESSION_OBSERVER_SELF`: Declares which runtime to exclude when auto-detecting peers (e.g., `SESSION_OBSERVER_SELF=claude-code`)

## Where to Add New Code

**New Consensus Feature (e.g., new skill like `evaluate`):**

- Implementation: `plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs`
- Tests: `tests/consensus-evaluate.test.mjs`
- Docs: `plugins/consensus/skills/evaluate/SKILL.md`
- Manifests: `plugins/consensus/.claude-plugin/marketplace.json`, `.codex-plugin/`, `.cursor-plugin/` (update plugin list)

**New Session Observer Module:**

- Implementation: `skills/session-observer/scripts/lib/<module-name>.mjs`
- Tests: `tests/session-observer/<module-name>.test.mjs`
- Public API: Re-export from session-observer.mjs if user-facing, or internal-only if not

**Standalone Skill (not plugin-packaged):**

- Directory: `skills/<skill-name>/`
- Entry point: `skills/<skill-name>/scripts/<skill-name>.mjs`
- Lib modules: `skills/<skill-name>/scripts/lib/`
- Tests: `tests/<skill-name>/` or `tests/<skill-name>.test.mjs`
- Docs: `skills/<skill-name>/SKILL.md`

**Shared Adapter (for per-provider logic):**

- Canonical source: `shared/<module-name>/`
- Consumer copies: Sync via `scripts/sync-<module>.mjs`
- Examples: transcript-core is the only v0.1 synced module

**Tests:**

- Unit: Collocate with modules (e.g., `tests/session-observer/locate.test.mjs` tests `skills/session-observer/scripts/lib/locate.mjs`)
- Integration: `tests/<skill>/integration.test.mjs`
- Repository-wide: `tests/*.test.mjs` (e.g., `docs-presence.test.mjs`, `plugin-manifests.test.mjs`)

**Utilities:**

- Repo-level scripts: `scripts/<script-name>.mjs`
- Test helpers: `tests/helpers/<helper-name>.mjs`

## Special Directories

**`.oat/`:**

- Purpose: OAT project management state (not part of plugin distribution)
- Generated: Partially (by OAT commands and mappers)
- Committed: Yes (project structure committed; content may be ephemeral)

**`.agents/`, `.claude/`, `.cursor/`, `.codex/`:**

- Purpose: Provider-specific configuration and skill registrations
- Generated: By provider CLIs (when installing plugins)
- Committed: Partially (infrastructure in .agents/; provider config typically local-only)
- Note: `.claude/skills/`, `.cursor/skills/`, `.codex/skills/` are symlinks to canonical `~/.agents/skills/` after provider install

**`.github/workflows/`:**

- Purpose: CI/CD definitions
- Generated: No
- Committed: Yes

**`tests/fixtures/`:**

- Purpose: Test data (sample transcripts, manifests)
- Generated: No
- Committed: Yes

**`.consensus/` (runtime, within projects)**:

- Purpose: Deliberation state (run artifacts, resume checkpoints)
- Generated: By consensus-refine.mjs
- Committed: No (typically .gitignore'd)
- Note: Created in target project cwd; not part of this repo

## Vendoring and Sync Strategy

**Transcript-Core Module:**

- Canonical: `src/transcript/core/runtimes.ts`
- Consumers: `skills/session-observer/scripts/lib/runtimes.mjs`, `skills/export-session-transcript/scripts/lib/runtimes.mjs`
- Generate: `pnpm run build`
- Compatibility: `scripts/sync-transcript-core.mjs` delegates to `scripts/build-generated.mjs`
- Verification: `pnpm run build:check` and `npm test` via `tests/generated-output-sync.test.mjs`
- Workflow: Edit canonical TypeScript → run build → test → commit generated copies

**Why Vendoring:**

- Skills are distributed as standalone executables (no package.json dependencies)
- Synced copies ensure consumers are never out of sync without breaking the repo
- Single source of truth maintained by sync script and drift guard in tests

---

_Structure analysis: 2026-06-12_
