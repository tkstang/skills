# Backlog & Roadmap Review

**Date:** 2026-09-16
**Scope:** All 19 active item files, completed history, retained research/plans, merged source, and the roadmap.
**Baseline:** `origin/main` `49b4baf3` (PR #83), with the four preserved backlog design commits replayed first.
**Roadmap:** [Now / Next / Later](../../roadmap.md)
**Purpose:** Rate value/effort, separate real dependencies from useful sequencing, and refresh the operating picture.

> **Closeout update (2026-09-16):** The observer re-arm lane subsequently completed in PR #85 and its item moved to `backlog/archived/`. Observer-open counts and execution language below preserve this review's pre-closeout snapshot; the current roadmap and backlog index are authoritative for active work.

The refreshed [priority alignment](priority-alignment.md) confirms the three immediate lanes: observer investigation (Sol started, per user), Consensus Review, and the parallel installer. Later ordering remains a recommendation, not operator approval. Recommendations here do not launch projects, authorize paid calls, or establish release/install status.

## 1. Executive Summary

All **19 item files are open and unassigned**, with no linked issues in their frontmatter. The user now reports Sol started the observer investigation; implementation status/closeout remains owned by that worktree. No whole item meets its acceptance criteria yet. The peer-model item's documentation portion and the multi-round panel item's product-distinction decision are complete, but their runtime/build criteria remain open.

| Theme | Count | Finding |
| --- | ---: | --- |
| Immediate workflow and onboarding | 3 | Re-arm investigation, high-priority Review, and independent installer. |
| Consensus correctness and hygiene | 4 | Settings propagation, atomic writes, helper split, and live-submit diagnosis remain real work. |
| Collaboration and evidence | 5 | Inbox, fidelity, stateless merge, N>2 ownership, and idle integration are distinct projects. |
| Deliberation extensions | 7 | Research/metrics/coherence and reserved features remain open but behind current workflow needs. |

| Quadrant | Count |
| --- | ---: |
| Quick Win | 2 |
| Strategic | 9 |
| Fill-in | 3 |
| Avoid / Defer | 5 |

Top recommendations:

1. **BL-260916-session-observer-re-armed — Investigate observer re-arm catch-up and suspected unread-record gaps:** reproduce a lost renderable message before prescribing a checkpoint fix.
2. **BL-260916-add-consensus-review-cross — Add consensus-review: cross-model review of a bounded scope:** next feature project, independent of the convergence model fix and helper extraction.
3. **BL-260916-add-a-first-party-install — Add a first-party install command for standalone skills:** confirmed independent parallel lane, not a hidden prerequisite for Review.

The small atomic-write fix remains worthwhile without displacing the user-selected feature priority. Quadrants describe investment, not an automatic execution order.

## 2. Item Catalog

Effort is an estimate, not a commitment: **Low** <1 focused day, **Medium** 1–3, **High** >3 or materially cross-cutting. Value: **High** protects correctness or addresses a current workflow priority; **Medium** improves quality or future capacity; **Low** is speculative/demand-gated.

Quadrants: High value + Low effort = Quick Win; High value + Medium/High effort, or Medium value + High effort = Strategic; Medium value + Low/Medium effort = Fill-in; Low value + Medium/High effort = Avoid / Defer. Stored priority/scope/estimate is retained unless separately agreed; reviewed effort may differ. Labels remain in each linked item.

### BL-260916-session-observer-re-armed — Investigate observer re-arm catch-up and suspected unread-record gaps

[Canonical item](../archived/BL-260916-session-observer-re-armed.md) · Stored priority / scope / estimate: **Medium / task / S** · Status: **open**

| Value | Effort | Quadrant | Rationale |
| --- | --- | --- | --- |
| High | Low | Quick Win | Bounded reproduction protects collaboration correctness; S applies to diagnosis, not an assumed fix. |

- **Dependencies / blocked by:** None; prove renderable loss first. Scheduling before Review is soft.
- **Blocks:** None.

### BL-260916-add-consensus-review-cross — Add consensus-review: cross-model review of a bounded scope

[Canonical item](../items/BL-260916-add-consensus-review-cross.md) · Stored priority / scope / estimate: **High / feature / M** · Status: **open**

| Value | Effort | Quadrant | Rationale |
| --- | --- | --- | --- |
| High | High | Strategic | User's highest-priority feature; scope snapshots, reviewer selection/policy, config, JSON schema and OAT adapter make full v1 more than a thin invocation. |

- **Dependencies / blocked by:** Its own config/scope/read-only design; no backlog prerequisite. Models/helpers are adjacent.
- **Blocks:** None.

### BL-260916-add-a-first-party-install — Add a first-party install command for standalone skills

[Canonical item](../items/BL-260916-add-a-first-party-install.md) · Stored priority / scope / estimate: **Medium / feature / S** · Status: **open**

| Value | Effort | Quadrant | Rationale |
| --- | --- | --- | --- |
| High | Medium | Strategic | Independent onboarding gain; remote integrity, overwrite behavior and three host paths make full S optimistic. |

- **Dependencies / blocked by:** Pinned payload and destination/overwrite contract; live acceptance separately authorized.
- **Blocks:** None.

### BL-260916-honor-configured-peer-models — Honor configured peer models and effort in convergence workflows

[Canonical item](../items/BL-260916-honor-configured-peer-models.md) · Stored priority / scope / estimate: **Medium / task / M** · Status: **open**

| Value | Effort | Quadrant | Rationale |
| --- | --- | --- | --- |
| High | Medium | Strategic | Real settings-loss defect across five wrappers and resume; documentation portion already merged. |

- **Dependencies / blocked by:** None; coordinate shared Consensus edits.
- **Blocks:** None; does not block Review.

### BL-260723-make-remaining-consensus-loop — Make remaining consensus-loop write sites atomic

[Canonical item](../items/BL-260723-make-remaining-consensus-loop.md) · Stored priority / scope / estimate: **Low / task / S** · Status: **open**

| Value | Effort | Quadrant | Rationale |
| --- | --- | --- | --- |
| High | Low | Quick Win | Two direct write sites can reuse atomic replacement and failure fixtures. |

- **Dependencies / blocked by:** None; coordinate generated fan-out.
- **Blocks:** None.

### BL-260723-split-loop-free-cli-helpers — Split loop-free cli-helpers core for panel sharing

[Canonical item](../items/BL-260723-split-loop-free-cli-helpers.md) · Stored priority / scope / estimate: **Low / task / S** · Status: **open**

| Value | Effort | Quadrant | Rationale |
| --- | --- | --- | --- |
| Medium | Medium | Fill-in | Useful duplication removal with fan-out/decoupling guards; optional Review preparation, not mandatory cleanup. |

- **Dependencies / blocked by:** None; shared Consensus serialization is soft.
- **Blocks:** None.

### BL-260723-investigate-live-submit — Investigate live submit verdict-source contract mismatch

[Canonical item](../items/BL-260723-investigate-live-submit.md) · Stored priority / scope / estimate: **Medium / task / S** · Status: **open**

| Value | Effort | Quadrant | Rationale |
| --- | --- | --- | --- |
| High | Medium | Strategic | Historical live/stub mismatch remains unresolved; redacted diagnostics and a bounded live run needed. |

- **Dependencies / blocked by:** Explicit paid/live policy authorization before decisive observation.
- **Blocks:** Confidence in that live verification path, not Review implementation.

### BL-260619-inter-agent-direct-messaging — Inter-agent direct messaging (addressable, prioritized)

[Canonical item](../items/BL-260619-inter-agent-direct-messaging.md) · Stored priority / scope / estimate: **Medium / feature / M** · Status: **open**

| Value | Effort | Quadrant | Rationale |
| --- | --- | --- | --- |
| High | Medium | Strategic | Direct workflow demand; bounded inbox still needs safe concurrent publication, acknowledgments and replay handling. |

- **Dependencies / blocked by:** Identity/state/alias design in this project; no merge/fidelity prerequisite.
- **Blocks:** None; N>2 separate.

### BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter

[Canonical item](../items/BL-260916-session-fidelity-opt.md) · Stored priority / scope / estimate: **Medium / feature / L** · Status: **open**

| Value | Effort | Quadrant | Rationale |
| --- | --- | --- | --- |
| High | High | Strategic | Shared read/normalize/projection contract, late-result correlation, Cursor evidence and exporter privacy cross several owners. |

- **Dependencies / blocked by:** Its own activity/privacy design. Re-arm findings are soft input.
- **Blocks:** BL-260619-shared-session-log-substrate — Stateless multi-session activity merge.

### BL-260619-shared-session-log-substrate — Stateless multi-session activity merge

[Canonical item](../items/BL-260619-shared-session-log-substrate.md) · Stored priority / scope / estimate: **Medium / initiative / L** · Status: **open**

| Value | Effort | Quadrant | Rationale |
| --- | --- | --- | --- |
| Medium | Medium | Fill-in | Narrower than old daemon initiative; provenance/order/partial-source bounds remain substantive after fidelity. |

- **Dependencies / blocked by:** BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter; hard contract dependency.
- **Blocks:** None; not messaging or N>2.

### BL-260612-add-deliberation-metrics — Add deliberation metrics (tokens, wall-clock, rounds) to artifacts

[Canonical item](../items/BL-260612-add-deliberation-metrics.md) · Stored priority / scope / estimate: **Low / feature / S** · Status: **open**

| Value | Effort | Quadrant | Rationale |
| --- | --- | --- | --- |
| Medium | Medium | Fill-in | Partial counts exist, but provider signal inventory and resume-safe aggregation exceed a single counter. |

- **Dependencies / blocked by:** None; one shared-loop lane.
- **Blocks:** BL-260612-add-similarity-heuristic — Add similarity heuristic for near-converged deliberation states (soft measurement-first order only).

### BL-260612-add-consensus-research-skill — Add consensus-research skill (investigate question, synthesized findings)

[Canonical item](../items/BL-260612-add-consensus-research-skill.md) · Stored priority / scope / estimate: **Low / feature / M** · Status: **open**

| Value | Effort | Quadrant | Rationale |
| --- | --- | --- | --- |
| Medium | High | Strategic | Potential research payoff, but permissions/provenance and evidence verification require a project rather than a thin wrapper. |

- **Dependencies / blocked by:** Tool-access/provenance go/no-go before build; no active item blocks it.
- **Blocks:** None.

### BL-260612-add-whole-document — Add whole-document harmonization pass after section convergence

[Canonical item](../items/BL-260612-add-whole-document.md) · Stored priority / scope / estimate: **Low / feature / M** · Status: **open**

| Value | Effort | Quadrant | Rationale |
| --- | --- | --- | --- |
| Medium | High | Strategic | Cross-section quality gain with context, fan-in, impasse and resume design cost; no immediate demand over Review. |

- **Dependencies / blocked by:** Context/default decision before build; serialize loop edits.
- **Blocks:** None.

### BL-260612-add-similarity-heuristic — Add similarity heuristic for near-converged deliberation states

[Canonical item](../items/BL-260612-add-similarity-heuristic.md) · Stored priority / scope / estimate: **Low / feature / S** · Status: **open**

| Value | Effort | Quadrant | Rationale |
| --- | --- | --- | --- |
| Low | Medium | Avoid / Defer | Numeric similarity changes convergence safety; no demonstrated need and all-mode auditing makes S optimistic. |

- **Dependencies / blocked by:** Usage evidence and deterministic/agency contract; metrics-first soft.
- **Blocks:** None.

### BL-260701-add-multi-round-panel — Add multi-round panel discussion

[Canonical item](../items/BL-260701-add-multi-round-panel.md) · Stored priority / scope / estimate: **Low / idea / M** · Status: **open**

| Value | Effort | Quadrant | Rationale |
| --- | --- | --- | --- |
| Low | Medium | Avoid / Defer | Boundary decision already satisfied; build remains demand-gated and non-converging. |

- **Dependencies / blocked by:** Usage evidence and bounded-round design.
- **Blocks:** None.

### BL-260713-per-observer-offsets-and-safe — Per-observer offsets and safe N>2 collaboration mesh

[Canonical item](../items/BL-260713-per-observer-offsets-and-safe.md) · Stored priority / scope / estimate: **Low / initiative / L** · Status: **open**

| Value | Effort | Quadrant | Rationale |
| --- | --- | --- | --- |
| Medium | High | Strategic | Real scale boundary, but consumer namespaces/CAS/migration are a separate project without an immediate kickoff. |

- **Dependencies / blocked by:** Topology/ownership decision; merge and messaging are not hard prerequisites.
- **Blocks:** Safe stateful N>2 consumers.

### BL-260713-optional-idle-session — Optional idle-session application integrations

[Canonical item](../items/BL-260713-optional-idle-session.md) · Stored priority / scope / estimate: **Low / idea / M** · Status: **open**

| Value | Effort | Quadrant | Rationale |
| --- | --- | --- | --- |
| Low | Medium | Avoid / Defer | No selected integration target; core bounded-continuation limits remain honest. |

- **Dependencies / blocked by:** Opt-in integration go/no-go and capability evidence.
- **Blocks:** None; does not block queued inboxes.

### BL-260619-define-host-native-dispatch — Define host-native dispatch / safe-packet protocol (reserved seam)

[Canonical item](../items/BL-260619-define-host-native-dispatch.md) · Stored priority / scope / estimate: **Low / initiative / L** · Status: **open**

| Value | Effort | Quadrant | Rationale |
| --- | --- | --- | --- |
| Low | High | Avoid / Defer | Disabled reservation is already safe; no concrete need justifies new execution boundary. |

- **Dependencies / blocked by:** Demand and reviewed safe-packet/execution contract.
- **Blocks:** Enabling host-native dispatch, not CLI Review.

### BL-260619-multi-peer-3-deliberation — Multi-peer (3+) deliberation extension (reserved / v3+ concern)

[Canonical item](../items/BL-260619-multi-peer-3-deliberation.md) · Stored priority / scope / estimate: **Low / idea / L** · Status: **open**

| Value | Effort | Quadrant | Rationale |
| --- | --- | --- | --- |
| Low | High | Avoid / Defer | Group convergence/ties/cost remain speculative; Panel already offers independent breadth. |

- **Dependencies / blocked by:** Demand and group-convergence go/no-go.
- **Blocks:** None.

## 3. Dependency Graph

Only one active-item edge is a hard semantic prerequisite in the proposed delivery plan:

```text
BL-260916-session-fidelity-opt
    └── hard: activity contract ──> BL-260619-shared-session-log-substrate

BL-260916-session-observer-re-armed
    └── soft: bounded investigation first ──> BL-260916-add-consensus-review-cross

BL-260916-honor-configured-peer-models
    └── adjacent, NOT blocking ──> BL-260916-add-consensus-review-cross
BL-260723-split-loop-free-cli-helpers
    └── optional preparation ──> BL-260916-add-consensus-review-cross

BL-260612-add-deliberation-metrics
    └── soft: measurement first ──> BL-260612-add-similarity-heuristic

BL-260619-inter-agent-direct-messaging  [independent of fidelity and merge]
BL-260713-per-observer-offsets-and-safe [separate stateful consumer design]
```

| ID | Title |
| --- | --- |
| BL-260916-session-observer-re-armed | Investigate observer re-arm catch-up and suspected unread-record gaps |
| BL-260916-add-consensus-review-cross | Add consensus-review: cross-model review of a bounded scope |
| BL-260916-honor-configured-peer-models | Honor configured peer models and effort in convergence workflows |
| BL-260723-split-loop-free-cli-helpers | Split loop-free cli-helpers core for panel sharing |
| BL-260619-inter-agent-direct-messaging | Inter-agent direct messaging (addressable, prioritized) |
| BL-260916-session-fidelity-opt | Session fidelity: opt-in --include-activity for observer and exporter |
| BL-260619-shared-session-log-substrate | Stateless multi-session activity merge |
| BL-260612-add-deliberation-metrics | Add deliberation metrics (tokens, wall-clock, rounds) to artifacts |
| BL-260612-add-similarity-heuristic | Add similarity heuristic for near-converged deliberation states |
| BL-260713-per-observer-offsets-and-safe | Per-observer offsets and safe N>2 collaboration mesh |

Design gates in the catalog are internal prerequisites, not invented backlog edges. Shared files require coordinated ownership/rebasing even when two items are technically independent. No item is newly blocked by an unimplemented daemon.

## 4. Parallel Lanes

| Lane | Items | Effort / coordination |
| --- | --- | --- |
| Primary workflow | **BL-260916-session-observer-re-armed — Observer re-arm investigation**, then **BL-260916-add-consensus-review-cross — Consensus Review** | Low investigation then High feature; Sol's investigation is started and Review is confirmed next; they may proceed concurrently. |
| Parallel onboarding | **BL-260916-add-a-first-party-install — First-party standalone installer** | Medium; independent source ownership, coordinate installation/release docs and packaging tests. |
| Consensus integrity | **BL-260916-honor-configured-peer-models — Peer model/effort forwarding**; **BL-260723-make-remaining-consensus-loop — Atomic loop writes**; **BL-260723-split-loop-free-cli-helpers — Loop-free helper core** | Medium / Low / Medium. Serialize overlapping shared runtime/generated output edits with Review. |
| Live-provider evidence | **BL-260723-investigate-live-submit — Live submit verdict-source investigation** | Medium, explicitly authorization-gated. Deterministic tracing can precede a paid run. |
| Collaboration | **BL-260619-inter-agent-direct-messaging — Provider-neutral direct messaging** | Medium design/build, independent of merge; coordinate observer/collab state and bounded continuation. |
| Transcript evidence | **BL-260916-session-fidelity-opt — Session fidelity activity view**, then **BL-260619-shared-session-log-substrate — Stateless multi-session activity merge** | High then Medium; same transcript/observer surfaces, sequential contract delivery. |

These are available technical lanes, not six approved simultaneous projects. Research and broader deliberation quality remain queued; N>2 and idle integration retain their own design gates.

### Complete item-to-project grouping

The prior review described lanes; this map makes the actual grouping explicit. **16 candidate projects cover all 19 items exactly once.** Two combinations are useful: three Consensus-maintenance tickets with separate acceptance/commits, and metrics plus an evidence-gated similarity phase. The other fourteen remain single-ticket projects. A thematic group is not permission to bundle unrelated scope into Review.

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

## 5. Recommended Execution Order

### Wave 1 — Current workflow

1. **BL-260916-session-observer-re-armed — Observer re-arm investigation**: bounded reproduction; if only diagnostic ambiguity is found, document it rather than expanding into fidelity.
2. **BL-260916-add-consensus-review-cross — Consensus Review**: design scope capture, supported read-only policy, reviewer preferences, and output contracts, then implement one dispatched invocation.
3. Confirmed parallel lane: **BL-260916-add-a-first-party-install — First-party standalone installer**; the user selects its owner and kickoff.

### Wave 2 — Correctness and independent collaboration

- **BL-260916-honor-configured-peer-models — Peer model/effort forwarding** and **BL-260723-make-remaining-consensus-loop — Atomic loop writes**: independent correctness changes, serialize shared output ownership.
- **BL-260723-split-loop-free-cli-helpers — Loop-free helper core**: pull forward only if Review implementation benefits; do not gate feature delivery on unrelated refactoring.
- **BL-260723-investigate-live-submit — Live submit verdict-source investigation**: schedule a deliberately authorized live observation; this review is not that grant.
- **BL-260619-inter-agent-direct-messaging — Provider-neutral direct messaging** and **BL-260916-session-fidelity-opt — Session fidelity activity view**: separate projects; either can start first after capacity review. Coordinate shared observer files.

### Wave 3 — Evidence-driven expansion

**BL-260619-shared-session-log-substrate — Stateless multi-session activity merge** follows the fidelity contract. Research, metrics, harmonization, similarity, multi-round panel, N>2, idle integration, and reserved dispatch/group-convergence work remain Later in the roadmap. They are not abandoned; each needs the stated demand/design gate before kickoff.

## 6. Roadmap Alignment

| Horizon | Covered items |
| --- | --- |
| Now | **BL-260916-session-observer-re-armed — Observer re-arm investigation**; **BL-260916-add-consensus-review-cross — Consensus Review**; parallel **BL-260916-add-a-first-party-install — First-party standalone installer**. |
| Next | **BL-260916-honor-configured-peer-models — Peer model/effort forwarding**; **BL-260723-make-remaining-consensus-loop — Atomic loop writes**; **BL-260723-split-loop-free-cli-helpers — Loop-free helper core**; **BL-260723-investigate-live-submit — Live submit investigation**; **BL-260619-inter-agent-direct-messaging — Direct messaging**; **BL-260916-session-fidelity-opt — Session fidelity activity view**. |
| Later | **BL-260619-shared-session-log-substrate — Stateless multi-session activity merge**; **BL-260713-per-observer-offsets-and-safe — Safe N>2 mesh**; **BL-260713-optional-idle-session — Idle integrations**; **BL-260612-add-consensus-research-skill — Consensus Research**; **BL-260612-add-deliberation-metrics — Deliberation metrics**; **BL-260612-add-similarity-heuristic — Similarity heuristic**; **BL-260612-add-whole-document — Whole-document harmonization**; **BL-260701-add-multi-round-panel — Multi-round panel**; **BL-260619-define-host-native-dispatch — Host-native dispatch**; **BL-260619-multi-peer-3-deliberation — Multi-peer deliberation**. |

**Orphans:** none after this refresh; all 19 items are mapped.

**Coverage gaps:** per-workflow saved defaults and activating reserved roles remain known limitations without dedicated items. Keep them out of the peer-model fix unless separately scoped. Publication/provider discovery for current distributions remains an operator checklist, not implied completion or a dependency on new features. Historical extra-provider/typed-fixture/orchestration ideas are not active commitments.

**Drift corrected:** completed Session packaging and docs work removed from future lanes; current skill names and source ownership restored; daemon-first/messaging dependency removed; transitive version guard removed from active review; config-doc completion distinguished from runtime completion.

## 7. Observations & Recommendations

### Evidence anchors

Paths below are repository-relative and were checked against the review baseline; line numbers can move with later implementation.

| Claim | Source |
| --- | --- |
| Nine standalone payloads; nine Consensus members and four Session members | `src/distributions.ts`; plugin manifests. |
| Catch-up happens before establishing next-index watch baseline; catchUpFirst emits observed delta | `src/skills/session-observer/src/lib/watch.ts:1152–1255`; existing `watch.test.ts:456` covers initial catch-up. |
| Offset persistence is distinct from emitted/harness-delivered content | `src/skills/session-observer/src/lib/observe.ts:416`; restart-after-signal renderable-message proof remains to be added. |
| Convergence settings are reduced to providers; Panel forwards them | `src/skills/refine/src/consensus-refine.ts:900`; `src/skills/panel/src/consensus-panel.ts:1336–1352`; other four convergence wrappers have the same mapping. |
| Review needs its own new config key | `src/plugins/consensus/config/consensus-config.ts:91` allows peers, panelists, panel_size, roles, not reviewers. |
| Cursor adapter lacks requested read-only policy | `src/plugins/consensus/provider-cli/adapters.ts:249–254`; do not silently weaken Review policy. |
| Atomic sites still use direct writeFile | `src/plugins/consensus/core/consensus-loop.ts:196–202,246–265`. |
| Live submit assertion and fallback are different contracts | `src/plugins/consensus/provider-cli/e2e/submit-live.e2e.test.ts:76–79`; `structured-output.ts:222–246` in the same provider-cli directory. |
| No general Codex call-result activity projection | `src/shared/transcript/runtimes.ts:1741`; exporter normalizes/sanitizes at `src/skills/session-export-transcript/src/session-export-transcript.ts:579`. |
| Existing near-match behavior is not numeric similarity | `src/plugins/consensus/core/loop-escalation.ts:44–52`: maximum agency can accept unequal hashes with double ACCEPT. |

### Risks and controls

| Risk | Control |
| --- | --- |
| Diagnose message loss from filtered raw gaps | Reproduce with known renderable content; track persisted, emitted, and delivered states separately. |
| Claim cross-model independence from provider name | Record actual model evidence or unknown; different provider is not proof of different family. |
| Treat worktree access as edit permission or total isolation | Require supported read-only policy, bounded scope, mutation diagnostics, and explicit detection limits. |
| Scope estimates hide design/verification work | Preserve stored estimates but use reviewed effort: Review High, installer Medium, metrics/similarity Medium, narrowed merge Medium. Re-estimate at project kickoff. |
| Research packet or external plan copied against stale paths | Reconcile pinned research with current owners. September 7 live-submit plan's writable-default claim is stale; current Codex test defaults read-only but permits override. |
| Inboxes create an accidental second wake mechanism | Reuse existing continuation/authority budget; queue availability is not wake capability or recipient acknowledgment. |
| Concurrent shared-source changes cause version/output drift | Coordinate owners and regenerate from declarations; transitive version guard already exists. |

No product source, global install, provider configuration, or live runtime was changed by this review. No additional decision record was finalized; implementation design gates remain explicit. Keep the research packet and backlog lineage; the superseded July kickoff handoffs have been replaced for the confirmed three-lane stack.

### Quick wins

- **BL-260916-session-observer-re-armed — Observer re-arm investigation:** small diagnostic scope with a clear escalation boundary if genuine loss is found.
- **BL-260723-make-remaining-consensus-loop — Atomic loop writes:** two known replacement sites and existing failure-test patterns.

External implementation plans are an optional next step through `oat-repo-improve`; this review does not generate or execute them.
