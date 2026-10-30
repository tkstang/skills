---
title: 'Transcripts and Export'
description: 'Understand exact identity, historical discovery, source coordinates, bounded reads, Codex evidence, and Markdown exports.'
---

# Transcripts and Export

Use [CLI Reference](cli.md) for command examples and [Library Reference](library.md)
for the equivalent public APIs. These contracts apply to local Claude Code,
Codex, and Cursor transcripts unless a provider restriction is stated.

## Identity and discovery

`self-identify` establishes current identity only when authoritative evidence is
available. No cwd or recency winner is relabeled exact identity. Parent, root,
and grouping IDs never substitute for a native session ID; Codex parent
environment values alone are insufficient. The CLI refuses ambiguity or
unavailability; the library returns that status and structured evidence.

`list` is historical, with metadata/layout provenance, finite scanning budgets,
omissions and coverage. CLI list defaults to invocation cwd; library callers can
omit cwd for global history. `--since`/`--until` accept relative `Nh`/`Nd`/`Nw`,
today/yesterday, calendar dates and ISO times. Upper calendar dates include the
whole local day. Prefer zoned ISO times in automation. Missing stores are empty;
inaccessible or bounded scans report incomplete coverage.

## Source coordinates

`read` resolves an explicit `<provider>:<native-id>`; `parse` accepts a file and
explicit provider without discovery. Raw records/carriers remain intact.
`physicalLine` is one-based; `recordIndex` counts decoded objects from zero.
Claude/Codex `sourceOrdinal` counts nonblank source records, including malformed
records; Cursor counts JSONL frames, including blank/malformed frames. Source
byte bounds and diagnostics remain separate. Cursor delivery `recordIndex`
points to the terminal record; `sourceRecordIndex` points to the message origin.

## Bounds and continuation

`--from-offset` defaults to zero in the declared provider source coordinate.
Opaque `--cursor` conflicts with offset and binds path, runtime, generation and
projection. Any append/replacement invalidates ordinary cursors. Reads check for
source changes and never persist offsets. `--max-bytes` defaults to 4,000,000
source bytes; optional positive `--max-records`/`--max-messages` combine. Whole
records are consumed, so one record can exceed a message limit. Inspect
`coverage`, `nextOffset`, `nextCursor`, `bytesRead` and diagnostics; a bound is
never evidence of complete history. Valid but unclosed Cursor frames wait for a
newline; malformed/unclosed tails retain resumable diagnostics.

Conversation messages are projections of each captured page. Cursor messages
require captured terminal events; a page starting mid-turn cannot reconstruct
prior-page buffered messages. Raw records remain available for consumer-owned
continuity. `--include-tool-calls` and `--include-tool-results` are independent;
tool-call previews are capped at 200 characters and tool-result previews at
500 characters. `--include-activity` adds a
separate page summary and usage/coverage, not complete full-session activity.

## Exact Codex evidence

Codex `read --evidence` requires JSON and conflicts with ordinary cursor/offset.
`--cutoff <token>` freezes a captured prefix across appends, bound to file
identity and prefix hash; replacement/prefix mutation refuses. `--expand <ref>`
requires cutoff; `--related` requires expand and includes at most 16 events.
`--expand-offset <n>` selects a byte offset within a redacted field and conflicts
with related. Redaction runs before windows; tool evidence is derived from
recorded data, not reconstructed missing output. Source capture bounds/coverage
are explicit; evidence has a 16 MiB capture ceiling. Unsupported providers refuse.

## Export safety

Exact session selection conflicts with marker/batch selection. Historical
selection refuses ambiguity and marker misses. `--all` writes the explicitly
bounded candidate set and reports discovery coverage. Outputs use exclusive new
file creation; existing files and symlinks are never overwritten. Batch names
are provider-qualified and confined to the chosen directory. Tool opt-ins remain
independent; activity is rendered as counts, without raw activity payloads.

Sanitization removes hidden instruction and control payloads. It is **not a
credential audit**: visible conversation/tool text may contain sensitive data.
Review Markdown before sharing. Raw records and structured evidence are sensitive
and have no general shareability guarantee. No selection, watch, delivery or
consumer state is owned by this package.
