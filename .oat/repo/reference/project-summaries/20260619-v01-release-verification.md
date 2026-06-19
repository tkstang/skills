---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-19
oat_generated: true
oat_summary_last_task: p03-t04
oat_summary_revision_count: 0
oat_summary_includes_revisions: []
---

# Summary: v01-release-verification

## Overview

This quick-mode project verified and packaged the current consensus v0.1 release set without mixing in test-organization cleanup. It started from the existing `consensus-release` checkout, reused still-valid PR #9 live `consensus-refine` dogfood where appropriate, and reran current automated/release checks after the TypeScript/Vitest migration.

The release remains a gated pre-release: local install and automated release checks are current, but public marketplace/skills.sh claims are still held until the documented live discovery paths are verified.

## What Was Implemented

- Rebuilt the release-verification evidence baseline for backlog item `bl-d85f`, separating reused PR #9 dogfood from checks rerun on the current branch.
- Reran and recorded the required automated gates: `build`, `type-check`, `build:check`, `test`, `validate`, `smoke`, tag/version check, and whitespace diff checks.
- Refreshed `RELEASING.md`, `CHANGELOG.md`, `README.md`, and `plugins/consensus/README.md` so v0.1 claims cover only the shipped `consensus:refine` and `consensus:evaluate` skills.
- Updated provider QA notes for both shipped consensus skills and recorded live provider/install posture for Claude Code, Codex, Cursor, Paseo, and Agent Skills.
- Brought `.github/workflows/release.yml` up to the current validation substrate and extended `scripts/bump-version.mjs` / tests so tag checks cover both shipped consensus skill metadata files.
- Updated repo-reference surfaces (`current-state.md`, `roadmap.md`, backlog item/index) to preserve the remaining pre-tag and post-tag gates.
- Processed final review findings inline: renamed the refine QA example output path to use `parallel_revision` spelling and restored lifecycle metadata to PR-ready.

## Key Decisions

- The existing `/Users/tstang/Code/consensus-release` worktree was the intended release-verification checkout, so no new worktree was created.
- PR #9 was treated as reusable evidence only for live `consensus-refine` mode/escalation dogfood; it did not replace current automated gates, `consensus:evaluate` QA, or provider install/discovery checks.
- Public provider directory, Codex Plugin Directory, and skills.sh availability remain non-claims until verified after publication.
- The release/tag workflow, rather than day-to-day `pnpm run validate`, remains the v0.1 equality guard for cross-file version/tag consistency.

## Verification

- `pnpm run build`
- `pnpm run type-check`
- `pnpm run build:check`
- `pnpm run test` (56 files / 572 tests after rebasing onto current `origin/main`)
- `pnpm run validate`
- `pnpm run smoke`
- `node scripts/bump-version.mjs --check-tag v0.1.0`
- `pnpm exec vitest run tests/release-versioning.test.ts tests/readme-scope.test.ts`
- `git diff --check`
- Targeted stale-spelling check for the refine QA example output path

## Reviews

- Plan review: passed; scope, release gates, verification coverage, and public-claim gating were aligned.
- Inline final review: passed; no release-blocking findings.
- Independent final review: passed after disposition; 0 Critical, 0 Important, 0 Medium, 3 Minor. `m2` and `m3` were fixed inline; `m1` was explicitly deferred as optional hardening.

## Follow-up Items

- Before tag: run interactive provider permission-prompt smokes for Claude Code and Codex.
- Before tag: resolve Cursor's locked macOS login keychain / Paseo provider `error`, or explicitly release-note Cursor host/peer limitations.
- After tag and before public claims: verify skills.sh indexing/public discovery and any provider public-directory listing paths.
- Optional hardening: add pre-tag cross-file version equality checks to `validate.mjs` if day-to-day drift detection becomes desirable.

## Associated Issues

- Backlog: `bl-d85f` — Complete v0.1 release verification and tag.
