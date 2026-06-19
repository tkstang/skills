---
id: bl-b9b9
title: 'Add consensus-create skill (artifact from brief)'
status: open
priority: medium
scope: feature
scope_estimate: M
labels: [consensus, skill-family]
assignee: null
created: '2026-06-12T21:33:26Z'
updated: '2026-06-12T21:33:26Z'
associated_issues: []
oat_template: true
oat_template_name: backlog-item
---

## Description

Add `consensus-create`: peers produce a new artifact from a brief/spec through deliberation. Thin wrapper with v3 defaults: `independent_draft` cold start (each peer drafts independently from the brief), `parallel_synthesized` iteration, `maximum` agency (the orchestrator drives toward a produced artifact). Mode-specific inputs: `--brief <text>` / `--brief-file <path>`, optional `--template <path>`.

**Blocked by:** bl-7af0 (parallel-synthesized mode) — its default iteration mode. Also blocked by [[bl-2ed7]] (`independent_draft` cold-start strategy), now tracked as its own shared-`consensus-loop` item because `decide` and `plan` need it too; this skill is its natural first consumer. Sectioning from derived (not input) structure remains a design question for this item.

## Acceptance Criteria

- `consensus-create` produces an artifact from a brief with full deliberation log, using independent peer drafts in round 1.
- v3 defaults applied (independent_draft / parallel_synthesized / maximum agency), overridable.
- Derived-sectioning behavior decided and documented (whole-artifact vs outline-first per the v1 large-document strategy).
- Manifests, SKILL.md, READMEs, and tests updated as for other family skills.
