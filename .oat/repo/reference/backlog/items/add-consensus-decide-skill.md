---
id: bl-87ef
title: 'Add consensus-decide skill (recommend among options)'
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

Add `consensus-decide`: peers deliberate over options and converge on a decision document with reasoning and alternatives. Thin wrapper with v3 defaults: `independent_draft` cold start (independent recommendations), `parallel_synthesized` iteration, `minimal` agency — the decision is the user's; the orchestrator faithfully summarizes peer positions rather than acting as a fourth recommender. Mode-specific input: `--options <path>`.

**Blocked by:** bl-7af0 (parallel-synthesized mode). The minimal-agency + synthesized combination is unique to this skill: synthesis combines reasoning, but contested calls always surface.

## Acceptance Criteria

- `consensus-decide` produces a decision doc (recommendation, reasoning, alternatives, dissent) from an options input.
- v3 defaults applied (independent_draft / parallel_synthesized / minimal agency), overridable.
- Minimal-agency behavior verified: unresolved disagreements surface to the user rather than being editorially decided.
- Manifests, SKILL.md, READMEs, and tests updated as for other family skills.
