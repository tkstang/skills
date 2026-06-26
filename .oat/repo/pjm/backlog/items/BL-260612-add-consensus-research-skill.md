---
id: BL-260612-add-consensus-research-skill
title: Add consensus-research skill (investigate question, synthesized findings)
status: open
priority: low
scope: feature
scope_estimate: M
labels:
  - consensus
  - skill-family
assignee: null
created: 2026-06-12T21:33:26Z
updated: 2026-06-12T21:33:26Z
associated_issues: []
legacy_id: bl-645c
---

## Description

Add `consensus-research`: peers investigate a question and converge on synthesized findings with evidence and dissent. Thin wrapper with v3 defaults: `shared_input` cold start (question + scope), `parallel_synthesized` iteration, `moderate` agency. Mode-specific inputs: `--question <text>`, `--scope <text>`.

**Blocked by:** bl-7af0 (parallel-synthesized mode). Lowest-priority family skill because peer turns are tool-using research rather than text edits — whether Paseo peer invocations get tool access (and under what permissions) is an open design question this item must answer before build; that may justify its own design pass.

## Acceptance Criteria

- Peer tool-access question resolved and recorded (DR if durable).
- `consensus-research` produces a findings artifact with evidence and dissent plus the deliberation log.
- v3 defaults applied (shared_input / parallel_synthesized / moderate agency), overridable.
- Manifests, SKILL.md, READMEs, and tests updated as for other family skills.
