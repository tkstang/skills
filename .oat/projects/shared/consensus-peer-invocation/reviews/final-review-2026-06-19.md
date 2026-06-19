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
**Commits:** 56

## Summary

Final review fails. The source cleanup, generated-output drift checks, full premerge stack, provider-neutral records, prepared parallel propagation, Evaluate integration, and Cursor submit-tool deferral are broadly coherent, but the new default provider CLI runtime path is not actually runnable against the installed default provider CLIs.

Both ready default providers fail immediately in the generated `consensus run` path because the invocation builder emits unsupported live CLI flags. Codex also declares a single-document stdout contract even though `codex exec --json` documents JSONL event output, so the adapter would reject successful live Codex output even after the flag issue is fixed.

## Findings

### Critical

- **Default provider CLI run path emits unsupported live provider flags** (`src/consensus/provider-cli/invocation.ts:49`)
  - Issue: The final source makes provider CLI the only new-run backend, but the generated run path fails immediately for both default ready peers. `buildClaudeInvocation()` passes `--permission-mode non-interactive`, while the installed Claude CLI rejects that value and lists allowed choices `acceptEdits`, `auto`, `bypassPermissions`, `default`, `dontAsk`, and `plan`. `buildCodexInvocation()` passes `--approval-policy never`, while the installed `codex exec` rejects `--approval-policy` as an unexpected argument. Review probes of `node plugins/consensus/scripts/consensus.mjs run --provider claude ...` and `--provider codex ...` both returned structured `ok:false` envelopes before any model work.
  - Fix: Replace the synthetic provider-neutral policy strings with provider-specific mappings that match the current CLI surfaces. For Claude, non-interactive execution is already selected by `--print`; use a valid permission mode only when explicitly requested and supported. For Codex, use supported `codex exec` flags or `-c` config overrides for approval/sandbox policy, then add generated-process tests that execute the real argv contract against fixtures that reject unknown flags.
  - Requirement: FR2, FR4, FR5, NFR2, NFR5

- **Codex output mode does not match `codex exec --json` JSONL output** (`src/consensus/provider-cli/adapters.ts:137`)
  - Issue: The Codex adapter advertises `output_modes: ['stdout_json']` and `runProviderTurn()` parses the entire provider stdout with `JSON.parse(stdout.trim())`. The installed `codex exec --help` says `--json` prints events to stdout as JSONL, not one final JSON document. That means a successful live Codex run will not satisfy the implemented parser; the path needs to read the last-message file or parse the JSONL event protocol to extract the final structured message.
  - Fix: Change the Codex adapter to a supported output mode, most likely `last_message_file` using `codex exec -o <file>`, or implement explicit JSONL event parsing if that is the desired contract. Add tests that model multiple JSONL events and prove the final response is extracted before schema-subset validation.
  - Requirement: FR2, FR3, FR4, NFR2, NFR4

### Important

- **Provider inventory/preflight probes are unbounded subprocesses** (`src/consensus/provider-cli/probe.ts:127`)
  - Issue: The run subprocess path has timeouts and output caps, but provider readiness probes spawn `--version` commands without any timeout or stdout/stderr cap. Refine and Evaluate run provider inventory/preflight before default executions, so a hung or noisy provider CLI can stall the whole wrapper before the bounded run path is reached.
  - Fix: Give probe execution the same bounded subprocess discipline as provider runs: a short default timeout, retained output cap, SIGTERM/SIGKILL cleanup, and provider-neutral diagnostics for timeout/output-cap failures. Cover this with a probe fixture that sleeps and one that emits oversized output.
  - Requirement: FR5, NFR2, NFR5

- **`--request-json` bypasses optional-field validation** (`src/consensus/provider-cli/args.ts:456`)
  - Issue: CLI flags validate positive integers and runtime-policy field shapes, but request JSON only checks `schema_version`, `provider`, `schema_path`, and `prompt` before casting to `ConsensusCliRunRequest`. External callers can pass invalid `max_attempts`, `max_runtime_sec`, `max_output_bytes`, or scalar `runtime_policy.env_allowlist` values that bypass the flag parser and reach runtime policy/subprocess logic with unsound types.
  - Fix: Validate the full request JSON shape before returning it. Reuse the same positive-integer checks as flag parsing, require `runtime_policy.env_allowlist` to be a string array, reject unknown malformed runtime-policy fields, and add request-json tests for invalid optional values.
  - Requirement: FR1, NFR5

### Medium

None

### Minor

None

## Requirements/Design Alignment

**Evidence sources used:** `discovery.md`, `spec.md`, `design.md`, `plan.md`, `implementation.md`, `research/cursor-submit-tool-spike.md`, `research/provider-cli-dogfood-parity.md`, and phase review artifacts `p01` through `p04`.

### Requirements Coverage

| Requirement | Status | Notes |
| ----------- | ------ | ----- |
| FR1 | partial | CLI command/envelope surface exists, but request JSON validation is incomplete. |
| FR2 | partial | Claude/Codex/Cursor adapters exist, but Claude and Codex command contracts do not match live CLI surfaces. |
| FR3 | partial | Strategy selection and local validation exist; Cursor submit-tool remains deferred, but Codex output normalization is incompatible with JSONL output. |
| FR4 | partial | Refine/Evaluate route through provider CLI by default, but live default peers fail in the generated run path. |
| FR5 | partial | Inventory/preflight exists and reports provider-neutral statuses, but it does not validate runnable flags and probe subprocesses are unbounded. |
| FR6 | partial | Provider-neutral taxonomy exists, but live unsupported-option failures are currently surfaced as `PROVIDER_EXIT` because exact provider messages are not classified. |
| FR7 | implemented | New CLI-backed records write `raw_provider_response`, diagnostics, and attempts; resume coverage is present. |
| FR8 | implemented | `pnpm run build:check` passed and generated outputs are in sync. |
| FR9 | implemented | Host runtime detection/depth guard exists and has focused coverage. |
| FR10 | implemented | Cursor submit-tool support is explicitly deferred, `supports_submit_tool` remains false, and `submit_tool_candidate` is not selected by default. |
| FR11 | implemented | Future-provider capability fields are present without broad provider expansion. |
| NFR1 | implemented | No runtime dependencies were added; shipped runtime imports remain Node/local only. |
| NFR2 | partial | Run caps/timeouts exist, but live default provider execution fails and preflight probes are unbounded. |
| NFR3 | implemented | Source cleanup test and targeted scans pass, with only cleanup-test pattern literals remaining outside `.oat`. |
| NFR4 | partial | Stub/injected tests exist, but they encode invalid provider flags and do not cover Codex JSONL output. |
| NFR5 | partial | Run subprocess uses argv arrays and caps, but preflight probes and request JSON validation remain gaps. |
| NFR6 | implemented | First implementation stays within Claude/Codex/Cursor plus explicit future extension fields. |

### Extra Work (not in declared requirements)

None.

## Verification Commands

Run during review:

```bash
pnpm exec vitest run tests/consensus/provider-cli/source-cleanup.test.ts
pnpm run build:check
rg -n -i "paseo|getpaseo|install-paseo|raw_paseo_response|PASEO_|invokePaseo|preflightPaseo|paseoExitCode" -g '!/.git/**' -g '!.oat/**'
rg -n "CONSENSUS_PROVIDER_BACKEND|CONSENSUS_SMOKE_PROVIDER_BACKEND|provider_backend|provider-backend" -g '!/.git/**' -g '!.oat/**'
pnpm run premerge
pnpm exec vitest run tests/consensus/provider-cli/invocation.test.ts tests/consensus/provider-cli/structured-output.test.ts
claude --help
codex exec --help
node plugins/consensus/scripts/consensus.mjs provider ls --json
node plugins/consensus/scripts/consensus.mjs preflight --json --provider claude
node plugins/consensus/scripts/consensus.mjs run --provider claude --schema /tmp/consensus-schema.XXXXXX.json --json --prompt 'Return {"ok":true}'
node plugins/consensus/scripts/consensus.mjs run --provider codex --schema /tmp/consensus-schema.XXXXXX.json --json --prompt 'Return {"ok":true}'
```

Results:

- `source-cleanup.test.ts` passed.
- `build:check` passed; all generated outputs reported in sync.
- Targeted stale-backend scans found only the cleanup test's own pattern literals outside `.oat`.
- `premerge` passed: build, type-check, build-check, 72 Vitest files / 687 tests, validate, and smoke.
- Focused invocation/structured-output tests passed, but they currently assert the invalid provider flag assumptions.
- `provider ls` reported `claude` ready, `codex` ready, and `cursor` auth_required with submit-tool disabled.
- Generated `consensus run` returned `ok:false` for Claude due invalid `--permission-mode non-interactive`.
- Generated `consensus run` returned `ok:false` for Codex due unexpected `--approval-policy`.

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert findings into plan tasks.
