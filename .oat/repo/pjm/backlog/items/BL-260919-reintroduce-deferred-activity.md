---
id: BL-260919-reintroduce-deferred-activity
title: Reintroduce deferred activity correlation and provenance
status: open
priority: low
scope: feature
scope_estimate: M
labels:
  - session-observer
  - session-export-transcript
  - transcript-core
assignee: null
created: 2026-09-19T19:23:59.735Z
updated: 2026-09-19T19:23:59.735Z
associated_issues: []
external_plans: []
---

## Description

Three pieces were deferred from BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter by the complexity review, each with its own condition for returning. (1) Linking Codex `item_completed` outcomes (exit code, status, duration) to response-stream calls: native ids join only in client 0.154.0, otherwise only turn and ordinal adjacency exists. (2) Linking shell calls that poll a long-running process into one lifecycle. (3) Per-record byte ranges on the detailed reader, deferred until a concrete consumer exists. Evidence: documentation/docs/engineering/architecture/session-schemas/codex.md.

## Acceptance Criteria

- Cross-stream links are made only through a corroborated native id, or are emitted as a separate, explicitly inferred relation that never sets a call's canonical outcome.
- Process-poll linking requires an explicit recorded handle; absent a handle the calls stay independent.
- Byte ranges are added only with a named consumer and tests for multibyte and CRLF input; physical line and logical record index remain the default locator.
- Each piece can ship independently, and each states the evidence or consumer that justified bringing it back.

## Dependencies

- **BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter**
