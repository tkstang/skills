# Final Wave Gate: wave-3-execution (2026-07-23)

- **Reviewer:** Codex cross-runtime judgment sweep, effort **xhigh**, read-only
  (sol unavailable on this account — standing substitution, default model).
- **Raw verdict:** FIXES_NEEDED — 0 Critical, 1 Important, 2 Medium, 0 Minor.
- **Terminal status:** `passed` (all three fixed with verification records).

## Verified clean by the sweep

W1 atomic-write and W2 timeout machinery unchanged and coherent with the
consolidation; the accepted panel ruling unchallenged; all five generated
cli-helpers copies resolve to the closest sibling; command double-load of
sibling + plugin-root copies judged harmless (no mutable module state; shared
ConsensusError identity via the loop); build:check/type/structural/skill-version
/internal-flags/format/commit hygiene all green; no hand-edited generated files.

## Dispositions (all Fixed — merge `wave-3/final-fix`)

| # | Sev | Finding | Fixed in | Verification record |
|---|-----|---------|----------|---------------------|
| 1 | Important | `gitEnv()` scrubbed 8 named vars, missing GIT_CONFIG_COUNT/KEY_*/VALUE_*/PARAMETERS — inherited core.hooksPath could redirect hook mutations outside the scratch repo (gate reproduced read-only) | `fad8a10` | Scrub broadened to the entire `GIT_` prefix with caller-override re-application; adversarial regression test injects a sentinel core.hooksPath via GIT_CONFIG_* and asserts the sentinel stays untouched while scratch hooks mutate; PROVEN non-vacuous (test fails against the old 8-var scrub — temporary local revert, uncommitted); skill-version-bumps suite confirmed unaffected; real repo hooks timestamps unchanged post-run. |
| 2 | Medium | post-checkout failure propagation uncharacterized | `fad8a10` | Changed-lockfile + PNPM_STUB_FAIL_STEP=install case asserts nonzero exit; completes all-four-hooks exit-propagation coverage. |
| 3 | Medium | init.sh copy_matching_files + archived-project branches unpinned | `9d8f366` | Fixtures for all three -o patterns (.mcp.json, nested provider settings/mcp files) + archived-project tree; all five asserted copied. |

Post-merge integration gates re-run green (premerge; 1165 passed / 1 skipped).
