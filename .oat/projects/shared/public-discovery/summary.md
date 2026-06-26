---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-26
oat_generated: true
oat_summary_last_task: p03-t02
oat_summary_revision_count: 0
oat_summary_includes_revisions: []
---

# Summary: public-discovery

## Overview

This project tightened the public discovery story for `tkstang/skills` by
controlling the path the repo actually owns today: the `skills` CLI and the
standalone skill install experience. It made standalone consensus installs
recoverable, prepared an upstream OAT internal-flag handoff, and recorded live
CLI and skills.sh evidence for the current public-discovery state.

## What Was Implemented

- Added shared-home consensus CLI recovery. The consensus wrappers now resolve
  the provider CLI from explicit path, `CONSENSUS_CLI_PATH`, plugin-relative
  install, then `~/.consensus/consensus.mjs`.
- Centralized the actionable missing-provider-CLI error across `create`,
  `decide`, `evaluate`, `plan`, and `refine`.
- Added `install.sh`, which provisions the shared consensus CLI in checkout mode
  today and carries the pinned remote install path for the next release tag.
- Updated README and docs installation guidance for standalone consensus
  recovery.
- Added tests for resolver order, shared missing-CLI messaging, installer
  behavior, and README/install/resolver contract drift.
- Added an `open-agent-toolkit` handoff prompt for applying
  `metadata.internal: true` at the upstream OAT tooling skill source.
- Recorded public discovery evidence in
  `verification/cli-discovery.md`: published `skills@1.5.13` listing,
  standalone skill install/run smoke checks, and local consensus recovery
  simulation.
- Updated `BL-260621-control-public-skill-discovery` with dated skills.sh
  hosted-index checks, no-current-listing strategy, and cat-3 deferral.

## Key Decisions

- Category 2 consensus skills should stay discoverable and become recoverable
  standalone, rather than being hidden from discovery.
- Category 3 OAT tooling hiding must be fixed upstream in `open-agent-toolkit`.
  Editing synced `.agents/skills/**` in this repo would be overwritten by
  `oat sync`.
- The hosted skills.sh listing should not be claimed yet. The repo is installable
  with the published CLI, but hosted search and direct repo checks did not show
  `tkstang/skills` as indexed on 2026-06-26.
- Verification should use `skills@1.5.13` explicitly from this checkout because
  unversioned `npx skills ...` shadows the local repo package named `skills`.

## Design Deltas

- `evaluate` was bumped to `0.1.3` instead of the originally planned `0.1.2`
  because current `origin/main` already contained `0.1.2`.
- The accepted skill-version validation command is
  `pnpm run validate:skill-versions --base-ref origin/main`; the earlier plan
  form with an extra `--` was corrected after review.

## Notable Challenges

- p01 review found the `evaluate` version bump was insufficient against current
  `origin/main`; the fix bumped both `version` and `metadata.version` to
  `0.1.3`.
- p03 review found the discovery artifact needed complete or filtered evidence
  for the "only standalone entries" claim; the fix added the parsed 64-skill
  list and category counts.

## Integration Notes

- The new runtime behavior is generated from
  `src/consensus/core/consensus-loop.ts`; committed `.mjs` outputs under
  `plugins/consensus/skills/**` must stay in sync via `pnpm run build`.
- Standalone consensus recovery depends on `~/.consensus/consensus.mjs`, created
  by `install.sh`.
- The remote installer one-liner targets `v0.1.2` and becomes live only after
  that release tag exists.

## Follow-up Items

- Run the `open-agent-toolkit` handoff prompt, sync the resulting OAT
  `metadata.internal: true` source change back into this repo, then re-run CLI
  discovery.
- Do not seed or claim hosted skills.sh listing until cat-3 hiding is verified.
  After that, seed discovery by installing the intended standalone entries and
  re-checking the hosted index.
- Hosted `metadata.internal` behavior remains unverified until the repo is
  indexed and the upstream OAT internal flag has landed.

## Associated Issues

- `BL-260621-control-public-skill-discovery`
