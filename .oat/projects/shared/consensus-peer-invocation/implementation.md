---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-19
oat_current_task_id: null
oat_generated: false
---

# Implementation: consensus-peer-invocation

**Started:** 2026-06-19
**Last Updated:** 2026-06-19

> This document is used to resume interrupted implementation sessions.
>
> `oat_current_task_id` points at the next plan task to do. Reviews are tracked in `plan.md` under `## Reviews`.

## Progress Overview

| Phase   | Status      | Tasks | Completed |
| ------- | ----------- | ----- | --------- |
| Phase 1 | passed      | 6     | 6/6       |
| Phase 2 | passed      | 7     | 7/7       |
| Phase 3 | passed      | 7     | 7/7       |
| Phase 4 | passed      | 7     | 7/7       |

**Total:** 27/27 tasks completed

---

## Phase 1: CLI Contract and Generated Entrypoint

**Status:** passed
**Started:** 2026-06-19

### Phase Summary

**Outcome:**

- Added provider-neutral model, request, envelope, capability, and error taxonomy types for the owned consensus provider CLI.
- Added argument parsing and request normalization for provider inventory, preflight, and one-shot run commands, including stdin/file prompt sources, request JSON, runtime policy flags, output/runtime caps, and host depth.
- Added generated dependency-free CLI entrypoint wiring under `plugins/consensus/scripts/consensus.mjs` and drift guard mapping through `scripts/build-generated.mjs`.
- Added provider list/preflight skeleton handlers and generated process contract tests.

**Key files touched:**

- `src/consensus/provider-cli/types.ts` - provider CLI data model and constants.
- `src/consensus/provider-cli/args.ts` - command parsing and request normalization.
- `src/consensus/provider-cli/envelope.ts` - success/failure envelopes and exit-code helpers.
- `src/consensus/provider-cli/commands.ts` - provider list/preflight skeleton command handlers.
- `src/consensus/provider-cli/cli.ts` - generated CLI entrypoint.
- `plugins/consensus/scripts/consensus.mjs` - generated runtime output.
- `tests/consensus/provider-cli/` - p01 unit and process coverage.
- `scripts/build-generated.mjs`, `tests/tooling/generated-output-sync.test.ts` - generated output mapping and drift guard.

**Verification:**

- Run: `pnpm exec vitest run tests/consensus/provider-cli/types.test.ts tests/consensus/provider-cli/args.test.ts tests/consensus/provider-cli/envelope.test.ts tests/consensus/provider-cli/commands.test.ts tests/consensus/provider-cli/cli-process.test.ts tests/tooling/generated-output-sync.test.ts`
- Result: passed during p01 implementation, fix, and re-review.
- Run: `pnpm run type-check`
- Result: passed.
- Run: `pnpm run build:check`
- Result: passed.
- Run: `npm run validate`
- Result: passed during p01 review.
- Run: `npm run smoke`
- Result: passed during p01 review.

**Notes / Decisions:**

- The `pnpm run test:vitest -- <files>` separator form broadened to unrelated repo tests in this environment and hit unrelated `session-observer` timeouts. Focused p01 verification used `pnpm exec vitest run <files>`.
- p01 re-review left one Minor artifact-alignment note: `design.md`'s stdin prompt example omits the implemented `-` stdin marker. This is non-blocking because the implementation matches the p01 plan and generated CLI help.

### Task p01-t01: Add Provider CLI Model Types

**Status:** completed
**Commit:** d82c3b2

### Task p01-t02: Parse CLI Arguments and Prompt Sources

**Status:** completed
**Commit:** 4e38dc2

### Task p01-t03: Add Envelope and Exit-Code Helpers

**Status:** completed
**Commit:** 7e1cd34

### Task p01-t04: Wire Generated CLI Entrypoint

**Status:** completed
**Commit:** a0d8145

### Task p01-t05: Implement Provider List and Preflight Skeleton

**Status:** completed
**Commit:** d24b022

### Task p01-t06: Add CLI Process Contract Tests

**Status:** completed
**Commit:** 77c29ab

### Review Fix: Accept Runtime Policy Run Flags

**Status:** completed
**Commit:** 90f19d4

**Outcome:**

- Fixed the p01 Important review finding by accepting and normalizing `--permission-mode`, `--sandbox`, `--approval-policy`, `--env-allow`, and `--max-depth` for `consensus run`.

---

## Phase 2: Provider Adapter Floor and Execution Reliability

**Status:** passed
**Started:** 2026-06-19

### Phase Summary

**Outcome:**

- Added Claude, Codex, and Cursor adapter capability objects, including schema strategies, provider option support, submit-tool reservation, and future-provider extension fields.
- Added readiness probes and provider inventory/preflight behavior for injected runners.
- Added host recursion guard helpers and same-provider depth propagation for `run`.
- Added runtime policy validation, provider-specific child environment allowlisting, invocation argv builders, bounded subprocess execution, adapter-owned failure classification, and structured-output retry coordination.
- Fixed review findings for same-host run detection, effective non-interactive runtime policy, provider-specific env scoping, terminal exit classification, timeout escalation, and retained output caps.

**Key files touched:**

- `src/consensus/provider-cli/adapters.ts` - provider capabilities, argv metadata, and run-failure classifiers.
- `src/consensus/provider-cli/probe.ts` - provider executable/readiness probing.
- `src/consensus/provider-cli/host-guard.ts` - host runtime and depth guard.
- `src/consensus/provider-cli/runtime-policy.ts` - provider option validation and child env construction.
- `src/consensus/provider-cli/invocation.ts` - provider invocation argument builders.
- `src/consensus/provider-cli/subprocess.ts` - bounded subprocess runner.
- `src/consensus/provider-cli/structured-output.ts` - CLI-owned structured output attempts/retries.
- `plugins/consensus/scripts/consensus.mjs` - generated runtime output.
- `tests/consensus/provider-cli/` - p02 unit/process coverage.
- `tests/fixtures/bin/consensus-provider-stub` - provider subprocess fixture behavior.

**Verification:**

- Run: `pnpm exec vitest run tests/consensus/provider-cli/*.test.ts`
- Result: passed during p02 implementation.
- Run: `pnpm exec vitest run tests/consensus/provider-cli/adapters.test.ts tests/consensus/provider-cli/probe.test.ts tests/consensus/provider-cli/host-guard.test.ts tests/consensus/provider-cli/runtime-policy.test.ts tests/consensus/provider-cli/invocation.test.ts tests/consensus/provider-cli/subprocess.test.ts tests/consensus/provider-cli/structured-output.test.ts tests/consensus/provider-cli/cli-process.test.ts tests/tooling/generated-output-sync.test.ts`
- Result: passed during p02 reviews/fixes.
- Run: `pnpm run type-check`
- Result: passed.
- Run: `pnpm run build:check`
- Result: passed.

**Notes / Decisions:**

- p02-t07 updated `tests/consensus/provider-cli/cli-process.test.ts` even though the task file list omitted it. This is accepted because the p02-t07 verification command included that file and the p01 placeholder process assertions became stale once `run` was implemented.
- p02-t06 did not modify `tests/helpers/process.mjs`; existing helper exports were sufficient for the fixture-based subprocess tests.
- The original p02 fix loop exhausted on generated provider probe wiring. A user-approved new fix/review cycle resolved the blocker in commit `6fffefe`, and p02 passed re-review with no findings.

### Task p02-t01: Add Adapter Registry and Capability Objects

**Status:** completed
**Commit:** 07bede1

### Task p02-t02: Implement Provider Readiness Probes

**Status:** completed
**Commit:** 59947d8

### Task p02-t03: Add Host Runtime Guard

**Status:** completed
**Commit:** f15fb6a

### Task p02-t04: Validate Runtime Policy and Child Environment

**Status:** completed
**Commit:** 377709a

### Task p02-t05: Build Provider Invocation Arguments

**Status:** completed
**Commit:** 728a8d2

### Task p02-t06: Add Bounded Subprocess Runner

**Status:** completed
**Commit:** bea63ab

### Task p02-t07: Add Structured Output Coordinator and CLI Run Retries

**Status:** completed
**Commit:** 0816295

### Review Fix: Enforce Provider Execution Safety

**Status:** completed
**Commit:** 1d656b8

**Outcome:**

- Fixed same-host run-path guard, effective runtime policy enforcement, provider-specific child environment scoping, adapter-owned nonzero exit classification, and timeout SIGKILL escalation.

### Review Fix: Bound Retained Provider Output

**Status:** completed
**Commit:** 280cd76

**Outcome:**

- Fixed retained stdout/stderr capture so output-cap failures do not retain provider output beyond `max_output_bytes`.

### Review Fix: Wire Default Provider Probes

**Status:** completed
**Commit:** 6fffefe

**Outcome:**

- Fixed the generated `provider ls` / `preflight` default command path so it wires `nodeProbeCommandRunner(io.env)` when no test registry/probe runner is injected.
- p02 new-cycle re-review verified generated provider inventory reports local Claude/Codex ready and Cursor auth-required, and Codex preflight is usable.

---

## Phase 3: Refine and Evaluate Integration

**Status:** passed
**Started:** 2026-06-19

### Phase Summary

**Outcome:**

- Added the consensus-loop provider CLI invocation seam, including default generated CLI resolution and structured provider envelope handling.
- Wrote provider-neutral audit/resume fields for CLI-backed records, including `raw_provider_response`, provider diagnostics, and attempt summaries.
- Kept provider-tier retry exhaustion inside the provider CLI path while preserving loop-owned verdict shape/cap retries.
- Added Refine and Evaluate provider CLI backend switches, selected-provider preflight, integration coverage, and smoke coverage.
- Fixed p03 re-review findings by routing default generated `.mjs` execution through Node, carrying provider backend selection through prepared parallel section runners, and preflighting explicit synthesized-mode synthesizers outside the peer pair.

**Key files touched:**

- `src/consensus/core/consensus-loop.ts` - provider CLI invocation seam, backend selection, provider-neutral audit writes, and retry-boundary integration.
- `src/consensus/refine/consensus-refine.ts` - Refine provider CLI backend switch, preflight, prepared parallel backend propagation, and synthesizer preflight union.
- `src/consensus/evaluate/consensus-evaluate.ts` - Evaluate provider CLI backend switch and preflight.
- `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`, `plugins/consensus/skills/evaluate/scripts/consensus-loop.mjs`, `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`, `plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs` - generated runtime outputs.
- `tests/consensus/core/`, `tests/consensus/refine/`, `tests/consensus/evaluate/`, `tests/release/smoke-test-script.test.ts` - p03 integration, retry-boundary, wrapper, record, and smoke coverage.

**Verification:**

- Run: `pnpm exec vitest run tests/consensus/core/provider-cli-invocation.test.ts tests/consensus/core/provider-retry-boundary.test.ts tests/consensus/core/loop-records.test.ts tests/consensus/refine/provider-cli-integration.test.ts tests/consensus/evaluate/provider-cli-integration.test.ts tests/consensus/refine/wrapper-options.test.ts tests/consensus/refine/error-handling.test.ts tests/consensus/evaluate/wrapper.test.ts tests/consensus/evaluate/output.test.ts tests/release/smoke-test-script.test.ts`
- Result: passed during p03 implementation, fix, and re-review.
- Run: `pnpm run type-check`
- Result: passed.
- Run: `pnpm run build:check`
- Result: passed.
- Run: `pnpm run smoke`
- Result: passed.

**Notes / Decisions:**

- The initial p03 review found two Critical issues and one Important issue; fix commit `43c4288` resolved them and p03 passed re-review with no findings.
- Prepared parallel provider CLI runs now propagate backend selection through `loop_argv` so section runners do not fall back to the old backend.

### Task p03-t01: Add Consensus CLI Invoker Seam

**Status:** completed
**Commit:** 41f61a9

### Task p03-t02: Write Provider-Neutral Audit and Resume Fields

**Status:** completed
**Commit:** 6903f3b

### Task p03-t03: Shrink Loop Retry Responsibility

**Status:** completed
**Commit:** aade99b

### Task p03-t04: Add Refine Wrapper Backend Switch and Preflight

**Status:** completed
**Commit:** de84167

### Task p03-t05: Add Evaluate Wrapper Backend Switch and Preflight

**Status:** completed
**Commit:** a16867c

### Task p03-t06: Add Refine and Evaluate CLI Backend Integration Tests

**Status:** completed
**Commit:** ab01679

### Task p03-t07: Extend Smoke Coverage for the CLI Backend

**Status:** completed
**Commit:** ed22381

### Review Fix: Propagate Provider Backend for Prepared Runs

**Status:** completed
**Commit:** 43c4288

**Changes:**

- Routed default generated provider CLI `.mjs` execution through `process.execPath` while preserving direct execution for explicit CLI overrides.
- Propagated provider backend selection through prepared parallel Refine section packets and loop argument parsing.
- Added Refine provider CLI preflight coverage for an explicit synthesized-mode synthesizer outside the peer pair.

---

## Phase 4: Dogfood, Default Cutover, and Source Cleanup

**Status:** passed
**Started:** 2026-06-19

### Phase Summary

**Outcome:**

- Updated consensus skill instructions, operator QA references, README, release notes, and root maintained docs to describe the provider CLI backend and provider-neutral diagnostics.
- Recorded Cursor submit-tool as deferred and unselected by default, with Cursor currently surfaced as `auth_required` on this machine.
- Recorded provider CLI dogfood parity evidence and accepted the source-level cutover for new runs.
- Switched Refine, Evaluate, and smoke flows to the provider CLI backend as the default runtime path and removed temporary backend fallback switches.
- Removed old backend helper scripts, fixtures, install tests, and old test names.
- Added a provider-neutral source cleanup scan that covers maintained source/runtime/tests/scripts/docs plus root instruction docs, excluding historical `.oat` artifacts and the scan's own pattern list.
- Updated release verification docs and added a Vitest timeout guard so `pnpm run premerge` passes reliably.

**Key files touched:**

- `src/consensus/core/consensus-loop.ts`, `src/consensus/refine/consensus-refine.ts`, `src/consensus/evaluate/consensus-evaluate.ts` - provider CLI default cutover and fallback removal.
- `plugins/consensus/skills/refine/`, `plugins/consensus/skills/evaluate/`, and generated plugin scripts - updated shipped runtime and operator-facing instructions.
- `README.md`, `RELEASING.md`, `AGENTS.md`, `CHANGELOG.md`, `plugins/consensus/README.md` - maintained docs cleanup and provider CLI wording.
- `.oat/projects/shared/consensus-peer-invocation/research/cursor-submit-tool-spike.md` - Cursor submit-tool deferral.
- `.oat/projects/shared/consensus-peer-invocation/research/provider-cli-dogfood-parity.md` - dogfood parity and cutover evidence.
- `tests/consensus/provider-cli/source-cleanup.test.ts` - static cleanup scan.
- `tests/consensus/refine/provider-subprocess.test.ts` - renamed provider subprocess coverage.
- `vitest.config.mjs`, `tests/tooling/vitest-config.test.ts` - explicit full-suite timeout budget.

**Verification:**

- Run: `pnpm exec vitest run tests/consensus/provider-cli/source-cleanup.test.ts`
- Result: passed during p04 implementation, fix, and re-review.
- Run: `pnpm run build:check`
- Result: passed.
- Run: `pnpm run premerge`
- Result: passed during p04 implementation and fix; p04 re-review saw one unrelated `session-observer` timeout on first attempt, then the isolated test and full `premerge` rerun passed.
- Run: targeted stale-backend scans excluding `.git` and `.oat`
- Result: only the cleanup scan's own retired-identifier pattern literals remain outside `.oat`.

**Notes / Decisions:**

- Cursor submit-tool remains deferred; `submit_tool_candidate` stays reserved and unselected by default.
- Cutover is acceptable for new consensus runs based on automated parity, generated-output sync, smoke, provider inventory/preflight, and local Claude/Codex readiness.
- Cursor currently reports `auth_required` because the local macOS keychain is locked; this is a provider-neutral diagnostic, not a runtime fallback blocker.

### Task p04-t01: Update Consensus Skill Instructions and Operator Docs

**Status:** completed
**Commit:** 13eeded

### Task p04-t02: Record Cursor Submit-Tool Spike Outcome

**Status:** completed
**Commit:** 50f32be, 916a02b

### Task p04-t03: Record Provider CLI Dogfood Parity Evidence

**Status:** completed
**Commit:** 5e89475

### Task p04-t04: Switch Default Backend and Remove Dogfood Fallback

**Status:** completed
**Commit:** f72d88c

### Task p04-t05: Remove Old Backend Helpers, Fixtures, and Test Names

**Status:** completed
**Commit:** 5c640b1

### Task p04-t06: Add Provider-Neutral Identifier Scan

**Status:** completed
**Commit:** 921a43b

### Task p04-t07: Run Final Validation and Update Release Docs

**Status:** completed
**Commit:** 13fb9f1

### Review Fix: Extend Provider Cleanup Scan

**Status:** completed
**Commit:** 7fe2b58

**Changes:**

- Added maintained root docs/instructions including `AGENTS.md` and `CHANGELOG.md` to the cleanup scan.
- Replaced stale maintained-doc old-backend references with provider CLI wording.
- Confirmed only the cleanup scan's self-excluded pattern list retains retired identifiers outside `.oat`.

---

## Orchestration Runs

Each run from `oat-project-implement` appends an entry below.

<!-- orchestration-runs-start -->

### Run 5 — 2026-06-19 22:25

**Branch:** consensus-cli
**Tier:** 1
**Policy:** merge-strategy=sequential, retry-limit=2
**Phases:** 1 executed, 1 passed, 0 failed, 0 stopped

#### Phase Outcomes

| Phase | Implementer | Review | Fix Iterations | Disposition |
| ----- | ----------- | ------ | -------------- | ----------- |
| p04   | DONE | pass | 1/2 | passed |

#### Parallel Groups

- p04: sequential

#### Dispatch Notes

- Dispatch: p04 implementation used Codex `oat-phase-implementer-xhigh` with `effort_axis=selected:xhigh`.
- Dispatch: p04 review and re-review used Codex `oat-reviewer-xhigh` with `effort_axis=selected:xhigh`.
- Dispatch: p04 fix used Codex `oat-phase-implementer-xhigh` with `effort_axis=selected:xhigh`.

#### Outstanding Items

- None.

#### Artifact / Design Deltas

Run-scoped snapshot only. The durable record is `## Deviations from Plan / Design`; consolidate any non-`None` entries there at the next phase boundary.

| Task / Review | Source Artifact | Planned / Documented | Actual / Accepted | Reason | Source of Truth | Follow-up |
| ------------- | --------------- | -------------------- | ----------------- | ------ | --------------- | --------- |
| p04-t06 | plan.md file list | Cleanup scan initially listed `src/`, `plugins/consensus/`, `tests/`, `scripts/`, and selected docs | Scan also covers maintained root docs/instructions including `AGENTS.md` and `CHANGELOG.md` | p04 review found stale maintained-doc references outside the original scan scope | implementation | None |
| p04-t07 | plan.md verification | Final validation via `pnpm run premerge` | Added explicit Vitest timeout budget and guard so the exact premerge command passes reliably | Full-suite subprocess tests exceeded the default 5000 ms timeout under concurrency while focused tests passed | implementation | None |

### Run 4 — 2026-06-19 21:17

**Branch:** consensus-cli
**Tier:** 1
**Policy:** merge-strategy=sequential, retry-limit=2
**Phases:** 1 executed, 1 passed, 0 failed, 0 stopped

#### Phase Outcomes

| Phase | Implementer | Review | Fix Iterations | Disposition |
| ----- | ----------- | ------ | -------------- | ----------- |
| p03   | DONE | pass | 1/2 | passed |

#### Parallel Groups

- p03: sequential

#### Dispatch Notes

- Dispatch: p03 implementation used Codex `oat-phase-implementer-xhigh` with `effort_axis=selected:xhigh`.
- Dispatch: p03 review and re-review used Codex `oat-reviewer-xhigh` with `effort_axis=selected:xhigh`.
- Dispatch: p03 fix used Codex `oat-phase-implementer-xhigh` with `effort_axis=selected:xhigh`.

#### Outstanding Items

- None.

#### Artifact / Design Deltas

Run-scoped snapshot only. The durable record is `## Deviations from Plan / Design`; consolidate any non-`None` entries there at the next phase boundary.

| Task / Review | Source Artifact | Planned / Documented | Actual / Accepted | Reason | Source of Truth | Follow-up |
| ------------- | --------------- | -------------------- | ----------------- | ------ | --------------- | --------- |
| None | - | - | - | - | - | - |

### Run 3 — 2026-06-19 20:18

**Branch:** consensus-cli
**Tier:** 1
**Policy:** merge-strategy=sequential, retry-limit=new user-approved fix cycle
**Phases:** 1 executed, 1 passed, 0 failed, 0 stopped

#### Phase Outcomes

| Phase | Implementer | Review | Fix Iterations | Disposition |
| ----- | ----------- | ------ | -------------- | ----------- |
| p02   | DONE | pass | 1/new-cycle | passed |

#### Parallel Groups

- p02 new fix/review cycle: sequential

#### Dispatch Notes

- Dispatch: p02 new-cycle fix used Codex `oat-phase-implementer-high` with `effort_axis=selected:high`.
- Dispatch: p02 new-cycle review used Codex `oat-reviewer-xhigh` with `effort_axis=selected:xhigh`.

#### Outstanding Items

- None.

#### Artifact / Design Deltas

Run-scoped snapshot only. The durable record is `## Deviations from Plan / Design`; consolidate any non-`None` entries there at the next phase boundary.

| Task / Review | Source Artifact | Planned / Documented | Actual / Accepted | Reason | Source of Truth | Follow-up |
| ------------- | --------------- | -------------------- | ----------------- | ------ | --------------- | --------- |
| None | - | - | - | - | - | - |

### Run 2 — 2026-06-19 19:58

**Branch:** consensus-cli
**Tier:** 1
**Policy:** merge-strategy=sequential, retry-limit=2
**Phases:** 1 executed, 0 passed, 1 failed, 1 stopped

#### Phase Outcomes

| Phase | Implementer | Review | Fix Iterations | Disposition |
| ----- | ----------- | ------ | -------------- | ----------- |
| p02   | DONE_WITH_CONCERNS | fail | 2/2 | stopped |

#### Parallel Groups

- p02: sequential

#### Dispatch Notes

- Dispatch: p02 implementation used Codex `oat-phase-implementer-xhigh` with `effort_axis=selected:xhigh`.
- Dispatch: p02 reviews used Codex `oat-reviewer-xhigh` with `effort_axis=selected:xhigh`.
- Dispatch: p02 fixes used Codex `oat-phase-implementer-xhigh` with `effort_axis=selected:xhigh`.

#### Outstanding Items

- Critical blocker: generated `provider ls` / `preflight` never wire the implemented default Node probe runner, so the actual CLI reports installed providers as `missing`. Review artifact: `.oat/projects/shared/consensus-peer-invocation/reviews/p02-review-2026-06-19-v3.md`.

#### Artifact / Design Deltas

Run-scoped snapshot only. The durable record is `## Deviations from Plan / Design`; consolidate any non-`None` entries there at the next phase boundary.

| Task / Review | Source Artifact | Planned / Documented | Actual / Accepted | Reason | Source of Truth | Follow-up |
| ------------- | --------------- | -------------------- | ----------------- | ------ | --------------- | --------- |
| p02-t07 | plan.md file list | p02-t07 did not list `tests/consensus/provider-cli/cli-process.test.ts` | p02-t07 updated the process contract test | The p02-t07 verification command included this file, and p01 placeholder assertions became stale when `run` was implemented | implementation | None |

### Run 1 — 2026-06-19 18:59

**Branch:** consensus-cli
**Tier:** 1
**Policy:** merge-strategy=sequential, retry-limit=2
**Phases:** 1 executed, 1 passed, 0 failed, 0 stopped

#### Phase Outcomes

| Phase | Implementer | Review | Fix Iterations | Disposition |
| ----- | ----------- | ------ | -------------- | ----------- |
| p01   | DONE_WITH_CONCERNS | pass | 1/2 | passed |

#### Parallel Groups

- p01: sequential

#### Dispatch Notes

- Dispatch: p01 implementation used Codex `oat-phase-implementer-high` with `effort_axis=selected:high`, capped under project-state ceiling `xhigh`.
- Dispatch: p01 review and re-review used Codex `oat-reviewer-xhigh` with `effort_axis=selected:xhigh`.
- Dispatch: p01 fix used Codex `oat-phase-implementer-high` with `effort_axis=selected:high`.

#### Outstanding Items

- Minor non-blocking artifact note from p01 re-review: align the design stdin prompt example with the implemented `-` stdin marker when design artifacts are next edited.

#### Artifact / Design Deltas

Run-scoped snapshot only. The durable record is `## Deviations from Plan / Design`; consolidate any non-`None` entries there at the next phase boundary.

| Task / Review | Source Artifact | Planned / Documented | Actual / Accepted | Reason | Source of Truth | Follow-up |
| ------------- | --------------- | -------------------- | ----------------- | ------ | --------------- | --------- |
| None | - | - | - | - | - | - |

<!-- orchestration-runs-end -->

---

## Implementation Log

Chronological log of implementation progress.

### 2026-06-19

**Session Start:** Implementation preflight initialized with Tier 1 subagents, Codex xhigh dispatch ceiling, final-phase HiLL checkpoint, and auto-review at HiLL checkpoints enabled.

**What changed:**

- Implementation tracking initialized from the completed 27-task plan.
- p01 completed and passed re-review after fix commit `90f19d4`.
- p02 completed and passed new-cycle re-review after fix commit `6fffefe`.
- p03 completed and passed re-review after fix commit `43c4288`.
- p04 completed and passed re-review after fix commit `7fe2b58`.

**Blockers:**

- None.

---

## Deviations from Plan / Design

Document any intentional deviations from the original plan, spec, or design. Include accepted review findings where the shipped implementation is source of truth and a lifecycle artifact needs alignment.

| Task / Review | Source Artifact | Planned / Documented | Actual / Accepted | Reason | Source of Truth | Follow-up |
| ------------- | --------------- | -------------------- | ----------------- | ------ | --------------- | --------- |
| -             | -               | -                    | -                 | -      | -               | -         |
| p02-t07 | plan.md file list | p02-t07 omitted `tests/consensus/provider-cli/cli-process.test.ts` | implementation updated that test | Required to keep the generated CLI process contract current once `run` became implemented | implementation | None |
| p04-t06 | plan.md file list | Cleanup scan initially listed `src/`, `plugins/consensus/`, `tests/`, `scripts/`, and selected docs | implementation expanded the scan to maintained root docs/instructions including `AGENTS.md` and `CHANGELOG.md` | Required to satisfy the clean source/docs cutover requirement after review found stale maintained-doc references | implementation | None |
| p04-t07 | plan.md verification | Final validation expected `pnpm run premerge` to pass | implementation added a guarded 10s Vitest test timeout so exact `premerge` passes reliably | Full-suite subprocess tests were intermittently exceeding Vitest's default 5000 ms timeout; focused reruns passed | implementation | None |

## Test Results

Track test execution during implementation.

| Phase | Tests Run | Passed | Failed | Notes |
| ----- | --------- | ------ | ------ | ----- |
| p01   | focused p01 Vitest suite; type-check; build:check; validate; smoke | yes | 0 | `pnpm exec vitest run <p01 files>` used for focused suite; `pnpm run test:vitest -- <files>` broadened to unrelated session-observer tests |
| p02   | focused provider-cli Vitest suite; type-check; build:check; generated provider/preflight smoke | yes | 0 | p02 passed new-cycle re-review after generated provider probe wiring fix |
| p03   | focused provider-cli/refine/evaluate Vitest suite; type-check; build:check; smoke | yes | 0 | p03 passed re-review after provider backend propagation fix |
| p04   | source cleanup scan; build:check; premerge; targeted stale-backend scans | yes | 0 | p04 passed re-review after cleanup scan widened to root maintained docs |

## Final Summary (for PR/docs)

Implementation replaced the old external peer-invocation backend with an owned provider-neutral `consensus` CLI path for Refine and Evaluate. The shipped runtime now defaults to provider CLI invocation for new runs, records provider-neutral audit fields, owns provider-tier validation/retry/cap/timeout boundaries, preflights selected providers, and keeps Cursor submit-tool support reserved and deferred.

Key implementation areas:

- Provider CLI contract, argument parsing, envelopes, generated entrypoint, inventory/preflight, adapter registry, readiness probes, host recursion guard, runtime policy validation, subprocess runner, and structured-output retry coordinator.
- Refine and Evaluate wrapper integration, provider-neutral loop records, retry-boundary separation, prepared parallel backend propagation, smoke coverage, and default runtime cutover.
- Source cleanup: removed old helper scripts/fixtures/tests/names, updated maintained docs, added static cleanup coverage, and left historical `.oat` artifacts/research untouched by design.
- Research artifacts: Cursor submit-tool spike deferred; provider CLI dogfood parity accepted for source-level cutover with Claude/Codex ready locally and Cursor surfaced as `auth_required`.

Verification performed:

- Focused provider CLI, Refine, Evaluate, smoke, cleanup, and wrapper Vitest suites across phases.
- `pnpm run type-check`, `pnpm run build:check`, `pnpm run validate`, `pnpm run smoke`, and `pnpm run premerge`.
- Provider inventory/preflight checks for Claude, Codex, and Cursor.
- Targeted stale-backend scans excluding `.git` and historical `.oat` artifacts.

Design deltas are limited to accepted implementation-scope refinements recorded in `## Deviations from Plan / Design`.

## References

- Plan: `plan.md`
- Design: `design.md`
- Spec: `spec.md`
- Discovery: `discovery.md`
