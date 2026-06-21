<!-- OAT tools -->

## Tool Packs

- **Skills directory:** `.agents/skills/`
- **Discover available skills:** scan `.agents/skills/*/SKILL.md`
- **Refresh provider views:** `oat sync --scope all`
- **Update skills to latest versions:** `oat tools update`
- **User-scoped skills:** `~/.agents/skills/` (core, brainstorm packs installed at user scope)

### Installed Packs

- **core** — Diagnostics and documentation (oat-doctor, oat-docs) _(user scope)_
- **ideas** — Idea capture and refinement
- **docs** — Documentation and instruction governance workflows
- **project-management** — Local backlog, roadmap, and reference doc management (oat-pjm-\* skills)
- **workflows** — Project lifecycle (create, discover, plan, implement, review, complete)
- **utility** — Standalone utilities (skill authoring, maintainability review, code reviews)
- **research** — Research, analysis, verification, and synthesis
- **brainstorm** — Always-on brainstorming entry point with visual companion _(user scope)_

### Workflow Execution Continuation

- This guidance applies only to OAT project lifecycle execution, such as `oat-project-implement`, and OAT project review/receive flows. It does not apply to non-OAT tasks or ad-hoc work outside the OAT project workflow.
- When executing an OAT project implementation or OAT project review workflow, do not stop at task boundaries, phase boundaries, or other clean checkpoints unless the configured HiLL checkpoint has been reached, a real blocker exists, or explicit user input is required.
- Status summaries, completed bookkeeping, and "clean boundary" pauses are not valid stop reasons. After updating tracking artifacts, continue execution until an allowed stop condition applies.
<!-- END OAT tools -->

## Repository Conventions

- Use Node >=22 for runtime and test scripts.
- Keep runtime plugin code dependency-free and use Node standard library APIs unless a future project explicitly changes that contract. This applies to **shipped** skills/plugins, which must run with no install step; provider CLI subprocesses are the only external execution boundary. **Developer tooling** (git hooks, commit linting, future formatters) may take dependencies.
- Developer dependencies use **pnpm** (`packageManager` is pinned in `package.json`; `pnpm-lock.yaml` is committed). Install with `pnpm install`; CI runs `pnpm install --frozen-lockfile`. Never add runtime dependencies to shipped skills.
- Do not document provider support, marketplace availability, or skills.sh discovery as complete until the release checklist verifies the live provider path.
- Keep plugin-facing documentation accurate to source code and manifests; do not preserve stale workaround notes when the implementation contract changes.
- When editing a standalone skill under `skills/` for local dogfooding, keep the user-level install in sync before closeout. Refresh the canonical copy at `~/.agents/skills/<skill-name>/`, verify provider-specific user skill entries such as `~/.claude/skills/<skill-name>` and `~/.cursor/skills/<skill-name>` resolve to that canonical copy when present, then run `oat sync --scope user`.
- When you ship a behavior or content change to a shipped skill, bump that skill's `version`. Keep the top-level `version` and `metadata.version` in sync — the skills validator (`scripts/validate.mjs`) requires them to match when both are present — and make sure the skill is listed in `SKILL_FILES` in `scripts/bump-version.mjs` so the release version-bump tooling updates both fields together. Do not hand-edit one field and leave the other stale.
- Changed skills must bump their version. Any change under a canonical skill directory (`skills/<name>/` or `plugins/*/skills/<name>/`) — `SKILL.md`, `scripts/`, `references/`, or generated output — requires that skill's `SKILL.md` version to increase. This is enforced by `scripts/validate-skill-versions.mjs` (run `pnpm run validate:skill-versions -- --base-ref <ref>`), wired into the PR-only `skill-versions` CI job and the local `pre-push` hook. It complements the in-sync requirement above (which the structural `scripts/validate.mjs` enforces) and is independent of `SKILL_FILES` — it derives skills from disk. Only `.agents/skills/`, `.claude/skills/`, and `.cursor/skills/` are synced mirrors; never treat them as canonical sources.
- Keep user-level installs current (start-of-work pull). The authoritative user-level install (`~/.agents/skills/<name>/` and its provider mirrors `~/.claude/skills/`, `~/.cursor/skills/`) should track `main`, not in-progress branches. Before starting work that depends on a shipped skill/plugin, check whether the user-level install's version matches `main`; if it is behind, refresh it from `main` first. Land version bumps in `main` before refreshing the global install — never push a branch's bumped version machine-wide pre-merge. (Exception: while actively dogfooding a skill change locally, sync the branch version per the dogfooding convention above, then reconcile to `main` after merge.) This check is meaningful only because version bumps are now enforced on edit — content can otherwise drift with no version change, the exact failure that motivated this convention.
- Generated runtime outputs come from canonical TypeScript source under `src/`. Edit the canonical TypeScript source, run `pnpm run build` to regenerate committed `.mjs` runtime output under `plugins/` and `skills/`, and use `pnpm run build:check` or `tests/tooling/generated-output-sync.test.ts` to catch drift. `pnpm run sync:transcript-core` is a compatibility wrapper around the same generated-output build. Never hand-edit generated `.mjs` outputs with a `// GENERATED` banner, including `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`, `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`, `plugins/consensus/skills/evaluate/scripts/consensus-loop.mjs`, `plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs`, `skills/session-observer/scripts/session-observer.mjs`, `skills/session-observer/scripts/probe-local.mjs`, `skills/session-observer/scripts/lib/*.mjs`, `skills/export-session-transcript/scripts/lib/runtimes.mjs`, `skills/export-session-transcript/scripts/lib/sanitize.mjs`, and `skills/export-session-transcript/scripts/export-session-transcript.mjs`.

## Commits

- Commit messages and PR titles follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject` (e.g. `feat(consensus): add parallel_revision mode`, `fix(p07-t05): persist routing metadata`, `docs: update README`). Common types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, `build`, `perf`.
- This is enforced locally by the `commit-msg` git hook (`commitlint`) and in CI on pull requests. Hooks install automatically on `pnpm install`; manage them with `pnpm hooks:status` / `pnpm hooks:disable-all`, or bypass a single commit with `git commit --no-verify`. Set `GIT_HOOKS=0` to skip hook setup entirely (CI/Docker).

## Worktrees

- After `git worktree add`, run `pnpm run worktree:init` in the new worktree to copy local-only files (env, `.oat/config.local.json`, local/archived projects, MCP configs), sync OAT local paths, install dependencies, and refresh provider views.
- Run `pnpm run worktree:validate` for a full pre-merge check: it asserts a clean tree, runs `test` + `validate` + `smoke`, and re-asserts cleanliness (catching generated-file drift).

## Linting & Formatting

- JS and Markdown are linted with **oxlint** (`pnpm lint`) and formatted with **oxfmt** (`pnpm format`; `pnpm format:check` to verify). Config: `.oxlintrc.json`, `.oxfmtrc.json`.
- Adoption is **incremental**: the `pre-commit` hook runs `lint-staged` over staged files only, and CI lints/format-checks only the files a PR changes. The repo has not yet been formatted wholesale; a one-time repo-wide `oxfmt` is a planned follow-up. Until then, do not run `pnpm format` across the whole tree in unrelated PRs.
- Never lint/format generated, OAT-synced, or agent-instruction files: generated runtime outputs from `scripts/build-generated.mjs`, `.agents/**`, `.claude/rules/**`, `.cursor/rules/**`, and `AGENTS.md` / `CLAUDE.md` at every level. The root `AGENTS.md` carries an `oat sync`-regenerated `<!-- OAT tools -->` block that oat sync does not keep oxfmt-clean, so formatting it fights the generator. Format exclusions must stay in sync across `.oxfmtrc.json`, `.lintstagedrc.mjs`, and the CI `oxfmt --check` step in `.github/workflows/validate.yml`; generated `.mjs` lint exclusions must also stay in sync across `.oxlintrc.json`, `.lintstagedrc.mjs`, and the CI `oxlint` step.
- oxlint/oxfmt are **dev tooling** — they do not touch what shipped skills run.

## Verification

- Run `npm test` (or `pnpm run test`) for the full Vitest suite.
- Run `pnpm run build:check` to verify generated runtime outputs match canonical source.
- Run `npm run validate` for repository structure, manifest, and docs invariants.
- Run `npm run smoke` for the mocked end-to-end consensus wrapper flow.

## References

- `README.md` — repo overview, layout, and install paths.
- `CONTRIBUTING.md` — contribution workflow.
- `RELEASING.md` — release checklist and provider-path verification.

<!-- OAT docs -->
## Documentation

- **Docs root:** `documentation`
- **Framework:** Fumadocs (Next.js + MDX)
- **Index file:** `documentation/docs/index.md`
<!-- END OAT docs -->
