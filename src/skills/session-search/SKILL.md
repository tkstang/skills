---
name: session-search
description: Use when the user wants to find a past coding-agent session or conversation (e.g. "find the session where we…", "search my sessions for…", "which conversation did we discuss X in?"). Searches local Claude Code, Codex, and Cursor history, metadata, and transcripts from agent-expanded patterns plus optional time and repo hints, and returns a ranked, redacted candidate list with resume hints.
license: MIT
compatibility: Agent Skills baseline; requires Node.js 22+. No third-party runtime dependencies; uses rg and sqlite3 when present.
argument-hint: '[what the session was about] [time hint, e.g. "last week"] [repo or directory hint]'
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read, AskUserQuestion
metadata:
  author: Thomas Stang
  version: '0.1.0'
---

# {{distribution.name}}

Find a past Claude Code, Codex, or Cursor session from a fuzzy description. You
turn the description into search patterns; the bundled read-only CLI searches
this machine's session stores cheapest-first and returns ranked, redacted
candidates. It never writes to session stores.

Invoke it by name (`/session-search`, `/session:search` in the session plugin,
`$session-search` in Codex) or by asking naturally: "find the session where we
vetted Perceive Now", "which conversation last week touched the release script?".

## When NOT to use

- Reading or following a live peer session: use `session-observer`.
- Exporting the current conversation: use `session-export-transcript`.
- Searching ChatGPT: its local data is encrypted. Point the user to ChatGPT's own
  search (see the empty-result ladder).

## Step 1: Intake

Ask **one** message covering only what the request does not already answer:

- What was the session about?
- Any **exact phrases, names, file or command names, or odd terms** remembered.
  These are the highest-precision patterns, so always ask when the description is
  vague.
- Roughly when (today, yesterday, last week, a date)?
- Which repo or directory, if suspected?

If the request already has enough to search, skip intake and run.

## Step 2: Expand patterns

Write 3–6 patterns:

- distinctive nouns, names, identifiers, file and command names;
- spelling, spacing, and hyphenation variants as alternation
  (`perceive now|perceivenow|perceive-now`);
- loose co-occurrence with `.*` (`release.*script`).

Avoid generic words (`fix`, `test`, `bug`). Matching rules:

- Patterns are **case-insensitive regexes with dotAll**: `.` also matches
  newlines, so `.*` can span lines inside one message.
- Pass `--literal` to match fixed strings (paths, text with `(`, `?`, `[`).
- A pattern that matches empty text (`a*`, `x?`) is rejected with exit 1.
  Duplicate patterns are de-duplicated.
- Plain ASCII words, `|`, groups, and `.*`/`.+` keep the fast `rg` prefilter.
  Character classes, `?`, `{n}`, backslashes, quotes, and non-ASCII still work but
  scan every candidate file in Node: same results, slower.

## Step 3: Run the CLI

`<skill-dir>` is the directory containing this `SKILL.md`. Check `node --version`
first; stop and tell the user if Node.js 22+ is missing.

```bash
node <skill-dir>/scripts/session-search.mjs -p 'perceive.*now' -p 'vetting' \
  --since 2w --cwd ~/code/skills --json
```

| Flag                                | Use                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `-p, --pattern <regex>`             | Repeatable; required.                                                    |
| `--since` / `--until <spec>`        | `24h`, `7d`, `2w`, `today`, `yesterday`, `YYYY-MM-DD`, ISO date-time.    |
| `--cwd <path>`                      | Repeatable. A **starting point**, not a filter (see below).              |
| `--runtime <list>`                  | `claude-code,codex,cursor` (default all).                                |
| `--tiers <list>`                    | `history,meta,content` (default all).                                    |
| `--no-deep` / `--include-tools`     | Disable the deep rung / search tool output in the content scan itself.   |
| `--allow-large-scan`                | Only after the user agrees (Step 5).                                     |
| `--limit <n>` / `--deadline-ms <n>` | Result cap (default 15) / return partial results after N ms.             |
| `estimate`                          | Subcommand: per-runtime file counts and bytes for a window, no patterns. |

Always pass `--json` and read the `session-search/v1` result from stdout. In JSON
mode, diagnostic notes (`[session-search] note: …`, such as a tool-probe problem
or an `rg` fallback) go to **stderr**; read them but never parse them as results.
A `sources[]` entry with `status: "degraded"` carries a `note` naming a skipped
part (for example, an unreadable Codex thread database); search continues.
`tools.rg` or `tools.sqlite3` set to `null` means that accelerator is absent: the
content scan still runs in Node, but Codex thread metadata is not searched.

**Hints.** A time hint narrows the scan by session activity. A `--cwd` hint is
searched first (that directory and below); if it finds nothing, the CLI
automatically searches everywhere and sets `widened: true`. Tell the user when a
result came from widening.

**Tiers.** `history` (prompt history files) → `meta` (titles, Codex thread
index) → `content` (user and assistant text) → `deep` (tool output too). The deep
rung runs automatically only when nothing else matched, the content tier is
selected, and `--no-deep` is absent. `--include-tools` instead labels the content
scan itself `deep`. `tiersRun` lists only scans that actually ran: a rung skipped
by the large-scan guard, the deadline, or flags is omitted.

## Step 4: Handle the exit code

| Exit | Meaning                                       | Do                                                                             |
| ---- | --------------------------------------------- | ------------------------------------------------------------------------------ |
| 0    | Results                                       | Present them (Step 6).                                                         |
| 2    | No sessions matched                           | Walk the ladder (Step 5).                                                      |
| 3    | `needsConfirmation` set (any result count)    | Present any results, then ask before a large scan (ladder step 3).             |
| 1    | Usage or hard error (bad regex, empty match…) | Fix the arguments using stderr; use `--literal` for a fixed string that fails. |

With `--deadline-ms`, check `incomplete`: when `true`, results are partial and
the run may have stopped before widening or the deep rung. An incomplete run
still exits 0 or 2. Say so and offer a re-run without the deadline.

## Step 5: Empty or weak results ladder

Stop at the first rung that finds the session.

1. **Broaden.** Add variants or looser patterns, drop or widen the time window, or
   drop the `--runtime` filter.
2. **Hits only discuss it.** Tool output (MCP tool results, command output, file
   listings) is excluded by default, and the deep rung runs only when nothing
   else matched. So when the top hits look like later sessions talking about
   the thing rather than the session where it happened (they say "found it" or
   "in another session", or their dates postdate the user's hint), re-run with
   `--include-tools`, and add `--until` set before the discussion began.
3. **Large scan.** If `needsConfirmation` is set, ask before re-running with
   `--allow-large-scan`, quoting `estimatedBytes` (human-readable) and
   `fileCount`: "A full content scan covers 6.2 GiB across 3,400 files. Run it?"
4. **Deep rung.** When `tiersRun` includes `deep`, report that tool output was
   searched too. If it is absent on an empty result, say why (guard, `--no-deep`,
   deadline, or tiers).
5. **ChatGPT.** Ask whether it might have been a ChatGPT conversation. ChatGPT
   desktop data is encrypted locally and cannot be searched here; suggest
   ChatGPT's own search.
6. **Another machine.** Ask whether it might have happened on another computer.
   If the user names an SSH host, run the remote search below.

## Step 6: Present results

Show the top five (say how many more exist), one entry each:

```text
1. [codex] 2026-09-29 14:02 · ~/code/skills · "Perceive Now vetting" (archived)
   > user/history: …can we vet perceive now before the demo…
   resume: codex resume 019a… (in ~/code/skills)
```

Use `runtime`, `lastActivity`, `cwd`, `title` (else `firstPrompt`), `archived` /
`isSubagent`, the best of `snippets`, and `open.command` plus `open.hint`. Mention
`widened` and which patterns matched when it helps the user choose. Offer to dig
into one candidate.

## Remote search (opt-in only)

Search another machine only when the user asks or accepts the ladder offer, and
only on the host they name; never guess hosts. Read
[remote-fallback.md](references/remote-fallback.md) for the recipe: a `BatchMode`
reachability check, locating the remote install, running the CLI with a PATH
prefix for Homebrew tools, and read-only one-liners when the skill is not
installed there. Report which host each result came from (`host.hostname`).

Environment knobs for constrained hosts: `SESSION_SEARCH_RG` and
`SESSION_SEARCH_SQLITE3` (explicit tool paths), `SESSION_SEARCH_NO_RG=1` and
`SESSION_SEARCH_NO_SQLITE3=1` (force the fallbacks), and
`SESSION_SEARCH_PROBE_TIMEOUT_MS` (tool-probe timeout; default 3000).

## Privacy

- Show only the CLI's snippets (at most three short windows per session). Never
  paste whole transcripts or records unless the user asks to open one specific
  session.
- Snippets and titles are redacted: credential-shaped strings appear as
  `[REDACTED]`. Never recover or echo the original values from the raw files.
- Do not save search results or remote output to files unless the user asks.

For store paths, history and index fields, and subagent and archive rules, read
[store-layouts.md](references/store-layouts.md) when debugging a miss or running
the remote fallback.
