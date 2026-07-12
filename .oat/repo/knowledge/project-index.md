---
oat_generated: true
oat_generated_at: 2026-07-11
oat_source_head_sha: 0e25a36d3958a1e09c7bedaddd6d3498dc0905d7
oat_source_main_merge_base_sha: 17043d653233fb906e018f5872359d99eb556208
oat_index_type: full
oat_warning: "GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index"
---

# skills

## Overview

A cross-provider agent skills repository. It ships the **consensus plugin** — a
multi-peer deliberation engine that runs Claude, Codex, and Cursor against each
other in structured rounds until they converge on an artifact — plus two
standalone **transcript skills** (`session-observer`, `export-session-transcript`).

The defining constraint is **no-install-step shipping**: everything that ships
runs on the Node standard library with zero dependencies. Canonical logic is
written in TypeScript under `src/`, then built into committed, dependency-free
ESM (`.mjs`) runtime outputs under `plugins/` and `skills/`.

## Purpose

Agent skills must run wherever a provider CLI can spawn them, with no package
install and no network fetch at execution time. That rules out a normal
dependency graph. This repo solves it by keeping TypeScript as a developer-only
convenience and treating the generated `.mjs` output as the real shipped
artifact, with build-drift guards to keep the two honest.

## Technology Stack

- **Language:** TypeScript 6.0.3 (source) → Node ESM `.mjs` (shipped)
- **Runtime:** Node.js >= 22
- **Package manager:** pnpm >= 10.13.1 (`pnpm-lock.yaml` committed)
- **Build:** esbuild 0.28.1 via `scripts/build-generated.mjs`
- **Test:** Vitest 4.1.9
- **Lint/format:** oxlint 1.69.0 / oxfmt 0.48.0
- **Docs site:** Next.js 16 + React 19 + Fumadocs 16 + Tailwind 4

Shipped skills have **no runtime dependencies**. Dev tooling may have them.

See [stack.md](stack.md).

## Architecture

Canonical TypeScript source → generated dependency-free ESM runtime, with the
provider CLI as the single external boundary.

Layers:

- **Consensus core loop** (`src/consensus/core/`) — round orchestration, verdict
  parsing, convergence detection, synthesis, escalation
- **Provider CLI** (`src/consensus/provider-cli/`) — the only external
  integration; spawns `claude` / `codex` / `cursor-agent` as subprocesses with
  structured request/response, schema validation, retries, and host guards
- **Consensus skills** (`decide`, `create`, `plan`, `refine`, `evaluate`,
  `panel`, `phone-a-friend`) — domain workflows over the core loop
- **Transcript capture** (`src/transcript/`) — session observation and export
- **Config** (`src/consensus/config/`) — peer/panelist resolution across user and
  project scopes

Peers return a structured verdict (`REVISE` / `ACCEPT` / `CONVERGED` / `IMPASSE`)
each round; the loop records it as JSONL, hashes the artifact to detect
convergence, and escalates to host or user when peers oscillate or deadlock.

See [architecture.md](architecture.md).

## Key Features

- **Multi-peer consensus loop** with three iteration modes: `alternating`,
  `parallel_revision`, `parallel_synthesized`
- **Provider-agnostic execution** — one plugin, three provider manifests
  (`.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/`)
- **Graceful structured-output degradation** — uses `constrained_native` when the
  provider supports it, falls back to `provider_validated` then `prompt_only`,
  and records which strategy actually ran
- **Auditable deliberation** — every round, verdict, and intervention persisted
  as a JSONL record with artifact hashes
- **Session transcript observation and export** across all three runtimes

## Project Structure

```
src/            Canonical TypeScript source (developer-only)
  consensus/      core/ provider-cli/ config/ + per-skill logic
  transcript/     core/ session-observer/ export-session/
plugins/        Built + committed consensus plugin (.mjs, per-provider manifests)
skills/         Standalone shipped skills (session-observer, export-session-transcript)
tests/          Vitest suite, mirrors src/ layout
scripts/        Build, validation, and version-bump tooling
documentation/  Fumadocs site (User Guide / Engineering trunks)
tools/          Git hooks
.oat/           OAT repo state: pjm/ backlog + reference/ decisions + knowledge/
```

`.agents/`, `.claude/`, `.cursor/`, `.codex/` are **oat sync-generated mirrors**,
not canonical sources.

See [structure.md](structure.md).

## Getting Started

```bash
pnpm install          # installs dev deps + git hooks
pnpm run build        # regenerate .mjs runtime from src/
pnpm test             # Vitest suite
```

Consensus peers require the provider CLIs on PATH: `claude`, `codex`,
`cursor-agent`.

## Development Workflow

| Command | Purpose |
| --- | --- |
| `pnpm run build` | Regenerate committed `.mjs` from `src/` |
| `pnpm run build:check` | Fail if generated output has drifted from source |
| `pnpm test` | Full Vitest suite |
| `pnpm run validate` | Repo structure, manifest, and docs invariants |
| `pnpm run smoke` | Mocked end-to-end consensus wrapper flow |
| `pnpm run premerge` | Aggregate pre-merge gate |

Two rules bite most often: **never hand-edit a `.mjs` file with a `// GENERATED`
banner** (edit the TypeScript and rebuild), and **any change under a skill
directory must bump that skill's `SKILL.md` version** (enforced by
`scripts/validate-skill-versions.mjs` in CI and the pre-push hook).

Commits follow Conventional Commits, enforced by a `commit-msg` hook.

## Testing

Vitest 4.1.9, Node environment, `tests/**/*.test.ts` with a 30s timeout to
accommodate integration tests that spawn real subprocesses. Provider CLIs are
mocked at the subprocess boundary. **No coverage tooling is configured.**

See [testing.md](testing.md).

## Known Issues

Documented tech debt spans provider-CLI fragility, generated-output drift risk,
and test-coverage gaps — no coverage enforcement exists, and the provider
capability matrix degrades silently when a provider changes its structured-output
behavior.

See [concerns.md](concerns.md).

---

**Generated Knowledge Base Files:**

- [stack.md](stack.md) - Technologies and dependencies
- [architecture.md](architecture.md) - System design and patterns
- [structure.md](structure.md) - Directory layout
- [integrations.md](integrations.md) - External services
- [testing.md](testing.md) - Test structure and practices
- [conventions.md](conventions.md) - Code style and patterns
- [concerns.md](concerns.md) - Technical debt and issues
