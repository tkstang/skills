---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-19
oat_current_task_id: p02-t01
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
| Phase 2 | pending     | 7     | 0/7       |
| Phase 3 | pending     | 7     | 0/7       |
| Phase 4 | pending     | 7     | 0/7       |

**Total:** 6/27 tasks completed

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

**Status:** pending
**Started:** -

### Phase Summary

Pending.

### Task p02-t01: Add Adapter Registry and Capability Objects

**Status:** pending
**Commit:** -

### Task p02-t02: Implement Provider Readiness Probes

**Status:** pending
**Commit:** -

### Task p02-t03: Add Host Runtime Guard

**Status:** pending
**Commit:** -

### Task p02-t04: Validate Runtime Policy and Child Environment

**Status:** pending
**Commit:** -

### Task p02-t05: Build Provider Invocation Arguments

**Status:** pending
**Commit:** -

### Task p02-t06: Add Bounded Subprocess Runner

**Status:** pending
**Commit:** -

### Task p02-t07: Add Structured Output Coordinator and CLI Run Retries

**Status:** pending
**Commit:** -

---

## Phase 3: Refine and Evaluate Integration

**Status:** pending
**Started:** -

### Phase Summary

Pending.

### Task p03-t01: Add Consensus CLI Invoker Seam

**Status:** pending
**Commit:** -

### Task p03-t02: Write Provider-Neutral Audit and Resume Fields

**Status:** pending
**Commit:** -

### Task p03-t03: Shrink Loop Retry Responsibility

**Status:** pending
**Commit:** -

### Task p03-t04: Add Refine Wrapper Backend Switch and Preflight

**Status:** pending
**Commit:** -

### Task p03-t05: Add Evaluate Wrapper Backend Switch and Preflight

**Status:** pending
**Commit:** -

### Task p03-t06: Add Refine and Evaluate CLI Backend Integration Tests

**Status:** pending
**Commit:** -

### Task p03-t07: Extend Smoke Coverage for the CLI Backend

**Status:** pending
**Commit:** -

---

## Phase 4: Dogfood, Default Cutover, and Source Cleanup

**Status:** pending
**Started:** -

### Phase Summary

Pending.

### Task p04-t01: Update Consensus Skill Instructions and Operator Docs

**Status:** pending
**Commit:** -

### Task p04-t02: Record Cursor Submit-Tool Spike Outcome

**Status:** pending
**Commit:** -

### Task p04-t03: Record Provider CLI Dogfood Parity Evidence

**Status:** pending
**Commit:** -

### Task p04-t04: Switch Default Backend and Remove Dogfood Fallback

**Status:** pending
**Commit:** -

### Task p04-t05: Remove Old Backend Helpers, Fixtures, and Test Names

**Status:** pending
**Commit:** -

### Task p04-t06: Add Provider-Neutral Identifier Scan

**Status:** pending
**Commit:** -

### Task p04-t07: Run Final Validation and Update Release Docs

**Status:** pending
**Commit:** -

---

## Orchestration Runs

Each run from `oat-project-implement` appends an entry below.

<!-- orchestration-runs-start -->

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

**Blockers:**

- None.

---

## Deviations from Plan / Design

Document any intentional deviations from the original plan, spec, or design. Include accepted review findings where the shipped implementation is source of truth and a lifecycle artifact needs alignment.

| Task / Review | Source Artifact | Planned / Documented | Actual / Accepted | Reason | Source of Truth | Follow-up |
| ------------- | --------------- | -------------------- | ----------------- | ------ | --------------- | --------- |
| -             | -               | -                    | -                 | -      | -               | -         |

## Test Results

Track test execution during implementation.

| Phase | Tests Run | Passed | Failed | Notes |
| ----- | --------- | ------ | ------ | ----- |
| p01   | focused p01 Vitest suite; type-check; build:check; validate; smoke | yes | 0 | `pnpm exec vitest run <p01 files>` used for focused suite; `pnpm run test:vitest -- <files>` broadened to unrelated session-observer tests |
| p02   | -         | -      | -      | Pending |
| p03   | -         | -      | -      | Pending |
| p04   | -         | -      | -      | Pending |

## Final Summary (for PR/docs)

Pending implementation completion.

## References

- Plan: `plan.md`
- Design: `design.md`
- Spec: `spec.md`
- Discovery: `discovery.md`
