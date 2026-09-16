# 04. Existing skills: actual fidelity and extension points

## Current architecture

Canonical code is under `src/transcript/`. Generated, standalone `.mjs` code is distributed under each skill's `scripts/` directory. `scripts/build-generated.mjs` maps shared runtime, Cursor, digest, observer, and exporter sources into their shipped copies. The repository already has build, generated-output checks, type checking, tests, validation, and smoke scripts. [S-BUILD](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/scripts/build-generated.mjs) [S-PACKAGE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/package.json)

```text
src/transcript/core/runtimes.ts
       |                         |
       v                         v
session-observer          export-session
selection/state           selection/marker
normalization             normalization
digest/filtering          content sanitization
watch/delivery            Markdown export
```

Cursor also has frame analysis and a separate v2 digest/state path. An edit only to generic `normalizeCursor()` will not automatically enrich every observer path. [S-OBSERVER-GUIDE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/documentation/docs/user-guide/skills/session-observer.md) [S-CORE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/core/runtimes.ts) [S-DIGEST](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/session-observer/lib/digest.ts)

## What existing flags really do

| Runtime/path | Default | `--include-tools` / `--debug` today | Main work needed |
|---|---|---|---|
| Claude observer | Conversation and ask-user decisions; other tool activity filtered | Compact calls and results; inputs/results cut to 200/500 characters | Preserve structured IDs/inputs/results before text rendering; derive rich activity. |
| Codex observer | Recognized conversation messages and ask-user exchanges | Compact `function_call` markers; **no general `function_call_output` output**, and no custom-tool branch | Add general and custom call/result pairs; metadata/lifecycle projection; retain current ask-user logic. |
| Cursor observer | Lifecycle-aware observation projection with frame provenance | Generic normalizer supports call markers, but v2 observer path is separate; recorded results are unavailable on the documented surface | Enrich frame-derived activity without flattening its continuity/completion contract. |
| Exporter | Sanitized visible conversation, with ask-user exception | No corresponding rich-activity CLI option in the inspected entrypoint | Add an explicit opt-in path; do not run tools through conversation-only filtering. |

Evidence: [S-CORE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/core/runtimes.ts) [S-OBSERVER](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/skills/session-observer/SKILL.md) [S-DIGEST](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/session-observer/lib/digest.ts) [S-EXPORT](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/export-session/export-session-transcript.ts) [S-EXPORT-GUIDE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/documentation/docs/user-guide/skills/export-session-transcript.md)

The earlier blanket characterization of your debug mode as preserving tool-result excerpts on every runtime was too broad. The Codex code handles results only when they belong to the ask-user call map. Later non-message types fall out of the normalizer. [S-CORE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/core/runtimes.ts)

## Why filtering is only part of the change

Your `DigestEntry` has `role`, `text`, `recordIndex`, optional source index, kind, and optional tool name/provenance fields. It does not carry a general raw argument object, complete result payload, stable native call ID, per-block source path, exit-code provenance, or structured patch. Once the text marker is produced, increasing renderer verbosity cannot reconstruct those fields. [S-CORE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/core/runtimes.ts)

The extension should therefore read activity from the original parsed records, not parse your current `[ToolName] ...` strings. Keep the existing normalization path for the default view while introducing a shared activity extractor alongside it.

## Indexing and source location

`readRecords()` drops blank lines and malformed JSON while returning only successfully parsed objects. Array indices in that returned value are consequently **not always physical file line numbers**. Existing record-index checkpoints must keep their existing meaning. [S-CORE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/core/runtimes.ts)

For new activity references, use an explicit locator, preferably physical line plus JSON pointer for JSONL, and preserve the existing logical/delivery index separately. A tool block inside one Claude record needs a block index; several calls can share the same record. Cursor additionally needs original frame versus delivery frame. Do not convert a record index to a line number by adding one unless the reader has verified that mapping.

This is a small reader enhancement, not a migration of every existing state file: add a detailed read API returning objects plus source coordinates, and leave `readRecords()` as a compatibility projection.

## Output limits and catch-up

The normal digest can fall back to the last eight groups after a 20,000-character threshold when no explicit tail constraint is supplied. The implementation reports omitted content and recovery pointers. Rich activity must participate in output budgeting and coverage reporting, rather than silently bypassing the budget or silently pretending every event was shown. [S-DIGEST](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/session-observer/lib/digest.ts)

A result arriving after the call was previously consumed is new information. Correlate against the full available input or a call-ID lookup, then select the delivery range. Filtering to only newly arrived records before constructing the call map would lose the earlier call's identity.

Catch-up/watch state is a consumer's delivery state. A retrospective should normally use a pinned `review` without `--mark-read`, or an independent snapshot. It must not advance a collaborator's unread checkpoint. [S-OBSERVER](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/skills/session-observer/SKILL.md)

## Cursor is not an ordinary append-only transcript

Your docs separate observed substantive content, terminal completion, delivery progress, continuity checkpoints, frame indexes, and source-frame recovery. Grow-in-place trailing frames and failed/aborted turns are already handled deliberately. [S-OBSERVER-GUIDE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/documentation/docs/user-guide/skills/session-observer.md)

Keep that model. Rich tools should be associated with the frame/turn that supplies them and expose `pending-lifecycle`, terminal-success, or terminal-incomplete availability as appropriate. A later terminal record must reconcile an earlier observation, not count the tool a second time. A missing result is `not-recorded-on-surface` or `unknown`, not a successful result.

The exporter currently uses the shared Cursor normalization path, which is not identical to observer v2. The plan must test both paths independently. [S-CORE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/core/runtimes.ts) [S-DIGEST](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/session-observer/lib/digest.ts) [S-EXPORT](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/export-session/export-session-transcript.ts)

## Export-specific considerations

The exporter removes skill bodies, environment/instruction payloads, tool mechanics, subagent notifications, and automatic wake envelopes. Those protections are intentional. Add a separate activity section or sidecar rather than disabling the sanitizer globally. The activity extractor still must respect automatic-control provenance and human-decision attribution. [S-EXPORT-GUIDE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/documentation/docs/user-guide/skills/export-session-transcript.md)

The current Codex candidate enumeration has a 30-day lookback based on candidate modification time. `--all` therefore means all enumerated candidates under that behavior, not necessarily every historical Codex log on disk. Historical retros may eventually need explicit path selection or a documented wider lookback, but that is separate from adding activity fidelity. [S-EXPORT](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/export-session/export-session-transcript.ts)

## Changes not justified by this request

Do not replace peer selection with latest-session guessing. Do not migrate Cursor state into generic record counters. Do not make the two distributed skills depend on a globally installed continues CLI. Do not change default exports into secret-bearing debug dumps. Do not equate tool-count summaries with a complete execution trace.
