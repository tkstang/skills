---
id: bl-2ed7
title: 'Implement independent_draft cold-start strategy in consensus-loop'
status: done
priority: medium
scope: feature
scope_estimate: M
labels: [consensus, skill-family, consensus-loop]
assignee: null
created: '2026-06-19T23:57:18Z'
updated: '2026-06-22T01:40:22Z'
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

**Project packaging (2026-06-20):** run this in **one consensus-family OAT
project** with [[bl-b9b9]] → [[bl-87ef]] + [[bl-0cb8]] rather than as a standalone
item. `independent_draft` is a loop primitive with no observable behavior until a
skill exercises it, so building it without its first consumer (`consensus-create`)
risks the wrong abstraction; the cold-start design and `bl-b9b9`'s
derived-sectioning design want to be settled together. `bl-645c` (research) stays
in a **separate** project — it uses `shared_input` (not gated on this item) and
carries an unrelated peer tool-access DR.

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

## Delivery Notes

Delivered by the spec-driven OAT project `consensus-family` on branch
`consensus-family`.

- Added `independent_draft` as a first-class cold-start mode in the shared
  `consensus-loop` core while preserving `shared_input` defaults.
- Threaded the selected cold start into prompt builders and framed round-1
  independent-draft turns as untrusted briefs rather than shared artifacts.
- Covered `independent_draft` across `alternating`, `parallel_revision`, and
  `parallel_synthesized` loop scenarios.
- Preserved wrapper-local `shared_input` guards for `refine` and `evaluate`.
- Regenerated shipped consensus runtime output and updated changed skill version
  metadata.
