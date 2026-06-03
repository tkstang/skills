---
oat_status: complete
oat_ready_for: oat-project-review-provide
oat_blockers: []
oat_last_updated: 2026-06-03
oat_current_task_id: null
oat_generated: false
---

# Implementation: session-observer-watch

**Started:** 2026-06-03
**Last Updated:** 2026-06-03

> This document is used to resume interrupted implementation sessions.
>
> `oat_current_task_id` points at the next plan task to do.

## Progress Overview

| Phase | Status | Tasks | Completed |
| ----- | ------ | ----- | --------- |
| Phase 1: Watch State And CLI Surface | complete | 2 | 2/2 |
| Phase 2: Watch Loop And Event Emission | complete | 3 | 3/3 |
| Phase 3: Skill Documentation And Dogfooding Sync | complete | 2 | 2/2 |
| Phase 4: Final Review Fixes | complete | 3 | 3/3 |
| Phase 5: Final Review Fixes v2 | complete | 1 | 1/1 |
| Phase 6: Final Review Fixes v3 | complete | 3 | 3/3 |

**Total:** 14/14 tasks completed

---

## Phase 1: Watch State And CLI Surface

**Status:** complete
**Started:** 2026-06-03
**Completed:** 2026-06-03

### Task p01-t01: Add Watch State Primitives

**Status:** completed
**Commit:** cd73202

**Notes:**

- Added lock-protected `watch-state.mjs`, atomic watch/control JSON writes, stale-pid cleanup, and offset-preserving `watchedByPid` helpers.
- Verification passed: `node --test tests/session-observer/watch-state.test.mjs tests/session-observer/state.test.mjs`.
- Verification passed: `npm test -- tests/session-observer/watch-state.test.mjs tests/session-observer/state.test.mjs`.

---

### Task p01-t02: Add Watch CLI Parsing And Help

**Status:** completed
**Commit:** 13162eb

**Notes:**

- Added canonical `watch` and `watch-ctl` commands, top-level `--watch` alias, watch help flags, and `watch-ctl status --json` no-active-watcher payload.
- Watch execution is intentionally a CLI placeholder; polling/debounce implementation remains scheduled for p02.
- Verification passed: `node --test tests/session-observer/cli.test.mjs`.
- Verification passed: `node skills/session-observer/scripts/session-observer.mjs --help`.

---

## Phase 2: Watch Loop And Event Emission

**Status:** complete
**Started:** 2026-06-03
**Completed:** 2026-06-03

### Task p02-t01: Extract Reusable Catch-Up Observation Pipeline

**Status:** completed
**Commit:** f889d32

**Notes:**

- Added `observe.mjs` as a reusable catch-up observation pipeline that returns exit-style outcomes without calling `process.exit`.
- Updated `runCatchUp` to use the helper while preserving existing CLI output behavior.
- Verification passed: `node --test tests/session-observer/observe.test.mjs tests/session-observer/cli.test.mjs`.
- Verification passed: `npm test -- tests/session-observer/observe.test.mjs tests/session-observer/cli.test.mjs`.

---

### Task p02-t02: Implement Polling, Debounce, And Event Log

**Status:** completed
**Commit:** 393488d

**Notes:**

- Added `watch.mjs` with foreground stat-based polling, initial baseline establishment, debounce coalescing, markdown/JSON-line event emission, metadata-only event logs, and bounded runtime support.
- Updated the `watch` CLI command to run the polling loop instead of the p01 placeholder.
- Verification passed: `node --test tests/session-observer/watch.test.mjs tests/session-observer/cli.test.mjs`.
- Verification passed: `node skills/session-observer/scripts/session-observer.mjs watch --runtime claude-code --cwd "$PWD" --poll-sec 1 --debounce-sec 1 --max-runtime-min 0.02 --json`.
- Verification passed: `npm test -- tests/session-observer/watch.test.mjs tests/session-observer/cli.test.mjs`.

---

### Task p02-t03: Add Watch Control And Graceful Shutdown

**Status:** completed
**Commit:** 15dd40f

**Notes:**

- Added `watch-ctl` directives for pause, resume, flush, and stop.
- The watcher now applies control directives on poll ticks, clears `watch.json` and `watch.control.json` on normal/control/signal exit, and maintains `watchedByPid` ownership for active sessions.
- Manual `catch-up` warns when a watcher owns the same session offset but still succeeds.
- Verification passed: `node --test tests/session-observer/watch.test.mjs tests/session-observer/cli.test.mjs`.
- Verification passed: `npm test -- tests/session-observer/watch.test.mjs tests/session-observer/cli.test.mjs`.

---

## Phase 3: Skill Documentation And Dogfooding Sync

**Status:** complete
**Started:** 2026-06-03
**Completed:** 2026-06-03

### Task p03-t01: Update Skill Instructions And Watch Reference

**Status:** completed
**Commit:** 1f33657
**Follow-up Fix:** e5505bf

**Notes:**

- Added a validation invariant that rejects stale session-observer watch-mode status and requires `watch`, `watch-ctl`, and `--watch` documentation when the session-observer skill is present.
- Updated `SKILL.md` and `references/watch-design.md` to document implemented watch behavior, active-invocation automatic-response boundaries, and deferred provider-hook integration.
- `.agents/skills/session-observer` resolves through the tracked symlink to `../../skills/session-observer`, so the provider-view docs reflect the canonical updates.
- Verification passed: `npm run validate`.
- Verification passed: `rg -n "not implemented|watch|watch-ctl|--watch" skills/session-observer .agents/skills/session-observer`.

---

### Task p03-t02: Sync Dogfooding Install And Run Full Verification

**Status:** completed
**Commit:** d41a050

**Notes:**

- Refreshed `~/.agents/skills/session-observer` from `skills/session-observer`.
- Verified `.agents/skills/session-observer` is already in sync via the tracked symlink.
- Verified `~/.claude/skills/session-observer` and `~/.cursor/skills/session-observer` both resolve to `../../.agents/skills/session-observer`.
- Ran `oat sync --scope user`; it reported session-observer already in sync for Claude, Cursor, and Copilot provider views with no changes required.
- Verification passed: `npm test`.
- Verification passed: `npm run validate`.
- Verification passed: `npm run smoke`.
- Verification passed: `diff -qr skills/session-observer .agents/skills/session-observer`.
- Verification passed: `test -d ~/.agents/skills/session-observer`.
- Verification passed: `oat project validate-plan --project-path .oat/projects/shared/session-observer-watch`.
- Note: one full `npm test` run after the validation fix hit a transient watch-loop coalescing timing failure; focused `node --test tests/session-observer/watch.test.mjs` passed, and the subsequent full `npm test` passed.

---

## Phase 4: Final Review Fixes

**Status:** complete
**Started:** 2026-06-03
**Completed:** 2026-06-03

### Task p04-t01: (review) Fix `--runtime both` dropped watch updates

**Status:** completed
**Commit:** a7d5699

**Notes:**

- Fixed final code review finding I1 by skipping state-advancing baseline refresh for runtimes already tracked by a `--runtime both` watcher.
- Added regression coverage that appends to a tracked Claude transcript under `runtime: "both"` and asserts one JSON catch-up event.
- Verification passed: `node --test tests/session-observer/watch.test.mjs tests/session-observer/cli.test.mjs`.

---

### Task p04-t02: (review) Constrain watch event log writes

**Status:** completed
**Commit:** 6c3300e

**Notes:**

- Fixed final code review finding I2 by resolving relative `--event-log` paths inside the session-observer state directory and rejecting absolute or relative paths that escape it.
- Event logs remain metadata-only; watch reference documentation now records the constrained path semantics.
- Verification passed: `node --test tests/session-observer/watch.test.mjs tests/session-observer/cli.test.mjs`.

---

### Task p04-t03: (review) Update final implementation summary

**Status:** completed
**Commit:** 5c72e6c

**Notes:**

- Fixed final code review minor finding m1 by replacing final-summary placeholders with shipped behavior, key modules, verification, and design deltas.
- Verification passed: final-summary placeholder scan produced no matches.

---

## Phase 5: Final Review Fixes v2

**Status:** complete
**Started:** 2026-06-03
**Completed:** 2026-06-03

### Task p05-t01: (review) Align `--runtime both` With Documented Runtime Scope

**Status:** completed
**Commit:** 60bd05d

**Notes:**

- Fixed final code review v2 Medium finding M1 by making `--runtime both` expand to Claude Code plus Codex only.
- Added regression coverage proving a Cursor-only same-cwd transcript is not baselined, emitted, or marked read by `runtime: "both"`.
- Verification passed: `node --test tests/session-observer/watch.test.mjs tests/session-observer/cli.test.mjs` (46 tests).
- Verification passed: `npm test` (297 tests).
- Verification passed: `npm run validate`.
- Verification passed: `npm run smoke`.
- Verification passed: `oat project validate-plan --project-path .oat/projects/shared/session-observer-watch`.

---

## Phase 6: Final Review Fixes v3

**Status:** complete
**Started:** 2026-06-03
**Completed:** 2026-06-03

### Task p06-t01: (review) Prevent Stale Inactive Watch Control Directives

**Status:** completed
**Commit:** b46f127

**Notes:**

- Fixed final code review v3 Important finding I1 by loading active watch state before writing `pause`, `resume`, `flush`, or `stop` directives.
- Inactive `watch-ctl` operations now return the no-active-watcher payload, avoid writing a directive, and clear any stale `watch.control.json`.
- Added regressions for inactive control cleanup, active pause/resume/flush directive preservation, and `watch-ctl stop --json` not poisoning a subsequent watcher.
- Verification passed: `node --test tests/session-observer/cli.test.mjs tests/session-observer/watch.test.mjs` (48 tests).

---

### Task p06-t02: (review) Stabilize Debounce Coalescing Verification

**Status:** completed
**Commit:** 54ac0a4

**Notes:**

- Fixed final code review v3 Important finding I2 by replacing wall-clock sleeps in the coalescing regression with injected fake `now` and `sleep` hooks.
- The test now schedules both appends inside one deterministic unsettled burst before debounce settling, while still exercising the real file/stat/observe path.
- Verification passed: `node --test tests/session-observer/watch.test.mjs tests/session-observer/cli.test.mjs` (48 tests).
- Verification passed: `npm test` (299 tests).

---

### Task p06-t03: (review) Refresh OAT Repo Dashboard State

**Status:** completed
**Commit:** 125a838

**Notes:**

- Fixed final code review v3 minor finding m1 by refreshing tracked repo-level `.oat/state.md` after p06 code/test fixes.
- Updated project implementation/state bookkeeping to mark p06 complete and ready for checkpoint/final code review.
- Confirmed `.oat/state.md` is tracked with `git ls-files .oat/state.md`.
- Verification passed: `oat project status --json` reported 14/14 tasks complete and `currentTaskId: null`.
- Verification passed: `sed -n '1,80p' .oat/state.md` no longer reports plan-phase stale active-project state.

---

## Orchestration Runs

_Each run from `oat-project-implement` appends an entry below with run metadata, phase outcomes, parallel groups, and outstanding items._

<!-- orchestration-runs-start -->

_No orchestration runs yet._

<!-- orchestration-runs-end -->

---

## Implementation Log

### 2026-06-03

**Session Start:** 2026-06-03T02:17:35Z

- [x] p01-t01: Add Watch State Primitives - complete (`cd73202`)
- [x] p01-t02: Add Watch CLI Parsing And Help - complete (`13162eb`)
- [x] p02-t01: Extract Reusable Catch-Up Observation Pipeline - complete (`f889d32`)
- [x] p02-t02: Implement Polling, Debounce, And Event Log - complete (`393488d`)
- [x] p02-t03: Add Watch Control And Graceful Shutdown - complete (`15dd40f`)
- [x] p03-t01: Update Skill Instructions And Watch Reference - complete (`1f33657`, follow-up `e5505bf`)
- [x] p03-t02: Sync Dogfooding Install And Run Full Verification - complete (`d41a050`)
- [x] p04-t01: Fix `--runtime both` dropped watch updates - complete (`a7d5699`)
- [x] p04-t02: Constrain watch event log writes - complete (`6c3300e`)
- [x] p04-t03: Update final implementation summary - complete (`5c72e6c`)
- [x] p05-t01: Align `--runtime both` with documented runtime scope - complete (`60bd05d`)
- [x] p06-t01: Prevent stale inactive watch control directives - complete (`b46f127`)
- [x] p06-t02: Stabilize debounce coalescing verification - complete (`54ac0a4`)
- [x] p06-t03: Refresh OAT repo dashboard state - complete (`125a838`)

**What changed (high level):**

- Quick-start artifacts were created for adding watch mode to `session-observer`.
- Plan artifact review was received and resolved directly in `plan.md`.

**Decisions:**

- Use the existing watch-design reference as the basis for a foreground polling watcher with a `--watch` alias.
- Accepted the plan review's artifact-alignment fixes without adding implementation tasks.

**Follow-ups / TODO:**

- Rerun checkpoint/final code review for p06.

**Blockers:**

- None.

**Session End:** 2026-06-03T14:50:16Z

---

### Review Received: plan

**Date:** 2026-06-03
**Review artifact:** reviews/archived/artifact-plan-review-2026-06-02.md
**Review type:** artifact

**Findings:**

- Critical: 0
- Important: 0
- Medium: 2
- Minor: 3

**Actions taken:**

- M1: Resolved in `plan.md` by marking `spec` and `design` artifact review rows as `n/a` for quick mode.
- M2: Resolved in `plan.md` by adding a sanctioned fallback to defer `--runtime both` if singleton-state or test determinism becomes costly.
- m1: Resolved in `plan.md` by tightening the p03-t01 RED step around validation or an explicit `rg` assertion.
- m2: Resolved in `plan.md` by noting that artifact-state bookkeeping may be committed separately from skill sync.
- m3: Rejected with rationale. The implementation tracker is scaffolded as `in_progress` with `p01-t01` as the next task, but all task rows still show `pending`; this is acceptable restart state and does not imply partial implementation.

**New tasks added:** none; artifact review findings were resolved directly in the reviewed artifact.

**Next:** Continue implementation with `p02-t01`.

---

### Phase p01 Implementation Complete

**Completed:** 2026-06-03T14:21:45Z
**Next task:** p02-t01

**Verification:**

- Passed: `node --test tests/session-observer/watch-state.test.mjs tests/session-observer/state.test.mjs`
- Passed: `node --test tests/session-observer/cli.test.mjs`
- Passed: `node skills/session-observer/scripts/session-observer.mjs --help`

**Dispatch ceiling enforcement:**

- model_axis: inherited
- effort_axis: selected:xhigh
- dispatch_ceiling: xhigh
- ceiling_source: project-state
- provider_default_effort: xhigh
- dispatch_rationale: p01 includes lock-protected state persistence and CLI surface changes; maximum ceiling requested.

**Notes:**

- p01 scope is complete. The watch loop, event emission, control directives beyond `status`, and graceful shutdown remain scheduled for p02.

---

### Phase p02 Implementation Complete

**Completed:** 2026-06-03T14:39:08Z
**Next task:** p03-t01

**Verification:**

- Passed: `node --test tests/session-observer/observe.test.mjs tests/session-observer/cli.test.mjs`
- Passed: `node --test tests/session-observer/watch.test.mjs tests/session-observer/cli.test.mjs`
- Passed: `npm test -- tests/session-observer/watch.test.mjs tests/session-observer/cli.test.mjs`
- Passed: `node skills/session-observer/scripts/session-observer.mjs watch --runtime claude-code --cwd "$PWD" --poll-sec 1 --debounce-sec 1 --max-runtime-min 0.02 --json`
- Passed: `oat project validate-plan --project-path .oat/projects/shared/session-observer-watch`

**Dispatch ceiling enforcement:**

- model_axis: inherited
- effort_axis: selected:xhigh
- dispatch_ceiling: xhigh
- ceiling_source: project-state
- provider_default_effort: xhigh
- dispatch_rationale: p02 is the main integration phase: reusable catch-up pipeline, polling/debounce loop, event log, control directives, and shutdown behavior.

**Notes:**

- p02 scope is complete. Skill documentation, provider-view sync, user-level dogfooding install, and full-suite verification remain scheduled for p03.

---

### Phase p03 Implementation Complete

**Completed:** 2026-06-03T14:50:16Z
**Next task:** none

**Verification:**

- Passed: `npm run validate` after the p03-t01 docs update.
- Passed: `rg -n "not implemented|watch|watch-ctl|--watch" skills/session-observer .agents/skills/session-observer`.
- Passed: `diff -qr skills/session-observer .agents/skills/session-observer`.
- Passed: `test -d ~/.agents/skills/session-observer`.
- Passed: `if [ -e ~/.claude/skills/session-observer ]; then readlink ~/.claude/skills/session-observer || true; fi` -> `../../.agents/skills/session-observer`.
- Passed: `if [ -e ~/.cursor/skills/session-observer ]; then readlink ~/.cursor/skills/session-observer || true; fi` -> `../../.agents/skills/session-observer`.
- Passed: `oat sync --scope user` (no changes required after home install refresh).
- Passed: `npm test`.
- Passed: `npm run smoke`.
- Passed: `oat project validate-plan --project-path .oat/projects/shared/session-observer-watch`.

**Dispatch ceiling enforcement:**

- model_axis: inherited
- effort_axis: selected:xhigh
- dispatch_ceiling: xhigh
- ceiling_source: project-state
- provider_default_effort: xhigh
- dispatch_rationale: p03 updates user-facing skill instructions, validation, provider views, user-level dogfooding install, and runs full verification.

**Notes:**

- p03 scope is complete. All implementation-plan tasks are complete and the project is ready for code review.

---

### Phase p04 Implementation Complete

**Completed:** 2026-06-03T15:13:04Z
**Next task:** none

**Verification:**

- Passed: `node --test tests/session-observer/watch.test.mjs tests/session-observer/cli.test.mjs` (45 tests).
- Passed: `npm test` (296 tests).
- Passed: `npm run validate`.
- Passed: `npm run smoke`.
- Passed: `oat project validate-plan --project-path .oat/projects/shared/session-observer-watch`.
- Passed: final-summary placeholder scan produced no matches.

**Dispatch ceiling enforcement:**

- dispatch_ceiling: maximum / Codex xhigh
- ceiling_source: project-state

**Accepted design deltas:**

- Provider-hook automation remains deferred; watch mode provides automatic responses only while an active invocation consumes foreground watcher output.
- `--event-log` path semantics are constrained to the session-observer state directory.
- The single active watcher entry remains the implementation source of truth for watch/control state.

**Notes:**

- p04 scope is complete. The project is ready for checkpoint/final code review.

---

### Phase p05 Implementation Complete

**Completed:** 2026-06-03T15:28:58Z
**Next task:** none

**Verification:**

- Passed: `node --test tests/session-observer/watch.test.mjs tests/session-observer/cli.test.mjs` (46 tests).
- Passed: `npm test` (297 tests).
- Passed: `npm run validate`.
- Passed: `npm run smoke`.
- Passed: `oat project validate-plan --project-path .oat/projects/shared/session-observer-watch`.

**Dispatch ceiling enforcement:**

- dispatch_ceiling: maximum / Codex xhigh
- ceiling_source: project-state

**Accepted design deltas:**

- `--runtime both` follows the documented alias scope: Claude Code plus Codex only. Cursor remains supported through explicit `--runtime cursor` and `--runtime auto`, but is excluded from `both` watcher baseline/read-offset handling.

**Notes:**

- p05 scope is complete. The project is ready for checkpoint/final code review.

---

### Review Received: final

**Date:** 2026-06-03
**Review artifact:** reviews/archived/final-code-review-2026-06-03.md
**Review type:** code
**Review invocation:** auto

**Findings:**

- Critical: 0
- Important: 2
- Medium: 0
- Minor: 1

**New tasks added:** p04-t01, p04-t02, p04-t03

**Finding disposition map:**

- I1 -> converted to `p04-t01`: fix `--runtime both` dropped watch updates.
- I2 -> converted to `p04-t02`: constrain watch event-log writes to the session-observer state directory.
- m1 -> converted to `p04-t03`: replace final-summary placeholders.

**Next:** Execute final review fix tasks via `oat-project-implement` starting from `p04-t01`.

---

### Review Received: final v2

**Date:** 2026-06-03
**Review artifact:** reviews/archived/final-code-review-2026-06-03-v2.md
**Review type:** code
**Review invocation:** auto

**Findings:**

- Critical: 0
- Important: 0
- Medium: 1
- Minor: 0

**New tasks added:** p05-t01

**Finding disposition map:**

- M1 -> converted to `p05-t01`: align `--runtime both` with the documented Claude Code plus Codex runtime scope.

**Next:** Execute final review fix task via `oat-project-implement` starting from `p05-t01`.

---

### Review Received: final v3

**Date:** 2026-06-03
**Review artifact:** reviews/archived/final-code-review-2026-06-03-v3.md
**Review type:** code
**Review invocation:** auto

**Findings:**

- Critical: 0
- Important: 2
- Medium: 0
- Minor: 1

**New tasks added:** p06-t01, p06-t02, p06-t03

**Finding disposition map:**

- I1 -> converted to `p06-t01`: prevent inactive `watch-ctl` commands from leaving stale control directives.
- I2 -> converted to `p06-t02`: make debounce coalescing verification deterministic.
- m1 -> converted to `p06-t03`: refresh the tracked repo-level OAT dashboard state.

**Next:** Execute final review fix tasks via `oat-project-implement` starting from `p06-t01`.

---

### Phase p06 Implementation Complete

**Completed:** 2026-06-03T15:52:54Z
**Next task:** none

**Verification:**

- Passed: `node --test tests/session-observer/cli.test.mjs tests/session-observer/watch.test.mjs` (48 tests).
- Passed: `node --test tests/session-observer/watch.test.mjs tests/session-observer/cli.test.mjs` (48 tests).
- Passed: `npm test` (299 tests).

**Dispatch ceiling enforcement:**

- dispatch_ceiling: maximum / Codex xhigh
- ceiling_source: project-state

**Accepted design deltas:**

- None added in p06. Inactive control commands now follow the existing no-active-watcher contract instead of writing inert directives.

**Notes:**

- p06 scope is complete. The project is ready for checkpoint/final code review.

---

## Deviations from Plan

| Task | Planned | Actual | Reason |
| ---- | ------- | ------ | ------ |
| - | - | - | - |

## Test Results

| Phase | Tests Run | Passed | Failed | Coverage |
| ----- | --------- | ------ | ------ | -------- |
| p01 | `node --test tests/session-observer/watch-state.test.mjs tests/session-observer/state.test.mjs` | 19 | 0 | watch state primitives and session state watcher metadata |
| p01 | `node --test tests/session-observer/cli.test.mjs` | 32 | 0 | watch CLI surface and existing CLI behavior |
| p01 | `node skills/session-observer/scripts/session-observer.mjs --help` | 1 | 0 | top-level help surface |
| p02 | `node --test tests/session-observer/observe.test.mjs tests/session-observer/cli.test.mjs` | 40 | 0 | reusable observe pipeline and CLI behavior |
| p02 | `node --test tests/session-observer/watch.test.mjs tests/session-observer/cli.test.mjs` | 43 | 0 | watch loop, control directives, shutdown, and CLI behavior |
| p02 | `npm test -- tests/session-observer/watch.test.mjs tests/session-observer/cli.test.mjs` | 43 | 0 | npm-targeted watch and CLI tests |
| p02 | `node skills/session-observer/scripts/session-observer.mjs watch --runtime claude-code --cwd "$PWD" --poll-sec 1 --debounce-sec 1 --max-runtime-min 0.02 --json` | 1 | 0 | bounded watch smoke, no events emitted |
| p02 | `oat project validate-plan --project-path .oat/projects/shared/session-observer-watch` | 1 | 0 | plan structure validation |
| p04 | `node --test tests/session-observer/watch.test.mjs tests/session-observer/cli.test.mjs` | 45 | 0 | final review fixes for both-runtime watch updates, event-log path safety, and CLI regression coverage |
| p04 | `npm test` | 296 | 0 | full repository test suite |
| p04 | `npm run validate` | 1 | 0 | repository structure, manifest, and docs invariants |
| p04 | `npm run smoke` | 1 | 0 | mocked end-to-end consensus wrapper flow |
| p04 | `oat project validate-plan --project-path .oat/projects/shared/session-observer-watch` | 1 | 0 | plan structure validation |
| p04 | final-summary placeholder scan | 1 | 0 | no final-summary placeholders remain |
| p05 | `node --test tests/session-observer/watch.test.mjs tests/session-observer/cli.test.mjs` | 46 | 0 | final review v2 runtime-both scope regression and CLI coverage |
| p05 | `npm test` | 297 | 0 | full repository test suite |
| p05 | `npm run validate` | 1 | 0 | repository structure, manifest, and docs invariants |
| p05 | `npm run smoke` | 1 | 0 | mocked end-to-end consensus wrapper flow |
| p05 | `oat project validate-plan --project-path .oat/projects/shared/session-observer-watch` | 1 | 0 | plan structure validation |
| p06 | `node --test tests/session-observer/cli.test.mjs tests/session-observer/watch.test.mjs` | 48 | 0 | inactive watch-control cleanup, subsequent watcher regression, and CLI coverage |
| p06 | `node --test tests/session-observer/watch.test.mjs tests/session-observer/cli.test.mjs` | 48 | 0 | deterministic debounce coalescing and watch/CLI coverage |
| p06 | `npm test` | 299 | 0 | full repository test suite with deterministic coalescing regression |

## Final Summary (for PR/docs)

**What shipped:**

- `session-observer watch` and top-level `--watch` now run a foreground polling watcher around the existing locate/rank/digest/state catch-up pipeline.
- `session-observer watch-ctl` manages active watchers with `status`, `pause`, `resume`, `flush`, and `stop`.
- Final review fixes preserve debounced updates in `--runtime both` mode, constrain `--event-log` writes to the session-observer state directory, prevent inactive control directives from leaking into later watchers, and stabilize debounce coalescing verification.

**Behavioral changes (user-facing):**

- Watch mode establishes an initial baseline without re-emitting old transcript content, then emits one catch-up digest per settled update burst.
- `--json` emits newline-delimited catch-up event objects to stdout; `--event-log` mirrors metadata-only JSONL records with no message content.
- Relative event-log paths resolve under `~/.local/state/session-observer/`; absolute or relative paths that escape that directory are rejected.
- Watch control directives can pause/resume output, flush pending debounced updates, stop the watcher, and report active watcher state.
- Inactive `watch-ctl pause`, `resume`, `flush`, and `stop` return a no-active-watcher payload and clear stale control files instead of writing directives.
- Manual `catch-up` warns when a watcher owns the same session offset but still succeeds.
- `--runtime both` watches Claude Code plus Codex only; Cursor transcripts require `--runtime cursor` or `--runtime auto` and are not baselined by the `both` watcher.

**Key files / modules:**

- `skills/session-observer/scripts/session-observer.mjs`: watch/watch-ctl CLI parsing, help, dispatch, and manual catch-up watcher warning.
- `skills/session-observer/scripts/lib/watch-state.mjs`: lock-protected watcher/control state under the session-observer state directory.
- `skills/session-observer/scripts/lib/observe.mjs`: reusable catch-up observation pipeline for one-shot and watch flows.
- `skills/session-observer/scripts/lib/watch.mjs`: polling, debounce, event rendering, event-log path safety, control handling, and shutdown cleanup.
- `skills/session-observer/SKILL.md` and `skills/session-observer/references/watch-design.md`: operator guidance, implemented watch contract, safety rules, and deferred provider-hook boundary.
- `tests/session-observer/watch-state.test.mjs`, `tests/session-observer/observe.test.mjs`, `tests/session-observer/watch.test.mjs`, and `tests/session-observer/cli.test.mjs`: state, pipeline, watcher, control, event-log, and CLI coverage.

**Verification performed:**

- Targeted Node tests covered watch state helpers, observe pipeline behavior, CLI watch/watch-ctl behavior, polling/debounce emission, deterministic debounce coalescing, `--runtime both` regression coverage, metadata-only event logs, event-log path rejection, inactive control cleanup, active control directives, and signal cleanup.
- Full implementation verification included `npm test`, `npm run validate`, `npm run smoke`, and `oat project validate-plan --project-path .oat/projects/shared/session-observer-watch`.
- Dogfooding verification confirmed the repo skill view matched the canonical skill, the user-level `~/.agents/skills/session-observer` install existed, provider symlinks resolved through the canonical copy when present, and `oat sync --scope user` succeeded.

**Design deltas (if any):**

- Provider-hook automation remains deferred. Automatic responses are available only while an active agent invocation keeps the foreground watch process running and consumes stdout.
- Watch state uses one global active watcher entry, which is stricter than duplicate-only singleton wording but matches the single `watch.json` / `watch.control.json` control-file model.
- `--event-log` path semantics are intentionally constrained: callers may choose filenames/subdirectories only within the session-observer state directory.
- `--runtime both` intentionally excludes Cursor to match the shipped operator contract.

## References

- Plan: `plan.md`
- Discovery: `discovery.md`
