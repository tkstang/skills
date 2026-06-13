---
name: export-session-transcript
description: Use when the user asks to export, save, or download the current coding-agent conversation as a Markdown file (e.g. "export this session transcript", "save the conversation as markdown"). Locates the live transcript via an announced session marker, drops tool calls and hidden injected payloads, and writes a sanitized branch-named Markdown file (default ~/Downloads).
license: MIT
compatibility: Agent Skills baseline; requires Node.js 22+. No third-party runtime dependencies.
argument-hint: '[output-path] [--runtime <claude-code|codex|cursor|auto>] [--match <marker>] [--session <id>] [--all] [--out <path>]'
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read
metadata:
  author: thomas.stang
  version: '1.0.0'
---

# export-session-transcript

Exports the **current** conversation (yours — Claude Code, Codex, or Cursor) to a
sanitized Markdown transcript, named after the current git branch, written by
default to `~/Downloads`. Tool calls, tool results, system/developer instructions,
environment/AGENTS.md/skill payloads, subagent notifications, and the session
marker line are all excluded — only visible user/assistant messages survive.

---

## When to Use

| Trigger phrase                                            | What to run               |
| --------------------------------------------------------- | ------------------------- |
| `export this session transcript`                          | the marker workflow below |
| `save the conversation as markdown` / `save this chat`    | the marker workflow below |
| `download our conversation` / `export-session-transcript` | the marker workflow below |
| `export all my sessions in this project`                  | add `--all`               |
| `export session <id>`                                     | add `--session <id>`      |

## When NOT to Use

- When the user wants a peer runtime's session, not your own — that is
  `session-observer`, which is read-only and tracks offsets.
- When the user wants findings saved to memory/vault (use `stoa-capture`).

---

## Workflow (default: export the current session)

The hard problem is identifying **which** transcript is _this_ live conversation.
Solve it with a unique session marker that you write into the transcript and then
grep for.

### Step 1: Generate and announce a marker

Generate a unique random-hex marker and announce it to the user in your reply so it
is recorded in the transcript. For example:

```
EXPORT_SESSION_MARKER=a3f9c1e0d2b4
```

Use a fresh random value each time (e.g. 12 hex chars). Announcing it is what makes
it land in the transcript store on the next flush.

### Step 2: Invoke the CLI with your runtime and the marker

```bash
node <skill-dir>/scripts/export-session-transcript.mjs \
  --runtime <self> --match a3f9c1e0d2b4
```

where `<self>` is the runtime you are running as (`claude-code`, `codex`, or
`cursor`), and `<skill-dir>` is `skills/export-session-transcript` in this repo or
the installed path on the user's machine. If you cannot determine your own runtime,
omit `--runtime` (it defaults to `auto`, using an env hint then best-effort
auto-detect).

The CLI greps the cwd's candidate transcripts for the marker and exports the exact
one. If the marker has not been flushed to disk yet, it falls back to the
newest-for-cwd transcript and prints a warning — re-run with `--session <id>` if the
fallback picked the wrong session.

### Step 3: Report the output path

The CLI prints the written path. By default it is `~/Downloads/<branch>.md` (with
`/` in the branch name replaced by `-`). Tell the user where the file was written.

---

## Modes and flags

| Flag               | Default         | Description                                                                                                               |
| ------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `--runtime <r>`    | `auto`          | `claude-code\|codex\|cursor\|auto`. `auto` uses an env hint (`SESSION_OBSERVER_SELF`-style) then best-effort auto-detect. |
| `--match <marker>` | —               | Grep cwd candidates for this marker (selects the current session).                                                        |
| `--session <id>`   | —               | Export a specific session id (bypasses `--match`).                                                                        |
| `--all`            | false           | Export every session for the cwd — one file each.                                                                         |
| `--cwd <path>`     | `process.cwd()` | Project dir to match transcripts against.                                                                                 |
| `--out <path>`     | —               | Output file or directory (also accepted positionally).                                                                    |
| `--help`           | —               | Usage.                                                                                                                    |

**Selection-mode precedence:** the selection modes are mutually exclusive, with
precedence `--all` > `--session` > `--match` > default (current session). The
highest-precedence flag present wins and the lower ones are ignored — e.g.
`--match` is ignored when `--all` is set, and `--session` is ignored when `--all`
is set. With no selection flag, the CLI exports the current session (single
candidate auto-selected; multiple candidates exit `3` as ambiguous).

### Output path resolution

| Input                          | Output                                |
| ------------------------------ | ------------------------------------- |
| default                        | `~/Downloads/<branch>.md` (`/` → `-`) |
| `--out DIR` / positional dir   | `<DIR>/<branch>.md`                   |
| `--out FILE` (file path)       | `<FILE>` verbatim                     |
| not a git repo / detached HEAD | `<cwd-basename>-<UTCstamp>.md`        |
| `--all` (+ optional DIR)       | `<branch>-<sessionId>.md` per session |

---

## Per-provider transcript store locations

| Runtime     | Store root                                                                               |
| ----------- | ---------------------------------------------------------------------------------------- |
| Claude Code | `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`                                    |
| Codex       | `~/.codex/sessions/<YYYY>/<MM>/<DD>/session-<id>.jsonl`                                  |
| Cursor      | `~/.cursor/projects/<encoded-project>/agent-transcripts/<session-id>/<session-id>.jsonl` |

See `references/transcript-formats.md` for record shapes and cwd-encoding details.

---

## Exit code handling

| Exit code | Meaning       | What to do                                                                                                                         |
| --------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 0         | Success       | Report the written path.                                                                                                           |
| 1         | Hard error    | Surface the error message; nothing was written.                                                                                    |
| 2         | No candidates | No transcript found for this cwd/runtime. Suggest `--cwd <path>` or confirm the runtime ran in this project.                       |
| 3         | Ambiguous     | Multiple candidates and no `--match`/`--session`. Re-run with a `--match <marker>` or `--session <id>` from the listed candidates. |

---

## Success Criteria

- [ ] `SKILL.md` exists, frontmatter valid, version 1.0.0.
- [ ] The agent announces a random-hex marker before invoking the CLI.
- [ ] Output contains only visible user/assistant messages — no tool calls/results,
      system/developer text, environment/AGENTS.md/skill payloads, subagent
      notifications, or the marker line.
- [ ] Default output is `~/Downloads/<branch>.md`; `--out` and `--all` honored.
- [ ] Exit codes 0 / 1 / 2 / 3 produced as documented.
- [ ] No third-party dependencies; no network calls; no writes to transcripts.
