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
**Commits:** 62

## Summary

Final re-review passes with no findings. The prior remaining Critical finding is resolved: Claude provider-validated invocations now load the schema file, pass inline JSON schema content to `claude --json-schema`, and redact that inline schema from diagnostics and returned command metadata.

The broader prior final findings also remain resolved. Codex continues to use file-path schema delivery through `--output-schema <FILE>` plus `--output-last-message <FILE>`, readiness probes are bounded, request JSON optional fields are validated, generated runtime output is in sync, stale-backend scans remain clean, and no runtime dependencies were introduced.

## Findings

### Critical

None

### Important

None

### Medium

None

### Minor

None

## Requirements/Design Alignment

**Evidence sources used:** `discovery.md`, `spec.md`, `design.md`, `plan.md`, `implementation.md`, prior final reviews `reviews/final-review-2026-06-19.md` and `reviews/final-review-2026-06-19-v2.md`, current diff `9bf89b9ffe52e42fe5e6526dbf5ab909a455b9a4..HEAD`, and focused source/tests under `src/consensus/provider-cli/`, `plugins/consensus/scripts/consensus.mjs`, `tests/consensus/provider-cli/`, and Refine/Evaluate integration surfaces.

### Requirements Coverage

| Requirement | Status | Notes |
| ----------- | ------ | ----- |
| FR1 | implemented | CLI command/envelope surface exists; `--request-json` validates required and optional fields. |
| FR2 | implemented | Claude, Codex, and Cursor adapters exist with provider-specific command construction, readiness probes, capability reporting, and diagnostic metadata. |
| FR3 | implemented | Structured output strategy selection distinguishes Claude provider-validated inline schema, Codex constrained-native schema file delivery, Cursor prompt-only fallback, and reserved submit-tool support; local validation/retry remains enforced. |
| FR4 | implemented | Refine and Evaluate route through the provider CLI seam by default without changing consensus-loop verdict semantics. |
| FR5 | implemented | Provider inventory/preflight distinguishes ready, missing, auth-required, unavailable, and unsupported providers with bounded probes. |
| FR6 | implemented | Provider-neutral error taxonomy and terminal/retry classification are covered by focused tests. |
| FR7 | implemented | CLI-backed records write `raw_provider_response`, diagnostics, and attempts; resume/integration coverage is present. |
| FR8 | implemented | `pnpm run build:check` passed; generated runtime outputs are in sync. |
| FR9 | implemented | Host runtime detection/depth guard exists and has process coverage. |
| FR10 | implemented | Cursor submit-tool remains explicitly deferred, reserved, and unselected by default. |
| FR11 | implemented | Future-provider capability fields are present without broad provider expansion. |
| NFR1 | implemented | No package or lockfile dependency changes were introduced; shipped provider CLI runtime imports remain local/Node only. |
| NFR2 | implemented | Output caps, timeouts, provider validation, Codex last-message extraction, and retry boundaries are covered. No live model-spend run was performed in this re-review. |
| NFR3 | implemented | Source cleanup tests and targeted scans pass, with only cleanup-test pattern literals remaining outside `.oat`. |
| NFR4 | implemented | Stub/injected tests cover provider command contracts, including strict Claude inline-schema and Codex last-message/schema-file behavior. |
| NFR5 | implemented | Provider subprocesses use argv arrays, bounded output/timeouts, redacted diagnostics, and schema redaction for Claude inline schema. |
| NFR6 | implemented | First implementation stays within Claude/Codex/Cursor plus explicit future extension fields. |

### Extra Work (not in declared requirements)

None.

## Verification Commands

Run during final re-review:

```bash
pnpm exec vitest run tests/consensus/provider-cli/invocation.test.ts tests/consensus/provider-cli/structured-output.test.ts tests/consensus/provider-cli/probe.test.ts tests/consensus/provider-cli/args.test.ts tests/consensus/provider-cli/cli-process.test.ts tests/consensus/provider-cli/source-cleanup.test.ts
pnpm run type-check
pnpm run build:check
rg -n -i "paseo|getpaseo|install-paseo|raw_paseo_response|PASEO_|invokePaseo|preflightPaseo|paseoExitCode" -g '!/.git/**' -g '!.oat/**'
rg -n "CONSENSUS_PROVIDER_BACKEND|CONSENSUS_SMOKE_PROVIDER_BACKEND|provider_backend|provider-backend" -g '!/.git/**' -g '!.oat/**'
pnpm run premerge
pnpm exec vitest run tests/session-observer/cli.test.ts -t "review --help does not throw"
pnpm run premerge
claude --help
codex exec --help
node plugins/consensus/scripts/consensus.mjs provider ls --json
node plugins/consensus/scripts/consensus.mjs preflight --json --provider claude
node plugins/consensus/scripts/consensus.mjs preflight --json --provider codex
node plugins/consensus/scripts/consensus.mjs preflight --json --provider cursor
git diff --name-only 9bf89b9ffe52e42fe5e6526dbf5ab909a455b9a4..HEAD -- package.json pnpm-lock.yaml
rg -n --pcre2 "from ['\"](?!node:|\.)|require\(['\"](?!node:|\.)" src/consensus/provider-cli plugins/consensus/scripts/consensus.mjs
```

Results:

- Focused provider CLI suite passed: 6 files / 68 tests.
- `type-check` passed.
- `build:check` passed and reported all generated outputs in sync.
- Targeted stale-backend scans found only the cleanup scan's own denied-pattern literals outside `.oat`.
- First `premerge` run failed on an intermittent `tests/session-observer/cli.test.ts` timeout outside the provider CLI surface; the targeted test passed in isolation, and the second `premerge` run passed completely: build, type-check, build-check, 72 Vitest files / 708 tests, validate, and smoke.
- `claude --help` confirms `--json-schema <schema>` expects inline schema JSON, and `codex exec --help` confirms `--output-schema <FILE>`, `--output-last-message <FILE>`, and JSONL event output.
- Generated provider inventory/preflight reported Claude ready, Codex ready, and Cursor `auth_required` with provider-neutral diagnostics.
- No package or lockfile changes were present in the reviewed range.
- Runtime dependency scan for the provider CLI source/generated runtime found no external imports.

## Recommended Next Step

Run the `oat-project-review-receive` skill to record the passing final review and close the review cycle.
