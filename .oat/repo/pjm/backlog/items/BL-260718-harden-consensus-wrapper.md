---
id: BL-260718-harden-consensus-wrapper
title: Harden consensus wrapper subprocess path
status: open
priority: high
scope: task
scope_estimate: M
labels:
  - repo-audit
  - consensus
  - correctness
assignee: null
created: 2026-07-18T00:04:09Z
updated: 2026-07-18T00:04:09Z
associated_issues: []
external_plans:
  - .oat/repo/reference/external-plans/2026-07-17-consensus-subprocess-hardening.md
---

## Description

runProviderCliCommand in consensus-loop.ts (and its duplicated copy in consensus-panel.ts) lacks the timeout/SIGTERM-to-SIGKILL escalation and stdin error guard that the newer provider-cli/subprocess.ts stack already has — a stuck provider CLI hangs the commonly exercised skill-wrapper path indefinitely. Back-port the escalation pattern and stdin guard to both copies without restructuring imports.

Source: 2026-07-17 repository audit (external plan at `.oat/repo/reference/external-plans/2026-07-17-consensus-subprocess-hardening.md`, planned at commit 8309623).

## Acceptance Criteria

- Both copies gain the stdin error listener and optional deadline with SIGTERM→SIGKILL escalation; behavior unchanged when no timeout is set
- Timeout escalation test-proven against a SIGTERM-ignoring stub binary
- refine, evaluate, and panel SKILL.md versions bumped; full contract passes
