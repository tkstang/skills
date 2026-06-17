---
oat_generated: true
oat_generated_at: 2026-06-17
oat_review_scope: final
oat_review_type: code
oat_review_invocation: manual
oat_project: .oat/projects/shared/consensus-refine-ts
---

# Code Review: final

**Reviewed:** 2026-06-17
**Scope:** final — full branch `consensus-refine-ts` (`e29934591253aaacd6d07a23f31a1da1c85ec375..HEAD`)
**Files reviewed:** 54 changed (key non-bookkeeping: canonical TS wrapper, generated `.mjs`, build-generated.mjs, 20 ported tests, guards, tooling/CI, docs)
**Commits:** 41 (abaf77a..9dfefcd)

## Summary

The consensus refine wrapper + consensus test-suite migration to TypeScript/Vitest
is correct, complete, and merge-ready. The shipped runtime's public surface (26
exports) and CLI entrypoint are byte-equivalent to the pre-migration `.mjs`; the
generated-output contract (DR-020/DR-021) holds; the p04-t01 import-rewrite hardening
is a sound parser-based implementation with focused regression tests; assertion
parity is preserved across all 20 ported files; and tooling/CI exclusions and docs
are accurate. The only failing item in the full suite is the known, intermittent,
out-of-scope session-observer node:test concurrency flake (passes in isolation and on
re-run), which discovery/design explicitly carve out as not-in-scope.

## Findings

### Critical

None

### Important

None

### Minor

None

The deferred-findings ledger (0 Medium / 0 Minor) is confirmed accurate: the only
prior final-review minor (`m1`, import-rewrite robustness) was converted to `p04-t01`
and fully resolved. Independent re-derivation against the full branch diff reaches the
same conclusion — nothing was silently dropped.

## Requirements/Design Alignment

**Evidence sources used:** `discovery.md`, `design.md`, `plan.md`, `implementation.md`
(incl. assertion-parity inventory), `CLAUDE.md`/`AGENTS.md`, full branch diff, current
source/test/build files. (Quick mode — no `spec.md`; that is expected, not a gap.)

### Requirements Coverage (design/discovery success criteria)

| Requirement (success criterion) | Status | Notes |
| ------------------------------- | ------ | ----- |
| Canonical TS source `src/consensus/refine/consensus-refine.ts` exists, type-checks against loop API | implemented | `pnpm run type-check` passes; imports `'../core/consensus-loop.js'` (the only relative import); strict + isolatedModules + verbatimModuleSyntax |
| Generated shipped `.mjs` regenerated from TS, byte-in-sync | implemented | `build:check` reports both `consensus-loop: in sync` and `consensus-refine: in sync` |
| Generated `.mjs` carries GENERATED banner, imports `'./consensus-loop.mjs'`, no `'../core/'` | implemented | Banner present (lines 1-2); `from './consensus-loop.mjs'` (line 29); zero `../core/` refs |
| Both generated outputs drift-checked (build, build:check, sync test) | implemented | `tests/generated-output-sync.test.mjs` asserts both in-sync + both mappings declared |
| Test proves generated wrapper imports sibling, not canonical path | implemented | `tests/generated-consensus-refine-import.test.ts` asserts presence of sibling + absence of `../core/` |
| Consensus tests on Vitest as `.test.ts`, no assertion loss | implemented | 20 files migrated; literal assert→expect counts match base 1:1 on spot-checks; inventory rows complete |
| No duplicate `.mjs`+`.test.ts` for migrated modules; out-of-scope suites stay node:test | implemented | Zero duplicates; remaining `.test.mjs` are session-observer/export-session/transcript-core/repo-tooling only |
| Shipped runtime dependency-free (node stdlib + sibling only) | implemented | No third-party/esbuild/vitest/typescript imports in generated output |
| Import-rewrite constrained to module specifiers, fail-loud on absence | implemented (p04-t01) | TS-parser-based; rewrites import/export-from/dynamic-import specifiers only; throws if `from` absent; regression test proves non-import strings untouched |
| Layout invariant: no `.ts` under plugins/consensus/skills; `src/consensus/refine` required | implemented | `tests/repo-layout.test.mjs` extended; passes |
| Tooling/CI exclusions synced (oxlint, oxfmt, lint-staged, CI ×2) | implemented | refine path present in `.oxlintrc.json`, `.oxfmtrc.json`, `.lintstagedrc.mjs`, validate.yml diff-check + oxlint + oxfmt filters |
| Docs: DR-021, current-state, backlog bl-bfb4, README/AGENTS | implemented | DR-021 accurate to shipped (incl. p04 hardening); current-state/backlog/README/AGENTS accurate; CLAUDE.md symlinked to AGENTS.md |
| All gates pass (build, build:check, type-check, test:vitest, validate, smoke) | implemented | See Verification Commands; only out-of-scope session-observer flake noted |

### Behavior parity verification

- Export surface: 26 names, identical set base vs HEAD (diffed).
- CLI main-guard (`process.argv[1] === fileURLToPath(import.meta.url)` → `runWrapperCli`)
  preserved.
- Error-handler refactor (`asErrorLike(error)` narrowing) is behavior-equivalent:
  for object errors it returns the same object (`.code`/`.message` resolve
  identically); for primitive throws it returns `{}` yielding the same
  `'ERROR'` / `String(error)` fallbacks as the original `error.code ?? 'ERROR'` /
  `error?.message ?? String(error)`.
- Type quality: zero `: any`/`as any`, zero `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck`,
  67 `unknown` narrowings at JSON boundaries. Genuine types, not escape hatches.

### Extra Work (not in declared requirements)

None. All changes map to plan tasks p01-t01..p04-t01 and bookkeeping.

## Out-of-Scope Note: session-observer node:test flake

`pnpm test` (full node + vitest) intermittently fails one out-of-scope test:
`tests/session-observer/cli.test.mjs:169` with a spurious
`SyntaxError: ... does not provide an export named 'normalizeEntries'` from the
generated `skills/session-observer/scripts/lib/runtimes.mjs` (which *does* export it).

Characterization (verified):

- In isolation (`node --test tests/session-observer/cli.test.mjs`): 40/40 pass, 3/3 runs.
- Full `pnpm run test:node`: failed run 1, passed run 2 (intermittent).
- The session-observer files are NOT in scope (no changes on this branch); the file
  was last touched in base commit `47cdaa1`.

This is a Node test-runner concurrent-ESM-import race in out-of-scope code, exactly the
"non-consensus session-observer timing flake — isolate and report, do not scope-creep"
case called out in discovery/design success criteria. It does not block this merge.
(Observation for a future, separate effort: the flake surfaces more readily now that
`test:node`'s file set shrank when consensus tests moved to Vitest, changing worker
scheduling. Not a defect in this branch's changes.)

## Verification Commands

Actual results from this review:

```bash
pnpm run type-check          # PASS (tsc --noEmit)
pnpm run build:check         # PASS — consensus-loop: in sync; consensus-refine: in sync
pnpm run validate            # PASS — validation passed
pnpm run smoke               # PASS — smoke passed
pnpm run test:vitest         # PASS — 23 files / 235 tests
pnpm test                    # 300/301 (1 intermittent OUT-OF-SCOPE session-observer flake; passes on re-run / in isolation)
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert findings into plan tasks.
No findings to convert — this is a clean pass and the project is merge-ready.
