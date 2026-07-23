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

## Repository Conventions

- Use Node >=22 for runtime and test scripts.
- Keep runtime plugin code dependency-free and use Node standard library APIs unless a future project explicitly changes that contract. This applies to **shipped** skills/plugins, which must run with no install step; provider CLI subprocesses are the only external execution boundary. **Developer tooling** (git hooks, commit linting, future formatters) may take dependencies.
- Developer dependencies use **pnpm** (`packageManager` is pinned in `package.json`; `pnpm-lock.yaml` is committed). Install with `pnpm install`; CI runs `pnpm install --frozen-lockfile`. Never add runtime dependencies to shipped skills.
- Do not document provider support, marketplace availability, or skills.sh discovery as complete until the release checklist verifies the live provider path.
- Keep plugin-facing documentation accurate to source code and manifests; do not preserve stale workaround notes when the implementation contract changes.
- When editing a standalone skill under `skills/` for local dogfooding, keep the user-level install in sync before closeout. Refresh the canonical copy at `~/.agents/skills/<skill-name>/`, verify provider-specific user skill entries such as `~/.claude/skills/<skill-name>` and `~/.cursor/skills/<skill-name>` resolve to that canonical copy when present, then run `oat sync --scope user`.
- When you ship a behavior or content change to a shipped skill, bump that skill's `version`. Keep the top-level `version` and `metadata.version` in sync — the skills validator (`scripts/validate.mjs`) requires them to match when both are present. The release version-bump tooling's `SKILL_FILES` in `scripts/bump-version.mjs` is derived from disk (`scripts/lib/discover-skills.mjs`, the same `skills/*/SKILL.md` and `plugins/*/skills/*/SKILL.md` discovery contract the validators use), so a new skill's `SKILL.md` is picked up automatically — there is no manual list to update. Do not hand-edit one field and leave the other stale.
- Changed skills must bump their version. Any change under a canonical skill directory (`skills/<name>/` or `plugins/*/skills/<name>/`) — `SKILL.md`, `scripts/`, `references/`, or generated output — requires that skill's `SKILL.md` version to increase. This is enforced by `scripts/validate-skill-versions.mjs` (run `pnpm run validate:skill-versions -- --base-ref <ref>`), wired into the PR-only `skill-versions` CI job and the local `pre-push` hook. It complements the in-sync requirement above (which the structural `scripts/validate.mjs` enforces) and is independent of `SKILL_FILES` — it derives skills from disk. Only `.agents/skills/`, `.claude/skills/`, and `.cursor/skills/` are synced mirrors; never treat them as canonical sources.
- Keep user-level installs current (start-of-work pull). The authoritative user-level install (`~/.agents/skills/<name>/` and its provider mirrors `~/.claude/skills/`, `~/.cursor/skills/`) should track `main`, not in-progress branches. Before starting work that depends on a shipped skill/plugin, check whether the user-level install's version matches `main`; if it is behind, refresh it from `main` first. Land version bumps in `main` before refreshing the global install — never push a branch's bumped version machine-wide pre-merge. (Exception: while actively dogfooding a skill change locally, sync the branch version per the dogfooding convention above, then reconcile to `main` after merge.) This check is meaningful only because version bumps are now enforced on edit — content can otherwise drift with no version change, the exact failure that motivated this convention.
- Generated runtime outputs come from canonical TypeScript source under `src/`. Edit the canonical TypeScript source, run `pnpm run build` to regenerate committed `.mjs` runtime output under `plugins/` and `skills/`, and use `pnpm run build:check` or `tests/tooling/generated-output-sync.test.ts` to catch drift. `pnpm run sync:transcript-core` is a compatibility wrapper around the same generated-output build. Never hand-edit generated `.mjs` outputs with a `// GENERATED` banner, including `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`, `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`, `plugins/consensus/skills/evaluate/scripts/consensus-loop.mjs`, `plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs`, `skills/session-observer/scripts/session-observer.mjs`, `skills/session-observer/scripts/probe-local.mjs`, `skills/session-observer/scripts/lib/*.mjs`, `skills/export-session-transcript/scripts/lib/runtimes.mjs`, `skills/export-session-transcript/scripts/lib/sanitize.mjs`, and `skills/export-session-transcript/scripts/export-session-transcript.mjs`. `skills/session-observer-collab/scripts/` is a different boundary: its `.mjs` control, hook, and lease modules (each paired with a hand-written `.d.ts`) are deliberately authored shipped runtime, not TypeScript build output, and are excluded from the generated pipeline above.

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
2. `node scripts/apply-internal-flags.mjs` — re-stamp `metadata.internal: true`
   on every `.agents/skills/**/SKILL.md` that lacks it. Idempotent; it skips the
   symlinked `session-observer` entry (a canonical standalone skill that must stay
   publicly discoverable).
3. `oat sync` — propagate the canonical skills to the provider mirrors
   (`.claude/skills`, `.cursor/skills`).

**Enforcement:** `pnpm run validate:internal-flags` runs in CI (the PR-scoped
`internal-flags` job in `.github/workflows/validate.yml`) and in the local
`pre-push` hook, so a missing flag cannot merge to `main`. If the gate fails,
run step 2 and re-commit the stamped files.

Do **not** add this flag to `skills/session-observer` or
`skills/export-session-transcript`; those are the intended public standalone
entries, and the apply script already skips the symlinked mirror automatically.

## Commits

- Commit messages and PR titles follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject` (e.g. `feat(consensus): add parallel_revision mode`, `fix(p07-t05): persist routing metadata`, `docs: update README`). Common types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, `build`, `perf`.
- This is enforced locally by the `commit-msg` git hook (`commitlint`) and in CI on pull requests. Hooks install automatically on `pnpm install`; manage them with `pnpm hooks:status` / `pnpm hooks:disable-all`, or bypass a single commit with `git commit --no-verify`. Set `GIT_HOOKS=0` to skip hook setup entirely (CI/Docker).

## Worktrees

- After `git worktree add`, run `pnpm run worktree:init` in the new worktree to copy local-only files (env, `.oat/config.local.json`, local/archived projects, MCP configs), sync OAT local paths, install dependencies, and refresh provider views.
- Run `pnpm run worktree:validate` for a full pre-merge check: it asserts a clean tree, runs `test` + `validate` + `smoke`, and re-asserts cleanliness (catching generated-file drift).

## Linting & Formatting

- JS and Markdown are linted with **oxlint** (`pnpm lint`) and formatted with **oxfmt** (`pnpm format`; `pnpm format:check` to verify). Config: `.oxlintrc.json`, `.oxfmtrc.json`.
- Adoption is **incremental**: the `pre-commit` hook runs `lint-staged` over staged files only, and CI lints/format-checks only the files a PR changes. The repo has not yet been formatted wholesale; a one-time repo-wide `oxfmt` is a planned follow-up. Until then, do not run `pnpm format` across the whole tree in unrelated PRs.
- Never lint/format generated, OAT-synced, or agent-instruction files: generated runtime outputs from `scripts/build-generated.mjs`, `.agents/**`, `.claude/rules/**`, `.cursor/rules/**`, and `AGENTS.md` / `CLAUDE.md` at every level. The root `AGENTS.md` carries an `oat sync`-regenerated `<!-- OAT tools -->` block that oat sync does not keep oxfmt-clean, so formatting it fights the generator. `.oxfmtrc.json` and `.oxlintrc.json` `ignorePatterns` hardcode the same generated-output paths as `scripts/build-generated.mjs`'s `generatedOutputs` (JSON config files cannot import JS, so they can't derive the list dynamically); the `excludes generated outputs from static lint and format configs` case in `tests/tooling/generated-output-sync.test.ts` guards that every generated output stays listed in both, so a missed entry is a failing test rather than a silent gap. `.lintstagedrc.mjs` and the CI `oxfmt --check` / `oxlint` steps in `.github/workflows/validate.yml` already derive their exclusions from `generatedOutputs` directly, no separate sync needed there. Each mapping's `importRewrites` are derived at build time from the source file's actual relative imports (`deriveImportRewrites` in `scripts/build-generated.mjs`) rather than hand-transcribed per entry.
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
  the consensus plugin and the standalone skills.
- **Engineering** (`documentation/docs/engineering/`) — architecture, the
  generated-runtime build contract, repository layout, and contributing.

**Authoring or restructuring docs?** Read
[`documentation/AGENTS.md`](documentation/AGENTS.md) first — it is the docs-app
authoring contract (the `## Contents` navigation rules, the `.md`-link
convention, and the generated-index discipline). Project documentation targets
this site via `oat-project-document`, not the README.
