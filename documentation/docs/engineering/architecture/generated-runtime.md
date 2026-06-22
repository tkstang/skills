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

| Canonical TypeScript source                                  | Generated output                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/consensus/core/consensus-loop.ts`                       | `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`, `plugins/consensus/skills/evaluate/scripts/consensus-loop.mjs`, `plugins/consensus/skills/create/scripts/consensus-loop.mjs`, `plugins/consensus/skills/decide/scripts/consensus-loop.mjs`, and `plugins/consensus/skills/plan/scripts/consensus-loop.mjs` |
| `src/consensus/refine/consensus-refine.ts`                   | `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`                                                                                                                                                                                                                                                           |
| `src/consensus/evaluate/consensus-evaluate.ts`               | `plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs`                                                                                                                                                                                                                                                       |
| `src/consensus/create/consensus-create.ts`                   | `plugins/consensus/skills/create/scripts/consensus-create.mjs`                                                                                                                                                                                                                                                           |
| `src/consensus/decide/consensus-decide.ts`                   | `plugins/consensus/skills/decide/scripts/consensus-decide.mjs`                                                                                                                                                                                                                                                           |
| `src/consensus/plan/consensus-plan.ts`                       | `plugins/consensus/skills/plan/scripts/consensus-plan.mjs`                                                                                                                                                                                                                                                               |
| `src/transcript/core/runtimes.ts`                            | `skills/session-observer/scripts/lib/runtimes.mjs` and `skills/export-session-transcript/scripts/lib/runtimes.mjs`                                                                                                                                                                                                       |
| `src/transcript/session-observer/`                           | the generated session-observer CLI, probe, and library files under `skills/session-observer/scripts/`                                                                                                                                                                                                                    |
| `src/transcript/export-session/sanitize.ts`                  | `skills/export-session-transcript/scripts/lib/sanitize.mjs`                                                                                                                                                                                                                                                              |
| `src/transcript/export-session/export-session-transcript.ts` | `skills/export-session-transcript/scripts/export-session-transcript.mjs`                                                                                                                                                                                                                                                 |

## Import rewriting

Wrappers type-check against canonical TypeScript imports such as
`../core/consensus-loop.js`, `../core/runtimes.js`, and `./sanitize.js`. The build
rewrites declared module specifiers to shipped local `.mjs` imports and fails if
an expected source specifier is absent.

## Never hand-edit generated output

Files carrying a `// GENERATED` banner are produced by the build and must never
be hand-edited. Change the canonical TypeScript source under `src/` and run
`pnpm run build`; `pnpm run build:check` and the generated-output-sync test will
flag any committed output that has drifted from its source.
