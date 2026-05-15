---
name: session-observer
version: 1.0.0
description: Use when checking what the other coding agent (Claude Code or Codex) just did in this project, reviewing a peer session, or catching up on new messages. Locates the active transcript, renders a tool-free digest, and tracks per-runtime read offsets.
argument-hint: '[review|catch-up|locate|state] [--runtime <claude-code|codex|auto>] [--debug]'
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read, AskUserQuestion
---

# session-observer

Lets you (Claude Code or Codex) inspect the other runtime's transcript for the current project, render a tool-free digest, and track per-runtime read offsets so follow-up checks surface only new content.

---

## When to Use

Use this skill when any of the following applies:

| Trigger phrase | What to run |
|---|---|
| `check Codex` / `review the other terminal` / `summarize Codex's session` | `review --runtime codex` |
| `check Claude` / `check what Claude said` | `review --runtime claude-code` |
| `check again` / `anything new?` | `catch-up` (auto runtime) |
| `what do you think of what was just said?` | `catch-up`, then comment |
| `get up to speed` / `start watching this session` | `review` once, `catch-up` thereafter |
| `which sessions are available?` / `find the session` | `locate` |
| `reset / start over watching Codex` | `state reset --runtime codex`, then `review` |

**You are responsible for choosing the right subcommand.** When the trigger phrase is ambiguous (e.g. `"can you check?"`), ask the user: *"Full review of the session, or just what's new since last time?"*

---

## When NOT to Use

- When you already know what the peer did (skip the check).
- When you want to save findings to memory/vault (use `stoa-capture` instead — this skill is read-only).
- When you want a continuous live feed. **Watch mode is designed but not implemented in v1.** See `references/watch-design.md` for the v2 design.
- When the target runtime is your own. Use `--runtime <peer>` or let `auto` resolve the peer.

---

## Arguments

### Subcommands

| Subcommand | Purpose | State change |
|---|---|---|
| `review` | Full digest from the start | None (unless `--mark-read` passed) |
| `catch-up` | Delta: records since last read | Advances high-water mark on success |
| `locate` | Ranked candidate list (diagnostic) | None |
| `state get` | Print current state | None |
| `state reset --runtime <r>` | Reset all offsets for runtime | Zeroes `lastRecordIndex` |
| `state reset --session <r:id>` | Reset one session | Zeroes `lastRecordIndex` |
| `state clear` | Clear all tracked sessions | Empties `sessions` map |

### Flags (all subcommands accept these)

| Flag | Type | Default | Description |
|---|---|---|---|
| `--runtime <r>` | `claude-code\|codex\|auto` | `auto` | Which runtime to read. `auto` picks the peer via `SESSION_OBSERVER_SELF` env hint or tier-population fallback. |
| `--cwd <path>` | path | `process.cwd()` | Project directory to match transcripts against. |
| `--include-tools` | boolean | false | Include compact `[ToolName] args` tool-call markers. |
| `--debug` | boolean | false | Shorthand for `--include-tools --include-tool-results`. Adds `[ToolName → result] output` entries. |
| `--include-tool-results` | boolean | false | Include tool-result markers without tool-call markers (unusual; emits a note suggesting `--debug`). |
| `--json` | boolean | false | Machine-readable JSON output (default is markdown). |
| `--max-turns N` | integer | — | Tail-slice to last N turn groups. `review` only. |
| `--max-bytes N` | integer | — | Tail-slice to last N bytes of content. `review` only. |
| `--session <r:id>` | string | — | Pin to a specific `runtime:sessionId`. Overrides rank winner. |
| `--mark-read` | boolean | false | Advance the high-water mark after a `review` run. |

### Default content filter

By default, only natural-language `user`/`assistant` messages are included. Tool calls and tool results are excluded. Opt in with `--include-tools` (adds call markers) or `--debug` (adds both markers and results).

---

## Workflow

### Step 1: Clarify if needed

Before running the CLI, resolve any ambiguity:

1. **Mode ambiguous** (`"can you check?"` with no verb hint) → ask: *"Full review, or just what's new since last time?"*
2. **Runtime ambiguous** — default to `--runtime auto`. Only ask if `auto` exits 3 with `ambiguousRuntime`.
3. **Ties within winning tier** (exit 3 with `ties`) — present the top candidates; ask which to use; re-invoke with `--session <runtime>:<id>`.
4. **No candidates (exit 2)** — present widening options (sister worktree, specific cwd, global most-recent).

Use `AskUserQuestion` (Claude Code) or structured input / conversational ask (other runtimes) for disambiguation.

### Step 2: Run the CLI

The CLI lives at the skill's install location. In this repository it is at:

```
<skill-dir>/scripts/session-observer.mjs
```

where `<skill-dir>` is `.agents/skills/session-observer` (repo-relative) or the installed path on the user's machine.

**Basic invocation pattern:**

```bash
node <skill-dir>/scripts/session-observer.mjs <subcommand> [flags]
```

**Exit code handling:**

| Exit code | Meaning | What to do |
|---|---|---|
| 0 | Success | Proceed to Step 3. |
| 1 | Hard error | Surface the error; do not update state. |
| 2 | No candidates (noMatch / noCandidates) | Offer widening options from the JSON payload (`sisters`, `globalRecent`). |
| 3 | Needs user input (ties / ambiguousRuntime) | Present options from the JSON payload; re-invoke with `--session` or `--runtime`. |
| 4 | Schema mismatch | Auto-migrated (should not reach SKILL.md); report if seen. |

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

# State — inspect or reset tracked offsets
node <skill-dir>/scripts/session-observer.mjs state get
node <skill-dir>/scripts/session-observer.mjs state reset --runtime codex
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
{ "ambiguousRuntime": true, "runtimes": ["claude-code", "codex"] }
```

### Step 3: Present digest and comment

Read the markdown digest. Then offer a take on what the peer did or said:

- Summarize the most recent work (last few turns).
- If the session is marked `ACTIVE`, note that the peer may still be mid-turn.
- If you noticed something relevant (a bug, a decision, a question), call it out.

### Step 4: Catch-up bookkeeping

`catch-up` automatically advances the high-water mark on exit 0. The next `check again` will only surface records that arrive after this call. Remind the user of this behavior when relevant.

If you used `review` and want the same bookkeeping, pass `--mark-read`.

---

## Examples

### Basic Usage

```bash
# Check what Codex just did in this project
node .agents/skills/session-observer/scripts/session-observer.mjs \
  review --runtime codex --cwd "$PWD"

# Catch up on new Codex activity since last check
node .agents/skills/session-observer/scripts/session-observer.mjs \
  catch-up --runtime codex --cwd "$PWD"

# Include tool calls in the digest (compact markers)
node .agents/skills/session-observer/scripts/session-observer.mjs \
  review --runtime codex --include-tools

# Full debug view (tool calls + results)
node .agents/skills/session-observer/scripts/session-observer.mjs \
  review --runtime codex --debug

# Limit output to the last 10 turn groups
node .agents/skills/session-observer/scripts/session-observer.mjs \
  review --runtime codex --max-turns 10
```

### Conversational

**User:** Can you check what Codex just did?

**Agent:** I'll run a review of the Codex session for this project.

```bash
node .agents/skills/session-observer/scripts/session-observer.mjs \
  review --runtime codex --cwd "$PWD"
```

*(Reads digest output.)*

Codex has been working on the authentication module. The last few exchanges show it added `src/auth/token.ts` and ran a build check. No errors were reported. Want me to catch up on anything that arrives next?

---

## Troubleshooting

### No candidates found (exit 2, `noMatch` or `noCandidates`)

The skill did not find any transcripts for the target cwd and runtime.

**Recovery options (presented in the JSON payload):**

1. **Sister git worktrees** — re-run with `--cwd <sister-path>`. The payload includes `sisters[]`.
2. **Specific cwd** — re-run with `--cwd <path>` for a different project directory.
3. **Global most-recent** — re-run without `--cwd` against the globally most-recent session. Note it may be from an unrelated project.
4. Check that the peer runtime has been run in this project at all.

### Ties (exit 3, `ties`)

Two or more sessions have modification times within 5 seconds of each other.

**Recovery:** Pass `--session <runtime>:<id>` with one of the candidates from the `candidates[]` payload. Use `locate --json` first if you want to see all available sessions.

### Ambiguous runtime (exit 3, `ambiguousRuntime`)

Both Claude Code and Codex have sessions for this cwd. `--runtime auto` can't pick one.

**Recovery:** Re-run with `--runtime claude-code` or `--runtime codex`.

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
node .agents/skills/session-observer/scripts/probe-local.mjs \
  --runtime claude-code --cwd "$PWD"

# Codex transcripts
node .agents/skills/session-observer/scripts/probe-local.mjs \
  --runtime codex --cwd "$PWD"
```

Exit codes 0 (digest found) and 2 (no transcripts for this cwd) are both acceptable. Only exit 1 (hard error) indicates a problem.

---

## Success Criteria

- [ ] `SKILL.md` exists, frontmatter valid, version 1.0.0.
- [ ] `review`, `catch-up`, `locate`, and `state` subcommands respond correctly.
- [ ] Default output excludes tool calls and results; `--include-tools` adds compact markers; `--debug` adds both.
- [ ] `catch-up` advances the high-water mark; a second identical `catch-up` emits "no new records."
- [ ] `state reset --runtime <r>` zeros offsets; subsequent `catch-up` re-emits the full session.
- [ ] Exit codes 0 / 1 / 2 / 3 are produced as documented for their respective conditions.
- [ ] `--runtime auto` resolves the peer via `SESSION_OBSERVER_SELF` or tier-population; exits 3 when both runtimes have candidates.
- [ ] No Stoa runtime dependency; no network calls; no writes to transcripts.
- [ ] State stored at `~/.local/state/session-observer/state.json`; nuke option documented above.
