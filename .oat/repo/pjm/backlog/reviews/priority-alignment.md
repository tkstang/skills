# Backlog Priority Alignment

**Date:** 2026-07-11
**Status:** Active — Research boundary and loop-quality batch promoted to now; whole-document harmonization and the shared session-log substrate are next; direct messaging is later.

One-page execution guide: recommended order, scope, parallelism, and planning investment. For the full value/effort catalog, dependency graph, and quadrant tables, see [backlog-and-roadmap-review.md](./backlog-and-roadmap-review.md).

> This document is produced or refreshed via the optional walkthrough at the end of `oat-pjm-review-backlog`. It is **not** auto-generated — phase shape, parallelism, and the kickoff stack reflect operator judgment captured during the walkthrough.

## Related sources

| Document | Role |
| --- | --- |
| [roadmap.md](../../roadmap.md) | Authoritative Now / Next / Later execution order |
| [current-state.md](../../current-state.md) | Shipped capabilities and selected active backlog |
| [backlog/index.md](../index.md) | Curated overview and generated item table |
| [backlog/items/](../items/) | Executable backlog records |
| [backlog-and-roadmap-review.md](./backlog-and-roadmap-review.md) | Full value/effort catalog, dependency graph, and risks |

> **Planning investment** = discovery or design needed before implementation pays off — not total build time. It remains useful here because the research and substrate lanes have materially different design risk from their implementation size.

**Operator context (2026-07-11):** Move the research boundary and loop-quality batch to **now**. Take whole-document harmonization and the shared session-log substrate **next**. Keep direct messaging **later**. No new calendar or numeric-capacity constraint was set in this pass; current parallelism is therefore limited by shared-surface safety rather than assumed headcount.

---

## Finishing / in flight

**Nothing is mid-flight.** The previous generated-runtime dedup cycle shipped on 2026-07-07, so the current board has nine open items and no packaging-window dependency.

---

## Phase 1 — Research boundary + loop-quality batch (now)

Two deliberate tracks are active now. The research track is a decision-only boundary; the loop-quality track is one sequential implementation worktree. The research **build**, if approved, must not overlap the loop-quality implementation.

| Item | Scope | Planning investment | Parallel with | Notes |
| --- | --- | --- | --- | --- |
| [Add consensus-research skill](../items/BL-260612-add-consensus-research-skill.md) (`BL-260612-add-consensus-research-skill`) | M | High | Loop-quality batch — **DR only** | Start with the peer tool-access, permissions, and evidence-provenance DR. The resulting go/no-go defines the wrapper scope; do not begin its loop-touching build yet. |
| [Add deliberation metrics](../items/BL-260612-add-deliberation-metrics.md) (`BL-260612-add-deliberation-metrics`) | S | Low | Research DR only; then similarity in same worktree | Inventory real provider-CLI token/cost signals, preserve explicit unavailable semantics, and record the cost-cap feasibility outcome. |
| [Add similarity heuristic](../items/BL-260612-add-similarity-heuristic.md) (`BL-260612-add-similarity-heuristic`) | S | Low | Metrics only — same worktree, second | Keep it deterministic, agency-gated, and audit-disclosed. Do not open the shared loop in a separate worktree. |

---

## Phase 2 — Coherence + collaboration foundation (next)

These are the next investments after Phase 1 closes. They are technically disjoint, but each is a high-attention design/build arc; begin one or both only with deliberate capacity.

| Item | Scope | Planning investment | Parallel with | Notes |
| --- | --- | --- | --- | --- |
| [Add whole-document harmonization pass](../items/BL-260612-add-whole-document.md) (`BL-260612-add-whole-document`) | M | Medium | Shared-session-log **design** only | First record the assembled-document-only versus include-section-logs decision. The implementation must compose with sequential, host-mediated parallel, impasse, and resume paths. |
| [Shared session log substrate](../items/BL-260619-shared-session-log-substrate.md) (`BL-260619-shared-session-log-substrate`) | L | High | Harmonization subject to capacity | Begin with the adopt-versus-build, packaging, identity, merged-log schema, and lifecycle decisions. This is a daemon/operational-surface initiative, not an incidental third worktree. |

---

## Phase 3 — Direct messaging (later)

| Item | Scope | Planning investment | Parallel with | Notes |
| --- | --- | --- | --- | --- |
| [Inter-agent direct messaging](../items/BL-260619-inter-agent-direct-messaging.md) (`BL-260619-inter-agent-direct-messaging`) | M | High | None until its substrate exists | Begin only after the shared session-log substrate lands. Reuse its project-scoped identity, state, lifecycle, and cursor primitives; record the Agent Mail / `cass` adopt-versus-build decision. |

---

## Deferred / parked

| Item | Scope | Notes |
| --- | --- | --- |
| [Define host-native dispatch / safe-packet protocol](../items/BL-260619-define-host-native-dispatch.md) (`BL-260619-define-host-native-dispatch`) | L | The reserved capability remains safely disabled. Revisit only for a concrete host-native dispatch need. |
| [Multi-peer (3+) deliberation extension](../items/BL-260619-multi-peer-3-deliberation.md) (`BL-260619-multi-peer-3-deliberation`) | L | Panel already provides multi-provider breadth; reopen group convergence only with evidence that two peers are insufficient. |
| [Add multi-round panel discussion](../items/BL-260701-add-multi-round-panel.md) (`BL-260701-add-multi-round-panel`) | M | The product boundaries are recorded. Build only after usage evidence shows that single-round breadth is inadequate. |

---

## Parallelism cheat sheet

| Can run together | Must remain sequential |
| --- | --- |
| [Add consensus-research skill](../items/BL-260612-add-consensus-research-skill.md) (`BL-260612-add-consensus-research-skill`) **DR only** ∥ the loop-quality batch | The research **build** ∥ any loop-quality implementation |
| [Add whole-document harmonization pass](../items/BL-260612-add-whole-document.md) (`BL-260612-add-whole-document`) planning ∥ shared-session-log substrate planning, subject to capacity | [Add deliberation metrics](../items/BL-260612-add-deliberation-metrics.md) (`BL-260612-add-deliberation-metrics`) → [Add similarity heuristic](../items/BL-260612-add-similarity-heuristic.md) (`BL-260612-add-similarity-heuristic`) in one shared-loop worktree |
| The session-log substrate can be technically disjoint from consensus work | [Shared session log substrate](../items/BL-260619-shared-session-log-substrate.md) (`BL-260619-shared-session-log-substrate`) → [Inter-agent direct messaging](../items/BL-260619-inter-agent-direct-messaging.md) (`BL-260619-inter-agent-direct-messaging`) |

---

## Suggested OAT project groupings

| Proposed project | Items | Why |
| --- | --- | --- |
| **consensus-research-boundary** | [Add consensus-research skill](../items/BL-260612-add-consensus-research-skill.md) (`BL-260612-add-consensus-research-skill`) | Spec-driven decision/build project; the peer tool-access decision must shape the implementation. |
| **loop-quality** | [Add deliberation metrics](../items/BL-260612-add-deliberation-metrics.md) (`BL-260612-add-deliberation-metrics`) → [Add similarity heuristic](../items/BL-260612-add-similarity-heuristic.md) (`BL-260612-add-similarity-heuristic`) | One loop-core opening, one generated-output regeneration arc, and shared tests. |
| **whole-document-harmonization** | [Add whole-document harmonization pass](../items/BL-260612-add-whole-document.md) (`BL-260612-add-whole-document`) | Separate design/boundary decision before a broad Refine and resume integration. |
| **multi-agent-substrate** | [Shared session log substrate](../items/BL-260619-shared-session-log-substrate.md) (`BL-260619-shared-session-log-substrate`) | Initiative-scale foundation before later messaging. |
| **direct-messaging** | [Inter-agent direct messaging](../items/BL-260619-inter-agent-direct-messaging.md) (`BL-260619-inter-agent-direct-messaging`) | Later project, deliberately blocked on the foundation. |

---

## Current kickoff stack

> Each current-stack item has a one-shot kickoff handoff under [`../../handoffs/`](../../handoffs/). Create a worktree per project, use the stated mode, and delete the consumed handoff in the shipping PR.

1. **Kick off** [Add consensus-research skill](../items/BL-260612-add-consensus-research-skill.md) (`BL-260612-add-consensus-research-skill`) as a spec-driven research-boundary project. Deliver the DR first; a build follows only on a documented go.
2. **Kick off** the loop-quality project: [Add deliberation metrics](../items/BL-260612-add-deliberation-metrics.md) (`BL-260612-add-deliberation-metrics`) → [Add similarity heuristic](../items/BL-260612-add-similarity-heuristic.md) (`BL-260612-add-similarity-heuristic`) in one sequential worktree.

---

## Changelog

| Date | Update |
| --- | --- |
| 2026-07-11 | **Priority reset confirmed.** Research boundary and loop-quality batch moved to now; whole-document harmonization and shared session-log substrate moved to next; direct messaging moved to later. Replaced the stale 10-item/dedup-window view and refreshed the current kickoff stack. |
| 2026-07-07 | Shared generated-runtime dedup shipped; the hosted-discovery check and decision sweep closed. |
| 2026-07-05 | Consolidation-cycle alignment created; superseded by the July 11 execution order. |
