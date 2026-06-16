# tests/

Scoped guidance for the test suite. Inherits the root `AGENTS.md`; this file adds only what is specific to `tests/`.

## How tests are written today

- Tests use the Node built-in test runner and strict assertions:
  - `import test from 'node:test'` (or `import { test, describe } from 'node:test'`)
  - `import assert from 'node:assert/strict'`
- New TypeScript/build-contract checks may use Vitest, especially when they exercise developer-only tooling.
- Run the full suite with `npm test` / `pnpm run test`; this runs the existing Node tests plus Vitest.
- Both styles are in use and acceptable: bare `test(...)` and `describe(...)` / `it(...)`.
- Import the unit under test by relative path from the source tree (e.g. `../plugins/...`, `../../skills/...`).
- Filesystem-touching tests create temp dirs under `os.tmpdir()` (`mkdtemp`) and clean them up — the suite must leave a clean working tree (drift guards run in `npm test` / `pnpm run worktree:validate`).

## Generated-output checks

- `tests/generated-output-sync.test.mjs` is a Vitest drift guard for committed generated runtime outputs.
- If you edit canonical TypeScript source for a generated runtime, run `pnpm run build` and then `pnpm run build:check`.
- Do not use Node's built-in test runner for Vitest-owned `.mjs` files; `pnpm run test` already routes each suite to the correct runner.
