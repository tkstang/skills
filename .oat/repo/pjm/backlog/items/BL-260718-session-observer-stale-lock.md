---
id: BL-260718-session-observer-stale-lock
title: Session-observer stale-lock recovery and atomic cache
status: open
priority: high
scope: task
scope_estimate: S
labels:
  - repo-audit
  - session-observer
  - correctness
assignee: null
created: 2026-07-18T00:04:09Z
updated: 2026-07-18T00:04:09Z
associated_issues: []
external_plans:
  - .oat/repo/reference/external-plans/2026-07-17-session-observer-state-robustness.md
---

## Description

A SIGKILLed session-observer process orphans state.json.lock / watch.json.lock forever: every later invocation blocks ~5s, throws, and callers swallow the error — silently disabling all offset/watcher tracking until a human deletes the lock (src/transcript/session-observer/lib/state.ts:83-97). Add PID-recorded locks with bounded stale-lock reclaim, and make the codex cwd-cache write atomic (locate.ts:140-147).

Source: 2026-07-17 repository audit (external plan at `.oat/repo/reference/external-plans/2026-07-17-session-observer-state-robustness.md`, planned at commit 8309623).

## Acceptance Criteria

- Lock files record owner PID; dead-owner or over-age locks are reclaimed exactly once per acquisition, funneled through open(wx)
- Live-owner locks are never stolen (test-proven); saveCwdCache is temp+rename atomic
- session-observer SKILL.md bumped; full contract passes
