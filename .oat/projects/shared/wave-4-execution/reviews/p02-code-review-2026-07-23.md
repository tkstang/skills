# Phase Review: wave-4/p02 (2026-07-23)

- Wave: wave-4-execution
- Phase: p02
- Branch: `wave-4/p02` (commit `55a58c8`)
- Base: `a9532b88f83741cf3ef2d32974ca456ced755570`
- Worktree: `/Users/tstang/Code/repo-improve-2/.worktrees/wave-4/p02`
- Contract: `.oat/repo/reference/external-plans/2026-07-17-docs-pr-ci-gate.md`

## Verdict: PASS

## Justification

The single commit adds exactly one file, `.github/workflows/docs-ci.yml`, that satisfies every item in the contract's Done criteria and Review focus: it triggers on `pull_request` scoped to `paths: ['documentation/**']` (no unrelated PR can run it), caches against `documentation/pnpm-lock.yaml` (not the root lockfile — this repo has no root workspace), carries `permissions: contents: read` and a `cancel-in-progress` concurrency group, and its `actions/checkout`, `pnpm/action-setup`, and `actions/setup-node` `uses:` lines are byte-identical (same SHA, same version comment) to `deploy-docs.yml` and `validate.yml`. The install/build steps are a verbatim copy of `deploy-docs.yml`'s recipe (same `working-directory`, same `NEXT_PUBLIC_BASE_PATH` env) minus the Pages configure/upload/deploy steps, plus the additional `docs:format:check` step the plan calls for. Local-proof logs captured just before the commit (`docs-build2.log`, `docs-format-check.log`) show a clean `next build` and a clean `oxfmt --check` run, consistent with the Done-criteria requirement that both commands were proven green locally. Scope is exactly the one new file; the commit message is Conventional-Commits-formatted (`ci(p02-t01): ...`).

## Verification detail

1. **Path-filter correctness (Review focus #1)** — `docs-ci.yml:8-11`: `on: pull_request: paths: ['documentation/**']`. A PR touching only unrelated paths (e.g. `src/`, root `package.json`) will not trigger this job — GitHub Actions `paths` filters are match-any-changed-file, and no changed file outside `documentation/**` satisfies the filter, so the job is skipped (not run-and-pass) for unrelated PRs, satisfying the CI-minutes concern.

   *Implementer-noted gap*: the workflow does not self-trigger on edits to `docs-ci.yml` itself (unlike `deploy-docs.yml`, whose `paths` list includes its own file `.github/workflows/deploy-docs.yml:17`). **Judgment: correctly left out, not a gap.** The plan's step 2 is explicit and singular — `on: pull_request: paths: ['documentation/**']` — with no instruction to add the workflow's own path, unlike `deploy-docs.yml`'s self-referential pattern which this plan did not ask the implementer to replicate. Adding it would be a reasonable belt-and-suspenders improvement (an edit to the build/format-check recipe wouldn't be re-validated by CI unless bundled with a `documentation/` change in the same PR), but it is outside what this contract specifies, so I record it below as a Low-severity, non-blocking suggestion rather than a deviation.

2. **Cache configuration (Review focus #2)** — `docs-ci.yml:29-33`:
   ```
   - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
     with:
       node-version: '22'
       cache: pnpm
       cache-dependency-path: documentation/pnpm-lock.yaml
   ```
   Points at `documentation/pnpm-lock.yaml`, matching `deploy-docs.yml`'s identical cache config and the repo's nested-standalone lockfile layout (no root `pnpm-workspace.yaml`).

3. **Pinned actions / permissions / concurrency (Review focus #3)** — `diff a9532b8..55a58c8 -- .github/workflows/validate.yml .github/workflows/deploy-docs.yml` is empty (neither file touched). `grep -n "uses:"` on both files shows the same three SHAs/comments used in `docs-ci.yml`:
   - `actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0`
   - `pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320 # v4.4.0`
   - `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0`

   `permissions: contents: read` (`docs-ci.yml:13-14`) — least-privilege, correctly omits `pages`/`id-token` since this job never deploys. `concurrency: { group: "${{ github.workflow }}-${{ github.ref }}", cancel-in-progress: true }` (`docs-ci.yml:16-18`) is present, matching the plan's spec (and appropriately different from `deploy-docs.yml`'s non-cancelling `pages` group, since PR builds should be superseded by new pushes).

4. **Build recipe mirrors deploy-docs.yml (Review focus #4)** — Side-by-side against `deploy-docs.yml` at the same base: `checkout` → `pnpm/action-setup` → `setup-node` → `Install dependencies` (`pnpm install --frozen-lockfile`, `working-directory: documentation`) → `Build docs` (`pnpm build`, `working-directory: documentation`, `env: NEXT_PUBLIC_BASE_PATH: /skills`) are verbatim matches. `docs-ci.yml` stops there plus one added `Check docs formatting` step (`pnpm run docs:format:check`, `working-directory: documentation`) per plan step 1/2; the `Setup Pages` / `Upload artifact` / `Deploy to GitHub Pages` steps are correctly omitted.

5. **Local-proof logs (Review focus #5)** — Found in this session's scratchpad: `docs-build2.log` (32 lines, mtime `2026-07-23 03:03:30`) shows `fumadocs-mdx` generating the index, then `next build` completing with `✓ Compiled successfully in 3.1s`, TypeScript finished, all 34 static pages generated, no error/warning output, file ends cleanly at the route-summary table (no truncation, no stack trace). `docs-format-check.log` (5 lines, mtime `2026-07-23 03:03:34`) shows `oxfmt --check 'docs/**/*.md'` → `All matched files use the correct format. Finished in 235ms on 31 files using 10 threads.` Both logs predate the commit (`03:05:20`) by under 2 minutes and contain no failure/error indicators, consistent with both commands exiting 0 immediately before the commit was made. `package.json` confirms `"build": "next build"` and `"docs:format:check": "oxfmt --check 'docs/**/*.md'"` — the logged commands match the scripts the workflow invokes.

6. **Scope and commit hygiene (Review focus #6)** — `git diff --stat a9532b8..55a58c8` shows exactly one file: `.github/workflows/docs-ci.yml | 47 +++...`. `git status --short` in the worktree is clean. Commit `55a58c8` — `ci(p02-t01): add PR-time build gate for the documentation site` — is a well-formed Conventional Commit with a body explaining the rationale and mirrored-recipe design.

## Findings requiring action

None (blocking).

**Low, non-blocking (optional):** `docs-ci.yml`'s `paths` filter does not include its own path (`.github/workflows/docs-ci.yml`), so an edit to the build/format-check recipe alone (not bundled with a `documentation/**` change) would not be re-validated by this gate before merge — `deploy-docs.yml` guards against the analogous risk by including its own path. The contract's step 2 explicitly specifies only `paths: ['documentation/**']`, so this is not a deviation from the plan; flagging only as an operator-optional hardening follow-up, consistent with the plan's own "Review focus" framing of this exact question.
