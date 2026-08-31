---
oat_generated: true
oat_generated_at: 2026-08-31T01:50:31Z
oat_review_scope: design
oat_review_type: artifact
oat_review_invocation: auto
oat_project: /Users/thomas.stang/.codex/worktrees/d7d8/skills/.oat/projects/synced/coding-session-handoff
---

# Artifact Review: design

**Reviewed:** 2026-08-31T01:50:31Z
**Scope:** Revised committed `design.md` baseline at `2aa68ff2d4c8ea294259db650da4d1a9554d31cf`
**Files reviewed:** 12
**Commits:** `2aa68ff2d4c8ea294259db650da4d1a9554d31cf`

## Summary

The revision materially resolves the prior Claude identity, non-interactive JSON transport, exact-all Codex discovery, and receipt-bound activation findings, and it correctly records unauthenticated Claude as an implementation prerequisite rather than native success. It is not ready for planning because the mandatory Claude gate currently requires a cleanup operation that the installed CLI does not expose for the designed session class; three additional gaps leave aggregate preview work, execution-context drift, and post-success reconciliation under-specified.

Findings: 1 critical, 3 important, 0 medium, 0 minor

## Findings

### Critical

- **The mandatory Claude gate cannot reach `passed` under its cleanup contract** (`.oat/projects/synced/coding-session-handoff/design.md:440`)
  - Issue: The design requires the verifier to delete every disposable provider session through provider-owned cleanup commands and makes any cleanup failure `inconclusive`, which blocks matrix activation (`design.md:440-444`; receipt schema at `design.md:384-389`). Current Claude Code 2.1.251 help exposes `claude rm <id>` only for a background session, while the designed successor is a persisted `--print --resume ... --fork-session --session-id ...` conversation (`design.md:404-411`). No documented command deletes that session class, and direct transcript/store deletion is correctly forbidden. Consequently, the required Claude successor could prove identity/cwd/resumability yet still never produce an activatable receipt. The sequence also says evidence is hashed before cleanup even though cleanup outcomes enter the receipt, leaving the final digest boundary ambiguous.
  - Fix: Define exact provider-supported fixture creation, resumability-probe, and cleanup argv for each provider. For Claude, either validate a documented lifecycle that exercises the same successor semantics and supports deletion, or add a non-failing `retained-provider-owned`/`cleanup-unsupported` receipt state and disclose the residual disposable sessions as an irreversible limitation. Never unlink provider stores directly. Finalize all cleanup outcomes before atomically writing and hashing the final receipt.
  - Requirement: FR6, FR8, NFR3

### Important

- **Preview has per-file limits but no aggregate batch bound** (`.oat/projects/synced/coding-session-handoff/design.md:186`)
  - Issue: The new quiet tail reader caps each selected transcript at 2 MiB/10,000 records, but repeated `--session` preview accepts an unbounded number of candidates and no aggregate preview byte, record, elapsed-time, candidate-count, or rendered-character limit is defined (`design.md:186-188`, `design.md:243-244`, `design.md:545-546`). The exact-all discovery ceiling can therefore feed a preview request whose total reads and output multiply the per-file cap thousands of times. This leaves the explicit aggregate-bound criterion in FR2 and bounded-resource contract in NFR5 only partially resolved.
  - Fix: Add hard aggregate preview limits (candidate count, input bytes/records, elapsed time, and rendered characters) and define deterministic fail/partial-preview semantics that never fall back to unbounded reads. Add multi-selection tests that cross each aggregate limit without leaking paths or returning an apparently complete comparison.
  - Requirement: FR2, NFR5

- **Behavioral authorization is not bound to the execution context that can run hooks** (`.oat/projects/synced/coding-session-handoff/design.md:335`)
  - Issue: A verified matrix entry is keyed only by provider, version, syntax fingerprint, and receipt digest (`design.md:335-345`), while the exact Codex command loads the normal host context (`design.md:398-402`). Current `codex exec fork --help` exposes hook-trust behavior, and this host has configured lifecycle hook groups; neither hook/config state nor a provider-supported isolation mode is part of the receipt, matrix lookup, plan digest, or execution revalidation. A gate can therefore pass in one context and remain executable after hooks/configuration change without version or help drift, even though unsafe contexts are required to defer.
  - Fix: Define a privacy-safe execution-context contract for Codex and bind it through `BehavioralGateReceipt`, `ProviderBehaviorContract`, the confirmation digest, and pre-execution revalidation. Prefer a provider-supported customization/hook isolation shape proven by the same gate; otherwise fingerprint the relevant executable/config/hook context without retaining contents and defer on mismatch or uninspectable state. Keep every dangerous approval/sandbox/hook-trust bypass flag forbidden.
  - Requirement: FR6, FR8, NFR3

- **An unresolved successful child is not recoverable from the batch outcome contract** (`.oat/projects/synced/coding-session-handoff/design.md:496`)
  - Issue: The plan knows Claude's requested child UUID and the target baseline, and execution parses a machine child ID, but `BatchOutcome` retains only the plan digest plus `ItemOutcome`; `ReportingOutcome.childNativeId` is optional for every status (`design.md:485-529`). The `reconcile` command accepts only source, target, and that batch outcome (`design.md:551`). If native status is `succeeded` or `indeterminate` while transcript corroboration is unresolved, the schema does not require retention of the expected/observed child selector or baseline evidence, so later reconciliation may be unable to identify the exact pair without forbidden recency/set inference. This also conflicts with the skill instruction to show an exact mapping for every native success (`design.md:644-647`) while FR9 permits native success with unresolved reporting.
  - Fix: Make outcomes discriminated by status and retain safe `expectedChildNativeId` and `observedChildNativeId` fields whenever they exist, independently from corroboration status. Define which fields are mandatory for `succeeded`, `indeterminate`, `mapped`, and `unresolved`, what exact evidence `reconcile` consumes, and when the skill reports a parsed-but-not-yet-corroborated child versus a verified mapping. Preserve the no-retry rule and do not retain raw provider output or transcript paths.
  - Requirement: FR8, FR9, NFR2

### Medium

None

### Minor

None

## Requirements/Design Alignment

**Evidence sources used:** complete `discovery.md`; complete revised `spec.md`; complete revised `design.md`; scaffolded `plan.md` and `implementation.md`; project `state.md`; prior design review artifact; current `src/transcript/core/runtimes.ts`; current `src/transcript/session-observer/lib/locate.ts`; current `src/transcript/export-session/sanitize.ts`; current `scripts/build-generated.mjs`; metadata-only current Codex hook configuration; installed Codex 0.151.0 and Claude Code 2.1.251 version/help/auth output.

### Prior Finding Disposition

| Prior finding | Status | Notes |
| --- | --- | --- |
| Claude exact child/lineage path | resolved | Predetermined Claude UUID, machine `session_id`, transcript/cwd corroboration, and an explicitly blocking live gate replace recency inference. |
| Interactive stdio versus JSON | resolved | Both providers use bounded non-interactive machine output through piped stdio, preserving one handoff JSON envelope. |
| Seven-day Codex cutoff | resolved | `recency=exact-all` bypasses the cutoff and fails closed when completeness budgets are crossed. |
| Whole-file/path-bearing transcript reads | partial | Quiet bounded prefix/tail readers resolve per-file and diagnostic issues, but preview still lacks aggregate batch limits. |
| Unauditable behavior activation | resolved | The receipt schema, digest/fingerprint binding, independent review, explicit phase task, and no-runtime-override rule make activation reviewable. |

### Requirements Coverage

| Requirement | Status | Notes |
| --- | --- | --- |
| FR1 | aligned | Exact-all provider-qualified discovery, direct-only current evidence, deterministic ordering, and all-or-error completeness are concrete. |
| FR2 | partial | Structural/privacy isolation and per-file bounds are concrete; aggregate multi-preview work/output remains unbounded. |
| FR3 | aligned | Qualified one/many/all selection rejects implicit, duplicate, unknown, and bare identifiers. |
| FR4 | aligned | Registered-worktree/common-dir identity, branch/HEAD/dirty evidence, freshness, and no Git transfer are concrete. |
| FR5 | aligned | Successor default, read-only plan, current-turn deferral, and unconditional v1 same-ID refusal are consistent. |
| FR6 | partial | Exact-version syntax and reviewed receipt activation are concrete, but unsupported Claude cleanup and unbound Codex execution context prevent a safe passing contract as written. |
| FR7 | aligned | Full plan display, canonical mutation-evidence digest, recomputation, and stale/mismatched confirmation refusal are defined. |
| FR8 | partial | Exact non-interactive successor argv and child parsing are concrete, but the live gate cannot activate Claude under its cleanup rule and Codex context safety is not revalidated. |
| FR9 | partial | Native/reporting separation, indeterminate status, and retry rules are sound; the serialized outcome lacks mandatory child selectors for later exact reconciliation. |
| FR10 | aligned | Public skill, v1 provider floor, generated runtime, docs/inventory/version, and unsupported-scope messaging are mapped. |
| NFR1 | aligned | Handoff bypasses persistent cache reads/writes and uses request-local read-only discovery/reconciliation. |
| NFR2 | aligned | Preview type isolation, bounded provider capture, path-free diagnostics, raw-output disposal, and the explicit local-only receipt boundary are coherent. |
| NFR3 | partial | Shell-disabled argv, digest freshness, and no-bypass rules are sound; gate cleanup and execution-context drift do not yet fail closed correctly. |
| NFR4 | aligned | One bundled generated Node 22 runtime from canonical TypeScript fits the current generated-output builder. |
| NFR5 | partial | Discovery/probe/Git/native/reconcile bounds are explicit; aggregate preview bounds are absent. |
| NFR6 | aligned | Focused/full tests, build parity, validation, smoke, docs/navigation, versioning, inventory, and provider-sync checks are mapped. |

### Extra Work (not in declared requirements)

No unrelated product scope. Provider-session cleanup is an optional gate-hygiene concern, but treating unsupported cleanup as a mandatory pass condition currently over-constrains the required product gate.

## Verification Commands

Run these after revising the design and during implementation:

```bash
git -C .oat/projects/synced/coding-session-handoff diff --check
rg -n "providerSessions|cleanup-unsupported|retained-provider-owned|aggregate.*preview|executionContextFingerprint|expectedChildNativeId|observedChildNativeId" .oat/projects/synced/coding-session-handoff/design.md
codex exec fork --help
codex delete --help
claude --help
claude rm --help
claude auth status --json
```

Provider help verifies only declared command shape. Exact Claude flag combination, target cwd, parent/child lineage, source resumability, metadata effects, hook/context isolation, and cleanup behavior still require the digest-confirmed disposable gates before either matrix entry becomes executable.

## Recommended Next Step

Run the `oat-project-review-receive` skill, revise the design for these findings, and repeat the independent design review before completing the design HiLL checkpoint.
