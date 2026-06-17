---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-17
oat_generated: true
oat_summary_last_task: p03-t02
oat_summary_revision_count: 0
oat_summary_includes_revisions: []
---

# Summary: transcript-ts-refactor

## Overview

This quick-mode project completed the transcript tooling slice of the repository's
TypeScript, Vitest, and generated-runtime migration. The goal was to move
transcript-core and export-session-transcript to canonical TypeScript source under
`src/transcript/` while keeping the shipped, dependency-free `.mjs` runtime files
committed at their existing `skills/` paths.

## What Was Implemented

Transcript-core now has canonical TypeScript source at
`src/transcript/core/runtimes.ts`. The committed generated copies remain at
`skills/session-observer/scripts/lib/runtimes.mjs` and
`skills/export-session-transcript/scripts/lib/runtimes.mjs`.
`scripts/build-generated.mjs` owns those mappings, and
`scripts/sync-transcript-core.mjs` is now a compatibility wrapper around the same
build path.

Export-session-transcript now has canonical TypeScript source at
`src/transcript/export-session/export-session-transcript.ts` and
`src/transcript/export-session/sanitize.ts`. The shipped CLI and sanitizer remain
at `skills/export-session-transcript/scripts/export-session-transcript.mjs` and
`skills/export-session-transcript/scripts/lib/sanitize.mjs`. The generated export
CLI rewrites canonical source imports to local shipped runtime imports:
`./lib/runtimes.mjs` and `./lib/sanitize.mjs`.

The in-scope transcript-core, export sanitizer, and export CLI tests moved to
Vitest TypeScript coverage. Generated-output drift coverage now includes
transcript-core, sanitizer, and export CLI mappings, including import-path
assertions and stale-output detection.

Documentation and reference artifacts now describe the current contract:
canonical TypeScript source under `src/`, committed generated `.mjs` output under
`skills/`, `build-generated` as the source of truth for generation, and
`sync:transcript-core` as compatibility only. DR-014 remains as historical context
and is marked superseded by the generated-runtime contract.

## Key Decisions

- Keep standalone skills install-free by committing generated `.mjs` output at the
  existing runtime paths.
- Keep transcript-core shared by source generation, not by runtime cross-skill
  imports.
- Preserve `pnpm run sync:transcript-core` for operator muscle memory while routing
  it through `scripts/build-generated.mjs`.
- Keep the export CLI behavior tests pointed at the shipped generated entrypoint
  so the TypeScript migration proves runtime compatibility.

## Verification

- `pnpm run build` passed and wrote all generated outputs.
- `pnpm run type-check` passed.
- `pnpm run build:check` passed with all generated outputs in sync.
- `pnpm run test` passed: 202 Node tests and 339 Vitest tests.
- `pnpm run validate` passed.
- `pnpm run smoke` passed.

## Follow-up Items

- `bl-bfb4` remains in progress for the broader TypeScript/Vitest migration. The
  remaining work includes non-migrated `node:test` suites, any selected long-tail
  runtime/test modules, and eventual retirement of the Node compatibility path.
- `consensus-evaluate` remains the next feature lane after this TypeScript/Vitest
  substrate work.
