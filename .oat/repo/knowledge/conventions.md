---
oat_generated: true
oat_generated_at: 2026-07-17
oat_source_head_sha: 6c03afde1417fbe29f0e2c81009629f0e36ca945
oat_source_main_merge_base_sha: 6c03afde1417fbe29f0e2c81009629f0e36ca945
oat_warning: 'GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index'
---

# Coding Conventions

**Analysis Date:** 2026-07-17

## Naming Patterns

**Files:**

- kebab-case for module files: `consensus-loop.ts`, `provider-cli.ts`, `session-observer.ts` (seen in `src/consensus/core/consensus-loop.ts`, `src/consensus/provider-cli/cli.ts`, `src/transcript/session-observer/lib/observe.ts`)
- Test files use same convention with `.test.ts` suffix: `consensus-loop.test.ts`, `observe.test.ts` (seen in `tests/session-observer/observe.test.ts`, `tests/consensus/install-contract.test.ts`)

**Functions:**

- camelCase for function names: `observeCatchUp`, `readUtf8File`, `processExitForEnvelope`, `makeLoopOptions` (seen in `src/transcript/session-observer/lib/observe.ts`, `src/consensus/provider-cli/cli.ts`, `tests/helpers/consensus.ts`)
- Async functions return `Promise<T>`: `async function readUtf8File(filePath: string, maxBytes?: number): Promise<string>` (seen in `src/consensus/provider-cli/cli.ts:27-30`)

**Variables:**

- camelCase for all variable declarations: `tempRoot`, `sectionFile`, `transcriptPath`, `stateDir`, `cwd` (seen in `tests/helpers/consensus.ts:37-56`, `tests/session-observer/observe.test.ts:24-32`)

**Types and Interfaces:**

- PascalCase for all type definitions: `ConsensusCliIo`, `ConsensusCliRunSuccess`, `ProviderCapabilities`, `HostContext`, `ProviderInventoryEntry` (seen in `src/consensus/provider-cli/commands.ts:52-60`, `src/consensus/provider-cli/types.ts`)
- Suffix `Payload` for verdict/response data: `CritiquePayload`, `RevisionVerdictPayload`, `TerminalVerdictPayload` (seen in `src/consensus/core/consensus-loop.ts:40-54`)
- Suffix `Envelope` for CLI/transport contracts: `ConsensusCliRunEnvelope`, `ProviderListEnvelope`, `PreflightEnvelope` (seen in `src/consensus/provider-cli/types.ts:175-200`)

**Classes:**

- PascalCase for error classes: `ConsensusCliUsageError`, `SubmitCaptureLimitError`, `ConsensusError`, `PanelError` (seen in `src/consensus/provider-cli/args.ts:10-16`, `src/consensus/core/consensus-loop.ts:476`)

**Constants:**

- UPPER_SNAKE_CASE for constants: `FIRST_SCOPE_PROVIDER_IDS`, `HOST_RUNTIMES`, `CONSENSUS_SHARED_CLI_RELATIVE_PATH`, `MAX_WAIT_MS` (seen in `src/consensus/provider-cli/types.ts:1-14`, `src/consensus/core/consensus-loop.ts`)
- Declared as `as const` to enable type discrimination: `export const FIRST_SCOPE_PROVIDER_IDS = ['claude', 'codex', 'cursor'] as const;` (seen in `src/consensus/provider-cli/types.ts:1`)

## Code Style

**Formatting:**

- Tool: **oxfmt** (configured in `.oxfmtrc.json`)
- Print width: 80 characters
- Tab width: 2 spaces
- Use spaces, not tabs
- Semicolons: required
- Quotes: single quotes for strings
- Trailing commas: all (except function parameters in some edge cases)
- Bracket spacing: true
- Arrow parens: always
- End of line: LF
- Incremental adoption: only files changed in a PR are formatted; whole-repo formatting is a planned future cleanup

**Linting:**

- Tool: **oxlint** (configured in `.oxlintrc.json`)
- Environment: Node.js + ES2024
- Core rules as errors:
  - `correctness` category: all errors (e.g., unused variables, logic mistakes)
  - `suspicious` category: all errors (e.g., ambiguous constructs)
  - `eslint/prefer-const`: enforce const over let where applicable
  - `eslint/eqeqeq`: enforce `===` / `!==` (except smart mode allows `== null`)
  - `eslint/no-empty`: no empty blocks
- Warnings allowed:
  - `eslint/no-shadow`: warn only (variables shadowing outer scope)
- Special cases:
  - Test files (`.test.mjs`, `.test.js`, `tests/**`): `eslint/no-unused-vars` disabled to allow test setup without assertions
  - Generated files excluded: consensus loop/wrapper/evaluate runtimes, session-observer, transcript exports
- Executed via: `pnpm lint` (check) / `pnpm lint:fix` (auto-fix)

## Import Organization

**Standard Order:**

1. Node.js standard library: `import { spawn } from 'node:child_process';`, `import os from 'node:os';`
2. Third-party packages: `import { expect, describe, test } from 'vitest';`
3. Local source files: relative imports with `.js` extension
4. Type imports: `import type { ... } from '...';` grouped separately

Example from `src/consensus/provider-cli/cli.ts`:
```typescript
import { readFile, stat } from 'node:fs/promises';

import { runConsensusCli } from './commands.js';
import type { ConsensusCliIo } from './commands.js';
```

**Path Style:**

- Relative paths with explicit extensions: `'./commands.js'`, `'../../helpers/consensus.ts'`
- Absolute paths used for type imports only when necessary
- No path aliases (@/ style) observed in codebase

## Error Handling

**Pattern: Custom Error Classes**

Errors extend `Error` and set the `name` property for identification (seen in `src/consensus/provider-cli/args.ts:10-16`):

```typescript
export class ConsensusCliUsageError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ConsensusCliUsageError';
    if (cause) this.cause = cause;
  }
}
```

Usage: `throw new ConsensusCliUsageError('Missing required --provider');`

**Error Classes in Codebase:**

- `ConsensusCliUsageError` (src/consensus/provider-cli/args.ts): CLI argument validation errors
- `SubmitCaptureLimitError` (src/consensus/provider-cli/submit-capture.ts): File size limit exceeded
- `ConsensusError` (src/consensus/core/consensus-loop.ts): Core consensus loop failures
- `PanelError` (src/consensus/panel/consensus-panel.ts): Panel consensus failures

**Error Handling in Async Code:**

Errors propagate up call stack; CLI handlers catch and format them into envelope responses (seen in `src/consensus/provider-cli/commands.ts` and `src/consensus/provider-cli/envelope.ts`).

## Logging

**Framework:** console API (Node.js standard)

**Patterns:**

- No centralized logger library observed
- stderr used for errors and diagnostics: `process.stderr.write()`
- stdout used for structured output (JSON envelopes)
- No structured logging fields; plain text for stderr
- Example from tests: passing `stderr` and `stdout` streams to CLI handler for capture (seen in `src/consensus/provider-cli/commands.ts:52-60`)

## Comments

**When to Comment:**

- JSDoc on all exported functions and interfaces
- Descriptive comments on complex algorithms (e.g., session-observer ranking logic)
- File-level comments explaining module purpose (seen in `tests/helpers/consensus.ts:1-6`)

**JSDoc/TSDoc:**

- Function docs include purpose, parameters, return type, and side effects
- Example (from `tests/helpers/consensus.ts:22-35`):
  ```typescript
  /**
   * Extract and parse a `<!-- consensus:<label>\n...\n-->` JSON block from a
   * markdown deliberation artifact. Fails the calling test if the block is absent.
   */
  export function extractJsonBlock(markdown: string, label: string): any { ... }
  ```
- Parameter descriptions included when behavior is non-obvious
- Return type inferred from signature (explicit in complex cases)

## Function Design

**Size:** Most functions 20–100 lines; larger functions (100–500 lines) documented and split when possible.

Large files:
- `src/consensus/core/consensus-loop.ts`: 3961 lines (core orchestration, not refactored for modularity)
- `src/consensus/refine/consensus-refine.ts`: 3890 lines (wrapper entrypoint, similar scope)

**Parameters:**

- Single object parameter for functions with 2+ arguments: `{ sessionId, runtime, cwd }` (seen in `src/transcript/session-observer/lib/observe.ts`)
- Destructuring in parameter list for clarity
- Optional properties marked with `?`: `maxBytes?: number` (seen in `src/consensus/provider-cli/cli.ts:29`)

**Return Values:**

- Discriminated union pattern for outcomes: `{ ok: true, result: T } | { ok: false, error: E }`
- Async functions return `Promise<T>`
- Example (from tests, seen in `tests/session-observer/observe.test.ts:98-124`):
  ```typescript
  const result = await observeCatchUp({ runtime, cwd, session });
  expect(result.ok).toBe(true);
  expect(result.digest.mode).toBe('catch-up');
  ```

## Module Design

**Exports:**

- Separate concerns: types exported from `types.ts`, functions from domain modules
- Example: `src/consensus/provider-cli/types.ts` exports all CLI interface contracts; `src/consensus/provider-cli/cli.ts` exports function implementations
- Re-exports grouped: `export { helpText, runConsensusCli } from './commands.js';`

**Barrel Files:**

- Not widely used; imports are direct to source files
- Example: `import { observeCatchUp } from '../../src/transcript/session-observer/lib/observe.js'` (seen in `tests/session-observer/observe.test.ts:11`)

**Discriminated Unions:**

- Used for type-safe outcome patterns and CLI envelopes
- Example (from `src/consensus/provider-cli/types.ts`):
  ```typescript
  export type ConsensusCliRunEnvelope = ConsensusCliRunSuccess | ConsensusCliRunFailure;
  ```
- Runtime checks via `envelope.ok` or `result.kind` to narrow type

---

_Convention analysis: 2026-07-17_
