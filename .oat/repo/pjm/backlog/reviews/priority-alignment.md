# Backlog Priority Alignment

**Date:** 2026-09-20
**Status:** One approved wave is in implementation; all other candidates remain unselected.

The September 16 kickoff is superseded by the user-approved batch below. The user selected clear requirements and verifiable outcomes, one canonical plan for one wave, Sol implementation, independent Opus reviews, and one PR. A later request adds the bounded Consensus Review default-timeout change (600→900 seconds), executed first as p00-t01. It does not introduce a second wave.

## Approved batch

| Order | Item | Plan task |
| --- | --- | --- |
| 1 | [BL-260919-stabilize-the-watcher-sigterm — Stabilize the watcher SIGTERM re-arm test](../items/BL-260919-stabilize-the-watcher-sigterm.md) | p01-t01 |
| 2 | [BL-260919-surface-terminally — Surface terminally unsuccessful peer turns as watch events](../items/BL-260919-surface-terminally.md) | p01-t02 |
| 3 | [BL-260919-skill-attribution-in-session — Skill attribution in session activity events](../items/BL-260919-skill-attribution-in-session.md) | p02-t01 |
| 4 | [BL-260919-token-and-usage-accounting — Token and usage accounting for session activity](../items/BL-260919-token-and-usage-accounting.md) | p02-t02 |
| 5 | [BL-260919-uncapped-structured-activity — Uncapped structured activity export for cross-session analysis](../items/BL-260919-uncapped-structured-activity.md) | p03-t01 |
| 6 | [BL-260919-session-retro-consume-activity — Session-retro: consume activity evidence](../items/BL-260919-session-retro-consume-activity.md) | p04-t01 |

Project: [session-evidence-followups](../../../../projects/shared/session-evidence-followups/plan.md). The project has already consumed the kickoff context directly, so no duplicate per-ticket handoff files are generated.

## Execution and acceptance

Watcher work precedes shared skill/usage metadata, followed by complete structured export and its retro consumer. Read-only recon ran in parallel. Product phases serialize overlapping native schemas, version fields, changelog and generated bundles. One PR contains task-sized Conventional Commits; no stack and no merge authorization.

Each phase receives Sol self-review and an independent Opus review. Full integration checks and final independent review precede delivery. The watcher item remains open until 50 consecutive local runs (including CPU load) and three consecutive fixing-PR validate successes are recorded. No item closes on code presence alone.

## Not selected

Installer live acceptance, live messaging acceptance, broader Consensus maintenance, duplicate self identity, digest recovery, child discovery, shared-session merge, retro ledger, and other research/scale items remain active but outside this wave. Their relative ratings are in the [full review](backlog-and-roadmap-review.md); a later wave requires separate selection.

## History

- 2026-09-20: User approved the six-ticket wave and subsequently added the 15-minute review timeout. One project/plan and one PR confirmed.
- 2026-09-16: Prior kickoff and proposed ordering retained in Git history. Observer/Consensus Review implementations and the installer implementation have since merged; installer live acceptance remains open.
