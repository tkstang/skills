---
oat_generated: true
oat_generated_at: 2026-06-03
oat_review_scope: final
oat_review_type: code
oat_review_invocation: manual
oat_project: .oat/projects/shared/session-observer-watch
---

# Code Review: final

**Reviewed:** 2026-06-03
**Scope:** final (f8d3257114f5880848655bea01cb359f844bbe48..HEAD) — all implementation phases p01–p07 for the session-observer watch-mode feature
**Files reviewed:** 13 substantive code/test/docs files (18 total in range, excluding .oat bookkeeping)
**Commits:** 30 commits in range (15 implementation tasks plus OAT bookkeeping)

## Summary

This is an independent v6 final pass; I re-derived conclusions from the artifacts, source, and live verification rather than inheriting the v5 "clean" verdict. The watch-mode implementation is complete, well-tested (301 tests passing), and faithful to the `discovery.md` success criteria and `watch-design.md` contract. The four prior review cycles' fixes (both-runtime offset preservation, event-log path/symlink/reserved-file hardening, inactive control-directive suppression, debounce determinism, `--runtime both` Cursor exclusion) are all present and correctly implemented. I found zero Critical, zero Important, zero Medium, and zero Minor defects. The provider-hook deferral remains an accurately documented scope boundary, not a defect.

## Findings

### Critical

None

### Important

None

### Medium

None

### Minor

None

## Requirements/Design Alignment

**Evidence sources used:** `discovery.md` (primary requirements source — quick mode), `plan.md`, `implementation.md`, and the in-repo design anchor `skills/session-observer/references/watch-design.md`. `spec.md` and `design.md` are absent, which is expected for quick mode and not flagged.

### Requirements Coverage (discovery.md Success Criteria)

| Requirement | Status | Notes |
| ----------- | ------ | ----- |
| `watch` subcommand and `--watch` alias enter watch mode | implemented | `session-observer.mjs` dispatch (`watch`, `watch-ctl`); `--watch` alias parsed; help surface verified via `--help`. |
| Watch identifies same candidate as locate/rank/catch-up path | implemented | `watch.mjs` `establishBaseline` calls shared `observeCatchUp` (`observe.mjs`), reusing discover/rank/snippet/pinned rules. |
| Polls, debounces, emits at most one digest per settled burst | implemented | `pollTargets` + `emitReadyPending` debounce gate (`watch.mjs:298-305`); covered by deterministic coalescing test (`watch.test.mjs:147`). |
| New output rendered as catch-up digest for active agent | implemented | `renderMarkdown` / `stdoutEvent` carry digest content to stdout. |
| `--json` emits JSON-line events; `--event-log` writes metadata-only JSONL | implemented | `stdoutEvent` (full digest on stdout) vs `eventMetadata` (no message content) — verified by metadata-only test (`watch.test.mjs:303`). |
| `watch-ctl status/pause/resume/flush/stop` via control file | implemented | `runWatchCtl` (`session-observer.mjs:838`) + `applyControlDirective` (`watch.mjs:307`). |
| Singleton enforcement; stale pids cleared | implemented (stricter) | `startWatcher` enforces a single global active watcher (stricter than per-runtime/cwd); `clearStaleActive` clears dead pids via `kill(pid,0)`/`ESRCH`. Documented design delta in `implementation.md:758`. |
| Existing CLI tests pass; new state/debounce/control/runtime tests added | implemented | Full suite 301 pass / 0 fail; dedicated `watch-state`, `observe`, `watch` test files. |
| Skill docs no longer say watch is unimplemented; operator guidance added | implemented | `SKILL.md` watch section + `watch-design.md`; `validate.mjs:226-252` invariant rejects stale "not implemented"/"design-only" wording and requires the command-surface tokens. |
| Dogfooding install refreshed; provider symlinks verified | implemented | `.agents/skills/session-observer` is a tracked symlink to the canonical copy; user-level sync recorded in `implementation.md:147-150`. |

### Safety-Sensitive Verification (explicit re-check)

- **Atomic state writes / lock handling:** `watch-state.mjs` mirrors `state.mjs` lock/tmp/datasync/rename discipline. `recordWatcherEvent` and `clearWatcher` guard by pid, preventing a second watcher from clobbering another's state. Sound.
- **Stale-pid cleanup:** `isPidLive` correctly treats `ESRCH` as dead and `EPERM` as live; `loadWatchState` clears and persists stale active entries under lock. Sound.
- **Event-log path handling:** `assertEventLogPathSafe` enforces lexical containment, rejects reserved basenames (`state.json`, `watch.json`, `watch.control.json`, plus `.lock`/`.tmp`/`.bak` and `state.json.*` prefixes), and resolves symlinks via `realpath` to reject escapes — re-validated on each append (`appendEventLog:206-208`). Covered by symlink-escape and reserved-name regression tests. Sound.
- **Debounce correctness:** Coalescing burst is gated on `now - lastChangedAt >= debounceMs`; deterministic test injects fake `now`/`sleep`. Sound.
- **`--runtime both` singleton handling:** `watchRuntimes('both')` returns `['claude-code','codex']` only (Cursor excluded per documented contract); `establishBaselines` skips the offset-advancing baseline call for already-tracked runtimes (`watch.mjs:242`), so appended records are not silently marked read before debounce emission. Both the both-preservation and Cursor-exclusion regressions pass. Sound.

### Extra Work (not in declared requirements)

None. All code maps to discovery success criteria or to review-fix tasks (p04–p07). The global-singleton model and constrained `--event-log` semantics are documented accepted design deltas, not unrequested scope.

## Deferred Ledger Disposition

**Provider-hook automation — REMAINS ACCEPTABLE.** This is a documented scope boundary (`discovery.md` Out of Scope; `implementation.md:492,757`; `watch-design.md:204-208`), not review debt. I verified there is no overclaiming: `SKILL.md:209` and `watch-design.md:22,206-208` explicitly state automatic responses are bounded to the active foreground invocation and that no provider hook will summon a new agent after the invocation stops polling. The docs and code honestly reflect the boundary. No carry-forward Medium/Minor items remain (ledger reported 0/0). No action required.

## Verification Commands

Run to verify the implementation (all executed during this review):

```bash
npm test        # 301 tests, 25 suites — PASS (0 fail, 0 skipped)
npm run validate # validation passed — PASS
npm run smoke   # smoke passed — PASS
```

Actual results this pass:
- `npm test`: 301 pass / 0 fail / 0 cancelled / 0 skipped (duration ~6.7s).
- `npm run validate`: `validation passed` (exit 0).
- `npm run smoke`: `smoke passed` (exit 0).
- `git diff --check f8d3257..HEAD`: clean (no whitespace errors).

## Recommended Next Step

Run the `oat-project-review-receive` skill to record this clean final pass and proceed to closeout. No fix tasks are required — there are no findings to convert.
