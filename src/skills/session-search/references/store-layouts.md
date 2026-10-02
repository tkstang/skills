# Session store layouts

A compact map of what `session-search` reads. All paths are under the searched
machine's home directory. These are internal provider stores and may drift
between releases; the CLI probes and degrades per tier rather than failing. Full
record schemas:
[session-schemas](https://github.com/tkstang/skills/tree/main/documentation/docs/engineering/architecture/session-schemas)
(`documentation/docs/engineering/architecture/session-schemas/` in the skills
repository).

## Claude Code

| What       | Path / fields                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------- |
| Transcript | `~/.claude/projects/<slug>/<session-id>.jsonl`; `<slug>` is the cwd with `/` and `.` as `-`.   |
| Subagents  | `<slug>/<session-id>/subagents/**/agent-<id>.jsonl` (workflow agents nest under `workflows/`). |
| History    | `~/.claude/history.jsonl`: `{display, pastedContents, project, sessionId, timestamp (ms)}`.    |
| Titles     | Sparse `ai-title` (`aiTitle`) and `custom-title` (`customTitle`) records; a custom title wins. |
| Cwd        | `cwd` on every message record.                                                                 |
| Resume     | `claude --resume <session-id>`, run in the recorded cwd.                                       |

Workflow `journal.jsonl` files are not transcripts and are skipped.

## Codex

| What       | Path / fields                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------------- |
| Transcript | `~/.codex/sessions/YYYY/MM/DD/rollout-<local-timestamp>-<uuid>.jsonl`.                              |
| Archived   | `~/.codex/archived_sessions/rollout-*.jsonl`; results are labeled `archived`.                       |
| Header     | First `session_meta` record: `payload.id` (this thread), `payload.session_id` (root thread), `cwd`. |
| History    | `~/.codex/history.jsonl`: `{session_id, ts (seconds), text}`.                                       |
| Index      | `~/.codex/session_index.jsonl`: `{id, thread_name, updated_at}`. Covers only some threads.          |
| Threads    | `~/.codex/state_5.sqlite` table `threads`, read with `sqlite3 -readonly` (see below).               |
| Resume     | `codex resume <id>`.                                                                                |

`threads` columns read when present: `id`, `rollout_path` (both required),
`title`, `first_user_message`, `cwd`, `created_at`, `updated_at` (epoch seconds
or ISO), `archived`, `git_origin_url`, and `source`. The CLI checks
`PRAGMA table_info(threads)` first. A failing query or a missing required column
marks the Codex source `degraded` and the search continues. Without `sqlite3` or
the database, this tier is skipped silently (`tools.sqlite3: null`).

Children (subagents): a rollout whose `payload.id` differs from
`payload.session_id` is a child of the root thread. A child may start with
inherited parent history (records whose `ordinal` is below
`subagent_history_start_ordinal`); those records are skipped. Threads whose
`source` carries a `subagent` key (thread spawn, review, memory consolidation, guardian) are
agent-authored, so their user-role text never counts as user-typed.

Only `response_item` messages feed the content tier; the duplicate `event_msg`
user and agent messages are ignored.

## Cursor

| What       | Path / fields                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------- |
| Transcript | `~/.cursor/projects/<slug>/agent-transcripts/<id>/<id>.jsonl`; `<slug>` joins cwd segments by `-`. |
| Subagents  | `<id>/subagents/<child>.jsonl`.                                                                    |
| History    | None.                                                                                              |
| Time / cwd | Transcripts carry no timestamps or cwd: time is the file mtime, and cwd hints match the slug.      |
| Open       | Open the transcript in Cursor; there is no resume command.                                         |

Cursor's SQLite chat store (`~/.cursor/chats/*/store.db`) is not searched.

## Rules that apply to every runtime

- **Subagent roll-up.** Subagent and child hits are attributed to their parent
  session at half weight (`via: "subagent"`). A subagent whose parent transcript
  is missing is listed on its own with `isSubagent: true`.
- **Time.** A session matches the window when its activity interval (start to
  last modification) overlaps it.
- **Lines.** Transcripts are split on LF only (U+2028/2029 can appear inside
  strings). Lines over `--max-line-bytes` (default 64 KiB) are skipped and
  counted; on the deep rung, oversize known tool-output lines are matched raw.
- **Roles.** Injected context (environment blocks, AGENTS.md payloads, system
  reminders) is demoted from user to `context` and never counts as user-typed.
  Tool calls and results are searched only on the deep rung.
- **Not covered.** ChatGPT (encrypted locally) and other agent stores.
