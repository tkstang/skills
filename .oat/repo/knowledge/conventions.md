---
oat_generated: true
oat_generated_at: 2026-06-20
oat_source_head_sha: e4e9348cf8b809448c693ed7182c017048eb4acf
oat_source_main_merge_base_sha: e4e9348cf8b809448c693ed7182c017048eb4acf
oat_warning: "GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index"
---

# Coding Conventions

**Analysis Date:** 2026-06-20

## Naming Patterns

**Files:**

- kebab-case for source and generated runtime (`consensus-loop.ts`, `host-guard.ts`, `session-observer.mjs`).
- Tests named `<subject>.test.ts`, co-located under a mirroring `tests/` tree.

**Functions:**

- camelCase, verb-first (`buildClaudeInvocation`, `classifyRunFailure`, `normalizeEntries`, `sanitizeEntries`).

**Variables:**

- camelCase locals; UPPER_SNAKE for env var reads (`process.env.STATE_DIR`, `CLAUDECODE`).

**Types:**

- PascalCase interfaces/type aliases (`ProviderAdapter`, `ProviderInvocationBuilder`, `ProviderRunFailureClassification`). Discriminated unions and `Extract<...>` used for narrowing provider error codes.

## Code Style

**Formatting:**

- oxfmt (`.oxfmtrc.json`). Run `pnpm run format`; verify with `pnpm run format:check`.
- Adoption is **incremental** — `pre-commit` formats staged files only; CI format-checks only changed files. Do **not** run repo-wide `pnpm format` in unrelated PRs (a one-time wholesale format is a planned follow-up).
- Never format generated outputs, `.agents/**`, `.claude/rules/**`, `.cursor/rules/**`, or `AGENTS.md`/`CLAUDE.md` at any level. Exclusions must stay in sync across `.oxfmtrc.json`, `.lintstagedrc.mjs`, and the CI `oxfmt --check` step.

**Linting:**

- oxlint (`.oxlintrc.json`); correctness/suspicious rules at error. `pnpm run lint`, `pnpm run lint:fix`.
- Generated `.mjs` lint exclusions stay in sync across `.oxlintrc.json`, `.lintstagedrc.mjs`, and the CI oxlint step.

## Import Organization

**Order (TypeScript, NodeNext + verbatimModuleSyntax):**

1. `import type { ... }` type-only imports (required by `verbatimModuleSyntax`/`isolatedModules`).
2. Node built-ins via `node:` specifier (`node:fs/promises`, `node:path`, `node:child_process`).
3. Local module imports using explicit `.js` extensions (NodeNext resolution; source `.ts` imported as `.js`).

**Path Aliases:**

- None. Relative paths only.

## Error Handling

**Patterns:**

- Typed, classified failures over thrown strings. Provider failures are mapped to a closed set of `ProviderErrorCode`s with `retryable` flags (`adapters.ts` / `classifyRunFailure`).
- Subprocess boundaries enforce timeouts and output caps and translate them into structured error codes rather than uncaught exceptions.
- CLI entry points convert failures into non-zero exit codes.

## Logging

**Framework:** Node `console` / process streams. No logging library (zero-runtime-dependency contract).

**Patterns:**

- Human-facing output to stdout; diagnostics to stderr. Persistent records (deliberation logs, digests) are written as artifacts, not logged.

## Comments

**When to Comment:**

- Sparingly, to explain non-obvious contracts. Generated files carry a `// GENERATED` banner warning against hand-editing.

**JSDoc/TSDoc:**

- Light; types carry most of the documentation. Interfaces are self-describing.

## Function Design

**Size:** Small, single-purpose functions; provider concerns split across focused modules (`args`, `commands`, `envelope`, `invocation`, `subprocess`, `probe`, `host-guard`, `runtime-policy`).

**Parameters:** Prefer a single typed options/input object for multi-field inputs (e.g. `ProviderRunFailureInput`).

**Return Values:** Typed result objects; classification objects instead of booleans where context matters.

## Module Design

**Exports:** Named exports throughout; no default exports observed in `src/`.

**Barrel Files:** Not used. Consumers import directly from specific modules.

## Cross-Cutting Repo Rules (from CLAUDE.md / AGENTS.md)

- Shipped skill code is **dependency-free**, Node stdlib only; provider CLI subprocesses are the only external boundary.
- Dev dependencies use **pnpm**; never add runtime dependencies to shipped skills.
- Edit canonical TS under `src/`, then `pnpm run build`. Never hand-edit generated `.mjs`.
- Commits follow **Conventional Commits** (`type(scope): subject`), enforced by the `commit-msg` hook (commitlint) and CI.
- When shipping a behavior/content change to a skill, bump that skill's `version` and keep top-level `version` + `metadata.version` in sync (validated by `scripts/validate.mjs`); ensure the skill is listed in `SKILL_FILES` in `scripts/bump-version.mjs`.

---

_Convention analysis: 2026-06-20_
