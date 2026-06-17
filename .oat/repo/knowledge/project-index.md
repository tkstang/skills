---
oat_generated: true
oat_generated_at: 2026-06-12
oat_source_head_sha: d008a7e571d90cc6c436c82e176129f62ab54ec4
oat_source_main_merge_base_sha: ed22b463dcdaa466476b0957fea64deb3f663391
oat_index_type: full
oat_warning: "GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index"
---

# skills

## Overview

Personal Agent Skills home: standalone skills under `skills/`, packaged plugins under `plugins/<name>/`, a shared library under `shared/`, and provider marketplace entries at the repo root. The flagship deliverable is the `consensus` plugin — structured two-peer AI deliberation on markdown artifacts via Paseo — alongside the `session-observer` (peer-transcript review + watch mode) and `export-session-transcript` (sanitized transcript export) standalone skills.

## Purpose

Reduce manual shuttling between AI coding agents: consensus deliberation automates peer refinement loops with an audit trail; the transcript skills let one agent observe, catch up on, or export what another agent did. Built multi-provider (Claude Code, Codex, Cursor) from day one; v0.1 pre-release, local/Git install paths only.

## Technology Stack

Node.js >= 22, ESM, **standard library only** in shipped runtime output. Canonical developer source for migrated runtimes lives under `src/` and generates committed `.mjs` files with `scripts/build-generated.mjs`. Markdown skill definitions with provider manifests (`.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/`). External tool boundary: shells out to the `paseo` CLI (consensus peers) — never embedded (AGPL boundary, DR-002). See [stack.md](stack.md).

## Architecture

Skills-first repo with self-contained sub-plugins (DR-001). Consensus splits a deterministic orchestrator (wrapper + loop engine scripts, JSONL stdout as host coordination protocol) from the host model layer (SKILL.md instructions, host-mediated parallel dispatch per DR-003). Transcript skills share per-provider format knowledge through `src/transcript/core/runtimes.ts` with generated committed copies and a drift guard (DR-014 superseded by DR-020/DR-021). See [architecture.md](architecture.md).

## Key Features

- `consensus:refine` — alternating-mode two-peer deliberation with hash convergence, agency levels, resume-from-artifact, host-mediated parallel sections.
- `session-observer` — review/catch-up/locate digests of peer agent sessions across three runtimes, plus foreground polling watch mode with control directives.
- `export-session-transcript` — marker-matched current-session export with two-layer sanitization.
- `transcript-core` — canonical provider transcript knowledge in `src/transcript/core/runtimes.ts`, generated into skill-local `scripts/lib/runtimes.mjs` copies.

## Project Structure

- `plugins/consensus/` — plugin package (skills, agents contract, provider manifests)
- `skills/` — standalone skills (session-observer, export-session-transcript)
- `src/` — canonical TypeScript source for migrated consensus and transcript runtimes
- `shared/transcript-core/` — compatibility documentation pointer for the former transcript-core source path
- `scripts/` — generated-output build/check, validate, smoke-test, compatibility sync, install-assist, version bump
- `tests/` — Node and Vitest suites mirroring skill/plugin layout
- `.oat/repo/reference/` — planning surfaces (roadmap, current-state, decision-record, backlog, research)
- `.agents/`, `.claude/`, `.cursor/`, `.codex/` — OAT canonical skills + generated provider views (not shipped)

See [structure.md](structure.md).

## Getting Started

No install step (stdlib only). Node >= 22 required. Consensus additionally needs `paseo` on PATH (`node scripts/install-paseo.mjs` for assisted install).

## Development Workflow

- `npm test` — full Node plus Vitest suite
- `npm run validate` — structure/manifest/docs invariants
- `npm run smoke` — mocked end-to-end consensus flow
- `npm run build` / `npm run build:check` — regenerate or check committed generated runtime outputs
- `npm run sync:transcript-core` — compatibility wrapper around the generated-output build
- `oat sync --scope all` — refresh provider skill views

## Testing

Node `node:test` plus Vitest TypeScript suites. Heavy use of temp-HOME fixtures, paseo-stub mocks for consensus integration, generated-output drift checks, and injected time/sleep hooks for watch-mode determinism. See [testing.md](testing.md).

## Known Issues

See [concerns.md](concerns.md). Highlights: v0.1 release gated on manual provider verification (`RELEASING.md`); Paseo pre-1.0 CLI surface pinned to a tested range; watch tests are timing-sensitive (deterministic waits added 2026-06-12).

**Generated Knowledge Base Files:**

- [stack.md](stack.md) - Technologies and dependencies
- [architecture.md](architecture.md) - System design and patterns
- [structure.md](structure.md) - Directory layout
- [integrations.md](integrations.md) - External services
- [testing.md](testing.md) - Test structure and practices
- [conventions.md](conventions.md) - Code style and patterns
- [concerns.md](concerns.md) - Technical debt and issues
