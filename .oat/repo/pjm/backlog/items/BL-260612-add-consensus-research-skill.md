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
updated: 2026-07-11T23:41:32Z
associated_issues: []
legacy_id: bl-645c
---

## Description

Add `consensus-research`: peers investigate a question and converge on synthesized findings with evidence and dissent. Thin wrapper with v3 defaults: `shared_input` cold start (question + scope), `parallel_synthesized` iteration, `moderate` agency. Mode-specific inputs: `--question <text>`, `--scope <text>`.

**Dependency status:** `parallel_synthesized` is shipped. No active backlog item blocks this work; before build, a design/DR must decide whether and how the owned provider CLI grants peer tool access, which permissions apply, and how evidence provenance is captured.

## Acceptance Criteria

- Peer tool-access question resolved and recorded (DR if durable).
- `consensus-research` produces a findings artifact with evidence and dissent plus the deliberation log.
- v3 defaults applied (shared_input / parallel_synthesized / moderate agency), overridable.
- Manifests, SKILL.md, READMEs, and tests updated as for other family skills.
