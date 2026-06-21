---
title: 'Hooks and safety'
description: 'Git hooks in this repo: install on pnpm install, pre-commit lint-staged (oxlint/oxfmt over staged files), skill version-bump enforcement, and the lint/format exclusions for generated, synced, and agent-instruction files.'
---

# Hooks and safety

## Git hooks

Hooks install automatically on `pnpm install`. Manage them with:

```bash
pnpm hooks:status
pnpm hooks:disable-all
```

Bypass a single commit with `git commit --no-verify`. Set `GIT_HOOKS=0` to skip
hook setup entirely (CI/Docker).

## Pre-commit: lint-staged

The `pre-commit` hook runs `lint-staged` over staged files only. JS and Markdown
are linted with **oxlint** (`pnpm lint`) and formatted with **oxfmt**
(`pnpm format`; `pnpm format:check` to verify). Config: `.oxlintrc.json`,
`.oxfmtrc.json`.

Adoption is **incremental**: the `pre-commit` hook runs `lint-staged` over staged
files only, and CI lints/format-checks only the files a PR changes. The repo has
not yet been formatted wholesale; a one-time repo-wide `oxfmt` is a planned
follow-up. Until then, do not run `pnpm format` across the whole tree in unrelated
PRs.

## Pre-push: skill version-bump enforcement

Changed skills must bump their version. Any change under a canonical skill
directory (`skills/<name>/` or `plugins/*/skills/<name>/`) requires that skill's
`SKILL.md` version to increase. This is enforced by
`scripts/validate-skill-versions.mjs`:

```bash
pnpm run validate:skill-versions -- --base-ref <ref>
```

It is wired into the PR-only `skill-versions` CI job and the local `pre-push`
hook.

## Lint/format exclusions

Never lint/format generated, OAT-synced, or agent-instruction files: generated
runtime outputs from `scripts/build-generated.mjs`, `.agents/**`,
`.claude/rules/**`, `.cursor/rules/**`, and `AGENTS.md` / `CLAUDE.md` at every
level.

Format exclusions must stay in sync across `.oxfmtrc.json`, `.lintstagedrc.mjs`,
and the CI `oxfmt --check` step in `.github/workflows/validate.yml`; generated
`.mjs` lint exclusions must also stay in sync across `.oxlintrc.json`,
`.lintstagedrc.mjs`, and the CI `oxlint` step.

oxlint/oxfmt are **dev tooling** — they do not touch what shipped skills run.
