# tests/

Scoped guidance for the test suite. Inherits the root `AGENTS.md`; this file adds only what is specific to `tests/`.

## How tests are written today

- All suites are Vitest `.test.ts` files using `import { describe, it, expect } from 'vitest'`.
- Run the full suite with `npm test` / `pnpm run test`; this runs the Vitest suite only.
- For migrated TypeScript runtime slices, prefer importing canonical TypeScript source for unit/library behavior and keep shipped `.mjs` entrypoint execution in CLI/integration tests where installed-skill behavior is being protected.
- Session-observer tests are under `tests/session-observer/`; no `tests/session-observer/**/*.test.mjs` files should be reintroduced.
- Import the unit under test by relative path from the source tree or shipped runtime path appropriate to the behavior under test.
- Filesystem-touching tests create temp dirs under `os.tmpdir()` (`mkdtemp`) and clean them up — the suite must leave a clean working tree (drift guards run in `npm test` / `pnpm run worktree:validate`).
- The `tests/tooling/no-node-test-runner.test.ts` guard enforces that no new legacy test-runner imports or `.test.mjs` files are introduced.

## Generated-output checks

- `tests/generated-output-sync.test.ts` is a Vitest drift guard for committed generated runtime outputs.
- If you edit canonical TypeScript source for a generated runtime, run `pnpm run build` and then `pnpm run build:check`.
