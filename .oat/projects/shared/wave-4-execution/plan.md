---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-07-23
oat_phase: plan
oat_phase_status: complete
oat_plan_hill_phases: ['p03']
oat_auto_review_at_hill_checkpoints: true
oat_plan_parallel_groups: [['p02', 'p03']]
oat_plan_source: quick
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
oat_template: false
---

# Implementation Plan: wave-4-execution (Wave 4 external-plan wrapper)

> Execute this plan using `oat-project-implement`. p01 is UNGROUPED and executes
> (and merges) first; group `['p02', 'p03']` follows on the post-p01 tip.
> Concurrency ceiling: 4 (2 used in the group).

**Goal:** Execute the 3 Wave 4 external plans (supply-chain-ci-hardening,
docs-pr-ci-gate, live-provider-e2e-visibility) through the wave→project
wrapper pattern.

**Architecture:** Thin wrapper. Each task's **entire and only implementation
contract** is its external plan under `.oat/repo/reference/external-plans/`.
Nothing here restates, narrows, or overrides a source plan.

**Commit Convention:** `{type}(p{NN}-t{NN}): {description}`.

**Wrapper execution contract (applies to every task):**

1. **Drift check first.** Source plan's `## Drift check` against current HEAD;
   material mismatch per that plan = STOP.
   **Rule-1 addenda (extensions, skill-sanctioned):**
   - p03: also diff `AGENTS.md` (its in-scope Verification-section edit is
     outside its own pathspec).
2. **Execute the source plan's steps** with embedded Verify gates; STOP
   conditions verbatim.
3. **DoD after Done criteria:** `pnpm run premerge` then
   `pnpm run validate:skill-versions --base-ref main` (no bare `--`).
   `set -o pipefail`. EQUIVALENT-INVOCATION (non-narrowing): `npx vitest run
   <path>` replaces any literal `pnpm test -- <path>` (fails on pnpm 10).
4. **STOP → BLOCKED at phase level;** siblings continue.
5. **Group-dependency rule:** p01 (ungrouped) is terminal-and-MERGED before
   group `['p02','p03']` dispatches — its SHA-pin style is an input to their
   new workflow files.
6. **Merge serialization:** p01 first (alone); then p02 → p03, rebasing each on
   the updated tip. Sequenced shared file: `RELEASING.md` `## Checklist` list
   (p01 adds the checksum-publish line; p03 adds run-or-waive — p03 inserts
   relative to p01's landed line).
7. **Backlog archival NOT part of any task** — once, serialized, after merges.
8. **Phase review checklist = the source plan's `## Review focus`.**
9. **Artifact hygiene:** `pnpm exec oxfmt --write <specific-file>` on markdown
   you write (never AGENTS.md/generated files). Workers report; root appends.
10. **Commit verification after ambiguous results** via `git log`.
11. **Codex fallback + MAX TWO rounds** (waves 1-3 adopted rules).

## Planning Checklist

- [x] Phases decomposed from the program's wave map (3 lanes, pointer-only tasks)
- [x] Parallelism evaluated: p01 deliberately UNGROUPED (style-input dependency
      for the group's new workflow files); only `[['p02','p03']]` grouped
      (mutually write-disjoint per recon)
- [x] HiLL checkpoint at p03 (final phase) — satisfied per standing operator
      directive at execution time; `oat_auto_review_at_hill_checkpoints` on
- [x] Drift refresh recorded below; rule-1 addendum for p03's AGENTS.md gap
- [x] Reviews table covers every phase + final + artifacts

## Parallelism

p01 ungrouped-first (all three existing workflow files + install.sh +
dependabot.yml + RELEASING.md). Group `['p02','p03']`: p02 = one new file
(docs-ci.yml); p03 = live-e2e.yml + package.json + RELEASING.md + AGENTS.md +
the e2e test — mutually disjoint (recon-verified).

> Recon observations are non-authoritative grouping evidence only.

## Dispatch Profile

_No per-phase overrides; managed policy per state.md. Cross-model review
embedded in p01 (supply-chain/workflow surface — security class)._

## Drift Refresh Record (2026-07-23, vs `f701e960cb7edd793eab24b41d591f8dd1fa6408`)

3 PASS / 0 MINOR-DRIFT / 0 STOP. Highlights:

- **supply-chain:** all `uses:` still tag-pinned; only deploy-docs has
  concurrency; dependabot.yml absent; the W3-kept CI-workflow string test
  asserts COMMAND strings, not `uses:` lines — SHA-pinning will NOT break it
  (plan step-4 concern discharged by recon).
- **docs-pr-ci-gate:** triggers unchanged; docs scripts confirmed
  (`build` = next build with prebuild fumadocs-mdx + index-gen;
  `docs:format:check`).
- **live-e2e:** gating unchanged; CONFIRMED silent-skip when env set but no
  provider ready (the exact gap step 2 tightens — treat the e2e test file as an
  expected write surface, not conditional). RELEASING.md already carries a
  manual live-gate reference at lines 13-15; the new checklist line is additive
  beside it. AGENTS.md Verification section unchanged.

---

## Phase p01: supply-chain-ci-hardening (UNGROUPED — first)

**Milestone:** the source plan's `## Done criteria` fully satisfied.

### Task p01-t01: Execute external plan — Harden install and CI supply-chain posture

**Source plan (the contract):**
`.oat/repo/reference/external-plans/2026-07-17-supply-chain-ci-hardening.md`

**Ordering:** ungrouped; executes and MERGES before the group dispatches.

**Step 1: Drift check** — per the source plan.

**Step 2: Execute** the source plan in full.

**Step 3: Verify (wrapper gate)** — Done criteria, then full DoD. Expected: green.

**Step 4: Cross-model review** — supply-chain/security surface: independent
cross-model review; checklist = the source plan's complete `## Review focus`;
disposition every finding.

**Step 5: Commit** — e.g. `ci(p01-t01): pin actions to commit SHAs`.

---

## Phase p02: docs-pr-ci-gate (group 1)

**Milestone:** the source plan's `## Done criteria` fully satisfied.

### Task p02-t01: Execute external plan — Add a PR-time CI gate for the documentation site

**Source plan (the contract):**
`.oat/repo/reference/external-plans/2026-07-17-docs-pr-ci-gate.md`

**Ordering:** group 1; parallel with p03; based on the post-p01 tip (adopt its
pin style).

**Step 1: Drift check** — per the source plan.

**Step 2: Execute** the source plan in full.

**Step 3: Verify (wrapper gate)** — Done criteria, then full DoD. Expected: green.

**Step 4: Commit** — e.g. `ci(p02-t01): build documentation on PRs`.

---

## Phase p03: live-provider-e2e-visibility (group 1)

**Milestone:** the source plan's `## Done criteria` fully satisfied.

### Task p03-t01: Execute external plan — Surface the live-provider E2E gate

**Source plan (the contract):**
`.oat/repo/reference/external-plans/2026-07-17-live-provider-e2e-visibility.md`

**Ordering:** group 1; parallel with p02; based on the post-p01 tip. Merges
after p02 (plan order); inserts its RELEASING.md line relative to p01's.

**Step 1: Drift check** — per the source plan, plus the rule-1 AGENTS.md addendum.

**Step 2: Execute** the source plan in full.

**Step 3: Verify (wrapper gate)** — Done criteria, then full DoD. Expected: green.

**Step 4: Commit** — e.g. `ci(p03-t01): surface the live provider gate`.

---

## Reviews

| Scope  | Type     | Status  | Date | Artifact |
| ------ | -------- | ------- | ---- | -------- |
| p01    | code     | pending | -    | -        |
| p02    | code     | pending | -    | -        |
| p03    | code     | pending | -    | -        |
| final  | code     | pending | -    | -        |
| plan   | artifact | passed  | 2026-07-23 | reviews/plan-gate-2026-07-23.md |
| spec   | artifact | pending | -    | -        |
| design | artifact | pending | -    | -        |

**Status values:** `pending` → `received` → `fixes_added` → `fixes_completed` → `passed`

## Implementation Complete

- [ ] 3/3 phases, 3/3 tasks complete
- [ ] Every source plan's `## Done criteria` confirmed (in `implementation.md`)
- [ ] **Serialized backlog bookkeeping** (after merges): `oat backlog archive`
      for BL-260718-harden-install-and-ci-supply, BL-260718-add-pr-time-ci-gate,
      BL-260718-surface-the-live-provider-e2e — one commit
- [ ] Orchestration-log synthesis; roll-up into `summary.md` before any archive
- [ ] Full DoD gates green on the integration branch

## References

- Source plans: the 3 files named above
- Program artifact: `.oat/repo/reference/external-plans/2026-07-22-execution-program.md`
