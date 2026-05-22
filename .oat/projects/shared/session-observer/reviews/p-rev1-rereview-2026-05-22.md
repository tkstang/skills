---
oat_generated: true
oat_generated_at: 2026-05-22
oat_review_scope: p-rev1
oat_review_type: code
oat_review_invocation: manual
oat_project: .oat/projects/shared/session-observer
---

# Code Re-Review: p-rev1 fix tasks (`prev1-t06` … `prev1-t13`)

**Reviewed:** 2026-05-22
**Scope:** Auto-narrowed re-review of the eight fix-task commits that closed the seven Minor findings from `reviews/archived/p-rev1-review-2026-05-22.md`, plus the bonus `load()` lock-residual fix.
**Commits in scope:** `25fd617`, `bf2bcdc`, `7f64a8f`, `6654a1b`, `fe5c2d9`, `647aa38`, `4ab5d64`, `3fbce17` (8 task commits; 8 interleaved `chore(oat)` bookkeeping commits skimmed only).
**Files reviewed:** 11 unique source/test files touched by the fix commits.

## Verdict

**pass.** All seven prior Minors are demonstrably resolved by their claimed tasks, the bonus `prev1-t13` fix is correct, no Critical or Important regressions were introduced, and the full regression suite (`npm test` → 269/269), `npm run validate`, and `npm run smoke` are all green. Test count grew from 260 → 269 (eight task commits added 9 new test assertions / cases).

## Per-finding resolution status

| Prior finding | Fix task | Status | Evidence |
|---|---|---|---|
| `--runtime auto --session <r>:<id>` ambiguity (M1) | `prev1-t06` (25fd617) | resolved | `session-observer.mjs:282-284` and `:477-479` parse the pinned session and override `runtime` **before** the `if (runtime === 'auto')` block. The pinned override at `:327-372` and `:520-573` is now reached without ever hitting `ambiguousRuntime` exit-3. New `cli.test.mjs:532-606` cases (`review` and `catch-up`) prove `--runtime auto --session cursor:<id>` exits 0 when Codex also matches the cwd. |
| Cursor fixture parity (M2) | `prev1-t07` (bf2bcdc) | resolved | New `tests/session-observer/fixtures/cursor/malformed.jsonl` (5 lines, one mid-file non-JSON line) and `partial-tail.jsonl` (5 lines, last truncated). `runtimes.test.mjs:95-104` and `:135-144` assert `readRecords` returns 4 records and emits a warn for each. |
| Cursor empty-direct fallback undocumented (M3) | `prev1-t08` (7f64a8f) | resolved | `locate.mjs:466-468` now carries a strategy comment documenting the intentional Cursor deviation (transcript-based, not directory-based). `locate.test.mjs:328-350` ("cursor: empty direct transcript dir still allows fallback scan") proves an existing-but-empty `<encoded>/agent-transcripts/` does not suppress the fallback. The test title in the file is the noun-singular variant of the sentence the prompt expected ("dir" vs "dirs") but covers exactly the cited behavior. |
| Duplicate stat in Cursor fallback (M4) | `prev1-t09` (6654a1b) | resolved | `cursorCandidate()` now accepts an optional `fileStat` parameter (`locate.mjs:417-432`); the fallback path at `:518-522` passes through the `fileStat` already obtained for the 7-day cutoff at `:510-516`. Direct-hit path continues to stat once internally. Existing Cursor locate tests still green. |
| Realpath/symlink Tier B carry-over (M5) | `prev1-t10` (fe5c2d9) | resolved | `rank.mjs` now imports `realpathSync` (`:21`), exports `realpathSafe` (`:37-43`), and applies `normalizeCwdPath` (`:45-47`) to both `recordedCwd` and `targetCwd` inside `tierOf` (`:76-81`) before the equality and `startsWith` checks. New `rank.test.mjs:320-334` ("tierOf: Tier A for symlink-equivalent cwd match") creates a real symlink with `fs.symlink` and asserts Tier A. The prior `realpathSafe handles ENOENT` test was updated to call the now-exported helper directly (`:274-278`). |
| `runCatchUp` no-op `markRead` (M6) | `prev1-t11` (647aa38) | resolved | New `shouldMarkCatchUpRead(sessionState, digest)` helper (`session-observer.mjs:215-222`) returns `true` only when `newRecords > 0` OR `sessionState` is null (first read) OR the stored offset differs from the digest's `nextIndex`/`totalRecords`. Both `runCatchUp` paths (winner at `:645-655` and pinned override at `:559-569`) are guarded. `integration.test.mjs:216-242` asserts `state.json` is byte-equal across a no-op second `catch-up`; `cli.test.mjs:728-744` adds the same check for the pinned-session path. Because `markRead` rewrites `lastReadAt` on every call, byte-equality is a strict witness that the lock was not entered. |
| No Cursor-flavored digest test (M7) | `prev1-t12` (4ab5d64) | resolved | `digest.test.mjs:247-256` adds `buildDigest('cursor', typicalCursor, { fromIndex: 0, mode: 'review' })` and asserts `digest.runtime === 'cursor'`, `totalRecords > 0`, and at least one assistant entry. The test is a smoke case (no `includeToolCalls`) consistent with how the Claude and Codex peers cover the digest pipeline; Cursor's `[Name]` / `[Name → result]` markers are exercised in `runtimes.test.mjs:531-541`. The plan task explicitly scoped this as `buildDigest` smoke coverage, so the omission of marker assertions here is the intended depth. |
| `load()` unlocked-backup residual (bonus) | `prev1-t13` (3fbce17) | resolved | `state.mjs:234-244` wraps `readState(dir)` in `acquireLock`/`releaseLock`, matching the pattern used by `mutate()`. The module-level comment (`:16-19`) and `readState` doc (`:130-138`) are updated to reflect that `load()` is now a lock-protected path. New `state.test.mjs:287-310` ("load waits for the state lock before writing corrupt backups") writes a stale lockfile, calls `load()` against corrupt JSON, asserts it has not settled after a 75ms timer, releases the lock, and verifies the corrupt backup is created only after release. Existing migration/corrupt-load tests still pass. |

## Findings

### Critical

None.

### Important

None.

### Medium

None.

### Minor

- **`tierOf` realpath cost is per-candidate, not per-rank.** (`skills/session-observer/scripts/lib/rank.mjs:73-83`)
  - Issue: `tierOf` calls `normalizeCwdPath(targetCwd)` once per candidate, even though `targetCwd` is identical across the whole `rank()` invocation. Each call is a synchronous `realpathSync.native`. For typical rank batches (single-digit candidates) this is unmeasurable; with many fallback candidates and a slow filesystem (e.g., NFS), it adds avoidable system calls.
  - Suggestion: Optional. Memoize the normalized `targetCwd` once at the `rank()` boundary and pass the pre-normalized value into `tierOf`, or cache by raw path inside `normalizeCwdPath`. Not blocking; defer unless a profile flags it.

### Notes (not findings)

- The fix-task commit messages follow the same `fix({task-id}): {imperative}` convention as Phase 7, which is consistent with the project's commit-convention contract (`plan.md:28`).
- The `prev1-t08` test name in `locate.test.mjs:328` reads "cursor: empty direct transcript dir still allows fallback scan" (singular `dir`), whereas the prompt cited "cursor: empty direct transcript dirs do not suppress fallback scans" (plural `dirs`, opposite framing). Both describe the same behavior and the assertion body is correct; the deviation is purely cosmetic.
- The `prev1-t06` refactor extracts `parsePinnedSession()` once and reuses it in both `runReview` and `runCatchUp`, which also removes the prior duplicated `colonIndex`/`VALID_RUNTIMES` validation block. This is a small DRY improvement folded into the fix.
- `prev1-t13` retains the comment that `load()` does not persist the migrated state to disk; that is consistent with the original `mutate()`-only persistence contract (a v0 file remains v0 on disk after a bare `load()`, but its parsed value is upgraded in memory). This is documented behavior, not a residual issue.

## Regression sanity

| Command | Result |
|---|---|
| `npm test` | **pass** — 269 tests, 0 fail, 0 cancelled, 0 skipped (was 260/260 before p-rev1; +9 new test cases across the 8 fix commits). |
| `npm run validate` | **pass** — `validation passed`. |
| `npm run smoke` | **pass** — `smoke passed`. |
| Targeted: `node --test tests/session-observer/*.test.mjs` | 145 tests, 0 fail. |

Spot-checked that prev1-t01..t05 work is intact:
- Cursor direct-lookup contract (`recordedCwd = targetCwd`, `cwdEvidence = 'direct-parent-dir'`) at `locate.mjs:479-484` is unchanged. Prev1-t10's realpath normalization lives in `rank.mjs`, not `locate.mjs`, so direct-vs-fallback dispatch is unaffected. Confirmed via `locate.test.mjs:282-303` ("cursor: direct lookup discovers agent transcript with exact cwd evidence") and `:305-326` ("cursor: fallback scan preserves project cwdSlug evidence") both still pass.
- `--runtime auto` Cursor + Codex resolution paths still exit 3 with `ambiguousRuntime` when no pinned session is supplied (still covered by existing `cli.test.mjs` cases under `describe('--runtime auto', ...)`).
- `discoverPaths('cursor')` and `encodeCwdVariants('cursor', cwd)` contract from prev1-t02 is untouched.
- Codex `payload.cwd` extraction from p07-t01 and `state.mjs` locked backups / atomic+unique backup filenames from p07-t04 remain intact; prev1-t13 only adds lock acquisition on the bare `load()` path.

No Critical or Important regression introduced.

## Verification Commands

```bash
# Full regression (must report 269 pass / 0 fail)
npm test

# Repository invariants
npm run validate

# Mocked end-to-end consensus wrapper
npm run smoke

# Targeted fix-task coverage
node --test tests/session-observer/cli.test.mjs                    # prev1-t06 + prev1-t11
node --test tests/session-observer/runtimes.test.mjs               # prev1-t07
node --test tests/session-observer/locate.test.mjs                 # prev1-t08 + prev1-t09
node --test tests/session-observer/rank.test.mjs                   # prev1-t10
node --test tests/session-observer/integration.test.mjs            # prev1-t11
node --test tests/session-observer/digest.test.mjs                 # prev1-t12
node --test tests/session-observer/state.test.mjs                  # prev1-t13
```

All commands ran green in this review.

## Recommended Next Step

Verdict is **pass**. p-rev1 can be marked `passed` in `plan.md` `## Reviews`; the project is ready for `oat-project-pr-final`. The single Minor above is a micro-optimization with no behavioral impact; the team may defer it indefinitely or convert it to a follow-up task via `oat-project-review-receive` if a future profile flags it.
