# Backlog & Roadmap Review

**Date:** 2026-06-22
**Scope:** All active items under `.oat/repo/pjm/backlog/items/` (15 open items)
**Roadmap:** `.oat/repo/pjm/roadmap.md`
**Purpose:** Prioritize by value/effort, surface dependencies, and recommend an execution sequence

> If a one-page execution companion exists in this directory, see [`priority-alignment.md`](./priority-alignment.md) - produced via the optional walkthrough at the end of `oat-pjm-review-backlog`. It is the short, ordered "what to do next" view of this full review.

---

## 1. Executive Summary

The backlog contains **15 active items** after the v0.1 release, docs IA, consensus-family implementation, and provider-CLI hardening work were completed and archived. The board has shifted from "finish the v0.1 foundation" to three active decisions:

1. Control the public discovery surface before any skills.sh or marketplace listing claim.
2. Take the cheap reliability wins that reduce CI/release friction.
3. Choose the next product lane: advisory peer utility first, then the design-gated `consensus-research` wrapper, while larger substrate and reserved-protocol work remains deferred.

| Theme | Count | Key Observation |
| --- | --- | --- |
| Release / discovery control | 1 | `bl-7c1d` (Control public skill discovery surface on skills.sh) is the only roadmap-Now item still represented as active backlog work. It gates public listing claims. |
| Test and reliability hardening | 2 | `bl-1f9c` (De-flake the session-observer watch test suite) and `bl-3913` (Add a test guarding bundled rubric examples at <=12 parser-visible criteria) are small, local, high-signal guardrail work. |
| New skill surface | 2 | `bl-22d3` (Add phone-a-friend advisory peer skill) is buildable now and should validate the new docs IA; `bl-645c` (Add consensus-research skill) is a separate design-gated wrapper because peer tool access/evidence capture needs a decision. |
| Consensus runtime quality | 5 | `bl-9ed4` (Add deliberation metrics), `bl-ef38` (Add similarity heuristic), `bl-e39a` (Add whole-document harmonization pass), `bl-db5d` (LLM section auto-chunking fallback), and `bl-58b3` (Mid-loop user artifact edits) are useful but not release-blocking. Several should be decision-first. |
| Plugin packaging maintainability | 1 | `bl-e0e7` (Share consensus generated runtime output at the plugin level) is worthwhile but spike-gated across installed plugin layouts. |
| Multi-agent collaboration substrate | 2 | `bl-4e2e` (Shared session log substrate) is the foundation; `bl-f59f` (Inter-agent direct messaging) is hard-blocked behind it. |
| Reserved protocol seeds | 2 | `bl-3ca6` (Define host-native dispatch / safe-packet protocol) and `bl-f8cb` (Multi-peer 3+ deliberation extension) are explicit go/no-go seeds, not implementation-ready work. |

**Quadrant distribution:**

| Quadrant | Count | Items |
| --- | --- | --- |
| Quick Win | 3 | `bl-1f9c` (De-flake the session-observer watch test suite); `bl-3913` (Add a test guarding bundled rubric examples at <=12 parser-visible criteria); `bl-9ed4` (Add deliberation metrics) |
| Strategic | 7 | `bl-7c1d` (Control public skill discovery surface on skills.sh); `bl-22d3` (Add phone-a-friend advisory peer skill); `bl-e0e7` (Share consensus generated runtime output at the plugin level); `bl-645c` (Add consensus-research skill); `bl-e39a` (Add whole-document harmonization pass); `bl-4e2e` (Shared session log substrate); `bl-f59f` (Inter-agent direct messaging) |
| Fill-in | 3 | `bl-ef38` (Add similarity heuristic); `bl-db5d` (LLM section auto-chunking fallback); `bl-58b3` (Mid-loop user artifact edits) |
| Avoid / Defer | 2 | `bl-3ca6` (Define host-native dispatch / safe-packet protocol); `bl-f8cb` (Multi-peer 3+ deliberation extension) |

**Top-line recommendations:**

1. **Do `bl-7c1d` (Control public skill discovery surface on skills.sh) before any public listing claim.** The v0.1 tag is out, but `.agents/skills/**` and plugin-bound consensus skills still need an intentional discovery story before skills.sh or marketplace language becomes true.
2. **Batch `bl-1f9c` (De-flake the session-observer watch test suite) with `bl-3913` (Add a test guarding bundled rubric examples at <=12 parser-visible criteria).** Both are narrow reliability work, and `bl-1f9c` directly addresses release/CI friction already observed in the live repo.
3. **Use `bl-22d3` (Add phone-a-friend advisory peer skill) as the next feature build.** It is independent, depends on already-shipped provider CLI/docs foundations, and is a better next validation of the docs IA than starting the heavier `bl-645c` (Add consensus-research skill) design question immediately.

---

## 2. Item Catalog

### Rating Key

| Rating | Value | Effort |
| --- | --- | --- |
| **High** | Unblocks other items, daily workflow impact, or product milestone prerequisite | > 3 days, high complexity, or touches many files |
| **Medium** | Improves quality/consistency but not blocking | 1-3 days, moderate complexity |
| **Low** | Nice-to-have or future-facing | < 1 day, straightforward, isolated change |

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

---

### bl-7c1d - Control public skill discovery surface on skills.sh

> Prevent OAT tooling and plugin-bound consensus skills from being misrepresented as standalone public skills before any skills.sh listing claim.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **High** | This is the only active backlog item directly tied to the roadmap's post-tag public discovery gate. It protects external claims and prevents broken standalone installs. |
| **Effort** | **Medium** | Requires OAT sync-layer handling for `.agents/skills/**`, shipped-skill content/behavior changes for consensus self-redirects, version bumps, generated output, and live discovery verification. |
| **Quadrant** | **Strategic** | High value with cross-surface verification; do before any public listing/submission language. |

- **Dependencies:** v0.1 release evidence and provider install knowledge from `bl-d85f` (Complete v0.1 release verification and tag), already archived.
- **Blocked by:** Nothing hard.
- **Blocks:** Public skills.sh listing claims and any broader public-discovery/submission claim until verified.

---

### bl-1f9c - De-flake the session-observer watch test suite

> Replace timing-sensitive watch tests with deterministic stop/teardown behavior so CI and hooks stop failing under load.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **High** | The flakes already affected the v0.1 tag push and PR validation. Removing them improves release confidence and developer velocity. |
| **Effort** | **Low** | The failing surfaces are known: tight `maxRuntimeMin` budgets and a real SIGTERM subprocess race in `tests/session-observer/watch.test.ts`. A test-only change avoids shipped skill version-bump scope unless generated runtime changes become necessary. |
| **Quadrant** | **Quick Win** | High value, small surface, and concrete reproduction clues. |

- **Dependencies:** None.
- **Blocked by:** Nothing.
- **Blocks:** Nothing formally, but reduces future release and pre-push friction.

---

### bl-3913 - Add a test guarding bundled rubric examples at <=12 parser-visible criteria

> Add a focused Vitest guard so bundled evaluate example rubrics cannot silently exceed the parser-visible criteria cap.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Medium** | Prevents a known class of rubric truncation regression in shipped examples. It is not product-critical, but it preserves authoring quality. |
| **Effort** | **Low** | Test-only, localized to `tests/consensus/evaluate/` and the canonical parser behavior. No runtime or example-content change is expected. |
| **Quadrant** | **Quick Win** | Cheap guardrail; pairs well with other test reliability work. |

- **Dependencies:** Current Vitest-only test layout, already shipped.
- **Blocked by:** Nothing.
- **Blocks:** Nothing.

---

### bl-22d3 - Add phone-a-friend advisory peer skill

> Add a one-shot provider-backed advisory peer skill without running the full consensus deliberation loop.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Medium** | High practical utility for design/review uncertainty and a good first validation that the docs IA absorbs a new skill cleanly. It is useful but does not unblock another backlog item. |
| **Effort** | **Medium** | New shipped skill, output schema, context inference, peer selection, recursion/self-spawn safety, docs, tests, and a naming decision. Provider CLI and docs foundations already exist. |
| **Quadrant** | **Strategic** | Independent feature work with visible user value; good next feature after immediate cleanup. |

- **Dependencies:** Owned provider CLI, provider preflight, and documentation site, all shipped.
- **Blocked by:** Nothing.
- **Blocks:** Nothing formally; acts as the first post-docs-IA new-skill validation.

---

### bl-e0e7 - Share consensus generated runtime output at the plugin level

> Replace per-skill duplicated `consensus-loop.mjs` generated outputs with one plugin-local shared runtime if installed host layouts prove it works.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Medium** | Reduces duplicated generated output across `create`, `decide`, `plan`, `refine`, and `evaluate`, making future loop changes easier to ship. |
| **Effort** | **Medium** | The code migration is moderate, but the real work is a 4-host install/layout spike plus drift guard/docs/test updates. The spike can still decide to keep duplication. |
| **Quadrant** | **Strategic** | Maintainability payoff, but only after plugin-local shared scripts are proven across hosts. |

- **Dependencies:** Current generated-runtime build pipeline and installed-layout evidence from v0.1 release verification.
- **Blocked by:** Nothing hard now that consensus-family work is complete, but avoid running it concurrently with any active `consensus-loop` feature branch.
- **Blocks:** Nothing.

---

### bl-645c - Add consensus-research skill (investigate question, synthesized findings)

> Add the remaining consensus-family wrapper for research questions, synthesized findings, evidence, and dissent.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Medium** | Completes the six-skill family and is on the roadmap's Next list, but lower urgency because research turns introduce permissions/evidence concerns distinct from text-editing wrappers. |
| **Effort** | **Medium** | The wrapper itself can reuse shipped loop patterns, but peer tool access, evidence capture, and permissions need an explicit design decision before build. |
| **Quadrant** | **Strategic** | Worth doing, but as a design-led project rather than a thin-wrapper sprint. |

- **Dependencies:** `parallel_synthesized` iteration and provider CLI, already shipped. Uses `shared_input`, so it does not depend on independent-draft work.
- **Blocked by:** Peer tool-access and evidence-capture decision.
- **Blocks:** Nothing else in the current active backlog.

---

### bl-9ed4 - Add deliberation metrics (tokens, wall-clock, rounds) to artifacts

> Report consistent rounds, wall-clock, token/cost availability, and related metrics in consensus artifacts.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Medium** | Improves observability and supports future budget/cost controls. Peer call and synthesis call totals already exist, so this makes the artifact contract more complete. |
| **Effort** | **Low** | The loop has status and record plumbing plus a `CostSource` type; provider cost/token fields may remain unavailable with explicit semantics. |
| **Quadrant** | **Quick Win** | A small, useful observability pass if kept to graceful availability semantics. |

- **Dependencies:** Existing consensus-loop status/record fields and provider CLI diagnostics.
- **Blocked by:** Nothing, as long as unavailable token/cost data is represented honestly.
- **Blocks:** Future hard cost-cap work if pursued.

---

### bl-ef38 - Add similarity heuristic for near-converged deliberation states

> Add a deterministic similarity threshold for almost-converged states so trivial phrasing drift can avoid unnecessary escalation.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low** | Nice-to-have quality improvement. Strict deterministic hash convergence already works and agency escalation handles ambiguous drift. |
| **Effort** | **Low** | Small algorithm/test surface if limited to deterministic normalized edit-distance-style scoring and clear audit disclosure. |
| **Quadrant** | **Fill-in** | Useful when nearby loop work is open, but not a priority by itself. |

- **Dependencies:** Existing normalization/hash convergence rules.
- **Blocked by:** Nothing.
- **Blocks:** Nothing.

---

### bl-e39a - Add whole-document harmonization pass after section convergence

> Run a post-convergence pass over the assembled document to resolve cross-section drift, repetition, and flow issues.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Medium** | Addresses a known v0.1 limitation for multi-section documents and improves final artifact quality. |
| **Effort** | **Medium** | Requires new post-section orchestration, resume behavior, context-bounding decision, tests, docs, and parallel fan-in composition. |
| **Quadrant** | **Strategic** | Meaningful quality work, but best sequenced after smaller reliability/discovery tasks. |

- **Dependencies:** Existing sequential and host-mediated parallel section orchestration.
- **Blocked by:** Context-bounding decision: assembled document only vs assembled document plus section logs.
- **Blocks:** Nothing.

---

### bl-db5d - LLM section auto-chunking fallback (--sections auto-llm)

> Decide whether opt-in LLM-generated section boundaries are worth the non-determinism for unstructured documents.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low** | Whole-document fallback is already available. This helps only documents with poor structure where automated boundaries are worth audit complexity. |
| **Effort** | **Low** | The next useful step is a decision, not implementation. A build would be larger because resume/audit reproducibility must be addressed. |
| **Quadrant** | **Fill-in** | Decision-only fill-in; may resolve `wont_do`. |

- **Dependencies:** Existing deterministic heading/marker/user-boundary sectioning.
- **Blocked by:** Product decision on whether non-deterministic sectioning is acceptable.
- **Blocks:** Nothing.

---

### bl-58b3 - Mid-loop user artifact edits (type=edit intervention)

> Decide whether artifact edits during resume need a first-class `type=edit` intervention distinct from existing artifact-edit-then-resume behavior.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low** | Existing artifact-as-state resume already allows manual edits between runs. The open question is audit semantics, not missing core capability. |
| **Effort** | **Low** | The decision is small; implementation can stay deferred unless a real workflow need appears. |
| **Quadrant** | **Fill-in** | Decision-only fill-in; likely pair with resume/audit work. |

- **Dependencies:** Existing resume protocol and `USER_INTERVENTION` / `HOST_DECISION` records.
- **Blocked by:** Product decision on whether distinct audit semantics are needed.
- **Blocks:** Nothing.

---

### bl-4e2e - Shared session log substrate (become-observable daemon + merged log)

> Add a project-scoped multi-agent observation substrate: registration, daemon, merged filtered log, lifecycle, and identity.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Medium** | Opens a new collaboration lane and establishes primitives that direct messaging reuses, but it is foundation work rather than immediate product polish. |
| **Effort** | **High** | Initiative-sized: adopt-vs-build on `cass`, daemon lifecycle, schema/filtering, packaging, heartbeat/cleanup, reactivation, and state/identity conventions. |
| **Quadrant** | **Strategic** | A real lane, but it needs design before build and should not displace immediate discovery/reliability work. |

- **Dependencies:** Existing `session-observer` cursor/high-water-mark and transcript parsing patterns.
- **Blocked by:** Design pass on adopt-vs-build, packaging, and merged-log schema.
- **Blocks:** `bl-f59f` (Inter-agent direct messaging).

---

### bl-f59f - Inter-agent direct messaging (addressable, prioritized)

> Add project-scoped direct messages between named agents, checked before ambient shared-log catch-up.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Medium** | Adds targeted signal on top of ambient multi-agent observation; useful only after the substrate exists. |
| **Effort** | **Medium** | Reuses substrate identity/state if available, but still needs build-vs-adopt and message lifecycle decisions. |
| **Quadrant** | **Strategic** | Valuable as the second half of the collaboration lane, not a standalone start. |

- **Dependencies:** `bl-4e2e` (Shared session log substrate).
- **Blocked by:** `bl-4e2e` (Shared session log substrate).
- **Blocks:** Nothing.

---

### bl-3ca6 - Define host-native dispatch / safe-packet protocol (reserved seam)

> Decide whether host-native dispatch is worth pursuing and, if so, define the safety/audit packet contract before any adapter enables it.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low** | This is a safety anchor for a reserved extension point, not a current capability gap. The prompt/CLI floor is working. |
| **Effort** | **High** | A real implementation would involve safety packet contents, conversation-history boundaries, execution contract, audit fields, and adapter capability transitions. |
| **Quadrant** | **Avoid / Defer** | Keep as a guardrail seed; do not build without a concrete host-native need. |

- **Dependencies:** Provider CLI reserved capability flags from the archived provider-CLI work.
- **Blocked by:** Go/no-go decision.
- **Blocks:** Any future adapter flip to host-native dispatch support.

---

### bl-f8cb - Multi-peer (3+) deliberation extension (reserved / v3+ concern)

> Decide whether deliberation needs more than two peers and design group convergence/tie semantics if it ever does.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low** | Speculative. Two-peer deliberation is the current product shape and no concrete 3+ peer need is documented. |
| **Effort** | **High** | Would affect convergence semantics, verdict aggregation, oscillation handling, cost behavior, and UX across iteration modes. |
| **Quadrant** | **Avoid / Defer** | Explicitly parked v3+ concern; revisit only with evidence. |

- **Dependencies:** None beyond the existing consensus loop.
- **Blocked by:** Go/no-go decision with evidence that two peers are insufficient.
- **Blocks:** Nothing.

---

## 3. Dependency Graph

```text
Legend:  -->  hard dependency
         ~~>  soft/sequencing dependency

bl-4e2e --> bl-f59f

bl-7c1d ~~> public listing / marketplace claim (roadmap gap, no item yet)
bl-22d3 ~~> validates new docs IA for post-docs skill additions
bl-e0e7 ~~> future consensus-loop maintenance
bl-9ed4 ~~> future hard cost-cap item if one is filed

bl-1f9c [independent]
bl-3913 [independent]
bl-645c [design-gated: peer tool access/evidence capture]
bl-ef38 [independent fill-in]
bl-e39a [design-gated: harmonization context]
bl-db5d [decision-first]
bl-58b3 [decision-first]
bl-3ca6 [go/no-go reserved seam]
bl-f8cb [go/no-go reserved seam]
```

**ID legend**

| ID | Title |
| --- | --- |
| bl-7c1d | Control public skill discovery surface on skills.sh |
| bl-1f9c | De-flake the session-observer watch test suite |
| bl-3913 | Add a test guarding bundled rubric examples at <=12 parser-visible criteria |
| bl-22d3 | Add phone-a-friend advisory peer skill |
| bl-e0e7 | Share consensus generated runtime output at the plugin level |
| bl-645c | Add consensus-research skill (investigate question, synthesized findings) |
| bl-9ed4 | Add deliberation metrics (tokens, wall-clock, rounds) to artifacts |
| bl-ef38 | Add similarity heuristic for near-converged deliberation states |
| bl-e39a | Add whole-document harmonization pass after section convergence |
| bl-db5d | LLM section auto-chunking fallback (--sections auto-llm) |
| bl-58b3 | Mid-loop user artifact edits (type=edit intervention) |
| bl-4e2e | Shared session log substrate (become-observable daemon + merged log) |
| bl-f59f | Inter-agent direct messaging (addressable, prioritized) |
| bl-3ca6 | Define host-native dispatch / safe-packet protocol (reserved seam) |
| bl-f8cb | Multi-peer (3+) deliberation extension (reserved / v3+ concern) |

---

## 4. Parallel Lanes

### Lane A: Release Discovery Control

Controls what the repo exposes publicly before any hosted skills.sh or marketplace claim.

```text
bl-7c1d (Control public skill discovery surface on skills.sh)
```

**Items in this lane:**

- **bl-7c1d** - Control public skill discovery surface on skills.sh

**Total estimated effort:** Medium
**Cross-lane dependencies:** Coordinate with docs/release messaging; do not claim public listing until verification lands.

### Lane B: Test Reliability and Guardrails

Small changes that increase confidence without product-design churn.

```text
bl-1f9c (De-flake the session-observer watch test suite)
bl-3913 (Add a test guarding bundled rubric examples at <=12 parser-visible criteria)
```

**Items in this lane:**

- **bl-1f9c** - De-flake the session-observer watch test suite
- **bl-3913** - Add a test guarding bundled rubric examples at <=12 parser-visible criteria

**Total estimated effort:** Low to Medium
**Cross-lane dependencies:** None.

### Lane C: New Skill Surface

Build the next useful skill first, then tackle the research wrapper as a separate design-gated project.

```text
bl-22d3 (Add phone-a-friend advisory peer skill)
  ~~> bl-645c (Add consensus-research skill)
```

**Items in this lane:**

- **bl-22d3** - Add phone-a-friend advisory peer skill
- **bl-645c** - Add consensus-research skill (investigate question, synthesized findings)

**Total estimated effort:** Medium to High
**Cross-lane dependencies:** `bl-645c` (Add consensus-research skill) needs a peer tool-access/evidence decision.

### Lane D: Plugin Packaging Maintainability

Spike and, if viable, simplify generated consensus runtime layout.

```text
bl-e0e7 (Share consensus generated runtime output at the plugin level)
```

**Items in this lane:**

- **bl-e0e7** - Share consensus generated runtime output at the plugin level

**Total estimated effort:** Medium
**Cross-lane dependencies:** Avoid concurrent `consensus-loop` feature branches.

### Lane E: Consensus Runtime Quality

Quality and observability improvements for existing consensus workflows.

```text
bl-9ed4 (Add deliberation metrics)
bl-ef38 (Add similarity heuristic)
bl-e39a (Add whole-document harmonization pass)
bl-db5d (LLM section auto-chunking fallback)
bl-58b3 (Mid-loop user artifact edits)
```

**Items in this lane:**

- **bl-9ed4** - Add deliberation metrics (tokens, wall-clock, rounds) to artifacts
- **bl-ef38** - Add similarity heuristic for near-converged deliberation states
- **bl-e39a** - Add whole-document harmonization pass after section convergence
- **bl-db5d** - LLM section auto-chunking fallback (--sections auto-llm)
- **bl-58b3** - Mid-loop user artifact edits (type=edit intervention)

**Total estimated effort:** Medium to High if bundled; low for the decision-only seeds.
**Cross-lane dependencies:** `bl-e39a` (Add whole-document harmonization pass) composes with section orchestration and resume; decision seeds can be resolved independently.

### Lane F: Multi-Agent Collaboration Substrate

Design and build ambient observation before direct messaging.

```text
bl-4e2e (Shared session log substrate)
  --> bl-f59f (Inter-agent direct messaging)
```

**Items in this lane:**

- **bl-4e2e** - Shared session log substrate (become-observable daemon + merged log)
- **bl-f59f** - Inter-agent direct messaging (addressable, prioritized)

**Total estimated effort:** High
**Cross-lane dependencies:** None, but this lane should start only when there is appetite for a full design/build initiative.

### Lane G: Reserved Protocol Seeds

Keep future extension seams visible, but do not implement without new evidence.

```text
bl-3ca6 (Define host-native dispatch / safe-packet protocol)
bl-f8cb (Multi-peer 3+ deliberation extension)
```

**Items in this lane:**

- **bl-3ca6** - Define host-native dispatch / safe-packet protocol (reserved seam)
- **bl-f8cb** - Multi-peer (3+) deliberation extension (reserved / v3+ concern)

**Total estimated effort:** High if pursued
**Cross-lane dependencies:** Go/no-go decisions first.

---

## 5. Recommended Execution Order

### Wave 1: Public Surface and Reliability Cleanup

| Order | Item | Effort | Rationale |
| --- | --- | --- | --- |
| 1a | **bl-7c1d** - Control public skill discovery surface on skills.sh | Medium | Roadmap-Now gate for public listing claims; prevents broken or misleading discovery. |
| 1b | **bl-1f9c** - De-flake the session-observer watch test suite | Low | Removes known hook/CI flake before the next release train. |
| 1c | **bl-3913** - Add a test guarding bundled rubric examples at <=12 parser-visible criteria | Low | Cheap guardrail; can batch with other test work. |

**Parallelism:** `bl-7c1d` (Control public skill discovery surface) can run alongside `bl-1f9c` (De-flake the session-observer watch test suite) and `bl-3913` (Add a test guarding bundled rubric examples) because release-discovery, session-observer tests, and evaluate rubric tests are separate surfaces.

### Wave 2: Next Useful Skill and Packaging Spike

| Order | Item | Effort | Rationale |
| --- | --- | --- | --- |
| 2a | **bl-22d3** - Add phone-a-friend advisory peer skill | Medium | Best next feature: independent, provider CLI exists, docs site exists, useful immediately. |
| 2b | **bl-e0e7** - Share consensus generated runtime output at the plugin level | Medium | Run the installed-layout spike now that family work is done; proceed only if host layouts support plugin-local shared scripts. |
| 2c | **bl-9ed4** - Add deliberation metrics (tokens, wall-clock, rounds) to artifacts | Low | Small observability pass if there is room; keep token/cost fields honest when unavailable. |

**Parallelism:** `bl-22d3` (Add phone-a-friend advisory peer skill) and `bl-e0e7` (Share consensus generated runtime output) can run in separate worktrees if no other branch is modifying consensus-loop generated outputs. `bl-9ed4` (Add deliberation metrics) should not overlap with `bl-e0e7` if both touch the loop status/runtime output in practice.

### Wave 3: Design-Gated Consensus Expansion

| Order | Item | Effort | Rationale |
| --- | --- | --- | --- |
| 3a | **bl-645c** - Add consensus-research skill (investigate question, synthesized findings) | Medium | Roadmap Next, but peer tool access/evidence capture needs a design/DR before implementation. |
| 3b | **bl-e39a** - Add whole-document harmonization pass after section convergence | Medium | Meaningful artifact-quality improvement after existing section orchestration is stable. |

**Parallelism:** These can be separate projects because `bl-645c` (Add consensus-research skill) is wrapper/tool-access focused while `bl-e39a` (Add whole-document harmonization pass) is loop/section orchestration focused, but both should start with design decisions.

### Wave 4: Larger Collaboration Initiative

| Order | Item | Effort | Rationale |
| --- | --- | --- | --- |
| 4a | **bl-4e2e** - Shared session log substrate (become-observable daemon + merged log) | High | Foundation for multi-agent observation and identity. |
| 4b | **bl-f59f** - Inter-agent direct messaging (addressable, prioritized) | Medium | Build only after substrate identity/state primitives exist. |

**Parallelism:** Keep sequential inside this lane: `bl-4e2e` (Shared session log substrate) before `bl-f59f` (Inter-agent direct messaging).

### Deferred

| Item | Rationale |
| --- | --- |
| **bl-ef38** - Add similarity heuristic for near-converged deliberation states | Useful fill-in, but current deterministic convergence plus escalation is adequate. |
| **bl-db5d** - LLM section auto-chunking fallback (--sections auto-llm) | Decision-only seed; may resolve `wont_do` unless unstructured-document demand appears. |
| **bl-58b3** - Mid-loop user artifact edits (type=edit intervention) | Decision-only seed; existing artifact-edit-then-resume may be enough. |
| **bl-3ca6** - Define host-native dispatch / safe-packet protocol (reserved seam) | Reserved protocol work with no current host-native need. |
| **bl-f8cb** - Multi-peer (3+) deliberation extension (reserved / v3+ concern) | Speculative large design; needs evidence that two peers are insufficient. |

---

## 6. Roadmap Alignment

### How backlog items map to roadmap phases

| Roadmap Phase | Status | Backlog Items | Notes |
| --- | --- | --- | --- |
| Now: Post-tag discovery verification | Active | **bl-7c1d** - Control public skill discovery surface on skills.sh | Strong alignment. This is the practical backlog record for the remaining public-discovery gate. |
| Next: Consensus research | Active | **bl-645c** - Add consensus-research skill (investigate question, synthesized findings) | Roadmap correctly treats this as separate from completed create/decide/plan family work. |
| Next: Advisory peer | Active | **bl-22d3** - Add phone-a-friend advisory peer skill | Strong alignment. Docs IA gate is satisfied, so this is buildable. |
| Later: Harmonization / metrics / convergence quality | Deferred | **bl-e39a** - Add whole-document harmonization pass; **bl-9ed4** - Add deliberation metrics; **bl-ef38** - Add similarity heuristic | Roadmap and backlog agree these are follow-ons rather than immediate blockers. |
| Later: Plugin packaging maintainability | Deferred | **bl-e0e7** - Share consensus generated runtime output at the plugin level | Roadmap captures the non-concurrency constraint; current family work is complete, so the item is now eligible for a spike. |
| Later: v3 discussion / reserved seeds | Deferred | **bl-db5d** - LLM section auto-chunking fallback; **bl-58b3** - Mid-loop user artifact edits; **bl-3ca6** - Define host-native dispatch / safe-packet protocol; **bl-f8cb** - Multi-peer 3+ deliberation extension | Correctly not near-term. Keep decision-first. |
| Later: Multi-agent collaboration substrate | Deferred / promotable | **bl-4e2e** - Shared session log substrate; **bl-f59f** - Inter-agent direct messaging | Roadmap says promotable when there is appetite after family/docs. Family/docs are done; this is now an explicit capacity choice, not a dependency block. |

### Gaps: Roadmap items without backlog coverage

| Roadmap Item | Phase | Recommendation |
| --- | --- | --- |
| Public marketplace submission, Codex Plugin Directory submission, and hosted skills.sh listing after discovery control | Now / release-distribution follow-up | `bl-7c1d` (Control public skill discovery surface) covers discovery-surface correctness, but not the full submission workflow. After `bl-7c1d` closes, consider a narrow successor backlog item for actual public submission/listing verification if the repo is ready to claim it. |
| Typed-test-fixture cleanup and per-domain Vitest projects / coverage reporting | Later / optional tooling polish | Leave unfiled unless test-maintenance pain increases. `bl-1f9c` (De-flake the session-observer watch test suite) covers the only currently painful test-harness issue. |
| Codex read-only submit capture-path relocation and strict require-submission mode | Later / provider-CLI follow-up | The roadmap mentions these as deferrals but no active item exists. File a backlog item only if provider-CLI reliability work returns to active priority. |

### Orphans: Backlog items not explicitly represented on the roadmap

| Backlog Item | Recommendation |
| --- | --- |
| **bl-1f9c** - De-flake the session-observer watch test suite | Add to the roadmap as a short "Now maintenance" callout or keep in backlog-only execution planning; it addresses real release friction. |
| **bl-3913** - Add a test guarding bundled rubric examples at <=12 parser-visible criteria | Backlog-only is fine. It is a cheap guardrail, not roadmap-level strategy. |

---

## 7. Observations & Recommendations

### Strategic observations

1. **The active board is cleaner than the stale June 20 review.** Archived work now includes the v0.1 release, docs IA, provider-CLI hardening, independent draft, and create/decide/plan. The active backlog should not keep optimizing around those closed gates.
2. **`bl-7c1d` (Control public skill discovery surface on skills.sh) is the real release continuation.** The release is done, but public-discovery truth is still gated on internal flags, self-redirect behavior, and live verification.
3. **The next feature should probably be `bl-22d3` (Add phone-a-friend advisory peer skill), not `bl-645c` (Add consensus-research skill).** Phone-a-friend is independent and validates the new docs site with lower design risk; consensus-research needs peer tool-access and evidence-capture decisions first.
4. **The multi-agent substrate lane is now dependency-unblocked but still capacity-heavy.** `bl-4e2e` (Shared session log substrate) is a full design/build initiative; start it only when the operator wants that lane, not as incidental follow-up.
5. **Several low-priority consensus-loop seeds should be decision-first.** `bl-db5d` (LLM section auto-chunking fallback), `bl-58b3` (Mid-loop user artifact edits), `bl-3ca6` (Define host-native dispatch / safe-packet protocol), and `bl-f8cb` (Multi-peer 3+ deliberation extension) should not become implementation projects without explicit go/no-go evidence.

### Risks

| Risk | Mitigation |
| --- | --- |
| Public discovery gets claimed before `bl-7c1d` (Control public skill discovery surface on skills.sh) lands. | Keep docs/release wording as non-claim language until internal flags, self-redirects, and live discovery checks are complete. |
| `bl-e0e7` (Share consensus generated runtime output at the plugin level) creates install regressions in one host. | Treat the multi-host installed-layout spike as a hard go/no-go; keep duplicated loop outputs if any host cannot resolve plugin-local shared scripts. |
| `bl-1f9c` (De-flake the session-observer watch test suite) weakens coverage while removing flake. | Replace timing races with deterministic stop conditions and hardened teardown assertions; keep baseline emission and cleanup behavior asserted. |
| `bl-645c` (Add consensus-research skill) ships without a tool-access/evidence model. | Make the peer tool-access/evidence-capture decision an explicit design/DR gate before implementation. |
| Multi-agent substrate work balloons into orchestration platform scope. | Keep `bl-4e2e` (Shared session log substrate) scoped to observation/merged log/identity; defer direct messaging to `bl-f59f` (Inter-agent direct messaging) and orchestration beyond that. |

### Quick wins to tackle immediately

1. **bl-1f9c** - De-flake the session-observer watch test suite (low effort, removes known CI/hook friction).
2. **bl-3913** - Add a test guarding bundled rubric examples at <=12 parser-visible criteria (low effort, protects a known parser-cap invariant).
3. **bl-9ed4** - Add deliberation metrics (tokens, wall-clock, rounds) to artifacts (low effort if scoped to available/unavailable semantics and existing counters).
