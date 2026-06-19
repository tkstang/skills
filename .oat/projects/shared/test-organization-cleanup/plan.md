---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-06-19
oat_phase: plan
oat_phase_status: complete
oat_plan_hill_phases: ["p03"]
oat_auto_review_at_hill_checkpoints: true
oat_plan_parallel_groups: []
oat_plan_source: quick
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
---

# Implementation Plan: test-organization-cleanup

> Execute this plan using `oat-project-implement` — sequential by default,
> parallel when `oat_plan_parallel_groups` is declared.

**Goal:** Reorganize the Vitest test suite around clear domain boundaries and
shared test helpers without changing runtime behavior or generated output.

**Architecture:** Keep tests as Vitest `.test.ts` suites under `tests/`, but
make directory structure and helpers reflect the repository domains: consensus,
transcript tooling, repo policy, release, and test tooling. Preserve the
existing canonical TypeScript source versus generated shipped `.mjs` entrypoint
testing contract.

**Tech Stack:** Node >=22, TypeScript, Vitest, existing OAT/repo tooling.

**Commit Convention:** `type(scope): description`, using task IDs where useful
for OAT implementation commits.

## Planning Checklist

- [x] Confirmed quick-mode scope with user
- [x] Set `oat_plan_hill_phases` in frontmatter
- [x] Evaluated phases for parallelism opportunities
- [x] Set `oat_plan_parallel_groups` in frontmatter

## Parallelism

This plan is intentionally sequential. The phases touch overlapping test paths
and imports:

- helper extraction changes imports used by many moved suites;
- directory moves change relative imports and fixture paths;
- oversized-suite splits are safest after the final directory shape is known.

Declaring worktree parallelism would create avoidable merge conflicts in the
same test files and helper paths, so `oat_plan_parallel_groups: []`.

## Phase 1: Shared Test Helpers

### Task p01-t01: Inventory repeated setup and define helper boundaries

**Files:**

- Modify: `tests/helpers/process.mjs`
- Create or modify: `tests/helpers/*.ts` as needed

**Steps:**

1. Re-scan test imports and repeated local utilities for subprocess execution,
   JSONL parsing, temp directory creation, fixture-bin PATH setup, repo-root
   path resolution, and generated-entrypoint imports.
2. Decide the smallest helper surface that removes real duplication without
   hiding test intent.
3. Keep helper names domain-neutral unless a helper is clearly consensus- or
   transcript-specific.

**Verification:**

- Run: `pnpm exec vitest run tests/smoke-test-script.test.ts tests/parallel-integration.test.ts`
- Expected: Existing tests still pass before broad adoption.

**Commit:**

```bash
git add tests/helpers
git commit -m "test(p01-t01): define shared test helper boundaries"
```

### Task p01-t02: Adopt helpers in high-duplication consensus tests

**Files:**

- Modify: consensus-related tests currently under `tests/*.test.ts`
- Modify: `tests/helpers/*`

**Steps:**

1. Replace repeated fixture-bin PATH and subprocess helpers with shared helper
   calls in a small representative consensus subset.
2. Preserve current generated `.mjs` entrypoint imports in CLI/integration
   coverage.
3. Avoid assertion rewrites unrelated to helper adoption.

**Verification:**

- Run: `pnpm exec vitest run tests/consensus-loop-cli.test.ts tests/parallel-integration.test.ts tests/sequential-wrapper.test.ts`
- Expected: Targeted consensus CLI/integration tests pass.

**Commit:**

```bash
git add tests
git commit -m "test(p01-t02): adopt shared helpers in consensus tests"
```

### Task p01-t03: Adopt helpers in transcript and repo-tooling tests

**Files:**

- Modify: `tests/session-observer/*.test.ts`
- Modify: `tests/export-session-transcript/*.test.ts`
- Modify: selected repo/tooling tests under `tests/`
- Modify: `tests/helpers/*`

**Steps:**

1. Apply the shared helper surface where it clearly reduces duplication in
   transcript and repo-tooling suites.
2. Leave domain-specific fixture builders local when centralizing them would
   make the test harder to read.
3. Keep session-observer temp-state helpers in their existing subdirectory
   unless they become broadly reusable.

**Verification:**

- Run: `pnpm exec vitest run tests/session-observer tests/export-session-transcript tests/tooling`
- Expected: Targeted transcript/tooling tests pass.

**Commit:**

```bash
git add tests
git commit -m "test(p01-t03): share common transcript and tooling setup"
```

## Phase 2: Domain Directory Organization

### Task p02-t01: Move consensus core/refine/evaluate tests into domain directories

**Files:**

- Move: consensus loop/core tests into `tests/consensus/core/`
- Move: consensus refine/wrapper tests into `tests/consensus/refine/`
- Move: consensus evaluate tests into `tests/consensus/evaluate/`
- Modify: imports and fixture path references affected by moves

**Steps:**

1. Move consensus tests by behavior area rather than by historical PR.
2. Update relative imports to `src/`, `plugins/`, `tests/helpers`, and
   `tests/fixtures`.
3. Keep generated-entrypoint tests visibly separate from canonical-source unit
   tests through filenames or local describe text.
4. Do not move shared fixtures unless the move has a clear readability benefit.

**Verification:**

- Run: `pnpm exec vitest run tests/consensus`
- Expected: All moved consensus tests pass from their new paths.

**Commit:**

```bash
git add tests
git commit -m "test(p02-t01): group consensus tests by domain"
```

### Task p02-t02: Move repo policy, manifest, docs, release, and tooling tests into clear directories

**Files:**

- Move: repo policy/layout tests into `tests/repo/`
- Move: release/versioning tests into `tests/release/`
- Keep or refine: `tests/tooling/`
- Modify: imports and any test path assumptions

**Steps:**

1. Group flat non-consensus tests by what they protect: repo invariants,
   manifests/docs, release checks, and tooling behavior.
2. Update any tests that enumerate `tests/**/*.test.ts` so path changes remain
   expected and policy checks still protect the intended contracts.
3. Keep `tests/tooling/no-node-test-runner.test.ts` in the tooling/policy area
   and confirm it still scans the entire test tree.

**Verification:**

- Run: `pnpm exec vitest run tests/repo tests/release tests/tooling`
- Expected: Repo/release/tooling policy tests pass from their new paths.

**Commit:**

```bash
git add tests
git commit -m "test(p02-t02): group repo and release tests by purpose"
```

### Task p02-t03: Update test guidance for the new structure

**Files:**

- Modify: `tests/AGENTS.md`
- Modify: root `AGENTS.md` only if the test guidance there becomes stale
- Modify: `README.md` or contributor docs only if they mention old test paths

**Steps:**

1. Document the new domain layout and where new tests should land.
2. Preserve existing guidance that all tests are Vitest `.test.ts` and that
   generated shipped `.mjs` entrypoints should remain covered by CLI/integration
   tests.
3. Avoid over-documenting implementation details that are obvious from the
   directory names.

**Verification:**

- Run: `pnpm exec vitest run tests/repo tests/tooling`
- Run: `pnpm run validate`
- Expected: Repo docs/invariant checks pass.

**Commit:**

```bash
git add tests/AGENTS.md AGENTS.md README.md
git commit -m "docs(p02-t03): document test suite layout"
```

## Phase 3: Oversized Suite Splits And Final Guard Checks

### Task p03-t01: Split oversized consensus suites only where it improves navigation

**Files:**

- Modify or split: `tests/consensus/**/*.test.ts`

**Steps:**

1. Review the largest moved consensus suites after Phase 2.
2. Split files only when a split creates clear behavior-level files, such as
   parallel modes, resume behavior, escalation behavior, or CLI behavior.
3. Keep fixtures and helper imports stable; avoid test body rewrites beyond
   the split mechanics.

**Verification:**

- Run: `pnpm exec vitest run tests/consensus`
- Expected: Consensus test suite passes after any splits.

**Commit:**

```bash
git add tests/consensus
git commit -m "test(p03-t01): split oversized consensus suites"
```

### Task p03-t02: Split oversized transcript suites only where low risk

**Files:**

- Modify or split: `tests/session-observer/cli.test.ts`
- Modify or split: `tests/session-observer/watch.test.ts`
- Modify or split: `tests/transcript-core/runtimes.test.ts`

**Steps:**

1. Split by externally meaningful behavior, such as session selection,
   watch-control behavior, watch-loop behavior, runtime record parsing, and
   normalization.
2. Preserve timing-sensitive watcher behavior; do not broaden sleeps or change
   runtime behavior as part of the split.
3. Keep shared fixtures in their current locations unless a move is necessary
   for the new layout.

**Verification:**

- Run: `pnpm exec vitest run tests/session-observer tests/transcript-core`
- Expected: Transcript tests pass after any splits.

**Commit:**

```bash
git add tests/session-observer tests/transcript-core
git commit -m "test(p03-t02): split oversized transcript suites"
```

### Task p03-t03: Run final validation and update project tracking

**Files:**

- Modify: `.oat/projects/shared/test-organization-cleanup/implementation.md`
- Modify: `.oat/projects/shared/test-organization-cleanup/state.md`

**Steps:**

1. Run the full verification set for a test-only organization change.
2. Confirm no generated `.mjs` outputs changed unexpectedly.
3. Confirm the no-node-test-runner guard still passes and still scans moved
   tests.
4. Update implementation tracking with final outcomes and any deferred cleanup.

**Verification:**

- Run: `pnpm run type-check`
- Run: `pnpm run build:check`
- Run: `pnpm run test`
- Run: `pnpm run validate`
- Run: `pnpm run smoke`
- Run: `git diff --check`
- Expected: All pass.

**Commit:**

```bash
git add .oat/projects/shared/test-organization-cleanup
git commit -m "chore(oat): record test organization cleanup"
```

## Reviews

| Scope | Type     | Status  | Artifact | Notes                                      |
| ----- | -------- | ------- | -------- | ------------------------------------------ |
| plan  | artifact | passed  | inline   | Inline artifact review passed 2026-06-19. |
| p01   | code     | passed  | reviews/p01-review-2026-06-18.md | Passed 2026-06-19; 2 Minor, non-blocking. |
| p02   | code     | passed  | reviews/p02-review-2026-06-18.md | Passed 2026-06-19; 1 Minor, resolved. |
| p03   | code     | pending | -        | Review after suite splits and final gate.  |
| final | code     | pending | -        | Final branch review before PR.             |

## Implementation Complete

Plan contains 3 phases and 9 tasks.

- Phase 1: Shared Test Helpers — 3 tasks
- Phase 2: Domain Directory Organization — 3 tasks
- Phase 3: Oversized Suite Splits And Final Guard Checks — 3 tasks

Implementation is complete when all tasks are done, phase reviews pass, final
verification is green, and project tracking reflects the shipped cleanup.

## References

- Discovery: `.oat/projects/shared/test-organization-cleanup/discovery.md`
- Implementation tracker: `.oat/projects/shared/test-organization-cleanup/implementation.md`
- Test guidance: `tests/AGENTS.md`
- Current state: `.oat/repo/reference/current-state.md`
- Roadmap: `.oat/repo/reference/roadmap.md`
