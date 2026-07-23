---
oat_generated: true
oat_external_plan: true
oat_external_plan_source: repo-audit
oat_external_plan_sources:
  - 'repo-audit: full repository (excl. .agents/, .claude/, .codex/, .cursor/)'
oat_external_plan_commit: '8309623'
oat_backlog_items:
  - BL-260718-execute-worktree-scripts
oat_issue_url: null
created: '2026-07-17T23:39:00Z'
---

# Execute — don't string-match — the worktree scripts and git-hook tooling in tests

> [!NOTE]
> This is an external implementation plan, not a canonical OAT project
> `plan.md`. Execute it directly, or import it for tracked OAT execution with
> `oat-project-import-plan <this-file>`.
>
> Begin with the drift check. Follow the steps and verification gates in order.
> If a STOP condition occurs, stop and report instead of improvising.

## Outcome

The developer-tooling scripts the repo tells contributors to rely on gain behavioral tests. Today `tests/release/validate-script.test.ts` only asserts that `scripts/worktree/validate.sh`'s *source text* contains substrings in order (never spawns it), `scripts/worktree/init.sh` has zero test references, and `tools/git-hooks/manage-hooks.mjs` (232 lines of install/enable/disable/status logic) plus the hook scripts themselves are entirely untested. After this plan, the pre-merge check documented in AGENTS.md is proven to fail closed on a dirty tree and pass on a clean one, and hook management is pinned by characterization tests.

## Source and live evidence

- Source artifact or scope: repo-audit reconnaissance (tests lane), full repository
- Planned at: commit `8309623` on `2026-07-17`
- Related backlog items: none
- Evidence (tests lane; re-verify in step 1):
  - `tests/release/validate-script.test.ts:13-15,145-172` — reads `scripts/worktree/validate.sh` as a string, asserts substring ordering only.
  - `grep -rl "worktree/init" tests/` → empty; `grep -rl "tools/git-hooks\|manage-hooks" tests/` → empty.
  - `tools/git-hooks/pre-push` locally runs `pnpm run validate` / `build:check` / `type-check` plus skill-version and internal-flag validators; CI backstops these PR-side, so the risk is silent local-DX degradation, not bad merges.
  - Related DX finding (deps/DX lane): `pre-commit`/`pre-push` lack the `command -v pnpm` guard that `post-checkout` has — an optional adjacent fix, in scope only as a hook-script change the new tests then cover.

## Drift check

```bash
git diff --stat 8309623..HEAD -- scripts/worktree/ tools/git-hooks/ tests/release/ tests/tooling/
```

Re-verify the coverage gaps if any of these moved.

## Repository conventions

- Test: `pnpm test`; suites use real temp dirs and real subprocesses (zero `vi.mock` in the whole repo — keep it that way).
- **Critical, from prior incident:** tests that create temp git repos MUST scrub git environment variables (`GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, and the `GIT_*` family generally) from the child env before running `git` in the temp dir — otherwise running the suite from inside a git hook corrupts the *real* repository's config. Follow the pattern of existing temp-git tests in the repo (grep `tests/` for `GIT_DIR` to find the established scrub helper).
- Full-run cost: `worktree/validate.sh` itself runs `test`+`validate`+`smoke` — the test must NOT execute the real full pipeline recursively (see steps for the stub strategy).
- Commits: Conventional Commits (`test(tooling): execute worktree and hook scripts`). Do not push or open a PR unless instructed.

## Scope

### In scope

- New behavioral tests (suggested: `tests/tooling/worktree-scripts.test.ts`, `tests/tooling/git-hooks.test.ts`).
- Minimal testability seams in the scripts **only if required** (e.g. an env override so `validate.sh` invokes a stub instead of the real `pnpm run` pipeline) — keep seams tiny and documented in the script.
- Optionally: the `command -v pnpm` guard in `pre-commit`/`pre-push` (DX-05), covered by the new tests.
- Retiring the string-ordering assertions that the new behavioral tests supersede (keep any that still add value).

### Out of scope

- Changing what the worktree scripts or hooks actually do (behavior-preserving except the optional pnpm guard).
- CI workflow changes.
- `scripts/worktree/init.sh`'s `pnpm install`/OAT-sync steps running for real in tests (stub the expensive externals).

## Current state

- `scripts/worktree/validate.sh` (read it first): asserts a clean tree, runs the test/validate/smoke pipeline, re-asserts cleanliness to catch generated-file drift. The high-value behaviors to pin: dirty-tree → nonzero exit before running the pipeline; pipeline failure → nonzero; clean pass → zero and cleanliness re-checked *after* the pipeline.
- `tools/git-hooks/manage-hooks.mjs`: install/enable/disable/status against `.git/hooks`; invoked via `pnpm hooks:status` etc. and the `prepare` script (`GIT_HOOKS=0` skips at install time).
- Hook scripts are thin shell wrappers delegating to pnpm scripts — their testable contract is "invokes the right commands and propagates exit codes."

## Implementation steps

### 1. Read the scripts and confirm the seams

Read `scripts/worktree/validate.sh`, `init.sh`, `tools/git-hooks/manage-hooks.mjs`, and the four hook scripts. Identify how each invokes external commands and the smallest override enabling stubbing (e.g. `PATH` prepend with stub `pnpm`, or an existing env override).

**Verify:** stub strategy chosen per script; no strategy requires rewriting script logic.

### 2. Behavioral tests for `validate.sh`

In a scratch git repo (env-scrubbed per conventions) with a stub `pnpm` on `PATH` that records invocations: (a) dirty tree → exits nonzero, pipeline never invoked; (b) clean tree + all-pass stub → exits 0, invocation order matches the documented pipeline; (c) clean tree + stub that dirties a file mid-run (simulating generated drift) → exits nonzero at the post-run cleanliness check; (d) stub failure in any step → nonzero.

**Verify:** `pnpm test -- tests/tooling/worktree-scripts.test.ts` → passes.

### 3. Behavioral tests for `init.sh`

Same scratch-worktree setup: assert the copy steps land the expected local-only files when present in the source repo, and the script tolerates their absence; stub `pnpm`/`oat` externals and assert they are invoked (or cleanly skipped when absent, matching the script's actual guards).

**Verify:** focused test passes.

### 4. Characterization tests for hooks

`manage-hooks.mjs`: against a scratch `.git/hooks`, pin status/enable-all/disable-all round-trips (files created/removed/marked exactly as the script does today). Hook scripts: run each with a stub `pnpm` and assert delegation + exit-code propagation. If applying DX-05, add the pnpm-missing case: clear `PATH` of pnpm → hook exits nonzero with the actionable message (and update `pre-commit`/`pre-push` to match `post-checkout`'s guard pattern first).

**Verify:** `pnpm test -- tests/tooling/git-hooks.test.ts` → passes.

### 5. Retire superseded string assertions and run the contract

Trim `tests/release/validate-script.test.ts` to whatever the behavioral tests don't cover (possibly nothing). Then:

```bash
pnpm test && npm run validate
```

**Verify:** exit 0; suite runtime increase is modest (stubs, not real pipelines).

## Test plan

- As above; structural pattern: existing temp-git suites in `tests/` (find via `grep -rln "mkdtemp" tests/ | head`), with the GIT_* env scrub.
- Regressions proven: dirty-tree fail-closed, post-pipeline drift detection, hook exit-code propagation — none of which the string test proved.
- Focused: the two new files. Full: `pnpm test`.

## Done criteria

- [ ] `validate.sh` and `init.sh` are executed by tests covering the four behaviors in step 2 and the copy semantics in step 3.
- [ ] `manage-hooks.mjs` and all four hook scripts have characterization coverage.
- [ ] Every temp-git test scrubs the `GIT_*` env family.
- [ ] `pnpm test && npm run validate` pass; `git status --short` clean of unexplained files.

## STOP conditions

- A script cannot be stubbed without invasive rewrites (report the seam problem; do not refactor the script's logic under a test-only plan).
- Reading reveals the scripts' actual behavior differs materially from what AGENTS.md documents (doc-vs-code drift — report it; decide fix direction with the operator).
- Any verification gate fails twice after one bounded correction.

## Review focus

- The GIT_* env scrub in every spawned git — this exact omission previously corrupted a real repo config when tests ran inside a hook.
- Stub fidelity: stubs must fail like the real tools fail (nonzero exit), not just record calls.
- Deferred intentionally: running the real pipeline end-to-end in CI (cost), `init.sh`'s OAT-config semantics beyond file-copy assertions.
