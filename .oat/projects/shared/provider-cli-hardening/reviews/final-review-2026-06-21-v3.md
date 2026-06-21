---
oat_generated: true
oat_generated_at: 2026-06-21
oat_review_scope: final
oat_review_type: code
oat_review_invocation: manual
oat_project: .oat/projects/shared/provider-cli-hardening
---

# Code Review: final

**Reviewed:** 2026-06-21
**Scope:** final (3rd final pass) — all 22 plan tasks (p01-t01..p03-t05), range `e4e9348..HEAD`
**Files reviewed:** 11 source files + 9 test files + 2 docs + 1 generated runtime
**Commits:** 41 (incl. p01/p02/p03 task commits, prior-review fixes, doc/bookkeeping)

## Summary

Independent re-derivation confirms the implementation is complete and correct against
all 12 functional and 5 non-functional requirements. The `bl-3a88` submit-CLI seam,
`bl-3291` retry-classifier hardening, deterministic capture, redacted diagnostics, the
unchanged core-loop envelope contract, and the DR-024 promotion all landed as designed.
The prior-review fix commits (`fix(p02-review)`, `fix(final-review)` 85393b2) introduced
no regressions; the final-review byte-cap and Codex strict-output-avoidance changes are
well-scoped and well-tested. All gates pass locally (build:check, type-check, test,
validate, smoke). **Verdict: PASS — no Critical/Important findings; one Minor observation.**

## Findings

### Critical

None

### Important

None

### Minor

- **Claude `provider_validated` path is not submit-gated like Codex's strict-output path**
  (`src/consensus/provider-cli/structured-output.ts:46-64`)
  - Issue: The final-review fix forces submit-enabled Codex turns to `prompt_only` so
    OpenAI strict `--output-schema` cannot reject the schema *before the peer turn starts*
    (a genuine pre-turn failure class). Claude's `provider_validated` (`--json-schema`)
    path is left intact on submit-enabled turns. This is defensible — Claude's
    `--json-schema` is applied to the *final message* and does not reject before the turn,
    so the two failure modes are not equivalent, and submit still wins as the preferred
    source when present (verified by the end-to-end submit test at
    `structured-output.test.ts:152-198`). Recording only because the asymmetry is implicit
    in the code, not documented at the call site.
  - Suggestion: Optionally add a one-line comment at `selectStructuredOutputStrategy`
    explaining why only the `constrained_native + prompt_only` (Codex) combination is
    downgraded under `submitCaptureEnabled`, and that Claude `provider_validated` is
    intentionally retained because it is a final-message constraint, not a pre-turn
    rejection. No behavior change required.

## Requirements/Design Alignment

**Evidence sources used:** `spec.md`, `design.md` (incl. DR-bl3a88), `plan.md`,
`implementation.md`, `discovery.md` (referenced), plus direct source/test inspection of
`src/consensus/provider-cli/*` and `tests/consensus/{provider-cli,core}/*`. Confirmed
`src/consensus/core/consensus-loop.ts` is byte-for-byte unchanged in range (NFR2).

### Requirements Coverage

| Requirement | Status      | Notes |
| ----------- | ----------- | ----- |
| FR1  Verdict-submission action (submit-CLI) | implemented | `args.ts:338-380` parse; `commands.ts:148-256` `runSubmit`; dispatch `commands.ts:290-292`; help `commands.ts:101`. End-to-end CLI dispatch test `cli-process.test.ts:353-394`; arg tests `args.test.ts:55-95`. |
| FR2  In-context validation + self-correction | implemented | Shared validator `schema-validate.ts`; failure → `ok:false` JSON on stdout + mirrored stderr + exit 1 (`commands.ts:326-339`). Valid-once / no-overwrite-with-invalid `commands.test.ts:324-375`. Submit prompt instructs self-correction `structured-output.ts:474-486`. |
| FR3  Deterministic capture into envelope/audit | implemented | Post-turn file read `readSubmittedVerdict` `structured-output.ts:413-437` (no race — turn fully exited); `verdict_source: submit` `:236-238`. Core seam projects it `provider-cli-invocation.test.ts:101-153`. |
| FR4  Defined no-submission behavior | implemented | prefer-submit → parse fallback → existing terminal handling `structured-output.ts:220-265`; tests `structured-output.test.ts:521-562`. Strict `require_submission`/`missing_submission` intentionally deferred per ledger (not flagged). |
| FR5  Reliability evidence vs prior path | implemented | Fixtures `evidence/no-structured-output.test.ts` (control vs submit) and `evidence/strict-output-rejection.test.ts` (legacy `constrained_native` control vs submit); gated live E2E `e2e/submit-live.e2e.test.ts` (skipped without `CONSENSUS_LIVE_SUBMIT_E2E=1` + ready preflight). |
| FR6  Confirm terminal-default retry contract | implemented | `adapters.ts:319-325` unmatched → `retryable:false`/`provider_exit_terminal`/`unknown`; locked `adapters.test.ts:83-101,271-283`, loop-level `structured-output.test.ts` unknown-no-retry. |
| FR7  Fix transient-retry prompt contamination | implemented | Transient retry path `structured-output.ts:201-203` does `continue` without touching `validationFeedback`; test asserts `prompts[1] === prompts[0]` `structured-output.test.ts:95-114`; schema-validation feedback still appended `:79-93`. |
| FR8  Evidence-backed per-adapter signatures | implemented | Claude 529-overload signature with cited evidence `adapters.ts:89-94`; Codex/Cursor explicit no-evidence comments `:96-102`. Per-adapter scoping proven (Claude signature does NOT fire on Cursor) `adapters.test.ts:175-201`. |
| FR9  Signal/interruption classification | implemented | `isReliableExternalInterrupt` requires `PROVIDER_EXIT` + `signal!=null` + `exit_code===null` `subprocess.ts:52-62`; classifier maps to transient `adapters.ts:269-277`. Timeout/output-cap stay terminal (distinct codes never reach interrupt branch); ambiguous (`exit_code` present) → terminal. Tests `adapters.test.ts:103-173`. |
| FR10 Redacted audit recording of basis | implemented | `exit_classification` enum threaded into diagnostics `structured-output.ts:157,191-200`; no-leak test asserts `token-123` stderr absent from serialized diagnostics `structured-output.test.ts:367-388`. |
| FR11 Contract-locking tests | implemented | Per-adapter matrix `describe.each(['claude','codex','cursor'])` `adapters.test.ts:227+`; prompt-contamination + no-leak regressions present. |
| FR12 Decision record + family-track flag | implemented | DR-024 promoted `decision-record.md:180+` (matches DR-bl3a88); family track `bl-b9b9`/`bl-87ef`/`bl-0cb8` flagged in `tool-based-verdict-submission-for-consensus-peers.md:56-78`. |
| NFR1 Dependency-free shipped runtime | implemented | No `package.json`/lockfile dependency changes in range; submit modules import only `node:`/relative `.js`. Smoke passes. |
| NFR2 Engine determinism + audit integrity | implemented | `src/consensus/core/` unchanged in range (only a test added); envelope-shape invariance `structured-output.test.ts:564-586`; core projection test `provider-cli-invocation.test.ts:101-153`. |
| NFR3 Redaction preserved | implemented | New diagnostics carry enum-only values; no-leak assertion `structured-output.test.ts:385-387`. Byte-cap rejection avoids copying oversized sidecar into envelope `:489-519`. |
| NFR4 Generated-output discipline | implemented | `pnpm run build:check` clean (consensus-provider-cli: in sync); generated `consensus.mjs` carries `// GENERATED` banner; no hand-edit detected. |
| NFR5 Gates green | implemented | build:check, type-check, vitest (provider-cli + core), validate, smoke all pass (see Verification Commands). |

### Extra Work (not in declared requirements)

- `submit-capture.ts` byte-cap module (`SubmitCaptureLimitError`, `CONSENSUS_SUBMIT_MAX_BYTES`)
  and the `prompt_only`-downgrade for submit-enabled Codex turns were added by the
  accepted `fix(final-review)` (85393b2). Both are justified hardening of FR1/FR3/NFR3
  (bounded capture, avoid pre-turn strict-output rejection) directly tied to final-review
  findings — not unrequested scope creep. Properly tested.

## Verification Commands

Run these to verify the implementation (all executed during this review):

```bash
pnpm run build:check     # PASS — consensus-provider-cli: in sync (all generated outputs in sync)
pnpm run type-check      # PASS — tsc --noEmit, no errors
pnpm exec vitest run tests/consensus/provider-cli tests/consensus/core
                         # PASS — 285 passed | 1 skipped (gated live E2E); 23 files passed | 1 skipped
pnpm run validate        # PASS — validation passed
pnpm run smoke           # PASS — smoke passed
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert findings into plan tasks.
(Only one optional Minor comment-clarity item; no Critical/Important fixes required —
this final pass is a clean PASS and the project is ready for PR merge.)
