# Handoff: Verify skills.sh Hosted Discovery Surface and Listing Strategy

**Backlog item:** `.oat/repo/pjm/backlog/items/BL-260627-verify-skills-sh-hosted.md`
(`BL-260627-verify-skills-sh-hosted` — Verify skills.sh hosted discovery
surface and listing strategy)
**Mode:** `/oat-project-quick-start` — and keep it thin. This is a
verification task, not a build: the deliverable is recorded evidence + a
recorded strategy, so spec/design stay minimal and the item's own
acceptance criteria serve as the checklist. Pre-populate discovery from the
2026-06-26 hosted-check evidence table already in the item.

## Mission

Determine whether the skills.sh hosted platform auto-crawls public repos or
is submission-gated, whether the hosted index honors `metadata.internal`
the way the `vercel-labs/skills` CLI does, then choose and record the
listing strategy in `current-state.md`. **Timebox it:** if `tkstang/skills`
is still unindexed, "wait-for-crawl + seed via real installs of the
standalone skills, re-check on a cadence" is a complete, closeable answer —
do not leave the item open-ended waiting on Vercel.

## Authoritative inputs

- The item file — the hosted-check table (exact commands, URLs, dates,
  outputs from 2026-06-26) is the verification recipe; re-run and extend it.
- `.oat/repo/pjm/backlog/archived/BL-260621-control-public-skill-discovery.md`
  (`BL-260621-control-public-skill-discovery` — Control public skill
  discovery surface on skills.sh) — full findings history: discovery model,
  `metadata.internal` semantics, hosted-API auth wall, docs consulted.
- `.oat/repo/reference/decisions/DR-260627-control-public-skill-discovery.md`
  and `DR-260627-keep-consensus-skills.md` — what shipped in PR #38 and the
  intended public surface (standalone skills individually installable;
  consensus skills discoverable + recoverable; OAT tooling hidden).
- `RELEASING.md` — the post-tag discovery note and no-claim discipline.

## Gotchas and gates

- From this repo's cwd, bare `npx skills …` resolves the **local package
  named `skills`** and fails; version-pin (`npx -y skills@<version>`) to
  exercise the public CLI. The item documents this with `skills@1.5.13`.
- Expected-visible on the hosted surface: `session-observer`,
  `export-session-transcript`, and the five consensus skills. Must never
  appear: the ~57 `.agents/skills/**` OAT tooling skills. If the hosted
  index shows them, that is a **finding to record**, not something this
  item fixes (the CLI-path control is `scripts/apply-internal-flags.mjs` +
  the `validate:internal-flags` gate).
- **No public-listing claim** anywhere (README, docs site, release notes)
  until the hosted path is verified — this gate is the item's entire reason
  to exist.
- Record the chosen strategy in `.oat/repo/pjm/current-state.md`; if the
  decision is durable (e.g. "never submit; telemetry-seed only"), promote a
  DR via `oat decision new`.
- After this closes, Track 2 of the current cycle continues with the
  **decision sweep** (`BL-260620-mid-loop-user-artifact-edits` — mid-loop
  user artifact edits; `BL-260620-llm-section-auto-chunking` — LLM section
  auto-chunking; the product-distinction half of
  `BL-260701-add-multi-round-panel` — multi-round panel). That sweep is item
  updates, not a project — no handoff exists for it.

## Close-out (same PR — no exceptions)

Follow the **Backlog Lifecycle** in `.oat/repo/pjm/AGENTS.md`: set the item
`status: closed` + bump `updated`, append the `backlog/completed.md` entry,
`git mv` the item to `backlog/archived/`, run `oat backlog
regenerate-index`, refresh `current-state.md` and the curated overview.
**Then delete this handoff file
(`git rm .oat/repo/pjm/handoffs/BL-260627-verify-skills-sh-hosted.md`) in
the same PR** — it is consumed context, not documentation.
