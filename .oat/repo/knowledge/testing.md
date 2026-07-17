---
oat_generated: true
oat_generated_at: 2026-07-17
oat_source_head_sha: 6c03afde1417fbe29f0e2c81009629f0e36ca945
oat_source_main_merge_base_sha: 6c03afde1417fbe29f0e2c81009629f0e36ca945
oat_warning: 'GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index'
---

# Testing Patterns

**Analysis Date:** 2026-07-17

## Test Framework

**Runner:**

- **Vitest** 4.1.9 (configured in `vitest.config.mjs`)
- Environment: Node.js
- TypeScript support via native ESM transpilation
- Test timeout: 30 seconds (both individual tests and hooks)
- Include pattern: `tests/**/*.test.ts`, `tests/**/*.test.mts`

**Assertion Library:**

- **Vitest** built-in `expect()` assertions
- Import: `import { expect, describe, test } from 'vitest';`
- Methods observed: `.toBe()`, `.toEqual()`, `.toHaveLength()`, `.toContain()`, `.toBeTruthy()`, `.toBeFalsy()`, `.toMatch()`, `.toHaveProperty()`, `.toSomeMethod()`

**Run Commands:**

```bash
pnpm run test              # Full Vitest suite (runs all .test.ts files)
npm test                   # Alias for pnpm run test
pnpm run build:check       # Verify generated runtime outputs match source
pnpm run validate          # Repository structure and docs invariants
pnpm run premerge          # Full pre-merge checks (build + type-check + test + validate + smoke)
```

Watch mode and coverage:
- No watch mode script defined in package.json
- No coverage collection configured in vitest.config.mjs
- Coverage targets: None enforced (not configured)

## Test File Organization

**Location:**

- All tests in `tests/` directory
- Organized by domain/subsystem (mirroring `src/` structure):
  - `tests/session-observer/` — session-observer skill behavior
  - `tests/consensus/` — consensus core/wrapper/evaluate tests
  - `tests/tooling/` — build guards and linting policy tests
  - `tests/helpers/` — shared test utilities (not test files themselves)
  - `tests/fixtures/` — static test data and stub binaries

**Naming:**

- Suffix `.test.ts` for TypeScript test files: `observe.test.ts`, `consensus-loop.test.ts`
- Suffix `.test.mts` for some module tests (rare, seen in config)
- Legacy `.test.mjs` files must not be reintroduced (enforced by `tests/tooling/no-node-test-runner.test.ts`)

**Structure:**

```
tests/
├── consensus/
│   ├── install-contract.test.ts
│   ├── generated-config-import.test.ts
│   └── ...
├── session-observer/
│   ├── observe.test.ts
│   ├── cli-session-override.test.ts
│   └── ...
├── session-observer-collab/
│   ├── control.test.ts
│   └── ...
├── tooling/
│   ├── generated-output-sync.test.ts
│   ├── vitest-config.test.ts
│   └── no-node-test-runner.test.ts
├── helpers/
│   ├── consensus.ts (shared utilities)
│   ├── process.mjs (subprocess/env helpers)
│   └── process.d.mts (TypeScript declarations)
└── fixtures/
    ├── bin/ (stub binaries for testing)
    └── sample-input.md
```

## Test Structure

**Suite Organization:**

Standard Vitest pattern: `describe()` for suites, `test()` for individual tests.

From `tests/session-observer/observe.test.ts:84-205`:
```typescript
describe('observeCatchUp', () => {
  test('builds a catch-up digest from the prior offset and only rewrites changed state', async () => {
    await withTempSessionHome(async (home, stateDir) => {
      const cwd = '/test/observe-prior-offset';
      const transcriptPath = await writeClaudeTranscript(
        home,
        cwd,
        'observe-prior.jsonl',
        'observe-prior',
        [
          { role: 'user', content: 'first question' },
          { role: 'assistant', content: 'first answer' },
        ],
      );
      const first: any = await observeCatchUp({
        runtime: 'claude-code',
        cwd,
        session: 'claude-code:observe-prior',
      });

      expect(first.ok).toBe(true);
      expect(first.digest.mode).toBe('catch-up');
      expect(first.digest.range.fromIndex).toBe(0);
      expect(first.digest.range.nextIndex).toBe(2);
      expect(first.markedRead).toBe(true);
      // ... more assertions
    });
  });

  test('uses snippet filtering before ranking candidates', async () => {
    // ... similar structure
  });
});
```

**Patterns:**

- **Setup:** Helper functions create fixture state (temp directories, transcript files, environments). Example: `withTempSessionHome()` in `tests/session-observer/observe.test.ts:17-35`
- **Teardown:** `finally` blocks or `afterEach()` hooks clean up temp resources. Pattern: `await rm(home, { recursive: true, force: true });`
- **Assertions:** Chain `.toBe()`, `.toEqual()`, `.toContain()`, etc. on `expect()` results

From `tests/consensus/install-contract.test.ts:36-69`:
```typescript
describe('consensus install contract', () => {
  it('keeps README, user guide, install.sh, and resolver shared-path/ref values aligned', async () => {
    const [readme, installGuide, installSh, resolver] = await Promise.all([
      repoFile('README.md'),
      repoFile('documentation/docs/user-guide/installation.md'),
      repoFile('install.sh'),
      repoFile('src/consensus/core/consensus-loop.ts'),
    ]);

    const readmeRefs = extractInstallRefs(readme);
    expect(readmeRefs).toHaveLength(1);
    const [readmeRef] = readmeRefs;
    expect(readmeRef).toMatch(/^v\d+\.\d+\.\d+$/u);
    expect(['main', 'HEAD']).not.toContain(readmeRef);
    // ... more assertions
  });
});
```

## Mocking

**Framework:** No explicit mocking library observed

- Tests use **actual** temp directories (`mkdtemp`) rather than in-memory mocks
- Stub environments created with helper functions (e.g., `makeStubEnv()`, `makeProviderCliEnv()`)
- No Sinon, Jest mocks, or Vitest mock utilities observed

**Patterns:**

**Environment Stubbing** (from `tests/helpers/process.mjs:26-42`):
```javascript
export function makeStubEnv(overrides = {}) {
  return {
    ...process.env,
    PATH: `${fixtureBin}${path.delimiter}${process.env.PATH}`,
    ...overrides,
  };
}

export function makeProviderCliEnv(overrides = {}) {
  return makeStubEnv({
    CONSENSUS_CLI_PATH: consensusCliFixture,
    ...overrides,
  });
}
```

Usage: `const child = spawn(command, args, { env: makeStubEnv() });`

**Fixture Data Creation** (from `tests/session-observer/observe.test.ts:37-82`):
```typescript
async function writeClaudeTranscript(
  home: string,
  cwd: string,
  fileName: string,
  sessionId: string,
  messages: Array<{ role?: string; content: unknown }>,
): Promise<string> {
  const dir = join(home, '.claude', 'projects', claudeSlug(cwd));
  await mkdir(dir, { recursive: true });
  const transcriptPath = join(dir, fileName);
  const records = messages.map(({ role = 'user', content }) => ({
    sessionId,
    message: { role, content },
  }));
  await writeFile(
    transcriptPath,
    records.map((record) => JSON.stringify(record)).join('\n') + '\n',
    'utf8',
  );
  return transcriptPath;
}
```

**What to Mock:**

- Environment variables: `makeStubEnv()` for process.env overrides
- File paths: `mkdtemp()` for isolated temp directories
- Provider CLIs: Fixture binaries under `tests/fixtures/bin/`

**What NOT to Mock:**

- File system operations: Use real temp dirs (mkdtemp) to test actual I/O behavior
- Child processes: Use real spawning via `spawn()` / `spawnSync()` to test CLI integration
- Timestamps: Use real timers; no fake time observed

## Fixtures and Factories

**Test Data:**

**Factory Functions** (from `tests/helpers/consensus.ts:37-72`):
```typescript
export async function makeLoopOptions({
  sectionText = 'Brief: create a useful artifact.\n',
  iteration = 'alternating',
  coldStart = 'independent_draft',
  agency = 'moderate',
  maxRounds = 1,
  synthesizer = null,
} = {}) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-loop-'));
  const sectionFile = path.join(tempRoot, 'section.md');
  await writeFile(sectionFile, sectionText);

  return {
    tempRoot,
    options: {
      sectionFile,
      goal: 'Create an artifact from the brief.',
      peers: ['claude', 'codex'],
      maxRounds,
      iteration,
      coldStart,
      agency,
      synthesizer,
      outputRecords: path.join(tempRoot, 'records.json'),
      outputSection: path.join(tempRoot, 'output.md'),
      outputStatus: path.join(tempRoot, 'status.json'),
    } satisfies LoopOptions,
  };
}
```

**Fixture Helpers** (from `tests/helpers/process.mjs:59-70`):
```javascript
export function parseJsonl(contents) {
  return String(contents)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}
```

**Location:**

- Domain-specific helpers: `tests/helpers/consensus.ts` (consensus test utilities)
- General-purpose helpers: `tests/helpers/process.mjs` (subprocess, env, JSON, paths)
- Static fixtures: `tests/fixtures/` (sample markdown, stub binaries)

## Coverage

**Requirements:** Not enforced

- No coverage targets configured in vitest.config.mjs
- No CI/pre-commit checks for coverage
- Generated files (consensus loop/wrapper/evaluate) and OAT-synced files excluded from linting but not coverage

## Test Types

**Unit Tests:**

- Scope: Individual functions and modules
- Approach: Test functions in isolation with known inputs and expected outputs
- Example: `tests/session-observer/observe.test.ts` tests the `observeCatchUp()` function with various session/cwd/snippet combinations
- No mocking of dependencies; uses real temp dirs

**Integration Tests:**

- Scope: Multi-component behavior (e.g., CLI parsing + provider invocation + envelope formatting)
- Approach: Spawn child processes, invoke CLI with fixture data, assert file/output changes
- Example: `tests/consensus/install-contract.test.ts` checks that install.sh, README, docs, and source code stay aligned
- Example: `tests/session-observer-collab/control.test.ts` tests lease management across multiple async operations

**E2E Tests:**

- Not used; CLI/smoke testing handled separately in `scripts/smoke-test.mjs`

## Common Patterns

**Async Testing:**

All async tests are declared `async` and return Promises. Vitest awaits them automatically.

From `tests/consensus/install-contract.test.ts:37-69`:
```typescript
it('keeps README, user guide, install.sh, and resolver shared-path/ref values aligned', async () => {
  const [readme, installGuide, installSh, resolver] = await Promise.all([
    repoFile('README.md'),
    repoFile('documentation/docs/user-guide/installation.md'),
    repoFile('install.sh'),
    repoFile('src/consensus/core/consensus-loop.ts'),
  ]);

  const readmeRefs = extractInstallRefs(readme);
  expect(readmeRefs).toHaveLength(1);
  // ... assertions
});
```

**Error Testing:**

Tests assert both successful and failed outcomes using discriminated unions. From `tests/session-observer/observe.test.ts:162-174`:

```typescript
test('returns a no-match outcome without exiting the process', async () => {
  await withTempSessionHome(async () => {
    const result: any = await observeCatchUp({
      runtime: 'claude-code',
      cwd: '/test/no-transcripts',
    });

    expect(result.ok).toBe(false);
    expect(result.kind).toBe('noMatch');
    expect(result.exitCode).toBe(2);
    expect(result.payload.noMatch).toBe(true);
  });
});
```

**Resource Cleanup:**

Temp files/dirs cleaned up in finally blocks or afterEach hooks to ensure clean working tree (verified by `npm test` drift guards). From `tests/session-observer-collab/control.test.ts:59-62`:

```typescript
afterEach(async () =>
  Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  ),
);
```

**Subprocess Testing:**

Tests spawn subprocesses and assert exit codes, stdout, stderr. Helper: `runNodeScript()` from `tests/helpers/process.mjs:72-88`:

```typescript
export async function runNodeScript(scriptPath, args = [], options = {}) {
  const result = await runNodeScriptResult(scriptPath, args, options);
  if (result.code === 0) {
    return { stdout: result.stdout, stderr: result.stderr };
  }
  const error = new Error(
    `Command failed with exit code ${result.code}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  error.stdout = result.stdout;
  error.stderr = result.stderr;
  error.code = result.code;
  throw error;
}
```

## Build & Validation Integration

**Generated-Output Drift Detection:**

`tests/tooling/generated-output-sync.test.ts` is a drift guard that ensures canonical TypeScript source stays in sync with committed `.mjs` runtime outputs. Enforced via:
- `pnpm run build:check` (must pass before merge)
- Local `pre-push` hook
- CI job `build-and-sync` (PR-scoped)

**Linting Policy Guard:**

`tests/tooling/no-node-test-runner.test.ts` enforces that no legacy `.test.mjs` files or Node test-runner imports are introduced.

---

_Testing analysis: 2026-07-17_
