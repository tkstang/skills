# p01 Code Review — consensus subprocess hardening (wave-2/p01)

- Reviewer: read-only phase reviewer (Opus-class)
- Date: 2026-07-23
- Branch: wave-2/p01 @ 4d840a0 (4 commits) vs base df9b899
- Contract: .oat/repo/reference/external-plans/2026-07-17-consensus-subprocess-hardening.md
- Persisted by the orchestrator (reviewer read-only mode)

## VERDICT: PASS

No findings requiring action. All Review-focus items, Done criteria, and Scope
boundaries verified; both Codex rounds' fixes confirmed in code; the round-1
rejection is correctly grounded; two scope expansions judged within-outcome;
adversarial double-settle probe passed.

## Per-disposition verification records

- **R1 final-resolution gap — FIXED, verified:** finalResolutionTimer
  (PROVIDER_CLI_FINAL_RESOLUTION_MS=1000ms) armed inside SIGKILL escalation in
  both copies; regression test with descendant-holds-pipes-fast fixture, 3/3.
- **R1 timedOut/PROVIDER_TIMEOUT classification — REJECTION UPHELD:** grep of
  all call sites confirms no production caller passes timeoutMs; the plan's
  Out-of-scope locks classification semantics; integration would be dead code.
- **R1 flaky escalation test — FIXED, verified:** shell fixtures install
  `trap '' TERM` before any deadline can race Node startup; suites 3× 10/10,
  no open-handle warnings.
- **R1 false twin comment — FIXED, verified:** accurate independently-maintained
  twin comments in both copies.
- **R2 stdio-destroy event-loop leak — FIXED, verified:** all three handles
  destroyed before force-settle; `pgrep -f 'sleep 86400'` → 0; `sleep 10`
  descendants drain to 0.
- **R2 capError precedence — FIXED, verified (loop copy):** capError rejected
  before generic timedOut resolve; panel copy correctly has no cap concept
  (pre-existing structural difference, not parity defect).

## Scope-expansion judgments (all WITHIN-OUTCOME, accepted)

1. Final-resolution machinery mirrors subprocess.ts (12,50,131-133,177-178);
   the plan's Outcome is parity with that stack; pipe-holding descendant is the
   named hang class. Wrapper's stdin-destroy is a documented superset.
2. Panel `runProviderCliCommand` export — testability, module-level, not a
   user-facing surface.
3. `timedOut` result field — the plan's own "distinguishable timeout outcome";
   not a CLI flag or config.

## Review-focus checklist (all PASS)

Timer cleanup all paths (leak-free, 3× runs) · outcome shape consistent-in-spirit
with subprocess.ts (full envelope deferred to consolidation) · behavior identical
when timeoutMs unset (gated + no caller sets it) · both-copy parity (only
pre-existing cap divergence) · stdin guard before end() in both · build:check in
sync · SKILL bumps refine 0.1.7 / evaluate 0.1.8 / panel 0.1.2 both-fields ·
conventional commits · zero .oat writes on branch.

## Adversarial probe (reviewer-designed)

Double-settle: close-first, deadline-first, and cap+timeout interleavings all
route through settleResolve/settleReject gated on `settled`; deadline-first on
an exiting child is a no-op kill + guarded late close. No double-settle path.
PASS.
