---
id: DR-260707-shared-consensus-loop-runtime
title: Shared consensus loop runtime stays plugin-local
date: 2026-07-07
status: accepted
legacy_id: null
---

# Shared consensus loop runtime stays plugin-local

## Context

The shipped shared loop output lives at plugins/consensus/scripts/consensus-loop.mjs, beside the plugin skills/ directory, because provider install/local-load evidence preserves that plugin-root shape. Generated wrappers import it by relative path from each skill runtime.

## Decision

Use `plugins/consensus/scripts/consensus-loop.mjs` as the single shared
generated loop runtime for loop-using consensus wrappers. Generated wrappers
under `plugins/consensus/skills/{create,decide,evaluate,plan,refine}/scripts/`
import that runtime with `../../../scripts/consensus-loop.mjs`.

## Consequences

- Provider install and local-load paths must preserve `scripts/` beside
  `skills/` in the consensus plugin root.
- Generated-output mapping, import rewrites, lint/format generated-output
  mirrors, docs, and tests all point at the plugin-root loop output.
- Per-skill duplicated `consensus-loop.mjs` outputs are removed; future loop
  changes regenerate one shared output instead of five copies.
