# Codex: native session storage reference

[Provider index](00-index.md) · [Schema interpretation guide](../10-schema-guide-and-coverage.md)

**Evidence:** Implemented reader and/or declared type evidence from pinned repository revisions. These are partial observed formats, not vendor-certified schemas. All examples are synthetic.

[S-CORE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/core/runtimes.ts) [S-FORMATS](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/skills/session-observer/references/transcript-formats.md) [C-SCHEMAS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/types/schemas.ts) [C-CODEX](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/codex.ts) [R-CODEX](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/pkg/codexsessions/parser.go) [X-PARSER](https://github.com/lingtaolf/cxresume/blob/71225c58f1420f73f3c98f9cd44f1fa4ba690b67/src/utils/parser.js)

## Storage surfaces and identity

Modern rollout files are discovered by continues under `$CODEX_HOME/sessions/` and `$CODEX_HOME/archived_sessions/`, with the default home `~/.codex`. Filenames normally carry `rollout-<timestamp>-<id>.jsonl`. The modern header is `type: session_meta` with `payload.id` and `payload.cwd`.

Your reference documentation also contains legacy/fixture `session_started` records and `session-<id>.jsonl` naming. Keep those as compatibility shapes, not the universal modern layout. `payload.id` is a session ID only in the header context; it can be a message identity elsewhere.

## Field dictionary

The tables enumerate the fields modeled in this packet. A listed field is optional unless the linked JSON Schema requires it for that specific carrier. Optional does not mean unimportant: preserve it when present. Unknown fields and unrecognized record variants must remain available for later inspection.

### Codex: observed rollout JSONL record

[JSON Schema](../schemas/native/codex-record.schema.json) · [Synthetic example](../examples/native/codex-record.json)

| Field | Type | Information carried |
|---|---|---|
| `timestamp` | string | Recorded timestamp string; preserve original representation, parse only when valid. |
| `type` | string | Outer type: session_meta, response_item, event_msg, turn_context, compacted; legacy shapes also exist. |
| `payload` | object | Structured carrier; see nested fields. |
| `payload.type` | string | Inner discriminator; meaning depends on outer type. |
| `payload.id` | string | session_meta: session ID. response_item/message: message ID. Interpret in context. |
| `payload.sessionId` | string | Legacy/compatibility session identity, not a replacement for discriminator-aware id handling. |
| `payload.timestamp` | string | Recorded timestamp string; preserve original representation, parse only when valid. |
| `payload.cwd` | string | Recorded working directory or turn-context directory. |
| `payload.git` | object | Structured carrier; see nested fields. |
| `payload.git.branch` | string | Recorded Git branch. |
| `payload.git.repository_url` | string | Recorded remote URL. |
| `payload.git.commit_hash` | string | Recorded commit hash. |
| `payload.git.sha` | string | Compatibility commit-hash field. |
| `payload.source` | any JSON | Client/source provenance when supplied; preserve non-string variants. |
| `payload.originator` | string | Client originator label. |
| `payload.cli_version` | string | Recorded Codex CLI version. |
| `payload.model_provider` | string | Configured provider label, not necessarily a model name. |
| `payload.model` | string | Model recorded in turn_context. |
| `payload.role` | string | message role, including user, assistant, or developer. |
| `payload.content` | string / array | Legacy plain content. |
| `payload.content[].type` | string | input_text/output_text/text or another content variant. |
| `payload.content[].text` | string | Text for known textual content. |
| `payload.content[].content` | string | Compatibility text carrier. |
| `payload.name` | string | Exact function/custom tool name. |
| `payload.namespace` | string | Separate namespace component when present; retain separately from name. |
| `payload.arguments` | string / object | JSON-encoded function arguments; retain raw string when decoding fails. / Compatibility object-form arguments accepted by the user reader. |
| `payload.call_id` | string | Native tool invocation identity used to join call/output. |
| `payload.input` | string | Custom tool input, for example apply_patch patch text; not necessarily JSON. |
| `payload.output` | any JSON | Tool output, potentially string or structured object; separate from arguments. |
| `payload.action` | object | Structured carrier; see nested fields. |
| `payload.action.query` | string | Web-search query when recorded. |
| `payload.action.queries` | array | Structured carrier; see nested fields. |
| `payload.message` | string | Human/agent event text, lifecycle note, or compacted summary depending on type. |
| `payload.replacement_history` | any JSON | Compacted replacement history. The inspected continues notes path does not reconstruct its full semantics. |
| `payload.info` | object | Structured carrier; see nested fields. |
| `payload.info.total_token_usage` | object | Structured carrier; see nested fields. |
| `payload.info.total_token_usage.input_tokens` | number | Recorded input tokens. |
| `payload.info.total_token_usage.output_tokens` | number | Recorded output tokens. |
| `payload.info.total_token_usage.cached_input_tokens` | number | Recorded cached input tokens. |
| `payload.info.total_token_usage.reasoning_output_tokens` | number | Recorded reasoning-output token count. |
| `payload.info.last_token_usage` | object | Structured carrier; see nested fields. |
| `payload.info.last_token_usage.input_tokens` | number | Recorded input tokens. |
| `payload.info.last_token_usage.output_tokens` | number | Recorded output tokens. |
| `payload.info.last_token_usage.cached_input_tokens` | number | Recorded cached input tokens. |
| `payload.info.last_token_usage.reasoning_output_tokens` | number | Recorded reasoning-output token count. |
| `payload.input_tokens` | number | Compatibility top-level event usage field. |
| `payload.output_tokens` | number | Compatibility top-level event usage field. |
| `payload.turn_id` | string | Turn identity on lifecycle events when available. |
| `payload.reason` | string | Recorded interruption/completion reason. |
| `payload.model_context_window` | number | Recorded context-window size. |
| `payload.collaboration_mode_kind` | string | Recorded collaboration-mode metadata. |
| `payload.started_at` | any JSON | Recorded lifecycle start time; retain native representation. |
| `payload.completed_at` | any JSON | Recorded lifecycle completion time; retain native representation. |
| `payload.duration_ms` | number | Recorded lifecycle duration in milliseconds. |
| `sessionId` | string | Legacy top-level session identity. |
| `cwd` | string | Legacy top-level working directory. |
| `message` | string | Legacy event text fallback. |

## Ordering, correlation, and interpretation

Interpret both the outer and inner discriminator. `response_item/function_call` uses JSON-encoded `arguments`; `function_call_output` pairs by `call_id`. `custom_tool_call` uses an opaque/string `input`, such as an apply_patch patch, and its output uses `custom_tool_call_output`. `web_search_call` may carry a query/action without matching this ordinary function pair.

A shell tool may return before a process finishes, and `write_stdin` can be a later interaction. Retain the tool's recorded execution/session metadata when available rather than interpreting a call return as process success. Lifecycle event types such as task_started, task_complete, turn_aborted, and turn_completed are not equivalent to a narrative status update.

`event_msg` and `response_item` can be overlapping views. Continues chooses response-item conversation wholesale when present; ccrider picks the buffer with more entries; cxresume's modern preview only reads user/agent event messages. None is a universal deduplication algorithm. Keep supported source identities and report reconstruction limitations.

`request_user_input` answers are JSON-encoded and keyed by question ID. `autoResolutionMs` can make a recorded answer ambiguous between human choice and automatic resolution. Your existing handling of that distinction should survive the extension.

## Fidelity of the inspected tools

Your current generic Codex normalizer emits ordinary function-call markers and message content, but drops general function-call outputs and custom tool-call/patch records. Only ask-user outputs are specially retained. That is the key new feature work.

Continues does read and join tool outputs, summarize shell commands, extract patch input, track candidate file changes, and collect usage/lifecycle/compaction notes. However, tool summaries can have hardcoded five-line or 100-character slices, and its timeline does not include all calls/results. ccrider's Codex index omits non-message response items, so it is not a tool-evidence archive.

## Reuse implications for your scripts

Port the donor's first-pass output lookup and function/custom-call recognition, not its category-key renaming or early truncation. Preserve `name` and `namespace` separately, `argumentsRaw` when parsing fails, complete patch input in the source record, and all observed result records per call ID. Keep a result-only delta addressable when its call predates the current catch-up window.



## Minimal synthetic example

This demonstrates one known carrier only. It is not a complete session or evidence of a live client capture.

```json
{
  "timestamp": "2026-09-10T12:00:00Z",
  "type": "response_item",
  "payload": {
    "type": "function_call",
    "name": "exec_command",
    "call_id": "call-1",
    "arguments": "{\"cmd\":\"pnpm test parser\"}"
  }
}
```

## Source anchors

[S-CORE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/core/runtimes.ts) [S-FORMATS](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/skills/session-observer/references/transcript-formats.md) [C-SCHEMAS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/types/schemas.ts) [C-CODEX](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/codex.ts) [R-CODEX](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/pkg/codexsessions/parser.go) [X-PARSER](https://github.com/lingtaolf/cxresume/blob/71225c58f1420f73f3c98f9cd44f1fa4ba690b67/src/utils/parser.js)
