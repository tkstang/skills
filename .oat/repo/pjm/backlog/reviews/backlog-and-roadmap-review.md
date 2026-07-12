# Backlog & Roadmap Review

**Date:** 2026-07-11
**Scope:** All 9 active items under `.oat/repo/pjm/backlog/items/`, recent completion history, current implementation, and the repository roadmap
**Roadmap:** `.oat/repo/pjm/roadmap.md`
**Purpose:** Prioritize by value and effort, surface dependencies, and recommend an execution sequence

> The one-page execution companion at [`priority-alignment.md`](./priority-alignment.md) was refreshed through the July 11 operator walkthrough. It records the confirmed now/next/later sequence and current kickoff stack.

---

## 1. Executive Summary

The active backlog contains **9 items** in three themes:

| Theme | Count | Key observation |
| --- | ---: | --- |
| Consensus family and loop quality | 4 | `consensus-research` is the only unshipped named family skill; the other three should share one controlled loop-core change window. |
| Multi-agent collaboration substrate | 2 | The foundation is still an initiative-sized, design-first commitment; messaging is hard-blocked behind it. |
| Deferred capability seeds | 3 | Host-native dispatch, 3+ peer convergence, and multi-round panel discussion should wait for concrete demand or usage evidence. |

**Quadrant distribution:**

| Quadrant | Count | Items |
| --- | ---: | --- |
| Strategic | 4 | **BL-260612-add-consensus-research-skill** — Add consensus-research skill; **BL-260612-add-whole-document** — Add whole-document harmonization pass; **BL-260619-shared-session-log-substrate** — Shared session log substrate; **BL-260619-inter-agent-direct-messaging** — Inter-agent direct messaging |
| Fill-in | 2 | **BL-260612-add-deliberation-metrics** — Add deliberation metrics; **BL-260612-add-similarity-heuristic** — Add similarity heuristic |
| Avoid / Defer | 3 | **BL-260619-define-host-native-dispatch** — Define host-native dispatch / safe-packet protocol; **BL-260619-multi-peer-3-deliberation** — Multi-peer (3+) deliberation extension; **BL-260701-add-multi-round-panel** — Add multi-round panel discussion |
| Quick Win | 0 | None |

**Top-line recommendations:**

1. Start [`BL-260612-add-consensus-research-skill` — Add consensus-research skill](../items/BL-260612-add-consensus-research-skill.md) with its peer-tool-access and evidence-capture decision record; the decision must precede any build.
2. Start [`BL-260612-add-deliberation-metrics` — Add deliberation metrics](../items/BL-260612-add-deliberation-metrics.md) and then [`BL-260612-add-similarity-heuristic` — Add similarity heuristic](../items/BL-260612-add-similarity-heuristic.md) now in one sequential loop-quality worktree. They may run alongside the research **DR**, not a research build.
3. Take [`BL-260612-add-whole-document` — Add whole-document harmonization pass](../items/BL-260612-add-whole-document.md) and [`BL-260619-shared-session-log-substrate` — Shared session log substrate](../items/BL-260619-shared-session-log-substrate.md) next, with deliberate capacity for their separate design/build arcs.

### Rating Key

| Rating | Value | Effort |
| --- | --- | --- |
| **High** | Unblocks other items, daily workflow impact, or roadmap prerequisite | More than 3 days, high complexity, or broad surface |
| **Medium** | Meaningful quality or consistency gain without being a prerequisite | About 1–3 days of focused work |
| **Low** | Speculative, evidence-gated, or narrow benefit | Under a day and isolated |

### Priority Quadrants

```text
                     High Value
                        |
         STRATEGIC      |      QUICK WIN
        (plan carefully)|    (do first)
                        |
  High Effort ----------+---------- Low Effort
                        |
         AVOID /        |      FILL-IN
         DEFER          |    (slot into gaps)
                        |
                     Low Value
```

For medium ratings, the closest execution quadrant is used: non-blocking bounded work is **Fill-in**, while initiative-sized work with material future leverage is **Strategic**.

---

## 2. Item Catalog

### `BL-260612-add-consensus-research-skill` — Add consensus-research skill (investigate question, synthesized findings)

> The last unshipped named family skill: a shared-input, parallel-synthesized research workflow that produces evidence, dissent, and a deliberation log.

**Metadata:** Open · backlog priority low · feature · estimate M · labels: consensus, skill-family · unassigned.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **High** | It is the sole roadmap **Next** item and completes the named skill family. |
| **Effort** | **High** | A durable decision on peer tool access, evidence provenance, and permissions precedes a new wrapper, schemas, documentation, and tests. |
| **Quadrant** | **Strategic** | The design decision reduces risk before a cross-cutting build. |

- **Dependencies:** Parallel-synthesized mode is already shipped; a new peer-tool-access/evidence-capture decision record is the remaining prerequisite.
- **Blocked by:** No active backlog item; the historical parallel-synthesized-mode predecessor is already complete.
- **Blocks:** The `consensus-research` implementation and the family-completeness roadmap claim.
- **Implementation context:** The owned provider CLI is the execution boundary; the active item now records that boundary explicitly.

### `BL-260612-add-deliberation-metrics` — Add deliberation metrics (tokens, wall-clock, rounds) to artifacts

> Complete the partially present metrics contract while accurately representing unavailable provider cost and token data.

**Metadata:** Open · backlog priority low · feature · estimate S · labels: consensus, observability · unassigned.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Medium** | Better cost, time, and round visibility improves auditability but does not unblock current product use. |
| **Effort** | **Medium** | Round and wall-clock fields already exist, but per-provider signal inventory, schema propagation, resume behavior, and graceful unavailable semantics remain. |
| **Quadrant** | **Fill-in** | A bounded quality improvement once the loop-core worktree is open. |

- **Dependencies:** No hard active-item dependency; first confirm what the owned provider CLI can report rather than assuming provider cost signals exist.
- **Blocked by:** Nothing.
- **Blocks:** A defensible follow-up on hard cost-cap flags, if evidence makes that worthwhile.
- **Implementation context:** Canonical sources already emit `wall_clock_ms`, `total_rounds`, `cost_source: unavailable`, and `approximate_cost_usd: null`; the work is to make availability real and consistent, not to invent metrics.

### `BL-260612-add-similarity-heuristic` — Add similarity heuristic for near-converged deliberation states

> Add an auditable, agency-gated near-match signal without weakening strict deterministic convergence for minimal agency.

**Metadata:** Open · backlog priority low · feature · estimate S · labels: consensus, convergence, nice-to-have · unassigned.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low** | The deterministic escalation ladder works today; this reduces friction only if near-match escalations prove frequent. |
| **Effort** | **Low** | A fixed algorithm, threshold, disclosure, and boundary tests are contained once the shared loop is open. |
| **Quadrant** | **Fill-in** | A safe second item in a deliberate loop-quality batch, not a reason to reopen that code alone. |

- **Dependencies:** No hard active-item dependency; preserve the accepted deterministic-only default and agency gate.
- **Blocked by:** Nothing.
- **Blocks:** Nothing directly; it may reduce host/user escalation frequency on long documents.
- **Implementation context:** The v1 verdict decision intentionally deferred fuzzy scoring, so the acceptance criteria must preserve a reproducible algorithm and audit disclosure.

### `BL-260612-add-whole-document` — Add whole-document harmonization pass after section convergence

> Add an optional post-fan-in pass to reconcile terminology, redundancy, transitions, and narrative flow across independently converged sections.

**Metadata:** Open · backlog priority low · feature · estimate M · labels: consensus, quality · unassigned.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **High** | This is the major remaining quality gap for multi-section artifacts and is explicitly retained on the roadmap. |
| **Effort** | **High** | It must compose with sequential and host-mediated parallel section runs, impasse routing, artifact rendering, and resume. |
| **Quadrant** | **Strategic** | A design-first loop change with meaningful product quality leverage. |

- **Dependencies:** Existing section orchestration and resume are shipped; record the context boundary (assembled document only versus logs) before implementation.
- **Blocked by:** Nothing technically; schedule after a clear decision about the loop-quality batch to avoid repeatedly reopening the shared runtime.
- **Blocks:** Removal of the documented no-harmonization limitation for large, multi-section artifacts.
- **Implementation context:** The prior design favors assembled-document-only context; the current `refine` source already has section state, parallel aggregation, and resume paths that make the integration broad rather than a wrapper-only option.

### `BL-260619-define-host-native-dispatch` — Define host-native dispatch / safe-packet protocol (reserved seam)

> Decide whether the reserved provider capability should ever become a real host-native dispatch contract, with a safe packet, audit boundary, and guard behavior.

**Metadata:** Open · backlog priority low · initiative · estimate L · labels: consensus, provider-cli, host-native, reserved · unassigned.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low** | The current reservation already delivers its guard value: no adapter can silently enable the capability. |
| **Effort** | **High** | A real go path spans execution semantics, conversation history, safety, auditing, and provider-specific adapters. |
| **Quadrant** | **Avoid / Defer** | Keep the safety seam explicit, but do not start without a concrete dispatch need. |

- **Dependencies:** No active-item dependency; any implementation needs a go/no-go and design contract first.
- **Blocked by:** Evidence of a need beyond the current provider CLI floor.
- **Blocks:** Nothing currently planned.
- **Implementation context:** All shipped provider adapters report `supports_host_native_dispatch: false`, while the type surface preserves the safe-packet vocabulary; this is correctly a reserved seam, not partially implemented work.

### `BL-260619-shared-session-log-substrate` — Shared session log substrate (become-observable daemon + merged log)

> Establish a project-scoped, multi-session observation substrate: registration, merged log, identity, lifecycle, and a decision on adopting or building the plumbing.

**Metadata:** Open · backlog priority medium · initiative · estimate L · labels: multi-agent, substrate, session-observer, foundation · unassigned.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **High** | It is the foundation for direct messaging and materially extends the single-session observer model. |
| **Effort** | **High** | The work is a daemon, shared state and identity design, reliability lifecycle, filtering/schema, and an adopt-versus-build decision. |
| **Quadrant** | **Strategic** | High-leverage but should consume an explicit initiative slot, not background capacity. |

- **Dependencies:** TypeScript and current session-observer foundations are shipped; the remaining dependency is a design pass on `cass`/Agent Mail adoption, packaging, and log schema.
- **Blocked by:** Nothing technically, but deliberately appetite-gated.
- **Blocks:** [`BL-260619-inter-agent-direct-messaging` — Inter-agent direct messaging](../items/BL-260619-inter-agent-direct-messaging.md).
- **Implementation context:** Session-observer already has state, watch, cursor, and high-water-mark patterns, but it does not have project-scoped multi-session registration or a merged lifecycle-managed log.

### `BL-260619-inter-agent-direct-messaging` — Inter-agent direct messaging (addressable, prioritized)

> Add prioritized, addressable agent-to-agent messages over the substrate's shared identity and project-scoped state primitives.

**Metadata:** Open · backlog priority medium · feature · estimate M · labels: multi-agent, substrate, messaging · unassigned.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **High** | Targeted signal is the operational payoff of the collaboration substrate and enables priority-over-log semantics. |
| **Effort** | **High** | It requires the foundation plus an adopt-versus-build decision, queue/cursor semantics, lifecycle, and tests. |
| **Quadrant** | **Strategic** | Valuable only as the second part of a coherent substrate initiative. |

- **Dependencies:** [`BL-260619-shared-session-log-substrate` — Shared session log substrate](../items/BL-260619-shared-session-log-substrate.md) is a hard dependency.
- **Blocked by:** The substrate's identity, state directory, and cursor primitives.
- **Blocks:** Future work-claiming or message-bus layers, if later promoted.
- **Implementation context:** The item rightly requires evaluating Agent Mail / `cass` before building a bespoke queue; do not introduce a separate identity system.

### `BL-260619-multi-peer-3-deliberation` — Multi-peer (3+) deliberation extension (reserved / v3+ concern)

> Preserve the 3+ peer convergence question until real evidence shows that two symmetric peers are insufficient.

**Metadata:** Open · backlog priority low · idea · estimate L · labels: consensus, consensus-loop, reserved · unassigned.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low** | `consensus-panel` already provides 3+ breadth without adding group convergence semantics, weakening the near-term case. |
| **Effort** | **High** | Ties, group convergence, oscillation, verdict aggregation, and cost behavior touch the core model. |
| **Quadrant** | **Avoid / Defer** | Keep the seed as a guardrail; demand must precede design work. |

- **Dependencies:** No active-item dependency; needs documented evidence that two peers are insufficient.
- **Blocked by:** Product demand and a go/no-go decision.
- **Blocks:** Nothing currently planned.
- **Implementation context:** The shipped engine is deliberately two-peer, and panel is explicitly independent and non-converging rather than a shortcut to group consensus.

### `BL-260701-add-multi-round-panel` — Add multi-round panel discussion

> Explore an opt-in attributed cross-talk mode while preserving a neutral moderator and never turning panel into refine/evaluate-style convergence.

**Metadata:** Open · backlog priority low · idea · estimate M · labels: consensus, skill-family, panel, decision-recorded, usage-evidence-needed · unassigned.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low** | The v1 panel already meets the independent-breadth use case; this item waits on usage evidence that cross-talk is worth its added cost and complexity. |
| **Effort** | **Medium** | Multi-round state, attribution, provider behavior, timeouts, and possible resume semantics are a real workflow change. |
| **Quadrant** | **Avoid / Defer** | The key product distinctions are already decided; no build should start without usage evidence. |

- **Dependencies:** No active backlog dependency; the single-round and neutral-moderator decisions are already recorded.
- **Blocked by:** Evidence that single-round breadth is insufficient.
- **Blocks:** Nothing currently planned.
- **Implementation context:** The panel wrapper is intentionally direct fan-out with attributed responses and no synthesis; any future mode must stay opt-in and non-converging.

---

## 3. Dependency Graph

```text
Legend:  ──▶  hard dependency (must complete first)
         - -▶  soft sequencing or shared-surface constraint

BL-260619-shared-session-log-substrate ──▶ BL-260619-inter-agent-direct-messaging

BL-260612-add-consensus-research-skill (tool-access DR) ──▶ research build

BL-260612-add-deliberation-metrics - -▶ BL-260612-add-similarity-heuristic
BL-260612-add-similarity-heuristic - -▶ BL-260612-add-whole-document

BL-260612-add-consensus-research-skill (build) - -▶ no concurrent loop-core changes
BL-260612-add-deliberation-metrics - -▶ no concurrent loop-core changes
BL-260612-add-similarity-heuristic - -▶ no concurrent loop-core changes
BL-260612-add-whole-document - -▶ no concurrent loop-core changes

BL-260619-define-host-native-dispatch [independent, demand-gated]
BL-260619-multi-peer-3-deliberation [independent, evidence-gated]
BL-260701-add-multi-round-panel [independent, evidence-gated]
```

**ID legend:**

| ID | Title |
| --- | --- |
| `BL-260612-add-consensus-research-skill` | Add consensus-research skill (investigate question, synthesized findings) |
| `BL-260612-add-deliberation-metrics` | Add deliberation metrics (tokens, wall-clock, rounds) to artifacts |
| `BL-260612-add-similarity-heuristic` | Add similarity heuristic for near-converged deliberation states |
| `BL-260612-add-whole-document` | Add whole-document harmonization pass after section convergence |
| `BL-260619-define-host-native-dispatch` | Define host-native dispatch / safe-packet protocol (reserved seam) |
| `BL-260619-shared-session-log-substrate` | Shared session log substrate (become-observable daemon + merged log) |
| `BL-260619-inter-agent-direct-messaging` | Inter-agent direct messaging (addressable, prioritized) |
| `BL-260619-multi-peer-3-deliberation` | Multi-peer (3+) deliberation extension (reserved / v3+ concern) |
| `BL-260701-add-multi-round-panel` | Add multi-round panel discussion |

---

## 4. Parallel Lanes

### Lane A: Consensus research — decision, then isolated build

Resolve the peer-tool-access, permission, and evidence-provenance contract first. The decision pass is safe to run alongside the other lanes; the wrapper build should not overlap loop-core changes.

```text
BL-260612-add-consensus-research-skill (DR) ──▶ BL-260612-add-consensus-research-skill (build)
```

**Items in this lane:**

- **BL-260612-add-consensus-research-skill** — Add consensus-research skill (investigate question, synthesized findings)

**Total estimated effort:** High
**Cross-lane dependencies:** The design pass can proceed in parallel. Its build shares the plugin loop surface with Lane B and must be serialized with it.

### Lane B: Consensus loop quality — one worktree, one shared-runtime opening

Use a single, sequential worktree for metrics, similarity, and any harmonization decision/build. The July 7 shared-runtime migration removed five duplicate loop outputs, but it also means every loop change is now concentrated in one source/output contract.

```text
BL-260612-add-deliberation-metrics - -▶ BL-260612-add-similarity-heuristic - -▶ BL-260612-add-whole-document
```

**Items in this lane:**

- **BL-260612-add-deliberation-metrics** — Add deliberation metrics (tokens, wall-clock, rounds) to artifacts
- **BL-260612-add-similarity-heuristic** — Add similarity heuristic for near-converged deliberation states
- **BL-260612-add-whole-document** — Add whole-document harmonization pass after section convergence

**Total estimated effort:** Medium–High
**Cross-lane dependencies:** Serialize with the research build. The harmonization design decision can happen earlier, but do not let it create a second simultaneous loop change.

### Lane C: Multi-agent collaboration substrate — initiative slot

Run this lane only when deliberately allocating capacity to a new operational surface; it is technically disjoint from consensus loop work but too large to be an incidental side project.

```text
BL-260619-shared-session-log-substrate ──▶ BL-260619-inter-agent-direct-messaging
```

**Items in this lane:**

- **BL-260619-shared-session-log-substrate** — Shared session log substrate (become-observable daemon + merged log)
- **BL-260619-inter-agent-direct-messaging** — Inter-agent direct messaging (addressable, prioritized)

**Total estimated effort:** High
**Cross-lane dependencies:** None technically. It competes for attention with the research and loop-quality initiatives.

### Lane D: Reserved and evidence-gated seeds — stay parked

```text
BL-260619-define-host-native-dispatch [demand-gated]
BL-260619-multi-peer-3-deliberation [evidence-gated]
BL-260701-add-multi-round-panel [usage-evidence-gated]
```

**Items in this lane:**

- **BL-260619-define-host-native-dispatch** — Define host-native dispatch / safe-packet protocol (reserved seam)
- **BL-260619-multi-peer-3-deliberation** — Multi-peer (3+) deliberation extension (reserved / v3+ concern)
- **BL-260701-add-multi-round-panel** — Add multi-round panel discussion

**Total estimated effort:** High if any seed is promoted
**Cross-lane dependencies:** Promotion requires concrete use evidence, not merely available capacity.

---

## 5. Recommended Execution Order

### Wave 1: Research boundary + loop-quality batch (now)

| Order | Item | Effort | Rationale |
| --- | --- | --- | --- |
| 1a | **BL-260612-add-consensus-research-skill** — Add consensus-research skill (design/DR phase) | High | Resolve peer tools, permissions, evidence provenance, and the owned provider-CLI boundary before estimating a build. |
| 1b | **BL-260612-add-deliberation-metrics** — Add deliberation metrics | Medium | A bounded observability pass with existing round/wall-clock scaffolding; inventory provider signals before exposing cost data. |
| 1c | **BL-260612-add-similarity-heuristic** — Add similarity heuristic | Low | Take immediately after metrics in the same worktree to share generated-output and artifact validation. |

**Parallelism:** The research DR can run beside the metrics-to-similarity worktree. Do not begin a research build while any loop-quality implementation is in flight.

### Wave 2: Coherence + collaboration foundation (next)

| Order | Item | Effort | Rationale |
| --- | --- | --- | --- |
| 2a | **BL-260612-add-whole-document** — Add whole-document harmonization pass (decision first, then build by demand) | High | Record the context boundary, then decide on the broad post-fan-in and resume integration. |
| 2b | **BL-260619-shared-session-log-substrate** — Shared session log substrate (design first) | High | Start the adopt-versus-build, packaging, identity, merged-log, and lifecycle decisions only with an explicit initiative slot. |

**Parallelism:** These lanes are technically disjoint, but both are high-attention arcs. Start one or both only with deliberate capacity.

### Wave 3: Direct messaging (later)

| Order | Item | Effort | Rationale |
| --- | --- | --- | --- |
| 3 | **BL-260619-inter-agent-direct-messaging** — Inter-agent direct messaging | High | It remains hard-blocked until the session-log substrate supplies shared identity, state, lifecycle, and cursor primitives. |

**Parallelism:** None before the substrate exists.

### Deferred

| Item | Rationale |
| --- | --- |
| **BL-260619-define-host-native-dispatch** — Define host-native dispatch / safe-packet protocol | The current reserved seam prevents unsafe accidental activation; demand must justify a full protocol. |
| **BL-260619-multi-peer-3-deliberation** — Multi-peer (3+) deliberation extension | Panel already covers multi-provider breadth; group convergence needs evidence that two peers are insufficient. |
| **BL-260701-add-multi-round-panel** — Add multi-round panel discussion | The required product constraints are decided; wait for real evidence that single-round breadth is insufficient. |

---

## 6. Roadmap Alignment

### How backlog items map to roadmap lanes

| Roadmap lane | Status | Backlog items | Notes |
| --- | --- | --- | --- |
| **Now: research boundary** | Active | **BL-260612-add-consensus-research-skill** — Add consensus-research skill | DR now; implementation only after a documented go and outside another loop build. |
| **Now: loop-quality batch** | Active | **BL-260612-add-deliberation-metrics** — Add deliberation metrics; **BL-260612-add-similarity-heuristic** — Add similarity heuristic | One sequential shared-loop worktree, running alongside the research DR only. |
| **Next: coherence + foundation** | Next | **BL-260612-add-whole-document** — Add whole-document harmonization pass; **BL-260619-shared-session-log-substrate** — Shared session log substrate | Each begins with a design decision; run only with deliberate capacity. |
| **Later: direct messaging** | Later | **BL-260619-inter-agent-direct-messaging** — Inter-agent direct messaging | Hard-blocked behind the shared session-log substrate. |
| **Later: reserved and evidence-gated work** | Parked | **BL-260619-define-host-native-dispatch** — Define host-native dispatch / safe-packet protocol; **BL-260619-multi-peer-3-deliberation** — Multi-peer (3+) deliberation extension; **BL-260701-add-multi-round-panel** — Add multi-round panel discussion | Demand or usage evidence must precede a design/build commitment. |

### Gaps: Roadmap work without active backlog coverage

| Roadmap item | Recommendation |
| --- | --- |
| Opt-in strict require-submission mode | Keep as an explicitly untracked later follow-up until there is a concrete user or release need; do not add a backlog item solely because the roadmap names it. |
| Cursor submit-tool / custom ACP exploration | Remains discovery territory. Add a scoped item only when a provider need and success criteria are known. |
| Public marketplace submissions and hosted-search propagation | Release/distribution monitoring rather than a build initiative; capture a time-bounded backlog item only if a verified blocker emerges. |

### Orphans: Backlog items not represented on the roadmap

**None.** All 9 active items map to an explicit Now, Next, or Later roadmap lane.

### Status consistency findings

- The active item count is **9**. The one-page alignment was refreshed through the July 11 walkthrough, removing its stale 10-item count and completed generated-runtime-dedup gate.
- The research and metrics items now name the owned `consensus` provider CLI as their execution boundary rather than the retired runtime terminology.
- Historic relative source pointers in the similarity, multi-peer, host-native-dispatch, and roadmap records were updated to their current repository locations in this alignment pass.
- No recent commit evidence indicates that an active item has shipped without backlog close-out. The July 7 shared-runtime migration and the decision sweep are already archived and reflected in the roadmap/current state.

---

## 7. Observations & Recommendations

### Strategic observations

1. The board is no longer a broad release cleanup. It is one current research decision, one current controlled shared-loop quality lane, two next design/build arcs, and three intentionally parked seeds.
2. The shared plugin-local runtime reduces duplicate generated output, but it increases the value of serializing loop-core work. Parallelize design work, not concurrent edits to the same loop/artifact schema.
3. The multi-agent substrate has real strategic value but needs a deliberate owner and operational appetite. It should not be started merely because its code surface is disjoint.

### Risks

| Risk | Mitigation |
| --- | --- |
| Research skill build starts before tool-access/evidence decisions are made. | Make the DR and explicit go/no-go the first project phase; scope the build from that result. |
| Metrics or similarity assumptions overstate what providers report. | Inventory provider CLI signals first; preserve explicit unavailable semantics and avoid fabricated costs. |
| Several loop items are implemented in separate worktrees. | Maintain one sequential loop-quality worktree and run generated-output, test, validate, and smoke gates per repo convention. |
| Current execution drifts from the confirmed phase order. | Use the refreshed priority-alignment guide and its three current handoffs as the kickoff source of truth. |
| Substrate work quietly becomes an unbounded platform project. | Require a design/DR, adoption evaluation, defined packaging, lifecycle boundaries, and an explicit initiative slot. |

### Quick wins to tackle immediately

There are **no true quick wins** on the active board. The nearest low-risk bounded work is:

1. **BL-260612-add-deliberation-metrics** — Add deliberation metrics (medium effort after the provider signal inventory).
2. **BL-260612-add-similarity-heuristic** — Add similarity heuristic (low effort, but only as part of the same loop-quality worktree).
3. **BL-260612-add-consensus-research-skill** — Add consensus-research skill (the design/DR phase runs now alongside, but not inside, the loop-quality implementation worktree).
