---
title: 'Session'
description: 'Exchange messages, preserve context, export a transcript, prepare an alpha native fork, or review a session.'
---

# Session

The Session plugin helps local coding-agent sessions exchange messages,
preserve context, and learn from completed work. Choose the capability you
need; these skills are not a required sequence.

```mermaid
flowchart LR
  Q{"What do you need<br/>from this session?"}
  M["messaging · agent-messaging<br/>Durable addressed inbox and shared log<br/>with manual fallback and finite delivery"]
  H["handoff · session-handoff<br/>Portable continuation brief:<br/>goal, state, decisions, evidence,<br/>remaining work, approval boundaries"]
  E["export-transcript · session-export-transcript<br/>Sanitized, branch-named Markdown archive<br/>written to ~/Downloads by default"]
  F["fork-to-destination · session-fork-to-destination<br/>Alpha same-provider fork guidance<br/>Prepares instructions only; creates no fork"]
  R["retro · session-retro<br/>Evidence-backed findings and<br/>improvement proposals, not applied"]

  Q -->|"someone else continues the work"| H
  Q -->|"coordinate with local sessions"| M
  Q -->|"keep a readable record"| E
  Q -->|"continue native history<br/>in another worktree"| F
  Q -->|"learn from the episode"| R
  E -.->|optional| H
```

_Mermaid updated 2026-09-19_

| What you need                                        | Skill                                                              | What it produces                                                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Let another agent or person continue the work        | [Handoff](../../skills/session-handoff.md)                         | A portable packet of goals, state, decisions, evidence, remaining work, and approval boundaries.                  |
| Keep a readable conversation archive                 | [Export Transcript](../../skills/session-export-transcript.md)     | A sanitized Markdown transcript, not a continuation packet or native session transfer.                            |
| Continue native history in another existing worktree | [Fork to Destination](../../skills/session-fork-to-destination.md) | Alpha, same-provider, destination-safe guidance; preparation does not create a fork or transfer worktree changes. |
| Learn from an invocation or bounded episode          | [Retro](../../skills/session-retro.md)                             | Evidence-backed findings and improvement proposals, without applying them.                                        |
| Exchange addressed work across local sessions        | [Messaging](../../skills/agent-messaging.md)                       | A durable inbox and shared log, with manual fallback and separately verified finite delivery.                     |

## Installation and names

Install the Session plugin using the [Installation guide](../../installation.md).
Each member also has a standalone form:

| Plugin-local name     | Standalone name               |
| --------------------- | ----------------------------- |
| `handoff`             | `session-handoff`             |
| `export-transcript`   | `session-export-transcript`   |
| `fork-to-destination` | `session-fork-to-destination` |
| `retro`               | `session-retro`               |
| `messaging`           | `agent-messaging`             |

The linked guides cover both forms. Invocation syntax depends on the host; do
not assume every provider exposes the same qualified command name.

Session does not require the Consensus plugin. Observer integration is optional
where a guide offers it. [Observer](../../skills/session-observer.md) and
[Collaborative Observer](../../skills/session-observer-collab.md) are available
standalone and as Consensus members, not Session members. Messaging is a Session
member and composes with an exact active Collaborative Observer owner only when
the installed adapter proves that capability; it does not make either observer
skill a Session dependency.

Fork to Destination is alpha: provider coverage and end-to-end verification
are incomplete. Static packaging is not proof of live provider discovery or permissions; keep the
[installation verification limits](../../installation.md) in view.

## Contents

- [Handoff](../../skills/session-handoff.md) — Prepare portable continuation context.
- [Export Transcript](../../skills/session-export-transcript.md) — Save a sanitized conversation archive.
- [Fork to Destination](../../skills/session-fork-to-destination.md) — Prepare alpha same-provider native fork guidance.
- [Retro](../../skills/session-retro.md) — Review a bounded episode and propose improvements.
- [Messaging](../../skills/agent-messaging.md) — Exchange durable addressed messages with explicit receipt and delivery boundaries.
