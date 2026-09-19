# Skills Repo Roadmap

**Last updated:** 2026-09-17
**Status:** Consensus Review is complete on its delivery branch; the first-party installer remains the confirmed immediate lane. Next/Later ordering remains a recommendation. See the [priority alignment](backlog/reviews/priority-alignment.md) and complete project map in the [full review](backlog/reviews/backlog-and-roadmap-review.md#complete-item-to-project-grouping).

## Planning model

The [current-state snapshot](current-state.md) records merged capability and explicitly labeled branch delivery; this page records direction, not delivery claims. Each active item appears below. The [full review](backlog/reviews/backlog-and-roadmap-review.md) explains value, effort, dependencies, and implementation evidence.

Completed source colocation, Session packaging, skill promotion, docs IA/visuals, typed configuration documentation, observer re-arm investigation, convergence model/effort propagation, remaining atomic writes, loop-free helper extraction, and Consensus Review are not future roadmap items. Keep historical release and completion evidence in [completed history](backlog/completed.md) and [RELEASING.md](../../../RELEASING.md).

## Now

### Confirmed onboarding lane

- **BL-260916-add-a-first-party-install — Add a first-party install command for standalone skills.** Pinned generated payloads, project-scope destinations, integrity/error handling, and install documentation. The user explicitly approved parallel kickoff; multi-host/live acceptance remains part of the scope. Owner/start are not yet claimed.

Release/discovery verification for already-merged distributions can proceed independently under the existing release checklist. This planning pass does not authorize installation, publication, or paid provider calls.

## Next

The following order is proposed, not yet operator-confirmed: inbox messaging, then session fidelity. Live-submit diagnosis is an independent authorization-gated slot.

### Consensus correctness

- **BL-260723-investigate-live-submit — Investigate live submit verdict-source contract mismatch.** Keep the diagnosis visible; live observation needs a separately approved bounded provider run. Rebase the September 7 plan to current source paths and effective policy before executing it.

### Provider-neutral collaboration and evidence

- **BL-260619-inter-agent-direct-messaging — Inter-agent direct messaging (addressable, prioritized).** Project/worktree recipient inboxes, exact runtime/session identity and aliases, IDs/acknowledgments/deduplication, and bounded continuation. Define concurrency and acknowledgment semantics; no daemon, harness-specific transport requirement, or second wake path.
- **BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter.** Separate design/build project using the retained research packet: detailed record locations, native call/result correlation, coverage states, privacy, and unchanged conversation defaults. It is not bundled into Review or messaging.

Messaging may precede fidelity. Coordinate shared observer/collaboration files and identity/state conventions, not an invented merged-log dependency.

### Session evidence and retrospectives

Follow-ups to session fidelity, filed 2026-09-19 from its design collaboration. The purpose is to review what an agent did, not only what it said; compact views stay the default and higher fidelity is pulled when a question needs evidence.

- **BL-260919-skill-attribution-in-session — Skill attribution in session activity events.** Smallest enabler for skill evaluation; may be absorbed into the fidelity activity layer.
- **BL-260919-session-retro-consume-activity — Session-retro: consume activity evidence.** First consumer: frozen evidence, observed/interpretation/change separation, coverage states passed through.
- **BL-260919-skill-evaluation-retro — Skill evaluation retro: activation, adherence, outcome, efficiency.** The primary application. Adherence and outcome stay separate findings.
- **BL-260919-uncapped-structured-activity — Uncapped structured activity export for cross-session analysis.** Keystone for anything across sessions; capped JSON and complete Markdown are not enough.
- **BL-260919-surface-terminally — Surface terminally unsuccessful peer turns as watch events.** and **BL-260919-collaboration-protocol-peer — Collaboration protocol: peer-initiated headless resume and provenance.** Protocol gaps observed during the fidelity collaboration.

## Later

Proposed after fidelity: the stateless merged view. Loop metrics and an evidence-gated similarity phase can share a later project; harmonization, research, and multi-round panel remain separate demand-led projects. N>2 ownership, idle integration, host-native dispatch, and 3+ peer convergence stay parked without a total rank.

### Merged evidence and stateful scale

- **BL-260619-shared-session-log-substrate — Stateless multi-session activity merge.** Depends on the session-fidelity activity contract. Deterministic provenance-preserving merge over exact pins; timestamps are ordering hints, not causal proof. No daemon/registration in v1 and no mutation of another consumer's offsets.
- **BL-260713-per-observer-offsets-and-safe — Per-observer offsets and safe N>2 collaboration mesh.** Separate design for consumer namespaces, ownership, locking/CAS, replay, and recovery. Neither inboxes nor a stateless view satisfy it.
- **BL-260713-optional-idle-session — Optional idle-session application integrations.** Evidence-gated, opt-in assistance outside the dependency-free core. Queued inbox content does not imply ability to wake an idle host.

### Evidence depth and cross-session retro

- **BL-260919-locate-and-pin-claude-code — Locate and pin Claude Code subagent transcripts.** Mirrors the Codex child-pin fix; unlocks subagent evaluation before the full sidecar merge.
- **BL-260919-delegation-and-subagent — Delegation and subagent evaluation in retros.** Depends on reviewable child transcripts.
- **BL-260919-retro-findings-ledger — Retro findings ledger with recurrence detection.** Accumulates conclusions, not transcripts; distinct from the stateless merge.
- **BL-260919-token-and-usage-accounting — Token and usage accounting for session activity.** Needed for cost and efficiency findings.
- **BL-260919-read-linked-session-sidecars — Read linked session sidecars in the activity view.** Opt-in, evidence-linked reads only.
- **BL-260919-reintroduce-deferred-activity — Reintroduce deferred activity correlation and provenance.** and **BL-260919-grouped-activity-summaries — Grouped activity summaries and derived enrichments adapted from cli-continues.** Deferred by the fidelity complexity review; each returns only with its stated evidence or recurring need.

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

Held from the 2026-09-19 session-evidence outline until the retro findings ledger has data: lightweight skill-version comparison, workflow telemetry (new-skill and heavy-skill detection, recurring failure modes), and model comparison within one runtime (cross-runtime comparison mostly measures what each runtime records). A watch emission filter for line-oriented consumers is also held; it overlaps inter-agent direct messaging.

Per-workflow defaults and activation of reserved roles are known config limitations, not hidden scope in the peer-model fix. Strict required submission, extra transcript providers, typed-test-fixture polish, and broader orchestration remain ideas unless separately captured. Do not turn historical notes or a diagram into implementation commitments.
