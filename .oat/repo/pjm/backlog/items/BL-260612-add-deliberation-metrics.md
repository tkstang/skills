---
id: BL-260612-add-deliberation-metrics
title: Add deliberation metrics (tokens, wall-clock, rounds) to artifacts
status: open
priority: low
scope: feature
scope_estimate: S
labels:
  - consensus
  - observability
assignee: null
created: 2026-06-12T21:33:26Z
updated: 2026-06-12T21:33:26Z
associated_issues: []
legacy_id: bl-9ed4
---

## Description

Round counts and wall-clock are partially tracked today; the v3 resolution block also calls for token counts, per-section round totals, and approximate cost where peer CLIs expose them. Add consistent metrics to turn records, loop status, and the artifact resolution block across iteration modes. Investigate what Paseo surfaces per run (cost/token reporting varies by provider) and degrade gracefully (omit rather than guess).

Related open question from v3: whether `--max-cost-per-section` / `--max-cost-total` hard budget caps are feasible once cost signals exist — capture findings here, split a follow-up item if caps are pursued.

## Acceptance Criteria

- Resolution block reports total rounds, per-section rounds, wall-clock, and token/cost figures when available, with explicit "unavailable" semantics otherwise.
- Metrics are consistent across alternating and (once shipped) parallel modes, and survive resume.
- Feasibility note on cost-cap flags recorded in the item or a successor.
- Tests + docs updated.
