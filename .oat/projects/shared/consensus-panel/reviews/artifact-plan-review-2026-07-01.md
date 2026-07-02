---
oat_generated: true
oat_generated_at: 2026-07-01
oat_review_scope: plan
oat_review_type: artifact
oat_review_invocation: manual
oat_project: .oat/projects/shared/consensus-panel
---

# Artifact Review: plan

**Reviewed:** 2026-07-01
**Scope:** plan.md (quick-mode artifact review; no spec.md is expected)
**Files reviewed:** 3 (plan.md, discovery.md, design.md) plus targeted repo verification
**Commits:** N/A (artifact review)

## Summary

The plan is executable and well-structured: 5 sequential phases / 14 tasks, each with
concrete file lists, TDD Step 1→Commit sequences, and runnable verification commands
that match this repo's real script surface (`build`, `build:check`, `type-check`,
`test`, `validate`, `smoke`, `validate:skill-versions`). It fully covers every
discovery success criterion and every design component, and it directly resolves all
three prior design-review findings that were flagged as must-address before planning:
the five-wrapper retrofit with SKILL.md version bumps (I1 → p02-t01/t02/t03), the
in-process resolver consumption with generated `.mjs` build-mappings/import-rewrites
(I2 → p02-t03 + p03-t03), and the deterministic `panel_size` cardinality behavior
(M1 → p01-t01 tests). The `oat_plan_parallel_groups: []` sequential decision is sound
and well-justified (Phase 1 config is a hard dependency of Phases 2–3, and Phases 2–3
both mutate `scripts/build-generated.mjs` and overlapping structural tests). No Critical
or Important gaps. The remaining findings are Medium verification-hardening / minor
design-coverage items, none of which block starting p01. Verdict: ready-with-fixes.

## Findings

### Critical

None.

### Important

None.

### Medium

- **Design's `consensus config list` subcommand has no plan task** (`plan.md:101-147`, cf. `design.md:295`)
  - Issue: The design's Provider CLI Config Commands interface and API section specify
    four subcommands — `get`, `set`, `clear`, and `list` (`consensus config list --json`,
    `design.md:295`). Task p01-t02's test coverage and implementation only enumerate
    `get`, `set`, and `clear` (`plan.md:118-123`); `list` is neither implemented, tested,
    nor explicitly deferred/merged. Per the design-coverage check, this is a design
    element with no corresponding task.
  - Fix: Either add `list` to p01-t02's parser/help/dispatcher and its test list, or
    record in p01-t02 (and reconcile design) that `list` is dropped for v1 because
    `get --scope effective` covers the viewing need. Do not leave it silently unimplemented.

- **p02-t03 regenerates convergence wrappers with a new config-sibling import but never executes them or asserts the rewrite** (`plan.md:284-311`)
  - Issue: p02-t03 adds a `./consensus-config.mjs` sibling and an import rewrite from
    `../config/consensus-config.js` for each of the five convergence wrappers, but its
    only verification is `pnpm run build`, `build:check`, and `validate` (`plan.md:303`).
    `build:check` is a byte-for-byte compare of freshly-built vs committed output — it
    does NOT validate that the rewritten import resolves at runtime. A forgotten or
    mis-declared rewrite that leaves `../config/consensus-config.js` in the generated
    `.mjs` would pass `build:check` yet fail at plugin runtime (there is no `../config/`
    directory beside the generated scripts). The one existing guard,
    `tests/consensus/generated-refine-import.test.ts`, only asserts
    `not.toContain('../core/')` and would not catch a stray `../config/` path. The panel
    wrapper is protected because p03-t03 runtime-invokes it via `--help` (`plan.md:430`),
    but the five convergence wrappers get no equivalent runtime execution until p05 smoke.
  - Fix: In p02-t03, add a generated-import assertion (mirroring
    `generated-refine-import.test.ts`) that the wrapper `.mjs` files contain
    `from './consensus-config.mjs'` and do NOT contain `'../config/'`, and run the
    generated-import / `tests/tooling/generated-output-sync.test.ts` vitest tests as part
    of the task's verification rather than deferring runtime-resolution checks to p05.

- **No isolation guarantee for pre-existing wrapper tests / smoke against machine-local config** (`plan.md:181-225`, `plan.md:585`)
  - Issue: Integrating `resolveConsensusComposition` into the five shipped convergence
    wrappers means every invocation now consults machine-local
    (`~/.config/consensus/config.json`) and project (`.consensus/config.json`) config.
    The plan isolates the NEW p02 tests via temp `HOME`/`XDG_CONFIG_HOME`/cwd (correct),
    but it does not add a task/verification ensuring the pre-existing wrapper tests and
    the `pnpm run smoke` harness (`plan.md:585`) stay deterministic on a developer machine
    that happens to have real consensus config present. Discovery makes contract
    preservation a hard constraint ("config work must not accidentally break their
    existing contracts", `discovery.md:189-191`). CI is unaffected (no config present),
    but a locally-configured machine could see non-deterministic full-suite/smoke results.
  - Fix: Ensure the wrapper resolver integration reads config through an injectable
    `env`/`cwd` seam that the existing wrapper tests and the smoke harness can pin to an
    empty/temp source, and add a note (or targeted assertion) in p02-t01/t02 or p05-t01
    that config-source is neutralized in those harnesses so behavior is machine-independent.

### Minor

- **Reviews table pre-marks the plan review as passed before this review exists** (`plan.md:653`, `state.md:30`)
  - Issue: The Reviews table already shows `plan | artifact | passed | 2026-07-02 | inline
    artifact review`, and `state.md`/`plan.md` frontmatter carry `2026-07-02` dates, both
    ahead of this review's date (2026-07-01) and asserting a "passed" plan review that has
    not yet been received/dispositioned.
  - Suggestion: Reconcile the Reviews row and dates through `oat-project-review-receive`
    after this review lands, rather than leaving a self-declared "passed" state.

- **p02-t03 lists a conditional `scripts/bump-version.mjs` edit that belongs to p04-t01** (`plan.md:281-282`)
  - Issue: p02-t03's file list includes "`scripts/bump-version.mjs` only if the new panel
    skill needs to be registered later in Phase 4." The five convergence skills are already
    in `SKILL_FILES`, and panel registration is correctly handled in p04-t01 (`plan.md:450`).
    The conditional line is redundant/confusing for p02-t03 and invites an unnecessary edit.
  - Suggestion: Drop the `bump-version.mjs` line from p02-t03; keep panel registration solely
    in p04-t01.

- **Intermediate commits in Phase 2 intentionally leave generated output stale** (`plan.md:216-224`, `plan.md:258-266`)
  - Issue: p02-t01 and p02-t02 commit TS wrapper changes but only run `type-check` + targeted
    vitest; regeneration is deferred to p02-t03. Between those commits, `pnpm run build:check`
    and `tests/tooling/generated-output-sync.test.ts` would fail. This mirrors the established
    p01-t02 → p01-t03 model and is fine for PR-at-HEAD CI, but any per-commit gate would flag
    the mid-phase commits.
  - Suggestion: Keep the pattern (it matches repo convention), but note the transient stale
    window explicitly in p02-t01/t02 the way p01-t02 already does (`plan.md:139-141`).

- **p05-t01 commit step is unconditional and fails when there is no drift** (`plan.md:596-601`)
  - Issue: p05-t01 Step 2 fixes "only drift caused by this project," but Step 3 runs
    `git add ... && git commit` unconditionally. In the ideal case where all gates pass with
    no drift, nothing is staged and `git commit` errors with "nothing to commit."
  - Suggestion: Make the p05-t01 commit conditional on drift having actually been fixed (skip
    the commit when the tree is already clean).

## Requirements/Design Alignment

**Evidence sources used:** `plan.md` (under review), `discovery.md` and `design.md`
(upstream dependencies), `state.md` and `implementation.md` (phase context), and the prior
design review at `reviews/archived/artifact-design-review-2026-07-01.md`. No `spec.md`
(expected in quick mode). Repo verification: `scripts/build-generated.mjs`,
`scripts/bump-version.mjs`, `scripts/validate-skill-versions.mjs`, `scripts/validate.mjs`,
`src/consensus/provider-cli/args.ts`, `src/consensus/refine/consensus-refine.ts`,
`tests/consensus/generated-refine-import.test.ts`, and the `plugins/consensus/skills/*`,
`tests/consensus/*`, `tests/repo/*`, `documentation/docs/user-guide/consensus/*` layouts.

### Requirements Coverage — Discovery Success Criteria

| Requirement (discovery) | Plan task(s) | Status | Notes |
| ----------------------- | ------------ | ------ | ----- |
| CLI view/set/clear default config (composition + panel size) | p01-t02, p01-t03 | partial | `get`/`set`/`clear` covered; design's `list` subcommand not implemented/deferred (Medium) |
| Defaults persisted user/project + documented precedence | p01-t01 | covered | Precedence + XDG/user/project paths + atomic writes tested |
| Existing wrappers consume defaults; explicit flags win | p02-t01, p02-t02, p02-t03 | covered | All 5 wrappers; no-config-preserves-order + explicit-wins + no-leak tests |
| Defaults validated vs inventory/preflight; clear warnings/refusal | p01-t01, p02-t01/t02 | covered | Resolver validation + fail-closed on explicit-unavailable; determinism caveat (Medium) |
| Shipped panel skill: wrapper/schema/guidance/examples/manifests/docs/tests | p03-t01/t02/t03, p04-t01/t02/t03 | covered | Full distribution surface |
| Panel dispatches 2+, presents every response, surfaces shortfall | p03-t02 | covered | One turn per usable panelist; ≥2 → passed; <2 → non-zero + failed artifact |
| Panel artifact: question/composition/responses/diagnostics/shortfalls/metadata | p03-t01, p03-t02 | covered | Renderer + schema tests |
| Docs position panel vs refine/evaluate/phone-a-friend | p04-t01, p04-t02, p04-t03 | covered | Skill contrast + docs + manifests |
| Tests: precedence/validation/invocation/rendering/docs-manifest/generated-sync/structural | p01–p04 | covered | Generated-wrapper runtime not executed for convergence wrappers (Medium) |

### Requirements Coverage — Design Components

| Design component | Plan task(s) | Status | Notes |
| ---------------- | ------------ | ------ | ----- |
| Config store (paths, atomic writes, clear keys incl. `roles`) | p01-t01 | covered | Clear key set `peers\|panelists\|panel-size\|roles\|all` |
| Config resolver (precedence, workflow-specific views, `panel_size` cardinality) | p01-t01 | covered | First-N + inventory-order expansion tests (resolves design M1) |
| Provider CLI config commands | p01-t02, p01-t03 | partial | `list` subcommand missing (Medium); in-process (no self-shell-out) is stated |
| Convergence wrapper integration (create/decide/plan/refine/evaluate) | p02-t01, p02-t02, p02-t03 | covered | Resolves design I1; version bumps for all 5 in p02-t03 |
| Panel wrapper (parser/prompt/schema/exec/shortfall/render) | p03-t01, p03-t02, p03-t03 | covered | Independent single-round; no cross-talk |
| Panel skill (neutral moderation, multi-round deferral) | p04-t01 | covered | Registered in bump-version SKILL_FILES |
| Docs/manifests/generated runtime | p01-t03, p02-t03, p03-t03, p04-t02, p04-t03 | covered | Resolves design I2 (config sibling `.mjs` mappings + import rewrites) |
| Data models (DefaultsConfig, AgentRef, ResolvedComposition, PanelResponsePayload, PanelArtifact) | p01-t01, p03-t01 | covered | Panel schema JSON with additionalProperties parity |
| Reserved `roles.advisor` (config-only, not live v1 workflow) | p01-t01 | covered | Test: accepted/cleared but not returned by live resolver (resolves design M2) |
| Error codes (EMPTY_QUESTION, PANEL_TOO_SMALL, PANELIST_UNAVAILABLE, SCHEMA, WRITE_FAILED) | p03-t01, p03-t02 | covered | Implicit in question/panel-size/shortfall/schema/write tests |

### Prior Design-Review Findings — Resolution in Plan

| Design-review finding | Plan resolution | Status |
| --------------------- | --------------- | ------ |
| I1 — five-wrapper retrofit + SKILL.md version bumps | p02-t01 (create/decide/plan), p02-t02 (refine/evaluate), p02-t03 (regenerate + bump all 5) | covered |
| I2 — in-process resolver + generated `.mjs` mappings/import-rewrites | p02-t03 Step 1 (config siblings + rewrites for 5 wrappers), p03-t03 (panel config sibling) | covered |
| M1 — `panel_size` vs `panelists` cardinality | p01-t01 tests: first-N selection + inventory-order expansion + <2 fail-closed | covered |

### Repo-Fit / Build-Contract Adherence

- Dependency-free runtime: p01-t01/p03-t01 explicitly require dependency-free config and
  panel modules (`plan.md:80-84`, `plan.md:341-344`). Compliant.
- Canonical TS → generated `.mjs`: source-then-regenerate ordering is correct per phase
  (p01-t02→t03, p02-t01/t02→t03, p03-t01/t02→t03), matching the `build-generated.mjs`
  model. No hand-edited `.mjs`. Compliant.
- Per-skill version bumps: p02-t03 bumps the 5 changed convergence skills and runs
  `validate:skill-versions`; the new panel skill is correctly exempt from the bump gate
  (verified: `validate-skill-versions.mjs:180-186` skips skills new at the base ref) and is
  registered in `bump-version.mjs` SKILL_FILES via p04-t01. Compliant.
- `type-check` / `validate` / `smoke` targets all exist in `package.json` scripts. Compliant.
- p03/p04 skill-directory split is safe: `discoverSkillDirectories` (validate.mjs:62-83) only
  treats a directory as a skill once it contains `SKILL.md`, so the panel dir holding only
  `schemas/`+`scripts/` between p03 and p04 will not fail `pnpm run validate`. Verified.

### Extra Work (not in declared requirements)

None. The plan stays within the two backlog items; multi-round panel work is correctly
deferred to `BL-260701-add-multi-round-panel` (`plan.md:472`, `plan.md:682`), matching
discovery Out of Scope.

## Verification Commands

Run these to reproduce the finding evidence and to confirm the plan's declared gates are real:

```bash
# Confirm provider CLI has no `config` command kind yet (p01-t02 must add it)
grep -nE "kind: 'config'|command === 'config'" \
  /Users/tstang/Code/feat-consensus-panel/src/consensus/provider-cli/args.ts

# Confirm the existing generated-import test would NOT catch a stray ../config/ import (Medium 2)
sed -n '1,20p' /Users/tstang/Code/feat-consensus-panel/tests/consensus/generated-refine-import.test.ts

# Confirm new skills are exempt from the version-bump gate (panel skill safe)
sed -n '178,190p' /Users/tstang/Code/feat-consensus-panel/scripts/validate-skill-versions.mjs

# Confirm skill discovery requires SKILL.md (p03/p04 split is safe)
sed -n '62,83p' /Users/tstang/Code/feat-consensus-panel/scripts/validate.mjs

# Plan-declared gates (post-implementation)
pnpm run build && pnpm run build:check && pnpm run type-check
pnpm run test && pnpm run validate && pnpm run smoke
pnpm run validate:skill-versions -- --base-ref origin/main
```

## Readiness Verdict

**ready-with-fixes.** No Critical or Important gaps; the plan is safe to hand to
`oat-project-implement` starting at p01-t01 today. The three Medium findings do not block
Phase 1: resolve M1 (`config list` decision) within p01-t02, and address M2 (generated
convergence-wrapper runtime/import assertion) and M3 (config-source isolation for existing
tests/smoke) within Phase 2. The Minor items are bookkeeping/robustness cleanups.

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert these findings into plan tasks (or
targeted edits to p01-t02 / p02-t03 / p05-t01) and to reconcile the self-declared `plan`
Reviews-table row and dates.
