---
id: BL-260919-read-linked-session-sidecars
title: Read linked session sidecars in the activity view
status: open
priority: medium
scope: feature
scope_estimate: L
labels:
  - session-observer
  - session-export-transcript
  - transcript-core
  - sidecars
assignee: null
created: 2026-09-19T19:23:59.302Z
updated: 2026-09-19T19:23:59.302Z
associated_issues: []
external_plans: []
---

## Description

Deferred from BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter, which reports four sidecar classes as `not-read`: Codex child rollouts, Claude Code `tool-results/` (externally persisted oversized output, path only in `toolUseResult.persistedOutputPath`), Claude Code `subagents/` transcripts with `.meta.json`, and Cursor `agent-tools/` and `subagents/`. Without them a review of a session that delegated work cannot see what the subagents did, and the largest tool outputs are invisible. Evidence and layouts: documentation/docs/engineering/architecture/session-schemas/ and .oat/repo/reference/research/session-schemas-2026-09-18/.

## Acceptance Criteria

- An explicit opt-in (separate from `--include-activity`) reads sidecars that the selected transcript links to by recorded evidence; nothing is discovered by scanning directories or guessing predecessors.
- Reads are confined to the expected session artifact roots for the runtime; a path found inside tool output is never followed.
- Child activity is merged with explicit ownership and depth, a bounded recursion limit, and per-source coverage; inherited parent history in Codex children stays excluded from child counts.
- Claude Code persisted outputs are read for tail previews, so the preview reflects the real end of the output; Cursor `agent-tools/` files are only attached where the transcript records the read-back that links them.
- `not-found` is reported only after a permitted lookup actually failed; unsupported or unlinked sidecars stay `not-read`.
- Budgets account for merged children, and the sensitivity notice covers the wider exposure.

## Dependencies

- **BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter**
- **BL-260919-locate-and-pin-claude-code — Locate and pin Claude Code subagent transcripts**
