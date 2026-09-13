---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-09-13
oat_phase: plan
oat_phase_status: in_progress
oat_plan_hill_phases: []
oat_plan_parallel_groups: []
oat_plan_source: quick
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
oat_template: true
---

# Planning Handoff: skill-source-organization

Not an executable plan. Task authoring has not started; the project is inactive and the lightweight design awaits holistic review. Do not route to oat-project-implement.

## Candidate Delivery Slices

1. Refresh the merged baseline and record old/new owners, versions, declared outputs, and compatibility requirements.
2. Adapt the existing builder/declarations and prove representative prompt-only, executable, shared-runtime, and complete-plugin installation boundaries before bulk migration.
3. Migrate authored sources, version ownership, shared-consumer guards, and existing tooling/CI; preserve behavior and reuse existing tests.
4. Apply plugin groupings/renames, promote session-handoff, bring the newer personal-skills complexity-review content into this public repo, and coordinate the personal-skills ownership transition.
5. Finish distribution documentation and static/artifact verification; keep live discovery/publication distinct and authorization-bound.

Convert these into stable task IDs, scoped verification, and atomic commits only after design review and baseline refresh. Avoid full-suite repetition per move, snapshots of prose, and speculative test infrastructure.

## Required Complexity-Review Cutover

User-confirmed scope addition, 2026-09-13:

1. Bring personal-skills' newer complexity-review (currently 1.0.2), including references/evidence-guide.md and its authorization/invocation improvements, into this repository's canonical skill. Preserve attribution and comply with the version policy in effect at execution; recheck the source revision before copying.
2. Verify the prompt-only source and generated resources with existing metadata, packaging/link checks and a focused content comparison. Do not add a runtime or evaluation harness for this prose migration.
3. After the public replacement merges and is available through the supported installation path, open a separate PR in tkstang/personal-skills removing its independently authored src/skills/complexity-review copy. Update its source declarations, regenerate derived payloads, and update docs so none still imply private ownership. If retained in the personal distribution, consume the public owner through the existing external-skill mechanism rather than maintain another authored copy.
4. Link the removal PR to the public change and record its disposition. PR creation is planned work; merging it and changing active installations remain separate approval boundaries. Source removal must not implicitly uninstall user copies.

Neither the content migration nor the removal PR is executed by this planning update. The project remains inactive.

## Parallelism

Not yet scheduled. Build declarations, source moves, generated outputs, and version migration share fragile ownership boundaries; do not declare isolated worktree phases until the final task write sets demonstrate independence.

## Reviews

| Scope | Type | Status | Date | Artifact | Reviewed Head | Invocation | Gate Target |
| --- | --- | --- | --- | --- | --- | --- | --- |
| p01 | code | pending | - | - | - | - | - |
| p02 | code | pending | - | - | - | - | - |
| final | code | pending | - | - | - | - | - |
| spec | artifact | pending | - | - | - | - | - |
| design | artifact | pending | - | - | - | - | - |
| plan | artifact | pending | - | - | - | - | - |

The scaffold's review rows are retained; phase IDs are not yet assigned and spec is intentionally absent in quick mode. No independent artifact review or configured gate has run. The author's design self-review is not a passed review row.

## Implementation Complete

Not started. Zero executable tasks authored; no implementation-ready claim.

## References

- [Discovery](discovery.md)
- [Design](design.md)
- [Project state](state.md)
- [Issue #74](https://github.com/tkstang/skills/issues/74)
