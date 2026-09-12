---
title: 'Skills'
description: 'Standalone skills: work across coding-agent sessions, and review whether an artifact is more complex than its contract needs.'
---

# Skills

These are standalone Agent Skills, not part of the consensus plugin. They ship
alongside it under `skills/`. Three help you work across coding-agent sessions
(Claude Code, Codex, and Cursor) without inventing new infrastructure; one
reviews whether an artifact's complexity is earning its keep.

- **session-observer** — review what another coding agent just did in this
  project, render a tool-free digest, and track per-session read offsets so
  `catch-up` shows only new content.
- **session-observer-collab** — coordinate a user and two mutually observing
  agent sessions with exact pins, bounded wake behavior, and explicit
  authority and closeout rules.
- **export-session-transcript** — export the current agent session to a
  sanitized Markdown transcript, named after the current git branch and written
  by default to `~/Downloads`.
- **complexity-review** — judge whether each schema, script, test, harness,
  agent pass, or abstraction in a plan or implementation earns its ongoing
  cost, and get the minimum sufficient version with reintroduction triggers.

## Contents

- [Session Observer](session-observer.md) - Review a peer coding agent's session with tool-free digests, per-session read offsets, and foreground watch mode.
- [Session Observer Collaboration](session-observer-collab.md) - Run the bounded N=2 collaboration protocol, choose an honest wake tier, and close out safely.
- [Export Session Transcript](export-session-transcript.md) - Export the current session to a sanitized, branch-named Markdown transcript.
- [Complexity Review](complexity-review.md) - Decide whether each piece of machinery in a plan or implementation is justified by the contract, and get the minimum sufficient version.
