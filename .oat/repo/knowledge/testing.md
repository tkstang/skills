---
oat_generated: true
oat_generated_at: 2026-06-12
oat_source_head_sha: d008a7e571d90cc6c436c82e176129f62ab54ec4
oat_source_main_merge_base_sha: ed22b463dcdaa466476b0957fea64deb3f663391
oat_warning: "GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index"
---

# Testing Patterns

**Analysis Date:** 2026-06-12

## Test Framework

**Runner:**

- Node.js built-in `node:test` module (no external test runner)
- Node >=22 required (see `package.json` line 7)
- Config: None (uses Node.js defaults)

**Assertion Library:**

- Node.js built-in `node:assert/strict` (see imports in all test files, e.g., `error-handling.test.mjs` line 1)
- All test files import: `import assert from 'node:assert/strict'`

**Run Commands:**

```bash
npm test                    # Run all tests (runs node --test)
npm run validate            # Run validation script
npm run smoke               # Run mocked end-to-end consensus wrapper flow
```

## Test File Organization

**Location:**

- Separate `tests/` directory at repository root (see `/Users/tstang/Code/skills/tests/`)
- Subdirectories for organized test groups:
  - `tests/session-observer/` — session observer module tests
  - `tests/transcript-core/` — transcript core module tests
  - `tests/export-session-transcript/` — export transcript module tests
  - `tests/fixtures/` — test fixture data and stub binaries
  - `tests/helpers/` — shared test helpers

**Naming:**

- Pattern: `{subject}.test.mjs` for test files
- Examples: `error-handling.test.mjs`, `path-safety.test.mjs`, `loop-convergence.test.mjs`
- Subdirectory tests follow same pattern: `tests/session-observer/observe.test.mjs`

**Structure:**

```
tests/
├── error-handling.test.mjs
├── loop-convergence.test.mjs
├── path-safety.test.mjs
├── parallel-integration.test.mjs
├── fixtures/
│   ├── sample-input.md          # Sample markdown input for testing
│   ├── bin/                     # Stub executables for testing
│   └── ...
├── helpers/
│   ├── process.mjs              # Shared test helpers
│   └── .gitkeep
└── session-observer/
    ├── observe.test.mjs
    ├── cli.test.mjs
    └── ...
```

## Test Structure

**Suite Organization:**

```javascript
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runWrapperCli } from '../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';

test('descriptive test name', () => {
  // Test body
});

test('async test with async/await', async () => {
  // Test body
});
```

**Patterns:**

- Each `test()` call is an individual test (no describe/context nesting used)
- Tests are flat; one test per `test()` invocation
- Descriptive test names explain behavior: `'error-handling.test.mjs'` contains tests like:
  - `'exitCodeForError maps unit-testable wrapper exit codes'`
  - `'runWrapperCli writes JSONL to stdout and human errors to stderr'`
  - (see `error-handling.test.mjs` lines 133-158)
- Setup: tests use `mkdtemp()` and `readFile()`/`writeFile()` for temporary filesystem state
- Teardown: implicit (Node.js cleans up tmp directories)
- Assertions: use `assert.equal()`, `assert.deepEqual()`, `assert.match()`, `assert.throws()`, `assert.rejects()`

**Example from `path-safety.test.mjs` lines 16-26:**
```javascript
test('readInputFile allows unrestricted reads but enforces size cap', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-path-'));
  const inputPath = path.join(tempRoot, 'input.md');
  await writeFile(inputPath, 'small');

  assert.equal(await readInputFile(inputPath), 'small');

  const largePath = path.join(tempRoot, 'large.md');
  await writeFile(largePath, `${'x'.repeat(INPUT_SIZE_CAP_BYTES)}x`);
  await assert.rejects(readInputFile(largePath), /input exceeds size cap/);
});
```

## Mocking

**Framework:** Manual mocking (no external mock library like Sinon or Jest)

**Patterns:**

Test stub functions are created manually:

```javascript
function captureWriter() {
  let value = '';
  return {
    stream: {
      write(chunk) {
        value += chunk;
      }
    },
    value() {
      return value;
    }
  };
}

function sectionFailOnceInvoker() {
  let calls = 0;
  return async () => {
    calls += 1;
    if (calls === 1) {
      throw new Error('provider unavailable for first section');
    }
    return {
      json: {
        schema_version: 'v0',
        verdict: 'ACCEPT',
        reasoning: 'accepted'
      }
    };
  };
}
```

(see `error-handling.test.mjs` lines 22-78)

**Stub binaries approach:**

- Stub executables in `tests/fixtures/bin/` replace real `paseo` executable during testing
- Environment variable `PATH` prepended with fixture bin directory (see `parallel-integration.test.mjs` lines 15-20):
  ```javascript
  function stubEnv(overrides = {}) {
    return {
      ...process.env,
      PATH: `${fixtureBin}${path.delimiter}${process.env.PATH}`,
      ...overrides
    };
  }
  ```

- Stub responses injected via environment variables: `PASEO_STUB_RESPONSE_JSON` (see `parallel-integration.test.mjs` lines 75-83)

**What to Mock:**

- External subprocess calls: paseo executable behavior mocked via stub binary + environment variables
- Writer streams: mock stdout/stderr with `captureWriter()` helper to inspect output
- Async provider invokers: manual closure-based functions that return different responses on successive calls

**What NOT to Mock:**

- Real filesystem operations (use `mkdtemp()` in actual temporary directories)
- Real path resolution and symlink checking (tests explicitly verify security properties)
- Actual error types (construct real Error/ConsensusError objects)

## Fixtures and Factories

**Test Data:**

Sample input file in `tests/fixtures/sample-input.md`:
```
# Intro
Opening text.

## Details
- Point one
- Point two

## Close
Closing remarks.
```

**Helper factories:**

```javascript
function captureWriter() {
  let value = '';
  return { stream: { write(chunk) { value += chunk; } }, value() { return value; } };
}

function sectionFailOnceInvoker() {
  let calls = 0;
  return async () => {
    calls += 1;
    if (calls === 1) throw new Error('...');
    return { json: { schema_version: 'v0', verdict: 'ACCEPT', reasoning: '...' } };
  };
}
```

(see `tests/helpers/process.mjs` lines 6-39)

**Location:**

- Fixtures: `tests/fixtures/` (markdown samples, stub binaries, etc.)
- Helpers: `tests/helpers/process.mjs` exports:
  - `captureWriter()` — captures stream output
  - `parseJsonl()` — parses JSONL strings to array of objects
  - `runNodeScript()` — runs Node scripts with exec, captures output/errors

## Coverage

**Requirements:** Not enforced (no coverage configuration found)

**View Coverage:**

- Not supported by current test setup
- Could be added via `node:test` experimental coverage flag or external tool, but not currently in use

## Test Types

**Unit Tests:**

- Tests focus on single functions or modules in isolation
- Examples: `loop-convergence.test.mjs` tests `normalizeForHash()`, `hashArtifact()`, `detectConvergence()` directly
- Assertions verify function contracts: input → output transformation
- No external dependencies in unit tests

**Integration Tests:**

- Tests combine multiple modules: `error-handling.test.mjs` tests `runSequential()` + `ConsensusError` + `exitCodeForError()` together
- Example: `parallel-integration.test.mjs` (lines 30-111) runs full end-to-end flow:
  - prepare phase
  - simulated host section loops
  - fan-in completion
  - verifies output artifact structure
- Use `mkdtemp()` to create real temporary filesystems
- Call real exported functions with stubbed subprocess behavior

**E2E Tests:**

- `npm run smoke` runs a mocked end-to-end consensus wrapper flow (see `package.json` line 13)
- Not traditional E2E; more of a smoke test verifying the CLI entry point works with mocked providers

## Common Patterns

**Async Testing:**

```javascript
test('async operation succeeds', async () => {
  const result = await someAsyncFunction();
  assert.equal(result.status, 'success');
});

test('async operation throws on error', async () => {
  await assert.rejects(
    someAsyncFunction(),
    /error message pattern/
  );
});
```

(see `error-handling.test.mjs` line 227-267 for real pattern)

**Error Testing:**

```javascript
test('validation rejects oversized input', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'test-'));
  const largePath = path.join(tempRoot, 'large.md');
  await writeFile(largePath, 'x'.repeat(INPUT_SIZE_CAP_BYTES + 1));

  await assert.rejects(readInputFile(largePath), /input exceeds size cap/);
});

test('function maps errors to correct exit codes', () => {
  assert.equal(
    exitCodeForError(new ConsensusError('msg', { exitCode: EXIT_CODES.USAGE })),
    64
  );
});
```

(see `path-safety.test.mjs` lines 16-26 and `error-handling.test.mjs` lines 133-145)

**Object/Response Assertions:**

```javascript
test('returns expected shape', () => {
  const result = detectConvergence([...records...]);
  assert.deepEqual(result, {
    converged: true,
    reason: 'hash_match',
    record_indexes: [0, 1],
    artifact_hash: expectedHash
  });
});
```

(see `loop-convergence.test.mjs` lines 30-43)

**Regex Match Assertions:**

```javascript
test('includes expected pattern', () => {
  const hash = hashArtifact('text');
  assert.match(hash, /^sha256:[a-f0-9]{64}$/);
});
```

(see `loop-convergence.test.mjs` lines 22-28)

---

_Testing analysis: 2026-06-12_
