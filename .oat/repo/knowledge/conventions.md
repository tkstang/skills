---
oat_generated: true
oat_generated_at: 2026-08-31
oat_source_head_sha: ae313c5bb6e54d521b4b00d0f44993b8fdf72ecc
oat_source_main_merge_base_sha: 467efe57bcb5e40b2cfb09c77507aa50e4c1cc44
oat_warning: 'GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index'
---

# Coding Conventions

**Analysis Date:** 2026-08-31

## Naming Patterns

**Files:**

- Canonical TypeScript uses lowercase kebab-case filenames such as `src/consensus/refine/refine-args.ts`, `src/consensus/provider-cli/submit-capture.ts`, and `src/transcript/session-observer/lib/cursor-state.ts`.
- Tests retain the subject stem and use `.test.ts`, for example `tests/consensus/refine/resume-parse.test.ts` and `tests/session-observer/watch-state.test.ts`; new `.test.mjs` files are prohibited by `tests/AGENTS.md`.
- Shipped runtimes use matching `.mjs` names, including `plugins/consensus/skills/refine/scripts/refine-args.mjs` and `skills/session-observer-collab/scripts/collab-control.mjs`; the source/runtime boundary is specified in `AGENTS.md`.

**Functions:**

- Functions use camelCase, including `normalizeProviderInventory`, `parseWrapperArgs`, and `readUtf8File` in `src/consensus/refine/refine-args.ts` and `src/consensus/provider-cli/cli.ts`.
- Async functions use explicit `Promise<T>` signatures when their result shape is significant, as in `src/consensus/provider-cli/cli.ts` and `src/transcript/session-observer/lib/observe.ts`.

**Variables:**

- Local values and parameters use camelCase (`tempRoot`, `outputPath`, `providerId`, `maxRounds`) in `src/consensus/refine/refine-args.ts` and `tests/consensus/evaluate/output.test.ts`.
- Immutable values normally use `const`; `.oxlintrc.json` makes `eslint/prefer-const` an error.

**Types:**

- Interfaces, type aliases, and classes are PascalCase: `ParsedWrapperOptions`, `ProviderInventoryEntry`, and `CursorStateRecoveryRequiredError` in `src/consensus/refine/refine-types.ts` and `src/transcript/session-observer/lib/cursor-state.ts`.
- Bounded values use literal unions and readonly inputs, such as `IterationMode`, `AgencyValue`, and `readonly string[]` in `src/consensus/refine/refine-types.ts` and `src/consensus/refine/refine-args.ts`.
- Fixed limits and policy constants use UPPER_SNAKE_CASE (`PROVIDER_ID_PATTERN`, `MAX_ROUNDS_MIN`, `VALID_RUNTIMES`) in `src/consensus/refine/refine-args.ts` and `src/transcript/session-observer/lib/observe.ts`.

## Code Style

**Formatting:**

- **oxfmt** is configured by `.oxfmtrc.json` and exposed as `pnpm format` in `package.json`: 80 columns, two spaces, semicolons, single quotes, trailing commas, arrow parentheses, and LF line endings.
- `.oxfmtrc.json` excludes generated runtime, OAT-synced, and agent-instruction paths; `AGENTS.md` describes the generated output contract.

**Linting:**

- **oxlint** runs through `pnpm lint` and `pnpm lint:fix` from `package.json`, with Node and ES2024 settings in `.oxlintrc.json`.
- `.oxlintrc.json` makes `correctness`, `suspicious`, `prefer-const`, `eqeqeq`, and `no-empty` errors; it retains `no-shadow` as a warning and disables unused-variable linting for test paths.

## Import Organization

**Order:**

1. Node built-ins, followed by a blank line, as in `src/consensus/provider-cli/cli.ts` and `src/transcript/session-observer/lib/observe.ts`.
2. Third-party imports, notably Vitest in `tests/consensus/provider-cli/adapters.test.ts`.
3. Relative value imports with explicit `.js` extensions, as in `src/consensus/provider-cli/cli.ts` and `src/consensus/refine/refine-args.ts`.
4. `import type` declarations after value imports, as in `src/consensus/provider-cli/cli.ts` and `tests/helpers/consensus.ts`.

**Path Aliases:**

- Not detected. `tsconfig.json` has no `baseUrl` or `paths`; source and test imports are direct relatives in `src/consensus/provider-cli/cli.ts` and `tests/consensus/refine/parallel-errors.test.ts`.

## Error Handling

**Patterns:**

- Parsers fail early with `throw new Error(...)` for invalid values in `src/consensus/refine/refine-args.ts`.
- Named domain errors carry caller-relevant semantics, including `ConsensusError` in `src/consensus/evaluate/consensus-evaluate.ts`, `SubmitCaptureLimitError` in `src/consensus/provider-cli/cli.ts`, and `CursorStateRecoveryRequiredError` in `src/transcript/session-observer/lib/cursor-state.ts`.
- CLI boundaries convert errors into JSONL/stdout-stderr output and numeric exit codes in `src/consensus/evaluate/consensus-evaluate.ts`, `src/consensus/refine/consensus-refine.ts`, and `src/consensus/provider-cli/cli.ts`.

## Logging

**Framework:** Node standard streams and `console`; no separate logging dependency is declared in `package.json`.

**Patterns:**

- Consensus wrappers inject `stdout` and `stderr`, defaulting to process streams, in `src/consensus/evaluate/consensus-evaluate.ts` and `src/consensus/refine/consensus-refine.ts`.
- Session-observer writes CLI output with `process.stdout` / `process.stderr` in `src/transcript/session-observer/session-observer.ts`; `src/transcript/core/runtimes.ts` warns about malformed records with `console.warn`.
- `src/transcript/export-session/export-session-transcript.ts` emits prefixed `console.log` / `console.error` CLI messages.

## Comments

**When to Comment:**

- Module headers explain ownership and boundaries in `src/transcript/session-observer/lib/observe.ts` and `tests/helpers/consensus.ts`.
- Comments document non-obvious policy and test seams, including provider-status treatment in `src/consensus/refine/refine-args.ts` and a filesystem mock rationale in `tests/consensus/core/loop-records.test.ts`.

**JSDoc/TSDoc:**

- JSDoc is selective: exported test helpers are documented in `tests/helpers/process.mjs`, and return/behavior details appear in `src/transcript/export-session/export-session-transcript.ts`; it is not present on every function.

## Function Design

**Size:**

- Small private parsing helpers compose exported functions in `src/consensus/refine/refine-args.ts`; the CLI entrypoint in `src/consensus/provider-cli/cli.ts` also keeps IO construction and file-reading helpers private.

**Parameters:**

- Multi-dependency operations accept typed options objects, for example the injected invocation/stream options in `src/consensus/evaluate/consensus-evaluate.ts`.
- CLI parsers accept immutable argv input as `readonly string[]` in `src/consensus/refine/refine-args.ts`.

**Return Values:**

- Public functions return typed objects, unions, or explicit numeric exit results, as in `src/consensus/refine/refine-args.ts`, `src/transcript/session-observer/lib/observe.ts`, and `src/consensus/provider-cli/cli.ts`.

## Module Design

**Exports:**

- Named value and type exports are the normal public surface in `src/consensus/refine/refine-args.ts` and `src/transcript/session-observer/lib/types.ts`.

**Barrel Files:**

- Not detected in `src/`; modules import direct relatives such as `./commands.js` and `../core/consensus-loop.js` in `src/consensus/provider-cli/cli.ts` and `src/consensus/refine/refine-args.ts`.

---

_Convention analysis: 2026-08-31_
