---
oat_generated: true
oat_generated_at: 2026-05-04
oat_review_scope: final
oat_review_type: code
oat_review_invocation: manual
oat_project: .oat/projects/shared/consensus-plugin
verdict: pass
critical_count: 0
important_count: 0
medium_count: 0
minor_count: 2
---

# Code Review: final (cycle 4 of 4)

**Reviewed:** 2026-05-04
**Scope:** Independent re-verification of the full implementation diff
**Range:** `ca7fa11ced8ee1176c4f230aa7d76789b3d625d7..HEAD`
**Files reviewed:** 89 (diff inventory) plus key sources read in full
**Commits in range:** 89

## Summary

Verdict: **pass**. I independently re-verified spec, design, plan, code, and tests; the implementation honors the v0.1 contract end-to-end and prior critical/important findings remain closed. All 124 tests pass, the structural validator passes, the mocked smoke run passes, and `bump-version --check-tag v0.1.0` confirms tag/manifest consistency. I found 0 Critical, 0 Important, 0 Medium, and 2 Minor items — both minor and not release-blocking. The deferred-findings ledger is empty and I did not find any silently-still-broken regression of previously closed findings.

Artifacts available and used: `discovery.md`, `spec.md`, `design.md`, `plan.md`, `implementation.md`, `state.md`, prior reviews under `reviews/archived/` (final v1/v2/v3 plus p01–p06 phase reviews).

## Findings

### Critical

None.

### Important

None.

### Medium

None.

### Minor

- **Stale local test count in `RELEASING.md` v0.1 Readiness Snapshot** (`RELEASING.md:25`)
  - Issue: The "Automated checks" table still shows `npm test | passed | 122 tests passed locally`, but Phase 6 added two regressions and the current local run reports 124 tests. The prior final-v3 review explicitly acknowledged this drift (it noted "current suite is 124 after p06 regressions") yet treated the stale 122 as closed. Independent re-run confirms the table is stale.
  - Suggestion: Update the table cell to "124 tests passed locally" to match the post-p06 suite. This is documentation drift only; CI workflows do not key off the count, and `npm test` itself is the source of truth at release time.
  - Verification: `npm test 2>&1 | tail -8` reports `tests 124`, `pass 124`.

- **Artifact frontmatter omits `host`** (`plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs:881`)
  - Issue: `design.md` §4.5 lists `host` (the detected host runtime) as part of the artifact frontmatter contract. `renderArtifactFrontmatter` emits `consensus_schema_version`, `mode`, `parallel`, `iteration`, `cold_start`, `agency`, `peers`, section counts, turn/round totals, wall-clock/cost fields, `input_path`, `run_id`, and `generated_at` — but `host` is not surfaced anywhere (not in frontmatter, not in the `consensus-resolution` JSON block built by `renderDeliberationArtifact`). `detectHost(env)` is computed inside `preflightPaseo` but never carried into the artifact.
  - Suggestion: Plumb `host` into the resolution object and frontmatter alongside `peers`. Low-risk addition — additive metadata, no consumer reads it yet.
  - Verification: `grep -n "host" plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs` shows `host` only appears in `resolvePeers` / `preflightPaseo` and never enters the rendered artifact.

## Prior Final Findings — Independent Disposition

| Prior finding (source) | Independent verification | Status |
| --- | --- | --- |
| Final v1 C1: Resume can overwrite completed-section output with current-input text (`final-review-2026-05-04.md`) | `runSequential` honors `resumeSection.resumedArtifact` (line 1660) and `parseDeliberationArtifactForResume` reads `state.final_output` first via `normalizeResumeSection` (line 313). Test `runSequential preserves completed resume section output when source input changes` passes in current `npm test` run. | Closed |
| Final v1 I1: Release validator rejects bumped versions (`final-review-2026-05-04.md`) | `scripts/validate.mjs` validates plugin manifest versions as semver and mutually consistent (`validateVersionConsistency`, line 224); tag-specific check is delegated to `bump-version --check-tag`. Tests `bumped patch versions validate and pass release tag consistency` + `repository validation accepts bumped semver versions` pass. | Closed |
| Final v1 m1: Frontmatter narrower than design §4.5 (`final-review-2026-05-04.md`) | Substantially closed by p05-t03 (frontmatter now carries iteration, cold_start, peers, turn/round totals, wall_clock_ms, cost fields, input_path, run_id). One remaining gap: `host` is still missing — re-recorded as Minor in this review (does not regress previously claimed fields). | Partially closed; `host` re-flagged here as Minor |
| Final v1 m2: Stale RELEASING evidence (`final-review-2026-05-04.md`) | Reopened. `RELEASING.md:25` still says 122 tests after p06 added 2; recorded as Minor here. | Re-flagged Minor |
| Final v2 C1: Source-input drift drops resume sections (`final-review-2026-05-04-v2.md`) | `sequentialRunSections` builds the run list from `resumeState.sections` (line 1457) when resuming. Test `runSequential preserves artifact section inventory when source headings drift` passes. | Closed |
| Final v2 I1: Resume hash validation ignores agency (`final-review-2026-05-04-v2.md`) | `normalizeResumeSection` computes `resumedArtifactHash` via `resumeHashOptionsForAgency(options.agency)` (line 319/333). Strict bytewise options apply for `minimal`. Test `parseDeliberationArtifactForResume validates minimal-agency hashes bytewise` passes. | Closed |

No previously-closed Critical or Important issue silently regressed.

## Requirements/Design Alignment

**Evidence sources used:** spec.md, design.md, plan.md, implementation.md, source files (consensus-refine.mjs, consensus-loop.mjs, validate.mjs, install-paseo.mjs, bump-version.mjs, smoke-test.mjs, SKILL.md, plugin.json files, marketplace.json files, schemas/verdict-alternating.schema.json), test suite, README.md, RELEASING.md, CHANGELOG.md, CONTRIBUTING.md, .github/workflows/{validate,release}.yml.

### Requirements Coverage

| Requirement | Status | Notes |
| --- | --- | --- |
| FR1 (repo scaffolded for multi-provider distribution, P0) | implemented | Top-level `skills/` exists; `plugins/consensus/{skills,agents,.{claude,cursor,codex}-plugin}` present; three repo-root marketplace.json files use `./plugins/consensus`; structural validator enforces invariants. |
| FR2 (alternating-mode deliberation, P0) | implemented | `runConsensusLoop` alternates between `peers[turnIndex % 2]`, applies the verdict schema, updates artifact on REVISE only. |
| FR3 (hash-based convergence, P0) | implemented | `detectConvergence` handles hash-match + double-ACCEPT-same-hash; `detectOscillation` covers 4+ alternation; max-rounds enforced via `turnBudget`. |
| FR4 (section detection + sequential default + opt-in parallel, P0) | implemented | `parseSections` honors heading + `<!-- section: name -->` overrides; `runSequential` is default; `prepareParallelRun` writes packets/manifest and emits `parallel_dispatch_required` JSONL; `fanInParallelRun` reassembles in `original_index` order. |
| FR5 (deliberation artifact w/ audit trail, P0) | implemented | `renderDeliberationArtifact` produces frontmatter + Final Output + Resolution + Goal + Section States + per-section Deliberation Log with canonical JSON containers. |
| FR6 (impasse handling + user surfacing, P0) | implemented | Impasse termination produces `status: impasse` and JSONL surface event; `--user-direction` writes `USER_INTERVENTION` records; `--skip-corrupt-section` etc. handle resume corruption; tests cover continuation after max-rounds intervention. |
| FR7 (cross-provider install paths, P0) | implemented (release-blocked, intentional) | README install matrix present; provider manifests exist; `RELEASING.md` correctly preserves manual-runtime blockers (Claude/Cursor/Codex/skills.sh) before tagging. |
| FR8 (CI validation, P1) | implemented | `.github/workflows/validate.yml` runs `npm test`, `npm run validate`, `npm run smoke` on PR and main push with `permissions: contents: read`. |
| FR9 (configurable peers via paseo inventory, P0) | implemented | `resolvePeers` rejects missing/unavailable peers from `paseo provider ls --json` (no executable probing); `preflightPaseo` checks both version and provider inventory. |
| FR10 (opt-in install assist, P1) | implemented | `scripts/install-paseo.mjs` prompts before running hardcoded `npm install -g @getpaseo/cli`, post-verifies via `paseo --version`, no auto-retry. Wrapper remediation correctly points at the repo-level script. |
| NFR1 (publishable audit trail, P0) | implemented | Render uses dynamic backtick fences, sanitizes prose, escapes peer headings via `containMarkdownHeadings`, strips `<script>`/`<style>` at render time only. |
| NFR2 (<5min/<$1 typical, P1) | tracked, not gated | NFR2 is intentionally ungated at v0.1; cost reporting fields exist (`cost_source`, `approximate_cost_usd`). |
| NFR3 (additive frontmatter portability, P0) | implemented | SKILL.md uses additive `allowed-tools`; CONTRIBUTING.md documents the rule (per implementation log; not re-verified line-by-line in this review). |
| NFR4 (OAT does not leak into plugin, P0) | implemented | Plugin manifests reference no `.oat/` or `.agents/` paths; skill scripts depend on no OAT-installed skills. |
| NFR5 (honest README, P1) | implemented | README has Status v0.1 section, Codex Git/local install path, deferred features listed under Limitations. |
| NFR6 (provider-runtime subagent permissions, P0) | implemented | SKILL.md documents Codex authorization fail-closed; preflight verifies paseo + providers; subagent dispatch is host-mediated. |

### Design Alignment Spot Checks

- **Verdict schema** — `schemas/verdict-alternating.schema.json` matches design §4.1 (no `maxLength` constraint; one-of branches by verdict).
- **Verdict caps** — `validateVerdictCaps` enforces 16 KB reasoning, 256 KB proposed_artifact, 4 KB × 20 concerns, 512 KB total in UTF-8 bytes per `Buffer.byteLength`.
- **Subprocess cap** — `SUBPROCESS_OUTPUT_CAP_BYTES = 10 * 1024 * 1024` enforced in `invokePaseo` capture handlers with kill-and-flag pattern, no throw inside stream callbacks.
- **Path safety** — `confineWrite` resolves real paths via `realpath` for nearest existing ancestor, rejects symlinked targets, blocks parent-escape; `atomicWriteFile` uses crypto-random temp suffix + rename. (Minor design note: design suggested `wx` open flag; current code relies on randomness only — collision probability is negligible at 8 random bytes per call.)
- **Hash normalization** — `normalizeForHash` strips trailing whitespace per line, normalizes line endings, collapses EOF newlines, restores final newline; `minimal` agency switches to `STRICT_HASH_OPTIONS` (full bytewise) — both in loop and resume paths.
- **Resume state model** — `parseDeliberationArtifactForResume` reads frontmatter + canonical `consensus-resolution` block + `consensus-section-states` array + per-section `consensus-section-status` and `consensus-verdict` blocks; rejects schema mismatches (exit 65); writes `resume-errors.json` diagnostic file.
- **Exit codes** — `EXIT_CODES` table matches design §Error Handling (USAGE 64 / DATA 65 / IO 73 / SECTION_ERROR 74 / NOPERM 77 / CONFIG 78 / INTERRUPTED 130).

### Extra Work (not in declared requirements)

I did not find any in-scope code that fails to map to a declared requirement. Implementation log already discloses minor scope choices (e.g., `--skip-all-corrupt` interactive plus `--yes-skip-corrupt` non-interactive, both flowing from FR6 acceptance criterion).

## Workflow Mode Compliance

Mode: spec-driven. All required artifacts (`spec.md`, `design.md`, `plan.md`) exist and were used. No workflow contract gaps.

## Verification Commands

I ran:

```bash
npm test
node scripts/validate.mjs
node scripts/smoke-test.mjs
node scripts/bump-version.mjs --check-tag v0.1.0
git diff --check ca7fa11ced8ee1176c4f230aa7d76789b3d625d7..HEAD
```

Results:

- `npm test`: passed, 124 tests, 0 failed.
- `node scripts/validate.mjs`: `validation passed`.
- `node scripts/smoke-test.mjs`: `smoke passed`.
- `node scripts/bump-version.mjs --check-tag v0.1.0`: `tag v0.1.0 matches manifest version 0.1.0`.
- `git diff --check`: clean (no whitespace/conflict markers).

## Recommended Next Step

Run the `oat-project-review-receive` skill to process findings.

The two Minor items can be batched into a single trivial doc/metadata follow-up commit; neither blocks public v0.1 tagging. The pre-existing `RELEASING.md` provider-runtime blockers are unchanged and correctly remain in place.
