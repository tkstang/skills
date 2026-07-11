---
oat_generated: true
oat_generated_at: 2026-07-11
oat_source_head_sha: 0e25a36d3958a1e09c7bedaddd6d3498dc0905d7
oat_source_main_merge_base_sha: 17043d653233fb906e018f5872359d99eb556208
oat_warning: 'GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index'
---

# Testing Patterns

**Analysis Date:** 2026-07-11

## Test Framework

**Runner:**

- **Vitest** 4.1.9
- Config: `vitest.config.mjs` at repo root
- Environment: Node.js (no browser/jsdom)
- TypeScript support: native (`*.test.ts` files)

**Assertion Library:**

- Vitest's built-in `expect()` API (compatible with Jest)
- Imports: `import { expect, describe, test, it } from 'vitest'`
- No external assertion library; vitest expect is primary

**Run Commands:**

```bash
pnpm run test              # Run all tests (vitest)
pnpm run test:vitest       # Explicit vitest runner
npm test                   # Equivalent to pnpm run test
```

## Test Configuration Details

**Key Settings from `vitest.config.mjs`:**

- Environment: `'node'` — tests run in Node.js, not browser
- File patterns: `tests/**/*.test.ts`, `tests/**/*.test.mts`
- Test timeout: `30_000` ms (30 seconds) for all tests
- Hook timeout: `30_000` ms (same as test timeout)
- Note: Long timeout accommodates integration tests spawning subprocesses or driving real timers; fast unit tests finish in milliseconds

**Coverage:**

- No coverage enforcement or reporting configured
- Coverage tools not installed or configured

## Test File Organization

**Location:**

- Separate from source: tests live under `tests/` directory tree, source under `src/`
- Domain-organized: tests grouped by feature domain (e.g., `tests/session-observer/`, `tests/consensus/`, `tests/tooling/`)
- No co-located `.test.ts` files alongside source files

**Naming:**

- Pattern: `*.test.ts` or `*.test.mts` (e.g., `observe.test.ts`, `state.test.ts`, `digest.test.ts`)
- File-module correspondence: test files usually named after the module they test (e.g., `tests/session-observer/observe.test.ts` tests `src/transcript/session-observer/lib/observe.ts`)

**Structure:**

```
tests/
├── consensus/
│   ├── core/                      # Core loop behavior tests
│   ├── refine/                    # Refine wrapper behavior tests
│   ├── evaluate/                  # Evaluate skill behavior tests
│   ├── decide/                    # Decide wrapper tests
│   ├── generated-config-import.test.ts
│   ├── generated-evaluate-import.test.ts
│   ├── generated-refine-import.test.ts
│   ├── install-sh.test.ts
│   └── install-contract.test.ts
├── session-observer/
│   ├── observe.test.ts
│   ├── watch-state.test.ts
│   ├── cli-session-override.test.ts
│   ├── digest.test.ts
│   ├── state.test.ts
│   ├── helpers/
│   │   └── tmpdir.ts              # Shared test utilities (no .test.ts extension)
│   └── fixtures/
│       ├── claude-code/
│       │   ├── typical.jsonl
│       │   ├── empty.jsonl
│       │   └── with-tool-burst.jsonl
│       ├── codex/
│       │   └── typical.jsonl
│       └── cursor/
│           └── typical.jsonl
├── tooling/
│   ├── generated-output-sync.test.ts
│   ├── vitest-config.test.ts
│   └── no-node-test-runner.test.ts
└── helpers/                       # Shared test utilities (no .test.ts extension)
    ├── process.mjs
    └── tmpdir.ts
```

## Test Structure

**Suite Organization:**

Files use `describe()` for grouping related tests; flat top-level tests also common:

```typescript
// Example from tests/session-observer/observe.test.ts
describe('observeCatchUp', () => {
  test('builds a catch-up digest from the prior offset and only rewrites changed state', async () => {
    await withTempSessionHome(async (home, stateDir) => {
      // test body
    });
  });

  test('uses snippet filtering before ranking candidates', async () => {
    await withTempSessionHome(async (home) => {
      // test body
    });
  });
});
```

Flat tests also used:

```typescript
// Example from tests/session-observer/state.test.ts
import { expect, it } from 'vitest';

it('mutate creates state.json on first write', async () => {
  await withTmpStateDir(async (dir) => {
    // test body
  });
});
```

**Patterns:**

- **Setup pattern:** Async test helpers create temp directories/environments, then call test function with context. Cleanup happens in `finally` block.
  
  ```typescript
  // From tests/session-observer/helpers/tmpdir.ts
  export async function withTmpStateDir(
    fn: (dir: string) => Promise<void>,
  ): Promise<void> {
    const dir = await mkdtemp(join(tmpdir(), 'session-observer-test-'));
    const prev = process.env.STATE_DIR;
    process.env.STATE_DIR = dir;
    try {
      await fn(dir);
    } finally {
      if (prev === undefined) {
        delete process.env.STATE_DIR;
      } else {
        process.env.STATE_DIR = prev;
      }
      await rm(dir, { recursive: true, force: true });
    }
  }
  ```

- **Teardown pattern:** Cleanup in `finally` block ensures state is restored even if test fails. File system temp directories cleaned with `rm(dir, { recursive: true, force: true })`. Environment variables restored to previous state (or deleted if previously unset).

- **Assertion pattern:** Direct `expect()` chains; multiple assertions per test are common:
  
  ```typescript
  // From tests/session-observer/observe.test.ts
  expect(first.ok).toBe(true);
  expect(first.digest.mode).toBe('catch-up');
  expect(first.digest.range.fromIndex).toBe(0);
  expect(first.digest.range.nextIndex).toBe(2);
  expect(first.markedRead).toBe(true);
  ```

## Mocking

**Framework:** Minimal mocking strategy

**Patterns:**

- No Vitest `vi.mock()` or mock libraries used
- Instead, tests use:
  - **Fixtures:** Static JSONL files in `tests/session-observer/fixtures/` (e.g., `claude-code/typical.jsonl`, `codex/typical.jsonl`)
  - **In-memory data:** Tests build expected data structures and pass them directly
  - **Stub implementations:** Callback functions passed to tested functions return stub/fixture responses

**Example from `tests/consensus/decide/wrapper.test.ts`:**

```typescript
return await runConsensusDecide(
  [/* args */],
  {
    cwd: context.cwd,
    env: context.env,
    invokePeer: async ({ provider }) => ({
      json: {
        schema_version: 'v1',
        verdict: 'REVISE',
        reasoning: `${provider} fixture recommendation`,
        proposed_artifact: `## Recommendation\n\n${provider} recommends shipping.\n\n## Reasoning\n\nFixture.\n\n## Alternatives\n\n- Wait.\n\n## Dissent / Unresolved Disagreement\n\n- None.\n`,
      },
    }),
    invokeSynthesizer: async () => ({
      json: {
        schema_version: 'v1',
        synthesized_artifact: '## Recommendation\n\nShip now.\n\n...',
        synthesis_reasoning: 'fixture synthesis',
        unresolved_disagreements: [],
      },
    }),
  },
);
```

**What to Mock:**

- External process calls (via callback parameters)
- Provider CLI invocations (stubbed with JSON responses)
- File system operations can be mocked via temp directories with test data

**What NOT to Mock:**

- Filesystem operations: use real temp directories via `mkdtemp` + cleanup
- Core library functions: test actual implementation (e.g., state persistence, digest building)
- Date/time: use real `Date` unless specifically testing time-dependent logic
- Environment variables: set them for the test scope and restore in `finally`

## Fixtures and Factories

**Test Data:**

Fixtures are static JSONL files checked into the repo:

```typescript
// From tests/session-observer/digest.test.ts
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, 'fixtures');
const typicalClaude = join(FIXTURES, 'claude-code', 'typical.jsonl');
const typicalCodex = join(FIXTURES, 'codex', 'typical.jsonl');
```

Test helper functions create temporary data and return paths:

```typescript
// From tests/session-observer/observe.test.ts
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

**Location:**

- Static fixtures: `tests/{domain}/fixtures/` (e.g., `tests/session-observer/fixtures/claude-code/typical.jsonl`)
- Helper functions: `tests/{domain}/helpers/` (e.g., `tests/session-observer/helpers/tmpdir.ts`) or `tests/helpers/` for cross-domain utilities
- No `.test.ts` extension on helper files; they are utilities, not test files

## Test Types

**Unit Tests:**

- Scope: individual functions and modules (e.g., `state.ts`, `digest.ts`)
- Approach: 
  - Import canonical TypeScript source: `import * as state from '../../src/transcript/session-observer/lib/state.js'`
  - Test behavior via public API
  - Use temp fixtures and state dirs for isolation
  - Example: `tests/session-observer/state.test.ts` tests state persistence, concurrency, and recovery

**Integration Tests:**

- Scope: multi-module workflows (e.g., end-to-end CLI execution, config resolution)
- Approach:
  - Tests spawn actual subprocesses via provider CLI
  - Isolated consensus configs created in temp directories
  - Full environment setup: `HOME`, `XDG_CONFIG_HOME`, env vars
  - Examples: `tests/consensus/decide/wrapper.test.ts`, `tests/consensus/install-contract.test.ts`

**E2E Tests:**

- Scope: **Not formally implemented**
- Note: Integration tests come close by testing full CLI workflows with fixtures; no separate E2E suite
- Smoke test (`pnpm run smoke`) provides end-to-end verification of the consensus wrapper flow

## Common Patterns

**Async Testing:**

```typescript
// From tests/session-observer/state.test.ts
it('two concurrent mutate calls both succeed and final state contains both mutations', async () => {
  await withTmpStateDir(async (_dir) => {
    // Both mutations write a different session entry; both must land.
    await Promise.all([
      state.markRead('claude-code', 'sess-a', {
        lastRecordIndex: 1,
        lastTotalRecords: 10,
        transcriptPath: '/tmp/a.jsonl',
        recordedCwd: '/proj',
      }),
      state.markRead('codex', 'sess-b', {
        lastRecordIndex: 2,
        lastTotalRecords: 20,
        transcriptPath: '/tmp/b.jsonl',
        recordedCwd: '/proj',
      }),
    ]);

    const a: any = await state.getSession('claude-code', 'sess-a');
    const b: any = await state.getSession('codex', 'sess-b');
    expect(a, 'sess-a must exist').toBeTruthy();
    expect(b, 'sess-b must exist').toBeTruthy();
  });
});
```

- `async`/`await` throughout; all tests are async
- Concurrency tested with `Promise.all()`
- Cleanup guaranteed in helper's `finally` block

**Error Testing:**

```typescript
// From tests/consensus/decide/wrapper.test.ts
expect(() => parseDecideArgs([])).toThrow(/requires --options/);
expect(() => parseDecideArgs(['--options', 'x', '--unknown'])).toThrow(
  /Unknown argument/,
);

// Async error testing
await expect(runInstall(home)).rejects.toMatchObject({
  code: 'INSTALL_FAILED',
});

await expect(executeRound(parallelContext({ invokePeer }))).rejects.toSatisfy(
  (err: any) => err.code === 'PEER_INVOCATION_FAILED',
);
```

- Synchronous errors: `expect(() => fn()).toThrow(pattern)`
- Async errors: `await expect(promise).rejects.toMatchObject(expectedError)` or `rejects.toSatisfy(predicate)`
- Error assertions check both type (`code` property) and message content

## Test Discipline

**From `tests/AGENTS.md`:**

- All suites are Vitest `.test.ts` files using `import { describe, it, expect } from 'vitest'`
- Prefer importing canonical TypeScript source for unit/library behavior tests
- Keep shipped `.mjs` entrypoint execution in CLI/integration tests where installed-skill behavior is protected
- Session-observer tests under `tests/session-observer/`; no `.test.mjs` files should exist
- Filesystem-touching tests create temp dirs under `os.tmpdir()` (`mkdtemp`) and clean them up — suite must leave clean working tree
- Guard: `tests/tooling/no-node-test-runner.test.ts` enforces no legacy test-runner imports or `.test.mjs` files
- Generated-output drift guard: `tests/tooling/generated-output-sync.test.ts` (run `pnpm run build:check` to verify)

---

_Testing analysis: 2026-07-11_
