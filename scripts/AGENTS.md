# Developer tooling

This scope inherits the root `AGENTS.md`. Run commands below from the repository root. Scripts here build installation units, validate repository contracts, install standalone skills, probe provider behavior, and initialize worktrees. They are developer tooling; shipped runtime owners live under `src/`.

## Build and validation

- Read [Build & Distribution](../documentation/docs/engineering/architecture/generated-runtime.md) before changing build, packaging, or validation scripts. Inspect canonical source and `src/distributions.ts` first.
- For an existing-drift audit, run `pnpm run build:check` before `pnpm run build`. The check compares complete generated inventories, content, and modes without writing; the build replaces declared output after staging and validation.
- Preserve staged validation and owned-output replacement when editing `build-generated.ts` or `lib/packaging.ts`. Change canonical owners and declarations, then regenerate outputs; do not edit committed `skills/` or `plugins/*/skills/` payloads directly.
- Add focused tooling tests under `tests/tooling/` or the existing source owner. Verify the changed boundary with the relevant test and `pnpm run build:check` when distribution output is involved.

## Worktree scripts

- `pnpm run worktree:init` is a mutating bootstrap. It copies local environment files, local OAT config and projects, MCP configuration, and Claude local settings from the main worktree, then runs `pnpm install`. When `oat` is available, it may sync S3 archives (unless `SKIP_S3_ARCHIVE_SYNC=1`), syncs local paths for a separate worktree, and refreshes provider views. Run it only when that setup is needed; it is not a read-only inspection command.
- `pnpm run worktree:validate` runs the full pre-merge validation and expects a clean tree. See [Development conventions](../documentation/docs/engineering/contributing/development/conventions.md#worktrees) for the maintained worktree workflow.

## Done

Confirm the intended source and generated output boundaries, run focused verification, and leave no unintended file changes. Keep repository-wide version, changelog, and formatting policy in the root instructions.
