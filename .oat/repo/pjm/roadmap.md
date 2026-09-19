# Skills Repo Roadmap

**Last updated:** 2026-09-19
**Status:** Agent messaging is complete on its delivery branch; the first-party installer remains the confirmed immediate lane. Exact live-host messaging acceptance is separate active work. Next/Later ordering remains a recommendation. See the [priority alignment](backlog/reviews/priority-alignment.md) and complete project map in the [full review](backlog/reviews/backlog-and-roadmap-review.md#complete-item-to-project-grouping).

## Planning model

The [current-state snapshot](current-state.md) records merged capability and explicitly labeled branch delivery; this page records direction, not delivery claims. Each active item appears below. The [full review](backlog/reviews/backlog-and-roadmap-review.md) explains value, effort, dependencies, and implementation evidence.

Completed source colocation, Session packaging, skill promotion, docs IA/visuals, typed configuration documentation, observer re-arm investigation, convergence model/effort propagation, remaining atomic writes, loop-free helper extraction, Consensus Review, and agent messaging are not future roadmap items. Keep historical release and completion evidence in [completed history](backlog/completed.md) and [RELEASING.md](../../../RELEASING.md).

## Now

### Confirmed onboarding lane

- **BL-260916-add-a-first-party-install — Add a first-party install command for standalone skills.** Pinned generated payloads, project-scope destinations, integrity/error handling, and install documentation. The user explicitly approved parallel kickoff; multi-host/live acceptance remains part of the scope. Owner/start are not yet claimed.

Release/discovery verification for already-merged distributions can proceed independently under the existing release checklist. This planning pass does not authorize installation, publication, or paid provider calls.

## Next

The following order is proposed, not yet operator-confirmed. Session fidelity remains the next product lane after the completed inbox implementation. Live-submit diagnosis and live messaging acceptance are independent authorization-gated slots.

### Consensus correctness

- **BL-260723-investigate-live-submit — Investigate live submit verdict-source contract mismatch.** Keep the diagnosis visible; live observation needs a separately approved bounded provider run. Rebase the September 7 plan to current source paths and effective policy before executing it.

### Provider-neutral collaboration and evidence

- **BL-260919-verify-live-agent-messaging — Verify live agent-messaging host acceptance.** Separately authorize and preserve evidence for Codex prompt/Stop delivery, Claude prompt/Stop/watch delivery, and the finite Claude composed Monitor tier. Deterministic fixtures, generated payload parity, or one provider boundary do not prove another.
- **BL-260919-resolve-codex-self-identity — Resolve Codex self identity with duplicate rollout candidates.** Diagnose the exact-pin ambiguity found during collaboration without guessing from cwd or recency.
- **BL-260919-improve-default-observer — Improve default observer digest coverage and full-history recovery.** Make initial-catch-up omissions explicit and provide a bounded route to complete relevant history without folding this into messaging or opt-in activity fidelity.
- **BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter.** Separate design/build project using the retained research packet: detailed record locations, native call/result correlation, coverage states, privacy, and unchanged conversation defaults. It is not bundled into Review or messaging.

Coordinate the active observer/fidelity work with the shipped messaging identity and shared-state conventions, not an invented merged-log dependency. Exact live messaging acceptance does not authorize release or installation.

## Later

Proposed after fidelity: the stateless merged view. Loop metrics and an evidence-gated similarity phase can share a later project; harmonization, research, and multi-round panel remain separate demand-led projects. N>2 ownership, idle integration, host-native dispatch, and 3+ peer convergence stay parked without a total rank.

### Merged evidence and stateful scale

- **BL-260619-shared-session-log-substrate — Stateless multi-session activity merge.** Depends on the session-fidelity activity contract. Deterministic provenance-preserving merge over exact pins; timestamps are ordering hints, not causal proof. No daemon/registration in v1 and no mutation of another consumer's offsets.
- **BL-260713-per-observer-offsets-and-safe — Per-observer offsets and safe N>2 collaboration mesh.** Separate design for consumer namespaces, ownership, locking/CAS, replay, and recovery. Neither inboxes nor a stateless view satisfy it.
- **BL-260713-optional-idle-session — Optional idle-session application integrations.** Evidence-gated, opt-in assistance outside the dependency-free core. Queued inbox content does not imply ability to wake an idle host.

### Deliberation quality and research

- **BL-260612-add-consensus-research-skill — Add consensus-research skill (investigate question, synthesized findings).** Retain the tool-permission/evidence-provenance decision gate before build. Review is not this research workflow.
- **BL-260612-add-deliberation-metrics — Add deliberation metrics (tokens, wall-clock, rounds) to artifacts.** Inventory available provider signals, then resume-safe aggregation; unavailable is explicit, never invented cost.
- **BL-260612-add-similarity-heuristic — Add similarity heuristic for near-converged deliberation states.** Usage-gated measured scoring, not a rename of existing agency/double-ACCEPT behavior. Metrics-first is useful sequencing, not a hard dependency.
- **BL-260612-add-whole-document — Add whole-document harmonization pass after section convergence.** Design the context/default boundary and Refine fan-in/resume integration before implementation.
- **BL-260701-add-multi-round-panel — Add multi-round panel discussion.** Product distinction already decided: optional, attributed, non-converging. Build only with usage evidence that single-round breadth is inadequate.

These remain open, not abandoned. Moving them behind immediate workflow needs replaces the July research/loop-quality kickoff recommendation; it does not declare their acceptance criteria complete.

### Reserved capabilities

- **BL-260619-define-host-native-dispatch — Define host-native dispatch / safe-packet protocol (reserved seam).** Concrete demand and reviewed go/no-go first; the shipped capability remains false.
- **BL-260619-multi-peer-3-deliberation — Multi-peer (3+) deliberation extension (reserved / v3+ concern).** Panel breadth is not group convergence. Require evidence that two-peer convergence is insufficient.

## Uncommitted follow-up ideas

Per-workflow defaults and activation of reserved roles are known config limitations, not hidden scope in the peer-model fix. Strict required submission, extra transcript providers, typed-test-fixture polish, and broader orchestration remain ideas unless separately captured. Do not turn historical notes or a diagram into implementation commitments.
