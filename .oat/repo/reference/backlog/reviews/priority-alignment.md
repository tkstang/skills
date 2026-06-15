# Backlog Priority Alignment

**Date:** 2026-06-14
**Status:** Active — Iteration modes (`bl-5d49`, `bl-7af0`) merged via PR #9; repo dev tooling landed via PR #10 (pnpm hooks, commitlint, oxlint/oxfmt, `worktree:init`/`worktree:validate`). The five consensus family skills are now fully unblocked. Reference narratives (index overview, `completed.md`, `roadmap.md`, `current-state.md`, DR-018/019) refreshed to "merged" on 2026-06-14. `consensus-evaluate` (`bl-5174`) kickoff may already be underway (branch `chore/implement-backlog-item-bl-5174`).

One-page execution guide: recommended order, scope, parallelism, and planning investment. For the full value/effort catalog, dependency graph, and quadrant tables, see [backlog-and-roadmap-review.md](./backlog-and-roadmap-review.md).

> This document is produced or refreshed via the optional walkthrough at the end of `oat-pjm-review-backlog`. It is **not** auto-generated — phase shape, parallelism, and the kickoff stack reflect operator judgment captured during the walkthrough.

## Related sources

| Document | Role |
| --- | --- |
| [roadmap.md](../../roadmap.md) | Authoritative Now / Next / Later execution order |
| [current-state.md](../../current-state.md) | Shipped capabilities and selected active backlog (if maintained) |
| [backlog/index.md](../index.md) | Curated overview + generated item table |
| [backlog/items/](../items/) | Executable backlog records (one file per item) |
| [backlog-and-roadmap-review.md](./backlog-and-roadmap-review.md) | Full `oat-pjm-review-backlog` artifact (catalog, dependencies, waves) |
| Dated snapshots | `backlog-and-roadmap-review-YYYY-MM-DD.md` in this directory |

> **Planning investment** = discovery/design likely needed *before* implementation pays off — not total build time. An item can be small to build but carry a real upfront design pass (and vice versa).

**Operator context (this pass):** appetite for 2–3 parallel tracks; no calendar constraints.

---

## Finishing / in flight

Items already started, in code review, or otherwise mid-flight. Close these out before — or alongside — the next phase.

| Item | Scope | Notes |
| --- | --- | --- |
| Refresh "merge pending" narratives (no backlog item) | S | ✅ Done 2026-06-14 — index overview, `completed.md`, `roadmap.md`, `current-state.md`, and DR-018/019 now read "merged to `main` via PR #9." |

---

## Phase 1 — Family kickoff + release (parallel)

The two free-to-parallelize tracks. `consensus-evaluate` is the cheapest, highest-signal first family skill (proves the wrapper pattern; only needs the already-shipped `parallel_revision`). The v0.1 release lane shares nothing with consensus development, so it runs concurrently from day one.

| Item | Scope | Planning investment | Parallel with | Notes |
| --- | --- | --- | --- | --- |
| [Add consensus-evaluate skill](../items/add-consensus-evaluate-skill.md) (`bl-5174`) | S | Low | `bl-d85f` | First family skill; dependency (`parallel_revision`) shipped. Establishes the wrapper template the other four reuse. shared_input / parallel_revision / minimal agency. |
| [Complete v0.1 release verification and tag](../items/complete-v01-release-verification.md) (`bl-d85f`) | M | Low | `bl-5174` | Independent; gates announcements only. Execute `RELEASING.md` across Claude Code / Cursor / Codex / Agent Skills; finalize CHANGELOG; tag. |

---

## Phase 2 — Family fan-out + structured-output hardening (2–3 tracks)

Once `bl-5174` proves the pattern, the synthesized-mode wrappers fan out. The cost is front-loaded in `bl-b9b9` (resolves the new `independent_draft` cold start + derived-sectioning design that decide/plan then reuse). Run `bl-3a88` as a parallel hardening track — it is the durable fix for the structured-output fragility that broke live dogfooding and de-risks every synthesized wrapper here.

| Item | Scope | Planning investment | Parallel with | Notes |
| --- | --- | --- | --- | --- |
| [Add consensus-create skill](../items/add-consensus-create-skill.md) (`bl-b9b9`) | M | **High** | `bl-3a88` | First synthesized-mode wrapper. Resolve `independent_draft` cold start + derived-sectioning (whole-artifact vs outline-first) up front — decide/plan inherit it. independent_draft / parallel_synthesized / maximum agency. |
| [Add consensus-decide skill](../items/add-consensus-decide-skill.md) (`bl-87ef`) | S | Low | `bl-0cb8`, `bl-3a88` | Thin wrapper once `bl-b9b9` lands the cold-start groundwork. Validates the unique minimal-agency + synthesized edge (contested calls always surface). |
| [Add consensus-plan skill](../items/add-consensus-plan-skill.md) (`bl-0cb8`) | S | Low | `bl-87ef`, `bl-3a88` | Thin wrapper; reuses create/decide groundwork. independent_draft / parallel_synthesized / moderate agency. |
| [Tool-based verdict submission](../items/tool-based-verdict-submission-for-consensus-peers.md) (`bl-3a88`) | L | **High** | family skills above | Highest-leverage durable fix; own design pass (MCP tool vs CLI; verdict capture; composes with stateless-per-turn peers + deterministic engine). Touches the DR-002 Paseo boundary. Start the design pass alongside the fan-out. |

---

## Phase 3 — Paseo build-vs-buy + last family skill (2 tracks)

Evidence- and design-gated work. `bl-f0b6` produces the ACP-reliability evidence that feeds `bl-bb7e`'s provider-count pivot, so sequence them. `bl-645c` is the last family skill and is independent of the Paseo investigation, but should not start until its peer tool-access design question is answered.

| Item | Scope | Planning investment | Parallel with | Notes |
| --- | --- | --- | --- | --- |
| [Verify cursor-as-peer end-to-end](../items/verify-cursor-as-peer-end-to-end.md) (`bl-f0b6`) | S | Low | `bl-645c` | Environment-gated (authenticated `cursor-agent` + unlocked keychain). Characterizes the ACP schema-retry path; updates README from "unverified." Feeds `bl-bb7e`. |
| [Investigate in-house peer CLI](../items/build-inhouse-peer-cli.md) (`bl-bb7e`) | L | **High** | `bl-645c` | Build-vs-buy investigation, not a committed migration. Consumes `bl-f0b6` + `bl-3a88` findings; decision hinges on how many peer providers we support. Go/no-go + phased plan or documented stay-on-Paseo. |
| [Add consensus-research skill](../items/add-consensus-research-skill.md) (`bl-645c`) | M | **High** | `bl-f0b6`, `bl-bb7e` | Last family skill. Resolve peer tool-access (do Paseo peers get tools, under what permissions?) as a DR before build — may warrant its own design pass. shared_input / parallel_synthesized / moderate agency. |

---

## Deferred fill-ins

Low-priority, independent nice-to-haves; roadmap places these in "Later" (after the family ships). Slot into gaps between higher-value work — no dependencies block them.

| Item | Scope | Planning investment | Notes |
| --- | --- | --- | --- |
| [Add deliberation metrics](../items/add-deliberation-metrics.md) (`bl-9ed4`) | S | Low | Token/cost/round/wall-clock in resolution block; degrade gracefully. Parallel-mode metrics shape is now stable. May spawn a cost-cap follow-up. |
| [Add similarity heuristic](../items/add-convergence-similarity-heuristic.md) (`bl-ef38`) | S | Low | Deterministic near-converge measure, agency-gated to moderate+. Reduces escalation on long documents. |
| [Add whole-document harmonization pass](../items/add-whole-document-harmonization-pass.md) (`bl-e39a`) | M | Med | Post-convergence cross-section pass (`--harmonize`); must compose with sequential + parallel orchestration + resume. v3 Phase 4. |

---

## Parallelism cheat sheet

Quick lookup for "can I start X while Y is in flight?"

| Can run together | Keep sequential |
| --- | --- |
| `bl-5174` ∥ `bl-d85f` | `bl-5174` before the synthesized wrappers (`bl-b9b9`/`bl-87ef`/`bl-0cb8`) — establishes the template |
| `bl-b9b9` ∥ `bl-3a88` | `bl-b9b9` before `bl-87ef` / `bl-0cb8` — front-loads cold-start + sectioning design |
| `bl-87ef` ∥ `bl-0cb8` | `bl-f0b6` before `bl-bb7e` — ACP evidence feeds the build-vs-buy call |
| `bl-645c` ∥ Paseo track (`bl-f0b6`/`bl-bb7e`) | `bl-3a88` design pass before relying on synthesized output in production |
| Any fill-in (`bl-9ed4`/`bl-ef38`/`bl-e39a`) ∥ anything | — |

---

## Suggested next kickoff stack

Three concrete actions for the next development cycle. Not a ranked list of everything — just what to do _first_.

1. **Kick off** [`bl-5174`](../items/add-consensus-evaluate-skill.md) — earliest, lowest-effort family skill; dependency shipped; proves the wrapper pattern the other four reuse.
2. **Kick off** [`bl-d85f`](../items/complete-v01-release-verification.md) — fully independent parallel track; clears the path to any public announcement at no cost to consensus work.
3. **Start design pass on** [`bl-3a88`](../items/tool-based-verdict-submission-for-consensus-peers.md) — begin the structured-output hardening design now so it lands with the synthesized-mode wrappers in Phase 2 rather than after they hit the same dogfood failures.

> Bookkeeping done (2026-06-14): the stale "merge pending" narratives have been refreshed to "merged" across the reference docs.

---

## Changelog

Append a new row each time this file is refreshed via the `oat-pjm-review-backlog` walkthrough. Keep entries short — what shifted and why.

| Date | Update |
| --- | --- |
| 2026-06-14 | Initial alignment. Both iteration modes (`bl-5d49`, `bl-7af0`) merged via #9 → all five family skills unblocked; #10 landed dev tooling (oxlint/oxfmt, hooks, worktree scripts). Phased into Family-kickoff+release / Family-fan-out+hardening / Paseo-build-vs-buy+last-skill, assuming 2–3 parallel tracks, no calendar constraints. Planning-investment column included. Flagged stale "merge pending" narratives for refresh. |
| 2026-06-14 | Refreshed the stale "merge pending" narratives → "merged to `main` via PR #9" across index overview, `completed.md`, `roadmap.md`, `current-state.md`, and DR-018/019. Roadmap Now/Next re-sequenced: `consensus-evaluate` + v0.1 release promoted to Now. |
