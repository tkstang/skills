---
id: BL-260718-enforce-recursion-depth-across
title: Enforce recursion depth across provider chains
status: open
priority: high
scope: task
scope_estimate: M
labels:
  - repo-audit
  - consensus
  - provider-cli
  - security
assignee: null
created: 2026-07-18T00:04:09Z
updated: 2026-07-18T00:04:09Z
associated_issues: []
external_plans:
  - .oat/repo/reference/external-plans/2026-07-17-cross-provider-recursion-guard.md
---

## Description

The host-recursion guard (src/consensus/provider-cli/host-guard.ts:93-96) only propagates CONSENSUS_DEPTH when the child provider matches the host runtime, so an alternating-provider chain (claude→codex→claude→…) resets depth at every hop and is never blocked — unbounded process/API-cost growth that the documented guard does not stop. Propagate depth and enforce the cap regardless of provider match.

Source: 2026-07-17 repository audit (external plan at `.oat/repo/reference/external-plans/2026-07-17-cross-provider-recursion-guard.md`, planned at commit 8309623).

## Acceptance Criteria

- evaluateHostGuard emits child_env with incremented depth on every allowed result with a known host and blocks cross-provider chains at max_depth
- Regression test proves an alternating-provider chain reaches HOST_RECURSION_BLOCKED
- Decision record DR-260619-consensus-peer-invocation checked for intent conflict before implementation; full contract passes
