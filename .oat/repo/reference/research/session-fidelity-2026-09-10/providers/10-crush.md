# Crush: native session storage reference

[Provider index](00-index.md) · [Schema interpretation guide](../10-schema-guide-and-coverage.md)

**Evidence:** Implemented reader and/or declared type evidence from pinned repository revisions. These are partial observed formats, not vendor-certified schemas. All examples are synthetic.

[C-CRUSH](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/crush.ts)

## Storage surfaces and identity

Crush stores session/message data in SQLite. The inspected reader supports explicit CRUSH_DB/CRUSH_DB_PATH, CRUSH_DATA_DIR, a global projects.json index, cwd/ancestor `.crush/crush.db`, and a legacy home `.crush/crush.db`. The project index can map a project path to a separate data_dir.

Tables are plural `sessions` and `messages`, unlike OpenCode's singular tables. The reader introspects columns rather than assuming every optional field exists. Session parent_session_id can identify child sessions; top-level discovery may exclude them.

## Field dictionary

The tables enumerate the fields modeled in this packet. A listed field is optional unless the linked JSON Schema requires it for that specific carrier. Optional does not mean unimportant: preserve it when present. Unknown fields and unrecognized record variants must remain available for later inspection.

### Crush: decoded messages.parts array

[JSON Schema](../schemas/native/crush-parts.schema.json) · [Synthetic example](../examples/native/crush-parts.json)

| Field | Type | Information carried |
|---|---|---|
| `[].type` | string | text, reasoning, tool_call, tool_result, or another variant. |
| `[].data` | object | Known nested part payload; some legacy variants flatten fields to the part. |
| `[].data.text` | string | Textual part content. |
| `[].data.thinking` | string | Recorded reasoning content. |
| `[].data.id` | string | Tool-call identity in a call part. |
| `[].data.name` | string | Native tool name. |
| `[].data.tool_call_id` | string | Call/result identity field. |
| `[].data.toolCallId` | string | Alternative call identity spelling. |
| `[].data.input` | any JSON | Tool input, string or structured JSON. |
| `[].data.provider_executed` | boolean | Whether provider executed the call, when recorded. |
| `[].data.finished` | boolean | Whether the call is recorded as finished. |
| `[].data.content` | string | Result text carrier. |
| `[].data.output` | string | Alternative result text carrier. |
| `[].data.result` | string | Alternative result text carrier. |
| `[].data.data` | string | Additional result data payload, potentially encoded. |
| `[].data.mime_type` | string | Result data media type. |
| `[].data.metadata` | string | Serialized provider/tool metadata. |
| `[].data.is_error` | boolean | Recorded result error flag. |
### Crush: inspected sessions/messages row subset

[JSON Schema](../schemas/native/crush-sqlite-row.schema.json) · [Synthetic example](../examples/native/crush-sqlite-row.json)

| Field | Type | Information carried |
|---|---|---|
| `id` | string | Native row ID. |
| `session_id` | string | Owning session of a message row. |
| `parent_session_id` | string / null | Parent session; top-level session discovery can filter this to NULL. |
| `title` | string | Session title. |
| `prompt_tokens` | number | Recorded session prompt tokens. |
| `completion_tokens` | number | Recorded session completion tokens. |
| `cost` | number | Source cost value; unit and aggregation must be verified before financial interpretation. |
| `created_at` | number | Source numeric creation time; normalize units according to actual schema/version. |
| `updated_at` | number | Source numeric update time. |
| `role` | string | Message role: user, assistant, system, tool, or unknown. |
| `parts` | string | JSON-encoded part array; decode using the parts reference. |
| `model` | string | Message model label. |
| `provider` | string | Message provider label. |
| `is_summary_message` | boolean / number | Whether this message is a summary. / SQLite integer Boolean representation. |

## Ordering, correlation, and interpretation

`messages.parts` is a JSON array. Known variants are text, reasoning, tool_call, and tool_result, commonly nested under data. Pair calls and results by the supplied tool_call_id/toolCallId/id fields, retaining the exact originating spelling and native name.

A finished call is not necessarily a successful one. Result is_error is separate; content, binary/encoded data, mime_type, and serialized metadata are separate carriers. Unknown roles/part types should remain counted as coverage gaps.

Numeric created_at/updated_at values need schema/version-aware normalization. Do not infer units from a TS alias alone. Model/provider can be recorded per assistant message; a latest-model list entry is a summary of that history.

## Fidelity of the inspected tools

Continues has a substantially richer current Crush adapter than the old single-global-path description. It reads known rows and decoded parts, reports malformed/unsupported data, and produces tool summaries. That still does not make the summary lossless or recover earlier overwritten row state. The source cost field is preserved metadata, not a validated financial calculation.

## Reuse implications for your scripts

Reuse schema-introspection and decoded-part extraction patterns in a future SQLite provider adapter. Keep source row locators and child-session relationships explicit. Do not transplant OpenCode table names or JSONL state offsets into this provider.



## Minimal synthetic example

This demonstrates one known carrier only. It is not a complete session or evidence of a live client capture.

```json
[
  {
    "type": "tool_call",
    "data": {
      "id": "c1",
      "name": "bash",
      "input": {
        "command": "pnpm test parser"
      },
      "finished": true
    }
  },
  {
    "type": "tool_result",
    "data": {
      "tool_call_id": "c1",
      "name": "bash",
      "content": "Test failed.",
      "is_error": true
    }
  }
]
```

## Source anchors

[C-CRUSH](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/crush.ts)
