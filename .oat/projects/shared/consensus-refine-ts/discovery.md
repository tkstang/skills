---
oat_status: complete
oat_ready_for: oat-project-quick-start
oat_blockers: []
oat_last_updated: 2026-06-16
oat_generated: false
---

# Discovery: consensus-refine-ts

## Phase Guardrails (Discovery)

Discovery is for requirements and decisions, not implementation details. This
project is the next slice of `bl-bfb4`; the toolchain and the loop slice already
shipped (`bl-853a`, DR-020, project `ts-vitest-consensus-loop`), so the scope and
contract here are unusually well-defined.

## Initial Request

Create the next slice of `bl-bfb4`: migrate the remaining consensus runtime
wrapper and the consensus test suite to TypeScript + Vitest, while keeping shipped
plugin files dependency-free committed `.mjs`.

Concretely:

- Migrate `plugins/consensus/skills/refine/scripts/consensus-refine.mjs` to a
  canonical TypeScript source at `src/consensus/refine/consensus-refine.ts`.
- Generate the shipped runtime back to the same provider-facing path
  `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`.
- Convert the consensus-related `node:test` `.mjs` tests to Vitest `.test.ts`.
- Keep user-facing behavior and runtime paths stable; preserve all assertions
  (no coverage loss).

Out of scope: `consensus-evaluate` implementation; session-observer,
transcript-core, export-session, and repo/tooling test migration; removing
`test:node`; tightening `allowJs` further; runtime dependencies in shipped skills.

## Solution Space

The only genuine architecture decision is **how the canonical wrapper TypeScript
source reconciles its dependency on the consensus loop with the shipped runtime
import**. Everything else follows the pattern DR-020 already established for
`consensus-loop`.

The tension: the canonical source `src/consensus/refine/consensus-refine.ts`
should type-check against the real loop API (canonical source at
`src/consensus/core/consensus-loop.ts`), but the generated shipped wrapper at
`plugins/consensus/skills/refine/scripts/consensus-refine.mjs` must import its
sibling `./consensus-loop.mjs` at runtime. The two files sit in different
relative layouts (source: `refine/` → `../core/`; shipped: same directory).

### Approach 1: Build-time import-specifier rewrite _(Recommended)_

**Description:** The TypeScript source imports the loop with a NodeNext-resolvable
specifier (`'../core/consensus-loop.js'`), which TypeScript resolves to the
canonical `src/consensus/core/consensus-loop.ts` for full type-checking. The build
(`scripts/build-generated.mjs`, esbuild `bundle:false`) transpiles types away and
preserves the import statement verbatim, then applies a per-mapping, explicitly
configured import rewrite (`../core/consensus-loop.js` → `./consensus-loop.mjs`)
on the emitted output. Tests assert the generated wrapper imports
`./consensus-loop.mjs` and contains no `../core/` specifier.

**When this is the right choice:** When you want the canonical source to type-check
against real loop types AND the shipped output to keep the existing sibling import
contract, with the reconciliation expressed as explicit, testable build config.

**Tradeoffs:** Adds a small, declared transform step to the build. The rewrite is a
literal-specifier replacement (safe because `bundle:false` preserves specifiers
exactly), guarded by drift checks and an explicit "generated import is correct"
test, so the fragility is bounded and caught by CI.

### Approach 2: Bundle-and-externalize via esbuild `onResolve`

**Description:** Switch the wrapper build to `bundle: true` and use an esbuild
plugin `onResolve` hook to mark the loop import external, rewriting its path to
`./consensus-loop.mjs`.

**When this is the right choice:** When multiple internal modules must be inlined
and externals rewritten as a matter of course.

**Tradeoffs:** Diverges from the existing `bundle:false` loop build, broadens what
esbuild does to the output (bundling semantics, potential code-shape changes), and
adds plugin machinery for a single one-line import. More moving parts than the
problem needs.

### Chosen Direction

**Approach:** Build-time import-specifier rewrite (Approach 1).
**Rationale:** Minimal, explicit, consistent with the existing `consensus-loop`
build (`bundle:false`), and directly testable. It satisfies the brief's
requirement to "choose and document the mechanism explicitly, likely in
`scripts/build-generated.mjs`, and add tests proving the generated import is
correct." Verified preconditions: esbuild `bundle:false` preserves import
specifiers verbatim (confirmed in the committed `consensus-loop.mjs`); all loop
symbols the wrapper imports are exported from the canonical loop TS; the wrapper
has exactly one relative import to reconcile.
**User validated:** Yes — the design-depth decision point was resolved on
2026-06-16: the user chose "Lightweight design first" (draft-and-review), and
Approach 1 was carried into `design.md` uncontested. The chosen direction was
then exercised through the 2026-06-16 design artifact-review cycle, keeping the
lifecycle artifacts in agreement.

## Key Decisions

1. **Import reconciliation:** Canonical wrapper imports the loop via a
   NodeNext-resolvable `'../core/consensus-loop.js'` specifier (type-checks against
   real loop types); the build rewrites it to `'./consensus-loop.mjs'` in the
   generated output. Extends DR-020.
2. **Build mapping:** Add a second `generatedOutputs` entry
   (`src/consensus/refine/consensus-refine.ts` →
   `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`) carrying the
   per-mapping import-rewrite config. Both generated outputs are drift-checked.
3. **Test migration:** Convert consensus-related `node:test` `.mjs` files to Vitest
   `.test.ts`, preserving every assertion. Non-consensus suites (session-observer,
   transcript-core, export-session, repo/tooling) stay on `node:test`; `test:node`
   is retained for them. `pnpm test` continues to run both runners.
4. **Layout invariant:** No canonical `.ts` source under `plugins/consensus/skills`;
   keep/extend the layout test asserting this.

## Constraints

- Shipped skills must remain dependency-free and runnable with no install step;
  generated `.mjs` imports only Node stdlib + the sibling loop runtime.
- Runtime paths and user-facing behavior must not change.
- Generated `.mjs` files are never hand-edited (only via the build).
- TypeScript/Vitest/esbuild remain dev-only tooling.
- Generated-output exclusions stay synchronized across oxlint, oxfmt, lint-staged,
  and CI changed-file checks.

## Success Criteria

- `src/consensus/refine/consensus-refine.ts` exists as canonical TS, type-checks
  against the loop API, and is the source for the committed
  `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`.
- Both consensus generated outputs are produced and drift-checked (`build`,
  `build:check`, generated-output-sync test).
- A test proves the generated wrapper imports `./consensus-loop.mjs` and not the
  canonical `../core/` path.
- Consensus-related tests run on Vitest as `.test.ts` with no assertion loss.
- `pnpm run build`, `build:check`, `type-check`, `test:vitest`, `validate`,
  `smoke`, and full `pnpm test` pass (non-consensus timing flakes isolated and
  reported, not in scope).

## Out of Scope

- `consensus-evaluate` implementation.
- Migrating session-observer, transcript-core, export-session, or repo/tooling
  tests.
- Removing `test:node` (non-consensus suites still need it).
- Further `allowJs` tightening (already `false`; no behavior change needed here).
- Adding runtime dependencies to shipped skills.

## Open Questions

- **Test migration breadth:** A few consensus test files lean on Node-test-specific
  helpers or fixtures. Resolve per-file during planning whether a 1:1 Vitest port is
  clean or whether a thin shared helper is warranted — without changing assertions.

## Risks

- **Generated-import drift:** The rewritten loop import could silently regress.
  - **Likelihood:** Low · **Impact:** High
  - **Mitigation:** Dedicated "generated import is correct" test plus the existing
    drift guard covering both outputs.
- **Hidden coverage loss during port:** Subtle assertion drift when translating
  `node:test` semantics to Vitest.
  - **Likelihood:** Medium · **Impact:** Medium
  - **Mitigation:** Port file-by-file, keep the Node suite green until each file is
    moved, diff assertion counts, run the full suite before handoff.

## Next Steps

Quick mode → lightweight design first: capture the build/import mechanism and the
test-migration approach in a focused `design.md`, then generate the plan.
