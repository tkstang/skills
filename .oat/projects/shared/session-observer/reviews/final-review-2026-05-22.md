---
oat_generated: true
oat_generated_at: 2026-05-22
oat_review_scope: final
oat_review_type: code
oat_review_invocation: manual
oat_project: .oat/projects/shared/session-observer
---

# Code Review: final (session-observer @ HEAD)

**Reviewed:** 2026-05-22
**Scope:** Final-scope shippable-state review against current HEAD (branch `chore/new-skill-brainstorm`).
**Files reviewed:** 132 in commit range
**Commits:** 189 in `f888df330b7a1d2020f2ec64ed7b3fdd366492d8..HEAD` (+21,320 / -51)

## Summary

The session-observer skill is in **shippable state**. The full verification suite is green (`npm test` 269/269, `npm run validate` passed, `npm run smoke` passed). All three runtimes are wired end-to-end with consistent tool-marker formatting, tolerant JSONL parsing, and runtime-symmetric exit-code semantics. The skill maintains a clean no-Stoa, no-network, no-transcript-write contract; all writes go to `STATE_DIR`. Two micro-findings surfaced: one carry-over deferred Minor confirmed safe to defer per its prior rationale, and one new trivial-Minor (unused imports in `probe-local.mjs`). Verdict: **pass**.

## Findings

### Critical

None.

### Important

None.

### Minor

- **Unused imports in `probe-local.mjs`** (`skills/session-observer/scripts/probe-local.mjs:17`)
  - Issue: `import { join, dirname } from 'node:path';` — neither identifier is used in the file. The CLI path is resolved via `fileURLToPath(new URL('./session-observer.mjs', import.meta.url))` on line 41, and no other `path` API is invoked.
  - Suggestion: Drop the import line entirely. Trivial cleanup; no behavior change. Verification: `grep -nE "\b(join|dirname)\b" skills/session-observer/scripts/probe-local.mjs` should return zero matches after removal, and `npm run validate` plus `npm test` should remain green.

### Deferred-Minor Dispositions (Step 4.5)

- **m1 — `tierOf` calls `normalizeCwdPath(targetCwd)` once per candidate** (`skills/session-observer/scripts/lib/rank.mjs:73-83`)
  - Status: **Accept-defer (unchanged).**
  - Rationale: Confirmed real on inspection. Lines 76–77 normalize both `recordedCwd` and `targetCwd` per candidate via synchronous `realpathSync.native`. `targetCwd` is identical across a single `rank()` invocation, so it could be memoized at the `rank()` boundary with one extra parameter pass-through. However:
    - Typical candidate counts in this skill are single digits (claude-code dir scope) up to ~150 (codex global scan); even on a slow filesystem the per-call cost is sub-millisecond.
    - No profiling data has flagged this; the original reviewer explicitly recommended "defer unless a profile flags it" — escalating now would be premature optimization.
    - Zero correctness impact: the function is idempotent and pure with respect to `targetCwd`.
  - Trigger to revisit: if a future profile shows `rank.tierOf` on the hot path for a real workload (e.g., a watch-mode tick), memoize the normalized `targetCwd` once at the `rank()` entry point and pass it through to `tierOf`. Until then, leave as-is.

## Requirements/Design Alignment

**Evidence sources used:**
- `.oat/projects/shared/session-observer/plan.md` (quick-mode source of truth)
- `.oat/projects/shared/session-observer/discovery.md`
- `.oat/projects/shared/session-observer/design.md` (lightweight design)
- `.oat/projects/shared/session-observer/implementation.md`
- `.superpowers/specs/2026-05-14-session-observer-design.md` (referenced source-of-truth spec)
- Code under `skills/session-observer/` and `tests/session-observer/`

### Shippable-state criteria

| Criterion | Status | Notes |
| --- | --- | --- |
| 1. Verification suite green | met | `npm test` 269/269, `npm run validate` ok, `npm run smoke` ok. |
| 2. No Stoa runtime dep / no network / no transcript writes | met | `grep -rE "(require\|import).*stoa\|fetch\(\|http\.\|https\.\|net\.\|axios" skills/session-observer/` returns nothing. The only `writeFile` paths target `STATE_DIR` (`state.json`, backup files, `codex-cwd-cache.json`). No write touches `~/.claude/projects/**`, `~/.codex/sessions/**`, or `~/.cursor/**`. |
| 3. Three-runtime contract consistency | met (with note) | All three adapters share `[Name] truncated-args` (`runtimes.mjs:409`, `:516`, `:575`) and 200/500-char truncation (`TOOL_INPUT_LIMIT = 200`, `TOOL_RESULT_LIMIT = 500`). Tool-result rendering with `[Name → result] body` is present for Claude (`runtimes.mjs:428`); Codex and Cursor do not emit a `tool_result` kind because their JSONL shapes don't expose tool outputs through the same record (Codex `function_call_output` is separate; Cursor agent transcripts observed don't include results). The asymmetry is structural to the upstream formats, not a divergence — `digest.mjs` accounting handles `tool_results: 0` correctly for Codex/Cursor, and runtime-format reference documents this. Tolerant JSONL parsing is shared via `readRecords` and produces parity warn-and-skip / warn-and-drop behavior across all three (Cursor fixtures `malformed.jsonl` and `partial-tail.jsonl` confirm). |
| 4. Exit-code contract | met | `0/1/2/3/4` honored across `runReview`, `runCatchUp`, `runLocate`, `runState`. `--runtime auto` resolves via SESSION_OBSERVER_SELF + state-cwd preference + tier-population (`session-observer.mjs:141-178`). `--session` pinned override is applied **before** tie/no-match early returns in both `runReview` (`:327-372`) and `runCatchUp` (`:520-573`). `ambiguousRuntime` returns exit 3 when multiple runtimes have candidates without a state-cwd preference (`:294-306`). |
| 5. Path-encoding lossiness contained | met | `discoverClaudeCode` direct hits set `recordedCwd = targetCwd` directly (`locate.mjs:156`), not via lossy decode. `decodeCwdDirName` is restricted to fallback Tier B/C glob candidates. `discoverCursor` does the same (`locate.mjs:480`). `rank.tierOf` realpath-normalizes both sides (`rank.mjs:76-77`, prev1-t10). |
| 6. `state.mjs` correctness | met | Atomic temp+rename with `fsync` via `datasync()` (`state.mjs:194-200`). Both `load()` and `mutate()` acquire the lock; load-time backup writes happen inside the lock (`:234-244`, prev1-t13). Migration is persisted via the normal `writeState()` inside `mutate()` (`:172-184`, p07-t04). Backup files use `state.json.<label>-<timestamp>-<pid>.bak` so repeat migration/corruption never clobbers (`:60-62`). Schema v1 is reachable: `emptyState()` and `migrateIfNeeded` both write `schemaVersion: 1`. |
| 7. Test coverage parity across runtimes | met | Cursor has `typical.jsonl`, `with-tool-use.jsonl`, `malformed.jsonl`, `partial-tail.jsonl` (prev1-t07). Cursor digest smoke test exists (`tests/session-observer/digest.test.mjs`, prev1-t12). Cursor locate fallback test exists (prev1-t08). Cursor parity with Claude/Codex tolerance fixtures is complete. |
| 8. SKILL.md frontmatter | met | `name: session-observer`, `license: MIT`, `compatibility: ...`, `metadata.version: "1.0.0"` (semver). Body is 352 lines — well under the 500-line / 5K-token Agent Skills cap. `scripts/validate.mjs` accepts it (`npm run validate` passes). |
| 9. Skill-distribution layout | met | Canonical copy at `skills/session-observer/`. `.agents/skills/session-observer` is a symlink to `../../skills/session-observer` (verified via `readlink`). Tests resolve the CLI via `fileURLToPath(new URL(..., import.meta.url))` (`tests/session-observer/cli.test.mjs:13-17`, `integration.test.mjs:12-22`). `probe-local.mjs` resolves the sibling CLI the same way (`probe-local.mjs:41`). No bare `scripts/...` relative paths in SKILL.md examples — they use `skills/session-observer/scripts/...` (`SKILL.md:201-336`). |
| 10. Documentation accuracy | met | SKILL.md describes the three runtimes, the four implemented subcommands, the four flag matrix, and exit-code handling. Watch mode is clearly labeled as designed-only (`SKILL.md:44`). `references/watch-design.md` is preserved as the v2 design. `references/transcript-formats.md` documents Cursor agent-transcript shape and explicitly defers SQLite chat-history (`transcript-formats.md:265`). |
| 11. OAT artifacts consistency | met (with note) | `plan.md` Reviews table shows the full lifecycle (p01..p07 passed; p-rev1 passed; final fixes_completed → this review). `implementation.md` reflects 32/32 tasks complete and documents the skill-relocation deviation row. `state.md` shows `oat_phase_status: complete` and lists every revision task. Minor note: `design.md` was not refreshed for the Cursor revision (no Cursor mentions); that is by-convention for the p-rev1 in-place revision approach (Cursor expansion is captured in plan.md's p-rev1 section and in the source-of-truth-relative documents `SKILL.md` and `references/transcript-formats.md`), so this is acceptable per the project's documented "design.md is lightweight; plan.md drives revisions" approach. Not raised as a finding. |

### Drift-from-original-spec check

The source-of-truth spec lists Cursor as out-of-scope for v1 (`.superpowers/specs/2026-05-14-session-observer-design.md:603`). The `p-rev1` revision deliberately added Cursor support. The expansion is documented:
- `plan.md` Phase `p-rev1` (lines 921+) introduces the revision with explicit scope notes.
- `implementation.md` "Revision received" log entry (2026-05-21) captures the user request and the local-spike evidence.
- `SKILL.md` body lists Cursor in `When to Use`, the `--runtime` flag matrix, troubleshooting, and probe-local examples (`SKILL.md:29, 67, 257-263, 333-336`).
- `references/transcript-formats.md` adds a Cursor section (`:246-282`) and documents the SQLite store as out-of-scope.

No silent expansion in the user-facing contract. The skill-level documentation accurately reflects three-runtime support; the only artifact that doesn't mention Cursor is the lightweight OAT `design.md`, which is acceptable under the project's convention that revisions update plan/implementation rather than retrofitting design.md.

### Requirements Coverage

| Area | Status | Notes |
| --- | --- | --- |
| `review` subcommand | implemented | `runReview` (`session-observer.mjs:279-468`); covered by `cli.test.mjs` + `integration.test.mjs`. |
| `catch-up` subcommand | implemented | `runCatchUp` (`:474-660`); high-water mark exclusive (`nextIndex`); no-op skip via `shouldMarkCatchUpRead` (prev1-t11). |
| `locate` subcommand | implemented | `runLocate` (`:666-810`); supports per-runtime and `auto`; `--debug` adds `lookupDiagnostics.claudeCode`. |
| `state` subcommand | implemented | `runState` (`:816-902`); `get`, `reset --runtime`, `reset --session`, `clear`. |
| `watch` subcommand | not in scope for v1 | Designed-only in `references/watch-design.md`, intentionally deferred. |
| `--runtime auto` resolution | implemented | env hint + state-cwd preference + tier-population (`:141-178`). |
| `--session` pinned override | implemented | Applied before tie/no-match (`:327-372`, `:520-573`); validation includes runtime allowlist (`parsePinnedSession`). |
| Tool-marker format `[Name] truncated-args` / `[Name → result] body` | implemented | `runtimes.mjs:409, 428, 516, 575`. 200/500-char truncation. |
| Tool-call filtering (default off; opt-in via `--include-tools` / `--debug`) | implemented | `normalizeEntries` honors all three flags including `includeCommandMessages`. |
| Codex `payload.cwd` extraction | implemented | `runtimes.mjs:349-352` (p07-t01). |
| Tier B bidirectional path match | implemented | `rank.mjs:80-81` (p07-t03). |
| `state.mjs` lock + atomic temp+rename | implemented | `state.mjs:68-92, 254-267`. |
| `state.mjs` migration persists to disk | implemented | `migrateIfNeeded` + `writeState` inside `mutate` (p07-t04). |
| `state.mjs` unique atomic backup filenames | implemented | `bakPath()` returns `state.json.<label>-<ts>-<pid>.bak` (`:60-62`). |
| `load()` locking for backup writes | implemented | `load()` acquires the lock (`:234-244`, prev1-t13). |
| No Stoa runtime dependency | met | No `stoa`/`Stoa` imports. |
| No network calls | met | No `fetch`/`http`/`https`/`net`/`axios` references. |
| Transcripts read-only | met | All `writeFile` calls target `STATE_DIR`; transcript paths are read via `readFile` only. |
| Three-runtime test parity | met | Cursor fixtures match Claude/Codex tolerance fixture set. |
| SKILL.md ≤ 500 lines | met | 352 lines. |

### Extra Work (not in declared requirements)

None observed beyond what is captured in revisions. The `p-rev1` Cursor expansion and dogfood hardening are tracked in `plan.md` and `implementation.md` as a deliberate revision; the `--snippet`, `--mark-read`, `--include-command-messages`, and auto-large-digest behaviors are all from `prev1-t01` and documented in SKILL.md.

## Verification Commands

Reproduce the review's verification suite:

```bash
npm test                                                    # 269 tests, 0 fail
npm run validate                                            # validation passed
npm run smoke                                               # smoke passed
node skills/session-observer/scripts/probe-local.mjs --runtime claude-code --cwd "$PWD"   # exit 0 expected here (active transcript)
node skills/session-observer/scripts/probe-local.mjs --runtime codex       --cwd "$PWD"   # exit 0 or 2 (worktree-dependent)
node skills/session-observer/scripts/probe-local.mjs --runtime cursor      --cwd "$PWD"   # exit 0 or 2 (worktree-dependent)

# Optional Minor-finding cleanup verification:
grep -nE "\b(join|dirname)\b" skills/session-observer/scripts/probe-local.mjs   # should be empty after the import is removed
```

## Verdict

**pass.** Zero Critical, zero Important findings. One trivial Minor (unused imports) plus one accept-deferred Minor (`m1` carry-over) — neither blocks merge.

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert the optional unused-import Minor into a follow-up task (or close it inline as a self-fix), then update `plan.md` Reviews table: set `final | code | passed`. After that, `oat-project-pr-final` is unblocked.
