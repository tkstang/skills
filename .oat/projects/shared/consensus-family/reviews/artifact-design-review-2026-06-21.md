---
oat_generated: true
oat_generated_at: 2026-06-21
oat_review_scope: design
oat_review_type: artifact
oat_review_invocation: manual
oat_project: .oat/projects/shared/consensus-family
---

# Artifact Review: design

**Reviewed:** 2026-06-21
**Scope:** Drafted design for the `consensus-family` spec-driven project
**Files reviewed:** 5
**Commits:** N/A (artifact review)

## Summary

The design is directionally strong: it keeps `independent_draft` as a narrow
round-1-only loop-core primitive, correctly reuses the DR-024 verdict seam, and
keeps the new skills thin. I found one Important spec/design contradiction that
should be fixed before planning, plus two Medium artifact-alignment issues that
would otherwise create ambiguous implementation tasks or stale workflow routing.

## Findings

### Critical

None.

### Important

1. **Spec and design disagree on whether `refine`/`evaluate` accept
   `independent_draft`.**

   - `spec.md:59` says the previous hard rejection at the loop parser and both
     existing wrappers is replaced with validation that accepts both
     `shared_input` and `independent_draft`.
   - `design.md:16` and `design.md:109` say `refine`/`evaluate` remain
     `shared_input`-only by deliberate per-skill constraint.

   The design decision is defensible, but the completed spec still requires the
   opposite behavior. This will mislead planning into either relaxing
   `refine`/`evaluate` or writing contradictory tasks. Update FR1/FR3 in
   `spec.md` so the loop core and new wrappers accept both cold-starts while
   `refine`/`evaluate` keep a shared-input-only guard with clearer wording.

### Medium

1. **The decide/plan CLI input contract is ambiguous about text vs path.**

   - `design.md:133` defines `consensus-decide` as `--options <text|path>`.
   - `design.md:135` defines `consensus-plan` constraints as `<text|path>`.
   - The backlog and architecture references are more specific:
     `add-consensus-decide-skill.md:19` and `architecture-v3.md:360` use
     `--options <path>`, while `add-consensus-plan-skill.md:19` and
     `architecture-v3.md:361` use `--constraints <text>`.

   A single flag that guesses whether a value is text or a path is risky for
   path confinement, UX, and parser tests. The design should make this explicit
   before planning: either keep the backlog shape (`--options <path>`,
   `--constraints <text>`) or introduce unambiguous paired flags such as
   `--options-file` / `--constraints-file`.

2. **Project state still describes the design/spec as not started.**

   - `state.md:34` and `state.md:40` still report discovery complete and ready
     for design.
   - `state.md:45` says `spec.md` is scaffolded, and `state.md:46` says
     `design.md` is not started, even though `spec.md` is complete and
     `design.md` is a committed draft.

   This already makes project-state inference choose the wrong default review
   context. Update `state.md` to reflect "design draft committed / awaiting
   HiLL review" or equivalent before continuing the lifecycle.

### Minor

1. **One testing row places a compatibility assertion under the wrong NFR.**

   `design.md:184` maps `refine/evaluate reject independent_draft` under NFR4
   (untrusted input handling). That assertion belongs under FR3/API
   compatibility, not under input-cap/path-confinement coverage. Moving it will
   make the requirement-to-test map cleaner for planning.

## Spec/Design Alignment

### Requirements Coverage

| Requirement | Status | Notes |
| --- | --- | --- |
| FR1 | partial | Design covers the loop primitive, but spec/design disagree on existing wrapper behavior. |
| FR2 | covered | Per-mode semantics and test coverage are explicit. |
| FR3 | partial | Resolution/defaults covered; wrapper override/guard semantics need spec alignment. |
| FR4 | covered | Create wrapper, whole-artifact v1, and defaults are covered. |
| FR5 | covered | Decide minimal-agency dissent surfacing is covered. |
| FR6 | covered | Plan wrapper and markdown output are covered, subject to CLI input-contract clarification. |
| NFR1 | covered | Dependency-free/runtime boundary preserved. |
| NFR2 | covered | Build/version discipline captured. |
| NFR3 | covered | DR-024 reuse and verdict-source handling captured. |
| NFR4 | covered | Input cap, path confinement, and untrusted framing captured. |
| NFR5 | covered | Gate set captured. |

### Extra Work

None beyond accepted discovery scope. The design keeps deferred features
deferred: outline-first sectioning, machine-readable decide/plan schemas, and
hard require-submission.

## Verification Commands

No verification commands were run for this artifact review. Suggested checks
after fixes:

```bash
oat project status --project-path .oat/projects/shared/consensus-family --json
rg -n "both existing wrappers|text\\|path|scaffolded template|not started" .oat/projects/shared/consensus-family
```

## Recommended Next Step

Run `oat-project-review-receive` to convert these findings into design/spec
alignment tasks before marking the design HiLL gate complete.
