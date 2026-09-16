# 10. How to use the provider schemas

## What these schemas are

They are an **observed-format catalog derived from the four inspected repositories**, not a vendor-certified schema bundle. A provider's public/runtime log may contain more fields or different versions than these adapters understand. Field dictionaries explain the known fields; unknown fields remain possible and must not be discarded.

The source registry union contains 17 providers. Each provider guide identifies its own storage surface, record wrappers, call/result relationships, timestamp conventions, metadata, known parser loss, and unresolved areas. Read [the provider index](providers/00-index.md) before implementing another adapter. [C-REGISTRY](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/registry.ts) [R-PROVIDER](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/internal/core/session/provider.go)

## Evidence vocabulary

| Label | Meaning |
|---|---|
| Implemented reader evidence | Code explicitly reads or interprets the field/shape. This proves adapter behavior, not universal runtime truth. |
| Declared type/schema | The repository declares the shape, possibly more narrowly than all real records. |
| Documented/observed contract | Repository documentation describes a measured surface; its version/scope matters. |
| Synthetic example | An example authored here to exercise the documented subset, not captured live data. |
| Proposed contract | Our suggested activity representation, not any provider's native log. |
| Unresolved/opaque | No defensible complete schema was established; do not invent fields or decode unavailable state. |

## Native versus derived representations

JSONL schemas apply per decoded record, not to an entire newline-delimited file as if it were one JSON value. Whole-session JSON schemas apply to an object or array. YAML metadata is described as the parsed object. SQLite schemas apply to exported rows or the decoded JSON held in specific columns; they do not validate SQLite database bytes.

Some sources are state snapshots or mutation streams, not immutable message lists. Gemini supports `$set`, replacement messages by ID, and `$rewindTo`; OpenCode stores message parts separately; Cursor can rewrite open frames. Ordering and mutation rules are as important as field types. [C-GEMINI](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/gemini.ts) [C-OPENCODE](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/opencode.ts) [S-OBSERVER-GUIDE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/documentation/docs/user-guide/skills/session-observer.md)

## Practical ingestion rules

Retain unknown fields and source bytes/pointers. Validate to classify and diagnose, not to decide silently that an unrecognized event never existed. Never cast an opaque database or binary artifact into the proposed activity schema and call it native evidence.

Keep exact native IDs and namespace/session scope. A call ID is not a session ID. A message parent ID is not necessarily a tool-call ID. File row ordering, provider sequence, timestamps, and physical positions are separate coordinates. Timestamps are useful for display but do not by themselves establish causality between concurrent sessions.

When a provider supplies both API messages and human-facing events, reconcile duplicates by supported identity/lineage evidence. Do not deduplicate all equal strings globally: repeated user prompts and repeated tool commands can be legitimate distinct events.

## Known gaps intentionally left open

Kiro's ordinary CLI SQLite store is not decoded by the continues adapter; the guide describes the supported IDE/ACP/persisted envelopes separately. Antigravity IDE's conversation binary is not supplied with an invented complete protobuf schema; CLI JSONL is a separate supported surface in ccrider. Cursor agent transcripts do not imply visibility into hidden SQLite/editor state. Amp local JSON and authenticated export availability are distinct. [C-KIRO](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/kiro.ts) [C-ANTIGRAVITY](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/antigravity.ts) [R-ANTIGRAVITY](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/pkg/antigravitysessions/parser.go) [C-CURSOR](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/cursor.ts) [R-AMP](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/pkg/ampsessions/amp.go) [C-AMP](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/amp.ts)

## Schema validation is not fidelity validation

A valid record may still omit the tool result you need. A valid source may already be compacted, redacted, filtered, or incomplete. A permissive schema can accept new fields without interpreting them. Therefore the packet's schema/example validation is only a consistency check of the authored reference artifacts.

Use the regression matrix in [07](07-implementation-plan-and-tests.md) for behavior. Validate representative logs from the client versions you actually run before marking an adapter live-compatible.
