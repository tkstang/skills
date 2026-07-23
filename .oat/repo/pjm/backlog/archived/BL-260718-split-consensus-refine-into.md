---
id: BL-260718-split-consensus-refine-into
title: Split consensus-refine into cohesive modules
status: closed
priority: medium
scope: task
scope_estimate: L
labels:
  - repo-audit
  - consensus
  - refine
  - tech-debt
assignee: null
created: 2026-07-18T00:20:00Z
updated: '2026-07-23T09:58:42Z'
associated_issues: []
external_plans:
  - .oat/repo/reference/external-plans/2026-07-18-split-consensus-refine-module.md
---

## Description

src/consensus/refine/consensus-refine.ts is 3,890 lines / ~122 top-level functions. Split it into cohesive submodules (resume/corruption handling, sectioning, prompts, args) behind a facade that keeps every externally-imported symbol (runSequential, runWrapperCli, smoke-test consumers) resolving from its original path. Behavior-preserving mechanical refactor with per-cluster green-tree commits; new generated files under the refine skill require a refine SKILL.md version bump. Sequenced after the helper-consolidation audit plan, which edits the same file.

Source: 2026-07-17 repository audit (external plan at `.oat/repo/reference/external-plans/2026-07-18-split-consensus-refine-module.md`, planned at commit 8309623).

## Acceptance Criteria

- consensus-refine.ts reduced to wrapper orchestration plus re-exports matching a recorded cluster map; external-import list preserved
- Every extraction commit independently passes type-check, build, build:check, focused refine tests, and validate
- refine SKILL.md bumped; full contract including smoke passes; validate:skill-versions clean
