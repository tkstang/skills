# OpenCode: native session storage reference

[Provider index](00-index.md) · [Schema interpretation guide](../10-schema-guide-and-coverage.md)

**Evidence:** Implemented reader and/or declared type evidence from pinned repository revisions. These are partial observed formats, not vendor-certified schemas. All examples are synthetic.

[C-SCHEMAS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/types/schemas.ts) [C-OPENCODE](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/opencode.ts) [R-README](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/README.md)

## Storage surfaces and identity

Newer surface: SQLite databases under the OpenCode data root, with singular `session`, `project`, `message`, and `part` tables. Legacy surface: `storage/session/<project>/ses_*.json`, `storage/message/<session>/msg_*.json`, `storage/part/<message>/prt_*.json`, and `storage/project/<id>.json`.

Session metadata supplies ID/title/directory/project/time. Message and part IDs form a relational graph. Reading the session row alone is not reading the session. The inspected adapter uses SQLite first and legacy JSON as a fallback; it does not imply both stores have been exhaustively merged.

## Field dictionary

The tables enumerate the fields modeled in this packet. A listed field is optional unless the linked JSON Schema requires it for that specific carrier. Optional does not mean unimportant: preserve it when present. Unknown fields and unrecognized record variants must remain available for later inspection.

### OpenCode: decoded part JSON subset

[JSON Schema](../schemas/native/opencode-part.schema.json) · [Synthetic example](../examples/native/opencode-part.json)

| Field | Type | Information carried |
|---|---|---|
| `id` | string | Part ID. |
| `sessionID` | string | Owning session ID. |
| `messageID` | string | Owning message ID. |
| `type` | string | Part variant: text, tool, patch, or other native type. |
| `text` | string | Text content or patch carrier on applicable variants. |
| `tool` | string | Exact native tool name on type=tool. |
| `state` | object | State held on a tool part; a snapshot is not necessarily a history of transitions. |
| `state.status` | string | Recorded tool state; error is recognized explicitly. |
| `state.input` | object | Native tool arguments. |
| `state.output` | any JSON | Tool output; preserve structured values. |
| `state.error` | any JSON | Tool error carrier. |
| `state.metadata` | object | Tool-specific metadata. |
| `state.metadata.exit` | number | Recorded exit code when exposed under this spelling. |
| `state.metadata.exitCode` | number | Alternative recorded exit-code spelling. |
| `state.metadata.count` | number | Recorded result/match count. |
| `state.metadata.resultCount` | number | Alternative result-count field. |
| `state.metadata.matchCount` | number | Recorded grep match count. |
| `files` | array | Structured carrier; see nested fields. |
| `patch` | string | Patch-text carrier. |
| `diff` | string | Diff-text carrier. |
### OpenCode: inspected SQLite row columns

[JSON Schema](../schemas/native/opencode-sqlite-row.schema.json) · [Synthetic example](../examples/native/opencode-sqlite-row.json)

| Field | Type | Information carried |
|---|---|---|
| `id` | string | Row primary identifier. |
| `project_id` | string | Session-to-project foreign key. |
| `session_id` | string | Owning session foreign key on message/part rows. |
| `message_id` | string | Owning message foreign key on part rows. |
| `slug` | string | Session display slug. |
| `directory` | string | Session working directory. |
| `worktree` | string | Project worktree/root directory. |
| `title` | string | Session title. |
| `version` | string | Recorded client/data version. |
| `summary_additions` | number / null | Provider summary additions count. |
| `summary_deletions` | number / null | Provider summary deletions count. |
| `summary_files` | number / null | Provider summary file count. |
| `time_created` | number | Numeric timestamp interpreted as milliseconds since Unix epoch by the inspected reader. |
| `time_updated` | number | Numeric timestamp interpreted as milliseconds since Unix epoch by the inspected reader. |
| `data` | string | JSON-encoded message/part object. Decode separately; do not flatten without preserving the original row. |

## Ordering, correlation, and interpretation

For SQLite, select messages by `session_id` and parts by `message_id`; retain row IDs and decoded JSON pointers. `data` is serialized JSON, not plain transcript text. The legacy JSON message includes role, time.created/time.completed, path.cwd/root, and optional summary.title. Legacy session metadata includes projectID, directory, title, time.created/updated, summary.additions/deletions/files.

Tool parts carry `type: tool`, `tool`, and `state` with input/output/error/status/metadata. A database row can represent latest state rather than every intermediate transition. `metadata.exit` or `exitCode` is stronger execution evidence than a regex over output. Preserve absent status as unknown.

Patch parts can carry files/patch/diff/text. These identify recorded operations or artifacts, not necessarily a complete current Git working-tree diff.

## Fidelity of the inspected tools

Continues extracts useful shell, file, patch, and MCP details from tool state but applies preview limits and grouping. It reads databases read-only; that does not by itself create an immutable snapshot for concurrent analysis. ccrider adds searchable history/resume support, but its public message response is still a projection.

## Reuse implications for your scripts

A later adapter can expose a source reference such as database path + table + primary key + JSON pointer. Do not reuse JSONL record offsets for SQLite. Use a consistent read transaction or snapshot for batch retros when stability matters; defer that machinery until OpenCode support is actually needed.



## Minimal synthetic example

This demonstrates one known carrier only. It is not a complete session or evidence of a live client capture.

```json
{
  "id": "prt_demo",
  "sessionID": "ses_demo",
  "messageID": "msg_demo",
  "type": "tool",
  "tool": "bash",
  "state": {
    "status": "completed",
    "input": {
      "command": "pnpm test parser"
    },
    "output": "All tests passed.",
    "metadata": {
      "exit": 0
    }
  }
}
```

## Source anchors

[C-SCHEMAS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/types/schemas.ts) [C-OPENCODE](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/opencode.ts) [R-README](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/README.md)
