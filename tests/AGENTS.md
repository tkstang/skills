# tests/

Scoped guidance for repository, release, and tooling tests under `tests/`. Inherits the root `AGENTS.md`. Tests colocated under `src/` follow [source instructions](../src/AGENTS.md), not this directory's automatic scope. Run the commands below from the repository root.

## How tests are written today

- All suites are Vitest `.test.ts` files using `import { describe, it, expect } from 'vitest'`.
- Run the full suite with `npm test` / `pnpm run test`; this runs the Vitest suite only.
- For migrated TypeScript runtime slices, prefer importing canonical TypeScript source for unit/library behavior and keep shipped `.mjs` entrypoint execution in CLI/integration tests where installed-skill behavior is being protected.
- Skill, shared-runtime, plugin, and experimental-tool behavior tests stay with their source owners; no `.test.mjs` files should be reintroduced.
- Import the unit under test by relative path from the source tree or shipped runtime path appropriate to the behavior under test.
- Filesystem-touching tests create temp dirs under `os.tmpdir()` (`mkdtemp`) and clean them up — the suite must leave a clean working tree (drift guards run in `npm test` / `pnpm run worktree:validate`).
- The `tests/tooling/no-node-test-runner.test.ts` guard enforces that no new legacy test-runner imports or `.test.mjs` files are introduced.

## Domain layout

Tests are organized by domain. Add new tests under the matching domain directory.

| Directory | What lives here |
| --------- | --------------- |
| `tests/repo/` | Repository invariants: layout, docs presence, plugin manifests, marketplace manifests, package metadata, skill frontmatter, README scope. |
| `tests/release/` | Release and versioning: version bump scripts, validate script behavior, smoke-test script. |
| `tests/tooling/` | Test tooling and build guards: no-node-test-runner policy, vitest config check, generated-output drift guard. |
| `tests/helpers/` | Shared test utilities: subprocess execution, temp dirs, fixture-bin PATH, JSONL parsing, repo root resolution, JSON reading, consensus JSON block extraction. Not test files — no `.test.ts` here. |
| `tests/fixtures/` | Static fixture files used by tests: sample markdown input, stub binaries, etc. |

## Import depth convention

Depth from a test file to its imported source determines how many `../` hops are needed:

- Colocated tests under `src/` normally import sibling modules with `./`.
- Files one level deep under `tests/` (`tests/tooling/`, `tests/repo/`, and `tests/release/`) reach the repository root with `'../../'`.

Shared helpers live at `tests/helpers/`; calculate their relative imports from the colocated test's actual depth rather than copying a legacy domain path.

## Generated-output checks

- `tests/tooling/generated-output-sync.test.ts` guards complete generated installation-unit inventories, content, and modes: instructions/resources count as well as runtime.
- For an existing-drift audit, run `pnpm run build:check` before any repairing build. After intended canonical changes, build, inspect the generated diff, then check freshness.
- Use the existing [packaging suite](tooling/skill-packaging.test.ts) for representative isolated installation contracts. See [Development](../documentation/docs/engineering/contributing/development/index.md) for test ownership and minimum sufficient proof; do not add a provider matrix or live runs merely to test packaging.
