---
id: bl-7c1d
title: 'Control public skill discovery surface on skills.sh'
status: open
priority: medium
scope: task
scope_estimate: M
labels: [release, distribution, discovery, skills]
assignee: null
created: '2026-06-21T00:05:11Z'
updated: '2026-06-21T00:05:11Z'
associated_issues: []
oat_template: true
oat_template_name: backlog-item
---

## Description

The repo exposes three categories of `SKILL.md` to any tool that crawls it, and
`npx skills add tkstang/skills --list --full-depth` flattens all of them together:

1. **Standalone skills** (`skills/session-observer`, `skills/export-session-transcript`)
   — self-contained (scripts + `lib/` live inside the skill dir), legitimately
   individually installable via `npx skills add tkstang/skills@<skill>`.
2. **Consensus plugin skills** (`plugins/consensus/skills/{refine,evaluate}`) —
   plugin-bound: they resolve the provider CLI at
   `plugins/consensus/scripts/consensus.mjs` (outside the skill dir, at the plugin
   root), so an individual `npx skills add …@refine` install is missing the CLI and
   fails `CONSENSUS_PROVIDER_CLI_MISSING`. They must be installed as the consensus
   *plugin* (claude/codex/cursor marketplace), not as standalone skills.
3. **OAT tooling skills** (`.agents/skills/oat-*`) — synced framework tooling that
   should never be presented as public installable skills.

Desired public-discovery surface: only category (1) should be individually
discoverable/installable on skills.sh; (2) is discoverable as a plugin via the
provider marketplaces; (3) must not appear at all.

As of 2026-06-20, `tkstang/skills` is **not yet indexed** on skills.sh
(`npx skills find session-observer|tkstang|oat-docs` returns nothing from this
repo), so nothing is mis-exposed *yet* — this is a pre-emptive control before
indexing happens. The `skills` CLI exposes no `.skillsignore`/exclude flag; default
discovery stops at a root `SKILL.md` and only recurses with `--full-depth`. The
hosted skills.sh crawler's inclusion rules are not documented in the CLI and need
verification.

## Acceptance Criteria

- Apply `metadata.internal: true` so `.agents/skills/**` never appears in
  `npx skills` discovery, sourced from the OAT sync layer (not hand-edited) so it
  survives `oat sync`. Verify with `npx skills add tkstang/skills --list` (the OAT
  tooling skills drop out) vs `INSTALL_INTERNAL_SKILLS=1 … --list` (they reappear).
- Consensus `refine`/`evaluate` treatment (**preferred direction: keep
  discoverable + self-redirect**, not hide): leave them visible on skills.sh so
  the plugin is marketable, but make standalone invocation fail gracefully — the
  SKILL.md instructs the host agent that the skill requires the consensus plugin
  and points to plugin install, and the wrapper turns
  `CONSENSUS_PROVIDER_CLI_MISSING` into an actionable "install the consensus
  plugin" message (canonical TS source → rebuild). This is a shipped-skill
  content/behavior change → skill version bump → ships as **0.1.1**. (Alternative
  if redirect proves insufficient: `metadata.internal: true` to hide them; verify
  plugin-manifest discovery still presents the plugin.)
- Confirm the standalone skills (`session-observer`, `export-session-transcript`)
  remain the only individually-installable entries and resolve/run correctly.
- Confirm whether the skills.sh hosted leaderboard auto-crawls or is
  submission-gated; choose the listing strategy accordingly.
- Re-run discovery verification after the flags land (and after skills.sh indexes
  the repo, if it does), and record the result in `current-state.md` before any
  public-listing claim.

## Findings (2026-06-20)

- **The real exclude mechanism is `metadata.internal: true`** (documented in the
  `vercel-labs/skills` CLI README, *not* in the skills.sh customize docs). A skill
  with `metadata.internal: true` in frontmatter is hidden from normal discovery
  and is only visible/installable when `INSTALL_INTERNAL_SKILLS=1` is set. This is
  the per-skill lever for keeping a `SKILL.md` off the public surface.
- **`skills.sh.json` (repo root) is display-only** (<https://www.skills.sh/docs/customize>):
  it groups/orders skills on the repo's skills.sh page and does not affect
  discovery or installation. Not an exclude mechanism.
- **Discovery model (verified 2026-06-20 — 60 skills in default and `--full-depth`
  alike):** the CLI scans a fixed list of **container directories**, and
  `.agents/skills/` is explicitly one of them — which is why all ~56 OAT tooling
  skills (`analyze`, `compare`, `deep-research`, `skeptic`, `synthesize`,
  `create-agnostic-skill`, `authoring-docs`, `oat-*`) are surfaced. `refine` and
  `evaluate` are surfaced via **plugin-manifest discovery** (the repo-root
  `.claude-plugin/marketplace.json` / `plugin.json` declares the consensus
  plugin). `session-observer` / `export-session-transcript` come from `skills/`.
  `--full-depth` only adds `SKILL.md` *outside* container dirs (none here), so it
  changes nothing.
- **The earlier "root `SKILL.md` lever" was wrong** — default discovery already
  walks every container dir, so a repo-root `SKILL.md` does not suppress
  `.agents/skills/`. Scratch it.

## Open questions / design tensions

- `.agents/skills/**` is `oat sync`-generated. `metadata.internal: true` on those
  must be applied by the OAT sync layer (or a post-sync step), or it gets
  overwritten — do not hand-edit synced files. Decide where the flag lives.
- Marking consensus `refine`/`evaluate` `internal: true` removes them from
  `npx skills` discovery (killing the broken standalone-install path) **without**
  touching the real plugin-install path (`claude`/`codex plugin install` does not
  use `npx skills`). **Verify** the consensus plugin stays discoverable *as a
  plugin* via plugin-manifest discovery when its skills are internal. Note: this
  is a **content change to shipped skills → requires a skill version bump** (top
  `version` + `metadata.version` in sync, via `scripts/bump-version.mjs`), and
  because v0.1.0 is already tagged/released it lands as a **0.1.1**, not a re-tag.
- Confirm whether the skills.sh hosted leaderboard auto-crawls public repos or is
  submission-gated (still undocumented; `tkstang/skills` is not yet indexed).

## Notes

Surfaced 2026-06-20 during the bl-d85f v0.1 release closeout — see that item's
Closeout section and the `RELEASING.md` post-tag discovery note. This is the
remaining post-tag discovery work; the v0.1.0 tag and release shipped without it
because no public-listing claim is being made yet. **Recommendation until
resolved:** do not submit/list `tkstang/skills` on skills.sh until the `internal`
flagging (especially for `.agents/skills/**`) is in place, so the OAT tooling and
plugin-nested skills are not mis-presented as standalone installable skills.
