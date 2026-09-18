---
oat_generated: true
oat_review_scope: bounded
oat_review_type: code
oat_review_run_id: "receipt-findings-v1"
---

# Consensus Review

**Verdict:** changes\_requested
**Worktree:** `/tmp/consensus-review-receipt/worktree`
**Scope token:** `receipt-findings-token`
**Reviewer:** claude (model unobserved, effort unobserved)
**Findings:** 1 critical, 1 high, 1 medium, 1 low

## Request

Review all supported severity and location forms\.

## Summary

The fixture contains four independently actionable findings\.

## Scope and provenance

- Selector: `document=/tmp/consensus-review-receipt/plan.md`
- Requested paths: `src/reviewed.ts`
- External documents: `/tmp/consensus-review-receipt/plan.md`
- Captured evidence: 256 bytes
- Reviewer claim: \{"provider":"claude"\}
- Observed reviewer evidence: Provider envelope only\.
- Diversity: unknown — Provider identity does not establish model family\.
- Drift comparison: stable within stated coverage
- Detection limit: Unselected content changes with unchanged Git status may go undetected\.

### Authorship evidence

- unknown — unknown, unknown coverage; No bounded author evidence was supplied\.

### Reviewer-reported inspected context

- src/reviewed\.ts (`reviewed-source-v1`)
- external plan (`plan-source-v1`)

## Findings

### Critical

- **C1: Reject unsafe destination** (`src/reviewed.ts:12-14 (reviewed-source-v1)`)
  - Claim: The destination can escape its declared root\.
  - Evidence: The resolved path is used without a containment check\.
  - Suggestion: Resolve canonically and reject paths outside the declared root\.
  - Confidence: 0.99

### High

- **H1: Preserve the explicit acceptance rule** (`anchor: Acceptance Criteria > Receipt`)
  - Claim: The document omits the diagnostic rejection requirement\.
  - Evidence: The receipt section describes completed reviews only\.
  - Suggestion: State that diagnostics are not receivable completed reviews\.
  - Confidence: 0.92

### Medium

- **M1: Record fixture identity** (`src/reviewed.ts:28 (reviewed-source-v1)`)
  - Claim: The evidence omits the fixture identity\.
  - Evidence: The result records only a count\.
  - Suggestion: Persist the stable fixture name with the normalized outcome\.
  - Confidence: 0.83

### Low

- **L1: Clarify retained state** (`anchor: Limitations > Retention`)
  - Claim: Retention ownership is implied rather than stated\.
  - Evidence: The text names the directory but not the cleanup owner\.
  - Suggestion: Say that retention is operator\-managed\.
  - Confidence: 0.74

## Questions

- Should the operator archive the completed review after triage?

## Limitations

- This is a deterministic fixture, not live provider acceptance\.
- Unselected content changes with unchanged Git status may go undetected\.
- Provider read\-only controls are not universal filesystem or network isolation\.
- Retention is operator\-managed; the external run directory has no automatic cleanup or replay policy\.

## Checks reported

- renderer fixture — passed: all four severity sections rendered

## Suggested verification

- live provider — not\_run: not authorized

## Artifact paths

- Run directory: `/tmp/consensus-review-receipt/findings`
- Captured request: `/tmp/consensus-review-receipt/findings/request.txt`
- Captured evidence: `/tmp/consensus-review-receipt/findings/evidence.json`
- Host result JSON: `/tmp/consensus-review-receipt/findings/result.json`
