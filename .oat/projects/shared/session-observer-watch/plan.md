---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-06-03
oat_phase: plan
oat_phase_status: complete
oat_plan_hill_phases: ["p03"]
oat_plan_parallel_groups: []
oat_plan_source: quick
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
---

# Implementation Plan: session-observer-watch

> Execute this plan using `oat-project-implement`.

**Goal:** Add watch mode to `session-observer` so an active agent invocation can keep monitoring a peer transcript and respond to debounced catch-up updates without repeated user prompts.

**Architecture:** Add a small watch layer around the existing locate/rank/digest/state pipeline. The watcher polls transcript candidates, debounces settled changes, emits catch-up digests to stdout, and stores watcher/control metadata under `~/.local/state/session-observer/`.

**Tech Stack:** Node.js >=22, Node standard library APIs, `node --test`, existing session-observer modules.

**Commit Convention:** `feat(pNN-tNN): description` for behavior changes, `test(pNN-tNN): description` for test-only commits, and `chore(pNN-tNN): description` for docs/sync bookkeeping.

## Planning Checklist

- [x] Confirmed HiLL checkpoints with user: quick mode uses no extra checkpoints.
- [x] Set `oat_plan_hill_phases` in frontmatter: `[]`.
- [x] Evaluated phases for parallelism opportunities.
- [x] Set `oat_plan_parallel_groups` in frontmatter: `[]`.

## Parallelism

This plan is intentionally sequential. The phases all touch the same CLI entrypoint, session-observer state contract, and skill documentation, and the later phases depend on the command surface and helper APIs created earlier. Running phases in parallel would create overlapping edits in `skills/session-observer/scripts/session-observer.mjs`, `.agents/skills/session-observer/SKILL.md`, and the shared test files, with little schedule benefit.

## Phase 1: Watch State And CLI Surface

### Task p01-t01: Add Watch State Primitives

**Files:**

- Create: `skills/session-observer/scripts/lib/watch-state.mjs`
- Create: `tests/session-observer/watch-state.test.mjs`
- Modify: `skills/session-observer/scripts/lib/state.mjs`
- Modify: `tests/session-observer/state.test.mjs`

**Step 1: Write test (RED)**

Add tests that use temporary `STATE_DIR` values and assert:

- `watch-state` writes `watch.json` atomically with pid, runtime, cwd, startedAt, lastEventAt, and eventCount fields.
- starting a second watcher for the same runtime/cwd refuses when the existing pid is live.
- stale pids are cleared automatically when `kill(pid, 0)` reports `ESRCH`.
- control directives are written to and read from `watch.control.json`.
- session state can set and clear `watchedByPid` without changing read offsets.

Run: `node --test tests/session-observer/watch-state.test.mjs tests/session-observer/state.test.mjs`

Expected: New tests fail because the helpers do not exist yet.

**Step 2: Implement (GREEN)**

Create `watch-state.mjs` using Node standard library APIs and the same lock/temp/rename approach as `state.mjs`. Add narrowly scoped session helpers in `state.mjs` for setting and clearing `watchedByPid` on a runtime/session entry.

Run: `node --test tests/session-observer/watch-state.test.mjs tests/session-observer/state.test.mjs`

Expected: Tests pass.

**Step 3: Refactor**

Keep duplicated lock/atomic-write logic small. If the implementation starts copying too much from `state.mjs`, extract only a local helper inside `watch-state.mjs`; do not introduce a broad persistence abstraction unless the code clearly needs it.

**Step 4: Verify**

Run: `npm test -- tests/session-observer/watch-state.test.mjs tests/session-observer/state.test.mjs`

Expected: Targeted tests pass under the repo test runner.

**Step 5: Commit**

```bash
git add skills/session-observer/scripts/lib/watch-state.mjs \
  skills/session-observer/scripts/lib/state.mjs \
  tests/session-observer/watch-state.test.mjs \
  tests/session-observer/state.test.mjs
git commit -m "feat(p01-t01): add session observer watch state primitives"
```

---

### Task p01-t02: Add Watch CLI Parsing And Help

**Files:**

- Modify: `skills/session-observer/scripts/session-observer.mjs`
- Modify: `tests/session-observer/cli.test.mjs`

**Step 1: Write test (RED)**

Add CLI tests that assert:

- `--help` lists `watch`, `watch-ctl`, and `--watch`.
- `session-observer watch --help` exits 0 and lists `--debounce-sec`, `--poll-sec`, `--max-runtime-min`, `--event-log`, and `--runtime <claude-code|codex|cursor|auto|both>`.
- `session-observer --watch --help` maps to the same watch help.
- `watch-ctl status --json` returns a parseable no-active-watcher payload when no watcher is active.

If `--runtime both` makes singleton-state handling or deterministic tests materially harder, it may be deferred in favor of `auto`-only watch mode for this iteration. Record that deviation in `implementation.md` rather than treating it as a plan failure.

Run: `node --test tests/session-observer/cli.test.mjs`

Expected: Tests fail because the CLI does not recognize watch mode.

**Step 2: Implement (GREEN)**

Extend argument parsing with:

- canonical subcommand: `watch`
- alias: top-level `--watch` with no subcommand maps to `watch`
- control subcommand: `watch-ctl`
- watch flags: `--debounce-sec`, `--poll-sec`, `--max-runtime-min`, `--event-log`
- runtime validation that accepts `both` only for watch mode

For this task, the watch runner may print help/status only; the polling loop is implemented later.

Run: `node --test tests/session-observer/cli.test.mjs`

Expected: New help/status tests pass and existing dispatch tests still pass.

**Step 3: Refactor**

Keep CLI parsing readable. Avoid spreading watch-only validation into the one-shot command paths.

**Step 4: Verify**

Run: `node skills/session-observer/scripts/session-observer.mjs --help`

Expected: Help includes the new watch surface without changing existing commands.

**Step 5: Commit**

```bash
git add skills/session-observer/scripts/session-observer.mjs tests/session-observer/cli.test.mjs
git commit -m "feat(p01-t02): add session observer watch cli surface"
```

---

## Phase 2: Watch Loop And Event Emission

### Task p02-t01: Extract Reusable Catch-Up Observation Pipeline

**Files:**

- Create: `skills/session-observer/scripts/lib/observe.mjs`
- Create: `tests/session-observer/observe.test.mjs`
- Modify: `skills/session-observer/scripts/session-observer.mjs`
- Modify: `tests/session-observer/cli.test.mjs`

**Step 1: Write test (RED)**

Add `observe.test.mjs` coverage for a reusable function that:

- resolves runtime/session candidates using the same auto, pinned-session, snippet, locate, and rank rules as `catch-up`.
- builds a catch-up digest from the correct prior offset.
- marks the high-water offset only when the digest consumed new records or state differs.
- returns exit-style outcomes for no-match, ties, and ambiguous runtime without directly calling `process.exit`.

Run: `node --test tests/session-observer/observe.test.mjs tests/session-observer/cli.test.mjs`

Expected: Tests fail because `observe.mjs` does not exist and the CLI still owns the pipeline inline.

**Step 2: Implement (GREEN)**

Move the reusable parts of `runCatchUp` into `observe.mjs`, keeping output formatting in the CLI. Update `runCatchUp` to call this helper so behavior remains unchanged before watch mode uses it.

Run: `node --test tests/session-observer/observe.test.mjs tests/session-observer/cli.test.mjs`

Expected: Tests pass and existing `catch-up` behavior is unchanged.

**Step 3: Refactor**

Keep `runReview` untouched unless necessary. The watch loop only needs catch-up semantics.

**Step 4: Verify**

Run: `npm test -- tests/session-observer/observe.test.mjs tests/session-observer/cli.test.mjs`

Expected: Targeted tests pass.

**Step 5: Commit**

```bash
git add skills/session-observer/scripts/lib/observe.mjs \
  skills/session-observer/scripts/session-observer.mjs \
  tests/session-observer/observe.test.mjs \
  tests/session-observer/cli.test.mjs
git commit -m "feat(p02-t01): extract session observer catch-up pipeline"
```

---

### Task p02-t02: Implement Polling, Debounce, And Event Log

**Files:**

- Create: `skills/session-observer/scripts/lib/watch.mjs`
- Create: `tests/session-observer/watch.test.mjs`
- Modify: `skills/session-observer/scripts/session-observer.mjs`

**Step 1: Write test (RED)**

Add tests with temporary transcript fixtures and short intervals that assert:

- `watch` performs an initial session identification without emitting old content unless a new settled change appears.
- appending multiple records inside the debounce window emits one catch-up digest after the file is quiet.
- `--json` writes newline-delimited event JSON to stdout.
- `--event-log <path>` writes metadata-only JSONL records with `ts`, `runtime`, `sessionId`, `newRecords`, `digestChars`, and range metadata, but no message content.
- `--max-runtime-min` exits cleanly in bounded tests.

Run: `node --test tests/session-observer/watch.test.mjs`

Expected: Tests fail because the watch loop does not exist yet.

**Step 2: Implement (GREEN)**

Create `watch.mjs` with a testable polling loop that accepts injected timers for tests. Use `discover`/`rank` to identify candidates, `stat` mtimes and sizes for change detection, debounce settled changes, call the reusable observe pipeline, and emit rendered markdown or JSON-line events. Mirror metadata-only events to `--event-log` when requested.

Run: `node --test tests/session-observer/watch.test.mjs`

Expected: Watch loop tests pass.

**Step 3: Refactor**

Keep event rendering separate from polling state so future provider-hook integration can reuse the event stream without rewriting debounce logic.

**Step 4: Verify**

Run: `node skills/session-observer/scripts/session-observer.mjs watch --runtime claude-code --cwd "$PWD" --poll-sec 1 --debounce-sec 1 --max-runtime-min 0.02 --json`

Expected: Command exits cleanly after the bounded runtime and prints either no events or valid JSON-line events.

**Step 5: Commit**

```bash
git add skills/session-observer/scripts/lib/watch.mjs \
  skills/session-observer/scripts/session-observer.mjs \
  tests/session-observer/watch.test.mjs
git commit -m "feat(p02-t02): implement session observer watch loop"
```

---

### Task p02-t03: Add Watch Control And Graceful Shutdown

**Files:**

- Modify: `skills/session-observer/scripts/lib/watch.mjs`
- Modify: `skills/session-observer/scripts/lib/watch-state.mjs`
- Modify: `skills/session-observer/scripts/session-observer.mjs`
- Modify: `tests/session-observer/watch.test.mjs`
- Modify: `tests/session-observer/cli.test.mjs`

**Step 1: Write test (RED)**

Add tests that assert:

- `watch-ctl pause` prevents event emission while polling continues.
- `watch-ctl resume` re-enables event emission.
- `watch-ctl flush` emits any pending debounced update immediately.
- `watch-ctl stop` causes the watcher to exit and clears `watch.json`.
- SIGINT/SIGTERM cleanup clears active watch metadata and removes stale control directives.
- manual `catch-up` warns when `watchedByPid` is present but still succeeds.

Run: `node --test tests/session-observer/watch.test.mjs tests/session-observer/cli.test.mjs`

Expected: Tests fail until control handling is implemented.

**Step 2: Implement (GREEN)**

Read and apply `watch.control.json` on each poll tick, delete directives after applying them, update watch metadata after each event, and register signal handlers that finish in-flight event emission before clearing watch state. Add the catch-up warning when a watched session is read manually.

Run: `node --test tests/session-observer/watch.test.mjs tests/session-observer/cli.test.mjs`

Expected: Control and shutdown tests pass.

**Step 3: Refactor**

Ensure stop behavior is deterministic and does not leave child processes or temp files in tests.

**Step 4: Verify**

Run: `npm test -- tests/session-observer/watch.test.mjs tests/session-observer/cli.test.mjs`

Expected: Targeted tests pass.

**Step 5: Commit**

```bash
git add skills/session-observer/scripts/lib/watch.mjs \
  skills/session-observer/scripts/lib/watch-state.mjs \
  skills/session-observer/scripts/session-observer.mjs \
  tests/session-observer/watch.test.mjs \
  tests/session-observer/cli.test.mjs
git commit -m "feat(p02-t03): add session observer watch controls"
```

---

## Phase 3: Skill Documentation And Dogfooding Sync

### Task p03-t01: Update Skill Instructions And Watch Reference

**Files:**

- Modify: `skills/session-observer/SKILL.md`
- Modify: `skills/session-observer/references/watch-design.md`
- Modify: `.agents/skills/session-observer/SKILL.md`
- Modify: `.agents/skills/session-observer/references/watch-design.md`
- Modify: `scripts/validate.mjs` if a docs invariant is needed to catch stale watch-mode claims

**Step 1: Write test (RED)**

Add or update validation expectations so docs fail if the skill still says watch mode is unimplemented or omits the watch command surface. If no existing validation invariant catches this stale wording, add a concrete `scripts/validate.mjs` check or an explicit `rg`-based assertion that fails on the current "not implemented" text before updating the docs. If an existing invariant already catches it, keep `scripts/validate.mjs` untouched and document that in the task notes.

Run: `npm run validate`

Expected: Validation fails until docs are updated, or the test addition fails first if validation does not yet check this invariant.

**Step 2: Implement (GREEN)**

Update skill instructions to:

- include `watch`, `watch-ctl`, and `--watch` in the argument hint and subcommand table.
- describe when to use watch mode.
- replace the "not implemented in v1" warning with operator guidance for active watch sessions.
- tell agents to keep the watch process running, poll output, and respond to each emitted digest until the user stops watching or the process exits.
- document the automatic-response boundary: active invocation only; provider hooks are deferred.
- update `references/watch-design.md` from design-only status to implemented behavior plus deferred hook notes.

Run: `npm run validate`

Expected: Validation passes.

**Step 3: Refactor**

Keep root `SKILL.md` concise and leave detailed watch internals in the reference document.

**Step 4: Verify**

Run: `rg -n "not implemented|watch|watch-ctl|--watch" skills/session-observer .agents/skills/session-observer`

Expected: No stale "watch is not implemented" claims remain; watch usage is documented in both canonical repo and `.agents` views.

**Step 5: Commit**

```bash
git add skills/session-observer/SKILL.md \
  skills/session-observer/references/watch-design.md \
  .agents/skills/session-observer/SKILL.md \
  .agents/skills/session-observer/references/watch-design.md
git commit -m "docs(p03-t01): document session observer watch mode"
```

---

### Task p03-t02: Sync Dogfooding Install And Run Full Verification

**Files:**

- Modify: `.agents/skills/session-observer/scripts/session-observer.mjs`
- Modify: `.agents/skills/session-observer/scripts/lib/state.mjs`
- Create: `.agents/skills/session-observer/scripts/lib/watch-state.mjs`
- Create: `.agents/skills/session-observer/scripts/lib/observe.mjs`
- Create: `.agents/skills/session-observer/scripts/lib/watch.mjs`
- Review/update: any `.agents/skills/session-observer/` files changed in prior phases
- Non-git sync target: `~/.agents/skills/session-observer`

**Step 1: Write test (RED)**

Before syncing, compare `skills/session-observer` and `.agents/skills/session-observer` enough to show the provider view is stale.

Run: `diff -qr skills/session-observer .agents/skills/session-observer`

Expected: Diff reports the files added or modified by prior tasks.

**Step 2: Implement (GREEN)**

Refresh `.agents/skills/session-observer` from `skills/session-observer`. Then refresh the canonical user-level install at `~/.agents/skills/session-observer`, verify provider-specific entries such as `~/.claude/skills/session-observer` and `~/.cursor/skills/session-observer` resolve to the canonical copy when present, and run `oat sync --scope user`.

Run:

```bash
diff -qr skills/session-observer .agents/skills/session-observer
test -d ~/.agents/skills/session-observer
if [ -e ~/.claude/skills/session-observer ]; then readlink ~/.claude/skills/session-observer || true; fi
if [ -e ~/.cursor/skills/session-observer ]; then readlink ~/.cursor/skills/session-observer || true; fi
oat sync --scope user
```

Expected: Repo skill views are in sync, canonical user skill exists, provider entries resolve as expected when present, and user sync succeeds.

**Step 3: Refactor**

Do not commit home-directory files. Commit only repo files and OAT artifact bookkeeping.

Artifact-state updates may be committed separately from the `.agents` skill sync when that makes the history clearer. Keep each commit scoped and make sure the OAT tracker remains accurate before closeout.

**Step 4: Verify**

Run:

```bash
npm test
npm run validate
npm run smoke
```

Expected: Full test, validation, and smoke suites pass.

**Step 5: Commit**

```bash
git add .agents/skills/session-observer \
  .oat/projects/shared/session-observer-watch/implementation.md \
  .oat/projects/shared/session-observer-watch/plan.md \
  .oat/projects/shared/session-observer-watch/state.md \
  .oat/state.md
git commit -m "chore(p03-t02): sync session observer watch skill views"
```

---

## Reviews

| Scope | Type | Status | Date | Artifact |
| ----- | ---- | ------ | ---- | -------- |
| p01 | code | pending | - | - |
| p02 | code | pending | - | - |
| p03 | code | pending | - | - |
| final | code | pending | - | - |
| spec | artifact | n/a | - | quick mode has no spec.md |
| design | artifact | n/a | - | quick mode has no design.md |
| plan | artifact | passed | 2026-06-03 | reviews/archived/artifact-plan-review-2026-06-02.md |

**Status values:** `pending` -> `received` -> `fixes_added` -> `fixes_completed` -> `passed`

## Implementation Complete

**Summary:**

- Phase 1: 2 tasks - Watch state primitives and CLI command surface.
- Phase 2: 3 tasks - Reusable catch-up pipeline, polling/debounce event emission, and control/shutdown behavior.
- Phase 3: 2 tasks - Skill docs, provider-view sync, user-level dogfooding install, and full verification.

**Total: 7 tasks**

Ready for `oat-project-implement`.

## References

- Discovery: `discovery.md`
- Existing watch reference: `skills/session-observer/references/watch-design.md`
- Skill instructions: `skills/session-observer/SKILL.md`
- CLI entrypoint: `skills/session-observer/scripts/session-observer.mjs`
- Existing state module: `skills/session-observer/scripts/lib/state.mjs`
- Existing digest module: `skills/session-observer/scripts/lib/digest.mjs`
- Existing tests: `tests/session-observer/`
