---
oat_status: complete
oat_ready_for: oat-project-quick-start
oat_blockers: []
oat_last_updated: 2026-06-19
oat_generated: false
---

# Discovery: test-organization-cleanup

## Initial Request

After orienting on the recently shipped TypeScript/Vitest and repository tooling
projects, the user observed that there is follow-up cleanup available in the
test suite, specifically around organization. The release verification work
should happen in a separate PR; this project should quick-start the local test
organization cleanup in the current checkout.

## Request Classification

Well-understood. The runner migration is complete, so this project is not a
behavioral migration or another test-runner conversion. It is a focused
maintainability cleanup of the already-Vitest test tree.

## Context

- PR4 completed the migration to Vitest-only tests: all suites are `.test.ts`,
  use `expect`, `pnpm test` runs Vitest only, and
  `tests/tooling/no-node-test-runner.test.ts` guards against legacy
  `node:test`/`node:assert`/`.test.mjs` regressions.
- Current roadmap says TypeScript/Vitest migration work is delivered; v0.1
  release verification is the main release lane, but this cleanup is small
  enough to execute separately while already in this checkout.
- The test tree still reflects migration history more than domain boundaries:
  most consensus, repo, manifest, release, and tooling tests sit directly under
  `tests/`, while some domains already have subdirectories.
- Existing test guidance requires preserving the distinction between canonical
  TypeScript source tests and generated shipped `.mjs` entrypoint coverage.

## Current Observations

- `tests/` contains 53 Vitest suites; 39 are directly under the root test
  directory.
- Domain directories already exist for `session-observer`,
  `export-session-transcript`, `transcript-core`, and `tooling`, but consensus
  tests remain mostly flat.
- Several large files act like directories in practice, including:
  - `tests/session-observer/watch.test.ts`
  - `tests/session-observer/cli.test.ts`
  - `tests/parallel-modes.test.ts`
  - `tests/transcript-core/runtimes.test.ts`
- `tests/helpers/process.mjs` exists, but temp directory setup, fixture-bin PATH
  setup, subprocess calls, JSONL parsing, and generated-entrypoint import
  comments are still repeated across suites.

## Key Decisions

1. **Project scope:** Treat this as post-migration maintainability cleanup, not
   more runner migration.
2. **Primary cleanup direction:** Organize test files around product/domain
   boundaries and shared test utilities, while preserving coverage and behavior.
3. **Generated-runtime contract:** Keep CLI/integration tests pointed at
   generated shipped `.mjs` entrypoints where installed-skill behavior is being
   protected; use canonical TypeScript imports for unit behavior where
   appropriate.
4. **Risk control:** Prefer mechanical moves and helper extraction first; only
   split oversized suites where the split improves navigation without changing
   assertions.
5. **Release lane separation:** Release verification should run in a separate
   PR/worktree and should not be mixed into this cleanup project.

## Constraints

- No runtime behavior changes.
- No shipped plugin or skill dependency changes.
- No hand edits to generated `.mjs` files.
- Keep every suite Vitest-first and compatible with the existing
  `tests/tooling/no-node-test-runner.test.ts` guard.
- Preserve the current source-vs-shipped-runtime testing rule from
  `tests/AGENTS.md`.
- Keep the cleanup reviewable; avoid a broad rewrite of test assertions or
  fixture semantics.

## Success Criteria

- Test files are grouped by clear domains such as consensus core/refine/evaluate,
  transcript tooling, repo policy, release, and tooling.
- Common test setup for temp dirs, fixture paths, fixture-bin PATH, subprocess
  execution, and JSONL parsing is centralized where it reduces duplication.
- Any split of large suites is behavior-preserving and makes the suite easier
  to navigate.
- `pnpm run test`, `pnpm run type-check`, `pnpm run build:check`, and relevant
  targeted Vitest runs pass.
- `git diff --check` passes.
- The generated-runtime contract remains intact.

## Out of Scope

- v0.1 release verification.
- New product behavior or coverage unrelated to test organization.
- Further TypeScript/Vitest migration work.
- Removal of all local `as any` test shims unless directly touched by a helper
  extraction and low risk.
- Generated runtime or build-system redesign.

## Deferred Ideas

- A deeper typed-test-fixture pass for residual test shims.
- Future per-domain Vitest projects or coverage reporting, if the suite grows
  enough to justify it.

## Open Questions

- None blocking. Exact file grouping can be refined during implementation based
  on the final import graph.

## Assumptions

- The current flat test layout is the main maintainability issue; test behavior
  and runner contracts are already sound.
- Directory moves will require updating relative imports and possibly path
  assumptions in meta-tests, but should not require source changes.
