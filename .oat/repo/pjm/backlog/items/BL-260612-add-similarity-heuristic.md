---
id: BL-260612-add-similarity-heuristic
title: Add similarity heuristic for near-converged deliberation states
status: open
priority: low
scope: feature
scope_estimate: S
labels:
  - consensus
  - convergence
  - nice-to-have
assignee: null
created: 2026-06-12T23:38:35Z
updated: 2026-09-16T18:06:09Z
associated_issues: []
legacy_id: bl-ef38
---

## Description

The consensus-loop convergence engine uses deterministic hash, verdict, and agency rules, not a numerical similarity score. Unequal hashes do not always escalate: maximum agency can accept two ACCEPT verdicts on unequal hashes (`src/plugins/consensus/core/loop-escalation.ts`). That existing near-match label is not a measured similarity threshold. This item adds an explicit scoring contract only if usage evidence justifies it.

This item tracks the deferred nice-to-have from architecture v3: a similarity heuristic (e.g. normalized edit distance over the DR-004 normalization) that lets the loop self-confirm almost-converged states — triggering one extra confirmation round or counting a near-match toward convergence — without escalating. Would reduce escalation frequency on long documents where peers settle into trivially-different phrasings.

Design constraints if picked up: the heuristic must be deterministic and reproducible (fixed algorithm + threshold recorded in the artifact), gated by agency level (likely moderate+ only), and recorded in turn records so the audit trail shows when similarity (rather than hash equality) drove a convergence call.

## Source

Deferred from consensus-iteration-modes discovery (Question 3, 2026-06-12). Originates in the v3 architecture's "high-similarity-but-not-identical can trigger one more round to confirm" note (`.oat/repo/reference/research/consensus/architecture-v3.md`).

## Acceptance Criteria

- Deterministic similarity measure with a documented threshold, applied per iteration mode's convergence shape.
- Agency-gated activation; minimal agency remains strict-hash-only.
- Turn records and resolution block disclose similarity-driven convergence calls.
- Tests cover threshold boundaries and audit-trail disclosure.
