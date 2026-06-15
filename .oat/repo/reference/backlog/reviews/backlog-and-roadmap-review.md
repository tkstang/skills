# Backlog & Roadmap Review

**Date:** 2026-06-14
**Scope:** All active items under `.oat/repo/reference/backlog/items/` (12 open; 2 recently completed excluded from rating)
**Roadmap:** `.oat/repo/reference/roadmap.md`
**Purpose:** Prioritize by value/effort, surface dependencies, and recommend an execution sequence

> If a one-page execution companion exists in this directory, see [`priority-alignment.md`](./priority-alignment.md) — produced via the optional walkthrough at the end of `oat-pjm-review-backlog`. It is the short, ordered "what to do next" view of this full review.

---

## 1. Executive Summary

The backlog contains **12 active items** (3 high, 6 medium, 3 low priority) plus **2 recently completed** (`bl-5d49`, `bl-7af0` — both parallel iteration modes, now merged via PR #9). The active work spans four themes:

| Theme | Count | Key Observation |
| --- | --- | --- |
| Consensus family skills | 5 | All now unblocked — their gating iteration modes shipped. `consensus-evaluate` (bl-5174) can land first; the rest share a common wrapper pattern. |
| Peer-invocation / Paseo hardening | 3 | `bl-3a88`, `bl-bb7e`, `bl-f0b6` all target structured-output robustness and the Paseo dependency boundary; they reinforce each other. |
| Release / distribution | 1 | `bl-d85f` (v0.1 tag) is fully independent and gates announcements only, not development. |
| Convergence & observability nice-to-haves | 3 | `bl-9ed4`, `bl-ef38`, `bl-e39a` — all low-priority, deferrable, independent fill-ins. |

**Top-line recommendations:**

1. Start `bl-5174` (consensus-evaluate) now — it is the earliest, lowest-effort family skill, its dependency (`parallel_revision`) has shipped, and the roadmap names it the Now/Next fast-follow.
2. Run `bl-d85f` (v0.1 release verification) as a **parallel lane** — it is independent of all consensus development and only gates public announcements.
3. Treat `bl-3a88` (tool-based verdict submission) as the highest-leverage hardening investment: live dogfooding repeatedly hit structured-output fragility, and this item is the durable fix and the foundation for reliable synthesized modes. Sequence `bl-f0b6` → `bl-bb7e` ahead of any Paseo build-vs-buy commitment.

**Staleness flag:** the index curated-overview, `completed.md`, and `roadmap.md` all describe the iteration-modes work as "final review in progress, merge pending" on `feat/consensus-iteration-modes`. Git history shows it **already merged to `main`** (`dbbbd72 feat: add parallel iteration modes and escalation ladder to consensus refine (#9)`). These narrative artifacts should be refreshed to "merged." See §6.

---

## 2. Item Catalog

### Rating Key

| Rating | Value | Effort |
| --- | --- | --- |
| **High** | Unblocks other items, daily workflow impact, or product milestone prerequisite | > 3 days, high complexity, or touches many files |
| **Medium** | Improves quality/consistency but not blocking | 1-3 days, moderate complexity |
| **Low** | Nice-to-have or future-facing | < 1 day, straightforward, isolated change |

### Priority Quadrants

```
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

### bl-d85f — Complete v0.1 release verification and tag

> Execute the `RELEASING.md` checklist on real provider runtimes, finalize CHANGELOG, and tag v0.1.0.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **High** | Milestone prerequisite — gates the public marketplace / skills.sh announcements. No public claims can be made until this lands. |
| **Effort** | **Medium** | Mechanical but spans four provider runtimes (Claude Code, Cursor, Codex, Agent Skills baseline) with manual install + permission smoke checks; local install fixes already landed. |
| **Quadrant** | **Strategic** | High value, non-trivial multi-runtime execution. |

- **Dependencies:** None
- **Blocked by:** Nothing
- **Blocks:** Public marketplace submission, Codex Plugin Directory, skills.sh discovery claims (none of which are backlog items yet)

---

### bl-5174 — Add consensus-evaluate skill (artifact vs rubric)

> Thin wrapper: peers judge an artifact against a rubric and converge on a unified evaluation. Defaults: shared_input / parallel_revision / minimal agency.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **High** | First family skill to ship; proves the family-wrapper pattern; named explicitly as the Now/Next fast-follow on the roadmap. |
| **Effort** | **Low** | S-sized thin wrapper; its only dependency (`parallel_revision`) has shipped; no new cold-start or synthesis machinery needed. |
| **Quadrant** | **Quick Win** | |

- **Dependencies:** Reuses the `consensus-loop` primitive and `parallel_revision` mode.
- **Blocked by:** Nothing (was bl-5d49, now done).
- **Blocks:** Nothing hard, but establishes the family-skill template the other four follow.

---

### bl-b9b9 — Add consensus-create skill (artifact from brief)

> Peers produce a new artifact from a brief through deliberation. Defaults: independent_draft / parallel_synthesized / maximum agency.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Medium** | Useful family member; first to exercise `independent_draft` cold start and derived-sectioning — carries a real design question, so it is more than a rote wrapper. |
| **Effort** | **Medium** | M-sized; new cold-start strategy + sectioning-from-derived-structure design decision. |
| **Quadrant** | **Strategic** | |

- **Dependencies:** `parallel_synthesized` mode; `independent_draft` cold start (new); derived-sectioning design.
- **Blocked by:** Nothing (was bl-7af0, now done).
- **Blocks:** Nothing.

---

### bl-87ef — Add consensus-decide skill (recommend among options)

> Peers deliberate over options and converge on a decision doc with reasoning and dissent. Defaults: independent_draft / parallel_synthesized / minimal agency.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Medium** | Family member; the minimal-agency + synthesized combination is unique (contested calls always surface), so it validates an important agency edge. |
| **Effort** | **Low** | S-sized thin wrapper once `parallel_synthesized` exists. |
| **Quadrant** | **Quick Win** | |

- **Dependencies:** `parallel_synthesized` mode; `independent_draft` cold start.
- **Blocked by:** Nothing (was bl-7af0, now done).
- **Blocks:** Nothing.

---

### bl-0cb8 — Add consensus-plan skill (structured plan from goal)

> Peers produce a structured plan (steps, dependencies, risks) from a goal. Defaults: independent_draft / parallel_synthesized / moderate agency.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Medium** | Family member; straightforward defaults, no unique agency/cold-start edge beyond what create/decide already exercise. |
| **Effort** | **Low** | S-sized thin wrapper. |
| **Quadrant** | **Quick Win** | |

- **Dependencies:** `parallel_synthesized` mode; `independent_draft` cold start.
- **Blocked by:** Nothing (was bl-7af0, now done).
- **Blocks:** Nothing.

---

### bl-645c — Add consensus-research skill (investigate question, synthesized findings)

> Peers investigate a question and converge on synthesized findings with evidence. Defaults: shared_input / parallel_synthesized / moderate agency.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low** | Explicitly the lowest-priority family skill; peer turns are tool-using research, not text edits. |
| **Effort** | **Medium** | M-sized; gated on an unresolved design question — whether Paseo peers get tool access and under what permissions — which may justify its own design pass. |
| **Quadrant** | **Strategic** (low-value variant → defer until peer tool-access is settled) | |

- **Dependencies:** `parallel_synthesized` mode; peer tool-access design decision (open).
- **Blocked by:** Nothing hard (was bl-7af0, now done), but should not start before the peer tool-access question is answered.
- **Blocks:** Nothing.

---

### bl-3a88 — Tool-based verdict submission for consensus peers (robust structured output)

> Replace/augment Paseo's `--output-schema` "emit final JSON" with a tool/CLI the agent calls to submit its verdict, validated in-context with self-correcting errors.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **High** | Directly addresses structured-output fragility that repeatedly broke live dogfooding (codex strict output, OpenAI oneOf rejection, synthesizer "finishing without structured output"); the natural foundation for reliable parallel/synthesized modes. |
| **Effort** | **High** | L-sized deliberate rework of the peer-invocation layer; touches the DR-002 "shell out to Paseo" boundary; needs its own design pass. |
| **Quadrant** | **Strategic** | |

- **Dependencies:** None hard; conceptually pairs with bl-bb7e (both target structured output and the Paseo boundary).
- **Blocked by:** Nothing.
- **Blocks:** Nothing formally, but de-risks the synthesized-mode family skills (bl-b9b9, bl-87ef, bl-0cb8, bl-645c).

---

### bl-bb7e — Investigate in-house peer-invocation CLI to reduce/replace the Paseo dependency

> Build-vs-buy investigation (not a committed migration): a thin direct-CLI `invokePeer` backend for claude/codex behind the existing injection seam, plus a phased plan or a documented stay-on-Paseo decision.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Medium** | Removes daemon/install/version-drift friction and gives control over structured-output internals; but it is investigative, and the decision hinges on how many peer providers we want to support. |
| **Effort** | **High** | L-sized; spike + benchmark + migration-step enumeration + go/no-go recommendation. |
| **Quadrant** | **Strategic** | |

- **Dependencies:** Findings from bl-f0b6 (cursor/ACP coverage) feed the provider-count pivot; the `invokePeer` swap seam already exists.
- **Blocked by:** Nothing hard; benefits from bl-f0b6 evidence first.
- **Blocks:** Nothing.

---

### bl-f0b6 — Verify cursor-as-peer end-to-end through Paseo (authenticated cursor-agent)

> Exercise `--peers cursor,…` end-to-end against an authenticated `cursor-agent`, characterize the ACP schema-retry path, and update README from "unverified" to a verified status.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Medium** | Resolves a documented "unverified" path and produces the ACP-reliability evidence that feeds the bl-bb7e build-vs-buy decision. |
| **Effort** | **Low** | S-sized run + characterization; the main friction is environmental (an authenticated `cursor-agent` / unlocked keychain). |
| **Quadrant** | **Quick Win** (environment-gated) | |

- **Dependencies:** Authenticated `cursor-agent`; Cursor registered in Paseo config.
- **Blocked by:** Nothing in-repo (external env setup only).
- **Blocks:** Soft-feeds bl-bb7e (ACP-coverage evidence).

---

### bl-9ed4 — Add deliberation metrics (tokens, wall-clock, rounds) to artifacts

> Add consistent token/cost/round/wall-clock metrics to turn records, loop status, and the resolution block; degrade gracefully when Paseo doesn't surface a figure.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low** | Observability improvement; roadmap-placed in "Later" after the family ships. |
| **Effort** | **Low** | S-sized; mostly plumbing existing/derivable figures, with a feasibility note on cost-cap flags. |
| **Quadrant** | **Fill-in** | |

- **Dependencies:** Should follow once parallel modes' metrics shape is stable (now shipped).
- **Blocked by:** Nothing.
- **Blocks:** Nothing (may spawn a follow-up if cost caps are pursued).

---

### bl-ef38 — Add similarity heuristic for near-converged deliberation states

> Optional deterministic similarity measure (e.g. normalized edit distance) that lets the loop self-confirm almost-converged states instead of escalating, agency-gated to moderate+.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low** | Reduces escalation frequency on long documents; explicitly a deferred nice-to-have, deterministic-only escalation already shipped. |
| **Effort** | **Low** | S-sized; bounded algorithm + threshold + audit-trail disclosure + boundary tests. |
| **Quadrant** | **Fill-in** | |

- **Dependencies:** Builds on the DR-004 normalization / convergence engine (shipped).
- **Blocked by:** Nothing.
- **Blocks:** Nothing.

---

### bl-e39a — Add whole-document harmonization pass after section convergence

> Optional post-convergence pass (`--harmonize`) where peers see the full assembled document and propose cross-section refinements; removes the v0.1 "no harmonization" limitation.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low** | Quality improvement for multi-section documents; roadmap-placed in "Later" (after the family ships, per v3 Phase 4). |
| **Effort** | **Medium** | M-sized; new sequential post-fan-in pass that must compose with both sequential and host-mediated parallel orchestration + resume. |
| **Quadrant** | **Fill-in** (defer until family ships) | |

- **Dependencies:** Reuses loop mechanics + convergence detection; must compose with parallel section dispatch.
- **Blocked by:** Nothing hard.
- **Blocks:** Nothing.

---

## 3. Dependency Graph

```
Legend:  ──▶  hard dependency (must complete first)
         - -▶  soft dependency (beneficial but not required)

[DONE] bl-5d49 ──▶ bl-5174

[DONE] bl-7af0 ──▶ bl-b9b9
                ├─▶ bl-87ef
                ├─▶ bl-0cb8
                └─▶ bl-645c   (also needs: peer tool-access design decision)

bl-f0b6 - -▶ bl-bb7e
bl-3a88 - -▶ bl-bb7e          (related: both touch the Paseo / peer-invocation boundary)

Independent (no backlog dependencies):
  bl-d85f [independent]
  bl-9ed4 [independent]
  bl-ef38 [independent]
  bl-e39a [independent]
```

**ID legend** (every ID used above):

| ID | Title |
| --- | --- |
| bl-5d49 | Add parallel-revision iteration mode (DONE) |
| bl-7af0 | Add parallel-synthesized iteration mode (DONE) |
| bl-5174 | Add consensus-evaluate skill (artifact vs rubric) |
| bl-b9b9 | Add consensus-create skill (artifact from brief) |
| bl-87ef | Add consensus-decide skill (recommend among options) |
| bl-0cb8 | Add consensus-plan skill (structured plan from goal) |
| bl-645c | Add consensus-research skill (investigate question, synthesized findings) |
| bl-3a88 | Tool-based verdict submission for consensus peers |
| bl-bb7e | Investigate in-house peer-invocation CLI (reduce/replace Paseo) |
| bl-f0b6 | Verify cursor-as-peer end-to-end through Paseo |
| bl-d85f | Complete v0.1 release verification and tag |
| bl-9ed4 | Add deliberation metrics to artifacts |
| bl-ef38 | Add similarity heuristic for near-converged states |
| bl-e39a | Add whole-document harmonization pass |

---

## 4. Parallel Lanes

These are independent work streams that can be tackled concurrently without conflicts.

### Lane A: Consensus family skills

The five thin wrappers over `consensus-loop`. All gating iteration modes have shipped, so the whole lane is unblocked. `consensus-evaluate` lands first (proves the pattern, needs only `parallel_revision`); the three synthesized-mode wrappers can then proceed in parallel; `consensus-research` last (pending peer tool-access design).

```
bl-5174 ──▶ { bl-b9b9, bl-87ef, bl-0cb8 } ──▶ bl-645c
```

**Items in this lane:**

- **bl-5174** — Add consensus-evaluate skill (artifact vs rubric)
- **bl-b9b9** — Add consensus-create skill (artifact from brief)
- **bl-87ef** — Add consensus-decide skill (recommend among options)
- **bl-0cb8** — Add consensus-plan skill (structured plan from goal)
- **bl-645c** — Add consensus-research skill (investigate question, synthesized findings)

**Total estimated effort:** Medium-High (one M + three S + one M, but a shared wrapper pattern compounds across them)
**Cross-lane dependencies:** Hardening from Lane C (bl-3a88) would de-risk the synthesized-mode wrappers but is not a hard blocker.

### Lane B: Release / distribution

Fully independent; gates announcements, not development. Can run start-to-finish alongside any other lane.

```
bl-d85f
```

**Items in this lane:**

- **bl-d85f** — Complete v0.1 release verification and tag

**Total estimated effort:** Medium
**Cross-lane dependencies:** None.

### Lane C: Peer-invocation / Paseo hardening

Structured-output robustness and the Paseo dependency boundary. `bl-f0b6` produces ACP-reliability evidence that feeds `bl-bb7e`'s build-vs-buy decision; `bl-3a88` is the highest-leverage durable fix and can proceed independently.

```
bl-f0b6 - -▶ bl-bb7e
bl-3a88   (independent, related)
```

**Items in this lane:**

- **bl-f0b6** — Verify cursor-as-peer end-to-end through Paseo
- **bl-bb7e** — Investigate in-house peer-invocation CLI (reduce/replace Paseo)
- **bl-3a88** — Tool-based verdict submission for consensus peers

**Total estimated effort:** High (two L + one S)
**Cross-lane dependencies:** Strengthens Lane A's synthesized-mode skills.

### Lane D: Convergence & observability nice-to-haves

Independent, low-priority fill-ins to slot into gaps between higher-value work.

```
bl-9ed4   bl-ef38   bl-e39a   (all independent)
```

**Items in this lane:**

- **bl-9ed4** — Add deliberation metrics to artifacts
- **bl-ef38** — Add similarity heuristic for near-converged states
- **bl-e39a** — Add whole-document harmonization pass

**Total estimated effort:** Low-Medium
**Cross-lane dependencies:** None; roadmap places these after the family ships.

---

## 5. Recommended Execution Order

### Wave 1: Unblock the family + start the release lane

| Order | Item | Effort | Rationale |
| --- | --- | --- | --- |
| 1a | **bl-5174** — Add consensus-evaluate skill | Low | Earliest, lowest-effort family skill; dependency shipped; roadmap Now/Next; proves the wrapper pattern. |
| 1b | **bl-d85f** — Complete v0.1 release verification and tag | Medium | Independent; gates announcements; run in parallel from day one. |

**Parallelism:** 1a and 1b run fully in parallel (different subsystems).

### Wave 2: Family fan-out + hardening foundation

| Order | Item | Effort | Rationale |
| --- | --- | --- | --- |
| 2a | **bl-b9b9** — Add consensus-create skill | Medium | First synthesized-mode wrapper; resolves the `independent_draft` cold start + derived-sectioning design that the next two reuse. |
| 2b | **bl-87ef** — Add consensus-decide skill | Low | Thin wrapper; validates the unique minimal-agency + synthesized edge. |
| 2c | **bl-0cb8** — Add consensus-plan skill | Low | Thin wrapper; reuses create/decide groundwork. |
| 2d | **bl-3a88** — Tool-based verdict submission | High | Highest-leverage durable fix for structured-output fragility; de-risks the synthesized wrappers above. Start in parallel as a design pass. |

**Parallelism:** Resolve bl-b9b9's cold-start/sectioning design first, then bl-87ef and bl-0cb8 can run concurrently; bl-3a88 proceeds independently as its own design+spike track.

### Wave 3: Evidence-gated and design-gated items

| Order | Item | Effort | Rationale |
| --- | --- | --- | --- |
| 3a | **bl-f0b6** — Verify cursor-as-peer end-to-end | Low | Run once an authenticated `cursor-agent` is available; produces ACP-reliability evidence for bl-bb7e. |
| 3b | **bl-bb7e** — Investigate in-house peer CLI | High | Build-vs-buy investigation; consumes bl-f0b6 + bl-3a88 findings on the provider-count pivot. |
| 3c | **bl-645c** — Add consensus-research skill | Medium | Last family skill; start only after the peer tool-access design question is answered. |

**Parallelism:** 3a feeds 3b, so sequence them; 3c is independent of the Paseo investigation and can run alongside.

### Deferred

| Item | Rationale |
| --- | --- |
| **bl-9ed4** — Add deliberation metrics | Low-value observability; roadmap "Later" — slot in as a fill-in after the family ships. |
| **bl-ef38** — Add similarity heuristic | Deferred nice-to-have; deterministic-only escalation already shipped. |
| **bl-e39a** — Add whole-document harmonization pass | Roadmap "Later" (v3 Phase 4); defer until the family ships. |

---

## 6. Roadmap Alignment

### How backlog items map to roadmap phases

| Roadmap Phase / Lane | Status | Backlog Items | Notes |
| --- | --- | --- | --- |
| Consensus Phase 2 — iteration modes | **Shipped (merged)** | **bl-5d49** — parallel-revision (DONE); **bl-7af0** — parallel-synthesized (DONE) | Roadmap still says "merge pending"; git shows merged via #9. Stale. |
| Consensus — Family skills (Now/Next) | In progress | **bl-5174** — consensus-evaluate; **bl-b9b9** — consensus-create; **bl-87ef** — consensus-decide; **bl-0cb8** — consensus-plan; **bl-645c** — consensus-research | Roadmap correctly names bl-5174 as earliest. |
| Consensus — Convergence quality follow-ons (Later) | Open | **bl-ef38** — similarity heuristic; **bl-3a88** — tool-based verdict submission; **bl-bb7e** — in-house peer CLI | Roadmap groups these as deferred nice-to-haves. |
| Consensus — Harmonization & metrics (Later) | Open | **bl-e39a** — harmonization pass; **bl-9ed4** — deliberation metrics | Roadmap Phase 4, after family ships. |
| Release / distribution (Now in part) | Open | **bl-d85f** — v0.1 release verification and tag | Roadmap notes it can run parallel to consensus work. |
| Cursor-as-peer (Later) | Open | **bl-f0b6** — verify cursor-as-peer end-to-end | Roadmap lists "Cursor-as-peer documentation/dogfooding" under Later. |

### Gaps: Roadmap items without backlog coverage

| Roadmap Item | Phase | Recommendation |
| --- | --- | --- |
| Public marketplace submission (Claude/Cursor), Codex Plugin Directory, skills.sh verification | After v0.1 tag | No backlog item yet. Consider adding a post-tag distribution item (or fold into bl-d85f's post-tag acceptance criterion, which already references skills.sh verification). |
| Transcript-tooling deferrals (Cursor SQLite store, provider-hook push, Gemini CLI adapter, notable-event memory capture, richer export rendering) | Later | Intentionally not in the backlog ("promotable on demand"). No action unless prioritized. |
| Additional plugin groups as families mature | Later | Speculative; no backlog item needed yet. |

### Orphans: Backlog items not on the roadmap

| Backlog Item | Recommendation |
| --- | --- |
| **bl-3a88** — Tool-based verdict submission | Present on the roadmap under "Convergence quality follow-ons." Not an orphan, but consider promoting it out of "Later/nice-to-have" framing — its value rating (High) exceeds its current roadmap placement (see Risks). |
| **bl-f0b6** — Verify cursor-as-peer end-to-end | Covered by roadmap's "Cursor-as-peer documentation/dogfooding" line. Not a true orphan. |

All active items map to a roadmap lane — no genuine orphans.

---

## 7. Observations & Recommendations

### Strategic observations

1. **The backlog just inflected.** With both iteration modes merged, the five family skills moved from blocked to ready in one step. The critical path is now "ship the family," and the cheapest, highest-signal first move (bl-5174) is unambiguous.
2. **A wrapper-pattern compounding effect.** The family skills are thin wrappers over a shared primitive. The real cost is front-loaded in bl-b9b9 (new cold-start + sectioning design); decide/plan ride that work and are genuinely small once it's done. Sequence to extract that leverage rather than treating all five as equal.
3. **Structured-output fragility is the quiet risk.** Three separate items (bl-3a88, bl-bb7e, bl-f0b6) circle the same pain: getting reliable schema-conformant verdicts out of peers. bl-3a88 is the durable fix and rates High value despite its "Later/nice-to-have" roadmap framing — it directly de-risks the synthesized-mode family skills being built in parallel.
4. **Two true parallel tracks exist today.** Release (bl-d85f) and the family lane share nothing; running them concurrently is free throughput.

### Risks

| Risk | Mitigation |
| --- | --- |
| Reference artifacts (index overview, completed.md, roadmap.md) say iteration modes are "merge pending" when they merged via #9 — readers may mis-plan. | Refresh the three narratives to "merged." Run `oat-pjm-update-repo-reference` or update the curated sections directly. |
| Building synthesized-mode family skills (bl-b9b9/-87ef/-0cb8) on top of fragile `--output-schema` reproduces the dogfood failures. | Sequence bl-3a88 (or at least its design pass) alongside Wave 2 so hardening lands before/with the synthesized wrappers. |
| bl-645c and bl-b9b9 carry unresolved design questions (peer tool-access; derived sectioning) inside "feature" items — scope creep risk. | Split a short design/DR pass off the front of each before committing to build, especially bl-645c's peer tool-access question. |
| bl-f0b6 is environment-gated (authenticated `cursor-agent` + unlocked keychain); easy to stall silently. | Confirm the env prerequisite is satisfiable before scheduling; otherwise keep it parked rather than "in progress." |

### Quick wins to tackle immediately

1. **bl-5174** — Add consensus-evaluate skill (Low effort; dependency shipped; first family skill, roadmap Now/Next).
2. **bl-f0b6** — Verify cursor-as-peer end-to-end (Low effort, environment permitting; unblocks the bl-bb7e build-vs-buy evidence).
3. **bl-d85f** — Complete v0.1 release verification and tag (Medium effort but fully parallelizable; clears the path to any public announcement).
