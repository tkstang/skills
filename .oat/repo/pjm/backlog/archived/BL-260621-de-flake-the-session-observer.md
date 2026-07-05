---
id: BL-260621-de-flake-the-session-observer
title: De-flake the session-observer watch test suite
status: closed
priority: medium
scope: task
scope_estimate: S
labels:
  - testing
  - session-observer
  - ci
  - reliability
assignee: null
created: 2026-06-21T15:23:55Z
updated: 2026-06-26T21:49:32Z
associated_issues: []
legacy_id: bl-1f9c
---

## Description

`tests/session-observer/watch.test.ts` contains timing/signal-sensitive tests
that flake intermittently under load (the `pre-push` hook and CI), even though
direct local runs are consistently green (72 files / 726 tests). The flakes
passed on every clean re-run, so they are non-deterministic timing races, not
real regressions — but they cause real release friction.

Observed during the v0.1.0 release (2026-06-20/21):

- Local `pre-push` hook (during the tag push): `watch.test.ts:1472`
  "SIGTERM cleanup clears watcher and control metadata", and a separate run with
  two watch tests failing — forced a `git push --no-verify` for the tag.
- PR #28 CI `validate`: `watch.test.ts:241` "expected false to be truthy"
  (baseline output not emitted in time) — forced a CI re-run.

## Root cause (suspected)

Tests assert against **tight wall-clock budgets** that starve when the machine
is busy:

- The in-process baseline test (`~line 217`) runs `runWatchLoop` with
  `pollSec: 0.02`, `debounceSec: 0.02`, `maxRuntimeMin: 0.004` (~240 ms) and
  expects the baseline event to be emitted before `max-runtime` fires. Under load
  the loop can hit the 240 ms cap before emitting → `baselineRecordIndex=1` /
  `engagement=engaged` assertions see empty output.
- The SIGTERM teardown test (`~line 1426`) spawns a **real** `node` watch
  subprocess, waits for `watch.json.active`, sends `SIGTERM`, and asserts a clean
  exit (`signal === null`, `code === 0`) plus cleared watcher/control metadata.
  Under load the child can exit via signal or race the teardown window.

## Acceptance Criteria

- Make the watch tests deterministic so they pass reliably under load (CI and the
  `pre-push` hook), without weakening what they verify:
  - Replace tight wall-clock budgets with a deterministic stop condition (inject a
    fake clock / controllable timer, drive the loop to a known number of cycles,
    or signal completion explicitly) instead of racing a ~240 ms `maxRuntimeMin`.
  - For the SIGTERM subprocess test, harden the active-state wait and teardown
    assertions (generous `waitFor` budget, deterministic exit handling) so a
    busy machine cannot turn a clean shutdown into a signal exit or a metadata
    race.
- The suite passes repeatedly under load — e.g. run it in a tight loop and/or
  under concurrent CPU pressure with zero failures across many iterations.
- No reduction in coverage: baseline-emission, engagement, and SIGTERM
  cleanup/metadata behavior remain asserted.
- `session-observer` is a shipped standalone skill, so any change under
  `skills/session-observer/` (including generated runtime) requires bumping its
  `SKILL.md` version (enforced by `scripts/validate-skill-versions.mjs`). A
  test-only change under `tests/session-observer/` does not.

## Notes

Surfaced during the bl-d85f v0.1.0 release closeout. Not a release blocker —
v0.1.0 shipped green; this is test-harness reliability hardening. Watch tests are
deliberately separate from provider-CLI fixture tests; this item is scoped to the
watch suite's timing model only.
