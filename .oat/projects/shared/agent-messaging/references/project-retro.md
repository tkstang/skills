---
oat_retro_project: agent-messaging
oat_retro_generated: '2026-09-20T13:33:08Z'
oat_retro_evidence_sources:
  - source: project-log
    status: used
  - source: oat-execution-learnings
    status: unavailable
  - source: lifecycle-artifacts
    status: used
  - source: archived-review-markdown
    status: used
  - source: gate-receipts
    status: used
  - source: planning-session-transcript
    status: used
  - source: implementation-session-transcript
    status: used
  - source: code-and-commit-history
    status: used
  - source: github-pr-state
    status: used
oat_retro_promotions: none
oat_retro_filing: proposed
oat_generated: true
oat_template: false
---

# Project Retrospective: agent-messaging

## Executive Summary

Agent Messaging shipped as a dependency-free local mailbox for three or more
exact coding-agent sessions, with immutable records, explicit acknowledgments,
finite delivery, and one continuation owner when observation is composed. The
result is trustworthy because independent reviews repeatedly found real
correctness, packaging, proof, and platform gaps, each of which was converted
into bounded tasks and verified before PR #98 became green and mergeable.

The main workflow lesson is that late review and CI repair phases can outlive
post-implementation summary and documentation receipts. OAT should detect that
freshness loss while preserving the separate terminal-approval boundary. A
second lesson is that conditional worktree-visibility guidance must not be
interpreted as a requirement to leave the user's chosen worktree.

## Evidence and Review Method

The review used the append-only project log, lifecycle artifacts, archived plan
and code reviews, gate receipts, PR receipt, accepted decision records, commit
history, and live GitHub PR state. The original planning transcript
`01a0b699-43c0-74e2-9353-b52f70a00f36` and implementation transcript
`01a0b9d9-f4b3-72f1-bbf3-4b1731ae2dd4` supplied operator corrections and
authorization boundaries. Durable artifacts and committed receipts outrank
transcript command mentions when tool-result bodies are incomplete.

`oat-execution-learnings.md` was unavailable. No claim depends on it. All
causes below are confirmed by durable evidence unless explicitly labeled as a
hypothesis.

## Outcome Snapshot

| Area         | Generation-time result                                                                                                                                                                         |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product      | Addressed local messaging, exact membership and takeover, receipts, immutable logs, finite activation, bounded host adapters, and observer composition shipped in standalone and plugin forms. |
| Verification | Phase reviews, two final gates, Phase 6 review, generated-bundle execution, 2,341-test clean-worktree validation, docs build, and PR CI passed.                                                |
| Lifecycle    | 34/34 implementation tasks completed; PR #98 was open, clean, and mergeable at remote head `76d93a00`; final OAT lifecycle approval was still pending.                                         |
| Boundaries   | Live installation, provider discovery, host delivery, release, merge, and global installation were not established by repository tests.                                                        |
| Follow-up    | `BL-260919-verify-live-agent-messaging` owns separately authorized live-host acceptance.                                                                                                       |

## Current State

- **Promotions:** None; no RP apply-items exist.
- **Filing:** Proposed; UP-01 and UP-02 are eligible for the configured OAT upstream issue destination.
- **Unsettled items:** UP-01 and UP-02 require an `oat-project-retro-file` decision.

## What Went Well

- The product boundary stayed narrow. Accepted decisions
  `DR-260919-filesystem-mailbox-transport`,
  `DR-260919-immutable-message-records`, and
  `DR-260919-single-continuation-owner` kept runtime dependencies, authority,
  persistence, and continuation ownership explicit.
- The review loop was allowed to change the proof, not merely the prose. The
  first final gate found symlinked entrypoints that silently exited, an unusable
  Claude inventory path, and an under-tested Monitor. Phase 5 added twelve
  repairs; the second gate independently executed real, symlinked, and
  space-containing generated bundles.
- The project consistently separated deterministic repository evidence from
  live-provider evidence. The original backlog item closed only for the shipped
  implementation, while live host acceptance moved to a dedicated item.
- Remote feedback was dispositioned rather than accepted mechanically. Phase 6
  qualified stale lifecycle and backlog suggestions, fixed the valid product
  findings, replied with commit receipts, and reached zero unresolved bot
  threads before the PR was declared mergeable.
- The post-review documentation pass caught and fixed stale PJM versions and a
  Session sidebar omission in commits `e56b3d47` and `2f3b60c8`, with a green
  58-route production docs build.

## Challenges and Struggles

### Shared-storage correctness required more review depth than the initial phase budget

Phase 1 reached its configured review limit while authoritative reads could
follow intermediate symlinks, record classification depended on unrelated root
path segments, and `open` could not retry its own partial commit. Those defects
could escape the configured state root or defeat crash recovery even though the
planned suite was green. The user explicitly authorized one additional bounded
repair and fresh review. Commits `50455dca` and `bd5f5d76` closed the defects,
and the authorized review passed at `d3cd0e9c` (`project-log` entries
`p01-final-review-057cc67a`, `p01-extra-fix-authorized-20260919`, and
`p01-pass-d3cd0e9c`).

### Green repository gates did not prove installed entrypoints or declared acceptance

The first final gate reproduced three Important gaps after 2,225 tests had
passed: installed symlink entrypoints silently no-op'd, Claude's inventory
could not be supplied through the documented path, and the composed Monitor's
declared verification matrix had not actually run. Phase 5 added executable
generated-install tests, real inventory boundaries, and critical-path Monitor
proof. The second final gate then found a documented `--root` workflow that
split observer and messaging state; the judgment sweep fixed it in
`dd22025c`. This confirmed that package freshness and source-level tests are
necessary but insufficient for an installed CLI contract.

### Remote Linux CI exposed a different stdin contract

Local hook tests did not reproduce Linux socket-backed child stdin. PR
validation showed that reopening `/dev/stdin` could fail before the Stop hook
read its payload. Phase 6 changed the canonical Codex and Cursor hooks to
consume `process.stdin` directly, regenerated distributions, and independently
verified the generated hook forms in `a4e40504`. The PR then passed every
Validate and Docs CI job.

### Later repair phases made earlier completion artifacts stale

The summary was generated after Phase 5 with
`oat_summary_last_task: p05-t12`, then remote review added Phase 6 and nine more
tasks. State and implementation tracking correctly reached 34/34, but the
summary still described the original 25-task boundary and older test totals.
Likewise, documentation was already marked complete before Phase 6 changed
runtime behavior and project prose. A deliberate documentation rerun found no
substantive behavior gap but did find stale PJM versions and sidebar navigation.
This is not evidence that the later work failed; it is evidence that OAT needs
freshness invalidation for derived artifacts.

## Decision Register

| Decision                                 | Rationale                                                                                                   | Consequence                                                                                               |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `DR-260919-filesystem-mailbox-transport` | Local collaboration needed to work across repositories without a daemon, service, or transcript dependency. | V1 is dependency-free and inspectable, but intentionally one-machine and filesystem-bound.                |
| `DR-260919-immutable-message-records`    | Concurrent senders and crashes must not overwrite data or invent acknowledgments.                           | Same-ID retry is deterministic; enqueue, presentation, acknowledgment, reply, and action remain distinct. |
| `DR-260919-single-continuation-owner`    | Messaging and observation could otherwise create competing wake loops.                                      | One bounded owner shares the continuation budget; uncertain or changed ownership fails closed.            |
| Separate live acceptance backlog         | Repository tests cannot prove install, trust, invocation, context delivery, or cleanup.                     | `BL-260919-verify-live-agent-messaging` owns those authorization-gated receipts.                          |

## Rejected or Superseded Alternatives

- A daemon, MCP server, network service, managed database, and harness-native
  queue were rejected for the first release because they expanded the runtime
  and deployment contract without being necessary for local coordination.
- Messaging was separated from transcript observation. The observer's N=2
  stateful topology does not limit N>=3 addressed mail.
- Always-on delivery was superseded by collaboration-scoped finite activation,
  explicit expiry, and manual turn-start/attempted-stop fallback.
- Exactly-once action claims were rejected. Immutable attempt and receipt
  evidence cannot prove that an agent completed requested work.
- A separate implementation worktree was superseded by the user's explicit
  direction to use the existing `backlog-triage` worktree.

## Where We Changed Course

- The user replaced vague "next continuation" language with explicit
  turn-start and attempted-stop checks, then limited automatic handling to an
  enabled collaboration. The design and docs adopted those lifecycle terms.
- The user confirmed messaging must work without observation and support three
  or more participants. The architecture moved from observer-adjacent transport
  to a standalone mailbox that can optionally compose with observation.
- Gate findings turned an implicit Claude observation path into a dedicated
  finite composed Monitor with one shared wake budget and explicit ownership
  attestations.
- The user corrected an unnecessary new-worktree interpretation. Implementation
  remained in the current checkout and recorded that override before source
  work continued.
- Remote CodeRabbit and CI evidence added Phase 6 after the apparent closeout.
  The project reopened implementation tracking without pretending terminal
  lifecycle approval had occurred.

## New Architecture Patterns and Approaches

- **Immutable authority, regenerable views.** Membership, messages,
  acknowledgments, claims, and log entries are authoritative immutable files;
  `collaboration.md` is rebuildable presentation.
- **Event claim, slot, then resource claim.** Automatic attention is bounded by
  non-reusable slots while per-message or observer compare-and-swap claims
  decide what may actually be emitted. A crash may waste opportunity but cannot
  exceed the cap or invent receipt.
- **Reciprocal composition proof.** Messaging activation and observer lease must
  agree on exact owner, peer, collaboration, activation, controller, and
  mechanism. One matching record is not enough.
- **Evidence matrices as product state.** Documented, fixture-tested, installed,
  trusted, invoked, recipient-observed, continued, and cleaned-up are separate
  claims rather than one supported/unsupported flag.

## Domain Learnings

- Filesystem safety includes every ancestor and every read path, not just final
  write destinations. Root-relative record classification prevents legal parent
  directory names from changing semantics.
- A generated entrypoint's real and symlinked invocation paths are part of the
  runtime contract. Source imports and build freshness do not cover main-guard
  behavior.
- Pipe-backed stdin is a platform contract. Reopening a pseudo-path is not
  equivalent to consuming the inherited stream.
- Documentation commands that coordinate multiple state roots are executable
  interfaces. Tests should run the exact documented sequence with a non-default
  root, not only inspect command strings.
- Late review fixes can invalidate summaries and docs receipts even when their
  original generation was correct.

## Gotchas for Humans

- A green repository suite does not authorize live hooks, provider calls,
  installation, release, or merge. Review the evidence tier and approval scope.
- Share both the collaboration UUID and resolved external state root; never
  infer identity or routing from cwd, alias recency, or a transcript guess.
- Peer messages are untrusted context, not user authorization or permission for
  concurrent edits.
- A separate worktree is optional unless the plan or operator explicitly
  requires one. If one is used, this repository requires a visible Codex task.
- After any post-summary repair phase, rerun summary/document workflows or
  explicitly record why their earlier receipts are still fresh.

## Gotchas for Autonomous Agents

- Preserve exact-session identity and fail closed on ambiguous bindings,
  ownership, inventory, schema, or state roots. Do not substitute cwd or newest
  session heuristics.
- Treat project reviews as executable evidence requests. When a plan names
  generated-install, symlink, crash, or multi-command verification, execute
  those paths rather than infer coverage from adjacent tests.
- Do not collapse enqueue, output attempt, acknowledgment, reply, and completed
  action into one delivery status.
- Reconcile current `origin/main`, PR checks, unresolved review threads, and
  generated artifacts after remote feedback; a previously clean snapshot can
  become conflicting or stale.
- Keep implementation-phase completion distinct from terminal lifecycle
  approval, merge, release, installation, and live acceptance.

## Repo Improvements (Promotion Register)

No new repo improvement is proposed. The concrete repository gaps found during
this pass were already settled by `e56b3d47` and `2f3b60c8`, or are already
owned by `BL-260919-verify-live-agent-messaging` and accepted decision records.

## OAT Upstream Feedback (Upstream Register)

### UP-01: Invalidate derived project artifacts after later repair phases

- **Status:** proposed
- **Destination:** —
- **Destination-receipt:** —
- **Remote-visibility:** —
- **Sanitized:** yes
- **Disposition-note:** —

When review, CI, or remote feedback adds tasks after summary/document/PR
closeout, OAT should mark the affected derived artifacts stale or record the
new freshness head. A rerun should be suggested before completion. The check
must preserve the distinction between completed implementation phases and
pending terminal approval. Evidence: this project generated its summary at
`p05-t12`, then completed nine Phase 6 tasks and a newer validation/PR cycle
while the summary still reported the original 25-task and test boundary.

### UP-02: Keep conditional worktree visibility separate from worktree selection

- **Status:** proposed
- **Destination:** —
- **Destination-receipt:** —
- **Remote-visibility:** —
- **Sanitized:** yes
- **Disposition-note:** —

OAT implementation guidance should not infer that a separate worktree is
mandatory from a rule that only governs visibility when a separate worktree is
chosen. Resolve an explicit project/operator worktree choice first; if the
current worktree is selected, record that override and proceed without creating
a duplicate task. Evidence: this run paused until the operator corrected the
inference and explicitly selected the existing worktree, after which the full
implementation completed there.

## Remaining Boundaries and Follow-Ups

- Final OAT lifecycle approval is still pending; the project must not be labeled
  complete merely because implementation, review, docs, and PR preparation ran.
- PR #98's remote head was `76d93a00` and green/mergeable when checked during
  this retro. The documentation and retro commits created afterward are local
  until separately pushed and revalidated.
- `BL-260919-verify-live-agent-messaging` remains the sole owner of authorized
  live Codex/Claude/Monitor acceptance. Passing fixtures must not upgrade those
  evidence tiers.
- UP-01 and UP-02 remain proposals until `oat-project-retro-file` files or
  rejects them.

## Reflections

The project succeeded because it made uncertainty visible: immutable records
instead of mutable queue lore, finite budgets instead of wake promises, exact
identity instead of recency, and evidence columns instead of a single support
label. The same discipline should apply to workflow artifacts. A summary or
docs receipt is evidence for a specific head, not a permanent truth after later
repair phases.

Future projects with provider entrypoints should put installed-path execution,
documented multi-command workflows, platform stdin behavior, and freshness
invalidation into the proof plan early. Independent review remains valuable
when it can run those contracts rather than merely re-read passing tests.
