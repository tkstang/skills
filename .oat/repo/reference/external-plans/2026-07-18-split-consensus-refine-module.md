---
oat_generated: true
oat_external_plan: true
oat_external_plan_source: repo-audit
oat_external_plan_sources:
  - 'repo-audit: full repository (excl. .agents/, .claude/, .codex/, .cursor/)'
oat_external_plan_commit: '8309623'
oat_backlog_items:
  - BL-260718-split-consensus-refine-into
oat_issue_url: null
created: '2026-07-18T00:20:00Z'
---

# Split consensus-refine.ts into cohesive modules behind a stable facade

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

`src/consensus/refine/consensus-refine.ts` (3,890 lines, ~122 top-level functions) is split into cohesive submodules under `src/consensus/refine/`, with `consensus-refine.ts` retained as the facade/entry module so the refine skill's generated runtime and every import path stay stable. Same method as the consensus-loop split: leaf-cluster-first extraction, one commit per cluster, tree green after each.

## Source and live evidence

- Source artifact or scope: repo-audit reconnaissance (architecture lane, ARCH-03), full repository
- Planned at: commit `8309623` on `2026-07-17` (structure re-verified 2026-07-18)
- Related backlog items: `BL-260718-split-consensus-refine-into` — Split consensus-refine into cohesive modules
- Verified evidence (read live at planning time):
  - `wc -l src/consensus/refine/consensus-refine.ts` → 3,890 (~122 top-level functions; repo median ~590).
  - `tests/consensus/refine/` — deep coverage of sequential/parallel modes, resume, corruption handling, user intervention, host direction (tests lane) — the regression net.
  - Visible seams (architecture lane): resume/corruption handling, sectioning, prompt construction, CLI/arg parsing, wrapper orchestration.
  - Unlike `consensus-loop.ts`, this file is the refine skill's own wrapper source: its generated output lives under the refine skill's scripts (see `scripts/build-generated.mjs` refine entries) — so this split **does** touch skill-scoped generated files and requires a `refine` SKILL.md version bump.

## Drift check

```bash
git diff --stat 8309623..HEAD -- src/consensus/refine/ scripts/build-generated.mjs plugins/consensus/skills/refine/
```

**Expected drift:** the helper-consolidation plan (`2026-07-17-consolidate-consensus-cli-helpers.md`) may have moved some of this file's local helpers to a shared module — re-run the step-1 inventory against the then-current file. Drift beyond the audit plans' scope needs reconciling first.

## Repository conventions

- Build: `pnpm run build`; sync: `pnpm run build:check`; Typecheck: `pnpm run type-check`; Test: `pnpm test`; Validate: `npm run validate`; Smoke: `pnpm run smoke` (exercises the refine wrapper directly)
- Build contract: each new `src/consensus/refine/*.ts` module needs a `generatedOutputs` entry targeting the refine skill's scripts directory, plus `importRewrites` on the facade entry (hand-written unless `2026-07-17-derive-generated-ignore-lists.md` landed) and ignore-list entries for the new outputs.
- Skill-version gate: **bump `plugins/consensus/skills/refine/SKILL.md`** (top-level + `metadata.version` in sync) — new generated files under the skill directory make this mandatory; confirm with `pnpm run validate:skill-versions -- --base-ref main`. Bump once for the whole series if executed as one branch/PR.
- Commits: Conventional Commits, one extraction per commit (`refactor(refine): extract resume handling`). Do not push or open a PR unless instructed.

## Scope

### In scope

- New submodules under `src/consensus/refine/` (indicative; finalize from inventory): `refine-resume.ts`, `refine-sections.ts`, `refine-prompts.ts`, `refine-args.ts` — with `consensus-refine.ts` reduced to wrapper orchestration plus re-exports.
- `scripts/build-generated.mjs` refine entries; ignore-list entries; `refine` SKILL.md bump.
- Test-import updates only where a suite imports a moved symbol directly.

### Out of scope

- Any behavior/signature/logic change; renames; new abstractions.
- `consensus-loop.ts` and the command modules (separate plans).
- Changing the refine skill's user-facing contract, SKILL.md content beyond the version bump, or docs.

## Current state

- `consensus-refine.ts` is both a library surface (e.g. `runSequential`, `runWrapperCli` — used by `scripts/smoke-test.mjs`) and the source of the refine skill's generated runtime. The facade must keep every symbol external consumers import (grep for importers before cutting: `grep -rn "consensus-refine" src/ scripts/ tests/ --include='*.ts' --include='*.mjs' -l`).
- Resume/corruption logic is the most self-contained, highest-value cluster to extract first (its test suite is correspondingly focused).

## Implementation steps

### 1. Inventory and cluster map

Enumerate top-level symbols with callers (in-file and external). Group into the seam clusters, adjusted to reality; order leaf-first; record the map in the first commit body. Explicitly list the externally-imported symbols the facade must keep re-exporting.

**Verify:** every symbol assigned exactly once; no mutual cluster dependencies; external-import list complete (cross-check against the grep above).

### 2. Extract cluster by cluster (one commit each)

Move verbatim; re-export from the facade; add the build mapping (+ rewrites/ignore entries); fix direct test imports.

**Verify after every cluster:**

```bash
pnpm run type-check && pnpm run build && pnpm run build:check && pnpm test -- tests/consensus/refine/ && npm run validate
```

All green before the next extraction; commit before proceeding.

### 3. Final pass

**Verify:** `wc -l src/consensus/refine/consensus-refine.ts` ≤ ~1,200; no new module > ~1,000 lines (targets — justify overruns in the commit body); refine SKILL.md bumped; `pnpm run validate:skill-versions -- --base-ref main` clean.

### 4. Full contract

```bash
pnpm run build && pnpm run build:check && pnpm run type-check && pnpm test && npm run validate && pnpm run smoke
```

**Verify:** all exit 0 (smoke drives `runSequential`/`runWrapperCli` — the direct proof the facade holds); `git status --short` clean of unexplained files.

## Test plan

- No new tests; `tests/consensus/refine/` (resume/corruption/intervention/parallel suites) is the regression net, passing unchanged except import paths.
- `pnpm run smoke` is the end-to-end facade check.
- Per-cluster gate in step 2 is the primary safety mechanism.

## Done criteria

- [ ] `consensus-refine.ts` is orchestration + facade matching the recorded cluster map; externally-imported symbols all still resolve from their original import path.
- [ ] Every commit in the series passes the step-2 gate independently.
- [ ] `refine` SKILL.md bumped; full contract including `smoke` passes; `validate:skill-versions` clean.

## STOP conditions

- Mutual cluster dependencies breakable only by changing (not moving) code — report the seam.
- Smoke or any refine suite fails in a way that implicates behavior (not imports) — revert the offending extraction and report.
- The helper-consolidation plan is queued but not landed — pause; do not race the same file.
- Any verification gate fails twice on one cluster after one bounded correction.

## Review focus

- `git diff --color-moved` per extraction — non-move edits are scope violations.
- The facade's re-export completeness against the step-1 external-import list.
- Deferred intentionally: internal redesign; direct-submodule imports by consumers; applying the same treatment to `consensus-panel.ts` (~1,430 lines — below the pain threshold today).
