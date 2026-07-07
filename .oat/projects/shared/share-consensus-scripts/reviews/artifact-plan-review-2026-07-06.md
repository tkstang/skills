---
oat_generated: true
oat_generated_at: 2026-07-06
oat_review_scope: plan
oat_review_type: artifact
oat_review_invocation: gate
oat_project: .oat/projects/shared/share-consensus-scripts
---

# Artifact Review: plan

**Reviewed:** 2026-07-06
**Scope:** plan.md (quick-mode artifact review, pre-implementation gate)
**Files reviewed:** 2 (plan.md, discovery.md) + source-of-truth references
**Commits:** N/A (artifact review; no code exists yet — next task is p01-t01)

## Summary

The plan is well-structured, faithful to the discovery, backlog item, and handoff,
and correctly gates the migration behind a spike + go/no-go checkpoint. Task
decomposition is mostly concrete and executable, closeout/PJM steps match the
Backlog Lifecycle contract, and the parallelism and HiLL decisions are coherent
and consistently expressed. One real gap blocks the Phase 2 verify gates as
written: the migration adds a new generated-output path but no task updates the
static lint/format ignore configs (`.oxfmtrc.json`, `.oxlintrc.json`) that the
drift guard asserts against.

Findings: 0 critical, 1 important, 1 medium, 3 minor

## Findings

### Critical

None

### Important

- **Phase 2 omits the static lint/format ignore-config updates the new shared output requires** (`plan.md:174-309`, evidence `.oxfmtrc.json:25-29`, `.oxlintrc.json:34-38`, `tests/tooling/generated-output-sync.test.ts:223-240`)
  - Issue: The migration adds `plugins/consensus/scripts/consensus-loop.mjs` to the live `generatedOutputs` mapping and removes the five per-skill loop outputs. The drift guard test `excludes generated outputs from static lint and format configs` iterates the live `generatedOutputPaths` and asserts (`.toContain`, exact-string match) that every current output path appears in both `.oxfmtrc.json.ignorePatterns` and `.oxlintrc.json.ignorePatterns`. Those two files currently hard-list the five per-skill `consensus-loop.mjs` paths (`.oxfmtrc.json:25-29`, `.oxlintrc.json:34-38`) but not the new shared path. No Phase 2 task lists, edits, or stages `.oxfmtrc.json` / `.oxlintrc.json` — p02-t01 touches only `scripts/build-generated.mjs`; p02-t03's `git add` is `scripts plugins/consensus tests`, which does not include the root JSON configs. As written, the p02-t02 and p02-t04 verify (`pnpm exec vitest run tests/tooling/generated-output-sync.test.ts`) and the CI oxfmt/oxlint sync contract (CLAUDE.md requires these ignore lists stay in sync across `.oxfmtrc.json`, `.lintstagedrc.mjs`, and CI) will fail until the configs are updated.
  - Fix: Add an explicit step and file entry (cleanest in p02-t01, co-located with the mapping change so the mapping and its static mirrors move together) to add `plugins/consensus/scripts/consensus-loop.mjs` to `.oxfmtrc.json` and `.oxlintrc.json` `ignorePatterns` and prune the five stale per-skill `consensus-loop.mjs` entries; stage both files in that task's commit. Note in the plan that `.lintstagedrc.mjs` derives generated paths dynamically from the mapping (`.lintstagedrc.mjs:17-22`) and needs no manual edit, and that CI oxfmt/oxlint exclusions are derived from `--list-outputs` and auto-adapt.

### Medium

- **p02-t02's verify cannot pass in isolation; the drift-guard test file is red until p02-t03 regenerates outputs** (`plan.md:210-237`, evidence `scripts/build-generated.mjs:412-442`, `tests/tooling/generated-output-sync.test.ts:50-99`)
  - Issue: p02-t02 updates the drift test but its verify runs the entire `generated-output-sync.test.ts`. After p02-t01 changes the mapping, the committed `.mjs` outputs are stale (the shared `plugins/consensus/scripts/consensus-loop.mjs` is not yet built, and the per-skill loop files are still committed), so the `--check` drift sub-test (`checks committed generated outputs`, the `--list-outputs` sub-test, and `declares source to generated-output mappings`) will fail until p02-t03 runs `pnpm run build` and commits regenerated outputs. Combined with the Important finding above, the p02-t02 commit leaves the tree with that test file failing, which conflicts with the task-atomicity expectation that each task's verify passes. The first fully-green checkpoint is p02-t04.
  - Fix: Either fold p02-t02 into p02-t03 as one atomic mapping+test+regenerate commit, or keep the split but explicitly document in the plan that the Phase 2 mapping/test/regenerate tasks form a coupled set whose full-green verify is p02-t04, and narrow p02-t02's verify to the specific assertions being edited (e.g., an `rg`/compile check of the updated test) rather than the whole drift-guard file.

### Minor

- **No-Go Handling instruction to "append no-go closeout tasks" overlaps with an already outcome-aware Phase 3** (`plan.md:44-53` vs `plan.md:313-414`)
  - Issue: The No-Go Handling section says to skip p02 and "append no-go closeout tasks" that update docs, close the item, delete the handoff, and run validation gates — but p03 already performs exactly that work and is outcome-aware (p03-t02 step 1 explicitly handles the no-go close, p03-t01 is conditional, p03-t03 runs the gates). The "append fresh tasks" framing is slightly contradictory with reusing p03.
  - Suggestion: Reconcile the no-go path to state that on no-go the implementer skips p02 and runs the existing outcome-aware p03 tasks (recording the blocker in the spike artifact), reserving "append tasks" only for genuinely novel no-go cleanup not already covered by p03.

- **p02-t02 has no positive guard that the new plugin-root-layout regression test was actually added** (`plan.md:218-230`)
  - Issue: Step 2 requires adding a regression test that simulates the installed plugin-root layout, but the verify only runs the whole test file — an omitted or misnamed new test would not be caught.
  - Suggestion: Add an `rg -n "<new test description>" tests/tooling/generated-output-sync.test.ts` (or the new fixture path) to the p02-t02 verify to assert the regression test exists.

- **p02-t01 does not state the literal rewrite target path** (`plan.md:186-191`)
  - Issue: Step 2 says rewrite `../core/consensus-loop.js` "to the correct plugin-root-relative shared path from each wrapper output" without naming it. It is derivable (`../../../scripts/consensus-loop.mjs` from `plugins/consensus/skills/<skill>/scripts/`) and the backlog item states it explicitly, so this is low-risk.
  - Suggestion: Name the literal target (`../../../scripts/consensus-loop.mjs`) in the step to remove ambiguity during implementation.

## Requirements/Design Alignment

**Evidence sources used:** plan.md, discovery.md (quick-mode upstream), implementation.md (tracker), handoff `BL-260620-share-consensus-generated.md`, backlog item `BL-260620-share-consensus-generated.md`, `scripts/build-generated.mjs`, `tests/tooling/generated-output-sync.test.ts`, `.oxfmtrc.json`, `.oxlintrc.json`, `.lintstagedrc.mjs`, `package.json`, `.oat/repo/pjm/AGENTS.md`. Per mode contract (quick), spec.md and design.md are not expected and their absence is not a finding. No `## Dispatch Profile` section — expected per dispatch advisory, not flagged.

### Discovery Coverage

| Discovery success criterion | Status | Notes |
| --------------------------- | ------ | ----- |
| Spike records install/local-load command + layout for Claude, Codex, Cursor, Copilot | covered | p01-t01/p01-t02 |
| Spike proves resolve/execute or records concrete blockers | covered | p01-t02/p01-t03 |
| On go, build emits one shared `plugins/consensus/scripts/consensus-loop.mjs` (not 5) | covered | p02-t01/p02-t03; mapping fidelity verified against build-generated.mjs (5 loop outputs: refine/evaluate/create/decide/plan) |
| On go, wrappers import shared loop; drift covers new mapping | covered | p02-t01/p02-t02 (import-rewrite gap noted as minor) |
| Per-skill duplicated loop outputs removed | covered | p02-t03 (Delete list) |
| Tests simulate/exercise installed plugin-root layout | covered | p02-t02 step 2 (weak positive guard — minor finding) |
| Docs state plugin install/local-load runtime contract | covered | p03-t01 |
| Backlog closed/archived, indexes refreshed, handoff removed same PR | covered | p03-t02 matches `.oat/repo/pjm/AGENTS.md` Backlog Lifecycle |
| Static lint/format ignore configs updated for new output | **NOT covered** | See Important finding — no task edits `.oxfmtrc.json`/`.oxlintrc.json` |

### Fidelity Notes (verified correct)

- **Version-bump scope (5 vs handoff's 6):** The handoff says "a layout change touching all six skills bumps all six," but that assumed the broader config-sharing scope. This plan keeps `consensus-config.mjs` duplicated (p02-t01 step 3, aligned with discovery's deferred idea) and only moves the loop, which touches refine/evaluate/create/decide/plan — panel's outputs (`consensus-panel-config`, `consensus-panel` importing only config) are untouched. The plan's "five" (p02-t03 step 4) is correct and appropriately diverges from the handoff.
- **HiLL / parallelism:** `oat_plan_hill_phases: ["p01"]` is consistently expressed in frontmatter, No-Go Handling, and p01-t03 step 5. `oat_plan_parallel_groups: []` is justified by a coherent Parallelism section (generated-output + drift-guard coordination makes splitting fragile).
- **Verify command validity:** `--list-outputs` (p02-t01), `build:check`, `validate:skill-versions`, `pnpm test`, `smoke`, `worktree:validate` all map to real `package.json` scripts and real build-script flags.

### Extra Work (not in declared requirements)

None. All tasks map to discovery success criteria, the backlog acceptance criteria, or the handoff closeout contract.

## Verification Commands

Run these to confirm the Important finding and validate fixes once applied:

```bash
# Confirm the static ignore configs currently list only per-skill loop paths (the gap)
rg -n "consensus-loop" .oxfmtrc.json .oxlintrc.json

# Enumerate current vs post-migration generated outputs
node scripts/build-generated.mjs --list-outputs | rg 'consensus-loop\.mjs'

# The drift guard that will fail until ignore configs + regenerated outputs are updated
pnpm exec vitest run tests/tooling/generated-output-sync.test.ts
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert these findings into plan
tasks (or artifact-alignment edits) before starting implementation. The
Important finding should be closed by adding the ignore-config updates to
Phase 2; the Medium finding by clarifying Phase 2 task coupling.
