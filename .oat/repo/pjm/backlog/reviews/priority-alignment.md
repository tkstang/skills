# Backlog Priority Alignment

**Date:** 2026-06-23
**Status:** Active — **Major reshape post-v0.1.** The entire prior 3-track plan has shipped: **v0.1.0 released** (`bl-d85f`), **consensus-family complete** (`bl-2ed7` → `bl-b9b9` → `bl-87ef` + `bl-0cb8`), **provider-CLI hardening done** (`bl-3a88` + `bl-3291`, DR-024), and **docs IA stood up** (`bl-ecaa`, DR-025). The board is now **15 active items with nothing in flight**. Verified this pass: `bl-1f9c` (de-flake watch tests) did **not** ship and stays a Phase 1 quick win.

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

**Operator context (this pass):** capacity is **2–3 parallel worktrees**, sized to the work; order purely **by leverage** (no calendar/freeze constraints). The full v0.1 foundation (release, consensus-family, provider-CLI hardening, docs IA) is closed and archived, so this plan is no longer optimizing around those gates — it sequences the remaining 15 items. The docs site exists, so each new skill project documents itself into the site via `oat-project-document`, not the README. `bl-22d3` (phone-a-friend) is **pulled up into Phase 1** as a parallel feature track — it is independent and the old "no 4th concurrent track" constraint died with the release/family/hardening ships — and stays sequenced **before** `bl-645c` (consensus-research), which needs a peer tool-access DR first. `bl-3913` (rubric-cap guard) moved down to Phase 2 to keep Phase 1 within the worktree budget.

---

## Finishing / in flight

**Nothing is mid-flight.** No started or in-review feature branch exists; the only working-tree change is this backlog-review refresh itself. The prior alignment's entire "in flight" set (`bl-d85f` release, consensus-family, provider-CLI hardening, docs IA) is complete and archived. Phase 1 is therefore a clean start, not a continuation.

---

## Phase 1 — Public surface, reliability, and the advisory peer

The roadmap-Now discovery gate, the highest-value reliability quick win, and the next product skill — pulled up together because all three are independent and touch **disjoint surfaces** (OAT sync/discovery vs `session-observer` tests vs a new provider-CLI skill). This fits the 2–3 worktree budget: `bl-1f9c` is a quick win that doesn't consume a full cycle, and the rubric-cap guard moved to Phase 2 to make room. The old "no 4th concurrent track" constraint on `bl-22d3` is obsolete now that release + family + hardening have shipped.

| Item | Scope | Planning investment | Parallel with | Notes |
| --- | --- | --- | --- | --- |
| [Control public skill discovery surface on skills.sh](../items/control-public-skill-discovery-surface.md) (`bl-7c1d`) | M | Med | `bl-1f9c`, `bl-22d3` | Only active item tied to the roadmap-Now post-tag discovery gate. OAT sync handling for `.agents/skills/**`, consensus self-redirects, version bumps, generated output, live discovery verification. **Blocks any public skills.sh / marketplace claim** until it lands. Settle its discovery posture early so `bl-22d3` can ship into it. |
| [De-flake the session-observer watch test suite](../items/deflake-session-observer-watch-tests.md) (`bl-1f9c`) | S | Low | `bl-7c1d`, `bl-22d3` | **Quick win — verified not shipped.** Tight `maxRuntimeMin` budgets + a SIGTERM subprocess race in `tests/session-observer/watch.test.ts`. The flake already hit the v0.1 tag push/PR validation. Test-only; keep baseline-emission and teardown assertions. Bank `bl-3913` in this same worktree if convenient. |
| [Add phone-a-friend advisory peer skill](../items/add-phone-a-friend-advisory-peer-skill.md) (`bl-22d3`) | M | Med | `bl-7c1d`, `bl-1f9c` | **Pulled up from Phase 2.** Independent; provider CLI + docs site already exist. Resolve `phone-a-friend` vs `phone-friend` naming, recursion/self-spawn safety, default cross-provider peer selection, host disposition step. **Soft guard:** let `bl-7c1d`'s discovery-posture decision land before this skill *ships* so it is born into the right discovery story (they can still start concurrently). First validation that the docs IA absorbs a new skill cleanly. |

---

## Phase 2 — Packaging spike + banked guardrail

A maintainability spike plus the cheap rubric guardrail that slid down from Phase 1. Neither is on the critical path; `bl-e0e7` is a spike, not a commitment — it may decide to keep duplication.

| Item | Scope | Planning investment | Parallel with | Notes |
| --- | --- | --- | --- | --- |
| [Share consensus generated runtime output at the plugin level](../items/share-consensus-generated-runtime-output.md) (`bl-e0e7`) | M | Med | — | Maintainability spike: collapse per-skill `consensus-loop.mjs` to one plugin-local shared script, gated by a 4-host install spike. **Not concurrent with any consensus-loop feature branch** (shared generated output). Spike informed by the `bl-d85f` install work; may keep duplication. |
| [Add a test guarding bundled rubric examples at ≤12 parser-visible criteria](../items/add-rubric-example-criteria-cap-guard.md) (`bl-3913`) | S | Low | `bl-e0e7` | **Moved down from Phase 1.** Trivial Vitest guard under `tests/consensus/evaluate/`; no runtime or example-content change. The phase label is priority, not a prohibition — **bank it in the `bl-1f9c` worktree if that suite is already open** rather than waiting. |

---

## Phase 3 — Design-gated consensus expansion

Both items are small-to-moderate builds carrying real upfront design weight. Each starts with a recorded decision, not a sprint.

| Item | Scope | Planning investment | Parallel with | Notes |
| --- | --- | --- | --- | --- |
| [Add consensus-research skill](../items/add-consensus-research-skill.md) (`bl-645c`) | M | **High** | `bl-e39a` (separate project) | Last family skill. Resolve peer tool-access / evidence-capture / permissions as a **DR before build**. Uses `shared_input`, so **not** gated on `independent_draft`. Keep as its own OAT project. |
| [Add whole-document harmonization pass after section convergence](../items/add-whole-document-harmonization-pass.md) (`bl-e39a`) | M | Med | `bl-645c` | v3 Phase 4 quality work. Decide context-bounding first (assembled document only vs document + section logs); composes with sequential + parallel + resume. |

---

## Phase 4 — Multi-agent collaboration substrate

A new lane beneath the deliberation engine (observe + message peers on one project, extending `session-observer`). Dependency-unblocked now that the TS/test foundation and family work have landed, but **capacity-heavy** — a full design/build initiative, strictly sequential within the lane. Start only when there is appetite for an initiative, not as incidental follow-up.

| Item | Scope | Planning investment | Parallel with | Notes |
| --- | --- | --- | --- | --- |
| [Shared session log substrate](../items/shared-session-log-substrate.md) (`bl-4e2e`) | L | **High** | consensus work (disjoint) | Foundation: become-observable daemon + merged log + `.consensus/` state + identity. ~6 open design questions; adopt-vs-build (`cass`) decision. **Design pass first.** Blocks `bl-f59f`. |
| [Inter-agent direct messaging](../items/inter-agent-direct-messaging.md) (`bl-f59f`) | M | **High** | — | Addressable, prioritized messages checked before ambient catch-up. Reuses substrate identity/state; needs `bl-4e2e` (hard block). |

---

## Deferred fill-ins & decision seeds

Low-priority and independent. Fill-ins slot into gaps; decision seeds need a recorded verdict before any build (several may resolve `wont_do`). The count overstates the real build queue.

| Item | Scope | Planning investment | Notes |
| --- | --- | --- | --- |
| [Add deliberation metrics](../items/add-deliberation-metrics.md) (`bl-9ed4`) | S | Low | Quick win by quadrant but roadmap-Later; **kept deferred this pass.** Token/cost/round/wall-clock in the resolution block; degrade gracefully when provider data is unavailable. Pull in when there's room. |
| [Add similarity heuristic](../items/add-convergence-similarity-heuristic.md) (`bl-ef38`) | S | Low | Deterministic near-converge measure, agency-gated to moderate+. Fill-in when nearby loop work is open. |
| [LLM section auto-chunking fallback](../items/llm-section-auto-chunking.md) (`bl-db5d`) | S | Low | **Decision-first** (may `wont_do`). Whole-document fallback already exists. |
| [Mid-loop user artifact edits](../items/mid-loop-user-artifact-edits.md) (`bl-58b3`) | S | Low | **Decision-first** (may `wont_do`). Existing artifact-edit-then-resume may be enough. |
| [Define host-native dispatch / safe-packet protocol](../items/define-host-native-dispatch-safe-packet-protocol.md) (`bl-3ca6`) | L | **High** | **Go/no-go first** (likely defer). Reserved seam; no current host-native need. |
| [Multi-peer (3+) deliberation extension](../items/multi-peer-deliberation-extension.md) (`bl-f8cb`) | L | **High** | **Go/no-go first** (likely defer). Speculative; needs evidence two peers are insufficient. |

---

## Suggested OAT project groupings

Run cohesive arcs as a single OAT project rather than separate tickets:

| Proposed project | Items | Why one project |
| --- | --- | --- |
| **consensus-research** (separate) | `bl-645c` | Own peer tool-access DR; kept out of any other project so that decision doesn't block unrelated work. |
| **multi-agent-substrate** | `bl-4e2e` → `bl-f59f` | One initiative; shared identity/state primitive + a single adopt-vs-build (`cass`) decision. |
| Standalone tasks (not projects) | `bl-7c1d`, `bl-1f9c`, `bl-3913`, `bl-22d3`, `bl-e0e7`, fill-ins, seeds | Single-arc tasks or decisions; project ceremony would be overhead. |

---

## Parallelism cheat sheet

Quick lookup for "can I start X while Y is in flight?" (capacity: 2–3 worktrees).

| Can run together | Keep sequential |
| --- | --- |
| `bl-7c1d` ∥ `bl-1f9c` ∥ `bl-22d3` (disjoint surfaces; fits 2–3 worktrees since `bl-1f9c` is a quick win) | `bl-7c1d` discovery-posture decision before `bl-22d3` *ships* (soft) — new skill should land into the right posture |
| `bl-3913` banks in the `bl-1f9c` worktree (same Vitest suite) — do it whenever that worktree is open | `bl-22d3` before `bl-645c` (operator sequencing — feature first, then research) |
| Substrate lane (`bl-4e2e` → `bl-f59f`) ∥ consensus work (disjoint surface) | `bl-e0e7` **not concurrent** with any consensus-loop-touching branch (shared generated output) |
| — | `bl-645c` DR / `bl-e39a` context-bounding decision before their builds |
| — | `bl-4e2e` before `bl-f59f` (hard block) |

---

## Suggested next kickoff stack

Three concrete actions for the next development cycle. Not a ranked list of everything — just what to do _first_.

1. **Kick off** [`bl-7c1d`](../items/control-public-skill-discovery-surface.md) (Control public skill discovery surface on skills.sh) — the only roadmap-Now gate; blocks any public skills.sh / marketplace claim until verified. Settle its discovery-posture decision early so `bl-22d3` can ship into it.
2. **Kick off** [`bl-1f9c`](../items/deflake-session-observer-watch-tests.md) (De-flake the session-observer watch test suite), banking [`bl-3913`](../items/add-rubric-example-criteria-cap-guard.md) (rubric criteria cap guard) in the same test worktree — `bl-1f9c` removes the flake that hit the v0.1 tag push.
3. **Kick off** [`bl-22d3`](../items/add-phone-a-friend-advisory-peer-skill.md) (phone-a-friend advisory peer) as a parallel feature track — independent and buildable now; just land `bl-7c1d`'s discovery-posture decision before it ships.

> Then: design-gate `bl-645c` (consensus-research) and `bl-e39a` (harmonization) behind their decisions; treat the multi-agent substrate (`bl-4e2e` → `bl-f59f`) as a separate initiative to start when there's appetite.

---

## Changelog

Append a new row each time this file is refreshed via the `oat-pjm-review-backlog` walkthrough. Keep entries short — what shifted and why.

| Date | Update |
| --- | --- |
| 2026-06-14 | Initial alignment. Both iteration modes (`bl-5d49`, `bl-7af0`) merged via #9 → all five family skills unblocked; #10 landed dev tooling. Phased into Family-kickoff+release / Family-fan-out+hardening / Paseo-build-vs-buy+last-skill. Planning-investment column included. Flagged stale "merge pending" narratives. |
| 2026-06-14 | Refreshed stale "merge pending" narratives → "merged via PR #9" across reference docs. Roadmap Now/Next re-sequenced. |
| 2026-06-15 | Re-sequenced around active TS/vitest work: paused `bl-5174`, deferred `bl-d85f` until post-TS, moved peer-invocation ownership (`bl-3a88`/`bl-bb7e`) to a later design/spike track. |
| 2026-06-20 | **Major reshape.** TS foundation landed (#13–19); owned provider CLI shipped (#22–24, DR-023) → `bl-bb7e` done, Paseo framing retired, peer-invocation reframed as *hardening*. `bl-5174` + `bl-f0b6` done. 11 new items folded in. Re-phased and verified `bl-d85f` untagged. Added OAT-project groupings. |
| 2026-06-20 | **Committed 3-track plan.** `bl-d85f` now in flight (finishing pass, release worktree). Active tracks: **consensus-family** (`bl-2ed7`→`bl-b9b9`→`bl-87ef`+`bl-0cb8`, one project) ∥ **provider-cli-hardening** (`bl-3a88` design-first + `bl-3291`, disjoint surface). Promoted **docs IA** (`bl-ecaa`) to immediate post-tag; `bl-22d3` (phone-a-friend) sequenced after docs IA. Recorded `bl-e0e7`-not-concurrent-with-family constraint. |
| 2026-06-23 | **Major reshape post-v0.1.** Prior 3-track plan fully shipped and archived: v0.1.0 released (`bl-d85f`); consensus-family done (`bl-2ed7`/`bl-b9b9`/`bl-87ef`/`bl-0cb8`); provider-CLI hardening done (`bl-3a88`/`bl-3291`, DR-024); docs IA stood up (`bl-ecaa`, DR-025). Reshaped the remaining 15 active items into 4 phases + deferred. Verified `bl-1f9c` (de-flake watch tests) did **not** ship. Capacity held at 2–3 worktrees; planning-investment column retained; `bl-9ed4` left deferred; `bl-645c` kept behind its peer tool-access DR; `bl-22d3` before `bl-645c`. **Rebalance:** pulled `bl-22d3` (phone-a-friend) up into Phase 1 as a parallel feature track (the old "no 4th track" ban is obsolete) and pushed `bl-3913` (rubric guard) down to Phase 2, since the small Phase 1 test items left room. Added a soft guard: settle `bl-7c1d`'s discovery posture before `bl-22d3` ships. "Finishing / in flight" now empty. |
