---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-07-12
oat_current_task_id: p01-t01
oat_generated: false
---

# Implementation: session-observer-collab

**Started:** 2026-07-12
**Last Updated:** 2026-07-12

> Resume at `oat_current_task_id`. Reviews are tracked in `plan.md`, not as implementation tasks.

## Progress Overview

| Phase | Status | Tasks | Completed |
| --- | --- | ---: | ---: |
| p01 — Transcript semantics | in_progress | 4 | 0 |
| p02 — Identity and watch behavior | pending | 5 | 0 |
| p03 — Collaboration protocol/control | pending | 4 | 0 |
| p04 — Codex adapter | pending | 3 | 0 |
| p05 — Cursor and Claude adapters | pending | 3 | 0 |
| p06 — Integration and closeout | pending | 5 | 0 |

**Total:** 0/24 tasks completed

## Phase p01: Normalize collaboration-bearing transcript semantics

- [ ] `p01-t01` Render queued Claude input exactly once
- [ ] `p01-t02` Classify synthetic wakes as automatic control input
- [ ] `p01-t03` Buffer Cursor activity through terminal completion
- [ ] `p01-t04` Guarantee recoverable user-message content

## Phase p02: Harden identity and watch behavior

- [ ] `p02-t01` Add fail-closed `whoami`
- [ ] `p02-t02` Suppress empty watch deltas without losing offsets
- [ ] `p02-t03` Detect standalone-watch baseline gaps
- [ ] `p02-t04` Warn about newer same-cwd sessions
- [ ] `p02-t05` Regenerate and document the base observer surface

## Phase p03: Establish the collaboration protocol and control plane

- [ ] `p03-t01` Scaffold the canonical sibling skill
- [ ] `p03-t02` Author the runtime-neutral N=2 protocol
- [ ] `p03-t03` Implement versioned lease state and control operations
- [ ] `p03-t04` Normalize substantive completion and continuation selection

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

## Orchestration Runs

<!-- orchestration-runs-start -->
<!-- orchestration-runs-end -->

## Deviations from Plan / Design

| Date | Scope | Deviation | Disposition |
| --- | --- | --- | --- |
| - | - | None | - |

## Final Summary (for PR/docs)

_Fill after implementation._
