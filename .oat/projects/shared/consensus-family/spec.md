---
oat_status: complete
oat_ready_for: oat-project-design
oat_blockers: []
oat_last_updated: 2026-06-21
oat_generated: false
oat_template: false
---

# Specification: consensus-family

## Phase Guardrails (Specification)

Specification is for requirements and acceptance criteria, not design/implementation details.

- Avoid concrete deliverables (specific scripts, file paths, function names).
- Keep the "High-Level Design" section to architecture shape and component boundaries only.
- If a design detail comes up, record it under **Open Questions** for `oat-project-design`.

## Problem Statement

The shipped consensus plugin offers two-peer deliberation only over an **existing** artifact: `refine` (converge a draft) and `evaluate` (assess against a rubric). Both rely on the `shared_input` cold-start — in round 1 every peer sees the same starting artifact. There is no supported way to deliberate when **no artifact exists yet** and the goal is to *produce* one from a brief.

Architecture-v3 defines a second cold-start strategy, `independent_draft` (round 1, each peer drafts its own output from the brief with no shared seed), as an axis independent of iteration mode (3 modes × 2 cold-starts = 6 configs). It is specified but **not implemented**: the loop's `ColdStartMode` type is closed to `shared_input` and the value is hard-rejected at the loop parser and both wrappers. Because `independent_draft` has no observable behavior without a consumer, it must be co-designed with its first consumer.

This project delivers the **consensus skill family for creation tasks**: it implements `independent_draft` in the loop core (the gate), then adds three new wrapper skills that consume it — `consensus-create` (produce an artifact from a brief; carries the design weight), `consensus-decide` (converge on a decision), and `consensus-plan` (produce a plan). The new wrappers default to `independent_draft` + `parallel_synthesized`, which now rides the hardened, settled verdict-submission seam (DR-024) for reliability.

`consensus-research` (bl-645c) is a separate project (it uses `shared_input` and carries an unrelated peer tool-access decision) and is out of scope here.

## Goals

### Primary Goals

- Implement `independent_draft` as a first-class cold-start in the loop core, working across all three iteration modes, with the chosen cold-start recorded in the resolution block.
- Ship `consensus-create` as the design-carrying first consumer (brief → artifact), defaulting to `independent_draft` / `parallel_synthesized` / maximum agency, whole-artifact sectioning.
- Ship `consensus-decide` and `consensus-plan` as thin wrappers on the same core with their own defaults and structured-markdown output contracts.
- Cover `independent_draft` with loop-level tests independent of any one skill.

### Secondary Goals

- Keep the new wrappers thin: configuration + prompt framing over the shared loop core, reusing existing mode-driven schemas and the settled verdict-submission seam rather than introducing new machinery.

## Non-Goals

- `consensus-research` (bl-645c) — separate project (`shared_input`, unrelated peer tool-access DR).
- Outline-first / derived-section *structure* for created artifacts — deferred; v1 is whole-artifact. (Pulls in bl-e39a harmonization / bl-db5d auto-chunking when revisited.)
- Machine-readable (non-markdown) decision/plan output schemas — deferred unless a real consumer needs them.
- A hard `require_submission` verdict contract — deferred bl-3a88 follow-up; v1 relies on the shipped prefer-submit + parse-fallback default.
- bl-e0e7 (shared generated runtime output) — must not run concurrently with this project; not changed here.

## Requirements

### Functional Requirements

**FR1: `independent_draft` cold-start in the loop core**

- **Description:** The loop core must support `independent_draft` as a cold-start strategy alongside `shared_input`. In round 1 under `independent_draft`, each peer produces its own output from the brief with no shared starting artifact; subsequent rounds proceed per the active iteration mode.
- **Acceptance Criteria:**
  - The **loop-core** cold-start type/parser accepts both `shared_input` and `independent_draft` (the previous loop-core hard rejection is replaced with validation accepting both).
  - The **new** wrappers (create/decide/plan) accept both values; **`refine`/`evaluate` keep a deliberate `shared_input`-only guard** — they reject `independent_draft` with a clear "this skill supports `shared_input` only" message (it is semantically meaningless for them: evaluate has no artifact to evaluate, and refine would discard its input draft).
  - Under `independent_draft`, round-1 peer prompts frame the **brief** as the context ("produce your own draft from this brief"), not a shared artifact to revise.
  - Behaves coherently in all three iteration modes (see FR2).
  - `shared_input` behavior is unchanged (refine/evaluate keep their current default and output).
- **Priority:** P0

**FR2: `independent_draft` across all three iteration modes**

- **Description:** `independent_draft` must be well-defined in alternating, parallel_revision, and parallel_synthesized modes.
- **Acceptance Criteria:**
  - **parallel_revision / parallel_synthesized:** round 1, each peer drafts independently from the brief; synthesized mode then merges the two independent drafts via the existing synthesis step; revision mode feeds both drafts forward.
  - **alternating (degenerate, non-default):** round 1, peer A drafts from the brief; peer B revises A's draft. Documented explicitly as a non-default path.
  - Loop-level tests assert the round-1 prompt shape and a round-1→convergence run for each mode.
- **Priority:** P0

**FR3: Cold-start is recorded and configurable**

- **Description:** The chosen cold-start is recorded in the resolution block and is configurable via a `--cold-start shared_input | independent_draft` option; each new skill sets its own default.
- **Acceptance Criteria:**
  - The resolution block records the effective `cold_start` value (`independent_draft` for the new skills by default).
  - `--cold-start` overrides the default and is validated.
  - create/decide/plan default to `independent_draft`; refine/evaluate keep `shared_input` (and reject `independent_draft` per FR1's per-skill guard).
- **Priority:** P0

**FR4: `consensus-create` skill**

- **Description:** A shipped wrapper skill that produces a new artifact from a brief via two-peer deliberation.
- **Acceptance Criteria:**
  - Accepts a brief (inline and file forms) and an optional template; output is the created artifact plus a deliberation log and resolution block.
  - Defaults: `independent_draft` / `parallel_synthesized` / maximum agency; **whole-artifact** sectioning (the brief is the single unit; no outline-derivation pre-phase).
  - Ships the full wrapper anatomy: SKILL.md (with matching `version`/`metadata.version`), canonical TS source, schemas (reused mode-driven schemas), references/examples, manifest + README entries, and tests; generated `.mjs` produced via the build.
- **Priority:** P0

**FR5: `consensus-decide` skill (thin wrapper)**

- **Description:** A thin wrapper that deliberates over options and converges on a decision document.
- **Acceptance Criteria:**
  - Defaults: `independent_draft` / `parallel_synthesized` / **minimal** agency.
  - Output is a structured **markdown** decision document with required headings: recommendation, reasoning, alternatives, dissent / unresolved disagreement — plus the resolution block. Headings enforced via prompt/template framing (no new machine schema).
  - At minimal agency, unresolved disagreements **always surface to the user** rather than being editorially decided by the orchestrator — even though synthesized mode would otherwise auto-resolve.
  - Ships full wrapper anatomy + tests as in FR4.
- **Priority:** P1 (in-scope this project; sequenced after the P0 core lands, as its own PR)

**FR6: `consensus-plan` skill (thin wrapper)**

- **Description:** A thin wrapper that produces a structured plan from a goal and constraints.
- **Acceptance Criteria:**
  - Defaults: `independent_draft` / `parallel_synthesized` / **moderate** agency.
  - Output is a structured markdown plan with required headings (steps, dependencies, risks) plus the resolution block; headings via prompt/template framing.
  - Ships full wrapper anatomy + tests as in FR4.
- **Priority:** P1 (in-scope this project; sequenced after the P0 core lands, as its own PR)

### Non-Functional Requirements

**NFR1: Shipped skills stay dependency-free / install-free**

- **Description:** New runtime code uses Node standard library only; the provider CLI subprocess is the only external execution boundary.
- **Acceptance Criteria:** no runtime dependencies added to shipped skills; runs with no install step.
- **Priority:** P0

**NFR2: Build & version discipline**

- **Description:** Canonical TypeScript under `src/consensus/`; committed `.mjs` is generated, never hand-edited; skill versions bump on change.
- **Acceptance Criteria:** `pnpm run build:check` clean; each new skill's `version` and `metadata.version` match and are listed in the version-bump tooling; the skill-version-on-edit validator passes.
- **Priority:** P0

**NFR3: Reliability via the settled verdict-submission seam (DR-024)**

- **Description:** `parallel_synthesized` family runs reuse the shipped verdict-submission seam rather than reopening it.
- **Acceptance Criteria:** peers/synthesizer reuse the mode-driven `verdict-parallel` and `synthesis` schemas and the shared subset validator; the audit trail distinguishes submitted vs parse-fallback verdicts; the default Codex posture for synthesized mode is `workspace-write`; the family enforces the `verdict` enum itself where correctness depends on it (the subset validator does not).
- **Priority:** P0

**NFR4: Untrusted input handling**

- **Description:** Brief / options / constraints are treated as untrusted content.
- **Acceptance Criteria:** the new round-1 prompts frame these inputs as untrusted data; the existing input read cap (1 MiB) and path-confinement helpers apply.
- **Priority:** P0

**NFR5: Repository quality gates pass**

- **Description:** The full gate set passes at completion.
- **Acceptance Criteria:** `pnpm run build:check`, `pnpm run type-check`, `pnpm run test`, `pnpm run validate`, `pnpm run smoke` all green.
- **Priority:** P0

## Constraints

- Node >= 22, ESM, standard-library-only in shipped runtime output.
- Edit canonical TS under `src/consensus/`; regenerate `.mjs` via `pnpm run build`; never hand-edit `// GENERATED` outputs.
- New skills must be added to the release version-bump tooling's skill list; `version` and `metadata.version` must stay in sync.
- bl-e0e7 (shared generated runtime output) must not run concurrently — it changes how the loop's `.mjs` is emitted.
- Documentation target depends on whether the docs site (bl-ecaa) has landed by completion (site via `oat-project-document`, else the README).

## Dependencies

- **Loop core** (`src/consensus/core/`) — the deliberation engine the new cold-start and all wrappers build on.
- **Verdict-submission seam (DR-024, bl-3a88, shipped/archived)** — provides reliable per-turn verdict capture (env-var seam + run-bound sidecar + parse-fallback) and the mode-driven `verdict-parallel` / `synthesis` schemas + shared subset validator. Settled; disjoint from the loop core; not reopened.
- **Shipped wrapper templates** (`refine`, `evaluate`) — the anatomy each new wrapper replicates.
- **Provider CLIs** (Claude / Codex / Cursor) via subprocess — the only external execution boundary.

## High-Level Design (Proposed)

Implement `independent_draft` once in the **loop core** as a cold-start strategy that changes only round-1 seeding and round-1 prompt framing: instead of seeding both peers from one shared artifact, round 1 frames the brief and asks each peer to draft its own output. From round 2 on, the active iteration mode is unchanged. The chosen cold-start threads through the existing options into the prompt builders (which currently do not receive it) and is recorded in the already-present `cold_start` resolution field.

On top of that primitive, add three **wrapper skills** that mirror the shipped `refine`/`evaluate` anatomy. Each is thin: option parsing for its input shape (brief / options / goal+constraints), its own defaults, and prompt/template framing that shapes the output (free-form artifact for create; required-heading markdown for decide/plan). They reuse the shared loop core, the mode-driven verdict/synthesis schemas, the subset validator, the input cap, and path confinement. `parallel_synthesized` reliability rides the settled DR-024 submission seam.

**Key Components:**

- **Loop-core cold-start** — round-1 seeding + prompt framing for `independent_draft`; cold-start threaded to prompt builders; recorded in the resolution block.
- **consensus-create wrapper** — brief → artifact; maximum agency; whole-artifact.
- **consensus-decide wrapper** — options → markdown decision doc; minimal agency; always surfaces dissent.
- **consensus-plan wrapper** — goal+constraints → markdown plan; moderate agency.
- **Test surface** — loop-level cold-start tests (skill-independent) + per-wrapper tests.

**Alternatives Considered:**

- **Outline-first sectioning for create** — rejected for v1 (new pre-phase machinery; pulls in harmonization/auto-chunking); deferred.
- **Per-skill machine output schemas for decide/plan** — rejected for v1 (thicker wrappers); markdown-by-prompt instead.
- **Restrict `independent_draft` to parallel modes** — rejected (contradicts the bl-2ed7 AC); degenerate alternating semantics adopted instead.
- **Reopen MCP vs submit-CLI for verdicts** — rejected; DR-024 is settled.

_Design-related open questions are tracked in the [Open Questions](#open-questions) section below._

## Success Metrics

- `independent_draft` runs to convergence in all three modes under loop-level tests; `shared_input` regression-free.
- Three new skills discoverable and runnable with their v3 defaults; deliberation logs include a resolution block recording the cold-start.
- decide surfaces unresolved disagreements at minimal agency (verified by test/fixture).
- All five repository gates pass; generated output in sync.

## Requirement Index

| ID   | Description                                                       | Priority | Verification                              | Planned Tasks                      |
| ---- | ---------------------------------------------------------------- | -------- | ----------------------------------------- | ---------------------------------- |
| FR1  | `independent_draft` cold-start supported in loop core            | P0       | unit + integration: loop cold-start path  | {To be filled by oat-project-plan} |
| FR2  | `independent_draft` coherent across all three iteration modes    | P0       | unit + integration: round-1 prompt + run per mode | {To be filled by oat-project-plan} |
| FR3  | Cold-start recorded in resolution block + `--cold-start` config  | P0       | unit: arg parse + resolution recording    | {To be filled by oat-project-plan} |
| FR4  | `consensus-create` skill (brief → artifact)                      | P0       | integration + manual: create end-to-end   | {To be filled by oat-project-plan} |
| FR5  | `consensus-decide` skill (markdown decision doc, surfaces dissent)| P1      | integration: minimal-agency dissent surfacing | {To be filled by oat-project-plan} |
| FR6  | `consensus-plan` skill (markdown plan)                           | P1       | integration: plan end-to-end              | {To be filled by oat-project-plan} |
| NFR1 | Dependency-free / install-free shipped skills                    | P0       | manual + validate: no runtime deps        | {To be filled by oat-project-plan} |
| NFR2 | Build & version discipline                                       | P0       | unit: build:check + skill-version validators | {To be filled by oat-project-plan} |
| NFR3 | Reliability via settled DR-024 verdict-submission seam           | P0       | integration: verdict_source + enum enforcement | {To be filled by oat-project-plan} |
| NFR4 | Untrusted input handling (cap + confinement + framing)           | P0       | unit: input cap + path confinement        | {To be filled by oat-project-plan} |
| NFR5 | Repository quality gates pass                                    | P0       | e2e: full gate set                        | {To be filled by oat-project-plan} |

**Notes:**

- ID: Unique requirement identifier (FR# for functional, NFR# for non-functional)
- Priority: P0 (must have) / P1 (should have) / P2 (nice to have)
- Verification: `method: pointer` — method is unit / integration / e2e / manual / perf
- **Sequencing:** FR5/FR6 are P1 not because they are optional to the project — all four backlog items ship here — but to encode the dependency order: the P0 core (FR1–FR4: the `independent_draft` gate + `consensus-create`) lands first; `consensus-decide`/`consensus-plan` follow as thin wrappers in their own PRs once the core is proven. If scope must flex, the core still ships.

## Open Questions

- **cold_start recording scope:** resolution block only (already plumbed) vs also recording at the core per-section/terminal-artifact level — decide in design.
- **Required-headings enforcement (decide/plan):** prompt/template framing for v1; programmatic validation only if a real consumer needs it.
- **Schema reuse confirmation:** confirm `verdict-parallel` / `synthesis` schemas are skill-agnostic and need no per-skill variant (design corroboration).

## Assumptions

- The DR-024 verdict-submission seam is the stable basis for `parallel_synthesized` reliability (shipped/archived).
- Mode-driven verdict/synthesis schemas are reusable across create/decide/plan without per-skill schema changes (to confirm in design).
- The loop core's round-2+ behavior needs no change under `independent_draft` — only round-1 seeding/framing differs.

## Risks

- **Alternating-mode semantics:** decided (degenerate A-drafts/B-revises) but awkward/non-default; risk of user surprise.
  - **Likelihood:** Medium · **Impact:** Medium · **Mitigation:** specify precisely in design; per-mode loop tests; document as non-default.
- **Peer doesn't call submit:** `parallel_synthesized` falls back to fragile final-message parse (no hard contract in v1).
  - **Likelihood:** Medium · **Impact:** Medium · **Mitigation:** rely on shipped prefer-submit default + strong prompt framing; record `verdict_source`; treat hard `require_submission` as a known scoped follow-up.
- **Generated-output drift / version-bump misses:** breaks gates.
  - **Likelihood:** Low · **Impact:** Medium · **Mitigation:** edit TS only; run build + build:check; add new skills to version-bump tooling.

## References

- Discovery: `discovery.md`
- Architecture: `.oat/repo/reference/research/consensus/architecture-v3.md`
- Decision record: `.oat/repo/reference/decision-record.md` (DR-024)
- Knowledge Base: `.oat/repo/knowledge/project-index.md`
