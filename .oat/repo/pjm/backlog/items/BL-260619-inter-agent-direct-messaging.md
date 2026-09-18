---
id: BL-260619-inter-agent-direct-messaging
title: Inter-agent direct messaging (addressable, prioritized)
status: open
priority: medium
scope: feature
scope_estimate: M
labels:
  - multi-agent
  - substrate
  - messaging
assignee: null
created: 2026-06-19T23:57:18Z
updated: 2026-09-18T22:56:46Z
associated_issues: []
legacy_id: bl-f59f
---

## Description

Provider-neutral **addressable, agent-to-agent messages**, distinct from passive
transcript observation. The first scope is a project/worktree-scoped recipient
inbox supporting three or more participating agent sessions. Messaging works
with transcript observation disabled; when observation is enabled, targeted
signal precedes ambient peer catch-up. No merged log, daemon, or particular
agent harness is required.

**Vault source note:** `02 - Projects/Skills/Ideas/2026-06-19-inter-agent-messaging.md`

**Design gate:** evaluate Agent Mail and the original vault prior art against
the dependency-free, provider-neutral inbox contract before choosing build vs
adopt. Define project/worktree identity, alias resolution, concurrent append or
atomic publication, acknowledgment meaning, deduplication, expiry, and recovery.
An enqueue acknowledgment is not proof that a recipient read or acted on it.

**Dependencies:** identity and state conventions must be defined within this
project and coordinated with **BL-260619-shared-session-log-substrate — Stateless
multi-session activity merge**. Neither implementation blocks the other. The
June daemon-first proposal is historical input, not the current build order.

**Design direction (updated 2026-09-18):** build a provider-neutral inbox with one
append-only JSONL message log per recipient, addressed by the `whoami` identity
(`runtime:sessionId`) plus a user-assigned alias. Each recipient owns its
acknowledgments and deduplication state; concurrent senders must not corrupt or
lose messages. Three-or-more-agent messaging is in scope for v1 and does not
depend on transcript observation or the separate N>2 observer-mesh project.
Messages remain peer text, never instructions with elevated authority or user
authorization; malformed or replayed envelopes fail closed.

## Activation and delivery

Check inboxes at the start of each agent turn and when the agent attempts to
stop, with host-specific adapters verifying the available boundaries and
context-delivery behavior. Start means a turn boundary, including resumed or
follow-up turns, not only session creation. Installed hooks return immediately
unless collaboration is enabled for the exact session and project. Each
participant has its own expiry and bounded continuation budget.

Joining a messaging collaboration does not start a transcript watcher or
require access to peer transcripts. With observation enabled, inbox checks
precede transcript catch-up and share the existing continuation budget rather
than creating a competing continuation loop. Without supported automatic hook
delivery, disclose manual inbox checks as the fallback. Messages arriving after
a bounded stop wait remain queued until the next check; no idle-session wake
capability is implied. Safe N>2 transcript observation remains separate work.

## Shared collaboration storage

The messaging project also standardizes storage for the existing agent-written
append-only collaboration log. Keep message inboxes, acknowledgments, and that
Markdown log together in one project/collaboration directory under the existing
collaboration state root: `$XDG_STATE_HOME/session-observer/collab/`, defaulting
to `~/.local/state/session-observer/collab/`. Preserve the existing explicit
`SESSION_OBSERVER_STATE_DIR` override. This refines the earlier shared-project
directory proposal: state is scoped to a project but stored outside the source
tree and Git metadata, not in a temporary directory.

All participants must resolve the same directory across worktrees. Project
identity and the exact subdirectory layout remain design work. Setup/status
must expose the resolved directory and log path so agents and the engineer can
find the records without choosing an ad-hoc log location.

The Markdown log remains the agent-written record of observations, assessments,
and decisions; recipient JSONL inboxes contain addressed messages and their IDs.
They share a location, not a file format or acknowledgment semantics. Native
provider transcripts remain in their existing stores. Update the canonical
`session-observer-collab` instructions and user guide to use the resolved log
path. Historical agent-created logs are not automatically moved or deleted.
Ending or expiring collaboration disables delivery; retained history is removed
only through explicit cleanup or a defined retention policy.

## Acceptance Criteria

- Build-vs-adopt decision recorded: a provider-neutral append-only JSONL inbox per recipient under the shared project-scoped collaboration state directory outside source control; no harness-native transport (Claude-to-Claude, Orca) and no daemon.
- Messages, acknowledgments, and the agent-written collaboration Markdown log share one resolved project/collaboration directory under the existing XDG collaboration root (or its explicit override), accessible to all participating worktrees. Setup/status exposes that directory and log path.
- Canonical `session-observer-collab` instructions and user-facing documentation use that shared log location; affected skill versions and generated distributions are updated and verified. Historical logs and native provider transcripts are not silently relocated or deleted.
- Addressing uses the `whoami` identity (`runtime:sessionId`) plus a user-assigned alias; any harness that can write a file can send, any that can read one can receive.
- Three or more agent sessions can exchange addressed messages with transcript observation disabled. Each recipient owns its inbox consumption and acknowledgment state; one recipient cannot advance another's read position. Concurrent sends to one recipient and independent acknowledgment by multiple recipients are covered by tests.
- Every message carries an ID; recipients acknowledge, deduplicate repeated delivery, and fail closed on malformed or replayed envelopes. Deduplication against transcript-observed copies applies when optional observation is enabled; reading transcripts is not required for messaging.
- Start-of-turn and stop-boundary inbox checks are enabled only for participating sessions, with per-session expiry and continuation limits. Verify host adapter behavior and disclose unsupported boundaries/manual fallback. Optional observation shares the continuation budget and checks messages before peer catch-up; queued messages do not imply idle-session wake support.
- Shared Markdown log publication is safe with concurrent participants and retains the append-only record; messaging grants no implicit ownership of source files or permission for simultaneous worktree mutations.
- Authority rules unchanged: a message is peer text, never instruction or authorization.
- Lifecycle is bound to the project/worktree; closeout or expiry disables delivery, while history deletion follows explicit cleanup or a defined retention policy. This is independent of any merged-log feature; N>2 transcript observation remains separate work, not a prerequisite for multi-agent messaging.
