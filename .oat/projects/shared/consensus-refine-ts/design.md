---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-16
oat_generated: false
oat_template: false
---

# Design: consensus-refine-ts

## Overview

This project migrates the consensus refine **wrapper** and the consensus **test
suite** onto the TypeScript + Vitest + generated-runtime substrate that DR-020 and
the `ts-vitest-consensus-loop` project established for `consensus-loop`. The
wrapper's canonical source moves to `src/consensus/refine/consensus-refine.ts`; the
build regenerates the same committed, dependency-free shipped runtime at
`plugins/consensus/skills/refine/scripts/consensus-refine.mjs`. The consensus
`node:test` `.mjs` files are ported to Vitest `.test.ts`, preserving every
assertion. Non-consensus suites and `test:node` stay as-is.

The single non-trivial architectural decision is **import reconciliation**: the
canonical wrapper source must type-check against the real consensus-loop API, but
the shipped wrapper must import its sibling `./consensus-loop.mjs` at runtime. The
design resolves this with a **build-time import-specifier rewrite** declared per
mapping in `scripts/build-generated.mjs`: the TypeScript source imports the loop
via the NodeNext-resolvable specifier `'../core/consensus-loop.js'` (TypeScript
resolves this to `src/consensus/core/consensus-loop.ts` for full type-checking),
and the build rewrites that exact specifier to `'./consensus-loop.mjs'` in the
emitted output. This is safe because esbuild with `bundle: false` preserves import
statements verbatim (only stripping types), and it is verified by a dedicated test
asserting the generated import is correct plus the existing drift guard.

The migration is sequenced to keep the suite green at every step: the wrapper
source/build/import mechanism lands first (behavior unchanged, drift-checked), then
the consensus tests are ported file-by-file off `node:test` and onto Vitest, then
docs/reference artifacts are updated for the completed scope.

## Architecture

### System Context

This extends the established two-tree contract (DR-020):

- **Canonical developer source** lives under `src/consensus/`. After this project:
  `src/consensus/core/consensus-loop.ts` (existing) and
  `src/consensus/refine/consensus-refine.ts` (new).
- **Distribution / install surface** lives under `plugins/consensus/`. The shipped
  runtime entry points remain committed generated `.mjs` files with a `// GENERATED`
  banner: `consensus-loop.mjs` (existing) and `consensus-refine.mjs` (regenerated
  from the new TS source). No canonical `.ts` ever appears under
  `plugins/consensus/skills`.

**Key Components:**

- **`scripts/build-generated.mjs`:** Source → committed-runtime build tool. Gains a
  second `generatedOutputs` mapping for the wrapper plus a per-mapping
  `importRewrites` capability and applies the rewrites to emitted output in both
  write and `--check` modes.
- **`src/consensus/refine/consensus-refine.ts`:** Canonical wrapper source, ported
  from the current `.mjs`, importing the loop via `'../core/consensus-loop.js'`.
- **Generated `plugins/.../consensus-refine.mjs`:** Shipped runtime, byte-identical
  to today except the loop import is rewritten to `'./consensus-loop.mjs'` and the
  generated banner is prepended. Same exports, same behavior, same path.
- **Consensus Vitest suite:** ~20 ported `.test.ts` files plus shared test fixtures
  and the `tests/helpers/process` helper (kept runnable by both runners).
- **Drift + layout guards:** `tests/generated-output-sync.test.mjs` (extended to
  both outputs) and `tests/repo-layout.test.mjs` (extended to require
  `src/consensus/refine`).

### Component Diagram

```
src/consensus/core/consensus-loop.ts ──┐  (type-only resolution of
                                        │   '../core/consensus-loop.js')
src/consensus/refine/consensus-refine.ts┘
            │
            │  scripts/build-generated.mjs
            │   • esbuild bundle:false (strip types, preserve specifiers)
            │   • importRewrites: '../core/consensus-loop.js' → './consensus-loop.mjs'
            │   • prepend // GENERATED banner
            ▼
plugins/consensus/skills/refine/scripts/
    consensus-loop.mjs      (sibling, existing)
    consensus-refine.mjs    (regenerated; imports './consensus-loop.mjs')

Guards: build:check / generated-output-sync (both outputs)
        repo-layout (no .ts under plugins/consensus/skills; src/consensus/refine exists)
        generated-import test (asserts './consensus-loop.mjs', not '../core/')
```

### Data Flow

```
1. Developer edits src/consensus/refine/consensus-refine.ts
2. tsc --noEmit type-checks it against the real loop types
   (NodeNext resolves '../core/consensus-loop.js' → src/consensus/core/consensus-loop.ts)
3. pnpm run build → esbuild transpiles, importRewrites rewrites the loop specifier,
   banner prepended, committed .mjs written
4. pnpm run build:check / generated-output-sync re-run the build in memory and
   diff against the committed .mjs (fails on drift)
5. Shipped wrapper runs unchanged: node consensus-refine.mjs imports ./consensus-loop.mjs
```

## Component Design

### `scripts/build-generated.mjs` — import-rewrite mechanism

**Purpose:** Generate committed runtime `.mjs` from canonical TS, reconciling
type-time import paths with runtime import paths.

**Responsibilities:**

- Add the wrapper mapping to `generatedOutputs`.
- Support an optional per-mapping `importRewrites` list and apply it to emitted
  output, in both `writeGenerated` and `checkGenerated` paths (so `--check` compares
  against the rewritten text, not the raw esbuild output).
- Fail loudly if a declared rewrite's `from` specifier is not present in the emitted
  output (prevents a silent no-op rewrite from masking a regression).

**Interfaces:**

```typescript
// Shape added to each mapping (JS object literal in the .mjs tool)
type ImportRewrite = { from: string; to: string };
type GeneratedOutput = {
  id: string;
  source: string;          // e.g. 'src/consensus/refine/consensus-refine.ts'
  output: string;          // e.g. 'plugins/.../consensus-refine.mjs'
  importRewrites?: ImportRewrite[]; // e.g. [{ from: '../core/consensus-loop.js',
                                    //         to: './consensus-loop.mjs' }]
};
```

**Dependencies:** esbuild (dev-only), Node stdlib. No change to the shipped runtime
dependency posture.

### `src/consensus/refine/consensus-refine.ts`

**Purpose:** Canonical wrapper source.

**Responsibilities:** Preserve all current wrapper exports and behavior verbatim
(the long export list: `parseWrapperArgs`, `runSequential`, `prepareParallelRun`,
`fanInParallelRun`, `runWrapperCli`, `renderDeliberationArtifact`, etc.). Only the
loop import specifier changes (`./consensus-loop.mjs` → `'../core/consensus-loop.js'`),
plus whatever minimal, behavior-preserving type annotations are needed to pass
`tsc` under the existing strict config. The bar is "genuine types where they prevent
bugs and `tsc` passes", not a ground-up retype; value behavior must not change.

**Interfaces:** Identical public surface to today's `consensus-refine.mjs`.

**Dependencies:** `src/consensus/core/consensus-loop.ts` (type-time), Node stdlib.

### Consensus Vitest suite

**Purpose:** Run consensus runtime tests on Vitest/TypeScript with no coverage loss.

**Responsibilities:**

- Port the in-scope consensus `node:test` `.mjs` files to Vitest `.test.ts`,
  translating `node:test` (`test`, `t.test`, `assert`) to Vitest (`describe`/`it`,
  `expect`) while preserving each assertion 1:1.
- In-scope files (import the wrapper/loop and exercise consensus behavior):
  `consensus-loop-cli`, `loop-convergence`, `loop-records`, `parallel-errors`,
  `parallel-fan-in`, `parallel-integration`, `parallel-modes`, `parallel-prepare`,
  `wrapper-options`, `verdict-validation`, `path-safety`, `resume-corruption`,
  `resume-parse`, `section-parser`, `paseo-invocation`, `escalation`,
  `event-payload-inventory`, `user-intervention`, `sequential-wrapper`,
  `error-handling` (consensus error rendering/exit codes — included as consensus
  behavior despite not matching a listed prefix).
- Tests import the shipped runtime at its stable path
  (`plugins/.../consensus-refine.mjs` / `consensus-loop.mjs`), unchanged — they
  validate the generated artifact, which is the right contract to assert.

**Dependencies:** `tests/helpers/process` and `tests/fixtures/*`.

### `tests/helpers/process` (shared test helper)

**Purpose:** Shared child-process / JSONL helpers used by both a migrated Vitest
test (`parallel-integration`) and an out-of-scope `node:test` file
(`smoke-test-script`).

**Decision:** Keep `tests/helpers/process.mjs` as the runtime module (so the
remaining `node:test` importer is untouched) and add a sibling ambient declaration
`tests/helpers/process.d.mts` so the `.ts` importer type-checks under
`allowJs: false` without an implicit-any error. No runtime/behavior change.

## Testing Strategy

**Levels & scenarios:**

1. **Generated-import correctness (new):** A Vitest test asserting the committed
   `consensus-refine.mjs` imports `'./consensus-loop.mjs'` and contains no
   `'../core/'` specifier. This is the explicit proof the brief requires.
2. **Drift guard (extended):** `tests/generated-output-sync.test.mjs` extended so
   `build-generated.mjs --check` reports both `consensus-loop: in sync` and
   `consensus-refine: in sync`, and so the test asserts the wrapper source→output
   mapping is declared.
3. **Layout invariant (extended):** `tests/repo-layout.test.mjs` extended to require
   `src/consensus/refine` and to keep asserting no `.ts` under
   `plugins/consensus/skills`.
4. **Type-check:** `pnpm run type-check` (`tsc --noEmit`) covers the new wrapper
   source and the migrated `.test.ts` files (tsconfig already includes
   `tests/**/*.ts`), proving the source types against the loop API.
5. **Behavior parity (ported suite):** Each migrated file keeps its existing
   assertions; the suite runs under `pnpm run test:vitest`. Parity is checked by
   running the suite green and by diffing assertion coverage before/after the port.
6. **Full gates:** `pnpm run build`, `build:check`, `type-check`, `test:vitest`,
   `validate`, `smoke`, and full `pnpm test` (node + vitest). Known non-consensus
   session-observer timing flakes are isolated and reported, not addressed here.

**Migration safety:** Port file-by-file. A file leaves the `node:test` runner the
moment it is renamed `*.test.mjs` → `*.test.ts` (the `test:node` glob only matches
`*.test.mjs`; the Vitest `include` already matches `*.test.ts`), so there is no
double-run and no window where a file runs under neither runner within a commit.

## Error Handling

- **Silent rewrite no-op:** If a declared `importRewrites.from` specifier is absent
  from emitted output (e.g. the source import was changed), the build throws rather
  than writing an unrewritten/misleading artifact.
- **Drift:** Any divergence between regenerated and committed `.mjs` fails
  `build:check` / the drift test with a first-byte-difference offset (existing
  behavior, now covering both outputs).
