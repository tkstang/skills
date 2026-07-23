---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-07-23
oat_phase: plan
oat_phase_status: complete
oat_plan_hill_phases: ['p04']
oat_auto_review_at_hill_checkpoints: true
oat_plan_parallel_groups: [['p01', 'p02', 'p03', 'p04']]
oat_plan_source: quick
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
oat_template: false
---

# Implementation Plan: wave-1-execution (Wave 1 external-plan wrapper)

> Execute this plan using `oat-project-implement` — groups per
> `oat_plan_parallel_groups`. Concurrency ceiling: 4 worktrees (operator
> decision, set at program approval).

**Goal:** Execute the 4 Wave 1 external plans (atomic-consensus-records-writes,
cross-provider-recursion-guard, session-observer-state-robustness,
docs-staleness-sweep) through the wave→project wrapper pattern.

**Architecture:** Thin wrapper. Each task's **entire and only implementation
contract** is its external plan under `.oat/repo/reference/external-plans/`. Tasks
below carry wrapper-owned metadata exclusively: the source-plan path,
ordering/dependencies, wrapper-level verification gates, the commit convention, and
review mapping. Nothing in this file restates, narrows, or overrides a source plan.

**Commit Convention:** `{type}(p{NN}-t{NN}): {description}` — the external plan
governs commit content and granularity; the wrapper adds the `pNN-tNN` scope.

**Wrapper execution contract (applies to every task):**

1. **Drift check first.** Run the source plan's `## Drift check` against current
   HEAD. A material mismatch (per that plan's own definition) is a STOP. The
   wave-boundary drift refresh (see record below) does not replace the in-worktree
   re-check — the integration tip advances as groups merge.
   **Rule-1 addendum (p01 only):** extend the source plan's drift-check pathspec
   with `plugins/consensus/scripts/consensus-loop.mjs plugins/consensus/skills/refine/SKILL.md plugins/consensus/skills/evaluate/SKILL.md`
   — the plan's own pathspec omits part of its declared write surface.
2. **Execute the source plan's `## Implementation steps`** in order with each
   step's embedded Verify gate; honor its `## STOP conditions` verbatim.
3. **Confirm the source plan's `## Done criteria`**, then run the full DoD gates:
   `pnpm run premerge && pnpm run validate:skill-versions -- --base-ref main`
   (Node >= 22; `pnpm install --frozen-lockfile` in a fresh worktree first). Run
   every piped verification under `set -o pipefail` or capture the raw exit code
   before filtering.
4. **STOP → BLOCKED at phase level.** A source-plan STOP parks the phase (record
   in `state.md` `oat_blockers` + `implementation.md`); sibling phases continue.
5. **Group-dependency rule:** single-group wave — all four phases dispatch
   together; the wave is terminal when every phase is merged or parked.
6. **Merge serialization:** merge phase branches one at a time in plan order
   (p01 → p02 → p03 → p04), rebasing each on the updated tip first. Recon found
   ZERO shared files between lanes; serialization is defensive, not
   conflict-driven.
7. **Backlog archival is NOT part of any task** — once, serialized on the
   integration branch after all merges.
8. **Phase review checklist = the source plan's `## Review focus`.**
9. **Artifact hygiene:** every agent runs `pnpm exec oxfmt --write <file>` on
   markdown it writes (repo ignore patterns govern — never format `AGENTS.md`,
   `CLAUDE.md`, or generated files) and reports observations for
   `orchestration-log.md` (workers report; the root appends).
10. **Commit verification after ambiguous results:** inspect `git log`/HEAD before
    retrying; record the SHA in `implementation.md`.

## Parallelism

One group of four phases: `['p01', 'p02', 'p03', 'p04']` — ceiling 4, all lanes
write-disjoint per the drift-refresh recon (zero pairwise file overlaps across
canonical sources, tests, generated outputs, SKILL.md targets, and docs). p01 and
p02 write different files in the same directory (`plugins/consensus/scripts/`) —
proximity only, no collision.

> The recon observations below are **non-authoritative grouping evidence only** —
> they justify group composition but never constrain a source plan: each source
> plan's own live location/condition checks govern at execution time.

## Dispatch Profile

_No per-phase overrides. Runtime selection applies, capped by the project's named
dispatch policy in `state.md`; provider-specific model/effort selection is owned by
runtime resolution, not this plan. Cross-model review requirements are embedded in
p01 (write-durability), p02 (security/containment), and p03 (locking)._

## Drift Refresh Record (2026-07-23, vs `36e37fb5643bc016b287e73cf33463756986f257`)

Non-authoritative recon evidence — 4 PASS / 0 MINOR-DRIFT / 0 STOP:

- **atomic-consensus-records-writes:** PASS; evidence (flush/writeLoopStatus
  in-place writes, state.ts atomic model) re-verified live. Coverage gap in its
  drift-check pathspec → rule-1 addendum above. Reconciliation (non-narrowing):
  the live build mapping produces ONE shared `plugins/consensus/scripts/consensus-loop.mjs`
  (not per-skill copies as the plan's prose describes); WHAT is unchanged —
  atomic writes, mandated SKILL.md bumps, all gates.
- **cross-provider-recursion-guard:** PASS; `host-guard.ts` different-host branch
  and `structured-output.ts` spread site re-verified live.
- **session-observer-state-robustness:** PASS; `acquireLock`, `isPidLive`,
  `saveCwdCache` evidence re-verified live.
- **docs-staleness-sweep:** PASS; all six staleness claims re-verified live. No
  repo test pins the stale marketplace description (conditional test-update
  clause not triggered).
- Entire `8309623..36e37fb` diff touches only `.oat/` and provider-mirror paths;
  no plan write surface intersects it.

---

## Phase p01: atomic-consensus-records-writes (group 1)

**Milestone:** the source plan's `## Done criteria` fully satisfied.

### Task p01-t01: Execute external plan — Make consensus loop state writes atomic

**Source plan (the contract):**
`.oat/repo/reference/external-plans/2026-07-17-atomic-consensus-records-writes.md`

**Ordering:** group 1; own worktree, parallel with p02–p04. Merges first (plan
order; defensive only — no shared files).

**Step 1: Drift check** — per the source plan's `## Drift check`, plus the rule-1
addendum (see wrapper execution contract rule 1).

**Step 2: Execute** the source plan in full.

**Step 3: Verify (wrapper gate)** — the source plan's `## Done criteria` checks,
then the full DoD gates from the wrapper execution contract. Expected: all green.

**Step 4: Cross-model review** — before committing the final state, obtain an
independent cross-model review of the cumulative branch diff via the
runtime-configured reviewer (provider/model/effort owned by dispatch
configuration, not this plan); disposition every finding in the phase report.

**Step 5: Commit** — e.g. `fix(p01-t01): write consensus records and status atomically`.

---

## Phase p02: cross-provider-recursion-guard (group 1)

**Milestone:** the source plan's `## Done criteria` fully satisfied.

### Task p02-t01: Execute external plan — Close the cross-provider recursion guard gap

**Source plan (the contract):**
`.oat/repo/reference/external-plans/2026-07-17-cross-provider-recursion-guard.md`

**Ordering:** group 1; own worktree, parallel with p01/p03/p04.

**Step 1: Drift check** — per the source plan's `## Drift check`.

**Step 2: Execute** the source plan in full.

**Step 3: Verify (wrapper gate)** — source plan `## Done criteria`, then full DoD
gates. Expected: all green.

**Step 4: Cross-model review** — security/containment surface: independent
cross-model review of the diff with a weaker-anywhere analysis (any spawn
previously blocked that is now allowed is Critical); disposition every finding in
the phase report.

**Step 5: Commit** — e.g. `fix(p02-t01): enforce recursion depth across provider chains`.

---

## Phase p03: session-observer-state-robustness (group 1)

**Milestone:** the source plan's `## Done criteria` fully satisfied.

### Task p03-t01: Execute external plan — Stale-lock recovery and atomic cache writes

**Source plan (the contract):**
`.oat/repo/reference/external-plans/2026-07-17-session-observer-state-robustness.md`

**Ordering:** group 1; own worktree, parallel with p01/p02/p04.

**Step 1: Drift check** — per the source plan's `## Drift check`.

**Step 2: Execute** the source plan in full.

**Step 3: Verify (wrapper gate)** — source plan `## Done criteria`, then full DoD
gates. Expected: all green.

**Step 4: Cross-model review** — locking surface: independent cross-model review
of the diff; reviewer must design at least one adversarial probe of its own
around the reclaim race (two contenders, live-owner theft); disposition every
finding in the phase report.

**Step 5: Commit** — e.g. `fix(p03-t01): recover stale session-observer locks`.

---

## Phase p04: docs-staleness-sweep (group 1)

**Milestone:** the source plan's `## Done criteria` fully satisfied.

### Task p04-t01: Execute external plan — Sync stale top-level documentation surfaces

**Source plan (the contract):**
`.oat/repo/reference/external-plans/2026-07-17-docs-staleness-sweep.md`

**Ordering:** group 1; own worktree, parallel with p01–p03. Merges last (plan
order). Only lane touching `AGENTS.md`/`CHANGELOG.md`/`README.md` — no collision
this wave.

**Step 1: Drift check** — per the source plan's `## Drift check`.

**Step 2: Execute** the source plan in full.

**Step 3: Verify (wrapper gate)** — the plan's greppable assertions, then full DoD
gates. Expected: all green.

**Step 4: Commit** — e.g. `docs(p04-t01): sync stale top-level surfaces`.

---

## Reviews

| Scope  | Type     | Status  | Date | Artifact |
| ------ | -------- | ------- | ---- | -------- |
| p01    | code     | passed  | 2026-07-23 | reviews/p01-code-review-2026-07-23.md |
| p02    | code     | passed  | 2026-07-23 | reviews/p02-code-review-2026-07-23.md |
| p03    | code     | pending | -    | -        |
| p04    | code     | passed  | 2026-07-23 | reviews/p04-code-review-2026-07-23.md |
| final  | code     | pending | -    | -        |
| plan   | artifact | passed  | 2026-07-23 | reviews/plan-gate-2026-07-23.md |
| spec   | artifact | pending | -    | -        |
| design | artifact | pending | -    | -        |

**Status values:** `pending` → `received` → `fixes_added` → `fixes_completed` → `passed`

## Implementation Complete

- [ ] 4/4 phases, 4/4 tasks complete
- [ ] Every source plan's `## Done criteria` confirmed (recorded in `implementation.md`)
- [ ] **Serialized backlog bookkeeping** (integration branch, after all merges):
      `oat backlog archive` with real outcome summaries for
      BL-260718-make-consensus-records, BL-260718-enforce-recursion-depth-across,
      BL-260718-session-observer-stale-lock, BL-260718-sync-stale-top-level — one commit
- [ ] Orchestration-log end-of-run synthesis written; roll-up into `summary.md`
      before any archive step
- [ ] Full DoD gates green on the integration branch

## References

- Source plans: the 4 `.oat/repo/reference/external-plans/*.md` files named above
- Program artifact: `.oat/repo/reference/external-plans/2026-07-22-execution-program.md`
- Program index: `.oat/repo/reference/external-plans/2026-07-17-repo-audit-plan-index.md`
