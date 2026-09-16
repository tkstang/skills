# Implementation starting point

The proposed public feature is `--include-activity`. Existing defaults and compact/debug flags remain compatible. This folder contains **types and contract notes, not an implementation or patch**.

[Activity TypeScript contract](activity-contract.ts) · [JSON Schema](../schemas/proposed/activity-report.schema.json) · [Synthetic report](../examples/proposed/activity-report.json)

## Minimum sufficient implementation

Start with your current whole-source read for a pinned Claude/Codex session. Extract native calls/results into structured values before display truncation, build a scoped correlation index, then select the observer's delivery range. Reuse adapted category/sample/diff helpers. The report can be appended to the existing digest without changing the existing conversation entry union.

The type sketch makes positions and omissions explicit but does not require a new database, daemon, network service, content-addressed archive, or a complete provider tree. The first implementation can keep source references to current local files. Only mark a reference as a snapshot when an immutable snapshot was actually made.

## Contract notes

`SourceRef` deliberately distinguishes physical line/byte positions, logical record indices, and Cursor content/delivery frames. The existing generic reader skips blank/malformed lines, so its logical index cannot substitute for a physical source line. A source hash or snapshot identity is needed for durable citations after a file changes.

`PayloadPreview` measures truncation of an explicitly rendered text projection, not arbitrary raw JSON bytes. Select one counting convention in implementation, preferably Unicode code points for human-facing character counts or UTF-8 bytes for transport budgets, and test it. The synthetic example uses ASCII, so this distinction does not affect its counts. Preserve JSON/raw source values independently before rendering.

`relatedCallEventId` may reference a call outside the current displayed delta. Do not reject it merely because the call is not in events[]. Expose its source lookup through the call index. Multiple results or updates for one call remain separate events.

`nativeStatus`, normalized `outcome`, and `outcomeEvidence` are separate. Parsed output text is weaker than a structured status/exit field. Missing result and error are not synonyms. A cancelled turn can contain earlier successful tool calls.

`toolGroups.countScope` identifies whether counts cover the captured range, delivered range, or displayed range. A group is an index, not the sole chronology. Keep unknown tools as events without requiring bespoke classification.

`metadata` retains native values with source-specific interpretation notes rather than inventing a universal usage accumulator. A future explicit reasoning policy may include persisted reasoning, but the activity flag alone should not expose all hidden instruction content.

## Semantic checks beyond JSON Schema

Check count conservation, duplicate event keys, valid source-coordinate ranges, call/result identity scope, and whether omitted character counts match the chosen projection. Do not use native provider schemas as destructive filters. JSON Schema cannot prove that a file was read completely or that a claimed verification step actually succeeded.

The packet validates its own schema/example consistency and type declarations. The implementation still needs the provider fixtures and regressions in [07 Implementation and tests](../07-implementation-plan-and-tests.md).
