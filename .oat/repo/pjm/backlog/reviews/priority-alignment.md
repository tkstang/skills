# Backlog Priority Alignment

**Date:** 2026-09-20
**Status:** The approved six-ticket wave is accepted and closed in PR #99; PR #99 still awaits merge, and no next wave is selected.

The September 20 batch used one canonical plan, task-sized implementation commits, Sol implementation and independent Opus reviews. Final acceptance closes the six records in the same PR because their criteria are satisfied. This records accepted branch delivery only: PR #99 is not merged, released, globally installed or live-provider certified.

## Completed selected batch

| Order | Completed item | Plan task |
| --- | --- | --- |
| 1 | [BL-260919-stabilize-the-watcher-sigterm — Stabilize the watcher SIGTERM re-arm test](../archived/BL-260919-stabilize-the-watcher-sigterm.md) | p01-t01 |
| 2 | [BL-260919-surface-terminally — Surface terminally unsuccessful peer turns as watch events](../archived/BL-260919-surface-terminally.md) | p01-t02 |
| 3 | [BL-260919-skill-attribution-in-session — Skill attribution in session activity events](../archived/BL-260919-skill-attribution-in-session.md) | p02-t01 |
| 4 | [BL-260919-token-and-usage-accounting — Token and usage accounting for session activity](../archived/BL-260919-token-and-usage-accounting.md) | p02-t02 |
| 5 | [BL-260919-uncapped-structured-activity — Uncapped structured activity export for cross-session analysis](../archived/BL-260919-uncapped-structured-activity.md) | p03-t01 |
| 6 | [BL-260919-session-retro-consume-activity — Session-retro: consume activity evidence](../archived/BL-260919-session-retro-consume-activity.md) | p04-t01 |

Project: [session-evidence-followups](../../../../projects/shared/session-evidence-followups/plan.md). The project contains the plan, implementation log, immutable review packets and acceptance receipts. The watcher record includes 50 consecutive final-tree local passes with CPU-load coverage and three consecutive successful fixing-PR validate runs.

## Delivery boundary

PR #99 is the single delivery PR for the six-ticket wave and remains open for review pending merge. Its final accepted branch implements metadata-only unsuccessful terminal events, watcher re-arm stability, skill attribution, usage accounting, complete structured activity capture and frozen-evidence Session Retro. Closing these tickets does not claim the code is on main.

The separately requested Review timeout/schema work is already merged on main through PR #101 as Consensus `0.2.1`: Draft-07 response schemas, a 900-second default and an explicit `--timeout-sec` override. Accepted Opus reviews establish the bounded CLI route used for these packets; they do not certify a provider matrix, external install, marketplace discovery or native continuation.

## Not selected

The 23 remaining active items retain their previous relative proposals. Installer live acceptance, live messaging acceptance, live-submit diagnosis, duplicate self identity, digest recovery, skill evaluation, collaboration protocol, child discovery, shared-session merge, retro ledger, research and scale work remain outside PR #99. A later wave requires separate selection and authorization.

## History

- 2026-09-20: Final acceptance completed the six-ticket wave and closed its records in PR #99; merge remains pending and no next wave was selected.
- 2026-09-20: PR #101 merged the Consensus `0.2.1` Draft-07 schema and Review timeout path already used by the accepted bounded reviews.
- 2026-09-20: User approved the six-ticket wave and subsequently added the 15-minute Review timeout requirement.
- 2026-09-16: Prior kickoff and proposed ordering retained in Git history. Installer live acceptance remains open.
