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
- **project-management** — Local backlog, roadmap, and reference doc management (oat-pjm-* skills)
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
- Keep runtime plugin code dependency-free and use Node standard library APIs unless a future project explicitly changes that contract. This applies to **shipped** skills/plugins, which must run with no install step (Paseo is the only external boundary; see DR-002). **Developer tooling** (git hooks, commit linting, future formatters) may take dependencies.
- Developer dependencies use **pnpm** (`packageManager` is pinned in `package.json`; `pnpm-lock.yaml` is committed). Install with `pnpm install`; CI runs `pnpm install --frozen-lockfile`. Never add runtime dependencies to shipped skills.
- Do not document provider support, marketplace availability, or skills.sh discovery as complete until the release checklist verifies the live provider path.
- Keep plugin-facing documentation accurate to source code and manifests; do not preserve stale workaround notes when the implementation contract changes.
- When editing a standalone skill under `skills/` for local dogfooding, keep the user-level install in sync before closeout. Refresh the canonical copy at `~/.agents/skills/<skill-name>/`, verify provider-specific user skill entries such as `~/.claude/skills/<skill-name>` and `~/.cursor/skills/<skill-name>` resolve to that canonical copy when present, then run `oat sync --scope user`.
- Shared transcript-format logic has a single source of truth at `shared/transcript-core/runtimes.mjs`. Skills that need it (e.g. `session-observer`, `export-session-transcript`) carry a **generated** committed copy at `scripts/lib/runtimes.mjs`. Edit only the canonical file, then run `npm run sync:transcript-core` to regenerate every consumer copy; never hand-edit the generated copies (they carry a `// GENERATED` banner). A drift guard (`tests/transcript-core/sync.test.mjs`) fails `npm test` if any copy diverges from canonical.

## Commits

- Commit messages and PR titles follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject` (e.g. `feat(consensus): add parallel_revision mode`, `fix(p07-t05): persist routing metadata`, `docs: update README`). Common types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, `build`, `perf`.
- This is enforced locally by the `commit-msg` git hook (`commitlint`) and in CI on pull requests. Hooks install automatically on `pnpm install`; manage them with `pnpm hooks:status` / `pnpm hooks:disable-all`, or bypass a single commit with `git commit --no-verify`. Set `GIT_HOOKS=0` to skip hook setup entirely (CI/Docker).
- End commit messages with the agent co-authorship trailer when an agent made the commit, e.g. `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## Worktrees

- After `git worktree add`, run `pnpm run worktree:init` in the new worktree to copy local-only files (env, `.oat/config.local.json`, local/archived projects, MCP configs), sync OAT local paths, install dependencies, and refresh provider views.
- Run `pnpm run worktree:validate` for a full pre-merge check: it asserts a clean tree, runs `test` + `validate` + `smoke`, and re-asserts cleanliness (catching generated-file drift such as the transcript-core sync).

## Linting & Formatting

- JS and Markdown are linted with **oxlint** (`pnpm lint`) and formatted with **oxfmt** (`pnpm format`; `pnpm format:check` to verify). Config: `.oxlintrc.json`, `.oxfmtrc.json`.
- Adoption is **incremental**: the `pre-commit` hook runs `lint-staged` over staged files only, and CI lints/format-checks only the files a PR changes. The repo has not yet been formatted wholesale; a one-time repo-wide `oxfmt` is a planned follow-up. Until then, do not run `pnpm format` across the whole tree in unrelated PRs.
- Never lint/format generated or OAT-synced files: `**/scripts/lib/runtimes.mjs` (generated transcript-core copies), `.agents/**`, `.claude/rules/**`, `.cursor/rules/**`. These are excluded by `.oxfmtrc.json` and `.lintstagedrc.mjs` (and not linted by oxlint, which only processes JS/MJS — the `.claude/rules/**` and `.cursor/rules/**` Markdown is never linted regardless).
- oxlint/oxfmt are **dev tooling** — they do not touch what shipped skills run.

## Verification

- Run `npm test` (or `pnpm run test`) for the full Node test suite.
- Run `npm run validate` for repository structure, manifest, and docs invariants.
- Run `npm run smoke` for the mocked end-to-end consensus wrapper flow.

## References

- `README.md` — repo overview, layout, and install paths.
- `CONTRIBUTING.md` — contribution workflow.
- `RELEASING.md` — release checklist and provider-path verification.
