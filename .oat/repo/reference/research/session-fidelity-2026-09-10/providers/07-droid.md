# Factory Droid: native session storage reference

[Provider index](00-index.md) · [Schema interpretation guide](../10-schema-guide-and-coverage.md)

**Evidence:** Implemented reader and/or declared type evidence from pinned repository revisions. These are partial observed formats, not vendor-certified schemas. All examples are synthetic.

[C-SCHEMAS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/types/schemas.ts) [C-DROID](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/droid.ts) [C-TOOLS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/tool-extraction.ts)

## Storage surfaces and identity

The inspected roots are `~/.factory/projects/<workspace-slug>/<uuid>.jsonl` and `~/.factory/sessions/<workspace-slug>/<uuid>.jsonl`. A same-basename `<uuid>.settings.json` companion holds model/autonomy/reasoning settings and token/active-time metadata. Session start records carry native identity and cwd; discovery also deduplicates IDs across roots.

## Field dictionary

The tables enumerate the fields modeled in this packet. A listed field is optional unless the linked JSON Schema requires it for that specific carrier. Optional does not mean unimportant: preserve it when present. Unknown fields and unrecognized record variants must remain available for later inspection.

### Factory Droid: observed session JSONL event

[JSON Schema](../schemas/native/droid-event.schema.json) · [Synthetic example](../examples/native/droid-event.json)

| Field | Type | Information carried |
|---|---|---|
| `type` | string | session_start, message, todo_state, compaction_state, or an unmodeled event. |
| `id` | string | session_start: session ID; other records: event ID. |
| `timestamp` | string | Recorded timestamp string; preserve original representation, parse only when valid. |
| `parentId` | string | Native parent event/message ID. |
| `title` | string | Session title field. |
| `sessionTitle` | string | User-facing session title. |
| `owner` | string | Recorded owner metadata. |
| `version` | number | Recorded session data version. |
| `cwd` | string | Recorded working directory. |
| `isSessionTitleManuallySet` | boolean | Whether title was set manually. |
| `sessionTitleAutoStage` | string | Provider auto-title stage. |
| `message` | object | Structured carrier; see nested fields. |
| `message.role` | string | Native user/assistant carrier role; results can use user role. |
| `message.content` | array | Structured carrier; see nested fields. |
| `message.content[].type` | string | Content-block discriminator; unknown variants must remain reachable. |
| `message.content[].text` | string | Text content when this block is textual. |
| `message.content[].thinking` | string | Recorded thinking text, when present; not a guarantee of all model reasoning. |
| `message.content[].id` | string | Tool-call/block identifier when present. |
| `message.content[].name` | string | Exact tool name, including namespace when encoded here. |
| `message.content[].input` | any JSON | Native tool input, commonly an object; preserve original value. |
| `message.content[].tool_use_id` | string | Identifier linking a result block to a tool_use block. |
| `message.content[].content` | any JSON | Result payload, either string, nested blocks, or another source-specific value. |
| `message.content[].is_error` | boolean | Provider-recorded tool-result error flag; absence is unknown, not success. |
| `todos` | string / object | Serialized/source todo text. |
| `todos.todos` | string | Nested serialized/source todo text. |
| `messageIndex` | number | Provider message index associated with todo state, not our normalized sequence. |
| `summaryText` | string | Compaction summary text. |
| `summaryTokens` | number | Recorded token count associated with summary. |
| `summaryKind` | string | Source compaction/summary kind. |
| `anchorMessage` | string | Source anchor message reference. |
| `removedCount` | number | Number of removed records/messages as reported by source. |
| `systemInfo` | any JSON | Opaque provider-specific payload. Preserve it; the inspected sources do not establish its complete schema. |
### Factory Droid: observed settings companion

[JSON Schema](../schemas/native/droid-settings.schema.json) · [Synthetic example](../examples/native/droid-settings.json)

| Field | Type | Information carried |
|---|---|---|
| `assistantActiveTimeMs` | number | Recorded assistant-active wall time in milliseconds. |
| `model` | string | Recorded model. |
| `reasoningEffort` | string | Configured reasoning effort. |
| `interactionMode` | string | Recorded interaction mode. |
| `autonomyMode` | string | Recorded autonomy mode. |
| `providerLock` | string | Provider-lock metadata. |
| `providerLockTimestamp` | string | Recorded timestamp string; preserve original representation, parse only when valid. |
| `apiProviderLock` | string | API provider-lock metadata. |
| `specModeReasoningEffort` | string | Reasoning effort for spec mode. |
| `tokenUsage` | object | Structured carrier; see nested fields. |
| `tokenUsage.inputTokens` | number | Recorded inputTokens total; retain source category semantics. |
| `tokenUsage.outputTokens` | number | Recorded outputTokens total; retain source category semantics. |
| `tokenUsage.cacheCreationTokens` | number | Recorded cacheCreationTokens total; retain source category semantics. |
| `tokenUsage.cacheReadTokens` | number | Recorded cacheReadTokens total; retain source category semantics. |
| `tokenUsage.thinkingTokens` | number | Recorded thinkingTokens total; retain source category semantics. |

## Ordering, correlation, and interpretation

Message events wrap Anthropic-style blocks, so call/result association follows tool_use.id/tool_result.tool_use_id. Event id/parentId are not the same as call IDs. Todo and compaction states are distinct event classes: summaryText, anchorMessage, and removedCount explain source state transitions, not additional human instructions.

Settings values describe the recorded client configuration and usage, not the text of a prompt. Capture them as session notes with provenance. Do not equate the absence of recorded active time with zero duration.

## Fidelity of the inspected tools

Droid shares continues' Anthropic extractor, so the same first-text-block, pre-tail truncation, sample caps, and attempted-write attribution issues apply. The settings companion gives it useful metadata not available in every provider. Discovery fallback and lightweight metadata scans are not the same as extraction coverage.

## Reuse implications for your scripts

This is a natural later consumer of a generalized Anthropic-block activity extractor. Reuse the shared pattern after it is correct for Claude; isolate Droid event wrappers, settings, todo, and compaction logic. Do not assume the exact Claude ask-user or sidecar conventions apply to Droid.



## Minimal synthetic example

This demonstrates one known carrier only. It is not a complete session or evidence of a live client capture.

```json
{
  "type": "message",
  "id": "m2",
  "parentId": "m1",
  "timestamp": "2026-09-10T12:00:00Z",
  "message": {
    "role": "user",
    "content": [
      {
        "type": "tool_result",
        "tool_use_id": "droid-call-1",
        "content": "Test failed.",
        "is_error": true
      }
    ]
  }
}
```

## Source anchors

[C-SCHEMAS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/types/schemas.ts) [C-DROID](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/droid.ts) [C-TOOLS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/tool-extraction.ts)
