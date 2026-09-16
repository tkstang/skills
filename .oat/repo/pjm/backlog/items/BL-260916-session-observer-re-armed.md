---
id: BL-260916-session-observer-re-armed
title: "session-observer: re-armed watcher can skip unread records"
status: open
priority: medium
scope: task
scope_estimate: S
labels:
  - session-observer
  - session-observer-collab
  - reliability
assignee: null
created: 2026-09-16T14:11:39.364Z
updated: 2026-09-16T14:11:39.364Z
associated_issues: []
external_plans: []
---

## Description

When a Claude Code Monitor task expires (30-minute harness cap) and catch-up-then-watch is re-armed on the same exact pin, the new watcher sometimes sets baselineRecordIndex to the current transcript end instead of resuming from the stored offset, so the unread range is never rendered. Observed twice on 2026-09-16 (records 1771-1819 and 2539-2553 skipped; one re-arm resumed correctly). The prior process had exited and watch-ctl reported no active watcher. A peer request in the gap would be missed silently.

## Acceptance Criteria

- On `catch-up-then-watch` / `catch-up` start, if a stored offset exists for the exact pin and is behind the new baseline, that range is rendered as the first catch-up digest and an explicit `[session-observer] gap <from>-<to>` line is printed; a re-arm never silently advances past unread records.
- The consumed offset is persisted on SIGTERM/expiry (the Claude Code Monitor kill path), so a re-armed watcher resumes from it without a gap.
- A test covers restart-after-signal: kill a watcher mid-run, restart on the same pin, assert the skipped range is rendered and the gap line appears.
- `session-observer-collab/references/runtime-claude-code.md` documents the 30-minute Monitor cap and the re-arm procedure (stop, note last consumed record, re-arm, read any reported gap).
- Evidence: skill-rehoming worktree `tmp/collab/2026-09-15-docs-visuals-observer-log.md` entries [04:55] and [10:20]; the session watching `codex:01a0a838` on 2026-09-16 (records 1771-1819 and 2539-2553 skipped; 1064-1080 correctly resumed).
