---
oat_generated: true
oat_generated_at: 2026-06-19
oat_review_scope: final
oat_review_type: code
oat_project: .oat/projects/shared/consensus-peer-invocation
---

# Code Review: final

**Reviewed:** 2026-06-19
**Scope:** final implementation branch range `9bf89b9ffe52e42fe5e6526dbf5ab909a455b9a4..HEAD`
**Files reviewed:** 107
**Commits:** 61

## Summary

Final re-review fails. The prior Codex last-message, readiness probe bounds, request JSON validation, generated-output sync, stale-backend cleanup, and broader premerge checks are substantially resolved, but the default Claude provider run path is still not runnable against the installed live Claude CLI.

The Claude adapter passes a schema file path to `claude --json-schema`, while the installed CLI expects the schema argument itself to be valid JSON. A no-spend parse probe and the generated `consensus run --provider claude` command both fail before model execution with `--json-schema is not valid JSON`, so the provider CLI default cutover remains broken for a ready first-scope provider.

## Findings

### Critical

- **Claude run path passes a schema path where the live CLI requires inline JSON** (`src/consensus/provider-cli/invocation.ts:50`)
  - Issue: `buildClaudeInvocation()` appends `--json-schema` followed by `request.schema_path`. The installed `claude --help` documents `--json-schema <schema>` with an inline JSON schema example, and a bare no-credentials parse probe rejected a temp schema path with `Error: --json-schema is not valid JSON: JSON Parse error: Unrecognized token '/'`. The generated runtime shows the same failure through `node plugins/consensus/scripts/consensus.mjs run --provider claude --schema <file> --json --prompt ... --timeout-sec 5`, returning `ok:false` before model execution. Because Claude is a ready first-scope provider and `selectStructuredOutputStrategy()` chooses `provider_validated` for Claude, default Refine/Evaluate runs using Claude will fail at provider invocation.
  - Fix: For Claude, either read the schema file contents and pass the schema JSON string to `--json-schema`, or default Claude to `prompt_only` until inline schema delivery is implemented. Add strict generated-process coverage that rejects schema paths for Claude and proves the generated `consensus run --provider claude --schema <file>` path passes inline schema JSON to the provider fixture. Keep Codex on file-path schema delivery because `codex exec --help` explicitly supports `--output-schema <FILE>`.
  - Requirement: FR2, FR3, FR4, NFR2, NFR4

### Important

None

### Medium

None

### Minor

None

## Requirements/Design Alignment

**Evidence sources used:** `discovery.md`, `spec.md`, `design.md`, `plan.md`, `implementation.md`, prior final review `reviews/final-review-2026-06-19.md`, current diff `9bf89b9ffe52e42fe5e6526dbf5ab909a455b9a4..HEAD`, and focused source/tests under `src/consensus/provider-cli/`, `tests/consensus/provider-cli/`, and Refine/Evaluate integration tests.

### Requirements Coverage

| Requirement | Status | Notes |
| ----------- | ------ | ----- |
| FR1 | implemented | CLI command/envelope surface exists and `--request-json` now validates optional fields and runtime-policy shapes. |
| FR2 | partial | Claude/Codex/Cursor adapters exist and Codex live flags are aligned, but Claude schema delivery does not match the live CLI contract. |
| FR3 | partial | Structured output strategy selection and validation/retry exist, but Claude `provider_validated` cannot run while it passes a schema path to `--json-schema`. |
| FR4 | partial | Refine/Evaluate route through provider CLI by default, but ready Claude peers fail in the generated provider run path. |
| FR5 | implemented | Provider inventory/preflight now use bounded probes and provider-neutral timeout/output-cap diagnostics. |
| FR6 | implemented | Provider-neutral taxonomy and terminal retry classification are covered. |
| FR7 | implemented | CLI-backed records write `raw_provider_response`, diagnostics, and attempts; resume/integration coverage is present. |
| FR8 | implemented | `pnpm run build:check` passed; generated outputs are in sync. |
| FR9 | implemented | Host runtime detection/depth guard exists and has process coverage. |
| FR10 | implemented | Cursor submit-tool remains reserved and unselected by default. |
| FR11 | implemented | Future-provider capability fields are present without broad provider expansion. |
| NFR1 | implemented | No package or lockfile dependency changes were introduced. |
| NFR2 | partial | Runtime caps/retries exist, but the Claude default provider strategy fails before model execution. |
| NFR3 | implemented | Source cleanup test and targeted scans pass, with only cleanup-test pattern literals remaining outside `.oat`. |
| NFR4 | partial | Tests cover the prior flag, Codex output, probe, and request-validation fixes, but no test catches Claude schema path-vs-inline JSON delivery. |
| NFR5 | implemented | Provider subprocesses use argv arrays, output caps, timeouts, redacted diagnostics, and last-message cleanup. |
| NFR6 | implemented | First implementation stays within Claude/Codex/Cursor plus explicit future extension fields. |

### Extra Work (not in declared requirements)

None.

## Verification Commands

Run during re-review:

```bash
pnpm exec vitest run tests/consensus/provider-cli/invocation.test.ts tests/consensus/provider-cli/structured-output.test.ts tests/consensus/provider-cli/probe.test.ts tests/consensus/provider-cli/args.test.ts tests/consensus/provider-cli/cli-process.test.ts tests/consensus/provider-cli/source-cleanup.test.ts
pnpm run type-check
pnpm run build:check
rg -n -i "paseo|getpaseo|install-paseo|raw_paseo_response|PASEO_|invokePaseo|preflightPaseo|paseoExitCode" -g '!/.git/**' -g '!.oat/**'
rg -n "CONSENSUS_PROVIDER_BACKEND|CONSENSUS_SMOKE_PROVIDER_BACKEND|provider_backend|provider-backend" -g '!/.git/**' -g '!.oat/**'
claude --help
codex exec --help
node plugins/consensus/scripts/consensus.mjs provider ls --json
node plugins/consensus/scripts/consensus.mjs preflight --json --provider claude
node plugins/consensus/scripts/consensus.mjs preflight --json --provider codex
node plugins/consensus/scripts/consensus.mjs preflight --json --provider cursor
pnpm run premerge
pnpm exec vitest run tests/session-observer/cli.test.ts -t "review --help does not throw"
pnpm run premerge
env -i PATH="$PATH" HOME="$tmpdir/home" TMPDIR="$tmpdir" claude --bare --print --output-format json --json-schema "$tmp_schema" 'Return {"verdict":"accept"}'
node plugins/consensus/scripts/consensus.mjs run --provider claude --schema "$schema" --json --prompt 'Return {"verdict":"accept"}' --timeout-sec 5
```

Results:

- Focused provider CLI suite passed: 6 files / 67 tests.
- `type-check` passed.
- `build:check` passed and reported all generated outputs in sync.
- Targeted stale-backend scans found only the cleanup scan's own pattern literals outside `.oat`.
- `claude --help` and `codex exec --help` confirmed the current non-spend CLI surfaces; Codex supports `--output-last-message` and `--output-schema <FILE>`.
- Generated provider inventory/preflight reported Claude ready, Codex ready, and Cursor `auth_required` with provider-neutral diagnostics.
- First `premerge` run failed on an intermittent `tests/session-observer/cli.test.ts` timeout outside the provider CLI surface; the targeted test passed in isolation, and the second `premerge` run passed completely: build, type-check, build-check, 72 Vitest files / 707 tests, validate, and smoke.
- No package or lockfile changes were present in the reviewed range.
- No-spend Claude schema parse probe failed with `--json-schema is not valid JSON` when given a schema file path.
- Generated `consensus run --provider claude` failed with a structured `ok:false` envelope for the same schema-path error before model execution.

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert the Critical finding into a fix task.
