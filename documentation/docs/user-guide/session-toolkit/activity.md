---
title: 'Sensitive Activity'
description: 'Capture full recorded session activity with explicit sensitivity, provenance, bounds, and provider gaps.'
---

# Sensitive Activity

Replace `SESSION_ID` with a selected native session ID. This operation returns
sensitive JSON; use [Markdown export](transcripts.md#export-safety) when you need
a conversational document to review for sharing.

```sh
seshtk activity --session 'codex:SESSION_ID' --json
seshtk activity --session 'claude-code:SESSION_ID' --out ./activity.json --json
```

## What the capture contains

Library: `captureActivity({ session: 'codex:SESSION_ID' })`. The response is
sensitive structured evidence, **not sanitized or shareable Markdown**. It
retains full raw captured records (including instruction carriers), raw tool
arguments/results, correlations, usage when recorded, provenance and source
coordinates.
The activity events select supported tool/item/metadata facts;
the raw records preserve other provider detail. No preview caps apply.

`--out` creates a new file with owner-only permissions (`0600`) and refuses
to overwrite an existing destination.

## Provider coverage

All three providers support captured activity. Cursor uses frame extraction:
recorded calls and turn lifecycle are available; individual call results,
per-call outcomes and usage are not recorded on this surface. `support` and
coverage state these gaps explicitly. Raw Cursor records remain available.

Claude/Codex correlate recorded calls/results and retain usage semantics without
inventing missing data. External persisted outputs and child trajectories are
reported as not read; payload paths are never followed.

## Bounds and continuation

Read bounds and generation-bound continuations work as for `read`; default source
budget is 4,000,000 bytes. `sourceRead.coverage.fullSource` requires coverage from
byte zero to the captured end with no diagnostics. A bounded page or continuation
can omit earlier correlation context; its raw source coordinates remain intact.

`sourceRead.records` exposes source ordinals, decoded ordinals, physical lines,
byte ranges and Cursor frame indices independently. Cursor event locators retain
source and terminal delivery frame coordinates. `--out` creates a new JSON file
exclusively and refuses existing destinations; without it the capture is returned
in the CLI response. Consumers own offsets and watch/selection state.
