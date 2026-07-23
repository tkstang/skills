---
id: BL-260718-split-consensus-loop-into
title: Split consensus-loop into cohesive core modules
status: closed
priority: medium
scope: task
scope_estimate: L
labels:
  - repo-audit
  - consensus
  - tech-debt
assignee: null
created: 2026-07-18T00:20:00Z
updated: '2026-07-23T09:58:41Z'
associated_issues: []
external_plans:
  - .oat/repo/reference/external-plans/2026-07-18-split-consensus-loop-module.md
---

## Description

src/consensus/core/consensus-loop.ts is 3,961 lines / ~116 top-level functions with fan-in from all five command modules — ~7× the repo's src/ median. Split it into cohesive submodules (validation, records I/O, provider invocation, args, prompts) behind a re-export facade so consumers and generated wrapper outputs stay untouched. Behavior-preserving mechanical refactor: leaf-cluster-first extraction, one commit per cluster, tree green after each. Sequenced after the chain-A audit plans (atomic records, subprocess hardening, helper consolidation) that edit the same file, and ideally after the import-rewrite derivation plan.

Source: 2026-07-17 repository audit (external plan at `.oat/repo/reference/external-plans/2026-07-18-split-consensus-loop-module.md`, planned at commit 8309623).

## Acceptance Criteria

- consensus-loop.ts reduced to loop orchestration plus a re-export facade; extracted modules match a recorded cluster map
- Zero changes to command wrappers or their generated outputs; every extraction commit independently passes type-check, build, build:check, focused tests, and validate
- Full contract including smoke passes; validate:skill-versions clean
