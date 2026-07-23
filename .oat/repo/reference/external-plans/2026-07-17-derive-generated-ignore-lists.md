---
oat_generated: true
oat_external_plan: true
oat_external_plan_source: repo-audit
oat_external_plan_sources:
  - 'repo-audit: full repository (excl. .agents/, .claude/, .codex/, .cursor/)'
oat_external_plan_commit: '8309623'
oat_backlog_items:
  - BL-260718-guard-generated-ignore-lists
oat_issue_url: null
created: '2026-07-17T23:39:00Z'
---

# Guard the lint/format ignore lists and derive build import-rewrites from one source of truth

> [!NOTE]
> This is an external implementation plan, not a canonical OAT project
> `plan.md`. Execute it directly, or import it for tracked OAT execution with
> `oat-project-import-plan <this-file>`.
>
> Begin with the drift check. Follow the steps and verification gates in order.
> If a STOP condition occurs, stop and report instead of improvising.

## Outcome

The `generatedOutputs` array in `scripts/build-generated.mjs` becomes the enforced single source of truth for generated-output exclusions: a tooling test fails whenever `.oxfmtrc.json` or `.oxlintrc.json` `ignorePatterns` misses a generated output path (today the two JSON lists are hand-synced — currently in sync, verified — with nothing preventing the next generated-output addition from lagging). Additionally, `build-generated.mjs` derives each entry's `importRewrites` from the source file's actual import statements instead of hand-transcribed per-entry lists, shrinking the O(imports × outputs) maintenance surface AGENTS.md itself flags.

## Source and live evidence

- Source artifact or scope: repo-audit reconnaissance (architecture + deps/DX lanes), full repository
- Planned at: commit `8309623` on `2026-07-17`
- Related backlog items: none
- Verified evidence (read live at planning time):
  - `scripts/build-generated.mjs:15-237` — `generatedOutputs` (28 entries) with hand-written per-entry `importRewrites` arrays (e.g. the session-observer-watch entry enumerates every sibling import).
  - `.oxfmtrc.json` / `.oxlintrc.json` — each hardcodes the same ~28 generated paths in `ignorePatterns`; the deps/DX lane verified all 28 outputs are currently present in both.
  - `.lintstagedrc.mjs:17-21` — already does it right: `import { generatedOutputs } from './scripts/build-generated.mjs'` and maps `mapping.output` (verified live).
  - CI (`.github/workflows/validate.yml` lint job) derives exclusions via `node scripts/build-generated.mjs --list-outputs` (deps/DX lane; confirm flag exists in step 1).
  - AGENTS.md documents the multi-file sync burden explicitly (lint/format section).

## Drift check

```bash
git diff --stat 8309623..HEAD -- scripts/build-generated.mjs .oxfmtrc.json .oxlintrc.json .lintstagedrc.mjs tests/tooling/
```

If `generatedOutputs` entries changed, re-check both JSON ignore lists against the live output set before assuming they are in sync.

## Repository conventions

- Build: `pnpm run build`; sync: `pnpm run build:check`; Test: `pnpm test`; Validate: `npm run validate`
- Lint config files themselves are plain JSON consumed by oxlint/oxfmt — they cannot import JS, so the sync must be *enforced by test* (or the files generated), not made dynamic in place.
- Tooling tests live under `tests/tooling/` (e.g. `generated-output-sync.test.ts` is the structural pattern).
- Commits: Conventional Commits (`test(tooling): guard generated ignore lists` / `refactor(build): derive import rewrites`). Do not push or open a PR unless instructed.

## Scope

### In scope

- New tooling test asserting `.oxfmtrc.json` and `.oxlintrc.json` `ignorePatterns` each contain every `generatedOutputs[].output` path.
- `scripts/build-generated.mjs`: derive `importRewrites` from parsing each source's import specifiers against the known source→output mapping; remove the hand-written arrays where derivation reproduces them exactly.
- AGENTS.md: soften the "must stay in sync by hand" wording to name the new guard.

### Out of scope

- Generating the JSON config files themselves (bigger contract change; the guard test achieves the safety property).
- Changing which paths are excluded, or formatting any currently-unformatted files.
- `.lintstagedrc.mjs` and the CI lint step — already derived; do not touch.

## Current state

- `generatedOutputs` entries are `{ id, source, output(s), importRewrites? }`-shaped objects (read the actual shape at execution; the lane report paraphrases).
- Import rewrites exist because generated outputs sit in different directories than their sources, so relative specifiers must be rewritten to sibling generated files. Every needed rewrite is thus a function of (a) the source's import specifiers and (b) where each imported source's own output lands for the same consuming skill — both known inside `generatedOutputs`.
- `pnpm run build:check` fails loudly on wrong rewrites, so derivation errors cannot land silently — this makes the refactor safe to verify mechanically.

## Implementation steps

### 1. Confirm surfaces

Read the `generatedOutputs` entry shape, confirm `--list-outputs` exists (`node scripts/build-generated.mjs --list-outputs`), and list which entries carry `importRewrites`.

**Verify:** inventory of rewrite-bearing entries recorded.

### 2. Add the ignore-list guard test

New `tests/tooling/generated-ignore-lists.test.ts`: import `generatedOutputs`, read both JSON configs, assert every output path appears in each `ignorePatterns` (exact string or covered by an existing glob — implement glob-awareness only if the lists actually use globs for these paths; the lane observed literal paths).

**Verify:** `pnpm test -- tests/tooling/generated-ignore-lists.test.ts` → passes; temporarily deleting one entry from `.oxlintrc.json` makes it fail (then restore).

### 3. Derive import rewrites

In `build-generated.mjs`, at build time parse each source file's static import specifiers (regex over `^import ... from '...'` is acceptable for this codebase's uniform style; no new dependencies). For each relative specifier, resolve the imported source file, find its output mapped for the same destination directory, and compute the rewrite. Compare derived vs hand-written rewrites for every entry: where identical, drop the hand-written array; where they differ, STOP (see below).

**Verify:** `pnpm run build && pnpm run build:check` → clean, zero diff in generated outputs (`git status --short` shows no `.mjs` changes).

### 4. Update AGENTS.md and run the contract

Update the lint/format sync sentence to reference the guard test; note import rewrites are now derived. Then:

```bash
pnpm run build && pnpm run build:check && pnpm test && npm run validate
```

**Verify:** all exit 0.

## Test plan

- New guard test (step 2), plus the existing `tests/tooling/generated-output-sync.test.ts` as the regression net for step 3.
- Regression proven: an ignore-list omission is now a red test instead of a latent trap; rewrite derivation is proven byte-equivalent by an unchanged generated tree.
- Focused: `pnpm test -- tests/tooling/`. Full: `pnpm test`.

## Done criteria

- [ ] Guard test fails on any missing generated path in either ignore list.
- [ ] `importRewrites` hand-lists removed where derivation is byte-equivalent; generated outputs unchanged.
- [ ] AGENTS.md reflects the new mechanism; full contract passes; `git status --short` clean of unexplained files.

## STOP conditions

- Derived rewrites differ from hand-written ones for any entry — the hand list encodes an exception the derivation doesn't model; report the entry and keep its hand-written list rather than guessing.
- The JSON ignore lists turn out to rely on glob semantics the guard can't check simply — report; do not ship a guard that passes vacuously.
- Any verification gate fails twice after one bounded correction.

## Review focus

- Step 3's byte-equivalence proof (unchanged generated tree) is the load-bearing safety argument — reviewers should confirm the build diff is empty.
- The import parser's failure mode: unknown specifier → loud build error, never a silent skip.
- Deferred intentionally: generating the JSON configs; deriving other AGENTS.md-listed sync pairs.
