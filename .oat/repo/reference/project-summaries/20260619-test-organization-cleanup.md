---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-19
oat_generated: true
oat_summary_last_task: p03-t03
oat_summary_revision_count: 0
oat_summary_includes_revisions: []
---

# Summary: test-organization-cleanup

## Overview

After the Vitest migration landed (PR4 retired the `node:test` runner), the test
tree still reflected migration history more than product domains: 39 of 53 suites
sat directly under `tests/`, and common subprocess/path/fixture setup was
duplicated across files. This quick-mode project was a focused, behavior-preserving
maintainability cleanup — reorganize the suite around domain boundaries and shared
helpers without changing any runtime behavior or generated output.

## What Was Implemented

- **Shared test helpers.** Extended `tests/helpers/process.mjs` (+`process.d.mts`)
  with `repoRoot`, `fixtureBin`, `sampleInput`, `makeStubEnv`, and `readJson`, and
  added `tests/helpers/consensus.ts` with `extractJsonBlock`. Adopted them across a
  representative subset of consensus, transcript, and tooling suites to remove real
  duplication without hiding test intent.
- **Domain directory layout.** Moved tests into product/domain directories:
  consensus suites under `tests/consensus/{core,refine,evaluate}/` (with
  generated-entrypoint tests kept visibly separate at `tests/consensus/`), repo
  invariants under `tests/repo/`, release/versioning under `tests/release/`, and
  build/tooling guards under `tests/tooling/`. Relative imports and path-enumeration
  assertions were updated for the new depth.
- **Conservative suite splits.** Split two genuinely oversized suites by behavior:
  `consensus/refine/parallel-modes.test.ts` (791 lines) into convergence /
  escalation-lifecycle / resume-matrix files, and `session-observer/cli.test.ts`
  (1439 lines) into a base file plus a `--session` override file.
- **Documentation.** Rewrote `tests/AGENTS.md` with a domain-layout table, fixed
  stale test-path references in root `AGENTS.md`, `README.md`, `CLAUDE.md`,
  `shared/transcript-core/README.md`, and refreshed the repo reference docs
  (`current-state.md`, `roadmap.md`, `backlog/index.md`).

The suite ended at 572 tests across 56 files — identical test count, more files —
confirming exact behavior preservation.

## Key Decisions

- **Group by behavior, not migration history.** Consensus tests were organized by
  behavior area (core / refine / evaluate) rather than by the PR that introduced
  them, and generated shipped `.mjs` entrypoint coverage was kept visibly separate
  from canonical-source unit tests to preserve the source-vs-shipped testing
  contract.
- **Helpers only where they reduce real duplication.** Domain-specific `spawnCli`
  helpers (session-observer / export-session-transcript) and the JSONL
  `captureStdout` event capturer were left local — centralizing them would not
  reduce real duplication and would obscure intent.
- **Conservatism on splits.** `session-observer/watch.test.ts` (timing-sensitive,
  single describe) and `transcript-core/runtimes.test.ts` (well-organized, no clean
  behavior axis) were intentionally left unsplit; an unnecessary split is worse than
  none.

## Design Deltas

- `readJson` / `extractJsonBlock` return `any` rather than `unknown` to match the
  original local helper types and avoid caller type-guard rewrites that were out of
  scope. Recorded as accepted type looseness; implementation is source of truth.
- `repo-layout.test.ts` was renamed to `tests/repo/layout.test.ts` (the domain
  prefix is redundant under the domain directory), and `generated-output-sync.test.ts`
  was placed in `tests/tooling/` as a build guard. The plan left the exact target
  names open; these are accepted refinements documented in `implementation.md`.

## Notable Challenges

- Moving files one or two directory levels deeper broke many relative imports to
  `src/`, `plugins/`, `tests/helpers`, and `tests/fixtures`, plus path-enumeration
  assertions (e.g. `docs-presence.test.ts`) and in-body `new URL(...)` references.
  These were updated alongside the moves and verified by running the full suite plus
  `validate` after each phase.

## Integration Notes

- New tests should land in the matching domain directory; shared subprocess/env/path
  setup lives in `tests/helpers/`. The full layout is documented in `tests/AGENTS.md`.
- The generated-output drift guard now lives at
  `tests/tooling/generated-output-sync.test.ts`; the `tests/tooling/no-node-test-runner.test.ts`
  guard still scans the entire test tree.
- No runtime or generated `.mjs` output changed — `build:check` confirms no drift.

## Follow-up Items

- Deferred and promotable on demand: a deeper typed-test-fixture pass for residual
  `as any` test shims, and per-domain Vitest projects / coverage reporting if the
  suite grows enough to justify it.
- One pre-existing Minor review finding (inline sparse env in
  `consensus/refine/sequential-wrapper.test.ts` not using `makeStubEnv`) was
  acknowledged and left as-is — the sparse env is intentional.
