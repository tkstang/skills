---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-21
oat_current_task_id: p02-t01
oat_generated: false
---

# Implementation: consensus-family

**Started:** 2026-06-21
**Last Updated:** 2026-06-21

> This document is used to resume interrupted implementation sessions.
>
> Conventions:
>
> - `oat_current_task_id` always points at the **next plan task to do** (not the last completed task).
> - When all plan tasks are complete, set `oat_current_task_id: null`.
> - Reviews are **not** plan tasks. Track review status in `plan.md` under `## Reviews` (e.g., `| final | code | passed | ... |`).
> - Keep phase/task statuses consistent with the Progress Overview table so restarts resume correctly.
> - Before running the `oat-project-pr-final` skill, ensure `## Final Summary (for PR/docs)` is filled with what was actually implemented.

## Progress Overview

| Phase   | Status  | Tasks | Completed |
| ------- | ------- | ----- | --------- |
| Phase 1 | passed  | 6     | 6/6       |
| Phase 2 | pending | 5     | 0/5       |
| Phase 3 | pending | 5     | 0/5       |
| Phase 4 | pending | 5     | 0/5       |

**Total:** 6/21 tasks completed

---

## Phase 1: Loop-Core `independent_draft`

**Status:** passed
**Started:** 2026-06-21
**Completed:** 2026-06-21

### Phase Summary

**Outcome (what changed):**

- The shared consensus loop now accepts `independent_draft` as a first-class cold-start mode while preserving `shared_input` defaults.
- Round-1 prompt building receives `coldStart` and frames `independent_draft` inputs as untrusted briefs for peers to draft from independently.
- Loop-level tests prove `independent_draft` reaches terminal convergence in alternating, `parallel_revision`, and `parallel_synthesized` modes.
- `refine` and `evaluate` remain deliberately `shared_input`-only with clearer semantic guard errors for `independent_draft`.
- Generated runtime outputs for existing consensus skills were rebuilt, and changed skill versions/frontmatter invariants were updated.

**Key files touched:**

- `src/consensus/core/consensus-loop.ts` - widened cold-start support, prompt threading, and round-1 independent-draft framing.
- `src/consensus/refine/consensus-refine.ts` - preserved `shared_input`-only guard wording for refine.
- `src/consensus/evaluate/consensus-evaluate.ts` - preserved `shared_input`-only guard wording for evaluate.
- `plugins/consensus/skills/refine/` and `plugins/consensus/skills/evaluate/` - regenerated shipped runtime output and bumped changed skill versions.
- `tests/consensus/core/independent-draft-loop.test.ts` and `tests/consensus/core/independent-draft-prompts.test.ts` - covered independent-draft prompt and convergence behavior.

**Verification:**

- Run: `pnpm exec vitest run tests/consensus/core/loop-cli.test.ts tests/consensus/core/independent-draft-prompts.test.ts tests/consensus/core/independent-draft-loop.test.ts tests/consensus/evaluate/prompt-profile.test.ts tests/consensus/evaluate/wrapper.test.ts tests/consensus/refine/wrapper-options.test.ts tests/repo/skill-frontmatter.test.ts`
- Result: passed after the p01 review fix.
- Run: `pnpm run build:check && pnpm run type-check && pnpm run test && pnpm run validate && pnpm run validate:skill-versions --base-ref main && pnpm run smoke`
- Result: passed in the p01 implementation/re-review cycle.

**Notes / Decisions:**

- `validate:skill-versions` accepts `--base-ref main` without an extra `--`; the plan command was treated as artifact drift.
- Updating `tests/repo/skill-frontmatter.test.ts` was required after refine/evaluate skill version bumps so the invariant checks the synced `version`/`metadata.version` shape instead of old literal values.

### Task p01-t01: Widen Cold-Start Types and Parser

**Status:** completed
**Commit:** `6713935`

---

### Task p01-t02: Thread Cold Start Into Prompt Builders

**Status:** completed
**Commit:** `4769f01`

---

### Task p01-t03: Frame Round-1 Independent Draft Prompts

**Status:** completed
**Commit:** `f7931f1`

---

### Task p01-t04: Prove Independent Draft Across Iteration Modes

**Status:** completed
**Commit:** `4152831`, `57449eb`

---

### Task p01-t05: Preserve Refine and Evaluate Shared-Input Guards

**Status:** completed
**Commit:** `ae3a70e`

---

### Task p01-t06: Regenerate Existing Skill Runtime and Version Bumps

**Status:** completed
**Commit:** `a65b133`, `1cfdb9d`

---

## Review Received: plan

**Date:** 2026-06-21
**Review artifact:** `reviews/archived/artifact-plan-review-2026-06-21.md`
**Type:** artifact review

**Findings:**

- Critical: 0
- Important: 2
- Medium: 2
- Minor: 3

**Actions taken:**

- Resolved `I1` by adding `CHANGELOG.md` coverage to the documentation tasks and requiring CHANGELOG assertions.
- Resolved `I2` by adding provider plugin manifest description updates to `p02-t04`, including `plugin-manifests.test.ts` coverage and an explicit no-version-bump-without-release-decision note.
- Resolved `M1` by tightening `SKILL.md` required-section guidance for create/decide/plan and calling out the hardcoded shipped-skill test allowlists.
- Resolved `M2` by adding `p01-t02` to the FR1/FR2 requirement index rows in `spec.md`.
- Resolved `m1` by adding a closeout bookkeeping note that durable decision promotion and backlog/roadmap cleanup belong to `oat-project-complete`.
- Rejected `m2` with rationale: `p01-t06` correctly omits `scripts/bump-version.mjs` because refine/evaluate are already listed in `SKILL_FILES`.
- Rejected `m3` with rationale: splitting design Phase 3 into separate decide and plan phases is a deliberate implementation-plan refinement that matches the separate-PR intent.

**Plan status:** artifact fixes completed; awaiting plan re-review before marking `plan.md` complete.

---

## Review Received: plan re-review

**Date:** 2026-06-21
**Review artifact:** `reviews/archived/artifact-plan-review-2026-06-21-v2.md`
**Type:** artifact review

**Findings:**

- Critical: 0
- Important: 0
- Medium: 2
- Minor: 3

**Actions taken:**

- Resolved `M1` by explicitly naming the `tests/release/versioning.test.ts` `skillFiles` allowlist alongside the two `tests/repo/skill-frontmatter.test.ts` shipped-skill allowlists in the create/decide/plan skill-anatomy tasks.
- Resolved `M2` by requiring each docs task to remove its shipped skill from the `documentation/docs/user-guide/consensus/index.md` future-work limitation and to add a negative docs assertion that the shipped skill is not still described as future work.
- Resolved `m1` by marking `documentation/index.md` as generated/do-not-hand-edit in the docs task file lists.
- Resolved `m2` by requiring a generated-runtime table assertion and direct edit of `documentation/docs/engineering/architecture/generated-runtime.md`.
- Rejected `m3` with rationale: the closeout/DR-promotion item was already resolved by the plan's `Closeout Bookkeeping` section.

**Plan status:** user approved proceeding after artifact fixes; `plan.md` marked complete and ready for `oat-project-implement`.

---

## Phase 2: {Phase Name}

**Status:** pending
**Started:** -

### Task p02-t01: {Task Name}

**Status:** pending
**Commit:** -

---

## Orchestration Runs

_Each run from `oat-project-implement` appends an entry below with:_
_- Run header (number, timestamp, branch, tier, policy, phase counts)_
_- Phase Outcomes table_
_- Parallel Groups list_
_- Outstanding Items_

<!-- orchestration-runs-start -->

### Run 1 — 2026-06-21 22:26

**Branch:** consensus-family
**Tier:** 1
**Policy:** merge-strategy=direct, retry-limit=2
**Phases:** 1 executed, 1 passed, 0 failed, 0 stopped

#### Phase Outcomes

| Phase | Implementer | Review | Fix Iterations | Disposition |
| ----- | ----------- | ------ | -------------- | ----------- |
| p01   | DONE        | pass   | 1/2            | passed      |

#### Parallel Groups

- p01: sequential

#### Dispatch Notes

- Dispatch: p01 implementation used `effort_axis=selected:xhigh`, `model_axis=inherited`; reviewer used `oat-reviewer-xhigh`.
- Dispatch: p01 fix for C1 used `effort_axis=selected:high`, `model_axis=inherited`.

#### Outstanding Items

- None.

#### Artifact / Design Deltas

| Task / Review | Source Artifact | Planned / Documented | Actual / Accepted | Reason | Source of Truth | Follow-up |
| ------------- | --------------- | -------------------- | ----------------- | ------ | --------------- | --------- |
| p01-t06       | plan.md p01-t06 verification | `pnpm run validate:skill-versions -- --base-ref main` | `pnpm run validate:skill-versions --base-ref main` | Package script passes args directly to the validator and rejects the extra `--` token. | `package.json` script + validator CLI | No code follow-up. |
| p01-t06       | plan.md p01-t06 file list | Skill directories only | Also updated `tests/repo/skill-frontmatter.test.ts` | Refine/evaluate version bumps made the frontmatter invariant stale. | Repository test suite | No code follow-up. |

_Orchestration runs from `oat-project-implement` are appended here, most-recent-first within the file but append-only at the bottom of the log._

<!-- orchestration-runs-end -->

---

## Implementation Log

Chronological log of implementation progress.

### 2026-06-21

**Session Start:** 22:26 UTC

- [x] p01-t01: Widen cold-start parser - `6713935`
- [x] p01-t02: Thread cold-start into prompt builders - `4769f01`
- [x] p01-t03: Frame independent draft prompts - `f7931f1`
- [x] p01-t04: Prove independent draft modes - `4152831`, fix `57449eb`
- [x] p01-t05: Preserve shared-input guards - `ae3a70e`
- [x] p01-t06: Regenerate existing consensus runtime - `a65b133`, `1cfdb9d`

**What changed (high level):**

- `independent_draft` is now a loop-core cold-start mode with round-1 brief framing.
- Existing `refine`/`evaluate` wrappers retain their `shared_input`-only behavior.
- Loop-level tests cover prompt framing and terminal convergence across all three iteration modes.

**Decisions:**

- Accepted the package script's `validate:skill-versions --base-ref main` invocation shape as source of truth.

**Follow-ups / TODO:**

- None for p01.

**Blockers:**

- p01 review C1 identified missing convergence assertions; resolved by `57449eb`.

**Session End:** 22:26 UTC

---

## Deviations from Plan / Design

Document any intentional deviations from the original plan, spec, or design. Include accepted review findings where the shipped implementation is source of truth and a lifecycle artifact needs alignment.

| Task / Review | Source Artifact | Planned / Documented | Actual / Accepted | Reason | Source of Truth | Follow-up |
| ------------- | --------------- | -------------------- | ----------------- | ------ | --------------- | --------- |
| p01-t06       | plan.md p01-t06 verification | `pnpm run validate:skill-versions -- --base-ref main` | `pnpm run validate:skill-versions --base-ref main` | The package script passes arguments directly to `scripts/validate-skill-versions.mjs` and rejects the extra `--` token. The accepted form runs the same validator against `main`. | `package.json` script + `scripts/validate-skill-versions.mjs` CLI | Update the plan command if the artifact is revised; no code follow-up. |
| p01-t06       | plan.md p01-t06 file list | `plugins/consensus/skills/refine`, `plugins/consensus/skills/evaluate` only | Also updated `tests/repo/skill-frontmatter.test.ts` | The required refine/evaluate skill version bumps made the repository frontmatter invariant test stale; full phase verification failed until the invariant asserted version consistency instead of the old literal `0.1.0`. | Repository test suite | Plan file list should include this invariant if p01-t06 is revised; no code follow-up. |

## Test Results

Track test execution during implementation.

| Phase | Tests Run | Passed | Failed | Coverage |
| ----- | --------- | ------ | ------ | -------- |
| 1     | targeted p01 Vitest suites; `build:check`; `type-check`; `test`; `validate`; `validate:skill-versions --base-ref main`; `smoke` | yes    | 0      | n/a      |
| 2     | -         | -      | -      | -        |

## Final Summary (for PR/docs)

**What shipped:**

- {capability 1}
- {capability 2}

**Behavioral changes (user-facing):**

- {bullet}

**Key files / modules:**

- `{path}` - {purpose}

**Verification performed:**

- {tests/lint/typecheck/build/manual steps}

**Design deltas (if any):**

- {what changed vs design.md and why}

## References

- Plan: `plan.md`
- Design: `design.md`
- Spec: `spec.md`
