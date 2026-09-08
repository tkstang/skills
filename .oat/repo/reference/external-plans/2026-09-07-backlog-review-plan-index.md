---
oat_generated: true
oat_external_plan_index: true
oat_external_plan_source: backlog-review
oat_external_plan_sources:
  - .oat/repo/pjm/backlog/reviews/backlog-and-roadmap-review.md
  - .oat/repo/pjm/backlog/reviews/priority-alignment.md
oat_external_plan_commit: f5395a35
created: '2026-09-08T00:16:29Z'
---

# External Plan Index: 2026-09-07 backlog review

This index records selection and ordering. It is not an executable plan and is not an `oat-project-import-plan` target.

## Selection

- **Selected by noninteractive default:** four bounded, high-leverage July follow-ups with current source evidence and clean verification boundaries.
- **Existing operator alignment:** retained for the older nine-item board. The alignment predates the six July 13/23 items, so the new integrity follow-ups rank ahead by leverage without rewriting the operator-owned document.
- **Deferred:** research, harmonization, session-log, messaging, and N>2 mesh need project-sized design; host-native dispatch, multi-peer, multi-round panel, and idle integrations remain demand/evidence-gated; metrics and similarity remain valid but lower leverage.
- **Duplicate disposition:** no selected plan duplicates an existing plan; each is a verified follow-up to an explicit earlier scope or execution boundary.
- **Out of scope:** implementation, live provider execution, provider setup, credentials, agent-configuration directories, and canonical OAT project artifacts.

## Recommended order

| Order | Plan | Source item | Depends on | Tracking | Rationale |
| ---: | --- | --- | --- | --- | --- |
| 1 | [Guard transitive shared-runtime versions](./2026-09-07-guard-transitive-shared-runtime-versions.md) | `BL-260723-guard-transitive-shared` — Guard transitive shared-runtime skill version bumps | — | Existing backlog item | Protects later shared-runtime changes. |
| 2 | [Finish atomic consensus-loop writes](./2026-09-07-finish-atomic-consensus-loop-writes.md) | `BL-260723-make-remaining-consensus-loop` — Make remaining consensus-loop write sites atomic | — | Existing backlog item | Small, deterministic correctness win. |
| 3 | [Reconcile live submit verdict source](./2026-09-07-reconcile-live-submit-verdict-source.md) | `BL-260723-investigate-live-submit` — Investigate live submit verdict-source contract mismatch | Explicit future live-run authorization | Existing backlog item | Restores confidence in live-provider truthfulness. |
| 4 | [Extract loop-free CLI helper core](./2026-09-07-extract-loop-free-cli-helper-core.md) | `BL-260723-split-loop-free-cli-helpers` — Split loop-free cli-helpers core for panel sharing | Prefer plan 1 first; serialize with plan 2 | Existing backlog item | Consolidates panel safely after integrity gates. |

## Dependency notes

- Plans 1 and 3 are independent and can execute in parallel.
- Plans 2 and 4 both affect consensus generated outputs; serialize them unless ownership is explicitly partitioned.
- Plan 3 cannot cross its live-provider STOP condition under ordinary implementation authority.
