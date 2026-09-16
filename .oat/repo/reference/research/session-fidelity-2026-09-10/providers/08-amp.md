# Amp: native session storage reference

[Provider index](00-index.md) · [Schema interpretation guide](../10-schema-guide-and-coverage.md)

**Evidence:** Implemented reader and/or declared type evidence from pinned repository revisions. These are partial observed formats, not vendor-certified schemas. All examples are synthetic.

[C-AMP](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/amp.ts) [R-AMP](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/pkg/ampsessions/amp.go) [R-README](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/README.md)

## Storage surfaces and identity

Continues reads local thread JSON at `$XDG_DATA_HOME/amp/threads/` or `~/.local/share/amp/threads/`. ccrider supports authenticated `amp threads export` retrieval when Amp sync is explicitly enabled. A local file and a cloud export are different access mechanisms even when their JSON overlaps.

The export parser's source locator can be `amp://threads/<id>`, which is not a path to read with fs.readFile. Workspace comes from env.initial.trees URIs, potentially describing a directory that does not exist on this machine.

## Field dictionary

The tables enumerate the fields modeled in this packet. A listed field is optional unless the linked JSON Schema requires it for that specific carrier. Optional does not mean unimportant: preserve it when present. Unknown fields and unrecognized record variants must remain available for later inspection.

### Amp: observed local/export thread JSON subset

[JSON Schema](../schemas/native/amp-thread.schema.json) · [Synthetic example](../examples/native/amp-thread.json)

| Field | Type | Information carried |
|---|---|---|
| `id` | string | Thread ID, not a filesystem path. |
| `title` | string | Thread title. |
| `created` | string / number | Timestamp representation varies between the local and export surfaces. |
| `updatedAt` | string / number | Timestamp representation varies between the local and export surfaces. |
| `messages` | array | Structured carrier; see nested fields. |
| `messages[].role` | string | Native message role. |
| `messages[].messageId` | string / number | Native message identity in newer exports. / Numeric identity used in local threads/other exports. |
| `messages[].content` | array | Structured carrier; see nested fields. |
| `messages[].content[].type` | string | Block discriminator; text is the only variant indexed by the reviewed ccrider path. |
| `messages[].content[].text` | string | Visible text for a text block. |
| `messages[].content[].provider` | string | Optional source provider label on local content blocks. |
| `messages[].content[].startTime` | string / number | Timestamp representation varies between the local and export surfaces. |
| `messages[].meta` | object | Structured carrier; see nested fields. |
| `messages[].meta.sentAt` | string / number | Timestamp representation varies between the local and export surfaces. |
| `env` | object | Structured carrier; see nested fields. |
| `env.initial` | object | Structured carrier; see nested fields. |
| `env.initial.tags` | array | Structured carrier; see nested fields. |
| `env.initial.trees` | array | Structured carrier; see nested fields. |
| `env.initial.trees[].uri` | string | Workspace URI, commonly file://. May describe a directory not present on this host. |
| `env.initial.trees[].repository` | object | Structured carrier; see nested fields. |
| `env.initial.trees[].repository.url` | string | Remote URL. |
| `env.initial.trees[].repository.ref` | string | Git ref, e.g. refs/heads/main. |
| `env.initial.trees[].repository.sha` | string | Recorded commit SHA. |
| `env.initial.platform` | object | Structured carrier; see nested fields. |
| `env.initial.platform.clientVersion` | string | Source client version recorded in exported thread. |
| `usageLedger` | object | Structured carrier; see nested fields. |
| `usageLedger.events` | array | Structured carrier; see nested fields. |
| `usageLedger.events[].model` | string | Model used for this ledger event. |
| `usageLedger.events[].credits` | number | Recorded credits; no currency conversion inferred. |
| `usageLedger.events[].tokens` | object | Structured carrier; see nested fields. |
| `usageLedger.events[].tokens.input` | number | Recorded input tokens. |
| `usageLedger.events[].tokens.output` | number | Recorded output tokens. |
| `usageLedger.events[].operationType` | string | Operation type; continues excludes title-generation when aggregating. |
| `usageLedger.events[].fromMessageId` | number | Message-range start in the local ledger shape. |
| `usageLedger.events[].toMessageId` | number | Message-range end in the local ledger shape. |

## Ordering, correlation, and interpretation

Thread array order and messageId support message identity. The export parser accepts string/numeric IDs and has an array-position fallback for legacy missing IDs; it rejects duplicate IDs in its indexed subset. Keep any fallback origin explicit.

Local created/meta.sentAt values are numeric milliseconds; ccrider's exported timestamp reader accepts numeric milliseconds and ISO strings. Usage ledger events can be scoped by fromMessageId/toMessageId and operationType; continues excludes title-generation when aggregating. Do not blindly sum different snapshots of the same ledger.

A model: tag is an initial/model hint, not evidence that all messages used the same model. The first workspace tree is a selection policy, not proof that no other workspaces were present.

## Fidelity of the inspected tools

The inspected local types and ccrider export parser do not establish a complete tool-block schema. ccrider indexes only textual blocks from user/assistant messages, retaining raw selected message payloads. Tool-only and other block variants can be absent from its searchable projection. This catalog deliberately leaves those payloads opaque rather than presenting Anthropic blocks as guaranteed Amp-native storage.

## Reuse implications for your scripts

Use Amp discovery/export as an optional source adapter with an explicit network boundary, not part of local-only defaults. Preserve full raw export blocks for later interpretation. Tool-call reconstruction requires captured/export schema evidence beyond the conversation-only importer; do not market that feature as already solved by the shared thread type.



## Minimal synthetic example

This demonstrates one known carrier only. It is not a complete session or evidence of a live client capture.

```json
{
  "id": "T-demo",
  "title": "Parser review",
  "created": 1789041600000,
  "messages": [
    {
      "role": "user",
      "messageId": 1,
      "content": [
        {
          "type": "text",
          "text": "Review the parser."
        }
      ],
      "meta": {
        "sentAt": 1789041600000
      }
    }
  ],
  "env": {
    "initial": {
      "trees": [
        {
          "uri": "file:///workspace/demo",
          "repository": {
            "ref": "refs/heads/main"
          }
        }
      ]
    }
  }
}
```

## Source anchors

[C-AMP](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/amp.ts) [R-AMP](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/pkg/ampsessions/amp.go) [R-README](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/README.md)
