---
id: DR-260705-skills-sh-listing-is-telemetry
title: skills.sh listing is telemetry-seeded; never name internal skills in telemetry
date: 2026-07-05
status: accepted
legacy_id: null
---

# skills.sh listing is telemetry-seeded; never name internal skills in telemetry

## Context

`BL-260627-verify-skills-sh-hosted` (verify skills.sh hosted discovery surface
and listing strategy) needed to determine how the skills.sh hosted index is
populated and whether the `metadata.internal: true` control shipped by PR #38
(`DR-260627-control-public-skill-discovery`) protects the ~57 OAT tooling
skills on the hosted surface, before any public-listing claim.

Verified 2026-07-05 (CLI source at `vercel-labs/skills` v1.5.14, skills.sh
docs, upstream issues, live probes):

- **The hosted index is populated exclusively by CLI install telemetry — no
  crawling, no submission flow.** Sources: skills.sh FAQ ("skills appear on
  the leaderboard automatically through anonymous telemetry when users run
  `npx skills add`"), the About page, a maintainer-collaborator's close
  comment on issue #874 ("skills are automatically indexed when they are
  installed via the CLI"), an unrebutted contributor source audit on issue
  #1315 ("no GitHub crawler... no webhook listeners"), and empirical page
  behavior (a Vercel repo's own page lists renamed/deleted skills as
  telemetry fossils rather than the live tree). Issue #880 (crawl vs
  submission) remains open with no maintainer answer.
- **Telemetry is scoped to the selected skill(s) only.** The install event
  sends `skills: selectedSkills.map((s) => s.name)` (`src/add.ts:1786-1788`)
  — never the repo's full skill list. `metadata.internal: true` filtering
  happens client-side *before* selection (`src/skills.ts:46-83`), so internal
  skills cannot enter a telemetry event unless explicitly named via
  `--skill`/`@skill` syntax or `INSTALL_INTERNAL_SKILLS=1`.
- **The hosted side has no server-side internal filter and no delist path.**
  Open issue #1578 documents a skill marked `internal: true` *after* an
  install persisting on its repo's public page as a permanent "telemetry
  fossil," with no documented re-sync or removal mechanism.

## Decision

1. **Listing strategy: telemetry-seed, never submit.** There is nothing to
   submit to; the repo appears on skills.sh only when installs name its
   skills. Seeded 2026-07-05 with owner installs of the two intended
   standalone entries (`session-observer`, `export-session-transcript`),
   each install selecting exactly one skill.
2. **Guardrail: never install an internal (or otherwise
   not-intended-for-listing) skill by name with telemetry enabled.** The
   client-side filter is the *only* protection, and hosted records are
   effectively irreversible (issue #1578). When dogfooding internal skills
   via `INSTALL_INTERNAL_SKILLS=1` or `@skill` syntax, set
   `DISABLE_TELEMETRY=1`.
3. **No public-listing claim until the hosted surface is observed.** Hosted
   indexing is deduplicated on a lag; after the repo page or `skills find`
   shows results, confirm the visible set is exactly the intended surface
   (2 standalone + 5 consensus skills at most, no `oat-*`) before claiming a
   listing anywhere.

## Consequences

- The v0.1 release non-claim can be lifted once the seeded installs surface
  and the visible set checks out; until then it stands.
- Accidental telemetry naming an internal skill is a permanent public
  exposure absent a manual upstream fix — treat the guardrail as a hard
  rule, not a preference.
- The hosted pipeline itself is closed-source; conclusions rest on CLI
  source + docs + maintainer statements + empirical behavior. If upstream
  behavior changes (e.g. a crawler or a delist path ships), revisit this
  record.
