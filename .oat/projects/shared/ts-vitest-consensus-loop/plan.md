---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-06-15
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

# Implementation Plan: ts-vitest-consensus-loop

> Execute this plan using `oat-project-implement`.

**Goal:** Stand up TypeScript, Vitest, and generated-runtime build patterns, then migrate `consensus-loop` to canonical TypeScript source that builds back to the existing shipped `.mjs` path.

**Architecture:** Canonical TypeScript source lives beside the consensus refine skill and builds to committed generated `.mjs` output under `plugins/consensus/skills/refine/scripts/`. Existing runtime callers keep importing/executing the generated `.mjs` path.

**Tech Stack:** Node >=22, ESM, pnpm, TypeScript, Vitest, esbuild or equivalent bundler, existing oxlint/oxfmt tooling.

**Commit Convention:** `{type}({scope}): {description}` - e.g., `build(p01-t01): add typescript and vitest tooling`.

## Planning Checklist

- [x] Confirmed HiLL checkpoints with user (quick mode; no phase pauses requested)
- [x] Set `oat_plan_hill_phases` in frontmatter
- [x] Evaluated phases for parallelism opportunities
- [x] Set `oat_plan_parallel_groups` in frontmatter

---

## Parallelism

This plan is intentionally sequential. The phases all touch the same fragile boundary: package scripts, generated-runtime build rules, generated consensus output, and tests that import the generated loop path. Running phases in parallel would create merge conflicts and could let one worktree verify against stale generated output.

`oat_plan_parallel_groups: []` is therefore the correct execution shape.

## Dispatch Profile

Project dispatch ceiling is set to the maximum preset: Codex `xhigh`, Claude `opus`.

Do not force every implementation phase to the maximum tier by default. Runtime dispatch should select the lowest appropriate effort/model for each phase, capped by this ceiling. Reviews run at the configured ceiling.

---

## Phase 1: Toolchain and Generated Runtime Contract

### Task p01-t01: Add TypeScript and Vitest Tooling

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `tsconfig.json`
- Create: `vitest.config.mjs`
- Create: `scripts/run-vitest.mjs`

**Step 1: Write test (RED)**

Add a minimal Vitest configuration check or sample test under `tests/tooling/` that fails until Vitest is installed and runnable.

Run: `pnpm exec vitest run tests/tooling/*.test.*`
Expected: Command fails because Vitest/tooling is not wired yet.

**Step 2: Implement (GREEN)**

Add dev-only TypeScript and Vitest tooling. Add scripts that preserve existing coverage while introducing the new runner:

- `test:node` for the current `node --test` suite
- `test:vitest` for Vitest checks
- `test` to run both
- `type-check` for TypeScript

Prefer a small `scripts/run-vitest.mjs` wrapper if pnpm argument forwarding needs normalization, following the Stoa reference pattern.

Run: `pnpm test`
Expected: Existing Node tests and the new Vitest check both pass.

**Step 3: Refactor**

Keep TS config strict for `.ts` sources while allowing legacy `.mjs` to remain in place. Do not require the existing JS suite to become check-clean in this task.

**Step 4: Verify**

Run: `pnpm run type-check && pnpm test`
Expected: No errors.

**Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json vitest.config.mjs scripts/run-vitest.mjs tests/tooling
git commit -m "build(p01-t01): add typescript and vitest tooling"
```

---

### Task p01-t02: Add Generated-Output Build and Drift Guard

**Files:**

- Modify: `package.json`
- Create: `scripts/build-generated.mjs`
- Create: `tests/generated-output-sync.test.mjs`
- Modify: `.oxfmtrc.json`
- Modify: `.oxlintrc.json`
- Modify: `.lintstagedrc.mjs`
- Modify: `.github/workflows/validate.yml`

**Step 1: Write test (RED)**

Add a drift-guard test that invokes the generated-output build in check mode and fails when the committed generated output does not match canonical source.

Run: `pnpm exec vitest run tests/generated-output-sync.test.mjs`
Expected: Test fails until the build script and generated-output mapping exist.

**Step 2: Implement (GREEN)**

Add a generated-output build script with explicit source/output mappings. It must support:

- normal write mode
- `--check` mode that builds to a temporary location or in-memory result and reports diffs without mutating tracked files
- a generated banner on emitted `.mjs`
- no runtime dependencies in shipped skill code

Update lint/format exclusions so generated consensus output is not rewritten by oxlint, oxfmt, lint-staged, or CI changed-file checks.

Run: `pnpm exec vitest run tests/generated-output-sync.test.mjs`
Expected: Drift guard passes.

**Step 3: Refactor**

Keep the mapping generic enough to add future generated outputs without hard-coding logic into tests.

**Step 4: Verify**

Run: `pnpm test && pnpm run validate`
Expected: No errors.

**Step 5: Commit**

```bash
git add package.json scripts/build-generated.mjs tests/generated-output-sync.test.mjs .oxfmtrc.json .oxlintrc.json .lintstagedrc.mjs .github/workflows/validate.yml
git commit -m "build(p01-t02): add generated output drift guard"
```

---

### Task p01-t03: Record the Build Boundary Decision

**Files:**

- Modify: `.oat/repo/reference/decision-record.md`
- Modify: `AGENTS.md`
- Modify: `plugins/consensus/AGENTS.md`
- Modify: `tests/AGENTS.md`
- Modify: `README.md`

**Step 1: Write test (RED)**

Add or update docs-presence assertions that require the new source/edit boundary to be documented.

Run: `node --test tests/docs-presence.test.mjs`
Expected: Test fails until docs mention the generated-output contract.

**Step 2: Implement (GREEN)**

Document the durable contract:

- canonical TS source is edited
- generated `.mjs` output is committed and shipped
- generated output is not hand-edited
- drift guard catches source/output mismatches
- existing users still run plain `.mjs` with no install step

Record a short decision record for this contract.

Run: `node --test tests/docs-presence.test.mjs`
Expected: Test passes.

**Step 3: Refactor**

Keep docs scoped to the build contract; do not rewrite unrelated provider or release notes.

**Step 4: Verify**

Run: `pnpm test && pnpm run validate`
Expected: No errors.

**Step 5: Commit**

```bash
git add .oat/repo/reference/decision-record.md AGENTS.md plugins/consensus/AGENTS.md tests/AGENTS.md README.md tests/docs-presence.test.mjs
git commit -m "docs(p01-t03): document generated typescript source contract"
```

---

## Phase 2: Migrate `consensus-loop` to TypeScript Source

### Task p02-t01: Introduce Canonical TypeScript Source for the Loop

**Files:**

- Create: `plugins/consensus/skills/refine/src/consensus-loop.ts`
- Modify: `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`
- Modify: `scripts/build-generated.mjs`
- Modify: `tests/generated-output-sync.test.mjs`

**Step 1: Write test (RED)**

Extend the drift guard to require a source mapping from `src/consensus-loop.ts` to `scripts/consensus-loop.mjs`.

Run: `pnpm exec vitest run tests/generated-output-sync.test.mjs`
Expected: Test fails until the TypeScript source and generated output exist.

**Step 2: Implement (GREEN)**

Create the TypeScript source for `consensus-loop` and configure the build script to emit the generated `.mjs` file at the existing runtime path. Preserve:

- exported names used by tests and `consensus-refine.mjs`
- direct CLI execution behavior
- Node ESM runtime semantics
- existing schema paths and relative file behavior

Run: `pnpm run build && pnpm exec vitest run tests/generated-output-sync.test.mjs`
Expected: Build succeeds and drift guard passes.

**Step 3: Refactor**

Keep this first conversion behavior-preserving. Use `unknown`/narrowing where appropriate, but avoid broad logic changes while establishing source/output parity.

**Step 4: Verify**

Run: `node --test tests/consensus-loop-cli.test.mjs tests/verdict-validation.test.mjs tests/loop-records.test.mjs tests/paseo-invocation.test.mjs`
Expected: Loop-focused tests pass.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/refine/src/consensus-loop.ts plugins/consensus/skills/refine/scripts/consensus-loop.mjs scripts/build-generated.mjs tests/generated-output-sync.test.mjs
git commit -m "refactor(p02-t01): generate consensus loop from typescript"
```

---

### Task p02-t02: Add Useful Domain Types to the Loop

**Files:**

- Modify: `plugins/consensus/skills/refine/src/consensus-loop.ts`
- Modify: `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`

**Step 1: Write test (RED)**

Add type-level coverage where practical, or add runtime tests that lock behavior around typed domains before tightening implementation:

- verdict branch vocabulary
- synthesis shape and caps
- loop record metadata
- escalation route results

Run: `pnpm run type-check`
Expected: Type-check or targeted tests fail until the domain types are introduced.

**Step 2: Implement (GREEN)**

Introduce discriminated unions and typed interfaces for the highest-value domains:

- iteration mode and agency
- alternating and parallel verdicts
- synthesis payloads
- records and status payloads
- escalation triggers/routes
- peer invocation result boundaries

Keep runtime validation intact; types complement validation, they do not replace it.

Run: `pnpm run type-check && pnpm run build`
Expected: Type-check and build pass.

**Step 3: Refactor**

Remove avoidable `any` from the migrated loop source. Where external JSON remains genuinely untrusted, use `unknown` plus explicit narrowing.

**Step 4: Verify**

Run: `node --test tests/verdict-validation.test.mjs tests/escalation.test.mjs tests/loop-convergence.test.mjs tests/resume-parse.test.mjs`
Expected: Tests pass.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/refine/src/consensus-loop.ts plugins/consensus/skills/refine/scripts/consensus-loop.mjs
git commit -m "refactor(p02-t02): type consensus loop domain models"
```

---

### Task p02-t03: Prove Wrapper Compatibility Against Generated Output

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-refine.mjs` only if a minimal import/path adjustment is required
- Modify: `tests/parallel-modes.test.mjs`
- Modify: `tests/sequential-wrapper.test.mjs`
- Modify: `tests/parallel-integration.test.mjs`

**Step 1: Write test (RED)**

Add or adjust targeted wrapper tests to assert that `consensus-refine.mjs` continues consuming the generated `./consensus-loop.mjs` runtime path.

Run: `node --test tests/sequential-wrapper.test.mjs tests/parallel-modes.test.mjs tests/parallel-integration.test.mjs`
Expected: Tests expose any path/export mismatch from the generated output.

**Step 2: Implement (GREEN)**

Fix only compatibility issues caused by the migration. Do not migrate the wrapper to TypeScript in this project.

Run: `node --test tests/sequential-wrapper.test.mjs tests/parallel-modes.test.mjs tests/parallel-integration.test.mjs`
Expected: Tests pass.

**Step 3: Refactor**

Keep wrapper changes minimal. If no wrapper changes are needed, document that the generated output preserved the existing import contract.

**Step 4: Verify**

Run: `pnpm test && pnpm run smoke`
Expected: No errors.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/refine/scripts/consensus-refine.mjs tests/parallel-modes.test.mjs tests/sequential-wrapper.test.mjs tests/parallel-integration.test.mjs
git commit -m "test(p02-t03): verify refine wrapper uses generated loop"
```

---

## Phase 3: CI, Documentation, and Final Validation

### Task p03-t01: Wire CI and Worktree Validation to the New Build

**Files:**

- Modify: `.github/workflows/validate.yml`
- Modify: `scripts/worktree/validate.sh`
- Modify: `package.json`

**Step 1: Write test (RED)**

Add a validation-script assertion, if needed, that the build/type-check path is included in pre-merge verification.

Run: `node --test tests/validate-script.test.mjs`
Expected: Test fails until validation includes the build/type-check path.

**Step 2: Implement (GREEN)**

Ensure CI and local worktree validation run the necessary commands:

- install with frozen lockfile
- build generated outputs
- type-check
- test
- validate
- smoke
- assert clean generated output afterward

Run: `node --test tests/validate-script.test.mjs`
Expected: Test passes.

**Step 3: Refactor**

Keep command order explicit enough that generated-output drift is caught before merge.

**Step 4: Verify**

Run: `pnpm run worktree:validate`
Expected: Full validation passes and the working tree remains clean.

**Step 5: Commit**

```bash
git add .github/workflows/validate.yml scripts/worktree/validate.sh package.json tests/validate-script.test.mjs
git commit -m "ci(p03-t01): validate generated typescript outputs"
```

---

### Task p03-t02: Refresh Backlog and Project References

**Files:**

- Modify: `.oat/repo/reference/backlog/items/adopt-typescript-vitest-build-toolchain.md`
- Modify: `.oat/repo/reference/backlog/items/migrate-consensus-tests-to-typescript-types.md`
- Modify: `.oat/repo/reference/backlog/index.md`
- Modify: `.oat/repo/reference/current-state.md`
- Modify: `.oat/repo/reference/roadmap.md`

**Step 1: Write test (RED)**

Use existing docs/reference tests or add a focused assertion if the repo has one for backlog references.

Run: `pnpm run validate`
Expected: Validation should identify any stale references introduced by the migration; if it does not, proceed with manual reference checks.

**Step 2: Implement (GREEN)**

Update references to show:

- `bl-853a` delivered the toolchain and generated-output contract
- `bl-bfb4` has one completed slice, not the full migration
- `consensus-evaluate` remains a follow-on project

Do not mark the whole TypeScript migration initiative complete.

Run: `pnpm run validate`
Expected: No errors.

**Step 3: Refactor**

Keep roadmap changes minimal and factual; do not re-prioritize unrelated backlog items.

**Step 4: Verify**

Run: `pnpm test && pnpm run validate`
Expected: No errors.

**Step 5: Commit**

```bash
git add .oat/repo/reference/backlog/items/adopt-typescript-vitest-build-toolchain.md .oat/repo/reference/backlog/items/migrate-consensus-tests-to-typescript-types.md .oat/repo/reference/backlog/index.md .oat/repo/reference/current-state.md .oat/repo/reference/roadmap.md
git commit -m "docs(p03-t02): refresh typescript migration references"
```

---

### Task p03-t03: Final Full Verification and Handoff

**Files:**

- Modify: `.oat/projects/shared/ts-vitest-consensus-loop/implementation.md`
- Modify: `.oat/projects/shared/ts-vitest-consensus-loop/state.md`
- Modify: `.oat/projects/shared/ts-vitest-consensus-loop/plan.md`

**Step 1: Write test (RED)**

No new product test is required. This task is the final validation boundary.

**Step 2: Implement (GREEN)**

Run the full pre-merge verification and update OAT implementation tracking with actual outcomes.

Run: `pnpm run worktree:validate`
Expected: Full validation passes and generated output is clean.

**Step 3: Refactor**

If validation reveals generated drift or docs mismatch, fix it in the owning source/config and rerun validation.

**Step 4: Verify**

Run: `git status --short`
Expected: Only intended OAT lifecycle updates remain before the final commit, or the tree is clean after committing.

**Step 5: Commit**

```bash
git add .oat/projects/shared/ts-vitest-consensus-loop/implementation.md .oat/projects/shared/ts-vitest-consensus-loop/state.md .oat/projects/shared/ts-vitest-consensus-loop/plan.md
git commit -m "chore(p03-t03): record typescript loop migration completion"
```

---

## Reviews

| Scope  | Type     | Status  | Date       | Artifact                                |
| ------ | -------- | ------- | ---------- | --------------------------------------- |
| p01    | code     | passed  | 2026-06-15 | reviews/p01-review-2026-06-15-r2.md     |
| p02    | code     | passed  | 2026-06-15 | reviews/p02-review-2026-06-15.md        |
| p03    | code     | pending | -          | -                                       |
| final  | code     | pending | -          | -                                       |
| spec   | artifact | pending | -          | N/A quick mode                          |
| design | artifact | pending | -          | N/A quick mode                          |
| plan   | artifact | passed  | 2026-06-15 | inline quick-start review               |

**Status values:** `pending` -> `received` -> `fixes_added` -> `fixes_completed` -> `passed`

## Implementation Complete

**Summary:**

- Phase 1: 3 tasks - Establish TS/Vitest tooling, generated-output drift guard, and documented build boundary.
- Phase 2: 3 tasks - Migrate `consensus-loop` to TypeScript source while preserving generated `.mjs` runtime compatibility.
- Phase 3: 3 tasks - Wire CI/local validation, refresh references, and complete final verification.

**Total: 9 tasks**

Ready for implementation.

## References

- Discovery: `discovery.md`
- Backlog: `.oat/repo/reference/backlog/items/adopt-typescript-vitest-build-toolchain.md` (`bl-853a`)
- Backlog: `.oat/repo/reference/backlog/items/migrate-consensus-tests-to-typescript-types.md` (`bl-bfb4`, partial slice only)
- Existing generated-copy precedent: `scripts/sync-transcript-core.mjs`
