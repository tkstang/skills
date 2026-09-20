# Backlog & Roadmap Review

**Date:** 2026-09-20
**Scope:** All 29 active item files under `.oat/repo/pjm/backlog/items/`; merged source at `be6cab1e859ae786b34fc2194249ed2d00493fd6`.
**Roadmap:** `.oat/repo/pjm/roadmap.md`
**Purpose:** Value/effort review, dependency mapping and proposed execution order after Session Fidelity and Agent Messaging.
**Decision state:** Review recommendations only. Current cycle lane count, kickoff membership and order await the operator walkthrough. The September 16 [priority alignment](priority-alignment.md) is historical and contains completed kickoff work; do not execute it as the current queue.

## 1. Executive Summary

All **29 items remain active**. No acceptance-complete item was found that can honestly be closed merely because PRs #96 and #98 merged. The installer is implemented but deliberately open for live host acceptance. Both completed feature items are already archived.

| Quadrant | Count |
| --- | ---: |
| Quick Win | 1 |
| Strategic | 14 |
| Fill-in | 4 |
| Avoid / Defer | 10 |

**Top recommended next actions:**

1. Deliver one useful, frozen, evidence-backed retro with [BL-260919-session-retro-consume-activity — Session-retro: consume activity evidence](../items/BL-260919-session-retro-consume-activity.md) and prepare skill attribution through [BL-260919-skill-attribution-in-session — Skill attribution in session activity events](../items/BL-260919-skill-attribution-in-session.md). These can have separate owners; the retro can start with the current Markdown export.
2. Start [BL-260919-uncapped-structured-activity — Uncapped structured activity export for cross-session analysis](../items/BL-260919-uncapped-structured-activity.md) once the attribution/report fields are agreed; follow with [BL-260919-skill-evaluation-retro — Skill evaluation retro: activation, adherence, outcome, efficiency](../items/BL-260919-skill-evaluation-retro.md). Keep the consumer useful throughout rather than waiting for a larger analysis platform.
3. Reserve a bounded reliability/acceptance lane: first reproduce [BL-260919-stabilize-the-watcher-sigterm — Stabilize the watcher SIGTERM re-arm test](../items/BL-260919-stabilize-the-watcher-sigterm.md), then choose identity/history/terminal-event work or [BL-260919-verify-live-agent-messaging — Verify live agent-messaging host acceptance](../items/BL-260919-verify-live-agent-messaging.md) according to current pain and operator availability.

**Fable context:** Stateless observer review of Claude session `5be26fca-ebaa-4cb4-9ada-6601c2f5971d`, in this worktree, captured through JSONL record 4410. The relevant final discussion covered thirteen evidence/retro/protocol items plus the watcher test; the operator approved filing and delegated sizing. That approval did not settle this cycle’s implementation order. PR #93, which filed them, is now merged.

The primary application is evaluating whether skills work: activation, adherence, outcome and efficiency remain separate. Compact conversation remains the normal view; activity is pulled for behavioral evidence. A single session yields candidate improvements. Repeated findings can later justify changes. No automatic skill rewriting is implied.

**Export boundary:** Existing Markdown activity export has no invocation-count cap but retains a 64 MiB rendering budget and 2 KiB per-preview bounds. A retro must inspect omission/coverage accounting before calling that capture complete. Structured export must meet its own complete-inventory contract, not silently inherit display truncation.

**Refinements to the discussion:** A findings ledger stores conclusions, not raw activity, and does not inherently require a merged activity stream. The first retro can use complete Markdown now. Skill-version inference must remain unknown when historical installation evidence is missing; today’s file is not proof of the executed version. Token counts and elapsed time do not establish counterfactual savings from a different model.

## 2. Item Catalog

Value: **High** unlocks work or fixes a demonstrated workflow problem; **Medium** improves quality without blocking immediate use; **Low** is speculative or demand-gated. Effort is remaining implementation/verification work: **Low** under one day, **Medium** one to three days, **High** over three days or cross-cutting. Live scheduling and repeated CI can add elapsed time. These review estimates do not overwrite item frontmatter.

Quadrants: **Quick Win** = high value/low effort; **Strategic** = worthwhile investment requiring planning; **Fill-in** = useful independent work after the primary consumer; **Avoid / Defer** = insufficient demand or disproportionate cost this cycle. A medium-value/high-effort item can be Strategic but still queued behind demonstrated demand.

| Item | Status | Filed priority | Scope / estimate | Review value / effort | Quadrant |
| --- | --- | --- | --- | --- | --- |
| [BL-260612-add-consensus-research-skill — Add consensus-research skill (investigate question, synthesized findings)](../items/BL-260612-add-consensus-research-skill.md) | open | low | feature / M | Low / High | Avoid / Defer |
| [BL-260612-add-deliberation-metrics — Add deliberation metrics (tokens, wall-clock, rounds) to artifacts](../items/BL-260612-add-deliberation-metrics.md) | open | low | feature / S | Medium / Medium | Fill-in |
| [BL-260612-add-similarity-heuristic — Add similarity heuristic for near-converged deliberation states](../items/BL-260612-add-similarity-heuristic.md) | open | low | feature / S | Low / Medium | Avoid / Defer |
| [BL-260612-add-whole-document — Add whole-document harmonization pass after section convergence](../items/BL-260612-add-whole-document.md) | open | low | feature / M | Medium / High | Avoid / Defer |
| [BL-260619-define-host-native-dispatch — Define host-native dispatch / safe-packet protocol (reserved seam)](../items/BL-260619-define-host-native-dispatch.md) | open | low | initiative / L | Low / High | Avoid / Defer |
| [BL-260619-multi-peer-3-deliberation — Multi-peer (3+) deliberation extension (reserved / v3+ concern)](../items/BL-260619-multi-peer-3-deliberation.md) | open | low | idea / L | Low / High | Avoid / Defer |
| [BL-260619-shared-session-log-substrate — Stateless multi-session activity merge](../items/BL-260619-shared-session-log-substrate.md) | open | medium | initiative / L | Medium / High | Strategic |
| [BL-260701-add-multi-round-panel — Add multi-round panel discussion](../items/BL-260701-add-multi-round-panel.md) | open | low | idea / M | Low / High | Avoid / Defer |
| [BL-260713-optional-idle-session — Optional idle-session application integrations](../items/BL-260713-optional-idle-session.md) | open | low | idea / M | Low / High | Avoid / Defer |
| [BL-260713-per-observer-offsets-and-safe — Per-observer offsets and safe N>2 collaboration mesh](../items/BL-260713-per-observer-offsets-and-safe.md) | open | low | initiative / L | Medium / High | Avoid / Defer |
| [BL-260723-investigate-live-submit — Investigate live submit verdict-source contract mismatch](../items/BL-260723-investigate-live-submit.md) | open | medium | task / S | High / Medium | Strategic |
| [BL-260916-add-a-first-party-install — Add a first-party install command for standalone skills](../items/BL-260916-add-a-first-party-install.md) | open | medium | feature / S | High / Medium | Strategic |
| [BL-260919-collaboration-protocol-peer — Collaboration protocol: peer-initiated headless resume and provenance](../items/BL-260919-collaboration-protocol-peer.md) | open | medium | task / S | High / Medium | Strategic |
| [BL-260919-delegation-and-subagent — Delegation and subagent evaluation in retros](../items/BL-260919-delegation-and-subagent.md) | open | medium | feature / M | Medium / Medium | Fill-in |
| [BL-260919-grouped-activity-summaries — Grouped activity summaries and derived enrichments adapted from cli-continues](../items/BL-260919-grouped-activity-summaries.md) | open | low | feature / M | Low / Medium | Avoid / Defer |
| [BL-260919-improve-default-observer — Improve default observer digest coverage and full-history recovery](../items/BL-260919-improve-default-observer.md) | open | medium | task / S | High / Medium | Strategic |
| [BL-260919-locate-and-pin-claude-code — Locate and pin Claude Code subagent transcripts](../items/BL-260919-locate-and-pin-claude-code.md) | open | medium | feature / M | High / Medium | Strategic |
| [BL-260919-read-linked-session-sidecars — Read linked session sidecars in the activity view](../items/BL-260919-read-linked-session-sidecars.md) | open | medium | feature / L | Medium / High | Strategic |
| [BL-260919-reintroduce-deferred-activity — Reintroduce deferred activity correlation and provenance](../items/BL-260919-reintroduce-deferred-activity.md) | open | low | feature / M | Low / Medium | Avoid / Defer |
| [BL-260919-resolve-codex-self-identity — Resolve Codex self identity with duplicate rollout candidates](../items/BL-260919-resolve-codex-self-identity.md) | open | medium | task / S | High / Medium | Strategic |
| [BL-260919-retro-findings-ledger — Retro findings ledger with recurrence detection](../items/BL-260919-retro-findings-ledger.md) | open | medium | feature / M | Medium / Medium | Fill-in |
| [BL-260919-session-retro-consume-activity — Session-retro: consume activity evidence](../items/BL-260919-session-retro-consume-activity.md) | open | high | feature / M | High / Medium | Strategic |
| [BL-260919-skill-attribution-in-session — Skill attribution in session activity events](../items/BL-260919-skill-attribution-in-session.md) | open | high | feature / S | High / Medium | Strategic |
| [BL-260919-skill-evaluation-retro — Skill evaluation retro: activation, adherence, outcome, efficiency](../items/BL-260919-skill-evaluation-retro.md) | open | high | feature / M | High / Medium | Strategic |
| [BL-260919-stabilize-the-watcher-sigterm — Stabilize the watcher SIGTERM re-arm test](../items/BL-260919-stabilize-the-watcher-sigterm.md) | open | medium | task / S | High / Low | Quick Win |
| [BL-260919-surface-terminally — Surface terminally unsuccessful peer turns as watch events](../items/BL-260919-surface-terminally.md) | open | medium | feature / S | High / Medium | Strategic |
| [BL-260919-token-and-usage-accounting — Token and usage accounting for session activity](../items/BL-260919-token-and-usage-accounting.md) | open | medium | feature / S | Medium / Medium | Fill-in |
| [BL-260919-uncapped-structured-activity — Uncapped structured activity export for cross-session analysis](../items/BL-260919-uncapped-structured-activity.md) | open | high | feature / M | High / Medium | Strategic |
| [BL-260919-verify-live-agent-messaging — Verify live agent-messaging host acceptance](../items/BL-260919-verify-live-agent-messaging.md) | open | medium | task / S | High / Medium | Strategic |

### BL-260612-add-consensus-research-skill — Add consensus-research skill (investigate question, synthesized findings)

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | Low | A new research product adds tool-access and evidence-provenance decisions; no current blocker requires it. Shipped parallel synthesis is reusable, but does not settle peer research permissions. |
| Effort | High | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Avoid / Defer | Proposed wave: Demand-led. |

- **Dependencies / blocked by:** No active item dependency; tool-access/provenance design and go/no-go first.
- **Blocks:** No unconditional active-item completion edge; conditional and soft dependencies are described above.

### BL-260612-add-deliberation-metrics — Add deliberation metrics (tokens, wall-clock, rounds) to artifacts

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | Medium | Round counts and wall-clock already exist; remaining work is consistent provider usage, per-section aggregation and resume behavior. The S estimate understates cross-wrapper coverage. |
| Effort | Medium | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Fill-in | Proposed wave: Later measurement. |

- **Dependencies / blocked by:** No hard dependency. Useful before similarity experiments; separate from retrospective transcript usage.
- **Blocks:** No unconditional active-item completion edge; conditional and soft dependencies are described above.

### BL-260612-add-similarity-heuristic — Add similarity heuristic for near-converged deliberation states

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | Low | No measured demand yet; a new deterministic score affects convergence correctness. Existing maximum-agency double ACCEPT is not a similarity algorithm. |
| Effort | Medium | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Avoid / Defer | Proposed wave: Demand-led. |

- **Dependencies / blocked by:** Usage evidence and scoring design first; deliberation metrics are a soft prerequisite.
- **Blocks:** No unconditional active-item completion edge; conditional and soft dependencies are described above.

### BL-260612-add-whole-document — Add whole-document harmonization pass after section convergence

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | Medium | Potential output quality gain, but sequential fan-in, bounded context and interrupted-resume handling span Refine execution. Build only when section inconsistency is observed. |
| Effort | High | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Avoid / Defer | Proposed wave: Demand-led. |

- **Dependencies / blocked by:** All sections must finish before harmonization within a run; no active item prerequisite.
- **Blocks:** No unconditional active-item completion edge; conditional and soft dependencies are described above.

### BL-260619-define-host-native-dispatch — Define host-native dispatch / safe-packet protocol (reserved seam)

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | Low | Reserved capability needs a foundational history/authority contract and a concrete caller. The shipped adapters intentionally advertise false. |
| Effort | High | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Avoid / Defer | Proposed wave: Parked. |

- **Dependencies / blocked by:** Explicit design/go-no-go and capability proof; messaging does not enable this flag.
- **Blocks:** No unconditional active-item completion edge; conditional and soft dependencies are described above.

### BL-260619-multi-peer-3-deliberation — Multi-peer (3+) deliberation extension (reserved / v3+ concern)

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | Low | Three-way convergence introduces tie, oscillation and cost semantics without current demand. Three-session messaging is a different capability. |
| Effort | High | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Avoid / Defer | Proposed wave: Parked. |

- **Dependencies / blocked by:** Concrete two-peer limitation, then design/go-no-go.
- **Blocks:** No unconditional active-item completion edge; conditional and soft dependencies are described above.

### BL-260619-shared-session-log-substrate — Stateless multi-session activity merge

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | Medium | Fidelity now supplies the activity contract, but multi-pin ordering, missing-source evidence and packaging need a separate design. It is not needed for a first retro or messaging. |
| Effort | High | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Strategic | Proposed wave: After consumer evidence. |

- **Dependencies / blocked by:** Merged fidelity prerequisite satisfied. Structured export is useful reuse, not a required CLI/file hop. Keep recorded ordering distinct from causality.
- **Blocks:** No unconditional active-item completion edge; conditional and soft dependencies are described above.

### BL-260701-add-multi-round-panel — Add multi-round panel discussion

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | Low | Current product is independent single-round breadth. Additional rounds introduce orchestration, timeouts and artifact state; demand must justify the cost. |
| Effort | High | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Avoid / Defer | Proposed wave: Demand-led. |

- **Dependencies / blocked by:** Usage evidence; preserve accepted neutral, attributed, non-converging panel decisions.
- **Blocks:** No unconditional active-item completion edge; conditional and soft dependencies are described above.

### BL-260713-optional-idle-session — Optional idle-session application integrations

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | Low | Host-specific background wake has substantial lifecycle/permission maintenance. Prove the finite active-session messaging tiers first. |
| Effort | High | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Avoid / Defer | Proposed wave: Parked. |

- **Dependencies / blocked by:** No hard item edge; live messaging results should inform any selected host integration.
- **Blocks:** No unconditional active-item completion edge; conditional and soft dependencies are described above.

### BL-260713-per-observer-offsets-and-safe — Per-observer offsets and safe N>2 collaboration mesh

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | Medium | Independent cursors and concurrent-consumer recovery are substantial state ownership work. Messaging for 3+ sessions does not establish demand for a full observation mesh. |
| Effort | High | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Avoid / Defer | Proposed wave: Parked. |

- **Dependencies / blocked by:** Concrete N>2 observation need and ownership design. No hard dependency on stateless merge.
- **Blocks:** No unconditional active-item completion edge; conditional and soft dependencies are described above.

### BL-260723-investigate-live-submit — Investigate live submit verdict-source contract mismatch

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | High | A known live/stub discrepancy limits trust in the release gate. Diagnosis is bounded, but reproduction, current policy and contract reconciliation make total effort uncertain. |
| Effort | Medium | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Strategic | Proposed wave: Acceptance slot. |

- **Dependencies / blocked by:** Approved bounded provider run; refresh the September 7 external plan against current paths and runtime policy.
- **Blocks:** No unconditional active-item completion edge; conditional and soft dependencies are described above.

### BL-260916-add-a-first-party-install — Add a first-party install command for standalone skills

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | High | Implementation shipped in PR #90. Remaining value is proving advertised discovery/invocation/permissions across six host/scope combinations, not building another installer. |
| Effort | Medium | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Strategic | Proposed wave: Acceptance slot. |

- **Dependencies / blocked by:** Suitable pinned release/tag and agreed live host/install scope; retain active status until all advertised acceptance passes.
- **Blocks:** No unconditional active-item completion edge; conditional and soft dependencies are described above.

### BL-260919-collaboration-protocol-peer — Collaboration protocol: peer-initiated headless resume and provenance

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | High | Unagreed headless resumes create ambiguous authorship in the same transcript. Clarify allowed behavior and evidence limits; wording alone cannot manufacture recorded provenance. |
| Effort | Medium | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Strategic | Proposed wave: Reliability and authority. |

- **Dependencies / blocked by:** Operator policy decision plus evidence of distinguishable entrypoints. No dependency on new messaging transport.
- **Blocks:** No unconditional active-item completion edge; conditional and soft dependencies are described above.

### BL-260919-delegation-and-subagent — Delegation and subagent evaluation in retros

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | Medium | Useful once basic retros exist; separate parent-visible delegation from child activity and distinguish necessary verification from repeated implementation work. |
| Effort | Medium | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Fill-in | Proposed wave: Deeper retros. |

- **Dependencies / blocked by:** Filed hard dependencies: activity-backed retro and Claude child pinning. Usage is conditional for cost claims.
- **Blocks:** No unconditional active-item completion edge; conditional and soft dependencies are described above.

### BL-260919-grouped-activity-summaries — Grouped activity summaries and derived enrichments adapted from cli-continues

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | Low | Presentation enrichments do not unlock initial findings. Copy donor code only after recurring need, with attribution and corrected truncation/statistics behavior. |
| Effort | Medium | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Avoid / Defer | Proposed wave: Demand-led. |

- **Dependencies / blocked by:** Fidelity satisfied; recurring consumer need required.
- **Blocks:** No unconditional active-item completion edge; conditional and soft dependencies are described above.

### BL-260919-improve-default-observer — Improve default observer digest coverage and full-history recovery

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | High | Initial reads can hide earlier decisions behind a tail window. Pagination/full-history recovery and mark-read semantics make this more than a wording fix. |
| Effort | Medium | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Strategic | Proposed wave: Reliability and authority. |

- **Dependencies / blocked by:** No hard item dependency; keep independent from activity extraction. Coordinate observer digest/CLI ownership.
- **Blocks:** No unconditional active-item completion edge; conditional and soft dependencies are described above.

### BL-260919-locate-and-pin-claude-code — Locate and pin Claude Code subagent transcripts

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | High | Unlocks separately reviewable child evidence without implementing recursive sidecar merge. Exact child identity and mixed linkage forms require deliberate tests. |
| Effort | Medium | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Strategic | Proposed wave: Deeper retros. |

- **Dependencies / blocked by:** Fidelity satisfied; explicit identity/linkage contract and fail-closed stateful support.
- **Blocks:** [BL-260919-delegation-and-subagent — Delegation and subagent evaluation in retros](../items/BL-260919-delegation-and-subagent.md); [BL-260919-read-linked-session-sidecars — Read linked session sidecars in the activity view](../items/BL-260919-read-linked-session-sidecars.md)

### BL-260919-read-linked-session-sidecars — Read linked session sidecars in the activity view

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | Medium | Closes child and oversized-output evidence gaps, but linked-path confinement, bounded recursion and inherited history make this expensive. Prioritize only after separate child exports prove insufficient. |
| Effort | High | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Strategic | Proposed wave: After consumer evidence. |

- **Dependencies / blocked by:** Filed hard dependency: Claude child pinning; fidelity satisfied.
- **Blocks:** No unconditional active-item completion edge; conditional and soft dependencies are described above.

### BL-260919-reintroduce-deferred-activity — Reintroduce deferred activity correlation and provenance

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | Low | Three optional mechanisms were deliberately cut. Implement only the specific native join, process handle or byte-range consumer that becomes necessary. |
| Effort | Medium | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Avoid / Defer | Proposed wave: Demand-led. |

- **Dependencies / blocked by:** Each subfeature needs its own recorded evidence/consumer; no blanket reintroduction.
- **Blocks:** No unconditional active-item completion edge; conditional and soft dependencies are described above.

### BL-260919-resolve-codex-self-identity — Resolve Codex self identity with duplicate rollout candidates

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | High | Exact self identity can block safe collaboration. Fidelity changed native identity rules, so begin with the reported collision regression before proposing more identity machinery. |
| Effort | Medium | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Strategic | Proposed wave: Reliability and authority. |

- **Dependencies / blocked by:** No hard dependency; re-evaluate partial coverage on merged main. Distinguish invalid, absent and ambiguous candidates.
- **Blocks:** No unconditional active-item completion edge; conditional and soft dependencies are described above.

### BL-260919-retro-findings-ledger — Retro findings ledger with recurrence detection

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | Medium | A small file-based findings store supports recurrence after useful findings exist. Premature schema design risks storing weak conclusions more efficiently. |
| Effort | Medium | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Fill-in | Proposed wave: After repeated retros. |

- **Dependencies / blocked by:** Filed hard dependencies: activity-backed retro and skill evaluation. Structured activity export is optional for automation, not required to store findings.
- **Blocks:** No unconditional active-item completion edge; conditional and soft dependencies are described above.

### BL-260919-session-retro-consume-activity — Session-retro: consume activity evidence

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | High | Fastest user-visible payoff: freeze an exact activity export and analyze behavior, corrections and recovery. Existing canonical retro already separates interpretations and unknown versions. |
| Effort | Medium | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Strategic | Proposed wave: First consumer. |

- **Dependencies / blocked by:** Fidelity satisfied. Full Markdown export is available now; neither structured export nor attribution is a hard prerequisite.
- **Blocks:** [BL-260919-skill-evaluation-retro — Skill evaluation retro: activation, adherence, outcome, efficiency](../items/BL-260919-skill-evaluation-retro.md); [BL-260919-delegation-and-subagent — Delegation and subagent evaluation in retros](../items/BL-260919-delegation-and-subagent.md); [BL-260919-retro-findings-ledger — Retro findings ledger with recurrence detection](../items/BL-260919-retro-findings-ledger.md)

### BL-260919-skill-attribution-in-session — Skill attribution in session activity events

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | High | Supports the primary skill-evaluation use case. Native Claude fields are small; available-skill extraction, inferred file reads on other runtimes and honest version recovery make the complete item larger than its S label. |
| Effort | Medium | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Strategic | Proposed wave: First consumer. |

- **Dependencies / blocked by:** Fidelity satisfied. Coordinate shared activity schema with structured export.
- **Blocks:** [BL-260919-skill-evaluation-retro — Skill evaluation retro: activation, adherence, outcome, efficiency](../items/BL-260919-skill-evaluation-retro.md)

### BL-260919-skill-evaluation-retro — Skill evaluation retro: activation, adherence, outcome, efficiency

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | High | Turns the evidence into activation/adherence/outcome/efficiency findings. Build after the base retro contract and attribution settle; decide mode vs separate skill during discovery. |
| Effort | Medium | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Strategic | Proposed wave: Skill evaluation. |

- **Dependencies / blocked by:** Hard: activity-backed retro and skill attribution. Usage accounting only for token/cost-based findings.
- **Blocks:** [BL-260919-retro-findings-ledger — Retro findings ledger with recurrence detection](../items/BL-260919-retro-findings-ledger.md)

### BL-260919-stabilize-the-watcher-sigterm — Stabilize the watcher SIGTERM re-arm test

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | High | A bounded CI reliability improvement protects unrelated PRs. Reproduce on merged main first; the 50-run/load and three-CI-run acceptance adds elapsed time beyond edit effort. |
| Effort | Low | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Quick Win | Proposed wave: Reliability first. |

- **Dependencies / blocked by:** The former fidelity-stack sequencing constraint is satisfied. Product race vs fixture timing remains a hypothesis until reproduced.
- **Blocks:** No unconditional active-item completion edge; conditional and soft dependencies are described above.

### BL-260919-surface-terminally — Surface terminally unsuccessful peer turns as watch events

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | High | Recorded failed turns should not look like silence. Deduplication, quiet-empty behavior and runtime-specific terminal shapes need a real event contract. |
| Effort | Medium | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Strategic | Proposed wave: Reliability and authority. |

- **Dependencies / blocked by:** No hard item dependency; coordinate watcher changes with SIGTERM stabilization. Never turn a terminal event into continuation authority.
- **Blocks:** No unconditional active-item completion edge; conditional and soft dependencies are described above.

### BL-260919-token-and-usage-accounting — Token and usage accounting for session activity

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | Medium | Needed for quantitative efficiency, not basic adherence. Native-message dedup, compaction resets and inconsistent model attribution make complete accounting larger than a simple counter. |
| Effort | Medium | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Fill-in | Proposed wave: Later measurement. |

- **Dependencies / blocked by:** Fidelity satisfied. Conditional input to skill/delegation cost findings; no monetary figures without configured prices.
- **Blocks:** No unconditional active-item completion edge; conditional and soft dependencies are described above.

### BL-260919-uncapped-structured-activity — Uncapped structured activity export for cross-session analysis

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | High | Enables deterministic analysis over complete invocation inventories while retaining bounded previews and coverage. Existing complete Markdown report construction should be reused. |
| Effort | Medium | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Strategic | Proposed wave: Structured evidence. |

- **Dependencies / blocked by:** Fidelity satisfied. Soft sequencing after attribution to avoid immediate schema churn; can begin in parallel with retro instruction work.
- **Blocks:** No unconditional active-item completion edge; conditional and soft dependencies are described above.

### BL-260919-verify-live-agent-messaging — Verify live agent-messaging host acceptance

| Dimension | Rating | Rationale |
| --- | --- | --- |
| Value | High | PR #98 delivered deterministic implementation, not observed host delivery. Multiple Codex/Claude tiers and the finite Monitor need distinct receipts. |
| Effort | Medium | Remaining scope, including its acceptance checks; see dependency boundary below. |
| Quadrant | Strategic | Proposed wave: Acceptance slot. |

- **Dependencies / blocked by:** Bounded authorization and exact enrolled identities per run; identity diagnosis is a conditional blocker only if reproduced on the target.
- **Blocks:** No unconditional active-item completion edge; conditional and soft dependencies are described above.

## 3. Dependency Graph

```text
Merged fidelity contract [satisfied] -> attribution
Merged fidelity contract [satisfied] -> activity-retro
Merged fidelity contract [satisfied] -> structured-export
Merged fidelity contract [satisfied] -> child-pinning
Merged fidelity contract [satisfied] -> stateless-merge

attribution ------> skill-evaluation <------ activity-retro
activity-retro ---> delegation <------------ child-pinning
child-pinning ----> linked-sidecars
activity-retro ---> findings-ledger <------- skill-evaluation

attribution - - -> structured-export - - -> stateless-merge
structured-export - - -> findings-ledger automation
usage - - -> quantitative skill/delegation findings
loop-metrics - - -> similarity experiment
identity diagnosis - - -> live-messaging [only if same ambiguity reproduces]
```

Solid arrows are filed completion prerequisites; dashed arrows are soft or conditional. The merge and ledger can consume shared internal APIs or findings rather than requiring an exported JSON file. Independent work: watcher reliability, default history recovery, terminal events, resume policy, installer acceptance and live-submit diagnosis.

**Graph legend:**

| Token | Item |
| --- | --- |
| attribution | [BL-260919-skill-attribution-in-session — Skill attribution in session activity events](../items/BL-260919-skill-attribution-in-session.md) |
| activity-retro | [BL-260919-session-retro-consume-activity — Session-retro: consume activity evidence](../items/BL-260919-session-retro-consume-activity.md) |
| structured-export | [BL-260919-uncapped-structured-activity — Uncapped structured activity export for cross-session analysis](../items/BL-260919-uncapped-structured-activity.md) |
| child-pinning | [BL-260919-locate-and-pin-claude-code — Locate and pin Claude Code subagent transcripts](../items/BL-260919-locate-and-pin-claude-code.md) |
| stateless-merge | [BL-260619-shared-session-log-substrate — Stateless multi-session activity merge](../items/BL-260619-shared-session-log-substrate.md) |
| skill-evaluation | [BL-260919-skill-evaluation-retro — Skill evaluation retro: activation, adherence, outcome, efficiency](../items/BL-260919-skill-evaluation-retro.md) |
| delegation | [BL-260919-delegation-and-subagent — Delegation and subagent evaluation in retros](../items/BL-260919-delegation-and-subagent.md) |
| linked-sidecars | [BL-260919-read-linked-session-sidecars — Read linked session sidecars in the activity view](../items/BL-260919-read-linked-session-sidecars.md) |
| findings-ledger | [BL-260919-retro-findings-ledger — Retro findings ledger with recurrence detection](../items/BL-260919-retro-findings-ledger.md) |
| usage | [BL-260919-token-and-usage-accounting — Token and usage accounting for session activity](../items/BL-260919-token-and-usage-accounting.md) |
| loop-metrics | [BL-260612-add-deliberation-metrics — Add deliberation metrics (tokens, wall-clock, rounds) to artifacts](../items/BL-260612-add-deliberation-metrics.md) |
| similarity experiment | [BL-260612-add-similarity-heuristic — Add similarity heuristic for near-converged deliberation states](../items/BL-260612-add-similarity-heuristic.md) |
| identity diagnosis | [BL-260919-resolve-codex-self-identity — Resolve Codex self identity with duplicate rollout candidates](../items/BL-260919-resolve-codex-self-identity.md) |
| live-messaging | [BL-260919-verify-live-agent-messaging — Verify live agent-messaging host acceptance](../items/BL-260919-verify-live-agent-messaging.md) |

## 4. Parallel Lanes

These are candidate ownership lanes, not an instruction to start all of them. The operator selects actual concurrency.

| Lane | Sequence and scope | Effort / conflicts |
| --- | --- | --- |
| Evidence producer | [BL-260919-skill-attribution-in-session — Skill attribution in session activity events](../items/BL-260919-skill-attribution-in-session.md) → [BL-260919-uncapped-structured-activity — Uncapped structured activity export for cross-session analysis](../items/BL-260919-uncapped-structured-activity.md) → [BL-260919-locate-and-pin-claude-code — Locate and pin Claude Code subagent transcripts](../items/BL-260919-locate-and-pin-claude-code.md) | High total. Shared activity/identity modules and affected consumer versions; agree schema first. |
| Retro consumer | [BL-260919-session-retro-consume-activity — Session-retro: consume activity evidence](../items/BL-260919-session-retro-consume-activity.md) → [BL-260919-skill-evaluation-retro — Skill evaluation retro: activation, adherence, outcome, efficiency](../items/BL-260919-skill-evaluation-retro.md) → [BL-260919-delegation-and-subagent — Delegation and subagent evaluation in retros](../items/BL-260919-delegation-and-subagent.md) / [BL-260919-retro-findings-ledger — Retro findings ledger with recurrence detection](../items/BL-260919-retro-findings-ledger.md) | High total. Canonical `src/skills/session-retro/`; skill evaluation waits for attribution, delegation waits for child pinning. |
| Reliability | [BL-260919-stabilize-the-watcher-sigterm — Stabilize the watcher SIGTERM re-arm test](../items/BL-260919-stabilize-the-watcher-sigterm.md); [BL-260919-resolve-codex-self-identity — Resolve Codex self identity with duplicate rollout candidates](../items/BL-260919-resolve-codex-self-identity.md); [BL-260919-improve-default-observer — Improve default observer digest coverage and full-history recovery](../items/BL-260919-improve-default-observer.md); [BL-260919-surface-terminally — Surface terminally unsuccessful peer turns as watch events](../items/BL-260919-surface-terminally.md); [BL-260919-collaboration-protocol-peer — Collaboration protocol: peer-initiated headless resume and provenance](../items/BL-260919-collaboration-protocol-peer.md) | High aggregate, individually bounded. Serialize watcher/identity changes with evidence producer edits to shared modules. |
| Acceptance | [BL-260916-add-a-first-party-install — Add a first-party install command for standalone skills](../items/BL-260916-add-a-first-party-install.md); [BL-260919-verify-live-agent-messaging — Verify live agent-messaging host acceptance](../items/BL-260919-verify-live-agent-messaging.md); [BL-260723-investigate-live-submit — Investigate live submit verdict-source contract mismatch](../items/BL-260723-investigate-live-submit.md) | Medium per item, host-dependent elapsed time. Independent code lane but requires operator host availability and bounded execution authorization. |

Generated payloads, `src/distributions.ts`, skill versions and changelog are shared integration surfaces across lanes. Runtime dependency freedom remains intact. Keep independently reviewable commits and coordinate regeneration; parallel work is not conflict-free just because backlog files differ.

## 5. Recommended Execution Order

| Wave | Outcome | Items / condition |
| --- | --- | --- |
| 0 — Clear current friction | Trust initial collaboration reads and CI | Reproduce [BL-260919-stabilize-the-watcher-sigterm — Stabilize the watcher SIGTERM re-arm test](../items/BL-260919-stabilize-the-watcher-sigterm.md) and [BL-260919-resolve-codex-self-identity — Resolve Codex self identity with duplicate rollout candidates](../items/BL-260919-resolve-codex-self-identity.md) on main. Select fixes based on evidence; do not let a speculative rewrite delay the consumer lane. |
| 1 — First useful retro | Export one exact session, inspect behavior and corrections | [BL-260919-session-retro-consume-activity — Session-retro: consume activity evidence](../items/BL-260919-session-retro-consume-activity.md) alongside [BL-260919-skill-attribution-in-session — Skill attribution in session activity events](../items/BL-260919-skill-attribution-in-session.md). Start with existing Markdown evidence. |
| 2 — Skill evaluation and structured capture | Explain whether a skill helped | [BL-260919-skill-evaluation-retro — Skill evaluation retro: activation, adherence, outcome, efficiency](../items/BL-260919-skill-evaluation-retro.md) after attribution/retro; [BL-260919-uncapped-structured-activity — Uncapped structured activity export for cross-session analysis](../items/BL-260919-uncapped-structured-activity.md) can overlap consumer work after schema agreement. |
| 3 — Deeper evidence where needed | Inspect child work and quantitative efficiency | [BL-260919-locate-and-pin-claude-code — Locate and pin Claude Code subagent transcripts](../items/BL-260919-locate-and-pin-claude-code.md) → [BL-260919-delegation-and-subagent — Delegation and subagent evaluation in retros](../items/BL-260919-delegation-and-subagent.md); add [BL-260919-token-and-usage-accounting — Token and usage accounting for session activity](../items/BL-260919-token-and-usage-accounting.md) when token-based questions matter. |
| 4 — Repeated findings | Query recurring supported conclusions | [BL-260919-retro-findings-ledger — Retro findings ledger with recurrence detection](../items/BL-260919-retro-findings-ledger.md) after several actual retro artifacts demonstrate the field/query needs. [BL-260619-shared-session-log-substrate — Stateless multi-session activity merge](../items/BL-260619-shared-session-log-substrate.md) and [BL-260919-read-linked-session-sidecars — Read linked session sidecars in the activity view](../items/BL-260919-read-linked-session-sidecars.md) remain separate demand-led projects. |

**Acceptance runs are schedulable alongside any wave**, not implicitly lowest priority: reserve a host session when ready and collect exact boundary receipts. Reliability fixes can replace a producer slot when blocking daily work; do not add unlimited parallel branches.

### Deferred

- [BL-260612-add-consensus-research-skill — Add consensus-research skill (investigate question, synthesized findings)](../items/BL-260612-add-consensus-research-skill.md): A new research product adds tool-access and evidence-provenance decisions; no current blocker requires it. Shipped parallel synthesis is reusable, but does not settle peer research permissions.
- [BL-260612-add-similarity-heuristic — Add similarity heuristic for near-converged deliberation states](../items/BL-260612-add-similarity-heuristic.md): No measured demand yet; a new deterministic score affects convergence correctness. Existing maximum-agency double ACCEPT is not a similarity algorithm.
- [BL-260612-add-whole-document — Add whole-document harmonization pass after section convergence](../items/BL-260612-add-whole-document.md): Potential output quality gain, but sequential fan-in, bounded context and interrupted-resume handling span Refine execution. Build only when section inconsistency is observed.
- [BL-260619-define-host-native-dispatch — Define host-native dispatch / safe-packet protocol (reserved seam)](../items/BL-260619-define-host-native-dispatch.md): Reserved capability needs a foundational history/authority contract and a concrete caller. The shipped adapters intentionally advertise false.
- [BL-260619-multi-peer-3-deliberation — Multi-peer (3+) deliberation extension (reserved / v3+ concern)](../items/BL-260619-multi-peer-3-deliberation.md): Three-way convergence introduces tie, oscillation and cost semantics without current demand. Three-session messaging is a different capability.
- [BL-260701-add-multi-round-panel — Add multi-round panel discussion](../items/BL-260701-add-multi-round-panel.md): Current product is independent single-round breadth. Additional rounds introduce orchestration, timeouts and artifact state; demand must justify the cost.
- [BL-260713-optional-idle-session — Optional idle-session application integrations](../items/BL-260713-optional-idle-session.md): Host-specific background wake has substantial lifecycle/permission maintenance. Prove the finite active-session messaging tiers first.
- [BL-260713-per-observer-offsets-and-safe — Per-observer offsets and safe N>2 collaboration mesh](../items/BL-260713-per-observer-offsets-and-safe.md): Independent cursors and concurrent-consumer recovery are substantial state ownership work. Messaging for 3+ sessions does not establish demand for a full observation mesh.
- [BL-260919-grouped-activity-summaries — Grouped activity summaries and derived enrichments adapted from cli-continues](../items/BL-260919-grouped-activity-summaries.md): Presentation enrichments do not unlock initial findings. Copy donor code only after recurring need, with attribution and corrected truncation/statistics behavior.
- [BL-260919-reintroduce-deferred-activity — Reintroduce deferred activity correlation and provenance](../items/BL-260919-reintroduce-deferred-activity.md): Three optional mechanisms were deliberately cut. Implement only the specific native join, process handle or byte-range consumer that becomes necessary.

## 6. Roadmap Alignment

The roadmap covers every active item. This pass corrected its pre-merge operating language and the current-state/index baseline; proposed priorities remain distinct from the historical approved kickoff.

| Area | Alignment / correction |
| --- | --- |
| Completed foundations | PR #96 (Session Fidelity) and PR #98 (Agent Messaging) are merged. Remove fidelity from the future queue and messaging from branch-only descriptions. |
| Onboarding | Installer source shipped in PR #90; the remaining item is live acceptance across advertised host/scope boundaries. Preserve its open status. |
| Evidence / retro | Four filed high-priority items align with the operator’s stated skill-evaluation goal. Prioritize the usable consumer alongside attribution; structured export supports subsequent automation. |
| Reliability / protocol | Present on roadmap but not ordered by live pain. Exact identity, recoverable history and terminal visibility can unblock collaboration; headless-resume policy is independent of transport. |
| Later / reserved | Keep merge, sidecars, ledger, metrics, research, panel and N>2 observation separate. Three-session messaging does not close group convergence or consumer cursor ownership. |

**Coverage gaps:** Release/discovery verification for already-shipped plugins and Consensus Review is represented by `RELEASING.md`, not a complete dedicated active backlog matrix. Installer and messaging cover their own acceptance only. If release readiness becomes the cycle objective, capture a bounded release-verification item rather than treating either existing ticket as all-product acceptance.

**Orphans:** None among the 29 active items. Held ideas (skill-version comparison, workflow telemetry, within-runtime model comparison, watch emission filtering) remain roadmap ideas, not hidden implementation commitments.

**Stale artifacts:** September 16 priority alignment names completed projects and broken active-item links. Refresh it only after the operator agrees the new stack. The sole installer handoff must become an acceptance handoff if retained, or be removed if dropped from the agreed kickoff; no new handoffs are selected by this review alone.

## 7. Observations & Recommendations

1. Ship the consumer early. A concrete retro can reveal whether richer activity data changes a finding; avoid adding capture features solely because the source contains fields.
2. Preserve unknowns. Reading `SKILL.md` is evidence of a load, not proof of invocation/adherence; a current install cannot prove a historical version. Outcome corroboration outside the frozen transcript must carry its own capture and provenance.
3. Separate call-level efficiency from cost and causal claims. Repeated reads may be redundant or necessary verification. Report the pattern and its limits before calling it waste.
4. Match effort to full acceptance. Several S items include multi-runtime contracts, six live host/scope cells, or repeated CI. The catalog’s Medium estimates expose this without silently changing accepted item scope.
5. Keep source ownership canonical. Changes go under `src/skills/`, shared runtime under `src/shared/`, followed by affected versions/changelog/build. User-level installs track merged main; the observer was refreshed to merged 1.0.71 during this review, which is not a provider acceptance receipt.

| Risk | Mitigation |
| --- | --- |
| Old roadmap is mistaken for the new approved stack | Label recommendations and wait for the collaborative alignment decision before writing kickoff handoffs. |
| Building all fidelity follow-ups before using them | Start a single-session retro now; pull sidecars, correlation and richer summaries only when actual findings need them. |
| False attribution or version certainty | Preserve native/inferred/unknown distinctions and original evidence locators. |
| Same shared runtime edited in multiple lanes | Assign module ownership and sequence schema/identity changes; regenerate outputs at integration. |
| Tests are mistaken for live acceptance | Keep exact host/install/delivery receipts separate from deterministic fixtures. |
| Existing code changes are mistaken for complete backlog acceptance | Regression/acceptance audit first; archive only when all criteria are satisfied. |

**Quick win:** [BL-260919-stabilize-the-watcher-sigterm — Stabilize the watcher SIGTERM re-arm test](../items/BL-260919-stabilize-the-watcher-sigterm.md) is the clearest high-value/low-edit-effort candidate, subject to reproduction on merged main and its full load/CI acceptance. Policy wording or installer reimplementation should not be mislabeled as easy completion.

### Evidence checked

- GitHub: [PR #90](https://github.com/tkstang/skills/pull/90), [PR #93](https://github.com/tkstang/skills/pull/93), [PR #96](https://github.com/tkstang/skills/pull/96), [PR #98](https://github.com/tkstang/skills/pull/98) are merged as of 2026-09-20. `gh release list` still returns only the June Consensus `v0.1.0` release; merged manifests are not publication evidence.
- All active item descriptions/criteria, completed index, roadmap/current-state and historical alignment were read. `oat pjm doctor --json` reports `adoption.state: declared`.
- `src/skills/session-retro/SKILL.md:28` already provides bounded, read-only evidence and unknown executed-version handling; the new work should strengthen that existing skill rather than replace its safeguards.
- `src/skills/create/src/consensus-create.ts:927` and `src/skills/refine/src/refine-render.ts:365` already render rounds/wall-clock; cost remains unavailable.
- `src/plugins/consensus/core/loop-escalation.ts:20` confirms hash/verdict convergence and the maximum-agency double-ACCEPT behavior; no numerical similarity score.
- `src/plugins/consensus/provider-cli/adapters.ts:158` and peer adapter declarations keep host-native dispatch false. Accepted panel breadth/moderator records remain authoritative.

No product implementation, live provider run, hook activation, release or publication was performed in this planning pass. Product behavior was assessed from source and existing receipts; new behavioral acceptance is not claimed.

Additional checked source anchors: `src/shared/transcript/activity/project.ts:46` defines export budgets; `src/skills/session-export-transcript/src/session-export-transcript.ts:888` constructs full-range Markdown activity; `src/shared/transcript/activity/claude-code.ts:43` and `types.ts:91` lack attribution fields. `src/skills/session-observer/src/lib/locate.ts:1937` validates exact candidates and rejects ambiguity, but does not establish the outstanding duplicate-rollout reproduction. `src/skills/session-observer/src/watch.test.ts:889` owns the SIGTERM fixture. `src/plugins/consensus/provider-cli/structured-output.ts:255` accepts valid submit evidence then falls back to final-message extraction; the live test at `e2e/submit-live.e2e.test.ts:76` still requires submit provenance.
