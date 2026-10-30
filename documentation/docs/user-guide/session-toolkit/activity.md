---
title: 'Sensitive Activity'
description: 'Capture recorded tools, usage, and raw session records while preserving privacy boundaries, source locations, and provider gaps.'
---

# Sensitive Activity

Use `activity` when you need recorded tool arguments, results, and source
records beyond conversational previews. The output is sensitive JSON with no
sanitization. For a conversation document to review for sharing, use
[Markdown export](transcripts.md#export-safety).

## Capture a session

Replace `SESSION_ID` with a selected native session ID:

```sh
seshtk activity --session 'codex:SESSION_ID' --json
seshtk activity --session 'claude-code:SESSION_ID' --out ./activity.json --json
```

Without `--out`, the capture is returned in the CLI response. With `--out`, the
CLI creates a new JSON file with owner-only permissions (`0600`) and refuses an
existing destination. The response then describes the artifact, its source, and
coverage. Library callers use `captureActivity({ session: 'codex:SESSION_ID' })`
to receive the capture directly.

## What the capture contains

The capture preserves the full raw records read within its bounds, including
hidden instruction fields. Recorded tool arguments and results are not shortened
into previews or redacted for sharing.

| Output                 | What it preserves                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| Raw records            | Every captured field and original source text, including provider details outside the activity event model. |
| Activity events        | Supported recorded tool, item, and metadata facts, with call/result relationships when available.           |
| Usage                  | Provider-recorded usage when present and supported.                                                         |
| Provenance             | Session/source identity and original source coordinates.                                                    |
| `support` and coverage | What the provider records, what was captured, and what is missing.                                          |

Never treat an absent event or outcome as proof it did not happen. External
persisted outputs and child-session histories are reported as not read; paths
found in payloads are never followed.

## Provider coverage

All three providers support activity capture, with different recorded detail:

| Provider    | Available detail                                                       | Gaps                                                                                    |
| ----------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Claude Code | Recorded calls/results and their relationships; usage when present.    | Missing data is not invented; external outputs and child histories are not read.        |
| Codex       | Recorded calls/results and their relationships; usage when present.    | Missing data is not invented; external outputs and child histories are not read.        |
| Cursor      | Recorded calls and turn lifecycle from transcript frames; raw records. | Individual call results, per-call outcomes, and usage are not recorded on this surface. |

Inspect `support` and coverage rather than assuming that every provider exposes
the same evidence.

## Bounds and continuation

Activity captures a page, with the same source-read controls as `read`. The
default budget is 4,000,000 source bytes. See
[bounds and continuation](transcripts.md#bounds-and-continuation) for cursor
invalidation, source ordinals, and record/message limits.

| Field                                             | Meaning                                                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `scope`                                           | `captured-page`; the result is not automatically a full-session capture.                                           |
| `sourceRead.coverage.fullSource`                  | True only for coverage from byte zero through the captured end with no source diagnostics or other incompleteness. |
| `sourceRead.records`                              | Raw records with source ordinals, decoded-object ordinals, physical lines, byte ranges, and Cursor frame indices.  |
| `sourceRead.nextOffset` / `sourceRead.nextCursor` | Coordinates for continuation of the source read.                                                                   |
| `sourceRead.diagnostics`                          | Malformed, non-object, and unfinished-source records.                                                              |

A later page can lack the earlier context needed to associate a result with its
call. Raw source coordinates remain intact. Cursor event locations retain both
the original source frame and terminal delivery frame. Callers own saved offsets,
watching, and session selection.
