---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-06-03
oat_phase: plan
oat_phase_status: complete
oat_plan_hill_phases: ["p07"]
oat_auto_review_at_hill_checkpoints: true
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

## Phase 4: Final Review Fixes

### Task p04-t01: (review) Fix `--runtime both` dropped watch updates

**Files:**

- Modify: `skills/session-observer/scripts/lib/watch.mjs`
- Modify: `tests/session-observer/watch.test.mjs`

**Step 1: Understand the issue**

Review finding: `--runtime both` re-establishes baselines every tick. Baseline establishment calls the state-advancing catch-up pipeline before checking whether a target is already tracked, so appended records can be marked read before the debounce emitter runs.
Location: `skills/session-observer/scripts/lib/watch.mjs:281`

**Step 2: Implement fix**

Avoid running the state-advancing catch-up pipeline for already tracked targets in `both` mode. Split target discovery/baseline refresh from catch-up emission or check known targets before any call that advances offsets.

**Step 3: Verify**

Run: `node --test tests/session-observer/watch.test.mjs tests/session-observer/cli.test.mjs`
Expected: Tests pass, including a regression that appends to a tracked transcript under `runtime: "both"` and observes one emitted digest/event.

**Step 4: Commit**

```bash
git add skills/session-observer/scripts/lib/watch.mjs tests/session-observer/watch.test.mjs
git commit -m "fix(p04-t01): preserve both-runtime watch updates"
```

---

### Task p04-t02: (review) Constrain watch event log writes

**Files:**

- Modify: `skills/session-observer/scripts/lib/watch.mjs`
- Modify: `tests/session-observer/watch.test.mjs`
- Modify: `skills/session-observer/references/watch-design.md` only if the implementation requires clarifying path semantics

**Step 1: Understand the issue**

Review finding: `--event-log` currently accepts arbitrary paths and creates parent directories, but discovery and watch docs declare watch-mode writes are limited to `~/.local/state/session-observer/`.
Location: `skills/session-observer/scripts/lib/watch.mjs:88`

**Step 2: Implement fix**

Resolve relative `--event-log` paths inside the session-observer state directory and reject absolute or relative paths that escape that directory. Keep event logs metadata-only. If path semantics need documentation, update the watch reference without broadening the safety boundary.

**Step 3: Verify**

Run: `node --test tests/session-observer/watch.test.mjs tests/session-observer/cli.test.mjs`
Expected: Tests pass, including rejection/normalization coverage for event-log paths that would escape the state directory.

**Step 4: Commit**

```bash
git add skills/session-observer/scripts/lib/watch.mjs tests/session-observer/watch.test.mjs skills/session-observer/references/watch-design.md
git commit -m "fix(p04-t02): constrain session observer event logs"
```

---

### Task p04-t03: (review) Update final implementation summary

**Files:**

- Modify: `.oat/projects/shared/session-observer-watch/implementation.md`

**Step 1: Understand the issue**

Review finding: `implementation.md` marks all implementation phases complete, but `## Final Summary (for PR/docs)` still contains `Pending implementation` placeholders.
Location: `.oat/projects/shared/session-observer-watch/implementation.md:340`

**Step 2: Implement fix**

Replace the placeholder final summary with shipped watch behavior, user-facing changes, key modules, verification performed, and design deltas.

**Step 3: Verify**

Run: `rg -n "Pending implementation" .oat/projects/shared/session-observer-watch/implementation.md`
Expected: No matches.

**Step 4: Commit**

```bash
git add .oat/projects/shared/session-observer-watch/implementation.md
git commit -m "fix(p04-t03): update session observer final summary"
```

---

## Phase 5: Final Review Fixes v2

### Task p05-t01: (review) Align `--runtime both` With Documented Runtime Scope

**Files:**

- Modify: `skills/session-observer/scripts/lib/watch.mjs`
- Modify: `tests/session-observer/watch.test.mjs`
- Modify: `skills/session-observer/references/watch-design.md` only if the code change requires clarifying wording
- Modify: `skills/session-observer/SKILL.md` only if the code change requires clarifying wording
- Modify: `.oat/projects/shared/session-observer-watch/implementation.md`

**Step 1: Understand the issue**

Review finding: `--runtime both` currently expands to every runtime in `VALID_RUNTIMES`, including Cursor, but the shipped operator docs define `both` as Claude Code plus Codex. Because baseline establishment advances read offsets, a Cursor-only same-cwd transcript can be marked read even though the documented `both` scope does not include Cursor.
Location: `skills/session-observer/scripts/lib/watch.mjs:37`

**Step 2: Implement fix**

Keep the documented contract: `both` means Claude Code plus Codex. Change `watchRuntimes("both")` so it returns only those two runtimes, and add regression coverage proving a Cursor-only same-cwd transcript is not baselined or marked read by `runtime: "both"`.

**Step 3: Verify**

Run: `node --test tests/session-observer/watch.test.mjs tests/session-observer/cli.test.mjs`
Expected: Tests pass, including the Cursor-only same-cwd regression for `runtime: "both"`.

Run: `npm test`
Expected: Full test suite passes.

**Step 4: Commit**

```bash
git add skills/session-observer/scripts/lib/watch.mjs \
  tests/session-observer/watch.test.mjs \
  skills/session-observer/references/watch-design.md \
  skills/session-observer/SKILL.md \
  .oat/projects/shared/session-observer-watch/implementation.md
git commit -m "fix(p05-t01): limit both watch runtime scope"
```

---

## Phase 6: Final Review Fixes v3

### Task p06-t01: (review) Prevent Stale Inactive Watch Control Directives

**Files:**

- Modify: `skills/session-observer/scripts/session-observer.mjs`
- Modify: `tests/session-observer/cli.test.mjs`
- Modify: `tests/session-observer/watch.test.mjs` only if an end-to-end watcher regression belongs there

**Step 1: Understand the issue**

Review finding: `watch-ctl pause`, `resume`, `flush`, and `stop` can write `watch.control.json` when no watcher is active. With no process to consume the directive, the next watcher can pause, flush, or stop immediately from stale control state.
Location: `skills/session-observer/scripts/session-observer.mjs:849`

**Step 2: Implement fix**

Load active watch state before writing any control directive. If there is no active watcher, return the existing no-active-watcher style payload and do not write a directive; also clear any stale control directive in that branch. Preserve active-watcher behavior for pause, resume, flush, and stop.

**Step 3: Verify**

Run: `node --test tests/session-observer/cli.test.mjs tests/session-observer/watch.test.mjs`
Expected: Tests pass, including a regression that `watch-ctl stop --json` with no active watcher leaves no `watch.control.json` and a subsequent watcher runs normally.

**Step 4: Commit**

```bash
git add skills/session-observer/scripts/session-observer.mjs \
  tests/session-observer/cli.test.mjs \
  tests/session-observer/watch.test.mjs
git commit -m "fix(p06-t01): ignore inactive watch control directives"
```

---

### Task p06-t02: (review) Stabilize Debounce Coalescing Verification

**Files:**

- Modify: `tests/session-observer/watch.test.mjs`
- Modify: `skills/session-observer/scripts/lib/watch.mjs` only if additional test hooks are needed

**Step 1: Understand the issue**

Review finding: the full `npm test` gate observed a flaky failure in `coalesces appended records inside the debounce window into one markdown event`, with `eventCount` reported as `2` before a rerun passed. The implementation tracker also records an earlier transient coalescing failure.
Location: `tests/session-observer/watch.test.mjs:147`

**Step 2: Implement fix**

Make the debounce/coalescing test deterministic. Prefer injected fake `now`, `sleep`, and `stat` hooks if practical; otherwise widen/control the wall-clock setup so both appends are guaranteed to be observed as one unsettled burst before the debounce can fire.

**Step 3: Verify**

Run: `node --test tests/session-observer/watch.test.mjs tests/session-observer/cli.test.mjs`
Expected: Tests pass reliably.

Run: `npm test`
Expected: Full test suite passes.

**Step 4: Commit**

```bash
git add tests/session-observer/watch.test.mjs skills/session-observer/scripts/lib/watch.mjs
git commit -m "test(p06-t02): stabilize watch debounce coalescing"
```

---

### Task p06-t03: (review) Refresh OAT Repo Dashboard State

**Files:**

- Modify: `.oat/state.md`
- Modify: `.oat/projects/shared/session-observer-watch/implementation.md`
- Modify: `.oat/projects/shared/session-observer-watch/state.md`

**Step 1: Understand the issue**

Review finding: the project-specific state says implementation is complete and ready for final review, but the repo-level `.oat/state.md` dashboard still reports the active project as plan-phase work.
Location: `.oat/state.md:19`

**Step 2: Implement fix**

Run `oat state refresh` after p06 code/test fixes and update project bookkeeping. `.oat/state.md` is tracked in this repository; stage it only if `git ls-files .oat/state.md` confirms it remains tracked.

**Step 3: Verify**

Run: `oat project status --json`
Expected: Active project status reflects p06 complete and ready for final review.

Run: `sed -n '1,80p' .oat/state.md`
Expected: Repo dashboard no longer reports the active project as plan-phase work.

**Step 4: Commit**

```bash
git add .oat/projects/shared/session-observer-watch/implementation.md \
  .oat/projects/shared/session-observer-watch/state.md
if git ls-files --error-unmatch .oat/state.md >/dev/null 2>&1; then git add .oat/state.md; fi
git commit -m "chore(p06-t03): refresh oat dashboard state"
```

---

## Phase 7: Final Review Fixes v4

### Task p07-t01: (review) Harden Event Log File Safety

**Files:**

- Modify: `skills/session-observer/scripts/lib/watch.mjs`
- Modify: `tests/session-observer/watch.test.mjs`
- Modify: `skills/session-observer/references/watch-design.md` only if path semantics need clarification
- Modify: `skills/session-observer/SKILL.md` only if operator-facing path semantics need clarification

**Step 1: Understand the issue**

Review finding: `--event-log` uses a lexical containment check and then appends to the chosen path. An in-state symlink can point outside the session-observer state directory, and reserved state filenames such as `state.json`, `watch.json`, and `watch.control.json` can corrupt watcher/session state.
Location: `skills/session-observer/scripts/lib/watch.mjs:106`

**Step 2: Implement fix**

Harden event-log resolution before starting a watcher. Reject event-log paths that would write through symlinks escaping the session-observer state directory, and reject reserved state/control filenames, lock files, temp files, and backup-style state files. Preserve metadata-only event log behavior for valid paths.

**Step 3: Verify**

Run: `node --test tests/session-observer/watch.test.mjs tests/session-observer/cli.test.mjs`
Expected: Tests pass, including regression coverage for an in-state symlink pointing outside and reserved filenames such as `state.json` and `watch.json`.

Run: `npm test`
Expected: Full test suite passes.

**Step 4: Commit**

```bash
git add skills/session-observer/scripts/lib/watch.mjs \
  tests/session-observer/watch.test.mjs \
  skills/session-observer/references/watch-design.md \
  skills/session-observer/SKILL.md
git commit -m "fix(p07-t01): harden session observer event logs"
```

---

## Reviews

| Scope | Type | Status | Date | Artifact |
| ----- | ---- | ------ | ---- | -------- |
| p01 | code | pending | - | - |
| p02 | code | pending | - | - |
| p03 | code | pending | - | - |
| p04 | code | pending | - | - |
| p05 | code | pending | - | - |
| p06 | code | pending | - | - |
| p07 | code | pending | - | - |
| final | code | received | 2026-06-03 | reviews/final-code-review-2026-06-03-v6.md |
| spec | artifact | n/a | - | quick mode has no spec.md |
| design | artifact | n/a | - | quick mode has no design.md |
| plan | artifact | passed | 2026-06-03 | reviews/archived/artifact-plan-review-2026-06-02.md |

**Status values:** `pending` -> `received` -> `fixes_added` -> `fixes_completed` -> `passed`

## Implementation Complete

**Summary:**

- Phase 1: 2 tasks - Watch state primitives and CLI command surface.
- Phase 2: 3 tasks - Reusable catch-up pipeline, polling/debounce event emission, and control/shutdown behavior.
- Phase 3: 2 tasks - Skill docs, provider-view sync, user-level dogfooding install, and full verification.
- Phase 4: 3 tasks - Final review fixes for both-runtime emission, event-log path safety, and implementation summary.
- Phase 5: 1 task - Final review fix aligning `--runtime both` with the documented Claude Code plus Codex scope.
- Phase 6: 3 tasks - Final review fixes for inactive watch-control directives, debounce test determinism, and repo dashboard freshness.
- Phase 7: 1 task - Final review fix hardening event-log symlink and reserved-file safety.

**Total: 15 tasks**

Ready for `oat-project-implement`.

## References

- Discovery: `discovery.md`
- Existing watch reference: `skills/session-observer/references/watch-design.md`
- Skill instructions: `skills/session-observer/SKILL.md`
- CLI entrypoint: `skills/session-observer/scripts/session-observer.mjs`
- Existing state module: `skills/session-observer/scripts/lib/state.mjs`
- Existing digest module: `skills/session-observer/scripts/lib/digest.mjs`
- Existing tests: `tests/session-observer/`
