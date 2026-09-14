# shared/transcript-core

Compatibility documentation for the former shared transcript-core source path.
The canonical source moved to `src/shared/transcript/runtimes.ts`.

## Contract

- `src/shared/transcript/runtimes.ts` is the single source of truth for
  per-runtime transcript knowledge (Claude Code, Codex, Cursor).
- Each consuming skill ships a committed generated copy under its own
  `scripts/lib/runtimes.mjs`. Those copies carry a `// GENERATED` banner and
  must not be hand-edited.
- `pnpm run sync:transcript-core` remains as a compatibility wrapper around
  `scripts/build-generated.ts`.

## How to edit

1. Edit `src/shared/transcript/runtimes.ts` — never the generated copies.
2. Run `pnpm run build` to regenerate every generated runtime output.
3. Run `pnpm run build:check` to verify drift checks.
4. Commit the canonical change together with the regenerated copies.

A drift guard (`pnpm tsx scripts/build-generated.ts --check`, wired into
`pnpm test` through `tests/tooling/generated-output-sync.test.ts`) fails if any
generated copy diverges from canonical source.

## Consumers

- `skills/session-observer/scripts/lib/runtimes.mjs`
- `plugins/consensus/skills/observer/scripts/lib/runtimes.mjs`
- `plugins/session/skills/export-transcript/scripts/lib/runtimes.mjs`
- `skills/session-export-transcript/scripts/lib/runtimes.mjs`
