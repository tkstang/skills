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

# Implementation Plan: wave-3-execution (Wave 3 external-plan wrapper)

> Execute this plan using `oat-project-implement` — groups per
> `oat_plan_parallel_groups`. Concurrency ceiling: 4 worktrees (2 used).

**Goal:** Execute the 2 Wave 3 external plans (consolidate-consensus-cli-helpers,
worktree-and-hook-tests) through the wave→project wrapper pattern.

**Architecture:** Thin wrapper. Each task's **entire and only implementation
contract** is its external plan under `.oat/repo/reference/external-plans/`.
Nothing in this file restates, narrows, or overrides a source plan.

**Commit Convention:** `{type}(p{NN}-t{NN}): {description}`.

**Wrapper execution contract (applies to every task):**

1. **Drift check first.** Run the source plan's `## Drift check` against current
   HEAD; a material mismatch per that plan's own definition is a STOP. The
   wave-boundary refresh below does not replace the in-worktree re-check.
   **Rule-1 addenda (pathspec EXTENSIONS, skill-sanctioned, non-narrowing):**
   - p01: also diff `plugins/consensus/ tests/consensus/ tests/tooling/ .oxfmtrc.json .oxlintrc.json`
   - p02: also diff `tests/tooling/`
2. **Execute the source plan's `## Implementation steps`** in order with each
   embedded Verify gate; honor its `## STOP conditions` verbatim.
3. **Confirm the source plan's `## Done criteria`**, then run the full DoD gates:
   `pnpm run premerge` then `pnpm run validate:skill-versions --base-ref main`
   (no bare `--` — pnpm 10 rejects it). Node >= 22; `pnpm install
   --frozen-lockfile` in a fresh worktree first. `set -o pipefail` on piped
   verifications. EQUIVALENT-INVOCATION NOTE (non-narrowing): where a source
   plan writes scoped tests as `pnpm test -- <path>`, use the mechanically
   equivalent `npx vitest run <path>` — the literal `-- ` form fails on this
   repo's pnpm 10 (wave-1 evidence); same binary, same scope, additive only.
4. **STOP → BLOCKED at phase level.** A source-plan STOP parks the phase;
   the sibling continues.
5. **Group-dependency rule:** one group of two write-disjoint lanes
   (recon-verified empty intersection); wave terminal when both merged/parked.
6. **Merge serialization:** p01 then p02, rebasing on the updated tip first.
   No shared files — defensive only.
7. **Backlog archival is NOT part of any task** — once, serialized, after merges.
8. **Phase review checklist = the source plan's `## Review focus`.**
9. **Artifact hygiene:** `pnpm exec oxfmt --write <specific-file>` on markdown
   you write (repo ignore rules govern; never AGENTS.md/generated files).
   Workers report observations; the root appends to `orchestration-log.md`.
10. **Commit verification after ambiguous results:** inspect `git log` first.
11. **Codex fallback:** if `codex exec -o <file>` completes without flushing the
    file, transcribe the verdict verbatim from the session rollout; if it died
    silently, report to the orchestrator. MAX TWO codex rounds per lane; further
    fix verification belongs to the phase reviewer.

## Parallelism

One group: `['p01', 'p02']` — write surfaces disjoint (consensus family + build
mapping vs scripts/worktree + tools/git-hooks + tooling tests; `comm -12`
intersection empty per recon).

> The recon observations below are **non-authoritative grouping evidence only** —
> each source plan's own live checks govern at execution time.

## Dispatch Profile

_No per-phase overrides. Runtime selection applies, capped by the project's
dispatch policy in `state.md`. Cross-model review embedded in p01 (high
blast-radius behavior-preserving refactor)._

## Drift Refresh Record (2026-07-23, vs `17e24ee7f1feb817aed2427624134928a3a3b0ee`)

Non-authoritative recon evidence — 1 PASS / 1 MINOR-DRIFT / 0 STOP:

- **consolidate-consensus-cli-helpers:** MINOR-DRIFT, premise CONFIRMED live:
  the named helpers are byte-identical across create/decide/plan/evaluate (and
  the applicable subset in panel); zero W1/W2 diff in those five modules. The
  drifted `parsePositiveInteger`/`parsePeers` moved to consensus-loop.ts
  ~775-798 (was 725-746). NEW HAZARD (non-narrowing addendum): W1 added a
  loop-internal 2-arg `atomicWriteFile` — same NAME, different signature and
  semantics than the commands' exported 3-arg `confineWrite`/`atomicWriteFile`;
  step 3 must treat them as distinct helpers (rename or keep separate — never
  silently merge). MATERIAL SIMPLIFICATION (non-narrowing): W2 removed all
  hand-written importRewrites — the new shared module needs only a
  `generatedOutputs` entry (rewrites auto-derive); `.oxfmtrc.json`/`.oxlintrc.json`
  ignorePatterns remain manual but are guarded by the pre-existing sync test.
  Skill-bump set (recon-derived, matches the plan's own conventions):
  create/decide/plan/evaluate/panel (direct) + refine (transitive via
  consensus-loop.mjs if consensus-loop.ts changes; panel is NOT a
  consensus-loop.js importer).
- **worktree-and-hook-tests:** PASS — validate.sh/init.sh/hooks byte-unchanged
  since authoring; string-match test premise intact; the GIT_* env-scrub pattern
  to follow is `gitEnv()` in `tests/release/skill-version-bumps.test.ts`.

---

## Phase p01: consolidate-consensus-cli-helpers (group 1)

**Milestone:** the source plan's `## Done criteria` fully satisfied.

### Task p01-t01: Execute external plan — Consolidate duplicated consensus CLI helpers

**Source plan (the contract):**
`.oat/repo/reference/external-plans/2026-07-17-consolidate-consensus-cli-helpers.md`

**Ordering:** group 1; own worktree, parallel with p02. Merges first (plan order).

**Step 1: Drift check** — per the source plan, plus rule-1 addendum.

**Step 2: Execute** the source plan in full.

**Step 3: Verify (wrapper gate)** — source plan `## Done criteria`, then full DoD
gates. Expected: all green.

**Step 4: Cross-model review** — high blast-radius refactor: independent
cross-model review of the diff; checklist = the source plan's complete
`## Review focus`; disposition every finding in the phase report.

**Step 5: Commit** — e.g. `refactor(p01-t01): extract shared consensus cli helpers`.

---

## Phase p02: worktree-and-hook-tests (group 1)

**Milestone:** the source plan's `## Done criteria` fully satisfied.

### Task p02-t01: Execute external plan — Execute worktree scripts and git hooks in tests

**Source plan (the contract):**
`.oat/repo/reference/external-plans/2026-07-17-worktree-and-hook-tests.md`

**Ordering:** group 1; own worktree, parallel with p01. Merges second.

**Step 1: Drift check** — per the source plan, plus rule-1 addendum.

**Step 2: Execute** the source plan in full.

**Step 3: Verify (wrapper gate)** — source plan `## Done criteria`, then full DoD
gates. Expected: all green.

**Step 4: Commit** — e.g. `test(p02-t01): execute worktree and hook scripts`.

---

## Reviews

| Scope  | Type     | Status  | Date | Artifact |
| ------ | -------- | ------- | ---- | -------- |
| p01    | code     | pending | -    | -        |
| p02    | code     | passed  | 2026-07-23 | reviews/p02-code-review-2026-07-23.md |
| final  | code     | pending | -    | -        |
| plan   | artifact | passed  | 2026-07-23 | reviews/plan-gate-2026-07-23.md |
| spec   | artifact | pending | -    | -        |
| design | artifact | pending | -    | -        |

**Status values:** `pending` → `received` → `fixes_added` → `fixes_completed` → `passed`

## Implementation Complete

- [ ] 2/2 phases, 2/2 tasks complete
- [ ] Every source plan's `## Done criteria` confirmed (recorded in `implementation.md`)
- [ ] **Serialized backlog bookkeeping** (after merges): `oat backlog archive`
      with real summaries for BL-260718-consolidate-duplicated,
      BL-260718-execute-worktree-scripts — one commit
- [ ] Orchestration-log end-of-run synthesis; roll-up into `summary.md` before
      any archive step
- [ ] Full DoD gates green on the integration branch

## References

- Source plans: the 2 files named above
- Program artifact: `.oat/repo/reference/external-plans/2026-07-22-execution-program.md`
