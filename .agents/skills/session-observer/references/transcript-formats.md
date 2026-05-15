# Transcript Formats Reference

Short reference for the Claude Code and Codex JSONL record shapes that `<skill-dir>/scripts/lib/runtimes.mjs` parses. These formats may drift between runtime releases; the canonical parsing logic lives in `runtimes.mjs`.

---

## File Location Patterns

| Runtime | Store root | Pattern |
|---|---|---|
| Claude Code | `~/.claude/projects/` | `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl` |
| Codex | `~/.codex/sessions/` | `~/.codex/sessions/<YYYY>/<MM>/<DD>/session-<id>.jsonl` |

---

## Claude Code

### File naming and cwd encoding

Claude Code encodes the project cwd as the **parent directory name** by replacing every `/` with `-`. For example:

```
/Users/alice/Code/my-project
    → ~/.claude/projects/-Users-alice-Code-my-project/<session-id>.jsonl
```

`runtimes.encodeCwd('claude-code', cwd)` returns this encoded form. `locate.mjs` uses the encoded name to do a direct directory lookup — no transcript read needed to derive the cwd.

Decoding is approximate: the reverse replacement (`-` → `/`) is ambiguous when path segments themselves contain hyphens. `runtimes.mjs` applies the heuristic "decode only when the dir name starts with `-` (the leading slash of an absolute path)." Direct hits from `discover('claude-code', cwd)` set `recordedCwd = targetCwd` exactly, bypassing the lossy decode.

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
{ "sessionId": "cc-session-001", "type": "summary", "summary": "Session started" }
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

**Assistant message with text block:**

```json
{
  "type": "assistant",
  "sessionId": "cc-session-001",
  "message": {
    "role": "assistant",
    "content": [
      { "type": "text", "text": "Sure! I'd be happy to help." }
    ]
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

---

## Codex

### File naming and cwd extraction

Codex stores transcripts under `~/.codex/sessions/<YYYY>/<MM>/<DD>/session-<id>.jsonl`. There is **no cwd in the file name**.

The cwd is extracted from the **`session_started` record** at the top of the file:

```json
{ "type": "session_started", "sessionId": "codex-session-001",
  "cwd": "/Users/testuser/Code/my-project", "timestamp": "2026-05-14T10:00:00Z" }
```

`runtimes.extractMeta` reads `record.cwd` at the **record top level** to extract the cwd.

> **Known limitation (p02 review, Minor finding):** `extractMeta` reads `cwd` from `record.cwd` (top-level). If a Codex version stores cwd inside a nested `payload` object instead, the extraction falls back to `recordedCwd: null`, placing the candidate in Tier C. The candidate still appears in `locate` output and can be selected manually with `--session <r:id>`.

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
  "cwd": "/Users/testuser/Code/my-project",
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

> **Note:** Codex does not have a separate `tool_result` record type in the v1 fixture set. Tool results are not emitted for Codex transcripts regardless of `--include-tool-results` or `--debug` (there are no `function_result` records to parse). This may change in future Codex versions.

---

## Summary of Key Differences

| Aspect | Claude Code | Codex |
|---|---|---|
| cwd source | Directory name (encoded, lossy) | `record.cwd` at top level |
| Session ID source | `record.sessionId` or `message.sessionId` | `record.sessionId` (every record) |
| Message wrapper | `record.message.role` / `record.message.content` | `record.payload.role` / `record.payload.content` |
| Tool call format | `type: "tool_use"` in content array | `payload.type === "function_call"` |
| Tool result format | `type: "tool_result"` with `tool_use_id` (user message) | None in v1 |
| Name-to-result correlation | First-pass `tool_use_id → toolName` map | N/A |
| Discovery | Direct encoded-dir lookup + glob fallback | Dated directory glob (7-day window) |

---

## Adding a New Runtime

`runtimes.mjs` is the only file with structural knowledge of per-runtime formats. Adding a third runtime (e.g. Cursor, Gemini CLI) requires:

1. Add a case to `discoverPaths(runtime)`.
2. Add a case to `encodeCwd(runtime, cwd)`.
3. Add helper functions for session ID extraction and content normalization.
4. Add a case to `extractMeta(runtime, transcriptPath)`.
5. Add a case to `normalizeEntries(runtime, records, opts)`.

Nothing else in the CLI or library stack needs to change.
