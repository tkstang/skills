---
oat_generated: true
oat_external_plan_index: false
oat_execution_program: true
oat_program_supersedes: null
oat_program_indexes:
  - '.oat/repo/reference/external-plans/2026-07-17-repo-audit-plan-index.md'
created: '2026-07-22T00:00:00Z'
---

# Execution Program: 2026-07-22 (repo-audit corpus, 15 plans)

This artifact is the durable program map for the external-plan corpus listed in
`oat_program_indexes`. It records wave composition and status. It is not an
executable plan and is not an `oat-project-import-plan` target — each wave runs
as a wrapper OAT project via `oat-wave-execute`, and each plan's implementation
contract remains its immutable plan file.

## Status Ledger

| Wave | Theme                        | Lanes | Status   | Record |
| ---- | ---------------------------- | ----- | -------- | ------ |
| W1   | Correctness & security core  | 4     | merged   | PR [#50](https://github.com/tkstang/skills/pull/50) · merge 7db7d0f · completion record `.oat/repo/reference/project-summaries/20260723-wave-1-execution.md` · recap: deferred to program close · completion tail: done (per-wave full tail) |
| W2   | Hardening & contract guards  | 4     | merged   | PR [#51](https://github.com/tkstang/skills/pull/51) · merge 79bf70e · completion record `.oat/repo/reference/project-summaries/20260723-wave-2-execution.md` · recap: deferred to program close · completion tail: done (per-wave full tail) |
| W3   | Consolidation & tooling nets | 2     | merged   | PR [#52](https://github.com/tkstang/skills/pull/52) · merge e100795 · completion record `.oat/repo/reference/project-summaries/20260723-wave-3-execution.md` · recap: deferred to program close · completion tail: done (per-wave full tail) |
| W4   | CI & release surface         | 3     | merged   | PR [#53](https://github.com/tkstang/skills/pull/53) · merge bb1e5ee · completion record `.oat/repo/reference/project-summaries/20260723-wave-4-execution.md` · recap: deferred to program close · completion tail: done (per-wave full tail) |
| W5   | God-module splits            | 2     | merged   | PR [#59](https://github.com/tkstang/skills/pull/59) · merge 10c7b9e9 · completion record `.oat/repo/reference/project-summaries/20260723-wave-5-execution.md` · recap: superseded by program recap (below) · completion tail: done (per-wave full tail) |

## Wave Table (coverage: 15 plans = 15 index rows; verified 2026-07-22)

| Plan                                                                                 | Index                              | Wave | Ordering notes                                                                    | Status  |
| ------------------------------------------------------------------------------------ | ---------------------------------- | ---- | --------------------------------------------------------------------------------- | ------- |
| [Atomic consensus records writes](./2026-07-17-atomic-consensus-records-writes.md)    | 2026-07-17-repo-audit-plan-index   | W1   | consensus-loop chain link 1                                                       | done |
| [Cross-provider recursion guard](./2026-07-17-cross-provider-recursion-guard.md)      | 2026-07-17-repo-audit-plan-index   | W1   | independent (provider-cli subsystem)                                              | done |
| [Session-observer state robustness](./2026-07-17-session-observer-state-robustness.md) | 2026-07-17-repo-audit-plan-index | W1   | observer-lib chain link 1                                                         | done |
| [Docs staleness sweep](./2026-07-17-docs-staleness-sweep.md)                          | 2026-07-17-repo-audit-plan-index   | W1   | independent; only W1 lane touching AGENTS.md/CHANGELOG                            | done |
| [Consensus subprocess hardening](./2026-07-17-consensus-subprocess-hardening.md)      | 2026-07-17-repo-audit-plan-index   | W2   | hard: after W1 atomic records (same file)                                         | done |
| [Watch-loop classification cache](./2026-07-17-watch-loop-classification-cache.md)    | 2026-07-17-repo-audit-plan-index   | W2   | hard: after W1 observer state (same lib)                                          | done |
| [SKILL_FILES disk derivation](./2026-07-17-skill-files-disk-derivation.md)            | 2026-07-17-repo-audit-plan-index   | W2   | soft: AGENTS.md overlap with ignore-lists lane — merge sequentially               | done |
| [Derive generated ignore lists](./2026-07-17-derive-generated-ignore-lists.md)        | 2026-07-17-repo-audit-plan-index   | W2   | before W3 consolidation (guard protects its new outputs); AGENTS.md soft overlap  | done |
| [Consolidate consensus CLI helpers](./2026-07-17-consolidate-consensus-cli-helpers.md) | 2026-07-17-repo-audit-plan-index | W3   | hard: after W2 subprocess hardening; benefits from W2 ignore-lists guard          | done |
| [Worktree and hook tests](./2026-07-17-worktree-and-hook-tests.md)                    | 2026-07-17-repo-audit-plan-index   | W3   | independent                                                                       | done |
| [Supply-chain/CI hardening](./2026-07-17-supply-chain-ci-hardening.md)                | 2026-07-17-repo-audit-plan-index   | W4   | merge-first in W4 (sets action-pin style; RELEASING.md overlap with live-E2E)     | done |
| [Docs PR CI gate](./2026-07-17-docs-pr-ci-gate.md)                                    | 2026-07-17-repo-audit-plan-index   | W4   | after supply-chain merge (adopt pin style)                                        | done |
| [Live-provider E2E visibility](./2026-07-17-live-provider-e2e-visibility.md)          | 2026-07-17-repo-audit-plan-index   | W4   | after supply-chain merge (pin style + RELEASING.md rebase)                        | done |
| [Split consensus-loop module](./2026-07-18-split-consensus-loop-module.md)            | 2026-07-17-repo-audit-plan-index   | W5   | hard: after W3 consolidation; parallel with refine split                          | done |
| [Split consensus-refine module](./2026-07-18-split-consensus-refine-module.md)        | 2026-07-17-repo-audit-plan-index   | W5   | hard: after W3 consolidation; parallel with loop split                            | done |

No rows are deferred or dropped; all 15 plans are scheduled.

## Wave 1: Correctness & security core

- **Lanes:** atomic-consensus-records-writes, cross-provider-recursion-guard, session-observer-state-robustness, docs-staleness-sweep
- **Intra-wave ordering:** fully write-disjoint (consensus-loop.ts / provider-cli / session-observer lib / top-level docs); any merge order. Docs sweep merges trivially whenever ready.
- **Cross-wave prerequisites:** none inbound. Unblocks W2's subprocess-hardening (consensus-loop.ts) and watch-cache (observer lib) lanes.
- **Composition rationale:** the audit's recommended top-5 minus subprocess hardening (chained behind atomic records in the same file). Four verified HIGH-confidence fixes with the highest leverage; docs sweep added here because W1 is the only wave where its AGENTS.md/CHANGELOG edits collide with nothing.

**W1 merged (2026-07-23, PR #50)** → W2 unblocked: subprocess-hardening (consensus-loop.ts chain link) and watch-cache (observer lib chain link) prerequisites satisfied.

## Wave 2: Hardening & contract guards

- **Lanes:** consensus-subprocess-hardening, watch-loop-classification-cache, skill-files-disk-derivation, derive-generated-ignore-lists
- **Intra-wave ordering:** subprocess-hardening and watch-cache are independent of each other and of the two guard lanes. SKILL_FILES-derivation and ignore-lists-derivation both edit an AGENTS.md sentence (different sections) — merge sequentially in either order; the second rebases trivially.
- **Cross-wave prerequisites:** subprocess-hardening requires W1 atomic-records merged; watch-cache requires W1 observer-state merged. The ignore-lists guard must land before W3 consolidation adds new generated outputs (index note: the guard then protects that change too).
- **Composition rationale:** continues both serial chains at full width while landing the two release/build-contract guards whose presence de-risks everything later in the program.

**W2 merged (2026-07-23, PR #51)** → W3 unblocked: consolidation prerequisites (subprocess hardening merged; ignore-lists guard + derived rewrites active) satisfied.

## Wave 3: Consolidation & tooling nets

- **Lanes:** consolidate-consensus-cli-helpers, worktree-and-hook-tests
- **Intra-wave ordering:** independent; consolidation is the heavyweight lane (five command modules + consensus-loop.ts + build mappings), worktree/hook tests touch only scripts/worktree, tools/git-hooks, and tests.
- **Cross-wave prerequisites:** consolidation requires W2 subprocess-hardening merged (same file) and benefits from W2's ignore-lists guard. Unblocks both W5 splits (hard prerequisite for both).
- **Composition rationale:** deliberately narrow — consolidation reconciles the drifted `parsePeers` semantics and churns six files at once; pairing it only with a fully disjoint test-infrastructure lane keeps merge risk low before the splits.

**W3 merged (2026-07-23, PR #52)** → W4 unblocked (no hard prerequisites); W5 hard prerequisite (consolidation) now satisfied.

## Wave 4: CI & release surface

- **Lanes:** supply-chain-ci-hardening, docs-pr-ci-gate, live-provider-e2e-visibility
- **Intra-wave ordering:** supply-chain merges FIRST — it sets the action-pin style the other two adopt, and it shares RELEASING.md with live-E2E. Docs-CI gate and live-E2E are mutually disjoint (new workflow files) and merge in either order after it.
- **Cross-wave prerequisites:** none hard; scheduled after the code waves so workflow changes don't churn under active CI-heavy merging. Independent of W5.
- **Composition rationale:** groups every `.github/workflows/` + release-process surface into one wave with an explicit merge-first rule, converting three soft file conflicts into a sequence instead of rebase noise.

**W4 merged (2026-07-23, PR #53)** → W5 is the final pending wave; both hard prerequisites (W3 consolidation) and soft prerequisites (W2 derived rewrites) satisfied.

## Wave 5: God-module splits

- **Lanes:** split-consensus-loop-module, split-consensus-refine-module
- **Intra-wave ordering:** independent of each other (different files); parallel worktrees explicitly supported by both plans. Each is internally serial (one green commit per extracted cluster).
- **Cross-wave prerequisites:** hard on W3 consolidation (both split inventories shrink and both files churn there); soft on W2 ignore-lists/import-rewrite derivation (removes hand-written rewrite tedium for every new module). Final wave; unblocks nothing — it is the program's cleanup payoff.
- **Composition rationale:** last by design per the index's downgrade decision — largest diffs, zero behavior change, safest when every behavioral fix in the same files has already merged. Fresh line-anchor inventories are mandated by both plans' drift checks, absorbing all earlier-wave churn.

## Program Completion (2026-07-23)

All five waves merged (PRs #50, #51, #52, #53, #59); all 15 plan rows `done`;
coverage invariant holds terminally (15/15, none deferred/dropped).

- **Completion-tail checkpoint disposition:** the standing operator directive
  (2026-07-23) ordered the full `oat-project-complete` process per wave; every
  wave wrapper ran the complete tail at its own closeout (complete-state →
  archive + S3 sync → summary export → pointer clear → bookkeeping commit).
  Nothing was deferred to program close — the checkpoint's question has no
  outstanding action and is recorded as satisfied-by-per-wave-execution.
- **Process disclosures:** wave-3's PR was merged while its checks report was
  empty (tree certified retroactively via main's green Validate run on the
  identical commit; poll-until-registered rule adopted and used for waves 4-5).
  During wave-5 merge, `gh pr merge 54` (a mistyped PR number) merged
  Dependabot's deploy-pages 4.0.5→5.0.0 bump ahead of schedule — benign
  (CI-green pin update via the wave-4-installed automation), left in place,
  disclosed.
- **Standing constraint:** the operator-mandated `sol` review model was
  unavailable on this Codex account for every final gate; the account-default
  Codex model at xhigh effort substituted, flagged per wave.
- **Program recap:** AUTHORED — `.oat/repo/explainers/repo-audit-program-recap/recap.md`,
  LLM-authored (Opus-class subagent) from a 12-claim synthesized fact base with
  per-section claim traceability; three fact-base synthesis errors were caught
  by the author's discrepancy check and corrected before finalization. The
  explainer-kit unattended build was NOT run: the installed kit rejects
  `authorModulePath` (`E_INPUT_SCHEMA: Unknown property`) — the authoring seam
  has not shipped in this install, and an unattended run without it emits raw
  artifact text as prose (the documented failure mode). Disposition per the
  optional-step rule: content authored via the caller-owned path (the
  author module is staged beside the recap for a future kit run); no manifest
  runId exists. Publishing remains human-gated and was not invoked.
