---
id: BL-260919-skill-attribution-in-session
title: Skill attribution in session activity events
status: in_progress
priority: high
scope: feature
scope_estimate: S
labels:
  - session-observer
  - session-export-transcript
  - transcript-core
  - retro
assignee: null
created: 2026-09-19T19:23:58.861Z
updated: 2026-09-20T21:00:05.601543Z
associated_issues: []
external_plans: []
---

## Description

Follow-up to BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter. Evaluating whether a skill works starts with knowing when a skill was active. Claude Code records this natively: a `Skill` tool call, an `attributionSkill` field on records, and attachment records that list the skills available in the session. Codex and Cursor record no skill concept, but loading a skill appears as a tool call that reads a `SKILL.md` path. No runtime records the skill's version. Evidence: documentation/docs/engineering/architecture/session-schemas/claude-code.md and .oat/repo/reference/research/session-schemas-2026-09-18/claude-code/findings.md.

## Acceptance Criteria

- Claude Code activity events carry the recorded `attributionSkill` value when present, and `Skill` tool invocations are distinguishable from other calls without parsing previews.
- The report's metadata lists the skills the transcript records as available, by name only; skill instruction bodies remain excluded from the activity flag.
- For Codex and Cursor, a read of a `SKILL.md` path is classified as skill-load evidence, labelled as inferred from a file read rather than as a native skill record.
- The docs state that no runtime records a skill version, and describe how a consumer resolves it (install path or git history at the session timestamp) and that the result is an inference.
- Absent attribution fields keep today's behavior; nothing is guessed from prose.

## Dependencies

- **BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter**
- Note: Small enough to be absorbed into the session-fidelity activity layer if that is still open when this is picked up.
