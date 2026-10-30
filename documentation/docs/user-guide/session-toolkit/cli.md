---
title: 'CLI Reference'
description: 'Choose a seshtk command, inspect supported operations, and handle JSON output, errors, and update notices.'
---

# CLI Reference

Use `seshtk` to inspect local session history from a terminal or script.
[Install Session Toolkit](index.md), then run `seshtk <command> --help` for the
options supported by your installed version.

## Choose a command

| Command           | Purpose                                                             | More detail                                             |
| ----------------- | ------------------------------------------------------------------- | ------------------------------------------------------- |
| `self-identify`   | Check the exact current session using host and transcript evidence. | [Identity](transcripts.md#identity-and-discovery)       |
| `list`            | Browse historical sessions by directory or time.                    | [Discovery](transcripts.md#identity-and-discovery)      |
| `search`          | Find historical sessions from remembered text.                      | [Search](search.md)                                     |
| `search estimate` | Estimate candidate files and bytes before searching content.        | [Scan authorization](search.md#large-scans-and-limits)  |
| `read`            | Read a provider-qualified native session ID.                        | [Bounded reads](transcripts.md#bounds-and-continuation) |
| `parse`           | Read an explicit transcript file with a specified provider.         | [Source coordinates](transcripts.md#source-coordinates) |
| `export`          | Save conversational Markdown to a new file or bounded batch.        | [Export safety](transcripts.md#export-safety)           |
| `activity`        | Capture sensitive structured records and recorded tool activity.    | [Activity](activity.md)                                 |
| `capabilities`    | Report the installed version, providers, and supported operations.  | [Capabilities](#capabilities)                           |

Replace `SESSION_ID` in examples with a native ID from a selected result. The
prefix is one of `claude-code`, `codex`, or `cursor`.

```sh
seshtk self-identify --cwd /path/to/project --json
seshtk list --cwd /path/to/project --since 7d --json
seshtk search -p 'deployment failed' --literal --json
seshtk search estimate -p 'deployment failed' --literal --json
seshtk read --session 'codex:SESSION_ID' --max-records 100 --json
seshtk parse /path/to/transcript.jsonl --runtime cursor --max-bytes 4000000 --json
seshtk read --session 'codex:SESSION_ID' --evidence --json
seshtk activity --session 'codex:SESSION_ID' --json
seshtk activity --session 'claude-code:SESSION_ID' --out ./activity.json --json
```

Export accepts an exact session, a visible conversation marker, or a bounded
batch. These selection modes have different ambiguity rules; see
[export safety](transcripts.md#export-safety).

```sh
seshtk export --session 'claude-code:SESSION_ID' --out ./conversation.md --json
seshtk export --cwd /path/to/project --match 'visible marker' --out ./match.md
seshtk export --cwd /path/to/project --all --out ./transcripts --json
```

## Capabilities

Before an integration depends on a command or its output format, check the installed
version and the capability IDs it requires:

```sh
seshtk --version
seshtk capabilities --json
```

The capability response includes `data.version`, `data.providers`, and
`data.capabilities`. A package version alone does not establish that an operation
is supported. The currently implemented IDs are:

| Operation                                    | Capability ID                               |
| -------------------------------------------- | ------------------------------------------- |
| Capability discovery                         | `toolkit.capabilities.v1`                   |
| Help and version output                      | `cli.help.v1`, `cli.version.v1`             |
| Exact current identity                       | `identity.current.v1`                       |
| Historical listing                           | `sessions.list.v1`                          |
| Transcript reading and explicit-file parsing | `transcript.read.v1`, `transcript.parse.v1` |
| Codex cutoff and expansion evidence          | `transcript.evidence.codex.v1`              |
| Markdown export                              | `export.markdown.v1`                        |
| Search and scan estimation                   | `search.v1`, `search.estimate.v1`           |
| Sensitive activity capture                   | `activity.v1`                               |

The reported providers are `claude-code`, `codex`, and `cursor`. Exact evidence
cutoffs and expansion support Codex only.

## Machine output

Add `--json` to any command for exactly one newline-terminated response envelope.
This includes help and version output. `capabilities` always uses this format.

```json
{ "ok": true, "schema_version": 1, "data": {} }
```

Failures replace `data` with an `error` object containing `code`, `message`,
`hint`, and optional `details`. Diagnostics go to stderr, leaving stdout for the
single response.

Without `--json`, `read` and `parse` print conversation text; other operations
print structured JSON. Running `seshtk` without arguments prints help. Commands
never prompt or emit color. JSON and unattended invocations perform no update
lookup.

## Exit codes and errors

A successful exit means the result can be interpreted; inspect its coverage to
learn whether it is complete.

| Exit | Meaning                                                                    |
| ---- | -------------------------------------------------------------------------- |
| 0    | Successful result, including no search matches or partial source coverage. |
| 1    | Any reported error except `E_IO` and `E_INTERNAL`.                         |
| 2    | `E_IO` or `E_INTERNAL`.                                                    |

| Error code            | What to inspect                                                                 |
| --------------------- | ------------------------------------------------------------------------------- |
| `E_USAGE`             | Options, arguments, and conflicting selection modes.                            |
| `E_AMBIGUOUS`         | Multiple matching sessions or conflicting identity evidence.                    |
| `E_UNAVAILABLE`       | Missing sources or insufficient evidence for the operation.                     |
| `E_CURSOR_INVALID`    | A continuation or evidence token that does not fit the request.                 |
| `E_SOURCE_CHANGED`    | A transcript changed since the captured read or token.                          |
| `E_SCAN_CONFIRMATION` | Estimated scan size; rerun with `--allow-large-scan` only after authorizing it. |
| `E_IO`                | Source and destination paths and permissions.                                   |
| `E_INTERNAL`          | An unexpected failure; retain the installed version when reporting it.          |

`self-identify` succeeds only for `authoritative` identity. Other identity
statuses produce an error whose `details` preserves the structured evidence.
[Library identity calls](library.md#current-identity-and-errors) return the status
for the caller to interpret.

## Update notices

Successful interactive operations can check npm for a newer stable release.
Both stdin and stderr must be TTYs. A notice goes to stderr and includes an
explicit-version installation command; no automatic upgrade runs.

| Control or condition                      | Behavior                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| `SESHTK_NO_UPDATE_CHECK=1`                | Disables checking.                                                          |
| `--json`, help/version, or `capabilities` | No update lookup or notice.                                                 |
| CI or non-TTY invocation                  | No update lookup or notice.                                                 |
| Library imports and functions             | Cannot invoke the CLI-only updater.                                         |
| Cached lookup                             | Reused for 24 hours, including failed lookups.                              |
| Registry request                          | Has a 1-second timeout; only newer stable SemVer releases trigger a notice. |

The cache is `$XDG_CACHE_HOME/session-toolkit/update.json`, falling back to
`~/.cache/session-toolkit/update.json`. Missing, malformed, or expired caches
trigger a fresh lookup. Lookup and cache-write failures never fail the requested
session operation; its stdout remains unchanged.
