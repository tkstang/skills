---
id: BL-260919-surface-terminally
title: Surface terminally unsuccessful peer turns as watch events
status: open
priority: medium
scope: feature
scope_estimate: S
labels:
  - session-observer
  - watch
assignee: null
created: 2026-09-19T19:24:01.288Z
updated: 2026-09-19T19:24:01.288Z
associated_issues: []
external_plans: []
---

## Description

On 2026-09-19 a watched Codex peer stopped because the provider usage limit was reached. The rollout recorded a terminal `task_complete` carrying `usage_limit_exceeded` and a retry time, but the watcher emitted nothing, because no user or assistant message was written. The observing agent learned of the stop only from 22 minutes of silence. The collaboration protocol already lists an unfinished or terminally unsuccessful peer turn as a pause condition; the watcher should make that condition visible.

## Acceptance Criteria

- When the watched transcript records a turn that ended unsuccessfully (provider limit, error, abort), the watcher emits one event naming the terminal status and any recorded retry time, without transcript content.
- The event is emitted once per terminal record, survives `--quiet-empty`, and never counts as a peer message or authorizes a continuation.
- Runtimes that record no terminal status emit nothing, and the docs say so rather than implying liveness.
- Watch event logs stay metadata-only.
