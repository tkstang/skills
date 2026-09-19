---
id: BL-260919-skill-evaluation-retro
title: "Skill evaluation retro: activation, adherence, outcome, efficiency"
status: open
priority: high
scope: feature
scope_estimate: M
labels:
  - session-retro
  - retro
  - skills
assignee: null
created: 2026-09-19T19:24:00.397Z
updated: 2026-09-19T19:24:00.397Z
associated_issues: []
external_plans: []
---

## Description

For a session where a skill was (or should have been) used, evaluate four separate things: activation (was this a situation for the skill, was it loaded, was it the right one), adherence (did the agent follow the skill's workflow, including required research, verification, review passes and approval points), outcome (tests, lint, artifacts, user corrections) and efficiency (excess reads, repeated searches, redundant subagents, duplicated verification). Adherence and outcome stay separate: a session can follow a skill perfectly and fail because the skill is bad, or ignore it and succeed by accident.

## Acceptance Criteria

- Discovery decides whether this is a `/skill-retro <session> <skill>` skill or a mode of `session-retro`, and records the reason.
- Activation uses recorded skill evidence (native attribution where the runtime has it, skill-file reads otherwise) and the list of available skills; the skill version is resolved explicitly and labelled as an inference.
- Adherence maps the skill's stated steps to observed activity in order, reporting each step as observed, not observed, or not determinable for this runtime.
- Outcome and efficiency are reported separately from adherence, with counts scoped to the frozen evidence range.
- One session produces candidate changes, not modifications; the output says how many sessions support each candidate when a findings ledger is available.
- Works on Claude Code and Codex sessions; Cursor sessions are evaluated for activation and call-level adherence only, with the limitation stated.

## Dependencies

- **BL-260919-session-retro-consume-activity — Session-retro: consume activity evidence**
- **BL-260919-skill-attribution-in-session — Skill attribution in session activity events**
- Note: Usage-based efficiency findings additionally need token and usage accounting.
