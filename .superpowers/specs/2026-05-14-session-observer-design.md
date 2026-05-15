# session-observer — Design Spec

**Status:** design approved, pending implementation plan
**Date:** 2026-05-14
**Skill home:** `.agents/skills/session-observer/` (Agent Skills open standard, portable across Claude Code, Cursor, Codex, Gemini CLI, and other compatible agents)
**Reference baseline:** `create-agnostic-skill` (Stoa, read-only); Stoa transcript adapters at `/Users/thomas.stang/Code/stoa/apps/server/src/client/adapters/{claude-code,codex}.ts` (read-only port source)

---

## 1. Overview

A bidirectional, user-installable skill that lets either Claude Code or Codex locate the *other* runtime's current or most recent session for the active project, render a tool-free conversation digest, comment on it, and track per-runtime read offsets so follow-ups (`check again`) only surface new content.

**Three working modes ship in v1:**

| Mode | Subcommand | Purpose |
|---|---|---|
| Review | `review` | One-shot full digest of the most relevant peer session |
| Catch up | `catch-up` | Incremental: only records added since the last read |
| Locate | `locate` | Diagnostic: ranked candidate list as JSON |

A fourth mode — continuous **watch** — is fully designed in `references/watch-design.md` but **not implemented in v1**. Locking the design now keeps v2 implementation cheap.

**Non-goals (explicit):**
- No Stoa runtime dependency. Stoa is the reference for parsing logic only; the skill works on a machine that has never installed Stoa.
- No network calls. Strictly local file I/O.
- No writes to transcripts. The skill is read-only against `~/.claude/projects/**` and `~/.codex/sessions/**`.
- No memory/vault writes from the skill itself (those belong in Stoa-aware skills like `stoa-capture`).

---

## 2. Skill anatomy

**Directory layout** at `.agents/skills/session-observer/`:

```
SKILL.md
scripts/
  session-observer.mjs              # CLI entrypoint, subcommand dispatch only
  probe-local.mjs                   # opt-in helper for manual local verification
  lib/
    runtimes.mjs                    # claude-code + codex record normalization
    digest.mjs                      # entry extraction, filtering, markdown render
    rank.mjs                        # tier-based ranking
    locate.mjs                      # candidate discovery + cwd extraction + git worktrees
    state.mjs                       # XDG state I/O with locking
references/
  watch-design.md                   # design-only spec for the continuous monitor
  transcript-formats.md             # short reference: Claude/Codex JSONL record shapes
```

Tests live at top-level `tests/session-observer/**/*.test.mjs` so `npm test` (which is `node --test`) discovers them automatically. Fixtures sit under `tests/session-observer/fixtures/`.

**SKILL.md frontmatter** (Agent Skills spec + Claude Code extensions, per `create-agnostic-skill`):

```yaml
---
name: session-observer
version: 1.0.0
description: Use when checking what the other coding agent (Claude Code or Codex) just did in this project, reviewing a peer session, or catching up on new messages. Locates the active transcript, renders a tool-free digest, and tracks per-runtime read offsets.
argument-hint: '[review|catch-up|locate|state] [--runtime <claude-code|codex|auto>] [--debug]'
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read, AskUserQuestion
---
```

Notes:
- `disable-model-invocation: false` so natural-language triggers can route without `/session-observer`.
- Description leads with "Use when…", front-loads trigger keywords, ~340 chars (under the 500-char cap).
- `allowed-tools` is intentionally minimal — Bash for the CLI, Read for ad-hoc inspection, AskUserQuestion for ambiguous-selection branches.

**SKILL.md body sections** (in the order create-agnostic-skill requires):
1. Title + one-line purpose
2. When to Use / When NOT to Use
3. Arguments (CLI subcommand + flags)
4. Workflow (Step 1: clarify if needed; Step 2: run CLI; Step 3: present digest + commentary; Step 4: catch-up bookkeeping)
5. Examples (Basic Usage + Conversational)
6. Troubleshooting
7. Success Criteria

---

## 3. Mode dispatch & trigger phrases

**CLI subcommand surface:**

| Subcommand | Purpose | Default behavior |
|---|---|---|
| `review` | One-shot full digest | Renders entire conversation. Does **not** advance the high-water mark unless `--mark-read` is passed. |
| `catch-up` | Incremental delta | Renders entries since the stored offset for that `(runtime, sessionId)`. Advances the high-water mark on successful emit. |
| `locate` | Diagnostic | Prints ranked candidate list as JSON. No state change. |
| `state` | Manage high-water marks | Sub-ops: `get`, `reset`, `clear`. |

**All subcommands accept:**
- `--runtime <claude-code|codex|auto>` (default `auto`)
- `--cwd <path>` (default `process.cwd()`)
- `--include-tools` — add `tool_call` entries (compact markers)
- `--debug` — shorthand for `--include-tools --include-tool-results`
- `--json` — machine-readable output (default is markdown)
- `--max-turns N` / `--max-bytes N` — slice from the tail (review only)

**Default content filter:** natural-language user/assistant messages only. Tool calls and tool results are **excluded by default**. The agent must opt in via `--include-tools` (compact markers) or `--debug` (markers + truncated results).

**Natural-language → subcommand routing** (lives in SKILL.md as a small table):

| Trigger phrase | Subcommand |
|---|---|
| `check Codex` / `review the other terminal` / `summarize Codex's session` | `review --runtime codex` |
| `check Claude` / `check what Claude said` | `review --runtime claude-code` |
| `check again` / `anything new?` | `catch-up` (auto runtime) |
| `what do you think of what was just said?` | `catch-up` (auto runtime), then comment |
| `get up to speed` / `start watching this session` | `review` once, `catch-up` thereafter |
| `which sessions are available?` / `find the session` | `locate` |
| `reset / start over watching Codex` | `state reset --runtime codex` then `review` |

**Step 1 clarification rules** (executed before running any CLI; portable across hosts via natural-language prose, with Claude Code's `AskUserQuestion` as a structured-UI option):

1. **Mode ambiguous** (`"can you check?"` with no verb hint) → ask: *"Full review of the session, or just what's new since last time?"*
2. **Runtime ambiguous** (no Claude/Codex mention) → default `--runtime auto`. Only ask if `auto` resolves to a runtime with no candidates for this cwd.
3. **Ties within winning tier** (two candidates within `TIE_WINDOW_SEC = 5s` of each other) → present the top candidates, ask which to use, re-invoke with `--session <runtime>:<id>`.
4. **No candidates in this cwd** → run the Tier-C escalation (Section 4).

---

## 4. Transcript ranking algorithm

**Goal:** given `(cwd, runtime)`, pick the single most relevant transcript. Return others as fallbacks. Deterministic given file-system state.

**Per-runtime discovery:**

| Runtime | Discovery | cwd derivation |
|---|---|---|
| `claude-code` | Encoding cwd as the project dir name (`/` → `-`) gives a direct lookup under `~/.claude/projects/<encoded>/`. Fall back to globbing `~/.claude/projects/*/*.jsonl`. | Decode dir name. No transcript read needed. |
| `codex` | Glob `~/.codex/sessions/**/*.jsonl`, filtered to files with `mtime` in the last `LOOKBACK_DAYS = 7`. | Read first ~5 records, extract `cwd` from the session-meta record. Cache result keyed by `(path, mtime)` at `~/.local/state/session-observer/codex-cwd-cache.json`. |

**Candidate metadata** (one per file):

```jsonc
{
  "runtime": "claude-code" | "codex",
  "transcriptPath": "/Users/.../session-id.jsonl",
  "sessionId": "<from first record with an ID, else basename>",
  "recordedCwd": "/Users/.../Code/foo",   // null if undeterminable
  "mtime": 1715600000,                     // epoch seconds
  "size": 84231,                           // bytes
  "ageSec": 42
}
```

**Tiered ranking** (lexicographic, predictable):

1. **Tier A — exact cwd match.** `realpath(recordedCwd) === realpath(targetCwd)`. If any Tier-A candidate exists, drop the rest.
2. **Tier B — descendant cwd match.** Either side is a path-prefix of the other (handles `cd subdir` mid-session). Considered only if Tier A is empty.
3. **No match.** Do **not** auto-fall-through. Return `{ winner: null, noMatch: true, sisters, globalRecent }`. The SKILL.md asks the user how to widen:
   - **Sister git worktrees** *(default offer)* — from `git -C <cwd> worktree list --porcelain`. Re-rank within each sister.
   - **A specific cwd** — user names it; re-rank there.
   - **Global most-recent** — bypass cwd filtering; sorted by mtime; flagged `unrelated: true` so the agent's commentary qualifies it.
   - If not in a git repo, drop the sister-worktree option.

Within a kept tier, sort by `mtime DESC`. The top one wins.

**Tie detection:** candidates within the winning tier whose mtimes are within `TIE_WINDOW_SEC = 5s` of the winner. Returned as `ties[]` so the SKILL.md can ask.

**Active flag** (separate from rank): if `winner.ageSec < ACTIVE_THRESHOLD_SEC = 60`, the digest is marked `active: true` so commentary can phrase itself as "mid-turn" vs "stale."

**Pseudocode** (in `scripts/lib/rank.mjs`):

```
rank(candidates, targetCwd, { tieWindowSec = 5 }):
  for c in candidates: c.tier = tierOf(c, targetCwd)    // A | B | C
  if any tier A: keep only tier A; rank(); return winner + fallbacks
  elif any tier B: keep only tier B; rank(); return winner + fallbacks
  else:
    sisters = gitWorktrees(targetCwd)                    // [] if not in a repo
    globalRecent = top-5 candidates by mtime, all cwds
    return { winner: null, noMatch: true, sisters, globalRecent }
```

---

## 5. Digest schema

**Versioned (`schemaVersion: 1`).** Emitted as markdown by default, JSON with `--json`.

**JSON shape:**

```jsonc
{
  "schemaVersion": 1,
  "runtime": "claude-code" | "codex",
  "sessionId": "abc12345…",
  "transcriptPath": "/Users/.../*.jsonl",
  "recordedCwd": "/Users/.../Code/foo",
  "matchedTier": "A" | "B",
  "widenedFrom": null,                // set to original cwd when result came from a widened search
  "active": true,
  "mode": "review" | "catch-up" | "locate",
  "range": {
    "fromIndex": 47,
    "toIndex": 53,
    "totalRecords": 53,
    "newRecords": 6                   // catch-up only
  },
  "entries": [
    { "role": "user", "text": "…", "recordIndex": 47, "kind": "message" },
    { "role": "assistant", "text": "…", "recordIndex": 48, "kind": "message" },
    { "role": "assistant", "text": "[Edit] {\"file_path\":\"src/foo.ts\",\"old_str…",
      "recordIndex": 49, "kind": "tool_call", "toolName": "Edit" },
    { "role": "assistant", "text": "[Edit → result] applied 1 edit to src/foo.ts",
      "recordIndex": 50, "kind": "tool_result", "toolName": "Edit" }
  ],
  "filters": { "includeToolCalls": false, "includeToolResults": false },
  "warnings": [],
  "fallbacks": [ /* up to 4 other candidates from rank */ ]
}
```

**Entry-kind inclusion rules:**

| Kind | Default | `--include-tools` | `--debug` |
|---|---|---|---|
| `message` (natural-language user/assistant) | included | included | included |
| `tool_call` (`[ToolName] truncated-args`, 200 chars) | excluded | included | included |
| `tool_result` (`[ToolName → result] truncated-output`, 500 chars) | excluded | excluded | included |

`--include-tool-results` without `--include-tools` is allowed but emits a friendly note ("you probably want `--debug`").

**Markdown rendering:**

```
# session-observer • codex session abc123de
- cwd: /Users/.../Code/foo
- transcript: ~/.codex/sessions/2026/05/14/session-abc123de.jsonl
- age: 18s (active)
- mode: catch-up · records 48–53 of 53 (6 new)
- filters: tool calls excluded · tool results excluded

### User

Can you check the build?

### Assistant

Tests passed. Want me to commit?
```

Consecutive same-role entries are grouped under one `### User` / `### Assistant` header — matches the Stoa adapter's output shape (so the rendering primitive can be ported directly from `apps/server/src/client/adapters/*.ts`).

**Size handling:**
- No hard cap by default.
- If rendered output exceeds 20K characters, prepend a warning header (`> ⚠️ digest is 23K chars; consider --max-turns or --no-tools-equivalent flags`).
- `--max-turns N` and `--max-bytes N` slice from the tail (most-recent kept). `review` only; `catch-up` ignores them.

**Truncation rules** (lifted from Stoa):
- Tool call args: 200 chars, ellipsized
- Tool result body: 500 chars, ellipsized
- User/assistant text: not truncated (would be lossy)

---

## 6. State / high-water-mark schema

**File:** `~/.local/state/session-observer/state.json` (created with `mkdir -p` on first write).

**Keyed by `${runtime}:${sessionId}`.** Reasoning: `sessionId` is the most stable identifier; transcript paths can change; a session is owned by one cwd at a time but cwd-keying breaks if the user moves between sister worktrees mid-session. Re-ranking per turn is cheap, so we don't need a separate `currentByCwd` pointer.

**Shape:**

```jsonc
{
  "schemaVersion": 1,
  "sessions": {
    "codex:abc12345…": {
      "runtime": "codex",
      "sessionId": "abc12345…",
      "lastRecordIndex": 53,
      "lastTotalRecords": 53,
      "lastReadAt": "2026-05-14T16:42:09Z",
      "transcriptPath": "/Users/.../session.jsonl",
      "recordedCwd": "/Users/.../Code/foo",
      "watchedByPid": null              // set when watch.mjs is running for this session
    },
    "claude-code:9d3c2…": { … }
  }
}
```

**Write protocol** (lifted from Stoa's `session-capture.sh.tpl`):

1. `mkdir -p ~/.local/state/session-observer`
2. Acquire `state.json.lock` with exclusive create (`open(..., 'wx')`). On `EEXIST`, sleep 50 ms and retry up to 100 times. Abort with clear error on exhaustion.
3. Read current `state.json` (treat missing/invalid as `{ schemaVersion: 1, sessions: {} }`; preserve the corrupt file as `state.json.corrupt-${ts}.bak`).
4. Apply mutation in memory.
5. Write to `state.json.${pid}.tmp`, `fsync`, then `rename` over `state.json`.
6. Remove lock in `finally`.

`catch-up` is the only routine writer; `review`/`locate`/`state get` don't touch state. `state reset` and `state clear` use the same lock.

**Shrink detection.** Before slicing from `lastRecordIndex`, count records in the live transcript. If `totalRecords < lastTotalRecords`, emit warning `"transcript shrank from N to M records; resetting offset to 0"`, reset offset to 0, and render as a full review (next catch-up resumes incremental).

**`watchedByPid` semantics** (for the future watcher):
- The running watcher sets this field on the active session entry and clears it on graceful shutdown.
- On watcher startup, any stale `watchedByPid` whose process no longer exists is cleared.
- `catch-up` **warns, not refuses**, when `watchedByPid` is non-null: "watcher pid X is also reading this session; offsets may interleave (this is benign)." No `--force` flag needed; the race advances the offset; the watcher's next tick sees no new records and idles.

**`state` subcommand operations:**

| Operation | Effect |
|---|---|
| `state get [--runtime <r>]` | Print state (markdown by default; `--json` for raw). |
| `state reset --runtime <r>` | Set `lastRecordIndex = 0` on every entry for that runtime. |
| `state reset --session <r>:<id>` | Reset one entry. |
| `state clear` | Truncate `sessions` to `{}`; preserve `schemaVersion`. |

**Schema migration.** On `schemaVersion` change, copy existing file to `state.v${old}.json.bak` before rewriting. v1 is the starting point.

**Privacy.** state.json contains transcript paths and cwds; no message content. SKILL.md Troubleshooting notes `rm -rf ~/.local/state/session-observer` as the nuke option.

---

## 7. Helper script responsibilities

Each file has one job. Node ESM, stdlib only.

**`scripts/session-observer.mjs`** (~80 lines) — argv parsing, validation, subcommand dispatch, output formatting (markdown vs JSON), exit codes.

```
exit codes:
  0  success or recoverable warning
  1  hard error (parse, exception, permission, lock-exhausted)
  2  no candidates found (Tier C, before widening)
  3  ambiguous selection (tie within tier, or ambiguous runtime)
  4  schema/version mismatch (unrecoverable)
```

**`scripts/lib/runtimes.mjs`** (~150 lines) — per-runtime record normalization. Ported from Stoa adapters.

```
discoverPaths(runtime): string[]               // ~/.claude/projects/  |  ~/.codex/sessions/
encodeCwd(runtime, cwd): string | null         // claude-code: / → -; codex: null
extractMeta(runtime, transcriptPath): { sessionId, recordedCwd } | null
readRecords(transcriptPath): JsonObject[]      // tolerant of partial trailing line
normalizeEntries(runtime, records, { includeToolCalls, includeToolResults }): DigestEntry[]
```

`runtimes.mjs` is the only file with structural knowledge of Claude Code vs Codex transcripts. Adding a third runtime extends a switch in three functions; nothing else changes.

**`scripts/lib/locate.mjs`** (~60 lines) — candidate discovery.

```
discover(runtime, targetCwd): Candidate[]      // glob + stat + extractMeta + cwd cache
gitWorktrees(cwd): string[]                    // parse `git worktree list --porcelain`; [] on failure
```

**`scripts/lib/rank.mjs`** (~80 lines) — tier-based ranking.

```
rank(candidates, targetCwd, { tieWindowSec = 5 }): RankResult
tierOf(candidate, targetCwd): 'A' | 'B' | 'C'
realpathSafe(p): string                        // ENOENT-safe
```

**`scripts/lib/digest.mjs`** (~120 lines) — entry extraction, filtering, rendering.

```
buildDigest(runtime, transcriptPath, opts): Digest
renderMarkdown(digest): string                 // header + grouped role blocks; 20K warning
renderJson(digest): string                     // JSON.stringify(digest, null, 2)
```

`review` and `catch-up` both call `buildDigest`; the only difference is the `fromIndex` they pass.

**`scripts/lib/state.mjs`** (~120 lines) — XDG state I/O with locking.

```
load(): State
mutate(fn: State => State): State              // lock → load → fn → tmp → rename → unlock
getSession(runtime, sessionId): SessionState | null
markRead(runtime, sessionId, { lastRecordIndex, totalRecords, transcriptPath, recordedCwd }): void
resetByRuntime(runtime): number
resetBySession(runtime, sessionId): boolean
clear(): void
migrateIfNeeded(state): State                  // writes .bak before upgrade
```

`mutate` is the only write path. Eliminates "two writers stomped each other" by construction.

**End-to-end flow for `catch-up`:**

```
1. parse argv
2. resolve runtime (auto → other-runtime via env hint or tier-population fallback)
3. locate.discover(runtime, cwd) → candidates
4. rank.rank(candidates, cwd) → result
5. if noMatch: emit { noMatch, sisters, globalRecent } as JSON; exit 2
6. if ties: emit { ties } as JSON; exit 3
7. winner = result.winner
8. prior = state.getSession(winner.runtime, winner.sessionId)
9. fromIndex = prior?.lastRecordIndex ?? 0
10. digest = digest.buildDigest(winner.runtime, winner.transcriptPath,
                                { fromIndex, includeToolCalls, includeToolResults, … })
11. if digest.range.newRecords === 0: emit "no new records" header; exit 0
12. state.markRead(winner.runtime, winner.sessionId, { lastRecordIndex: totalRecords, … })
13. emit digest as markdown (or JSON)
```

Total runtime code estimate: ~600–700 lines of Node, plus SKILL.md (~250–350 lines) and references docs.

---

## 8. Failure modes & fallbacks

| # | Failure | Exit | CLI output | SKILL.md recovery |
|---|---|---|---|---|
| 1 | No candidates for runtime at all | 2 | `{ "noCandidates": true, "runtime": "codex", "reason": "..." }` | "I don't see any Codex history at all. Has it been used here?" |
| 2 | No candidates in this cwd (Tier C) | 2 | `{ "noMatch": true, "sisters": [...], "globalRecent": [...] }` | Ask whether to widen (sister worktree / specific cwd / global) |
| 3 | Ambiguous tier winner (ties) | 3 | `{ "ties": [c1, c2, ...] }` | Use AskUserQuestion / structured input / conversational ask; re-invoke with `--session <r>:<id>` |
| 4 | Transcript unreadable (EACCES, ENOENT) | 1 | `{ "error": "EACCES", "path": "..." }` | Surface to user; don't update state |
| 5 | Malformed JSONL line mid-file | 0 | warning `"skipped invalid record at line N"` | Pass-through; non-fatal |
| 6 | Trailing partial line (active write) | 0 | warning `"transcript truncated mid-line at byte N"` | Pass-through |
| 7 | Transcript shrank (totalRecords < last) | 0 | warning `"transcript shrank; offset reset"` | Tell user; offer re-run as `review` |
| 8 | State file corrupt (invalid JSON) | 0 | back up to `state.json.corrupt-${ts}.bak`, treat as empty | Brief mention in commentary |
| 9 | State lock exhausted | 1 | `{ "error": "EBUSY", "lockPath": "..." }` | Troubleshooting tip: `rm <lockPath>` if no live observer |
| 10 | State schema mismatch | 0 | auto-migrate; write `state.v${old}.json.bak` | Silent on success |
| 11 | Git unavailable / not in a repo (sub-case of #2) | 2 | Same noMatch payload as #2 but `sisters: []` | Drop sister-worktree option from the widening ask; offer only specific-cwd or global |
| 12 | Codex transcript has no extractable cwd | 0 | candidate enters with `recordedCwd: null` → Tier C | Falls through to widening |
| 13 | Very large transcript (>50MB) | 0 | warning `"transcript is 73MB; consider --max-turns"` | Agent may auto-rerun with `--max-turns` |
| 14 | Symlinked cwd | 0 | `realpath` both sides before comparison | Transparent |
| 15 | Auto-runtime can't resolve (both have candidates, no `--runtime`) | 3 | `{ "ambiguousRuntime": true, "claudeCandidate": {...}, "codexCandidate": {...} }` | Ask which runtime |

**Runtime auto-resolution rules** (covers #15):

1. If `SESSION_OBSERVER_SELF` env is set, `auto` targets the *other* runtime.
2. Else, if exactly one of `{claude-code, codex}` has a Tier-A/B candidate, pick it.
3. Else exit 3 with both candidates so the SKILL.md asks.

**Intentional non-behaviors:**
- No automatic state mutation on failure. A failed `catch-up` does not advance the offset.
- No retry on read errors. Single-shot.
- No transcript writes ever.
- No network calls ever.

---

## 9. Watcher (design-only, lives in `references/watch-design.md`)

**Status:** designed but not implemented in v1. Reference doc commits the leading hypothesis so v2 doesn't re-litigate.

**CLI shape:**

```
session-observer watch [--runtime <r>|both] [--cwd <p>] [--debounce-sec 2]
                       [--poll-sec 2] [--max-runtime-min 0]
                       [--event-log <path>] [--json]
```

Foreground process. Quits on SIGINT/SIGTERM. Stdout is human-readable event stream; `--event-log` mirrors events to a JSONL file for replay.

**Polling, not `fs.watch`.** Every `poll-sec` (default 2s) over both stores by mtime. Reasons: `fs.watch` recursive support is OS-specific (macOS quirks); the candidate set is small; stat is cheap.

**Polling pseudocode:**

```
loop:
  candidates = locate.discover(runtime)
  for c in candidates:
    if c.mtime > known[c.path]?.mtime:
      pending[c.path] = { firstSeenAt: now, lastSeenMtime: c.mtime }
    elif c.path in pending and now - pending[c.path].firstSeenAt >= debounceSec:
      emit(c)                                     // runs full locate→rank→catch-up→state.markRead
      pending.delete(c.path)
  read control-file if present and apply
  sleep poll-sec
```

**Debounce:** when a transcript's mtime first changes, hold for `debounce-sec` (default 2s). Further changes reset the timer. Only emit when the file has been quiet for `debounce-sec`. Avoids half-formed turns.

**Event emission** = same `locate → rank → digest → state.markRead` pipeline used by `catch-up`. No new parsing code; watch is a debounce-wrapped loop around catch-up.

**Watch state** at `~/.local/state/session-observer/watch.json`:

```jsonc
{
  "schemaVersion": 1,
  "active": {
    "pid": 12345,
    "runtime": "codex",
    "cwd": "/Users/.../Code/foo",
    "startedAt": "2026-05-14T16:42:09Z",
    "lastEventAt": "2026-05-14T16:48:11Z",
    "eventCount": 4
  }
}
```

Same locking + atomic-rename as `state.json`. Only one watcher per runtime; startup refuses if `active.pid` is a live process. Stale pids (no such process) are cleared on startup.

**Event-log JSONL** (one event per line; metadata only, no content):

```jsonc
{ "ts": "2026-05-14T16:48:11Z", "runtime": "codex", "sessionId": "abc…",
  "newRecords": 3, "digestChars": 482, "ranges": { "fromIndex": 47, "toIndex": 50 } }
```

Content stays in the rendered stdout digest. The log is for introspection and replay.

**Bidirectional:** `--runtime both` alternates the poll across both stores; each runtime has its own debounce timer and offset; one process, one watch entry.

**Control surface — no signals.** A control file at `~/.local/state/session-observer/watch.control.json` is read each poll tick. A sibling CLI verb writes intent:

```
session-observer watch-ctl flush       # force-emit pending now
session-observer watch-ctl pause       # stop emitting until resume
session-observer watch-ctl resume
session-observer watch-ctl status      # print active watch.json contents
session-observer watch-ctl stop        # SIGTERM the watcher pid
```

Reasoning over SIGUSR1: discoverable via `--help`, one mechanism for many actions, trivially scriptable and testable, latency ≤ poll-sec is acceptable.

**SIGTERM/SIGINT** still trigger graceful shutdown: clear `watchedByPid` in state.json, clear `active` in watch.json, delete `watch.control.json`.

**Future hook integration (post-v2, not v1):** wiring the watcher into Claude Code's `UserPromptSubmit` or a Codex equivalent so the host prompts the agent when fresh peer activity is available. Requires host-specific settings.json changes; out of scope for the watcher itself.

**Safety rules (binding even at design stage):**
- Read-only on transcripts.
- Writes only to `~/.local/state/session-observer/`.
- No memory/vault writes from the watcher. A future `--capture-notable` flag, if added, must be opt-in and must only write summarized findings, not per-event. v2 question.
- No network calls.

**Decisions locked (not open):**
- No SIGUSR1.
- No macOS notification center (`--notify`). The expected usage pattern is two terminals side-by-side; system notifications add noise.

---

## 10. Test plan

Tests at top-level `tests/session-observer/**/*.test.mjs`. `npm test` discovers them automatically (no script changes). Stdlib `node --test`. No new dependencies.

**Fixtures** (`tests/session-observer/fixtures/`):

```
claude-code/
  typical.jsonl              # 12 records, user/assistant alternation, one tool_use+tool_result
  with-tool-burst.jsonl      # heavy tool density for filter testing
  malformed.jsonl            # one invalid line in the middle
  partial-tail.jsonl         # truncated final line
  empty.jsonl
codex/
  typical.jsonl              # 12 records including session-meta with cwd
  with-function-calls.jsonl  # function_call records
  no-cwd-record.jsonl        # session-meta missing cwd
  malformed.jsonl
  partial-tail.jsonl
README.md
```

All fixtures hand-crafted, synthetic — no real user transcripts in the repo.

**Unit tests** (one `*.test.mjs` per lib module):

`runtimes.test.mjs` — claude-code + codex: readRecords parses typical, tolerates malformed and partial-tail (with warnings, no throw); normalizeEntries default drops tool_call and tool_result; with `--include-tools` renders `[Tool] args` truncated 200; with `--debug` renders results truncated 500; codex function_call records produce tool_call entries; extractMeta returns sessionId+cwd for typical, null cwd for no-cwd-record fixture.

`digest.test.mjs` — buildDigest with fromIndex 0 / N; renderMarkdown grouping; header includes filter line + active flag + range; 20K warning prepended when over threshold; `--max-turns` slices from tail.

`rank.test.mjs` — Tier A > B > noMatch; ties within window; mtime DESC within tier; `active: true` when ageSec < threshold; noMatch populates sisters (mocked gitWorktrees) and globalRecent.

`state.test.mjs` (temp STATE_DIR env override per test) — mutate creates state.json; atomic temp+rename (no lingering .tmp on success); lock contention (two parallel mutates serialize correctly); getSession returns null when missing; markRead updates fields; resetByRuntime / resetBySession / clear; migrateIfNeeded writes .bak when schemaVersion is older.

`locate.test.mjs` — claude-code encoded-dir direct lookup; full-projects fallback when encoded dir missing; codex LOOKBACK_DAYS filter; cwd cache hit on unchanged file (assert no transcript re-read); gitWorktrees parses --porcelain output from fixture string; `[]` when git exec fails.

`cli.test.mjs` — argv dispatch; exit codes 0/2/3; `--json` validates as JSON; `--runtime auto` resolution prefers populated runtime; otherwise exits 3 with `ambiguousRuntime`.

**Integration test** (`integration.test.mjs`):
- Build temp `HOME/.claude/projects/<encoded-cwd>/` with `typical.jsonl`.
- `STATE_DIR=<tmp>` `HOME=<tmp>`.
- `child_process.spawnSync('node', ['scripts/session-observer.mjs', 'review', '--runtime', 'claude-code', '--cwd', tempCwd])`.
- Assert: exit 0, header contains expected fields, body has both `### User` and `### Assistant` sections, no tool noise.
- Re-run as `catch-up`; first marks read; second reports "no new records."

**Local probe** (opt-in, not in `npm test`):

`scripts/probe-local.mjs --runtime claude-code --cwd "$PWD"` runs the real CLI against the user's real transcript store. Documented in SKILL.md troubleshooting as the "does this work on my machine?" verification.

**Not tested in v1:** watch mode (design-only); Stoa coupling (none); network paths (none).

**Repo plumbing:** confirm `scripts/validate.mjs` accepts the new skill manifest entry — done in the implementation phase.

---

## 11. Open items / out of scope

**In scope for v1:**
- `review`, `catch-up`, `locate`, `state` subcommands
- Both runtimes bidirectionally (Claude Code can read Codex; Codex can read Claude Code)
- State at `~/.local/state/session-observer/`
- Test plan above

**Out of scope for v1 (designed, deferred):**
- `watch` and `watch-ctl` subcommands — design frozen in `references/watch-design.md`
- Cursor / Gemini CLI runtime adapters
- Stoa-aware capture of notable findings
- Host hook integration (UserPromptSubmit etc.)

**Out of scope, no design yet:**
- Anything that writes back into peer transcripts
- Anything that posts notifications/messages outside the local machine

---

## 12. Acceptance criteria

A v1 implementation is done when:

- [ ] `.agents/skills/session-observer/SKILL.md` exists, frontmatter valid, version 1.0.0, description leads with "Use when…", ≤500 line / ~5K token body.
- [ ] `scripts/session-observer.mjs` and `scripts/lib/{runtimes,digest,rank,locate,state}.mjs` exist; ESM; stdlib only.
- [ ] `references/watch-design.md` and `references/transcript-formats.md` exist.
- [ ] All unit tests in `tests/session-observer/` pass under `npm test`.
- [ ] Integration test (synthetic fixtures, temp HOME) passes.
- [ ] `npm run validate` passes after adding the new skill to whatever the validator scans.
- [ ] `scripts/probe-local.mjs` returns a sensible digest against both real local Claude and Codex transcript stores (manual check, documented in SKILL.md troubleshooting).
- [ ] `oat sync` (if applicable for this repo) is run so provider views update.
- [ ] No Stoa runtime dependency; no network calls; no transcript writes; verified by code review.

---

## Source-of-truth references

- `create-agnostic-skill` at `/Users/thomas.stang/Code/stoa/.agents/skills/create-agnostic-skill/SKILL.md` — frontmatter & section conventions
- Stoa transcript adapters at `/Users/thomas.stang/Code/stoa/apps/server/src/client/adapters/{claude-code,codex}.ts` — record-normalization logic to port
- Stoa session-capture template at `/Users/thomas.stang/Code/stoa/apps/server/src/client/templates/claude-code-stoa-session-capture.sh.tpl` — atomic state-write protocol to mirror
- Stoa sweeper at `/Users/thomas.stang/Code/stoa/apps/server/src/client/templates/sweeper.sh.tpl` — multi-runtime mtime scan pattern
- Stoa hook-integration project summary at `/Users/thomas.stang/Code/stoa/.oat/repo/reference/project-summaries/20260419-stoa-hook-integration.md` — full background on per-runtime capability differences
