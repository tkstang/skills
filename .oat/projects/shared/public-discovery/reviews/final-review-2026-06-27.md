---
oat_generated: true
oat_generated_at: 2026-06-27
oat_review_scope: final
oat_review_type: code
oat_review_invocation: manual
oat_project: /Users/tstang/Code/feat-public-discovery/.oat/projects/shared/public-discovery
---

# Code Review: final

**Reviewed:** 2026-06-27
**Scope:** final — independent re-verification of the whole branch (`970f8683..HEAD`, `feat-public-discovery`)
**Files reviewed:** 16 code-relevant files (resolver/core TS, refine TS, 5 generated `consensus-loop.mjs` + refine wrapper, 5 `SKILL.md`, `install.sh`, 4 new tests, README + 2 docs, backlog/handoff/verification artifacts)
**Commits:** 28 in range (`970f8683..65c9209`)

## Summary

This is an independent re-review reached from the code and artifacts directly, not a re-stamp of the 2026-06-26 final review. All three discovery/design categories are genuinely delivered: (1) the only standalone `skills/` entries are `session-observer` and `export-session-transcript` (verified live in `verification/cli-discovery.md`), (2) all five consensus skills stay discoverable but recover from a standalone install through a single existence-aware resolver, one shared actionable missing-CLI error, and a checkout-first `install.sh`, and (3) the OAT-tooling hiding outcome is authored as an upstream handoff prompt with its actual hiding **honestly recorded as deferred** to `BL-260621`, not masked as complete. Every real gate I ran is green: `build:check`, `validate`, `validate:skill-versions --base-ref origin/main`, `pnpm test` (867 passed / 1 skipped), `smoke`, `type-check`, and `bash -n install.sh`, with the working tree still clean afterward (no generated-output drift). I found **0 Critical and 0 Important** issues; the only notes are two Minor robustness/release-coordination observations and one out-of-scope doc nit.

## Findings

### Critical

None.

I specifically checked: requirement coverage for all three categories; the resolver order and that plugin-install behavior is unchanged; that the shared missing-CLI error reaches all five wrappers (not refine only); that generated `.mjs` are build-regenerated (not hand-edited); that tests sandbox `HOME` and never write the real `~/.consensus`; and that no placeholder/moving ref leaked into runtime-facing text. None surfaced a Critical defect.

### Important

None.

Independently confirmed:

- **Resolver order is correct and plugin install is unchanged.** `resolveConsensusCliPathDetails` (`src/consensus/core/consensus-loop.ts:1300`) resolves explicit arg → `CONSENSUS_CLI_PATH` → plugin-relative (only when `existsSync`) → `~/.consensus/consensus.mjs` (only when `existsSync`) → `missing`. In a real plugin tree the plugin-relative `plugins/consensus/scripts/consensus.mjs` exists (77 KB present), so resolution returns `source: 'plugin'` exactly as before. The shared path is a single source of truth via `CONSENSUS_SHARED_CLI_RELATIVE_PATH` (`consensus-loop.ts:1286`), reused by `consensusSharedCliPath`, the resolver, and asserted equal to `install.sh`'s `CONSENSUS_INSTALL_TARGET_RELATIVE` by the contract test.
- **Shared error reaches all five wrappers.** `tests/consensus/provider-cli/missing-cli-message.test.ts` imports the real `runSequential`/`runConsensusEvaluate`/`runConsensusDecide`/`runConsensusPlan`/`runConsensusCreate` entrypoints, drives each to the missing-CLI state under a sandboxed empty `HOME`, and asserts all five throw an identical `CONSENSUS_PROVIDER_CLI_MISSING` message naming both recovery options + README + `~/.consensus/consensus.mjs`. refine's old `missingConsensusProviderCliError` copy is deleted (`consensus-refine.ts`) and its preflight now calls `requireConsensusCliPath` + `consensusProviderCliMissingError`. The full suite passing confirms this end-to-end, and `verification/cli-discovery.md` shows the live exit-78 message from a simulated standalone `refine`.
- **`install.sh` is checkout-first, pinned, and shell-safe.** `set -euo pipefail`, atomic `mktemp`+`mv` with an `EXIT` trap, clear `fail()` messaging, `curl`||`wget` fallback, a Node-22 guard, and idempotent re-run. The ref is the concrete `v0.1.2` (`CONSENSUS_INSTALL_REF:-v0.1.2`), not a `<tag>` placeholder or moving branch. The unit test mocks `curl` and asserts the pinned URL is constructed without a live fetch; checkout-mode copies the in-tree `consensus.mjs`. No `v0.1.2` tag exists yet, so the "goes live once v0.1.2 is released" wording is accurate and the live remote check is correctly deferred.
- **Generated outputs are build-derived, not hand-edited.** `pnpm run build:check` is clean and the working tree stayed clean after `build`/`test`/`smoke`; the generated `consensus-loop.mjs` and `consensus-refine.mjs` diffs mirror the canonical TS line-for-line.
- **Version bumps are in lockstep.** create/decide/plan `0.1.0→0.1.1`, refine `0.1.1→0.1.2`, evaluate `0.1.2→0.1.3` (clears current `origin/main`), each with `version` == `metadata.version`. `validate:skill-versions --base-ref origin/main` reports "5 changed skill(s) verified".
- **Dependency-free constraint respected.** New runtime code uses only `node:fs`, `node:os`, `node:path` (plus the pre-existing `child_process`/`crypto`/`url`). `install.sh` uses only bash + curl/wget + node.

### Medium

None.

### Minor

- **Cross-file contract test does not cover `documentation/docs/user-guide/installation.md`** (`tests/consensus/install-contract.test.ts:14-58`)
  - Issue: The contract test enforces the pinned ref + `~/.consensus/consensus.mjs` literal across README ↔ `install.sh` ↔ resolver and rejects `<tag>`/`main`/`HEAD`, but the docs install page carries the same `v0.1.2` one-liner and `~/.consensus/consensus.mjs` references (`installation.md:68`) and is not asserted. At release, bumping the README ref while forgetting the docs page would not be caught by the very drift guard the design emphasizes. Both surfaces currently agree, so this is a coverage gap, not a live defect.
  - Suggestion: Extend the contract test's `extractInstallRefs`/path assertions to also read `documentation/docs/user-guide/installation.md`, or document that the docs page is intentionally out of the contract's scope. The plan only scoped README, so this is defensible to defer — but worth a one-line follow-up.

- **`v0.1.2` install pin vs `evaluate@0.1.3` skill version — release-tag coordination** (`install.sh:4`, `README.md:59`, `documentation/docs/user-guide/installation.md:68`)
  - Issue: The remote one-liner pins to release tag `v0.1.2`, while the `evaluate` skill is internally at `0.1.3` and the only existing git tag is `v0.1.0`. Release tags and per-skill versions are independent, so this is not contradictory today, but the remote path only works if the first release that actually contains `install.sh` + the new resolver is tagged `v0.1.2`. If a `v0.1.2` tag were ever cut from a commit lacking this code, the one-liner would 404 on `install.sh` or fetch a stale `consensus.mjs`.
  - Suggestion: This is the post-release verification the design/plan already defer to `BL-260621` — keep it on the release checklist so the chosen release tag (a) contains this branch's `install.sh`/resolver and (b) matches the README/`install.sh` pin (the contract test keeps README↔install.sh aligned to each other, but cannot know the actual released tag). No code change needed pre-merge; the deferral is honestly recorded.

## Requirements/Design Alignment

**Evidence sources used:** `discovery.md`, `design.md`, `plan.md`, `implementation.md` (quick mode; `design.md` present and treated as authoritative). Verified against the actual diff (`970f8683..HEAD`), the live `verification/cli-discovery.md` evidence, the backlog `BL-260621` findings, and the running gates.

### Requirements Coverage

| Requirement | Status | Notes |
| ----------- | ------ | ----- |
| Cat 1 — `session-observer` + `export-session-transcript` are the only individually-installable standalone entries and resolve/run | implemented | `cli-discovery.md` parses the 64-name `skills@1.5.13 --list` to exactly 2 standalone names, and installs + `--help`-runs each from isolated HOME (exit 0). |
| Cat 2 — all five consensus skills stay discoverable | implemented | Live `--list` shows create/decide/evaluate/plan/refine; no `internal` added to consensus; plugin-manifest discovery intact. |
| Cat 2 — standalone install recoverable via shared resolver fallback | implemented | `~/.consensus/consensus.mjs` fallback in `resolveConsensusCliPathDetails`; resolver-order tests green; live sim resolves `source: 'shared-home'` after `install.sh`. |
| Cat 2 — single shared actionable missing-CLI error across all five | implemented | `consensusProviderCliMissingError` in core; refine delegates; `missing-cli-message.test.ts` asserts identical message for all five. |
| Cat 2 — pinned `install.sh` provisions the shared script | implemented | Checkout-first + mocked pinned remote; idempotent; concrete `v0.1.2` ref; `install-sh.test.ts` green. |
| Cat 2 — README alternative-install + cross-file contract | implemented | README + docs section added; `install-contract.test.ts` asserts README↔install.sh↔resolver agreement and rejects placeholders/moving refs. |
| Cat 2 — changed consensus skills version-bumped | implemented | 5 skills bumped in lockstep; `validate:skill-versions` passes. |
| Cat 3 — upstream handoff prompt authored, hiding outcome deferred | implemented | `handoff/open-agent-toolkit-internal-flag-prompt.md` names target repo, flag, affected skill set, and post-sync verification; explicitly marks the hiding outcome deferred to `BL-260621`. |
| skills.sh crawl-vs-submission verified + strategy recorded | implemented | `BL-260621` records dated hosted-index checks (not indexed), the no-listing-until-cat-3 strategy, and the deferral. |

### Extra Work (not in declared requirements)

- `providerCliSpawnTarget` was broadened from "default consensus path only" to "any `.mjs` command runs via `node`" (`consensus-loop.ts:1370`). This is necessary, not scope creep: the `install.sh`-provisioned `~/.consensus/consensus.mjs` is written `chmod 0644` (non-executable), so it must be spawned via `process.execPath`. The change is more robust (no exec-bit dependency) and does not regress non-`.mjs` provider CLIs (guarded by `path.extname`). No behavioral risk found.

## Verification Commands

```bash
# Generated-output integrity (must be clean; tree must stay clean after)
pnpm run build:check
git status --short

# Repo structure / manifest / docs invariants
pnpm run validate

# Skill version lockstep (NOTE: no extra `--`; the repo validator rejects literal `--`)
pnpm run validate:skill-versions --base-ref origin/main

# Full suite + smoke + types
pnpm test
pnpm run smoke
pnpm run type-check

# Installer shell safety
bash -n install.sh

# Targeted consensus coverage
pnpm exec vitest run tests/consensus/core/resolve-consensus-cli-path.test.ts \
  tests/consensus/provider-cli/missing-cli-message.test.ts \
  tests/consensus/install-sh.test.ts tests/consensus/install-contract.test.ts

# Drift sweep (expect no matches)
grep -rEn "raw\.githubusercontent\.com/tkstang/skills/(main|HEAD)/|<tag>" README.md install.sh documentation/
```

Out-of-scope observation (not a finding against this work): the repo `CLAUDE.md` documents the version gate as `pnpm run validate:skill-versions -- --base-ref <ref>`, but `scripts/validate-skill-versions.mjs` rejects the literal `--` ("unexpected argument: --", exit 2). The correct form is without the extra `--`, which is what `plan.md` already uses (the recorded p01 deviation). The validator and `CLAUDE.md` were not changed in this range, so this is pre-existing repo-doc drift outside the project scope; flagged only so future contributors and the release checklist use the working form.

## Recommended Next Step

Run the `oat-project-review-receive` skill to record this independent final review. No Critical or Important findings block merge; the two Minor notes are release-checklist / test-coverage follow-ups that can be tracked against `BL-260621` rather than fixed pre-merge.
