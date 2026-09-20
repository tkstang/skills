---
id: BL-260919-uncapped-structured-activity
title: Uncapped structured activity export for cross-session analysis
status: in_progress
priority: high
scope: feature
scope_estimate: M
labels:
  - session-observer
  - session-export-transcript
  - transcript-core
  - retro
assignee: null
created: 2026-09-19T19:23:58.637Z
updated: 2026-09-20T21:00:05.602379Z
associated_issues: []
external_plans: []
---

## Description

Follow-up to BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter. Version 1 offers two activity outputs and neither supports analysis across sessions: `review --json --include-activity` is machine-readable but capped (128 KiB, 1,024 invocations) and samples with failure priority, while the Markdown export is complete but not machine-readable. Skill evaluation across sessions, skill-version comparison, recurring-failure detection and the shared session log all need complete, structured activity. The 2026-09-10 research anticipated this as a second-milestone `--activity-output <path>`. Native shapes are documented in documentation/docs/engineering/architecture/session-schemas/.

## Acceptance Criteria

- A documented way to write the complete activity report for one exactly selected session as JSON or JSONL to a file, with no invocation cap and the same per-preview cap and coverage states as the Markdown export.
- The output carries `activitySchemaVersion`, runtime, native session identity, capture time, source byte length, and count scopes, so a consumer can detect a partial or stale capture.
- Writing the file never moves observer state and is never enabled implicitly; the default observer and exporter outputs are unchanged.
- The file is labelled sensitive (not publish-safe) in its header or sidecar metadata and in both user guides.
- A round-trip test proves every invocation present in the Markdown export is present in the structured export for the same fixture.

## Dependencies

- **BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter**
- Note: Enables the cross-session work: the findings ledger and the shared session log.
