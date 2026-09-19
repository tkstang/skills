---
title: 'Agent Messaging'
description: 'How durable mail, finite delivery, observer composition, and external state fit together.'
---

# Agent Messaging architecture

Agent Messaging separates durable collaboration data from host attention. A
message can be safely committed without any provider hook, watcher, daemon, or
transcript access. Optional delivery adapters may present bounded context only
after an explicit finite activation and exact ownership checks.

## One external container

All commands resolve one state root from `SESSION_OBSERVER_STATE_DIR`, then
`XDG_STATE_HOME`, then the platform default. A collaboration UUID names the
container below that root. The cwd never selects the collaboration, which lets
participants work in different repositories and worktrees on the same machine.

The container separates authority by record type:

| Record                 | Authority                                                                                   | Important boundary                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Membership             | Exact `runtime:sessionId`, stable participant UUID, alias generation, and explicit takeover | An alias never silently follows a newer session.                                |
| Messages               | Immutable sender/recipient records and explicit recipient acknowledgments                   | Enqueued, presented, acknowledged, acted on, and completed are different facts. |
| Collaboration log      | Immutable entries and corrections                                                           | `collaboration.md` is a regenerable view, never the source of truth.            |
| Activation             | Exact member, session, worktree, controller, mechanism, epoch, expiry, and finite budget    | Presence does not prove host installation, trust, or invocation.                |
| Claims and diagnostics | Per-event/per-message attempt records                                                       | An attempt is not a delivery receipt or an acknowledgment.                      |
| Observer state         | Public/private cursors and continuity checkpoints                                           | Messaging presentation and acknowledgment cannot advance observer cursors.      |

There is no automatic retention cleanup or cross-machine transport. Closeout
makes the collaboration inert but preserves its history.

## Persistence before attention

A sender supplies a stable message UUID. The store commits the message before
reporting enqueue success, and uncertain commits are retried with the same ID.
The recipient controls acknowledgment after reading the complete body. This
supports durable recovery without claiming exactly-once action: a host can lose
output after a claim, a session can stop before acting, and a reply can be
informational rather than completion.

Status therefore distinguishes:

- a pending message;
- an interrupted pre-output attempt that can be retried;
- an attempted output with unknown host outcome;
- an explicit recipient acknowledgment.

Only a separate application-level response can establish that requested work
was completed.

## Finite activation and one controller

An activation binds one immutable epoch to an exact member/session/worktree, a
mechanism (`stop` or `monitor`), and a controller (`standalone-messaging` or
`observer-collab`). Its default bounds are a fixed two-hour expiry, 24-hour hard
cap, 20 non-reusable continuation slots, and zero reply wait. Automatic or peer
activity cannot renew those bounds.

Standalone adapters recheck identity, cwd, activation, hook inventory, and
ownership immediately before output. A foreground watch is request-only, lasts
at most 30 minutes, never self-rearms, and uses the existing activation and
remaining slots.

When an exact Codex observer lease and a verified composition-capable adapter
agree, `observer-collab` owns the single Stop route. It selects an addressed
inbox request before an observation range. Otherwise it reserves a shared slot
before observer compare-and-swap. A compare-and-swap loss emits nothing and
spends at most that slot. Standalone messaging Stop/watch entrypoints are inert
for that epoch, so competing callbacks cannot create a second continuation
owner.

Ownership fails closed for unreadable, mismatched, legacy, uncomposed,
uncertain, or competing routes. A recognized observer hook without an active
lease permits standalone messaging. Controller changes require explicit disable
and re-enable rather than mutation of an active epoch.

## Capability evidence

Documentation, fixture coverage, installation, trust, invocation, recipient
context, continuation, and cleanup are independent evidence columns. The
repository fixtures cover Codex and Claude Code standalone adapters and Codex
observer composition, but they do not prove a live host path.

Current conservative labels are:

| Host path                                          | Repository evidence           | Live claim                                                                      |
| -------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------- |
| Codex prompt/Stop/watch and composed observer Stop | Documented and fixture-tested | Unverified until an authorized exact-host receipt exists.                       |
| Claude Code prompt/Stop/finite watch               | Documented and fixture-tested | Unverified; standalone Monitor also needs acting-session ownership attestation. |
| Claude composed observer Monitor                   | Not implemented in this phase | Pending Phase `p04-t01`; enablement reports `composed-monitor-unavailable`.     |
| Cursor automatic delivery                          | No verified native boundary   | Unsupported; use manual turn-start and attempted-stop inbox checks.             |

Live probes are opt-in because they may mutate hook/trust state, invoke a
provider, spend quota, and require owned cleanup. Static build and test gates
must leave unprobed rows unverified.

## Distribution ownership

Canonical instructions and runtime live under `src/skills/agent-messaging/` and
shared storage primitives under `src/shared/collaboration/`. The distribution
catalog emits standalone `agent-messaging` and Session plugin-local `messaging`.
Collaborative Observer is separately emitted as standalone
`session-observer-collab` and Consensus plugin-local `observer-collab`, but its
bundle includes the same shared log primitives. Generated payloads are complete
installation units and are never edited directly.

See [Build & Distribution](generated-runtime.md) for generation rules and the
[Agent Messaging user guide](../../user-guide/skills/agent-messaging.md) for the
operator workflow.
