---
title: 'Historical Search'
description: 'Search local raw session evidence with patterns, finite bounds, and explicit large-scan authorization.'
---

# Historical Search

## Find a session

```sh
seshtk search -p 'deployment.*failed' --runtime codex --cwd /path/to/project --json
seshtk search estimate -p 'deployment.*failed' --json
```

`searchSessions({ patterns: ['deployment.*failed'], runtime: 'codex' })` and
`estimateSearch` provide the same stateless operations to library callers.

Patterns are case-insensitive regexes by default; `--literal` matches text.
Repeat `-p` and `--cwd` as needed. Cwd hints widen to other sessions if they
find no matches. `--since`/`--until` accept relative times such as `24h`, `7d`,
`2w`, `today`, `yesterday`, calendar dates, and ISO date-times. Upper calendar
dates include the whole local day; prefer zoned ISO times in automation.

History, metadata and content tiers run in canonical order; `--tiers` selects
those tiers. A final tool-output pass runs when earlier tiers find nothing;
`--no-deep` disables it and `--include-tools` includes tools immediately.

## Bounds and coverage

| Control                      | Default                               | Change it with       |
| ---------------------------- | ------------------------------------- | -------------------- |
| Returned sessions            | 15                                    | `--limit`            |
| Decoded line size            | 65,536 bytes                          | `--max-line-bytes`   |
| Scan authorization threshold | 2,147,483,648 estimated bytes (2 GiB) | `--large-scan-bytes` |
| Deadline                     | None                                  | `--deadline-ms`      |

`E_SCAN_CONFIRMATION` (exit 1) reports the estimate and requires
`--allow-large-scan`; it never prompts. No matches returns an empty result
(exit 0).
Cheap-source notes summarize skipped malformed/oversized history or index records and index read failures; these sources are degraded and `incomplete` is true. `incomplete`, source status and diagnostics expose deadlines, malformed
records and oversized lines.
Results are ranked bounded evidence, not an
exhaustive index. Snippets redact complete units before windowing. Search reads
raw classified records, including full tool fields, rather than digest previews.

## Optional accelerators

Optional `rg`/`sqlite3` accelerators are discovered from PATH and common system
locations. The Node fallback preserves transcript search; unavailable sqlite
metadata is reported when applicable. Use `SESHTK_SEARCH_NO_RG=1` or
`SESHTK_SEARCH_NO_SQLITE3=1` to disable them, `SESHTK_SEARCH_RG` and
`SESHTK_SEARCH_SQLITE3` for explicit executable paths, and
`SESHTK_SEARCH_PROBE_TIMEOUT_MS` for probe timeout (default 3000, clamped 500–60000).
The library accepts explicit `home` and `env` for isolated stores.

## Interpret results

For the JSON envelope and exit codes, see [CLI Reference](cli.md). Toolkit search
returns exit 0 for no matches and `E_SCAN_CONFIRMATION` (exit 1) for a scan that
needs authorization. Callers should inspect source reports and `incomplete`
before treating an empty result as evidence that no matching session exists.
