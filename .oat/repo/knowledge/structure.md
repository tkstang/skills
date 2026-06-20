---
oat_generated: true
oat_generated_at: 2026-06-20
oat_source_head_sha: e4e9348cf8b809448c693ed7182c017048eb4acf
oat_source_main_merge_base_sha: e4e9348cf8b809448c693ed7182c017048eb4acf
oat_warning: "GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index"
---

# Codebase Structure

**Analysis Date:** 2026-06-20

## Directory Layout

```
skills/
├── src/                  # Canonical TypeScript source (edit here)
│   ├── consensus/        # Consensus engine: core loop, evaluate, refine, provider-cli
│   └── transcript/       # transcript-core, export-session, session-observer
├── plugins/              # Packaged plugins (shipped)
│   └── consensus/        # Consensus plugin: skills/refine, skills/evaluate + provider manifests
├── skills/               # Standalone skills (shipped)
│   ├── session-observer/        # SKILL.md + generated scripts/
│   └── export-session-transcript/
├── shared/               # Shared docs (transcript-core README)
├── scripts/              # Dev tooling: build, validate, smoke, bump-version, run-vitest, worktree/
├── tests/                # Vitest suite (consensus, transcript, repo invariants, release)
├── tools/                # git-hooks/ (commit-msg, pre-commit, pre-push, post-checkout)
├── .agents/skills/       # OAT skill packs (provider-synced views)
├── .oat/                 # OAT workflow state, repo knowledge, tracking
├── .claude-plugin/       # marketplace.json (local marketplace)
├── .github/workflows/    # validate.yml, release.yml
└── *.json / *.mjs        # Root configs (package.json, tsconfig, vitest, oxlint, oxfmt)
```

## Directory Purposes

**`src/`:**

- Purpose: Single source of truth for all runtime logic, written in TypeScript.
- Contains: `consensus/` (core, evaluate, refine, provider-cli) and `transcript/` (core, export-session, session-observer/lib).
- Key files: `src/consensus/core/consensus-loop.ts`, `src/consensus/refine/consensus-refine.ts`, `src/transcript/core/runtimes.ts`.

**`plugins/consensus/`:**

- Purpose: Self-contained, installable consensus plugin.
- Contains: `skills/refine/`, `skills/evaluate/` (each with `SKILL.md`, `scripts/`, `schemas/`, `references/`), `agents/`, plus `.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/` manifests.
- Key files: `plugins/consensus/.claude-plugin/plugin.json`, generated `scripts/consensus-*.mjs`.

**`skills/`:**

- Purpose: Standalone Agent Skills (not part of a plugin).
- Contains: `session-observer/` and `export-session-transcript/`, each with `SKILL.md`, `references/`, and generated `scripts/`.

**`scripts/`:**

- Purpose: Developer tooling (not shipped).
- Key files: `build-generated.mjs` (TS→.mjs), `validate.mjs`, `smoke-test.mjs`, `bump-version.mjs`, `run-vitest.mjs`, `sync-transcript-core.mjs`, `worktree/`.

**`tests/`:**

- Purpose: Vitest suite (72 test files) plus fixtures and helpers.
- Notable: `tests/repo/` (layout, manifest, frontmatter invariants), `tests/release/`, `tests/tooling/generated-output-sync.test.ts` (drift guard).

## Key File Locations

**Entry Points (generated runtime):**

- `plugins/consensus/skills/refine/scripts/consensus-refine.mjs` — refine skill CLI
- `plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs` — evaluate skill CLI
- `skills/session-observer/scripts/session-observer.mjs` — session-observer CLI
- `skills/export-session-transcript/scripts/export-session-transcript.mjs` — export CLI

**Configuration:**

- `package.json`, `tsconfig.json`, `vitest.config.mjs`, `.oxlintrc.json`, `.oxfmtrc.json`, `commitlint.config.js`, `.lintstagedrc.mjs`

**Core Logic (canonical):**

- `src/consensus/` and `src/transcript/`

**Testing:**

- `tests/**/*.test.ts`, fixtures under `tests/**/fixtures/`

## Naming Conventions

**Files:**

- Source: kebab-case `.ts` (e.g. `consensus-loop.ts`, `provider-cli/host-guard.ts`).
- Generated runtime: kebab-case `.mjs` at the path manifests/users execute, carrying a `// GENERATED` banner.
- Tests: `<name>.test.ts` mirroring the `src/` area under `tests/`.

**Directories:**

- kebab-case, grouped by domain (`consensus/`, `transcript/`) then concern (`core/`, `provider-cli/`, `session-observer/lib/`).

## Where to Add New Code

**New runtime behavior:**

- Primary code: edit canonical TypeScript under `src/<domain>/...`, then run `pnpm run build` to regenerate the committed `.mjs`. Never hand-edit generated `.mjs`.
- Tests: add `tests/<domain>/<name>.test.ts`.

**New shared transcript logic:**

- Edit `src/transcript/core/runtimes.ts`; rebuild to update each consumer's `scripts/lib/runtimes.mjs`.

**Dev tooling / scripts:**

- `scripts/` (mjs) or `tools/git-hooks/`.

## Special Directories

**`.oat/`:**

- Purpose: OAT workflow state, repo knowledge base (`.oat/repo/knowledge/`), tracking manifest.
- Generated: Partly (knowledge files are generated). Committed: Yes.

**Generated `.mjs` under `plugins/` and `skills/scripts/`:**

- Purpose: dependency-free runtime output built from `src/`.
- Generated: Yes (`// GENERATED` banner). Committed: Yes (users execute them with no install step).

**`.agents/`, `.claude/`, `.cursor/`, `.codex/`:**

- Purpose: provider-specific synced skill/rule views (via `oat sync`). Excluded from lint/format. Committed: Yes.

---

_Structure analysis: 2026-06-20_
