---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-18
oat_phase: plan
oat_phase_status: in_progress
oat_plan_hill_phases: [] # phases to pause AFTER completing (empty = every phase)
oat_plan_parallel_groups: [] # groups of phases that run concurrently in worktrees; [] = fully sequential
oat_plan_source: quick # spec-driven | quick | imported
oat_import_reference: null # e.g., references/imported-plan.md
oat_import_source_path: null # original source path provided by user
oat_import_provider: null # codex | cursor | claude | null
oat_generated: false
---

# Implementation Plan: consensus-rubric-guidance

> Execute this plan using `oat-project-implement` — sequential by default, parallel when `oat_plan_parallel_groups` is declared.

**Goal:** Pending final discovery decisions.

**Architecture:** Pending quick implementation plan.

**Tech Stack:** Node.js 22+, TypeScript source with generated shipped `.mjs`
outputs, Vitest-backed verification where behavior changes require tests.

**Commit Convention:** `{type}({scope}): {description}`.

## Planning Checklist

- [ ] Confirmed HiLL checkpoints with user
- [ ] Set `oat_plan_hill_phases` in frontmatter
- [ ] Evaluated phases for parallelism opportunities
- [ ] Set `oat_plan_parallel_groups` in frontmatter

---

## Parallelism

Phases that have no overlapping file modifications may run concurrently. To declare parallelism:

```yaml
oat_plan_parallel_groups: [['p02', 'p03']]
```

Each inner array is a group of phases that execute in parallel (each in its own worktree) and merge back in plan order after all pass. Groups themselves run sequentially.

Default is `[]` (fully sequential, no worktrees). Only declare parallelism when phases are genuinely file-disjoint — overlap will produce merge conflicts that stop the run.

---

## Dispatch Profile

_Optional override surface. Use only for explicit user-authored constraints or preferences. Omit this section when runtime selection should choose the lowest confident tier._

Blank or `auto` means there is no explicit constraint for that provider. Do not generate rows by default; a missing phase row uses runtime selection.

| Phase | Claude model              | Codex effort                   | Rationale                     |
| ----- | ------------------------- | ------------------------------ | ----------------------------- |
| pNN   | haiku\|sonnet\|opus\|auto | low\|medium\|high\|xhigh\|auto | why this constraint is needed |

Codex effort values are preferred controls. `oat-project-implement` caps them against the resolved OAT dispatch ceiling and maps selected efforts to pinned implementer variants. Codex provider default effort is informational for base/unpinned roles and is not an OAT ceiling.

---

## Planning Status

Concrete phases and tasks have not been generated yet. Complete discovery first,
then replace this scaffold with the quick implementation plan.

---

## Reviews

No reviews have been run yet. Add review rows after concrete phases or
artifact-review checkpoints exist.

| Scope  | Type     | Status  | Date | Artifact |
| ------ | -------- | ------- | ---- | -------- |
| final  | code     | pending | -    | -        |

**Status values:** `pending` → `received` → `fixes_added` → `fixes_completed` → `passed`

**Meaning:**

- `received`: review artifact exists (not yet converted into fix tasks)
- `fixes_added`: fix tasks were added to the plan (work queued)
- `fixes_completed`: fix tasks implemented, awaiting re-review
- `passed`: re-review run and recorded as passing (no Critical/Important)

---

## Implementation Complete

**Summary:**

- Not started.

**Total:** 0 tasks

Not ready for code review or merge.

---

## References

- Design: `design.md` (required in spec-driven mode; optional in quick/import mode)
- Spec: `spec.md` (required in spec-driven mode; optional in quick/import mode)
- Discovery: `discovery.md`
- Imported Source: `references/imported-plan.md` (when `oat_plan_source: imported`)
