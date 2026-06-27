---
id: BL-260627-verify-skills-sh-hosted
title: 'Verify skills.sh hosted discovery surface and listing strategy'
status: open # open | in_progress | closed | wont_do
priority: medium # urgent | high | medium | low | none
scope: task # idea | task | feature | initiative
scope_estimate: S # XS | S | M | L | XL | XXL
labels:
  - release
  - distribution
  - discovery
created: '2026-06-27T00:00:00Z'
updated: '2026-06-27T00:00:00Z'
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
