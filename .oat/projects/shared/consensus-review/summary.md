---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-09-17
oat_generated: true
oat_summary_last_task: p09-t07
oat_summary_revision_count: 0
oat_summary_includes_revisions: []
---

# Summary: Consensus Review

## Overview

Consensus Review adds a bounded, independent review step between freeform Phone a Friend advice and convergent Evaluate. It gives a host agent one traceable reviewer invocation over an explicit scope while preserving honest evidence about what was requested, inspected, checked, and changed. Implementation completed all 14 active tasks across p06–p09; three post-gate final-review cycles passed, and configured exit-gate attempt 2/2 was received as allowed/passed.

## What Was Implemented

- One canonical `consensus-review` skill now generates both the standalone `skills/consensus-review` installation and the Consensus plugin's local `review` skill. Both ship the same skill-owned `scripts/review.mjs`; there is no `consensus review` dispatcher subcommand.
- Review supports exactly three bounded selectors: a base-branch diff, explicit repository files, or one document that may be inside or outside the worktree. Missing or conflicting scope fails before dispatch, and the host skill gathers scope interactively when the user did not supply one.
- Strict ordered `defaults.reviewers` configuration, host exclusion, explicit same-provider consent, capability preflight, model/effort forwarding, and one-attempt execution select one reviewer without a hidden fallback invocation.
- Provider-specific read-only transport reuses the existing runner while allowing Review to disable the generic submit sidecar. Capture and request inputs are bounded during reads; external destinations, inherited depth, symlinks, FIFOs, and other non-regular inputs fail closed.
- Private run state lives outside the worktree. Each run captures its request, selected evidence, Git identities, reviewer selection, before/after selected-path evidence, validated JSON result, and either deterministic Markdown or a labeled diagnostic.
- An owned schema and fixed deep validator enforce scope echo, verdict consistency, nested finding structure, source-version locations, checks, limitations, and provenance. The renderer emits stable Critical/Important/Medium/Minor IDs and OAT-compatible Markdown without making OAT a runtime dependency.
- Documentation covers configuration, the three selectors, installation forms, host identity, evidence limits, retention, exit codes, and full-path handoffs. Deterministic fixtures cover clean, all-severity, and defective diagnostic receipt behavior.
- Configured-gate remediation restored shared mixed-marker host priority, made a matching explicit parent authoritative for Review, bound fixture bytes to the renderer, and rejected unsafe request files before open. Later lifecycle cleanup aligned project status and archived PJM references.

## Key Decisions

- **Skill-owned Review executable.** Two install forms needed identical behavior without coupling the Consensus runtime to a product skill or widening the generic dispatcher. The canonical Review skill therefore owns the executable and its build closure; standalone and plugin-local distributions are generated from that owner. Changes must update canonical source, versions, changelog, and generated outputs together.
- **Explicit v1 review selectors.** Broad implicit review scope would make evidence and user intent ambiguous. V1 accepts only base-branch diff, selected files, or one document, with the host collecting missing details and the non-interactive CLI returning a usage error instead of guessing. Staged-only, unstaged-only, and committed-range selectors remain outside v1.
- **Host-aware single review.** Review is an independent inspection, not a convergence loop. Ordered defaults prefer a provider different from the host, same-provider review requires a pinned reviewer and explicit consent, and execution gets one attempt with no model-repair or provider fallback. Host/depth evidence is resolved once and reused for preflight and dispatch.
- **Scoped external review state.** Runtime capture should not add unrequested files to the reviewed worktree. Runs are stored under private XDG/home state keyed by canonical worktree path, while drift checks cover HEAD, index, status, and selected-path identities before and after dispatch. This deliberately reports stable evidence only within that coverage, not universal filesystem isolation.
- **Deterministic review contract.** Peer output cannot be trusted as host evidence or treated as a clean review when incomplete. Review owns a strict JSON schema, fixed semantic validation, host evidence aggregation, and deterministic Markdown rendering; OAT consumes the resulting artifact optionally rather than defining the runtime contract.

## Design Deltas

- The user-approved smaller design replaced an initial wider selector set and whole-worktree hashing concept with three selectors and selected-path drift comparison. This reduced v1 complexity while making the unmonitored-path limitation explicit.
- The planned Fable receipt exercise used an independent Codex alternate with `oat-review-receive` 1.4.1. Historical fixture bytes were exercised end to end; refreshed fixtures are separately proven byte-identical to renderer output and are not represented as a second receiver run.
- The configured exit gate added four product-hardening tasks, and post-gate review added three lifecycle-artifact alignment tasks. These closed safety and record-consistency gaps without adding another product mode or provider invocation.

## Notable Challenges

- The first standalone bundle to include the provider runner exposed confinement, exclusive-publication, bounded-read, and inherited-depth failure boundaries. Independent phase and final reviews drove fail-closed fixes with source and copied-install regressions.
- Mixed provider markers made host detection ambiguous across Claude, Codex, and Cursor shells. The final contract preserves explicit-parent precedence and the established ambient Claude → Codex → Cursor priority for existing callers, while Review rejects unknown or contradictory explicit context before invocation.
- Final review required multiple narrow bookkeeping cycles after the product fixes were already correct. Separate append-ordered review events preserved exact provenance instead of rewriting earlier receipts.

## Tradeoffs Made

- Selected-path drift checks are bounded and auditable, but unchanged Git status can hide content changes outside the selected set; ignored paths and transient write-then-revert activity are not fully monitored.
- One attempt prevents hidden extra spend and preserves reviewer independence, but a malformed response, timeout, or concrete model failure becomes an incomplete run rather than triggering automatic repair or fallback.
- External run state avoids repository churn and supports truthful diagnostics, but retention and cleanup remain operator-managed.
- Provider read-only controls and prompts reduce mutation risk but do not provide universal filesystem or network isolation because provider tools retain their normal environment and credentials.

## Integration Notes

- Author product changes under `src/skills/consensus-review/` and shared runner/config changes under `src/plugins/consensus/`; regenerate declared payloads with `pnpm run build` rather than editing `skills/` or `plugins/*/skills/` directly.
- `defaults.reviewers` is an additive schema-v1 key with whole-list precedence. Older binaries reject it; current configuration and changelog documentation name the first supported versions.
- Verification finished with 118 focused post-gate tests and full premerge at 2,030 passed with one skipped, plus build, type-check, generated freshness, validation, smoke, 11-skill version/changelog validation, 72 internal-flag checks, declared PJM health, changed-file static checks, current-OAT docs generation, and a 52-page production docs build.
- Independent p06, p07, p09, and final reviews passed their blocking thresholds. The configured cross-family gate passed on attempt 2/2 and was durably received; its remaining Medium and Minor observations were rejected with recorded rationale rather than converted into hidden debt.

## Follow-up Items

- Product live-provider execution, external/global installation, native continuation, fresh-session discovery, publication, release, push, PR, and merge were not authorized or verified by this implementation run. Fixture receipt evidence does not establish those acceptance layers.
- Staged-only, unstaged-only, and committed-range selectors remain deliberately deferred until a concrete review cannot be expressed with the three v1 selectors.
- Final HiLL approval and the configured closeout sequence remain lifecycle actions; they are not evidence of product release or live-provider acceptance.

## Associated Issues

- Completed and archived [BL-260916-add-consensus-review-cross](../../../repo/pjm/backlog/archived/BL-260916-add-consensus-review-cross.md). Its kickoff handoff was consumed and deliberately removed at immutable commit `aad79ef5`.

## Workflow Observations

### 2026-09-17 · structural · oat gate review · plan

target=claude-fable-skip-permissions threshold=important findings=critical:0,important:0,medium:2,minor:4 exit=0 status=ok artifact=.oat/projects/shared/consensus-review/reviews/artifact-plan-review-2026-09-17T000849Z.md run=128cf9b8-0007-4de1-a310-ec5383e43c90

### 2026-09-17 · structural · oat-project-implement · resume-state-reconciliation

Implementation paused before task execution because implementation.md points to p06-t01 while state.md has oat_current_task null; explicit approval is required to reconcile durable pointers and continue. consensus-review-resume-drift-20260917T0022Z

### 2026-09-17 · structural · oat-project-implement · p06

Phase p06 outcome: BLOCKED before edits because the accepted dispatch packet carried an incorrect full phase base SHA; tasks=0/2, fix-loops=0, worktree clean. consensus-review-p06-blocked-20260917T0048Z

### 2026-09-17 · structural · oat-project-implement · stop

STOP triggered by accepted p06 implementer terminal BLOCKED on phase-base mismatch; no replacement or fallback is authorized in this run. consensus-review-stop-base-mismatch-20260917T0048Z

### 2026-09-17 · structural · oat-project-implement · p06

Phase p06 outcome: BLOCKED after two immutable task commits because full and focused verification repeat three mechanical inventory omissions plus one non-p06 refine peer-ordering failure; tasks=2/2, review=not-run, recovery=0/10, worktree clean. consensus-review-p06-direction-required-20260917T0118Z

### 2026-09-17 · structural · oat-project-implement · stop

STOP triggered by accepted p06 direction-required event before recovery reservation: repeated refine peer-ordering failure is outside the p06 changed surface; preserve task commits and require operator direction before mechanical inventory recovery. consensus-review-stop-peer-ordering-20260917T0118Z

### 2026-09-17 · structural · oat-project-implement · p06

Phase p06 outcome: PASSED independent review round 2 at ae059dfb with findings=critical:0,important:0,medium:0,minor:0; 170 focused and 1,958 full-suite tests passed, recovery settled at 1/10, worktree clean. consensus-review-p06-passed-20260917T0338Z

### 2026-09-17 · structural · oat-project-implement · p07

Phase p07 outcome: PASSED independent review round 2 at fa01afbe with findings=critical:0,important:0,medium:0,minor:0 after one bounded fix iteration; 115 focused and 1,994 full-suite tests passed, recovery unused, worktree clean. consensus-review-p07-passed-20260917T0436Z

### 2026-09-17 · structural · oat-project-implement · p08

Phase p08 implementation outcome: DONE with tasks=2/2, recovery=2/10 settled, fixture-only receipt acceptance and PJM closure complete; terminal root verification passed 92 focused tests, premerge 2,010 passed plus one skipped, version/internal/PJM/docs gates, worktree clean. Final lifecycle review remains pending. consensus-review-p08-tasks-complete-20260917T0529Z

### 2026-09-17 · structural · oat-project-review-provide · final

Final lifecycle review returned CHANGES_REQUESTED at b5fe65d8 with critical:0, important:1, medium:1, minor:0; reconnaissance attempted and reconciled. Artifact: reviews/final-review-2026-09-17T053248Z.md. consensus-review-final-review-20260917T053248Z

### 2026-09-17 · structural · oat-project-implement · final-review

Final lifecycle review PASSED round 3 at c60f3fe3 with critical:0, important:0, medium:0, minor:0 after two bounded fix iterations; artifacts and exact provenance preserved. consensus-review-final-review-passed-20260917T0608Z

### 2026-09-17 · structural · oat gate review · final

target=cursor-fable-5-1-high threshold=important findings=critical:0,important:1,medium:1,minor:2 exit=1 status=blocked artifact=.oat/projects/shared/consensus-review/reviews/final-review-2026-09-17T062233Z.md run=87133850-151e-4827-9d7b-7cfd854c5724

### 2026-09-17 · structural · oat-project-review-receive · final

Configured exit-gate attempt 1/2 was corroborated and received at `9b5bcb4b`; findings=critical:0,important:1,medium:1,minor:2, all accepted as p09-t01 through p09-t04. Status remains blocked pending remediation. consensus-review-gate-received-20260917T063250Z

### 2026-09-17 · structural · oat-project-implement · p09

Phase p09 outcome: PASSED independent review at 40f8016f with findings=critical:0,important:0,medium:1,minor:0; nonblocking M1 evidence clarification completed at 14c991bd, root verification passed 26 tests, recovery=0/10, tracked worktree clean. consensus-review-p09-passed-20260917T0705Z

### 2026-09-17 · structural · oat-project-review-provide · final

Post-gate final review sequence PASSED round 3 at 62cc7054 with findings=critical:0,important:0,medium:0,minor:0 after three bounded cycles; artifacts preserve exact provenance, including attempted reconnaissance in round 1. consensus-review-post-gate-final-passed-20260917T073608Z

### 2026-09-17 · structural · oat gate review · final

target=cursor-fable-5-1-high threshold=important findings=critical:0,important:0,medium:1,minor:1 exit=0 status=ok artifact=.oat/projects/shared/consensus-review/reviews/final-review-2026-09-17T074525Z.md run=14836d4a-5d65-43a1-9d78-ec3b9d300a4b
