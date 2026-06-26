---
id: DR-260613-unified-v1-verdict-schema
title: Unified v1 verdict schema with no v0 migration; deterministic-only
  escalation triggers
date: 2026-06-13
status: "Accepted (implemented and merged to `main` via PR #9)."
legacy_id: DR-019
---

### DR-019: Unified v1 verdict schema with no v0 migration; deterministic-only escalation triggers

- **Date:** 2026-06-13
**Context:** Parallel modes introduced new verdict vocabulary (`ACCEPT_PEER`, `CONVERGED`, critique fields) and a synthesis payload. Two questions: how to version records across modes, and whether escalation triggers should include a fuzzy "near-match" similarity heuristic.
**Decision:** Adopt a single **v1** verdict family across all modes (per-record `schema_version: "v1"` plus an artifact-level `consensus_schema_version: "v1"`), and **reject v0 artifacts on resume with no migration path** — the wrapper only resumes artifacts it currently emits. Escalation triggers are **deterministic only** (persistent disagreement, oscillation, budget exhaustion, near-done drift); a convergence similarity heuristic is deferred as a nice-to-have (bl-ef38). HOST_DECISION routing metadata (`decision_kind`, `escalation_trigger`) is persisted in the canonical artifact block so genuinely-stuck promotion survives a resume.
**Rationale:** A unified schema keeps the loop and validators simple and avoids per-mode branching at the record layer; no-migration is acceptable for a pre-release plugin with no external artifact corpus. Deterministic triggers are predictable and testable; similarity scoring adds model/heuristic surface area without a proven need yet.
- **Status:** Accepted (implemented and merged to `main` via PR #9).
