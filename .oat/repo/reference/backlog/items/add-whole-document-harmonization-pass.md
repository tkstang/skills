---
id: bl-e39a
title: 'Add whole-document harmonization pass after section convergence'
status: open
priority: low
scope: feature
scope_estimate: M
labels: [consensus, quality]
assignee: null
created: '2026-06-12T21:33:26Z'
updated: '2026-06-12T21:33:26Z'
associated_issues: []
oat_template: true
oat_template_name: backlog-item
---

## Description

Sections currently converge independently with no cross-section reconciliation (documented v0.1 limitation). Add an optional harmonization pass (`--harmonize`, v3 default true once shipped): after all sections converge, peers see the full assembled document and propose cross-section refinements — terminology drift, redundancy, transitions, narrative flow — using the same loop mechanics and convergence detection. The harmonization log appends to the master artifact under its own section.

Open design question carried from v2/v3: harmonization context — peers see the assembled doc only (bounded context) or also per-section logs. Lean assembled-doc-only per v2. Must compose with both sequential and host-mediated parallel section orchestration (harmonization is inherently sequential, post-fan-in).

## Acceptance Criteria

- Harmonization pass runs after section convergence (sequential and parallel flows), appends its own deliberation log, and updates the final output.
- Context-bounding decision recorded; impasse in harmonization surfaces like section impasse.
- Resume covers interruption during harmonization.
- Tests + docs updated; v0.1 "no harmonization" limitation removed from READMEs.
