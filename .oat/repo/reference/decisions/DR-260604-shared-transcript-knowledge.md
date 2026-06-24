---
id: DR-260604-shared-transcript-knowledge
title: Shared transcript knowledge lives in `shared/transcript-core/` with
  build-time sync and a drift guard; share the minimum
date: 2026-06-04
status: Superseded in implementation by DR-020/DR-021 on 2026-06-17. The durable
  decision is still "share only per-provider transcript knowledge and ship
  self-contained generated copies"; the canonical source moved to
  `src/transcript/core/runtimes.ts`, and `sync:transcript-core` is now a
  compatibility wrapper around `scripts/build-generated.mjs`.
legacy_id: DR-014
---

### DR-014: Shared transcript knowledge lives in `shared/transcript-core/` with build-time sync and a drift guard; share the minimum

- **Date:** 2026-06-04
**Context:** `export-session-transcript` needed the same per-provider store/parsing knowledge as session-observer. Options: vendor per-skill copies (drift), runtime cross-skill dependency (coupling, install-order), or canonical module + sync.
**Decision:** `shared/transcript-core/runtimes.mjs` is the single source of truth. `npm run sync:transcript-core` materializes banner-stamped (`// GENERATED`) committed copies into each consuming skill's `scripts/lib/`; a `--check` drift-guard test in `npm test` fails if any copy diverges. Only `runtimes.mjs` is shared — observe-specific modules (locate/rank/digest/state) stay in session-observer. Installed skills remain fully self-contained.
**Rationale:** Format knowledge is the drift-prone part and changes per provider release; one edit point plus a CI guard beats N hand-synced copies. Sharing more would entangle session-observer's ranking/offset logic in a contract export doesn't need.
- **Status:** Superseded in implementation by DR-020/DR-021 on 2026-06-17. The durable decision is still "share only per-provider transcript knowledge and ship self-contained generated copies"; the canonical source moved to `src/transcript/core/runtimes.ts`, and `sync:transcript-core` is now a compatibility wrapper around `scripts/build-generated.mjs`.
