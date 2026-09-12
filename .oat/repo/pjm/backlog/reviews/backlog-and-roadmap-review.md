# Backlog & Roadmap Review

**Date:** 2026-09-07
**Evidence re-review:** 2026-09-11 at unchanged source base `f5395a35`; Astra review and root corrections are recorded in `reference/reviews/2026-09-11-backlog-astra-review.md` relative to `.oat/repo/`.
**Scope:** All 15 active items under `.oat/repo/pjm/backlog/items/`, recent completion history, current repository evidence, and the repository roadmap
**Roadmap:** `.oat/repo/pjm/roadmap.md`
**Purpose:** Prioritize by value and effort, surface dependencies, and recommend an execution sequence

> The existing [`priority-alignment.md`](./priority-alignment.md) records the July 11 operator walkthrough for the then-current nine-item board. It remains authoritative for those operator choices, but it predates the six July 13/23 items and was not modified in this noninteractive review.

---

## 1. Executive Summary

The active backlog contains **15 items** across four themes:

| Theme                              | Count | Key observation                                                                                              |
| ---------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------ |
| Consensus product and loop quality |     7 | Bounded correctness/tooling follow-ups now offer more immediate leverage than the older feature initiatives. |
| Multi-agent collaboration          |     4 | The substrate and N>2 work remain design-first initiatives with explicit dependency ordering.                |
| Provider and release truthfulness  |     2 | The live-submit mismatch and transitive version-bump gap are high-value integrity work.                      |
| Deferred capability seeds          |     2 | Host-native dispatch and multi-peer deliberation still lack sufficient demand.                               |

| Quadrant      | Count |
| ------------- | ----: |
| Quick Win     |     1 |
| Strategic     |     7 |
| Fill-in       |     3 |
| Avoid / Defer |     4 |

**Top-line recommendations:**

1. Plan **BL-260723-guard-transitive-shared — Guard transitive shared-runtime skill version bumps** first because it prevents silently stale public versions across later shared-runtime work.
2. Pair **BL-260723-make-remaining-consensus-loop — Make remaining consensus-loop write sites atomic** with its existing failure-test pattern as a small correctness win.
3. Independently plan **BL-260723-split-loop-free-cli-helpers — Split loop-free cli-helpers core for panel sharing** and **BL-260723-investigate-live-submit — Investigate live submit verdict-source contract mismatch**; keep the live run authorization-gated.

### Rating Key

| Rating     | Value                                                                                       | Effort                                       |
| ---------- | ------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **High**   | Unblocks later work, protects release/runtime correctness, or closes a material product gap | More than 3 days or broad/cross-cutting work |
| **Medium** | Meaningful quality or consistency gain without blocking the roadmap                         | About 1–3 focused days                       |
| **Low**    | Speculative, evidence-gated, or narrow benefit                                              | Less than a day when isolated                |

---

## 2. Item Catalog

| Item                                                                                               | Value  | Effort | Quadrant      | Rationale and disposition                                                                                                                                               |
| -------------------------------------------------------------------------------------------------- | ------ | ------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BL-260612-add-consensus-research-skill** — Add consensus-research skill                          | High   | High   | Strategic     | Completes the named family, but peer tool access, permission, and evidence provenance need a design-first OAT project. Defer; do not invent a mega-plan.                |
| **BL-260612-add-deliberation-metrics** — Add deliberation metrics                                  | Medium | Medium | Fill-in       | Auditability gain; real provider signals and unavailable semantics still need inventory. Valid and unchanged, but not selected in this batch.                           |
| **BL-260612-add-similarity-heuristic** — Add similarity heuristic                                  | Low    | Low    | Fill-in       | Strict convergence works today. Retain behind metrics and preserve the deterministic default; not selected.                                                             |
| **BL-260612-add-whole-document** — Add whole-document harmonization pass                           | High   | High   | Strategic     | Major quality gap, but fan-in, impasse, artifacts, resume, and context boundaries require a project/design decision. Defer; no mega-plan.                               |
| **BL-260619-define-host-native-dispatch** — Define host-native dispatch / safe-packet protocol     | Low    | High   | Avoid / Defer | The safely disabled reservation already provides guard value. Stale as an immediate candidate, not duplicate or complete; retain until concrete demand.                 |
| **BL-260619-shared-session-log-substrate** — Shared session log substrate                          | High   | High   | Strategic     | Foundation for messaging, but daemon, identity, lifecycle, schema, and adopt-versus-build work are initiative-sized. Defer to `oat-project-new`.                        |
| **BL-260619-inter-agent-direct-messaging** — Inter-agent direct messaging                          | High   | High   | Strategic     | Operational payoff, but hard-blocked by the shared-session-log substrate. Do not plan independently.                                                                    |
| **BL-260619-multi-peer-3-deliberation** — Multi-peer (3+) deliberation extension                   | Low    | High   | Avoid / Defer | Panel supplies breadth; group convergence lacks demand. Stale as an immediate candidate; retain the explicit deferred question.                                         |
| **BL-260701-add-multi-round-panel** — Add multi-round panel discussion                             | Low    | Medium | Avoid / Defer | Product boundaries are decided; implementation remains usage-evidence-gated. Keep open, not planned.                                                                    |
| **BL-260713-optional-idle-session** — Optional idle-session application integrations               | Low    | Medium | Avoid / Defer | Convenience-only and no concrete integration target/demand is recorded. Valid deferred idea.                                                                            |
| **BL-260713-per-observer-offsets-and-safe** — Per-observer offsets and safe N>2 collaboration mesh | High   | High   | Strategic     | Identity, CAS, locking, migration, and multi-observer fixtures are project-sized. Defer to a bounded topology/design project.                                           |
| **BL-260723-guard-transitive-shared** — Guard transitive shared-runtime skill version bumps        | High   | Medium | Strategic     | Prevents stale public consumer versions. Graph fan-out, removed edges, and isolated-repository testing make this a bounded but nontrivial 1–3 day change. **Selected.** |
| **BL-260723-investigate-live-submit** — Investigate live submit verdict-source contract mismatch   | High   | Medium | Strategic     | The real-provider gate contradicted the stub contract. Bounded investigation, but the decisive run needs separate quota/credential authorization. **Selected.**         |
| **BL-260723-make-remaining-consensus-loop** — Make remaining consensus-loop write sites atomic     | High   | Low    | Quick Win     | Two known crash windows can reuse the shipped helper and failure tests. **Selected.**                                                                                   |
| **BL-260723-split-loop-free-cli-helpers** — Split loop-free cli-helpers core for panel sharing     | Medium | Medium | Fill-in       | Removes known duplication while preserving panel independence; generated fan-out and regression gates keep it bounded. **Selected.**                                    |

### Existing-plan and completion checks

All catalogued records are `open`, unassigned, with no associated issues in their source frontmatter. Priorities below are source values, not rewritten by the review. Effort ratings above reassess implementation effort; source `scope_estimate` remains unchanged.

| Item                                                          | Source priority / scope | Hard prerequisite                                     | Soft dependency / shared surface                                       | Blocks                              |
| ------------------------------------------------------------- | ----------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------- |
| BL-260612-add-consensus-research-skill — Research skill       | Low / feature           | Peer-tool permission/provenance decision before build | Shared loop: do not overlap loop-quality implementation                | Its own build after decision        |
| BL-260612-add-deliberation-metrics — Deliberation metrics     | Low / feature           | None                                                  | Provider signal inventory; first in approved loop-quality sequence     | Similarity sequencing (soft)        |
| BL-260612-add-similarity-heuristic — Similarity heuristic     | Low / feature           | Recorded deterministic/agency contract                | Metrics first in operator sequence                                     | Harmonization sequencing (soft)     |
| BL-260612-add-whole-document — Whole-document harmonization   | Low / feature           | Context-boundary decision before build                | Loop-quality completion and fan-in/resume compatibility                | None                                |
| BL-260619-define-host-native-dispatch — Safe-packet protocol  | Low / initiative        | Go/no-go and reviewed safe-packet contract            | Concrete host demand                                                   | Enabling reserved capability        |
| BL-260619-shared-session-log-substrate — Shared log substrate | Medium / initiative     | Adopt/build, identity and lifecycle design            | Deliberate operational capacity                                        | Direct messaging (hard)             |
| BL-260619-inter-agent-direct-messaging — Direct messaging     | Medium / feature        | Shared log substrate's identity/state/cursors         | Adopt/build decision                                                   | None                                |
| BL-260619-multi-peer-3-deliberation — Multi-peer extension    | Low / idea              | Demand and group-convergence go/no-go                 | Panel breadth is not group convergence                                 | None                                |
| BL-260701-add-multi-round-panel — Multi-round panel           | Low / idea              | Usage evidence and opt-in design                      | Preserve existing non-converging panel decisions                       | None                                |
| BL-260713-optional-idle-session — Idle integrations           | Low / idea              | Integration go/no-go and capability evidence          | Existing N=2 lease/cursor authority                                    | None                                |
| BL-260713-per-observer-offsets-and-safe — Safe N>2 mesh       | Low / initiative        | Identity/offset/CAS/migration design                  | Compose with substrate; substrate is not asserted as a hard dependency | None                                |
| BL-260723-guard-transitive-shared — Transitive version guard  | Medium / task           | Mechanically derivable build graph                    | Graph/validator fixtures                                               | Safer shared-runtime changes (soft) |
| BL-260723-investigate-live-submit — Live submit mismatch      | Medium / task           | Separate live diagnostic/confirmation grants          | Provider CLI generated ownership                                       | None                                |
| BL-260723-make-remaining-consensus-loop — Atomic loop writes  | Low / task              | Existing records-layer helper                         | Serialize shared generated output with helper extraction               | None                                |
| BL-260723-split-loop-free-cli-helpers — Loop-free helpers     | Low / task              | Helper semantic parity and loop-free topology         | Version guard preferred; serialize with atomic writes                  | None                                |

- `2026-07-17-skill-files-disk-derivation.md` covers directly changed skill discovery, not transitive consumers of shared generated runtime; **BL-260723-guard-transitive-shared — Guard transitive shared-runtime skill version bumps** is distinct.
- `2026-07-17-atomic-consensus-records-writes.md` explicitly excludes other `writeFile` call sites; **BL-260723-make-remaining-consensus-loop — Make remaining consensus-loop write sites atomic** is its named follow-up.
- `2026-07-17-consolidate-consensus-cli-helpers.md` originally included panel, but `.oat/repo/reference/project-summaries/20260723-wave-3-execution.md:19-24` records its reviewed exclusion and the core follow-up; **BL-260723-split-loop-free-cli-helpers — Split loop-free CLI helpers core for panel sharing** is distinct.
- `2026-07-17-live-provider-e2e-visibility.md` made the gate visible but did not resolve the observed `submit` versus `final_message` mismatch.
- Current source verification establishes all four selected gaps. The other eleven dispositions are grounded in their acceptance criteria and roadmap/decision records, not an exhaustive implementation certification. No new evidence establishes full completion of a nonselected item; all remain open, and no item is closed or archived by this planning pass.

---

## 3. Dependency Graph

```text
Legend: ──▶ hard dependency   - -▶ sequencing/shared-surface constraint

BL-260619-shared-session-log-substrate ──▶ BL-260619-inter-agent-direct-messaging
BL-260619-shared-session-log-substrate - -▶ BL-260713-per-observer-offsets-and-safe

BL-260723-guard-transitive-shared - -▶ future shared-runtime changes
BL-260723-make-remaining-consensus-loop - -▶ BL-260723-split-loop-free-cli-helpers

BL-260612-add-consensus-research-skill (decision) ──▶ research build
BL-260612-add-deliberation-metrics - -▶ BL-260612-add-similarity-heuristic
BL-260612-add-similarity-heuristic - -▶ BL-260612-add-whole-document

BL-260723-investigate-live-submit [independent; live authorization gated]
BL-260713-optional-idle-session [independent; evidence gated]
BL-260619-define-host-native-dispatch [independent; demand gated]
BL-260619-multi-peer-3-deliberation [independent; demand gated]
BL-260701-add-multi-round-panel [independent; usage gated]
```

**ID legend:**

| ID                                        | Title                                                    |
| ----------------------------------------- | -------------------------------------------------------- |
| `BL-260612-add-consensus-research-skill`  | Add consensus-research skill                             |
| `BL-260612-add-deliberation-metrics`      | Add deliberation metrics                                 |
| `BL-260612-add-similarity-heuristic`      | Add similarity heuristic                                 |
| `BL-260612-add-whole-document`            | Add whole-document harmonization pass                    |
| `BL-260619-define-host-native-dispatch`   | Define host-native dispatch / safe-packet protocol       |
| `BL-260619-shared-session-log-substrate`  | Shared session log substrate                             |
| `BL-260619-inter-agent-direct-messaging`  | Inter-agent direct messaging                             |
| `BL-260619-multi-peer-3-deliberation`     | Multi-peer (3+) deliberation extension                   |
| `BL-260701-add-multi-round-panel`         | Add multi-round panel discussion                         |
| `BL-260713-optional-idle-session`         | Optional idle-session application integrations           |
| `BL-260713-per-observer-offsets-and-safe` | Per-observer offsets and safe N>2 collaboration mesh     |
| `BL-260723-guard-transitive-shared`       | Guard transitive shared-runtime skill version bumps      |
| `BL-260723-investigate-live-submit`       | Investigate live submit verdict-source contract mismatch |
| `BL-260723-make-remaining-consensus-loop` | Make remaining consensus-loop write sites atomic         |
| `BL-260723-split-loop-free-cli-helpers`   | Split loop-free cli-helpers core for panel sharing       |

---

## 4. Parallel Lanes

### Lane A: Release and runtime integrity

**BL-260723-guard-transitive-shared — Guard transitive shared-runtime skill version bumps** may run independently. Serialize the two consensus-source refactors to reduce generated-output/version churn:

**BL-260723-make-remaining-consensus-loop — Atomic loop writes** precedes **BL-260723-split-loop-free-cli-helpers — Loop-free helpers** as a shared-output sequencing recommendation, not a functional dependency.

### Lane B: Provider contract truthfulness

**BL-260723-investigate-live-submit — Investigate live submit verdict-source contract mismatch** is independent but authorization-gated for live observation.

### Lane C: Existing operator-aligned consensus roadmap

**BL-260612-add-consensus-research-skill — Research skill** begins with its decision only, alongside the sequential **BL-260612-add-deliberation-metrics — Deliberation metrics** then **BL-260612-add-similarity-heuristic — Similarity heuristic** batch. **BL-260612-add-whole-document — Whole-document harmonization** remains next, following its context decision.

The July operator alignment and July 24 roadmap remain the operative priorities. The integrity-first order below is a proposed technical recommendation for Thomas, not an approved replacement for the research-boundary and loop-quality kickoff stack. Selecting plans under the noninteractive default authorizes planning, not reprioritization or execution.

### Lane D: Collaboration initiatives

**BL-260619-shared-session-log-substrate — Shared log substrate** is a hard prerequisite of **BL-260619-inter-agent-direct-messaging — Direct messaging**. **BL-260713-per-observer-offsets-and-safe — Safe N>2 mesh** must define composition with both but is a separate design outcome, not an asserted hard dependent.

Allocate an initiative slot and design first; do not combine these into one external plan.

---

## 5. Recommended Execution Order

### Proposed wave 1: Prevent repeat integrity gaps

These waves order the selected improvement candidates only. Adopting them ahead of the existing kickoff stack requires Thomas's alignment decision; no priority-alignment, roadmap, or kickoff-handoff files were changed.

| Order | Item                                                                                             | Effort | Rationale                                                             |
| ----: | ------------------------------------------------------------------------------------------------ | ------ | --------------------------------------------------------------------- |
|     1 | **BL-260723-guard-transitive-shared** — Guard transitive shared-runtime skill version bumps      | Medium | Protects later shared-runtime changes; graph edge cases require care. |
|     2 | **BL-260723-make-remaining-consensus-loop** — Make remaining consensus-loop write sites atomic   | Low    | Closes two known crash windows with an existing pattern.              |
|     3 | **BL-260723-investigate-live-submit** — Investigate live submit verdict-source contract mismatch | Medium | Restores confidence in the only real-provider verification boundary.  |

**Parallelism:** Items 1 and 3 are independent; item 2 can also proceed separately if generated-output ownership is coordinated.

### Wave 2: Finish the bounded consolidation follow-up

| Order | Item                                                                                           | Effort | Rationale                                                           |
| ----: | ---------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------- |
|     1 | **BL-260723-split-loop-free-cli-helpers** — Split loop-free cli-helpers core for panel sharing | Medium | Removes known duplication after the correctness guard is available. |

### Wave 3: Resume operator-aligned feature planning

Retain the existing research-decision and loop-quality ordering from `priority-alignment.md`, using the OAT project workflow for each project-sized design.

### Deferred

- **BL-260619-define-host-native-dispatch — Define host-native dispatch / safe-packet protocol**: demand-gated, not obsolete or completed.
- **BL-260619-multi-peer-3-deliberation — Multi-peer (3+) deliberation extension**: demand-gated, not obsolete or completed.
- **BL-260701-add-multi-round-panel — Add multi-round panel discussion**: usage-evidence-gated.
- **BL-260713-optional-idle-session — Optional idle-session application integrations**: target and demand absent.
- **BL-260713-per-observer-offsets-and-safe — Per-observer offsets and safe N>2 collaboration mesh**: initiative-sized design required.
- **BL-260619-shared-session-log-substrate — Shared session log substrate** and **BL-260619-inter-agent-direct-messaging — Inter-agent direct messaging**: design/dependency sequence required.

---

## 6. Roadmap Alignment

| Roadmap direction            | Backlog coverage                                                            | Assessment                                                                   |
| ---------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Consensus skill family       | Research, metrics, similarity, harmonization, multi-round panel             | Covered; the roadmap does not surface the four July 23 integrity follow-ups. |
| Multi-agent collaboration    | Shared substrate, direct messaging, per-observer offsets, idle integrations | Covered but initiative-sized and capacity-gated.                             |
| Provider/runtime integrity   | Live-submit mismatch, transitive version guard, atomic writes, helper split | Active coverage exists; add these to the next collaborative roadmap refresh. |
| Reserved future capabilities | Host-native dispatch, 3+ peer deliberation                                  | Correctly deferred.                                                          |

**Gap:** The July 11 priority alignment predates six additions. The roadmap was updated July 24 and already includes the two July 13 collaboration items in its follow-on lane; it omits the four July 23 integrity follow-ups. A future collaborative walkthrough should decide how those fit the operator-owned alignment, without inferring a priority reset from this planning batch.

---

## 7. Observations & Recommendations

1. The board has shifted from feature-heavy planning to a useful cluster of small, evidence-backed integrity follow-ups.
2. Existing July 17 plans are not duplicates: each selected follow-up begins at an explicit prior-plan or execution boundary.
3. The live-submit item is the only selected plan whose decisive verification spends provider quota; keep that authorization separate from implementation authorization.
4. Plan creation alone satisfies no source item's acceptance criteria, so all source items remain open.

### Risks

| Risk                                                     | Mitigation                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Shared runtime changes leave consumer versions stale     | Implement the transitive version guard before more shared-runtime work.      |
| Consensus refactors collide in generated outputs         | Serialize atomic-write and helper-extraction implementation.                 |
| A live diagnosis runs without quota/credential authority | Make authorization a plan STOP condition and use inherited credentials only. |
| Project-sized initiatives become vague mega-plans        | Route them through `oat-project-new` with design decisions first.            |

### Especially worthwhile candidates

1. **BL-260723-guard-transitive-shared** — Guard transitive shared-runtime skill version bumps (high value, medium effort).
2. **BL-260723-make-remaining-consensus-loop** — Make remaining consensus-loop write sites atomic.
3. **BL-260723-split-loop-free-cli-helpers** — Split loop-free cli-helpers core for panel sharing after the guard.
