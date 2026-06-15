---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-15
oat_generated: false
oat_template: false
---

# Design: consensus-evaluate

## Overview

`consensus-evaluate` is a new sibling skill to `consensus-refine` in the consensus plugin.
Two AI peers judge an artifact against a rubric/spec and deliberate to a unified evaluation,
with per-peer reasoning and any dissent preserved in the deliberation log. It is a **thin
wrapper** over the existing `consensus-loop` deliberation engine — it reuses the engine and
the `parallel_revision` verdict schema rather than reimplementing deliberation.

The single genuine design tension is that the deliberation engine currently bakes refine's
"revise the section, put the result in `proposed_artifact`" wording into its prompts, while
evaluation needs peers to produce a *judgment about* the artifact, not an *edit of* it. We
resolve this with a **narrow prompt-profile seam**: `runConsensusLoop` accepts optional
prompt builders in `runOptions`, defaulting to the engine's existing builders so refine stays
byte-for-byte behavior-identical. `consensus-evaluate` injects evaluation-framed builders that
render the artifact and rubric as untrusted-content blocks and converge on an evaluation
document carried in `proposed_artifact`.

Because the seam requires the engine to be reused by two skills, the engine and its schemas
are promoted to a canonical `shared/consensus-core/`, with **generated, byte-identical
committed copies** in each consumer skill, a `sync:consensus-core` npm script, and a
drift-guard test — mirroring the established `shared/transcript-core/` precedent. The
evaluation output is **free-form markdown** seeded from a lightly structured, rubric-derived
template; per-peer reasoning and dissent remain in the deliberation log as the source of
truth. No new verdict schema or JSON contract is introduced.

## Architecture

### System Context

The consensus plugin ships a shared deliberation engine (`consensus-loop.mjs`) plus skills
that wrap it for specific jobs. Today the engine lives only inside `refine/`. This project
relocates the engine to a canonical shared home and adds a second consumer (`evaluate/`),
establishing the engine as a true shared primitive.

**Key Components:**

- **`shared/consensus-core/` (new canonical engine):** the single source of truth for
  `consensus-loop.mjs` and its `schemas/` (`verdict-parallel`, `verdict-alternating`,
  `synthesis`). Plus a `promptProfile` seam added to `runConsensusLoop`.
- **`scripts/sync-consensus-core.mjs` (new):** materializes byte-identical committed copies
  of the engine + schemas into each consumer; `--check` mode powers the drift guard.
- **`refine/` (existing, behavior-preserved):** its `scripts/consensus-loop.mjs` and
  `schemas/` become generated copies of canonical. `consensus-refine.mjs` is untouched and
  passes no prompt profile, so engine defaults apply.
- **`evaluate/` (new skill):** `consensus-evaluate.mjs` wrapper + generated engine copy +
  generated schema copies + `SKILL.md` + plugin/skill manifests.
- **Drift guard test (new):** fails `npm test` if any generated engine/schema copy diverges
  from canonical (same pattern as `tests/transcript-core/sync.test.mjs`).

### Component Diagram

```
                 shared/consensus-core/   (CANONICAL)
                 ├── consensus-loop.mjs   (+ promptProfile seam)
                 └── schemas/*.json
                          │  sync-consensus-core.mjs  (generate / --check)
            ┌─────────────┴──────────────┐
            ▼                             ▼
 refine/scripts/consensus-loop.mjs   evaluate/scripts/consensus-loop.mjs   (GENERATED copies)
 refine/schemas/*.json               evaluate/schemas/*.json               (GENERATED copies)
            │                             │
 consensus-refine.mjs              consensus-evaluate.mjs
 (no promptProfile →               (injects evaluation-framed
  engine defaults)                  promptProfile + reads artifact/rubric)
```

### Data Flow

```
1. Host invokes:  node evaluate/scripts/consensus-evaluate.mjs <artifact> --rubric <path> [flags]
2. Wrapper reads artifact + rubric; resolves v3 defaults
   (shared_input / parallel_revision / minimal), all overridable.
3. Wrapper seeds initialArtifact = rubric-derived markdown evaluation template
   (criterion headers + verdict/findings/overall scaffold).
4. Wrapper builds closures capturing artifact + rubric → promptProfile builders that:
     - frame artifact-under-evaluation and rubric as untrusted-content blocks
     - present the converging evaluation doc as the "artifact"/own+peer previous revisions
     - instruct peers to produce/revise an EVALUATION (not edit the artifact),
       emitting a verdict-parallel verdict whose proposed_artifact carries the eval doc.
5. Wrapper calls runConsensusLoop(argv, { invokePeer, promptProfile, initialArtifact, ... }).
6. Engine runs parallel_revision rounds; each record captures
   agent / verdict / reasoning / critique / proposed_artifact  → the deliberation log.
7. After the loop, wrapper assembles the final evaluation markdown:
     - CONVERGED → converged eval as unified findings + short Dissent section if residual.
     - IMPASSE / escalation (minimal-agency path) → agreed portions as unified findings
       + explicit "Unresolved dissent" section enumerating each peer's position + reasoning.
8. Wrapper writes evaluation doc (--output or stdout) and emits coordination JSON to stdout,
   same as refine.
```

## Component Design

### Engine seam — `runConsensusLoop` prompt profile

**Purpose:** let a consumer override how peer/synthesis prompts are built without forking the
engine, while keeping refine behavior-identical.

**Responsibilities:**

- Accept `runOptions.promptProfile = { buildTurnPrompt?, buildParallelTurnPrompt?,
  buildSynthesisPrompt? }`, each optional.
- At entry, resolve each builder as `profile.X ?? <existing module builder>` and thread the
  resolved builders through the round context (e.g. `context.prompts`).
- `executeParallelRound` / `executeAlternatingTurn` / `executeSynthesis` call
  `context.prompts.buildX(...)` instead of importing the builder directly.

**Interfaces:**

```js
// builder signatures are UNCHANGED from today's exported functions
runConsensusLoop(argv, {
  invokePeer,            // existing injection hook (used by tests)
  invokeSynthesizer,     // existing
  initialArtifact,       // existing
  initialRecords,        // existing
  promptProfile,         // NEW, optional: { buildTurnPrompt?, buildParallelTurnPrompt?, buildSynthesisPrompt? }
  // ...other existing runOptions
})
```

**Design Decisions:**

- Default-preserving: refine passes no `promptProfile` → every builder resolves to the
  existing module function → byte-identical behavior. Verified by re-running refine's full
  suite + the drift guard.
- Seam is the **only** change to the canonical engine. No rubric knowledge enters the engine.

### `consensus-evaluate.mjs` (wrapper)

**Purpose:** the thin skill entry point. Parse flags, read inputs, inject evaluation
semantics, drive a single consensus loop, assemble the final evaluation document.

**Responsibilities:**

- Parse `<artifact>` positional + `--rubric <path>` (required) and standard flags.
- Apply v3 defaults, all overridable: `--cold-start shared_input`, `--iteration
  parallel_revision`, `--agency minimal`; plus `--peers`, `--max-rounds`, `--output`,
  `--synthesizer`.
- Reject `--cold-start independent_draft` with a clear message (consistent with refine).
- Read artifact + rubric; seed `initialArtifact` with a rubric-derived markdown template.
- Build evaluation-framed prompt closures and pass them as `promptProfile`.
- After the loop, render the final evaluation markdown (unified findings + dissent /
  unresolved-dissent), write to `--output` or stdout, and emit coordination JSON to stdout.

**Dependencies:**

- Internal: generated `evaluate/scripts/consensus-loop.mjs` (canonical engine copy),
  generated `evaluate/schemas/verdict-parallel.schema.json`.
- External: none (Node stdlib only; Paseo only via injected `invokePeer` at runtime).

**Design Decisions:**

- Single-loop run (no synthesized multi-loop orchestration), so the wrapper is materially
  thinner than `consensus-refine.mjs`.
- Untrusted-content framing for both artifact and rubric — the safety reason goal-encoding was
  rejected.

### Output & deliberation-log state contract

**Purpose:** make explicit how loop state becomes the final evaluation artifact, so the
"per-peer reasoning and dissent preserved in the deliberation log" acceptance criterion is
verifiable rather than implied.

**Loop state files:** the shared engine *requires* `--output-records`, `--output-section`,
and `--output-status` (see `consensus-loop.mjs` arg validation). `consensus-evaluate.mjs`
therefore allocates a run directory and passes all three, exactly as `consensus-refine.mjs`
does:

- `--output-records` → newline-delimited JSON records, one per peer turn (the raw
  deliberation log: `agent`, `verdict`, `reasoning`, `critique`, `proposed_artifact`).
- `--output-section` → the converged/last evaluation document (the unified findings body).
- `--output-status` → terminal status (`CONVERGED` / `IMPASSE` / escalation) + round count.

**Rendering contract:** the final evaluation artifact is **not** a prose summary alone. The
wrapper renders each record into a canonical per-record block — the same `renderRecord`
pattern refine uses to emit `consensus-verdict` JSON fences — so per-peer reasoning and the
verbatim verdict survive in the artifact. The final document is therefore:

1. **Unified findings** — the converged (or last-agreed) evaluation document from
   `--output-section`.
2. **Deliberation log** — the canonical per-record `consensus-verdict` blocks rendered from
   `--output-records`, preserving each peer's reasoning/critique verbatim.
3. **Dissent surface** — derived from the records + status:
   - **CONVERGED:** a short `## Dissent` section listing any residual concerns from the final
     records; empty/omitted when peers fully agreed.
   - **IMPASSE / escalation (minimal-agency path):** an explicit `## Unresolved dissent`
     section enumerating each peer's final position + reasoning, surfaced not editorialized.

**Design Decisions:**

- "Dissent preserved in the deliberation log" concretely means the canonical records are
  embedded in the artifact, not merely summarized. Tests assert the presence of the canonical
  per-record blocks (peer reasoning + verdict), not just the rendered summary text.
- The wrapper reuses refine's record-rendering approach rather than inventing a new format, so
  the deliberation log is consistent across the family.

### Documentation & family status

**Purpose:** satisfy the backlog AC "Plugin manifests, SKILL.md, and READMEs updated; family
skill listed as shipped" — the part of the shipped-skill contract that lives outside the
runtime code.

**Responsibilities:**

- **Skill surface:** `evaluate/SKILL.md` (frontmatter, allowed-tools, docs).
- **Provider manifests:** register the skill in `plugins/consensus/.claude-plugin/`,
  `.codex-plugin/`, and `.cursor-plugin/` plugin manifests as appropriate.
- **READMEs / family status:** update root `README.md` and `plugins/consensus/README.md` to
  list `consensus-evaluate` as **shipped**, removing/rewriting the current "deferred"
  references (`README.md:129`, `plugins/consensus/README.md:139`).
- **Repo reference:** reflect shipped status in `current-state.md`, `roadmap.md`, and the
  bl-5174 backlog item.

**Design Decisions:**

- This is a first-class design responsibility, not incidental cleanup — `npm run validate`
  enforces manifest/docs invariants, so missing it fails the build.

### `sync-consensus-core.mjs` + drift guard

**Purpose:** keep every generated engine/schema copy byte-identical to canonical; fail CI on
drift.

**Responsibilities:**

- Generate: write `<banner>\n\n<canonical contents>` for `consensus-loop.mjs` and copy each
  schema JSON into every consumer's `schemas/` dir.
- `--check`: compare on-disk copies to expected; exit non-zero on any divergence.
- Add `sync:consensus-core` to `package.json` scripts; mirror the transcript-core wiring.

**Design Decisions:**

- Sync unit = **engine + the schema JSONs it references**, because schema paths resolve
  module-relative (`new URL('../schemas/...', import.meta.url)`); each consumer therefore
  needs its own `schemas/` copy.
- Generated copies carry the `// GENERATED` banner and are added to the oxfmt/oxlint
  exclusion lists in all three places that must stay in sync (`.oxfmtrc.json`,
  `.lintstagedrc.mjs`, CI `oxfmt --check`).

## Testing Strategy

All peer calls are mocked via the injected `invokePeer` hook (the same hook refine's tests
use) — no live Paseo. Tests run under `node --test` (`npm test`).

### Key Test Levels and Scenarios

| Concern                          | Verification | Key Scenarios                                                                                                   |
| -------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------- |
| Wrapper defaults (AC #2)         | unit         | Asserts `parallel_revision` / `minimal` / `shared_input` applied; each overridable; `independent_draft` rejected |
| Evaluation output contract (AC #1) | unit/integration | Final doc has unified findings; `verdict-parallel` reused unchanged; **canonical per-record `consensus-verdict` blocks (peer reasoning + verdict) are embedded in the artifact**, not just a rendered summary; `proposed_artifact` carries the eval doc |
| Deliberation-log state contract (AC #1) | integration | Wrapper passes `--output-records/-section/-status`; final artifact embeds the deliberation log; dissent surfaced per CONVERGED vs IMPASSE/escalation |
| Impasse under minimal agency (AC #4) | integration | Inject IMPASSE/escalation verdicts → final doc surfaces an "Unresolved dissent" section enumerating positions; status reflects impasse |
| Engine seam (default-preserving) | unit         | `runConsensusLoop` with no `promptProfile` produces identical prompts/behavior to today                          |
| consensus-core drift guard       | unit         | Generated engine + schema copies match canonical (`sync-consensus-core --check`)                                |
| Docs / family status shipped (AC #3) | validate     | `npm run validate` asserts the evaluate skill is registered in manifests/SKILL.md; READMEs list it as shipped, not deferred |
| refine regression                | unit/integration | refine's existing full suite still passes (behavior-identical)                                                  |

### Notes

- `npm run validate` must pass (manifest/structure/docs invariants — evaluate skill must be
  registered as shipped).
- `npm run smoke` (mocked end-to-end consensus wrapper flow) must pass.

## Open Questions

None — both design questions (engine reuse, output contract) were resolved with explicit user
buy-in during discovery.

## References

- Discovery: `discovery.md`
- Backlog item: `.oat/repo/reference/backlog/items/add-consensus-evaluate-skill.md`
- Template skill: `plugins/consensus/skills/refine/`
- Precedent for shared-canonical + drift guard: `shared/transcript-core/`,
  `scripts/sync-transcript-core.mjs`, `tests/transcript-core/sync.test.mjs`
