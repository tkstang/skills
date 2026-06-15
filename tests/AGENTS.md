# tests/

Scoped guidance for the test suite. Inherits the root `AGENTS.md`; this file adds only what is specific to `tests/`.

## How tests are written today

- Tests use the Node built-in test runner and strict assertions:
  - `import test from 'node:test'` (or `import { test, describe } from 'node:test'`)
  - `import assert from 'node:assert/strict'`
- Run the suite with `node --test` (or `npm test` / `pnpm run test`).
- Both styles are in use and acceptable: bare `test(...)` and `describe(...)` / `it(...)`.
- Import the unit under test by relative path from the source tree (e.g. `../plugins/...`, `../../skills/...`).
- Filesystem-touching tests create temp dirs under `os.tmpdir()` (`mkdtemp`) and clean them up — the suite must leave a clean working tree (drift guards run in `npm run validate` / `pnpm run worktree:validate`).

## Planned direction

A TypeScript + **vitest** developer toolchain is planned (backlog `bl-853a`), with a follow-on migration of the existing `node:test` suite to vitest (`bl-bfb4`). Test tooling here is expected to change; treat the conventions above as the current state, not a permanent constraint. Dev tooling (vitest, a TS toolchain) is in bounds — the dependency-free contract in the root `AGENTS.md` applies to **shipped** skills, not to developer tooling.
