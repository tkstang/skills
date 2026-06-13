---
oat_status: complete
oat_ready_for: oat-project-plan
oat_blockers: []
oat_last_updated: 2026-06-12
oat_generated: false
oat_template: false
---

# Design: consensus-iteration-modes

## Overview

This project extends the consensus deliberation engine from one iteration mode (alternating) to three, implementing the v3 architecture's parallel-revision and parallel-synthesized modes over the existing deterministic core. The confirmed approach is **two-tier synthesis**: routine per-round synthesis in parallel-synthesized mode is a wrapper-driven stateless Paseo call whose prompt the engine assembles from run state, while judgment-requiring states (persistent unresolved disagreements, oscillation, budget exhaustion) produce structured **escalations** routed by the agency setting to the user or the host model. Host decisions re-enter the run through a resume vector and are recorded as **orchestrator rounds**, distinct from user-intervention rounds.

The engine remains strictly deterministic: mode-specific round execution, convergence, oscillation, and escalation triggers are pure functions of recorded state; all model judgment lives in peer calls, the synthesizer call, and escalation responses. All deliberation records move to a unified **v1 schema family** (mode-aware verdict vocabularies, synthesis records, attributed intervention rounds); v0 artifacts are rejected fail-closed on resume with no migration, per the pre-release window decision.

The largest structural change is generalizing the engine's turn loop into a **round executor** abstraction: alternating executes one peer turn per round step, parallel modes execute two concurrent peer calls (plus a synthesis call in synthesized mode) per round. Everything downstream of round execution — records writer, status writer, artifact assembly, resume — consumes the same record stream and is extended rather than restructured.

## Architecture

### System Context

The change is confined to the consensus plugin: the loop engine (round execution, convergence, validation), the wrapper (CLI surface, JSONL events, artifact assembly, resume, parallel-section packets), the verdict schemas, the skill instructions (host-side escalation handling), and the section-runner contract. No repo-level scaffolding, shared libraries, or other skills are touched. Paseo remains the only external execution boundary (DR-002); host runtimes interact exclusively through the JSONL protocol and CLI flags (DR-003).

**Key Components:**

- **Round executors (engine):** per-mode round execution — `alternating` (one peer turn), `parallel_revision` (two concurrent peer calls), `parallel_synthesized` (two concurrent peer calls + one synthesizer call).
- **Convergence/oscillation predicates (engine):** per-mode pure functions over the record stream.
- **Escalation layer (engine + wrapper):** deterministic triggers → structured escalation status; wrapper emits `escalation_required` JSONL; decisions re-enter via resume flags as orchestrator/user rounds.
- **v1 record schema family:** verdict schemas (per-mode), synthesis records, intervention rounds, extended byte caps, version gate on resume.
- **Wrapper surface:** `--iteration`, `--synthesizer`, disclosure events, resolution-block call counts, packet metadata for parallel sections.
- **Host instruction set (SKILL.md + section-runner contract):** mode selection guidance, escalation handling per agency level, decision re-entry instructions.

### Component Diagram

```
refine SKILL.md (host model)
  │  invokes; reads JSONL; answers escalations (moderate/maximum)
  ▼
consensus-refine.mjs (wrapper)
  │  per section: options → runConsensusLoop()
  ▼
consensus-loop.mjs (engine)
  ├── roundExecutor(mode)                ── alternating | parallel_revision | parallel_synthesized
  │     ├── invokePeer ×1 or ×2 (concurrent)   → paseo run (peer schema v1)
  │     └── invokeSynthesizer ×0 or ×1         → paseo run (synthesis schema v1)
  ├── detectConvergence(mode) / detectOscillation(mode)
  ├── detectEscalation(mode, agency)     ── deterministic triggers
  └── records writer / loop status (v1)
  ▲
  │  --resume + --user-direction | --host-direction   (decision re-entry)
  └── escalation_required JSONL ──→ host (or user via host)
```

### Data Flow

Sequential flow per section, parallel-synthesized mode shown (other modes are subsets):

1. Wrapper parses sections, resolves mode/peers/synthesizer, emits `run_started` (now carrying mode + call-multiplier disclosure).
2. Engine round N: both peer prompts built from current shared artifact + prior records; **two concurrent** `paseo run` calls; verdicts validated (shape, caps, schema v1) and recorded in fixed peer order.
3. Synthesizer prompt built from goal + both revisions + both critiques + unresolved-disagreement history; one `paseo run`; synthesis record validated and recorded; synthesized text becomes round N+1's shared artifact.
4. Predicates run in order: convergence → oscillation → escalation triggers. Convergence/impasse terminate the section as today. An escalation trigger terminates the loop with a new `escalation` status carrying a structured decision packet.
5. Wrapper emits `escalation_required` with the packet. Host (per SKILL.md) either decides (moderate/maximum routing) and re-invokes `--resume --host-direction "<decision>"`, or surfaces to the user, whose answer re-enters via `--user-direction` as today.
6. Re-entry appends an attributed intervention round; the loop continues with budget-refresh semantics identical to today's user-intervention path.
7. Section terminal state → artifact assembly with v1 canonical blocks; resolution block gains mode, synthesizer identity, peer/synthesis call counts.

## Component Design

### 1. Round executor abstraction (engine)

**Purpose:** Generalize the single hard-coded turn loop into per-mode round execution while keeping one record stream.

**Responsibilities:**

- `alternating`: current behavior — one peer turn per loop step (regression-locked, FR9).
- `parallel_revision`: per round, build both peer prompts from the same input state, run both `invokePeer` calls concurrently, validate both, append both records in fixed peer order (deterministic record order regardless of completion order).
- `parallel_synthesized`: parallel-revision execution plus `invokeSynthesizer`; synthesis output becomes next round's shared artifact.

**Interfaces:**

```js
// engine-internal; invokePeer/invokeSynthesizer injectable (runOptions) as today
executeRound({ mode, roundIndex, state, options, invokePeer, invokeSynthesizer })
  → { records: TurnRecord[], synthesis?: SynthesisRecord, nextArtifact: string }
```

**Dependencies:** existing `invokePaseo`, records writer, validators.

**Design Decisions:**

- Fixed peer-order record append (not completion order) keeps mocked runs byte-reproducible (NFR1) and resume deterministic.
- Concurrency is per-round only (two in-flight peer calls); rounds remain strictly sequential, matching deliberation semantics.
- **Two-level transaction contract for parallel rounds:**
  - **Peer subround atomicity:** the two peer records of a parallel round commit together or not at all. A failed peer call discards the surviving peer's response; the section errors with metadata naming the failed call. No half-pairs in the stream.
  - **Synthesis is a separate required record** (synthesized mode): it commits independently after the peer pair. A complete peer pair without a following synthesis record is the deterministic **pending-synthesis** state — resume re-executes only the synthesis step. An invalid or oversized synthesis writes a metadata-only synthesis-error record and terminates the section as `error`.

### 2. Per-mode prompts (engine)

**Purpose:** Extend the turn-prompt builder to the parallel vocabularies and add the synthesis prompt builder.

**Responsibilities:**

- Parallel peer prompt: same SECTION untrusted-content framing; adds the peer's own previous revision, the other peer's previous revision, and both prior critiques; instructs the mode-specific verdict vocabulary (REVISE / ACCEPT_PEER / CONVERGED / IMPASSE) and critique fields.
- Synthesis prompt: v3 sketch as base — goal, both revisions, both critiques, prior unresolved disagreements; "where critiques agree, treat as established; where they disagree, prefer the change supported by stronger reasoning"; outputs `synthesized_artifact`, `synthesis_reasoning`, `unresolved_disagreements`. Same SECTION framing for untrusted content.

**Design Decisions:**

- Round-1 cold start in parallel modes uses `shared_input` (both peers see the input artifact; "previous revision: none"). The engine takes cold-start as a parameter with only `shared_input` implemented; `independent_draft` is rejected at parse time with a clear "not yet supported" error — the seam exists for the family-skills project without speculative implementation here.

### 3. v1 verdict + synthesis validation (engine)

**Purpose:** Mode-aware structural validation and byte caps for the new payloads.

**Responsibilities:**

- New JSON schema files per payload type: alternating verdict v1 (v0 shape + version bump), parallel verdict (adds `critique.own_previous`, `critique.peer_previous`, extended verdict enum), synthesis response (`synthesized_artifact`, `synthesis_reasoning`, `unresolved_disagreements[]`).
- Shape validation gains mode-aware branch tables; cap validation extends: critique fields capped like reasoning (16 KB each); `synthesized_artifact` capped like `proposed_artifact` (256 KB); `synthesis_reasoning` 16 KB; each unresolved disagreement 4 KB, max 20; total 512 KB per payload.
- Oversize/invalid synthesis aborts the section as `error` with metadata-only records (FR2), identical policy to peer verdicts.

**Design Decisions:**

- `LOOP_SCHEMA_VERSION` bumps to `v1`; every record, status, and canonical block carries it. Resume reads the version first and fails closed on `v0` with a message naming the mismatch and the no-migration policy (FR4).

### 4. Per-mode convergence and oscillation predicates (engine)

**Purpose:** Deterministic termination rules per mode.

**Responsibilities (pure functions over the record stream):**

- `alternating`: unchanged (consecutive-record hash match; double-ACCEPT same-hash; maximum-agency near-match double-ACCEPT).
- `parallel_revision` convergence: the two same-round peer revisions hash-match (normalized per agency); or mutual `ACCEPT_PEER` adopting the same prior text (mutual adoption of *differing* texts is a swap, not convergence — treated as ordinary revision outcome); or mutual `CONVERGED` at moderate/maximum agency (at minimal, mutual CONVERGED without hash match escalates via `near_done_drift`).
- `parallel_synthesized` convergence: both same-round peer revisions hash-match the previous round's synthesis hash (synthesis stability).
- Parallel oscillation: the order-normalized per-round hash *pair* repeats alternately — pair(N) == pair(N-2) ≠ pair(N-1) over a 4-round window; synthesized-mode variant additionally checks synthesis hashes for A/B/A/B cycling.
- Round budget: `--max-rounds` counts rounds (mode-agnostic, v3 definition); turn budget = rounds × calls-per-round inside the executor.

**Design Decisions:**

- All predicates take `(records, mode, agencyOptions)` and are exported for direct unit testing, mirroring the existing `detectConvergence`/`detectOscillation` seam.

### 5. Escalation layer (engine + wrapper)

**Purpose:** Deterministic triggers producing structured, agency-routed decision requests; re-entry as attributed intervention rounds.

**Trigger rules (deterministic):**

- `persistent_disagreement` (synthesized only): the same normalized unresolved-disagreement set non-empty across 3 consecutive synthesis records (set equality on trimmed strings).
- `oscillation`: per-mode oscillation predicate fires.
- `budget_exhausted`: max-rounds reached without convergence.
- `near_done_drift`: double-ACCEPT (alternating) / mutual-CONVERGED (parallel) with non-matching hashes.

**Routing (agency × trigger → decision-maker):**

| Trigger | minimal | moderate | maximum |
| --- | --- | --- | --- |
| persistent_disagreement | user | host | host |
| oscillation | user | user | host |
| budget_exhausted | user | user | host (declare-done policy, recorded as auto-resolved escalation) |
| near_done_drift | user | host | auto (existing near-match rule) |

Host-routed cells are subject to genuinely-stuck promotion (see Mechanics): repeat-fire after a host decision, or an explicit host `defer_to_user`, re-routes to the user.

**Mechanics:**

- Engine returns a terminal `escalation` status containing a **decision packet**: trigger, divergent state references, round/turn indexes, allowed decision kinds (`pick_a`, `pick_b`, `blend`, `direct`, `accept_impasse`, `extend_budget`, and — for host-routed escalations — `defer_to_user`), and `decide_via`.
- **Genuinely-stuck promotion (host-routed escalations):** a host-routed escalation promotes to `decide_via: user` when either (a) the same trigger re-fires on the same section after a `HOST_DECISION` round already answered it — repeat-fire: host judgment demonstrably failed to unstick the loop — or (b) the host explicitly declines with `decision_kind: 'defer_to_user'`, which re-emits the escalation routed to the user. Both conditions are pure functions of the record stream (presence of a prior `HOST_DECISION` for the trigger; the decline round itself). Promoted escalations carry `promoted_from: 'host'`. This satisfies FR5's "maximum reaches the user only on genuinely-stuck states": the stuck definition is *a host decision was tried (or declined) and the trigger persists*. The maximum-agency `budget_exhausted` auto-declare cell is exempt — it terminates rather than loops, preserving regression-locked v0.1 behavior.
- Wrapper emits `escalation_required` JSONL with full divergent text resolved into the event (the only content-bearing routine event — NFR5 boundary).
- Re-entry: `--resume <artifact> --host-direction "<text>"` (new) or `--user-direction "<text>"` (existing). Both append an intervention round (`agent: 'host-orchestrator'` or `'user'`) and refresh the round budget exactly like today's user-intervention path. `--host-direction` is rejected when the pending escalation's `decide_via` is `user` (fail-closed routing).
- Trust model: identical to `--user-direction` — the wrapper trusts its invoker; attribution is recorded, not authenticated.

**Design Decisions:**

- Escalation is a *terminal loop status + resume*, not an interactive pause: the wrapper exits after emitting `escalation_required`. This reuses the entire existing resume machinery (DR-005) and keeps headless behavior well-defined (an unattended run ends at the escalation, like impasse today).
- Sequential multi-section runs end at an escalated section (later sections unprocessed), mirroring interruption semantics; `--fail-on-section-error` semantics unchanged. In parallel-section runs, a section runner's escalation is recorded in its section result and surfaced at fan-in (FR8) without blocking other sections.
- Today's `oscillation` and `max-rounds` terminal statuses are preserved at minimal agency (surface-and-stop is just "escalate to user"); the escalation layer subsumes them as the `user`-routed rows of the table, so v0.1 behavior is the minimal-agency column.

### 6. Wrapper surface (CLI + JSONL + artifact)

**Purpose:** Mode/synthesizer selection, disclosure, reporting, resume vectors.

**Responsibilities:**

- Flags: `--iteration alternating|parallel_revision|parallel_synthesized` (default alternating); `--synthesizer <provider-id>` (default first peer; validated against the provider inventory like peers; warn-and-ignore outside synthesized mode); `--host-direction <text>` (resume-only; mutually exclusive with `--user-direction`).
- `run_started` gains `iteration_mode`, `synthesizer`, `calls_per_round: { peer, synthesis }`; new `escalation_required` event; `run_completed` gains `peer_calls`, `synthesis_calls`, `sections_escalated`.
- Resolution block + artifact frontmatter gain `iteration`, `synthesizer`, `peer_calls`, `synthesis_calls`; per-section canonical blocks carry v1 records including synthesis and intervention rounds.
- Parallel-section packets carry `iteration_mode` + `synthesizer`; fan-in aggregates the new `escalation` status alongside `impasse`.

**Design Decisions:**

- Disclosure rides `run_started` rather than a separate event — hosts already parse it, and the multiplier is static per run.

### 7. Host instruction set (SKILL.md + section-runner contract)

**Purpose:** Teach host models the new surface.

**Responsibilities:**

- Mode selection guidance (when each mode is worth its cost; alternating default) and cost-disclosure relay.
- Escalation handling: parse `escalation_required`, branch on `decide_via` — `user`: present options (existing impasse UX); `host`: decide using conversation context, re-invoke with `--host-direction`, and disclose the decision to the user in conversation.
- Section-runner contract: runners pass mode/synthesizer through from packets and report escalations in section results instead of deciding them.

**Design Decisions:**

- Section runners never self-decide escalations — a runner is a dispatch convenience, not a judgment delegate; centralizing decisions at the top-level host keeps attribution and user disclosure coherent.

## Data Models

### v1 Turn Record (peer)

```js
{
  schema_version: 'v1',
  turn_index, round_index, agent,            // as today
  iteration_mode,                            // one of three
  verdict,                                   // alternating: ACCEPT|REVISE|IMPASSE
                                             // parallel:    REVISE|ACCEPT_PEER|CONVERGED|IMPASSE
  reasoning,
  critique?: { own_previous, peer_previous },// parallel modes only
  proposed_artifact?, concerns?,
  artifact_hash,
  raw_paseo_response, timestamp
}
```

### v1 Synthesis Record

```js
{
  schema_version: 'v1',
  record_type: 'synthesis',
  round_index, synthesizer,                  // provider id
  synthesized_artifact, synthesis_reasoning,
  unresolved_disagreements: string[],
  artifact_hash,                             // hash of synthesized_artifact
  raw_paseo_response, timestamp
}
```

### v1 Intervention Round (user or host)

```js
{
  schema_version: 'v1',
  turn_index, round_index,
  agent: 'user' | 'host-orchestrator',
  verdict: 'USER_INTERVENTION' | 'HOST_DECISION',
  decision_kind: 'pick_a'|'pick_b'|'blend'|'direct'|'accept_impasse'|'extend_budget'|'defer_to_user',
  reasoning,                                 // the direction/decision text
  escalation_trigger,                        // which trigger this answers
  artifact_hash, iteration_mode, timestamp
}
```

### v1 Loop Status (escalation terminal state)

```js
{
  status: 'converged'|'impasse'|'max-rounds'|'oscillation'|'escalation'|'error',
  termination_reason,
  escalation?: {                             // when status === 'escalation'
    trigger, decide_via: 'user'|'host',
    decision_kinds: string[],
    divergent: { a: {agent, artifact_hash}, b: {agent, artifact_hash},
                 synthesis?: {artifact_hash, unresolved_disagreements} }
  },
  turns, rounds, agency, iteration_mode, synthesizer?,
  peer_calls, synthesis_calls,
  final_artifact_hash                        // + cost fields as today
}
```

**Considerations:** Field naming follows existing snake_case conventions. `record_type` discriminates synthesis records inside the single records array so the write-through writer, resume parser, and artifact renderer share one stream. Escalation packets in the status file reference divergent content by hash/index; the wrapper resolves full text only into the `escalation_required` event (the artifact already contains the content; NFR5's boundary is the event vocabulary).

## API Design

CLI flags and JSONL events are the plugin's API surface.

**CLI additions:**

- `--iteration <mode>` — parse-time validation; invalid values exit USAGE naming the allowed list.
- `--synthesizer <id>` — preflight-validated against the provider inventory; meaningful only with `parallel_synthesized` (warn-and-ignore otherwise).
- `--host-direction <text>` — resume-only; mutually exclusive with `--user-direction`; rejected when no escalation is pending or when the pending escalation routes to `user`.

**JSONL events:**

- `run_started` — adds `iteration_mode`, `synthesizer`, `calls_per_round: { peer, synthesis }`.
- `escalation_required` — `{ section_id, trigger, decide_via, promoted_from?, decision_kinds, divergent: { a: {agent, text}, b: {agent, text}, synthesis?: { text, unresolved_disagreements } }, resume: { artifact_path, flag } }`; `promoted_from: 'host'` marks genuinely-stuck promotions.
- `run_completed` — adds `peer_calls`, `synthesis_calls`, `sections_escalated`.

**Error handling:** new codes `INVALID_ITERATION_MODE`, `SYNTHESIZER_UNAVAILABLE`, `INVALID_SYNTHESIS_SHAPE`, `INVALID_SYNTHESIS_CAPS`, `ESCALATION_ROUTING`, `SCHEMA_VERSION_MISMATCH` — all mapped onto the existing exit-code table (USAGE/DATA/CONFIG).

**Authorization:** unchanged — filesystem confinement and invoker trust; `--host-direction` introduces no new privilege class (same trust as `--user-direction`).

## Security Considerations

- **Untrusted-content framing extends to synthesis:** peer revisions entering the synthesis prompt are wrapped in the same SECTION-style framing — peer output derives from untrusted input and must not steer the synthesizer's protocol.
- **Escalation decision injection:** `--host-direction` text is recorded verbatim and fed into subsequent prompts exactly like `--user-direction` — same injection surface, same mitigations (framing + schema enforcement on subsequent verdicts). Routing enforcement is a policy guard, not a security boundary.
- **Byte caps on all new payloads** (critiques, synthesis fields) bound runaway outputs; oversize handling records metadata only.
- **Path confinement unchanged**; no new write domains (escalation state lives in the existing status file + stdout).

## Performance Considerations

- Parallel modes run their two peer calls concurrently, so per-round wall-clock roughly matches alternating while metered spend doubles (triples with synthesis); the cost levers are disclosure (FR3), the configurable synthesizer (FR6), and agency-tuned escalation — hard caps deferred to bl-9ed4.
- Two concurrent `paseo run` subprocesses per round is the concurrency ceiling; no pooling/backpressure machinery warranted (existing subprocess output caps bound memory).
- Record streams grow 2–3x per round in parallel modes; write-through append and existing input caps remain adequate (bounded by round budget × byte caps).

## Error Handling

- **Peer subround atomicity:** a failed peer call in a parallel round commits no peer records (the surviving peer's response is discarded); the section errors with details naming the failed call.
- **Synthesis failures:** synthesis is a separate record after the committed peer pair. A synthesis *process* failure (spawn/exit error) leaves the pair durable and the section resumable at pending-synthesis; an *invalid or oversized* synthesis (after Paseo's schema-retry is exhausted) writes a metadata-only synthesis-error record and terminates the section as `error` — identical cap policy to peer verdicts.
- **Escalation lifecycle errors:** wrong direction flag for the pending escalation, direction with no pending escalation, or v0 artifact resume → fail-closed CONFIG/DATA errors with explicit messages.
- **Interruption:** SIGINT mid-peer-subround re-executes the whole subround on resume (no committed pair). Interruption after the pair but before synthesis resumes at the synthesis step — pending-synthesis state is derivable, not separately stored: the last round has two peer records and no synthesis record.
- **Logging:** JSONL coordination, stderr diagnostics, `CONSENSUS_LOG` levels — unchanged.

## Testing Strategy

### Requirement-to-Test Mapping

| ID | Verification | Key Scenarios |
| --- | --- | --- |
| FR1 | unit + integration | same-round hash convergence; mutual ACCEPT_PEER (same vs differing adopted text); mutual CONVERGED per agency; divergent-pair oscillation; fixed record order under stubbed out-of-order completion |
| FR2 | unit + integration | synthesis record validation; stability convergence; unresolved-disagreement persistence feeding FR5; synthesis process failure leaves resumable pending-synthesis; invalid/oversize synthesis terminates section with metadata-only record |
| FR3 | unit + integration | flag parsing/validation; run_started disclosure fields; resolution call counts per mode |
| FR4 | unit | v1 schema validation per payload; cap matrix incl. critique/synthesis fields; v0 resume rejection message |
| FR5 | unit + integration | trigger×agency routing truth table; escalation packet content; --host-direction re-entry appends HOST_DECISION round; routing rejection; budget refresh on re-entry; genuinely-stuck promotion (repeat-fire after HOST_DECISION; explicit defer_to_user decline) |
| FR6 | unit | synthesizer default resolution; preflight inventory validation; identity in records/resolution |
| FR7 | integration | resume matrix: each mode × interruption point (mid-peer-subround re-executes pair, pending-synthesis resumes at synthesis, post-synthesis, pending escalation); corrupt-section fail-closed unchanged |
| FR8 | integration | packet metadata round-trip; fan-in ordering with parallel-mode sections; escalated section surfaces at fan-in |
| FR9 | unit + integration | existing alternating suite green with v1-fixture-only updates; artifact diff limited to schema fields |
| NFR1 | integration | repeated mocked runs byte-identical modulo timestamps/run-id |
| NFR2 | unit | structural validation; no new dependencies |
| NFR3 | unit + integration | full matrix green; smoke extended with a parallel-mode mocked flow |
| NFR4 | manual | mode-comparison dogfood artifact review (same document, three modes) |
| NFR5 | unit | event payload inventory: routine events carry no revision text; escalation_required is the only content-bearing event |

### Test Levels

- **Unit:** predicates (convergence/oscillation/triggers per mode × agency), validators (shape/caps per payload), prompt builders, flag parsing, synthesizer resolution — all exported pure-function seams as today.
- **Integration:** `runConsensusLoop` with stubbed `invokePeer`/`invokeSynthesizer` scripting multi-round scenarios per mode; wrapper-level runs with the paseo-stub covering JSONL events, artifact assembly, resume, prepare/fan-in.
- **Smoke:** extend the mocked end-to-end flow with one parallel-synthesized run including an escalation and `--host-direction` resume.

## Deployment Strategy

No build step; files ship as-is in the plugin. Version bump follows the existing manifest + tag flow; CHANGELOG gains v0.2 mode entries. Paseo prerequisite and tested range unchanged. Release claims remain gated by RELEASING.md (independent item bl-d85f).

## Migration Plan

No data migration. v0 artifacts are not upgraded: resume fails closed with a schema-version message (FR4); documentation states in-flight v0 runs should be completed under v0.1 or restarted. Rollback is ordinary git revert — no persistent state outside run directories and artifacts.

## Implementation Phases

Each phase ends with the full suite green.

**Phase 1 — v1 schema family + validation substrate.** New schema files (alternating v1, parallel verdict, synthesis), mode-aware shape/cap validators, version bump, v0 resume rejection, alternating fixture updates (FR4, FR9 groundwork). *Verification:* validator unit matrix; alternating suite green on v1.

**Phase 2 — round executor + parallel-revision mode.** Executor abstraction, concurrent peer calls with atomic round commit, parallel prompts, parallel-revision convergence/oscillation predicates, `--iteration` + disclosure + call counts (FR1, FR3, NFR1). *Verification:* parallel-revision integration scenarios; reproducibility test.

**Phase 3 — parallel-synthesized mode.** Synthesis prompt builder, `invokeSynthesizer` seam, synthesis records, stability convergence, `--synthesizer` default/override (FR2, FR6). *Verification:* synthesized integration scenarios incl. oversize-synthesis abort.

**Phase 4 — escalation ladder.** Trigger predicates, routing table, `escalation` terminal status + packet, `escalation_required` event, `--host-direction` re-entry + HOST_DECISION rounds, routing rejection, budget refresh (FR5). *Verification:* trigger×agency truth-table tests; escalation resume integration.

**Phase 5 — resume + parallel-section composition.** Resume matrix for new modes and interruption points; packet metadata + fan-in aggregation for parallel-mode sections (FR7, FR8). *Verification:* resume-matrix integration tests; fan-in scenarios.

**Phase 6 — host surface + docs + dogfood.** SKILL.md escalation/mode guidance, section-runner contract update, plugin/repo README updates, smoke extension, mode-comparison dogfood run and artifact review (FR3 docs, NFR4). *Verification:* docs-presence tests; smoke green; dogfood artifacts reviewed.

## Risks and Mitigation

- **Engine complexity (High probability / Medium impact):** executor abstraction + per-mode predicate modules keep mode logic separated; alternating path regression-locked in Phase 1 so later phases cannot silently drift it.
- **Escalation chattiness (Medium/Medium):** conservative trigger constants (3-round disagreement persistence; existing 4-window oscillation) as named constants; the dogfood phase explicitly evaluates escalation frequency before defaults freeze. *Contingency:* thresholds become flags.
- **Mechanical synthesis quality (Medium/Medium):** peers critique the synthesis next round by construction; the persistent-disagreement trigger backstops; synthesizer configurable. *Contingency:* deferred host-mediated synthesis slots in without schema changes (synthesizer identity already recorded).
- **Parallel oscillation predicate wrong-shape (Medium/Low):** pair-based predicate unit-tested against constructed fixtures before integration; minimal-agency surface-and-stop is the safe behavior if a predicate misfires.
- **Resume-state explosion (Medium/Medium):** the interruption-point matrix is enumerated in Phase 5 tests; explicit synthesis records make pending-synthesis state derivable rather than separately stored.

## References

- `spec.md` (FR/NFR definitions), `discovery.md` (decision dialogue)
- Engine: `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`; wrapper: `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`
- `.oat/repo/reference/research/consensus/architecture-v3.md` (mode semantics, verdict vocabularies, synthesis prompt sketch)
- DR-002…DR-006 in `.oat/repo/reference/decision-record.md`
