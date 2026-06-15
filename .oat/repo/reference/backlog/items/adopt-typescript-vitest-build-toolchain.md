---
id: bl-853a
title: 'Stand up TypeScript + vitest build toolchain (bundle-to-mjs)'
status: done # open | in_progress | closed | wont_do
priority: medium # urgent | high | medium | low | none
scope: feature # idea | task | feature | initiative
scope_estimate: M # XS | S | M | L | XL | XXL
labels: [tooling, typescript, testing, build, dx]
assignee: null
created: '2026-06-14T15:02:51Z'
updated: '2026-06-15T21:00:00Z'
associated_issues: []
oat_template: true
oat_template_name: backlog-item
---

## Description

Stand up a TypeScript + **vitest** developer toolchain with a bundle-to-`.mjs`
build step, **without** migrating the existing codebase. This is the mechanical,
fast part: lay the rails so new code can be written in typed TS and tested with
vitest, and leave the existing `.mjs` running unchanged under `allowJs`. The
bulk conversion of existing code is tracked separately in [[bl-bfb4]] (Migrate
consensus + tests to real TypeScript types), which depends on this item; the two
may or may not be executed as a single project.

This is a developer-tooling change only — it does not alter what shipped skills
make users install. The earlier "no external testing library" posture was a
misreading of DR-002: the no-dependency contract applies to **shipped skills**
(what users install), not to dev tooling. The repo already takes dev
dependencies (`oxlint`, `oxfmt`, `commitlint`, `lint-staged`); vitest + a TS
toolchain are in bounds.

### Hard constraint: shipped artifacts stay plain `.mjs`

Per DR-002, shipped skills must remain dependency-free and install-free for users
(Paseo is the only external runtime boundary). TypeScript is **dev-only**; the
committed/shipped artifact stays plain `.mjs`. Build output is committed with a
`// GENERATED` banner and a drift guard, mirroring the existing
`shared/transcript-core` → `scripts/lib/runtimes.mjs` pattern. Provider runtimes
keep executing the committed `.mjs` directly via `Bash(node:*)`.

### Reference implementation

`~/code/stoa` already runs a TypeScript monorepo on **vitest** (`vitest ^4.1.5`,
`apps/server/scripts/run-vitest.mjs`), and its `provider-adapter.ts` /
`final-json-contract.ts` are a working multi-provider adapter layer. It is a
useful template for both the toolchain shape here and the peer-layer work
([[bl-bb7e]] / [[bl-3a88]]).

## Acceptance Criteria

- TypeScript toolchain in place: `tsconfig` with `allowJs`/`checkJs`, a bundler
  (esbuild/tsup), a documented `build` script, and CI that builds + type-checks
  on PRs.
- vitest runs the suite: `npm test` (or the pnpm equivalent) invokes vitest; the
  existing `node:test` suite either runs under vitest's compatibility or is kept
  green alongside until [[bl-bfb4]] migrates it (no net loss of coverage).
  `validate` and `smoke` still pass.
- **Shipped `.mjs` contract preserved:** committed build output carries a
  `// GENERATED` banner, a drift guard fails the suite when committed output
  diverges from its TS source, and output paths match what `SKILL.md` and the
  provider manifests reference (e.g. `./scripts/consensus-refine.mjs`). No new
  user-facing install step.
- Generated build output is excluded from `oxlint`/`oxfmt`/`lint-staged`, like
  `**/scripts/lib/runtimes.mjs` is today.
- One small **proof-point** module is authored or converted in real TypeScript to
  exercise the full source→build→test→ship path end to end (no broad migration).
- Repo conventions docs (CLAUDE.md / AGENTS.md, verification notes) describe the
  build step, the edit-source-not-output rule, and the vitest commands.
- A short DR is recorded for the durable build/output contract (canonical TS
  source + committed generated `.mjs` + drift guard as the shipped boundary).

## Delivery Notes

Delivered by the quick-mode OAT project
`ts-vitest-consensus-loop` on branch `feat/ts-vitest-consensus-loop`.

- Added pnpm-based TypeScript, Vitest, type-check, build, and build-check
  scripts as developer tooling only.
- Added `scripts/build-generated.mjs` with a generated-output drift guard and a
  committed generated `.mjs` contract.
- Converted `consensus-loop` as the proof-point module: canonical source now
  lives at `plugins/consensus/skills/refine/src/consensus-loop.ts` and builds
  to the existing provider-facing
  `plugins/consensus/skills/refine/scripts/consensus-loop.mjs` path.
- Wired CI and `worktree:validate` to install with a frozen lockfile, build,
  type-check, build-check, test, validate, smoke, and assert generated output
  remains clean.

The broader TypeScript migration remains open under [[bl-bfb4]].
