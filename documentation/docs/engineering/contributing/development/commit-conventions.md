---
title: 'Commit conventions'
description: 'Conventional Commits format for commit messages and PR titles, the common types, and how the commit-msg hook (commitlint) plus CI enforce it.'
---

# Commit conventions

Commit messages and PR titles follow
[Conventional Commits](https://www.conventionalcommits.org/):
`type(scope): subject`.

Examples:

- `feat(consensus): add parallel_revision mode`
- `fix(p07-t05): persist routing metadata`
- `docs: update README`

Common types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, `build`,
`perf`.

## Enforcement

This is enforced locally by the `commit-msg` git hook (`commitlint`) and in CI on
pull requests. Hooks install automatically on `pnpm install`.

Bypass a single commit with `git commit --no-verify`.

Set `GIT_HOOKS=0` to skip hook setup entirely (CI/Docker).
