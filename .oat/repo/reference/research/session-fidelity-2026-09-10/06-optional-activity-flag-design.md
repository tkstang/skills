# 06. Proposed optional activity flag

**Design proposal. None of the new flags or interfaces below are implemented by this packet.**

## Public contract

Start with one new boolean: **`--include-activity`**.

```bash
# Existing behavior remains unchanged.
node skills/session-observer/scripts/session-observer.mjs review \
  --runtime codex --session codex:SESSION_ID --cwd "$PWD"

# Proposed: conversation plus rich, bounded activity.
node skills/session-observer/scripts/session-observer.mjs review \
  --runtime codex --session codex:SESSION_ID --cwd "$PWD" \
  --include-activity --json

# Proposed: activity-enhanced Markdown export.
node skills/export-session-transcript/scripts/export-session-transcript.mjs \
  --runtime claude-code --session SESSION_ID --cwd "$PWD" \
  --include-activity --out ./session.activity.md
```

The observer already supports `--json`; the inspected exporter is Markdown-only. Do not present `--json` as an existing exporter capability. A future exporter JSON format should be an explicit additional feature, not a silently changed interpretation of `--out`. [S-OBSERVER](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/skills/session-observer/SKILL.md) [S-EXPORT](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/export-session/export-session-transcript.ts)

## Flag interactions

| Flags | Proposed result |
|---|---|
| None | Exactly the existing conversation view. |
| `--include-tools` | Existing compact tool-call markers. |
| `--debug` | Existing debug behavior, including currently supported result markers. |
| `--include-activity` | Rich correlated activity and selected session metadata, with declared coverage. |
| Activity plus tools/debug | Rich representation wins for duplicate tool presentation; no double-counted invocation. Debug can still control diagnostics. |
| Activity plus `--include-command-messages` | Explicitly expose the command payload using existing semantics; activity alone does not reveal all instruction bodies. |
| Activity plus catch-up/watch | Same identity and checkpoint rules; output new calls/results/updates from the delivered range. |
| Activity plus tail limits | Report both source range and shown activity range/count; omitted calls remain recoverable by pointer. |

Existing flag contracts are documented in the observer skill. This table proposes their interaction with the new flag. [S-OBSERVER](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/skills/session-observer/SKILL.md)

## Data pipeline

```text
Detailed source read
  -> native activity extraction (no display truncation)
  -> call/result correlation and source-specific metadata
  -> delivery-range selection
  -> activity projection and budgets
  -> Markdown or JSON
```

Conversation normalization remains available separately. Do not parse activity back out of rendered text. Keep the observer's raw checkpoint, Cursor delivery index, and newly introduced physical source locator as distinct concepts.

The [TypeScript contract sketch](design/activity-contract.ts) and [proposed JSON Schema](schemas/proposed/activity-report.schema.json) use a compact `ActivityReport` envelope with separate events, tool groups, metadata, and coverage. They are proposed contracts, not native provider formats.

## What the activity view includes

For tool calls: exact native name, call ID when recorded, stable source event key, category, input preview, original input carrier pointer, and source location. For results: associated call key when known, native result ID/locator, output preview, explicit status evidence, and original output pointer. One tool may produce more than one result/update; do not overwrite every earlier result with the last map entry.

For enrichments: command, file path/range, patch/replacement display, search/query/URL, task description, optional recorded exit code, and counts. Each enrichment is a convenience derived from raw content. Keep native status and inferred status separate.

For session metadata: model changes when recorded, token/cache samples with their accumulation semantics, lifecycle records, and compaction summaries. A source-native compaction summary remains a summary, not recovered missing history. Reasoning text is included only if it is actually persisted and explicitly enabled in the chosen policy; never imply access to hidden reasoning.

## Output budget policy

Use modest internal defaults first. Do not expose every continues configuration knob on day one. Keep a chronological activity section and a grouped index; the grouped index links to event keys rather than serving as the sole trace.

Measure display truncation only at the projection boundary. Preserve original payload pointers, omitted character/block counts, unmatched result/call counts, and source coverage. A preview of the last five lines must actually use the full available output, not the first truncated 5 KB.

For very large results, a later opt-in `--activity-output <path>` could write a structured activity artifact with fuller source material while the digest contains a bounded preview. That flag is a possible second milestone, not required to ship the first activity view. It still would not guarantee the provider recorded everything.

## Coverage and outcomes

Represent missing data precisely:

| State | Meaning |
|---|---|
| `available` | A source value was read and represented. |
| `not-recorded` | The measured source surface does not supply that class of data. |
| `not-found` | Expected companion evidence was looked for but absent. |
| `not-read` | Evidence may exist but was not requested/read. |
| `unsupported` | Parser does not understand that shape/surface. |
| `malformed` | Bytes/records exist but cannot be decoded under the attempted parser. |
| `truncated` | The presentation omits a known portion; retain its source pointer. |

Tool outcome is independently `success`, `error`, `cancelled`, `pending`, or `unknown`. Do not use a missing `is_error` field as universal evidence of success. A source's explicit terminal status, a recorded exit code, and a prose-parsed exit code have different strengths.

## Incremental observation

A first read may show a call without a result. A later read may contain only its result. Correlation therefore needs the earlier call even when it lies outside the newly delivered range. Initially, use the existing whole-file read to build correlation, then slice output by delivery range; optimize lookup only after correctness tests exist.

Use event keys scoped by provider, exact session, source identity, and native event/block identity. Repeated identical commands are distinct calls. Results refer to calls without retroactively changing whether the original call was delivered. Counts must identify whether they summarize the current delta, the retained display window, or the entire captured source.

For Cursor, preserve the original frame and delivery frame, open-turn reconciliation, stability checks, and terminal state. A changed grow-in-place frame is an update, not an additional immutable event. Metadata-only growth should not produce misleading empty activity or imply idleness. [S-OBSERVER-GUIDE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/documentation/docs/user-guide/skills/session-observer.md)

## Export and security

Activity exports can contain secrets, private code, command output, file paths, and tool-returned prompt injections. Label them as activity/debug exports, not automatically safe to publish. Keep the default sanitized export unchanged. The existing sanitizer removes structural/hidden payload categories; it is not a promise of exhaustive secret redaction. [S-EXPORT-GUIDE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/documentation/docs/user-guide/skills/export-session-transcript.md)

Render source content as data and never include a continuation directive in a retro export. Do not auto-follow arbitrary file paths supplied by tool output; sidecar reads should be confined to expected session artifacts or explicit approved roots. For `--all`, require users to have explicitly selected activity mode and make the broader exposure clear.
