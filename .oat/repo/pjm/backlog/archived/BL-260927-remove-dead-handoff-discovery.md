---
id: BL-260927-remove-dead-handoff-discovery
title: Remove dead handoff discovery from session-fork-to-destination
status: closed
priority: low
scope: task
scope_estimate: S
labels:
  - session-fork-to-destination
  - cleanup
  - dead-code
assignee: null
created: 2026-09-27T12:30:49.577Z
updated: 2026-10-11T03:10:13Z
associated_issues: []
external_plans:
  - .oat/repo/reference/external-plans/2026-10-10-remove-dead-handoff-discovery.md
---

## Description

The session-observer test-pruning campaign (2026-09-26) found that discoverHandoffCandidates in src/skills/session-fork-to-destination/src/discovery.ts has had no production caller since #87 retired the handoff executor, and it is not in the shipped bundle. Most of the 634-line discovery.test.ts guards only this dead function. The rest of discovery.ts is live: preview.ts imports compareQualifiedSessionIds from it. The one observer behavior the suite uniquely guarded (exact-all Claude candidates carry the transcript-recorded cwd, locate.ts) is now covered by a colliding-slug case in session-observer's locate.test.ts. See .oat/repo/reference/reviews/2026-09-26-session-observer-test-pruning-campaign.md.

## Acceptance Criteria

- Before deleting, re-confirm `discoverHandoffCandidates` has no caller in `src/`, `scripts/`, or generated `skills/`/`plugins/` payloads.
- Delete `discoverHandoffCandidates` and any helpers or dependency seams only it uses. Keep `compareQualifiedSessionIds` and anything else `preview.ts` or other live code imports.
- Remove the `discovery.test.ts` cases that exercise only the deleted function. Keep or move any case that protects a still-live export.
- Confirm the `locate.ts` transcript-cwd rule for exact-all Claude candidates is still guarded. Changing it to return `targetCwd` must fail `locate.test.ts`'s colliding-slug case.
- Bump `session-fork-to-destination`, add a CHANGELOG entry, regenerate outputs, and pass focused tests plus `pnpm run test`, `validate`, `build:check`, and `validate:skill-versions`.

## Completion evidence (2026-10-10)

Implemented on `refactor/remove-dead-handoff-discovery` from
`82230902b807befdee3ba42447216d8eae164fed`. Retired discovery has no live caller;
its implementation, 17-case suite and exclusive executor-contract helper are removed.
The comparator and observer/shared source are preserved. Both prescribed keeper
mutations failed for their intended assertion, then passed after exact restoration.
Baseline: four suites / 259 tests; retained: three suites / 242 tests. Full suite:
184 files passed, two skipped; 2,854 tests passed, three skipped. Build, freshness,
validate, smoke, types, skill-version/internal-flag guards and changed-file lint/format
passed. `session-fork-to-destination` is 0.3.4 with regenerated standalone/plugin
payloads and a preserved-history DR-260912 annotation. Independent review, PR, merge,
release and installation remain separate.
