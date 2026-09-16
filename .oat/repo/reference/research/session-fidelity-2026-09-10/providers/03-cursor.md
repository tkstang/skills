# Cursor agent transcripts: native session storage reference

[Provider index](00-index.md) · [Schema interpretation guide](../10-schema-guide-and-coverage.md)

**Evidence:** Implemented reader and/or declared type evidence from pinned repository revisions. These are partial observed formats, not vendor-certified schemas. All examples are synthetic.

[S-CORE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/core/runtimes.ts) [S-OBSERVER-GUIDE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/documentation/docs/user-guide/skills/session-observer.md) [C-CURSOR](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/cursor.ts) [C-SCHEMAS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/types/schemas.ts)

## Storage surfaces and identity

Supported local surface: `~/.cursor/projects/<project-slug>/agent-transcripts/`, with flat `<id>.jsonl` and nested `<id>/transcript.jsonl` or `<id>/<id>.jsonl` layouts. Continues can use a project `repo.json` workspace/rootPath/path hint; your observer requires stronger canonical session/project/path identity for stateful delivery.

This is not the same as reading all Cursor SQLite chat state. A field absent from the agent transcript may exist elsewhere or may never have been persisted.

## Field dictionary

The tables enumerate the fields modeled in this packet. A listed field is optional unless the linked JSON Schema requires it for that specific carrier. Optional does not mean unimportant: preserve it when present. Unknown fields and unrecognized record variants must remain available for later inspection.

### Cursor: observed agent-transcript JSONL frame

[JSON Schema](../schemas/native/cursor-frame.schema.json) · [Synthetic example](../examples/native/cursor-frame.json)

| Field | Type | Information carried |
|---|---|---|
| `role` | string | Top-level role on content frames. |
| `message` | object | Structured carrier; see nested fields. |
| `message.content` | string / array | Native content carrier; inspect block discriminators before flattening. |
| `message.content[].type` | string | Content-block discriminator; unknown variants must remain reachable. |
| `message.content[].text` | string | Text content when this block is textual. |
| `message.content[].thinking` | string | Recorded thinking text, when present; not a guarantee of all model reasoning. |
| `message.content[].id` | string | Tool-call/block identifier when present. |
| `message.content[].name` | string | Exact tool name, including namespace when encoded here. |
| `message.content[].input` | any JSON | Native tool input, commonly an object; preserve original value. |
| `message.content[].tool_use_id` | string | Identifier linking a result block to a tool_use block. |
| `message.content[].content` | any JSON | Result payload, either string, nested blocks, or another source-specific value. |
| `message.content[].is_error` | boolean | Provider-recorded tool-result error flag; absence is unknown, not success. |
| `message.timestamp` | string | Recorded timestamp string; preserve original representation, parse only when valid. |
| `message.createdAt` | string | Alternative message timestamp read by continues. |
| `message.model` | string | Optional recorded model. |
| `message.usage` | object | Recorded usage object; availability depends on source surface. |
| `type` | string | Frame discriminator, including turn_ended for terminal frames. |
| `status` | string | Terminal status: success, aborted, error, cancelled, or unknown/new values. |
| `timestamp` | string | Recorded timestamp string; preserve original representation, parse only when valid. |
| `createdAt` | string | Alternative top-level timestamp read by continues. |
| `model` | string | Optional top-level recorded model. |
| `usage` | object | Optional source usage fields; do not synthesize from absent data. |

## Ordering, correlation, and interpretation

Keep the physical JSONL frame index, source content frame, and delivery frame separate. Open-turn data may be rewritten. A later `turn_ended` has a terminal status; observed content before it does not establish completed work.

Your ordinary observer uses its newer observation projection, with prefix-stable content and explicit lifecycle availability. Your shared normalizer used by other paths has terminal-aware collapse behavior: on success it retains the last assistant message and selected call markers, while incomplete/error turns are narrower. Do not unify these by blindly appending all raw frames to the live digest.

`AskQuestion` asks the human through a tool-use block. On the measured local surface the selected option is not recorded. A typed reply is an ordinary user message, but an absent tool result does not prove the user never answered. Preserve this limitation explicitly.

## Fidelity of the inspected tools

Continues uses Anthropic-style shared extraction and emits a warning that local transcripts may omit outputs, images, reasoning, compaction, or hidden state. Its reader can summarize tool blocks when available, but does not provide your continuity/checkpoint guarantees. Your v2 observer is stricter about identity and completion, not necessarily a complete byte-for-byte history.

Model and usage fields are optional source passthroughs. Their absence should produce unknown coverage, not zero usage.

## Reuse implications for your scripts

Treat Cursor as a separate integration milestone. Derive activity from analyzed frames and reconcile stable updates using existing state rules. Preserve `sourceFrameIndex` versus delivery coordinates. Do not advance live delivery through an unverified rewritten prefix. Initially show source-recorded calls and explicitly missing results; do not implement hidden SQLite recovery merely to make a summary look complete.



## Minimal synthetic example

This demonstrates one known carrier only. It is not a complete session or evidence of a live client capture.

```json
{
  "role": "assistant",
  "message": {
    "content": [
      {
        "type": "tool_use",
        "id": "cursor-call-1",
        "name": "Read",
        "input": {
          "path": "/workspace/demo/src/parser.ts"
        }
      }
    ]
  }
}
```

## Source anchors

[S-CORE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/core/runtimes.ts) [S-OBSERVER-GUIDE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/documentation/docs/user-guide/skills/session-observer.md) [C-CURSOR](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/cursor.ts) [C-SCHEMAS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/types/schemas.ts)
