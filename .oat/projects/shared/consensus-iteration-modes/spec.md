---
oat_status: complete
oat_ready_for: oat-project-design
oat_blockers: []
oat_last_updated: 2026-06-12
oat_generated: false
---

# Specification: consensus-iteration-modes

## Phase Guardrails (Specification)

Specification is for requirements and acceptance criteria, not design/implementation details.

- Avoid concrete deliverables (specific scripts, file paths, function names).
- Keep the "High-Level Design" section to architecture shape and component boundaries only.
- If a design detail comes up, record it under **Open Questions** for `oat-project-design`.

## Problem Statement

The consensus plugin's v0.1 release ships one iteration mode: alternating turn-taking, where one peer revises and the other responds. The v3 family architecture defines two further modes — parallel-revision (both peers work simultaneously each round and converge by emergent agreement) and parallel-synthesized (parallel revision plus a per-round synthesis that merges both drafts) — and every deferred family skill (`consensus-evaluate`, `-create`, `-decide`, `-plan`, `-research`) defaults to one of them. Until these modes exist in the shared deliberation engine, the family cannot ship on-spec and the plugin's strongest consensus signal (independent convergence) is unavailable.

The architectural wrinkle, resolved in discovery, is that v3 assumed a model orchestrator that could synthesize and exercise editorial agency, while v0.1 deliberately shipped a deterministic script orchestrator. Discovery chose a two-tier synthesis architecture: mechanical per-round synthesis is performed by a stateless, wrapper-driven model call, while judgment-requiring states escalate — gated by the existing agency setting — to the host model or the user, recorded distinctly in the audit trail.

This project implements both modes in the shared engine, the unified v1 record schema they require, and the agency-gated escalation ladder, exposed through the existing `refine` skill's iteration option.

## Goals

### Primary Goals

- Both new iteration modes run end-to-end on real markdown documents through the refine skill, converging by deterministic per-mode rules, with publishable audit trails.
- The agency setting gains its intended judgment dimension: deterministic triggers escalate to the user or the host model depending on agency level, and host decisions are first-class audit-trail entries.
- The deliberation record schema becomes one coherent v1 family across all three modes.
- Existing alternating-mode behavior is preserved (regression-locked) apart from the deliberate schema change.

### Secondary Goals

- Synthesizer model is configurable so routine merging can run on a cheaper model.
- Cost transparency: parallel modes disclose their call multiplier up front and report actual call counts at completion.
- Host-mediated parallel section orchestration composes with the new modes.

## Non-Goals

- The five family skills themselves (separate backlog items consuming this work).
- Whole-document harmonization (bl-e39a), deliberation metrics/cost caps (bl-9ed4), similarity-based convergence (bl-ef38).
- Host-mediated per-round synthesis (deferred idea; the artifact records synthesizer identity so it can slot in later).
- Migration of v0 artifacts (pre-release window; resume of v0 artifacts fails closed).
- Cursor-as-peer configuration; three-or-more-peer deliberation.
- Exposing the independent-draft cold-start strategy through the refine skill (refine remains shared-input; see Open Questions for engine-level support).

## Requirements

### Functional Requirements

**FR1: Parallel-revision iteration mode**

- **Description:** Both peers revise the same input simultaneously each round, each emitting a revision plus a critique of its own and its peer's previous revision. Convergence is emergent: same-round normalized-hash match between the two revisions, or an explicit mutual-acceptance crossover.
- **Acceptance Criteria:**
  - A multi-section markdown document refines end-to-end in this mode with per-round critiques recorded for both peers.
  - Convergence triggers on same-round hash match and on mutual ACCEPT_PEER; mutual CONVERGED verdicts conclude a section at moderate or maximum agency, and escalate at minimal agency.
  - Divergent-pair oscillation (the two peers' revisions cycling between stable states across rounds) is detected and escalates as impasse.
- **Priority:** P0

**FR2: Parallel-synthesized iteration mode**

- **Description:** Both peers revise in parallel; a wrapper-driven stateless synthesis call merges the two revisions using both critiques, emitting synthesized text, synthesis reasoning, and unresolved disagreements. The next round both peers revise the synthesis. Convergence is synthesis stability: peer revisions of round N's synthesis hash-match the synthesis itself.
- **Acceptance Criteria:**
  - A multi-section document refines end-to-end with per-round synthesis records (text, reasoning, unresolved disagreements, synthesizer identity) in the artifact.
  - Convergence triggers when both peers' revisions match the prior synthesis hash; unresolved disagreements persisting across consecutive rounds feed the escalation triggers (FR5).
  - Synthesis responses are schema-validated and byte-capped like peer verdicts; oversized or invalid synthesis aborts the section as an error, recorded metadata-only.
- **Priority:** P0

**FR3: Mode selection, disclosure, and reporting**

- **Description:** The refine skill exposes iteration-mode selection with alternating as the default. Parallel modes disclose their per-round call multiplier when a run starts, and the resolution block reports the mode and actual peer/synthesizer call counts.
- **Acceptance Criteria:**
  - Iteration mode is selectable per run; invalid mode values fail preflight with a clear message.
  - Starting a parallel mode emits a host-readable disclosure event naming the call multiplier (2x peer calls; synthesized adds 1 synthesis call per round).
  - Artifact frontmatter and resolution block record the mode; resolution reports total peer calls and synthesis calls.
- **Priority:** P0

**FR4: Unified v1 record schema family**

- **Description:** One coherent v1 schema generation covers all three modes: mode-aware peer verdicts (alternating's ACCEPT/REVISE/IMPASSE; parallel modes' REVISE/ACCEPT_PEER/CONVERGED/IMPASSE with own/peer critiques), synthesis records, and intervention rounds attributed to either the user or the host orchestrator.
- **Acceptance Criteria:**
  - All verdicts, turn records, loop status, and artifact canonical blocks carry the v1 schema version.
  - Parallel-mode verdicts validate critique fields and the extended verdict vocabulary; post-receive byte caps extend to the new fields and synthesis payloads.
  - Resuming a v0 artifact fails closed with a message identifying the schema-version mismatch (no migration).
- **Priority:** P0

**FR5: Agency-gated escalation ladder**

- **Description:** Deterministic triggers (persistent unresolved disagreements, oscillation, round-budget exhaustion, declare-done-despite-drift states) produce a structured escalation. The agency setting selects the decision-maker: minimal always surfaces to the user; moderate routes minor contested calls to the host and meaningful ones to the user; maximum routes to the host unless genuinely stuck. Decisions re-enter the run and are recorded as orchestrator rounds, distinct from user rounds.
- **Acceptance Criteria:**
  - Each trigger has a documented deterministic rule; identical inputs produce identical escalation behavior.
  - Escalation requests and outcomes are emitted as structured host-readable events including the divergent state and decision options.
  - A host decision resumes the run via a recorded orchestrator round carrying the decision text and decision-maker identity; user decisions continue to record as user rounds.
  - At minimal agency, no host-decided rounds occur; at maximum agency, only genuinely-stuck states reach the user.
- **Priority:** P0

**FR6: Synthesizer configuration**

- **Description:** The synthesis call's provider defaults to the first configured peer's provider and is overridable per run. Synthesizer identity is recorded with every synthesis record.
- **Acceptance Criteria:**
  - Default synthesizer resolves to the first peer when unspecified; an override flag selects any provider present in the peer inventory, validated at preflight.
  - Every synthesis record and the resolution block name the synthesizer provider.
- **Priority:** P1

**FR7: Resume for new modes**

- **Description:** Artifact-canonical resume (fail-closed on corruption) extends to both new modes, including interruption before, during, and after a synthesis step and pending escalations.
- **Acceptance Criteria:**
  - Interrupted parallel-revision and parallel-synthesized runs resume from the artifact alone, preserving mode, agency, synthesizer identity, and per-section state.
  - A run interrupted at a pending escalation resumes by re-presenting the escalation (or accepting a decision supplied on resume).
  - Corrupt section state remains fail-closed with the existing explicit skip controls.
- **Priority:** P0

**FR8: Parallel-section orchestration compatibility**

- **Description:** Host-mediated section dispatch (prepare → dispatch → fan-in) works when the run uses a parallel iteration mode; section runners execute their section's loop in the selected mode.
- **Acceptance Criteria:**
  - Prepare emits mode/synthesizer metadata in section packets; fan-in assembles parallel-mode section results in original order.
  - A section runner hitting an escalation surfaces it in its section result rather than blocking the whole run.
- **Priority:** P1

**FR9: Alternating regression lock**

- **Description:** Alternating mode's observable behavior (convergence rules, impasse handling, resume, artifact shape) is unchanged except for the deliberate v1 schema bump.
- **Acceptance Criteria:**
  - The existing alternating test suite passes with at most schema-version-related fixture updates.
  - An alternating run's artifact differs from v0.1 output only in schema-version fields and any unified-record naming the design explicitly calls out.
- **Priority:** P0

### Non-Functional Requirements

**NFR1: Deterministic engine**

- **Description:** The wrapper and loop engine contain no model judgment: given identical inputs and identical peer/synthesizer responses, runs produce identical decisions, escalations, and artifacts.
- **Acceptance Criteria:**
  - Mocked-peer test runs are byte-reproducible apart from timestamps and run identifiers.
  - All convergence/escalation predicates are pure functions of recorded state.
- **Priority:** P0

**NFR2: Runtime constraints**

- **Description:** Node >= 22, ESM, standard library only; peer and synthesizer execution stays behind the Paseo shell-out boundary with version-range preflight.
- **Acceptance Criteria:**
  - No new package dependencies; structural validation passes.
- **Priority:** P0

**NFR3: Verification coverage**

- **Description:** Both new modes are covered by mocked-peer unit and integration tests and the mocked end-to-end smoke flow.
- **Acceptance Criteria:**
  - Test matrix covers each mode's convergence, oscillation, escalation (per agency level), resume, and schema-validation paths; full suite, structural validation, and smoke runs are green.
- **Priority:** P0

**NFR4: Audit-trail legibility**

- **Description:** A reader of the deliberation artifact can attribute every content change and decision to a peer, the synthesizer, the host orchestrator, or the user, and follow why each section concluded.
- **Acceptance Criteria:**
  - Artifact review during mode-comparison dogfooding confirms each round's actor and rationale are identifiable without consulting external state.
- **Priority:** P0

**NFR5: Host-context discipline**

- **Description:** Routine rounds emit only coordination events to the host; full revision/synthesis content crosses to the host only at escalation points.
- **Acceptance Criteria:**
  - Event payload inventory shows routine-round events carry status/metadata only; escalation events are the sole carriers of divergent content.
- **Priority:** P1

## Constraints

- Node >= 22, ESM, standard library only — no new dependencies (repository convention).
- Paseo shell-out boundary (DR-002) with tested-version-range preflight retained.
- The wrapper remains deterministic; model judgment lives only in peer/synthesizer calls and escalation responses (extends DR-006).
- The deliberation artifact remains the canonical, fail-closed resume state (DR-005), extended to new round types.
- JSONL stdout remains the host coordination protocol; stderr remains diagnostics-only.
- Published plugin behavior must not reference OAT scaffolding (DR-001).

## Dependencies

- Paseo CLI on PATH (tested range 0.1.0–0.9.0; structured-output behavior validated against 0.1.76 source).
- Existing consensus engine and wrapper (v0.1) as the modification surface.
- Existing test infrastructure: mocked-peer stubs, smoke harness, structural validator.
- Plugin documentation set (skill instructions, plugin/repo READMEs) for the user-facing surface changes.

## High-Level Design (Proposed)

The deliberation engine gains iteration mode as a first-class parameter. Alternating keeps its current turn loop. Parallel-revision runs both peers concurrently each round against the same input and compares their outputs for emergent convergence. Parallel-synthesized adds a third stateless model call after each parallel round — the mechanical synthesizer — whose merged output becomes the next round's shared input.

Judgment is layered above the deterministic loop rather than inside it: a set of deterministic escalation triggers produce structured escalation events, and the agency setting routes each to the user or to the host model, whose decision re-enters the loop as a recorded orchestrator round. This reuses the proven impasse-surfacing seam (JSONL event out, resume vector in) rather than inventing a new protocol, and it keeps the engine testable with mocked peers.

All records move to a unified v1 schema family with mode-aware verdict vocabularies, synthesis records, and attributed intervention rounds. Resume reads the same canonical artifact blocks as today, extended with the new record types; v0 artifacts are rejected fail-closed.

**Key Components:**

- Deliberation loop engine — gains mode-parameterized round execution, per-mode convergence/oscillation predicates, and synthesis-call orchestration.
- Escalation layer — deterministic triggers, agency routing, escalation event emission, and decision re-entry as orchestrator rounds.
- Record schema family (v1) — mode-aware verdicts, synthesis records, intervention rounds, extended byte caps, version gating on resume.
- Wrapper/CLI surface — mode and synthesizer selection, preflight validation, disclosure events, resolution-block reporting.
- Host instruction set — skill instructions covering mode selection, escalation handling per agency level, and decision re-entry.
- Parallel-section packets — mode/synthesizer metadata threaded through prepare/dispatch/fan-in.

**Alternatives Considered:**

- Host-mediated per-round synthesis — rejected for routine rounds (per-round wrapper round-trips, host-context accumulation, new resume states, headless unusability); preserved as a deferred compatible option.
- Pure wrapper-driven synthesis with user-only escalation — rejected; discards the editorial-agency concept that motivated agency levels.
- Similarity-based convergence — rejected for determinism; tracked as bl-ef38.
- Additive v0+v1 schema coexistence or v0 migration — rejected; pre-release window justifies a clean unified v1.

_Design-related open questions are tracked in the [Open Questions](#open-questions) section below._

## Success Metrics

- Mode-comparison dogfood: the same real document run through all three modes produces converged artifacts whose audit trails a reviewer can follow end-to-end (NFR4), with the comparison documented.
- Deterministic verification: mocked-peer runs reproduce identical decisions across repeated executions.
- Full suite green: unit/integration matrix for both modes plus regression-locked alternating tests, structural validation, and mocked smoke flow.
- Escalation correctness: scripted scenarios show minimal agency never produces host-decided rounds and maximum agency reaches the user only on genuinely-stuck states.

## Requirement Index

| ID   | Description                                                        | Priority | Verification                                              | Planned Tasks         |
| ---- | ------------------------------------------------------------------ | -------- | --------------------------------------------------------- | --------------------- |
| FR1  | Parallel-revision mode with emergent convergence                   | P0       | unit + integration: same-round convergence, oscillation   | TBD - see plan.md     |
| FR2  | Parallel-synthesized mode with wrapper-driven synthesis            | P0       | unit + integration: synthesis records, stability converge | TBD - see plan.md     |
| FR3  | Mode selection, disclosure, call-count reporting                   | P0       | unit + integration: flag parsing, disclosure events       | TBD - see plan.md     |
| FR4  | Unified v1 schema family, v0 fail-closed                           | P0       | unit: schema validation, caps, version gate               | TBD - see plan.md     |
| FR5  | Agency-gated escalation ladder with orchestrator rounds            | P0       | unit + integration: triggers per agency, decision re-entry | TBD - see plan.md     |
| FR6  | Synthesizer default + override, identity recorded                  | P1       | unit: preflight resolution, record fields                 | TBD - see plan.md     |
| FR7  | Resume for new modes incl. synthesis-step interruption             | P0       | integration: resume matrix per mode/phase                 | TBD - see plan.md     |
| FR8  | Parallel-section orchestration with parallel modes                 | P1       | integration: packet metadata, fan-in ordering             | TBD - see plan.md     |
| FR9  | Alternating regression lock                                        | P0       | unit + integration: existing suite passes (v1 fixtures)   | TBD - see plan.md     |
| NFR1 | Deterministic engine                                               | P0       | integration: repeat-run reproducibility                   | TBD - see plan.md     |
| NFR2 | Node 22+, stdlib-only, Paseo boundary                              | P0       | unit: structural validation                               | TBD - see plan.md     |
| NFR3 | Verification coverage for both modes                               | P0       | unit + integration: full matrix green + smoke             | TBD - see plan.md     |
| NFR4 | Audit-trail legibility                                             | P0       | manual: mode-comparison artifact review                   | TBD - see plan.md     |
| NFR5 | Host-context discipline                                            | P1       | unit: event payload inventory                             | TBD - see plan.md     |

**Notes:**

- ID: Unique requirement identifier (FR# for functional, NFR# for non-functional)
- Description: Brief 1-sentence summary of the requirement
- Priority: P0 (must have) / P1 (should have) / P2 (nice to have)
- Verification: How this will be verified — format is `method: pointer`
- Planned Tasks: Filled in during planning phase to ensure traceability

## Open Questions

Carried from discovery for design:

- **Escalation triggers:** exact deterministic rules (thresholds for persistent unresolved disagreements, oscillation window per mode, interaction with max-rounds) per agency level.
- **Orchestrator-round mechanics:** record shape for host decisions, the resume vector carrying them back (analogue of the user-direction flag), and identity attribution; trust model mirrors the user-direction flow.
- **Cold-start parameterization:** whether engine-level independent-draft support lands now (unexposed by refine) or with the family skills that need it.
- **Synthesis prompt + caps:** synthesis prompt design (v3 sketch as the starting point) and byte-cap values for synthesis payloads.
- **JSONL vocabulary:** event shapes for mode disclosure, escalation requests/outcomes, and call-count reporting.
- **Round accounting:** confirm the mode-agnostic round definition for max-rounds and disclosure arithmetic.

## Assumptions

- Paseo's structured-output behavior (schema-append, JSON extraction, validation retry) is stable across the tested range.
- Claude Agent SDK usage bills as metered API spend (premise of the cost posture; per user, 2026-06-12).
- Two peers remain the deliberation arity; the synthesizer is a stateless third call, not a third deliberating voice.

## Risks

- **Mechanical synthesis quality:** a stateless (possibly cheap) synthesizer may produce weak merges.
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Mitigation:** Configurable synthesizer; peers critique the synthesis next round; escalation backstops persistent failure; dogfood before release claims.
- **Escalation chattiness:** triggers tuned too tight recreate the rejected per-round protocol.
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Mitigation:** Conservative defaults, tunable thresholds, dogfood on contentious documents.
- **Engine complexity growth:** three modes × agency × escalation × resume roughly triples behavioral surface.
  - **Likelihood:** High
  - **Impact:** Medium
  - **Mitigation:** Modularize mode logic in design; per-mode mocked test matrix; regression-lock alternating.
- **Parallel oscillation subtleties:** divergent-pair detection differs structurally from alternating hash flip-flop.
  - **Likelihood:** Medium
  - **Impact:** Low
  - **Mitigation:** Per-mode oscillation predicates defined in design; fixture tests for known shapes.

## References

- Discovery: `discovery.md`
- Knowledge Base: `.oat/repo/knowledge/project-index.md`
- Architecture v3: `.oat/repo/reference/research/consensus/architecture-v3.md`
- Decision record: `.oat/repo/reference/decision-record.md` (DR-001…DR-006)
- Backlog items: bl-5d49, bl-7af0 (this project); bl-ef38, bl-9ed4, bl-e39a (deferred)
