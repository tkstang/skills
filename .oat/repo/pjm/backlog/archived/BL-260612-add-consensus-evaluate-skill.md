---
id: BL-260612-add-consensus-evaluate-skill
title: Add consensus-evaluate skill (artifact vs rubric)
status: closed
priority: medium
scope: feature
scope_estimate: S
labels:
  - consensus
  - skill-family
assignee: null
created: 2026-06-12T21:33:26Z
updated: 2026-06-17T00:00:00Z
associated_issues: []
legacy_id: bl-5174
---

## Description

Add `consensus-evaluate` to the consensus plugin: peers judge an artifact against a rubric/spec and converge on a unified evaluation with reasoning and recorded dissent. Thin wrapper over consensus-loop with v3 defaults: `shared_input` cold start, `parallel_revision` iteration, `minimal` agency (independent judgment is the point; surface every meaningful disagreement). Mode-specific input: `--rubric <path>`.

**Blocked by:** bl-5d49 (parallel-revision mode) — its default iteration mode. The first family skill to land because it does not need synthesized mode. Per v3, what peers produce each turn is an evaluation rather than an artifact edit; "done" is a stable unified evaluation.

## Acceptance Criteria

- `consensus-evaluate` invokable with an artifact + rubric; produces an evaluation artifact with unified findings, per-peer reasoning, and dissent preserved in the deliberation log.
- v3 defaults applied (shared_input / parallel_revision / minimal agency), all overridable by the standard flags.
- Plugin manifests, SKILL.md, and READMEs updated; family skill listed as shipped rather than deferred.
- Tests cover the wrapper defaults, evaluation-shaped output contract, and impasse surfacing under minimal agency.

## Delivery Notes

Delivered by the quick-mode OAT project `consensus-evaluate` on branch `concensus-evaluate`.

- Added canonical TypeScript wrapper source at `src/consensus/evaluate/consensus-evaluate.ts`.
- Generated committed plugin runtime output at `plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs` and `plugins/consensus/skills/evaluate/scripts/consensus-loop.mjs`.
- Added evaluate schemas, skill documentation, provider manifest discovery text, README status updates, and Vitest/Node coverage for wrapper defaults, output rendering, schema parity, generated imports, and distribution docs.
