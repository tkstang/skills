---
title: 'Shared transcript-core'
description: 'How per-provider transcript knowledge has a single source of truth at src/transcript/core/runtimes.ts, with a committed generated copy shipped per consuming skill.'
---

# Shared transcript-core

Per-provider transcript knowledge — store locations, record parsing, and
structural filtering for Claude Code, Codex, and Cursor — has a single source of
truth at `src/transcript/core/runtimes.ts`.

Rather than cross-skill imports, each consuming skill ships a committed generated
copy under its own `scripts/lib/runtimes.mjs`. Those copies are materialized by
`pnpm run build`, so a skill stays self-contained and runs with no install step
while still tracing back to one canonical module.

## Consumers

Current consumers of the shared transcript-core:

- `session-observer` — ships `skills/session-observer/scripts/lib/runtimes.mjs`.
- `export-session-transcript` — ships
  `skills/export-session-transcript/scripts/lib/runtimes.mjs`.

## Editing the source

Edit `src/transcript/core/runtimes.ts`, then run `pnpm run build` to update every
consumer's committed copy.

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
