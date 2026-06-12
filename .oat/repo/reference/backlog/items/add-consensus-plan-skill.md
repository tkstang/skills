---
id: bl-0cb8
title: 'Add consensus-plan skill (structured plan from goal)'
status: open
priority: medium
scope: feature
scope_estimate: S
labels: [consensus, skill-family]
assignee: null
created: '2026-06-12T21:33:26Z'
updated: '2026-06-12T21:33:26Z'
associated_issues: []
oat_template: true
oat_template_name: backlog-item
---

## Description

Add `consensus-plan`: peers produce a structured plan (steps, dependencies, risks) from a goal and constraints. Thin wrapper with v3 defaults: `independent_draft` cold start (independent approaches), `parallel_synthesized` iteration, `moderate` agency. Mode-specific input: `--constraints <text>` alongside the goal.

**Blocked by:** bl-7af0 (parallel-synthesized mode).

## Acceptance Criteria

- `consensus-plan` produces a plan artifact with steps, dependencies, and risks plus the deliberation log.
- v3 defaults applied (independent_draft / parallel_synthesized / moderate agency), overridable.
- Manifests, SKILL.md, READMEs, and tests updated as for other family skills.
