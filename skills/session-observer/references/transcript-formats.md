# Transcript Formats Reference

Short reference for the Claude Code, Codex, and Cursor JSONL record shapes that `<skill-dir>/scripts/lib/runtimes.mjs` parses. These formats may drift between runtime releases; the canonical parsing source lives in `src/transcript/core/runtimes.ts`, while `<skill-dir>/scripts/lib/runtimes.mjs` is this skill's generated shipped copy.

---

## File Location Patterns

| Runtime     | Store root            | Pattern                                                                                  |
| ----------- | --------------------- | ---------------------------------------------------------------------------------------- |
| Claude Code | `~/.claude/projects/` | `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`                                    |
| Codex       | `~/.codex/sessions/`  | `~/.codex/sessions/<YYYY>/<MM>/<DD>/session-<id>.jsonl`                                  |
| Cursor      | `~/.cursor/projects/` | `~/.cursor/projects/<encoded-project>/agent-transcripts/<session-id>/<session-id>.jsonl` |

---

## Claude Code

### File naming and cwd encoding

Claude Code encodes the project cwd as the **parent directory name**. Current observed project dirs replace `/` and `.` with `-`. For example:

```
<project-cwd>
    → ~/.claude/projects/<encoded-project-cwd>/<session-id>.jsonl

<worktree-cwd>
    → ~/.claude/projects/<encoded-worktree-cwd>/<session-id>.jsonl
```

`runtimes.encodeCwd('claude-code', cwd)` returns the preferred encoded form. `runtimes.encodeCwdVariants('claude-code', cwd)` returns the preferred form plus compatibility variants, and `locate.mjs` tries all direct directories before glob fallback.

Decoding is approximate: the reverse replacement (`-` → `/`) is ambiguous when path segments themselves contain hyphens or dots. `runtimes.mjs` applies the heuristic "decode only when the dir name starts with `-` (the leading slash of an absolute path)." Direct hits from `discover('claude-code', cwd)` set `recordedCwd = targetCwd` exactly, bypassing the lossy decode. Glob fallback candidates carry the parent `cwdSlug` as weak evidence, and ranking prefers a slug that matches the requested cwd over unrelated global recency.

### Session ID placement

Session ID appears in multiple fields across record types:

- `record.sessionId` (most common)
- `record.session_id`
- `record.sessionID`
- `record.message.sessionId`
- `record.message.session_id`

`runtimes.mjs` checks these in order and takes the first non-null value. Falls back to the file basename (without `.jsonl`) if no record carries one.

### Record types

**Summary / meta record** (first record in the file):

```json
{
  "sessionId": "cc-session-001",
  "type": "summary",
  "summary": "Session started"
}
```

**User message:**

```json
{
  "type": "user",
  "sessionId": "cc-session-001",
  "message": {
    "role": "user",
    "content": "Hello, can you help me refactor this project?"
  }
}
```

The `message` wrapper is present on most records. `runtimes.mjs` checks `record.message.role` first, then falls back to `record.role` and `record.type` for older or alternative shapes.

Claude Code also records slash-command payloads as user text, for example:

```json
{
  "type": "user",
  "sessionId": "cc-session-001",
  "message": {
    "role": "user",
    "content": "<command-message>oat-project-open</command-message>\n<command-name>/oat-project-open</command-name>"
  }
}
```

`normalizeEntries` classifies these as `command_message` entries and excludes them by default because they can contain entire pasted skill bodies. Pass `includeCommandMessages: true` / `--include-command-messages` when debugging command payloads directly.

**Assistant message with text block:**

```json
{
  "type": "assistant",
  "sessionId": "cc-session-001",
  "message": {
    "role": "assistant",
    "content": [{ "type": "text", "text": "Sure! I'd be happy to help." }]
  }
}
```

`content` is an array of typed blocks. `normalizeEntries` extracts all `type: "text"` blocks as `message` entries.

**Assistant message with `tool_use` block:**

```json
{
  "type": "assistant",
  "sessionId": "cc-session-001",
  "message": {
    "role": "assistant",
    "content": [
      { "type": "text", "text": "Let me read the file first." },
      {
        "type": "tool_use",
        "id": "tool_1",
        "name": "Read",
        "input": { "file_path": "/project/src/index.ts" }
      }
    ]
  }
}
```

When `includeToolCalls: true`, `normalizeEntries` produces:

```
role: "assistant", kind: "tool_call", toolName: "Read",
text: "[Read] {\"file_path\":\"/project/src/index.ts\"}"
```

Tool args are truncated to 200 characters.

**User message with `tool_result` block:**

```json
{
  "type": "user",
  "sessionId": "cc-session-001",
  "message": {
    "role": "user",
    "content": [
      {
        "type": "tool_result",
        "tool_use_id": "tool_1",
        "content": "export function main() { console.log('hello'); }"
      }
    ]
  }
}
```

`tool_result` blocks carry `tool_use_id`, not the tool name. `normalizeEntries` builds a first-pass correlation map (`tool_use_id → toolName`) from all `tool_use` blocks in the records before processing results, so the rendered marker shows the correct tool name:

```
role: "user", kind: "tool_result", toolName: "Read",
text: "[Read → result] export function main() { console.log('hello'); }"
```

Tool result output is truncated to 500 characters.

**Ask-user exchange (`AskUserQuestion`):**

The `tool_use` block carries `input.questions[]`, each with `question`, `header`, and `options[{ label, description }]`. The paired result record carries the operator's answers on the **record**, not on the block:

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {
        "type": "tool_result",
        "tool_use_id": "toolu_ask_1",
        "content": "Your questions have been answered: \"Where should the parser live?\"=\"New package\". ..."
      }
    ]
  },
  "toolUseResult": {
    "questions": [
      {
        "question": "Where should the parser live?",
        "header": "Pkg boundary",
        "options": []
      }
    ],
    "answers": { "Where should the parser live?": "New package" },
    "annotations": {
      "Where should the parser live?": { "notes": "…operator note…" }
    }
  }
}
```

`answers` is keyed by full question text and holds either a selected label, an array of labels (multi-select), or the operator's free text when they answered with something other than an offered option. `annotations[question].notes` carries operator-authored notes. Both render:

```
role: "assistant", kind: "ask_user", toolName: "AskUserQuestion",
text: "[AskUserQuestion] Pkg boundary — Where should the parser live?\n   options: New package | Inside core"

role: "user", kind: "ask_user", toolName: "AskUserQuestion",
text: "[AskUserQuestion → answered] Pkg boundary: \"New package\"\n   note: …operator note…"
```

When `toolUseResult` is absent, the block's prose `content` already names each question and answer and is used verbatim rather than dropping the decision. These entries render regardless of `includeToolCalls` / `includeToolResults`; `includeToolCalls` only adds each option's description.

---

## Codex

### File naming and cwd extraction

Codex stores transcripts under `~/.codex/sessions/<YYYY>/<MM>/<DD>/session-<id>.jsonl`. There is **no cwd in the file name**.

The cwd is extracted from the **`session_started` record** at the top of the file:

```json
{
  "type": "session_started",
  "sessionId": "codex-session-001",
  "cwd": "<project-cwd>",
  "timestamp": "2026-05-14T10:00:00Z"
}
```

`runtimes.extractMeta` reads `record.cwd` at the **record top level** first, then falls back to `record.payload.cwd` for Codex versions that nest metadata under `payload`.

`locate.mjs` caches the extracted `(sessionId, recordedCwd)` keyed by `${transcriptPath}:${mtime}` at `~/.local/state/session-observer/codex-cwd-cache.json` to avoid re-reading unchanged files on every poll or check.

### Session ID placement

Session ID appears at the record top level:

- `record.sessionId` (most common, present on every record in the session)
- `record.session_id`
- `record.payload.sessionId`
- `record.payload.session_id`

`runtimes.mjs` intentionally skips `payload.id` — in Codex message records that field holds a per-message ID (e.g. `"msg-001"`), not the session ID.

### Record types

**Session-started record** (first record, metadata):

```json
{
  "type": "session_started",
  "sessionId": "codex-session-001",
  "cwd": "<project-cwd>",
  "timestamp": "2026-05-14T10:00:00Z"
}
```

**User / assistant message (`response_item` with `payload.type === "message"`):**

```json
{
  "type": "response_item",
  "sessionId": "codex-session-001",
  "payload": {
    "type": "message",
    "role": "user",
    "content": "Hello, can you help me with this Node.js project?",
    "id": "msg-001"
  }
}
```

`content` may be a plain string or an array of blocks. When it is an array, `normalizeEntries` extracts `block.text` or `block.content` from each block.

**Function call (`response_item` with `payload.type === "function_call"`):**

```json
{
  "type": "response_item",
  "sessionId": "codex-session-001",
  "payload": {
    "type": "function_call",
    "name": "shell",
    "arguments": { "command": "ls -la" },
    "id": "fc-001"
  }
}
```

When `includeToolCalls: true`, `normalizeEntries` produces:

```
role: "assistant", kind: "tool_call", toolName: "shell",
text: "[shell] {\"command\":\"ls -la\"}"
```

Function args are truncated to 200 characters.

> **Note:** Codex does not have a separate `tool_result` record type in the v1 fixture set. Tool results are not emitted for Codex transcripts regardless of `--include-tool-results` or `--debug` (there are no `function_result` records to parse). This may change in future Codex versions. The one exception is the ask-user exchange below, whose `function_call_output` is read because it carries the operator's answer.

**Ask-user exchange (`request_user_input`):**

Both sides serialize their payload as a JSON **string**, and the answers are keyed by question **id** rather than by question text:

```json
{ "payload": { "type": "function_call", "name": "request_user_input", "call_id": "call_ask_1",
  "arguments": "{\"autoResolutionMs\":120000,\"questions\":[{\"id\":\"keeper_use\",\"header\":\"Keepers\",\"question\":\"Will the auction use keepers?\",\"options\":[{\"label\":\"No keepers\"}]}]}" } }
{ "payload": { "type": "function_call_output", "call_id": "call_ask_1",
  "output": "{\"answers\":{\"keeper_use\":{\"answers\":[\"No keepers\"]}}}" } }
```

`normalizeEntries` makes a first pass over the records to build a `call_id → questions` map, so each answer can be labeled by its question's header instead of its raw id:

```
role: "assistant", kind: "ask_user", toolName: "request_user_input",
text: "[request_user_input] Keepers — Will the auction use keepers?\n   options: No keepers"

role: "user", kind: "ask_user", toolName: "request_user_input",
text: "[request_user_input → answered] Keepers: \"No keepers\""
```

> **Attribution caveat:** a call may set `autoResolutionMs`, after which Codex resolves the question itself. The observed `function_call_output` schema carries no provenance field distinguishing an operator choice from a timer-fired default, so a recorded answer cannot be attributed to the operator with certainty. When `autoResolutionMs` is present, the question entry says so rather than implying a human choice.
>
> Observed 2026-08-02 against Codex CLI 0.142.x rollout transcripts. Re-check when the rollout schema changes: if a provenance field appears, the caveat can be narrowed to auto-resolved answers only.

---

## Cursor

### File naming and cwd encoding

Cursor agent transcripts live under:

```
~/.cursor/projects/<encoded-project>/agent-transcripts/<session-id>/<session-id>.jsonl
```

The project directory slug is derived from the cwd by splitting on `/` and `.` and joining non-empty segments with `-`. For example:

```
<project-cwd>
    → ~/.cursor/projects/<encoded-project>/agent-transcripts/<session-id>/<session-id>.jsonl
```

Direct hits from `discover('cursor', cwd)` set `recordedCwd = targetCwd` exactly and mark `cwdEvidence = "direct-parent-dir"`. Fallback scans search `~/.cursor/projects/*/agent-transcripts/*/*.jsonl` within the normal 7-day lookback, carry the project `cwdSlug`, and mark `cwdEvidence = "project-dir-slug"`. Ranking treats matching Cursor slug evidence as a diagnostic recovery tier above unrelated global recency, but stateful reads still require an exact session plus canonical cwd/transcript identity.

The SQLite chat-history store at `~/.cursor/chats/*/store.db` exists separately and is intentionally out of scope. This skill supports Cursor **agent transcript JSONL** only.

### Session ID placement

Cursor session IDs are inferred from the transcript path:

- preferred: transcript basename without `.jsonl`
- fallback: parent transcript directory name when the file is named generically

### Record shape

Cursor agent transcript records are JSONL objects with a top-level role and a message wrapper:

```json
{
  "role": "assistant",
  "message": {
    "content": [
      { "type": "text", "text": "I found the failing test." },
      {
        "type": "tool_use",
        "name": "Read",
        "input": { "file_path": "/project/src/index.ts" }
      }
    ]
  }
}
```

`normalizeEntries` extracts `type: "text"` blocks as message entries. When `includeToolCalls: true`, `type: "tool_use"` blocks become compact tool-call entries:

```
role: "assistant", kind: "tool_call", toolName: "Read",
text: "[Read] {\"file_path\":\"/project/src/index.ts\"}"
```

Observed Cursor block types in the local spike were `text` and `tool_use`; observed tool names included `Shell`, `Read`, `Grep`, `StrReplace`, `Glob`, and `Write`.

**Ask-user exchange (`AskQuestion`) — question only:**

```json
{
  "role": "assistant",
  "message": {
    "content": [
      {
        "type": "tool_use",
        "name": "AskQuestion",
        "input": {
          "title": "Discovery convergence",
          "questions": [
            {
              "id": "scope_check",
              "prompt": "Proceed as one cohesive project?",
              "options": [
                { "id": "one_project", "label": "Proceed as one project" }
              ]
            }
          ]
        }
      }
    ]
  }
}
```

Note the field names differ from the other runtimes: `prompt` rather than `question`, a call-level `title` rather than a per-question `header`, and options carrying `id` + `label` with no description.

**Cursor records no selected option.** Its agent transcripts carry no tool-result records of any kind — the observed block set is `user:text`, `assistant:text`, and `assistant:tool_use` only — so a clicked option is never written to disk.

The distinction matters: an operator who _types_ a reply instead of picking an option produces an ordinary user message, which is recorded and already visible. It is specifically the selected option that is lost, not every form of answer.

> Observed 2026-08-02 across the local `~/.cursor/projects/*/agent-transcripts` store: 8 transcripts containing 127 `AskQuestion` calls, zero records of any tool-result type. Re-check when Cursor's transcript schema changes; if a result record type appears, this section and `cursorAskUserQuestionText`'s note should both be revised.

The rendered entry therefore states the gap explicitly, so an observer can tell "Cursor did not record the answer" apart from "the operator did not answer":

```
role: "assistant", kind: "ask_user", toolName: "AskQuestion",
text: "[AskQuestion] Discovery convergence — 2 questions:\n1. Proceed as one cohesive project?\n   options: Proceed as one project\n   (selected option not recorded in Cursor transcripts)"
```

A question is preserved on every terminal status, not only success. When a turn ends aborted, errored, or cancelled the rest of its content stays withheld but the question still renders — it is the context explaining what the turn was waiting on — and schema v2 marks it `availability: 'terminal-incomplete'` so it is never mistaken for a confirmed completion.

A question in a still-open or truncated final turn (no `turn_ended` record) is likewise flushed by the v1 normalizer, along with any reply the operator typed after it, since Cursor records a typed answer as an ordinary user message. Ordinary assistant work from that turn is not projected as completed. The flush is scoped to tails that actually contain a question: a provisional tail without one keeps Cursor's normal hide-it-whole behavior, because such content can still be rewritten.

**Projection boundary.** Cursor questions are emitted in the `observation` projection — the one `review` and `catch-up`/watch use — and deliberately not in the internal `confirmed-completion` projection consumed by `session-observer-collab`. That selector requires every schema-v2 entry to be the final message of a terminal-success turn, so a question there turns an otherwise valid collaboration turn into `observer-invalid`. Under the confirmed projection the question stays reachable through `accounting.recovery.omittedAssistantEntries`. Schema-v2 question entries carry `kind: 'ask_user'`, matching the v1 normalizer, so JSON consumers can distinguish them from assistant prose.

Cursor's digest is built from frame analysis rather than from `normalizeEntries`, so the same rendering is reached through `cursorAskUserQuestionText` in both paths. Because that analysis runs before digest options are known, Cursor ask-user entries never carry option descriptions. A completed Cursor turn otherwise collapses to its final assistant message; ask-user records are exempt from that collapse and render in place.

### Physical frames, lifecycle, and projections

Cursor schema v2 positions are physical newline-delimited frame indexes, not
the schema-v1 parsed-record indexes used by Claude Code and Codex. The streaming
reader retains closed, blank, malformed, and partial frame boundaries so repair,
shrink, replacement, and prefix continuity can be checked without silently
renumbering later content.

A terminal frame has a top-level lifecycle shape such as:

```json
{ "type": "turn_ended", "status": "success" }
```

The turn analyzer keeps content availability and lifecycle separate:

- The ordinary `observation` projection may expose prefix-stable substantive
  assistant content after an unchanged stability interval, labeled
  `pending-lifecycle`.
- `success` reconciles a completed turn. `aborted`, `error`, `cancelled`, and
  unknown terminal outcomes remain diagnostics and do not promote provisional
  content as successful completion.
- The `confirmed-completion` projection used by collaboration requires the
  terminal-success boundary and never consumes an open turn.

Cursor digest schema v2 declares
`indexBase: "zero-based-jsonl-frame-index"`. Entry `recordIndex` is the frame
used for delivery/accounting and `sourceFrameIndex` retains the original
content frame. Non-Cursor digest schema v1 remains
`zero-based-jsonl-record-index`; consumers must dispatch on schema and index
base instead of converting between them.

Cursor continuity state stores the canonical identity, first unconsumed frame,
verified prefix bytes/hash, file device/inode when available, open-turn
reconciliation, stability candidate, pending delivery, and independent status
facets. A mismatch blocks state advancement until an explicit reset/replay.

---

## Summary of Key Differences

| Aspect                     | Claude Code                                             | Codex                                                | Cursor                                                     |
| -------------------------- | ------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| cwd source                 | Directory name (encoded, lossy)                         | `record.cwd` or `record.payload.cwd`                 | Exact canonical cwd plus diagnostic encoded project slug   |
| Session ID source          | `record.sessionId` or `message.sessionId`               | `record.sessionId` (every record)                    | Transcript basename or parent dir                          |
| Message wrapper            | `record.message.role` / `record.message.content`        | `record.payload.role` / `record.payload.content`     | `record.role` / `record.message.content`                   |
| Position contract          | Schema-v1 record index                                  | Schema-v1 record index                               | Schema-v2 physical frame index                             |
| Completion contract        | Normalized record behavior                              | Normalized record behavior                           | Content-first observation; terminal-only completion        |
| Tool call format           | `type: "tool_use"` in content array                     | `payload.type === "function_call"`                   | `type: "tool_use"` in content array                        |
| Tool result format         | `type: "tool_result"` with `tool_use_id` (user message) | None in v1                                           | None in v1                                                 |
| Name-to-result correlation | First-pass `tool_use_id → toolName` map                 | First-pass `call_id → questions` map (ask-user only) | N/A                                                        |
| Ask-user tool              | `AskUserQuestion`                                       | `request_user_input`                                 | `AskQuestion`                                              |
| Ask-user answer recorded   | Yes — `record.toolUseResult.answers` keyed by question  | Yes — `function_call_output` keyed by question id    | No — Cursor writes no tool results                         |
| Discovery                  | Direct encoded-dir lookup + glob fallback               | Dated directory glob (7-day window)                  | Direct encoded-dir lookup + agent-transcript glob fallback |

---

## Adding a New Runtime

`src/transcript/core/runtimes.ts` owns base discovery and record normalization.
Cursor's physical-frame and lifecycle semantics live in the adjacent canonical
`cursor-frames.ts` and `cursor-analysis.ts` modules. Adding another conventional
record-based runtime (for example, Gemini CLI) requires:

1. Add a case to `discoverPaths(runtime)`.
2. Add a case to `encodeCwd(runtime, cwd)`.
3. Add helper functions for session ID extraction and content normalization.
4. Add a case to `extractMeta(runtime, transcriptPath)`.
5. Add a case to `normalizeEntries(runtime, records, opts)`.

If a new runtime also needs framed continuity or separate observation/completion
projections, add that behavior to canonical TypeScript and declare its generated
outputs rather than embedding parser logic in a shipped consumer.
