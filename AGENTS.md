<!-- OAT tools -->
## Tool Packs

- **Skills directory:** `.agents/skills/`
- **Discover available skills:** scan `.agents/skills/*/SKILL.md`
- **Refresh provider views:** `oat sync --scope all`
- **Update skills to latest versions:** `oat tools update`
- **User-scoped skills:** `~/.agents/skills/` (core, ideas, docs, utility, research, brainstorm packs installed at user scope)

### Installed Packs

- **core** — Diagnostics and documentation (oat-doctor, oat-docs) _(user scope)_
- **ideas** — Idea capture and refinement _(project + user scope)_
- **docs** — Documentation and instruction governance workflows _(project + user scope)_
- **workflows** — Project lifecycle (create, discover, plan, implement, review, complete)
- **utility** — Standalone utilities (skill authoring, maintainability review, code reviews) _(project + user scope)_
- **research** — Research, analysis, verification, and synthesis _(project + user scope)_
- **brainstorm** — Always-on brainstorming entry point with visual companion _(user scope)_
- **project-management** — Local backlog, roadmap, and reference doc management (oat-pjm-* skills)

### Workflow Execution Continuation

- This guidance applies only to OAT project lifecycle execution, such as `oat-project-implement`, and OAT project review/receive flows. It does not apply to non-OAT tasks or ad-hoc work outside the OAT project workflow.
- When executing an OAT project implementation or OAT project review workflow, do not stop at task boundaries, phase boundaries, or other clean checkpoints unless the configured HiLL checkpoint has been reached, a real blocker exists, or explicit user input is required.
- Status summaries, completed bookkeeping, and "clean boundary" pauses are not valid stop reasons. After updating tracking artifacts, continue execution until an allowed stop condition applies.
<!-- END OAT tools -->

<!-- OAT project-management -->
### Project Management

- Installed project-management tools provide capability; they do not prove that this repository adopted PJM.
- Run `oat pjm doctor --json` and inspect `adoption.state` before any PJM write.
- Repository planning and durable context live under `.oat/repo/`.
- Consult it when prioritizing or planning work, checking the backlog, starting or closing tracked work, or looking for established repository context.
- Start with `.oat/repo/AGENTS.md`; it routes to `pjm/` for active state and `reference/` for durable records.
- If adoption is absent or partial, stop and initialize it with `oat pjm init`.
<!-- END OAT project-management -->

<!-- OAT decisions -->
### Decision Records

- Durable repository decisions live under `.oat/repo/reference/decisions/`; read `.oat/repo/reference/decisions/AGENTS.md` before working with them.
- Before finalizing a durable repository decision, review `.oat/repo/reference/decisions/index.md` and any relevant records.
- When the user asks to record a durable decision or confirms a proposed capture, use `oat-pjm-decision` when that skill is installed; otherwise use `oat decision new`.
- Do not hand-edit the generated decision index; run `oat decision regenerate-index` after record changes or to resolve index conflicts.
- Run `oat pjm doctor --json` and inspect `adoption.state` before any decision write.
- If the decision surface is missing, repository adoption is absent or partial; stop and initialize it with `oat pjm init`.
<!-- END OAT decisions -->

## Repository Conventions

- Use Node >=22 for runtime and test scripts.
- Keep runtime plugin code dependency-free and use Node standard library APIs unless a future project explicitly changes that contract. This applies to **shipped** skills/plugins, which must run with no install step; provider CLI subprocesses are the only external execution boundary. **Developer tooling** (git hooks, commit linting, future formatters) may take dependencies.
- Developer dependencies use **pnpm** (`packageManager` is pinned in `package.json`; `pnpm-lock.yaml` is committed). Install with `pnpm install`; CI runs `pnpm install --frozen-lockfile`. Never add runtime dependencies to shipped skills.
- Do not document provider support, marketplace availability, or skills.sh discovery as complete until the release checklist verifies the live provider path.
- Keep plugin-facing documentation accurate to source code and manifests; do not preserve stale workaround notes when the implementation contract changes.
- When editing a canonical standalone-capable skill under `src/skills/` for local dogfooding, build its declared output before syncing a user-level install. Refresh the canonical copy at `~/.agents/skills/<skill-name>/` from the generated `skills/<skill-name>/` payload, verify provider-specific user skill entries such as `~/.claude/skills/<skill-name>` and `~/.cursor/skills/<skill-name>` resolve to that canonical install when present, then run `oat sync --scope user`.
- When you ship a behavior or content change to a skill, bump its sole authored version field: quoted stable SemVer at `metadata.version` in `src/skills/<name>/SKILL.md`. Top-level `version` is rejected. Generated standalone and plugin forms inherit the canonical skill version; plugin release versions are independent.
- Changed skills must bump their version. Any change under a canonical skill directory (`src/skills/<name>/`) — `SKILL.md`, runtime source, tests, references, assets, or build declaration — requires that skill's `metadata.version` to increase. This is enforced by `scripts/validate-skill-versions.ts` (run `pnpm run validate:skill-versions -- --base-ref <ref>`), wired into the PR-only `skill-versions` CI job and the local `pre-push` hook. Only `src/skills/` is authored product-skill source; `skills/`, `plugins/*/skills/`, `.agents/skills/`, `.claude/skills/`, and `.cursor/skills/` are generated installation or provider views.
- Keep user-level installs current (start-of-work pull). The authoritative user-level install (`~/.agents/skills/<name>/` and its provider mirrors `~/.claude/skills/`, `~/.cursor/skills/`) should track `main`, not in-progress branches. Before starting work that depends on a shipped skill/plugin, check whether the user-level install's version matches `main`; if it is behind, refresh it from `main` first. Land version bumps in `main` before refreshing the global install — never push a branch's bumped version machine-wide pre-merge. (Exception: while actively dogfooding a skill change locally, sync the branch version per the dogfooding convention above, then reconcile to `main` after merge.) This check is meaningful only because version bumps are now enforced on edit — content can otherwise drift with no version change, the exact failure that motivated this convention.
- Generated installation units come from canonical owners under `src/skills/`, shared runtime under `src/shared/`, plugin source under `src/plugins/`, and declarations in `src/distributions.ts`. Run `pnpm run build` to regenerate committed payloads under `plugins/` and `skills/`; `pnpm run build:check` checks complete inventories, content, and modes without repairing them. Never hand-edit generated instructions, resources, or runtime. Collaboration's canonical `.mjs` entrypoints under `src/skills/session-observer-collab/src/` are bundled; adjacent `.d.mts` declarations are build-time inputs, not shipped files.
- Before changing source or colocated tests, read [`src/AGENTS.md`](src/AGENTS.md). For build/packaging/validation tooling under `scripts/`, read [Generated installation units](documentation/docs/engineering/architecture/generated-runtime.md); preserve staged validation, owned-output replacement, and non-mutating freshness checks. Plugin roots also contain maintained manifests and docs: they are not wholesale disposable build directories.

## OAT Tooling Skill Internal Flag

The `.agents/skills/**` directory holds `oat sync`-generated mirrors of upstream
OAT tooling skills. These are framework tooling, **not** public installable
skills, so every `.agents/skills/**/SKILL.md` must carry `metadata.internal: true`
— that is the flag the `npx skills` CLI honors to drop a skill from normal
discovery (it reappears only under `INSTALL_INTERNAL_SKILLS=1`). Because those
files are regenerated by `oat tools update` / `oat sync`, the flag is re-applied
by an idempotent in-repo script and guarded by a gate instead of hand-edited.

**Runbook — after refreshing tooling:**

1. `oat tools update` — pull the latest OAT tooling skills (regenerating
   `.agents/skills/**` can drop the flag).
2. `pnpm tsx scripts/apply-internal-flags.ts` — re-stamp `metadata.internal: true`
   on every `.agents/skills/**/SKILL.md` that lacks it. Idempotent; it skips the
   symlinked `session-observer` entry (a public product skill that must stay
   publicly discoverable).
3. `oat sync` — propagate the canonical skills to the provider mirrors
   (`.claude/skills`, `.cursor/skills`).

**Enforcement:** `pnpm run validate:internal-flags` runs in CI (the PR-scoped
`internal-flags` job in `.github/workflows/validate.yml`) and in the local
`pre-push` hook, so a missing flag cannot merge to `main`. If the gate fails,
run step 2 and re-commit the stamped files.

Do **not** add this flag to canonical or generated product skill payloads under
`src/skills/`, `skills/`, or `plugins/*/skills/`; those are intended public
entries. The apply script targets only OAT tooling mirrors and skips the
symlinked product entry automatically.

## Commits

- Commit messages and PR titles follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject` (e.g. `feat(consensus): add parallel_revision mode`, `fix(p07-t05): persist routing metadata`, `docs: update README`). Common types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, `build`, `perf`.
- This is enforced locally by the `commit-msg` git hook (`commitlint`) and in CI on pull requests. Hooks install automatically on `pnpm install`; manage them with `pnpm hooks:status` / `pnpm hooks:disable-all`, or bypass a single commit with `git commit --no-verify`. Set `GIT_HOOKS=0` to skip hook setup entirely (CI/Docker).

## Worktrees

- After `git worktree add`, run `pnpm run worktree:init` in the new worktree to copy local-only files (env, `.oat/config.local.json`, local/archived projects, MCP configs), sync OAT local paths, install dependencies, and refresh provider views.
- Run `pnpm run worktree:validate` for a full pre-merge check: it asserts a clean tree, runs `test` + `validate` + `smoke`, and re-asserts cleanliness (catching generated-file drift).

## Linting & Formatting

- JS and Markdown are linted with **oxlint** (`pnpm lint`) and formatted with **oxfmt** (`pnpm format`; `pnpm format:check` to verify). Config: `.oxlintrc.json`, `.oxfmtrc.json`.
- Adoption is **incremental**: the `pre-commit` hook runs `lint-staged` over staged files only, and CI lints/format-checks only the files a PR changes. The repo has not yet been formatted wholesale; a one-time repo-wide `oxfmt` is a planned follow-up. Until then, do not run `pnpm format` across the whole tree in unrelated PRs.
- Never lint/format generated, OAT-synced, or agent-instruction files: generated installation outputs from `scripts/build-generated.ts`, `.agents/**`, `.claude/rules/**`, `.cursor/rules/**`, and `AGENTS.md` / `CLAUDE.md` at every level. The root `AGENTS.md` carries an `oat sync`-regenerated `<!-- OAT tools -->` block that oat sync does not keep oxfmt-clean, so formatting it fights the generator. `.oxfmtrc.json` and `.oxlintrc.json` `ignorePatterns` cover the generated distribution outputs resolved by the build (JSON config files cannot import TypeScript); the `excludes generated outputs from static lint and format configs` case in `tests/tooling/generated-output-sync.test.ts` guards that every generated output stays listed in both, so a missed entry is a failing test rather than a silent gap. `.lintstagedrc.mjs` and the CI `oxfmt --check` / `oxlint` steps in `.github/workflows/validate.yml` derive their exclusions from the distribution catalog directly. Import rewrites are derived from each source file's actual relative imports rather than hand-transcribed per output.
- oxlint/oxfmt are **dev tooling** — they do not touch what shipped skills run.

## Verification

- Run `npm test` (or `pnpm run test`) for the full Vitest suite.
- Run `pnpm run build:check` to verify complete generated installation units match canonical inputs.
- Run `npm run validate` for repository structure, manifest, and docs invariants.
- Run `npm run smoke` for the mocked end-to-end consensus wrapper flow.
- Run `pnpm run test:live-e2e` as the opt-in live-provider gate (requires an authenticated provider CLI and spends real API quota; see `RELEASING.md`).

## References

- `README.md` — repo overview, layout, and install paths.
- `CONTRIBUTING.md` — contribution workflow.
- `RELEASING.md` — release checklist and provider-path verification.

## Using OAT PJM

This repo tracks work in a file-backed backlog at `.oat/repo/pjm/backlog/`
(roadmap and current-state live alongside it under `.oat/repo/pjm/`).

- Before starting non-trivial work, check whether an open backlog item already
  covers it (`.oat/repo/pjm/backlog/index.md`).
- If your change satisfies an open backlog item's acceptance criteria — even a
  small doc or chore commit made outside an OAT project lifecycle — close and
  archive that item in the same commit/PR, following the **Backlog Lifecycle**
  in `.oat/repo/pjm/AGENTS.md`.
- Offer to capture genuinely new follow-up work as a backlog item
  (`oat-pjm-add-backlog-item`) rather than leaving it in chat.

<!-- OAT docs -->
## Documentation

- **Docs root:** `documentation`
- **Framework:** Fumadocs (Next.js + MDX)
- **Index file:** `documentation/docs/index.md`
<!-- END OAT docs -->

The docs site is the repo's most complete reference (the README is only an entry
point). It is organized into two audience trunks — start at
[`documentation/docs/index.md`](documentation/docs/index.md):

- **User Guide** (`documentation/docs/user-guide/`) — install, use, and configure
  the consensus and session plugins and the standalone skills.
- **Engineering** (`documentation/docs/engineering/`) — architecture, the
  generated-runtime build contract, repository layout, and contributing.

**Authoring or restructuring docs?** Read
[`documentation/AGENTS.md`](documentation/AGENTS.md) first — it is the docs-app
authoring contract (the `## Contents` navigation rules, the `.md`-link
convention, and the generated-index discipline). Project documentation targets
this site via `oat-project-document`, not the README.
