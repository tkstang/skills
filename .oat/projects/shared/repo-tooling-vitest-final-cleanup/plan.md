---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-06-17
oat_phase: plan
oat_phase_status: complete
oat_plan_hill_phases: ['p04'] # pause AFTER the final phase (docs + verification) before PR/closeout; the p01 PR3 gate is already satisfied
oat_auto_review_at_hill_checkpoints: true # from workflow.autoReviewAtHillCheckpoints
oat_plan_parallel_groups: [] # fully sequential — see ## Parallelism
oat_plan_source: quick # spec-driven | quick | imported
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
---

# Implementation Plan: repo-tooling-vitest-final-cleanup

> Execute this plan using `oat-project-implement` — sequential by default, parallel when `oat_plan_parallel_groups` is declared.

**Goal:** Finish the TypeScript/Vitest migration (PR4): convert the remaining repo/tooling `.test.mjs` suites to Vitest `.test.ts`, retire the `node:test` compatibility runner, simplify `pnpm test` to Vitest-only, and add a guard that blocks new `node:test` / `.test.mjs` tests — all while preserving existing behavioral coverage.

**Architecture:** Dev-tooling-only change. Tests move from Node's built-in runner (`node --test`, `node:assert/strict`) to Vitest (`describe`/`it`/`expect`) under the existing `vitest.config.mjs`. Shipped runtime code is untouched.

**Tech Stack:** Node >= 22, Vitest, TypeScript, pnpm, oxlint/oxfmt (dev tooling).

**Commit Convention:** `{type}({scope}): {description}` — e.g. `test(p02-t01): convert manifest tooling suites to Vitest`. Conventional Commits enforced by the `commit-msg` hook.

## Planning Checklist

- [x] Confirmed HiLL checkpoints with user (final phase only — `p04`)
- [x] Set `oat_plan_hill_phases` in frontmatter (`['p04']`)
- [x] Evaluated phases for parallelism opportunities
- [x] Set `oat_plan_parallel_groups` in frontmatter (`[]`)

---

## ⛔ Implementation Gate (read before starting)

**Do not begin Phase 2 until Phase 1 completes.** Implementation is blocked until:

1. PR3 (`session-observer-ts-migration`) is **merged to `main`**.
2. This branch is **rebased onto latest `main`**.
3. The `.test.mjs` catalog is **re-run against the real post-PR3 tree** and reconciled with this plan.
4. Any assumption that PR3 invalidated is updated here before edits.

Phase 1 is the hard gate (PR3 must be merged + rebased + recatalogued before any edit). **This gate is now satisfied** (see reconciliation below). The HiLL checkpoint has been moved to the **final phase only** (`oat_plan_hill_phases: ['p04']`): once Phase 2 is authorized, `oat-project-implement` runs Phases 2–4 through to completion and pauses after Phase 4 (final verification) before PR/closeout.

### Reconciled vs landed PR3 — verified against MERGED `origin/main` (2026-06-18, PR #17 `adbb05b`)

This plan was reconciled against PR3's **merged** implementation (the branch is now rebased onto `origin/main` containing #17). Verified state:

- ✅ **PR3 did not touch `package.json`** — the `test:node`/`test:vitest` mixed runner is intact; PR4 owns its removal (p03-t02). _Confirmed on merged main._
- ✅ **PR3 did not touch `vitest.config.mjs`** — the `generated-output-sync.test.mjs` special-case include is still present; PR4 removes it (p02-t03). _Confirmed on merged main._
- ✅ **All 9 session-observer suites are `.test.ts` and import `node:assert/strict`; zero `tests/session-observer/**/*.test.mjs` remain.** Harmonization scope (p02-t04/t05) is exactly these 9 files — verified the repo-wide `node:assert` `.test.ts` set is precisely this set. _Confirmed on merged main._
- ⚠️ **`generated-output-sync.test.mjs` remains `.mjs` with Vitest imports** (PR3 extended it for session-observer mappings). p02-t03 converts this merged version.
- ⚠️ **PR3 edited `AGENTS.md` (root), `README.md`, `.oat/repo/reference/current-state.md`, `roadmap.md`, backlog** — PR4's p04-t01/p04-t02 *layer onto* PR3's wording, not restate it.
- 🔄 **CORRECTION — PR3 DID rewrite `tests/AGENTS.md`** (earlier pre-merge worktree diff showed it untouched; the merged PR includes the change). It is **no longer** the stale "node:test is primary" doc — it now describes the **mixed-runner interim contract** and explicitly says *"Do not simplify `pnpm test` to Vitest-only or remove `test:node` until the remaining legacy suites are migrated."* PR4's p04-t01 is therefore **still required but refined**: it *completes* the migration this doc anticipates (flip the "don't remove test:node yet" guidance to the final Vitest-only state) rather than rewriting a stale doc. See p04-t01 for the exact edits.
- ✅ **Assertion-style harmonization (IN scope):** PR3 kept `node:assert/strict` in the 9 session-observer suites; the rest of the repo uses `expect`. PR4 harmonizes those 9 to `expect` (p02-t04/t05); the guard (p03-t01) enforces it. _Confirmed: exactly 9 `node:assert` `.test.ts` files, all under `tests/session-observer/`._

**Gate status:** rebase clean, recatalog matches, assumptions reconciled (one corrected). Phase 1 reconciliation is satisfied. The HiLL checkpoint is now configured for the **final phase only** (`p04`); the project is currently awaiting user go-ahead to begin Phase 2, after which Phases 2–4 run through to the single `p04` checkpoint.

---

## Parallelism

**Fully sequential (`oat_plan_parallel_groups: []`).** Reasoning:

- **Phase 1 → everything:** the gate must complete (PR3 merged, rebase, recatalog) before any edit; nothing may run alongside it.
- **Phase 2 → Phase 3:** the runner retirement and the guard depend on *zero* `.test.mjs` remaining. The guard would fail and `test:node` removal would be unsafe if any conversion were still outstanding.
- **Phase 3 → Phase 4:** the docs/reference updates must describe the *final* `package.json` script shape, so they follow runner retirement.
- Within Phase 2 the per-file conversions are file-disjoint, but they share one worktree and one test config; running them as sequential tasks (not parallel worktree phases) avoids worktree overhead with no real wall-clock loss. No fragile shared migration, generated artifact, or cross-phase test dependency justifies declaring parallel groups.

---

## Dispatch Profile

_No per-phase overrides. Runtime selection applies, capped by the resolved OAT dispatch ceiling in `state.md`._

---

## Phase 1: Post-PR3 Gate & Recatalog (HARD FIRST — blocking)

No conversion edits in this phase. This phase reconciles the plan with reality after PR3 lands.

### Task p01-t01: Confirm PR3 merged and rebase onto latest main

**Files:**

- None (git + verification only)

**Step 1: Confirm PR3 landed**

```bash
git fetch origin
# PR3 = session-observer-ts-migration. Confirm its commits are on main:
git log origin/main --oneline | grep -i "session-observer" | head
```

Expected: session-observer TypeScript/Vitest migration commit(s) present on `origin/main`. If absent, **STOP** — the gate is not satisfied; PR3 has not landed.

**Step 2: Rebase this branch onto latest main**

```bash
git rebase origin/main
```

Expected: clean rebase. Resolve any conflicts (most likely in `package.json` test scripts, `vitest.config.mjs`, `tests/AGENTS.md`, or `.oat/repo/reference/*`), preferring the landed PR3 state, then continue.

**Step 3: Verify post-rebase baseline is green**

Run: `pnpm install && pnpm run test`
Expected: full suite passes on the rebased baseline (session-observer now under Vitest; repo/tooling suites still under `test:node`).

**Step 4: Commit**

No code change to commit; the rebase updates branch state. If conflict resolutions were made, they are captured by the rebase. Do not create an empty commit.

---

### Task p01-t02: Recatalog `.test.mjs` and reconcile assumptions

**Files:**

- Modify (only if drift found): `discovery.md`, `plan.md`

**Step 1: Recatalog remaining `.test.mjs`**

```bash
find tests -name '*.test.mjs' -type f | sort
find tests/session-observer -name '*.test.mjs' -type f   # MUST be empty
grep -rl "node:test" tests/ scripts/ tools/ | sort
```

Expected:

- `tests/session-observer/**/*.test.mjs` → **empty**. If any remain, this is a **BLOCKER** for retiring `test:node`; record it in `state.md` `oat_blockers` and stop.
- Remaining `.test.mjs` should be exactly the 13 repo/tooling files (the 12 `node:test` suites + `generated-output-sync.test.mjs`). Confirm none unexpectedly appeared or disappeared.
- No `node:test` import outside `tests/**`.

**Step 2: Reconcile assumptions**

Compare the live catalog against `discovery.md` "Assumptions". For any drift (PR3 touched `package.json` test scripts, renamed `generated-output-sync`, left a `.mjs`, changed `vitest.config.mjs`), update this plan's later tasks before proceeding.

**Step 3: Verify**

Run: `git status --porcelain` (clean except any plan/discovery reconciliation edits)
Expected: catalog matches plan; assumptions reconciled.

**Step 4: Commit (only if reconciliation edits were made)**

```bash
git add discovery.md plan.md
git commit -m "docs(p01-t02): reconcile PR4 plan with post-PR3 test layout"
```

> **Gate satisfied (no pause here).** This was the PR3 gate; it is now reconciled. The HiLL checkpoint has been moved to the final phase (`p04`) — implementation proceeds from here through Phases 2–4 without pausing.

---

## Phase 2: Convert repo/tooling suites + harmonize session-observer to `expect`

Uniform transform per file: rename `*.test.mjs` → `*.test.ts`; replace `import test from 'node:test'` / `import { test, describe } from 'node:test'` with `import { describe, it, test, expect, beforeAll, afterAll } from 'vitest'` (import only what each file uses); replace `node:assert/strict` assertions with Vitest `expect`; keep all relative import paths, subprocess spawns, and `mkdtemp` fixture behavior byte-for-byte equivalent. Use `git mv` so history is preserved.

**Assertion convention — Vitest `expect`, repo-wide (verified dominant):** the already-migrated suites are unanimous — `0` `.test.ts` files import `node:assert`, `45` import `expect` from `vitest`. This matches the original brief. PR4 puts the **entire** repo on `expect`: the 13 converted repo/tooling suites (p02-t01/t02/t03) **and** the 9 session-observer suites PR3 left on `node:assert/strict` (p02-t04/t05). Result: every `tests/**` suite uses `expect`, and the guard (p03-t01) forbids new `node:assert` imports in tests to keep it that way.

**Shared helper stays `.mjs` (do not convert, do not break):** `tests/helpers/process.mjs` is a typed (`tests/helpers/process.d.mts`) helper imported by `tests/smoke-test-script` and already by `tests/parallel-integration.test.ts` — so a `.test.ts` importing this `.mjs` helper via the `.d.mts` shim is a proven, working pattern in this repo. Leave `tests/helpers/process.mjs` as-is; the guard targets `*.test.mjs` only, so a non-test `.mjs` helper is correctly never flagged.

### Task p02-t01: Convert manifest/structure tooling suites (9 files)

**Files (rename `.test.mjs` → `.test.ts`):**

- `tests/docs-presence.test.{mjs→ts}`
- `tests/host-dispatch-docs.test.{mjs→ts}`
- `tests/marketplace-manifests.test.{mjs→ts}`
- `tests/package-metadata.test.{mjs→ts}`
- `tests/plugin-manifests.test.{mjs→ts}`
- `tests/readme-scope.test.{mjs→ts}`
- `tests/release-versioning.test.{mjs→ts}`
- `tests/repo-layout.test.{mjs→ts}`
- `tests/skill-frontmatter.test.{mjs→ts}`

**Step 1: Convert (RED→GREEN per file)**

For each file: `git mv` to `.test.ts`, swap `node:test`/`node:assert` imports for Vitest, translate assertions (`assert.equal`→`expect(x).toBe(y)`, `assert.ok`→`expect(x).toBeTruthy()`, `assert.deepEqual`→`expect(x).toEqual(y)`, `assert.match`→`expect(x).toMatch(y)`, `assert.throws`→`expect(fn).toThrow()`). Preserve test names and structure 1:1.

Run (scoped): `pnpm run test:vitest -- tests/docs-presence.test.ts tests/host-dispatch-docs.test.ts tests/marketplace-manifests.test.ts tests/package-metadata.test.ts tests/plugin-manifests.test.ts tests/readme-scope.test.ts tests/release-versioning.test.ts tests/repo-layout.test.ts tests/skill-frontmatter.test.ts`
Expected: all converted suites pass; assertion counts/cases match the originals.

**Step 2: Verify**

Run: `pnpm run type-check && pnpm exec oxlint tests/docs-presence.test.ts tests/host-dispatch-docs.test.ts tests/marketplace-manifests.test.ts tests/package-metadata.test.ts tests/plugin-manifests.test.ts tests/readme-scope.test.ts tests/release-versioning.test.ts tests/repo-layout.test.ts tests/skill-frontmatter.test.ts`
Expected: no type or lint errors.

**Step 3: Commit**

```bash
git add tests/docs-presence.test.ts tests/host-dispatch-docs.test.ts tests/marketplace-manifests.test.ts tests/package-metadata.test.ts tests/plugin-manifests.test.ts tests/readme-scope.test.ts tests/release-versioning.test.ts tests/repo-layout.test.ts tests/skill-frontmatter.test.ts
git commit -m "test(p02-t01): convert manifest/structure tooling suites to Vitest"
```

---

### Task p02-t02: Convert script-behavior tooling suites (3 files)

**Files (rename `.test.mjs` → `.test.ts`):**

- `tests/install-paseo.test.{mjs→ts}`
- `tests/smoke-test-script.test.{mjs→ts}`
- `tests/validate-script.test.{mjs→ts}`

**Step 1: Convert**

Same uniform transform. These exercise repo scripts (`install`, `smoke-test`, `validate`); keep any process/exit-code and filesystem fixture assertions behaviorally identical — translate the *assertion* surface only, never the *behavior* under test. **`smoke-test-script` imports `{ runNodeScript } from './helpers/process.mjs'` — keep that import exactly as-is** (the `.mjs` helper stays; it is typed by `process.d.mts` and already consumed by `.test.ts` files). Its other imports (`../scripts/smoke-test.mjs`, `../scripts/validate.mjs`, `../.lintstagedrc.mjs`) are real `.mjs` runtime/config files that also stay `.mjs` — do not rewrite those specifiers.

Run (scoped): `pnpm run test:vitest -- tests/install-paseo.test.ts tests/smoke-test-script.test.ts tests/validate-script.test.ts`
Expected: all three pass with identical coverage.

**Step 2: Verify**

Run: `pnpm run type-check && pnpm exec oxlint tests/install-paseo.test.ts tests/smoke-test-script.test.ts tests/validate-script.test.ts`
Expected: no type or lint errors.

**Step 3: Commit**

```bash
git add tests/install-paseo.test.ts tests/smoke-test-script.test.ts tests/validate-script.test.ts
git commit -m "test(p02-t02): convert script-behavior tooling suites to Vitest"
```

---

### Task p02-t03: Convert `generated-output-sync` and drop its special config include

**Files:**

- Rename: `tests/generated-output-sync.test.{mjs→ts}` (already uses Vitest imports — rename + type-clean only; no node:test to remove)
- Modify: `vitest.config.mjs` (remove the special-cased `tests/generated-output-sync.test.mjs` entry from `include`; `tests/**/*.test.ts` now covers it)

**Step 1: Convert**

`git mv tests/generated-output-sync.test.mjs tests/generated-output-sync.test.ts`. Resolve any TypeScript-only issues (typed `spawnSync` results, etc.). Remove the `'tests/generated-output-sync.test.mjs'` line from `vitest.config.mjs` `include`.

Run (scoped): `pnpm run test:vitest -- tests/generated-output-sync.test.ts`
Expected: drift guard passes and is now discovered via the standard glob.

**Step 2: Verify discovery + no stray `.test.mjs`**

Run: `find tests -name '*.test.mjs' -type f` → expected **empty**. Then `pnpm run type-check`.
Expected: zero `.test.mjs` remain anywhere under `tests/`; no type errors. A non-empty result means either a file from this phase wasn't converted, or an uncataloged stray slipped through — in the latter case stop and revisit the p01-t02 recatalog/reconcile step rather than blindly converting a surprise file.

**Step 3: Commit**

```bash
git add tests/generated-output-sync.test.ts vitest.config.mjs
git commit -m "test(p02-t03): convert generated-output-sync to Vitest TS and drop config special-case"
```

---

### Task p02-t04: Harmonize session-observer library suites to `expect`

> These files already exist as `.test.ts` (landed by PR3) and already run under Vitest. This task **only** swaps their `node:assert/strict` assertions to Vitest `expect` — no rename, no runner change, no behavior change. File set mirrors PR3's `test(p02): migrate session-observer library tests` grouping.

**Files (modify in place):**

- `tests/session-observer/digest.test.ts`
- `tests/session-observer/locate.test.ts`
- `tests/session-observer/observe.test.ts`
- `tests/session-observer/rank.test.ts`
- `tests/session-observer/state.test.ts`

**Step 1: Translate assertions**

Remove `import assert from 'node:assert/strict'`; add `expect` to the existing `from 'vitest'` import. Map 1:1, preserving every assertion's meaning and order:

- `assert.equal(a, b)` / `assert.strictEqual` → `expect(a).toBe(b)`
- `assert.deepEqual(a, b)` → `expect(a).toEqual(b)`
- `assert.ok(x)` → `expect(x).toBeTruthy()`
- `assert.match(s, re)` → `expect(s).toMatch(re)`
- `assert.throws(fn)` → `expect(fn).toThrow()`
- `await assert.rejects(p)` → `await expect(p).rejects.toThrow()`
- `assert.equal(arr.length, n)` → `expect(arr).toHaveLength(n)` (where it reads naturally)

Keep all `withTmpStateDir` / fixture / `node:fs` usage and test names exactly as-is. Do not touch the `../../src/...js` source-import specifiers.

Run (scoped): `pnpm run test:vitest -- tests/session-observer/digest.test.ts tests/session-observer/locate.test.ts tests/session-observer/observe.test.ts tests/session-observer/rank.test.ts tests/session-observer/state.test.ts`
Expected: all pass with identical case counts; no remaining `node:assert` import in these files.

**Step 2: Verify**

Run: `pnpm run type-check && pnpm exec oxlint tests/session-observer/digest.test.ts tests/session-observer/locate.test.ts tests/session-observer/observe.test.ts tests/session-observer/rank.test.ts tests/session-observer/state.test.ts`
Expected: no type or lint errors.

**Step 3: Commit**

```bash
git add tests/session-observer/digest.test.ts tests/session-observer/locate.test.ts tests/session-observer/observe.test.ts tests/session-observer/rank.test.ts tests/session-observer/state.test.ts
git commit -m "test(p02-t04): harmonize session-observer library suites to expect"
```

---

### Task p02-t05: Harmonize session-observer CLI + watcher suites to `expect`

> Same assertion-only transform as p02-t04, for the remaining 4 session-observer suites (PR3's `CLI tests` + `watcher tests` groupings). The watcher suites are timing/async-heavy — translate `assert.rejects`/async assertions with care and keep all `await` / fake-timer / fixture behavior identical.

**Files (modify in place):**

- `tests/session-observer/cli.test.ts`
- `tests/session-observer/integration.test.ts`
- `tests/session-observer/watch.test.ts`
- `tests/session-observer/watch-state.test.ts`

**Step 1: Translate assertions**

Same mapping table as p02-t04. Pay extra attention to async assertions in `watch`/`watch-state` (`await expect(...).rejects...`, `expect(...).resolves...`) so no awaited assertion silently becomes synchronous.

Run (scoped): `pnpm run test:vitest -- tests/session-observer/cli.test.ts tests/session-observer/integration.test.ts tests/session-observer/watch.test.ts tests/session-observer/watch-state.test.ts`
Expected: all pass; no remaining `node:assert` import.

**Step 2: Verify whole session-observer suite + repo-wide assertion convention**

Run: `pnpm run test:vitest -- tests/session-observer` then `grep -rl "node:assert" tests/` (expected: **empty** — every test now uses `expect`).
Expected: full session-observer suite green; zero `node:assert` importers under `tests/`.

**Step 3: Commit**

```bash
git add tests/session-observer/cli.test.ts tests/session-observer/integration.test.ts tests/session-observer/watch.test.ts tests/session-observer/watch-state.test.ts
git commit -m "test(p02-t05): harmonize session-observer CLI and watcher suites to expect"
```

---

## Phase 3: Retire `node:test` runner, add guard, simplify `pnpm test`

### Task p03-t01: Add the no-new-`node:test` guard (Vitest meta-test)

**Files:**

- Create: `tests/tooling/no-node-test-runner.test.ts`

**Step 1: Write the guard (GREEN — zero `.test.mjs` now remain)**

```typescript
// tests/tooling/no-node-test-runner.test.ts
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Documented allowlist. Expected empty — any addition must be justified here.
const ALLOWED_MJS_TESTS: string[] = [];

// Small recursive walk (no experimental fs.glob on Node 22 — see vitest-config.test.ts style).
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

const TEST_FILES = walk('tests').filter((f) => /\.test\.(ts|mts|mjs)$/.test(f));

describe('test-runner policy', () => {
  it('has no tests/**/*.test.mjs (Vitest-only)', () => {
    const stray = TEST_FILES.filter(
      (f) => f.endsWith('.test.mjs') && !ALLOWED_MJS_TESTS.includes(f),
    );
    expect(stray).toEqual([]);
  });

  it('no test source imports node:test', () => {
    const offenders = TEST_FILES.filter((f) =>
      /from\s+['"]node:test['"]/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('no test source imports node:assert (use Vitest expect)', () => {
    const offenders = TEST_FILES.filter((f) =>
      /from\s+['"]node:assert(\/strict)?['"]/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
```

> The committed guard uses a small synchronous `readdir` recursion (above) rather than `node:fs/promises` `glob`, which is still experimental on Node 22 and emits an `ExperimentalWarning` under `pnpm test`. Follow the existing `tests/tooling/vitest-config.test.ts` style. The import scans match actual `from 'node:test'` / `from 'node:assert'` import statements so doc snippets / fixture strings never trip them.
>
> The `node:assert` assertion (third `it`) is the enforcement arm of the session-observer harmonization (p02-t04/t05): it only goes green once every `tests/**` suite is on `expect`, which is why the guard lands in Phase 3 after Phase 2 completes. If you later want to relax the `node:assert` ban (e.g. allow it in a specific helper), prefer a narrow documented allowlist over deleting the check.

Run (scoped): `pnpm run test:vitest -- tests/tooling/no-node-test-runner.test.ts`
Expected: all three assertions pass (no `.test.mjs`, no `node:test`, no `node:assert`).

**Step 2: Verify the guard actually fails on reintroduction**

Temporarily create a throwaway `tests/_guard-probe.test.mjs` containing `import test from 'node:test'` and `import assert from 'node:assert/strict'`, rerun the guard, confirm the relevant assertions fail, then delete the probe. (Manual sanity check — do not commit the probe.)

**Step 3: Verify**

Run: `pnpm run type-check && pnpm exec oxlint tests/tooling/no-node-test-runner.test.ts`
Expected: no errors.

**Step 4: Commit**

```bash
git add tests/tooling/no-node-test-runner.test.ts
git commit -m "test(p03-t01): guard against new node:test / node:assert / .test.mjs tests"
```

---

### Task p03-t02: Remove `test:node` and simplify `pnpm test` to Vitest-only

**Files:**

- Modify: `package.json` (remove `test:node`; set `test` to the Vitest runner; keep `test:vitest` or inline it)

**Step 1: Edit scripts**

Set:

```json
"test": "pnpm run test:vitest",
"test:vitest": "node scripts/run-vitest.mjs"
```

Remove the `test:node` line entirely. (Keep `test:vitest` as the single source of the Vitest invocation; `test` delegates to it. Do not alter `scripts/run-vitest.mjs` behavior.)

Run: `pnpm run test`
Expected: Vitest runs the entire suite (all converted repo/tooling suites + session-observer + consensus/transcript) and passes; `test:node` no longer referenced.

**Step 2: Verify no dangling references**

Run: `grep -rn "test:node\|node --test" package.json .github/ scripts/ tools/ README.md AGENTS.md tests/AGENTS.md`
Expected: no remaining references to `test:node` / `node --test`. Note: the **only** references in the repo today are the two `package.json` lines being removed — CI `.github/workflows/validate.yml` invokes `pnpm run test` (not `test:node`), and the git hooks under `tools/` don't reference the runner. A clean grep after the `package.json` edit is the expected terminal state, not a signal to edit CI/hooks. Fix any unexpected straggler if one appears.

**Step 3: Verify full premerge slice**

Run: `pnpm run build && pnpm run type-check && pnpm run build:check && pnpm run test && pnpm run validate && pnpm run smoke`
Expected: all green.

**Step 4: Commit**

```bash
git add package.json
git commit -m "build(p03-t02): retire node:test runner; pnpm test runs Vitest only"
```

---

## Phase 4: Docs & reference updates

### Task p04-t01: Update test guidance docs

**Files:**

- Modify: `tests/AGENTS.md` — PR3 already rewrote this to describe a **mixed-runner interim contract**. PR4 flips it to the final Vitest-only state. Specific edits to the current post-PR3 text:
  - Replace the "mixed runner contract" bullet (`Legacy .test.mjs ... node:test and node:assert/strict` / `Migrated and new TypeScript tests use Vitest`) with a single statement that **all** suites are Vitest `.test.ts` using `import { describe, it, expect } from 'vitest'`.
  - **Remove** the line `Do not simplify pnpm test to Vitest-only or remove test:node until the remaining legacy suites are migrated.` — PR4 *is* that completion.
  - Update `Run the full suite with npm test / pnpm run test; this runs test:node first and then test:vitest` → describe `pnpm run test` as the single Vitest runner.
  - In "Generated-output checks", update `tests/generated-output-sync.test.mjs` → `tests/generated-output-sync.test.ts` and drop the now-moot `Do not use Node's built-in test runner for Vitest-owned .mjs files` line.
  - Add a one-line pointer that the no-`node:test`/`node:assert`/`.test.mjs` guard (p03-t01) enforces the convention.
- Modify (if PR3 left stale references): `AGENTS.md` (root), `README.md` — ensure no `test:node` / "Node built-in runner" / "runs test:node first" language; `pnpm test` described as Vitest-only.

**Step 1: Edit docs**

Layer onto PR3's wording — `tests/AGENTS.md`, root `AGENTS.md`, `README.md`, and `current-state.md` were all touched by PR3; remove only the now-stale `test:node`/mixed-runner references and describe the final single-runner setup. Do not restate or contradict PR3's session-observer wording.

**Step 2: Verify**

Run: `pnpm run test:vitest -- tests/docs-presence.test.ts tests/readme-scope.test.ts` (the doc/readme invariant suites) and `pnpm exec oxfmt --check tests/AGENTS.md README.md` only if these paths are not in the format-exclusion set.
Expected: doc-presence/readme suites pass; no stale references.

> Note: `AGENTS.md` (every level) is excluded from oxfmt/oxlint per repo conventions — do **not** format it. Only `README.md` (and other non-excluded docs) may be format-checked.

**Step 3: Commit**

```bash
git add tests/AGENTS.md AGENTS.md README.md
git commit -m "docs(p04-t01): document Vitest-only test runner"
```

---

### Task p04-t02: Update repo reference + backlog progress

**Files:**

- Modify: `.oat/repo/reference/current-state.md` (replace "remaining Node `node:test` files plus Vitest" language with Vitest-only; bump "Last updated" with a one-line PR4 note)
- Modify: `.oat/repo/reference/backlog/items/adopt-typescript-vitest-build-toolchain.md` + `.oat/repo/reference/backlog/index.md` (record the runner-retirement milestone as done; regenerate index if the item's status changed)

**Step 1: Edit reference artifacts**

Use `oat-pjm-update-repo-reference` if available to keep the backlog index regeneration consistent; otherwise edit the item file and regenerate the index per repo convention.

**Step 2: Verify**

Run: `pnpm run validate`
Expected: structure/manifest/docs invariants pass (reference docs well-formed).

**Step 3: Commit**

```bash
git add .oat/repo/reference/current-state.md .oat/repo/reference/backlog/
git commit -m "docs(p04-t02): record Vitest runner retirement in repo reference"
```

---

### Task p04-t03: Final full verification

**Files:**

- None (verification only)

**Step 1: Run the full verification plan**

Full-tree checks (safe to run unscoped):

```bash
pnpm run build
pnpm run type-check
pnpm run build:check
pnpm run test
pnpm run validate
pnpm run smoke
```

Lint/format are **scoped to this PR's changed files only** — `pnpm run lint` (`oxlint`) and `pnpm run format:check` (`oxfmt --check .`) operate over the whole tree, and per `CLAUDE.md` adoption is incremental (CI lints/format-checks only changed files; do not run repo-wide oxfmt on the not-yet-formatted tree). Mirror CI by scoping:

```bash
# Changed files this PR: converted tests/*.test.ts, the new guard, vitest.config.mjs,
# README.md, and non-excluded reference docs. Exclude AGENTS.md (oxfmt/oxlint-excluded at every level).
pnpm exec oxlint <changed .ts / .mjs paths>
pnpm exec oxfmt --check <changed non-excluded paths>
```

Expected: all green. Then assert acceptance criteria mechanically:

```bash
find tests -name '*.test.mjs' -type f          # empty
grep -rln "node:test" tests/                     # no import matches
grep -rln "node:assert" tests/                   # no import matches (repo-wide expect)
grep -n "test:node" package.json                 # no match
```

Expected: empty / no matches.

**Step 2: Commit**

No code change. If `worktree:validate` surfaced generated drift, fix it under the appropriate task instead of here.

> ⏸️ **HiLL checkpoint (`p04`, the only configured pause):** after Phase 4 completes, `oat-project-implement` pauses for human review of the full PR4 result before PR/closeout.

---

## Reviews

| Scope  | Type     | Status  | Date       | Artifact |
| ------ | -------- | ------- | ---------- | -------- |
| p01    | code     | pending | -          | -        |
| p02    | code     | passed  | 2026-06-18 | in-memory (oat-reviewer, opus); 0 Crit/0 Imp; m1/m2 minor (non-blocking) |
| p03    | code     | passed  | 2026-06-18 | in-memory (oat-reviewer, opus); 0 Crit/0 Imp; guard fail-on-reintroduction independently verified; m1 minor |
| p04    | code     | passed  | 2026-06-18 | covered by final review (oat-reviewer, opus) |
| final  | code     | passed  | 2026-06-18 | reviews/archived/final-review-2026-06-18.md (0 Crit/0 Imp; 2 minor deferred, out of scope) |
| plan   | artifact | passed   | 2026-06-18 | reviews/archived/artifact-plan-review-2026-06-18.md (I1 + M1 + M2 resolved in artifacts) |
| spec   | artifact | n/a     | -          | quick mode — no spec |
| design | artifact | n/a     | -          | quick mode — no design |

**Status values:** `pending` → `received` → `fixes_added` → `fixes_completed` → `passed`

---

## Implementation Complete

**Summary:**

- Phase 1: 2 tasks — post-PR3 gate, rebase, recatalog, reconcile assumptions (gate satisfied).
- Phase 2: 5 tasks — convert all 13 repo/tooling `.test.mjs` to Vitest `.test.ts` (drop the `generated-output-sync` config special-case); harmonize the 9 session-observer suites from `node:assert/strict` to `expect`. Whole repo lands on one `expect` convention.
- Phase 3: 2 tasks — add the guard (no `node:test`, no `node:assert`, no `.test.mjs`); retire `test:node`; `pnpm test` runs Vitest only.
- Phase 4: 3 tasks — docs (`tests/AGENTS.md`/README), repo reference + backlog, final full verification (HiLL checkpoint after this phase).

**Total: 12 tasks**

Ready for implementation once the Phase 1 PR3 gate and HiLL checkpoint conditions are satisfied (PR3 merged → rebase → recatalog).

---

## References

- Discovery: `discovery.md`
- PR3 (dependency) artifacts: `/Users/tstang/Code/session-observer-ts/.oat/projects/shared/session-observer-ts-migration/plan.md`
- Repo conventions: `CLAUDE.md`, `tests/AGENTS.md`, `.oat/repo/reference/current-state.md`
- Design: `design.md` (not used — quick mode)
- Spec: `spec.md` (not used — quick mode)
