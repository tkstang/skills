---
id: BL-260919-locate-and-pin-claude-code
title: Locate and pin Claude Code subagent transcripts
status: open
priority: medium
scope: feature
scope_estimate: M
labels:
  - session-observer
  - transcript-core
  - identity
assignee: null
created: 2026-09-19T19:23:59.084Z
updated: 2026-09-19T19:23:59.084Z
associated_issues: []
external_plans: []
---

## Description

Claude Code writes each subagent's transcript to a separate file, `<project>/<session-id>/subagents/agent-<id>.jsonl`, with an `agent-<id>.meta.json` beside it (workflow-spawned agents live under `subagents/workflows/wf_<id>/`). The observer only discovers top-level session files, so a subagent's own activity cannot be reviewed at all. The identity layer of BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter made Codex child threads pinnable by their own id; this item does the same for Claude Code, which unlocks subagent evaluation without the full sidecar merge. Evidence: documentation/docs/engineering/architecture/session-schemas/claude-code.md (file layout, `.meta.json` key set, `toolUseId` present on directly spawned agents and absent on workflow-spawned ones).

## Acceptance Criteria

- `locate` lists Claude Code subagent transcripts as labelled child candidates under their parent session, ranked below root sessions for unpinned lookup.
- A subagent transcript can be pinned and reviewed or exported by an exact identity; an ambiguous or missing identity fails explicitly rather than selecting by recency.
- Parent linkage uses recorded evidence only: `.meta.json` `toolUseId` for directly spawned agents, directory containment for workflow-spawned agents, with the provenance of the link stated.
- Dangling agent ids (parent records an agent whose file no longer exists) are reported, not treated as errors.
- Stateful watch of a subagent transcript is either supported with the same path binding as other sessions or explicitly refused with a clear message.

## Dependencies

- **BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter**
