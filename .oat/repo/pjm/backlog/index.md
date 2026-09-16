# OAT Backlog Index

> Generated backlog table lives inside the managed section below. Keep curated narrative updates in the overview section so CLI regeneration stays safe.

## Curated Overview

- **September 16 review:** 19 open items; no whole item meets its acceptance criteria yet. See the [full review](reviews/backlog-and-roadmap-review.md), [roadmap](../roadmap.md), and [current-state snapshot](../current-state.md). The refreshed [priority alignment](reviews/priority-alignment.md) confirms Sol's observer investigation, Consensus Review, and a parallel installer. Its complete map covers 19 items in 16 candidate projects; later ordering remains proposed.
- **Merged baseline:** PR #83 completed the documentation IA/visuals and typed config reference; canonical source colocation, Session packaging, Must We?, Next Steps, and Session Retro are already on main. Transitive skill-version validation is implemented and archived, not a future prerequisite.
- **Immediate workflow:** **BL-260916-add-consensus-review-cross — Add consensus-review: cross-model review of a bounded scope** is the user-selected high-priority feature. **BL-260916-add-a-first-party-install — Add a first-party install command for standalone skills** is an approved independent parallel onboarding lane.
- **Completed reliability investigation:** **BL-260916-session-observer-re-armed — Investigate observer re-arm catch-up and suspected unread-record gaps** is closed and archived. Deterministic exact-pin coverage found no lost renderable message on supported clean re-arm paths; raw-index gaps can contain filtered activity, and live harness delivery remains a separate unverified boundary.
- **Consensus correctness:** **BL-260916-honor-configured-peer-models — Honor configured peer models and effort in convergence workflows** remains open after its docs portion merged. **BL-260723-split-loop-free-cli-helpers — Split loop-free cli-helpers core for panel sharing** is optional preparation, not a hard Review dependency. **BL-260723-make-remaining-consensus-loop — Make remaining consensus-loop write sites atomic** remains a small independent fix; **BL-260723-investigate-live-submit — Investigate live submit verdict-source contract mismatch** requires a separately authorized live observation.
- **Independent collaboration projects:** **BL-260619-inter-agent-direct-messaging — Inter-agent direct messaging (addressable, prioritized)** now targets provider-neutral recipient inboxes, not a daemon or harness-specific messaging API. **BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter** precedes **BL-260619-shared-session-log-substrate — Stateless multi-session activity merge**. Messaging is independent of both. **BL-260713-per-observer-offsets-and-safe — Per-observer offsets and safe N>2 collaboration mesh** remains separate consumer-ownership work.
- **Deferred investment:** research, deliberation metrics/similarity, harmonization, multi-round panel, idle integrations, and reserved host-native/group-convergence capabilities remain open. The roadmap maps every active item; historical research and external plans need current-path/contract checks before execution.
- **Release boundary:** merged payloads and manifest versions do not prove a tagged release, global installation, marketplace/search listing, or live provider acceptance. Follow the per-plugin release checklist independently of future Review/installer work.

<!-- OAT BACKLOG-INDEX -->
| ID | Title | Status | Priority | Scope | Estimate |
| --- | --- | --- | --- | --- | --- |
| BL-260916-add-consensus-review-cross | Add consensus-review: cross-model review of a bounded scope | open | high | feature | M |
| BL-260916-add-a-first-party-install | Add a first-party install command for standalone skills | open | medium | feature | S |
| BL-260916-honor-configured-peer-models | Honor configured peer models and effort in convergence workflows | open | medium | task | M |
| BL-260619-inter-agent-direct-messaging | Inter-agent direct messaging (addressable, prioritized) | open | medium | feature | M |
| BL-260723-investigate-live-submit | Investigate live submit verdict-source contract mismatch | open | medium | task | S |
| BL-260916-session-fidelity-opt | Session fidelity: opt-in --include-activity for observer and exporter | open | medium | feature | L |
| BL-260619-shared-session-log-substrate | Stateless multi-session activity merge | open | medium | initiative | L |
| BL-260612-add-consensus-research-skill | Add consensus-research skill (investigate question, synthesized findings) | open | low | feature | M |
| BL-260612-add-deliberation-metrics | Add deliberation metrics (tokens, wall-clock, rounds) to artifacts | open | low | feature | S |
| BL-260701-add-multi-round-panel | Add multi-round panel discussion | open | low | idea | M |
| BL-260612-add-similarity-heuristic | Add similarity heuristic for near-converged deliberation states | open | low | feature | S |
| BL-260612-add-whole-document | Add whole-document harmonization pass after section convergence | open | low | feature | M |
| BL-260619-define-host-native-dispatch | Define host-native dispatch / safe-packet protocol (reserved seam) | open | low | initiative | L |
| BL-260723-make-remaining-consensus-loop | Make remaining consensus-loop write sites atomic | open | low | task | S |
| BL-260619-multi-peer-3-deliberation | Multi-peer (3+) deliberation extension (reserved / v3+ concern) | open | low | idea | L |
| BL-260713-optional-idle-session | Optional idle-session application integrations | open | low | idea | M |
| BL-260713-per-observer-offsets-and-safe | Per-observer offsets and safe N&gt;2 collaboration mesh | open | low | initiative | L |
| BL-260723-split-loop-free-cli-helpers | Split loop-free cli-helpers core for panel sharing | open | low | task | S |
<!-- END OAT BACKLOG-INDEX -->

## Notes

- Active item files live in `backlog/items/`
- Archived item files live in `backlog/archived/`
- Historical completions are summarized in `backlog/completed.md`
