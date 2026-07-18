---
oat_generated: true
oat_external_plan: true
oat_external_plan_source: repo-audit
oat_external_plan_sources:
  - 'repo-audit: full repository (excl. .agents/, .claude/, .codex/, .cursor/)'
oat_external_plan_commit: '8309623'
oat_backlog_items:
  - BL-260718-consolidate-duplicated
oat_issue_url: null
created: '2026-07-17T23:39:00Z'
---

# Consolidate duplicated consensus CLI helpers into one shared canonical module

> [!NOTE]
> This is an external implementation plan, not a canonical OAT project
> `plan.md`. Execute it directly, or import it for tracked OAT execution with
> `oat-project-import-plan <this-file>`.
>
> Begin with the drift check. Follow the steps and verification gates in order.
> If a STOP condition occurs, stop and report instead of improvising.

## Outcome

The ~18 helper functions independently re-implemented across the five consensus command modules (`create`, `decide`, `plan`, `evaluate`, `panel`) live in one shared canonical source module that the generated-output build fans out, so a fix lands once instead of five-plus times. The audit confirmed real drift already exists: `parsePositiveInteger`/`parsePeers` in `consensus-loop.ts` have different semantics (no min/max, no provider-id validation) than the command-module copies, meaning `--peers` validation strictness differs by entry point. After this plan, the byte-identical helpers are shared, the confirmed drift is reconciled with an explicitly chosen canonical semantics, and a guard keeps future helpers from silently forking.

## Source and live evidence

- Source artifact or scope: repo-audit reconnaissance (architecture lane), full repository
- Planned at: commit `8309623` on `2026-07-17`
- Related backlog items: none
- Evidence (lane-reported with diff verification of the identical subset; re-verify the inventory in step 1):
  - `src/consensus/create/consensus-create.ts:140-991`, `decide/consensus-decide.ts:132-971`, `plan/consensus-plan.ts:133-854`, `evaluate/consensus-evaluate.ts:143-973`, `panel/consensus-panel.ts:196-830` — each defines local copies of `requireValue`, `parsePositiveInteger`, `validateProviderId`, `parsePeers`, `pathExists`, `nearestExistingPath`, `ensureFinalNewline`, prompt-block encoding, provider-CLI envelope parsing, provider inventory/preflight helpers, `defaultRunDirName`, and (create/decide) `confineWrite`/`atomicWriteFile`.
  - `src/consensus/core/consensus-loop.ts:725-746` — a sixth `parsePositiveInteger`/`parsePeers` with **different semantics** (confirmed drift, not just duplication).
  - Existing precedent for a shared fanned-out module: `consensus-config.ts` maps to six output paths in `scripts/build-generated.mjs` (~lines 22-50).

## Drift check

```bash
git diff --stat 8309623..HEAD -- src/consensus/ scripts/build-generated.mjs
```

Any change to the five command modules or the build mapping requires re-running the step-1 inventory before editing. A material mismatch in the helper inventory is a STOP condition only if the duplication itself was already removed.

## Repository conventions

- Build: `pnpm run build`; sync: `pnpm run build:check`; Typecheck: `pnpm run type-check`; Test: `pnpm test`; Validate: `npm run validate`
- Build contract: new canonical sources need entries in `generatedOutputs` in `scripts/build-generated.mjs` (source → every output path + `importRewrites` for relative imports). Model the new module's entry on the existing `consensus-config.ts` fan-out.
- Lint/format exclusions: new generated output paths must be added to `.oxfmtrc.json` and `.oxlintrc.json` `ignorePatterns` (and stay consistent with `.lintstagedrc.mjs`/CI, which derive from `generatedOutputs` programmatically).
- Skill-version gate: every skill whose generated scripts change needs its SKILL.md version bumped (`create`, `decide`, `plan`, `evaluate`, `panel`, and `refine` if `consensus-loop.ts` changes); confirm with `pnpm run validate:skill-versions -- --base-ref main`.
- Commits: Conventional Commits (`refactor(consensus): extract shared cli helpers`). Do not push or open a PR unless instructed.

## Scope

### In scope

- New `src/consensus/shared/cli-helpers.ts` (or a name matching existing directory conventions — `src/consensus/config/` holds `consensus-config.ts`; mirror that layout).
- Moving **byte-identical or semantically-identical** helpers only; updating the five command modules' imports.
- Reconciling the `consensus-loop.ts:725-746` `parsePositiveInteger`/`parsePeers` drift with an explicit decision (step 2).
- `scripts/build-generated.mjs` mapping + ignore-list entries; tests; skill version bumps.

### Out of scope

- Helpers that differ intentionally per command (leave in place; document divergence in the inventory).
- Splitting the god modules (`consensus-loop.ts`, `consensus-refine.ts`) — separate escalation.
- Subprocess-runner unification — covered by `2026-07-17-consensus-subprocess-hardening.md`; execute that plan first if both are queued (both touch `consensus-panel.ts`).

## Current state

- The five command modules are canonical TypeScript, each generated into its own skill's `scripts/*.mjs`. They do not import each other; shared behavior arrived by copy-paste.
- `consensus-config.ts` proves the shared-module pattern end to end: one source, six outputs, import rewrites handled in `build-generated.mjs`.
- Anything moved must keep each command's generated output self-contained per the existing build contract (the build rewrites relative imports to sibling generated files — confirm the target skill directories receive the new shared `.mjs`).

## Implementation steps

### 1. Build the verified inventory

For each candidate helper, diff the five copies (`diff <(sed -n 'a,bp' fileA) <(sed -n 'c,dp' fileB)` or extract-and-diff). Classify: **identical** (move), **trivially-divergent** (normalize then move — record the delta), **intentionally-divergent** (leave; add a one-line comment naming the variants). Write the classification into the commit body.

**Verify:** inventory covers every helper named in the evidence; each has a classification.

### 2. Reconcile the confirmed `parsePeers`/`parsePositiveInteger` drift

Read both semantics (`consensus-loop.ts:725-746` vs any command copy). The command-level version (min/max bounds + provider-id validation) is the stricter, newer pattern — make it canonical unless reading reveals the loop-level laxity is load-bearing (e.g. loop resume paths accept values commands would reject). If loop behavior must change, note it as a user-visible validation tightening in the commit body.

**Verify:** a targeted test exercising the loop entry point with a previously-lax value documents the chosen behavior.

### 3. Create the shared module and switch imports

Add the shared source with the identical/normalized helpers; update the five command modules (and `consensus-loop.ts` for the reconciled parsers) to import from it; delete the local copies. Add the `generatedOutputs` entry fanning the shared module into every consuming skill's `scripts/` directory with the required `importRewrites`, modeled on `consensus-config.ts`. Add the new output paths to `.oxfmtrc.json`/`.oxlintrc.json` `ignorePatterns`.

**Verify:** `pnpm run build && pnpm run build:check` → clean; `pnpm run type-check` → clean.

### 4. Guard against re-forking

Add a tooling test (under `tests/tooling/`) asserting none of the five command modules re-declares a function name exported by the shared module (simple source-scan, same style as existing string-contract tests).

**Verify:** `pnpm test -- tests/tooling/` → passes; deliberately re-adding a local `parsePeers` in a scratch edit fails it (then revert).

### 5. Bump versions and run the full contract

Bump SKILL.md versions for every skill with changed generated scripts, then:

```bash
pnpm run build && pnpm run build:check && pnpm test && npm run validate && pnpm run validate:skill-versions -- --base-ref main && pnpm run smoke
```

**Verify:** all exit 0 — `smoke` matters here because it exercises the create/decide/plan/refine wrapper flows end to end.

## Test plan

- Existing command suites (`tests/consensus/{create,decide,plan,evaluate,panel}/…`) are the primary regression net — they must pass unchanged except where step 2 documents a validation tightening.
- New: the re-fork guard (step 4) and the step-2 semantics test.
- Focused: per-command suites; Full: `pnpm test` + `pnpm run smoke`.

## Done criteria

- [ ] Identical helpers exist exactly once in canonical source; five modules import them.
- [ ] The `parsePeers`/`parsePositiveInteger` drift is reconciled with the decision recorded in the commit body.
- [ ] Build mapping, ignore lists, and skill versions updated; guard test in place.
- [ ] `build`, `build:check`, `type-check`, `test`, `validate`, `smoke` all pass; `git status --short` clean of unexplained files.

## STOP conditions

- The inventory shows most copies are *not* actually identical (the premise fails) — report the real divergence map instead of forcing normalization.
- Step 2 reveals the loop-level laxity is load-bearing for resume compatibility — surface the compatibility question; do not silently tighten.
- The build fan-out for the shared module would require restructuring `build-generated.mjs` beyond adding entries — stop; that is the build-contract plan's territory.
- Any verification gate fails twice after one bounded correction.

## Review focus

- The generated diffs: every consuming skill's `scripts/` should show the new shared `.mjs` plus mechanical import changes — nothing else.
- Behavior deltas from normalization (should be none except the documented step-2 tightening).
- Deferred intentionally: intentionally-divergent helpers, subprocess unification, god-module split.
