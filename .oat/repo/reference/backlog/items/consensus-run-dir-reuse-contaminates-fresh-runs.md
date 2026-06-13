---
id: bl-5966
title: 'Consensus run dir uses constant id "run"; repeated runs contaminate each other'
status: open
priority: medium
scope: feature
scope_estimate: S
labels: [consensus, resume, footgun, dogfood]
assignee: null
created: '2026-06-13T15:29:53Z'
updated: '2026-06-13T15:29:53Z'
associated_issues: []
oat_template: true
oat_template_name: backlog-item
---

## Description

The default consensus run directory is `.consensus/run` with a constant run id (`"run"`), so consecutive `refine` invocations in the same repo reuse the same run state. A fresh (non-`--resume`) run can pick up stale per-section records left by a prior run and seed from them, producing wrong output.

Observed live (2026-06-13 dogfood): several runs failed mid-deliberation (codex schema errors) after claude's turn-1 REVISE was already recorded to `.consensus/run/sections/<section>/records.json`. A subsequent clean `claude,claude` run reused that directory, inherited the stale turn-1 REVISE record, and converged on the ORIGINAL text (the revision appeared in the log but not the Final Output). Deleting `.consensus` and re-running produced the correct converged revision in 2 turns — confirming the loop is correct and the cause is run-dir/state reuse.

## Acceptance Criteria

- A fresh `refine` run (without `--resume`) never seeds from or is affected by a prior run's leftover state. Options: unique run id per run (timestamp/uuid) for the default run dir, and/or only seed records when explicitly resuming.
- Running `refine` twice in a row in the same repo on the same input yields identical correct output both times.
- `--resume` behavior is unchanged (it should still pick up the artifact's canonical state).
- A regression test covers "second run in a dirty .consensus does not inherit the first run's records."

## Source

Live dogfooding of consensus-iteration-modes (p06-t06), 2026-06-13.
