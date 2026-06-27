---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-27
oat_generated: true
oat_summary_last_task: prev1-t08
oat_summary_revision_count: 1
oat_summary_includes_revisions: [p-rev1]
---

# Summary: public-discovery

## Overview

This project controlled the public skill-discovery surface for `tkstang/skills`
on the path the repo actually owns — the `npx skills` CLI — across three skill
categories: the standalone skills stay individually installable, the consensus
plugin skills stay discoverable but recover when installed standalone, and the
OAT tooling mirrors under `.agents/skills/**` are hidden from discovery. The
OAT-tooling hiding was first scoped as an upstream handoff (deferred) and then,
in revision `p-rev1`, redirected to an **in-repo, enforced, and verified**
solution.

## What Was Implemented

- **Consensus standalone recovery (cat 2):** the wrappers resolve the provider
  CLI from explicit path → `CONSENSUS_CLI_PATH` → plugin-relative install →
  `~/.consensus/consensus.mjs`, with one shared actionable missing-CLI error
  across all five skills (`create`, `decide`, `evaluate`, `plan`, `refine`).
  `install.sh` provisions the shared CLI (checkout mode today; pinned remote ref
  for the next release). README + docs install guidance updated; tests cover
  resolver order, the shared message, the installer, and the README/install/
  resolver contract.
- **OAT tooling hiding (cat 3) — solved in-repo:** `scripts/apply-internal-flags.mjs`
  idempotently stamps `metadata.internal: true` on all 57 `.agents/skills/**/SKILL.md`
  (skipping the symlinked `session-observer`); `scripts/validate-internal-flags.mjs`
  gates it in a PR-scoped CI job + the `pre-push` hook; the runbook lives in
  AGENTS.md. Discovery drop verified live (`npx skills@1.5.13 --list` → tooling
  drops out; `INSTALL_INTERNAL_SKILLS=1` → reappears). The `open-agent-toolkit`
  handoff prompt was kept as an **optional future** improvement, not the mechanism.
- **Verification + records:** `verification/cli-discovery.md` and
  `verification/internal-flag-discovery.md` capture the live evidence; the cat-3
  decision is recorded as DR-260627; `BL-260621` closed out.

## Key Decisions

- **Control public skill discovery in-repo** (cat 3): stamp + gate
  `metadata.internal: true` on the synced `.agents/skills/**` mirrors via an
  idempotent script and a CI/pre-push gate, rather than hand-editing (clobbered by
  `oat sync`) or depending on an upstream `open-agent-toolkit` change. See DR-260627.
- **Keep consensus skills discoverable and recover standalone installs via a
  shared-home installer** (cat 2), rather than hiding them from discovery.
- **No hosted skills.sh listing claim until verified** — the repo is installable
  via the published CLI, but hosted search did not show `tkstang/skills` indexed;
  the hosted crawl/submission path stays a deferred follow-up.

## Design Deltas

- Cat 3 was redirected mid-project from "upstream handoff, hiding deferred" to the
  in-repo enforced solution above; discovery/design/backlog were realigned in
  `p-rev1` and the handoff prompt downgraded (see Revision History).
- `evaluate` shipped `0.1.3` (not the planned `0.1.2`) because `origin/main`
  already carried `0.1.2`.
- The working skill-version command is `pnpm run validate:skill-versions --base-ref origin/main`
  (no extra `--`), corrected after review.

## Notable Challenges

- An independent second review of `p-rev1` (v2) caught a CI-blocking `type-check`
  failure the phase-gate review missed: the new test files imported
  declaration-free `.mjs` scripts without the repo's `@ts-expect-error` suppression
  (TS7016). Fixed in `prev1-t07`; a v3 re-review then passed clean.
- The `frontmatter` internal-flag matcher was hardened to depth-scope detection
  (`prev1-t08`) so a future deeply-nested `internal:` can't be mistaken for the
  flag and leak a skill into public discovery.

## Integration Notes

- Consensus runtime behavior is generated from `src/consensus/core/consensus-loop.ts`;
  committed `.mjs` under `plugins/consensus/skills/**` must stay in sync via
  `pnpm run build`.
- After `oat tools update`, re-run `node scripts/apply-internal-flags.mjs` then
  `oat sync` to keep `.agents/skills/**` flagged; the `validate:internal-flags` gate
  (CI + pre-push) blocks regressions.
- Standalone consensus recovery depends on `~/.consensus/consensus.mjs` written by
  `install.sh`; the remote one-liner targets `v0.1.2` and is live only once that
  tag exists.
- Use `skills@1.5.13` explicitly for CLI verification — unversioned `npx skills`
  shadows the local repo package named `skills`.

## Revision History

- **p-rev1 — Category 3 redirected to in-repo tooling (2026-06-27).** After the
  initial implementation shipped the upstream-handoff approach, cat-3 was
  redirected to the in-repo apply-script + detector + CI/pre-push gate + runbook,
  and the discovery drop was verified live. An independent v2 review caught a
  type-check CI blocker (fixed in `prev1-t07`); `prev1-t08` depth-scoped the
  matcher; the v3 re-review passed clean.

## Follow-up Items

- **Verify the skills.sh hosted path** (crawl vs submission; whether it honors
  `internal`) before any public-listing claim; `tkstang/skills` is not yet indexed.
- **Optional upstream:** run the `open-agent-toolkit` handoff prompt to add the flag
  at the OAT pack source, which would let all consumers inherit it and retire the
  per-repo apply script.
- Minor (deferred): the internal-flag detector recompiles a loop-invariant regex
  per skill — negligible, injection-safe.

## Associated Issues

- `BL-260621-control-public-skill-discovery`
