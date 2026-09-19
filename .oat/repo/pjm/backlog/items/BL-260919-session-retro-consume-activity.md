---
id: BL-260919-session-retro-consume-activity
title: "Session-retro: consume activity evidence"
status: open
priority: high
scope: feature
scope_estimate: M
labels:
  - session-retro
  - retro
  - session-export-transcript
assignee: null
created: 2026-09-19T19:24:00.179Z
updated: 2026-09-19T19:24:00.179Z
associated_issues: []
external_plans: []
---

## Description

The `session-retro` skill reviews a bounded session today from conversation evidence. With BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter it can review what the agent did rather than what it said: whether it inspected before editing, verified after its last change, claimed success without evidence, looped, or recovered from failure. This item upgrades the skill to use the activity export and adopts the evidence discipline needed to keep such findings honest.

## Acceptance Criteria

- The retro freezes its evidence first: it exports the exactly selected session with activity to a file and analyses only that file; when the source session is still active the output is titled a review of captured activity, not a session retrospective.
- The retro is run from a different session than the one under review, and the skill says so; contamination risks (including a transcript with more than one writer) are reported when detected.
- Every finding separates what was observed (with event keys or source locators), the interpretation, and the proposed change.
- The tool's coverage states (available, not-recorded, not-found, not-read, unsupported, malformed, truncated) pass through unchanged; an absent tool call is never reported as not having happened unless the runtime is known to record that class reliably.
- A human-intervention section analyses request, activity, user correction and recovery, using native human-origin evidence to separate typed messages from automated notifications.
- The skill uses the full export rather than the capped `review` view, and states per-runtime limits (Cursor: calls only, no results, no timestamps; Codex: outcomes in a separate stream; Claude Code: no exit codes).
- Output follows the agreed template: outcome, what worked, friction, improvement candidates with evidence, likely cause, suggested change and how to validate it. The skill proposes changes and never edits skills itself.

## Dependencies

- **BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter**
