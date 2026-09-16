# Kiro IDE, persisted logs, and ACP: native session storage reference

[Provider index](00-index.md) · [Schema interpretation guide](../10-schema-guide-and-coverage.md)

**Evidence:** Implemented reader and/or declared type evidence from pinned repository revisions. These are partial observed formats, not vendor-certified schemas. All examples are synthetic.

[C-KIRO](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/kiro.ts)

## Storage surfaces and identity

There are multiple separate surfaces. IDE workspace sessions are found under OS-specific `Kiro/User/globalStorage/kiro.kiroagent/workspace-sessions/`, with base64url-like workspace folders, `sessions.json` indexes, and `<id>.json` session objects. An older app-support workspace-sessions root remains a fallback.

The inspected ACP/persisted path is `~/.kiro/sessions/cli/<id>.json` plus sibling `.jsonl`, including orphan JSONL discovery. A different ordinary CLI SQLite store is explicitly skipped by this adapter; references include `.kiro` locations and macOS `~/Library/Application Support/kiro-cli/data.sqlite3`. Its complete native database schema is not established here.

## Field dictionary

The tables enumerate the fields modeled in this packet. A listed field is optional unless the linked JSON Schema requires it for that specific carrier. Optional does not mean unimportant: preserve it when present. Unknown fields and unrecognized record variants must remain available for later inspection.

### Kiro IDE: observed workspace JSON subset

[JSON Schema](../schemas/native/kiro-ide-session.schema.json) · [Synthetic example](../examples/native/kiro-ide-session.json)

| Field | Type | Information carried |
|---|---|---|
| `sessionId` | string | Session identity used by index/metadata variants. |
| `id` | string | Alternative session identity. |
| `conversationId` | string | Alternative conversation identity. |
| `history` | array | Structured carrier; see nested fields. |
| `history[].role` | string | user/human or assistant/ai aliases accepted by adapter. |
| `history[].content` | any JSON | Text or content-block carrier. |
| `history[].text` | string | Alternative text carrier. |
| `history[].timestamp` | string / number | Timestamp representation varies between the local and export surfaces. |
| `history[].createdAt` | string / number | Timestamp representation varies between the local and export surfaces. |
| `history[].message` | object | Structured carrier; see nested fields. |
| `history[].message.role` | string | Nested role alias. |
| `history[].message.content` | any JSON | Nested content carrier. |
| `history[].message.timestamp` | string / number | Timestamp representation varies between the local and export surfaces. |
| `history[].message.createdAt` | string / number | Timestamp representation varies between the local and export surfaces. |
| `history[].message.dateCreated` | string / number | Timestamp representation varies between the local and export surfaces. |
| `messages` | array | Structured carrier; see nested fields. |
| `messages[].role` | string | user/human or assistant/ai aliases accepted by adapter. |
| `messages[].content` | any JSON | Text or content-block carrier. |
| `messages[].text` | string | Alternative text carrier. |
| `messages[].timestamp` | string / number | Timestamp representation varies between the local and export surfaces. |
| `messages[].createdAt` | string / number | Timestamp representation varies between the local and export surfaces. |
| `messages[].message` | object | Structured carrier; see nested fields. |
| `messages[].message.role` | string | Nested role alias. |
| `messages[].message.content` | any JSON | Nested content carrier. |
| `messages[].message.timestamp` | string / number | Timestamp representation varies between the local and export surfaces. |
| `messages[].message.createdAt` | string / number | Timestamp representation varies between the local and export surfaces. |
| `messages[].message.dateCreated` | string / number | Timestamp representation varies between the local and export surfaces. |
### Kiro: observed persisted JSONL envelopes

[JSON Schema](../schemas/native/kiro-persisted-record.schema.json) · [Synthetic example](../examples/native/kiro-persisted-record.json)

| Field | Type | Information carried |
|---|---|---|
| `AssistantMessage` | object | Structured carrier; see nested fields. |
| `AssistantMessage.content` | any JSON | Persisted message/result carrier; full native payload is not established. |
| `AssistantMessage.text` | string | Text fallback. |
| `AssistantMessage.message` | any JSON | Alternative nested message carrier. |
| `AssistantMessage.timestamp` | string / number | Timestamp representation varies between the local and export surfaces. |
| `UserMessage` | object | Structured carrier; see nested fields. |
| `UserMessage.content` | any JSON | Persisted message/result carrier; full native payload is not established. |
| `UserMessage.text` | string | Text fallback. |
| `UserMessage.message` | any JSON | Alternative nested message carrier. |
| `UserMessage.timestamp` | string / number | Timestamp representation varies between the local and export surfaces. |
| `ToolResults` | object | Structured carrier; see nested fields. |
| `ToolResults.content` | any JSON | Persisted message/result carrier; full native payload is not established. |
| `ToolResults.text` | string | Text fallback. |
| `ToolResults.message` | any JSON | Alternative nested message carrier. |
| `ToolResults.timestamp` | string / number | Timestamp representation varies between the local and export surfaces. |
| `assistantMessage` | object | Structured carrier; see nested fields. |
| `assistantMessage.content` | any JSON | Persisted message/result carrier; full native payload is not established. |
| `assistantMessage.text` | string | Text fallback. |
| `assistantMessage.message` | any JSON | Alternative nested message carrier. |
| `assistantMessage.timestamp` | string / number | Timestamp representation varies between the local and export surfaces. |
| `userMessage` | object | Structured carrier; see nested fields. |
| `userMessage.content` | any JSON | Persisted message/result carrier; full native payload is not established. |
| `userMessage.text` | string | Text fallback. |
| `userMessage.message` | any JSON | Alternative nested message carrier. |
| `userMessage.timestamp` | string / number | Timestamp representation varies between the local and export surfaces. |
| `toolResults` | object | Structured carrier; see nested fields. |
| `toolResults.content` | any JSON | Persisted message/result carrier; full native payload is not established. |
| `toolResults.text` | string | Text fallback. |
| `toolResults.message` | any JSON | Alternative nested message carrier. |
| `toolResults.timestamp` | string / number | Timestamp representation varies between the local and export surfaces. |
### Kiro: reader-supported ACP JSON-RPC subset

[JSON Schema](../schemas/native/kiro-acp-record.schema.json) · [Synthetic example](../examples/native/kiro-acp-record.json)

| Field | Type | Information carried |
|---|---|---|
| `jsonrpc` | string | JSON-RPC protocol label on wire captures. |
| `id` | string / number | Request/response identity. / Numeric request/response identity. |
| `method` | string | Method, including session/prompt or session/update. |
| `params` | object | Structured carrier; see nested fields. |
| `params.sessionId` | string | Session identity when supplied. |
| `params.prompt` | any JSON | Native prompt payload. Confirm exact prompt shape against a captured client version. |
| `params.content` | any JSON | Alternate content carrier. |
| `params.update` | object | Structured carrier; see nested fields. |
| `params.update.sessionUpdate` | string | ACP update discriminator, such as agent_message_chunk or tool_call_update. |
| `params.update.type` | string | Compatibility discriminator accepted by parser. |
| `params.update.kind` | string | Compatibility discriminator accepted by parser. |
| `params.update.updateType` | string | Compatibility discriminator accepted by parser. |
| `params.update.eventType` | string | Compatibility discriminator accepted by parser. |
| `params.update.content` | any JSON | Text/content chunk or tool-specific carrier. |
| `params.update.text` | string | Alternative text chunk. |
| `params.update.message` | any JSON | Alternative nested message carrier. |
| `params.update.delta` | any JSON | Alternative delta carrier. |
| `params.update.chunk` | any JSON | Alternative chunk carrier. |
| `result` | object | Structured carrier; see nested fields. |
| `result.stopReason` | string | Recorded terminal reason, such as end_turn, max_tokens, or cancelled. |
| `timestamp` | string / number | Timestamp representation varies between the local and export surfaces. |
| `update` | object | Structured carrier; see nested fields. |
| `update.sessionUpdate` | string | ACP update discriminator, such as agent_message_chunk or tool_call_update. |
| `update.type` | string | Compatibility discriminator accepted by parser. |
| `update.kind` | string | Compatibility discriminator accepted by parser. |
| `update.updateType` | string | Compatibility discriminator accepted by parser. |
| `update.eventType` | string | Compatibility discriminator accepted by parser. |
| `update.content` | any JSON | Text/content chunk or tool-specific carrier. |
| `update.text` | string | Alternative text chunk. |
| `update.message` | any JSON | Alternative nested message carrier. |
| `update.delta` | any JSON | Alternative delta carrier. |
| `update.chunk` | any JSON | Alternative chunk carrier. |
| `event` | object | Structured carrier; see nested fields. |
| `event.sessionUpdate` | string | ACP update discriminator, such as agent_message_chunk or tool_call_update. |
| `event.type` | string | Compatibility discriminator accepted by parser. |
| `event.kind` | string | Compatibility discriminator accepted by parser. |
| `event.updateType` | string | Compatibility discriminator accepted by parser. |
| `event.eventType` | string | Compatibility discriminator accepted by parser. |
| `event.content` | any JSON | Text/content chunk or tool-specific carrier. |
| `event.text` | string | Alternative text chunk. |
| `event.message` | any JSON | Alternative nested message carrier. |
| `event.delta` | any JSON | Alternative delta carrier. |
| `event.chunk` | any JSON | Alternative chunk carrier. |

## Ordering, correlation, and interpretation

IDE JSON can contain history or messages, with nested message wrappers and role aliases. The index accepts sessionId/id/conversationId. These are compatibility branches, not a reason to recursively treat any object with a content property as a valid message.

Persisted JSONL uses AssistantMessage/UserMessage/ToolResults envelopes in the inspected reader. ACP replay logs use JSON-RPC session/prompt requests and session/update notifications; streamed chunks must be assembled, and the matching prompt response establishes a terminal boundary. A legacy TurnEnd fixture is not a canonical ACP event.

Tool-result envelopes and tool_call/update protocol records carry additional detail; the catalog leaves unverified subfields opaque. Preserve the full nested object and original discriminator instead of inferring completion from the last text chunk.

## Fidelity of the inspected tools

The current reader is broader than the older JSON-only research warning, but it still explicitly declines to decode the ordinary CLI SQLite store. IDE history, protocol replay, and CLI persisted envelopes cannot be represented as one supposedly universal Kiro JSON format. The linked schemas describe known reader-supported fields only.

## Reuse implications for your scripts

Model storage surface as part of provider identity and dispatch. Reuse ACP chunk/state ideas only in an ACP adapter; reuse IDE message logic only in that adapter. Do not make Kiro SQL reverse engineering a dependency of adding a tool flag to Claude/Codex. Capture known local format examples before implementing detailed Kiro tool summaries.



## Minimal synthetic example

This demonstrates one known carrier only. It is not a complete session or evidence of a live client capture.

```json
{
  "sessionId": "kiro-demo",
  "history": [
    {
      "role": "human",
      "content": "Review the parser."
    },
    {
      "role": "ai",
      "content": "I found an edge case."
    }
  ]
}
```

## Source anchors

[C-KIRO](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/kiro.ts)
