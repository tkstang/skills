---
oat_generated: true
oat_generated_at: 2026-10-29T16:42:55Z
oat_review_scope: ecc8b2be5235384641ea6b3d41c73410c125d0a5..1e231e2de21968aca343fc76d8296b608f821456
oat_review_type: code
oat_review_invocation: manual
oat_project: .oat/projects/shared/session-toolkit
oat_review_head_sha: 1e231e2de21968aca343fc76d8296b608f821456
oat_review_requested_scope: p04-release-audits
oat_review_phase_ids: [p01, p02, p03, p04]
oat_review_base_sha: ecc8b2be5235384641ea6b3d41c73410c125d0a5
oat_review_scope_source: explicit
oat_review_integration_commits: [863eede105e3f2f658750c0f08f3db817f93e00f]
---

# Code Review: release-candidate audit lenses

**Reviewed:** 2026-10-29T16:42:55Z
**Scope:** PR #149's explicit committed range, limited to deliberate-testing gaps/deltas, complexity of the new public package/build/release machinery, and current package/release/contribution/instruction accuracy. Correctness and release-security verification belong to the separately dispatched reviewer.
**Files reviewed:** 33 changed product, test, configuration, documentation and instruction files, plus supporting project artifacts and prior review evidence. Other package modules were inspected as dependency/ownership context, without repeating inherited test reviews.
**Commits:** `ecc8b2be5235384641ea6b3d41c73410c125d0a5..1e231e2de21968aca343fc76d8296b608f821456` (108 commits). The listed integration commit is included. Unchanged upstream explain-options work is excluded from findings.

## Summary

No findings in the three assigned audit lenses. New test deltas protect distinct public or release boundaries, the package/release machinery is proportionate to the approved public distribution contract, and current package/root documentation distinguishes preparation from publication and migration. This is a pre-action prefix review, not acceptance of p04, p05 or the whole delivery; execution assurance and publication readiness require the separate correctness review and root-owned live receipts.

Findings by severity: 0 critical, 0 high, 0 medium, 0 low

## Findings

### Critical

None

### High

None

### Medium

None

### Low

None

## Requirements/Design Alignment

**Evidence sources used:** current `plan.md` and `implementation.md`; `references/package-contract.md`, `consumer-inventory.md`, `p01-verification.md`, the final correction sections of `p02-verification.md` and `p03-verification.md`, and `references/research/release-ci-reference.md`; installed brief contract sections 1–10; the four existing p01/p02/p03 code review artifacts; the naming decision and originating shared-toolkit brainstorm. Applied installed `deliberate-testing` in review mode, `complexity-review` and its evidence guide, and `pr-self-review/references/review-evidence.md`. Root/package/source/scripts/tests/documentation instructions were read. Discovery, spec and separate design artifacts are intentionally absent in brief mode; architecture alignment uses the brief's Approach and selected package contract.

| Requirement or boundary                                                  | Audit disposition               | Evidence and limit                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intentional public library/CLI, independent version and Node floor       | Aligned                         | Package manifest, deliberate root exports and README agree on ESM/root API, `seshtk`, 0.1.0, Node >=22.0.0 and independent tags. This audit did not execute the installed package.                                                             |
| Exact-archive preparation, verification and publication responsibilities | Aligned within this lens        | Release scripts, workflow, RELEASING and scoped instructions use the same command names, candidate files, tag/source checks, enable setting and integrity retry contract. Correctness/security disposition remains with the separate reviewer. |
| One authored engine for eventual Skills/ORC consumers                    | Staged, not complete            | Inventory explicitly retains donors until verified cutover; package operations import the package closure. Removal and consumer prerequisite/offline-hook evidence remain later p04/p05 work.                                                  |
| Current npm package and maintainer documentation                         | Aligned                         | Package README/CHANGELOG and root README/CONTRIBUTING/RELEASING describe delivered operations, raw versus sanitized evidence, state ownership, release bootstrap and remaining migration boundaries.                                           |
| Full canonical site, visual and ORC documentation acceptance             | Pending by approved phase scope | p05 owns the complete reference/coverage/visual audit. Its absence in this release-preparation prefix is not a finding.                                                                                                                        |

### Extra Work (not in declared requirements)

None significant. No consumer cutover, persistent index, daemon, generalized release coordinator, compatibility alias or additional state system was introduced in this prefix.

## Deliberate-testing review

Review evidence is inherited only where the earlier independent artifact explicitly applied the lens and bound a range. `p02-review-2026-10-29T145255Z.md` and `p02-review-2026-10-29T152302Z.md` explicitly use deliberate-testing; the latter covers the full p02 base through `f77c538084a66d4ad81525795afc48bcf291b5a8`. `p03-review-2026-10-29T160106Z.md` explicitly uses it through `2776448d5a023cd34b2c75a7577abc927fb500a5`. These are fresh-context independent reviews according to the recorded dispatches; they do not cover subsequent fixes. p01's artifact does not explicitly apply this standard, so its package-foundation tests were reviewed here.

Git inspection confirmed the outstanding product/test deltas: p02 root correction `1e52610f1082b91e79b1571d1ad417c3d9e00658`, p03 root correction `c193bf0f6600457bf040e9a1820e2f5eb1fea114`, and p04 release prefix `22556ca8efc19958abe69ae78b5d75781b8983e4`. Later changes through the supplied head are integration/bookkeeping rather than additional toolkit test changes.

| Reviewed protection                                                             | Disposition and evidence                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation CLI framing, import isolation and packed dependency/lifecycle guards | Keep. `session-toolkit-cli.test.ts` executes the built boundary with temporary HOME/STATE_DIR and independent envelope/exit/output expectations. `session-toolkit-package.test.ts` exercises production validation with malformed metadata and a real linked tar member; the npm sentinel verifies refusal before installation. These are distinct from installed-archive omission/runtime-floor proof.                    |
| Codex tool-result opt-in correction                                             | Keep. The new public parse regression uses literal default/calls/results/both expectations and explicit continuation coordinates; it would fail on the pre-fix dropped result. It does not reproduce the same scenario through every layer.                                                                                                                                                                                |
| Cheap-source incomplete coverage correction                                     | Keep. Public valid-hit/no-match/malformed/oversized controls exercise the three distinct adapter paths and literal completeness outcomes. The unreadable-index case restores permissions and skips contexts where chmod cannot establish the intended failure. No own-module mocks supply the asserted coverage.                                                                                                           |
| Release binding and registry decision                                           | Keep. `session-toolkit-release.test.ts:123` uses a real disposable Git source and archive, accepted controls and specific refusal messages for dirty source, false metadata, notes/byte substitution, mismatched package metadata and tag movement. `:216` mocks only external npm JSON/exit status and uses independent publish/retry/refusal outcomes. The functions under test are also called by production CLI paths. |
| Root script inventory edits                                                     | Keep as a bounded extension of the existing repository command contract. No new scan harness or parallel test infrastructure was created.                                                                                                                                                                                                                                                                                  |

Retained apparent overlaps: source-level operations protect behavior; the installed archive proof protects missing shipped modules/declarations, import resolution and actual Node compatibility. Donor/package fixture overlap is temporary extraction evidence while donors still serve production consumers, as explicitly recorded in the inventory. No test deletions, newly exported test-only runtime hooks, circular oracles or material unexplained fixture infrastructure were found in these deltas. Previously covered p02/p03 tests were not re-audited.

## Complexity review

**Verdict:** Deletion-rule compliant for this prefix. No material mechanism was identified that can be removed while preserving the approved contract and its minimum proof.

### Contract

- **Outcome:** one maintained public session engine, library and CLI, shared later by Skills and ORC; the originating brainstorm records the operator's requested identity/search/parsing/export scope and thin CLI direction.
- **Hard constraints:** Node 22/24 consumers, explicit public API, read-only transcript operations, separate sanitized export/sensitive evidence, offline bundled hooks and consumer-owned state. The approved brief requires one exact archive, independent pre-action review and root-owned publication/account execution.
- **Acceptance criteria:** deliberate API/CLI and controlled provider fixtures work from the installed archive on actual Node 22.0.0/24; source/archive/version/notes/tag identities and eventual registry receipts are recorded. Consumer cutover is separately verified.
- **Minimum proof:** focused public boundary regressions plus one packed/installed artifact checked on both runtimes, followed by exact-artifact release validation and actual publication/install receipts. A broad new harness or provider certification campaign is unnecessary.

### Simplest viable solution

Keep one workspace package with a narrow root API and CLI bin, its provider/projection implementation, one package build and archive inspector, and one small release driver consumed by the three-job workflow. Keep the interactive updater at the bin boundary and retain consumer state/policy outside the package. Continue the already planned donor removal during verified migration; no interim fallback engine or second authored package implementation is needed.

### Complexity ledger

| Item                                                     | Claimed value                                                       | Evidence                                                                                                                                                                                                                                                | Lifecycle cost                                                                                                   | Recommendation                                                                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Package API, CLI factory and provider/projection modules | Shared engine without flattening evidence into a digest             | Hard requirement: approved Outcomes 1–4 and originating request; `src/index.ts` names deliberate exports and `cli.ts` calls those operations. Distinct exact identity, historical ranking and sensitive/sanitized projections have different contracts. | Public type/wire commitments and donor reconciliation; no public wildcard barrel or new orchestration framework. | Keep. A single lossy reader would not preserve the requested search/activity and coordinate contracts.                                        |
| Build, package inspector and release driver              | Independent installation and exact-archive handoff                  | Hard requirement: brief release contract; actual workflow calls prepare once and downloaded verification/publication. `session-toolkit-release.ts` reuses `inspectArchive`/`validateArchive`, rather than cloning the install verifier.                 | Two focused tooling owners, one manifest, checksum and notes payload.                                            | Keep. Manual rebuilding in each job would lose the required artifact identity; a multi-package coordinator would add no value.                |
| Focused release fixtures and installed proof             | Detect contract refusal and shipped-artifact failures independently | Strongly inferred plus observed regressions in prior reviews; accepted and failing controls above reach real code. Installed proof exercises module/declaration and runtime boundaries unit tests cannot reach.                                         | Temporary Git/archive fixtures and two runtime installs.                                                         | Keep. Do not expand this into every-provider × every-layer repetition.                                                                        |
| CLI-only update cache                                    | Requested interactive release notice without repeated registry work | Hard requirement: approved Outcome 5 and rejected uncached/no-notice alternatives; `bin.ts` calls it after successful operations and the library root excludes it.                                                                                      | One metadata cache and best-effort request path, without shared session state or automatic upgrade.              | Keep. Removing the cache would violate the chosen network/latency behavior.                                                                   |
| Temporary donor/test overlap and phase evidence          | Safe staged replacement and auditable release boundary              | Hard requirement/observed: production consumers still import donors; inventory lines 130–165 assigns staged ownership, and earlier independent reviews found defects before cutover.                                                                    | Temporary dual fixtures/source plus historical journal/review material.                                          | Keep through migration, then perform the already specified source removal. This is not approval to retain two authored engines after cutover. |

There is no recommendation to rewrite historical review artifacts or add new process machinery. Simplification now would risk removing parity/installation evidence or prematurely breaking current consumers; the existing migration exit criteria already provide the point at which donor duplication must end.

## Verification Commands

This audit executed only read-only Git/file inspections and formatting of its own report. No build, test, archive, npm, global install, live transcript access, product edits or publication command was executed by this reviewer. The separate correctness reviewer owns execution, so a suite pass is not asserted here.

Exact inspection commands included:

```sh
git rev-parse 1e231e2de21968aca343fc76d8296b608f821456^{commit}
git rev-parse 1e231e2de21968aca343fc76d8296b608f821456^{tree}
git diff --stat ecc8b2be5235384641ea6b3d41c73410c125d0a5..1e231e2de21968aca343fc76d8296b608f821456
git show 1e52610f1082b91e79b1571d1ad417c3d9e00658 -- tests/release/session-toolkit-read.test.ts packages/session-toolkit/src/provider-runtime.ts
git show c193bf0f6600457bf040e9a1820e2f5eb1fea114 -- tests/release/session-toolkit-search-public.test.ts packages/session-toolkit/src/search-claude-code.ts packages/session-toolkit/src/search-codex.ts
git show --stat 22556ca8efc19958abe69ae78b5d75781b8983e4
```

Independently read the current candidate's `release.json`, `SHA256SUMS` and `RELEASE_NOTES.md` at `/tmp/session-toolkit-p04-integrated-candidate-20261029/`. Its manifest names the exact reviewed head and tree `08db7b956b43812c510a6690d1870d38b3e97886`, package/tag 0.1.0 and SHA256 `d88b7e67042fc8b5c15bcf7ab0886cc04f483757bdd4c4d8e956fa79ad831793`; notes match the curated package notes. This is metadata inspection, not an independent hash calculation or archive execution. The correctness reviewer reports an exit-0 clean binding/installed proof on actual Node 22.0.0 using:

```sh
/Users/tstang/.nvm/versions/node/v24.21.0/bin/node --import tsx scripts/session-toolkit-release.ts verify --directory /tmp/session-toolkit-p04-integrated-candidate-20261029 --node /Users/tstang/.npm/_npx/054abb958ec2ead1/node_modules/node/bin/node
```

For applicable reruns by the execution owner after any correction (suggested, not run here):

```sh
pnpm run build:toolkit
pnpm run test:vitest tests/release/session-toolkit-cli.test.ts tests/release/session-toolkit-package.test.ts tests/release/session-toolkit-release.test.ts tests/release/session-toolkit-read.test.ts tests/release/session-toolkit-search-public.test.ts tests/repo/package-metadata.test.ts
pnpm run type-check
```

The inspected tests provide accepted and failing controls at the changed boundaries; the separate correctness artifact must provide executed probe outcomes and any release-security limitations. Live npm rights, tag/publication/account/environment state, published installs, consumer migration and site visuals remain unverified here. The two established collaboration baseline exclusions remain explicit; neither `/tmp/a` nor `/tmp/b` was inspected, and no unqualified full-suite pass is claimed.

## Recommended Next Step

Root should reconcile this artifact with the separate correctness review through `oat-project-review-receive`, preserving their distinct lenses and actual reviewed head. Complete required pre-action verification and live release prerequisites before publication; continue p04/p05 under the approved brief. This audit alone does not accept a phase or authorize a publication action.
