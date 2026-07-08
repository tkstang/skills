---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-07-07
oat_generated: true
oat_summary_last_task: p03-t05
oat_summary_revision_count: 0
oat_summary_includes_revisions: []
---

# Summary: share-consensus-scripts

## Overview

This quick-mode project closed
`BL-260620-share-consensus-generated`: decide whether Consensus could share the
generated `consensus-loop.mjs` runtime at the plugin level, then either migrate
or record a no-go with provider evidence. The project took the go path after a
provider-layout spike verified that Claude Code, Codex, Cursor Agent, Copilot,
and the standalone recovery path could support the plugin-root shape needed by
the generated wrapper imports.

## What Was Implemented

- Added a provider-layout spike artifact with command/evidence tables for
  Claude Code, Codex, Cursor Agent, Copilot, standalone recovery, and the
  go/no-go recommendation.
- Updated `scripts/build-generated.mjs` so `src/consensus/core/consensus-loop.ts`
  emits one shared output at `plugins/consensus/scripts/consensus-loop.mjs`.
- Rewrote generated `create`, `decide`, `evaluate`, `plan`, and `refine`
  wrappers to import the shared loop from
  `../../../scripts/consensus-loop.mjs`.
- Removed the five tracked per-skill generated `consensus-loop.mjs` copies and
  updated static lint/format generated-output mirrors.
- Added generated-output and plugin-root layout regression coverage, plus a
  final-review follow-up parity test that checks every loop-using skill schema
  directory against the canonical refine schema set.
- Updated generated-runtime and repository-layout docs to explain the
  plugin-local shared runtime contract.
- Closed and archived `BL-260620-share-consensus-generated`, updated current
  PJM state/roadmap/completed history, and deleted the consumed handoff.

## Key Decisions

- **Shared consensus loop runtime stays plugin-local.** The shipped shared loop
  output lives at `plugins/consensus/scripts/consensus-loop.mjs`, beside the
  plugin `skills/` directory, because provider install/local-load evidence
  preserves that plugin-root shape. Wrappers import it by relative path from
  each skill runtime.
- **Standalone consensus installs remain recovery-only.** The primary runtime
  contract is the consensus plugin install/local-load layout. Standalone
  single-skill copies remain supported only through the existing
  `~/.consensus/consensus.mjs` recovery path, not by introducing a new global
  shared runtime tree.

## Design Deltas

- `p02-t03` verification used
  `pnpm run validate:skill-versions --base-ref "$BASE_REF"` rather than the
  originally planned extra-separator form. Current pnpm passes the extra
  separator through to the validator script, so the plan was aligned to the
  verified command.
- `p03-t03` required a supporting validation fix outside the original file list:
  the first full suite exposed stale per-skill loop path assumptions and a real
  shared-loop CLI/schema resolver issue. The accepted implementation updated
  shared loop path resolution, tests, and section-runner command references
  before recording final evidence.

## Notable Challenges

- `pnpm test` initially failed after the shared-loop migration because tests and
  the shared runtime still assumed the old per-skill loop location. The fix was
  committed separately and then validated with focused consensus tests,
  `pnpm run build:check`, full `pnpm test`, `npm run validate`, `npm run smoke`,
  and `pnpm run worktree:validate`.
- Final review found two non-blocking gaps: schema parity only covered
  `evaluate` vs `refine`, and the roadmap header still described the previous
  snapshot. Both were converted into tasks, fixed, and passed focused
  re-review.

## Verification

- Provider-layout spike checks recorded per-provider evidence and go/no-go
  rationale.
- Focused generated-output and plugin-root layout Vitest coverage passed.
- `pnpm run build` regenerated committed output and `pnpm run build:check`
  passed after the migration and after final-review fixes.
- `pnpm test` passed with 98 files, 969 tests, and 1 skipped.
- `npm run validate`, `npm run smoke`, and `pnpm run worktree:validate` passed.
- Final re-review passed with 0 Critical, 0 Important, 0 Medium, and 0 Minor
  findings.

## Follow-up Items

- No project follow-up tasks remain. Existing broader consensus follow-ups such
  as deliberation metrics, similarity heuristics, whole-document harmonization,
  and host-native dispatch remain tracked separately in the repo backlog.

## Associated Issues

- `BL-260620-share-consensus-generated` — closed and archived on 2026-07-07.
