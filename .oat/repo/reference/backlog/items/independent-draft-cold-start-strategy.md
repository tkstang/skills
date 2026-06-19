---
id: bl-2ed7
title: 'Implement independent_draft cold-start strategy in consensus-loop'
status: open
priority: medium
scope: feature
scope_estimate: M
labels: [consensus, skill-family, consensus-loop]
assignee: null
created: '2026-06-19T23:57:18Z'
updated: '2026-06-19T23:57:18Z'
associated_issues: []
oat_template: true
oat_template_name: backlog-item
---

## Description

The v3 architecture defines **two cold-start strategies** as an independent
dimension of `consensus-loop`: `shared_input` (all peers see the same starting
artifact in round 1) and `independent_draft` (round 1 has each peer produce its
own output from the brief, with no shared starting artifact). Only
`shared_input` shipped in v0.1; `independent_draft` is the **deferred** strategy
(see `current-state.md`).

This was previously tracked only as a sub-bullet inside [[bl-b9b9]]
(consensus-create). It is pulled out here because it is a **shared-primitive
capability**, not a single skill's concern: it is the default cold-start for
**three** planned family skills — `consensus-create`, `consensus-decide`, and
`consensus-plan` (per the v3 defaults table) — and gates all of them.

**Source:** `research/consensus/architecture-v3.md` ("Cold-start strategies",
"Skill defaults").

**Blocks:** [[bl-b9b9]] (create), [[bl-87ef]] (decide), [[bl-0cb8]] (plan) —
each defaults to `independent_draft` and cannot ship its intended behavior
without it. `consensus-create` is the natural first consumer that front-loads
this work.

## Acceptance Criteria

- `consensus-loop` supports `cold_start_strategy: independent_draft`: round 1
  produces per-peer independent drafts from the brief with no shared starting
  artifact, then converges via the existing iteration modes.
- Works across all three iteration modes (alternating / parallel_revision /
  parallel_synthesized) and records the chosen cold-start in the resolution block.
- `--cold-start shared_input | independent_draft` is exposed and overridable.
- Covered by tests at the `consensus-loop` level (independent of any one family skill).
- [[bl-b9b9]] / [[bl-87ef]] / [[bl-0cb8]] updated to consume this rather than
  re-implement it.
