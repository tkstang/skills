# Final Wave Gate: wave-1-execution (2026-07-23)

- **Reviewer:** Codex cross-runtime judgment sweep, reasoning effort **xhigh**, read-only
- **Model note (operator-visible):** the operator-mandated `sol` model is NOT
  available on this Codex account (`The 'sol' model is not supported when using
  Codex with a ChatGPT account`, API 400). The gate ran on the account's default
  Codex model at xhigh effort — the strongest available substitute. Two launch
  defects preceded the successful run (`--effort` flag not supported on
  codex-cli 0.145.0 → `-c model_reasoning_effort=xhigh`; sol model rejection);
  both were invocation-level, consuming no remediation attempts.
- **Scope:** integration diff `origin/main...wave-1-execution` code/docs surfaces;
  review-chain artifacts as context; plans immutable; dispositioned findings not
  re-litigated.
- **Raw verdict:** FIXES_NEEDED — 0 Critical, 0 Important, 2 Medium, 0 Minor.
- **Terminal status:** `passed` (both Mediums fixed with stored verification records below).

## What the sweep verified clean

- All 27 generated outputs exact build products (no hand edits); type-check,
  structural validation, skill-version validation, changed-doc formatting,
  commitlint, `git diff --check` all pass; clean tree; **no cumulative security
  weakening and no shared mock/timer leakage across the four merged lanes'
  test additions**.

## Dispositions

| # | Sev | Finding | Disposition | Verification record |
|---|-----|---------|-------------|---------------------|
| 1 | Medium | CHANGELOG (and summary.md) wording "never steals a live owner's lock" overstates the shipped guarantee vs the documented three-contender residual (state.ts:198 / watch-state.ts:188) | **Fixed** (orchestrator, commit `docs(wave-1): qualify lock-reclaim guarantee wording`) | Wording now states the closed two-contender interleaving and names the documented residual ("narrow multi-contender window … funneled through exclusive lock creation"). Verified: grep of CHANGELOG/summary shows no unqualified "never" claim; text matches the source comment's stated residual. |
| 2 | Medium | cwd-cache atomicity tests non-discriminating (old direct-writeFile implementation would also pass) | **Fixed** (p03 implementer, commit `9cbe51e` on `wave-1/final-fix`, merged `--no-ff`) | New deterministic rename-failure test seeds the cache, one-shot-intercepts the destination rename, and asserts byte-identical previous file + no tmp residue + non-fatal semantics. **Empirically revert-verified:** with `saveCwdCache` temporarily reverted to direct `writeFile` (local backup, never committed) the test fails exactly as predicted (seeded content overwritten); restored implementation → 21/21 locate suite green. Full `premerge` green in the fix worktree (1112 passed / 1 skipped); re-run on the merged integration tree post-merge. |

## Verification summary (gate → passed)

Both fix dispositions carry the stored records above; the integration tree was
re-gated after the final merge (`pnpm run premerge` green — see bookkeeping
commit). `passed` is the terminal state for this row.
