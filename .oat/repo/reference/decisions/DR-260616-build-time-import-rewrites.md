---
id: DR-260616-build-time-import-rewrites
title: Build-time import rewrites reconcile canonical source paths with shipped
  runtime paths
date: 2026-06-16
status: Accepted.
legacy_id: DR-021
---

### DR-021: Build-time import rewrites reconcile canonical source paths with shipped runtime paths

- **Date:** 2026-06-16
**Context:** Canonical TypeScript entrypoints need to type-check against source modules under `src/`, but shipped runtimes must continue importing local committed `.mjs` files from distribution paths.
**Decision:** Extend DR-020's generated-output build with optional per-mapping `importRewrites`. `src/consensus/refine/consensus-refine.ts` imports the loop through the NodeNext-resolvable canonical specifier `'../core/consensus-loop.js'`; `scripts/build-generated.mjs` rewrites that emitted module specifier to `'./consensus-loop.mjs'` when producing `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`. `src/transcript/export-session/export-session-transcript.ts` imports transcript runtime and sanitizer source through `'../core/runtimes.js'` and `'./sanitize.js'`; the build rewrites those emitted specifiers to `./lib/runtimes.mjs` and `./lib/sanitize.mjs` for the shipped export CLI. Rewrites are constrained to parsed module specifier string literals (static imports, export-from declarations, and dynamic imports), so unrelated quoted strings are left untouched. A declared rewrite fails loudly if the `from` specifier is absent from module specifiers.
**Rationale:** This keeps TypeScript checking wired to real canonical source APIs while preserving the existing dependency-free shipped runtime layout. The transform is intentionally narrow, explicit in build config, compatible with esbuild `bundle:false`, and covered by drift, generated-import, and non-import-literal regression tests so a path regression cannot silently ship.
- **Status:** Accepted.
