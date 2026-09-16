# Gemini CLI: native session storage reference

[Provider index](00-index.md) · [Schema interpretation guide](../10-schema-guide-and-coverage.md)

**Evidence:** Implemented reader and/or declared type evidence from pinned repository revisions. These are partial observed formats, not vendor-certified schemas. All examples are synthetic.

[C-SCHEMAS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/types/schemas.ts) [C-GEMINI](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/gemini.ts)

## Storage surfaces and identity

The inspected reader resolves a home base through `GEMINI_CLI_HOME` and then `.gemini/tmp/<project-id>/chats/`. It reads newer `.jsonl` files and legacy `session-*.json` files, plus `.gemini/sessions/*.json`. `.gemini/projects.json` maps working directories to project IDs; session metadata can also record `directories[]`.

Be careful with environment-variable interpretation: this adapter treats GEMINI_CLI_HOME as a base to which `.gemini` is appended. Verify a local installation rather than assuming every provider root override means the same thing.

## Field dictionary

The tables enumerate the fields modeled in this packet. A listed field is optional unless the linked JSON Schema requires it for that specific carrier. Optional does not mean unimportant: preserve it when present. Unknown fields and unrecognized record variants must remain available for later inspection.

### Gemini CLI: observed JSONL metadata/message/mutation record

[JSON Schema](../schemas/native/gemini-record.schema.json) · [Synthetic example](../examples/native/gemini-record.json)

| Field | Type | Information carried |
|---|---|---|
| `sessionId` | string | Native session ID. |
| `projectHash` | string | Provider project key; resolve through metadata/mapping instead of reversing hash. |
| `startTime` | string | Recorded timestamp string; preserve original representation, parse only when valid. |
| `lastUpdated` | string | Recorded timestamp string; preserve original representation, parse only when valid. |
| `directories` | array | Structured carrier; see nested fields. |
| `summary` | string | Recorded summary text. |
| `id` | string | Message identity; repeated IDs can replace an earlier message in JSONL reconstruction. |
| `timestamp` | string | Recorded timestamp string; preserve original representation, parse only when valid. |
| `type` | string | Message role/type as stored by Gemini. |
| `content` | string / array | Message text. |
| `content[].type` | string | Content variant. |
| `content[].text` | string | Text block. |
| `toolCalls` | array | Structured carrier; see nested fields. |
| `toolCalls[].id` | string | Tool-call identity when present. |
| `toolCalls[].name` | string | Exact native function name. |
| `toolCalls[].displayName` | string | Human-facing tool label; retain native name separately. |
| `toolCalls[].description` | string | Tool description recorded by client. |
| `toolCalls[].timestamp` | string | Recorded timestamp string; preserve original representation, parse only when valid. |
| `toolCalls[].args` | object | Native argument object. |
| `toolCalls[].result` | array | Recorded tool results; preserve every response block. |
| `toolCalls[].result[].functionResponse` | object | Structured carrier; see nested fields. |
| `toolCalls[].result[].functionResponse.id` | string | Function response/call identity. |
| `toolCalls[].result[].functionResponse.name` | string | Function name in response. |
| `toolCalls[].result[].functionResponse.response` | object | Response payload; preserve other fields. |
| `toolCalls[].result[].functionResponse.response.output` | string | Textual output. |
| `toolCalls[].result[].functionResponse.response.error` | string | Textual error. |
| `toolCalls[].status` | string | Recorded tool lifecycle/result status. |
| `toolCalls[].resultDisplay` | string / object | Human-facing result. |
| `toolCalls[].resultDisplay.fileName` | string | Display filename. |
| `toolCalls[].resultDisplay.filePath` | string | Native file path. |
| `toolCalls[].resultDisplay.fileDiff` | string | Provider-supplied diff display. |
| `toolCalls[].resultDisplay.originalContent` | string | Recorded before-content. |
| `toolCalls[].resultDisplay.newContent` | string | Recorded after-content. |
| `toolCalls[].resultDisplay.renderOutputAsMarkdown` | boolean | Display hint, not executable content. |
| `toolCalls[].resultDisplay.diffStat` | object | Structured carrier; see nested fields. |
| `toolCalls[].resultDisplay.diffStat.model_added_lines` | number | Provider-reported added lines. |
| `toolCalls[].resultDisplay.diffStat.model_removed_lines` | number | Provider-reported removed lines. |
| `toolCalls[].resultDisplay.isNewFile` | boolean | Recorded new-file indication. |
| `thoughts` | array | Structured carrier; see nested fields. |
| `thoughts[].subject` | string | Recorded thought subject. |
| `thoughts[].description` | string | Recorded thought description. |
| `thoughts[].timestamp` | string | Recorded timestamp string; preserve original representation, parse only when valid. |
| `model` | string | Recorded model for this message. |
| `tokens` | object | Structured carrier; see nested fields. |
| `tokens.input` | number | Provider-recorded input token count; preserve category semantics. |
| `tokens.output` | number | Provider-recorded output token count; preserve category semantics. |
| `tokens.cached` | number | Provider-recorded cached token count; preserve category semantics. |
| `tokens.thoughts` | number | Provider-recorded thoughts token count; preserve category semantics. |
| `tokens.tool` | number | Provider-recorded tool token count; preserve category semantics. |
| `tokens.total` | number | Provider-recorded total token count; preserve category semantics. |
| `$set` | object | Partial session-state update. |
| `$set.sessionId` | string | Native session ID. |
| `$set.projectHash` | string | Provider project key; resolve through metadata/mapping instead of reversing hash. |
| `$set.startTime` | string | Recorded timestamp string; preserve original representation, parse only when valid. |
| `$set.lastUpdated` | string | Recorded timestamp string; preserve original representation, parse only when valid. |
| `$set.directories` | array | Structured carrier; see nested fields. |
| `$set.summary` | string | Recorded summary text. |
| `$rewindTo` | string | Message ID at which the inspected adapter truncates the active message list, excluding the target. |
### Gemini CLI: observed whole-session JSON

[JSON Schema](../schemas/native/gemini-session.schema.json) · [Synthetic example](../examples/native/gemini-session.json)

| Field | Type | Information carried |
|---|---|---|
| `sessionId` | string | Native session ID. |
| `projectHash` | string | Provider project key; resolve through metadata/mapping instead of reversing hash. |
| `startTime` | string | Recorded timestamp string; preserve original representation, parse only when valid. |
| `lastUpdated` | string | Recorded timestamp string; preserve original representation, parse only when valid. |
| `directories` | array | Structured carrier; see nested fields. |
| `summary` | string | Recorded summary text. |
| `messages` | array | Structured carrier; see nested fields. |
| `messages[].id` | string | Message identity; repeated IDs can replace an earlier message in JSONL reconstruction. |
| `messages[].timestamp` | string | Recorded timestamp string; preserve original representation, parse only when valid. |
| `messages[].type` | string | Message role/type as stored by Gemini. |
| `messages[].content` | string / array | Message text. |
| `messages[].content[].type` | string | Content variant. |
| `messages[].content[].text` | string | Text block. |
| `messages[].toolCalls` | array | Structured carrier; see nested fields. |
| `messages[].toolCalls[].id` | string | Tool-call identity when present. |
| `messages[].toolCalls[].name` | string | Exact native function name. |
| `messages[].toolCalls[].displayName` | string | Human-facing tool label; retain native name separately. |
| `messages[].toolCalls[].description` | string | Tool description recorded by client. |
| `messages[].toolCalls[].timestamp` | string | Recorded timestamp string; preserve original representation, parse only when valid. |
| `messages[].toolCalls[].args` | object | Native argument object. |
| `messages[].toolCalls[].result` | array | Recorded tool results; preserve every response block. |
| `messages[].toolCalls[].result[].functionResponse` | object | Structured carrier; see nested fields. |
| `messages[].toolCalls[].result[].functionResponse.id` | string | Function response/call identity. |
| `messages[].toolCalls[].result[].functionResponse.name` | string | Function name in response. |
| `messages[].toolCalls[].result[].functionResponse.response` | object | Response payload; preserve other fields. |
| `messages[].toolCalls[].result[].functionResponse.response.output` | string | Textual output. |
| `messages[].toolCalls[].result[].functionResponse.response.error` | string | Textual error. |
| `messages[].toolCalls[].status` | string | Recorded tool lifecycle/result status. |
| `messages[].toolCalls[].resultDisplay` | string / object | Human-facing result. |
| `messages[].toolCalls[].resultDisplay.fileName` | string | Display filename. |
| `messages[].toolCalls[].resultDisplay.filePath` | string | Native file path. |
| `messages[].toolCalls[].resultDisplay.fileDiff` | string | Provider-supplied diff display. |
| `messages[].toolCalls[].resultDisplay.originalContent` | string | Recorded before-content. |
| `messages[].toolCalls[].resultDisplay.newContent` | string | Recorded after-content. |
| `messages[].toolCalls[].resultDisplay.renderOutputAsMarkdown` | boolean | Display hint, not executable content. |
| `messages[].toolCalls[].resultDisplay.diffStat` | object | Structured carrier; see nested fields. |
| `messages[].toolCalls[].resultDisplay.diffStat.model_added_lines` | number | Provider-reported added lines. |
| `messages[].toolCalls[].resultDisplay.diffStat.model_removed_lines` | number | Provider-reported removed lines. |
| `messages[].toolCalls[].resultDisplay.isNewFile` | boolean | Recorded new-file indication. |
| `messages[].thoughts` | array | Structured carrier; see nested fields. |
| `messages[].thoughts[].subject` | string | Recorded thought subject. |
| `messages[].thoughts[].description` | string | Recorded thought description. |
| `messages[].thoughts[].timestamp` | string | Recorded timestamp string; preserve original representation, parse only when valid. |
| `messages[].model` | string | Recorded model for this message. |
| `messages[].tokens` | object | Structured carrier; see nested fields. |
| `messages[].tokens.input` | number | Provider-recorded input token count; preserve category semantics. |
| `messages[].tokens.output` | number | Provider-recorded output token count; preserve category semantics. |
| `messages[].tokens.cached` | number | Provider-recorded cached token count; preserve category semantics. |
| `messages[].tokens.thoughts` | number | Provider-recorded thoughts token count; preserve category semantics. |
| `messages[].tokens.tool` | number | Provider-recorded tool token count; preserve category semantics. |
| `messages[].tokens.total` | number | Provider-recorded total token count; preserve category semantics. |

## Ordering, correlation, and interpretation

JSONL reconstruction is stateful. Plain session metadata and `$set` update session state. A message with an existing ID replaces that active message at its original position. `$rewindTo` causes the inspected adapter to discard the target message and those after it; this is the adapter's observed behavior, not a claim about every upstream writer release.

Store or retain access to the mutation records if reviewing failed attempts. The reconstructed final conversation can intentionally omit rewound work. Tool calls/results often live together in `messages[].toolCalls[]`, with result function-response blocks and status. Preserve all result blocks and the exact tool identity before summary creation.

Token and thought fields are source-specific. A human-readable `resultDisplay.fileDiff` is not interchangeable with the underlying function-response payload.

## Fidelity of the inspected tools

Current source supports JSONL and mutations, contrary to the older April overview's JSON-only warning. Extraction still creates a bounded handoff and selected notes; a complete scan does not mean the active message view preserves all historical revisions. Unknown JSONL records can become session-state fields in the current reader, so do not treat successful parsing as proof that all event semantics were understood.

## Reuse implications for your scripts

Reuse typed tool-call/result extraction and the mutation reconstruction rules as a separate provider adapter. For a retro-oriented view, keep active-state and append-history projections distinct; otherwise the evaluator cannot see the attempts a rewind removed. No Gemini implementation is required for the Claude/Codex first milestone.



## Minimal synthetic example

This demonstrates one known carrier only. It is not a complete session or evidence of a live client capture.

```json
{
  "id": "gem-msg-1",
  "timestamp": "2026-09-10T12:00:00Z",
  "type": "gemini",
  "content": "Checking the parser.",
  "toolCalls": [
    {
      "id": "gem-call-1",
      "name": "run_shell_command",
      "args": {
        "command": "pnpm test parser"
      },
      "status": "success",
      "result": [
        {
          "functionResponse": {
            "id": "gem-call-1",
            "name": "run_shell_command",
            "response": {
              "output": "All tests passed."
            }
          }
        }
      ]
    }
  ]
}
```

## Source anchors

[C-SCHEMAS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/types/schemas.ts) [C-GEMINI](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/gemini.ts)
