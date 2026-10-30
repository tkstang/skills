---
title: 'Transcripts and Export'
description: 'Select a session, interpret source coordinates and read coverage, continue a page, and export Markdown safely.'
---

# Transcripts and Export

Use `read` for a selected session or `parse` for a known transcript file. Both
return a bounded view of the captured source. `export` turns that conversation
into a new Markdown file. Inspect coverage before treating any output as the
whole conversation.

## Identity and discovery

Current-session identity and historical discovery answer different questions:

| Operation       | What it establishes                                                                        |
| --------------- | ------------------------------------------------------------------------------------------ |
| `self-identify` | Exact current identity only when the result is `authoritative`; otherwise the CLI refuses. |
| `list`          | Historical candidates, with directory evidence and discovery coverage.                     |
| `search`        | Ranked historical candidates matching remembered text.                                     |

Directory and recency never establish exact current identity. Parent, root, and
grouping IDs cannot substitute for a native session ID; Codex parent environment
values alone are insufficient. The [library](library.md#current-identity-and-errors)
returns all identity statuses and their evidence for callers to interpret.

CLI `list` defaults to the invocation directory; library callers can omit `cwd`
for global history. Candidates report whether directory evidence came from
metadata or project layout. Discovery uses finite scan budgets and reports
omissions. Missing stores are empty; inaccessible or bounded scans report
incomplete coverage.

`--since` and `--until` accept relative hours, days, or weeks (`24h`, `7d`, `2w`),
`today`, `yesterday`, calendar dates, and ISO times. Upper calendar dates include
the whole local day. Prefer zoned ISO times in automation.

## Source coordinates

`read --session 'codex:SESSION_ID'` resolves an explicit provider-qualified native
ID. `parse /path/to/transcript.jsonl --runtime codex` reads a specified file
without discovery. Replace the provider and ID with your selected session.

Raw decoded records and their original source text remain available alongside
conversation messages. Coordinates describe different aspects of that source:

| Field                              | Meaning                                                                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `physicalLine`                     | One-based physical line number.                                                                                                              |
| Raw record `recordIndex`           | Zero-based decoded-object ordinal; malformed records do not count.                                                                           |
| `sourceOrdinal`                    | Claude/Codex: nonblank source-record ordinal, including malformed records. Cursor: JSONL frame ordinal, including blank or malformed frames. |
| `byteStart` / `byteEnd`            | Source byte range, independent of decoded-record counts.                                                                                     |
| Cursor message `recordIndex`       | Terminal record at which the message was delivered.                                                                                          |
| Cursor message `sourceRecordIndex` | Original record from which the message came.                                                                                                 |

Diagnostics retain their own source locations. Do not substitute a physical
line, byte offset, or decoded-object index for a provider source ordinal.

## Bounds and continuation

A read consumes at most 4,000,000 source bytes by default. Positive
`--max-records` and `--max-messages` limits can narrow it further. Records are
consumed whole, so one record can exceed a requested message limit.

| Control or result           | Meaning                                                                        |
| --------------------------- | ------------------------------------------------------------------------------ |
| `--max-bytes`               | Source byte budget for this read.                                              |
| `--from-offset`             | Starting provider source ordinal; defaults to zero.                            |
| `--cursor`                  | Opaque continuation token from the prior page; conflicts with `--from-offset`. |
| `coverage`                  | Whether the captured range is complete and why it is partial.                  |
| `nextOffset` / `nextCursor` | Continuation coordinates for the returned page.                                |
| `bytesRead` / `diagnostics` | Bytes inspected and problems encountered.                                      |

Use `--json` to inspect these results. An ordinary cursor is tied to the path,
provider, file generation, and message options. Appending to or replacing the
source invalidates it. Reads also check for source changes during capture. The
toolkit never persists offsets; callers own continuation and revalidation.

Cursor frames must end in a newline before a valid frame is delivered. An
unfinished frame waits; malformed or unfinished tails retain diagnostics and a
place to resume. Cursor conversation messages also require terminal events in
the captured page. A page starting mid-turn cannot recover messages buffered on
an earlier page. Callers that need continuity can retain the raw records.

Tool calls and results are independent opt-ins:

| Option                   | Added output                                              |
| ------------------------ | --------------------------------------------------------- |
| `--include-tool-calls`   | Recorded call previews, capped at 200 characters.         |
| `--include-tool-results` | Recorded result previews, capped at 500 characters.       |
| `--include-activity`     | A separate captured-page summary with usage and coverage. |

The page summary is not full-session activity. Use [Sensitive Activity](activity.md)
for full raw fields within a captured page.

## Exact Codex evidence

`seshtk read --session 'codex:SESSION_ID' --evidence --json` captures exact
recorded evidence with redacted tool expansion. This mode supports Codex only
and conflicts with ordinary cursor or offset pagination.

| Option                | Contract                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `--cutoff <token>`    | Reuses a captured prefix across appends; bound to file identity and prefix hash.                                 |
| `--expand <ref>`      | Expands a recorded tool reference; requires its cutoff.                                                          |
| `--related`           | Includes at most 16 related recorded events; requires expansion.                                                 |
| `--expand-offset <n>` | Starts at a byte offset within the redacted expansion field; requires `--expand` and conflicts with `--related`. |

A replacement or mutation of the captured prefix is refused. Redaction happens
before expansion windows are selected. Tool evidence comes from recorded data;
missing output is never reconstructed. The response exposes capture bounds and
coverage, with a 16 MiB capture ceiling. Unsupported providers refuse this mode.

## Export safety

Export creates Markdown at a new destination. Choose one selection mode:

| Mode                      | Selection behavior                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `--session <provider:id>` | Selects the exact native session; conflicts with `--match` and `--all`.                                |
| `--match <marker>`        | Finds a visible conversation marker among historical candidates; refuses missing or ambiguous matches. |
| `--all`                   | Exports the explicitly bounded candidate set and reports discovery coverage.                           |

Historical selection refuses unresolved ambiguity and incomplete discovery that
prevents a unique selection. Batch filenames include the provider and stay
inside the selected directory. Existing files and symlinks are never overwritten.

### Check whether the export is complete

Export defaults to **4,000,000 source bytes per transcript**. It can write a
partial document and exit 0. Check both forms of coverage:

- The Markdown file's `Source coverage:` line says `complete` or gives the
  reasons it is `partial`.
- With `--json`, each file's coverage is at `data.written[].coverage`. Library
  callers inspect `result.written[].coverage`; `discovery` separately describes
  historical candidate coverage.

Export has no continuation option. If a byte limit truncated the source,
increase `--max-bytes` (library option `maxBytes`) and export again to a **new
file**. The original destination cannot be overwritten:

```sh
seshtk export --session 'codex:SESSION_ID' --max-bytes 16000000 --out ./conversation-larger.md --json
```

Check coverage again after retrying. A larger byte budget does not repair
malformed data or other source gaps.

### Review before sharing

Sanitization removes hidden instructions and control payloads; it does not audit
visible text for credentials. Conversation text and optional tool previews can
still contain sensitive data. Review Markdown before sharing it.

Tool call and result opt-ins remain independent. Exported activity is rendered
as counts, without raw activity payloads. Raw records and structured evidence
remain sensitive. The toolkit owns no session selection, watch, delivery, or
consumer state.
