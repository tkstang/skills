---
id: BL-260718-derive-bump-version-skill-list
title: Derive bump-version skill list from disk
status: open
priority: medium
scope: task
scope_estimate: S
labels:
  - repo-audit
  - release-tooling
assignee: null
created: 2026-07-18T00:04:09Z
updated: 2026-07-18T00:04:09Z
associated_issues: []
external_plans:
  - .oat/repo/reference/external-plans/2026-07-17-skill-files-disk-derivation.md
---

## Description

scripts/bump-version.mjs:18-29 hardcodes SKILL_FILES (currently complete) while every other skill enumeration in the repo derives from disk; a forgotten entry silently ships a skill with a stale version at release, and the existing test only asserts self-consistency. Derive the list from the same discovery contract the validators use and pin completeness in tests.

Source: 2026-07-17 repository audit (external plan at `.oat/repo/reference/external-plans/2026-07-17-skill-files-disk-derivation.md`, planned at commit 8309623).

## Acceptance Criteria

- No hardcoded skill path list remains in bump-version.mjs; discovery is shared with the validator contract
- A completeness pin fails on any skill-set change until deliberately updated
- AGENTS.md no longer instructs manual SKILL_FILES maintenance; full contract passes
