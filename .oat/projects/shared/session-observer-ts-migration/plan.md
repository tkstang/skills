---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-06-17
oat_phase: plan
oat_phase_status: complete
oat_plan_hill_phases: ["p04"]
oat_auto_review_at_hill_checkpoints: true
oat_plan_parallel_groups: []
oat_plan_source: quick
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
---

# Implementation Plan: session-observer-ts-migration

> Execute this plan using `oat-project-implement`.

**Goal:** Move session-observer runtime source and tests to canonical TypeScript/Vitest while preserving the shipped dependency-free `.mjs` skill runtime paths.

**Architecture:** TypeScript source under `src/transcript/session-observer/` is the only edited implementation surface. `scripts/build-generated.mjs` emits committed generated `.mjs` files under `skills/session-observer/scripts/` with import rewrites to local shipped `.mjs` files.

**Tech Stack:** Node >=22 ESM, TypeScript, Vitest, esbuild generated-output build, existing OAT validation.

**Commit Convention:** `{type}({scope}): {description}` - e.g. `refactor(p01): migrate session-observer runtime source`

## Planning Checklist

- [x] Confirmed quick-mode scope from discovery
- [x] Set `oat_plan_hill_phases` in frontmatter
- [x] Evaluated phases for parallelism opportunities
- [x] Set `oat_plan_parallel_groups` in frontmatter
- [x] Resolved dispatch ceiling in project state

---

## Parallelism

No parallel groups are declared. Although docs and tests look separable at first glance, the session-observer source migration, generated-output mappings, generated `.mjs` artifacts, and test import targets all share the same fragile runtime boundary. Running phases in isolated worktrees would increase merge conflicts and drift risk around `scripts/build-generated.mjs`, generated output paths, and watcher behavior. Keep this PR sequential.

---

## Phase 1: Canonical Session-Observer Runtime Source

Migrate session-observer implementation into TypeScript and wire generated output paths without changing shipped behavior.

### Task p01-t01: Lift Session-Observer Modules To TypeScript Source

**Files:**

- Create: `src/transcript/session-observer/session-observer.ts`
- Create: `src/transcript/session-observer/probe-local.ts`
- Create: `src/transcript/session-observer/lib/digest.ts`
- Create: `src/transcript/session-observer/lib/locate.ts`
- Create: `src/transcript/session-observer/lib/observe.ts`
- Create: `src/transcript/session-observer/lib/rank.ts`
- Create: `src/transcript/session-observer/lib/session-classifier.ts`
- Create: `src/transcript/session-observer/lib/state.ts`
- Create: `src/transcript/session-observer/lib/watch-state.ts`
- Create: `src/transcript/session-observer/lib/watch.ts`
- Modify as needed: `src/transcript/core/runtimes.ts` for minimal exported types only

**Step 1: Port current behavior from generated-shipped source**

Use the current landed `skills/session-observer/scripts/**/*.mjs` files as behavior source, including the PR #15 watcher behavior. Do not hand-edit generated files with a `// GENERATED` banner.

**Step 2: Use TypeScript-friendly module specifiers**

Use `.js` specifiers in source imports. Session-observer modules that need transcript-core should import from canonical `src/transcript/core/runtimes.ts` via a `.js` specifier.

**Step 3: Type core boundaries**

Add practical types for CLI options, locate/rank candidates, digest entries, observe results, watch options/state, state file structures, and transcript-core interactions. Avoid broad rewrites that alter runtime behavior.

**Step 4: Verify**

Run: `pnpm run type-check`

Expected: TypeScript source compiles without weakening `tsconfig`.

**Step 5: Commit**

```bash
git add src/transcript/session-observer src/transcript/core/runtimes.ts
git commit -m "refactor(p01): add session-observer TypeScript source"
```

---

### Task p01-t02: Generate Shipped Session-Observer Runtime Outputs

**Files:**

- Modify: `scripts/build-generated.mjs`
- Modify: `tests/generated-output-sync.test.mjs`
- Modify: `.oxfmtrc.json`
- Modify: `.oxlintrc.json`
- Generated: `skills/session-observer/scripts/session-observer.mjs`
- Generated: `skills/session-observer/scripts/probe-local.mjs`
- Generated: `skills/session-observer/scripts/lib/digest.mjs`
- Generated: `skills/session-observer/scripts/lib/locate.mjs`
- Generated: `skills/session-observer/scripts/lib/observe.mjs`
- Generated: `skills/session-observer/scripts/lib/rank.mjs`
- Generated: `skills/session-observer/scripts/lib/session-classifier.mjs`
- Generated: `skills/session-observer/scripts/lib/state.mjs`
- Generated: `skills/session-observer/scripts/lib/watch-state.mjs`
- Generated: `skills/session-observer/scripts/lib/watch.mjs`

**Step 1: Extend generated-output mappings**

Add mappings for every session-observer source file. Preserve `bundle: false`, generated banners, and committed `.mjs` outputs. Use import rewrites only for emitted module specifiers.

Important rewrites:

- CLI/probe imports from `./lib/*.js` become `./lib/*.mjs`.
- Lib-to-lib imports become sibling `.mjs` imports.
- Transcript-core source imports become `./runtimes.mjs` in generated lib output.

**Step 2: Extend drift/guard coverage**

Update generated-output tests so session-observer mappings are listed, drift-checked, and excluded from lint/format guard paths via the existing derived `generatedOutputs` mechanism.

**Step 3: Build generated outputs**

Run: `pnpm run build`

Expected: all session-observer generated paths are rewritten from canonical TypeScript and carry `// GENERATED` banners.

**Step 4: Verify**

Run:

```bash
pnpm run build:check
pnpm run sync:transcript-core --check
pnpm exec vitest run tests/generated-output-sync.test.mjs
node skills/session-observer/scripts/session-observer.mjs --help
set +e; node skills/session-observer/scripts/probe-local.mjs --runtime codex --cwd "$PWD"; code=$?; set -e; test "$code" -eq 0 -o "$code" -eq 2 -o "$code" -eq 3
```

Expected: generated output is in sync; the compatibility wrapper still delegates to the same generated-output check; entrypoints execute from shipped `.mjs` paths. `probe-local` may return a documented non-hard-error code when no local transcript candidate exists.

**Step 5: Commit**

```bash
git add scripts/build-generated.mjs tests/generated-output-sync.test.mjs .oxfmtrc.json .oxlintrc.json skills/session-observer/scripts
git commit -m "build(p01): generate session-observer runtime outputs from TypeScript"
```

---

### Task p01-t03: Confirm Behavior Parity Before Test Migration

**Files:**

- Modify if needed: `src/transcript/session-observer/**/*.ts`
- Modify if needed: `skills/session-observer/scripts/**/*.mjs`

**Step 1: Run existing session-observer Node tests against generated outputs**

Run: `node --test tests/session-observer/*.test.mjs`

Expected: existing tests pass against the generated `.mjs` implementation before converting test runners.

**Step 2: Fix only migration regressions**

If parity fails, fix canonical TypeScript source and regenerate output with `pnpm run build`. Do not preserve old behavior if current PR #15 behavior already corrected it.

**Step 3: Verify**

Run:

```bash
node --test tests/session-observer/*.test.mjs
pnpm run build:check
pnpm run type-check
```

Expected: session-observer behavior matches current main and generated output stays clean.

**Step 4: Commit**

```bash
git add src/transcript/session-observer skills/session-observer/scripts
git commit -m "fix(p01): preserve session-observer behavior after source migration"
```

If no fixes are needed, record the verification in `implementation.md` and skip this commit.

---

## Phase 2: Vitest Migration For Session-Observer Tests

Move all session-observer tests from `node:test` `.mjs` files to Vitest TypeScript while preserving coverage and generated-entrypoint integration checks.

### Task p02-t01: Migrate Unit Test Helpers And Library Tests

**Files:**

- Rename/modify: `tests/session-observer/helpers/tmpdir.mjs` to `tests/session-observer/helpers/tmpdir.ts` if still needed
- Rename/modify: `tests/session-observer/digest.test.mjs` to `tests/session-observer/digest.test.ts`
- Rename/modify: `tests/session-observer/locate.test.mjs` to `tests/session-observer/locate.test.ts`
- Rename/modify: `tests/session-observer/observe.test.mjs` to `tests/session-observer/observe.test.ts`
- Rename/modify: `tests/session-observer/rank.test.mjs` to `tests/session-observer/rank.test.ts`
- Rename/modify: `tests/session-observer/state.test.mjs` to `tests/session-observer/state.test.ts`
- Rename/modify: `tests/session-observer/watch-state.test.mjs` to `tests/session-observer/watch-state.test.ts`

**Step 1: Convert assertions and lifecycle hooks**

Replace `node:test` imports with Vitest APIs. Keep fixtures unchanged.

**Step 2: Prefer canonical TypeScript source for unit tests**

Where the test is exercising a library function rather than shipped CLI execution, import from `src/transcript/session-observer/**/*.js` to get type coverage. Keep generated `.mjs` imports only where the shipped artifact itself is the behavior under test.

**Step 3: Verify**

Run:

```bash
pnpm run test:vitest -- tests/session-observer/digest.test.ts tests/session-observer/locate.test.ts tests/session-observer/observe.test.ts tests/session-observer/rank.test.ts tests/session-observer/state.test.ts tests/session-observer/watch-state.test.ts
pnpm run type-check
```

Expected: converted unit tests pass under Vitest and compile as TypeScript.

**Step 4: Commit**

```bash
git add tests/session-observer src/transcript/session-observer
git commit -m "test(p02): migrate session-observer library tests to Vitest"
```

---

### Task p02-t02: Migrate CLI And Integration Tests

**Files:**

- Rename/modify: `tests/session-observer/cli.test.mjs` to `tests/session-observer/cli.test.ts`
- Rename/modify: `tests/session-observer/integration.test.mjs` to `tests/session-observer/integration.test.ts`

**Step 1: Convert to Vitest TypeScript**

Use Vitest lifecycle and assertion APIs while keeping process-spawn helpers deterministic.

**Step 2: Keep shipped entrypoint coverage**

Continue invoking:

- `skills/session-observer/scripts/session-observer.mjs`
- `skills/session-observer/scripts/probe-local.mjs`

These tests must prove the installed skill paths remain runnable after generation.

**Step 3: Verify**

Run:

```bash
pnpm run test:vitest -- tests/session-observer/cli.test.ts tests/session-observer/integration.test.ts
node skills/session-observer/scripts/session-observer.mjs --help
set +e; node skills/session-observer/scripts/probe-local.mjs --runtime codex --cwd "$PWD"; code=$?; set -e; test "$code" -eq 0 -o "$code" -eq 2 -o "$code" -eq 3
```

Expected: CLI/integration coverage passes against generated shipped entrypoints.

**Step 4: Commit**

```bash
git add tests/session-observer
git commit -m "test(p02): migrate session-observer CLI tests to Vitest"
```

---

### Task p02-t03: Migrate Watcher Tests Deterministically

**Files:**

- Rename/modify: `tests/session-observer/watch.test.mjs` to `tests/session-observer/watch.test.ts`
- Modify if needed: `src/transcript/session-observer/lib/watch.ts`
- Modify if needed: `src/transcript/session-observer/lib/watch-state.ts`
- Generated if source changes: `skills/session-observer/scripts/lib/watch.mjs`
- Generated if source changes: `skills/session-observer/scripts/lib/watch-state.mjs`

**Step 1: Convert watcher tests to Vitest**

Preserve test coverage for debounce emission, runtime `both`, watch controls, event-log path hardening, pause/resume/flush/stop, stale state, and max-runtime behavior.

**Step 2: Reduce timing flake without redesigning watch internals**

If flakiness appears, prefer deterministic controls such as tighter test-local polling/debounce values, explicit process output synchronization, state/event-log observation, or test helper extraction. Avoid broad watcher redesign and avoid simply increasing sleeps/timeouts.

**Step 3: Verify repeatedly**

Run:

```bash
pnpm run test:vitest -- tests/session-observer/watch.test.ts
pnpm run test:vitest -- tests/session-observer/watch.test.ts
pnpm run test:vitest -- tests/session-observer/watch.test.ts
pnpm run build:check
```

Expected: watcher test is stable under repeated focused runs and generated output remains synced.

**Step 4: Commit**

```bash
git add tests/session-observer/watch.test.ts src/transcript/session-observer/lib/watch.ts src/transcript/session-observer/lib/watch-state.ts skills/session-observer/scripts/lib/watch.mjs skills/session-observer/scripts/lib/watch-state.mjs
git commit -m "test(p02): migrate session-observer watcher tests to Vitest"
```

---

### Task p02-t04: Remove Session-Observer Node-Test Residue

**Files:**

- Delete: remaining `tests/session-observer/**/*.test.mjs`
- Modify if needed: `tests/session-observer/**/*.test.ts`
- Do not modify `package.json` test scripts; the `test:node` / `test:vitest` mixed-runner contract must remain intact. Only touch `package.json` if a session-observer-specific issue genuinely requires it, and justify the change.

**Step 1: Confirm no session-observer `.test.mjs` remains**

Run: `find tests/session-observer -name '*.test.mjs' -type f`

Expected: no output.

**Step 2: Preserve mixed runner contract**

Do not remove `test:node`. Do not simplify `pnpm test` to Vitest-only. That remains PR4.

**Step 3: Verify both runners**

Run:

```bash
pnpm run test:vitest -- tests/session-observer
pnpm run test:node
pnpm run test
```

Expected: session-observer runs under Vitest, remaining Node suites still pass under `test:node`, and `pnpm test` still invokes both runners.

**Step 4: Commit**

```bash
git add tests/session-observer
git commit -m "test(p02): retire session-observer node-test files"
```

---

## Phase 3: Documentation And OAT Reference Updates

Update durable docs and project records to describe the new canonical source and remaining PR4 work.

### Task p03-t01: Update Public And Agent-Facing Runtime Documentation

**Files:**

- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `skills/session-observer/SKILL.md` if source/generated behavior is described there
- Modify: `skills/session-observer/references/*.md` if they mention edit paths or generated runtime ownership

**Step 1: Document canonical source layout**

Update references that describe session-observer implementation ownership so they point to `src/transcript/session-observer/` as canonical source and `skills/session-observer/scripts/` as generated shipped output.

**Step 2: Keep operational skill docs user-focused**

Do not overload `SKILL.md` with contributor-only build details unless it already discusses local runtime files. Keep user-facing usage unchanged unless the shipped command path changed, which it should not.

**Step 3: Verify docs**

Run:

```bash
pnpm run validate
pnpm run build:check
```

Expected: repository docs invariants pass and generated output remains clean.

**Step 4: Commit**

```bash
git add README.md AGENTS.md skills/session-observer
git commit -m "docs(p03): document session-observer TypeScript source"
```

---

### Task p03-t02: Update OAT Reference And Backlog Progress Notes

**Files:**

- Modify: `.oat/repo/reference/current-state.md`
- Modify: `.oat/repo/reference/backlog/items/migrate-consensus-tests-to-typescript-types.md`
- Modify as appropriate: `.oat/repo/reference/backlog/index.md`
- Add or modify: `.oat/repo/reference/project-summaries/20260617-session-observer-ts-migration.md`

**Step 1: Record the PR3 migration slice**

Update current state and backlog progress to say session-observer source/tests have moved to TypeScript/Vitest, while PR4 still owns final `node:test` runner retirement and broader non-migrated suite cleanup.

**Step 2: Add/update project summary**

Create a concise project summary for this PR3 slice covering source migration, generated shipped paths, test migration, verification, and remaining PR4 work.

**Step 3: Verify references**

Run:

```bash
pnpm run validate
git diff --check -- .oat/repo/reference
```

Expected: reference docs are internally consistent and whitespace-clean.

**Step 4: Commit**

```bash
git add .oat/repo/reference
git commit -m "docs(p03): record session-observer TypeScript migration"
```

---

## Phase 4: Final Verification And Closeout

Run the requested final checks and prepare lifecycle artifacts for review/PR handoff.

### Task p04-t01: Run Required Verification Suite

**Files:**

- Modify if needed: source, tests, generated outputs, docs from prior phases
- Modify: `.oat/projects/shared/session-observer-ts-migration/implementation.md`

**Step 1: Run minimum verification**

Run:

```bash
pnpm run build
pnpm run type-check
pnpm run build:check
pnpm run sync:transcript-core --check
pnpm run test
pnpm run validate
pnpm run smoke
```

Expected: all commands pass.

**Step 2: Re-run targeted acceptance checks**

Run:

```bash
pnpm run test:vitest -- tests/session-observer
pnpm run test:node
find tests/session-observer -name '*.test.mjs' -type f
```

Expected: session-observer Vitest tests pass, remaining Node tests pass, and no session-observer `.test.mjs` files remain.

**Step 3: Verify generated-output cleanliness**

Run:

```bash
pnpm run build
git diff --exit-code -- skills/session-observer/scripts scripts/build-generated.mjs tests/generated-output-sync.test.mjs
pnpm run build:check
```

Expected: build is idempotent and generated output is committed.

**Step 4: Update implementation closeout**

Record final verification results, any accepted deviations, and the remaining PR4 work in `implementation.md`.

**Step 5: Commit**

```bash
git add .oat/projects/shared/session-observer-ts-migration/implementation.md
git commit -m "chore(p04): record session-observer migration verification"
```

If only lifecycle artifacts changed and hooks reject ignored `.oat/**` markdown, verify `git diff --check` and use `git commit --no-verify`.

---

## Reviews

| Scope  | Type     | Status  | Date       | Artifact |
| ------ | -------- | ------- | ---------- | -------- |
| p01    | code     | passed  | 2026-06-18 | reviews/archived/code-p01-rereview-2026-06-18.md |
| p02    | code     | passed  | 2026-06-18 | reviews/archived/code-p02-review-2026-06-18.md |
| p03    | code     | passed  | 2026-06-18 | reviews/archived/code-p03-review-2026-06-18.md |
| p04    | code     | passed  | 2026-06-18 | reviews/archived/code-p04-final-review-2026-06-18.md |
| final  | code     | received | 2026-06-17 | reviews/final-review-2026-06-17.md |
| plan   | artifact | passed  | 2026-06-17 | reviews/archived/artifact-plan-review-2026-06-17.md |
| spec   | artifact | pending | -          | N/A - quick mode |
| design | artifact | pending | -          | N/A - quick mode |

**Status values:** `pending` -> `received` -> `fixes_added` -> `fixes_completed` -> `passed`

---

## Implementation Complete

**Summary:**

- Phase 1: 3 tasks - Migrate session-observer runtime implementation to canonical TypeScript source and generated shipped `.mjs` outputs.
- Phase 2: 4 tasks - Convert session-observer tests to Vitest TypeScript while keeping generated-entrypoint coverage and mixed runner behavior.
- Phase 3: 2 tasks - Update public docs and OAT reference/backlog/project-summary records.
- Phase 4: 1 task - Run full required verification and record closeout.

**Total: 10 tasks**

Ready for `oat-project-implement`.

---

## References

- Discovery: `discovery.md`
- Current transcript runtime source: `src/transcript/core/runtimes.ts`
- Current export-session source precedent: `src/transcript/export-session/`
- Generated-output build: `scripts/build-generated.mjs`
- Generated-output drift tests: `tests/generated-output-sync.test.mjs`
- Existing shipped session-observer runtime paths: `skills/session-observer/scripts/`
