---
id: BL-260713-stronger-cursor-collaboration
title: Stronger Cursor collaboration wake surfaces
status: open
priority: low
scope: feature
scope_estimate: M
labels:
  - session-observer-collab
  - v2
  - cursor
  - wake
assignee: null
created: 2026-07-13T04:02:18Z
updated: 2026-07-13T04:02:18Z
associated_issues: []
oat_template: true
oat_template_name: backlog-item
---

## Description

Cursor Stop-hook continuation is implemented but remains documented-but-
unvalidated, and the v1 scheduled-poll fallback is intentionally conservative.
Investigate stronger harness-native wake surfaces such as managed background-
agent completion or `subagentStop` without claiming support until an effective
live path is proven.

## Acceptance Criteria

- A capability inventory and probe record which Cursor wake surfaces are
  available, version-gated, permission-gated, and effective in a real session.
- For any surface selected for implementation, a bounded adapter emits the
  existing `session_observer_wake` contract only after terminal successful peer
  completion, with loop/lease bounds, no-op suppression, and fail-closed error
  handling.
- Automated tests cover success, late/error/aborted completion, duplicate
  notifications, restart, disarm, and fallback to scheduled-poll or
  buffered-manual when the stronger surface is unavailable.
- Documentation labels each tier as validated or documented-but-unvalidated
  and includes the exact probe evidence; no Cursor support claim is inferred
  from configuration presence alone.
