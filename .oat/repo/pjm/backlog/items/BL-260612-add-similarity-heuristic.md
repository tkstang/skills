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
updated: 2026-06-12T23:38:35Z
associated_issues: []
legacy_id: bl-ef38
---

## Description

The consensus-loop convergence engine is strictly deterministic: normalized-hash rules per iteration mode plus explicit verdicts (decided in consensus-iteration-modes discovery, 2026-06-12). "Nearly stable but not hash-identical" states escalate through the agency ladder (host or user decides) rather than being scored in code.

This item tracks the deferred nice-to-have from architecture v3: a similarity heuristic (e.g. normalized edit distance over the DR-004 normalization) that lets the loop self-confirm almost-converged states — triggering one extra confirmation round or counting a near-match toward convergence — without escalating. Would reduce escalation frequency on long documents where peers settle into trivially-different phrasings.

Design constraints if picked up: the heuristic must be deterministic and reproducible (fixed algorithm + threshold recorded in the artifact), gated by agency level (likely moderate+ only), and recorded in turn records so the audit trail shows when similarity (rather than hash equality) drove a convergence call.

## Source

Deferred from consensus-iteration-modes discovery (Question 3, 2026-06-12). Originates in the v3 architecture's "high-similarity-but-not-identical can trigger one more round to confirm" note (`research/consensus/architecture-v3.md`).

## Acceptance Criteria

- Deterministic similarity measure with a documented threshold, applied per iteration mode's convergence shape.
- Agency-gated activation; minimal agency remains strict-hash-only.
- Turn records and resolution block disclose similarity-driven convergence calls.
- Tests cover threshold boundaries and audit-trail disclosure.
