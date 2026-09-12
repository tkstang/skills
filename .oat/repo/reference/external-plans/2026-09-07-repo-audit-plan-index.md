---
oat_generated: true
oat_external_plan_index: true
oat_external_plan_source: repo-audit
oat_external_plan_sources:
  - .
  - .oat/repo/reference/reviews/2026-09-07-standard-repo-audit.md
  - .oat/repo/reference/reviews/2026-09-11-audit-astra-review.md
  - .oat/repo/reference/evidence/skills-standard-audit-2026-09-07-run-01/raw/dossiers/runtime-gather-lane-01.json
oat_external_plan_commit: f5395a35
created: '2026-09-08T00:16:29Z'
updated: '2026-09-11T13:29:20Z'
---

# External Plan Index: 2026-09-07 repository audit

This index records selection and ordering. It is not an executable plan and is not an `oat-project-import-plan` target.

## Selection

- **Selected:** five high-confidence outcomes: retain and correct the three original runtime plans, plus two product findings independently gathered and reproduced by the root using synthetic inputs.
- **Coverage:** the September 7 Terra lane remains historically partial. The separately authorized September 11 Astra re-review and tooling/product lanes complete standard-profile sampling across all nine audit categories. This is not exhaustive coverage or live-provider/rendered-site validation.
- **Deferred:** authored TypeScript incremental lint/format coverage (`TOOL-01`, medium value, small effort, low risk) and phone-a-friend sidebar/authoring-rule consistency (`TOOL-02`, low–medium value, small effort, low risk). Both rank below the selected runtime/privacy/continuation boundaries; no extra plan or backlog item is manufactured. Dependency advisories require invocation/reachability verification, not an automatic upgrade plan.
- **Overlap:** no competing outcome with Pass A; shared-file/generated-output coordination remains necessary. The panel cap is a new parity gap, not unfinished acceptance criteria from the completed July timeout/stdin plan. PR #70 touches shared transcript metadata and must be rechecked before product-plan execution.
- **Tracking:** plans only; no backlog items or GitHub issues were requested for repo-audit findings.

## Recommended order

| Order | Plan                                                                                                             | Finding       | Value                                   | Effort | Risk       | Confidence                                     |
| ----: | ---------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------- | ------ | ---------- | ---------------------------------------------- |
|     1 | [Preserve project isolation in export selection](./2026-09-11-preserve-project-isolation-in-export-selection.md) | `PRODUCT-01`  | High privacy/correctness                | Small  | Medium     | High                                           |
|     2 | [Bound panel provider output](./2026-09-07-bound-panel-provider-output.md)                                       | `RUNTIME-002` | High reliability                        | Small  | Low–medium | High                                           |
|     3 | [Honor provider envelope redaction](./2026-09-07-honor-provider-envelope-redaction.md)                           | `RUNTIME-003` | Medium data minimization/API integrity  | Small  | Medium     | High                                           |
|     4 | [Require completed peer evidence](./2026-09-11-require-completed-peer-evidence-for-continuation.md)              | `PRODUCT-02`  | High automatic-continuation correctness | Medium | High       | High defect confidence; contract decision gate |
|     5 | [Enforce shipped JSON-Schema profile](./2026-09-07-enforce-shipped-json-schema-profile.md)                       | `RUNTIME-001` | High provider-contract integrity        | Medium | Medium     | High                                           |

Ordering is a proposed implementation sequence, not a change to Thomas's existing backlog priority alignment. No plan execution is authorized by this index.

## Dependency notes

- All five outcomes are independently shippable; none requires Pass A to execute first.
- Schema validation and envelope redaction share provider CLI files/generated output; serialize or partition ownership. Schema enforcement intentionally moves some failures ahead of the outer domain retry: preserve provider-owned budgets, and STOP if the old recovery contract must remain.
- The completion plan must pin positive lifecycle evidence before changing automatic behavior; unknown evidence fails closed. If this requires a general lifecycle/lease redesign, defer that design rather than expanding the plan.
- PR #70 changes shared transcript metadata/types and generated consumers. Recheck its exact current patch before either product plan; do not overwrite its work. The two product plans solve distinct selector and completion outcomes.
- Pass A's helper extraction can touch panel/provider adapters; its version guard covers propagation safety. These are shared-file coordination points, not duplicate findings or prerequisites.
- No tracker mutation or source-item closure accompanies this repo-audit pass. See the [Astra review](../reviews/2026-09-11-audit-astra-review.md) for deferred candidates, provenance, and validation limits.
