---
oat_generated: true
oat_generated_at: 2026-06-12
oat_source_head_sha: d008a7e571d90cc6c436c82e176129f62ab54ec4
oat_source_main_merge_base_sha: ed22b463dcdaa466476b0957fea64deb3f663391
oat_warning: "GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index"
---

# Coding Conventions

**Analysis Date:** 2026-06-12

## Naming Patterns

**Files:**

- `.mjs` extension for ES modules (e.g., `consensus-loop.mjs`, `consensus-refine.mjs`)
- Descriptive kebab-case names (e.g., `loop-convergence.test.mjs`, `path-safety.test.mjs`)
- Script files in `scripts/` directory (e.g., `scripts/validate.mjs`, `scripts/bump-version.mjs`)
- Test files co-located adjacent to tests directory or in `tests/` with matching name (e.g., `tests/error-handling.test.mjs`)

**Functions:**

- camelCase naming: `readInputFile()`, `confineWrite()`, `atomicWriteFile()`, `createJsonlEvent()`, `renderHumanError()`
- Helper/private functions remain camelCase and are not exported
- Exported public functions clearly marked with `export` keyword (see `consensus-refine.mjs` lines 13-2134 for patterns)
- Verb-first naming for functions: `read*()`, `resolve*()`, `parse*()`, `detect*()`, `render*()`, `validate*()`, `run*()`

**Variables:**

- camelCase for regular variables: `capBytes`, `outputPath`, `tempRoot`, `argv`, `metadata`
- SCREAMING_SNAKE_CASE for constants: `EXIT_CODES`, `VERDICT_CAPS`, `LOOP_SCHEMA_VERSION`, `INPUT_SIZE_CAP_BYTES`, `PROVIDER_ID_PATTERN` (see `consensus-loop.mjs` lines 7-25)
- Constants wrapped with `Object.freeze()` when they are objects: `const VERDICT_CAPS = Object.freeze({...})` (see `consensus-loop.mjs` lines 7-13)

**Types:**

- No TypeScript in this codebase (pure JavaScript ESM)
- Custom error classes use PascalCase: `ConsensusError` (see `consensus-loop.mjs` lines 27-35)
- Schema objects follow camelCase: `schema_version`, `verdict`, `reasoning` (observed in JSON payloads, using snake_case for data/payload fields, camelCase for code variables)

## Code Style

**Formatting:**

- Not detected (No `.prettierrc`, `.eslintrc`, or `biome.json` found in repository)
- Manual formatting conventions observed from codebase:
  - 2-space indentation
  - Single quotes for strings in most contexts (see `consensus-loop.mjs`)
  - Template literals used for complex strings with interpolation
  - Line length appears unconstrained

**Linting:**

- Not detected (No ESLint, Biome, or other linter configuration found)
- Code appears hand-maintained for quality

## Import Organization

**Order:**

1. Node.js built-in modules first (e.g., `import { createHash } from 'node:crypto'`)
2. Local/project imports second (e.g., `import { ConsensusError } from './consensus-loop.mjs'`)

**Pattern from `consensus-refine.mjs` lines 1-9:**
```javascript
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { lstat, mkdir, open, readFile, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { ConsensusError, EXIT_CODES, exitCodeForError, hashArtifact, runConsensusLoop } from './consensus-loop.mjs';
```

**Path Aliases:**

- Not used (all imports are relative paths or absolute Node.js `node:*` specifiers)
- File URLs use `fileURLToPath(new URL(..., import.meta.url))` pattern for path resolution (see `consensus-refine.mjs` line 6, `scripts/validate.mjs` line 7)

## Error Handling

**Patterns:**

- Custom `ConsensusError` class extends `Error` with properties: `code`, `exitCode`, `details`, `cause` (see `consensus-loop.mjs` lines 27-35)
- Error objects use optional chaining and nullish coalescing: `error?.code ?? 'DEFAULT'`, `error?.message ?? String(error)`
- Exit code mapping via `exitCodeForError()` function that inspects error.code, error.name, or error.exitCode (see `consensus-loop.mjs` lines 218-241)
- Async errors caught with try/catch, re-thrown or transformed:
  ```javascript
  try {
    await operation();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  ```
  (see `consensus-loop.mjs` lines 118-129)
- Validation errors constructed with descriptive messages and context: `new ConsensusError(message, { code, exitCode, details })`
- Path safety checks raise errors with context about what escaped: `/outside allowed root/` (see `path-safety.test.mjs` line 33)

## Logging

**Framework:** `console` (no external logging framework)

**Patterns:**

- JSONL event writing via `writeJsonl(stream, event, payload)` helper (see `consensus-refine.mjs` lines 80-84)
- Human-readable errors written to `stderr` via `renderHumanError(error, env)` which respects `CONSENSUS_LOG=trace` environment variable for stack traces (see `consensus-refine.mjs` lines 86-91)
- Machine-readable JSONL to `stdout`: `{"consensus_schema_version": "v0", "event": "...", "timestamp": "...", ...}`
- Observed structured logging events: `run_started`, `run_completed`, `error`, `phase` (see `parallel-integration.test.mjs` lines 63, 109)
- Conditional logging based on environment: `env.CONSENSUS_LOG === 'trace'` (see `error-handling.test.mjs` line 130)

## Comments

**When to Comment:**

- Comments are sparse; code is self-documenting through function and variable names
- No JSDoc/TSDoc observed in codebase
- Minimal inline comments; intent conveyed through clear naming

**JSDoc/TSDoc:**

- Not used (no type annotations and no JSDoc blocks found in surveyed files)

## Function Design

**Size:** Functions tend to be small and focused, rarely exceeding 50 lines

**Parameters:**

- Named parameters passed as options objects: `function runSequential(options, runOptions = {})` (see `consensus-refine.mjs` line 1619)
- Destructuring from options within function body
- Default parameters used: `(env = process.env)`, `(options = {})`, `(agency = 'moderate')`

**Return Values:**

- Explicit return types through code structure:
  - Simple values: strings, numbers, booleans
  - Objects: `{ ok: true, ... }` or `{ ok: false, errors: [...] }` for validation results
  - Promises for async functions (all async functions return Promise)
  - Stable return shapes documented via test assertions:
    ```javascript
    { converged: boolean, reason: string|null, record_indexes?: number[], artifact_hash?: string }
    ```
    (see `loop-convergence.test.mjs` lines 30-65)

## Module Design

**Exports:**

- Selective named exports: only public APIs exported with `export` keyword (see consensus-refine.mjs lines 13-2134)
- Constants exported as named exports: `export const MIN_PASEO_VERSION = '0.1.0'`
- Functions exported as named exports: `export async function runWrapperCli(argv, options = {})`
- Private/helper functions remain unexported (e.g., `function inside()`, `async function pathExists()`)

**Barrel Files:**

- Not used (no index files with re-exports)
- Direct imports from specific modules required

---

_Convention analysis: 2026-06-12_
