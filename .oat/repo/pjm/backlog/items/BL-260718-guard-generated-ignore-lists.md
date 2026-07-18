---
id: BL-260718-guard-generated-ignore-lists
title: Guard generated ignore lists and derive import rewrites
status: open
priority: medium
scope: task
scope_estimate: S
labels:
  - repo-audit
  - build-contract
  - tooling
assignee: null
created: 2026-07-18T00:04:09Z
updated: 2026-07-18T00:04:09Z
associated_issues: []
external_plans:
  - .oat/repo/reference/external-plans/2026-07-17-derive-generated-ignore-lists.md
---

## Description

.oxfmtrc.json and .oxlintrc.json hand-duplicate the ~28 generated-output paths from build-generated.mjs with no enforcement (currently in sync, verified), and each generatedOutputs entry hand-transcribes its importRewrites — the N-files-in-lockstep burden AGENTS.md itself flags. Add a tooling test guarding both ignore lists against generatedOutputs, and derive importRewrites from source import statements with byte-equivalence proof.

Source: 2026-07-17 repository audit (external plan at `.oat/repo/reference/external-plans/2026-07-17-derive-generated-ignore-lists.md`, planned at commit 8309623).

## Acceptance Criteria

- A tooling test fails when either ignore list misses a generated output path
- Hand-written importRewrites removed where derivation is byte-equivalent (unchanged generated tree)
- AGENTS.md sync guidance updated; full contract passes
