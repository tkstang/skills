---
oat_status: complete
oat_ready_for: oat-project-plan
oat_blockers: []
oat_last_updated: 2026-06-17
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

PR #13 changed the packaging substrate this design should build on. The engine is now
canonical TypeScript at `src/consensus/core/consensus-loop.ts`, and provider-facing `.mjs`
runtime files under `plugins/` are committed generated outputs maintained by
`scripts/build-generated.mjs`, `pnpm run build`, `pnpm run build:check`, and the Vitest
generated-output guard. `consensus-evaluate` should extend that generated-runtime contract
rather than introduce a parallel `shared/consensus-core/` sync path. The wrapper should also be
TypeScript-first: canonical source at `src/consensus/evaluate/consensus-evaluate.ts`, generated
runtime output at `plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs`. The
evaluation output is **free-form markdown** seeded from a lightly structured, rubric-derived
template; per-peer reasoning and dissent remain in the deliberation log as the source of truth.
No new verdict schema or JSON contract is introduced.

PR #14 has now shipped the consensus/refine TypeScript wrapper migration and settles the
wrapper build/import convention. Evaluate should mirror that exact convention: TypeScript
source imports the loop with the NodeNext-resolvable specifier `../core/consensus-loop.js`,
and `scripts/build-generated.mjs` rewrites that emitted module specifier to the sibling
runtime import `./consensus-loop.mjs` in the generated plugin output. The rewrite is
parser-based and applies only to static imports, export-from declarations, and dynamic import
module specifiers; unrelated string literals are not rewritten.

## Architecture

### System Context

The consensus plugin ships generated runtime `.mjs` files plus TypeScript source under `src/`
for developer-owned logic. After PR #13, the loop source of truth is
`src/consensus/core/consensus-loop.ts`; `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`
is generated distribution output. PR #14 added
`src/consensus/refine/consensus-refine.ts`, generated
`plugins/consensus/skills/refine/scripts/consensus-refine.mjs`, and DR-021's parser-based
`importRewrites` mechanism. This project adds a second wrapper consumer using the same
source/import/build convention, with `src/consensus/evaluate/consensus-evaluate.ts` as
canonical wrapper source and generated runtime output under the evaluate skill's `scripts/`
directory.

**Key Components:**

- **`src/consensus/core/consensus-loop.ts` (existing canonical engine):** the TypeScript
  source of truth. This project adds `promptProfile` to `runConsensusLoop` here, then
  regenerates committed `.mjs` outputs.
- **`scripts/build-generated.mjs` (existing):** extend the generated-output mapping so the
  canonical engine emits both the existing refine runtime copy and the new evaluate runtime
  copy, and so the canonical evaluate wrapper emits its provider-facing runtime copy;
  `--check` remains the drift-guard entry point.
- **`refine/` (existing, behavior-preserved):** its generated
  `scripts/consensus-loop.mjs` remains at the current provider-facing path.
  `consensus-refine.mjs` is untouched and passes no prompt profile, so engine defaults apply.
- **`src/consensus/evaluate/consensus-evaluate.ts` (new canonical wrapper):** typed wrapper
  source that imports typed loop/profile APIs from `../core/consensus-loop.js`, matching the
  PR #14 NodeNext-resolvable source convention.
- **`evaluate/` (new distribution skill):** generated `scripts/consensus-evaluate.mjs`,
  generated `scripts/consensus-loop.mjs`, local schema JSONs needed by module-relative schema
  paths, `SKILL.md`, references, and plugin/skill manifests.
- **Generated-output drift guard (existing, extended):** `tests/generated-output-sync.test.mjs`
  and `pnpm run build:check` fail when committed generated runtime output diverges from
  canonical TypeScript. Schema copies must also have explicit parity/drift coverage.

### Component Diagram

```
src/consensus/core/consensus-loop.ts        src/consensus/evaluate/consensus-evaluate.ts
             │                                           │
             └──────── scripts/build-generated.mjs ──────┘
                         (build / --check)
             │                                           │
             ▼                                           ▼
refine/scripts/consensus-loop.mjs       evaluate/scripts/consensus-evaluate.mjs
evaluate/scripts/consensus-loop.mjs      (generated wrapper runtime)
(generated loop runtimes)
             │                                           │
refine/schemas/*.json                    evaluate/schemas/*.json
                                          SKILL.md / refs / manifests
```

### Data Flow

```
1. Host invokes generated runtime:
   node evaluate/scripts/consensus-evaluate.mjs <artifact> --rubric <path> [flags]
2. Wrapper reads artifact + rubric; resolves v3 defaults
   (shared_input / parallel_revision / minimal), all overridable.
3. Wrapper seeds initialArtifact = rubric-derived markdown evaluation template
   (criterion headers + verdict/findings/overall scaffold).
4. Wrapper builds closures capturing artifact + rubric → promptProfile builders that:
     - frame artifact-under-evaluation and rubric as untrusted-content blocks
     - present the converging evaluation doc as the "artifact"/own+peer previous revisions
     - instruct peers to produce/revise an EVALUATION (not edit the artifact),
       emitting a verdict-parallel verdict whose proposed_artifact carries the eval doc.
5. The generated wrapper imports the local generated loop runtime and calls
   runConsensusLoop(argv, { invokePeer, promptProfile, initialArtifact, ... }).
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

- Export real TypeScript types for `PromptProfile`, prompt builder inputs, `RunOptions`,
  terminal status, loop records, and render inputs that wrappers consume.
- Accept `runOptions.promptProfile = { buildTurnPrompt?, buildParallelTurnPrompt?,
  buildSynthesisPrompt? }`, each optional.
- At entry, resolve each builder as `profile.X ?? <existing module builder>` and thread the
  resolved builders through the round context (e.g. `context.prompts`).
- `executeParallelRound` / `executeAlternatingTurn` / `executeSynthesis` call
  `context.prompts.buildX(...)` instead of importing the builder directly.

**Interfaces:**

```ts
interface PromptProfile {
  buildTurnPrompt?: typeof buildTurnPrompt;
  buildParallelTurnPrompt?: typeof buildParallelTurnPrompt;
  buildSynthesisPrompt?: typeof buildSynthesisPrompt;
}

interface RunOptions {
  invokePeer?: PeerInvoker;
  invokeSynthesizer?: SynthesizerInvoker;
  initialArtifact?: string;
  initialRecords?: LoopRecord[];
  promptProfile?: PromptProfile;
  // ...other existing runOptions
}
```

**Design Decisions:**

- Default-preserving: refine passes no `promptProfile` → every builder resolves to the
  existing module function → behavior-identical generated runtime. Verified by re-running
  refine's full suite plus `pnpm run type-check`, `pnpm run build:check`, and the generated
  output guard.
- Seam is the **only** change to the canonical engine. No rubric knowledge enters the engine.
- Evaluate should be a forcing function for typed loop APIs, not another implicit object-shape
  consumer. PR #14's refine wrapper derives several loop-facing types from `runConsensusLoop`;
  evaluate may use that pattern, but any new prompt-profile types added here should be exported
  explicitly for future consensus wrappers.

### `src/consensus/evaluate/consensus-evaluate.ts` + generated wrapper runtime

**Purpose:** the thin skill entry point. Parse flags, read inputs, inject evaluation
semantics, drive a single consensus loop, assemble the final evaluation document, and generate
the provider-facing `.mjs` wrapper.

**Responsibilities:**

- Keep canonical wrapper logic in `src/consensus/evaluate/consensus-evaluate.ts`.
- Generate `plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs`; do not hand-edit
  the generated wrapper.
- In TypeScript source, import loop APIs through `../core/consensus-loop.js`; TypeScript
  resolves this to `src/consensus/core/consensus-loop.ts`.
- In generated plugin output, import the co-located local runtime `./consensus-loop.mjs` via the
  parser-based `importRewrites` mechanism shipped in PR #14.
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

- Internal source: `src/consensus/core/consensus-loop.ts` and exported loop/profile types.
- Internal distribution: generated `evaluate/scripts/consensus-loop.mjs` and generated
  `evaluate/scripts/consensus-evaluate.mjs`, plus co-located evaluate schema JSONs matching the
  consensus verdict/synthesis schemas.
- External: none (Node stdlib only; Paseo only via injected `invokePeer` at runtime).

**Design Decisions:**

- Single-loop run (no synthesized multi-loop orchestration), so the wrapper is materially
  thinner than `consensus-refine.mjs`.
- Untrusted-content framing for both artifact and rubric — the safety reason goal-encoding was
  rejected.
- Do not implement a custom import/build rewrite for evaluate. Mirror PR #14 / DR-021 directly:
  configure `importRewrites: [{ from: '../core/consensus-loop.js', to: './consensus-loop.mjs' }]`
  on the evaluate wrapper mapping and rely on the shipped parser-based rewrite helper.

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

### Generated-runtime build mapping + drift guard

**Purpose:** keep committed runtime output in sync with canonical TypeScript source and make
the new evaluate runtime copy part of the same generated-output contract PR #13 established.

**Responsibilities:**

- Extend `scripts/build-generated.mjs` so `src/consensus/core/consensus-loop.ts` emits:
  - `plugins/consensus/skills/refine/scripts/consensus-loop.mjs` (existing)
  - `plugins/consensus/skills/evaluate/scripts/consensus-loop.mjs` (new)
- Extend the same mapping for wrappers using the PR #14 convention:
  - `src/consensus/refine/consensus-refine.ts` →
    `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`
  - `src/consensus/evaluate/consensus-evaluate.ts` →
    `plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs` with
    `importRewrites: [{ from: '../core/consensus-loop.js', to: './consensus-loop.mjs' }]`
- Preserve the generated banner and never hand-edit generated `.mjs` outputs.
- Keep `pnpm run build:check` / `tests/generated-output-sync.test.mjs` as the drift guard.
- Provide local `evaluate/schemas/*.json` assets because the generated engine resolves schemas
  module-relative via `../schemas/...`.
- Tighten schema handling with the explicit interim convention PR #14 left in place: keep the
  existing distribution schemas under `plugins/consensus/skills/refine/schemas/` canonical for
  now, copy the required schema assets into `evaluate/schemas/`, and add an explicit
  parity/drift test so evaluate schemas cannot silently diverge from refine schemas. Moving
  schemas under `src/consensus/core/schemas/` remains a future cleanup, not part of this item.
- Keep generated `.mjs` outputs excluded from oxlint/oxfmt/lint-staged/CI formatting in the
  same places PR #13 introduced.

**Design Decisions:**

- Generated-runtime unit = **canonical TypeScript source + committed `.mjs` output per
  provider-facing runtime path** for both engine and wrapper outputs. Schema JSONs remain
  local distribution assets because the current engine resolves them relative to the generated
  `.mjs` file, but schema copying must be drift-checked.
- Do not add `sync:consensus-core`; that would duplicate the generated-runtime substrate now
  documented by DR-020.
- PR #14 shipped the wrapper import/build convention evaluate should follow. No additional
  sequencing blocker remains for planning.

## Testing Strategy

All peer calls are mocked via the injected `invokePeer` hook (the same hook refine's tests
use) — no live Paseo. New consensus-evaluate coverage should be `.test.ts` and Vitest-first.
`pnpm test` still includes the legacy Node suite, but this project should not add new
`node:test` coverage.

### Key Test Levels and Scenarios

| Concern                          | Verification | Key Scenarios                                                                                                   |
| -------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------- |
| Prompt profile selection        | Vitest       | Evaluate passes evaluation-framed builders; refine/no-profile path keeps default builders |
| Wrapper defaults (AC #2)         | Vitest       | Asserts `parallel_revision` / `minimal` / `shared_input` applied; each overridable; `independent_draft` rejected |
| Evaluation output contract (AC #1) | Vitest/integration | Final doc has unified findings; `verdict-parallel` reused unchanged; **canonical per-record `consensus-verdict` blocks (peer reasoning + verdict) are embedded in the artifact**, not just a rendered summary; `proposed_artifact` carries the eval doc |
| Deliberation-log state contract (AC #1) | Vitest/integration | Wrapper passes `--output-records/-section/-status`; final artifact embeds the deliberation log; dissent surfaced per CONVERGED vs IMPASSE/escalation |
| Impasse under minimal agency (AC #4) | Vitest/integration | Inject IMPASSE/escalation verdicts → final doc surfaces an "Unresolved dissent" section enumerating positions; status reflects impasse |
| Engine seam (default-preserving) | unit/Vitest  | `runConsensusLoop` with no `promptProfile` produces identical prompts/behavior to today; TypeScript types cover the new run option |
| Schema parity/copy behavior      | Vitest       | Evaluate schema assets are generated from canonical schemas or parity-checked against the canonical distribution schema set |
| Generated-output drift guard     | Vitest/build | Engine and wrapper generated outputs match committed `.mjs` files (`pnpm run build:check`) |
| Docs / family status shipped (AC #3) | validate     | `npm run validate` asserts the evaluate skill is registered in manifests/SKILL.md; READMEs list it as shipped, not deferred |
| refine regression                | unit/integration | refine's existing full suite still passes (behavior-identical)                                                  |

### Notes

- `npm run validate` must pass (manifest/structure/docs invariants — evaluate skill must be
  registered as shipped).
- `npm run smoke` (mocked end-to-end consensus wrapper flow) must pass.
- `pnpm run type-check` and `pnpm run build:check` must pass before implementation is treated
  as complete.

## Open Questions

The evaluate-specific design questions (engine reuse, output contract) are resolved. PR #14
settled the source-to-distribution import/build convention, so planning can proceed against
DR-021.

## References

- Discovery: `discovery.md`
- Backlog item: `.oat/repo/reference/backlog/items/add-consensus-evaluate-skill.md`
- Template skill: `plugins/consensus/skills/refine/`
- Generated-runtime precedent from PR #13: `src/consensus/core/consensus-loop.ts`,
  `scripts/build-generated.mjs`, `tests/generated-output-sync.test.mjs`
- Wrapper import-rewrite precedent from PR #14: `src/consensus/refine/consensus-refine.ts`,
  `tests/generated-consensus-refine-import.test.ts`
- Decision records: `.oat/repo/reference/decision-record.md` DR-020 and DR-021
