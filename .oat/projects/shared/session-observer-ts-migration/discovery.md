---
oat_status: complete
oat_ready_for: oat-project-quick-start
oat_blockers: []
oat_last_updated: 2026-06-17
oat_generated: false
---

# Discovery: session-observer-ts-migration

## Initial Request

Continue the repo-wide TypeScript/Vitest migration in `tkstang/skills` with the third PR slice: migrate `session-observer` implementation and tests to canonical TypeScript source plus Vitest while preserving the shipped dependency-free `.mjs` skill runtime paths.

The work starts from the current worktree at `/Users/tstang/Code/session-observer-ts`, which is already a new worktree on branch `session-observer-ts`. Live preflight confirmed `HEAD` matches `origin/main` at `f548ebe` (`refactor: migrate transcript runtimes to TypeScript (#15)`), so PR #15 is the base substrate.

## Current Context

- PR #14 landed the TypeScript/Vitest/generated-runtime pattern for consensus-refine.
- PR #15 migrated transcript-core plus export-session-transcript and landed on `main`.
- `src/transcript/core/runtimes.ts` is now the canonical transcript runtime source.
- `skills/session-observer/scripts/lib/runtimes.mjs` is generated output and must not be hand-edited.
- `pnpm run sync:transcript-core` remains as a compatibility wrapper around `scripts/build-generated.mjs`.
- PR #15 included a behavior fix in session-observer watcher logic, so implementation must inspect current `main` rather than assuming older watcher behavior.

## Chosen Direction

Use the existing generated-runtime pattern:

- Move canonical session-observer implementation into TypeScript under `src/transcript/session-observer/`.
- Extend `scripts/build-generated.mjs` with explicit session-observer mappings.
- Keep `bundle: false`, committed generated `.mjs` outputs, `// GENERATED` banners, and `pnpm run build:check` drift protection.
- Use TypeScript-friendly `.js` source import specifiers and rewrite only emitted module specifiers so generated output imports local shipped `.mjs` files.
- Import transcript-core from canonical TypeScript source in session-observer source modules, then rewrite generated output to `./runtimes.mjs`.

This is the right approach because it preserves the shipped no-install skill runtime contract while making TypeScript source and Vitest tests the canonical development surface.

## Target Source Layout

- `src/transcript/session-observer/session-observer.ts`
- `src/transcript/session-observer/probe-local.ts`
- `src/transcript/session-observer/lib/digest.ts`
- `src/transcript/session-observer/lib/locate.ts`
- `src/transcript/session-observer/lib/observe.ts`
- `src/transcript/session-observer/lib/rank.ts`
- `src/transcript/session-observer/lib/session-classifier.ts`
- `src/transcript/session-observer/lib/state.ts`
- `src/transcript/session-observer/lib/watch-state.ts`
- `src/transcript/session-observer/lib/watch.ts`

## Required Generated Output Paths

- `skills/session-observer/scripts/session-observer.mjs`
- `skills/session-observer/scripts/probe-local.mjs`
- `skills/session-observer/scripts/lib/digest.mjs`
- `skills/session-observer/scripts/lib/locate.mjs`
- `skills/session-observer/scripts/lib/observe.mjs`
- `skills/session-observer/scripts/lib/rank.mjs`
- `skills/session-observer/scripts/lib/session-classifier.mjs`
- `skills/session-observer/scripts/lib/state.mjs`
- `skills/session-observer/scripts/lib/watch-state.mjs`
- `skills/session-observer/scripts/lib/watch.mjs`

## Key Decisions

1. **Canonical source:** Session-observer runtime code moves to `src/transcript/session-observer/`; generated `.mjs` files under `skills/session-observer/scripts/` remain committed shipped artifacts.
2. **Generated-output ownership:** `scripts/build-generated.mjs` becomes the build surface for session-observer outputs; generated files with a `// GENERATED` banner are not hand-edited.
3. **Import contract:** Source imports use `.js` specifiers suitable for TypeScript emit. Generated output rewrites only emitted specifiers to local shipped `.mjs` paths.
4. **Transcript-core dependency:** Session-observer source imports canonical transcript-core TypeScript; generated session-observer lib output imports `./runtimes.mjs`.
5. **Test migration:** All `tests/session-observer/*.test.mjs` become Vitest `.test.ts`; no session-observer test should remain on `node:test`.
6. **CLI coverage:** CLI/integration tests continue executing generated shipped `.mjs` entrypoints where that is the behavior being protected.
7. **Watcher discipline:** Preserve current watcher behavior from PR #15 and make timing-sensitive tests more deterministic if needed, without redesigning watch internals.

## Constraints

- Do not migrate `consensus-evaluate`.
- Do not re-migrate transcript-core or export-session-transcript except for minimal type exports needed by session-observer.
- Do not migrate docs/manifest/repo tooling tests.
- Do not remove `test:node`.
- Do not simplify `pnpm test` to Vitest-only; that remains PR4.
- Do not add runtime dependencies to shipped skills.
- Do not hand-edit generated `.mjs` outputs with generated banners.
- Keep shipped session-observer runtime dependency-free and runnable without an install step.

## Success Criteria

- Session-observer canonical implementation lives under `src/transcript/session-observer/`.
- Existing shipped runtime paths under `skills/session-observer/scripts/` are generated from TypeScript and committed.
- All session-observer tests are Vitest `.test.ts`.
- No `tests/session-observer/**/*.test.mjs` files remain.
- Session-observer no longer relies on `node:test`.
- The generated transcript-core copy remains owned by `src/transcript/core/runtimes.ts`.
- `pnpm test` still runs both Node and Vitest runners until PR4.
- Behavior is preserved for locate, rank, digest, observe, state, watch-state, watch, CLI, and probe-local.
- README, AGENTS, session-observer docs, and OAT reference/current-state/backlog notes are updated where they describe canonical source or generated runtime behavior.
- Project summary notes that session-observer source/tests moved to TS/Vitest and what remains for PR4.

## Verification Expectations

Minimum verification:

- `pnpm run build`
- `pnpm run type-check`
- `pnpm run build:check`
- `pnpm run test`
- `pnpm run validate`
- `pnpm run smoke`

Targeted checks during development:

- `pnpm run test:vitest -- tests/session-observer`
- `pnpm run test:node`

## Out of Scope

- Consensus-evaluate migration.
- Export-session/transcript-core migration beyond minimal type exports needed by session-observer.
- Repository-wide test runner simplification.
- Runtime dependency additions.
- Broad watcher redesign.

## Risks

- **Generated import drift:** Incorrect import rewrites could leave shipped `.mjs` files pointing at TypeScript-only paths.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation:** Extend generated-output sync tests and run `pnpm run build:check`.
- **Watcher timing flake:** Existing watcher tests are timing-sensitive and recently changed during PR #15.
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Mitigation:** Inspect current watcher behavior first and prefer deterministic test controls over longer sleeps.
- **Dual source of truth:** Session-observer could accidentally continue importing or editing generated transcript-core runtime copies.
  - **Likelihood:** Low
  - **Impact:** High
  - **Mitigation:** Keep transcript-core canonical source under `src/transcript/core/runtimes.ts` and protect generated copies with drift checks.

## Assumptions

- The current branch `session-observer-ts` is the intended worktree branch for this project.
- PR #15's landed watcher behavior is the behavior to preserve unless tests prove a regression during migration.
- The existing build-generated mapping structure is suitable for adding session-observer without new runtime dependencies.

## Next Steps

Generate an implementation plan for `oat-project-implement` with sequential phases unless the write-set and dependency analysis proves that isolated phase parallelism is safe.
