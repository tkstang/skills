# Backlog Priority Alignment

**Date:** 2026-07-05
**Status:** Active — **Consolidation cycle committed post-panel/config ship; Track 2 closed.** The hosted discovery check is done and the decision sweep is complete. The board is **10 open items with nothing in flight**. This cycle now centers on the open generated-output dedup window, then the loop-quality batch. Research DR and the substrate initiative remain explicitly held for later cycles.

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

**Operator context (this pass):** capacity is **2–3 parallel worktrees**; order by leverage, no calendar constraints. Cycle shape chosen in the walkthrough: **consolidation (Option A)** — the dedup window is the one time-sensitive thing on the board, so it anchors Track 1. The **consensus-research DR is deferred to next cycle** (keep this cycle purely consolidation). **Track 2 is closed**: hosted discovery is done, mid-loop edit and auto-chunking decisions are archived `wont_do`, and the multi-round-panel product distinction is recorded. The **substrate initiative is held** for a deliberate start with initiative-level appetite, not as a third-track afterthought. The two reserved seeds stay parked with no go/no-go ceremony — their guard value is already delivered.

---

## Finishing / in flight

**Nothing is mid-flight.** The only open work is this alignment/hygiene pass itself (branch `review-backlog-july-4`, plus the cherry-picked `pjm-guidance` commits: Backlog Lifecycle contract, pointer-stub migration, retroactive `BL-260621` close-out). Phase 1 is a clean start.

---

## Phase 1 — Packaging window + release closeout

Track 2 is complete (hosted-index verification plus the decision sweep). Track 1 remains because the dedup item's no-concurrency constraint is satisfied **right now** — nothing consensus-loop-touching is in flight for the first time since the item was written, and the duplication has grown to 5 loop copies + 6 config copies.

| Item | Scope | Planning investment | Parallel with | Notes |
| --- | --- | --- | --- | --- |
| [Share consensus generated runtime output at the plugin level](../items/BL-260620-share-consensus-generated.md) (`BL-260620-share-consensus-generated`) | M | Med | nothing loop-touching | **Track 1 — the cycle anchor.** 4-host install spike (Claude/Codex/Cursor/Copilot) is the real work and a genuine go/no-go; the code change is small. Must also cover the `~/.consensus/` resolver fallback + `install.sh` shipped by PR #38. A documented "keep duplication" outcome is a legitimate close — don't let it linger half-open. **Nothing loop-touching starts until this lands or closes.** |
| [Verify skills.sh hosted discovery surface and listing strategy](../archived/BL-260627-verify-skills-sh-hosted.md) (`BL-260627-verify-skills-sh-hosted`) | S | Done | — | Closed 2026-07-05. The hosted index is telemetry-only; strategy and guardrails are recorded in `current-state.md` and `DR-260705-skills-sh-listing-is-telemetry`. |
| **Decision sweep**: [Mid-loop user artifact edits](../archived/BL-260620-mid-loop-user-artifact-edits.md) (`BL-260620-mid-loop-user-artifact-edits`), [LLM section auto-chunking fallback](../archived/BL-260620-llm-section-auto-chunking.md) (`BL-260620-llm-section-auto-chunking`), and [Add multi-round panel discussion](../items/BL-260701-add-multi-round-panel.md) (`BL-260701-add-multi-round-panel`) product distinction | S | Done | — | Completed 2026-07-07. Mid-loop edit and auto-chunking resolved `wont_do`; multi-round panel remains open only for the evidence-gated build. |

---

## Phase 2 — Loop-quality batch

One worktree, strictly sequential, opening **only after Phase 1's dedup track lands or closes** — every item here regenerates loop output. Batched so the loop core is opened once, not three times.

| Item | Scope | Planning investment | Parallel with | Notes |
| --- | --- | --- | --- | --- |
| [Add deliberation metrics (tokens, wall-clock, rounds) to artifacts](../items/BL-260612-add-deliberation-metrics.md) (`BL-260612-add-deliberation-metrics`) | S | Low | — (same worktree as similarity) | First post-dedup loop change. Partial scaffolding exists (`LoopStatus` turns/rounds + `cost_source`/`approximate_cost_usd`); the provider envelope exposes **no token/cost data** yet, so half the work is investigating what each provider CLI can emit and degrading gracefully. Record the cost-cap feasibility note per the item. |
| [Add similarity heuristic for near-converged deliberation states](../items/BL-260612-add-similarity-heuristic.md) (`BL-260612-add-similarity-heuristic`) | S | Low | — | Bank in the same worktree as metrics — same loop-core neighborhood. Deterministic algorithm + threshold, agency-gated (moderate+), audit-disclosed in turn records. |
| [Add whole-document harmonization pass after section convergence](../items/BL-260612-add-whole-document.md) (`BL-260612-add-whole-document`) | M | Med | — | **Decision-first, build by appetite.** Record the context-bounding decision (lean assembled-doc-only per v2/v3) at the tail of this phase; the build is the largest loop-quality item (composes with sequential + parallel + resume) and may slip to Phase 3 if the cycle runs long. |

---

## Phase 3 — Design-gated consensus expansion (next cycle)

Deliberately **not** started this cycle (operator decision this pass). Each item begins with a recorded decision, not a sprint.

| Item | Scope | Planning investment | Parallel with | Notes |
| --- | --- | --- | --- | --- |
| [Add consensus-research skill](../items/BL-260612-add-consensus-research-skill.md) (`BL-260612-add-consensus-research-skill`) | M | **High** | harmonization build (if slipped) | Last family skill; roadmap-Next. Peer tool-access / evidence-capture / permissions DR **before** build — the DR may reshape the provider CLI contract. Keep as its own OAT project. The build must not run concurrently with other loop-touching work. |
| [Add whole-document harmonization pass](../items/BL-260612-add-whole-document.md) (`BL-260612-add-whole-document`) — build, if not taken in Phase 2 | M | Med | `BL-260612-add-consensus-research-skill` DR (not its build) | Carries forward with its context-bounding decision already recorded. |

---

## Phase 4 — Multi-agent collaboration substrate (appetite-gated initiative)

A separate lane on a disjoint surface (session-observer / transcript tooling). Dependency-unblocked, but **held** until there is explicit appetite for an initiative — it should displace a track knowingly, not fill one incidentally.

| Item | Scope | Planning investment | Parallel with | Notes |
| --- | --- | --- | --- | --- |
| [Shared session log substrate](../items/BL-260619-shared-session-log-substrate.md) (`BL-260619-shared-session-log-substrate`) | L | **High** | consensus work (disjoint surface) | Foundation: become-observable daemon + merged log + project-scoped state + agent identity. ~6 open design questions incl. adopt-vs-build on `cass` and packaging. **Design pass + DR first.** Blocks messaging. |
| [Inter-agent direct messaging](../items/BL-260619-inter-agent-direct-messaging.md) (`BL-260619-inter-agent-direct-messaging`) | M | **High** | — | Hard-blocked behind the substrate. Build-vs-adopt decision (Agent Mail / `mcp-agent-mail`) recorded before build. |

---

## Deferred / parked

| Item | Scope | Notes |
| --- | --- | --- |
| [Add multi-round panel discussion](../items/BL-260701-add-multi-round-panel.md) (`BL-260701-add-multi-round-panel`) — build | M | Panel v1 shipped 2026-07-03; the build waits for usage evidence that single-round breadth is insufficient. The product distinction is recorded: future multi-round must remain opt-in, attributed, and non-converging. Panel workflow is strictly single-shot today — multi-round is a real build, not a bolt-on. |
| [Define host-native dispatch / safe-packet protocol](../items/BL-260619-define-host-native-dispatch.md) (`BL-260619-define-host-native-dispatch`) | L | **Parked, no go/no-go ceremony** (operator decision this pass) — the seed's guard value (preventing a reserved flag flip without a contract) is already delivered. Revisit only on a concrete dispatch need. |
| [Multi-peer (3+) deliberation extension](../items/BL-260619-multi-peer-3-deliberation.md) (`BL-260619-multi-peer-3-deliberation`) | L | **Parked.** The panel ship weakened the near-term case further — "hear from 3+ providers" is now served without convergence surgery. Revisit only with evidence two peers are insufficient. |

---

## Parallelism cheat sheet

Quick lookup for "can I start X while Y is in flight?" (capacity: 2–3 worktrees).

| Can run together | Keep sequential |
| --- | --- |
| `BL-260620-share-consensus-generated` ∥ `BL-260627-verify-skills-sh-hosted` (disjoint: build tooling vs hosted-index checks) | **Nothing loop-touching** ∥ `BL-260620-share-consensus-generated` — the dedup window is the point of this cycle |
| Decision sweep is done (item updates only, no code) | Phase 2 loop-quality can open after `BL-260620-share-consensus-generated` lands or closes |
| Substrate lane ∥ consensus work (disjoint surface) — *when* it starts | `BL-260612-add-deliberation-metrics` → `BL-260612-add-similarity-heuristic` → harmonization (one worktree, one loop-core opening) |
| Harmonization *decision* ∥ Phase 1 tracks | `BL-260619-shared-session-log-substrate` before `BL-260619-inter-agent-direct-messaging` (hard block) |
| — | `BL-260612-add-consensus-research-skill` DR before its build; build not concurrent with other loop work |

---

## Suggested OAT project groupings

| Proposed project | Items | Why one project |
| --- | --- | --- |
| **consensus-packaging** | `BL-260620-share-consensus-generated` | Spike + go/no-go + build in one arc; the spike evidence is the deliverable either way. |
| **loop-quality** | `BL-260612-add-deliberation-metrics` → `BL-260612-add-similarity-heuristic` (+ `BL-260612-add-whole-document` decision) | One loop-core opening, one regeneration arc, shared test surface. |
| **consensus-research** (next cycle, separate) | `BL-260612-add-consensus-research-skill` | Own peer tool-access DR; kept separate so the decision doesn't block unrelated work. |
| **multi-agent-substrate** (appetite-gated) | `BL-260619-shared-session-log-substrate` → `BL-260619-inter-agent-direct-messaging` | One initiative; shared identity/state primitive + a single adopt-vs-build decision. |
| Standalone tasks (completed) | `BL-260627-verify-skills-sh-hosted`, decision sweep | Closed without project ceremony; remaining active work should use the project groupings above. |

---

## Suggested next kickoff stack

Three concrete actions for the next development cycle. Not a ranked list of everything — just what to do _first_.

> Each kickoff-stack item has a one-shot kickoff prompt under [`../../handoffs/`](../../handoffs/) — create a worktree per item and pass the handoff as context to `/oat-project-quick-start`. Handoffs are deleted in the PR that ships their item (see **Project Kickoff Handoffs** in [`../../AGENTS.md`](../../AGENTS.md)).

1. **Kick off** [`BL-260620-share-consensus-generated`](../items/BL-260620-share-consensus-generated.md) (share consensus generated runtime output) — the cycle anchor; the no-concurrency window is open now and the duplication is 5 loop + 6 config copies. Spike first; a documented "keep duplication" close is a valid outcome.
2. **Queue** the loop-quality worktree ([`BL-260612-add-deliberation-metrics`](../items/BL-260612-add-deliberation-metrics.md) metrics → [`BL-260612-add-similarity-heuristic`](../items/BL-260612-add-similarity-heuristic.md) similarity) to open **the moment the dedup track lands or closes** — with the harmonization context-bounding decision at its tail.
3. **Keep** [`BL-260612-add-consensus-research-skill`](../items/BL-260612-add-consensus-research-skill.md) (consensus-research) for next cycle's peer tool-access DR unless the consolidation cycle finishes early with appetite for a design-only lane.

> Then, next cycle: the `consensus-research` peer tool-access DR (`BL-260612-add-consensus-research-skill`), the harmonization build if it slipped, and — with deliberate appetite — the substrate initiative (`BL-260619-shared-session-log-substrate` → `BL-260619-inter-agent-direct-messaging`).

---

## Changelog

Append a new row each time this file is refreshed via the `oat-pjm-review-backlog` walkthrough. Keep entries short — what shifted and why.

| Date | Update |
| --- | --- |
| 2026-07-07 | **Decision sweep completed.** `BL-260620-mid-loop-user-artifact-edits` and `BL-260620-llm-section-auto-chunking` resolved `wont_do` and moved to `backlog/archived/`; `BL-260701-add-multi-round-panel` now records the product distinction while the build remains evidence-gated. Track 2 is closed, board is 10 open items, and the next active move is the generated-runtime dedup spike before loop-quality work. |
| 2026-06-14 | Initial alignment. Both iteration modes (`bl-5d49`, `bl-7af0`) merged via #9 → all five family skills unblocked; #10 landed dev tooling. Phased into Family-kickoff+release / Family-fan-out+hardening / Paseo-build-vs-buy+last-skill. Planning-investment column included. Flagged stale "merge pending" narratives. |
| 2026-06-14 | Refreshed stale "merge pending" narratives → "merged via PR #9" across reference docs. Roadmap Now/Next re-sequenced. |
| 2026-06-15 | Re-sequenced around active TS/vitest work: paused `bl-5174`, deferred `bl-d85f` until post-TS, moved peer-invocation ownership (`bl-3a88`/`bl-bb7e`) to a later design/spike track. |
| 2026-06-20 | **Major reshape.** TS foundation landed (#13–19); owned provider CLI shipped (#22–24, DR-023) → `bl-bb7e` done, Paseo framing retired, peer-invocation reframed as *hardening*. `bl-5174` + `bl-f0b6` done. 11 new items folded in. Re-phased and verified `bl-d85f` untagged. Added OAT-project groupings. |
| 2026-06-20 | **Committed 3-track plan.** `bl-d85f` now in flight (finishing pass, release worktree). Active tracks: **consensus-family** (`bl-2ed7`→`bl-b9b9`→`bl-87ef`+`bl-0cb8`, one project) ∥ **provider-cli-hardening** (`bl-3a88` design-first + `bl-3291`, disjoint surface). Promoted **docs IA** (`bl-ecaa`) to immediate post-tag; `bl-22d3` (phone-a-friend) sequenced after docs IA. Recorded `bl-e0e7`-not-concurrent-with-family constraint. |
| 2026-06-23 | **Major reshape post-v0.1.** Prior 3-track plan fully shipped and archived. Reshaped the remaining 15 active items into 4 phases + deferred. Verified `bl-1f9c` (de-flake watch tests) did **not** ship. Pulled `bl-22d3` (phone-a-friend) up into Phase 1; pushed `bl-3913` (rubric guard) down to Phase 2. Soft guard: settle `bl-7c1d`'s discovery posture before `bl-22d3` ships. "Finishing / in flight" empty. |
| 2026-07-05 | **Consolidation cycle committed.** The entire 2026-06-23 Phase 1 stack shipped (discovery control PR #38, de-flake + rubric guard PR #37, phone-a-friend, panel + config PR #40). Board now 13 open items, nothing in flight. This pass: **Phase 1** = dedup spike (`BL-260620-share-consensus-generated`, window open — duplication grew to 5 loop + 6 config copies) ∥ hosted-discovery check (`BL-260627-verify-skills-sh-hosted`) with the **decision sweep banked after it**; **Phase 2** = loop-quality batch (metrics → similarity, harmonization decision-first). **Research DR deferred to next cycle** (operator decision); **substrate held** for deliberate initiative start; **reserved seeds parked with no go/no-go ceremony**. Capacity held at 2–3 worktrees. Alignment pass also landed the Backlog Lifecycle contract, retroactive `BL-260621` close-out, pointer-stub validator sweep, and roadmap refresh. |
