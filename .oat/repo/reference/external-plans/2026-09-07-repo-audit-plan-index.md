---
oat_generated: true
oat_external_plan_index: true
oat_external_plan_source: repo-audit
oat_external_plan_sources:
  - .
  - .oat/repo/reference/reviews/2026-09-07-standard-repo-audit.md
  - .oat/repo/reference/evidence/skills-standard-audit-2026-09-07-run-01/raw/dossiers/runtime-gather-lane-01.json
oat_external_plan_commit: f5395a35
created: '2026-09-08T00:16:29Z'
---

# External Plan Index: 2026-09-07 repository audit

This index records selection and ordering. It is not an executable plan and is not an `oat-project-import-plan` target.

## Selection

- **Selected:** all three independently gathered and root-verified findings; each is high-confidence, bounded, non-cosmetic, and has a clean verification boundary.
- **Partial coverage:** the requested standard audit achieved only a runtime-focused intelligent-recon lane. Dependencies, CI performance, broad docs/direction, and exhaustive product-surface coverage remain unaudited.
- **Rejected:** no low-confidence candidate was promoted. Areas inspected without findings are recorded in the audit review and dossier.
- **Overlap:** none with the four Pass A plans. The panel output-cap plan closes residual scope from a completed 2026-07-17 plan rather than competing with it.
- **Tracking:** plans only; no backlog items or GitHub issues were requested for repo-audit findings.

## Recommended order

| Order | Plan | Source finding | Depends on | Tracking | Rationale |
| ---: | --- | --- | --- | --- | --- |
| 1 | [Enforce shipped JSON-Schema profile](./2026-09-07-enforce-shipped-json-schema-profile.md) | `RUNTIME-001` | — | None | Highest contract-integrity impact; protects every structured verdict path. |
| 2 | [Bound panel provider output](./2026-09-07-bound-panel-provider-output.md) | `RUNTIME-002` | — | None | Small residual reliability fix using a proven core pattern. |
| 3 | [Honor provider envelope redaction](./2026-09-07-honor-provider-envelope-redaction.md) | `RUNTIME-003` | — | None | Restores an accepted data-minimization control with compatibility review. |

## Dependency notes

- All three outcomes are independently shippable.
- Plans 1 and 3 both affect generated provider CLI output; serialize their implementation or explicitly partition generated-output ownership.
- Plan 2 affects the panel path and can run independently.
