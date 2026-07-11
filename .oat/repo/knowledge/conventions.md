---
oat_generated: true
oat_generated_at: 2026-07-11
oat_source_head_sha: 0e25a36d3958a1e09c7bedaddd6d3498dc0905d7
oat_source_main_merge_base_sha: 17043d653233fb906e018f5872359d99eb556208
oat_warning: 'GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index'
---

# Coding Conventions

**Analysis Date:** 2026-07-11

## Naming Patterns

**Files:**

- kebab-case for all source files (e.g., `consensus-loop.ts`, `session-observer.ts`)
- Module filenames match logical module names
- Generated outputs preserved with `.mjs` extension (e.g., `src/consensus/core/consensus-loop.ts` → `plugins/consensus/scripts/consensus-loop.mjs`)
- Test files: `*.test.ts` or `*.test.mts` (e.g., `tests/session-observer/observe.test.ts`, `tests/consensus/decide/wrapper.test.ts`)

**Functions:**

- camelCase for all function names (e.g., `observeCatchUp`, `buildDigest`, `parseDecideArgs` in `src/consensus/provider-cli/args.ts`)
- Prefix functions with verb: `build*`, `parse*`, `run*`, `render*`, `load*`, `resolve*` (e.g., `buildDigest` in `src/transcript/session-observer/lib/digest.ts`, `resolveConsensusComposition` in `src/consensus/config/consensus-config.js`)
- Async functions use `async` keyword; callers handle promises explicitly
- Private helper functions kept within module scope, no leading underscore convention

**Variables:**

- camelCase for all variables (e.g., `sessionId`, `recordIndex`, `transcriptPath`, `stateDir` in `src/transcript/session-observer/lib/state.ts`)
- Environment variables accessed with `process.env.UPPER_SNAKE_CASE` (e.g., `process.env.STATE_DIR`, `process.env.HOME`, `process.env.XDG_CONFIG_HOME`)
- Constants use UPPER_SNAKE_CASE (e.g., `VALID_RUNTIMES`, `SCHEMA_VERSION`, `LOCK_RETRIES`, `LOCK_INTERVAL_MS` in `src/transcript/session-observer/lib/observe.ts` and `src/transcript/session-observer/lib/state.ts`)

**Types:**

- PascalCase for all TypeScript interfaces and types (e.g., `ConsensusCliRunRequest`, `ObserveOutcome`, `SessionStateEntry`, `Digest` in `src/transcript/session-observer/lib/types.ts`)
- Discriminated unions using `kind` field for type narrowing (e.g., `ParsedHelpCommand`, `ParsedConfigGetCommand`, `ParsedRunCommand` in `src/consensus/provider-cli/args.ts`)
- Union types for command parsing results: `ParsedConsensusCliCommand` discriminated by `kind` property
- `readonly` used for immutable data structures (e.g., `readonly code: string` in error types)

## Code Style

**Formatting:**

- Tool: **oxfmt** (Prettier-compatible formatter)
- Config: `.oxfmtrc.json` at repo root
- Key settings:
  - Print width: 80 characters
  - Indent: 2 spaces (no tabs)
  - Semicolons: required
  - Quotes: single quotes for JS/TS
  - Trailing commas: all
  - Arrow parens: always
  - Line endings: LF
  - Prose wrap: preserve (for markdown/comments)
- Incremental adoption: only staged files formatted via `lint-staged` in pre-commit hook (one-time repo-wide format planned as separate effort)
- Generated outputs and OAT-synced files excluded from formatting

**Linting:**

- Tool: **oxlint** (Rust-based linter)
- Config: `.oxlintrc.json` at repo root
- Enforced categories:
  - `correctness`: error
  - `suspicious`: error
- Environment: `node: true`, `es2024: true`
- Enabled rules:
  - `eslint/prefer-const`: error — use `const` for non-reassigned bindings
  - `eslint/eqeqeq`: error with `"smart"` option — use `===`/`!==` except for null checks
  - `eslint/no-empty`: error — no empty blocks allowed
  - `eslint/no-shadow`: warn — warn on shadowed variables (not enforced as error)
  - `eslint/no-underscore-dangle`: off — leading/trailing underscores allowed
  - `unicorn/consistent-function-scoping`: off
- Test file overrides (in `.oxlintrc.json`):
  - `eslint/no-unused-vars`: off in `**/*.test.mjs`, `**/*.test.js`, `tests/**`
- Generated outputs (`.mjs` runtime files) excluded from linting
- Incremental enforcement: linting runs only on staged files via lint-staged pre-commit hook

## Import Organization

**Order:**

1. Node.js standard library imports: `import { ... } from 'node:...'` (e.g., `node:fs/promises`, `node:path`, `node:os`, `node:crypto`)
2. Relative/project imports: `from './...'` or `from '../../...'` (e.g., `from '../../src/transcript/session-observer/lib/observe.js'`)
3. Import side effects are avoided
4. Type imports grouped with regular imports; discriminated by `type` keyword

**Example from `src/consensus/provider-cli/commands.ts`:**

```typescript
import { randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import {
  clearConsensusConfig,
  parseConsensusDefaultsConfig,
  readConsensusConfig,
  // ... more imports
} from '../config/consensus-config.js';
import type {
  ConsensusAgentRef,
  ConsensusConfigKey,
  // ... more type imports
} from '../config/consensus-config.js';
```

**Path Aliases:**

- No path aliases configured; all imports use relative paths
- Depth-based relative import convention: `../` from one level, `../../` from two levels, etc.

## Error Handling

**Patterns:**

- Custom error classes extend `Error` base class and include:
  - `code` property (readonly string const, e.g., `'CONSENSUS_CLI_USAGE'`)
  - `name` property set to class name (e.g., `'ConsensusCliUsageError'`)
  - `details?` optional property for additional context

**Example from `src/consensus/provider-cli/args.ts`:**

```typescript
export class ConsensusCliUsageError extends Error {
  readonly code = 'CONSENSUS_CLI_USAGE' as const;
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'ConsensusCliUsageError';
    this.details = details;
  }
}
```

- Error handling in async contexts: `try`/`catch` for immediate catches, `rejects.toMatchObject()` in tests (e.g., `await expect(...).rejects.toMatchObject(...)` in `tests/consensus/install-sh.test.ts`)
- File system operations wrapped with error type checking (e.g., `isErrnoException` type guard in `src/transcript/session-observer/lib/state.ts`)
- Process environment variable fallbacks use nullish coalescing: `process.env.STATE_DIR ?? join(homedir(), '.local', 'state', 'session-observer')`

## Logging

**Framework:** Console API directly (no logging framework)

**Patterns:**

- `console.log()` for informational output to stdout
- `console.error()` for errors/warnings to stderr
- No structured logging or log levels implemented
- Standard library and runtime code avoid logging; CLI wrappers own output behavior
- Tests do not capture console output; test assertions work against return values and state

## Comments

**When to Comment:**

- File-level docstrings: JSDoc blocks at top of module explaining purpose and usage (e.g., `/** state.mjs — Atomic, lock-protected persistence... */` in `src/transcript/session-observer/lib/state.ts`)
- Complex algorithms: inline comments above non-obvious logic (e.g., write protocol steps in state.ts)
- Usage examples: included in file-level or function-level comments when contract is non-obvious
- No comments on self-explanatory code
- Comments for test context: describe test setup and purpose (e.g., `// Each test uses a fresh temp STATE_DIR to ensure isolation` in `tests/session-observer/state.test.ts`)

**JSDoc/TSDoc:**

- Used for function signatures and class members
- Type annotations preferred over JSDoc `@param` and `@return` tags
- Example from helper in `tests/session-observer/helpers/tmpdir.ts`:

```typescript
/**
 * Creates a fresh temp directory, sets process.env.STATE_DIR to it,
 * runs fn(dir), then cleans up regardless of whether fn throws.
 *
 */
export async function withTmpStateDir(
  fn: (dir: string) => Promise<void>,
): Promise<void>
```

## Function Design

**Size:** Functions kept concise; complex operations broken into smaller helpers (e.g., `preferredRuntimeFromState`, `parseConsensusCliArgs` decomposed into sub-parsers)

**Parameters:** 
- Prefer object/config parameters for functions with >2 params (e.g., `BuildDigestOptions`, `ConsensusCliIo` in `src/consensus/provider-cli/commands.ts`)
- Callback functions passed as properties of config objects
- Type annotations mandatory for all parameters

**Return Values:**
- Async functions return `Promise<T>`; use `Promise.all()` for concurrent operations
- Discriminated unions for outcomes (e.g., `ObserveOutcome | ObserveFailure` with `ok: boolean` discriminator in `src/transcript/session-observer/lib/observe.ts`)
- No implicit `undefined` returns; explicit `null` for absent values (e.g., `getSession` returns `null` when missing, not `undefined`)

## Module Design

**Exports:**

- Named exports preferred for multi-export modules
- Default exports used selectively (e.g., Vitest config, Next.js configs)
- Export types and interfaces alongside implementations
- Runtime-exported functions typically accompanied by TypeScript source (e.g., `src/consensus/core/consensus-loop.ts` generates `plugins/consensus/scripts/consensus-loop.mjs`)

**Barrel Files:**

- Minimal barrel files; most imports go directly to source module
- Barrel files used in `tests/helpers/` for test utilities but not in main codebase
- Import depth convention enforced by path structure (encourage specific imports over barrels)

---

_Convention analysis: 2026-07-11_
