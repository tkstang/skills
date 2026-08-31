---
oat_generated: true
oat_generated_at: 2026-08-31T02:20:15Z
oat_review_scope: design
oat_review_type: artifact
oat_review_invocation: auto
oat_project: /Users/thomas.stang/.codex/worktrees/d7d8/skills/.oat/projects/synced/coding-session-handoff
---

# Artifact Review: design

**Reviewed:** 2026-08-31T02:20:15Z
**Scope:** Revised committed `design.md` baseline at `83ff2e204646fb4d98be5f72b7189282365da6a4`
**Files reviewed:** 10
**Commits:** `83ff2e204646fb4d98be5f72b7189282365da6a4`

## Summary

The revision fully resolves the prior Claude cleanup/receipt-finalization, aggregate-preview, and execution-context/hook-isolation findings: both cleanup commands exist in the installed exact CLI versions, cleanup precedes receipt write/hash, preview has deterministic aggregate all-or-error limits, and the verified plan is bound to revalidated isolation argv and context fingerprints. The selector and target-baseline additions also make exact read-only reconciliation concrete, but the declared outcome union still permits a retryable failed item after child creation and the skill contract still promises a verified mapping for every native success, so the FR9 state machine is not yet internally safe enough for planning.

Findings: 0 critical, 1 important, 0 medium, 0 minor

## Findings

### Critical

None

### Important

- **The outcome union still admits retry-after-child and overclaims verified mappings** (`.oat/projects/synced/coding-session-handoff/design.md:585`)
  - Issue: `ItemOutcomeBase` correctly retains the expected child selector and target baseline, and a successful item now requires `observedChildNativeId`. However, the catch-all branch for every non-success/non-indeterminate status still permits `observedChildNativeId` (`design.md:594-597`), while `ReportingOutcome` is unconstrained across all native states. The published shape therefore admits a `failed`/`retryable: true` item with an observed or even `mapped` child, which can then enter `retryableKeys` despite the prose limiting retry to operations definitively failed before child creation (`design.md:820-825`). The skill contract separately requires an exact verified parent-to-child mapping for every native success (`design.md:734-736`), contradicting the allowed `succeeded` plus `unresolved`/`ambiguous` reporting states and the new `observed-unverified` rule (`design.md:613-621`). These are precisely the partial-result cases in which an implementation must not repeat a parent operation or fabricate a verified mapping.
  - Fix: Cross-discriminate `ItemOutcome` by both native and reporting state. Make `failed` valid only when no observed/mapped child exists and the operation is proven to have failed before child creation; classify every other nonzero/terminated operation with possible child creation as non-retryable `indeterminate`. Add strict runtime-schema invariants and tests that reject `failed + observed`, `failed + mapped`, and any `retryableKeys` entry with child evidence. Change skill step 8 to show an exact mapping only when reporting is `mapped`; for unresolved native success, show the safe `observed-unverified` selector and read-only reconcile guidance without claiming verification.
  - Requirement: FR9

### Medium

None

### Minor

None

## Requirements/Design Alignment

**Evidence sources used:** complete reviewed `discovery.md`; complete `spec.md`; complete revised `design.md`; scaffolded `plan.md` and `implementation.md`; project `state.md`; all four archived discovery/design review artifacts; installed Codex 0.151.0 version, feature list, `exec fork` help, and `delete` help; installed Claude Code 2.1.251 version, main help, `project` help, and `project purge` help.

### Prior Finding Disposition

| Prior finding | Status | Notes |
| --- | --- | --- |
| Claude cleanup feasibility and receipt finalization | resolved | Claude 2.1.251 documents `project purge -y <path>` for project-scoped state, Codex 0.151.0 documents exact UUID deletion, the fixture paths/IDs are fresh, and `design.md:478-488` cleans before atomically writing and hashing the final receipt. |
| Aggregate preview bounds | resolved | `design.md:181-193`, `design.md:243-260`, and the mapped tests cap candidates, bytes, records, elapsed time, and rendered text with one all-or-error result. |
| Execution-context binding and hook isolation | resolved | Codex 0.151.0 lists the stable `hooks` feature and supports `--disable <FEATURE>`; Claude 2.1.251 documents `--safe-mode` as disabling hooks/customizations. `design.md:330-339`, `design.md:364-425`, and `design.md:607-611` bind isolation argv plus execution-context fingerprints into the receipt, matrix, plan digest, and drift checks. |
| Outcome selectors and reconciliation evidence | partial | Expected/observed IDs and provider-qualified target baselines are retained and exact reconcile input is defined, but the union and skill interaction contract still permit contradictory retry/mapping states. |

### Requirements Coverage

| Requirement | Status | Notes |
| --- | --- | --- |
| FR1 | aligned | Exact-all, provider-qualified discovery, direct-only current evidence, deterministic ordering, and all-or-error completeness are concrete. |
| FR2 | aligned | Structural sanitization, per-file bounds, aggregate candidate/input/time/render limits, and preview serialization isolation are concrete. |
| FR3 | aligned | One, many, or all qualified selections are explicit; recency, duplicates, unknown IDs, and bare IDs cannot select. |
| FR4 | aligned | Existing registered worktrees, common-directory identity, branch/HEAD/dirty evidence, freshness, and no Git-state transfer are defined. |
| FR5 | aligned | Successor is default, plan is observational, current turns defer, and same-ID resume remains refused without writer-closed proof. |
| FR6 | aligned | Exact-version syntax, isolation/context fingerprints, reviewed receipt activation, provider-owned cleanup, and blocking two-provider gates are concrete. |
| FR7 | aligned | The complete mutation-relevant projection is displayed, digested, rebuilt, and compared immediately before execution. |
| FR8 | aligned | Both exact non-interactive successor argv shapes, bounded machine output, child-ID recovery, context revalidation, and forbidden-bypass checks are concrete pending the required live gates. |
| FR9 | partial | Exact selectors, target baselines, mapped evidence, indeterminate outcomes, and reconcile inputs are present, but invalid retryable-child and unconditional verified-mapping combinations remain representable. |
| FR10 | aligned | The public v1 skill, generated dependency-free runtime, version, inventory, docs, and provider-sync work are mapped. |
| NFR1 | aligned | Handoff discovery bypasses persistent cache reads/writes and keeps discovery, preview, planning, and reconciliation observational. |
| NFR2 | aligned | Preview isolation, bounded provider capture, path-free diagnostics, raw-output disposal, and the explicit local receipt boundary are coherent. |
| NFR3 | aligned | Shell-disabled argv, Git/capability freshness, Codex hook disablement, Claude safe mode, context drift checks, and no dangerous bypass are concrete. |
| NFR4 | aligned | Canonical TypeScript bundles to one dependency-free generated Node 22 runtime. |
| NFR5 | aligned | Discovery, preview, Git, probe, native-call, and reconcile resource bounds and deterministic failure semantics are explicit. |
| NFR6 | aligned | Focused/full tests, generated parity, validation, smoke, docs/navigation, inventory, version, and provider-install checks are mapped. |

### Extra Work (not in declared requirements)

None

## Verification Commands

Run these after revising the outcome state machine:

```bash
git -C .oat/projects/synced/coding-session-handoff diff --check
rg -n "type ItemOutcome|observedChildNativeId|retryableKeys|observed-unverified|For each native success" .oat/projects/synced/coding-session-handoff/design.md
codex features list
codex exec fork --help
codex delete --help
claude --help
claude project purge --help
```

Provider help validates only the declared command and isolation shapes. Exact successor identity, cwd, resumability, metadata effects, cleanup results, and receipt activation still require the digest-confirmed disposable live gates described by the design.

## Recommended Next Step

Run the `oat-project-review-receive` skill, tighten the FR9 outcome/skill state machine, and repeat the independent design review before completing the design HiLL checkpoint.
