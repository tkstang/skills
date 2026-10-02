---
id: BL-261002-resolve-deferred-session
title: Resolve deferred session-search review follow-ups
status: open
priority: low
scope: task
scope_estimate: S
labels:
  - session-search
  - follow-up
assignee: null
created: 2026-10-02T17:48:12.667Z
updated: 2026-10-02T17:48:12.667Z
associated_issues: []
external_plans: []
---

## Description

The session-search project (2026-10-02, .oat/projects/shared/session-search) deferred five non-regression Low findings from its implementation exit gate and final review cycles 4 and 5. Affected sessions stay findable through other tiers or content; only ranking, labeling, or excerpt quality degrades. See summary.md Follow-up Items and reviews/archived/final-review-2026-10-02T173611Z.md.

The five deferred findings:

- **Exit-gate L1:** a custom title in a transcript's bounded prefix loses to a generated title in the tail. This needs about 600K characters between the two titles and affects only title-tier ranking.
- **Exit-gate L2:** Codex orphans that exist only as `state_5.sqlite` metadata (rollout file pruned) lose their archived, child, and title facts, so the session is found but unlabeled.
- **Exit-gate L3:** the opt-in remote history fallback excerpt can drop the match and the session id. It affects only hosts without the skill installed.
- **Final cycle-4 L1:** Claude-only `slug` and `sessionId` keys are blanked on Codex lines, including inside MCP results. It predates p05-t06 and touched 12 local lines, mostly Stoa memory slugs.
- **Final cycle-5 L1:** the deep raw fallback's envelope blanker caps values at 1024 characters, so a `cwd` longer than 1024 characters on an oversize old-key-order Claude tool line can yield a path-only deep hit. Suggested fix: raise the cap to 4096 (about 1 ms per multi-MB line), update design.md, and add a test.

## Acceptance Criteria

- Each of the five findings is fixed with a focused regression test, or explicitly closed as won't-do with the reason recorded here.
- Fixes edit only canonical sources under `src/skills/session-search/`; generated `skills/` and `plugins/*/skills/` outputs are rebuilt and `pnpm run build:check` passes.
- `session-search` gets a version bump and CHANGELOG entry, and focused session-search tests plus `pnpm run test`, `validate`, and `validate:skill-versions` pass.
- A read-only real-store smoke run (counts and titles only) confirms no recall regression.
