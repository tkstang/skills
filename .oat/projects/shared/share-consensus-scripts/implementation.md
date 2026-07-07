---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-07-07
oat_current_task_id: p03-t01
oat_generated: false
---

# Implementation: share-consensus-scripts

**Started:** 2026-07-07
**Last Updated:** 2026-07-07

> This document is used to resume interrupted implementation sessions.
>
> `oat_current_task_id` points at the next plan task to do.

## Progress Overview

| Phase | Status      | Tasks | Completed |
| ----- | ----------- | ----- | --------- |
| p01   | completed   | 3     | 3/3       |
| p02   | completed   | 4     | 4/4       |
| p03   | pending     | 3     | 0/3       |

**Total:** 7/10 tasks completed

## Phase p01: Provider Layout Spike And Go/No-Go Evidence

**Status:** completed
**Started:** 2026-07-07
**Completed:** 2026-07-07

### Task p01-t01: Prepare Spike Evidence Artifact

**Status:** completed
**Commit:** `81ad31d00b2c`

**Notes:**

- Created `.oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md`.
- Recorded required sections for Claude Code, Codex, Cursor Agent, Copilot,
  standalone recovery, and the go/no-go checkpoint.
- Recorded planned command/discovery steps from `plugins/consensus/README.md`,
  `RELEASING.md`, local CLI help, and GitHub Copilot CLI primary docs.
- Verification passed:
  - `test -f .oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md`
  - `rg -n "Claude Code|Codex|Cursor Agent|Copilot|standalone recovery|Go/no-go" .oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md`

### Task p01-t02: Run Provider Layout Checks

**Status:** completed
**Commit:** `d0411036743c`

**Notes:**

- Recorded live/provider-layout evidence in
  `.oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md`.
- Provider status summary:
  - Claude Code: pass; installed cache preserves sibling `scripts/` and
    `skills/` under
    `/Users/tstang/.claude/plugins/cache/skills/consensus/0.1.0`.
  - Codex: pass; runtime cache preserves sibling `scripts/` and `skills/`
    under `/Users/tstang/.codex/plugins/cache/skills/consensus/0.1.0`.
  - Cursor Agent: pass; local `--plugin-dir "$PWD/plugins/consensus"` loads the
    plugin root that contains sibling `scripts/` and `skills/`.
  - Copilot: pass; isolated temporary-HOME `npx -y @github/copilot plugin
    install "$PWD/plugins/consensus"` copied the full plugin root under
    `.copilot/installed-plugins/_direct/consensus` with sibling `scripts/` and
    `skills/`; direct local installs warn they are deprecated, so marketplace
    install should be the durable path.
  - Standalone recovery: pass; focused Vitest checks proved plugin-local CLI
    resolution, `~/.consensus/consensus.mjs` fallback, and the shared actionable
    `CONSENSUS_PROVIDER_CLI_MISSING` error.
- Verification passed:
  - `rg -n "Claude Code.*(pass|fail|blocked)|Codex.*(pass|fail|blocked)|Cursor Agent.*(pass|fail|blocked)|Copilot.*(pass|fail|blocked)|standalone recovery.*(pass|fail|blocked)" .oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md`

### Task p01-t03: Record Go/No-Go Recommendation

**Status:** completed
**Commit:** `a5d881ae77dc`

**Notes:**

- Recorded `Recommendation: go` in the spike artifact.
- Rationale: Claude Code, Codex, Cursor Agent, and Copilot all preserve a plugin
  root with `scripts/` beside `skills/`; standalone recovery remains
  actionable through `~/.consensus/consensus.mjs` with the shared missing-CLI
  error.
- Caveats recorded for Phase 2:
  - p01 proved layout/path geometry; p02-t04 still needs a focused
    shared-import smoke after `plugins/consensus/scripts/consensus-loop.mjs`
    exists.
  - Copilot direct local installs currently work but warn they are deprecated,
    so `--plugin-dir` or marketplace install should be the durable Copilot path.
  - Cursor evidence is local-load geometry, not an interactive model session.
- Verification passed:
  - `rg -n "Recommendation: (go|no-go)|Required checkpoint" .oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md`

### Phase p01 Summary

**Outcome:** go recommendation recorded. Provider layout evidence supports
continuing to Phase 2 after the configured p01 HiLL checkpoint.

**Key files touched:**

- `.oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md`
- `.oat/projects/shared/share-consensus-scripts/implementation.md`

**Verification run:**

- `test -f .oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md`
- `rg -n "Claude Code|Codex|Cursor Agent|Copilot|standalone recovery|Go/no-go" .oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md`
- `rg -n "Claude Code.*(pass|fail|blocked)|Codex.*(pass|fail|blocked)|Cursor Agent.*(pass|fail|blocked)|Copilot.*(pass|fail|blocked)|standalone recovery.*(pass|fail|blocked)" .oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md`
- `pnpm exec vitest run tests/consensus/core/resolve-consensus-cli-path.test.ts tests/consensus/provider-cli/missing-cli-message.test.ts`
- `rg -n "Recommendation: (go|no-go)|Required checkpoint" .oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md`

**Notable decisions/deviations:** none from the plan. The phase stopped after
p01 as required; `state.md` was intentionally left unchanged for the
orchestrator's checkpoint/review handling.

## Phase p02: Shared Runtime Build Migration

**Status:** completed
**Started:** 2026-07-07
**Completed:** 2026-07-07

### Task p02-t01: Update Generated-Output Mapping And Import Rewrites

**Status:** completed
**Commit:** `ec11f50ef514`

**Notes:**

- Updated `scripts/build-generated.mjs` so `src/consensus/core/consensus-loop.ts`
  emits one shared `plugins/consensus/scripts/consensus-loop.mjs` output.
- Rewrote the five generated consensus wrappers to import the shared loop from
  `../../../scripts/consensus-loop.mjs` while keeping duplicated
  `consensus-config.mjs` outputs unchanged.
- Updated `.oxfmtrc.json` and `.oxlintrc.json` static generated-output mirrors
  to include the shared plugin-root loop output and remove stale per-skill loop
  entries.
- Verification passed:
  - `node scripts/build-generated.mjs --list-outputs | rg '^plugins/consensus/scripts/consensus-loop\.mjs$'`
  - `if node scripts/build-generated.mjs --list-outputs | rg 'plugins/consensus/skills/.*/scripts/consensus-loop\.mjs'; then exit 1; else exit 0; fi`
  - `rg -n '\.\./\.\./\.\./scripts/consensus-loop\.mjs' scripts/build-generated.mjs`
  - `rg -n 'plugins/consensus/scripts/consensus-loop\.mjs' .oxfmtrc.json .oxlintrc.json`
  - `if rg -n 'plugins/consensus/skills/.*/scripts/consensus-loop\.mjs' .oxfmtrc.json .oxlintrc.json; then exit 1; else exit 0; fi`
- Self-review: scope stayed within the task file list; `.lintstagedrc.mjs` was
  intentionally unchanged because it derives generated paths from
  `scripts/build-generated.mjs --list-outputs`.

### Task p02-t02: Update Drift And Layout Regression Tests

**Status:** completed
**Commit:** `af43b73cefd2`

**Notes:**

- Updated `tests/tooling/generated-output-sync.test.ts` so mapping assertions
  expect one shared plugin-root `consensus-loop.mjs` output and no per-skill
  loop outputs.
- Added a plugin-root layout regression test that resolves the five wrapper
  loop import rewrites to `plugins/consensus/scripts/consensus-loop.mjs`.
- Updated the import-rewrite unit test to use the new shared loop target.
- No fixture file was needed; the regression is expressed against
  `generatedOutputs` and URL resolution for the repository plugin layout.
- Verification passed:
  - `rg -n "shared plugin loop|plugin-root.*loop|consensus/scripts/consensus-loop" tests/tooling/generated-output-sync.test.ts`
  - `pnpm exec vitest run tests/tooling/generated-output-sync.test.ts -t "declares source to generated-output mappings|shared plugin loop|plugin-root"` (1 file, 3 tests passed, 12 skipped)
- Self-review: tests cover the changed mapping and wrapper resolution behavior
  without asserting full generated-output drift before p02-t03 regenerates
  committed outputs.

### Task p02-t03: Regenerate Outputs, Remove Duplicates, And Bump Skill Versions

**Status:** completed
**Commit:** `b766a84f0d8a`

**Notes:**

- Ran `pnpm run build`, which generated
  `plugins/consensus/scripts/consensus-loop.mjs` and regenerated the five
  consensus wrapper outputs with the shared loop import.
- Removed stale tracked per-skill loop outputs under
  `plugins/consensus/skills/{create,decide,evaluate,plan,refine}/scripts/`.
- Bumped changed consensus skill versions in both top-level `version` and
  `metadata.version`:
  - `create`: `0.1.2` -> `0.1.3`
  - `decide`: `0.1.2` -> `0.1.3`
  - `evaluate`: `0.1.4` -> `0.1.5`
  - `plan`: `0.1.2` -> `0.1.3`
  - `refine`: `0.1.3` -> `0.1.4`
- Confirmed `scripts/bump-version.mjs` already lists the five changed consensus
  skill files in `SKILL_FILES`; no update was needed.
- Verification passed:
  - `pnpm run build`
  - `rg -n "from '../../../scripts/consensus-loop\.mjs'|from './consensus-loop\.mjs'" plugins/consensus/skills/{create,decide,evaluate,plan,refine}/scripts/*.mjs` (five shared imports; no stale local loop imports)
  - `if git ls-files 'plugins/consensus/skills/*/scripts/consensus-loop.mjs' | rg .; then exit 1; else exit 0; fi`
  - `rg -n "plugins/consensus/skills/(create|decide|evaluate|plan|refine)/SKILL.md" scripts/bump-version.mjs`
  - `pnpm run build:check`
- Skill-version verification caveat: the plan's literal
  `pnpm run validate:skill-versions -- --base-ref "$BASE_REF"` passed an extra
  `--` to `scripts/validate-skill-versions.mjs` under the installed pnpm/script
  behavior and failed with `unexpected argument: --`. The accepted command shape
  is `pnpm run validate:skill-versions --base-ref "$BASE_REF"`. Before this
  task commit, that accepted command exits 0 but reports no changed skills
  because the script compares `base...HEAD` and does not include uncommitted
  task changes; rerun it after this commit and record the post-commit result in
  the next tracker update.
- Post-commit skill-version verification passed:
  `BASE_REF=$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main); pnpm run validate:skill-versions --base-ref "$BASE_REF"` verified 5 changed skills against `ff40c8e20c6c979d034b707b5ac090287be2452b`.
- Self-review: generated `.mjs` outputs were produced by `pnpm run build`, not
  hand-edited; `consensus-config.mjs` duplication remains unchanged.

### Task p02-t04: Run Focused Runtime Smoke For Shared Imports

**Status:** completed
**Commit:** `9c99a9f21b32`

**Notes:**

- Ran a focused Node ESM smoke that imports all five generated consensus
  wrappers from the repository plugin layout:
  `create`, `decide`, `evaluate`, `plan`, and `refine`.
- The smoke printed `Shared import smoke: pass`, proving the generated wrapper
  import `../../../scripts/consensus-loop.mjs` resolves to
  `plugins/consensus/scripts/consensus-loop.mjs` at runtime.
- Recorded the command, result, and caveat in
  `.oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md`.
- Provider caveat: the smoke intentionally did not mutate user-level Claude Code
  or Codex caches or repoint configured marketplaces; p01 already proved those
  layouts preserve plugin-root `scripts/` beside `skills/`.
- Verification passed:
  - focused Node wrapper import smoke (five wrappers loaded; `Shared import smoke: pass`)
  - `pnpm run build:check`
  - `pnpm exec vitest run tests/tooling/generated-output-sync.test.ts` (1 file, 15 tests passed)
  - `rg -n "Shared import smoke.*pass" .oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md`
- Self-review: p02 migration behavior is covered by build mapping checks,
  generated-output drift tests, wrapper import loading, and skill-version
  validation; no p03 documentation or PJM closeout work was started.

### Phase p02 Summary

**Outcome:** shared runtime build migration completed and ready for p02 code
review. Phase 3 was not started.

**Key files touched:**

- `scripts/build-generated.mjs`
- `.oxfmtrc.json`
- `.oxlintrc.json`
- `tests/tooling/generated-output-sync.test.ts`
- `plugins/consensus/scripts/consensus-loop.mjs`
- `plugins/consensus/skills/{create,decide,evaluate,plan,refine}/scripts/*.mjs`
- `plugins/consensus/skills/{create,decide,evaluate,plan,refine}/SKILL.md`
- `.oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md`
- `.oat/projects/shared/share-consensus-scripts/implementation.md`

**Verification run:**

- p02-t01 mapping/static mirror commands.
- p02-t02 focused generated-output mapping/layout Vitest selection.
- `pnpm run build`
- `pnpm run build:check`
- `pnpm run validate:skill-versions --base-ref "$BASE_REF"` after p02-t03
  commit.
- focused Node shared-import smoke.
- `pnpm exec vitest run tests/tooling/generated-output-sync.test.ts`

**Notable decisions/deviations:** `consensus-config.mjs` duplication stayed
unchanged as planned. The only deviation is the p02-t03 skill-version command
argv/timing issue recorded in `## Deviations from Plan / Design`.

## Phase p03: Documentation, PJM Closeout, And Final Verification

**Status:** pending
**Started:** -

### Task p03-t01: Update Documentation For Runtime Layout

**Status:** pending
**Commit:** -

### Task p03-t02: Close Backlog Item And Remove Consumed Handoff

**Status:** pending
**Commit:** -

### Task p03-t03: Run Full Validation And Record Final Evidence

**Status:** pending
**Commit:** -

## Orchestration Runs

_Each run from `oat-project-implement` appends an entry below with run metadata,
phase outcomes, parallel groups, and outstanding items._

<!-- orchestration-runs-start -->

### Run 1 — 2026-07-07 05:30

**Branch:** share-consensus-scripts
**Tier:** 1
**Policy:** merge-strategy=merge, retry-limit=2
**Phases:** 1 executed, 1 passed, 0 failed, 1 stopped

#### Phase Outcomes

| Phase | Implementer | Review | Fix Iterations | Disposition |
| ----- | ----------- | ------ | -------------- | ----------- |
| p01 | DONE | pass_with_findings | 0/2 | passed; stopped at p01 HiLL checkpoint |

#### Parallel Groups

- Singleton phase p01: sequential native subagent dispatch

#### Dispatch Notes

- Dispatch: p01 implementer used `oat-phase-implementer-xhigh`; reviewer used `oat-reviewer-xhigh`; both matched the project-state Codex ceiling (`xhigh`, provider default `medium`).
- Review artifact: `reviews/archived/p01-review-2026-07-07.md`.
- Auto-review at HiLL checkpoints is enabled. p01 already has passed whole-phase code-review coverage from the Tier 1 phase reviewer, so there is no uncovered implementation scope left for an additional lifecycle review before the checkpoint pause.

#### Outstanding Items

- None.

#### Artifact / Design Deltas

Run-scoped snapshot only. The durable record is `## Deviations from Plan / Design`; consolidate any non-`None` entries there at the next phase boundary.

| Task / Review | Source Artifact | Planned / Documented | Actual / Accepted | Reason | Source of Truth | Follow-up |
| ------------- | --------------- | -------------------- | ----------------- | ------ | --------------- | --------- |
| None | - | - | - | - | - | - |

### Run 2 — 2026-07-07 14:21

**Branch:** share-consensus-scripts
**Tier:** 1
**Policy:** merge-strategy=merge, retry-limit=2
**Phases:** 1 executed, 1 passed, 0 failed, 0 stopped

#### Phase Outcomes

| Phase | Implementer | Review | Fix Iterations | Disposition |
| ----- | ----------- | ------ | -------------- | ----------- |
| p02 | DONE_WITH_CONCERNS | pass_with_findings | 0/2 | passed; continue to p03 |

#### Parallel Groups

- Singleton phase p02: sequential native subagent dispatch

#### Dispatch Notes

- Dispatch: p02 implementer used `oat-phase-implementer-xhigh`; reviewer dispatch used `oat-reviewer-xhigh` but stalled after two waits and one nudge, so the orchestrator completed the p02 review inline per the OAT fallback rule.
- Review artifact: `reviews/archived/p02-review-2026-07-07.md`.
- The implementer concern was the p02-t03 `validate:skill-versions` argv shape, not a runtime correctness issue. The accepted command passed post-commit and the plan command was aligned during bookkeeping.

#### Outstanding Items

- None.

#### Artifact / Design Deltas

Run-scoped snapshot only. The durable record is `## Deviations from Plan / Design`; consolidate any non-`None` entries there at the next phase boundary.

| Task / Review | Source Artifact | Planned / Documented | Actual / Accepted | Reason | Source of Truth | Follow-up |
| ------------- | --------------- | -------------------- | ----------------- | ------ | --------------- | --------- |
| p02-t03 / p02 review | `plan.md` | `pnpm run validate:skill-versions -- --base-ref "$BASE_REF"` | `pnpm run validate:skill-versions --base-ref "$BASE_REF"` | Current pnpm passes the extra separator through to `scripts/validate-skill-versions.mjs`; the accepted command is verified and now reflected in `plan.md`. | `plan.md` and `scripts/validate-skill-versions.mjs` | Resolved in this bookkeeping update. |

<!-- orchestration-runs-end -->

### Review Received: p01 code

**Date:** 2026-07-07
**Review artifact:** `reviews/archived/p01-review-2026-07-07.md`

**Findings:**

- Critical: 0
- Important: 0
- Medium: 0
- Minor: 1

**Disposition:**

- Minor tracker bookkeeping drift resolved in this phase-boundary bookkeeping
  update: `p01-t03` now records commit `a5d881ae77dc`, p01 is marked passed in
  `plan.md`, and `state.md` is advanced to the p01 checkpoint handoff.

**Next:** await the configured p01 go/no-go checkpoint decision before Phase 2.

### Review Received: p02 code

**Date:** 2026-07-07
**Review artifact:** `reviews/archived/p02-review-2026-07-07.md`

**Findings:**

- Critical: 0
- Important: 0
- Medium: 0
- Minor: 1

**Disposition:**

- Minor plan-command drift resolved in this phase-boundary bookkeeping update:
  p02-t03 now uses `pnpm run validate:skill-versions --base-ref "$BASE_REF"`
  in `plan.md`, matching the verified command shape.
- `p02-t04` now records commit `9c99a9f21b32`, p02 is marked passed in
  `plan.md`, and `state.md` is advanced to p03.

**Next:** continue with p03 documentation, PJM closeout, and final validation.

## Implementation Log

### 2026-07-07

- Quick-start project scaffolded.
- Discovery completed from the backlog handoff and source artifacts.
- Plan generated with p01 as the required go/no-go checkpoint.
- Dispatch ceiling selected: maximum (`codex: xhigh`, `claude: opus`).
- Plan artifact review passed inline after one artifact-local fix.

### Review Received: plan

**Date:** 2026-07-07
**Review artifact:** `reviews/archived/artifact-plan-review-2026-07-06.md`

**Findings:**

- Critical: 0
- Important: 1
- Medium: 1
- Minor: 3

**Disposition:**

- I1 `resolve_in_artifact`: p02-t01 now includes `.oxfmtrc.json` and
  `.oxlintrc.json`, updates static generated-output mirrors, and stages those
  files with the mapping change.
- M1 `resolve_in_artifact`: p02-t02 now documents Phase 2 coupling and narrows
  verification to the edited assertions; the full drift guard is reserved for
  p02-t04 after regeneration.
- m1 `resolve_in_artifact`: no-go handling now reuses the existing
  outcome-aware p03 tasks and appends only genuinely novel cleanup.
- m2 `resolve_in_artifact`: p02-t02 now includes a positive `rg` guard for the
  shared plugin-loop regression test.
- m3 `resolve_in_artifact`: p02-t01 now names the literal rewrite target
  `../../../scripts/consensus-loop.mjs`.

**New tasks added:** none; artifact review findings were resolved directly in
`plan.md`.

**Next:** re-run the configured quick-start gate review.

### Review Received: plan re-verification

**Date:** 2026-07-07
**Review artifact:** `reviews/archived/artifact-plan-review-2026-07-06-r2.md`

**Findings:**

- Critical: 0
- Important: 0
- Medium: 0
- Minor: 1

**Disposition:**

- m1 `resolve_in_artifact`: p02-t01 verify now includes a source-level `rg`
  guard for the literal `../../../scripts/consensus-loop.mjs` import rewrite
  target.

**New tasks added:** none; artifact review finding was resolved directly in
`plan.md`.

**Next:** quick-start gate consumed; run `oat-project-implement`.

## Deviations from Plan / Design

| Task / Review | Source Artifact | Planned / Documented | Actual / Accepted | Reason | Source of Truth | Follow-up |
| ------------- | --------------- | -------------------- | ----------------- | ------ | --------------- | --------- |
| p02-t03 / p02 review | `plan.md` | Verify with `pnpm run validate:skill-versions -- --base-ref "$BASE_REF"` before the task commit | Literal command failed with `unexpected argument: --`; accepted command is `pnpm run validate:skill-versions --base-ref "$BASE_REF"` and passed after the task commit, verifying five changed skills | Current pnpm/script argv behavior passes the separator through to this script, and the validator compares `base...HEAD` rather than the working tree | `plan.md` and `scripts/validate-skill-versions.mjs` CLI parser | Resolved by aligning the p02-t03 plan command in p02 bookkeeping; no source-code follow-up needed |

## Test Results

| Phase | Tests Run | Passed | Failed | Coverage |
| ----- | --------- | ------ | ------ | -------- |
| quick-start | `git diff --check` | yes | 0 | artifact whitespace |
| p01-t01 | `test -f .oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md` | yes | 0 | spike artifact exists |
| p01-t01 | `rg -n "Claude Code|Codex|Cursor Agent|Copilot|standalone recovery|Go/no-go" .oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md` | yes | 0 | required sections present |
| p01-t02 | `rg -n "Claude Code.*(pass|fail|blocked)|Codex.*(pass|fail|blocked)|Cursor Agent.*(pass|fail|blocked)|Copilot.*(pass|fail|blocked)|standalone recovery.*(pass|fail|blocked)" .oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md` | yes | 0 | provider statuses recorded |
| p01-t02 | `pnpm exec vitest run tests/consensus/core/resolve-consensus-cli-path.test.ts tests/consensus/provider-cli/missing-cli-message.test.ts` | yes | 0 | standalone recovery path; 2 files, 6 tests |
| p01-t03 | `rg -n "Recommendation: (go|no-go)|Required checkpoint" .oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md` | yes | 0 | go recommendation and checkpoint recorded |
| p02-t01 | `node scripts/build-generated.mjs --list-outputs \| rg '^plugins/consensus/scripts/consensus-loop\.mjs$'` | yes | 0 | shared plugin-root loop output listed |
| p02-t01 | `if node scripts/build-generated.mjs --list-outputs \| rg 'plugins/consensus/skills/.*/scripts/consensus-loop\.mjs'; then exit 1; else exit 0; fi` | yes | 0 | stale per-skill loop outputs removed from mapping |
| p02-t01 | `rg -n '\.\./\.\./\.\./scripts/consensus-loop\.mjs' scripts/build-generated.mjs` | yes | 0 | five wrapper import rewrites point at shared plugin loop |
| p02-t01 | `rg -n 'plugins/consensus/scripts/consensus-loop\.mjs' .oxfmtrc.json .oxlintrc.json` | yes | 0 | static lint/format mirrors include shared loop output |
| p02-t01 | `if rg -n 'plugins/consensus/skills/.*/scripts/consensus-loop\.mjs' .oxfmtrc.json .oxlintrc.json; then exit 1; else exit 0; fi` | yes | 0 | static lint/format mirrors removed stale per-skill loop outputs |
| p02-t02 | `rg -n "shared plugin loop\|plugin-root.*loop\|consensus/scripts/consensus-loop" tests/tooling/generated-output-sync.test.ts` | yes | 0 | shared loop and plugin-root regression test text present |
| p02-t02 | `pnpm exec vitest run tests/tooling/generated-output-sync.test.ts -t "declares source to generated-output mappings\|shared plugin loop\|plugin-root"` | yes | 0 | focused generated-output mapping/layout tests; 1 file, 3 tests passed, 12 skipped |
| p02-t03 | `pnpm run build` | yes | 0 | generated shared loop output and wrapper imports |
| p02-t03 | `rg -n "from '../../../scripts/consensus-loop\.mjs'\|from './consensus-loop\.mjs'" plugins/consensus/skills/{create,decide,evaluate,plan,refine}/scripts/*.mjs` | yes | 0 | five wrappers import shared plugin loop; no stale local loop imports |
| p02-t03 | `if git ls-files 'plugins/consensus/skills/*/scripts/consensus-loop.mjs' \| rg .; then exit 1; else exit 0; fi` | yes | 0 | stale per-skill loop outputs removed from tracked files |
| p02-t03 | `rg -n "plugins/consensus/skills/(create\|decide\|evaluate\|plan\|refine)/SKILL.md" scripts/bump-version.mjs` | yes | 0 | release bump tooling already covers changed consensus skills |
| p02-t03 | `pnpm run build:check` | yes | 0 | generated outputs in sync |
| p02-t03 | `BASE_REF=$(git merge-base HEAD origin/main 2>/dev/null \|\| git merge-base HEAD main); pnpm run validate:skill-versions -- --base-ref "$BASE_REF"` | no | 2 | literal plan command passes an extra `--` to this script; see deviation |
| p02-t03 | `BASE_REF=$(git merge-base HEAD origin/main 2>/dev/null \|\| git merge-base HEAD main); pnpm run validate:skill-versions --base-ref "$BASE_REF"` | yes | 0 | accepted argv shape; pre-commit run cannot see uncommitted skill changes because the script compares `base...HEAD` |
| p02-t03 | `BASE_REF=$(git merge-base HEAD origin/main 2>/dev/null \|\| git merge-base HEAD main); pnpm run validate:skill-versions --base-ref "$BASE_REF"` | yes | 0 | post-commit run verified 5 changed skills against `ff40c8e20c6c979d034b707b5ac090287be2452b` |
| p02-t04 | focused Node wrapper import smoke | yes | 0 | all five generated wrappers loaded; `Shared import smoke: pass` |
| p02-t04 | `pnpm run build:check` | yes | 0 | generated outputs in sync after smoke |
| p02-t04 | `pnpm exec vitest run tests/tooling/generated-output-sync.test.ts` | yes | 0 | 1 file, 15 tests passed |
| p02-t04 | `rg -n "Shared import smoke.*pass" .oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md` | yes | 0 | smoke result recorded in spike artifact |

## Final Summary (for PR/docs)

Pending implementation.

## References

- Plan: `plan.md`
- Discovery: `discovery.md`
- Backlog handoff: `.oat/repo/pjm/handoffs/BL-260620-share-consensus-generated.md`
