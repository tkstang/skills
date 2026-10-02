---
title: 'Session Search'
description: 'Find a past Claude Code, Codex, or Cursor session on this machine from a fuzzy description, with ranked, redacted candidates and resume hints.'
---

# Session Search

`session-search` finds a past coding-agent session from a fuzzy description.
Install it standalone under that full name or through the session plugin as
`search`; both generated forms share one authored owner and one
`metadata.version`. Invocation syntax depends on the host.

You do not need to name the skill. Requests such as "search my sessions for
the release script", "find the session where we vetted Perceive Now", or
"which conversation last week touched the changelog?" route to it.

## What it does

- Searches **local** Claude Code, Codex, and Cursor session stores on the
  machine where the agent runs, including archived Codex threads and subagent
  transcripts.
- The agent turns your description into 3–6 case-insensitive patterns
  (distinctive names, spelling variants, loose `.*` co-occurrence) and runs a
  bundled, dependency-free Node.js 22+ CLI.
- Returns a ranked candidate list: runtime, last activity, working directory,
  title or first prompt, up to three short redacted snippets, and how to reopen
  the session (`claude --resume <id>`, `codex resume <id>`, or the Cursor
  transcript path).
- Never writes to any session store. `rg` and `sqlite3` speed it up when
  present; without them it falls back to a Node scan and skips Codex thread
  metadata.

When the description is vague, the agent asks one intake message: what the
session was about, any exact phrases or file and command names you remember,
roughly when, and which repository.

## Search tiers

The selected tiers run cheapest first. Widening and the deep rung are fallbacks
that run only when the earlier passes found nothing:

| Tier      | What it searches                                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `history` | Prompt history files: `~/.claude/history.jsonl` and `~/.codex/history.jsonl`. Cursor has none.                                        |
| `meta`    | Session titles, Codex `session_index.jsonl`, and the Codex `state_5.sqlite` thread table (read-only, through `sqlite3` when present). |
| `content` | User and assistant text inside transcripts, with an optional `rg -l` prefilter and streaming verification in Node.                    |
| `deep`    | Tool output as well (command output, MCP tool results, file listings). Runs only when nothing else matched and `--no-deep` is absent. |

`--tiers history,meta,content` restricts the scan. `--include-tools` searches
tool output in the content scan itself and labels that scan `deep`. The JSON
`tiersRun` field lists only the scans that actually ran.

Injected context such as environment blocks, `AGENTS.md` payloads, and system
reminders never counts as user-typed text. Subagent and Codex child-thread hits
roll up to their parent session at half weight.

## Hints and widening

- **Time** (`--since`, `--until`): `24h`, `7d`, `2w`, `today`, `yesterday`,
  `YYYY-MM-DD`, or an ISO date-time. A session matches when its activity
  interval overlaps the window. Cursor transcripts carry no timestamps, so their
  time is the file modification time.
- **Directory** (`--cwd`, repeatable): a starting point, not a filter. The CLI
  searches that directory and below first. If nothing matches, it searches
  everywhere and sets `widened: true`, and the agent tells you the result came
  from widening.
- **Runtime** (`--runtime claude-code,codex,cursor`): defaults to all three.

Ranking prefers sessions that match more of the patterns, have a hit in text
you typed, match the title or first prompt, match the directory hint, have more
hits, and are more recent.

## Large scans

Before the content tier, a guard measures the candidate transcript bytes. Over
the large-scan threshold (default 2 GiB, `--large-scan-bytes`), the CLI limits
the content scan to sessions the history and metadata tiers already found (or
skips it when even that set is too large), sets `needsConfirmation`, and exits
with code 3 alongside any results. The agent
quotes the estimated size and file count and asks before re-running with
`--allow-large-scan`. `estimate` prints per-runtime file counts and bytes for a
window without searching. `--deadline-ms <n>` returns partial results, marked
`incomplete: true`, after the given time.

## Exit codes

| Exit | Meaning                                                                             |
| ---- | ----------------------------------------------------------------------------------- |
| 0    | Results found.                                                                      |
| 2    | No sessions matched. The agent walks the empty-result ladder.                       |
| 3    | Confirmation needed before a large scan (with or without results).                  |
| 1    | Usage or hard error, such as an invalid regex or a pattern that matches empty text. |

An incomplete run exits by its results (0 or 2), or 3 when it also needs
confirmation.

## When nothing is found

The agent stops at the first rung that finds the session:

1. Broaden the patterns, widen or drop the time window, or drop the runtime
   filter.
2. If the hits are later sessions _discussing_ the work, re-run with
   `--include-tools` and an `--until` before that discussion.
3. Ask before a large scan, quoting its size.
4. Report whether the deep rung searched tool output, or why it did not.
5. Ask whether it was a **ChatGPT** conversation. ChatGPT desktop data is
   encrypted locally and cannot be searched here; use ChatGPT's own search.
6. Ask whether it happened on **another machine**.

## Searching another machine

Remote search is opt-in. The agent runs it only when you ask or accept the
offer, and only against an SSH host you name; it never guesses or stores
hostnames. The recipe checks key-based reachability with `BatchMode`, then
locates the installed skill on the remote host and runs the CLI there. When the
skill is not installed remotely, it falls back to read-only history and Codex
thread queries. Search text travels only inside quoted heredocs, never on the
`ssh` command line, so a remote shell cannot interpret it. Each result names the
host it came from.

Environment variables help on constrained hosts: `SESSION_SEARCH_RG` and
`SESSION_SEARCH_SQLITE3` set explicit tool paths, `SESSION_SEARCH_NO_RG=1` and
`SESSION_SEARCH_NO_SQLITE3=1` force the fallbacks, and
`SESSION_SEARCH_PROBE_TIMEOUT_MS` sets the tool-probe timeout.

## Privacy

- Results show only short snippets, at most three per session. The agent does
  not paste whole transcripts unless you ask to open one session.
- Snippets and titles are redacted: credential-shaped strings appear as
  `[REDACTED]`, and the agent never recovers the original values.
- Results are not saved to files unless you ask.

## Limitations

- Session stores are internal provider formats that change between releases.
  The CLI probes each source and marks it `degraded` rather than failing; see
  [Native session schemas](../../engineering/architecture/session-schemas/index.md).
- Cursor's SQLite chat store (`~/.cursor/chats/*/store.db`) and ChatGPT are not
  searched.
- Patterns using character classes, `?`, `{n}`, backslashes, quotes, or
  non-ASCII text still work but skip the `rg` prefilter, so they are slower.
