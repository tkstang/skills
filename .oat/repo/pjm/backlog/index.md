# OAT Backlog Index

> Generated backlog table lives inside the managed section below. Keep curated narrative updates in the overview section so CLI regeneration stays safe.

## Curated Overview

- **September 30 scoped delivery:** [Import sessions before native fork](archived/BL-260930-import-sessions-before-native.md) is accepted on its feature branch after Opus design/implementation review and isolated native-client verification. Merge, installation and exact interactive terminal acceptance remain pending. Other dated snapshots below are unchanged.

- **September 20 state:** 23 active items remain after the six-ticket session-evidence batch was accepted and closed in PR #99. PR #99 still awaits merge; closed records document satisfied acceptance criteria on that PR, not main-branch availability. See the [roadmap](../roadmap.md), [current-state snapshot](../current-state.md), historical [full review](reviews/backlog-and-roadmap-review.md), and updated [priority alignment](reviews/priority-alignment.md). No next product wave is selected.
- **Completed PR #99 batch:** [watcher SIGTERM stability](archived/BL-260919-stabilize-the-watcher-sigterm.md), [unsuccessful terminal events](archived/BL-260919-surface-terminally.md), [skill attribution](archived/BL-260919-skill-attribution-in-session.md), [usage accounting](archived/BL-260919-token-and-usage-accounting.md), [complete structured activity export](archived/BL-260919-uncapped-structured-activity.md), and [activity-backed Session Retro](archived/BL-260919-session-retro-consume-activity.md) are archived with their acceptance evidence retained in the project. Merge, release, installation and live-provider acceptance remain separate.
- **Docs verification debt — resolved in PR #100:** [BL-260920-re-verify-install-matrix — Re-verify Install matrix Cursor claims against current cursor-agent](archived/BL-260920-re-verify-install-matrix.md) settled both named Cursor claims on cursor-agent 2026.09.18-9a7762b. It did not close the broader standalone installer acceptance matrix.
- **Merged main baseline:** `origin/main` at `4150cfe2` includes PR #100 and PR #101. Consensus `0.2.1` carries Draft-07 Review/Panel schemas and Review's 900-second default plus CLI override. The accepted Opus reviews establish only the bounded Review route used for their recorded packets, not provider-wide support certification.
- **Immediate acceptance work:** **BL-260916-add-a-first-party-install — Add a first-party install command for standalone skills** remains open after its PR #90 implementation for a pinned payload tag and six live host/scope cells. [BL-260919-verify-live-agent-messaging — Verify live agent-messaging host acceptance](items/BL-260919-verify-live-agent-messaging.md) and **BL-260723-investigate-live-submit — Investigate live submit verdict-source contract mismatch** remain separately authorized live-evidence tasks.
- **Collaboration follow-ups:** [BL-260919-resolve-codex-self-identity — Resolve Codex self identity with duplicate rollout candidates](items/BL-260919-resolve-codex-self-identity.md) and [BL-260919-improve-default-observer — Improve default observer digest coverage and full-history recovery](items/BL-260919-improve-default-observer.md) remain independent of completed messaging/evidence delivery. Inbox delivery, transcript observation and N>2 consumer ownership stay distinct boundaries.
- **Remaining evidence/retro sequence:** **BL-260919-skill-evaluation-retro — Skill evaluation retro: activation, adherence, outcome, efficiency** remains the next proposed consumer after PR #99 merges, followed by the existing child-discovery, delegation, findings-ledger, sidecar and deferred-enrichment proposals. Their relative order is unchanged and unselected.
- **Session-observer test-pruning follow-ups (September 27):** the pruning campaign ([report](../../reference/reviews/2026-09-26-session-observer-test-pruning-campaign.md)) filed three low-priority cleanups: [BL-260927-remove-dead-handoff-discovery](items/BL-260927-remove-dead-handoff-discovery.md) (S), [BL-260927-decide-the-fate-of-unwired](items/BL-260927-decide-the-fate-of-unwired.md) (M) and [BL-260927-deduplicate-session-observer](items/BL-260927-deduplicate-session-observer.md) (M). Its two reproduced defects, subcommand `--help` and same-millisecond backup names, are fixed in a follow-up PR rather than tracked here.
- **Session search follow-ups (October 2):** the `session-search` project on `feat/session-search` (not yet merged) deferred four non-regression Low review findings to [BL-261002-resolve-deferred-session](items/BL-261002-resolve-deferred-session.md) (S). Its design choice is recorded in [DR-261002-stateless-tiered-session](../../reference/decisions/DR-261002-stateless-tiered-session.md).
- **Deferred investment:** shared-session merge, N>2 offsets, idle integrations, research, deliberation metrics/similarity, harmonization, multi-round panel and reserved host-native/group-convergence capabilities remain open. Historical research and external plans need current-path and contract checks before execution.
- **Release boundary:** merged payloads, accepted PR branches and manifest versions do not prove a tagged release, global installation, marketplace/search listing, live messaging, or general provider acceptance. Follow the per-plugin release checklist and each live-acceptance ticket independently.

<!-- OAT BACKLOG-INDEX -->
| ID | Title | Status | Priority | Scope | Estimate |
| --- | --- | --- | --- | --- | --- |
| BL-260919-skill-evaluation-retro | Skill evaluation retro: activation, adherence, outcome, efficiency | open | high | feature | M |
| BL-260916-add-a-first-party-install | Add a first-party install command for standalone skills | open | medium | feature | S |
| BL-260919-collaboration-protocol-peer | Collaboration protocol: peer-initiated headless resume and provenance | open | medium | task | S |
| BL-260919-delegation-and-subagent | Delegation and subagent evaluation in retros | open | medium | feature | M |
| BL-260919-improve-default-observer | Improve default observer digest coverage and full-history recovery | open | medium | task | S |
| BL-260723-investigate-live-submit | Investigate live submit verdict-source contract mismatch | open | medium | task | S |
| BL-260919-locate-and-pin-claude-code | Locate and pin Claude Code subagent transcripts | open | medium | feature | M |
| BL-260919-read-linked-session-sidecars | Read linked session sidecars in the activity view | open | medium | feature | L |
| BL-260919-resolve-codex-self-identity | Resolve Codex self identity with duplicate rollout candidates | open | medium | task | S |
| BL-260919-retro-findings-ledger | Retro findings ledger with recurrence detection | open | medium | feature | M |
| BL-260619-shared-session-log-substrate | Stateless multi-session activity merge | open | medium | initiative | L |
| BL-260919-verify-live-agent-messaging | Verify live agent-messaging host acceptance | open | medium | task | S |
| BL-260612-add-consensus-research-skill | Add consensus-research skill (investigate question, synthesized findings) | open | low | feature | M |
| BL-260612-add-deliberation-metrics | Add deliberation metrics (tokens, wall-clock, rounds) to artifacts | open | low | feature | S |
| BL-260701-add-multi-round-panel | Add multi-round panel discussion | open | low | idea | M |
| BL-260612-add-similarity-heuristic | Add similarity heuristic for near-converged deliberation states | open | low | feature | S |
| BL-260612-add-whole-document | Add whole-document harmonization pass after section convergence | open | low | feature | M |
| BL-260927-decide-the-fate-of-unwired | Decide the fate of unwired session-observer code paths | open | low | task | M |
| BL-260927-deduplicate-session-observer | Deduplicate session-observer CLI runtime resolution and close legacy coverage gaps | open | low | task | M |
| BL-260619-define-host-native-dispatch | Define host-native dispatch / safe-packet protocol (reserved seam) | open | low | initiative | L |
| BL-260919-grouped-activity-summaries | Grouped activity summaries and derived enrichments adapted from cli-continues | open | low | feature | M |
| BL-260619-multi-peer-3-deliberation | Multi-peer (3+) deliberation extension (reserved / v3+ concern) | open | low | idea | L |
| BL-260713-optional-idle-session | Optional idle-session application integrations | open | low | idea | M |
| BL-260713-per-observer-offsets-and-safe | Per-observer offsets and safe N&gt;2 collaboration mesh | open | low | initiative | L |
| BL-260919-reintroduce-deferred-activity | Reintroduce deferred activity correlation and provenance | open | low | feature | M |
| BL-260927-remove-dead-handoff-discovery | Remove dead handoff discovery from session-fork-to-destination | open | low | task | S |
| BL-261002-resolve-deferred-session | Resolve deferred session-search review follow-ups | open | low | task | S |
<!-- END OAT BACKLOG-INDEX -->

## Notes

- Active item files live in `backlog/items/`
- Archived item files live in `backlog/archived/`
- Historical completions are summarized in `backlog/completed.md`
