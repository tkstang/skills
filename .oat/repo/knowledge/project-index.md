---
oat_generated: true
oat_generated_at: 2026-06-20
oat_source_head_sha: e4e9348cf8b809448c693ed7182c017048eb4acf
oat_source_main_merge_base_sha: e4e9348cf8b809448c693ed7182c017048eb4acf
oat_index_type: full
oat_warning: "GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index"
---

# skills

## Overview

`skills` is a personal Agent Skills home (v0.1.0 pre-release). It ships standalone Agent Skills under `skills/` and packaged plugins under `plugins/<name>/`, all authored from canonical TypeScript in `src/` and distributed as committed, dependency-free `.mjs` runtime outputs that agent runtimes (Claude Code, Codex, Cursor) execute with no install step.

## Purpose

It packages reusable agent capabilities — multi-peer consensus deliberation, and tooling to observe and export agent session transcripts — in a provider-portable way. The hard constraint shaping the whole repo: shipped runtime code uses only the Node standard library, with provider CLI subprocesses as the sole external execution boundary.

## Technology Stack

- **Language:** TypeScript `^6.0.3` (canonical source, type-checked `--noEmit`) → generated JavaScript ESM `.mjs` (shipped runtime).
- **Runtime:** Node.js `>=22`, ESM (`"type": "module"`).
- **Package manager:** pnpm `>=10.13.1` (pinned `pnpm@10.13.1`, lockfile committed). Dev-only deps; **zero runtime dependencies**.
- **Build/test tooling:** esbuild (TS→.mjs), Vitest, oxlint, oxfmt, commitlint, lint-staged.

See [stack.md](stack.md).

## Architecture

Multi-module monorepo with a canonical-source/generated-output split: logic is written once in `src/`, built to committed `.mjs` at the exact paths manifests and users execute, and verified against drift by the test suite. Two domains — `consensus/` (deliberation engine + provider-CLI layer) and `transcript/` (shared transcript core + session-observer + export). See [architecture.md](architecture.md).

## Key Features

- **Consensus plugin** (`plugins/consensus/`): `refine` (markdown refinement to a converged artifact with audit trail) and `evaluate` (artifact-vs-rubric with preserved dissent), with iteration modes (`alternating`, `parallel_revision`, `parallel_synthesized`), an agency-gated escalation ladder, and a configurable synthesizer.
- **Session observer** (`skills/session-observer/`): tool-free digests of what another coding agent (Claude Code / Codex / Cursor) just did, with per-session read offsets and a foreground watch mode.
- **Export session transcript** (`skills/export-session-transcript/`): exports the current session to a sanitized Markdown transcript, selected via an announced session marker.
- **Shared transcript-core** (`src/transcript/core/runtimes.ts`): single source of per-provider transcript knowledge, materialized into each consumer's generated `scripts/lib/runtimes.mjs`.

## Project Structure

```
src/        # Canonical TypeScript source (consensus/, transcript/) — edit here
plugins/    # Packaged plugins (consensus) — generated .mjs + provider manifests
skills/     # Standalone skills (session-observer, export-session-transcript)
shared/     # Shared docs
scripts/    # Dev tooling (build-generated, validate, smoke, bump-version, worktree/)
tests/      # Vitest suite (72 files) + fixtures + repo-invariant tests
tools/      # git-hooks
.oat/       # OAT workflow state + repo knowledge base
.github/    # CI workflows (validate.yml, release.yml)
```

See [structure.md](structure.md).

## Getting Started

```bash
pnpm install          # installs dev deps + git hooks (GIT_HOOKS=0 to skip)
pnpm run build        # regenerate committed .mjs from src/
pnpm run premerge     # build + type-check + build:check + test + validate + smoke
```

Requires Node `>=22` and pnpm `>=10.13.1`.

## Development Workflow

- Edit canonical TS under `src/`, then `pnpm run build` (never hand-edit generated `.mjs`).
- `pnpm run lint` / `pnpm run format` (incremental adoption — staged files only; don't run repo-wide format in unrelated PRs).
- Commits follow **Conventional Commits**, enforced by the `commit-msg` hook and CI.
- New worktrees: `pnpm run worktree:init`; pre-merge: `pnpm run worktree:validate`.

See [conventions.md](conventions.md).

## Testing

Vitest (`pnpm run test`, via `scripts/run-vitest.mjs`) over 72 test files: unit, integration (real subprocess + fixture stub binaries), repo-invariant, and release suites. `tests/tooling/generated-output-sync.test.ts` guards generated-output drift. `pnpm run smoke` runs the mocked end-to-end consensus flow; live-provider paths are release-checklist gated. See [testing.md](testing.md).

## Known Issues

v0.1 pre-release: clean tree, no `TODO`/`FIXME` in `src/`. Main concerns are structural — multi-file sync obligations (lint/format exclusions, version triple-sync), the canonical-source→generated-output discipline, and an unverified live-provider/marketplace path (consensus permission declaration still `provisional`). See [concerns.md](concerns.md).

---

**Generated Knowledge Base Files:**

- [stack.md](stack.md) - Technologies and dependencies
- [architecture.md](architecture.md) - System design and patterns
- [structure.md](structure.md) - Directory layout
- [integrations.md](integrations.md) - External services
- [testing.md](testing.md) - Test structure and practices
- [conventions.md](conventions.md) - Code style and patterns
- [concerns.md](concerns.md) - Technical debt and issues
