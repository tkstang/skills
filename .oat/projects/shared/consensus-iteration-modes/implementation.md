---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-13
oat_current_task_id: p07-t02
oat_generated: false
---

# Implementation: consensus-iteration-modes

**Started:** 2026-06-12
**Last Updated:** 2026-06-12

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
| Phase 1 | in_progress | N     | 0/N       |
| Phase 2 | pending     | N     | 0/N       |

**Total:** 0/{N} tasks completed

---

## Phase 1: {Phase Name}

**Status:** in_progress
**Started:** 2026-06-12

### Phase Summary (fill when phase is complete)

**Outcome (what changed):**

- {2-5 bullets describing user-visible / behavior-level changes delivered in this phase}

**Key files touched:**

- `{path}` - {why}

**Verification:**

- Run: `{command(s)}`
- Result: {pass/fail + notes}

**Notes / Decisions:**

- {trade-offs or deviations discovered during implementation}

### Task p01-t01: {Task Name}

**Status:** completed / in_progress / pending / blocked
**Commit:** {sha} (if completed)

**Outcome (required when completed):**

- {what materially changed (not “did task”, but “system now does X”)}

**Files changed:**

- `{path}` - {why}

**Verification:**

- Run: `{command(s)}`
- Result: {pass/fail + notes}

**Notes / Decisions:**

- {gotchas, trade-offs, design deltas, important context for future sessions}

**Issues Encountered:**

- {Issue and resolution}

---

### Task p01-t02: {Task Name}

**Status:** pending
**Commit:** -

**Notes:**

- {Notes will be added during implementation}

---

## Phase 2: {Phase Name}

**Status:** pending
**Started:** -

### Task p02-t01: {Task Name}

**Status:** pending
**Commit:** -

---

## Orchestration Runs

_Each run from `oat-project-implement` appends an entry below with:_
_- Run header (number, timestamp, branch, tier, policy, phase counts)_
_- Phase Outcomes table_
_- Parallel Groups list_
_- Outstanding Items_

<!-- orchestration-runs-start -->

_Orchestration runs from `oat-project-implement` are appended here, most-recent-first within the file but append-only at the bottom of the log._

### Run 1 — 2026-06-13

**Branch:** feat/consensus-iteration-modes
**Tier:** 1 (subagents)
**Policy:** merge-strategy=sequential, retry-limit=2; implementer ceiling=opus, reviewer ceiling=fable
**Phases:** p01–p06 executed; 35/36 tasks complete (p01-t06→p05-t05 resequenced; p06-t06 NFR4 dogfood deferred to manual laptop run)

#### Phase Outcomes

| Phase | Implementer | Review | Fix Iterations | Disposition |
| ----- | ----------- | ------ | -------------- | ----------- |
| p01   | DONE (t01–t05) | pass (inline/fable) | 0/2 | complete; t06 → p05-t05 |
| p02   | DONE (t01–t08) | pass (inline/fable) | 1 fix (leak) | complete |
| p03   | DONE (t01–t06) | pass (inline/fable) | 0 | complete |
| p04   | DONE (t01–t06) | pass (inline/fable) | 0 | complete |
| p05   | DONE (t01–t05) | pass (inline/fable) | 0 | complete (v1 cutover + v0 gate) |
| p06   | DONE (t01–t05) | pass (inline/fable) | 0 | complete; t06 dogfood deferred (manual) |

#### Dispatch Notes

- Dispatch: p01 implementation via oat-phase-implementer at model_axis=selected:opus (dispatch ceiling opus, project state).

#### Outstanding Items

- None (p01-t06 resequenced into Phase 5 as p05-t05; see Deviations).

<!-- orchestration-runs-end -->

---

## Implementation Log

Chronological log of implementation progress.

### 2026-06-12

**Session Start:** {time}

- [x] p01-t01: {Task name} - {commit sha}
- [ ] p01-t02: {Task name} - in progress

**What changed (high level):**

- {short bullets suitable for PR/docs}

**Decisions:**

- {Decision made and rationale}

**Follow-ups / TODO:**

- {anything discovered during implementation that should be captured for later}

**Blockers:**

- {Blocker description} - {status: resolved/pending}

**Session End:** {time}

---

### 2026-06-12

**Session Start:** {time}

{Continue log...}

---

## Deviations from Plan / Design

Document any intentional deviations from the original plan, spec, or design. Include accepted review findings where the shipped implementation is source of truth and a lifecycle artifact needs alignment.

| Task / Review | Source Artifact | Planned / Documented | Actual / Accepted | Reason | Source of Truth | Follow-up |
| ------------- | --------------- | -------------------- | ----------------- | ------ | --------------- | --------- |
| p01-t06 → p05-t05 | plan.md Phase 1/5 | p01-t06 rejects v0 artifacts on resume during Phase 1 | Resequenced to Phase 5 (p05-t05), after the artifact-level v1 cutover (p05-t01) | The engine has two version fields: per-record `schema_version` (bumped to v1 in p01) and artifact-level `consensus_schema_version` (wrapper still emits v0 until Phase 5). Rejecting v0 artifacts before the wrapper emits v1 would break 6 resume test files and make the wrapper unable to resume its own output. | plan.md (corrected) | p05-t01 flips the 6 emitters to v1 + migrates resume fixtures; p05-t05 then inverts the gate. FR4 mapping updated in spec.md. |
| p06-t04 | plan.md Phase 6 / CHANGELOG | "CHANGELOG v0.2 entries"; bump version | Documented the v0.2 mode work under the existing `[0.1.0] - Unreleased` heading; did NOT bump SKILL.md/manifest version | `tests/skill-frontmatter.test.mjs` pins the skill version to 0.1.0 and `release-versioning` coordinates versions repo-wide; design's Deployment Strategy says the version bump follows the existing manifest+tag release flow. Bumping here would violate the release gate. | release flow (deferred) | The v0.1→v0.2 version bump happens in the release flow (bl-d85f area), not this project. |
| p06-t06 | plan.md Phase 6 (NFR4) | Mode-comparison dogfood: run refine in all 3 modes on a real doc, review artifacts | In progress; rolled into Phase 7 (p07-t04) | The dogfood (2026-06-13, on the mini with paseo 0.1.96 + claude + codex) validated the pipeline and surfaced real pre-existing blockers (schemas never ran against live paseo; run-dir reuse). Alternating mode converges correctly end-to-end (claude+claude, clean run). codex blocked by strict-structured-output incompat (p07-t02). NFR4 closes at p07-t04 after codex works. | plan.md (p07) | p07-t04 runs the live claude+codex comparison and records results. |
| Dogfood findings → Phase 7 (not backlog) | dogfood / plan | Initially filed as backlog bl-0cff (codex schema incompat) and bl-5966 (run-dir reuse) | Re-scoped into the project as Phase 7 fix tasks (user directive 2026-06-13: don't ship until addressed) | These are correctness/value blockers, not nice-to-haves: codex is the canonical second peer (the whole point of consensus is two different models), and run-dir reuse can make a fresh run emit wrong output. Backlog items deleted; tracked as p07-t01 (schemas, DONE: ea45752/fbc9e61/f680ad0), p07-t02 (verdict normalization), p07-t03 (run-dir isolation). | plan.md (Phase 7) | Implement p07-t02/t03, verify live (p07-t04). |

## Test Results

Track test execution during implementation.

| Phase | Tests Run | Passed | Failed | Coverage |
| ----- | --------- | ------ | ------ | -------- |
| 1     | 395       | 395    | 0      | consensus surface green |
| 2     | 419       | 419    | 0      | + parallel-revision |
| 3     | 439       | 439    | 0      | + parallel-synthesized |
| 4     | 484       | 484    | 0      | + escalation ladder |
| 5     | 500       | 500    | 0      | + resume/composition, v1 cutover |
| 6     | 513       | 513    | 0      | + docs, NFR5 event inventory, smoke |

## Final Summary (for PR/docs)

**What shipped:** v0.2 of the consensus deliberation engine — two new iteration modes plus an agency-gated escalation ladder, exposed through the `refine` skill.

- **parallel-revision mode** (`--iteration parallel_revision`): both peers revise the same input concurrently each round with own/peer critiques; converges on emergent same-round hash agreement, mutual ACCEPT_PEER, or mutual CONVERGED. 2× peer calls/round.
- **parallel-synthesized mode** (`--iteration parallel_synthesized`): parallel revision plus a wrapper-driven stateless synthesis call each round (the synthesizer merges both revisions); converges on synthesis stability. `--synthesizer <provider>` overrides the default (first peer). 2× peer + 1 synthesis call/round.
- **Agency-gated escalation ladder**: deterministic triggers (persistent_disagreement, oscillation, budget_exhausted, near_done_drift) route to user or host per a per-agency table, with genuinely-stuck promotion (repeat-fire or `defer_to_user`). Host decisions re-enter via `--host-direction` as attributed `HOST_DECISION` orchestrator rounds, distinct from user rounds. Emitted as `escalation_required` JSONL.
- **Unified v1 record schema** across all three modes (mode-aware verdicts, synthesis records, intervention rounds), with the artifact-level v0→v1 cutover and fail-closed v0-resume rejection (`SCHEMA_VERSION_MISMATCH`, no migration).
- **Resume + parallel-section composition** extended to the new record types and interruption points (mid-pair, pending-synthesis, pending-escalation); parallel-section packets carry mode/synthesizer; fan-in aggregates escalation status.

**Behavioral changes (user-facing):**

- `refine` default is unchanged (alternating); parallel modes are explicit opt-ins that disclose their call multiplier (`run_started.calls_per_round`) and report actual counts (`peer_calls`/`synthesis_calls`).
- New flags: `--iteration`, `--synthesizer`, `--host-direction`, `--host-decision-kind`. New event: `escalation_required` (the only content-bearing routine event). `run_completed` adds `sections_escalated`.
- v0 artifacts no longer resume (must finish under v0.1 or restart).

**Key files / modules:**

- `plugins/consensus/skills/refine/scripts/consensus-loop.mjs` — round-executor abstraction, parallel/synthesized executors, per-mode convergence/oscillation/stability predicates, escalation triggers + routing, v1 validation.
- `plugins/consensus/skills/refine/scripts/consensus-refine.mjs` — flags, JSONL events, v1 artifact emission, resume (incl. v0 rejection), parallel-section packets/fan-in.
- `plugins/consensus/skills/refine/schemas/{verdict-parallel,synthesis}.schema.json` — new payload schemas.
- `plugins/consensus/skills/refine/SKILL.md`, `agents/consensus-section-runner.md` — host instructions for modes + escalation.

**Verification performed:**

- `npm test` 513/513, `npm run validate` passed, `npm run smoke` passed (now includes a parallel-synthesized escalation + `--host-direction` resume scenario). FR9 alternating regression locked via a byte-identical characterization snapshot.
- **Deferred:** NFR4 mode-comparison dogfood (p06-t06) — manual laptop run with paseo + real peers + live spend.

**Design deltas (if any):**

- p01-t06 resequenced to p05-t05 (artifact-level vs record-level version fields); version bump deferred to the release flow; NFR4 dogfood deferred to a manual run. See Deviations table.

## References

- Plan: `plan.md`
- Design: `design.md`
- Spec: `spec.md`
