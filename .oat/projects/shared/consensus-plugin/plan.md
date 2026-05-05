---
oat_plan_source: spec-driven
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-05-04
oat_phase: plan
oat_phase_status: complete
oat_plan_parallel_groups: []
oat_plan_hill_phases: ["p07"]
oat_auto_review_at_hill_checkpoints: true
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
oat_template: false
---

# Implementation Plan: consensus-plugin

> Execute this plan using `oat-project-implement`. Sequential execution is the default. `oat-project-implement` will confirm HiLL checkpoints before starting and write `oat_plan_hill_phases` then.

**Goal:** Ship v0.1 of the `consensus` plugin: a portable, multi-provider `consensus-refine` skill that runs alternating Claude/Codex-style deliberation through Paseo, produces a deliberation artifact, supports sequential and host-mediated parallel section orchestration, and validates the repository's plugin distribution invariants.

**Architecture:** The repo has standalone personal skills at top-level `skills/` and a self-contained plugin package at `plugins/consensus/`. The `consensus-refine` skill contains `SKILL.md`, `consensus-refine.mjs` as the wrapper/orchestrator, and `consensus-loop.mjs` as the deterministic per-turn loop engine.

**Tech Stack:** Node.js >= 20, ESM `.mjs`, Node stdlib only, `node --test`, GitHub Actions, Paseo CLI as an external subprocess.

**Commit Convention:** `{type}({task-id}): {description}` - for example, `feat(p02-t04): invoke paseo from loop engine`.

## Planning Checklist

- [x] Defer HiLL checkpoint confirmation to oat-project-implement
- [x] Evaluated phases for parallelism opportunities
- [x] Set `oat_plan_parallel_groups` in frontmatter

## Parallelism

Implementation phases are sequential for v0.1. The phases share generated repo structure, validation helpers, scripts, docs, and fixtures, so no phase pair is cleanly file-disjoint enough to declare `oat_plan_parallel_groups`.

## Phase 1: Repository Scaffolding and Distribution Metadata

Goal: establish the public repo shape, plugin/marketplace manifests, baseline docs, and structural validation pipeline before implementing runtime behavior.

### Task p01-t01: Add Node Project Metadata and Test Harness

**Files:**

- Create: `package.json`
- Create: `tests/fixtures/.gitkeep`
- Create: `tests/helpers/.gitkeep`
- Create: `.gitignore`

**Step 1: Write test (RED)**

Create `tests/package-metadata.test.mjs` with assertions that `package.json` exists, is private, declares `type: "module"`, uses Node >= 20, and exposes `test`, `validate`, and `smoke` scripts.

Run: `node --test tests/package-metadata.test.mjs`
Expected: Test fails because `package.json` does not exist.

**Step 2: Implement (GREEN)**

Create minimal package metadata with stdlib-only scripts:

- `test`: `node --test`
- `validate`: `node scripts/validate.mjs`
- `smoke`: `node scripts/smoke-test.mjs`

Create empty fixture/helper directories and ignore runtime outputs such as `.consensus/`, `node_modules/`, and temporary test output.

**Step 3: Refactor**

Keep the package dependency-free; do not add build tooling.

**Step 4: Verify**

Run: `node --test tests/package-metadata.test.mjs`
Expected: Test passes.

**Step 5: Commit**

```bash
git add package.json tests/fixtures/.gitkeep tests/helpers/.gitkeep .gitignore
git commit -m "chore(p01-t01): add node test harness"
```

### Task p01-t02: Create Self-Contained Plugin Directory Structure

**Files:**

- Create: `skills/.gitkeep`
- Create: `plugins/consensus/skills/consensus-refine/scripts/.gitkeep`
- Create: `plugins/consensus/agents/.gitkeep`
- Create: `scripts/.gitkeep`

**Step 1: Write test (RED)**

Create `tests/repo-layout.test.mjs` that asserts the top-level standalone `skills/` directory exists and `plugins/consensus/` owns its `skills/`, `agents/`, and provider plugin directories.

Run: `node --test tests/repo-layout.test.mjs`
Expected: Test fails because directories are missing.

**Step 2: Implement (GREEN)**

Create the expected directories with `.gitkeep` placeholders only. Do not add runtime logic yet.

**Step 3: Refactor**

Keep OAT directories out of the plugin package path.

**Step 4: Verify**

Run: `node --test tests/repo-layout.test.mjs`
Expected: Test passes.

**Step 5: Commit**

```bash
git add skills plugins/consensus scripts tests/repo-layout.test.mjs
git commit -m "chore(p01-t02): create consensus plugin layout"
```

### Task p01-t03: Add Provider Plugin Manifests

**Files:**

- Create: `plugins/consensus/.claude-plugin/plugin.json`
- Create: `plugins/consensus/.cursor-plugin/plugin.json`
- Create: `plugins/consensus/.codex-plugin/plugin.json`
- Create: `tests/plugin-manifests.test.mjs`

**Step 1: Write test (RED)**

Test that each provider `plugin.json` parses, has name `consensus`, version `0.1.0`, references `./skills/consensus-refine` under plugin root, and declares the provider-specific Bash/exec permission shape needed to run `node` and `paseo`.

Run: `node --test tests/plugin-manifests.test.mjs`
Expected: Test fails because manifests do not exist.

**Step 2: Implement (GREEN)**

Create the three provider manifests with provider-specific metadata kept inside each manifest. Codex manifest includes its interface metadata placeholder per design; Claude/Cursor include only supported fields verified by schema assumptions. Document any provider whose permission declaration is provisional so p04-t08 can verify it against the live runtime before release.

**Step 3: Refactor**

Keep all skill paths plugin-root-relative. Do not use `../` traversal. Add a release-checklist note that Codex skill path syntax must be verified with local Codex plugin installation before tagging v0.1.

**Step 4: Verify**

Run: `node --test tests/plugin-manifests.test.mjs`
Expected: Test passes.

**Step 5: Commit**

```bash
git add plugins/consensus/.claude-plugin/plugin.json plugins/consensus/.cursor-plugin/plugin.json plugins/consensus/.codex-plugin/plugin.json tests/plugin-manifests.test.mjs
git commit -m "feat(p01-t03): add consensus provider manifests"
```

### Task p01-t04: Add Repo-Root Marketplace Entries

**Files:**

- Create: `.claude-plugin/marketplace.json`
- Create: `.cursor-plugin/marketplace.json`
- Create: `.agents/plugins/marketplace.json`
- Create: `tests/marketplace-manifests.test.mjs`

**Step 1: Write test (RED)**

Test that each marketplace file parses and declares `plugins/consensus` using `source.path: "./plugins/consensus"` without escaping repo root.

Run: `node --test tests/marketplace-manifests.test.mjs`
Expected: Test fails because marketplace files do not exist.

**Step 2: Implement (GREEN)**

Create repo-root marketplace files for Claude, Cursor, and Codex discovery. Include version fields only where the selected marketplace shape supports or tolerates them.

**Step 3: Refactor**

Normalize marketplace path checks to avoid hard-coded absolute paths in tests.

**Step 4: Verify**

Run: `node --test tests/marketplace-manifests.test.mjs`
Expected: Test passes.

**Step 5: Commit**

```bash
git add .claude-plugin/marketplace.json .cursor-plugin/marketplace.json .agents/plugins/marketplace.json tests/marketplace-manifests.test.mjs
git commit -m "feat(p01-t04): add plugin marketplace entries"
```

### Task p01-t05: Add Skill and Section-Runner Instruction Artifacts

**Files:**

- Create: `plugins/consensus/skills/consensus-refine/SKILL.md`
- Create: `plugins/consensus/agents/consensus-section-runner.md`
- Create: `tests/skill-frontmatter.test.mjs`

**Step 1: Write test (RED)**

Test that `SKILL.md` has frontmatter fields `name`, `description`, `license`, `compatibility`, additive `allowed-tools`, and metadata version `0.1.0`; also verify the folder name matches `name`.

Run: `node --test tests/skill-frontmatter.test.mjs`
Expected: Test fails because `SKILL.md` does not exist.

**Step 2: Implement (GREEN)**

Write `SKILL.md` with the host LLM responsibilities from design: wrapper invocation, JSONL interpretation, parallel prepare/dispatch/fan-in, Codex authorization fail-closed, and impasse surfacing. Write `consensus-section-runner.md` with the bounded parallel section task packet contract.

**Step 3: Refactor**

Keep deterministic mechanics in script references, not in natural-language pseudo-implementation.

**Step 4: Verify**

Run: `node --test tests/skill-frontmatter.test.mjs`
Expected: Test passes.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/consensus-refine/SKILL.md plugins/consensus/agents/consensus-section-runner.md tests/skill-frontmatter.test.mjs
git commit -m "feat(p01-t05): add consensus refine skill instructions"
```

### Task p01-t06: Add Baseline Project Documentation

**Files:**

- Create: `README.md`
- Create: `LICENSE`
- Create: `CHANGELOG.md`
- Create: `CONTRIBUTING.md`
- Create: `RELEASING.md`
- Create/Modify: `CLAUDE.md`

**Step 1: Write test (RED)**

Create `tests/docs-presence.test.mjs` asserting required docs exist, README has an Install Matrix, README has Permissions and Limitations sections, LICENSE is MIT, CHANGELOG has `0.1.0` unreleased, and `CLAUDE.md` is a symlink to `AGENTS.md`.

Run: `node --test tests/docs-presence.test.mjs`
Expected: Test fails because docs are missing.

**Step 2: Implement (GREEN)**

Write concise docs matching the design scope. Create `CLAUDE.md` as a symlink to `AGENTS.md`.

**Step 3: Refactor**

Keep marketplace submission claims provisional where docs require release-time verification.

**Step 4: Verify**

Run: `node --test tests/docs-presence.test.mjs`
Expected: Test passes.

**Step 5: Commit**

```bash
git add README.md LICENSE CHANGELOG.md CONTRIBUTING.md RELEASING.md CLAUDE.md tests/docs-presence.test.mjs
git commit -m "docs(p01-t06): add release and install documentation"
```

### Task p01-t07: Implement Structural Validator and CI Workflows

**Files:**

- Create: `scripts/validate.mjs`
- Create: `tests/validate-script.test.mjs`
- Create: `.github/workflows/validate.yml`
- Create: `.github/workflows/release.yml`

**Step 1: Write test (RED)**

Test exported validator responsibilities: frontmatter parsing, JSON parsing, skill path existence, marketplace source path confinement, version consistency for plugin manifests, and README Install Matrix detection.

Run: `node --test tests/validate-script.test.mjs`
Expected: Test fails because `scripts/validate.mjs` does not exist.

**Step 2: Implement (GREEN)**

Implement `scripts/validate.mjs` as stdlib-only ESM with an exported validation function and CLI entrypoint. Add read-only `validate.yml` and tag-triggered `release.yml` with `contents: write` only.

**Step 3: Refactor**

Make validation messages actionable and deterministic for CI.

**Step 4: Verify**

Run: `node --test tests/validate-script.test.mjs && node scripts/validate.mjs`
Expected: Tests and validator pass.

**Step 5: Commit**

```bash
git add scripts/validate.mjs tests/validate-script.test.mjs .github/workflows/validate.yml .github/workflows/release.yml
git commit -m "feat(p01-t07): add structural validation pipeline"
```

## Phase 2: Sequential Wrapper and Loop Core

Goal: make `consensus-refine` run end-to-end on markdown with mocked Paseo peers in sequential mode.

### Task p02-t01: Implement Hash Normalization and Convergence Helpers

**Files:**

- Create: `plugins/consensus/skills/consensus-refine/scripts/consensus-loop.mjs`
- Create: `tests/loop-convergence.test.mjs`

**Step 1: Write test (RED)**

Test line-ending normalization, trailing whitespace trimming, EOF newline collapse, SHA-256 hash format, hash-match convergence, double-ACCEPT same-hash convergence, and 4+ state oscillation detection.

Run: `node --test tests/loop-convergence.test.mjs`
Expected: Test fails because exports are missing.

**Step 2: Implement (GREEN)**

Export helper signatures from `consensus-loop.mjs`:

- `normalizeForHash(text, options)`
- `hashArtifact(text, options)`
- `detectConvergence(records, options)`
- `detectOscillation(records)`

**Step 3: Refactor**

Keep agency-specific branching in data-driven helper options.

**Step 4: Verify**

Run: `node --test tests/loop-convergence.test.mjs`
Expected: Test passes.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/consensus-refine/scripts/consensus-loop.mjs tests/loop-convergence.test.mjs
git commit -m "feat(p02-t01): add convergence helpers"
```

### Task p02-t02: Implement Verdict Schema and Byte-Cap Validation

**Files:**

- Create: `plugins/consensus/skills/consensus-refine/schemas/verdict-alternating.schema.json`
- Modify: `plugins/consensus/skills/consensus-refine/scripts/consensus-loop.mjs`
- Create: `tests/verdict-validation.test.mjs`

**Step 1: Write test (RED)**

Test ACCEPT/REVISE/IMPASSE schema branches, `schema_version: "v0"`, rejection of additional properties, UTF-8 byte caps for reasoning/proposed artifact/concerns, and `OVERSIZE_REJECTED` metadata shape.

Run: `node --test tests/verdict-validation.test.mjs`
Expected: Test fails because schema and validators are missing.

**Step 2: Implement (GREEN)**

Add schema JSON without `maxLength` constraints. Export `validateVerdictShape(verdict)` and `validateVerdictCaps(verdict)` from the loop script.

**Step 3: Refactor**

Keep cap constants grouped and named for Section 5 traceability.

**Step 4: Verify**

Run: `node --test tests/verdict-validation.test.mjs`
Expected: Test passes.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/consensus-refine/schemas/verdict-alternating.schema.json plugins/consensus/skills/consensus-refine/scripts/consensus-loop.mjs tests/verdict-validation.test.mjs
git commit -m "feat(p02-t02): validate peer verdicts"
```

### Task p02-t03: Implement Write-Through Records and Status Output

**Files:**

- Modify: `plugins/consensus/skills/consensus-refine/scripts/consensus-loop.mjs`
- Create: `tests/loop-records.test.mjs`

**Step 1: Write test (RED)**

Test JSON-array write-through behavior, fsync-on-append where available, status JSON schema fields, preservation of optional `raw_paseo_response`, cost reporting branches (`cost_source: "paseo" | "estimated" | "unavailable"`), and recovery-friendly behavior when a process stops after writing one record.

Run: `node --test tests/loop-records.test.mjs`
Expected: Test fails because record writer is missing.

**Step 2: Implement (GREEN)**

Export `createRecordsWriter(path)` and `writeLoopStatus(path, status)`. Ensure records are valid JSON arrays after close, optional debug fields are not stripped, cost metadata is normalized into loop status, and intermediate writes are durable enough for resume tests.

**Step 3: Refactor**

Centralize timestamp and schema-version assignment.

**Step 4: Verify**

Run: `node --test tests/loop-records.test.mjs`
Expected: Test passes.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/consensus-refine/scripts/consensus-loop.mjs tests/loop-records.test.mjs
git commit -m "feat(p02-t03): write loop records incrementally"
```

### Task p02-t04: Add Paseo Invocation and Stub Harness

**Files:**

- Modify: `plugins/consensus/skills/consensus-refine/scripts/consensus-loop.mjs`
- Create: `tests/fixtures/bin/paseo`
- Create: `tests/paseo-invocation.test.mjs`

**Step 1: Write test (RED)**

Test that the loop invokes `paseo run --provider <peer> --output-schema <schema> --json <prompt>` via `spawn` array form, enforces `SUBPROCESS_OUTPUT_CAP_BYTES = 10 * 1024 * 1024` on stdout/stderr with a boundary case at 10 MB + 1 byte, parses JSON output, and propagates non-zero exit as a hard error.

Run: `node --test tests/paseo-invocation.test.mjs`
Expected: Test fails because invocation helper and stub are missing.

**Step 2: Implement (GREEN)**

Add `invokePaseo({ provider, schemaPath, prompt, env, cwd })`, the 10 MB subprocess output cap constant, and a deterministic `paseo` fixture binary with canned responses.

**Step 3: Refactor**

Keep stub behavior data-driven via fixture files or environment variables, not hard-coded per test case.

**Step 4: Verify**

Run: `node --test tests/paseo-invocation.test.mjs`
Expected: Test passes.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/consensus-refine/scripts/consensus-loop.mjs tests/fixtures/bin/paseo tests/paseo-invocation.test.mjs
git commit -m "feat(p02-t04): invoke paseo safely"
```

### Task p02-t05: Implement Alternating Loop CLI

**Files:**

- Modify: `plugins/consensus/skills/consensus-refine/scripts/consensus-loop.mjs`
- Create: `tests/consensus-loop-cli.test.mjs`

**Step 1: Write test (RED)**

Test CLI parsing for `--section-file`, `--goal`, `--peers`, `--max-rounds`, `--agency`, and output paths. Cover convergence, explicit impasse, max-rounds, oscillation, and non-zero hard error cases using the Paseo stub.

Run: `node --test tests/consensus-loop-cli.test.mjs`
Expected: Test fails because CLI entrypoint is incomplete.

**Step 2: Implement (GREEN)**

Add `runConsensusLoop(argv, options)` and CLI entrypoint behavior. Emit output files exactly as the design describes and exit non-zero only for hard errors.

**Step 3: Refactor**

Keep prompt construction isolated in `buildTurnPrompt(...)` so injection framing is testable.

**Step 4: Verify**

Run: `node --test tests/consensus-loop-cli.test.mjs`
Expected: Test passes.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/consensus-refine/scripts/consensus-loop.mjs tests/consensus-loop-cli.test.mjs
git commit -m "feat(p02-t05): implement alternating loop cli"
```

### Task p02-t06: Implement Wrapper Arg Parsing, Host Detection, and Peer Preflight

**Files:**

- Create: `plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs`
- Create: `tests/wrapper-options.test.mjs`

**Step 1: Write test (RED)**

Test argv parsing for sequential flags, host-aware default peers, `--peers` validation, `--max-rounds` bounds, `--agency` values, `--prepare-parallel`, `--fan-in`, peer inventory from `paseo provider ls --json`, and `paseo --version` parsing against a tested version range (`MIN_PASEO_VERSION` / `MAX_TESTED_PASEO_VERSION`) that emits a structured warning when out of range.

Run: `node --test tests/wrapper-options.test.mjs`
Expected: Test fails because wrapper exports are missing.

**Step 2: Implement (GREEN)**

Export `parseWrapperArgs(argv)`, `detectHost(env)`, `resolvePeers(options, host, providerInventory)`, and `preflightPaseo(options)`. `preflightPaseo` checks both provider inventory and Paseo version, warning but not hard-failing when the installed version is outside the documented tested range.

**Step 3: Refactor**

Keep remediation messages structured for JSONL and stderr renderers.

**Step 4: Verify**

Run: `node --test tests/wrapper-options.test.mjs`
Expected: Test passes.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs tests/wrapper-options.test.mjs
git commit -m "feat(p02-t06): parse wrapper options and peers"
```

### Task p02-t07: Implement Markdown Section Parsing

**Files:**

- Modify: `plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs`
- Create: `tests/section-parser.test.mjs`

**Step 1: Write test (RED)**

Test heading-based sections, explicit `<!-- section: name -->` markers, single-section fallback, stable section IDs, original index ordering, and preservation of section markdown.

Run: `node --test tests/section-parser.test.mjs`
Expected: Test fails because section parser is missing.

**Step 2: Implement (GREEN)**

Export `parseSections(markdown)` and `slugSectionId(name, index)`.

**Step 3: Refactor**

Keep parser behavior deterministic and independent from filesystem access.

**Step 4: Verify**

Run: `node --test tests/section-parser.test.mjs`
Expected: Test passes.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs tests/section-parser.test.mjs
git commit -m "feat(p02-t07): parse markdown sections"
```

### Task p02-t08: Implement Path Safety and Atomic Writes

**Files:**

- Modify: `plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs`
- Create: `tests/path-safety.test.mjs`

**Step 1: Write test (RED)**

Test unrestricted input reads with size cap, run-dir confinement, default output next to readable input, explicit `--output` under CWD/`--allow-root`, symlink target rejection, and temp-file-then-rename writes.

Run: `node --test tests/path-safety.test.mjs`
Expected: Test fails because path helpers are missing.

**Step 2: Implement (GREEN)**

Export `confineWrite(targetPath, rootPath)`, `atomicWriteFile(path, contents)`, `resolveRunDir(options)`, and `resolveOutputPath(options, inputPath)`.

**Step 3: Refactor**

Use crypto-random temp suffixes and avoid creating directories before confinement checks.

**Step 4: Verify**

Run: `node --test tests/path-safety.test.mjs`
Expected: Test passes.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs tests/path-safety.test.mjs
git commit -m "feat(p02-t08): enforce path safety"
```

### Task p02-t09: Implement Sequential Orchestration and Artifact Rendering

**Files:**

- Modify: `plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs`
- Create: `tests/fixtures/sample-input.md`
- Create: `tests/sequential-wrapper.test.mjs`

**Step 1: Write test (RED)**

Test a three-section markdown input with the Paseo stub: wrapper creates run files, invokes the loop per section, assembles Final Output, Resolution, Goal, per-section logs, canonical JSON blocks, and sanitized prose logs.

Run: `node --test tests/sequential-wrapper.test.mjs`
Expected: Test fails because orchestration and rendering are missing.

**Step 2: Implement (GREEN)**

Add `runSequential(options)` and `renderDeliberationArtifact(runResult)`. Implement dynamic backtick fences, heading containment, script/style stripping in prose only, and canonical JSON preservation.

**Step 3: Refactor**

Keep renderer pure where possible so artifact shape tests can call it directly.

**Step 4: Verify**

Run: `node --test tests/sequential-wrapper.test.mjs`
Expected: Test passes.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs tests/fixtures/sample-input.md tests/sequential-wrapper.test.mjs
git commit -m "feat(p02-t09): orchestrate sequential refinement"
```

### Task p02-t10: Implement JSONL Progress and Error Handling

**Files:**

- Modify: `plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs`
- Modify: `plugins/consensus/skills/consensus-refine/scripts/consensus-loop.mjs`
- Create: `tests/error-handling.test.mjs`

**Step 1: Write test (RED)**

Test stdout JSONL shape, stderr human text, exit codes 64/65/73/74/77/78/130 where unit-testable, `--fail-on-section-error`, and section-level error aggregation without aborting unrelated sections.

Run: `node --test tests/error-handling.test.mjs`
Expected: Test fails because error channel behavior is incomplete.

**Step 2: Implement (GREEN)**

Add structured event helpers and error classes/codes. Ensure wrapper exits 0 for normal terminal states unless `--fail-on-section-error` applies.

**Step 3: Refactor**

Keep stack traces out of stdout and reserve trace logging for explicit `CONSENSUS_LOG=trace`.

**Step 4: Verify**

Run: `node --test tests/error-handling.test.mjs`
Expected: Test passes.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs plugins/consensus/skills/consensus-refine/scripts/consensus-loop.mjs tests/error-handling.test.mjs
git commit -m "feat(p02-t10): add structured error handling"
```

### Task p02-t11: (review) Fix fail-on-section-error aggregation semantics

**Files:**

- Modify: `plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs`
- Modify: `tests/error-handling.test.mjs`

**Step 1: Understand the issue**

Review finding: `--fail-on-section-error` currently throws inside the per-section catch path, so later sections are skipped and the partial artifact is not rendered. The flag also does not convert completed `impasse` sections to exit 74.
Location: `plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs:799`

**Step 2: Implement fix**

Always collect all section results and write the artifact first. After aggregation, if `failOnSectionError` is set and any section ended in `error` or `impasse`, return or throw a `SECTION_ERROR` with exit 74 while preserving the output path/run directory in the structured event.

**Step 3: Verify**

Run: `node --test tests/error-handling.test.mjs`
Expected: Test passes, including regressions that a hard-error section still processes later sections and writes the artifact, and that explicit IMPASSE with `--fail-on-section-error` exits 74.

**Step 4: Commit**

```bash
git add plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs tests/error-handling.test.mjs
git commit -m "fix(p02-t11): honor fail-on-section-error aggregation"
```

### Task p02-t12: (review) Render canonical artifact state containers

**Files:**

- Modify: `plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs`
- Modify: `tests/sequential-wrapper.test.mjs`

**Step 1: Understand the issue**

Review finding: `renderDeliberationArtifact` emits visible JSON blocks instead of the designed frontmatter plus HTML-commented canonical JSON blocks, and heading containment for prose logs remains deferred.
Location: `plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs:693`

**Step 2: Implement fix**

Update the renderer to emit the designed canonical-state container shape while keeping the human-readable artifact useful. Add heading-prefix containment for rendered prose logs so section content cannot escape its intended artifact hierarchy.

**Step 3: Verify**

Run: `node --test tests/sequential-wrapper.test.mjs`
Expected: Test passes and asserts frontmatter/commented canonical JSON state blocks plus heading containment.

**Step 4: Commit**

```bash
git add plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs tests/sequential-wrapper.test.mjs
git commit -m "fix(p02-t12): render canonical artifact state"
```

### Task p02-t13: (review) Point Paseo install remediation to repo script

**Files:**

- Modify: `plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs`
- Modify: `tests/wrapper-options.test.mjs`

**Step 1: Understand the issue**

Review finding: missing-Paseo remediation points at `plugins/consensus/skills/consensus-refine/scripts/install-paseo.mjs`, but the spec and plan schedule the repo-level `scripts/install-paseo.mjs`.
Location: `plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs:22`

**Step 2: Implement fix**

Change the remediation text/constant to the repo-level `scripts/install-paseo.mjs` path. Tighten the wrapper-options test so it asserts the exact repo-level path rather than any install-paseo filename.

**Step 3: Verify**

Run: `node --test tests/wrapper-options.test.mjs`
Expected: Test passes and verifies the repo-level install assist path.

**Step 4: Commit**

```bash
git add plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs tests/wrapper-options.test.mjs
git commit -m "fix(p02-t13): point install assist to repo script"
```

## Phase 3: Host-Mediated Parallel Orchestration

Goal: make `--prepare-parallel` and `--fan-in` work with simulated host dispatch and documented host responsibilities.

### Task p03-t01: Implement Parallel Prepare Manifest and Packets

**Files:**

- Modify: `plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs`
- Create: `tests/parallel-prepare.test.mjs`

**Step 1: Write test (RED)**

Test `--prepare-parallel` writes section packets, manifest schema v0, output path entries, peer config, agency, max rounds, and JSONL dispatch instructions with default `parallelism = min(section_count, 4)`.

Run: `node --test tests/parallel-prepare.test.mjs`
Expected: Test fails because prepare mode is missing.

**Step 2: Implement (GREEN)**

Add `prepareParallelRun(options)` and CLI branch for `--prepare-parallel`.

**Step 3: Refactor**

Reuse section parsing and path safety helpers from sequential mode.

**Step 4: Verify**

Run: `node --test tests/parallel-prepare.test.mjs`
Expected: Test passes.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs tests/parallel-prepare.test.mjs
git commit -m "feat(p03-t01): prepare parallel section packets"
```

### Task p03-t02: Implement Parallel Fan-In

**Files:**

- Modify: `plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs`
- Create: `tests/parallel-fan-in.test.mjs`

**Step 1: Write test (RED)**

Test `--fan-in <manifest>` reads section outputs, records, and status files; assembles in `original_index` order regardless of completion order; and includes `parallel: true` and subagent IDs in the Resolution block.

Run: `node --test tests/parallel-fan-in.test.mjs`
Expected: Test fails because fan-in mode is missing.

**Step 2: Implement (GREEN)**

Add `fanInParallelRun(manifestPath, options)` and CLI branch for `--fan-in`.

**Step 3: Refactor**

Share artifact rendering with sequential mode.

**Step 4: Verify**

Run: `node --test tests/parallel-fan-in.test.mjs`
Expected: Test passes.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs tests/parallel-fan-in.test.mjs
git commit -m "feat(p03-t02): fan in parallel results"
```

### Task p03-t03: Document Host Dispatch Responsibilities

**Files:**

- Modify: `plugins/consensus/skills/consensus-refine/SKILL.md`
- Modify: `plugins/consensus/agents/consensus-section-runner.md`
- Create: `tests/host-dispatch-docs.test.mjs`

**Step 1: Write test (RED)**

Test that `SKILL.md` contains the required prepare/dispatch/fan-in flow, Codex authorization fail-closed wording, parallelism batching instruction, and SIGINT cancellation responsibility.

Run: `node --test tests/host-dispatch-docs.test.mjs`
Expected: Test fails until docs include the required contract.

**Step 2: Implement (GREEN)**

Update host-facing instructions and subagent runner packet schema. Keep provider-specific differences explicit but concise.

**Step 3: Refactor**

Avoid promising wrapper-owned subagent cancellation.

**Step 4: Verify**

Run: `node --test tests/host-dispatch-docs.test.mjs`
Expected: Test passes.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/consensus-refine/SKILL.md plugins/consensus/agents/consensus-section-runner.md tests/host-dispatch-docs.test.mjs
git commit -m "docs(p03-t03): document parallel host dispatch"
```

### Task p03-t04: Handle Parallel Section Errors

**Files:**

- Modify: `plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs`
- Create: `tests/parallel-errors.test.mjs`

**Step 1: Write test (RED)**

Test malformed result JSON, missing output file, section timeout status, error markers in Final Output, partial-success Resolution status, and `--fail-on-section-error` exit 74.

Run: `node --test tests/parallel-errors.test.mjs`
Expected: Test fails because error aggregation is incomplete.

**Step 2: Implement (GREEN)**

Add parallel result validation and partial artifact behavior for failed sections.

**Step 3: Refactor**

Share section-status summarization with sequential mode.

**Step 4: Verify**

Run: `node --test tests/parallel-errors.test.mjs`
Expected: Test passes.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs tests/parallel-errors.test.mjs
git commit -m "feat(p03-t04): aggregate parallel section errors"
```

### Task p03-t05: Add Simulated Host Dispatch Integration Test

**Files:**

- Create: `tests/parallel-integration.test.mjs`
- Modify: `tests/fixtures/sample-input.md`

**Step 1: Write test (RED)**

Test full prepare → simulated subagent loop invocations → fan-in against the Paseo stub. Include at least one out-of-order section completion and one impasse section.

Run: `node --test tests/parallel-integration.test.mjs`
Expected: Test fails until prepare/fan-in pieces interoperate.

**Step 2: Implement (GREEN)**

Wire test helpers to call the wrapper in prepare mode, run `consensus-loop.mjs` per manifest entry, then call fan-in.

**Step 3: Refactor**

Move only reusable test process helpers into `tests/helpers/`.

**Step 4: Verify**

Run: `node --test tests/parallel-integration.test.mjs`
Expected: Test passes.

**Step 5: Commit**

```bash
git add tests/parallel-integration.test.mjs tests/fixtures/sample-input.md tests/helpers
git commit -m "test(p03-t05): cover host-mediated parallel flow"
```

## Phase 4: Resume, Release Polish, and Distribution Validation

Goal: finish v0.1 release readiness: resume handling, install assist, docs, smoke testing, and release automation.

### Task p04-t01: Parse Deliberation Artifacts for Resume

**Files:**

- Modify: `plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs`
- Create: `tests/resume-parse.test.mjs`

**Step 1: Write test (RED)**

Test frontmatter parsing, `consensus_schema_version: v0`, canonical section-state JSON block extraction, completed vs. in-flight section detection, and rejection of unsupported schema versions.

Run: `node --test tests/resume-parse.test.mjs`
Expected: Test fails because resume parsing is missing.

**Step 2: Implement (GREEN)**

Export `parseDeliberationArtifactForResume(pathOrText)` and integrate `--resume` argument validation.

**Step 3: Refactor**

Keep resume reads against canonical JSON blocks, never prose.

**Step 4: Verify**

Run: `node --test tests/resume-parse.test.mjs`
Expected: Test passes.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs tests/resume-parse.test.mjs
git commit -m "feat(p04-t01): parse artifacts for resume"
```

### Task p04-t02: Implement Resume Corruption Handling and Skip Flags

**Files:**

- Modify: `plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs`
- Create: `tests/resume-corruption.test.mjs`

**Step 1: Write test (RED)**

Test corrupt JSON block, hash recomputation mismatch, missing section state, `--skip-corrupt-section`, interactive `--skip-all-corrupt`, and non-interactive `--yes-skip-corrupt` behavior.

Run: `node --test tests/resume-corruption.test.mjs`
Expected: Test fails because fail-closed resume behavior is incomplete.

**Step 2: Implement (GREEN)**

Add resume validation errors with exit 65 and explicit skip handling.

**Step 3: Refactor**

Write `resume-errors.json` in the run directory for detailed diagnostics.

**Step 4: Verify**

Run: `node --test tests/resume-corruption.test.mjs`
Expected: Test passes.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs tests/resume-corruption.test.mjs
git commit -m "feat(p04-t02): fail closed on corrupt resume state"
```

### Task p04-t03: Add User Intervention Resume Flow

**Files:**

- Modify: `plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs`
- Modify: `plugins/consensus/skills/consensus-refine/scripts/consensus-loop.mjs`
- Create: `tests/user-intervention.test.mjs`

**Step 1: Write test (RED)**

Test adding a `<user round=N>` intervention entry, replaying logged rounds into the next turn context, and continuing from the next agent turn without losing prior records.

Run: `node --test tests/user-intervention.test.mjs`
Expected: Test fails because user intervention handling is missing.

**Step 2: Implement (GREEN)**

Add resume-time user direction plumbing and `USER_INTERVENTION` records.

**Step 3: Refactor**

Keep intervention rendering consistent with ordinary turn records.

**Step 4: Verify**

Run: `node --test tests/user-intervention.test.mjs`
Expected: Test passes.

**Step 5: Commit**

```bash
git add plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs plugins/consensus/skills/consensus-refine/scripts/consensus-loop.mjs tests/user-intervention.test.mjs
git commit -m "feat(p04-t03): resume with user intervention"
```

### Task p04-t04: Implement Paseo Install Assist

**Files:**

- Create: `scripts/install-paseo.mjs`
- Create: `tests/install-paseo.test.mjs`

**Step 1: Write test (RED)**

Test default decline, explicit yes confirmation, hardcoded `npm install -g @getpaseo/cli`, no user input in subprocess args, post-install `paseo --version` check, and failure surfacing without retries.

Run: `node --test tests/install-paseo.test.mjs`
Expected: Test fails because install assist is missing.

**Step 2: Implement (GREEN)**

Implement prompt-and-confirm install assist with injectable process runner for tests.

**Step 3: Refactor**

Keep script standalone and dependency-free.

**Step 4: Verify**

Run: `node --test tests/install-paseo.test.mjs`
Expected: Test passes.

**Step 5: Commit**

```bash
git add scripts/install-paseo.mjs tests/install-paseo.test.mjs
git commit -m "feat(p04-t04): add paseo install assist"
```

### Task p04-t05: Complete README Provider Support and Limitations

**Files:**

- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `CHANGELOG.md`
- Create: `tests/readme-scope.test.mjs`

**Step 1: Write test (RED)**

Test README includes install commands for Claude, Cursor, Codex Git/local, and `npx skills add`; names the tested Paseo version range in the prerequisite/install section; includes Permissions and Limitations; documents no telemetry; documents prompt-injection limitation; includes Advanced Configuration for custom ACP providers including cursor-as-peer opt-in; and lists deferred features accurately.

Run: `node --test tests/readme-scope.test.mjs`
Expected: Test fails until docs match v0.1 scope.

**Step 2: Implement (GREEN)**

Complete README and contribution guidance from the design. Update CHANGELOG with the implemented v0.1 scope, including the tested Paseo version range used for release validation.

**Step 3: Refactor**

Remove any hard-coded pricing claims that require current provider-price refresh.

**Step 4: Verify**

Run: `node --test tests/readme-scope.test.mjs && node scripts/validate.mjs`
Expected: Test and validator pass.

**Step 5: Commit**

```bash
git add README.md CONTRIBUTING.md CHANGELOG.md tests/readme-scope.test.mjs
git commit -m "docs(p04-t05): complete v0.1 user documentation"
```

### Task p04-t06: Add Version Bump and Release Workflow Support

**Files:**

- Create: `scripts/bump-version.mjs`
- Modify: `RELEASING.md`
- Modify: `.github/workflows/release.yml`
- Create: `tests/release-versioning.test.mjs`

**Step 1: Write test (RED)**

Test bump-version updates all three plugin manifest versions and any marketplace version fields present, while rejecting malformed semver and leaving unsupported marketplace version fields absent.

Run: `node --test tests/release-versioning.test.mjs`
Expected: Test fails because version bump script is missing.

**Step 2: Implement (GREEN)**

Add the script and release workflow validation steps for tag-version consistency.

**Step 3: Refactor**

Keep release workflow permissions limited to `contents: write`.

**Step 4: Verify**

Run: `node --test tests/release-versioning.test.mjs && node scripts/validate.mjs`
Expected: Tests and validator pass.

**Step 5: Commit**

```bash
git add scripts/bump-version.mjs RELEASING.md .github/workflows/release.yml tests/release-versioning.test.mjs
git commit -m "feat(p04-t06): add release version tooling"
```

### Task p04-t07: Add CI Smoke Test

**Files:**

- Create: `scripts/smoke-test.mjs`
- Create: `tests/smoke-test-script.test.mjs`
- Modify: `.github/workflows/validate.yml`

**Step 1: Write test (RED)**

Test that `scripts/smoke-test.mjs` runs validation, installs the Paseo stub into PATH, executes the wrapper against `tests/fixtures/sample-input.md`, checks JSONL stdout, verifies artifact structure, and exits non-zero on failed assertions.

Run: `node --test tests/smoke-test-script.test.mjs`
Expected: Test fails because smoke test script is missing.

**Step 2: Implement (GREEN)**

Implement stdlib-only smoke test and wire it into CI after `node scripts/validate.mjs`.

**Step 3: Refactor**

Keep smoke output concise and deterministic for CI logs.

**Step 4: Verify**

Run: `node --test tests/smoke-test-script.test.mjs && node scripts/smoke-test.mjs`
Expected: Test and smoke pass without real LLM tokens.

**Step 5: Commit**

```bash
git add scripts/smoke-test.mjs tests/smoke-test-script.test.mjs .github/workflows/validate.yml
git commit -m "test(p04-t07): add mocked end-to-end smoke test"
```

### Task p04-t08: Final Release Readiness Pass

**Files:**

- Modify: `CHANGELOG.md`
- Modify: `RELEASING.md`
- Modify: `.oat/projects/shared/consensus-plugin/implementation.md`

**Step 1: Write test (RED)**

No new unit test. Run the full local verification suite before the readiness update and record any failures in implementation notes. Also run the manual release-readiness checks for Codex skill path syntax and per-provider `node`/`paseo` permission profile, or record a blocking release note if any provider cannot be verified.

Run: `npm test && node scripts/validate.mjs && node scripts/smoke-test.mjs`
Expected: All commands pass before release notes are finalized.

**Step 2: Implement (GREEN)**

Finalize release notes, document manual smoke-test checklist status in `RELEASING.md`, verify local Codex installation accepts the `./skills/consensus-refine` manifest path syntax, verify each provider's declared permissions allow `node` and `paseo` invocation, and update OAT implementation notes with verification evidence.

**Step 3: Refactor**

Make sure docs do not claim marketplace publication happened before manual submission.

**Step 4: Verify**

Run: `npm test && node scripts/validate.mjs && node scripts/smoke-test.mjs`
Expected: Full local verification passes.

**Step 5: Commit**

```bash
git add CHANGELOG.md RELEASING.md .oat/projects/shared/consensus-plugin/implementation.md
git commit -m "docs(p04-t08): record release readiness"
```

## Phase 5: Final Review Fixes

Goal: close the final lifecycle review findings before the final code review can pass.

### Task p05-t01: (review) Preserve Completed Resume Section Output

**Files:**

- Modify: `plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs`
- Create/Modify: `tests/resume-parse.test.mjs`
- Create/Modify: `tests/sequential-wrapper.test.mjs`

**Step 1: Understand the issue**

Review finding: resume reconstruction can replace an already-completed section with text from the current input file when the completed section converged via ACCEPT-only turns and has no `proposed_artifact` record.
Location: `plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs:1589`

**Step 2: Implement fix**

Persist every section's final output in canonical resume state, parse it as the authoritative resume source, and validate it against `final_artifact_hash`. Do not fall back to current input for resume sections except through explicit corrupt-section skip/restart behavior.

**Step 3: Verify**

Run: `node --test tests/resume-parse.test.mjs tests/sequential-wrapper.test.mjs`
Expected: tests pass, including a regression where an ACCEPT-only completed section is preserved after the source input changes.

**Step 4: Commit**

```bash
git add plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs tests/resume-parse.test.mjs tests/sequential-wrapper.test.mjs
git commit -m "fix(p05-t01): preserve completed resume section output"
```

### Task p05-t02: (review) Make Release Validation Version-Aware

**Files:**

- Modify: `scripts/validate.mjs`
- Modify: `scripts/bump-version.mjs`
- Create/Modify: `tests/release-versioning.test.mjs`
- Create/Modify: `tests/validate-script.test.mjs`

**Step 1: Understand the issue**

Review finding: `scripts/bump-version.mjs` can update manifests to `0.1.1` or future versions, but `scripts/validate.mjs` still hardcodes `0.1.0`, so the release workflow rejects legitimate bumped versions before tag-version consistency is checked.
Location: `scripts/validate.mjs:253`

**Step 2: Implement fix**

Validate provider manifest versions as semver and mutually consistent rather than hardcoding `0.1.0`. Let `bump-version --check-tag` enforce the tag-specific expected version. Either include skill metadata version in the bump tool or make validator semantics explicitly independent without blocking bumped plugin versions.

**Step 3: Verify**

Run: `node --test tests/release-versioning.test.mjs tests/validate-script.test.mjs && node scripts/validate.mjs`
Expected: tests and validator pass, including a temp-repo regression that bumps to `0.1.1`, validates successfully, and passes `--check-tag v0.1.1`.

**Step 4: Commit**

```bash
git add scripts/validate.mjs scripts/bump-version.mjs tests/release-versioning.test.mjs tests/validate-script.test.mjs
git commit -m "fix(p05-t02): validate bumped release versions"
```

### Task p05-t03: (review) Align Artifact Frontmatter Metadata

**Files:**

- Modify: `plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs`
- Create/Modify: `tests/sequential-wrapper.test.mjs`

**Step 1: Understand the issue**

Review finding: artifact frontmatter omits several design-listed metadata fields, leaving a repeated Minor gap from earlier reviews.
Location: `plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs:847`

**Step 2: Implement fix**

Expand rendered frontmatter to include the design-listed machine metadata that is already available in the resolution state, including iteration, cold-start mode, peers, turn/round totals, wall-clock/cost fields, input path, and run id.

**Step 3: Verify**

Run: `node --test tests/sequential-wrapper.test.mjs`
Expected: tests pass and assert the expanded metadata is present in artifact frontmatter.

**Step 4: Commit**

```bash
git add plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs tests/sequential-wrapper.test.mjs
git commit -m "fix(p05-t03): align artifact frontmatter metadata"
```

### Task p05-t04: (review) Refresh Release Readiness Evidence

**Files:**

- Modify: `RELEASING.md`
- Modify: `.oat/projects/shared/consensus-plugin/implementation.md`

**Step 1: Understand the issue**

Review finding: `RELEASING.md` records a stale local test count after the review-fix regression increased the suite.
Location: `RELEASING.md:25`

**Step 2: Implement fix**

Run final local verification after p05 fixes and update release-readiness evidence to match the actual test count and commands. Preserve the documented provider-runtime blockers until manual checks are complete.

**Step 3: Verify**

Run: `npm test && node scripts/validate.mjs && node scripts/smoke-test.mjs`
Expected: full local verification passes and documented evidence matches the final run.

**Step 4: Commit**

```bash
git add RELEASING.md .oat/projects/shared/consensus-plugin/implementation.md
git commit -m "docs(p05-t04): refresh release readiness evidence"
```

## Phase 6: Final Resume Review Fixes

Goal: close the remaining final lifecycle resume findings from the second final review cycle.

### Task p06-t01: (review) Make Resume Section Inventory Artifact-Authoritative

**Files:**

- Modify: `plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs`
- Create/Modify: `tests/sequential-wrapper.test.mjs`
- Create/Modify: `tests/resume-parse.test.mjs`

**Step 1: Understand the issue**

Review finding: resumed runs still let the current input file decide which sections exist, so if the source input removes or renames a section, that section can be silently dropped from the resumed artifact.
Location: `plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs:1576`

**Step 2: Implement fix**

When `--resume` is present, build the run section list from `resumeState.sections` instead of the current input section inventory. Preserve all artifact sections as the authoritative state. Treat current-input drift as non-fatal for known sections; only use current input text for explicit corrupt-section skip/restart behavior.

**Step 3: Verify**

Run: `node --test tests/sequential-wrapper.test.mjs tests/resume-parse.test.mjs`
Expected: tests pass, including a regression where a resumed artifact preserves all original sections after the source input removes or renames headings.

**Step 4: Commit**

```bash
git add plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs tests/sequential-wrapper.test.mjs tests/resume-parse.test.mjs
git commit -m "fix(p06-t01): keep resume section inventory authoritative"
```

### Task p06-t02: (review) Use Agency-Aware Resume Hash Validation

**Files:**

- Modify: `plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs`
- Create/Modify: `tests/resume-parse.test.mjs`
- Create/Modify: `tests/sequential-wrapper.test.mjs`

**Step 1: Understand the issue**

Review finding: minimal-agency artifacts use strict bytewise hashing in the loop, but resume validation recomputes resumed output hashes with default normalized hashing and can falsely reject valid minimal-agency artifacts.
Location: `plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs:314`

**Step 2: Implement fix**

Recompute resume hashes with the same agency-aware hash options used by the loop, using `resolution.agency` or equivalent resume metadata. Normalize legacy artifacts explicitly if needed and keep corruption checks fail-closed for genuine mismatches.

**Step 3: Verify**

Run: `node --test tests/resume-parse.test.mjs tests/sequential-wrapper.test.mjs`
Expected: tests pass, including a minimal-agency resume regression with trailing whitespace.

**Step 4: Commit**

```bash
git add plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs tests/resume-parse.test.mjs tests/sequential-wrapper.test.mjs
git commit -m "fix(p06-t02): use agency-aware resume hashes"
```

## Phase 7: Final Minor Review Fixes

Goal: close the non-blocking final review v4 minor findings before post-implementation handoff.

### Task p07-t01: (review) Refresh Release Readiness Test Count

**Files:**

- Modify: `RELEASING.md`

**Step 1: Understand the issue**

Review finding: the v0.1 Readiness Snapshot still reports `npm test` as 122 tests, but the current suite reports 124 after p06 regressions were added.
Location: `RELEASING.md:25`

**Step 2: Implement fix**

Update the automated-checks table to report `124 tests passed locally`. Keep the provider-runtime manual blocker notes unchanged.

**Step 3: Verify**

Run: `npm test`
Expected: the test suite passes and reports 124 tests.

**Step 4: Commit**

```bash
git add RELEASING.md
git commit -m "docs(p07-t01): refresh release readiness test count"
```

### Task p07-t02: (review) Add Host Metadata to Deliberation Artifacts

**Files:**

- Modify: `plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs`
- Create/Modify: `tests/sequential-wrapper.test.mjs`

**Step 1: Understand the issue**

Review finding: design.md section 4.5 lists `host` as part of the artifact frontmatter contract, but artifact rendering never carries the detected host runtime into frontmatter or the canonical resolution JSON.
Location: `plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs:881`

**Step 2: Implement fix**

Plumb the detected host runtime into the resolution object, include it in artifact frontmatter alongside `peers`, and include it in the canonical `consensus-resolution` JSON block. Keep the field additive and backwards-compatible.

**Step 3: Verify**

Run: `node --test tests/sequential-wrapper.test.mjs`
Expected: tests pass and assert rendered artifacts include `host` metadata in frontmatter and resolution JSON.

**Step 4: Commit**

```bash
git add plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs tests/sequential-wrapper.test.mjs
git commit -m "fix(p07-t02): add host artifact metadata"
```

## Reviews

{Track reviews here after running the oat-project-review-provide and oat-project-review-receive skills.}

{Keep both code + artifact rows below. Add additional code rows (p03, p04, etc.) as needed, but do not delete `spec`/`design`.}

| Scope  | Type     | Status  | Date | Artifact |
| ------ | -------- | ------- | ---- | -------- |
| p01    | code     | passed | 2026-05-04 | reviews/archived/p01-review-2026-05-04-v2.md |
| p02    | code     | passed | 2026-05-04 | reviews/archived/p02-fix-tasks-review-2026-05-04.md |
| p03    | code     | passed | 2026-05-04 | reviews/archived/p03-review-2026-05-04-v3.md |
| p04    | code     | passed | 2026-05-04 | reviews/archived/p04-review-2026-05-04-v2.md |
| p05    | code     | passed | 2026-05-04 | reviews/archived/p05-review-2026-05-04.md |
| p06    | code     | passed | 2026-05-04 | reviews/archived/p06-review-2026-05-04.md |
| p07    | code     | passed | 2026-05-04 | reviews/archived/p07-review-2026-05-04.md |
| final  | code     | passed | 2026-05-04 | reviews/archived/final-review-2026-05-04-v5.md |
| spec   | artifact | passed | 2026-05-04 | reviews/archived/artifact-spec-review-2026-05-04.md |
| design | artifact | passed | 2026-05-04 | reviews/archived/artifact-design-review-2026-05-04.md |
| plan   | artifact | passed | 2026-05-04 | reviews/archived/artifact-plan-review-2026-05-04-v2.md |

**Status values:** `pending` → `received` → `fixes_added` → `fixes_completed` → `passed`

**Meaning:**

- `received`: review artifact exists (not yet converted into fix tasks)
- `fixes_added`: fix tasks were added to the plan (work queued)
- `fixes_completed`: fix tasks implemented, awaiting re-review
- `passed`: re-review run and recorded as passing (no Critical/Important)

**Design review note:** The Important design review finding was addressed by commit `436c1b2` (`docs(spec): reconcile spec.md with design.md per artifact review (design)`). Re-review `reviews/archived/artifact-design-review-2026-05-04.md` passed with no remaining findings.

**Plan review note:** The 2026-05-04 plan artifact review findings were resolved directly in this plan. Disposition map: I1/I2/I3/M1/M2/M3/M4/m4 resolved in artifact; m1 rejected because `oat_phase_status: complete` means the plan artifact is complete and ready for the next OAT gate; m2 rejected because the plan review row now exists; m3 rejected because HiLL checkpoint choice is intentionally deferred to `oat-project-implement`.

**Spec review note:** The spec artifact review `reviews/archived/artifact-spec-review-2026-05-04.md` passed with no remaining findings after the design/spec reconciliation.

## Implementation Complete

**Summary:**

- Phase 1: 7 tasks - repository scaffolding and distribution metadata
- Phase 2: 13 tasks - sequential wrapper and loop core
- Phase 3: 5 tasks - host-mediated parallel orchestration
- Phase 4: 8 tasks - resume, release polish, and distribution validation
- Phase 5: 4 tasks - final review fixes
- Phase 6: 2 tasks - final resume review fixes
- Phase 7: 2 tasks - final minor review fixes

**Total: 41 tasks**

Implementation and final code review complete.

## References

- Design: `design.md`
- Spec: `spec.md`
- Discovery: `discovery.md`
- Design review: `reviews/archived/artifact-design-review-2026-05-03.md`
