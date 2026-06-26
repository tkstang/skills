---
id: DR-260622-independent-draft-family
title: Independent-draft family wrappers stay thin and whole-artifact for v1
date: 2026-06-22
status: Accepted.
legacy_id: DR-026
---

### DR-026: Independent-draft family wrappers stay thin and whole-artifact for v1

- **Date:** 2026-06-22
**Context:** The v3 consensus architecture defined `independent_draft` as the natural cold start for creation-style skills, but the shipped loop only supported `shared_input`. The `consensus-family` project needed to add the shared primitive and ship `consensus-create`, `consensus-decide`, and `consensus-plan` without pulling in outline derivation, whole-document harmonization, or a second machine-readable schema layer.

**Decision:** Implement `independent_draft` in the shared `consensus-loop` core as a round-1-only cold-start strategy. The brief/options/goal content continues to travel through the existing artifact/section input channel, with prompt framing selected by `coldStart`: `shared_input` preserves existing revise-from-shared-artifact behavior; `independent_draft` asks each peer to produce its own first draft from untrusted input, then round 2+ uses the existing revision/synthesis flow. Record the selected cold start in the existing resolution block only. Keep `refine` and `evaluate` `shared_input`-only by wrapper-local validation. Ship `create`, `decide`, and `plan` as thin wrappers over the shared loop: parse their input shapes, set v3 defaults, provide prompt/output framing, and render markdown artifacts. For v1, `create` uses whole-artifact sectioning; outline-first derived sectioning is deferred. `decide` and `plan` use required markdown headings rather than new machine-readable output schemas. Alternating mode remains accepted for the new wrappers but has the documented degenerate behavior of peer A drafting first and peer B revising that draft.

**Rationale:** A round-1-only core branch keeps cold-start behavior mode-agnostic and avoids a parallel data path. Whole-artifact sectioning proves the new cold start plus `parallel_synthesized` wrappers without requiring outline derivation, per-section fan-out, harmonization, or auto-chunking before there is large-document creation demand. Structured markdown keeps decide/plan compatible with the existing artifact/audit-trail model and leaves machine schemas for a real downstream consumer. Wrapper-local `shared_input` guards protect refine/evaluate semantics while allowing a uniform override surface for creation-style wrappers.

- **Status:** Accepted.
