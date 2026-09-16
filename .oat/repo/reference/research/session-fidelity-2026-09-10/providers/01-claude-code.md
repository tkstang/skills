# Claude Code: native session storage reference

[Provider index](00-index.md) · [Schema interpretation guide](../10-schema-guide-and-coverage.md)

**Evidence:** Implemented reader and/or declared type evidence from pinned repository revisions. These are partial observed formats, not vendor-certified schemas. All examples are synthetic.

[S-CORE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/core/runtimes.ts) [S-FORMATS](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/skills/session-observer/references/transcript-formats.md) [C-SCHEMAS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/types/schemas.ts) [C-CLAUDE](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/claude.ts) [C-TOOLS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/tool-extraction.ts) [R-CLAUDE](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/pkg/ccsessions/parser.go)

## Storage surfaces and identity

Primary JSONL path: `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`; continues honors `CLAUDE_CONFIG_DIR` as its configuration root. Same-session companion directories can contain `subagents/` and `tool-results/`. A directory slug is lossy and must not be reversed into authoritative project identity.

The main record's `sessionId`, `uuid`, and `parentUuid` are different identities. Prefer explicit session/project evidence. Sidecar results belong to a specific parent/task relationship, not every nearby JSONL file. Continues' older-session chaining uses cwd/time heuristics and must not establish ancestry for a retro.

## Field dictionary

The tables enumerate the fields modeled in this packet. A listed field is optional unless the linked JSON Schema requires it for that specific carrier. Optional does not mean unimportant: preserve it when present. Unknown fields and unrecognized record variants must remain available for later inspection.

### Claude Code: observed JSONL record

[JSON Schema](../schemas/native/claude-code-record.schema.json) · [Synthetic example](../examples/native/claude-code-record.json)

| Field | Type | Information carried |
|---|---|---|
| `type` | string | Record type: conversation, summary, queue-operation, attachment, file-history-snapshot, and others. |
| `uuid` | string | Native record/message UUID, when recorded. |
| `parentUuid` | string / null | Parent message/record UUID; not the session ID. |
| `sessionId` | string | Native session identity used by the current Claude reader. |
| `session_id` | string | Compatibility spelling accepted by the user's metadata reader. |
| `sessionID` | string | Additional compatibility spelling accepted by the user's metadata reader. |
| `timestamp` | string | Recorded timestamp string; preserve original representation, parse only when valid. |
| `cwd` | string | Recorded working directory. Stronger identity evidence than reverse-decoding a slug. |
| `gitBranch` | string | Recorded branch name, not proof of current checkout state. |
| `slug` | string | Optional provider display/session slug. |
| `model` | string | Optional top-level model label; message.model can also carry it. |
| `isMeta` | boolean | Marks non-conversational provider metadata. |
| `isCompactSummary` | boolean | Marks a compaction-summary carrier, not an ordinary human message. |
| `summary` | string | Provider-supplied session summary on summary records. |
| `leafUuid` | string | Summary-associated leaf message UUID when recorded, read by ccrider. |
| `version` | string | Recorded client version string when supplied. |
| `permissionMode` | string | Permission-mode metadata when recorded. |
| `entrypoint` | string | Recorded client entrypoint metadata. |
| `userType` | string | Recorded user-type metadata; do not infer identity beyond source. |
| `message` | object | Conversation and tool content carrier. |
| `message.role` | string | Provider role. A user-role tool_result carrier is not necessarily human input. |
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
| `message.model` | string | Model recorded on the assistant message. |
| `message.usage` | object | Assistant usage fields consumed by continues. |
| `message.usage.input_tokens` | number | Recorded input token count; aggregation must respect provider usage semantics. |
| `message.usage.output_tokens` | number | Recorded output token count. |
| `message.usage.cache_creation_input_tokens` | number | Recorded cache-creation input tokens. |
| `message.usage.cache_read_input_tokens` | number | Recorded cached input tokens. |
| `toolUseResult` | object | Top-level result metadata; do not discard merely because it lies outside message.content. |
| `toolUseResult.questions` | array | Original ask-user questions or source-specific tool result metadata. |
| `toolUseResult.answers` | object | Ask-user answers keyed by full question text; values may be strings or arrays. |
| `toolUseResult.annotations` | object | Question-keyed operator annotations; nested notes may contain human-authored text. |
| `toolUseResult.agentId` | string | Subagent identity used by the Claude sidecar extraction path. |
| `operation` | string | Queue operation, e.g. enqueue or remove. |
| `content` | string | Queued prompt text on queue-operation records. |
| `attachment` | object | Attachment carrier for queued input. |
| `attachment.type` | string | Attachment discriminator, including queued_command. |
| `attachment.prompt` | string | Delivered queued prompt text. |
| `snapshot` | any JSON | File-history snapshot metadata and backup references; not a verified Git diff. |

## Ordering, correlation, and interpretation

Preserve content-block order inside a record. Pair `tool_use.id` with `tool_result.tool_use_id` using a session-scoped index before slicing a review/catch-up range. A tool result can arrive in a user-role message without being authored by the human.

For `AskUserQuestion`, the call carries `input.questions[]` (question/header/options). The paired record may carry `toolUseResult.answers`, keyed by question text, and `annotations[question].notes`. These are human-decision content in your existing contract. Keep that semantic handling rather than replacing it with a generic short tool marker.

Queue `enqueue` and later delivery attachments can repeat the same human text; your current code correlates queue transactions. Do not globally deduplicate equal text. Preserve compaction records and source graph IDs without assuming every earlier message is active in the final conversation branch.

## Fidelity of the inspected tools

Your current observer can show calls and results, but inputs are cut to 200 characters and results to 500. Your reader joins all textual result blocks, whereas the continues shared extractor selects only the first text block before truncation. Continues has richer category-specific summaries, selected sidecar final outputs, usage/cache data, and external-result previews, but its Claude timeline is a trimmed conversation list, not all tool events.

The ccrider parser preserves raw inner `message` data for parsed records, not every original top-level envelope or all external files. Its indexed text is a separate, narrower view.

## Reuse implications for your scripts

This is the lowest-friction provider for an opt-in activity mode. Reuse your existing block traversal and ask-user/queue handling; attach raw input/result values, exact call IDs, source block pointers, and nullable status before building any preview. Adapt continues' category extractors and diff display on top. Add sidecar discovery only behind explicit, bounded parent-linked reads.

Do not copy `resolvePreviousClaudeSessions` as an evidence relationship. Do not replace your all-block result extraction with the donor's first-block behavior.



## Minimal synthetic example

This demonstrates one known carrier only. It is not a complete session or evidence of a live client capture.

```json
{
  "type": "assistant",
  "uuid": "msg-2",
  "parentUuid": "msg-1",
  "sessionId": "session-demo",
  "timestamp": "2026-09-10T12:00:00Z",
  "cwd": "/workspace/demo",
  "message": {
    "role": "assistant",
    "content": [
      {
        "type": "text",
        "text": "I will run the focused test."
      },
      {
        "type": "tool_use",
        "id": "tool-1",
        "name": "Bash",
        "input": {
          "command": "pnpm test parser"
        }
      }
    ]
  }
}
```

## Source anchors

[S-CORE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/core/runtimes.ts) [S-FORMATS](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/skills/session-observer/references/transcript-formats.md) [C-SCHEMAS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/types/schemas.ts) [C-CLAUDE](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/claude.ts) [C-TOOLS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/tool-extraction.ts) [R-CLAUDE](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/pkg/ccsessions/parser.go)
