---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-05-15
oat_current_task_id: null
oat_generated: false
---

# Implementation: session-observer

**Started:** 2026-05-15
**Last Updated:** 2026-05-15

> Conventions:
>
> - `oat_current_task_id` always points at the **next plan task to do** (not the last completed task).
> - When all plan tasks are complete, set `oat_current_task_id: null`.
> - Reviews are **not** plan tasks. Track review status in `plan.md` under `## Reviews`.
> - Keep phase/task statuses consistent with the Progress Overview table so restarts resume correctly.
> - Before running the `oat-project-pr-final` skill, fill `## Final Summary (for PR/docs)` with what was actually implemented.

## Progress Overview

| Phase   | Status      | Tasks | Completed |
| ------- | ----------- | ----- | --------- |
| Phase 1 | complete    | 2     | 2/2       |
| Phase 2 | complete    | 2     | 2/2       |
| Phase 3 | complete    | 2     | 2/2       |
| Phase 4 | complete    | 4     | 4/4       |
| Phase 5 | complete    | 3     | 3/3       |
| Phase 6 | complete    | 2     | 2/2       |
| Phase 7 | complete    | 4     | 4/4       |

**Total:** 19/19 tasks completed

---

## Phase 1: Skill scaffolding + state

**Status:** complete
**Started:** 2026-05-15

### Task p01-t01: Scaffold skill directory and SKILL.md skeleton

**Status:** complete
**Commit:** ec18d74

### Task p01-t02: Implement scripts/lib/state.mjs + tests

**Status:** complete
**Commit:** d56577f

### Phase 1 Summary

**Outcome:** The `session-observer` skill directory is scaffolded (`SKILL.md` skeleton + `scripts/`, `scripts/lib/`, `references/`), and `scripts/lib/state.mjs` provides atomic, lock-protected high-water-mark persistence at `~/.local/state/session-observer/state.json`.

**Key files:** `.agents/skills/session-observer/SKILL.md`, `.agents/skills/session-observer/scripts/lib/state.mjs`, `tests/session-observer/state.test.mjs`, `tests/session-observer/helpers/tmpdir.mjs`.

**Verification:** `node --test tests/session-observer/state.test.mjs` → 11 pass / 0 fail.

**Review:** p01 phase-gate review → **PASS** (0 Critical, 0 Important). 3 Medium + 2 Minor non-blocking findings recorded in `reviews/archived/p01-review-2026-05-15.md`:

- M1 — `load()`'s callee writes backup files (corrupt/migration) without the `mutate` lock.
- M2 — `migrateIfNeeded` upgrades the in-memory object but does not persist the upgraded `state.json`.
- M3 — backup writes use non-atomic `writeFile`; fixed-name `state.v0.json.bak` can clobber a prior backup.
- Minor — unused `access` import; `load()` docstring overstates "read-only".

All three Medium findings sit on dormant/edge-case paths (schema v1 is current so the migration branch is inert; corrupt-state and repeat-backup are edge cases) — none affect the happy path. Deferred to the final review unless surfaced sooner.

---

## Phase 2: Runtime parsing

**Status:** complete
**Started:** 2026-05-15

### Task p02-t01: Author synthetic JSONL fixtures for both runtimes

**Status:** complete
**Commit:** 81cd68c

### Task p02-t02: Implement scripts/lib/runtimes.mjs + tests

**Status:** complete
**Commit:** d701d52

### Phase 2 Summary

**Outcome:** Synthetic JSONL fixtures created for both runtimes (11 files), and `scripts/lib/runtimes.mjs` implements all five public exports: `discoverPaths`, `encodeCwd`, `extractMeta`, `readRecords`, `normalizeEntries`. Tolerant JSONL parsing (malformed lines warn + skip; partial trailing lines warn + drop). Tool calls excluded by default; `includeToolCalls: true` adds `[Tool: name] args` (200-char truncation); `includeToolResults: true` adds `[Tool → result] body` (500-char truncation).

**Key files:** `tests/session-observer/fixtures/` (11 files), `.agents/skills/session-observer/scripts/lib/runtimes.mjs`, `tests/session-observer/runtimes.test.mjs`.

**Verification:** `node --test tests/session-observer/runtimes.test.mjs tests/session-observer/state.test.mjs` → 39 pass / 0 fail.

---

## Phase 3: Discovery + ranking

**Status:** complete
**Started:** 2026-05-15

### Task p03-t01: Implement scripts/lib/locate.mjs + tests

**Status:** complete
**Commit:** 9012049

### Task p03-t02: Implement scripts/lib/rank.mjs + tests

**Status:** complete
**Commit:** c3685ce

### Phase 3 Summary

**Outcome:** `scripts/lib/locate.mjs` discovers Claude Code transcripts via direct `encodeCwd` dir lookup (with glob fallback) and Codex transcripts via dated directory glob with a 7-day LOOKBACK_DAYS filter. Direct Claude Code hits set `recordedCwd = targetCwd` exactly (not via lossy decode). A codex cwd-cache at `${STATE_DIR}/codex-cwd-cache.json` keyed by `${transcriptPath}:${mtimeSec}` avoids re-parsing unchanged transcripts. `gitWorktrees` enumerates sister git worktrees, returning `[]` on any failure.

`scripts/lib/rank.mjs` exports `rank(candidates, targetCwd, opts)` and `tierOf(candidate, targetCwd)`. Tier ordering: A (exact cwd) > B (descendant cwd) > C (no match). On no-match, returns `{ winner: null, noMatch: true, sisters, globalRecent }` with `globalRecent` top-5 by mtime. Ties within `TIE_WINDOW_SEC = 5s` of the winner appear in `ties[]`. Winners younger than `ACTIVE_THRESHOLD_SEC = 60s` are flagged `active: true`. No I/O; `gitWorktrees` and `globalRecentProvider` injected via `opts`. No dependency on `locate.mjs`.

**Key files:** `.agents/skills/session-observer/scripts/lib/locate.mjs`, `.agents/skills/session-observer/scripts/lib/rank.mjs`, `tests/session-observer/locate.test.mjs`, `tests/session-observer/rank.test.mjs`.

**Verification:** `node --test tests/session-observer/state.test.mjs tests/session-observer/runtimes.test.mjs tests/session-observer/locate.test.mjs tests/session-observer/rank.test.mjs` → 60 pass / 0 fail.

---

## Phase 4: Digest + CLI (runs in parallel with Phase 5)

**Status:** complete
**Started:** 2026-05-15

### Task p04-t01: Implement scripts/lib/digest.mjs + tests

**Status:** complete
**Commit:** ca5a389

### Task p04-t02: Implement scripts/session-observer.mjs (CLI) + cli.test.mjs

**Status:** complete
**Commit:** 40c5a2b

### Task p04-t03: Implement scripts/probe-local.mjs

**Status:** complete
**Commit:** 9c28d6d

### Task p04-t04: Integration test (synthetic fixtures, temp HOME)

**Status:** complete
**Commit:** 94787e8

### Phase 4 Summary

**Outcome:** `scripts/lib/digest.mjs` implements `buildDigest`, `renderMarkdown`, `renderJson`. `scripts/session-observer.mjs` is the CLI entrypoint with full subcommand dispatch (`review`, `catch-up`, `locate`, `state`), exit codes 0–3, `--runtime auto` resolution via env hint or tier-population, `node:util parseArgs`, `--debug` shorthand, `--mark-read` flag. `scripts/probe-local.mjs` is an opt-in helper that resolves the sibling CLI via `fileURLToPath(new URL('./session-observer.mjs', import.meta.url))`. Integration tests cover all 6 plan test cases.

**Key files:** `.agents/skills/session-observer/scripts/lib/digest.mjs`, `.agents/skills/session-observer/scripts/session-observer.mjs`, `.agents/skills/session-observer/scripts/probe-local.mjs`, `tests/session-observer/digest.test.mjs`, `tests/session-observer/cli.test.mjs`, `tests/session-observer/integration.test.mjs`.

**Verification:** `node --test tests/session-observer/` (all 7 test files) → 91 pass / 0 fail.

---

## Phase 5: Documentation (runs in parallel with Phase 4)

**Status:** complete
**Started:** 2026-05-15

### Task p05-t01: Write full SKILL.md body

**Status:** complete
**Commit:** 5753e08

### Task p05-t02: Write references/watch-design.md

**Status:** complete
**Commit:** ca9c3f7

### Task p05-t03: Write references/transcript-formats.md

**Status:** complete
**Commit:** cf0d6dd

### Phase 5 Summary

**Outcome:** Full SKILL.md body written (299 lines, frontmatter untouched). All 8 required sections present in plan order: Title, When to Use (with NL→subcommand table), When NOT to Use, Arguments (full CLI flag matrix + subcommand table), Workflow (Steps 1–4 with exit-code handling), Examples, Troubleshooting (7 scenarios including nuke option + probe-local), Success Criteria. `references/watch-design.md` (220 lines) documents the v2 continuous watcher design: CLI shape, polling rationale + pseudocode, debounce strategy, event emission pipeline, watch.json schema, singleton enforcement, event-log JSONL schema, `--runtime both` semantics, control surface (`watch-ctl` verbs + `watch.control.json` schema), SIGTERM/SIGINT shutdown, future hook integration notes, safety rules, and locked decisions. `references/transcript-formats.md` (253 lines) documents Claude Code and Codex JSONL record shapes including file location patterns, session-ID placement quirks, cwd extraction strategy per runtime, tool-use/tool-result correlation, and notes the known Minor limitation that Codex `extractMeta` reads `cwd` at the record top level.

**Key files:** `.agents/skills/session-observer/SKILL.md`, `.agents/skills/session-observer/references/watch-design.md`, `.agents/skills/session-observer/references/transcript-formats.md`.

**Verification:** SKILL.md: 299 lines (≤ 500 limit); frontmatter intact (name, version, description, argument-hint, disable-model-invocation, user-invocable, allowed-tools). watch-design.md: 220 lines (non-trivial). transcript-formats.md: 253 lines with section structure confirmed via `head -20`.

---

## Deviations from Plan

| ID | Phase | Description | Fix Commit |
|----|-------|-------------|------------|
| D1 | p04/p05 | `state reset --session <runtime>:<sessionId>` was documented in SKILL.md (p05) but the CLI `reset` handler (p04) never read `args.session` — it required `--runtime` and always called `resetByRuntime`. Fixed in p05 fix pass: `--session` is now parsed in the `reset` case; when present the handler calls `stateLib.resetBySession(runtime, sessionId)` instead. A new `cli.test.mjs` case verifies the per-session reset zeroes exactly one entry and leaves others intact. | e615b21 |
| D2 | p07-t04 | p01 planned backup filename `state.v0.json.bak` (fixed name). p07-t04 changed to `state.json.v0-<timestamp>-<pid>.bak` (unique, atomic). Existing state.test.mjs test updated to match new pattern. This is intentional: unique names are the correct implementation for p01-M3 (no clobber). | 06e1d23 |

---

## Phase 6: Validation

**Status:** complete
**Started:** 2026-05-15

### Task p06-t01: Confirm npm run validate passes; update scripts/validate.mjs if needed

**Status:** complete
**Commit:** (no commit — validate.mjs already recognized session-observer; no modification needed)

`npm run validate` passed without changes. `npm test` passed: 216 tests, 216 pass, 0 fail.

### Task p06-t02: Manual local probe verification

**Status:** complete
**Commit:** (committed below after implementation.md update)

### Phase 6 Summary

**Outcome:** `npm run validate` passed without modification to `validate.mjs` — the validator already recognized `.agents/skills/session-observer/` from prior phases. `npm test` passed all 216 tests (216 pass / 0 fail). Both `probe-local.mjs` invocations returned exit code 2 (noMatch), which is a PASS per the plan. 406 Claude Code transcripts and 140 Codex transcripts exist globally; none are recorded under this specific worktree path, which is expected.

**Verification:** `npm test` → 216/216 pass; `npm run validate` → passed; probe-local claude-code → exit 2 (PASS); probe-local codex → exit 2 (PASS).

---

## Phase 7: Final Review Fixes

**Status:** complete
**Started:** 2026-05-15

### Task p07-t01: (review) Read Codex payload.cwd in transcript metadata extraction

**Status:** complete
**Commit:** 280d2aa

In `runtimes.mjs` Codex `extractMeta`, added fallback to `record.payload.cwd` when top-level `record.cwd` is absent. In `locate.mjs`, cached `sessionId` alongside `recordedCwd` in the codex cwd-cache so a cache hit avoids re-parsing the transcript entirely. Added fixture `tests/session-observer/fixtures/codex/payload-cwd.jsonl` with `cwd` under `payload`, and added `runtimes.test.mjs` coverage proving `extractMeta` resolves `recordedCwd` from the `payload.cwd` fixture.

### Task p07-t02: (review) Apply --session pinned override before tie and no-match returns

**Status:** complete
**Commit:** a27dc47

In both `runReview` and `runCatchUp`, moved the `--session` parsing block to execute before `rank()` and the tie/no-match early-return branches. When a valid pinned session is supplied, the candidate is selected directly and a digest is built without touching the ranking path. Validates the pinned runtime (must be a known runtime), validates the session format (must contain `:`), and exits 1 with a clear message on invalid or unresolvable sessions. Added 4 new `cli.test.mjs` cases: tie-recovery for review, catch-up with session, invalid session ID (exit 1), invalid format (exit 1).

### Task p07-t03: (review) Make rank.mjs Tier B path matching bidirectional

**Status:** complete
**Commit:** 35c0fe3

In `rank.mjs` `tierOf`, added a second Tier B check: `targetCwd.startsWith(recordedCwd + '/')` so sessions started at a repo root still match when the agent is invoked from a subdirectory. Both directions are path-boundary-safe (the `/` sentinel prevents `/foo/bar` from matching `/foo/barbaz`). Added 4 new `rank.test.mjs` cases: ancestor direction (primary new case), path-boundary safety, and a full `rank()` integration test for the ancestor direction.

### Task p07-t04: (review) Harden state.mjs backup and migration write paths

**Status:** complete
**Commit:** 06e1d23

Four fixes applied in one coherent pass:
- (p01-M1) Backup writes now happen inside `mutate()`'s lock scope (both corrupt-state and migration backups are written via `writeBackup()` which is called from `readState()`, which is called inside the locked `mutate()` block).
- (p01-M2) `migrateIfNeeded` upgrades the in-memory state; the upgraded state is then persisted to disk via the normal `writeState()` call inside `mutate()` — so a subsequent bare `load()` sees the schemaVersion 1 file.
- (p01-M3) Backup filenames now include a timestamp + PID suffix (e.g. `state.json.v0-1747326000000-12345.bak`), written atomically via tmp+rename, so repeat migrations/corruptions never clobber a prior backup.
- (m1) Removed unused `access` import from the `node:fs/promises` import list.
Updated state.test.mjs: existing migration test updated to expect new `state.json.v0-*` filename pattern; added 2 new cases: migration persists to disk (re-read returns schemaVersion 1), backup uniqueness (two corrupt loads produce two distinct filenames).

### Phase 7 Summary

**Outcome:** All 5 findings from the final-scope code review are resolved. Codex transcripts whose `session_meta` stores `cwd` under `payload.cwd` now match the active project (was the Critical that broke bidirectional Codex inspection). The documented `--session` recovery path now works — it is applied before the tie (exit 3) and no-match (exit 2) returns. `rank.tierOf` Tier B is bidirectional, so a session started at a repo root matches when the agent runs from a subdirectory. `state.mjs` backup/migration write paths are hardened (locked backups, persisted migration, unique atomic backup filenames).

**Key files:** `scripts/lib/runtimes.mjs`, `scripts/lib/locate.mjs`, `scripts/lib/rank.mjs`, `scripts/lib/state.mjs`, `scripts/session-observer.mjs`, `tests/session-observer/fixtures/codex/payload-cwd.jsonl`, and the four affected test files.

**Verification:** `npm test` → 226/226 pass; `npm run validate` → passed.

**Review:** p07 phase-gate review → **PASS** (0 Critical, 0 Important). 1 Minor non-blocking finding (`load()` unlocked-backup residual) recorded in `reviews/archived/p07-review-2026-05-15.md` — bounded, no fix task.

---

## Orchestration Runs

<!-- orchestration-runs-start -->

### Run 1 — 2026-05-15

**Branch:** chore/new-skill-brainstorm
**Tier:** 1 (subagents)
**Policy:** merge-strategy=merge, retry-limit=2
**Phases:** 6 executed, 6 passed, 0 failed, 0 stopped

#### Phase Outcomes

| Phase | Implementer | Review            | Fix Iterations | Disposition |
| ----- | ----------- | ----------------- | -------------- | ----------- |
| p01   | DONE        | pass              | 0/2            | committed   |
| p02   | DONE        | pass (after fix)  | 1/2            | committed   |
| p03   | DONE        | pass              | 0/2            | committed   |
| p04   | DONE        | pass              | 0/2            | committed   |
| p05   | DONE        | pass (after fix)  | 1/2            | committed   |
| p06   | DONE        | pass              | 0/2            | committed   |

#### Parallel Groups

- p01, p02, p03: sequential
- [p04, p05]: declared parallel group — degraded to sequential (worktree bootstrap incompatible with this repo; see Outstanding Items)

#### Dispatch Notes

- Dispatch: p01 — model_axis=selected:sonnet, effort_axis=not-applicable (Claude Code; skill scaffolding + state module with file-locking).
- Dispatch: p02 — model_axis=selected:sonnet, effort_axis=not-applicable (Claude Code; per-runtime transcript adapters + fixtures). Fix dispatch (1 iteration) used the same axes.
- Dispatch: p03 — model_axis=selected:sonnet, effort_axis=not-applicable (Claude Code; candidate discovery + tier-based ranking).
- Dispatch: p04 — model_axis=selected:sonnet, effort_axis=not-applicable (Claude Code; digest builder + CLI entrypoint + probe helper + integration test).
- Dispatch: p05 — model_axis=selected:sonnet, effort_axis=not-applicable (Claude Code; SKILL.md body + reference docs). Fix dispatch (1 iteration) used the same axes.
- Dispatch: p06 — model_axis=selected:sonnet, effort_axis=not-applicable (Claude Code; repo validation + manual local probe).

#### Outstanding Items

- p01 review recorded 3 Medium + 2 Minor non-blocking findings (`reviews/archived/p01-review-2026-05-15.md`). All on dormant/edge-case paths in `state.mjs`; deferred to final review.
- p02 first review FAIL (2 Critical — tool-marker format diverged from spec); fixed in `b4b3bd0`; re-review PASS (`reviews/archived/p02-rereview-2026-05-15.md`). 1 Minor (`payload.cwd` fallback for Codex `extractMeta`) carried forward — revisit during p05-t03 / final review.
- p03 review PASS with 2 Minor non-blocking findings (`reviews/archived/p03-review-2026-05-15.md`): (1) the Codex cwd-cache still re-calls `extractMeta` for `sessionId` after a cache hit, so it yields correct results but no real speedup — fix by caching `sessionId` alongside `recordedCwd`; (2) `rank.tierOf` uses raw string equality rather than `realpath`-normalized comparison (spec failure mode #14, symlinked cwds). Both carried to the final review.
- **Parallel group [p04, p05] degraded to sequential.** `oat-worktree-bootstrap-auto`'s baseline-check contract requires `pnpm run worktree:init`; this repo is a plain npm project (Node stdlib only; package.json scripts are `test`/`validate`/`smoke`, no `worktree:init`), so a strict worktree bootstrap fails by construction. Per the orchestrator's bootstrap-failure rule, p04 and p05 run sequentially on the orchestration branch with the normal per-phase dispatch/review/fix loop. Write sets are disjoint (p04 → `scripts/` + `tests/`, p05 → SKILL.md body + `references/`), so sequential execution is correct — only wall-clock parallelism is lost. No worktrees created; no fan-in merge.
- p04 review PASS with 3 Minor non-blocking findings (`reviews/archived/p04-review-2026-05-15.md`): (1) `runCatchUp` calls `markRead` even when `newRecords === 0` — a redundant locked write on a no-op `catch-up`; behavior stays correct; (2) `tierOf` raw string equality vs `realpath` — same p03 carry-over; (3) exit code 4 (schema mismatch) is documented but never produced by any CLI path — likely intentionally reserved. All carried to the final review.
- p05 first review FAIL (1 Important — `state reset --session` documented but not wired into the CLI; 2 Minor). Fixed in `e615b21` (wired `--session` into the CLI reset handler + new `cli.test.mjs` case; aligned the EBUSY doc wording and a doc path reference). Re-review PASS, 0 findings (`reviews/archived/p05-rereview-2026-05-15.md`).
- p06 review PASS (`reviews/archived/p06-review-2026-05-15.md`). 2 Minor, both out of p06 scope: (1) `plan.md`/`design.md` carry a stale `oat_last_updated: 2026-05-14` — normalize at PR-final; (2) `implementation.md` `## Final Summary` placeholders — filled at implementation-complete / before `oat-project-pr-final`.

### Run 2 — 2026-05-15

**Branch:** chore/new-skill-brainstorm
**Tier:** 1 (subagents)
**Policy:** merge-strategy=merge, retry-limit=2
**Phases:** 1 executed, 1 passed, 0 failed, 0 stopped

#### Phase Outcomes

| Phase | Implementer | Review | Fix Iterations | Disposition |
| ----- | ----------- | ------ | -------------- | ----------- |
| p07   | DONE        | pass   | 0/2            | committed   |

#### Parallel Groups

- p07: sequential

#### Dispatch Notes

- Dispatch: p07 — model_axis=selected:sonnet, effort_axis=not-applicable (Claude Code; final-review fix tasks — Codex payload.cwd, --session ordering, bidirectional Tier B, state.mjs hardening).

#### Outstanding Items

- p07 review PASS (`reviews/archived/p07-review-2026-05-15.md`) with 1 Minor non-blocking finding: `load()`'s direct (unlocked) path can still write a backup file. Bounded — `load()` writes no `state.json`, and unique `Date.now()-pid` backup names prevent any clobber; consistent with the final review's "dormant/edge-case" disposition of p01-M1. No fix task.

<!-- orchestration-runs-end -->

---

## Implementation Log

_Append session entries below as `oat-project-implement` runs._

---

## Manual Verification

**Date:** 2026-05-15
**Repo cwd:** `/Users/thomas.stang/.superconductor/worktrees/skills/sc-pinned-meissner-9974`

### claude-code probe

```
node .agents/skills/session-observer/scripts/probe-local.mjs --runtime claude-code --cwd "$PWD"
```

**Exit code:** 2 (noMatch — PASS)

**Header output:**
```
[probe-local] runtime: claude-code
[probe-local] cwd: /Users/thomas.stang/.superconductor/worktrees/skills/sc-pinned-meissner-9974
[probe-local] transcript store: ~/.claude/projects/
[probe-local] candidates found: 406
[probe-local] no match in target cwd (noMatch)
[probe-local] --- spawning CLI review ---

No claude-code transcripts matched cwd: /Users/thomas.stang/.superconductor/worktrees/skills/sc-pinned-meissner-9974
```

**Assessment:** 406 Claude Code transcripts found globally. No transcript recorded under this worktree path (expected — this is a dedicated worktree not a regular project directory). The noMatch response is correct. No hard error.

### codex probe

```
node .agents/skills/session-observer/scripts/probe-local.mjs --runtime codex --cwd "$PWD"
```

**Exit code:** 2 (noMatch — PASS)

**Header output:**
```
[probe-local] runtime: codex
[probe-local] cwd: /Users/thomas.stang/.superconductor/worktrees/skills/sc-pinned-meissner-9974
[probe-local] transcript store: ~/.codex/sessions/
[probe-local] candidates found: 140
[probe-local] no match in target cwd (noMatch)
[probe-local] --- spawning CLI review ---

No codex transcripts matched cwd: /Users/thomas.stang/.superconductor/worktrees/skills/sc-pinned-meissner-9974
```

**Assessment:** 140 Codex transcripts found globally. No transcript recorded under this worktree path (expected — same reason as claude-code). The noMatch response is correct. No hard error.

### Summary

| Runtime     | Exit Code | Transcript Stores Found | Right Session Picked | Result |
| ----------- | --------- | ----------------------- | -------------------- | ------ |
| claude-code | 2         | 406                     | N/A (noMatch)        | PASS   |
| codex       | 2         | 140                     | N/A (noMatch)        | PASS   |

Both probes returned exit code 2 (noMatch). This is correct behavior per the plan: "An exit code of 0 (a digest was produced) or 2 (noMatch / no candidates) is a PASS — only exit code 1 (hard error) is a failure." The probe helper correctly discovers global transcript stores and searches them without throwing. No follow-up bugs to record.

---

## Artifact Reviews Received

### 2026-05-15 — design + plan artifact reviews

Two `artifact`-type reviews were received and resolved directly in the artifacts (no plan tasks — artifact reviews resolve in-place).

- **`artifact-design-review-2026-05-14.md`** (scope: design) — 0 critical, 1 important, 1 medium, 0 minor.
- **`artifact-plan-review-2026-05-14.md`** (scope: plan) — 0 critical, 1 important, 1 medium, 0 minor.

**Findings + disposition (all `resolve_in_artifact`):**

- `I1` — `design.md` data flow + the source spec used a bare relative `scripts/session-observer.mjs` path that resolves wrong from a normal cwd. Fixed: `design.md` invokes the CLI by its skill-relative path and adds a "Script resolution" design decision; `probe-local.mjs` resolves its sibling via `import.meta.url`; the spec integration command resolves an absolute path.
- `I2` — `plan.md` p04-t03 spawned `node scripts/session-observer.mjs` (relative). Fixed: p04-t03 resolves the sibling CLI via `fileURLToPath(new URL('./session-observer.mjs', import.meta.url))`.
- `M1` — `design.md` rank.mjs `sisters` ownership was ambiguous. Fixed: the `rank` interface now takes injected `gitWorktrees` / `globalRecentProvider` via `opts`, with an explicit no-`locate`-dependency note; matches `plan.md` p03-t02. Also corrected an internal exit-code typo (`noMatch` is exit 2, not 3).
- `M2` — `plan.md` p03-t01 cwd-cache test relied on monkeypatching an ESM export. Fixed: the test now proves the cache hit via observable cache-file state.

**Related hardening:** `plan.md` p04-t02 and p04-t04 now instruct the implementer to spawn the CLI by an `import.meta.url`-resolved absolute path so the relative-path trap is not reintroduced in the test tasks.

Both review artifacts archived to `reviews/archived/`. No plan tasks were added; `plan.md` remains `oat_ready_for: oat-project-implement` with 15 tasks unchanged.

---

## Final Review Received

### 2026-05-15 — final-scope code review

**Review artifact:** `reviews/archived/final-review-2026-05-15.md`

**Findings:** 1 Critical, 1 Important, 1 Medium, 2 Minor.

**New tasks added (Phase 7 — `oat_ready_for: oat-project-implement`):**

- `p07-t01` — (C1) Read Codex `payload.cwd` in `extractMeta`; cache `sessionId` with `recordedCwd`; add a `payload.cwd` fixture/test. Current Codex `session_meta` records store cwd under `payload.cwd`, so codex transcripts were resolving `recordedCwd: null` → noMatch.
- `p07-t02` — (C1 recovery + I1) Apply the validated `--session` pinned override before the tie (exit 3) and no-match (exit 2) early returns in `runReview`/`runCatchUp`, so the documented recovery path works.
- `p07-t03` — (M1) Make `rank.tierOf` Tier B bidirectional (either side a path-prefix of the other), per the spec's subdirectory-matching contract.
- `p07-t04` — (3 deferred p01 Mediums + Minor m1, user-elected to fix now) Harden `state.mjs`: lock backup writes, persist `migrateIfNeeded` upgrades to disk, unique+atomic backup filenames, remove the unused `access` import.

**Deferred Findings:**

- **m2 (Minor)** — `implementation.md` `## Final Summary` placeholders + `state.md` `oat_phase_status: in_progress`. Deferred with rationale: this is closeout metadata that the normal finalization flow resolves on its own — `oat-project-implement` keeps `oat_phase_status: in_progress` by design until the final review passes, and the Final Summary is filled at implementation-complete / `oat-project-pr-final`. No fix task needed.

**Step 8.5 deferred-Medium ledger:** the 3 previously-deferred p01 `state.mjs` Mediums (`load()` lock, `migrateIfNeeded` persistence, backup-clobber atomicity) were resurfaced; the user elected to **convert all 3** to fix tasks (folded into `p07-t04`) rather than carry the deferral.

**Next:** Execute Phase 7 via `oat-project-implement` (starts at `p07-t01`). After the fix tasks complete, re-run `oat-project-review-provide code final` then `oat-project-review-receive` to reach `passed`.

---

## Deviations from Plan

| Task | Planned | Actual | Reason |
| ---- | ------- | ------ | ------ |
| p02-t02 | `[Tool: Name] args` / `[Tool → result] output` (emitted in original impl) | `[Name] args` / `[Name → result] output` with `toolName` set on tool_result entries; added first-pass `tool_use_id → name` correlation map in `normalizeClaudeCode` | p02 phase-gate review (Critical #1 + #2): marker format diverged from source-of-truth spec. Fixed in commit b4b3bd0. |

## Test Results

| Phase | Tests Run | Passed | Failed | Coverage |
| ----- | --------- | ------ | ------ | -------- |
| 1     | 11        | 11     | 0      | all plan cases covered |
| 2     | 39        | 39     | 0      | all plan cases covered |
| 3     | 60        | 60     | 0      | all plan cases covered |
| 4     | 91        | 91     | 0      | all plan cases covered |
| 5     | 92        | 92     | 0      | session-observer suite after p05 fix (+1 test) |
| 6     | 216       | 216    | 0      | full `npm test` repo suite at p06 |
| 7     | 226       | 226    | 0      | full `npm test` repo suite; +10 new p07 fix tests |

## Final Summary (for PR/docs)

**What shipped:** `session-observer` — a portable, user-installable Agent Skill at `.agents/skills/session-observer/` that lets Claude Code and Codex inspect each other's transcripts for the active project. v1 ships four CLI subcommands:

- `review` — one-shot tool-free digest of the most relevant peer session.
- `catch-up` — incremental digest of only the records added since the last check, via a per-`(runtime, sessionId)` high-water mark.
- `locate` — ranked candidate list as JSON.
- `state` — manage the read-offset store (`get` / `reset --runtime` / `reset --session` / `clear`).

The continuous `watch` mode is designed (`references/watch-design.md`) but intentionally not implemented in v1.

**Behavioral changes (user-facing):** New skill only — no change to existing repo behavior. The skill adds runtime code under `.agents/skills/session-observer/scripts/` and a test suite under `tests/session-observer/`. State is written only to `~/.local/state/session-observer/`; transcripts are read-only; no network calls; no Stoa runtime dependency.

**Key files / modules:**

- `.agents/skills/session-observer/SKILL.md` — agent-facing skill (frontmatter + workflow + examples).
- `scripts/session-observer.mjs` — CLI entrypoint (subcommand dispatch, exit-code contract, `--runtime auto`, `--session` pinned override).
- `scripts/lib/{runtimes,locate,rank,digest,state}.mjs` — per-runtime transcript adapters, candidate discovery, tier ranking, digest builder/renderer, atomic lock-protected state.
- `scripts/probe-local.mjs` — opt-in manual verification helper.
- `references/watch-design.md`, `references/transcript-formats.md` — frozen watcher design + JSONL format reference.
- `tests/session-observer/**` — 226 tests (8 module/integration test files + fixtures).

**Verification performed:** `npm test` → 226/226 pass; `npm run validate` → passed; `npm run smoke` available. Manual `probe-local.mjs` run against the user's real `~/.claude/projects` and `~/.codex/sessions` (exit 2 / noMatch — expected for the current worktree path). Every phase passed a Tier 1 `oat-reviewer` phase-gate review; the final-scope review's findings were all fixed in Phase 7.

**Design deltas (if any):**

- p02-t02 — tool markers render as `[Name] args` / `[Name → result] output` (the design's `[Tool]` was a tool-name placeholder); a `tool_use_id → name` correlation map was added.
- p07-t04 — backup filenames are `state.json.v0-<ts>-<pid>.bak` (not the plan's fixed `state.v0.json.bak`) so repeat migrations/corruptions cannot clobber a prior backup.
- The `[p04, p05]` parallel group degraded to sequential — `oat-worktree-bootstrap-auto` requires a `pnpm run worktree:init` script this npm-only repo lacks; write-disjoint, so sequential execution was correct.
- One Minor residual deferred: `load()`'s direct path can write a backup outside the `mutate` lock — bounded (no `state.json` write, unique backup names), consistent with the final review's dormant-path disposition.

## References

- Plan: `plan.md`
- Design: `design.md`
- Discovery: `discovery.md`
- Source-of-truth spec: `.superpowers/specs/2026-05-14-session-observer-design.md`
