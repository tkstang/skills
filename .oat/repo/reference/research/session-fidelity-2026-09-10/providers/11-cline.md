# Cline: native session storage reference

[Provider index](00-index.md) · [Schema interpretation guide](../10-schema-guide-and-coverage.md)

**Evidence:** Implemented reader and/or declared type evidence from pinned repository revisions. These are partial observed formats, not vendor-certified schemas. All examples are synthetic.

[C-CLINE](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/cline.ts) [C-REGISTRY](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/registry.ts)

## Storage surfaces and identity

Legacy task directories live below an editor globalStorage root for `saoudrizwan.claude-dev`. The current shared reader checks Code, Insiders, Cursor, Windsurf, remote-server locations, and provider-specific custom storage overrides. Each task can include `ui_messages.json`, `api_conversation_history.json`, `task_metadata.json`, and history/index companions.

Cline is the base legacy task format in this shared reader.

## Field dictionary

The tables enumerate the fields modeled in this packet. A listed field is optional unless the linked JSON Schema requires it for that specific carrier. Optional does not mean unimportant: preserve it when present. Unknown fields and unrecognized record variants must remain available for later inspection.

### cline: legacy ui_messages.json entries

[JSON Schema](../schemas/native/cline-ui.schema.json) · [Synthetic example](../examples/native/cline-ui.json)

| Field | Type | Information carried |
|---|---|---|
| `[].ts` | number | Source numeric timestamp; validate unit with actual captured version. |
| `[].type` | string | UI event discriminator, commonly say or ask. |
| `[].say` | string | Say subtype, not a speaker role by itself. |
| `[].ask` | string | Ask subtype, not necessarily a completed human exchange. |
| `[].text` | string | UI text; may itself contain serialized structured content. |
| `[].reasoning` | string | Recorded reasoning display text. |
| `[].images` | array | Structured carrier; see nested fields. |
| `[].files` | array | Structured carrier; see nested fields. |
| `[].partial` | boolean | Streaming/partial update state. |
| `[].modelInfo` | object | Structured carrier; see nested fields. |
| `[].modelInfo.modelId` | string | Model identity. |
| `[].modelInfo.providerId` | string | Provider identity. |
| `[].modelInfo.mode` | string | Recorded agent mode. |
### cline: legacy api_conversation_history.json

[JSON Schema](../schemas/native/cline-api.schema.json) · [Synthetic example](../examples/native/cline-api.json)

| Field | Type | Information carried |
|---|---|---|
| `[].id` | string | Native message identifier when recorded. |
| `[].role` | string | API conversation carrier role. |
| `[].content` | string / array | Native content carrier; inspect block discriminators before flattening. |
| `[].content[].type` | string | Content-block discriminator; unknown variants must remain reachable. |
| `[].content[].text` | string | Text content when this block is textual. |
| `[].content[].thinking` | string | Recorded thinking text, when present; not a guarantee of all model reasoning. |
| `[].content[].id` | string | Tool-call/block identifier when present. |
| `[].content[].name` | string | Exact tool name, including namespace when encoded here. |
| `[].content[].input` | any JSON | Native tool input, commonly an object; preserve original value. |
| `[].content[].tool_use_id` | string | Identifier linking a result block to a tool_use block. |
| `[].content[].content` | any JSON | Result payload, either string, nested blocks, or another source-specific value. |
| `[].content[].is_error` | boolean | Provider-recorded tool-result error flag; absence is unknown, not success. |
| `[].ts` | number | Source numeric timestamp, where present. |
| `[].modelInfo` | object | Structured carrier; see nested fields. |
| `[].modelInfo.modelId` | string | Model identity. |
| `[].modelInfo.providerId` | string | Provider identity. |
| `[].modelInfo.mode` | string | Recorded agent mode. |
| `[].metrics` | object | Source metrics object; not fully specified by inspected type. |

## Ordering, correlation, and interpretation

UI messages describe presentation and interaction: type/say/ask/text/partial are not identical to API roles or execution records. API conversation history can carry tool_use/tool_result blocks and fuller arguments/results. Use both sources for their distinct evidence, but do not concatenate them and double-count the same action.

Streaming partial UI records may later be replaced or completed. Preserve partial state and source identity. A UI ask can mean an approval or tool interaction rather than a literal human message. API user-role tool-result blocks are not necessarily authored by the operator.

Pair API calls/results using native IDs. Retain images/files references and thinking content as separately governed source payloads rather than pretending every block is conversational text.

## Fidelity of the inspected tools

The current shared continues reader checks more than UI text: it can load API history and task metadata, track present-but-broken companion files, and summarize tool data. It still applies readability filtering and sampling. Missing companions and broken companions are different conditions; absence from one carrier does not prove absence from another.

The registry's editor launch action may merely start the editor without passing a selected task identity. A parser adapter does not guarantee exact native task resume.

## Reuse implications for your scripts

Reuse the API-history correlation pattern and companion-file separation if support is later needed. Keep the task ID, surface, and file/array-index pointers. Do not generalize UI `say`/`ask` strings into universal tool lifecycle states. The first optional observer/exporter feature can ship without adding editor-globalStorage support.

## Task companion field dictionary

| File/carrier | Known fields | Meaning |
|---|---|---|
| `task_metadata.json` | `model_usage[]`, `files_in_context[]`, `environment_history[]` | Source metadata arrays; inner shapes remain provider/version-specific. |
| `taskHistory.json`, `history_item.json`, `_index.json` entries | `id`, `ts`, `task` | Task identity, time, and description. Index container shapes vary. |
| History item | `tokensIn`, `tokensOut`, `cacheWrites`, `cacheReads` | Recorded usage categories, not automatically additive across snapshots. |
| History item | `cwdOnTaskInitialization`, `workspace` | Workspace identity hints. Prefer explicit values over folder-name inference. |
| History item | `modelId`, `mode`, `status`, `apiConfigName` | Model/mode/status/configuration metadata. A configuration name is not a credential. |

The companion metadata dictionaries are source-backed subsets, not complete executable validators. Preserve the raw companion objects and validate their containers before reading nested fields.


## Minimal synthetic example

This demonstrates one known carrier only. It is not a complete session or evidence of a live client capture.

```json
[
  {
    "ts": 1789041600000,
    "type": "say",
    "say": "text",
    "text": "Reviewing the parser.",
    "partial": false
  }
]
```

## Source anchors

[C-CLINE](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/cline.ts) [C-REGISTRY](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/registry.ts)
