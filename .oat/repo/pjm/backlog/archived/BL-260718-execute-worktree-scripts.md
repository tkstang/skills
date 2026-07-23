---
id: BL-260718-execute-worktree-scripts
title: Execute worktree scripts and git hooks in tests
status: closed
priority: low
scope: task
scope_estimate: M
labels:
  - repo-audit
  - tests
  - dev-tooling
assignee: null
created: 2026-07-18T00:04:09Z
updated: '2026-07-23T07:04:55Z'
associated_issues: []
external_plans:
  - .oat/repo/reference/external-plans/2026-07-17-worktree-and-hook-tests.md
---

## Description

scripts/worktree/validate.sh — the documented pre-merge check — is only string-matched by tests, never executed; init.sh, manage-hooks.mjs, and the four hook scripts have zero coverage. Add behavioral tests (scratch git repos, stub pnpm on PATH, GIT_* env scrubbed) proving fail-closed on dirty trees, post-pipeline drift detection, and hook exit-code propagation; optionally add the missing command -v pnpm guard to pre-commit/pre-push.

Source: 2026-07-17 repository audit (external plan at `.oat/repo/reference/external-plans/2026-07-17-worktree-and-hook-tests.md`, planned at commit 8309623).

## Acceptance Criteria

- validate.sh and init.sh are spawned by tests covering dirty-tree fail-closed, pipeline order, post-run drift detection, and copy semantics
- manage-hooks.mjs and all four hook scripts have characterization coverage; every temp-git test scrubs the GIT_* env family
- pnpm test and npm run validate pass
