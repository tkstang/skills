---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-09-20
oat_generated: true
oat_summary_last_task: p06-t09
oat_summary_revision_count: 0
oat_summary_includes_revisions: []
---

# Summary: agent-messaging

## Overview

This project added provider-neutral, addressable messaging for three or more
local sessions across repositories and worktrees. Targeted peer communication
remains distinct from transcript observation, bounded by exact identity and
explicit authority, and durable in inspectable state.

## What Was Implemented

- A dependency-free collaboration runtime and `agent-messaging` skill now manage
  flat collaboration membership, explicit alias takeover, immutable per-recipient
  messages, explicit acknowledgments, and an authoritative append-only log with a
  regenerable Markdown view.
- Finite activation epochs, event/message/slot claims, expiry, revocation,
  departure, closure, and bounded continuation budgets make automatic delivery
  recoverable without a collaboration-wide lock.
- Codex prompt/Stop and Claude prompt/Stop/watch adapters fail closed around exact
  identity, current membership, ownership, and inventory. A finite foreground
  Claude Monitor composes inbox and optional observation wakes under one budget;
  Cursor retains documented fallback where live boundaries are unproven.
- Observer collaboration shares the container while public observation offsets,
  private continuation cursors, and recipient acknowledgments stay distinct.
  Shared ownership and inventory primitives live under `src/shared/collaboration/`.
- Canonical skills, generated standalone and plugin payloads, documentation,
  release guidance, changelog entries, and packaging proofs were aligned.
- Phase 6 repaired lifecycle, input, packaging, and Linux stdin issues. Final
  validation passed 2,341 tests (1 skipped); PR CI passed with a clean merge state.

## Key Decisions

- **Filesystem mailbox transport.** The shared local filesystem is the transport;
  adapters read the same durable inbox rather than introducing a daemon, network
  service, database, or harness-native queue. This keeps messaging usable across
  local repositories and worktrees with no runtime install step, while limiting
  v1 to one machine and supported local filesystems.
- **Stateful work requires exact identity.** Aliases remain readable labels, but
  every stateful operation binds exact runtime/session identity, participant, and
  generation. Ambiguous or replaced identities fail visibly; takeover is explicit,
  logged, and preserves pending mail without silently redirecting an alias.
- **Immutable message records.** Messages, acknowledgments, claims, bindings, and
  log entries publish as complete no-clobber records with idempotent same-ID retry.
  Acknowledgment proves receipt of exact content, not delivery, action, completion,
  or authorization; uncertain commits remain inspectable and retryable.
- **Bounded lifecycle continuation.** Automatic attention requires explicit finite
  activation, expiry, exact boundary checks, and an unreusable continuation budget.
  Peer messages never renew human supervision, and restart or exhaustion requires
  explicit re-enable or re-arm.
- **Separate observation and collaboration cursors.** Inbox requests take priority
  over optional transcript catch-up and share its continuation budget, but public
  observation offsets, lease-private continuity, and message acknowledgments never
  advance one another implicitly.
- **Single continuation owner.** Observer and messaging integrations coexist only
  when ownership is proved or explicitly acknowledged. The Claude composed Monitor
  owns one finite wake loop; uncertain or conflicting owners fail closed.
- **Keep verification claims narrow.** Deterministic fixtures and generated-bundle
  execution prove repository behavior, not live installation, provider discovery,
  credentials, host delivery, release, or publication. Those boundaries retain
  separate authorization and evidence requirements.

## Design Deltas

- A session visibility rule was misread as requiring another worktree. The user
  corrected it; implementation and the amended run record stayed in `backlog-triage`.
- Ownership policy was narrowed during review: recognized but dormant observer
  hooks can coexist, scoped third-party hook inventory requires explicit
  acknowledgment, and Claude standalone delivery requires an acting-session
  attestation when automatic Monitor ownership cannot be discovered.
- Claude composition moved from an implicit path to a finite foreground Monitor
  with bounded inventory, shared wake budget, disarm recovery, and required re-arm.

## Notable Challenges

- Reviews exposed ownership ambiguity, symlinked-entrypoint failures, incomplete
  Claude inventory, lease-boundary drift, and missing critical-path proofs. Twelve
  Phase 5 tasks repaired every blocking finding before the final gate passed.
- After a stale fixture repair, Linux CI exposed non-portable `/dev/stdin`
  reopening. Hooks now consume inherited stdin and generated bundles reran.
- Concurrency and crash recovery required deliberately distinguishing publication,
  notification attempt, acknowledgment, reply, and completed action rather than
  presenting a false exactly-once delivery guarantee.

## Tradeoffs Made

- The implementation prefers complete immutable records and refusal over mutable
  convenience. Crashes may conservatively replay mail or spend a continuation
  opportunity, but cannot invent acknowledgments or silently overwrite state.
- Enumeration, message size, activation lifetime, and continuation count are
  bounded. Capacity recovery is explicit inspection and cleanup, never silent
  truncation or deletion.
- Automatic wake support is claimed per proven host boundary. Unsupported or
  unverified paths remain manual rather than inferring capability from static
  package parity.

## Integration Notes

- Shipped runtime requires Node 22 or newer and uses only Node standard-library
  APIs. Canonical sources live under `src/shared/collaboration/`,
  `src/skills/agent-messaging/`, and `src/skills/session-observer-collab/`; generated
  distributions must be refreshed through the repository build.
- All participants must resolve the same absolute collaboration root. The existing
  XDG default and `SESSION_OBSERVER_STATE_DIR` override remain authoritative, and
  setup/status expose the resolved paths.
- Messages are peer text, not user authorization or source-ownership grants.
  Enabling delivery does not authorize concurrent edits, installation, provider
  configuration, publication, or release.

## Follow-up Items

- `BL-260619-inter-agent-direct-messaging` is closed and archived after the
  deterministic implementation and final review passed.
- `BL-260919-verify-live-agent-messaging` owns live acceptance; repository and PR
  verification did not authorize provider calls, hooks, release, merge, or live hosts.

## Explainer Outcome

- **project-recap:** skipped — interactive completion choice.

## Workflow Observations

### 2026-09-19 · structural · oat gate review · plan

target=claude-fable-skip-permissions threshold=important findings=critical:0,important:0,medium:3,minor:4 exit=0 status=ok artifact=.oat/projects/shared/agent-messaging/reviews/artifact-plan-review-2026-09-19T014304Z.md run=f1bc5e2e-4077-4485-925e-6fc98bc9df59

### 2026-09-19 · structural · oat gate review · plan

target=claude-fable-skip-permissions threshold=important findings=critical:0,important:0,medium:2,minor:2 exit=0 status=ok artifact=.oat/projects/shared/agent-messaging/reviews/artifact-plan-review-2026-09-19T021241Z.md run=a5a5f137-5011-4d64-81af-c4db88d3f3e7

### 2026-09-19 · structural · oat gate review · plan

target=claude-fable-skip-permissions threshold=important findings=critical:0,important:1,medium:1,minor:2 exit=1 status=blocked artifact=.oat/projects/shared/agent-messaging/reviews/artifact-plan-review-2026-09-19T030934Z.md run=09f3c2b9-f6ec-4cda-91f4-966ba80a9f20

### 2026-09-19 · structural · oat gate review · plan

target=claude-fable-skip-permissions threshold=important findings=critical:0,important:1,medium:1,minor:3 exit=1 status=blocked artifact=.oat/projects/shared/agent-messaging/reviews/artifact-plan-review-2026-09-19T125014Z.md run=c94b55d0-0138-409d-aca6-ed4703fa8c99

### 2026-09-19 · structural · oat gate review · plan

target=claude-fable-skip-permissions threshold=important findings=critical:0,important:0,medium:2,minor:2 exit=0 status=ok artifact=.oat/projects/shared/agent-messaging/reviews/artifact-plan-review-2026-09-19T131345Z.md run=94c9a069-05df-4541-84ef-5b56f699c674

### 2026-09-19 · structural · oat-project-implement · p01

p01 blocked after final review: verdict=blocking findings=0-critical/3-important/0-medium/0-minor review-cycles=3/3 fix-rounds=2/2 artifact=reviews/code-p01-final-review-2026-09-19T152245Z.md id=p01-final-review-057cc67a

### 2026-09-19 · structural · oat-project-implement · p01-override

p01 resumed by explicit user authorization for one additional bounded correction and fresh review; scope=3-important-findings artifact=reviews/code-p01-final-review-2026-09-19T152245Z.md retry-limit=3 id=p01-extra-fix-authorized-20260919

### 2026-09-19 · structural · oat-project-implement · p01

p01 accepted after user-authorized review: verdict=pass findings=0-critical/0-important/1-medium/0-minor review-cycles=4 fix-rounds=3 recovery-attempts=3 artifact=reviews/code-p01-authorized-review-2026-09-19T161151Z.md supersedes-blocked-outcome=p01-final-review-057cc67a id=p01-pass-d3cd0e9c

### 2026-09-19 · structural · oat-project-implement · p02-review-round-1

p02 review round 1 used two reconnaissance waves and returned 0-critical/7-important/1-medium/0-minor; artifact=reviews/code-p02-review-2026-09-19T172855Z.md id=p02-review-r1-a54d9baf

### 2026-09-19 · structural · oat-project-implement · p02-review-round-2

p02 review round 2 used bounded reconnaissance and passed with 0-critical/0-important/2-medium/0-minor; artifact=reviews/code-p02-rereview-2026-09-19T181232Z.md id=p02-review-r2-14f26df4

### 2026-09-19 · structural · oat-project-implement · p02

p02 accepted: verdict=pass findings=0-critical/0-important/2-medium/0-minor review-cycles=2 fix-rounds=1 recovery-attempts=0 artifacts=reviews/code-p02-review-2026-09-19T172855Z.md,reviews/code-p02-rereview-2026-09-19T181232Z.md id=p02-pass-14f26df4

### 2026-09-19 · structural · oat-project-implement · p03-review-round-1

p03 review round 1 used two bounded reconnaissance lanes and returned 0-critical/2-important/2-medium/0-minor; artifact=reviews/code-p03-review-2026-09-19T190153Z.md id=p03-review-r1-d6bd6d6a

### 2026-09-19 · structural · oat-project-implement · p03-review-round-2

p03 review round 2 used one completed runtime lane plus inline deterministic coverage and returned 0-critical/1-important/0-medium/0-minor; artifact=reviews/code-p03-rereview-2026-09-19T192712Z.md id=p03-review-r2-8e461d89

### 2026-09-19 · structural · oat-project-implement · p03

p03 accepted: verdict=pass findings=0-critical/0-important/0-medium/0-minor review-cycles=3 fix-rounds=2 recovery-attempts=0 artifacts=reviews/code-p03-review-2026-09-19T190153Z.md,reviews/code-p03-rereview-2026-09-19T192712Z.md,reviews/code-p03-final-review-2026-09-19T194903Z.md id=p03-pass-d1b3fe16

### 2026-09-19 · structural · oat gate review · final

target=claude-fable-skip-permissions threshold=important findings=critical:0,important:3,medium:5,minor:4 exit=1 status=blocked artifact=.oat/projects/shared/agent-messaging/reviews/final-review-2026-09-19T204112Z.md run=aafd4a07-bf15-4b25-b1c9-c8ef9dd405ac

### 2026-09-19 · structural · oat gate review · final

target=claude-fable-skip-permissions threshold=high findings=critical:0,high:0,medium:1,low:4 exit=0 status=ok artifact=.oat/projects/shared/agent-messaging/reviews/final-review-2026-09-19T214803Z.md run=a8fe7ad5-7fb7-4c42-b245-dc67d1ef7944

### 2026-09-20 · structural · oat-project-retro · project-retro

retro artifact=.oat/projects/shared/agent-messaging/references/project-retro.md evidence_used=archived-review-markdown,code-and-commit-history,gate-receipts,github-pr-state,implementation-session-transcript,lifecycle-artifacts,planning-session-transcript,project-log evidence_unavailable=oat-execution-learnings promotions=0 upstream=2 apply=skipped filing=deferred
