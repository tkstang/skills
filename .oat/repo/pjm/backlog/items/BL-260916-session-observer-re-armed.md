---
id: BL-260916-session-observer-re-armed
title: "Investigate observer re-arm catch-up and suspected unread-record gaps"
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
updated: 2026-09-16T18:06:09Z
associated_issues: []
external_plans: []
---

## Description

During the September 16 collaboration, a Claude Code Monitor expired after its observed 30-minute window. Re-arming the same exact Codex pin appeared to skip raw ranges 1771–1819 and 2539–2553; another restart resumed correctly. This is a suspected delivery/diagnostic issue, not established message loss. The inspected gap records contained tool/reasoning/subagent activity, which the default digest can filter legitimately.

The current `src/skills/session-observer/src/lib/watch.ts` baseline path already calls `observeCatchUp()` and emits its result when `catchUpFirst` is set. A baseline at `nextIndex` alone does not prove skipped messages. Reproduce with a known renderable peer message across termination/restart, and distinguish observer consumption, stdout emission, and harness delivery before selecting a fix.

## Acceptance Criteria

- A deterministic restart fixture appends a known renderable peer message while the watcher is stopped and verifies exact-pin catch-up after restart; cover both signal termination and normal max-runtime expiry.
- Separate tests cover tool-only/filtered ranges, writes during startup, and competing consumers. Record fromIndex/nextIndex, persisted state, emitted digest, and harness-visible output rather than equating a raw-index gap with data loss.
- If loss is reproduced, fix its actual checkpoint/delivery boundary and add a regression test. If no loss is reproduced, record the supported explanation and improve diagnostics or procedure only where evidence warrants it; do not add unconditional gap alarms or speculative signal handlers.
- Update `src/skills/session-observer-collab/references/runtime-claude-code.md` with the verified bounded Monitor/re-arm procedure and any version-specific limitations. Do not treat the observed duration as a universal harness guarantee.
- Preserve a sanitized reproduction or evidence summary in the shipping change. Original local evidence is in `.oat/repo/analysis/collab/2026-09-15-docs-visuals-observer-log.md` (ignored and not a portable prerequisite).
