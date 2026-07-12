---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_orchestration_retry_limit: 3
oat_last_updated: 2026-07-12
oat_current_task_id: null
oat_generated: false
---

# Implementation: session-observer-collab

**Started:** 2026-07-12
**Last Updated:** 2026-07-12

> Resume at `oat_current_task_id`. Reviews are tracked in `plan.md`, not as implementation tasks.

## Progress Overview

| Phase | Status | Tasks | Completed |
| --- | --- | ---: | ---: |
| p01 — Transcript semantics | completed | 4 | 4 |
| p02 — Identity and watch behavior | completed | 5 | 5 |
| p03 — Collaboration protocol/control | blocked_review | 4 | 4 |
| p04 — Codex adapter | pending | 3 | 0 |
| p05 — Cursor and Claude adapters | pending | 3 | 0 |
| p06 — Integration and closeout | pending | 5 | 0 |

**Total:** 13/24 tasks completed

## Phase p01: Normalize collaboration-bearing transcript semantics

- [x] `p01-t01` Render queued Claude input exactly once — `fabdb35`
- [x] `p01-t02` Classify synthetic wakes as automatic control input — `16d774c`, fixes `ef39157`, `a964137`
- [x] `p01-t03` Buffer Cursor activity through terminal completion — `355acca`, fixes `f003a02`, `ed6e411`
- [x] `p01-t04` Guarantee recoverable user-message content — `2f77c65`, format `dc578e8`

### Phase p01 Summary

**Outcome:** Claude queued input is rendered once; automatic wake envelopes retain non-human provenance; Cursor turns emit only at terminal completion without losing buffered user/tool/assistant/diagnostic entries across incremental polls; user recovery pointers preserve original source indices.

**Key files:** `src/transcript/core/runtimes.ts`, `src/transcript/session-observer/lib/{digest,session-classifier,types,watch}.ts`, and targeted runtime/observer fixtures and tests.

**Verification:** 118 targeted tests passed across runtime, digest, watch, and locate suites; `pnpm run type-check`, changed-file `oxfmt --check`, and `git diff --check` passed.

**Review:** Initial review found 1 Critical, 1 Important, and 1 Minor issue. Two bounded fix iterations resolved all findings; final managed review passed with zero findings.

## Phase p02: Harden identity and watch behavior

- [x] `p02-t01` Add fail-closed `whoami` — `53b35c6`, fixes `9eb5247`, `f409bb1`
- [x] `p02-t02` Suppress empty watch deltas without losing offsets — `1237a91`
- [x] `p02-t03` Detect standalone-watch baseline gaps — `e41e6cd`
- [x] `p02-t04` Warn about newer same-cwd sessions — `38283af`
- [x] `p02-t05` Regenerate and document the base observer surface — `e6e36cf`, quality fix `644dad2`

### Phase p02 Summary

**Outcome:** `whoami` resolves authoritative aliases or same-cwd runtime candidates and fails closed on conflicting/ambiguous signals; quiet-empty advances offsets without noise; standalone watch detects unread baseline gaps; watchers warn without auto-switching when a newer same-cwd session appears; base/export generated bundles and skill versions are synchronized.

**Key files:** canonical observer CLI/observe/locate/watch/types modules, generated Session Observer and shared Export Session Transcript bundles, both skill manifests, release/build tooling, focused fixtures/tests, and Session Observer skill docs.

**Verification:** canonical build/build:check; 114 focused CLI/locate/watch/tooling/release tests; type-check; repository validation; two changed-skill version checks; changed-file lint/format; diff and clean-tree checks.

**Review:** Initial review found one Important harness-signal gap. Review iteration 1 exposed an Important same-cwd filtering defect; iteration 2 resolved it. Final managed review passed with zero findings.

## Phase p03: Establish the collaboration protocol and control plane

- [x] `p03-t01` Scaffold the canonical sibling skill — `a5ec157`
- [x] `p03-t02` Author the runtime-neutral N=2 protocol — `8bb9cc7`
- [x] `p03-t03` Implement versioned lease state and control operations — `a5620c8`, fixes `a7c9f00`, `40343fe`
- [x] `p03-t04` Normalize substantive completion and continuation selection — `5fd8ee7`, fixes `e99c970`, `50dc0d7`

### Phase p03 Summary

**Outcome:** The canonical collaboration skill, runtime-neutral protocol, dependency-free lease/control plane, adapter interface, and completion selector are implemented. Task and integration tests pass, but phase review remains blocked after the configured fix limit.

**Verification:** 68 p03 tests, type-check, repository validation, build parity, changed-file quality, dependency/provider-mirror boundaries, and diff checks pass.

**Review blocker:** After two review-fix iterations, 3 Important findings remain (Claude peer-runtime pins, fail-closed legacy peer-runtime migration, self-expiring waiting deadline) plus 1 Medium concurrent installation-lock finding. p04/p05 were not started.

## Phase p04: Implement and validate the Codex lifecycle adapter

- [ ] `p04-t01` Implement the thin Codex Stop hook
- [ ] `p04-t02` Complete Codex install, trust, and lifecycle operations
- [ ] `p04-t03` Run the Codex acceptance harness

## Phase p05: Implement Cursor and Claude harness adapters

- [ ] `p05-t01` Implement the Cursor Stop-hook adapter
- [ ] `p05-t02` Document and probe Cursor lifecycle behavior
- [ ] `p05-t03` Author and verify the Claude Code Monitor recipe

## Phase p06: Integrate, document, and close the evidence loop

- [ ] `p06-t01` Integrate skill distribution and release invariants
- [ ] `p06-t02` Publish user and engineering documentation
- [ ] `p06-t03` Record all intentional v2 deferrals
- [ ] `p06-t04` Run the full acceptance and sanitization matrix
- [ ] `p06-t05` Verify clean closeout and installation handoff

## Review and Planning Notes

- Human co-author review approved `design.md` and `plan.md`; three Minor artifact findings were applied.
- Managed plan review found two Important readiness-bookkeeping issues; both were fixed and re-review passed clean.
- Cross-runtime quick-start gate receipt was explicitly skipped by the user; its uncorroborated artifact was archived without consumption.
- Project dispatch policy is managed `high` using the user-level candidate ladder.
- Phase gate review is enabled for `p06` only.
- HiLL checkpoint is confirmed for final phase `p06`; auto-review at that checkpoint is enabled.
- p02 initially blocked because p02-t01's CLI verification exercised generated output owned by p02-t05. The plan now verifies canonical source in p02-t01 through p02-t04 and defers generated-bundle CLI integration to p02-t05; no task scope or product behavior changed.
- p02-t05's generated boundary includes the Export Session Transcript runtime bundle because p01 changed shared canonical `src/transcript/core/runtimes.ts`; the canonical build owns both generated copies.
- The shared runtime output also requires an `export-session-transcript` skill version bump under the repository's changed-skill invariant; p02 terminal quality fixes own that metadata-only adjustment.
- The user explicitly authorized one additional p03 review-fix iteration; retry limit is 3 for this run.

## Orchestration Runs

<!-- orchestration-runs-start -->

### Run 1 — 2026-07-12 15:20 CDT

**Branch:** `session-observer-collab`
**Tier:** 1
**Policy:** merge-strategy=merge, retry-limit=2
**Phases:** 1 executed, 1 passed, 0 failed, 0 stopped

#### Phase Outcomes

| Phase | Implementer | Review | Fix Iterations | Disposition |
| --- | --- | --- | ---: | --- |
| p01 | DONE | pass | 2/2 | completed on orchestration branch |

#### Parallel Groups

- p01: sequential

#### Dispatch Notes

- `Dispatch: scope=p01 action=implementation role=implementer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-sol-high`
- `Dispatch: scope=p01-t01 action=implementation role=implementer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-terra effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-terra-high`
- `Dispatch: scope=p01-t02 action=implementation role=implementer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:medium dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-sol-medium`
- `Dispatch: scope=p01-t03 action=implementation role=implementer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:medium dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-sol-medium`
- `Dispatch: scope=p01-t04 action=implementation role=implementer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-terra effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-terra-high`
- `Dispatch: scope=p01-t03 action=fix role=fix producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-sol-high`
- `Dispatch: scope=p01-t02 action=fix role=fix producer=unknown provenance=unknown model_axis=selected:gpt-5.6-luna effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-luna-high`
- `Dispatch: scope=p01-t04 action=fix role=fix producer=unknown provenance=unknown model_axis=selected:gpt-5.6-luna effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-luna-high`
- `Dispatch: scope=p01-t02 action=fix role=fix producer=unknown provenance=unknown model_axis=selected:gpt-5.6-luna effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-luna-high`
- `Dispatch: scope=p01-t03 action=fix role=fix producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-sol-high`
- `Dispatch: scope=p01 action=review role=reviewer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-reviewer-gpt-5-6-sol-high`

#### Outstanding Items

- None

#### Artifact / Design Deltas

| Task / Review | Source Artifact | Planned / Documented | Actual / Accepted | Reason | Source of Truth | Follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| None | - | - | - | - | - | - |

### Run 2 — 2026-07-12 16:40 CDT

**Branch:** `session-observer-collab`
**Tier:** 1
**Policy:** merge-strategy=merge, retry-limit=2
**Phases:** 1 executed, 1 passed, 0 failed, 0 stopped

#### Phase Outcomes

| Phase | Implementer | Review | Fix Iterations | Disposition |
| --- | --- | --- | ---: | --- |
| p02 | DONE | pass | 2/2 | completed on orchestration branch |

#### Parallel Groups

- p02: sequential

#### Dispatch Notes

- `Dispatch: scope=p02 action=implementation role=implementer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-sol-high`
- `Dispatch: scope=p02-t01 action=implementation role=implementer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:medium dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-sol-medium`
- `Dispatch: scope=p02-t02 action=implementation role=implementer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-terra effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-terra-high`
- `Dispatch: scope=p02-t03 action=implementation role=implementer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:medium dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-sol-medium`
- `Dispatch: scope=p02-t04 action=implementation role=implementer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-terra effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-terra-high`
- `Dispatch: scope=p02-t05 action=implementation role=implementer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-terra effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-terra-high`
- `Dispatch: scope=p02-t05-quality-fix-1 action=fix role=fix producer=unknown provenance=unknown model_axis=selected:gpt-5.6-terra effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-terra-high`
- `Dispatch: scope=p02-t05-quality-fix-2 action=fix role=fix producer=unknown provenance=unknown model_axis=selected:gpt-5.6-terra effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-terra-high`
- `Dispatch: scope=p02-t01-review-fix-i1 action=fix role=fix producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:medium dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-sol-medium`
- `Dispatch: scope=p02-t01-review-fix-i1-iteration-2 action=fix role=fix producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:medium dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-sol-medium`
- `Dispatch: scope=p02 action=review role=reviewer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-reviewer-gpt-5-6-sol-high`

#### Outstanding Items

- None

#### Artifact / Design Deltas

| Task / Review | Source Artifact | Planned / Documented | Actual / Accepted | Reason | Source of Truth | Follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| p02 verification | plan.md p02 Verify/file boundaries | Generated CLI checks appeared in early canonical tasks; shared generated output/version path was omitted | Canonical tasks verify source; p02-t05 owns generated CLI/build plus both shared skill versions | Generated CLI tests execute committed bundles; shared runtime builds two skills | plan.md + canonical build graph | Plan corrected in `aa22c07`, `012e29b`, `73a6b41` |

### Run 3 — 2026-07-12 17:42 CDT

**Branch:** `session-observer-collab`
**Tier:** 1
**Policy:** merge-strategy=merge, retry-limit=2
**Phases:** 1 executed, 0 passed, 1 failed, 1 stopped

#### Phase Outcomes

| Phase | Implementer | Review | Fix Iterations | Disposition |
| --- | --- | --- | ---: | --- |
| p03 | DONE | fail | 2/2 | stopped; sequential schedule blocked |

#### Parallel Groups

- p03: sequential

#### Dispatch Notes

- Implementation: `a5ec157` (Luna/high), `8bb9cc7` (Terra/high), `a5620c8` and `5fd8ee7` (Sol/medium).
- Integration fixes: `50682de` (Luna/high), `a7c9f00` (Terra/high).
- Review fixes: `e99c970` and `50dc0d7` (Sol/medium), `40343fe` (Sol/high).
- Reviewer: `Dispatch: scope=p03 action=review role=reviewer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-reviewer-gpt-5-6-sol-high`

#### Outstanding Items

- Important: observable peer runtime validation rejects `claude-code`; separate owner-adapter runtimes from peer runtimes.
- Important: legacy migration fabricates missing `peerRuntime`; require explicit re-arm instead.
- Important: crashed waiting adapters lack a bounded deadline and can remain falsely `waiting` until lease expiry.
- Medium: installation registry read-modify-write is not locked against concurrent lost updates.
- Retry limit exhausted at 2/2; explicit user override is required to continue p03 fixes. p04/p05 were not started.

#### Artifact / Design Deltas

| Task / Review | Source Artifact | Planned / Documented | Actual / Accepted | Reason | Source of Truth | Follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| p03 review | design.md lease/control contract | Complete truthful, race-safe lifecycle control plane | Core implemented, but four review findings remain | Reviewer found uncovered edge cases after bounded fixes | review findings + implementation | Resume only with explicit retry-limit override |

<!-- orchestration-runs-end -->

## Deviations from Plan / Design

| Date | Scope | Deviation | Disposition |
| --- | --- | --- | --- |
| - | - | None | - |

## Final Summary (for PR/docs)

_Fill after implementation._
