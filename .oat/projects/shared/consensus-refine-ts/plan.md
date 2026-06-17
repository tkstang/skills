---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-06-16
oat_phase: plan
oat_phase_status: complete
oat_plan_hill_phases: ['p04'] # phases to pause AFTER completing (empty = every phase)
oat_auto_review_at_hill_checkpoints: true
oat_plan_parallel_groups: [] # groups of phases that run concurrently in worktrees; [] = fully sequential
oat_plan_source: quick # spec-driven | quick | imported
oat_import_reference: null # e.g., references/imported-plan.md
oat_import_source_path: null # original source path provided by user
oat_import_provider: null # codex | cursor | claude | null
oat_generated: false
---

# Implementation Plan: consensus-refine-ts

> Execute this plan using `oat-project-implement` — sequential by default, parallel when `oat_plan_parallel_groups` is declared.

**Goal:** Migrate the consensus refine wrapper to canonical TypeScript
(`src/consensus/refine/consensus-refine.ts`) that regenerates the existing
dependency-free shipped runtime (`plugins/consensus/skills/refine/scripts/consensus-refine.mjs`),
and migrate the consensus `node:test` suite to Vitest `.test.ts` with no assertion
loss — keeping user-facing behavior and runtime paths stable.

**Architecture:** Two-tree contract (DR-020): canonical TS under `src/consensus/`,
committed generated `.mjs` under `plugins/consensus/`. The wrapper's loop import is
written as the NodeNext specifier `'../core/consensus-loop.js'` (type-checks against
the real loop API) and rewritten by `scripts/build-generated.mjs` to
`'./consensus-loop.mjs'` in the emitted shipped runtime.

**Tech Stack:** TypeScript (NodeNext, strict), esbuild (`bundle:false`, dev-only),
Vitest, Node 22 stdlib runtime.

**Commit Convention:** `{type}({scope}): {description}` — Conventional Commits,
enforced by the `commit-msg` hook (e.g. `build(p01-t01): add importRewrites to build`).

## Planning Checklist

- [x] Confirmed HiLL checkpoints with user
- [x] Set `oat_plan_hill_phases` in frontmatter
- [x] Evaluated phases for parallelism opportunities
- [x] Set `oat_plan_parallel_groups` in frontmatter

---

## Parallelism

The plan is **fully sequential** (`oat_plan_parallel_groups: []`).

- **Phase 2 depends on Phase 1.** The migrated consensus tests run against the
  regenerated shipped wrapper, and the new guard tests assert the Phase 1 build
  mapping/import rewrite. Phase 2 cannot start until Phase 1's generated artifact and
  mapping exist.
- **Phase 3 depends on Phase 2.** The doc/reference updates describe the completed
  wrapper + test migration; they must reflect finished scope.
- **Phase 2 tasks are not split into parallel phases** even though each ports a
  disjoint set of test files: every port task appends to the single
  assertion-parity inventory in `implementation.md` (parallel worktrees would
  conflict on that section) and all consume the same Phase 1 generated artifact. The
  green-at-each-step audit ordering is also easier to keep sequential.

---

## Dispatch Profile

_No per-phase overrides. Runtime selection chooses the lowest confident tier within
the resolved dispatch ceiling._

---

## Phase 1: Wrapper TypeScript source + build import-rewrite mechanism

> **HiLL checkpoint:** pause after this phase for human verification before the bulk
> test migration (`oat_plan_hill_phases: ['p01']`).

### Task p01-t01: Add per-mapping `importRewrites` to the generated-output build

**Files:**

- Modify: `scripts/build-generated.mjs`

**Step 1: Implement**

In `buildMapping`, after esbuild emits `outputFile.text`, apply an optional
per-mapping `importRewrites` list (`[{ from, to }]`): for each rewrite, replace the
import specifier `from` with `to` in the emitted text. Throw a clear error if a
declared `from` specifier is **not present** in the emitted output (guards against a
silent no-op rewrite masking a regression). The rewritten text becomes the value
used by both `writeGenerated` and `checkGenerated`, so `--check` compares against the
rewritten output. Leave the existing `consensus-loop` mapping unchanged (no
`importRewrites`).

**Step 2: Verify**

Run: `pnpm run build:check`
Expected: `consensus-loop: in sync` (behavior unchanged — no rewrites declared yet).

Run: `pnpm exec vitest run tests/generated-output-sync.test.mjs`
Expected: drift guard still passes.

**Step 3: Commit**

```bash
git add scripts/build-generated.mjs
git commit -m "build(p01-t01): add per-mapping importRewrites to generated build"
```

---

### Task p01-t02: Create canonical wrapper TypeScript source

**Files:**

- Create: `src/consensus/refine/consensus-refine.ts`

**Step 1: Implement**

Port the wrapper logic from `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`
into `src/consensus/refine/consensus-refine.ts`:

- Change the loop import from `'./consensus-loop.mjs'` to `'../core/consensus-loop.js'`
  (NodeNext resolves this to `src/consensus/core/consensus-loop.ts` for type-checking
  against the real loop API).
- Preserve every existing export and all runtime behavior verbatim
  (`parseWrapperArgs`, `runSequential`, `prepareParallelRun`, `fanInParallelRun`,
  `runWrapperCli`, `renderDeliberationArtifact`, `resolvePeers`, `resolveSynthesizer`,
  `preflightPaseo`, the constants, etc.).
- Add only the minimal, behavior-preserving type annotations needed to pass strict
  `tsc`. The bar is "genuine types where they prevent bugs and `tsc` passes", not a
  ground-up retype. **No value behavior may change.**
- Do **not** wire the build mapping yet (the shipped `.mjs` stays the current
  hand-written file this task), so the tree stays green.

**Step 2: Verify**

Run: `pnpm run type-check`
Expected: passes (new source type-checks against the loop API).

Run: `node --test tests/wrapper-options.test.mjs` (sanity: shipped `.mjs`
still the unchanged hand-written file)
Expected: passes.

**Step 3: Commit**

```bash
git add src/consensus/refine/consensus-refine.ts
git commit -m "refactor(p01-t02): add canonical consensus-refine TypeScript source"
```

---

### Task p01-t03: Sync lint/format/CI exclusions for the soon-to-be-generated wrapper

**Files:**

- Modify: `.oxlintrc.json`
- Modify: `.oxfmtrc.json`
- Modify: `.lintstagedrc.mjs`
- Modify: `.github/workflows/validate.yml`

**Step 1: Implement**

Add `plugins/consensus/skills/refine/scripts/consensus-refine.mjs` alongside the
existing `consensus-loop.mjs` entry in every generated-output exclusion/diff location
(must land **before** the file becomes generated in p01-t04, so the pre-commit
`lint-staged` hook never reformats the generated artifact):

- `.oxlintrc.json` `ignorePatterns`
- `.oxfmtrc.json` `ignorePatterns`
- `.lintstagedrc.mjs` generated-output exclusion list
- `.github/workflows/validate.yml`: the generated-file `git diff --exit-code` check
  (add the refine path) and both the `oxlint` and `oxfmt --check` `exclude` regexes.

**Step 2: Verify**

Run: `pnpm lint` and `pnpm format:check`
Expected: no errors; configs parse.

Run: `node -e "require('./.lintstagedrc.mjs')" 2>/dev/null || pnpm exec node --input-type=module -e "import('./.lintstagedrc.mjs').then(()=>console.log('ok'))"`
Expected: config loads without error.

**Step 3: Commit**

```bash
git add .oxlintrc.json .oxfmtrc.json .lintstagedrc.mjs .github/workflows/validate.yml
git commit -m "build(p01-t03): exclude generated consensus-refine.mjs from lint/format/CI"
```

---

### Task p01-t04: Wire the wrapper build mapping and regenerate the shipped runtime

**Files:**

- Modify: `scripts/build-generated.mjs`
- Modify: `plugins/consensus/skills/refine/scripts/consensus-refine.mjs` (regenerated, not hand-edited)

**Step 1: Implement**

Add the second `generatedOutputs` entry:

```js
{
  id: 'consensus-refine',
  source: 'src/consensus/refine/consensus-refine.ts',
  output: 'plugins/consensus/skills/refine/scripts/consensus-refine.mjs',
  importRewrites: [
    { from: '../core/consensus-loop.js', to: './consensus-loop.mjs' },
  ],
}
```

Then regenerate via the build (never hand-edit the output):

Run: `pnpm run build`

**Step 2: Verify**

Run: `pnpm run build:check`
Expected: both `consensus-loop: in sync` and `consensus-refine: in sync`.

Confirm the regenerated wrapper imports the sibling runtime:
Run: `grep -n "consensus-loop" plugins/consensus/skills/refine/scripts/consensus-refine.mjs`
Expected: `from "./consensus-loop.mjs"`; no `../core/` specifier.

Run: `pnpm run type-check && pnpm run test && pnpm run validate && pnpm run smoke`
Expected: all pass (shipped `.mjs` is behaviorally identical, so the existing
`node:test` consensus suite still passes against the regenerated wrapper).

**Step 3: Commit**

```bash
git add scripts/build-generated.mjs plugins/consensus/skills/refine/scripts/consensus-refine.mjs
git commit -m "build(p01-t04): generate shipped consensus-refine.mjs from TypeScript source"
```

---

### Task p01-t05: Add generated-import + extend drift/layout guards

**Files:**

- Create: `tests/generated-consensus-refine-import.test.ts`
- Modify: `tests/generated-output-sync.test.mjs`
- Modify: `tests/repo-layout.test.mjs`

**Step 1: Implement**

- New Vitest test (`tests/generated-consensus-refine-import.test.ts`) reading the
  committed `consensus-refine.mjs` and asserting it imports `'./consensus-loop.mjs'`
  and contains no `'../core/'` specifier (the explicit "generated import is correct"
  proof).
- Extend `tests/generated-output-sync.test.mjs`: assert `--check` stdout contains
  `consensus-refine: in sync`, and assert the script declares the wrapper
  source→output mapping (`src/consensus/refine/consensus-refine.ts` and the refine
  `.mjs` output path).
- Extend `tests/repo-layout.test.mjs`: add `src/consensus/refine` to the required
  directories (keep the existing assertion that no `.ts` exists under
  `plugins/consensus/skills`).

**Step 2: Verify**

Run: `pnpm exec vitest run tests/generated-consensus-refine-import.test.ts tests/generated-output-sync.test.mjs`
Expected: pass.

Run: `node --test tests/repo-layout.test.mjs`
Expected: pass.

**Step 3: Commit**

```bash
git add tests/generated-consensus-refine-import.test.ts tests/generated-output-sync.test.mjs tests/repo-layout.test.mjs
git commit -m "test(p01-t05): prove generated wrapper import and extend drift/layout guards"
```

---

## Phase 2: Migrate consensus tests to Vitest (assertion-parity preserved)

> Every port task records a per-file row in the **assertion-parity inventory** in
> `implementation.md` (source file, Vitest target, `node:test` case count,
> assertion/scenario count before→after, nested/dynamic-case handling, per-file
> verification command) and must satisfy the design's 4-point per-file acceptance
> signal. A file leaves the Node runner the instant it is renamed `*.test.mjs` →
> `*.test.ts`; never leave a `.mjs` + `.test.ts` pair for the same module.

### Task p02-t01: Add the shared test-helper type declaration

**Files:**

- Create: `tests/helpers/process.d.mts`

**Step 1: Implement**

Add an ambient declaration matching `tests/helpers/process.mjs`
(`captureWriter`, `parseJsonl`, `runNodeScript`) so `.test.ts` files can import the
`.mjs` helper without an implicit-any error under `allowJs: false`. Keep
`process.mjs` as the runtime module (the out-of-scope `node:test`
`smoke-test-script` still imports it).

**Step 2: Verify**

Run: `pnpm run type-check`
Expected: passes (declaration resolves; no behavior change).

**Step 3: Commit**

```bash
git add tests/helpers/process.d.mts
git commit -m "test(p02-t01): add type declaration for shared process test helper"
```

---

### Task p02-t02: Port loop tests to Vitest

**Files:**

- Rename/Convert: `tests/consensus-loop-cli.test.mjs` → `tests/consensus-loop-cli.test.ts`
- Rename/Convert: `tests/loop-convergence.test.mjs` → `tests/loop-convergence.test.ts`
- Rename/Convert: `tests/loop-records.test.mjs` → `tests/loop-records.test.ts`
- Modify: `implementation.md` (assertion-parity inventory rows)

**Step 1: Record before-counts**

For each file, capture `node:test` case + assertion/scenario counts (per the design's
deterministic counting method) into the inventory before deleting the `.mjs`.

**Step 2: Port**

Translate `test`/`t.test`/`assert*` to Vitest `describe`/`it`/`it.each`/`expect`,
preserving each assertion 1:1. Keep imports pointed at the shipped runtime path. Map
nested subtests and loop/table cases to distinct `it`/`it.each` rows.

**Step 3: Verify (per file)**

Run: `pnpm exec vitest run tests/consensus-loop-cli.test.ts tests/loop-convergence.test.ts tests/loop-records.test.ts`
Expected: pass; reported test counts match the inventory rows.

Run: `pnpm run type-check`
Expected: passes.

**Step 4: Commit**

```bash
git add tests/consensus-loop-cli.test.ts tests/loop-convergence.test.ts tests/loop-records.test.ts implementation.md
git rm tests/consensus-loop-cli.test.mjs tests/loop-convergence.test.mjs tests/loop-records.test.mjs 2>/dev/null || true
git commit -m "test(p02-t02): port consensus loop tests to Vitest"
```

---

### Task p02-t03: Port parallel-orchestration tests to Vitest

**Files:**

- Convert: `tests/parallel-errors.test.mjs`, `tests/parallel-fan-in.test.mjs`,
  `tests/parallel-integration.test.mjs`, `tests/parallel-modes.test.mjs`,
  `tests/parallel-prepare.test.mjs` → `.test.ts`
- Modify: `implementation.md` (inventory rows)

Note: `parallel-integration` imports `tests/helpers/process` — it relies on the
p02-t01 declaration.

**Steps:** same record → port → per-file verify → commit pattern as p02-t02.

**Verify:**

Run: `pnpm exec vitest run tests/parallel-errors.test.ts tests/parallel-fan-in.test.ts tests/parallel-integration.test.ts tests/parallel-modes.test.ts tests/parallel-prepare.test.ts`
Expected: pass; counts match inventory. Then `pnpm run type-check`.

**Commit:** `test(p02-t03): port parallel orchestration tests to Vitest`

---

### Task p02-t04: Port wrapper/sequential/verdict tests to Vitest

**Files:**

- Convert: `tests/wrapper-options.test.mjs`, `tests/sequential-wrapper.test.mjs`,
  `tests/verdict-validation.test.mjs` → `.test.ts`
- Modify: `implementation.md` (inventory rows)

**Steps:** record → port → per-file verify → commit.

**Verify:**

Run: `pnpm exec vitest run tests/wrapper-options.test.ts tests/sequential-wrapper.test.ts tests/verdict-validation.test.ts`
Expected: pass; counts match. Then `pnpm run type-check`.

**Commit:** `test(p02-t04): port wrapper/sequential/verdict tests to Vitest`

---

### Task p02-t05: Port resume/parse tests to Vitest

**Files:**

- Convert: `tests/resume-corruption.test.mjs`, `tests/resume-parse.test.mjs`,
  `tests/section-parser.test.mjs` → `.test.ts`
- Modify: `implementation.md` (inventory rows)

**Steps:** record → port → per-file verify → commit.

**Verify:**

Run: `pnpm exec vitest run tests/resume-corruption.test.ts tests/resume-parse.test.ts tests/section-parser.test.ts`
Expected: pass; counts match. Then `pnpm run type-check`.

**Commit:** `test(p02-t05): port resume/parse tests to Vitest`

---

### Task p02-t06: Port event/escalation/intervention/paseo tests to Vitest

**Files:**

- Convert: `tests/escalation.test.mjs`, `tests/event-payload-inventory.test.mjs`,
  `tests/user-intervention.test.mjs`, `tests/paseo-invocation.test.mjs` → `.test.ts`
- Modify: `implementation.md` (inventory rows)

**Steps:** record → port → per-file verify → commit.

**Verify:**

Run: `pnpm exec vitest run tests/escalation.test.ts tests/event-payload-inventory.test.ts tests/user-intervention.test.ts tests/paseo-invocation.test.ts`
Expected: pass; counts match. Then `pnpm run type-check`.

**Commit:** `test(p02-t06): port event/escalation/intervention/paseo tests to Vitest`

---

### Task p02-t07: Port path-safety and consensus error-handling tests to Vitest

**Files:**

- Convert: `tests/path-safety.test.mjs`, `tests/error-handling.test.mjs` → `.test.ts`
- Modify: `implementation.md` (inventory rows)

Note: `error-handling` is included as consensus behavior (error rendering / exit
codes) per the design, despite not matching a listed filename prefix.

**Steps:** record → port → per-file verify → commit.

**Verify:**

Run: `pnpm exec vitest run tests/path-safety.test.ts tests/error-handling.test.ts`
Expected: pass; counts match. Then full `pnpm test` to confirm both runners are green
and no `.mjs`/`.test.ts` duplication remains for migrated modules.

**Commit:** `test(p02-t07): port path-safety and consensus error-handling tests to Vitest`

---

## Phase 3: Documentation & reference updates (completed scope)

### Task p03-t01: Update repo reference artifacts

**Files:**

- Modify: `.oat/repo/reference/backlog/items/migrate-consensus-tests-to-typescript-types.md`
- Modify: `.oat/repo/reference/decision-record.md`
- Modify: `.oat/repo/reference/current-state.md`

**Step 1: Implement**

- `bl-bfb4` Progress Notes: record that the refine wrapper now has canonical TS
  source and the consensus `node:test` suite is migrated to Vitest; note what remains
  (non-consensus suites still on `test:node`; `allowJs` already `false`).
- Decision record: add **DR-021** for the build-time import-rewrite mechanism
  (canonical TS imports `'../core/consensus-loop.js'`; build rewrites to
  `'./consensus-loop.mjs'`; fail-loud on missing specifier), referencing/extending
  DR-020.
- `current-state.md`: update the test-runner posture (consensus on Vitest; both
  consensus generated outputs drift-checked).
- If item files changed: run `oat backlog regenerate-index`.

**Step 2: Verify**

Run: `pnpm run validate`
Expected: docs/structure invariants pass.

**Step 3: Commit**

```bash
git add .oat/repo/reference/backlog .oat/repo/reference/decision-record.md .oat/repo/reference/current-state.md
git commit -m "docs(p03-t01): record consensus-refine TS/Vitest migration in repo reference"
```

---

### Task p03-t02: Update contributor/agent generated-output references

**Files:**

- Modify: `CLAUDE.md` (generated-output guidance)
- Modify: `AGENTS.md` (root; the prose generated-output list near line 54)

**Step 1: Implement**

Add `plugins/consensus/skills/refine/scripts/consensus-refine.mjs` to the
generated-runtime-output examples/guidance that currently name only
`consensus-loop.mjs`, so the "edit canonical TS → run build → never hand-edit
generated `.mjs`" guidance covers both consensus outputs. Only `CLAUDE.md` and the
root `AGENTS.md` name a specific generated output today; edit the **prose**
generated-output list only — do **not** touch root `AGENTS.md`'s `oat sync`-managed
`<!-- OAT tools -->` block. `tests/AGENTS.md` names no specific generated file and is
intentionally **not** modified. Do not run `oxfmt` over these agent-instruction files
(they are formatting-excluded).

**Step 2: Verify**

Run: `pnpm run validate && pnpm run build:check`
Expected: pass.

Run: `grep -rn "consensus-refine.mjs" CLAUDE.md AGENTS.md`
Expected: the new generated-output reference is present.

**Step 3: Commit**

```bash
git add CLAUDE.md AGENTS.md
git commit -m "docs(p03-t02): list consensus-refine.mjs as a generated runtime output"
```

---

## Phase 4: Final review fixes

### Task p04-t01: (review) Constrain generated-output import rewrites to module specifiers

**Files:**

- Modify: `scripts/build-generated.mjs`
- Modify: `plugins/consensus/skills/refine/scripts/consensus-refine.mjs` (regenerated only if output changes)
- Modify: `tests/generated-output-sync.test.mjs`

**Step 1: Understand the issue**

Review finding: the generated-output build currently rewrites every quoted string
matching a configured `importRewrites.from` value. For the current wrapper this only
matches the static loop import, but a future emitted diagnostic string or data literal
containing the same quoted value would be rewritten silently even though it is not a
module specifier.

Location: `scripts/build-generated.mjs:113`

**Step 2: Implement fix**

Constrain rewrites to static module specifier syntax only, covering named/default
imports, namespace imports, dynamic imports if emitted, and side-effect imports. Keep
the fail-loud behavior when a configured source specifier is absent, and add a focused
test proving non-import quoted strings are not rewritten.

**Step 3: Verify**

Run: `pnpm run build:check`
Expected: both generated outputs are in sync.

Run: `pnpm exec vitest run tests/generated-consensus-refine-import.test.ts tests/generated-output-sync.test.mjs`
Expected: generated import and drift/rewrite guard tests pass.

Run: `pnpm run type-check`
Expected: TypeScript passes.

**Step 4: Commit**

```bash
git add scripts/build-generated.mjs plugins/consensus/skills/refine/scripts/consensus-refine.mjs tests/generated-output-sync.test.mjs
git commit -m "fix(p04-t01): constrain generated import rewrites"
```

---

## Reviews

{Track reviews here after running the oat-project-review-provide and oat-project-review-receive skills.}

{Keep both code + artifact rows below. Add additional code rows (p03, p04, etc.) as needed, but do not delete `spec`/`design`.}

| Scope  | Type     | Status  | Date | Artifact |
| ------ | -------- | ------- | ---- | -------- |
| p01    | code     | passed  | 2026-06-16 | reviews/archived/p01-review-2026-06-16-v2.md |
| p02    | code     | passed  | 2026-06-16 | reviews/archived/p02-review-2026-06-16-v2.md |
| p03    | code     | passed  | 2026-06-16 | reviews/archived/p03-review-2026-06-16-v2.md |
| final  | code     | passed  | 2026-06-17 | reviews/final-review-2026-06-17.md (independent re-review; 0 findings) |
| spec   | artifact | pending | -    | -        |
| design | artifact | fixes_completed | 2026-06-16 | reviews/archived/artifact-design-review-2026-06-16.md |
| plan   | artifact | passed  | 2026-06-16 | structured (auto-review; I1/I2/M2 applied) |

**Status values:** `pending` → `received` → `fixes_added` → `fixes_completed` → `passed`

**Meaning:**

- `received`: review artifact exists (not yet converted into fix tasks)
- `fixes_added`: fix tasks were added to the plan (work queued)
- `fixes_completed`: fix tasks implemented, awaiting re-review
- `passed`: re-review run and recorded as passing (no Critical/Important)

---

## Implementation Complete

**Summary:**

- Phase 1: 5 tasks - Wrapper TypeScript source + build import-rewrite mechanism + guards
- Phase 2: 7 tasks - Migrate the consensus test suite to Vitest with assertion parity
- Phase 3: 2 tasks - Documentation & reference updates for completed scope
- Phase 4: 1 task - Final review fix for module-specifier import rewrites

**Total: 15 tasks**

Ready for final re-review and merge.

---

## References

- Design: `design.md`
- Spec: `spec.md` (N/A — quick mode)
- Discovery: `discovery.md`
- Decision record: `.oat/repo/reference/decision-record.md` (DR-020; DR-021 added in p03-t01)
