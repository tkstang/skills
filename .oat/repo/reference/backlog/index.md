# OAT Backlog Index

> Generated backlog table lives inside the managed section below. Keep curated narrative updates in the overview section so CLI regeneration stays safe.

## Curated Overview

- **Consensus Phase 2 + family (seeded 2026-06-12; modes shipped 2026-06-13):** the iteration-mode items (bl-5d49, bl-7af0) are now **done** — both parallel modes, synthesizer selection, and the agency-gated escalation ladder are implemented on `feat/consensus-iteration-modes` (final review in progress, merge pending), and the synthesis-mediation design gate resolved as a two-tier model (DR-018). The five family-skill items are now unblocked: `consensus-evaluate` (bl-5174) needs only `parallel_revision` and can land earliest; the others build on `parallel_synthesized` (see `../roadmap.md`, consensus lane).
- **Release:** bl-d85f (v0.1 verification + tag) is independent of consensus development and gates public announcements only.
- **Paseo dependency / build-vs-buy (seeded 2026-06-13):** bl-bb7e investigates a thin in-house peer-invocation layer to reduce/replace the Paseo runtime dependency — we use a single Paseo capability (`paseo run --provider … --output-schema … --json`) per turn behind the already-injectable `invokePeer` seam. Pairs with bl-3a88 (tool-based verdict submission): both target more robust structured output, and the in-house spike would let us control that path directly rather than working around Paseo's soft ACP schema enforcement. Investigation note also covers the unverified cursor-as-peer path.

<!-- OAT BACKLOG-INDEX -->
| ID | Title | Status | Priority | Scope | Estimate |
| --- | --- | --- | --- | --- | --- |
| bl-5d49 | Add parallel-revision iteration mode to consensus-loop | done | high | feature | M |
| bl-7af0 | Add parallel-synthesized iteration mode (synthesis-mediation design gate) | done | high | feature | L |
| bl-d85f | Complete v0.1 release verification and tag | open | high | task | M |
| bl-b9b9 | Add consensus-create skill (artifact from brief) | open | medium | feature | M |
| bl-87ef | Add consensus-decide skill (recommend among options) | open | medium | feature | S |
| bl-5174 | Add consensus-evaluate skill (artifact vs rubric) | open | medium | feature | S |
| bl-0cb8 | Add consensus-plan skill (structured plan from goal) | open | medium | feature | S |
| bl-bb7e | Investigate in-house peer-invocation CLI to reduce/replace the Paseo dependency | open | medium | initiative | L |
| bl-3a88 | Tool-based verdict submission for consensus peers (robust structured output) | open | medium | feature | L |
| bl-f0b6 | Verify cursor-as-peer end-to-end through Paseo (authenticated cursor-agent) | open | medium | task | S |
| bl-645c | Add consensus-research skill (investigate question, synthesized findings) | open | low | feature | M |
| bl-9ed4 | Add deliberation metrics (tokens, wall-clock, rounds) to artifacts | open | low | feature | S |
| bl-ef38 | Add similarity heuristic for near-converged deliberation states | open | low | feature | S |
| bl-e39a | Add whole-document harmonization pass after section convergence | open | low | feature | M |
<!-- END OAT BACKLOG-INDEX -->

## Notes

- Active item files live in `backlog/items/`
- Archived item files live in `backlog/archived/`
- Historical completions are summarized in `backlog/completed.md`
