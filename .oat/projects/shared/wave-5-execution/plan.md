---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-07-23
oat_phase: plan
oat_phase_status: complete
oat_plan_hill_phases: ['p02']
oat_auto_review_at_hill_checkpoints: true
oat_plan_parallel_groups: [['p01', 'p02']]
oat_plan_source: quick
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
oat_template: false
---

# Implementation Plan: wave-5-execution (Wave 5 external-plan wrapper — FINAL)

> Execute this plan using `oat-project-implement` — one group of two lanes.
> Concurrency ceiling: 4 (2 used).

**Goal:** Execute the 2 Wave 5 external plans (split-consensus-loop-module,
split-consensus-refine-module) — the program's behavior-preserving facade
splits of the two ~4k-line god modules.

**Architecture:** Thin wrapper. Each task's **entire and only implementation
contract** is its external plan. Nothing here restates, narrows, or overrides
a source plan.

**Commit Convention:** `{type}(p{NN}-t{NN}): {description}` — the source plans
mandate ONE GREEN COMMIT PER EXTRACTED CLUSTER; the wrapper adds only the scope.

## Planning Checklist

- [x] Two lanes from the program's wave map (pointer-only tasks)
- [x] Parallelism evaluated: targets fully disjoint (core/ vs refine/); three
      shared config files handled by anchored-insertion rule + serialized merge
- [x] HiLL at p02 (final phase); auto-review on
- [x] Drift refresh recorded; premises re-verified live
- [x] Review table covers phases + final + artifacts

**Wrapper execution contract (applies to every task):**

1. **Drift check first** per the source plan; its expected-drift carve-outs
   govern (waves 1-3 churn is pre-cleared; re-run the plan's step-1 inventory
   against the live file).
2. **Execute the source plan's `## Implementation steps`** with each embedded
   Verify gate; honor its `## STOP conditions` verbatim.
3. **DoD:** each cluster commit passes the plan's per-commit gate; final state
   passes `pnpm run premerge` then `pnpm run validate:skill-versions
   --base-ref main` (no bare `--`). `set -o pipefail`. EQUIVALENT-INVOCATION:
   `npx vitest run <path>` for scoped runs.
4. **STOP → BLOCKED at phase level;** the sibling continues.
5. **Group rule:** both lanes dispatch together; wave terminal when both
   merged/parked.
6. **Merge serialization:** p01 then p02, rebasing on the updated tip.
   Sequenced shared files: `scripts/build-generated.mjs`, `.oxfmtrc.json`,
   `.oxlintrc.json` — ANCHORED-INSERTION RULE: each lane inserts its new
   entries adjacent to its own module family's existing entries (loop near the
   consensus-loop entry; refine near the consensus-refine entry); NEVER append
   at array end (closing-bracket collision). p02 rebases over p01's insertions.
7. **Backlog archival NOT part of any task** — once, serialized, after merges.
8. **Phase review checklist = the source plan's `## Review focus`** (the
   `git diff --color-moved` verbatim-move inspection is mandatory).
9. **Artifact hygiene:** no repository formatter applies to `.oat/**`
   (oxfmt excludes it) — check wrapper artifacts with `git diff --check`.
   Use `pnpm exec oxfmt --write <file>` only for non-.oat markdown you write
   (never AGENTS.md/generated files). Workers report; root appends.
10. **Commit verification after ambiguous results** via `git log`.
11. **Codex fallback + MAX TWO rounds.**

## Parallelism

Group `['p01', 'p02']`: canonical targets fully disjoint
(src/consensus/core/ vs src/consensus/refine/; generated outputs disjoint:
plugin-root scripts vs refine-skill scripts). Shared appends per rule 6.

> Recon observations are non-authoritative grouping evidence only.

## Dispatch Profile

_No per-phase overrides; managed policy per state.md. One cross-model
verbatim-move purity round embedded per lane (high blast-radius refactors)._

## Drift Refresh Record (2026-07-23, vs `4e3c4caa018d762c6e4f6b95c1b92d513528142f`)

2 MINOR-DRIFT-expected (within the plans' own carve-outs) / 0 STOP:

- **loop split:** consensus-loop.ts now 4,074 lines / 115 top-level functions
  (W1 atomic writes + W2 timeout machinery added; W3 removed ~17 helpers to
  shared/cli-helpers.ts). Facade precondition VERIFIED: single shared output
  `plugins/consensus/scripts/consensus-loop.mjs`; wrapper rewrites now DERIVED
  (W2) — new submodules need only `generatedOutputs` entries. Ignore lists
  hand-maintained but guarded (sync test iterates live outputs). Expected
  ZERO changes under `plugins/consensus/skills/` — any skill-dir change is a
  facade-leak signal.
- **refine split:** consensus-refine.ts byte-identical to authoring (3,890 /
  122). Single skill-scoped output `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`
  → SKILL bump set = refine only (current 0.1.8; bump on top). External
  importers confirmed: scripts/smoke-test.mjs (generated output:
  runSequential/runWrapperCli) + two test files importing canonical symbols
  directly (import-path updates in scope).

---

## Phase 1: split-consensus-loop-module (group 1)

**Milestone:** the source plan's `## Done criteria` fully satisfied.

### Task p01-t01: Execute external plan — Split consensus-loop.ts behind a stable facade

**Source plan (the contract):**
`.oat/repo/reference/external-plans/2026-07-18-split-consensus-loop-module.md`

**Ordering:** group 1; own worktree, parallel with p02. Merges first.

**Step 1: Drift check** — per the source plan (expected-drift carve-outs apply).

**Step 2: Execute** the source plan in full.

**Step 3: Verify (wrapper gate)** — the source plan's `## Done criteria`, then
full DoD. Expected: all green.

**Step 4: Cross-model review (one round, MAX TWO)** — verbatim-move purity:
checklist = the source plan's complete `## Review focus`; disposition every
finding.

**Step 5: Commits** — per cluster, e.g. `refactor(p01-t01): extract records io from consensus-loop`.

---

## Phase 2: split-consensus-refine-module (group 1)

**Milestone:** the source plan's `## Done criteria` fully satisfied.

### Task p02-t01: Execute external plan — Split consensus-refine.ts behind a stable facade

**Source plan (the contract):**
`.oat/repo/reference/external-plans/2026-07-18-split-consensus-refine-module.md`

**Ordering:** group 1; own worktree, parallel with p01. Merges second; rebases
over p01's shared-config insertions per the anchored-insertion rule.

**Step 1: Drift check** — per the source plan.

**Step 2: Execute** the source plan in full.

**Step 3: Verify (wrapper gate)** — the source plan's `## Done criteria`, then
full DoD. Expected: all green.

**Step 4: Cross-model review (one round, MAX TWO)** — verbatim-move purity:
checklist = the source plan's complete `## Review focus`.

**Step 5: Commits** — per cluster, e.g. `refactor(p02-t01): extract resume handling`.

---

## Reviews

| Scope  | Type     | Status  | Date | Artifact |
| ------ | -------- | ------- | ---- | -------- |
| p01    | code     | passed  | 2026-07-23 | reviews/p01-code-review-2026-07-23.md |
| p02    | code     | passed  | 2026-07-23 | reviews/p02-code-review-2026-07-23.md |
| final  | code     | passed   | 2026-07-23 | reviews/final-gate-2026-07-23.md |
| plan   | artifact | passed  | 2026-07-23 | reviews/plan-gate-2026-07-23.md |
| spec   | artifact | passed   | 2026-07-23 | n/a — quick mode (row-terminality) |
| design | artifact | passed   | 2026-07-23 | n/a — quick mode (row-terminality) |

**Status values:** `pending` → `received` → `fixes_added` → `fixes_completed` → `passed`

## Implementation Complete

- [ ] 2/2 phases complete; every source plan's Done criteria confirmed
- [ ] **Serialized backlog bookkeeping**: `oat backlog archive` for
      BL-260718-split-consensus-loop-into, BL-260718-split-consensus-refine-into
- [ ] Orchestration-log synthesis; roll-up into `summary.md` pre-archive
- [ ] Full DoD gates green on the integration branch

## References

- Source plans: the 2 files named above
- Program artifact: `.oat/repo/reference/external-plans/2026-07-22-execution-program.md`
