# Session-Observer Test Fixtures

Synthetic JSONL transcripts for unit-testing `scripts/lib/runtimes.mjs`. All files are hand-crafted; no real user transcript content is included.

## claude-code/

Claude Code transcripts follow the record shape used in `~/.claude/projects/<encoded-cwd>/*.jsonl`:
- `record.sessionId` — session identifier (top-level field)
- `record.type` — record type (`user`, `assistant`, `summary`, etc.)
- `record.message.role` — `user` or `assistant`
- `record.message.content` — string or array of content blocks (`type: text`, `type: tool_use`, `type: tool_result`)

### typical.jsonl

13 records: session-meta + 6 user/assistant turn pairs. Includes one `tool_use` + one `tool_result` block. All JSON parses cleanly. Used to verify: correct record count, message extraction, session ID extraction, and that tool calls / results are filtered by default.

### with-tool-burst.jsonl

11 records: session-meta + 5 turns with 3 sequential tool_use/tool_result pairs in a row. Tests that multiple tool calls within a single session are handled correctly.

### ask-user-question.jsonl

9 records: two `AskUserQuestion` tool_use/tool_result pairs plus one ordinary `Read` call/result pair. The first pair carries a structured `record.toolUseResult` with `answers` (one selected label, one free-text answer) and an `annotations` note; the second omits `toolUseResult` so the prose `content` fallback is exercised. Used to verify that ask-user exchanges render with the default tool filters while ordinary tool traffic stays filtered.

### malformed.jsonl

6 lines, one of which is not valid JSON (a plain-text line in the middle). Used to verify that `readRecords` emits a warning but does not throw, and returns all valid records before and after the bad line.

### partial-tail.jsonl

5 lines where the last line is a truncated/incomplete JSON object (simulates a write that was interrupted mid-record). Used to verify that `readRecords` drops the partial trailing line with a warning.

### empty.jsonl

Empty file (0 bytes). Used to verify that `readRecords` returns an empty array without error.

---

## codex/

Codex transcripts follow the record shape used in `~/.codex/sessions/**/*.jsonl`:
- `record.type` — `session_started`, `response_item`
- `record.sessionId` — session identifier (top-level field, also in `payload.id` / `payload.sessionId`)
- `record.payload.type` — `message` (user/assistant text) or `function_call` (tool invocation)
- `record.payload.role` — `user` or `assistant` (when `payload.type === 'message'`)
- `record.payload.content` — string or array of content blocks
- Session-meta record shape: `{ type: 'session_started', sessionId, cwd, timestamp }`

### typical.jsonl

13 records: session-meta (`type: session_started`) + 6 user/assistant pairs + 2 function_calls. Includes `cwd` in the session-meta record. Used to verify: correct record count, `extractMeta` returns `(sessionId, recordedCwd)`, function calls included/excluded based on flags.

### with-function-calls.jsonl

11 records: session-meta + 5 turns with 4 function_calls. Tests that multiple consecutive function calls are handled correctly under the `--include-tools` flag.

### request-user-input.jsonl

9 records: two `request_user_input` function_call/function_call_output pairs plus one ordinary `exec_command` pair. Arguments and outputs are JSON strings, and answers are keyed by question `id`, so this fixture exercises the `call_id → questions` correlation pass. The second call sets `autoResolutionMs` to verify the auto-resolution caveat.

### no-cwd-record.jsonl

4 records with no session-meta record containing `cwd`. Used to verify that `extractMeta` returns `{ sessionId, recordedCwd: null }` gracefully.

### malformed.jsonl

6 lines, one of which is not valid JSON. Used to verify tolerant parsing (same as claude-code/malformed.jsonl).

### partial-tail.jsonl

5 lines where the last line is truncated mid-write. Used to verify that `readRecords` drops the partial trailing line with a warning (same as claude-code/partial-tail.jsonl).

---

## cursor/

Cursor agent transcripts follow the record shape used in `~/.cursor/projects/<encoded-project>/agent-transcripts/<session-id>/<session-id>.jsonl`:
- `record.role` - `user` or `assistant` at the top level
- `record.message.content` - string or array of content blocks
- text blocks use `type: text`
- tool calls use `type: tool_use`

### typical.jsonl

3 records: a short user/assistant exchange with text blocks only. Used to verify record parsing, message extraction, and direct Cursor `buildDigest` coverage.

### with-tool-use.jsonl

2 records: assistant content with text plus a `tool_use` block. Used to verify that Cursor tool calls are filtered by default and included as compact markers when `includeToolCalls` is enabled.

### ask-question.jsonl

6 records: a user turn, an `AskQuestion` tool_use with a call-level `title` and two questions, an ordinary `Shell` call, a final assistant message, and a successful `turn_ended`. Used to verify that the question renders through both the v1 normalizer and the v2 frame-analysis digest, survives the completed-turn collapse to the final message, and states that Cursor records no answer.

### ask-question-final.jsonl

3 records: a user turn, an `AskQuestion` tool_use, and a successful `turn_ended` — so the question is the turn's **final** substantive record. Models a turn that ends on the question itself. Used to verify that the `confirmed-completion` projection refuses to promote a final question (its consumer accepts only a final `message` bound to a terminal success) and recovery-pointers it instead, while `observation` still renders it.

### ask-question-unterminated.jsonl

6 records: a completed opening turn, then an unterminated turn containing assistant prose, an `AskQuestion` tool_use, a typed user reply, and further assistant work — with **no** trailing `turn_ended`. Models a still-open or truncated turn. Used to verify that the trailing buffer is flushed for the question and for the operator's typed reply (Cursor records a typed answer as an ordinary user message), while unfinished assistant progress stays hidden. A provisional tail containing no question keeps the existing hide-it-all behavior — see `unterminated.jsonl`.

### malformed.jsonl

5 lines, one of which is not valid JSON. Used to verify tolerant parsing for Cursor-shaped transcripts: `readRecords` warns, skips the bad line, and preserves valid records before and after it.

### partial-tail.jsonl

5 lines where the last line is truncated mid-write. Used to verify that `readRecords` drops the partial trailing line with a warning for Cursor-shaped transcripts.

### Framed transcript contract

The `framed-*.jsonl` files are byte-sensitive inputs for the streaming Cursor
reader. Do not run a JSON formatter over them. Physical frame indexes are
zero-based and count blank, malformed, and unterminated frames; a blocker does
not renumber later physical frames.

| Fixture | Intended structural labels | Scenario |
| --- | --- | --- |
| `framed-closed.jsonl` | parsed, parsed, parsed | Fully closed user, assistant, and successful terminal frames |
| `framed-blank-lines.jsonl` | parsed, blank, parsed, blank | Blank physical frames remain indexed |
| `framed-malformed-middle.jsonl` | parsed, malformed, parsed | A malformed middle frame blocks the otherwise valid suffix |
| `framed-unterminated-tail.jsonl` | parsed, partial | A parseable tail without a newline remains partial |
| `framed-repair-before.jsonl` / `framed-repair-after.jsonl` | parsed, malformed, parsed → parsed, parsed, parsed | A blocking frame is repaired without discarding the following frame |
| `framed-append-before.jsonl` / `framed-append-after.jsonl` | parsed, parsed → parsed, parsed, parsed | Appended growth preserves the exact prior byte prefix |
| `framed-grow-in-place-before.jsonl` / `framed-grow-in-place-after.jsonl` | parsed, parsed → parsed, parsed, parsed | The trailing assistant frame grows before a successful terminal frame arrives |
| `framed-replacement-before.jsonl` / `framed-replacement-after.jsonl` | parsed, parsed | Same-length prefix replacement must not be mistaken for append-only growth |

The fixture-contract suite checks inventory, raw UTF-8 round trips, newline
boundaries, synthetic redaction, and the intended scenario labels. Scanner
behavior belongs to `tests/transcript-core/cursor-frames.test.ts`.
