---
id: DR-260613-synthesis-mediation-is-two
title: Synthesis mediation is two-tier — deterministic per-round merge plus
  agency-gated host/user escalation
date: 2026-06-13
status: "Accepted (implemented and merged to `main` via PR #9)."
legacy_id: DR-018
---

### DR-018: Synthesis mediation is two-tier — deterministic per-round merge plus agency-gated host/user escalation

- **Date:** 2026-06-13
**Context:** v3 assumed a model orchestrator could synthesize two parallel revisions each round. v0.1's orchestrator is a deterministic script, so `parallel_synthesized` needed a way to merge revisions without an in-loop reasoning model. The design gate (bl-7af0) weighed host-mediated synthesis turns vs. a third peer call vs. wrapper-only merging.
**Decision:** Split synthesis by the kind of judgment it requires. **Tier 1 (mechanical):** the wrapper drives a per-round synthesis peer call (the configured `--synthesizer`, defaulting to the first peer) that merges both revisions into the next round's shared input — deterministic, no host reasoning. **Tier 2 (judgment):** when a section is genuinely stuck (persistent disagreement, oscillation, budget exhaustion, near-done drift), the wrapper emits a structured `escalation_required` event routed by `--agency` to the host (re-entry via `--host-direction`, recorded as a `HOST_DECISION` round) or the user (`--user-direction`). A re-fired trigger after a prior host decision promotes to the user (genuinely-stuck).
**Rationale:** Most per-round merging is mechanical and belongs in the deterministic loop; only real disagreement resolution needs a model's broader-context judgment, and that judgment should respect the agency setting and stay auditable. Note: the Claude Agent SDK bills as metered API (not subscription), which informed keeping Tier 1 a single synthesizer call rather than multiplying host turns.
- **Status:** Accepted (implemented and merged to `main` via PR #9).
