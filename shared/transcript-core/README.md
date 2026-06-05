# shared/transcript-core

Canonical, skill-independent transcript primitives. **This is the single source of
truth** for per-runtime transcript knowledge (Claude Code, Codex, Cursor).

## Contract

- `runtimes.mjs` here is the canonical module. It is a leaf module — Node standard
  library only, no third-party dependencies, no banner.
- Each consuming skill ships a **synced, committed copy** under its own
  `scripts/lib/runtimes.mjs`. Those copies are **generated**: they carry a banner and
  must stay byte-identical to `<banner>\n<canonical contents>`.

## How to edit

1. Edit `shared/transcript-core/runtimes.mjs` (the canonical file) — never the
   vendored copies.
2. Run `npm run sync:transcript-core` to regenerate every consumer copy.
3. Commit the canonical change together with the regenerated copies.

A drift guard (`node scripts/sync-transcript-core.mjs --check`, wired into
`npm test`) fails if any vendored copy diverges from the canonical source.

## Consumers

- `skills/session-observer/scripts/lib/runtimes.mjs`
- `skills/export-session-transcript/scripts/lib/runtimes.mjs`
