---
id: BL-260718-sync-stale-top-level
title: Sync stale top-level documentation surfaces
status: closed
priority: medium
scope: task
scope_estimate: S
labels:
  - repo-audit
  - docs
assignee: null
created: 2026-07-18T00:04:09Z
updated: '2026-07-23T02:58:08Z'
associated_issues: []
external_plans:
  - .oat/repo/reference/external-plans/2026-07-17-docs-staleness-sweep.md
---

## Description

Six verified staleness defects: CHANGELOG [Unreleased] missing phone-a-friend, consensus config, and session-observer-collab; README omitting session-observer-collab; CONTRIBUTING instructing npm in a pnpm-pinned repo; marketplace manifests describing the plugin as refine-only; repository-layout.md omitting src/consensus/; and the undocumented hand-written-scripts exception in session-observer-collab.

Source: 2026-07-17 repository audit (external plan at `.oat/repo/reference/external-plans/2026-07-17-docs-staleness-sweep.md`, planned at commit 8309623).

## Acceptance Criteria

- All greppable assertions in the plan pass (CHANGELOG, README, CONTRIBUTING, both marketplace manifests, repository-layout)
- The AGENTS.md exception note lands only if project records confirm the hand-written scripts are deliberate; otherwise the finding is escalated
- pnpm test and npm run validate pass
