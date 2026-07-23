---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-07-23
oat_phase: plan
oat_phase_status: complete
oat_plan_hill_phases: ['p04']
oat_auto_review_at_hill_checkpoints: true
oat_plan_parallel_groups: [['p01', 'p02', 'p03']]
oat_plan_source: quick
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
oat_template: false
---

# Implementation Plan: wave-2-execution (Wave 2 external-plan wrapper)

> Execute this plan using `oat-project-implement` — groups per
> `oat_plan_parallel_groups`. Concurrency ceiling: 4 worktrees (operator
> decision, set at program approval).

**Goal:** Execute the 4 Wave 2 external plans (consensus-subprocess-hardening,
watch-loop-classification-cache, skill-files-disk-derivation,
derive-generated-ignore-lists) through the wave→project wrapper pattern.

**Architecture:** Thin wrapper. Each task's **entire and only implementation
contract** is its external plan under `.oat/repo/reference/external-plans/`.
Nothing in this file restates, narrows, or overrides a source plan.

**Commit Convention:** `{type}(p{NN}-t{NN}): {description}`.

**Wrapper execution contract (applies to every task):**

1. **Drift check first.** Run the source plan's `## Drift check` against current
   HEAD; a material mismatch per that plan's own definition is a STOP. The
   wave-boundary refresh below does not replace the in-worktree re-check.
   **Rule-1 addenda (pathspec EXTENSIONS, skill-sanctioned, non-narrowing):**
   - p01: also diff `tests/consensus/core/ tests/consensus/panel/ plugins/consensus/scripts/consensus-loop.mjs plugins/consensus/skills/refine/SKILL.md plugins/consensus/skills/evaluate/SKILL.md plugins/consensus/skills/panel/SKILL.md`
   - p02: also diff `skills/session-observer/SKILL.md src/transcript/core/runtimes.ts`
   - p03: also diff `AGENTS.md`
   - p04: also diff `AGENTS.md`
2. **Execute the source plan's `## Implementation steps`** in order with each
   embedded Verify gate; honor its `## STOP conditions` verbatim.
3. **Confirm the source plan's `## Done criteria`**, then run the full DoD gates:
   `pnpm run premerge` then `pnpm run validate:skill-versions --base-ref main`
   (NOTE: no bare `--` before flags — pnpm 10 forwards it and the script rejects
   it; wave-1 adopted rule). Node >= 22; `pnpm install --frozen-lockfile` in a
   fresh worktree first. Run piped verifications under `set -o pipefail`.
4. **STOP → BLOCKED at phase level.** A source-plan STOP parks the phase;
   siblings continue.
5. **Group-dependency rule:** group 1 = p01–p03 (write-disjoint); p04 is
   UNGROUPED and executes sequentially after group 1 is terminal (it shares
   `AGENTS.md` with p03). The wave is terminal when every phase is merged or
   parked.
6. **Merge serialization:** one at a time in plan order (p01 → p02 → p03 → p04),
   rebasing each on the updated tip first. Deliberately sequenced shared file:
   `AGENTS.md` (p03 line-36 sentence, p04 line-85 sentence — different regions;
   p04 rebases over p03's edit).
7. **Backlog archival is NOT part of any task** — once, serialized, after all
   merges.
8. **Phase review checklist = the source plan's `## Review focus`.**
9. **Artifact hygiene:** run `pnpm exec oxfmt --write <specific-file>` on
   markdown you write (repo ignore rules govern; never format AGENTS.md or
   generated files). Workers report observations; the root appends to
   `orchestration-log.md`.
10. **Commit verification after ambiguous results:** inspect `git log` before
    retrying.
11. **Codex fallback (wave-1 adopted rule):** if a `codex exec -o <file>` review
    completes but the output file never appears, transcribe the verdict from the
    codex session rollout (verbatim) instead of waiting; if the process died
    silently, report to the orchestrator rather than re-running more than once.

## Parallelism

Group 1: `['p01', 'p02', 'p03']` — write-disjoint per recon intersection. p04
is ungrouped-sequential after group 1 (shares `AGENTS.md` with p03 in a
different sentence; separate-group execution per the wave contract).

> The recon observations below are **non-authoritative grouping evidence only** —
> each source plan's own live checks govern at execution time.

## Dispatch Profile

_No per-phase overrides. Runtime selection applies, capped by the project's
dispatch policy in `state.md`. Cross-model review requirements are embedded in
p01 (subprocess/timeout surface) and p02 (behavior-equivalence surface)._

## Drift Refresh Record (2026-07-23, vs `ea36369a325774a743a5a49d13e397f491a8cec9`)

Non-authoritative recon evidence — 2 PASS / 2 MINOR-DRIFT (non-material) / 0 STOP:

- **consensus-subprocess-hardening:** MINOR-DRIFT. Wave-1's `atomicWriteFile`
  insertion shifted anchors: `runProviderCliCommand` 1379→~1403,
  `child.stdin.end` 1454→~1478. Both target gaps re-verified PRESENT at the new
  locations (no stdin error guard, no timeout escalation). `consensus-panel.ts`
  byte-identical (stdin.end still :1147); `subprocess.ts` reference lines exact.
  Non-narrowing reconciliation: line anchors in the plan are advisory; the
  functional targets govern.
- **watch-loop-classification-cache:** MINOR-DRIFT. `locate.ts` churned inside
  `saveCwdCache` only (W1 state-robustness work the plan explicitly anticipated);
  `findNewerSameCwdCandidates` 661→~703, still calls `discover()` fresh per call.
  `watch.ts` zero diff (all cited anchors exact). Rebases trivially, as the plan
  predicted.
- **skill-files-disk-derivation:** PASS. `SKILL_FILES` unchanged (same 10 paths);
  discovery and tests unchanged. AGENTS.md's W1 diff touched an unrelated
  sentence.
- **derive-generated-ignore-lists:** PASS. `generatedOutputs` still 28 entries;
  both ignore lists re-verified complete (zero missing either direction);
  `.lintstagedrc.mjs` still derives programmatically; `--list-outputs` present.

---

## Phase p01: consensus-subprocess-hardening (group 1)

**Milestone:** the source plan's `## Done criteria` fully satisfied.

### Task p01-t01: Execute external plan — Harden the consensus-loop subprocess path

**Source plan (the contract):**
`.oat/repo/reference/external-plans/2026-07-17-consensus-subprocess-hardening.md`

**Ordering:** group 1; own worktree, parallel with p02–p04. Merges first (plan order).

**Step 1: Drift check** — per the source plan, plus rule-1 addendum (contract rule 1).

**Step 2: Execute** the source plan in full.

**Step 3: Verify (wrapper gate)** — source plan `## Done criteria`, then full DoD gates. Expected: all green.

**Step 4: Cross-model review** — subprocess/lifecycle surface: independent
cross-model review of the branch diff via the runtime-configured reviewer;
review checklist = the source plan's complete `## Review focus`; disposition
every finding in the phase report.

**Step 5: Commit** — e.g. `fix(p01-t01): add timeout escalation to wrapper subprocess path`.

---

## Phase p02: watch-loop-classification-cache (group 1)

**Milestone:** the source plan's `## Done criteria` fully satisfied.

### Task p02-t01: Execute external plan — Cache transcript classification in the watch loop

**Source plan (the contract):**
`.oat/repo/reference/external-plans/2026-07-17-watch-loop-classification-cache.md`

**Ordering:** group 1; own worktree, parallel with p01/p03/p04.

**Step 1: Drift check** — per the source plan, plus rule-1 addendum.

**Step 2: Execute** the source plan in full.

**Step 3: Verify (wrapper gate)** — source plan `## Done criteria`, then full DoD gates. Expected: all green.

**Step 4: Cross-model review** — behavior-equivalence surface: independent
cross-model review of the diff; review checklist = the source plan's complete `## Review focus`; disposition
every finding in the phase report.

**Step 5: Commit** — e.g. `perf(p02-t01): cache transcript classification`.

---

## Phase p03: skill-files-disk-derivation (group 1)

**Milestone:** the source plan's `## Done criteria` fully satisfied.

### Task p03-t01: Execute external plan — Derive bump-version's skill list from disk

**Source plan (the contract):**
`.oat/repo/reference/external-plans/2026-07-17-skill-files-disk-derivation.md`

**Ordering:** group 1; own worktree, parallel with p01/p02/p04. Merges before
p04 (shared `AGENTS.md`, different sentences).

**Step 1: Drift check** — per the source plan, plus rule-1 addendum.

**Step 2: Execute** the source plan in full.

**Step 3: Verify (wrapper gate)** — source plan `## Done criteria`, then full DoD gates. Expected: all green.

**Step 4: Commit** — e.g. `refactor(p03-t01): derive skill files from disk`.

---

## Phase p04: derive-generated-ignore-lists (group 1)

**Milestone:** the source plan's `## Done criteria` fully satisfied.

### Task p04-t01: Execute external plan — Guard ignore lists and derive import rewrites

**Source plan (the contract):**
`.oat/repo/reference/external-plans/2026-07-17-derive-generated-ignore-lists.md`

**Ordering:** UNGROUPED — executes sequentially after group 1 is terminal, in
its own worktree based on the post-group-1 integration tip; rebases over p03's
`AGENTS.md` edit by construction.

**Step 1: Drift check** — per the source plan, plus rule-1 addendum.

**Step 2: Execute** the source plan in full.

**Step 3: Verify (wrapper gate)** — source plan `## Done criteria`, then full DoD gates. Expected: all green.

**Step 4: Commit** — e.g. `test(p04-t01): guard generated ignore lists` /
`refactor(p04-t01): derive import rewrites`.

---

## Reviews

| Scope  | Type     | Status  | Date | Artifact |
| ------ | -------- | ------- | ---- | -------- |
| p01    | code     | passed  | 2026-07-23 | reviews/p01-code-review-2026-07-23.md |
| p02    | code     | pending | -    | -        |
| p03    | code     | passed  | 2026-07-23 | reviews/p03-code-review-2026-07-23.md |
| p04    | code     | pending | -    | -        |
| final  | code     | pending | -    | -        |
| plan   | artifact | passed  | 2026-07-23 | reviews/plan-gate-2026-07-23.md |
| spec   | artifact | pending | -    | -        |
| design | artifact | pending | -    | -        |

**Status values:** `pending` → `received` → `fixes_added` → `fixes_completed` → `passed`

## Implementation Complete

- [ ] 4/4 phases, 4/4 tasks complete
- [ ] Every source plan's `## Done criteria` confirmed (recorded in `implementation.md`)
- [ ] **Serialized backlog bookkeeping** (after all merges): `oat backlog archive`
      with real summaries for BL-260718-harden-consensus-wrapper,
      BL-260718-cache-transcript, BL-260718-derive-bump-version-skill-list,
      BL-260718-guard-generated-ignore-lists — one commit
- [ ] Orchestration-log end-of-run synthesis; roll-up into `summary.md` before
      any archive step
- [ ] Full DoD gates green on the integration branch

## References

- Source plans: the 4 files named above
- Program artifact: `.oat/repo/reference/external-plans/2026-07-22-execution-program.md`
