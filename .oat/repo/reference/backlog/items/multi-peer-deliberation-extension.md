---
id: bl-f8cb
title: 'Multi-peer (3+) deliberation extension (reserved / v3+ concern)'
status: open
priority: low
scope: idea
scope_estimate: L
labels: [consensus, consensus-loop, reserved]
assignee: null
created: '2026-06-19T23:57:18Z'
updated: '2026-06-19T23:57:18Z'
associated_issues: []
oat_template: true
oat_template_name: backlog-item
---

## Description

Thin seed for a parked v3 design question so it has a tracked home rather than
living only in the architecture doc. The current consensus engine is built around
**two symmetric peers**. The v3 architecture explicitly lists "Three+ agent
extension (pairwise disagreement, ties of three)" as a carried-forward open
question and a **"v3+ concern"** — i.e. deliberately out of first scope.

**Source:** `research/consensus/architecture-v3.md` ("Open design questions" #8).

Extending to three or more peers introduces problems the two-peer model does not
have: pairwise vs group convergence, majority/tie semantics, how oscillation and
hash-match generalize beyond a pair, verdict aggregation, and cost scaling. None
of this is justified yet; this item exists so the constraint is explicit and the
idea is not lost.

**Maturity:** speculative / low priority. Revisit only if a concrete need for
3+ peers emerges (e.g. a third provider materially improves deliberation quality
on real artifacts).

## Acceptance Criteria

- A go/no-go on whether 3+ peer deliberation is worth pursuing (may resolve to
  `wont_do` if two peers stay sufficient).
- If pursued: a design for group convergence, tie/majority semantics, oscillation
  generalization, verdict aggregation, and cost behavior across iteration modes,
  before any code.
