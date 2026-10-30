---
title: 'Session Toolkit'
description: 'Find, read, search, and export local coding-agent sessions with the seshtk CLI or typed JavaScript APIs.'
---

# Session Toolkit

Session Toolkit gives terminal users and JavaScript applications access to local
Claude Code, Codex, and Cursor sessions. Use it to find an earlier conversation,
read a bounded transcript, or save a sanitized Markdown copy.

## Install and try it

Requires Node.js 22 or later. The package supports Node 22.0.0 and 24.

```sh
npm install --global @tkstang/session-toolkit@0.1.0
seshtk --version
seshtk search -p 'deployment failed' --literal --since 7d
```

Copy a result's provider-qualified native ID to read it or export a new file.
Replace `SESSION_ID` with the selected session ID:

```sh
seshtk read --session 'codex:SESSION_ID' --max-records 100 --json
seshtk export --session 'codex:SESSION_ID' --out ./conversation.md
```

Add `--cwd /path/to/repo` to start a search in a repository. Search widens if the
hint finds no matches. `list --cwd /path/to/repo` browses historical candidates;
`self-identify` separately checks exact current-session evidence.

For application integration, install the same package locally and use the
[library](library.md).

## Choose a starting point

```mermaid
flowchart TB
  accTitle: Choose a Session Toolkit workflow
  accDescr: For the current session, self-identify must establish authoritative identity. For past sessions, list or search returns historical candidates to select. A provider-qualified native session ID can then be used with read for bounded conversation, export for a new Markdown file, or activity for sensitive JSON.
  Q{"Current or past session?"}
  C["self-identify<br/>Exact identity or refusal"]
  H["list / search<br/>Historical candidates"]
  S["Provider + native session ID"]
  R["read<br/>Bounded conversation"]
  E["export<br/>New Markdown file"]
  A["activity<br/>Sensitive JSON"]
  Q -->|Current| C
  Q -->|Past| H
  C -->|Authoritative only| S
  H -->|Select a candidate| S
  S --> R
  S --> E
  S --> A
```

_Mermaid updated 2026-10-30_

If exact current identity is unavailable, historical candidates remain useful,
but choosing one does not establish that it is the current session.

## Coverage and privacy

Every read has finite bounds; inspect coverage and continuation fields before
claiming a complete history. Provider formats can change, and inaccessible or
malformed sources report gaps. Exact cutoff/expansion evidence is Codex-only.
Cursor activity cannot supply individual tool results, per-call outcomes, or
usage absent from its transcript surface.

Raw records, evidence, and activity are sensitive. Markdown export removes hidden
instructions and control payloads, but visible conversation and tool text may
still contain credentials. Review exports before sharing. Output files are
created exclusively; existing files and symlinks are not overwritten.

Operations read local session stores without modifying them. Interactive CLI
operations may check npm for an update; JSON, CI, noninteractive invocations, and
library calls perform no update lookup. Set `SESHTK_NO_UPDATE_CHECK=1` to disable
interactive checks too. See [update notices](cli.md#update-notices).

## Contents

- [CLI Reference](cli.md) — Commands, machine output, errors, capabilities, and update configuration.
- [Historical Search](search.md) — Patterns, widening, scan authorization, diagnostics, and accelerators.
- [Transcripts and Export](transcripts.md) — Identity, discovery, source coordinates, bounds, evidence, and safe export.
- [Sensitive Activity](activity.md) — Full captured records, recorded tool activity, and provider gaps.
- [Library Reference](library.md) — Public ESM functions, types, explicit stores, and import behavior.
