# Backlog Priority Alignment

**Date:** 2026-06-15
**Status:** Active — Iteration modes (`bl-5d49`, `bl-7af0`) merged via PR #9; repo dev tooling landed via PR #10 (pnpm hooks, commitlint, oxlint/oxfmt, `worktree:init`/`worktree:validate`). The next sequencing constraint is the TypeScript/vitest work (`bl-853a`, `bl-bfb4`): treat that lane as active elsewhere and avoid overlapping implementation. `consensus-evaluate` (`bl-5174`) has quick-start discovery captured in `/Users/tstang/Code/concensus-evaluate`, but is intentionally paused until the TS work lands. v0.1 release verification (`bl-d85f`) is also deferred until post-TS; PR #9 already records substantial live claude+codex mode coverage, so the later release pass should audit and reuse that evidence rather than rerun everything from scratch.

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

**Operator context (this pass):** pause consensus-family implementation until the TS/vitest branch lands; do not start the release/tag project until post-TS; likely move toward owning the claude/codex/cursor peer-invocation layer instead of Paseo, but keep that out of the current kickoff stack.

---

## Finishing / in flight

Items already started, in code review, or otherwise mid-flight. Close these out before — or alongside — the next phase.

| Item | Scope | Notes |
| --- | --- | --- |
| Refresh "merge pending" narratives (no backlog item) | S | ✅ Done 2026-06-14 — index overview, `completed.md`, `roadmap.md`, `current-state.md`, and DR-018/019 now read "merged to `main` via PR #9." |
| [Stand up TypeScript + vitest build toolchain](../items/adopt-typescript-vitest-build-toolchain.md) (`bl-853a`) / [Migrate consensus + tests to real TypeScript types](../items/migrate-consensus-tests-to-typescript-types.md) (`bl-bfb4`) | M / L | Active elsewhere. Avoid new consensus implementation work that would churn the same code/test surface until this lands. |
| [Add consensus-evaluate skill](../items/add-consensus-evaluate-skill.md) (`bl-5174`) | S | Paused. Quick-start discovery exists in `/Users/tstang/Code/concensus-evaluate`, but implementation should wait for TS/vitest so the wrapper pattern is built on the new source/test substrate. |
| PR #9 release-evidence reconciliation (no backlog item) | S | ✅ Done 2026-06-15 — PR #9 and `project-summaries/20260613-consensus-iteration-modes.md` record live claude+codex coverage across alternating, `parallel_revision`, `parallel_synthesized`, and escalation-ladder flows. Carry this evidence into `bl-d85f` so release verification reruns only stale/gap checks. |

---

## Phase 1 — Post-TS release readiness

Start this after the TS/vitest branch lands. The release task is still valuable, but it should not be interpreted as "rerun all dogfood." PR #9 already supplies substantial live-mode evidence. The post-TS release pass should verify what changed, rerun stale or gap checks, and then execute the remaining release gates.

| Item | Scope | Planning investment | Parallel with | Notes |
| --- | --- | --- | --- | --- |
| [Complete v0.1 release verification and tag](../items/complete-v01-release-verification.md) (`bl-d85f`) | M | Med | none required | Wait until TS/vitest lands. Reuse PR #9 evidence for live claude+codex mode coverage; rerun only stale/gap behavior checks, then perform the true release gates: provider install/permission checks, README install matrix, CHANGELOG/version/tag checks, release workflow, and post-tag skills.sh discovery before public claims. |

---

## Phase 2 — Resume family skill work after TS

Once the TS/vitest work lands, resume the family lane. `bl-5174` is still the right first implementation because its discovery is complete and it establishes the wrapper pattern before the synthesized-mode wrappers fan out. The cost is then front-loaded in `bl-b9b9` (resolves `independent_draft` cold start + derived-sectioning design that decide/plan reuse).

| Item | Scope | Planning investment | Parallel with | Notes |
| --- | --- | --- | --- | --- |
| [Add consensus-evaluate skill](../items/add-consensus-evaluate-skill.md) (`bl-5174`) | S | Low | none required | Resume after TS/vitest. Discovery has selected a shared consensus-core + narrow prompt-profile seam and free-form markdown evaluation output; implementation should adapt to the post-TS code layout. |
| [Add consensus-create skill](../items/add-consensus-create-skill.md) (`bl-b9b9`) | M | **High** | peer-layer design only | First synthesized-mode wrapper. Resolve `independent_draft` cold start + derived-sectioning (whole-artifact vs outline-first) up front — decide/plan inherit it. independent_draft / parallel_synthesized / maximum agency. |
| [Add consensus-decide skill](../items/add-consensus-decide-skill.md) (`bl-87ef`) | S | Low | `bl-0cb8` | Thin wrapper once `bl-b9b9` lands the cold-start groundwork. Validates the unique minimal-agency + synthesized edge (contested calls always surface). |
| [Add consensus-plan skill](../items/add-consensus-plan-skill.md) (`bl-0cb8`) | S | Low | `bl-87ef` | Thin wrapper; reuses create/decide groundwork. independent_draft / parallel_synthesized / moderate agency. |

---

## Phase 3 — Own the peer-invocation layer

This is no longer a neutral build-vs-buy curiosity. The operator lean is to own the narrow claude/codex/cursor path rather than continue depending on Paseo for a single per-turn `run` capability. It is still **not** the next project: capture the direction, then start it only when TS/vitest has landed and there is appetite for a design/spike project.

| Item | Scope | Planning investment | Parallel with | Notes |
| --- | --- | --- | --- | --- |
| [Tool-based verdict submission](../items/tool-based-verdict-submission-for-consensus-peers.md) (`bl-3a88`) | L | **High** | `bl-bb7e` | Treat with `bl-bb7e` as one "own peer invocation" initiative. Strongest design direction: peers submit validated verdicts via a tool/CLI, normalizing claude/codex/cursor and reducing schema-retry churn. |
| [Investigate in-house peer CLI](../items/build-inhouse-peer-cli.md) (`bl-bb7e`) | L | **High** | `bl-3a88` | Reframe as a design/spike toward owning the claude/codex/cursor path, porting/narrowing from the proven Stoa provider adapter and final-JSON contract. Still needs a written go/no-go and phased plan before implementation. |
| [Verify cursor-as-peer end-to-end](../items/verify-cursor-as-peer-end-to-end.md) (`bl-f0b6`) | S | Low | peer-layer discovery | Optional evidence. If moving off Paseo, this becomes less important as a Paseo-path release check and more useful only to characterize Cursor's current behavior. |
| [Add consensus-research skill](../items/add-consensus-research-skill.md) (`bl-645c`) | M | **High** | after peer-layer direction | Last family skill. Resolve peer tool-access (do peers get tools, under what permissions?) as a DR before build — may warrant its own design pass. shared_input / parallel_synthesized / moderate agency. |

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
| Board/reference updates ∥ TS/vitest branch | TS/vitest before new consensus implementation |
| `bl-d85f` release prep notes ∥ TS/vitest branch | Final release/tag verification after TS lands |
| `bl-87ef` ∥ `bl-0cb8` | `bl-5174` before synthesized wrappers (`bl-b9b9`/`bl-87ef`/`bl-0cb8`) — establishes the template |
| Peer-layer design (`bl-3a88`/`bl-bb7e`) ∥ family planning | Peer-layer implementation after TS, and after a design/spike decision |
| Any fill-in (`bl-9ed4`/`bl-ef38`/`bl-e39a`) ∥ reference/planning work | Avoid code fill-ins that churn consensus tests until TS lands |

---

## Suggested next kickoff stack

Three concrete actions for the next development cycle. Not a ranked list of everything — just what to do _first_.

1. **Wait for TS/vitest to land** (`bl-853a` / `bl-bfb4`) before new consensus implementation. Keep `bl-5174` paused, not abandoned.
2. **After TS lands, run** [`bl-d85f`](../items/complete-v01-release-verification.md) as a release verification/tag project. Reuse PR #9 live-mode evidence; focus on stale/gap checks and provider install/permission gates.
3. **Then resume** [`bl-5174`](../items/add-consensus-evaluate-skill.md), adapting the already-completed discovery to the post-TS code/test layout.

> Bookkeeping done (2026-06-14): the stale "merge pending" narratives have been refreshed to "merged" across the reference docs.
> Bookkeeping done (2026-06-15): PR #9 release-relevant live evidence was reconciled into `bl-d85f`, and peer-invocation work was reframed as a later "own claude/codex/cursor" initiative rather than a current kickoff.

---

## Changelog

Append a new row each time this file is refreshed via the `oat-pjm-review-backlog` walkthrough. Keep entries short — what shifted and why.

| Date | Update |
| --- | --- |
| 2026-06-14 | Initial alignment. Both iteration modes (`bl-5d49`, `bl-7af0`) merged via #9 → all five family skills unblocked; #10 landed dev tooling (oxlint/oxfmt, hooks, worktree scripts). Phased into Family-kickoff+release / Family-fan-out+hardening / Paseo-build-vs-buy+last-skill, assuming 2–3 parallel tracks, no calendar constraints. Planning-investment column included. Flagged stale "merge pending" narratives for refresh. |
| 2026-06-14 | Refreshed the stale "merge pending" narratives → "merged to `main` via PR #9" across index overview, `completed.md`, `roadmap.md`, `current-state.md`, and DR-018/019. Roadmap Now/Next re-sequenced: `consensus-evaluate` + v0.1 release promoted to Now. |
| 2026-06-15 | Re-sequenced around active TS/vitest work: pause `bl-5174`, defer final `bl-d85f` release/tag verification until post-TS, reuse PR #9 live-mode evidence for later release checks, and move peer-invocation ownership (`bl-3a88`/`bl-bb7e`) to a later design/spike track. |
