---
oat_external_plan_index: true
oat_generated: true
oat_external_plan_source: backlog-review
oat_external_plan_sources:
  - .oat/repo/pjm/backlog/reviews/backlog-and-roadmap-review.md
  - .oat/repo/pjm/backlog/reviews/priority-alignment.md
  - .oat/repo/pjm/backlog/items/BL-260927-remove-dead-handoff-discovery.md
oat_external_plan_commit: 9c95f0194e2770f1cedf26f95f3cc93af3b45563
oat_external_plan_main_commit: 9c95f0194e2770f1cedf26f95f3cc93af3b45563
oat_external_plan_date: '2026-10-10'
created: '2026-10-11T00:16:47Z'
---

# External Plan Index: October 10 backlog planning wave

This index records selection, not execution. It is not an executable plan or an
`oat-project-import-plan` target. Exactly one item was authorized for this repository.

## Selection

| Candidate | Value / effort / risk | Confidence | Plan ready | Execution ready | Basis |
| --- | --- | --- | --- | --- | --- |
| BL-260927-remove-dead-handoff-discovery | Maintenance value / S / low, with keeper proof required | High from live source inspection | Yes | Yes, subject to normal baseline checks | Retired executor, no production caller, named keepers, settled criteria |

The living September 20 review and alignment did not consider this item, which was
created September 27. Its timestamp alone did not qualify it: the approved allowlist,
complete current criteria, caller searches, retirement record, keeper bodies, and
ownership checks independently establish readiness. The older review's statements
about active items and pending PR #99 are historical, not current status assertions.

No allowed item was skipped, and no substitute was added. The item remains open.
Its only mutation is the external-plan backlink and updated timestamp.

## Existing plans and ownership

- The source item had `external_plans: []`; no external plan names the source ID or plans the same removal.
- `2026-09-11-preserve-project-isolation-in-export-selection.md` mentions old handoff/discovery work incidentally; its outcome is export selection isolation, so it is not ownership of this cleanup.
- GitHub returned no open PRs. Available `.oat/projects` files, current-state/roadmap, external execution program and Git worktree/branch inventory contained no owner for this outcome. The `session-observer-evidence` project has a distinct evidence-export outcome.
- Machine-local artifacts outside this worktree were not scanned. Recheck ownership immediately before execution.

## Recommended order

| Order | Plan | Source | Depends on | Rationale |
| --- | --- | --- | --- | --- |
| 1 | [Remove retired handoff discovery](./2026-10-10-remove-dead-handoff-discovery.md) | [BL-260927-remove-dead-handoff-discovery](../../pjm/backlog/items/BL-260927-remove-dead-handoff-discovery.md) | No unsatisfied hard dependency | One bounded cleanup with existing coverage keepers |

No cross-repository dependency or additional lane is needed. The plan requires no
product choice or operator feedback before an authorized executor can start.

## Verification and limits

Planning used a clean inspected HEAD and fetched comparison baseline, both
`9c95f0194e2770f1cedf26f95f3cc93af3b45563`. PJM doctor reported declared adoption and
all 12 checks passed. File-level verification confirmed the comparator import,
exclusive retired callers/support, keeper assertions, build declarations, and package
commands. The generated dead options initializer is explicitly accounted for.

This is Tier 2 bounded inline planning using `oat-repo-improve`, `deliberate-testing`,
and repository `author-skill` guidance. No code/test changes, dependency installation,
formatter, build, test suite, keeper mutation, provider invocation, or global install
was performed during this stage. Full repository gates are execution/publication
checks, not claimed by the source inspection. Post-write checks cover frontmatter,
links, plan contract, unchanged backlog body, allowed diff and whitespace.

## Exclusions and tracking

All other backlog items are outside the approved allowlist and were not selected or
re-ranked. No repository audit was performed. Content scans excluded agent directories
`.agents`, `.claude`, `.codex`, `.cursor` at every depth, credentials, runtime stores,
dependencies and build output; explicitly named generated skill payloads were read
only to verify this item's shipped caller/initializer claim. No additional audit
exclusions or included agent-directory exceptions were selected.

New backlog items and GitHub issues were declined by wave policy; the existing source
item supplies tracking. No item closure, archive, canonical OAT project, issue, push or
PR is created by this stage. Direct execution or optional OAT import is a later step.
