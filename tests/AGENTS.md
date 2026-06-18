# tests/

Scoped guidance for the test suite. Inherits the root `AGENTS.md`; this file adds only what is specific to `tests/`.

## How tests are written today

- The suite currently uses a mixed runner contract:
  - Legacy `.test.mjs` files run under Node's built-in test runner with `node:test` and `node:assert/strict`.
  - Migrated and new TypeScript tests use Vitest `.test.ts` files with `vitest` assertions and lifecycle APIs.
- Run the full suite with `npm test` / `pnpm run test`; this runs `test:node` first and then `test:vitest`.
- Do not simplify `pnpm test` to Vitest-only or remove `test:node` until the remaining legacy suites are migrated.
- For migrated TypeScript runtime slices, prefer importing canonical TypeScript source for unit/library behavior and keep shipped `.mjs` entrypoint execution in CLI/integration tests where installed-skill behavior is being protected.
- Session-observer tests are migrated to Vitest TypeScript under `tests/session-observer/`; no `tests/session-observer/**/*.test.mjs` files should be reintroduced.
- Import the unit under test by relative path from the source tree or shipped runtime path appropriate to the behavior under test.
- Filesystem-touching tests create temp dirs under `os.tmpdir()` (`mkdtemp`) and clean them up — the suite must leave a clean working tree (drift guards run in `npm test` / `pnpm run worktree:validate`).

## Generated-output checks

- `tests/generated-output-sync.test.mjs` is a Vitest drift guard for committed generated runtime outputs.
- If you edit canonical TypeScript source for a generated runtime, run `pnpm run build` and then `pnpm run build:check`.
- Do not use Node's built-in test runner for Vitest-owned `.mjs` files; `pnpm run test` already routes each suite to the correct runner.
