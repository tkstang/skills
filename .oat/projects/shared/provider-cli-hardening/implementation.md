---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-21
oat_current_task_id: p02-t01
oat_generated: false
---

# Implementation: provider-cli-hardening

**Started:** 2026-06-20
**Last Updated:** 2026-06-21

> This document is used to resume interrupted implementation sessions.
>
> Conventions:
>
> - `oat_current_task_id` always points at the **next plan task to do** (not the last completed task).
> - When all plan tasks are complete, set `oat_current_task_id: null`.
> - Reviews are **not** plan tasks. Track review status in `plan.md` under `## Reviews` (e.g., `| final | code | passed | ... |`).
> - Keep phase/task statuses consistent with the Progress Overview table so restarts resume correctly.
> - Before running the `oat-project-pr-final` skill, ensure `## Final Summary (for PR/docs)` is filled with what was actually implemented.

## Progress Overview

| Phase   | Status      | Tasks | Completed |
| ------- | ----------- | ----- | --------- |
| p01     | complete    | 7     | 7/7       |
| p02     | in_progress | 10    | 0/10      |
| p03     | pending     | 5     | 0/5       |

**Total:** 7/22 tasks completed

---

## Phase p01: bl-3291 — retry-classification hardening

**Status:** complete
**Started:** 2026-06-20

### Phase Summary

**Outcome (what changed):**

- Unknown provider exits are locked as terminal by default and do not retry.
- Transient provider exits retry without contaminating the next prompt with schema-validation feedback.
- Provider diagnostics now include a redacted `exit_classification` basis.
- Reliable external interrupts classify as retryable, while CLI timeout/output-cap terminations remain terminal.
- Adapter tests now cover common, provider-specific, terminal, and unknown classifier behavior.

**Key files touched:**

- `src/consensus/provider-cli/adapters.ts` - retry-classification basis and evidence-backed signatures.
- `src/consensus/provider-cli/structured-output.ts` - retry loop feedback separation and diagnostics propagation.
- `src/consensus/provider-cli/subprocess.ts` - external-interrupt signal metadata.
- `src/consensus/provider-cli/types.ts` - additive diagnostic field.
- `tests/consensus/provider-cli/*.test.ts` - contract, retry, interruption, and matrix coverage.
- `plugins/consensus/scripts/consensus.mjs` - generated runtime output from `pnpm run build`.

**Verification:**

- Run: `pnpm run build:check && pnpm run type-check && pnpm exec vitest run tests/consensus/provider-cli`
- Result: pass.
- Review gate: `p01` code review passed with 0 Critical / 0 Important / 0 Minor findings.

**Notes / Decisions:**

- No plan/design/spec deviations recorded.
- p01-t05 added only the documented Claude Code repeated-529 overload signature; Codex/Cursor keep common patterns with explicit no-evidence comments.

### Task p01-t01: Lock the confirmed terminal-default contract

**Status:** completed
**Commit:** 5eef0b0

**Outcome (required when completed):**

- Tests lock terminal-default behavior for unknown provider exits at both classifier and turn-loop levels.

**Files changed:**

- `tests/consensus/provider-cli/adapters.test.ts` - classifier fall-through contract.
- `tests/consensus/provider-cli/structured-output.test.ts` - no retry for unknown provider exit.

**Verification:**

- Run: `pnpm exec vitest run tests/consensus/provider-cli/adapters.test.ts tests/consensus/provider-cli/structured-output.test.ts`
- Result: pass.

**Notes / Decisions:**

- Source behavior already matched the confirmed contract; task added lock tests only.

**Issues Encountered:**

- None yet.

---

### Task p01-t02: Decouple transient-exit retry from validation feedback

**Status:** completed
**Commit:** d36596c

**Notes:**

- Transient provider exits now retry without adding schema-validation feedback to the next prompt; schema-validation retries still add feedback.

---

### Task p01-t03: Record classification basis via redacted diagnostic

**Status:** completed
**Commit:** f89fdd8

**Notes:**

- `diagnostics.exit_classification` records enum-only classifier basis without copying provider stderr into the diagnostic.

---

### Task p01-t04: Classify reliable interruption signals as transient

**Status:** completed
**Commit:** 67af933

**Notes:**

- Plain external signal exits can retry as interrupted; timeout/output-cap and ambiguous signal cases remain terminal.

---

### Task p01-t05: Evidence-backed per-adapter transient signatures

**Status:** completed
**Commit:** d441f09

**Notes:**

- Added the Claude Code repeated-529 overload signature with evidence; no guessed provider-specific Codex/Cursor signatures were added.

---

### Task p01-t06: Per-adapter contract matrix tests

**Status:** completed
**Commit:** 2b12e0c

**Notes:**

- Matrix tests cover transient, terminal, and unknown classification behavior for Claude, Codex, and Cursor adapters.

---

### Task p01-t07: Regenerate runtime + Phase 1 gates

**Status:** completed
**Commit:** 8d7d277

**Notes:**

- Generated runtime output is in sync after `pnpm run build`; Phase 1 gates passed.

---

## Phase p02: bl-3a88 — verdict-submission mechanism

**Status:** in_progress
**Started:** 2026-06-21

### Task p02-t01: Extract shared schema-subset validator

**Status:** pending
**Commit:** -

---

## Orchestration Runs

_Each run from `oat-project-implement` appends an entry below with:_
_- Run header (number, timestamp, branch, tier, policy, phase counts)_
_- Phase Outcomes table_
_- Parallel Groups list_
_- Outstanding Items_

<!-- orchestration-runs-start -->

_Orchestration runs from `oat-project-implement` are appended here, most-recent-first within the file but append-only at the bottom of the log._

### Run 1 — 2026-06-21 03:03 UTC

**Branch:** provider-cli-hardening
**Tier:** 1
**Policy:** merge-strategy=sequential, retry-limit=2
**Phases:** 1 executed, 1 passed, 0 failed, 0 stopped

#### Phase Outcomes

| Phase | Implementer | Review | Fix Iterations | Disposition |
| ----- | ----------- | ------ | -------------- | ----------- |
| p01   | DONE        | pass   | 0/2            | passed      |

#### Parallel Groups

- p01: sequential; no parallel worktree group configured.

#### Dispatch Notes

- Dispatch: p01 implementation used `effort_axis=selected:xhigh`, `model_axis=inherited`; dispatch ceiling `xhigh` from project state.
- Dispatch: p01 review used `effort_axis=selected:xhigh`, `model_axis=inherited`; reviewer ran at configured ceiling.

#### Outstanding Items

- None.

#### Artifact / Design Deltas

| Task / Review | Source Artifact | Planned / Documented | Actual / Accepted | Reason | Source of Truth | Follow-up |
| ------------- | --------------- | -------------------- | ----------------- | ------ | --------------- | --------- |
| None          | -               | -                    | -                 | -      | -               | -         |

<!-- orchestration-runs-end -->

---

## Implementation Log

Chronological log of implementation progress.

### 2026-06-21

**Session Start:** 02:45 UTC

- [x] p01-t01: Lock the confirmed terminal-default contract - 5eef0b0
- [x] p01-t02: Decouple transient-exit retry from validation feedback - d36596c
- [x] p01-t03: Record classification basis via redacted diagnostic - f89fdd8
- [x] p01-t04: Classify reliable interruption signals as transient - 67af933
- [x] p01-t05: Evidence-backed per-adapter transient signatures - d441f09
- [x] p01-t06: Per-adapter contract matrix tests - 2b12e0c
- [x] p01-t07: Regenerate runtime + Phase 1 gates - 8d7d277
- [ ] p02-t01: Extract shared schema-subset validator - next

**What changed (high level):**

- Provider-exit retry classification is now locked, redacted, and covered by adapter matrix tests.
- Generated runtime output is in sync after Phase 1.

**Decisions:**

- Added only evidence-backed provider-specific transient signatures; no guessed Codex/Cursor-specific patterns.

**Follow-ups / TODO:**

- Continue with Phase 2 submit-CLI build.

**Blockers:**

- None.

**Session End:** 03:03 UTC

---

### 2026-06-20

**Session Start:** {time}

{Continue log...}

---

## Deviations from Plan / Design

Document any intentional deviations from the original plan, spec, or design. Include accepted review findings where the shipped implementation is source of truth and a lifecycle artifact needs alignment.

| Task / Review | Source Artifact | Planned / Documented | Actual / Accepted | Reason | Source of Truth | Follow-up |
| ------------- | --------------- | -------------------- | ----------------- | ------ | --------------- | --------- |
| -             | -               | -                    | -                 | -      | -               | -         |

## Test Results

Track test execution during implementation.

| Phase | Tests Run | Passed | Failed | Coverage |
| ----- | --------- | ------ | ------ | -------- |
| p01   | `pnpm run build:check`; `pnpm run type-check`; `pnpm exec vitest run tests/consensus/provider-cli`; review also ran `pnpm run validate` and `pnpm run smoke` | yes | 0 | Provider CLI phase scope |
| 2     | -         | -      | -      | -        |

## Final Summary (for PR/docs)

**What shipped:**

- {capability 1}
- {capability 2}

**Behavioral changes (user-facing):**

- {bullet}

**Key files / modules:**

- `{path}` - {purpose}

**Verification performed:**

- {tests/lint/typecheck/build/manual steps}

**Design deltas (if any):**

- {what changed vs design.md and why}

## References

- Plan: `plan.md`
- Design: `design.md`
- Spec: `spec.md`
