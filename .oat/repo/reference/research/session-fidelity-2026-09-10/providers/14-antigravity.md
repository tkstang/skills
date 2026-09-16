# Antigravity: CLI and IDE surfaces: native session storage reference

[Provider index](00-index.md) · [Schema interpretation guide](../10-schema-guide-and-coverage.md)

**Evidence:** Implemented reader and/or declared type evidence from pinned repository revisions. These are partial observed formats, not vendor-certified schemas. All examples are synthetic.

[R-ANTIGRAVITY](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/pkg/antigravitysessions/parser.go) [C-ANTIGRAVITY](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/antigravity.ts)

## Storage surfaces and identity

**CLI surface:** ccrider reads `~/.gemini/antigravity-cli/brain/<conversation-id>/.system_generated/logs/transcript.jsonl`. It deliberately ignores the companion `transcript_full.jsonl`. Workspace hints come from cache/last_conversations.json and history.jsonl.

**IDE surface:** continues discovers `.gemini/antigravity/conversations/*.pb`, brain artifacts such as task.md/implementation_plan.md/walkthrough.md, editor `state.vscdb` summary keys, and optional local runtime/RPC information. ANTIGRAVITY_HOME and ANTIGRAVITY_STATE_DB alter those roots. These are not the CLI canonical log paths.

## Field dictionary

The tables enumerate the fields modeled in this packet. A listed field is optional unless the linked JSON Schema requires it for that specific carrier. Optional does not mean unimportant: preserve it when present. Unknown fields and unrecognized record variants must remain available for later inspection.

### Antigravity CLI: observed canonical transcript step

[JSON Schema](../schemas/native/antigravity-cli-step.schema.json) · [Synthetic example](../examples/native/antigravity-cli-step.json)

| Field | Type | Information carried |
|---|---|---|
| `step_index` | number | Native step index used to derive indexed message identity. |
| `source` | string | Recorded source; USER_EXPLICIT and MODEL are recognized for conversation. |
| `type` | string | Step kind; USER_INPUT and PLANNER_RESPONSE are indexed. |
| `status` | string | Recorded step status; reviewed importer includes only DONE. |
| `created_at` | string | Recorded timestamp string; preserve original representation, parse only when valid. |
| `content` | any JSON | Step content. The reviewed importer only accepts string-valued conversation content. |

## Ordering, correlation, and interpretation

CLI step_index, source, type, status, created_at and content describe the recorded step. The reviewed ccrider importer only indexes DONE USER_EXPLICIT/USER_INPUT and MODEL/PLANNER_RESPONSE steps whose content is text. That policy is useful for visible conversation but removes other step types from the searchable view.

The CLI workspace index maps workspace paths to conversation IDs; a history fallback matches the first user text/time. Treat inferred matches as inferred. Do not identify a session solely from common text.

For IDE data, opaque conversation bytes, human-facing brain artifacts, summary state, and live RPC observations are distinct evidence classes. A .pb filename or a summary decoder is not a verified full protobuf execution schema.

## Fidelity of the inspected tools

The providers share a brand label but the inspected tools read different products/surfaces. The packet supplies a concrete CLI-step subset and an explicit IDE binary gap. It does not claim to decode .pb conversations, diagnostic transcript_full records, or every runtime RPC step.

Artifact fallback can convey useful plans/results without reproducing the session that created them. A retro must distinguish an artifact from a native turn/tool record.

## Reuse implications for your scripts

Use separate adapter surface names such as antigravity-cli-transcript and antigravity-ide-artifacts. Keep binary files opaque and preserve references until a verified decoder is available. Do not invent protobuf field numbers or convert a plan Markdown file into fabricated user/assistant turns.

## Explicit opaque-store boundary

No executable native schema is supplied for IDE conversation protobuf bytes. The known state keys `antigravityUnifiedStateSync.trajectorySummaries` and `unifiedStateSync.trajectorySummaries` identify summary storage, not a complete conversation schema. Local connection credentials used for RPC discovery are operational secrets, not fields to export in a session report.


## Minimal synthetic example

This demonstrates one known carrier only. It is not a complete session or evidence of a live client capture.

```json
{
  "step_index": 1,
  "source": "MODEL",
  "type": "PLANNER_RESPONSE",
  "status": "DONE",
  "created_at": "2026-09-10T12:00:00Z",
  "content": "I found a parser edge case."
}
```

## Source anchors

[R-ANTIGRAVITY](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/pkg/antigravitysessions/parser.go) [C-ANTIGRAVITY](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/antigravity.ts)
