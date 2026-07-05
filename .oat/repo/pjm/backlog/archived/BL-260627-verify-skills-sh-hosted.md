---
id: BL-260627-verify-skills-sh-hosted
title: 'Verify skills.sh hosted discovery surface and listing strategy'
status: closed # open | in_progress | closed | wont_do
priority: medium # urgent | high | medium | low | none
scope: task # idea | task | feature | initiative
scope_estimate: S # XS | S | M | L | XL | XXL
labels:
  - release
  - distribution
  - discovery
created: '2026-06-27T00:00:00Z'
updated: '2026-07-05T00:00:00Z'
associated_issues: []
---

## Description

Follow-up from `BL-260621-control-public-skill-discovery` (project public-discovery,
PR #38). That work controlled the part we own — the `npx skills` **CLI** discovery
path — and verified it live: the OAT tooling under `.agents/skills/**` carries
`metadata.internal: true` and drops out of `npx skills --list` (reappearing only
under `INSTALL_INTERNAL_SKILLS=1`), the consensus skills stay discoverable and
recover standalone, and `session-observer`/`export-session-transcript` are the only
individually-installable standalone entries.

What remains unverified is the **skills.sh hosted platform** (Vercel-controlled),
which the repo does not own:

1. Does skills.sh **auto-crawl** public repos, or is listing **submission-gated**?
2. Does the hosted crawler **honor `metadata.internal`** the same way the
   `vercel-labs/skills` CLI does?

As of 2026-06-27, `tkstang/skills` is **not yet indexed** on skills.sh, so nothing
is mis-exposed today — this is a pre-listing verification, not a live exposure fix.

## Acceptance Criteria

- Determine skills.sh crawl-vs-submission behavior (record commands/URLs/date/output).
  Concrete checks: `npx skills find tkstang`, `npx skills find session-observer`, a
  direct hosted-page/search check for `tkstang/skills`, plus any skills.sh / Vercel
  docs consulted.
- Confirm whether the hosted index honors `metadata.internal` (the OAT tooling must
  not appear; the standalone + consensus skills should).
- Choose and record the listing strategy (submit vs wait-for-crawl) in
  `current-state.md`.
- Do not make any public skills.sh listing claim until the hosted path is verified.

## Notes

- The in-repo CLI-path control and its enforcement gate shipped in PR #38
  (see `DR-260627-control-public-skill-discovery`). This item is the deferred
  hosted-surface verification only.
- An **optional** upstream improvement also exists: run the
  `open-agent-toolkit` handoff prompt to add `metadata.internal: true` at the OAT
  pack source so all consumers inherit it and the per-repo apply script can retire.

## Findings (2026-07-05)

### Hosted state (live probes, `skills@1.5.14`, run outside the repo cwd)

`tkstang/skills` remains completely absent from the hosted surface pre-seeding:
`find tkstang` / `find session-observer` / `find export-session-transcript` /
`find session --owner tkstang` all return nothing; `https://skills.sh/tkstang/skills`
and `https://www.skills.sh/tkstang` both 404; the authenticated API is still
gated (`401 authentication_required`). Control probe: `find consensus` returns
six *other* repos' skills, confirming search itself works. The only `tkstang`
string on the hosted search page is the query echoed into the Next.js hydration
payload, not a result.

### How the hosted index is populated: telemetry-only, no crawl, no submission

- skills.sh FAQ: skills appear "automatically through anonymous telemetry when
  users run `npx skills add <owner/repo>`." About page: ranking from anonymous,
  deduplicated install counts, deduped hourly.
- Maintainer-collaborator close on upstream issue #874: "skills are
  automatically indexed when they are installed via the CLI... No manual
  listing request needed." Contributor source audit on issue #1315 (unrebutted):
  no GitHub crawler, no webhooks, no topic discovery. Issue #880 (the direct
  crawl-vs-submission question) remains open with zero maintainer replies.
- Empirical corroboration: `vercel-labs/agent-skills` has 9 `SKILL.md` files on
  disk but its skills.sh page lists 13 entries including renamed/deleted names —
  an accumulated telemetry history, not a live tree scan.

### `metadata.internal` on the hosted surface

- The flag is enforced **client-side, before selection** (`vercel-labs/skills`
  `src/skills.ts:46-83` — internal skills are dropped from discovery unless
  `INSTALL_INTERNAL_SKILLS=1` or explicitly named). Install telemetry sends
  **only the selected skill name(s)** (`src/add.ts:1786-1788`,
  `skills: selectedSkills.map((s) => s.name)`), never the repo's skill list.
  Both claims verified directly in source at v1.5.14.
- Therefore the hosted index never *sees* internal skills through normal
  installs — but it applies **no server-side filter and has no delist path**:
  open issue #1578 documents a skill marked `internal: true` after the fact
  persisting on its repo's public page as a permanent "telemetry fossil."
- Net safety property: the 57 OAT tooling skills stay off the hosted surface
  **iff** no one ever installs one by name with telemetry enabled. Any such
  event is effectively irreversible.

### Seeding (2026-07-05)

Owner installs performed with telemetry live (`DISABLE_TELEMETRY`/`DO_NOT_TRACK`
confirmed unset), from a scratch project:

- `npx -y skills@1.5.14 add tkstang/skills@session-observer --yes -a claude-code`
  → `Selected 1 skill: session-observer` → installed, `scripts/` intact,
  entrypoint executes (`session-observer.mjs --help` prints usage).
- `npx -y skills@1.5.14 add tkstang/skills@export-session-transcript --yes -a claude-code`
  → `Selected 1 skill: export-session-transcript` → installed.
- Confirmed no other skill name (no `oat-*`, no consensus skill) appeared in
  either install's selection or `skills-lock.json`.
- Immediate re-probe still negative/404 — expected given the hourly-dedup
  indexing lag; hosted appearance is a post-close re-check.

## Closeout (2026-07-05)

**Closed** — all acceptance criteria dispositioned; strategy recorded in
`DR-260705-skills-sh-listing-is-telemetry` and `current-state.md`:

- **Crawl vs submission:** determined — telemetry-only; no crawl, no
  submission flow (evidence above).
- **Hosted `metadata.internal`:** determined — no server-side filter exists,
  but none is needed for normal installs because filtering happens client-side
  before telemetry; the real rule is the guardrail in DR-260705 (never name an
  internal skill in a telemetry-enabled install; irreversible if violated).
- **Listing strategy:** telemetry-seed, never submit. Seeded 2026-07-05 with
  the two intended standalone skills.
- **No public-listing claim** until the seeded installs surface and the
  visible set is confirmed to be exactly the intended skills (re-check
  `find session-observer` / `skills.sh/tkstang/skills` after the indexing lag).
