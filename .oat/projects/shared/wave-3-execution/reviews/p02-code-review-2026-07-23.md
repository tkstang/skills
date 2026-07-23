# Phase p02 Code Review — wave-3-execution

- **Branch:** `wave-3/p02` @ `beee251`
- **Base:** `06eaf6032349a1984139fa6e9a987e4cd4e38aab`
- **Worktree:** `/Users/tstang/Code/repo-improve-2/.worktrees/wave-3/p02`
- **Contract:** `.oat/repo/reference/external-plans/2026-07-17-worktree-and-hook-tests.md`
- **Reviewed:** 2026-07-23

## Verdict: APPROVE

## Justification

The implementation delivers exactly what the plan's `## Review focus` and Done
criteria require: every spawned `git` in both new test files
(`tests/tooling/worktree-scripts.test.ts`, `tests/tooling/git-hooks.test.ts`)
routes through the shared `gitEnv()` helper (verified by reading every
spawn/execFile call site — none bypass it), the helper's 8-key scrub list is
an exact dedup of the pattern already established in
`skill-version-bumps.test.ts` (confirmed via `git diff` — that file now
imports the shared helper with byte-identical behavior, no weakening). The
`pnpm` stub records invocations and exits nonzero on `PNPM_STUB_FAIL_STEP`,
and I traced all four `validate.sh` behavioral tests line-by-line against the
actual script (`assert_clean_worktree` before/after, `run_step` sequence,
`set -euo pipefail` fail-fast) — all four accurately exercise real script
mechanics, not just recorded calls. `manage-hooks.mjs` tests always run with
`cwd` pointed at a scratch repo carrying its own copied `tools/git-hooks/`,
and I confirmed the real repo's `.git/hooks` symlinks (pre-existing,
June timestamps) were untouched after the full suite ran. DX-05's guard in
`pre-commit`/`pre-push` matches `post-checkout`'s `command -v pnpm` pattern
but fails closed with an actionable stderr message; README is updated; the
two pnpm-missing tests filter every PATH entry containing a real `pnpm`
binary (verified independently), a genuine PATH clear, not a rename. The
retired string-ordering assertion in `validate-script.test.ts` is superseded
by `worktree-scripts.test.ts`'s real-execution order assertion; the
CI-workflow ordering assertion is untouched and still runs. Scope is exactly
the files the plan allows (`tests/`, `tests/fixtures/`, `tests/helpers/`,
`tools/git-hooks/{pre-commit,pre-push,README.md}`) — `scripts/worktree/{validate,init}.sh`
and `manage-hooks.mjs` are byte-identical to base. The targeted suite
(29 tests, 3 files) passes in 8.3s wall / 16.2s cumulative test time with no
single test over ~1.7s — well within the "modest runtime, stubs not real
pipelines" bar. As an extra check beyond the assigned scope I ran the full
suite (1155 passed / 1 skipped, 0 failed) and `npm run validate` (passed),
with `git status --short` clean both before and after.

## Verification detail

1. **GIT_* scrub (Review focus #1):** Read every `spawn`/`execFile` call in
   both new test files — all pass `gitEnv()` directly, or `pnpmStubEnv()` /
   `envWithoutPnpm()`, both of which wrap `gitEnv()`. `runScript`'s default
   (`options.env ?? gitEnv()`) is never hit without an explicit override in
   practice, but the fallback itself is still scrubbed. `git-env.mjs`'s
   8-key list (`GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`,
   `GIT_COMMON_DIR`, `GIT_PREFIX`, `GIT_NAMESPACE`, `GIT_OBJECT_DIRECTORY`,
   `GIT_ALTERNATE_OBJECT_DIRECTORIES`) is a byte-identical extraction of the
   inline helper previously duplicated in `skill-version-bumps.test.ts`
   (diff confirms straight dedup + import, no key dropped or added).
2. **Stub fidelity (Review focus #2):** `tests/fixtures/bin/pnpm` records
   JSONL invocations, supports `PNPM_STUB_FAIL_STEP` (nonzero exit,
   stderr matching real pnpm failure shape) and `PNPM_STUB_DIRTY_ON_STEP`
   (writes a stray file to simulate generated-output drift). Traced all four
   `validate.sh` tests against the script's actual `assert_clean_worktree`
   (before/after) and `run_step` sequence under `set -euo pipefail`: dirty-
   before-pipeline (zero pnpm calls), clean-pass (full 8-step documented
   order incl. duplicate `build:check`), post-pipeline drift (dirty flag on
   `test` step, full pipeline still runs, caught only at the final
   "after validation" check — correctly proves post-run not fail-fast
   detection), and mid-pipeline step failure (`validate` fails, `smoke` and
   final `build:check` never run). One minor observation, not a defect: the
   script also has an intermediate `assert_clean_worktree "after
   generated-output build"` checkpoint (between `build` and `type-check`)
   that no test dirties directly — coverage proves the final checkpoint
   works and the mid-pipeline checkpoint doesn't false-positive on a clean
   pipeline, but doesn't independently prove the mid-pipeline checkpoint
   halts early if triggered there specifically. This checkpoint isn't
   called out in the plan's "Current state" summary of high-value behaviors,
   so it's a nice-to-have gap, not a plan-contract miss.
3. **manage-hooks.mjs isolation (Review focus #3):** `makeScratchHooksRepo`
   creates a scratch git repo with its own `tools/git-hooks/` copy
   (executable bit set); `runManageHooks` always sets `cwd` to that scratch
   root. `manage-hooks.mjs` resolves both its hook source dir
   (`path.resolve('tools/git-hooks')`, cwd-relative) and its target
   (`git rev-parse --git-path hooks`, also cwd/env-relative) purely from the
   inherited (scrubbed) env and the scratch cwd — never the real repo. Live-
   verified post-run: the real checkout's `.git/hooks/*` symlinks all carry
   June timestamps (pre-dating this session), confirming no leakage.
4. **DX-05 (Review focus #4):** `pre-commit`/`pre-push` diffs add the exact
   `if ! command -v pnpm >/dev/null 2>&1; then ... exit 1; fi` guard,
   matching `post-checkout`'s `command -v pnpm` check syntax but failing
   closed (post-checkout's is a soft skip by design — the plan's "match the
   pattern" is about the check mechanism, which is correctly reused).
   README's hook descriptions were updated to document the new fail-closed
   behavior for both hooks and the skip behavior for post-checkout.
   Independently verified `envWithoutPnpm()` filters every PATH entry that
   resolves a real `pnpm` binary (confirmed via a standalone Node check
   against the ambient PATH) — a genuine removal, not a rename/shadow, and
   both DX-05 tests pass.
5. **Retirement (Review focus #5):** The removed block in
   `validate-script.test.ts` was purely the string-match assertion against
   `scripts/worktree/validate.sh`'s source text (`assertOrdered(worktreeValidation, [...])`).
   The new `worktree-scripts.test.ts` "passes and runs the documented
   pipeline in order on a clean tree" test supersedes it with a real-
   execution invocation-order assertion — strictly stronger evidence. The
   CI-workflow ordering assertion (`assertOrdered(workflow, [...])`) is
   untouched, renamed only in its `it()` description, and still executes.
6. **Suite run:** `npx vitest run tests/tooling/worktree-scripts.test.ts
   tests/tooling/git-hooks.test.ts tests/release/validate-script.test.ts` →
   3 files / 29 tests passed, 8.29s wall (16.16s cumulative test time across
   parallel workers), max single test ~1.7s (`post-checkout reinstalls only
   when pnpm-lock.yaml changed...`). No test approaches the 20s flag
   threshold.
7. **Scope:** `git diff --stat` against base touches only
   `tests/fixtures/bin-oat/oat`, `tests/fixtures/bin/pnpm`,
   `tests/helpers/git-env.{mjs,d.mts}`,
   `tests/release/{skill-version-bumps,validate-script}.test.ts`,
   `tests/tooling/{git-hooks,worktree-scripts}.test.ts`,
   `tools/git-hooks/{README.md,pre-commit,pre-push}`. Confirmed
   `scripts/worktree/validate.sh`, `scripts/worktree/init.sh`, and
   `tools/git-hooks/manage-hooks.mjs` are byte-identical to base (no
   canonical script logic changes beyond the DX-05 guard). No `SKILL.md` or
   generated-output changes.

## Findings requiring action

None blocking.

## Minor, non-blocking observations (optional follow-up)

- `tests/tooling/git-hooks.test.ts:225-226` uses `Array#sort()`
  (`unicorn/no-array-sort`) instead of `toSorted()`; oxlint flags it when
  run directly against the file. This is **not currently CI-blocking**: the
  PR-only `lint` job in `.github/workflows/validate.yml` filters changed
  files to `*.mjs`/`*.js` only (excludes `.test.ts`), and `.lintstagedrc.mjs`
  likewise only globs `*.{mjs,js,json,md}` — consistent with the repo's
  documented incremental oxlint/oxfmt adoption for TypeScript. A pre-existing
  `.sort()` of the same shape already exists untouched in
  `tests/session-observer/watch-state.test.ts:709`, and `oxfmt --check`
  shows pre-existing formatting drift in unrelated `.ts` test files too
  (e.g. `tests/consensus/core/*.test.ts`), so this is consistent with
  ambient repo state, not a new regression against an enforced gate. Trivial
  fix if desired, not required for merge.
- The `assert_clean_worktree "after generated-output build"` mid-pipeline
  checkpoint in `validate.sh` (distinct from the final post-validation
  checkpoint) has no dedicated behavioral test isolating it — see detail
  item 2 above. Not required by the plan's stated high-value behaviors, but
  worth a follow-up test if the plan's coverage bar is later raised.

## Extra verification beyond the assigned checklist

- Full suite: `npx vitest run` → 112 files / 1155 tests passed, 1 skipped,
  0 failed (29.56s report time / 248.69s cumulative test time).
- `npm run validate` → `validation passed`.
- `git status --short` clean in the worktree both before and after all runs.
