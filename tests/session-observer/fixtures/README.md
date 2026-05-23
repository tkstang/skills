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

### malformed.jsonl

5 lines, one of which is not valid JSON. Used to verify tolerant parsing for Cursor-shaped transcripts: `readRecords` warns, skips the bad line, and preserves valid records before and after it.

### partial-tail.jsonl

5 lines where the last line is truncated mid-write. Used to verify that `readRecords` drops the partial trailing line with a warning for Cursor-shaped transcripts.
