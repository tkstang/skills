---
id: BL-260621-control-public-skill-discovery
title: Control public skill discovery surface on skills.sh
status: open
priority: medium
scope: task
scope_estimate: M
labels:
  - release
  - distribution
  - discovery
  - skills
assignee: null
created: 2026-06-21T00:05:11Z
updated: 2026-06-26T23:01:24Z
associated_issues: []
legacy_id: bl-7c1d
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

## Findings (2026-06-26)

p03 verification used the published `skills@1.5.13` CLI explicitly. From this
repo cwd, the exact unversioned `npx skills ...` spelling resolves the local
package named `skills` first and fails with `npm error could not determine
executable to run`; version-pinning avoids that local package shadow while still
exercising the public CLI.

### Hosted index checks

| Check | Date | Command / URL | Output snippet | Result |
| ----- | ---- | ------------- | -------------- | ------ |
| Owner search | 2026-06-26 | `npx -y skills@1.5.13 find tkstang` | `No skills found for "tkstang"` | `tkstang/skills` is not indexed by the hosted search surface. |
| Skill search | 2026-06-26 | `npx -y skills@1.5.13 find session-observer` | `No skills found for "session-observer"` | The intended standalone skill does not surface from the hosted index yet. |
| Owner-scoped search | 2026-06-26 | `npx -y skills@1.5.13 find session --owner tkstang` | `No skills found for "session" from owner "tkstang"` | No indexed skills are associated with owner `tkstang`. |
| Direct repo page | 2026-06-26 | `curl -L https://skills.sh/tkstang/skills` | `HTTP_STATUS=404`, `FINAL_URL=https://www.skills.sh/tkstang/skills`, `NEXT_HTTP_ERROR_FALLBACK;404` | No hosted repo page exists for `tkstang/skills`. |
| Hosted search page | 2026-06-26 | `curl -L 'https://www.skills.sh/search?q=tkstang'` | `HTTP_STATUS=200`; grep found no `tkstang/skills`, `session-observer`, or `export-session-transcript` in the returned HTML | The rendered search route is reachable, but the static response contains no matching repo or skill IDs. |
| Public API search | 2026-06-26 | `curl -L 'https://skills.sh/api/v1/skills/search?q=tkstang&limit=10'` | `HTTP_STATUS=401`; `authentication_required`; message points to `https://skills.sh/docs/api#authentication` | Public unauthenticated API search is not available for this verification path. |

### Docs consulted

- <https://vercel.com/kb/guide/agent-skills-creating-installing-and-sharing-reusable-agent-context> states there is no special skills.sh publish command or registry submission flow: put the skill in a git repo, share it, and installs through `npx skills add` can make it appear on skills.sh via install telemetry.
- <https://www.skills.sh/docs> states the leaderboard is ranked from anonymous telemetry collected by the `skills` CLI when users install skills.
- <https://www.skills.sh/docs/api> documents the hosted search/detail API, but live unauthenticated requests returned `authentication_required`.
- <https://vercel.com/changelog/introducing-skills-the-open-agent-skills-ecosystem> describes skills.sh as a directory and leaderboard for discovering, browsing, and tracking skill package usage.
- <https://github.com/vercel-labs/skills/issues/880> is still an open upstream question asking whether skills.sh auto-indexes public GitHub repos or requires manual submission; the current Vercel KB above is the clearest published guidance.

### Determination and strategy

- **Auto-crawl:** no evidence that skills.sh currently auto-crawls arbitrary
  public GitHub repos into search. `tkstang/skills` is public and installable via
  direct CLI source, but it is absent from hosted `skills find`, hosted search,
  and the direct repo page.
- **Submission-gated:** no active registry submission flow was found. Current
  Vercel guidance says there is no special publish command; hosted visibility can
  follow install telemetry.
- **Chosen listing strategy:** do not submit or claim a public listing now. After
  release and after the cat-3 upstream `metadata.internal` flag lands and syncs
  back, seed/verify hosted visibility through real direct installs of the intended
  standalone entries (`session-observer`, `export-session-transcript`) and re-run
  the hosted checks above. If Vercel later exposes a manual submission path, use
  it only after the cat-3 hiding verification passes.
- **Hosted `metadata.internal` behavior:** still unverified. Because this repo is
  absent from the hosted index, there is no hosted indexed before/after surface on
  which to test whether skills.sh honors `metadata.internal`. Treat CLI behavior
  as verified, but keep hosted behavior as a post-indexing follow-up.
- **Cat-3 deferral:** the actual hiding of `.agents/skills/**` remains deferred
  until the `open-agent-toolkit` upstream source adds `metadata.internal: true`
  and this repo syncs it back. Do not claim a public listing or hosted hiding
  outcome before that post-upstream verification is complete.

## Open questions / design tensions

- `.agents/skills/**` is `oat sync`-generated. `metadata.internal: true` on those
  must be applied by the OAT sync layer (or a post-sync step), or it gets
  overwritten — do not hand-edit synced files. Decide where the flag lives.
- Historical/superseded (2026-06-26 p03): the earlier option to mark consensus
  `refine`/`evaluate` `internal: true` is no longer the accepted strategy. The
  current project strategy keeps all five consensus skills (`create`, `decide`,
  `evaluate`, `plan`, `refine`) discoverable and recoverable as standalone
  installs with actionable missing-CLI / installer guidance. Only category 3
  `.agents/skills/**` hiding remains deferred to the upstream OAT sync-layer
  change.
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
