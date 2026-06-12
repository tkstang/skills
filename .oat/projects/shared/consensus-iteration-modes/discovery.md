---
oat_status: complete
oat_ready_for: oat-project-design
oat_blockers: []
oat_last_updated: 2026-06-12
oat_generated: false
---

# Discovery: consensus-iteration-modes

## Phase Guardrails (Discovery)

Discovery is for requirements and decisions, not implementation details.

- Prefer outcomes and constraints over concrete deliverables (no specific scripts, file paths, or function names).
- If an implementation detail comes up, capture it as an **Open Question** for design (or a constraint), not as a deliverable list.

## Initial Request

Implement v3 Phase 2 of the consensus plugin: the two remaining iteration modes, `parallel_revision` and `parallel_synthesized`, in the shared consensus-loop engine, exposed through the existing `refine` skill via `--iteration`. This unblocks the five deferred family skills (`consensus-evaluate`, `-create`, `-decide`, `-plan`, `-research`), all of which default to one of these modes per the v3 architecture.

Backlog items: `bl-5d49` (parallel-revision) and `bl-7af0` (parallel-synthesized, which carries the synthesis-mediation design gate). Source material: `.oat/repo/reference/research/consensus/architecture-v3.md`, the consensus lane in `.oat/repo/reference/roadmap.md`, and DR-002 through DR-006 in `.oat/repo/reference/decision-record.md`. See `references/README.md` in this project.

Headline open question carried in from planning: the v3 architecture assumed a model orchestrator that can synthesize ("orchestrator-as-third-voice"), but v0.1 shipped a deterministic script orchestrator — synthesized mode needs a mediation decision (host-mediated synthesis turns vs. a third peer call) before build.

## Clarifying Questions

### Question 1: Synthesis mediation (parallel-synthesized mode)

**Q:** Who performs per-round synthesis now that the orchestrator is a deterministic script — host-mediated turns or a wrapper-driven peer call?

**A (dialogue summary):** Initial recommendation was wrapper-driven (a third stateless Paseo call with wrapper-assembled context), since per-round host mediation is a different frequency class than the once-per-run parallel dispatch seam, pulls the full deliberation into host context, and complicates resume/testing. User surfaced two correctives: (1) Paseo's Claude provider runs the Claude Agent SDK, which bills as metered API usage — not subscription plan limits — so host-mediated synthesis has a real recurring cost advantage (host turns ride the subscription; every Paseo call is metered); (2) the v3 editorial-agency concept always intended the orchestrating model to exercise judgment with broader context at decision points — a stateless synthesizer call has no such standing.

**Decision:** Two-tier synthesis, distinguishing mechanical synthesis from synthesis requiring real judgment:

1. **Routine rounds — wrapper-driven.** Per-round merge is a stateless Paseo call with wrapper-assembled context (goal, both revisions + critiques, prior rounds, unresolved disagreements). Synthesizer model configurable; a cheap model is viable for mechanical merging. Keeps the engine self-contained, resume-simple, headless-testable.
2. **Decision points — host as call-maker, gated by agency.** When judgment is needed (persistent unresolved disagreements, oscillation, budget exhaustion, declare-done-despite-drift), the wrapper exits with a structured escalation — the same pattern as today's impasse surfacing — and the agency setting decides who answers: minimal → user; moderate → host decides minor contested calls, surfaces meaningful ones; maximum → host decides unless genuinely stuck. Host decisions resume the run and are recorded as a distinct orchestrator-round type alongside user-intervention rounds, so the audit trail distinguishes user steering from host judgment.

This enriches (not rewrites) the v0.1 agency decision: deterministic wrapper rules still decide *when* to escalate; agency now also selects *who* exercises judgment. Per-round host synthesis remains a compatible future option since artifacts record synthesizer identity per round.

### Question 2: Schema versioning and resume compatibility

**Q:** How do verdict/record schemas evolve for the new modes (mode-aware verdicts, synthesis records, orchestrator rounds), and what resume compatibility is owed to v0.1 artifacts?

**A:** Unified v1, no migration.

**Decision:** One coherent v1 schema family across all three iteration modes. v0 artifacts (pre-release dogfooding output only — v0.1 never shipped publicly) do not resume under v0.2; resume fails closed with a clear message identifying the version mismatch. No migration machinery. This supersedes the migration expectation in DR-004 for the pre-release window; post-release schema changes will owe real compatibility.

### Question 3: Convergence semantics

**Q:** Should convergence detection stay strictly deterministic (hashes + explicit verdicts), or adopt v3's near-match similarity idea in code?

**A:** Deterministic only, with the similarity heuristic explicitly captured as a backlog nice-to-have.

**Decision:** Convergence remains strictly deterministic: per-mode normalized-hash rules (same-round peer hash match for parallel-revision; synthesis-stability for parallel-synthesized) plus explicit verdicts (mutual ACCEPT_PEER crossover; mutual CONVERGED honored at moderate+ agency). No similarity metrics in the wrapper — "nearly stable" states escalate through the Question 1 agency ladder. The similarity heuristic is tracked as backlog item bl-ef38.

### Question 4: Cost and UX posture

**Q:** Given that Paseo peer calls are metered API spend (parallel-revision 2x, synthesized 3x calls per round), what are the mode defaults, disclosure, and synthesizer-default postures?

**A:** Opt-in + disclosure; synthesizer defaults to the first peer's provider.

**Decision:** `refine`'s default iteration stays alternating; parallel modes are explicit opt-ins. The wrapper discloses the per-round call multiplier when a parallel mode starts (JSONL and docs) and reports actual peer/synthesizer call counts in the resolution block. No hard cost caps in this project — cost budgeting rides the deferred metrics item (bl-9ed4). The default synthesizer is the first configured peer's provider, overridable via a synthesizer option; docs recommend a cheaper model for routine merging.

## Solution Space

The mode mechanics themselves are settled by the v3 architecture (`references/README.md`); the genuinely open dimension was synthesis mediation for parallel-synthesized mode, explored in depth through Question 1.

### Approach 1: Two-tier synthesis — wrapper-driven rounds, agency-gated host escalation _(Chosen)_

**Description:** Routine per-round synthesis is a stateless Paseo call assembled by the wrapper; judgment-requiring states (persistent disagreement, oscillation, budget exhaustion) escalate to the host model or user according to the agency setting, recorded as a distinct orchestrator-round type.
**When this is the right choice:** When the engine must stay deterministic, resumable, and headless-capable, while still honoring the v3 editorial-agency concept and applying host judgment (and subscription economics) where it matters.
**Tradeoffs:** Routine merges come from a stateless model without conversation context; metered cost of a third call per round (mitigated by configurable cheap synthesizer).

### Approach 2: Pure wrapper-driven synthesis

**Description:** Synthesis is always a peer call; escalations go only to the user (today's impasse pattern unchanged).
**When this is the right choice:** If host runtimes couldn't be trusted to exercise judgment, or maximal simplicity outweighed the agency concept.
**Tradeoffs:** Discards the v3 editorial-agency vision — moderate/maximum agency stay purely deterministic stand-ins; every contested call interrupts the user.

### Approach 3: Host-mediated per-round synthesis

**Description:** The wrapper exits with a synthesis-required event every round; the host model synthesizes and re-invokes.
**When this is the right choice:** When host editorial judgment per round is paramount, or metered peer spend must be minimized (host turns ride subscriptions while Agent-SDK peer calls are metered API).
**Tradeoffs:** ~1 wrapper round-trip per round per section; full deliberation content accumulates in host context; new mid-synthesis resume states; synthesized mode unusable headless; a second model-invocation stack to keep consistent in the audit trail.

### Chosen Direction

**Approach:** 1 — two-tier synthesis.
**Rationale:** Distinguishes mechanical synthesis from synthesis requiring real judgment. Keeps the deterministic engine self-contained (resume, testing, headless) while routing genuine judgment to the host with its conversation context and subscription economics, via the escalation seam that already exists for impasses.
**User validated:** Yes (Question 1 dialogue, 2026-06-12).

## Options Considered

Granular options were resolved inside the clarifying questions: schema posture (Q2 — unified v1, no migration, over additive dual-generation or migration), convergence strictness (Q3 — deterministic-only over similarity heuristics, bl-ef38 deferred), and cost/synthesizer defaults (Q4 — opt-in + disclosure; first-peer default synthesizer over an opinionated cheap default or mandatory flag).

## Key Decisions

1. **Synthesis mediation:** Two-tier — wrapper-driven mechanical synthesis per round; agency-gated host-or-user escalation at judgment points, recorded as orchestrator rounds distinct from user rounds.
2. **Schema posture:** Unified v1 schema family across all three modes; v0 artifacts fail closed on resume with a clear message; no migration (pre-release window).
3. **Convergence:** Strictly deterministic per-mode rules (normalized hashes + explicit verdicts; mutual CONVERGED honored at moderate+ agency); near-miss judgment escalates rather than being scored in code.
4. **Cost/UX:** Parallel modes are explicit opt-ins with call-multiplier disclosure and actual call counts in the resolution block; no hard cost caps this project; synthesizer defaults to the first peer's provider.
5. **Scope:** Both iteration modes land in this project, exposed through the existing refine skill's iteration option; the five family skills remain separate backlog items consuming this work.

## Constraints

- Node >= 22, ESM, standard library only — no new dependencies (repo convention).
- Peer and synthesizer execution stays behind the Paseo shell-out boundary (DR-002); version-range preflight retained.
- The wrapper remains deterministic: model judgment lives only in peer/synthesizer calls and host/user escalation responses.
- The deliberation artifact remains the canonical, fail-closed resume state (DR-005), extended to the new round types.
- Host coordination stays JSONL-only on routine rounds; full revision content does not flow into host context except at escalation points.
- Existing alternating-mode behavior must not regress beyond the deliberate v1 schema change.

## Success Criteria

- Both new modes run end-to-end on real markdown documents through the refine skill, converging per their deterministic rules, with publishable audit trails recording mode, per-round critiques, synthesis text + reasoning + unresolved disagreements, and synthesizer identity.
- The escalation ladder demonstrably works at all three agency levels: minimal surfaces to the user; moderate/maximum produce host call-maker decisions recorded as orchestrator rounds and distinguishable from user rounds in the artifact.
- Resume recovers mid-run for both modes, including interruption around a synthesis step; v0 artifacts are rejected with a clear version message.
- Mocked (paseo-stub) integration and smoke coverage for both modes; `npm test`, `npm run validate`, `npm run smoke` green.
- A mode-comparison dogfood run (same artifact through all three modes) is performed and its artifacts reviewed — the v3 Phase 2 validation step.

## Out of Scope

- The five family skills (`consensus-evaluate`, `-create`, `-decide`, `-plan`, `-research`) — separate backlog items consuming this engine work.
- Whole-document harmonization (bl-e39a), deliberation metrics and cost caps (bl-9ed4), similarity heuristic (bl-ef38).
- Host-mediated per-round synthesis (deferred idea below).
- v0 artifact migration.
- Cursor-as-peer configuration and three-plus-peer deliberation.

## Deferred Ideas

- **Host-mediated per-round synthesis mode** — strongest case is API-key-metered Paseo setups, where host turns ride a subscription while every wrapper call is metered; artifacts record synthesizer identity per round from day one, so this slots in without schema changes. Revisit after dogfooding.
- **Similarity heuristic for near-converged states** — bl-ef38.
- **Cost caps** (max-cost style budgets) — needs the metrics substrate (bl-9ed4) first.
- **Opinionated cheap-synthesizer preset** — a documented recommendation now; could become a curated default once a reliably-present cheap provider exists in Paseo configs.

## Open Questions

Carried into design:

- **Escalation triggers:** the exact deterministic rules for when persistent unresolved disagreements, oscillation, or budget exhaustion escalate, per agency level — and how trigger thresholds interact with max-rounds.
- **Orchestrator-round mechanics:** record shape for host decisions, the resume vector that carries them back in (analogue of the user-direction flag), and how the artifact distinguishes host identity; trust model mirrors the existing user-direction flow.
- **Cold-start parameterization:** the engine gains the cold-start dimension with the new modes — decide whether `independent_draft` engine support lands now (unexposed by refine, which is shared_input) or with the family skills that need it.
- **Synthesis prompt + caps:** synthesis prompt design (v3 sketch as starting point) and how DR-004 byte caps extend to synthesis responses.
- **JSONL vocabulary:** event shapes for mode disclosure, escalation requests, and escalation outcomes.
- **Round accounting:** confirm the v3 mode-agnostic round definition for max-rounds and how disclosure reports it.

## Assumptions

- Paseo's prompt-append + JSON-extract + retry structured-output behavior remains stable across the tested version range (validated against 0.1.76 source on 2026-06-12).
- Claude Agent SDK usage bills as metered API spend, not subscription plan limits (per user, 2026-06-12) — the premise of the cost posture.
- Two peers remain the deliberation arity; the synthesizer is a third stateless call, not a third deliberating voice.

## Risks

- **Mechanical synthesis quality:** a stateless (possibly cheap) synthesizer may produce weak merges.
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Mitigation Ideas:** Configurable synthesizer model; peer critique of the synthesis next round catches bad merges; escalation ladder backstops persistent failure; mode-comparison dogfooding before release claims.
- **Escalation chattiness:** deterministic triggers tuned too tight make moderate/maximum agency interrupt the host constantly, recreating the per-round protocol we rejected.
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Mitigation Ideas:** Conservative trigger defaults; triggers tunable via flags; dogfood on contentious documents before settling defaults.
- **Engine complexity:** the loop engine roughly triples its behavioral surface (three modes × agency × escalation × resume).
  - **Likelihood:** High
  - **Impact:** Medium
  - **Mitigation Ideas:** Design phase should modularize mode logic within the stdlib constraint; paseo-stub matrix tests per mode; keep alternating path regression-locked.
- **Parallel oscillation subtleties:** divergent-pair oscillation detection differs structurally from alternating-mode hash flip-flop.
  - **Likelihood:** Medium
  - **Impact:** Low
  - **Mitigation Ideas:** Define per-mode oscillation predicates in design; fixture tests for known oscillation shapes.

## Next Steps

Use this discovery artifact to drive the next workflow step:

- **Spec-driven mode:** continue to `oat-project-design` (which confirms
  requirements and produces both `spec.md` and `design.md`).
- **Spec-driven mode → formalize-only:** use `oat-project-spec` standalone
  if you want a formalized requirements artifact but aren't ready to
  design yet.
- **Quick mode → straight to plan:** proceed directly to `plan.md` when
  scope is clear and no architecture decisions remain.
- **Quick mode → optional lightweight design:** produce a focused
  `design.md` (architecture, components, data flow, testing) before
  planning. Choose this when discovery surfaced architecture choices
  or component boundaries.
- **Quick mode → promote:** escalate to spec-driven if discovery revealed
  the scope is larger or more complex than expected.
