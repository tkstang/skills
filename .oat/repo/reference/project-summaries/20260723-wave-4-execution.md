---
oat_generated: false
oat_last_updated: 2026-07-23
---

# Project Summary: wave-4-execution

Wave 4 of the repo-audit execution program: supply-chain/CI/release surface.
p01 ungrouped-first (its SHA-pin style fed the group's new workflows), then a
two-lane parallel group. Zero merge conflicts.

## What shipped

1. **Supply-chain hardening** — optional `CONSENSUS_INSTALL_SHA256` install
   verification (fail-closed before anything lands, both install paths, 4
   automated tests + release-checklist checksum publication); all 24 workflow
   `uses:` SHA-pinned with accurate version comments (independently
   re-resolved); `.github/dependabot.yml` (github-actions, weekly);
   validate.yml concurrency group; a SHA-pin invariant test.
2. **Docs PR CI gate** — path-filtered pull_request workflow building the
   Fumadocs app + format check, pinned actions, docs-lockfile cache.
3. **Live-provider E2E visibility** — `pnpm run test:live-e2e` (loud failure
   when requested without a usable provider; default skip unchanged),
   RELEASING.md run-or-waive checklist line, AGENTS.md gate entry,
   dispatch-only live-e2e.yml documenting operator secrets.

## Review chain

Plan gate → passed (2 findings fixed; pre-gate scaffold flow validated).
p01: Codex ×2 (R2 PASS) + review PASS with independent pin re-resolution.
p02/p03: PASS. Final gate: pending at summary time; recorded in the review
table when terminal.

## Notable

An accidental single live codex call during p03 verification surfaced a
pre-existing stub-vs-live contract mismatch (verdict_source) — the exact drift
class this wave's live gate was built to expose. Follow-up filed.

## Workflow Observations

Ungrouped-first style-dependency composition validated; pre-gate scaffold flow
caught a real leftover on first use; poll-until-registered CI rule active.
