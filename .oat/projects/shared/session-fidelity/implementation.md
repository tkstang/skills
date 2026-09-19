---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-09-19
oat_current_task_id: p00-t01
oat_generated: false
---

# Implementation: session-fidelity

No source implementation has started. The plan is ready after retained gate review and recorded finding dispositions. `oat_current_task_id` names the first planned task, not an active implementation.

## Preparatory evidence

- `c970c876`: schema documentation and dated evidence committed by Fable; docs build/format reported passing, privacy canaries independently rerun passing by the driver.
- `3e16dd9c`: driver reconciled the documentation handoff and delivery design. Later design/plan revisions incorporate Fable’s read-back.
- Stack layers are agreed, but local stack arrangement, PR publication, merge and installation have not occurred.

## Progress Overview

| Phase | Status  | Tasks | Completed |
| ----- | ------- | ----- | --------- |
| p00   | pending | 1     | 0/1       |
| p01   | pending | 4     | 0/4       |
| p02   | pending | 5     | 0/5       |
| p03   | pending | 2     | 0/2       |
| p04   | pending | 2     | 0/2       |
| p05   | pending | 2     | 0/2       |
| p06   | pending | 2     | 0/2       |

**Total:** 0/18 implementation tasks completed.

## Phase 0

**Status:** pending

### Task p00-t01: Arrange and verify the three review layers

**Status:** pending
**Commit:** -
**Verification:** not run; root-owned stack arrangement.

## Phase 1

**Status:** pending

### Task p01-t01: Resolve native Codex identity and lineage

**Status:** pending
**Commit:** -
**Verification:** not run; follow plan commands after implementation.

### Task p01-t02: Propagate exact identity through discovery and consumers

**Status:** pending
**Commit:** -
**Verification:** not run; follow plan commands after implementation.

### Task p01-t03: Reject unsafe saved positions and watcher path changes

**Status:** pending
**Commit:** -
**Verification:** not run; follow plan commands after implementation.

### Task p01-t04: Correct Claude provenance and finalize the identity layer

**Status:** pending
**Commit:** -
**Verification:** not run; follow plan commands after implementation.

## Phase 2

**Status:** pending

### Task p02-t01: Add captured fixtures and LF-only detailed source reading

**Status:** pending
**Commit:** -
**Verification:** not run; follow plan commands after implementation.

### Task p02-t02: Extract native Claude and Codex activity

**Status:** pending
**Commit:** -
**Verification:** not run; follow plan commands after implementation.

### Task p02-t03: Correlate calls and classify activity without guessing

**Status:** pending
**Commit:** -
**Verification:** not run; follow plan commands after implementation.

### Task p02-t04: Project bounded activity reports

**Status:** pending
**Commit:** -
**Verification:** not run; follow plan commands after implementation.

### Task p02-t05: Verify the shared pipeline against captured fixtures

**Status:** pending
**Commit:** -
**Verification:** not run; captured end-to-end shared pipeline coverage.

## Phase 3

**Status:** pending

### Task p03-t01: Expose activity in observer review and catch-up

**Status:** pending
**Commit:** -
**Verification:** not run; follow plan commands after implementation.

### Task p03-t02: Deliver activity-only watch deltas safely

**Status:** pending
**Commit:** -
**Verification:** not run; follow plan commands after implementation.

## Phase 4

**Status:** pending

### Task p04-t01: Add opt-in activity to Markdown export

**Status:** pending
**Commit:** -
**Verification:** not run; follow plan commands after implementation.

### Task p04-t02: Protect default sanitization and content boundaries

**Status:** pending
**Commit:** -
**Verification:** not run; follow plan commands after implementation.

## Phase 5

**Status:** pending

### Task p05-t01: Extract stable Cursor call evidence

**Status:** pending
**Commit:** -
**Verification:** not run; follow plan commands after implementation.

### Task p05-t02: Integrate Cursor settlement with observer and export

**Status:** pending
**Commit:** -
**Verification:** not run; follow plan commands after implementation.

## Phase 6

**Status:** pending

### Task p06-t01: Document and build the tested feature

**Status:** pending
**Commit:** -
**Verification:** not run; follow plan commands after implementation.

### Task p06-t02: Verify acceptance and close tracked work

**Status:** pending
**Commit:** -
**Verification:** not run; follow plan commands after implementation.

## Reviews

Plan review is pending. Code reviews are tracked in `plan.md`; none has passed.

## Final Summary

Not implemented. No feature acceptance or completion claim.

## Planning Gate Review Received — 2026-09-19

**Artifact:** reviews/archived/artifact-plan-review-2026-09-19T003400Z.md
**Gate:** `ddd86035-011c-447a-bfac-9ac6191a89fe`; configured target `cursor-fable-5-1-high`, runtime Cursor; actual model identity not reported. `status: ok`, `receiveEligible: true`, corroborated handoff; threshold Important; 0 Critical, 0 Important, 4 Medium, 3 Minor. Configured scope `legacy-plan-only`; reviewer also consulted discovery/design. These are planning findings, not implemented feature acceptance.

Findings are identified below by their order within the artifact because it supplied no explicit IDs.

- M1, observer presentation: `resolve_in_artifact`. p03-t01 now owns legacy-marker suppression, preserved operator Q/A and ask-user caveats, independent conversation limits, invocation counts and focused assertions. These were already accepted design requirements.
- M2, branch transition ownership: `resolve_in_artifact`. p00 owns docs/identity registration and `IDENTITY_BASE`; the root pre-step in p02-t01 owns activity registration, `ACTIVITY_BASE` and identity-diff verification. No extra task or repeated p00 execution is needed.
- M3, split p01-t04: `rejected_with_rationale`. The reviewer agrees the provenance helper/consumer audit is coherent. Repository instructions require the corresponding canonical versions, changelog and generated output with each behavior change. Separating those into a subsequent task/commit would weaken that atomicity. Retain 18 tasks and the full identity verification at the behavior boundary; clarify the rationale in p01-t04.
- M4, formatting override: `rejected_with_rationale`. The repository documents oxfmt and prohibits formatting generated/OAT-synced/agent-instruction files, not authored project Markdown. The planning hygiene contract requires formatting every authored artifact and uses the fallback only when no documented formatter exists. The temporary config is outside the repository and automatically removed; clarify this and explicitly exclude generated OAT indexes/dashboards. No repository config change or new formatter is needed.
- m1, undefined four sidecar classes: `resolve_in_artifact`. Replace the unsupported count with the established deferred external-output and child-trajectory scope.
- m2, draft/default prose: `resolve_in_artifact`. Use state-neutral readiness wording and name both authorized default-output corrections.
- m3, Commit-field guidance: `resolve_in_artifact`. Move sanitizer scope into the p04 Implement paragraphs; keep Commit fields message-only.

No implementation tasks added or completed. Plan stays unready pending verification of these dispositions. The gate’s project-log auto-commit hit an index lock; preserve the appended record in the normal review-bookkeeping commit.

Final structured re-review at `08622012` confirmed M1 and Minor corrections plus both rejections. It identified one remaining Medium precision issue in M2: the branch base must include phase-review fixes/bookkeeping after the p01-t04 source commit. Corrected p02-t01 to branch from the reviewed identity HEAD, verify its full SHA equals `ACTIVITY_BASE`, and require p01-t04 as an ancestor. This is part of the accepted transition-ownership correction; no scope or task-count change. The retained gate is the final verification of the corrected bundle.

## Final Planning Gate Received — 2026-09-19

**Artifact:** reviews/archived/artifact-plan-review-2026-09-19T004303Z.md
**Gate:** `a40ecbf5-e651-4bdc-8667-4d9d92eece59`, reviewed plan at `40d0405e`; configured target `claude-fable-skip-permissions`, Claude runtime, model identity not independently reported. `status: ok`, `receiveEligible: true`, corroborated handoff; Important threshold; 0 Critical, 0 Important, 1 Medium, 3 Minor. This was the second evaluated gate round; the earlier committed-baseline refusal was operational, not an evaluated round. The gate verifies all previous corrections and both rejections.

Root received the qualified artifact and resolved its four precision findings against existing requirements (no added tasks):

- M1 category lookup: `resolve_in_artifact`. p02-t03 now assigns the native category lookup, exact-name preservation and generic unknown/MCP fallback, with assertions in the existing correlate test file. Verified against design Classification and projection and the backlog classification requirement.
- m1 build checks: `resolve_in_artifact`. p01-t01 and p02-t01 explicitly build/check bundles; the shared execution contract requires the same for any bundled source change.
- m2 version fan-out: `resolve_in_artifact`. Source-root ownership is authoritative alongside actual bundle changes. Verified directly against `affectedOwners` in scripts/validate-skill-versions.ts and distribution declarations; all four transcript owners require bumps even for byte-identical bundles.
- m3 multi-export: `resolve_in_artifact`. p04-t01 explicitly labels/tests every `--all --include-activity` output, its limits/counts and unchanged filenames.

All four corrections were inspected against the cited contract and checked with targeted text assertions, the 18-task ledger comparison and diff/link checks. No further independent re-review of these final wording corrections is claimed; the review event remains `fixes_completed`. Both evaluated gate runs passed the configured threshold. All review findings have durable dispositions and no unresolved blocker remains, so quick-start completion proceeds. Implementation remains 0/18; next task is p00-t01.

Fable committed the user-requested shared Cursor gate exclusions as `80982eed`; `oat gate target list --json` verifies all four are disabled from the shared layer, with Claude/Codex available. This config-only commit leaves the reviewed project artifacts unchanged. The final gate log auto-commit again hit an index lock; its appended entry is included in normal final bookkeeping.
