---
oat_generated: true
oat_generated_at: 2026-06-19
oat_review_scope: final
oat_review_type: code
oat_review_invocation: manual
oat_project: .oat/projects/shared/consensus-peer-invocation
---

# Code Review: final

**Reviewed:** 2026-06-19
**Scope:** final (`9bf89b9ffe52e42fe5e6526dbf5ab909a455b9a4..HEAD`, 68 commits)
**Files reviewed:** ~40 maintained source/test/doc files (focus: `src/consensus/provider-cli/**`, `src/consensus/core/consensus-loop.ts`, generated runtime, tests, release scripts)
**Commits:** 68

## Summary

This project replaced the external peer-invocation backend with an owned provider-neutral `consensus` CLI for the Refine and Evaluate consensus skills. The implementation is high quality: the CLI contract, adapter floor, host recursion guard, runtime-policy validation, bounded subprocess execution, structured-output retry coordinator, and two-tier retry boundary all match `design.md`, and the source cutover is clean. All focused provider-CLI, integration, wrapper, records, resume, cleanup, and smoke suites pass (195 focused tests), `build:check` reports no generated drift, `type-check` is clean, and the generated CLI runs end-to-end with real provider probing. I found zero Critical and zero Important findings. Two Minor items remain, both stale-artifact alignment notes (no code change required).

## Findings

### Critical

None

### Important

None

### Minor

- **Design stdin prompt example omits the implemented `-` marker** (`.oat/projects/shared/consensus-peer-invocation/design.md:480`)
  - Issue: The design shows `consensus run --provider <id> --schema <path> --json < prompt.txt`, but the implemented parser requires an explicit `-` stdin positional (`src/consensus/provider-cli/args.ts:279,287-296`). Running the documented form without `-` yields `Missing prompt source`. This is the same Minor artifact-drift note recorded after the p01 re-review (implementation.md Run 1 Outstanding Items) and is still open.
  - Suggestion: Artifact alignment only — update the `design.md` stdin example to `... --json -  < prompt.txt` (or note the required `-` marker). The implementation is defensible because the explicit marker disambiguates stdin prompt input from `--request-json -`. Do not change code.

- **`--request-json` conflict set is stricter than the design example** (`src/consensus/provider-cli/args.ts:343`; `.oat/projects/shared/consensus-peer-invocation/design.md:485`)
  - Issue: The implementation treats `--max-depth` as a request-shaping conflict with `--request-json`, while the design's enumerated conflict list (line 485) omits `--max-depth`. Behavior is stricter, not looser, and is consistent with the design's general rule that request-shaping flags conflict with `--request-json`.
  - Suggestion: Artifact alignment only — optionally add `--max-depth` to the design's enumerated conflict example for completeness. No code change required; the stricter behavior is safe and defensible.

## Requirements/Design Alignment

**Evidence sources used:** `spec.md`, `design.md`, `plan.md`, `implementation.md`, `discovery.md` (read); plus `research/cursor-submit-tool-spike.md` and `research/provider-cli-dogfood-parity.md` for deferral disposition. Verification run: `pnpm run build:check`, `pnpm run type-check`, `pnpm run smoke`, focused Vitest suites, live `node plugins/consensus/scripts/consensus.mjs provider ls --json`, and stale-identifier scans.

### Requirements Coverage

| Requirement | Status      | Notes |
| ----------- | ----------- | ----- |
| FR1 Owned CLI boundary | implemented | `provider ls`/`preflight`/`run` emit versioned envelopes; structured `ok:false` exits 0, usage errors exit nonzero (`commands.ts`, `envelope.ts`, `args.ts`). Verified live. |
| FR2 Provider floor & adapter capabilities | implemented | Claude/Codex/Cursor adapters with plural `schema_strategies`, argv builders, probes, option capabilities (`adapters.ts`, `invocation.ts`, `probe.ts`). |
| FR3 Structured output strategy | implemented | `selectStructuredOutputStrategy` chooses `constrained_native`/`provider_validated`/`prompt_only`; never selects `submit_tool_candidate`; local validation + retry after every strategy (`structured-output.ts`). |
| FR4 Consensus loop integration | implemented | `invokeConsensusProviderCli`/`invokeProviderCliWithRetry` seam projects `{provider,args,stdout,stderr,json}`; deliberation engine unchanged (`consensus-loop.ts`). |
| FR5 Preflight & inventory | implemented | Probes distinguish missing/ready/auth_required/unavailable/unsupported; default Node probe runner wired (`probe.ts`, `commands.ts`). Verified live: Claude/Codex ready, Cursor auth_required. |
| FR6 Backend-neutral error taxonomy | implemented | Full `ProviderErrorCode` space mapped to retry classification and exit codes; no backend-specific aliases (`adapters.ts`, `consensus-loop.ts`). |
| FR7 Audit & resume contract | implemented | `raw_provider_response`, `provider_diagnostics`, `attempts` written; resume tests pass (`consensus-loop.ts`, `resume-matrix.test.ts`). |
| FR8 Generated runtime packaging | implemented | `plugins/consensus/scripts/consensus.mjs` generated, drift guard in `build:check` (reports "in sync"), process contract tests present. |
| FR9 Host-native self-spawn guard | implemented | Depth 0->1 same-provider peer allowed (`subprocess_isolated`); depth 1->2 blocks `HOST_RECURSION_BLOCKED`; `supports_host_native_dispatch:false` across adapters (`host-guard.ts`). |
| FR10 Cursor submit-tool evaluation (P1) | implemented (deferred) | Recorded deferral; `submit_tool_candidate` reserved and never selected; first migration viable. See ledger below. |
| FR11 Future provider extension boundary (P1) | implemented | Capability flags (`future_extension_kind`, `supports_host_native_dispatch`) present; broad provider work deferred. |
| NFR1 Dependency-free shipped runtime | implemented | Provider-CLI source uses only Node stdlib (`child_process`, `fs`, `os`, `path`, `crypto`); no runtime deps introduced. |
| NFR2 Reliability & validation discipline | implemented | Timeouts, output caps, invalid JSON, schema-subset failures, exits each handled at the correct tier; output retained <= `max_output_bytes` (`subprocess.ts`). |
| NFR3 Clean source cutover | implemented | Stale-identifier scan finds no `paseo`/`PASEO_`/`install-paseo` in maintained source outside the cleanup test's own pattern literals; deleted helper/fixture/test confirmed removed; no dogfood fallback switch remains. |
| NFR4 Testability | implemented | Injected registries/probes/runners and stub executables cover the contract without live calls. |
| NFR5 Security & process safety | implemented | `spawn` with argv arrays, `shell:false`; allowlisted child env (no value leakage); redacted command diagnostics; temp last-message files cleaned up. |
| NFR6 Scope control | implemented | First scope limited to Claude/Codex/Cursor; future providers deferred. |

### Extra Work (not in declared requirements)

None material. All inspected changes map to plan tasks. The p04-t07 Vitest timeout guard (`vitest.config.mjs`) and the p04-t06 scan widening to root docs (`AGENTS.md`, `CHANGELOG.md`) are recorded in `implementation.md` Deviations and are in-scope refinements supporting NFR3 and reliable `premerge`.

## Deferred Findings Ledger Disposition

- **Cursor submit-tool deferral (accepted, not a defect):** Confirmed acceptable. `selectStructuredOutputStrategy` (`structured-output.ts:39-49`) only returns `constrained_native`/`provider_validated`/`prompt_only` and never `submit_tool_candidate`; `defaultSchemaStrategy`/`defaultStrategy` explicitly filter it out (`adapters.ts:214`, `invocation.ts:196`); the Cursor invocation builder downgrades `submit_tool_candidate` to `prompt_only` (`invocation.ts:131-133`); all adapters report `supports_submit_tool:false`. The reserved code path is NOT wired into any default execution path and causes no incorrect behavior. Cursor surfacing as `auth_required` on the dev machine is a provider-neutral diagnostic, not a runtime blocker. Deferral remains valid.
- **Carry-forward debt:** Deferred Medium = 0, Deferred Minor = 0. No prior deferred ledger items to re-evaluate. The two Minor findings above are newly framed artifact-alignment notes, not carried debt.

## Verification Commands

```bash
pnpm run build:check        # generated runtime in sync (consensus-provider-cli: in sync)
pnpm run type-check         # tsc --noEmit clean
pnpm run smoke              # mocked end-to-end consensus flow: smoke passed
pnpm exec vitest run tests/consensus/provider-cli/ tests/consensus/core/provider-cli-invocation.test.ts tests/consensus/core/provider-retry-boundary.test.ts tests/consensus/refine/provider-cli-integration.test.ts tests/consensus/evaluate/provider-cli-integration.test.ts
pnpm exec vitest run tests/consensus/refine/wrapper-options.test.ts tests/consensus/refine/error-handling.test.ts tests/consensus/evaluate/wrapper.test.ts tests/consensus/evaluate/output.test.ts tests/consensus/core/loop-records.test.ts tests/consensus/refine/resume-matrix.test.ts tests/consensus/provider-cli/source-cleanup.test.ts tests/release/smoke-test-script.test.ts
node plugins/consensus/scripts/consensus.mjs provider ls --json   # real provider probe envelope
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert findings into plan tasks. Both findings are Minor artifact-alignment notes (`design.md` only); they may be addressed when design artifacts are next edited or accepted as known drift without blocking closeout.
