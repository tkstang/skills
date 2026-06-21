---
oat_generated: true
oat_generated_at: 2026-06-21
oat_review_scope: plan
oat_review_type: artifact
oat_review_invocation: manual
oat_project: .oat/projects/shared/provider-cli-hardening
---

# Plan Review - 2026-06-21

## Review Context

- Project: `provider-cli-hardening`
- Workflow mode: spec-driven
- Phase at review time: plan / in_progress
- Baseline reviewed: `a5cd93c docs: draft implementation plan for provider-cli-hardening (awaiting review)`
- Primary artifact: `.oat/projects/shared/provider-cli-hardening/plan.md`
- Alignment artifacts: `spec.md`, `design.md`, `discovery.md`, `implementation.md`, `state.md`
- Source spot checks: `src/consensus/core/types.ts`, `src/consensus/provider-cli/args.ts`, provider-cli test inventory

## Verdict

Changes requested.

## Findings

### Critical

None.

### Important

#### P01 - `require_submission` is planned as Phase 2 work even though the design defers strict mode

Evidence:

- `plan.md:649` says p02-t08 should "add an opt-in `require_submission` request flag" as part of the current implementation plan.
- `plan.md:637` scopes that task to `structured-output.ts` and `structured-output.test.ts` only.
- `design.md:174` through `design.md:185` select submit-first with parse fallback as the current no-submission behavior and describe strict require-submission mode as future tightening, not the default current design.
- `design.md:516` through `design.md:518` also frame a require-submission flag as optional future work.

Why it matters:

Adding a request-level `require_submission` flag changes the request contract, so it likely needs current-scope edits in `src/consensus/core/types.ts`, CLI/request parsing in `src/consensus/provider-cli/args.ts`, and matching parser/request tests. As written, p02-t08 either cannot be completed within its declared file scope or it silently expands Phase 2 beyond the approved design.

Required fix:

Either remove strict require-submission flag implementation from p02-t08 and keep Phase 2 focused on the approved default behavior, or explicitly promote strict mode into current scope by updating `spec.md` and `design.md` and adding the request-surface files/tests to the task. Because the design currently treats strict mode as future tightening, the lower-risk fix is to defer the flag and keep p02-t08 limited to submit-first, parse fallback, and terminal handling when neither path produces usable output.

### Medium

None.

### Minor

None.

## Artifact Alignment Notes

- FR1 through FR3 are covered by the provider CLI discovery, submit subcommand, structured submit parsing, and schema validation tasks.
- FR4 is partially aligned: the default no-submission behavior is planned, but the strict require-submission branch is ambiguous and is covered by the Important finding above.
- FR5 through FR7 are covered by evidence metadata, fixture-backed tests, documentation updates, and completion/readiness tasks.
- The plan's sequential execution model is justified by shared files and cross-phase dependency ordering.
- The implementation scaffold is still pre-implementation and does not conflict with the current plan phase.

## Verification Commands Used

```bash
oat project status --project-path .oat/projects/shared/provider-cli-hardening --json
rg -n "require_submission|missing_submission|No-submission behavior" .oat/projects/shared/provider-cli-hardening/{plan.md,design.md,spec.md}
rg --files src/consensus/provider-cli tests/consensus/provider-cli tests/consensus/core
```

## Recommended Next Step

Run `oat-project-review-receive` for this plan artifact. The expected resolution path is artifact alignment, not implementation: adjust p02-t08 or explicitly promote strict mode before starting implementation.
