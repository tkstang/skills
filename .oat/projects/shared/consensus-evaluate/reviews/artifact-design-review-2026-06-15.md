---
oat_generated: true
oat_generated_at: 2026-06-15
oat_review_scope: design
oat_review_type: artifact
oat_review_invocation: manual
oat_project: .oat/projects/shared/consensus-evaluate
---

# Artifact Review: design

**Reviewed:** 2026-06-15
**Scope:** Quick-mode design artifact for `consensus-evaluate`
**Files reviewed:** 16
**Commits:** N/A (artifact review)

## Summary

The design captures the core architecture well: reuse the existing consensus loop through a narrow prompt-profile seam, keep refine behavior unchanged by default, and model evaluations as markdown carried through the existing parallel verdict schema. Two acceptance-critical details need to be added before planning: README/family-status updates are not represented in the design, and the evaluate wrapper does not define how loop record/status files are rendered into the final deliberation log that preserves peer reasoning and dissent.

## Findings

### Critical

None

### Important

- **README and family-status work is missing from the design responsibilities** (`.oat/projects/shared/consensus-evaluate/design.md:56`)
  - Issue: The upstream backlog item requires "Plugin manifests, SKILL.md, and READMEs" to be updated, and discovery records the same family-status requirement. The design's evaluate component lists `consensus-evaluate.mjs`, generated engine/schema copies, `SKILL.md`, and plugin/skill manifests, but does not include root/plugin README updates or the deferred-family status text. This is easy to miss because the current docs still say `consensus-evaluate` is deferred in both `README.md` and `plugins/consensus/README.md`.
  - Evidence: `.oat/repo/reference/backlog/items/add-consensus-evaluate-skill.md:25`, `.oat/repo/reference/backlog/items/add-consensus-evaluate-skill.md:27`, `.oat/projects/shared/consensus-evaluate/discovery.md:109`, `README.md:129`, `plugins/consensus/README.md:139`
  - Fix: Add a documentation/status component or responsibility to `design.md` that names the root README, plugin README, skill README/SKILL surface, and provider manifests as part of the shipped-skill contract. Include a verification note to remove or rewrite deferred-family references for `consensus-evaluate`.
  - Requirement: Backlog AC "Plugin manifests, SKILL.md, and READMEs updated; family skill listed as shipped."

- **Loop-state to deliberation-log contract is underspecified** (`.oat/projects/shared/consensus-evaluate/design.md:91`)
  - Issue: The design says the wrapper calls `runConsensusLoop(...)`, then assembles the final evaluation markdown and emits coordination JSON. The shared loop currently requires `--output-records`, `--output-section`, and `--output-status`, while the refine wrapper separately renders record/status state into canonical deliberation-log blocks. Without an explicit evaluate-specific state/rendering contract, an implementer can produce the final evaluation document but fail the acceptance criterion that per-peer reasoning and dissent are preserved in the deliberation log.
  - Evidence: `.oat/projects/shared/consensus-evaluate/discovery.md:79`, `.oat/projects/shared/consensus-evaluate/discovery.md:103`, `.oat/projects/shared/consensus-evaluate/design.md:92`, `.oat/projects/shared/consensus-evaluate/design.md:98`, `plugins/consensus/skills/refine/scripts/consensus-loop.mjs:1068`, `plugins/consensus/skills/refine/scripts/consensus-loop.mjs:1070`, `plugins/consensus/skills/refine/scripts/consensus-loop.mjs:1072`, `plugins/consensus/skills/refine/scripts/consensus-refine.mjs:1252`, `plugins/consensus/skills/refine/scripts/consensus-refine.mjs:1321`
  - Fix: Add a `consensus-evaluate` output/state subsection that defines the run directory/files passed to the loop, how records/status are embedded in the final evaluation artifact, and what "dissent preserved in the deliberation log" concretely means for CONVERGED, IMPASSE, and escalation outcomes. The tests should assert that the final artifact contains the final evaluation plus canonical peer reasoning/dissent records, not only a rendered summary.
  - Requirement: Backlog AC "produces an evaluation artifact with unified findings, per-peer reasoning, and dissent preserved in the deliberation log."

### Medium

None

### Minor

None

## Requirements/Design Alignment

**Evidence sources used:** `.oat/projects/shared/consensus-evaluate/discovery.md`, `.oat/projects/shared/consensus-evaluate/design.md`, `.oat/projects/shared/consensus-evaluate/plan.md`, `.oat/projects/shared/consensus-evaluate/implementation.md`, `.oat/projects/shared/consensus-evaluate/state.md`, `.oat/repo/reference/backlog/items/add-consensus-evaluate-skill.md`, `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`, `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`, `scripts/sync-transcript-core.mjs`, `tests/transcript-core/sync.test.mjs`, `README.md`, `plugins/consensus/README.md`, `package.json`, `.oxfmtrc.json`, `.lintstagedrc.mjs`, `.github/workflows/validate.yml`

### Requirements Coverage

| Requirement | Status | Notes |
| --- | --- | --- |
| Evaluate artifact + rubric produces unified evaluation with reasoning/dissent log | partial | Main architecture is sound, but the state/rendering contract for preserving reasoning/dissent in the final deliberation log is missing. |
| v3 defaults: `shared_input` / `parallel_revision` / `minimal`, all overridable | covered | Design states defaults and independent-draft rejection, aligned with discovery. |
| Plugin manifests, SKILL.md, READMEs updated; family listed as shipped | partial | Manifests and SKILL.md are named; README and deferred-family status updates are missing from design responsibilities. |
| Tests cover defaults, evaluation output, impasse surfacing, engine seam, drift guard | partial | Test categories are named, but output-contract tests should explicitly verify canonical peer records/dissent are embedded in the evaluation artifact. |

### Extra Work (not in declared requirements)

None

## Verification Commands

Run these after updating the design artifact:

```bash
rg -n "README|deferred|consensus-evaluate" .oat/projects/shared/consensus-evaluate/design.md README.md plugins/consensus/README.md
rg -n "output-records|output-status|Deliberation Log|consensus-verdict|consensus-section-status|dissent" .oat/projects/shared/consensus-evaluate/design.md
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert these findings into plan/design fix tasks.
