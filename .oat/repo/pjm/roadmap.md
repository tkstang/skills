# Skills Repo Roadmap

**Last updated:** 2026-09-20
**Status:** Session Fidelity (PR #96) and Agent Messaging (PR #98) are merged. The installer implementation (PR #90) is also merged; its live host acceptance remains open. The September 20 [full review](backlog/reviews/backlog-and-roadmap-review.md) proposes a consumer-first evidence/retro sequence and a reliability/acceptance lane. The current [alignment](backlog/reviews/priority-alignment.md) approves one six-ticket session-evidence wave plus a bounded Consensus Review timeout increase; remaining recommendations are unselected.

## Planning model

The [current-state snapshot](current-state.md) records merged capability and verification boundaries; this page records direction, not delivery claims. Each active item appears below. The [full review](backlog/reviews/backlog-and-roadmap-review.md) explains value, effort, dependencies, and implementation evidence.

Completed source colocation, Session packaging, skill promotion, docs IA/visuals, typed configuration documentation, observer re-arm investigation, convergence model/effort propagation, remaining atomic writes, loop-free helper extraction, Consensus Review, Session Fidelity, and Agent Messaging are not future roadmap items. Keep historical release and completion evidence in [completed history](backlog/completed.md) and [RELEASING.md](../../../RELEASING.md).

## Now

### Approved session-evidence wave

The `session-evidence-followups` project owns watcher SIGTERM stability, unsuccessful terminal events, skill attribution, usage accounting, complete structured activity export and the activity-backed retro consumer. A user-requested review timeout increase executes first. One plan, sequential product phases with parallel read-only recon, and one PR. Full criteria and independent reviews are required before closeout.

### Finishing onboarding acceptance

- **BL-260916-add-a-first-party-install — Add a first-party install command for standalone skills.** Implementation and deterministic checks merged in PR #90. Remaining work is a suitable pinned payload tag and live install, discovery, invocation and permission checks for Codex, Claude Code and Cursor at project and user scope. Keep the item active until those acceptance criteria pass.

Release/discovery verification for already-merged distributions can proceed independently under the existing release checklist. This planning pass does not authorize installation, publication, or paid provider calls.

## Next

Outside the approved wave above, the following order remains proposed rather than operator-confirmed. Selected ticket descriptions below are retained for thematic context; their execution order is owned by the current alignment and project plan. Session Fidelity and inbox implementation are now merged; the next product investment can use their shipped contracts. Live-submit diagnosis and live messaging acceptance are independent authorization-gated slots.

### Consensus correctness

- **BL-260723-investigate-live-submit — Investigate live submit verdict-source contract mismatch.** Keep the diagnosis visible; live observation needs a separately approved bounded provider run. Rebase the September 7 plan to current source paths and effective policy before executing it.

### Provider-neutral collaboration and evidence

- **BL-260919-verify-live-agent-messaging — Verify live agent-messaging host acceptance.** Separately authorize and preserve evidence for Codex prompt/Stop delivery, Claude prompt/Stop/watch delivery, and the finite Claude composed Monitor tier. Deterministic fixtures, generated payload parity, or one provider boundary do not prove another.
- **BL-260919-resolve-codex-self-identity — Resolve Codex self identity with duplicate rollout candidates.** Diagnose the exact-pin ambiguity found during collaboration without guessing from cwd or recency.
- **BL-260919-improve-default-observer — Improve default observer digest coverage and full-history recovery.** Make initial-catch-up omissions explicit and provide a bounded route to complete relevant history without folding this into messaging or opt-in activity fidelity.
- **BL-260919-stabilize-the-watcher-sigterm — Stabilize the watcher SIGTERM re-arm test.** Reproduce and isolate the timing-dependent shutdown case on merged main now that the session-fidelity stack has landed; fix the product path or the fixture according to the evidence.

Coordinate observer follow-ups with the shipped messaging identity and shared-state conventions, not an invented merged-log dependency. Exact live messaging acceptance does not authorize release or installation.

### Session evidence and retrospectives

Follow-ups to session fidelity, filed 2026-09-19 from its design collaboration. The purpose is to review what an agent did, not only what it said; compact views stay the default and higher fidelity is pulled when a question needs evidence.

- **BL-260919-skill-attribution-in-session — Skill attribution in session activity events.** An enabler for skill evaluation; extend the merged activity layer with native/inferred attribution and honest version limits.
- **BL-260919-session-retro-consume-activity — Session-retro: consume activity evidence.** First consumer: frozen evidence, observed/interpretation/change separation, coverage states passed through.
- **BL-260919-skill-evaluation-retro — Skill evaluation retro: activation, adherence, outcome, efficiency.** The primary application. Adherence and outcome stay separate findings.
- **BL-260919-uncapped-structured-activity — Uncapped structured activity export for cross-session analysis.** Keystone for anything across sessions; capped JSON and complete Markdown are not enough.
- **BL-260919-surface-terminally — Surface terminally unsuccessful peer turns as watch events.** and **BL-260919-collaboration-protocol-peer — Collaboration protocol: peer-initiated headless resume and provenance.** Protocol gaps observed during the fidelity collaboration.

## Later

Fidelity is merged, so its prerequisite for the stateless merged view is satisfied. The review recommends useful retro consumers before that larger view. Loop metrics and an evidence-gated similarity phase can share a later project; harmonization, research, and multi-round panel remain separate demand-led projects. N>2 ownership, idle integration, host-native dispatch, and 3+ peer convergence stay parked without a total rank.

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
