---
id: BL-260919-token-and-usage-accounting
title: Token and usage accounting for session activity
status: closed
priority: medium
scope: feature
scope_estimate: S
labels:
  - session-observer
  - session-export-transcript
  - transcript-core
  - metadata
assignee: null
created: 2026-09-19T19:23:59.518Z
updated: '2026-09-21T02:31:13Z'
associated_issues: []
external_plans: []
---

## Description

Deferred from BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter. Cost questions (is a skill over-engineered, was an expensive model used where a cheap one would do) need honest usage numbers, and both result-bearing runtimes have traps. Claude Code writes one assistant record per content block and repeats the full `usage` object under the same `message.id`, so naive sums roughly double. Codex writes cumulative `total_token_usage` and per-turn `last_token_usage`, with decreases at compaction boundaries, and a response-joinable `token_usage_record` only in some client versions. Cursor records no usage. Evidence: documentation/docs/engineering/architecture/session-schemas/.

## Acceptance Criteria

- Claude Code usage is de-duplicated by native session plus `message.id`; disagreements between repeated records are reported as diagnostics, not summed.
- Codex cumulative and per-turn semantics are preserved and labelled; compaction decreases are not treated as negative usage.
- Usage is reported per model where the transcript records the model, and as `not-recorded` for Cursor.
- No monetary cost is computed unless a price source is explicitly configured; token counts are the contract.

## Dependencies

- **BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter**
