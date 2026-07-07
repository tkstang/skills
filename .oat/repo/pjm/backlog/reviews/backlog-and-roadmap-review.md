# Backlog & Roadmap Review

**Date:** 2026-07-04
**Scope:** July 4/5 snapshot of active items under `.oat/repo/pjm/backlog/items/` (13 open items at review time; 10 open after the 2026-07-07 sweep)
**Roadmap:** `.oat/repo/pjm/roadmap.md`
**Purpose:** Prioritize by value/effort, surface dependencies, and recommend an execution sequence

> If a one-page execution companion exists in this directory, see [`priority-alignment.md`](./priority-alignment.md) — produced via the optional walkthrough at the end of `oat-pjm-review-backlog`. It is the short, ordered "what to do next" view of this full review.

> **2026-07-07 update:** the hosted discovery check is done, and the decision
> sweep from this review is complete. `BL-260620-mid-loop-user-artifact-edits`
> and `BL-260620-llm-section-auto-chunking` resolved `wont_do` and moved to
> `backlog/archived/`; `BL-260701-add-multi-round-panel` now has its product
> distinction recorded while the build remains open and evidence-gated. The
> generated active backlog table now has 10 open items; this document otherwise
> remains the July 4/5 prioritization snapshot.

---

## 1. Executive Summary

At review time, the backlog contained **13 open items** after the neutral-panel + default-config project shipped (2026-07-03), following phone-a-friend (2026-06-28) and public-discovery control (2026-06-27). After the 2026-07-07 decision sweep, the board is **10 open items**. Nothing is in flight. The remaining board is dominated by low-priority seeds and decision-first items; three medium-priority items carry near-term execution weight.

**What changed since the 2026-06-22 review:**

- Shipped and archived: `BL-260621-control-public-skill-discovery` (discovery control, PR #38 — closed retroactively 2026-07-05 during the hygiene pass), phone-a-friend, watch-suite de-flake, rubric-cap guard, consensus-panel, and consensus config defaults.
- New since last review: **BL-260627-verify-skills-sh-hosted** — Verify skills.sh hosted discovery surface (the deferred hosted-path check split out of discovery control) and **BL-260701-add-multi-round-panel** — Add multi-round panel discussion (deferred from panel v1).
- Codebase drift that changes one rating: the `consensus-loop.mjs` duplication that **BL-260620-share-consensus-generated** (share consensus generated runtime output) targets has grown from 2 copies to **5** (refine, evaluate, create, decide, plan), plus `consensus-config.mjs` duplicated across **6** skills (those five + panel) — `scripts/build-generated.mjs:19-69`. The item's value has increased since it was written, and the "not concurrent with loop-touching work" window is open right now.

| Theme | Count | Key Observation |
| --- | --- | --- |
| Release / distribution | 1 | **BL-260627-verify-skills-sh-hosted** — Verify skills.sh hosted discovery surface: the last release-lane gate before any public-listing claim; small and independent. |
| Plugin packaging maintainability | 1 | **BL-260620-share-consensus-generated** — Share consensus generated runtime output: duplication grew 2→5 loop copies since the item was written; the no-loop-work-in-flight window is open now. |
| Consensus runtime quality | 3 | **BL-260612-add-deliberation-metrics** (deliberation metrics), **BL-260612-add-similarity-heuristic** (similarity heuristic), **BL-260612-add-whole-document** (harmonization pass) — all touch the shared loop core, so they sequence after (not alongside) the dedup task. |
| New skill surface | 2 | **BL-260612-add-consensus-research-skill** (consensus-research) is the last family skill, design-gated on peer tool access. **BL-260701-add-multi-round-panel** (multi-round panel) is a fresh post-v1 idea; panel usage evidence should come first. |
| Multi-agent collaboration substrate | 2 | **BL-260619-shared-session-log-substrate** (shared session log substrate) → **BL-260619-inter-agent-direct-messaging** (inter-agent messaging): a full initiative lane, unblocked but appetite-gated. |
| Decision seeds (resolved after review) | 2 | **BL-260620-mid-loop-user-artifact-edits** (mid-loop type=edit) and **BL-260620-llm-section-auto-chunking** (LLM auto-chunking) — both resolved `wont_do` on 2026-07-07 and moved to `backlog/archived/`. |
| Reserved go/no-go seeds | 2 | **BL-260619-define-host-native-dispatch** (host-native dispatch) and **BL-260619-multi-peer-3-deliberation** (3+ peers) — explicitly speculative; keep parked. |

**Quadrant distribution:**

| Quadrant | Count | Items |
| --- | --- | --- |
| Quick Win | 2 | **BL-260627-verify-skills-sh-hosted** — Verify skills.sh hosted discovery surface; **BL-260612-add-deliberation-metrics** — Add deliberation metrics |
| Strategic | 5 | **BL-260620-share-consensus-generated** — Share consensus generated runtime output; **BL-260612-add-consensus-research-skill** — Add consensus-research skill; **BL-260612-add-whole-document** — Whole-document harmonization pass; **BL-260619-shared-session-log-substrate** — Shared session log substrate; **BL-260619-inter-agent-direct-messaging** — Inter-agent direct messaging |
| Fill-in | 4 | **BL-260612-add-similarity-heuristic** — Similarity heuristic; **BL-260620-mid-loop-user-artifact-edits** — Mid-loop user artifact edits (decision); **BL-260620-llm-section-auto-chunking** — LLM section auto-chunking (decision); **BL-260701-add-multi-round-panel** — Multi-round panel (decision-first) |
| Avoid / Defer | 2 | **BL-260619-define-host-native-dispatch** — Host-native dispatch protocol; **BL-260619-multi-peer-3-deliberation** — Multi-peer (3+) deliberation |

**Top-line recommendations:**

1. **Take the open dedup window: run `BL-260620-share-consensus-generated` (share consensus generated runtime output) now.** Its one hard constraint — not concurrent with any consensus-loop-touching branch — is satisfied for the first time since it was written, and every deferred loop-quality item (metrics, similarity, harmonization) gets cheaper afterward because changes regenerate into one shared output instead of five.
2. **Close the release lane with `BL-260627-verify-skills-sh-hosted` (verify skills.sh hosted discovery surface).** It is small, independent, already has its verification recipe written into the item, and it retires the last standing non-claim from the v0.1 release.
3. **Batch the three consensus-loop quality items into one post-dedup arc** — `BL-260612-add-deliberation-metrics` (metrics), `BL-260612-add-similarity-heuristic` (similarity heuristic), and optionally `BL-260612-add-whole-document` (harmonization, decision-first) — rather than opening the loop core three separate times.

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

### BL-260627-verify-skills-sh-hosted — Verify skills.sh hosted discovery surface and listing strategy

> Verify the Vercel-controlled hosted path (auto-crawl vs submission; whether hosted indexing honors `metadata.internal`) and record the listing strategy before any public claim.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **High** | The only remaining release-lane gate; blocks every public-listing / marketplace claim. The CLI-path control shipped in PR #38 — this is the half the repo does not own and has never verified. |
| **Effort** | **Low** | The item embeds its own verification recipe (exact `npx skills find` commands, hosted URLs, prior results table from 2026-06-26). Re-run, interpret, record strategy in `current-state.md`. Possibly seeded by real installs of the standalone skills. |
| **Quadrant** | **Quick Win** | Cheapest high-leverage item on the board. |

- **Dependencies:** PR #38 merged to the public default branch (done). Hosted indexing is asynchronous and outside repo control — the check may need repetition if `tkstang/skills` is still unindexed.
- **Blocked by:** Nothing.
- **Blocks:** Any public skills.sh listing claim; the optional upstream `open-agent-toolkit` internal-flag handoff decision.

---

### BL-260620-share-consensus-generated — Share consensus generated runtime output at the plugin level

> Collapse duplicated per-skill `consensus-loop.mjs` into one plugin-local shared script, gated by a multi-host installed-layout spike.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **High** | Upgraded from the item's original framing: `build-generated.mjs` now emits the loop into **5** skill dirs (refine, evaluate, create, decide, plan — lines 19–49) and `consensus-config.mjs` into **6** (+panel, lines 34–69). Every future loop change (metrics, similarity, harmonization, research) multiplies through this. It also serializes the whole consensus lane: nothing loop-touching can run while this is open. |
| **Effort** | **Medium** | The code change is small; the real work is the 4-host install spike (Claude / Codex / Cursor / Copilot installed-layout verification) which is a genuine go/no-go — it may conclude "keep duplication." The `~/.consensus/` resolver fallback + `install.sh` shipped by PR #38 add a since-written wrinkle the spike must also cover (standalone-install recovery must keep working). |
| **Quadrant** | **Strategic** | High value, spike-gated; schedule deliberately into the currently-open no-loop-work window. |

- **Dependencies:** Install-layout evidence from the v0.1 release work and PR #38's standalone-recovery path (both available).
- **Blocked by:** Nothing — the "not concurrent with consensus-loop feature branches" constraint is **currently satisfied** (nothing in flight).
- **Blocks (softly):** `BL-260612-add-deliberation-metrics`, `BL-260612-add-similarity-heuristic`, `BL-260612-add-whole-document`, and the eventual `BL-260612-add-consensus-research-skill` build — all get cheaper and conflict-free after the dedup lands (or after it decides to keep duplication).

---

### BL-260612-add-deliberation-metrics — Add deliberation metrics (tokens, wall-clock, rounds) to artifacts

> Consistent rounds / wall-clock / token / cost metrics in turn records, loop status, and the artifact resolution block, degrading gracefully where providers expose nothing.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Medium** | Observability across every consensus artifact, and the prerequisite for the v3 cost-cap question. Not blocking anything today. |
| **Effort** | **Low–Medium** | Partial scaffolding already exists: `LoopStatus` carries turns/rounds and `cost_source` / `approximate_cost_usd` fields (`src/consensus/core/consensus-loop.ts:160-166`), but wall-clock duration is not aggregated and the provider-CLI run envelope exposes **no token/cost data** from any adapter (`src/consensus/provider-cli/types.ts:183-184`). The token/cost half is therefore mostly "investigate what each provider CLI can emit, wire what exists, mark the rest unavailable" — bounded, but it spans loop core + provider CLI + generated outputs. |
| **Quadrant** | **Quick Win** | By roadmap position it is Later, but as the first post-dedup loop change it is the natural warm-up. |

- **Dependencies:** None hard. Cheaper after `BL-260620-share-consensus-generated` (one regenerated loop output instead of five).
- **Blocked by:** Nothing (soft: the dedup window).
- **Blocks:** The v3 cost-cap feasibility question (`--max-cost-per-section` etc.) recorded inside this item.

---

### BL-260612-add-similarity-heuristic — Add similarity heuristic for near-converged deliberation states

> Deterministic near-match measure (agency-gated, audit-disclosed) so almost-converged states can self-confirm instead of escalating.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low–Medium** | Reduces escalation frequency on long documents; quality-of-life for deliberation runs, blocks nothing. Convergence today is strictly SHA-256 hash equality plus verdict rules (`src/consensus/core/consensus-loop.ts:3342`), so the opportunity is real but not urgent. |
| **Effort** | **Low** | Well-localized in the loop core's convergence path; deterministic algorithm + threshold + turn-record disclosure. Test surface is threshold boundaries + audit trail. |
| **Quadrant** | **Fill-in** | Slot into the post-dedup loop-quality arc alongside metrics. |

- **Dependencies:** None hard; same soft dedup-window sequencing as metrics.
- **Blocked by:** Nothing.
- **Blocks:** Nothing.

---

### BL-260612-add-whole-document — Add whole-document harmonization pass after section convergence

> Optional `--harmonize` pass: after all sections converge, peers refine the assembled document for cross-section coherence, with its own deliberation log.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Medium** | Removes a documented v0.1 limitation and is the flagship v3 Phase 4 quality feature. Matters most for long multi-section refine runs. |
| **Effort** | **Medium–High** | Must compose with sequential and host-mediated parallel section flows, resume-through-interruption, and impasse handling. Section orchestration lives in the refine wrapper (`src/consensus/refine/consensus-refine.ts`) with the loop core per-section — harmonization adds a new post-fan-in stage across both. Carries an explicit context-bounding decision (assembled-doc-only vs + per-section logs) before build. |
| **Quadrant** | **Strategic** | Decision-first, then a real build; the largest of the three loop-quality items. |

- **Dependencies:** Context-bounding decision (lean assembled-doc-only per v2/v3). Strong soft dependency on the dedup window.
- **Blocked by:** Nothing hard.
- **Blocks:** Nothing.

---

### BL-260612-add-consensus-research-skill — Add consensus-research skill (investigate question, synthesized findings)

> The last unshipped family skill: peers investigate a question and converge on synthesized findings with evidence and dissent (`shared_input` / `parallel_synthesized` / moderate agency).

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Medium** | Completes the named v3 family and is the roadmap's only "Next" entry. But it is a new capability class — tool-using peer turns — not an incremental wrapper, and no user demand signal has forced it yet. |
| **Effort** | **Medium (+ High planning)** | The wrapper itself follows the create/decide/plan pattern, but the peer tool-access / permissions / evidence-capture question is an explicit DR-before-build gate that may reshape the provider CLI contract. Keep as its own OAT project, as the roadmap already states. |
| **Quadrant** | **Strategic** | Design-gated; start with the DR, not the build. |

- **Dependencies:** Peer tool-access DR (the real gate). `parallel_synthesized` (shipped). Build phase should respect the dedup window if it touches the loop.
- **Blocked by:** Its own unresolved design question.
- **Blocks:** Family-completeness claims; nothing mechanical.

---

### BL-260701-add-multi-round-panel — Add multi-round panel discussion

> Optional follow-up rounds for `consensus-panel` where panelists see each other's responses, without collapsing into refine-style convergence.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low–Medium** | Panel v1 shipped **yesterday** (2026-07-03). There is no usage evidence yet showing single-round breadth is insufficient. The item's own first acceptance criterion is a product-distinction decision (multi-round ≠ convergence), which is genuinely worth settling — the build is speculative until then. |
| **Effort** | **Medium** | The panel workflow is strictly single-shot — one pass over panelists, no round loop, no re-panel hooks (`src/consensus/panel/consensus-panel.ts:899-1013`). Multi-round means adding round structure, prior-response framing, attribution preservation, and cost/timeout behavior. Not a small bolt-on. |
| **Quadrant** | **Fill-in (decision-first)** | Record the product-distinction decision when convenient; defer the build until panel usage justifies it. |

- **Dependencies:** Panel v1 (shipped); real panel usage evidence (accumulating).
- **Blocked by:** Nothing hard.
- **Blocks:** Nothing.

---

### BL-260619-shared-session-log-substrate — Shared session log substrate (become-observable daemon + merged log)

> Foundation of the multi-agent collaboration lane: agent-initiated observability registration, a merging daemon, and one timestamp-ordered shared log any agent can tail.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **High (within its lane)** | Unblocks `BL-260619-inter-agent-direct-messaging` and defines the identity/state primitives everything else in the lane reuses. Subsumes session-observer's single-target limitation. Whether the lane itself is the right next investment is an appetite call, not a dependency call. |
| **Effort** | **High** | Genuinely new territory. session-observer today: per-session cursor state in user-scoped `~/.local/state/session-observer/` (`src/transcript/session-observer/lib/state.ts:50`), watcher records with PID/heartbeat (`lib/types.ts:233-254`), multi-runtime watch but **no** merged log, **no** agent identity beyond provider names, **no** project-scoped state (the `.consensus/` convention exists only on the consensus side, `src/consensus/config/consensus-config.ts:246`). ~6 open design questions incl. adopt-vs-build on `cass` and packaging. Design pass first, DR required. |
| **Quadrant** | **Strategic** | Initiative-sized; start only with explicit appetite. |

- **Dependencies:** TS/test foundation (landed). Design pass + adopt-vs-build DR before any code.
- **Blocked by:** Nothing technical; appetite-gated.
- **Blocks:** `BL-260619-inter-agent-direct-messaging` (hard).

---

### BL-260619-inter-agent-direct-messaging — Inter-agent direct messaging (addressable, prioritized)

> Point-to-point agent messages with priority-over-log semantics, reusing the substrate's identity and cursor primitives.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Medium** | The capability users would actually feel from the substrate lane — but it is meaningless without the foundation beneath it. |
| **Effort** | **Medium–High** | Build-vs-adopt decision (Agent Mail / `mcp-agent-mail`) plus message lifecycle, scoping, and cleanup. Cheaper if the substrate's primitives land well. |
| **Quadrant** | **Strategic** | Sequenced strictly behind the substrate. |

- **Dependencies:** Substrate identity + state-directory + cursor primitives.
- **Blocked by:** **BL-260619-shared-session-log-substrate** (hard).
- **Blocks:** The (vault-stub) orchestration layer.

---

### BL-260620-mid-loop-user-artifact-edits — Mid-loop user artifact edits (type=edit intervention) — for discussion

> Decide whether a first-class `type=edit` intervention adds value over the existing artifact-edit-then-resume path.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low** | The existing canonical-artifact resume path already covers the underlying need; this is about audit semantics. May well resolve `wont_do`. |
| **Effort** | **Low (decision only)** | One sitting to decide and record; build only if the decision says so. |
| **Quadrant** | **Fill-in** | Batch with the other decision seeds. |

- **Dependencies:** None. — **Blocked by:** Nothing. — **Blocks:** Nothing.

---

### BL-260620-llm-section-auto-chunking — LLM section auto-chunking fallback (--sections auto-llm) — for discussion

> Decide whether an opt-in LLM chunking fallback for heading-less documents is worth the non-determinism vs the current whole-document fallback.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low** | Deterministic fallback exists and no user pain has been recorded. Non-deterministic boundaries would complicate resume, per-section convergence, and audit reproducibility. Likely `wont_do` or long defer. |
| **Effort** | **Low (decision only)** | One sitting to decide and record. |
| **Quadrant** | **Fill-in** | Batch with the other decision seeds. |

- **Dependencies:** None. — **Blocked by:** Nothing. — **Blocks:** Nothing.

---

### BL-260619-define-host-native-dispatch — Define host-native dispatch / safe-packet protocol (reserved seam)

> Go/no-go, then (only if go) a full safety/history/audit contract before any adapter may set `supports_host_native_dispatch: true`.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low (today)** | Its current value is already delivered by existing: the seed prevents someone flipping a reserved flag without a contract. No present need for host-native dispatch while the prompt/CLI floor is sufficient. |
| **Effort** | **High (if pursued)** | Packet contents, history boundary, execution contract, audit fields, safety checks — an initiative. The go/no-go itself is cheap. |
| **Quadrant** | **Avoid / Defer** | Keep parked; revisit only if a concrete dispatch need emerges. |

- **Dependencies:** None. — **Blocked by:** Nothing. — **Blocks:** Nothing (the guard value is the point).

---

### BL-260619-multi-peer-3-deliberation — Multi-peer (3+) deliberation extension (reserved / v3+ concern)

> Go/no-go on extending the two-peer engine to 3+ peers (group convergence, tie semantics, verdict aggregation, cost scaling).

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low** | No evidence two peers are insufficient. The **panel** skill now covers the "hear from 3+ providers" use case without touching convergence semantics — which further weakens the near-term case for 3+ *deliberation*. |
| **Effort** | **High (if pursued)** | Generalizing pairwise convergence, oscillation, and verdicts is engine-core surgery. |
| **Quadrant** | **Avoid / Defer** | Keep parked. |

- **Dependencies:** None. — **Blocked by:** Nothing. — **Blocks:** Nothing.

---

## 3. Dependency Graph

```text
Legend:  ──▶  hard dependency (must complete first)
         - -▶  soft dependency (beneficial but not required)

BL-260620-share-consensus-generated - -▶ BL-260612-add-deliberation-metrics
BL-260620-share-consensus-generated - -▶ BL-260612-add-similarity-heuristic
BL-260620-share-consensus-generated - -▶ BL-260612-add-whole-document
BL-260620-share-consensus-generated - -▶ BL-260612-add-consensus-research-skill (build phase only)

(peer tool-access DR) ──▶ BL-260612-add-consensus-research-skill
(context-bounding decision) ──▶ BL-260612-add-whole-document
(product-distinction decision + panel usage evidence) ──▶ BL-260701-add-multi-round-panel

BL-260619-shared-session-log-substrate ──▶ BL-260619-inter-agent-direct-messaging

Independent:
BL-260627-verify-skills-sh-hosted        [independent]
BL-260620-mid-loop-user-artifact-edits   [independent — decision seed]
BL-260620-llm-section-auto-chunking      [independent — decision seed]
BL-260619-define-host-native-dispatch    [independent — go/no-go seed]
BL-260619-multi-peer-3-deliberation      [independent — go/no-go seed]
```

Note: the soft edges from `BL-260620-share-consensus-generated` are *concurrency* constraints, not prerequisites — the item's own rule is "not concurrent with consensus-loop-touching branches." Doing it first is the cheapest ordering; doing it after all of them is also valid but re-runs the dedup across more churn.

**ID legend** (every ID used above):

| ID | Title |
| --- | --- |
| BL-260627-verify-skills-sh-hosted | Verify skills.sh hosted discovery surface and listing strategy |
| BL-260620-share-consensus-generated | Share consensus generated runtime output at the plugin level |
| BL-260612-add-deliberation-metrics | Add deliberation metrics (tokens, wall-clock, rounds) to artifacts |
| BL-260612-add-similarity-heuristic | Add similarity heuristic for near-converged deliberation states |
| BL-260612-add-whole-document | Add whole-document harmonization pass after section convergence |
| BL-260612-add-consensus-research-skill | Add consensus-research skill (investigate question, synthesized findings) |
| BL-260701-add-multi-round-panel | Add multi-round panel discussion |
| BL-260619-shared-session-log-substrate | Shared session log substrate (become-observable daemon + merged log) |
| BL-260619-inter-agent-direct-messaging | Inter-agent direct messaging (addressable, prioritized) |
| BL-260620-mid-loop-user-artifact-edits | Mid-loop user artifact edits (type=edit intervention) |
| BL-260620-llm-section-auto-chunking | LLM section auto-chunking fallback (--sections auto-llm) |
| BL-260619-define-host-native-dispatch | Define host-native dispatch / safe-packet protocol (reserved seam) |
| BL-260619-multi-peer-3-deliberation | Multi-peer (3+) deliberation extension (reserved / v3+ concern) |

---

## 4. Parallel Lanes

### Lane A: Release / distribution closeout

Finish the last release-lane non-claim. Fully independent of everything else.

```text
BL-260627-verify-skills-sh-hosted  (single item)
```

**Items in this lane:**

- **BL-260627-verify-skills-sh-hosted** — Verify skills.sh hosted discovery surface and listing strategy

**Total estimated effort:** Low
**Cross-lane dependencies:** None. May need a second pass later if hosted indexing lags.

### Lane B: Consensus packaging → loop quality

The generated-output dedup first (its no-concurrency window is open), then the loop-quality items land against a single shared output. Strictly sequential *within* the lane because everything touches the same loop core / generated outputs.

```text
BL-260620-share-consensus-generated ──▶ BL-260612-add-deliberation-metrics ──▶ BL-260612-add-similarity-heuristic - -▶ BL-260612-add-whole-document (decision-first)
```

**Items in this lane:**

- **BL-260620-share-consensus-generated** — Share consensus generated runtime output at the plugin level
- **BL-260612-add-deliberation-metrics** — Add deliberation metrics to artifacts
- **BL-260612-add-similarity-heuristic** — Similarity heuristic for near-converged states
- **BL-260612-add-whole-document** — Whole-document harmonization pass (decision-first, largest)

**Total estimated effort:** Medium overall (dedup spike M; metrics S–M; similarity S; harmonization M–H if built)
**Cross-lane dependencies:** Blocks the *build* phase of **BL-260612-add-consensus-research-skill** (Lane C) from running concurrently, not its DR.

### Lane C: Design / decision work (no loop conflicts)

Pure design-and-decision work that can run alongside Lane B because it produces DRs and item updates, not loop code.

```text
BL-260612-add-consensus-research-skill (DR phase)   [parallel]
BL-260620-mid-loop-user-artifact-edits (decision)   [batchable]
BL-260620-llm-section-auto-chunking (decision)      [batchable]
BL-260701-add-multi-round-panel (product decision)  [batchable]
```

**Items in this lane:**

- **BL-260612-add-consensus-research-skill** — Add consensus-research skill (peer tool-access DR only)
- **BL-260620-mid-loop-user-artifact-edits** — Mid-loop user artifact edits (decision)
- **BL-260620-llm-section-auto-chunking** — LLM section auto-chunking (decision)
- **BL-260701-add-multi-round-panel** — Multi-round panel (product-distinction decision)

**Total estimated effort:** Low–Medium (mostly decisions; the research DR is the substantive one)
**Cross-lane dependencies:** The research *build* waits for both its DR and Lane B's dedup outcome.

### Lane D: Multi-agent collaboration substrate (appetite-gated initiative)

A separate initiative on a disjoint surface (session-observer / transcript tooling). Can run parallel to all consensus work, but is capacity-heavy — start only with explicit appetite.

```text
BL-260619-shared-session-log-substrate (design pass ──▶ build) ──▶ BL-260619-inter-agent-direct-messaging
```

**Items in this lane:**

- **BL-260619-shared-session-log-substrate** — Shared session log substrate (become-observable daemon + merged log)
- **BL-260619-inter-agent-direct-messaging** — Inter-agent direct messaging

**Total estimated effort:** High
**Cross-lane dependencies:** None technically; competes for the operator's initiative-sized capacity slot.

### Parked (no lane)

- **BL-260619-define-host-native-dispatch** — Host-native dispatch protocol (go/no-go seed)
- **BL-260619-multi-peer-3-deliberation** — Multi-peer (3+) deliberation (go/no-go seed)

---

## 5. Recommended Execution Order

### Wave 1: Close the release lane + take the dedup window

| Order | Item | Effort | Rationale |
| --- | --- | --- | --- |
| 1a | **BL-260627-verify-skills-sh-hosted** — Verify skills.sh hosted discovery surface | Low | Cheapest high-leverage item; retires the last v0.1 non-claim; recipe already written. |
| 1b | **BL-260620-share-consensus-generated** — Share consensus generated runtime output | Medium | The no-loop-work-in-flight window is open **now**; duplication has grown to 5 loop copies; everything downstream in the consensus lane gets cheaper. |

**Parallelism:** 1a ∥ 1b — fully disjoint surfaces (hosted-index verification vs build tooling).

### Wave 2: Loop-quality batch + research DR

| Order | Item | Effort | Rationale |
| --- | --- | --- | --- |
| 2a | **BL-260612-add-deliberation-metrics** — Add deliberation metrics | Low–Med | First post-dedup loop change; scaffolding (cost fields, round counts) partially exists. |
| 2b | **BL-260612-add-similarity-heuristic** — Similarity heuristic | Low | Same loop-core neighborhood as 2a; bank in the same worktree. |
| 2c | **BL-260612-add-consensus-research-skill** — consensus-research (DR phase only) | Med (planning) | Runs parallel to 2a/2b — produces a decision record, not loop code. |

**Parallelism:** (2a → 2b sequential in one worktree) ∥ 2c.

### Wave 3: Bigger builds, by appetite

| Order | Item | Effort | Rationale |
| --- | --- | --- | --- |
| 3a | **BL-260612-add-whole-document** — Harmonization pass (decision, then build) | Med–High | Largest loop-quality item; context-bounding decision first. |
| 3b | **BL-260612-add-consensus-research-skill** — consensus-research (build) | Medium | Only after its DR resolves; not concurrent with 3a (both touch loop/generated output). |
| 3c | **BL-260619-shared-session-log-substrate** — Substrate (design pass) | High | Start only with initiative-level appetite; disjoint surface, so it can run beside 3a *or* 3b. |

**Parallelism:** 3c ∥ (3a or 3b). 3a and 3b are mutually sequential.

### Decision sweep (completed 2026-07-07)

Verdicts are recorded in the item files:

- **BL-260620-mid-loop-user-artifact-edits** — Mid-loop user artifact edits: resolved `wont_do` and archived.
- **BL-260620-llm-section-auto-chunking** — LLM section auto-chunking: resolved `wont_do` and archived.
- **BL-260701-add-multi-round-panel** — Multi-round panel: product-distinction decision recorded; build remains deferred for usage evidence.

### Deferred

| Item | Rationale |
| --- | --- |
| **BL-260619-inter-agent-direct-messaging** — Inter-agent direct messaging | Hard-blocked behind the substrate foundation. |
| **BL-260619-define-host-native-dispatch** — Host-native dispatch protocol | Reserved seam; the seed's guard value is already delivered. Go/no-go only if a concrete need appears. |
| **BL-260619-multi-peer-3-deliberation** — Multi-peer (3+) deliberation | Speculative; panel now covers the 3+-provider breadth case without convergence surgery. |
| **BL-260701-add-multi-round-panel** — Multi-round panel (build) | Panel v1 shipped 2026-07-03; collect usage evidence before adding rounds. Product distinction is recorded; build remains deferred. |

---

## 6. Roadmap Alignment

### How backlog items map to roadmap phases

| Roadmap Phase | Status | Backlog Items | Notes |
| --- | --- | --- | --- |
| Now — public-discovery control | Shipped except hosted check | **BL-260627-verify-skills-sh-hosted** — Verify skills.sh hosted discovery surface | The roadmap mentions the deferred hosted check narratively but predates this item's creation — it should reference the item ID. |
| Next — consensus research | Open | **BL-260612-add-consensus-research-skill** — Add consensus-research skill | Aligned; DR-before-build framing matches. |
| Later — loop quality (v3 Phase 4) | Open | **BL-260612-add-whole-document** — Harmonization; **BL-260612-add-deliberation-metrics** — Metrics; **BL-260612-add-similarity-heuristic** — Similarity heuristic | Aligned. The "after create/decide/plan land" gate is now satisfied — these are promotable. |
| Later — plugin packaging | Open | **BL-260620-share-consensus-generated** — Share consensus generated runtime output | Aligned, but the roadmap's "land before the family project starts or after it merges" constraint has **resolved in favor of now** — the family project is done and nothing loop-touching is in flight. Roadmap wording is stale. |
| Later — reserved seeds | Parked | **BL-260619-define-host-native-dispatch** — Host-native dispatch; **BL-260619-multi-peer-3-deliberation** — 3+ peers | Aligned (go/no-go first, likely defer). |
| Later — decision seeds | Resolved 2026-07-07 | **BL-260620-mid-loop-user-artifact-edits** — Mid-loop edits; **BL-260620-llm-section-auto-chunking** — LLM auto-chunking | Both resolved `wont_do` and moved to `backlog/archived/`. |
| Later — multi-agent substrate | Open | **BL-260619-shared-session-log-substrate** — Substrate; **BL-260619-inter-agent-direct-messaging** — Messaging | Aligned; the TS-foundation gate it was sequenced behind has landed, so it is promotable on appetite. |

### Gaps: Roadmap items without backlog coverage

| Roadmap Item | Phase | Recommendation |
| --- | --- | --- |
| Opt-in strict require-submission mode (verdict path follow-up) | Consensus lane, "what remains" | Mentioned in the lane narrative and the backlog index overview, but has **no backlog item**. Create a small seed item or explicitly declare it promotable-on-demand in the index. |
| Codex read-only capture-path relocation (verdict path follow-up) | Consensus lane, "what remains" | Same treatment as above — narrative-only today. |
| Cursor submit-tool / custom ACP provider path exploration | Later | Narrative-only. Acceptable as a Later stub, but note it has no tracked home. |
| Transcript-tooling deferrals (Cursor SQLite store, provider-hook push, Gemini adapter, …) | Later | Intentionally archived-project-recorded and promotable on demand — no action needed; this is the documented pattern. |

### Orphans: Backlog items not on the roadmap

| Backlog Item | Recommendation |
| --- | --- |
| **BL-260701-add-multi-round-panel** — Add multi-round panel discussion | Add to the roadmap's Later lane (or a panel bullet under the consensus lane). Created 2026-07-01, after the roadmap's last update. |
| **BL-260627-verify-skills-sh-hosted** — Verify skills.sh hosted discovery surface | Referenced narratively in Now ("Still open (deferred)") but not by item ID — update the roadmap line to point at the item. |

### Roadmap staleness

The roadmap's **Last updated** stamp is 2026-06-28. It does not yet record the 2026-07-03 ship of `consensus-panel` + `consensus config` defaults (**BL-260626-add-consensus-panel-skill** / **BL-260626-configure-default-consensus**, PR #40) — the consensus-lane narrative ("`consensus-research` is the only remaining unshipped named family skill") is still accurate, but the lane and Now sections should note panel/config as shipped and fold the two orphans above in.

---

## 7. Observations & Recommendations

### Strategic observations

1. **The board is post-milestone and top-light.** Everything urgent-or-high is done and archived; after the 2026-07-07 sweep, 7 of 10 open items are priority `low`. This is the natural moment for either (a) the maintainability + loop-quality consolidation pass (Lanes A+B, recommended), or (b) committing to the substrate initiative. Doing both at once is beyond the historical 2–3 worktree capacity once the substrate design pass starts.
2. **`BL-260620-share-consensus-generated` (share consensus generated runtime output) is the scheduling keystone.** Its no-concurrency constraint radiates across every loop-touching item, and the constraint is satisfied *right now* for the first time since it was written. Skipping the window means either re-litigating it after harmonization/metrics churn or serializing around it later anyway.
3. **Decision debt was cheap to clear.** The 2026-07-07 sweep archived `BL-260620-mid-loop-user-artifact-edits` and `BL-260620-llm-section-auto-chunking` as `wont_do`, and recorded the product distinction for `BL-260701-add-multi-round-panel` while keeping the build evidence-gated. The remaining reserved seeds can still stay parked until a concrete need appears.
4. **The panel ship quietly weakened the case for `BL-260619-multi-peer-3-deliberation` (3+ deliberation).** "Hear from 3+ providers" is now served by panel without touching convergence semantics. Worth noting in that item when next touched.

### Risks

| Risk | Mitigation |
| --- | --- |
| **Backlog hygiene drift** — ~~`BL-260621-control-public-skill-discovery` (control public skill discovery surface) was `status: done` but unarchived and missing from `completed.md`~~ **Resolved 2026-07-05:** closed/archived retroactively; a Backlog Lifecycle contract in `pjm/AGENTS.md` now defines close-out steps and terminal statuses (`closed`/`wont_do`) to prevent recurrence. | Follow the Backlog Lifecycle at every ship; the review skill cross-checks recent commits against open items. |
| **Roadmap staleness compounds:** last updated 2026-06-28; panel/config ship and two newer items unreferenced. | Fold the 2026-07-03 ship + both orphan items into the roadmap in the same pass as the hygiene fix. |
| **Hosted-index verification may be unactionable if skills.sh still hasn't indexed the repo** — the item depends on Vercel-side crawl behavior. | Timebox the check; if still unindexed, record "wait-for-crawl + optional install-telemetry seeding" as the strategy and re-check on a calendar cadence rather than leaving the item open-ended. |
| **The dedup spike may fail a host** (Copilot/Codex installed layouts unverified for plugin-root relative imports), leaving the item half-open. | The spike is explicitly a go/no-go: a documented "keep duplication" outcome with recorded evidence is a legitimate close. Don't let it linger as in-progress. |
| **Stale review artifacts mislead:** the previous living review (2026-06-22) and priority-alignment (2026-06-23) referenced a 15-item board with a kickoff stack that has entirely shipped. | This document replaces the living review; refresh `priority-alignment.md` via the walkthrough (offered separately). |

### Quick wins to tackle immediately

1. **BL-260627-verify-skills-sh-hosted** — Verify skills.sh hosted discovery surface (Low effort; recipe pre-written in the item; closes the last release non-claim).
2. **BL-260612-add-deliberation-metrics** — Add deliberation metrics (Low–Medium effort once the dedup lands; partial scaffolding already in `LoopStatus`).

> The backlog hygiene micro-task flagged by this review (archiving `BL-260621-control-public-skill-discovery` — control public skill discovery surface) was completed 2026-07-05, alongside a new Backlog Lifecycle contract in `pjm/AGENTS.md`.
