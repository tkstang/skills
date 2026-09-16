# GitHub Copilot CLI: native session storage reference

[Provider index](00-index.md) · [Schema interpretation guide](../10-schema-guide-and-coverage.md)

**Evidence:** Implemented reader and/or declared type evidence from pinned repository revisions. These are partial observed formats, not vendor-certified schemas. All examples are synthetic.

[C-SCHEMAS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/types/schemas.ts) [C-COPILOT](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/copilot.ts)

## Storage surfaces and identity

Session directories live under `$COPILOT_HOME/session-state/<id>/`, defaulting to `~/.copilot/session-state/`. The inspected continues discovery requires `workspace.yaml`, and reads `events.jsonl` for activity. The metadata file and event stream are complementary carriers, not duplicate formats.

Workspace summary, cwd/repository/branch, timestamps and selected model support discovery. They are not proof of a complete conversation or of execution success.

## Field dictionary

The tables enumerate the fields modeled in this packet. A listed field is optional unless the linked JSON Schema requires it for that specific carrier. Optional does not mean unimportant: preserve it when present. Unknown fields and unrecognized record variants must remain available for later inspection.

### Copilot CLI: observed events.jsonl record

[JSON Schema](../schemas/native/copilot-event.schema.json) · [Synthetic example](../examples/native/copilot-event.json)

| Field | Type | Information carried |
|---|---|---|
| `type` | string | Event type, including user.message, assistant.message, tool.execution_start, tool.execution_complete. |
| `id` | string | Native event ID. |
| `timestamp` | string | Recorded timestamp string; preserve original representation, parse only when valid. |
| `parentId` | string / null | Parent event ID; completion can parent its start, and start can parent its message. |
| `data` | object | Structured carrier; see nested fields. |
| `data.sessionId` | string | Native session ID on lifecycle metadata. |
| `data.selectedModel` | string | Selected model, typically start metadata. |
| `data.currentModel` | string | Current model, including shutdown metadata. |
| `data.content` | string | Visible message text when available. |
| `data.transformedContent` | string | Provider-transformed user text fallback. |
| `data.messageId` | string | Provider message identifier when supplied. |
| `data.toolRequests` | array | Requested calls on an assistant message; actual execution can have separate events. |
| `data.toolRequests[].id` | string | Native request ID if present; do not confuse synthetic fallback IDs with native ones. |
| `data.toolRequests[].name` | string | Exact requested tool name. |
| `data.toolRequests[].arguments` | object | Arguments object. |
| `data.toolRequests[].args` | object | Alternative argument object spelling. |
| `data.context` | object | Structured carrier; see nested fields. |
| `data.context.cwd` | string | Working directory. |
| `data.context.gitRoot` | string | Repository root. |
| `data.context.branch` | string | Recorded branch. |
| `data.context.repository` | string | Repository identity. |
| `data.toolName` | string | Tool name on execution start. |
| `data.toolCallId` | string | Invocation identity linking start and completion. |
| `data.arguments` | any JSON | Execution argument carrier; keep original object/string representation. |
| `data.success` | boolean | Provider-recorded completion success. |
| `data.result` | any JSON | Execution result carrier. Full nested schema is not established in this catalog. |
### Copilot CLI: parsed workspace.yaml

[JSON Schema](../schemas/native/copilot-workspace.schema.json) · [Synthetic example](../examples/native/copilot-workspace.json)

| Field | Type | Information carried |
|---|---|---|
| `id` | string | Native session ID. |
| `cwd` | string | Recorded project cwd. |
| `git_root` | string | Recorded repository root. |
| `repository` | string | Repository identity. |
| `branch` | string | Recorded branch. |
| `summary` | string | Workspace summary text, not a substitute for actual message records. |
| `summary_count` | number | Source summary counter; exact production semantics are not established. |
| `created_at` | string | Recorded timestamp string; preserve original representation, parse only when valid. |
| `updated_at` | string | Recorded timestamp string; preserve original representation, parse only when valid. |

## Ordering, correlation, and interpretation

The event graph matters: `tool.execution_start.parentId` can identify its parent message; `tool.execution_complete.parentId` can identify the start event. A separate `data.toolCallId` identifies the invocation. Preserve both relationships.

Assistant `toolRequests` are requests/plans. Separate execution-start and completion events can repeat their information. Do not count these blindly as three distinct invocations. Associate native IDs where available and identify fallbacks explicitly. `data.success` is useful recorded status; a missing success field must remain unknown.

Messages can have `content` and `transformedContent`; preserve provenance when selecting a human-visible rendering. Models may appear on start and shutdown events, so a bounded discovery scan can miss a later model change.

## Fidelity of the inspected tools

The inspected continues Copilot implementation constructs a more explicit tool timeline than its Claude/Codex paths. It first trims conversation, then emits tool events anchored to retained message/start IDs. This still omits events outside that retained neighborhood. Summaries are bounded and merged; the fallback can synthesize conversation-looking context from a workspace summary when messages are absent. Such fallback content is derived, not a native exchange.

## Reuse implications for your scripts

This is useful reference material for explicit lifecycle and event-parent modeling. It is not necessary to add Copilot support to ship the user's first optional flag. When added, keep workspace metadata separate, distinguish planned requests from actual executions, and retain source IDs so callers can audit the donor's merge decisions.



## Minimal synthetic example

This demonstrates one known carrier only. It is not a complete session or evidence of a live client capture.

```json
{
  "type": "tool.execution_complete",
  "id": "event-3",
  "parentId": "event-2",
  "timestamp": "2026-09-10T12:00:00Z",
  "data": {
    "toolCallId": "call-1",
    "success": false,
    "result": "Parser test failed."
  }
}
```

## Source anchors

[C-SCHEMAS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/types/schemas.ts) [C-COPILOT](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/copilot.ts)
