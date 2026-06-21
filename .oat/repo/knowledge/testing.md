---
oat_generated: true
oat_generated_at: 2026-06-20
oat_source_head_sha: e4e9348cf8b809448c693ed7182c017048eb4acf
oat_source_main_merge_base_sha: e4e9348cf8b809448c693ed7182c017048eb4acf
oat_warning: "GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index"
---

# Testing Patterns

**Analysis Date:** 2026-06-20

## Test Framework

**Runner:**

- Vitest `^4.1.9`. Config: `vitest.config.mjs` (node environment, `testTimeout: 10_000`).
- Invoked via `scripts/run-vitest.mjs` (the repo deliberately avoids the Node built-in test runner — guarded by `tests/tooling/no-node-test-runner.test.ts`).

**Assertion Library:**

- Vitest's built-in `expect` (`toEqual`, `toMatchObject`, `arrayContaining`, etc.).

**Run Commands:**

```bash
pnpm run test          # full suite via scripts/run-vitest.mjs
pnpm run type-check    # tsc --noEmit (type safety, not part of vitest)
pnpm run validate      # repo structure / manifest / docs invariants
pnpm run smoke         # mocked end-to-end consensus wrapper flow
pnpm run premerge      # build + type-check + build:check + test + validate + smoke
```

## Test File Organization

**Location:**

- Separate `tests/` tree mirroring the `src/` domains (`tests/consensus/...`, `tests/transcript-core/...`, `tests/session-observer/...`).

**Naming:**

- `<subject>.test.ts`. Tests import canonical source directly using NodeNext `.js` specifiers (e.g. `../../../src/consensus/provider-cli/adapters.js`).

**Structure:**

```
tests/
├── consensus/        # core, evaluate, refine, provider-cli unit + integration
├── transcript-core/  # runtimes.ts behavior
├── session-observer/ # locate, observe, rank, watch, digest, integration + fixtures/
├── export-session-transcript/  # cli, sanitize + fixtures/
├── repo/             # layout, manifests, frontmatter, readme-scope invariants
├── release/          # versioning, validate-script, smoke-test-script
├── tooling/          # generated-output-sync (drift guard), vitest-config, no-node-test-runner
├── fixtures/         # shared bins + sample inputs
└── helpers/          # consensus.ts, process.mjs (shared utilities)
```

72 test files total.

## Test Structure

**Suite Organization:**

```typescript
import { describe, expect, it } from 'vitest';
import { providerRegistry } from '../../../src/consensus/provider-cli/adapters.js';

describe('provider adapter registry', () => {
  it('registers the first-scope provider adapters by user-facing ID', () => {
    const registry = providerRegistry();
    expect(registry.list().map((a) => a.id)).toEqual(['claude', 'codex', 'cursor']);
  });
});
```

**Patterns:**

- `describe`/`it` blocks; behavior-named test titles.
- `toMatchObject` / `arrayContaining` for partial structural assertions on capability/config objects.

## Mocking

**Framework:** No vitest auto-mocking. Tests favor **real subprocess + fixture stub binaries** over mocks.

**Patterns:**

- Fixture executables under `tests/fixtures/bin/` (`consensus`, `consensus-provider-stub`) stand in for real provider CLIs, wired in via a stubbed PATH/env (`makeStubEnv` in `tests/helpers/process.mjs`).
- Generated runtime `.mjs` is imported and exercised directly (e.g. smoke test imports `runSequential`, `runWrapperCli` from `consensus-refine.mjs`).

**What to Mock:**

- The provider CLI boundary only — via fixture stub binaries, not in-process mocks.

**What NOT to Mock:**

- Internal modules, filesystem, and the consensus loop itself — exercised for real against temp dirs.

## Fixtures and Factories

**Test Data:**

- JSONL transcript fixtures per runtime under `tests/session-observer/fixtures/{claude-code,codex,cursor}/` (typical, malformed, partial-tail, empty variants) and `tests/export-session-transcript/fixtures/*/hidden-payloads.jsonl`.
- `tests/helpers/consensus.ts` provides domain helpers like `extractJsonBlock(markdown, label)` to parse `<!-- consensus:<label> -->` artifact blocks.

**Location:**

- `tests/**/fixtures/` and `tests/helpers/`.

## Coverage

**Requirements:** None enforced. Coverage is breadth-driven (unit + integration + repo-invariant + release suites).

## Test Types

**Unit Tests:**

- Pure-module behavior (adapters, args, envelope, section-parser, sanitize, runtimes).

**Integration Tests:**

- End-to-end CLI flows with stub binaries and temp dirs (`provider-cli-integration`, `parallel-integration`, session-observer `integration.test.ts`, export `cli.test.ts`).

**Repo-Invariant Tests:**

- `tests/repo/*` and `tests/tooling/generated-output-sync.test.ts` assert structure, manifest parity, skill frontmatter, and that committed `.mjs` matches a fresh build (catches forgetting `pnpm run build`).

**E2E (live provider):**

- Mocked end-to-end via `pnpm run smoke`. Live-provider CLI paths are gated behind the release checklist (`RELEASING.md`), not the default suite.

## Common Patterns

**Async Testing:**

```typescript
it('runs the wrapper end to end', async () => {
  const result = await runWrapperCli(args, { env, cwd });
  expect(result.exitCode).toBe(0);
});
```

**Error Testing:**

```typescript
expect(() => extractJsonBlock(markdown, 'verdict')).toThrow();
// or assert on classified provider error codes (PROVIDER_TIMEOUT, PROVIDER_EXIT, ...)
```

---

_Testing analysis: 2026-06-20_
