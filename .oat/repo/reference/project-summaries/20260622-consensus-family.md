---
oat_generated: true
oat_generated_at: 2026-06-22
oat_summary_kind: project
oat_project: .oat/projects/shared/consensus-family
oat_workflow_mode: spec-driven
---

# Project Summary: consensus-family

## Overview

`consensus-family` delivered the next creation-oriented consensus family slice:
the shared `independent_draft` cold-start primitive plus `consensus-create`,
`consensus-decide`, and `consensus-plan`. It closed backlog items **bl-2ed7**,
**bl-b9b9**, **bl-87ef**, and **bl-0cb8**. `consensus-research` remains separate
because it uses `shared_input` and needs a peer tool-access / evidence-capture
design decision before build.

The project ran as a spec-driven OAT project after the docs-IA merge, so
user-facing documentation landed in the Fumadocs site under
`documentation/docs/user-guide/consensus/` instead of expanding `README.md`.

## What Was Implemented

- `independent_draft` is now a first-class cold-start strategy in
  `src/consensus/core/consensus-loop.ts`, covered across `alternating`,
  `parallel_revision`, and `parallel_synthesized`.
- Round-1 independent-draft prompts frame brief/options/goal content as
  untrusted input and ask peers to draft independently; round 2+ keeps the
  existing revision/synthesis flow.
- `refine` and `evaluate` keep wrapper-local `shared_input` guards with clearer
  semantic error messages.
- `consensus-create` ships as a generated TypeScript-backed wrapper with inline
  or file-backed brief input, optional template input, whole-artifact sectioning,
  `independent_draft` / `parallel_synthesized` / maximum defaults, and a markdown
  creation artifact.
- `consensus-decide` ships as a generated TypeScript-backed wrapper with options
  file input, `independent_draft` / `parallel_synthesized` / minimal defaults,
  and a markdown decision artifact that preserves dissent and unresolved
  disagreement.
- `consensus-plan` ships as a generated TypeScript-backed wrapper with goal plus
  optional inline constraints, `independent_draft` / `parallel_synthesized` /
  moderate defaults, and a structured markdown plan artifact.
- Plugin manifests, skill frontmatter/version metadata, generated runtime
  outputs, smoke tests, repository invariant tests, plugin README, CHANGELOG, and
  Fumadocs consensus pages were updated for the new skill surface.

## Verification

Final implementation review passed after two fix rounds. The final review
verified focused wrapper/docs tests, generated-output drift checks, type-check,
repository validation, skill-version validation, smoke, `git diff --check`, and
the full Vitest suite.

Local implementation gates also passed during phase reviews:

- `pnpm run build`
- `pnpm run build:check`
- `pnpm run lint` (existing no-shadow warnings only)
- `pnpm run type-check`
- `pnpm run test`
- `pnpm run validate`
- `pnpm run validate:skill-versions --base-ref main`
- `pnpm run smoke`

## Key Decisions

- **DR-026:** `independent_draft` is a round-1-only loop-core cold start; the new
  wrappers stay thin; create uses whole-artifact sectioning for v1; decide/plan
  use structured markdown headings rather than machine-readable output schemas.
- `consensus-research` stays out of this project and remains a separate design
  pass because peer tool access is a different risk surface.
- Documentation targets the Fumadocs site introduced by docs IA, not the slimmed
  README.

## Follow-up Items

- Build `consensus-research` as a separate project after recording the peer
  tool-access / evidence-capture decision.
- Revisit outline-first derived sectioning only when large-document creation
  needs per-section convergence and harmonization.
- Promote whole-document harmonization, deliberation metrics, and convergence
  similarity heuristics when the shipped family surface has enough usage data.

## Associated Issues

- `bl-2ed7`: Implement `independent_draft` cold-start strategy in
  `consensus-loop`.
- `bl-b9b9`: Add `consensus-create` skill.
- `bl-87ef`: Add `consensus-decide` skill.
- `bl-0cb8`: Add `consensus-plan` skill.
