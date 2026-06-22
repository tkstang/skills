---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-06-21
oat_phase: plan
oat_phase_status: complete
oat_plan_parallel_groups: []
oat_plan_hill_phases: ["p04"]
oat_auto_review_at_hill_checkpoints: true
oat_plan_source: spec-driven
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
oat_template: false
---

# Implementation Plan: consensus-family

> Execute this plan using `oat-project-implement` after the plan artifact review passes.

**Goal:** Implement the consensus creation family by adding `independent_draft` to the shared loop core and shipping `consensus-create`, `consensus-decide`, and `consensus-plan` as thin wrappers over that primitive.

**Architecture:** The loop core owns cold-start semantics and round-1 prompt framing; wrapper skills only parse inputs, set defaults, frame prompts/output contracts, and render artifacts using the existing deliberation log and resolution block machinery.

**Tech Stack:** Node 22+, TypeScript under `src/`, generated dependency-free `.mjs` runtime under `plugins/consensus/skills/*/scripts/`, Vitest, pnpm, esbuild-generated output checks, repository validation, and mocked smoke tests.

**Commit Convention:** `{type}({scope}): {description}` - e.g., `feat(p01-t03): frame independent draft prompts`.

## Planning Checklist

- [x] Defer HiLL checkpoint confirmation to oat-project-implement
- [x] Evaluated phases for parallelism opportunities
- [x] Set `oat_plan_parallel_groups` in frontmatter
- [x] Run plan artifact review

## Parallelism

`oat_plan_parallel_groups: []` keeps implementation sequential. The wrapper phases are conceptually separable, but they all touch shared build-generation, skill-version, smoke-test, README, manifest, and repo-invariant surfaces, so declaring phase-level parallelism would create avoidable merge conflicts.

## Pre-Implementation Coordination

This branch was rebased onto the merged docs-IA PR (#32) at `origin/main` merge commit `62c26a2`. PR #32 stands up the Fumadocs site under `documentation/docs/`, slims `README.md` into an entry point/install matrix, and rewrites `tests/repo/readme-scope.test.ts` plus `tests/repo/docs-presence.test.ts` to treat the docs site as the dense documentation source of truth.

Keep the implementation task intent, but re-check documentation paths and repo-invariant tests against the rebased tree before executing documentation-facing tasks. In particular:

- User-facing docs for `consensus-create`, `consensus-decide`, `consensus-plan`, and `independent_draft` should likely land under `documentation/docs/user-guide/consensus/` by adding per-skill pages, updating `index.md`, `configuration.md`, and `meta.json`, then regenerating the Fumadocs index with `cd documentation && oat docs generate-index --docs-dir docs --output index.md`.
- `README.md` should remain slim; update only its short shipped-skill summary or links if needed.
- `plugins/consensus/README.md` remains in scope for deep plugin/operator reference because PR #32 intentionally left it untouched.
- `CHANGELOG.md`, smoke tests, provider manifests, skill docs, and generated-output invariants remain implementation-scope surfaces.

If the IA still changes after this rebase, adapt the affected documentation paths during implementation or defer structure-specific sync to `oat-project-document`; do not preserve stale documentation paths just because they appear here.

## Phase 1: Loop-Core `independent_draft`

### Task p01-t01: Widen Cold-Start Types and Parser

**Files:**

- Modify: `src/consensus/core/consensus-loop.ts`
- Modify: `tests/consensus/core/loop-cli.test.ts`

**Step 1: Write test (RED)**

Add parser/type coverage proving the loop core accepts both `shared_input` and `independent_draft`, rejects unknown values, and leaves the default as `shared_input`.

Run: `pnpm exec vitest run tests/consensus/core/loop-cli.test.ts`
Expected: New cold-start acceptance test fails before implementation.

**Step 2: Implement (GREEN)**

Update the core cold-start type and parser outline:

```typescript
export type ColdStartMode = 'shared_input' | 'independent_draft';
function parseColdStart(value: string): ColdStartMode;
```

Keep wrapper-specific restrictions out of the core.

Run: `pnpm exec vitest run tests/consensus/core/loop-cli.test.ts`
Expected: Core parser tests pass.

**Step 3: Refactor**

Check type annotations in `LoopOptions`, `RunOptions`, and exported helpers for redundant casts introduced by the wider union.

**Step 4: Verify**

Run: `pnpm run type-check`
Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add src/consensus/core/consensus-loop.ts tests/consensus/core/loop-cli.test.ts
git commit -m "feat(p01-t01): accept independent draft cold start in core"
```

---

### Task p01-t02: Thread Cold Start Into Prompt Builders

**Files:**

- Modify: `src/consensus/core/consensus-loop.ts`
- Modify: `tests/consensus/evaluate/prompt-profile.test.ts`
- Modify: `tests/consensus/evaluate/wrapper.test.ts`

**Step 1: Write test (RED)**

Add type/runtime assertions that `buildTurnPrompt` and `buildParallelTurnPrompt` receive `coldStart` on each invocation, including existing evaluate prompt-profile tests.

Run: `pnpm exec vitest run tests/consensus/evaluate/prompt-profile.test.ts tests/consensus/evaluate/wrapper.test.ts`
Expected: New assertions fail because the prompt input omits `coldStart`.

**Step 2: Implement (GREEN)**

Extend prompt-builder inputs:

```typescript
interface TurnPromptInput { coldStart: ColdStartMode; }
interface ParallelTurnPromptInput { coldStart: ColdStartMode; }
```

Pass `options.coldStart` through every turn-builder call.

Run: `pnpm exec vitest run tests/consensus/evaluate/prompt-profile.test.ts tests/consensus/evaluate/wrapper.test.ts`
Expected: Prompt-profile tests pass.

**Step 3: Refactor**

Keep prompt builders backwards-readable by placing `coldStart` near `round` and `mode`.

**Step 4: Verify**

Run: `pnpm run type-check`
Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add src/consensus/core/consensus-loop.ts tests/consensus/evaluate/prompt-profile.test.ts tests/consensus/evaluate/wrapper.test.ts
git commit -m "feat(p01-t02): pass cold start into prompt builders"
```

---

### Task p01-t03: Frame Round-1 Independent Draft Prompts

**Files:**

- Modify: `src/consensus/core/consensus-loop.ts`
- Create: `tests/consensus/core/independent-draft-prompts.test.ts`

**Step 1: Write test (RED)**

Add prompt-shape tests for alternating and parallel modes:

- `shared_input` keeps existing revise/shared-artifact framing.
- `independent_draft` round 1 frames the section text as an untrusted brief.
- Round 2+ keeps the existing revision framing.
- Alternating mode documents the degenerate A-drafts/B-revises path.

Run: `pnpm exec vitest run tests/consensus/core/independent-draft-prompts.test.ts`
Expected: Independent-draft prompt tests fail before the framing branch exists.

**Step 2: Implement (GREEN)**

Introduce small framing helpers in the core prompt builders:

```typescript
function roundOneTaskForColdStart(input: { coldStart: ColdStartMode; mode: IterationMode; turn: number }): string;
```

Use the existing artifact channel; change only the round-1 wording selected by `coldStart`.

Run: `pnpm exec vitest run tests/consensus/core/independent-draft-prompts.test.ts`
Expected: New prompt tests pass.

**Step 3: Refactor**

Review prompt text for injection discipline: brief text must remain delimited as untrusted data, not instructions.

**Step 4: Verify**

Run: `pnpm exec vitest run tests/consensus/core/loop-records.test.ts tests/consensus/core/loop-cli.test.ts`
Expected: Existing prompt and loop tests remain green.

**Step 5: Commit**

```bash
git add src/consensus/core/consensus-loop.ts tests/consensus/core/independent-draft-prompts.test.ts
git commit -m "feat(p01-t03): frame independent draft round one prompts"
```

---

### Task p01-t04: Prove Independent Draft Across Iteration Modes

**Files:**

- Create: `tests/consensus/core/independent-draft-loop.test.ts`
- Modify: `tests/helpers/consensus.ts`

**Step 1: Write test (RED)**

Add loop-level tests with injected peer/synthesizer invokers for `alternating`, `parallel_revision`, and `parallel_synthesized`:

- Round 1 starts from the brief.
- Parallel modes get two independent peer outputs.
- Synthesized mode appends a synthesis record.
- The result records `cold_start: independent_draft`.

Run: `pnpm exec vitest run tests/consensus/core/independent-draft-loop.test.ts`
Expected: Tests fail until loop execution accepts and records the widened cold-start.

**Step 2: Implement (GREEN)**

Adjust loop execution and status/resolution plumbing only where the wider cold-start value is blocked or narrowed.

Run: `pnpm exec vitest run tests/consensus/core/independent-draft-loop.test.ts`
Expected: All independent-draft loop scenarios pass.

**Step 3: Refactor**

Move duplicated mock-peer helpers into `tests/helpers/consensus.ts` only if the new tests repeat existing fixture logic.

**Step 4: Verify**

Run: `pnpm exec vitest run tests/consensus/core`
Expected: Core consensus tests pass.

**Step 5: Commit**

```bash
git add src/consensus/core/consensus-loop.ts tests/consensus/core/independent-draft-loop.test.ts tests/helpers/consensus.ts
git commit -m "test(p01-t04): cover independent draft loop modes"
```

---

### Task p01-t05: Preserve Refine and Evaluate Shared-Input Guards

**Files:**

- Modify: `src/consensus/refine/consensus-refine.ts`
- Modify: `src/consensus/evaluate/consensus-evaluate.ts`
- Modify: `tests/consensus/refine/wrapper-options.test.ts`
- Modify: `tests/consensus/evaluate/wrapper.test.ts`

**Step 1: Write test (RED)**

Assert `refine` and `evaluate` reject `--cold-start independent_draft` with a clear "`shared_input` only" message while still accepting/defaulting to `shared_input`.

Run: `pnpm exec vitest run tests/consensus/refine/wrapper-options.test.ts tests/consensus/evaluate/wrapper.test.ts`
Expected: Message expectations fail if current text is stale or core widening leaks through.

**Step 2: Implement (GREEN)**

Keep wrapper-local validation:

```typescript
function parseColdStart(value: string): 'shared_input';
```

Update messages to state the semantic restriction, not "not yet supported."

Run: `pnpm exec vitest run tests/consensus/refine/wrapper-options.test.ts tests/consensus/evaluate/wrapper.test.ts`
Expected: Guard tests pass.

**Step 3: Refactor**

Avoid sharing the guard with new wrapper code; the new skills must accept both cold-start values.

**Step 4: Verify**

Run: `pnpm run type-check`
Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add src/consensus/refine/consensus-refine.ts src/consensus/evaluate/consensus-evaluate.ts tests/consensus/refine/wrapper-options.test.ts tests/consensus/evaluate/wrapper.test.ts
git commit -m "fix(p01-t05): keep refine evaluate shared input guards"
```

---

### Task p01-t06: Regenerate Existing Skill Runtime and Version Bumps

**Files:**

- Modify: `plugins/consensus/skills/refine/SKILL.md`
- Modify: `plugins/consensus/skills/refine/scripts/consensus-loop.mjs` (generated)
- Modify: `plugins/consensus/skills/refine/scripts/consensus-refine.mjs` (generated)
- Modify: `plugins/consensus/skills/evaluate/SKILL.md`
- Modify: `plugins/consensus/skills/evaluate/scripts/consensus-loop.mjs` (generated)
- Modify: `plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs` (generated)

**Step 1: Write test (RED)**

Run generated-output and skill-version checks after the Phase 1 source changes but before regenerating/bumping.

Run: `pnpm run build:check && pnpm run validate:skill-versions -- --base-ref main`
Expected: Checks fail because generated runtime output and shipped skill versions are stale.

**Step 2: Implement (GREEN)**

Run the build and bump `refine` / `evaluate` `version` and `metadata.version` according to repo release/version discipline.

Run: `pnpm run build`
Expected: Existing consensus generated outputs are updated from canonical TypeScript.

**Step 3: Refactor**

Confirm no hand edits landed in generated `.mjs` beyond build output.

**Step 4: Verify**

Run: `pnpm run build:check && pnpm run validate:skill-versions -- --base-ref main && pnpm run validate`
Expected: Generated output, skill-version, and structural validators pass.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/refine plugins/consensus/skills/evaluate
git commit -m "build(p01-t06): regenerate existing consensus runtimes"
```

---

## Phase 2: `consensus-create`

### Task p02-t01: Add Create Wrapper Argument Model

**Files:**

- Create: `src/consensus/create/consensus-create.ts`
- Create: `tests/consensus/create/wrapper.test.ts`

**Step 1: Write test (RED)**

Cover parse/default behavior:

- `--brief <text>` or `--brief-file <path>` is required, exactly one form.
- `--template <path>` is optional.
- Defaults are `independent_draft`, `parallel_synthesized`, maximum agency.
- `--cold-start`, `--iteration`, `--agency`, peers, output, run-dir, and allow-root parse like existing wrappers.

Run: `pnpm exec vitest run tests/consensus/create/wrapper.test.ts`
Expected: Tests fail because the create wrapper does not exist.

**Step 2: Implement (GREEN)**

Add parse/load exports shaped like existing wrappers:

```typescript
export interface ParsedCreateOptions { brief: string | null; briefFile: string | null; template: string | null; }
export function parseCreateArgs(argv: readonly string[]): ParsedCreateOptions;
```

Reuse standard-library-only helper patterns from refine/evaluate.

Run: `pnpm exec vitest run tests/consensus/create/wrapper.test.ts`
Expected: Parser/default tests pass.

**Step 3: Refactor**

Keep shared helper extraction small; do not introduce a runtime dependency or broad abstraction.

**Step 4: Verify**

Run: `pnpm run type-check`
Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add src/consensus/create/consensus-create.ts tests/consensus/create/wrapper.test.ts
git commit -m "feat(p02-t01): add consensus create arguments"
```

---

### Task p02-t02: Implement Create Input Loading and Prompt Profile

**Files:**

- Modify: `src/consensus/create/consensus-create.ts`
- Modify: `tests/consensus/create/wrapper.test.ts`

**Step 1: Write test (RED)**

Add tests for inline/file brief loading, optional template loading, 1 MiB cap, path confinement, and prompt text that frames brief/template as untrusted data.

Run: `pnpm exec vitest run tests/consensus/create/wrapper.test.ts`
Expected: Loading and prompt-profile tests fail.

**Step 2: Implement (GREEN)**

Add load/profile exports:

```typescript
export function loadCreateInputs(options: ParsedCreateOptions, context: { cwd?: string }): Promise<LoadedCreateInputs>;
export function buildCreatePromptProfile(inputs: LoadedCreateInputs): PromptProfile;
```

Use existing cap and confinement behavior from the wrapper patterns.

Run: `pnpm exec vitest run tests/consensus/create/wrapper.test.ts`
Expected: Loading and prompt-profile tests pass.

**Step 3: Refactor**

Keep the create output contract free-form; do not add heading validation or schemas.

**Step 4: Verify**

Run: `pnpm run type-check`
Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add src/consensus/create/consensus-create.ts tests/consensus/create/wrapper.test.ts
git commit -m "feat(p02-t02): frame create briefs as untrusted input"
```

---

### Task p02-t03: Run Create Through the Consensus Loop

**Files:**

- Modify: `src/consensus/create/consensus-create.ts`
- Create: `tests/consensus/create/provider-cli-integration.test.ts`

**Step 1: Write test (RED)**

Add a mock-provider integration test that runs create to convergence and asserts:

- `runConsensusLoop` receives `coldStart: independent_draft`.
- Output artifact contains created content, deliberation log, and resolution block.
- Resolution records cold-start, iteration, agency, peer calls, and synthesis calls.

Run: `pnpm exec vitest run tests/consensus/create/provider-cli-integration.test.ts`
Expected: Integration test fails until create invokes the loop and renders output.

**Step 2: Implement (GREEN)**

Add `runConsensusCreate` and CLI entrypoint wiring:

```typescript
export async function runConsensusCreate(input: CreateRunInput, options?: CreateExecutionOptions): Promise<CreateRunResult>;
export async function runCreateCli(argv?: string[], options?: CreateCliOptions): Promise<number>;
```

Render using the existing resolution/log conventions.

Run: `pnpm exec vitest run tests/consensus/create/provider-cli-integration.test.ts`
Expected: Create integration test passes.

**Step 3: Refactor**

Ensure output path and run-dir writes are atomic and confined like refine/evaluate.

**Step 4: Verify**

Run: `pnpm exec vitest run tests/consensus/create`
Expected: Create wrapper suite passes.

**Step 5: Commit**

```bash
git add src/consensus/create/consensus-create.ts tests/consensus/create/provider-cli-integration.test.ts
git commit -m "feat(p02-t03): run consensus create through loop"
```

---

### Task p02-t04: Ship Create Skill Anatomy and Generated Runtime

**Files:**

- Create: `plugins/consensus/skills/create/SKILL.md`
- Create: `plugins/consensus/skills/create/references/examples/artifact-brief.md`
- Create: `plugins/consensus/skills/create/references/operator-qa.md`
- Create: `plugins/consensus/skills/create/schemas/verdict-alternating.schema.json`
- Create: `plugins/consensus/skills/create/schemas/verdict-parallel.schema.json`
- Create: `plugins/consensus/skills/create/schemas/synthesis.schema.json`
- Create: `plugins/consensus/skills/create/scripts/consensus-loop.mjs` (generated)
- Create: `plugins/consensus/skills/create/scripts/consensus-create.mjs` (generated)
- Modify: `scripts/build-generated.mjs`
- Modify: `scripts/bump-version.mjs`
- Modify: `plugins/consensus/.claude-plugin/plugin.json`
- Modify: `plugins/consensus/.codex-plugin/plugin.json`
- Modify: `plugins/consensus/.cursor-plugin/plugin.json`
- Modify: `tests/repo/skill-frontmatter.test.ts`
- Modify: `tests/repo/docs-presence.test.ts`
- Modify: `tests/repo/layout.test.ts`
- Modify: `tests/repo/plugin-manifests.test.ts`
- Modify: `tests/release/versioning.test.ts`
- Modify: `tests/tooling/generated-output-sync.test.ts`

**Step 1: Write test (RED)**

Extend repo-invariant tests to expect the create skill directory, portable/versioned frontmatter, bundled schemas, example fixture, generated script path, and refreshed plugin manifest description. Add the new skill to the hardcoded shipped-skill lists in both `tests/repo/skill-frontmatter.test.ts` (`skillPaths` parametrization plus the `['refine', 'evaluate']` name allowlist) and `tests/release/versioning.test.ts` (`skillFiles`).

Run: `pnpm exec vitest run tests/repo/skill-frontmatter.test.ts tests/repo/docs-presence.test.ts tests/repo/layout.test.ts tests/repo/plugin-manifests.test.ts tests/release/versioning.test.ts tests/tooling/generated-output-sync.test.ts`
Expected: Repo-invariant tests fail before the skill anatomy exists.

**Step 2: Implement (GREEN)**

Add the create skill files, copy schema contracts from the existing consensus skills, register `src/consensus/create/consensus-create.ts` in `scripts/build-generated.mjs`, add the create `SKILL.md` path to `SKILL_FILES`, and broaden the provider plugin manifest descriptions to include the create family. Do not bump provider manifest versions unless a release decision explicitly changes the current `0.1.0` pin.

The create `SKILL.md` must include the same enforced user-facing structure as the shipped consensus skills: `## When NOT to Use`, `## Examples`, `## Success Criteria`, `## Output Contract`, and a per-skill invocation section such as `## Create Invocation`.

Run: `pnpm run build`
Expected: `plugins/consensus/skills/create/scripts/consensus-create.mjs` and its loop runtime are generated.

**Step 3: Refactor**

Check `version` and `metadata.version` match in the new `SKILL.md`.

**Step 4: Verify**

Run: `pnpm exec vitest run tests/repo/skill-frontmatter.test.ts tests/repo/docs-presence.test.ts tests/repo/layout.test.ts tests/repo/plugin-manifests.test.ts tests/release/versioning.test.ts tests/tooling/generated-output-sync.test.ts`
Expected: Repo-invariant tests pass.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/create plugins/consensus/.claude-plugin/plugin.json plugins/consensus/.codex-plugin/plugin.json plugins/consensus/.cursor-plugin/plugin.json scripts/build-generated.mjs scripts/bump-version.mjs tests/repo/skill-frontmatter.test.ts tests/repo/docs-presence.test.ts tests/repo/layout.test.ts tests/repo/plugin-manifests.test.ts tests/release/versioning.test.ts tests/tooling/generated-output-sync.test.ts
git commit -m "feat(p02-t04): ship consensus create skill"
```

---

### Task p02-t05: Document and Smoke-Test Create

**Files:**

- Add: `documentation/docs/user-guide/consensus/create.md`
- Modify: `documentation/docs/user-guide/consensus/index.md`
- Modify: `documentation/docs/user-guide/consensus/configuration.md`
- Modify: `documentation/docs/user-guide/consensus/meta.json`
- Modify: `documentation/index.md` (generated; do not hand-edit)
- Modify: `README.md`
- Modify: `plugins/consensus/README.md`
- Modify: `CHANGELOG.md`
- Modify: `scripts/smoke-test.mjs`
- Modify: `tests/release/smoke-test-script.test.ts`
- Modify: `tests/repo/readme-scope.test.ts`

**Step 1: Write test (RED)**

Add smoke, docs-site, README summary, and CHANGELOG tests asserting create is documented as shipped, not future work, recorded under `## [Unreleased]` / `### Added`, and the mocked smoke flow checks artifact + deliberation log + resolution metadata. Add a negative docs assertion that `consensus-create` is not described as future work after it ships.

Run: `pnpm exec vitest run tests/release/smoke-test-script.test.ts tests/repo/readme-scope.test.ts`
Expected: Tests fail until docs and smoke flow include create.

**Step 2: Implement (GREEN)**

Update the Fumadocs consensus pages, slim README summary, plugin README reference, CHANGELOG, and smoke fixture flow for `consensus-create`. Add the create page to `documentation/docs/user-guide/consensus/meta.json` and `index.md`, update `configuration.md` for `independent_draft` semantics, and remove `consensus-create` from the `## Limitations` "future work" bullet in `documentation/docs/user-guide/consensus/index.md`. Then run `cd documentation && oat docs generate-index --docs-dir docs --output index.md`.

Run: `pnpm run smoke`
Expected: Mocked smoke flow includes create and passes.

**Step 3: Refactor**

Ensure docs avoid provider-marketplace claims beyond the verified local install path, keep `README.md` as a short entry point rather than reintroducing dense reference sections, and leave only the not-yet-shipped skills in the consensus docs future-work bullet.

**Step 4: Verify**

Run: `pnpm run build:check && pnpm run type-check && pnpm run test && pnpm run validate && pnpm run validate:skill-versions -- --base-ref main && pnpm run smoke`
Expected: Create phase gate set passes.

**Step 5: Commit**

```bash
git add documentation/docs/user-guide/consensus/create.md documentation/docs/user-guide/consensus/index.md documentation/docs/user-guide/consensus/configuration.md documentation/docs/user-guide/consensus/meta.json documentation/index.md README.md plugins/consensus/README.md CHANGELOG.md scripts/smoke-test.mjs tests/release/smoke-test-script.test.ts tests/repo/readme-scope.test.ts
git commit -m "docs(p02-t05): document and smoke test consensus create"
```

---

## Phase 3: `consensus-decide`

### Task p03-t01: Add Decide Wrapper Argument Model

**Files:**

- Create: `src/consensus/decide/consensus-decide.ts`
- Create: `tests/consensus/decide/wrapper.test.ts`

**Step 1: Write test (RED)**

Cover parser/default behavior for `--options <path>`, default `independent_draft` / `parallel_synthesized` / minimal agency, and shared override flags.

Run: `pnpm exec vitest run tests/consensus/decide/wrapper.test.ts`
Expected: Tests fail because the decide wrapper does not exist.

**Step 2: Implement (GREEN)**

Add decide parse exports and option validation:

```typescript
export interface ParsedDecideOptions { optionsPath: string; }
export function parseDecideArgs(argv: readonly string[]): ParsedDecideOptions;
```

Run: `pnpm exec vitest run tests/consensus/decide/wrapper.test.ts`
Expected: Parser/default tests pass.

**Step 3: Refactor**

Keep options path handling aligned with existing confinement helpers.

**Step 4: Verify**

Run: `pnpm run type-check`
Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add src/consensus/decide/consensus-decide.ts tests/consensus/decide/wrapper.test.ts
git commit -m "feat(p03-t01): add consensus decide arguments"
```

---

### Task p03-t02: Render Decide Markdown Contract and Dissent

**Files:**

- Modify: `src/consensus/decide/consensus-decide.ts`
- Modify: `tests/consensus/decide/wrapper.test.ts`

**Step 1: Write test (RED)**

Add tests proving the prompt asks for required headings and final rendering surfaces `unresolved_disagreements[]` under dissent/unresolved disagreement instead of silently choosing for the user at minimal agency.

Run: `pnpm exec vitest run tests/consensus/decide/wrapper.test.ts`
Expected: Heading and dissent tests fail.

**Step 2: Implement (GREEN)**

Add prompt/render helpers:

```typescript
export function buildDecidePromptProfile(inputs: LoadedDecideInputs): PromptProfile;
export function renderDecisionArtifact(input: DecisionRenderInput): string;
```

Use prompt/template framing, not a new machine schema.

Run: `pnpm exec vitest run tests/consensus/decide/wrapper.test.ts`
Expected: Heading and dissent tests pass.

**Step 3: Refactor**

Keep the required headings stable: recommendation, reasoning, alternatives, dissent / unresolved disagreement.

**Step 4: Verify**

Run: `pnpm run type-check`
Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add src/consensus/decide/consensus-decide.ts tests/consensus/decide/wrapper.test.ts
git commit -m "feat(p03-t02): render consensus decide markdown"
```

---

### Task p03-t03: Run Decide Through the Consensus Loop

**Files:**

- Modify: `src/consensus/decide/consensus-decide.ts`
- Create: `tests/consensus/decide/provider-cli-integration.test.ts`

**Step 1: Write test (RED)**

Add a mock-provider integration test using a contested-options fixture and assert the output has required headings, resolution metadata, and surfaced dissent.

Run: `pnpm exec vitest run tests/consensus/decide/provider-cli-integration.test.ts`
Expected: Integration test fails until decide invokes the loop and renders output.

**Step 2: Implement (GREEN)**

Add `runConsensusDecide` and CLI entrypoint wiring:

```typescript
export async function runConsensusDecide(input: DecideRunInput, options?: DecideExecutionOptions): Promise<DecideRunResult>;
```

Run: `pnpm exec vitest run tests/consensus/decide/provider-cli-integration.test.ts`
Expected: Decide integration test passes.

**Step 3: Refactor**

Ensure unresolved disagreements are pulled from synthesis records and remain visible in the rendered artifact.

**Step 4: Verify**

Run: `pnpm exec vitest run tests/consensus/decide`
Expected: Decide wrapper suite passes.

**Step 5: Commit**

```bash
git add src/consensus/decide/consensus-decide.ts tests/consensus/decide/provider-cli-integration.test.ts
git commit -m "feat(p03-t03): run consensus decide through loop"
```

---

### Task p03-t04: Ship Decide Skill Anatomy and Generated Runtime

**Files:**

- Create: `plugins/consensus/skills/decide/SKILL.md`
- Create: `plugins/consensus/skills/decide/references/examples/contested-options.md`
- Create: `plugins/consensus/skills/decide/references/operator-qa.md`
- Create: `plugins/consensus/skills/decide/schemas/verdict-alternating.schema.json`
- Create: `plugins/consensus/skills/decide/schemas/verdict-parallel.schema.json`
- Create: `plugins/consensus/skills/decide/schemas/synthesis.schema.json`
- Create: `plugins/consensus/skills/decide/scripts/consensus-loop.mjs` (generated)
- Create: `plugins/consensus/skills/decide/scripts/consensus-decide.mjs` (generated)
- Modify: `scripts/build-generated.mjs`
- Modify: `scripts/bump-version.mjs`
- Modify: `tests/repo/skill-frontmatter.test.ts`
- Modify: `tests/repo/docs-presence.test.ts`
- Modify: `tests/repo/layout.test.ts`
- Modify: `tests/release/versioning.test.ts`
- Modify: `tests/tooling/generated-output-sync.test.ts`

**Step 1: Write test (RED)**

Extend repo-invariant tests for decide skill frontmatter, schemas, examples, generated script, and the shipped-skill test allowlists in both `tests/repo/skill-frontmatter.test.ts` (`skillPaths` plus the name allowlist) and `tests/release/versioning.test.ts` (`skillFiles`).

Run: `pnpm exec vitest run tests/repo/skill-frontmatter.test.ts tests/repo/docs-presence.test.ts tests/repo/layout.test.ts tests/release/versioning.test.ts tests/tooling/generated-output-sync.test.ts`
Expected: Tests fail until decide skill files exist.

**Step 2: Implement (GREEN)**

Add decide skill anatomy, build-generated mapping, and version-bump registration.

The decide `SKILL.md` must include the same enforced user-facing structure as the shipped consensus skills: `## When NOT to Use`, `## Examples`, `## Success Criteria`, `## Output Contract`, and a per-skill invocation section such as `## Decision Invocation`.

Run: `pnpm run build`
Expected: Decide generated runtime files are written under `plugins/consensus/skills/decide/scripts/`.

**Step 3: Refactor**

Keep decide docs explicit that minimal agency surfaces unresolved disagreement.

**Step 4: Verify**

Run: `pnpm exec vitest run tests/repo/skill-frontmatter.test.ts tests/repo/docs-presence.test.ts tests/repo/layout.test.ts tests/release/versioning.test.ts tests/tooling/generated-output-sync.test.ts`
Expected: Repo-invariant tests pass.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/decide scripts/build-generated.mjs scripts/bump-version.mjs tests/repo/skill-frontmatter.test.ts tests/repo/docs-presence.test.ts tests/repo/layout.test.ts tests/release/versioning.test.ts tests/tooling/generated-output-sync.test.ts
git commit -m "feat(p03-t04): ship consensus decide skill"
```

---

### Task p03-t05: Document and Smoke-Test Decide

**Files:**

- Add: `documentation/docs/user-guide/consensus/decide.md`
- Modify: `documentation/docs/user-guide/consensus/index.md`
- Modify: `documentation/docs/user-guide/consensus/meta.json`
- Modify: `documentation/index.md` (generated; do not hand-edit)
- Modify: `README.md`
- Modify: `plugins/consensus/README.md`
- Modify: `CHANGELOG.md`
- Modify: `scripts/smoke-test.mjs`
- Modify: `tests/release/smoke-test-script.test.ts`
- Modify: `tests/repo/readme-scope.test.ts`

**Step 1: Write test (RED)**

Add docs-site, smoke, README summary, and CHANGELOG assertions for decide, including the required headings and dissent surfacing. Add a negative docs assertion that `consensus-decide` is not described as future work after it ships.

Run: `pnpm exec vitest run tests/release/smoke-test-script.test.ts tests/repo/readme-scope.test.ts`
Expected: Tests fail until decide docs and smoke flow are added.

**Step 2: Implement (GREEN)**

Update the Fumadocs consensus pages, slim README summary, plugin README reference, CHANGELOG, and smoke fixture flow for `consensus-decide`. Add the decide page to `documentation/docs/user-guide/consensus/meta.json` and `index.md`, remove `consensus-decide` from the `## Limitations` "future work" bullet, then regenerate `documentation/index.md`.

Run: `pnpm run smoke`
Expected: Mocked smoke flow includes decide and passes.

**Step 3: Refactor**

Keep docs clear that output is markdown, not a new machine-readable decision schema; update future-work wording so only `consensus-plan` and `consensus-research` remain deferred after decide ships.

**Step 4: Verify**

Run: `pnpm run build:check && pnpm run type-check && pnpm run test && pnpm run validate && pnpm run validate:skill-versions -- --base-ref main && pnpm run smoke`
Expected: Decide phase gate set passes.

**Step 5: Commit**

```bash
git add documentation/docs/user-guide/consensus/decide.md documentation/docs/user-guide/consensus/index.md documentation/docs/user-guide/consensus/meta.json documentation/index.md README.md plugins/consensus/README.md CHANGELOG.md scripts/smoke-test.mjs tests/release/smoke-test-script.test.ts tests/repo/readme-scope.test.ts
git commit -m "docs(p03-t05): document and smoke test consensus decide"
```

---

## Phase 4: `consensus-plan` and Family Gates

### Task p04-t01: Add Plan Wrapper Argument Model

**Files:**

- Create: `src/consensus/plan/consensus-plan.ts`
- Create: `tests/consensus/plan/wrapper.test.ts`

**Step 1: Write test (RED)**

Cover parser/default behavior for `--goal <text>`, optional `--constraints <text>`, default `independent_draft` / `parallel_synthesized` / moderate agency, and shared override flags.

Run: `pnpm exec vitest run tests/consensus/plan/wrapper.test.ts`
Expected: Tests fail because the plan wrapper does not exist.

**Step 2: Implement (GREEN)**

Add plan parse exports and option validation:

```typescript
export interface ParsedPlanOptions { goal: string; constraints: string | null; }
export function parsePlanArgs(argv: readonly string[]): ParsedPlanOptions;
```

Run: `pnpm exec vitest run tests/consensus/plan/wrapper.test.ts`
Expected: Parser/default tests pass.

**Step 3: Refactor**

Keep constraints inline-only for v1; do not add a path input.

**Step 4: Verify**

Run: `pnpm run type-check`
Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add src/consensus/plan/consensus-plan.ts tests/consensus/plan/wrapper.test.ts
git commit -m "feat(p04-t01): add consensus plan arguments"
```

---

### Task p04-t02: Render Plan Markdown Contract

**Files:**

- Modify: `src/consensus/plan/consensus-plan.ts`
- Modify: `tests/consensus/plan/wrapper.test.ts`

**Step 1: Write test (RED)**

Add tests proving prompt and output include required headings for steps, dependencies, and risks, plus the consensus resolution block.

Run: `pnpm exec vitest run tests/consensus/plan/wrapper.test.ts`
Expected: Heading/render tests fail.

**Step 2: Implement (GREEN)**

Add prompt/render helpers:

```typescript
export function buildPlanPromptProfile(inputs: LoadedPlanInputs): PromptProfile;
export function renderPlanArtifact(input: PlanRenderInput): string;
```

Use markdown-by-prompt framing only.

Run: `pnpm exec vitest run tests/consensus/plan/wrapper.test.ts`
Expected: Heading/render tests pass.

**Step 3: Refactor**

Ensure constraints text is delimited as untrusted data.

**Step 4: Verify**

Run: `pnpm run type-check`
Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add src/consensus/plan/consensus-plan.ts tests/consensus/plan/wrapper.test.ts
git commit -m "feat(p04-t02): render consensus plan markdown"
```

---

### Task p04-t03: Run Plan Through the Consensus Loop

**Files:**

- Modify: `src/consensus/plan/consensus-plan.ts`
- Create: `tests/consensus/plan/provider-cli-integration.test.ts`

**Step 1: Write test (RED)**

Add a mock-provider integration test using a goal/constraints fixture and assert output headings, resolution metadata, and `cold_start: independent_draft`.

Run: `pnpm exec vitest run tests/consensus/plan/provider-cli-integration.test.ts`
Expected: Integration test fails until plan invokes the loop and renders output.

**Step 2: Implement (GREEN)**

Add `runConsensusPlan` and CLI entrypoint wiring:

```typescript
export async function runConsensusPlan(input: PlanRunInput, options?: PlanExecutionOptions): Promise<PlanRunResult>;
```

Run: `pnpm exec vitest run tests/consensus/plan/provider-cli-integration.test.ts`
Expected: Plan integration test passes.

**Step 3: Refactor**

Keep the plan wrapper thin; do not add outline-first or sectioning machinery.

**Step 4: Verify**

Run: `pnpm exec vitest run tests/consensus/plan`
Expected: Plan wrapper suite passes.

**Step 5: Commit**

```bash
git add src/consensus/plan/consensus-plan.ts tests/consensus/plan/provider-cli-integration.test.ts
git commit -m "feat(p04-t03): run consensus plan through loop"
```

---

### Task p04-t04: Ship Plan Skill Anatomy and Generated Runtime

**Files:**

- Create: `plugins/consensus/skills/plan/SKILL.md`
- Create: `plugins/consensus/skills/plan/references/examples/goal-and-constraints.md`
- Create: `plugins/consensus/skills/plan/references/operator-qa.md`
- Create: `plugins/consensus/skills/plan/schemas/verdict-alternating.schema.json`
- Create: `plugins/consensus/skills/plan/schemas/verdict-parallel.schema.json`
- Create: `plugins/consensus/skills/plan/schemas/synthesis.schema.json`
- Create: `plugins/consensus/skills/plan/scripts/consensus-loop.mjs` (generated)
- Create: `plugins/consensus/skills/plan/scripts/consensus-plan.mjs` (generated)
- Modify: `scripts/build-generated.mjs`
- Modify: `scripts/bump-version.mjs`
- Modify: `tests/repo/skill-frontmatter.test.ts`
- Modify: `tests/repo/docs-presence.test.ts`
- Modify: `tests/repo/layout.test.ts`
- Modify: `tests/release/versioning.test.ts`
- Modify: `tests/tooling/generated-output-sync.test.ts`

**Step 1: Write test (RED)**

Extend repo-invariant tests for plan skill frontmatter, schemas, example fixture, generated script, and the shipped-skill test allowlists in both `tests/repo/skill-frontmatter.test.ts` (`skillPaths` plus the name allowlist) and `tests/release/versioning.test.ts` (`skillFiles`).

Run: `pnpm exec vitest run tests/repo/skill-frontmatter.test.ts tests/repo/docs-presence.test.ts tests/repo/layout.test.ts tests/release/versioning.test.ts tests/tooling/generated-output-sync.test.ts`
Expected: Tests fail until plan skill files exist.

**Step 2: Implement (GREEN)**

Add plan skill anatomy, build-generated mapping, and version-bump registration.

The plan `SKILL.md` must include the same enforced user-facing structure as the shipped consensus skills: `## When NOT to Use`, `## Examples`, `## Success Criteria`, `## Output Contract`, and a per-skill invocation section such as `## Plan Invocation`.

Run: `pnpm run build`
Expected: Plan generated runtime files are written under `plugins/consensus/skills/plan/scripts/`.

**Step 3: Refactor**

Keep plan docs explicit that required headings are prompt-framed markdown.

**Step 4: Verify**

Run: `pnpm exec vitest run tests/repo/skill-frontmatter.test.ts tests/repo/docs-presence.test.ts tests/repo/layout.test.ts tests/release/versioning.test.ts tests/tooling/generated-output-sync.test.ts`
Expected: Repo-invariant tests pass.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/plan scripts/build-generated.mjs scripts/bump-version.mjs tests/repo/skill-frontmatter.test.ts tests/repo/docs-presence.test.ts tests/repo/layout.test.ts tests/release/versioning.test.ts tests/tooling/generated-output-sync.test.ts
git commit -m "feat(p04-t04): ship consensus plan skill"
```

---

### Task p04-t05: Document, Smoke-Test, and Run Final Gates

**Files:**

- Add: `documentation/docs/user-guide/consensus/plan.md`
- Modify: `documentation/docs/user-guide/consensus/index.md`
- Modify: `documentation/docs/user-guide/consensus/meta.json`
- Modify: `documentation/docs/engineering/architecture/generated-runtime.md`
- Modify: `documentation/index.md` (generated; do not hand-edit)
- Modify: `README.md`
- Modify: `plugins/consensus/README.md`
- Modify: `CHANGELOG.md`
- Modify: `scripts/smoke-test.mjs`
- Modify: `tests/release/smoke-test-script.test.ts`
- Modify: `tests/repo/readme-scope.test.ts`
- Modify: `tests/tooling/generated-output-sync.test.ts`

**Step 1: Write test (RED)**

Add docs-site, smoke, README summary, CHANGELOG, and family-level generated-output assertions for plan and the complete create/decide/plan family. Add a negative docs assertion that `consensus-plan` is not described as future work after it ships, and assert the generated-runtime table names the create/decide/plan generated `.mjs` paths.

Run: `pnpm exec vitest run tests/release/smoke-test-script.test.ts tests/repo/readme-scope.test.ts tests/tooling/generated-output-sync.test.ts`
Expected: Tests fail until plan docs/smoke and generated-output checks are updated.

**Step 2: Implement (GREEN)**

Update the Fumadocs consensus pages, generated-runtime architecture page, slim README summary, plugin README reference, CHANGELOG, and smoke fixture flow for `consensus-plan`; ensure generated-output sync covers all new runtime mappings. Add the plan page to `documentation/docs/user-guide/consensus/meta.json` and `index.md`, remove `consensus-plan` from the `## Limitations` "future work" bullet, then regenerate `documentation/index.md`. Edit `documentation/docs/engineering/architecture/generated-runtime.md` directly; the docs index regeneration does not update its canonical-source table.

Run: `pnpm run smoke`
Expected: Mocked smoke flow includes create, decide, and plan and passes.

**Step 3: Refactor**

Remove stale "future work" wording for shipped skills while keeping only `consensus-research` out of scope. Preserve the docs-IA contract that dense user guidance lives in `documentation/docs/` and README stays slim.

**Step 4: Verify**

Run: `pnpm run build:check && pnpm run type-check && pnpm run test && pnpm run validate && pnpm run validate:skill-versions -- --base-ref main && pnpm run smoke`
Expected: Full gate set passes.

**Step 5: Commit**

```bash
git add documentation/docs/user-guide/consensus/plan.md documentation/docs/user-guide/consensus/index.md documentation/docs/user-guide/consensus/meta.json documentation/docs/engineering/architecture/generated-runtime.md documentation/index.md README.md plugins/consensus/README.md CHANGELOG.md scripts/smoke-test.mjs tests/release/smoke-test-script.test.ts tests/repo/readme-scope.test.ts tests/tooling/generated-output-sync.test.ts
git commit -m "docs(p04-t05): document and verify consensus plan family"
```

---

## Closeout Bookkeeping

Discovery identified durable-decision promotion and backlog/roadmap cleanup as closeout work. That bookkeeping is intentionally deferred to `oat-project-complete`, after implementation and final review establish the shipped behavior. Do not add implementation-phase tasks for decision-record, backlog, `completed.md`, `current-state.md`, or roadmap updates unless the completion workflow asks for them.

---

## Reviews

Track reviews here after running the `oat-project-review-provide` and `oat-project-review-receive` skills.

| Scope  | Type     | Status   | Date       | Artifact                                      |
| ------ | -------- | -------- | ---------- | --------------------------------------------- |
| p01    | code     | passed   | 2026-06-21 | reviews/archived/p01-review-2026-06-21-v2.md |
| p02    | code     | passed   | 2026-06-21 | reviews/archived/p02-review-2026-06-21-v3.md |
| p03    | code     | passed   | 2026-06-21 | reviews/archived/p03-review-2026-06-21-v4.md |
| p04    | code     | pending  | -          | -                                             |
| final  | code     | pending  | -          | -                                             |
| spec   | artifact | pending  | -          | -                                             |
| design | artifact | passed   | 2026-06-21 | reviews/archived/artifact-design-review-2026-06-21.md |
| plan   | artifact | passed   | 2026-06-21 | reviews/archived/artifact-plan-review-2026-06-21-v2.md |

**Status values:** `pending` -> `received` -> `fixes_added` -> `fixes_completed` -> `passed`

**Meaning:**

- `received`: review artifact exists but findings have not yet been converted into fix tasks.
- `fixes_added`: fix tasks were added to the plan.
- `fixes_completed`: fix tasks were implemented and are awaiting re-review.
- `passed`: re-review ran and recorded no Critical/Important findings.

## Implementation Complete

**Summary:**

- Phase 1: 6 tasks - Loop-core cold-start support, prompt framing, mode coverage, refine/evaluate guards, and regenerated existing runtimes.
- Phase 2: 5 tasks - `consensus-create` wrapper, skill anatomy, generated runtime, docs, and smoke coverage.
- Phase 3: 5 tasks - `consensus-decide` wrapper, dissent rendering, skill anatomy, docs, and smoke coverage.
- Phase 4: 5 tasks - `consensus-plan` wrapper, skill anatomy, docs, smoke coverage, and full gate verification.

**Total: 21 tasks**

Ready for plan re-review, then implementation after the plan review passes and `oat-project-implement` confirms phase checkpoint behavior.

## References

- Design: `design.md`
- Spec: `spec.md`
- Discovery: `discovery.md`
- Architecture: `.oat/repo/reference/research/consensus/architecture-v3.md`
- Decision Record: `.oat/repo/reference/decision-record.md` (DR-024)
