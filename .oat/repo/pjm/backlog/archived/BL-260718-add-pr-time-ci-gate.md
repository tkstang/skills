---
id: BL-260718-add-pr-time-ci-gate
title: Add PR-time CI gate for documentation site
status: closed
priority: medium
scope: task
scope_estimate: M
labels:
  - repo-audit
  - ci
  - docs
assignee: null
created: 2026-07-18T00:04:09Z
updated: '2026-07-23T08:18:21Z'
associated_issues: []
external_plans:
  - .oat/repo/reference/external-plans/2026-07-17-docs-pr-ci-gate.md
---

## Description

deploy-docs.yml triggers only on push to main and workflow_dispatch, and validate.yml never touches documentation/ — a PR that breaks the Fumadocs build or docs format check merges clean and fails only as a post-merge Pages deploy. Add a path-filtered pull_request workflow that builds the docs app and runs its format check.

Source: 2026-07-17 repository audit (external plan at `.oat/repo/reference/external-plans/2026-07-17-docs-pr-ci-gate.md`, planned at commit 8309623).

## Acceptance Criteria

- docs-ci.yml runs on pull_request with documentation/** path filter, least-privilege permissions, concurrency group, frozen-lockfile install, build, and format check
- Build commands proven green locally at the planned commit; trigger semantics verified by the strongest available method
