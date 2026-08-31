---
oat_generated: true
oat_generated_at: 2026-08-31
oat_source_head_sha: ae313c5bb6e54d521b4b00d0f44993b8fdf72ecc
oat_source_main_merge_base_sha: 467efe57bcb5e40b2cfb09c77507aa50e4c1cc44
oat_warning: 'GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index'
---

# Testing Patterns

**Analysis Date:** 2026-08-31

## Test Framework

**Runner:**

- Vitest `^4.1.9` is declared in `package.json`; `vitest.config.mjs` sets the Node environment, `tests/**/*.test.ts` / `tests/**/*.test.mts` discovery, and 30-second test and hook timeouts.
- `package.json` runs `scripts/run-vitest.mjs` through `pnpm run test:vitest` and `pnpm run test`.

**Assertion Library:**

- Vitest's `expect` is imported alongside suite helpers in `tests/consensus/provider-cli/adapters.test.ts` and `tests/consensus/evaluate/output.test.ts`.

**Run Commands:**

```bash
pnpm run test             # Full Vitest suite; package.json
pnpm run test:vitest      # Direct repository runner; package.json
pnpm run test:live-e2e    # Opt-in live provider test; package.json
pnpm run build:check      # Generated-runtime drift check; package.json
```

- No watch-mode package command or coverage provider/report command is configured in `package.json` or `vitest.config.mjs`.

## Test File Organization

**Location:**

- `tests/` is organized by behavior domain: consensus, session observer, session-observer collaboration, transcript core, export session transcript, repository, release, scripts, and tooling (`tests/AGENTS.md`).
- Reusable utilities are under `tests/helpers/` (`tests/helpers/process.mjs`, `tests/helpers/consensus.ts`) and static inputs/stub executables under `tests/fixtures/` (`tests/fixtures/sample-input.md`, `tests/fixtures/bin/consensus`).

**Naming:**

- TypeScript test files end in `.test.ts`, including `tests/consensus/evaluate/output.test.ts`, `tests/session-observer/observe.test.ts`, and `tests/tooling/generated-output-sync.test.ts`.
- `tests/tooling/no-node-test-runner.test.ts` enforces the `tests/AGENTS.md` prohibition on new legacy runner imports and `.test.mjs` files.

**Structure:**

```
tests/
├── consensus/                 # core, wrappers, provider CLI, generated imports
│   ├── core/
│   ├── refine/
│   ├── evaluate/
│   └── provider-cli/
├── session-observer/          # runtime and CLI behavior
├── session-observer-collab/   # collaboration hooks and control
├── transcript-core/           # canonical transcript library
├── tooling/                   # build, hook, and policy guards
├── helpers/                   # shared non-test utilities
└── fixtures/                  # static files and executable stubs
```

This layout is described by `tests/AGENTS.md` and represented in `tests/consensus/refine/`, `tests/session-observer/`, and `tests/tooling/`.

## Test Structure

**Suite Organization:**

```typescript
// tests/consensus/provider-cli/adapters.test.ts
describe('provider adapter registry', () => {
  it('registers provider adapters by user-facing ID', () => {
    const registry = providerRegistry();
    expect(registry.list().map((adapter) => adapter.id)).toEqual([
      'claude', 'codex', 'cursor',
    ]);
  });
});
```

**Patterns:**

- `describe` + `it` / `test` groups related behavior; focused files use top-level `it` where a suite label adds no value (`tests/consensus/provider-cli/adapters.test.ts`, `tests/consensus/evaluate/output.test.ts`).
- Canonical TypeScript source is imported for migrated unit/library behavior (`tests/consensus/evaluate/output.test.ts`), while installed-runtime behavior imports generated `.mjs` artifacts (`tests/consensus/refine/parallel-errors.test.ts`), matching `tests/AGENTS.md`.
- Async tests await operations and use promise matchers, for example `await expect(stat(...)).resolves.toMatchObject({})` in `tests/consensus/evaluate/output.test.ts`.
- Temp data uses `mkdtemp` below `os.tmpdir()` (`tests/consensus/evaluate/output.test.ts`); environment-changing tests restore state and remove temp directories in `finally` (`tests/session-observer/watch.test.ts`), as required by `tests/AGENTS.md`.

## Mocking

**Framework:** Vitest `vi`, used in `tests/consensus/core/loop-records.test.ts` and `tests/session-observer/locate.test.ts`.

**Patterns:**

```typescript
// tests/consensus/core/loop-records.test.ts
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, rename: vi.fn(actual.rename) };
});
```

- Mocks preserve the real module and replace only a needed boundary; `tests/session-observer/locate.test.ts` uses `vi.hoisted` state to model filesystem failures and count reads.
- Process-global spies are restored in `afterEach`, as in `tests/session-observer/watch.test.ts` and `tests/session-observer/watch-state.test.ts`.

**What to Mock:**

- Filesystem/process failure boundaries are mocked or injected when deterministic failure behavior matters (`tests/consensus/core/loop-records.test.ts`, `tests/session-observer/locate.test.ts`).
- Provider calls are commonly injected as async functions in wrapper tests, such as `tests/consensus/evaluate/output.test.ts`.

**What NOT to Mock:**

- Real temporary files validate output artifacts and paths in `tests/consensus/refine/parallel-errors.test.ts` and `tests/consensus/evaluate/output.test.ts`.
- Integration tests use owned stubs rather than provider accounts: `tests/helpers/process.mjs` prepends `tests/fixtures/bin/` to `PATH` and points to `tests/fixtures/bin/consensus`.

## Fixtures and Factories

**Test Data:**

```typescript
// tests/helpers/consensus.ts
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-loop-'));
const sectionFile = path.join(tempRoot, 'section.md');
await writeFile(sectionFile, sectionText);
return { tempRoot, options: { sectionFile, peers: ['claude', 'codex'] } };
```

- `tests/helpers/consensus.ts` holds reusable consensus builders and JSON parsing; `tests/helpers/process.mjs` provides repository paths, output capture, subprocess execution, and fixture environments.
- Local factories remain next to behavior-specific tests, including `fixtureFiles` in `tests/consensus/evaluate/output.test.ts` and `prepareBrokenManifest` in `tests/consensus/refine/parallel-errors.test.ts`.

**Location:**

- Static fixtures are in `tests/fixtures/`; session-observer transcript fixtures are in `tests/session-observer/fixtures/` and described by `tests/session-observer/fixtures/README.md`.

## Coverage

**Requirements:** None enforced or configured: `package.json` has no coverage script and `vitest.config.mjs` has no coverage configuration.

**View Coverage:**

```bash
# Not configured in package.json or vitest.config.mjs.
```

## Test Types

**Unit Tests:**

- Direct source behavior is covered in `tests/consensus/provider-cli/adapters.test.ts` and `tests/consensus/evaluate/output.test.ts`; repository invariant guards live in `tests/tooling/generated-output-sync.test.ts`, `tests/repo/layout.test.ts`, and `tests/release/skill-version-bumps.test.ts`.

**Integration Tests:**

- Temp filesystem, CLI wrapper, and subprocess behavior is tested by `tests/consensus/refine/parallel-errors.test.ts`, `tests/consensus/core/provider-cli-invocation.test.ts`, and `tests/session-observer/cli.test.ts`.
- Generated import/runtime behavior is explicitly guarded by `tests/consensus/generated-refine-import.test.ts`, `tests/consensus/generated-evaluate-import.test.ts`, and `tests/consensus/refine/parallel-errors.test.ts`.

**E2E Tests:**

- `tests/consensus/provider-cli/e2e/submit-live.e2e.test.ts` runs only through `pnpm run test:live-e2e`, which sets `CONSENSUS_LIVE_SUBMIT_E2E=1` in `package.json`; its release gate is documented in `RELEASING.md`.

## Common Patterns

**Async Testing:**

```typescript
// tests/consensus/evaluate/output.test.ts
const result = await runConsensusEvaluate(argv, options);
await expect(stat(result.paths.records)).resolves.toMatchObject({});
expect(result.status.status).toBe('converged');
```

**Error Testing:**

```typescript
// tests/consensus/refine/parallel-errors.test.ts
const exitCode = await runWrapperCli(argv, { stdout, stderr });
expect(exitCode).toBe(EXIT_CODES.SECTION_ERROR);
expect(stderr.value()).toMatch(/section error or impasse/i);
```

---

_Testing analysis: 2026-08-31_
