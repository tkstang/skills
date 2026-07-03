---
id: BL-260701-add-multi-round-panel
title: 'Add multi-round panel discussion'
status: open
priority: low
scope: idea
scope_estimate: M
labels:
  - consensus
  - skill-family
  - panel
assignee: null
created: '2026-07-01T01:40:27Z'
updated: '2026-07-01T01:40:27Z'
associated_issues: []
---

## Description

Explore and potentially add an optional multi-round discussion mode for
`consensus-panel` after the v1 single-round independent panel ships. In this
mode, panelists could see each other's initial responses and produce a follow-up
round, while the host remains a neutral moderator and all panelist positions stay
attributed.

This is intentionally deferred from the current `consensus-panel` project so v1
can stay focused on independent breadth gathering with no forced convergence.

## Acceptance Criteria

- The product distinction is resolved and documented: multi-round panel
  discussion must not silently become `refine`/`evaluate` convergence or a
  synthesized single answer.
- The design specifies how panelists see prior responses, how many rounds are
  allowed, how attribution is preserved, and how the host maintains moderator
  neutrality.
- The panel artifact captures each round's attributed responses and clearly
  separates any neutral overview from panelist voices.
- Provider cost, timeout, and graceful-degradation behavior are defined for
  multi-round execution.
- The implementation, if accepted, remains behind explicit user opt-in or a
  documented configuration default and does not change the v1 single-round
  default behavior.
