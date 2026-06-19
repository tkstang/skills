---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-06-19
oat_phase: plan
oat_phase_status: complete
oat_plan_hill_phases: []
oat_plan_parallel_groups: []
oat_plan_source: quick
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
---

# Implementation Plan: v01-release-verification

> Execute this plan using `oat-project-implement` or inline in this worktree. Keep the scope to release verification and packaging.

**Goal:** Verify and package the current consensus v0.1 feature set from latest `main`, with evidence-backed release gates and no test-organization cleanup.

**Architecture:** Documentation and release-gate work only unless a real blocker is found. Generated consensus runtimes stay derived from canonical TypeScript and are not hand-edited.

**Tech Stack:** Node >=22, pnpm, TypeScript, Vitest, OAT project artifacts, provider CLIs, Paseo, GitHub release workflow metadata.

**Commit Convention:** Conventional Commits, e.g. `docs(release): refresh v0.1 verification evidence`.

## Planning Checklist

- [x] Confirmed HiLL checkpoints with user: quick mode, no phase checkpoints requested.
- [x] Set `oat_plan_hill_phases` in frontmatter.
- [x] Evaluated phases for parallelism opportunities.
- [x] Set `oat_plan_parallel_groups` in frontmatter.

## Parallelism

Keep the plan sequential. The release checklist, README/CHANGELOG edits, provider QA notes, and PR summary all touch overlapping release documentation and depend on the same evidence set. Parallel worktrees would add merge friction without shortening the critical path.

## Reviews

| Review | Type | Status | Notes |
| ------ | ---- | ------ | ----- |
| plan | artifact | passed | Inline review confirmed scope, release gates, verification coverage, and public-claim gating. |
| final | code | pending | Run after release docs/checklist updates and verification evidence are complete. |

## Phase 1: Establish Current Evidence Baseline

### Task p01-t01: Verify checkout, release scope, and prior evidence

**Files:**

- Modify: `.oat/projects/shared/v01-release-verification/implementation.md`
- Read: `.oat/repo/reference/backlog/items/complete-v01-release-verification.md`
- Read: `.oat/repo/reference/current-state.md`
- Read: PR #9 metadata/body via `gh pr view 9`

**Steps:**

1. Record the current branch, `origin/main` commit, and worktree decision.
2. Capture which PR #9 evidence is still reusable for `consensus-refine`.
3. Identify evidence that must be rerun because the TypeScript/Vitest and `consensus-evaluate` work landed after PR #9.

**Verification:**

- Run: `git status --short --branch`
- Run: `git rev-parse HEAD origin/main`
- Run: `gh pr view 9 --json number,title,state,mergedAt,url`

**Commit:** `chore(release): record v0.1 verification baseline`

### Task p01-t02: Rerun required automated release gates

**Files:**

- Modify: `.oat/projects/shared/v01-release-verification/implementation.md`
- Modify as needed: `RELEASING.md`
- Modify as needed: `CHANGELOG.md`

**Steps:**

1. Run all required automated gates on the current branch.
2. Record exact pass/fail evidence and any caveats.
3. Do not replace current verification with older PR #9 evidence.

**Verification:**

- Run: `pnpm run build`
- Run: `pnpm run type-check`
- Run: `pnpm run build:check`
- Run: `pnpm run test`
- Run: `pnpm run validate`
- Run: `pnpm run smoke`

**Commit:** `chore(release): record automated v0.1 gate results`

## Phase 2: Verify Provider and Release Documentation Gates

### Task p02-t01: Check provider install and permission surfaces

**Files:**

- Modify: `RELEASING.md`
- Modify as needed: `README.md`
- Modify as needed: `plugins/consensus/README.md`
- Modify as needed: `plugins/consensus/skills/refine/references/operator-qa.md`
- Modify as needed: `plugins/consensus/skills/evaluate/references/operator-qa.md`
- Modify: `.oat/projects/shared/v01-release-verification/implementation.md`

**Steps:**

1. Inspect live Claude Code, Cursor, Codex, Paseo, and Agent Skills CLI surfaces without making irreversible marketplace claims.
2. Smoke provider install/permission behavior where safe and record manual blockers where interactive or post-publication checks are required.
3. Ensure both shipped consensus skills are represented in provider QA notes.

**Verification:**

- Run relevant `--help`, `plugin`, `marketplace`, `skills`, and `paseo provider ls --json` commands.
- Run targeted static checks for manifest paths and skill entries.

**Commit:** `docs(release): refresh provider verification gates`

### Task p02-t02: Refresh README, CHANGELOG, version, and tag readiness

**Files:**

- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `RELEASING.md`
- Modify as needed: provider manifests and marketplace metadata through `scripts/bump-version.mjs`
- Modify: `.oat/projects/shared/v01-release-verification/implementation.md`

**Steps:**

1. Confirm README install matrix matches live CLI surfaces.
2. Refresh CHANGELOG v0.1.0 notes for both `consensus-refine` and `consensus-evaluate`.
3. Check version/tag readiness without pushing a tag.
4. Confirm release workflow gating for tags.

**Verification:**

- Run: `node scripts/bump-version.mjs --check-tag v0.1.0`
- Run: `pnpm run validate`
- Inspect `.github/workflows/*release*` or relevant validation workflow.

**Commit:** `docs(release): prepare v0.1 release notes`

## Phase 3: Capture Remaining Gates and PR Package

### Task p03-t01: Record release blockers and post-tag discovery gates

**Files:**

- Modify: `.oat/repo/reference/current-state.md`
- Modify as needed: `.oat/repo/reference/backlog/items/complete-v01-release-verification.md`
- Modify as needed: `.oat/repo/reference/backlog/index.md`
- Modify: `.oat/projects/shared/v01-release-verification/implementation.md`

**Steps:**

1. Keep public marketplace, Plugin Directory, and `skills.sh` discovery claims gated until live verification is complete.
2. If any release-blocking issue remains, add or update explicit backlog/project tracking.
3. Record what can be tagged now versus what remains before public announcement.

**Verification:**

- Run: `pnpm run validate`
- Run: `rg -n "skills\\.sh|Plugin Directory|marketplace|blocked before tag|post-tag" README.md RELEASING.md CHANGELOG.md .oat/repo/reference`

**Commit:** `docs(release): record remaining v0.1 gates`

### Task p03-t02: Final verification and PR-ready summary

**Files:**

- Modify: `.oat/projects/shared/v01-release-verification/implementation.md`
- Modify/create if using OAT PR tooling: project summary or PR handoff artifact

**Steps:**

1. Rerun final validation needed after documentation edits.
2. Draft PR body content summarizing rerun checks, reused PR #9 evidence, blocked/manual checks, and remaining pre-tag/post-tag work.
3. Ensure no test-organization cleanup or generated-runtime hand edits were included.

**Verification:**

- Run: `pnpm run build:check`
- Run: `pnpm run test`
- Run: `pnpm run validate`
- Run: `pnpm run smoke`
- Run: `git diff --check`

**Commit:** `chore(release): prepare v0.1 verification handoff`

## Implementation Complete

Completion requires all plan tasks to be marked complete in `implementation.md`, final verification evidence recorded, and the PR body updated or ready to paste with reused-versus-rerun evidence clearly separated.

## References

- `.oat/repo/reference/backlog/items/complete-v01-release-verification.md`
- `.oat/repo/reference/current-state.md`
- `.oat/repo/reference/roadmap.md`
- `RELEASING.md`
- `CHANGELOG.md`
- `README.md`
- PR #9: `https://github.com/tkstang/skills/pull/9`
