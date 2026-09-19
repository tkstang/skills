---
id: BL-260919-delegation-and-subagent
title: Delegation and subagent evaluation in retros
status: open
priority: medium
scope: feature
scope_estimate: M
labels:
  - session-retro
  - retro
  - subagents
assignee: null
created: 2026-09-19T19:24:00.616Z
updated: 2026-09-19T19:24:00.616Z
associated_issues: []
external_plans: []
---

## Description

Answer whether delegation helped. For each delegated task: what was delegated, which agent type and model handled it, what it returned, whether the parent used the result, and whether the parent repeated the work anyway. The parent side is recorded in the parent transcript; the subagent's own activity needs its transcript to be reviewable. Fits the consensus and reconnaissance workflows in this repository.

## Acceptance Criteria

- Each delegation is listed from recorded parent-side evidence: spawn call, agent type, model, returned result and its delivery record.
- Where the child transcript is reviewable, the child's own activity is summarised from its own export; where it is not, the item reports `not-read` rather than inferring.
- Duplicate work is detected structurally (the parent repeats searches or reads the child already performed) and reported as an observation with locators.
- Findings distinguish delegation that saved effort, delegation that was ignored, and fan-out where several workers converged on the same constraint.
- No claim is made about cost savings unless usage accounting is available.

## Dependencies

- **BL-260919-session-retro-consume-activity — Session-retro: consume activity evidence**
- **BL-260919-locate-and-pin-claude-code — Locate and pin Claude Code subagent transcripts**
- Note: Codex child threads are already pinnable after the session-fidelity identity layer; Claude Code needs the subagent-pinning item.
