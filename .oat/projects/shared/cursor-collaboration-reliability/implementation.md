---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-07-24
oat_current_task_id: null
oat_generated: false
---

# Implementation: cursor-collaboration-reliability

**Started:** 2026-07-17
**Last Updated:** 2026-07-24

> This document is used to resume interrupted implementation sessions.
>
> Conventions:
>
> - `oat_current_task_id` always points at the **next plan task to do** (not the last completed task).
> - When all plan tasks are complete, set `oat_current_task_id: null`.
> - Reviews are **not** plan tasks. Track review status in `plan.md` under `## Reviews` (e.g., `| final | code | passed | ... |`).
> - Keep phase/task statuses consistent with the Progress Overview table so restarts resume correctly.
> - Before running the `oat-project-pr-final` skill, ensure `## Final Summary (for PR/docs)` is filled with what was actually implemented.

## Progress Overview

| Phase   | Status      | Tasks | Completed |
| ------- | ----------- | ----- | --------- |
| Phase 1 | complete    | 5     | 5/5       |
| Phase 2 | complete    | 8     | 8/8       |
| Phase 3 | complete    | 7     | 7/7       |
| Phase 4 | complete    | 6     | 6/6       |
| Phase 5 | complete    | 6     | 6/6       |
| Phase 6 | complete    | 4     | 4/4       |
| Phase 7 | complete    | 4     | 4/4       |
| Phase 8 | complete    | 18    | 18/18     |

**Total:** 58/58 tasks accepted

---

## Phase 1: Streaming Cursor Transcript Foundation

**Status:** complete
**Completed:** 2026-07-22

### Phase Summary

**Outcome:**

- Added a streaming physical-frame reader with exact byte boundaries, prefix
  snapshots, structural blockers, and bounded segment materialization.
- Added structural Cursor turn analysis with ordered content, lifecycle,
  recovery pointers, exact identity scoping, and mixed control/human handling.
- Promoted shared control classifiers while preserving the existing
  terminal-only Cursor normalization used by Export Session Transcript.
- Generated and verified matching runtime modules for Session Observer and
  Export Session Transcript.

**Key files touched:**

- `src/transcript/core/cursor-frames.ts` — bounded streaming frame scanner.
- `src/transcript/core/cursor-analysis.ts` — structural turn accumulator.
- `src/transcript/core/runtimes.ts` — shared control-classification seam.
- `scripts/build-generated.mjs` — generated mappings for both runtime trees.
- `tests/transcript-core/` — framed fixtures and scanner/analyzer regressions.

**Verification:**

- Focused Phase 1 re-review matrix: 137 tests passed.
- Full suite: 1,148 passed and 1 skipped.
- Type-check, generated-output synchronization, validation, smoke, lint, and
  formatting passed.

**Notes / Decisions:**

- The repository's generated-output invariant required exact
  `.oxfmtrc.json`/`.oxlintrc.json` entries for the four new generated modules.
  Root authorized those bounded file-boundary adaptations in p01-t02 and
  p01-t04.
- `framed-blank-lines.jsonl` intentionally ends with a blank physical frame;
  its contract test asserts that shape even though full-range
  `git diff --check` reports the trailing blank line.
- The first phase review found quadratic cross-chunk copying and mixed
  control/human misclassification. Both were fixed in `0b16bef` and the fresh
  re-review passed with no findings.

### Task Outcomes

| Task    | Status   | Commit    | Outcome |
| ------- | -------- | --------- | ------- |
| p01-t01 | complete | `8aaafa6` | Recorded the sanitized baseline and physical-frame fixture contract. |
| p01-t02 | complete | `5386b97` | Added the streaming frame reader and generated outputs. |
| p01-t03 | complete | `05c5d31` | Exposed shared Cursor control classifiers. |
| p01-t04 | complete | `c72db9d` | Added the structural Cursor turn analyzer and generated outputs. |
| p01-t05 | complete | `9417b8d` | Verified generated runtime and Export compatibility. |

**Review fix:** `0b16bef` (`fix(p01): address phase review findings`)

### Task p01-t01: Record the measured baseline and fixture contract

**Status:** completed
**Commit:** `8aaafa6`
**Verification:** 13 fixture-contract tests passed.

### Task p01-t02: Implement the streaming Cursor frame reader

**Status:** completed
**Commit:** `5386b97`
**Verification:** Frame-reader, generated-output, type, and build checks passed.

### Task p01-t03: Establish the shared control-classification seam

**Status:** completed
**Commit:** `05c5d31`
**Verification:** Runtime classifier tests and generated-output checks passed.

### Task p01-t04: Implement the Cursor turn analyzer

**Status:** completed
**Commit:** `c72db9d`
**Verification:** Analyzer, runtime, type, and generated-output checks passed.

### Task p01-t05: Verify combined runtime and Export compatibility

**Status:** completed
**Commit:** `9417b8d`
**Verification:** Generated mapping, runtime, Export, type, and build checks passed.

---

## Phase 2: Exact Identity, Continuity, and Cursor State v2

**Status:** complete
**Completed:** 2026-07-23

### Phase Summary

**Outcome:**

- Implemented exact Cursor transcript identity, isolated Cursor state v2,
  recoverable legacy migration, transcript continuity checks, and delivery
  reservation/CAS primitives.
- Preserved pre-integration compatibility and completed two bounded review-fix
  iterations.
- The terminal operator-authorized recovery review was received with 0
  Critical, 2 Important, 1 Medium, and 0 Minor findings. Those findings are
  were implemented as `p02-t06` through `p02-t08`; the authorized
  fix-task-scoped re-review passed with no findings. Phase 3 is next.

**Task outcomes:**

| Task    | Status   | Commit    | Outcome |
| ------- | -------- | --------- | ------- |
| p02-t01 | complete | `471dd5e` | Added canonical exact identity; the remaining ancestor-alias gap is isolated in review task p02-t07. |
| p02-t02 | complete | `c373341` | Added the isolated Cursor state v2 store. |
| p02-t03 | complete | `471dd5e` | Added migration and acquired-lock recovery; the remaining publication-boundary gap is isolated in review task p02-t06. |
| p02-t04 | complete | `decf5a5` | Added transcript continuity enforcement and repair classification. |
| p02-t05 | complete | `471dd5e` | Stability and delivery CAS are implemented; create-only initialization and operator-facing recovery passed re-review. |
| p02-t06 | complete | `e1d1a31` | Atomically publishes complete contender tokens and covers publication crash/error boundaries across all three queues. |
| p02-t07 | complete | `e08e867` | Keeps raw cwd spellings distinct from canonical identity diagnostic-only, including ancestor-component symlinks. |
| p02-t08 | complete | `45835d9` | Aligns shipped Cursor v2 reset/corruption recovery guidance and bumps Session Observer to 1.0.8. |

**Additional implementation/fix commits:**

- `f058f30` — preserved pre-integration compatibility.
- `e4c50fe` — resolved the first Phase 2 review findings.
- `ce73f80` — resolved the second Phase 2 review findings.
- `471dd5e` — resolved all four findings retained by the final blocked review
  after the operator-authorized `origin/main` integration.

### Task p02-t01: Resolve exact Cursor identity

**Status:** completed
**Commit:** `471dd5e`
**Review follow-up:** `p02-t07`

### Task p02-t02: Add the isolated Cursor state v2 store

**Status:** completed
**Commit:** `c373341`

### Task p02-t03: Make legacy Cursor state migration recoverable

**Status:** completed
**Commit:** `471dd5e`
**Recovery fix:** `471dd5e`
**Review follow-up:** `p02-t06`

### Task p02-t04: Enforce transcript continuity

**Status:** completed
**Commit:** `decf5a5`

### Task p02-t05: Add stability checkpoints and delivery CAS

**Status:** completed
**Commit:** `471dd5e`
**Recovery fix:** `471dd5e`

### Task p02-t06: Publish lock contenders atomically

**Status:** completed
**Commit:** `e1d1a31`
**Source:** `I1` from
`reviews/archived/p02-review-2026-07-23T114732Z.md`
**Verification:** 106 focused tests, type-check, lint/format, build, and
generated-output synchronization passed.

### Task p02-t07: Keep ancestor cwd aliases diagnostic-only

**Status:** completed
**Commit:** `e08e867`
**Source:** `I2` from
`reviews/archived/p02-review-2026-07-23T114732Z.md`
**Verification:** 40 focused tests, type-check, build, generated-output
synchronization, lint/format, and diff checks passed.

### Task p02-t08: Align Cursor v2 recovery guidance

**Status:** completed
**Commit:** `45835d9`
**Source:** `M1` from
`reviews/archived/p02-review-2026-07-23T114732Z.md`
**Verification:** Repository validation, formatting, diff checks, release-tool
coverage, and Session Observer version synchronization passed. The
origin/main-wide version gate remains blocked only by unrelated pre-existing
changes to `export-session-transcript` and `session-observer-collab`; the
task-scoped gate is rerun against the p02-t08 base before re-review.

### Review Retry Limit Exhausted

**Final review artifact:**
`reviews/p02-review-2026-07-23T054702Z.md`

**Unresolved findings:**

- Important: stale-lock reclamation is ownership-unsafe across concurrent
  reclaimers and can steal a live legacy empty lock.
- Important: an unreserved Cursor state setter can rewind the checkpoint and
  replace canonical cwd/transcript identity.
- Medium: corrupt-store recovery exists as a low-level API but is not connected
  to the documented state/session command.
- Minor: raw symlink alias behavior needs design alignment or a narrower exact
  identity rule.

**Resume boundary:** Resolve or explicitly replan these findings, then run
`oat-project-implement`.

**Operator-authorized recovery (2026-07-23):** The operator authorized one
additional bounded Phase 2 repair and re-review cycle beyond the exhausted
automatic retry limit. Before repair, `origin/main` was merged at `aa35f45`;
the merge preserved the Phase 2 identity/state work, incorporated the upstream
Session Observer cache and stale-lock hardening, regenerated runtime outputs,
and passed the full integration gate. The round-3 review basis is now stale,
but its unresolved findings remain the bounded repair scope.

**Recovery fix:** `471dd5e` replaces lock takeover with exact-generation,
fail-closed queued ownership across all three stores; makes
`setCursorSession()` create-only; connects corrupt-store recovery to the
operator CLI; and narrows raw alias behavior to diagnostic-only. The repair
passed 197 focused tests and 1,310 full-suite tests with 1 skipped, plus
type-check, build synchronization, validation, smoke, lint, and format checks.
The fresh independent review completed and blocked on two newly confirmed
Important findings plus one Medium shipped-guidance gap.

**Terminal recovery review:**
`reviews/archived/p02-review-2026-07-23T114732Z.md`

- 0 Critical, 2 Important, 1 Medium, 0 Minor.
- Important: a crash during contender-token publication can permanently wedge
  all three state-lock queues.
- Important: ancestor-component symlink aliases can still promote a raw cwd
  variant to exact identity.
- Medium: shipped state-recovery guidance contradicts Cursor v2 behavior.
- The one operator-authorized recovery cycle is consumed; no additional
  implementation cycle is authorized in this invocation.

---

## Artifact Review History

### Plan Gate Blocked: Retry Limit Exhausted

**Date:** 2026-07-23
**Gate target:** `cursor-gpt-5-6-sol-max`
**Policy:** `block`, maximum 2 substantive attempts

**Attempt 1:**

- Artifact: `reviews/artifact-plan-review-2026-07-23T022120Z.md`
- Findings: 0 Critical, 5 Important, 2 Medium, 0 Minor
- Disposition: all findings were applied directly to `plan.md` and the
  requirement mapping; the bound review row is `fixes_completed`.
- Operational note: the gate emitted human-readable output without the
  required `receiveEligible` and `handoff` fields, so review-receive was not
  invoked.

**Attempt 2:**

- Artifact: `reviews/artifact-plan-review-2026-07-23T023750Z.md`
- Findings: 0 Critical, 1 Important, 1 Medium, 0 Minor
- Residual Important: p01-t01, p01-t03, p03-t01, and p03-t03 end at explicit
  RED verification boundaries, but every `oat-project-implement` task must
  finish with passing verification before its atomic commit.
- Residual Medium: p05-t05 and p06-t04 edit canonical `SKILL.md` files without
  an explicit file-scoped write-format command before provider sync.
- Operational note: this gate also omitted the structured receipt envelope.

**Blocker:** The configured retry limit is exhausted. Planning remains
`in_progress`; do not mark the plan implementation-ready until the operator
authorizes a further remediation/review cycle or changes the gate disposition.

**Operator-authorized recovery (2026-07-23):** After correcting the
user-scoped plan gate command on both Macs to emit JSON, the operator said to
proceed. The residual RED task-boundary and canonical-skill formatting fixes
were applied directly to `plan.md`; one fresh gate run is authorized as a new
operator recovery action rather than an automatic retry.

### Review Received: plan

**Date:** 2026-07-22
**Review artifact:** `reviews/archived/artifact-plan-review-2026-07-23T025554Z.md`

**Findings:**

- Critical: 0
- Important: 0
- Medium: 0
- Minor: 0

**Disposition:** The operator-authorized recovery gate passed. The review
confirmed that all prior findings were resolved and that the 33-task plan is
complete, internally consistent, and implementation-ready. No artifact edits or
plan tasks were required during receipt.

**Next:** Complete the planning lifecycle boundary and route to
`oat-project-implement`.

### Review Received: design

**Date:** 2026-07-20
**Review artifact:** `reviews/archived/artifact-design-review-2026-07-20T233233Z.md`

**Findings:**

- Critical: 0
- Important: 1
- Medium: 3
- Minor: 3

**Artifact dispositions:**

- `I1` — `resolve_in_artifact`: candidate stability now verifies only the raw
  prefix through the candidate boundary; later appends do not restart it.
- `M1` — `resolve_in_artifact`: one-shot and watch stability-wait behavior is
  explicit, bounded, and cursor-safe.
- `M2` — `resolve_in_artifact`: unavailable device/inode identity blocks
  stateful Cursor use fail-closed.
- `M3` — `resolve_in_artifact`: earlier substantive entries in a fresh
  completed turn receive recovery pointers.
- `m1` — `resolve_in_artifact`: continuity failure and legacy migration marker
  types are defined.
- `m2` — `resolve_in_artifact`: the turn accumulator receives exact identity
  evidence for entry-key scoping.
- `m3` — `resolve_in_artifact`: legacy receiver safety is grounded in advisory
  automatic-control provenance and producer-side lease CAS.

**Plan tasks added:** None; this was an artifact review and all findings were
resolved directly in `design.md`.

**Next:** Re-run the design artifact review or approve the revised design
before implementation planning.

---

## Orchestration Runs

_Each run from `oat-project-implement` appends an entry below with:_
_- Run header (number, timestamp, branch, tier, policy, phase counts)_
_- Phase Outcomes table_
_- Parallel Groups list_
_- Outstanding Items_

<!-- orchestration-runs-start -->

_Orchestration runs from `oat-project-implement` are appended here, most-recent-first within the file but append-only at the bottom of the log._

### Run 1 — Phase p01

**Anchor:** `run-1-phase-p01`
**Timestamp:** 2026-07-23T04:06:50Z
**Branch:** `cursor-collaboration-reliability`
**Tier:** Tier 1 — native Codex subagents
**Policy:** managed `high`
**Phase base:** `541e78f`
**Phase head:** `0b16bef`
**Outcome:** passed after one bounded fix iteration

| Phase | Tasks | Implementation | Root Review | Fix Iterations | Verdict |
| ----- | ----- | -------------- | ----------- | -------------- | ------- |
| p01   | 5/5   | `8aaafa6..9417b8d` | Round 2 passed | 1 (`0b16bef`) | passed |

**Implementation dispatch:**

- Request: `impl-p01-541e78f-20260723T032527Z`
- Target: `oat-phase-implementer-gpt-5-6-sol-high`
- Selection: `native-catalog`; candidates
  `oat-phase-implementer-gpt-5-6-sol-medium`,
  `oat-phase-implementer-gpt-5-6-sol-high`
- Dispatch: scope=p01 action=implementation role=implementer producer=unknown
  provenance=unknown model_axis=selected:gpt-5.6-sol
  effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high
  target=oat-phase-implementer-gpt-5-6-sol-high

**Review rounds:**

1. `reviews/p01-review-2026-07-23T035505Z.md` — blocked with 0 Critical,
   1 Important, 1 Medium, 0 Minor; reconnaissance not attempted.
2. Original implementer continuation
   `fix-p01-round1-9417b8d-20260723T040000Z` produced `0b16bef`.
3. `reviews/p01-review-2026-07-23T040650Z.md` — passed with zero findings;
   reconnaissance attempted and its complete orchestration evidence is
   retained in the artifact.

**Review dispatch:**

- Target: `oat-reviewer-gpt-5-6-sol-high`
- Selection: `native-catalog`
- Dispatch: scope=p01 action=review role=reviewer producer=unknown
  provenance=unknown model_axis=selected:gpt-5.6-sol
  effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high
  target=oat-reviewer-gpt-5-6-sol-high

**Optional nested implementation dispatches:** None.
**Worktree:** Root checkout; sequential plan.
**Outstanding items:** None.

### Run 2 — Phase p02

**Anchor:** `run-2-phase-p02`
**Timestamp:** 2026-07-23T05:49:24Z
**Branch:** `cursor-collaboration-reliability`
**Tier:** Tier 1 — native Codex subagents
**Policy:** managed `high`
**Phase base:** `eb19baf`
**Phase head:** `ce73f80`
**Outcome:** passed after operator-authorized review-fix recovery

| Phase | Tasks | Implementation | Root Review | Fix Iterations | Verdict |
| ----- | ----- | -------------- | ----------- | -------------- | ------- |
| p02   | 8/8 accepted | `baa0480..45835d9` plus compatibility/bookkeeping | Fix-task review passed | 4 review-fix cycles | passed |

**Implementation dispatch:**

- Request: `impl-p02-eb19baf-20260723T041200Z`
- Target: `oat-phase-implementer-gpt-5-6-sol-high`
- Dispatch: scope=p02 action=implementation role=implementer
  model_axis=selected:gpt-5.6-sol effort_axis=selected:high
  dispatch_policy=high target=oat-phase-implementer-gpt-5-6-sol-high

**Review rounds:**

1. `reviews/p02-review-2026-07-23T045715Z.md` — blocked with 0 Critical,
   2 Important, 2 Medium, 0 Minor.
2. Original implementer continuation produced `e4c50fe`.
3. `reviews/p02-review-2026-07-23T051820Z.md` — blocked with 0 Critical,
   3 Important, 1 Medium, 0 Minor.
4. Original implementer continuation produced `ce73f80`.
5. `reviews/p02-review-2026-07-23T054702Z.md` — blocked with 0 Critical,
   2 Important, 1 Medium, 1 Minor; reconnaissance attempted with complete
   orchestration evidence.
6. Merged `origin/main` at `aa35f45` and dispatched one operator-authorized
   same-target continuation.
7. Recovery continuation produced `471dd5e`; fresh whole-phase review pending.
8. `reviews/archived/p02-review-2026-07-23T114732Z.md` — blocked with 0 Critical,
   2 Important, 1 Medium, 0 Minor; reconnaissance attempted with complete
   orchestration evidence.
9. `reviews/p02-review-2026-07-23T164415Z.md` — fix-task-scoped review passed
   with zero findings; reconnaissance not attempted.

**Review dispatch:**

- Target: `oat-reviewer-gpt-5-6-sol-high`
- Dispatch: scope=p02 action=review role=reviewer
  model_axis=selected:gpt-5.6-sol effort_axis=selected:high
  dispatch_policy=high target=oat-reviewer-gpt-5-6-sol-high

**Optional nested implementation dispatches:** None.
**Worktree:** Root checkout; sequential plan.
**Outstanding items:** None.

### Run 3 — Phase p03

**Anchor:** `run-3-phase-p03`
**Timestamp:** 2026-07-23T21:14:58Z
**Branch:** `cursor-collaboration-reliability`
**Tier:** Tier 1 — native Codex subagents
**Policy:** managed `high`
**Phase base:** `210efe9`
**Phase head:** `0623a74`
**Outcome:** passed after one bounded fix iteration

| Phase | Tasks | Implementation | Root Review | Fix Iterations | Verdict |
| ----- | ----- | -------------- | ----------- | -------------- | ------- |
| p03   | 7/7   | `f6934db..0623a74` | Round 2 passed | 1 (`0623a74`) | passed |

**Implementation dispatch:**

- Request: `impl-p03-210efe9-20260723T170000Z`
- Target: `oat-phase-implementer-gpt-5-6-sol-high`
- Dispatch: scope=p03 action=implementation role=implementer
  model_axis=selected:gpt-5.6-sol effort_axis=selected:high
  dispatch_policy=high target=oat-phase-implementer-gpt-5-6-sol-high

**Review rounds:**

1. `reviews/p03-review-2026-07-23T211458Z.md` — blocked with 0 Critical,
   3 Important, 0 Medium, and 0 Minor; reconnaissance not attempted.
2. Original implementer continuation
   `fix-p03-round1-9c974f9-20260723T211800Z` produced `0623a74`.
3. `reviews/p03-review-2026-07-23T214213Z.md` — passed with zero findings;
   prior I1, I2, and I3 resolved; reconnaissance not attempted.

**Review dispatch:**

- Target: `oat-reviewer-gpt-5-6-sol-high`
- Dispatch: scope=p03 action=review role=reviewer
  model_axis=selected:gpt-5.6-sol effort_axis=selected:high
  dispatch_policy=high target=oat-reviewer-gpt-5-6-sol-high

**Optional nested implementation dispatches:** None.
**Worktree:** Root checkout; sequential plan.
**Outstanding items:** None.

### Run 4 — Phase p04

**Anchor:** `run-4-phase-p04`
**Timestamp:** 2026-07-23T22:43:00Z
**Branch:** `cursor-collaboration-reliability`
**Tier:** Tier 1 — native Codex subagents
**Policy:** managed `high`
**Phase base:** `bc731e9`
**Phase head:** `a81847e`
**Outcome:** passed after one bounded Critical fix iteration

| Phase | Tasks | Implementation | Root Review | Fix Iterations | Verdict |
| ----- | ----- | -------------- | ----------- | -------------- | ------- |
| p04   | 6/6   | `22a7510..a81847e` | Round 2 passed | 1 (`a81847e`) | passed |

**Implementation dispatch:** request `impl-p04-bc731e9-20260723T214500Z`;
target `oat-phase-implementer-gpt-5-6-sol-high`.

**Review rounds:**

1. `reviews/p04-review-2026-07-23T224300Z.md` — blocked with 1 Critical and
   no other findings; reconnaissance not attempted.
2. Original implementer continuation
   `fix-p04-round1-f84dfd8-20260723T224500Z` produced `a81847e`.
3. `reviews/p04-review-2026-07-23T230346Z.md` — passed with zero findings;
   prior Critical resolved; reconnaissance not attempted.

**Worktree:** Root checkout; sequential plan.
**Outstanding items:** None.

### Run 5 — Phase p05

**Anchor:** `run-5-phase-p05`
**Timestamp:** 2026-07-24T00:16:56Z
**Branch:** `cursor-collaboration-reliability`
**Tier:** Tier 1 — native Codex subagents
**Policy:** managed `high`
**Phase base:** `7b2b51c`
**Phase head:** `8710c83`
**Outcome:** passed after one bounded Important fix iteration

| Phase | Tasks | Implementation | Root Review | Fix Iterations | Verdict |
| ----- | ----- | -------------- | ----------- | -------------- | ------- |
| p05   | 6/6   | `9604a3a..8710c83` | Round 2 passed | 1 (`8710c83`) | passed |

**Implementation dispatch:** request
`impl-p05-7b2b51c-20260723T230700Z`; target
`oat-phase-implementer-gpt-5-6-sol-high`.

**Review rounds:**

1. `reviews/p05-review-2026-07-24T001656Z.md` — blocked with 0 Critical,
   2 Important, 0 Medium, and 0 Minor; reconnaissance not attempted.
2. Original implementer continuation
   `fix-p05-round1-8989fd7-20260724T002000Z` produced `8710c83`.
3. `reviews/p05-review-2026-07-24T004530Z.md` — passed with zero findings;
   prior I1 and I2 resolved; reconnaissance not attempted.

**Worktree:** Root checkout; sequential plan.
**Outstanding items:** None.

### Run 6 — Phase p06

**Anchor:** `run-6-phase-p06`
**Timestamp:** 2026-07-24T01:23:20Z
**Branch:** `cursor-collaboration-reliability`
**Tier:** Tier 1 — native Codex subagents
**Policy:** managed `high`
**Phase base:** `7307adb`
**Phase head:** `5375770`
**Outcome:** passed after two bounded Important fix iterations

| Phase | Tasks | Implementation | Root Review | Fix Iterations | Verdict |
| ----- | ----- | -------------- | ----------- | -------------- | ------- |
| p06   | 4/4   | `0ef8e5d..5375770` | Round 3 passed | 2 (`2cddafe`, `5375770`) | passed |

**Implementation dispatch:** request
`impl-p06-7307adb-20260724T005000Z`; target
`oat-phase-implementer-gpt-5-6-sol-high`.

**Review rounds:**

1. `reviews/p06-review-2026-07-24T012320Z.md` — blocked with 0 Critical,
   1 Important, 0 Medium, and 0 Minor; reconnaissance not attempted.
2. Original implementer continuation
   `fix-p06-round1-3dac3a0-20260724T012600Z` produced `2cddafe`; whole-phase
   re-review pending.
3. `reviews/p06-review-2026-07-24T015318Z.md` — blocked with 0 Critical,
   1 Important, 0 Medium, and 0 Minor; prior finding resolved; reconnaissance
   not attempted.
4. Original implementer continuation
   `fix-p06-round2-2cddafe-20260724T015600Z` produced `5375770`.
5. `reviews/p06-review-2026-07-24T023404Z.md` — passed with zero findings;
   both prior findings resolved; reconnaissance not attempted.

**Worktree:** Root checkout; sequential plan.
**Outstanding items:** None.

<!-- orchestration-runs-end -->

---

## Implementation Log

Chronological log of implementation progress.

### 2026-07-22 — Phase 1

**What changed (high level):**

- Added the Cursor streaming frame and structural turn-analysis foundation.
- Preserved generated runtime and Export compatibility.
- Passed an independent root-owned review after one bounded fix round.

**Decisions:**

- Authorized exact generated-output lint/format exclusions because existing
  repository gates require every new generated module to be excluded.
- Kept the intentionally trailing blank JSONL frame because it is part of the
  physical-frame contract.

**Follow-ups / TODO:**

- Continue with exact identity and isolated Cursor state in `p02-t01`.

**Blockers:**

- Phase review I1 and M1 — resolved in `0b16bef`; re-review passed.

**Task commits:** `8aaafa6`, `5386b97`, `05c5d31`, `c72db9d`, `9417b8d`

---

### 2026-07-23 — Phase 2 blocked

**What changed (high level):**

- Added exact Cursor identity, Cursor state v2, recoverable migration,
  continuity enforcement, and delivery CAS foundations.
- Passed all focused and repository verification gates after two review-fix
  iterations.

**Blockers:**

- Final root review retained two Important findings: unsafe stale-lock
  reclamation and unrestricted state rewind/identity substitution.
- The configured retry limit of 2 is exhausted, so Phase 3 was not started.

**Task commits:** `baa0480`, `c373341`, `52ce9c1`, `decf5a5`, `14a643a`

**Compatibility/fix commits:** `f058f30`, `e4c50fe`, `ce73f80`

---

### 2026-07-23 — Operator-authorized Phase 2 recovery

**Authorization:**

- One additional bounded fix and independent re-review cycle is authorized
  beyond the configured automatic retry limit.

**Integration boundary:**

- Merged `origin/main` (`8c006a5a`) into the project branch as `aa35f45`.
- Resolved overlapping Cursor locate/state/test changes semantically and
  regenerated all committed runtime outputs from canonical TypeScript.
- Verified 187 focused tests, 1,295 full-suite tests with 1 skipped,
  type-check, build synchronization, validation, and smoke.

**Next:** Repair only the unresolved findings from
`reviews/p02-review-2026-07-23T054702Z.md`, then run a fresh whole-Phase 2
review against the merged basis.

**Repair result:**

- `471dd5e` resolves all four retained findings across lock ownership,
  create-only state initialization, operator-facing recovery, and raw-alias
  diagnostics.
- Verification passed: 197 focused tests; 1,310 full-suite tests with 1
  skipped; type-check; build synchronization; validation; smoke; changed-file
  lint and format checks.
- A fresh independent whole-Phase 2 review remains the only phase blocker.

**Terminal review result:**

- `reviews/archived/p02-review-2026-07-23T114732Z.md` blocked with 0 Critical,
  2 Important, 1 Medium, 0 Minor.
- The publication-crash queue wedge and ancestor-component raw-alias promotion
  remain unresolved.
- The operator-authorized extra fix/re-review cycle is exhausted. No further
  implementation was started.

---

### Review Received: p02

**Date:** 2026-07-23
**Review artifact:**
`reviews/archived/p02-review-2026-07-23T114732Z.md`

**Findings:**

- Critical: 0
- Important: 2
- Medium: 1
- Minor: 0

**New tasks added:** `p02-t06`, `p02-t07`, `p02-t08`

**Cycle-limit override:** The operator explicitly authorized implementation of
these three tasks and one fix-task-scoped re-review beyond the standard
three-cycle review cap.

**Finding dispositions:**

- `I1` → `p02-t06`: atomically publish complete lock contender tokens and add
  publication-boundary crash/error coverage across all three queues.
- `I2` → `p02-t07`: detect every raw cwd spelling distinct from canonical
  identity and keep it diagnostic-only.
- `M1` → `p02-t08`: align shipped Cursor v2 reset and corrupt-store recovery
  guidance, including the required skill version bump.

**Design drift / artifact alignment notes:** None. All three findings require
implementation or shipped-guidance changes; the approved design remains the
intended source of truth.

**Next:** Execute fix tasks via the `oat-project-implement` skill. After the
tasks complete, update this review event to `fixes_completed` and run a scoped
re-review of the fix tasks.

**Fix completion:** `p02-t06` through `p02-t08` completed in `e1d1a31`,
`e08e867`, and `45835d9`. The bound review event is `fixes_completed`; the
next boundary is the one authorized fix-task-scoped re-review.

**Fix verification:**

- 146 focused state/Cursor-state/locate tests passed.
- Full suite: 1,327 passed and 1 skipped.
- Smoke, build, type-check, generated-output synchronization, repository
  validation, changed-file lint/format, and diff checks passed.
- The task-scoped skill-version gate verified Session Observer `1.0.8` against
  `e3a516b`.
- The origin/main-wide skill-version gate remains blocked only by unrelated
  pre-existing unbumped changes to `export-session-transcript` and
  `session-observer-collab`; it does not flag Session Observer.

**Scoped re-review:** `reviews/p02-review-2026-07-23T164415Z.md` passed with
0 Critical, 0 Important, 0 Medium, and 0 Minor findings. `I1`, `I2`, and `M1`
are resolved; Phase 2 is complete.

---

## Phase 3: Digest v2, Observation, Foreground Watch, and CLI

**Status:** complete
**Completed:** 2026-07-23

### Phase Summary

**Outcome:**

- Added Cursor digest v2 contracts and separate observation/completion
  projections while preserving legacy v1 rendering.
- Integrated exact-identity observation, continuity, reservation/finalization,
  durable watch targets, bounded foreground watching, and CLI composition.
- Phase-wide verification passed with 1,358 tests, 1 skipped, plus validation,
  smoke, type-check, and generated-output parity.
- Independent Phase 3 review round 2 passed with zero findings after bounded
  fix iteration 1 resolved all three prior Important findings in `0623a74`.

### Task outcomes

| Task    | Status   | Commit    | Outcome |
| ------- | -------- | --------- | ------- |
| p03-t01 | complete | `f6934db` | Defined the discriminated Cursor digest v2 frame, accounting, projection, availability, lifecycle, recovery, and blocking contracts with balanced structural-only fixture coverage. |
| p03-t02 | complete | `330a360` | Added schema-v2 Cursor digest dispatch with separate observation and confirmed-completion projections, independent status facets, recovery/blocking metadata, and preserved v1 rendering. |
| p03-t03 | complete | `52e5043` | Characterized caller-owned output versus legacy state mutation, deterministic write/stdout failures, and reusable Cursor valid/malformed/unterminated frame fixtures without changing runtime behavior. |
| p03-t04 | complete | `5d84895` | Integrated exact-identity framed Cursor observation with continuity-safe bounded confirmation, delivery reservation, caller-owned single-use commit/abandon handles, reconciliation, conflicts, and exact-key crash replay. |
| p03-t05 | complete | `3e36ec5` | Added durable watch envelope v2 migration with untouched v1 targets, exact Cursor frame/continuity/candidate/owner state, private permissions, owner-scoped CAS, and blocked-to-verified repair. |
| p03-t06 | complete | `aee60dc` | Added bounded Cursor foreground watch with scheduled stability confirmation, heartbeat/poll bounds, block/repair, reservation/startup race handling, cleanup, and stdout-owned commit/uncertain semantics. |
| p03-t07 | complete | `9c974f9` | Composed digest-v2 CLI output, transactional review/catch-up finalization, both-store state commands, blocked/uncertain exit semantics, replay guards, and v2 watch status while preserving v1 behavior. |

### Task p03-t01: Define Cursor digest v2 types and fixture contracts

**Status:** completed
**Commit:** `f6934db`
**Verification:** Digest tests 30/30, type-check, file-scoped formatting/lint,
build, generated-output parity, and diff checks passed.

### Task p03-t02: Build Cursor digest and status projections

**Status:** completed
**Commit:** `330a360`
**Verification:** The specified digest and runtime suites passed 99/99;
type-check, build, generated-output parity, file-scoped formatting/lint, legacy
collaboration wake regression, and diff checks passed.

### Task p03-t03: Characterize observation output ownership

**Status:** completed
**Commit:** `52e5043`
**Verification:** Observe/integration tests passed 19/19; type-check,
file-scoped formatting/lint, and diff checks passed.

### Task p03-t04: Integrate Cursor observation and delivery CAS

**Status:** completed
**Commit:** `5d84895`
**Verification:** RED confirmed 5 new failures with 8 legacy passes; GREEN
observe/integration coverage passed 25/25 with type-check, generated build parity,
file-scoped formatting/lint, and diff checks.

### Task p03-t05: Extend durable watch targets for Cursor

**Status:** completed
**Commit:** `3e36ec5`
**Verification:** RED confirmed 3 new failures with 19 existing passes; GREEN
watch-state coverage passed 22/22 with type-check, generated build parity,
file-scoped formatting/lint, and diff checks.

### Task p03-t06: Add bounded Cursor foreground watch behavior

**Status:** completed
**Commit:** `aee60dc`
**Verification:** RED confirmed 4 Cursor failures with 51 existing passes; GREEN
watch/watch-state coverage passed 58/58 with type-check, generated build parity,
file-scoped formatting/lint, and diff checks.
**Deferred gate:** The generated watch module makes the changed-skill version
gate intentionally pending; plan task `p05-t05` owns the consolidated skill
version bump and provider dogfood after all runtime/doc changes land.

### Task p03-t07: Compose Cursor CLI state and output semantics

**Status:** completed
**Commit:** `9c974f9`
**Verification:** RED confirmed 9 failures with 56 existing passes; GREEN
CLI/session-override/integration coverage passed 65/65. Phase-wide verification
passed 1,358 tests with 1 skipped, repository validation, smoke, type-check, and
generated build parity.

### Review round 1

`reviews/p03-review-2026-07-23T211458Z.md` is BLOCKED with 0 Critical,
3 Important, 0 Medium, and 0 Minor findings:

- I1: delivery-uncertain replay can lose reserved keys after lifecycle advances.
- I2: stateless Cursor review bypasses bounded stability confirmation.
- I3: watch polling/status can report failed, unknown, or uncertain health as
  healthy.

The original Phase 3 implementer resolved all three findings in `0623a74`.
Focused Phase 3 coverage passed 175/175, the full suite passed 1,363 with 1
skipped, and build, generated parity, type-check, validation, smoke,
file-scoped formatting/lint, and diff checks passed.

**Round-2 review:** `reviews/p03-review-2026-07-23T214213Z.md` passed with
0 Critical, 0 Important, 0 Medium, and 0 Minor findings. I1, I2, and I3 are
resolved; Phase 4 is next.

---

## Phase 4: Collaboration Compatibility and Completion Safety

**Status:** complete
**Completed:** 2026-07-23

### Phase Summary

**Outcome:**

- Added schema-aware completion selection, lease v6 canonical containment,
  private continuity CAS, confirmed-completion frame handling, and wake-envelope
  v2 compatibility.
- Completed the collaboration safety matrix and aligned intended-valid
  transcript-core v2 fixtures through append-only integration fix `f84dfd8`.
- Full clean-worktree validation passed with 1,402 tests, 1 skipped, plus
  type-check, generated parity, validation, smoke, lint, and formatting.
- Independent Phase 4 review round 2 passed with zero findings after bounded
  fix iteration 1 resolved the prior Critical in `a81847e`.

### Task outcomes

| Task    | Status   | Commit    | Outcome |
| ------- | -------- | --------- | ------- |
| p04-t01 | complete | `22a7510` | Added explicit v1 record-index versus v2 frame-index completion dispatch, requiring confirmed-completion projection for v2 while preserving legacy classification. |
| p04-t02 | complete | `4ceb7ee` | Migrated leases to schema v6 with canonical contained Cursor peer paths, runtime-derived index base, private continuity, explicit legacy Cursor re-arm, and preserved v5 non-Cursor cursors. |
| p04-t03 | complete | `8e64ff4` | Bound both collaboration CAS routes to lease-private canonical path/device/inode/prefix continuity, with use-time containment revalidation and no observer projection cursor reuse. |
| p04-t04 | complete | `dff5f92` | Switched Cursor stop handling to framed confirmed-completion selection with pending polling, structural fail-closed continuity, and atomic private frame cursor/checkpoint CAS. |
| p04-t05 | complete | `ce7f1f6` | Versioned wake envelopes with explicit v2 schema/index-base attributes, derived v1 provenance, fail-closed malformed parsing, and synchronized generated runtimes. |
| p04-t06 | complete | `e6e4c5d` | Added missing Cursor v2 synthetic/no-op/metadata-only, duplicate-event, expired, and disarmed safety regressions without production changes. |
| p04-fix | complete | `f84dfd8` | Aligned all three intended-valid transcript-core v2 automatic-control fixtures with the required frame index base. |

### Task p04-t01: Dispatch completion selection by digest schema

**Status:** completed
**Commit:** `22a7510`
**Verification:** RED confirmed 4 failures with 20 legacy passes; GREEN
completion coverage passed 24/24 with type-check, formatting/lint, and diff
checks.

### Task p04-t02: Migrate collaboration leases to schema v6

**Status:** completed
**Commit:** `4ceb7ee`
**Verification:** RED confirmed 4 failures with 31 legacy passes; GREEN control
coverage passed 35/35 with type-check, formatting/lint, and diff checks.

### Task p04-t03: Bind collaboration CAS to private continuity

**Status:** completed
**Commit:** `8e64ff4`
**Verification:** Hook coverage passed 21/21 and adjacent control regression
passed 35/35 with type-check, formatting/lint, and diff checks.

### Task p04-t04: Consume Cursor confirmed-completion frames

**Status:** completed
**Commit:** `dff5f92`
**Verification:** Cursor-hook/completion coverage passed 45/45, the full
collaboration regression passed 100/100, and type-check, formatting/lint, and
diff checks passed.

### Task p04-t05: Version the wake envelope contract

**Status:** completed
**Commit:** `ce7f1f6`
**Verification:** Focused envelope/runtime coverage passed 78/78, collaboration
regression passed 104/104, and build parity, type-check, formatting/lint, and
diff checks passed.

### Task p04-t06: Run the collaboration safety regression matrix

**Status:** completed
**Commit:** `e6e4c5d`
**Integration fix:** `f84dfd8`
**Verification:** Collaboration coverage passed 110/110; focused integration
coverage passed 95/95; full clean-worktree validation passed 1,402 tests with
1 skipped, plus type-check, build parity, validation, smoke, formatting/lint,
and diff checks.

### Review round 1

`reviews/p04-review-2026-07-23T224300Z.md` is BLOCKED with 1 Critical and no
other findings. The original Phase 4 implementer resolved it in `a81847e` with
framed confirmed-completion, index-base validation, pending polling, and
mandatory checkpoint-bearing trigger/suppressed CAS. Focused coverage passed
204 tests, the full suite passed 1,407 with 1 skipped, and build parity,
validation, smoke, type-check, formatting/lint, and diff checks passed.

**Round-2 review:** `reviews/p04-review-2026-07-23T230346Z.md` passed with
0 Critical, 0 Important, 0 Medium, and 0 Minor findings. Manual installed-hook
reproduction also passed; Phase 5 is next.

---

## Phase 5: Acceptance Evidence, Documentation, and Release Readiness

**Status:** complete; fresh final re-review pending
**Completed:** 2026-07-24

### Phase Summary

**Outcome:**

- Recorded sanitized, repeatable Cursor capability evidence, passed four
  read-only live observed-side rows plus fifteen synthetic observation rows,
  and passed the bounded collaboration path with automated-only evidence.
- Updated shipped user, engineering, and skill-reference documentation for the
  v2 content/frame semantics, exact identity, recovery, status, and honest
  support tiers.
- Bumped and dogfooded all three changed standalone skills through canonical
  user installs; available provider links matched and OAT reported 188/188
  synchronized surfaces.
- Closed the satisfied Cursor transcript-store backlog item through the full
  PJM lifecycle while leaving stronger wake evaluation to Phase 6.
- The aggregate release matrix passed 1,424 tests with 1 skipped, 34 generated
  docs pages, 52 clean generated outputs, exact changed-file lint/format gates,
  validation, smoke, version validation, and OAT status.
- Independent Phase 5 review retained 2 Important evidence-contract findings;
  bounded fix iteration 1 resolved both in `8710c83`, and whole-phase round-2
  review passed with zero findings.

### Task outcomes

| Task    | Status   | Commit    | Outcome |
| ------- | -------- | --------- | ------- |
| p05-t01 | complete | `9604a3a` | Added the sanitized capability-evidence matrix plus a repeatable validator for personal paths, opaque IDs, credentials, prose canaries, and honest evidence labels. |
| p05-t02 | complete | `8bc8ee4` | Added the finite observed-side acceptance harness and recorded 4/4 read-only live Cursor 3.11.13 rows plus 15/15 temporary-store synthetic rows while keeping provider transcripts read-only. |
| p05-t03 | complete | `34b702c` | Recorded the isolated exact collaboration lifecycle through shipped control/hook paths, with provider-delivered routing honestly retained as documented-but-unvalidated. |
| p05-t04 | complete | `da09616` | Documented content-first Cursor observation, terminal-only completion, exact identity and recovery, state/status facets, schema/index dispatch, lease/wake versions, generated topology, and honest support labels. |
| p05-t05 | complete | `e77c367` | Bumped the three changed standalone skill versions, regenerated without drift, and verified byte-identical branch dogfooding through canonical user installs and available provider links. |
| p05-t06 | complete | `8989fd7` | Closed the satisfied Cursor transcript-store backlog item and passed the complete pre-wake release matrix with clean generated, test, docs, version, and provider-sync state. |

### Task p05-t01: Record the baseline capability matrix

**Status:** completed
**Commit:** `9604a3a`
**Verification:** Evidence tests passed 14/14, the validator passed across 12
files, and repository validation, formatting/lint, and diff checks passed.

### Task p05-t02: Run observed-side live Cursor acceptance

**Status:** completed
**Commit:** `8bc8ee4`
**Verification:** Tooling tests passed 3/3; the required probe passed 4/4 live
read-only rows and 15/15 synthetic rows (19/19 total); evidence validation,
build parity, repository validation, formatting/lint, and diff checks passed.

### Task p05-t03: Probe the bounded collaboration lifecycle

**Status:** completed
**Commit:** `34b702c`
**Verification:** Focused collaboration coverage passed 92/92; isolated
arm/wake/status/disarm/prune produced exact frames 0-5, cursor 6, counters 1/1,
and prune 1; evidence/repository validation and formatting/lint passed.

### Task p05-t04: Author shipped behavior documentation through OAT

**Status:** completed
**Commit:** `da09616`
**Verification:** Documentation formatting and the 34-page production build
passed; evidence validation, repository validation, lint-staged, diff checks,
and an explicit 10/10 schema/index agreement cross-check passed.

### Task p05-t05: Bump changed skill versions and dogfood providers

**Status:** completed
**Commit:** `e77c367`
**Verification:** Build parity, repository and skill-version validation,
formatting, and diff checks passed; canonical user installs matched the branch
byte-for-byte, and OAT reported 188/188 synchronized surfaces with no drift,
missing entries, or strays. Claude and Copilot links resolved to the canonical
installs; Cursor skill entries were absent and were not claimed.

### Task p05-t06: Run pre-wake gates and close satisfied baseline backlog items

**Status:** completed
**Commit:** `8989fd7`
**Verification:** All four transcript-store acceptance criteria passed, along
with 206 focused tests. The final matrix passed exact changed-file lint/format
gates, evidence validation, build/type/build parity, 1,424 tests with 1
skipped, validation, smoke, 31 formatted docs files, a 34-page production
build, three skill-version checks, and 188/188 synchronized OAT surfaces.

### Review round 1

`reviews/p05-review-2026-07-24T001656Z.md` is BLOCKED with 2 Important
findings and no other findings:

- The evidence validator misses quoted identities, omits committed Phase 5
  Markdown by default, and does not enforce the governing evidence-label
  taxonomy row by row.
- The live acceptance harness can pass promoted rows without enforcing the
  exact provider-version, schema/index, content/lifecycle, status, and
  finite-stop claims recorded durably.

The original Phase 5 implementer resolved both findings in `8710c83`.
The validator now covers quoted identities, committed merge-base ranges, and
row-level canonical labels/required fields. The live probe now proves provider
version, schema/index, status facets, lifecycle/content, and finite-stop
structure before promotion. RED reproduced 21 failures; GREEN passed 41
focused tests, 204 targeted tests, and 1,448 full-suite tests with 1 skipped.
The fresh probe passed 19/19 with an accurate split of 4 live-validated and 15
automated-only rows.

**Round-2 review:** `reviews/p05-review-2026-07-24T004530Z.md` passed with
0 Critical, 0 Important, 0 Medium, and 0 Minor findings. I1 and I2 are
resolved; Phase 6 is next.

---

## Phase 6: Conditional Stronger Wake Evaluation

**Status:** in_progress

### Phase Summary

**Outcome:**

- Finite authenticated probes found no effective top-level Stop callback,
  managed-subagent callback, or existing scheduled Cursor wake surface.
- Retained buffered-manual as the strongest evidence-backed Cursor tier and
  shipped no new adapter, daemon, scheduler, credential, or authority.
- Aligned runtime evidence, shipped skill routing, and user documentation with
  unavailable/unsupported classifications.
- Bumped and dogfooded `session-observer-collab` 1.0.7 and closed the completed
  stronger-wake investigation through the full PJM lifecycle.
- The final release matrix passed 1,448 tests with 1 skipped, fresh Cursor
  acceptance 19/19, a 33-file evidence scan, 34 generated docs pages, exact
  changed-file lint/format gates, version validation, and 188/188 synchronized
  OAT surfaces.
- Independent Phase 6 review retained 1 Important evidence-reproducibility
  finding; bounded fix iteration 1 resolved it in `2cddafe`. Round 2 retained
  1 new Important provider-state cleanup finding; bounded fix iteration 2
  resolved it in `5375770`, and whole-phase review round 3 passed with zero
  findings.

### Task outcomes

| Task    | Status   | Commit    | Outcome |
| ------- | -------- | --------- | ------- |
| p06-t01 | complete | `0ef8e5d` | Proved the authenticated top-level Cursor Stop project hook unavailable for same-parent delivery; no exact identity/one-consumer tier was promoted and buffered-manual fallback remains. |
| p06-t02 | complete | `b030cc5` | Proved existing managed subagent and scheduled callback surfaces insufficient without prohibited new infrastructure; shipped no adapter and retained buffered-manual fallback. |
| p06-t03 | complete | `407bfd2` | Finalized buffered-manual as the highest evidence-backed Cursor wake tier and aligned runtime, shipped-skill, and user-guide claims without autonomous-wake overstatement. |
| p06-t04 | complete | `3dac3a0` | Reconciled version 1.0.7, provider dogfood, stronger-wake backlog closure, and all final release gates with no generated or provider drift. |

### Task p06-t01: Measure same-parent Stop callback delivery

**Status:** completed
**Commit:** `0ef8e5d`
**Verification:** A finite 90-second authenticated Cursor Agent probe produced
no top-level Stop callback, while the installed contract exposed
`followup_message` only for `subagentStop`. Collaboration coverage passed
115/115 and the evidence validator passed 32 files.

### Task p06-t02: Evaluate managed callback surfaces in order

**Status:** completed
**Commit:** `b030cc5`
**Verification:** A controlled Cursor Agent run used the native Subagent tool,
but project `subagentStart`/`subagentStop` hooks never fired and the parent
received no callback. No existing cron, LaunchAgent, or Cursor schedule was
available; the private cloud worker was classified unsupported because it
requires a token and long-running external service. Collaboration coverage
passed 115/115 and the evidence validator passed 32 files.

### Task p06-t03: Finalize wake-tier and fallback claims

**Status:** completed
**Commit:** `407bfd2`
**Verification:** The evidence validator passed 32 files, repository
validation and smoke passed, and documentation formatting plus the 34-page
production build passed. The stronger-wake backlog criteria were recorded as
satisfied by the completed investigation, with terminal lifecycle mutation
deferred atomically to p06-t04.

### Task p06-t04: Reconcile versions, providers, backlog, and final release gates

**Status:** completed
**Commit:** `3dac3a0`
**Verification:** Fresh Cursor acceptance passed 19/19 (4 live-validated and 15
automated-only), the evidence validator passed 33 files, and 1,448 tests passed
with 1 skipped. Build, type-check, generated parity, validation, smoke, the
34-page docs build, three changed-skill version checks, exact PR-scoped
lint/format, and 188/188 OAT surface synchronization passed.

### Review round 1

`reviews/p06-review-2026-07-24T012320Z.md` is BLOCKED with 1 Important finding
and no other findings. The original Phase 6 implementer resolved it in
`2cddafe` with an executable sanitized dual-mode probe, explicit 90/120-second
process caps, fixed structural markers, expected-versus-actual JSON, safe
cleanup, validator enforcement, and focused tests. Both live modes reproduced
`callback-unavailable`; the selected tier and product behavior did not change.
Focused probe/validator coverage passed 31/31, collaboration passed 115/115,
and the full suite passed 1,457 with 1 skipped. Whole-phase re-review is
pending.

### Review round 2

`reviews/p06-review-2026-07-24T015318Z.md` is BLOCKED with 1 Important finding
and no other findings. The executable recipe is complete, but real Cursor runs
also persisted probe-owned transcripts/logs/auth metadata under
`~/.cursor/projects/` while cleanup reported only the temporary workspace.
The original implementer resolved it in `5375770` by snapshotting both provider
roots, proving exact new direct-child ownership from workspace mapping,
birth/linkage/inode/containment evidence, failing closed on ambiguity, removing
only exact proven artifacts, and verifying absence. Both live modes created,
proved, and removed 4/4 artifacts with zero remaining; the tier and provider
outcome remain unchanged. Focused coverage passed 38/38 and the full suite
passed 1,464 with 1 skipped.

**Round-3 review:** `reviews/p06-review-2026-07-24T023404Z.md` passed with
0 Critical, 0 Important, 0 Medium, and 0 Minor findings. Both prior findings
are resolved; the mandatory final lifecycle review followed.

---

## Final Lifecycle Review

**Status:** passed

### Review round 1

`reviews/final-review-2026-07-24T025100Z.md` is BLOCKED with 1 Important
finding and no other findings. When a buffered Cursor frame is repaired and
consumed, both watch-state copy sites discard the digest's explicit `null`
clear through nullish fallback, retaining the stale frame and repeatedly
reporting `recordsBehind: 1`. A bounded final-review fix will preserve the
explicit clear in canonical TypeScript, regenerate shipped output, add an
integration regression, and rerun the final lifecycle review.

**Verification before fix:** Build, type-check, generated parity, validation,
smoke, 1,464 tests with 1 skipped, 57 focused evidence/probe tests, a 34-file
evidence scan, 34-page docs build, skill versions, internal flags,
changed-file lint/format, and 188/188 OAT sync passed.

### Fix iteration 1

Commit `15cc61f` preserves the Cursor digest's exact `bufferedFromFrame`,
including an explicit `null`, at both persisted-CAS and in-memory watch-state
copy sites. The new partial-frame → repair regression first reproduced the
stale frame-3 buffer after advancing to frame 4, then proved that persisted
state, heartbeat output, and live `watch-ctl status` all clear the buffer and
report `recordsBehind: 0`. Canonical TypeScript was rebuilt into the shipped
runtime and session-observer was bumped and dogfooded at version 1.0.10.

**Fix verification:** 38/38 focused watch tests and 1,465 full-suite tests
passed with 1 skipped. Build, type-check, generated parity, validation, smoke,
34-file evidence scan, 34-page docs build, internal flags, skill-version
enforcement, changed-file lint/format, 188/188 OAT sync, 48/48 extension sync,
provider-root residue checks, and byte-identical user-skill dogfood passed.

### Review round 2

`reviews/final-review-2026-07-24T031130Z.md` is BLOCKED with 1 Medium finding
and no other findings. The round-1 Important is resolved: independent shipped
runtime reproduction advanced to frame 4, cleared persisted and in-memory
buffer state, and kept 30/30 later heartbeats plus live status at zero lag.
The adjacent durable watch target, however, retains the baseline
`recordCount: 3`; a separate `watch-ctl status` therefore reports stale
`transcriptRecords: 3` while in-memory heartbeats correctly report 4. Fix
iteration 2 will persist the validated current frame count during result-bearing
transitions, retain the prior count for result-less health transitions, and
extend the repaired-frame regression to prove durable and live-status agreement.

**Verification before fix:** 238/238 suites and 1,465 tests passed with 1
skipped. Build, type-check, generated parity, validation, smoke, 38/38 focused
watch tests, 57/57 evidence/probe tests, 34-file evidence validation, 34-page
docs build, versions, internal flags, changed-file lint/format, privacy,
provider cleanup, dogfood, and 188/188 OAT sync passed.

### Fix iteration 2

Commit `6afb9bf` adds a validated optional `recordCount` to Cursor watch-target
transitions. Result-bearing persistence supplies the exact current physical
frame total, while result-less health/continuity transitions preserve the
durable count. The CAS rejects negative, non-integer, below-cursor, and
regressing counts without mutating state, while retaining existing ownership
and stale-transition semantics.

The repaired-frame regression first reproduced durable count 3 after advancing
to frame 4, then proved durable cursor/count 4, cleared buffer state, separate
status `transcriptRecords: 4` / `recordsBehind: 0`, and agreement across at
least 30 later heartbeats. Canonical TypeScript was rebuilt into shipped
watch/watch-state runtimes, and session-observer was bumped and dogfooded at
version 1.0.11.

**Fix verification:** 60/60 focused watch/watch-state tests and 1,465
full-suite tests passed with 1 skipped. Build, type-check, generated parity,
validation, smoke, 34-file evidence validation, 34-page docs build, internal
flags, skill-version enforcement, changed-file lint/format, 188-entry OAT
sync, 48 extension operations, provider-root residue checks, and byte-identical
user-skill dogfood passed.

### Review round 3

`reviews/final-review-2026-07-24T032809Z.md` PASSED with 0 Critical,
0 Important, 0 Medium, and 0 Minor findings. Independent shipped-runtime
reproduction confirmed both prior findings remain resolved: repaired Cursor
frames clear buffering, persist cursor/count 4, keep separate status and 30/30
later heartbeats aligned at zero lag, preserve counts for result-less
transitions, reject every unsafe count class without mutation, and retain
ownership/stale CAS semantics.

**Final review verification:** 238/238 suites and 1,465 tests passed with 1
skipped; 60/60 focused watch/watch-state tests and 57/57 evidence/probe tests
passed. Build, type-check, generated parity, validation, smoke, 34-file
evidence validation, 34-page docs build, versions, internal flags,
changed-file lint/format, session-observer 1.0.11 dogfood, 188/188 all-scope
and 114/114 user-scope OAT synchronization, privacy, and cleanup checks passed.

---

## Configured Implementation Exit Gate

**Status:** pending; remediation attempt 2 ready

The resolved configured gate is a structured cross-family final code review
with an Important blocking threshold, `onFailure: block`, and at most two
remediation attempts. Its canonical command has global `--json`, the explicit
project declaration, and no hard-coded target. Generation basis
`5d02b91` is fingerprinted against `origin/main`.

### Attempt 1

Gate run `09729d68-6f2a-4a63-be4f-b344c8ac96a0` completed with a validated,
receive-eligible `blocked` envelope and artifact
`reviews/archived/final-review-2026-07-24T034752Z.md`. It reports 1 Critical and 3
Important findings: stale-success wake authorization, bounded stability-prefix
growth handling, completed-prefix selection before a pending turn, and
exit-gate bookkeeping privacy/evidence validation. The correlated artifact
must be received durably before the persisted `block` policy can begin its
first remediation attempt.

### Review Received: configured exit gate attempt 1

**Date:** 2026-07-24
**Review artifact:** `reviews/archived/final-review-2026-07-24T034752Z.md`

**Findings:**

- Critical: 1
- Important: 3
- Medium: 0
- Minor: 0

**New tasks added:** `p07-t01`, `p07-t02`, `p07-t03`, `p07-t04`

The four findings were converted into a sequential Phase 7. The selected-prefix
CAS seam lands before completed-prefix relaxation; bounded stability work is
canonical Session Observer work; evidence-safe bookkeeping runs last against
the resulting full changed tree. No finding was deferred or rejected.

**Next:** Execute Phase 7 through `oat-project-implement`, rerun the mandatory
final lifecycle review for the changed implementation basis, then resume the
same configured-gate generation under its persisted `block` policy.

The receive transaction is durably corroborated by commit `56db672`; policy
attempt 1 of 2 is consumed before Phase 7 implementation begins.

After receive reconciliation completed, the result receipt was retained in
ignored local OAT state and the deleted transient marker was normalized to a
repo-neutral logical marker reference. Run/artifact/receive correlation remains
in the typed exit-gate state.

### Attempt 2 basis

The mandatory final lifecycle review passed on `090f507` after all four
attempt-1 findings were remediated. The same persisted gate configuration and
`block` policy are retained, with attempt 1 of 2 consumed. The new reviewed
basis is fingerprinted against `origin/main` as
`implementation_fingerprint: sha256:effective-delta-v1:4222336c3eec6bf0973b683c9d25a0b8be5f8c06be8e13f46c9fff72795237d8`.
Launch and receive state are reset for the second and final attempt.

### Attempt 2 result

Gate run `24448ac0-ac55-4175-a873-1611596f0385` returned one validated,
receive-eligible `blocked` envelope with 3 Critical, 5 Important, 4 Medium,
and 1 Minor findings. The corroborated artifact is
`reviews/archived/final-review-2026-07-24T055647Z.md`. This is the second and
final attempt permitted by the persisted `block` policy; receive queues the
findings durably but does not authorize a third launch.

---

## Phase 7: Configured Exit-Gate Remediation

**Status:** complete; phase review passed

### Task Outcomes

| Task    | Status      | Commit    | Outcome |
| ------- | ----------- | --------- | ------- |
| p07-t01 | complete    | `6454740` | Bound selected Cursor success bytes through both owner-hook CAS paths. |
| p07-t02 | complete    | `a1a8999` | Confirmed bounded stability prefixes without starvation during growth. |
| p07-t03 | complete    | `31c49e6` | Selected completed prefixes while leaving later pending turns unread. |
| p07-t04 | complete    | `0e6cd1c` | Made typed gate bookkeeping evidence-safe and reran release gates. |

### Task p07-t01: Bind selected Cursor success bytes through collaboration CAS

**Status:** completed
**Commit:** `6454740`

The Cursor-owner and Codex-owner hooks now share an authored selected-prefix
snapshot seam. Observation carries the selected boundary/hash/device/inode,
and an exact bounded reread immediately before lease CAS must match before
either hook can wake, spend budget, or advance private continuity. Eight
success-to-non-success mutation interleavings plus inode replacement now fail
closed, while unchanged success and existing completion/install behavior
remain intact. Session-observer-collab 1.0.10 is dogfooded and synchronized.

**Verification:** 78/78 focused tests and 125/125 collaboration tests passed;
type-check, generated parity, validation, smoke, internal flags, changed-file
lint/format, 34-page docs build, version enforcement, dogfood, and 114-entry
user synchronization passed.

### Task p07-t02: Confirm bounded stability prefixes during transcript growth

**Status:** completed
**Commit:** `a1a8999`

Observation now confirms the original candidate boundary and entry keys against
the grown second scan, reserves through the digest's verified cursor, and
retains later safe bytes as the next candidate. A frame arriving during
confirmation no longer restarts the earlier candidate, and continuous growth
through max-pending delivers every message exactly once and in order. The
existing Cursor state API was sufficient; canonical TypeScript was rebuilt
into the shipped runtime and Session Observer 1.0.12 was dogfooded.

**Verification:** 107/107 focused tests and 472/472 Session Observer tests
passed; build, type-check, generated parity, validation, smoke, internal
flags, changed-file lint/format, 34-page docs build, version enforcement,
dogfood, and user synchronization passed.

### Task p07-t03: Select a completed prefix before a pending Cursor turn

**Status:** completed
**Commit:** `31c49e6`

Completion selection now accepts a complete unsliced terminal-success prefix
when the entire later range is structurally accounted for as healthy pending
`stability-wait`. Both owner hooks wake exactly once for the completed prefix,
checkpoint through frame 3, and leave frames 3–4 unread. Malformed, partial,
tail-sliced, discontinuous, unaccounted, unbound, and non-completion shapes
remain rejected; the p07-t01 terminal-rewrite and inode protections remain
green. Session-observer-collab 1.0.11 is dogfooded and synchronized.

**Verification:** 79/79 focused tests and 128/128 collaboration tests passed;
type-check, generated parity, validation, smoke, internal flags, changed-file
lint/format, 34-page docs build, version enforcement, dogfood, and user
synchronization passed.

### Task p07-t04: Make exit-gate bookkeeping evidence-safe and rerun release gates

**Status:** completed
**Commit:** `0e6cd1c`

The Cursor evidence validator now recognizes only exact file-qualified,
typed gate/commit/fingerprint bookkeeping fields while continuing to reject
session IDs, lease IDs, arbitrary UUID assignments, credentials, transcript
prose, and personal paths. Terminal gate receipts remain local-only and the
completed marker is repo-neutral. The live branch and an end-to-end accepted /
result / receive fixture pass without broad identity allowlisting.

**Verification:** 34/34 focused evidence tests, the live 34-file validator,
and 1,490 full-suite tests passed with 1 skipped. Build, type-check, generated
parity, validation, smoke, internal flags, changed-file lint/format, 34-page
docs build, skill-version enforcement, 188/188 all-scope and 114/114 user-scope
OAT synchronization, dogfood exact-copy, privacy, and probe-residue checks
passed.

**Whole-phase review:** `reviews/p07-review-2026-07-24T050736Z.md` passed with
0 Critical, 0 Important, 0 Medium, and 0 Minor findings. Independent
adversarial coverage revalidated all four configured-gate findings, 168
focused tests, 1,490 full-suite tests with 1 skipped, evidence/privacy,
dogfood, synchronization, and zero provider residue. Mandatory final lifecycle
review is next.

### Mandatory final lifecycle review round 4

`reviews/final-review-2026-07-24T051704Z.md` PASSED with 0 Critical,
0 Important, 0 Medium, and 0 Minor findings. The independent whole-project
review confirmed that all four configured-gate findings and both earlier
buffer/count findings remain resolved. It found no requirements drift, unsafe
extra work, deferred findings, or blockers.

**Final review verification:** 190/190 focused cross-fix tests and 1,490
full-suite tests passed with 1 skipped. Build, type-check, generated parity,
validation, smoke, evidence and skill-version gates, internal flags,
documentation formatting/build, changed-file lint/format, commit-message
validation, all-scope and user-scope synchronization, byte-identical dogfood,
privacy classification, and provider-residue checks passed.

---

## Phase 8: Terminal Exit-Gate Findings

**Status:** complete
**Completed:** 2026-07-24

### Operator authorization

On 2026-07-24 the operator authorized one bounded remediation cycle for all
13 Phase 8 tasks and, after a fresh passing review, a new configured-gate
generation. The exhausted two-attempt generation remains immutable audit
history and must not be relaunched.

### Review Received: configured exit gate attempt 2

**Date:** 2026-07-24
**Review artifact:** `reviews/archived/final-review-2026-07-24T055647Z.md`

**Findings:**

- Critical: 3
- Important: 5
- Medium: 4
- Minor: 1

**New tasks added:** `p08-t01` through `p08-t13`

All findings were auto-converted under blocking gate receive rules:

| Finding | Task | Scope | Disposition |
| ------- | ---- | ----- | ----------- |
| C1 | `p08-t01` | Moderate | Await callback-confirmed stdout delivery before committing Cursor checkpoints. |
| C2 | `p08-t02` | Moderate | Advance to a new safe suffix candidate after a committed same-turn delivery. |
| I3 | `p08-t03` | Moderate | Propagate the remaining watch deadline through stability waits. |
| I1 | `p08-t04` | Moderate | Require successful canonicalization and containment for exact identity. |
| I2 | `p08-t05` | Moderate | Reject unsupported top-level assistant content shapes. |
| M1 | `p08-t06` | Moderate | Slice Cursor output by structural `turnId`. |
| C3 | `p08-t07` | Moderate | Bind collaboration claims to the selected completion boundary. |
| M2 | `p08-t08` | Minor | Synchronize ambient collaboration declarations and consumer coverage. |
| I4 | `p08-t09` | Moderate | Add a finite TERM-to-KILL process timeout to the acceptance probe. |
| M3 | `p08-t10` | Minor | Require provider-version evidence before live promotion. |
| M4 | `p08-t11` | Moderate | Prove pre-existing provider state is unchanged or narrow the claim. |
| I5 | `p08-t12` | Moderate | Keep accepted and terminal gate bookkeeping evidence-safe. |
| m1 | `p08-t13` | Minor | Reconcile the Cursor current-state headline and final release gates. |

No finding was deferred or rejected. The task order serializes overlapping
generated observer output, collaboration contracts, probe tooling, evidence
bookkeeping, and final release reconciliation. The configured gate has reached
`maxAttempts`; Phase 8 cannot begin automatically within this gate generation.

The receive transaction is durably corroborated by commit `8cc9177`. Attempt
2 of 2 is consumed and the terminal marker is normalized to a repo-neutral
logical reference. Remediation begins at `p08-t01`; a fresh gate generation is
allowed only after Phase 8 and its fresh reviews pass.

### Phase implementation attempt

**Request:** `logical:phase8-blocked-attempt`
**Dispatch:** `oat-phase-implementer-gpt-5-6-sol-high`
**Base:** `3b4ea80`
**Status:** `BLOCKED`

| Task | Status | Commit |
| ---- | ------ | ------ |
| `p08-t01` | complete | `6da8f79` |
| `p08-t02` | complete | `0376ec7` |
| `p08-t03` | complete | `59dcc97` |
| `p08-t04` | complete | `103e915` |
| `p08-t05` | complete | `ca4f573` |
| `p08-t06` | complete | `2a07bd8` |
| `p08-t07` | complete | `4601949` |
| `p08-t08` | complete | `b02ddc7` |
| `p08-t09` | complete; fixture race found by phase matrix | `0a9442c` |
| `p08-t10` | complete | `bf24dde` |
| `p08-t11` | complete | `2c68bb6` |
| `p08-t12` | complete | `b606771` |
| `p08-t13` | complete | `bb435f4` |
| `p08-t14` | complete | `0712627` |
| `p08-t15` | complete | `998892c` |
| `p08-t16` | complete | `9c90704` |
| `p08-t17` | complete | `e8de07d` |
| `p08-t18` | complete | this commit |

The first `p08-t13` focused group passed 117/117. The second group passed 161
tests and failed the SIGTERM-resistant-child regression from `p08-t09`: under
load, the child can receive TERM before it installs its handler. Isolated
`p08-t09` verification had passed 22/22. The exact repair is a readiness
handshake before starting the timeout. Phase rules prohibit amending the
completed task or adding an unplanned commit, so the accepted attempt stopped.
The intended `p08-t13` current-state headline diff remains preserved
uncommitted.

### Operator-authorized continuation

On 2026-07-24 the operator authorized one new bounded plan task after the
terminal Phase 8 attempt. Stable task IDs were preserved: `p08-t13` was
narrowed to the already-prepared current-state reconciliation, and new
`p08-t14` owns the readiness-handshake repair plus the complete release matrix.
This is an explicit continuation boundary, not replacement or fallback for the
accepted blocked handle.

**Artifact divergence:** The original `p08-t13` combined current-state
reconciliation with the full release matrix. The loaded matrix exposed a
fixture race from completed task `p08-t09`, so `plan.md` is now the source of
truth: `p08-t13` closes the preserved documentation/sync work and `p08-t14`
adds the deterministic fixture repair before rerunning every final gate.

### Continuation outcome

The same exact-target Phase 8 implementer completed the operator-authorized
continuation at `bb435f4` and `0712627`. The readiness subset passed five
consecutive repetitions; acceptance passed 22/22; combined focused groups
passed 117/117 and 162/162; and the full suite passed 1,515 with 1 skipped.
Build, type-check, generated parity, validation, smoke, live acceptance,
evidence/privacy, skill versions, internal flags, docs build, changed-file
lint/format, provider sync/dogfood, residue, and orphan-process checks passed.

### Independent Phase 8 review

**Artifact:** `reviews/p08-review-2026-07-24T125308Z.md`
**Verdict:** passed — 0 Critical, 0 Important, 1 Medium, 0 Minor

The review independently verified all 14 tasks and the full matrix. Its
mechanical reconnaissance launch was rejected before start by the thread
limit, so the primary reviewer covered the lane inline and recorded complete
orchestration evidence. The non-blocking Medium notes that provider-state
fingerprinting resets per-entry limits across an unbounded number of
provider-root entries; it should receive an aggregate entry/byte/time budget
in follow-up work. Per-phase blocking policy requires zero Critical and zero
Important findings, so no Phase 8 fix loop was opened.

### Fresh final lifecycle review after Phase 8

**Artifact:** `reviews/final-review-2026-07-24T130507Z.md`
**Verdict:** blocked — 0 Critical, 1 Important, 1 Medium, 0 Minor

The Important finding identifies unbounded full-body transcript reads while
building exact Cursor identity candidates. The Medium resurfaces the
provider-state fingerprint scan's missing aggregate budget. Both are
auto-dispositioned for bounded fix tasks because this was an automatic final
review. The operator's explicit authorization to continue through reviews and
a fresh gate generation is the review-cycle override for this new Phase 8
basis.

### Final review received

**Source:** `reviews/archived/final-review-2026-07-24T130507Z.md`
**Disposition:** `I1 → p08-t15`, `M1 → p08-t16`

The auto-review path converted both findings without a disposition prompt.
`p08-t15` removes full-body transcript reads from exact identity indexing and
adds a finite duplicate-session index budget. `p08-t16` applies aggregate
entry/byte/time budgets to provider-state preservation scans. No finding was
deferred or rejected.

### Final-review fix outcome

`p08-t15` completed at `998892c` with path-derived identity and finite
duplicate-index budgets; focused identity/runtime passed 117/117 and
observer/core compatibility passed 565/565. `p08-t16` completed at `9c90704`
with aggregate pre/post provider-state budgets and fail-visible diagnostics.
The final matrix passed 1,522 tests with 1 skipped, live acceptance 19/19,
evidence validation over 34 files, the 34-page docs build, provider sync
188/188, dogfood parity, privacy, residue, and orphan-process checks.

### Fresh final re-review after bounded scan fixes

**Artifact:** `reviews/final-review-2026-07-24T133133Z.md`
**Verdict:** blocked — 0 Critical, 2 Important, 0 Medium, 0 Minor

The first Important finding identifies a post-run cleanup path where exhausting
the aggregate time budget while scanning a later provider root replaces all
partial discovery with an empty artifact set. That can leave an exactly proven
new provider artifact behind. The fix must preserve partial exact discoveries
or separate preservation scanning from cleanup discovery so every exactly
owned artifact is removed under its own finite bounds.

The second Important finding identifies lifecycle bookkeeping drift:
`implementation.md` records Phase 8 only in a summary table, while the live OAT
status parser recognizes canonical task sections. Live status therefore reports
40/56 total and 0/16 for Phase 8 despite the completed commits. The fix must add
canonical task sections for every Phase 8 task and verify status by read-back.

The independent reviewer attempted the required reconnaissance lane; launch was
rejected before start by the agent-thread limit, so it completed the lane inline
and recorded the fallback. The operator's authorization to continue through
reviews and a fresh gate generation remains the review-cycle override.

### Fresh final re-review received

**Source:** `reviews/archived/final-review-2026-07-24T133133Z.md`
**Disposition:** `I1 → p08-t17`, `I2 → p08-t18`

The automatic review converted both Important findings into bounded tasks
without a disposition prompt. `p08-t17` prevents a later provider-root budget
failure from discarding already proven cleanup ownership and gives exact
artifact removal its own finite aggregate bounds. `p08-t18` records all Phase 8
outcomes in the canonical task-section shape and requires live OAT status
read-back. No finding was deferred or rejected.

### Fresh final re-review fix outcome

`p08-t17` completed at `e8de07d` with distinct finite budgets for preservation,
exact cleanup discovery, removal, and reinspection. Cross-root entry, byte, and
elapsed-time exhaustion cannot discard already proven artifacts. Focused tests
passed 141/141, the full suite passed 1,526 with 1 skipped, and live acceptance
passed 19/19.

`p08-t18` completed at `40b2022` with canonical task sections for all 18 Phase 8
tasks. Live OAT status read-back now reports Phase 8 at 18/18 and the project at
58/58 with no current task or blocker. Build parity, type-check, validation,
smoke, evidence, docs, provider, privacy, residue, and orphan-process gates
passed.

### Canonical Phase 8 task outcomes

### Task p08-t01: Await native stdout delivery before checkpoint commit

**Status:** completed
**Commit:** `6da8f79`
**Outcome:** Deferred checkpoint commit until native Cursor stdout delivery is
confirmed.

### Task p08-t02: Advance beyond delivered same-turn stability candidates

**Status:** completed
**Commit:** `0376ec7`
**Outcome:** Advanced selection past already delivered same-turn candidates.

### Task p08-t03: Enforce watch runtime budgets through stability waits

**Status:** completed
**Commit:** `59dcc97`
**Outcome:** Propagated the remaining watch deadline through stability waits.

### Task p08-t04: Require canonical transcript identity before exact ownership

**Status:** completed
**Commit:** `103e915`
**Outcome:** Required successful canonicalization and containment for exact
Cursor transcript ownership.

### Task p08-t05: Reject unsupported top-level assistant content

**Status:** completed
**Commit:** `ca4f573`
**Outcome:** Rejected unsupported top-level assistant content shapes
fail-closed.

### Task p08-t06: Bound Cursor digests by structural turn identity

**Status:** completed
**Commit:** `2a07bd8`
**Outcome:** Sliced Cursor digest output at the selected structural `turnId`.

### Task p08-t07: Claim substantive completion before safe no-op suffixes

**Status:** completed
**Commit:** `4601949`
**Outcome:** Bound collaboration completion claims to the substantive selected
completion boundary.

### Task p08-t08: Synchronize collaboration ambient declarations

**Status:** completed
**Commit:** `b02ddc7`
**Outcome:** Synchronized ambient collaboration declarations and consumer
coverage.

### Task p08-t09: Enforce a hard acceptance-probe process timeout

**Status:** completed
**Commit:** `0a9442c`
**Outcome:** Added finite TERM-to-KILL process bounds to acceptance probing.

### Task p08-t10: Require provider version evidence for live promotion

**Status:** completed
**Commit:** `bf24dde`
**Outcome:** Required successful provider-version evidence before live
promotion.

### Task p08-t11: Verify pre-existing provider state remains unchanged

**Status:** completed
**Commit:** `2c68bb6`
**Outcome:** Fingerprinted declared provider roots and failed visibly when
pre-existing state changed.

### Task p08-t12: Keep active and terminal gate bookkeeping evidence-safe

**Status:** completed
**Commit:** `b606771`
**Outcome:** Kept accepted and terminal gate bookkeeping within the sanitized
evidence contract.

### Task p08-t13: Reconcile Cursor current-state summary

**Status:** completed
**Commit:** `bb435f4`
**Outcome:** Reconciled Cursor documentation, provider synchronization, and
release-state claims.

### Task p08-t14: Stabilize acceptance-probe readiness and run final gates

**Status:** completed
**Commit:** `0712627`
**Outcome:** Added the child-readiness handshake and passed the complete release
matrix.

### Task p08-t15: Bound exact Cursor identity indexing

**Status:** completed
**Commit:** `998892c`
**Outcome:** Made duplicate identity indexing path-only, aggregate-bounded, and
fail-visible.

### Task p08-t16: Bound aggregate provider-state preservation scans

**Status:** completed
**Commit:** `9c90704`
**Outcome:** Added shared entry, byte, and elapsed-time budgets to pre-run and
post-run provider-state preservation.

### Task p08-t17: Preserve exact cleanup under budget exhaustion

**Status:** completed
**Commit:** `e8de07d`
**Outcome:** Separated bounded preservation from exact cleanup discovery and
removed retained exact artifacts under independent finite cleanup bounds.

### Task p08-t18: Record canonical Phase 8 task completion

**Status:** completed
**Commit:** this commit (`chore(p08-t18): record canonical phase 8 completion`)
**Outcome:** Added parser-recognized Phase 8 task sections while preserving the
existing summary and review history.

---

## Deviations from Plan / Design

Document any intentional deviations from the original plan, spec, or design. Include accepted review findings where the shipped implementation is source of truth and a lifecycle artifact needs alignment.

| Task / Review | Source Artifact | Planned / Documented | Actual / Accepted | Reason | Source of Truth | Follow-up |
| ------------- | --------------- | -------------------- | ----------------- | ------ | --------------- | --------- |
| p01-t02, p01-t04 | `plan.md` | Only the explicitly listed canonical, test, build, and generated files | Added exact `.oxfmtrc.json` and `.oxlintrc.json` entries for four new generated outputs | Existing generated-output synchronization tests and repository policy require these exclusions | Repository config plus generated-output validator | Recorded as a bounded file-boundary adaptation; no design/spec change |
| p02-t02 | `plan.md` | Add the generated Cursor state module | Added exact `.oxfmtrc.json` and `.oxlintrc.json` exclusions for `cursor-state.mjs` | Repository generated-output policy requires the exclusion | Repository config plus generated-output validator | Bounded file-boundary adaptation |
| p02-t03 | `plan.md` | Regenerate state runtime output | Added the exact `state.js` to `cursor-state.mjs` import rewrite in `scripts/build-generated.mjs` | Generated ESM must resolve the emitted module filename | Canonical build mapping | Bounded generated-output adaptation |
| p04-t06 | `plan.md` | Limit safety-matrix changes to collaboration tests/runtime files | Added required `index_base` to three intended-valid v2 fixtures in `tests/transcript-core/cursor-analysis.test.ts` through append-only integration fix `f84dfd8` | Phase-wide validation exposed stale fixtures that contradicted p04-t05's intentional missing-attribute fail-closed contract | Wake-envelope v2 parser contract and full-suite validation | Bounded test-fixture adaptation; no production change |
| p04 review fix | `reviews/p04-review-2026-07-23T224300Z.md` | Fix Codex-owner/Cursor-peer continuity in hook/runtime adapter | Also added frame analysis modules to `codex-install.mjs` hook bundle dependencies | Full fix verification exposed missing installed-hook runtime dependencies | Codex hook bundle plus full-suite validation | Bounded packaging adaptation required by the reviewed fix |
| p05-t06 | `plan.md` | Gate verification should not require product edits unless a failure identifies one | Replaced multiline declaration-free imports in two tooling tests with equivalent one-line namespace imports | Aggregate type-check showed the multiline `@ts-expect-error` placement did not suppress both module-resolution diagnostics | TypeScript aggregate gate plus 17 focused tests | Narrow gate-implicated test-only correction |

## Test Results

Track test execution during implementation.

| Phase | Tests Run | Passed | Failed | Coverage |
| ----- | --------- | ------ | ------ | -------- |
| 1     | Focused re-review + full suite | 137 focused; 1,148 full; 1 skipped | 0 | Frames, analyzer, runtimes, generated outputs, Export compatibility |
| 2     | Fix-task re-review + full suite | 146 focused; 1,327 full; 1 skipped | 0; review passed | Atomic lock publication, exact raw-alias containment, Cursor v2 recovery guidance, generated outputs |
| 3     | Phase-wide suite after review fixes | 1,363 passed; 1 skipped | 0 | Digest/observation/delivery v2, exact uncertain replay, read-only confirmation, durable fail-visible watch health, CLI semantics, v1 compatibility |
| 4     | Full suite after review Critical fix | 1,407 passed; 1 skipped | 0 | Both owner runtimes, Cursor frame continuity, collaboration matrix, wake v1/v2 compatibility |
| 5     | Full suite after review evidence fixes | 41 focused; 204 targeted; 1,448 full; 1 skipped; fresh probe 19/19 | 0 | Quoted-identity/range/taxonomy enforcement, exact live promotion claims, docs/contracts, provider dogfood |
| 6     | Full suite after provider-state containment fix | 38 focused; 1,464 full; 1 skipped; both live modes 4/4 cleanup | 0 | Exact provider-root ownership, fail-closed cleanup, executable bounded recipes, buffered-manual fallback |
| 8     | Full release matrix after terminal-gate remediation | 117 + 162 focused; 1,515 full; 1 skipped; readiness subset 5 consecutive passes | 0 | Delivery confirmation, stability budgets, exact identity/content/turns, completion claims, probe safety, evidence hygiene |
| final-fix-1 | Full suite after repaired-buffer state fix | 38 focused; 1,465 full; 1 skipped | 0 | Explicit null preservation, repaired-frame advancement, heartbeat/status zero-lag reporting, generated runtime, provider dogfood |
| final-fix-2 | Full suite after durable transcript-count fix | 60 focused; 1,465 full; 1 skipped | 0 | Validated count transitions, result-less preservation, repaired-frame durable/status/heartbeat agreement, generated runtime, provider dogfood |

## Final Summary (for PR/docs)

**What shipped:**

- Content-first, physical-frame Cursor transcript observation with exact
  session/cwd identity, isolated state v2, crash-safe migration, continuity
  recovery, schema-aware digest/review/catch-up, bounded foreground watch, and
  fail-visible status.
- Bounded two-session collaboration with schema-aware completion, lease v6
  private continuity, atomic delivery/wake claims, duplicate/no-op suppression,
  deterministic cleanup, and compatibility across Cursor/Codex owner routes.
- Sanitized live capability evidence, canonical support labels, shipped
  documentation, synchronized skill versions/user installs, and closed
  transcript-store/stronger-wake investigation backlogs.

**Behavioral changes (user-facing):**

- Cursor observation now follows actual content frames and terminal successful
  turns instead of assuming every physical record is user-visible content.
- Ambiguous identity, transcript replacement, partial frames, uncertain
  delivery, failed watch health, and malformed completion/wake contracts fail
  closed with explicit recovery/status guidance.
- Cursor autonomous callback tiers remain unavailable or unsupported on the
  measured provider; buffered-manual is the honest, bounded fallback.

**Key files / modules:**

- `src/transcript/core/` — streaming Cursor frames, structural turn analysis,
  shared runtime classification, and generated transcript knowledge.
- `src/transcript/session-observer/` — Cursor state, identity, continuity,
  digest/observation, watch, status, and CLI composition.
- `skills/session-observer-collab/` — lease/completion/wake control, both owner
  runtime hooks, evidence inventory, and provider-specific operating guidance.
- `documentation/docs/` — user and engineering contracts for Cursor
  observation, collaboration, and generated-runtime topology.

**Verification performed:**

- Final release matrix: 1,515 tests passed with 1 skipped; focused groups
  passed 117/117 and 162/162; evidence validator 34 files; build/type/build-check,
  validation, smoke, docs format/build (34 pages), skill-version enforcement,
  exact changed-file lint/format, and OAT provider synchronization passed.
- Independent Phase 1 through Phase 8 reviews passed after bounded fixes. The
  fresh final lifecycle review fixes `p08-t15` and `p08-t16` are complete;
  re-review follows.

**Design deltas (if any):**

- No stronger Cursor wake adapter was implemented because finite authenticated
  probes found top-level Stop and managed-subagent callbacks ineffective, no
  existing scheduled surface, and the private cloud worker outside the
  credential/external-service authority boundary.
- The planned evidence-based fallback rule therefore selected buffered-manual;
  this is a measured disposition, not a reduced safety guarantee.

## References

- Plan: `plan.md`
- Design: `design.md`
- Spec: `spec.md`
