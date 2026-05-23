---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-05-22
oat_generated: true
oat_summary_last_task: prev1-t13
oat_summary_revision_count: 1
oat_summary_includes_revisions: [p-rev1]
---

# Summary: session-observer

## Overview

The user often runs Claude Code and Codex (and later Cursor) in the same project tree but separate terminals, and there was no way for either agent to inspect what the *other* one had just done in the active project. `session-observer` is the user-installable Agent Skill that closes that gap: from inside any of the three runtimes, the agent can locate the peer's transcript for the current cwd, render a tool-free conversation digest, comment on it, and track per-runtime read offsets so follow-up "check again" requests only surface what's new.

## What Was Implemented

A standalone Agent Skill at `skills/session-observer/` (canonical distribution copy, with `.agents/skills/session-observer` symlinked for in-repo OAT/provider use) that ships four CLI subcommands:

- **`review`** — one-shot tool-free digest of the most relevant peer session for the current cwd.
- **`catch-up`** — incremental digest of only the records added since the last check, via a per-`(runtime, sessionId)` high-water mark.
- **`locate`** — JSON-formatted ranked candidate list (used both as a diagnostic and as the input to the SKILL.md disambiguation flow).
- **`state`** — manage the read-offset store (`get` / `reset --runtime` / `reset --session` / `clear`).

The implementation is Node ≥ 22 ESM with Node-standard-library only — no third-party runtime dependencies, no network calls, transcripts are strictly read-only. State persists under `~/.local/state/session-observer/` with atomic temp+rename writes and exclusive-create file locking on every mutation path.

Three transcript runtimes are supported: Claude Code (`~/.claude/projects/<encoded-cwd>/*.jsonl`), Codex (`~/.codex/sessions/**/*.jsonl`, with `payload.cwd` extraction from session-meta records), and Cursor (`~/.cursor/projects/<encoded-cwd>/agent-transcripts/*/*.jsonl`). The per-runtime adapter in `scripts/lib/runtimes.mjs` normalizes each format into a shared `DigestEntry` shape; tool calls and tool results are excluded by default, with `--include-tools` and `--debug` flags opting them in via the spec's `[ToolName] truncated-args` / `[ToolName → result] truncated-output` marker contract (200 / 500 char caps).

A continuous `watch` mode is fully designed in `references/watch-design.md` (poll cadence, debounce, `watch-ctl` control surface, singleton enforcement, safety rules) but intentionally **not implemented in v1** — the implementation is sequenced for v2 so the simpler `review` / `catch-up` modes can be used and refined first.

Test coverage is a 269-test suite under `tests/session-observer/` covering all three runtimes' parsing (typical, malformed, partial-tail, with-tool-use), locate/rank tier logic (Tier A exact-cwd, Tier B bidirectional descendant, no-match widening), digest rendering and slicing, CLI exit-code contract, end-to-end integration tests, state-module atomicity and lock contention.

## Key Decisions

- **Distribution layout.** The skill lives in `skills/session-observer/` (the README's distribution home for standalone skills) rather than `.agents/skills/` (which the README defines as project-management infrastructure, not consumer-facing). A symlink at `.agents/skills/session-observer` preserves in-repo OAT/provider discovery without splitting the canonical source.
- **State keyed by `${runtime}:${sessionId}`.** Not by cwd — sessions can survive mid-session cwd moves and transcript-path rotation, and the runtime + session-id pair is the most stable joint identifier. Re-ranking each turn is cheap; no `currentByCwd` pointer needed.
- **Tier-based deterministic ranking.** Lexicographic tiers (A = exact cwd, B = bidirectional path-prefix, no-match = explicit widening ask) instead of a weighted score. More predictable, easier to test, no magic constants beyond `TIE_WINDOW_SEC = 5` and `ACTIVE_THRESHOLD_SEC = 60`. When no candidate matches, the CLI explicitly asks the user how to widen (sister git worktrees → specific cwd → global-most-recent) rather than auto-falling-through.
- **Tool markers excluded by default.** The default digest is natural-language only; `--include-tools` adds compact `[Name] args` markers; `--debug` adds both calls and `[Name → result] body`. Receiving agents are spared the noise of `tool_result` blocks they don't need.
- **`--session` pinned override applied before tie/no-match returns.** The CLI's documented exit-3 / exit-2 recovery path (re-invoke with `--session <runtime>:<id>`) actually works because pinned-session resolution runs *before* ranking ambiguity early-returns in both `runReview` and `runCatchUp`.
- **No Stoa runtime dependency.** Stoa's existing transcript adapters at `apps/server/src/client/adapters/{claude-code,codex}.ts` were the parsing-logic reference, but the skill operates independently — it works on a machine that has never installed Stoa.

## Design Deltas

| Task | Planned | Actual | Reason |
| --- | --- | --- | --- |
| p02-t02 | Tool markers as `[Tool] args` / `[Tool → result] output` per the design's placeholder | `[Name] args` / `[Name → result] output` with `toolName` set on tool_result entries; added a first-pass `tool_use_id → name` correlation map in `normalizeClaudeCode` | The design's `[Tool]` was a tool-name placeholder; the actual contract puts the tool name in the brackets. p02 phase-gate review caught this as Critical; fixed in `b4b3bd0`. |
| p07-t04 | Backup filenames at `state.v0.json.bak` | `state.json.v0-<ts>-<pid>.bak` | Unique filenames so repeat migrations/corruptions can't clobber a prior backup. |
| Parallel group `[p04, p05]` | Run concurrently in worktrees | Degraded to sequential on the orchestration branch | `oat-worktree-bootstrap-auto` requires a `pnpm run worktree:init` script this npm-only repo lacks. Write-sets were disjoint (p04 → `scripts/` + `tests/`, p05 → SKILL.md body + `references/`), so sequential execution was correct — only wall-clock parallelism was lost. |
| Post-implementation relocation | Skill at `.agents/skills/session-observer/` per the create-agnostic-skill convention | Relocated to `skills/session-observer/` with `.agents/skills/session-observer` symlinked back | This repo's README designates `skills/` as the standalone-skill distribution home and `.agents/` as non-consumer tooling; `scripts/validate.mjs` only scans `skills/`. SKILL.md frontmatter gained `license` / `compatibility` / `metadata.version` to satisfy the validator's contract. |
| Revision 1 (`p-rev1`) | Out-of-scope per the original spec (Cursor) | Cursor adapter added as a third runtime alongside Claude Code and Codex; transcript-formats reference documents Cursor's project-slug encoding and `agent-transcripts/*/*.jsonl` shape | Dogfooding revealed Cursor was a frequent third terminal alongside Claude and Codex. Cursor's SQLite chat history at `~/.cursor/chats/*/store.db` is **explicitly deferred** — the agent-transcripts JSONL is what the skill consumes. |

## Notable Challenges

- **Claude Code's project-dir encoding is lossy in reverse.** `/` and `.` both collapse to `-`, so decoding a project dir name back to a cwd is ambiguous. The skill handles this by always preferring the **forward encode** (cwd → dir name) for direct lookup — that path is lossless, and any transcript found in the resulting dir is a guaranteed exact match (`recordedCwd` is set to `targetCwd` directly, not to an approximate decode). Only the fallback-glob path uses the approximate decode, and rank's bidirectional Tier B + realpath normalization (added in `prev1-t10`) absorbs the remaining ambiguity for symlinked or descendant cwds.
- **Codex `payload.cwd` not in the original spec sample.** The original final review surfaced a Critical: current Codex `session_meta` records carry `cwd` under `payload`, but the v1 `extractMeta` only read top-level `record.cwd`. Codex transcripts were resolving `recordedCwd: null` → silent `noMatch`. Fixed in `p07-t01` (read `payload.cwd` fallback) + `prev1-t09` (cache `sessionId` alongside `recordedCwd` so subsequent calls don't re-parse).

## Tradeoffs Made

- **Watch mode designed-only in v1.** Cheap to ship the simpler modes first, see how `check again` is actually used, and let those ergonomics inform the watcher's CLI shape. The watcher reference doc commits the leading hypothesis (poll-not-`fs.watch`, debounce, `watch-ctl` control surface, singleton enforcement, no SIGUSR1, no `--notify`) so v2 doesn't start from scratch.
- **No automatic state mutation on failure.** A failed `catch-up` does **not** advance the offset; the user can always re-run. Trades a tiny risk of a near-no-op re-emit for a clear "retry is always safe" invariant.
- **Cycle-3 convergence accepted at p-rev1.** The p-rev1 scope hit the 3-cycle review cap, but with a clean PASS verdict (zero blocking findings) — the cap exists to prevent runaway fix-loops, not convergence at the third look. The lone deferred Minor (`tierOf` realpath per-candidate cost) is accept-deferred with rationale.

## Integration Notes

- The skill is invoked via natural-language triggers (`check Codex`, `review the other terminal`, `what do you think of what was just said?`, `check again`) or directly with the CLI by its skill-relative path. SKILL.md routing turns those into the appropriate CLI subcommand; per-host disambiguation (`AskUserQuestion` on Claude Code, structured input where available on Codex, conversational fallback otherwise) handles ambiguous mode / runtime / candidate selection.
- State at `~/.local/state/session-observer/` is per-user, per-machine. There is no cross-machine sync; the `(runtime, sessionId)` high-water mark is a local progress marker only.
- For other skills that want to capture session content into Stoa or a vault, this skill is intentionally **not** the entry point — it's read-only and stateless from Stoa's perspective. The natural composition is: this skill provides the digest; downstream skills (e.g. `stoa-capture`) decide whether to write any of it.

## Revision History

- **`p-rev1` (2026-05-21..2026-05-22, 13 tasks).** Two-track revision: dogfood hardening (`prev1-t01`) addressing real friction that surfaced while using the v1 skill against real local transcripts, plus a four-task Cursor-runtime expansion (`prev1-t02`..`t05`: adapter, discovery, CLI wiring, docs/validation/install refresh). An eight-task receive-cycle (`prev1-t06`..`t13`) addressed the seven Minor findings from the independent second-look review (pinned-session ordering, Cursor fixture parity, empty-direct fallback documentation, duplicate-stat optimization, realpath/symlink normalization in `tierOf`, no-op `catch-up` lock guard, Cursor digest smoke) plus a bonus `load()` lock-residual hardening. Three review cycles total for `p-rev1`, converging on a clean PASS at cycle 3.

## Follow-up Items

- **`m1` — `tierOf` realpath per-candidate cost** (`skills/session-observer/scripts/lib/rank.mjs:73-83`). `tierOf` calls `normalizeCwdPath(targetCwd)` once per candidate even though `targetCwd` is identical across the `rank()` invocation. Unmeasurable for typical batches; only matters on slow filesystems with many fallback candidates. **Accept-deferred** by both the p-rev1 reviewer and the final-scope reviewer. Trivial memoization at the `rank()` boundary if a future profile surfaces a regression.
- **Continuous `watch` mode (designed, not implemented).** v2 work; design frozen in `references/watch-design.md`.
- **Cursor SQLite chat history.** Out of scope for v1 (and p-rev1). The skill currently inspects only the JSONL agent transcripts under `~/.cursor/projects/<encoded-cwd>/agent-transcripts/`.
- **Cursor / Gemini CLI runtime adapters.** Cursor was added in `p-rev1`. Gemini CLI is not yet supported — additive when needed; the `runtimes.mjs` switch is the only file that needs to change.

## Associated Issues

None — this project did not have a tracked Linear / GitHub issue.
