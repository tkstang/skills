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

Node.js >= 22, ESM, **standard library only** (no runtime dependencies, no build step). Markdown skill definitions with provider manifests (`.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/`). External tool boundary: shells out to the `paseo` CLI (consensus peers) — never embedded (AGPL boundary, DR-002). See [stack.md](stack.md).

## Architecture

Skills-first repo with self-contained sub-plugins (DR-001). Consensus splits a deterministic orchestrator (wrapper + loop engine scripts, JSONL stdout as host coordination protocol) from the host model layer (SKILL.md instructions, host-mediated parallel dispatch per DR-003). Transcript skills share per-provider format knowledge through `shared/transcript-core/` with generated committed copies and a drift guard (DR-014). See [architecture.md](architecture.md).

## Key Features

- `consensus:refine` — alternating-mode two-peer deliberation with hash convergence, agency levels, resume-from-artifact, host-mediated parallel sections.
- `session-observer` — review/catch-up/locate digests of peer agent sessions across three runtimes, plus foreground polling watch mode with control directives.
- `export-session-transcript` — marker-matched current-session export with two-layer sanitization.
- `shared/transcript-core` — canonical provider transcript knowledge, `npm run sync:transcript-core` + drift-guard test.

## Project Structure

- `plugins/consensus/` — plugin package (skills, agents contract, provider manifests)
- `skills/` — standalone skills (session-observer, export-session-transcript)
- `shared/transcript-core/` — canonical shared library
- `scripts/` — validate, smoke-test, sync, install-assist, version bump
- `tests/` — `node --test` suites mirroring skill/plugin layout
- `.oat/repo/reference/` — planning surfaces (roadmap, current-state, decision-record, backlog, research)
- `.agents/`, `.claude/`, `.cursor/`, `.codex/` — OAT canonical skills + generated provider views (not shipped)

See [structure.md](structure.md).

## Getting Started

No install step (stdlib only). Node >= 22 required. Consensus additionally needs `paseo` on PATH (`node scripts/install-paseo.mjs` for assisted install).

## Development Workflow

- `npm test` — full suite
- `npm run validate` — structure/manifest/docs invariants
- `npm run smoke` — mocked end-to-end consensus flow
- `npm run sync:transcript-core` — regenerate shared-library consumer copies
- `oat sync --scope all` — refresh provider skill views

## Testing

`node --test` (Node built-in runner), ~382 tests. Heavy use of temp-HOME fixtures, paseo-stub mocks for consensus integration, injected time/sleep hooks for watch-mode determinism. See [testing.md](testing.md).

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
