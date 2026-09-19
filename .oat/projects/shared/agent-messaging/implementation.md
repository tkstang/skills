---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-09-19
oat_current_task_id: p02-t01
oat_generated: false
---

# Implementation: agent-messaging

**Started:** 2026-09-19
**Last Updated:** 2026-09-19

This file tracks implementation, not planning completion. The user authorized
this existing `backlog-triage` worktree as the implementation worktree on
2026-09-19. Phase 1 implementation, both bounded review-fix rounds, and their
recoveries are complete. The phase awaits its final independent re-review before
Phase 2 begins.

## Progress Overview

| Phase   | Status  | Tasks | Completed |
| ------- | ------- | ----- | --------- |
| Phase 1 | re_review_pending | 5     | 5/5       |
| Phase 2 | pending | 4     | 0/4       |
| Phase 3 | pending | 3     | 0/3       |
| Phase 4 | pending | 1     | 0/1       |

**Total:** 5/13 tasks completed

## Phase 1: Independent mailbox and shared log (5 tasks)

**Status:** re_review_pending
**Started:** 2026-09-19

### Task p01-t01: Define schemas, root resolution, and no-clobber publication

**Status:** completed
**Commit:** 93e72857fafc96bc60a550723fc1982635ed4f9c

### Task p01-t02: Implement membership, takeover, departure, and closure

**Status:** completed
**Commit:** 3153e88e52d7f87e97ac9d7577f17c8809fe462f

### Task p01-t03: Implement addressed messages and explicit receipts

**Status:** completed
**Commit:** dcd29c5ea776b1f0b938d4b6d4a67b0abbc27473

### Task p01-t04: Implement authoritative log entries and a regenerable view

**Status:** completed
**Commit:** 7c8a7580e65f4169158aa2c3d7b12eb5b69ad9ff

### Task p01-t05: Ship the manual CLI and dedicated skill in both forms

**Status:** completed
**Commit:** 2817142d8506477f2dda718f7e7f2eae68aa02df

**Recovery commit:** 7739c65aed577b6e87de318bdf95cdba86eaa744

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

### Run 1 — 2026-09-19

#### Worktree override

- Scope: all sequential implementation phases in this run.
- Worktree: `/Users/tstang/orca/workspaces/skills/backlog-triage`.
- Disposition: the user explicitly directed implementation to remain in this
  existing worktree; no additional Codex task or worktree will be created.
- Source of truth: the amended execution boundary in `plan.md` and this run
  record supersede the earlier separate-worktree direction.

#### Preflight

- Tier: Tier 1, subagents available without additional authorization.
- Dispatch policy: managed `high` from project state.
- Checkpoints: final phase only (`p04`), with automatic checkpoint review enabled
  from workflow configuration.
- Schedule: `p01` → `p02` → `p03` → `p04`, sequential in this worktree.
- Status: Phase 1 implementation returned `DONE_WITH_CONCERNS`; one mechanical
  release-inventory defect was recovered and the remaining concerns are carried
  into independent review.

#### Dispatch: p01 implementation

```yaml
request_id: dispatch-agent-messaging-p01-8973e8cb-7090-4db8-b498-2e58c40b4d68
caller: oat-project-implement
scope: phase:p01
objective: Execute all five Phase 1 tasks in order with one verified commit per task.
action: implementation
role_name: oat-phase-implementer-gpt-5-6-sol-medium
role_class: worker
provider: codex
dispatch_context: root-native
dispatch_policy: high
dispatch_ceiling: high
catalog_snapshot:
  id: codex-native-2026-09-19-p01
  source: tool-schema
  observed_at: 2026-09-19T13:33:00Z
authority: write:phase-p01
role_selector: oat-phase-implementer-gpt-5-6-sol-medium
model_selector: gpt-5.6-sol
model_selector_granularity: exact
effort_selector: medium
reasoning_mode_selector: null
service_tier_selector: priority
guidance_reference: subagent-orchestration/references/provider-codex.md
guidance_version: 2026-07-25
guidance_verified_at: 2026-07-25
guidance_status: review-required
task_class: default-implementation
model_class_floor: default-implementation
classification_source: caller
classification_reason: Bounded multi-file implementation with filesystem concurrency and safety tests across five dependent tasks.
floor_satisfaction: satisfied
selection_source: native-default
candidates_considered:
  - gpt-5.6-sol/medium
  - gpt-5.6-sol/high
selection_reason: native-catalog
selected_route: native
deadline_seconds: 7200
retry_limit: 0
payload:
  phase_base: 91f5f2383883e6dd5f4506ebf6371d26099f59ad
  plan_scope: plan.md#phase-1-independent-mailbox-and-shared-log-5-tasks
launch_status: accepted
child_outcome: done-with-concerns
configured_invocation_evidence:
  - resolver-report:p01
  - "Dispatch: scope=p01 action=implementation role=implementer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:medium dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-sol-medium"
runtime_confirmation: not-reported
diagnostics:
  - phase-report:2817142d
continuation_events:
  - cont-agent-messaging-p01-recover-1:7739c65a:completed
  - cont-agent-messaging-p01-review-fix-1:7bf347f3:completed
  - cont-agent-messaging-p01-review-fix-2:66de3e5b:completed
  - cont-agent-messaging-p01-fix-2-test-recovery:5d94e390:completed
```

Dispatch policy: high; selected=medium; cap=high (codex, enforced — variant
`oat-phase-implementer-gpt-5-6-sol-medium`).

#### Phase Implementation Report: p01

- Request: `dispatch-agent-messaging-p01-8973e8cb-7090-4db8-b498-2e58c40b4d68`.
- Base/head before recovery: `91f5f2383883e6dd5f4506ebf6371d26099f59ad`
  → `2817142d8506477f2dda718f7e7f2eae68aa02df`.
- Task commits: `93e72857`, `3153e88e`, `dcd29c5e`, `7c8a7580`,
  `2817142d`, in planned order with exact planned subjects.
- Phase verification: 48/48 focused tests, `build:check`, `validate`,
  type-check, scoped oxlint/oxfmt, and documentation build passed.
- Optional nested dispatch: none.
- Worktree: clean on return.
- Review inputs: the implementer reported incomplete direct coverage of some
  plan-listed adversarial scenarios and a possible closed-collaboration exit-code
  mismatch. These are review evidence, not silently accepted dispositions.

### Recovery Event cont-agent-messaging-p01-recover-1

- Phase/task: p01 / p01-t05
- Original request: dispatch-agent-messaging-p01-8973e8cb-7090-4db8-b498-2e58c40b4d68
- Original commit: 2817142d8506477f2dda718f7e7f2eae68aa02df
- Defect class: test
- Discovered by: `pnpm run test:vitest tests/release/versioning.test.ts`
- Disposition: recovered
- Authorization: phase-standing
- Attempt: 1/10
- Dispatch target: oat-phase-implementer-gpt-5-6-sol-medium
- Recovery commit: 7739c65aed577b6e87de318bdf95cdba86eaa744
- Verification: focused 9/9 and p01 48/48 passed before and after the recovery
  commit; `build:check` and `validate` also passed.
- Reason: the new canonical skill required one mechanically derived pinned
  shipped-skill expectation; no production behavior or inventory changed.

#### Dispatch: p01 review round 1

```yaml
request_id: dispatch-agent-messaging-p01-review-35bd08eb-ea49-4c1c-954a-d7ef73de0984
caller: oat-project-implement
scope: phase:p01
objective: Independently review Phase 1 implementation against the approved plan and repository contracts.
action: review
role_name: oat-reviewer-gpt-5-6-sol-high
role_class: reviewer
provider: codex
dispatch_context: root-native
dispatch_policy: high
dispatch_ceiling: high
catalog_snapshot:
  id: codex-native-2026-09-19-p01-review
  source: tool-schema
  observed_at: 2026-09-19T14:02:00Z
authority: write:review-artifact-only
role_selector: oat-reviewer-gpt-5-6-sol-high
model_selector: gpt-5.6-sol
model_selector_granularity: exact
effort_selector: high
reasoning_mode_selector: null
service_tier_selector: priority
guidance_reference: subagent-orchestration/references/provider-codex.md
guidance_version: 2026-07-25
guidance_verified_at: 2026-07-25
guidance_status: review-required
task_class: hard-reasoning
model_class_floor: hard-reasoning
classification_source: caller
classification_reason: Independent load-bearing review of filesystem concurrency, safety, packaging, and protocol semantics.
floor_satisfaction: satisfied
selection_source: gate-target
candidates_considered:
  - gpt-5.6-sol/high
selection_reason: gate-target
selected_route: native
deadline_seconds: 7200
retry_limit: 0
payload:
  phase_base: 91f5f2383883e6dd5f4506ebf6371d26099f59ad
  reviewed_head: 8866df01da3041e49d8b530e7e5d005059783330
  artifact: reviews/code-p01-review-2026-09-19T140258Z.md
launch_status: accepted
child_outcome: blocking
configured_invocation_evidence:
  - resolver-report:p01-review
  - "Dispatch: scope=p01 action=review role=reviewer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-reviewer-gpt-5-6-sol-high"
runtime_confirmation: not-reported
diagnostics:
  - findings:critical=0,important=9,medium=2,minor=0
  - reconnaissance:not-attempted
```

No project-log review-orchestration entry was added because the reviewer
reported reconnaissance as `not-attempted`; exactly one valid signal was
consumed for this round.

### Review Fix Event cont-agent-messaging-p01-review-fix-1

- Phase: p01
- Original request: dispatch-agent-messaging-p01-8973e8cb-7090-4db8-b498-2e58c40b4d68
- Review artifact: reviews/code-p01-review-2026-09-19T140258Z.md
- Reviewed head: 8866df01da3041e49d8b530e7e5d005059783330
- Fix base: e46e0f717a998f7afa82c16480a3de3fff6e6b38
- Disposition: fixes_completed; independent re-review pending
- Attempt: 1/2
- Dispatch target: oat-phase-implementer-gpt-5-6-sol-medium
- Dispatch stamp: `Dispatch: scope=p01-fix-1 action=fix role=fix producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:medium dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-sol-medium`
- Fix commit: 7bf347f309a0fc63d40e246513e3bd96f2622c45
- Findings addressed: 0 Critical, 9 Important, 2 Medium, 0 Minor.
- Verification: root reproduced the focused suite, full suite (2,108 passed,
  1 skipped), `build:check`, `validate`, type-check, and smoke against the exact
  fix commit. The implementer also passed skill-version validation, docs build,
  scoped lint/format, and diff checks.

#### Dispatch: p01 review round 2

```yaml
request_id: dispatch-agent-messaging-p01-review-2-629bea79-1b87-449a-bb02-7773fcb70831
caller: oat-project-implement
scope: phase:p01
objective: Independently re-review the complete Phase 1 implementation and round-1 fixes.
action: review
role_name: oat-reviewer-gpt-5-6-sol-high
role_class: reviewer
provider: codex
dispatch_context: root-native
dispatch_policy: high
dispatch_ceiling: high
authority: write:review-artifact-only
role_selector: oat-reviewer-gpt-5-6-sol-high
model_selector: gpt-5.6-sol
model_selector_granularity: exact
effort_selector: high
service_tier_selector: priority
selection_source: review-target
selected_route: native
payload:
  prior_reviewed_head: 8866df01da3041e49d8b530e7e5d005059783330
  fix_commit: 7bf347f309a0fc63d40e246513e3bd96f2622c45
  reviewed_head: 67b811def41104d75a05d6175229e6e5539ccc9d
  artifact: reviews/code-p01-rereview-2026-09-19T1445Z.md
launch_status: accepted
child_outcome: blocking
configured_invocation_evidence:
  - resolver-report:p01-review-2
  - "Dispatch: scope=p01-review-2 action=review role=reviewer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-reviewer-gpt-5-6-sol-high"
runtime_confirmation: not-reported
diagnostics:
  - findings:critical=0,important=6,medium=1,minor=0
  - reconnaissance:not-attempted
```

No project-log review-orchestration entry was added because the reviewer
reported reconnaissance as `not-attempted`; exactly one valid signal was
consumed for this round.

### Review Fix Event cont-agent-messaging-p01-review-fix-2

- Phase: p01
- Original request: dispatch-agent-messaging-p01-8973e8cb-7090-4db8-b498-2e58c40b4d68
- Review artifact: reviews/code-p01-rereview-2026-09-19T1445Z.md
- Reviewed head: 67b811def41104d75a05d6175229e6e5539ccc9d
- Fix base: 2cdc63630ed5e589d3161e4992dc7409beb2e775
- Disposition: fixes_completed; final independent re-review pending
- Attempt: 2/2
- Dispatch target: oat-phase-implementer-gpt-5-6-sol-medium
- Dispatch stamp: `Dispatch: scope=p01-fix-2 action=fix role=fix producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:medium dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-sol-medium`
- Fix commit: 66de3e5b1b52ad0c5147dd00305db0d33dd17fdd
- Findings addressed: 0 Critical, 6 Important, 0 Medium, 0 Minor; the sole
  Medium tracking finding was resolved in the review-receive commit.
- Verification: binding-cap, stale-join, takeover replay, ancestor containment,
  authoritative integrity, actual-runtime SIGKILL barriers, and two-process
  sender contention all have direct tests.

### Recovery Event cont-agent-messaging-p01-fix-2-test-recovery

- Phase/task: p01 / review-fix round 2 proof
- Original request: dispatch-agent-messaging-p01-8973e8cb-7090-4db8-b498-2e58c40b4d68
- Original fix commit: 66de3e5b1b52ad0c5147dd00305db0d33dd17fdd
- Defect class: test
- Discovered by: root sequential `pnpm run test`
- Disposition: recovered
- Authorization: phase-standing
- Attempt: 2/10
- Dispatch target: oat-phase-implementer-gpt-5-6-sol-medium
- Recovery commit: 5d94e390b341d82d2e92d00cf661808ac7e8704f
- Cause: the second fast child could exit before its sequentially attached exit
  listener, leaving the process-contention test pending until Vitest timeout.
- Verification: pre-attached exit promises, bounded internal deadlines, and
  guaranteed cleanup passed 10 repeated target runs and two worker full-suite
  runs. Root reproduced the target and full suite (2,116 passed, 1 skipped),
  `build:check`, `validate`, type-check, smoke, and version validation.

<!-- orchestration-runs-end -->

## Implementation Log

- Phase 1 implemented immutable collaboration storage, membership, addressed
  messages, the append-only collaboration log, and the manual agent-messaging
  CLI/distributions in five planned commits.
- Root transition verification reproduced the 48 focused tests and discovered
  the release-versioning inventory gap; the original phase handle recovered it
  in append-only commit `7739c65a` with attempt 1/10.
- Review-fix round 1 resolved all 11 findings in commit `7bf347f3`; root
  reproduced the full repository and Phase 1 verification before re-review.

## Review Received: p01 round 1

**Date:** 2026-09-19
**Review artifact:** [Phase 1 code review](reviews/code-p01-review-2026-09-19T140258Z.md)
**Reviewed head:** `8866df01da3041e49d8b530e7e5d005059783330`
**Findings:** 0 Critical, 9 Important, 2 Medium, 0 Minor.
**Status:** fixes_completed; independent re-review pending.

The blocking review found two missing repository inventory expectations,
insufficient record validation and join crash recovery, unbounded writer and
acknowledged-history paths, missing `--reply-to`, incorrect inactive exit codes,
unreported close/takeover races, unsafe rendered-view reads, incomplete
adversarial proof, missing creation/staleness context, and fail-open closed-marker
inspection. All findings remain within the existing p01 task scope; no task IDs
were added or renumbered.

Fix round 1 completed at `7bf347f309a0fc63d40e246513e3bd96f2622c45`.
The original Phase 1 handle implemented every review disposition and added the
required protocol, safety, packaging, and adversarial verification. No finding
was deferred.

## Review Received: p01 round 2

**Date:** 2026-09-19
**Review artifact:** [Phase 1 re-review](reviews/code-p01-rereview-2026-09-19T1445Z.md)
**Reviewed head:** `67b811def41104d75a05d6175229e6e5539ccc9d`
**Findings:** 0 Critical, 6 Important, 1 Medium, 0 Minor.
**Status:** fixes_completed; final independent re-review pending.

The re-review confirmed six prior findings resolved but found binding-cap
publication, stale initial-join retry, takeover inbox classification, ancestor
symlink containment, canonical integrity for membership/receipt records, and
real process-isolation proof still incomplete. The Medium tracking-staleness
finding is resolved in this review-receive bookkeeping commit by updating the
current test, summary, blocker, and next-milestone sections. The six product and
proof findings remain within existing p01 scope; no task IDs were added.

Fix round 2 completed at `66de3e5b1b52ad0c5147dd00305db0d33dd17fdd`.
Its process-contention proof was stabilized without weakening coverage in
append-only recovery commit `5d94e390b341d82d2e92d00cf661808ac7e8704f`.
All seven round-2 findings are resolved; final independent re-review is pending.

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

**Historical next step (completed 2026-09-19):** Begin p01-t01 through
oat-project-implement after confirming execution checkpoints. This was planning
closeout guidance; implementation subsequently started in the user-designated
current worktree.

## Deviations from Plan / Design

The third review identified an over-broad ownership policy, not shipped code
drift. The user approved the narrowed policy and explicit acknowledgment/
attestation boundaries; discovery/design/plan agreed at that planning boundary.
This is historical planning-review context; product code now exists.

| Task / Review        | Source Artifact    | Planned / Documented                                                         | Actual / Accepted                                                                     | Reason                                                                 | Source of Truth               | Follow-up             |
| -------------------- | ------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------- | --------------------- |
| Third gate I1/m2     | design.md, plan.md | Observer registration refusal; unspecified Claude inventory                  | Dormant hooks allowed, scoped third-party acknowledgment, explicit Claude attestation | User-approved usable and honest ownership boundary                     | Updated discovery/design/plan | Independent re-review |
| Fourth gate I1/M1/m1 | design.md, plan.md | Claude composition implicit; broad inventory; triggered recovery unspecified | Dedicated p04-t01 Monitor, bounded inventory and explicit disarm recovery             | User-approved complete implementation path with conservative ownership | Updated discovery/design/plan | Independent re-review |
| Run 1 worktree       | plan.md            | Create a separate visible Codex worktree before implementation                 | Implement in the existing `backlog-triage` worktree                                   | Explicit user direction on 2026-09-19                                  | Updated plan/implementation  | None                  |

## Test Results

Phase 1 product verification is current through review-fix round 1. The second
bounded fix round is active and must rerun the complete gate before re-review.

| Phase | Tests Run | Passed | Failed | Coverage |
| ----- | --------- | ------ | ------ | -------- |
| 1     | 87 focused + full suite (2,108 tests); build/check/validate/type/smoke | all | 0 | Phase implementation and review-fix round 1 |
| 2     | -         | -      | -      | -        |
| 3     | -         | -      | -      | -        |
| 4     | -         | -      | -      | -        |

## Final Summary (for PR/docs)

Phase 1 is implemented but not yet accepted: re-review round 2 found six
Important issues and the final bounded Phase 1 fix round is active. Phases 2–4,
publication, installation, merge, and live acceptance remain incomplete.

## References

- [Plan](plan.md)
- [Approved design](design.md)
- [Discovery](discovery.md)
