# Backlog Priority Alignment

**Date:** 2026-06-20
**Status:** Active — Major board inflection since the 2026-06-15 pass, now with a committed 3-track plan. The TypeScript/Vitest foundation fully landed (PRs #13–19), so the "pause everything until TS lands" constraint is **gone**. The owned `consensus` provider CLI shipped (PRs #22–24, DR-023), so peer invocation is no longer build-vs-buy — `bl-bb7e` is done and the old Paseo framing is retired. `consensus-evaluate` (`bl-5174`) and Cursor authenticated peer E2E (`bl-f0b6`) are done. **`bl-d85f` (v0.1 tag) is now in flight** in a release worktree (finishing pass — automated gates + Cursor E2E already green; remaining = interactive prompts + tag + post-tag discovery). Three tracks committed: **consensus-family**, **provider-cli-hardening**, and **docs IA** (post-tag).

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

**Operator context (this pass):** capacity is **2–3 parallel worktrees**, sized to the work; order purely **by leverage** (no calendar constraints). Group related items into **OAT projects** (see "Suggested OAT project groupings"). Tracks are kicked off as quick-start or spec-driven OAT projects on their own worktrees. **Documentation is part of each project's development:** once the docs site exists, a project's `oat-project-document` step targets the **docs site**, not the README — so docs IA must land before the family project finishes, but it does not gate *building* new skills. The only dev-tooling work in flight is **skill version-bump validation + enforcement** (no backlog item).

---

## Finishing / in flight

Items already started, in code review, or otherwise mid-flight. Close these out before — or alongside — the next phase.

| Item | Scope | Notes |
| --- | --- | --- |
| [Complete v0.1 release verification and tag](../items/complete-v01-release-verification.md) (`bl-d85f`) | Remaining: S | **In flight** in a release worktree. Finishing pass — reuse PR #24 evidence (automated gates + Cursor E2E verified). Remaining gates only: interactive provider permission prompts, CHANGELOG/version/tag, README install matrix, push tag + green `release.yml`, post-tag skills.sh discovery. |
| Skill version-bump validation + enforcement (no backlog item) | S–M | In progress. Dev-tooling: assert shipped-skill `version` / `metadata.version` bump on modification (per repo convention + `validate.mjs`/`bump-version.mjs`/`SKILL_FILES`). Same surface as `bl-3913`. Consider filing a backlog item. |
| Refresh stale references (no backlog item) | S | ✅ This pass (2026-06-20): rewrote `backlog-and-roadmap-review.md`; revised `bl-d85f` to a finishing-pass scope pointing at the `RELEASING.md` snapshot; fixed `current-state.md` Cursor status + `completed.md` present-tense "blocked"; corrected `bl-3913` `node:test` → Vitest. `roadmap.md`/`index.md` were already current and re-sequenced this pass. |

---

## Phase 1 — Ship the v0.1 tag *(in flight)*

The single highest-priority item and closest to done; already running in its own worktree. Independent of all consensus development. When it lands, the freed worktree goes to **Phase 4 (docs IA)**.

| Item | Scope | Planning investment | Parallel with | Notes |
| --- | --- | --- | --- | --- |
| [Complete v0.1 release verification and tag](../items/complete-v01-release-verification.md) (`bl-d85f`) | M (remaining: S) | Low | family + hardening | Remaining gates only — see Finishing/in flight. Stop before outward-facing steps (tag push, public discovery). |

---

## Phase 2 — Consensus family *(active track)*

The synthesized-mode wrappers over `consensus-loop`, run as **one OAT project**. `bl-2ed7` (`independent_draft`) is the gate and is co-designed with `bl-b9b9` (the cold-start has no observable behavior without a consumer, and create owns the derived-sectioning design). Decide/plan then fall out as thin wrappers. `bl-645c` (research) is a **separate** project. Source surface: `src/consensus/core/consensus-loop.ts` (+ the new wrapper skills).

| Item | Scope | Planning investment | Parallel with | Notes |
| --- | --- | --- | --- | --- |
| [Implement independent_draft cold-start](../items/independent-draft-cold-start-strategy.md) (`bl-2ed7`) | M | Med | hardening track | Gate. Shared `consensus-loop` capability across all iteration modes; co-design with `bl-b9b9`. |
| [Add consensus-create skill](../items/add-consensus-create-skill.md) (`bl-b9b9`) | M | **High** | hardening track | Carries the project's design weight: resolve derived-sectioning (whole-artifact vs outline-first) up front — decide/plan inherit it. independent_draft / parallel_synthesized / maximum agency. |
| [Add consensus-decide skill](../items/add-consensus-decide-skill.md) (`bl-87ef`) | S | Low | `bl-0cb8` | Thin wrapper after the gate + sectioning groundwork. Validates the unique minimal-agency + synthesized edge. |
| [Add consensus-plan skill](../items/add-consensus-plan-skill.md) (`bl-0cb8`) | S | Low | `bl-87ef` | Thin wrapper; reuses create/decide groundwork. |
| [Add consensus-research skill](../items/add-consensus-research-skill.md) (`bl-645c`) | M | **High** | — (separate project) | Last family skill, lowest priority. Resolve peer tool-access as a DR before build. Uses `shared_input`, so **not** gated on `bl-2ed7`. Keep out of the create/decide/plan project. |

---

## Phase 3 — Provider-CLI hardening *(active track)*

Hardening on top of the shipped owned CLI, run as **one OAT project**. Source surface `src/consensus/provider-cli/` is **disjoint from the family lane**, so the two run concurrently without churn. Do `bl-3a88`'s **design pass first** — the verdict-submission decision should be made before the synthesized-mode family wrappers fan out (the gate + sectioning design provide that runway).

| Item | Scope | Planning investment | Parallel with | Notes |
| --- | --- | --- | --- | --- |
| [Tool-based verdict submission](../items/tool-based-verdict-submission-for-consensus-peers.md) (`bl-3a88`) | L | **High** | family track | Highest-leverage durability fix for structured-output fragility. Design pass first (MCP tool vs CLI; verdict capture; composition with the deterministic engine), then build. De-risks the family synthesized wrappers. |
| [Refine provider-exit retry classification](../items/refine-provider-exit-retry-classification.md) (`bl-3291`) | M | Med | family track | Strictly-additive ride-along on the same surface: signature-match transient (429/rate-limit/interrupted) vs terminal exits; unknown exits keep current behavior. |

---

## Phase 4 — Docs IA *(immediate post-tag; lands before the family finishes)*

The README has become unreadably dense. Stand up the docs site and slim the README. **Gated after the tag** (`bl-d85f`) because the README install matrix is a tag-time gate — moves into the freed release worktree. Must land **before the family project finishes** so the family documents itself into the site via `oat-project-document`. The OAT docs skills propose the IA, so this is tool-assisted curation, not a from-scratch design exercise.

| Item | Scope | Planning investment | Parallel with | Notes |
| --- | --- | --- | --- | --- |
| [Stand up a documentation site and slim the README](../items/stand-up-documentation-site-slim-readme.md) (`bl-ecaa`) | M | Med | family + hardening | Single OAT project, two phases: scaffold via the user-invoked `/oat-docs-bootstrap` (Fumadocs vs MkDocs), then migrate/curate via `oat-docs-analyze`/`oat-docs-apply`. README reduces to entry point + install matrix + links. Do not regress the `bl-d85f` install-matrix gate. |

---

## Phase 5 — Advisory peer (phone-a-friend)

A self-contained one-shot second-opinion skill over the provider CLI. Buildable any time, but sequenced **after docs IA** so it documents directly into the new site and becomes the first validation that the IA absorbs a new skill cleanly. **Not** a 4th concurrent track while release + family + hardening are live.

| Item | Scope | Planning investment | Parallel with | Notes |
| --- | --- | --- | --- | --- |
| [Add phone-a-friend advisory peer skill](../items/add-phone-a-friend-advisory-peer-skill.md) (`bl-22d3`) | M | Med | post-docs-IA | Resolve `phone-a-friend` vs `phone-friend` naming; specify recursion/self-spawn safety; default cross-provider peer selection; host disposition step. |

---

## Later — multi-agent collaboration substrate

A new lane beneath the deliberation engine (observe + message peers on one project, extending `session-observer`). Its "after TS hardening" gate is satisfied. Initiative with a design pass + DR; strictly sequential within the lane. Promote when there's appetite after the family + docs land.

| Item | Scope | Planning investment | Notes |
| --- | --- | --- | --- |
| [Shared session log substrate](../items/shared-session-log-substrate.md) (`bl-4e2e`) | L | **High** | Foundation: become-observable daemon + merged log + `.consensus/` state + identity. ~6 open design questions. Design pass first. |
| [Inter-agent direct messaging](../items/inter-agent-direct-messaging.md) (`bl-f59f`) | M | **High** | Capability layer; priority-over-log. Build-vs-adopt (Agent Mail/`cass`) decision. Needs `bl-4e2e`. |

---

## Deferred fill-ins & decision seeds

Low-priority, independent. Fill-ins slot into gaps; decision seeds need a recorded verdict before any build (several may resolve `wont_do`). The count overstates the real build queue.

| Item | Scope | Planning investment | Notes |
| --- | --- | --- | --- |
| [Add a test guarding bundled rubric examples](../items/add-rubric-example-criteria-cap-guard.md) (`bl-3913`) | S | Low | **Free quick win** — ship-safe, no runtime change. Vitest `.test.ts` under `tests/consensus/evaluate/`. Bank with the version-bump tooling work. |
| [Share consensus generated runtime output](../items/share-consensus-generated-runtime-output.md) (`bl-e0e7`) | M | Med | Maintainability; spike-gated (4-host install). **Not concurrent with the family project** (both touch `consensus-loop` generated output) — land before it starts or after it merges. Spike best informed by the `bl-d85f` install work. |
| [Add deliberation metrics](../items/add-deliberation-metrics.md) (`bl-9ed4`) | S | Low | Token/cost/round/wall-clock in the resolution block; degrade gracefully. May spawn a cost-cap follow-up. |
| [Add similarity heuristic](../items/add-convergence-similarity-heuristic.md) (`bl-ef38`) | S | Low | Deterministic near-converge measure, agency-gated to moderate+. |
| [Add whole-document harmonization pass](../items/add-whole-document-harmonization-pass.md) (`bl-e39a`) | M | Med | Post-convergence cross-section pass (`--harmonize`); composes with sequential + parallel + resume. v3 Phase 4. |
| [LLM section auto-chunking fallback](../items/llm-section-auto-chunking.md) (`bl-db5d`) | S | Low | **Decision-first** (may `wont_do`). |
| [Mid-loop user artifact edits](../items/mid-loop-user-artifact-edits.md) (`bl-58b3`) | S | Low | **Decision-first** (may `wont_do`). |
| [Define host-native dispatch protocol](../items/define-host-native-dispatch-safe-packet-protocol.md) (`bl-3ca6`) | L | **High** | **Go/no-go first** (likely defer). Reserved seam. |
| [Multi-peer (3+) deliberation extension](../items/multi-peer-deliberation-extension.md) (`bl-f8cb`) | L | **High** | **Go/no-go first** (likely defer). |

---

## Suggested OAT project groupings

Run cohesive arcs as a single OAT project rather than separate tickets:

| Proposed project | Items | Why one project |
| --- | --- | --- |
| **consensus-family** | `bl-2ed7` → `bl-b9b9` → `bl-87ef` + `bl-0cb8` | Cold-start + sectioning co-designed once (the primitive needs its first consumer to validate); decide/plan are thin wrappers riding it. |
| **consensus-research** (separate) | `bl-645c` | Own peer tool-access DR; keep out of the family project so that DR doesn't block create/decide/plan. |
| **provider-cli-hardening** | `bl-3a88` + `bl-3291` | Both harden the owned CLI's reliability boundary; shared `provider-cli/` surface, disjoint from the family lane. |
| **docs-IA** | `bl-ecaa` | Single two-phase arc (scaffold + migrate); family + later skills document into it via `oat-project-document`. |
| **multi-agent-substrate** | `bl-4e2e` → `bl-f59f` | One initiative; shared identity/state primitive + a single adopt-vs-build (`cass`) decision. |
| Standalone tasks (not projects) | `bl-22d3`, `bl-e0e7`, `bl-3913`, fill-ins, seeds | Single-arc tasks or decisions; project ceremony would be overhead. |

---

## Parallelism cheat sheet

Quick lookup for "can I start X while Y is in flight?" (capacity: 2–3 worktrees).

| Can run together | Keep sequential |
| --- | --- |
| `bl-d85f` (release) ∥ family ∥ hardening | `bl-2ed7` before `bl-b9b9` / `bl-87ef` / `bl-0cb8` (hard block) |
| Family (`core/consensus-loop`) ∥ hardening (`provider-cli/`) | `bl-b9b9` sectioning design before decide/plan (soft) |
| `bl-87ef` ∥ `bl-0cb8` (after `bl-b9b9`) | `bl-3a88` design before/with the synthesized wrappers (de-risk) |
| Docs IA (`bl-ecaa`) ∥ family + hardening — **after the tag** | Docs IA after `bl-d85f` tag; **before** the family project finishes |
| — | `bl-e0e7` **not concurrent** with the family project (shared generated `consensus-loop` output) |
| — | `bl-22d3` after docs IA; not a 4th concurrent track |
| Substrate lane (`bl-4e2e`→`bl-f59f`) ∥ consensus work | `bl-4e2e` before `bl-f59f` (hard block) |

---

## Suggested next kickoff stack

Three concrete actions for the next development cycle. Not a ranked list of everything — just what to do _first_.

1. **Continue** [`bl-d85f`](../items/complete-v01-release-verification.md) in the release worktree (in flight) — finishing pass to the v0.1 tag. When it lands, route that worktree to docs IA.
2. **Kick off** the **consensus-family** project at [`bl-2ed7`](../items/independent-draft-cold-start-strategy.md) → `bl-b9b9` → `bl-87ef`+`bl-0cb8` — the highest-leverage unblock.
3. **Kick off** the **provider-cli-hardening** project — [`bl-3a88`](../items/tool-based-verdict-submission-for-consensus-peers.md) design pass first, then [`bl-3291`](../items/refine-provider-exit-retry-classification.md) — concurrently with the family (disjoint source surface), so verdict-submission lands before the synthesized wrappers fan out.

> Then: docs IA (`bl-ecaa`) into the freed release worktree after the tag, before the family finishes; then phone-a-friend (`bl-22d3`) documents into the new site.

---

## Changelog

Append a new row each time this file is refreshed via the `oat-pjm-review-backlog` walkthrough. Keep entries short — what shifted and why.

| Date | Update |
| --- | --- |
| 2026-06-14 | Initial alignment. Both iteration modes (`bl-5d49`, `bl-7af0`) merged via #9 → all five family skills unblocked; #10 landed dev tooling. Phased into Family-kickoff+release / Family-fan-out+hardening / Paseo-build-vs-buy+last-skill. Planning-investment column included. Flagged stale "merge pending" narratives. |
| 2026-06-14 | Refreshed stale "merge pending" narratives → "merged via PR #9" across reference docs. Roadmap Now/Next re-sequenced. |
| 2026-06-15 | Re-sequenced around active TS/vitest work: paused `bl-5174`, deferred `bl-d85f` until post-TS, moved peer-invocation ownership (`bl-3a88`/`bl-bb7e`) to a later design/spike track. |
| 2026-06-20 | **Major reshape.** TS foundation landed (#13–19); owned provider CLI shipped (#22–24, DR-023) → `bl-bb7e` done, Paseo framing retired, peer-invocation reframed as *hardening*. `bl-5174` + `bl-f0b6` done. 11 new items folded in. Re-phased and verified `bl-d85f` untagged. Added OAT-project groupings. |
| 2026-06-20 | **Committed 3-track plan.** `bl-d85f` now in flight (finishing pass, release worktree). Active tracks: **consensus-family** (`bl-2ed7`→`bl-b9b9`→`bl-87ef`+`bl-0cb8`, one project) ∥ **provider-cli-hardening** (`bl-3a88` design-first + `bl-3291`, disjoint surface). Promoted **docs IA** (`bl-ecaa`) to immediate post-tag (into the freed worktree, before the family finishes); `oat-project-document` then targets the site. `bl-22d3` (phone-a-friend) sequenced after docs IA. Recorded `bl-e0e7`-not-concurrent-with-family constraint. Enriched `bl-ecaa`/`bl-22d3`/`bl-e0e7`/`bl-2ed7`/`bl-b9b9`/`bl-3a88`. |
