---
id: DR-260627-keep-consensus-skills
title: Keep consensus skills discoverable and recover standalone installs via a
  shared-home installer
date: 2026-06-27
status: accepted
legacy_id: null
---

# Keep consensus skills discoverable and recover standalone installs via a shared-home installer

## Context

Category 2 of public-discovery: an individual npx skills install of a consensus skill fails CONSENSUS_PROVIDER_CLI_MISSING because plugins/consensus/scripts/consensus.mjs lives outside the skill dir. Rather than hide the consensus skills from discovery, keep them discoverable and make a standalone install recoverable: the resolver falls back to ~/.consensus/consensus.mjs, the missing-CLI error is actionable, and install.sh provisions the shared CLI (checkout mode now; pinned remote ref once the next release tag exists). Keeps the plugin marketable while standalone installs self-heal.

## Decision

Keep `refine`/`evaluate`/`decide`/`plan`/`create` discoverable (no
`metadata.internal`) and make a standalone install self-heal:

- `resolveConsensusCliPath` (shared core, `src/consensus/core/consensus-loop.ts`)
  resolves the provider CLI in order: explicit arg → `CONSENSUS_CLI_PATH` →
  plugin-relative → `~/.consensus/consensus.mjs`.
- When none resolve, all five wrappers surface one shared, actionable
  `CONSENSUS_PROVIDER_CLI_MISSING` error pointing at the two recovery paths.
- `install.sh` provisions `~/.consensus/consensus.mjs` — checkout-mode is the
  pre-merge-verified path; a pinned-ref remote one-liner (documented for `v0.1.2`)
  goes live once that release tag exists.

## Consequences

- **+** The plugin stays marketable on skills.sh and a standalone install is no
  longer a dead end. **+** One shared resolver/error covers all five skills.
- **−** Adds a `~/.consensus/` shared location and an `install.sh` to maintain;
  the remote one-liner can't be live-verified until the release tag is cut
  (deferred). Contrast with the cat-3 OAT tooling, which is hidden, not recovered
  (see DR-260627-control-public-skill-discovery).
