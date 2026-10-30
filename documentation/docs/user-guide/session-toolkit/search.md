---
title: 'Historical Search'
description: 'Find local sessions by remembered text, control scan size, and understand widening, redaction, and incomplete results.'
---

# Historical Search

Use `search` when you remember something discussed in a session. It searches
local historical evidence and returns ranked candidates. A candidate is a place
to investigate; it does not establish the current session or a complete index
of everything on the machine.

## Find a session

Patterns are case-insensitive regular expressions by default. Use `--literal`
when you want the exact text rather than regex syntax.

```sh
seshtk search -p 'deployment.*failed' --runtime codex --cwd /path/to/project --json
seshtk search -p 'release checklist' --literal --since 7d --json
```

| Option                | Effect                                                                         |
| --------------------- | ------------------------------------------------------------------------------ |
| `-p`, repeated        | Supplies multiple search patterns.                                             |
| `--runtime`           | Chooses `claude-code`, `codex`, `cursor`, or `auto` (the default).             |
| `--cwd`, repeated     | Starts in these directories; widens to other sessions if no matches are found. |
| `--since` / `--until` | Bounds the search in time.                                                     |
| `--tiers`             | Selects from `history,meta,content`; selected tiers keep that order.           |
| `--include-tools`     | Searches full recorded tool text in the content pass.                          |
| `--no-deep`           | Disables the fallback pass over tool output.                                   |

Directory hints are starting points, not strict filters. The result's `widened`
field tells you whether the search went beyond them.

Time bounds accept `24h`, `7d`, `2w`, `today`, `yesterday`, calendar dates, and
ISO date-times. An upper calendar date includes the whole local day. Prefer
zoned ISO times in automation.

## How the search widens

The selected tiers run from less expensive sources to transcript content:

| Tier                 | Evidence searched                                                                  |
| -------------------- | ---------------------------------------------------------------------------------- |
| `history`            | Recorded prompt history.                                                           |
| `meta`               | Available session titles and index or database metadata.                           |
| `content`            | Classified user and assistant text in transcripts.                                 |
| Tool-output fallback | Recorded tool fields, when earlier passes find nothing and deep search is enabled. |

`--include-tools` includes tool text immediately. Otherwise the final tool-output
pass is a fallback; `--no-deep` disables it. Search matches the original text,
including full tool fields when enabled, rather than shortened read previews.

## Large scans and limits

Estimate candidate files and bytes before authorizing an expensive content scan:

```sh
seshtk search estimate -p 'deployment.*failed' --runtime codex --json
```

| Limit                        | Default                               | Change it with       |
| ---------------------------- | ------------------------------------- | -------------------- |
| Returned sessions            | 15                                    | `--limit`            |
| Decoded line size            | 65,536 bytes                          | `--max-line-bytes`   |
| Scan authorization threshold | 2,147,483,648 estimated bytes (2 GiB) | `--large-scan-bytes` |
| Deadline                     | None                                  | `--deadline-ms`      |

A scan over the threshold produces `E_SCAN_CONFIRMATION` and exits 1. The error
details include the estimate, source reports, and any partial results. It never
prompts. After reviewing and authorizing the size, rerun the search with
`--allow-large-scan`.

Limits can leave results incomplete. A deadline returns the evidence collected
so far; malformed records and oversized lines are skipped and reported.

## Interpret results and privacy

Inspect these fields before drawing conclusions from either matches or an empty
result:

| Field         | What it tells you                                                   |
| ------------- | ------------------------------------------------------------------- |
| `results`     | Ranked matching sessions and redacted snippets.                     |
| `tiersRun`    | Which passes actually ran.                                          |
| `widened`     | Whether directory hints were widened.                               |
| `incomplete`  | Whether source gaps or limits prevented full coverage.              |
| `sources`     | Each source's availability, degraded status, and explanatory notes. |
| `diagnostics` | Scan counts, parse errors, oversized lines, and elapsed time.       |

History and index read failures, malformed records, and oversized records appear
in source notes. Affected sources are marked degraded and `incomplete` is true.
An empty search returns exit 0; it does not prove a session never existed or that
all sources were readable.

Redaction runs on each whole text item before a snippet window is selected.
Matching uses the original text, so a result can match text hidden in its
snippet. Treat raw transcripts separately as sensitive data. See the
[CLI reference](cli.md#machine-output) for the enclosing response and errors.

## Optional accelerators

`rg` and `sqlite3` are optional. The toolkit looks for them on PATH and in common
system locations. Without `rg`, Node still searches transcripts. Unavailable
SQLite metadata is reported where applicable.

| Environment variable             | Use                                                                   |
| -------------------------------- | --------------------------------------------------------------------- |
| `SESHTK_SEARCH_NO_RG=1`          | Disable `rg`.                                                         |
| `SESHTK_SEARCH_NO_SQLITE3=1`     | Disable `sqlite3`.                                                    |
| `SESHTK_SEARCH_RG`               | Set an explicit `rg` executable path.                                 |
| `SESHTK_SEARCH_SQLITE3`          | Set an explicit `sqlite3` executable path.                            |
| `SESHTK_SEARCH_PROBE_TIMEOUT_MS` | Set the tool-probe timeout; default 3000 ms, clamped to 500–60000 ms. |

Library callers use `searchSessions` and `estimateSearch` with the same stateless
operations. Their `home` and `env` options support isolated stores; see the
[library reference](library.md).
