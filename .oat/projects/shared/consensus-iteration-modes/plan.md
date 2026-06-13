---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-06-12
oat_phase: plan
oat_phase_status: in_progress
oat_plan_hill_phases: ["p07"] # pause only after final phase (p07 added 2026-06-13 from dogfood fixes)
oat_plan_parallel_groups: [] # groups of phases that run concurrently in worktrees; [] = fully sequential
oat_auto_review_at_hill_checkpoints: true
oat_plan_source: spec-driven # spec-driven | quick | imported
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
---

# Implementation Plan: consensus-iteration-modes

> Execute this plan using `oat-project-implement` — sequential by default, parallel when `oat_plan_parallel_groups` is declared.

**Goal:** Implement the parallel-revision and parallel-synthesized iteration modes in the consensus engine with a unified v1 record schema and an agency-gated escalation ladder, exposed through the refine skill.

**Architecture:** Round-executor abstraction over the existing deterministic loop engine; wrapper-driven mechanical synthesis with agency-routed host/user escalation re-entering via resume vectors (see `design.md`).

**Tech Stack:** Node >= 22 ESM, stdlib only; Paseo CLI shell-out; `node --test` with stubbed peers/synthesizer.

**Commit Convention:** `{type}(p{NN}-t{NN}): {description}` — e.g., `feat(p02-t04): add parallel-revision round executor`

## Planning Checklist

- [x] Defer HiLL checkpoint confirmation to oat-project-implement
- [x] Evaluated phases for parallelism opportunities — all six phases modify `consensus-loop.mjs` and/or `consensus-refine.mjs`, so file boundaries overlap throughout and phases run strictly sequentially
- [x] Set `oat_plan_parallel_groups` in frontmatter (empty = fully sequential)

---

## Phase 1: v1 schema family + validation substrate (p01)

**Goal:** All record types speak schema v1; mode-aware verdict and synthesis validation exists; v0 artifacts are rejected on resume; alternating is regression-locked on v1 fixtures. (FR4, FR9 groundwork)

### Task p01-t01: Bump loop schema version to v1 and relock alternating fixtures

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`
- Modify: `plugins/consensus/skills/refine/schemas/verdict-alternating.schema.json`
- Modify: `tests/verdict-validation.test.mjs`, `tests/loop-records.test.mjs`, `tests/loop-convergence.test.mjs` (fixture `schema_version` values only)

**Step 1: Write test (RED)** — update fixture expectations to `schema_version: 'v1'`; add a test asserting `LOOP_SCHEMA_VERSION === 'v1'` and that the alternating schema file's `schema_version` const is `v1`.

**Step 2: Implement (GREEN)** — change `LOOP_SCHEMA_VERSION` to `'v1'`; update the alternating schema's `schema_version` const. No other behavior changes.

**Step 3: Verify** — Run: `node --test tests/verdict-validation.test.mjs tests/loop-records.test.mjs tests/loop-convergence.test.mjs` then `npm test`. Expected: green; only schema-version fixture diffs.

**Step 4: Commit** — `git add plugins/consensus tests && git commit -m "feat(p01-t01): bump consensus record schema to v1"`

### Task p01-t02: Mode-aware verdict shape validation (parallel vocabulary)

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`
- Create: `plugins/consensus/skills/refine/schemas/verdict-parallel.schema.json`
- Modify: `tests/verdict-validation.test.mjs`

**Step 1: Write test (RED)** — cases: parallel REVISE requires `proposed_artifact` + `critique.own_previous` + `critique.peer_previous`; ACCEPT_PEER requires critique + `proposed_artifact` (copy of adopted text); CONVERGED/IMPASSE require critique + reasoning; alternating vocabulary rejected in parallel mode and vice versa.

**Step 2: Implement (GREEN)** — extend `VERDICT_BRANCHES` into per-mode branch tables; `validateVerdictShape(verdict, { mode })`; add the parallel schema file mirroring the branch table (Paseo-side enforcement).

**Step 3: Verify** — Run: `node --test tests/verdict-validation.test.mjs`. Expected: all branch/vocabulary cases pass.

**Step 4: Commit** — `git commit -m "feat(p01-t02): add mode-aware parallel verdict validation"`

### Task p01-t03: Byte caps for critique fields

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`
- Modify: `tests/verdict-validation.test.mjs`

**Step 1: Write test (RED)** — `critique.own_previous` / `critique.peer_previous` each capped at 16 KB (reasoning cap); oversize returns `OVERSIZE_REJECTED` metadata naming the field; total-verdict cap still enforced with critiques included.

**Step 2: Implement (GREEN)** — extend `validateVerdictCaps` with critique fields in `VERDICT_CAPS` accounting.

**Step 3: Verify** — Run: `node --test tests/verdict-validation.test.mjs`. Expected: cap matrix green.

**Step 4: Commit** — `git commit -m "feat(p01-t03): enforce byte caps on parallel critique fields"`

### Task p01-t04: Synthesis payload schema + shape validation

**Files:**

- Create: `plugins/consensus/skills/refine/schemas/synthesis.schema.json`
- Modify: `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`
- Modify: `tests/verdict-validation.test.mjs`

**Step 1: Write test (RED)** — `validateSynthesisShape`: requires `schema_version: 'v1'`, `synthesized_artifact` (string), `synthesis_reasoning` (string), `unresolved_disagreements` (string array, may be empty); rejects missing/mistyped fields.

**Step 2: Implement (GREEN)** — add `validateSynthesisShape` + schema file.

**Step 3: Verify** — Run: `node --test tests/verdict-validation.test.mjs`. Expected: green.

**Step 4: Commit** — `git commit -m "feat(p01-t04): add synthesis payload schema and shape validation"`

### Task p01-t05: Synthesis byte caps

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`
- Modify: `tests/verdict-validation.test.mjs`

**Step 1: Write test (RED)** — `validateSynthesisCaps`: `synthesized_artifact` ≤ 256 KB; `synthesis_reasoning` ≤ 16 KB; each disagreement ≤ 4 KB, max 20; total ≤ 512 KB; metadata-only oversize results.

**Step 2: Implement (GREEN)** — add `SYNTHESIS_CAPS` + `validateSynthesisCaps` mirroring verdict-caps structure.

**Step 3: Verify** — Run: `node --test tests/verdict-validation.test.mjs`. Expected: green.

**Step 4: Commit** — `git commit -m "feat(p01-t05): enforce synthesis byte caps"`

> **Note (resequenced 2026-06-13):** the original p01-t06 ("fail-closed v0 artifact resume rejection") was moved to Phase 5 as **p05-t05**. Rationale: the engine has two distinct version fields — the per-record `schema_version` (bumped to v1 here in p01) and the artifact-level `consensus_schema_version` (still emitted as `v0` by the wrapper until the Phase 5 cutover). Rejecting v0 *artifacts* on resume only makes sense after the wrapper emits v1 artifacts (p05-t01), otherwise the wrapper produces artifacts it cannot itself resume and 6 existing resume test files break. See implementation.md Deviations.

---

## Phase 2: Round executor + parallel-revision mode (p02)

**Goal:** Executor abstraction lands with alternating unchanged; parallel-revision runs end-to-end with deterministic pair commits, per-mode predicates, mode flag, and disclosure. (FR1, FR3, NFR1)

### Task p02-t01: Extract round-executor abstraction (alternating unchanged)

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`
- Modify: `tests/loop-convergence.test.mjs` (only if seams move)

**Step 1: Write test (RED)** — characterization: run an alternating stubbed loop and snapshot the records stream; assert post-refactor stream is identical.

**Step 2: Implement (GREEN)** — extract `executeRound({ mode, ... })` with the alternating body moved verbatim; `runConsensusLoop` iterates rounds via the executor. Pure refactor.

**Step 3: Verify** — Run: `npm test`. Expected: full suite green, characterization snapshot identical.

**Step 4: Commit** — `git commit -m "refactor(p02-t01): extract round executor abstraction"`

### Task p02-t02: --iteration flag (engine args + wrapper passthrough)

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-loop.mjs` (`parseLoopArgs`)
- Modify: `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`
- Modify: `tests/wrapper-options.test.mjs`, `tests/consensus-loop-cli.test.mjs`

**Step 1: Write test (RED)** — `--iteration parallel_revision|parallel_synthesized|alternating` accepted; default alternating; invalid value → `INVALID_ITERATION_MODE`, exit USAGE, message lists allowed values; cold-start `independent_draft` rejected with "not yet supported".

**Step 2: Implement (GREEN)** — parse + validate in both layers; thread mode into loop options and section packets context.

**Step 3: Verify** — Run: `node --test tests/wrapper-options.test.mjs tests/consensus-loop-cli.test.mjs`. Expected: green.

**Step 4: Commit** — `git commit -m "feat(p02-t02): add --iteration mode selection"`

### Task p02-t03: Parallel peer prompt builder

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`
- Modify: `tests/loop-records.test.mjs` (or new prompt assertions in `tests/loop-convergence.test.mjs`)

**Step 1: Write test (RED)** — `buildParallelTurnPrompt` includes: SECTION framing, mode line `parallel_revision`, own previous revision, peer previous revision, both prior critiques, vocabulary instruction (REVISE/ACCEPT_PEER/CONVERGED/IMPASSE + critique fields); round 1 states "previous revision: none" for both.

**Step 2: Implement (GREEN)** — new builder alongside `buildTurnPrompt`, sharing the untrusted-content framing block.

**Step 3: Verify** — Run: `node --test tests/loop-records.test.mjs`. Expected: prompt content assertions green.

**Step 4: Commit** — `git commit -m "feat(p02-t03): add parallel peer prompt builder"`

### Task p02-t04: Parallel-revision executor with atomic pair commit

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`
- Modify: `tests/loop-records.test.mjs`

**Step 1: Write test (RED)** — stub both peers with controllable resolution order: records always append in fixed peer order regardless of completion order; one peer failing → no records committed for the round, section `error` with details naming the failed peer; both verdicts validated before either record commits.

**Step 2: Implement (GREEN)** — concurrent `invokePeer` pair via `Promise.allSettled`; validate both; commit pair in peer order or abort.

**Step 3: Verify** — Run: `node --test tests/loop-records.test.mjs`. Expected: ordering + atomicity cases green.

**Step 4: Commit** — `git commit -m "feat(p02-t04): add parallel-revision round executor with atomic pair commit"`

### Task p02-t05: Parallel-revision convergence predicate

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`
- Modify: `tests/loop-convergence.test.mjs`

**Step 1: Write test (RED)** — converges on same-round normalized hash match; converges on mutual ACCEPT_PEER adopting identical prior text; does NOT converge on mutual ACCEPT_PEER adopting differing texts (swap); mutual CONVERGED converges at moderate/maximum, not at minimal; minimal agency uses strict hashing (existing agency option plumbing).

**Step 2: Implement (GREEN)** — `detectParallelConvergence(records, options)` exported; dispatched per mode.

**Step 3: Verify** — Run: `node --test tests/loop-convergence.test.mjs`. Expected: green.

**Step 4: Commit** — `git commit -m "feat(p02-t05): add parallel-revision convergence predicate"`

### Task p02-t06: Parallel oscillation predicate (pair-based)

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`
- Modify: `tests/loop-convergence.test.mjs`

**Step 1: Write test (RED)** — order-normalized round hash pairs cycling pair(N)==pair(N-2)≠pair(N-1) over 4 rounds detect oscillation; stable-but-diverged pairs do not; alternating oscillation predicate untouched.

**Step 2: Implement (GREEN)** — `detectParallelOscillation(records, options)` exported.

**Step 3: Verify** — Run: `node --test tests/loop-convergence.test.mjs`. Expected: green.

**Step 4: Commit** — `git commit -m "feat(p02-t06): add pair-based parallel oscillation detection"`

### Task p02-t07: Mode disclosure + call counts (run_started / resolution)

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`
- Modify: `plugins/consensus/skills/refine/scripts/consensus-loop.mjs` (status `peer_calls`)
- Modify: `tests/sequential-wrapper.test.mjs`

**Step 1: Write test (RED)** — `run_started` carries `iteration_mode` and `calls_per_round: { peer: 2, synthesis: 0 }` for parallel_revision (peer 1/synthesis 0 alternating); loop status and artifact resolution block carry `peer_calls` totals.

**Step 2: Implement (GREEN)** — extend event payload, `resultStatus` extras, resolution rendering, artifact frontmatter.

**Step 3: Verify** — Run: `node --test tests/sequential-wrapper.test.mjs`. Expected: green.

**Step 4: Commit** — `git commit -m "feat(p02-t07): disclose mode call multiplier and report call counts"`

### Task p02-t08: Parallel-revision integration + reproducibility

**Files:**

- Create: `tests/parallel-modes.test.mjs`

**Step 1: Write test (RED)** — wrapper end-to-end with paseo-stub: multi-section doc in parallel_revision converges; artifact contains per-round critiques for both peers; repeat the identical stubbed run and assert byte-identical records modulo timestamps/run-id (NFR1).

**Step 2: Implement (GREEN)** — fix any determinism gaps surfaced.

**Step 3: Verify** — Run: `node --test tests/parallel-modes.test.mjs && npm test`. Expected: green.

**Step 4: Commit** — `git commit -m "test(p02-t08): parallel-revision integration + reproducibility coverage"`

---

## Phase 3: Parallel-synthesized mode (p03)

**Goal:** Synthesized mode runs end-to-end: synthesis prompt/call/record, stability convergence, synthesizer configuration, two-level transaction contract. (FR2, FR6)

### Task p03-t01: Synthesis prompt builder

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`
- Modify: `tests/loop-records.test.mjs`

**Step 1: Write test (RED)** — `buildSynthesisPrompt` includes goal, both revisions (SECTION-framed), both critiques, prior unresolved disagreements, "prefer stronger reasoning" instruction, and the output contract fields.

**Step 2: Implement (GREEN)** — builder per design §2 (v3 sketch).

**Step 3: Verify** — Run: `node --test tests/loop-records.test.mjs`. Expected: green.

**Step 4: Commit** — `git commit -m "feat(p03-t01): add synthesis prompt builder"`

### Task p03-t02: --synthesizer flag, default resolution, preflight

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`, `consensus-loop.mjs`
- Modify: `tests/wrapper-options.test.mjs`, `tests/paseo-invocation.test.mjs`

**Step 1: Write test (RED)** — default synthesizer = first peer; override accepted and validated against provider inventory (`SYNTHESIZER_UNAVAILABLE` on miss); warn-and-ignore outside synthesized mode; identity threaded into loop options. (Synthesizer `paseo run` argv construction is asserted later in p03-t03's seam tests, where it belongs.)

**Step 2: Implement (GREEN)** — flag parse + preflight join with existing peer validation.

**Step 3: Verify** — Run: `node --test tests/wrapper-options.test.mjs`. Expected: green.

**Step 4: Commit** — `git commit -m "feat(p03-t02): add --synthesizer with first-peer default and preflight"`

### Task p03-t03: invokeSynthesizer seam + synthesis record

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`
- Modify: `tests/loop-records.test.mjs`

**Step 1: Write test (RED)** — synthesis record appends after the peer pair with `record_type: 'synthesis'`, synthesizer id, artifact hash of synthesized text, validated shape/caps; injectable `invokeSynthesizer` in runOptions (stub).

**Step 2: Implement (GREEN)** — seam mirrors `invokePeer`; uses synthesis schema path for `paseo run`.

**Step 3: Verify** — Run: `node --test tests/loop-records.test.mjs`. Expected: green.

**Step 4: Commit** — `git commit -m "feat(p03-t03): add synthesizer invocation seam and synthesis records"`

### Task p03-t04: Synthesized executor + stability convergence

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`
- Modify: `tests/loop-convergence.test.mjs`

**Step 1: Write test (RED)** — synthesized round flow: pair → synthesis → synthesized text is next round's shared artifact; convergence when both peer revisions hash-match the previous synthesis; not converged when only one matches.

**Step 2: Implement (GREEN)** — executor branch + `detectSynthesisStability` predicate (exported).

**Step 3: Verify** — Run: `node --test tests/loop-convergence.test.mjs`. Expected: green.

**Step 4: Commit** — `git commit -m "feat(p03-t04): add parallel-synthesized executor and stability convergence"`

### Task p03-t05: Synthesis failure semantics (two-level contract)

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`
- Modify: `tests/error-handling.test.mjs`

**Step 1: Write test (RED)** — synthesis *process* failure (stub rejects): peer pair remains durable, loop exits with a resumable state (pair without synthesis record); *invalid/oversized* synthesis: metadata-only synthesis-error record, section `error` (`INVALID_SYNTHESIS_SHAPE`/`INVALID_SYNTHESIS_CAPS`).

**Step 2: Implement (GREEN)** — distinguish failure classes per design Error Handling.

**Step 3: Verify** — Run: `node --test tests/error-handling.test.mjs`. Expected: green.

**Step 4: Commit** — `git commit -m "feat(p03-t05): implement synthesis failure semantics"`

### Task p03-t06: Synthesized integration + call counts

**Files:**

- Modify: `tests/parallel-modes.test.mjs`

**Step 1: Write test (RED)** — wrapper end-to-end stubbed synthesized run: converges via stability; artifact shows synthesis records (text, reasoning, disagreements, synthesizer id); `calls_per_round: { peer: 2, synthesis: 1 }`; resolution `synthesis_calls` total correct.

**Step 2: Implement (GREEN)** — wrapper rendering/count fixes as surfaced.

**Step 3: Verify** — Run: `node --test tests/parallel-modes.test.mjs && npm test`. Expected: green.

**Step 4: Commit** — `git commit -m "test(p03-t06): parallel-synthesized integration coverage"`

---

## Phase 4: Escalation ladder (p04)

**Goal:** Deterministic triggers, agency routing with genuinely-stuck promotion, escalation status/event, and host-direction re-entry. (FR5)

### Task p04-t01: Escalation trigger predicates

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`
- Modify: `tests/loop-convergence.test.mjs` (or create `tests/escalation.test.mjs`)

**Step 1: Write test (RED)** — `persistent_disagreement`: same trimmed-set of unresolved disagreements across 3 consecutive synthesis records (non-empty); `near_done_drift`: double-ACCEPT / mutual-CONVERGED with differing hashes; `budget_exhausted` and per-mode oscillation feed the same trigger shape; named constants exported.

**Step 2: Implement (GREEN)** — `detectEscalation(records, { mode, agency })` returning `{ trigger, ... } | null`.

**Step 3: Verify** — Run: `node --test tests/escalation.test.mjs`. Expected: green.

**Step 4: Commit** — `git commit -m "feat(p04-t01): add deterministic escalation trigger predicates"`

### Task p04-t02: Routing table + genuinely-stuck promotion

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`
- Modify: `tests/escalation.test.mjs`

**Step 1: Write test (RED)** — full trigger × agency truth table from design §5; promotion: trigger re-fires after a HOST_DECISION for the same trigger → `decide_via: user` + `promoted_from: 'host'`; `defer_to_user` decision round → re-emitted escalation routed to user; maximum `budget_exhausted` keeps auto declare-done (recorded as auto-resolved escalation).

**Step 2: Implement (GREEN)** — `routeEscalation(trigger, agency, records)` pure function.

**Step 3: Verify** — Run: `node --test tests/escalation.test.mjs`. Expected: truth table + promotion green.

**Step 4: Commit** — `git commit -m "feat(p04-t02): add agency routing with genuinely-stuck promotion"`

### Task p04-t03: Escalation terminal status + decision packet

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`
- Modify: `tests/escalation.test.mjs`

**Step 1: Write test (RED)** — loop terminates with `status: 'escalation'`; packet carries trigger, decide_via, decision_kinds (incl. `defer_to_user` only when host-routed), divergent hash references, promoted_from when applicable; minimal-agency rows preserve v0.1 statuses (oscillation/max-rounds surface unchanged).

**Step 2: Implement (GREEN)** — wire `detectEscalation` + `routeEscalation` into the loop after convergence/oscillation checks; status extras per design data model.

**Step 3: Verify** — Run: `node --test tests/escalation.test.mjs && npm test`. Expected: green; alternating regression intact.

**Step 4: Commit** — `git commit -m "feat(p04-t03): emit escalation terminal status with decision packet"`

### Task p04-t04: escalation_required JSONL event

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`
- Modify: `tests/sequential-wrapper.test.mjs`

**Step 1: Write test (RED)** — wrapper resolves divergent full text into the event (both revisions; synthesis + disagreements when present) with `resume: { artifact_path, flag }`; event emitted before run end; run exit code remains success-with-partial semantics (consistent with impasse).

**Step 2: Implement (GREEN)** — event assembly from loop status + records.

**Step 3: Verify** — Run: `node --test tests/sequential-wrapper.test.mjs`. Expected: green.

**Step 4: Commit** — `git commit -m "feat(p04-t04): emit escalation_required with resolved decision packet"`

### Task p04-t05: --host-direction re-entry + HOST_DECISION rounds

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`, `consensus-loop.mjs`
- Modify: `tests/user-intervention.test.mjs`

**Step 1: Write test (RED)** — `--host-direction` on resume appends `agent: 'host-orchestrator'`, `verdict: 'HOST_DECISION'` with decision_kind + escalation_trigger; refreshes budget like user path; mutually exclusive with `--user-direction` (USAGE); rejected when pending escalation routes to user (`ESCALATION_ROUTING`) or when no escalation pending; `decision_kind: 'defer_to_user'` re-emits user-routed escalation without consuming budget.

**Step 2: Implement (GREEN)** — extend intervention machinery (generalize `appendUserIntervention`); wrapper resume flag plumbing.

**Step 3: Verify** — Run: `node --test tests/user-intervention.test.mjs`. Expected: green.

**Step 4: Commit** — `git commit -m "feat(p04-t05): add --host-direction re-entry with attributed orchestrator rounds"`

### Task p04-t06: Escalation lifecycle integration

**Files:**

- Modify: `tests/parallel-modes.test.mjs`

**Step 1: Write test (RED)** — stubbed synthesized run hits persistent_disagreement at moderate → escalation_required (decide_via host) → resume with --host-direction → converges; promotion case: re-fired trigger after HOST_DECISION routes to user.

**Step 2: Implement (GREEN)** — fixes surfaced by the scenario.

**Step 3: Verify** — Run: `node --test tests/parallel-modes.test.mjs && npm test`. Expected: green.

**Step 4: Commit** — `git commit -m "test(p04-t06): escalation lifecycle integration coverage"`

---

## Phase 5: Resume + parallel-section composition (p05)

**Goal:** Artifact-canonical resume covers the new modes and interruption points; section packets and fan-in compose with parallel modes. (FR7, FR8)

### Task p05-t01: v1 artifact canonical blocks + resume for parallel modes

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`
- Modify: `tests/resume-parse.test.mjs`

**Step 1: Write test (RED)** — artifacts from parallel runs round-trip: canonical blocks include peer pairs, synthesis records, intervention rounds; resume restores mode, agency, synthesizer, per-section state; hash validation covers synthesis hashes.

**Step 2: Implement (GREEN)** — extend canonical block writer/parser + `normalizeResumeRecords` for new record types. **Also flip the artifact-level cutover:** change the 6 wrapper `consensus_schema_version` emitters (frontmatter, resolution block, parallel-manifest check, JSONL) from `'v0'` to `'v1'`, and update the resume version gate (`consensus-refine.mjs` ~1323) to accept `v1` (keep accepting `v0` transitionally — p05-t05 removes it). Migrate the existing v0 resume fixtures (`tests/resume-parse`, `resume-corruption`, `sequential-wrapper`, `user-intervention`, `error-handling`, `parallel-prepare`) to `consensus_schema_version: 'v1'`.

**Step 3: Verify** — Run: `node --test tests/resume-parse.test.mjs && npm test`. Expected: green; resume happy-paths now use v1 artifacts.

**Step 4: Commit** — `git commit -m "feat(p05-t01): cut artifacts over to v1 and resume parallel-mode canonical blocks"`

### Task p05-t02: Interruption-point resume matrix

**Files:**

- Modify: `tests/resume-parse.test.mjs`
- Modify: `tests/parallel-modes.test.mjs`

**Step 1: Write test (RED)** — matrix per design: mid-peer-subround (no pair committed) → round re-executes; pending-synthesis (pair, no synthesis) → resumes at synthesis only; post-synthesis → next round; pending escalation → escalation re-presented, or consumed by a supplied direction flag.

**Step 2: Implement (GREEN)** — resume entry-point dispatch per derived state.

**Step 3: Verify** — Run: `node --test tests/resume-parse.test.mjs tests/parallel-modes.test.mjs`. Expected: matrix green.

**Step 4: Commit** — `git commit -m "feat(p05-t02): implement interruption-point resume matrix for parallel modes"`

### Task p05-t03: Corrupt-section fail-closed regression for v1 records

**Files:**

- Modify: `tests/resume-corruption.test.mjs`

**Step 1: Write test (RED)** — corrupted synthesis record / intervention round / pair-half-missing states are detected; skip controls (`--skip-corrupt-section`, `--skip-all-corrupt`, `--yes-skip-corrupt`) behave as in v0.1.

**Step 2: Implement (GREEN)** — extend corruption validators for new record types (likely covered by p05-t01 parser; fix gaps).

**Step 3: Verify** — Run: `node --test tests/resume-corruption.test.mjs`. Expected: green.

**Step 4: Commit** — `git commit -m "test(p05-t03): corrupt-section coverage for v1 record types"`

### Task p05-t04: Parallel-section packets + fan-in with parallel modes

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`
- Modify: `tests/parallel-prepare.test.mjs`, `tests/parallel-fan-in.test.mjs`, `tests/parallel-integration.test.mjs`

**Step 1: Write test (RED)** — prepare emits `iteration_mode` + `synthesizer` in manifest/packets; fan-in assembles parallel-mode section results in order; a section ending in `escalation` is aggregated (joins impasse accounting) and surfaced in the fan-in summary without blocking other sections.

**Step 2: Implement (GREEN)** — manifest schema + aggregation extensions.

**Step 3: Verify** — Run: `node --test tests/parallel-prepare.test.mjs tests/parallel-fan-in.test.mjs tests/parallel-integration.test.mjs`. Expected: green.

**Step 4: Commit** — `git commit -m "feat(p05-t04): thread mode metadata through parallel-section orchestration"`

### Task p05-t05: Fail-closed v0 artifact resume rejection (moved from p01-t06)

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`
- Modify: `tests/resume-parse.test.mjs`

**Depends on p05-t01** (the wrapper must already emit v1 artifacts and the gate must already accept v1).

**Step 1: Write test (RED)** — resuming an artifact whose `consensus_schema_version` is `v0` fails with code `SCHEMA_VERSION_MISMATCH`, exit `DATA`, and a message naming v0, v1, and the no-migration policy. (A purpose-built v0 fixture; all happy-path resume fixtures are now v1 after p05-t01.)

**Step 2: Implement (GREEN)** — invert the resume version gate (`consensus-refine.mjs` ~1323): remove transitional v0 acceptance so only v1 resumes; v0 → `SCHEMA_VERSION_MISMATCH`.

**Step 3: Verify** — Run: `node --test tests/resume-parse.test.mjs && npm test`. Expected: v0-rejection case green; all v1 resume happy-paths unaffected.

**Step 4: Commit** — `git commit -m "feat(p05-t05): reject v0 artifacts on resume (no migration)"`

---

## Phase 6: Host surface, docs, smoke, dogfood (p06)

**Goal:** Hosts know how to drive the new modes and answer escalations; docs and smoke reflect v0.2; mode comparison dogfooded. (FR3 docs, NFR4, NFR5)

### Task p06-t01: Event payload inventory test (NFR5)

**Files:**

- Create: `tests/event-payload-inventory.test.mjs`

**Step 1: Write test (RED)** — enumerate JSONL events from stubbed runs across all modes: assert no routine event (`run_started`, `run_completed`, `parallel_dispatch_required`) contains revision/synthesis text; `escalation_required` is the only content-bearing event.

**Step 2: Implement (GREEN)** — fix any leaking payloads.

**Step 3: Verify** — Run: `node --test tests/event-payload-inventory.test.mjs`. Expected: green.

**Step 4: Commit** — `git commit -m "test(p06-t01): enforce host-context discipline via event payload inventory"`

### Task p06-t02: SKILL.md — mode selection + escalation handling

**Files:**

- Modify: `plugins/consensus/skills/refine/SKILL.md`
- Modify: `tests/docs-presence.test.mjs`, `tests/host-dispatch-docs.test.mjs` (assertions for new sections)

**Step 1: Write test (RED)** — docs tests assert SKILL.md documents: `--iteration` modes with cost multipliers, `--synthesizer`, escalation_required handling branched on decide_via (host decides + disclose to user vs present options), `--host-direction` re-entry, defer_to_user.

**Step 2: Implement (GREEN)** — author the sections per design §7.

**Step 3: Verify** — Run: `node --test tests/docs-presence.test.mjs tests/host-dispatch-docs.test.mjs`. Expected: green.

**Step 4: Commit** — `git commit -m "docs(p06-t02): document modes and escalation handling in refine SKILL.md"`

### Task p06-t03: Section-runner contract update

**Files:**

- Modify: `plugins/consensus/agents/consensus-section-runner.md`
- Modify: `tests/host-dispatch-docs.test.mjs`

**Step 1: Write test (RED)** — contract documents mode/synthesizer passthrough from packets and "report escalations in section results; never self-decide".

**Step 2: Implement (GREEN)** — author contract changes.

**Step 3: Verify** — Run: `node --test tests/host-dispatch-docs.test.mjs`. Expected: green.

**Step 4: Commit** — `git commit -m "docs(p06-t03): update section-runner contract for parallel modes"`

### Task p06-t04: Plugin + repo README updates

**Files:**

- Modify: `plugins/consensus/README.md`, `README.md`, `CHANGELOG.md`
- Modify: `tests/readme-scope.test.mjs`

**Step 1: Write test (RED)** — readme-scope assertions updated: iteration modes no longer listed as future work; new flags documented; limitations section updated (harmonization/metrics still deferred); CHANGELOG v0.2 entries present.

**Step 2: Implement (GREEN)** — author doc updates consistent with shipped behavior only.

**Step 3: Verify** — Run: `node --test tests/readme-scope.test.mjs tests/docs-presence.test.mjs && npm run validate`. Expected: green.

**Step 4: Commit** — `git commit -m "docs(p06-t04): document v0.2 iteration modes across READMEs and CHANGELOG"`

### Task p06-t05: Smoke-flow extension

**Files:**

- Modify: `scripts/smoke-test.mjs`
- Modify: `tests/smoke-test-script.test.mjs`

**Step 1: Write test (RED)** — smoke covers a mocked parallel-synthesized run including one escalation + `--host-direction` resume to convergence.

**Step 2: Implement (GREEN)** — extend smoke script scenario.

**Step 3: Verify** — Run: `npm run smoke && node --test tests/smoke-test-script.test.mjs`. Expected: green.

**Step 4: Commit** — `git commit -m "test(p06-t05): extend smoke flow with parallel-synthesized escalation scenario"`

### Task p06-t06: Mode-comparison dogfood (manual, NFR4)

**Files:**

- Modify: `.oat/projects/shared/consensus-iteration-modes/implementation.md` (notes)

**Step 1: Prepare** — requires a machine with `paseo` + peer CLIs (laptop). Pick one real multi-section markdown document.

**Step 2: Execute** — run refine three times (alternating, parallel_revision, parallel_synthesized with default synthesizer), same goal and budget.

**Step 3: Review** — verify every round's actor and rationale are attributable from the artifacts alone (NFR4); record escalation frequency observations against the chattiness risk; summarize comparison in implementation.md.

**Step 4: Verify** — Expected: three publishable artifacts; notes recorded.

**Step 5: Commit** — `git commit -m "docs(p06-t06): record mode-comparison dogfood findings"`

---

## Phase 7: Dogfood fixes — live-peer compatibility (p07)

**Goal:** The plugin actually works end-to-end against live peers, including codex (the canonical second model). Surfaced by the p06-t06 dogfood (2026-06-13): the output schemas and verdict model had never run against real paseo, and the default run directory is reused across runs. The project does not ship until codex works as a peer and reruns are isolated. (Closes the live half of NFR4.)

### Task p07-t01: Output-schema provider compatibility (DONE — landed during dogfood)

Already implemented and committed during the dogfood session; recorded here for traceability. paseo's `paseo run --output-schema` builds a provider `response_format` from the schema files, which failed for three reasons our stubbed suite never exercised:

- draft 2020-12 → draft-07 (paseo's default Ajv) — commit `ea45752`.
- `oneOf`/`not` forbidden by OpenAI structured output; removed (the per-verdict conditional is enforced by `validateVerdictShape` branch tables) — commit `fbc9e61`.
- every property must declare `type`; added to all `const`/`enum` properties — commit `f680ad0`.

**Verification:** `npm test` green (513); live codex now passes schema compilation (it failed our own validator next — see p07-t02).

### Task p07-t02: Accept OpenAI/codex strict structured output (verdict normalization)

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`
- Modify: `tests/verdict-validation.test.mjs` (+ records/parallel tests as needed)

**Step 1: Write test (RED)** — a verdict shaped like OpenAI strict output (every property present, optionals empty: e.g. `ACCEPT` with `proposed_artifact: ""` and `concerns: []`; parallel `CONVERGED` with empty `proposed_artifact`) must validate/normalize to the intended verdict rather than being rejected as `additional property`. A genuinely contradictory verdict (e.g. `ACCEPT` with a NON-empty `proposed_artifact`) must still be rejected.

**Step 2: Implement (GREEN)** — normalize the peer verdict before shape validation: for a verdict whose branch table does not permit a field, drop that field when it is empty (`""` / `[]`); leave non-empty disallowed fields to fail validation. Apply in both alternating and parallel paths and to synthesis where analogous. Keep the deterministic engine semantics (normalization is a pure function).

**Step 3: Verify** — `node --test tests/verdict-validation.test.mjs && npm test`. Expected: green; new strict-output cases pass.

**Step 4: Commit** — `git commit -m "fix(p07-t02): normalize strict structured-output verdicts (codex compatibility)"`

### Task p07-t03: Isolate run directories so reruns don't contaminate each other

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`
- Modify: `tests/sequential-wrapper.test.mjs` (or wrapper-options)

**Step 1: Write test (RED)** — two consecutive fresh (non-`--resume`) runs on the same input in the same repo produce identical correct output; the second run does not inherit the first run's per-section records. (Today the default run dir is the constant `.consensus/run`.)

**Step 2: Implement (GREEN)** — give the default run a unique id (timestamp/uuid) so each fresh run gets its own dir, and/or only seed prior records when `--resume` is set. Preserve `--resume` semantics (artifact-canonical state) and `--run-dir` override.

**Step 3: Verify** — `node --test tests/sequential-wrapper.test.mjs && npm test`. Expected: green; rerun-isolation case passes.

**Step 4: Commit** — `git commit -m "fix(p07-t03): isolate consensus run directories per run"`

### Task p07-t04: Live end-to-end verification with claude+codex (closes NFR4)

**Files:**

- Modify: `.oat/projects/shared/consensus-iteration-modes/implementation.md` (record results)
- Modify: `plugins/consensus/skills/refine/references/operator-qa.md` (drop the codex-unavailable workaround note once codex works)

**Step 1** — with paseo + claude + codex available, run `refine` with `--peers claude,codex` across all three iteration modes plus the escalation scenario, cleaning the run dir between runs.

**Step 2** — confirm each converges (or escalates) without `OUTPUT_SCHEMA_FAILED` or validator errors; confirm the artifacts are audit-trail-legible (NFR4); confirm the `--host-direction` escalation flow records a `HOST_DECISION` round.

**Step 3** — record the mode-comparison findings in implementation.md (closes p06-t06) and update operator-qa.md.

**Step 4: Commit** — `git commit -m "docs(p07-t04): record live claude+codex dogfood; close NFR4"`

### Task p07-t05: (review) Persist HOST_DECISION routing metadata in the canonical artifact block (DONE — 9ba63d6)

**Files:**

- Modify: `plugins/consensus/skills/refine/scripts/consensus-refine.mjs` (`renderRecord`)
- Modify: `tests/resume-parse.test.mjs` (or `tests/escalation.test.mjs`)

**Step 1: Understand the issue**

Final-review Critical (Codex, 2026-06-13). `renderRecord` builds the canonical `consensus-verdict` block from only `schema_version/verdict/reasoning/(user_direction)/(critique)/(proposed_artifact)/(concerns)`, so a `HOST_DECISION` record loses `decision_kind` and `escalation_trigger` when written to the artifact. `priorHostDecisionForTrigger` matches on `record.escalation_trigger === trigger`, so a twice-resumed artifact can no longer detect a prior host decision → genuinely-stuck promotion (repeat-fire / `defer_to_user` → user) can fail and route back to host. FR5 is not restart-safe. Location: `consensus-refine.mjs:1066`, loop seam `consensus-loop.mjs:2398`.

**Step 2: Implement fix**

In `renderRecord`, when the record is a `HOST_DECISION` (or any intervention round), persist `decision_kind` and `escalation_trigger` into the canonical block (mirror the existing `user_direction` handling). Preserving `agent`/`iteration_mode` too makes the parsed record less inference-dependent. Ensure `parseDeliberationArtifactForResume`/`normalizeResumeRecords` round-trips these fields.

**Step 3: Verify**

Render a `HOST_DECISION` artifact → parse via the resume parser → assert the parsed record still carries `decision_kind` + `escalation_trigger`, and that a repeat-fire of the same trigger after that parsed resume routes to `user` (promotion). Run: `node --test tests/resume-parse.test.mjs tests/escalation.test.mjs && npm test`.

**Step 4: Commit** — `git commit -m "fix(p07-t05): persist HOST_DECISION routing metadata for restart-safe promotion"`

---

## Reviews

| Scope  | Type     | Status          | Date       | Artifact                                              |
| ------ | -------- | --------------- | ---------- | ----------------------------------------------------- |
| p01    | code     | passed          | 2026-06-13 | inline review (fable orchestrator; 0 crit/0 imp)       |
| p02    | code     | passed          | 2026-06-13 | inline review (fable); 1 imp fixed (test-output leak)  |
| p03    | code     | passed          | 2026-06-13 | inline review (fable); 0 findings                      |
| p04    | code     | passed          | 2026-06-13 | inline review (fable); 0 findings                      |
| p05    | code     | passed          | 2026-06-13 | inline review (fable); 0 findings (incl. moved p05-t05)|
| p06    | code     | passed          | 2026-06-13 | inline review (fable); 0 findings (t06 dogfood deferred)|
| p07    | code     | fixes_completed | 2026-06-13 | live dogfood: all modes + codex verified; see implementation.md |
| final  | code     | received        | 2026-06-13 | reviews/final-review-2026-06-13.md                  |
| spec   | artifact | pending         | -          | -                                                      |
| design | artifact | fixes_completed | 2026-06-12 | reviews/archived/artifact-design-review-2026-06-12.md |
| plan   | artifact | received        | 2026-06-13 | reviews/artifact-plan-review-2026-06-13.md              |

**Status values:** `pending` → `received` → `fixes_added` → `fixes_completed` → `passed`

## Implementation Complete

- Phase 1: v1 schema family + validation substrate — 5 tasks (p01-t06 resequenced to p05-t05)
- Phase 2: Round executor + parallel-revision mode — 8 tasks
- Phase 3: Parallel-synthesized mode — 6 tasks
- Phase 4: Escalation ladder — 6 tasks
- Phase 5: Resume + parallel-section composition — 5 tasks (+p05-t05 from p01-t06)
- Phase 6: Host surface, docs, smoke, dogfood — 6 tasks
- Phase 7: Dogfood fixes — live-peer compatibility — 5 tasks (codex schema compat [done], verdict normalization, run-dir isolation, live verification, + p07-t05 final-review fix)

**Total: 41 tasks**

## References

- Spec: `spec.md` (Requirement Index maps FRs/NFRs → tasks)
- Design: `design.md` (components, data models, escalation routing, transaction contract)
- Discovery: `discovery.md`
- Architecture: `.oat/repo/reference/research/consensus/architecture-v3.md`
- Engine source: `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`, `consensus-refine.mjs`
