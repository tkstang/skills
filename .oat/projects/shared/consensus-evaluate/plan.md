---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-06-17
oat_phase: plan
oat_phase_status: complete
oat_plan_parallel_groups: [] # fully sequential; phases share generated-output/build surfaces
oat_plan_hill_phases: ["p04"] # stop only after final implementation/review-fix phase
oat_auto_review_at_hill_checkpoints: true
oat_plan_source: quick
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
---

# Implementation Plan: consensus-evaluate

> Execute this plan using `oat-project-implement`.

**Goal:** Ship `consensus-evaluate`, a consensus plugin skill that evaluates an artifact against a rubric using the shared consensus loop, preserving per-peer reasoning and dissent in the final artifact.

**Architecture:** Canonical TypeScript lives under `src/consensus/`; provider-facing `.mjs` files under `plugins/consensus/skills/evaluate/scripts/` are generated committed runtime outputs. Evaluate mirrors PR #14 / DR-021: TypeScript imports the loop via `../core/consensus-loop.js`, and `scripts/build-generated.mjs` rewrites that module specifier to `./consensus-loop.mjs` in generated output.

**Tech Stack:** Node 22, TypeScript, esbuild, Vitest, pnpm, generated dependency-free `.mjs` plugin runtimes.

**Commit Convention:** `{type}({scope}): {description}`.

## Parallelism

Run sequentially. The phases all touch shared generated-output/build surfaces (`scripts/build-generated.mjs`, generated runtime outputs, validation guards, and plugin docs), so parallel worktrees would create avoidable merge risk.

## Phase 1: Core And Generated Runtime Substrate

### Task p01-t01: Add prompt-profile seam and exported loop types

**Files:**

- Modify: `src/consensus/core/consensus-loop.ts`
- Create/modify: `tests/consensus-evaluate-prompt-profile.test.ts`

**Step 1: Write test (RED)**

- Add a Vitest test that calls `runConsensusLoop` with mocked peer invocations and a `promptProfile`.
- Assert the custom parallel prompt builder is used for `parallel_revision`.
- Assert the no-profile path still uses the default prompt builders.
- Add type-level coverage for exported `PromptProfile`, prompt builder input types, `RunOptions`, loop records, and terminal status types.

Run: `pnpm exec vitest run tests/consensus-evaluate-prompt-profile.test.ts`
Expected: Fails because `promptProfile` and exported types do not exist yet.

**Step 2: Implement (GREEN)**

- Add `PromptProfile` and exported loop-facing types to the canonical loop source.
- Thread resolved prompt builders through alternating, parallel, and synthesis execution paths.
- Keep defaults equal to today's builders when no profile is supplied.

**Step 3: Refactor**

- Keep rubric/evaluation semantics out of the loop.
- Avoid changing generated runtime output by hand; regeneration happens in later tasks.

**Step 4: Verify**

Run: `pnpm exec vitest run tests/consensus-evaluate-prompt-profile.test.ts && pnpm run type-check`
Expected: Prompt-profile tests and type-check pass.

**Step 5: Commit**

```bash
git add src/consensus/core/consensus-loop.ts tests/consensus-evaluate-prompt-profile.test.ts
git commit -m "feat(p01-t01): add consensus loop prompt profile seam"
```

---

### Task p01-t02: Add evaluate schema assets with parity coverage

**Files:**

- Create: `plugins/consensus/skills/evaluate/schemas/verdict-alternating.schema.json`
- Create: `plugins/consensus/skills/evaluate/schemas/verdict-parallel.schema.json`
- Create: `plugins/consensus/skills/evaluate/schemas/synthesis.schema.json`
- Create: `tests/consensus-evaluate-schema-parity.test.ts`

**Step 1: Write test (RED)**

- Add a Vitest parity test comparing every evaluate schema asset to the canonical refine distribution schema asset.
- Assert all three schema filenames exist in both distribution trees.

Run: `pnpm exec vitest run tests/consensus-evaluate-schema-parity.test.ts`
Expected: Fails because evaluate schema assets are missing.

**Step 2: Implement (GREEN)**

- Copy the existing refine schema JSON assets into the evaluate distribution tree.
- Keep refine distribution schemas canonical for this item; do not introduce `src/consensus/core/schemas/` yet.

**Step 3: Refactor**

- Keep schema-copy behavior explicit in the test so manual drift cannot pass silently.

**Step 4: Verify**

Run: `pnpm exec vitest run tests/consensus-evaluate-schema-parity.test.ts`
Expected: Schema parity test passes.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/evaluate/schemas tests/consensus-evaluate-schema-parity.test.ts
git commit -m "test(p01-t02): guard evaluate schema parity"
```

---

### Task p01-t03: Generate evaluate loop runtime output

**Files:**

- Modify: `scripts/build-generated.mjs`
- Modify: `tests/generated-output-sync.test.mjs`
- Modify: `tests/repo-layout.test.mjs`
- Modify as needed: `.oxfmtrc.json`, `.oxlintrc.json`, `.lintstagedrc.mjs`, `.github/workflows/validate.yml`
- Create generated: `plugins/consensus/skills/evaluate/scripts/consensus-loop.mjs`

**Step 1: Write test (RED)**

- Extend generated-output tests to assert a `consensus-evaluate-loop` mapping from `src/consensus/core/consensus-loop.ts` to `plugins/consensus/skills/evaluate/scripts/consensus-loop.mjs`.
- Extend layout tests to require `plugins/consensus/skills/evaluate/scripts` and to keep asserting no `.ts` files under `plugins/consensus/skills`.

Run: `pnpm exec vitest run tests/generated-output-sync.test.mjs && node --test tests/repo-layout.test.mjs`
Expected: Fails because the mapping and generated output do not exist.

**Step 2: Implement (GREEN)**

- Add the evaluate loop mapping to `generatedOutputs`.
- Run `pnpm run build` to create the generated evaluate loop runtime.
- Add generated `.mjs` exclusions wherever PR #14 excludes generated consensus runtimes.

**Step 3: Refactor**

- Keep the generated output banner intact.
- Do not add a second sync script.

**Step 4: Verify**

Run: `pnpm run build:check && pnpm exec vitest run tests/generated-output-sync.test.mjs && node --test tests/repo-layout.test.mjs`
Expected: Generated loop output is in sync and layout guards pass.

**Step 5: Commit**

```bash
git add scripts/build-generated.mjs tests/generated-output-sync.test.mjs tests/repo-layout.test.mjs .oxfmtrc.json .oxlintrc.json .lintstagedrc.mjs .github/workflows/validate.yml plugins/consensus/skills/evaluate/scripts/consensus-loop.mjs
git commit -m "build(p01-t03): generate evaluate consensus loop runtime"
```

---

## Phase 2: Evaluate Wrapper Source And Output Contract

### Task p02-t01: Add canonical evaluate wrapper argument and prompt behavior

**Files:**

- Create: `src/consensus/evaluate/consensus-evaluate.ts`
- Create: `tests/consensus-evaluate-wrapper.test.ts`

**Step 1: Write test (RED)**

- Add Vitest coverage for parsing `<artifact> --rubric <path>` and standard consensus flags.
- Assert defaults: `shared_input`, `parallel_revision`, `minimal`.
- Assert unsupported `--cold-start independent_draft` is rejected with a clear message.
- For `independent_draft` rejection, use either an evaluate-level guard or the loop parser
  rejection, whichever gives a clear user-facing error with less duplicated mode logic.
- Assert evaluation prompt builders frame artifact and rubric as untrusted content and ask peers to produce an evaluation, not an artifact edit.

Run: `pnpm exec vitest run tests/consensus-evaluate-wrapper.test.ts`
Expected: Fails because the wrapper source does not exist.

**Step 2: Implement (GREEN)**

- Add canonical wrapper source under `src/consensus/evaluate/`.
- Import loop APIs through `../core/consensus-loop.js`, matching PR #14.
- Implement argument parsing, input reads, default resolution, and evaluation prompt builders.

**Step 3: Refactor**

- Keep wrapper-specific evaluation semantics out of `consensus-loop.ts`.
- Reuse refine wrapper helpers or patterns where behavior matches, without importing generated refine runtime.

**Step 4: Verify**

Run: `pnpm exec vitest run tests/consensus-evaluate-wrapper.test.ts && pnpm run type-check`
Expected: Wrapper behavior tests and type-check pass.

**Step 5: Commit**

```bash
git add src/consensus/evaluate/consensus-evaluate.ts tests/consensus-evaluate-wrapper.test.ts
git commit -m "feat(p02-t01): add consensus evaluate wrapper source"
```

---

### Task p02-t02: Implement run-state and final evaluation rendering

**Files:**

- Modify: `src/consensus/evaluate/consensus-evaluate.ts`
- Create: `tests/consensus-evaluate-output.test.ts`

**Step 1: Write test (RED)**

- Add Vitest tests with mocked peer invocations for:
  - wrapper passes `--output-records`, `--output-section`, and `--output-status`
  - final artifact includes unified findings
  - final artifact embeds canonical per-record `consensus-verdict` blocks
  - `IMPASSE` / escalation status renders `## Unresolved dissent`
  - `CONVERGED` status renders or omits `## Dissent` based on residual concerns

Run: `pnpm exec vitest run tests/consensus-evaluate-output.test.ts`
Expected: Fails because output rendering is incomplete.

**Step 2: Implement (GREEN)**

- Allocate the evaluate run directory and state files using the same confinement/path-safety approach as refine.
- Render final evaluation markdown from section output, records, and status.
- Preserve peer reasoning, critique, and verdicts verbatim in embedded record blocks.

**Step 3: Refactor**

- Keep final rendering deterministic and testable with mocked loop records.

**Step 4: Verify**

Run: `pnpm exec vitest run tests/consensus-evaluate-output.test.ts tests/consensus-evaluate-wrapper.test.ts`
Expected: Evaluate wrapper and output tests pass.

**Step 5: Commit**

```bash
git add src/consensus/evaluate/consensus-evaluate.ts tests/consensus-evaluate-output.test.ts
git commit -m "feat(p02-t02): render consensus evaluate output"
```

---

### Task p02-t03: Generate evaluate wrapper runtime with PR #14 import rewrite

**Files:**

- Modify: `scripts/build-generated.mjs`
- Modify: `tests/generated-output-sync.test.mjs`
- Create: `tests/generated-consensus-evaluate-import.test.ts`
- Create generated: `plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs`

**Step 1: Write test (RED)**

- Add a generated-import Vitest test asserting the generated evaluate wrapper imports `./consensus-loop.mjs` and does not contain `../core/`.
- Extend generated-output sync tests to assert the evaluate wrapper source/output mapping.

Run: `pnpm exec vitest run tests/generated-consensus-evaluate-import.test.ts tests/generated-output-sync.test.mjs`
Expected: Fails because the mapping and generated wrapper do not exist.

**Step 2: Implement (GREEN)**

- Add the evaluate wrapper mapping:
  - `source: 'src/consensus/evaluate/consensus-evaluate.ts'`
  - `output: 'plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs'`
  - `importRewrites: [{ from: '../core/consensus-loop.js', to: './consensus-loop.mjs' }]`
- Run `pnpm run build`.

**Step 3: Refactor**

- Confirm rewrite behavior comes from the parser-based `rewriteImportSpecifiers` helper shipped in PR #14.

**Step 4: Verify**

Run: `pnpm run build:check && pnpm exec vitest run tests/generated-consensus-evaluate-import.test.ts tests/generated-output-sync.test.mjs`
Expected: Generated evaluate wrapper imports the sibling loop runtime and drift checks pass.

**Step 5: Commit**

```bash
git add scripts/build-generated.mjs tests/generated-output-sync.test.mjs tests/generated-consensus-evaluate-import.test.ts plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs
git commit -m "build(p02-t03): generate consensus evaluate wrapper"
```

---

## Phase 3: Distribution, Documentation, And Verification

### Task p03-t01: Register consensus-evaluate in plugin distribution surfaces

**Files:**

- Create: `plugins/consensus/skills/evaluate/SKILL.md`
- Create/modify: `plugins/consensus/skills/evaluate/references/*`
- Modify: `plugins/consensus/.claude-plugin/*`
- Modify: `plugins/consensus/.codex-plugin/*`
- Modify: `plugins/consensus/.cursor-plugin/*`
- Modify: validation tests as needed

**Step 1: Write test (RED)**

- Extend manifest/docs presence tests to require the evaluate skill directory, `SKILL.md`, generated scripts, schemas, and provider manifest entries.

Run: `node --test tests/docs-presence.test.mjs tests/package-metadata.test.mjs`
Expected: Fails because evaluate is not registered.

**Step 2: Implement (GREEN)**

- Add evaluate `SKILL.md`, references, and provider manifest registrations.
- Keep shipped skill runtime dependency-free.

**Step 3: Refactor**

- Keep documentation user-facing and concise; avoid stale deferred-language once shipped.

**Step 4: Verify**

Run: `pnpm run validate`
Expected: Manifest and docs invariants pass.
Note: targeted docs-presence tests prove RED/GREEN locally; `pnpm run validate` remains the
authoritative manifest/docs gate.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/evaluate plugins/consensus/.claude-plugin plugins/consensus/.codex-plugin plugins/consensus/.cursor-plugin tests
git commit -m "docs(p03-t01): register consensus evaluate skill"
```

---

### Task p03-t02: Update README and OAT reference status

**Files:**

- Modify: `README.md`
- Modify: `plugins/consensus/README.md`
- Modify: `.oat/repo/reference/current-state.md`
- Modify: `.oat/repo/reference/roadmap.md`
- Modify: `.oat/repo/reference/backlog/items/add-consensus-evaluate-skill.md`
- Modify as needed: `.oat/repo/reference/backlog/index.md`

**Step 1: Write test (RED)**

- Extend docs/reference tests if they assert family skill status or backlog index consistency.
- Otherwise record a targeted `rg` check for stale "deferred" references.

Run: `rg -n "consensus-evaluate|deferred" README.md plugins/consensus/README.md .oat/repo/reference`
Expected: Shows stale or incomplete evaluate status before edits.

**Step 2: Implement (GREEN)**

- List `consensus-evaluate` as shipped where the plugin family is documented.
- Mark bl-5174 delivered and refresh current state / roadmap language.
- Regenerate or manually align backlog index if the repo convention requires it.

**Step 3: Refactor**

- Remove stale workaround/waiting language tied to pre-PR #14 sequencing.

**Step 4: Verify**

Run: `pnpm run validate` and `rg -n "wait for|deferred|not shipped" README.md plugins/consensus/README.md .oat/repo/reference`
Expected: Validation passes; any remaining `rg` matches are unrelated or intentionally historical.

**Step 5: Commit**

```bash
git add README.md plugins/consensus/README.md .oat/repo/reference
git commit -m "docs(p03-t02): mark consensus evaluate shipped"
```

---

### Task p03-t03: Run final verification and capture project completion state

**Files:**

- Modify: `.oat/projects/shared/consensus-evaluate/implementation.md`
- Modify: `.oat/projects/shared/consensus-evaluate/state.md`
- Modify/create: `.oat/projects/shared/consensus-evaluate/summary.md`
- Modify as needed: `CHANGELOG.md`

**Step 1: Write test (RED)**

- No new product test. Confirm all targeted tests from earlier phases are in the suite and fail if generated output is stale.

Run: `pnpm run build:check`
Expected: Passes only when generated outputs are current.

**Step 2: Implement (GREEN)**

- Run final gates:
  - `pnpm run build`
  - `pnpm run build:check`
  - `pnpm run type-check`
  - `pnpm test`
  - `pnpm run validate`
  - `pnpm run smoke`
- Record implementation results, review status, docs status, and any known caveats in OAT artifacts.

**Step 3: Refactor**

- If generated files changed during verification, commit the source plus generated outputs together.

**Step 4: Verify**

Run: `git diff --check && git status --short`
Expected: No whitespace errors; only intentional final OAT/docs changes remain before commit.

**Step 5: Commit**

```bash
git add .oat/projects/shared/consensus-evaluate CHANGELOG.md
git commit -m "chore(consensus-evaluate): record implementation completion"
```

---

## Phase 4: Final Review Fixes

### Task p04-t01: (review) Escape evaluation draft prompt data

**Status:** completed
**Commit:** 5c2e1cc

**Files:**

- Modify: `src/consensus/evaluate/consensus-evaluate.ts`
- Modify: `tests/consensus-evaluate-wrapper.test.ts`
- Regenerate: `plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs`

**Step 1: Understand the issue**

Review finding: rubric-derived headings/bullets can include delimiter text such as
`</EVALUATION_DRAFT>` and later appear inside the evaluation-draft prompt block, weakening the
untrusted-content boundary.
Location: `src/consensus/evaluate/consensus-evaluate.ts:702`

**Step 2: Implement fix**

Sanitize or delimiter-escape evaluation draft data before it is embedded in prompt blocks,
including rubric-derived seed content and previous peer drafts. Preserve reviewer-visible text
as data rather than executable prompt markup.

**Step 3: Verify**

Run: `pnpm exec vitest run tests/consensus-evaluate-wrapper.test.ts && pnpm run build && pnpm run build:check`
Expected: prompt delimiter regression coverage passes and generated output remains in sync.

**Step 4: Commit**

```bash
git add src/consensus/evaluate/consensus-evaluate.ts tests/consensus-evaluate-wrapper.test.ts plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs
git commit -m "fix(p04-t01): escape evaluation draft prompt data"
```

---

### Task p04-t02: (review) Align evaluate provider preflight docs

**Status:** completed
**Commit:** b793cee

**Files:**

- Modify: `plugins/consensus/skills/evaluate/SKILL.md`

**Step 1: Understand the issue**

Review finding: evaluate skill docs claim wrapper-level `paseo provider ls --json` preflight and
`PEER_UNAVAILABLE` behavior, but the evaluate wrapper does not implement the refine preflight
path.
Location: `plugins/consensus/skills/evaluate/SKILL.md:20`

**Step 2: Implement fix**

Either implement refine-equivalent provider/synthesizer preflight for evaluate, or revise the
evaluate skill docs so provider inventory checks are described as host/operator setup rather
than wrapper behavior. Prefer the smallest accurate fix unless implementation needs the
behavioral preflight for product correctness.

**Step 3: Verify**

Run: `pnpm run validate && rg -n "PEER_UNAVAILABLE|provider ls" plugins/consensus/skills/evaluate/SKILL.md`
Expected: validation passes and any remaining preflight wording accurately reflects shipped
evaluate behavior.

**Step 4: Commit**

```bash
git add plugins/consensus/skills/evaluate/SKILL.md
git commit -m "docs(p04-t02): align evaluate preflight docs"
```

---

### Task p04-t03: (review) Add evaluate path-confinement negative coverage

**Status:** completed
**Commit:** 415cb51

**Files:**

- Modify: `tests/path-safety.test.ts`

**Step 1: Understand the issue**

Review finding: path-safety tests import only the shipped refine runtime, while evaluate ships
its own path-confinement helpers. Evaluate can regress outside-root and symlink rejection
without failing the existing suite.
Location: `tests/path-safety.test.ts:16`

**Step 2: Implement fix**

Parameterize path-safety coverage over refine and evaluate generated runtimes, or add
evaluate-specific tests for outside-root output paths, symlink targets, and symlink parent
escapes.

**Step 3: Verify**

Run: `pnpm test && pnpm run build:check`
Expected: path-safety coverage passes for evaluate and generated output remains in sync.

**Step 4: Commit**

```bash
git add tests/path-safety.test.ts
git commit -m "test(p04-t03): cover evaluate path confinement"
```

---

## Reviews

| Scope  | Type     | Status  | Date | Artifact |
| ------ | -------- | ------- | ---- | -------- |
| p01    | code     | passed | 2026-06-17 | reviews/archived/p01-review-2026-06-17.md |
| p02    | code     | passed | 2026-06-17 | reviews/archived/p02-review-2026-06-17-v4.md |
| p03    | code     | passed | 2026-06-17 | reviews/archived/p03-review-2026-06-17-v2.md |
| final  | code     | fixes_completed | 2026-06-18 | reviews/archived/final-review-2026-06-17.md |
| spec   | artifact | pending | -    | -        |
| design | artifact | pending | -    | -        |
| plan   | artifact | passed | 2026-06-17 | reviews/archived/artifact-plan-review-2026-06-16.md |

**Status values:** `pending` → `received` → `fixes_added` → `fixes_completed` → `passed`

**Meaning:**

- `received`: review artifact exists (not yet converted into fix tasks)
- `fixes_added`: fix tasks were added to the plan (work queued)
- `fixes_completed`: fix tasks implemented, awaiting re-review
- `passed`: re-review run and recorded as passing (no Critical/Important)

---

## Implementation Complete

**Summary:**

- Phase 1: 3 tasks - Core prompt-profile seam, schema parity, and generated evaluate loop runtime.
- Phase 2: 3 tasks - Canonical evaluate wrapper, output rendering, and generated wrapper runtime.
- Phase 3: 3 tasks - Plugin distribution registration, docs/reference updates, and final verification.
- Phase 4: 3 tasks - Final review fixes for prompt safety, docs accuracy, and path-safety coverage.

**Total: 12 tasks**

Final review fixes are queued for implementation.

---

## References

- Design: `design.md`
- Discovery: `discovery.md`
- Backlog item: `.oat/repo/reference/backlog/items/add-consensus-evaluate-skill.md`
- PR #14 convention: `scripts/build-generated.mjs`, `src/consensus/refine/consensus-refine.ts`, `tests/generated-consensus-refine-import.test.ts`
- Decision records: `.oat/repo/reference/decision-record.md` DR-020 and DR-021
