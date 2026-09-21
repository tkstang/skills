# Skills Repo Roadmap

**Last updated:** 2026-09-20
**Status:** PRs #100 and #101 are merged on `origin/main` at `4150cfe2`. The six-ticket session-evidence wave is accepted and closed in PR #99, which still awaits merge. Installer and messaging live acceptance remain open; no next product wave is selected.

## Planning model

The [current-state snapshot](current-state.md) records merged capability, accepted branch delivery and verification boundaries separately. This page records direction, not delivery claims. Each active item appears below. The September 20 [full review](backlog/reviews/backlog-and-roadmap-review.md) remains the historical rating/dependency analysis, while the [priority alignment](backlog/reviews/priority-alignment.md) records the completed selected batch and the absence of a newly approved wave.

The completed PR #99 wave is retained through its archived records: [watcher SIGTERM stability](backlog/archived/BL-260919-stabilize-the-watcher-sigterm.md), [unsuccessful terminal events](backlog/archived/BL-260919-surface-terminally.md), [skill attribution](backlog/archived/BL-260919-skill-attribution-in-session.md), [usage accounting](backlog/archived/BL-260919-token-and-usage-accounting.md), [complete structured activity export](backlog/archived/BL-260919-uncapped-structured-activity.md), and [activity-backed Session Retro](backlog/archived/BL-260919-session-retro-consume-activity.md). They are not future roadmap work. PR #99 remains unmerged, so their implementation is not yet a main-branch capability.

## Now

### Finishing onboarding acceptance

- **BL-260916-add-a-first-party-install — Add a first-party install command for standalone skills.** Implementation and deterministic checks merged in PR #90. PR #100 corrected and live-checked two Cursor documentation claims, but the remaining acceptance still requires a suitable pinned payload tag plus live install, discovery, invocation and permission checks for Codex, Claude Code and Cursor at project and user scope.

Release/discovery verification for already-merged distributions can proceed independently under the existing release checklist. This planning state does not authorize installation, publication, merge, or paid provider calls.

## Next

The following order remains proposed rather than operator-confirmed. Session Fidelity, Agent Messaging and the accepted PR #99 evidence wave provide contracts these items may use after merge. Live-submit diagnosis and live messaging acceptance remain independent authorization-gated slots.

### Consensus correctness

- **BL-260723-investigate-live-submit — Investigate live submit verdict-source contract mismatch.** Keep the diagnosis visible; live observation needs a separately approved bounded provider run. Rebase the September 7 plan to current source paths and effective policy before executing it.

### Provider-neutral collaboration and evidence

- **BL-260919-verify-live-agent-messaging — Verify live agent-messaging host acceptance.** Separately authorize and preserve evidence for Codex prompt/Stop delivery, Claude prompt/Stop/watch delivery, and the finite Claude composed Monitor tier. Deterministic fixtures, generated payload parity, or one provider boundary do not prove another.
- **BL-260919-resolve-codex-self-identity — Resolve Codex self identity with duplicate rollout candidates.** Diagnose the exact-pin ambiguity found during collaboration without guessing from cwd or recency.
- **BL-260919-improve-default-observer — Improve default observer digest coverage and full-history recovery.** Make initial-catch-up omissions explicit and provide a bounded route to complete relevant history without folding this into messaging or opt-in activity fidelity.

Coordinate observer follow-ups with the shipped messaging identity and shared-state conventions, not an invented merged-log dependency. Exact live messaging acceptance does not authorize release or installation.

### Session evidence and retrospectives

The first PR #99 producer/consumer slice is complete on its branch. The remaining follow-ups stay in their prior proposed order:

- **BL-260919-skill-evaluation-retro — Skill evaluation retro: activation, adherence, outcome, efficiency.** The primary next application after PR #99 merges. Keep adherence and outcome as separate findings.
- **BL-260919-collaboration-protocol-peer — Collaboration protocol: peer-initiated headless resume and provenance.** A distinct protocol gap; do not infer host wake support from terminal-event visibility or inbox delivery.

## Later

The review still recommends useful retro consumers before a larger merged view. Loop metrics and an evidence-gated similarity phase can share a later project; harmonization, research and multi-round panel remain separate demand-led projects. N>2 ownership, idle integration, host-native dispatch and 3+ peer convergence stay parked without a total rank.

### Merged evidence and stateful scale

- **BL-260619-shared-session-log-substrate — Stateless multi-session activity merge.** Deterministic provenance-preserving merge over exact pins; timestamps are ordering hints, not causal proof. No daemon/registration in v1 and no mutation of another consumer's offsets.
- **BL-260713-per-observer-offsets-and-safe — Per-observer offsets and safe N>2 collaboration mesh.** Separate design for consumer namespaces, ownership, locking/CAS, replay and recovery. Neither inboxes nor a stateless view satisfy it.
- **BL-260713-optional-idle-session — Optional idle-session application integrations.** Evidence-gated, opt-in assistance outside the dependency-free core. Queued inbox content does not imply ability to wake an idle host.

### Evidence depth and cross-session retro

- **BL-260919-locate-and-pin-claude-code — Locate and pin Claude Code subagent transcripts.** Mirrors the Codex child-pin fix; unlocks subagent evaluation before the full sidecar merge.
- **BL-260919-delegation-and-subagent — Delegation and subagent evaluation in retros.** Depends on reviewable child transcripts.
- **BL-260919-retro-findings-ledger — Retro findings ledger with recurrence detection.** Accumulates conclusions, not transcripts; distinct from the stateless merge.
- **BL-260919-read-linked-session-sidecars — Read linked session sidecars in the activity view.** Opt-in, evidence-linked reads only.
- **BL-260919-reintroduce-deferred-activity — Reintroduce deferred activity correlation and provenance.** and **BL-260919-grouped-activity-summaries — Grouped activity summaries and derived enrichments adapted from cli-continues.** Deferred by the fidelity complexity review; each returns only with its stated evidence or recurring need.

### Deliberation quality and research

- **BL-260612-add-consensus-research-skill — Add consensus-research skill (investigate question, synthesized findings).** Retain the tool-permission/evidence-provenance decision gate before build. Review is not this research workflow.
- **BL-260612-add-deliberation-metrics — Add deliberation metrics (tokens, wall-clock, rounds) to artifacts.** Inventory available provider signals, then resume-safe aggregation; unavailable is explicit, never invented cost.
- **BL-260612-add-similarity-heuristic — Add similarity heuristic for near-converged deliberation states.** Usage-gated measured scoring, not a rename of existing agency/double-ACCEPT behavior. Metrics-first is useful sequencing, not a hard dependency.
- **BL-260612-add-whole-document — Add whole-document harmonization pass after section convergence.** Design the context/default boundary and Refine fan-in/resume integration before implementation.
- **BL-260701-add-multi-round-panel — Add multi-round panel discussion.** Product distinction already decided: optional, attributed, non-converging. Build only with usage evidence that single-round breadth is inadequate.

These remain open, not abandoned. Moving them behind immediate workflow needs does not declare their acceptance criteria complete.

### Reserved capabilities

- **BL-260619-define-host-native-dispatch — Define host-native dispatch / safe-packet protocol (reserved seam).** Concrete demand and reviewed go/no-go first; the shipped capability remains false.
- **BL-260619-multi-peer-3-deliberation — Multi-peer (3+) deliberation extension (reserved / v3+ concern).** Panel breadth is not group convergence. Require evidence that two-peer convergence is insufficient.

## Uncommitted follow-up ideas

Held until the retro findings ledger has data: lightweight skill-version comparison, workflow telemetry (new-skill and heavy-skill detection, recurring failure modes), and model comparison within one runtime. A watch emission filter for line-oriented consumers is also held; it overlaps inter-agent direct messaging.

Per-workflow defaults and activation of reserved roles are known config limitations, not hidden scope in the peer-model fix. Strict required submission, extra transcript providers, typed-test-fixture polish and broader orchestration remain ideas unless separately captured. Do not turn historical notes or a diagram into implementation commitments.
