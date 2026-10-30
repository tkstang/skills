---
title: 'CLI Reference'
description: 'Use seshtk commands, JSON envelopes, exit codes, capability discovery, and update controls.'
---

# CLI Reference

Install the CLI as shown in [Session Toolkit](index.md). Replace `SESSION_ID`
in these examples with a native session ID from a search or list result. Use
`seshtk <command> --help` for the installed command options.

## Command examples

```sh
seshtk self-identify --cwd /repo --json
seshtk list --runtime auto --cwd /repo --limit 100 --json
seshtk read --session 'codex:SESSION_ID' --max-records 100 --json
seshtk parse /explicit/transcript.jsonl --runtime cursor --max-bytes 4000000 --json
seshtk read --session 'codex:SESSION_ID' --evidence --json
seshtk export --session 'claude-code:SESSION_ID' --out /new/conversation.md --json
seshtk export --runtime auto --cwd /repo --match 'visible marker' --out /new/match.md
seshtk export --runtime auto --cwd /repo --all --out /new/batch --json
```

## Machine output

All commands accept `--json`; capabilities always emits JSON. Machine mode emits
exactly one newline-terminated envelope, including help/version:
`{ok:true,schema_version:1,data:...}` or
`{ok:false,schema_version:1,error:{code,message,hint,details?}}`.
Diagnostics go to
stderr. Plain reads print conversation; other plain operations print structured
JSON. No arguments prints help. No prompts or color. Interactive-only update checks
are described below; machine and unattended contexts perform no update lookup.

## Exit codes and errors

Exit codes are 0 for an interpretable result (including partial coverage), 1 for
usage/selection action, and 2 for I/O/unexpected failure.
Codes are `E_USAGE`,
`E_AMBIGUOUS`, `E_UNAVAILABLE`, `E_CURSOR_INVALID`, `E_SOURCE_CHANGED`, `E_IO`,
`E_INTERNAL`, `E_SCAN_CONFIRMATION`.
Exact CLI identity refuses ambiguity/unavailability; its error
`details` retains structured evidence. Library identity returns that status.
See [identity and discovery](transcripts.md#identity-and-discovery) for selection semantics.

## Capabilities

Implemented IDs: `toolkit.capabilities.v1`, `cli.help.v1`, `cli.version.v1`,
`identity.current.v1`, `sessions.list.v1`, `transcript.read.v1`,
`transcript.parse.v1`, `transcript.evidence.codex.v1`, `export.markdown.v1`,
`search.v1`, `search.estimate.v1`, `activity.v1`.
Providers are `claude-code`, `codex`, `cursor`; evidence capability is Codex only.

For patterns and scan controls, see [Historical Search](search.md). For full
structured capture, see [Sensitive Activity](activity.md). Source coordinates,
continuation, exact evidence, and export rules are covered in
[Transcripts and Export](transcripts.md).

## Update notices

Successful interactive operations check for newer stable releases, at most once
per 24 hours, and print a notice on **stderr**. Both stdin and stderr must be
TTYs. `--json`, bare `capabilities`, help/version, CI and non-TTY invocations
perform **zero update network lookups** and print no notice. Set
`SESHTK_NO_UPDATE_CHECK=1` to disable checking explicitly. Library imports and
bundled library functions cannot invoke this CLI-only updater; unattended hooks
need no network access.

The cache is `$XDG_CACHE_HOME/session-toolkit/update.json` or
`~/.cache/session-toolkit/update.json`. Lookup failures are cached for 24 hours
and never fail a session operation. Malformed/expired caches are refreshed.
The registry request has a 1-second timeout; only stable SemVer releases newer
than the installed version trigger a notice. No automatic upgrade runs. The
notice gives an explicit-version installation command; stdout remains the
requested operation's output.
