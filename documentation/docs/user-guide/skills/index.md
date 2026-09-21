---
title: 'Standalone Skills'
description: 'Find independently installable skills by capability, including members also available through Consensus or Session.'
---

# Standalone Skills

Session skills have canonical descriptive names and may be installed as
standalone Agent Skills or through a plugin-local short name. Observation and
collaboration live in the consensus plugin; retro, handoff, export, and
destination fork guidance live in the session plugin. `next-steps`,
`must-we`, and `complexity-review` are standalone only.

Choose by what the next session needs:

| Goal                                                                          | Use                                                           | What carries forward                                                                                                                                                    |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Understand what to do next and why                                            | [Next Steps](next-steps.md)                                   | A contextual recommendation that identifies the next justified action and who can take it, without executing it.                                                        |
| Decide whether a requirement or proposal is necessary                         | [Must We?](must-we.md)                                        | An evidence-based verdict, consequence of skipping, and the smallest sufficient path.                                                                                   |
| Review one bounded branch diff, file set, or document independently           | [Consensus Review](../consensus/review.md)                    | Validated JSON and OAT-compatible Markdown with findings, provenance, checks, and explicit detection limits; no automatic fixes.                                        |
| Learn from one skill invocation or a bounded session episode                  | [Session Retro](session-retro.md)                             | Evidence-backed findings and validation proposals; the review does not apply its own changes.                                                                           |
| Let any agent or person continue the work                                     | [Session Handoff](session-handoff.md)                         | A concise, portable packet of goal, state, decisions, evidence, remaining work, and approval boundaries. It does not preserve native provider history or runtime state. |
| Keep a durable record of the conversation                                     | [Session Export Transcript](session-export-transcript.md)     | A sanitized Markdown transcript for reference. It is an archive, not a continuation packet or a session transfer.                                                       |
| Continue native history within the same provider in another existing worktree | [Session Fork to Destination](session-fork-to-destination.md) | Alpha, destination-safe instructions for a native fork. Preparation does not create a fork, transfer worktree changes, or move native state across providers.           |
| Exchange addressed questions, blockers, and handoffs among local sessions     | [Agent Messaging](agent-messaging.md)                         | Durable per-recipient messages, explicit acknowledgments, exact takeover, and optional finite delivery without an exactly-once action claim.                            |

These skills are grouped by user-facing behavior. The grouping does not mean
that they share one implementation, and it does not require installing an
entire plugin: see [Installation](../installation.md) for the supported plugin
and standalone choices.

- **next-steps** — explain the current situation and recommend justified
  actions without executing them.
- **must-we** — evaluate whether a blocker, requirement, or proposed action is
  necessary and identify a smaller path when warranted.
- **session-retro** (session-local `retro`) — review a bounded episode and
  report evidence-backed findings; the complete workflow requires
  **session-export-transcript** (session-local `export-transcript`).
- **session-handoff** (session-local `handoff`) — prepare a concise,
  evidence-grounded continuation brief; observer and transcript export are
  optional integrations.
- **session-export-transcript** (session-local `export-transcript`) — export the current agent session to a
  sanitized Markdown transcript, named after the current git branch and written
  by default to `~/Downloads`.
- **session-fork-to-destination** (session-local `fork-to-destination`, alpha) — discover and preview an explicit
  source session, then prepare destination-safe same-provider fork guidance
  without invoking a provider or creating a fork. Provider coverage and
  end-to-end verification are incomplete.
- **session-observer** — review what another coding agent just did in this
  project, render a tool-free digest, and track per-session read offsets so
  `catch-up` shows only new content.
- **session-observer-collab** — coordinate a user and two mutually observing
  agent sessions with exact pins, bounded wake behavior, and explicit
  authority and closeout rules.
- **agent-messaging** (session-local `messaging`) — exchange durable addressed
  messages among three or more local sessions with explicit receipts and a
  shared collaboration log; manual inbox checks remain the fallback when the
  exact host boundary lacks live evidence.
- **complexity-review** — judge whether each schema, script, test, harness,
  agent pass, or abstraction in a plan or implementation earns its ongoing
  cost, and get the minimum sufficient version with reintroduction triggers.
- **consensus-review** (consensus-local `review`) — run one bounded,
  provider-backed read-only review and render receivable findings without
  applying them.

## Contents

### Decide what to do

- [Next Steps](next-steps.md) - Explain the current state and recommend justified actions without executing them.
- [Must We?](must-we.md) - Decide whether a blocker or proposal is necessary and find the smallest sufficient path.

### Review and improve

- [Consensus Review](../consensus/review.md) - Review a branch diff, selected files, or one document through one independent provider invocation.
- [Complexity Review](complexity-review.md) - Decide whether each piece of machinery in a plan or implementation is justified by the contract, and get the minimum sufficient version.
- [Session Retro](session-retro.md) - Review one invocation or bounded episode without applying findings; requires Session Export Transcript and is available standalone or as Session `retro`.

### Preserve and continue

- [Session Handoff](session-handoff.md) - Prepare portable continuation context with optional observer and transcript-export integrations.
- [Session Export Transcript](session-export-transcript.md) - Export the current session to a sanitized, branch-named Markdown transcript.
- [Session Fork to Destination](session-fork-to-destination.md) - Prepare alpha, read-only destination-tab fork guidance without invoking a provider.

### Observe and collaborate

- [Agent Messaging](agent-messaging.md) - Exchange addressed messages among local sessions without sharing transcripts, with manual fallback and optional finite delivery.
- [Session Observer](session-observer.md) - Review a peer coding agent's session with tool-free digests, per-session read offsets, and foreground watch mode.
- [Collaborative Observer](session-observer-collab.md) - Run the bounded N=2 collaboration protocol, choose an honest wake tier, and close out safely.
