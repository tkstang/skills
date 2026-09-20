---
title: 'Shared transcript-core'
description: 'How per-provider transcript knowledge has one shared source under src/shared/transcript, with a complete generated copy shipped per installation unit.'
---

# Shared transcript-core

Per-provider store locations, record parsing, and structural filtering for
Claude Code, Codex, and Cursor start in
`src/shared/transcript/runtimes.ts`. Cursor's reliability contract adds two
canonical modules beside it:

- `src/shared/transcript/cursor-frames.ts` streams physical JSONL frames,
  preserving closed, blank, malformed, partial, repaired, and replaced
  boundaries plus file identity and prefix-verification evidence.
- `src/shared/transcript/cursor-analysis.ts` assembles turns and separates
  prefix-stable content availability from terminal lifecycle outcomes.

The additive activity layer lives under `src/shared/transcript/activity/`. It
extracts provider evidence, correlates only on recorded identity, and projects a
bounded `activitySchemaVersion: 1` report. Its source model keeps physical-line
or frame/block locators, native ownership, outcome evidence, unread coverage,
and diagnostics separate from presentation.

Rather than cross-skill runtime imports, each consumer ships committed
generated copies under its own `scripts/lib/`. `pnpm run build` materializes
those copies, so each skill remains dependency-free and install-free while
tracing back to canonical TypeScript.

## Consumers

Current consumers of the shared transcript-core:

- `session-observer` — ships `runtimes.mjs`, `cursor-frames.mjs`, and
  `cursor-analysis.mjs`, plus its generated digest, locate, observe, state, and
  watch pipeline.
- `session-export-transcript` — ships
  `runtimes.mjs`, `cursor-frames.mjs`, and `cursor-analysis.mjs`.
- `session-fork-to-destination` — ships a single generated alpha guidance
  bundle that reuses bounded transcript discovery and sanitized preview logic.
  Its public commands are limited to `discover`, `preview`, and `prepare`; it
  does not import or expose the older executor, reconciliation, or behavior
  gate.

The lower-level Cursor normalizer remains terminal-only for Export Session
Transcript compatibility. Session Observer explicitly requests the
content-first `observation` projection. Collaborative Observer
explicitly requests `confirmed-completion` from the observer-generated modules;
its control, hook, completion, and lease files remain authored JavaScript.

## Schema and position semantics

The public digest is a discriminated union:

- Schema v1 keeps existing non-Cursor behavior and
  `zero-based-jsonl-record-index` accounting.
- Cursor schema v2 uses `zero-based-jsonl-frame-index`. `fromIndex` is
  inclusive, `nextIndex` is the first unconsumed safe frame, and `toIndex` is
  `nextIndex - 1` or `null`. An entry's `recordIndex` is its delivery frame;
  `sourceFrameIndex` retains the original content frame.

Consumers dispatch on both fields. They never infer an index base from the
runtime name or convert a persisted record position into a frame position.
Cursor observation may expose stable content with lifecycle pending, while the
completion projection remains terminal-success-only.

## Activity projection and delivery

Observer and exporter consumers opt in explicitly. With activity disabled they
keep their established conversation-only paths. With it enabled, each consumer
takes one source snapshot or Cursor scan and derives conversation and activity
from the same capture.

The projection modes have fixed independent envelopes:

| Projection mode     | Rendered bytes | Invocations | Value preview | Late-call context |
| ------------------- | -------------- | ----------- | ------------- | ----------------- |
| `watch`, `catch-up` | 32 KiB         | 80          | 2 KiB         | 256 bytes         |
| `review`            | 128 KiB        | 1,024       | 2 KiB         | 256 bytes         |
| `export`            | 64 MiB         | unlimited   | 2 KiB         | 256 bytes         |

Reports preserve counts at captured-source, delivered-range, and displayed
scope. Whole evidence groups are removed when invocation or rendered-byte
limits apply, with global omission counts retained. If a delivered result joins
to a call outside the half-open delivery range, `callContexts` can carry a
separately bounded `outside-delivered-range` preview.

Claude Code and Codex stateful delivery uses decoded record positions. Cursor
uses physical frame positions and holds open-turn calls until the terminal
checkpoint settles. Settlement may create an activity-only watch delta without
replaying conversation. Stateless Cursor review and export can include both
settled and snapshot-visible `pending-lifecycle` calls for retrospective review.

The activity layer does not open persisted-output files, Cursor `agent-tools/`,
or child transcripts. It represents known references as `not-read` coverage;
Cursor results remain `not-recorded`. An extraction exception becomes explicit
`record-activity: not-read` coverage and an `ACTIVITY_EXTRACTION_ERROR`
diagnostic. These distinctions prevent missing or unread evidence from becoming
a false no-activity claim.

Activity output is labelled sensitive because bounded previews can still carry
commands, paths, identifiers, inputs, and results. The exporter's conversation
sanitizer does not sanitize this opt-in debug appendix.

Session Fork to Destination keeps provider capability evidence separate from
transcript qualification. It preserves provider and surface in qualified
candidate IDs, applies bounded discovery options to Claude Code, Codex, and
Cursor, and fails closed when a Cursor transcript cannot be corroborated as CLI
or IDE. Guidance preparation validates canonical Git paths and emits commands;
it never invokes a provider or mutates a provider store.

## Editing the source

Edit shared parsing under `src/shared/transcript/` or the owning skill under
`src/skills/<name>/src/`, then run `pnpm run build` to update every declared
committed output.

The drift guard makes skipping the rebuild a hard error: `pnpm run build:check`
regenerates expected output in check mode and fails on any divergence, and the
same guard runs in `pnpm test` through `tests/tooling/generated-output-sync.test.ts`.
Editing the canonical module without rebuilding the generated output breaks the
suite.
