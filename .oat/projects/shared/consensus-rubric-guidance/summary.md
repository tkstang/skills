---
oat_generated: true
oat_generated_at: 2026-06-19
oat_project: consensus-rubric-guidance
oat_workflow_mode: quick
oat_phase: implement
oat_phase_status: pr_open
---

# Project Summary: consensus-rubric-guidance

## Overview

Brought the consensus `refine` and `evaluate` skills up to current skill-authoring
best practices (kept consistent across both for sibling parity) and added a
guided rubric-creation experience to `evaluate` so users without a rubric can
still run an evaluation. Quick-mode project; documentation/validation-first change
with no shipped-runtime behavior change (DR-002 preserved — the deterministic
wrapper stays dependency-free and unchanged).

## What Was Implemented

**Best-practice conformance (both skills)**
- Added `## When NOT to Use`, `## Examples` (basic + conversational), and
  `## Success Criteria` to `refine/SKILL.md` and `evaluate/SKILL.md`, preserving
  each skill's existing topical (non Step-N) style.
- Added `argument-hint` and a top-level `version` to both skills while retaining
  `metadata.version`.
- `scripts/validate.mjs` now resolves the effective skill version from the
  top-level field (else `metadata.version`), validates semver, and requires the
  two to match when both are present.
- `scripts/bump-version.mjs` now lists both skills in `SKILL_FILES` and reads/writes
  both the top-level and `metadata.version` fields; tag-consistency reporting covers
  both. Decision captured as DR-022.

**Guided rubric creation (evaluate only)**
- New `## Guided Rubric Creation` section: a host-model-driven flow triggered by an
  explicit "help me build a rubric" ask or a no-rubric evaluation request. It elicits
  goals, adapts a bundled example, writes the draft to a user-approved path, then
  invokes the unchanged `--rubric` wrapper. Documents the silent first-12-criteria
  cap; weights/scales are peer-facing guidance only.
- Four bundled example rubrics under `plugins/consensus/skills/evaluate/references/examples/`
  (general-purpose, code-review, technical-writing, design-architecture), each at
  ≤12 parser-visible criteria.

## Verification

- `pnpm run build:check` — 8 generated outputs in sync (no runtime/generated edits)
- `pnpm run test` — 582 pass (219 node + 363 vitest)
- `pnpm run validate` — pass · `pnpm run smoke` — pass
- Per-phase Tier-1 reviews (p01, p02) + a final-scope review, all PASS (0 Critical/Important)

## Reviews

| Scope | Type | Status | Date |
| ----- | ---- | ------ | ---- |
| plan  | artifact | passed | 2026-06-19 |
| p01   | code | passed | 2026-06-19 |
| p02   | code | passed | 2026-06-19 |
| p03   | code | passed | 2026-06-19 |
| final | code | passed | 2026-06-19 |

## Deferred / Follow-ups

- **bl-3913** — add a test guarding the bundled rubric examples at ≤12 parser-visible
  criteria (ship-safe future-proofing; examples are correct as shipped).

## Decisions

- **DR-022** — shipped skills carry a validator-backed top-level `version`, kept in
  sync with `metadata.version`; release tooling updates both and contributors bump
  on shipped changes.
