---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-15
oat_generated: true
oat_summary_last_task: p03-t03
oat_summary_revision_count: 0
oat_summary_includes_revisions: []
---

# Summary: ts-vitest-consensus-loop

## Overview

This quick-mode project established the repository's TypeScript, Vitest, and generated-runtime build pattern, then proved it on the central `consensus-loop` runtime. The goal was not a full test-suite or wrapper migration; it was a durable first slice that keeps shipped skills dependency-free while giving developers canonical TypeScript source and drift-checked committed `.mjs` output.

## What Was Implemented

Phase 1 added developer-only TypeScript and Vitest tooling while preserving the existing `node:test` suite. `pnpm test` now runs both the Node suite and Vitest checks, `pnpm run type-check` runs strict TypeScript checking for TS sources, and package metadata tests lock the intended command composition.

The project added `scripts/build-generated.mjs` as the source-to-committed-runtime build tool. It emits a generated banner, supports write and `--check` modes, and currently maps `plugins/consensus/skills/refine/src/consensus-loop.ts` to the provider-facing `plugins/consensus/skills/refine/scripts/consensus-loop.mjs` path.

`consensus-loop` now has canonical TypeScript source with typed domains for iteration modes, agency, verdicts, synthesis payloads, records/status payloads, escalation routing, and peer invocation boundaries. The generated `.mjs` output remains committed at the same runtime path used by existing wrappers, manifests, docs, and tests.

The validation pipeline now protects the generated-runtime contract in multiple places: Vitest drift guard, `pnpm run build:check`, CI generated-file diff check, and clean-tree assertions in `pnpm run worktree:validate`. CI and local worktree validation both build generated output before checking type, test, validate, and smoke gates.

Documentation and reference artifacts were refreshed to describe the canonical TypeScript source plus committed `.mjs` output contract. `bl-853a` was marked delivered, while `bl-bfb4` remains in progress for the broader wrapper and test-suite migration.

## Key Decisions

- Keep shipped skill runtime dependency-free. TypeScript, Vitest, and esbuild are dev-only tooling; generated `.mjs` output imports only Node standard library modules.
- Build to the existing `consensus-loop.mjs` runtime path instead of changing provider-facing imports. This preserved `consensus-refine.mjs`, parallel section runners, and existing tests.
- Run Vitest alongside `node:test` rather than replacing the Node suite. This avoided coverage loss while introducing Vitest for TS/build-focused tests.
- Use `consensus-loop` as the proof slice instead of `consensus-evaluate`. The loop exercises the highest-value type boundaries and the generated-output contract more directly.
- Keep implementation sequential. All phases touched package scripts, generated output, tests, and consensus runtime paths, so parallel worktrees would have created unnecessary merge risk.

## Design Deltas

- The p02-t03 wrapper compatibility task did not require a runtime fix. Baseline wrapper commands already passed after generated output preserved the existing import/export contract, so the project added characterization tests instead of changing wrapper behavior.
- The first aggregate `worktree:validate` attempts in p03-t03 hit an existing `tests/session-observer/watch.test.mjs` timing flake. The isolated watcher test and final clean-tree `worktree:validate` rerun passed, so the project recorded the caveat without broadening scope into session-observer timing work.

## Notable Challenges

- The p01 review caught a Node runtime floor mismatch in `@types/node`. The project corrected the dev type package to align with the Node 22 runtime requirement and re-reviewed p01 cleanly.
- Generated-output exclusions had to stay synchronized across oxlint, oxfmt, lint-staged, and CI changed-file checks. The project documented that rule in AGENTS guidance so future generated outputs do not fight formatting or linting tools.
- Full-suite test runs exposed transient session-observer timing behavior unrelated to this migration. The project verified the affected test in isolation and reran the clean-tree gate successfully before final review.

## Tradeoffs Made

- The project accepted committed generated output as part of the repository contract. That creates one more artifact to keep in sync, but it preserves no-install shipped skill execution and gives CI/worktree gates a concrete drift check.
- The initial TypeScript configuration remains focused on TS sources rather than forcing legacy `.mjs` into type-checking. This keeps the migration incremental and avoids turning the proof slice into a repo-wide JS cleanup project.

## Integration Notes

- Edit `plugins/consensus/skills/refine/src/consensus-loop.ts`, then run `pnpm run build` to regenerate `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`.
- Use `pnpm run build:check` or `tests/generated-output-sync.test.mjs` to verify generated output is in sync.
- Do not hand-edit generated `.mjs` outputs with the generated banner.
- Generated runtime output must remain excluded from oxlint, oxfmt, lint-staged, and CI changed-file formatting/lint checks.

## Follow-up Items

- Implement `consensus-evaluate` as a follow-on family-skill project using the new TypeScript/Vitest/generated-runtime pattern.
- Continue `bl-bfb4` beyond this slice by migrating the refine wrapper and existing tests where the type/value boundary is worth tightening.
- Revisit `allowJs` tightening only after more runtime surfaces have canonical TypeScript sources.

## Associated Issues

- `bl-853a`: delivered. The TypeScript/Vitest/build toolchain and generated-runtime contract are in place.
- `bl-bfb4`: partially delivered. `consensus-loop` now has canonical TypeScript source, but the broader wrapper/test migration remains open.
