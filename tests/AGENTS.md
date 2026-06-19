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

## Domain layout

Tests are organized by domain. Add new tests under the matching domain directory.

| Directory | What lives here |
| --------- | --------------- |
| `tests/consensus/core/` | Core loop behavior: alternating iteration, convergence detection, escalation detection, records, verdict validation. Import the generated `consensus-loop.mjs` shipped artifact. |
| `tests/consensus/refine/` | Refine wrapper behavior: sequential and parallel orchestration, parallel prepare/fan-in, wrapper CLI options, section parsing, resume/corruption handling, path safety, host-dispatch docs, provider subprocess invocation. Import the generated `consensus-refine.mjs` / `consensus-loop.mjs` shipped artifacts. |
| `tests/consensus/evaluate/` | Evaluate skill behavior: output rendering, prompt profiles, schema parity, wrapper arg parsing. Import from canonical TypeScript source under `src/consensus/evaluate/`. |
| `tests/consensus/` | Generated-entrypoint import checks: verify that the generated refine and evaluate runtimes import the correct sibling loop file, not the canonical TypeScript source. |
| `tests/repo/` | Repository invariants: layout, docs presence, plugin manifests, marketplace manifests, package metadata, skill frontmatter, README scope. |
| `tests/release/` | Release and versioning: version bump scripts, validate script behavior, smoke-test script. |
| `tests/tooling/` | Test tooling and build guards: no-node-test-runner policy, vitest config check, generated-output drift guard. |
| `tests/session-observer/` | Session-observer skill behavior (existing directory). |
| `tests/export-session-transcript/` | Export-session-transcript skill behavior (existing directory). |
| `tests/transcript-core/` | Transcript-core runtime behavior (existing directory). |
| `tests/helpers/` | Shared test utilities: subprocess execution, temp dirs, fixture-bin PATH, JSONL parsing, repo root resolution, JSON reading, consensus JSON block extraction. Not test files — no `.test.ts` here. |
| `tests/fixtures/` | Static fixture files used by tests: sample markdown input, stub binaries, etc. |

## Import depth convention

Depth from the test file to the repo root determines how many `../` hops are needed:

- Files directly in `tests/` (none remain after reorganization) — `'../'`
- Files one level deep (`tests/tooling/`, `tests/repo/`, `tests/release/`, `tests/consensus/`, `tests/session-observer/`, etc.) — `'../../'`
- Files two levels deep (`tests/consensus/core/`, `tests/consensus/refine/`, `tests/consensus/evaluate/`) — `'../../../'`

Shared helpers live at `tests/helpers/`; import them as `'../../helpers/...'` from two-level subdirectories, `'../helpers/...'` from one-level subdirectories.

## Generated-output checks

- `tests/tooling/generated-output-sync.test.ts` is a Vitest drift guard for committed generated runtime outputs.
- If you edit canonical TypeScript source for a generated runtime, run `pnpm run build` and then `pnpm run build:check`.
