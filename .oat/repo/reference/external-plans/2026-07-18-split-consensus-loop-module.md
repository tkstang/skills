---
oat_generated: true
oat_external_plan: true
oat_external_plan_source: repo-audit
oat_external_plan_sources:
  - 'repo-audit: full repository (excl. .agents/, .claude/, .codex/, .cursor/)'
oat_external_plan_commit: '8309623'
oat_backlog_items:
  - BL-260718-split-consensus-loop-into
oat_issue_url: null
created: '2026-07-18T00:20:00Z'
---

# Split consensus-loop.ts into cohesive core modules behind a stable facade

> [!NOTE]
> This is an external implementation plan, not a canonical OAT project
> `plan.md`. Execute it directly, or import it for tracked OAT execution with
> `oat-project-import-plan <this-file>`.
>
> Begin with the drift check. Follow the steps and verification gates in order.
> If a STOP condition occurs, stop and report instead of improvising.
>
> This is a **behavior-preserving mechanical refactor**. No function's logic,
> signature, or observable behavior changes. Any edit that is not a move,
> an import fix, or a re-export is out of scope.

## Outcome

`src/consensus/core/consensus-loop.ts` (3,961 lines, ~116 top-level functions, fan-in from all five command modules) is split into cohesive submodules under `src/consensus/core/`, with `consensus-loop.ts` retained as a facade that re-exports the public surface. Consumers — the five command wrappers and their generated outputs — are untouched because the facade preserves every existing import path. Each extraction commit leaves the tree fully green, so a bad seam is a cheap single-commit revert.

## Source and live evidence

- Source artifact or scope: repo-audit reconnaissance (architecture lane, ARCH-03), full repository
- Planned at: commit `8309623` on `2026-07-17` (structure re-verified 2026-07-18)
- Related backlog items: `BL-260718-split-consensus-loop-into` — Split consensus-loop into cohesive core modules
- Verified evidence (read live at planning time):
  - `wc -l src/consensus/core/consensus-loop.ts` → 3,961 (repo `src/` median ~590; next largest non-refine file is `consensus-panel.ts` at ~1,430).
  - `scripts/build-generated.mjs:17-19` — `consensus-loop.ts` maps to a **single shared output** `plugins/consensus/scripts/consensus-loop.mjs`; wrapper outputs import it via `importRewrites` (`from: '../core/consensus-loop.js'` entries at lines ~57-81). A facade split therefore requires **zero changes to consumer imports or their rewrites**.
  - Deep existing test coverage under `tests/consensus/core/` (tests lane: realistic, subprocess-driven, no mocks) — the regression net that makes a mechanical split safe.
  - Visible seams (architecture lane): validation/normalization, records I/O, provider-CLI invocation, arg/option parsing, prompt/block encoding, loop orchestration.

## Drift check

```bash
git diff --stat 8309623..HEAD -- src/consensus/core/ scripts/build-generated.mjs
```

**Expected drift:** the audit's plans `2026-07-17-atomic-consensus-records-writes.md`, `2026-07-17-consensus-subprocess-hardening.md`, and `2026-07-17-consolidate-consensus-cli-helpers.md` intentionally edit this file first — this plan is sequenced **after** them and absorbs their changes (re-run the step-1 inventory against the then-current file; line numbers above are planning-time anchors, not preconditions). Drift *beyond* those plans' scope needs reconciling before starting.

## Repository conventions

- Build: `pnpm run build`; sync: `pnpm run build:check`; Typecheck: `pnpm run type-check`; Test: `pnpm test`; Validate: `npm run validate`; Smoke: `pnpm run smoke`
- Build contract: each new `src/consensus/core/*.ts` module needs its own `generatedOutputs` entry (output beside the existing shared one, `plugins/consensus/scripts/<name>.mjs`) and the facade's entry needs `importRewrites` for its new relative imports. If `2026-07-17-derive-generated-ignore-lists.md` has landed, rewrites are derived automatically and only the mapping entries are needed; otherwise hand-write both and add the new output paths to `.oxfmtrc.json`/`.oxlintrc.json` `ignorePatterns`.
- Skill-version gate: run `pnpm run validate:skill-versions -- --base-ref main` after building; bump any skill whose generated files changed (expected: none, because wrapper outputs are untouched — treat a reported skill change as a signal the facade leaked).
- Commits: Conventional Commits, one extraction per commit (`refactor(consensus): extract records io from consensus-loop`). Do not push or open a PR unless instructed.

## Scope

### In scope

- New submodules under `src/consensus/core/` (indicative names; finalize from the step-1 inventory): `loop-validation.ts`, `loop-records.ts`, `loop-provider-invocation.ts`, `loop-args.ts`, `loop-prompts.ts` — with `consensus-loop.ts` reduced to loop orchestration plus a re-export facade of the previously-public surface.
- `scripts/build-generated.mjs` mapping entries (and ignore-list entries if the derivation plan has not landed).
- Moving existing tests only where a test file imports a moved symbol directly (update the import; do not rewrite tests).

### Out of scope

- Any behavior, signature, error-message, or logic change — including "while I'm here" cleanups.
- Changes to the five command modules or `consensus-refine.ts` (its split is a separate plan).
- Renaming exported symbols or changing the facade's public surface.
- New abstractions; this plan moves code, it does not redesign it.

## Current state

- The five command wrappers (and `consensus-refine.ts`) import from `../core/consensus-loop.js`; generated wrapper outputs are rewritten to the shared `plugins/consensus/scripts/consensus-loop.mjs`. Preserving `consensus-loop.ts` as the sole public entry keeps all of that stable.
- Function granularity is fine-grained (~116 top-level functions) with intra-file call dependencies — the inventory must map callers before choosing extraction order (leaf clusters first).
- If the helper-consolidation plan landed, some parsing/validation helpers already moved to a shared module — the inventory shrinks accordingly.

## Implementation steps

### 1. Inventory and cluster map

Enumerate every top-level function/const in the current `consensus-loop.ts` with its callers (inside and outside the file). Group into the seam clusters above, adjusting names/boundaries to what the code actually shows. Order clusters by dependency: extract leaf clusters (no imports from remaining loop code) first. Record the map in the first commit message body.

**Verify:** every top-level symbol is assigned to exactly one cluster or to "stays in facade/orchestration"; no cluster pair has a mutual dependency (if one does, merge or re-cut the clusters — see STOP).

### 2. Extract cluster by cluster (one commit each)

For each cluster in dependency order: move the functions to the new module verbatim; import them in `consensus-loop.ts` and re-export any that were previously exported; add the `generatedOutputs` entry (+ rewrites/ignore entries per conventions above); update any test importing a moved symbol directly.

**Verify after every cluster (the per-commit gate):**

```bash
pnpm run type-check && pnpm run build && pnpm run build:check && pnpm test -- tests/consensus/ && npm run validate
```

All green before the next extraction; commit before proceeding.

### 3. Final pass

When all clusters are extracted, `consensus-loop.ts` should contain only loop orchestration and the re-export facade.

**Verify:** `wc -l src/consensus/core/consensus-loop.ts` ≤ ~1,200 and no new module > ~1,000 lines (targets, not laws — if a cohesive cluster is legitimately larger, note why in the commit body rather than force-splitting it); `pnpm run validate:skill-versions -- --base-ref main` reports no unbumped skill changes.

### 4. Full contract

```bash
pnpm run build && pnpm run build:check && pnpm run type-check && pnpm test && npm run validate && pnpm run smoke
```

**Verify:** all exit 0; `git status --short` clean of unexplained files.

## Test plan

- No new tests required; the existing `tests/consensus/` suites are the regression net and must pass unchanged (import-path updates only).
- `pnpm run smoke` proves the wrapper flows end to end after the split.
- The per-cluster gate in step 2 is the primary safety mechanism — never batch multiple clusters into one unverified commit.

## Done criteria

- [ ] `consensus-loop.ts` is orchestration + facade; extracted modules match the recorded cluster map.
- [ ] Zero changes to command wrappers, `consensus-refine.ts`, or their generated outputs (verify: `git diff --stat <start>..HEAD -- 'plugins/consensus/skills/'` is empty, excluding any SKILL.md bumps the validator required).
- [ ] Every commit in the series passes the step-2 gate independently.
- [ ] Full contract including `smoke` passes; `validate:skill-versions` clean.

## STOP conditions

- The cluster map reveals mutual dependencies that can only be broken by *changing* code (not moving it) — report the entanglement; that specific seam may genuinely need design work.
- Generated wrapper outputs change beyond the shared-module additions (the facade leaked — stop and diagnose rather than bumping versions to make the validator pass).
- The step-2 gate fails twice on one cluster after one bounded correction — revert that extraction and report.
- Chain-A plans (atomic records, subprocess hardening, helper consolidation) are queued but not yet landed — pause this plan; do not race the same file.

## Review focus

- Verbatim moves: reviewers should diff each extraction with `git diff --color-moved` — non-move edits are scope violations.
- The facade's re-export list vs the pre-split export list (must be a superset of what consumers used, ideally identical).
- Deferred intentionally: any internal redesign of the loop, retiring the facade in favor of direct submodule imports by wrappers (a later, separate change once the split has soaked).
