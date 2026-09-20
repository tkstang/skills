# OAT Backlog Index

> Generated backlog table lives inside the managed section below. Keep curated narrative updates in the overview section so CLI regeneration stays safe.

## Curated Overview

- **September 20 state:** 29 active items remain after Session Fidelity and Agent Messaging were closed and archived. See the September 20 [full review](reviews/backlog-and-roadmap-review.md), current [roadmap](../roadmap.md), and [current-state snapshot](../current-state.md). The current [priority alignment](reviews/priority-alignment.md) selects six evidence/reliability tickets for one active quick project and one PR; a requested review-timeout adjustment is included. Other candidates remain unselected.
- **September 18 collaboration follow-ups:** [Codex self identity with duplicate rollouts](items/BL-260919-resolve-codex-self-identity.md) and [default digest coverage/full-history recovery](items/BL-260919-improve-default-observer.md) remain independent of completed Agent Messaging and Session Fidelity work; no kickoff order changed.
- **Merged baseline:** PR #83 completed the documentation IA/visuals and typed config reference; canonical source colocation, Session packaging, Must We?, Next Steps, and Session Retro are already on main. Transitive skill-version validation is implemented and archived, not a future prerequisite.
- **Immediate workflow:** **BL-260916-add-a-first-party-install — Add a first-party install command for standalone skills** is implemented in merged PR #90; its six live host/scope acceptance cells remain open.
- **Completed bounded review:** **BL-260916-add-consensus-review-cross — Add consensus-review: cross-model review of a bounded scope** is merged in PR #91 and archived. Local deterministic receipt evidence passed; release, external installation, and live provider acceptance remain separate.
- **Completed reliability investigation:** **BL-260916-session-observer-re-armed — Investigate observer re-arm catch-up and suspected unread-record gaps** is closed and archived. Deterministic exact-pin coverage found no lost renderable message on supported clean re-arm paths; raw-index gaps can contain filtered activity, and live harness delivery remains a separate unverified boundary.
- **Consensus correctness:** configured peer model/effort propagation, loop-free helper extraction, and the remaining atomic write sites are completed and archived. **BL-260723-investigate-live-submit — Investigate live submit verdict-source contract mismatch** remains active and requires a separately authorized live observation.
- **Collaboration state:** **BL-260619-inter-agent-direct-messaging — Inter-agent direct messaging (addressable, prioritized)** and **BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter** are completed and archived. [BL-260919-verify-live-agent-messaging — Verify live agent-messaging host acceptance](items/BL-260919-verify-live-agent-messaging.md) owns separately authorized messaging delivery tiers; **BL-260619-shared-session-log-substrate — Stateless multi-session activity merge** may reuse the merged activity contract, while **BL-260713-per-observer-offsets-and-safe — Per-observer offsets and safe N>2 collaboration mesh** remains separate consumer-ownership work.
- **Deferred investment:** research, deliberation metrics/similarity, harmonization, multi-round panel, idle integrations, and reserved host-native/group-convergence capabilities remain open. The roadmap maps every active item; historical research and external plans need current-path/contract checks before execution.
- **Release boundary:** merged payloads and manifest versions do not prove a tagged release, global installation, marketplace/search listing, or live provider acceptance. Follow the per-plugin release checklist independently of future Review/installer work.
- **CI reliability:** **BL-260919-stabilize-the-watcher-sigterm — Stabilize the watcher SIGTERM re-arm test** tracks a timing-dependent `watch.test.ts` case that failed once on an unrelated docs-only PR (#92) and passed on re-run. The session-fidelity stack is now merged; reproduce against main before changing the shared test file.
- **Session evidence follow-ups:** PR #93 filed thirteen evidence/retro/protocol follow-ups plus the watcher CI item. Their Session Fidelity foundation is now merged. All 29 active items, titles, ratings and dependencies appear in the [September 20 review](reviews/backlog-and-roadmap-review.md); first useful retros can use the existing Markdown activity export without waiting for multi-session infrastructure.

<!-- OAT BACKLOG-INDEX -->
| ID | Title | Status | Priority | Scope | Estimate |
| --- | --- | --- | --- | --- | --- |
| BL-260919-session-retro-consume-activity | Session-retro: consume activity evidence | in_progress | high | feature | M |
| BL-260919-skill-attribution-in-session | Skill attribution in session activity events | in_progress | high | feature | S |
| BL-260919-skill-evaluation-retro | Skill evaluation retro: activation, adherence, outcome, efficiency | open | high | feature | M |
| BL-260919-uncapped-structured-activity | Uncapped structured activity export for cross-session analysis | in_progress | high | feature | M |
| BL-260916-add-a-first-party-install | Add a first-party install command for standalone skills | open | medium | feature | S |
| BL-260919-collaboration-protocol-peer | Collaboration protocol: peer-initiated headless resume and provenance | open | medium | task | S |
| BL-260919-delegation-and-subagent | Delegation and subagent evaluation in retros | open | medium | feature | M |
| BL-260919-improve-default-observer | Improve default observer digest coverage and full-history recovery | open | medium | task | S |
| BL-260723-investigate-live-submit | Investigate live submit verdict-source contract mismatch | open | medium | task | S |
| BL-260919-locate-and-pin-claude-code | Locate and pin Claude Code subagent transcripts | open | medium | feature | M |
| BL-260919-read-linked-session-sidecars | Read linked session sidecars in the activity view | open | medium | feature | L |
| BL-260919-resolve-codex-self-identity | Resolve Codex self identity with duplicate rollout candidates | open | medium | task | S |
| BL-260919-retro-findings-ledger | Retro findings ledger with recurrence detection | open | medium | feature | M |
| BL-260919-stabilize-the-watcher-sigterm | Stabilize the watcher SIGTERM re-arm test | in_progress | medium | task | S |
| BL-260619-shared-session-log-substrate | Stateless multi-session activity merge | open | medium | initiative | L |
| BL-260919-surface-terminally | Surface terminally unsuccessful peer turns as watch events | in_progress | medium | feature | S |
| BL-260919-token-and-usage-accounting | Token and usage accounting for session activity | in_progress | medium | feature | S |
| BL-260919-verify-live-agent-messaging | Verify live agent-messaging host acceptance | open | medium | task | S |
| BL-260612-add-consensus-research-skill | Add consensus-research skill (investigate question, synthesized findings) | open | low | feature | M |
| BL-260612-add-deliberation-metrics | Add deliberation metrics (tokens, wall-clock, rounds) to artifacts | open | low | feature | S |
| BL-260701-add-multi-round-panel | Add multi-round panel discussion | open | low | idea | M |
| BL-260612-add-similarity-heuristic | Add similarity heuristic for near-converged deliberation states | open | low | feature | S |
| BL-260612-add-whole-document | Add whole-document harmonization pass after section convergence | open | low | feature | M |
| BL-260619-define-host-native-dispatch | Define host-native dispatch / safe-packet protocol (reserved seam) | open | low | initiative | L |
| BL-260919-grouped-activity-summaries | Grouped activity summaries and derived enrichments adapted from cli-continues | open | low | feature | M |
| BL-260619-multi-peer-3-deliberation | Multi-peer (3+) deliberation extension (reserved / v3+ concern) | open | low | idea | L |
| BL-260713-optional-idle-session | Optional idle-session application integrations | open | low | idea | M |
| BL-260713-per-observer-offsets-and-safe | Per-observer offsets and safe N&gt;2 collaboration mesh | open | low | initiative | L |
| BL-260919-reintroduce-deferred-activity | Reintroduce deferred activity correlation and provenance | open | low | feature | M |
<!-- END OAT BACKLOG-INDEX -->

## Notes

- Active item files live in `backlog/items/`
- Archived item files live in `backlog/archived/`
- Historical completions are summarized in `backlog/completed.md`
