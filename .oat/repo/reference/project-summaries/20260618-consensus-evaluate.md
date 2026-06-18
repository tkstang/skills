---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-18
oat_generated: true
oat_summary_last_task: p04-t03
oat_summary_revision_count: 0
oat_summary_includes_revisions: []
---

# consensus-evaluate Implementation Summary

## Overview

`consensus-evaluate` ships the first consensus family skill after `refine`. It evaluates an
artifact against a rubric or spec using the shared consensus loop, preserving independent peer
judgment while converging on a markdown evaluation artifact.

The project was implemented in quick mode after PR #13 and PR #14 established the
TypeScript/Vitest generated-runtime substrate. The final implementation follows that substrate:
canonical TypeScript source lives under `src/consensus/`, while provider-facing `.mjs` outputs
remain committed under `plugins/consensus/skills/evaluate/scripts/`.

## What Was Implemented

- Added a narrow prompt-profile seam to `src/consensus/core/consensus-loop.ts`, keeping refine
  behavior unchanged when no profile is supplied.
- Added `src/consensus/evaluate/consensus-evaluate.ts` as the canonical evaluate wrapper source.
- Generated committed evaluate runtimes:
  - `plugins/consensus/skills/evaluate/scripts/consensus-loop.mjs`
  - `plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs`
- Added evaluate schema assets with parity coverage against the refine distribution schemas.
- Implemented artifact/rubric argument parsing, v3 defaults, unsupported
  `independent_draft` rejection, input-size caps, path-constrained output/run-state handling,
  prompt-block escaping, and markdown evaluation rendering.
- The evaluation artifact includes unified findings, embedded per-peer `consensus-verdict`
  records, and `## Dissent` or `## Unresolved dissent` sections when disagreement remains.
- Registered `evaluate` in the consensus plugin distribution surfaces, provider manifests,
  root/plugin READMEs, operator QA docs, changelog, and OAT repo reference docs.

## Key Decisions

- Evaluation semantics live in the wrapper, not the shared loop. The loop only exposes prompt
  builder hooks.
- Evaluation output remains free-form markdown seeded from a rubric-derived template rather
  than adding a new structured verdict schema.
- Per-peer reasoning and dissent are preserved by embedding canonical deliberation records in
  the final artifact.
- Evaluate mirrors the PR #14 import-rewrite convention: TypeScript imports
  `../core/consensus-loop.js`; generated output imports `./consensus-loop.mjs`.
- Evaluate provider inventory checks are documented as host/operator setup. The wrapper validates
  provider ID syntax and surfaces Paseo/runtime invocation failures, but it does not implement
  refine's provider-inventory preflight.

## Design Deltas

- Regenerating `plugins/consensus/skills/refine/scripts/consensus-loop.mjs` was required because
  the canonical loop source changed and both refine/evaluate generated outputs must stay in sync.
- The original shared-core sync idea was superseded by the existing generated-runtime contract
  from DR-020/DR-021.

## Verification

- `pnpm run build`
- `pnpm run build:check`
- `pnpm run type-check`
- `pnpm test`
- `pnpm run validate`
- `pnpm run smoke`
- `git diff --check`

Targeted review/fix verification also covered:

- `tests/consensus-evaluate-wrapper.test.ts`
- `tests/consensus-evaluate-output.test.ts`
- `tests/consensus-evaluate-prompt-profile.test.ts`
- `tests/consensus-evaluate-schema-parity.test.ts`
- `tests/generated-consensus-evaluate-import.test.ts`
- `tests/generated-output-sync.test.mjs`
- `tests/path-safety.test.ts`
- `tests/docs-presence.test.mjs`
- `tests/repo-layout.test.mjs`
- `tests/package-metadata.test.mjs`

## Review State

- Design artifact review: passed after direct artifact edits.
- Plan artifact review: passed after direct artifact edits.
- p01 code review: passed.
- p02 code review: passed after input-size and default-output fixes.
- p03 code review: passed; the non-blocking README wording Minor was resolved.
- Final review: passed after fixes for prompt-block escaping, provider-preflight documentation
  accuracy, and evaluate path-safety coverage.
- Additional final pass `final-review-2026-06-17-v2.md`: passed with no findings and an empty
  deferred Medium ledger; archived during completion.

## Follow-up Items

- Remaining consensus family skills (`consensus-create`, `consensus-decide`, `consensus-plan`,
  `consensus-research`) stay as future work.
- Independent-draft cold start remains unsupported for `refine` and `evaluate`.
- Live provider verification for `evaluate` remains part of the v0.1 release checklist.
