# 07. Implementation plan and regression tests

## Scope boundary

Implement Claude and Codex activity first, then Cursor integration through its existing frame path. The 17-provider catalog is a future compatibility reference. It should not inflate this change into a universal session platform.

The sequence below is implementation work to perform after this research packet. No code changes or upstream test execution are claimed here.

## Stage 1: preserve structure before rendering

Add a detailed read helper that returns each decoded record together with physical line/byte location and parse diagnostics. Keep the old `readRecords()` return type and logical-index behavior intact as a compatibility projection. The current reader discards blank/malformed lines, so blindly labeling an existing `recordIndex` as a physical line is incorrect. [S-CORE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/core/runtimes.ts)

Create a small shared `activity/` module with native extractors, the typed contract, category classification, and a pure projection function. Start from the continues two-pass pattern, but keep exact original names/IDs and all content blocks. Record missing/unmatched data rather than throwing away the entire event.

## Stage 2: close Codex coverage gaps

Support `function_call`, `function_call_output`, `custom_tool_call`, `custom_tool_call_output`, and web-search call evidence. Preserve both parsed arguments and the original argument carrier. If arguments are malformed JSON, retain the raw string and mark the parse error; do not drop the invocation.

Keep ask-user detection and its human/auto-resolution caveat. Preserve `call_id` independently of a message's `id`. For shell calls that start a continuing process, an initial session handle is not the final command outcome; later stdin/poll results must not be mistaken for unrelated success records.

The current gap and donor parsing cases are visible in [S-CORE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/core/runtimes.ts) and [C-CODEX](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/codex.ts).

## Stage 3: add one opt-in projection to each skill

| Existing or proposed file | Change |
|---|---|
| Existing `src/transcript/core/runtimes.ts` | Add/compose detailed reading; preserve default normalization and existing index semantics. |
| New `src/transcript/core/activity/types.ts` | Minimal event/report/source reference contracts. |
| New `src/transcript/core/activity/anthropic.ts` | Claude-style tool blocks and results; explicit correlation. |
| New `src/transcript/core/activity/codex.ts` | Codex function/custom calls, results, and relevant metadata. |
| New `src/transcript/core/activity/summarize.ts` | Categories, deterministic enrichment, sample selection, and budgets. |
| Existing `src/transcript/session-observer/session-observer.ts` | Parse `--include-activity` and thread it through review/catch-up/watch. |
| Existing observer `lib/digest.ts` and types | Add a separate activity envelope; preserve default schema consumers. |
| Observer observation/watch plumbing | Carry projection options without changing exact pin or checkpoint behavior. |
| Existing `src/transcript/export-session/export-session-transcript.ts` | Add the opt-in flag; call shared activity extraction independently of conversation sanitization. |
| Existing export sanitizer | Retain default policy; do not globally disable hidden-payload filtering. |
| Existing `scripts/build-generated.mjs` | Register each new shared module for both skill distributions and rewrite imports as needed. |
| Both `SKILL.md` files and user guides | Document the flag, limits, sensitive data, and unsupported provider surfaces. |

Existing source/output mappings are confirmed in [S-BUILD](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/scripts/build-generated.mjs); exporter flag parsing and pipeline are in [S-EXPORT](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/export-session/export-session-transcript.ts). New module names are suggestions, not discovered files.

## Stage 4: Cursor-specific integration

Use the frame analysis as the source of activity identity and lifecycle. Do not implement only `normalizeCursor()` and assume the observer is covered. Test the observer v2 and exporter paths separately because they currently use different projection machinery. [S-CORE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/core/runtimes.ts) [S-DIGEST](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/session-observer/lib/digest.ts)

Do not promise result payloads from the agent-transcript surface when none were recorded. Calls, arguments, human questions, source pointers, and availability status can still make the activity view substantially more useful.

## Stage 5: optional metadata and sidecar expansion

Add model/usage/lifecycle/compaction notes with source-native semantics. Then add only explicitly linked Claude child/result artifacts. Keep recursive child trajectory ingestion and instruction-body inclusion separately opt-in or deferred. Do not copy same-directory predecessor guessing. [C-CLAUDE](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/claude.ts)

## Contract and compatibility tests

| Fixture | Expected invariant |
|---|---|
| Existing snapshots, no new flag | Output and state transitions remain unchanged. |
| Claude call/result with stable ID | Exact name/ID preserved and both sides linked. |
| Result array with three text blocks | All blocks remain addressable; preview loss is declared. |
| Empty result with error flag | Error is preserved even when output text is empty. |
| Very long shell output with final failure | Tail comes from actual end, not truncated prefix. |
| Repeated identical commands | Distinct invocations remain distinct; count is not content-deduplicated. |
| A later failure after the sample cap | Error is represented or explicitly omitted with a pointer; first-N sampling cannot hide it silently. |
| Unknown MCP tool | Generic call/result retained without a new classifier branch. |
| Newline/emoji/non-ASCII output | Byte limits and character previews do not corrupt data or source offsets. |
| Malformed argument JSON | Call retained with raw carrier and parse warning. |
| Codex custom apply_patch plus result | Raw patch and result correlated by `call_id`. |
| Call before catch-up boundary, result after it | New result is rendered with correct earlier-call identity. |
| Result without matching call | Retained as unmatched; no fabricated call or success. |
| Multiple outputs/updates for one call | All source updates retained or ordered; no silent last-write replacement. |
| Truncated final JSONL line | Warning and stable read boundary; no invented event. |
| Malformed interior line | Logical record and physical line mapping remain distinct. |
| Cursor pending frame then terminal success | Observation reconciles without duplicate counts. |
| Cursor grow-in-place tail | Revision handled by existing continuity rules. |
| Cursor aborted/error/cancelled turn | Failed lifecycle not promoted to successful completion; human question still handled. |
| Cursor no recorded tool result | Explicit coverage state, never invented result. |
| Ask-user timer/default | No unjustified human attribution. |
| Tool text includes instructions | Rendered as data; no evaluator command execution. |
| Tool output includes a skill-body-shaped string | Activity is not accidentally removed by conversation sanitizer; exposure remains explicit. |
| Missing/malformed sidecar | Correct `not-found`/`malformed` status, no synthetic child success. |
| Two same-cwd sessions | No implicit predecessor chaining or cross-session call-ID collision. |
| Tail-sliced digest | Range/count/truncation semantics identify omitted activity. |
| Retro `review` without mark-read | Collaborator's unread state unchanged. |
| Token counts cumulative vs per-message | No double-counting of cumulative totals. |

## Output schema compatibility

Do not widen legacy `DigestEntry.kind` without auditing exhaustive switches in consumers. Prefer an independently versioned optional `activity` envelope while keeping existing entries stable. Review schema validators to ensure the additive field is accepted; otherwise introduce a clearly versioned response contract only for the opt-in mode. Cursor's existing v2 is not a generic successor to Claude/Codex v1, so do not rename those contracts casually.

## Repository checks

The existing repository supplies these commands:

```bash
pnpm run build
pnpm run type-check
pnpm run build:check
pnpm test
pnpm run validate
pnpm run smoke
```

They are a verification plan, **not checks run during this research**. Add targeted fixture tests in the repository's transcript test layout, then run the normal premerge sequence. Confirm both generated distributions contain the new modules and no extra runtime dependency leaked into them. [S-PACKAGE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/package.json) [S-BUILD](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/scripts/build-generated.mjs)

## Done means

A user can request activity from either existing skill with one explicit flag; Claude/Codex calls and results have structured, attributable evidence; Cursor is honestly qualified; old behavior is unchanged; late results, malformed input, and large output are tested; generated artifacts and documentation agree. A daemon, public service, cross-provider launcher, and automatic skill updater are not acceptance criteria.
