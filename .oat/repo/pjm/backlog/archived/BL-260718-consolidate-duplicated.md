---
id: BL-260718-consolidate-duplicated
title: Consolidate duplicated consensus CLI helpers
status: closed
priority: medium
scope: task
scope_estimate: M
labels:
  - repo-audit
  - consensus
  - tech-debt
assignee: null
created: 2026-07-18T00:04:09Z
updated: '2026-07-23T07:04:55Z'
associated_issues: []
external_plans:
  - .oat/repo/reference/external-plans/2026-07-17-consolidate-consensus-cli-helpers.md
---

## Description

~18 helper functions are independently re-implemented across the five consensus command modules, and parsePositiveInteger/parsePeers in consensus-loop.ts:725-746 have already drifted semantically (no min/max, no provider-id validation) from the command-level copies — validation strictness differs by entry point. Extract the identical helpers into one shared canonical module fanned out by build-generated.mjs (the consensus-config.ts pattern) and reconcile the drift explicitly.

Source: 2026-07-17 repository audit (external plan at `.oat/repo/reference/external-plans/2026-07-17-consolidate-consensus-cli-helpers.md`, planned at commit 8309623).

## Acceptance Criteria

- Byte/semantically identical helpers exist once in canonical source; the five command modules import them
- The parsePeers/parsePositiveInteger drift is reconciled with the chosen semantics recorded
- A tooling test guards against re-forking; affected SKILL.md versions bumped; build, test, validate, smoke pass
