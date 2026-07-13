---
name: session-observer
description: Use when checking what another coding agent (Claude Code, Codex, or Cursor) just did in this project, reviewing a peer session, or catching up on new messages. Locates the active transcript, renders a tool-free digest, and tracks per-runtime read offsets.
license: MIT
compatibility: Agent Skills baseline; requires Node.js 22+. No third-party runtime dependencies.
argument-hint: '[review|catch-up|catch-up-then-watch|locate|whoami|state|watch|watch-ctl|--watch] [--runtime <claude-code|codex|cursor|auto|both>] [--debug]'
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read, AskUserQuestion
version: '1.0.5'
metadata:
  author: thomas.stang
  version: '1.0.5'
---

# session-observer

Lets you (Claude Code, Codex, or Cursor) inspect another runtime's transcript for the current project, render a tool-free digest, and track per-runtime read offsets so follow-up checks surface only new content.

---

## When to Use

Use this skill when any of the following applies:

| Trigger phrase                                                                              | What to run                                                            |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `check Codex` / `review the other terminal` / `summarize Codex's session`                   | `review --runtime codex`                                               |
| `check Claude` / `check what Claude said`                                                   | `review --runtime claude-code`                                         |
| `check Cursor` / `summarize Cursor's agent session`                                         | `review --runtime cursor`                                              |
| `check again` / `anything new?`                                                             | `catch-up` (auto runtime)                                              |
| `what do you think of what was just said?`                                                  | `catch-up`, then comment                                               |
| `get up to speed`                                                                           | `review` once, `catch-up` thereafter                                   |
| `start watching this session` / `keep watching Codex` / `respond when anything new appears` | `watch --runtime <peer> --until-stopped` or `--watch --runtime <peer>` |
| `catch up and watch Claude` / `catch up, then keep watching <peer>`                         | `catch-up-then-watch --runtime <peer> --until-stopped`                 |
| `which sessions are available?` / `find the session`                                        | `locate`                                                               |
| `reset / start over watching Codex`                                                         | `state reset --runtime codex`, then `review`                           |

**You are responsible for choosing the right subcommand.** When the trigger phrase is ambiguous (e.g. `"can you check?"`), ask the user: _"Full review of the session, or just what's new since last time?"_

---

## When NOT to Use

- When you already know what the peer did (skip the check).
- When you want to save findings to memory/vault (use `stoa-capture` instead — this skill is read-only).
- When you only need a one-time answer. Use `review` or `catch-up`; reserve `watch` for an active foreground monitoring session.
- When the target runtime is your own. Use `--runtime <peer>` or let `auto` resolve the peer.

---

## Arguments

### Subcommands

| Subcommand                     | Purpose                                              | State change                                              |
| ------------------------------ | ---------------------------------------------------- | --------------------------------------------------------- |
| `review`                       | Full digest from the start                           | None (unless `--mark-read` passed)                        |
| `catch-up`                     | Delta: records since last read                       | Advances high-water mark on success                       |
| `catch-up-then-watch`          | Emit unread backlog, then enter foreground watcher   | Advances high-water marks as backlog/deltas are consumed  |
| `locate`                       | Ranked candidate list (diagnostic)                   | None                                                      |
| `whoami`                       | Resolve this session's runtime/session/path identity | None; fails closed when identity is ambiguous             |
| `state get`                    | Print current state                                  | None                                                      |
| `state reset --runtime <r>`    | Reset all offsets for runtime                        | Zeroes `lastRecordIndex`                                  |
| `state reset --session <r:id>` | Reset one session                                    | Zeroes `lastRecordIndex`                                  |
| `state clear`                  | Clear all tracked sessions                           | Empties `sessions` map                                    |
| `watch`                        | Foreground watcher for debounced catch-up updates    | Advances high-water marks as emitted digests are consumed |
| `watch-ctl status`             | Print active watcher state                           | None                                                      |
| `watch-ctl pause`              | Pause event emission while polling continues         | Writes a control directive                                |
| `watch-ctl resume`             | Resume event emission                                | Writes a control directive                                |
| `watch-ctl flush`              | Emit pending debounced updates immediately           | Writes a control directive                                |
| `watch-ctl stop`               | Stop the active watcher                              | Signals the watcher and clears watch metadata on exit     |

### Flags (all subcommands accept these)

| Flag                         | Type                               | Default         | Description                                                                                                                                                                                      |
| ---------------------------- | ---------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--runtime <r>`              | `claude-code\|codex\|cursor\|auto` | `auto`          | Which runtime to read. `auto` picks the peer via `SESSION_OBSERVER_SELF`, a prior same-cwd state entry, or tier-population fallback.                                                             |
| `--cwd <path>`               | path                               | `process.cwd()` | Project directory to match transcripts against.                                                                                                                                                  |
| `--include-tools`            | boolean                            | false           | Include compact `[ToolName] args` tool-call markers.                                                                                                                                             |
| `--include-command-messages` | boolean                            | false           | Include Claude Code slash-command payload records such as `<command-message>…</command-message>`.                                                                                                |
| `--debug`                    | boolean                            | false           | Shorthand for `--include-tools --include-tool-results`. Adds `[ToolName → result] output` entries. For `locate --json`, includes lookup diagnostics such as Claude's expected project-dir slugs. |
| `--include-tool-results`     | boolean                            | false           | Include tool-result markers without tool-call markers (unusual; emits a note suggesting `--debug`).                                                                                              |
| `--json`                     | boolean                            | false           | Machine-readable JSON output (default is markdown).                                                                                                                                              |
| `--max-turns N`              | integer                            | —               | Tail-slice to last N turn groups.                                                                                                                                                                |
| `--max-bytes N`              | integer                            | —               | Tail-slice to last N bytes of content.                                                                                                                                                           |
| `--session <r:id>`           | string                             | —               | Pin to a specific `runtime:sessionId`. Overrides rank winner.                                                                                                                                    |
| `--snippet <text>`           | string                             | —               | Prefer candidate transcripts containing this excerpt. Use when the user identifies a session by its last message or a memorable phrase.                                                          |
| `--mark-read`                | boolean                            | false           | Advance the high-water mark after a `review` run.                                                                                                                                                |
| `--watch`                    | boolean                            | false           | Top-level alias for the `watch` subcommand.                                                                                                                                                      |

### Watch-only flags

| Flag                  | Type                                     | Default | Description                                                                                              |
| --------------------- | ---------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------- |
| `--runtime <r>`       | `claude-code\|codex\|cursor\|auto\|both` | `auto`  | Which runtime to watch. `both` watches Claude Code and Codex in one foreground process.                  |
| `--debounce-sec N`    | number                                   | `2`     | Seconds of quiet before emitting a catch-up digest.                                                      |
| `--poll-sec N`        | number                                   | `2`     | Poll interval in seconds.                                                                                |
| `--max-pending-sec N` | number                                   | `30`    | Maximum seconds to hold continuous transcript changes before emitting even if the file never goes quiet. |
| `--max-runtime-min N` | number                                   | `0`     | Auto-exit after N minutes; `0` runs until stopped.                                                       |
| `--heartbeat-sec N`   | number                                   | `120`   | Emit quiet metadata/status heartbeat lines every N seconds; `0` disables heartbeats.                     |
| `--until-stopped`     | boolean                                  | false   | Alias posture for unlimited foreground watching. Equivalent to `--max-runtime-min 0`.                    |
| `--interactive`       | boolean                                  | false   | Alias posture for live collaboration. Equivalent to `--max-runtime-min 0`.                               |
| `--event-log <path>`  | path                                     | —       | Write metadata-only JSONL event records. Message content stays on stdout.                                |
| `--json`              | boolean                                  | false   | Emit each watch event as one JSON line instead of markdown.                                              |
| `--quiet-empty`       | boolean                                  | false   | Consume metadata-only growth and advance offsets without emitting an empty delta.                        |
| `--strict-baseline`   | boolean                                  | false   | Refuse a standalone watch that would establish a baseline past unread records.                           |

### Default content filter

By default, only natural-language `user`/`assistant` messages are included. Tool calls, tool results, and Claude Code slash-command payload records (`<command-message>`, `<command-name>`, `<command-args>`) are excluded. Opt in with `--include-tools` (adds call markers), `--include-command-messages` (adds slash-command payloads), or `--debug` (adds tool markers and results).

A filtered or empty digest is not evidence that the peer was idle or that the transcript contains no activity. It only means no records matched the current rendering options. Check the raw-record accounting, broaden the filters when appropriate, or inspect the pinned transcript before drawing an absence conclusion.

If a digest would exceed the large-output threshold, the CLI automatically falls back to the last 8 user/assistant turn groups and adds a `Large digest fallback` warning. This protects `catch-up` from dumping pasted skill bodies or large transcript spans. Use `--max-turns` or `--max-bytes` for an explicit bound, or `--include-command-messages` when the slash-command payload itself is the thing being debugged.

---

## Workflow

### Step 1: Clarify if needed

Before running the CLI, resolve any ambiguity:

1. **Mode ambiguous** (`"can you check?"` with no verb hint) → ask: _"Full review, or just what's new since last time?"_
2. **Runtime ambiguous** — default to `--runtime auto`. If multiple runtimes have matching transcripts, `auto` first checks whether the state file has exactly one previously read session for this cwd and reuses that runtime; otherwise it exits 3 with `ambiguousRuntime`.
3. **User identifies a session by text** — run `locate --runtime <r> --cwd "$PWD" --json --snippet "<excerpt>"`, confirm the matched `sessionId`/`recordedCwd`, then re-run with `--session <runtime>:<id>` if needed.
4. **Ties within winning tier** (exit 3 with `ties`) — present the top candidates; ask which to use; re-invoke with `--session <runtime>:<id>`.
5. **No candidates (exit 2)** — run `locate --json --debug` for diagnostics, then present widening options (sister worktree, specific cwd, global most-recent). Treat `globalRecent` as diagnostic only: if one candidate's path or slug clearly matches the current worktree and a newer candidate is unrelated, prefer the same-worktree candidate or ask before using it.

Use `AskUserQuestion` (Claude Code) or structured input / conversational ask (other runtimes) for disambiguation.

### Step 2: Run the CLI

The CLI lives at the skill's install location. In this repository it is at:

```
<skill-dir>/scripts/session-observer.mjs
```

where `<skill-dir>` is `skills/session-observer` (repo-relative) or the installed path on the user's machine.

**Basic invocation pattern:**

```bash
node <skill-dir>/scripts/session-observer.mjs <subcommand> [flags]
```

**Exit code handling:**

| Exit code | Meaning                                    | What to do                                                                                                                                 |
| --------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 0         | Success                                    | Proceed to Step 3.                                                                                                                         |
| 1         | Hard error                                 | Surface the error; do not update state.                                                                                                    |
| 2         | No candidates (noMatch / noCandidates)     | Offer widening options from the JSON payload (`sisters`, `globalRecent`). Do not silently jump to an unrelated globally recent transcript. |
| 3         | Needs user input (ties / ambiguousRuntime) | Present options from the JSON payload; re-invoke with `--session` or `--runtime`.                                                          |
| 4         | Schema mismatch                            | Auto-migrated (should not reach SKILL.md); report if seen.                                                                                 |

**Per-mode CLI templates:**

```bash
# Review — full digest from the beginning
node <skill-dir>/scripts/session-observer.mjs review \
  --runtime codex --cwd "$PWD"

# Catch-up — only records since last read
node <skill-dir>/scripts/session-observer.mjs catch-up \
  --runtime codex --cwd "$PWD"

# Locate — diagnostic ranked candidate list
node <skill-dir>/scripts/session-observer.mjs locate \
  --runtime auto --cwd "$PWD" --json

# Identify the current session before choosing a peer
node <skill-dir>/scripts/session-observer.mjs whoami --json

# Locate by last-message excerpt before pinning
node <skill-dir>/scripts/session-observer.mjs locate \
  --runtime claude-code --cwd "$PWD" --json --snippet "the last thing I saw"

# State — inspect or reset tracked offsets
node <skill-dir>/scripts/session-observer.mjs state get
node <skill-dir>/scripts/session-observer.mjs state reset --runtime codex

# Watch — foreground monitoring with debounced catch-up updates
node <skill-dir>/scripts/session-observer.mjs watch \
  --runtime codex --cwd "$PWD" --poll-sec 2 --debounce-sec 2 --max-pending-sec 30 --until-stopped

# Catch up, then keep watching in one foreground process
node <skill-dir>/scripts/session-observer.mjs catch-up-then-watch \
  --runtime codex --cwd "$PWD" --until-stopped

# Top-level watch alias
node <skill-dir>/scripts/session-observer.mjs --watch \
  --runtime codex --cwd "$PWD"

# Control an active watcher
node <skill-dir>/scripts/session-observer.mjs watch-ctl status --json
node <skill-dir>/scripts/session-observer.mjs watch-ctl pause
node <skill-dir>/scripts/session-observer.mjs watch-ctl resume
node <skill-dir>/scripts/session-observer.mjs watch-ctl flush
node <skill-dir>/scripts/session-observer.mjs watch-ctl stop
```

**JSON output for exit-2 / exit-3 payloads:**

Pass `--json` to get machine-readable output. On exit 2 (noMatch):

```json
{ "noMatch": true, "sisters": [...], "globalRecent": [...] }
```

On exit 3 (ties):

```json
{ "ties": true, "candidates": [{ "runtime": "...", "sessionId": "...", ... }] }
```

On exit 3 (ambiguousRuntime):

```json
{ "ambiguousRuntime": true, "runtimes": ["claude-code", "codex", "cursor"] }
```

**Watch mode operation:**

Use `watch` when the user explicitly asks to keep monitoring a peer session, respond as new peer activity arrives, or watch another terminal while the current invocation remains active. `watch` is a foreground process: keep it running, actively read or poll its stdout, and respond to each emitted digest until the user asks you to stop, `watch-ctl stop` exits the watcher, `--max-runtime-min` expires, or the process exits for another reason. Startup prints: `Watcher is now active. Keep this process open and continue reading stdout. Do not treat baseline setup as a completed watch.`

For combined catch-up/watch requests, run `catch-up-then-watch`. Starting `watch` alone establishes an initial baseline and does not emit already-unread transcript content.

Each emitted watch digest is equivalent to a debounced `catch-up` result and advances the high-water mark for the consumed raw transcript records. The debounce waits for `--debounce-sec` seconds of quiet, but continuous writes are still emitted after `--max-pending-sec` seconds so a busy transcript cannot starve the watcher indefinitely. If the watcher prints JSON lines, route by stable event type: `baseline`, `delta`, `heartbeat`, `stopped`, or `error`. Respond to `delta` events with digest content; stay quiet on `baseline` and `heartbeat` unless their metadata shows a problem. If it prints markdown, read each emitted digest before commenting.

`--quiet-empty` is useful for collaboration watches: metadata-only growth still advances the offset, but no empty delta is printed. This does not mean nothing was written; it means the growth did not produce a rendered message under the active filters. `--strict-baseline` protects a standalone `watch` from silently skipping a previously unread range. Without it, such a start emits one `baseline-gap` warning with the zero-based skipped range; with it, startup refuses and leaves the prior offset intact. `catch-up-then-watch` first renders unread backlog and therefore does not create a baseline gap.

During polling, a pinned watcher may emit a deduplicated `newer-session-candidate` event with identity evidence for a newer same-cwd transcript. It is informational only: the watcher stays pinned and never auto-switches or claims that the candidate superseded the selected peer.

Quiet watches emit heartbeat/status lines every `--heartbeat-sec` seconds by default. Treat heartbeats as liveness/status only; they are not a reason to speak unless `recordsBehind` or `healthy` indicates a problem.

While watch is active, keep the collaboration posture. If the user asks a side question, answer it, then re-engage the foreground watcher unless the user explicitly told you to stop. If your host requires stopping the foreground process before you can answer, restart with `catch-up-then-watch --runtime <peer> --cwd "$PWD" --until-stopped` immediately after the response so unread backlog is consumed before the baseline is reset.

Automatic responses are bounded to the active invocation that started and is polling the watcher. In Claude Code, Codex, Cursor, and similar yield-after-turn harnesses, a backgrounded watch command does not wake the agent when stdout receives a new digest; the caller must keep reading stdout, periodically call `watch-ctl status --json`, or poll the transcript directly. Provider hook integrations that would wake a new invocation after this one ends are deferred; do not imply that watch events will automatically summon an agent after the active invocation has stopped watching.

`watch-ctl status --json` reports the resolved runtime/session/transcript for each target plus live drift fields such as `transcriptRecords`, `lastRecordIndex`, `consumedThrough`, `recordsBehind`, `secondsSinceLastEmit`, and `healthy`. Treat `recordsBehind > 0` with `healthy: false` as a watcher problem or unread backlog, not as peer idleness.

Multiple foreground watchers can run at once, including two sessions in the same worktree watching each other; a second watcher for the **same** target session is refused, since duplicates would race over the shared read offset. Use `watch-ctl status --json` to list active watchers. For `pause`, `resume`, `flush`, or `stop`, the command selects the watcher for the current cwd by default, falling back to the only matching watcher when the implicit cwd filter matches none; if more than one watcher matches, disambiguate with `--runtime`, `--session`, or `--pid`.

### Step 3: Present digest and comment

Read the markdown digest. Then offer a take on what the peer did or said:

- Summarize the most recent work (last few turns).
- If the session is marked `ACTIVE`, note that the peer may still be mid-turn.
- If you noticed something relevant (a bug, a decision, a question), call it out.

### Step 4: Catch-up bookkeeping

`catch-up` automatically advances the high-water mark on exit 0. The high-water mark advances over **raw transcript records consumed**, not just rendered messages. The header separates:

- `raw range (zero-based JSONL indices)` / `raw records consumed` — all transcript records consumed for offset bookkeeping.
- `rendered messages` — natural-language/tool entries actually shown after filters and tail slicing. Rendered ranges also use zero-based JSONL record indices.
- `filtered out` — omitted tool calls, tool results, command messages, metadata/non-message records, or tail-sliced entries.

If the header says `raw records consumed: 8` and `rendered messages: 1`, that is normal: the default digest filtered out the other raw records, usually tool activity or Claude slash-command payloads. Do not describe this as a range bug, peer idleness, or evidence that the omitted records do not exist.

Use one convention everywhere when discussing positions: record numbers are **zero-based JSONL record indices**, not one-based line numbers. If you need one-based line numbers for a separate shell command, label them explicitly as line numbers.

The stored high-water mark is exclusive: after rendering/consuming record `N`, the next catch-up starts at `N + 1`. In the state file this is still named `lastRecordIndex` for compatibility, but semantically it is the next unread zero-based record index.

If you used `review` and want the same bookkeeping, pass `--mark-read`.

---

## Examples

### Basic Usage

```bash
# Check what Codex just did in this project
node skills/session-observer/scripts/session-observer.mjs \
  review --runtime codex --cwd "$PWD"

# Catch up on new Codex activity since last check
node skills/session-observer/scripts/session-observer.mjs \
  catch-up --runtime codex --cwd "$PWD"

# Check Cursor agent transcripts for this project
node skills/session-observer/scripts/session-observer.mjs \
  review --runtime cursor --cwd "$PWD"

# Include tool calls in the digest (compact markers)
node skills/session-observer/scripts/session-observer.mjs \
  review --runtime codex --include-tools

# Full debug view (tool calls + results)
node skills/session-observer/scripts/session-observer.mjs \
  review --runtime codex --debug

# Limit output to the last 10 turn groups
node skills/session-observer/scripts/session-observer.mjs \
  review --runtime codex --max-turns 10
```

### Conversational

**User:** Can you check what Codex just did?

**Agent:** I'll run a review of the Codex session for this project.

```bash
node skills/session-observer/scripts/session-observer.mjs \
  review --runtime codex --cwd "$PWD"
```

_(Reads digest output.)_

Codex has been working on the authentication module. The last few exchanges show it added `src/auth/token.ts` and ran a build check. No errors were reported. Want me to catch up on anything that arrives next?

---

## Troubleshooting

### No candidates found (exit 2, `noMatch` or `noCandidates`)

The skill did not find any transcripts for the target cwd and runtime.

**Recovery options (presented in the JSON payload):**

1. **Sister git worktrees** — re-run with `--cwd <sister-path>`. The payload includes `sisters[]`.
2. **Specific cwd** — re-run with `--cwd <path>` for a different project directory.
3. **Global most-recent** — diagnostic only. Do not use a globally newer unrelated transcript when another candidate path clearly belongs to the requested project/worktree; ask or pin with `--session <runtime>:<id>`.
4. Check that the peer runtime has been run in this project at all.

For Claude Code cwd issues, run `locate --runtime claude-code --cwd "$PWD" --json --debug` and inspect `lookupDiagnostics.claudeCode[]`. It shows the expected project-dir slug variants and whether each directory exists.

For Cursor cwd issues, the supported transcript store is:

```
~/.cursor/projects/<encoded-project>/agent-transcripts/<session-id>/<session-id>.jsonl
```

The encoded project slug splits cwd paths on `/` and `.` and joins non-empty segments with `-` (for example `/Users/thomas.stang/Code/vox/duet` → `Users-thomas-stang-Code-vox-duet`). Cursor's SQLite chat-history store at `~/.cursor/chats/*/store.db` is intentionally out of scope for this skill.

### Ties (exit 3, `ties`)

Two or more sessions have modification times within 5 seconds of each other.

**Recovery:** Pass `--session <runtime>:<id>` with one of the candidates from the `candidates[]` payload. Use `locate --json` first if you want to see all available sessions.

### User identifies a session by last-message text

Run:

```bash
node skills/session-observer/scripts/session-observer.mjs locate \
  --runtime claude-code --cwd "$PWD" --json --snippet "<excerpt>"
```

If the `snippet.matches[]` result identifies the expected `sessionId` and cwd, use `--session <runtime>:<sessionId>` for `review` or `catch-up`. `--session` is the recovery path for ties, no-match ambiguity, and user-confirmed session identity.

### Ambiguous runtime (exit 3, `ambiguousRuntime`)

Multiple runtimes have sessions for this cwd, and no single prior same-cwd state entry resolved the preference. `--runtime auto` can't pick one safely.

**Recovery:** Re-run with `--runtime claude-code`, `--runtime codex`, or `--runtime cursor`.

### Lock exhausted (exit 1)

Another `session-observer` process holds the state lock and did not release it. The CLI exits 1 with a `Failed to ... could not acquire lock after N retries` message.

**Recovery:** Check for a stuck process. If none, remove the lock file:

```bash
rm ~/.local/state/session-observer/state.json.lock
```

### Transcript shrank (warning in digest header)

The transcript file has fewer records than the stored high-water mark — the peer runtime rewrote or rotated the session file.

**Recovery:** The skill automatically resets the offset to 0 and re-renders the full session. No action needed.

### Corrupt state (warning on startup)

`state.json` contained invalid JSON. The skill backed it up to `state.json.corrupt-<ts>.bak` and started fresh with an empty state. All offsets are reset.

**Recovery:** Run `state get` to confirm the fresh state. If you need the previous offsets, inspect the `.bak` file manually.

### State nuke option

If state becomes irreparably inconsistent:

```bash
rm -rf ~/.local/state/session-observer
```

This removes all tracked offsets. The next `catch-up` will behave like a `review`.

### Manual verification (does this work on my machine?)

Use the opt-in probe helper to test against your real transcript stores:

```bash
# Claude Code transcripts
node skills/session-observer/scripts/probe-local.mjs \
  --runtime claude-code --cwd "$PWD"

# Codex transcripts
node skills/session-observer/scripts/probe-local.mjs \
  --runtime codex --cwd "$PWD"

# Cursor agent transcripts
node skills/session-observer/scripts/probe-local.mjs \
  --runtime cursor --cwd "$PWD"
```

Exit codes 0 (digest found) and 2 (no transcripts for this cwd) are both acceptable. Only exit 1 (hard error) indicates a problem.

---

## Success Criteria

- [ ] `SKILL.md` exists, frontmatter valid, and top-level `version` matches `metadata.version`.
- [ ] `review`, `catch-up`, `locate`, and `state` subcommands respond correctly.
- [ ] Default output excludes tool calls and results; `--include-tools` adds compact markers; `--debug` adds both.
- [ ] `catch-up` advances the high-water mark; a second identical `catch-up` emits "no new records."
- [ ] `state reset --runtime <r>` zeros offsets; subsequent `catch-up` re-emits the full session.
- [ ] Exit codes 0 / 1 / 2 / 3 are produced as documented for their respective conditions.
- [ ] `--runtime auto` resolves the peer via `SESSION_OBSERVER_SELF`, prior same-cwd state, or tier-population; exits 3 when multiple runtimes have candidates.
- [ ] No Stoa runtime dependency; no network calls; no writes to transcripts.
- [ ] State stored at `~/.local/state/session-observer/state.json`; nuke option documented above.
