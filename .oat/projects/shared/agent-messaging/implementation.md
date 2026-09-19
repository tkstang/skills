---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-09-19
oat_current_task_id: p01-t01
oat_generated: false
---

# Implementation: agent-messaging

**Started:** Not started
**Last Updated:** 2026-09-19

This file tracks implementation, not planning completion. The next plan task is
p01-t01; the plan is ready, but execution awaits an authorized visible worktree.
No product code, hooks or installed skills have been changed by this plan review.

## Progress Overview

| Phase   | Status  | Tasks | Completed |
| ------- | ------- | ----- | --------- |
| Phase 1 | pending | 5     | 0/5       |
| Phase 2 | pending | 4     | 0/4       |
| Phase 3 | pending | 3     | 0/3       |
| Phase 4 | pending | 1     | 0/1       |

**Total:** 0/13 tasks completed

## Phase 1: Independent mailbox and shared log (5 tasks)

**Status:** pending
**Started:** -

### Task p01-t01: Define schemas, root resolution, and no-clobber publication

**Status:** pending
**Commit:** -

### Task p01-t02: Implement membership, takeover, departure, and closure

**Status:** pending
**Commit:** -

### Task p01-t03: Implement addressed messages and explicit receipts

**Status:** pending
**Commit:** -

### Task p01-t04: Implement authoritative log entries and a regenerable view

**Status:** pending
**Commit:** -

### Task p01-t05: Ship the manual CLI and dedicated skill in both forms

**Status:** pending
**Commit:** -

## Phase 2: Finite activation and host delivery (4 tasks)

**Status:** pending
**Started:** -

### Task p02-t01: Implement activation epochs, finite claims, and recovery

**Status:** pending
**Commit:** -

### Task p02-t02: Add fail-closed Codex and Claude boundary adapters

**Status:** pending
**Commit:** -

### Task p02-t03: Add finite request-only watch notifications

**Status:** pending
**Commit:** -

### Task p02-t04: Build bounded host probes and acceptance evidence

**Status:** pending
**Commit:** -

## Phase 3: Observer Stop composition and distribution docs (3 tasks)

**Status:** pending
**Started:** -

### Task p03-t01: Put observer collaboration logs in the shared container

**Status:** pending
**Commit:** -

### Task p03-t02: Compose one continuation owner and preserve observer cursors

**Status:** pending
**Commit:** -

### Task p03-t03: Prepare docs, release surfaces, and distribution verification

**Status:** pending
**Commit:** -

## Phase 4: Claude composed Monitor and final acceptance (1 task)

**Status:** pending
**Started:** -

### Task p04-t01: Add the single finite Claude composed Monitor

**Status:** pending
**Commit:** -

## Orchestration Runs

<!-- orchestration-runs-start -->

No implementation orchestration runs yet.

<!-- orchestration-runs-end -->

## Implementation Log

No implementation has started. The scaffold's example completed-task entry was
removed during planning bookkeeping; it never represented completed work.

## Review Received: plan

**Date:** 2026-09-19
**Review artifact:** [Plan gate review](reviews/archived/artifact-plan-review-2026-09-19T014304Z.md)
**Findings:** 0 Critical, 0 Important, 3 Medium, 4 Minor.
**User decision:** Approve all seven proposed plan corrections.
**New tasks added:** None; existing 12 task IDs and phase counts are unchanged.
**Status:** fixes_completed; re-review pending.

All findings are resolve_in_artifact:

| ID  | Scope      | Resolution                                                                                                               |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| M1  | Minor      | Removed absent Session README targets; existing documentation site owns plugin docs.                                     |
| M2  | Minor      | p02-t01 owns immutable bounded/redacted diagnostics and status tests; p02-t02 publishes them.                            |
| M3  | Minor      | p02-t02 refuses competing/uncertain automatic ownership; watch and live probes inherit the guard before p03 composition. |
| m1  | Minor      | p01 names wrong-owner, relative/mismatched override and conflicting explicit-identity tests.                             |
| m2  | Minor      | p01-t05/p03-t03 own generated documentation/index.md; staging preserves pre-existing unrelated edits.                    |
| m3  | Minor      | p01-t05 reports unresolved mail on close/leave without acknowledging it.                                                 |
| m4  | Negligible | Inline artifact-review Invocation cell normalized; every review row retained.                                            |

The gate returned status=ok and receiveEligible=true with matched run, project,
invocation and artifact handoff. It passed the Important threshold, not a
zero-finding review. Gate scope provenance: legacy-plan-only. Configured Fable
invocation is corroborated. The gate envelope omitted runtime identity; root
subsequently verified claude-fable-5-1 in the matching native Claude transcript
c079e4e6-8818-465d-841a-4518c7e405ec, assistant lines 19 and 266, ending with
end_turn and containing the exact gate run ID. Frontier identity is corroborated.
No deferred/rejected findings or design departures.

**Subsequent verification:** The independent second gate reviewed eec9583b and
confirmed all seven corrections. Its four additional findings are recorded in
reviews/archived/artifact-plan-review-2026-09-19T021241Z.md. Counts: 0 Critical,
0 Important, 2 Medium, 2 Minor. The gate returned
status=ok, receiveEligible=true and a corroborated handoff; it passed the
Important threshold, not a zero-finding check.

### Review Received: plan (second gate)

**Date:** 2026-09-19
**Review artifact:** [Second plan gate](reviews/archived/artifact-plan-review-2026-09-19T021241Z.md)
**User decision:** Approve all four proposed corrections.
**Status:** fixes_completed; re-review pending. No tasks added or renumbered.

All four are resolve_in_artifact:

- M1 (Minor scope): p03-t02 binds the single composed controller to the epoch,
  changes CLI/hooks/watch/registration, and runs both messaging and observer tests.
- M2 (Minor scope): p02-t02 names hook scopes, caller-selected launcher marker,
  lease path/schema/effective-state semantics and a test-only parity contract;
  shipped runtime dependencies stay unchanged.
- m1 (Minor scope): both skills receive exact-message-ID dedup and inbox-first
  instructions in p03-t02.
- m2 (Negligible scope): p03-t03 supplies an executable stdin formatter command
  for the backlog item, retaining managed-block and generated-index boundaries.

Frontier identity was verified from Claude transcript
7c6df088-35f6-47be-b380-71abd861dd71: claude-fable-5-1, assistant lines 19
and 247, final end_turn. No findings were deferred or rejected.

**Subsequent verification:** Third gate reviewed e287517c and verified these four
corrections. It returned a corroborated, receive-eligible blocked result with
0 Critical, 1 Important, 1 Medium and 2 Minor findings:
reviews/archived/artifact-plan-review-2026-09-19T030934Z.md. The root confirmed that the
observer hook allows stop when its exact session lease is missing, so the plan's
registration-alone refusal is too broad. Third-party Stop-hook handling is a
product-policy choice; the user subsequently approved the acknowledgment policy.

### Review Received: plan (third gate)

**Date:** 2026-09-19
**Review artifact:** [Third plan gate](reviews/archived/artifact-plan-review-2026-09-19T030934Z.md)
**Findings:** 0 Critical, 1 Important, 1 Medium, 2 Minor.
**User decision:** Approve the recommended ownership policy and all three other corrections.
**Status:** fixes_completed; re-review pending. No tasks added or renumbered.

All four are resolve_in_artifact:

- I1 (Moderate scope): p02-t02 permits dormant recognized observer registrations,
  refuses active/uncertain observer ownership, and requires explicit scoped-config
  acknowledgment for unrelated hooks. Propagated to probes, watch, composition,
  discovery and design, with activation metadata and boundary rechecks.
- M1 (Minor scope): p03-t02 has two ordered implementation stages, messaging-side
  controller support then observer integration, with green scoped tests between.
- m1 (Minor scope): triggered leases remain owner-present; add a reply-wait
  armed-to-triggered regression fixture.
- m2 (Minor scope): Claude uses explicit acting-session no-observer-Monitor
  attestation at enable and watch start/re-arm, not fictitious host enumeration.

No deferrals or rejections. Frontier identity was corroborated from native Claude
transcript f6953764-c455-4bce-aaaa-072771890652 (claude-fable-5-1, assistant
lines 19 and 252, final end_turn). The blocked gate is not relabeled passed.

**Subsequent verification:** Fourth gate reviewed c0a61d53 and verified these
corrections. It returned a corroborated, receive-eligible blocked result with
0 Critical, 1 Important, 1 Medium and 3 Minor findings. Artifact:
reviews/archived/artifact-plan-review-2026-09-19T125014Z.md (original commit e0cd3890).
Frontier identity is verified in native Claude transcript
51f413a7-4496-47a2-82e0-7b76ae8f2fb7: claude-fable-5-1, assistant lines
19 and 253, final end_turn, matching run ID c94b55d0-0138-409d-aca6-ed4703fa8c99.

Fourth-round findings and the root's proposed resolutions, subsequently approved:

- I1: Claude composed delivery lacks an owned implementation path. Root verified
  the current Monitor uses base session-observer catch-up-then-watch, outside
  the task's files. Recommend a dedicated composed-Monitor task because the
  cross-runtime collaboration use case needs it; explicit deferral is smaller.
- M1: Bound Claude settings/enabled-plugin inventory and disclose session-only
  hooks as a visibility limit instead of implicitly making all Claude delivery
  manual. Requires an explicit policy clarification, not silent waiver.
- m1: effectiveLease does not expire triggered state. Recommend retaining the
  conservative guard with explicit scoped disarm recovery, rather than blindly
  releasing it on expiry: expiry alone does not prove a same-Stop continuation
  was not already emitted. This is root analysis, not an applied disposition.
- m2: Publish the full schema-v1 activation shape in p02-t01 before live probes.
- m3: Point the approved-baseline header to the user-approved c0a61d53 amendment.

### Review Received: plan (fourth gate)

**Date:** 2026-09-19
**Review artifact:** [Fourth plan gate](reviews/archived/artifact-plan-review-2026-09-19T125014Z.md)
**User decision:** Approve the dedicated Claude composed Monitor and other
proposed corrections, including conservative explicit disarm recovery.
**Status:** fixes_completed; independent re-review pending.

- I1 (Moderate scope), resolve_in_artifact: add the explicitly user-approved
  p04-t01 implementation task, with an owned finite command, actual bundled
  reader/CAS seams, tests, packaging and final acceptance. Existing IDs stay
  unchanged; 4 sequential phases / 13 pending tasks. This is a plan-completeness
  amendment, not a code-review fix queue or authorization to implement now.
- M1 (Minor scope), resolve_in_artifact: define Claude settings/enabled-plugin
  inventory, unresolved-source refusal, session-only visibility limits and tests.
- m1 (Minor scope), resolve_in_artifact with alternative remedy: retain triggered
  refusal even after expiry and document explicit scoped disarm; reject automatic
  expiry release because it does not establish same-Stop continuation safety.
- m2 (Minor scope), resolve_in_artifact: publish complete schema-v1 activation
  metadata from p02-t01, preserving records from earlier live probes.
- m3 (Negligible scope), resolve_in_artifact: name c0a61d53 as the approved
  ownership amendment and carry the latest complete project into implementation.

Bounded read-only source recon used native explorer claude_watcher_seam on
gpt-5.6-terra/high (intelligent-recon floor; available native selector). Root
verified buildDigest, private cursor/CAS helpers and permitted observer source
roots before drafting; root retained all dispositions and artifact writes.
No findings deferred. No product source or installed state changed.

**Subsequent verification:** Fifth gate 94c9a069-05df-4541-84ef-5b56f699c674
reviewed the committed amendments at 6c718f223921b891cbd9ecf49d720ca7b0534d12
and verified all five fourth-round corrections. It passed the Important threshold
with 0 Critical, 0 Important, 2 Medium and 2 Minor findings. Structured result:
status=ok, receiveEligible=true, non-null handoff and matched run/project/invocation.
Artifact reviews/archived/artifact-plan-review-2026-09-19T131345Z.md and its received
ledger row are committed at 1cab7972. Native Claude transcript
c9973509-aef1-45f1-8fce-26dbf7671808 corroborates claude-fable-5-1 at
assistant lines 19 and 216, final end_turn, with this exact run ID.

Fifth-round artifact remedies below were explicitly approved and applied
(no task IDs added or product work authorized):

- M1 (Minor scope): agree interrupted observation needs a distinct status and
  recovery contract. Recommend manual observer catch-up, not a new automatic
  retry protocol. Qualify the review's suggestion: normal reads advance public
  observer state, not the private collab lease cursor. Recovery must not promise
  private advancement, refund a slot or clear the claimed range; same-range
  automatic replay remains suppressed for that epoch. Test pre-CAS interruption,
  quiet-peer re-arm, manual read availability and unknown post-attempt outcome.
- M2 (Minor scope): agree; add three ordered green checkpoints inside p04-t01
  for lease/control, Monitor/claims/packaging, then messaging capability/docs and
  final acceptance. Preserve one task ID and its atomic commit.
- m1 (Minor scope): agree; add owner-contract.test.ts to p04-t01's Modify and
  Verify lists and cover Claude owner standalone refusal versus verified composition.
- m2 (Negligible scope): agree; move the backlog formatting instruction into
  p04-t01 and describe the host's file-edit tool generically. No early closure.

**Disposition:** M1/M2/m1/m2 resolve_in_artifact, fixes_completed. The user then
requested skipping an additional gate after these corrections. Local verification
closes planning under that one-time rerun waiver; the historical event is not
relabeled passed and future Frontier gates remain enabled. Archive:
reviews/archived/artifact-plan-review-2026-09-19T131345Z.md. No product tests were
run because only planning artifacts changed.

**Next:** Begin p01-t01 through oat-project-implement in an authorized visible
Codex worktree/task, after confirming execution checkpoints. No execution starts
as part of this planning closeout.

## Deviations from Plan / Design

The third review identified an over-broad ownership policy, not shipped code
drift. The user approved the narrowed policy and explicit acknowledgment/
attestation boundaries; discovery/design/plan now agree. No product code exists.

| Task / Review        | Source Artifact    | Planned / Documented                                                         | Actual / Accepted                                                                     | Reason                                                                 | Source of Truth               | Follow-up             |
| -------------------- | ------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------- | --------------------- |
| Third gate I1/m2     | design.md, plan.md | Observer registration refusal; unspecified Claude inventory                  | Dormant hooks allowed, scoped third-party acknowledgment, explicit Claude attestation | User-approved usable and honest ownership boundary                     | Updated discovery/design/plan | Independent re-review |
| Fourth gate I1/M1/m1 | design.md, plan.md | Claude composition implicit; broad inventory; triggered recovery unspecified | Dedicated p04-t01 Monitor, bounded inventory and explicit disarm recovery             | User-approved complete implementation path with conservative ownership | Updated discovery/design/plan | Independent re-review |

## Test Results

No product tests run: this review changes planning artifacts only.

| Phase | Tests Run | Passed | Failed | Coverage |
| ----- | --------- | ------ | ------ | -------- |
| 1     | -         | -      | -      | -        |
| 2     | -         | -      | -      | -        |
| 3     | -         | -      | -      | -        |
| 4     | -         | -      | -      | -        |

## Final Summary (for PR/docs)

Not implemented or shipped. Fill from verified implementation evidence at
completion; planning/review checks are not product acceptance.

## References

- [Plan](plan.md)
- [Approved design](design.md)
- [Discovery](discovery.md)
