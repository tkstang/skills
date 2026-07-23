# Final Wave Gate: wave-2-execution (2026-07-23)

- **Reviewer:** Codex cross-runtime judgment sweep, reasoning effort **xhigh**, read-only
- **Model note:** operator-mandated `sol` remains unavailable on this account
  (standing wave-1 constraint); default Codex model at xhigh substituted.
- **Scope:** integration diff `origin/main...wave-2-execution` shipped surfaces;
  plans immutable; dispositioned per-phase reviews not re-litigated.
- **Raw verdict:** FIXES_NEEDED — 0 Critical, 3 Important, 4 Medium, 1 Minor.
- **Terminal status:** `passed` (all eight findings fixed with stored
  verification records; none rejected).

## What the sweep verified clean

Generated-output byte coherence, structural validation, skill-version
validation, TypeScript, `git diff --check`, direct core/panel timeout probes,
fixture modes, clean worktree, conventional commit subjects; no hand-edited
generated files.

## Dispositions (all Fixed)

| # | Sev | Finding | Fixed in | Verification record |
|---|-----|---------|----------|---------------------|
| 1 | Important | Output-cap kill could hang (final-resolution only in timeoutMs branch); gate reproduced the hang with a descendant probe | `2134d9b` (fix lane) | `scheduleFinalResolution()` extracted and called from both timeout and cap-kill paths, idempotent, capError precedence preserved; panel copy verified to have NO cap path (core-only correct). New fixture + regression test: cap breach + pipe-holding descendant + no timeoutMs → bounded SUBPROCESS_OUTPUT_CAP rejection. Repro verified: test hangs (6s timeout) with the cap-path call removed, passes with fix. |
| 2 | Important | `create`/`decide`/`plan` missed transitive version bumps for shared consensus-loop.mjs changes (both waves) | `08dc001` (orchestrator) | All three bumped 0.1.4→0.1.5 both fields (asserted edits, 2 fields each); CHANGELOG entries extended to name them; systematic guard filed as `BL-260723-guard-transitive-shared` (mechanical consumer-set derivation from the import graph). |
| 3 | Important | CHANGELOG overclaimed production timeout protection (no caller passes timeoutMs) | `08dc001` | Reworded to "supports caller-supplied deadlines" + explicit "No default timeout is wired yet" sentence. |
| 4 | Medium | `--root` operations derived skills from DEFAULT_ROOT | `f2efec2` (fix lane) | `skillFilesForRoot(root)` used by bumpVersion/checkTagVersion; module export preserved for tests; scratch-root regression test proves per-root derivation (7/7 versioning tests). |
| 5 | Medium | Classification cache retained uncapped bootstrapRecordIndexes | `c51b42a` (fix lane) | Consumer trace recorded (rank/digest never read cached indexes); `compactClassificationForCache()` empties the array uniformly on hit/miss, keeps scalar count; consumed fields enumerated in comment; regression test across miss + hit. |
| 6 | Medium | Read-count mock blind to intra-module extractMeta reads | `42ba516` (fix lane) | Seam moved to `readFile` at the fs boundary in both suites; verified by reinjecting a double-read → assertion fails (count 2) where the old seam reported 1. No production change. |
| 7 | Medium | Engineering docs described superseded SKILL_FILES / declared-rewrite mechanisms | `08dc001` | conventions.md and generated-runtime.md updated to the derived mechanisms (asserted single-sentence edits). |
| 8 | Minor | Unresolved-import test shadowed by type-only import | `f4c1441` (fix lane) | Shadowing import removed; assertion names the exact offending specifier. |

## Verification summary (gate → passed)

Fix lane's own gates green (premerge, 1137 passed / 1 skipped;
validate:skill-versions clean); post-merge integration gates re-run green on
the final tree (see bookkeeping commit). `passed` is terminal for this row.
