# Qwen Code: native session storage reference

[Provider index](00-index.md) · [Schema interpretation guide](../10-schema-guide-and-coverage.md)

**Evidence:** Implemented reader and/or declared type evidence from pinned repository revisions. These are partial observed formats, not vendor-certified schemas. All examples are synthetic.

[C-SCHEMAS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/types/schemas.ts) [C-QWEN](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/qwen-code.ts)

## Storage surfaces and identity

The current reader follows `QWEN_RUNTIME_DIR` or `~/.qwen`, with `projects/<sanitized-cwd>/chats/<session-id>.jsonl`. It also implements a continues-only QWEN_HOME override that is not interchangeable with the upstream runtime-root variable.

The project slug replaces non-alphanumeric characters and can be ambiguous. Prefer record.cwd and sessionId. The code contains recovery logic for multiple concatenated objects or partial writes in a physical line, so decoded record count and physical line count can differ.

## Field dictionary

The tables enumerate the fields modeled in this packet. A listed field is optional unless the linked JSON Schema requires it for that specific carrier. Optional does not mean unimportant: preserve it when present. Unknown fields and unrecognized record variants must remain available for later inspection.

### Qwen Code: observed chat JSONL record

[JSON Schema](../schemas/native/qwen-code-record.schema.json) · [Synthetic example](../examples/native/qwen-code-record.json)

| Field | Type | Information carried |
|---|---|---|
| `uuid` | string | Native record UUID. |
| `parentUuid` | string / null | Parent record UUID, useful for association when direct call IDs are missing. |
| `sessionId` | string | Native session ID. |
| `timestamp` | string | Recorded timestamp string; preserve original representation, parse only when valid. |
| `type` | string | Record type: user, assistant, tool_result, system, or future variant. |
| `subtype` | string | System or other record subtype. |
| `cwd` | string | Recorded working directory. |
| `version` | string | Recorded client version. |
| `gitBranch` | string | Recorded Git branch. |
| `message` | object | Structured carrier; see nested fields. |
| `message.role` | string | Native content role. |
| `message.parts` | array | Structured carrier; see nested fields. |
| `message.parts[].text` | string | Text content. |
| `message.parts[].thought` | boolean | Whether textual part is recorded as thought content. |
| `message.parts[].functionCall` | object | Structured carrier; see nested fields. |
| `message.parts[].functionCall.name` | string | Exact function name. |
| `message.parts[].functionCall.args` | object | Native arguments. |
| `message.parts[].functionCall.id` | string | Call identity when supplied in passthrough fields. |
| `message.parts[].functionResponse` | object | Structured carrier; see nested fields. |
| `message.parts[].functionResponse.name` | string | Function name. |
| `message.parts[].functionResponse.id` | string | Matching call identity when present. |
| `message.parts[].functionResponse.response` | object | Structured carrier; see nested fields. |
| `message.parts[].functionResponse.response.output` | string | Recorded output. |
| `message.parts[].functionResponse.response.status` | string | Recorded status string. |
| `usageMetadata` | object | Structured carrier; see nested fields. |
| `usageMetadata.promptTokenCount` | number | Provider-recorded promptTokenCount; preserve cumulative/per-message distinction. |
| `usageMetadata.candidatesTokenCount` | number | Provider-recorded candidatesTokenCount; preserve cumulative/per-message distinction. |
| `usageMetadata.totalTokenCount` | number | Provider-recorded totalTokenCount; preserve cumulative/per-message distinction. |
| `usageMetadata.cachedContentTokenCount` | number | Provider-recorded cachedContentTokenCount; preserve cumulative/per-message distinction. |
| `usageMetadata.thoughtsTokenCount` | number | Provider-recorded thoughtsTokenCount; preserve cumulative/per-message distinction. |
| `model` | string | Recorded model. |
| `toolCallResult` | object | Structured carrier; see nested fields. |
| `toolCallResult.displayName` | string | Human-facing tool name. |
| `toolCallResult.status` | string | Recorded tool status. |
| `toolCallResult.resultDisplay` | string / object / object | Textual display result. / Other structured display value. |
| `toolCallResult.resultDisplay.fileName` | string | File path/name for displayed diff. |
| `toolCallResult.resultDisplay.fileDiff` | string | Provider diff display. |
| `toolCallResult.resultDisplay.originalContent` | string / null | Original content, if included. |
| `toolCallResult.resultDisplay.diffStat` | object | Structured carrier; see nested fields. |
| `toolCallResult.resultDisplay.diffStat.model_added_lines` | number | Reported added lines. |
| `toolCallResult.resultDisplay.diffStat.model_removed_lines` | number | Reported removed lines. |
| `toolCallResult.resultDisplay.type` | string | Result-display subtype. |
| `systemPayload` | object | Source-specific system metadata. |

## Ordering, correlation, and interpretation

Records have uuid/parentUuid graph identity plus sessionId. Message content contains parts, which can hold text/thought, functionCall, or functionResponse. Calls/results may carry IDs under passthrough spellings id/callId/call_id/toolCallId. When missing, the donor uses parent-record plus function-name associations; record that weaker linkage explicitly.

ToolCallResult/resultDisplay may carry status and file-diff information in addition to the function response. Those are complementary source carriers. Do not assume displayName is the exact executable tool name or that a displayed diff proves the write succeeded.

UsageMetadata has provider-specific token categories. Preserve original counts and their scope; reconstruction/summary stages must not double-count replayed records.

## Fidelity of the inspected tools

The current adapter is more capable than the older root-drift warning: it has runtime-root handling, record schemas, tool-response associations, and malformed/concatenated record recovery. Its exported handoff still uses grouped samples and bounded display. A parser heuristic is not a guarantee that every malformed source can be reconstructed correctly.

## Reuse implications for your scripts

Reuse the explicit ID-first, fallback-qualified correlation approach. Keep a physical source locator with byte span/object position when more than one object occupies a line. Do not reuse the user's logical JSONL offset as if it were the native UUID or physical line number.



## Minimal synthetic example

This demonstrates one known carrier only. It is not a complete session or evidence of a live client capture.

```json
{
  "uuid": "qwen-m2",
  "parentUuid": "qwen-m1",
  "sessionId": "qwen-demo",
  "timestamp": "2026-09-10T12:00:00Z",
  "type": "assistant",
  "cwd": "/workspace/demo",
  "message": {
    "role": "model",
    "parts": [
      {
        "functionCall": {
          "name": "run_shell_command",
          "args": {
            "command": "pnpm test parser"
          },
          "id": "qwen-call-1"
        }
      }
    ]
  }
}
```

## Source anchors

[C-SCHEMAS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/types/schemas.ts) [C-QWEN](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/qwen-code.ts)
