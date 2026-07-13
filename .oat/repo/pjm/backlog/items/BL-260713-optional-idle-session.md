---
id: BL-260713-optional-idle-session
title: Optional idle-session application integrations
status: open
priority: low
scope: idea
scope_estimate: M
labels:
  - session-observer-collab
  - v2
  - integrations
  - idle
assignee: null
created: 2026-07-13T04:02:18Z
updated: 2026-07-13T04:02:18Z
associated_issues: []
oat_template: true
oat_template_name: backlog-item
---

## Description

The dependency-free v1 skill can fall back to scheduled polling or buffered
manual catch-up when a session is idle. Optional application integrations (for
example a terminal supervisor, pane notifier, or desktop wake surface) could
make that handoff non-blocking, but they are not part of the core skill and
must not become a required runtime dependency.

## Acceptance Criteria

- A design/go-no-go record compares candidate application integrations,
  platform and permission requirements, lifecycle ownership, and maintenance
  cost; the default remains dependency-free when no integration is selected.
- Any selected integration is explicitly opt-in, capability-probed, bounded,
  and reversible, and it can only request a normal `session_observer_wake` or
  notification after the existing lease, cursor, authority, and pause checks.
- Tests or harness evidence cover unavailable integrations, idle-to-active and
  active-to-idle transitions, duplicate notifications, shutdown/disarm, and
  fallback to scheduled-poll or buffered-manual behavior.
- Documentation distinguishes application-level wake assistance from runtime
  authority and does not imply that an integration is available on all hosts.

