---
oat_generated: true
oat_generated_at: 2026-06-17
oat_review_scope: plan
oat_review_type: artifact
oat_review_invocation: manual
oat_project: /Users/tstang/Code/session-observer-ts/.oat/projects/shared/session-observer-ts-migration
---

# Artifact Review: plan

**Reviewed:** 2026-06-17
**Scope:** `plan.md` (quick mode, artifact review)
**Files reviewed:** 2 (plan.md, discovery.md; implementation.md read for drift context)
**Commits:** N/A (artifact review)

## Summary

The plan is implementation-ready, well-scoped, and cleanly aligned with `discovery.md`. All ten tasks map to discovery goals, the migration task set covers exactly the nine existing session-observer `.test.mjs` files, verification commands reference real `package.json` scripts, and the `probe-local` exit-code assertions match the actual shipped runtime (`0`/`2`/`3`). Findings are minor: a self-contradictory sentence in p02-t04's file list, a Reviews-table entry that pre-asserts this review as `passed`, and one small documentation-precision nit. No Critical or Important issues. Implementation has not started (0/10 tasks), so no artifact-drift findings apply.

## Findings

### Critical

None

### Important

None

### Medium

None

### Minor

- **Self-contradictory wording in p02-t04 file list** (`plan.md:324`)
  - Issue: The line reads "Modify if needed: `package.json` only if session-observer-specific test targeting requires no script changes." The phrase "requires no script changes" contradicts listing `package.json` as a modify target. The intent (confirmed against `package.json`: `test:node` globs `tests/**/*.test.mjs` and `test` runs both runners) is that **no** `package.json` change should be needed, and the mixed-runner contract must be preserved.
  - Suggestion: Reword to "Do not modify `package.json` test scripts; the `test:node`/`test:vitest` mixed-runner contract must remain intact. Only touch `package.json` if a session-observer-specific issue genuinely requires it, and justify the change." This also keeps the file from appearing in the commit `git add` (line 351) when nothing changed.

- **Reviews table pre-asserts this artifact review as `passed`** (`plan.md:509`)
  - Issue: The `plan` / `artifact` row is already marked `passed` / `2026-06-17` with artifact "inline structured review clean" before the current standalone artifact review completes. If this review surfaced blocking findings the row would be stale; pre-marking `passed` risks masking a later re-review.
  - Suggestion: Acceptable if "inline structured review" refers to an earlier distinct pass, but consider adding the resulting review artifact path (this file) to the Artifact column after receive, rather than leaving a generic "inline structured review clean" note. No row should be deleted — append/update only.

- **`sync:transcript-core` is described as a wrapper but not referenced in any task** (`plan.md:25,537`; discovery.md:23)
  - Issue: Discovery notes `pnpm run sync:transcript-core` remains a compatibility wrapper around `scripts/build-generated.mjs`. The plan modifies `scripts/build-generated.mjs` (p01-t02) but never verifies the wrapper still delegates correctly after the mapping change. The wrapper is generic (delegates all args), so this is low-risk, but a one-line verification note would close the loop.
  - Suggestion: Optionally add `pnpm run sync:transcript-core --check` (or note it is covered transitively by `build:check`) to p01-t02 or p04-t01 verification. Not required — `build:check` already exercises the same code path.

## Requirements/Design Alignment

**Evidence sources used:** `plan.md`, `discovery.md`, `implementation.md` (drift context), plus repository verification of `package.json` scripts, `tests/session-observer/` inventory, `skills/session-observer/scripts/` runtime, `scripts/build-generated.mjs` mappings, and `probe-local.mjs`/`session-observer.mjs` exit codes.

### Requirements Coverage (discovery goals → plan)

| Discovery goal / success criterion | Status | Notes |
| ---------------------------------- | ------ | ----- |
| Canonical source under `src/transcript/session-observer/` | covered | p01-t01 creates all 10 source files matching discovery Target Source Layout exactly |
| Shipped runtime generated from TS and committed | covered | p01-t02 extends `build-generated.mjs` mappings for all 10 outputs matching discovery Required Generated Output Paths |
| `// GENERATED` banners, `bundle:false`, drift protection preserved | covered | p01-t02 Step 1/Step 2 + `build:check`; verified `build-generated.mjs` already uses `bundle:false` and `generatedOutputs` derivation |
| All session-observer tests become Vitest `.test.ts` | covered | p02-t01/t02/t03 migrate exactly the 9 existing `.test.mjs` files (digest, locate, observe, rank, state, watch-state, cli, integration, watch) + tmpdir helper |
| No `tests/session-observer/**/*.test.mjs` remain | covered | p02-t04 Step 1 `find ... -name '*.test.mjs'` guard; p04-t01 re-checks |
| Session-observer no longer relies on `node:test` | covered | p02-t01 Step 1 replaces `node:test` imports; p02-t04 retires residue |
| CLI/integration tests still exercise shipped `.mjs` entrypoints | covered | p02-t02 Step 2 keeps `session-observer.mjs`/`probe-local.mjs` invocation |
| transcript-core stays owned by `src/transcript/core/runtimes.ts` | covered | p01-t01 limits edits to "minimal exported types only"; discovery constraint echoed |
| `pnpm test` still runs both runners until PR4 | covered | p02-t04 Step 2 explicitly preserves `test:node`; verified `test` script runs `test:node && test:vitest` |
| Behavior preserved (locate/rank/digest/observe/state/watch-state/watch/CLI/probe-local) | covered | p01-t03 parity gate runs existing tests against generated output before conversion |
| README/AGENTS/skill docs/OAT references updated | covered | p03-t01 (docs) + p03-t02 (OAT reference/backlog/project-summary) |
| Project summary records PR3 slice + remaining PR4 work | covered | p03-t02 Step 2 |
| Minimum verification suite (build/type-check/build:check/test/validate/smoke) | covered | p04-t01 Step 1 runs all six; all scripts confirmed present in `package.json` |
| Watcher determinism without redesign | covered | p02-t03 Step 2 prefers deterministic controls, avoids broad redesign (matches Out-of-Scope) |

**Constraint adherence:** All discovery constraints are respected — no consensus-evaluate work, no transcript-core re-migration (types only), no `test:node` removal, no `pnpm test` simplification (deferred to PR4), no runtime deps, no hand-editing generated banners.

### Extra Work (not in declared requirements)

None. p01-t02's edits to `.oxfmtrc.json`/`.oxlintrc.json` are justified by the existing convention that generated `.mjs` outputs must be excluded from lint/format guards (CLAUDE.md repository conventions), so they are in-scope supporting work, not scope creep.

## Internal Consistency

- Task IDs `pNN-tNN` are monotonic within each phase (p01-t01..t03, p02-t01..t04, p03-t01..t02, p04-t01). No reused/skipped IDs.
- Phase ordering is sound and dependency-correct: source → generated output → parity gate → test migration → docs → final verification.
- Parallelism section correctly declares no parallel groups with a defensible rationale (shared fragile runtime boundary); `oat_plan_parallel_groups: []` and `oat_plan_hill_phases: []` frontmatter match.
- Verification commands reference only real scripts: `type-check`, `build`, `build:check`, `test`, `test:node`, `test:vitest`, `validate`, `smoke` all exist in `package.json`.
- `probe-local` exit-code assertion (`0`/`2`/`3` accepted, `1` excluded) is accurate: verified `observe.mjs` returns `exitCode:2` (noMatch), `3` (other non-hard kind), `1` (hard error); `probe-local.mjs` propagates the CLI status.
- Required canonical sections present: Reviews table, Implementation Complete, References. No placeholder-only critical content.
- No `## Dispatch Profile` section — correct for this plan; not flagged.

## Verification Commands

Run these to re-confirm the facts this review relied on:

```bash
# Confirm the 9 session-observer test files the plan migrates
ls -1 tests/session-observer/*.test.mjs

# Confirm all verification scripts the plan invokes exist
node -e "const s=require('./package.json').scripts; ['build','build:check','type-check','test','test:node','test:vitest','validate','smoke'].forEach(k=>console.log(k, k in s))"

# Confirm tmpdir helper consumers are limited to migrated tasks
grep -rn "helpers/tmpdir" tests/

# Confirm probe-local exit codes referenced by the plan
grep -n "exitCode: [0-9]" skills/session-observer/scripts/lib/observe.mjs
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert findings into plan tasks. All findings are Minor; receiving them is optional and none block `oat-project-implement`.
