# Backlog & Roadmap Review

**Date:** 2026-06-20
**Scope:** All active items under `.oat/repo/reference/backlog/items/` (20 open; 7 recently completed excluded from rating)
**Roadmap:** `.oat/repo/reference/roadmap.md`
**Purpose:** Prioritize by value/effort, surface dependencies, and recommend an execution sequence

> If a one-page execution companion exists in this directory, see [`priority-alignment.md`](./priority-alignment.md) — produced via the optional walkthrough at the end of `oat-pjm-review-backlog`. It is the short, ordered "what to do next" view of this full review.

---

## 1. Executive Summary

The backlog contains **20 active items** (1 high, 10 medium, 9 low priority) plus **7 recently completed** since the last review (the two iteration modes `bl-5d49`/`bl-7af0`, `bl-5174` consensus-evaluate, `bl-bb7e` owned provider CLI, `bl-bfb4`/`bl-853a` the TypeScript+Vitest toolchain, and `bl-f0b6` Cursor-as-peer E2E). Three things have fundamentally shifted the board since the 2026-06-14 review:

1. **The "Paseo dependency" framing is obsolete.** `bl-bb7e` shipped an *owned* `consensus` provider CLI (DR-023) that now owns peer invocation, retry, and schema delivery for Refine/Evaluate. The old build-vs-buy lane is resolved; what remains is *hardening* the owned CLI, not deciding whether to own it.
2. **The TypeScript/Vitest foundation has landed.** The sequencing constraint that paused everything in the last priority-alignment pass is gone. The family lane and the multi-agent substrate lane are both promotable.
3. **Eleven new items were seeded** (2026-06-19/20), reshaping the medium tier: a pulled-out cold-start prerequisite (`bl-2ed7`), provider-CLI design deferrals (`bl-3291`, `bl-3ca6`, `bl-e0e7`), an advisory-peer utility (`bl-22d3`), a new multi-agent collaboration lane (`bl-4e2e` → `bl-f59f`), and four v3 decision/reserved seeds.

| Theme | Count | Key Observation |
| --- | --- | --- |
| Consensus family skills | 5 | All gating iteration modes shipped. The new critical-path gate is `bl-2ed7` (`independent_draft` cold start), which blocks create/decide/plan. `consensus-research` is design-gated, not dependency-gated. |
| Provider-CLI reliability & packaging | 4 | `bl-3291`, `bl-3a88`, `bl-e0e7`, `bl-3ca6` all build *on* the now-shipped owned CLI. Hardening + maintainability, not a build-vs-buy question anymore. |
| Multi-agent collaboration substrate | 2 | New lane: `bl-4e2e` (shared session log) → `bl-f59f` (direct messaging). Unblocked now that the TS foundation landed. |
| Advisory peer utility | 1 | `bl-22d3` (phone-a-friend) — a self-contained one-shot second-opinion skill over the provider CLI; independent of the deliberation loop. |
| Release / distribution | 1 | `bl-d85f` (v0.1 tag) is the only high-priority item and is **nearly done** — most automated/install gates passed 2026-06-20; remaining work is interactive permission prompts + post-tag discovery. |
| Convergence / quality / observability fill-ins | 3 | `bl-9ed4`, `bl-ef38`, `bl-e39a` — low-priority, independent, roadmap "Later". |
| v3 decision seeds & test guards | 4 | `bl-db5d`, `bl-58b3` (decide-before-build, may `wont_do`), `bl-f8cb`, `bl-3ca6` (reserved, large), plus `bl-3913` (cheap test guard). |

**Top-line recommendations:**

1. **Finish `bl-d85f` (v0.1 release verification & tag) now** — it is the sole high-priority item and is closest to done. Most gates passed 2026-06-20; only interactive provider permission prompts and post-tag skills.sh discovery remain. Closing it clears the path to any public listing claim.
2. **Treat `bl-2ed7` (`independent_draft` cold start) as the family-lane critical path** — it is a shared `consensus-loop` capability that hard-blocks `bl-b9b9`/`bl-87ef`/`bl-0cb8`. Land it before (or as the front of) `consensus-create`, then decide/plan ride it cheaply.
3. **`bl-3913` (rubric example cap guard) is a free quick win** — S-sized, ship-safe, no runtime change. Note the item text says "Node `node:test` or Vitest"; the repo retired `node:test` (`tests/tooling/no-node-test-runner.test.ts` enforces it), so this must be authored as a Vitest `.test.ts`.

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

> Execute the remaining `RELEASING.md` gates on real provider runtimes, finalize CHANGELOG, and tag v0.1.0.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **High** | Milestone prerequisite — gates the public marketplace / skills.sh announcements. No public claims until this lands. The only high-priority item on the board. |
| **Effort** | **Low** | Most gates already passed (2026-06-20): automated build/type-check/test/validate/smoke, version/tag readiness, release-workflow parity, Claude/Codex local installs, and Cursor authenticated peer E2E. Remaining is interactive permission prompts (3 providers) + post-tag discovery verification. |
| **Quadrant** | **Quick Win** (the remaining slice only) | High value, low remaining effort — closest-to-done high-value item. |

- **Dependencies:** None
- **Blocked by:** Nothing (remaining gates are interactive provider prompts + post-tag steps)
- **Blocks:** Public marketplace submission, Codex Plugin Directory, skills.sh discovery claims (not yet backlog items)

---

### bl-2ed7 — Implement independent_draft cold-start strategy in consensus-loop

> Add the `independent_draft` cold-start strategy (round 1 = per-peer independent drafts from the brief, no shared starting artifact) to the shared `consensus-loop` primitive, across all iteration modes.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **High** | Shared-primitive capability that hard-blocks **three** family skills (create/decide/plan). Pulled out of `bl-b9b9` precisely because it is the common gate, not one skill's concern. This is the family lane's critical path. |
| **Effort** | **Medium** | M-sized; touches the `consensus-loop` core, must work across all three iteration modes, record cold-start in the resolution block, and carry its own loop-level tests. |
| **Quadrant** | **Strategic** | High value, moderate effort; sequence it first in the family lane. |

- **Dependencies:** Reuses `consensus-loop` + the shipped iteration modes.
- **Blocked by:** Nothing.
- **Blocks:** `bl-b9b9` (create), `bl-87ef` (decide), `bl-0cb8` (plan) — all hard-blocked.

---

### bl-b9b9 — Add consensus-create skill (artifact from brief)

> Peers produce a new artifact from a brief through deliberation. Defaults: independent_draft / parallel_synthesized / maximum agency.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Medium** | First synthesized-mode family wrapper and the natural first consumer of `independent_draft`; front-loads the derived-sectioning design (whole-artifact vs outline-first) that decide/plan reuse — more than a rote wrapper. |
| **Effort** | **Medium** | M-sized; the cold-start machinery is now factored into `bl-2ed7`, but the derived-sectioning design decision still lives here. |
| **Quadrant** | **Strategic** | Front-load the sectioning design; decide/plan ride it. |

- **Dependencies:** `parallel_synthesized` (shipped); `independent_draft` (`bl-2ed7`); derived-sectioning design.
- **Blocked by:** `bl-2ed7`.
- **Blocks:** Soft-precedes `bl-87ef`/`bl-0cb8` (shares sectioning groundwork).

---

### bl-87ef — Add consensus-decide skill (recommend among options)

> Peers deliberate over options and converge on a decision doc with reasoning and dissent. Defaults: independent_draft / parallel_synthesized / minimal agency.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Medium** | Family member; the minimal-agency + synthesized combination is unique (contested calls always surface), so it validates an important agency edge. |
| **Effort** | **Low** | S-sized thin wrapper once `bl-2ed7` and `bl-b9b9`'s sectioning groundwork land. |
| **Quadrant** | **Quick Win** (after its blockers) | |

- **Dependencies:** `parallel_synthesized` (shipped); `independent_draft` (`bl-2ed7`).
- **Blocked by:** `bl-2ed7` (hard); `bl-b9b9` (soft — sectioning groundwork).
- **Blocks:** Nothing.

---

### bl-0cb8 — Add consensus-plan skill (structured plan from goal)

> Peers produce a structured plan (steps, dependencies, risks) from a goal. Defaults: independent_draft / parallel_synthesized / moderate agency.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Medium** | Family member; straightforward defaults, no unique agency/cold-start edge beyond what create/decide already exercise. |
| **Effort** | **Low** | S-sized thin wrapper. |
| **Quadrant** | **Quick Win** (after its blockers) | |

- **Dependencies:** `parallel_synthesized` (shipped); `independent_draft` (`bl-2ed7`).
- **Blocked by:** `bl-2ed7` (hard); `bl-b9b9` (soft — sectioning groundwork).
- **Blocks:** Nothing.

---

### bl-645c — Add consensus-research skill (investigate question, synthesized findings)

> Peers investigate a question and converge on synthesized findings with evidence. Defaults: shared_input / parallel_synthesized / moderate agency.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low** | Explicitly the lowest-priority family skill; peer turns are tool-using research, not text edits. |
| **Effort** | **Medium** | M-sized; gated on an unresolved design question — whether provider-CLI peers get tool access and under what permissions — which may justify its own design pass/DR. |
| **Quadrant** | **Strategic** (low-value variant → defer until peer tool-access is settled) | |

- **Dependencies:** `parallel_synthesized` (shipped). Uses `shared_input` cold start, so it is **not** blocked by `bl-2ed7`.
- **Blocked by:** Nothing hard; design-gated on the peer tool-access decision.
- **Blocks:** Nothing.

---

### bl-22d3 — Add phone-a-friend advisory peer skill

> A lightweight skill that asks one provider-backed peer for a one-shot structured second opinion via the owned provider CLI — advisory only, no deliberation loop, no refine/evaluate artifact.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Medium** | High day-to-day utility (a fast cross-provider sanity check on a design/bug/review concern) at a fraction of the deliberation loop's cost; self-contained and broadly reusable. |
| **Effort** | **Medium** | M-sized; new shipped skill with a documented output schema, context-inference + sensitive-material guidance, default cross-provider peer selection, a host disposition step, recursion/self-spawn safety, and a naming decision (`phone-a-friend` vs `phone-friend`) to resolve before shipping. |
| **Quadrant** | **Strategic** | Independent of the family/cold-start machinery; can run in any wave once the provider CLI is depended on (it is, shipped). |

- **Dependencies:** Owned provider CLI (shipped).
- **Blocked by:** Nothing.
- **Blocks:** Nothing.

---

### bl-3291 — Refine provider-exit retry classification (transient vs terminal)

> Classify `PROVIDER_EXIT` outcomes by adapter stderr/exit-signature matching so retries target genuinely transient failures (rate limits, 429s, interrupted runs) and recognized-terminal exits stop early.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Medium** | Reliability + latency: retry-all is a safe floor that burns `max_attempts`/wall-clock on non-recoverable exits and under-reacts to provider transients. Strictly-additive change (unknown exits keep current behavior). |
| **Effort** | **Medium** | M-sized; per-adapter signature matching, terminal-stop with `terminal_reason`, audit/diagnostic fields, and tests for transient/terminal/unknown paths per adapter. |
| **Quadrant** | **Strategic** | Targeted hardening of the shipped CLI's retry boundary. |

- **Dependencies:** Builds on the shipped provider CLI retry boundary (`bl-bb7e`, done).
- **Blocked by:** Nothing.
- **Blocks:** Nothing. Complementary to `bl-3a88` (process-exit handling vs structured-output validation — distinct boundaries).

---

### bl-e0e7 — Share consensus generated runtime output at the plugin level

> Replace the duplicated per-skill `consensus-loop.mjs` generated output with one plugin-local shared script (`plugins/consensus/scripts/consensus-loop.mjs`), gated by a spike proving plugin-local shared scripts resolve from installed layouts in Cursor, Copilot, Claude, and Codex.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Medium** | Maintainability — removes duplicate generated runtime output across refine/evaluate (verified duplication today). But the payoff is contingent on the multi-host install spike passing; the spike may recommend keeping duplication. |
| **Effort** | **Medium** | M-sized; spike across 4 hosts, then a `build-generated.mjs` change, drift-check updates, and a release/test check that exercises the installed plugin-root layout. |
| **Quadrant** | **Strategic** (spike-gated) | Do the spike first; it is a real go/no-go. |

- **Dependencies:** Generated-runtime build pipeline (shipped).
- **Blocked by:** Nothing (the spike is the first internal step).
- **Blocks:** Nothing.

---

### bl-3a88 — Tool-based verdict submission for consensus peers (reliability hardening)

> Give peers an explicit validated verdict-submission surface (a tool/CLI the agent calls) instead of relying only on final-message JSON + orchestrator validation, so schema errors are returned in-context for self-correction.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Medium** (high-leverage but narrowed) | Live dogfooding repeatedly hit structured-output fragility (codex strict output, OpenAI `oneOf` rejection, synthesizer "finished without structured output"). A validated submit-tool co-locates schema enforcement with the agent. Narrowed since `bl-bb7e`: the CLI already owns local validation/retry, so this is durability hardening, not a ship blocker. |
| **Effort** | **High** | L-sized; deserves its own design pass (MCP tool vs CLI, how the orchestrator captures the verdict, composition with stateless-per-turn agents and the deterministic engine). |
| **Quadrant** | **Strategic** | De-risks the synthesized-mode family wrappers; design pass can run alongside the family lane. |

- **Dependencies:** Owned provider CLI (shipped) — now the boundary this would extend.
- **Blocked by:** Nothing.
- **Blocks:** Nothing formally; soft-de-risks `bl-b9b9`/`bl-87ef`/`bl-0cb8`/`bl-645c`.

---

### bl-4e2e — Shared session log substrate (become-observable daemon + merged log)

> Foundation of a multi-agent collaboration substrate: an agent-initiated "become observable" registration + a central daemon that merges registered sessions into one timestamp-ordered, noise-filtered shared log any participating agent can tail. Extends `session-observer`.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Medium** | Opens a genuinely new capability lane (multi-agent observation) and establishes the shared `.consensus/` state dir + agent-identity primitive that messaging reuses. But it is a foundation investment, not an immediate workflow win. |
| **Effort** | **High** | L-sized initiative; ~6 open design questions (adopt `cass` vs bespoke, packaging, merge/filter schema), daemon lifecycle (heartbeat/crash cleanup, idle timeout, reactivation), needs a design pass + DR before build. |
| **Quadrant** | **Strategic** | Roadmap "Later"; now promotable since the TS foundation landed. |

- **Dependencies:** Extends shipped `session-observer` cursor/high-water-mark pattern.
- **Blocked by:** Nothing (sequenced after TS hardening, which is done).
- **Blocks:** `bl-f59f` (inter-agent messaging reuses its identity/state primitives).

---

### bl-f59f — Inter-agent direct messaging (addressable, prioritized)

> Addressable agent-to-agent direct messages with priority-over-log semantics (checked before shared-log catch-up), reusing the substrate's identity + cursor primitives. Build-vs-adopt against Agent Mail / `cass`.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Medium** | The targeted-signal capability layer on top of ambient observation; meaningful once multiple agents collaborate on one project. |
| **Effort** | **Medium** | M-sized; ~4 open design questions; a recorded build-vs-adopt decision (Agent Mail/`cass` wrapper vs lightweight queue-with-cursor); reuses the substrate's identity layer. |
| **Quadrant** | **Strategic** | Sequenced strictly after the substrate foundation. |

- **Dependencies:** `bl-4e2e` identity/state/cursor primitives.
- **Blocked by:** `bl-4e2e` (hard).
- **Blocks:** Nothing.

---

### bl-3913 — Add a test guarding bundled rubric examples at <=12 parser-visible criteria

> A focused test that runs the canonical `extractRubricCriteria` logic over each bundled `evaluate` example and asserts each yields <=12 distinct parser-visible criteria, protecting the cap mechanically.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low** | Future-proofing only; the examples are correct as shipped. Prevents a silent truncation regression if a future edit adds headings/bullets. |
| **Effort** | **Low** | S-sized; one test, no runtime or content change. |
| **Quadrant** | **Quick Win / Fill-in** | The cheapest ship-safe item on the board. |

- **Dependencies:** Exercises shipped `extractRubricCriteria` + the 4 bundled examples (verified present).
- **Blocked by:** Nothing.
- **Blocks:** Nothing.
- **Note:** Item text offers "Node `node:test` or Vitest"; `node:test` is retired and guarded against, so author this as a Vitest `.test.ts`.

---

### bl-9ed4 — Add deliberation metrics (tokens, wall-clock, rounds) to artifacts

> Add consistent token/cost/round/wall-clock metrics to turn records, loop status, and the resolution block across iteration modes; degrade gracefully when a provider does not surface a figure.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low** | Observability improvement; roadmap "Later" after the family ships. |
| **Effort** | **Low** | S-sized; mostly plumbing derivable figures + a feasibility note on cost-cap flags. Parallel-mode metrics shape is now stable. |
| **Quadrant** | **Fill-in** | |

- **Dependencies:** Parallel-mode metrics shape (shipped).
- **Blocked by:** Nothing.
- **Blocks:** Nothing (may spawn a cost-cap follow-up).

---

### bl-ef38 — Add similarity heuristic for near-converged deliberation states

> Optional deterministic similarity measure (e.g. normalized edit distance over DR-004 normalization) that lets the loop self-confirm almost-converged states instead of escalating, agency-gated to moderate+.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low** | Reduces escalation frequency on long documents; explicitly a deferred nice-to-have. Deterministic-only escalation already shipped. |
| **Effort** | **Low** | S-sized; bounded algorithm + threshold + audit-trail disclosure + boundary tests. |
| **Quadrant** | **Fill-in** | |

- **Dependencies:** DR-004 normalization / convergence engine (shipped).
- **Blocked by:** Nothing.
- **Blocks:** Nothing.

---

### bl-e39a — Add whole-document harmonization pass after section convergence

> Optional post-convergence pass (`--harmonize`) where peers see the full assembled document and propose cross-section refinements; removes the v0.1 "no harmonization" limitation.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low** | Quality improvement for multi-section documents; roadmap "Later" (after the family ships, per v3 Phase 4). |
| **Effort** | **Medium** | M-sized; new sequential post-fan-in pass that must compose with both sequential and host-mediated parallel orchestration + resume. |
| **Quadrant** | **Fill-in** (defer until family ships) | |

- **Dependencies:** Reuses loop mechanics + convergence detection; must compose with parallel section dispatch.
- **Blocked by:** Nothing hard.
- **Blocks:** Nothing.

---

### bl-3ca6 — Define host-native dispatch / safe-packet protocol (reserved seam)

> A thin seed giving the reserved host-native-dispatch capability flags (`supports_host_native_dispatch`, `host_native_safe_packet_required`) a tracked home: a written go/no-go and, if pursued, the safe-packet/history/execution/audit/safety contract before any adapter flips the flag.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low** | Speculative; the value is preventing the reserved flags/vocabulary from being orphaned or accidentally enabled. May resolve `wont_do` if the prompt/CLI floor stays sufficient. |
| **Effort** | **High** | L-sized initiative if pursued (full protocol design); the go/no-go itself is small. |
| **Quadrant** | **Avoid / Defer** | Do the cheap go/no-go; defer the design unless a concrete need emerges. |

- **Dependencies:** Provider CLI reserved seams (shipped, `bl-bb7e`).
- **Blocked by:** Nothing.
- **Blocks:** Nothing (it is the gate that keeps the flag from being flipped prematurely).

---

### bl-db5d — LLM section auto-chunking fallback (--sections auto-llm) — for discussion

> Open question: should there be an opt-in LLM auto-chunking fallback (`--sections auto-llm`) for unstructured documents with no usable headings, vs the current deterministic whole-document fallback?

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low** | Undecided; non-determinism would complicate resume, per-section convergence, and audit reproducibility. May resolve `wont_do`. |
| **Effort** | **Low** | S-sized decision; the build (if pursued, strictly opt-in) is larger but contingent. |
| **Quadrant** | **Fill-in** (decision-first) | Decide before building. |

- **Dependencies:** Deterministic sectioning (shipped).
- **Blocked by:** Nothing.
- **Blocks:** Nothing.

---

### bl-58b3 — Mid-loop user artifact edits (type=edit intervention) — for discussion

> Open question: make a first-class `type=edit` user intervention (peers told "the user edited this, continue from here") distinct from the existing artifact-edit-then-resume path?

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low** | Undecided; the canonical-artifact resume may already cover this. May resolve `wont_do`. |
| **Effort** | **Low** | S-sized decision + (if pursued) first-class audit logging. |
| **Quadrant** | **Fill-in** (decision-first) | Decide before building. |

- **Dependencies:** Existing resume / `USER_INTERVENTION` / `HOST_DECISION` machinery (shipped).
- **Blocked by:** Nothing.
- **Blocks:** Nothing.

---

### bl-f8cb — Multi-peer (3+) deliberation extension (reserved / v3+ concern)

> Thin seed for the parked v3 "three+ agent" extension so the two-peer constraint is explicit. Introduces pairwise-vs-group convergence, tie/majority semantics, oscillation generalization, verdict aggregation, and cost scaling.

| Dimension | Rating | Rationale |
| --- | --- | --- |
| **Value** | **Low** | Speculative; no justified need yet. The value is keeping the two-peer constraint explicit and the idea tracked. |
| **Effort** | **High** | L-sized; a fundamental generalization of the convergence engine if pursued. |
| **Quadrant** | **Avoid / Defer** | Go/no-go only; revisit if a concrete 3+-peer need emerges. |

- **Dependencies:** Convergence engine (shipped, two-peer).
- **Blocked by:** Nothing.
- **Blocks:** Nothing.

---

## 3. Dependency Graph

```
Legend:  ──▶  hard dependency (must complete first)
         - -▶  soft dependency (beneficial but not required)

bl-2ed7 ──▶ bl-b9b9 ──▶ bl-87ef
        ├─▶ bl-87ef        (bl-b9b9 - -▶ bl-87ef: sectioning groundwork)
        └─▶ bl-0cb8        (bl-b9b9 - -▶ bl-0cb8: sectioning groundwork)

bl-4e2e ──▶ bl-f59f

bl-645c   (no backlog dep; design-gated on peer tool-access decision)
bl-3a88 - -▶ { bl-b9b9, bl-87ef, bl-0cb8, bl-645c }   (de-risks synthesized output)

Independent (no backlog dependencies):
  bl-d85f   bl-22d3   bl-3291   bl-e0e7   bl-3a88   bl-3913
  bl-9ed4   bl-ef38   bl-e39a   bl-3ca6   bl-db5d   bl-58b3   bl-f8cb
```

**ID legend** (every ID used above):

| ID | Title |
| --- | --- |
| bl-2ed7 | Implement independent_draft cold-start strategy in consensus-loop |
| bl-b9b9 | Add consensus-create skill (artifact from brief) |
| bl-87ef | Add consensus-decide skill (recommend among options) |
| bl-0cb8 | Add consensus-plan skill (structured plan from goal) |
| bl-645c | Add consensus-research skill (investigate question, synthesized findings) |
| bl-3a88 | Tool-based verdict submission for consensus peers |
| bl-4e2e | Shared session log substrate (become-observable daemon + merged log) |
| bl-f59f | Inter-agent direct messaging (addressable, prioritized) |
| bl-d85f | Complete v0.1 release verification and tag |
| bl-22d3 | Add phone-a-friend advisory peer skill |
| bl-3291 | Refine provider-exit retry classification (transient vs terminal) |
| bl-e0e7 | Share consensus generated runtime output at the plugin level |
| bl-3913 | Add a test guarding bundled rubric examples at <=12 criteria |
| bl-9ed4 | Add deliberation metrics to artifacts |
| bl-ef38 | Add similarity heuristic for near-converged states |
| bl-e39a | Add whole-document harmonization pass |
| bl-3ca6 | Define host-native dispatch / safe-packet protocol (reserved) |
| bl-db5d | LLM section auto-chunking fallback (for discussion) |
| bl-58b3 | Mid-loop user artifact edits (for discussion) |
| bl-f8cb | Multi-peer (3+) deliberation extension (reserved) |

---

## 4. Parallel Lanes

These are independent work streams that can be tackled concurrently without conflicts.

### Lane A: Consensus family skills

The synthesized-mode wrappers over `consensus-loop`. The gating iteration modes shipped; the lane's internal critical path is now `bl-2ed7` (`independent_draft`), which blocks create/decide/plan. `consensus-research` is design-gated (peer tool-access), not dependency-gated, and uses `shared_input` so it does not need `bl-2ed7`.

```
bl-2ed7 ──▶ bl-b9b9 ──▶ { bl-87ef, bl-0cb8 }
bl-645c   (parallel; design-gated on peer tool-access)
```

**Items in this lane:**

- **bl-2ed7** — Implement independent_draft cold-start strategy in consensus-loop
- **bl-b9b9** — Add consensus-create skill (artifact from brief)
- **bl-87ef** — Add consensus-decide skill (recommend among options)
- **bl-0cb8** — Add consensus-plan skill (structured plan from goal)
- **bl-645c** — Add consensus-research skill (investigate question, synthesized findings)

**Total estimated effort:** Medium-High (one M cold-start + one M create + two S + one M research; shared wrapper pattern compounds)
**Cross-lane dependencies:** Hardening from Lane C (`bl-3a88`) soft-de-risks the synthesized wrappers but is not a hard blocker.

### Lane B: Release / distribution

Independent; gates announcements, not development. Mostly complete.

```
bl-d85f
```

**Items in this lane:**

- **bl-d85f** — Complete v0.1 release verification and tag

**Total estimated effort:** Low (remaining slice)
**Cross-lane dependencies:** None.

### Lane C: Provider-CLI reliability & packaging

Hardening and maintainability *on top of* the now-shipped owned provider CLI — not a build-vs-buy question anymore.

```
bl-3291   bl-3a88   bl-e0e7   bl-3ca6   (all independent of each other)
```

**Items in this lane:**

- **bl-3291** — Refine provider-exit retry classification (transient vs terminal)
- **bl-3a88** — Tool-based verdict submission for consensus peers
- **bl-e0e7** — Share consensus generated runtime output at the plugin level
- **bl-3ca6** — Define host-native dispatch / safe-packet protocol (reserved; go/no-go first)

**Total estimated effort:** High (two L + two M; `bl-3ca6` likely defers after go/no-go)
**Cross-lane dependencies:** `bl-3a88` strengthens Lane A's synthesized-mode skills.

### Lane D: Advisory peer utility

Self-contained one-shot second-opinion skill over the provider CLI; no deliberation loop.

```
bl-22d3
```

**Items in this lane:**

- **bl-22d3** — Add phone-a-friend advisory peer skill

**Total estimated effort:** Medium
**Cross-lane dependencies:** None (depends only on the shipped provider CLI).

### Lane E: Multi-agent collaboration substrate

A new lane beneath the deliberation engine: how agents observe and message each other on one project. Unblocked now that the TS foundation landed.

```
bl-4e2e ──▶ bl-f59f
```

**Items in this lane:**

- **bl-4e2e** — Shared session log substrate (become-observable daemon + merged log)
- **bl-f59f** — Inter-agent direct messaging (addressable, prioritized)

**Total estimated effort:** High (one L foundation + one M capability layer; both carry design passes)
**Cross-lane dependencies:** None; extends shipped `session-observer`.

### Lane F: Convergence / quality / observability fill-ins

Low-priority, independent nice-to-haves; roadmap "Later" (after the family ships).

```
bl-9ed4   bl-ef38   bl-e39a   (all independent)
```

**Items in this lane:**

- **bl-9ed4** — Add deliberation metrics to artifacts
- **bl-ef38** — Add similarity heuristic for near-converged states
- **bl-e39a** — Add whole-document harmonization pass

**Total estimated effort:** Low-Medium
**Cross-lane dependencies:** None.

### Lane G: v3 decision seeds & test guards

Decide-before-build seeds (several may resolve `wont_do`) plus one cheap ship-safe test guard.

```
bl-3913   bl-db5d   bl-58b3   bl-f8cb   (all independent)
```

**Items in this lane:**

- **bl-3913** — Add a test guarding bundled rubric examples at <=12 criteria (ship-safe quick win)
- **bl-db5d** — LLM section auto-chunking fallback (decision-first; may `wont_do`)
- **bl-58b3** — Mid-loop user artifact edits (decision-first; may `wont_do`)
- **bl-f8cb** — Multi-peer (3+) deliberation extension (go/no-go; may `wont_do`)

**Total estimated effort:** Low (decisions + one S test); build cost is contingent and deferred.
**Cross-lane dependencies:** None.

---

## 5. Recommended Execution Order

### Wave 1: Finish the release + unblock the family + bank a free test guard

| Order | Item | Effort | Rationale |
| --- | --- | --- | --- |
| 1a | **bl-d85f** — Complete v0.1 release verification and tag | Low | Sole high-priority item, closest to done; run the remaining interactive permission prompts + post-tag discovery and tag. |
| 1b | **bl-2ed7** — Implement independent_draft cold-start | Medium | Family-lane critical path; hard-blocks create/decide/plan. Start immediately, in parallel with 1a. |
| 1c | **bl-3913** — Rubric example cap guard | Low | Free ship-safe quick win; slot in around the above. Author as Vitest `.test.ts`. |

**Parallelism:** 1a (release/ops) ∥ 1b (consensus-loop core) ∥ 1c (test) — all different surfaces.

### Wave 2: Family fan-out + advisory utility + hardening design

| Order | Item | Effort | Rationale |
| --- | --- | --- | --- |
| 2a | **bl-b9b9** — Add consensus-create skill | Medium | First synthesized wrapper; resolves derived-sectioning design that decide/plan reuse. Needs `bl-2ed7` first. |
| 2b | **bl-87ef** — Add consensus-decide skill | Low | Thin wrapper; validates the minimal-agency + synthesized edge. |
| 2c | **bl-0cb8** — Add consensus-plan skill | Low | Thin wrapper; reuses create/decide groundwork. |
| 2d | **bl-22d3** — Add phone-a-friend advisory peer skill | Medium | Independent high-utility skill over the shipped provider CLI; can run any time. Resolve the naming decision before shipping. |
| 2e | **bl-3a88** — Tool-based verdict submission (design pass) | High | Highest-leverage durability fix for structured-output fragility; start the design pass alongside the synthesized wrappers it de-risks. |

**Parallelism:** Land `bl-b9b9`'s sectioning design first, then `bl-87ef` ∥ `bl-0cb8`. `bl-22d3` and the `bl-3a88` design pass run independently.

### Wave 3: Reliability hardening + last family skill + packaging spike

| Order | Item | Effort | Rationale |
| --- | --- | --- | --- |
| 3a | **bl-3291** — Provider-exit retry classification | Medium | Targeted reliability/latency win on the shipped CLI; strictly additive. |
| 3b | **bl-645c** — Add consensus-research skill | Medium | Last family skill; start only after the peer tool-access design question is answered (DR if durable). |
| 3c | **bl-e0e7** — Share generated runtime output (spike first) | Medium | Maintainability; run the 4-host install spike as a go/no-go before changing the generated-output layout. |

**Parallelism:** 3a, 3b, 3c touch different surfaces and can run concurrently subject to capacity.

### Wave 4: New collaboration lane (after the family settles)

| Order | Item | Effort | Rationale |
| --- | --- | --- | --- |
| 4a | **bl-4e2e** — Shared session log substrate | High | Foundation of the multi-agent lane; needs a design pass + DR. Promotable now that the TS foundation landed. |
| 4b | **bl-f59f** — Inter-agent direct messaging | Medium | Capability layer; record the build-vs-adopt (Agent Mail/`cass`) decision. Needs `bl-4e2e` first. |

**Parallelism:** Sequential within the lane (4a → 4b); the lane runs independently of consensus work.

### Deferred

| Item | Rationale |
| --- | --- |
| **bl-9ed4** — Add deliberation metrics | Low-value observability; roadmap "Later" — slot in as a fill-in after the family ships. |
| **bl-ef38** — Add similarity heuristic | Deferred nice-to-have; deterministic-only escalation already shipped. |
| **bl-e39a** — Add whole-document harmonization pass | Roadmap "Later" (v3 Phase 4); defer until the family ships. |
| **bl-3ca6** — Host-native dispatch protocol | Do the cheap go/no-go; defer the full design (likely `wont_do` near-term). |
| **bl-db5d** — LLM section auto-chunking | Decision-first; may `wont_do`. Decide before building. |
| **bl-58b3** — Mid-loop user artifact edits | Decision-first; existing resume may already cover it. May `wont_do`. |
| **bl-f8cb** — Multi-peer (3+) extension | Go/no-go only; revisit if a concrete 3+-peer need emerges. |

---

## 6. Roadmap Alignment

### How backlog items map to roadmap phases

| Roadmap Phase / Lane | Status | Backlog Items | Notes |
| --- | --- | --- | --- |
| Release / distribution (Now) | In progress (nearly done) | **bl-d85f** — v0.1 release verification and tag | Roadmap Now correctly names it; most gates passed 2026-06-20. |
| Post-tag discovery verification (Now) | Open | (covered by **bl-d85f** post-tag acceptance criterion) | No standalone item; folded into `bl-d85f`. |
| Consensus — Remaining family skills (Next) | Open | **bl-2ed7** — independent_draft (gate); **bl-b9b9** — create; **bl-87ef** — decide; **bl-0cb8** — plan; **bl-645c** — research | Roadmap names create as front-loading the cold-start; it now lives in `bl-2ed7`. Surface `bl-2ed7` explicitly on the roadmap as the gate. |
| Consensus — Peer-invocation hardening (Next) | Open | **bl-3a88** — tool-based verdict submission; **bl-3291** — retry classification | Roadmap names `bl-3a88`; `bl-3291` is a newer design-deferral from the provider-CLI project. |
| Consensus — Convergence quality (Later) | Open | **bl-ef38** — similarity heuristic | Roadmap groups as deferred nice-to-have. |
| Consensus — Harmonization & metrics (Later) | Open | **bl-e39a** — harmonization; **bl-9ed4** — deliberation metrics | Roadmap Phase 4, after family ships. |
| Multi-agent collaboration substrate (Later) | Open | **bl-4e2e** — shared session log; **bl-f59f** — inter-agent messaging | Roadmap sequences this after TS hardening (now done) — promote off "Later." |
| Reserved seams / provider CLI (implied) | Open | **bl-3ca6** — host-native dispatch; **bl-e0e7** — shared runtime output | Newer items not yet broken out on the roadmap (see Gaps/Orphans). |

### Gaps: Roadmap items without backlog coverage

| Roadmap Item | Phase | Recommendation |
| --- | --- | --- |
| Public marketplace submission (Claude/Cursor), Codex Plugin Directory, skills.sh verification | After v0.1 tag | Still no dedicated post-tag distribution item. `bl-d85f` covers post-tag skills.sh discovery verification but not the marketplace/Plugin-Directory submissions. Consider a successor item after the tag. |
| Cursor submit-tool / custom ACP provider path exploration | Later | Partially related to `bl-3a88` (verdict submission) but not the same; no dedicated item. Track if pursued. |
| Transcript-tooling deferrals (Cursor SQLite store, provider-hook push, Gemini CLI adapter, notable-event memory capture, richer export rendering) | Later | Intentionally not in the backlog ("promotable on demand"). No action unless prioritized. |
| Additional plugin groups as families mature | Later | Speculative; no backlog item needed yet. |

### Orphans: Backlog items not on the roadmap

| Backlog Item | Recommendation |
| --- | --- |
| **bl-22d3** — Add phone-a-friend advisory peer skill | Newly seeded (2026-06-20); not yet on the roadmap. Add a line under the consensus lane (advisory/utility) — it is a distinct deliverable from the deliberation family. |
| **bl-e0e7** — Share consensus generated runtime output | Maintainability/packaging item not on the roadmap. Low-ceremony; either add a "provider-CLI / packaging maintainability" note or leave as a standalone backlog task. |
| **bl-3291** — Provider-exit retry classification | Fits the "peer-invocation hardening" line on the roadmap Next lane; consider naming it there alongside `bl-3a88`. |
| **bl-3ca6** — Host-native dispatch protocol | Reserved seam; mention under the provider-CLI lane so the gate is visible, even though it is likely deferred. |
| **bl-db5d / bl-58b3 / bl-f8cb** — v3 decision/reserved seeds | Intentionally parked seeds; fine to leave off the roadmap until a decision promotes one. |

All active items map to a lane or are intentionally-parked seeds — no genuine orphans, but several newly-seeded items (`bl-2ed7`, `bl-22d3`, `bl-3291`, `bl-e0e7`, `bl-3ca6`) deserve explicit roadmap lines so the planning surface reflects the current board.

---

## 7. Observations & Recommendations

### Strategic observations

1. **The board has matured past its biggest risk.** The last review's central worry — building synthesized-mode skills on a fragile external (Paseo) structured-output path — is largely resolved: the owned provider CLI shipped (DR-023) and owns validation/retry. The remaining structured-output work (`bl-3a88`) is now durability hardening, not a foundational dependency.
2. **The family lane has a single new chokepoint: `bl-2ed7`.** Pulling `independent_draft` out of `consensus-create` into a shared `consensus-loop` capability was the right call — but it means three family skills are hard-blocked on one M-sized item. Land it first to convert decide/plan into the cheap wrappers they should be.
3. **A genuinely new lane opened.** The multi-agent collaboration substrate (`bl-4e2e` → `bl-f59f`) is a different kind of work from the deliberation engine — observation/messaging plumbing extending `session-observer`. Its explicit "after TS hardening" gate is now satisfied, so it is promotable; treat it as an initiative with a design pass, not a quick feature.
4. **Two true parallel tracks exist today.** Release (`bl-d85f`) and the family lane share nothing; the advisory utility (`bl-22d3`) and the provider-CLI hardening lane are also independent of family sequencing. Several things can run at once if capacity allows.
5. **Several seeds are decisions, not builds.** `bl-db5d`, `bl-58b3`, `bl-f8cb`, and `bl-3ca6` are deliberately parked "decide-before-build" / "go-no-go" items; some will likely resolve `wont_do`. Do not let their count inflate the perceived build backlog — the real near-term build queue is much shorter than 20.

### Risks

| Risk | Mitigation |
| --- | --- |
| `bl-2ed7` is a hidden single point of failure for the family lane — three skills wait on it, but its "medium" rating can make it look optional. | Sequence it explicitly first in Wave 1 and surface it on the roadmap Next lane as the family gate. |
| `bl-d85f`'s remaining gates are interactive (provider permission prompts) and easy to stall; it is the only thing between the repo and public claims. | Schedule the interactive prompts as a focused session; do not treat "automated gates passed" as "released." |
| Building the synthesized-mode wrappers (`bl-b9b9`/`-87ef`/`-0cb8`) before `bl-3a88` hardening reproduces the dogfood structured-output failures. | Run the `bl-3a88` design pass alongside Wave 2 so hardening lands with/just after the synthesized wrappers. |
| `bl-645c` and `bl-b9b9` carry unresolved design questions (peer tool-access; derived sectioning) inside "feature" items — scope-creep risk. | Split a short design/DR pass off the front of each before committing to build, especially `bl-645c`'s peer tool-access question. |
| `bl-e0e7` could be built before its multi-host install spike, coupling the change to an unproven layout assumption. | Treat the spike as a hard go/no-go gate; record the result before touching `build-generated.mjs`. |
| Newly-seeded items (`bl-2ed7`, `bl-22d3`, `bl-3291`, `bl-e0e7`, `bl-3ca6`) are not yet reflected on the roadmap, so the planning surface understates the board. | Run `oat-pjm-update-repo-reference` to add roadmap lines for the new items. |

### Quick wins to tackle immediately

1. **bl-d85f** — Complete v0.1 release verification and tag (Low remaining effort; sole high-value item; clears the path to public claims).
2. **bl-3913** — Add the rubric example cap guard (Low effort; ship-safe; no runtime change — author as Vitest `.test.ts`).
3. **bl-2ed7** — Implement `independent_draft` cold-start (Medium effort but the highest-leverage unblock — converts three blocked family skills into ready work).
