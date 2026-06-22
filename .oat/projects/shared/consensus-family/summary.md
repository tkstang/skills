---
oat_status: complete
oat_ready_for: oat-project-pr-final
oat_generated: true
oat_generated_at: "2026-06-22T01:45:51Z"
oat_summary_kind: project
oat_project: .oat/projects/shared/consensus-family
oat_workflow_mode: spec-driven
---

# Project Summary: consensus-family

## Overview

`consensus-family` shipped the creation-oriented consensus family slice. The
project added `independent_draft` as a shared `consensus-loop` cold-start
strategy and delivered three generated TypeScript-backed wrapper skills:
`consensus-create`, `consensus-decide`, and `consensus-plan`.

The new wrappers default to `independent_draft` plus `parallel_synthesized`, with
per-skill agency and output contracts:

- `create`: brief or brief-file plus optional template to created markdown
  artifact, maximum agency.
- `decide`: options file to markdown decision with recommendation, reasoning,
  alternatives, and surfaced dissent, minimal agency.
- `plan`: goal plus optional inline constraints to structured markdown steps,
  dependencies, and risks, moderate agency.

`refine` and `evaluate` intentionally remain `shared_input` only. The only
remaining consensus-family wrapper is `consensus-research`, which is out of scope
because it uses `shared_input` and needs its own peer tool-access design pass.

## What Was Implemented

- Widened the shared loop cold-start model to accept `shared_input` and
  `independent_draft`.
- Threaded `coldStart` through the turn prompt builders and changed round-1
  `independent_draft` framing so peers draft from untrusted brief/options/goal
  content rather than revise a shared seed artifact.
- Covered `independent_draft` behavior in `alternating`, `parallel_revision`, and
  `parallel_synthesized` loop tests.
- Preserved `refine` and `evaluate` wrapper-local guards so they reject
  `independent_draft` with clear `shared_input`-only errors.
- Added canonical TypeScript source, generated runtime output, skill anatomy,
  schemas/examples/operator QA, docs, manifests, smoke coverage, and repository
  invariants for `create`, `decide`, and `plan`.
- Updated the Fumadocs consensus guide, plugin README, CHANGELOG, generated
  runtime documentation, provider manifests, build/version registration, lint and
  format exclusions for generated output, and repo reference/PJM artifacts.

## Reviews

All planned phase reviews passed:

- `p01`: loop-core `independent_draft`, passed after one fix round.
- `p02`: `consensus-create`, passed after two review/fix rounds.
- `p03`: `consensus-decide`, passed after review/fix rounds plus minor polish.
- `p04`: `consensus-plan`, passed after one fix round.
- `final`: implementation review passed on v3 after final create/decide prompt
  alignment and shared configuration docs refresh.

Final review row:

```markdown
| final  | code     | passed   | 2026-06-22 | reviews/archived/final-review-2026-06-22-v3.md |
```

## Verification

The implementation and final review cycles ran targeted wrapper/core/docs tests
plus the full repository gate set:

- `pnpm run build`
- `pnpm run build:check`
- `pnpm run lint` (existing no-shadow warnings only)
- `pnpm run type-check`
- `pnpm run test`
- `pnpm run validate`
- `pnpm run validate:skill-versions --base-ref main`
- `pnpm run smoke`
- `git diff --check`

Final review v3 independently rechecked focused wrapper/docs tests,
`build:check`, `type-check`, `validate`, `validate:skill-versions`, `smoke`, the
full Vitest suite, and whitespace checks.

## Design Notes

- DR-026 records the durable family design: `independent_draft` is a round-1-only
  loop-core cold start; create/decide/plan stay thin wrappers; create uses
  whole-artifact sectioning for v1; decide/plan use structured markdown headings
  rather than machine-readable output schemas.
- `parallel_synthesized` reliability reuses the DR-024 submit-CLI verdict seam;
  this project did not reopen MCP-vs-CLI or strict-output strategy decisions.
- Static lint/format generated-output exclusions and provider manifest metadata
  updates were accepted as required repository-surface work for each new shipped
  skill.

## Follow-Ups

- Build `consensus-research` separately after resolving peer tool access and
  evidence capture.
- Revisit outline-first derived sectioning when large-document creation needs
  per-section convergence.
- Promote whole-document harmonization, deliberation metrics, and convergence
  quality follow-ons once the shipped family surface has usage evidence.
