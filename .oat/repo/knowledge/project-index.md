---
oat_generated: true
oat_generated_at: 2026-07-17
oat_source_head_sha: 6c03afde1417fbe29f0e2c81009629f0e36ca945
oat_source_main_merge_base_sha: 6c03afde1417fbe29f0e2c81009629f0e36ca945
oat_index_type: full
oat_warning: "GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index"
---

# skills

## Overview

This repository ships a **consensus deliberation engine** and a set of **standalone
coding-agent skills**, packaged for the Claude Code, Codex, and Cursor agent
platforms. The consensus plugin lets two or more AI "peers" (local provider CLIs)
independently draft, critique, and converge on an artifact — a document, plan,
decision, or evaluation — with a full JSONL audit trail. Alongside it live
transcript skills (`session-observer`, `export-session-transcript`) that watch and
export coding-agent session transcripts.

## Purpose

The engine exists to make multi-model deliberation a first-class, provider-agnostic
workflow: rather than one model iterating alone, distinct peers run through a
bounded loop (alternating turns or parallel revision with synthesis) until they
converge or hit a documented impasse. Shipped skills run dependency-free on Node.js
22+ with no install step; provider CLI subprocesses are the only external execution
boundary.

## Technology Stack

- **Language:** TypeScript 6.0.3 (canonical source in `src/`, compiled to ES2024 ESM)
- **Runtime:** Node.js 22+ (ESM, `"type": "module"`); shipped skills use the Node
  standard library only — zero runtime dependencies
- **Package manager:** pnpm 10.13.1+ (dev tooling only; lockfile committed)
- **Build:** esbuild 0.28.1 bundles TS source → committed `.mjs` runtime outputs
- **Testing:** Vitest 4.1.9
- **Dev tooling:** oxlint, oxfmt, commitlint (Conventional Commits), lint-staged
- **Docs site:** Next.js 16 + React 19 + Fumadocs 16 + Tailwind 4 (`documentation/`)

See [stack.md](stack.md) for full detail.

## Architecture

A multi-layered, provider-agnostic design: **config resolution** → **core
deliberation loop** → **skill wrappers**, with a **provider CLI layer** abstracting
peer communication over local subprocesses (probe-time capability discovery,
structured-output strategies, retry logic). Three deliberation modes — *alternating*,
*parallel_revision*, and *parallel_synthesized*. Verdict and synthesis payloads are
schema-bound JSON; every turn is recorded as a JSONL `LoopRecord`. A separate
**transcript core** underpins the session-observer and export skills.

See [architecture.md](architecture.md) for layers, data flow, and abstractions.

## Key Features

- **Consensus skills:** create, decide, plan, refine, evaluate, panel, phone-a-friend
- **Provider abstraction:** Claude / Codex / Cursor (or custom) via local CLI subprocess
- **Deliberation modes:** alternating turns, parallel revision, parallel + synthesis
- **Audit trail:** JSONL records with verdict, reasoning, artifact hash, and cost
- **Session observation:** watch peer coding-agent transcripts, ranked digests
- **Transcript export:** sanitized, canonical-format session export
- **Bounded collaboration:** session-observer-collab (user + two mutually-observing agents)

## Project Structure

```
src/          Canonical TypeScript source (consensus engine + transcript tools)
plugins/      Packaged consensus plugin (ships to providers; generated .mjs runtimes)
skills/       Standalone skills (session-observer, -collab, export-session-transcript)
tests/        Vitest suite, organized by domain
scripts/      Build, validation, versioning, and test infrastructure
documentation/  Fumadocs docs site (User Guide + Engineering trunks)
.oat/         OAT repo state (pjm backlog/roadmap, reference/decisions, knowledge)
```

See [structure.md](structure.md) for the full directory map and naming conventions.

## Getting Started

```bash
# Requires Node.js 22+ and pnpm 10.13.1+
pnpm install            # installs dev deps + git hooks
pnpm run build          # regenerate .mjs runtime outputs from src/
```

Shipped skills need no install step; the consensus workflows require the local
provider CLIs (`claude`, `codex`, `cursor`) for whichever peers you invoke.

## Development Workflow

```bash
pnpm run build          # bundle TS source → generated .mjs runtimes
pnpm run build:check    # verify generated outputs match source
pnpm run test           # full Vitest suite
pnpm run validate       # repo structure, manifest, and docs invariants
pnpm run smoke          # mocked end-to-end consensus wrapper flow
pnpm run premerge       # build + type-check + test + validate + smoke
pnpm lint / pnpm format # oxlint / oxfmt (incremental, changed files only)
```

Commits follow Conventional Commits (enforced by `commit-msg` hook + CI). Any change
under a canonical skill directory must bump that skill's `SKILL.md` version.

## Testing

Vitest 4.1.9 (Node environment, 30s timeout), tests at `tests/**/*.test.ts`,
organized by domain (consensus, session-observer, transcript-core, tooling, repo,
release). No watch mode or coverage thresholds configured. Run with
`pnpm run test`.

See [testing.md](testing.md) for structure, fixtures, and mocking patterns.

## Known Issues

Notable areas: large monolithic modules (`consensus-loop.ts`, `consensus-refine.ts`,
`session-observer.ts`), manual exact-path lint/format exclusions for generated output
(drift risk), and N>2 multi-observer collaboration being deliberately unsupported
(safe only for the documented N=2 topology).

See [concerns.md](concerns.md) for the full tech-debt, limitations, and performance list.

---

**Generated Knowledge Base Files:**

- [stack.md](stack.md) - Technologies and dependencies
- [architecture.md](architecture.md) - System design and patterns
- [structure.md](structure.md) - Directory layout
- [integrations.md](integrations.md) - External services and providers
- [testing.md](testing.md) - Test structure and practices
- [conventions.md](conventions.md) - Code style and patterns
- [concerns.md](concerns.md) - Technical debt and issues
