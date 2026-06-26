---
id: DR-260604-export-identifies-the-live
title: Export identifies the live session by an announced content marker, with
  newest-for-cwd fallback
date: 2026-06-04
status: Accepted.
legacy_id: DR-015
---

### DR-015: Export identifies the live session by an announced content marker, with newest-for-cwd fallback

- **Date:** 2026-06-04
**Context:** Unlike session-observer (peer model), the export script runs *inside* the conversation it exports and must pick the current transcript unambiguously even with concurrent sessions.
**Decision:** The skill instructs the agent to generate and announce a random hex marker, then invoke the CLI with `--match <marker>`; the CLI greps candidates for it. Selection-mode precedence is `--all` > `--session` > `--match` > default newest-for-cwd; the fallback covers transcript flush lag with a warning.
**Rationale:** The announced marker lands in the transcript by definition, making self-identification exact. Documented precedence keeps multi-flag behavior predictable and testable.
- **Status:** Accepted.
