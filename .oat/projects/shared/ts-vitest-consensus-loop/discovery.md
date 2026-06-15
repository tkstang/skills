---
oat_status: complete
oat_ready_for: oat-project-quick-start
oat_blockers: []
oat_last_updated: 2026-06-15
oat_generated: false
---

# Discovery: ts-vitest-consensus-loop

## Initial Request

Start a quick-mode OAT project for the recently created TypeScript/Vitest refactor backlog work. The project should stand up the toolset and establish the source-to-generated-runtime pattern, then migrate `consensus-loop` as the first real slice.

## Solution Space

The discussion considered two proof-slice options:

### Approach 1: Toolchain plus `consensus-evaluate`

Use `consensus-evaluate` as a new feature built on the new TS/Vitest/build pattern.

**When this is right:** best when the goal is a small, feature-shaped sample that avoids touching the existing consensus runtime.

**Tradeoff:** it proves a wrapper pattern but leaves the type-heavy loop domain untouched, so it provides weaker guidance for the later migration.

### Approach 2: Toolchain plus `consensus-loop` migration

Stand up TS/Vitest/build/drift guard infrastructure, then migrate `plugins/consensus/skills/refine/scripts/consensus-loop.mjs` to canonical TypeScript source that builds back to the same shipped `.mjs` path.

**When this is right:** best when the goal is to prove the migration path against the code where types matter most: verdicts, records, synthesis payloads, event/status output, CLI args, retry behavior, and agency/escalation routing.

**Tradeoff:** higher risk than a new wrapper because `consensus-loop` is central and many tests import it directly.

### Chosen Direction

**Approach:** Toolchain plus `consensus-loop` migration.

**Rationale:** The loop is the highest-value proof slice. It exercises the generated-runtime contract, type-checking, Vitest coexistence, and existing behavior preservation without broadening into the full consensus/refine wrapper or full test-suite migration.

**User validated:** Yes. The user agreed that standing up the toolset and converting `consensus-loop` is a better first move than using `consensus-evaluate` as the proof slice.

## Options Considered

### Test Runner Transition

**Chosen:** Run Vitest alongside the existing `node:test` suite in this project.

**Summary:** `pnpm test` should preserve the current Node test coverage while adding Vitest for new TS/build checks. Full migration of existing tests to Vitest remains part of `bl-bfb4`.

### Build Output Contract

**Chosen:** Canonical TS source builds to committed `.mjs` output at the same runtime path that skills, docs, and tests already reference.

**Summary:** Provider runtimes and existing imports should keep using `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`. The generated output carries a banner and is protected by a drift guard, mirroring the existing transcript-core generated-copy pattern.

### Feature Scope

**Chosen:** Do not include `consensus-evaluate` in this quick-start project.

**Summary:** `consensus-evaluate` should follow as a clean next project after the loop migration establishes the pattern.

## Key Decisions

1. **Workflow mode:** Use quick mode, not spec-driven mode.
2. **Primary backlog scope:** `bl-853a` is the main backlog item.
3. **Secondary backlog scope:** Include only the first slice of `bl-bfb4`: migrate `consensus-loop` to real TypeScript source and generated `.mjs` output.
4. **Out-of-scope feature:** Defer `bl-5174` (`consensus-evaluate`) until after this project.
5. **Test strategy:** Preserve existing `node:test` coverage; add Vitest for new TS-authored and build/drift checks.
6. **Runtime contract:** Shipped skills remain dependency-free and run committed `.mjs` output directly.

## Constraints

- Runtime plugin code remains dependency-free for users; TypeScript, Vitest, and bundling are developer tooling only.
- Generated `.mjs` output must be committed and must remain the path referenced by provider manifests, skill docs, tests, and agent runner commands.
- Existing behavior of `consensus-loop` must be protected by the current Node test suite throughout the migration.
- Generated output must be excluded from formatting/linting paths that would fight the generator.
- Do not broaden into the full `consensus-refine` wrapper migration, broad Vitest conversion, peer-invocation redesign, or family-skill implementation.
- Dispatch ceiling / model effort must be confirmed before implementation; do not silently pick one.

## Success Criteria

- TypeScript, Vitest, and build tooling are installed as dev-only dependencies and documented.
- `pnpm test` runs the existing Node tests plus the new Vitest checks without reducing coverage.
- A generated-output build script produces `plugins/consensus/skills/refine/scripts/consensus-loop.mjs` from canonical TypeScript source.
- A drift guard fails when the committed generated loop output differs from source.
- `consensus-loop` has real TypeScript source and useful domain types for verdicts, synthesis payloads, records/status, CLI args, and escalation routing.
- `pnpm run validate` and `pnpm run smoke` still pass.
- CI builds, type-checks, tests, validates, and smokes the repo.
- Docs and decision records explain the canonical TS source plus committed generated `.mjs` contract.

## Out of Scope

- Implementing `consensus-evaluate`.
- Migrating `consensus-refine.mjs`.
- Migrating the full test suite from `node:test` to Vitest.
- Reworking the Paseo peer-invocation boundary or tool-based verdict submission.
- Changing shipped skill install/runtime dependencies.
- Claiming provider or marketplace support beyond existing release verification state.

## Deferred Ideas

- `consensus-evaluate` as the next family-skill project after this migration pattern lands.
- Broader `bl-bfb4` migration of the refine wrapper and existing tests.
- Type-heavy peer-invocation redesign work from `bl-bb7e` / `bl-3a88`.

## Open Questions

- **Bundler choice:** Finalize esbuild versus tsup during implementation. The plan assumes a simple dependency-light build script and should prefer esbuild unless a concrete local constraint argues otherwise.
- **Generated-output formatting:** Decide the exact lint/format exclusion pattern for generated consensus output and keep `.oxfmtrc.json`, `.oxlintrc.json`, `.lintstagedrc.mjs`, and CI in sync.
- **Dispatch ceiling:** Confirm OAT's project dispatch ceiling before implementation starts.

## Assumptions

- The current Node test suite is the behavioral oracle for the loop migration.
- The existing transcript-core generated-copy pattern is the closest in-repo precedent.
- The migration can land while `consensus-refine.mjs` continues importing `./consensus-loop.mjs`.

## Risks

- **Generated output drift:** Source and committed runtime output may diverge.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation Ideas:** Add a drift guard and run it in `pnpm test`.
- **Large-file migration regression:** `consensus-loop` is central and dense.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation Ideas:** Keep output path stable, run loop-focused tests after each task, and use existing full validation before completion.
- **Tooling churn:** Adding TS/Vitest/build tooling can conflict with incremental formatting/lint rules.
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Mitigation Ideas:** Keep generated exclusions explicit and synchronized across config, hooks, and CI.

## Next Steps

Proceed directly to the quick implementation plan. No full spec or design artifact is required for this project.
