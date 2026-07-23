# Final Wave Gate: wave-4-execution (2026-07-23)

- **Reviewer:** Codex cross-runtime judgment sweep, effort **xhigh**, read-only
  (sol unavailable — standing substitution). First launch killed mid-run
  (no artifact); single re-run completed normally.
- **Raw verdict:** FIXES_NEEDED — 0 Critical, 1 Important, 1 Medium, 1 Minor.
- **Terminal status:** `passed` (all three fixed with verification records).

## Verified clean by the sweep

All 30 `uses:` entries SHA-pinned with coherent comments and identical
shared-action SHAs across all five workflows; concurrency does not interfere
with the non-cancelling release flow; no default test/CI path opts into live
E2E; checksum ordering + EXIT-trap cleanup correct; YAML/shell/diff-check/
generated-sync/validation/commit hygiene green.

## Dispositions (all Fixed)

| # | Sev | Finding | Fixed in | Verification record |
|---|-----|---------|----------|---------------------|
| 1 | Important | live-e2e.yml never provisions a provider CLI — every dispatch on a fresh ubuntu-latest VM fails preflight without exercising the boundary | `de97287` (fix lane) | Provider-gated install steps: codex `npm i -g @openai/codex@0.145.0`, claude `@anthropic-ai/claude-code@2.1.206` (both npm-view-verified pins); cursor documented self-hosted-runner-only with fail-fast `::error::` (no pinnable headless installer exists — checked Cursor docs). Header separates job-provisioned vs operator-configured. YAML parse-verified. |
| 2 | Medium | SHA-pin guard hardcoded 3 workflow files — the two new workflows unguarded | `407adf7` (fix lane) | Dynamic readdir discovery (5 files found); discrimination proven: temporarily un-pinning a line in live-e2e.yml fails the test, restore → 12/12 green. |
| 3 | Minor | Duplicate consecutive `### Added` heading in CHANGELOG Unreleased | `707a572` (orchestrator) | Dedup merged the install.sh bullet into the existing Added section; `grep -c "### Added"` → 2 (Unreleased + 0.1.0), bullet retained at line 14. |

Post-merge integration gates re-run green (premerge; 1170 passed / 1 skipped).
