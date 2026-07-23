---
id: BL-260718-surface-the-live-provider-e2e
title: Surface the live-provider E2E gate
status: open
priority: medium
scope: task
scope_estimate: S
labels:
  - repo-audit
  - tests
  - release
assignee: null
created: 2026-07-18T00:04:09Z
updated: 2026-07-18T00:04:09Z
associated_issues: []
external_plans:
  - .oat/repo/reference/external-plans/2026-07-17-live-provider-e2e-visibility.md
---

## Description

The only test exercising a real provider CLI (submit-live.e2e.test.ts) is env-gated, never set in CI, and appears only as "1 skipped" — the repo's self-declared only external execution boundary is verified solely by manual pre-release checks. Add a test:live-e2e script alias that cannot silently pass when explicitly requested, a run-or-waive RELEASING.md checklist item, and a workflow_dispatch-only CI job.

Source: 2026-07-17 repository audit (external plan at `.oat/repo/reference/external-plans/2026-07-17-live-provider-e2e-visibility.md`, planned at commit 8309623).

## Acceptance Criteria

- pnpm run test:live-e2e exists and fails loudly when requested without a usable provider; default pnpm test behavior unchanged
- RELEASING.md requires run-or-waive with the exact command; AGENTS.md lists the gate; live-e2e.yml is dispatch-only and least-privilege
