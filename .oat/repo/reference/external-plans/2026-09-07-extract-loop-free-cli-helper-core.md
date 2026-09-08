---
oat_generated: true
oat_external_plan: true
oat_external_plan_source: backlog-review
oat_external_plan_sources:
  - .oat/repo/pjm/backlog/reviews/backlog-and-roadmap-review.md
  - .oat/repo/pjm/backlog/items/BL-260723-split-loop-free-cli-helpers.md
oat_external_plan_commit: f5395a35
oat_backlog_items:
  - BL-260723-split-loop-free-cli-helpers
oat_issue_url: null
created: '2026-09-08T00:16:29Z'
---

# Extract a loop-free CLI helper core shared safely with panel

> [!NOTE]
> This is an external implementation plan, not a canonical OAT project `plan.md`. Execute it directly, or import it with `oat-project-import-plan <this-file>`.

## Outcome

Pure CLI helpers live in a loop-free canonical module used by panel and the existing loop-coupled helper layer. Panel remains independent of `consensus-loop`, while verified duplicate parsing, path, newline, and envelope primitives stop drifting.

## Source and live evidence

- Planned at `f5395a35` on 2026-09-07.
- `src/consensus/shared/cli-helpers.ts:11` imports `ConsensusError` and `EXIT_CODES`, making the entire module loop-coupled.
- Pure exports begin at `src/consensus/shared/cli-helpers.ts:27` and include provider validation, path checks, newline handling, and envelope helpers.
- `src/consensus/panel/consensus-panel.ts:212-227`, `:373-399`, `:566-579`, and `:1424-1445` retain local counterparts.
- `tests/tooling/shared-cli-helpers-guard.test.ts:10-16` documents the intentional exclusion; `:78-88` forbids both loop and coupled-helper imports.
- Some apparent duplicates differ: panel prompt escaping includes `&`, while the coupled helper currently escapes only angle brackets. Do not merge non-equivalent behavior accidentally.

## Drift check

```bash
git diff --stat f5395a35..HEAD -- src/consensus/shared src/consensus/panel scripts/build-generated.mjs tests/tooling/shared-cli-helpers-guard.test.ts tests/consensus/panel
```

## Scope

### In scope

- New `src/consensus/shared/cli-helpers-core.ts` containing only loop/error-independent helpers.
- Composition/re-export from `cli-helpers.ts` and imports from `consensus-panel.ts`.
- Generated-output mappings, guard changes, focused panel/command tests, and required skill version bumps.

### Out of scope

- Moving `ConsensusError`, `EXIT_CODES`, confinement, atomic write, or provider-unavailable error behavior into the core.
- Normalizing deliberately different prompt escaping or error semantics without a separate contract decision.
- General panel or consensus-loop decomposition.

## Implementation steps

### 1. Establish semantic parity before extraction

Inventory each proposed helper with focused tests or byte-level comparison. Classify exact equivalents, deliberate differences, and functions coupled to loop-specific errors. Move only the first group; preserve panel's stronger ampersand escaping unless an explicit decision changes it.

**Verify:** existing create/decide/plan/evaluate/panel focused suites pass before structural changes.

### 2. Extract and compose the loop-free core

Move verified pure helpers into the new module. Re-export them from `cli-helpers.ts` so current consumers remain stable, and replace matching panel definitions with core imports. Keep the panel-to-loop import graph absent.

**Verify:** `pnpm exec vitest run tests/tooling/shared-cli-helpers-guard.test.ts` passes with a new assertion allowing core but forbidding the coupled layer.

### 3. Extend generated fan-out and regression guards

Add the core to the canonical build mapping for every consuming skill, regenerate outputs, and update generated-output ignore-list tests. Extend the re-fork guard to include panel for helpers actually moved.

**Verify:** `pnpm run build && pnpm run build:check` succeeds.

### 4. Run affected entry-point suites and version gates

Exercise parsing, preflight/envelope handling, path behavior, and panel output behavior across all consumers; bump affected skill versions.

**Verify:** `pnpm exec vitest run tests/consensus/{create,decide,plan,evaluate,panel} tests/tooling/shared-cli-helpers-guard.test.ts` and `pnpm run validate:skill-versions -- --base-ref origin/main` pass.

## Done criteria

- [ ] Panel imports a loop-free core and no loop-coupled module.
- [ ] Only semantically equivalent helpers are consolidated.
- [ ] Re-fork and generated-output guards cover the new module.
- [ ] `pnpm run build:check`, `pnpm run validate`, and `pnpm test` pass.

## STOP conditions

- A proposed helper has behavior drift without an approved canonical contract.
- Generated outputs cannot remain dependency-free/self-contained.
- The extraction introduces a panel-to-loop dependency or requires unrelated module decomposition.

## Review focus

Inspect import topology, prompt-escaping preservation, error-type boundaries, generated fan-out completeness, and public skill version bumps.
