# Kimi: native session storage reference

[Provider index](00-index.md) · [Schema interpretation guide](../10-schema-guide-and-coverage.md)

**Evidence:** Implemented reader and/or declared type evidence from pinned repository revisions. These are partial observed formats, not vendor-certified schemas. All examples are synthetic.

[C-SCHEMAS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/types/schemas.ts) [C-KIMI](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/kimi.ts)

## Storage surfaces and identity

Root: `$KIMI_SHARE_DIR` or `~/.kimi`. Sessions commonly occupy `sessions/<workdir-hash>/<session-id>/context.jsonl`, with `state.json`, legacy `metadata.json`, and separate wire-log data. Legacy flat JSONL contexts are also discovered.

`kimi.json` work_dirs can contain paths or path/kaos entries. The reader derives an MD5 directory key and can handle a non-local KAOS prefix. Hash lookup is a mapping operation, not reliable reverse-decoding.

## Field dictionary

The tables enumerate the fields modeled in this packet. A listed field is optional unless the linked JSON Schema requires it for that specific carrier. Optional does not mean unimportant: preserve it when present. Unknown fields and unrecognized record variants must remain available for later inspection.

### Kimi: observed context.jsonl record subset

[JSON Schema](../schemas/native/kimi-context-record.schema.json) · [Synthetic example](../examples/native/kimi-context-record.json)

| Field | Type | Information carried |
|---|---|---|
| `role` | string | Native conversation role, including tool result carriers. |
| `content` | string / array | Native content carrier; inspect block discriminators before flattening. |
| `content[].type` | string | Content-block discriminator; unknown variants must remain reachable. |
| `content[].text` | string | Text content when this block is textual. |
| `content[].thinking` | string | Recorded thinking text, when present; not a guarantee of all model reasoning. |
| `content[].id` | string | Tool-call/block identifier when present. |
| `content[].name` | string | Exact tool name, including namespace when encoded here. |
| `content[].input` | any JSON | Native tool input, commonly an object; preserve original value. |
| `content[].tool_use_id` | string | Identifier linking a result block to a tool_use block. |
| `content[].content` | any JSON | Result payload, either string, nested blocks, or another source-specific value. |
| `content[].is_error` | boolean | Provider-recorded tool-result error flag; absence is unknown, not success. |
| `tool_calls` | array | Structured carrier; see nested fields. |
| `tool_calls[].type` | constant | Function-call variant. |
| `tool_calls[].id` | string | Native invocation ID. |
| `tool_calls[].function` | object | Structured carrier; see nested fields. |
| `tool_calls[].function.name` | string | Exact function name. |
| `tool_calls[].function.arguments` | string | JSON-encoded argument string; retain raw when undecodable. |
| `tool_call_id` | string | Result-to-call identity on tool messages. |
| `id` | number | Numeric record/control identifier in the declared subset; do not assume it is a session ID. |
### Kimi: observed state/metadata JSON subset

[JSON Schema](../schemas/native/kimi-state.schema.json) · [Synthetic example](../examples/native/kimi-state.json)

| Field | Type | Information carried |
|---|---|---|
| `session_id` | string | Native session ID. |
| `title` | string | Generated/default title. |
| `custom_title` | string | Explicit title preferred by the inspected state reader. |
| `title_generated` | boolean | Whether title was generated. |
| `archived` | boolean | Whether session is marked archived. |
| `archived_at` | string / number / null | Recorded timestamp string; preserve original representation, parse only when valid. / Native numeric archive time. |
| `wire_mtime` | number / null | Wire-log modification indicator as stored by source; not itself a conversation event. |

## Ordering, correlation, and interpretation

Context messages use role/content, assistant tool_calls with function.name and JSON-encoded arguments, and result tool_call_id correlation. Keep raw argument strings when parsing fails. A numeric id in a context/control record is not automatically the session identity.

State metadata takes precedence over legacy metadata when a field is explicitly present; false archived and null wire_mtime are meaningful values, not missing defaults. A custom_title can supersede a generated title.

The inspected reader also inventories wire metadata/record types, but this catalog does not claim a complete wire-protocol event schema. Context replay and raw wire events can retain different information.

## Fidelity of the inspected tools

The current context reader tracks raw line counts and dropped records and supports state/metadata evolution. Context summarization remains a lossy view, and a full context file is not necessarily all historical wire activity. The permissive schema intentionally does not fabricate detailed wire records.

## Reuse implications for your scripts

Reuse function-call/result matching for a later provider adapter, but keep Kimi metadata precedence and context versus wire surfaces explicit. A minimal optional activity port does not need to add Kimi immediately. Preserve dropped-record counts as coverage data rather than silently hiding malformed lines.



## Minimal synthetic example

This demonstrates one known carrier only. It is not a complete session or evidence of a live client capture.

```json
{
  "role": "assistant",
  "content": "I will inspect the parser.",
  "tool_calls": [
    {
      "type": "function",
      "id": "kimi-call-1",
      "function": {
        "name": "ReadFile",
        "arguments": "{\"path\":\"src/parser.ts\"}"
      }
    }
  ]
}
```

## Source anchors

[C-SCHEMAS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/types/schemas.ts) [C-KIMI](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/kimi.ts)
