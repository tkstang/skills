---
oat_generated: true
oat_generated_at: 2026-05-03
oat_review_scope: design
oat_review_type: artifact
oat_review_invocation: manual
oat_project: .oat/projects/shared/consensus-plugin
---

# Artifact Review: design

**Reviewed:** 2026-05-03
**Scope:** Design artifact review for `.oat/projects/shared/consensus-plugin/design.md`
**Files reviewed:** 2
**Commits:** N/A for artifact review

## Summary

The design artifact is substantially complete and reflects the decisions made during collaborative review: self-contained plugin packaging, host-mediated parallel orchestration, corrected security/path handling, JSONL stdout, and realistic performance/deployment posture. The remaining blocker is upstream artifact drift: `spec.md` still contains stale v0.1 scope and architecture statements that contradict the design, so implementation planning could follow the wrong contract unless those requirements are reconciled first.

## Findings

### Critical

None

### Important

1. **Reconcile `spec.md` before generating the implementation plan.**

   The current `design.md` is internally coherent, but the spec still preserves older contracts that now conflict with it. For example, the design says v0.1 builds the self-contained `plugins/consensus/` layout, sequential and parallel orchestration, and the install-assist script (`design.md:14`, `design.md:16`, `design.md:108`). It also defines `--agency minimal|moderate|maximum` as part of the wrapper interface and loop semantics (`design.md:147`, `design.md:192`). In contrast, the spec still says the README should describe "Phase 1 only: refine, alternating, sequential" and list "parallel modes, agency flag" as future (`spec.md:209`-`spec.md:216`), says scope is "Phase 1 only" with parallel host orchestration deferred (`spec.md:236`-`spec.md:237`), and its high-level design still selects top-level canonical `skills/` plus repo-root plugin manifests while deferring sub-plugin packaging (`spec.md:249`-`spec.md:262`).

   This is not just editorial. OAT plan generation consumes the artifact chain; if the spec remains stale, tasks can be generated for the old repository layout, omit the v0.1 parallel wrapper phases, or treat the user-facing agency flag as out of scope. Fix by updating `spec.md` to match the design decisions, or explicitly marking the stale sections as superseded and moving authoritative scope/architecture language to current sections. At minimum, reconcile Non-Goals, NFR5, Constraints, High-Level Design, and the Requirement Index before running `oat-project-plan`.

### Medium

None

### Minor

None

## Spec/Design Alignment

### Requirements Coverage

| Requirement | Status | Notes |
| ----------- | ------ | ----- |
| FR1 repository scaffold | Partial | Design uses the current self-contained plugin layout; spec still has stale high-level text for top-level canonical skills and root manifests. |
| FR2 consensus-refine loop | Covered | Design defines wrapper and loop contracts, including JSONL stdout and file-based loop outputs. |
| FR4 parallel orchestration | Covered in design, stale in spec | Design includes v0.1 host-mediated parallel orchestration; spec still describes this as future/deferred in multiple places. |
| FR9 configurable peers | Covered | Design uses `--peers` and host-aware defaults. |
| FR10 Paseo install assist | Covered | Design includes explicit opt-in install-assist and preflight behavior. |
| NFR3 cross-provider metadata | Covered with implementation caveat | Design uses additive frontmatter and provider manifests, with release smoke tests to verify provider tolerance. |
| NFR5 honest README | Needs spec reconciliation | Design's scope is broader than the stale NFR5 wording in `spec.md`. |
| NFR6 subagent permission handling | Covered | Design captures Codex fail-closed authorization and host-mediated parallel dispatch. |

### Extra Work (not in requirements)

None in `design.md` beyond the scope expansion already reflected in the current design decisions. The issue is that the upstream spec has not been fully updated to match that expansion.

## Verification Commands

```bash
rg -n "Phase 1 only|parallel modes|agency flag|sub-plugin packaging|repo-level plugin manifests|v0.1 only invokes paseo" .oat/projects/shared/consensus-plugin/spec.md
rg -n "self-contained plugin|parallel section orchestration|--agency|prepare-parallel|fan-in" .oat/projects/shared/consensus-plugin/design.md
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert the Important finding into plan tasks before generating `plan.md`.
