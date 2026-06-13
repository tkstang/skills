---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-13
oat_generated: true
oat_template: false
oat_template_name: summary
oat_summary_last_task: p07-t05
oat_summary_revision_count: 0
oat_summary_includes_revisions: []
---

# Summary: consensus-iteration-modes

## Overview

The consensus `refine` skill deliberated drafts using a single iteration mode (`alternating`): one peer revises, the other responds, turn by turn. The v3 family architecture, however, defines every unbuilt family skill around one of two *parallel* modes, so building those wrappers first would have shipped them off-spec. This project implemented v3 Phase 2 — the `parallel_revision` and `parallel_synthesized` iteration modes plus an agency-gated escalation ladder — over the existing deterministic loop engine, unblocking the rest of the consensus skill family.

## What Was Implemented

- **`parallel_revision` mode** — both peers revise the same input simultaneously each round, each critiquing its own and the peer's prior revision; the run converges on emergent same-round agreement (hash match / mutual `ACCEPT_PEER`). Costs 2× peer calls per round.
- **`parallel_synthesized` mode** — parallel revision plus a wrapper-driven synthesis call each round that merges both revisions into the next round's shared input. Costs 2× peer calls + 1 synthesis call. Synthesizer defaults to the first peer; `--synthesizer <provider>` overrides it (must be in the peer inventory or preflight fails `SYNTHESIZER_UNAVAILABLE`; warned-and-ignored outside the mode).
- **Agency-gated escalation ladder (FR5)** — parallel modes emit a structured `escalation_required` event on deterministic triggers (persistent disagreement, oscillation, budget exhaustion, near-done drift), routed by `--agency` to the user or host. Host decisions re-enter via `--resume … --host-direction "<text>"` (optionally `--host-decision-kind pick_a|pick_b|blend|direct|accept_impasse|extend_budget|defer_to_user`) and record as attributed `HOST_DECISION` orchestrator rounds; user decisions re-enter via `--user-direction`. A re-fired trigger after a prior host decision (or an explicit `defer_to_user`) promotes to the user (`promoted_from: host`).
- **Unified v1 verdict schema family** — per-record `schema_version: "v1"` across all modes plus an artifact-level `consensus_schema_version: "v1"`; mode-aware verdict/synthesis validation; byte caps on critique and synthesis fields; v0 artifacts rejected on resume with no migration.
- **Round-executor abstraction** over the loop engine, with `alternating` regression-locked on v1 fixtures (FR9).
- **Cost disclosure** — per-round multiplier on the `run_started` event (`calls_per_round`); actual `peer_calls`/`synthesis_calls` totals at completion and in the resolution block.
- **Live-peer compatibility hardening (Phase 7 dogfood)** — OpenAI/codex strict structured output support (draft-07 schemas, no `oneOf`, typed properties, verdict normalization that drops branch-disallowed fields), transient + our-validation retry on peer calls, JSON-only synthesis prompt, and unique per-invocation run directories.

Verified live end-to-end with claude + codex across all three modes and the escalation ladder; the QA walkthrough lives in `skills/refine/references/operator-qa.md`.

## Key Decisions

- **DR-018 — two-tier synthesis mediation.** v3 assumed a model orchestrator could synthesize each round, but v0.1's orchestrator is a deterministic script. Synthesis was split by the judgment it requires: **Tier 1 (mechanical)** is the wrapper-driven per-round synthesizer call; **Tier 2 (judgment)** is the agency-gated host/user escalation for genuinely-stuck sections. This keeps routine merging deterministic while routing real disagreement to a model with broader context, auditably and per the agency setting.
- **DR-019 — unified v1 schema, no migration; deterministic-only escalation triggers.** A single v1 verdict family keeps the loop and validators simple; no-migration is acceptable for a pre-release plugin with no external artifact corpus. Escalation triggers are deterministic only; a convergence similarity heuristic was deferred (bl-ef38).
- **Dispatch ceilings:** implementation at opus, review at fable (run inline, since fable is not dispatchable as a subagent).

## Design Deltas

- **p01-t06 → p05-t05 resequence.** The original "fail-closed v0 artifact resume rejection" task moved from Phase 1 to Phase 5. The engine has two distinct version fields — the per-record `schema_version` (bumped to v1 in p01) and the artifact-level `consensus_schema_version` (emitted as v0 by the wrapper until the Phase 5 cutover). Rejecting v0 *artifacts* on resume only makes sense after the wrapper emits v1 artifacts (p05-t01), or the wrapper would produce artifacts it cannot itself resume.
- **Phase 7 added from live dogfooding.** Not in the original plan; added to capture live-peer compatibility fixes surfaced by real runs, plus the final-review fix p07-t05 (persist HOST_DECISION routing metadata in the canonical artifact block so genuinely-stuck promotion stays restart-safe across resumes). The shipped implementation is the source of truth; reference docs were aligned in the documentation pass.

## Notable Challenges

- **Live-peer integration** surfaced a chain of blockers, each masking the next: daemon-not-running → Agent SDK draft 2020-12 rejection → `oneOf` not permitted → missing `type` keys → codex emitting all properties (strict mode). Resolved by moving to draft-07 schemas, dropping `oneOf`, typing every property, and normalizing verdicts to drop branch-disallowed fields.
- **A "lost revision" false alarm** turned out to be stale records in a reused run directory contaminating a fresh run — fixed with unique per-invocation run dirs; a deterministic stub reproduced the issue and proved the loop itself was correct.
- **Parallel modes were initially broken** because the default peer invocation sent the alternating schema (wrong verdict vocabulary, no critique); fixed with a per-mode schema resolver.
- **The HOST_DECISION restart-safety gap** (p07-t05) only manifested on a *twice-resumed* artifact — the in-memory single-resume path and smoke test passed, so the regression test suite had missed it.

## Tradeoffs Made

- **Deterministic-only escalation** over a fuzzy similarity heuristic — predictable and testable now; similarity scoring deferred until a proven need (bl-ef38).
- **No v0 → v1 migration** — acceptable for a pre-release plugin with no external artifact corpus; resume fails closed on v0 instead.

## Integration Notes

- The two parallel modes unblock the deferred consensus family skills: `consensus-evaluate` needs only `parallel_revision` and can land earliest (bl-5174); `-create/-decide/-plan/-research` build on `parallel_synthesized`.
- The synthesizer call bills as a normal peer call; note that the Claude Agent SDK bills as metered API, not subscription — relevant when choosing a `--synthesizer`.
- User-facing docs (plugin README, SKILL.md, operator-qa.md) and OAT reference docs (current-state, roadmap, backlog, decision-record) were synced to reflect the shipped capabilities.

## Follow-up Items

- **Deferred convergence follow-ons:** convergence similarity heuristic (bl-ef38), tool-based verdict submission CLI so peers self-validate schema (bl-3a88), in-house peer CLI to reduce the Paseo dependency (bl-bb7e).
- **Cursor-as-peer:** supported as a custom ACP provider but unverified end-to-end (bl-f0b6).
- **Still deferred from the v3 lane:** the five family skills, whole-document harmonization, deliberation metrics/cost caps, and the independent-draft cold-start strategy.

## Associated Issues

- Shipped backlog items: **bl-5d49** (parallel-revision iteration mode) and **bl-7af0** (parallel-synthesized iteration mode + synthesis-mediation design gate).
