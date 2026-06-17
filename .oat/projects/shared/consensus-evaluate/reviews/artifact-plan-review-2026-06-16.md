---
oat_generated: true
oat_generated_at: 2026-06-16
oat_review_scope: plan
oat_review_type: artifact
oat_review_invocation: manual
oat_project: .oat/projects/shared/consensus-evaluate
---

# Artifact Review: plan

**Reviewed:** 2026-06-16
**Scope:** plan.md (consensus-evaluate, quick mode)
**Files reviewed:** 1 plan + 2 upstream artifacts (discovery, design) verified against the live working tree
**Commits:** working tree (post-rebase onto origin/main)

## Summary

The plan is complete, internally consistent, and ready for `oat-project-implement`. Verified against the ACTUAL current working tree: the TypeScript generated-runtime substrate exists (`src/consensus/core/consensus-loop.ts`, `src/consensus/refine/consensus-refine.ts`, `scripts/build-generated.mjs` with `generatedOutputs` + `rewriteImportSpecifiers`, `tests/generated-output-sync.test.mjs`, the `build`/`build:check`/`type-check` scripts, and `vitest`/`typescript`/`esbuild` devDependencies), and DR-020/DR-021 resolve to real decision records. Every plan claim about file existence, the import-rewrite convention (`../core/consensus-loop.js` → `./consensus-loop.mjs`), module-relative schema resolution, output-flag requirements, and verify commands checks out. No Critical or Important findings; only minor observations.

## Findings

### Critical

None.

### Important

None.

### Minor

- **Wrapper-level `independent_draft` rejection partially duplicates loop behavior** (`plan.md:172`, `src/consensus/core/consensus-loop.ts:1481-1482`)
  - Issue: p02-t01 plans a wrapper-level test that `--cold-start independent_draft` is "rejected with a clear message." The canonical loop already throws `--cold-start independent_draft is not yet supported` at parse time, so a purely pass-through wrapper would inherit rejection without new wrapper code.
  - Suggestion: Keep the wrapper-level assertion (an earlier, evaluate-specific message is defensible and matches discovery decision #5 and refine's pattern), but have the implementer confirm whether the wrapper adds its own guard or relies on the loop's. This is a clarity nuance, not a defect — no plan change required.

- **Design's cited "deferred" README line numbers are stale relative to the live tree** (`design.md:273`)
  - Issue: design.md points at `README.md:129` / `plugins/consensus/README.md:139`; the live deferred references are at `README.md:147` and `plugins/consensus/README.md:139` (root shifted). The plan (p03-t02) correctly avoids hardcoding line numbers and drives edits via `rg`, so the plan itself is unaffected.
  - Suggestion: Optionally refresh the design line-number citation during closeout; this is upstream-artifact drift in design, not a plan defect. The plan's `rg`-based approach is the right pattern.

- **p03-t01 verify uses `pnpm run validate` while RED-step uses `node --test`** (`plan.md:306`, `plan.md:320`)
  - Issue: The RED step runs `node --test tests/docs-presence.test.mjs tests/package-metadata.test.mjs` and the Verify step runs `pnpm run validate`. Both are valid (the two named tests are `.test.mjs` run by the node suite; `validate` is the structure/manifest gate), but the asymmetry could read as inconsistent.
  - Suggestion: No change required — running the targeted node tests for RED and the broader `validate` for GREEN/Verify is reasonable. Optionally note in the task that `validate` is the authoritative manifest/docs gate.

## Spec/Design Alignment

**Evidence sources used:** `plan.md` (under review), `discovery.md` (upstream, required in quick mode), `design.md` (present, supporting context). spec.md intentionally absent (quick mode) — not flagged. Verified against live working-tree files: `src/consensus/core/consensus-loop.ts`, `src/consensus/refine/consensus-refine.ts`, `scripts/build-generated.mjs`, `tests/generated-output-sync.test.mjs`, `tests/repo-layout.test.mjs`, `tests/docs-presence.test.mjs`, `package.json`, `plugins/consensus/skills/refine/{scripts,schemas}/`, `.oat/repo/reference/decision-record.md`, and the README deferred references.

### Requirements Coverage

| Requirement (discovery/design intent) | Plan mapping | Status | Notes |
| --- | --- | --- | --- |
| Narrow prompt-profile seam in `runConsensusLoop`, defaults unchanged (refine behavior-identical) | p01-t01 | implemented | RED asserts custom builders for `parallel_revision` and default path with no profile; threads through alternating/parallel/synthesis; verify includes type-check |
| Export typed loop-facing APIs (PromptProfile, RunOptions, records, terminal status) | p01-t01 | implemented | Plan adds type-level coverage; aligns with design "evaluate as forcing function for typed loop APIs" |
| Reuse `verdict-parallel`/synthesis schemas; evaluate carries own `schemas/` copy with drift guard | p01-t02 | implemented | Parity test vs canonical refine distribution schemas; module-relative `../schemas/...` resolution confirmed in loop source (lines 620/626/639) |
| Extend generated-output build for evaluate loop runtime | p01-t03 | implemented | Adds `generatedOutputs` mapping `src/consensus/core/consensus-loop.ts` → `evaluate/scripts/consensus-loop.mjs`; extends sync + layout tests; updates lint/format exclusions |
| Canonical wrapper source `src/consensus/evaluate/consensus-evaluate.ts`; v3 defaults (shared_input/parallel_revision/minimal), all overridable; reject independent_draft | p02-t01 | implemented | Imports via `../core/consensus-loop.js` matching DR-021; untrusted-content framing; evaluation (not edit) prompts |
| Output contract: unified findings + embedded per-record `consensus-verdict` blocks + dissent/unresolved-dissent; pass `--output-records/-section/-status` | p02-t02 | implemented | Required output flags confirmed in loop validation (lines 1493-1495); CONVERGED vs IMPASSE rendering covered |
| Generate wrapper runtime with PR #14 import rewrite (`../core/consensus-loop.js` → `./consensus-loop.mjs`) | p02-t03 | implemented | Mapping + `importRewrites` shape exactly matches live `generatedOutputs` and `rewriteImportSpecifiers`; generated-import test mirrors refine's |
| Register evaluate in SKILL.md + provider manifests (.claude/.codex/.cursor); validate invariants | p03-t01 | implemented | Extends docs-presence/package-metadata tests; `pnpm run validate` gate |
| Mark family skill shipped (not deferred) in READMEs + repo reference; deliver bl-5174 | p03-t02 | implemented | `rg`-driven removal of deferred language; live deferred refs confirmed at README.md:147 / plugins/consensus/README.md:139 |
| Final gates: build, build:check, type-check, test, validate, smoke; capture completion state | p03-t03 | implemented | All six commands match real package.json scripts |
| Dependency-free shipped runtime; no `sync:consensus-core` second path (DR-020) | p01-t03, p02-t01, p02-t03 | implemented | Plan explicitly forbids a second sync script and reuses the single generated-output substrate |

### Extra Work (not in declared requirements)

None. Every task maps to a discovery key decision, a design responsibility, or a backlog AC. The plan correctly defers a structured JSON evaluation schema and `src/consensus/core/schemas/` relocation (both out of scope per discovery/design) rather than pulling them in.

## Verification Commands

```bash
# Confirm substrate exists (context-asserted; verified during review)
find src/consensus -type f
node -e "console.log(Object.keys(require('./package.json').scripts))"
node -e "console.log(Object.keys(require('./package.json').devDependencies))"

# Confirm import-rewrite convention + mapping shape the plan mirrors
grep -nE "generatedOutputs|importRewrites|rewriteImportSpecifiers" scripts/build-generated.mjs

# Confirm module-relative schema resolution + required output flags
grep -nE "schemas|output-records|output-section|output-status" src/consensus/core/consensus-loop.ts

# Confirm DR-020/DR-021 resolve
grep -nE "DR-020|DR-021" .oat/repo/reference/decision-record.md

# Confirm live deferred README references the plan targets
rg -n "deferred|consensus-evaluate" README.md plugins/consensus/README.md
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert findings into plan tasks (or, given only Minor findings, to record the review as passing).
