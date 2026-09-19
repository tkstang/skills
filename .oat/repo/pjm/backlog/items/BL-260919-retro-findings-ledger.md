---
id: BL-260919-retro-findings-ledger
title: Retro findings ledger with recurrence detection
status: open
priority: medium
scope: feature
scope_estimate: M
labels:
  - retro
  - skills
assignee: null
created: 2026-09-19T19:24:00.837Z
updated: 2026-09-19T19:24:00.837Z
associated_issues: []
external_plans: []
---

## Description

A single bad session should produce a candidate change; repeated evidence is what justifies changing a skill. This item adds the smallest store that makes repetition visible: structured retro findings (skill, resolved version, finding type, runtime, evidence pointers, date), not raw transcripts. It is distinct from BL-260619-shared-session-log-substrate — Stateless multi-session activity merge, which merges activity; this accumulates conclusions. No daemon or warehouse.

## Acceptance Criteria

- Retro skills can append a finding in a documented, versioned, file-based format at a user-configured location outside shipped skill payloads.
- A query answers whether a finding type for a given skill has appeared in N or more distinct sessions, and lists the supporting sessions and versions.
- Findings store pointers and short structural evidence only; no transcript content, commands or paths from the reviewed sessions.
- A finding records the evidence limits that applied (runtime, coverage states), so weak evidence is not counted as strong.
- Nothing in the ledger triggers an automatic skill change.

## Dependencies

- **BL-260919-session-retro-consume-activity — Session-retro: consume activity evidence**
- **BL-260919-skill-evaluation-retro — Skill evaluation retro: activation, adherence, outcome, efficiency**
- Note: Held for later and recorded in the roadmap rather than filed: skill-version comparison, workflow telemetry (new-skill and heavy-skill detection), and within-runtime model comparison. File them when this ledger has data.
