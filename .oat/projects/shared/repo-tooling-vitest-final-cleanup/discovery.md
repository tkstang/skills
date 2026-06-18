---
oat_status: complete
oat_ready_for: oat-project-quick-start
oat_blockers: []
oat_last_updated: 2026-06-18
oat_generated: false
---

# Discovery: repo-tooling-vitest-final-cleanup

## Phase Guardrails (Discovery)

Discovery is for requirements and decisions, not implementation details. Implementation is **gated** behind PR3 landing (see Constraints and the hard first plan task).

## Initial Request

PR4 of the TypeScript/Vitest migration in `tkstang/skills`. Finish the test-runner cleanup once PR3 (session-observer migration) lands:

- Convert the remaining repo/tooling `.test.mjs` files to Vitest `.test.ts`.
- Remove the `node:test` compatibility runner (`test:node`) once every suite is on Vitest.
- Simplify `pnpm test` to a Vitest-only invocation.
- Add a guard that prevents new `node:test` tests (or new `tests/**/*.test.mjs`) from re-entering the repo.
- Preserve all existing behavioral coverage; do not change subprocess or filesystem fixture behavior.
- **Harmonize the assertion convention repo-wide:** convert the 9 session-observer suites (which PR3 left on `node:assert/strict`) to Vitest `expect`, so every `tests/**` suite uses one style; the guard also forbids new `node:assert` imports in tests. _(Added during planning after reviewing PR3's implementation.)_

**Hard gate:** Do discovery/design/plan only now. Do not implement until (1) PR3 lands on `main`, (2) the branch is rebased onto latest `main`, (3) discovery is re-run against the actual post-PR3 layout, and (4) the plan is reconciled if PR3 changed assumptions.

## PR Sequence Context

- **PR1** — consensus migration: landed.
- **PR2** — transcript-core + export-session: landed on `main` as PR #15 (`f548ebe`).
- **PR3** — session-observer migration: **in flight, not landed.** Project artifacts at `/Users/tstang/Code/session-observer-ts/.oat/projects/shared/session-observer-ts-migration` (`oat_phase: implement`, `in_progress`).
- **PR4** — this project: repo/tooling tests + final test-runner cleanup.

## Repository State Verified (this branch, post-PR2)

`package.json` scripts today:

- `test`: `pnpm run test:node && pnpm run test:vitest`
- `test:node`: `node --test $(find tests -name '*.test.mjs' ! -name 'generated-output-sync.test.mjs' -type f | sort)`
- `test:vitest`: `node scripts/run-vitest.mjs` (spawns `vitest run`)

`vitest.config.mjs` `include`: `tests/**/*.test.ts`, `tests/**/*.test.mts`, and the special-cased `tests/generated-output-sync.test.mjs`.

`node:test` is imported **only** by test files and documented in `tests/AGENTS.md`. No file under `scripts/` or `tools/` imports `node:test` — the runner removal has no production-tooling dependency.

## Test File Catalog (classification)

### PR3-owned — session-observer (NOT this project's scope)

Converted to `.test.ts` and deleted as `.mjs` by PR3 (verified in PR3 `plan.md`: a phase converts all 9 files, and a final step deletes remaining `tests/session-observer/**/*.test.mjs`):

`cli`, `digest`, `integration`, `locate`, `observe`, `rank`, `state`, `watch-state`, `watch` (all under `tests/session-observer/`).

### PR4-owned — repo/tooling (this project's scope, 13 files)

- `tests/docs-presence.test.mjs`
- `tests/generated-output-sync.test.mjs` — already imports Vitest but is `.mjs` and special-cased in `vitest.config.mjs`; PR4 renames to `.ts` and drops the special include.
- `tests/host-dispatch-docs.test.mjs`
- `tests/install-paseo.test.mjs`
- `tests/marketplace-manifests.test.mjs`
- `tests/package-metadata.test.mjs`
- `tests/plugin-manifests.test.mjs`
- `tests/readme-scope.test.mjs`
- `tests/release-versioning.test.mjs`
- `tests/repo-layout.test.mjs`
- `tests/skill-frontmatter.test.mjs`
- `tests/smoke-test-script.test.mjs`
- `tests/validate-script.test.mjs`

### Unexpected / needs decision

None at discovery time. The catalog matches the brief exactly. The post-PR3 refresh task must re-run the catalog and flag any drift (e.g. a leftover `tests/session-observer/**/*.test.mjs`, which would **block** removing `test:node`).

## Solution Space

Well-understood request; the approach is dictated by the established PR1–PR3 migration pattern (rename `.test.mjs` → `.test.ts`, swap `node:test`/`node:assert/strict` for Vitest `describe`/`it`/`expect`, keep subprocess + fixture behavior identical). The only genuinely open decision is the guard mechanism.

### Guard strategy — Options Considered

**Option A (recommended): Vitest meta-test under `tests/tooling/`.**
A deterministic `tests/tooling/*.test.ts` that (1) globs `tests/**/*.test.mjs` and asserts the set is empty except an explicit documented allowlist, and (2) scans `tests/**/*` test sources for `node:test` imports and asserts none. Runs as part of `pnpm test`, fits the existing `tests/tooling/vitest-config.test.ts` convention, self-contained, no script wiring.

**Option B: check inside `scripts/validate.mjs`.**
Runs under `pnpm validate` / `premerge`. Centralizes repo invariants but is farther from the test suite and mixes test-runner policy into structural validation.

**Chosen direction:** Option A — Vitest meta-test. Rationale: lives with the tests it governs, runs in the same `pnpm test` developers already run, and follows the existing `tests/tooling/` precedent. Confirmed at the requirements gate.

## Key Decisions

1. **Scope boundary:** PR4 touches repo/tooling test files, the 9 session-observer test files (assertion harmonization only), `package.json` test scripts, `vitest.config.mjs`, the new guard, and docs/reference. No runtime/source code, no session-observer/consensus/transcript *implementation*, no feature behavior. (Session-observer *test* files are in scope for the `node:assert`→`expect` swap only — not their `.test.ts` structure or the code under test.)
2. **`generated-output-sync.test.mjs`:** convert to `.ts` and remove its special-case entry from `vitest.config.mjs` so the standard `tests/**/*.test.ts` glob covers it.
3. **Runner retirement ordering:** remove `test:node` and simplify `test` to Vitest-only **only after** zero `.test.mjs` / `node:test` tests remain (verified by recatalog).
4. **Guard:** Option A Vitest meta-test.
5. **Coverage preservation:** rename-in-place; replace `node:assert/strict` with Vitest `expect` where practical; keep subprocess spawns and `mkdtemp` fixture behavior byte-for-byte equivalent.

## Constraints

- **Implementation is gated:** no edits until PR3 lands on `main`, the branch is rebased, and discovery is re-catalogued against the real post-PR3 tree.
- Node >= 22; shipped skills stay dependency-free (this is test/dev tooling only — unaffected).
- Generated `.mjs` runtime outputs must not be hand-edited; `generated-output-sync.test.mjs` is a test, not a generated output, so renaming it is allowed.
- Do not run repo-wide `oxfmt`; lint/format only the files this PR changes.
- Leave `tests/session-observer/**` to PR3; if any `.test.mjs` survives there post-PR3, that blocks `test:node` removal.

## Success Criteria

- No repo test imports `node:test`.
- No repo test imports `node:assert` — every `tests/**` suite asserts via Vitest `expect`.
- No `tests/**/*.test.mjs` remain (except an explicitly justified + guarded allowlist; expected to be empty).
- `package.json` has no `test:node`; `test` runs Vitest only.
- All prior behavioral coverage preserved (subprocess + fixture behavior unchanged).
- Guard fails CI when a new `node:test` import or `.test.mjs` test file is added.
- PR3 session-observer migration fully accounted for before implementation begins.
- Full verification passes: `build`, `type-check`, `build:check`, `test`, `validate`, `smoke`, `lint`, `format:check`.

## Out of Scope

- Migrating runtime source, session-observer implementation, consensus-evaluate, or any feature behavior.
- Repo-wide formatting sweep.
- Re-architecting `scripts/run-vitest.mjs` beyond what Vitest-only `test` requires.

## Assumptions — reconciled against PR3's *actual* implementation (2026-06-17)

Cross-checked against the `session-observer-ts` worktree diff (`origin/main...HEAD`), i.e. PR3's committed code, not just its plan:

- ✅ PR3 converts all 9 session-observer suites to `.test.ts` and deletes the `.mjs` originals — **confirmed in the diff** (renames + `test(p02): retire session-observer node-test files`).
- ✅ PR3 does **not** modify `package.json` — **confirmed** (not in diff); the mixed runner is intact for PR4 to retire.
- ✅ PR3 does **not** modify `vitest.config.mjs` — **confirmed** (not in diff); the `generated-output-sync` special-case include remains for PR4 to remove.
- 🔄 `tests/AGENTS.md` — **CORRECTED on merged main:** PR3 (#17) **did** rewrite it (the earlier pre-merge worktree diff was stale). It now documents the **mixed-runner interim contract** with explicit "do not remove `test:node` until the remaining legacy suites are migrated" guidance. PR4's p04-t01 is still required but now *completes* the migration this doc anticipates (flips the guidance to final Vitest-only) rather than rewriting a stale node:test-primary doc.
- ⚠️ PR3 **modified** `tests/generated-output-sync.test.mjs` (+~87 lines for session-observer mappings) — PR4 converts the *post-PR3* version. Re-confirm at the gate.
- ⚠️ PR3 already edited root `AGENTS.md`, `README.md`, `current-state.md`, `roadmap.md`, backlog — PR4 docs layer on top, not restate.
- After PR3, the only remaining `.test.mjs` are the 13 repo/tooling files above (still must re-confirm none stray in post-rebase tree).

### New findings from the PR3 implementation review (folded into the plan)

- **Shared helper `tests/helpers/process.mjs`** (typed via `tests/helpers/process.d.mts`) is imported by `smoke-test-script` and already by `tests/parallel-integration.test.ts` — proving a `.test.ts` can import this `.mjs` helper via its `.d.mts` shim. **Decision:** keep the helper as `.mjs` (the guard only targets `*.test.mjs`); converting `smoke-test-script.test.ts` leaves the import unchanged. No new helper-conversion work.
- **Assertion convention:** existing `.test.ts` are unanimous — 0 use `node:assert`, 45 use Vitest `expect`. PR4 uses `expect` (matches brief + dominant convention). PR3 kept `node:assert/strict` in session-observer suites, creating a transient two-style split; **PR4 now harmonizes those 9 suites to `expect`** (p02-t04/t05) and the guard forbids new `node:assert` imports. _(Originally scoped out; pulled in by user direction after the PR3 implementation review — "final cleanup should own this.")_
- **Module-specifier convention:** PR3 imports TS source with `.js` specifiers (e.g. `../../src/.../state.js`) and helpers as `./helpers/x.js`. Repo/tooling tests import real `.mjs` runtime/scripts, which stay `.mjs` — no specifier rewrites needed there.

## Risks

- **PR3 scope drift:** PR3 lands differently than its plan (e.g. touches `package.json` or leaves a `.mjs`).
  - Likelihood: Low · Impact: Medium · Mitigation: hard first plan task re-catalogs and reconciles before any edit.
- **Hidden `node:test`-only semantics:** a tooling test relies on `node:test` behavior (e.g. subtests, `t.after`) that doesn't map cleanly to Vitest.
  - Likelihood: Low · Impact: Low · Mitigation: per-file conversion verified by running the converted suite under Vitest before commit.
- **Guard false-positives:** guard flags a legitimate non-test `.mjs` or a doc snippet mentioning `node:test`.
  - Likelihood: Low · Impact: Low · Mitigation: scope guard to `*.test.mjs` glob and to actual import statements in test sources, with a documented allowlist.

## Docs / Reference Updates (planned)

- `tests/AGENTS.md` — rewrite "how tests are written today" to Vitest-only.
- Root `AGENTS.md` / `README.md` test guidance — reconcile with whatever PR3 already changed; ensure no stale `test:node` references.
- `.oat/repo/reference/current-state.md` — drop "remaining Node `node:test` files" language; state the suite is Vitest-only.
- `.oat/repo/reference/backlog/` — progress note on `adopt-typescript-vitest-build-toolchain` (TS/Vitest initiative) marking the runner-retirement milestone done.
- Project `summary.md` at closeout.

## Open Questions

- None blocking. Guard placement resolved to Option A (Vitest meta-test) at the requirements gate.

## Next Steps

Quick mode → straight to plan. Generate `plan.md` whose **first task is the post-PR3 gate**: confirm PR3 merged to `main`, rebase, recatalog `.test.mjs`, and reconcile assumptions before any conversion edit.
