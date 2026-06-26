---
id: BL-260612-add-parallel-synthesized
title: Add parallel-synthesized iteration mode (synthesis-mediation design gate)
status: done
priority: high
scope: feature
scope_estimate: L
labels:
  - consensus
  - iteration-modes
  - design-gate
assignee: null
created: 2026-06-12T21:33:26Z
updated: 2026-06-13T20:30:00Z
associated_issues: []
legacy_id: bl-7af0
---

## Description

Implement `parallel_synthesized` iteration mode: both peers revise in parallel each round, then an orchestrator-level synthesis combines the revisions using both critiques, emitting `synthesized_artifact`, `synthesis_reasoning`, and `unresolved_disagreements` as first-class audit-trail entries. Convergence is synthesis stability (peers' revisions of round N's synthesis match the synthesis itself). See `research/consensus/architecture-v3.md`.

**Design gate (resolve before build):** the v3 architecture assumed the orchestrator is a model that can synthesize ("no fourth agent"), but the shipped orchestrator is a deterministic Node script (DR-003/DR-005 architecture). Two candidate resolutions:

1. **Host-mediated synthesis turns** — the wrapper pauses with a JSONL `synthesis_required` event carrying both revisions/critiques; the host model synthesizes; the wrapper validates and resumes. Consistent with the DR-003 dispatch pattern and preserves the broader-context rationale; implies new resume semantics for mid-synthesis interruption and a host round-trip per round.
2. **Third Paseo peer call as synthesizer** — self-contained and resumable, but a fresh stateless peer lacks the master-log context that justified orchestrator-as-third-voice.

The decision lands in `decision-record.md`. This item gates `consensus-create` (bl-b9b9), `consensus-decide` (bl-87ef), `consensus-plan` (bl-0cb8), and `consensus-research` (bl-645c), which all default to this mode. v3 Phase 2b.

## Acceptance Criteria

- Synthesis-mediation decision recorded as a DR with rationale and resume implications.
- `--iteration parallel_synthesized` runs end-to-end on the refine wrapper; synthesis entries (artifact, reasoning, unresolved disagreements) appear per round in the deliberation artifact.
- Synthesis-stability convergence implemented; agency setting modulates synthesis style per the v3 table (even-handed / editorial-with-reasoning / confident).
- Resume covers interruption before, during, and after a synthesis step, fail-closed on corruption.
- Unit + paseo-stub integration tests for synthesis rounds, convergence, impasse with unresolved disagreements.
- Docs updated: SKILL.md, plugin README, repo README limitations section.
