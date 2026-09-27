---
id: BL-260927-decide-the-fate-of-unwired
title: Decide the fate of unwired session-observer code paths
status: open
priority: low
scope: task
scope_estimate: M
labels:
  - session-observer
  - transcript-core
  - cleanup
  - dead-code
assignee: null
created: 2026-09-27T12:30:49.763Z
updated: 2026-09-27T12:30:49.763Z
associated_issues: []
external_plans: []
---

## Description

The session-observer test-pruning campaign (2026-09-26) kept several production paths that no shipped caller reaches, because removing them is a product decision rather than test pruning. The unused functions are recoverCursorStateStore (lib/cursor-state.ts) and classifyTranscript (lib/session-classifier.ts). The paths unreachable from the shipped CLI are the Cursor branches of markRead, getSession, and set/clearWatchedByPid (lib/state.ts), and buildDigest('cursor', ...) without the v2 options (lib/digest.ts). That last one is the legacy pre-#63 Cursor v1 digest path, superseded by schemaVersion 2 digests. Nothing reads DetailedTranscriptRecord.sourceCarrier (src/shared/transcript/runtimes.ts). Only one integration test loads the standalone scripts/lib/cursor-*.mjs outputs declared in build.json. Each path still carries tests and upkeep. See .oat/repo/reference/reviews/2026-09-26-session-observer-test-pruning-campaign.md.

## Acceptance Criteria

- For each path listed in the description, record a keep, wire-up, or delete decision with a one-line reason. Record a durable decision only if the choice is architectural.
- Delete the legacy Cursor v1 `buildDigest('cursor', …)` path unless a live consumer is found. Retarget or remove its `digest.test.ts` tests ("buildDigest works for cursor runtime", "cursor digest hides an unterminated provisional tail", "cursor recovery pointers use the buffered user source record"). The last is the only guard of the recovery-pointer source-record rule, so port it to the v2 path if that rule still applies.
- For deleted paths, remove their tests and any test-only seams in the same change. For kept or wired-up paths, keep the tests and document the intended caller.
- Decide whether the standalone `scripts/lib/cursor-*.mjs` build.json entries remain a shipped contract. If they are dropped, remove the moved integration test ("integration: generated standalone Cursor modules") with them.
- Bump each affected skill, including shared-source fan-out when `src/shared/transcript/` changes, and add a CHANGELOG entry. Regenerate outputs and pass `pnpm run test`, `validate`, `build:check`, and `validate:skill-versions`.
