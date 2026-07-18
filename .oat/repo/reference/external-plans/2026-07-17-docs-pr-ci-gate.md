---
oat_generated: true
oat_external_plan: true
oat_external_plan_source: repo-audit
oat_external_plan_sources:
  - 'repo-audit: full repository (excl. .agents/, .claude/, .codex/, .cursor/)'
oat_external_plan_commit: '8309623'
oat_backlog_items:
  - BL-260718-add-pr-time-ci-gate
oat_issue_url: null
created: '2026-07-17T23:39:00Z'
---

# Add a PR-time CI gate for the documentation site build

> [!NOTE]
> This is an external implementation plan, not a canonical OAT project
> `plan.md`. Execute it directly, or import it for tracked OAT execution with
> `oat-project-import-plan <this-file>`.
>
> Begin with the drift check. Follow the steps and verification gates in order.
> If a STOP condition occurs, stop and report instead of improvising.

## Outcome

Pull requests that touch `documentation/` get a CI job that builds the Fumadocs app before merge. Today the only docs automation is `deploy-docs.yml`, which triggers on `push` to `main` (path-filtered) and `workflow_dispatch` — so a PR that breaks the Next.js/MDX build or the docs format check merges clean and fails only as a post-merge Pages deploy on `main`, invisible to reviewers and with no rollback. After this plan, docs breakage is a red PR check.

## Source and live evidence

- Source artifact or scope: repo-audit reconnaissance (deps/DX lane), full repository
- Planned at: commit `8309623` on `2026-07-17`
- Related backlog items: none
- Verified evidence (read live at planning time):
  - `.github/workflows/deploy-docs.yml:12-18` — triggers: `workflow_dispatch` and `push: branches: [main], paths: documentation/**`; no `pull_request` trigger.
  - `.github/workflows/validate.yml` — zero references to `documentation` (verified by grep).
  - `documentation/` has its own `package.json` and `pnpm-lock.yaml` (not part of a root workspace; no root `pnpm-workspace.yaml` exists).
  - `documentation/package.json` scripts include a Next.js build and `docs:format:check` (deps/DX lane; confirm exact script names in step 1).

## Drift check

```bash
git diff --stat 8309623..HEAD -- .github/workflows/ documentation/package.json documentation/pnpm-lock.yaml
```

If a docs PR gate already appeared, or the docs app moved into a workspace, reassess before editing.

## Repository conventions

- CI style to match (`validate.yml`): jobs use `actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4` with pnpm caching, `pnpm install --frozen-lockfile`; permissions default `contents: read`.
- The supply-chain hardening plan (`2026-07-17-supply-chain-ci-hardening.md`) may SHA-pin these actions — if it has already run, match its pinning style.
- Commits: Conventional Commits (`ci(docs): build documentation on PRs`). Do not push or open a PR unless instructed.

## Scope

### In scope

- One new job (either in a new `.github/workflows/docs-ci.yml` or appended to `validate.yml` — prefer a separate workflow so the path filter is clean and the main validate matrix stays untouched), triggered on `pull_request` with `paths: [documentation/**]`, running install + build + format check inside `documentation/`.
- Mirroring the build steps from `deploy-docs.yml` minus the Pages configure/upload/deploy steps.

### Out of scope

- Folding `documentation/` into a root pnpm workspace, or aligning its dependency versions with root — separate finding (DEPS-01), deliberately not planned in this run.
- Changing `deploy-docs.yml`'s deploy behavior.
- Making the docs job required in branch protection (repository-settings change; note it for the operator).

## Current state

- `deploy-docs.yml` contains the working recipe for building the app in CI (node/pnpm setup with the docs lockfile, install, build) — read it and reuse its exact steps and working-directory handling so the PR job cannot drift from the deploy job's reality.
- Docs formatting uses the docs app's own oxfmt version via its `docs:format:check` script (version differs from root — expected; use the docs-local script, not root oxfmt).

## Implementation steps

### 1. Confirm the build recipe locally

Read `deploy-docs.yml`'s build steps and `documentation/package.json` scripts. Run them locally:

```bash
cd documentation && pnpm install --frozen-lockfile && pnpm run <build-script> && pnpm run <format-check-script>
```

**Verify:** both commands exit 0 at the planned-at commit (if the build is already broken on `main`, STOP — fix-forward is a different change).

### 2. Add the workflow

Create `.github/workflows/docs-ci.yml`: `on: pull_request: paths: ['documentation/**']`; `permissions: contents: read`; a `concurrency` group keyed on workflow+ref with `cancel-in-progress: true`; one job that checks out, sets up pnpm/node with caching against `documentation/pnpm-lock.yaml`, then runs the step-1 commands with `working-directory: documentation`.

**Verify:** `node -e "require('node:fs'); ..."` is unnecessary — instead validate YAML shape with `npx --yes yaml-lint .github/workflows/docs-ci.yml` if available, or a careful read; the real gate is step 3.

### 3. Prove the trigger on a scratch branch

Create a branch with a trivial `documentation/` whitespace-level change (e.g. touch a doc page comment), push is out of scope for this plan — instead, if the executor may not push, verify by inspection that the path filter matches the changed file and that a non-docs change would not trigger it. If pushing a draft PR is authorized in the execution context, that is the strongest verification: the job must appear and pass.

**Verify:** trigger semantics confirmed by the strongest available method; record which method was used.

## Test plan

- No Vitest changes — this is CI configuration. The verification boundary is: local build commands green (step 1) + trigger semantics confirmed (step 3).
- Full repo contract unaffected: `pnpm test && npm run validate` still pass (nothing in-repo consumed).

## Done criteria

- [ ] `docs-ci.yml` exists with `pull_request` + `documentation/**` path filter, least-privilege permissions, concurrency group, frozen-lockfile install, build, and format check.
- [ ] The exact commands were proven green locally at the planned commit.
- [ ] `git status --short` shows only the new workflow file.

## STOP conditions

- The docs build or format check already fails at the planned-at commit (report; do not bundle a fix).
- The recipe in `deploy-docs.yml` materially differs from what works locally (drift between deploy job and reality — report before duplicating it).
- Any verification gate fails twice after one bounded correction.

## Review focus

- Path-filter correctness (`documentation/**`) and that the job is NOT triggered by unrelated PRs (CI-minutes cost).
- Cache configuration pointing at `documentation/pnpm-lock.yaml`, not the root lockfile.
- Follow-up for the operator, intentionally out of scope here: mark the job required in branch protection; consider DEPS-01 (workspace/version alignment) later.
