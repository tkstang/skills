---
oat_generated: true
oat_generated_at: 2026-08-31T01:34:03Z
oat_review_scope: design
oat_review_type: artifact
oat_review_invocation: auto
oat_project: /Users/thomas.stang/.codex/worktrees/d7d8/skills/.oat/projects/synced/coding-session-handoff
---

# Artifact Review: design

**Reviewed:** 2026-08-31T01:34:03Z
**Scope:** Committed `design.md` baseline at `f1bffba2590b4c6da0ced2ec2edf255311e2a095`
**Files reviewed:** 9
**Commits:** `f1bffba2590b4c6da0ced2ec2edf255311e2a095`

## Summary

The design is well aligned on Git safety, zero-persistence inspection, confirmation freshness, same-ID refusal, provider-owned mutation, generated runtime boundaries, and itemized outcomes. It is not ready for planning because the required Claude exact child mapping has no designed evidence path, and four additional gaps leave native JSON execution, exact-source completeness, transcript bounds/privacy, and live-gate activation underspecified or inconsistent with current source.

Findings: 1 critical, 4 important, 0 medium, 0 minor

## Findings

### Critical

- **The required Claude parent-to-child outcome has no exact lineage mechanism** (`.oat/projects/synced/coding-session-handoff/design.md:434`)
  - Issue: The data model says `forkedFromSessionId` is unavailable for Claude and maps a child only when a newly discovered candidate has an exact parent-ID match (`design.md:434-438`). Installed Claude Code 2.1.251 help promises that `--resume ID --fork-session` creates a new session ID, but it does not expose that ID as part of the declared invocation, and the design inherits provider stdio without parsing output. The design therefore has no algorithm that can satisfy FR8's exact child identity or FR9's exact lineage for Claude. This is left as an open question at `design.md:657`, while `design.md:659-661` correctly says an unobservable result blocks v1 and `design.md:663-664` immediately contradicts that by saying the questions do not block v1.
  - Fix: Resolve the Claude successor identity contract before design approval. Define and live-verify an exact mechanism—such as a validated provider-supported explicit child UUID invocation, or a stable read-only lineage field—and specify how target cwd and source resumability are corroborated without recency or set-size inference. If no exact mechanism exists, record the required product blocker. Split nonblocking same-ID writer questions from blocking successor/lineage questions and remove the contradictory nonblocking statement.
  - Requirement: FR6, FR8, FR9

### Important

- **Inherited interactive stdio cannot satisfy the declared JSON envelope** (`.oat/projects/synced/coding-session-handoff/design.md:293`)
  - Issue: Native execution requires an interactive provider TUI and declares `stdio: 'inherit'`, so provider output and terminal control traffic share the handoff CLI's stdout. The CLI nevertheless allows `execute ... [--json]` (`design.md:409-410`) and promises every successful command emits exactly one JSON object (`design.md:447-466`) with no raw provider output in results. A redirected machine-readable invocation is non-TTY and deferred; a TTY invocation can execute but contaminates stdout. Both contracts cannot hold simultaneously.
  - Fix: Specify separate result transports. Either reject `--json` for inherited-TTY execution and define a safe post-exit machine-result channel, or route the provider TUI to a dedicated controlling terminal/file descriptor while reserving stdout for one JSON envelope. Update the CLI schema, exit semantics, privacy rules, and tests so actual execution and machine-readable outcomes are both truthful.
  - Requirement: FR8, FR9, NFR2

- **The discovery API design silently retains the seven-day Codex cutoff** (`.oat/projects/synced/coding-session-handoff/design.md:116`)
  - Issue: `DiscoveryOptions` controls persistence only, so handoff discovery still calls the current `discover('codex', ...)`. That implementation ignores the target while scanning and drops every transcript older than `LOOKBACK_DAYS = 7` (`src/transcript/session-observer/lib/locate.ts:77`, `src/transcript/session-observer/lib/locate.ts:694-721`). FR1 requires every exact-source candidate, including idle or stale sessions. The design neither removes the cutoff for exact handoff discovery nor reports an incomplete result.
  - Fix: Add a handoff-specific exact-source scope to the shared seam (or a dedicated read-only function) that does not apply the recency cutoff to exact candidates. Define explicit entry/time/byte budgets and fail closed with an incomplete-discovery reason when the complete exact set cannot be established; never return a silently truncated set. Test an exact Codex session older than seven days alongside related/global records.
  - Requirement: FR1, NFR5

- **Shared record reuse violates the claimed work bounds and path-free diagnostics** (`.oat/projects/synced/coding-session-handoff/design.md:163`)
  - Issue: Discovery classification and preview reuse `readRecords`, which reads each whole transcript into memory before any round/character truncation (`src/transcript/core/runtimes.ts:636-643`). Malformed records also call `console.warn` with the full transcript path (`src/transcript/core/runtimes.ts:665-674`). The design instead claims existing bounded readers, bounded preview work, and no transcript paths in diagnostics (`design.md:419-421`, `design.md:500-501`, `design.md:521-529`). Output truncation after a whole-file read is not a resource bound, and the current warning path violates NFR2.
  - Fix: Design a bounded, quiet/redacted read seam for handoff discovery and preview. Specify per-file and aggregate byte/record/time limits, safe failure on oversize, and an injected diagnostic sink that emits reason codes without paths. Cover malformed and oversized transcripts in both discovery and preview tests; retain structural normalization and hidden-payload sanitization after bounded parsing.
  - Requirement: FR2, NFR2, NFR5

- **Behavioral verification can be activated without a reproducible evidence receipt** (`.oat/projects/synced/coding-session-handoff/design.md:285`)
  - Issue: `ProviderBehaviorContract` contains only exact version, two booleans, and a free-form `evidenceNote`. No gate command/API, receipt schema, syntax-fingerprint binding, bounded fixture lifecycle, evidence storage/redaction policy, or machine validation connects a reviewed live result to changing `unverified` into `verified`. The implementation phases end Phase 3 with live behavior “opt-in and unclaimed” (`design.md:697-711`) and assign no later phase task to run, review, and activate the matrix; only deployment prose mentions doing so. This permits an unauditable manual boolean flip and does not make the required exact-version gate reproducible.
  - Fix: Define a bounded live-gate entry point and a `BehavioralGateReceipt` schema containing provider, exact executable/version, normalized syntax fingerprint, operation, fixture roots, exact parent/child observations, target-cwd/source-resumability checks, metadata-effect disposition, bounds, and pass/fail reasons. State where sensitive exact IDs are reviewed without entering committed product output, bind the source-controlled matrix to a reviewed receipt digest and expected syntax fingerprint, and add an explicit implementation-phase task plus independent review step for activation.
  - Requirement: FR6, FR8, NFR3

### Medium

None

### Minor

None

## Requirements/Design Alignment

**Evidence sources used:** complete `discovery.md`; complete `spec.md`; draft `design.md`; scaffolded `plan.md` and `implementation.md`; project `state.md`; current `src/transcript/core/runtimes.ts`; current `src/transcript/session-observer/lib/locate.ts`; current `scripts/build-generated.mjs`; installed Codex 0.151.0 and Claude Code 2.1.251 help.

### Requirements Coverage

| Requirement | Status | Notes |
| --- | --- | --- |
| FR1 | partial | Provider qualification/current evidence are sound, but current Codex discovery silently excludes exact candidates older than seven days. |
| FR2 | partial | Serialization isolation and sanitization are sound; whole-file reads and path-bearing warnings violate bounds/privacy. |
| FR3 | aligned | Qualified one/many/all selection, mutual exclusion, and no recency/bare-ID selector are concrete. |
| FR4 | aligned | Canonical registered-worktree/common-dir identity, dirty evidence, freshness, and no transfer are concrete. |
| FR5 | aligned | Successor default, plan semantics, current-turn deferral, and unconditional v1 resume refusal are internally safe. |
| FR6 | partial | Syntax/version probing is concrete, but the required Claude behavior path and auditable live-gate activation contract are absent. |
| FR7 | aligned | Canonical digest projection, full recomputation, and stale/mismatched confirmation refusal are defined. |
| FR8 | partial | Provider argv shapes are accurate, but Claude child recovery and interactive JSON result transport are unresolved. |
| FR9 | partial | Native/reporting separation and retry rules are strong; exact Claude reporting cannot yet be produced. |
| FR10 | aligned | Public skill, generated runtime, docs/inventory/version, and unsupported-scope messaging are mapped. |
| NFR1 | aligned | Cache reads and writes are explicitly bypassed under an additive default-preserving seam. |
| NFR2 | partial | Schema isolation is strong, but current reader warnings leak transcript paths and inherited provider stdout conflicts with JSON isolation. |
| NFR3 | partial | Shell-disabled argv and fail-closed policy are concrete; live behavior activation lacks a validated evidence binding. |
| NFR4 | aligned | A bundled Node 22 output from canonical TypeScript fits the current generated-output builder. |
| NFR5 | partial | Probe/Git/input caps are defined; transcript scans and reads are not bounded and completeness behavior is unspecified. |
| NFR6 | aligned | Repository build, validation, docs, versioning, inventory, and provider-sync surfaces are mapped. |

### Extra Work (not in declared requirements)

None

## Verification Commands

Run these after revising the design:

```bash
git -C .oat/projects/synced/coding-session-handoff diff --check
rg -n "Claude.*child|session-id|BehavioralGateReceipt|evidence.*digest|syntax.*fingerprint|controlling terminal|result.*fd|LOOKBACK_DAYS|all exact|diagnostic sink|byte.*limit" .oat/projects/synced/coding-session-handoff/design.md
rg -n "LOOKBACK_DAYS|cutoffSec|readFile\(transcriptPath|console\.warn" src/transcript/session-observer/lib/locate.ts src/transcript/core/runtimes.ts
codex fork --help
codex resume --help
claude --help
```

The help commands verify command shape only. Exact child identity, TTY/result transport, cwd, resumability, and metadata behavior still require the bounded disposable gate defined by the revised design.

## Recommended Next Step

Run the `oat-project-review-receive` skill, revise the design for these findings, and repeat the independent design review before completing the design HiLL checkpoint.
