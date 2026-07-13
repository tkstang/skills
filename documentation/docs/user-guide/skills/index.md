---
title: 'Skills'
description: 'Standalone session skills for working across coding-agent sessions.'
---

# Skills

These are standalone Agent Skills, not part of the consensus plugin. They ship
alongside it under `skills/` and help you work across coding-agent sessions
(Claude Code, Codex, and Cursor) without inventing new infrastructure.

- **session-observer** — review what another coding agent just did in this
  project, render a tool-free digest, and track per-session read offsets so
  `catch-up` shows only new content.
- **session-observer-collab** — coordinate a user and two mutually observing
  agent sessions with exact pins, bounded wake behavior, and explicit
  authority and closeout rules.
- **export-session-transcript** — export the current agent session to a
  sanitized Markdown transcript, named after the current git branch and written
  by default to `~/Downloads`.

## Contents

- [Session Observer](session-observer.md) - Review a peer coding agent's session with tool-free digests, per-session read offsets, and foreground watch mode.
- [Session Observer Collaboration](session-observer-collab.md) - Run the bounded N=2 collaboration protocol, choose an honest wake tier, and close out safely.
- [Export Session Transcript](export-session-transcript.md) - Export the current session to a sanitized, branch-named Markdown transcript.
