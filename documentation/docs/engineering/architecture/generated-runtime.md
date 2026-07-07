---
title: 'Generated runtime outputs'
description: 'The build contract for generated runtime .mjs: edit canonical TypeScript under src/, run pnpm run build, verify with build:check, and never hand-edit a // GENERATED-bannered output.'
---

# Generated runtime outputs

Some shipped runtime `.mjs` files are generated from canonical TypeScript source
under `src/`, while staying committed at the same paths that provider manifests,
docs, and users already execute under `plugins/` and `skills/`. Edit the
canonical TypeScript source, not generated `.mjs` output with a `// GENERATED`
banner.

## The build contract

- `pnpm run build` runs `node scripts/build-generated.mjs` and writes the
  generated runtime output.
- `pnpm run build:check` runs `node scripts/build-generated.mjs --check` without
  mutating tracked files.
- `tests/tooling/generated-output-sync.test.ts` runs the drift guard as part of
  `pnpm test`, so editing a canonical module without rebuilding breaks the suite.
- `pnpm run sync:transcript-core` is a compatibility wrapper around the same
  generated-output build.

TypeScript, Vitest, and bundling are developer tooling only; shipped skills still
run committed `.mjs` with no install step.

## Canonical source → generated output

| Canonical TypeScript source                                  | Generated output                                                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `src/consensus/core/consensus-loop.ts`                       | `plugins/consensus/scripts/consensus-loop.mjs`                                                                     |
| `src/consensus/refine/consensus-refine.ts`                   | `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`                                                     |
| `src/consensus/evaluate/consensus-evaluate.ts`               | `plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs`                                                 |
| `src/consensus/create/consensus-create.ts`                   | `plugins/consensus/skills/create/scripts/consensus-create.mjs`                                                     |
| `src/consensus/decide/consensus-decide.ts`                   | `plugins/consensus/skills/decide/scripts/consensus-decide.mjs`                                                     |
| `src/consensus/plan/consensus-plan.ts`                       | `plugins/consensus/skills/plan/scripts/consensus-plan.mjs`                                                         |
| `src/transcript/core/runtimes.ts`                            | `skills/session-observer/scripts/lib/runtimes.mjs` and `skills/export-session-transcript/scripts/lib/runtimes.mjs` |
| `src/transcript/session-observer/`                           | the generated session-observer CLI, probe, and library files under `skills/session-observer/scripts/`              |
| `src/transcript/export-session/sanitize.ts`                  | `skills/export-session-transcript/scripts/lib/sanitize.mjs`                                                        |
| `src/transcript/export-session/export-session-transcript.ts` | `skills/export-session-transcript/scripts/export-session-transcript.mjs`                                           |

## Consensus plugin-local runtime layout

Consensus wrapper outputs live under
`plugins/consensus/skills/<name>/scripts/`, but the shared loop output now lives
once at `plugins/consensus/scripts/consensus-loop.mjs`. Generated wrappers import
that plugin-local runtime with `../../../scripts/consensus-loop.mjs`, so a
provider install or local-load runtime must preserve the plugin root with
`scripts/` beside `skills/`.

The Phase 1 provider-layout spike verified that Claude Code and Codex installed
caches, Cursor Agent `--plugin-dir`, and an isolated Copilot CLI local install
preserve that plugin-root shape. Those checks prove the local/package layout used
by the generated imports; they are not broader marketplace or skills.sh
availability claims. Standalone single-skill copies are not the primary runtime
contract. They remain supported only through the existing recovery path that
looks for `~/.consensus/consensus.mjs`.

## Import rewriting

Wrappers type-check against canonical TypeScript imports such as
`../core/consensus-loop.js`, `../core/runtimes.js`, and `./sanitize.js`. The build
rewrites declared module specifiers to shipped local `.mjs` imports and fails if
an expected source specifier is absent.

For Consensus wrappers, the `../core/consensus-loop.js` import rewrites to the
shared plugin-local output at `../../../scripts/consensus-loop.mjs`. Keep that
relative path in sync with `scripts/build-generated.mjs` and
`tests/tooling/generated-output-sync.test.ts`.

## Never hand-edit generated output

Files carrying a `// GENERATED` banner are produced by the build and must never
be hand-edited. Change the canonical TypeScript source under `src/` and run
`pnpm run build`; `pnpm run build:check` and the generated-output-sync test will
flag any committed output that has drifted from its source.
