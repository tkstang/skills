---
id: BL-260612-add-consensus-plan-skill
title: Add consensus-plan skill (structured plan from goal)
status: done
priority: medium
scope: feature
scope_estimate: S
labels:
  - consensus
  - skill-family
assignee: null
created: 2026-06-12T21:33:26Z
updated: 2026-06-22T01:40:22Z
associated_issues: []
legacy_id: bl-0cb8
---

## Description

Add `consensus-plan`: peers produce a structured plan (steps, dependencies, risks) from a goal and constraints. Thin wrapper with v3 defaults: `independent_draft` cold start (independent approaches), `parallel_synthesized` iteration, `moderate` agency. Mode-specific input: `--constraints <text>` alongside the goal.

**Blocked by:** bl-7af0 (parallel-synthesized mode).

## Acceptance Criteria

- `consensus-plan` produces a plan artifact with steps, dependencies, and risks plus the deliberation log.
- v3 defaults applied (independent_draft / parallel_synthesized / moderate agency), overridable.
- Manifests, SKILL.md, READMEs, and tests updated as for other family skills.

## Delivery Notes

Delivered by the spec-driven OAT project `consensus-family` on branch
`consensus-family`.

- Added canonical TypeScript wrapper source at
  `src/consensus/plan/consensus-plan.ts` with goal/constraints parsing,
  moderate-agency defaults, plan-specific prompt framing, resolution metadata,
  and markdown plan rendering.
- Generated committed plugin runtime output and shipped skill anatomy under
  `plugins/consensus/skills/plan/`.
- Kept constraints inline-only for v1 and used structured markdown headings
  (`Steps`, `Dependencies`, `Risks`) rather than adding a machine-readable plan
  schema.
- Documented `plan` in the Fumadocs consensus guide, plugin README, provider
  manifests, and operator QA reference.
- Added wrapper, provider-CLI integration, generated-output, manifest, docs, and
  smoke coverage.
