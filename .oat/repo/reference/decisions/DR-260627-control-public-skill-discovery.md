---
id: DR-260627-control-public-skill-discovery
title: Control public skill discovery in-repo via internal-flag apply script and
  CI gate
date: 2026-06-27
status: accepted
legacy_id: null
---

# Control public skill discovery in-repo via internal-flag apply script and CI gate

## Context

`BL-260621` (public-discovery) needed to control which `SKILL.md` files this repo
exposes to the `npx skills` CLI / skills.sh. Three categories: (1) the standalone
`skills/session-observer` + `skills/export-session-transcript` should stay
individually installable; (2) the consensus plugin skills should stay discoverable
but recover gracefully when installed standalone; (3) the ~57 OAT tooling skills
under `.agents/skills/**` must **not** appear as public installable skills.

The lever the CLI honors is `metadata.internal: true` in `SKILL.md` frontmatter.
The hard part is category 3: `.agents/skills/**` are `oat sync`-generated mirrors,
so a hand-edited flag is overwritten on the next `oat tools update` / `oat sync`.

## Decision

Control category 3 **in-repo and enforced**, rather than upstreaming the flag:

- `scripts/apply-internal-flags.mjs` (with `scripts/lib/skill-frontmatter.mjs`)
  idempotently stamps `metadata.internal: true` onto every `.agents/skills/**/SKILL.md`,
  skipping the symlinked `session-observer` mirror so the canonical standalone
  skill stays publicly discoverable.
- `scripts/validate-internal-flags.mjs` (`pnpm run validate:internal-flags`)
  detects a missing flag and is wired into a PR-scoped CI job (mirroring
  `skill-versions`) and the `pre-push` hook, so the flag cannot regress to `main`.
- The runbook (`oat tools update` → `apply-internal-flags` → `oat sync`) is
  documented in the hand-maintained section of `AGENTS.md`.
- Category 2 (consensus) is handled separately by the `~/.consensus/` resolver
  fallback + actionable missing-CLI error + `install.sh` recovery; the skills stay
  discoverable, not hidden.

`.agents/skills/**` are synced mirrors outside `validate.mjs`'s skill-version scope,
so stamping them requires no skill-version bump.

## Consequences

- **+** Self-contained: no dependency on an external `open-agent-toolkit` change
  landing/releasing. **+** Enforced: CI + pre-push block a missing flag.
  **+** Verified: the discovery drop is confirmed (`npx skills@1.5.13 --list` shows
  the OAT tooling skills drop out and reappear only under `INSTALL_INTERNAL_SKILLS=1`).
- **−** Requires running the apply script after each `oat tools update` (a manual
  step, backstopped by the gate). The symlinked `session-observer` must stay
  excluded by the apply logic.
- The skills.sh **hosted** crawl-vs-submission behavior remains an explicit
  deferred follow-up; no public-listing claim until verified.

## Alternatives Considered

- **Upstream handoff to `open-agent-toolkit`** (add the flag at the pack source so
  all consumers inherit it): cleaner ecosystem-wide, but couples this repo to an
  external repo's merge/release cadence and can't verify the outcome here.
  **Downgraded to an optional future improvement** (the handoff prompt is kept,
  not deleted) — it could later retire the per-repo apply script.
- **Hand-edit `.agents/skills/**` directly:** rejected — clobbered by the next
  `oat sync`.
- **Root `SKILL.md` / `skills.sh.json`:** disproven — default discovery already
  walks container dirs and `skills.sh.json` is display-only; neither suppresses
  `.agents/skills/**`.

## Related

- Backlog: `BL-260621-control-public-skill-discovery`
- Project: public-discovery (PR #38)
- Superseded handoff: `.oat/projects/shared/public-discovery/handoff/open-agent-toolkit-internal-flag-prompt.md` (optional future)
