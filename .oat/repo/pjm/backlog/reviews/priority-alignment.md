# Backlog Priority Alignment

**Date:** 2026-09-16
**Status:** Active — three immediate lanes confirmed; later project grouping and order proposed, not operator-approved.

> **Closeout update (2026-09-16):** The observer re-arm lane subsequently completed in PR #85 and its item moved to `backlog/archived/`. Statements below that describe it as open or in flight preserve the planning snapshot taken before that closeout; the current roadmap and backlog index are authoritative for active work.

The July kickoff stack is superseded. This is the operator execution view; see the [full review](backlog-and-roadmap-review.md) for ratings/evidence, [roadmap](../../roadmap.md) for horizons, [current state](../../current-state.md) for merged capability, and [item index](../index.md) for canonical records.

## Operator context and approval boundary

PR #83 is merged. The user reports Sol has started the observer investigation, approves Consensus Review next with Astra driving and Fable reviewing, and explicitly wants the installer available in parallel. No calendar constraint was supplied.

These are **three approved independent lanes**, not a dependency chain. The remaining 16 items have recommended groupings below, but their total order has not been agreed. Do not present this planning PR or its eventual merge as authorization to start all of them. Publication of this planning branch/PR is authorized; product execution, provider spend, installation and release retain their own boundaries.

## Finishing / in flight

[BL-260916-session-observer-re-armed — Investigate observer re-arm catch-up and suspected unread-record gaps](../archived/BL-260916-session-observer-re-armed.md) is **started with Sol, per the user**. Its canonical item remains open on this planning branch; Sol owns implementation tracking and acceptance-based closeout in its worktree. The handoff is a reference for that existing assignment, not a second dispatch.

## Confirmed kickoff stack

1. **Continue:** [BL-260916-session-observer-re-armed — Investigate observer re-arm catch-up and suspected unread-record gaps](../archived/BL-260916-session-observer-re-armed.md) — Sol; bounded reproduction first.
2. **Kick off:** [BL-260916-add-consensus-review-cross — Add consensus-review: cross-model review of a bounded scope](../items/BL-260916-add-consensus-review-cross.md) — Astra leads a quick workflow with lightweight design; Fable observes and reviews. The design must settle reviewer config/selection, scope capture, read-only policy/capture writes, owned schema and OAT rendering. This alignment does not claim the project has already been scaffolded.
3. **Parallel kickoff:** [BL-260916-add-a-first-party-install — Add a first-party install command for standalone skills](../items/BL-260916-add-a-first-party-install.md) — independent implementation worktree; owner selected by the user. Approved as a parallel lane, not claimed started.

Each has a [kickoff handoff](../../handoffs/README.md). Merge or reconcile the planning baseline before implementation closeout so concurrent branches do not restore older ticket text. The user already supplied Sol a chat handoff; do not restart its work.

## Complete project map — all 19 items

There are **16 project candidates covering 19 items**: one three-ticket maintenance batch, one conditional two-ticket loop-quality batch, and fourteen single-ticket projects. These are planning units, not sixteen newly created OAT projects.

| Priority / approval | Project candidate | Backlog membership | Grouping boundary |
| --- | --- | --- | --- |
| Now — started | Observer reliability | [BL-260916-session-observer-re-armed — Investigate observer re-arm catch-up and suspected unread-record gaps](../archived/BL-260916-session-observer-re-armed.md) | Solo lite investigation; user reports Sol started it. |
| Now — approved | Consensus Review | [BL-260916-add-consensus-review-cross — Add consensus-review: cross-model review of a bounded scope](../items/BL-260916-add-consensus-review-cross.md) | Quick workflow + lightweight design; Astra leads, Fable reviews. No unrelated loop changes. |
| Now — approved parallel | Standalone installer | [BL-260916-add-a-first-party-install — Add a first-party install command for standalone skills](../items/BL-260916-add-a-first-party-install.md) | Independent quick project; integrity, overwrite/ref semantics and host-specific destinations remain explicit. |
| Next — proposed 1 | Consensus runtime maintenance | [BL-260916-honor-configured-peer-models — Honor configured peer models and effort in convergence workflows](../items/BL-260916-honor-configured-peer-models.md); [BL-260723-make-remaining-consensus-loop — Make remaining consensus-loop write sites atomic](../items/BL-260723-make-remaining-consensus-loop.md); [BL-260723-split-loop-free-cli-helpers — Split loop-free cli-helpers core for panel sharing](../items/BL-260723-split-loop-free-cli-helpers.md) | One project, three independently verifiable phases/commits: model propagation, atomic writes, helper split. Shared runtime/output ownership justifies grouping, not a hard dependency; each can ship separately. Only helper extraction may move into Review if its design demonstrates direct need. |
| Next — proposed 2 | Provider-neutral inbox | [BL-260619-inter-agent-direct-messaging — Inter-agent direct messaging (addressable, prioritized)](../items/BL-260619-inter-agent-direct-messaging.md) | Own project. Shared identity/state contract, acknowledgments, concurrency and bounded delivery; independent of fidelity/merge. |
| Next — proposed 3 | Session fidelity | [BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter](../items/BL-260916-session-fidelity-opt.md) | Own design/build project using the retained research packet; no daemon or warehouse. |
| Next — authorization lane | Live-submit investigation | [BL-260723-investigate-live-submit — Investigate live submit verdict-source contract mismatch](../items/BL-260723-investigate-live-submit.md) | Separate bounded diagnosis; schedule when live-run authority is granted. Do not hide provider spend inside a maintenance batch. |
| After fidelity — proposed | Stateless merged activity view | [BL-260619-shared-session-log-substrate — Stateless multi-session activity merge](../items/BL-260619-shared-session-log-substrate.md) | Separate project consuming the fidelity contract; not a prerequisite for inboxes. |
| Later — proposed first | Loop measurement and convergence quality | [BL-260612-add-deliberation-metrics — Add deliberation metrics (tokens, wall-clock, rounds) to artifacts](../items/BL-260612-add-deliberation-metrics.md); [BL-260612-add-similarity-heuristic — Add similarity heuristic for near-converged deliberation states](../items/BL-260612-add-similarity-heuristic.md) | Potential two-phase project: ship metrics first; similarity proceeds only if evidence and a reviewed deterministic contract justify it. Grouping is not approval to implement the heuristic. |
| Later — demand-gated | Whole-document harmonization | [BL-260612-add-whole-document — Add whole-document harmonization pass after section convergence](../items/BL-260612-add-whole-document.md) | Separate context/fan-in/resume project; not an incidental Review enhancement. |
| Later — demand-gated | Consensus Research | [BL-260612-add-consensus-research-skill — Add consensus-research skill (investigate question, synthesized findings)](../items/BL-260612-add-consensus-research-skill.md) | Separate tool-access/provenance decision, then implementation only on go. |
| Later — demand-gated | Multi-round Panel | [BL-260701-add-multi-round-panel — Add multi-round panel discussion](../items/BL-260701-add-multi-round-panel.md) | Separate optional attributed discussion project; not convergence. |
| Parked — unranked | Safe N>2 collaboration | [BL-260713-per-observer-offsets-and-safe — Per-observer offsets and safe N>2 collaboration mesh](../items/BL-260713-per-observer-offsets-and-safe.md) | Separate stateful ownership/CAS/topology project. Inboxes and stateless merge may inform it but are not hard prerequisites. |
| Parked — unranked | Idle-session integrations | [BL-260713-optional-idle-session — Optional idle-session application integrations](../items/BL-260713-optional-idle-session.md) | Separate opt-in host integration investigation; don't couple mesh delivery to a selected application. |
| Parked — unranked | Host-native dispatch | [BL-260619-define-host-native-dispatch — Define host-native dispatch / safe-packet protocol (reserved seam)](../items/BL-260619-define-host-native-dispatch.md) | Separate capability/security decision; no enabling reserved flags without reviewed contract. |
| Parked — unranked | 3+ peer deliberation | [BL-260619-multi-peer-3-deliberation — Multi-peer (3+) deliberation extension (reserved / v3+ concern)](../items/BL-260619-multi-peer-3-deliberation.md) | Separate group-convergence decision, not the N>2 observer mesh. |

## Recommended order beyond the kickoff — awaiting confirmation

1. **Consensus runtime maintenance** for known correctness/duplication debt.
2. **Provider-neutral inbox**, then **Session fidelity** as the default product queue. This ordering is based on bounded scope and immediate collaboration utility, not a dependency; the user can swap them or run them with separate ownership.
3. **Stateless merged activity view**, strictly after the fidelity contract is usable.
4. **Loop measurement/convergence quality**, then demand-led harmonization/research/panel work. Similarity has its own evidence gate and need not ship with metrics.
5. Keep the four parked projects unranked until a concrete need selects one.

**Live-submit investigation** is an independent authorization-gated slot, not a last-place item: move it earlier when the user grants a bounded live run or current release work depends on that evidence.

## Parallelism cheat sheet

| Can run together | Coordinate or sequence |
| --- | --- |
| Observer investigation, Consensus Review, standalone installer | Separate worktrees; coordinate shared distributions/version outputs and user-guide links at integration. |
| Consensus work and inbox/fidelity planning | Review and maintenance share Consensus config/runtime/generation surfaces; serialize overlapping implementation or rebase explicitly. |
| Inbox design and fidelity design | Their observer/collab implementation may overlap; assign exact ownership before concurrent writes. |
| Authorized live-submit diagnosis and unrelated development | No implicit live-run permission; observe effective runtime policy and redact evidence. |
| Research-boundary design and loop measurement | Avoid concurrent loop-mutating implementations. |

**Hard item edge:** [BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter](../items/BL-260916-session-fidelity-opt.md) → [BL-260619-shared-session-log-substrate — Stateless multi-session activity merge](../items/BL-260619-shared-session-log-substrate.md). Other sequencing above is recommended scheduling or an internal design gate.

## Changelog

| Date | Update |
| --- | --- |
| 2026-09-16 | Confirmed Sol re-arm work, Astra/Fable Review lane, and parallel installer. Replaced July kickoff handoffs; mapped all 19 items into 16 candidates. Kept later order explicitly proposed; removed daemon-first messaging dependency and broad Review ride-alongs. |
| 2026-07-11 | Previous research-boundary/loop-quality kickoff; now superseded, not marked completed. |
| 2026-07-07 | Generated-runtime dedup and hosted-discovery/decision sweep completed. |
