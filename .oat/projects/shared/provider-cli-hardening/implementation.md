---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-21
oat_current_task_id: null
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
| p02     | complete    | 10    | 10/10     |
| p03     | complete    | 5     | 5/5       |

**Total:** 22/22 tasks completed

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

**Status:** complete
**Started:** 2026-06-21

### Phase Summary

**Outcome (what changed):**

- Added a validated `consensus submit` CLI path with one-line `SubmitResult` stdout on success and failure.
- Bound each provider turn to a run-scoped sidecar file, schema path, and explicit `CONSENSUS_SUBMIT_COMMAND`.
- Prompted peers to use the injected submit command while preserving final-message JSON fallback behavior.
- Preferred valid submitted sidecar verdicts over final-message parsing and recorded `verdict_source`.
- Kept the core `ConsensusCliRunEnvelope` shape unchanged across submit and parse paths.

**Key files touched:**

- `src/consensus/provider-cli/args.ts` - `submit` command parsing.
- `src/consensus/provider-cli/commands.ts` - submit handler, structured failure handling, and CLI dispatch.
- `src/consensus/provider-cli/schema-validate.ts` - shared schema-subset validation.
- `src/consensus/provider-cli/structured-output.ts` - submit env/prompt/capture resolution and fallback behavior.
- `src/consensus/provider-cli/types.ts` - additive `verdict_source` diagnostic.
- `tests/consensus/provider-cli/*.test.ts` and `tests/consensus/core/provider-cli-invocation.test.ts` - submit path, fallback, and envelope-invariance coverage.
- `plugins/consensus/scripts/consensus.mjs` - generated runtime output from `pnpm run build`.

**Verification:**

- Run: `pnpm run build:check && pnpm run type-check && pnpm run test && pnpm run smoke && pnpm run validate`
- Result: pass.
- Review gate: initial p02 review found one Critical; first re-review found one Important; final p02 re-review passed with 0 Critical / 0 Important / 0 Medium / 0 Minor findings.

**Notes / Decisions:**

- Strict `require_submission` and distinct `missing_submission` remain deferred per the resolved plan.
- Two review fixes were accepted into p02: explicit `CONSENSUS_SUBMIT_COMMAND` injection and structured sidecar-write failure handling.

### Task p02-t01: Extract shared schema-subset validator

**Status:** completed
**Commit:** b7b9b11

---

### Task p02-t02: Parse `consensus submit` arguments

**Status:** completed
**Commit:** 1bd27a3

---

### Task p02-t03: Implement `runSubmit` handler

**Status:** completed
**Commit:** 2b0cd31

---

### Task p02-t04: Dispatch `submit` in the CLI + help text

**Status:** completed
**Commit:** 6d9d658

---

### Task p02-t05: Run-bound capture path + child-env injection

**Status:** completed
**Commit:** c5fe0e0

---

### Task p02-t06: Prompt the peer to submit

**Status:** completed
**Commit:** 1afbef9

---

### Task p02-t07: Preferred-source capture resolution + `verdict_source` diagnostic

**Status:** completed
**Commit:** 717eaa5

---

### Task p02-t08: No-submission behavior

**Status:** completed
**Commit:** 45e3b8d

**Notes:**

- Default behavior is prefer-submit, parse fallback, then existing terminal handling. Strict require-submission mode remains deferred.

---

### Task p02-t09: Envelope-contract invariance + core-loop integration

**Status:** completed
**Commit:** 8903c79

---

### Task p02-t10: Regenerate runtime + Phase 2 gates

**Status:** completed
**Commit:** 763b3e5

---

### Review Fix p02-r01: Inject peer submit command

**Status:** completed
**Commit:** 6180297

**Notes:**

- Resolved Critical review finding by injecting and prompting peers to use `CONSENSUS_SUBMIT_COMMAND` instead of assuming a bare `consensus` executable exists.

---

### Review Fix p02-r02: Return structured submit write failures

**Status:** completed
**Commit:** 0a11740

**Notes:**

- Resolved Important re-review finding by converting sidecar-write failures into one structured `SubmitResult` stdout line plus concise stderr.

---

## Phase p03: Reliability evidence, live E2E, and decision-record promotion

**Status:** complete
**Started:** 2026-06-21

### Phase Summary

**Outcome (what changed):**

- Added deterministic evidence fixtures showing submit-sidecar capture converts both known flaky failure classes into successful submitted verdicts.
- Added a gated live-provider E2E for prompt-driven `consensus submit`, skipped by default unless explicitly enabled.
- Recorded the Codex read-only sandbox/tmpdir limitation as a future capture-path relocation concern rather than a shipped support claim.
- Promoted DR-bl3a88 to the repo decision record and flagged the consensus-family backlog track.

**Key files touched:**

- `tests/consensus/provider-cli/evidence/no-structured-output.test.ts` - no-final-JSON reliability fixture.
- `tests/consensus/provider-cli/evidence/strict-output-rejection.test.ts` - strict-output rejection reliability fixture.
- `tests/consensus/provider-cli/e2e/submit-live.e2e.test.ts` - gated live-provider submit E2E.
- `.oat/projects/shared/provider-cli-hardening/design.md` - sandbox/tmpdir posture note.
- `.oat/repo/reference/decision-record.md` - promoted submit-CLI decision.
- `.oat/repo/reference/backlog/items/*.md` - backlog status and bl-3291 contract alignment.

**Verification:**

- Run: `pnpm exec vitest run tests/consensus/provider-cli/evidence/no-structured-output.test.ts tests/consensus/provider-cli/evidence/strict-output-rejection.test.ts tests/consensus/provider-cli/e2e/submit-live.e2e.test.ts`
- Result: pass, with the gated live-provider test skipped by default.
- Run: `pnpm run build:check && pnpm run type-check && pnpm run test && pnpm run validate && pnpm run smoke`
- Result: pass.
- Review gate: p03 re-review passed with 0 Critical / 0 Important findings; one Minor `oat_last_commit` traceability note was folded into final bookkeeping.

**Notes / Decisions:**

- p03-t04 was verification-only and produced no commit because the full gate sweep did not require generated-output changes.
- The p03 review artifacts were consumed and archived after the passing re-review.

### Task p03-t01: Fixture — no structured-output message to submitted verdict

**Status:** completed
**Commit:** c6fd0fe

---

### Task p03-t02: Fixture — strict-output rejection to submitted verdict

**Status:** completed
**Commit:** b14d72a

---

### Task p03-t03: Live-provider E2E and sandbox/tmpdir posture

**Status:** completed
**Commit:** 7e9b540

---

### Task p03-t04: Full gate sweep

**Status:** completed
**Commit:** verification-only; no commit required

---

### Task p03-t05: Promote DR-bl3a88 and flag consensus-family track

**Status:** completed
**Commit:** 718fa47

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

### Run 2 — 2026-06-21 04:00 UTC

**Branch:** provider-cli-hardening
**Tier:** 1
**Policy:** merge-strategy=sequential, retry-limit=2
**Phases:** 1 executed, 1 passed, 0 failed, 0 stopped

#### Phase Outcomes

| Phase | Implementer | Review | Fix Iterations | Disposition |
| ----- | ----------- | ------ | -------------- | ----------- |
| p02   | DONE        | pass   | 2/2            | passed      |

#### Parallel Groups

- p02: sequential; no parallel worktree group configured.

#### Dispatch Notes

- Dispatch: p02 implementation used `effort_axis=selected:xhigh`, `model_axis=inherited`; dispatch ceiling `xhigh` from project state.
- Dispatch: p02 review/fix/re-review used `effort_axis=selected:xhigh`, `model_axis=inherited`; reviewer ran at configured ceiling.
- Fix loop: resolved Critical `CONSENSUS_SUBMIT_COMMAND` executable-contract finding and Important structured write-failure finding.

#### Outstanding Items

- None.

#### Artifact / Design Deltas

| Task / Review | Source Artifact | Planned / Documented | Actual / Accepted | Reason | Source of Truth | Follow-up |
| ------------- | --------------- | -------------------- | ----------------- | ------ | --------------- | --------- |
| None          | -               | -                    | -                 | -      | -               | -         |

### Run 3 — 2026-06-21 05:00 UTC

**Branch:** provider-cli-hardening
**Tier:** 1
**Policy:** merge-strategy=sequential, retry-limit=2
**Phases:** 1 executed, 1 passed, 0 failed, 0 stopped

#### Phase Outcomes

| Phase | Implementer | Review | Fix Iterations | Disposition |
| ----- | ----------- | ------ | -------------- | ----------- |
| p03   | DONE        | pass   | 1/2            | passed      |

#### Parallel Groups

- p03: sequential; no parallel worktree group configured.

#### Dispatch Notes

- Dispatch: p03 implementation completed commits c6fd0fe, b14d72a, 7e9b540, and 718fa47.
- Dispatch: p03 review/fix/re-review used `effort_axis=selected:xhigh` for review and `selected:medium` for lifecycle-artifact fix; dispatch ceiling `xhigh` from project state.
- Fix loop: resolved the Important lifecycle-metadata finding from `reviews/p03-review-2026-06-21.md`.

#### Outstanding Items

- None.

#### Artifact / Design Deltas

| Task / Review | Source Artifact | Planned / Documented | Actual / Accepted | Reason | Source of Truth | Follow-up |
| ------------- | --------------- | -------------------- | ----------------- | ------ | --------------- | --------- |
| p03-review | state.md / implementation.md | p03-t01 next | p03 tasks complete, current task null | Lifecycle metadata lagged completed p03 commits | p03 commits c6fd0fe..718fa47 and passing p03 re-review | resolved; final review next |

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
- [x] p02-t01: Extract shared schema-subset validator - b7b9b11
- [x] p02-t02: Parse `consensus submit` arguments - 1bd27a3
- [x] p02-t03: Implement `runSubmit` handler - 2b0cd31
- [x] p02-t04: Dispatch `submit` in the CLI + help text - 6d9d658
- [x] p02-t05: Run-bound capture path + child-env injection - c5fe0e0
- [x] p02-t06: Prompt the peer to submit - 1afbef9
- [x] p02-t07: Preferred-source capture resolution + `verdict_source` diagnostic - 717eaa5
- [x] p02-t08: No-submission behavior - 45e3b8d
- [x] p02-t09: Envelope-contract invariance + core-loop integration - 8903c79
- [x] p02-t10: Regenerate runtime + Phase 2 gates - 763b3e5
- [x] p02-r01: Review fix, injected peer submit command - 6180297
- [x] p02-r02: Review fix, structured submit write failures - 0a11740
- [x] p03-t01: Fixture no-structured-output evidence - c6fd0fe
- [x] p03-t02: Fixture strict-output rejection evidence - b14d72a
- [x] p03-t03: Live-provider submit E2E and sandbox posture - 7e9b540
- [x] p03-t04: Full gate sweep - verification-only; no commit required
- [x] p03-t05: Promote DR-bl3a88 and flag consensus-family track - 718fa47
- [x] p03-r01: Review fix, lifecycle metadata aligned for p03 re-review - 7eb77eb
- [x] p03-r02: Re-review passed; p03 marked passed - bookkeeping

**What changed (high level):**

- Provider-exit retry classification is now locked, redacted, and covered by adapter matrix tests.
- Generated runtime output is in sync after Phase 1.
- The submit CLI seam is implemented, preferred over parse fallback when present, and preserves the core envelope contract.
- The peer prompt now uses a runner-injected submit command and submit write errors return structured JSON.
- Phase 3 evidence fixtures, gated live E2E, and DR/backlog promotion are complete.
- Lifecycle metadata now reflects that all p03 plan tasks are complete and p03 re-review passed.

**Decisions:**

- Added only evidence-backed provider-specific transient signatures; no guessed Codex/Cursor-specific patterns.
- Deferred strict require-submission mode remains out of scope until adoption evidence supports it.

**Follow-ups / TODO:**

- Run final review.

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
| p02   | `pnpm run build:check`; `pnpm run type-check`; `pnpm run test`; `pnpm run smoke`; `pnpm run validate`; generated-runtime write-failure check | yes | 0 | Provider CLI submit path and core envelope integration |
| p03   | `pnpm exec vitest run tests/consensus/provider-cli/evidence/no-structured-output.test.ts tests/consensus/provider-cli/evidence/strict-output-rejection.test.ts tests/consensus/provider-cli/e2e/submit-live.e2e.test.ts`; `pnpm run build:check`; `pnpm run type-check`; `pnpm run test`; `pnpm run validate`; `pnpm run smoke` | yes | 0 | Reliability evidence, gated live E2E, generated output, full gates |

## Final Summary (for PR/docs)

**What shipped:**

- Provider-exit retry classification is terminal-by-default for unknown exits, redacted in diagnostics, and covered across adapters.
- `consensus submit` gives provider peers a validated sidecar verdict-submission path while preserving the existing core envelope contract.
- Deterministic p03 evidence and gated live-provider E2E cover the submit path, and DR-bl3a88 is promoted to the repo decision record.

**Behavioral changes (user-facing):**

- Provider peers are prompted with a run-bound `CONSENSUS_SUBMIT_COMMAND`; submitted verdicts are preferred over final-message parsing when present.
- No-submission still falls back to the existing parse path by default.
- Transient provider exits retry without injecting process-exit messages as schema-validation feedback.

**Key files / modules:**

- `src/consensus/provider-cli/structured-output.ts` - retry loop, submit capture, fallback resolution, diagnostics.
- `src/consensus/provider-cli/commands.ts` - `consensus submit` handling.
- `src/consensus/provider-cli/adapters.ts` - provider-exit classification.
- `tests/consensus/provider-cli/` - classifier, submit, evidence, E2E, and envelope coverage.

**Verification performed:**

- `pnpm run build:check`
- `pnpm run type-check`
- `pnpm run test`
- `pnpm run validate`
- `pnpm run smoke`

**Design deltas (if any):**

- Codex read-only sandbox/tmpdir posture is documented as a future capture-path relocation concern; the default shipped behavior does not claim read-only Codex sidecar writes are supported.

## References

- Plan: `plan.md`
- Design: `design.md`
- Spec: `spec.md`
