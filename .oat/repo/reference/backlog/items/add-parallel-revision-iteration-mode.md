---
id: bl-5d49
title: 'Add parallel-revision iteration mode to consensus-loop'
status: open
priority: high
scope: feature
scope_estimate: M
labels: [consensus, iteration-modes]
assignee: null
created: '2026-06-12T21:33:26Z'
updated: '2026-06-12T21:33:26Z'
associated_issues: []
oat_template: true
oat_template_name: backlog-item
---

## Description

Implement `parallel_revision` as a second iteration mode in the consensus-loop engine (`plugins/consensus/skills/refine/scripts/consensus-loop.mjs`), exposed via `--iteration parallel_revision` on the refine wrapper. Both peers work simultaneously on the same input each round, each producing a revision plus a critique of both prior revisions (own and peer). Convergence is hash-match between the two peers' revisions in the same round (emergent agreement), or mutual `ACCEPT_PEER`.

Per `research/consensus/architecture-v3.md`: new verdict schema (`critique.own_previous`, `critique.peer_previous`, verdicts `REVISE | ACCEPT_PEER | CONVERGED | IMPASSE`), 2 peer calls per round, oscillation detection across divergent version pairs. Agency semantics (DR-006) extend to the new convergence shape.

This is v3 Phase 2a and the gating dependency for `consensus-evaluate` (bl-5174). Part of the consensus Phase 2 lane in `roadmap.md`.

## Acceptance Criteria

- `--iteration parallel_revision` runs end-to-end on the refine wrapper (sequential sections), with mode recorded in artifact frontmatter, turn records, and resolution block.
- Mode-aware verdict schema validated (Paseo structural + post-receive byte caps per DR-004); `ACCEPT_PEER` and `CONVERGED` semantics implemented as designed.
- Same-round hash-match convergence, mutual-ACCEPT_PEER crossover, max-rounds, and parallel-mode oscillation detection covered by unit + paseo-stub integration tests.
- Resume (DR-005) works for parallel-revision artifacts, including corrupt-section fail-closed behavior.
- Host-mediated parallel section dispatch (DR-003) composes with the new mode.
- Docs updated: SKILL.md, plugin README, repo README limitations section.
