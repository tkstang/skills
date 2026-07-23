# Git Hooks

Automated git hooks for commit hygiene and pre-push verification. These are
**developer tooling** — they have no effect on the skills/plugins this repo
ships, which stay Node-stdlib-only with no install step.

## Features

- **Automatic setup**: hooks are installed on `pnpm install` (via the `prepare` script).
- **Silent when ready**: no output if hooks are already configured.
- **Skippable in CI/Docker**: set `GIT_HOOKS=0` to skip installation.
- **Individually controllable**: enable/disable specific hooks as needed.

## Available Hooks

- `commit-msg`: validates the message against Conventional Commits (`commitlint`).
- `pre-commit`: runs `lint-staged` (oxlint `--fix` + oxfmt `--write` on staged files), then the OAT drift check (`oat status --scope project --hook`). Fails closed with an actionable message if `pnpm` is not on `PATH`.
- `pre-push`: fast pre-flight (~3s) of cheap static checks — `pnpm run validate`, `build:check`, `type-check`, and the skill-version check (`scripts/validate-skill-versions.mjs`, which requires a SKILL.md version bump for any skill whose directory changed against `main`). The full Vitest suite and `smoke` run in CI, not here, to keep the hook fast. Fails closed with an actionable message if `pnpm` is not on `PATH`.
- `post-checkout`: runs `pnpm install --frozen-lockfile` when `pnpm-lock.yaml` changes between branches (skipped, not failed, if `pnpm` is not on `PATH`).

`pre-commit` carries OAT's marked drift-check block verbatim, so `oat` treats the
block as already present and leaves the symlinked hook in place. If OAT ever
re-installs its own pre-commit, run `pnpm hooks:enable-all` to restore this one.

Linting/formatting is **incremental**: `lint-staged` only touches staged files,
so the (currently unformatted) rest of the repo is migrated as files are edited.
A one-time repo-wide `oxfmt` lands in a separate follow-up.

## Usage

### Automatic (recommended)

Hooks are installed when you run `pnpm install`. If they are already installed,
setup is silent.

### Manual control

```bash
pnpm hooks:status        # show status of all hooks
pnpm hooks:enable-all    # enable all hooks
pnpm hooks:disable-all   # disable all hooks
pnpm hooks enable pre-commit    # enable a specific hook
pnpm hooks disable pre-commit   # disable a specific hook
```

## Skipping Hooks

### In Docker/CI

```dockerfile
ENV GIT_HOOKS=0
RUN pnpm install
```

### Locally (temporary)

```bash
GIT_HOOKS=0 pnpm install   # skip hook setup for this install only
```

### Locally (permanent)

```bash
pnpm hooks:disable-all
```

Disabled hooks are tracked in `.git/hooks/.disabled-hooks` and are not
re-enabled by `pnpm install`.

## How It Works

1. The `prepare` script in `package.json` runs `manage-hooks.mjs setup` after every `pnpm install`.
2. The script exits immediately if `GIT_HOOKS=0`.
3. If all hooks are already installed or intentionally disabled, it exits silently.
4. Otherwise it symlinks missing hooks from `tools/git-hooks/` into Git's resolved hooks directory and reports what changed.

Git's `core.hooksPath` is unset on setup so Git uses its default resolved hooks
directory (which works correctly in linked worktrees).
