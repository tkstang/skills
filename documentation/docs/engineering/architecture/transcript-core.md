---
title: 'Shared transcript-core'
description: 'How per-provider transcript knowledge has a single source of truth at src/transcript/core/runtimes.ts, with a committed generated copy shipped per consuming skill.'
---

# Shared transcript-core

Per-provider store locations, record parsing, and structural filtering for
Claude Code, Codex, and Cursor start in
`src/transcript/core/runtimes.ts`. Cursor's reliability contract adds two
canonical modules beside it:

- `src/transcript/core/cursor-frames.ts` streams physical JSONL frames,
  preserving closed, blank, malformed, partial, repaired, and replaced
  boundaries plus file identity and prefix-verification evidence.
- `src/transcript/core/cursor-analysis.ts` assembles turns and separates
  prefix-stable content availability from terminal lifecycle outcomes.

Rather than cross-skill runtime imports, each consumer ships committed
generated copies under its own `scripts/lib/`. `pnpm run build` materializes
those copies, so each skill remains dependency-free and install-free while
tracing back to canonical TypeScript.

## Consumers

Current consumers of the shared transcript-core:

- `session-observer` — ships `runtimes.mjs`, `cursor-frames.mjs`, and
  `cursor-analysis.mjs`, plus its generated digest, locate, observe, state, and
  watch pipeline.
- `export-session-transcript` — ships
  `runtimes.mjs`, `cursor-frames.mjs`, and `cursor-analysis.mjs`.

The lower-level Cursor normalizer remains terminal-only for Export Session
Transcript compatibility. Session Observer explicitly requests the
content-first `observation` projection. Session Observer Collaboration
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

## Editing the source

Edit the applicable canonical module under `src/transcript/core/` or
`src/transcript/session-observer/`, then run `pnpm run build` to update every
declared committed output.

The drift guard makes skipping the rebuild a hard error: `pnpm run build:check`
regenerates expected output in check mode and fails on any divergence, and the
same guard runs in `pnpm test` through `tests/tooling/generated-output-sync.test.ts`.
Editing the canonical module without rebuilding the generated output breaks the
suite.

## Compatibility wrapper

`pnpm run sync:transcript-core` remains as a compatibility command for existing
habits and automation. It delegates to `scripts/build-generated.mjs`, and
`node scripts/sync-transcript-core.mjs --check` delegates to
`scripts/build-generated.mjs --check`.
